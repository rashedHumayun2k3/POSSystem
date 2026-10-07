import type { ReactNode } from "react";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, ScrollView, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../theme";

type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message: string;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  visible,
  title,
  message,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { width } = useWindowDimensions();
  const compact = width < 520;
  const close = () => { if (!busy) onCancel(); };

  return <Modal visible={visible} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
    <View style={styles.overlay}>
      <Pressable accessibilityLabel="Close confirmation" disabled={busy} onPress={close} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={[styles.dialog, compact && styles.compactDialog]}>
        <View style={[styles.iconWrap, destructive && styles.dangerIconWrap]}>
          <Ionicons name={destructive ? "trash-outline" : "help-circle-outline"} size={26} color={destructive ? colors.danger : colors.primary} />
        </View>
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 12 }}>{children}{!!message && <Text style={styles.message}>{message}</Text>}</ScrollView>
        <View style={[styles.actions, compact && !children && styles.compactActions]}>
          <Pressable accessibilityRole="button" disabled={busy} onPress={close} style={[styles.button, styles.cancelButton, compact && !children && styles.compactButton]}>
            <Text style={styles.cancelText}>{cancelLabel}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={busy} onPress={onConfirm} style={[styles.button, destructive ? styles.dangerButton : styles.confirmButton, compact && !children && styles.compactButton, busy && styles.disabled]}>
            {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.confirmText}>{confirmLabel}</Text>}
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.overlay, padding: 20 },
  dialog: { width: "100%", maxWidth: 440, maxHeight: "90%", borderWidth: 1, borderColor: colors.divider, borderRadius: 20, backgroundColor: colors.card, padding: 24, shadowColor: colors.heading, shadowOpacity: .2, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 12 },
  compactDialog: { borderRadius: 18, padding: 20 },
  iconWrap: { width: 52, height: 52, alignItems: "center", justifyContent: "center", borderRadius: 26, backgroundColor: colors.primaryLight, marginBottom: 18 },
  dangerIconWrap: { backgroundColor: colors.dangerBackground },
  title: { color: colors.heading, fontSize: 21, fontWeight: "800", marginBottom: 8 },
  message: { color: colors.secondary, fontSize: 15, lineHeight: 23 },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 24 },
  compactActions: { flexDirection: "column-reverse" },
  button: { minWidth: 112, minHeight: 46, alignItems: "center", justifyContent: "center", borderRadius: 12, paddingHorizontal: 18 },
  compactButton: { width: "100%" },
  cancelButton: { borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.card },
  confirmButton: { backgroundColor: colors.primary },
  dangerButton: { backgroundColor: colors.danger },
  cancelText: { color: colors.heading, fontSize: 15, fontWeight: "700" },
  confirmText: { color: colors.white, fontSize: 15, fontWeight: "800" },
  disabled: { opacity: .65 },
});
