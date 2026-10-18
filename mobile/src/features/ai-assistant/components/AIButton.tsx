import AssistantAvatar from "./AssistantAvatar";
import { useEffect, useRef, useState } from "react";
import { AppState, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usePathname } from "expo-router";
import { colors } from "../../../theme";
import { useAuth } from "../../../auth/AuthContext";
import { chatQuestions, getPocAnswer } from "../services/chatPoc";
import { prepareBanglaSpeech, speakBangla, stopSpeaking } from "../services/speechService";


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
  const [speaking, setSpeaking] = useState<number | null>(null);
  const [error, setError] = useState("");
  const scroll = useRef<ScrollView>(null);
  const sequence = useRef(0);
  const speechSession = useRef(0);
  const speechTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const path = usePathname();

  const stopAudio = () => {
    speechSession.current++;
    clearTimeout(speechTimer.current);
    setSpeaking(null);
    void stopSpeaking().catch(() => {});
  };
  const close = () => { stopAudio(); setOpen(false); };
  useEffect(() => {
    const warm = () => { void prepareBanglaSpeech().catch(() => {}); };
    warm();
    const synth = Platform.OS === "web" && typeof window !== "undefined" ? window.speechSynthesis : undefined;
    synth?.addEventListener("voiceschanged", warm);
    const sub = AppState.addEventListener("change", state => {
      if (state !== "background") return;
      stopAudio();
    });
    return () => {
      speechSession.current++;
      clearTimeout(speechTimer.current);
      synth?.removeEventListener("voiceschanged", warm); sub.remove();
      void stopSpeaking().catch(() => {});
    };
  }, []);
  useEffect(() => { close(); }, [path]);

  const readAnswer = (message: Message) => {
    stopAudio(); setError("");
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
    stopAudio(); setError(""); setDraft(""); setSamples(false);
    const user: Message = { id: ++sequence.current, role: "user", text };
    const reply: Message = { id: ++sequence.current, role: "assistant", text: getPocAnswer(text) };
    setMessages(current => [...current, user, reply]);
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
          <ScrollView ref={scroll} style={s.flex} contentContainerStyle={s.conversation} keyboardShouldPersistTaps="handled" onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
            <View style={[s.bubble, s.assistant]}><Text style={s.message}>স্বাগতম! বাংলায় বা Banglish-এ প্রশ্ন লিখুন। যেমন: ajer sale koto taka?</Text></View>
            {messages.map(message => <View key={message.id} style={[s.bubble, message.role === "user" ? s.user : s.assistant]}>
              <Text style={[s.message, message.role === "user" && s.userText]}>{message.text}</Text>
              {message.role === "assistant" && <Pressable accessibilityRole="button" accessibilityLabel={speaking === message.id ? "পড়া থামান" : "উত্তর শুনুন"} onPress={() => speaking === message.id ? stopAudio() : readAnswer(message)} style={s.listen}><Ionicons name={speaking === message.id ? "stop-circle-outline" : "volume-high-outline"} size={18} color={colors.primaryDark}/><Text style={s.link}>{speaking === message.id ? "থামান" : "উত্তর শুনুন"}</Text></Pressable>}
            </View>)}
          </ScrollView>
          <Pressable accessibilityRole="button" onPress={() => setSamples(v => !v)} style={s.sampleToggle}><Text style={s.link}>{samples ? "নমুনা প্রশ্ন লুকান" : "নমুনা প্রশ্ন (১০টি)"}</Text><Ionicons name={samples ? "chevron-up" : "chevron-down"} size={16} color={colors.primaryDark}/></Pressable>
          {samples && <ScrollView style={s.samples} keyboardShouldPersistTaps="handled">{chatQuestions.map((q, i) => <Pressable accessibilityRole="button" key={q.roman} onPress={() => send(q.question)} style={s.sample}><Text style={s.link}>{i + 1}. {q.question}</Text><Text style={s.hint}>{q.roman}?</Text></Pressable>)}</ScrollView>}
          {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
          <View style={s.composer}>
            <TextInput accessibilityLabel="আপনার প্রশ্ন" value={draft} onChangeText={setDraft} placeholder="প্রশ্ন লিখুন…" placeholderTextColor={colors.muted} multiline maxLength={500} style={s.input}/>
            <Pressable accessibilityRole="button" accessibilityLabel="প্রশ্ন পাঠান" disabled={!draft.trim()} onPress={() => send()} style={[s.send, (!draft.trim()) && s.disabled]}><Ionicons name="send" size={20} color={colors.white}/></Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  </>;
}
const s = StyleSheet.create({
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
  icon:{width:44,height:44,alignItems:"center",justifyContent:"center",borderRadius:12},input:{flex:1,minHeight:44,maxHeight:100,fontSize:14,color:colors.heading,backgroundColor:colors.cardSecondary,borderRadius:12,padding:10},send:{width:44,height:44,borderRadius:12,backgroundColor:colors.primary,alignItems:"center",justifyContent:"center"},disabled:{opacity:0.4},
});

