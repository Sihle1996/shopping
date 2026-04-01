using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SuperAdmin.API.Models;

[Table("subscription_plans")]
public class SubscriptionPlan
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Column("name")]
    public string Name { get; set; } = string.Empty;

    [Column("price")]
    public decimal Price { get; set; }

    [Column("max_menu_items")]
    public int MaxMenuItems { get; set; }

    [Column("max_drivers")]
    public int MaxDrivers { get; set; }

    [Column("max_promotions")]
    public int MaxPromotions { get; set; }

    [Column("max_delivery_radius_km")]
    public int MaxDeliveryRadiusKm { get; set; }

    [Column("has_analytics")]
    public bool HasAnalytics { get; set; }

    [Column("has_custom_branding")]
    public bool HasCustomBranding { get; set; }

    [Column("has_inventory_export")]
    public bool HasInventoryExport { get; set; }

    [Column("commission_percent")]
    public decimal CommissionPercent { get; set; }

    [Column("features")]
    public string? Features { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }
}
