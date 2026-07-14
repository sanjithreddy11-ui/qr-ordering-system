"use client";

import { useMemo, useCallback, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Users } from "lucide-react";
import BackgroundDecor from "@/components/customer/BackgroundDecor";
import RestaurantHeader from "@/components/customer/RestaurantHeader";
import SearchBar from "@/components/customer/SearchBar";
import FilterTabs, { FilterValue } from "@/components/customer/FilterTabs";
import CategoryHeader from "@/components/customer/CategoryHeader";
import FoodCard from "@/components/customer/FoodCard";
import FloatingCart from "@/components/customer/FloatingCart";
import CategoryDrawer from "@/components/customer/CategoryDrawer";
import WaiterCallButton from "@/components/customer/WaiterCallButton";
import GroupOrderDrawer from "@/components/customer/GroupOrderDrawer";
import { menu as mockMenu, type MenuItem, type MenuCategory } from "@/lib/menu-data";
import { useCartStore } from "@/store/cart-store";
import { useSessionStore } from "@/store/session-store";
import { useGroupOrderStore } from "@/store/group-order-store";
import { useCustomerNavigate } from "@/lib/customer-nav";
import { fetchMenu } from "@/lib/api";

export default function MenuPage() {
  // Sourced from the session store — NOT useSearchParams(). The table
  // token was already read once by the [restaurantId] layout; every page
  // after that reuses the stored value so it never goes stale or "null".
  const { restaurantSlug, tableToken } = useSessionStore();
  const restaurantId = restaurantSlug ?? "lifafa";
  const goTo = useCustomerNavigate();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterValue>("all");
  const [liveMenu, setLiveMenu] = useState<MenuCategory[] | null>(null);
  const [groupOrderOpen, setGroupOrderOpen] = useState(false);

  const {
    items,
    addItem,
    removeItem,
    totalItems,
    subtotal,
    setTableToken,
  } = useCartStore();

  const {
    active: groupActive,
    participants,
    addItem: groupAddItem,
    removeItem: groupRemoveItem,
    quantityFor: groupQuantityFor,
    totalItems: groupTotalItems,
    totalSubtotal: groupTotalSubtotal,
  } = useGroupOrderStore();

  // Mirror the session's restaurant/table identity into cart-store, since
  // cart-store's own addItem() signature still expects them (kept as-is
  // per existing cart logic). session-store is the source of truth here,
  // not the URL.
  useEffect(() => {
    if (restaurantId && tableToken) {
      setTableToken(restaurantId, tableToken);
    }
  }, [restaurantId, tableToken, setTableToken]);

  // Try loading the live menu from the backend. If the backend isn't
  // running yet (e.g. you're still developing the UI), silently fall back
  // to the local mock data so the page never breaks.
  useEffect(() => {
    let cancelled = false;
    fetchMenu(restaurantId)
      .then((data) => {
        if (!cancelled && data.length > 0) setLiveMenu(data);
      })
      .catch(() => {
        // Backend not reachable — keep using mock data, no user-facing error.
      });
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  const menu = liveMenu ?? mockMenu;

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
      if (groupActive) {
        groupAddItem(item);
        return;
      }
      addItem(item, restaurantId, tableToken ?? undefined);
    },
    [addItem, restaurantId, tableToken, groupActive, groupAddItem]
  );

  const handleRemove = useCallback(
    (item: MenuItem) => {
      if (groupActive) {
        groupRemoveItem(item);
        return;
      }
      removeItem(item);
    },
    [removeItem, groupActive, groupRemoveItem]
  );

  const handleCategorySelect = (id: string) => {
    const el = document.getElementById(`category-${id}`);
    el?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <main className="relative min-h-dvh pb-32">
      <BackgroundDecor />

      {/* Back button — replaces the bottom nav on this page, since the
          menu has its own floating category-jump button instead. */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8, x: -8 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 28 }}
        whileTap={{ scale: 0.92 }}
        onClick={() => goTo("/")}
        className="fixed left-4 top-4 z-[1100] flex h-11 w-11 items-center justify-center rounded-full"
        style={{
          background: "rgba(255,255,255,0.65)",
          border: "1px solid rgba(255,255,255,0.5)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.12), inset 0 1px 1px rgba(255,255,255,0.8)",
        }}
        aria-label="Back to Home"
      >
        <ArrowLeft size={19} strokeWidth={2.2} color="#263429" />
      </motion.button>

      <WaiterCallButton
        restaurantId={restaurantId}
        tableToken={tableToken}
      />

      <div className="relative z-10">
        <RestaurantHeader />

        {/* Sticky search + filter header. Pinned to the top of the
            viewport on scroll — bg + blur so content scrolling underneath
            never shows through. z-30 keeps it above menu content but below
            the back button (z-[1100]) and drawers (z-40/50). */}
        <div className="sticky top-0 z-30 space-y-3 bg-bg-primary/95 px-6 pb-4 pt-2 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="min-w-0 flex-1">
              <SearchBar value={search} onChange={setSearch} />
            </div>

            {/* Group order trigger — beside the search bar instead of
                floating separately over the menu content. */}
            <motion.button
              type="button"
              aria-label="Group order"
              onClick={() => setGroupOrderOpen(true)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
              whileTap={{ scale: 0.95 }}
              className="relative flex h-[52px] shrink-0 items-center justify-center rounded-[22px] border border-border-soft bg-bg-secondary px-3.5"
              style={{ boxShadow: "0 6px 20px rgba(0,0,0,0.04)" }}
            >
              <Users size={18} strokeWidth={1.75} className="text-green-primary" />
              {groupActive && (
                <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-green-primary px-1 text-[9px] font-bold text-bg-primary">
                  {participants.length}
                </span>
              )}
            </motion.button>
          </div>

          <FilterTabs
            value={filter}
            onChange={setFilter}
          />
        </div>

        <div className="px-6">
          {filteredMenu.length === 0 && (
            <p className="font-body py-16 text-center text-[14px] text-text-secondary">
              No dishes match your search.
            </p>
          )}

          {filteredMenu.map((category, idx) => (
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
                    const quantity = groupActive
                      ? groupQuantityFor(item.id)
                      : items.find((e) => e.item.id === item.id)?.quantity ?? 0;

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

      <GroupOrderDrawer
        restaurantId={restaurantId}
        tableToken={tableToken}
        open={groupOrderOpen}
        onClose={() => setGroupOrderOpen(false)}
      />

      <FloatingCart
        itemCount={groupActive ? groupTotalItems() : totalItems()}
        total={groupActive ? groupTotalSubtotal() : subtotal()}
      />
    </main>
  );
}