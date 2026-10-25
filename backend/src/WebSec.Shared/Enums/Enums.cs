namespace WebSec.Shared.Enums;

// All enums are persisted as strings (see AppDbContext.ConfigureConventions).
public enum ProjectStatus { Active, Archived }
public enum TargetEnvironment { Lab, Development, Staging, Production }
public enum ScopeMode { ExactUrl, SameHostPathPrefix }
public enum ScanType { Mock, Passive }
public enum ScanStatus { Pending, Queued, Running, Cancelling, Completed, Failed, Cancelled }
public enum ScanJobStatus { Queued, Running, Done, Failed, Cancelled }
public enum Severity { Info, Low, Medium, High, Critical }
public enum Confidence { Low, Medium, High }
public enum SortDirection { Asc, Desc }
