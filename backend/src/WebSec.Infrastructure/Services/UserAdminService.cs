using Microsoft.EntityFrameworkCore;
using WebSec.Infrastructure.Data;
using WebSec.Infrastructure.Interfaces;
using WebSec.Infrastructure.Security;
using WebSec.Shared.DTOs;
using WebSec.Shared.Entities;
using WebSec.Shared.Errors;
using WebSec.Shared.Models;
using WebSec.Shared.Params;
using WebSec.Shared.Responses;

namespace WebSec.Infrastructure.Services;

/// <summary>W12 Users &amp; Roles. Permissions are fixed per role (A3: no custom roles); only the user's role changes.</summary>
public class UserAdminService(AppDbContext db, ICurrentUser currentUser, IAuditLogger? audit = null) : IUserAdminService
{
    public Task<PagedResult<UserAdminModel>> GetAllAsync(UserSearchParam param, CancellationToken ct)
    {
        param.Normalize();
        var q = db.Users.AsQueryable();
        if (param.Role is { } role) q = q.Where(u => u.UserRoles.Any(ur => ur.Role.Code == role));
        if (param.Keyword is { } kw)
        {
            var pattern = $"%{kw}%";
            q = q.Where(u => EF.Functions.ILike(u.FullName, pattern) || EF.Functions.ILike(u.Email, pattern) || EF.Functions.ILike(u.UserName, pattern));
        }
        return Project(q.OrderBy(u => u.FullName)).ToPagedAsync(param, x => x, ct);
    }

    public async Task<UserAdminModel> ChangeRoleAsync(ChangeUserRoleRequest request, CancellationToken ct)
    {
        // Self-change is blocked, so the last remaining Admin can never be demoted either.
        if (request.UserId == currentUser.UserId) throw AppException.Conflict("You cannot change your own role.");
        var user = await db.Users.Include(u => u.UserRoles).ThenInclude(ur => ur.Role).FirstOrDefaultAsync(u => u.Id == request.UserId, ct)
            ?? throw AppException.NotFound("user");
        var role = await db.Roles.FirstOrDefaultAsync(r => r.Code == request.Role, ct) ?? throw AppException.Validation("Unknown role.");
        var before = user.UserRoles.Select(ur => ur.Role.Code).ToList();
        if (before is [var only] && only == role.Code) return (await Project(db.Users.Where(u => u.Id == user.Id)).FirstAsync(ct));

        var oldPerms = await PermissionsOf(user.UserRoles.Select(ur => ur.RoleId).ToList(), ct);
        var newPerms = await PermissionsOf([role.Id], ct);
        db.UserRoles.RemoveRange(user.UserRoles);
        db.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = role.Id });
        audit?.Add("USER_ROLE_CHANGED", "User", user.Id, $"{user.UserName}: {string.Join(",", before)} → {role.Code}", new
        {
            before, after = role.Code,
            gained = newPerms.Except(oldPerms).ToList(), lost = oldPerms.Except(newPerms).ToList(),
        });
        await db.SaveChangesAsync(ct);
        return await Project(db.Users.Where(u => u.Id == user.Id)).FirstAsync(ct);
    }

    public async Task<IReadOnlyList<RolePermissionsModel>> GetRolePermissionsAsync(CancellationToken ct) =>
        await db.Roles.OrderBy(r => r.Code).Select(r => new RolePermissionsModel
        {
            Role = r.Code,
            Permissions = db.RolePermissions.Where(rp => rp.RoleId == r.Id).Select(rp => rp.Permission.Code).OrderBy(c => c).ToList(),
        }).ToListAsync(ct);

    private async Task<List<string>> PermissionsOf(List<Guid> roleIds, CancellationToken ct) =>
        await db.RolePermissions.Where(rp => roleIds.Contains(rp.RoleId)).Select(rp => rp.Permission.Code).Distinct().ToListAsync(ct);

    private IQueryable<UserAdminModel> Project(IQueryable<User> q) => q.Select(u => new UserAdminModel
    {
        Id = u.Id, UserName = u.UserName, Email = u.Email, FullName = u.FullName, IsActive = u.IsActive,
        Role = u.UserRoles.Select(ur => ur.Role.Code).FirstOrDefault() ?? string.Empty,
        LastLoginAt = db.AuditLogs.Where(a => a.UserId == u.Id && a.Action == "LOGIN_SUCCEEDED").Max(a => (DateTimeOffset?)a.CreatedAt),
    });
}
