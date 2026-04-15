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
        var row = await db.Database.SqlQueryRaw<PlatformSettingsRow>(
            @"SELECT commission_rate_percent, support_email, default_trial_days, allow_self_registration, updated_at FROM platform_settings WHERE id = 1"
        ).FirstOrDefaultAsync();

        if (row == null) return NotFound(new { message = "Platform settings not found." });
        return Ok(row);
    }

    [HttpPut]
    public async Task<IActionResult> Update([FromBody] PlatformSettingsRow request)
    {
        if (request.CommissionRatePercent < 0 || request.CommissionRatePercent > 100)
            return BadRequest(new { message = "Commission rate must be between 0 and 100." });
        if (request.DefaultTrialDays < 1 || request.DefaultTrialDays > 365)
            return BadRequest(new { message = "Trial days must be between 1 and 365." });
        if (string.IsNullOrWhiteSpace(request.SupportEmail))
            return BadRequest(new { message = "Support email is required." });

        await db.Database.ExecuteSqlRawAsync(@"
            UPDATE platform_settings SET
                commission_rate_percent = {0},
                support_email = {1},
                default_trial_days = {2},
                allow_self_registration = {3},
                updated_at = NOW()
            WHERE id = 1",
            request.CommissionRatePercent,
            request.SupportEmail.Trim(),
            request.DefaultTrialDays,
            request.AllowSelfRegistration
        );

        return Ok(request);
    }
}

public record PlatformSettingsRow(
    decimal CommissionRatePercent,
    string SupportEmail,
    int DefaultTrialDays,
    bool AllowSelfRegistration,
    DateTime UpdatedAt
);
