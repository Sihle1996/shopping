namespace SuperAdmin.API.DTOs;

public record LoginRequest(string Email, string Password);
public record LoginResponse(string Token, string Email, string Role, DateTime ExpiresAt);
