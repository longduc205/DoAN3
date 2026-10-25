using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WebSec.Infrastructure.Interfaces;
using WebSec.Shared.DTOs;
using WebSec.Shared.Enums;
using WebSec.Shared.Models;
using WebSec.Shared.Params;
using WebSec.Shared.Responses;

namespace WebSec.Api.Controllers;

[Route("api/scans")]
public class ScansController(IScanService scans) : ApiControllerBase
{
    [HttpPost("get-all"), Authorize(Policy = Permissions.ScanView)]
    public async Task<PaginatedResponse<IReadOnlyList<ScanModel>>> GetAll(ScanSearchParam param, CancellationToken ct) =>
        Paged(await scans.GetAllAsync(param, ct));

    [HttpPost("get-by-id"), Authorize(Policy = Permissions.ScanView)]
    public async Task<ApiResponse<ScanModel>> GetById(IdRequest request, CancellationToken ct) =>
        Success(await scans.GetByIdAsync(request.Id, ct));

    [HttpPost("create"), Authorize(Policy = Permissions.ScanCreate)]
    public async Task<ApiResponse<ScanModel>> Create(CreateScanRequest request, CancellationToken ct) =>
        Success(await scans.CreateAsync(request, ct));

    [HttpPost("get-progress"), Authorize(Policy = Permissions.ScanView)]
    public async Task<ApiResponse<ScanProgressModel>> GetProgress(IdRequest request, CancellationToken ct) =>
        Success(await scans.GetProgressAsync(request.Id, ct));

    [HttpPost("cancel"), Authorize(Policy = Permissions.ScanCreate)]
    public async Task<ApiResponse<ScanModel>> Cancel(IdRequest request, CancellationToken ct) =>
        Success(await scans.CancelAsync(request.Id, ct));

    [HttpPost("get-findings"), Authorize(Policy = Permissions.ScanView)]
    public async Task<PaginatedResponse<IReadOnlyList<ScanFindingModel>>> GetFindings(FindingSearchParam param, CancellationToken ct) =>
        Paged(await scans.GetFindingsAsync(param, ct));
}
