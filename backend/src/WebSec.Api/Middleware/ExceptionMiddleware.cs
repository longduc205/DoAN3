using System.Diagnostics;
using WebSec.Shared.Errors;
using WebSec.Shared.Responses;

namespace WebSec.Api.Middleware;

/// <summary>Maps exceptions to the common response wrapper. Never leaks stack traces, SQL or secrets to clients.</summary>
public class ExceptionMiddleware(RequestDelegate next, ILogger<ExceptionMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (AppException ex)
        {
            await WriteAsync(context, ex.StatusCode, ex.Code, ex.Message);
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            // Client went away; nothing to write.
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unhandled exception for {Method} {Path}", context.Request.Method, context.Request.Path);
            await WriteAsync(context, StatusCodes.Status500InternalServerError, ErrorCodes.InternalError, "An unexpected error occurred.");
        }
    }

    public static Task WriteAsync(HttpContext context, int status, string code, string message)
    {
        if (context.Response.HasStarted) return Task.CompletedTask;
        context.Response.StatusCode = status;
        var body = ApiResponse<object?>.Fail(code, message);
        body.TraceId = Activity.Current?.TraceId.ToString() ?? context.TraceIdentifier;
        return context.Response.WriteAsJsonAsync(body);
    }
}
