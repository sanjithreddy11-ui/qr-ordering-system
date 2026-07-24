"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus } from "lucide-react";
import { PageHeader, adminColors } from "@/components/admin/ui";
import { getSocket } from "@/lib/socket";
import {
  fetchTableGrid,
  fetchTableAnalytics,
  type TableGridItem,
  type TableAnalyticsData,
  type TableStatus,
} from "@/lib/admin-api";
import TableCard from "@/components/admin/tables/TableCard";
import TableDetailsDrawer from "@/components/admin/tables/TableDetailsDrawer";
import ReservationForm from "@/components/admin/tables/ReservationForm";
import TableAnalyticsPanel from "@/components/admin/tables/TableAnalyticsPanel";
import ReservationCalendar from "@/components/admin/tables/ReservationCalendar";
import QrCodesTab from "@/components/admin/tables/QrCodesTab";
import { STATUS_FILTERS, STATUS_META } from "@/components/admin/tables/tableStatus";
import { TablePrimaryButton } from "@/components/admin/tables/tableButtons";

const RESTAURANT_ID = "maxibrew"; // TODO: make dynamic if you support multiple restaurants

type Tab = "grid" | "reservations" | "qr";

// Socket events that should trigger a live refresh of the table grid /
// analytics. Kept as a flat list so adding a new emit on the backend only
// means adding one string here.
const LIVE_EVENTS = [
  "tableOccupied",
  "tableReserved",
  "tableAvailable",
  "tableCleaning",
  "tableBilling",
  "tableOutOfService",
  "reservationCreated",
  "reservationUpdated",
  "reservationCancelled",
  "reservationCheckedIn",
  "sessionStarted",
  "sessionEnded",
  "sessionPaymentUpdated",
  "new-order",
  "order-status-updated",
];

