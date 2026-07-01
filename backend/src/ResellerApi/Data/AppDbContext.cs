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
    public DbSet<PriceSlot> PriceSlots => Set<PriceSlot>();
    public DbSet<PriceActivationLog> PriceActivationLogs => Set<PriceActivationLog>();

    // ── Settings ──────────────────────────────────────────────────────────
    public DbSet<Courier> Couriers => Set<Courier>();
    public DbSet<ExpenseCategory> ExpenseCategories => Set<ExpenseCategory>();

    // ── Phase 7 — Expenses ────────────────────────────────────────────────
    public DbSet<Expense> Expenses => Set<Expense>();
    public DbSet<PettyCashBox> PettyCashBoxes => Set<PettyCashBox>();
    public DbSet<PettyCashTxn> PettyCashTxns => Set<PettyCashTxn>();
    public DbSet<PlannedRate> PlannedRates => Set<PlannedRate>();
    public DbSet<MarketingBudget> MarketingBudgets => Set<MarketingBudget>();

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

    // ── Phase 4 — Orders ──────────────────────────────────────────────────
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<DeliveryMan> DeliveryMen => Set<DeliveryMan>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<OrderStatusHistory> OrderStatusHistories => Set<OrderStatusHistory>();
    public DbSet<OrderPayment> OrderPayments => Set<OrderPayment>();
    public DbSet<CourierRemittance> CourierRemittances => Set<CourierRemittance>();

    // ── Module 15 — Partnership & Capital Ledger (sub-phase 15a) ───────────
    public DbSet<Partner> Partners => Set<Partner>();
    public DbSet<CapitalInjection> CapitalInjections => Set<CapitalInjection>();
    public DbSet<CapitalLedgerEntry> CapitalLedgerEntries => Set<CapitalLedgerEntry>();
    public DbSet<PartnerApprovalVote> PartnerApprovalVotes => Set<PartnerApprovalVote>();

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

        // ── PriceSlot ──────────────────────────────────────────────────────────
        modelBuilder.Entity<PriceSlot>(e =>
        {
            e.ToTable("price_slots");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.Label).HasMaxLength(100).IsRequired();
            e.Property(x => x.Price).HasColumnType("DECIMAL(14,2)");
            e.Property(x => x.Reason).HasMaxLength(500);
            e.Property(x => x.IsActive).HasDefaultValue(false);
            e.HasOne(x => x.Variant).WithMany()
                .HasForeignKey(x => x.VariantId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.CreatedByUser).WithMany()
                .HasForeignKey(x => x.CreatedBy).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => new { x.VariantId, x.IsActive });
        });

        // ── PriceActivationLog ─────────────────────────────────────────────────
        modelBuilder.Entity<PriceActivationLog>(e =>
        {
            e.ToTable("price_activation_logs");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.PriceSnapshot).HasColumnType("DECIMAL(14,2)");
            e.Property(x => x.LabelSnapshot).HasMaxLength(100).IsRequired();
            e.HasOne(x => x.Variant).WithMany()
                .HasForeignKey(x => x.VariantId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Slot).WithMany(s => s.ActivationLogs)
                .HasForeignKey(x => x.SlotId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.ActivatedByUser).WithMany()
                .HasForeignKey(x => x.ActivatedBy).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => new { x.VariantId, x.ActivatedAt });
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
            e.Property(x => x.Contact).HasMaxLength(100);
        });

        // ── Customer ─────────────────────────────────────────────────────────
        modelBuilder.Entity<Customer>(e =>
        {
            e.ToTable("customers");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.Name).HasMaxLength(200).IsRequired();
            e.Property(x => x.Phone).HasMaxLength(30).IsRequired();
            e.HasIndex(x => new { x.BusinessId, x.Phone }).IsUnique();
            e.Property(x => x.Address).HasMaxLength(500);
            e.Property(x => x.CreditLimit).HasColumnType("DECIMAL(14,2)");
            e.Property(x => x.StoreCreditBalance).HasColumnType("DECIMAL(14,2)");
            e.Property(x => x.Note).HasMaxLength(1000);
        });

        // ── DeliveryMan ───────────────────────────────────────────────────────
        modelBuilder.Entity<DeliveryMan>(e =>
        {
            e.ToTable("delivery_men");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.Name).HasMaxLength(200).IsRequired();
            e.Property(x => x.Phone).HasMaxLength(30).IsRequired();
            e.Property(x => x.CostPerDelivery).HasColumnType("DECIMAL(14,2)");
            e.HasOne(x => x.Courier).WithMany(c => c.DeliveryMen)
                .HasForeignKey(x => x.CourierId).OnDelete(DeleteBehavior.ClientSetNull);
        });

        // ── Order ─────────────────────────────────────────────────────────────
        modelBuilder.Entity<Order>(e =>
        {
            e.ToTable("orders");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.OrderNo).HasMaxLength(20).IsRequired();
            e.HasIndex(x => new { x.BusinessId, x.OrderNo }).IsUnique();
            e.HasIndex(x => new { x.BusinessId, x.FulfillmentStatus });
            e.HasIndex(x => new { x.BusinessId, x.CustomerPhone });
            e.Property(x => x.Channel).HasMaxLength(20).IsRequired();
            e.Property(x => x.CustomerName).HasMaxLength(200).IsRequired();
            e.Property(x => x.CustomerPhone).HasMaxLength(30).IsRequired();
            e.Property(x => x.CustomerAddress).HasMaxLength(500);
            e.Property(x => x.OrderStatus).HasMaxLength(20).IsRequired();
            e.Property(x => x.PaymentStatus).HasMaxLength(20).IsRequired();
            e.Property(x => x.FulfillmentStatus).HasMaxLength(20).IsRequired();
            e.Property(x => x.DiscountType).HasMaxLength(10);
            e.Property(x => x.DiscountValue).HasColumnType("DECIMAL(14,2)");
            e.Property(x => x.DeliveryChargeCustomer).HasColumnType("DECIMAL(14,2)");
            e.Property(x => x.DeliveryCostActual).HasColumnType("DECIMAL(14,2)");
            e.Property(x => x.TrackingNo).HasMaxLength(100);
            e.Property(x => x.AdvancePaid).HasColumnType("DECIMAL(14,2)");
            e.Property(x => x.ClientUid).HasMaxLength(50);
            e.HasIndex(x => x.ClientUid).IsUnique().HasFilter("[ClientUid] IS NOT NULL");
            e.Property(x => x.CancelledReason).HasMaxLength(500);
            e.Property(x => x.Note).HasMaxLength(1000);
            e.Property(x => x.CodRemittanceStatus).HasMaxLength(20);
            e.HasOne(x => x.Customer).WithMany(c => c.Orders)
                .HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Courier).WithMany()
                .HasForeignKey(x => x.CourierId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.DeliveryMan).WithMany()
                .HasForeignKey(x => x.DeliveryManId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.HandlingUser).WithMany()
                .HasForeignKey(x => x.HandlingUserId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.CreatedByUser).WithMany()
                .HasForeignKey(x => x.CreatedBy).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Remittance).WithMany(r => r.Orders)
                .HasForeignKey(x => x.RemittanceId).OnDelete(DeleteBehavior.Restrict);
        });

        // ── OrderItem ─────────────────────────────────────────────────────────
        modelBuilder.Entity<OrderItem>(e =>
        {
            e.ToTable("order_items");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.Qty).HasColumnType("DECIMAL(12,3)");
            e.Property(x => x.UnitPrice).HasColumnType("DECIMAL(14,2)");
            e.Property(x => x.UnitCostSnapshot).HasColumnType("DECIMAL(14,2)");
            e.Property(x => x.OverheadRateSnapshot).HasColumnType("DECIMAL(14,2)");
            e.Property(x => x.MarketingRateSnapshot).HasColumnType("DECIMAL(14,2)");
            e.HasOne(x => x.Order).WithMany(o => o.Items)
                .HasForeignKey(x => x.OrderId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Variant).WithMany()
                .HasForeignKey(x => x.VariantId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Lot).WithMany()
                .HasForeignKey(x => x.LotId).OnDelete(DeleteBehavior.Restrict);
        });

        // ── OrderStatusHistory ────────────────────────────────────────────────
        modelBuilder.Entity<OrderStatusHistory>(e =>
        {
            e.ToTable("order_status_history");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.Track).HasMaxLength(15).IsRequired();
            e.Property(x => x.FromStatus).HasMaxLength(30).IsRequired();
            e.Property(x => x.ToStatus).HasMaxLength(30).IsRequired();
            e.HasOne(x => x.Order).WithMany(o => o.StatusHistory)
                .HasForeignKey(x => x.OrderId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.User).WithMany()
                .HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        });

        // ── OrderPayment ──────────────────────────────────────────────────────
        modelBuilder.Entity<OrderPayment>(e =>
        {
            e.ToTable("order_payments");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.Method).HasMaxLength(20).IsRequired();
            e.Property(x => x.Amount).HasColumnType("DECIMAL(14,2)");
            e.HasOne(x => x.Order).WithMany(o => o.Payments)
                .HasForeignKey(x => x.OrderId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.User).WithMany()
                .HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        });

        // ── CourierRemittance ─────────────────────────────────────────────────
        modelBuilder.Entity<CourierRemittance>(e =>
        {
            e.ToTable("courier_remittances");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.RemittanceNo).HasMaxLength(20).IsRequired();
            e.HasIndex(x => new { x.BusinessId, x.RemittanceNo }).IsUnique();
            e.Property(x => x.Amount).HasColumnType("DECIMAL(14,2)");
            e.Property(x => x.Method).HasMaxLength(10).IsRequired();
            e.Property(x => x.Reference).HasMaxLength(100);
            e.Property(x => x.Note).HasMaxLength(500);
            e.HasOne(x => x.Courier).WithMany()
                .HasForeignKey(x => x.CourierId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.RecordedByUser).WithMany()
                .HasForeignKey(x => x.RecordedBy).OnDelete(DeleteBehavior.Restrict);
        });

        // ── ExpenseCategory ──────────────────────────────────────────────────
        modelBuilder.Entity<ExpenseCategory>(e =>
        {
            e.ToTable("expense_categories");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.Code).HasMaxLength(50).IsRequired();
            e.Property(x => x.Name).HasMaxLength(100).IsRequired();
        });

        // ── Expense ──────────────────────────────────────────────────────────
        modelBuilder.Entity<Expense>(e =>
        {
            e.ToTable("expenses");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.SubType).HasMaxLength(100).IsRequired();
            e.Property(x => x.Amount).HasColumnType("DECIMAL(14,2)");
            e.Property(x => x.Status).HasMaxLength(20).IsRequired();
            e.Property(x => x.PhotoUrl).HasMaxLength(500);
            e.Property(x => x.Note).HasMaxLength(1000);
            e.Property(x => x.RejectionReason).HasMaxLength(500);
            e.HasOne(x => x.Category).WithMany(c => c.Expenses)
                .HasForeignKey(x => x.CategoryId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Staff).WithMany()
                .HasForeignKey(x => x.StaffId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.AllocateToTrip).WithMany()
                .HasForeignKey(x => x.AllocateToTripId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.PettyCashBox).WithMany()
                .HasForeignKey(x => x.PettyCashBoxId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.CreatedByUser).WithMany()
                .HasForeignKey(x => x.CreatedBy).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.ApprovedByUser).WithMany()
                .HasForeignKey(x => x.ApprovedBy).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => new { x.BusinessId, x.ExpenseDate });
            e.HasIndex(x => new { x.BusinessId, x.Status });
        });

        // ── PettyCashBox ─────────────────────────────────────────────────────
        modelBuilder.Entity<PettyCashBox>(e =>
        {
            e.ToTable("petty_cash_boxes");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.Balance).HasColumnType("DECIMAL(14,2)");
            e.HasOne(x => x.Staff).WithMany()
                .HasForeignKey(x => x.StaffId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => new { x.BusinessId, x.StaffId }).IsUnique();
        });

        // ── PettyCashTxn ─────────────────────────────────────────────────────
        modelBuilder.Entity<PettyCashTxn>(e =>
        {
            e.ToTable("petty_cash_txns");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.TxnType).HasMaxLength(10).IsRequired();
            e.Property(x => x.Amount).HasColumnType("DECIMAL(14,2)");
            e.Property(x => x.Note).HasMaxLength(500);
            e.HasOne(x => x.Box).WithMany(b => b.Transactions)
                .HasForeignKey(x => x.BoxId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Expense).WithMany()
                .HasForeignKey(x => x.ExpenseId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.User).WithMany()
                .HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        });

        // ── PlannedRate (append-only, GTR-7) ─────────────────────────────────
        modelBuilder.Entity<PlannedRate>(e =>
        {
            e.ToTable("planned_rates");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.Scope).HasMaxLength(10).IsRequired();
            e.Property(x => x.RateType).HasMaxLength(20).IsRequired();
            e.Property(x => x.RatePerUnit).HasColumnType("DECIMAL(14,4)");
            e.HasOne(x => x.SetByUser).WithMany()
                .HasForeignKey(x => x.SetBy).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => new { x.BusinessId, x.Scope, x.ScopeId, x.RateType, x.EffectiveFrom });
        });

        // ── MarketingBudget ───────────────────────────────────────────────────
        modelBuilder.Entity<MarketingBudget>(e =>
        {
            e.ToTable("marketing_budgets");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.Scope).HasMaxLength(10).IsRequired();
            e.Property(x => x.BudgetAmount).HasColumnType("DECIMAL(14,2)");
            e.HasOne(x => x.SetByUser).WithMany()
                .HasForeignKey(x => x.SetBy).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => new { x.BusinessId, x.Year, x.Month, x.Scope, x.ScopeId }).IsUnique();
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
            e.Property(x => x.NidNumber).HasMaxLength(50);
            e.Property(x => x.Address).HasMaxLength(500);
            e.Property(x => x.Email).HasMaxLength(200);
            e.Property(x => x.BankAccountNumber).HasMaxLength(50);
            e.Property(x => x.BankName).HasMaxLength(200);
            e.Property(x => x.AgreedProfitSharePct).HasColumnType("DECIMAL(5,2)");
            e.Property(x => x.EmergencyContactName).HasMaxLength(200);
            e.Property(x => x.EmergencyContactPhone).HasMaxLength(30);
            e.Property(x => x.EmergencyContactRelation).HasMaxLength(100);
            e.HasIndex(x => new { x.BusinessId, x.Phone });
        });

        // ── PartnerApprovalVote (insert-only, R15.11) ──────────────────────
        modelBuilder.Entity<PartnerApprovalVote>(e =>
        {
            e.ToTable("partner_approval_votes");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.Decision).HasMaxLength(10).IsRequired();
            e.Property(x => x.Note).HasMaxLength(500);
            e.HasOne(x => x.Partner).WithMany(p => p.ApprovalVotes)
                .HasForeignKey(x => x.PartnerId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.VotedByPartner).WithMany()
                .HasForeignKey(x => x.VotedByPartnerId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => new { x.PartnerId, x.VotedByPartnerId }).IsUnique();
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
