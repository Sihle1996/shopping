package com.example.backend.service;

import com.example.backend.entity.Order;
import com.example.backend.entity.OrderStatus;
import com.example.backend.entity.Tenant;
import com.example.backend.repository.OrderRepository;
import com.example.backend.repository.UserRepository;
import com.example.backend.user.DriverStatus;
import com.example.backend.user.Role;
import com.example.backend.user.User;
import com.example.backend.util.GeoUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * V1 driver recommendation — a DETERMINISTIC, explainable ranking (no ML, no auto-dispatch).
 * Scores each driver against the order's store on proximity, current workload and past speed,
 * gated by availability, and explains the "why". The admin still assigns manually; if this
 * endpoint fails the UI falls back to the plain driver list.
 */
@Service
@RequiredArgsConstructor
public class DriverAssignmentService {

    private static final double PROXIMITY_CAP_KM = 15.0; // driver-to-store reach, not delivery radius
    private static final long   STALE_MINUTES = 30;      // older location = untrusted
    private static final int    MIN_TIMED_DELIVERIES = 3;// below this, performance stays neutral
    private static final double W_PROX = 0.5, W_FREE = 0.3, W_PERF = 0.2;
    private static final double NEUTRAL_PROXIMITY = 0.4; // located drivers should outrank unlocated
    private static final double NEUTRAL_PERFORMANCE = 0.5;
    private static final List<String> ACTIVE_STATUSES = List.of("Out for Delivery", "Preparing");

    private static final int MIN_OUTCOME_SAMPLE = 5; // before showing accepted-vs-overridden timing

    private final OrderRepository orderRepository;
    private final UserRepository userRepository;
    private final com.example.backend.repository.RecommendationDecisionRepository recommendationDecisionRepository;

