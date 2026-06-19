using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SuperAdmin.API.Data;

namespace SuperAdmin.API.Controllers;

// Refunds oversight: the DEBIT entries in the shared payout_ledger are store refunds (an order that
// was credited then cancelled/refunded). Read-only, period-scoped, with store names.
[ApiController]
[Route("api/refunds")]
[Authorize(Roles = "SUPERADMIN")]
public class RefundsController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] int days = 90,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        days = Math.Clamp(days, 1, 3650);
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);
        var since = DateTime.UtcNow.AddDays(-days);

        var q = db.LedgerEntries.Where(l => l.EntryType == "DEBIT" && l.CreatedAt >= since);
        var total = await q.CountAsync();
        var totalRefunded = await q.SumAsync(l => (decimal?)l.AmountRand) ?? 0m;

        var rows = await (from l in q
                          join t in db.Tenants on l.TenantId equals t.Id into tj
                          from t in tj.DefaultIfEmpty()
                          orderby l.CreatedAt descending
                          select new { l.Id, l.AmountRand, l.Description, l.OrderId, l.CreatedAt,
                                       storeName = t == null ? null : t.Name })
                         .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

        return Ok(new { data = rows, total, totalRefunded, page, pageSize,
                        totalPages = (int)Math.Ceiling((double)total / pageSize) });
    }
}
