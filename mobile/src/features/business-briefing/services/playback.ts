import * as Speech from "expo-speech";
import { Platform } from "react-native";
import { banglaVoices } from "./voiceChoice";
export { banglaVoices };
export const discoverVoices = async () => banglaVoices(await Speech.getAvailableVoicesAsync());
export const canPause = Platform.OS !== "android";
export const missingVoice = "বাংলা কণ্ঠ পাওয়া যায়নি। ফোনের টেক্সট-টু-স্পিচ সেটিংসে বাংলা কণ্ঠ যোগ করে আবার দেখুন। আপাতত নিচের রিপোর্টটি পড়তে পারেন।";

export class BriefingPlayer {
  private generation = 0;
  private stopping: Promise<void> = Promise.resolve();
  private settle: (() => void) | null = null;
  async stop() {
    this.generation++;
    this.settle?.(); this.settle = null;
    this.stopping = Speech.stop().catch(() => {});
    await this.stopping;
  }
  pause() { return Speech.pause(); }
  resume() { return Speech.resume(); }
  async play(texts: string[], voice: Speech.Voice, rate: number, onSegment: (index: number) => void) {
    const generation = this.generation;
    await this.stopping;
    for (let index = 0; index < texts.length; index++) {
      if (generation !== this.generation) return;
      onSegment(index);
      await new Promise<void>((resolve, reject) => {
        let started = false;
        let settled = false;
        const timer = setTimeout(() => finish(new Error("কণ্ঠ শুরু হয়নি। আবার শুনুন বোতামে চাপুন অথবা ফোনের শব্দের সেটিংস দেখুন।")), 12000);
        const finish = (error?: Error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer); this.settle = null;
          if (error) reject(error); else resolve();
        };
        this.settle = () => finish();
        Speech.speak(texts[index], {
          language: voice.language, voice: voice.identifier, rate, pitch: 1,
          onStart: () => { started = true; clearTimeout(timer); },
          onDone: () => finish(), onStopped: () => finish(generation === this.generation ? new Error("কণ্ঠ থেমে গেছে। আবার শুনুন বোতামে চাপুন।") : undefined),
          onError: () => finish(new Error(started ? "কণ্ঠ থেমে গেছে। আবার শুনতে পারেন।" : "কণ্ঠ চালু হয়নি। ফোনের শব্দ ও বাংলা কণ্ঠের সেটিংস দেখুন।")),
        });
      });
    }
  }
}
