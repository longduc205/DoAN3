using Microsoft.AspNetCore.Http;
using Microsoft.IdentityModel.JsonWebTokens;
using WebSec.Infrastructure.Interfaces;

namespace WebSec.Infrastructure.Security;

public class HttpCurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    public Guid? UserId =>
        Guid.TryParse(accessor.HttpContext?.User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value, out var id) ? id : null;

    public bool IsInRole(string role) => accessor.HttpContext?.User.IsInRole(role) ?? false;
}
