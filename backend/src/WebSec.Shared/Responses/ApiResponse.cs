namespace WebSec.Shared.Responses;

public class ApiResponse<T>
{
    public bool Success { get; init; }
    public T? Data { get; init; }
    public string? Message { get; init; }
    public string? Code { get; init; }
    public string? TraceId { get; set; }

    public static ApiResponse<T> Ok(T data, string? message = null) => new() { Success = true, Data = data, Message = message };
    public static ApiResponse<T> Fail(string code, string message) => new() { Success = false, Code = code, Message = message };
}

public sealed class PagingInfo
{
    public int Page { get; init; }
    public int PageSize { get; init; }
    public long TotalItems { get; init; }
    public int TotalPages { get; init; }
}

public sealed class PaginatedResponse<T> : ApiResponse<T>
{
    public PagingInfo? Paging { get; init; }
}

/// <summary>Service-level page result; controllers wrap it into <see cref="PaginatedResponse{T}"/>.</summary>
public sealed record PagedResult<T>(IReadOnlyList<T> Items, int Page, int PageSize, long TotalItems)
{
    public int TotalPages => PageSize == 0 ? 0 : (int)Math.Ceiling(TotalItems / (double)PageSize);
}
