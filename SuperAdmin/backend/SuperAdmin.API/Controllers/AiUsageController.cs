using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SuperAdmin.API.Data;

namespace SuperAdmin.API.Controllers;

// Per-tenant AI cost visibility over the shared tenant_ai_usage metering table (margin protection).
[ApiController]
[Route("api/ai-usage")]
[Authorize(Roles = "SUPERADMIN")]
public class AiUsageController(AppDbContext db) : ControllerBase
{
    // Per-tenant AI usage, aggregated across features. Optional ?month=YYYY-MM (default: all months).
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? month)
    {
        var q = db.TenantAiUsages.AsQueryable();
        if (!string.IsNullOrWhiteSpace(month)) q = q.Where(u => u.YearMonth == month);

        var grouped = await q.GroupBy(u => u.TenantId)
            .Select(g => new
            {
                TenantId = g.Key,
                Calls = g.Sum(x => x.CallCount),
                Tokens = g.Sum(x => x.TokensUsed),
                Cost = g.Sum(x => x.EstimatedCostRand)
            })
            .ToListAsync();

        var ids = grouped.Select(x => x.TenantId).ToList();
        var names = await db.Tenants.Where(t => ids.Contains(t.Id))
            .Select(t => new { t.Id, t.Name }).ToListAsync();

        var tenants = grouped
            .Select(x => new
            {
                x.TenantId,
                name = names.FirstOrDefault(n => n.Id == x.TenantId)?.Name,
                x.Calls, x.Tokens, x.Cost
            })
            .OrderByDescending(x => x.Cost)
            .ToList();

        return Ok(new
        {
            month,
            platformTotalCost = grouped.Sum(x => x.Cost),
            platformTotalCalls = grouped.Sum(x => x.Calls),
            platformTotalTokens = grouped.Sum(x => x.Tokens),
            tenants
        });
    }

    // Distinct months present, for the filter dropdown (newest first).
    [HttpGet("months")]
    public async Task<IActionResult> Months()
    {
        var months = await db.TenantAiUsages.Select(u => u.YearMonth).Distinct()
            .OrderByDescending(m => m).ToListAsync();
        return Ok(months);
    }
}
