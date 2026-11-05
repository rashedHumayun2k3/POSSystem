import { profitBasis, profitMoney, type ProductProfitReport } from "../types/productProfit";
import { productSalesLink, type ReportScope } from "./productSalesLink";

const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, character =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
const money = (value: number | null | undefined) => escapeHtml(profitMoney(value));
const number = (value: number) => escapeHtml(value.toLocaleString("en-BD", { maximumFractionDigits: 20 }));
const tone = (value: number | null | undefined) => value == null ? "unavailable" : value < 0 ? "negative" : "";

/** Presentation only: all amounts, ranks and dates come from the report response. */
export function buildProductProfitDocument(report: ProductProfitReport, business: string, selection: string, branch: string, scope: ReportScope = {}): string {
  const totals = report.totals;
  const productName = (id: string, name: string) => scope.origin && id !== "00000000-0000-0000-0000-000000000000"
    ? `<a class="product-link" href="${escapeHtml(productSalesLink(id, report.from, report.to, scope))}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(`View sales history for ${name} (opens in a new tab)`)}">${escapeHtml(name)}</a>`
    : escapeHtml(name);
  const complete = [totals.sales, totals.cost, totals.profit].every(value => value != null && Number.isFinite(value));
  // Compare the displayed two-decimal amounts without changing the source figures.
  const reconciles = complete && Math.round(totals.sales * 100) - Math.round(totals.cost! * 100) === Math.round(totals.profit! * 100);
  const reconciliationTitle = !complete ? "Reconciliation unavailable" : reconciles ? "Totals reconciled" : "Review totals";
  const reconciliationDetail = !complete
    ? "Product cost or profit is unavailable. No missing amount has been estimated."
    : reconciles
      ? `${money(totals.sales)} sales − ${money(totals.cost)} product cost = ${money(totals.profit)} product profit.`
      : "The displayed sales minus product cost does not equal the displayed product profit. Figures are preserved; review the source amounts or rounding before relying on this report.";
  const metric = (label: string, value: string, note: string, extra = "") =>
    `<article class="kpi ${extra}"><h3>${label}</h3><p class="kpi-value">${value}</p><p class="kpi-note">${note}</p></article>`;
  const heading = (index: string, id: string, title: string, detail: string) =>
    `<header class="section-heading"><div class="section-title"><span class="section-index" aria-hidden="true">${index}</span><h2 id="${id}">${title}</h2></div><p>${detail}</p></header>`;
  const highlight = (title: string, name: string | undefined, value: number | null | undefined, measure: "profit" | "sales", description: string, productId?: string) =>
    `<article class="highlight"><h3>${title}</h3><p class="highlight-name">${productId && name ? productName(productId, name) : escapeHtml(name ?? "No eligible sales")}</p><p class="highlight-amount ${tone(value)}">${money(value)}<span>${measure}</span></p><p class="highlight-note">${description}</p></article>`;
  const dailyRows = report.daily.map(day => `<tr><th scope="row" class="date">${escapeHtml(day.date)}</th><td class="amount">${money(day.totals.sales)}</td><td class="amount profit ${tone(day.totals.profit)}">${money(day.totals.profit)}</td></tr>`).join("");
  const productRows = report.products.map(product => `<tr><th scope="row" class="product-name">${productName(product.id, product.name)}${product.totals.profit != null && product.totals.profit < 0 ? '<span class="row-note negative">Loss-making product</span>' : product.totals.missingCostLines > 0 ? '<span class="row-note">Incomplete saved cost</span>' : ""}</th><td class="amount">${number(product.totals.units)}</td><td class="amount">${money(product.totals.sales)}</td><td class="amount ${tone(product.totals.cost)}">${money(product.totals.cost)}</td><td class="amount profit ${tone(product.totals.profit)}">${money(product.totals.profit)}</td></tr>`).join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>Product Profit Report | ${escapeHtml(business)} | ${escapeHtml(report.from)} – ${escapeHtml(report.to)}</title>
<style>
  :root{--navy:#142b49;--navy-deep:#102139;--text:#26384d;--muted:#637286;--line:#e0e6ed;--soft:#f5f7fa;--orange:#d97831;--loss:#a33232;--paper:#fff}
  *{box-sizing:border-box}
  body{margin:0;background:#eaf0f5;color:var(--text);font-family:Arial,"Helvetica Neue","Noto Sans Bengali",sans-serif;font-size:13px;line-height:1.5;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  h1,h2,h3,p,dl,dd{margin:0}button{font:inherit}button:focus-visible{outline:3px solid var(--orange);outline-offset:3px}
  .toolbar{max-width:1240px;margin:auto;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:20px 24px}
  .toolbar-label{color:var(--navy);font-size:13px;font-weight:700}.toolbar-hint{display:block;color:var(--muted);font-size:12px;font-weight:400;margin-top:2px}
  .print-button{border:1px solid var(--navy);border-radius:7px;background:var(--navy);color:white;padding:12px 20px;min-height:44px;font-weight:700;cursor:pointer;white-space:nowrap}.print-button:hover{background:#234264}
  .report{max-width:1192px;margin:0 auto 32px;background:var(--paper);border:1px solid #d9e1e9;border-top:5px solid var(--navy);box-shadow:0 12px 32px #142b490a;padding:34px 38px}
  .executive-header{padding-bottom:24px;border-bottom:1px solid var(--line)}
  .masthead{display:flex;justify-content:space-between;gap:24px;align-items:flex-start}
  .eyebrow{text-transform:uppercase;letter-spacing:1.7px;color:var(--muted);font-size:10px;font-weight:700;margin-bottom:8px}
  h1{font-size:30px;line-height:1.2;letter-spacing:-.8px;color:var(--navy-deep);font-weight:750}.subtitle{margin-top:9px;color:var(--muted);font-size:13px}
  .business{max-width:38%;text-align:right;font-size:15px;font-weight:700;color:var(--navy);overflow-wrap:anywhere}.business span{display:block;color:var(--muted);font-size:10px;font-weight:400;letter-spacing:1px;text-transform:uppercase;margin-top:5px}
  .metadata{display:grid;grid-template-columns:1.25fr 1fr 1.5fr .8fr;gap:18px;margin-top:24px;padding-top:16px;border-top:2px solid var(--orange)}
  .metadata dt{color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.8px;font-weight:700;margin-bottom:5px}.metadata dd{font-size:12px;font-weight:600;color:var(--navy);overflow-wrap:anywhere}
  .section{margin-top:26px}.section-heading{margin-bottom:13px;break-after:avoid;page-break-after:avoid}.section-title{display:flex;align-items:center;gap:10px}.section-index{font-size:10px;font-weight:700;color:var(--orange);letter-spacing:1px}h2{font-size:17px;font-weight:700;color:var(--navy);letter-spacing:-.2px}.section-heading>p{color:var(--muted);font-size:11px;margin-top:4px}
  .kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1.25fr)) repeat(2,minmax(0,.9fr));gap:10px}
  .kpi{border:1px solid var(--line);border-radius:8px;padding:16px 13px 13px;min-width:0;background:white;break-inside:avoid}.kpi h3{font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px}
  .kpi-value{font-size:clamp(16px,1.75vw,25px);font-weight:750;letter-spacing:-.5px;line-height:1.3;color:var(--navy-deep);margin-top:12px;text-align:right;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
  .kpi-note{color:var(--muted);font-size:10px;margin-top:8px}.kpi.featured{background:#f0f4f8;border-color:#b8c7d8;border-top:3px solid var(--orange);padding-top:14px}.kpi.negative .kpi-value{color:var(--loss)}.kpi.unavailable .kpi-value{font-size:16px;color:var(--muted)}
  .reconciliation{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-top:12px;padding:10px 12px;background:var(--soft);border-left:3px solid #71859b;font-size:11px;break-inside:avoid}.reconciliation strong{color:var(--navy)}.reconciliation span{color:var(--muted)}.reconciliation.review{background:#fff6eb;border-color:var(--orange)}
  .alert{padding:12px 15px;margin-top:14px;background:#fff8ed;border:1px solid #edd9bf;border-radius:6px;font-size:11px;color:#865322;break-inside:avoid}.alert strong{display:block;margin-bottom:3px}
  .table-scroll{width:100%;overflow-x:auto;border-top:1px solid var(--line)}table{width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed}
  thead{display:table-header-group}tfoot{display:table-row-group}tr{break-inside:avoid;page-break-inside:avoid}th,td{padding:11px 13px;border-bottom:1px solid var(--line);vertical-align:top;text-align:left;overflow-wrap:anywhere}
  thead th{background:var(--soft);color:var(--muted);font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;vertical-align:bottom}tbody th{font-weight:500;color:var(--navy)}tbody tr:nth-child(even){background:#fafbfd}.amount{text-align:right;font-variant-numeric:tabular-nums}.profit{font-weight:700;color:var(--navy)}.negative{color:var(--loss)!important}.unavailable{color:var(--muted);font-weight:400}
  tfoot th,tfoot td{background:#eef3f8;border-top:2px solid #bfcddd;border-bottom:0;color:var(--navy);font-weight:700;padding-top:13px;padding-bottom:13px}.date{font-variant-numeric:tabular-nums}.empty{text-align:center;padding:24px;color:var(--muted)}.row-note{display:block;font-size:10px;color:var(--muted);margin-top:3px}
  .highlights{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.highlight{padding:15px;border:1px solid var(--line);border-radius:7px;break-inside:avoid}.highlight h3{font-size:10px;text-transform:uppercase;letter-spacing:.4px;color:var(--muted);font-weight:700}.highlight-name{font-size:14px;font-weight:700;color:var(--navy);margin-top:10px;overflow-wrap:anywhere}.highlight-amount{font-size:19px;font-weight:700;color:var(--navy);margin-top:10px;text-align:right;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}.highlight-amount span{display:block;font-size:10px;color:var(--muted);font-weight:400}.highlight-note{font-size:10px;color:var(--muted);margin-top:10px}.section-note{font-size:10px;color:var(--muted);margin-top:10px}
  .basis{padding:18px 20px;background:var(--soft);border:1px solid var(--line);border-radius:7px;break-inside:avoid}.formula{font-size:14px;font-weight:700;color:var(--navy);margin-bottom:12px}.basis-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 24px}.basis-grid h3{font-size:11px;color:var(--navy);margin-bottom:3px}.basis-grid p{font-size:11px;color:var(--muted)}.basis-rule{font-size:10px;color:var(--muted);margin-top:14px;padding-top:12px;border-top:1px solid var(--line)}
  .product-link{color:var(--navy);text-decoration:underline;text-decoration-color:#9eafc2;text-underline-offset:3px}.product-link:hover{color:#a34c15}.product-link:focus-visible{outline:2px solid var(--orange);outline-offset:3px}
  .footer{display:flex;justify-content:space-between;gap:16px;margin-top:24px;padding-top:12px;border-top:1px solid var(--line);font-size:10px;color:var(--muted)}.footer strong{color:var(--navy);font-weight:600}
  @media screen and (max-width:900px){.report{margin:0 16px 24px;padding:26px}.kpis{grid-template-columns:repeat(3,minmax(0,1fr))}.kpi-value{font-size:23px}.highlights{grid-template-columns:repeat(2,minmax(0,1fr))}.metadata{grid-template-columns:repeat(2,minmax(0,1fr))}}
  @media screen and (max-width:560px){.toolbar{padding:14px 16px;align-items:flex-start;flex-wrap:wrap}.toolbar-hint{font-size:11px}.report{margin:0 8px 16px;padding:20px 14px}.masthead{flex-direction:column;gap:12px}h1{font-size:26px}.business{max-width:100%;text-align:left}.metadata{gap:14px}.kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.kpi.featured{grid-column:1/-1;grid-row:1}.kpi-value{font-size:21px}.highlights,.basis-grid{grid-template-columns:1fr}.highlight-amount{font-size:21px}.daily-table{min-width:420px}.product-table{min-width:680px}.footer{flex-direction:column;gap:4px}.section{margin-top:22px}}
  @page{size:A4 landscape;margin:12mm}
  @media print{
    body{background:white;font-size:10px}.toolbar{display:none!important}.report{width:auto;max-width:none;margin:0;padding:0;border:0;border-top:3px solid var(--navy);box-shadow:none}
    .executive-header{padding-top:6mm;padding-bottom:4mm;break-inside:avoid}.masthead{gap:15px}h1{font-size:24px}.subtitle{font-size:10px;margin-top:5px}.eyebrow{font-size:8px;margin-bottom:4px}.business{font-size:12px}.business span{font-size:8px}
    .metadata{margin-top:4mm;padding-top:3mm;gap:4mm}.metadata dt{font-size:8px}.metadata dd{font-size:10px}.section{margin-top:5mm}.section-heading{margin-bottom:3mm}h2{font-size:14px}.section-heading>p{font-size:9px}
    .kpis{grid-template-columns:repeat(3,minmax(0,1.25fr)) repeat(2,minmax(0,.9fr));gap:2mm}.kpi{padding:3mm;break-inside:avoid}.kpi h3{font-size:8px}.kpi-value{font-size:19px;margin-top:2mm}.kpi-note{font-size:8px;margin-top:2mm}.kpi.unavailable .kpi-value{font-size:12px}.kpi.featured{padding-top:calc(3mm - 2px)}
    .reconciliation{font-size:9px;padding:2mm 3mm;margin-top:2mm}.alert{font-size:9px;padding:3mm;margin-top:3mm}.table-scroll{overflow:visible}table{font-size:10px}th,td{padding:2.5mm 3mm}thead th{font-size:8px}tfoot th,tfoot td{padding:3mm}.daily-table,.product-table{min-width:0}
    .highlights{grid-template-columns:repeat(4,minmax(0,1fr));gap:3mm}.highlight{padding:3mm}.highlight h3{font-size:8px}.highlight-name{font-size:11px;margin-top:2mm}.highlight-amount{font-size:16px;margin-top:2mm}.highlight-amount span,.highlight-note,.section-note,.row-note{font-size:8px}.highlight-note{margin-top:2mm}
    .basis{padding:4mm}.formula{font-size:12px;margin-bottom:3mm}.basis-grid{gap:3mm 5mm}.basis-grid h3{font-size:9px}.basis-grid p{font-size:9px}.basis-rule{font-size:8px;margin-top:3mm;padding-top:3mm}.footer{font-size:8px;margin-top:5mm;padding-top:3mm}
    .product-link{color:inherit;text-decoration:none}h2,h3{break-after:avoid}p{orphans:3;widows:3}
  }
</style>
</head>
<body>
  <nav class="toolbar" aria-label="Report actions"><div class="toolbar-label">Executive report preview<span class="toolbar-hint">A4 landscape · Use the print dialog to save a PDF</span></div><button class="print-button" type="button" onclick="window.print()">Print / Save PDF</button></nav>
  <main class="report">
    <header class="executive-header">
      <div class="masthead"><div><p class="eyebrow">Management review · Product performance</p><h1>Product Profit Report</h1><p class="subtitle">An executive view of sales, product cost and profitability.</p></div><p class="business">${escapeHtml(business)}<span>Prepared for management</span></p></div>
      <dl class="metadata"><div><dt>Reporting period</dt><dd>${escapeHtml(report.from)} — ${escapeHtml(report.to)}</dd></div><div><dt>Branch</dt><dd>${escapeHtml(branch)}</dd></div><div><dt>Product scope</dt><dd>${escapeHtml(selection)}</dd></div><div><dt>Product category</dt><dd>Not specified</dd></div></dl>
    </header>

    <section class="section" aria-labelledby="overview">
      ${heading("01", "overview", "Financial Overview", "BDT (৳) · Completed sales within the selected reporting scope")}
      <div class="kpis">
        ${metric("Total Sales", money(totals.sales), "After product and order discounts")}
        ${metric("Total Product Cost", money(totals.cost), "Saved landed purchase cost", tone(totals.cost))}
        ${metric("Net Product Profit", money(totals.profit), "Before delivery and business expenses", `featured ${tone(totals.profit)}`)}
        ${metric("Profit Margin", totals.marginPercent == null ? "Not available" : `${number(totals.marginPercent)}%`, "Reported product profit margin", tone(totals.marginPercent))}
        ${metric("Units Sold", number(totals.units), "Selected products")}
      </div>
      <div class="reconciliation ${!reconciles ? "review" : ""}" role="note"><strong>${reconciliationTitle}</strong><span>${reconciliationDetail}</span></div>
      ${totals.missingCostLines > 0 ? `<div class="alert" role="note"><strong>Cost completeness · ${number(totals.missingCostLines)} sale lines require attention</strong>Saved purchase costs are missing or zero. Affected cost and profit totals remain unavailable; profit rankings omit incomplete entries. Missing values are not treated as zero.</div>` : ""}
    </section>

    <section class="section" aria-labelledby="daily">
      ${heading("02", "daily", "Daily Profit Performance", "Recorded sale dates · Days without completed sales are omitted")}
      <div class="table-scroll" tabindex="0" role="region" aria-label="Daily profit table"><table class="daily-table"><colgroup><col style="width:36%"><col style="width:32%"><col style="width:32%"></colgroup><thead><tr><th scope="col">Sale date</th><th scope="col" class="amount">Sales amount</th><th scope="col" class="amount">Product profit</th></tr></thead><tbody>${dailyRows || '<tr><td colspan="3" class="empty">No completed sales for the selected period and products.</td></tr>'}</tbody><tfoot><tr><th scope="row">Period total</th><td class="amount">${money(totals.sales)}</td><td class="amount ${tone(totals.profit)}">${money(totals.profit)}</td></tr></tfoot></table></div>
    </section>

    <section class="section" aria-labelledby="highlights">
      ${heading("03", "highlights", "Management Highlights", "Key contributors within the same reporting period and product selection")}
      <div class="highlights">
        ${highlight("Highest-profit day", report.topDay?.date, report.topDay?.totals.profit, "profit", "Ranked by total daily product profit.")}
        ${highlight("Most profitable product", report.topProduct?.name, report.topProduct?.totals.profit, "profit", "Ranked by product profit, not revenue.", report.topProduct?.id)}
        ${highlight("Top buying customer", report.topBuyingCustomer?.name, report.topBuyingCustomer?.totals.sales, "sales", "Ranked by sales amount after discounts.")}
        ${highlight("Most profitable customer", report.topProfitCustomer?.name, report.topProfitCustomer?.totals.profit, "profit", "Ranked by product profit contribution.")}
      </div><p class="section-note">Anonymous sales are excluded from customer rankings. Rankings with incomplete profit costs are omitted; all reported figures remain unchanged.</p>
    </section>

    <section class="section" aria-labelledby="products">
      ${heading("04", "products", "Product Profitability", "Product-level sales, landed cost and profit · Loss-making products are explicitly identified")}
      <div class="table-scroll" tabindex="0" role="region" aria-label="Product profitability table"><table class="product-table"><colgroup><col style="width:32%"><col style="width:10%"><col style="width:19%"><col style="width:19%"><col style="width:20%"></colgroup><thead><tr><th scope="col">Product</th><th scope="col" class="amount">Units sold</th><th scope="col" class="amount">Sales amount</th><th scope="col" class="amount">Product cost</th><th scope="col" class="amount">Product profit</th></tr></thead><tbody>${productRows || '<tr><td colspan="5" class="empty">No product sales in this selection.</td></tr>'}</tbody><tfoot><tr><th scope="row">Total</th><td class="amount">${number(totals.units)}</td><td class="amount">${money(totals.sales)}</td><td class="amount ${tone(totals.cost)}">${money(totals.cost)}</td><td class="amount ${tone(totals.profit)}">${money(totals.profit)}</td></tr></tfoot></table></div>
    </section>

    <section class="section" aria-labelledby="basis">
      ${heading("05", "basis", "Reporting Basis", "Interpretation and scope of the reported product profit")}
      <div class="basis"><p class="formula">Net product profit = Sales after discounts − Saved product cost</p><div class="basis-grid">
        <div><h3>Sales recognition</h3><p>Completed orders and paid, confirmed POS sales are grouped by recorded sale date. Product and order discounts are already reflected in sales.</p></div>
        <div><h3>Cost included</h3><p>The saved landed purchase cost includes allocated purchase expenses. Historical saved costs are used rather than today's purchase price.</p></div>
        <div><h3>Excluded expenses</h3><p>Delivery charges, delivery costs and general business expenses are excluded. Net product profit is not net business profit.</p></div>
        <div><h3>Returns and incomplete data</h3><p>Returned orders are excluded in full, including partial returns. Missing or zero saved costs leave affected profit totals unavailable.</p></div>
      </div><p class="basis-rule">${escapeHtml(profitBasis)}</p></div>
    </section>
    <footer class="footer"><strong>${escapeHtml(business)} · Management reporting</strong><span>${escapeHtml(report.from)} — ${escapeHtml(report.to)} · All monetary amounts in BDT (৳)</span></footer>
  </main>
</body>
</html>`;
}
