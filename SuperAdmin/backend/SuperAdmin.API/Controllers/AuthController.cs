using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SuperAdmin.API.Data;
using SuperAdmin.API.DTOs;
using SuperAdmin.API.Models;
using SuperAdmin.API.Services;

namespace SuperAdmin.API.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(AuthService authService, AppDbContext db) : ControllerBase
{
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var result = await authService.LoginAsync(request);
        if (result == null)
            return Unauthorized(new { message = "Invalid credentials or insufficient permissions." });
        return Ok(result);
    }

    // One-time setup endpoint — creates SUPERADMIN if none exists
    [HttpPost("setup")]
    public async Task<IActionResult> Setup([FromBody] LoginRequest request)
    {
        var existing = await db.Users.AnyAsync(u => u.Role == "SUPERADMIN");
        if (existing)
            return BadRequest(new { message = "SUPERADMIN already exists." });

        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = request.Email,
            Password = BCrypt.Net.BCrypt.HashPassword(request.Password),
            Role = "SUPERADMIN"
        };

        db.Users.Add(user);
        await db.SaveChangesAsync();
        return Ok(new { message = "SUPERADMIN created.", email = user.Email });
    }
}
