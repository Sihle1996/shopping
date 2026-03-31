using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SuperAdmin.API.Data;
using SuperAdmin.API.Services;
using System.Text;
using System.Threading.RateLimiting;

// Npgsql 6+ requires explicit timestamp timezone handling.
// This switch allows reading 'timestamp without time zone' columns as DateTime safely.
AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("login", o =>
    {
        o.PermitLimit = 5;
        o.Window = TimeSpan.FromMinutes(1);
        o.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        o.QueueLimit = 0;
    });
    options.RejectionStatusCode = 429;
});

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddScoped<JwtService>();
builder.Services.AddScoped<AuthService>();

var jwtKey = builder.Configuration["Jwt:Key"]!;
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };
    });

builder.Services.AddAuthorization();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReact", policy =>
    {
        var origins = builder.Configuration
            .GetSection("Cors:AllowedOrigins")
            .Get<string[]>() ?? ["http://localhost:5173"];
        policy.WithOrigins(origins)
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

var app = builder.Build();

app.UseExceptionHandler(err => err.Run(async ctx =>
{
    var logger = ctx.RequestServices.GetRequiredService<ILogger<Program>>();
    var exFeature = ctx.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature>();
    if (exFeature?.Error != null)
        logger.LogError(exFeature.Error, "Unhandled exception on {Method} {Path}", ctx.Request.Method, ctx.Request.Path);
    ctx.Response.StatusCode = 500;
    ctx.Response.ContentType = "application/json";
    await ctx.Response.WriteAsJsonAsync(new { message = "An unexpected error occurred." });
}));

app.UseCors("AllowReact");
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// Indexes + seed on startup
using (var scope = app.Services.CreateScope())
{
    var startupLogger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

    // Apply indexes individually so one failure doesn't block the rest
    // Note: User model maps to "_user" table
    var indexes = new[]
    {
        @"CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email ON ""_user""(email)",
        @"CREATE UNIQUE INDEX IF NOT EXISTS ix_tenants_slug ON tenants(slug)",
        @"CREATE INDEX IF NOT EXISTS ix_users_role ON ""_user""(role)",
        @"CREATE INDEX IF NOT EXISTS ix_users_tenant_id ON ""_user""(tenant_id)",
        @"CREATE INDEX IF NOT EXISTS ix_orders_tenant_id ON orders(tenant_id)",
        @"CREATE INDEX IF NOT EXISTS ix_orders_created_at ON orders(created_at)",
        @"CREATE INDEX IF NOT EXISTS ix_orders_status ON orders(status)",
    };
    foreach (var sql in indexes)
    {
        try { db.Database.ExecuteSqlRaw(sql); }
        catch (Exception ex) { startupLogger.LogWarning("[Startup] Index skipped: {Message}", ex.Message); }
    }

    try
    {
        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS subscription_plans (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(100) NOT NULL,
                price DECIMAL(10,2) NOT NULL DEFAULT 0,
                max_menu_items INT NOT NULL DEFAULT 50,
                max_drivers INT NOT NULL DEFAULT 5,
                features TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
            INSERT INTO subscription_plans (name, price, max_menu_items, max_drivers, features)
            SELECT 'BASIC', 299.00, 30, 3, 'Up to 30 menu items, 3 drivers, Basic analytics'
            WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE name = 'BASIC');
            INSERT INTO subscription_plans (name, price, max_menu_items, max_drivers, features)
            SELECT 'PRO', 699.00, 100, 10, 'Up to 100 menu items, 10 drivers, Advanced analytics, Priority support'
            WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE name = 'PRO');
            INSERT INTO subscription_plans (name, price, max_menu_items, max_drivers, features)
            SELECT 'ENTERPRISE', 1499.00, 999, 99, 'Unlimited items, Unlimited drivers, Full analytics, Dedicated support, White-label'
            WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE name = 'ENTERPRISE');
        ");
    }
        // Add unique index on plans after table is guaranteed to exist
        try { db.Database.ExecuteSqlRaw(@"CREATE UNIQUE INDEX IF NOT EXISTS ix_subscription_plans_name ON subscription_plans(name)"); }
        catch (Exception ex) { startupLogger.LogWarning("[Startup] Index skipped: {Message}", ex.Message); }
    }
    catch (Exception ex)
    {
        startupLogger.LogWarning(ex, "[Startup] DB seed warning");
    }
}

app.Run();
