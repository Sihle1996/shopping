using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SuperAdmin.API.Data;
using SuperAdmin.API.Services;

namespace SuperAdmin.API.Controllers;

[ApiController]
[Route("api/enrollment")]
[Authorize(Roles = "SUPERADMIN")]
public class EnrollmentController(AppDbContext db, ResendEmailService email, IHttpClientFactory httpFactory) : ControllerBase
{
    private static readonly string[] RequiredDocTypes = { "CIPC", "COA", "BANK_DETAILS" };

    [HttpGet("ping")]
    [AllowAnonymous]
    public IActionResult Ping() => Ok(new { status = "enrollment-controller-active", ts = DateTime.UtcNow });

    [HttpGet("pending")]
    public async Task<IActionResult> GetPending()
    {
        var pending = await db.Tenants
            .Where(t => t.ApprovalStatus == "PENDING_REVIEW")
            .Include(t => t.StoreDocuments)
            .OrderBy(t => t.SubmittedForReviewAt)
            .ToListAsync();

        var result = pending.Select(t => new
        {
            t.Id,
            t.Name,
            t.Slug,
            t.Email,
            t.Phone,
            t.Address,
            submittedAt = t.SubmittedForReviewAt,
            t.CipcNumber,
            t.BankName,
            t.BankAccountNumber,
            t.BankAccountType,
            t.BankBranchCode,
            documents = t.StoreDocuments.Select(d => new
            {
                d.Id,
                d.DocumentType,
                d.FileName,
                d.Status,
                d.ReviewNotes,
                d.UploadedAt,
                d.ReviewedAt
            })
        });

        return Ok(result);
    }

    [HttpPost("{tenantId}/approve")]
    public async Task<IActionResult> Approve(Guid tenantId)
    {
        var tenant = await db.Tenants.FindAsync(tenantId);
        if (tenant == null) return NotFound();

        // Gate: every REQUIRED document must be ACCEPTED before a store can be approved.
        var docs = await db.StoreDocuments.Where(d => d.TenantId == tenantId).ToListAsync();
        var outstanding = RequiredDocTypes
            .Where(rt => !docs.Any(d => d.DocumentType == rt && d.Status == "ACCEPTED"))
            .ToList();
        if (outstanding.Count > 0)
            return BadRequest(new { message = "Accept every required document first. Outstanding: " + string.Join(", ", outstanding) });

        tenant.ApprovalStatus = "APPROVED";
        tenant.Active = false;
        tenant.ApprovedAt = DateTime.UtcNow;
        tenant.RejectionReason = null;
        await db.SaveChangesAsync();

        await email.SendStoreApprovedAsync(tenant.Name, tenant.Email);
        return Ok(new { message = "Store approved" });
    }

    [HttpPost("{tenantId}/reject")]
    public async Task<IActionResult> Reject(Guid tenantId, [FromBody] RejectRequest request)
    {
        var tenant = await db.Tenants.FindAsync(tenantId);
        if (tenant == null) return NotFound();

        tenant.ApprovalStatus = "REJECTED";
        tenant.RejectionReason = request.Reason;
        await db.SaveChangesAsync();

        await email.SendStoreRejectedAsync(tenant.Name, tenant.Email, request.Reason);
        return Ok(new { message = "Store rejected" });
    }

    // Rejected (and not-yet-archived) stores — the frontend's "Rejected" tab. Same shape as
    // /pending plus the rejection reason. (Mirrors Spring's /api/superadmin/enrollment/rejected.)
    [HttpGet("rejected")]
    public async Task<IActionResult> GetRejected()
    {
        var rejected = await db.Tenants
            .Where(t => t.ApprovalStatus == "REJECTED" && !t.IsArchived)
            .Include(t => t.StoreDocuments)
            .OrderByDescending(t => t.SubmittedForReviewAt)
            .ToListAsync();

        var result = rejected.Select(t => new
        {
            t.Id,
            t.Name,
            t.Slug,
            t.Email,
            t.Phone,
            t.Address,
            submittedAt = t.SubmittedForReviewAt,
            t.CipcNumber,
            t.BankName,
            t.BankAccountNumber,
            t.BankAccountType,
            t.BankBranchCode,
            rejectionReason = t.RejectionReason,
            documents = t.StoreDocuments.Select(d => new
            {
                d.Id,
                d.DocumentType,
                d.FileName,
                d.Status,
                d.ReviewNotes,
                d.UploadedAt,
                d.ReviewedAt
            })
        });

        return Ok(result);
    }

