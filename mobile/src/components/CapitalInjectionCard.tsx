import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "../i18n/LocalizedText";
import { colors } from "../theme";
import type { Injection } from "../types/partners";
import FinancialCorrectionActions from "./FinancialCorrectionActions";

// One capital injection (installment) row. Used on the partner screen and on Cash In / Out.
// Draft actions and corrections only show when their handlers are passed.
type Tone = "good" | "bad" | "wait" | "info" | "neutral";
const money = (p: number) => `৳${(p / 100).toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const date = (v: string) => /T00:00:00(\.0+)?Z?$/.test(v)
  ? new Date(v).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })
  : new Date(v).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dhaka" });

export default function CapitalInjectionCard({ item, t, partnerName, onOpen, onCorrected, onEdit, onDelete, onSubmit, busy = false }: {
  item: Injection; t: (k: string) => string; partnerName?: string; onOpen?: () => void; onCorrected?: () => void;
  onEdit?: () => void; onDelete?: () => void; onSubmit?: () => void; busy?: boolean;
}) {
  const tone: Tone = item.status === "APPROVED" ? "good" : item.status === "REJECTED" ? "bad" : item.status === "PENDING_APPROVAL" ? "wait" : "neutral";
  const status = item.status === "CANCELLED" ? "Cancelled" : item.status === "PENDING_EXPENSE" ? "Waiting for expense approval"
    : t(`partners.injectionStatus${item.status === "PENDING_APPROVAL" ? "Pending" : item.status.charAt(0) + item.status.slice(1).toLowerCase()}`);
  const draftActions = item.status === "DRAFT" && item.isAccountingPeriodClosed === false && onEdit && onDelete && onSubmit;
  return <Pressable disabled={!onOpen} onPress={onOpen} style={s.card}>
    <View style={s.row}>
      <View style={s.flex}>
        {!!partnerName && <Text numberOfLines={1} style={s.name}>{partnerName}</Text>}
        <View style={s.badges}><Badge text={status} tone={tone} /><Badge text={t(item.paymentMethod === "CASH" ? "partners.cashAddedToFunds" : `partners.paymentMethod${item.paymentMethod}`)} tone="info" /></View>
        <Text style={s.meta}>{date(item.injectedAt)}{item.paidTo ? ` · ${item.paidTo}` : ""}</Text>
        {!!item.paymentReference && <Text style={s.small}>{item.paymentReference}</Text>}
        {!!item.rejectionReason && <Text style={s.negative}>{item.rejectionReason}</Text>}
      </View>
      <Text style={s.amount}>{money(item.amountPaisa)}</Text>
    </View>
    {draftActions && <View style={s.actions}><SmallAction label={t("common.edit")} onPress={onEdit} /><SmallAction label={t("common.delete")} bad onPress={onDelete} /><SmallAction label={t("common.save")} primary disabled={busy} onPress={onSubmit} /></View>}
    {onCorrected && <FinancialCorrectionActions isAccountingPeriodClosed={item.isAccountingPeriodClosed} installment id={item.id} amount={item.amountPaisa / 100} updatedAt={item.updatedAt} createdBy={item.createdBy} status={item.status} onSaved={onCorrected} />}
    {item.status === "PENDING_APPROVAL" && onOpen && <Text style={s.waitText}>{t("partners.tapToViewApproval")}</Text>}
  </Pressable>;
}

function Badge({ text, tone }: { text: string; tone: Tone }) { return <Text style={[s.badge, s[tone]]}>{text}</Text>; }
function SmallAction({ label, onPress, bad, primary, disabled }: { label: string; onPress: () => void; bad?: boolean; primary?: boolean; disabled?: boolean }) {
  return <Pressable disabled={disabled} onPress={e => { e.stopPropagation(); onPress(); }} style={[s.smallAction, bad && s.badButton, primary && s.primaryButton, disabled && s.disabled]}>
    <Text style={[s.smallActionText, (bad || primary) && s.whiteText]}>{label}</Text>
  </Pressable>;
}

const s = StyleSheet.create({
  card: { gap: 9, borderWidth: 1, borderColor: colors.divider, borderRadius: 13, backgroundColor: colors.white, padding: 11 },
  row: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  flex: { flex: 1, minWidth: 0 },
  name: { fontSize: 13, fontWeight: "700", color: colors.heading, marginBottom: 5 },
  badges: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 7 },
  meta: { fontSize: 13, fontWeight: "600", color: colors.heading, marginTop: 6 },
  small: { fontSize: 9, color: colors.muted, marginTop: 3 },
  negative: { color: colors.dangerText },
  amount: { fontSize: 12, fontWeight: "800", color: colors.heading },
  actions: { flexDirection: "row", gap: 6 },
  waitText: { fontSize: 10, color: colors.warningText },
  badge: { fontSize: 9, fontWeight: "700", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, overflow: "hidden" },
  good: { backgroundColor: colors.successBackground, color: colors.successText },
  bad: { backgroundColor: colors.dangerBackground, color: colors.dangerText },
  wait: { backgroundColor: colors.danger, color: colors.white },
  info: { backgroundColor: colors.infoBackground, color: colors.infoText },
  neutral: { backgroundColor: colors.disabled, color: colors.secondary },
  smallAction: { flex: 1, minHeight: 35, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.divider, borderRadius: 9, backgroundColor: colors.white, paddingHorizontal: 6 },
  smallActionText: { fontSize: 9, fontWeight: "700", color: colors.secondary, textAlign: "center" },
  badButton: { borderColor: colors.danger, backgroundColor: colors.danger },
  primaryButton: { borderColor: colors.primary, backgroundColor: colors.primary },
  disabled: { opacity: .45 },
  whiteText: { color: colors.white },
});
