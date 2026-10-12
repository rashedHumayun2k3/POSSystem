import * as Speech from "expo-speech";
import { Platform } from "react-native";

let voices: Speech.Voice[] = [];
let generation = 0;
export const missingVoiceMessage = "বাংলা কণ্ঠ পাওয়া যায়নি। ডিভাইসের Text-to-Speech সেটিংসে বাংলা কণ্ঠ যোগ করুন অথবা বাংলা কণ্ঠ সমর্থিত ব্রাউজার ব্যবহার করুন।";

export async function prepareBanglaSpeech() {
  voices = await Speech.getAvailableVoicesAsync();
}

export async function stopSpeaking() {
  generation++;
  await Speech.stop();
}

// Voice metadata has no standard gender field. Prefer a named female voice only
// when the platform identifies it; never assume that every Bengali voice is female.
export function chooseBanglaVoice(available: Speech.Voice[]) {
  return available.filter(v => /^bn(?:[-_]|$)/i.test(v.language)).sort((a, b) => {
    const score = (v: Speech.Voice) => (v.language.toLowerCase().replace("_", "-") === "bn-bd" ? 4 : 0)
      + (/female|woman|bangshi|tanishaa/i.test(v.name) ? 2 : 0)
      + (v.quality === "Enhanced" ? 1 : 0);
    return score(b) - score(a);
  })[0];
}

export async function speakBangla(text: string, callbacks: {
  onStart?: () => void; onDone?: () => void; onError?: (message: string) => void;
} = {}) {
  const request = ++generation;
  // Web voices are warmed up before the tap, keeping speak within user activation.
  if (Platform.OS !== "web") {
    await Speech.stop();
    await prepareBanglaSpeech();
  }
  if (request !== generation) return;
  const voice = chooseBanglaVoice(voices);
  if (!voice) throw new Error(missingVoiceMessage);
  const current = (fn?: () => void) => { if (request === generation) fn?.(); };
  Speech.speak(text, {
    language: "bn-BD", voice: voice.identifier, rate: 0.9, pitch: 1,
    onStart: () => current(callbacks.onStart),
    onDone: () => current(callbacks.onDone),
    onStopped: () => current(callbacks.onDone),
    onError: () => current(() => callbacks.onError?.("কণ্ঠ চালু করা যায়নি। শব্দের সেটিংস পরীক্ষা করে আবার চেষ্টা করুন।")),
  });
}
