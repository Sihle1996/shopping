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
            t.EscalationReason, t.CreatedAt, t.EscalatedAt, t.ResolvedAt,
            t.PlatformNote, t.PlatformReviewedAt
        }));
    }

    // Tier-3: store -> CraveIt support requests (payouts, disputes, policy). The platform replies via the
    // platform-note endpoint below.
    [HttpGet("platform")]
    public async Task<IActionResult> GetPlatformRequests()
    {
        var tickets = await db.SupportTickets
            .Where(t => t.Audience == "PLATFORM")
            .Include(t => t.Tenant)
            .Include(t => t.User)
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync();
        return Ok(tickets.Select(t => new
        {
            t.Id,
            storeId = t.TenantId,
            store = t.Tenant != null ? t.Tenant.Name : null,
            requester = t.User != null ? t.User.Email : null,
            t.Subject, t.Message, t.Status, t.PlatformNote, t.PlatformReviewedAt, t.CreatedAt
        }));
    }

    // The platform's reply / note on a ticket — works for both an escalation and a store request. This is
    // what turns "the superadmin can see it" into "the superadmin can act on it".
    [HttpPost("{id}/platform-note")]
    public async Task<IActionResult> AddPlatformNote(Guid id, [FromBody] PlatformNoteRequest req)
    {
        var ticket = await db.SupportTickets.FindAsync(id);
        if (ticket == null) return NotFound();
        ticket.PlatformNote = string.IsNullOrWhiteSpace(req.Note) ? null : req.Note.Trim();
        ticket.PlatformReviewedAt = DateTime.UtcNow;
        if (req.Resolve) ticket.Status = "RESOLVED";
        await db.SaveChangesAsync();
        return Ok(new { message = "Saved" });
    }

    public record PlatformNoteRequest(string? Note, bool Resolve);

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
