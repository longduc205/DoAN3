using WebSec.Shared.DTOs;
using WebSec.Shared.Models;
using WebSec.Shared.Params;
using WebSec.Shared.Responses;

namespace WebSec.Infrastructure.Interfaces;

/// <summary>Who is calling. API implements it from the JWT; the worker has no user (system).</summary>
public interface ICurrentUser
{
    Guid? UserId { get; }
    bool IsInRole(string role);
    bool HasPermission(string permission);
}

public interface IAuthService
{
    Task<LoginResult> LoginAsync(LoginRequest request, CancellationToken ct);
    Task<CurrentUserModel> GetCurrentUserAsync(CancellationToken ct);
}

public interface IProjectService
{
    Task<PagedResult<ProjectModel>> GetAllAsync(ProjectSearchParam param, CancellationToken ct);
    Task<ProjectModel> GetByIdAsync(Guid id, CancellationToken ct);
    Task<ProjectModel> CreateAsync(CreateProjectRequest request, CancellationToken ct);
    Task<ProjectModel> UpdateAsync(UpdateProjectRequest request, CancellationToken ct);
    Task DeleteAsync(Guid id, CancellationToken ct);
}

public interface ITargetService
{
    Task<PagedResult<TargetModel>> GetAllAsync(TargetSearchParam param, CancellationToken ct);
    Task<TargetModel> GetByIdAsync(Guid id, CancellationToken ct);
    Task<TargetModel> CreateAsync(CreateTargetRequest request, CancellationToken ct);
    Task<TargetModel> UpdateAsync(UpdateTargetRequest request, CancellationToken ct);
    Task DeleteAsync(Guid id, CancellationToken ct);
}

public interface IScanService
{
    Task<PagedResult<ScanModel>> GetAllAsync(ScanSearchParam param, CancellationToken ct);
    Task<ScanModel> GetByIdAsync(Guid id, CancellationToken ct);
    Task<ScanModel> CreateAsync(CreateScanRequest request, CancellationToken ct);
    Task<ScanProgressModel> GetProgressAsync(Guid id, CancellationToken ct);
    Task<ScanModel> CancelAsync(Guid id, CancellationToken ct);
    Task<PagedResult<ScanFindingModel>> GetFindingsAsync(FindingSearchParam param, CancellationToken ct);
}

public interface IDashboardService
{
    Task<DashboardSummaryModel> GetSummaryAsync(CancellationToken ct);
}

public interface IAiService
{
    Task<AiContextModel> GetContextAsync(AiFindingRequest request, CancellationToken ct);
    Task<AiAdviceModel> ExplainFindingAsync(AiFindingRequest request, CancellationToken ct);
    Task<AiAdviceModel> SuggestRemediationAsync(AiFindingRequest request, CancellationToken ct);
    Task<AiAdviceModel> AskAsync(AiAskRequest request, CancellationToken ct);
}

public interface IUserAdminService
{
    Task<PagedResult<UserAdminModel>> GetAllAsync(UserSearchParam param, CancellationToken ct);
    Task<UserAdminModel> ChangeRoleAsync(ChangeUserRoleRequest request, CancellationToken ct);
    Task<UserAdminModel> SetActiveAsync(SetUserActiveRequest request, CancellationToken ct);
    Task<IReadOnlyList<RolePermissionsModel>> GetRolePermissionsAsync(CancellationToken ct);
}

public interface IAuditLogService
{
    Task<PagedResult<AuditLogModel>> GetAllAsync(AuditLogSearchParam param, CancellationToken ct);
    Task<AuditStatsModel> GetStatsAsync(CancellationToken ct);
    Task<string> ExportCsvAsync(AuditLogSearchParam param, CancellationToken ct);
}

public interface IReportService
{
    Task<PagedResult<ReportModel>> GetAllAsync(ReportSearchParam param, CancellationToken ct);
    Task<ReportDetailModel> GetByIdAsync(Guid id, CancellationToken ct);
    Task<ReportDetailModel> CreateAsync(CreateReportRequest request, CancellationToken ct);
    Task<ReportDetailModel> RetryAsync(Guid id, CancellationToken ct);
}

public interface IVulnerabilityService
{
    Task<PagedResult<VulnerabilityModel>> GetAllAsync(VulnerabilitySearchParam param, CancellationToken ct);
    Task<VulnerabilityFacetsModel> GetFacetsAsync(VulnerabilitySearchParam param, CancellationToken ct);
    Task<VulnerabilityDetailModel> GetByIdAsync(Guid id, CancellationToken ct);
    Task<VulnerabilityDetailModel> UpdateStatusAsync(UpdateVulnerabilityStatusRequest request, CancellationToken ct);
    Task<int> AssignAsync(AssignVulnerabilitiesRequest request, CancellationToken ct);
    Task<VulnerabilityCommentModel> AddCommentAsync(AddVulnerabilityCommentRequest request, CancellationToken ct);
    Task<IReadOnlyList<VulnerabilityCommentModel>> GetCommentsAsync(Guid id, CancellationToken ct);
    Task<IReadOnlyList<VulnerabilityHistoryModel>> GetHistoryAsync(Guid id, CancellationToken ct);
    Task<IReadOnlyList<UserLookupModel>> GetAssigneesAsync(CancellationToken ct);
}
