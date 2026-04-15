using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SuperAdmin.API.Data;

namespace SuperAdmin.API.Controllers;

[ApiController]
[Route("api/platform-settings")]
[Authorize(Roles = "SUPERADMIN")]
public class PlatformSettingsController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var settings = await db.PlatformSettings.FirstOrDefaultAsync(p => p.Id == 1);
        if (settings == null) return NotFound(new { message = "Platform settings not found." });
        return Ok(new
        {
            commissionRatePercent = settings.CommissionRatePercent,
            supportEmail          = settings.SupportEmail,
            defaultTrialDays      = settings.DefaultTrialDays,
            allowSelfRegistration = settings.AllowSelfRegistration,
            updatedAt             = settings.UpdatedAt
        });
    }

    [HttpPut]
    public async Task<IActionResult> Update([FromBody] PlatformSettingsRequest request)
    {
        if (request.CommissionRatePercent < 0 || request.CommissionRatePercent > 100)
            return BadRequest(new { message = "Commission rate must be between 0 and 100." });
        if (request.DefaultTrialDays < 1 || request.DefaultTrialDays > 365)
            return BadRequest(new { message = "Trial days must be between 1 and 365." });
        if (string.IsNullOrWhiteSpace(request.SupportEmail))
            return BadRequest(new { message = "Support email is required." });

        var settings = await db.PlatformSettings.FirstOrDefaultAsync(p => p.Id == 1);
        if (settings == null) return NotFound(new { message = "Platform settings not found." });

        settings.CommissionRatePercent = request.CommissionRatePercent;
        settings.SupportEmail          = request.SupportEmail.Trim();
        settings.DefaultTrialDays      = request.DefaultTrialDays;
        settings.AllowSelfRegistration = request.AllowSelfRegistration;
        settings.UpdatedAt             = DateTime.UtcNow;

        await db.SaveChangesAsync();

        return Ok(new
        {
            commissionRatePercent = settings.CommissionRatePercent,
            supportEmail          = settings.SupportEmail,
            defaultTrialDays      = settings.DefaultTrialDays,
            allowSelfRegistration = settings.AllowSelfRegistration,
            updatedAt             = settings.UpdatedAt
        });
    }
}

public record PlatformSettingsRequest(
    decimal CommissionRatePercent,
    string SupportEmail,
    int DefaultTrialDays,
    bool AllowSelfRegistration
);
