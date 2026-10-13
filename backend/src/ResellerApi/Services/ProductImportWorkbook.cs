using System.Globalization;
using System.IO.Compression;
using ClosedXML.Excel;
using ResellerApi.DTOs.Catalog;

namespace ResellerApi.Services;

public static class ProductImportWorkbook
{
    public const int MaxRows = 50;
    public const int MaxBytes = 5 * 1024 * 1024;
    public static readonly string[] Headers = ["Product SKU", "Product Name", "Initial Quantity", "Buy Price", "Sell Price"];

    public static byte[] Template()
    {
        using var book = new XLWorkbook();
        var sheet = book.AddWorksheet("Products");
        for (var i = 0; i < Headers.Length; i++) sheet.Cell(1, i + 1).Value = Headers[i];
        sheet.Range("A1:E1").Style.Font.Bold = true;
        sheet.Range("A1:E1").Style.Fill.BackgroundColor = XLColor.FromHtml("#E4F3EE");
        sheet.Columns(1, 2).Width = 25;
        sheet.Columns(3, 5).Width = 20;
        sheet.Range("A2:B51").Style.NumberFormat.Format = "@";
        // General displays whole quantities without a trailing decimal separator and preserves fractions.
        sheet.Range("C2:C51").Style.NumberFormat.Format = "General";
        sheet.Range("D2:E51").Style.NumberFormat.Format = "0.00";
        sheet.SheetView.FreezeRows(1);
        var help = book.AddWorksheet("Instructions");
        string[] instructions = ["Bulk product upload — maximum 50 new products", "Enter products in the Products sheet. Keep all five headers; their order may change.",
            "SKU and Product Name are required. SKU must be unique within your business (including deleted products).",
            "Keep SKU as text to preserve leading zeros. Maximum SKU length: 50; name: 300.",
            "Initial Quantity must be greater than zero. Buy Price must be zero or greater. Sell Price must be greater than zero.",
            "Use plain numbers: up to three decimal places for quantities and two for prices; no currency symbols or thousands separators.",
            "Select one category at the top of the review screen. It is required and applies to every product in this upload.",
            "The category determines the unit. Opening stock is recorded in the branch selected in the app.",
            "One simple product per row. Blank rows are ignored. Formula cells are not supported; paste values instead.",
            "Example only (do not import this line): 00123 | Cotton Shirt | 10 | 250 | 400",
            "Save as .xlsx, maximum 5 MB. Existing products are never updated by an import."];
        for (var i = 0; i < instructions.Length; i++) help.Cell(i + 1, 1).Value = instructions[i];
        help.Column(1).Width = 110;
        help.Column(1).Style.Alignment.WrapText = true;
        using var output = new MemoryStream();
        book.SaveAs(output);
        return output.ToArray();
    }

