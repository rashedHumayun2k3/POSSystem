using Microsoft.EntityFrameworkCore;
using ResellerApi.Entities;
using ResellerApi.Entities.Base;
using ResellerApi.Infrastructure;

namespace ResellerApi.Data;

public class AppDbContext : DbContext
{
    private readonly IBusinessContext _businessContext;

    public AppDbContext(DbContextOptions<AppDbContext> options, IBusinessContext businessContext)
        : base(options)
    {
        _businessContext = businessContext;
    }

    public Guid CurrentBusinessId => _businessContext.CurrentBusinessId;

    // ── Phase 1 ───────────────────────────────────────────────────────────
    public DbSet<Company> Companies => Set<Company>();
    public DbSet<Business> Businesses => Set<Business>();
    public DbSet<User> Users => Set<User>();
    public DbSet<BusinessUser> BusinessUsers => Set<BusinessUser>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<ActivityLog> ActivityLogs => Set<ActivityLog>();
    public DbSet<AppSetting> AppSettings => Set<AppSetting>();

    // ── Phase 2 ───────────────────────────────────────────────────────────
    public DbSet<Unit> Units => Set<Unit>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<CategoryField> CategoryFields => Set<CategoryField>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<ProductVariant> ProductVariants => Set<ProductVariant>();
    public DbSet<PriceHistory> PriceHistories => Set<PriceHistory>();

    // ── Settings ──────────────────────────────────────────────────────────
    public DbSet<Courier> Couriers => Set<Courier>();
    public DbSet<ExpenseCategory> ExpenseCategories => Set<ExpenseCategory>();

    // ── Phase 3 ───────────────────────────────────────────────────────────
    public DbSet<Supplier> Suppliers => Set<Supplier>();
    public DbSet<PurchaseTrip> PurchaseTrips => Set<PurchaseTrip>();
    public DbSet<PurchaseItem> PurchaseItems => Set<PurchaseItem>();
    public DbSet<PurchaseTripCost> PurchaseTripCosts => Set<PurchaseTripCost>();
    public DbSet<Lot> Lots => Set<Lot>();
    public DbSet<StockMovement> StockMovements => Set<StockMovement>();
    public DbSet<VariantInventory> VariantInventories => Set<VariantInventory>();
    public DbSet<PurchaseReceiveSession> PurchaseReceiveSessions => Set<PurchaseReceiveSession>();
    public DbSet<PurchaseReceiveItem> PurchaseReceiveItems => Set<PurchaseReceiveItem>();

    // ── Carton module ─────────────────────────────────────────────────────
    public DbSet<Carton> Cartons => Set<Carton>();
    public DbSet<CartonItem> CartonItems => Set<CartonItem>();

    // ── Module 15 — Partnership & Capital Ledger (sub-phase 15a) ───────────
    public DbSet<Partner> Partners => Set<Partner>();
    public DbSet<CapitalInjection> CapitalInjections => Set<CapitalInjection>();
    public DbSet<CapitalLedgerEntry> CapitalLedgerEntries => Set<CapitalLedgerEntry>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // ── Rowversion on all BaseEntity tables ────────────────────────────
        foreach (var entity in modelBuilder.Model.GetEntityTypes()
                     .Where(e => typeof(BaseEntity).IsAssignableFrom(e.ClrType)))
        {
            modelBuilder.Entity(entity.ClrType).Property("RowVer").IsRowVersion();
        }

