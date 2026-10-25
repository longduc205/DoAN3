using System.Net;
using WebSec.Infrastructure.AI;
using WebSec.Infrastructure.Scanning;
using WebSec.Shared.Entities;
using WebSec.Shared.Enums;
using WebSec.Shared.Params;

namespace WebSec.UnitTests;

public class CoreRulesTests
{
    [Theory]
    [InlineData(0, 0, 1, 10)]
    [InlineData(-5, 500, 1, 100)]
    [InlineData(3, 25, 3, 25)]
    public void SearchParam_Normalize_ClampsPaging(int page, int size, int expectedPage, int expectedSize)
    {
        var p = new BaseSearchParam { Page = page, PageSize = size, Keyword = "  " };
        p.Normalize();
        Assert.Equal(expectedPage, p.Page);
        Assert.Equal(expectedSize, p.PageSize);
        Assert.Null(p.Keyword);
    }

    [Theory]
    [InlineData(ScanStatus.Queued, ScanStatus.Running, true)]
    [InlineData(ScanStatus.Running, ScanStatus.Completed, true)]
    [InlineData(ScanStatus.Running, ScanStatus.Cancelling, true)]
    [InlineData(ScanStatus.Completed, ScanStatus.Running, false)]
    [InlineData(ScanStatus.Pending, ScanStatus.Completed, false)]
    [InlineData(ScanStatus.Cancelled, ScanStatus.Queued, false)]
    public void ScanStateMachine_ValidatesTransitions(ScanStatus from, ScanStatus to, bool expected) =>
        Assert.Equal(expected, ScanStateMachine.CanTransition(from, to));

    [Fact]
    public void PermissionMatrix_ViewerCannotWrite_AdminHasAll()
    {
        Assert.DoesNotContain(Permissions.ProjectCreate, Roles.DefaultPermissions[Roles.Viewer]);
        Assert.DoesNotContain(Permissions.ScanCreate, Roles.DefaultPermissions[Roles.Developer]);
        Assert.Equal(Permissions.All.Order(), Roles.DefaultPermissions[Roles.Admin].Order());
        Assert.All(Roles.DefaultPermissions.Values.SelectMany(p => p), p => Assert.Contains(p, Permissions.All));
    }

    [Theory]
    [InlineData("ftp://lab.local/")]
    [InlineData("http://user:pass@lab.local/")]
    [InlineData("not a url")]
    [InlineData("http://lab.local/?q=1")]
    public void UrlSyntax_RejectsUnsafeUrls(string url) => Assert.NotNull(TargetScopeValidator.ValidateUrlSyntax(url, out _));

    [Theory]
    [InlineData("127.0.0.1", true)]
    [InlineData("10.1.2.3", true)]
    [InlineData("172.20.0.1", true)]
    [InlineData("192.168.1.1", true)]
    [InlineData("169.254.169.254", true)]
    [InlineData("::1", true)]
    [InlineData("93.184.216.34", false)]
    public void PrivateAddressDetection(string ip, bool expected) =>
        Assert.Equal(expected, TargetScopeValidator.IsPrivateOrLocal(IPAddress.Parse(ip)));

    [Fact]
    public async Task ScopeValidator_RejectsPrivateTarget_UnlessAllowed()
    {
        var target = new Target { BaseUrl = "http://127.0.0.1:3000/", IsEnabled = true, IsAuthorized = true };
        Assert.NotNull(await new TargetScopeValidator(new ScanSafetyOptions()).ValidateAsync(target, default));
        Assert.Null(await new TargetScopeValidator(new ScanSafetyOptions { AllowPrivateTargets = true }).ValidateAsync(target, default));
    }

    [Fact]
    public async Task ScopeValidator_RejectsUnauthorizedOrDisabledTarget()
    {
        var allow = new TargetScopeValidator(new ScanSafetyOptions { AllowPrivateTargets = true });
        Assert.NotNull(await allow.ValidateAsync(new Target { BaseUrl = "http://127.0.0.1/", IsEnabled = true, IsAuthorized = false }, default));
        Assert.NotNull(await allow.ValidateAsync(new Target { BaseUrl = "http://127.0.0.1/", IsEnabled = false, IsAuthorized = true }, default));
    }

    [Fact]
    public void EvidenceRedactor_StripsSecrets()
    {
        var output = EvidenceRedactor.Redact("Authorization: Bearer abc.def\nGET /?token=s3cr3t&x=1", out var redacted);
        Assert.True(redacted);
        Assert.DoesNotContain("abc.def", output);
        Assert.DoesNotContain("s3cr3t", output);
        Assert.Contains("x=1", output);
    }

    [Fact]
    public async Task MockAi_ReturnsAdvisoryTypedResponse()
    {
        var ctx = new AiFindingContext("MissingHsts", "Missing HSTS", "http://lab.local/", Severity.Low, "evidence");
        var advice = await new MockAiAdvisor().SuggestRemediationAsync(ctx, default);
        Assert.True(advice.IsAiAssisted);
        Assert.Equal("mock", advice.Provider);
        Assert.Contains("Strict-Transport-Security", advice.Content);
    }
}
