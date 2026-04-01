using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using SuperAdmin.API.Data;
using SuperAdmin.API.DTOs;

namespace SuperAdmin.API.Controllers;

[ApiController]
[Route("api/users")]
[Authorize(Roles = "SUPERADMIN")]
public class UsersController(AppDbContext db) : ControllerBase
{
    private static readonly HashSet<string> ValidRoles = ["USER", "ADMIN", "MANAGER", "SUPERADMIN"];

    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search,
        [FromQuery] string? role,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = db.Users.Where(u => u.Role != "DRIVER").AsQueryable();

        if (!string.IsNullOrEmpty(search))
            query = query.Where(u => u.Email.ToLower().Contains(search.ToLower()));
        if (!string.IsNullOrEmpty(role))
            query = query.Where(u => u.Role == role.ToUpper());

        var total = await query.CountAsync();
        var users = await query.OrderBy(u => u.Email).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

        var tenantIds = users.Where(u => u.TenantId.HasValue).Select(u => u.TenantId!.Value).Distinct().ToList();
        var tenants = await db.Tenants.Where(t => tenantIds.Contains(t.Id)).ToDictionaryAsync(t => t.Id, t => t.Name);

        var result = users.Select(u => new UserDto(
            u.Id, u.Email, u.Role, u.DriverStatus, u.TenantId,
            u.TenantId.HasValue && tenants.TryGetValue(u.TenantId.Value, out var n) ? n : null,
            u.LastPing
        ));

        return Ok(new { data = result, total, page, pageSize, totalPages = (int)Math.Ceiling((double)total / pageSize) });
    }

    [HttpPatch("{id}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateUserRequest request)
    {
        var user = await db.Users.FindAsync(id);
        if (user == null) return NotFound();

        if (request.Role != null)
        {
            if (!ValidRoles.Contains(request.Role.ToUpper()))
                return BadRequest(new { message = $"Invalid role. Valid values: {string.Join(", ", ValidRoles)}" });
            user.Role = request.Role.ToUpper();
        }

        if (request.DriverStatus != null) user.DriverStatus = request.DriverStatus;

        await db.SaveChangesAsync();
        return Ok(new UserDto(user.Id, user.Email, user.Role, user.DriverStatus, user.TenantId, null, user.LastPing));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var user = await db.Users.FindAsync(id);
        if (user == null) return NotFound();

        if (user.Role == "SUPERADMIN")
        {
            var count = await db.Users.CountAsync(u => u.Role == "SUPERADMIN");
            if (count <= 1) return BadRequest(new { message = "Cannot delete the last SUPERADMIN." });
        }

        db.Users.Remove(user);
        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException pg && pg.SqlState == "23503")
        {
            return BadRequest(new { message = "Cannot delete this user — they have associated orders. Remove their orders first." });
        }
        return NoContent();
    }
}
