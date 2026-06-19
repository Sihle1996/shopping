using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SuperAdmin.API.Models;

// Maps the Spring-owned `payouts` table. status is stored as a string (Spring @Enumerated(STRING) +
// a DB CHECK constraint): PENDING | PAID | ON_HOLD — write exactly those values.
[Table("payouts")]
public class Payout
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Column("tenant_id")]
    public Guid? TenantId { get; set; }

    [Column("period_start")]
    public DateTime? PeriodStart { get; set; }

    [Column("period_end")]
    public DateTime? PeriodEnd { get; set; }

    [Column("gross_revenue")]
    public double GrossRevenue { get; set; }

    [Column("platform_fee_percent")]
    public double PlatformFeePercent { get; set; }

    [Column("platform_fee")]
    public double PlatformFee { get; set; }

    [Column("net_amount")]
    public double NetAmount { get; set; }

    [Column("status")]
    public string Status { get; set; } = "PENDING";

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    [Column("paid_at")]
    public DateTime? PaidAt { get; set; }

    [Column("reference")]
    public string? Reference { get; set; }

    [Column("notes")]
    public string? Notes { get; set; }
}
