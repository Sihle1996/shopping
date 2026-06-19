using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SuperAdmin.API.Data;
using SuperAdmin.API.Models;

namespace SuperAdmin.API.Controllers;

// Store payouts. Reads/writes the shared `payouts` table directly via EF — the same pattern every
// other SuperAdmin controller uses (Stores/Users/Orders), rather than proxying to Spring. Mirrors the
// validation Spring's PayoutController enforces so both backends produce consistent rows.
[ApiController]
[Route("api/payouts")]
[Authorize(Roles = "SUPERADMIN")]
public class PayoutsController(AppDbContext db) : ControllerBase
{
    private static readonly HashSet<string> ValidStatuses = new() { "PENDING", "PAID", "ON_HOLD" };

    // All payouts (newest first), each with the store name (matches the frontend's p.tenant?.name).
    [HttpGet]
    public async Task<IActionResult> List()
    {
        var rows = await (from p in db.Payouts
                          join t in db.Tenants on p.TenantId equals t.Id into tj
                          from t in tj.DefaultIfEmpty()
                          orderby p.CreatedAt descending
                          select new
                          {
                              p.Id, p.PeriodStart, p.PeriodEnd, p.GrossRevenue, p.PlatformFeePercent,
                              p.PlatformFee, p.NetAmount, p.Status, p.CreatedAt, p.PaidAt, p.Reference, p.Notes,
                              tenant = t == null ? null : new { t.Id, t.Name }
                          }).ToListAsync();
        return Ok(rows);
    }

    // Store list for the create-payout dropdown.
    [HttpGet("tenants")]
    public async Task<IActionResult> Tenants()
    {
        var rows = await db.Tenants.OrderBy(t => t.Name)
            .Select(t => new { t.Id, t.Name }).ToListAsync();
        return Ok(rows);
    }

    public record CreatePayoutRequest(
        Guid? TenantId, DateTime? PeriodStart, DateTime? PeriodEnd,
        double GrossRevenue, double PlatformFeePercent, double PlatformFee, double NetAmount, string? Notes);

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreatePayoutRequest req)
    {
        if (req.TenantId == null) return BadRequest(new { message = "Store is required." });
        if (req.GrossRevenue < 0 || req.PlatformFee < 0 || req.NetAmount < 0)
            return BadRequest(new { message = "Amounts must be non-negative." });
        if (Math.Abs(req.NetAmount - (req.GrossRevenue - req.PlatformFee)) > 0.01)
            return BadRequest(new { message = "Net amount must equal gross revenue minus the platform fee." });
        var tenant = await db.Tenants.FindAsync(req.TenantId.Value);
        if (tenant == null) return NotFound(new { message = "Store not found." });

        var p = new Payout
        {
            Id = Guid.NewGuid(),
            TenantId = req.TenantId,
            PeriodStart = req.PeriodStart?.ToUniversalTime(),
            PeriodEnd = req.PeriodEnd?.ToUniversalTime(),
            GrossRevenue = req.GrossRevenue,
            PlatformFeePercent = req.PlatformFeePercent,
            PlatformFee = req.PlatformFee,
            NetAmount = req.NetAmount,
            Status = "PENDING",
            CreatedAt = DateTime.UtcNow,
            Notes = req.Notes
        };
        db.Payouts.Add(p);
        await db.SaveChangesAsync();
        return Ok(new { p.Id, p.Status });
    }

    public record UpdatePayoutRequest(string? Status, string? Reference, string? Notes);

    [HttpPatch("{id}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdatePayoutRequest req)
    {
        if (req.Status != null && !ValidStatuses.Contains(req.Status))
            return BadRequest(new { message = "Invalid status." });
        var p = await db.Payouts.FindAsync(id);
        if (p == null) return NotFound();
        if (req.Status != null)
        {
            p.Status = req.Status;
            if (req.Status == "PAID") p.PaidAt = DateTime.UtcNow;
        }
        if (req.Reference != null) p.Reference = req.Reference;
        if (req.Notes != null) p.Notes = req.Notes;
        await db.SaveChangesAsync();
        return Ok(new { p.Id, p.Status, p.PaidAt, p.Reference });
    }
}
