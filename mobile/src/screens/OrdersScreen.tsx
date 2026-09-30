import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../auth/AuthContext";
import { colors } from "../theme";
import {
  channelLabel,
  channels,
  emptyFilters,
  filterOrders,
  groupOrders,
  hasStockIssue,
  matchesQueue,
  money,
  queueFor,
  queues,
  validDate,
  type Filters,
  type Order,
  type Queue,
} from "../orders/model";

type ApiOrder = {
  id: string; orderNo: string; channel: string; customerName: string; customerPhone: string | null;
  customerAddress: string | null; orderStatus: string; fulfillmentStatus: string; paymentStatus: string;
  isDraft: boolean; isRevised: boolean; totalAmount: number; dueAmount: number; businessDate: string;
  handlingUserName?: string | null; trackingNo?: string | null;
  items: { productName: string; variantSku: string; qty: number; availableStock: number }[];
};
type Icon = keyof typeof Ionicons.glyphMap;
const PAGE_SIZE = 10;
function Button({
  label,
  onPress,
  icon,
  primary = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  icon?: Icon;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        primary && s.primary,
        (pressed || disabled) && { opacity: disabled ? 0.4 : 0.75 },
      ]}
    >
      {icon && (
        <Ionicons name={icon} size={17} color={primary ? colors.white : colors.primary} />
      )}
      <Text style={[s.buttonText, primary && { color: colors.white }]}>{label}</Text>
    </Pressable>
  );
}
export function Sheet({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal transparent animationType="fade" onRequestClose={close}>
      <View style={s.overlay}>
        <SafeAreaView style={s.sheet} accessibilityViewIsModal>
          <View style={s.sheetHeader}>
            <Text accessibilityRole="header" style={s.sectionTitle}>
              {title}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={close}
              style={s.close}
            >
              <Ionicons name="close" size={24} color={colors.secondary} />
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={s.sheetBody}
          >
            {children}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
function Status({ order }: { order: Order }) {
  const issue = hasStockIssue(order);
  const queue = queues.find(
    (item) => item.key === (issue ? "ISSUES" : queueFor(order)),
  )!;
  return (
    <View style={s.wrap}>
      <Text
        style={[
          s.badge,
          { color: queue.color, backgroundColor: `${queue.color}12` },
        ]}
      >
        {issue ? "⚠ Stock Issue" : queue.label}
      </Text>
      {!order.isDraft && (
        <Text style={s.badge}>{order.paymentStatus.replaceAll("_", " ")}</Text>
      )}
      {order.isRevised && (
        <Text style={[s.small, { color: colors.warningText }]}>Revised</Text>
      )}
    </View>
  );
}
export default function OrdersScreen() {
  const auth = useAuth();
  const apiRef = useRef(auth.api); apiRef.current = auth.api;
  const params = useLocalSearchParams<{ tab?: string }>();
  const activeTab: Queue = queues.some((item) => item.key === params.tab)
    ? (params.tab as Queue)
    : "UNFULFILLED";
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [draft, setDraft] = useState<Filters>(emptyFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [page, setPage] = useState(1);
  const [width, setWidth] = useState(0);
  const list = useRef<ScrollView>(null);
  useFocusEffect(useCallback(() => {
    let active = true;
    setPage(1);
    setLoading(true);
    setError("");
    apiRef.current<ApiOrder[]>("/orders")
      .then(rows => {
        if (!active) return;
        setOrders((rows || []).map(row => ({
          ...row,
          customerPhone: row.customerPhone || "",
          customerAddress: row.customerAddress || "",
          orderStatus: row.orderStatus as Order["orderStatus"],
          fulfillmentStatus: row.fulfillmentStatus as Order["fulfillmentStatus"],
          paymentStatus: row.paymentStatus as Order["paymentStatus"],
          items: Array.isArray(row.items) ? row.items : [],
        })));
      })
      .catch(e => { if (active) setError((e as Error).message || "Could not load orders."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [auth.session?.businessId, auth.session?.branchId, reload]));
  const filtered = filterOrders(orders, search, filters);
  const visible = filtered.filter((order) => matchesQueue(order, activeTab));
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const groups = groupOrders(
    visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    activeTab,
  );
  const count = (queue: Queue) =>
    filtered.filter((order) => matchesQueue(order, queue)).length;
  const filterCount = Object.values(filters).filter(Boolean).length;
  const dateError =
    !validDate(draft.from) || !validDate(draft.to)
      ? "Use a valid date in YYYY-MM-DD format."
      : draft.from && draft.to && draft.from > draft.to
        ? "End date must be on or after the start date."
        : "";
  const changeTab = (tab: Queue) => {
    router.setParams({ tab });
    setPage(1);
  };
  const clear = () => {
    setFilters(emptyFilters);
    setSearch("");
    setPage(1);
  };
  const pageTo = (next: number) => {
    setPage(next);
    list.current?.scrollTo({ y: 0, animated: true });
  };
  const dateLabel = (date: string) =>
    new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  const quickDates = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days + 1);
    const localDate = (value: Date) =>
      `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
    setDraft({ ...draft, from: localDate(start), to: localDate(end) });
  };

  return (
    <View
      style={s.root}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      <ScrollView
        ref={list}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={loading && orders.length > 0} onRefresh={() => setReload(value => value + 1)} colors={[colors.primary]} tintColor={colors.primary} />}
      >
        <View style={s.heading}>
          <View style={s.grow}>
            <Text accessibilityRole="header" style={s.title}>
              Orders
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              showSearch ? "Hide search panel" : "Show search panel"
            }
            accessibilityState={{ expanded: showSearch }}
            onPress={() => setShowSearch(!showSearch)}
            style={s.toggle}
          >
            <Ionicons name="search-outline" size={21} color={colors.primary} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Filters${filterCount ? ` (${filterCount} active)` : ""}`}
            onPress={() => {
              setDraft({ ...filters });
              setShowFilters(true);
            }}
            style={s.toggle}
          >
            <Ionicons name="options-outline" size={21} color={colors.primary} />
            {filterCount > 0 && (
              <Text style={s.filterCount}>{filterCount}</Text>
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create new order"
            onPress={() => router.push("/orders/new")}
            style={[s.toggle, s.newOrderButton]}
          >
            <Ionicons name="add" size={23} color={colors.white} />
          </Pressable>
        </View>
        {showSearch && (
          <View style={s.tools}>
            <View style={s.searchRow}>
              <View style={[s.search, searchFocused && s.searchFocused]}>
                <Ionicons
                  name="search-outline"
                  size={19}
                  color={searchFocused ? colors.primary : colors.muted}
                />
                <TextInput
                  accessibilityLabel="Search orders"
                  autoFocus
                  value={search}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  onChangeText={(value) => {
                    setSearch(value);
                    setPage(1);
                  }}
                  placeholder="Search order no, customer, phone, product…"
                  placeholderTextColor={colors.muted}
                  style={[s.searchInput, s.searchInputReset]}
                />
                {!!search && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Clear search"
                    onPress={() => {
                      setSearch("");
                      setPage(1);
                    }}
                  >
                    <Ionicons name="close-circle" size={20} color={colors.muted} />
                  </Pressable>
                )}
              </View>
            </View>
            {(filterCount > 0 || !!search) && (
              <View style={s.wrap}>
                <Button label="Clear filters" onPress={clear} />
              </View>
            )}
            {filterCount > 0 && (
              <View style={s.wrap}>
                {Object.entries(filters)
                  .filter(([, value]) => value)
                  .map(([key, value]) => (
                    <Pressable
                      key={key}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${key} filter`}
                      onPress={() => {
                        setFilters({ ...filters, [key]: "" });
                        setPage(1);
                      }}
                      style={s.filterChip}
                    >
                      <Text style={s.small}>
                        {key}: {key === "channel" ? channelLabel(value) : value}{" "}
                        ×
                      </Text>
                    </Pressable>
                  ))}
              </View>
            )}
            <Text accessibilityLiveRegion="polite" style={s.resultCount}>
              {visible.length}{" "}
              {filterCount || search ? "matching orders" : "orders"}
            </Text>
            {!!error && !!orders.length && <Text style={s.errorText}>{error}</Text>}
          </View>
        )}
        {count("ISSUES") > 0 && activeTab !== "ISSUES" && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Review stock issues"
            onPress={() => changeTab("ISSUES")}
            style={s.warning}
          >
            <Ionicons name="alert-circle-outline" size={22} color={colors.dangerText} />
            <View style={s.grow}>
              <Text style={s.warningTitle}>
                {count("ISSUES")} orders need stock attention
              </Text>
              <Text style={s.small}>
                Review stock before confirming orders.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.dangerText} />
          </Pressable>
        )}
        <View style={s.panel}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator
            contentContainerStyle={s.tabs}
          >
            {queues.filter((queue) => queue.key !== "ISSUES").map((queue) => (
              <Pressable
                key={queue.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: activeTab === queue.key }}
                onPress={() => changeTab(queue.key)}
                style={[s.queue, activeTab === queue.key ? s.activeQueue : s.inactiveQueue]}
              >
                <Text style={[s.queueLabel, activeTab === queue.key ? s.activeQueueLabel : s.inactiveQueueLabel]}>
                  {queue.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
        {loading && !orders.length ? (
          <View style={s.empty}><ActivityIndicator color={colors.primary} /><Text style={s.small}>Loading orders…</Text></View>
        ) : error && !orders.length ? (
          <View style={s.empty}><Ionicons name="alert-circle-outline" size={36} color={colors.dangerText} /><Text style={s.errorText}>{error}</Text><Button label="Try again" primary onPress={() => setReload(value => value + 1)} /></View>
        ) : groups.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="cube-outline" size={42} color={colors.muted} />
            <Text style={s.sectionTitle}>No orders found</Text>
            <Text style={s.small}>
              Try another status or adjust your search and filters.
            </Text>
            <Button
              label="Clear filters"
              onPress={() => {
                clear();
                changeTab("ALL");
              }}
            />
          </View>
        ) : (
          groups.map((group) => (
            <View key={group.key} style={s.group}>
              {group.title && <Text style={s.sectionTitle}>{group.title}</Text>}
              <View style={s.date}>
                <Ionicons name="calendar-outline" size={16} color={colors.secondary} />
                <Text style={s.dateText}>{dateLabel(group.date)}</Text>
              </View>
              <View style={s.grid}>
                {group.items.map((order) => {
                  const issue = hasStockIssue(order);
                  return (
                    <Pressable
                      key={order.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Open order ${order.orderNo}, ${order.customerName}`}
                      onPress={() => router.push(`/orders/${order.id}`)}
                      style={({ pressed }) => [
                        s.card,
                        s.orderCard,
                        pressed && { opacity: 0.78 },
                        {
                          backgroundColor: colors.white,
                          width: width >= 620 ? "48.8%" : "100%",
                        },
                      ]}
                    >
                      <View style={s.cardTop}>
                        <View style={s.grow}>
                          <Text style={s.orderNo}>{order.orderNo}</Text>
                        </View>
                        <View style={s.amount}>
                          <Text style={s.money}>
                            {money(order.totalAmount)}
                          </Text>
                          {!order.isDraft && order.dueAmount > 0 && (
                            <Text style={s.errorText}>
                              Due {money(order.dueAmount)}
                            </Text>
                          )}
                        </View>
                      </View>
                      <Status order={order} />
                      {issue && (
                        <Text style={s.errorText}>Cannot be delivered</Text>
                      )}
                      <View style={s.customerSummary}>
                        <Text numberOfLines={1} style={s.customerName}>{order.customerName || "Customer"}</Text>
                        <View style={s.customerInfoRow}><Ionicons name="location-outline" size={14} color={colors.secondary} /><Text numberOfLines={2} style={s.customerInfo}>{order.customerAddress?.trim() || "Location not provided"}</Text></View>
                        <View style={s.customerInfoRow}><Ionicons name="call-outline" size={14} color={colors.secondary} /><Text numberOfLines={1} style={s.customerInfo}>{order.customerPhone?.trim() || "Mobile number not provided"}</Text></View>
                      </View>
                      <Text style={s.quantity}>
                        Ordered quantity:{" "}
                        <Text style={s.name}>
                          {order.items.reduce(
                            (total, item) => total + item.qty,
                            0,
                          )}
                        </Text>
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))
        )}
        {visible.length > 0 && (
          <View style={s.pagination}>
            <Text style={s.small}>
              Page {currentPage} of {pageCount}
            </Text>
            <View style={s.wrap}>
              <Button
                label="Previous"
                disabled={currentPage <= 1}
                onPress={() => pageTo(currentPage - 1)}
              />
              <Button
                label="Next"
                disabled={currentPage >= pageCount}
                onPress={() => pageTo(currentPage + 1)}
              />
            </View>
          </View>
        )}
      </ScrollView>
      {showFilters && (
        <Sheet title="Filters" close={() => setShowFilters(false)}>
          <View style={s.wrap}>
            {[1, 7, 30, 90].map((days) => (
              <Button
                key={days}
                label={days === 1 ? "Today" : `${days} days`}
                onPress={() => quickDates(days)}
              />
            ))}
          </View>
          {(["from", "to"] as const).map((key) => (
            <View key={key} style={s.field}>
              <Text style={s.name}>{key === "from" ? "From" : "To"}</Text>
              <TextInput
                accessibilityLabel={key === "from" ? "From date" : "To date"}
                autoCapitalize="none"
                placeholder="YYYY-MM-DD"
                value={draft[key]}
                onChangeText={(value) => setDraft({ ...draft, [key]: value })}
                style={s.input}
              />
            </View>
          ))}
          {!!dateError && (
            <Text accessibilityRole="alert" style={s.errorText}>
              {dateError}
            </Text>
          )}
          <Text style={s.name}>Sales channel</Text>
          <View style={s.wrap}>
            {["", ...channels].map((channel) => (
              <Pressable
                key={channel}
                accessibilityRole="button"
                accessibilityState={{ selected: draft.channel === channel }}
                onPress={() => setDraft({ ...draft, channel })}
                style={[
                  s.channel,
                  draft.channel === channel && s.activeChannel,
                ]}
              >
                <Text style={s.buttonText}>
                  {channel ? channelLabel(channel) : "All channels"}
                </Text>
              </Pressable>
            ))}
          </View>
          {(["customer", "product"] as const).map((key) => (
            <View key={key} style={s.field}>
              <Text style={s.name}>
                {key === "customer" ? "Customer" : "Products"}
              </Text>
              <TextInput
                accessibilityLabel={
                  key === "customer" ? "Customer filter" : "Product filter"
                }
                value={draft[key]}
                onChangeText={(value) => setDraft({ ...draft, [key]: value })}
                style={s.input}
              />
            </View>
          ))}
          <View style={s.wrap}>
            <Button
              label="Clear filters"
              onPress={() => setDraft(emptyFilters)}
            />
            <Button
              label="Apply filters"
              primary
              disabled={!!dateError}
              onPress={() => {
                setFilters(draft);
                setPage(1);
                setShowFilters(false);
              }}
            />
          </View>
        </Sheet>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, minHeight: 0, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 28, gap: 8 },
  grow: { flex: 1, minWidth: 0 },
  heading: { flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: -16, marginTop: -10, marginBottom: 4, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.divider },
  title: { fontSize: 26, fontWeight: "400", color: colors.heading },
  subtitle: { fontSize: 12, color: colors.muted, marginTop: 4 },
  toggle: {
    position: "relative",
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
  },
  newOrderButton: { backgroundColor: colors.primary },
  small: { fontSize: 12, lineHeight: 18, color: colors.secondary },
  warning: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    paddingHorizontal: 13,
    paddingVertical: 8,
    backgroundColor: colors.dangerBackground,
    borderWidth: 1,
    borderColor: colors.dangerBackground,
    borderRadius: 12,
  },
  warningTitle: { fontSize: 12, fontWeight: "700", color: colors.dangerText },
  panel: {
    backgroundColor: colors.white,
  },
  tabs: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 12, gap: 4 },
  queue: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  activeQueue: { backgroundColor: colors.primary },
  inactiveQueue: { backgroundColor: colors.disabled },
  queueLabel: { fontSize: 12, fontWeight: "500" },
  activeQueueLabel: { color: colors.white },
  inactiveQueueLabel: { color: colors.secondary },
  count: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    fontSize: 11,
    fontWeight: "400",
  },
  tools: { padding: 14, paddingTop: 4, gap: 12 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  search: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.divider,
    paddingHorizontal: 10,
    borderRadius: 9,
    backgroundColor: colors.white,
  },
  searchFocused: {
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.12,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    height: 44,
    fontSize: 13,
    color: colors.heading,
    borderWidth: 0,
    borderColor: "transparent",
    outlineWidth: 0,
  },
  searchInputReset: { outlineStyle: "none", boxShadow: "none" } as any,
  filterButton: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 9,
    backgroundColor: colors.primaryLight,
  },
  filterCount: {
    position: "absolute",
    top: 1,
    right: 2,
    minWidth: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: colors.primary,
    color: colors.white,
    fontSize: 10,
    textAlign: "center",
  },
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    alignItems: "center",
  },
  button: {
    minHeight: 40,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  primary: { backgroundColor: colors.primary, borderColor: colors.primary },
  buttonText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
    textAlign: "center",
  },
  filterChip: { backgroundColor: colors.primaryLight, padding: 7, borderRadius: 7 },
  resultCount: { fontSize: 12, fontWeight: "700", color: colors.heading },
  group: { gap: 10 },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "400",
    color: colors.heading,
    flexShrink: 1,
  },
  date: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: colors.cardSecondary,
  },
  dateText: { fontSize: 13, fontWeight: "600", color: colors.secondary },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 13,
    padding: 13,
    gap: 5,
  },
  orderCard: { alignItems: "stretch" },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  orderNo: { fontWeight: "700", color: colors.primary, fontSize: 14 },
  amount: { alignItems: "flex-end", maxWidth: "50%" },
  money: { fontSize: 17, fontWeight: "800", color: colors.heading },
  errorText: { fontSize: 11, lineHeight: 17, color: colors.dangerText },
  badge: {
    fontSize: 10,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
    color: colors.secondary,
    backgroundColor: colors.disabled,
    overflow: "hidden",
  },
  quantity: { color: colors.secondary, fontSize: 12, marginVertical: 2 },
  name: { fontSize: 13, fontWeight: "600", color: colors.heading },
  customerSummary: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 4, paddingTop: 7, gap: 4 },
  customerName: { color: colors.heading, fontSize: 14, fontWeight: "700" },
  customerInfoRow: { flexDirection: "row", alignItems: "flex-start", gap: 5 },
  customerInfo: { flex: 1, color: colors.secondary, fontSize: 11, lineHeight: 16 },
  cardActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: "auto",
    paddingTop: 4,
  },
  customer: {
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    gap: 4,
  },
  products: { gap: 10, paddingVertical: 8 },
  product: { flexDirection: "row", alignItems: "center", gap: 9 },
  productIcon: {
    width: 38,
    height: 38,
    borderRadius: 9,
    backgroundColor: colors.disabled,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: { alignItems: "center", paddingVertical: 35, gap: 12 },
  pagination: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  sheet: {
    backgroundColor: colors.white,
    width: "100%",
    maxWidth: 560,
    maxHeight: "90%",
    borderRadius: 18,
    overflow: "hidden",
    flexShrink: 1,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  close: { padding: 8 },
  sheetBody: { padding: 18, gap: 16 },
  field: { gap: 7 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    minHeight: 44,
    padding: 10,
    color: colors.heading,
    fontSize: 14,
  },
  channel: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
  },
  activeChannel: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  summary: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});





