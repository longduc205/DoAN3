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

public class ProjectSearchParam : BaseSearchParam
{
    public ProjectStatus? Status { get; set; }
}

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

public class UserSearchParam : BaseSearchParam
{
    public string? Role { get; set; }
}

public class AuditLogSearchParam : BaseSearchParam
{
    public Guid? UserId { get; set; }
    public string? Action { get; set; }
    public string? EntityType { get; set; }
    public AuditResult? Result { get; set; }
    public DateTimeOffset? From { get; set; }
    public DateTimeOffset? To { get; set; }
}

public class ReportSearchParam : BaseSearchParam
{
    public Guid? ProjectId { get; set; }
}

public class VulnerabilitySearchParam : BaseSearchParam
{
    public Guid? ProjectId { get; set; }
    public Severity? Severity { get; set; }
    public VulnerabilityStatus? Status { get; set; }
    /// <summary>true = only open statuses (default list), false = only closed, null = all.</summary>
    public bool? IsOpen { get; set; }
    public string? FindingType { get; set; }
    public Guid? AssigneeId { get; set; }
    /// <summary>"My items" view.</summary>
    public bool AssignedToMe { get; set; }
}

public class FindingSearchParam : BaseSearchParam
{
    public Guid ScanId { get; set; }
    public Severity? Severity { get; set; }
}
