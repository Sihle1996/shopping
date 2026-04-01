package com.example.backend.controller;

import com.example.backend.entity.SalesTrendDTO;
import com.example.backend.entity.TopProductDTO;
import com.example.backend.service.AnalyticsService;
import com.example.backend.service.SubscriptionEnforcementService;
import com.example.backend.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/analytics")
@PreAuthorize("hasAnyRole('ADMIN','SUPERADMIN')")
@RequiredArgsConstructor
public class AnalyticsController {

    private final AnalyticsService analyticsService;
    private final SubscriptionEnforcementService subscriptionEnforcementService;

    @GetMapping("/sales-trends")
    public List<SalesTrendDTO> salesTrends(@RequestParam String startDate, @RequestParam String endDate) {
        enforceAnalyticsAccess();
        return analyticsService.getSalesTrends(Instant.parse(startDate), Instant.parse(endDate));
    }

    @GetMapping("/top-products")
    public List<TopProductDTO> topProducts(@RequestParam String startDate, @RequestParam String endDate) {
        enforceAnalyticsAccess();
        return analyticsService.getTopProducts(Instant.parse(startDate), Instant.parse(endDate));
    }

    @GetMapping("/aov")
    public double averageOrderValue(@RequestParam String startDate, @RequestParam String endDate) {
        enforceAnalyticsAccess();
        return analyticsService.getAverageOrderValue(Instant.parse(startDate), Instant.parse(endDate));
    }

    @GetMapping("/on-time")
    public double onTime(@RequestParam String startDate, @RequestParam String endDate) {
        enforceAnalyticsAccess();
        return analyticsService.getOnTimePercentage(Instant.parse(startDate), Instant.parse(endDate));
    }

    @GetMapping("/cancellations")
    public double cancellations(@RequestParam String startDate, @RequestParam String endDate) {
        enforceAnalyticsAccess();
        return analyticsService.getCancellationRate(Instant.parse(startDate), Instant.parse(endDate));
    }

    private void enforceAnalyticsAccess() {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId != null) {
            subscriptionEnforcementService.assertAnalyticsAccess(tenantId);
        }
    }
}
