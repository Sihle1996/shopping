package com.example.backend.controller;

import com.example.backend.entity.SalesTrendDTO;
import com.example.backend.entity.TopProductDTO;
import com.example.backend.service.AnalyticsService;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/admin/analytics")
public class AnalyticsController {
    private final AnalyticsService analyticsService;

    public AnalyticsController(AnalyticsService analyticsService) {
        this.analyticsService = analyticsService;
    }

    @GetMapping("/sales-trends")
    public List<SalesTrendDTO> salesTrends(@RequestParam String startDate, @RequestParam String endDate) {
        return analyticsService.getSalesTrends(Instant.parse(startDate), Instant.parse(endDate));
    }

    @GetMapping("/top-products")
    public List<TopProductDTO> topProducts(@RequestParam String startDate, @RequestParam String endDate) {
        return analyticsService.getTopProducts(Instant.parse(startDate), Instant.parse(endDate));
    }

    @GetMapping("/aov")
    public double averageOrderValue(@RequestParam String startDate, @RequestParam String endDate) {
        return analyticsService.getAverageOrderValue(Instant.parse(startDate), Instant.parse(endDate));
    }

    @GetMapping("/on-time")
    public double onTime(@RequestParam String startDate, @RequestParam String endDate) {
        return analyticsService.getOnTimePercentage(Instant.parse(startDate), Instant.parse(endDate));
    }

    @GetMapping("/cancellations")
    public double cancellations(@RequestParam String startDate, @RequestParam String endDate) {
        return analyticsService.getCancellationRate(Instant.parse(startDate), Instant.parse(endDate));
    }
}
