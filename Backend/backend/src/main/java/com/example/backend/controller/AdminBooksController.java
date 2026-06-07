package com.example.backend.controller;

import com.example.backend.service.BookkeepingService;
import com.example.backend.service.SubscriptionEnforcementService;
import com.example.backend.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * CraveIt Books — admin-only, PRO-gated accounting view.
 * Phase 1 exposes the "Money In" summary (revenue, cost, profit, margin).
 */
@RestController
@RequestMapping("/api/admin/books")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminBooksController {

    /** Default window (days) — matches {@link BookkeepingService#DEFAULT_WINDOW_DAYS}; annotation defaults must be string literals. */
    private static final String DEFAULT_DAYS = "30";

    private final BookkeepingService bookkeepingService;
    private final SubscriptionEnforcementService subscriptionEnforcementService;

    @GetMapping("/money-in")
    public ResponseEntity<BookkeepingService.MoneyIn> moneyIn(
            @RequestParam(defaultValue = DEFAULT_DAYS) int days) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        subscriptionEnforcementService.assertAnalyticsAccess(tenantId); // Books is a PRO+ feature
        return ResponseEntity.ok(bookkeepingService.moneyIn(tenantId, days));
    }
}
