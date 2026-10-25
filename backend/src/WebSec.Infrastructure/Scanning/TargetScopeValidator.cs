using System.Net;
using System.Net.Sockets;
using WebSec.Infrastructure.Scanning.Abstractions;
using WebSec.Shared.Entities;

namespace WebSec.Infrastructure.Scanning;

public sealed class ScanSafetyOptions
{
    /// <summary>Opt-in, Development-only: allow loopback/private lab targets. Forced to false outside Development.</summary>
    public bool AllowPrivateTargets { get; set; }
}

public class TargetScopeValidator(ScanSafetyOptions options) : ITargetScopeValidator
{
    public async Task<string?> ValidateAsync(Target target, CancellationToken ct)
    {
        if (target.IsDeleted || !target.IsEnabled) return "Target is disabled.";
        if (!target.IsAuthorized) return "Target has not been confirmed as authorized for testing.";

        var error = ValidateUrlSyntax(target.BaseUrl, out var uri);
        if (error is not null) return error;

        IPAddress[] addresses;
        if (IPAddress.TryParse(uri!.Host, out var literal))
        {
            addresses = [literal];
        }
        else
        {
            try { addresses = await Dns.GetHostAddressesAsync(uri.IdnHost, ct); }
            catch (SocketException) { return "Target host could not be resolved."; }
        }

        if (addresses.Length == 0) return "Target host could not be resolved.";
        if (!options.AllowPrivateTargets && addresses.Any(IsPrivateOrLocal))
            return "Target resolves to a loopback/private/link-local address, which is blocked by configuration.";
        return null;
    }

    /// <summary>Syntax-only checks shared with target create/update.</summary>
    public static string? ValidateUrlSyntax(string? url, out Uri? uri)
    {
        uri = null;
        if (string.IsNullOrWhiteSpace(url) || !Uri.TryCreate(url.Trim(), UriKind.Absolute, out var parsed))
            return "Base URL is not a valid absolute URL.";
        if (parsed.Scheme != Uri.UriSchemeHttp && parsed.Scheme != Uri.UriSchemeHttps)
            return "Only http and https URLs are allowed.";
        if (!string.IsNullOrEmpty(parsed.UserInfo)) return "URLs with embedded credentials are not allowed.";
        if (!string.IsNullOrEmpty(parsed.Fragment) || !string.IsNullOrEmpty(parsed.Query))
            return "Base URL must not contain a query string or fragment.";
        uri = parsed;
        return null;
    }

    public static bool IsPrivateOrLocal(IPAddress ip)
    {
        if (ip.IsIPv4MappedToIPv6) ip = ip.MapToIPv4();
        if (IPAddress.IsLoopback(ip) || ip.Equals(IPAddress.Any) || ip.Equals(IPAddress.IPv6Any)) return true;
        if (ip.AddressFamily == AddressFamily.InterNetworkV6)
            return ip.IsIPv6LinkLocal || ip.IsIPv6SiteLocal || ip.IsIPv6UniqueLocal;

        var b = ip.GetAddressBytes();
        return b[0] == 10
            || (b[0] == 172 && b[1] >= 16 && b[1] <= 31)
            || (b[0] == 192 && b[1] == 168)
            || (b[0] == 169 && b[1] == 254)
            || (b[0] == 100 && b[1] >= 64 && b[1] <= 127) // carrier-grade NAT
            || b[0] == 0;
    }
}
