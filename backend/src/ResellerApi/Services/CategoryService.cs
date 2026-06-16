using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.DTOs.Catalog;
using ResellerApi.Entities;
using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Services;

public class CategoryService : ICategoryService
{
    private readonly AppDbContext _db;
    private readonly IBusinessContext _business;
    private readonly IActivityLogService _log;

    public CategoryService(AppDbContext db, IBusinessContext business, IActivityLogService log)
    {
        _db = db;
        _business = business;
        _log = log;
    }

    public async Task<List<CategoryDto>> ListAsync()
    {
        var cats = await _db.Categories
            .AsNoTracking()
            .Include(c => c.Fields)
            .OrderBy(c => c.Name)
            .ToListAsync();

        return cats.Select(MapDto).ToList();
    }

    public async Task<CategoryDto> GetAsync(Guid id)
    {
        var cat = await _db.Categories
            .AsNoTracking()
            .Include(c => c.Fields)
            .FirstOrDefaultAsync(c => c.Id == id)
            ?? throw new KeyNotFoundException("Category not found.");

        return MapDto(cat);
    }

    public async Task<CategoryDto> CreateAsync(UpsertCategoryRequest request)
    {
        var cat = new Category
        {
            BusinessId = _business.CurrentBusinessId,
            Name = request.Name.Trim(),
            DefaultUnit = request.DefaultUnit?.Trim()
        };
        _db.Categories.Add(cat);
        await _db.SaveChangesAsync();
        await _log.LogAsync(_business.CurrentBusinessId, Guid.Empty, "CREATE", "Category", cat.Id);
        return MapDto(cat);
    }

    public async Task<CategoryDto> UpdateAsync(Guid id, UpsertCategoryRequest request)
    {
        var cat = await _db.Categories.Include(c => c.Fields)
            .FirstOrDefaultAsync(c => c.Id == id)
            ?? throw new KeyNotFoundException("Category not found.");

        cat.Name = request.Name.Trim();
        cat.DefaultUnit = request.DefaultUnit?.Trim() ?? "pcs";
        await _db.SaveChangesAsync();
        await _log.LogAsync(_business.CurrentBusinessId, Guid.Empty, "UPDATE", "Category", cat.Id);
        return MapDto(cat);
    }

    public async Task DeleteAsync(Guid id)
    {
        var cat = await _db.Categories.FirstOrDefaultAsync(c => c.Id == id)
            ?? throw new KeyNotFoundException("Category not found.");

        var hasProducts = await _db.Products.AnyAsync(p => p.CategoryId == id);
        if (hasProducts) throw new InvalidOperationException("Cannot delete a category that has products.");

        cat.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        await _log.LogAsync(_business.CurrentBusinessId, Guid.Empty, "DELETE", "Category", cat.Id);
    }

    public async Task<CategoryFieldDto> AddFieldAsync(Guid categoryId, UpsertCategoryFieldRequest request)
    {
        var cat = await _db.Categories.FirstOrDefaultAsync(c => c.Id == categoryId)
            ?? throw new KeyNotFoundException("Category not found.");

        var field = new CategoryField
        {
            CategoryId = categoryId,
            Name = request.Name.Trim(),
            FieldType = request.FieldType.ToUpper(),
            OptionsJson = request.OptionsJson,
            IsRequired = request.IsRequired,
            IsVariant = request.IsVariant,
            IsPerLot = request.IsPerLot,
            SortOrder = request.SortOrder
        };
        _db.CategoryFields.Add(field);
        await _db.SaveChangesAsync();
        return MapFieldDto(field);
    }

    public async Task<CategoryFieldDto> UpdateFieldAsync(Guid categoryId, Guid fieldId, UpsertCategoryFieldRequest request)
    {
        var field = await _db.CategoryFields.FirstOrDefaultAsync(f => f.Id == fieldId && f.CategoryId == categoryId)
            ?? throw new KeyNotFoundException("Field not found.");

        field.Name = request.Name.Trim();
        field.FieldType = request.FieldType.ToUpper();
        field.OptionsJson = request.OptionsJson;
        field.IsRequired = request.IsRequired;
        field.IsVariant = request.IsVariant;
        field.IsPerLot = request.IsPerLot;
        field.SortOrder = request.SortOrder;
        await _db.SaveChangesAsync();
        return MapFieldDto(field);
    }

    public async Task DeleteFieldAsync(Guid categoryId, Guid fieldId)
    {
        var field = await _db.CategoryFields.FirstOrDefaultAsync(f => f.Id == fieldId && f.CategoryId == categoryId)
            ?? throw new KeyNotFoundException("Field not found.");

        field.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
    }

    private static CategoryDto MapDto(Category cat) => new(
        cat.Id, cat.Name, cat.DefaultUnit,
        cat.Fields.Where(f => f.DeletedAt == null)
                  .OrderBy(f => f.SortOrder)
                  .Select(MapFieldDto)
                  .ToList()
    );

    private static CategoryFieldDto MapFieldDto(CategoryField f) => new(
        f.Id, f.Name, f.FieldType, f.OptionsJson,
        f.IsRequired, f.IsVariant, f.IsPerLot, f.SortOrder
    );
}
