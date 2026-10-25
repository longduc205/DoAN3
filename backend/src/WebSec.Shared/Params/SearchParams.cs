using WebSec.Shared.Enums;

namespace WebSec.Shared.Params;

public class BaseSearchParam
{
    public const int DefaultPageSize = 10;
    public const int MaxPageSize = 100;

    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = DefaultPageSize;
    public string? Keyword { get; set; }
    public string? SortBy { get; set; }
    public SortDirection SortDirection { get; set; } = SortDirection.Desc;
    public bool? IsActive { get; set; }

    /// <summary>Invalid paging values are normalized, not rejected: Page below 1 becomes 1, PageSize is clamped to 1..100.</summary>
    public void Normalize()
    {
        if (Page < 1) Page = 1;
        if (PageSize < 1) PageSize = DefaultPageSize;
        if (PageSize > MaxPageSize) PageSize = MaxPageSize;
        Keyword = string.IsNullOrWhiteSpace(Keyword) ? null : Keyword.Trim();
    }
}

public class ProjectSearchParam : BaseSearchParam;

public class TargetSearchParam : BaseSearchParam
{
    public Guid? ProjectId { get; set; }
}

public class ScanSearchParam : BaseSearchParam
{
    public Guid? ProjectId { get; set; }
    public Guid? TargetId { get; set; }
    public ScanStatus? Status { get; set; }
}

public class FindingSearchParam : BaseSearchParam
{
    public Guid ScanId { get; set; }
    public Severity? Severity { get; set; }
}
