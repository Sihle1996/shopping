package com.example.backend.service;

import com.example.backend.entity.AiAlert;
import com.example.backend.entity.MenuItem;
import com.example.backend.entity.Order;
import com.example.backend.entity.OrderStatus;
import com.example.backend.entity.Tenant;
import com.example.backend.repository.AiAlertRepository;
import com.example.backend.repository.MenuItemRepository;
import com.example.backend.repository.OrderRepository;
import com.example.backend.repository.PromotionRepository;
import com.example.backend.repository.TenantRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.*;
import java.util.*;

/**
 * Generates proactive "Smart Alerts" for a store from its own data. Computed
 * straight from the order/menu repos (no request context) so it also runs in
 * the scheduled scan. De-duplicates by a stable key so it never spams.
 */
@Service
@RequiredArgsConstructor
public class SmartAlertService {

    private final MenuItemRepository menuItemRepository;
    private final OrderRepository orderRepository;
    private final PromotionRepository promotionRepository;
    private final TenantRepository tenantRepository;
    private final AiAlertRepository aiAlertRepository;
    private final ObjectMapper objectMapper;

    private static final ZoneId SAST = ZoneId.of("Africa/Johannesburg");
    /** A store needs at least this many orders in the last 30 days before promo advice is relevant. */
    private static final int ESTABLISHED_ORDERS_30D = 25;

    @Transactional
    public int scan(UUID tenantId) {
        Tenant tenant = tenantRepository.findById(tenantId).orElse(null);
        if (tenant == null) return 0;

        List<MenuItem> items = menuItemRepository.findByTenant_Id(tenantId);
        Instant now = Instant.now();
        List<Order> last30 = orderRepository.findByOrderDateBetweenAndTenant_Id(now.minus(Duration.ofDays(30)), now, tenantId);

        // units sold per item (genuine orders)
        Map<UUID, Integer> sold = new HashMap<>();
        for (Order o : last30) {
            if (isVoided(o.getStatus())) continue;
            for (var oi : o.getOrderItems()) {
                var mi = oi.getMenuItem();
                if (mi != null && mi.getId() != null) {
                    sold.merge(mi.getId(), oi.getQuantity() != null ? oi.getQuantity() : 0, Integer::sum);
                }
            }
        }

        int created = 0;

        // 0) Store closed — you're not taking orders. One tap to open.
        if (Boolean.FALSE.equals(tenant.getIsOpen())) {
            created += raise(tenant, "store-closed", "high",
                    "Your store is closed",
                    "You're not accepting orders right now. Open the store to start receiving them.",
                    action("set_store_open", "Open the store", Map.of("open", true)));
        }

        // 1) Sold-out sellers — an item that normally sells is sold out / hidden.
        for (MenuItem mi : items) {
            int units = sold.getOrDefault(mi.getId(), 0);
            if (units <= 0 || mi.getPrice() == null || mi.getPrice() <= 0) continue;
            int free = mi.getStock() - mi.getReservedStock();
            boolean available = !Boolean.FALSE.equals(mi.getIsAvailable());
            if (free <= 0 || !available) {
                double avgDaily = units / 30.0;
                int restock = Math.max(5, (int) Math.ceil(avgDaily * 7));
                created += raise(tenant, "soldout:" + mi.getId(), "high",
                        mi.getName() + " is sold out",
                        String.format(Locale.UK, "It sells about %.1f/day — restock to stop losing orders.", avgDaily),
                        action("adjust_stock", "Restock " + mi.getName() + " +" + restock,
                                Map.of("itemId", mi.getId().toString(), "itemName", mi.getName(),
                                        "change", restock, "reason", "AI alert: stockout")));
            }
        }

        // 2) Promo drought — only for an ESTABLISHED, steadily-trading store with no
        // live deal. A brand-new shop shouldn't be nagged to discount before it has
        // a track record.
        long activePromos = promotionRepository.findActiveByTenantId(OffsetDateTime.now(), tenantId).size();
        long ordersRecent = last30.stream().filter(o -> !isVoided(o.getStatus())).count();
        if (activePromos == 0 && ordersRecent >= ESTABLISHED_ORDERS_30D) {
            created += raise(tenant, "promo-drought", "medium",
                    "No promotion is running",
                    "You're trading steadily with no deal live. A short discount is a quick way to lift orders.",
                    action("create_promotion", "Launch 15% off for 3 days",
                            Map.of("title", "Flash Sale", "discountPercent", 15, "days", 3)));
        }

        // 3) Pending orders aging — something's sitting unprepared.
        long oldestPending = 0; int awaiting = 0;
        for (Order o : last30) {
            String s = o.getStatus();
            if (s == null || o.getOrderDate() == null) continue;
            OrderStatus os = OrderStatus.fromLabel(s);
            if (os == OrderStatus.PENDING || os == OrderStatus.CONFIRMED || os == OrderStatus.SCHEDULED) {
                long mins = Duration.between(o.getOrderDate(), now).toMinutes();
                if (mins >= 0 && mins < 1440) { awaiting++; oldestPending = Math.max(oldestPending, mins); }
            }
        }
        if (awaiting > 0 && oldestPending >= 15) {
            created += raise(tenant, "pending-aging", "high",
                    awaiting + " order" + (awaiting > 1 ? "s" : "") + " awaiting prep",
                    "Oldest is " + oldestPending + " min old and not started. Check the kitchen.",
                    null);
        }

        // 4) Milestone — today is beating the last fortnight (a little delight).
        Map<LocalDate, Double> daily = new HashMap<>();
        for (Order o : last30) {
            if (isVoided(o.getStatus()) || o.getOrderDate() == null) continue;
            LocalDate d = o.getOrderDate().atZone(SAST).toLocalDate();
            daily.merge(d, o.getTotalAmount() != null ? o.getTotalAmount() : 0, Double::sum);
        }
        LocalDate today = LocalDate.now(SAST);
        double todayRev = daily.getOrDefault(today, 0.0);
        double maxPrior = daily.entrySet().stream().filter(e -> !e.getKey().equals(today))
                .mapToDouble(Map.Entry::getValue).max().orElse(0);
        if (todayRev > 0 && maxPrior > 0 && todayRev > maxPrior) {
            created += raise(tenant, "milestone:" + today, "info",
                    "Best sales day in two weeks",
                    String.format(Locale.UK, "R%.0f today beats your recent best of R%.0f. Keep it going.", todayRev, maxPrior),
                    null);
        }

        return created;
    }

    private int raise(Tenant tenant, String key, String severity, String title, String body, Map<String, Object> action) {
        if (aiAlertRepository.existsByTenant_IdAndAlertKeyAndStatus(tenant.getId(), key, "NEW")) return 0;
        AiAlert a = new AiAlert();
        a.setTenant(tenant);
        a.setAlertKey(key);
        a.setSeverity(severity);
        a.setTitle(title);
        a.setBody(body);
        a.setStatus("NEW");
        if (action != null) {
            try { a.setAction(objectMapper.writeValueAsString(action)); } catch (Exception ignored) {}
        }
        aiAlertRepository.save(a);
        return 1;
    }

    private Map<String, Object> action(String action, String label, Map<String, Object> params) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("action", action);
        m.put("label", label);
        m.put("params", params);
        return m;
    }

    private boolean isVoided(String status) {
        OrderStatus s = OrderStatus.fromLabel(status);
        return s != null && s.isVoided();
    }
}
