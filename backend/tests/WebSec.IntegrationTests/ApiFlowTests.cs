using System.Net;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using WebSec.Infrastructure.Data;
using WebSec.Shared.Enums;
using WebSec.Shared.Errors;
using WebSec.Shared.Models;

namespace WebSec.IntegrationTests;

[Collection(ApiCollection.Name)]
public class ApiFlowTests(ApiFixture api)
{
    [Theory]
    [InlineData("/health/live")]
    [InlineData("/health/ready")] // checks the database
    public async Task Health_endpoints_return_200(string path)
    {
        var res = await api.CreateClient().GetAsync(path);
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
    }

    [Fact]
    public async Task Login_with_wrong_password_returns_401_and_no_token()
    {
        var (res, body) = await api.CreateClient().PostAsync<LoginResult>("/api/auth/login", new { userName = "admin", password = "wrong-password" });
        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
        Assert.False(body.Success);
        Assert.Equal(ErrorCodes.Unauthorized, body.Code);
        Assert.Null(body.Data);
    }

    [Fact]
    public async Task Login_success_gives_a_token_that_auth_me_accepts()
    {
        var (res, body) = await (await api.AdminAsync()).PostAsync<CurrentUserModel>("/api/auth/me", new { });
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Equal("admin", body.Data!.UserName);
        Assert.Contains(Roles.Admin, body.Data.Roles);
    }

    [Fact]
    public async Task Request_without_token_returns_401()
    {
        var (res, body) = await api.CreateClient().PostAsync<object>("/api/projects/get-all", new { });
        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
        Assert.Equal(ErrorCodes.Unauthorized, body.Code);
    }

    [Fact]
    public async Task Viewer_cannot_create_a_project_403()
    {
        var viewer = await api.ClientAsAsync("viewer", "Viewer@12345");
        var (res, body) = await viewer.PostAsync<ProjectModel>("/api/projects/create", new { code = NewCode(), name = "Should not exist" });
        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
        Assert.Equal(ErrorCodes.Forbidden, body.Code);
    }

    [Fact]
    public async Task Project_create_list_update_delete_is_a_soft_delete()
    {
        var admin = await api.AdminAsync();
        var code = NewCode();

        var (created, project) = await admin.PostAsync<ProjectModel>("/api/projects/create", new { code, name = "IT project" });
        Assert.Equal(HttpStatusCode.OK, created.StatusCode);
        var id = project.Data!.Id;

        // sortBy=risk and environment run as SQL subqueries, so exercise them on real PostgreSQL.
        var (listed, list) = await admin.PostAsync<List<ProjectModel>>("/api/projects/get-all", new { keyword = code, sortBy = "risk" });
        Assert.Equal(HttpStatusCode.OK, listed.StatusCode);
        Assert.Contains(list.Data!, p => p.Id == id);
        var (_, byEnv) = await admin.PostAsync<List<ProjectModel>>("/api/projects/get-all", new { keyword = code, environment = "Staging" });
        Assert.DoesNotContain(byEnv.Data!, p => p.Id == id); // no targets yet

        var (updated, renamed) = await admin.PostAsync<ProjectModel>("/api/projects/update", new { id, code, name = "IT project renamed", status = "Active" });
        Assert.Equal(HttpStatusCode.OK, updated.StatusCode);
        Assert.Equal("IT project renamed", renamed.Data!.Name);

        var (deleted, _) = await admin.PostAsync<object>("/api/projects/delete", new { id });
        Assert.Equal(HttpStatusCode.OK, deleted.StatusCode);

        var (gone, goneBody) = await admin.PostAsync<ProjectModel>("/api/projects/get-by-id", new { id });
        Assert.Equal(HttpStatusCode.NotFound, gone.StatusCode);
        Assert.Equal(ErrorCodes.NotFound, goneBody.Code);
        var (_, listAfter) = await admin.PostAsync<List<ProjectModel>>("/api/projects/get-all", new { keyword = code });
        Assert.DoesNotContain(listAfter.Data!, p => p.Id == id);

        // The row is still there, only flagged.
        await using var scope = api.Services.CreateAsyncScope();
        var row = await scope.ServiceProvider.GetRequiredService<AppDbContext>().Projects.IgnoreQueryFilters().SingleAsync(p => p.Id == id);
        Assert.True(row.IsDeleted);
    }

    [Fact]
    public async Task Scan_goes_queued_to_completed_through_the_worker_and_has_findings()
    {
        var admin = await api.AdminAsync();
        var targetId = await CreateTargetAsync(admin, isAuthorized: true);

        var (created, scan) = await admin.PostAsync<ScanModel>("/api/scans/create", new { targetId });
        Assert.Equal(HttpStatusCode.OK, created.StatusCode);
        Assert.Equal(ScanStatus.Queued, scan.Data!.Status);
        var scanId = scan.Data.Id;

        await api.DrainScanQueueAsync();

        var (_, progress) = await admin.PostAsync<ScanProgressModel>("/api/scans/get-progress", new { id = scanId });
        Assert.Equal(ScanStatus.Completed, progress.Data!.Status);
        Assert.True(progress.Data.IsTerminal);
        Assert.Equal(100, progress.Data.ProgressPercent);

        var (_, findings) = await admin.PostAsync<List<ScanFindingModel>>("/api/scans/get-findings", new { scanId, pageSize = 100 });
        Assert.NotEmpty(findings.Data!);
        Assert.Equal(progress.Data.TotalFindings, findings.Data!.Count);
        Assert.All(findings.Data!, f => Assert.NotNull(f.VulnerabilityId)); // synced into vulnerabilities
    }

    [Fact]
    public async Task Scan_on_unauthorized_target_is_rejected_before_anything_is_queued()
    {
        var admin = await api.AdminAsync();
        var targetId = await CreateTargetAsync(admin, isAuthorized: false);

        var (res, body) = await admin.PostAsync<ScanModel>("/api/scans/create", new { targetId });
        Assert.Equal(HttpStatusCode.UnprocessableEntity, res.StatusCode);
        Assert.Equal(ErrorCodes.ScanScopeRejected, body.Code);

        await using var scope = api.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.False(await db.Scans.IgnoreQueryFilters().AnyAsync(s => s.TargetId == targetId));
        Assert.False(await db.ScanJobs.AnyAsync(j => db.Scans.IgnoreQueryFilters().Any(s => s.Id == j.ScanId && s.TargetId == targetId)));
    }

    private static string NewCode() => $"IT-{Guid.NewGuid():N}"[..11];

    private static async Task<Guid> CreateTargetAsync(HttpClient admin, bool isAuthorized)
    {
        var (_, project) = await admin.PostAsync<ProjectModel>("/api/projects/create", new { code = NewCode(), name = "IT scan project" });
        // Loopback literal: no DNS, allowed only because tests run in Development with ALLOW_PRIVATE_TARGETS; the mock engine sends no traffic.
        var (res, target) = await admin.PostAsync<TargetModel>("/api/targets/create", new
        {
            projectId = project.Data!.Id, name = "IT lab", baseUrl = "http://127.0.0.1:9/app/", isEnabled = true, isAuthorized,
        });
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        return target.Data!.Id;
    }
}
