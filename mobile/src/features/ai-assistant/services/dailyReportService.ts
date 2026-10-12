import { dailyReportMessage } from "../data/aiMessages";

// Replace this provider with authenticated POS data later; the UI and TTS stay independent.
export function generateDailyReport() {
  return { text: dailyReportMessage, isDemo: true as const };
}
