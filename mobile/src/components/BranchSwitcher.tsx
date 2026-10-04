import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useAuth, type Branch } from "../auth/AuthContext";
import { Text } from "../i18n/LocalizedText";
import { colors } from "../theme";

export default function BranchSwitcher({ onSelected }: { onSelected?: () => void }) {
  const auth = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const current = branches.find(branch => branch.id === auth.session?.branchId);

  useEffect(() => {
    let active = true;
    if (!auth.session?.businessId) { setBranches([]); return () => { active = false; }; }
    setLoading(true);
    auth.api<Branch[]>("/branches/mine")
      .then(async value => {
        if (!active) return;
        const available = value.filter(branch => branch.isActive !== false);
        setBranches(available);
        if (available.length && !available.some(branch => branch.id === auth.session?.branchId)) {
          await auth.chooseBranch(available.find(branch => branch.isDefault) ?? available[0]);
        }
      })
      .catch(reason => { if (active) setError((reason as Error).message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [auth.session?.businessId, auth.session?.accessToken, auth.session?.branchId]);

  if (branches.length < 2) return null;

  const select = async (branch: Branch) => {
    setSaving(true); setError("");
    try {
      await auth.chooseBranch(branch);
      setOpen(false);
      onSelected?.();
    } catch (reason) { setError((reason as Error).message); }
    finally { setSaving(false); }
  };

  return <View>
    <Pressable accessibilityRole="button" accessibilityLabel="Select branch" disabled={loading} onPress={() => { setError(""); setOpen(value => !value); }} style={styles.button}>
      <Ionicons name="business-outline" size={17} color={colors.primaryDark} />
      <View style={styles.copy}>
        <Text style={styles.caption}>BRANCH</Text>
        <Text numberOfLines={1} style={styles.name}>{current?.name ?? "Select branch"}</Text>
      </View>
      {loading ? <ActivityIndicator size="small" color={colors.primaryDark} /> : <Ionicons name={open ? "chevron-up" : "chevron-down"} size={17} color={colors.primaryDark} />}
    </Pressable>
    {open && <ScrollView style={styles.list}>
      {branches.map(branch => <Pressable key={branch.id} disabled={saving} onPress={() => void select(branch)} style={styles.row}>
        <Text numberOfLines={1} style={[styles.option, branch.id === auth.session?.branchId && styles.selected]}>{branch.name}</Text>
        {branch.id === auth.session?.branchId && <Ionicons name="checkmark" size={19} color={colors.primary} />}
      </Pressable>)}
      {saving && <ActivityIndicator size="small" color={colors.primary} style={styles.saving} />}
      {!!error && <Text style={styles.error}>{error}</Text>}
    </ScrollView>}
  </View>;
}

const styles = StyleSheet.create({
  button: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.primaryLight },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  caption: { color: colors.muted, fontSize: 9, fontWeight: "700", letterSpacing: 0.6 },
  name: { color: colors.primaryDark, fontSize: 13, fontWeight: "700" },
  list: { maxHeight: 220, paddingHorizontal: 8, borderWidth: 1, borderColor: colors.divider, borderRadius: 10, backgroundColor: colors.primaryLight },
  row: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderBottomWidth: 1, borderBottomColor: colors.divider, paddingHorizontal: 4 },
  option: { flex: 1, color: colors.secondary, fontSize: 13 },
  selected: { color: colors.primaryDark, fontWeight: "700" },
  saving: { padding: 8 },
  error: { color: colors.danger, fontSize: 12, paddingVertical: 10 },
});
