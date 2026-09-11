using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.DTOs.Catalog;
using ResellerApi.Entities;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Services;

// Reads the starter-category list from suggested_categories/suggested_category_fields (the
// same global template tables the "Catalog Templates" picker uses) instead of a hardcoded
// dictionary, so onboarding and the post-onboarding template picker share one source of truth.
public class CategoryPresetService : ICategoryPresetService
{
    private readonly AppDbContext _db;

    public CategoryPresetService(AppDbContext db) => _db = db;

    public async Task<List<CategoryDto>> ApplyPresetAsync(Guid businessId, string businessType)
    {
        var suggestedCategories = await _db.SuggestedCategories
            .Include(sc => sc.Fields)
            .Where(sc => sc.BusinessTypeCode == businessType && sc.IsActive)
            .OrderBy(sc => sc.SortOrder)
            .ToListAsync();

        if (suggestedCategories.Count == 0)
            throw new ArgumentException($"No category preset defined for business type '{businessType}'.");

        var created = new List<CategoryDto>();

        foreach (var suggested in suggestedCategories)
        {
            var cat = new Category
            {
                BusinessId = businessId,
                SuggestedCategoryId = suggested.Id,
                Name = suggested.Name,
                DefaultUnit = suggested.DefaultUnit
            };
            _db.Categories.Add(cat);
            await _db.SaveChangesAsync();

            var fields = new List<CategoryField>();
            foreach (var fieldDef in suggested.Fields.OrderBy(f => f.SortOrder))
            {
                var field = new CategoryField
                {
                    CategoryId = cat.Id,
                    Name = fieldDef.Name,
                    FieldType = fieldDef.FieldType,
                    OptionsJson = fieldDef.OptionsJson,
                    IsRequired = fieldDef.IsRequired,
                    IsVariant = fieldDef.IsVariant,
                    IsPerLot = fieldDef.IsPerLot,
                    SortOrder = fieldDef.SortOrder
                };
                _db.CategoryFields.Add(field);
                fields.Add(field);
            }
            if (fields.Count > 0) await _db.SaveChangesAsync();

            created.Add(new CategoryDto(
                cat.Id, cat.Name, cat.NameBn, cat.DefaultUnit,
                fields.Select(f => new CategoryFieldDto(
                    f.Id, f.Name, f.FieldType, f.OptionsJson, f.IsRequired, f.IsVariant, f.IsPerLot, f.SortOrder
                )).ToList(),
                null, null, null
            ));
        }

        return created;
    }
}
