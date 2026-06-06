package com.example.backend.controller;

import com.example.backend.entity.PayoutLedgerEntry;
import com.example.backend.service.PayoutLedgerService;
import com.example.backend.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/payouts")
@RequiredArgsConstructor
public class AdminPayoutController {

    private final PayoutLedgerService payoutLedgerService;

    @GetMapping("/ledger")
    public ResponseEntity<Page<LedgerEntryDTO>> getLedger(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        Page<PayoutLedgerEntry> entries = payoutLedgerService.getLedger(tenantId, PageRequest.of(page, size));
        return ResponseEntity.ok(entries.map(LedgerEntryDTO::from));
    }

    @GetMapping("/balance")
    public ResponseEntity<Map<String, Object>> getBalance() {
        UUID tenantId = TenantContext.getCurrentTenantId();
        BigDecimal balance = payoutLedgerService.getBalance(tenantId);
        return ResponseEntity.ok(Map.of("balance", balance, "currency", "ZAR"));
    }

    record LedgerEntryDTO(String id, String orderId, String entryType,
                           BigDecimal amount, BigDecimal balanceAfter,
                           String description, String createdAt) {
        static LedgerEntryDTO from(PayoutLedgerEntry e) {
            return new LedgerEntryDTO(
                    e.getId().toString(),
                    e.getOrder() != null ? e.getOrder().getId().toString() : null,
                    e.getEntryType(),
                    e.getAmountRand(),
                    e.getBalanceAfter(),
                    e.getDescription(),
                    e.getCreatedAt() != null ? e.getCreatedAt().toString() : null
            );
        }
    }
}
