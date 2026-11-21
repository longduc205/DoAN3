using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WebSec.Infrastructure.Interfaces;
using WebSec.Shared.DTOs;
using WebSec.Shared.Enums;
using WebSec.Shared.Models;
using WebSec.Shared.Params;
using WebSec.Shared.Responses;

namespace WebSec.Api.Controllers;

[Route("api/users"), Authorize(Policy = Permissions.UserManage)]
public class UsersController(IUserAdminService users) : ApiControllerBase
{
    [HttpPost("get-all")]
    public async Task<PaginatedResponse<IReadOnlyList<UserAdminModel>>> GetAll(UserSearchParam param, CancellationToken ct) =>
        Paged(await users.GetAllAsync(param, ct));

    [HttpPost("change-role")]
    public async Task<ApiResponse<UserAdminModel>> ChangeRole(ChangeUserRoleRequest request, CancellationToken ct) =>
        Success(await users.ChangeRoleAsync(request, ct));

    [HttpPost("set-active")]
    public async Task<ApiResponse<UserAdminModel>> SetActive(SetUserActiveRequest request, CancellationToken ct) =>
        Success(await users.SetActiveAsync(request, ct));

    [HttpPost("get-role-permissions")]
    public async Task<ApiResponse<IReadOnlyList<RolePermissionsModel>>> GetRolePermissions(CancellationToken ct) =>
        Success(await users.GetRolePermissionsAsync(ct));
}

[Route("api/audit-logs"), Authorize(Policy = Permissions.AuditLogView)]
public class AuditLogsController(IAuditLogService logs) : ApiControllerBase
{
    [HttpPost("get-all")]
    public async Task<PaginatedResponse<IReadOnlyList<AuditLogModel>>> GetAll(AuditLogSearchParam param, CancellationToken ct) =>
        Paged(await logs.GetAllAsync(param, ct));

    [HttpPost("get-stats")]
    public async Task<ApiResponse<AuditStatsModel>> GetStats(CancellationToken ct) => Success(await logs.GetStatsAsync(ct));

    /// <summary>CSV of the filtered trail (max 5000 rows). Values were masked when written.</summary>
    [HttpPost("export"), Produces("text/csv")]
    public async Task<IActionResult> Export(AuditLogSearchParam param, CancellationToken ct) =>
        File(System.Text.Encoding.UTF8.GetPreamble().Concat(System.Text.Encoding.UTF8.GetBytes(await logs.ExportCsvAsync(param, ct))).ToArray(),
            "text/csv", $"audit-logs-{DateTime.UtcNow:yyyyMMdd-HHmm}.csv");
}