        // ── Soft-delete + business_id filters ──────────────────────────────
        foreach (var entity in modelBuilder.Model.GetEntityTypes()
                     .Where(e => typeof(BaseEntity).IsAssignableFrom(e.ClrType)))
        {
            var param = System.Linq.Expressions.Expression.Parameter(entity.ClrType, "e");
            var deletedAt = System.Linq.Expressions.Expression.Property(param, nameof(BaseEntity.DeletedAt));
            System.Linq.Expressions.Expression body = System.Linq.Expressions.Expression.Equal(
                deletedAt,
                System.Linq.Expressions.Expression.Constant(null, typeof(DateTime?)));

            if (typeof(BusinessScopedEntity).IsAssignableFrom(entity.ClrType))
            {
                var businessId = System.Linq.Expressions.Expression.Property(param, nameof(BusinessScopedEntity.BusinessId));
                var currentBusinessId = System.Linq.Expressions.Expression.Property(
                    System.Linq.Expressions.Expression.Constant(this),
                    nameof(CurrentBusinessId));

                body = System.Linq.Expressions.Expression.AndAlso(
                    body,
                    System.Linq.Expressions.Expression.Equal(businessId, currentBusinessId));
            }

            var filter = System.Linq.Expressions.Expression.Lambda(body, param);
            modelBuilder.Entity(entity.ClrType).HasQueryFilter(filter);
        }

