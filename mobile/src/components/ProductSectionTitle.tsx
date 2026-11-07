import type { ReactNode } from "react";
import { StyleSheet } from "react-native";
import { Text } from "../i18n/LocalizedText";
import { colors } from "../theme";

export default function ProductSectionTitle({ children, inverse = false }: { children: ReactNode; inverse?: boolean }) {
  return <Text accessibilityRole="header" style={[styles.title, inverse && styles.inverse]}>{children}</Text>;
}

const styles = StyleSheet.create({
  title: {
    alignSelf: "flex-start",
    flexShrink: 1,
    color: colors.heading,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  inverse: { color: colors.white },
});
