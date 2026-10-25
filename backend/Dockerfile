FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY . .
RUN dotnet publish src/WebSec.Api -c Release -o /out/api && dotnet publish src/WebSec.Worker -c Release -o /out/worker

FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine AS api
WORKDIR /app
COPY --from=build /out/api .
USER app
ENTRYPOINT ["dotnet", "WebSec.Api.dll"]

FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine AS worker
WORKDIR /app
COPY --from=build /out/worker .
USER app
ENTRYPOINT ["dotnet", "WebSec.Worker.dll"]
