using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WebSec.Infrastructure.Interfaces;
using WebSec.Shared.DTOs;
using WebSec.Shared.Enums;
using WebSec.Shared.Models;
using WebSec.Shared.Params;
using WebSec.Shared.Responses;

namespace WebSec.Api.Controllers;

[Route("api/reports")]
public class ReportsController(IReportService reports) : ApiControllerBase
{
    [HttpPost("get-all"), Authorize(Policy = Permissions.ReportView)]
    public async Task<PaginatedResponse<IReadOnlyList<ReportModel>>> GetAll(ReportSearchParam param, CancellationToken ct) =>
        Paged(await reports.GetAllAsync(param, ct));

    [HttpPost("get-by-id"), Authorize(Policy = Permissions.ReportView)]
    public async Task<ApiResponse<ReportDetailModel>> GetById(IdRequest request, CancellationToken ct) =>
        Success(await reports.GetByIdAsync(request.Id, ct));

    [HttpPost("create"), Authorize(Policy = Permissions.ReportGenerate)]
    public async Task<ApiResponse<ReportDetailModel>> Create(CreateReportRequest request, CancellationToken ct) =>
        Success(await reports.CreateAsync(request, ct));

    [HttpPost("retry"), Authorize(Policy = Permissions.ReportGenerate)]
    public async Task<ApiResponse<ReportDetailModel>> Retry(IdRequest request, CancellationToken ct) =>
        Success(await reports.RetryAsync(request.Id, ct));
}
