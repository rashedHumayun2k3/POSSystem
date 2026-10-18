import { useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import { usePathname } from "expo-router";
import type { Voice } from "expo-speech";
import { useAuth } from "../../../auth/AuthContext";
import { BriefingPlayer, discoverVoices, missingVoice } from "../services/playback";
import type { BriefingMode, BriefingPreferences, BriefingReport, PlaybackPhase } from "../types";

export function useBriefing() {
  const { api, session } = useAuth();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<PlaybackPhase>("idle");
  const [report, setReport] = useState<BriefingReport | null>(null);
  const [mode, setMode] = useState<BriefingMode>("standard");
  const [rate, setRate] = useState(0.9);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [voiceId, setVoiceId] = useState("");
  const [error, setError] = useState("");
  const [audioNotice, setAudioNotice] = useState("");
  const [segment, setSegment] = useState(-1);
  const player = useRef(new BriefingPlayer()).current;
  const generation = useRef(0);
  const abort = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const active = useRef(false);
  const preferences = useRef<{ preferences: BriefingPreferences; greeting: string } | null>(null);
  const voice = voices.find(v => v.identifier === voiceId) ?? voices[0];
  const refreshVoices = async () => {
    try { const next = await discoverVoices(); setVoices(next); if (!next.length) setAudioNotice(missingVoice); else setAudioNotice(""); }
    catch { setAudioNotice(missingVoice); }
  };
  const cancel = () => {
    generation.current++; abort.current?.abort(); abort.current = null; busy.current = false;
    void player.stop().catch(() => {});
  };
  const stop = () => { cancel(); setPhase("cancelled"); };
  const close = () => { active.current = false; cancel(); setOpen(false); setPhase("idle"); };
  useEffect(() => {
    close(); setReport(null); preferences.current = null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    let disposed = false;
    void api<{ preferences: BriefingPreferences; greeting: string }>("/business-briefing/preferences", { signal: controller.signal })
      .then(value => { if (!disposed) { preferences.current = value; setMode(value.preferences.defaultMode); setRate(value.preferences.speakingRate); } })
      .catch(() => {}).finally(() => clearTimeout(timer));
    void refreshVoices();
    return () => { disposed = true; controller.abort(); clearTimeout(timer); cancel(); };
  }, [session?.businessId, session?.branchId, session?.user.id]);
  useEffect(() => { close(); }, [path]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", state => {
      if (state !== "active" && active.current) { stop(); setAudioNotice("আপনি অ্যাপ থেকে বাইরে যাওয়ায় কণ্ঠ থামিয়েছি। আবার শুনতে পারেন।"); }
    });
    const warm = () => { void refreshVoices(); };
    const hidden = () => { if (document.hidden && active.current) stop(); };
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.speechSynthesis?.addEventListener("voiceschanged", warm);
      document.addEventListener("visibilitychange", hidden);
    }
    return () => {
      subscription.remove(); cancel();
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.speechSynthesis?.removeEventListener("voiceschanged", warm);
        document.removeEventListener("visibilitychange", hidden);
      }
    };
  }, []);
  const start = async () => {
    if (busy.current) return;
    cancel(); busy.current = true; active.current = true;
    const id = generation.current;
    const current = () => id === generation.current;
    const controller = new AbortController(); abort.current = controller;
    const timer = setTimeout(() => controller.abort(), 20000);
    setOpen(true); setReport(null); setError(""); setAudioNotice(""); setSegment(-1); setPhase("loading");
    const selected = voice;
    let audioFailed = !selected;
    // Fetch and greeting start together. A neutral greeting avoids guessing the business timezone.
    const settings = preferences.current?.preferences;
    let greeting = "আপনাকে স্বাগতম। আপনার ব্যবসার খবরগুলো দেখে নিচ্ছি।";
    if (settings) {
      const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: settings.timeZone, hour: "2-digit", hourCycle: "h23" }).format(new Date()));
      const welcome = hour >= 5 && hour < 12 ? "শুভ সকাল" : hour >= 12 && hour < 16 ? "শুভ দুপুর" : hour >= 16 && hour < 18 ? "শুভ বিকেল" : hour >= 18 && hour < 22 ? "শুভ সন্ধ্যা" : "শুভ রাত্রি";
      greeting = (settings.religiousGreeting ? "আসসালামু আলাইকুম। " : "") + welcome + (settings.address ? ", " + settings.address : "") + "। আপনার ব্যবসার খবরগুলো দেখে নিচ্ছি।";
    }
    const greetingPlayback = selected ? player.play([greeting], selected, rate, () => { if (current()) setPhase("greeting"); })
      .catch(e => { audioFailed = true; if (current()) setAudioNotice(e.message); }).then(() => { if (current()) setPhase("loading"); }) : Promise.resolve();
    if (!selected) setAudioNotice(missingVoice);
    try {
      const result = await api<BriefingReport>(`/business-briefing?mode=${mode}`, { signal: controller.signal });
      clearTimeout(timer);
      if (!current()) return;
      setReport(result);
      await greetingPlayback;
      if (!current()) return;
      if (audioFailed || !selected) { setPhase("ready"); return; }
      setPhase("speaking");
      await player.play(result.segments.map(s => s.text), selected, rate, index => { if (current()) setSegment(index); });
      if (current()) setPhase("completed");
    } catch {
      if (current()) { await player.stop().catch(() => {}); setError("রিপোর্টটি আনতে বা পড়তে সমস্যা হয়েছে। ইন্টারনেট ও শব্দের সেটিংস দেখে আবার চেষ্টা করুন।"); setPhase("error"); }
    } finally { clearTimeout(timer); if (current()) busy.current = false; }
  };
  const replay = async (preview = false) => {
    cancel(); const id = generation.current;
    setAudioNotice(""); setError("");
    if (!voice) { setAudioNotice(missingVoice); setPhase("ready"); return; }
    if (!preview && !report) return;
    setPhase("speaking");
    try {
      await player.play(preview ? ["শুভ সকাল। আমি আপনার ব্যবসার খবরগুলো সহজ করে জানাব।"] : report!.segments.map(s => s.text), voice, rate,
        index => { if (id === generation.current) setSegment(preview ? -1 : index); });
      if (id === generation.current) setPhase("completed");
    } catch (e) { if (id === generation.current) { setAudioNotice((e as Error).message); setPhase("ready"); } }
  };
  const togglePause = async () => {
    try { if (phase === "paused") { await player.resume(); setPhase("speaking"); } else { await player.pause(); setPhase("paused"); } }
    catch { stop(); setAudioNotice("এই ডিভাইসে বিরতি দেওয়া যাচ্ছে না। আবার শুনুন বোতাম ব্যবহার করুন।"); }
  };
  return { open, phase, report, mode, setMode, rate, setRate, voices, voiceId, setVoiceId, voice, error, audioNotice, segment,
    start, stop, close, replay, togglePause, refreshVoices };
}
