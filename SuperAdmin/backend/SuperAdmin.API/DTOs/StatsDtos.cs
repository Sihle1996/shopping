namespace SuperAdmin.API.DTOs;

public record StatsDto(
    int TotalStores,
    int ActiveStores,
    int TotalUsers,
    int TotalDrivers,
    int TotalOrders,
    double TotalRevenue,
    int PendingOrders
);