    // Archive (soft-delete) a rejected store — the "archive" action on the Rejected tab. Only a
    // REJECTED store can be archived. Keeps the row + its data; just hides it from the queue and
    // the customer app. (Mirrors Spring's /api/superadmin/enrollment/{id}/archive.)
    [HttpPost("{tenantId}/archive")]
    public async Task<IActionResult> Archive(Guid tenantId)
    {
        var tenant = await db.Tenants.FindAsync(tenantId);
        if (tenant == null) return NotFound();
        if (tenant.ApprovalStatus != "REJECTED")
            return BadRequest(new { message = "Only rejected stores can be archived." });

        tenant.IsArchived = true;
        tenant.Active = false;
        await db.SaveChangesAsync();

        return Ok(new { message = "Store archived" });
    }

    // Per-document review — the super-admin accepts or rejects each uploaded document with optional
    // notes. Writes store_documents.status / review_notes / reviewed_at (previously never set). A store
    // can only be APPROVED once every required document is ACCEPTED (see Approve above).
    [HttpPost("document/{documentId}/review")]
    public async Task<IActionResult> ReviewDocument(Guid documentId, [FromBody] DocumentReviewRequest request)
    {
        var status = (request.Status ?? "").ToUpperInvariant();
        if (status != "ACCEPTED" && status != "REJECTED")
            return BadRequest(new { message = "Status must be ACCEPTED or REJECTED." });

        var doc = await db.StoreDocuments.FindAsync(documentId);
        if (doc == null) return NotFound(new { message = "Document not found" });

        var tenant = await db.Tenants.FindAsync(doc.TenantId);
        if (tenant == null) return NotFound();
        if (tenant.ApprovalStatus != "PENDING_REVIEW")
            return BadRequest(new { message = "This store is not pending review." });

        doc.Status = status;
        doc.ReviewNotes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();
        doc.ReviewedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        return Ok(new { message = "Document reviewed", doc.Id, doc.Status, doc.ReviewedAt });
    }

    // Audited document download — the ONLY way a super-admin can open a KYB document now. The raw
    // storage URL is no longer returned (it was a permanent, public, unlogged link to bank statements
    // and registration docs). Every open is written to audit_event (who, which document, which store)
    // and the bytes are proxied through this authenticated SUPERADMIN-only endpoint.
    [HttpGet("document/{documentId}/download")]
    public async Task<IActionResult> DownloadDocument(Guid documentId)
    {
        var doc = await db.StoreDocuments.FindAsync(documentId);
        if (doc == null) return NotFound(new { message = "Document not found" });
        if (string.IsNullOrWhiteSpace(doc.FileUrl)) return NotFound(new { message = "Document has no file" });

        var actorEmail = User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue("email") ?? "unknown";
        var actorRole = User.FindFirstValue(ClaimTypes.Role) ?? "SUPERADMIN";
        await db.Database.ExecuteSqlRawAsync(
            "INSERT INTO audit_event (id, action, actor_email, actor_role, created_at, entity_id, entity_type, source, summary, tenant_id) " +
            "VALUES (gen_random_uuid(), 'DOCUMENT_VIEWED', {0}, {1}, now(), {2}, 'STORE_DOCUMENT', 'SUPERADMIN', {3}, {4})",
            actorEmail, actorRole, doc.Id, $"Viewed {doc.DocumentType} ({doc.FileName})", doc.TenantId);

        HttpResponseMessage resp;
        try { resp = await httpFactory.CreateClient().GetAsync(doc.FileUrl); }
        catch { return StatusCode(502, new { message = "Could not retrieve the document from storage." }); }
        if (!resp.IsSuccessStatusCode) return StatusCode(502, new { message = "Could not retrieve the document from storage." });

        var bytes = await resp.Content.ReadAsByteArrayAsync();
        var contentType = resp.Content.Headers.ContentType?.ToString() ?? "application/octet-stream";
        return File(bytes, contentType, doc.FileName ?? "document");
    }

    public record RejectRequest(string Reason);

    public record DocumentReviewRequest(string Status, string? Notes);
}
