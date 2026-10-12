using Microsoft.EntityFrameworkCore;

namespace ResellerApi.MediaService.Data;

// Read-only mappings for business access, storefront origins, and image-reference checks.
// Schema ownership and migrations stay with the main ResellerApi project.
public class MediaDbContext : DbContext
{
    public MediaDbContext(DbContextOptions<MediaDbContext> options) : base(options) { }

    public DbSet<BusinessUserRow> BusinessUsers => Set<BusinessUserRow>();
    public DbSet<ProductRow> Products => Set<ProductRow>();
    public DbSet<BusinessRow> Businesses => Set<BusinessRow>();

    public DbSet<ProductImageRow> ProductImages => Set<ProductImageRow>();
    public DbSet<ProductVariantRow> ProductVariants => Set<ProductVariantRow>();

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

        modelBuilder.Entity<ProductImageRow>().ToTable("product_images").HasKey(x => x.Id);
        modelBuilder.Entity<ProductVariantRow>().ToTable("product_variants").HasKey(x => x.Id);

        modelBuilder.Entity<BusinessRow>(e =>
        {
            e.ToTable("businesses");
            e.HasKey(x => x.Id);
        });
    }
}

public class BusinessRow
{
    public Guid Id { get; set; }
    public bool StorefrontEnabled { get; set; }
    public string? ExternalWebsiteUrl { get; set; }
    public DateTime? DeletedAt { get; set; }
}

public class BusinessUserRow
{
    public Guid BusinessId { get; set; }
    public Guid UserId { get; set; }
}

public class ProductRow
{
    public Guid Id { get; set; }
    public string? ImageUrl { get; set; }
    public Guid BusinessId { get; set; }
    public DateTime? DeletedAt { get; set; }
}

public class ProductImageRow
{
    public Guid Id { get; set; }
    public string ImageUrl { get; set; } = "";
    public DateTime? DeletedAt { get; set; }
}
public class ProductVariantRow
{
    public Guid Id { get; set; }
    public string? ImageUrl { get; set; }
}
