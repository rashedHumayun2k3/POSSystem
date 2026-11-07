export type SharedDatePickerProps = {
  value: string;
  onChange: (date: string) => void;
  label?: string;
  minimumDate?: string;
  maximumDate?: string;
  earliestYear?: number;
  clearable?: boolean;
  disabled?: boolean;
};
export function dateParts(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}
export function localDateValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}
export function isDateValue(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0,10) === value;
}
export function clampDate(year: number, month: number, day: number, minimum: string, maximum: string): string {
  const min=dateParts(minimum),max=dateParts(maximum);
  year=Math.max(min.year,Math.min(year,max.year));
  month=Math.max(1,Math.min(month,12));
  day=Math.max(1,Math.min(day,new Date(Date.UTC(year,month,0)).getUTCDate()));
  const value=`${String(year).padStart(4,"0")}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
  return value<minimum?minimum:value>maximum?maximum:value;
}
