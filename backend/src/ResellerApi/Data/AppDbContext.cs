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
    public Guid? CurrentBranchId => _businessContext.CurrentBranchId;

    // ── Phase 1 ───────────────────────────────────────────────────────────
    public DbSet<Company> Companies => Set<Company>();
    public DbSet<Business> Businesses => Set<Business>();
    public DbSet<User> Users => Set<User>();
    public DbSet<BusinessUser> BusinessUsers => Set<BusinessUser>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<ActivityLog> ActivityLogs => Set<ActivityLog>();
    public DbSet<AppSetting> AppSettings => Set<AppSetting>();
    public DbSet<EmailVerification> EmailVerifications => Set<EmailVerification>();

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

    // ── Branch/Location support ───────────────────────────────────────────
    public DbSet<Branch> Branches => Set<Branch>();
    public DbSet<UserBranch> UserBranches => Set<UserBranch>();
    public DbSet<BranchVariantInventory> BranchVariantInventories => Set<BranchVariantInventory>();
    public DbSet<StorageLocation> StorageLocations => Set<StorageLocation>();

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

    // ── Subscriptions & Billing ────────────────────────────────────────────
    public DbSet<SubscriptionPlan> SubscriptionPlans => Set<SubscriptionPlan>();
    public DbSet<Subscription> Subscriptions => Set<Subscription>();
    public DbSet<SubscriptionPayment> SubscriptionPayments => Set<SubscriptionPayment>();

    // ── Catalog Templates (suggested categories/products) ──────────────────
    public DbSet<SuggestedCategory> SuggestedCategories => Set<SuggestedCategory>();
    public DbSet<SuggestedCategoryField> SuggestedCategoryFields => Set<SuggestedCategoryField>();
    public DbSet<SuggestedProduct> SuggestedProducts => Set<SuggestedProduct>();

    // ── ClientPage (public storefront) ──────────────────────────────────────
    public DbSet<CpCheckoutGroup> CpCheckoutGroups => Set<CpCheckoutGroup>();
    public DbSet<CpCheckoutGroupOrder> CpCheckoutGroupOrders => Set<CpCheckoutGroupOrder>();

    // ── Platform Admin ────────────────────────────────────────────────────
    public DbSet<PlatformAdminAuditLog> PlatformAdminAuditLogs => Set<PlatformAdminAuditLog>();
    public DbSet<PlatformAdminAccount> PlatformAdminAccounts => Set<PlatformAdminAccount>();

    // ── Product Reviews ───────────────────────────────────────────────────
    public DbSet<ClientPageCustomerAccount> ClientPageCustomerAccounts => Set<ClientPageCustomerAccount>();
    public DbSet<ProductReview> ProductReviews => Set<ProductReview>();
    public DbSet<ProductReviewImage> ProductReviewImages => Set<ProductReviewImage>();
    public DbSet<ProductReviewReply> ProductReviewReplies => Set<ProductReviewReply>();
    public DbSet<ProductMarketplaceDetail> ProductMarketplaceDetails => Set<ProductMarketplaceDetail>();
    public DbSet<MarketplaceDetailTemplateLabel> MarketplaceDetailTemplateLabels => Set<MarketplaceDetailTemplateLabel>();
    public DbSet<ProductImage> ProductImages => Set<ProductImage>();
    public DbSet<CpShippingAddress> CpShippingAddresses => Set<CpShippingAddress>();

    // ── Feedback ───────────────────────────────────────────────────────────
    public DbSet<Feedback> Feedbacks => Set<Feedback>();
    public DbSet<FeedbackReply> FeedbackReplies => Set<FeedbackReply>();

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

            if (typeof(IBranchScoped).IsAssignableFrom(entity.ClrType))
            {
                var branchId = System.Linq.Expressions.Expression.Property(param, nameof(IBranchScoped.BranchId));
                var currentBranchId = System.Linq.Expressions.Expression.Property(
                    System.Linq.Expressions.Expression.Constant(this),
                    nameof(CurrentBranchId));

                // CurrentBranchId == null → OWNER/MANAGER "all branches" mode, bypass entirely.
                // Otherwise: standard nullable-equality semantics already give the right answer —
                // a NULL entity.BranchId (business-wide Expense) never matches a specific branch.
                var contextIsNull = System.Linq.Expressions.Expression.Equal(
                    currentBranchId, System.Linq.Expressions.Expression.Constant(null, typeof(Guid?)));
                var columnMatches = System.Linq.Expressions.Expression.Equal(branchId, currentBranchId);

                body = System.Linq.Expressions.Expression.AndAlso(
                    body,
                    System.Linq.Expressions.Expression.OrElse(contextIsNull, columnMatches));
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
            e.Property(x => x.Country).HasMaxLength(100);
            e.Property(x => x.BusinessTypesJson).HasMaxLength(500);
            e.Property(x => x.SalesChannelsJson).HasMaxLength(200);
            e.Property(x => x.Subdomain).HasMaxLength(63);
            e.Property(x => x.LogoUrl).HasMaxLength(500);
            e.Property(x => x.BannerUrl).HasMaxLength(500);
            e.HasIndex(x => x.Subdomain).IsUnique().HasFilter("[Subdomain] IS NOT NULL");
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
            e.Property(x => x.Email).HasMaxLength(255);
            e.HasIndex(x => x.Email).IsUnique().HasFilter("[Email] IS NOT NULL");
            e.Property(x => x.PhotoUrl).HasMaxLength(500);
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

        // ── EmailVerification (signup + password reset, pre-tenant) ─────────
        modelBuilder.Entity<EmailVerification>(e =>
        {
            e.ToTable("email_verifications");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.Email).HasMaxLength(255).IsRequired();
            e.Property(x => x.CodeHash).HasMaxLength(128).IsRequired();
            e.Property(x => x.Purpose).HasMaxLength(20).IsRequired().HasDefaultValue(EmailVerificationPurpose.Signup);
            e.HasIndex(x => new { x.Email, x.Purpose });
        });

        // ── PlatformAdminAccount (super-admin login, pre-tenant) ─────────────
        modelBuilder.Entity<PlatformAdminAccount>(e =>
        {
            e.ToTable("platform_admin_accounts");
            e.HasKey(x => x.Id);
            e.Property(x => x.Username).HasMaxLength(100).IsRequired();
            e.Property(x => x.PasswordHash).HasMaxLength(255).IsRequired();
            e.HasIndex(x => x.Username).IsUnique();
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
            e.Property(x => x.NameBn).HasMaxLength(100);
            e.Property(x => x.DefaultUnit).HasMaxLength(20);
            e.HasOne<SuggestedCategory>().WithMany()
                .HasForeignKey(x => x.SuggestedCategoryId).OnDelete(DeleteBehavior.SetNull);
            e.HasOne(x => x.ParentCategory).WithMany(x => x.Subcategories)
                .HasForeignKey(x => x.ParentCategoryId).OnDelete(DeleteBehavior.Restrict);
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
            e.HasIndex(x => new { x.BusinessId, x.Sku }).IsUnique();
            e.Property(x => x.ImageUrl).HasMaxLength(500);
            e.Property(x => x.UnitCode).HasMaxLength(20);
            e.Property(x => x.Status).HasMaxLength(20);
            e.Property(x => x.SellingPrice).HasColumnType("DECIMAL(14,2)");
            e.Property(x => x.MarketPrice).HasColumnType("DECIMAL(14,2)");
            e.Property(x => x.MarketplacePrice).HasColumnType("DECIMAL(14,2)");
            e.Property(x => x.PackagingCostPerUnit).HasColumnType("DECIMAL(14,2)");
            // Explicit DB default — the C# property initializer (= true) only applies to newly
            // constructed entities in memory, not the SQL column default EF generates for
            // migrations, which defaults to false unless told otherwise. Getting this wrong here
            // would flip every existing product to hidden the moment the migration ran.
            e.Property(x => x.ShowOnMarketplace).HasDefaultValue(true);
            e.Property(x => x.YoutubeUrl).HasMaxLength(500);
            e.Property(x => x.WarrantyDurationUnit).HasMaxLength(10);
            // Explicit DB defaults for the same reason as ShowOnMarketplace above — without
            // these, existing rows would fail the NOT NULL constraint (PopularityScore/ReviewCount)
            // when the migration runs.
            e.Property(x => x.PopularityScore).HasColumnType("DECIMAL(14,4)").HasDefaultValue(0);
            e.Property(x => x.AverageRating).HasColumnType("DECIMAL(3,2)");
            e.Property(x => x.ReviewCount).HasDefaultValue(0);
            // Not BusinessId-prefixed — marketplace ranking queries span every tenant at once.
            e.HasIndex(x => new { x.ShowOnMarketplace, x.Status, x.PopularityScore });
            e.HasIndex(x => new { x.ShowOnMarketplace, x.Status, x.AverageRating });
            e.HasOne(x => x.Category).WithMany(c => c.Products)
                .HasForeignKey(x => x.CategoryId).OnDelete(DeleteBehavior.Restrict);
        });

        // ── ProductMarketplaceDetail ──────────────────────────────────────────
        modelBuilder.Entity<ProductMarketplaceDetail>(e =>
        {
            e.ToTable("product_marketplace_details");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.Section).HasMaxLength(30).IsRequired();
            e.Property(x => x.Label).HasMaxLength(200).IsRequired();
            e.Property(x => x.Value).HasMaxLength(1000).IsRequired();
            e.HasIndex(x => x.ProductId);
            e.HasOne(x => x.Product).WithMany(p => p.MarketplaceDetails)
                .HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Business).WithMany()
                .HasForeignKey(x => x.BusinessId).OnDelete(DeleteBehavior.Restrict);
        });

        // ── MarketplaceDetailTemplateLabel ────────────────────────────────────
        modelBuilder.Entity<MarketplaceDetailTemplateLabel>(e =>
        {
            e.ToTable("marketplace_detail_template_labels");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.Section).HasMaxLength(30).IsRequired();
            e.Property(x => x.Label).HasMaxLength(200).IsRequired();
            e.Property(x => x.ValuePlaceholder).HasMaxLength(200);
            e.HasOne(x => x.Category).WithMany()
                .HasForeignKey(x => x.CategoryId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => new { x.CategoryId, x.Section, x.Label }).IsUnique();
        });

        // ── ProductImage ───────────────────────────────────────────────────
        modelBuilder.Entity<ProductImage>(e =>
        {
            e.ToTable("product_images");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.ImageUrl).HasMaxLength(500).IsRequired();
            e.HasIndex(x => x.ProductId);
            e.HasOne(x => x.Product).WithMany(p => p.Images)
                .HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Business).WithMany()
                .HasForeignKey(x => x.BusinessId).OnDelete(DeleteBehavior.Restrict);
        });

        // ── ProductVariant ─────────────────────────────────────────────────
        modelBuilder.Entity<ProductVariant>(e =>
        {
            e.ToTable("product_variants");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.Sku).HasMaxLength(60).IsRequired();
            // Sku uniqueness is per-business (two tenants can both have "P-0001-01"); Barcode
            // stays globally unique below (intentional — see GenerateBarcodeAsync).
            e.HasIndex(x => new { x.BusinessId, x.Sku }).IsUnique();
            e.Property(x => x.Barcode).HasMaxLength(100).IsRequired();
            e.HasIndex(x => x.Barcode).IsUnique();
            e.Property(x => x.PriceOverride).HasColumnType("DECIMAL(14,2)");
            e.Property(x => x.AvgLandedCost).HasColumnType("DECIMAL(14,2)");
            e.HasOne(x => x.Product).WithMany(p => p.Variants)
                .HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Business).WithMany()
                .HasForeignKey(x => x.BusinessId).OnDelete(DeleteBehavior.Restrict);
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
            e.Property(x => x.BranchId).IsRequired();
            e.HasOne(x => x.CreatedByUser).WithMany()
                .HasForeignKey(x => x.CreatedBy).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Branch).WithMany()
                .HasForeignKey(x => x.BranchId).OnDelete(DeleteBehavior.NoAction);
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
            e.Property(x => x.BranchId).IsRequired();
            e.HasOne(x => x.Trip).WithMany(t => t.Sessions)
                .HasForeignKey(x => x.TripId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.ReceivedByUser).WithMany()
                .HasForeignKey(x => x.ReceivedBy).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.ApprovedByUser).WithMany()
                .HasForeignKey(x => x.ApprovedBy).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Branch).WithMany()
                .HasForeignKey(x => x.BranchId).OnDelete(DeleteBehavior.NoAction);
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
            e.Property(x => x.DisplayCode).HasMaxLength(10);
            e.Property(x => x.BranchId).IsRequired();
            e.HasOne(x => x.Variant).WithMany()
                .HasForeignKey(x => x.VariantId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.PurchaseItem).WithMany()
                .HasForeignKey(x => x.PurchaseItemId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Branch).WithMany()
                .HasForeignKey(x => x.BranchId).OnDelete(DeleteBehavior.NoAction);
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
            e.Property(x => x.BranchId).IsRequired();
            e.HasOne(x => x.Variant).WithMany()
                .HasForeignKey(x => x.VariantId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Lot).WithMany()
                .HasForeignKey(x => x.LotId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.User).WithMany()
                .HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Branch).WithMany()
                .HasForeignKey(x => x.BranchId).OnDelete(DeleteBehavior.NoAction);
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

        // ── Branch ────────────────────────────────────────────────────────────
        modelBuilder.Entity<Branch>(e =>
        {
            e.ToTable("branches");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.Name).HasMaxLength(200).IsRequired();
            e.Property(x => x.Code).HasMaxLength(20).IsRequired();
            e.Property(x => x.Address).HasMaxLength(500);
            e.Property(x => x.Phone).HasMaxLength(30);
            e.HasIndex(x => new { x.BusinessId, x.Code }).IsUnique();
            // Exactly one IsDefault=1, non-deleted branch per business, enforced at the DB level.
            e.HasIndex(x => x.BusinessId)
                .IsUnique()
                .HasFilter("[IsDefault] = 1 AND [DeletedAt] IS NULL")
                .HasDatabaseName("IX_branches_OneDefaultPerBusiness");
        });

        // ── UserBranch ────────────────────────────────────────────────────────
        modelBuilder.Entity<UserBranch>(e =>
        {
            e.ToTable("user_branches");
            e.HasKey(x => new { x.UserId, x.BranchId });
            e.HasOne(x => x.User).WithMany(u => u.UserBranches)
                .HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Branch).WithMany(b => b.UserBranches)
                .HasForeignKey(x => x.BranchId).OnDelete(DeleteBehavior.Restrict);
        });

        // ── BranchVariantInventory ──────────────────────────────────────────
        modelBuilder.Entity<BranchVariantInventory>(e =>
        {
            e.ToTable("branch_variant_inventories");
            e.HasKey(x => new { x.BranchId, x.VariantId });
            e.Property(x => x.OnHand).HasColumnType("DECIMAL(12,3)");
            e.Property(x => x.Committed).HasColumnType("DECIMAL(12,3)");
            e.Property(x => x.Damaged).HasColumnType("DECIMAL(12,3)");
            e.Ignore(x => x.Available);
            e.HasOne(x => x.Branch).WithMany()
                .HasForeignKey(x => x.BranchId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Variant).WithMany()
                .HasForeignKey(x => x.VariantId).OnDelete(DeleteBehavior.Cascade);
        });

        // ── StorageLocation ─────────────────────────────────────────────────
        modelBuilder.Entity<StorageLocation>(e =>
        {
            e.ToTable("storage_locations");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.Name).HasMaxLength(100).IsRequired();
            e.Property(x => x.LocationType).HasMaxLength(20).IsRequired();
            e.Property(x => x.BranchId).IsRequired();
            e.HasOne(x => x.Branch).WithMany()
                .HasForeignKey(x => x.BranchId).OnDelete(DeleteBehavior.Restrict);
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
            e.Property(x => x.PhotoUrl).HasMaxLength(500);
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
            e.HasIndex(x => new { x.BusinessId, x.BranchId, x.FulfillmentStatus });
            e.Property(x => x.BranchId).IsRequired();
            e.Property(x => x.Channel).HasMaxLength(20).IsRequired();
            e.Property(x => x.BusinessDate).IsRequired();
            e.HasIndex(x => new { x.BusinessId, x.BusinessDate });
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
            e.HasOne(x => x.Branch).WithMany()
                .HasForeignKey(x => x.BranchId).OnDelete(DeleteBehavior.NoAction);
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
            e.HasOne(x => x.Branch).WithMany()
                .HasForeignKey(x => x.BranchId).OnDelete(DeleteBehavior.NoAction);
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
            e.Property(x => x.BranchId).IsRequired();
            e.HasOne(x => x.Staff).WithMany()
                .HasForeignKey(x => x.StaffId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Branch).WithMany()
                .HasForeignKey(x => x.BranchId).OnDelete(DeleteBehavior.NoAction);
            e.HasIndex(x => new { x.BusinessId, x.BranchId, x.StaffId }).IsUnique();
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
            e.Property(x => x.BranchId).IsRequired();
            e.HasOne(x => x.Trip).WithMany()
                .HasForeignKey(x => x.TripId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.CreatedByUser).WithMany()
                .HasForeignKey(x => x.CreatedBy).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Branch).WithMany()
                .HasForeignKey(x => x.BranchId).OnDelete(DeleteBehavior.NoAction);
            e.HasOne(x => x.StorageLocation).WithMany()
                .HasForeignKey(x => x.StorageLocationId).OnDelete(DeleteBehavior.SetNull);
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

        // ── SubscriptionPlan (lookup table, not business/company-scoped) ────
        modelBuilder.Entity<SubscriptionPlan>(e =>
        {
            e.ToTable("subscription_plans");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.Code).HasMaxLength(30).IsRequired();
            e.Property(x => x.Name).HasMaxLength(100).IsRequired();
            e.Property(x => x.PriceMonthly).HasColumnType("DECIMAL(14,2)");
            e.Property(x => x.PriceYearly).HasColumnType("DECIMAL(14,2)");
            e.HasIndex(x => x.Code).IsUnique();
        });

        // ── Subscription (one per Company) ─────────────────────────────────
        modelBuilder.Entity<Subscription>(e =>
        {
            e.ToTable("subscriptions");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.Status).HasMaxLength(20).IsRequired();
            e.Property(x => x.BillingCycle).HasMaxLength(10).IsRequired();
            e.HasOne(x => x.Company).WithMany()
                .HasForeignKey(x => x.CompanyId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Plan).WithMany(p => p.Subscriptions)
                .HasForeignKey(x => x.PlanId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => x.CompanyId).IsUnique();
        });

        // ── SubscriptionPayment (append-only payment history, GTR-7) ────────
        modelBuilder.Entity<SubscriptionPayment>(e =>
        {
            e.ToTable("subscription_payments");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.Amount).HasColumnType("DECIMAL(14,2)");
            e.Property(x => x.Method).HasMaxLength(20).IsRequired();
            e.Property(x => x.Status).HasMaxLength(20).IsRequired();
            e.Property(x => x.GatewayPaymentId).HasMaxLength(100).IsRequired();
            e.Property(x => x.GatewayTrxId).HasMaxLength(100);
            e.HasOne(x => x.Subscription).WithMany(s => s.Payments)
                .HasForeignKey(x => x.SubscriptionId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => x.GatewayPaymentId).IsUnique();
        });

        // ── SuggestedCategory (global template catalog, not business-scoped) ─
        modelBuilder.Entity<SuggestedCategory>(e =>
        {
            e.ToTable("suggested_categories");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.BusinessTypeCode).HasMaxLength(50).IsRequired();
            e.Property(x => x.Name).HasMaxLength(100).IsRequired();
            e.Property(x => x.DefaultUnit).HasMaxLength(20).IsRequired();
            e.HasIndex(x => x.BusinessTypeCode);
        });

        // ── SuggestedCategoryField ───────────────────────────────────────────
        modelBuilder.Entity<SuggestedCategoryField>(e =>
        {
            e.ToTable("suggested_category_fields");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.Name).HasMaxLength(100).IsRequired();
            e.Property(x => x.FieldType).HasMaxLength(20).IsRequired();
            e.HasOne(x => x.SuggestedCategory).WithMany(c => c.Fields)
                .HasForeignKey(x => x.SuggestedCategoryId).OnDelete(DeleteBehavior.Cascade);
        });

        // ── SuggestedProduct (global template catalog, keyed by category) ───
        modelBuilder.Entity<SuggestedProduct>(e =>
        {
            e.ToTable("suggested_products");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.Name).HasMaxLength(150).IsRequired();
            e.HasOne(x => x.SuggestedCategory).WithMany(c => c.Products)
                .HasForeignKey(x => x.SuggestedCategoryId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => x.SuggestedCategoryId);
        });

        // ── ClientPage: CpCheckoutGroup (not business-scoped — spans shops) ─
        modelBuilder.Entity<CpCheckoutGroup>(e =>
        {
            e.ToTable("cp_checkout_groups");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.CustomerName).HasMaxLength(200).IsRequired();
            e.Property(x => x.CustomerPhone).HasMaxLength(20).IsRequired();
        });

        // ── ClientPage: CpCheckoutGroupOrder ─────────────────────────────────
        modelBuilder.Entity<CpCheckoutGroupOrder>(e =>
        {
            e.ToTable("cp_checkout_group_orders");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.HasOne(x => x.CheckoutGroup).WithMany(g => g.Orders)
                .HasForeignKey(x => x.CheckoutGroupId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Order).WithMany()
                .HasForeignKey(x => x.OrderId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => x.CheckoutGroupId);
        });

        // ── Product Reviews: ClientPageCustomerAccount (not business-scoped — one identity
        // shared across every shop) ──────────────────────────────────────────
        modelBuilder.Entity<ClientPageCustomerAccount>(e =>
        {
            e.ToTable("client_page_customer_accounts");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.GoogleId).HasMaxLength(100);
            e.HasIndex(x => x.GoogleId).IsUnique();
            e.Property(x => x.FacebookId).HasMaxLength(100);
            e.HasIndex(x => x.FacebookId).IsUnique();
            e.Property(x => x.Email).HasMaxLength(255);
            e.Property(x => x.Name).HasMaxLength(200).IsRequired();
            e.Property(x => x.PhotoUrl).HasMaxLength(500);
        });

        modelBuilder.Entity<CpShippingAddress>(e =>
        {
            e.ToTable("cp_shipping_addresses");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.Phone).HasMaxLength(20).IsRequired();
            e.HasIndex(x => x.Phone).IsUnique();
            e.Property(x => x.FullName).HasMaxLength(200).IsRequired();
            e.Property(x => x.BuildingStreet).HasMaxLength(300).IsRequired();
            e.Property(x => x.ColonyLandmark).HasMaxLength(300);
            e.Property(x => x.City).HasMaxLength(100).IsRequired();
            e.Property(x => x.Label).HasMaxLength(30);
        });

        // ── Product Reviews: ProductReview ────────────────────────────────────
        modelBuilder.Entity<ProductReview>(e =>
        {
            e.ToTable("product_reviews");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.Body).HasMaxLength(2000).IsRequired();
            e.Property(x => x.VerifiedPhone).HasMaxLength(20).IsRequired();
            e.HasOne(x => x.Product).WithMany()
                .HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.ReviewerAccount).WithMany(a => a.Reviews)
                .HasForeignKey(x => x.ReviewerAccountId).OnDelete(DeleteBehavior.Restrict);
            // One review per product per account (soft-deleted reviews excluded so a hidden
            // review doesn't permanently block a re-review).
            e.HasIndex(x => new { x.BusinessId, x.ProductId, x.ReviewerAccountId })
                .IsUnique().HasFilter("[DeletedAt] IS NULL");
        });

        // ── Product Reviews: ProductReviewImage ───────────────────────────────
        modelBuilder.Entity<ProductReviewImage>(e =>
        {
            e.ToTable("product_review_images");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.ImageUrl).HasMaxLength(500).IsRequired();
            e.HasOne(x => x.Review).WithMany(r => r.Images)
                .HasForeignKey(x => x.ReviewId).OnDelete(DeleteBehavior.Cascade);
        });

        // ── Product Reviews: ProductReviewReply ───────────────────────────────
        modelBuilder.Entity<ProductReviewReply>(e =>
        {
            e.ToTable("product_review_replies");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.Body).HasMaxLength(2000).IsRequired();
            e.HasOne(x => x.Review).WithMany(r => r.Replies)
                .HasForeignKey(x => x.ReviewId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.RepliedByUser).WithMany()
                .HasForeignKey(x => x.RepliedByUserId).OnDelete(DeleteBehavior.Restrict);
        });

        // ── Feedback ────────────────────────────────────────────────────────
        modelBuilder.Entity<Feedback>(e =>
        {
            e.ToTable("feedback");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.Subject).HasMaxLength(200).IsRequired();
            e.Property(x => x.Details).HasMaxLength(4000).IsRequired();
            e.Property(x => x.ImageUrl).HasMaxLength(500);
            e.HasOne(x => x.SubmittedByUser).WithMany()
                .HasForeignKey(x => x.SubmittedByUserId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<FeedbackReply>(e =>
        {
            e.ToTable("feedback_replies");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("NEWSEQUENTIALID()");
            e.Property(x => x.Body).HasMaxLength(2000).IsRequired();
            e.Property(x => x.RepliedByUsername).HasMaxLength(100).IsRequired();
            e.HasOne(x => x.Feedback).WithMany(f => f.Replies)
                .HasForeignKey(x => x.FeedbackId).OnDelete(DeleteBehavior.Cascade);
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
