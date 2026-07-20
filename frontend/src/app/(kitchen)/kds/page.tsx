"use client";

import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import {
  Flame,
  Clock,
  UtensilsCrossed,
  ShoppingBag,
  Wifi,
  WifiOff,
  Search,
  RefreshCw,
  Bell,
  User,
  Menu,
  X,
  Gauge,
  Timer,
  AlertTriangle,
  CheckCircle2,
  Activity,
  ChevronRight,
  ChevronLeft,
  PanelRightClose,
  PanelRightOpen,
  ListOrdered,
  IndianRupee,
  Volume2,
  VolumeX,
  BellRing,
} from "lucide-react";
import { getSocket } from "@/lib/socket";
import { fetchOrdersForRestaurant, updateOrderStatus } from "@/lib/api";
import type { Order, OrderStatus } from "@/types/order";

const RESTAURANT_ID = "lifafa"; // TODO: make dynamic if you support multiple restaurants
const RESTAURANT_NAME = "Lifafa Kitchen";

// ---------------------------------------------------------------------------
// Unchanged business constants (kept exactly as in the original implementation)
// ---------------------------------------------------------------------------
const COLUMNS: { status: OrderStatus; title: string; accent: string; dot: string }[] = [
  { status: "pending", title: "New", accent: "#E2622B", dot: "#E2622B" },
  { status: "preparing", title: "Preparing", accent: "#D4A72C", dot: "#D4A72C" },
  { status: "ready", title: "Ready to Serve", accent: "#22A65A", dot: "#22A65A" },
];

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: "preparing",
  preparing: "ready",
  ready: "completed",
};

const NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  pending: "Start Preparing",
  preparing: "Mark Ready",
  ready: "Complete Order",
};

function elapsedMinutes(placedAt: string, now: number) {
  return Math.floor((now - new Date(placedAt).getTime()) / 60000);
}

// Timer bracket color, per KDS convention (0-5 green / 5-10 yellow / 10-20 orange / 20+ red)
function timerColor(mins: number) {
  if (mins < 5) return { text: "#6FCF97", bg: "rgba(111,207,151,0.12)" };
  if (mins < 10) return { text: "#E3C878", bg: "rgba(227,200,120,0.12)" };
  if (mins < 20) return { text: "#E2622B", bg: "rgba(226,98,43,0.14)" };
  return { text: "#F0574A", bg: "rgba(240,87,74,0.16)" };
}

type FilterKey = "all" | "dine-in" | "takeaway" | "priority" | "delayed" | "ready";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "dine-in", label: "Dine In" },
  { key: "takeaway", label: "Take Away" },
  { key: "priority", label: "Priority" },
  { key: "delayed", label: "Delayed" },
  { key: "ready", label: "Ready" },
];

function formatClock(d: Date) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function formatDate(d: Date) {
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

// ---------------------------------------------------------------------------
// Small presentational pieces
// ---------------------------------------------------------------------------

function AnalyticsCard({
  icon,
  value,
  label,
  accent,
}: {
  icon: React.ReactNode;
  value: React.ReactNode;
  label: string;
  accent: string;
}) {
  return (
    <div
      className="group relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-3 transition-all duration-200 hover:bg-white/[0.06] hover:border-white/[0.12]"
      style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)" }}
    >
      <div className="flex items-center gap-2 mb-1.5" style={{ color: accent }}>
        {icon}
      </div>
      <div className="font-[Space_Grotesk] text-xl font-bold text-[#F5F3EC] tabular-nums leading-none">
        {value}
      </div>
      <div className="text-[11px] text-[#8B9088] mt-1 tracking-wide">{label}</div>
      <div
        className="absolute -right-3 -bottom-3 w-14 h-14 rounded-full blur-2xl opacity-20 transition-opacity duration-300 group-hover:opacity-35"
        style={{ background: accent }}
      />
    </div>
  );
}

function LoadBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="mb-2.5">
      <div className="flex justify-between text-[11px] text-[#9BA096] mb-1">
        <span>{label}</span>
        <span className="font-[Space_Grotesk] font-semibold text-[#E5E7E1]">{value}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, Math.max(0, value))}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

