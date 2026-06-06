using Microsoft.EntityFrameworkCore;
using SuperAdmin.API.Models;

namespace SuperAdmin.API.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<SubscriptionPlan> SubscriptionPlans => Set<SubscriptionPlan>();
    public DbSet<PlatformSettings> PlatformSettings => Set<PlatformSettings>();
    public DbSet<StoreDocument> StoreDocuments => Set<StoreDocument>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<PlatformSettings>().HasKey(p => p.Id);
        modelBuilder.Entity<User>()
            .HasOne(u => u.Tenant)
            .WithMany(t => t.Users)
            .HasForeignKey(u => u.TenantId)
            .IsRequired(false);

        modelBuilder.Entity<Tenant>()
            .Property(t => t.PlatformCommissionPercent)
            .HasColumnType("numeric");

        modelBuilder.Entity<Tenant>()
            .Property(t => t.DeliveryFeeBase)
            .HasColumnType("numeric");

        modelBuilder.Entity<Tenant>()
            .Property(t => t.MinimumOrderAmount)
            .HasColumnType("numeric");

        // StoreDocuments
        modelBuilder.Entity<StoreDocument>()
            .HasOne(d => d.Tenant)
            .WithMany(t => t.StoreDocuments)
            .HasForeignKey(d => d.TenantId);
    }
}
