using Riok.Mapperly.Abstractions;
using WebSec.Shared.DTOs;
using WebSec.Shared.Entities;
using WebSec.Shared.Models;

namespace WebSec.Infrastructure.Mapping;

// Only unmapped *target* members are reported; entities intentionally carry fields the models hide.
[Mapper(RequiredMappingStrategy = RequiredMappingStrategy.Target)]
public static partial class AppMapper
{
    // Summary counts are filled by ProjectService.GetAllAsync.
    [MapperIgnoreTarget(nameof(ProjectModel.TargetCount))]
    [MapperIgnoreTarget(nameof(ProjectModel.UnauthorizedTargetCount))]
    [MapperIgnoreTarget(nameof(ProjectModel.FindingCount))]
    [MapperIgnoreTarget(nameof(ProjectModel.IsScanning))]
    [MapperIgnoreTarget(nameof(ProjectModel.LastScanAt))]
    public static partial ProjectModel ToModel(this Project entity);

    [MapperIgnoreSource(nameof(Target.Project))]
    public static partial TargetModel ToModel(this Target entity);

    // TargetName / TargetBaseUrl are flattened from Scan.Target by Mapperly's naming convention.
    [MapperIgnoreSource(nameof(Scan.RequestedBy))]
    public static partial ScanModel ToModel(this Scan entity);

    [MapperIgnoreSource(nameof(ScanFinding.Fingerprint))]
    public static partial ScanFindingModel ToModel(this ScanFinding entity);

    // Request -> entity: only copy user-editable fields; ids, ownership and audit fields are set by services.
    [MapperIgnoreTarget(nameof(Target.Id))]
    [MapperIgnoreTarget(nameof(Target.Project))]
    [MapperIgnoreTarget(nameof(Target.LastScanAt))]
    [MapperIgnoreTarget(nameof(Target.IsDeleted))]
    [MapperIgnoreTarget(nameof(Target.Deletable))]
    [MapperIgnoreTarget(nameof(Target.IsActive))]
    [MapperIgnoreTarget(nameof(Target.CreatedDate))]
    [MapperIgnoreTarget(nameof(Target.CreatedBy))]
    [MapperIgnoreTarget(nameof(Target.UpdatedDate))]
    [MapperIgnoreTarget(nameof(Target.UpdatedBy))]
    public static partial void ApplyTo(this CreateTargetRequest request, Target entity);
}
