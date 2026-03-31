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
        return Ok(plans.Select(p => new SubscriptionPlanDto(p.Id, p.Name, p.Price, p.MaxMenuItems, p.MaxDrivers, p.Features, p.CreatedAt)));
    }

    [HttpPost("plans")]
    public async Task<IActionResult> CreatePlan([FromBody] CreateUpdatePlanRequest request)
    {
        var plan = new SubscriptionPlan
        {
            Name = request.Name,
            Price = request.Price,
            MaxMenuItems = request.MaxMenuItems,
            MaxDrivers = request.MaxDrivers,
            Features = request.Features,
            CreatedAt = DateTime.UtcNow
        };
        db.SubscriptionPlans.Add(plan);
        await db.SaveChangesAsync();
        return Created("", new SubscriptionPlanDto(plan.Id, plan.Name, plan.Price, plan.MaxMenuItems, plan.MaxDrivers, plan.Features, plan.CreatedAt));
    }

    [HttpPut("plans/{id}")]
    public async Task<IActionResult> UpdatePlan(Guid id, [FromBody] CreateUpdatePlanRequest request)
    {
        var plan = await db.SubscriptionPlans.FindAsync(id);
        if (plan == null) return NotFound();
        plan.Name = request.Name;
        plan.Price = request.Price;
        plan.MaxMenuItems = request.MaxMenuItems;
        plan.MaxDrivers = request.MaxDrivers;
        plan.Features = request.Features;
        await db.SaveChangesAsync();
        return Ok(new SubscriptionPlanDto(plan.Id, plan.Name, plan.Price, plan.MaxMenuItems, plan.MaxDrivers, plan.Features, plan.CreatedAt));
    }

    [HttpDelete("plans/{id}")]
    public async Task<IActionResult> DeletePlan(Guid id)
    {
        var plan = await db.SubscriptionPlans.FindAsync(id);
        if (plan == null) return NotFound();
        db.SubscriptionPlans.Remove(plan);
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPatch("stores/{tenantId}/assign-plan")]
    public async Task<IActionResult> AssignPlan(Guid tenantId, [FromBody] AssignPlanRequest request)
    {
        var tenant = await db.Tenants.FindAsync(tenantId);
        if (tenant == null) return NotFound();
        tenant.SubscriptionPlan = request.PlanName;
        tenant.SubscriptionStatus = "ACTIVE";
        tenant.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(new { subscriptionPlan = tenant.SubscriptionPlan, subscriptionStatus = tenant.SubscriptionStatus });
    }
}
