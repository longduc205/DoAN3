using System.Diagnostics;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WebSec.Shared.Responses;

namespace WebSec.Api.Controllers;

[ApiController]
[Authorize]
[Produces("application/json")]
public abstract class ApiControllerBase : ControllerBase
{
    private string TraceId => Activity.Current?.TraceId.ToString() ?? HttpContext.TraceIdentifier;

    protected ApiResponse<T> Success<T>(T data, string? message = null)
    {
        var response = ApiResponse<T>.Ok(data, message);
        response.TraceId = TraceId;
        return response;
    }

    protected PaginatedResponse<IReadOnlyList<T>> Paged<T>(PagedResult<T> page) => new()
    {
        Success = true,
        Data = page.Items,
        Paging = new PagingInfo { Page = page.Page, PageSize = page.PageSize, TotalItems = page.TotalItems, TotalPages = page.TotalPages },
        TraceId = TraceId,
    };
}
