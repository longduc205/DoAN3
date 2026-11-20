using Microsoft.EntityFrameworkCore;
using WebSec.Infrastructure.Data;
using WebSec.Infrastructure.Interfaces;
using WebSec.Infrastructure.Security;
using WebSec.Infrastructure.Services;
using WebSec.Shared.DTOs;
using WebSec.Shared.Entities;
using WebSec.Shared.Enums;
using WebSec.Shared.Errors;

namespace WebSec.UnitTests;

public class AdminTests
{
    private sealed class FakeUser(Guid id, string role) : ICurrentUser
    {
        public Guid? UserId => id;
        public bool IsInRole(string r) => r == role;
        public bool HasPermission(string p) => Roles.DefaultPermissions[role].Contains(p);
    }

    [Fact]
    public void Audit_MasksSecretKeysAndIp()
    {
        var json = AuditLogger.MaskJson(new { userName = "a", password = "pw", nested = new { accessToken = "t", ok = 1 } })!;
        Assert.DoesNotContain("pw", json);
        Assert.DoesNotContain("\"t\"", json);
        Assert.Contains("\"userName\":\"a\"", json);
        Assert.Contains("\"ok\":1", json);
        Assert.Equal("203.0.113.x", AuditLogger.MaskIp("203.0.113.42"));
        Assert.Equal("172.18.0.x", AuditLogger.MaskIp("::ffff:172.18.0.1"));
    }

    [Fact]
    public async Task ChangeRole_BlocksSelf_AndAuditsPermissionDiff()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var perms = Permissions.All.ToDictionary(c => c, c => new Permission { Id = Guid.NewGuid(), Code = c, Name = c, Module = "x" });
        var roles = Roles.DefaultPermissions.ToDictionary(kv => kv.Key, kv => new Role
        {
            Id = Guid.NewGuid(), Code = kv.Key, Name = kv.Key,
            RolePermissions = kv.Value.Select(p => new RolePermission { PermissionId = perms[p].Id }).ToList(),
        });
        var admin = new User { Id = Guid.NewGuid(), UserName = "admin", FullName = "Admin" };
        var dev = new User { Id = Guid.NewGuid(), UserName = "dev", FullName = "Dev" };
        db.AddRange(perms.Values);
        db.AddRange(roles.Values);
        db.AddRange(admin, dev,
            new UserRole { UserId = admin.Id, RoleId = roles[Roles.Admin].Id }, new UserRole { UserId = dev.Id, RoleId = roles[Roles.Developer].Id });
        await db.SaveChangesAsync();
        var me = new FakeUser(admin.Id, Roles.Admin);
        var svc = new UserAdminService(db, me, new AuditLogger(db, me));

        await Assert.ThrowsAsync<AppException>(() => svc.ChangeRoleAsync(new ChangeUserRoleRequest { UserId = admin.Id, Role = Roles.Viewer }, default));

        var updated = await svc.ChangeRoleAsync(new ChangeUserRoleRequest { UserId = dev.Id, Role = Roles.SecurityAnalyst }, default);
        Assert.Equal(Roles.SecurityAnalyst, updated.Role);
        var log = await db.AuditLogs.SingleAsync(a => a.Action == "USER_ROLE_CHANGED");
        Assert.Equal(admin.Id, log.UserId);
        Assert.Contains(Permissions.ScanCreate, log.DetailJson); // gained
    }
}
