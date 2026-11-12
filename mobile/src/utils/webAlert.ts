import { Alert, Platform } from "react-native";

// react-native-web's Alert.alert does nothing, so delete/deactivate confirmations never opened in
// the browser. On web, map it to the browser's own alert/confirm dialogs.
if (Platform.OS === "web" && typeof window !== "undefined") {
  Alert.alert = (title, message, buttons) => {
    const text = [title, message].filter(Boolean).join("\n\n");
    if (!buttons || buttons.length <= 1) {
      window.alert(text);
      buttons?.[0]?.onPress?.();
      return;
    }
    const cancel = buttons.find(b => b.style === "cancel");
    const action = buttons.find(b => b !== cancel && b.style === "destructive") ?? buttons.find(b => b !== cancel);
    if (window.confirm(text)) action?.onPress?.();
    else cancel?.onPress?.();
  };
}
