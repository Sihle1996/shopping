namespace SuperAdmin.API.DTOs;

public record UserDto(
    Guid Id,
    string Email,
    string? Role,
    string? DriverStatus,
    Guid? TenantId,
    string? TenantName,
    DateTime? LastPing
);

public record UpdateUserRequest(string? Role, string? DriverStatus);
