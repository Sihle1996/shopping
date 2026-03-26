package com.example.backend.service;

import com.example.backend.entity.Tenant;
import com.example.backend.repository.TenantRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TenantService {

    private final TenantRepository tenantRepository;

    public Tenant createTenant(String name, String slug, String email) {
        Tenant tenant = Tenant.builder()
                .name(name)
                .slug(slug)
                .email(email)
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
        if (updates.getPlatformCommissionPercent() != null) tenant.setPlatformCommissionPercent(updates.getPlatformCommissionPercent());
        if (updates.getStripeAccountId() != null) tenant.setStripeAccountId(updates.getStripeAccountId());
        if (updates.getSubscriptionStatus() != null) tenant.setSubscriptionStatus(updates.getSubscriptionStatus());
        if (updates.getSubscriptionPlan() != null) tenant.setSubscriptionPlan(updates.getSubscriptionPlan());

        return tenantRepository.save(tenant);
    }
}
