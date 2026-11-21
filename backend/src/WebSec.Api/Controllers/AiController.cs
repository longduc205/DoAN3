using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using WebSec.Api.Extensions;
using WebSec.Infrastructure.Interfaces;
using WebSec.Shared.DTOs;
using WebSec.Shared.Enums;
using WebSec.Shared.Models;
using WebSec.Shared.Responses;

namespace WebSec.Api.Controllers;

[Route("api/ai"), Authorize(Policy = Permissions.AiAsk), EnableRateLimiting(ApiServiceExtensions.AiRateLimit)]
public class AiController(IAiService ai) : ApiControllerBase
{
    /// <summary>Preview of exactly what would be sent to the provider; does not call it.</summary>
    [HttpPost("get-context")]
    public async Task<ApiResponse<AiContextModel>> GetContext(AiFindingRequest request, CancellationToken ct) =>
        Success(await ai.GetContextAsync(request, ct));

    [HttpPost("explain-vulnerability")]
    public async Task<ApiResponse<AiAdviceModel>> Explain(AiFindingRequest request, CancellationToken ct) =>
        Success(await ai.ExplainFindingAsync(request, ct));

    /// <summary>AI Assistant: question about one vulnerability (read-only; never changes status or severity).</summary>
    [HttpPost("ask")]
    public async Task<ApiResponse<AiAdviceModel>> Ask(AiAskRequest request, CancellationToken ct) =>
        Success(await ai.AskAsync(request, ct));

    [HttpPost("suggest-remediation")]
    public async Task<ApiResponse<AiAdviceModel>> SuggestRemediation(AiFindingRequest request, CancellationToken ct) =>
        Success(await ai.SuggestRemediationAsync(request, ct));
}
