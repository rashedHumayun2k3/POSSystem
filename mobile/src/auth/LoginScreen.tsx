import { Text } from "../i18n/LocalizedText";
import { colors } from "../theme";import { useEffect, useState } from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth, type Branch } from "./AuthContext";

type Page = "login" | "forgot" | "signup";
type ForgotStep = "email" | "find" | "code" | "password";
type SignupStep = "email" | "code" | "details";
const countries = ["Bangladesh", "India", "Pakistan", "Nepal", "Sri Lanka", "Myanmar", "Other"];

export default function LoginScreen() {
  const auth = useAuth();
  const [page, setPage] = useState<Page>("login");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok?: boolean } | null>(null);
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setMessage(null);
    try { await action(); } catch (e) { setMessage({ text: (e as Error).message }); } finally { setBusy(false); }
  };
  const go = (next: Page) => { setPage(next); setMessage(null); };
  if (auth.session) return <StoreChooser busy={busy} run={run} />;
  return <KeyboardAvoidingView style={s.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
      {page === "login" && <Login busy={busy} run={run} go={go} />}
      {page === "forgot" && <Forgot busy={busy} run={run} login={() => go("login")} success={() => { setPage("login"); setMessage({ text: "Password reset successfully. Please sign in.", ok: true }); }} />}
      {page === "signup" && <Signup busy={busy} run={run} login={() => go("login")} />}
      {busy && <ActivityIndicator style={s.loading} color={colors.primary} />}
      {message && <Text accessibilityRole="alert" style={[s.message, message.ok && s.success]}>{message.text}</Text>}
    </ScrollView>
  </KeyboardAvoidingView>;
}

function Header({ title, subtitle, logo, shopIcon }: { title?: string; subtitle: string; logo?: boolean; shopIcon?: boolean }) {
  return <View style={s.header}>{logo && <Image source={require("../../assets/logo.png")} style={s.logo} resizeMode="contain" />}{shopIcon && <View style={s.shopIcon}><Ionicons name="bag-outline" size={36} color={colors.white} /></View>}{title && <Text style={s.title}>{title}</Text>}<Text style={s.subtitle}>{subtitle}</Text></View>;
}
function Field({ label, value, change, placeholder, password, keyboardType = "default", maxLength }: { label: string; value: string; change: (v: string) => void; placeholder?: string; password?: boolean; keyboardType?: "default" | "email-address" | "phone-pad" | "number-pad"; maxLength?: number }) {
  const [show, setShow] = useState(false); const [focus, setFocus] = useState(false);
  return <View style={s.field}><Text style={s.label}>{label}</Text><View style={[s.inputBox, focus && s.focus]}><TextInput style={s.input} value={value} onChangeText={change} placeholder={placeholder} placeholderTextColor={colors.muted} autoCapitalize="none" autoCorrect={false} secureTextEntry={password && !show} keyboardType={keyboardType} maxLength={maxLength} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} />{password && <Pressable onPress={() => setShow(v => !v)} style={s.show}><Text style={s.muted}>{show ? "Hide" : "Show"}</Text></Pressable>}</View></View>;
}
function Button({ text, disabled, press }: { text: string; disabled?: boolean; press: () => void }) {
  return <Pressable disabled={disabled} onPress={press} style={({ pressed }) => [s.button, (disabled || pressed) && s.dim]}><Text style={s.buttonText}>{text}</Text></Pressable>;
}
function Link({ text, press }: { text: string; press: () => void }) { return <Pressable hitSlop={8} onPress={press}><Text style={s.link}>{text}</Text></Pressable>; }
function Progress({ index, back }: { index: number; back?: () => void }) {
  return <View style={s.progressRow}>{back && <Pressable onPress={back}><Ionicons name="chevron-back" size={22} color={colors.muted} /></Pressable>}<View style={s.progress}>{[0, 1, 2].map(i => <View key={i} style={[s.progressPart, i <= index && s.progressOn]} />)}</View></View>;
}

