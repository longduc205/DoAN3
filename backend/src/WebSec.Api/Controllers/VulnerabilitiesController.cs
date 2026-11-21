using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WebSec.Infrastructure.Interfaces;
using WebSec.Shared.DTOs;
using WebSec.Shared.Enums;
using WebSec.Shared.Models;
using WebSec.Shared.Params;
using WebSec.Shared.Responses;

namespace WebSec.Api.Controllers;

[Route("api/vulnerabilities")]
public class VulnerabilitiesController(IVulnerabilityService vulns) : ApiControllerBase
{
    [HttpPost("get-all"), Authorize(Policy = Permissions.VulnerabilityView)]
    public async Task<PaginatedResponse<IReadOnlyList<VulnerabilityModel>>> GetAll(VulnerabilitySearchParam param, CancellationToken ct) =>
        Paged(await vulns.GetAllAsync(param, ct));

    [HttpPost("get-facets"), Authorize(Policy = Permissions.VulnerabilityView)]
    public async Task<ApiResponse<VulnerabilityFacetsModel>> GetFacets(VulnerabilitySearchParam param, CancellationToken ct) =>
        Success(await vulns.GetFacetsAsync(param, ct));

    [HttpPost("get-by-id"), Authorize(Policy = Permissions.VulnerabilityView)]
    public async Task<ApiResponse<VulnerabilityDetailModel>> GetById(IdRequest request, CancellationToken ct) =>
        Success(await vulns.GetByIdAsync(request.Id, ct));

    [HttpPost("update-status"), Authorize(Policy = Permissions.VulnerabilityUpdate)]
    public async Task<ApiResponse<VulnerabilityDetailModel>> UpdateStatus(UpdateVulnerabilityStatusRequest request, CancellationToken ct) =>
        Success(await vulns.UpdateStatusAsync(request, ct));

    [HttpPost("assign"), Authorize(Policy = Permissions.VulnerabilityTriage)]
    public async Task<ApiResponse<int>> Assign(AssignVulnerabilitiesRequest request, CancellationToken ct) =>
        Success(await vulns.AssignAsync(request, ct));

    [HttpPost("get-assignees"), Authorize(Policy = Permissions.VulnerabilityTriage)]
    public async Task<ApiResponse<IReadOnlyList<UserLookupModel>>> GetAssignees(CancellationToken ct) =>
        Success(await vulns.GetAssigneesAsync(ct));

    [HttpPost("add-comment"), Authorize(Policy = Permissions.VulnerabilityView)]
    public async Task<ApiResponse<VulnerabilityCommentModel>> AddComment(AddVulnerabilityCommentRequest request, CancellationToken ct) =>
        Success(await vulns.AddCommentAsync(request, ct));

    [HttpPost("get-comments"), Authorize(Policy = Permissions.VulnerabilityView)]
    public async Task<ApiResponse<IReadOnlyList<VulnerabilityCommentModel>>> GetComments(IdRequest request, CancellationToken ct) =>
        Success(await vulns.GetCommentsAsync(request.Id, ct));

    [HttpPost("get-history"), Authorize(Policy = Permissions.VulnerabilityView)]
    public async Task<ApiResponse<IReadOnlyList<VulnerabilityHistoryModel>>> GetHistory(IdRequest request, CancellationToken ct) =>
        Success(await vulns.GetHistoryAsync(request.Id, ct));
}
