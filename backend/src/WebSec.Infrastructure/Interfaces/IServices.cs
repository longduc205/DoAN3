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
    Task<AiAdviceModel> ExplainFindingAsync(Guid findingId, CancellationToken ct);
    Task<AiAdviceModel> SuggestRemediationAsync(Guid findingId, CancellationToken ct);
}
