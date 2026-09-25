import { Text } from "../src/i18n/LocalizedText";
import { colors } from "../src/theme";
import * as ExpoLinking from "expo-linking";
import { useState } from "react";
import { Stack, Link, usePathname, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { Image, Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import AppHeader from "../src/components/AppHeader";
import { AuthProvider, useAuth } from "../src/auth/AuthContext";import { LanguageProvider, useLanguage } from "../src/i18n/LanguageContext";
import LoginScreen from "../src/auth/LoginScreen";
import { ActivityIndicator } from "react-native";

const APP_BACKGROUND = colors.background;

const tabs = [
  { label: "Home", icon: "home", href: "/" },
  { label: "Orders", icon: "receipt", href: "/orders" },
  { label: "POS", icon: "cart", href: "/sale" },
  { label: "Products", icon: "cube", href: "/products" },
] as const;

type MoreNavItem = { key: string; label: string; icon: keyof typeof Ionicons.glyphMap; roles?: string[]; route?: "/" | "/orders" | "/products" | "/more/categories" };
type QuickAction = { key: string; label: string; hint: string; icon: keyof typeof Ionicons.glyphMap; roles?: string[] };
const quickActions: QuickAction[] = [
  { key: "pre-order", label: "Add Pre-order", hint: "Reserve or request stock", icon: "time-outline", roles: ["OWNER", "MANAGER", "STAFF"] },
  { key: "sale", label: "Add Sale", hint: "Open POS", icon: "cart-outline" },
  { key: "order", label: "Add Order", hint: "Create customer order", icon: "receipt-outline" },
  { key: "product", label: "Add Product", hint: "Create catalog item", icon: "cube-outline", roles: ["OWNER"] },
  { key: "purchase", label: "Add Purchase", hint: "Start purchase order", icon: "bag-add-outline", roles: ["OWNER", "MANAGER", "WAREHOUSE"] },
  { key: "expense", label: "Add Expense", hint: "Record business cost", icon: "wallet-outline", roles: ["OWNER", "MANAGER"] },
  { key: "customer", label: "Add Customer", hint: "Through a new order", icon: "person-add-outline" },
  { key: "supplier", label: "Add Supplier", hint: "Through a purchase", icon: "business-outline", roles: ["OWNER", "MANAGER", "WAREHOUSE"] },
  { key: "category", label: "Add Category", hint: "Organize products", icon: "pricetag-outline", roles: ["OWNER"] },
];
const moreItems: MoreNavItem[] = [
  { key: "pre-orders", label: "Pre-orders", icon: "time-outline", roles: ["OWNER", "MANAGER", "STAFF"] },
  { key: "categories", label: "Categories", icon: "pricetag-outline", roles: ["OWNER"], route: "/more/categories" },
  { key: "quick-add", label: "Quick Add Products", icon: "albums-outline", roles: ["OWNER"] },
  { key: "purchases", label: "Purchases", icon: "cart-outline", roles: ["OWNER", "MANAGER", "WAREHOUSE"] },
  { key: "supplier-returns", label: "Supplier Returns", icon: "return-down-back-outline", roles: ["OWNER", "MANAGER"] },
  { key: "storeroom", label: "Storeroom", icon: "archive-outline", roles: ["OWNER", "WAREHOUSE"] },
  { key: "deliveries", label: "Deliveries", icon: "car-outline", roles: ["OWNER", "MANAGER", "STAFF"] },
  { key: "expenses", label: "Expenses", icon: "wallet-outline", roles: ["OWNER", "MANAGER"] },
  { key: "reports", label: "Reports", icon: "bar-chart-outline", roles: ["OWNER", "MANAGER"] },
  { key: "customers", label: "Customers", icon: "people-outline", roles: ["OWNER", "MANAGER"] },
  { key: "settings", label: "Settings", icon: "settings-outline", roles: ["OWNER", "MANAGER", "WAREHOUSE", "STAFF"] },
  { key: "faq", label: "FAQ", icon: "help-circle-outline" },
  { key: "feedback", label: "Feedback", icon: "chatbubble-ellipses-outline", roles: ["OWNER", "MANAGER", "WAREHOUSE", "STAFF"] },
];
const reportItems: MoreNavItem[] = [
  { key: "report-dashboard", label: "Dashboard", icon: "home-outline", route: "/" },
  { key: "report-invoices", label: "Invoices", icon: "document-text-outline" },
  { key: "report-daily", label: "Daily Summary", icon: "mail-outline" },
  { key: "report-sales", label: "Sales Reports", icon: "trending-up-outline" },
  { key: "report-inventory", label: "Inventory Reports", icon: "cube-outline", route: "/products" },
  { key: "report-financial", label: "Financial Reports", icon: "cash-outline" },
  { key: "report-orders", label: "Order Reports", icon: "receipt-outline", route: "/orders" },
  { key: "report-stock-valuation", label: "Stock Valuation", icon: "scale-outline" },
];
const basicSettings: MoreNavItem[] = [
  { key: "staff", label: "Staff", icon: "people-outline" },
  { key: "couriers", label: "Couriers", icon: "car-outline" },
  { key: "expense-categories", label: "Expense Categories", icon: "pricetag-outline" },
  { key: "business-config", label: "Business Config", icon: "options-outline" },
];
const ownerSettings: MoreNavItem[] = [
  { key: "shop-type", label: "Shop Type", icon: "storefront-outline" },
  { key: "branches", label: "Branches", icon: "business-outline" },
  { key: "partners", label: "Business Partner", icon: "hand-left-outline" },
  { key: "subscription", label: "Subscription", icon: "card-outline" },
  { key: "storefront", label: "Storefront", icon: "globe-outline" },
];
const openEnvironmentPath = (path: string) => {
  if (Platform.OS === "web" && typeof window !== "undefined") { window.location.assign(path); return; }
  void ExpoLinking.openURL(ExpoLinking.createURL(path));
};
const frontendPaths: Record<string, string> = {
  "pre-orders": "/more/pre-orders",
  "quick-add": "/more/catalog-templates", purchases: "/more/purchases", "supplier-returns": "/more/supplier-returns", storeroom: "/more/storeroom", deliveries: "/more/deliveries", expenses: "/more/expenses", baki: "/more/baki", customers: "/more/customers", faq: "/more/faq", feedback: "/more/feedback",
  "report-dashboard": "/more/reports/dashboard", "report-invoices": "/more/reports/invoices", "report-daily": "/more/reports/daily-closing", "report-sales": "/more/reports/sales", "report-inventory": "/more/reports/inventory", "report-financial": "/more/reports/financial", "report-orders": "/more/reports/orders", "report-stock-valuation": "/more/reports/stock-valuation",
  staff: "/more/settings/staff", couriers: "/more/settings/couriers", "expense-categories": "/more/settings/expense-categories", "business-config": "/more/settings/config", "shop-type": "/more/settings/shop-type", branches: "/more/settings/branches", partners: "/more/settings/partners", subscription: "/more/settings/subscription", storefront: "/more/settings/storefront", "external-orders": "/more/settings/external-orders",
};

function AppShell() {
  const auth = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const path = usePathname();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const showSidebar = width >= 768;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const role = (auth.session?.user.role || "STAFF").toUpperCase();
  if (!auth.ready) return <View style={[s.shell, { justifyContent: "center" }]}><ActivityIndicator color={colors.primary} /></View>;
  if (!auth.session?.branchId) return <SafeAreaView style={s.shell}><StatusBar style="dark" /><LoginScreen /></SafeAreaView>;
  const mobileTab = (tab: typeof tabs[number]) => {
    const href = tab.href;
    const active = href === "/" ? path === "/" : path.startsWith(href);
    const icon = `${tab.icon}${active ? "" : "-outline"}` as keyof typeof Ionicons.glyphMap;
    return <Link key={tab.label} href={href} accessibilityLabel={t(tab.label)} asChild>
      <Pressable accessibilityState={{ selected: active }} style={s.tab}>
      <View style={[s.icon, active && s.activeIcon]}><Ionicons name={icon} size={23} color={active ? colors.primary : colors.neutralIcon} /></View>
      <Text style={[s.label, active && s.activeLabel]}>{t(tab.label)}</Text>
      </Pressable>
    </Link>;
  };
  const mobileBottomNavigation = <>{mobileTab(tabs[0])}{mobileTab(tabs[1])}<Pressable onPress={()=>setQuickActionsOpen(true)} accessibilityRole="button" accessibilityLabel="Create new" style={s.createTab}><View style={s.createButton}><Ionicons name="add" size={29} color={colors.white} /></View><Text style={s.createLabel}>{t("Add")}</Text></Pressable>{mobileTab(tabs[2])}{mobileTab(tabs[3])}</>;
  const desktopPrimaryNavigation = tabs.map(tab => {
    const href = tab.href;
    const active = href === "/" ? path === "/" : path.startsWith(href);
    const icon = `${tab.icon}${active ? "" : "-outline"}` as keyof typeof Ionicons.glyphMap;
    return <Link key={tab.label} href={href} accessibilityLabel={t(tab.label)} asChild>
      <Pressable accessibilityState={{ selected: active }} style={StyleSheet.flatten([s.moreRow, active ? s.activeMoreRow : undefined])}>
        <Ionicons name={icon} size={19} color={active ? colors.primaryDark : colors.neutralIcon} /><Text style={[s.moreLabel, active && s.activeMoreLabel]}>{t(tab.label)}</Text>
      </Pressable>
    </Link>;
  });
  const openMoreItem = (item: MoreNavItem) => {
    setDrawerOpen(false);
    if (item.key === "categories") return router.push("/more/categories");
    if (item.key === "quick-add") return router.push("/more/catalog-templates");
    if (item.key === "purchases") return router.push("/more/purchases");
    const webPath = frontendPaths[item.key];
    if (webPath) return openEnvironmentPath(webPath);
    return item.route ? router.push(item.route) : router.push({ pathname: "/more", params: { focus: item.key } });
  };
  const openQuickAction=(key:string)=>{setQuickActionsOpen(false);if(key==="pre-order")return openEnvironmentPath("/more/pre-orders");if(key==="sale")return router.push("/sale");if(key==="order"||key==="customer")return router.push("/orders/new");if(key==="purchase"||key==="supplier")return router.push("/more/purchases/new");if(key==="category")return router.push({pathname:"/more/categories",params:{new:"1"}});if(key==="product")return openEnvironmentPath("/products/new");if(key==="expense")return openEnvironmentPath("/more/expenses/new")};
  const itemPath = (item: MoreNavItem) => item.key === "categories" ? "/more/categories" : item.key === "quick-add" ? "/more/catalog-templates" : item.key === "purchases" ? "/more/purchases" : frontendPaths[item.key] ?? item.route;
  const itemActive = (item: MoreNavItem) => { const target = itemPath(item); return !!target && (target === "/" ? path === "/" : path === target || path.startsWith(`${target}/`)); };
  const moreRows = (entries: MoreNavItem[], nested = false) => entries.map(item => { const active=itemActive(item); return <Pressable key={item.key} accessibilityState={{selected:active}} onPress={() => openMoreItem(item)} style={({ pressed }) => [s.moreRow, nested && s.nestedRow, active&&s.activeMoreRow, pressed && s.pressed]}>
    <Ionicons name={item.icon} size={nested ? 17 : 19} color={active?colors.primaryDark:colors.neutralIcon} />
    <Text numberOfLines={1} style={[s.moreLabel, nested && s.nestedLabel,active&&s.activeMoreLabel]}>{t(item.label)}</Text>
  </Pressable>;});
  const visibleMoreItems = moreItems.filter(item => !item.roles || item.roles.includes(role));
  const morePanel = <View style={s.moreList}>
    {visibleMoreItems.map(item => {
      if (item.key === "reports") return <View key={item.key}>
        <Pressable onPress={() => setReportsOpen(value => !value)} style={({ pressed }) => [s.moreRow,path.startsWith("/more/reports")&&s.activeMoreRow, pressed && s.pressed]}><Ionicons name={item.icon} size={19} color={path.startsWith("/more/reports")?colors.primaryDark:colors.neutralIcon} /><Text style={[s.moreLabel,path.startsWith("/more/reports")&&s.activeMoreLabel]}>{t(item.label)}</Text><Ionicons name={reportsOpen ? "chevron-down" : "chevron-forward"} size={14} color={path.startsWith("/more/reports")?colors.primaryDark:colors.muted} /></Pressable>
        {reportsOpen && <View style={s.nestedList}>{moreRows(reportItems, true)}</View>}
      </View>;
      if (item.key === "settings") {
        const settings = role === "OWNER" ? [...basicSettings, ...ownerSettings] : basicSettings;
        return <View key={item.key}>
          <Pressable onPress={() => setSettingsOpen(value => !value)} style={({ pressed }) => [s.moreRow,path.startsWith("/more/settings")&&s.activeMoreRow, pressed && s.pressed]}><Ionicons name={item.icon} size={19} color={path.startsWith("/more/settings")?colors.primaryDark:colors.neutralIcon} /><Text style={[s.moreLabel,path.startsWith("/more/settings")&&s.activeMoreLabel]}>{t(item.label)}</Text><Ionicons name={settingsOpen ? "chevron-down" : "chevron-forward"} size={14} color={path.startsWith("/more/settings")?colors.primaryDark:colors.muted} /></Pressable>
          {settingsOpen && <View style={s.nestedList}>{moreRows(settings, true)}</View>}
        </View>;
      }
      return moreRows([item]);
    })}
  </View>;
  return <SafeAreaView style={s.shell} edges={["top", "left", "right"]}>
    <StatusBar style="dark" />
    <AppHeader onMenuPress={() => setDrawerOpen(true)} />
    <View style={s.mainRow}>
      {showSidebar ? <View style={[s.sidebar, { width: 216 }]}><ScrollView contentContainerStyle={s.sidebarContent} showsVerticalScrollIndicator={false}>{desktopPrimaryNavigation}{morePanel}</ScrollView></View> : null}
      <View style={s.screen}><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: APP_BACKGROUND } }} /></View>
    </View>
    {!showSidebar ? <View style={[s.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>{mobileBottomNavigation}</View> : null}
    {!showSidebar&&<Modal visible={quickActionsOpen} transparent animationType="slide" onRequestClose={()=>setQuickActionsOpen(false)}><Pressable onPress={()=>setQuickActionsOpen(false)} style={s.quickOverlay}><Pressable onPress={event=>event.stopPropagation()} style={[s.quickSheet,{paddingBottom:Math.max(insets.bottom,16)}]}><View style={s.quickHandle}/><View style={s.quickHeader}><View><Text style={s.quickTitle}>{t("Create New")}</Text><Text style={s.quickSubtitle}>{t("Choose what you want to add")}</Text></View><Pressable onPress={()=>setQuickActionsOpen(false)} style={s.quickClose}><Ionicons name="close" size={21} color={colors.secondary}/></Pressable></View><View style={s.quickGrid}>{quickActions.filter(action=>!action.roles||action.roles.includes(role)).map(action=><Pressable key={action.key} onPress={()=>openQuickAction(action.key)} style={({pressed})=>[s.quickAction,pressed&&s.pressed]}><View style={s.quickActionIcon}><Ionicons name={action.icon} size={21} color={colors.primaryDark}/></View><View style={s.quickActionCopy}><Text style={s.quickActionLabel}>{t(action.label)}</Text><Text numberOfLines={1} style={s.quickActionHint}>{t(action.hint)}</Text></View></Pressable>)}</View></Pressable></Pressable></Modal>}
    {!showSidebar&&<Modal visible={drawerOpen} transparent animationType="fade" onRequestClose={()=>setDrawerOpen(false)}><View style={s.drawerScene}><Pressable accessibilityLabel="Close navigation" onPress={()=>setDrawerOpen(false)} style={s.drawerDismiss}/><SafeAreaView style={s.drawer} edges={["top","bottom"]}><View style={s.drawerHeader}><Image source={require("../assets/logo.png")} resizeMode="contain" style={s.drawerLogo}/><Pressable accessibilityRole="button" accessibilityLabel="Close navigation" onPress={()=>setDrawerOpen(false)} style={s.drawerClose}><Ionicons name="close" size={23} color={colors.secondary}/></Pressable></View><View style={s.drawerTitleRow}><View><Text style={s.drawerTitle}>{t("Navigation")}</Text><Text style={s.drawerSubtitle}>{t("Manage your business")}</Text></View></View><ScrollView contentContainerStyle={s.drawerContent} showsVerticalScrollIndicator={false}>{morePanel}</ScrollView></SafeAreaView></View></Modal>}
  </SafeAreaView>;
}

export default function RootLayout() {
  return <SafeAreaProvider style={s.background}><LanguageProvider><AuthProvider><AppShell /></AuthProvider></LanguageProvider></SafeAreaProvider>;
}

const s = StyleSheet.create({
  background: { flex: 1, backgroundColor: APP_BACKGROUND },
  shell: { flex: 1, width: "100%", maxWidth: 1024, alignSelf: "center", backgroundColor: APP_BACKGROUND },
  mainRow: { flex: 1, minHeight: 0, flexDirection: "row" },
  screen: { flex: 1, minHeight: 0 },
  bar: { flexDirection: "row", paddingTop: 8, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.divider },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3, minHeight: 53 },
  icon: { width: 42, height: 30, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  activeIcon: { backgroundColor: colors.primaryLight },
  label: { fontSize: 10, color: colors.muted, fontWeight: "600" },
  activeLabel: { color: colors.primary },
  createTab: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2, minHeight: 53 },
  createButton: { width: 48, height: 48, marginTop: -25, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary, borderWidth: 4, borderColor: colors.white, shadowColor: colors.heading, shadowOpacity: 0.18, shadowRadius: 7, shadowOffset: { width: 0, height: 3 }, elevation: 6 },
  createLabel: { color: colors.muted, fontSize: 9, fontWeight: "600" },
  sidebar: { flexShrink: 0, borderRightWidth: 1, borderRightColor: colors.divider, backgroundColor: colors.white, zIndex: 5 },
  sidebarContent: { paddingHorizontal: 10, paddingTop: 12, paddingBottom: 20 },
  sideTab: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  sideContent: { width: "100%", flexDirection: "row", alignItems: "center", gap: 10 },
  activeSideTab: { backgroundColor: colors.primary },
  sideIcon: { width: 40, height: 36, flexShrink: 0 },
  sideLabel: { fontSize: 14, color: colors.neutralIcon },
  sideActiveLabel: { color: colors.white },
  pressed: { opacity: 0.75 },
  moreList: { marginTop: 2 },
  moreRow: { minHeight: 38, flexDirection: "row", alignItems: "center", gap: 8, borderBottomWidth: 1, borderBottomColor: colors.divider, paddingHorizontal: 9, paddingVertical: 5 },
  moreLabel: { flex: 1, color: colors.heading, fontSize: 12, fontWeight: "600" },
  activeMoreRow: { backgroundColor: colors.primaryLight, borderBottomColor: colors.border, borderRadius: 8 },
  activeMoreLabel: { color: colors.primaryDark, fontWeight: "700" },
  nestedList: { marginLeft: 12, borderLeftWidth: 1, borderLeftColor: colors.border, paddingLeft: 5 },
  nestedRow: { minHeight: 34, paddingLeft: 8, paddingVertical: 4, borderBottomColor: colors.disabled },
  nestedLabel: { color: colors.secondary, fontSize: 11 },
  drawerScene: { flex: 1, flexDirection: "row", backgroundColor: colors.overlay },
  drawerDismiss: { ...StyleSheet.absoluteFillObject },
  drawer: { width: "86%", maxWidth: 340, height: "100%", backgroundColor: colors.white, shadowColor: colors.heading, shadowOpacity: 0.24, shadowRadius: 18, shadowOffset: { width: 6, height: 0 }, elevation: 12 },
  drawerHeader: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: colors.divider, paddingHorizontal: 14 },
  drawerLogo: { width: 142, height: 42 },
  drawerClose: { marginLeft: "auto", width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: colors.cardSecondary },
  drawerTitleRow: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 7 },
  drawerTitle: { color: colors.heading, fontSize: 17, fontWeight: "800" },
  drawerSubtitle: { color: colors.muted, fontSize: 10, marginTop: 3 },
  drawerContent: { paddingHorizontal: 10, paddingBottom: 24 },
  quickOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: colors.overlay },
  quickSheet: { width: "100%", borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: colors.white, paddingHorizontal: 14, paddingTop: 9 },
  quickHandle: { width: 40, height: 4, alignSelf: "center", borderRadius: 2, backgroundColor: colors.divider, marginBottom: 9 },
  quickHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 2, paddingBottom: 12 },
  quickTitle: { color: colors.heading, fontSize: 16, fontWeight: "800" },
  quickSubtitle: { color: colors.muted, fontSize: 10, marginTop: 3 },
  quickClose: { marginLeft: "auto", width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: colors.cardSecondary },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  quickAction: { width: "48.7%", minHeight: 62, flexDirection: "row", alignItems: "center", gap: 9, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.cardSecondary, paddingHorizontal: 10, paddingVertical: 9 },
  quickActionIcon: { width: 36, height: 36, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: colors.primaryLight },
  quickActionCopy: { flex: 1, minWidth: 0 },
  quickActionLabel: { color: colors.heading, fontSize: 11, fontWeight: "700" },
  quickActionHint: { color: colors.muted, fontSize: 8, marginTop: 3 },
});
