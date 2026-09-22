param(
    [Parameter(Mandatory = $true)]
    [string]$SourceJson,

    [Parameter(Mandatory = $true)]
    [string]$OutputSql
)

$rawJson = Get-Content -Raw -LiteralPath $SourceJson
$null = $rawJson | ConvertFrom-Json
$escapedJson = $rawJson.Replace("'", "''")

$template = @'
SET NOCOUNT ON;
SET XACT_ABORT ON;

-- Run first with 0 to validate and preview. Change to 1 only after reviewing all result sets.
DECLARE @ApplyImport bit = 0;
-- Optional business copy. Leave 0 for global suggestions only. Set to 1 and provide an ID later.
DECLARE @CreateBusinessProducts bit = 0;
DECLARE @BusinessId uniqueidentifier = NULL;
DECLARE @DefaultSellingPrice decimal(14,2) = 0;
DECLARE @Json nvarchar(MAX) = N'__JSON__';

IF ISJSON(@Json) <> 1
    THROW 50001, 'Embedded catalog is not valid JSON.', 1;

DROP TABLE IF EXISTS #AsicsRunningShoeImportV3;

CREATE TABLE #AsicsRunningShoeImportV3
(
    SourceRowNumber     int            NOT NULL,
    Name                nvarchar(300)  NULL,
    Gender              nvarchar(50)   NULL,
    MainCategory        nvarchar(100)  NULL,
    ActivityCategory    nvarchar(100)  NULL,
    ShoeTypeJson        nvarchar(MAX)  NULL,
    CategoryConfidence  nvarchar(50)   NULL,
    CategoryBasisJson   nvarchar(MAX)  NULL,
    ImageUrl            nvarchar(500)  NULL,
    ImagesJson          nvarchar(MAX)  NULL,
    AttributesJson      nvarchar(MAX)  NULL,
    ProductId           uniqueidentifier NULL,
    WasInserted         bit            NOT NULL DEFAULT 0
);

INSERT INTO #AsicsRunningShoeImportV3
(
    SourceRowNumber,
    Name,
    Gender,
    MainCategory,
    ActivityCategory,
    ShoeTypeJson,
    CategoryConfidence,
    CategoryBasisJson,
    ImageUrl,
    ImagesJson,
    AttributesJson
)
SELECT
    CONVERT(int, source.[key]) + 1,
    product.Name,
    product.Gender,
    product.MainCategory,
    product.ActivityCategory,
    product.ShoeTypeJson,
    product.CategoryConfidence,
    product.CategoryBasisJson,
    product.ImageUrl,
    product.ImagesJson,
    metadata.AttributesJson
FROM OPENJSON(@Json) source
CROSS APPLY OPENJSON(source.[value])
WITH
(
    Name                nvarchar(300) '$.name',
    Gender              nvarchar(50)  '$.gender',
    MainCategory        nvarchar(100) '$.mainCategory',
    ActivityCategory    nvarchar(100) '$.activityCategory',
    ShoeTypeJson        nvarchar(MAX) '$.shoeType' AS JSON,
    CategoryConfidence  nvarchar(50)  '$.categoryConfidence',
    CategoryBasisJson   nvarchar(MAX) '$.categoryBasis' AS JSON,
    ImageUrl            nvarchar(500) '$.imageUrl',
    ImagesJson          nvarchar(MAX) '$.images' AS JSON
) product
CROSS APPLY
(
    SELECT
        product.Gender AS gender,
        product.MainCategory AS mainCategory,
        product.ActivityCategory AS activityCategory,
        JSON_QUERY(product.ShoeTypeJson) AS shoeType,
        product.CategoryConfidence AS categoryConfidence,
        JSON_QUERY(product.CategoryBasisJson) AS categoryBasis
    FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
) metadata(AttributesJson)
WHERE product.MainCategory = 'Running Shoes';

-- Summary: this source should stage 53 Running Shoes.
SELECT
    COUNT(*) AS StagedRunningShoes,
    COUNT(DISTINCT Name) AS UniqueProductNames
FROM #AsicsRunningShoeImportV3;

-- Invalid rows. Expected: zero rows.
SELECT *
FROM #AsicsRunningShoeImportV3
WHERE NULLIF(LTRIM(RTRIM(Name)), '') IS NULL
   OR Gender NOT IN ('Men', 'Women', 'Unisex', 'Unspecified')
   OR MainCategory <> 'Running Shoes'
   OR NULLIF(LTRIM(RTRIM(ImageUrl)), '') IS NULL
   OR ISJSON(ShoeTypeJson) <> 1
   OR ISJSON(CategoryBasisJson) <> 1
   OR ISJSON(ImagesJson) <> 1;