    public static List<ProductImportRow> Read(ProductImportUpload upload)
    {
        if (!string.Equals(Path.GetExtension(upload.FileName), ".xlsx", StringComparison.OrdinalIgnoreCase))
            throw new ArgumentException("Upload an Excel (.xlsx) file using the product template.");
        if (string.IsNullOrWhiteSpace(upload.Base64) || upload.Base64.Length > (MaxBytes + 2L) / 3 * 4)
            throw new ArgumentException("The Excel file must be between 1 byte and 5 MB.");
        byte[] bytes;
        try { bytes = Convert.FromBase64String(upload.Base64); }
        catch (FormatException) { throw new ArgumentException("The uploaded file is unreadable. Choose the Excel file again."); }
        if (bytes.Length > MaxBytes) throw new ArgumentException("The Excel file cannot exceed 5 MB.");
        try
        {
            using var stream = new MemoryStream(bytes);
            // Bound decompression before the workbook library loads the file into memory.
            using (var archive = new ZipArchive(stream, ZipArchiveMode.Read, true))
            {
                if (archive.Entries.Count > 500 || archive.Entries.Sum(e => e.Length) > 20 * 1024 * 1024)
                    throw new ArgumentException("This workbook is too complex. Copy the product values into a fresh template.");
                if (archive.GetEntry("xl/workbook.xml") is null || archive.Entries.Any(e => e.FullName.EndsWith("vbaProject.bin", StringComparison.OrdinalIgnoreCase)))
                    throw new ArgumentException("Upload a standard .xlsx workbook without macros.");
            }
            stream.Position = 0;
            using var book = new XLWorkbook(stream);
            var sheets = book.Worksheets.Where(s => !s.Name.Equals("Instructions", StringComparison.OrdinalIgnoreCase)).ToList();
            if (sheets.Count != 1) throw new ArgumentException("Use one product sheet and an optional Instructions sheet.");
            var sheet = sheets[0];
            var headerCells = sheet.Row(1).CellsUsed(XLCellsUsedOptions.Contents).ToList();
            var columns = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            foreach (var cell in headerCells)
            {
                var header = cell.GetString().Trim();
                if (cell.HasFormula || !Headers.Contains(header, StringComparer.OrdinalIgnoreCase) || !columns.TryAdd(header, cell.Address.ColumnNumber))
                    throw new ArgumentException("The column headers do not match the template. Download a fresh template.");
            }
            if (Headers.Any(h => !columns.ContainsKey(h)))
                throw new ArgumentException("Missing columns: " + string.Join(", ", Headers.Where(h => !columns.ContainsKey(h))) + ".");
            var rows = new List<ProductImportRow>();
            foreach (var row in sheet.RowsUsed(XLCellsUsedOptions.Contents).Where(r => r.RowNumber() > 1))
            {
                if (row.CellsUsed(XLCellsUsedOptions.Contents).Any(c => !columns.Values.Contains(c.Address.ColumnNumber)))
                    throw new ArgumentException($"Row {row.RowNumber()}: Data found outside the template columns.");
                var cells = Headers.Select(h => row.Cell(columns[h])).ToArray();
                if (cells.Any(c => c.HasFormula)) throw new ArgumentException($"Row {row.RowNumber()}: Paste values instead of formulas.");
                var values = cells.Select((c, index) => c.DataType == XLDataType.Number
                    ? index == 0 ? c.GetFormattedString(CultureInfo.InvariantCulture).Trim()
                        : c.GetDouble().ToString("0.################", CultureInfo.InvariantCulture)
                    : c.GetString().Trim()).ToArray();
                if (values.All(string.IsNullOrWhiteSpace)) continue;
                if (rows.Count == MaxRows) throw new ArgumentException("Maximum 50 products per upload. Split the file into smaller batches; nothing has been imported.");
                rows.Add(new(row.RowNumber(), values[0], values[1], "", null, values[2], values[3], values[4]));
            }
            if (rows.Count == 0) throw new ArgumentException("No products found. Fill in the Products sheet below the header.");
            return rows;
        }
        catch (ArgumentException) { throw; }
        catch (Exception ex) when (ex is not OutOfMemoryException)
        { throw new ArgumentException("This is not a readable Excel workbook. Download the template and save it as .xlsx."); }
    }

    public static bool TryNumber(string? value, out decimal number) =>
        decimal.TryParse(value, NumberStyles.AllowDecimalPoint | NumberStyles.AllowLeadingSign, CultureInfo.InvariantCulture, out number)
        && decimal.Abs(number) < 100000000000000m && decimal.Round(number, 4) == number;

    public static byte[] ErrorReport(ProductImportPreview preview)
    {
        using var book = new XLWorkbook();
        var sheet = book.AddWorksheet("Errors");
        string[] headers = ["Spreadsheet Row", .. Headers, "Errors"];
        for (var i = 0; i < headers.Length; i++) sheet.Cell(1, i + 1).Value = headers[i];
        sheet.Row(1).Style.Font.Bold = true;
        sheet.Columns(1, 7).Width = 24;
        sheet.Column(7).Width = 70;
        sheet.Column(7).Style.Alignment.WrapText = true;
        var index = 2;
        foreach (var row in preview.Rows.Where(r => preview.Errors.Any(e => e.RowNumber == r.RowNumber)))
        {
            string[] values = [row.RowNumber.ToString(), row.Sku, row.Name, row.Quantity, row.BuyPrice, row.SellPrice,
                string.Join("; ", preview.Errors.Where(e => e.RowNumber == row.RowNumber).Select(e => e.Message))];
            for (var i = 0; i < values.Length; i++) sheet.Cell(index, i + 1).Value = values[i];
            index++;
        }
        using var output = new MemoryStream(); book.SaveAs(output); return output.ToArray();
    }
}
