# Customer invoice PDF

The Invoices report opens `/more/reports/invoices/{id}` as a preview page. It requests `/orders/{id}/invoice/preview`, which renders the shared A4 layout directly to PNG pages, without generating a PDF. Download PDF requests `/orders/{id}/invoice` and saves the file. Print uses the preview's A4 print styles with the app navigation and controls hidden. The separate `/orders/{id}/receipt` action retains thermal receipts for Shop and Hawker sales.

Set `Media__BaseUrl` on the API host to the standalone media service origin so business logos can be loaded. Development defaults to `http://localhost:5090`. Legacy local uploads are still supported. If a logo is unavailable, the invoice displays the business name.

Currency comes from the business. Contact details come from the order branch and business website. Document reference is stable: `INV-{OrderNo}`. No QR code is printed. Internal order notes and cost/profit fields are omitted.

Below 768px, the invoice preview displays a responsive HTML customer copy: seller and customer details stack vertically, every item has an expanded card with all ten table fields, and totals appear once after the items. Structured customer-only data is included in the preview response; monetary strings and discount allocation are calculated on the server. Desktop preview, printing, and PDF downloads retain the A4 layout.

Historical MRP, tax, and fiscal registration data are not captured on orders today; missing values display a dash. The renderer accepts optional seller registration values through `InvoiceSeller`, but this change does not invent or populate them. Order discounts are allocated proportionally across item rows, with the rounding remainder on the final row. Payable is the unpaid balance, never negative; overpayments display separately.

Preview and regression checks:

```powershell
$env:INVOICE_PREVIEW_DIR = 'E:\LavLokshan\.tmp\invoice-preview'
dotnet test backend/src/ResellerApi.Tests/ResellerApi.Tests.csproj --filter FullyQualifiedName~CustomerInvoicePdfTests
```
