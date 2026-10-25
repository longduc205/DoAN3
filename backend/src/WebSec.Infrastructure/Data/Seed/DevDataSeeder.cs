using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using WebSec.Shared.Entities;
using WebSec.Shared.Enums;

namespace WebSec.Infrastructure.Data.Seed;

/// <summary>
/// Seeds roles and permissions (always safe, idempotent) and disposable DEVELOPMENT-ONLY accounts.
/// Callers must only invoke <see cref="SeedDevUsersAsync"/> in Development or with SEED_DEV_DATA=true.
/// </summary>
public static class DevDataSeeder
{
    // Local-only credentials, documented in README. Never reuse in any shared/production environment.
    public static readonly (string UserName, string Password, string FullName, string Role)[] DevUsers =
    [
        ("admin", "Admin@12345", "Dev Admin", Roles.Admin),
        ("analyst", "Analyst@12345", "Dev Analyst", Roles.SecurityAnalyst),
        ("developer", "Developer@12345", "Dev Developer", Roles.Developer),
        ("viewer", "Viewer@12345", "Dev Viewer", Roles.Viewer),
    ];

    public static async Task SeedRolesAndPermissionsAsync(AppDbContext db, CancellationToken ct = default)
    {
        var permissions = await db.Permissions.ToDictionaryAsync(p => p.Code, ct);
        foreach (var code in Permissions.All.Where(c => !permissions.ContainsKey(c)))
        {
            var p = new Permission { Id = Guid.NewGuid(), Code = code, Name = code, Module = code.Split('.')[0] };
            db.Permissions.Add(p);
            permissions[code] = p;
        }

        var roles = await db.Roles.Include(r => r.RolePermissions).ToDictionaryAsync(r => r.Code, ct);
        foreach (var (code, perms) in Roles.DefaultPermissions)
        {
            if (!roles.TryGetValue(code, out var role))
            {
                role = new Role { Id = Guid.NewGuid(), Code = code, Name = code, Deletable = false };
                db.Roles.Add(role);
            }
            foreach (var perm in perms.Where(pc => role.RolePermissions.All(rp => rp.PermissionId != permissions[pc].Id)))
                role.RolePermissions.Add(new RolePermission { RoleId = role.Id, PermissionId = permissions[perm].Id });
        }
        await db.SaveChangesAsync(ct);
    }

    public static async Task SeedDevUsersAsync(AppDbContext db, IPasswordHasher<User> hasher, ILogger logger, CancellationToken ct = default)
    {
        var roles = await db.Roles.ToDictionaryAsync(r => r.Code, ct);
        foreach (var (userName, password, fullName, role) in DevUsers)
        {
            if (await db.Users.IgnoreQueryFilters().AnyAsync(u => u.UserName == userName, ct)) continue;
            var user = new User { Id = Guid.NewGuid(), UserName = userName, Email = $"{userName}@websec.local", FullName = fullName };
            user.PasswordHash = hasher.HashPassword(user, password);
            user.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = roles[role].Id });
            db.Users.Add(user);
            logger.LogInformation("Seeded development user {UserName} ({Role})", userName, role);
        }
        await db.SaveChangesAsync(ct);
    }
}
