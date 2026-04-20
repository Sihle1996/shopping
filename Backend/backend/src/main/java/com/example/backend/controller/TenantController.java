package com.example.backend.controller;

import com.example.backend.entity.StoreDocument;
import com.example.backend.entity.StoreHours;
import com.example.backend.entity.Tenant;
import com.example.backend.repository.OrderRepository;
import com.example.backend.repository.StoreDocumentRepository;
import com.example.backend.repository.StoreHoursRepository;
import com.example.backend.repository.TenantRepository;
import com.example.backend.service.EmailService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequiredArgsConstructor
public class TenantController {

    private final TenantRepository tenantRepository;
    private final OrderRepository orderRepository;
    private final StoreHoursRepository storeHoursRepository;
    private final StoreDocumentRepository storeDocumentRepository;
    private final EmailService emailService;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    // Public - list active tenants (for customer store selection)
    // Must be defined BEFORE {slug} to avoid path conflict
    @GetMapping("/api/tenants/active")
    public ResponseEntity<List<Tenant>> getActiveTenants() {
        return ResponseEntity.ok(tenantRepository.findByActiveTrue());
    }

    // Public - nearby active tenants within their delivery radius of the customer
    @GetMapping("/api/tenants/nearby")
    public ResponseEntity<List<NearbyTenantDto>> getNearbyTenants(
            @RequestParam double lat,
            @RequestParam double lon) {
        List<NearbyTenantDto> nearby = tenantRepository.findByActiveTrue().stream()
                .filter(t -> !"SUSPENDED".equals(t.getSubscriptionStatus()))
                .filter(t -> t.getLatitude() != null && t.getLongitude() != null)
                .map(t -> {
                    double dist = haversineKm(lat, lon, t.getLatitude(), t.getLongitude());
                    return new NearbyTenantDto(
                            t.getId(), t.getName(), t.getSlug(),
                            t.getLogoUrl(), t.getPrimaryColor(),
                            t.getAddress(), t.getPhone(),
                            Math.round(dist * 10.0) / 10.0,
                            t.getDeliveryRadiusKm(),
                            t.getEstimatedDeliveryMinutes(),
                            t.getCuisineType(),
                            t.getIsOpen()
                    );
                })
                .filter(dto -> dto.distanceKm() <= dto.deliveryRadiusKm())
                .sorted(Comparator.comparingDouble(NearbyTenantDto::distanceKm))
                .toList();
        return ResponseEntity.ok(nearby);
    }

