using System.Text.RegularExpressions;

namespace WebSec.Infrastructure.Scanning;

/// <summary>Strips credentials/tokens from evidence before it is persisted, logged or sent to AI.</summary>
public static partial class EvidenceRedactor
{
    [GeneratedRegex(@"(?im)^(authorization|cookie|set-cookie|x-api-key|proxy-authorization)\s*:.*$")]
    private static partial Regex SensitiveHeader();

    [GeneratedRegex(@"(?i)\b(password|passwd|pwd|token|access_token|refresh_token|api_key|apikey|secret|session(id)?)=([^&\s]+)")]
    private static partial Regex SensitiveParam();

    [GeneratedRegex(@"(?i)\bbearer\s+[a-z0-9\-._~+/]+=*")]
    private static partial Regex BearerToken();

    public static string Redact(string input, out bool redacted)
    {
        var output = SensitiveHeader().Replace(input, m => m.Groups[1].Value + ": [REDACTED]");
        output = SensitiveParam().Replace(output, m => m.Groups[1].Value + "=[REDACTED]");
        output = BearerToken().Replace(output, "Bearer [REDACTED]");
        redacted = output != input;
        return output;
    }
}
