namespace SuperAdmin.API.DTOs;

public record SubscriptionPlanDto(
    Guid Id,
    string Name,
    decimal Price,
    int MaxMenuItems,
    int MaxDrivers,
    string? Features,
    DateTime CreatedAt
);

public record CreateUpdatePlanRequest(
    string Name,
    decimal Price,
    int MaxMenuItems,
    int MaxDrivers,
    string? Features
);

public record AssignPlanRequest(string PlanName);
