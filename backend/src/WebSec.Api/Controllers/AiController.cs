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
    [HttpPost("explain-vulnerability")]
    public async Task<ApiResponse<AiAdviceModel>> Explain(AiFindingRequest request, CancellationToken ct) =>
        Success(await ai.ExplainFindingAsync(request.FindingId, ct));

    [HttpPost("suggest-remediation")]
    public async Task<ApiResponse<AiAdviceModel>> SuggestRemediation(AiFindingRequest request, CancellationToken ct) =>
        Success(await ai.SuggestRemediationAsync(request.FindingId, ct));
}
