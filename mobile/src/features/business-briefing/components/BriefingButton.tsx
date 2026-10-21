import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../../auth/AuthContext";
import { colors } from "../../../theme";
import { useBriefing } from "../hooks/useBriefing";
import { canPause } from "../services/playback";
import type { BriefingMode, PlaybackPhase } from "../types";

const status: Record<PlaybackPhase, string> = {
  idle: "আপনার ব্যবসার খবর শুনুন", greeting: "আপনার জন্য খবরগুলো গুছিয়ে নিচ্ছি…", loading: "হিসাবগুলো দেখে নিচ্ছি…",
  ready: "আপনার রিপোর্ট তৈরি", speaking: "আপনার ব্যবসার খবর জানাচ্ছি", paused: "একটু বিরতি নিয়েছি", completed: "রিপোর্ট শোনা শেষ হয়েছে",
  cancelled: "কণ্ঠ থামিয়েছি", error: "আবার চেষ্টা করা যাক",
};
const modes: [BriefingMode, string][] = [["quick", "সংক্ষিপ্ত"], ["standard", "স্বাভাবিক"], ["detailed", "বিস্তারিত"]];
export default function BriefingButton() {
  const { session } = useAuth();
  if (!["OWNER", "MANAGER"].includes(session?.user.role ?? "")) return null;
  return <BriefingPanel />;
}
function BriefingPanel() {
  const b = useBriefing();
  const busy = ["greeting", "loading", "speaking", "paused"].includes(b.phase);
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel="ব্যবসার খবর শুনুন" onPress={() => void b.start()} style={s.trigger}>
      <Ionicons name="sparkles" size={23} color={colors.white}/>
    </Pressable>
    <Modal visible={b.open} transparent animationType="fade" onRequestClose={b.close}>
      <View style={s.overlay}><View accessibilityViewIsModal style={s.panel}>
        <View style={s.row}><View style={s.flex}><Text style={s.title}>আপনার ব্যবসার খবর</Text><Text style={s.muted}>সহজ বাংলায়, আপনার হিসাব থেকে</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="বন্ধ করুন" onPress={b.close} style={s.icon}><Ionicons name="close" size={25} color={colors.heading}/></Pressable></View>
        <View style={s.status}><Ionicons name={b.phase === "speaking" ? "volume-high-outline" : "chatbubble-ellipses-outline"} size={29} color={colors.primaryDark}/>
          <Text accessibilityLiveRegion="polite" style={s.statusText}>{status[b.phase]}</Text>
          {["greeting", "loading"].includes(b.phase) && <ActivityIndicator color={colors.primary}/>}</View>
        <View style={s.row}>{modes.map(([mode, label]) => <Pressable key={mode} accessibilityRole="button" accessibilityState={{ selected: b.mode === mode, disabled: busy }} disabled={busy} onPress={() => b.setMode(mode)} style={[s.chip, b.mode === mode && s.selected]}><Text style={s.label}>{label}</Text></Pressable>)}</View>
        <ScrollView contentContainerStyle={s.content}>
          {!!b.error && <Text accessibilityRole="alert" style={s.error}>{b.error}</Text>}
          {!!b.audioNotice && <Text accessibilityRole="alert" style={s.notice}>{b.audioNotice}</Text>}
          {b.report && <>
            <Text style={s.scope}>{b.report.scope}</Text><Text style={s.muted}>{b.report.period.label}</Text>
            <Text style={s.muted}>তথ্য নেওয়া হয়েছে: {new Date(b.report.asOf).toLocaleString("bn-BD", { timeZone: b.report.timeZone })}</Text>
            {b.segment >= 0 && <Text style={s.muted}>অংশ {b.segment + 1} / {b.report.segments.length}</Text>}
            {b.report.segments.map((segment, index) => <View key={segment.id} style={[s.segment, b.segment === index && s.current]}><Text selectable style={s.transcript}>{segment.text}</Text></View>)}
            {b.report.notices.map(notice => <Text key={notice} style={s.muted}>• {notice}</Text>)}
          </>}
          <Text style={s.scope}>কণ্ঠ ও বলার গতি</Text>
          <Text style={s.muted}>কণ্ঠ শুনে আপনার পছন্দেরটি বেছে নিন। নারী কণ্ঠের প্রাপ্যতা ও স্বাভাবিকতা ফোনের ওপর নির্ভর করে।</Text>
          {b.voices.map(voice => <Pressable accessibilityRole="button" accessibilityState={{ selected: b.voice?.identifier === voice.identifier, disabled: busy }} disabled={busy} key={voice.identifier} onPress={() => b.setVoiceId(voice.identifier)} style={[s.chip, b.voice?.identifier === voice.identifier && s.selected]}><Text style={s.label}>{voice.name} · {voice.language}</Text></Pressable>)}
          <View style={s.row}>{[[0.8, "ধীরে"], [0.9, "স্বাভাবিক"], [1, "দ্রুত"]].map(([rate, label]) => <Pressable key={rate} accessibilityRole="button" accessibilityState={{ selected: b.rate === rate, disabled: busy }} disabled={busy} onPress={() => b.setRate(Number(rate))} style={[s.chip, b.rate === rate && s.selected]}><Text style={s.label}>{label}</Text></Pressable>)}</View>
          <View style={s.row}><Pressable accessibilityRole="button" disabled={busy} onPress={() => void b.replay(true)} style={s.chip}><Text style={s.label}>কণ্ঠ শুনে দেখুন</Text></Pressable><Pressable accessibilityRole="button" disabled={busy} onPress={() => void b.refreshVoices()} style={s.chip}><Text style={s.label}>কণ্ঠ আবার খুঁজুন</Text></Pressable></View>
        </ScrollView>
        <View style={s.row}>
          {busy ? <>
            <Pressable accessibilityRole="button" onPress={b.stop} style={s.button}><Text style={s.buttonText}>থামান</Text></Pressable>
            {canPause && ["speaking", "paused"].includes(b.phase) && <Pressable accessibilityRole="button" onPress={() => void b.togglePause()} style={s.chip}><Text style={s.label}>{b.phase === "paused" ? "চালিয়ে যান" : "বিরতি"}</Text></Pressable>}
          </> : <>
            <Pressable accessibilityRole="button" onPress={() => void b.start()} style={s.button}><Text style={s.buttonText}>{b.report ? "নতুন রিপোর্ট" : "আবার চেষ্টা করুন"}</Text></Pressable>
            {b.report && <Pressable accessibilityRole="button" onPress={() => void b.replay()} style={s.chip}><Text style={s.label}>আবার শুনুন</Text></Pressable>}
          </>}
        </View>
      </View></View>
    </Modal>
  </>;
}
const s = StyleSheet.create({
  trigger: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.primaryDark },
  overlay: { flex: 1, padding: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.overlay },
  panel: { width: "100%", maxWidth: 560, maxHeight: "92%", padding: 18, gap: 14, borderRadius: 24, backgroundColor: colors.white },
  row: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }, flex: { flex: 1 },
  title: { fontSize: 20, fontWeight: "700", color: colors.heading }, muted: { fontSize: 12, lineHeight: 20, color: colors.secondary },
  icon: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  status: { padding: 14, gap: 10, borderRadius: 16, backgroundColor: "#FFF7ED", flexDirection: "row", alignItems: "center" },
  statusText: { flex: 1, fontSize: 15, lineHeight: 23, color: colors.primaryDark },
  content: { gap: 12, paddingBottom: 12 }, chip: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.divider, justifyContent: "center" },
  selected: { backgroundColor: colors.primaryLight, borderColor: colors.primary }, label: { color: colors.primaryDark, fontSize: 13 },
  error: { color: colors.dangerText, fontSize: 14, lineHeight: 23 }, notice: { color: colors.secondary, backgroundColor: colors.cardSecondary, padding: 12, borderRadius: 12, lineHeight: 23 },
  scope: { fontSize: 15, fontWeight: "700", color: colors.heading }, segment: { padding: 12, borderRadius: 12, backgroundColor: colors.cardSecondary },
  current: { backgroundColor: colors.primaryLight }, transcript: { fontSize: 16, lineHeight: 28, color: colors.heading },
  button: { minHeight: 46, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.primary }, buttonText: { color: colors.white, fontWeight: "700", fontSize: 14 },
});
