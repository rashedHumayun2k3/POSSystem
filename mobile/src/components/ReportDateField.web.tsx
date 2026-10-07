import { useRef } from "react";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";
import { reportToday, shiftReportDate } from "./reportDate";

export default function ReportDateField({ value, onChange }: { value: string; onChange: (date: string) => void }) {
  const today = reportToday();
  const input = useRef<HTMLInputElement>(null);
  const openCalendar = () => {
    const field = input.current;
    if (!field) return;
    try { field.showPicker(); } catch { field.click(); }
  };
  return <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 4, minHeight: 52, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 4, background: colors.white }}>
    <style>{`
      .report-date-arrow { display:flex; align-items:center; justify-content:center; flex-shrink:0; width:44px; height:44px; border:0; border-radius:9px; background:${colors.primaryLight}; color:${colors.primaryDark}; cursor:pointer; transition:background 120ms ease, transform 120ms ease; }
      .report-date-arrow:not(:disabled):hover { background:${colors.border}; }
      .report-date-arrow:not(:disabled):active { transform:scale(.95); }
      .report-date-arrow:focus-visible { outline:2px solid ${colors.primary}; outline-offset:2px; }
      .report-date-arrow:disabled { opacity:.4; cursor:default; transform:none; }
      @media (prefers-reduced-motion:reduce) { .report-date-arrow { transition:none; } }
    `}</style>
    <button type="button" className="report-date-arrow" aria-label="Previous date" title="Previous day" disabled={value === "0001-01-01"} onClick={() => onChange(shiftReportDate(value, -1))}>
      <Ionicons name="chevron-back" size={20} color={colors.primaryDark} />
    </button>
    <button type="button" aria-label="Open report calendar" onClick={openCalendar} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, border: 0, background: "transparent", cursor: "pointer" }}>
      <Ionicons name="calendar-outline" size={20} color={colors.primaryDark} />
    </button>
    <input type="text" aria-label="Report date" readOnly value={value} onClick={openCalendar} onKeyDown={event => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openCalendar(); }
    }} style={{ flex: 1, minWidth: 0, border: 0, outline: "none", boxShadow: "none", background: "transparent", color: colors.heading, font: "inherit", fontSize: 14, fontWeight: 600, minHeight: 44, cursor: "pointer", textAlign: "center" }} />
    <button type="button" className="report-date-arrow" aria-label="Next date" title="Next day" disabled={value >= today} onClick={() => { if (value < reportToday()) onChange(shiftReportDate(value, 1)); }}>
      <Ionicons name="chevron-forward" size={20} color={colors.primaryDark} />
    </button>
    {/* Keep the native picker editable internally; readOnly date inputs cannot open showPicker(). */}
    <input ref={input} type="date" aria-hidden="true" tabIndex={-1} required max={today} value={value} onChange={event => {
      if (event.target.value && event.target.value <= reportToday() && event.target.validity.valid) onChange(event.target.value);
    }} style={{ position: "absolute", left: 44, bottom: 0, width: 1, height: 1, opacity: 0, pointerEvents: "none", border: 0, outline: "none" }} />
  </div>;
}
