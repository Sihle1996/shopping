using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SuperAdmin.API.Models;

[Table("orders")]
public class Order
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Column("tenant_id")]
    public Guid? TenantId { get; set; }

    [Column("status")]
    public string Status { get; set; } = "";

    [Column("total_amount")]
    public double TotalAmount { get; set; }

    [Column("order_date")]
    public DateTime OrderDate { get; set; }
}
