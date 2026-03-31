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
}
