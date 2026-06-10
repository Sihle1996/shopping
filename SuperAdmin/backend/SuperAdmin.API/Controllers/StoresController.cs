using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SuperAdmin.API.Data;
using SuperAdmin.API.DTOs;
using SuperAdmin.API.Models;

namespace SuperAdmin.API.Controllers;

[ApiController]
[Route("api/stores")]
[Authorize(Roles = "SUPERADMIN")]
public class StoresController(AppDbContext db) : ControllerBase
{
    private static readonly HashSet<string> ValidPlans = ["BASIC", "PRO", "ENTERPRISE"];
    private static readonly HashSet<string> ValidSubStatuses = ["TRIAL", "ACTIVE", "SUSPENDED"];

    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search,
        [FromQuery] string? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = db.Tenants.AsQueryable();

        if (!string.IsNullOrEmpty(search))
            query = query.Where(t => t.Name.ToLower().Contains(search.ToLower()) ||
                                     t.Slug.ToLower().Contains(search.ToLower()) ||
                                     (t.Email != null && t.Email.ToLower().Contains(search.ToLower())));
        var normalizedStatus = status?.ToLower();
        if (normalizedStatus == "active") query = query.Where(t => t.Active);
        if (normalizedStatus == "inactive") query = query.Where(t => !t.Active);

        var total = await query.CountAsync();
        var tenants = await query
            .OrderByDescending(t => t.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var tenantIds = tenants.Select(t => t.Id).ToList();

        var userCounts = await db.Users
            .Where(u => u.TenantId != null && tenantIds.Contains(u.TenantId.Value) && u.Role != "DRIVER")
            .GroupBy(u => u.TenantId)
            .Select(g => new { TenantId = g.Key, Count = g.Count() })
            .ToListAsync();

        var driverCounts = await db.Users
            .Where(u => u.TenantId != null && tenantIds.Contains(u.TenantId.Value) && u.Role == "DRIVER")
            .GroupBy(u => u.TenantId)
            .Select(g => new { TenantId = g.Key, Count = g.Count() })
            .ToListAsync();

        var orderData = await db.Orders
            .Where(o => o.TenantId != null && tenantIds.Contains(o.TenantId.Value))
            .GroupBy(o => o.TenantId)
            .Select(g => new { TenantId = g.Key, Count = g.Count(), Revenue = g.Sum(o => o.TotalAmount) })
            .ToListAsync();

        var now = DateTime.UtcNow;
        var result = tenants.Select(t =>
        {
            int? daysRemaining = null;
            if (t.SubscriptionStatus == "TRIAL" && t.TrialStartedAt.HasValue)
                daysRemaining = Math.Max(0, 14 - (int)(now - t.TrialStartedAt.Value).TotalDays);
            return new TenantDto(
                t.Id, t.Name, t.Slug, t.LogoUrl, t.PrimaryColor, t.Email, t.Phone, t.Address,
                t.DeliveryRadiusKm, t.DeliveryFeeBase, t.PlatformCommissionPercent,
                t.SubscriptionStatus, t.SubscriptionPlan, t.Active, t.IsArchived, t.CreatedAt,
                userCounts.FirstOrDefault(u => u.TenantId == t.Id)?.Count ?? 0,
                driverCounts.FirstOrDefault(d => d.TenantId == t.Id)?.Count ?? 0,
                orderData.FirstOrDefault(o => o.TenantId == t.Id)?.Count ?? 0,
                (double)(orderData.FirstOrDefault(o => o.TenantId == t.Id)?.Revenue ?? 0),
                t.TrialStartedAt,
                daysRemaining
            );
        });

        return Ok(new { data = result, total, page, pageSize, totalPages = (int)Math.Ceiling((double)total / pageSize) });
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateStoreRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Length > 200)
            return BadRequest(new { message = "Name must be 1–200 characters." });
        if (string.IsNullOrWhiteSpace(request.Slug))
            return BadRequest(new { message = "Slug is required." });

        var slug = request.Slug.Trim().ToLower().Replace(" ", "-");

        if (await db.Tenants.AnyAsync(t => t.Slug == slug))
            return Conflict(new { message = "A store with this slug already exists." });

        var plan   = ValidPlans.Contains(request.SubscriptionPlan?.ToUpper() ?? "") ? request.SubscriptionPlan!.ToUpper() : "BASIC";
        var status = ValidSubStatuses.Contains(request.SubscriptionStatus?.ToUpper() ?? "") ? request.SubscriptionStatus!.ToUpper() : "TRIAL";

