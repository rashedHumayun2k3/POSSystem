import {useCallback, useRef, useState} from "react";
import {useFocusEffect} from "expo-router";
import {Pressable, View, useWindowDimensions} from "react-native";
import {useAuth} from "../auth/AuthContext";
import {useLanguage} from "../i18n/LanguageContext";
import {Text} from "../i18n/LocalizedText";
import {colors} from "../theme";
import type {Approval, Injection, Partner} from "../types/partners";
import {InjectionDetails} from "../screens/PartnerDetailScreen";
import BottomSheet from "./BottomSheet";

type Pending = {item: Injection; approval: Approval};

export default function HomeInstallmentApprovals() {
  const auth = useAuth();
  const {t} = useLanguage();
  const {width} = useWindowDimensions();
  const api = useRef(auth.api); api.current = auth.api;
  const generation = useRef(0);
  const voting = useRef(false);
  const [queue, setQueue] = useState<Pending[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [reasons, setReasons] = useState<Record<string,string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const userId = auth.session?.user.id;
  const role = auth.session?.user.role;

  useFocusEffect(useCallback(() => {
    const run = ++generation.current;
    setQueue([]); setError(""); setReasons({});
    if (!userId || !auth.session?.businessId || !["OWNER", "PARTNER"].includes(role || "")) return;
    void (async () => {
      try {
        const all = await api.current<Partner[]>("/partners");
        const me = all.find(p => p.linkedUserId === userId && p.status === "ACTIVE" && p.partnerType === "MANAGING");
        if (!me || run !== generation.current) return;
        const pending = await api.current<Injection[]>("/partners/capital-injections/awaiting-approval");
        const eligible: Pending[] = [];
        for (const item of pending) {
          if (run !== generation.current) return;
          const approval = await api.current<Approval>(`/partners/${item.partnerId}/capital-injections/${item.id}/approval`);
          if (approval.status === "PENDING_APPROVAL" && !approval.votes.some(v => v.votedByPartnerId === me.id))
            eligible.push({item, approval});
        }
        if (run === generation.current) { setPartners(all); setQueue(eligible); }
      } catch (e) { if (run === generation.current) setError((e as Error).message); }
    })();
    return () => { ++generation.current; };
  }, [userId, auth.session?.businessId, role, retry]));

  const current = queue[0];
  const later = () => { if (!voting.current) { setQueue([]); setError(""); } };
  const vote = async (decision: "APPROVE"|"REJECT", key: string) => {
    if (!current || voting.current) return;
    const note = reasons[key]?.trim();
    if (decision === "REJECT" && !note) { setError(t("partners.rejectReasonPlaceholder")); return; }
    const run = generation.current;
    voting.current = true; setBusy(true); setError("");
    try {
      // Refresh before voting: another managing partner may already have completed approval.
      const path = `/partners/${current.item.partnerId}/capital-injections/${current.item.id}`;
      const latest = await api.current<Approval>(`${path}/approval`);
      const me = partners.find(p => p.linkedUserId === userId);
      if (run !== generation.current) return;
      if (latest.status === "PENDING_APPROVAL" && !latest.votes.some(v => v.votedByPartnerId === me?.id))
        await api.current(`${path}/votes`, {method:"POST", body:JSON.stringify({decision, note:note || undefined})});
      if (run === generation.current) { setQueue(q => q.slice(1)); setReasons({}); }
    } catch (e) { if (run === generation.current) setError((e as Error).message); }
    finally { voting.current = false; setBusy(false); }
  };

  if (!current) return error ? <View style={{padding:12,gap:8}}><Text>{t("homeApproval.failed")}</Text><Pressable accessibilityRole="button" onPress={()=>setRetry(n=>n+1)}><Text>{t("partnerSummary.retry")}</Text></Pressable></View> : null;
  return <BottomSheet visible close={later} title={t("partners.injectionDetailsTitle")} mobile={width<768}
    footer={<Pressable accessibilityRole="button" disabled={busy} onPress={later} style={{padding:12,alignItems:"center"}}><Text style={{color:colors.primaryDark,fontWeight:"700"}}>{t("homeApproval.later")}</Text></Pressable>}>
    <Text style={{fontWeight:"700",color:colors.heading}}>{partners.find(p=>p.id===current.item.partnerId)?.name}</Text>
    <Text>{t("homeApproval.remaining",{count:queue.length})}</Text>
    {!!error && <Text accessibilityRole="alert" style={{color:colors.dangerText}}>{error}</Text>}
    <InjectionDetails item={current.item} approval={current.approval}
      managers={partners.filter(p=>p.partnerType==="MANAGING"&&p.status==="ACTIVE")}
      userId={userId} reasons={reasons} setReasons={setReasons} vote={(d,k)=>void vote(d,k)}
      edit={()=>{}} submit={()=>{}} busy={busy} t={t}/>
  </BottomSheet>;
}
