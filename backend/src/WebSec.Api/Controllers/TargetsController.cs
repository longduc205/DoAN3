using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WebSec.Infrastructure.Interfaces;
using WebSec.Shared.DTOs;
using WebSec.Shared.Enums;
using WebSec.Shared.Models;
using WebSec.Shared.Params;
using WebSec.Shared.Responses;

namespace WebSec.Api.Controllers;

[Route("api/targets")]
public class TargetsController(ITargetService targets) : ApiControllerBase
{
    [HttpPost("get-all"), Authorize(Policy = Permissions.ProjectView)]
    public async Task<PaginatedResponse<IReadOnlyList<TargetModel>>> GetAll(TargetSearchParam param, CancellationToken ct) =>
        Paged(await targets.GetAllAsync(param, ct));

    [HttpPost("get-by-id"), Authorize(Policy = Permissions.ProjectView)]
    public async Task<ApiResponse<TargetModel>> GetById(IdRequest request, CancellationToken ct) =>
        Success(await targets.GetByIdAsync(request.Id, ct));

    [HttpPost("create"), Authorize(Policy = Permissions.ProjectUpdate)]
    public async Task<ApiResponse<TargetModel>> Create(CreateTargetRequest request, CancellationToken ct) =>
        Success(await targets.CreateAsync(request, ct));

    [HttpPost("update"), Authorize(Policy = Permissions.ProjectUpdate)]
    public async Task<ApiResponse<TargetModel>> Update(UpdateTargetRequest request, CancellationToken ct) =>
        Success(await targets.UpdateAsync(request, ct));

    [HttpPost("delete"), Authorize(Policy = Permissions.ProjectUpdate)]
    public async Task<ApiResponse<bool>> Delete(IdRequest request, CancellationToken ct)
    {
        await targets.DeleteAsync(request.Id, ct);
        return Success(true);
    }
}
