package com.example.backend.service;

import com.example.backend.entity.SubscriptionPlan;
import com.example.backend.entity.Tenant;
import com.example.backend.repository.SubscriptionPlanRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;

/**
 * Single source of truth for plan-derived tenant attributes. The {@code subscription_plans} table
 * (managed by the SuperAdmin) is authoritative for commission; this reads the rate from there and
 * writes it onto the tenant, so the Spring side never drifts from what SuperAdmin/.NET sets on the
 * shared DB. Falls back to the agreed tiering ({@link Tenant#commissionForPlan}) for a plan that has
 * no row yet (e.g. STARTER).
 */
@Service
@RequiredArgsConstructor
public class PlanCommissionService {

    private final SubscriptionPlanRepository planRepository;

    /** Set the tenant's plan AND sync its commission from the plan row (fallback: agreed tiering). */
    public void applyPlan(Tenant tenant, String planName) {
        tenant.setSubscriptionPlan(planName);
        tenant.setPlatformCommissionPercent(commissionForPlan(planName));
    }

    /** The plan's commission from the table, or the agreed-tiering fallback when there's no row. */
    public BigDecimal commissionForPlan(String planName) {
        return planRepository.findByName(planName)
                .map(SubscriptionPlan::getCommissionPercent)
                .filter(c -> c != null)
                .orElse(Tenant.commissionForPlan(planName));
    }
}