        // ── Company ────────────────────────────────────────────────────────
        modelBuilder.Entity<Company>(e =>
        {
            e.ToTable("companies");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.Name).HasMaxLength(200).IsRequired();
            e.Property(x => x.Status).HasMaxLength(20).IsRequired();
        });

        // ── Business ───────────────────────────────────────────────────────
        modelBuilder.Entity<Business>(e =>
        {
            e.ToTable("businesses");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.Name).HasMaxLength(200).IsRequired();
            e.Property(x => x.Currency).HasMaxLength(10).IsRequired();
            e.HasOne(x => x.Company).WithMany(c => c.Businesses)
                .HasForeignKey(x => x.CompanyId).OnDelete(DeleteBehavior.Restrict);
        });

        // ── User ───────────────────────────────────────────────────────────
        modelBuilder.Entity<User>(e =>
        {
            e.ToTable("users");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.Name).HasMaxLength(200).IsRequired();
            e.Property(x => x.Phone).HasMaxLength(20).IsRequired();
            e.HasIndex(x => x.Phone).IsUnique();
            e.Property(x => x.PasswordHash).HasMaxLength(500).IsRequired();
            e.Property(x => x.Role).HasMaxLength(20).IsRequired();
            e.Property(x => x.MonthlySalary).HasColumnType("DECIMAL(14,2)");
            e.HasOne(x => x.Company).WithMany(c => c.Users)
                .HasForeignKey(x => x.CompanyId).OnDelete(DeleteBehavior.Restrict);
        });

        // ── BusinessUser ───────────────────────────────────────────────────
        modelBuilder.Entity<BusinessUser>(e =>
        {
            e.ToTable("business_users");
            e.HasKey(x => new { x.BusinessId, x.UserId });
            e.HasOne(x => x.Business).WithMany(b => b.BusinessUsers)
                .HasForeignKey(x => x.BusinessId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.User).WithMany(u => u.BusinessUsers)
                .HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        });

        // ── RefreshToken ───────────────────────────────────────────────────
        modelBuilder.Entity<RefreshToken>(e =>
        {
            e.ToTable("refresh_tokens");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.Token).HasMaxLength(500).IsRequired();
            e.HasOne(x => x.User).WithMany(u => u.RefreshTokens)
                .HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        // ── ActivityLog ────────────────────────────────────────────────────
        modelBuilder.Entity<ActivityLog>(e =>
        {
            e.ToTable("activity_logs");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.Action).HasMaxLength(20).IsRequired();
            e.Property(x => x.EntityType).HasMaxLength(100).IsRequired();
            e.HasOne(x => x.Business).WithMany()
                .HasForeignKey(x => x.BusinessId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.User).WithMany()
                .HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        });

        // ── AppSetting ─────────────────────────────────────────────────────
        modelBuilder.Entity<AppSetting>(e =>
        {
            e.ToTable("app_settings");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.Key).HasMaxLength(100).IsRequired();
            e.HasIndex(x => new { x.BusinessId, x.Key }).IsUnique();
        });

        // ── Unit (global lookup, no business_id) ───────────────────────────
        modelBuilder.Entity<Unit>(e =>
        {
            e.ToTable("units");
            e.HasKey(x => x.Code);
            e.Property(x => x.Code).HasMaxLength(20);
            e.Property(x => x.Name).HasMaxLength(50).IsRequired();
        });

        // ── Category ───────────────────────────────────────────────────────
        modelBuilder.Entity<Category>(e =>
        {
            e.ToTable("categories");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.Name).HasMaxLength(100).IsRequired();
            e.Property(x => x.DefaultUnit).HasMaxLength(20);
        });

        // ── CategoryField ──────────────────────────────────────────────────
        modelBuilder.Entity<CategoryField>(e =>
        {
            e.ToTable("category_fields");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.Name).HasMaxLength(100).IsRequired();
            e.Property(x => x.FieldType).HasMaxLength(20).IsRequired();
            e.HasOne(x => x.Category).WithMany(c => c.Fields)
                .HasForeignKey(x => x.CategoryId).OnDelete(DeleteBehavior.Cascade);
        });

        // ── Product ────────────────────────────────────────────────────────
        modelBuilder.Entity<Product>(e =>
        {
            e.ToTable("products");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.Name).HasMaxLength(300).IsRequired();
            e.Property(x => x.Sku).HasMaxLength(50).IsRequired();
            e.HasIndex(x => x.Sku).IsUnique();
            e.Property(x => x.ImageUrl).HasMaxLength(500);
            e.Property(x => x.UnitCode).HasMaxLength(20);
            e.Property(x => x.Status).HasMaxLength(20);
            e.Property(x => x.SellingPrice).HasColumnType("DECIMAL(14,2)");
            e.Property(x => x.MarketPrice).HasColumnType("DECIMAL(14,2)");
            e.Property(x => x.PackagingCostPerUnit).HasColumnType("DECIMAL(14,2)");
            e.HasOne(x => x.Category).WithMany(c => c.Products)
                .HasForeignKey(x => x.CategoryId).OnDelete(DeleteBehavior.Restrict);
        });

        // ── ProductVariant ─────────────────────────────────────────────────
        modelBuilder.Entity<ProductVariant>(e =>
        {
            e.ToTable("product_variants");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.Sku).HasMaxLength(60).IsRequired();
            e.HasIndex(x => x.Sku).IsUnique();
            e.Property(x => x.Barcode).HasMaxLength(100).IsRequired();
            e.HasIndex(x => x.Barcode).IsUnique();
            e.Property(x => x.PriceOverride).HasColumnType("DECIMAL(14,2)");
            e.Property(x => x.AvgLandedCost).HasColumnType("DECIMAL(14,2)");
            e.HasOne(x => x.Product).WithMany(p => p.Variants)
                .HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
        });

        // ── PriceHistory ───────────────────────────────────────────────────
        modelBuilder.Entity<PriceHistory>(e =>
        {
            e.ToTable("price_history");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.OldPrice).HasColumnType("DECIMAL(14,2)");
            e.Property(x => x.NewPrice).HasColumnType("DECIMAL(14,2)");
            e.Property(x => x.Reason).HasMaxLength(500).IsRequired();
            e.HasOne(x => x.Variant).WithMany(v => v.PriceHistories)
                .HasForeignKey(x => x.VariantId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.ChangedByUser).WithMany()
                .HasForeignKey(x => x.ChangedBy).OnDelete(DeleteBehavior.Restrict);
            e.Property(x => x.IsApplied).HasDefaultValue(false);
            e.HasIndex(x => new { x.VariantId, x.EffectiveFrom });
            e.HasIndex(x => new { x.IsScheduled, x.IsApplied });
        });

        // ── PurchaseTrip ────────────────────────────────────────────────────
        modelBuilder.Entity<PurchaseTrip>(e =>
        {
            e.ToTable("purchase_trips");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.TripNo).HasMaxLength(20).IsRequired();
            e.HasIndex(x => new { x.BusinessId, x.TripNo }).IsUnique();
            e.Property(x => x.SourceType).HasMaxLength(30).IsRequired();
            e.Property(x => x.Status).HasMaxLength(20).IsRequired();
            e.Property(x => x.Note).HasMaxLength(500);
            e.Property(x => x.ForceCompleteReason).HasMaxLength(500);
            e.HasOne(x => x.CreatedByUser).WithMany()
                .HasForeignKey(x => x.CreatedBy).OnDelete(DeleteBehavior.Restrict);
        });

        // ── PurchaseItem ────────────────────────────────────────────────────
        modelBuilder.Entity<PurchaseItem>(e =>
        {
            e.ToTable("purchase_items");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.QtyBought).HasColumnType("DECIMAL(12,3)");
            e.Property(x => x.QtyUsable).HasColumnType("DECIMAL(12,3)");
            e.Property(x => x.QtyDamaged).HasColumnType("DECIMAL(12,3)");
            e.Property(x => x.TotalCost).HasColumnType("DECIMAL(14,2)");
            e.Property(x => x.PaidNow).HasColumnType("DECIMAL(14,2)");
            e.Property(x => x.DueAmount).HasColumnType("DECIMAL(14,2)");
            e.Property(x => x.AllocatedSharedCost).HasColumnType("DECIMAL(14,2)");
            e.Property(x => x.LandedUnitCost).HasColumnType("DECIMAL(14,2)");
            e.Property(x => x.ShopName).HasMaxLength(200);
            e.Property(x => x.MemoPhotoUrl).HasMaxLength(500);
            e.HasOne(x => x.Trip).WithMany(t => t.Items)
                .HasForeignKey(x => x.TripId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Variant).WithMany()
                .HasForeignKey(x => x.VariantId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Supplier).WithMany()
                .HasForeignKey(x => x.SupplierId).OnDelete(DeleteBehavior.ClientSetNull);
        });

        // ── PurchaseReceiveSession ──────────────────────────────────────────
        modelBuilder.Entity<PurchaseReceiveSession>(e =>
        {
            e.ToTable("purchase_receive_sessions");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.SessionNo).HasMaxLength(20).IsRequired();
            e.Property(x => x.TransportMode).HasMaxLength(30).IsRequired();
            e.Property(x => x.VehicleOrTrackingNo).HasMaxLength(100);
            e.Property(x => x.Note).HasMaxLength(500);
            e.Property(x => x.Status).HasMaxLength(20).IsRequired();
            e.Property(x => x.RejectionReason).HasMaxLength(500);
            e.HasOne(x => x.Trip).WithMany(t => t.Sessions)
                .HasForeignKey(x => x.TripId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.ReceivedByUser).WithMany()
                .HasForeignKey(x => x.ReceivedBy).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.ApprovedByUser).WithMany()
                .HasForeignKey(x => x.ApprovedBy).OnDelete(DeleteBehavior.Restrict);
        });

        // ── PurchaseReceiveItem ─────────────────────────────────────────────
        modelBuilder.Entity<PurchaseReceiveItem>(e =>
        {
            e.ToTable("purchase_receive_session_items");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.QtyUsable).HasColumnType("DECIMAL(12,3)");
            e.Property(x => x.QtyDamaged).HasColumnType("DECIMAL(12,3)");
            e.Property(x => x.PerLotValuesJson).HasMaxLength(2000);
            e.HasOne(x => x.Session).WithMany(s => s.Items)
                .HasForeignKey(x => x.SessionId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.PurchaseItem).WithMany()
                .HasForeignKey(x => x.PurchaseItemId).OnDelete(DeleteBehavior.Restrict);
        });

        // ── Supplier ────────────────────────────────────────────────────────────
        modelBuilder.Entity<Supplier>(e =>
        {
            e.ToTable("suppliers");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.Name).HasMaxLength(200).IsRequired();
            e.Property(x => x.Address).HasMaxLength(500);
            e.Property(x => x.Phone).HasMaxLength(30);
            e.Property(x => x.Notes).HasMaxLength(1000);
        });

        // ── PurchaseTripCost ────────────────────────────────────────────────
        modelBuilder.Entity<PurchaseTripCost>(e =>
        {
            e.ToTable("purchase_trip_costs");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.CostType).HasMaxLength(30).IsRequired();
            e.Property(x => x.Amount).HasColumnType("DECIMAL(14,2)");
            e.Property(x => x.Note).HasMaxLength(500);
            e.Property(x => x.PhotoUrl).HasMaxLength(500);
            e.Property(x => x.PaidBy).HasMaxLength(200);
            e.Property(x => x.IsPostCompletion).HasDefaultValue(false);
            e.HasOne(x => x.Trip).WithMany(t => t.Costs)
                .HasForeignKey(x => x.TripId).OnDelete(DeleteBehavior.Cascade);
        });

        // ── Lot ─────────────────────────────────────────────────────────────
        modelBuilder.Entity<Lot>(e =>
        {
            e.ToTable("lots");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.QtyIn).HasColumnType("DECIMAL(12,3)");
            e.Property(x => x.LandedUnitCost).HasColumnType("DECIMAL(14,2)");
            e.Property(x => x.RemainingQty).HasColumnType("DECIMAL(12,3)");
            e.Property(x => x.PerLotValuesJson).HasMaxLength(2000);
            e.HasOne(x => x.Variant).WithMany()
                .HasForeignKey(x => x.VariantId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.PurchaseItem).WithMany()
                .HasForeignKey(x => x.PurchaseItemId).OnDelete(DeleteBehavior.Restrict);
        });

        // ── StockMovement ───────────────────────────────────────────────────
        modelBuilder.Entity<StockMovement>(e =>
        {
            e.ToTable("stock_movements");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.MovementType).HasMaxLength(20).IsRequired();
            e.Property(x => x.Qty).HasColumnType("DECIMAL(12,3)");
            e.Property(x => x.ReferenceType).HasMaxLength(50);
            e.Property(x => x.Note).HasMaxLength(500);
            e.HasOne(x => x.Variant).WithMany()
                .HasForeignKey(x => x.VariantId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Lot).WithMany()
                .HasForeignKey(x => x.LotId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.User).WithMany()
                .HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        });

        // ── VariantInventory ────────────────────────────────────────────────
        modelBuilder.Entity<VariantInventory>(e =>
        {
            e.ToTable("variant_inventories");
            e.HasKey(x => x.VariantId);
            e.Property(x => x.OnHand).HasColumnType("DECIMAL(12,3)");
            e.Property(x => x.Committed).HasColumnType("DECIMAL(12,3)");
            e.Property(x => x.Damaged).HasColumnType("DECIMAL(12,3)");
            e.Ignore(x => x.Available);
            e.HasOne(x => x.Variant).WithOne()
                .HasForeignKey<VariantInventory>(x => x.VariantId).OnDelete(DeleteBehavior.Cascade);
        });

        // ── Courier ─────────────────────────────────────────────────────────
        modelBuilder.Entity<Courier>(e =>
        {
            e.ToTable("couriers");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.Name).HasMaxLength(200).IsRequired();
            e.Property(x => x.Phone).HasMaxLength(30);
            e.Property(x => x.InsideDhakaCharge).HasColumnType("DECIMAL(14,2)");
            e.Property(x => x.OutsideDhakaCharge).HasColumnType("DECIMAL(14,2)");
            e.Property(x => x.ReturnCharge).HasColumnType("DECIMAL(14,2)");
            e.Property(x => x.CodFeeType).HasMaxLength(4).HasDefaultValue("PCT");
            e.Property(x => x.CodFeeValue).HasColumnType("DECIMAL(14,4)");
            e.Property(x => x.TrackingUrlTemplate).HasMaxLength(500);
        });

        // ── ExpenseCategory ──────────────────────────────────────────────────
        modelBuilder.Entity<ExpenseCategory>(e =>
        {
            e.ToTable("expense_categories");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.Name).HasMaxLength(100).IsRequired();
        });

        // ── Carton ──────────────────────────────────────────────────────────
        modelBuilder.Entity<Carton>(e =>
        {
            e.ToTable("cartons");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.CartonNo).HasMaxLength(50).IsRequired();
            e.Property(x => x.Status).HasMaxLength(20).IsRequired();
            e.Property(x => x.Location).HasMaxLength(100);
            e.Property(x => x.Notes).HasMaxLength(500);
            e.HasOne(x => x.Trip).WithMany()
                .HasForeignKey(x => x.TripId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.CreatedByUser).WithMany()
                .HasForeignKey(x => x.CreatedBy).OnDelete(DeleteBehavior.Restrict);
        });

        // ── CartonItem ──────────────────────────────────────────────────────
        modelBuilder.Entity<CartonItem>(e =>
        {
            e.ToTable("carton_items");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.QtyInCarton).HasColumnType("DECIMAL(12,3)");
            e.Property(x => x.QtyLabeled).HasColumnType("DECIMAL(12,3)");
            e.Property(x => x.QtyDamaged).HasColumnType("DECIMAL(12,3)");
            e.Property(x => x.LabelPrice).HasColumnType("DECIMAL(14,2)");
            e.HasOne(x => x.Carton).WithMany(c => c.Items)
                .HasForeignKey(x => x.CartonId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Variant).WithMany()
                .HasForeignKey(x => x.VariantId).OnDelete(DeleteBehavior.Restrict);
        });

        // ── Partner ─────────────────────────────────────────────────────────
        modelBuilder.Entity<Partner>(e =>
        {
            e.ToTable("partners");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.Name).HasMaxLength(200).IsRequired();
            e.Property(x => x.Phone).HasMaxLength(30);
            e.Property(x => x.PartnerType).HasMaxLength(20).IsRequired();
            e.Property(x => x.Status).HasMaxLength(20).IsRequired();
            e.Property(x => x.DeferredLossPaisa).HasColumnType("bigint");
            e.Property(x => x.Note).HasMaxLength(1000);
            e.HasIndex(x => new { x.BusinessId, x.Phone });
        });

        // ── CapitalInjection ────────────────────────────────────────────────
        modelBuilder.Entity<CapitalInjection>(e =>
        {
            e.ToTable("capital_injections");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.AmountPaisa).HasColumnType("bigint");
            e.Property(x => x.Note).HasMaxLength(500);
            e.HasOne(x => x.Partner).WithMany(p => p.CapitalInjections)
                .HasForeignKey(x => x.PartnerId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.CreatedByUser).WithMany()
                .HasForeignKey(x => x.CreatedBy).OnDelete(DeleteBehavior.Restrict);
        });

        // ── CapitalLedgerEntry (insert-only, R15.3) ────────────────────────
        modelBuilder.Entity<CapitalLedgerEntry>(e =>
        {
            e.ToTable("capital_ledger");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.EntryType).HasMaxLength(30).IsRequired();
            e.Property(x => x.Bucket).HasMaxLength(10).IsRequired();
            e.Property(x => x.AmountPaisa).HasColumnType("bigint");
            e.Property(x => x.BalanceAfterPaisa).HasColumnType("bigint");
            e.Property(x => x.ReferenceType).HasMaxLength(50);
            e.Property(x => x.Note).HasMaxLength(500);
            e.HasOne(x => x.Partner).WithMany(p => p.LedgerEntries)
                .HasForeignKey(x => x.PartnerId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.CreatedByUser).WithMany()
                .HasForeignKey(x => x.CreatedBy).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => new { x.PartnerId, x.Bucket, x.CreatedAt });
        });
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        foreach (var entry in ChangeTracker.Entries<BaseEntity>()
                     .Where(e => e.State == EntityState.Added || e.State == EntityState.Modified))
        {
            entry.Entity.UpdatedAt = DateTime.UtcNow;
            if (entry.State == EntityState.Added)
                entry.Entity.CreatedAt = DateTime.UtcNow;
        }
        return base.SaveChangesAsync(cancellationToken);
    }
}
