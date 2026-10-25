using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using WebSec.Api.Extensions;
using WebSec.Infrastructure.Interfaces;
using WebSec.Shared.DTOs;
using WebSec.Shared.Models;
using WebSec.Shared.Responses;

namespace WebSec.Api.Controllers;

[Route("api/auth")]
public class AuthController(IAuthService auth) : ApiControllerBase
{
    [AllowAnonymous, EnableRateLimiting(ApiServiceExtensions.LoginRateLimit)]
    [HttpPost("login")]
    public async Task<ApiResponse<LoginResult>> Login(LoginRequest request, CancellationToken ct) =>
        Success(await auth.LoginAsync(request, ct));

    [HttpPost("me")]
    public async Task<ApiResponse<CurrentUserModel>> Me(CancellationToken ct) => Success(await auth.GetCurrentUserAsync(ct));

    /// <summary>Stateless JWT: the client drops its token. Kept for contract stability until refresh tokens exist.</summary>
    [HttpPost("logout")]
    public ApiResponse<bool> Logout() => Success(true);
}