-- Duplicate names. Expected: zero rows.
SELECT Name, COUNT(*) AS DuplicateCount
FROM #AsicsRunningShoeImportV3
GROUP BY Name
HAVING COUNT(*) > 1;

-- Primary image missing from its images array. Expected: zero rows.
SELECT staged.SourceRowNumber, staged.Name, staged.ImageUrl
FROM #AsicsRunningShoeImportV3 staged
WHERE NOT EXISTS
(
    SELECT 1
    FROM OPENJSON(staged.ImagesJson) image
    WHERE CONVERT(nvarchar(500), image.[value]) = staged.ImageUrl
);

-- Full preview, including the metadata that cannot yet fit in suggested_products.
SELECT *
FROM #AsicsRunningShoeImportV3
ORDER BY SourceRowNumber;

IF EXISTS
(
    SELECT 1
    FROM #AsicsRunningShoeImportV3
    WHERE NULLIF(LTRIM(RTRIM(Name)), '') IS NULL
       OR Gender NOT IN ('Men', 'Women', 'Unisex', 'Unspecified')
       OR MainCategory <> 'Running Shoes'
       OR NULLIF(LTRIM(RTRIM(ImageUrl)), '') IS NULL
       OR ISJSON(ShoeTypeJson) <> 1
       OR ISJSON(CategoryBasisJson) <> 1
       OR ISJSON(ImagesJson) <> 1
)
    THROW 50002, 'Invalid staged products found. Nothing was imported.', 1;

IF EXISTS
(
    SELECT 1
    FROM #AsicsRunningShoeImportV3
    GROUP BY Name
    HAVING COUNT(*) > 1
)
    THROW 50003, 'Duplicate product names found. Nothing was imported.', 1;

IF EXISTS
(
    SELECT 1
    FROM #AsicsRunningShoeImportV3 staged
    WHERE NOT EXISTS
    (
        SELECT 1
        FROM OPENJSON(staged.ImagesJson) image
        WHERE CONVERT(nvarchar(500), image.[value]) = staged.ImageUrl
    )
)
    THROW 50004, 'A primary image is missing from an images array. Nothing was imported.', 1;

IF @ApplyImport = 0
BEGIN
    SELECT 'PREVIEW ONLY: validation passed; set @ApplyImport = 1 to insert suggestions.' AS Result;
    RETURN;
END;

