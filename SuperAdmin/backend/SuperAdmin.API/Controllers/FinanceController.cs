using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SuperAdmin.API.Data;

namespace SuperAdmin.API.Controllers;

// Platform financial reporting / reconciliation (read-only) over the shared DB:
//   - GMV + platform commission + delivery revenue from delivered orders (period-scoped)
//   - subscription MRR from active subscriptions
//   - payout liability (PENDING) vs paid (PAID)
[ApiController]
[Route("api/finance")]
[Authorize(Roles = "SUPERADMIN")]
public class FinanceController(AppDbContext db) : ControllerBase
{
    [HttpGet("summary")]
    public async Task<IActionResult> Summary([FromQuery] int days = 30)
    {
        days = Math.Clamp(days, 1, 3650);
        var since = DateTime.UtcNow.AddDays(-days);

        var delivered = db.Orders.Where(o => o.Status == "Delivered" && o.OrderDate >= since);
        var gmv = await delivered.SumAsync(o => (double?)o.TotalAmount) ?? 0;
        var commission = await delivered.SumAsync(o => o.PlatformFee) ?? 0;
        var deliveryRevenue = await delivered.SumAsync(o => o.DeliveryFee) ?? 0;
        var orderCount = await delivered.CountAsync();

        // Current monthly recurring revenue = sum of the active subscriptions' plan prices.
        var mrr = await (from t in db.Tenants
                         where t.SubscriptionStatus == "ACTIVE"
                         join p in db.SubscriptionPlans on t.SubscriptionPlan equals p.Name
                         select p.Price).SumAsync();
        var activeSubscriptions = await db.Tenants.CountAsync(t => t.SubscriptionStatus == "ACTIVE");
        var trialSubscriptions = await db.Tenants.CountAsync(t => t.SubscriptionStatus == "TRIAL");

        var payoutPending = await db.Payouts.Where(p => p.Status == "PENDING").SumAsync(p => (double?)p.NetAmount) ?? 0;
        var payoutPaid = await db.Payouts.Where(p => p.Status == "PAID").SumAsync(p => (double?)p.NetAmount) ?? 0;

        return Ok(new
        {
            days,
            gmv,
            commissionRevenue = commission,
            deliveryRevenue,
            orderCount,
            subscriptionMrr = mrr,
            activeSubscriptions,
            trialSubscriptions,
            payoutPending,
            payoutPaid
        });
    }

    // Last-6-months trend of GMV + commission from delivered orders.
    [HttpGet("monthly")]
    public async Task<IActionResult> Monthly()
    {
        var since = DateTime.UtcNow.AddMonths(-6);
        var rows = await db.Orders
            .Where(o => o.Status == "Delivered" && o.OrderDate >= since)
            .GroupBy(o => new { o.OrderDate.Year, o.OrderDate.Month })
            .Select(g => new
            {
                g.Key.Year,
                g.Key.Month,
                Gmv = g.Sum(o => o.TotalAmount),
                Commission = g.Sum(o => o.PlatformFee) ?? 0,
                Orders = g.Count()
            })
            .ToListAsync();

        return Ok(rows.OrderBy(r => r.Year).ThenBy(r => r.Month));
    }
}
