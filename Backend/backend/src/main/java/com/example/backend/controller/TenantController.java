package com.example.backend.controller;

import com.example.backend.entity.Tenant;
import com.example.backend.repository.OrderRepository;
import com.example.backend.repository.TenantRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class TenantController {

    private final TenantRepository tenantRepository;
    private final OrderRepository orderRepository;

    // Public - list active tenants (for customer store selection)
    // Must be defined BEFORE {slug} to avoid path conflict
    @GetMapping("/api/tenants/active")
    public ResponseEntity<List<Tenant>> getActiveTenants() {
        return ResponseEntity.ok(tenantRepository.findByActiveTrue());
    }

    // Public - nearby active tenants within their delivery radius of the customer
    @GetMapping("/api/tenants/nearby")
    public ResponseEntity<List<NearbyTenantDto>> getNearbyTenants(
            @RequestParam double lat,
            @RequestParam double lon) {
        List<NearbyTenantDto> nearby = tenantRepository.findByActiveTrue().stream()
                .filter(t -> t.getLatitude() != null && t.getLongitude() != null)
                .map(t -> {
                    double dist = haversineKm(lat, lon, t.getLatitude(), t.getLongitude());
                    return new NearbyTenantDto(
                            t.getId(), t.getName(), t.getSlug(),
                            t.getLogoUrl(), t.getPrimaryColor(),
                            t.getAddress(), t.getPhone(),
                            Math.round(dist * 10.0) / 10.0,
                            t.getDeliveryRadiusKm()
                    );
                })
                .filter(dto -> dto.distanceKm() <= dto.deliveryRadiusKm())
                .sorted(Comparator.comparingDouble(NearbyTenantDto::distanceKm))
                .toList();
        return ResponseEntity.ok(nearby);
    }

    private double haversineKm(double lat1, double lon1, double lat2, double lon2) {
        final double R = 6371.0;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    public record NearbyTenantDto(
            UUID id, String name, String slug,
            String logoUrl, String primaryColor,
            String address, String phone,
            double distanceKm, Integer deliveryRadiusKm
    ) {}

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

    // SUPERADMIN only - delete tenant
    @DeleteMapping("/api/superadmin/tenants/{id}")
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<Void> deleteTenant(@PathVariable UUID id) {
        if (!tenantRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        tenantRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    // SUPERADMIN only - toggle tenant active status
    @PatchMapping("/api/superadmin/tenants/{id}/toggle-active")
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<Tenant> toggleTenantActive(@PathVariable UUID id) {
        return tenantRepository.findById(id)
                .map(tenant -> {
                    tenant.setActive(!tenant.isActive());
                    return ResponseEntity.ok(tenantRepository.save(tenant));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    // SUPERADMIN only - platform stats
    @GetMapping("/api/superadmin/stats")
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<PlatformStats> getPlatformStats() {
        List<Tenant> allTenants = tenantRepository.findAll();
        long totalTenants = allTenants.size();
        long activeTenants = allTenants.stream().filter(Tenant::isActive).count();
        long totalOrders = orderRepository.count();
        double totalRevenue = orderRepository.findAll().stream()
                .filter(o -> o.getTotalAmount() != null)
                .mapToDouble(o -> o.getTotalAmount())
                .sum();
        return ResponseEntity.ok(new PlatformStats(totalTenants, activeTenants, totalOrders, totalRevenue));
    }

    public record PlatformStats(long totalTenants, long activeTenants, long totalOrders, double totalRevenue) {}
}
