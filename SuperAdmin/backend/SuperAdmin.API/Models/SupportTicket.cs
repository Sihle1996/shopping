using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SuperAdmin.API.Models;

// Shared support_tickets table (owned by the Spring app). The SuperAdmin only reads escalated tickets —
// customers escalate to CraveIt when a store mishandles them, giving the platform oversight.
[Table("support_tickets")]
public class SupportTicket
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Column("tenant_id")]
    public Guid? TenantId { get; set; }

    [Column("user_id")]
    public Guid? UserId { get; set; }

    [Column("order_id")]
    public Guid? OrderId { get; set; }

    [Column("subject")]
    public string Subject { get; set; } = string.Empty;

    [Column("message")]
    public string Message { get; set; } = string.Empty;

    [Column("status")]
    public string? Status { get; set; }

    [Column("admin_notes")]
    public string? AdminNotes { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    [Column("resolved_at")]
    public DateTime? ResolvedAt { get; set; }

    [Column("escalated")]
    public bool Escalated { get; set; }

    [Column("escalated_at")]
    public DateTime? EscalatedAt { get; set; }

    [Column("escalation_reason")]
    public string? EscalationReason { get; set; }

    // Tier-3 + superadmin reply: audience STORE (customer->store) | PLATFORM (store->CraveIt); platformNote
    // is the superadmin's response + when they acted.
    [Column("audience")]
    public string Audience { get; set; } = "STORE";

    [Column("platform_note")]
    public string? PlatformNote { get; set; }

    [Column("platform_reviewed_at")]
    public DateTime? PlatformReviewedAt { get; set; }

    public Tenant? Tenant { get; set; }
    public User? User { get; set; }
}
