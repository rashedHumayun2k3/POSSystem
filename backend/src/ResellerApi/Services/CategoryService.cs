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
            .Include(c => c.ParentCategory).ThenInclude(p => p!.Fields)
            .OrderBy(c => c.Name)
            .ToListAsync();

        return cats.Select(MapDto).ToList();
    }

    public async Task<CategoryDto> GetAsync(Guid id)
    {
        var cat = await _db.Categories
            .AsNoTracking()
            .Include(c => c.Fields)
            .Include(c => c.ParentCategory).ThenInclude(p => p!.Fields)
            .FirstOrDefaultAsync(c => c.Id == id)
            ?? throw new KeyNotFoundException("Category not found.");

        return MapDto(cat);
    }

    public async Task<CategoryDto> CreateAsync(UpsertCategoryRequest request, Guid userId)
    {
        await ValidateParentAsync(request.ParentCategoryId, currentId: null);

        var cat = new Category
        {
            BusinessId = _business.CurrentBusinessId,
            Name = request.Name.Trim(),
            NameBn = string.IsNullOrWhiteSpace(request.NameBn) ? null : request.NameBn.Trim(),
            DefaultUnit = request.DefaultUnit?.Trim(),
            ParentCategoryId = request.ParentCategoryId
        };
        _db.Categories.Add(cat);
        await _db.SaveChangesAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "CREATE", "Category", cat.Id);
        // Re-fetch through GetAsync rather than hand-building the DTO here — ParentCategory.Fields
        // wasn't loaded on this tracked instance, so mapping it directly would show an empty
        // (wrong) inherited field list for a brand-new subcategory.
        return await GetAsync(cat.Id);
    }

    public async Task<CategoryDto> UpdateAsync(Guid id, UpsertCategoryRequest request, Guid userId)
    {
        var cat = await _db.Categories.Include(c => c.Fields).Include(c => c.Subcategories)
            .FirstOrDefaultAsync(c => c.Id == id)
            ?? throw new KeyNotFoundException("Category not found.");

        if (request.ParentCategoryId.HasValue && cat.Subcategories.Any(s => s.DeletedAt == null))
            throw new ArgumentException("A category that already has subcategories can't become a subcategory itself.");

        await ValidateParentAsync(request.ParentCategoryId, currentId: id);

        cat.Name = request.Name.Trim();
        cat.NameBn = string.IsNullOrWhiteSpace(request.NameBn) ? null : request.NameBn.Trim();
        cat.DefaultUnit = request.DefaultUnit?.Trim() ?? "pcs";
        cat.ParentCategoryId = request.ParentCategoryId;
        await _db.SaveChangesAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "UPDATE", "Category", cat.Id);
        return await GetAsync(cat.Id);
    }

    // Single-level hierarchy only — a subcategory can never itself be a parent, and a parent
    // (something with subcategories, checked by the caller) can never become a subcategory.
    private async Task<Category?> ValidateParentAsync(Guid? parentId, Guid? currentId)
    {
        if (!parentId.HasValue) return null;
        if (parentId == currentId)
            throw new ArgumentException("A category can't be its own parent.");

        var parent = await _db.Categories.FirstOrDefaultAsync(c => c.Id == parentId.Value)
            ?? throw new KeyNotFoundException("Parent category not found.");
        if (parent.ParentCategoryId.HasValue)
            throw new ArgumentException("Subcategories can only be one level deep — pick a top-level category as the parent.");
        return parent;
    }

    public async Task DeleteAsync(Guid id, Guid userId)
    {
        var cat = await _db.Categories.FirstOrDefaultAsync(c => c.Id == id)
            ?? throw new KeyNotFoundException("Category not found.");

        var hasProducts = await _db.Products.AnyAsync(p => p.CategoryId == id);
        if (hasProducts) throw new InvalidOperationException("Cannot delete a category that has products.");

        cat.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "DELETE", "Category", cat.Id);
    }

    public async Task<CategoryFieldDto> AddFieldAsync(Guid categoryId, UpsertCategoryFieldRequest request, Guid userId)
    {
        var cat = await _db.Categories.FirstOrDefaultAsync(c => c.Id == categoryId)
            ?? throw new KeyNotFoundException("Category not found.");
        if (cat.ParentCategoryId.HasValue)
            throw new ArgumentException("Subcategories don't have their own fields — edit the parent category's fields instead.");

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

    public async Task<CategoryFieldDto> UpdateFieldAsync(Guid categoryId, Guid fieldId, UpsertCategoryFieldRequest request, Guid userId)
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

    public async Task DeleteFieldAsync(Guid categoryId, Guid fieldId, Guid userId)
    {
        var field = await _db.CategoryFields.FirstOrDefaultAsync(f => f.Id == fieldId && f.CategoryId == categoryId)
            ?? throw new KeyNotFoundException("Field not found.");

        field.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
    }

    private static CategoryDto MapDto(Category cat)
    {
        // Subcategories have no fields of their own — they always show the parent's, so the
        // product form doesn't need to special-case which one it's looking at.
        var effectiveFields = cat.ParentCategory?.Fields ?? cat.Fields;
        return new(
            cat.Id, cat.Name, cat.NameBn, cat.DefaultUnit,
            effectiveFields.Where(f => f.DeletedAt == null)
                      .OrderBy(f => f.SortOrder)
                      .Select(MapFieldDto)
                      .ToList(),
            cat.ParentCategoryId,
            cat.ParentCategory?.Name,
            cat.ParentCategory?.NameBn
        );
    }

    private static CategoryFieldDto MapFieldDto(CategoryField f) => new(
        f.Id, f.Name, f.FieldType, f.OptionsJson,
        f.IsRequired, f.IsVariant, f.IsPerLot, f.SortOrder
    );
}
