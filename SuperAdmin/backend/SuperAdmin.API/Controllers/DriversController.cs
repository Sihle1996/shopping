using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SuperAdmin.API.Data;
using SuperAdmin.API.DTOs;

namespace SuperAdmin.API.Controllers;

[ApiController]
[Route("api/drivers")]
[Authorize(Roles = "SUPERADMIN")]
public class DriversController(AppDbContext db) : ControllerBase
{
    // Java DriverStatus enum only has AVAILABLE and UNAVAILABLE — SUSPENDED is not a valid DB value
    private static readonly HashSet<string> ValidDriverStatuses = ["AVAILABLE", "UNAVAILABLE"];

    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search,
        [FromQuery] string? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = db.Users.Where(u => u.Role == "DRIVER").AsQueryable();

        if (!string.IsNullOrEmpty(search))
            query = query.Where(u => u.Email.ToLower().Contains(search.ToLower()));
        if (!string.IsNullOrEmpty(status))
            query = query.Where(u => u.DriverStatus == status.ToUpper());

        var total = await query.CountAsync();
        var drivers = await query.OrderBy(u => u.Email).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

        var tenantIds = drivers.Where(u => u.TenantId.HasValue).Select(u => u.TenantId!.Value).Distinct().ToList();
        var tenants = await db.Tenants.Where(t => tenantIds.Contains(t.Id)).ToDictionaryAsync(t => t.Id, t => t.Name);

        var result = drivers.Select(u => new UserDto(
            u.Id, u.Email, u.Role, u.DriverStatus, u.TenantId,
            u.TenantId.HasValue && tenants.TryGetValue(u.TenantId.Value, out var n) ? n : null,
            u.LastPing
        ));

        return Ok(new { data = result, total, page, pageSize, totalPages = (int)Math.Ceiling((double)total / pageSize) });
    }

    [HttpPatch("{id}/status")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateUserRequest request)
    {
        var driver = await db.Users.FindAsync(id);
        if (driver == null || driver.Role != "DRIVER") return NotFound();

        if (request.DriverStatus != null)
        {
            if (!ValidDriverStatuses.Contains(request.DriverStatus.ToUpper()))
                return BadRequest(new { message = $"Invalid status. Valid values: {string.Join(", ", ValidDriverStatuses)}" });
            driver.DriverStatus = request.DriverStatus.ToUpper();
        }

        await db.SaveChangesAsync();
        return Ok(new { driverStatus = driver.DriverStatus });
    }
}
