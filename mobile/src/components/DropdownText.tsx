import type { TextProps } from "react-native";
import { StyleSheet } from "react-native";
import { Text } from "../i18n/LocalizedText";
import { colors } from "../theme";

// Reserve space for the label beside the dropdown icon on narrow screens.
export default function DropdownText({ style, children, ...props }: TextProps) {
  return <Text {...props} style={[styles.text, style, styles.layout]}>{children}</Text>;
}
const styles = StyleSheet.create({
  text: { color: colors.heading },
  layout: { flexGrow: 1, flexShrink: 1, minWidth: 0, includeFontPadding: true, textAlignVertical: "center" },
});
export function dropdownLabel(value: string | null | undefined, placeholder: string) {
  return value?.trim() || placeholder;
}
