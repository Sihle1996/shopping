using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SuperAdmin.API.Data;
using SuperAdmin.API.DTOs;

namespace SuperAdmin.API.Controllers;

[ApiController]
[Route("api/stores")]
[Authorize(Roles = "SUPERADMIN")]
public class StoresController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search,
        [FromQuery] string? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var query = db.Tenants.AsQueryable();

        if (!string.IsNullOrEmpty(search))
            query = query.Where(t => t.Name.Contains(search) || t.Slug.Contains(search) ||
                                     (t.Email != null && t.Email.Contains(search)));
        if (status == "active") query = query.Where(t => t.Active);
        if (status == "inactive") query = query.Where(t => !t.Active);

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

        var result = tenants.Select(t => new TenantDto(
            t.Id, t.Name, t.Slug, t.LogoUrl, t.PrimaryColor, t.Email, t.Phone, t.Address,
            t.DeliveryRadiusKm, t.DeliveryFeeBase, t.PlatformCommissionPercent,
            t.SubscriptionStatus, t.SubscriptionPlan, t.Active, t.CreatedAt,
            userCounts.FirstOrDefault(u => u.TenantId == t.Id)?.Count ?? 0,
            driverCounts.FirstOrDefault(d => d.TenantId == t.Id)?.Count ?? 0,
            orderData.FirstOrDefault(o => o.TenantId == t.Id)?.Count ?? 0,
            orderData.FirstOrDefault(o => o.TenantId == t.Id)?.Revenue ?? 0
        ));

        return Ok(new { data = result, total, page, pageSize, totalPages = (int)Math.Ceiling((double)total / pageSize) });
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateTenantRequest request)
    {
        var tenant = await db.Tenants.FindAsync(id);
        if (tenant == null) return NotFound();

        if (request.Name != null) tenant.Name = request.Name;
        if (request.SubscriptionStatus != null) tenant.SubscriptionStatus = request.SubscriptionStatus;
        if (request.SubscriptionPlan != null) tenant.SubscriptionPlan = request.SubscriptionPlan;
        if (request.Active.HasValue) tenant.Active = request.Active.Value;
        if (request.PlatformCommissionPercent.HasValue) tenant.PlatformCommissionPercent = request.PlatformCommissionPercent.Value;
        if (request.DeliveryRadiusKm.HasValue) tenant.DeliveryRadiusKm = request.DeliveryRadiusKm.Value;
        tenant.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();
        return Ok(tenant);
    }

    [HttpPatch("{id}/toggle-active")]
    public async Task<IActionResult> ToggleActive(Guid id)
    {
        var tenant = await db.Tenants.FindAsync(id);
        if (tenant == null) return NotFound();
        tenant.Active = !tenant.Active;
        tenant.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(new { active = tenant.Active });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var tenant = await db.Tenants.FindAsync(id);
        if (tenant == null) return NotFound();
        db.Tenants.Remove(tenant);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
