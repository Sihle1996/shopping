using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SuperAdmin.API.Data;
using System.Security.Claims;

namespace SuperAdmin.API.Controllers;

// Reviews moderation: list customer reviews across stores and remove abusive ones. Deletes are
// recorded in audit_event so they surface in the Audit Log.
[ApiController]
[Route("api/reviews")]
[Authorize(Roles = "SUPERADMIN")]
public class ReviewsController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] int days = 365,
        [FromQuery] int? maxRating = null,
        [FromQuery] string? search = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        days = Math.Clamp(days, 1, 3650);
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);
        // reviews.created_at is `timestamp without time zone` — use an Unspecified-kind bound.
        var since = DateTime.SpecifyKind(DateTime.UtcNow.AddDays(-days), DateTimeKind.Unspecified);

        var q = db.Reviews.Where(r => r.CreatedAt >= since);
        if (maxRating.HasValue) q = q.Where(r => r.Rating <= maxRating.Value);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.ToLower();
            q = q.Where(r => r.Comment != null && r.Comment.ToLower().Contains(s));
        }

        var total = await q.CountAsync();
        var rows = await (from r in q
                          join t in db.Tenants on r.TenantId equals t.Id into tj
                          from t in tj.DefaultIfEmpty()
                          join u in db.Users on r.UserId equals u.Id into uj
                          from u in uj.DefaultIfEmpty()
                          orderby r.CreatedAt descending
                          select new { r.Id, r.Rating, r.Comment, r.CreatedAt, r.TenantId,
                                       storeName = t == null ? null : t.Name,
                                       reviewer = u == null ? null : u.Email })
                         .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

        return Ok(new { data = rows, total, page, pageSize, totalPages = (int)Math.Ceiling((double)total / pageSize) });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var r = await db.Reviews.FindAsync(id);
        if (r == null) return NotFound();
        var tenantId = r.TenantId;
        db.Reviews.Remove(r);
        await db.SaveChangesAsync();

        var actor = User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue("email") ?? "superadmin";
        await db.Database.ExecuteSqlRawAsync(
            "INSERT INTO audit_event (id, action, actor_email, actor_role, created_at, entity_id, entity_type, source, summary, tenant_id) " +
            "VALUES (gen_random_uuid(), 'REVIEW_DELETED', {0}, 'SUPERADMIN', now(), {1}, 'REVIEW', 'SUPERADMIN', {2}, {3})",
            actor, id, "Review removed by platform admin", (object?)tenantId ?? DBNull.Value);
        return NoContent();
    }
}
