package com.example.backend.controller;

import com.example.backend.entity.Tenant;
import com.example.backend.repository.TenantRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class TenantController {

    private final TenantRepository tenantRepository;

    // Public - list active tenants (for customer store selection)
    // Must be defined BEFORE {slug} to avoid path conflict
    @GetMapping("/api/tenants/active")
    public ResponseEntity<List<Tenant>> getActiveTenants() {
        return ResponseEntity.ok(tenantRepository.findByActiveTrue());
    }

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
}
