using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SuperAdmin.API.Data;
using SuperAdmin.API.DTOs;

namespace SuperAdmin.API.Controllers;

[ApiController]
[Route("api/users")]
[Authorize(Roles = "SUPERADMIN")]
public class UsersController(AppDbContext db) : ControllerBase
{
    // Must match Spring's Role enum exactly — it's @Enumerated(STRING), so any other value
    // (e.g. the old "MANAGER") makes every Spring read of that user throw on deserialization.
    private static readonly HashSet<string> ValidRoles = ["USER", "ADMIN", "DRIVER", "SUPERADMIN"];

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

    // Removing a user ANONYMIZES + deactivates them (GDPR-style), never a hard delete. A customer's
    // orders / reviews / financial history must stay valid, and every user_id table has an FK so a
    // hard delete is blocked anyway. The row is kept (orders stay linked) but its PII is scrubbed,
    // the email is freed for re-registration, and login is blocked.
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var user = await db.Users.FindAsync(id);
        if (user == null) return NotFound();

        if (user.Role == "SUPERADMIN")
        {
            var count = await db.Users.CountAsync(u => u.Role == "SUPERADMIN");
            if (count <= 1) return BadRequest(new { message = "Cannot remove the last SUPERADMIN." });
        }

        var anonEmail = $"deleted-{id}@removed.invalid";
        await db.Database.ExecuteSqlRawAsync(@"
            UPDATE _user SET
                email = {0},
                full_name = 'Deleted user',
                phone = NULL,
                password = '',
                active = false,
                email_verified = false,
                email_verification_token = NULL,
                marketing_email_opt_in = false
            WHERE id = {1}", anonEmail, id);

        return Ok(new { anonymized = true, message = "User anonymized and deactivated. Their orders are retained; the email is freed for re-registration." });
    }
}
