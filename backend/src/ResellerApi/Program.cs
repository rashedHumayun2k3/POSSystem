using System.Text;
using System.Threading.RateLimiting;
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
builder.Services.AddScoped<ClientPageShopContext>();
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
builder.Services.AddScoped<IEmailSender, EmailSender>();
builder.Services.AddScoped<ICategoryPresetService, CategoryPresetService>();
// Phase 2 — Catalog
builder.Services.AddScoped<ICategoryService, CategoryService>();
builder.Services.AddScoped<IProductService, ProductService>();
builder.Services.AddScoped<IPriceHistoryService, PriceHistoryService>();
builder.Services.AddScoped<IPriceSlotService, PriceSlotService>();
builder.Services.AddScoped<IPopularityService, PopularityService>();
builder.Services.AddScoped<IStockAdjustmentService, StockAdjustmentService>();
// Phase 3 — Inventory / Purchases
builder.Services.AddScoped<IPurchaseTripService, PurchaseTripService>();
builder.Services.AddScoped<ISuppliersService, SuppliersService>();
// Carton module
builder.Services.AddScoped<ICartonService, CartonService>();
// Phase 4 — Orders
builder.Services.AddScoped<ICustomerService, CustomerService>();
builder.Services.AddScoped<IOrderService, OrderService>();
builder.Services.AddScoped<IRemittanceService, RemittanceService>();
// Module 15 — Partnership & Capital Ledger (sub-phase 15a)
builder.Services.AddScoped<IPartnerCapitalService, PartnerCapitalService>();
builder.Services.AddScoped<IPartnerService, PartnerService>();
// Phase 7 — Expenses & Petty Cash
builder.Services.AddScoped<IExpenseService, ExpenseService>();
builder.Services.AddScoped<IPettyCashService, PettyCashService>();
// Phase 10 — Reports
builder.Services.AddScoped<IReportService, ReportService>();
// Media upload/download now lives entirely in the standalone ResellerApi.MediaService app.
// Subscriptions & billing
builder.Services.AddHttpClient<IBkashPaymentService, BkashPaymentService>();
builder.Services.AddScoped<ISubscriptionService, SubscriptionService>();
// Platform Admin
builder.Services.AddScoped<IPlatformAdminService, PlatformAdminService>();
// Product Reviews
builder.Services.AddHttpClient(); // generic IHttpClientFactory — used by ClientPageAuthService for Facebook Graph API calls
builder.Services.AddScoped<IClientPageAuthService, ClientPageAuthService>();
builder.Services.AddScoped<IProductReviewService, ProductReviewService>();
builder.Services.AddScoped<IFeedbackService, FeedbackService>();
// Catalog Templates (suggested categories/products)
builder.Services.AddScoped<ISuggestedCatalogService, SuggestedCatalogService>();

builder.Services.AddScoped<IClientPageCatalogService, ClientPageCatalogService>();
builder.Services.AddScoped<IClientPageCheckoutService, ClientPageCheckoutService>();

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

// ── Rate limiting (signup endpoints) ────────────────────────────────────────
builder.Services.AddRateLimiter(options =>
{
    options.AddPolicy("signup", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(15),
                QueueLimit = 0
            }));
    options.AddPolicy("password-reset", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromMinutes(15),
                QueueLimit = 0
            }));
    options.AddPolicy("find-email", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromMinutes(15),
                QueueLimit = 0
            }));
    options.AddPolicy("clientpage-checkout", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromMinutes(15),
                QueueLimit = 0
            }));
    options.AddPolicy("clientpage-review", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(15),
                QueueLimit = 0
            }));
    options.OnRejected = async (context, token) =>
    {
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        await context.HttpContext.Response.WriteAsJsonAsync(
            new { code = "RATE_LIMITED", message = "Too many requests. Please try again later." }, token);
    };
});

// ─────────────────────────────────────────────────────────────────────────
var app = builder.Build();

// First in the pipeline so it wraps every downstream request/middleware.
app.UseMiddleware<ConcurrencyExceptionMiddleware>();

// Uploaded-file serving now lives entirely in the standalone ResellerApi.MediaService app
// (localhost:5090 in dev) — this app no longer serves /uploads at all.

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
app.UseRateLimiter();
app.UseMiddleware<BusinessContextMiddleware>();
app.UseMiddleware<SubscriptionGateMiddleware>();
app.UseMiddleware<ClientPageShopContextMiddleware>();

app.UseHangfireDashboard("/hangfire", new DashboardOptions
{
    Authorization = [] // restrict in production
});

// ── Hangfire recurring jobs ───────────────────────────────────────────────
RecurringJob.AddOrUpdate<IPriceHistoryService>(
    "apply-scheduled-prices",
    svc => svc.ApplyScheduledPriceChangesAsync(),
    "*/5 * * * *"); // every 5 minutes

RecurringJob.AddOrUpdate<ISubscriptionService>(
    "expire-subscriptions",
    svc => svc.ExpireDueSubscriptionsAsync(),
    "0 * * * *"); // hourly

RecurringJob.AddOrUpdate<IPopularityService>(
    "recompute-popularity-and-ratings",
    svc => svc.RecomputeAsync(),
    "0 21 * * *"); // once daily, off-peak

app.MapControllers();
app.MapHub<LiveHub>("/hubs/live");

