namespace SuperAdmin.API.DTOs;

public record SubscriptionPlanDto(
    Guid Id,
    string Name,
    decimal Price,
    int MaxMenuItems,
    int MaxDrivers,
    int MaxPromotions,
    int MaxDeliveryRadiusKm,
    bool HasAnalytics,
    bool HasCustomBranding,
    bool HasInventoryExport,
    decimal CommissionPercent,
    string? Features,
    DateTime CreatedAt
);

public record CreateUpdatePlanRequest(
    string Name,
    decimal Price,
    int MaxMenuItems,
    int MaxDrivers,
    int MaxPromotions,
    int MaxDeliveryRadiusKm,
    bool HasAnalytics,
    bool HasCustomBranding,
    bool HasInventoryExport,
    decimal CommissionPercent,
    string? Features
);

public record AssignPlanRequest(string PlanName);

public record ExtendTrialRequest(int Days = 7);
