import { Ionicons } from "@expo/vector-icons";
import { useEffect, type ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "../i18n/LocalizedText";
import { colors } from "../theme";
import { useModalChrome } from "./ModalChromeContext";

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  headerAction?: ReactNode;
  onShow?: () => void;
  children: ReactNode;
};

// Keep the navigation hidden until the last sheet in this provider closes.
const openSheets = new Map<(hidden: boolean) => void, number>();

export default function PopupSheet({ visible, onClose, title, headerAction, onShow, children }: Props) {
  const desktop = useWindowDimensions().width >= 768;
  const insets = useSafeAreaInsets();
  const { setBottomNavHidden } = useModalChrome();
  useEffect(() => {
    if (!visible || desktop) return;
    openSheets.set(setBottomNavHidden, (openSheets.get(setBottomNavHidden) ?? 0) + 1);
    setBottomNavHidden(true);
    return () => {
      const remaining = (openSheets.get(setBottomNavHidden) ?? 1) - 1;
      if (remaining > 0) openSheets.set(setBottomNavHidden, remaining);
      else {
        openSheets.delete(setBottomNavHidden);
        setBottomNavHidden(false);
      }
    };
  }, [visible, desktop, setBottomNavHidden]);

  return <Modal visible={visible} transparent animationType={desktop ? "fade" : "slide"} onRequestClose={onClose} onShow={onShow}>
    <KeyboardAvoidingView style={s.fill} behavior="padding" enabled={!desktop && Platform.OS === "ios"}>
      <View style={[s.overlay, !desktop && s.mobileOverlay]}>
        <View style={[s.panel, desktop ? s.desktopPanel : s.mobilePanel, !desktop && { paddingBottom: insets.bottom }]}>
          {!desktop && <View style={s.handle} />}
          <View style={s.header}>
            <Text style={s.title}>{title}</Text>
            {headerAction}
            <Pressable accessibilityRole="button" accessibilityLabel={`Close ${title}`} onPress={onClose} style={s.close}>
              <Ionicons name="close" size={23} color={colors.secondary} />
            </Pressable>
          </View>
          {children}
        </View>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  overlay: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.overlay, padding: 20 },
  mobileOverlay: { alignItems: "stretch", justifyContent: "flex-end", padding: 0 },
  panel: { width: "100%", backgroundColor: colors.white, overflow: "hidden" },
  desktopPanel: { maxWidth: 620, height: "84%", borderRadius: 18 },
  mobilePanel: { minHeight: "85%", height: "90%", maxWidth: "100%", borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  handle: { width: 42, height: 4, alignSelf: "center", marginTop: 9, borderRadius: 2, backgroundColor: colors.divider },
  header: { minHeight: 54, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: colors.divider, paddingHorizontal: 10 },
  title: { flex: 1, textAlign: "left", color: colors.heading, fontSize: 16, fontWeight: "700" },
  close: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
});
