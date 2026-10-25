using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WebSec.Infrastructure.Interfaces;
using WebSec.Shared.DTOs;
using WebSec.Shared.Enums;
using WebSec.Shared.Models;
using WebSec.Shared.Params;
using WebSec.Shared.Responses;

namespace WebSec.Api.Controllers;

[Route("api/projects")]
public class ProjectsController(IProjectService projects) : ApiControllerBase
{
    [HttpPost("get-all"), Authorize(Policy = Permissions.ProjectView)]
    public async Task<PaginatedResponse<IReadOnlyList<ProjectModel>>> GetAll(ProjectSearchParam param, CancellationToken ct) =>
        Paged(await projects.GetAllAsync(param, ct));

    [HttpPost("get-by-id"), Authorize(Policy = Permissions.ProjectView)]
    public async Task<ApiResponse<ProjectModel>> GetById(IdRequest request, CancellationToken ct) =>
        Success(await projects.GetByIdAsync(request.Id, ct));

    [HttpPost("create"), Authorize(Policy = Permissions.ProjectCreate)]
    public async Task<ApiResponse<ProjectModel>> Create(CreateProjectRequest request, CancellationToken ct) =>
        Success(await projects.CreateAsync(request, ct));

    [HttpPost("update"), Authorize(Policy = Permissions.ProjectUpdate)]
    public async Task<ApiResponse<ProjectModel>> Update(UpdateProjectRequest request, CancellationToken ct) =>
        Success(await projects.UpdateAsync(request, ct));

    [HttpPost("delete"), Authorize(Policy = Permissions.ProjectUpdate)]
    public async Task<ApiResponse<bool>> Delete(IdRequest request, CancellationToken ct)
    {
        await projects.DeleteAsync(request.Id, ct);
        return Success(true);
    }
}
