using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SuperAdmin.API.Models;

// Read-only view of the shared `tenant_ai_usage` table — per (tenant, month, feature) AI metering
// (call count, tokens, estimated Rand cost) written by the Spring backend for margin protection.
[Table("tenant_ai_usage")]
public class TenantAiUsage
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Column("tenant_id")]
    public Guid TenantId { get; set; }

    [Column("year_month")]
    public string YearMonth { get; set; } = "";

    [Column("feature")]
    public string Feature { get; set; } = "";

    [Column("call_count")]
    public long CallCount { get; set; }

    [Column("tokens_used")]
    public long TokensUsed { get; set; }

    [Column("estimated_cost_rand")]
    public double EstimatedCostRand { get; set; }

    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }
}
