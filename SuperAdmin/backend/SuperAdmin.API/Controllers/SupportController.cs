using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SuperAdmin.API.Data;

namespace SuperAdmin.API.Controllers;

[ApiController]
[Route("api/support")]
[Authorize(Roles = "SUPERADMIN")]
public class SupportController(AppDbContext db) : ControllerBase
{
    // Escalated tickets across all stores — the platform's oversight of customer↔store support. A customer
    // escalates when a store mishandles them, so the platform can step in before it becomes public criticism.
    [HttpGet("escalated")]
    public async Task<IActionResult> GetEscalated()
    {
        var tickets = await db.SupportTickets
            .Where(t => t.Escalated)
            .Include(t => t.Tenant)
            .Include(t => t.User)
            .OrderByDescending(t => t.EscalatedAt)
            .ToListAsync();
        return Ok(tickets.Select(t => new
        {
            t.Id,
            storeId = t.TenantId,
            store = t.Tenant != null ? t.Tenant.Name : null,
            customer = t.User != null ? t.User.Email : null,
            t.Subject, t.Message, t.Status, t.AdminNotes,
            t.EscalationReason, t.CreatedAt, t.EscalatedAt, t.ResolvedAt
        }));
    }

    // Per-store complaint signal — surfaces which stores generate the most support load / escalations, so a
    // pattern of mistreatment shows up instead of staying buried in one-off tickets.
    [HttpGet("store-signals")]
    public async Task<IActionResult> GetStoreSignals()
    {
        var tickets = await db.SupportTickets.Include(t => t.Tenant).ToListAsync();
        var signals = tickets
            .Where(t => t.TenantId != null)
            .GroupBy(t => new { t.TenantId, Store = t.Tenant != null ? t.Tenant.Name : null })
            .Select(g => new
            {
                storeId = g.Key.TenantId,
                store = g.Key.Store,
                total = g.Count(),
                open = g.Count(t => t.Status == "OPEN" || t.Status == "IN_PROGRESS"),
                escalated = g.Count(t => t.Escalated)
            })
            .Where(s => s.escalated > 0 || s.open > 0)
            .OrderByDescending(s => s.escalated).ThenByDescending(s => s.open)
            .ToList();
        return Ok(signals);
    }
}
