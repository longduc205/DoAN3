namespace WebSec.Shared.Errors;

public static class ErrorCodes
{
    public const string ValidationError = "VALIDATION_ERROR";
    public const string Unauthorized = "UNAUTHORIZED";
    public const string Forbidden = "FORBIDDEN";
    public const string NotFound = "NOT_FOUND";
    public const string Conflict = "CONFLICT";
    public const string ScanScopeRejected = "SCAN_SCOPE_REJECTED";
    public const string AiProviderUnavailable = "AI_PROVIDER_UNAVAILABLE";
    public const string RateLimited = "RATE_LIMITED";
    public const string InternalError = "INTERNAL_ERROR";
}

/// <summary>Business exception carrying a stable error code and a client-safe message.</summary>
public class AppException(string code, string message, int statusCode) : Exception(message)
{
    public string Code { get; } = code;
    public int StatusCode { get; } = statusCode;

    public static AppException NotFound(string what = "resource") => new(ErrorCodes.NotFound, $"The requested {what} was not found.", 404);
    public static AppException Forbidden() => new(ErrorCodes.Forbidden, "You do not have access to this resource.", 403);
    public static AppException Validation(string message) => new(ErrorCodes.ValidationError, message, 400);
    public static AppException Conflict(string message) => new(ErrorCodes.Conflict, message, 409);
    public static AppException ScopeRejected(string message) => new(ErrorCodes.ScanScopeRejected, message, 422);
    public static AppException Unauthorized(string message) => new(ErrorCodes.Unauthorized, message, 401);
}