function Login({ busy, run, go }: { busy: boolean; run: (a: () => Promise<void>) => void; go: (p: Page) => void }) {
  const auth = useAuth(); const [id, setId] = useState(""); const [password, setPassword] = useState(""); const [bn, setBn] = useState(false);
  return <View style={s.width}><Header logo subtitle={bn ? "আপনার অ্যাকাউন্টে সাইন ইন করুন" : "Sign in to your account"} /><View style={s.card}>
    <Field label={bn ? "ফোন নম্বর / ইমেইল" : "Phone number / Email"} value={id} change={setId} placeholder="01700000000 or name@example.com" keyboardType="email-address" />
    <Field label={bn ? "পাসওয়ার্ড" : "Password"} value={password} change={setPassword} placeholder="••••••••" password />
    <Button text={busy ? "Signing in…" : bn ? "সাইন ইন" : "Sign in"} disabled={busy || !id.trim() || !password} press={() => void run(() => auth.login(id, password))} />
    <View style={s.center}><Link text={bn ? "পাসওয়ার্ড ভুলে গেছেন?" : "Forgot password?"} press={() => go("forgot")} /></View>
    <Text style={s.note}>{bn ? "ইমেইল নেই? Settings → Staff থেকে রিসেট করতে Owner-কে বলুন।" : "No email on file? Ask your Owner to reset it from Settings → Staff."}</Text>
    <View style={s.inline}><Text style={s.small}>{bn ? "অ্যাকাউন্ট নেই? " : "Don't have an account? "}</Text><Link text={bn ? "অ্যাকাউন্ট তৈরি করুন" : "Create account"} press={() => go("signup")} /></View>
    <View style={s.center}><Link text={bn ? "Switch to English" : "বাংলায় দেখুন"} press={() => setBn(v => !v)} /></View>
  </View></View>;
}

