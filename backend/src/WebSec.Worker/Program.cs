using WebSec.Infrastructure;
using WebSec.Worker.HostedServices;

var builder = Host.CreateApplicationBuilder(args);
builder.Logging.AddJsonConsole(o => o.IncludeScopes = true);

builder.Services.AddInfrastructure(builder.Configuration, builder.Environment);
builder.Services.AddHostedService<ScanWorker>();

var host = builder.Build();
host.Run();
