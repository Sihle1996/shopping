using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SuperAdmin.API.Models;

[Table("promotions")]
public class Promotion
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Column("tenant_id")]
    public Guid? TenantId { get; set; }

    [Column("code")]
    public string? Code { get; set; }

    [Column("title")]
    public string Title { get; set; } = "";

    [Column("promo_type")]
    public string? PromoType { get; set; }

    [Column("discount_percent")]
    public decimal? DiscountPercent { get; set; }

    [Column("discount_amount")]
    public decimal? DiscountAmount { get; set; }

    [Column("active")]
    public bool Active { get; set; }

    [Column("featured")]
    public bool Featured { get; set; }

    [Column("start_at")]
    public DateTime StartAt { get; set; }

    [Column("end_at")]
    public DateTime EndAt { get; set; }

    [Column("max_redemptions")]
    public int? MaxRedemptions { get; set; }

    [Column("redemption_count")]
    public int RedemptionCount { get; set; }
}
