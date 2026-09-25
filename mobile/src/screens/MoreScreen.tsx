import { Text } from "../i18n/LocalizedText";
import { Ionicons } from "@expo/vector-icons";import * as ExpoLinking from "expo-linking";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { colors } from "../theme";

type IconName = keyof typeof Ionicons.glyphMap;
type MenuItem = { key: string; title: string; description: string; icon: IconName; roles?: string[]; webPath: string };
type ChildItem = { key: string; title: string; description: string; icon: IconName; webPath: string };
const openEnvironmentPath = (path: string) => {
  if (Platform.OS === "web" && typeof window !== "undefined") { window.location.assign(path); return; }
  void ExpoLinking.openURL(ExpoLinking.createURL(path));
};

const items: MenuItem[] = [
  { key: "pre-orders", title: "Pre-orders", description: "Reserve available stock or record waiting demand", icon: "time-outline", roles: ["OWNER", "MANAGER", "STAFF"], webPath: "/more/pre-orders" },
  { key: "partner-approvals", title: "Business Partner", description: "Review partnership and investment requests", icon: "people-outline", roles: ["PARTNER"], webPath: "/more/settings/partners" },
  { key: "categories", title: "Categories", description: "Product categories & fields", icon: "pricetag-outline", roles: ["OWNER"], webPath: "/more/categories" },
  { key: "catalog-templates", title: "Quick Add Products", description: "Add ready-made categories & products to your shop in a few taps", icon: "albums-outline", roles: ["OWNER"], webPath: "/more/catalog-templates" },
  { key: "purchases", title: "Purchases", description: "Lots & landed cost", icon: "cart-outline", roles: ["OWNER", "MANAGER", "WAREHOUSE"], webPath: "/more/purchases" },
  { key: "supplier-returns", title: "Supplier Returns", description: "Return or write off damaged goods", icon: "return-down-back-outline", roles: ["OWNER", "MANAGER"], webPath: "/more/supplier-returns" },
  { key: "storeroom", title: "Storeroom", description: "Cartons & labeling", icon: "archive-outline", roles: ["OWNER", "WAREHOUSE"], webPath: "/more/storeroom" },
  { key: "deliveries", title: "Deliveries", description: "Courier board", icon: "car-outline", roles: ["OWNER", "MANAGER", "STAFF"], webPath: "/more/deliveries" },
  { key: "expenses", title: "Expenses", description: "Costs & petty cash", icon: "wallet-outline", roles: ["OWNER", "MANAGER"], webPath: "/more/expenses" },
  { key: "reports", title: "Reports", description: "P&L, demand, couriers", icon: "bar-chart-outline", roles: ["OWNER", "MANAGER"], webPath: "/more/reports" },
  { key: "customers", title: "Customers", description: "Customer profiles", icon: "people-outline", roles: ["OWNER", "MANAGER"], webPath: "/more/customers" },
  { key: "settings", title: "Settings", description: "Staff, couriers, data", icon: "settings-outline", roles: ["OWNER", "MANAGER", "WAREHOUSE", "STAFF"], webPath: "/more/settings" },
  { key: "faq", title: "FAQ", description: "Common questions answered", icon: "help-circle-outline", webPath: "/more/faq" },
  { key: "feedback", title: "Feedback", description: "Send us your questions or issues", icon: "chatbubble-ellipses-outline", roles: ["OWNER", "MANAGER", "WAREHOUSE", "STAFF"], webPath: "/more/feedback" },
];

const reports: ChildItem[] = [
  { key: "invoices", title: "Invoices", description: "Find order invoices and receipts by order number", icon: "document-text-outline", webPath: "/more/reports/invoices" },
  { key: "dashboard", title: "Dashboard", description: "KPI cards, trends, top products", icon: "home-outline", webPath: "/more/reports/dashboard" },
  { key: "daily-closing", title: "Daily Summary Report", description: "Closing email with full PDF attachment", icon: "mail-outline", webPath: "/more/reports/daily-closing" },
  { key: "sales", title: "Sales Reports", description: "Revenue, orders, by product & category", icon: "trending-up-outline", webPath: "/more/reports/sales" },
  { key: "inventory", title: "Inventory Reports", description: "Stock levels, low stock, movements", icon: "cube-outline", webPath: "/more/reports/inventory" },
  { key: "financial", title: "Financial Reports", description: "P&L, gross profit, expenses", icon: "cash-outline", webPath: "/more/reports/financial" },
  { key: "orders", title: "Order Reports", description: "Status breakdown, returns, channels", icon: "receipt-outline", webPath: "/more/reports/orders" },
  { key: "stock-valuation", title: "Stock Valuation", description: "Stock value, potential & realized profit by category", icon: "scale-outline", webPath: "/more/reports/stock-valuation" },
];

