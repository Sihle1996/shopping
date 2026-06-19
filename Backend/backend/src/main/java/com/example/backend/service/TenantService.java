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
        var oldAddress = tenant.getAddress();
        var oldLat = tenant.getLatitude();
        var oldLon = tenant.getLongitude();
        var oldRadius = tenant.getDeliveryRadiusKm();

        if (updates.getName() != null) tenant.setName(updates.getName());
        if (updates.getSlug() != null) tenant.setSlug(updates.getSlug());
        if (updates.getEmail() != null) tenant.setEmail(updates.getEmail());
        if (updates.getLogoUrl() != null) tenant.setLogoUrl(updates.getLogoUrl());
        if (updates.getPrimaryColor() != null) tenant.setPrimaryColor(updates.getPrimaryColor());
        if (updates.getBrandFont() != null) tenant.setBrandFont(updates.getBrandFont());
        if (updates.getSecondaryColor() != null) tenant.setSecondaryColor(updates.getSecondaryColor());
        if (updates.getButtonStyle() != null) tenant.setButtonStyle(updates.getButtonStyle());
        if (updates.getButtonFill() != null) tenant.setButtonFill(updates.getButtonFill());
        if (updates.getCoverImageUrl() != null) tenant.setCoverImageUrl(updates.getCoverImageUrl());
        if (updates.getStoreDescription() != null) tenant.setStoreDescription(updates.getStoreDescription());
        if (updates.getInstagramUrl() != null) tenant.setInstagramUrl(updates.getInstagramUrl());
        if (updates.getFacebookUrl() != null) tenant.setFacebookUrl(updates.getFacebookUrl());
        if (updates.getWebsiteUrl() != null) tenant.setWebsiteUrl(updates.getWebsiteUrl());
        if (updates.getPhone() != null) tenant.setPhone(updates.getPhone());
        if (updates.getAddress() != null) tenant.setAddress(updates.getAddress());
        if (updates.getLatitude() != null) tenant.setLatitude(updates.getLatitude());
        if (updates.getLongitude() != null) tenant.setLongitude(updates.getLongitude());
        if (updates.getDeliveryRadiusKm() != null) tenant.setDeliveryRadiusKm(updates.getDeliveryRadiusKm());
        if (updates.getDeliveryFeeBase() != null) tenant.setDeliveryFeeBase(updates.getDeliveryFeeBase());
        // Billing/economics fields are SUPERADMIN-only. A store admin hitting /api/admin/settings must
        // never change their own plan, status, or platform commission — that would be revenue theft.
        boolean isSuperadmin = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication() != null
                && org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication()
                        .getAuthorities().stream().anyMatch(a -> "ROLE_SUPERADMIN".equals(a.getAuthority()));
        if (isSuperadmin) {
            if (updates.getSubscriptionStatus() != null) tenant.setSubscriptionStatus(updates.getSubscriptionStatus());
            if (updates.getSubscriptionPlan() != null) planCommissionService.applyPlan(tenant, updates.getSubscriptionPlan());
            // Explicit commission (e.g. a negotiated rate) overrides the plan default set by applyPlan above.
            if (updates.getPlatformCommissionPercent() != null) {
                tenant.setPlatformCommissionPercent(updates.getPlatformCommissionPercent()
                        .max(java.math.BigDecimal.ZERO).min(new java.math.BigDecimal("100")));
            }
        }
        if (updates.getMinimumOrderAmount() != null) tenant.setMinimumOrderAmount(updates.getMinimumOrderAmount());
        // Open/closed is deliberately NOT settable here. It is owned solely by setStoreOpen(), which
        // also sets manualOpenOverride so the scheduler respects the admin's choice. Letting a generic
        // settings/theme save flip isOpen (without an override) is how a theme update was closing the
        // store and then "not sticking" — the scheduler reverted it on the next tick.
        if (updates.getEstimatedDeliveryMinutes() != null) tenant.setEstimatedDeliveryMinutes(updates.getEstimatedDeliveryMinutes());
        if (updates.getAutoCancelMinutes() != null) tenant.setAutoCancelMinutes(updates.getAutoCancelMinutes());
        if (updates.getOpeningHours() != null) tenant.setOpeningHours(updates.getOpeningHours());
        if (updates.getCuisineType() != null) tenant.setCuisineType(updates.getCuisineType());
        if (updates.getDriverEarningPercent() != null) tenant.setDriverEarningPercent(updates.getDriverEarningPercent()
                .max(java.math.BigDecimal.ZERO).min(new java.math.BigDecimal("100")));

        Tenant saved = tenantRepository.save(tenant);
        boolean openChanged = oldOpen != null && saved.getIsOpen() != null && !oldOpen.equals(saved.getIsOpen());
        // A store's location is a material attribute (delivery zones, customer matching, jurisdiction) — log
        // it as a distinct, detailed audit event so the platform can monitor/spot abuse (industry norm).
        boolean locationChanged = !java.util.Objects.equals(oldAddress, saved.getAddress())
                || !java.util.Objects.equals(oldLat, saved.getLatitude())
                || !java.util.Objects.equals(oldLon, saved.getLongitude())
                || !java.util.Objects.equals(oldRadius, saved.getDeliveryRadiusKm());
        if (locationChanged) {
            auditService.log(AuditService.ADMIN, "STORE_LOCATION_CHANGED", "TENANT", id,
                    "Location changed to \"" + (saved.getAddress() != null ? saved.getAddress() : "(none)")
                            + "\" [" + saved.getLatitude() + ", " + saved.getLongitude()
                            + ", radius " + saved.getDeliveryRadiusKm() + "km] — was \""
                            + (oldAddress != null ? oldAddress : "(none)") + "\"");
        } else {
            auditService.log(AuditService.ADMIN, openChanged ? "STORE_OPEN_TOGGLED" : "SETTINGS_UPDATED", "TENANT", id,
                    openChanged ? ("Store " + (saved.getIsOpen() ? "opened" : "closed")) : "Store settings updated");
        }
        return saved;
    }

    /** Manually open/close the store. Sets manualOpenOverride so StoreHoursScheduler respects the
     *  admin's choice instead of reverting it on its next tick. */
    public void setStoreOpen(UUID tenantId, boolean open) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new RuntimeException("Tenant not found with ID: " + tenantId));
        tenant.setIsOpen(open);
        tenant.setManualOpenOverride(true);
        tenantRepository.save(tenant);
        auditService.log(AuditService.ADMIN, "STORE_OPEN_TOGGLED", "TENANT", tenantId,
                "Store manually " + (open ? "opened" : "closed"));
    }
}
