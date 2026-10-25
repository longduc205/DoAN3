namespace WebSec.Shared.Enums;

public static class Permissions
{
    public const string ProjectView = "Project.View";
    public const string ProjectCreate = "Project.Create";
    public const string ProjectUpdate = "Project.Update";
    public const string ScanCreate = "Scan.Create";
    public const string ScanView = "Scan.View";
    public const string VulnerabilityView = "Vulnerability.View";
    public const string VulnerabilityUpdate = "Vulnerability.Update";
    public const string ReportGenerate = "Report.Generate";
    public const string AiAsk = "AI.Ask";
    public const string UserManage = "User.Manage";
    public const string RoleManage = "Role.Manage";

    public static readonly string[] All =
    [
        ProjectView, ProjectCreate, ProjectUpdate, ScanCreate, ScanView, VulnerabilityView,
        VulnerabilityUpdate, ReportGenerate, AiAsk, UserManage, RoleManage,
    ];
}

public static class Roles
{
    public const string Admin = "Admin";
    public const string SecurityAnalyst = "SecurityAnalyst";
    public const string Developer = "Developer";
    public const string Viewer = "Viewer";

    /// <summary>Default permission matrix used by the seed and by tests.</summary>
    public static readonly IReadOnlyDictionary<string, string[]> DefaultPermissions = new Dictionary<string, string[]>
    {
        [Admin] = Permissions.All,
        [SecurityAnalyst] =
        [
            Permissions.ProjectView, Permissions.ProjectCreate, Permissions.ProjectUpdate, Permissions.ScanCreate,
            Permissions.ScanView, Permissions.VulnerabilityView, Permissions.VulnerabilityUpdate,
            Permissions.ReportGenerate, Permissions.AiAsk,
        ],
        [Developer] = [Permissions.ProjectView, Permissions.ScanView, Permissions.VulnerabilityView, Permissions.VulnerabilityUpdate, Permissions.AiAsk],
        [Viewer] = [Permissions.ProjectView, Permissions.ScanView, Permissions.VulnerabilityView],
    };
}
