package com.example.backend.service;

import com.example.backend.config.PlanFeatureNotAvailableException;
import com.example.backend.config.PlanLimitExceededException;
import com.example.backend.entity.SubscriptionPlan;
import com.example.backend.entity.Tenant;
import com.example.backend.entity.TenantAiUsage;
import com.example.backend.repository.MenuItemRepository;
import com.example.backend.repository.PromotionRepository;
import com.example.backend.repository.SubscriptionPlanRepository;
import com.example.backend.repository.TenantAiUsageRepository;
import com.example.backend.repository.TenantRepository;
import com.example.backend.repository.UserRepository;
import com.example.backend.user.Role;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SubscriptionEnforcementService {

    private static final ZoneId SAST = ZoneId.of("Africa/Johannesburg");

    private final TenantRepository tenantRepository;
    private final SubscriptionPlanRepository planRepository;
    private final MenuItemRepository menuItemRepository;
    private final UserRepository userRepository;
    private final PromotionRepository promotionRepository;
    private final TenantAiUsageRepository aiUsageRepository;

    public SubscriptionPlan getPlan(UUID tenantId) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new RuntimeException("Tenant not found"));
        return planRepository.findByName(tenant.getSubscriptionPlan())
                .orElseThrow(() -> new RuntimeException("Subscription plan not found: " + tenant.getSubscriptionPlan()));
    }

    /** During the free trial the store gets the FULL (PRO-level) experience — feature gates pass, so the
     *  trial showcases everything and drives conversion. New stores default to the BASIC plan + TRIAL
     *  status, so without this they'd be blocked from the AI on day one. */
    public boolean isTrialing(UUID tenantId) {
        return tenantRepository.findById(tenantId)
                .map(t -> "TRIAL".equalsIgnoreCase(t.getSubscriptionStatus()))
                .orElse(false);
    }

    public void assertMenuItemLimit(UUID tenantId) {
        SubscriptionPlan plan = getPlan(tenantId);
        long current = menuItemRepository.countByTenant_Id(tenantId);
        if (current >= plan.getMaxMenuItems()) {
            throw new PlanLimitExceededException(
                "Menu item limit reached (" + current + "/" + plan.getMaxMenuItems() +
                " on " + plan.getName() + " plan). Upgrade to add more items.");
        }
    }

    public void assertDriverLimit(UUID tenantId) {
        SubscriptionPlan plan = getPlan(tenantId);
        long current = userRepository.countByRoleAndTenant_Id(Role.DRIVER, tenantId);
        if (current >= plan.getMaxDrivers()) {
            throw new PlanLimitExceededException(
                "Driver limit reached (" + current + "/" + plan.getMaxDrivers() +
                " on " + plan.getName() + " plan). Upgrade to add more drivers.");
        }
    }

    public void assertPromotionLimit(UUID tenantId) {
        SubscriptionPlan plan = getPlan(tenantId);
        long current = promotionRepository.countByTenant_IdAndActiveTrue(tenantId);
        if (current >= plan.getMaxPromotions()) {
            throw new PlanLimitExceededException(
                "Active promotion limit reached (" + current + "/" + plan.getMaxPromotions() +
                " on " + plan.getName() + " plan). Upgrade or deactivate a promotion first.");
        }
    }

    public void assertAnalyticsAccess(UUID tenantId) {
        SubscriptionPlan plan = getPlan(tenantId);
        if (!plan.isHasAnalytics()) {
            throw new PlanFeatureNotAvailableException(
                "Analytics requires PRO or higher. Upgrade your plan to access this feature.");
        }
    }

    public void assertCustomBrandingAccess(UUID tenantId) {
        SubscriptionPlan plan = getPlan(tenantId);
        if (!plan.isHasCustomBranding()) {
            throw new PlanFeatureNotAvailableException(
                "Custom branding (logo & color) requires PRO or higher. Upgrade your plan.");
        }
    }

    public void assertInventoryExportAccess(UUID tenantId) {
        SubscriptionPlan plan = getPlan(tenantId);
        if (!plan.isHasInventoryExport()) {
            throw new PlanFeatureNotAvailableException(
                "Inventory export requires PRO or higher. Upgrade your plan.");
        }
    }

    public void assertDeliveryRadius(UUID tenantId, double distanceKm) {
        SubscriptionPlan plan = getPlan(tenantId);
        int maxRadius = plan.getMaxDeliveryRadiusKm();
        if (maxRadius > 0 && distanceKm > maxRadius) {
            throw new PlanLimitExceededException(
                "Delivery address is outside your plan's allowed radius (" + maxRadius + " km). Upgrade to extend your delivery range.");
        }
    }

    // ---- AI intelligence gates (PRO+). null flag = not included (BASIC). ----

    public void assertPromoAiAccess(UUID tenantId) {
        if (isTrialing(tenantId)) return;
        if (!Boolean.TRUE.equals(getPlan(tenantId).getHasPromoAi()))
            throw new PlanFeatureNotAvailableException(
                "Promo intelligence (AI suggestions + net-lift) requires PRO or higher. Upgrade to unlock it.");
    }

    public void assertDriverIntelAccess(UUID tenantId) {
        if (isTrialing(tenantId)) return;
        if (!Boolean.TRUE.equals(getPlan(tenantId).getHasDriverIntel()))
            throw new PlanFeatureNotAvailableException(
                "Driver intelligence (scorecards + recommendation feedback) requires PRO or higher. Upgrade to unlock it.");
    }

    public void assertReviewAiAccess(UUID tenantId) {
        if (isTrialing(tenantId)) return;
        if (!Boolean.TRUE.equals(getPlan(tenantId).getHasReviewAi()))
            throw new PlanFeatureNotAvailableException(
                "Review & support AI (digest, drafted replies, triage) requires PRO or higher. Upgrade to unlock it.");
    }

    public void assertApiAccess(UUID tenantId) {
        if (!Boolean.TRUE.equals(getPlan(tenantId).getHasApiAccess()))
            throw new PlanFeatureNotAvailableException(
                "API access requires the ENTERPRISE plan.");
    }

    /** Copilot is available on every plan but METERED — enforce the per-plan monthly prompt quota
     *  (null = unlimited). Counts this month's COPILOT calls from tenant_ai_usage. */
    public void assertCopilotQuota(UUID tenantId) {
        if (isTrialing(tenantId)) return; // unlimited Copilot during the trial
        SubscriptionPlan plan = getPlan(tenantId);
        Integer quota = plan.getCopilotMonthlyQuota();
        if (quota == null) return; // fair use / unlimited
        String ym = LocalDate.now(SAST).toString().substring(0, 7);
        long used = aiUsageRepository.findByTenantIdAndYearMonth(tenantId, ym).stream()
                .filter(u -> "COPILOT_PROMPT".equals(u.getFeature())) // one per user query (not per agent step)
                .mapToLong(TenantAiUsage::getCallCount).sum();
        if (used >= quota)
            throw new PlanFeatureNotAvailableException(
                "You've used all " + quota + " Copilot prompts for this month on the " + plan.getName()
                + " plan. Upgrade for more, or it resets next month.");
    }
}
