import type { InvoicePreview } from "@/lib/ordersApi";

function Field({ label, value }: { label: string; value: string }) {
  return <div className="flex min-w-0 items-baseline gap-1.5">
    <dt className="shrink-0 text-gray-500">{label}:</dt>
    <dd className="min-w-0 whitespace-pre-line font-medium text-gray-900 [overflow-wrap:anywhere]">{value}</dd>
  </div>;
}

export default function MobileInvoiceReport({ data, printView = false }: { data: InvoicePreview; printView?: boolean }) {
  const invoice = data.invoice;
  const money = (amount: string) => `${invoice.currency} ${amount}`;
  const summary = [
    ["Total Unit Price", invoice.subtotal],
    ["Discount", `-${invoice.discount}`],
    ["Total Shipping", invoice.shipping],
    ["Total", invoice.total],
    ["Paid", invoice.paid],
  ];

  return <article aria-label="Invoice" className={`invoice-mobile-report min-w-0 space-y-4 p-3 text-sm md:hidden ${printView ? "print:block" : "print:hidden"} [overflow-wrap:anywhere]`}>
    <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
      <div className="border-b border-gray-100 pb-3">
        <h2 className="text-lg font-bold text-[#4B3F72]">INVOICE</h2>
        <dl className="mt-3 space-y-3">
          <Field label="Doc No" value={invoice.documentNumber} />
          <Field label="Invoice Date" value={invoice.invoiceDate} />
        </dl>
      </div>
      <div className="space-y-2">
        {invoice.logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={invoice.logo} alt="" className="h-12 max-w-full object-contain object-left" />
        )}
        <h3 className="text-base font-bold text-[#4B3F72]">{invoice.sellerName}</h3>
        {invoice.sellerAddress && <p className="whitespace-pre-line">{invoice.sellerAddress}</p>}
        {invoice.sellerPhone && <p>Contact: {invoice.sellerPhone}</p>}
        {invoice.sellerEmail && <p>Email: {invoice.sellerEmail}</p>}
        {invoice.sellerWebsite && <p>Website: {invoice.sellerWebsite}</p>}
      </div>
      <div className="space-y-2 border-t border-gray-100 pt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Bill To</h3>
        <p className="font-semibold">{data.customerName}</p>
        {invoice.customerAddress && <p className="whitespace-pre-line">{invoice.customerAddress}</p>}
        {invoice.customerPhone && <p>Contact: {invoice.customerPhone}</p>}
      </div>
      <dl className="space-y-3 border-t border-gray-100 pt-4">
        <Field label="Order Number" value={data.orderNo} />
        <Field label="Mode Of Payment" value={invoice.paymentMethods} />
        <Field label="Order Date" value={invoice.orderDate} />
      </dl>
    </section>

    <section aria-labelledby="mobile-invoice-items" className="space-y-3">
      <h2 id="mobile-invoice-items" className="font-semibold text-gray-900">Your Ordered Item(s) · {invoice.items.length}</h2>
      {invoice.items.map((item, index) => <article key={index} className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-start gap-3">
          <span aria-label={`S/N ${index + 1}`} className="shrink-0 rounded-lg bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700">#{index + 1}</span>
          <div className="min-w-0">
            <h3 className="whitespace-pre-line font-semibold text-gray-900">{item.description}</h3>
            {item.variant && <p className="mt-1 whitespace-pre-line text-xs text-gray-500">{item.variant}</p>}
          </div>
        </div>
        <dl className="mt-4 space-y-3">
          <Field label="Item ID" value={item.itemId} />
          <Field label="Item SKU" value={item.sku} />
        </dl>
        <dl className="mt-4 space-y-3 border-t border-gray-100 pt-4">
          <Field label="Qty" value={item.qty} />
          <Field label="MRP" value="—" />
          <Field label="Unit Price" value={money(item.unitPrice)} />
          <Field label="Tax Amount" value="—" />
          <Field label="Discount" value={money(item.discount)} />
        </dl>
        <dl className="mt-4 border-t border-gray-200 pt-3">
          <div className="flex items-baseline justify-between gap-3 font-semibold text-[#4B3F72]">
            <dt>Total Price</dt><dd className="min-w-0 text-right tabular-nums">{money(item.totalPrice)}</dd>
          </div>
        </dl>
      </article>)}
      <p className="text-xs text-gray-500">Amounts in {invoice.currency}. — = not recorded. Discount is allocated across items.</p>
    </section>

    <section aria-labelledby="mobile-invoice-totals" className="rounded-xl border border-gray-200 bg-white p-4">
      <h2 id="mobile-invoice-totals" className="mb-4 font-semibold">Invoice totals</h2>
      <dl className="space-y-3">
        {summary.map(([label, amount]) => <div key={label} className="flex justify-between gap-3">
          <dt className="min-w-0 text-gray-600">{label}</dt><dd className="min-w-0 text-right font-medium tabular-nums">{money(amount)}</dd>
        </div>)}
        <div className="flex justify-between gap-3 border-t border-gray-200 pt-4 text-base font-bold text-[#4B3F72]">
          <dt className="min-w-0">Total Payable Amount</dt><dd className="min-w-0 text-right tabular-nums">{money(invoice.due)}</dd>
        </div>
        {invoice.credit && <div className="flex justify-between gap-3">
          <dt>Credit / Overpayment</dt><dd className="min-w-0 text-right tabular-nums">{money(invoice.credit)}</dd>
        </div>}
      </dl>
    </section>
    <footer className="space-y-2 py-4 text-center">
      <h2 className="font-semibold">Need Help?</h2>
      <p className="text-xs text-gray-600">Happy to assist you. Please contact the seller for help with your order.</p>
      {invoice.contactLink && <a href={invoice.contactLink} className="inline-block max-w-full rounded-lg bg-[#FF6B21] px-4 py-3 font-semibold text-white">
        Contact Us{invoice.sellerPhone ? `: ${invoice.sellerPhone}` : ""}
      </a>}
      <p className="text-xs text-gray-500">Customer copy</p>
    </footer>
  </article>;
}
