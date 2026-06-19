using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SuperAdmin.API.Data;

namespace SuperAdmin.API.Controllers;

// Read-only audit-trail viewer over the shared `audit_event` table. The data is already written by
// both backends (store-location changes, KYB document views, role changes, payouts, …) — this just
// surfaces it for compliance/forensics.
[ApiController]
[Route("api/audit")]
[Authorize(Roles = "SUPERADMIN")]
public class AuditController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] string? search,
        [FromQuery] string? action,
        [FromQuery] string? source,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);

        var q = db.AuditEvents.AsQueryable();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.ToLower();
            q = q.Where(a => (a.Summary != null && a.Summary.ToLower().Contains(s))
                          || (a.ActorEmail != null && a.ActorEmail.ToLower().Contains(s)));
        }
        if (!string.IsNullOrWhiteSpace(action)) q = q.Where(a => a.Action == action);
        if (!string.IsNullOrWhiteSpace(source)) q = q.Where(a => a.Source == source);

        var total = await q.CountAsync();
        var rows = await q
            .OrderByDescending(a => a.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(a => new { a.Id, a.Action, a.ActorEmail, a.ActorRole, a.CreatedAt,
                               a.EntityType, a.EntityId, a.Source, a.Summary, a.TenantId })
            .ToListAsync();

        return Ok(new { data = rows, total, page, pageSize, totalPages = (int)Math.Ceiling((double)total / pageSize) });
    }

    // Distinct action values, for the filter dropdown.
    [HttpGet("actions")]
    public async Task<IActionResult> Actions()
    {
        var actions = await db.AuditEvents.Select(a => a.Action).Distinct().OrderBy(a => a).ToListAsync();
        return Ok(actions);
    }
}
