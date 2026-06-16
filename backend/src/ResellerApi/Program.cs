using System.Text;
using FluentValidation;
using Hangfire;
using Hangfire.SqlServer;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using ResellerApi.Data;
using ResellerApi.DTOs.Auth;
using ResellerApi.Hubs;
using ResellerApi.Infrastructure;
using ResellerApi.Middleware;
using ResellerApi.Services;
using ResellerApi.Services.Interfaces;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);
var config = builder.Configuration;

// ── EF Core ───────────────────────────────────────────────────────────────
builder.Services.AddScoped<BusinessContext>();
builder.Services.AddScoped<IBusinessContext>(sp => sp.GetRequiredService<BusinessContext>());
builder.Services.AddDbContext<AppDbContext>((sp, options) =>
{
    options.UseSqlServer(config.GetConnectionString("Default"),
        sql => sql.MigrationsAssembly("ResellerApi"));
    options.EnableSensitiveDataLogging(builder.Environment.IsDevelopment());
    options.ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning));
});

// ── Auth ──────────────────────────────────────────────────────────────────
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = config["Jwt:Issuer"],
            ValidAudience = config["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["Jwt:Key"]!)),
            ClockSkew = TimeSpan.Zero
        };
        // Allow JWT via query string for SignalR
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = ctx =>
            {
                var token = ctx.Request.Query["access_token"];
                if (!string.IsNullOrEmpty(token) &&
                    ctx.HttpContext.Request.Path.StartsWithSegments("/hubs"))
                    ctx.Token = token;
                return Task.CompletedTask;
            }
        };
    });
builder.Services.AddAuthorization();

// ── Services ──────────────────────────────────────────────────────────────
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUserService, CurrentUserService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IActivityLogService, ActivityLogService>();
// Phase 2 — Catalog
builder.Services.AddScoped<ICategoryService, CategoryService>();
builder.Services.AddScoped<IProductService, ProductService>();
builder.Services.AddScoped<IPriceHistoryService, PriceHistoryService>();
// Phase 3 — Inventory / Purchases
builder.Services.AddScoped<IPurchaseTripService, PurchaseTripService>();
builder.Services.AddScoped<ISuppliersService, SuppliersService>();
// Carton module
builder.Services.AddScoped<ICartonService, CartonService>();
// Module 15 — Partnership & Capital Ledger (sub-phase 15a)
builder.Services.AddScoped<IPartnerCapitalService, PartnerCapitalService>();
builder.Services.AddScoped<IPartnerService, PartnerService>();

// ── FluentValidation ──────────────────────────────────────────────────────
builder.Services.AddValidatorsFromAssemblyContaining<LoginRequestValidator>();

// ── SignalR ───────────────────────────────────────────────────────────────
builder.Services.AddSignalR();

// ── Hangfire ──────────────────────────────────────────────────────────────
builder.Services.AddHangfire(hf => hf
    .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
    .UseSimpleAssemblyNameTypeSerializer()
    .UseRecommendedSerializerSettings()
    .UseSqlServerStorage(config.GetConnectionString("Default"),
        new SqlServerStorageOptions
        {
            CommandBatchMaxTimeout = TimeSpan.FromMinutes(5),
            SlidingInvisibilityTimeout = TimeSpan.FromMinutes(5),
            QueuePollInterval = TimeSpan.Zero,
            UseRecommendedIsolationLevel = true,
            DisableGlobalLocks = true
        }));
builder.Services.AddHangfireServer();

// ── CORS ──────────────────────────────────────────────────────────────────
var allowedOrigins = config.GetSection("AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(options =>
    options.AddPolicy("FrontendPolicy", policy =>
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials()));

// ── Controllers + OpenAPI ─────────────────────────────────────────────────
builder.Services.AddControllers()
    .AddJsonOptions(opts =>
    {
        opts.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        opts.JsonSerializerOptions.DefaultIgnoreCondition =
            System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull;
    });
builder.Services.AddOpenApi();

// ─────────────────────────────────────────────────────────────────────────
var app = builder.Build();

// OpenAPI spec + Scalar UI (available in all environments for now)
app.MapOpenApi();
app.MapScalarApiReference(options =>
{
    options.Title = "Reseller Manager API";
    options.Theme = ScalarTheme.Purple;
    options.DefaultHttpClient = new(ScalarTarget.JavaScript, ScalarClient.Fetch);
});

