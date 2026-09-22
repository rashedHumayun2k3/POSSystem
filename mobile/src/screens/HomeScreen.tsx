import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { styles } from "../dashboardStyles";
type IconName = keyof typeof Ionicons.glyphMap;
const moneyCards = [
  { label: "Cash today", value: "৳18,400", icon: "cash-outline" as IconName, tone: "mint" as const },
  { label: "Customers owe", value: "৳27,500", icon: "people-outline" as IconName, tone: "blue" as const },
  { label: "I owe", value: "৳18,000", icon: "arrow-up-circle-outline" as IconName, tone: "rose" as const },
  { label: "At couriers", value: "৳12,400", icon: "bicycle-outline" as IconName, tone: "amber" as const },
];
const actions = [
  { label: "New order", icon: "receipt-outline" as IconName, color: "#4557d9" },
  { label: "POS sale", icon: "cart-outline" as IconName, color: "#12966f" },
  { label: "Purchase", icon: "cube-outline" as IconName, color: "#d58a18" },
  { label: "Add expense", icon: "wallet-outline" as IconName, color: "#d34f5b" },
];
export default function HomeScreen() {
  return <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <View style={styles.titleRow}><View><Text style={styles.title}>Today&apos;s overview</Text><Text style={styles.subtitle}>Monday, 21 September 2026</Text></View></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.moneyStrip}>
      {moneyCards.map(card => <Pressable key={card.label} style={[styles.moneyCard, styles[`money_${card.tone}`]]}><View style={styles.cardIcon}><Ionicons name={card.icon} size={19} color="#263248" /></View><Text style={styles.moneyLabel}>{card.label}</Text><Text style={styles.moneyValue}>{card.value}</Text><Text style={styles.tapHint}>View details</Text></Pressable>)}
    </ScrollView>
    <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Business today</Text><Text style={styles.sectionLink}>Full summary  ›</Text></View>
    <View style={styles.statsGrid}><Stat value="24" label="Orders today" color="#4557d9" /><Stat value="8" label="Pending orders" color="#d58a18" /><Stat value="5" label="Stock alerts" color="#d34f5b" /><Stat value="12" label="Deliveries" color="#8057b7" /></View>
    <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Quick actions</Text></View>
    <View style={styles.actionGrid}>{actions.map(action => <Pressable key={action.label} style={[styles.actionCard, { backgroundColor: action.color }]}><Ionicons name={action.icon} size={25} color="#fff" /><Text style={styles.actionLabel}>{action.label}</Text></Pressable>)}</View>
    <View style={styles.attentionHeader}><View style={styles.attentionTitle}><Ionicons name="alert-circle" size={19} color="#b66b00" /><Text style={styles.sectionTitle}>Needs attention</Text></View><Text style={styles.sectionLink}>View all</Text></View>
    <Pressable style={styles.attentionCard}><View style={styles.attentionIcon}><Ionicons name="cube-outline" size={22} color="#b66b00" /></View><View style={styles.attentionCopy}><Text style={styles.attentionHeadline}>5 products need restocking</Text><Text style={styles.attentionDetail}>2 are out of stock · 3 are running low</Text></View><Ionicons name="chevron-forward" size={19} color="#9aa3b2" /></Pressable>
    <Pressable onPress={() => router.navigate("/orders")} style={styles.attentionCard}><View style={styles.attentionIcon}><Ionicons name="time-outline" size={22} color="#b66b00" /></View><View style={styles.attentionCopy}><Text style={styles.attentionHeadline}>8 orders are waiting</Text><Text style={styles.attentionDetail}>Review and move them to packing</Text></View><Ionicons name="chevron-forward" size={19} color="#9aa3b2" /></Pressable>
  </ScrollView>;
}
function Stat({ value, label, color }: { value: string; label: string; color: string }) {
  return <View style={styles.stat}><Text style={[styles.statValue, { color }]}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}
