using System.ComponentModel.DataAnnotations.Schema;

namespace SuperAdmin.API.Models;

[Table("platform_settings")]
public class PlatformSettings
{
    [Column("id")]
    public int Id { get; set; }

    [Column("commission_rate_percent")]
    public decimal CommissionRatePercent { get; set; }

    [Column("support_email")]
    public string SupportEmail { get; set; } = string.Empty;

    [Column("default_trial_days")]
    public int DefaultTrialDays { get; set; }

    [Column("allow_self_registration")]
    public bool AllowSelfRegistration { get; set; }

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; }
}
