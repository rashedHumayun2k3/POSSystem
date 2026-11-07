import { StyleSheet, View, useWindowDimensions, type ViewProps } from "react-native";

// Apply at both levels: a 100% input cannot escape a half-width parent.
export function DateRangeRow({ style, ...props }: ViewProps) {
  const mobile = useWindowDimensions().width < 768;
  return <View {...props} style={[style, mobile && styles.row]} />;
}
export function DateFieldColumn({ style, ...props }: ViewProps) {
  const mobile = useWindowDimensions().width < 768;
  return <View {...props} style={[style, mobile && styles.field]} />;
}
const styles = StyleSheet.create({
  row: { flexDirection: "column", alignItems: "stretch", width: "100%" },
  field: { flex: 0, flexGrow: 0, flexShrink: 0, flexBasis: "auto", width: "100%", minWidth: 0, maxWidth: "100%", alignSelf: "stretch" },
});
