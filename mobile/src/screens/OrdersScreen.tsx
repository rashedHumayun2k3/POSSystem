import { useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { sampleOrders } from "../orders/sampleOrders";
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

type OrderPage = { items: Order[]; counts: Record<string, number>; totalCount: number; page: number; pageSize: number };
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
        <Ionicons name={icon} size={17} color={primary ? "#fff" : "#4557d9"} />
      )}
      <Text style={[s.buttonText, primary && { color: "#fff" }]}>{label}</Text>
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
              <Ionicons name="close" size={24} color="#334155" />
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
        <Text style={[s.small, { color: "#92400e" }]}>Revised</Text>
      )}
    </View>
  );
}
function Details({ order }: { order: Order }) {
  return (
    <>
      <View style={s.customer}>
        <Text style={s.name}>{order.customerName}</Text>
        {!!order.customerPhone && (
          <Text style={s.small}>{order.customerPhone}</Text>
        )}
        <Text style={s.small}>{order.customerAddress}</Text>
      </View>
      <View style={s.products}>
        {order.items.map((item, index) => (
          <View style={s.product} key={`${item.variantSku}-${index}`}>
            <View style={s.productIcon}>
              <Ionicons name="cube-outline" size={21} color="#657086" />
            </View>
            <View style={s.grow}>
              <Text style={s.name}>{item.productName}</Text>
              <Text style={s.small}>
                ×{item.qty} {item.variantSku}
              </Text>
              {order.isDraft &&
                order.orderStatus !== "CANCELLED" &&
                item.availableStock < item.qty && (
                  <Text style={s.errorText}>
                    Available: {item.availableStock}
                  </Text>
                )}
            </View>
          </View>
        ))}
      </View>
      {!!order.handlingUserName && (
        <Text style={s.small}>Assigned to: {order.handlingUserName}</Text>
      )}
      {!!order.trackingNo && (
        <Text style={s.small}>Tracking: {order.trackingNo}</Text>
      )}
    </>
  );
}

