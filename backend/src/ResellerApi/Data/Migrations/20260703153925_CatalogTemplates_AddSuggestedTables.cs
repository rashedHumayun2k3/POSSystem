using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class CatalogTemplates_AddSuggestedTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "SuggestedCategoryId",
                table: "categories",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "suggested_categories",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWSEQUENTIALID()"),
                    BusinessTypeCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    DefaultUnit = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVer = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_suggested_categories", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "suggested_category_fields",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWSEQUENTIALID()"),
                    SuggestedCategoryId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    FieldType = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    OptionsJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    IsRequired = table.Column<bool>(type: "bit", nullable: false),
                    IsVariant = table.Column<bool>(type: "bit", nullable: false),
                    IsPerLot = table.Column<bool>(type: "bit", nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVer = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_suggested_category_fields", x => x.Id);
                    table.ForeignKey(
                        name: "FK_suggested_category_fields_suggested_categories_SuggestedCategoryId",
                        column: x => x.SuggestedCategoryId,
                        principalTable: "suggested_categories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "suggested_products",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWSEQUENTIALID()"),
                    SuggestedCategoryId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVer = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_suggested_products", x => x.Id);
                    table.ForeignKey(
                        name: "FK_suggested_products_suggested_categories_SuggestedCategoryId",
                        column: x => x.SuggestedCategoryId,
                        principalTable: "suggested_categories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_categories_SuggestedCategoryId",
                table: "categories",
                column: "SuggestedCategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_suggested_categories_BusinessTypeCode",
                table: "suggested_categories",
                column: "BusinessTypeCode");

            migrationBuilder.CreateIndex(
                name: "IX_suggested_category_fields_SuggestedCategoryId",
                table: "suggested_category_fields",
                column: "SuggestedCategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_suggested_products_SuggestedCategoryId",
                table: "suggested_products",
                column: "SuggestedCategoryId");

            migrationBuilder.AddForeignKey(
                name: "FK_categories_suggested_categories_SuggestedCategoryId",
                table: "categories",
                column: "SuggestedCategoryId",
                principalTable: "suggested_categories",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            // ── Seed: suggested categories (mirrors the old hardcoded CategoryPresets.cs) ──
            migrationBuilder.Sql(@"
                DECLARE @Categories TABLE (Id UNIQUEIDENTIFIER, Name NVARCHAR(100));

                INSERT INTO suggested_categories (Id, BusinessTypeCode, Name, DefaultUnit, SortOrder, IsActive, CreatedAt, UpdatedAt)
                OUTPUT INSERTED.Id, INSERTED.Name INTO @Categories
                SELECT NEWID(), BusinessTypeCode, Name, DefaultUnit, SortOrder, 1, GETUTCDATE(), GETUTCDATE()
                FROM (VALUES
                    ('CLOTHING_FASHION',    N'Men''s Wear',              N'pcs',  1),
                    ('CLOTHING_FASHION',    N'Women''s Wear',            N'pcs',  2),
                    ('CLOTHING_FASHION',    N'Kids'' Wear',              N'pcs',  3),
                    ('CLOTHING_FASHION',    N'Panjabi/Fatua',            N'pcs',  4),
                    ('CLOTHING_FASHION',    N'Saree',                    N'pcs',  5),
                    ('CLOTHING_FASHION',    N'Three-Piece',              N'pcs',  6),
                    ('COSMETICS_BEAUTY',    N'Skincare',                 N'pcs',  1),
                    ('COSMETICS_BEAUTY',    N'Makeup',                   N'pcs',  2),
                    ('COSMETICS_BEAUTY',    N'Haircare',                 N'pcs',  3),
                    ('COSMETICS_BEAUTY',    N'Perfume/Attar',            N'pcs',  4),
                    ('COSMETICS_BEAUTY',    N'Beauty Tools',             N'pcs',  5),
                    ('ELECTRONICS_GADGETS', N'Mobile Phones',            N'pcs',  1),
                    ('ELECTRONICS_GADGETS', N'Mobile Accessories',       N'pcs',  2),
                    ('ELECTRONICS_GADGETS', N'Earbuds/Headphones',       N'pcs',  3),
                    ('ELECTRONICS_GADGETS', N'Chargers/Cables',          N'pcs',  4),
                    ('ELECTRONICS_GADGETS', N'Smartwatches',             N'pcs',  5),
                    ('SHOES_FOOTWEAR',      N'Men''s Shoes',             N'pair', 1),
                    ('SHOES_FOOTWEAR',      N'Women''s Shoes',           N'pair', 2),
                    ('SHOES_FOOTWEAR',      N'Kids'' Shoes',             N'pair', 3),
                    ('SHOES_FOOTWEAR',      N'Sandals',                  N'pair', 4),
                    ('BAGS_ACCESSORIES',    N'Handbags',                 N'pcs',  1),
                    ('BAGS_ACCESSORIES',    N'Backpacks',                N'pcs',  2),
                    ('BAGS_ACCESSORIES',    N'Wallets',                  N'pcs',  3),
                    ('BAGS_ACCESSORIES',    N'Jewelry',                  N'pcs',  4),
                    ('BAGS_ACCESSORIES',    N'Watches',                  N'pcs',  5),
                    ('TOYS_BABY',           N'Toys',                     N'pcs',  1),
                    ('TOYS_BABY',           N'Baby Clothing',            N'pcs',  2),
                    ('TOYS_BABY',           N'Baby Care',                N'pcs',  3),
                    ('TOYS_BABY',           N'Feeding & Nursing',        N'pcs',  4),
                    ('HOME_KITCHEN',        N'Kitchenware',              N'pcs',  1),
                    ('HOME_KITCHEN',        N'Home Decor',               N'pcs',  2),
                    ('HOME_KITCHEN',        N'Bedding',                  N'pcs',  3),
                    ('HOME_KITCHEN',        N'Storage & Organization',   N'pcs',  4),
                    ('BOOKS_STATIONERY',    N'Books',                    N'pcs',  1),
                    ('BOOKS_STATIONERY',    N'Notebooks & Diaries',      N'pcs',  2),
                    ('BOOKS_STATIONERY',    N'Office Supplies',          N'pcs',  3),
                    ('OTHER',               N'General',                  N'pcs',  1)
                ) AS c(BusinessTypeCode, Name, DefaultUnit, SortOrder);

                -- ── Seed: Size/Color variant fields, for the categories that had SizeColorFields
                -- in the old CategoryPresets.cs (clothing sizes + shoe sizes) ──
                INSERT INTO suggested_category_fields (Id, SuggestedCategoryId, Name, FieldType, OptionsJson, IsRequired, IsVariant, IsPerLot, SortOrder, CreatedAt, UpdatedAt)
                SELECT NEWID(), cat.Id, f.Name, f.FieldType, f.OptionsJson, 1, 1, 0, f.SortOrder, GETUTCDATE(), GETUTCDATE()
                FROM @Categories cat
                CROSS JOIN (VALUES
                    (N'Size',  N'DROPDOWN', N'[""XS"",""S"",""M"",""L"",""XL"",""XXL""]', 1),
                    (N'Color', N'TEXT',     CAST(NULL AS NVARCHAR(MAX)),                  2)
                ) AS f(Name, FieldType, OptionsJson, SortOrder)
                WHERE cat.Name IN (
                    N'Men''s Wear', N'Women''s Wear', N'Kids'' Wear', N'Panjabi/Fatua', N'Three-Piece',
                    N'Men''s Shoes', N'Women''s Shoes', N'Kids'' Shoes', N'Sandals', N'Baby Clothing'
                );

                -- ── Seed: suggested products per category ──
                INSERT INTO suggested_products (Id, SuggestedCategoryId, Name, SortOrder, IsActive, CreatedAt, UpdatedAt)
                SELECT NEWID(), cat.Id, p.Name, p.SortOrder, 1, GETUTCDATE(), GETUTCDATE()
                FROM @Categories cat
                CROSS JOIN (VALUES
                    (N'Men''s Wear',            N'Polo Shirt',            1), (N'Men''s Wear',            N'Formal Shirt',          2), (N'Men''s Wear',            N'Casual Shirt',        3), (N'Men''s Wear',            N'T-Shirt', 4), (N'Men''s Wear', N'Denim Jeans', 5), (N'Men''s Wear', N'Trouser', 6),
                    (N'Women''s Wear',          N'Kurti',                 1), (N'Women''s Wear',          N'Salwar Kameez',         2), (N'Women''s Wear',          N'Blouse',              3), (N'Women''s Wear',          N'Leggings', 4), (N'Women''s Wear', N'Tunic', 5), (N'Women''s Wear', N'Abaya', 6),
                    (N'Kids'' Wear',            N'Kids T-Shirt',          1), (N'Kids'' Wear',            N'Kids Frock',            2), (N'Kids'' Wear',            N'School Uniform',      3), (N'Kids'' Wear',            N'Kids Shorts', 4),
                    (N'Panjabi/Fatua',          N'Cotton Panjabi',        1), (N'Panjabi/Fatua',          N'Silk Panjabi',          2), (N'Panjabi/Fatua',          N'Fatua',               3), (N'Panjabi/Fatua',          N'Embroidered Panjabi', 4),
                    (N'Saree',                  N'Cotton Saree',          1), (N'Saree',                  N'Silk Saree',            2), (N'Saree',                  N'Georgette Saree',     3), (N'Saree',                  N'Jamdani Saree', 4), (N'Saree', N'Tant Saree', 5),
                    (N'Three-Piece',            N'Cotton Three-Piece',    1), (N'Three-Piece',            N'Georgette Three-Piece', 2), (N'Three-Piece',            N'Silk Three-Piece',    3), (N'Three-Piece',            N'Printed Three-Piece', 4),
                    (N'Skincare',               N'Face Wash',             1), (N'Skincare',               N'Moisturizer',           2), (N'Skincare',               N'Sunscreen',           3), (N'Skincare',               N'Face Serum', 4), (N'Skincare', N'Toner', 5),
                    (N'Makeup',                 N'Lipstick',              1), (N'Makeup',                 N'Foundation',            2), (N'Makeup',                 N'Kajal',               3), (N'Makeup',                 N'Eyeliner', 4), (N'Makeup', N'Compact Powder', 5),
                    (N'Haircare',                N'Shampoo',               1), (N'Haircare',               N'Conditioner',           2), (N'Haircare',               N'Hair Oil',            3), (N'Haircare',               N'Hair Serum', 4), (N'Haircare', N'Hair Mask', 5),
                    (N'Perfume/Attar',          N'Attar',                 1), (N'Perfume/Attar',          N'Body Spray',            2), (N'Perfume/Attar',          N'Deodorant',           3), (N'Perfume/Attar',          N'Perfume', 4),
                    (N'Beauty Tools',           N'Makeup Brush Set',      1), (N'Beauty Tools',           N'Hair Straightener',     2), (N'Beauty Tools',           N'Hair Dryer',          3), (N'Beauty Tools',           N'Beauty Blender', 4),
                    (N'Mobile Accessories',     N'Phone Case',            1), (N'Mobile Accessories',     N'Screen Protector',      2), (N'Mobile Accessories',     N'Power Bank',          3), (N'Mobile Accessories',     N'Phone Holder', 4), (N'Mobile Accessories', N'Selfie Stick', 5),
                    (N'Earbuds/Headphones',    N'Wired Earphone',        1), (N'Earbuds/Headphones',    N'Bluetooth Earbuds',     2), (N'Earbuds/Headphones',    N'Over-Ear Headphone',  3),
                    (N'Chargers/Cables',        N'USB-C Cable',           1), (N'Chargers/Cables',        N'Micro USB Cable',       2), (N'Chargers/Cables',        N'Fast Charger',        3), (N'Chargers/Cables',        N'Wireless Charger', 4),
                    (N'Smartwatches',           N'Smartwatch',            1), (N'Smartwatches',           N'Fitness Band',          2),
                    (N'Men''s Shoes',           N'Sneaker',               1), (N'Men''s Shoes',           N'Formal Shoe',           2), (N'Men''s Shoes',           N'Loafer',              3), (N'Men''s Shoes',           N'Sandal Shoe', 4),
                    (N'Women''s Shoes',        N'Heel',                  1), (N'Women''s Shoes',        N'Flat Shoe',             2), (N'Women''s Shoes',        N'Sneaker',             3), (N'Women''s Shoes',        N'Sandal', 4),
                    (N'Kids'' Shoes',           N'School Shoe',           1), (N'Kids'' Shoes',           N'Kids Sneaker',          2), (N'Kids'' Shoes',           N'Kids Sandal',         3),
                    (N'Sandals',                N'Flip-Flop',             1), (N'Sandals',                N'Slide Sandal',          2), (N'Sandals',                N'Leather Sandal',      3),
                    (N'Handbags',               N'Tote Bag',              1), (N'Handbags',               N'Sling Bag',             2), (N'Handbags',               N'Clutch Bag',          3), (N'Handbags',               N'Shoulder Bag', 4),
                    (N'Backpacks',              N'School Backpack',       1), (N'Backpacks',              N'Laptop Backpack',       2), (N'Backpacks',              N'Travel Backpack',     3),
                    (N'Wallets',                N'Men''s Wallet',         1), (N'Wallets',                N'Women''s Wallet',       2), (N'Wallets',                N'Card Holder',         3),
                    (N'Jewelry',                N'Earring',               1), (N'Jewelry',                N'Necklace Set',          2), (N'Jewelry',                N'Bracelet',            3), (N'Jewelry',                N'Ring', 4),
                    (N'Watches',                N'Analog Watch',          1), (N'Watches',                N'Digital Watch',         2), (N'Watches',                N'Smart Watch',         3),
                    (N'Toys',                   N'Remote Control Car',    1), (N'Toys',                   N'Building Blocks',       2), (N'Toys',                   N'Doll',                3), (N'Toys',                   N'Action Figure', 4), (N'Toys', N'Puzzle', 5),
                    (N'Baby Clothing',          N'Baby Romper',           1), (N'Baby Clothing',          N'Baby Frock',            2), (N'Baby Clothing',          N'Baby Set',            3),
                    (N'Baby Care',              N'Baby Wipes',            1), (N'Baby Care',              N'Baby Lotion',           2), (N'Baby Care',              N'Baby Powder',         3), (N'Baby Care',              N'Baby Shampoo', 4),
                    (N'Feeding & Nursing',      N'Feeding Bottle',        1), (N'Feeding & Nursing',      N'Baby Bib',              2), (N'Feeding & Nursing',      N'Sipper Cup',          3), (N'Feeding & Nursing',      N'Breast Pump', 4),
                    (N'Kitchenware',            N'Cookware Set',          1), (N'Kitchenware',            N'Steel Plate Set',       2), (N'Kitchenware',            N'Non-Stick Pan',       3), (N'Kitchenware',            N'Pressure Cooker', 4),
                    (N'Home Decor',             N'Wall Clock',            1), (N'Home Decor',             N'Photo Frame',           2), (N'Home Decor',             N'Wall Hanging',        3), (N'Home Decor',             N'Showpiece', 4),
                    (N'Bedding',                N'Bedsheet Set',          1), (N'Bedding',                N'Pillow Cover',          2), (N'Bedding',                N'Comforter',           3), (N'Bedding',                N'Mattress Protector', 4),
                    (N'Storage & Organization', N'Storage Box',           1), (N'Storage & Organization', N'Hanger Set',            2), (N'Storage & Organization', N'Shoe Rack',           3), (N'Storage & Organization', N'Wardrobe Organizer', 4),
                    (N'Notebooks & Diaries',    N'Exercise Notebook',     1), (N'Notebooks & Diaries',    N'Diary',                 2), (N'Notebooks & Diaries',    N'Sketch Book',         3),
                    (N'Office Supplies',        N'Pen Set',               1), (N'Office Supplies',        N'Stapler',               2), (N'Office Supplies',        N'Highlighter',         3), (N'Office Supplies',        N'File Folder', 4)
                ) AS p(CategoryName, Name, SortOrder)
                WHERE cat.Name = p.CategoryName;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_categories_suggested_categories_SuggestedCategoryId",
                table: "categories");

            migrationBuilder.DropTable(
                name: "suggested_category_fields");

            migrationBuilder.DropTable(
                name: "suggested_products");

            migrationBuilder.DropTable(
                name: "suggested_categories");

            migrationBuilder.DropIndex(
                name: "IX_categories_SuggestedCategoryId",
                table: "categories");

            migrationBuilder.DropColumn(
                name: "SuggestedCategoryId",
                table: "categories");
        }
    }
}
