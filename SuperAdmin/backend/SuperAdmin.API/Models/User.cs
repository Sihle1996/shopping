using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SuperAdmin.API.Models;

[Table("users")]
public class User
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Column("email")]
    public string Email { get; set; } = string.Empty;

    [Column("password")]
    public string Password { get; set; } = string.Empty;

    [Column("role")]
    public string? Role { get; set; }

    [Column("driver_status")]
    public string? DriverStatus { get; set; }

    [Column("tenant_id")]
    public Guid? TenantId { get; set; }

    [Column("last_ping")]
    public DateTimeOffset? LastPing { get; set; }

    public Tenant? Tenant { get; set; }
}