export default function OrdersScreen() {
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
  const [contact, setContact] = useState<Order | null>(null);
  const [page, setPage] = useState(1);
  const [width, setWidth] = useState(0);
  const list = useRef<ScrollView>(null);
  const filtered = filterOrders(sampleOrders, search, filters);
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
            <Ionicons name="search-outline" size={21} color="#4557d9" />
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
            <Ionicons name="options-outline" size={21} color="#4557d9" />
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
            <Ionicons name="add" size={23} color="#fff" />
          </Pressable>
        </View>
        {showSearch && (
          <View style={s.tools}>
            <View style={s.searchRow}>
              <View style={[s.search, searchFocused && s.searchFocused]}>
                <Ionicons
                  name="search-outline"
                  size={19}
                  color={searchFocused ? "#4557d9" : "#929aaa"}
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
                  placeholderTextColor="#929aaa"
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
                    <Ionicons name="close-circle" size={20} color="#929aaa" />
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
          </View>
        )}
        {count("ISSUES") > 0 && activeTab !== "ISSUES" && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Review stock issues"
            onPress={() => changeTab("ISSUES")}
            style={s.warning}
          >
            <Ionicons name="alert-circle-outline" size={22} color="#b91c1c" />
            <View style={s.grow}>
              <Text style={s.warningTitle}>
                {count("ISSUES")} orders need stock attention
              </Text>
              <Text style={s.small}>
                Review stock before confirming orders.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#b91c1c" />
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
        {groups.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="cube-outline" size={42} color="#a7afbd" />
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
                <Ionicons name="calendar-outline" size={16} color="#64748b" />
                <Text style={s.dateText}>{dateLabel(group.date)}</Text>
              </View>
              <View style={s.grid}>
                {group.items.map((order) => {
                  const issue = hasStockIssue(order);
                  const tone = queues.find(
                    (queue) =>
                      queue.key === (issue ? "ISSUES" : queueFor(order)),
                  )!;
                  return (
                    <View
                      key={order.id}
                      style={[
                        s.card,
                        {
                          backgroundColor: tone.bg,
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
                      <Text style={s.quantity}>
                        Ordered quantity:{" "}
                        <Text style={s.name}>
                          {order.items.reduce(
                            (total, item) => total + item.qty,
                            0,
                          )}
                        </Text>
                      </Text>
                      <View style={s.cardActions}>
                        <Button
                          label="View Order"
                          primary
                          onPress={() => router.push(`/orders/${order.id}`)}
                        />
                        <Button
                          label="Contact Customer"
                          onPress={() => setContact(order)}
                        />
                      </View>
                    </View>
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
      {contact && (
        <Sheet title="Contact Customer" close={() => setContact(null)}>
          <Text style={s.orderNo}>{contact.orderNo}</Text>
          <Text style={s.name}>{contact.customerName}</Text>
          <Text style={s.small}>{contact.customerAddress}</Text>
          <Text style={s.small}>
            No phone number saved for this sample customer.
          </Text>
        </Sheet>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  content: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 28, gap: 8 },
  grow: { flex: 1, minWidth: 0 },
  heading: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { fontSize: 26, fontWeight: "400", color: "#172033" },
  subtitle: { fontSize: 12, color: "#7e899c", marginTop: 4 },
  toggle: {
    position: "relative",
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#eef0ff",
  },
  newOrderButton: { backgroundColor: "#4557d9" },
  small: { fontSize: 12, lineHeight: 18, color: "#657086" },
  warning: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    paddingHorizontal: 13,
    paddingVertical: 8,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 12,
  },
  warningTitle: { fontSize: 12, fontWeight: "700", color: "#b91c1c" },
  panel: {
    backgroundColor: "#fff",
  },
  tabs: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 12, gap: 4 },
  queue: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  activeQueue: { backgroundColor: "#4557d9" },
  inactiveQueue: { backgroundColor: "#f1f3f6" },
  queueLabel: { fontSize: 12, fontWeight: "500" },
  activeQueueLabel: { color: "#fff" },
  inactiveQueueLabel: { color: "#5f6b7c" },
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
    borderColor: "#e1e5ed",
    paddingHorizontal: 10,
    borderRadius: 9,
    backgroundColor: "#fff",
  },
  searchFocused: {
    borderColor: "#4557d9",
    shadowColor: "#4557d9",
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
    color: "#263248",
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
    borderColor: "#dce1f4",
    borderRadius: 9,
    backgroundColor: "#eef0ff",
  },
  filterCount: {
    position: "absolute",
    top: 1,
    right: 2,
    minWidth: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: "#4557d9",
    color: "#fff",
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
    borderColor: "#dce1f4",
    backgroundColor: "#fff",
  },
  primary: { backgroundColor: "#4557d9", borderColor: "#4557d9" },
  buttonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#4557d9",
    textAlign: "center",
  },
  filterChip: { backgroundColor: "#eef0ff", padding: 7, borderRadius: 7 },
  resultCount: { fontSize: 12, fontWeight: "700", color: "#334155" },
  group: { gap: 10 },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "400",
    color: "#172033",
    flexShrink: 1,
  },
  date: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#eaf0f6",
  },
  dateText: { fontSize: 13, fontWeight: "600", color: "#475569" },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: "#dfe4ed",
    borderRadius: 13,
    padding: 13,
    gap: 5,
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  orderNo: { fontWeight: "700", color: "#4557d9", fontSize: 14 },
  amount: { alignItems: "flex-end", maxWidth: "50%" },
  money: { fontSize: 17, fontWeight: "800", color: "#172033" },
  errorText: { fontSize: 11, lineHeight: 17, color: "#b91c1c" },
  badge: {
    fontSize: 10,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
    color: "#64748b",
    backgroundColor: "#e9edf4",
    overflow: "hidden",
  },
  quantity: { color: "#657086", fontSize: 12, marginVertical: 2 },
  name: { fontSize: 13, fontWeight: "600", color: "#263248" },
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
    borderColor: "#dfe4ed",
    borderRadius: 8,
    gap: 4,
  },
  products: { gap: 10, paddingVertical: 8 },
  product: { flexDirection: "row", alignItems: "center", gap: 9 },
  productIcon: {
    width: 38,
    height: 38,
    borderRadius: 9,
    backgroundColor: "#e9edf4",
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
    backgroundColor: "#17203388",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  sheet: {
    backgroundColor: "#fff",
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
    borderBottomColor: "#e8ebf1",
  },
  close: { padding: 8 },
  sheetBody: { padding: 18, gap: 16 },
  field: { gap: 7 },
  input: {
    borderWidth: 1,
    borderColor: "#dce1eb",
    borderRadius: 8,
    minHeight: 44,
    padding: 10,
    color: "#263248",
    fontSize: 14,
  },
  channel: {
    borderWidth: 1,
    borderColor: "#dce1eb",
    borderRadius: 8,
    padding: 10,
  },
  activeChannel: { backgroundColor: "#eef0ff", borderColor: "#4557d9" },
  summary: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});



