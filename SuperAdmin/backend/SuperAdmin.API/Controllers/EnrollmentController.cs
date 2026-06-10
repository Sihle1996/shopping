using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SuperAdmin.API.Data;
using SuperAdmin.API.Services;

namespace SuperAdmin.API.Controllers;

[ApiController]
[Route("api/enrollment")]
[Authorize(Roles = "SUPERADMIN")]
public class EnrollmentController(AppDbContext db, ResendEmailService email) : ControllerBase
{
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
                d.FileUrl,
                d.FileName,
                d.Status,
                d.ReviewNotes,
                d.UploadedAt
            })
        });

        return Ok(result);
    }

    [HttpPost("{tenantId}/approve")]
    public async Task<IActionResult> Approve(Guid tenantId)
    {
        var tenant = await db.Tenants.FindAsync(tenantId);
        if (tenant == null) return NotFound();

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
                d.FileUrl,
                d.FileName,
                d.Status,
                d.ReviewNotes,
                d.UploadedAt
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

    public record RejectRequest(string Reason);
}
