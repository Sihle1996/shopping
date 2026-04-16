using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SuperAdmin.API.Data;

namespace SuperAdmin.API.Controllers;

[ApiController]
[Route("api/enrollment")]
[Authorize(Roles = "SUPERADMIN")]
public class EnrollmentController(AppDbContext db) : ControllerBase
{
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
        tenant.Active = true;
        tenant.ApprovedAt = DateTime.UtcNow;
        tenant.RejectionReason = null;
        await db.SaveChangesAsync();

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

        return Ok(new { message = "Store rejected" });
    }

    public record RejectRequest(string Reason);
}
