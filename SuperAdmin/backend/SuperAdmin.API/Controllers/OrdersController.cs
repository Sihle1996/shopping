using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SuperAdmin.API.Data;

namespace SuperAdmin.API.Controllers;

[ApiController]
[Route("api/orders")]
[Authorize(Roles = "SUPERADMIN")]
public class OrdersController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search,
        [FromQuery] string? status,
        [FromQuery] string? storeId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = db.Orders.AsQueryable();

        if (!string.IsNullOrEmpty(search))
        {
            var matchingTenantIds = await db.Tenants
                .Where(t => t.Name.ToLower().Contains(search.ToLower()))
                .Select(t => t.Id)
                .ToListAsync();
            query = query.Where(o => o.TenantId.HasValue && matchingTenantIds.Contains(o.TenantId.Value));
        }

        if (!string.IsNullOrEmpty(status))
            query = query.Where(o => o.Status == status);

        if (!string.IsNullOrEmpty(storeId) && Guid.TryParse(storeId, out var tenantGuid))
            query = query.Where(o => o.TenantId == tenantGuid);

        var total = await query.CountAsync();
        var orders = await query
            .OrderByDescending(o => o.OrderDate)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var tenantIds = orders.Where(o => o.TenantId.HasValue).Select(o => o.TenantId!.Value).Distinct().ToList();
        var tenants = await db.Tenants
            .Where(t => tenantIds.Contains(t.Id))
            .ToDictionaryAsync(t => t.Id, t => t.Name);

        var result = orders.Select(o => new
        {
            o.Id,
            o.Status,
            o.TotalAmount,
            orderDate = o.OrderDate,
            tenantId = o.TenantId,
            storeName = o.TenantId.HasValue && tenants.TryGetValue(o.TenantId.Value, out var n) ? n : "Unknown"
        });

        return Ok(new
        {
            data = result,
            total,
            page,
            pageSize,
            totalPages = (int)Math.Ceiling((double)total / pageSize)
        });
    }

    private static readonly HashSet<string> ValidStatuses =
        ["PENDING", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"];

    [HttpPatch("{id}/status")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateOrderStatusRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Status) || !ValidStatuses.Contains(request.Status.ToUpper()))
            return BadRequest(new { message = $"Invalid status. Valid values: {string.Join(", ", ValidStatuses)}" });

        var order = await db.Orders.FindAsync(id);
        if (order == null) return NotFound();

        order.Status = request.Status.ToUpper();
        await db.SaveChangesAsync();
        return Ok(new { id = order.Id, status = order.Status });
    }
}

public record UpdateOrderStatusRequest(string Status);
