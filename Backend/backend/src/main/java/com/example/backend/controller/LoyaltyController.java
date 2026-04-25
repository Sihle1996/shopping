package com.example.backend.controller;

import com.example.backend.repository.LoyaltyAccountRepository;
import com.example.backend.repository.LoyaltyTransactionRepository;
import com.example.backend.service.LoyaltyService;
import com.example.backend.tenant.TenantContext;
import com.example.backend.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/loyalty")
@RequiredArgsConstructor
public class LoyaltyController {

    private final LoyaltyService loyaltyService;
    private final LoyaltyAccountRepository accountRepo;
    private final LoyaltyTransactionRepository txRepo;

    /** Get current user's points balance for this store */
    @GetMapping("/balance")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getBalance(@AuthenticationPrincipal User user) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId == null) return ResponseEntity.badRequest().build();
        int balance = loyaltyService.getBalance(user, tenantId);
        double cashValue = (balance / (double) LoyaltyService.POINTS_PER_REDEMPTION) * LoyaltyService.RAND_VALUE_PER_100;
        return ResponseEntity.ok(Map.of(
                "balance", balance,
                "cashValue", Math.floor(cashValue * 100) / 100,
                "minRedemption", LoyaltyService.POINTS_PER_REDEMPTION
        ));
    }

    /** Get transaction history */
    @GetMapping("/history")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getHistory(@AuthenticationPrincipal User user) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId == null) return ResponseEntity.badRequest().build();
        return accountRepo.findByUser_IdAndTenant_Id(user.getId(), tenantId)
                .map(acc -> ResponseEntity.ok(txRepo.findByAccount_IdOrderByCreatedAtDesc(acc.getId())))
                .orElse(ResponseEntity.ok(java.util.Collections.emptyList()));
    }

    /** All loyalty accounts across every store the user has points at */
    @GetMapping("/wallet")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getWallet(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(loyaltyService.getWallet(user));
    }

    /** Pre-checkout: validate + calculate discount for N points */
    @PostMapping("/calculate")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> calculate(
            @RequestBody Map<String, Integer> body,
            @AuthenticationPrincipal User user) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId == null) return ResponseEntity.badRequest().build();
        int points = body.getOrDefault("points", 0);
        int balance = loyaltyService.getBalance(user, tenantId);
        if (points > balance) return ResponseEntity.badRequest().body("Insufficient points.");
        if (points % LoyaltyService.POINTS_PER_REDEMPTION != 0)
            return ResponseEntity.badRequest().body("Must redeem in multiples of " + LoyaltyService.POINTS_PER_REDEMPTION);
        double discount = (points / (double) LoyaltyService.POINTS_PER_REDEMPTION) * LoyaltyService.RAND_VALUE_PER_100;
        return ResponseEntity.ok(Map.of("discount", discount, "pointsUsed", points));
    }
}
