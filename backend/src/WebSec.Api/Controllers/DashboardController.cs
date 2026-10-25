using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WebSec.Infrastructure.Interfaces;
using WebSec.Shared.Enums;
using WebSec.Shared.Models;
using WebSec.Shared.Responses;

namespace WebSec.Api.Controllers;

[Route("api/dashboard")]
public class DashboardController(IDashboardService dashboard) : ApiControllerBase
{
    [HttpPost("get-summary"), Authorize(Policy = Permissions.ProjectView)]
    public async Task<ApiResponse<DashboardSummaryModel>> GetSummary(CancellationToken ct) => Success(await dashboard.GetSummaryAsync(ct));
}
