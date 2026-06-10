package com.example.backend.service;

import com.example.backend.entity.Tenant;
import com.example.backend.repository.TenantRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TenantService {

    private final TenantRepository tenantRepository;
    private final AuditService auditService;
    private final PlanCommissionService planCommissionService;

    public Tenant createTenant(String name, String slug, String email) {
        Tenant tenant = Tenant.builder()
                .name(name)
                .slug(slug)
                .email(email)
                .active(false)   // new store starts inactive + DRAFT (entity default) until approved + go-live
                .trialStartedAt(LocalDateTime.now())
                .build();
        return tenantRepository.save(tenant);
    }

    public Optional<Tenant> getTenantBySlug(String slug) {
        return tenantRepository.findBySlug(slug);
    }

    public Optional<Tenant> getTenantById(UUID id) {
        return tenantRepository.findById(id);
    }

    public List<Tenant> getAllTenants() {
        return tenantRepository.findAll();
    }

    public Tenant updateTenant(UUID id, Tenant updates) {
        Tenant tenant = tenantRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Tenant not found with ID: " + id));
        Boolean oldOpen = tenant.getIsOpen();

        if (updates.getName() != null) tenant.setName(updates.getName());
        if (updates.getSlug() != null) tenant.setSlug(updates.getSlug());
        if (updates.getEmail() != null) tenant.setEmail(updates.getEmail());
        if (updates.getLogoUrl() != null) tenant.setLogoUrl(updates.getLogoUrl());
        if (updates.getPrimaryColor() != null) tenant.setPrimaryColor(updates.getPrimaryColor());
        if (updates.getPhone() != null) tenant.setPhone(updates.getPhone());
        if (updates.getAddress() != null) tenant.setAddress(updates.getAddress());
        if (updates.getLatitude() != null) tenant.setLatitude(updates.getLatitude());
        if (updates.getLongitude() != null) tenant.setLongitude(updates.getLongitude());
        if (updates.getDeliveryRadiusKm() != null) tenant.setDeliveryRadiusKm(updates.getDeliveryRadiusKm());
        if (updates.getDeliveryFeeBase() != null) tenant.setDeliveryFeeBase(updates.getDeliveryFeeBase());
        if (updates.getSubscriptionStatus() != null) tenant.setSubscriptionStatus(updates.getSubscriptionStatus());
        if (updates.getSubscriptionPlan() != null) planCommissionService.applyPlan(tenant, updates.getSubscriptionPlan());
        // Explicit commission (e.g. a negotiated rate) overrides the plan default set by applyPlan above.
        if (updates.getPlatformCommissionPercent() != null) tenant.setPlatformCommissionPercent(updates.getPlatformCommissionPercent());
        if (updates.getMinimumOrderAmount() != null) tenant.setMinimumOrderAmount(updates.getMinimumOrderAmount());
        if (updates.getIsOpen() != null) tenant.setIsOpen(updates.getIsOpen());
        if (updates.getEstimatedDeliveryMinutes() != null) tenant.setEstimatedDeliveryMinutes(updates.getEstimatedDeliveryMinutes());
        if (updates.getAutoCancelMinutes() != null) tenant.setAutoCancelMinutes(updates.getAutoCancelMinutes());
        if (updates.getOpeningHours() != null) tenant.setOpeningHours(updates.getOpeningHours());
        if (updates.getCuisineType() != null) tenant.setCuisineType(updates.getCuisineType());
        if (updates.getDriverEarningPercent() != null) tenant.setDriverEarningPercent(updates.getDriverEarningPercent());
        if (updates.getLoyaltyEnabled() != null) tenant.setLoyaltyEnabled(updates.getLoyaltyEnabled());

        Tenant saved = tenantRepository.save(tenant);
        boolean openChanged = oldOpen != null && saved.getIsOpen() != null && !oldOpen.equals(saved.getIsOpen());
        auditService.log(AuditService.ADMIN, openChanged ? "STORE_OPEN_TOGGLED" : "SETTINGS_UPDATED", "TENANT", id,
                openChanged ? ("Store " + (saved.getIsOpen() ? "opened" : "closed")) : "Store settings updated");
        return saved;
    }
}
