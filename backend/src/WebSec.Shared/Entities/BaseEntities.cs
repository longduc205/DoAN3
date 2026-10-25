namespace WebSec.Shared.Entities;

public abstract class BaseEntity<TId>
{
    public TId Id { get; set; } = default!;
}

public abstract class DeleteEntity<TId> : BaseEntity<TId>
{
    public bool IsDeleted { get; set; }
    public bool Deletable { get; set; } = true;
    public bool IsActive { get; set; } = true;
}

public abstract class AuditEntity<TId> : DeleteEntity<TId>
{
    public DateTimeOffset CreatedDate { get; set; }
    public Guid? CreatedBy { get; set; }
    public DateTimeOffset? UpdatedDate { get; set; }
    public Guid? UpdatedBy { get; set; }
}

public abstract class TempEntity<TId> : AuditEntity<TId>
{
    public string Code { get; set; } = string.Empty;
    public string NameL { get; set; } = string.Empty;
    public string NameE { get; set; } = string.Empty;
}
