export type PrintableExpense = {
  id: string;
  expenseDate: string;
  title?: string | null;
  subType: string;
  categoryName: string;
  amount: number;
  createdByName: string;
};

const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&#39;"})[char] || char);
const money = (value: number) => `৳${Number(value || 0).toLocaleString("en-BD", {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
const date = (value: string) => { const [year, month, day] = value.slice(0, 10).split("-").map(Number); return new Date(year, month - 1, day).toLocaleDateString("en-GB", {day:"numeric",month:"short",year:"numeric"}); };

export function writeExpensePrintPreview(preview: Window, company: string, from: string, to: string, rows: PrintableExpense[], total: number) {
  const generated = new Date().toLocaleString("en-GB", {dateStyle:"medium",timeStyle:"short"});
  const body = rows.length ? rows.map((item, index) => `<tr><td class="number">${index + 1}</td><td><strong>${escapeHtml(item.title?.trim() || item.subType || item.categoryName)}</strong><small>${escapeHtml(item.categoryName)}</small></td><td class="date">${escapeHtml(date(item.expenseDate))}</td><td class="money">${escapeHtml(money(item.amount))}</td><td>${escapeHtml(item.createdByName)}</td></tr>`).join("") : `<tr><td colspan="5" class="empty">No approved expenses in this period.</td></tr>`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Expense Report · ${escapeHtml(company)}</title><style>
    *{box-sizing:border-box}body{margin:0;background:#e9edf2;color:#17212f;font:12px/1.45 Arial,"Noto Sans Bengali",sans-serif}.toolbar{position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;align-items:center;gap:12px;background:#142a3b;color:#fff;padding:12px 22px}.toolbar button{border:0;border-radius:7px;padding:9px 16px;font-weight:700;cursor:pointer}.toolbar .print{background:#16826a;color:#fff}.paper{width:min(210mm,calc(100% - 32px));min-height:297mm;margin:24px auto;padding:17mm 16mm;background:#fff;box-shadow:0 8px 30px #17212f22}.company{font-size:20px;font-weight:800;line-height:1.2}.heading{display:flex;justify-content:space-between;gap:18px;border-bottom:2px solid #142a3b;padding:16px 0 14px}.heading h1{margin:0 0 5px;font-size:23px}.muted{color:#607184}.meta{text-align:right;font-size:10px;white-space:nowrap}table{width:100%;border-collapse:collapse;margin-top:20px;table-layout:fixed}thead th{text-align:left;background:#eef3f7;color:#24394b;font-size:10px;text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid #cfd9e3}th,td{padding:9px 7px;border-bottom:1px solid #e2e8ef;vertical-align:top;overflow-wrap:anywhere}td small{display:block;color:#607184;margin-top:3px}.number{width:30px;color:#607184}.date{width:85px;white-space:nowrap}.money{width:105px;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}.entry{width:105px}.empty{text-align:center;padding:28px;color:#607184}.total{display:flex;justify-content:space-between;gap:20px;margin-top:17px;padding:12px 7px;border-top:2px solid #142a3b;font-size:16px;font-weight:800}.footer{margin-top:30px;padding-top:10px;border-top:1px solid #d8e0e8;color:#607184;font-size:10px;display:flex;justify-content:space-between}@page{size:A4;margin:12mm}@media print{body{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}.toolbar{display:none}.paper{width:auto;min-height:0;margin:0;padding:0;box-shadow:none}thead{display:table-header-group}tr{break-inside:avoid} .total{break-inside:avoid}}
  </style></head><body><div class="toolbar"><strong>Expense report preview</strong><div><button type="button" onclick="window.close()">Close</button> <button class="print" type="button" onclick="window.print()">Print / Save PDF</button></div></div><main class="paper"><div class="company">${escapeHtml(company)}</div><header class="heading"><div><h1>Expense Report</h1><div class="muted">Report period: ${escapeHtml(date(from))} – ${escapeHtml(date(to))}</div></div><div class="meta"><strong>Generated</strong><br>${escapeHtml(generated)}<br><br>Approved expenses only</div></header><table><thead><tr><th class="number">#</th><th>Title of Expense</th><th class="date">Date</th><th class="money">Cost</th><th class="entry">Entry by</th></tr></thead><tbody>${body}</tbody></table><div class="total"><span>Total <span class="muted">(${rows.length} entries)</span></span><span>${escapeHtml(money(total))}</span></div><footer class="footer"><span>${escapeHtml(company)} · Expense Report</span><span>All amounts in BDT</span></footer></main></body></html>`;
  preview.document.open();
  preview.document.write(html);
  preview.document.close();
  preview.focus();
}
