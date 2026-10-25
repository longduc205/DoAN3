using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using WebSec.Infrastructure.Data;
using WebSec.Infrastructure.Interfaces;
using WebSec.Infrastructure.Security;
using WebSec.Shared.DTOs;
using WebSec.Shared.Entities;
using WebSec.Shared.Errors;
using WebSec.Shared.Models;

namespace WebSec.Infrastructure.Services;

public class AuthService(AppDbContext db, IPasswordHasher<User> hasher, JwtTokenService tokens, ICurrentUser currentUser) : IAuthService
{
    public async Task<LoginResult> LoginAsync(LoginRequest request, CancellationToken ct)
    {
        var name = request.UserName.Trim().ToLowerInvariant();
        var user = await db.Users.FirstOrDefaultAsync(u => u.UserName == name || u.Email == name, ct);
        // Same message for unknown user / wrong password / inactive to avoid account enumeration.
        if (user is null || !user.IsActive
            || hasher.VerifyHashedPassword(user, user.PasswordHash, request.Password) == PasswordVerificationResult.Failed)
        {
            throw AppException.Unauthorized("Invalid username or password.");
        }

        var model = await BuildUserModelAsync(user, ct);
        var (token, expires) = tokens.CreateToken(user.Id, user.UserName, model.Roles, model.Permissions);
        return new LoginResult { AccessToken = token, ExpiresAt = expires, User = model };
    }

    public async Task<CurrentUserModel> GetCurrentUserAsync(CancellationToken ct)
    {
        var userId = currentUser.UserId ?? throw AppException.Unauthorized("Not authenticated.");
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId && u.IsActive, ct)
            ?? throw AppException.Unauthorized("Not authenticated.");
        return await BuildUserModelAsync(user, ct);
    }

    private async Task<CurrentUserModel> BuildUserModelAsync(User user, CancellationToken ct)
    {
        var roles = await db.UserRoles.Where(ur => ur.UserId == user.Id).Select(ur => ur.Role).ToListAsync(ct);
        var roleIds = roles.Select(r => r.Id).ToList();
        var permissions = await db.RolePermissions.Where(rp => roleIds.Contains(rp.RoleId))
            .Select(rp => rp.Permission.Code).Distinct().ToListAsync(ct);
        return new CurrentUserModel
        {
            Id = user.Id,
            UserName = user.UserName,
            Email = user.Email,
            FullName = user.FullName,
            Roles = roles.Select(r => r.Code).ToList(),
            Permissions = permissions,
        };
    }
}
