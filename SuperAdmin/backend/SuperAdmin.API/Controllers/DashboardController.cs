using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SuperAdmin.API.Data;
using SuperAdmin.API.DTOs;

namespace SuperAdmin.API.Controllers;

[ApiController]
[Route("api/dashboard")]
[Authorize(Roles = "SUPERADMIN")]
public class DashboardController(AppDbContext db) : ControllerBase
{
    [HttpGet("stats")]
    public async Task<IActionResult> GetStats()
    {
        var totalStores = await db.Tenants.CountAsync();
        var activeStores = await db.Tenants.CountAsync(t => t.Active);
        var totalUsers = await db.Users.CountAsync(u => u.Role == "USER");
        var totalDrivers = await db.Users.CountAsync(u => u.Role == "DRIVER");
        var totalOrders = await db.Orders.CountAsync();
        var totalRevenue = await db.Orders
            .Where(o => o.Status == "Delivered")
            .SumAsync(o => (double?)o.TotalAmount) ?? 0;
        var pendingOrders = await db.Orders.CountAsync(o => o.Status == "Pending");

        return Ok(new StatsDto(totalStores, activeStores, totalUsers, totalDrivers, totalOrders, totalRevenue, pendingOrders));
    }

    [HttpGet("orders-by-status")]
    public async Task<IActionResult> GetOrdersByStatus()
    {
        var result = await db.Orders
            .GroupBy(o => o.Status)
            .Select(g => new { status = g.Key, count = g.Count() })
            .ToListAsync();
        return Ok(result);
    }

    [HttpGet("orders-over-time")]
    public async Task<IActionResult> GetOrdersOverTime([FromQuery] int days = 30)
    {
        var from = DateTime.UtcNow.AddDays(-days).Date;
        var result = await db.Orders
            .Where(o => o.CreatedAt >= from)
            .GroupBy(o => o.CreatedAt.Date)
            .Select(g => new { date = g.Key, count = g.Count(), revenue = g.Sum(o => o.TotalAmount) })
            .OrderBy(x => x.date)
            .ToListAsync();
        return Ok(result);
    }

    [HttpGet("top-stores")]
    public async Task<IActionResult> GetTopStores([FromQuery] int limit = 5)
    {
        var orderData = await db.Orders
            .Where(o => o.TenantId != null)
            .GroupBy(o => o.TenantId)
            .Select(g => new { TenantId = g.Key, Orders = g.Count(), Revenue = g.Sum(o => o.TotalAmount) })
            .OrderByDescending(x => x.Revenue)
            .Take(limit)
            .ToListAsync();

        var tenantIds = orderData.Select(o => o.TenantId!.Value).ToList();
        var tenants = await db.Tenants
            .Where(t => tenantIds.Contains(t.Id))
            .ToDictionaryAsync(t => t.Id, t => t.Name);

        var result = orderData.Select(o => new
        {
            name = tenants.TryGetValue(o.TenantId!.Value, out var n) ? n : "Unknown",
            orders = o.Orders,
            revenue = o.Revenue
        });

        return Ok(result);
    }

    [HttpGet("stores-by-plan")]
    public async Task<IActionResult> GetStoresByPlan()
    {
        var result = await db.Tenants
            .GroupBy(t => t.SubscriptionPlan)
            .Select(g => new { plan = g.Key ?? "None", count = g.Count() })
            .ToListAsync();
        return Ok(result);
    }
}
