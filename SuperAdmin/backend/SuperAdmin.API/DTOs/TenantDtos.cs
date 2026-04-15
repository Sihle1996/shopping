namespace SuperAdmin.API.DTOs;

public record TenantDto(
    Guid Id,
    string Name,
    string Slug,
    string? LogoUrl,
    string? PrimaryColor,
    string? Email,
    string? Phone,
    string? Address,
    int DeliveryRadiusKm,
    decimal DeliveryFeeBase,
    decimal PlatformCommissionPercent,
    string SubscriptionStatus,
    string SubscriptionPlan,
    bool Active,
    DateTime CreatedAt,
    int UserCount,
    int DriverCount,
    int OrderCount,
    double Revenue,
    DateTime? TrialStartedAt,
    int? TrialDaysRemaining
);

public record UpdateTenantRequest(
    string? Name,
    string? SubscriptionStatus,
    string? SubscriptionPlan,
    bool? Active,
    decimal? PlatformCommissionPercent,
    int? DeliveryRadiusKm
);

public record CreateStoreRequest(
    string Name,
    string Slug,
    string? Email,
    string? Phone,
    string? SubscriptionPlan,
    string? SubscriptionStatus
);