const baseSettings: ChildItem[] = [
  { key: "staff", title: "Staff", description: "Manage users & roles", icon: "people-outline", webPath: "/more/settings/staff" },
  { key: "couriers", title: "Couriers", description: "Courier companies", icon: "car-outline", webPath: "/more/settings/couriers" },
  { key: "expense-categories", title: "Expense Categories", description: "Types of business expenses", icon: "pricetag-outline", webPath: "/more/settings/expense-categories" },
  { key: "config", title: "Business Config", description: "Margin, overhead, thresholds", icon: "options-outline", webPath: "/more/settings/config" },
];
const ownerSettings: ChildItem[] = [
  { key: "shop-type", title: "Shop Type", description: "Change how you sell — Supershop, Small Shop, or Hawker", icon: "storefront-outline", webPath: "/more/settings/shop-type" },
  { key: "branches", title: "Branches", description: "Manage shop locations", icon: "business-outline", webPath: "/more/settings/branches" },
  { key: "partners", title: "Business Partner", description: "Capital & profit sharing", icon: "hand-left-outline", webPath: "/more/settings/partners" },
  { key: "subscription", title: "Subscription", description: "Plan, billing & payment history", icon: "card-outline", webPath: "/more/settings/subscription" },
  { key: "storefront", title: "Storefront", description: "Control your public marketplace listing", icon: "globe-outline", webPath: "/more/settings/storefront" },
];

function includes(item: { title: string; description: string }, query: string) {
  return `${item.title} ${item.description}`.toLocaleLowerCase().includes(query);
}

