"use client";

import { useMemo, useCallback, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Home } from "lucide-react";
import BackgroundDecor from "@/components/customer/BackgroundDecor";
import RestaurantHeader from "@/components/customer/RestaurantHeader";
import SearchBar from "@/components/customer/SearchBar";
import FilterTabs, { FilterValue } from "@/components/customer/FilterTabs";
import CategoryHeader from "@/components/customer/CategoryHeader";
import FoodCard from "@/components/customer/FoodCard";
import FloatingCart from "@/components/customer/FloatingCart";
import CategoryDrawer from "@/components/customer/CategoryDrawer";
import WaiterCallButton from "@/components/customer/WaiterCallButton";
import ModifierModal from "@/components/customer/ModifierModal";
import { menu as mockMenu, requiresCustomization, type MenuItem, type MenuCategory, type SelectedModifier } from "@/lib/menu-data";
import { useCartStore } from "@/store/cart-store";
import { useSessionStore } from "@/store/session-store";
import { useCustomerNavigate } from "@/lib/customer-nav";
import { RESTAURANT_ID } from "@/constants/restaurant";
import { fetchMenu, fetchTableByToken } from "@/lib/api";

export default function MenuPage() {
  // Sourced from the session store — NOT useSearchParams(). The table
  // token was already read once by the customer layout; every page after
  // that reuses the stored value so it never goes stale or "null".
  const { restaurantSlug, tableToken } = useSessionStore();
  const restaurantId = restaurantSlug ?? RESTAURANT_ID;
  const goTo = useCustomerNavigate();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterValue>("all");
  // null = "haven't heard back yet" (show a skeleton, not mock data).
  // Real data (or the mock fallback) is only committed to state ONCE the
  // fetch settles, so the menu with real content only ever renders a
  // single time — no swap, no remount, no flicker.
  const [liveMenu, setLiveMenu] = useState<MenuCategory[] | null>(null);
  const [menuLoading, setMenuLoading] = useState(true);
  const [tableLabel, setTableLabel] = useState<string | null>(null);
  // Menu Item Customization (Modifiers): the item currently open in the
  // customization modal, or null when it's closed. Set by handleAdd
  // whenever a customizable item's "+" is tapped — see FoodCard.tsx.
  const [modalItem, setModalItem] = useState<MenuItem | null>(null);

  const {
    items,
    addItem,
    removeItem,
    totalItems,
    subtotal,
    setTableToken,
  } = useCartStore();

  // Mirror the session's restaurant/table identity into cart-store, since
  // cart-store's own addItem() signature still expects them (kept as-is
  // per existing cart logic). session-store is the source of truth here,
  // not the URL.
  useEffect(() => {
    if (restaurantId && tableToken) {
      setTableToken(restaurantId, tableToken);
    }
  }, [restaurantId, tableToken, setTableToken]);

  // Resolve the real table label ("Table 5") from the QR token, so the
  // waiter-call notification shown to staff never shows the raw token
  // (previously WaiterCallButton fell back to tableToken when no label
  // was supplied — this fills that in).
  useEffect(() => {
    if (!tableToken) return;
    let cancelled = false;
    fetchTableByToken(tableToken)
      .then((table) => {
        if (!cancelled) setTableLabel(table.label);
      })
      .catch(() => {
        // Leave tableLabel null — WaiterCallButton falls back to the
        // token rather than showing nothing.
      });
    return () => {
      cancelled = true;
    };
  }, [tableToken]);

  // Try loading the live menu from the backend. If the backend isn't
  // running yet (e.g. you're still developing the UI), silently fall back
  // to the local mock data so the page never breaks. Either way, we only
  // set state ONCE the outcome is known — we never paint mock data first
  // and then swap it for different (differently-keyed) live data, which
  // is what was causing the full category/card remount flicker.
  useEffect(() => {
    let cancelled = false;
    fetchMenu(restaurantId)
      .then((data) => {
        if (cancelled) return;
        setLiveMenu(data.length > 0 ? data : mockMenu);
      })
      .catch(() => {
        // Backend not reachable — fall back to mock data, no user-facing error.
        if (!cancelled) setLiveMenu(mockMenu);
      })
      .finally(() => {
        if (!cancelled) setMenuLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  const menu = liveMenu ?? [];

  const filteredMenu = useMemo(() => {
    const q = search.trim().toLowerCase();

    return menu
      .map((category) => ({
        ...category,
        items: category.items.filter((item) => {
          const matchesDiet =
            filter === "all" || item.diet === filter;

          const matchesSearch =
            !q ||
            item.name.toLowerCase().includes(q) ||
            item.description.toLowerCase().includes(q);

          return matchesDiet && matchesSearch;
        }),
      }))
      .filter((category) => category.items.length > 0);
  }, [search, filter, menu]);

  const handleAdd = useCallback(
    (item: MenuItem) => {
      // Menu Item Customization (Modifiers): a customizable item is NEVER
      // added directly — the "+" always opens the required-selection
      // modal first (see ModifierModal.tsx), no matter how many are
      // already in the cart. A plain item still adds straight to cart,
      // completely unchanged from before this feature existed.
      if (requiresCustomization(item)) {
        setModalItem(item);
        return;
      }
      addItem(item, undefined, restaurantId, tableToken ?? undefined);
    },
    [addItem, restaurantId, tableToken]
  );

  const handleConfirmModifiers = useCallback(
    (item: MenuItem, modifiers: SelectedModifier[]) => {
      addItem(item, modifiers, restaurantId, tableToken ?? undefined);
      setModalItem(null);
    },
    [addItem, restaurantId, tableToken]
  );

  const handleRemove = useCallback(
    (item: MenuItem) => {
      removeItem(item);
    },
    [removeItem]
  );

  const handleCategorySelect = (id: string) => {
    const el = document.getElementById(`category-${id}`);
    el?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <main className="relative min-h-dvh overflow-x-clip pb-32">
      <BackgroundDecor />

      <div className="relative z-10">
        {/* Back button — in normal document flow now (not fixed), so it
            scrolls away with the header instead of staying pinned to the
            viewport. */}
        <motion.button
          initial={{ opacity: 0, scale: 0.8, x: -8 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 28 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => goTo("/")}
          className="absolute left-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full"
          style={{
            background: "rgba(255,255,255,0.65)",
            border: "1px solid rgba(255,255,255,0.5)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12), inset 0 1px 1px rgba(255,255,255,0.8)",
          }}
          aria-label="Back to Home"
        >
          <Home size={19} strokeWidth={2.2} color="#263429" />
        </motion.button>

        <RestaurantHeader />

        {/* Sticky search + filter header. Pinned to the top of the
            viewport on scroll — bg + blur so content scrolling underneath
            never shows through. */}
        <div className="sticky top-0 z-30 space-y-3 bg-bg-primary/95 px-6 pb-4 pt-2 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="min-w-0 flex-1">
              <SearchBar value={search} onChange={setSearch} />
            </div>

            {/* Waiter-call button lives here now, beside the search bar
                (replaces the old group-order trigger in this spot). */}
            <WaiterCallButton
              restaurantId={restaurantId}
              tableToken={tableToken}
              tableLabel={tableLabel}
              variant="inline"
            />
          </div>

          <FilterTabs
            value={filter}
            onChange={setFilter}
          />
        </div>

        <div className="px-6">
          {menuLoading && (
            <div className="flex flex-col gap-4 py-8" aria-label="Loading menu">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-28 w-full animate-pulse rounded-2xl bg-bg-secondary"
                />
              ))}
            </div>
          )}

          {!menuLoading && filteredMenu.length === 0 && (
            <p className="font-body py-16 text-center text-[14px] text-text-secondary">
              No dishes match your search.
            </p>
          )}

          {!menuLoading && filteredMenu.map((category, idx) => (
            <section
              key={category.id}
              id={`category-${category.id}`}
              className="mb-4 scroll-mt-[150px]"
            >
              <CategoryHeader
                title={category.title}
                birdSide={
                  idx % 2 === 0
                    ? "right"
                    : "left"
                }
              />

              <div className="flex flex-col gap-4 pb-8">
                {category.items.map(
                  (item, itemIdx) => {
                    // Menu Item Customization (Modifiers): a customizable
                    // item can have several cart lines at once (one per
                    // sauce chosen) — sum across all of them for the
                    // badge shown on this card, rather than only finding
                    // the first matching entry.
                    const quantity = items
                      .filter((e) => e.item.id === item.id)
                      .reduce((sum, e) => sum + e.quantity, 0);

                    return (
                      <FoodCard
                        key={item.id}
                        item={item}
                        quantity={quantity}
                        onAdd={handleAdd}
                        onRemove={handleRemove}
                        index={itemIdx}
                      />
                    );
                  }
                )}
              </div>
            </section>
          ))}
        </div>
      </div>

      <CategoryDrawer
        categories={menu.map((c) => ({
          id: c.id,
          title: c.title,
        }))}
        onSelect={handleCategorySelect}
      />

      <FloatingCart
        itemCount={totalItems()}
        total={subtotal()}
      />

      <ModifierModal
        item={modalItem}
        onCancel={() => setModalItem(null)}
        onConfirm={handleConfirmModifiers}
      />
    </main>
  );
}