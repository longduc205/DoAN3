using System.Security.Cryptography;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.IdentityModel.Tokens;
using WebSec.Api.Middleware;
using WebSec.Infrastructure.Data;
using WebSec.Infrastructure.Interfaces;
using WebSec.Infrastructure.Security;
using WebSec.Shared.Enums;
using WebSec.Shared.Errors;
using WebSec.Shared.Responses;

namespace WebSec.Api.Extensions;

public static class ApiServiceExtensions
{
    public const string CorsPolicy = "frontend";
    public const string LoginRateLimit = "login";
    public const string AiRateLimit = "ai";

    public static IServiceCollection AddApiServices(this IServiceCollection services, IConfiguration config, IHostEnvironment env, ILogger startupLogger)
    {
        services.AddControllers()
            .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()))
            .ConfigureApiBehaviorOptions(o => o.InvalidModelStateResponseFactory = ctx =>
            {
                var errors = ctx.ModelState.Where(kv => kv.Value?.Errors.Count > 0)
                    .ToDictionary(kv => kv.Key, kv => kv.Value!.Errors.Select(e => e.ErrorMessage).ToArray());
                var body = new ApiResponse<Dictionary<string, string[]>>
                {
                    Success = false, Code = ErrorCodes.ValidationError, Message = "One or more fields are invalid.", Data = errors,
                    TraceId = System.Diagnostics.Activity.Current?.TraceId.ToString() ?? ctx.HttpContext.TraceIdentifier,
                };
                return new BadRequestObjectResult(body);
            });

        services.AddEndpointsApiExplorer();
        services.AddSwaggerGen(o =>
        {
            o.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
            {
                Type = Microsoft.OpenApi.Models.SecuritySchemeType.Http, Scheme = "bearer", BearerFormat = "JWT",
            });
            o.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
            {
                [new Microsoft.OpenApi.Models.OpenApiSecurityScheme
                {
                    Reference = new Microsoft.OpenApi.Models.OpenApiReference { Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme, Id = "Bearer" },
                }] = [],
            });
        });

        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUser, HttpCurrentUser>();

        var jwt = BuildJwtOptions(config, env, startupLogger);
        services.AddSingleton(jwt);
        services.AddSingleton<JwtTokenService>();
        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(o =>
        {
            o.MapInboundClaims = false;
            o.TokenValidationParameters = new TokenValidationParameters
            {
                ValidIssuer = jwt.Issuer,
                ValidAudience = jwt.Audience,
                IssuerSigningKey = jwt.GetKey(),
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateIssuerSigningKey = true,
                ValidateLifetime = true,
                ClockSkew = TimeSpan.FromSeconds(30),
                RoleClaimType = System.Security.Claims.ClaimTypes.Role,
                NameClaimType = "unique_name",
            };
            o.Events = new JwtBearerEvents
            {
                OnChallenge = ctx =>
                {
                    ctx.HandleResponse();
                    return ExceptionMiddleware.WriteAsync(ctx.HttpContext, 401, ErrorCodes.Unauthorized, "Authentication is required.");
                },
                OnForbidden = ctx => ExceptionMiddleware.WriteAsync(ctx.HttpContext, 403, ErrorCodes.Forbidden, "You do not have permission to perform this action."),
            };
        });

        // One policy per permission code: [Authorize(Policy = Permissions.ProjectView)].
        services.AddAuthorization(o =>
        {
            foreach (var permission in Permissions.All)
                o.AddPolicy(permission, p => p.RequireAuthenticatedUser().RequireClaim(AppClaims.Permission, permission));
        });

        services.AddRateLimiter(o =>
        {
            o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            o.OnRejected = (ctx, _) => new ValueTask(ExceptionMiddleware.WriteAsync(ctx.HttpContext, 429, ErrorCodes.RateLimited, "Too many requests. Please try again later."));
            o.AddPolicy(LoginRateLimit, http => RateLimitPartition.GetFixedWindowLimiter(
                http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1) }));
            o.AddPolicy(AiRateLimit, http => RateLimitPartition.GetFixedWindowLimiter(
                http.User.FindFirst("sub")?.Value ?? http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                _ => new FixedWindowRateLimiterOptions { PermitLimit = 20, Window = TimeSpan.FromMinutes(1) }));
        });

        var origins = (config["FRONTEND_ORIGIN"] ?? "http://localhost:4200").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        services.AddCors(o => o.AddPolicy(CorsPolicy, p => p.WithOrigins(origins).AllowAnyHeader().WithMethods("GET", "POST")));

        services.AddHealthChecks().AddDbContextCheck<AppDbContext>("database", tags: ["ready"]);
        return services;
    }

    private static JwtOptions BuildJwtOptions(IConfiguration config, IHostEnvironment env, ILogger logger)
    {
        var key = config["JWT_SIGNING_KEY"];
        if (string.IsNullOrWhiteSpace(key) || key.StartsWith("replace_with", StringComparison.Ordinal))
        {
            if (!env.IsDevelopment()) throw new InvalidOperationException("JWT_SIGNING_KEY must be configured outside Development.");
            // Development fallback: ephemeral random key (tokens become invalid on restart). Never logged.
            key = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));
            logger.LogWarning("JWT_SIGNING_KEY not set; using an ephemeral development key.");
        }
        if (key.Length < 32) throw new InvalidOperationException("JWT_SIGNING_KEY must be at least 32 characters.");

        return new JwtOptions
        {
            Issuer = config["JWT_ISSUER"] ?? "WebSecPlatform",
            Audience = config["JWT_AUDIENCE"] ?? "WebSecPlatformClient",
            SigningKey = key,
            AccessTokenMinutes = config.GetValue("JWT_ACCESS_TOKEN_MINUTES", 60),
        };
    }
}
