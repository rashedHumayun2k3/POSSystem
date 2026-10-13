import AssistantAvatar from "./AssistantAvatar";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usePathname } from "expo-router";
import { colors } from "../../../theme";
import { useAuth } from "../../../auth/AuthContext";
import { chatQuestions, getPocAnswer } from "../services/chatPoc";
import { prepareBanglaSpeech, speakBangla, stopSpeaking } from "../services/speechService";

import { createVoiceSession, type VoicePhase } from "../services/voiceSession";

type Message = { id: number; role: "user" | "assistant"; text: string };
export default function AIButton() {
  const { session } = useAuth();
  const phone = (session?.user.phone ?? "").replace(/\D/g, "").replace(/^880/, "0");
  // Temporary account restriction while testing the business assistant.
  if (phone !== "01723111252" && phone !== "01700000000") return null;
  return <AIChatButton />;
}

function AIChatButton() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [samples, setSamples] = useState(true);
  const [voicePhase, setVoicePhase] = useState<VoicePhase | null>(null);
  const [speaking, setSpeaking] = useState<number | null>(null);
  const [error, setError] = useState("");
  const scroll = useRef<ScrollView>(null);
  const sequence = useRef(0);
  const voiceSession = useRef(0);
  const speechSession = useRef(0);
  const cancelRecognition = useRef<(() => void) | null>(null);
  const voiceBusy = useRef(false);
  const permissionRequest = useRef<number | null>(null);
  const finishRecognition = useRef<(() => void) | null>(null);
  const speechTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const path = usePathname();

  const stopAudio = () => {
    speechSession.current++;
    clearTimeout(speechTimer.current);
    setSpeaking(null);
    void stopSpeaking().catch(() => {});
  };
  const stopMic = () => {
    voiceSession.current++;
    cancelRecognition.current?.();
    cancelRecognition.current = null;
    voiceBusy.current = false;
    finishRecognition.current = null; setVoicePhase(null);
  };
  const close = () => { stopMic(); stopAudio(); setOpen(false); };
  useEffect(() => {
    const warm = () => { void prepareBanglaSpeech().catch(() => {}); };
    warm();
    const synth = Platform.OS === "web" && typeof window !== "undefined" ? window.speechSynthesis : undefined;
    synth?.addEventListener("voiceschanged", warm);
    const sub = AppState.addEventListener("change", state => {
      if (state !== "background") return;
      stopAudio();
      // A system permission activity can temporarily background Android. There
      // is no recorder yet: let that request finish instead of closing its UI.
      if (permissionRequest.current === voiceSession.current) return;
      if (voiceBusy.current) {
        stopMic();
        setError("অ্যাপ থেকে বাইরে যাওয়ায় মাইক্রোফোন থেমেছে। আবার চেষ্টা করুন।");
        setVoicePhase("error");
      }
    });
    return () => {
      voiceSession.current++; speechSession.current++;
      cancelRecognition.current?.(); clearTimeout(speechTimer.current);
      synth?.removeEventListener("voiceschanged", warm); sub.remove();
      void stopSpeaking().catch(() => {});
    };
  }, []);
  useEffect(() => { close(); }, [path]);

  const readAnswer = (message: Message) => {
    stopMic(); stopAudio(); setError("");
    const id = speechSession.current;
    setSpeaking(message.id);
    const finish = () => { if (id === speechSession.current) { clearTimeout(speechTimer.current); setSpeaking(null); } };
    const fail = (text: string) => { if (id === speechSession.current) { finish(); setError(text); } };
    speechTimer.current = setTimeout(() => { if (id === speechSession.current) { stopAudio(); setError("কণ্ঠ শুরু হয়নি। ডিভাইসের শব্দ ও বাংলা কণ্ঠের সেটিংস পরীক্ষা করুন।"); } }, 12000);
    void speakBangla(message.text, {
      onStart: () => { if (id === speechSession.current) clearTimeout(speechTimer.current); },
      onDone: finish, onError: fail,
    }).catch(e => fail(e instanceof Error ? e.message : "কণ্ঠ চালু করা যায়নি।"));
  };
  const send = (value = draft) => {
    const text = value.trim();
    if (!text) return;
    stopMic(); stopAudio(); setError(""); setDraft(""); setSamples(false);
    const user: Message = { id: ++sequence.current, role: "user", text };
    const reply: Message = { id: ++sequence.current, role: "assistant", text: getPocAnswer(text) };
    setMessages(current => [...current, user, reply]);
  };
  const startMic = async () => {
    if (voiceBusy.current) return;
    stopAudio(); setError(""); Keyboard.dismiss();
    const id = ++voiceSession.current;
    voiceBusy.current = true; setVoicePhase("starting");
    const prefix = draft.trim();
    const current = () => id === voiceSession.current;
    const fail = (message: string) => {
      if (!current()) return;
      voiceBusy.current = false;
      finishRecognition.current = null;
      setError(message); setVoicePhase("error");
    };
    try {
      // Wait until text-to-speech has released the audio session before recording.
      await stopSpeaking();
      if (!current()) return;
      const { ExpoSpeechRecognitionModule: recognition } = await import("expo-speech-recognition").catch(() => {
        throw new Error("এই অ্যাপ বিল্ডে voice input নেই। নতুন APK ইনস্টল করুন। এখন প্রশ্ন লিখে পাঠাতে পারেন।");
      });
      if (!current()) return;
      if (!recognition.isRecognitionAvailable()) throw new Error("ফোনে speech recognition service পাওয়া যায়নি। Google / Speech Recognition & Synthesis অ্যাপ চালু বা আপডেট করুন।");
      // Avoid reopening the system permission activity when already allowed.
      let permission = await recognition.getPermissionsAsync();
      if (!current()) return;
      if (!permission.granted) {
        permissionRequest.current = id;
        try {
          permission = await recognition.requestPermissionsAsync();
        } finally {
          if (permissionRequest.current === id) permissionRequest.current = null;
        }
      }
      if (!current()) return;
      if (!permission.granted) throw new Error("মাইক্রোফোন ও speech recognition অনুমতি দিন। ফোনের Settings থেকে অনুমতি পরীক্ষা করুন।");
      if (AppState.currentState === "background") throw new Error("অ্যাপে ফিরে এসে আবার মাইক্রোফোনে চাপুন।");
      const session = createVoiceSession(recognition, {
        lang: "bn-BD", interimResults: true, maxAlternatives: 1,
        continuous: Platform.OS !== "android" || Number(Platform.Version) >= 33,
      }, {
        onPhase: phase => { if (current()) setVoicePhase(phase); },
        onText: text => {
          if (!current()) return;
          cancelRecognition.current = null; finishRecognition.current = null;
          voiceBusy.current = false;
          setDraft([prefix, text].filter(Boolean).join(" "));
          setVoicePhase(null);
        },
        onError: fail,
      });
      if (!current()) { session.cancel(); return; }
      cancelRecognition.current = session.cancel;
      finishRecognition.current = session.finish;
    } catch (e) {
      fail(e instanceof Error ? e.message : "ভয়েস চালু করা যায়নি। প্রশ্ন লিখে পাঠাতে পারেন।");
    }
  };
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel="ব্যবসার সহকারীর সাথে চ্যাট করুন" onPress={() => setOpen(true)} style={s.trigger}>
      <AssistantAvatar/><View style={s.spark}><Ionicons name="sparkles" size={11} color={colors.white}/></View>
    </Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={s.overlay}>
        <View accessibilityViewIsModal style={s.card}>
          <View style={s.header}><AssistantAvatar size={40}/><View style={s.flex}><Text style={s.title}>আপনার ব্যবসার সহকারী</Text><Text style={s.hint}>চ্যাট ডেমো · ১০টি নির্দিষ্ট উত্তর</Text></View><Pressable accessibilityRole="button" accessibilityLabel="বন্ধ করুন" onPress={close} style={s.icon}><Ionicons name="close" size={24} color={colors.heading}/></Pressable></View>
          <Text style={s.notice}>সব উত্তর নমুনা তথ্য। আপনার দোকানের আসল হিসাব নয়।</Text>
          {voicePhase ? <View style={s.voicePanel}>
            <View style={s.microphoneCircle}><Ionicons name="mic" size={56} color={voicePhase === "error" ? colors.dangerText : colors.primary}/></View>
            <Text accessibilityLiveRegion="polite" style={s.voiceTitle}>{voicePhase === "starting" ? "মাইক্রোফোন চালু হচ্ছে…" : voicePhase === "listening" ? "শুনছি… এখন বাংলায় বলুন" : voicePhase === "processing" ? "ভয়েস প্রক্রিয়াকরণ হচ্ছে…" : voicePhase === "ready" ? "কথা নেওয়া হয়েছে" : "মাইক্রোফোন চালু হয়নি"}</Text>
            {(voicePhase === "starting" || voicePhase === "processing") && <ActivityIndicator size="large" color={colors.primary}/>}
            <Text style={s.voiceHint}>{voicePhase === "ready" ? "লেখা দেখতে নিচের × বোতামে চাপুন।" : voicePhase === "listening" ? "কথা বলা শেষ হলে নিচের × বোতামে চাপুন। তারপর লেখা দেখে পাঠাতে পারবেন।" : voicePhase === "starting" ? "মাইক্রোফোন প্রস্তুত হলে কথা বলুন।" : voicePhase === "processing" ? "অনুগ্রহ করে অপেক্ষা করুন…" : error}</Text>
            {(voicePhase === "listening" || voicePhase === "ready") && <Pressable accessibilityRole="button" accessibilityLabel="রেকর্ডিং শেষ করে লেখায় রূপান্তর করুন" onPress={() => finishRecognition.current?.()} style={s.finishRecording}><Ionicons name="close" size={32} color={colors.white}/></Pressable>}
            {voicePhase === "error" && <Pressable accessibilityRole="button" onPress={() => { stopMic(); void startMic(); }} style={s.retry}><Text style={s.userText}>আবার চেষ্টা করুন</Text></Pressable>}
            <Pressable accessibilityRole="button" onPress={() => { stopMic(); setError(""); }} style={s.iconBack}><Text style={s.link}>বাতিল করে চ্যাটে ফিরুন</Text></Pressable>
          </View> : <>
          <ScrollView ref={scroll} style={s.flex} contentContainerStyle={s.conversation} keyboardShouldPersistTaps="handled" onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
            <View style={[s.bubble, s.assistant]}><Text style={s.message}>স্বাগতম! বাংলায় বা Banglish-এ প্রশ্ন লিখুন। মাইকে বলেও প্রশ্ন তৈরি করতে পারেন। যেমন: ajer sale koto taka?</Text></View>
            {messages.map(message => <View key={message.id} style={[s.bubble, message.role === "user" ? s.user : s.assistant]}>
              <Text style={[s.message, message.role === "user" && s.userText]}>{message.text}</Text>
              {message.role === "assistant" && <Pressable accessibilityRole="button" accessibilityLabel={speaking === message.id ? "পড়া থামান" : "উত্তর শুনুন"} onPress={() => speaking === message.id ? stopAudio() : readAnswer(message)} style={s.listen}><Ionicons name={speaking === message.id ? "stop-circle-outline" : "volume-high-outline"} size={18} color={colors.primaryDark}/><Text style={s.link}>{speaking === message.id ? "থামান" : "উত্তর শুনুন"}</Text></Pressable>}
            </View>)}
          </ScrollView>
          <Pressable accessibilityRole="button" onPress={() => setSamples(v => !v)} style={s.sampleToggle}><Text style={s.link}>{samples ? "নমুনা প্রশ্ন লুকান" : "নমুনা প্রশ্ন (১০টি)"}</Text><Ionicons name={samples ? "chevron-up" : "chevron-down"} size={16} color={colors.primaryDark}/></Pressable>
          {samples && <ScrollView style={s.samples} keyboardShouldPersistTaps="handled">{chatQuestions.map((q, i) => <Pressable accessibilityRole="button" key={q.roman} onPress={() => send(q.question)} style={s.sample}><Text style={s.link}>{i + 1}. {q.question}</Text><Text style={s.hint}>{q.roman}?</Text></Pressable>)}</ScrollView>}
          {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
          <Text accessibilityLiveRegion="polite" style={s.hint}>ভয়েসের লেখা দেখে প্রয়োজনে ঠিক করুন, তারপর পাঠান।</Text>
          <View style={s.composer}>
            <Pressable accessibilityRole="button" accessibilityLabel="বাংলায় বলুন" onPress={() => void startMic()} style={s.icon}><Ionicons name="mic-outline" size={23} color={colors.primaryDark}/></Pressable>
            <TextInput accessibilityLabel="আপনার প্রশ্ন" value={draft} onChangeText={setDraft} placeholder="প্রশ্ন লিখুন…" placeholderTextColor={colors.muted} multiline maxLength={500} style={s.input}/>
            <Pressable accessibilityRole="button" accessibilityLabel="প্রশ্ন পাঠান" disabled={!draft.trim()} onPress={() => send()} style={[s.send, (!draft.trim()) && s.disabled]}><Ionicons name="send" size={20} color={colors.white}/></Pressable>
          </View>
          </>}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  </>;
}
const s = StyleSheet.create({
  voicePanel:{flex:1,alignItems:"center",justifyContent:"center",gap:22,padding:16},microphoneCircle:{width:112,height:112,borderRadius:56,backgroundColor:"#FFF7ED",alignItems:"center",justifyContent:"center"},voiceTitle:{fontSize:20,fontWeight:"700",textAlign:"center",color:colors.heading},voiceHint:{fontSize:14,lineHeight:23,textAlign:"center",color:colors.secondary},finishRecording:{width:64,height:64,borderRadius:32,backgroundColor:colors.primary,alignItems:"center",justifyContent:"center"},retry:{padding:14,borderRadius:12,backgroundColor:colors.primary},iconBack:{minHeight:44,justifyContent:"center"},
  trigger:{width:40,height:40,borderRadius:14,backgroundColor:"#FFF7ED",borderWidth:1,borderColor:"#FED7AA",alignItems:"center",justifyContent:"center"},
  spark:{position:"absolute",bottom:-2,right:-2,borderRadius:8,padding:3,backgroundColor:colors.primary},
  overlay:{flex:1,backgroundColor:colors.overlay,alignItems:"center",justifyContent:"center",padding:16},
  card:{width:"100%",maxWidth:540,height:"90%",backgroundColor:colors.white,borderRadius:22,padding:16,gap:10},
  header:{flexDirection:"row",alignItems:"center",gap:10},flex:{flex:1},title:{fontSize:17,fontWeight:"700",color:colors.heading},
  hint:{fontSize:11,lineHeight:17,color:colors.secondary},notice:{fontSize:12,lineHeight:18,color:colors.primaryDark,backgroundColor:"#FFF7ED",padding:9,borderRadius:8},
  conversation:{gap:12,paddingVertical:12},bubble:{maxWidth:"90%",borderRadius:16,padding:12,gap:8},assistant:{alignSelf:"flex-start",backgroundColor:colors.cardSecondary},user:{alignSelf:"flex-end",backgroundColor:colors.primary},
  message:{fontSize:15,lineHeight:24,color:colors.heading},userText:{color:colors.white},listen:{flexDirection:"row",gap:6,alignItems:"center",minHeight:36},link:{fontSize:12,color:colors.primaryDark,fontWeight:"600"},
  sampleToggle:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",minHeight:36},samples:{maxHeight:130,flexGrow:0},sample:{padding:9,borderBottomWidth:1,borderBottomColor:colors.divider},
  error:{fontSize:12,lineHeight:18,color:colors.dangerText},composer:{flexDirection:"row",alignItems:"flex-end",gap:6,borderTopWidth:1,borderTopColor:colors.divider,paddingTop:10},
  icon:{width:44,height:44,alignItems:"center",justifyContent:"center",borderRadius:12},recording:{backgroundColor:colors.dangerBackground},input:{flex:1,minHeight:44,maxHeight:100,fontSize:14,color:colors.heading,backgroundColor:colors.cardSecondary,borderRadius:12,padding:10},send:{width:44,height:44,borderRadius:12,backgroundColor:colors.primary,alignItems:"center",justifyContent:"center"},disabled:{opacity:0.4},
});

