using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    /// <inheritdoc />
    // One-time backfill: seeds curated Style / Features & Specs / Item Details labels for every
    // existing category whose Name matches one of 6 known verticals (Clothing, Electronics,
    // Footwear, Bags & Accessories, Toys & Baby, Home & Kitchen). Matched by name because
    // Category has no vertical field of its own — runs safely in any environment since it only
    // touches categories that already exist there, never hardcodes specific CategoryIds.
    // Categories with no confident match (Generic, Grocery, custom one-offs) are left untouched;
    // owners can still use "+ Add row" manually, same as before this migration.
    public partial class SeedMarketplaceDetailTemplateLabelsByCategoryName : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            SeedVertical(migrationBuilder,
                categoryNames: new[] { "Panjabi/Fatua", "Kids' Wear", "Men Shirts", "Saree", "Women's Wear", "Baby Clothing", "Cloth", "Men's Wear", "Three-Piece", "Women Dresses" },
                labels: new[]
                {
                    ("STYLE", "Color", "e.g. Black, Navy Blue"),
                    ("STYLE", "Size", "e.g. M, L, XL, 42"),
                    ("STYLE", "Fit Type", "e.g. Slim Fit, Regular Fit"),
                    ("STYLE", "Fabric", "e.g. Cotton, Denim, Silk"),
                    ("STYLE", "Pattern", "e.g. Printed, Striped, Solid"),
                    ("FEATURES_SPECS", "Brand", "e.g. Aarong, Yellow"),
                    ("FEATURES_SPECS", "Gender", "e.g. Male, Female, Unisex"),
                    ("FEATURES_SPECS", "Season", "e.g. Summer, Winter, All Season"),
                    ("FEATURES_SPECS", "Sleeve Type", "e.g. Full Sleeve, Half Sleeve"),
                    ("FEATURES_SPECS", "Stretchability", "e.g. Stretchable, Non-Stretchable"),
                    ("ITEM_DETAILS", "Care Instructions", "e.g. Machine Wash, Hand Wash Only"),
                    ("ITEM_DETAILS", "Country of Origin", "e.g. Bangladesh, China"),
                    ("ITEM_DETAILS", "Package Contents", "e.g. 1 Piece"),
                    ("ITEM_DETAILS", "Weight", "e.g. 250g"),
                    ("ITEM_DETAILS", "SKU/Item Code", "e.g. PNJ-001"),
                });

            SeedVertical(migrationBuilder,
                categoryNames: new[] { "Chargers/Cables", "Mobile Accessories", "Electronics", "Mobile Phones", "Smartwatches", "Earbuds/Headphones" },
                labels: new[]
                {
                    ("STYLE", "Color", "e.g. Black, Silver"),
                    ("STYLE", "Design/Body Type", "e.g. Slim, Rugged"),
                    ("STYLE", "Finish", "e.g. Matte, Glossy"),
                    ("STYLE", "Screen Size", "e.g. 6.5 inch"),
                    ("STYLE", "Edition/Variant", "e.g. Pro, Lite"),
                    ("FEATURES_SPECS", "Brand", "e.g. Samsung, Xiaomi"),
                    ("FEATURES_SPECS", "Model Number", "e.g. SM-A155F"),
                    ("FEATURES_SPECS", "Storage/RAM", "e.g. 128GB/6GB"),
                    ("FEATURES_SPECS", "Battery", "e.g. 5000 mAh"),
                    ("FEATURES_SPECS", "Warranty", "e.g. 1 Year"),
                    ("ITEM_DETAILS", "IMEI/Serial Number", "e.g. 356789xxxxxxxxx"),
                    ("ITEM_DETAILS", "Box Contents", "e.g. Charger, Cable, Manual"),
                    ("ITEM_DETAILS", "Official/Unofficial", "e.g. Official"),
                    ("ITEM_DETAILS", "Country of Origin", "e.g. China, Vietnam"),
                    ("ITEM_DETAILS", "SKU/Item Code", "e.g. ELC-001"),
                });

            SeedVertical(migrationBuilder,
                categoryNames: new[] { "Sandals", "Women's Shoes", "Shoes", "Kids' Shoes", "Men's Shoes" },
                labels: new[]
                {
                    ("STYLE", "Color", "e.g. Black, Brown"),
                    ("STYLE", "Size", "e.g. 40, 41, 42"),
                    ("STYLE", "Style Type", "e.g. Casual, Formal, Sports"),
                    ("STYLE", "Material", "e.g. Leather, Canvas"),
                    ("STYLE", "Sole Type", "e.g. Rubber, EVA"),
                    ("FEATURES_SPECS", "Brand", "e.g. Bata, Apex"),
                    ("FEATURES_SPECS", "Gender", "e.g. Male, Female, Unisex"),
                    ("FEATURES_SPECS", "Closure", "e.g. Lace-up, Velcro, Slip-on"),
                    ("FEATURES_SPECS", "Heel Height", "e.g. 2 inch"),
                    ("FEATURES_SPECS", "Waterproof", "e.g. Yes, No"),
                    ("ITEM_DETAILS", "Country of Origin", "e.g. Bangladesh, China"),
                    ("ITEM_DETAILS", "Care Instructions", "e.g. Wipe with dry cloth"),
                    ("ITEM_DETAILS", "Package Contents", "e.g. 1 Pair"),
                    ("ITEM_DETAILS", "Weight", "e.g. 400g"),
                    ("ITEM_DETAILS", "SKU/Item Code", "e.g. SHO-001"),
                });

            SeedVertical(migrationBuilder,
                categoryNames: new[] { "Jewelry", "Handbags", "Wallets", "Watches", "Bags", "Backpacks", "Bags Test 2" },
                labels: new[]
                {
                    ("STYLE", "Color", "e.g. Black, Tan"),
                    ("STYLE", "Material", "e.g. Leather, Metal, Fabric"),
                    ("STYLE", "Design", "e.g. Classic, Modern"),
                    ("STYLE", "Size/Capacity", "e.g. Medium, 15L"),
                    ("STYLE", "Strap Type", "e.g. Shoulder Strap, Handheld"),
                    ("FEATURES_SPECS", "Brand", "e.g. Lavva, Fossil"),
                    ("FEATURES_SPECS", "Gender", "e.g. Male, Female, Unisex"),
                    ("FEATURES_SPECS", "Compartments/Pockets", "e.g. 3 Compartments"),
                    ("FEATURES_SPECS", "Water Resistance", "e.g. Yes, No"),
                    ("FEATURES_SPECS", "Warranty", "e.g. 6 Months"),
                    ("ITEM_DETAILS", "Country of Origin", "e.g. Bangladesh, China"),
                    ("ITEM_DETAILS", "Dimensions", "e.g. 30x20x10 cm"),
                    ("ITEM_DETAILS", "Weight", "e.g. 500g"),
                    ("ITEM_DETAILS", "Package Contents", "e.g. 1 Piece"),
                    ("ITEM_DETAILS", "SKU/Item Code", "e.g. BAG-001"),
                });

            SeedVertical(migrationBuilder,
                categoryNames: new[] { "Baby Care", "Toys", "Feeding & Nursing" },
                labels: new[]
                {
                    ("STYLE", "Color", "e.g. Multicolor"),
                    ("STYLE", "Character/Theme", "e.g. Cartoon, Superhero"),
                    ("STYLE", "Size", "e.g. Small, Medium"),
                    ("STYLE", "Material", "e.g. Plastic, Soft, Wooden"),
                    ("STYLE", "Type", "e.g. Remote Control, Educational"),
                    ("FEATURES_SPECS", "Age Range", "e.g. 3+ Years"),
                    ("FEATURES_SPECS", "Brand", "e.g. Fisher-Price"),
                    ("FEATURES_SPECS", "Battery Required", "e.g. Yes, No"),
                    ("FEATURES_SPECS", "Safety Certification", "e.g. CE Certified"),
                    ("FEATURES_SPECS", "Washable", "e.g. Yes, No"),
                    ("ITEM_DETAILS", "Number of Pieces", "e.g. 1 Piece, Set of 3"),
                    ("ITEM_DETAILS", "Package Contents", "e.g. 1 Toy, 1 Manual"),
                    ("ITEM_DETAILS", "Country of Origin", "e.g. China"),
                    ("ITEM_DETAILS", "Weight", "e.g. 200g"),
                    ("ITEM_DETAILS", "SKU/Item Code", "e.g. TOY-001"),
                });

            SeedVertical(migrationBuilder,
                categoryNames: new[] { "Home Decor", "Bedding" },
                labels: new[]
                {
                    ("STYLE", "Color", "e.g. White, Beige"),
                    ("STYLE", "Material", "e.g. Steel, Ceramic, Cotton"),
                    ("STYLE", "Design/Pattern", "e.g. Floral, Geometric"),
                    ("STYLE", "Size/Dimensions", "e.g. 10x10 inch"),
                    ("STYLE", "Shape", "e.g. Round, Square"),
                    ("FEATURES_SPECS", "Brand", "e.g. Kiam, RFL"),
                    ("FEATURES_SPECS", "Capacity", "e.g. 2 Liter"),
                    ("FEATURES_SPECS", "Heat Resistant", "e.g. Yes, No"),
                    ("FEATURES_SPECS", "Set Contents", "e.g. Set of 4"),
                    ("FEATURES_SPECS", "Usage Type", "e.g. Oven Safe, Dishwasher Safe"),
                    ("ITEM_DETAILS", "Weight", "e.g. 1kg"),
                    ("ITEM_DETAILS", "Country of Origin", "e.g. Bangladesh, China"),
                    ("ITEM_DETAILS", "Care Instructions", "e.g. Hand Wash Only"),
                    ("ITEM_DETAILS", "Package Contents", "e.g. 1 Set"),
                    ("ITEM_DETAILS", "SKU/Item Code", "e.g. HK-001"),
                });
        }

        private static void SeedVertical(
            MigrationBuilder migrationBuilder,
            string[] categoryNames,
            (string Section, string Label, string ValuePlaceholder)[] labels)
        {
            var nameList = string.Join(", ", Array.ConvertAll(categoryNames, n => "N'" + n.Replace("'", "''") + "'"));

            var valuesRows = new string[labels.Length];
            for (var i = 0; i < labels.Length; i++)
            {
                var (section, label, placeholder) = labels[i];
                valuesRows[i] =
                    $"('{section}', N'{label.Replace("'", "''")}', N'{placeholder.Replace("'", "''")}', {i})";
            }
            var valuesList = string.Join(",\n            ", valuesRows);

            migrationBuilder.Sql($@"
INSERT INTO marketplace_detail_template_labels (Id, CategoryId, Section, Label, ValuePlaceholder, SortOrder, CreatedAt, UpdatedAt)
SELECT NEWID(), c.Id, v.Section, v.Label, v.ValuePlaceholder, v.SortOrder, SYSUTCDATETIME(), SYSUTCDATETIME()
FROM categories c
CROSS JOIN (VALUES
            {valuesList}
) AS v(Section, Label, ValuePlaceholder, SortOrder)
WHERE c.DeletedAt IS NULL AND c.Name IN ({nameList});
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DELETE FROM marketplace_detail_template_labels;");
        }
    }
}