function OrderCard({
  order,
  now,
  isNew,
  accent,
  onAdvance,
}: {
  order: Order;
  now: number;
  isNew: boolean;
  accent: string;
  onAdvance: (order: Order) => void;
}) {
  const mins = elapsedMinutes(order.placedAt, now);
  const overdue = mins >= order.estimatedMinutes;
  const severelyDelayed = mins >= order.estimatedMinutes + 10;
  const remaining = order.estimatedMinutes - mins;
  const nextStatus = NEXT_STATUS[order.status];
  const clock = timerColor(mins);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
      whileHover={{ scale: 1.015, y: -2 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className="relative mb-3 rounded-2xl border bg-[#181C16] shadow-[0_4px_16px_rgba(0,0,0,0.35)]"
      style={{
        borderColor: overdue ? "#D8432E" : "rgba(255,255,255,0.08)",
        borderWidth: overdue ? 1.5 : 1,
      }}
    >
      {severelyDelayed && (
        <motion.div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{ boxShadow: "0 0 0 2px rgba(216,67,46,0.55)" }}
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {/* perforated ticket edge */}
      <div className="flex justify-between px-4 pt-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <span key={i} className="w-1 h-1 rounded-full bg-[#0E100D]" />
        ))}
      </div>

      <div className="px-4 pt-2 pb-3">
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="flex items-center gap-1.5 text-[#F5F3EC] font-[Space_Grotesk] font-bold text-[15px]">
              <UtensilsCrossed size={14} style={{ color: accent }} />
              {order.tableLabel ?? `Token ${order.tableToken.slice(0, 8)}`}
            </div>
            <div className="text-[11px] text-[#8B9088] mt-0.5 font-mono tracking-wide">
              #{order.orderId}
            </div>
          </div>

          {overdue && (
            <span className="flex items-center gap-1 rounded-full bg-[#D8432E]/15 border border-[#D8432E]/40 px-2 py-0.5 text-[10px] font-bold text-[#F0837A] tracking-wide uppercase">
              <AlertTriangle size={10} />
              {severelyDelayed ? "Delayed" : "Priority"}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 mb-3">
          <span
            className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold font-mono"
            style={{ color: clock.text, background: clock.bg }}
          >
            <Clock size={11} />
            {mins}m ago
          </span>
          <span className="flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-1 text-[11px] font-semibold text-[#B8BDB5]">
            {order.orderType === "dine-in" ? <UtensilsCrossed size={11} /> : <ShoppingBag size={11} />}
            {order.orderType === "dine-in" ? "Dine-in" : "Takeaway"}
          </span>
        </div>

        <div className="border-t border-dashed border-white/10 pt-2.5 mb-2.5">
          {order.items.map((entry, i) => (
            <div key={i} className="flex justify-between text-[13px] text-[#E5E7E1] mb-1">
              <span>
                <strong className="text-[#F5F3EC] font-mono">{entry.quantity}×</strong>{" "}
                {entry.item.name}
              </span>
            </div>
          ))}
        </div>

        {order.specialInstructions && (
          <div className="rounded-lg border border-[#D4A72C]/30 bg-[#D4A72C]/10 px-2.5 py-2 mb-2.5 text-[12px] text-[#E3C878] leading-snug">
            {order.specialInstructions}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-dashed border-white/10 pt-2.5 mb-3 text-[11px] font-mono">
          <span className="font-[Space_Grotesk] text-[15px] font-bold text-[#F5F3EC]">
            ₹{order.totalAmount.toFixed(2)}
          </span>
          <span className="text-[#8B9088]">
            {remaining >= 0 ? `ETA ${remaining}m` : `Overdue ${Math.abs(remaining)}m`}
          </span>
        </div>

        {nextStatus && (
          <motion.button
            onClick={() => onAdvance(order)}
            whileTap={{ scale: 0.97 }}
            whileHover={{ scale: 1.01 }}
            className="w-full rounded-xl py-2.5 text-[13px] font-bold tracking-wide text-white shadow-md relative overflow-hidden"
            style={{ background: accent }}
          >
            {NEXT_LABEL[order.status]} →
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function KitchenDashboardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [connected, setConnected] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const newOrderIds = useRef<Set<string>>(new Set());
  const [, forceRender] = useState(0);

  // --- Additive UI-only state (does not touch fetch/socket/API business logic) ---
  const [clockNow, setClockNow] = useState(() => new Date());
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [recentlyCompleted, setRecentlyCompleted] = useState<
    { orderId: string; tableLabel?: string | null; completedAt: number }[]
  >([]);
  const [activityLog, setActivityLog] = useState<{ id: string; text: string; at: number }[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterKey, setFilterKey] = useState<FilterKey>("all");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [waiterCalls, setWaiterCalls] = useState<
    { id: string; tableLabel: string; tableToken: string | null; at: number }[]
  >([]);

  // Browsers block audio until a user gesture has occurred on the page, so lazily
  // create the AudioContext on the first click/keypress rather than on mount.
  useEffect(() => {
    const unlock = () => {
      if (!audioCtxRef.current) {
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        if (Ctx) audioCtxRef.current = new Ctx();
      } else if (audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume();
      }
    };
    window.addEventListener("click", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("click", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const playNewOrderChime = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return; // no user gesture yet — nothing to play through
    const now0 = ctx.currentTime;
    [880, 1175].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = now0 + i * 0.16;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.22, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.2);
    });
  }, []);

  // Real completed-order history from the backend (status=completed), used to derive
  // 7-day completed count and revenue. Note: Order has no `completedAt` field, so
  // "last 7 days" is approximated using `placedAt` — close enough for orders that
  // typically complete within minutes/hours of being placed, but if an order can sit
  // for days before completion this will undercount it slightly.
  const [completedHistory, setCompletedHistory] = useState<Order[]>([]);

  const loadCompletedHistory = useCallback(async () => {
    try {
      const data = await fetchOrdersForRestaurant(RESTAURANT_ID, "completed");
      setCompletedHistory(data);
    } catch {
      // Leave previous history in place if this fetch fails.
    }
  }, []);

  useEffect(() => {
    loadCompletedHistory();
  }, [loadCompletedHistory]);

  const pushRecentlyCompleted = useCallback(
    (entry: { orderId: string; tableLabel?: string | null }) => {
      setRecentlyCompleted((prev) => {
        if (prev.some((e) => e.orderId === entry.orderId)) return prev; // already recorded, avoid duplicates
        return [{ ...entry, completedAt: Date.now() }, ...prev].slice(0, 20);
      });
    },
    []
  );

  const pushActivity = useCallback((text: string) => {
    setActivityLog((prev) => [{ id: `${Date.now()}-${Math.random()}`, text, at: Date.now() }, ...prev].slice(0, 15));
  }, []);

  const loadOrders = useCallback(async () => {
    try {
      const data = await fetchOrdersForRestaurant(RESTAURANT_ID, "pending,preparing,ready");
      setOrders(data);
      setLastSync(new Date());
    } catch {
      // Backend not reachable yet — board just stays empty until it is.
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    const socket = getSocket();
    socket.emit("join-kitchen", RESTAURANT_ID);

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    const onNewOrder = (order: Order) => {
      newOrderIds.current.add(order.orderId);
      setOrders((prev) => [order, ...prev]);
      pushActivity(`New order #${order.orderId} — ${order.tableLabel ?? "table"}`);
      setLastSync(new Date());
      if (soundEnabled) playNewOrderChime();
      setTimeout(() => {
        newOrderIds.current.delete(order.orderId);
        forceRender((n) => n + 1);
      }, 3000);
    };

    const onStatusUpdate = (updated: Order) => {
      setOrders((prev) =>
        updated.status === "completed" || updated.status === "cancelled"
          ? prev.filter((o) => o.orderId !== updated.orderId)
          : prev.map((o) => (o.orderId === updated.orderId ? updated : o))
      );
      if (updated.status === "completed") {
        pushRecentlyCompleted({ orderId: updated.orderId, tableLabel: updated.tableLabel });
        loadCompletedHistory();
      }
      pushActivity(`Order #${updated.orderId} → ${updated.status}`);
      setLastSync(new Date());
    };

    const onWaiterCall = (call: { tableLabel: string; tableToken: string | null; at: number }) => {
      const id = `${call.at}-${Math.random()}`;
      setWaiterCalls((prev) => [{ id, ...call }, ...prev].slice(0, 10));
      pushActivity(`🔔 Waiter called — ${call.tableLabel}`);
      setLastSync(new Date());
      if (soundEnabled) playNewOrderChime();
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("new-order", onNewOrder);
    socket.on("order-status-updated", onStatusUpdate);
    socket.on("waiter-called", onWaiterCall);
    setConnected(socket.connected);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("new-order", onNewOrder);
      socket.off("order-status-updated", onStatusUpdate);
      socket.off("waiter-called", onWaiterCall);
    };
  }, [pushActivity, loadCompletedHistory, pushRecentlyCompleted, soundEnabled, playNewOrderChime]);

  const dismissWaiterCall = useCallback((id: string) => {
    setWaiterCalls((prev) => prev.filter((c) => c.id !== id));
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);

  // Display-only clock, separate from the 15s business timer above.
  useEffect(() => {
    const id = setInterval(() => setClockNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const handleAdvance = async (order: Order) => {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    // Optimistic update so it feels instant on a busy pass.
    setOrders((prev) =>
      next === "completed"
        ? prev.filter((o) => o.orderId !== order.orderId)
        : prev.map((o) => (o.orderId === order.orderId ? { ...o, status: next } : o))
    );
    if (next === "completed") {
      pushRecentlyCompleted({ orderId: order.orderId, tableLabel: order.tableLabel });
    }
    try {
      await updateOrderStatus(order.orderId, next);
      if (next === "completed") loadCompletedHistory();
    } catch {
      loadOrders(); // reconcile with server if the update failed
    }
  };

  // ---- Derived, data-backed analytics (nothing here is fabricated) ----
  const stats = useMemo(() => {
    const pendingCount = orders.filter((o) => o.status === "pending").length;
    const preparingCount = orders.filter((o) => o.status === "preparing").length;
    const readyCount = orders.filter((o) => o.status === "ready").length;
    const overdueList = orders.filter((o) => elapsedMinutes(o.placedAt, now) >= o.estimatedMinutes);
    const avgWait =
      orders.length === 0
        ? 0
        : Math.round(orders.reduce((sum, o) => sum + elapsedMinutes(o.placedAt, now), 0) / orders.length);
    const kitchenLoad =
      orders.length === 0
        ? 0
        : Math.round(((preparingCount + overdueList.length) / Math.max(orders.length, 1)) * 100);

    const itemCounts = new Map<string, number>();
    orders.forEach((o) => o.items.forEach((e) => itemCounts.set(e.item.name, (itemCounts.get(e.item.name) ?? 0) + e.quantity)));
    const topItems = Array.from(itemCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return {
      active: orders.length,
      pendingCount,
      preparingCount,
      readyCount,
      overdueList,
      avgWait,
      kitchenLoad,
      topItems,
      completedSession: recentlyCompleted.length,
    };
  }, [orders, now, recentlyCompleted]);

  // Real 7-day completed/revenue figures, derived from the backend's completed-order
  // history (see note on completedHistory above re: placedAt vs completedAt).
  const weeklyStats = useMemo(() => {
    const cutoff = now - 7 * 24 * 60 * 60 * 1000;
    const recent = completedHistory.filter((o) => new Date(o.placedAt).getTime() >= cutoff);
    const revenue = recent.reduce((sum, o) => sum + o.totalAmount, 0);
    return { count: recent.length, revenue };
  }, [completedHistory, now]);

  const isOverdue = (o: Order) => elapsedMinutes(o.placedAt, now) >= o.estimatedMinutes;
  const isSeverelyDelayed = (o: Order) => elapsedMinutes(o.placedAt, now) >= o.estimatedMinutes + 10;

  const matchesSearch = (o: Order) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return (
      o.orderId.toLowerCase().includes(q) ||
      (o.tableLabel ?? "").toLowerCase().includes(q) ||
      o.tableToken.toLowerCase().includes(q) ||
      o.items.some((e) => e.item.name.toLowerCase().includes(q))
    );
  };

  const matchesFilter = (o: Order) => {
    switch (filterKey) {
      case "dine-in":
        return o.orderType === "dine-in";
      case "takeaway":
        return o.orderType !== "dine-in";
      case "priority":
        return isOverdue(o);
      case "delayed":
        return isSeverelyDelayed(o);
      default:
        return true;
    }
  };

  const visibleColumns = filterKey === "ready" ? COLUMNS.filter((c) => c.status === "ready") : COLUMNS;

  const alerts = useMemo(() => {
    const list: { icon: React.ReactNode; text: string }[] = [];
    stats.overdueList.slice(0, 4).forEach((o) => {
      const mins = elapsedMinutes(o.placedAt, now);
      list.push({
        icon: <Flame size={13} className="text-[#E2622B]" />,
        text: `${o.tableLabel ?? "Table"} waiting ${mins}m`,
      });
    });
    if (stats.kitchenLoad > 75) {
      list.push({ icon: <Gauge size={13} className="text-[#D8432E]" />, text: "Kitchen overloaded" });
    }
    if (list.length === 0) {
      list.push({ icon: <CheckCircle2 size={13} className="text-[#22A65A]" />, text: "All caught up — no alerts" });
    }
    return list;
  }, [stats, now]);

  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden bg-[#0E100D] flex text-[#E5E7E1]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap');
        html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
        * { box-sizing: border-box; font-family: 'Inter', sans-serif; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 8px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.15); }
      `}</style>

      {/* Waiter-call banners — pop in top-right whenever a table taps
          "Call Waiter" on the customer menu page; staff dismiss individually. */}
      <div className="fixed right-4 top-4 z-[200] flex w-[300px] flex-col gap-2">
        <AnimatePresence>
          {waiterCalls.map((call) => (
            <motion.div
              key={call.id}
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center gap-3 rounded-xl border border-[#D4A72C]/40 bg-[#1B1D16] px-4 py-3 shadow-lg"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#D4A72C]/15 text-[#D4A72C]">
                <BellRing size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-[#F5F3EC]">{call.tableLabel} needs you</p>
                <p className="text-[11px] text-[#8B9088]">Waiter called just now</p>
              </div>
              <button
                onClick={() => dismissWaiterCall(call.id)}
                className="shrink-0 rounded-md border border-white/10 px-2 py-1 text-[10px] font-semibold text-[#B8BDB5] hover:bg-white/[0.06]"
              >
                Dismiss
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            className="fixed inset-0 bg-black/60 z-40 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ---------------- LEFT SIDEBAR ---------------- */}
      <AnimatePresence>
        {(sidebarOpen || true) && (
          <motion.aside
            className={`fixed lg:static z-50 lg:z-auto top-0 left-0 h-full w-[290px] shrink-0 border-r border-white/[0.06] bg-[#12140F]/95 backdrop-blur-xl flex flex-col overflow-y-auto transition-transform duration-300 ${
              sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
            }`}
          >
            <div className="p-5 border-b border-white/[0.06]">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2.5">
                  <div className="w-12 h-12 flex items-center justify-center">
  <Image
    src="/logo.png"
    alt="Lifafa Logo"
    width={48}
    height={48}
    className="rounded-full object-cover"
  />
</div>
                  <div>
                    <div className="font-[Space_Grotesk] font-bold text-[15px] text-[#F5F3EC] leading-tight">
                      E-BOWLA CLUB
                    </div>
                    <div className="flex items-center gap-1 text-[10px] font-semibold text-[#22A65A] uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#22A65A] animate-pulse" />
                      Live
                    </div>
                  </div>
                </div>
                <button className="lg:hidden text-[#8B9088]" onClick={() => setSidebarOpen(false)}>
                  <X size={18} />
                </button>
              </div>
              <div className="mt-3 font-mono">
                <div className="text-2xl font-bold text-[#F5F3EC] tabular-nums font-[Space_Grotesk]">
                  {formatClock(clockNow)}
                </div>
                <div className="text-[11px] text-[#8B9088]">{formatDate(clockNow)}</div>
              </div>
            </div>

            <div className="p-4 border-b border-white/[0.06]">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#8B9088] mb-2.5">
                Today&apos;s Analytics
              </div>
              <div className="grid grid-cols-2 gap-2">
                <AnalyticsCard icon={<ListOrdered size={14} />} value={stats.active} label="Active Orders" accent="#D4A72C" />
                <AnalyticsCard icon={<CheckCircle2 size={14} />} value={stats.completedSession} label="Completed" accent="#22A65A" />
                <AnalyticsCard icon={<Flame size={14} />} value={stats.pendingCount} label="Pending" accent="#E2622B" />
                <AnalyticsCard icon={<Timer size={14} />} value={`${stats.avgWait}m`} label="Avg Wait" accent="#9B8CE0" />
              </div>
            </div>

            <div className="p-4 border-b border-white/[0.06]">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#8B9088] mb-2.5">
                Last 7 Days
              </div>
              <div className="grid grid-cols-2 gap-2">
                <AnalyticsCard
                  icon={<CheckCircle2 size={14} />}
                  value={weeklyStats.count}
                  label="Completed"
                  accent="#22A65A"
                />
                <AnalyticsCard
                  icon={<IndianRupee size={14} />}
                  value={`₹${weeklyStats.revenue.toFixed(0)}`}
                  label="Revenue"
                  accent="#D4A72C"
                />
              </div>
            </div>

            <div className="p-4 border-b border-white/[0.06]">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#8B9088] mb-2.5">
                Kitchen Status
              </div>
              <LoadBar label="Kitchen Load" value={stats.kitchenLoad} color="#E2622B" />
              <LoadBar
                label="Preparing"
                value={orders.length ? Math.round((stats.preparingCount / orders.length) * 100) : 0}
                color="#D4A72C"
              />
              <LoadBar
                label="Ready"
                value={orders.length ? Math.round((stats.readyCount / orders.length) * 100) : 0}
                color="#22A65A"
              />
              <LoadBar
                label="Delayed"
                value={orders.length ? Math.round((stats.overdueList.length / orders.length) * 100) : 0}
                color="#D8432E"
              />
            </div>

            <div className="p-4 border-b border-white/[0.06]">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#8B9088] mb-2.5">
                Most Ordered (active)
              </div>
              {stats.topItems.length === 0 ? (
                <div className="text-[12px] text-[#5A605A]">No active items yet</div>
              ) : (
                stats.topItems.map(([name, qty]) => (
                  <div key={name} className="flex items-center justify-between text-[12px] mb-1.5">
                    <span className="text-[#D8DAD4] truncate">{name}</span>
                    <span className="font-[Space_Grotesk] font-bold text-[#F5F3EC]">{qty}</span>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-b border-white/[0.06]">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#8B9088] mb-2.5">Alerts</div>
              {alerts.map((a, i) => (
                <div key={i} className="flex items-center gap-2 text-[12px] text-[#D8DAD4] mb-1.5">
                  {a.icon}
                  <span className="truncate">{a.text}</span>
                </div>
              ))}
            </div>

            <div className="p-4 mt-auto">
              <div
                className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-[12px] font-semibold ${
                  connected ? "bg-[#22A65A]/10 text-[#6FCF97]" : "bg-[#D8432E]/10 text-[#F0837A]"
                }`}
              >
                {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
                {connected ? "Socket Connected" : "Reconnecting…"}
              </div>
              <div className="text-[10px] text-[#6B706A] mt-2 pl-1">
                Last sync: {lastSync ? lastSync.toLocaleTimeString() : "—"}
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ---------------- MAIN COLUMN ---------------- */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Header */}
        <header className="flex items-center gap-4 px-5 py-3.5 border-b border-white/[0.06] bg-[#0E100D]/90 backdrop-blur-xl shrink-0">
          <button className="lg:hidden text-[#B8BDB5]" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>

          <div className="flex items-center gap-2">
            <h1 className="font-[Space_Grotesk] font-bold text-[18px] text-[#F5F3EC]">Kitchen Dashboard</h1>
            <span className="hidden sm:flex items-center gap-1 rounded-full bg-[#22A65A]/15 text-[#6FCF97] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-[#6FCF97] animate-pulse" />
              Live
            </span>
          </div>

          <div className="hidden md:flex items-center gap-1.5 text-[12px] text-[#8B9088] font-mono">
            <Clock size={13} />
            {formatClock(clockNow)}
          </div>

          <div className="flex-1 max-w-md ml-2 relative hidden sm:block">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B706A]" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search order, table, or item…"
              className="w-full rounded-lg bg-white/[0.05] border border-white/[0.08] pl-9 pr-3 py-2 text-[13px] text-[#E5E7E1] placeholder:text-[#6B706A] outline-none focus:border-[#D4A72C]/50 transition-colors"
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => loadOrders()}
              className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[12px] font-semibold text-[#D8DAD4] hover:bg-white/[0.08] transition-colors"
            >
              <RefreshCw size={13} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={() => setSoundEnabled((v) => !v)}
              className="rounded-lg border border-white/[0.08] bg-white/[0.04] p-2 text-[#D8DAD4] hover:bg-white/[0.08] transition-colors"
              title={soundEnabled ? "Mute new-order sound" : "Unmute new-order sound"}
            >
              {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
            </button>
            <button className="relative rounded-lg border border-white/[0.08] bg-white/[0.04] p-2 text-[#D8DAD4] hover:bg-white/[0.08] transition-colors">
              <Bell size={15} />
              {stats.overdueList.length > 0 && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#D8432E] text-[8px] font-bold flex items-center justify-center text-white">
                  {stats.overdueList.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setRightPanelOpen((v) => !v)}
              className="hidden xl:flex rounded-lg border border-white/[0.08] bg-white/[0.04] p-2 text-[#D8DAD4] hover:bg-white/[0.08] transition-colors"
              title="Toggle activity panel"
            >
              {rightPanelOpen ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
            </button>
            <div className="w-8 h-8 rounded-full bg-white/[0.08] flex items-center justify-center text-[#D8DAD4]">
              <User size={15} />
            </div>
          </div>
        </header>

        {/* Search/filter bar */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.06] overflow-x-auto shrink-0">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilterKey(f.key)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors ${
                filterKey === f.key
                  ? "bg-[#D4A72C] text-[#141814]"
                  : "bg-white/[0.05] text-[#B8BDB5] hover:bg-white/[0.09]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Kanban board */}
        <div className="flex-1 min-h-0 px-5 py-4">
          <div className="grid grid-flow-col auto-cols-[85%] sm:auto-cols-[46%] lg:auto-cols-auto lg:grid-flow-row lg:grid-cols-4 gap-4 h-full overflow-x-auto lg:overflow-visible snap-x snap-mandatory lg:snap-none">
            {visibleColumns.map((col) => {
              const columnOrders = orders
                .filter((o) => o.status === col.status)
                .filter(matchesSearch)
                .filter(matchesFilter)
                .sort((a, b) => new Date(a.placedAt).getTime() - new Date(b.placedAt).getTime());

              return (
                <div
                  key={col.status}
                  className="snap-start flex flex-col min-w-0 h-full rounded-2xl border border-white/[0.06] bg-white/[0.02]"
                >
                  <div
                    className="flex items-center gap-2 px-4 py-3 border-b sticky top-0 bg-[#12140F]/80 backdrop-blur rounded-t-2xl"
                    style={{ borderColor: col.accent + "55" }}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ background: col.dot }} />
                    <h2 className="font-[Space_Grotesk] font-bold text-[13px] uppercase tracking-wider text-[#F5F3EC]">
                      {col.title}
                    </h2>
                    <span className="ml-auto font-mono text-[12px] font-bold text-[#8B9088]">
                      {columnOrders.length}
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto px-3 py-3">
                    <AnimatePresence mode="popLayout">
                      {columnOrders.length === 0 ? (
                        <div className="text-center text-[13px] text-[#5A605A] py-10">No orders</div>
                      ) : (
                        columnOrders.map((order) => (
                          <OrderCard
                            key={order.orderId}
                            order={order}
                            now={now}
                            isNew={newOrderIds.current.has(order.orderId)}
                            accent={col.accent}
                            onAdvance={handleAdvance}
                          />
                        ))
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })}

            {/* Completed column — sourced from this session's local activity only,
                since the backend feed (pending,preparing,ready) never returns
                completed orders once advanced. */}
            {filterKey === "all" && (
              <div className="snap-start flex flex-col min-w-0 h-full rounded-2xl border border-white/[0.06] bg-white/[0.02]">
                <div
                  className="flex items-center gap-2 px-4 py-3 border-b sticky top-0 bg-[#12140F]/80 backdrop-blur rounded-t-2xl"
                  style={{ borderColor: "#6B8CA655" }}
                >
                  <span className="w-2 h-2 rounded-full bg-[#6B8CA6]" />
                  <h2 className="font-[Space_Grotesk] font-bold text-[13px] uppercase tracking-wider text-[#F5F3EC]">
                    Completed
                  </h2>
                  <span className="ml-auto font-mono text-[12px] font-bold text-[#8B9088]">
                    {recentlyCompleted.length}
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto px-3 py-3">
                  {recentlyCompleted.length === 0 ? (
                    <div className="text-center text-[13px] text-[#5A605A] py-10">
                      Completed orders will appear here this session
                    </div>
                  ) : (
                    recentlyCompleted.map((c) => (
                      <div
                        key={c.orderId + c.completedAt}
                        className="mb-2.5 rounded-xl border border-white/[0.06] bg-[#181C16] px-3.5 py-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[13px] font-semibold text-[#D8DAD4]">
                            {c.tableLabel ?? "Table"}
                          </span>
                          <CheckCircle2 size={13} className="text-[#6B8CA6]" />
                        </div>
                        <div className="text-[11px] text-[#6B706A] font-mono mt-0.5">
                          #{c.orderId} · {new Date(c.completedAt).toLocaleTimeString()}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ---------------- RIGHT PANEL (desktop only) ---------------- */}
      {rightPanelOpen && (
        <aside className="hidden xl:flex flex-col w-[290px] shrink-0 border-l border-white/[0.06] bg-[#12140F]/95 backdrop-blur-xl overflow-y-auto">
          <div className="p-4 border-b border-white/[0.06]">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#8B9088] mb-2.5 flex items-center gap-1.5">
              <Activity size={12} /> Recent Activity
            </div>
            {activityLog.length === 0 ? (
              <div className="text-[12px] text-[#5A605A]">Nothing yet this session</div>
            ) : (
              activityLog.slice(0, 8).map((a) => (
                <div key={a.id} className="text-[12px] text-[#D8DAD4] mb-2 leading-snug">
                  {a.text}
                  <div className="text-[10px] text-[#6B706A]">{new Date(a.at).toLocaleTimeString()}</div>
                </div>
              ))
            )}
          </div>

          <div className="p-4 border-b border-white/[0.06]">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#8B9088] mb-2.5">
              Latest Orders
            </div>
            {orders
              .slice()
              .sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime())
              .slice(0, 5)
              .map((o) => (
                <div key={o.orderId} className="flex items-center justify-between text-[12px] mb-2">
                  <span className="text-[#D8DAD4] truncate">{o.tableLabel ?? `#${o.orderId}`}</span>
                  <span className="text-[#6B706A] font-mono">{elapsedMinutes(o.placedAt, now)}m</span>
                </div>
              ))}
            {orders.length === 0 && <div className="text-[12px] text-[#5A605A]">No active orders</div>}
          </div>

          <div className="p-4 border-b border-white/[0.06]">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#8B9088] mb-2.5">
              Notifications
            </div>
            {alerts.map((a, i) => (
              <div key={i} className="flex items-center gap-2 text-[12px] text-[#D8DAD4] mb-1.5">
                {a.icon}
                <span className="truncate">{a.text}</span>
              </div>
            ))}
          </div>

          <div className="p-4 border-b border-white/[0.06]">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#8B9088] mb-2.5">
              Quick Actions
            </div>
            <button
              onClick={() => loadOrders()}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] px-3 py-2 text-[12px] font-semibold text-[#D8DAD4] mb-2 transition-colors"
            >
              <RefreshCw size={13} /> Refresh Board
            </button>
            <button
              onClick={() => {
                setSearchQuery("");
                setFilterKey("all");
              }}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] px-3 py-2 text-[12px] font-semibold text-[#D8DAD4] transition-colors"
            >
              <ChevronLeft size={13} /> Clear Filters
            </button>
          </div>

          <div className="p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#8B9088] mb-2.5">
              Recently Completed
            </div>
            {recentlyCompleted.slice(0, 5).map((c) => (
              <div key={c.orderId + c.completedAt} className="flex items-center justify-between text-[12px] mb-1.5">
                <span className="text-[#D8DAD4] truncate">{c.tableLabel ?? `#${c.orderId}`}</span>
                <ChevronRight size={12} className="text-[#6B706A]" />
              </div>
            ))}
            {recentlyCompleted.length === 0 && (
              <div className="text-[12px] text-[#5A605A]">None yet this session</div>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}