        var tenant = new Tenant
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            Slug = slug,
            Email = request.Email?.Trim(),
            Phone = request.Phone?.Trim(),
            SubscriptionPlan = plan,
            SubscriptionStatus = status,
            Active = true,
            IsOpen = false,
            IsArchived = false,
            EstimatedDeliveryMinutes = 30,
            DeliveryRadiusKm = 10,
            ApprovalStatus = "APPROVED",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            TrialStartedAt = status == "TRIAL" ? DateTime.UtcNow : null
        };

        db.Tenants.Add(tenant);
        await db.SaveChangesAsync();

        int? trialDays = status == "TRIAL" ? 14 : null;
        return Created($"/api/stores/{tenant.Id}", new TenantDto(
            tenant.Id, tenant.Name, tenant.Slug, tenant.LogoUrl, tenant.PrimaryColor,
            tenant.Email, tenant.Phone, tenant.Address,
            tenant.DeliveryRadiusKm, tenant.DeliveryFeeBase, tenant.PlatformCommissionPercent,
            tenant.SubscriptionStatus, tenant.SubscriptionPlan, tenant.Active, tenant.IsArchived, tenant.CreatedAt,
            0, 0, 0, 0, tenant.TrialStartedAt, trialDays
        ));
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateTenantRequest request)
    {
        var tenant = await db.Tenants.FindAsync(id);
        if (tenant == null) return NotFound();

        if (request.Name != null)
        {
            if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Length > 200)
                return BadRequest(new { message = "Name must be 1–200 characters." });
            tenant.Name = request.Name.Trim();
        }

        if (request.SubscriptionStatus != null)
        {
            if (!ValidSubStatuses.Contains(request.SubscriptionStatus.ToUpper()))
                return BadRequest(new { message = $"Invalid subscription status. Valid values: {string.Join(", ", ValidSubStatuses)}" });
            tenant.SubscriptionStatus = request.SubscriptionStatus.ToUpper();
        }

        if (request.SubscriptionPlan != null)
        {
            var planName = request.SubscriptionPlan.ToUpper();
            var plan = await db.SubscriptionPlans.FirstOrDefaultAsync(p => p.Name == planName);
            if (plan == null)
                return BadRequest(new { message = $"Invalid plan. Valid values: {string.Join(", ", ValidPlans)}" });
            tenant.SubscriptionPlan = planName;
            tenant.PlatformCommissionPercent = plan.CommissionPercent;   // sync commission to the plan's rate
        }

        // A store can only be activated once APPROVED — never go live unapproved (review gate).
        // Deactivating is always allowed.
        if (request.Active.HasValue)
        {
            if (request.Active.Value && tenant.ApprovalStatus != "APPROVED")
                return BadRequest(new { message = "Only an approved store can be activated." });
            tenant.Active = request.Active.Value;
        }

        // An explicit commission (e.g. a negotiated rate) overrides the plan default set above.
        if (request.PlatformCommissionPercent.HasValue)
        {
            if (request.PlatformCommissionPercent.Value < 0 || request.PlatformCommissionPercent.Value > 100)
                return BadRequest(new { message = "Commission must be between 0 and 100." });
            tenant.PlatformCommissionPercent = request.PlatformCommissionPercent.Value;
        }

        if (request.DeliveryRadiusKm.HasValue)
        {
            if (request.DeliveryRadiusKm.Value < 0 || request.DeliveryRadiusKm.Value > 500)
                return BadRequest(new { message = "Delivery radius must be between 0 and 500 km." });
            tenant.DeliveryRadiusKm = request.DeliveryRadiusKm.Value;
        }

        tenant.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(tenant);
    }

    [HttpPatch("{id}/toggle-active")]
    public async Task<IActionResult> ToggleActive(Guid id)
    {
        var tenant = await db.Tenants.FindAsync(id);
        if (tenant == null) return NotFound();
        // Can't activate an unapproved store (review gate). A REJECTED+archived store therefore can't be
        // toggled live — it must be re-reviewed. Deactivating is always allowed.
        if (!tenant.Active && tenant.ApprovalStatus != "APPROVED")
            return BadRequest(new { message = "Only an approved store can be activated." });
        tenant.Active = !tenant.Active;
        if (tenant.Active) tenant.IsArchived = false;   // re-activating restores an archived store
        tenant.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(new { active = tenant.Active, archived = tenant.IsArchived });
    }

    // Removing a store ARCHIVES it (soft-delete) — never a hard delete. A merchant's order /
    // financial / review history must be retained (accounting, disputes, payouts), and a hard delete
    // would also orphan rows in tables with no tenant FK. Blocked while orders are in-flight.
    private static readonly string[] TerminalOrderStatuses = { "Delivered", "Cancelled", "Rejected" };

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var tenant = await db.Tenants.FindAsync(id);
        if (tenant == null) return NotFound();

        int inFlight = await db.Orders.CountAsync(o => o.TenantId == id && !TerminalOrderStatuses.Contains(o.Status));
        if (inFlight > 0)
            return Conflict(new { message =
                $"Cannot remove this store — {inFlight} order(s) are still in progress. " +
                "Deactivate it to stop new orders, then remove once they're delivered or cancelled." });

        tenant.IsArchived = true;
        tenant.Active = false;
        tenant.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(new { archived = true, message = "Store archived — its history is retained and it can be restored." });
    }
}