app.UseCors("FrontendPolicy");
app.UseAuthentication();
app.UseAuthorization();
app.UseMiddleware<BusinessContextMiddleware>();

app.UseHangfireDashboard("/hangfire", new DashboardOptions
{
    Authorization = [] // restrict in production
});

// ── Hangfire recurring jobs ───────────────────────────────────────────────
RecurringJob.AddOrUpdate<IPriceHistoryService>(
    "apply-scheduled-prices",
    svc => svc.ApplyScheduledPriceChangesAsync(),
    "*/5 * * * *"); // every 5 minutes

app.MapControllers();
app.MapHub<LiveHub>("/hubs/live");

// ── Auto-migrate + seed on startup ───────────────────────────────────────
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
    await SeedAsync(db);
}

app.Run();

// ── Seed initial data ─────────────────────────────────────────────────────
static async Task SeedAsync(AppDbContext db)
{
    // ── Tenant + owner (Phase 1) ──────────────────────────────────────────
    if (!await db.Companies.AnyAsync())
    {
        var company = new ResellerApi.Entities.Company { Name = "My Company" };
        db.Companies.Add(company);

        var business = new ResellerApi.Entities.Business
        {
            CompanyId = company.Id,
            Name = "My Shop",
            Currency = "BDT"
        };
        db.Businesses.Add(business);

        var owner = new ResellerApi.Entities.User
        {
            CompanyId = company.Id,
            Name = "Owner",
            Phone = "01700000000",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("password123"),
            Role = "OWNER",
            IsActive = true
        };
        db.Users.Add(owner);

        db.BusinessUsers.Add(new ResellerApi.Entities.BusinessUser
        {
            BusinessId = business.Id,
            UserId = owner.Id
        });

        foreach (var (key, val) in new[]
        {
            ("low_stock_threshold", "5"),
            ("overhead_mode", "\"AUTO\""),
            ("return_window_days", "7"),
            ("target_margin_pct", "40"),
            ("parked_cart_expiry_minutes", "15"),
            ("refund_approval_threshold", "500"),
            ("staff_free_discount_pct", "5")
        })
        {
            db.AppSettings.Add(new ResellerApi.Entities.AppSetting
            {
                BusinessId = business.Id, Key = key, ValueJson = val
            });
        }

        await db.SaveChangesAsync();
    }

    // ── Units lookup (Phase 2) ────────────────────────────────────────────
    if (!await db.Units.AnyAsync())
    {
        db.Units.AddRange(
            new ResellerApi.Entities.Unit { Code = "pcs",   Name = "Pieces",      AllowsDecimal = false },
            new ResellerApi.Entities.Unit { Code = "pair",  Name = "Pair",        AllowsDecimal = false },
            new ResellerApi.Entities.Unit { Code = "set",   Name = "Set",         AllowsDecimal = false },
            new ResellerApi.Entities.Unit { Code = "dozen", Name = "Dozen",       AllowsDecimal = false },
            new ResellerApi.Entities.Unit { Code = "kg",    Name = "Kilogram",    AllowsDecimal = true  },
            new ResellerApi.Entities.Unit { Code = "gm",    Name = "Gram",        AllowsDecimal = true  },
            new ResellerApi.Entities.Unit { Code = "liter", Name = "Liter",       AllowsDecimal = true  },
            new ResellerApi.Entities.Unit { Code = "ml",    Name = "Milliliter",  AllowsDecimal = true  },
            new ResellerApi.Entities.Unit { Code = "meter", Name = "Meter",       AllowsDecimal = true  },
            new ResellerApi.Entities.Unit { Code = "box",   Name = "Box",         AllowsDecimal = false }
        );
        await db.SaveChangesAsync();
    }

    // ── Starter categories (Phase 2) ──────────────────────────────────────
    var biz = await db.Businesses.FirstOrDefaultAsync();
    if (biz != null && !await db.Categories.IgnoreQueryFilters().AnyAsync(c => c.BusinessId == biz.Id))
    {
        await AddCategoryAsync(db, biz.Id, "Toys", "pcs", new List<ResellerApi.Entities.CategoryField>
        {
            new() { Name = "Age Range", FieldType = "TEXT",     IsRequired = false, IsVariant = false, IsPerLot = false, SortOrder = 1 },
            new() { Name = "Material",  FieldType = "TEXT",     IsRequired = false, IsVariant = false, IsPerLot = false, SortOrder = 2 }
        });

        await AddCategoryAsync(db, biz.Id, "Cloth", "pcs", new List<ResellerApi.Entities.CategoryField>
        {
            new() { Name = "Size",   FieldType = "DROPDOWN", OptionsJson = "[\"XS\",\"S\",\"M\",\"L\",\"XL\",\"XXL\"]",  IsRequired = true,  IsVariant = true,  IsPerLot = false, SortOrder = 1 },
            new() { Name = "Color",  FieldType = "TEXT",                                                                   IsRequired = true,  IsVariant = true,  IsPerLot = false, SortOrder = 2 },
            new() { Name = "Fabric", FieldType = "TEXT",                                                                   IsRequired = false, IsVariant = false, IsPerLot = false, SortOrder = 3 },
            new() { Name = "Gender", FieldType = "DROPDOWN", OptionsJson = "[\"Male\",\"Female\",\"Unisex\",\"Kids\"]",   IsRequired = false, IsVariant = false, IsPerLot = false, SortOrder = 4 }
        });

        await AddCategoryAsync(db, biz.Id, "Shoes", "pair", new List<ResellerApi.Entities.CategoryField>
        {
            new() { Name = "Size",  FieldType = "DROPDOWN", OptionsJson = "[\"36\",\"37\",\"38\",\"39\",\"40\",\"41\",\"42\",\"43\",\"44\",\"45\"]", IsRequired = true, IsVariant = true, IsPerLot = false, SortOrder = 1 },
            new() { Name = "Color", FieldType = "TEXT",                                                                                               IsRequired = true, IsVariant = true, IsPerLot = false, SortOrder = 2 }
        });

        await AddCategoryAsync(db, biz.Id, "Generic", "pcs", new List<ResellerApi.Entities.CategoryField>());
    }

    // ── Seed sample products (Phase 3) ────────────────────────────────────
    if (biz != null && !await db.Products.IgnoreQueryFilters().AnyAsync(p => p.BusinessId == biz.Id))
    {
        await SeedProductsAsync(db, biz.Id);
    }

    // ── Seed BD couriers ──────────────────────────────────────────────────
    if (biz != null && !await db.Couriers.IgnoreQueryFilters().AnyAsync(c => c.BusinessId == biz.Id))
    {
        db.Couriers.AddRange(
            new ResellerApi.Entities.Courier
            {
                BusinessId        = biz.Id,
                Name              = "Steadfast Courier",
                Phone             = "16795",
                InsideDhakaCharge = 70,
                OutsideDhakaCharge= 130,
                ReturnCharge      = 80,
                CodFeeType        = "PCT",
                CodFeeValue       = 1,
                IsDefault         = true,
                TrackingUrlTemplate = "https://steadfast.com.bd/t/{id}",
                IsActive          = true
            },
            new ResellerApi.Entities.Courier
            {
                BusinessId        = biz.Id,
                Name              = "Pathao Courier",
                Phone             = "09678-007007",
                InsideDhakaCharge = 70,
                OutsideDhakaCharge= 130,
                ReturnCharge      = 70,
                CodFeeType        = "PCT",
                CodFeeValue       = 1,
                IsDefault         = false,
                TrackingUrlTemplate = "https://merchant.pathao.com/courier/order-list",
                IsActive          = true
            },
            new ResellerApi.Entities.Courier
            {
                BusinessId        = biz.Id,
                Name              = "RedX",
                Phone             = "01978-978978",
                InsideDhakaCharge = 60,
                OutsideDhakaCharge= 120,
                ReturnCharge      = 60,
                CodFeeType        = "PCT",
                CodFeeValue       = 1,
                IsDefault         = false,
                TrackingUrlTemplate = "https://redx.com.bd/track-parcel/?trackingId={id}",
                IsActive          = true
            },
            new ResellerApi.Entities.Courier
            {
                BusinessId        = biz.Id,
                Name              = "Paperfly",
                Phone             = "16789",
                InsideDhakaCharge = 60,
                OutsideDhakaCharge= 120,
                ReturnCharge      = 60,
                CodFeeType        = "PCT",
                CodFeeValue       = 1,
                IsDefault         = false,
                TrackingUrlTemplate = "https://paperfly.com.bd/track/{id}",
                IsActive          = true
            },
            new ResellerApi.Entities.Courier
            {
                BusinessId        = biz.Id,
                Name              = "eCourier",
                Phone             = "16786",
                InsideDhakaCharge = 60,
                OutsideDhakaCharge= 120,
                ReturnCharge      = 60,
                CodFeeType        = "PCT",
                CodFeeValue       = 1,
                IsDefault         = false,
                TrackingUrlTemplate = "https://ecourier.com.bd/track/{id}",
                IsActive          = true
            },
            new ResellerApi.Entities.Courier
            {
                BusinessId        = biz.Id,
                Name              = "Sundarban Courier",
                Phone             = "01730-071900",
                InsideDhakaCharge = 100,
                OutsideDhakaCharge= 150,
                ReturnCharge      = 100,
                CodFeeType        = "PCT",
                CodFeeValue       = 1.5m,
                IsDefault         = false,
                TrackingUrlTemplate = null,
                IsActive          = true
            },
            new ResellerApi.Entities.Courier
            {
                BusinessId        = biz.Id,
                Name              = "SA Paribahan",
                Phone             = "01730-333333",
                InsideDhakaCharge = 100,
                OutsideDhakaCharge= 150,
                ReturnCharge      = 100,
                CodFeeType        = "PCT",
                CodFeeValue       = 1.5m,
                IsDefault         = false,
                TrackingUrlTemplate = null,
                IsActive          = true
            }
        );
        await db.SaveChangesAsync();
    }

    // ── Seed expense categories ───────────────────────────────────────────
    if (biz != null && !await db.ExpenseCategories.IgnoreQueryFilters().AnyAsync(e => e.BusinessId == biz.Id))
    {
        db.ExpenseCategories.AddRange(
            // ── Order fulfilment ─────────────────────────────────────────
            new ResellerApi.Entities.ExpenseCategory { BusinessId = biz.Id, Name = "Courier Charge",       IsDefault = false, IsActive = true },
            new ResellerApi.Entities.ExpenseCategory { BusinessId = biz.Id, Name = "Return Charge",        IsDefault = false, IsActive = true },
            new ResellerApi.Entities.ExpenseCategory { BusinessId = biz.Id, Name = "Packaging Materials",  IsDefault = false, IsActive = true },
            // ── Shop & office ─────────────────────────────────────────────
            new ResellerApi.Entities.ExpenseCategory { BusinessId = biz.Id, Name = "Shop Rent",            IsDefault = false, IsActive = true },
            new ResellerApi.Entities.ExpenseCategory { BusinessId = biz.Id, Name = "Electricity Bill",     IsDefault = false, IsActive = true },
            new ResellerApi.Entities.ExpenseCategory { BusinessId = biz.Id, Name = "Internet & Mobile",    IsDefault = false, IsActive = true },
            // ── Staff ─────────────────────────────────────────────────────
            new ResellerApi.Entities.ExpenseCategory { BusinessId = biz.Id, Name = "Staff Salary",         IsDefault = false, IsActive = true },
            new ResellerApi.Entities.ExpenseCategory { BusinessId = biz.Id, Name = "Staff Food & Tea",     IsDefault = false, IsActive = true },
            // ── Marketing ────────────────────────────────────────────────
            new ResellerApi.Entities.ExpenseCategory { BusinessId = biz.Id, Name = "Facebook Ads / Boost", IsDefault = false, IsActive = true },
            // ── Transport ────────────────────────────────────────────────
            new ResellerApi.Entities.ExpenseCategory { BusinessId = biz.Id, Name = "Transport / Rickshaw", IsDefault = false, IsActive = true },
            // ── Finance ──────────────────────────────────────────────────
            new ResellerApi.Entities.ExpenseCategory { BusinessId = biz.Id, Name = "bKash / Bank Charge",  IsDefault = false, IsActive = true },
            // ── Losses ───────────────────────────────────────────────────
            new ResellerApi.Entities.ExpenseCategory { BusinessId = biz.Id, Name = "Product Damage Loss",  IsDefault = false, IsActive = true },
            // ── Catch-all ────────────────────────────────────────────────
            new ResellerApi.Entities.ExpenseCategory { BusinessId = biz.Id, Name = "Miscellaneous",        IsDefault = true,  IsActive = true }
        );
        await db.SaveChangesAsync();
    }
}

