using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SuperAdmin.API.Models;

[Table("tenants")]
public class Tenant
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Column("name")]
    public string Name { get; set; } = string.Empty;

    [Column("slug")]
    public string Slug { get; set; } = string.Empty;

    [Column("logo_url")]
    public string? LogoUrl { get; set; }

    [Column("primary_color")]
    public string? PrimaryColor { get; set; }

    [Column("email")]
    public string? Email { get; set; }

    [Column("phone")]
    public string? Phone { get; set; }

    [Column("address")]
    public string? Address { get; set; }

    [Column("delivery_radius_km")]
    public int DeliveryRadiusKm { get; set; } = 10;

    [Column("delivery_fee_base")]
    public decimal DeliveryFeeBase { get; set; } = 0;

    [Column("platform_commission_percent")]
    public decimal PlatformCommissionPercent { get; set; } = 4;

    [Column("subscription_status")]
    public string SubscriptionStatus { get; set; } = "TRIAL";

    [Column("subscription_plan")]
    public string SubscriptionPlan { get; set; } = "BASIC";

    [Column("active")]
    public bool Active { get; set; } = true;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; }

    [Column("trial_started_at")]
    public DateTime? TrialStartedAt { get; set; }

    [Column("approval_status")]
    public string ApprovalStatus { get; set; } = "APPROVED";

    [Column("rejection_reason")]
    public string? RejectionReason { get; set; }

    [Column("submitted_for_review_at")]
    public DateTime? SubmittedForReviewAt { get; set; }

    [Column("approved_at")]
    public DateTime? ApprovedAt { get; set; }

    public ICollection<User> Users { get; set; } = new List<User>();
    public ICollection<StoreDocument> StoreDocuments { get; set; } = new List<StoreDocument>();
}
