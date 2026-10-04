import { Text } from "../i18n/LocalizedText";
import type { TextProps } from "react-native";
import { StyleSheet } from "react-native";
import { colors } from "../theme";

export default function PageTitle({ style, ...props }: TextProps) {
  return <Text {...props} style={[style, s.title]} />;
}

const s = StyleSheet.create({
  title: { color: colors.heading, fontSize: 17, fontWeight: "400" },
});
