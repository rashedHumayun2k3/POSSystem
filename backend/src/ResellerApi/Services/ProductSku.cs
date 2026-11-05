using System.Globalization;
using System.Text;

namespace ResellerApi.Services;

public static class ProductSku
{
    public static string Prefix(string categoryName, string productName) =>
        $"{Characters(categoryName, 2)}-{Characters(productName, 3)}-";

    private static string Characters(string value, int count)
    {
        // Text elements keep Bangla vowel signs/conjuncts attached to their letters.
        var elements = StringInfo.GetTextElementEnumerator(value.Normalize(NormalizationForm.FormKC).ToUpperInvariant());
        var result = new StringBuilder();
        var taken = 0;
        while (taken < count && elements.MoveNext())
        {
            var element = elements.GetTextElement();
            if (!element.EnumerateRunes().Any(Rune.IsLetterOrDigit)) continue;
            result.Append(element); taken++;
        }
        return result.Append('X', count - taken).ToString();
    }

    public static string Next(string prefix, IEnumerable<string> existingSkus)
    {
        long highest = 0;
        var used = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var value in existingSkus)
        {
            var sku = value.Trim();
            used.Add(sku);
            if (sku.StartsWith(prefix, StringComparison.OrdinalIgnoreCase) &&
                long.TryParse(sku.AsSpan(prefix.Length), NumberStyles.None, CultureInfo.InvariantCulture, out var serial))
                highest = Math.Max(highest, serial);
        }
        string candidate;
        do
        {
            if (highest == long.MaxValue) throw new ArgumentException("SKU serial limit reached. Please enter a unique SKU.");
            candidate = prefix + (++highest).ToString(CultureInfo.InvariantCulture);
        } while (used.Contains(candidate));
        if (candidate.Length > 50) throw new ArgumentException("Generated SKU is too long. Please enter an SKU of at most 50 characters.");
        return candidate;
    }
}
