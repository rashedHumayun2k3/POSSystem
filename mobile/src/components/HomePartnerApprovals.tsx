import { useCallback, useRef, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "../auth/AuthContext";
import { ConfirmDialog } from "./ConfirmDialog";
import { useLanguage } from "../i18n/LanguageContext";
import type { Approval, Partner } from "../types/partners";
import type { Expense, ExpensePage } from "../types/expenses";

type Request = { kind: "partner"; partner: Partner } | { kind: "expense"; expense: Expense };

export default function HomePartnerApprovals() {
  const auth = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const api = useRef(auth.api); api.current = auth.api;
  const dismissed = useRef(new Set<string>());
  const [requests, setRequests] = useState<Request[]>([]);
  const userId = auth.session?.user.id;
  const role = auth.session?.user.role;

  useFocusEffect(useCallback(() => {
    let active = true;
    setRequests([]);
    if (!userId || !auth.session?.businessId || !["OWNER", "PARTNER"].includes(role ?? "")) return;
    void (async () => {
      try {
        const partners = await api.current<Partner[]>("/partners");
        const me = partners.find(p => p.linkedUserId === userId && p.partnerType === "MANAGING" && p.status === "ACTIVE");
        if (!me || !active) return;
        const pending = partners.filter(p => p.status === "PENDING_APPROVAL" && p.id !== me.id);
        const [eligible, expensePage] = await Promise.all([Promise.all(pending.map(async partner => {
          const approval = await api.current<Approval>(`/partners/${partner.id}/approval`);
          return approval.status === "PENDING_APPROVAL" && !approval.votes.some(v => v.votedByPartnerId === me.id) ? partner : null;
        })), api.current<ExpensePage>("/expenses?status=PENDING&pageSize=100")]);
        if (active) setRequests([
          ...eligible.filter((p): p is Partner => p !== null && !dismissed.current.has(`partner:${p.id}`)).map(partner => ({ kind: "partner" as const, partner })),
          ...expensePage.items.filter(expense => expense.createdBy !== userId && expense.lastCorrectedBy !== userId && !dismissed.current.has(`expense:${expense.id}`)).map(expense => ({ kind: "expense" as const, expense })),
        ]);
      } catch { if (active) setRequests([]); }
    })();
    return () => { active = false; setRequests([]); };
  }, [userId, role, auth.session?.businessId]));

  const current = requests[0];
  const close = () => { if (current) dismissed.current.add(`${current.kind}:${current.kind === "partner" ? current.partner.id : current.expense.id}`); setRequests(items => items.slice(1)); };
  return <ConfirmDialog visible={!!current} showClose title={t(current?.kind === "expense" ? "homeExpenseApproval.title" : "homePartnerApproval.title")}
    message={current?.kind === "partner" ? t("homePartnerApproval.newPartnership", { name: current.partner.name }) : current?.kind === "expense" ? t("homeExpenseApproval.message", { name: current.expense.subType, amount: current.expense.amount.toLocaleString("en-BD"), creator: current.expense.createdByName }) : ""}
    confirmLabel={t("homePartnerApproval.viewDetails")} cancelLabel={t("homePartnerApproval.later")}
    onCancel={close} onConfirm={() => { if (!current) return; const route = current.kind === "partner" ? `/more/settings/partners/${current.partner.id}` : "/more/expenses?status=PENDING"; close(); router.push(route as never); }}/>
}