// Unauthenticated connectivity probe — frontend calls this once at startup and treats a
// network-level failure (no response at all) as "server unreachable", distinct from normal
// HTTP error responses which mean the server is fine.
app.MapGet("/api/v1/health", async (AppDbContext db) =>
    await db.Database.CanConnectAsync() ? Results.Ok(new { status = "ok" }) : Results.StatusCode(503));

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

        db.Branches.Add(new ResellerApi.Entities.Branch
        {
            BusinessId = business.Id,
            Name = "Main Branch",
            Code = "MAIN",
            IsActive = true,
            IsDefault = true
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

    // ── Platform admin account ────────────────────────────────────────────
    // Seeded once, DB-backed from here on — password is changed via SQL UPDATE against
    // platform_admin_accounts.PasswordHash (a bcrypt hash), not via config/redeploy.
    if (!await db.PlatformAdminAccounts.AnyAsync())
    {
        db.PlatformAdminAccounts.Add(new ResellerApi.Entities.PlatformAdminAccount
        {
            Username = "admin",
            PasswordHash = "$2a$11$0Z3h124DZbreexz3NyHtROnKBoAT8WqaworuDbkQNFs3uJjmwTyPC",
            IsActive = true
        });
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
    var seedMainBranch = biz == null ? null : await db.Branches.IgnoreQueryFilters().FirstOrDefaultAsync(b => b.BusinessId == biz.Id);
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

    // ── Seed sample customers ─────────────────────────────────────────────
    if (biz != null && !await db.Customers.IgnoreQueryFilters().AnyAsync(c => c.BusinessId == biz.Id))
    {
        db.Customers.AddRange(
            new ResellerApi.Entities.Customer
            {
                BusinessId = biz.Id, Name = "Rahim Uddin", Phone = "01711000001",
                Address = "House 12, Road 5, Mirpur-10, Dhaka",
                CreditLimit = 5000, StoreCreditBalance = 0, IsRejecterFlag = false
            },
            new ResellerApi.Entities.Customer
            {
                BusinessId = biz.Id, Name = "Karim Hossain", Phone = "01712000002",
                Address = "Flat 3B, Jigatala, Dhaka-1209",
                CreditLimit = 3000, StoreCreditBalance = 200, IsRejecterFlag = false
            },
            new ResellerApi.Entities.Customer
            {
                BusinessId = biz.Id, Name = "Sumaiya Begum", Phone = "01813000003",
                Address = "Village: Gopalpur, Thana: Savar, Dhaka",
                CreditLimit = 2000, StoreCreditBalance = 0, IsRejecterFlag = false
            },
            new ResellerApi.Entities.Customer
            {
                BusinessId = biz.Id, Name = "Nasrin Akter", Phone = "01914000004",
                Address = "Mohammadpur, Dhaka",
                CreditLimit = 1000, StoreCreditBalance = 0, IsRejecterFlag = false
            },
            new ResellerApi.Entities.Customer
            {
                BusinessId = biz.Id, Name = "Jahir Rahman", Phone = "01615000005",
                Address = "Chittagong City, Ward-15",
                CreditLimit = 4000, StoreCreditBalance = 500, IsRejecterFlag = false
            },
            new ResellerApi.Entities.Customer
            {
                BusinessId = biz.Id, Name = "Farida Khanam", Phone = "01516000006",
                Address = "Sylhet Sadar, Sylhet",
                CreditLimit = 1000, StoreCreditBalance = 0, IsRejecterFlag = true,
                Note = "Returned 3 orders without reason"
            },
            new ResellerApi.Entities.Customer
            {
                BusinessId = biz.Id, Name = "Anwar Islam", Phone = "01817000007",
                Address = "Narayanganj, Fatullah",
                CreditLimit = 2000, StoreCreditBalance = 0, IsRejecterFlag = false
            },
            new ResellerApi.Entities.Customer
            {
                BusinessId = biz.Id, Name = "Mitu Akter", Phone = "01718000008",
                Address = "Uttara, Sector-7, Dhaka",
                CreditLimit = 3000, StoreCreditBalance = 100, IsRejecterFlag = false
            }
        );
        await db.SaveChangesAsync();
    }

    // ── Seed sample orders ────────────────────────────────────────────────
    if (biz != null && !await db.Orders.IgnoreQueryFilters().AnyAsync(o => o.BusinessId == biz.Id))
    {
        var ownerUser   = await db.Users.FirstOrDefaultAsync();
        var varTMW      = await db.ProductVariants.IgnoreQueryFilters().FirstOrDefaultAsync(v => v.Sku == "P-0001-02");
        var varTLW      = await db.ProductVariants.IgnoreQueryFilters().FirstOrDefaultAsync(v => v.Sku == "P-0001-03");
        var varJ34      = await db.ProductVariants.IgnoreQueryFilters().FirstOrDefaultAsync(v => v.Sku == "P-0002-02");
        var varCar      = await db.ProductVariants.IgnoreQueryFilters().FirstOrDefaultAsync(v => v.Sku == "P-0004-01");
        var cRahim      = await db.Customers.IgnoreQueryFilters().FirstOrDefaultAsync(c => c.Phone == "01711000001");
        var cKarim      = await db.Customers.IgnoreQueryFilters().FirstOrDefaultAsync(c => c.Phone == "01712000002");
        var cSumaiya    = await db.Customers.IgnoreQueryFilters().FirstOrDefaultAsync(c => c.Phone == "01813000003");
        var cNasrin     = await db.Customers.IgnoreQueryFilters().FirstOrDefaultAsync(c => c.Phone == "01914000004");
        var cJahir      = await db.Customers.IgnoreQueryFilters().FirstOrDefaultAsync(c => c.Phone == "01615000005");
        var steadfast   = await db.Couriers.IgnoreQueryFilters().FirstOrDefaultAsync(c => c.BusinessId == biz.Id);

        if (ownerUser != null && varTMW != null && varJ34 != null && varCar != null && cRahim != null)
        {
            int seq = 0;
            string NextOrderNo() => $"ORD-{++seq:D4}";

            // ── Order 1: Confirmed, Packed, In-transit ───────────────────
            var o1 = new ResellerApi.Entities.Order
            {
                BusinessId = biz.Id, BranchId = seedMainBranch!.Id, OrderNo = NextOrderNo(), Channel = "FACEBOOK",
                CustomerId = cRahim?.Id, CustomerName = "Rahim Uddin", CustomerPhone = "01711000001",
                CustomerAddress = "House 12, Road 5, Mirpur-10, Dhaka",
                OrderStatus = "OPEN", PaymentStatus = "UNPAID", FulfillmentStatus = "IN_TRANSIT",
                IsDraft = false,
                DeliveryChargeCustomer = 130, DeliveryCostActual = 130,
                CourierId = steadfast?.Id, TrackingNo = "SS-20260001",
                CreatedBy = ownerUser.Id, ConfirmedAt = DateTime.UtcNow.AddDays(-3),
                HandedOverAt = DateTime.UtcNow.AddDays(-2)
            };
            db.Orders.Add(o1);
            await db.SaveChangesAsync();
            if (varTMW != null) db.OrderItems.Add(new ResellerApi.Entities.OrderItem { OrderId = o1.Id, VariantId = varTMW.Id, Qty = 2, UnitPrice = 650, UnitCostSnapshot = 280 });
            if (varJ34 != null) db.OrderItems.Add(new ResellerApi.Entities.OrderItem { OrderId = o1.Id, VariantId = varJ34.Id, Qty = 1, UnitPrice = 1800, UnitCostSnapshot = 850 });
            await db.SaveChangesAsync();

            // ── Order 2: Draft ───────────────────────────────────────────
            var o2 = new ResellerApi.Entities.Order
            {
                BusinessId = biz.Id, BranchId = seedMainBranch!.Id, OrderNo = NextOrderNo(), Channel = "WHATSAPP",
                CustomerId = cKarim?.Id, CustomerName = "Karim Hossain", CustomerPhone = "01712000002",
                CustomerAddress = "Flat 3B, Jigatala, Dhaka-1209",
                OrderStatus = "OPEN", PaymentStatus = "UNPAID", FulfillmentStatus = "UNFULFILLED",
                IsDraft = true, DeliveryChargeCustomer = 70,
                CreatedBy = ownerUser.Id
            };
            db.Orders.Add(o2);
            await db.SaveChangesAsync();
            if (varTMW != null) db.OrderItems.Add(new ResellerApi.Entities.OrderItem { OrderId = o2.Id, VariantId = varTMW.Id, Qty = 3, UnitPrice = 650 });
            await db.SaveChangesAsync();

            // ── Order 3: Confirmed, Partially Paid ──────────────────────
            var o3 = new ResellerApi.Entities.Order
            {
                BusinessId = biz.Id, BranchId = seedMainBranch!.Id, OrderNo = NextOrderNo(), Channel = "FACEBOOK",
                CustomerId = cSumaiya?.Id, CustomerName = "Sumaiya Begum", CustomerPhone = "01813000003",
                CustomerAddress = "Village: Gopalpur, Thana: Savar, Dhaka",
                OrderStatus = "OPEN", PaymentStatus = "PARTIALLY_PAID", FulfillmentStatus = "PACKED",
                IsDraft = false, DeliveryChargeCustomer = 130, AdvancePaid = 200,
                CreatedBy = ownerUser.Id, ConfirmedAt = DateTime.UtcNow.AddDays(-1)
            };
            db.Orders.Add(o3);
            await db.SaveChangesAsync();
            if (varCar != null) db.OrderItems.Add(new ResellerApi.Entities.OrderItem { OrderId = o3.Id, VariantId = varCar.Id, Qty = 2, UnitPrice = 350, UnitCostSnapshot = 120 });
            db.OrderPayments.Add(new ResellerApi.Entities.OrderPayment { OrderId = o3.Id, Method = "BKASH", Amount = 200, ReceivedAt = DateTime.UtcNow.AddDays(-1), UserId = ownerUser.Id });
            await db.SaveChangesAsync();

            // ── Order 4: Delivered, COD pending remittance (courier holds cash) ──
            var o4 = new ResellerApi.Entities.Order
            {
                BusinessId = biz.Id, BranchId = seedMainBranch!.Id, OrderNo = NextOrderNo(), Channel = "PHONE",
                CustomerId = cNasrin?.Id, CustomerName = "Nasrin Akter", CustomerPhone = "01914000004",
                CustomerAddress = "Mohammadpur, Dhaka",
                OrderStatus = "COMPLETED", PaymentStatus = "UNPAID", FulfillmentStatus = "DELIVERED",
                IsDraft = false, DeliveryChargeCustomer = 70,
                DiscountType = "FIXED", DiscountValue = 50,
                CourierId = steadfast?.Id, TrackingNo = "SS-20260002",
                CodRemittanceStatus = "PENDING",
                CreatedBy = ownerUser.Id,
                ConfirmedAt = DateTime.UtcNow.AddDays(-10),
                HandedOverAt = DateTime.UtcNow.AddDays(-9),
                DeliveredAt = DateTime.UtcNow.AddDays(-7)
            };
            db.Orders.Add(o4);
            await db.SaveChangesAsync();
            if (varTLW != null) db.OrderItems.Add(new ResellerApi.Entities.OrderItem { OrderId = o4.Id, VariantId = varTLW.Id, Qty = 1, UnitPrice = 650, UnitCostSnapshot = 280 });
            await db.SaveChangesAsync();

            // ── Order 5: Cancelled ───────────────────────────────────────
            var o5 = new ResellerApi.Entities.Order
            {
                BusinessId = biz.Id, BranchId = seedMainBranch!.Id, OrderNo = NextOrderNo(), Channel = "INSTAGRAM",
                CustomerId = cJahir?.Id, CustomerName = "Jahir Rahman", CustomerPhone = "01615000005",
                CustomerAddress = "Chittagong City, Ward-15",
                OrderStatus = "CANCELLED", PaymentStatus = "UNPAID", FulfillmentStatus = "UNFULFILLED",
                IsDraft = false, DeliveryChargeCustomer = 130,
                CancelledReason = "Customer unreachable after 3 calls",
                CodRemittanceStatus = "NOT_APPLICABLE",
                CreatedBy = ownerUser.Id, ConfirmedAt = DateTime.UtcNow.AddDays(-5)
            };
            db.Orders.Add(o5);
            await db.SaveChangesAsync();
            if (varJ34 != null) db.OrderItems.Add(new ResellerApi.Entities.OrderItem { OrderId = o5.Id, VariantId = varJ34.Id, Qty = 1, UnitPrice = 1800 });
            await db.SaveChangesAsync();

            // ── Order 6: Open, Unpaid (brand new) ───────────────────────
            var o6 = new ResellerApi.Entities.Order
            {
                BusinessId = biz.Id, BranchId = seedMainBranch!.Id, OrderNo = NextOrderNo(), Channel = "FACEBOOK",
                CustomerName = "Walk-in Customer", CustomerPhone = "01700000099",
                CustomerAddress = "Dhaka",
                OrderStatus = "OPEN", PaymentStatus = "UNPAID", FulfillmentStatus = "UNFULFILLED",
                IsDraft = false, DeliveryChargeCustomer = 70,
                CreatedBy = ownerUser.Id, ConfirmedAt = DateTime.UtcNow
            };
            db.Orders.Add(o6);
            await db.SaveChangesAsync();
            if (varCar != null) db.OrderItems.Add(new ResellerApi.Entities.OrderItem { OrderId = o6.Id, VariantId = varCar.Id, Qty = 1, UnitPrice = 350 });
            await db.SaveChangesAsync();
        }
    }

    // ── Seed additional sample orders (7-12) if not yet present ─────────
    if (biz != null && !await db.Orders.IgnoreQueryFilters().AnyAsync(o => o.BusinessId == biz.Id && o.OrderNo == "ORD-0007"))
    {
        var ownerUser2  = await db.Users.FirstOrDefaultAsync();
        var varTMW2     = await db.ProductVariants.IgnoreQueryFilters().FirstOrDefaultAsync(v => v.Sku == "P-0001-02");
        var varTLW2     = await db.ProductVariants.IgnoreQueryFilters().FirstOrDefaultAsync(v => v.Sku == "P-0001-03");
        var varJ342     = await db.ProductVariants.IgnoreQueryFilters().FirstOrDefaultAsync(v => v.Sku == "P-0002-02");
        var varCar2     = await db.ProductVariants.IgnoreQueryFilters().FirstOrDefaultAsync(v => v.Sku == "P-0004-01");
        var steadfast2  = await db.Couriers.IgnoreQueryFilters().FirstOrDefaultAsync(c => c.BusinessId == biz.Id);

        if (ownerUser2 != null)
        {
            int seq2 = 6;
            string NextNo() => $"ORD-{++seq2:D4}";

            // ── Order 7: Delivered & Fully Paid (Completed) ─────────────
            var o7 = new ResellerApi.Entities.Order
            {
                BusinessId = biz.Id, BranchId = seedMainBranch!.Id, OrderNo = NextNo(), Channel = "FACEBOOK",
                CustomerName = "Rafiqul Islam", CustomerPhone = "01811111111",
                CustomerAddress = "Uttara, Sector 11, Dhaka",
                OrderStatus = "COMPLETED", PaymentStatus = "PAID", FulfillmentStatus = "DELIVERED",
                IsDraft = false, DeliveryChargeCustomer = 130, DeliveryCostActual = 130,
                CourierId = steadfast2?.Id, TrackingNo = "SS-20260010",
                CodRemittanceStatus = "NOT_APPLICABLE",
                CreatedBy = ownerUser2.Id,
                ConfirmedAt = DateTime.UtcNow.AddDays(-14),
                HandedOverAt = DateTime.UtcNow.AddDays(-13),
                DeliveredAt = DateTime.UtcNow.AddDays(-11)
            };
            db.Orders.Add(o7);
            await db.SaveChangesAsync();
            if (varTMW2 != null) db.OrderItems.Add(new ResellerApi.Entities.OrderItem { OrderId = o7.Id, VariantId = varTMW2.Id, Qty = 1, UnitPrice = 650, UnitCostSnapshot = 280 });
            db.OrderPayments.Add(new ResellerApi.Entities.OrderPayment { OrderId = o7.Id, Method = "BKASH", Amount = 780, ReceivedAt = DateTime.UtcNow.AddDays(-13), UserId = ownerUser2.Id });
            await db.SaveChangesAsync();

            // ── Order 8: Returned ────────────────────────────────────────
            var o8 = new ResellerApi.Entities.Order
            {
                BusinessId = biz.Id, BranchId = seedMainBranch!.Id, OrderNo = NextNo(), Channel = "WHATSAPP",
                CustomerName = "Shirin Akter", CustomerPhone = "01922222222",
                CustomerAddress = "Comilla Sadar, Comilla",
                OrderStatus = "COMPLETED", PaymentStatus = "UNPAID", FulfillmentStatus = "RETURNED",
                IsDraft = false, DeliveryChargeCustomer = 130, DeliveryCostActual = 130,
                CourierId = steadfast2?.Id, TrackingNo = "SS-20260011",
                CodRemittanceStatus = "NOT_APPLICABLE",
                CancelledReason = "Customer refused delivery",
                CreatedBy = ownerUser2.Id,
                ConfirmedAt = DateTime.UtcNow.AddDays(-8),
                HandedOverAt = DateTime.UtcNow.AddDays(-7)
            };
            db.Orders.Add(o8);
            await db.SaveChangesAsync();
            if (varJ342 != null) db.OrderItems.Add(new ResellerApi.Entities.OrderItem { OrderId = o8.Id, VariantId = varJ342.Id, Qty = 1, UnitPrice = 1800, UnitCostSnapshot = 850 });
            await db.SaveChangesAsync();

            // ── Order 9: COD pending (another Steadfast delivered order) ─
            var o9 = new ResellerApi.Entities.Order
            {
                BusinessId = biz.Id, BranchId = seedMainBranch!.Id, OrderNo = NextNo(), Channel = "INSTAGRAM",
                CustomerName = "Tania Sultana", CustomerPhone = "01633333333",
                CustomerAddress = "Gazipur Sadar, Gazipur",
                OrderStatus = "COMPLETED", PaymentStatus = "UNPAID", FulfillmentStatus = "DELIVERED",
                IsDraft = false, DeliveryChargeCustomer = 60,
                CourierId = steadfast2?.Id, TrackingNo = "SS-20260012",
                CodRemittanceStatus = "PENDING",
                CreatedBy = ownerUser2.Id,
                ConfirmedAt = DateTime.UtcNow.AddDays(-6),
                HandedOverAt = DateTime.UtcNow.AddDays(-5),
                DeliveredAt = DateTime.UtcNow.AddDays(-3)
            };
            db.Orders.Add(o9);
            await db.SaveChangesAsync();
            if (varCar2 != null) db.OrderItems.Add(new ResellerApi.Entities.OrderItem { OrderId = o9.Id, VariantId = varCar2.Id, Qty = 3, UnitPrice = 350, UnitCostSnapshot = 120 });
            await db.SaveChangesAsync();

            // ── Order 10: Shop counter sale, Paid ────────────────────────
            var o10 = new ResellerApi.Entities.Order
            {
                BusinessId = biz.Id, BranchId = seedMainBranch!.Id, OrderNo = NextNo(), Channel = "SHOP",
                CustomerName = "Counter Customer", CustomerPhone = "01744444444",
                OrderStatus = "COMPLETED", PaymentStatus = "PAID", FulfillmentStatus = "DELIVERED",
                IsDraft = false, DeliveryChargeCustomer = 0,
                CodRemittanceStatus = "NOT_APPLICABLE",
                CreatedBy = ownerUser2.Id,
                ConfirmedAt = DateTime.UtcNow.AddDays(-2),
                DeliveredAt = DateTime.UtcNow.AddDays(-2)
            };
            db.Orders.Add(o10);
            await db.SaveChangesAsync();
            if (varTLW2 != null) db.OrderItems.Add(new ResellerApi.Entities.OrderItem { OrderId = o10.Id, VariantId = varTLW2.Id, Qty = 2, UnitPrice = 650, UnitCostSnapshot = 280 });
            db.OrderPayments.Add(new ResellerApi.Entities.OrderPayment { OrderId = o10.Id, Method = "CASH", Amount = 1300, ReceivedAt = DateTime.UtcNow.AddDays(-2), UserId = ownerUser2.Id });
            await db.SaveChangesAsync();

            // ── Order 11: Draft, two items ───────────────────────────────
            var o11 = new ResellerApi.Entities.Order
            {
                BusinessId = biz.Id, BranchId = seedMainBranch!.Id, OrderNo = NextNo(), Channel = "FACEBOOK",
                CustomerName = "Farhana Khanom", CustomerPhone = "01755555555",
                OrderStatus = "OPEN", PaymentStatus = "UNPAID", FulfillmentStatus = "UNFULFILLED",
                IsDraft = true, DeliveryChargeCustomer = 130,
                CreatedBy = ownerUser2.Id
            };
            db.Orders.Add(o11);
            await db.SaveChangesAsync();
            if (varTMW2 != null) db.OrderItems.Add(new ResellerApi.Entities.OrderItem { OrderId = o11.Id, VariantId = varTMW2.Id, Qty = 2, UnitPrice = 650 });
            if (varCar2 != null) db.OrderItems.Add(new ResellerApi.Entities.OrderItem { OrderId = o11.Id, VariantId = varCar2.Id, Qty = 1, UnitPrice = 350 });
            await db.SaveChangesAsync();

            // ── Order 12: Confirmed with 10% discount, Partially paid ────
            var o12 = new ResellerApi.Entities.Order
            {
                BusinessId = biz.Id, BranchId = seedMainBranch!.Id, OrderNo = NextNo(), Channel = "PHONE",
                CustomerName = "Belal Hossain", CustomerPhone = "01666666666",
                CustomerAddress = "Sylhet Sadar, Sylhet",
                OrderStatus = "OPEN", PaymentStatus = "PARTIALLY_PAID", FulfillmentStatus = "UNFULFILLED",
                IsDraft = false, DeliveryChargeCustomer = 130,
                DiscountType = "PERCENT", DiscountValue = 10,
                AdvancePaid = 500,
                CreatedBy = ownerUser2.Id, ConfirmedAt = DateTime.UtcNow.AddHours(-3)
            };
            db.Orders.Add(o12);
            await db.SaveChangesAsync();
            if (varJ342 != null) db.OrderItems.Add(new ResellerApi.Entities.OrderItem { OrderId = o12.Id, VariantId = varJ342.Id, Qty = 2, UnitPrice = 1800, UnitCostSnapshot = 850 });
            db.OrderPayments.Add(new ResellerApi.Entities.OrderPayment { OrderId = o12.Id, Method = "NAGAD", Amount = 500, ReceivedAt = DateTime.UtcNow.AddHours(-3), UserId = ownerUser2.Id });
            await db.SaveChangesAsync();
        }
    }

    // ── Seed extended orders (13-30) covering return/refund/exchange scenarios ──
    if (biz != null && !await db.Orders.IgnoreQueryFilters().AnyAsync(o => o.BusinessId == biz.Id && o.OrderNo == "ORD-0013"))
    {
        var u       = await db.Users.FirstOrDefaultAsync();
        var vT      = await db.ProductVariants.IgnoreQueryFilters().FirstOrDefaultAsync(v => v.Sku == "P-0001-02"); // T-shirt M White
        var vTL     = await db.ProductVariants.IgnoreQueryFilters().FirstOrDefaultAsync(v => v.Sku == "P-0001-03"); // T-shirt L White
        var vJ      = await db.ProductVariants.IgnoreQueryFilters().FirstOrDefaultAsync(v => v.Sku == "P-0002-02"); // Jeans W34
        var vC      = await db.ProductVariants.IgnoreQueryFilters().FirstOrDefaultAsync(v => v.Sku == "P-0004-01"); // Carton
        var cRahim  = await db.Customers.IgnoreQueryFilters().FirstOrDefaultAsync(c => c.Phone == "01711000001");
        var cKarim  = await db.Customers.IgnoreQueryFilters().FirstOrDefaultAsync(c => c.Phone == "01712000002");
        var cSumaiya= await db.Customers.IgnoreQueryFilters().FirstOrDefaultAsync(c => c.Phone == "01813000003");
        var cNasrin = await db.Customers.IgnoreQueryFilters().FirstOrDefaultAsync(c => c.Phone == "01914000004");
        var cJahir  = await db.Customers.IgnoreQueryFilters().FirstOrDefaultAsync(c => c.Phone == "01615000005");
        var cFarida = await db.Customers.IgnoreQueryFilters().FirstOrDefaultAsync(c => c.Phone == "01516000006"); // serial rejecter
        var cAnwar  = await db.Customers.IgnoreQueryFilters().FirstOrDefaultAsync(c => c.Phone == "01817000007");
        var cMitu   = await db.Customers.IgnoreQueryFilters().FirstOrDefaultAsync(c => c.Phone == "01718000008");
        var courier = await db.Couriers.IgnoreQueryFilters().FirstOrDefaultAsync(c => c.BusinessId == biz.Id);

        if (u != null)
        {
            // ── ORD-0013: COURIER RETURN — parcel bounced back (Farida, serial rejecter) ──
            var o13 = new ResellerApi.Entities.Order {
                BusinessId = biz.Id, BranchId = seedMainBranch!.Id, OrderNo = "ORD-0013",
                Channel = "FACEBOOK", CustomerName = cFarida?.Name ?? "Farida Khanam",
                CustomerPhone = cFarida?.Phone ?? "01516000006", CustomerId = cFarida?.Id,
                CustomerAddress = "Sylhet Sadar, Sylhet",
                OrderStatus = "OPEN", PaymentStatus = "UNPAID",
                FulfillmentStatus = "RETURNED",
                IsDraft = false, DeliveryChargeCustomer = 130,
                CourierId = courier?.Id, TrackingNo = "SS-20260013",
                CodRemittanceStatus = "NOT_APPLICABLE",
                ReturnResolution = "COURIER_RETURN",
                ReturnNote = "Customer refused to receive — serial rejecter flag set",
                ReturnedAt = DateTime.UtcNow.AddDays(-1),
                CreatedBy = u.Id, ConfirmedAt = DateTime.UtcNow.AddDays(-5),
                HandedOverAt = DateTime.UtcNow.AddDays(-3)
            };
            db.Orders.Add(o13); await db.SaveChangesAsync();
            if (vT != null) db.OrderItems.Add(new ResellerApi.Entities.OrderItem { OrderId = o13.Id, VariantId = vT.Id, Qty = 2, UnitPrice = 650, UnitCostSnapshot = 280 });
            await db.SaveChangesAsync();

            // ── ORD-0014: REFUND — customer returned wrong size, full cash refund ──
            var o14 = new ResellerApi.Entities.Order {
                BusinessId = biz.Id, BranchId = seedMainBranch!.Id, OrderNo = "ORD-0014",
                Channel = "WHATSAPP", CustomerName = cMitu?.Name ?? "Mitu Akter",
                CustomerPhone = cMitu?.Phone ?? "01718000008", CustomerId = cMitu?.Id,
                CustomerAddress = "Uttara, Sector-7, Dhaka",
                OrderStatus = "OPEN", PaymentStatus = "REFUNDED",
                FulfillmentStatus = "RETURNED",
                IsDraft = false, DeliveryChargeCustomer = 70,
                CourierId = courier?.Id, TrackingNo = "SS-20260014",
                CodRemittanceStatus = "NOT_APPLICABLE",
                ReturnResolution = "REFUND",
                ReturnNote = "Wrong size ordered — full bKash refund",
                ReturnedAt = DateTime.UtcNow.AddDays(-2),
                CreatedBy = u.Id, ConfirmedAt = DateTime.UtcNow.AddDays(-8),
                HandedOverAt = DateTime.UtcNow.AddDays(-6), DeliveredAt = DateTime.UtcNow.AddDays(-5)
            };
            db.Orders.Add(o14); await db.SaveChangesAsync();
            if (vTL != null) db.OrderItems.Add(new ResellerApi.Entities.OrderItem { OrderId = o14.Id, VariantId = vTL.Id, Qty = 1, UnitPrice = 650, UnitCostSnapshot = 280 });
            db.OrderPayments.Add(new ResellerApi.Entities.OrderPayment { OrderId = o14.Id, Method = "COD", Amount = 720, ReceivedAt = DateTime.UtcNow.AddDays(-5), UserId = u.Id });
            db.OrderPayments.Add(new ResellerApi.Entities.OrderPayment { OrderId = o14.Id, Method = "REFUND_BKASH", Amount = -720, ReceivedAt = DateTime.UtcNow.AddDays(-2), UserId = u.Id });
            await db.SaveChangesAsync();

            // ── ORD-0015: STORE CREDIT — damaged item, customer wants credit instead of cash ──
            var o15 = new ResellerApi.Entities.Order {
                BusinessId = biz.Id, BranchId = seedMainBranch!.Id, OrderNo = "ORD-0015",
                Channel = "INSTAGRAM", CustomerName = cAnwar?.Name ?? "Anwar Islam",
                CustomerPhone = cAnwar?.Phone ?? "01817000007", CustomerId = cAnwar?.Id,
                CustomerAddress = "Narayanganj, Fatullah",
                OrderStatus = "OPEN", PaymentStatus = "REFUNDED",
                FulfillmentStatus = "RETURNED",
                IsDraft = false, DeliveryChargeCustomer = 130,
                CourierId = courier?.Id, TrackingNo = "SS-20260015",
                CodRemittanceStatus = "NOT_APPLICABLE",
                ReturnResolution = "STORE_CREDIT",
                ReturnNote = "Item arrived damaged — customer chose store credit",
                ReturnedAt = DateTime.UtcNow.AddDays(-3),
                CreatedBy = u.Id, ConfirmedAt = DateTime.UtcNow.AddDays(-12),
                HandedOverAt = DateTime.UtcNow.AddDays(-10), DeliveredAt = DateTime.UtcNow.AddDays(-9)
            };
            db.Orders.Add(o15); await db.SaveChangesAsync();
            if (vJ != null) db.OrderItems.Add(new ResellerApi.Entities.OrderItem { OrderId = o15.Id, VariantId = vJ.Id, Qty = 1, UnitPrice = 1800, UnitCostSnapshot = 850 });
            db.OrderPayments.Add(new ResellerApi.Entities.OrderPayment { OrderId = o15.Id, Method = "COD", Amount = 1930, ReceivedAt = DateTime.UtcNow.AddDays(-9), UserId = u.Id });
            db.OrderPayments.Add(new ResellerApi.Entities.OrderPayment { OrderId = o15.Id, Method = "STORE_CREDIT", Amount = -1930, ReceivedAt = DateTime.UtcNow.AddDays(-3), UserId = u.Id });
            await db.SaveChangesAsync();

            // ── ORD-0016: EXCHANGE — wrong product, waiting for replacement ──
            var o16 = new ResellerApi.Entities.Order {
                BusinessId = biz.Id, BranchId = seedMainBranch!.Id, OrderNo = "ORD-0016",
                Channel = "PHONE", CustomerName = cJahir?.Name ?? "Jahir Rahman",
                CustomerPhone = cJahir?.Phone ?? "01615000005", CustomerId = cJahir?.Id,
                CustomerAddress = "Chittagong City, Ward-15",
                OrderStatus = "OPEN", PaymentStatus = "PAID",
                FulfillmentStatus = "RETURNED",
                IsDraft = false, DeliveryChargeCustomer = 130,
                CourierId = courier?.Id, TrackingNo = "SS-20260016",
                CodRemittanceStatus = "NOT_APPLICABLE",
                ReturnResolution = "EXCHANGE_DIFFERENT",
                ReturnNote = "Sent wrong item — replacement order ORD-0017 created",
                ReturnedAt = DateTime.UtcNow.AddDays(-1),
                CreatedBy = u.Id, ConfirmedAt = DateTime.UtcNow.AddDays(-7),
                HandedOverAt = DateTime.UtcNow.AddDays(-5), DeliveredAt = DateTime.UtcNow.AddDays(-4)
            };
            db.Orders.Add(o16); await db.SaveChangesAsync();
            if (vT != null) db.OrderItems.Add(new ResellerApi.Entities.OrderItem { OrderId = o16.Id, VariantId = vT.Id, Qty = 1, UnitPrice = 650, UnitCostSnapshot = 280 });
            db.OrderPayments.Add(new ResellerApi.Entities.OrderPayment { OrderId = o16.Id, Method = "BKASH", Amount = 780, ReceivedAt = DateTime.UtcNow.AddDays(-7), UserId = u.Id });
            await db.SaveChangesAsync();

            // ── ORD-0017: Replacement for ORD-0016, now IN_TRANSIT ──
            var o17 = new ResellerApi.Entities.Order {
                BusinessId = biz.Id, BranchId = seedMainBranch!.Id, OrderNo = "ORD-0017",
                Channel = "PHONE", CustomerName = cJahir?.Name ?? "Jahir Rahman",
                CustomerPhone = cJahir?.Phone ?? "01615000005", CustomerId = cJahir?.Id,
                CustomerAddress = "Chittagong City, Ward-15",
                OrderStatus = "OPEN", PaymentStatus = "PAID",
                FulfillmentStatus = "IN_TRANSIT",
                IsDraft = false, DeliveryChargeCustomer = 130,
                CourierId = courier?.Id, TrackingNo = "SS-20260017",
                CodRemittanceStatus = "PENDING",
                Note = "Replacement for ORD-0016 (exchange)",
                CreatedBy = u.Id, ConfirmedAt = DateTime.UtcNow.AddDays(-1),
                HandedOverAt = DateTime.UtcNow.AddDays(-1)
            };
            db.Orders.Add(o17); await db.SaveChangesAsync();
            if (vJ != null) db.OrderItems.Add(new ResellerApi.Entities.OrderItem { OrderId = o17.Id, VariantId = vJ.Id, Qty = 1, UnitPrice = 1800, UnitCostSnapshot = 850 });
            db.OrderPayments.Add(new ResellerApi.Entities.OrderPayment { OrderId = o17.Id, Method = "BKASH", Amount = 780, ReceivedAt = DateTime.UtcNow.AddDays(-1), UserId = u.Id });
            await db.SaveChangesAsync();

            // ── ORD-0018: Open, packed, waiting handover ──
            var o18 = new ResellerApi.Entities.Order {
                BusinessId = biz.Id, BranchId = seedMainBranch!.Id, OrderNo = "ORD-0018",
                Channel = "FACEBOOK", CustomerName = cRahim?.Name ?? "Rahim Uddin",
                CustomerPhone = cRahim?.Phone ?? "01711000001", CustomerId = cRahim?.Id,
                CustomerAddress = "House 12, Road 5, Mirpur-10, Dhaka",
                OrderStatus = "OPEN", PaymentStatus = "UNPAID",
                FulfillmentStatus = "PACKED",
                IsDraft = false, DeliveryChargeCustomer = 70,
                CourierId = courier?.Id, CodRemittanceStatus = "PENDING",
                CreatedBy = u.Id, ConfirmedAt = DateTime.UtcNow.AddDays(-1)
            };
            db.Orders.Add(o18); await db.SaveChangesAsync();
            if (vT != null) db.OrderItems.Add(new ResellerApi.Entities.OrderItem { OrderId = o18.Id, VariantId = vT.Id, Qty = 3, UnitPrice = 650, UnitCostSnapshot = 280 });
            await db.SaveChangesAsync();

            // ── ORD-0019: Open, confirmed, partial advance ──
            var o19 = new ResellerApi.Entities.Order {
                BusinessId = biz.Id, BranchId = seedMainBranch!.Id, OrderNo = "ORD-0019",
                Channel = "WHATSAPP", CustomerName = cKarim?.Name ?? "Karim Hossain",
                CustomerPhone = cKarim?.Phone ?? "01712000002", CustomerId = cKarim?.Id,
                CustomerAddress = "Flat 3B, Jigatala, Dhaka-1209",
                OrderStatus = "OPEN", PaymentStatus = "PARTIALLY_PAID",
                FulfillmentStatus = "UNFULFILLED",
                IsDraft = false, DeliveryChargeCustomer = 70, AdvancePaid = 300,
                CourierId = courier?.Id, CodRemittanceStatus = "PENDING",
                CreatedBy = u.Id, ConfirmedAt = DateTime.UtcNow
            };
            db.Orders.Add(o19); await db.SaveChangesAsync();
            if (vTL != null) db.OrderItems.Add(new ResellerApi.Entities.OrderItem { OrderId = o19.Id, VariantId = vTL.Id, Qty = 2, UnitPrice = 650, UnitCostSnapshot = 280 });
            db.OrderPayments.Add(new ResellerApi.Entities.OrderPayment { OrderId = o19.Id, Method = "NAGAD", Amount = 300, ReceivedAt = DateTime.UtcNow, UserId = u.Id });
            await db.SaveChangesAsync();

            // ── ORD-0020: Shop sale (counter, full cash, delivered) ──
            var o20 = new ResellerApi.Entities.Order {
                BusinessId = biz.Id, BranchId = seedMainBranch!.Id, OrderNo = "ORD-0020",
                Channel = "SHOP", CustomerName = cNasrin?.Name ?? "Nasrin Akter",
                CustomerPhone = cNasrin?.Phone ?? "01914000004", CustomerId = cNasrin?.Id,
                OrderStatus = "COMPLETED", PaymentStatus = "PAID",
                FulfillmentStatus = "DELIVERED",
                IsDraft = false, DeliveryChargeCustomer = 0,
                CodRemittanceStatus = "NOT_APPLICABLE",
                CreatedBy = u.Id, ConfirmedAt = DateTime.UtcNow.AddHours(-5),
                DeliveredAt = DateTime.UtcNow.AddHours(-5)
            };
            db.Orders.Add(o20); await db.SaveChangesAsync();
            if (vT != null) db.OrderItems.Add(new ResellerApi.Entities.OrderItem { OrderId = o20.Id, VariantId = vT.Id, Qty = 1, UnitPrice = 650, UnitCostSnapshot = 280 });
            db.OrderPayments.Add(new ResellerApi.Entities.OrderPayment { OrderId = o20.Id, Method = "CASH", Amount = 650, ReceivedAt = DateTime.UtcNow.AddHours(-5), UserId = u.Id });
            await db.SaveChangesAsync();

            // ── ORD-0021: Delivered, COD collected, fully paid ──
            var o21 = new ResellerApi.Entities.Order {
                BusinessId = biz.Id, BranchId = seedMainBranch!.Id, OrderNo = "ORD-0021",
                Channel = "FACEBOOK", CustomerName = cSumaiya?.Name ?? "Sumaiya Begum",
                CustomerPhone = cSumaiya?.Phone ?? "01813000003", CustomerId = cSumaiya?.Id,
                CustomerAddress = "Village: Gopalpur, Thana: Savar, Dhaka",
                OrderStatus = "COMPLETED", PaymentStatus = "PAID",
                FulfillmentStatus = "DELIVERED",
                IsDraft = false, DeliveryChargeCustomer = 130,
                CourierId = courier?.Id, TrackingNo = "SS-20260021",
                CodRemittanceStatus = "PENDING",
                CreatedBy = u.Id, ConfirmedAt = DateTime.UtcNow.AddDays(-4),
                HandedOverAt = DateTime.UtcNow.AddDays(-3), DeliveredAt = DateTime.UtcNow.AddDays(-2)
            };
            db.Orders.Add(o21); await db.SaveChangesAsync();
            if (vJ != null) db.OrderItems.Add(new ResellerApi.Entities.OrderItem { OrderId = o21.Id, VariantId = vJ.Id, Qty = 1, UnitPrice = 1800, UnitCostSnapshot = 850 });
            db.OrderPayments.Add(new ResellerApi.Entities.OrderPayment { OrderId = o21.Id, Method = "COD", Amount = 1930, ReceivedAt = DateTime.UtcNow.AddDays(-2), UserId = u.Id });
            await db.SaveChangesAsync();

            // ── ORD-0022: Instagram, in-transit right now ──
            var o22 = new ResellerApi.Entities.Order {
                BusinessId = biz.Id, BranchId = seedMainBranch!.Id, OrderNo = "ORD-0022",
                Channel = "INSTAGRAM", CustomerName = cAnwar?.Name ?? "Anwar Islam",
                CustomerPhone = cAnwar?.Phone ?? "01817000007", CustomerId = cAnwar?.Id,
                CustomerAddress = "Narayanganj, Fatullah",
                OrderStatus = "OPEN", PaymentStatus = "UNPAID",
                FulfillmentStatus = "IN_TRANSIT",
                IsDraft = false, DeliveryChargeCustomer = 70,
                CourierId = courier?.Id, TrackingNo = "SS-20260022",
                CodRemittanceStatus = "PENDING",
                CreatedBy = u.Id, ConfirmedAt = DateTime.UtcNow.AddDays(-2),
                HandedOverAt = DateTime.UtcNow.AddDays(-2)
            };
            db.Orders.Add(o22); await db.SaveChangesAsync();
            if (vC != null) db.OrderItems.Add(new ResellerApi.Entities.OrderItem { OrderId = o22.Id, VariantId = vC.Id, Qty = 1, UnitPrice = 350, UnitCostSnapshot = 120 });
            await db.SaveChangesAsync();

            // ── ORD-0023: Draft (customer said "will confirm tomorrow") ──
            var o23 = new ResellerApi.Entities.Order {
                BusinessId = biz.Id, BranchId = seedMainBranch!.Id, OrderNo = "ORD-0023",
                Channel = "WHATSAPP", CustomerName = cMitu?.Name ?? "Mitu Akter",
                CustomerPhone = cMitu?.Phone ?? "01718000008", CustomerId = cMitu?.Id,
                OrderStatus = "OPEN", PaymentStatus = "UNPAID",
                FulfillmentStatus = "UNFULFILLED",
                IsDraft = true, DeliveryChargeCustomer = 70,
                CreatedBy = u.Id
            };
            db.Orders.Add(o23); await db.SaveChangesAsync();
            if (vT != null) db.OrderItems.Add(new ResellerApi.Entities.OrderItem { OrderId = o23.Id, VariantId = vT.Id, Qty = 2, UnitPrice = 650, UnitCostSnapshot = 280 });
            await db.SaveChangesAsync();

            // ── ORD-0024: Cancelled — customer ordered by mistake ──
            var o24 = new ResellerApi.Entities.Order {
                BusinessId = biz.Id, BranchId = seedMainBranch!.Id, OrderNo = "ORD-0024",
                Channel = "PHONE", CustomerName = cKarim?.Name ?? "Karim Hossain",
                CustomerPhone = cKarim?.Phone ?? "01712000002", CustomerId = cKarim?.Id,
                OrderStatus = "CANCELLED", PaymentStatus = "UNPAID",
                FulfillmentStatus = "UNFULFILLED",
                IsDraft = false, DeliveryChargeCustomer = 70,
                CancelledReason = "Customer ordered by mistake, called to cancel",
                CreatedBy = u.Id, ConfirmedAt = DateTime.UtcNow.AddDays(-3)
            };
            db.Orders.Add(o24); await db.SaveChangesAsync();
            if (vTL != null) db.OrderItems.Add(new ResellerApi.Entities.OrderItem { OrderId = o24.Id, VariantId = vTL.Id, Qty = 1, UnitPrice = 650, UnitCostSnapshot = 280 });
            await db.SaveChangesAsync();

            // ── ORD-0025: Partially paid, packed, about to handover ──
            var o25 = new ResellerApi.Entities.Order {
                BusinessId = biz.Id, BranchId = seedMainBranch!.Id, OrderNo = "ORD-0025",
                Channel = "FACEBOOK", CustomerName = cRahim?.Name ?? "Rahim Uddin",
                CustomerPhone = cRahim?.Phone ?? "01711000001", CustomerId = cRahim?.Id,
                CustomerAddress = "House 12, Road 5, Mirpur-10, Dhaka",
                OrderStatus = "OPEN", PaymentStatus = "PARTIALLY_PAID",
                FulfillmentStatus = "PACKED",
                IsDraft = false, DeliveryChargeCustomer = 130, AdvancePaid = 500,
                CourierId = courier?.Id, CodRemittanceStatus = "PENDING",
                CreatedBy = u.Id, ConfirmedAt = DateTime.UtcNow.AddDays(-1)
            };
            db.Orders.Add(o25); await db.SaveChangesAsync();
            if (vJ != null) db.OrderItems.Add(new ResellerApi.Entities.OrderItem { OrderId = o25.Id, VariantId = vJ.Id, Qty = 1, UnitPrice = 1800, UnitCostSnapshot = 850 });
            if (vT != null) db.OrderItems.Add(new ResellerApi.Entities.OrderItem { OrderId = o25.Id, VariantId = vT.Id, Qty = 1, UnitPrice = 650, UnitCostSnapshot = 280 });
            db.OrderPayments.Add(new ResellerApi.Entities.OrderPayment { OrderId = o25.Id, Method = "BKASH", Amount = 500, ReceivedAt = DateTime.UtcNow.AddDays(-1), UserId = u.Id });
            await db.SaveChangesAsync();

            // ── ORD-0026: Full refund after delivery — product broken ──
            var o26 = new ResellerApi.Entities.Order {
                BusinessId = biz.Id, BranchId = seedMainBranch!.Id, OrderNo = "ORD-0026",
                Channel = "FACEBOOK", CustomerName = cNasrin?.Name ?? "Nasrin Akter",
                CustomerPhone = cNasrin?.Phone ?? "01914000004", CustomerId = cNasrin?.Id,
                CustomerAddress = "Mohammadpur, Dhaka",
                OrderStatus = "OPEN", PaymentStatus = "REFUNDED",
                FulfillmentStatus = "RETURNED",
                IsDraft = false, DeliveryChargeCustomer = 70,
                CourierId = courier?.Id, TrackingNo = "SS-20260026",
                CodRemittanceStatus = "NOT_APPLICABLE",
                ReturnResolution = "REFUND",
                ReturnNote = "Product came broken — full cash refund given",
                ReturnedAt = DateTime.UtcNow.AddDays(-1),
                CreatedBy = u.Id, ConfirmedAt = DateTime.UtcNow.AddDays(-6),
                HandedOverAt = DateTime.UtcNow.AddDays(-4), DeliveredAt = DateTime.UtcNow.AddDays(-3)
            };
            db.Orders.Add(o26); await db.SaveChangesAsync();
            if (vC != null) db.OrderItems.Add(new ResellerApi.Entities.OrderItem { OrderId = o26.Id, VariantId = vC.Id, Qty = 2, UnitPrice = 350, UnitCostSnapshot = 120 });
            db.OrderPayments.Add(new ResellerApi.Entities.OrderPayment { OrderId = o26.Id, Method = "COD", Amount = 770, ReceivedAt = DateTime.UtcNow.AddDays(-3), UserId = u.Id });
            db.OrderPayments.Add(new ResellerApi.Entities.OrderPayment { OrderId = o26.Id, Method = "REFUND_CASH", Amount = -770, ReceivedAt = DateTime.UtcNow.AddDays(-1), UserId = u.Id });
            await db.SaveChangesAsync();

            // ── ORD-0027: Replace same — customer wants same item resent ──
            var o27 = new ResellerApi.Entities.Order {
                BusinessId = biz.Id, BranchId = seedMainBranch!.Id, OrderNo = "ORD-0027",
                Channel = "INSTAGRAM", CustomerName = cSumaiya?.Name ?? "Sumaiya Begum",
                CustomerPhone = cSumaiya?.Phone ?? "01813000003", CustomerId = cSumaiya?.Id,
                CustomerAddress = "Village: Gopalpur, Thana: Savar, Dhaka",
                OrderStatus = "OPEN", PaymentStatus = "PAID",
                FulfillmentStatus = "RETURNED",
                IsDraft = false, DeliveryChargeCustomer = 130,
                CourierId = courier?.Id, TrackingNo = "SS-20260027",
                CodRemittanceStatus = "NOT_APPLICABLE",
                ReturnResolution = "REPLACE_SAME",
                ReturnNote = "Defective unit, customer wants same item — replacement dispatched",
                ReturnedAt = DateTime.UtcNow.AddDays(-2),
                CreatedBy = u.Id, ConfirmedAt = DateTime.UtcNow.AddDays(-9),
                HandedOverAt = DateTime.UtcNow.AddDays(-7), DeliveredAt = DateTime.UtcNow.AddDays(-6)
            };
            db.Orders.Add(o27); await db.SaveChangesAsync();
            if (vTL != null) db.OrderItems.Add(new ResellerApi.Entities.OrderItem { OrderId = o27.Id, VariantId = vTL.Id, Qty = 1, UnitPrice = 650, UnitCostSnapshot = 280 });
            db.OrderPayments.Add(new ResellerApi.Entities.OrderPayment { OrderId = o27.Id, Method = "BKASH", Amount = 780, ReceivedAt = DateTime.UtcNow.AddDays(-9), UserId = u.Id });
            await db.SaveChangesAsync();

            // ── ORD-0028: Open, confirmed, no advance, just today ──
            var o28 = new ResellerApi.Entities.Order {
                BusinessId = biz.Id, BranchId = seedMainBranch!.Id, OrderNo = "ORD-0028",
                Channel = "FACEBOOK", CustomerName = cJahir?.Name ?? "Jahir Rahman",
                CustomerPhone = cJahir?.Phone ?? "01615000005", CustomerId = cJahir?.Id,
                CustomerAddress = "Chittagong City, Ward-15",
                OrderStatus = "OPEN", PaymentStatus = "UNPAID",
                FulfillmentStatus = "UNFULFILLED",
                IsDraft = false, DeliveryChargeCustomer = 130,
                CourierId = courier?.Id, CodRemittanceStatus = "PENDING",
                CreatedBy = u.Id, ConfirmedAt = DateTime.UtcNow
            };
            db.Orders.Add(o28); await db.SaveChangesAsync();
            if (vT != null) db.OrderItems.Add(new ResellerApi.Entities.OrderItem { OrderId = o28.Id, VariantId = vT.Id, Qty = 4, UnitPrice = 650, UnitCostSnapshot = 280 });
            await db.SaveChangesAsync();

            // ── ORD-0029: Delivered, due amount remaining (partial COD) ──
            var o29 = new ResellerApi.Entities.Order {
                BusinessId = biz.Id, BranchId = seedMainBranch!.Id, OrderNo = "ORD-0029",
                Channel = "WHATSAPP", CustomerName = cAnwar?.Name ?? "Anwar Islam",
                CustomerPhone = cAnwar?.Phone ?? "01817000007", CustomerId = cAnwar?.Id,
                CustomerAddress = "Narayanganj, Fatullah",
                OrderStatus = "OPEN", PaymentStatus = "PARTIALLY_PAID",
                FulfillmentStatus = "DELIVERED",
                IsDraft = false, DeliveryChargeCustomer = 70,
                CourierId = courier?.Id, TrackingNo = "SS-20260029",
                CodRemittanceStatus = "PENDING",
                Note = "Customer paid 500, will pay rest next week",
                CreatedBy = u.Id, ConfirmedAt = DateTime.UtcNow.AddDays(-5),
                HandedOverAt = DateTime.UtcNow.AddDays(-4), DeliveredAt = DateTime.UtcNow.AddDays(-3)
            };
            db.Orders.Add(o29); await db.SaveChangesAsync();
            if (vJ != null) db.OrderItems.Add(new ResellerApi.Entities.OrderItem { OrderId = o29.Id, VariantId = vJ.Id, Qty = 1, UnitPrice = 1800, UnitCostSnapshot = 850 });
            db.OrderPayments.Add(new ResellerApi.Entities.OrderPayment { OrderId = o29.Id, Method = "CASH", Amount = 500, ReceivedAt = DateTime.UtcNow.AddDays(-3), UserId = u.Id });
            await db.SaveChangesAsync();

            // ── ORD-0030: Shop counter + bKash, completed ──
            var o30 = new ResellerApi.Entities.Order {
                BusinessId = biz.Id, BranchId = seedMainBranch!.Id, OrderNo = "ORD-0030",
                Channel = "SHOP", CustomerName = cMitu?.Name ?? "Mitu Akter",
                CustomerPhone = cMitu?.Phone ?? "01718000008", CustomerId = cMitu?.Id,
                OrderStatus = "COMPLETED", PaymentStatus = "PAID",
                FulfillmentStatus = "DELIVERED",
                IsDraft = false, DeliveryChargeCustomer = 0,
                CodRemittanceStatus = "NOT_APPLICABLE",
                CreatedBy = u.Id, ConfirmedAt = DateTime.UtcNow.AddHours(-2),
                DeliveredAt = DateTime.UtcNow.AddHours(-2)
            };
            db.Orders.Add(o30); await db.SaveChangesAsync();
            if (vT != null) db.OrderItems.Add(new ResellerApi.Entities.OrderItem { OrderId = o30.Id, VariantId = vT.Id, Qty = 2, UnitPrice = 650, UnitCostSnapshot = 280 });
            if (vC != null) db.OrderItems.Add(new ResellerApi.Entities.OrderItem { OrderId = o30.Id, VariantId = vC.Id, Qty = 1, UnitPrice = 350, UnitCostSnapshot = 120 });
            db.OrderPayments.Add(new ResellerApi.Entities.OrderPayment { OrderId = o30.Id, Method = "CASH", Amount = 800, ReceivedAt = DateTime.UtcNow.AddHours(-2), UserId = u.Id });
            db.OrderPayments.Add(new ResellerApi.Entities.OrderPayment { OrderId = o30.Id, Method = "BKASH", Amount = 850, ReceivedAt = DateTime.UtcNow.AddHours(-2), UserId = u.Id });
            await db.SaveChangesAsync();
        }
    }

    // ── Seed expense categories ───────────────────────────────────────────
    if (biz != null && !await db.ExpenseCategories.IgnoreQueryFilters().AnyAsync(e => e.BusinessId == biz.Id))
    {
        db.ExpenseCategories.AddRange(
            // ── Order fulfilment ─────────────────────────────────────────
            new ResellerApi.Entities.ExpenseCategory { BusinessId = biz.Id, Code = "CUSTOM_COURIER_CHARGE",      Name = "Courier Charge",       IsDefault = false, IsActive = true },
            new ResellerApi.Entities.ExpenseCategory { BusinessId = biz.Id, Code = "CUSTOM_RETURN_CHARGE",       Name = "Return Charge",        IsDefault = false, IsActive = true },
            new ResellerApi.Entities.ExpenseCategory { BusinessId = biz.Id, Code = "CUSTOM_PACKAGING_MATERIALS", Name = "Packaging Materials",  IsDefault = false, IsActive = true },
            // ── Shop & office ─────────────────────────────────────────────
            new ResellerApi.Entities.ExpenseCategory { BusinessId = biz.Id, Code = "CUSTOM_SHOP_RENT",           Name = "Shop Rent",            IsDefault = false, IsActive = true },
            new ResellerApi.Entities.ExpenseCategory { BusinessId = biz.Id, Code = "CUSTOM_ELECTRICITY_BILL",    Name = "Electricity Bill",     IsDefault = false, IsActive = true },
            new ResellerApi.Entities.ExpenseCategory { BusinessId = biz.Id, Code = "CUSTOM_INTERNET_MOBILE",     Name = "Internet & Mobile",    IsDefault = false, IsActive = true },
            // ── Staff ─────────────────────────────────────────────────────
            new ResellerApi.Entities.ExpenseCategory { BusinessId = biz.Id, Code = "CUSTOM_STAFF_SALARY",        Name = "Staff Salary",         IsDefault = false, IsActive = true },
            new ResellerApi.Entities.ExpenseCategory { BusinessId = biz.Id, Code = "CUSTOM_STAFF_FOOD_TEA",      Name = "Staff Food & Tea",     IsDefault = false, IsActive = true },
            // ── Marketing ────────────────────────────────────────────────
            new ResellerApi.Entities.ExpenseCategory { BusinessId = biz.Id, Code = "CUSTOM_FACEBOOK_ADS",        Name = "Facebook Ads / Boost", IsDefault = false, IsActive = true },
            // ── Transport ────────────────────────────────────────────────
            new ResellerApi.Entities.ExpenseCategory { BusinessId = biz.Id, Code = "CUSTOM_TRANSPORT",          Name = "Transport / Rickshaw", IsDefault = false, IsActive = true },
            // ── Finance ──────────────────────────────────────────────────
            new ResellerApi.Entities.ExpenseCategory { BusinessId = biz.Id, Code = "CUSTOM_BKASH_BANK_CHARGE",   Name = "bKash / Bank Charge",  IsDefault = false, IsActive = true },
            // ── Losses ───────────────────────────────────────────────────
            new ResellerApi.Entities.ExpenseCategory { BusinessId = biz.Id, Code = "CUSTOM_PRODUCT_DAMAGE_LOSS", Name = "Product Damage Loss",  IsDefault = false, IsActive = true },
            // ── Catch-all ────────────────────────────────────────────────
            new ResellerApi.Entities.ExpenseCategory { BusinessId = biz.Id, Code = "CUSTOM_MISC",                Name = "Miscellaneous",        IsDefault = true,  IsActive = true }
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
    var mainBranch = await db.Branches.IgnoreQueryFilters()
        .FirstOrDefaultAsync(b => b.BusinessId == bizId && b.IsDefault);
    if (clothCat == null || toysCat == null || owner == null || mainBranch == null) return;
    var branchId = mainBranch.Id;

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

    db.BranchVariantInventories.AddRange(
        new ResellerApi.Entities.BranchVariantInventory { BranchId = branchId, VariantId = vTSW.Id, OnHand = 15 },
        new ResellerApi.Entities.BranchVariantInventory { BranchId = branchId, VariantId = vTMW.Id, OnHand = 22 },
        new ResellerApi.Entities.BranchVariantInventory { BranchId = branchId, VariantId = vTLW.Id, OnHand = 8  },
        new ResellerApi.Entities.BranchVariantInventory { BranchId = branchId, VariantId = vTSB.Id, OnHand = 10 },
        new ResellerApi.Entities.BranchVariantInventory { BranchId = branchId, VariantId = vTMB.Id, OnHand = 18 }
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

    db.BranchVariantInventories.AddRange(
        new ResellerApi.Entities.BranchVariantInventory { BranchId = branchId, VariantId = vJ32.Id, OnHand = 5  },
        new ResellerApi.Entities.BranchVariantInventory { BranchId = branchId, VariantId = vJ34.Id, OnHand = 12 }
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

    db.BranchVariantInventories.Add(new ResellerApi.Entities.BranchVariantInventory { BranchId = branchId, VariantId = vCar.Id, OnHand = 30 });
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
