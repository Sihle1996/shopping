package com.example.backend.controller;

import com.example.backend.entity.Payout;
import com.example.backend.repository.PayoutRepository;
import com.example.backend.repository.TenantRepository;
import com.example.backend.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class PayoutController {

    private final PayoutRepository payoutRepository;
    private final TenantRepository tenantRepository;

    /** Admin: list payouts for their store */
    @GetMapping("/api/admin/payouts")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERADMIN')")
    public ResponseEntity<List<Payout>> adminPayouts() {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId == null) return ResponseEntity.badRequest().build();
        return ResponseEntity.ok(payoutRepository.findByTenant_IdOrderByCreatedAtDesc(tenantId));
    }

    /** SuperAdmin: list all payouts across tenants */
    @GetMapping("/api/superadmin/payouts")
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<List<Payout>> superAdminPayouts() {
        return ResponseEntity.ok(payoutRepository.findAllByOrderByCreatedAtDesc());
    }

    /** SuperAdmin: create a payout record for a tenant */
    @PostMapping("/api/superadmin/payouts")
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body) {
        String tenantIdStr = (String) body.get("tenantId");
        if (tenantIdStr == null) return ResponseEntity.badRequest().body(Map.of("error", "tenantId required"));
        return tenantRepository.findById(UUID.fromString(tenantIdStr)).map(tenant -> {
            Payout p = new Payout();
            p.setTenant(tenant);
            if (body.get("periodStart") != null) p.setPeriodStart(Instant.parse((String) body.get("periodStart")));
            if (body.get("periodEnd") != null) p.setPeriodEnd(Instant.parse((String) body.get("periodEnd")));
            p.setGrossRevenue(toDouble(body.get("grossRevenue")));
            p.setPlatformFeePercent(toDouble(body.get("platformFeePercent")));
            p.setPlatformFee(toDouble(body.get("platformFee")));
            p.setNetAmount(toDouble(body.get("netAmount")));
            if (body.get("notes") != null) p.setNotes((String) body.get("notes"));
            return ResponseEntity.ok(payoutRepository.save(p));
        }).orElse(ResponseEntity.notFound().build());
    }

    /** SuperAdmin: mark a payout as paid */
    @PatchMapping("/api/superadmin/payouts/{id}")
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<?> update(@PathVariable UUID id, @RequestBody Map<String, Object> body) {
        return payoutRepository.findById(id).map(p -> {
            if (body.containsKey("status")) {
                try {
                    p.setStatus(Payout.PayoutStatus.valueOf((String) body.get("status")));
                    if (p.getStatus() == Payout.PayoutStatus.PAID) p.setPaidAt(Instant.now());
                } catch (IllegalArgumentException ignored) {}
            }
            if (body.containsKey("reference")) p.setReference((String) body.get("reference"));
            if (body.containsKey("notes")) p.setNotes((String) body.get("notes"));
            return ResponseEntity.ok(payoutRepository.save(p));
        }).orElse(ResponseEntity.notFound().build());
    }

    private double toDouble(Object v) {
        if (v == null) return 0;
        if (v instanceof Number) return ((Number) v).doubleValue();
        try { return Double.parseDouble(v.toString()); } catch (NumberFormatException e) { return 0; }
    }
}
