using Microsoft.EntityFrameworkCore;
using SuperAdmin.API.Data;
using SuperAdmin.API.DTOs;

namespace SuperAdmin.API.Services;

public class AuthService(AppDbContext db, JwtService jwt)
{
    public async Task<LoginResponse?> LoginAsync(LoginRequest request)
    {
        var user = await db.Users
            .FirstOrDefaultAsync(u => u.Email == request.Email && u.Role == "SUPERADMIN");

        if (user == null) return null;

        if (!BCrypt.Net.BCrypt.Verify(request.Password, user.Password)) return null;

        var (token, expiresAt) = jwt.GenerateToken(user.Id.ToString(), user.Email, user.Role!);
        return new LoginResponse(token, user.Email, user.Role!, expiresAt);
    }
}
