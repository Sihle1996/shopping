using Microsoft.EntityFrameworkCore;
using SuperAdmin.API.Models;

namespace SuperAdmin.API.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<SubscriptionPlan> SubscriptionPlans => Set<SubscriptionPlan>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>()
            .HasOne(u => u.Tenant)
            .WithMany(t => t.Users)
            .HasForeignKey(u => u.TenantId)
            .IsRequired(false);

        // PlatformCommissionPercent may be stored as numeric in Postgres
        modelBuilder.Entity<Tenant>()
            .Property(t => t.PlatformCommissionPercent)
            .HasColumnType("numeric");

        // DeliveryFeeBase
        modelBuilder.Entity<Tenant>()
            .Property(t => t.DeliveryFeeBase)
            .HasColumnType("numeric");
    }
}
