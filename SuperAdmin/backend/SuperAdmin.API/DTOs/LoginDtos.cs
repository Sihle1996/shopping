using System.ComponentModel.DataAnnotations;

namespace SuperAdmin.API.DTOs;

public class LoginRequest
{
    [Required, EmailAddress, MaxLength(200)]
    public string Email { get; set; } = "";

    [Required, MinLength(6), MaxLength(200)]
    public string Password { get; set; } = "";
}

public record LoginResponse(string Token, string Email, string Role, DateTime ExpiresAt);