function Forgot({ busy, run, login, success }: { busy: boolean; run: (a: () => Promise<void>) => void; login: () => void; success: () => void }) {
  const auth = useAuth(); const [step, setStep] = useState<ForgotStep>("email"); const [email, setEmail] = useState(""); const [code, setCode] = useState(""); const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState(""); const [phone, setPhone] = useState(""); const [shop, setShop] = useState(""); const [found, setFound] = useState<string | null>(null); const [cooldown, setCooldown] = useState(0);
  useEffect(() => { if (!cooldown) return; const timer = setTimeout(() => setCooldown(v => v - 1), 1000); return () => clearTimeout(timer); }, [cooldown]);
  const resend = () => void run(async () => { await auth.requestPasswordResetCode(email); setCooldown(60); });
  const index = step === "email" ? 0 : step === "code" ? 1 : 2;
  return <View style={s.width}><Header title="Reset your password" subtitle="We'll email you a code to verify it's you" /><View style={s.card}>
    {step !== "find" && <Progress index={index} back={step === "code" ? () => setStep("email") : step === "password" ? () => setStep("code") : undefined} />}
    {step === "email" && <><Field label="Email address" value={email} change={setEmail} placeholder="you@example.com" keyboardType="email-address" /><Link text="Can't remember your email?" press={() => setStep("find")} /><Button text={busy ? "Sending…" : "Send reset code"} disabled={busy || !email.trim()} press={() => void run(async () => { await auth.requestPasswordResetCode(email); setCooldown(60); setStep("code"); })} /></>}
    {step === "find" && <><View style={s.heading}><Pressable onPress={() => setStep("email")}><Ionicons name="chevron-back" size={22} color={colors.muted} /></Pressable><Text style={s.sectionTitle}>Find your account</Text></View><Text style={s.small}>Enter your phone number and shop name and we'll help you find your email.</Text><Field label="Phone number" value={phone} change={setPhone} placeholder="01XXXXXXXXX" keyboardType="phone-pad" /><Field label="Shop name" value={shop} change={setShop} />{found && <View style={s.found}><Text style={s.foundText}>We found an account with this email:</Text><Text style={s.foundStrong}>{found}</Text><Link text="Use this to reset your password" press={() => setStep("email")} /></View>}<Button text={busy ? "Searching…" : "Find my email"} disabled={busy || !phone.trim() || !shop.trim()} press={() => void run(async () => { const result = await auth.findEmail(phone, shop); if (!result.found || !result.maskedEmail) throw new Error("No matching account found for that phone number and shop name."); setFound(result.maskedEmail); })} /></>}
    {step === "code" && <><Text style={s.small}>We've sent a 6-digit code to <Text style={s.strong}>{email}</Text>.</Text><Field label="Verification code" value={code} change={v => setCode(v.replace(/\D/g, ""))} placeholder="123456" keyboardType="number-pad" maxLength={6} /><Link text={cooldown ? `Resend in ${cooldown}s` : "Resend code"} press={() => { if (!cooldown && !busy) resend(); }} /><Button text={busy ? "Verifying…" : "Verify code"} disabled={busy || code.length !== 6} press={() => void run(async () => { await auth.verifyPasswordResetCode(email, code); setStep("password"); })} /></>}
    {step === "password" && <><Field label="New password" value={password} change={setPassword} placeholder="••••••••" password /><Field label="Confirm new password" value={confirm} change={setConfirm} placeholder="••••••••" password /><Button text={busy ? "Resetting…" : "Reset password"} disabled={busy || password.length < 8 || confirm.length < 8} press={() => void run(async () => { if (password !== confirm) throw new Error("Passwords don't match."); await auth.completePasswordReset(email, password); success(); })} /></>}
    <View style={s.center}><Link text="Back to sign in" press={login} /></View>
  </View></View>;
}

function Signup({ busy, run, login }: { busy: boolean; run: (a: () => Promise<void>) => void; login: () => void }) {
  const auth = useAuth(); const [step, setStep] = useState<SignupStep>("email"); const [email, setEmail] = useState(""); const [code, setCode] = useState(""); const [name, setName] = useState(""); const [phone, setPhone] = useState(""); const [password, setPassword] = useState(""); const [business, setBusiness] = useState(""); const [country, setCountry] = useState(0); const [cooldown, setCooldown] = useState(0);
  useEffect(() => { if (!cooldown) return; const timer = setTimeout(() => setCooldown(v => v - 1), 1000); return () => clearTimeout(timer); }, [cooldown]);
  const resend = () => void run(async () => { await auth.requestSignupCode(email); setCooldown(60); });
  const index = step === "email" ? 0 : step === "code" ? 1 : 2;
  return <View style={s.width}><Header shopIcon title="Create your account" subtitle="Set up your business in a few steps" /><View style={s.card}><Progress index={index} back={step === "code" ? () => setStep("email") : step === "details" ? () => setStep("code") : undefined} />
    {step === "email" && <><Field label="Email address" value={email} change={setEmail} placeholder="you@example.com" keyboardType="email-address" /><Button text={busy ? "Sending…" : "Send code"} disabled={busy || !email.trim()} press={() => void run(async () => { await auth.requestSignupCode(email); setCooldown(60); setStep("code"); })} /><View style={s.divider}><View style={s.dividerLine} /><Text style={s.dividerText}>or verify instantly with Google</Text><View style={s.dividerLine} /></View></>}
    {step === "code" && <><Text style={s.small}>We sent a 6-digit code to <Text style={s.strong}>{email}</Text></Text><Field label="Verification code" value={code} change={v => setCode(v.replace(/\D/g, ""))} placeholder="123456" keyboardType="number-pad" maxLength={6} /><Link text={cooldown ? `Resend in ${cooldown}s` : "Resend code"} press={() => { if (!cooldown && !busy) resend(); }} /><Button text={busy ? "Verifying…" : "Verify code"} disabled={busy || code.length !== 6} press={() => void run(async () => { await auth.verifySignupCode(email, code); setStep("details"); })} /></>}
    {step === "details" && <><Field label="Your name" value={name} change={setName} /><Field label="Phone number" value={phone} change={setPhone} placeholder="01700000000" keyboardType="phone-pad" /><Text style={s.note}>Please remember this number — you'll use it as your username to sign in.</Text><Field label="Password" value={password} change={setPassword} placeholder="••••••••" password /><Field label="Business name" value={business} change={setBusiness} /><View style={s.field}><Text style={s.label}>Country <Text style={s.muted}>(optional)</Text></Text><Pressable style={s.select} onPress={() => setCountry(i => (i + 1) % countries.length)}><Text>{countries[country]}</Text><Ionicons name="chevron-down" size={18} color={colors.secondary} /></Pressable></View><Button text={busy ? "Creating account…" : "Create account"} disabled={busy || !name.trim() || !phone.trim() || password.length < 8 || !business.trim()} press={() => void run(async () => { if (!/^(?:\+?88)?01[3-9]\d{8}$/.test(phone.trim())) throw new Error("Enter a valid Bangladesh mobile number, e.g. 01700000000."); await auth.completeSignup({ email, name, phone, password, businessName: business, country: countries[country] }); })} /></>}
    <View style={s.inline}><Text style={s.small}>Already have an account? </Text><Link text="Sign in" press={login} /></View>
  </View></View>;
}

function StoreChooser({ busy, run }: { busy: boolean; run: (a: () => Promise<void>) => void }) {
  const auth = useAuth(); const [branches, setBranches] = useState<Branch[] | null>(null);
  return <ScrollView contentContainerStyle={s.page}><View style={s.width}><Header logo title="Choose your store" subtitle="Select the business and branch to view orders." /><View style={s.card}>{!branches ? auth.session!.businesses.map(b => <Pressable key={b.id} style={s.choice} onPress={() => void run(async () => { const list = await auth.chooseBusiness(b.id); if (list.length === 1) await auth.chooseBranch(list[0]); else setBranches(list); })}><Text style={s.choiceText}>{b.name}</Text><Ionicons name="chevron-forward" size={18} color={colors.muted} /></Pressable>) : <>{branches.map(b => <Pressable key={b.id} style={s.choice} onPress={() => void run(() => auth.chooseBranch(b))}><Text style={s.choiceText}>{b.name}</Text></Pressable>)}{!branches.length && <Text style={s.small}>No branches are assigned to this account.</Text>}<Link text="Choose another business" press={() => setBranches(null)} /></>}{busy && <ActivityIndicator color={colors.primary} />}</View></View></ScrollView>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background }, page: { flexGrow: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 16, paddingVertical: 32, backgroundColor: colors.background }, width: { width: "100%", maxWidth: 384 }, header: { alignItems: "center", marginBottom: 28 }, logo: { width: 240, height: 67, marginBottom: 12 }, shopIcon: { width: 64, height: 64, borderRadius: 16, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginBottom: 16 }, title: { color: colors.heading, fontSize: 24, fontWeight: "700", textAlign: "center" }, subtitle: { color: colors.secondary, fontSize: 14, marginTop: 5, textAlign: "center" },
  card: { backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 24, gap: 16, elevation: 2 }, field: { gap: 6 }, label: { fontSize: 14, fontWeight: "500", color: colors.heading }, inputBox: { minHeight: 48, borderWidth: 1, borderColor: colors.divider, borderRadius: 12, flexDirection: "row", alignItems: "center" }, focus: { borderColor: colors.activeBorder, borderWidth: 2 }, input: { flex: 1, minHeight: 46, paddingHorizontal: 16, fontSize: 14, color: colors.heading, outlineStyle: "none" } as never, show: { padding: 13 }, muted: { color: colors.muted, fontSize: 12 }, button: { minHeight: 48, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }, dim: { opacity: .55 }, buttonText: { color: colors.white, fontSize: 14, fontWeight: "700" }, link: { color: colors.primary, fontSize: 12, fontWeight: "600", textAlign: "center" }, note: { color: colors.muted, fontSize: 11, lineHeight: 16, textAlign: "center" }, small: { color: colors.secondary, fontSize: 13, lineHeight: 19 }, strong: { color: colors.heading, fontWeight: "600" }, center: { alignItems: "center" }, inline: { flexDirection: "row", justifyContent: "center", alignItems: "center", flexWrap: "wrap" }, divider: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 4 }, dividerLine: { flex: 1, height: 1, backgroundColor: colors.divider }, dividerText: { color: colors.muted, fontSize: 12 }, loading: { marginTop: 12 }, message: { width: "100%", maxWidth: 384, color: colors.dangerText, backgroundColor: colors.dangerBackground, marginTop: 12, padding: 12, borderRadius: 10 }, success: { color: colors.successText, backgroundColor: colors.successBackground }, progressRow: { flexDirection: "row", alignItems: "center", gap: 8 }, progress: { flex: 1, flexDirection: "row", gap: 4 }, progressPart: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.divider }, progressOn: { backgroundColor: colors.primary }, heading: { flexDirection: "row", alignItems: "center", gap: 8 }, sectionTitle: { color: colors.heading, fontSize: 16, fontWeight: "600" }, found: { backgroundColor: colors.successBackground, padding: 12, borderRadius: 9, gap: 4 }, foundText: { color: colors.successText, fontSize: 13 }, foundStrong: { color: colors.successText, fontWeight: "700" }, select: { minHeight: 48, borderWidth: 1, borderColor: colors.divider, borderRadius: 12, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, choice: { minHeight: 54, borderWidth: 1, borderColor: colors.divider, borderRadius: 12, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, choiceText: { color: colors.heading, fontWeight: "600" }
});



