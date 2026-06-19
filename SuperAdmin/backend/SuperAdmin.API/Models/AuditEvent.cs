using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SuperAdmin.API.Models;

// Read-only view of the shared `audit_event` table (written by both Spring and .NET).
[Table("audit_event")]
public class AuditEvent
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Column("action")]
    public string Action { get; set; } = "";

    [Column("actor_email")]
    public string? ActorEmail { get; set; }

    [Column("actor_role")]
    public string? ActorRole { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    [Column("entity_id")]
    public Guid? EntityId { get; set; }

    [Column("entity_type")]
    public string? EntityType { get; set; }

    [Column("source")]
    public string Source { get; set; } = "";

    [Column("summary")]
    public string? Summary { get; set; }

    [Column("tenant_id")]
    public Guid? TenantId { get; set; }
}