    private double haversineKm(double lat1, double lon1, double lat2, double lon2) {
        final double R = 6371.0;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    public record NearbyTenantDto(
            UUID id, String name, String slug,
            String logoUrl, String primaryColor,
            String address, String phone,
            double distanceKm, Integer deliveryRadiusKm,
            Integer estimatedDeliveryMinutes, String cuisineType, Boolean isOpen
    ) {}

    // Public - get tenant config by slug
    @GetMapping("/api/tenants/{slug}")
    public ResponseEntity<Tenant> getTenantBySlug(@PathVariable String slug) {
        // Guard against "active" being treated as a slug
        if ("active".equals(slug)) {
            return ResponseEntity.notFound().build();
        }
        return tenantRepository.findBySlug(slug)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // Public - calculate delivery fee based on customer coordinates
    // fee = deliveryFeeBase + (distanceKm * perKmRate)
    @GetMapping("/api/tenants/{slug}/delivery-fee")
    public ResponseEntity<?> getDeliveryFee(
            @PathVariable String slug,
            @RequestParam double lat,
            @RequestParam double lng) {

        return tenantRepository.findBySlug(slug).map(tenant -> {
            // Fall back to flat base fee when store has no coordinates
            if (tenant.getLatitude() == null || tenant.getLongitude() == null) {
                double baseFee = tenant.getDeliveryFeeBase() != null
                        ? tenant.getDeliveryFeeBase().doubleValue() : 0.0;
                return ResponseEntity.ok(new DeliveryFeeResponse(baseFee, 0.0, true));
            }

            double distanceKm = haversineKm(lat, lng, tenant.getLatitude(), tenant.getLongitude());
            int radiusKm = tenant.getDeliveryRadiusKm() != null ? tenant.getDeliveryRadiusKm() : 10;

            if (distanceKm > radiusKm) {
                return ResponseEntity.<Object>status(400).body(
                        Map.of("error", "Address is outside the delivery area",
                                "distanceKm", Math.round(distanceKm * 10.0) / 10.0,
                                "deliveryRadiusKm", radiusKm));
            }

            final double PER_KM_RATE = 2.50;
            double baseFee = tenant.getDeliveryFeeBase() != null
                    ? tenant.getDeliveryFeeBase().doubleValue() : 0.0;
            double fee = baseFee + (distanceKm * PER_KM_RATE);
            fee = Math.round(fee * 100.0) / 100.0;
            double roundedDistance = Math.round(distanceKm * 10.0) / 10.0;

            return ResponseEntity.ok(new DeliveryFeeResponse(fee, roundedDistance, true));
        }).orElse(ResponseEntity.notFound().build());
    }

    public record DeliveryFeeResponse(double deliveryFee, double distanceKm, boolean withinRadius) {}

    // Public - get weekly store hours for a given slug
    @GetMapping("/api/tenants/{slug}/hours")
    public ResponseEntity<List<Map<String, Object>>> getStoreHours(@PathVariable String slug) {
        return tenantRepository.findBySlug(slug).map(tenant -> {
            List<StoreHours> rows = storeHoursRepository.findByTenant_IdOrderByDayOfWeek(tenant.getId());
            List<Map<String, Object>> result = new ArrayList<>();
            for (int day = 1; day <= 7; day++) {
                final int d = day;
                StoreHours sh = rows.stream().filter(h -> h.getDayOfWeek() == d).findFirst().orElse(null);
                if (sh != null) {
                    result.add(Map.of("dayOfWeek", sh.getDayOfWeek(), "openTime", sh.getOpenTime(),
                            "closeTime", sh.getCloseTime(), "closed", sh.isClosed()));
                } else {
                    result.add(Map.of("dayOfWeek", day, "openTime", "08:00", "closeTime", "22:00", "closed", false));
                }
            }
            return ResponseEntity.ok(result);
        }).orElse(ResponseEntity.notFound().build());
    }

    // Public - register new tenant
    @PostMapping("/api/tenants/register")
    public ResponseEntity<Tenant> registerTenant(@Valid @RequestBody Tenant tenant) {
        // Auto-generate slug from name if not provided
        if (tenant.getSlug() == null || tenant.getSlug().isBlank()) {
            String slug = tenant.getName().toLowerCase()
                    .replaceAll("[^a-z0-9]+", "-")
                    .replaceAll("(^-|-$)", "");
            tenant.setSlug(slug);
        }
        // Record trial start time
        if ("TRIAL".equals(tenant.getSubscriptionStatus()) || tenant.getSubscriptionStatus() == null) {
            tenant.setTrialStartedAt(LocalDateTime.now());
        }
        // New stores start inactive; they must submit documents and be approved
        tenant.setActive(false);
        tenant.setApprovalStatus(Tenant.ApprovalStatus.DRAFT);
        Tenant saved = tenantRepository.save(tenant);
        return ResponseEntity.created(URI.create("/api/tenants/" + saved.getSlug())).body(saved);
    }

    // SUPERADMIN only - list all tenants
    @GetMapping("/api/superadmin/tenants")
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<List<Tenant>> listAllTenants() {
        return ResponseEntity.ok(tenantRepository.findAll());
    }

    // SUPERADMIN only - update tenant
    @PutMapping("/api/superadmin/tenants/{id}")
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<Tenant> updateTenant(@PathVariable UUID id, @Valid @RequestBody Tenant tenant) {
        return tenantRepository.findById(id)
                .map(existing -> {
                    tenant.setId(id);
                    return ResponseEntity.ok(tenantRepository.save(tenant));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    // SUPERADMIN only - delete tenant
    @DeleteMapping("/api/superadmin/tenants/{id}")
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<Void> deleteTenant(@PathVariable UUID id) {
        if (!tenantRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        tenantRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    // SUPERADMIN only - toggle tenant active status
    @PatchMapping("/api/superadmin/tenants/{id}/toggle-active")
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<Tenant> toggleTenantActive(@PathVariable UUID id) {
        return tenantRepository.findById(id)
                .map(tenant -> {
                    tenant.setActive(!tenant.isActive());
                    return ResponseEntity.ok(tenantRepository.save(tenant));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    // SUPERADMIN only - create tenant
    @PostMapping("/api/superadmin/tenants")
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<Tenant> createTenantAsAdmin(@Valid @RequestBody Tenant tenant) {
        if (tenant.getSlug() == null || tenant.getSlug().isBlank()) {
            String slug = tenant.getName().toLowerCase()
                    .replaceAll("[^a-z0-9]+", "-")
                    .replaceAll("(^-|-$)", "");
            tenant.setSlug(slug);
        }
        if (tenant.getSubscriptionStatus() == null) tenant.setSubscriptionStatus("TRIAL");
        if (tenant.getSubscriptionPlan() == null) tenant.setSubscriptionPlan("BASIC");
        tenant.setTrialStartedAt(LocalDateTime.now());
        Tenant saved = tenantRepository.save(tenant);
        return ResponseEntity.created(URI.create("/api/superadmin/tenants/" + saved.getId())).body(saved);
    }

    // SUPERADMIN only - patch subscription plan/status only
    @PatchMapping("/api/superadmin/tenants/{id}/subscription")
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<Tenant> updateSubscription(@PathVariable UUID id, @RequestBody Map<String, String> body) {
        return tenantRepository.findById(id).map(t -> {
            if (body.containsKey("subscriptionPlan")) t.setSubscriptionPlan(body.get("subscriptionPlan"));
            if (body.containsKey("subscriptionStatus")) t.setSubscriptionStatus(body.get("subscriptionStatus"));
            return ResponseEntity.ok(tenantRepository.save(t));
        }).orElse(ResponseEntity.notFound().build());
    }

    // SUPERADMIN only - extend a tenant's trial by N days
    @PatchMapping("/api/superadmin/tenants/{id}/extend-trial")
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<Tenant> extendTrial(@PathVariable UUID id, @RequestBody Map<String, Integer> body) {
        int days = body.getOrDefault("days", 7);
        return tenantRepository.findById(id).map(tenant -> {
            LocalDateTime base = tenant.getTrialStartedAt() != null
                    ? tenant.getTrialStartedAt()
                    : LocalDateTime.now().minusDays(14);
            tenant.setTrialStartedAt(base.plusDays(days));
            if ("SUSPENDED".equals(tenant.getSubscriptionStatus())) {
                tenant.setSubscriptionStatus("TRIAL");
            }
            return ResponseEntity.ok(tenantRepository.save(tenant));
        }).orElse(ResponseEntity.notFound().build());
    }

    // SUPERADMIN only - platform stats
    @GetMapping("/api/superadmin/stats")
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<PlatformStats> getPlatformStats() {
        List<Tenant> allTenants = tenantRepository.findAll();
        long totalTenants = allTenants.size();
        long activeTenants = allTenants.stream().filter(Tenant::isActive).count();
        long totalOrders = orderRepository.count();
        double totalRevenue = orderRepository.findAll().stream()
                .filter(o -> o.getTotalAmount() != null)
                .mapToDouble(o -> o.getTotalAmount())
                .sum();

        Map<String, Long> planBreakdown = allTenants.stream()
                .collect(Collectors.groupingBy(
                        t -> t.getSubscriptionPlan() != null ? t.getSubscriptionPlan() : "BASIC",
                        Collectors.counting()));

        Map<String, Long> statusBreakdown = allTenants.stream()
                .collect(Collectors.groupingBy(
                        t -> t.getSubscriptionStatus() != null ? t.getSubscriptionStatus() : "TRIAL",
                        Collectors.counting()));

        List<RecentTenant> recentTenants = allTenants.stream()
                .filter(t -> t.getCreatedAt() != null)
                .sorted(Comparator.comparing(Tenant::getCreatedAt).reversed())
                .limit(5)
                .map(t -> new RecentTenant(t.getId(), t.getName(), t.getSlug(),
                        t.getSubscriptionPlan(), t.getSubscriptionStatus(), t.getCreatedAt()))
                .toList();

        LocalDateTime now = LocalDateTime.now();
        List<TrialInfo> trialsExpiringSoon = allTenants.stream()
                .filter(t -> "TRIAL".equals(t.getSubscriptionStatus()) && t.getTrialStartedAt() != null)
                .map(t -> {
                    long daysUsed = ChronoUnit.DAYS.between(t.getTrialStartedAt(), now);
                    int daysRemaining = (int) Math.max(0, 14 - daysUsed);
                    return new TrialInfo(t.getId(), t.getName(), t.getSlug(), daysRemaining);
                })
                .sorted(Comparator.comparingInt(TrialInfo::daysRemaining))
                .toList();

        return ResponseEntity.ok(new PlatformStats(
                totalTenants, activeTenants, totalOrders, totalRevenue,
                planBreakdown, statusBreakdown, recentTenants, trialsExpiringSoon));
    }

    // SUPERADMIN — enrollment: list stores pending review
    @GetMapping("/api/superadmin/enrollment/pending")
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<List<PendingEnrollmentDto>> getPendingEnrollments() {
        List<Tenant> pending = tenantRepository.findByApprovalStatus(Tenant.ApprovalStatus.PENDING_REVIEW);
        List<PendingEnrollmentDto> result = pending.stream().map(t -> {
            List<StoreDocument> docs = storeDocumentRepository.findByTenantId(t.getId());
            return new PendingEnrollmentDto(
                    t.getId(), t.getName(), t.getSlug(), t.getEmail(), t.getPhone(),
                    t.getAddress(), t.getSubmittedForReviewAt(), docs
            );
        }).toList();
        return ResponseEntity.ok(result);
    }

    // SUPERADMIN — enrollment: approve a store
    @PostMapping("/api/superadmin/enrollment/{tenantId}/approve")
    @PreAuthorize("hasRole('SUPERADMIN')")
    @Transactional
    public ResponseEntity<?> approveEnrollment(@PathVariable UUID tenantId) {
        return tenantRepository.findById(tenantId).map(tenant -> {
            tenant.setApprovalStatus(Tenant.ApprovalStatus.APPROVED);
            tenant.setActive(true);
            tenant.setApprovedAt(Instant.now());
            tenant.setRejectionReason(null);
            tenantRepository.save(tenant);
            emailService.sendStoreApprovedEmail(tenant.getName(), tenant.getEmail(),
                    frontendUrl + "/admin/dashboard");
            return ResponseEntity.ok(Map.of("message", "Store approved"));
        }).orElse(ResponseEntity.notFound().build());
    }

    // SUPERADMIN — enrollment: reject a store
    @PostMapping("/api/superadmin/enrollment/{tenantId}/reject")
    @PreAuthorize("hasRole('SUPERADMIN')")
    @Transactional
    public ResponseEntity<?> rejectEnrollment(@PathVariable UUID tenantId,
                                               @RequestBody Map<String, String> body) {
        String reason = body.getOrDefault("reason", "");
        return tenantRepository.findById(tenantId).map(tenant -> {
            tenant.setApprovalStatus(Tenant.ApprovalStatus.REJECTED);
            tenant.setRejectionReason(reason);
            tenantRepository.save(tenant);
            emailService.sendStoreRejectedEmail(tenant.getName(), tenant.getEmail(), reason,
                    frontendUrl + "/admin/enrollment");
            return ResponseEntity.ok(Map.of("message", "Store rejected"));
        }).orElse(ResponseEntity.notFound().build());
    }

    public record PendingEnrollmentDto(
            UUID id, String name, String slug, String email, String phone,
            String address, Instant submittedAt, List<StoreDocument> documents) {}

    public record RecentTenant(UUID id, String name, String slug,
                               String subscriptionPlan, String subscriptionStatus,
                               LocalDateTime createdAt) {}

    public record TrialInfo(UUID id, String name, String slug, int daysRemaining) {}

    public record PlatformStats(
            long totalTenants, long activeTenants, long totalOrders, double totalRevenue,
            Map<String, Long> planBreakdown,
            Map<String, Long> statusBreakdown,
            List<RecentTenant> recentTenants,
            List<TrialInfo> trialsExpiringSoon) {}
}
