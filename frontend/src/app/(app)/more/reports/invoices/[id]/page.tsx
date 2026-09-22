"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownTrayIcon, PrinterIcon } from "@heroicons/react/24/outline";
import { downloadInvoice, getInvoicePreview } from "@/lib/ordersApi";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import MobileInvoiceReport from "@/components/orders/MobileInvoiceReport";

export default function InvoicePreviewPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const businessId = useAuthStore((s) => s.currentBusinessId);
  const branchId = useAuthStore((s) => s.currentBranchId);
  const [downloading, setDownloading] = useState(false);
  const [actualSize, setActualSize] = useState(false);
  const [format, setFormat] = useState<"web" | "mobile">("web");
  const [choice, setChoice] = useState<"print" | "download" | null>(null);
  const [pendingPrint, setPendingPrint] = useState(false);
  const chooser = useRef<HTMLDialogElement>(null);
  const [loadedPages, setLoadedPages] = useState<Set<string>>(new Set());
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["invoice-preview", businessId, branchId, id],
    queryFn: () => getInvoicePreview(id),
    enabled: Boolean(businessId && id),
    gcTime: 0,
  });
  const printReady = format === "mobile" ? Boolean(data?.invoice) : Boolean(data?.pages.length && data.pages.every((page) => loadedPages.has(page)));

  useEffect(() => {
    if (!pendingPrint || !printReady) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      await document.fonts.ready;
      if (format === "mobile") {
        await Promise.all(Array.from(document.querySelectorAll<HTMLImageElement>(".invoice-mobile-report img")).map(img => img.decode().catch(() => undefined)));
      }
      if (cancelled) return;
      window.print();
      setPendingPrint(false);
    }, 100);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [pendingPrint, printReady, format]);

  const openChoice = (action: "print" | "download") => {
    setChoice(action);
    chooser.current?.showModal();
  };

  const download = async (mobile: boolean) => {
    if (!data) return;
    setDownloading(true);
    try { await downloadInvoice(id, data.orderNo, mobile); }
    catch { useToastStore.getState().show(t("reports.invoices.pdfError"), "error"); }
    finally { setDownloading(false); }
  };

  const selectFormat = (selected: "web" | "mobile") => {
    chooser.current?.close();
    if (choice === "download") void download(selected === "mobile");
    else {
      setFormat(selected);
      setLoadedPages(new Set());
      setPendingPrint(true);
    }
    setChoice(null);
  };

  return (
    <div className="invoice-preview bg-gray-100 print:bg-white">
      <style>{`
        @media print {
          @page { size: ${format === "mobile" ? "A5" : "A4"} portrait; margin: ${format === "mobile" ? "8mm" : "0"}; }
          .invoice-mobile-report { display: ${format === "mobile" ? "block" : "none"} !important; padding: 0 !important; }
          .invoice-preview-pages { display: ${format === "mobile" ? "none" : "block"} !important; }
          .invoice-mobile-report section, .invoice-mobile-report article, .invoice-mobile-report footer { break-inside: avoid; }
          html, body { margin: 0 !important; padding: 0 !important; background: white; }
          .invoice-preview, .invoice-preview-pages { padding: 0 !important; overflow: visible !important; }
          .invoice-preview-sheet { width: ${format === "mobile" ? "148" : "210"}mm !important; height: ${format === "mobile" ? "210" : "297"}mm !important; margin: 0 !important; box-shadow: none !important; break-after: page; break-inside: avoid; }
          .invoice-preview-sheet:last-child { break-after: auto; }
          .invoice-preview-sheet img { width: 100% !important; height: 100% !important; object-fit: contain; }
        }
      `}</style>
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white p-3 print:hidden">
        <div className="mr-auto min-w-0">
          <h1 className="text-sm font-semibold text-gray-900">{data?.orderNo ?? t("reports.invoices.preview")}</h1>
          {data && <p className="text-xs text-gray-500">{data.customerName}</p>}
        </div>
        <button type="button" onClick={() => setActualSize((value) => !value)} disabled={!data}
          className="hidden rounded-lg border border-gray-200 px-3 py-2 text-xs disabled:opacity-50 md:inline-flex">
          {t(actualSize ? "reports.invoices.fitPage" : "reports.invoices.actualSize")}
        </button>
        <button type="button" onClick={() => openChoice("print")} disabled={!data || pendingPrint || downloading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:opacity-50">
          <PrinterIcon aria-hidden="true" className="h-4 w-4" />{t("reports.invoices.print")}
        </button>
        <button type="button" onClick={() => openChoice("download")} disabled={!data || downloading || pendingPrint}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white disabled:opacity-50">
          <ArrowDownTrayIcon aria-hidden="true" className="h-4 w-4" />{t(downloading ? "common.loading" : "reports.invoices.downloadPdf")}
        </button>
      </div>
      <dialog ref={chooser} onCancel={() => setChoice(null)} className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl bg-white p-5 shadow-xl backdrop:bg-black/40 print:hidden" aria-labelledby="invoice-format-title">
        <h2 id="invoice-format-title" className="font-semibold text-gray-900">{t(choice === "print" ? "reports.invoices.print" : "reports.invoices.downloadPdf")}</h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button type="button" onClick={() => selectFormat("web")} className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm font-semibold text-indigo-700">{t("reports.invoices.webView")}<span className="mt-1 block text-xs font-normal">A4</span></button>
          <button type="button" onClick={() => selectFormat("mobile")} className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm font-semibold text-indigo-700">{t("reports.invoices.mobileView")}<span className="mt-1 block text-xs font-normal">A5</span></button>
        </div>
        <form method="dialog" className="mt-4 text-right"><button onClick={() => setChoice(null)} className="text-sm text-gray-500">{t("common.cancel")}</button></form>
      </dialog>
      {pendingPrint && !isError && <p role="status" className="p-3 text-center text-sm print:hidden">{t("common.loading")}</p>}
      {isPending ? <p role="status" className="p-8 text-center text-sm">{t("common.loading")}</p> : isError ? (
        <div role="alert" className="space-y-3 p-8 text-center text-sm text-red-600">
          <p>{t("reports.invoices.previewError")}</p>
          <button type="button" onClick={() => void refetch()} className="underline">{t("reports.invoices.retry")}</button>
          {pendingPrint && <button type="button" onClick={() => setPendingPrint(false)} className="ml-3 underline">{t("common.cancel")}</button>}
        </div>
      ) : (
        <>
        {data?.invoice && <MobileInvoiceReport data={data} printView={format === "mobile"} />}
        <div className={`invoice-preview-pages overflow-x-auto p-3 ${data?.invoice ? "hidden md:block print:block" : ""}`}>
          {data?.pages.map((src, index) => (
            <figure key={`${index}-${pendingPrint}`} className={`invoice-preview-sheet mx-auto mb-4 bg-white shadow ${actualSize ? "w-[794px]" : "w-full"}`}>
              {/* The server renders the same document layout to PNG without creating a PDF. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} width={1190} height={1684} className="block h-auto w-full" loading="eager"
                onLoad={() => setLoadedPages((previous) => new Set(previous).add(src))}
                onError={() => { setPendingPrint(false); useToastStore.getState().show(t("reports.invoices.previewError"), "error"); }}
                alt={t("reports.invoices.previewPage", { orderNo: data.orderNo, page: index + 1, pages: data.pages.length })} />
            </figure>
          ))}
        </div>
        </>
      )}
    </div>
  );
}
