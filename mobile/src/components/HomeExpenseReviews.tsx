import ExpenseDocumentLink from "./ExpenseDocumentLink";
import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { useLanguage } from "../i18n/LanguageContext";
import { Text } from "../i18n/LocalizedText";
import { colors } from "../theme";
import PopupSheet from "./PopupSheet";

type ExpenseReview = { photoUrl?: string | null; id: string; title?: string; subType: string; amount: number; expenseDate: string; creatorName: string; version: number; cancelled: boolean };
type ReviewPage = { total: number; items: ExpenseReview[] };

export default function HomeExpenseReviews() {
  const auth = useAuth();
  const { t, lang } = useLanguage();
  const api = useRef(auth.api); api.current = auth.api;
  const generation = useRef(0);
  const saving = useRef(false);
  const [page, setPage] = useState<ReviewPage>({ total: 0, items: [] });
  const [selected, setSelected] = useState<string[]>([]);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useFocusEffect(useCallback(() => {
    const run = ++generation.current;
    setPage({ total: 0, items: [] }); setSelected([]); setVisible(false); setError("");
    if (auth.session?.businessId && ["OWNER", "PARTNER"].includes(auth.session.user.role ?? "")) {
      void api.current<ReviewPage>("/expense-reviews").then(result => {
        if (run === generation.current) { setPage(result); setVisible(result.total > 0); }
      }).catch(() => { if (run === generation.current) setError(t("expenseReviews.failed")); });
    }
    return () => { ++generation.current; setVisible(false); };
  }, [auth.session?.user.id, auth.session?.user.role, auth.session?.businessId, auth.session?.branchId, retry, t]));

  const save = async () => {
    if (saving.current || !selected.length) return;
    const run = generation.current;
    saving.current = true; setBusy(true); setError("");
    try {
      await api.current("/expense-reviews", { method: "POST", body: JSON.stringify({ items: page.items.filter(e => selected.includes(e.id)).map(e => ({ expenseId: e.id, version: e.version })) }) });
      if (run !== generation.current) return;
      setSelected([]);
      const result = await api.current<ReviewPage>("/expense-reviews");
      if (run === generation.current) { setPage(result); setVisible(result.total > 0); }
    } catch {
      if (run === generation.current) {
        setError(t("expenseReviews.saveFailed"));
        // A concurrent edit must be displayed again before it can be acknowledged.
        try {
          const result = await api.current<ReviewPage>("/expense-reviews");
          if (run === generation.current) { setPage(result); setSelected([]); }
        } catch { /* Keep the existing list and allow retry. */ }
      }
    } finally { saving.current = false; setBusy(false); }
  };
  if (!page.total && !error) return null;
  return <View style={s.card}>
    <Pressable accessibilityRole="button" onPress={() => page.total ? setVisible(true) : setRetry(v => v + 1)}>
      <Text style={s.heading}>{page.total ? t("expenseReviews.open", { count: page.total }) : t("expenseReviews.failed")}</Text>
    </Pressable>
    {!!error && !visible && <Text style={s.error}>{error}</Text>}
    <PopupSheet visible={visible} onClose={() => { if (!busy) setVisible(false); }} title={t("expenseReviews.title")}>
      <ScrollView contentContainerStyle={s.list}>
        <Text style={s.hint}>{t("expenseReviews.hint")}</Text>
        {page.items.map(e => {
          const checked = selected.includes(e.id);
          return <Pressable key={`${e.id}:${e.version}`} accessibilityRole="checkbox" accessibilityState={{ checked, disabled: busy }} disabled={busy}
            onPress={() => setSelected(ids => checked ? ids.filter(id => id !== e.id) : [...ids, e.id])} style={[s.row, checked && s.checked]}>
            <Ionicons name={checked ? "checkbox" : "square-outline"} size={24} color={checked ? colors.success : colors.secondary} />
            <View style={s.flex}>
              <Text style={s.heading}>{e.title || t(e.subType)} · ৳{e.amount.toLocaleString(lang === "bn" ? "bn-BD" : "en-BD")}</Text>
              <Text style={s.hint}>{t("expenseReviews.enteredBy", { name: e.creatorName })} · {new Date(e.expenseDate).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB")}</Text>
              {e.cancelled && <Text style={s.error}>{t("expenseReviews.cancelled")}</Text>}
              {!e.cancelled && e.version > 1 && <Text style={s.hint}>{t("expenseReviews.updated")}</Text>}
              <ExpenseDocumentLink url={e.photoUrl}/><Text style={s.checkLabel}>{t("expenseReviews.checked")}</Text>
            </View>
          </Pressable>;
        })}
        {page.total > page.items.length && <Text style={s.hint}>{t("expenseReviews.more", { count: page.total - page.items.length })}</Text>}
      </ScrollView>
      <View style={s.footer}>
        {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
        <Pressable accessibilityRole="button" disabled={busy || !selected.length} onPress={() => void save()} style={[s.save, (busy || !selected.length) && s.disabled]}>
          <Text style={s.saveText}>{busy ? t("common.saving") : t("expenseReviews.save", { count: selected.length })}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => setVisible(false)} style={s.later}><Text style={s.hint}>{t("expenseReviews.later")}</Text></Pressable>
      </View>
    </PopupSheet>
  </View>;
}
const s = StyleSheet.create({
  card: { margin: 12, padding: 12, borderRadius: 12, backgroundColor: colors.primaryLight },
  list: { padding: 14, gap: 10 }, flex: { flex: 1, gap: 4 },
  heading: { color: colors.heading, fontSize: 13, fontWeight: "700" },
  hint: { color: colors.secondary, fontSize: 12 }, error: { color: colors.dangerText, fontSize: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderWidth: 1, borderColor: colors.divider, borderRadius: 10 },
  checked: { backgroundColor: colors.successBackground, borderColor: colors.success },
  checkLabel: { color: colors.successText, fontSize: 12 },
  footer: { padding: 14, gap: 8, borderTopWidth: 1, borderTopColor: colors.divider },
  save: { backgroundColor: colors.primary, padding: 14, borderRadius: 10, alignItems: "center" },
  saveText: { color: colors.white, fontWeight: "700" }, disabled: { opacity: 0.45 }, later: { padding: 10, alignItems: "center" },
});
