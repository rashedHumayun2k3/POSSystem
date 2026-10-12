import type { ExpoSpeechRecognitionModule, ExpoSpeechRecognitionOptions } from "expo-speech-recognition";

type Recognizer = Pick<typeof ExpoSpeechRecognitionModule, "addListener" | "start" | "stop" | "abort">;
export type VoicePhase = "starting" | "listening" | "ready" | "processing" | "error";

export function voiceErrorMessage(code: string) {
  const messages: Record<string, string> = {
    "not-allowed": "মাইক্রোফোন ও speech recognition অনুমতি দিন। ফোনের Settings থেকে অনুমতি পরীক্ষা করুন।",
    "service-not-allowed": "ফোনের speech recognition service চালু করুন। Google / Speech Recognition & Synthesis অ্যাপ পরীক্ষা করুন।",
    "language-not-supported": "ফোনের speech service বাংলা সমর্থন করছে না। Google speech service ও বাংলা ভাষা চালু করে আবার চেষ্টা করুন।",
    "network": "ভয়েস চিনতে ইন্টারনেট সংযোগ দরকার। সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।",
    "audio-capture": "মাইক্রোফোন চালু করা যায়নি। অন্য অ্যাপের রেকর্ডিং বন্ধ করে আবার চেষ্টা করুন।",
    "no-speech": "কোনো কথা শোনা যায়নি। মাইকের কাছে স্পষ্ট করে আবার বলুন।",
    "busy": "মাইক্রোফোন ব্যস্ত আছে। একটু পরে আবার চেষ্টা করুন।",
  };
  return messages[code] ?? `ভয়েস নেওয়া যায়নি (${code})। আবার চেষ্টা করুন অথবা প্রশ্ন লিখুন।`;
}

// Keep the final-result listeners alive after stop(). Only cancellation uses abort().
export function createVoiceSession(recognizer: Recognizer, options: ExpoSpeechRecognitionOptions, callbacks: {
  onPhase: (phase: VoicePhase) => void;
  onText: (text: string) => void;
  onError: (message: string) => void;
}, timeoutMs = 12000) {
  let disposed = false;
  let ended = false;
  let finishing = false;
  let partial = "";
  const finals: string[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  const subscriptions: { remove(): void }[] = [];
  const transcript = () => [...finals, partial].filter(Boolean).join(" ").trim();
  const cleanup = () => { clearTimeout(timer); subscriptions.splice(0).forEach(s => s.remove()); };
  const abort = () => { try { recognizer.abort(); } catch { /* Already stopped/unavailable. */ } };
  const fail = (message: string) => {
    if (disposed) return;
    disposed = true; cleanup(); abort(); callbacks.onError(message);
  };
  const publish = () => {
    if (disposed) return;
    const text = transcript();
    if (!text) { fail(voiceErrorMessage("no-speech")); return; }
    disposed = true; cleanup(); callbacks.onText(text);
  };
  const session = {
    finish() {
      if (disposed || finishing) return;
      finishing = true;
      callbacks.onPhase("processing");
      clearTimeout(timer);
      if (ended) { publish(); return; }
      timer = setTimeout(() => fail("ভয়েস প্রক্রিয়াকরণ শেষ হয়নি। আবার চেষ্টা করুন।"), timeoutMs);
      try { recognizer.stop(); } catch { fail("রেকর্ডিং শেষ করা যায়নি। আবার চেষ্টা করুন।"); }
    },
    cancel() { if (disposed) return; disposed = true; cleanup(); abort(); },
  };
  subscriptions.push(recognizer.addListener("audiostart", () => {
    if (disposed || finishing) return;
    clearTimeout(timer); callbacks.onPhase("listening");
  }));
  subscriptions.push(recognizer.addListener("result", event => {
    if (disposed) return;
    const text = event.results[0]?.transcript.trim();
    if (!text) return;
    if (event.isFinal) { finals.push(text); partial = ""; }
    else partial = text;
  }));
  subscriptions.push(recognizer.addListener("audioend", () => {
    if (disposed || finishing) return;
    clearTimeout(timer);
    callbacks.onPhase("processing");
    timer = setTimeout(() => fail("ভয়েস প্রক্রিয়াকরণ শেষ হয়নি। আবার চেষ্টা করুন।"), timeoutMs);
  }));
  subscriptions.push(recognizer.addListener("end", () => {
    if (disposed) return;
    ended = true; cleanup();
    if (finishing) publish();
    else if (transcript()) callbacks.onPhase("ready");
    else fail(voiceErrorMessage("no-speech"));
  }));
  subscriptions.push(recognizer.addListener("error", event => {
    if (disposed) return;
    // Some Android segmented recognizers emit a client error on explicit stop.
    // Preserve the text already received instead of discarding the entire utterance.
    if (finishing && event.error === "client" && transcript()) { publish(); abort(); return; }
    fail(voiceErrorMessage(event.error));
  }));
  callbacks.onPhase("starting");
  timer = setTimeout(() => fail("মাইক্রোফোন চালু হয়নি। Android-এর Google speech service ও মাইক্রোফোন সেটিংস পরীক্ষা করুন।"), timeoutMs);
  try { recognizer.start(options); } catch { fail("মাইক্রোফোন চালু করা যায়নি। speech service পরীক্ষা করে আবার চেষ্টা করুন।"); }
  return session;
}
