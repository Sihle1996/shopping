package com.example.backend.controller;

import com.example.backend.entity.Order;
import com.example.backend.repository.OrderRepository;
import com.example.backend.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * The store's actual CUSTOMERS — derived from its ORDERS, not from user.tenant_id (customers are
 * marketplace-wide and never carry a store's id). A customer is a distinct order-placer at this
 * tenant (a registered user by email, or a guest by email), with order count, lifetime spend, and
 * last-order date so the owner can spot regulars and lapsed customers.
 */
@RestController
@RequestMapping("/api/admin/customers")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminCustomerController {

    private final OrderRepository orderRepository;

    @GetMapping
    public List<CustomerSummary> list() {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId == null) throw new SecurityException("Tenant context required");

        // Orders come back most-recent-first, so the first one we see for an email is the latest.
        Map<String, Agg> byEmail = new LinkedHashMap<>();
        for (Order o : orderRepository.findByTenant_IdOrderByOrderDateDesc(tenantId)) {
            String email = o.getUser() != null ? o.getUser().getEmail() : o.getGuestEmail();
            if (email == null || email.isBlank()) continue;
            email = email.trim().toLowerCase();
            Agg a = byEmail.computeIfAbsent(email, k -> new Agg());
            if (a.orderCount == 0) { // first (latest) order — capture identity from it
                a.name = o.getUser() != null ? o.getUser().getFullName() : null;
                a.phone = o.getUser() != null ? o.getUser().getPhone() : o.getGuestPhone();
                a.registered = o.getUser() != null;
                a.lastOrderAt = o.getOrderDate();
            }
            a.orderCount++;
            a.totalSpent += o.getTotalAmount() != null ? o.getTotalAmount() : 0.0;
        }

        return byEmail.entrySet().stream()
                .map(e -> {
                    Agg a = e.getValue();
                    return new CustomerSummary(e.getKey(), a.name, a.phone, a.orderCount,
                            Math.round(a.totalSpent * 100.0) / 100.0, a.lastOrderAt, a.registered);
                })
                .sorted(Comparator.comparingDouble(CustomerSummary::totalSpent).reversed())
                .toList();
    }

    private static class Agg {
        String name;
        String phone;
        int orderCount;
        double totalSpent;
        Instant lastOrderAt;
        boolean registered;
    }

    record CustomerSummary(String email, String name, String phone, int orderCount,
                           double totalSpent, Instant lastOrderAt, boolean registered) {}
}
