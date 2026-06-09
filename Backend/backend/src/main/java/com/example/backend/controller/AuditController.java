package com.example.backend.controller;

import com.example.backend.entity.AuditEvent;
import com.example.backend.repository.AuditEventRepository;
import com.example.backend.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/** Read-only access to the activity trail — recent store-wide activity + per-order timeline. */
@RestController
@RequestMapping("/api/admin/audit")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AuditController {

    private final AuditEventRepository repository;

    @GetMapping
    public ResponseEntity<?> recent(@RequestParam(defaultValue = "0") int page,
                                    @RequestParam(defaultValue = "30") int size) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        var pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 100));
        return ResponseEntity.ok(repository.findByTenantIdOrderByCreatedAtDesc(tenantId, pageable).map(this::toDto));
    }

    @GetMapping("/order/{orderId}")
    public ResponseEntity<?> forOrder(@PathVariable UUID orderId) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        return ResponseEntity.ok(
                repository.findByTenantIdAndEntityIdOrderByCreatedAtDesc(tenantId, orderId).stream().map(this::toDto).toList());
    }

    private Map<String, Object> toDto(AuditEvent e) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("source", e.getSource());
        m.put("action", e.getAction());
        m.put("entityType", e.getEntityType());
        m.put("entityId", e.getEntityId() != null ? e.getEntityId().toString() : null);
        m.put("summary", e.getSummary());
        m.put("actor", e.getActorEmail());
        m.put("createdAt", e.getCreatedAt() != null ? e.getCreatedAt().toString() : null);
        return m;
    }
}
