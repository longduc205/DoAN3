using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace WebSec.Infrastructure.Security;

public sealed class JwtOptions
{
    public string Issuer { get; set; } = "WebSecPlatform";
    public string Audience { get; set; } = "WebSecPlatformClient";
    public string SigningKey { get; set; } = string.Empty;
    public int AccessTokenMinutes { get; set; } = 60;

    public SymmetricSecurityKey GetKey() => new(Encoding.UTF8.GetBytes(SigningKey));
}

public static class AppClaims
{
    public const string Permission = "perm";
}

public sealed class JwtTokenService(JwtOptions options)
{
    public (string Token, DateTimeOffset ExpiresAt) CreateToken(Guid userId, string userName, IEnumerable<string> roles, IEnumerable<string> permissions)
    {
        var expires = DateTimeOffset.UtcNow.AddMinutes(options.AccessTokenMinutes);
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, userId.ToString()),
            new(JwtRegisteredClaimNames.UniqueName, userName),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
        };
        claims.AddRange(roles.Select(r => new Claim(ClaimTypes.Role, r)));
        claims.AddRange(permissions.Select(p => new Claim(AppClaims.Permission, p)));

        var token = new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
        {
            Issuer = options.Issuer,
            Audience = options.Audience,
            Subject = new ClaimsIdentity(claims),
            Expires = expires.UtcDateTime,
            SigningCredentials = new SigningCredentials(options.GetKey(), SecurityAlgorithms.HmacSha256),
        });
        return (token, expires);
    }
}
