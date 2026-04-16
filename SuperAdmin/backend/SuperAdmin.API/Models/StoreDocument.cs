using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SuperAdmin.API.Models;

[Table("store_documents")]
public class StoreDocument
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Column("tenant_id")]
    public Guid TenantId { get; set; }

    [Column("document_type")]
    public string DocumentType { get; set; } = string.Empty;

    [Column("file_url")]
    public string FileUrl { get; set; } = string.Empty;

    [Column("file_name")]
    public string? FileName { get; set; }

    [Column("status")]
    public string Status { get; set; } = "PENDING";

    [Column("review_notes")]
    public string? ReviewNotes { get; set; }

    [Column("uploaded_at")]
    public DateTime? UploadedAt { get; set; }

    [Column("reviewed_at")]
    public DateTime? ReviewedAt { get; set; }

    [ForeignKey("TenantId")]
    public Tenant? Tenant { get; set; }
}