static async Task AddCategoryAsync(
    AppDbContext db, Guid businessId, string name, string defaultUnit,
    List<ResellerApi.Entities.CategoryField> fields)
{
    var cat = new ResellerApi.Entities.Category { BusinessId = businessId, Name = name, DefaultUnit = defaultUnit };
    db.Categories.Add(cat);
    await db.SaveChangesAsync();

    foreach (var f in fields)
    {
        f.CategoryId = cat.Id;
        db.CategoryFields.Add(f);
    }
    if (fields.Count > 0) await db.SaveChangesAsync();
}

static async Task SeedProductsAsync(AppDbContext db, Guid bizId)
{
    var clothCat = await db.Categories.IgnoreQueryFilters()
        .FirstOrDefaultAsync(c => c.BusinessId == bizId && c.Name == "Cloth");
    var toysCat = await db.Categories.IgnoreQueryFilters()
        .FirstOrDefaultAsync(c => c.BusinessId == bizId && c.Name == "Toys");
    var owner = await db.Users.FirstOrDefaultAsync();
    if (clothCat == null || toysCat == null || owner == null) return;

    int bseq = 0;
    string NextBarcode()
    {
        var raw = $"880{++bseq:D5}";
        int sum = 0;
        for (int i = 0; i < raw.Length; i++) sum += (raw[i] - '0') * (i % 2 == 0 ? 3 : 1);
        return raw + (char)('0' + (10 - sum % 10) % 10);
    }

    // ── Cotton T-Shirt ─────────────────────────────────────────────────────
    var pTshirt = new ResellerApi.Entities.Product
    {
        BusinessId = bizId, CategoryId = clothCat.Id, Name = "Cotton T-Shirt",
        Sku = "P-0001", UnitCode = "pcs", SellingPrice = 650, Status = "ACTIVE"
    };
    db.Products.Add(pTshirt);
    await db.SaveChangesAsync();

    var vTSW = new ResellerApi.Entities.ProductVariant { ProductId = pTshirt.Id, Sku = "P-0001-01", Barcode = NextBarcode(), VariantValuesJson = "{\"Size\":\"S\",\"Color\":\"White\"}",  IsDefault = true,  AvgLandedCost = 280 };
    var vTMW = new ResellerApi.Entities.ProductVariant { ProductId = pTshirt.Id, Sku = "P-0001-02", Barcode = NextBarcode(), VariantValuesJson = "{\"Size\":\"M\",\"Color\":\"White\"}",  IsDefault = false, AvgLandedCost = 280 };
    var vTLW = new ResellerApi.Entities.ProductVariant { ProductId = pTshirt.Id, Sku = "P-0001-03", Barcode = NextBarcode(), VariantValuesJson = "{\"Size\":\"L\",\"Color\":\"White\"}",  IsDefault = false, AvgLandedCost = 280 };
    var vTSB = new ResellerApi.Entities.ProductVariant { ProductId = pTshirt.Id, Sku = "P-0001-04", Barcode = NextBarcode(), VariantValuesJson = "{\"Size\":\"S\",\"Color\":\"Black\"}",  IsDefault = false, AvgLandedCost = 290 };
    var vTMB = new ResellerApi.Entities.ProductVariant { ProductId = pTshirt.Id, Sku = "P-0001-05", Barcode = NextBarcode(), VariantValuesJson = "{\"Size\":\"M\",\"Color\":\"Black\"}",  IsDefault = false, AvgLandedCost = 290 };
    db.ProductVariants.AddRange(vTSW, vTMW, vTLW, vTSB, vTMB);
    await db.SaveChangesAsync();

    db.VariantInventories.AddRange(
        new ResellerApi.Entities.VariantInventory { VariantId = vTSW.Id, OnHand = 15 },
        new ResellerApi.Entities.VariantInventory { VariantId = vTMW.Id, OnHand = 22 },
        new ResellerApi.Entities.VariantInventory { VariantId = vTLW.Id, OnHand = 8  },
        new ResellerApi.Entities.VariantInventory { VariantId = vTSB.Id, OnHand = 10 },
        new ResellerApi.Entities.VariantInventory { VariantId = vTMB.Id, OnHand = 18 }
    );
    await db.SaveChangesAsync();

    // ── Denim Jeans ────────────────────────────────────────────────────────
    var pJeans = new ResellerApi.Entities.Product
    {
        BusinessId = bizId, CategoryId = clothCat.Id, Name = "Denim Jeans",
        Sku = "P-0002", UnitCode = "pcs", SellingPrice = 1800, Status = "ACTIVE"
    };
    db.Products.Add(pJeans);
    await db.SaveChangesAsync();

    var vJ32 = new ResellerApi.Entities.ProductVariant { ProductId = pJeans.Id, Sku = "P-0002-01", Barcode = NextBarcode(), VariantValuesJson = "{\"Size\":\"32\",\"Color\":\"Blue\"}", IsDefault = true,  AvgLandedCost = 850 };
    var vJ34 = new ResellerApi.Entities.ProductVariant { ProductId = pJeans.Id, Sku = "P-0002-02", Barcode = NextBarcode(), VariantValuesJson = "{\"Size\":\"34\",\"Color\":\"Blue\"}", IsDefault = false, AvgLandedCost = 850 };
    db.ProductVariants.AddRange(vJ32, vJ34);
    await db.SaveChangesAsync();

    db.VariantInventories.AddRange(
        new ResellerApi.Entities.VariantInventory { VariantId = vJ32.Id, OnHand = 5  },
        new ResellerApi.Entities.VariantInventory { VariantId = vJ34.Id, OnHand = 12 }
    );
    await db.SaveChangesAsync();

    // ── Summer Dress (new — never purchased) ───────────────────────────────
    var pDress = new ResellerApi.Entities.Product
    {
        BusinessId = bizId, CategoryId = clothCat.Id, Name = "Summer Dress",
        Sku = "P-0003", UnitCode = "pcs", SellingPrice = 900, Status = "ACTIVE"
    };
    db.Products.Add(pDress);
    await db.SaveChangesAsync();

    var vDress = new ResellerApi.Entities.ProductVariant { ProductId = pDress.Id, Sku = "P-0003-01", Barcode = NextBarcode(), VariantValuesJson = "{}", IsDefault = true, AvgLandedCost = 0 };
    db.ProductVariants.Add(vDress);
    await db.SaveChangesAsync();

    // ── Toy Racing Car ─────────────────────────────────────────────────────
    var pCar = new ResellerApi.Entities.Product
    {
        BusinessId = bizId, CategoryId = toysCat.Id, Name = "Toy Racing Car",
        Sku = "P-0004", UnitCode = "pcs", SellingPrice = 350, Status = "ACTIVE"
    };
    db.Products.Add(pCar);
    await db.SaveChangesAsync();

    var vCar = new ResellerApi.Entities.ProductVariant { ProductId = pCar.Id, Sku = "P-0004-01", Barcode = NextBarcode(), VariantValuesJson = "{}", IsDefault = true, AvgLandedCost = 120 };
    db.ProductVariants.Add(vCar);
    await db.SaveChangesAsync();

    db.VariantInventories.Add(new ResellerApi.Entities.VariantInventory { VariantId = vCar.Id, OnHand = 30 });
    await db.SaveChangesAsync();

    // ── Building Blocks Set (new — never purchased) ────────────────────────
    var pBlocks = new ResellerApi.Entities.Product
    {
        BusinessId = bizId, CategoryId = toysCat.Id, Name = "Building Blocks Set",
        Sku = "P-0005", UnitCode = "pcs", SellingPrice = 280, Status = "ACTIVE"
    };
    db.Products.Add(pBlocks);
    await db.SaveChangesAsync();

    var vBlocks = new ResellerApi.Entities.ProductVariant { ProductId = pBlocks.Id, Sku = "P-0005-01", Barcode = NextBarcode(), VariantValuesJson = "{}", IsDefault = true, AvgLandedCost = 0 };
    db.ProductVariants.Add(vBlocks);
    await db.SaveChangesAsync();

    // ── Completed purchase trip (populates "Recently Purchased" section) ───
    var trip = new ResellerApi.Entities.PurchaseTrip
    {
        BusinessId = bizId,
        TripNo = "TRIP-001",
        SourceType = "CHINA_TRIP",
        Status = "COMPLETED",
        CreatedBy = owner.Id,
        CompletedAt = DateTime.UtcNow.AddDays(-15)
    };
    db.PurchaseTrips.Add(trip);
    await db.SaveChangesAsync();

    db.PurchaseItems.AddRange(
        new ResellerApi.Entities.PurchaseItem { TripId = trip.Id, VariantId = vTMW.Id, QtyBought = 50, TotalCost = 14000, LandedUnitCost = 280 },
        new ResellerApi.Entities.PurchaseItem { TripId = trip.Id, VariantId = vJ34.Id, QtyBought = 20, TotalCost = 17000, LandedUnitCost = 850 },
        new ResellerApi.Entities.PurchaseItem { TripId = trip.Id, VariantId = vCar.Id,  QtyBought = 30, TotalCost =  3600, LandedUnitCost = 120 }
    );
    await db.SaveChangesAsync();
}