    @Transactional(readOnly = true)
    public Map<String, Object> recommendDrivers(UUID tenantId, UUID orderId) {
        Order order = (tenantId != null
                ? orderRepository.findByIdAndTenant_Id(orderId, tenantId)
                : orderRepository.findById(orderId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("orderId", orderId.toString());

        String status = order.getStatus();
        if ("Cancelled".equals(status) || "Rejected".equals(status) || "Delivered".equals(status)) {
            out.put("drivers", List.of());
            out.put("note", "Driver assignment is not available for " + status + " orders.");
            return out;
        }

        Tenant tenant = order.getTenant();
        if (tenant == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Order has no store");
        }
        boolean proximityAvailable = tenant.getLatitude() != null && tenant.getLongitude() != null;
        out.put("proximityAvailable", proximityAvailable);

        // Order-ready context: assigning a driver before the food is ready leaves them idling at
        // the store (wasted capacity). We don't predict prep time (no ML) — we surface readiness so
        // the admin assigns at the right moment. Doesn't affect ranking (it's about the order).
        out.put("orderStatus", status);
        String readiness;
        switch (status) {
            case "Preparing" -> {
                readiness = "PREPARING";
                out.put("readinessNote", "Order is being prepared — assign close to ready so the driver isn't left waiting at the store.");
            }
            case "Scheduled" -> {
                readiness = "SCHEDULED";
                out.put("readinessNote", "Scheduled order — assign a driver near the scheduled delivery time, not now.");
            }
            case "Out for Delivery" -> readiness = "READY"; // already dispatched / re-assignment
            default -> { // Pending, Confirmed — kitchen not working on it yet
                readiness = "NOT_STARTED";
                out.put("readinessNote", "Kitchen hasn't started this order yet — a driver assigned now may wait at the store.");
            }
        }
        out.put("readiness", readiness);

        UUID currentDriverId = order.getDriver() != null ? order.getDriver().getId() : null;

        List<User> drivers = userRepository.findByRoleAndTenant_Id(Role.DRIVER, tenantId);
        if (drivers.isEmpty()) {
            out.put("fleetAvgMinutes", null);
            out.put("drivers", List.of());
            out.put("note", "No drivers found for this store.");
            return out;
        }

        // Active-order counts — one GROUP BY query.
        Map<UUID, Long> activeByDriver = new HashMap<>();
        for (Object[] row : orderRepository.countActiveOrdersByDriver(tenantId, ACTIVE_STATUSES)) {
            activeByDriver.put((UUID) row[0], (Long) row[1]);
        }

        // Per-driver avg delivery minutes (last 30d) + fleet avg — same window/filter as driverInsights.
        Instant now = Instant.now();
        Map<UUID, long[]> stats = new HashMap<>(); // driverId -> [deliveries, sumMinutes, timedCount]
        for (Order o : orderRepository.findByOrderDateBetweenAndTenant_Id(
                now.minus(Duration.ofDays(30)), now, tenantId)) {
            if (!OrderStatus.DELIVERED.matches(o.getStatus()) || o.getDriver() == null) continue;
            long[] s = stats.computeIfAbsent(o.getDriver().getId(), k -> new long[3]);
            s[0]++;
            if (o.getOrderDate() != null && o.getDeliveredAt() != null) {
                long mins = Duration.between(o.getOrderDate(), o.getDeliveredAt()).toMinutes();
                if (mins >= 0 && mins < 600) { s[1] += mins; s[2]++; }
            }
        }
        long fleetSum = stats.values().stream().mapToLong(x -> x[1]).sum();
        long fleetTimed = stats.values().stream().mapToLong(x -> x[2]).sum();
        Integer fleetAvg = fleetTimed > 0 ? (int) (fleetSum / fleetTimed) : null;
        out.put("fleetAvgMinutes", fleetAvg);

        List<Map<String, Object>> rows = new ArrayList<>();
        for (User d : drivers) {
            boolean available = d.getDriverStatus() == DriverStatus.AVAILABLE;
            long active = activeByDriver.getOrDefault(d.getId(), 0L);
            long[] s = stats.get(d.getId());
            long deliveries = s != null ? s[0] : 0L;
            Integer avg = (s != null && s[2] >= MIN_TIMED_DELIVERIES) ? (int) (s[1] / s[2]) : null;

            // Proximity (driver -> store). Stale/missing location -> neutral, lower confidence.
            Double distanceKm = null;
            Long locationAgeMinutes = null;
            double proximity = NEUTRAL_PROXIMITY;
            boolean locationFresh = false;
            if (proximityAvailable && d.getLatitude() != null && d.getLongitude() != null) {
                double dist = GeoUtils.haversineKm(d.getLatitude(), d.getLongitude(),
                        tenant.getLatitude(), tenant.getLongitude());
                distanceKm = Math.round(dist * 10.0) / 10.0;
                if (d.getLastPing() != null) {
                    locationAgeMinutes = Duration.between(d.getLastPing(), now).toMinutes();
                }
                if (locationAgeMinutes != null && locationAgeMinutes <= STALE_MINUTES) {
                    proximity = Math.max(0.0, 1 - Math.min(dist, PROXIMITY_CAP_KM) / PROXIMITY_CAP_KM);
                    locationFresh = true;
                }
            }

            double freeness = 1.0 / (1 + active);

            // Performance = recency-weighted on-time rate (EWMA), not raw average time. Needs a few
            // deliveries before it counts; otherwise neutral.
            Double onTime = d.getDeliveryScoreEwma();
            int onTimeSamples = d.getDeliveryScoreSamples() != null ? d.getDeliveryScoreSamples() : 0;
            boolean hasHistory = onTime != null && onTimeSamples >= MIN_TIMED_DELIVERIES;
            double performance = hasHistory ? Math.max(0.0, Math.min(1.0, onTime)) : NEUTRAL_PERFORMANCE;

            double score = W_PROX * proximity + W_FREE * freeness + W_PERF * performance;
            String confidence = (locationFresh && hasHistory) ? "HIGH"
                    : (locationFresh ^ hasHistory) ? "MEDIUM" : "LOW";

            List<String> reasons = new ArrayList<>();
            if (!available) reasons.add(d.getDriverStatus() == null ? "status unknown" : "unavailable");
            if (distanceKm != null && locationFresh) {
                reasons.add(distanceKm + " km from store");
            } else if (distanceKm != null) {
                reasons.add(distanceKm + " km from store (location "
                        + (locationAgeMinutes != null ? locationAgeMinutes + " min old" : "stale") + ")");
            } else if (!proximityAvailable) {
                reasons.add("store location not set");
            } else {
                reasons.add("no recent location");
            }
            reasons.add(active == 0 ? "free now (0 active orders)"
                    : active + " active " + (active == 1 ? "delivery" : "deliveries"));
            Integer onTimePct = hasHistory ? (int) Math.round(onTime * 100) : null;
            if (hasHistory) {
                reasons.add(onTimePct + "% on-time (" + onTimeSamples + " deliveries)");
            } else {
                reasons.add("limited delivery history");
            }

            Map<String, Object> r = new LinkedHashMap<>();
            r.put("driverId", d.getId().toString());
            r.put("name", d.getFullName() != null && !d.getFullName().isBlank() ? d.getFullName() : d.getEmail());
            r.put("email", d.getEmail());
            r.put("available", available);
            r.put("recommended", false); // set after ranking
            r.put("isCurrentDriver", d.getId().equals(currentDriverId));
            r.put("score", Math.round(score * 100.0) / 100.0);
            r.put("distanceKm", distanceKm);
            r.put("locationAgeMinutes", locationAgeMinutes);
            r.put("activeOrders", active);
            r.put("avgDeliveryMinutes", avg);
            r.put("deliveries", deliveries);
            r.put("onTimeRate", onTimePct);
            r.put("onTimeSamples", onTimeSamples);
            r.put("confidence", confidence);
            r.put("reasons", reasons);
            rows.add(r);
        }

        // Rank: AVAILABLE first, then score desc.
        rows.sort((a, b) -> {
            boolean aa = (Boolean) a.get("available"), ba = (Boolean) b.get("available");
            if (aa != ba) return aa ? -1 : 1;
            return Double.compare((Double) b.get("score"), (Double) a.get("score"));
        });
        // The top AVAILABLE driver is the recommendation.
        boolean anyAvailable = false;
        for (Map<String, Object> r : rows) {
            if ((Boolean) r.get("available")) { r.put("recommended", true); anyAvailable = true; break; }
        }

        if (!anyAvailable) {
            out.put("note", "No available drivers — showing all for manual assignment.");
        } else if (!proximityAvailable) {
            out.put("note", "Store location not set — ranking by workload and speed only.");
        }
        out.put("drivers", rows);
        return out;
    }

    /** Does following the recommendation actually help? Acceptance rate + accepted-vs-overridden
     *  driver-leg times (the comparison gated behind a minimum sample so it isn't noise). */
    @Transactional(readOnly = true)
    public Map<String, Object> recommendationStats(UUID tenantId) {
        var all = recommendationDecisionRepository.findByTenantId(tenantId);
        // Only decisions where a recommendation was actually shown count toward acceptance.
        var withRec = all.stream().filter(d -> d.getRecommendedDriverId() != null).toList();
        long total = withRec.size();
        long accepted = withRec.stream().filter(com.example.backend.entity.RecommendationDecision::isAccepted).count();

        var timed = withRec.stream().filter(d -> d.getDriverLegMinutes() != null).toList();
        var accStats = timed.stream().filter(com.example.backend.entity.RecommendationDecision::isAccepted)
                .mapToInt(com.example.backend.entity.RecommendationDecision::getDriverLegMinutes).summaryStatistics();
        var ovrStats = timed.stream().filter(d -> !d.isAccepted())
                .mapToInt(com.example.backend.entity.RecommendationDecision::getDriverLegMinutes).summaryStatistics();

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("decisions", total);
        out.put("acceptanceRate", total > 0 ? (int) Math.round(100.0 * accepted / total) : null);
        Integer avgAccepted = accStats.getCount() >= MIN_OUTCOME_SAMPLE ? (int) Math.round(accStats.getAverage()) : null;
        Integer avgOverridden = ovrStats.getCount() >= MIN_OUTCOME_SAMPLE ? (int) Math.round(ovrStats.getAverage()) : null;
        out.put("avgLegAcceptedMin", avgAccepted);
        out.put("avgLegOverriddenMin", avgOverridden);
        out.put("acceptedSamples", (int) accStats.getCount());
        out.put("overriddenSamples", (int) ovrStats.getCount());
        out.put("comparable", avgAccepted != null && avgOverridden != null);
        return out;
    }
}
