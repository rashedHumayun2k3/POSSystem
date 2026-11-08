import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState, type ReactNode } from "react";
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
  fitContent?: boolean;
  keyboardAware?: boolean;
  onShow?: () => void;
  stabilizeLayout?: boolean;
  children: ReactNode;
};

// Keep the navigation hidden until the last sheet in this provider closes.
const openSheets = new Map<(hidden: boolean) => void, number>();

export default function PopupSheet(props: Props) {
  // A fresh instance resets the measurement gate on every calendar opening.
  if (props.stabilizeLayout && !props.visible) return null;
  return <PopupSheetContent {...props} />;
}

function PopupSheetContent({ visible, onClose, title, headerAction, onShow, children, fitContent = false, keyboardAware = false, stabilizeLayout = false }: Props) {
  const panelRef = useRef<View>(null);
  const [shown, setShown] = useState(false);
  const [overlayLayout, setOverlayLayout] = useState({ width: 0, height: 0 });
  const [panelLayout, setPanelLayout] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [viewport, setViewport] = useState<{ height: number; top: number } | null>(null);
  useEffect(() => {
    if (!visible || !keyboardAware || Platform.OS !== "web" || typeof window === "undefined") return;
    const visual = window.visualViewport;
    let frame = 0;
    let timer: ReturnType<typeof setTimeout>;
    const reveal = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const panel = panelRef.current as unknown as HTMLElement | null;
        const focused = document.activeElement;
        if (focused instanceof HTMLElement && panel?.contains(focused) && focused.matches("input, textarea")) {
          focused.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
        }
      });
    };
    const update = () => { setViewport({ height: visual?.height ?? window.innerHeight, top: visual?.offsetTop ?? 0 }); reveal(); };
    const focus = () => { reveal(); clearTimeout(timer); timer = setTimeout(update, 350); };
    update();
    visual?.addEventListener("resize", update);
    visual?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    document.addEventListener("focusin", focus);
    return () => {
      cancelAnimationFrame(frame); clearTimeout(timer);
      visual?.removeEventListener("resize", update);
      visual?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      document.removeEventListener("focusin", focus);
      setViewport(null);
    };
  }, [visible, keyboardAware]);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const desktop = windowWidth >= 768;
  // Resolve the sheet width before the opening animation, rather than relying
  // on percentage sizing through the modal's initially unmeasured wrappers.
  const panelWidth = desktop ? Math.min(620, Math.max(0, windowWidth - 40)) : windowWidth;
  const insets = useSafeAreaInsets();
  const positioned = !stabilizeLayout || (shown && Math.abs(overlayLayout.width - windowWidth) <= 2 && overlayLayout.height >= windowHeight - insets.top - insets.bottom - 2 && panelLayout.height > 0 &&
    (desktop
      ? Math.abs(panelLayout.x + panelLayout.width / 2 - overlayLayout.width / 2) <= 2 && Math.abs(panelLayout.y + panelLayout.height / 2 - overlayLayout.height / 2) <= 2
      : Math.abs(panelLayout.x) <= 2 && Math.abs(panelLayout.width - overlayLayout.width) <= 2 && Math.abs(panelLayout.y + panelLayout.height - overlayLayout.height) <= 2));
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

  return <Modal visible={visible} transparent animationType={stabilizeLayout ? "none" : desktop || fitContent ? "fade" : "slide"} onRequestClose={onClose} onShow={() => { setShown(true); onShow?.(); }}>
    <KeyboardAvoidingView style={[s.fill, stabilizeLayout && StyleSheet.absoluteFillObject, keyboardAware && viewport ? { position: "absolute", top: viewport.top, left: 0, right: 0, height: viewport.height } : undefined]} behavior={Platform.OS === "ios" ? "padding" : "height"} enabled={Platform.OS === "ios" ? !desktop : keyboardAware && Platform.OS === "android"}>
      <View onLayout={stabilizeLayout ? event => setOverlayLayout(event.nativeEvent.layout) : undefined} style={[s.overlay, !desktop && s.mobileOverlay, stabilizeLayout && StyleSheet.absoluteFillObject]}>
        <View ref={panelRef} onLayout={stabilizeLayout ? event => setPanelLayout(event.nativeEvent.layout) : undefined} pointerEvents={positioned ? "auto" : "none"} accessibilityElementsHidden={!positioned} importantForAccessibility={positioned ? "auto" : "no-hide-descendants"} style={[s.panel, desktop ? s.desktopPanel : s.mobilePanel, fitContent && s.fitContent, { width: panelWidth }, stabilizeLayout && !desktop && s.anchoredPanel, keyboardAware && { minHeight: 0 }, !desktop && { paddingBottom: insets.bottom }, !positioned && s.unpositioned]}>
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
  anchoredPanel: { position: "absolute", bottom: 0, left: 0, right: 0, width: "100%" },
  unpositioned: { opacity: 0 },
  fill: { flex: 1, width: "100%", alignSelf: "stretch" },
  overlay: { flex: 1, width: "100%", alignItems: "center", justifyContent: "center", backgroundColor: colors.overlay, padding: 20 },
  mobileOverlay: { alignItems: "stretch", justifyContent: "flex-end", padding: 0 },
  panel: { width: "100%", backgroundColor: colors.white, overflow: "hidden" },
  desktopPanel: { maxWidth: 620, height: "84%", borderRadius: 18 },
  mobilePanel: { minHeight: "85%", height: "90%", maxWidth: "100%", borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  fitContent: { height: "auto", minHeight: 0, maxHeight: "90%" },
  handle: { width: 42, height: 4, alignSelf: "center", marginTop: 9, borderRadius: 2, backgroundColor: colors.divider },
  header: { minHeight: 54, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: colors.divider, paddingHorizontal: 10 },
  title: { flex: 1, textAlign: "left", color: colors.heading, fontSize: 16, fontWeight: "700" },
  close: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
});