BEGIN TRY
    BEGIN TRANSACTION;

    DECLARE @RunningShoesId uniqueidentifier;

    SELECT @RunningShoesId = Id
    FROM dbo.suggested_categories
    WHERE BusinessTypeCode = 'SHOES_FOOTWEAR'
      AND Name = 'Running Shoes'
      AND IsActive = 1;

    IF @RunningShoesId IS NULL
        THROW 50005, 'Active Running Shoes suggested category was not found.', 1;

    -- Keep matching existing rows active and align their order with the source file.
    UPDATE target
    SET
        target.SortOrder = source.SourceRowNumber,
        target.IsActive = 1,
        target.UpdatedAt = GETUTCDATE()
    FROM dbo.suggested_products target
    INNER JOIN #AsicsRunningShoeImportV3 source ON source.Name = target.Name
    WHERE target.SuggestedCategoryId = @RunningShoesId;

    DECLARE @UpdatedCount int = @@ROWCOUNT;

    INSERT INTO dbo.suggested_products
    (
        Id,
        SuggestedCategoryId,
        Name,
        SortOrder,
        IsActive,
        CreatedAt,
        UpdatedAt
    )
    SELECT
        NEWID(),
        @RunningShoesId,
        source.Name,
        source.SourceRowNumber,
        1,
        GETUTCDATE(),
        GETUTCDATE()
    FROM #AsicsRunningShoeImportV3 source
    WHERE NOT EXISTS
    (
        SELECT 1
        FROM dbo.suggested_products target
        WHERE target.SuggestedCategoryId = @RunningShoesId
          AND target.Name = source.Name
    );

    DECLARE @InsertedCount int = @@ROWCOUNT;

    DECLARE @BusinessCategoryId uniqueidentifier = NULL;
    DECLARE @InsertedBusinessProducts int = 0;

    IF @CreateBusinessProducts = 1
    BEGIN
        IF @BusinessId IS NULL
            THROW 50006, 'Set @BusinessId before creating business products.', 1;

        IF NOT EXISTS
        (
            SELECT 1 FROM dbo.businesses
            WHERE Id = @BusinessId AND DeletedAt IS NULL
        )
            THROW 50007, 'The selected business does not exist.', 1;

        SELECT TOP (1) @BusinessCategoryId = Id
        FROM dbo.categories
        WHERE BusinessId = @BusinessId
          AND SuggestedCategoryId = @RunningShoesId
          AND DeletedAt IS NULL;

        IF @BusinessCategoryId IS NULL
        BEGIN
            SET @BusinessCategoryId = NEWID();

            INSERT INTO dbo.categories
            (
                Id, BusinessId, Name, NameBn, DefaultUnit, SuggestedCategoryId,
                ParentCategoryId, CreatedAt, UpdatedAt
            )
            VALUES
            (
                @BusinessCategoryId, @BusinessId, 'Running Shoes', NULL, 'pair',
                @RunningShoesId, NULL, GETUTCDATE(), GETUTCDATE()
            );
        END;

        UPDATE #AsicsRunningShoeImportV3 SET ProductId = NEWID();

        INSERT INTO dbo.products
        (
            Id, CategoryId, Name, Sku, ImageUrl, UnitCode, SellingPrice,
            PackagingCostPerUnit, LowStockThreshold, AttributesJson, Status,
            BusinessId, ShowOnMarketplace, PopularityScore, ReviewCount,
            CreatedAt, UpdatedAt
        )
        SELECT
            source.ProductId,
            @BusinessCategoryId,
            source.Name,
            CONCAT('ASICS-', UPPER(LEFT(REPLACE(CONVERT(varchar(36), source.ProductId), '-', ''), 12))),
            CONCAT('/uploads/', CONVERT(varchar(36), @BusinessId), '/', source.ImageUrl),
            'pair',
            @DefaultSellingPrice,
            0,
            5,
            source.AttributesJson,
            'ACTIVE',
            @BusinessId,
            1,
            0,
            0,
            GETUTCDATE(),
            GETUTCDATE()
        FROM #AsicsRunningShoeImportV3 source
        WHERE NOT EXISTS
        (
            SELECT 1
            FROM dbo.products existing
            WHERE existing.BusinessId = @BusinessId
              AND existing.Name = source.Name
              AND existing.DeletedAt IS NULL
        );

        SET @InsertedBusinessProducts = @@ROWCOUNT;

        UPDATE source
        SET WasInserted = 1
        FROM #AsicsRunningShoeImportV3 source
        WHERE EXISTS (SELECT 1 FROM dbo.products p WHERE p.Id = source.ProductId);

        INSERT INTO dbo.product_variants
        (
            Id, ProductId, VariantValuesJson, Sku, Barcode, ImageUrl,
            IsDefault, AvgLandedCost, BusinessId, CreatedAt, UpdatedAt
        )
        SELECT
            NEWID(),
            source.ProductId,
            '{}',
            CONCAT('ASICS-', UPPER(LEFT(REPLACE(CONVERT(varchar(36), source.ProductId), '-', ''), 12)), '-01'),
            CONCAT('ASICS-', UPPER(REPLACE(CONVERT(varchar(36), source.ProductId), '-', ''))),
            CONCAT('/uploads/', CONVERT(varchar(36), @BusinessId), '/', source.ImageUrl),
            1,
            0,
            @BusinessId,
            GETUTCDATE(),
            GETUTCDATE()
        FROM #AsicsRunningShoeImportV3 source
        WHERE source.WasInserted = 1;

        INSERT INTO dbo.product_images
        (
            Id, ProductId, ImageUrl, SortOrder, BusinessId, CreatedAt, UpdatedAt
        )
        SELECT
            NEWID(),
            source.ProductId,
            CONCAT('/uploads/', CONVERT(varchar(36), @BusinessId), '/', gallery.[value]),
            CONVERT(int, gallery.[key]) + 1,
            @BusinessId,
            GETUTCDATE(),
            GETUTCDATE()
        FROM #AsicsRunningShoeImportV3 source
        CROSS APPLY OPENJSON(source.ImagesJson) gallery
        WHERE source.WasInserted = 1
          AND CONVERT(nvarchar(500), gallery.[value]) <> source.ImageUrl;
    END;

    COMMIT TRANSACTION;

    SELECT
        @RunningShoesId AS SuggestedCategoryId,
        @InsertedCount AS InsertedCount,
        @UpdatedCount AS UpdatedExistingCount,
        @BusinessCategoryId AS BusinessCategoryId,
        @InsertedBusinessProducts AS InsertedBusinessProducts;

    SELECT sp.Id, sp.Name, sp.SortOrder, sp.IsActive
    FROM dbo.suggested_products sp
    WHERE sp.SuggestedCategoryId = @RunningShoesId
    ORDER BY sp.SortOrder, sp.Name;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
'@

$sql = $template.Replace('__JSON__', $escapedJson)
Set-Content -LiteralPath $OutputSql -Value $sql -Encoding utf8
