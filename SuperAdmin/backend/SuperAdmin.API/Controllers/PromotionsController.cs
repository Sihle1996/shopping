using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SuperAdmin.API.Data;
using System.Security.Claims;

namespace SuperAdmin.API.Controllers;

// Promotions oversight: view promos across all stores and deactivate abusive ones. The toggle writes
// audit_event (PROMO_TOGGLED) so it shows in the Audit Log.
[ApiController]
[Route("api/promotions")]
[Authorize(Roles = "SUPERADMIN")]
public class PromotionsController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] string? search,
        [FromQuery] bool? activeOnly,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);

        var q = db.Promotions.AsQueryable();
        if (activeOnly == true) q = q.Where(p => p.Active);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.ToLower();
            q = q.Where(p => (p.Code != null && p.Code.ToLower().Contains(s)) || p.Title.ToLower().Contains(s));
        }

        var total = await q.CountAsync();
        var rows = await (from p in q
                          join t in db.Tenants on p.TenantId equals t.Id into tj
                          from t in tj.DefaultIfEmpty()
                          orderby p.StartAt descending
                          select new { p.Id, p.Code, p.Title, p.PromoType, p.DiscountPercent, p.DiscountAmount,
                                       p.Active, p.Featured, p.StartAt, p.EndAt, p.MaxRedemptions, p.RedemptionCount,
                                       storeName = t == null ? null : t.Name })
                         .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

        return Ok(new { data = rows, total, page, pageSize, totalPages = (int)Math.Ceiling((double)total / pageSize) });
    }

    public record ToggleRequest(bool Active);

    [HttpPatch("{id}/active")]
    public async Task<IActionResult> SetActive(Guid id, [FromBody] ToggleRequest req)
    {
        var p = await db.Promotions.FindAsync(id);
        if (p == null) return NotFound();
        p.Active = req.Active;
        await db.SaveChangesAsync();

        var actor = User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue("email") ?? "superadmin";
        await db.Database.ExecuteSqlRawAsync(
            "INSERT INTO audit_event (id, action, actor_email, actor_role, created_at, entity_id, entity_type, source, summary, tenant_id) " +
            "VALUES (gen_random_uuid(), 'PROMO_TOGGLED', {0}, 'SUPERADMIN', now(), {1}, 'PROMOTION', 'SUPERADMIN', {2}, {3})",
            actor, id, (req.Active ? "Promo enabled" : "Promo disabled") + " by platform admin",
            (object?)p.TenantId ?? DBNull.Value);
        return Ok(new { p.Id, p.Active });
    }
}
