using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SuperAdmin.API.Data;
using SuperAdmin.API.DTOs;
using SuperAdmin.API.Models;

namespace SuperAdmin.API.Controllers;

[ApiController]
[Route("api/subscriptions")]
[Authorize(Roles = "SUPERADMIN")]
public class SubscriptionsController(AppDbContext db) : ControllerBase
{
    [HttpGet("plans")]
    public async Task<IActionResult> GetPlans()
    {
        var plans = await db.SubscriptionPlans.OrderBy(p => p.Price).ToListAsync();
        return Ok(plans.Select(ToDto));
    }

    // Plan CREATE / UPDATE / DELETE are intentionally disabled. The Spring backend OWNS the plan
    // schema — limits, the AI-gate columns (has_promo_ai / has_driver_intel / has_review_ai /
    // has_api_access / copilot_monthly_quota) and commission — and seeds rows via Flyway. A plan
    // written from here would miss those columns, so Spring would read a partial, AI-less plan.
    // SuperAdmin is a CONSUMER here: read plans (GetPlans) and assign them to stores (AssignPlan).
    // Full plan management returns in a later phase once a shared plan-definition contract exists.

    [HttpPatch("stores/{tenantId}/assign-plan")]
    public async Task<IActionResult> AssignPlan(Guid tenantId, [FromBody] AssignPlanRequest request)
    {
        var tenant = await db.Tenants.FindAsync(tenantId);
        if (tenant == null) return NotFound();

        var planName = request.PlanName.Trim().ToUpper();
        var plan = await db.SubscriptionPlans.FirstOrDefaultAsync(p => p.Name == planName);
        if (plan == null) return BadRequest(new { message = "Plan not found." });

        tenant.SubscriptionPlan = planName;
        tenant.PlatformCommissionPercent = plan.CommissionPercent;   // sync commission to the plan's canonical rate
        tenant.SubscriptionStatus = "ACTIVE";
        tenant.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(new { subscriptionPlan = tenant.SubscriptionPlan, platformCommissionPercent = tenant.PlatformCommissionPercent, subscriptionStatus = tenant.SubscriptionStatus });
    }

    [HttpPatch("stores/{tenantId}/extend-trial")]
    public async Task<IActionResult> ExtendTrial(Guid tenantId, [FromBody] ExtendTrialRequest request)
    {
        var tenant = await db.Tenants.FindAsync(tenantId);
        if (tenant == null) return NotFound();

        var days = Math.Clamp(request.Days, 1, 30);

        // Shift trialStartedAt forward so the countdown resets
        var baseDate = tenant.TrialStartedAt ?? DateTime.UtcNow.AddDays(-14);
        tenant.TrialStartedAt = baseDate.AddDays(days);

        // Restore suspended stores back to trial
        if (tenant.SubscriptionStatus == "SUSPENDED")
            tenant.SubscriptionStatus = "TRIAL";

        tenant.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        return Ok(new
        {
            id = tenant.Id,
            name = tenant.Name,
            subscriptionStatus = tenant.SubscriptionStatus,
            trialStartedAt = tenant.TrialStartedAt,
            daysRemaining = (int)Math.Max(0, 14 - (DateTime.UtcNow - tenant.TrialStartedAt!.Value).TotalDays)
        });
    }

    private static SubscriptionPlanDto ToDto(SubscriptionPlan p) => new(
        p.Id, p.Name, p.Price, p.MaxMenuItems, p.MaxDrivers,
        p.MaxPromotions, p.MaxDeliveryRadiusKm,
        p.HasAnalytics, p.HasCustomBranding, p.HasInventoryExport,
        p.CommissionPercent, p.Features,
        p.HasPromoAi, p.HasDriverIntel, p.HasReviewAi, p.HasApiAccess, p.CopilotMonthlyQuota,
        p.CreatedAt
    );
}