export default function AdminTablesPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("grid");

  const [tables, setTables] = useState<TableGridItem[]>([]);
  const [analytics, setAnalytics] = useState<TableAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TableStatus | "all">("all");

  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [showReservationForm, setShowReservationForm] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const anyModalOpen = Boolean(selectedTableId) || showReservationForm;

  const load = useCallback(async () => {
    // Grid comes back numerically sorted by table number from the backend
    // (Table 1, 2, 3 ... 10 — not "1, 10, 2" string order).
    const [grid, stats] = await Promise.all([
      fetchTableGrid(RESTAURANT_ID),
      fetchTableAnalytics(RESTAURANT_ID).catch(() => null),
    ]);
    setTables(grid);
    if (stats) setAnalytics(stats);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Live updates: join the tables room and refetch on any relevant event.
  // Refetching the whole grid (rather than patching individual tables) is
  // deliberately simple/robust — table counts here are small enough that a
  // full refetch per event is cheap and can't drift out of sync.
  useEffect(() => {
    const socket = getSocket();
    socket.emit("join-tables", RESTAURANT_ID);

    const handler = () => load();
    LIVE_EVENTS.forEach((evt) => socket.on(evt, handler));

    return () => {
      LIVE_EVENTS.forEach((evt) => socket.off(evt, handler));
      socket.emit("leave-tables", RESTAURANT_ID);
    };
  }, [load]);

  // Defensive fix for the reported "typing in the reservation form also
  // fills the search bar" bug: even though the search input and the
  // reservation form fields are already fully separate React state, a
  // modal that never moves keyboard focus into itself can leave the
  // browser's focus sitting on the search input underneath, so keystrokes
  // land there instead. Explicitly blurring (and disabling) the search
  // input for the duration that any table modal is open makes this
  // impossible regardless of focus timing.
  useEffect(() => {
    if (anyModalOpen) searchInputRef.current?.blur();
  }, [anyModalOpen]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tables.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (!q) return true;
      const customer = t.activeSession?.customerName || t.activeReservation?.customerName || "";
      const phone = t.activeSession?.phoneNumber || t.activeReservation?.phoneNumber || "";
      return (
        t.label.toLowerCase().includes(q) ||
        customer.toLowerCase().includes(q) ||
        phone.toLowerCase().includes(q)
      );
    });
  }, [tables, search, statusFilter]);

  const tableLabelById = useMemo(() => new Map(tables.map((t) => [t._id, t.label])), [tables]);
  const availableTables = useMemo(() => tables.filter((t) => t.status === "available"), [tables]);

  // Table Click Behaviour: an occupied/billing table has an active dining
  // session worth its own full page (order history, running bill, payment
  // workflow). Any other status (available/reserved/cleaning/out of
  // service) has nothing session-shaped to show, so it keeps using the
  // lightweight details modal for quick status actions.
  const handleTableClick = (table: TableGridItem) => {
    if (table.status === "occupied" || table.status === "billing") {
      router.push(`/dashboard/tables/session/${table._id}`);
    } else {
      setSelectedTableId(table._id);
    }
  };

  return (
    <div>
      <PageHeader
        title="Tables"
        description="Live table status, dining sessions, and reservations"
        action={
          <TablePrimaryButton onClick={() => setShowReservationForm(true)}>
            <Plus size={15} /> Reserve Table
          </TablePrimaryButton>
        }
      />

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {(
          [
            { key: "grid", label: "Table Grid" },
            { key: "reservations", label: "Reservations" },
            { key: "qr", label: "QR Codes" },
          ] as { key: Tab; label: string }[]
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "8px 16px",
              borderRadius: 10,
              border: `1px solid ${tab === t.key ? adminColors.primary : adminColors.border}`,
              background: tab === t.key ? adminColors.primary : "#FFFFFF",
              color: tab === t.key ? "#FFFFFF" : adminColors.text,
              fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "grid" && (
        <>
          {analytics && <TableAnalyticsPanel analytics={analytics} />}

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 18, alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                borderRadius: 10,
                border: `1px solid ${adminColors.border}`,
                background: anyModalOpen ? adminColors.bg : "#FFFFFF",
                flex: "1 1 240px",
              }}
            >
              <Search size={14} color={adminColors.textSecondary} />
              <input
                ref={searchInputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={anyModalOpen}
                placeholder="Search table, customer, or phone"
                style={{
                  border: "none",
                  outline: "none",
                  flex: 1,
                  background: "transparent",
                  fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
                  fontSize: 13,
                  color: adminColors.text,
                }}
              />
            </div>

            <FilterChip label="All" active={statusFilter === "all"} onClick={() => setStatusFilter("all")} />
            {STATUS_FILTERS.map((s) => (
              <FilterChip
                key={s}
                label={STATUS_META[s].label}
                color={STATUS_META[s].color}
                active={statusFilter === s}
                onClick={() => setStatusFilter(s)}
              />
            ))}
          </div>

          {loading && (
            <p style={{ fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)", fontSize: 13, color: adminColors.textSecondary }}>
              Loading…
            </p>
          )}

          {!loading && filtered.length === 0 && (
            <p style={{ fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)", fontSize: 13, color: adminColors.textSecondary }}>
              No tables match your search/filter.
            </p>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
              gap: 16,
            }}
          >
            {filtered.map((table) => (
              <TableCard
                key={table._id}
                table={table}
                onClick={() => handleTableClick(table)}
                onDeleted={load}
              />
            ))}
          </div>
        </>
      )}

      {tab === "reservations" && (
        <ReservationCalendar restaurantId={RESTAURANT_ID} tableLabelById={tableLabelById} onChanged={load} />
      )}

      {tab === "qr" && <QrCodesTab RESTAURANT_ID={RESTAURANT_ID} />}

      {selectedTableId && (
        <TableDetailsDrawer tableId={selectedTableId} onClose={() => setSelectedTableId(null)} onChanged={load} />
      )}

      {showReservationForm && (
        <ReservationForm
          restaurantId={RESTAURANT_ID}
          availableTables={availableTables}
          onClose={() => setShowReservationForm(false)}
          onCreated={() => {
            setShowReservationForm(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
  color,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 12px",
        borderRadius: 999,
        border: `1px solid ${active ? color || adminColors.primary : adminColors.border}`,
        background: active ? `${color || adminColors.primary}1A` : "#FFFFFF",
        color: active ? color || adminColors.primary : adminColors.textSecondary,
        fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}
