using Microsoft.EntityFrameworkCore;

namespace ResellerApi.MediaService.Data;

// Deliberately not a clone of AppDbContext — this service only ever needs to answer two
// questions ("does this user belong to this business" / "which business owns this product"),
// so it maps just the two existing tables it reads, read-only, with no migrations of its own.
// Schema ownership (and EF migrations) stays entirely with the main ResellerApi project.
public class MediaDbContext : DbContext
{
    public MediaDbContext(DbContextOptions<MediaDbContext> options) : base(options) { }

    public DbSet<BusinessUserRow> BusinessUsers => Set<BusinessUserRow>();
    public DbSet<ProductRow> Products => Set<ProductRow>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<BusinessUserRow>(e =>
        {
            e.ToTable("business_users");
            e.HasKey(x => new { x.BusinessId, x.UserId });
        });

        modelBuilder.Entity<ProductRow>(e =>
        {
            e.ToTable("products");
            e.HasKey(x => x.Id);
        });
    }
}

public class BusinessUserRow
{
    public Guid BusinessId { get; set; }
    public Guid UserId { get; set; }
}

public class ProductRow
{
    public Guid Id { get; set; }
    public Guid BusinessId { get; set; }
    public DateTime? DeletedAt { get; set; }
}
