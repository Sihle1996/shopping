using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SuperAdmin.API.Models;

// One message in a support ticket's thread (shared support_messages table, owned by Spring).
[Table("support_messages")]
public class SupportMessage
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Column("ticket_id")]
    public Guid? TicketId { get; set; }

    [Column("sender_role")]
    public string SenderRole { get; set; } = "";

    [Column("sender_email")]
    public string? SenderEmail { get; set; }

    [Column("body")]
    public string Body { get; set; } = "";

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }
}