export default function MoreScreen() {
  const auth = useAuth();
  const router = useRouter();
  const role = (auth.session?.user.role || "STAFF").toUpperCase();
  const [search, setSearch] = useState("");
  const [reportsOpen, setReportsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const query = search.trim().toLocaleLowerCase();
  const settings = role === "OWNER" ? [...baseSettings, ...ownerSettings] : baseSettings;
  const visibleReports = reports.filter(item => !query || includes(item, query));
  const visibleSettings = settings.filter(item => !query || includes(item, query));
  const visibleItems = useMemo(() => items.filter(item => {
    if (item.roles && !item.roles.includes(role)) return false;
    if (!query || includes(item, query)) return true;
    if (item.key === "reports") return visibleReports.length > 0;
    if (item.key === "settings") return visibleSettings.length > 0;
    return false;
  }), [query, role, visibleReports.length, visibleSettings.length]);

  const openChild = (item: ChildItem) => {
    if (item.key === "staff") return router.push("/more/settings/staff");
    if (item.key === "couriers") return router.push("/more/settings/couriers");
    if (item.key === "expense-categories") return router.push("/more/settings/expense-categories");
    if (item.key === "config") return router.push("/more/settings/config");
    if (item.key === "shop-type") return router.push("/more/settings/shop-type");
    if (item.key === "branches") return router.push("/more/settings/branches");
    if (item.key === "partners") return router.push("/more/settings/partners");
    if (item.key === "subscription") return router.push("/more/settings/subscription");
    if (item.key === "dashboard") return router.push("/more/reports/dashboard");
    if (item.key === "invoices") return router.push("/more/reports/invoices");
    if (item.key === "daily-closing") return router.push("/more/reports/daily-closing");
    if (item.key === "sales") return router.push("/more/reports/sales");
    if (item.key === "inventory") return router.push("/more/reports/inventory");
    if (item.key === "financial") return router.push("/more/reports/financial");
    if (item.key === "orders") return router.push("/more/reports/orders");
    if (item.key === "stock-valuation") return router.push("/more/reports/stock-valuation");
    openEnvironmentPath(item.webPath);
  };
  const openMenu = (item: MenuItem) => {
    if (item.key === "pre-orders") return router.push("/more/pre-orders");
    if (item.key === "reports") return setReportsOpen(value => !value);
    if (item.key === "settings") return setSettingsOpen(value => !value);
    if (item.key === "categories") return router.push("/more/categories");
    if (item.key === "catalog-templates") return router.push("/more/catalog-templates");
    if (item.key === "purchases") return router.push("/more/purchases");
    if (item.key === "deliveries") return router.push("/more/deliveries");
    if (item.key === "expenses") return router.push("/more/expenses");
    if (item.key === "customers") return router.push("/more/customers");
    openEnvironmentPath(item.webPath);
  };

  return <ScrollView style={s.screen} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
    <View style={s.searchBox}>
      <Ionicons name="search-outline" size={21} color={colors.muted} />
      <TextInput value={search} onChangeText={setSearch} placeholder="Search menus..." placeholderTextColor={colors.muted} style={s.searchInput} returnKeyType="search" />
      {!!search && <Pressable onPress={() => setSearch("")} hitSlop={10} accessibilityLabel="Clear search"><Ionicons name="close" size={22} color={colors.secondary} /></Pressable>}
    </View>
    {!visibleItems.length && <View style={s.empty}><Text style={s.emptyText}>No menus found. Try a different search.</Text></View>}
    {visibleItems.map(item => {
      const expandable = item.key === "reports" || item.key === "settings";
      const expanded = query ? true : item.key === "reports" ? reportsOpen : item.key === "settings" ? settingsOpen : false;
      const children = item.key === "reports" ? visibleReports : visibleSettings;
      return <View key={item.key} style={[s.card, expandable && s.accordion]}>
        <Pressable onPress={() => openMenu(item)} disabled={!!query && expandable} style={({ pressed }) => [s.row, pressed && !query && s.pressed]}>
          <View style={[s.iconBox, expandable && s.accordionIcon]}><Ionicons name={item.icon} size={21} color={colors.primaryDark} /></View>
          <View style={s.copy}><Text style={s.title}>{item.title}</Text><Text numberOfLines={2} style={s.description}>{item.description}</Text></View>
          <Ionicons name={expanded && expandable ? "chevron-down" : "chevron-forward"} size={17} color={colors.muted} />
        </Pressable>
        {expandable && expanded && <View style={s.children}>
          {children.map(child => <Pressable key={child.key} onPress={() => openChild(child)} style={({ pressed }) => [s.child, pressed && s.childPressed]}>
            <View style={s.childIcon}><Ionicons name={child.icon} size={19} color={colors.primaryDark} /></View>
            <View style={s.copy}><Text style={s.childTitle}>{child.title}</Text><Text style={s.description}>{child.description}</Text></View>
            <Ionicons name="chevron-forward" size={16} color={colors.muted} />
          </Pressable>)}
        </View>}
      </View>;
    })}
  </ScrollView>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 24, gap: 12 },
  searchBox: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  searchInput: { flex: 1, paddingVertical: 12, color: colors.heading, fontSize: 14, outlineStyle: "none" } as never,
  empty: { borderRadius: 16, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.card, paddingHorizontal: 16, paddingVertical: 30 },
  emptyText: { textAlign: "center", fontSize: 14, color: colors.secondary },
  card: { overflow: "hidden", borderRadius: 16, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.card },
  accordion: { borderColor: colors.border, backgroundColor: colors.primaryLight },
  row: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 10 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  iconBox: { width: 40, height: 40, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: colors.cardSecondary },
  accordionIcon: { backgroundColor: colors.border },
  copy: { flex: 1, minWidth: 0 },
  title: { color: colors.heading, fontSize: 14, fontWeight: "700" },
  description: { marginTop: 2, color: colors.muted, fontSize: 12, lineHeight: 16 },
  children: { gap: 8, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.primary, padding: 10 },
  child: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardSecondary, paddingHorizontal: 12, paddingVertical: 9 },
  childPressed: { opacity: 0.78 },
  childIcon: { width: 36, height: 36, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: colors.primaryLight },
  childTitle: { color: colors.heading, fontSize: 13, fontWeight: "700" },
});
