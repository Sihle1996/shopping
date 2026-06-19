using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SuperAdmin.API.Models;

// Read-only view of the shared `payout_ledger` table. entry_type is CREDIT | FEE | DEBIT; DEBIT
// entries are store refunds (an order credited then cancelled/refunded).
[Table("payout_ledger")]
public class LedgerEntry
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Column("tenant_id")]
    public Guid TenantId { get; set; }

    [Column("order_id")]
    public Guid? OrderId { get; set; }

    [Column("entry_type")]
    public string EntryType { get; set; } = "";

    [Column("amount_rand")]
    public decimal AmountRand { get; set; }

    [Column("balance_after")]
    public decimal BalanceAfter { get; set; }

    [Column("description")]
    public string? Description { get; set; }

    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }
}
