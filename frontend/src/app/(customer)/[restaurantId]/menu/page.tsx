"use client";

import { useMemo, useCallback, useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import BackgroundDecor from "@/components/customer/BackgroundDecor";
import RestaurantHeader from "@/components/customer/RestaurantHeader";
import SearchBar from "@/components/customer/SearchBar";
import FilterTabs, { FilterValue } from "@/components/customer/FilterTabs";
import CategoryHeader from "@/components/customer/CategoryHeader";
import FoodCard from "@/components/customer/FoodCard";
import FloatingCart from "@/components/customer/FloatingCart";
import CategoryDrawer from "@/components/customer/CategoryDrawer";
import { menu as mockMenu, type MenuItem, type MenuCategory } from "@/lib/menu-data";
import { useCartStore } from "@/store/cart-store";
import { fetchMenu } from "@/lib/api";

export default function Home() {
  const params = useParams<{ restaurantId: string }>();
  const searchParams = useSearchParams();
  const restaurantId = params.restaurantId ?? "cafe-001";
  const tableToken = searchParams.get("table");

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterValue>("all");
  const [liveMenu, setLiveMenu] = useState<MenuCategory[] | null>(null);

  const {
    items,
    addItem,
    removeItem,
    totalItems,
    subtotal,
    setTableToken,
  } = useCartStore();

  // Capture the table identity from the QR code URL (?table=tbl_xxx) as
  // soon as the menu page loads, so it's already in cart-store by the time
  // the customer checks out — even if they never look at the cart until then.
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
      addItem(item, restaurantId, tableToken ?? undefined);
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
        <RestaurantHeader />

        <div className="sticky top-0 z-10 space-y-3 bg-bg-primary/90 px-6 pb-4 pt-2 backdrop-blur-[2px]">
          <SearchBar
            value={search}
            onChange={setSearch}
          />

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
                    const quantity =
                      items.find(
                        (e) =>
                          e.item.id === item.id
                      )?.quantity ?? 0;

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
    </main>
  );
}