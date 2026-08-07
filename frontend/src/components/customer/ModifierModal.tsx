"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { X, Check } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { MenuItem, SelectedModifier } from "@/lib/menu-data";

interface Props {
  item: MenuItem | null;
  onCancel: () => void;
  onConfirm: (item: MenuItem, modifiers: SelectedModifier[]) => void;
}

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

// Menu Item Customization (Modifiers): the required-selection modal shown
// before a customizable item (e.g. "Chicken Penne Pasta") can be added to
// the cart. Fully generic and data-driven off `item.modifierGroups` —
// nothing here is hardcoded to sauces, so the exact same modal works for
// any future modifier group without a code change.
export default function ModifierModal({ item, onCancel, onConfirm }: Props) {
  // { [groupId]: optionId[] }
  const [selections, setSelections] = useState<Record<string, string[]>>({});

  const groups = item?.modifierGroups ?? [];

  // Reset local selection state whenever a different item opens the modal.
  const openItemId = item?.id ?? null;
  const [trackedItemId, setTrackedItemId] = useState<string | null>(null);
  if (openItemId !== trackedItemId) {
    setTrackedItemId(openItemId);
    if (openItemId) setSelections({});
  }

  const missingRequiredGroups = useMemo(() => {
    return groups.filter((g) => g.required && (selections[g.id]?.length ?? 0) === 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `groups` is derived fresh from `item` each render; depending on `item` avoids an unnecessary array-identity dependency warning while keeping the same recompute behavior.
  }, [item, selections]);

  const canConfirm = missingRequiredGroups.length === 0;

  function toggleOption(groupId: string, optionId: string, selectionType: "single" | "multiple") {
    setSelections((prev) => {
      const current = prev[groupId] ?? [];
      if (selectionType === "single") {
        return { ...prev, [groupId]: [optionId] };
      }
      const next = current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId];
      return { ...prev, [groupId]: next };
    });
  }

  function handleConfirm() {
    if (!item || !canConfirm) return;
    const modifiers: SelectedModifier[] = [];
    for (const group of groups) {
      const selectedIds = selections[group.id] ?? [];
      for (const optionId of selectedIds) {
        const option = group.options.find((o) => o.id === optionId);
        if (!option) continue;
        modifiers.push({
          groupId: group.id,
          groupName: group.name,
          optionId: option.id,
          optionName: option.name,
          priceDelta: option.priceDelta,
        });
      }
    }
    onConfirm(item, modifiers);
  }

  return (
    <AnimatePresence>
      {item && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/45 backdrop-blur-sm"
            onClick={onCancel}
          />

          {/* Sheet / Card */}
          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="relative z-10 flex max-h-[86vh] w-full flex-col overflow-hidden rounded-t-[28px] bg-bg-primary shadow-2xl sm:max-w-[420px] sm:rounded-[28px]"
          >
            {/* Header */}
            <div className="flex items-start gap-3 border-b border-border-soft/70 p-5">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[14px] bg-bg-secondary">
                {item.image && (
                  <Image src={item.image} alt={item.name} fill className="object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-[18px] font-semibold leading-tight text-text-primary">
                  {item.name}
                </h2>
                <span className="font-body text-[14px] font-semibold text-text-secondary">
                  ₹ {item.price}
                </span>
              </div>
              <button
                type="button"
                onClick={onCancel}
                aria-label="Cancel customization"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-bg-secondary"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            {/* Modifier groups */}
            <div className="flex-1 overflow-y-auto p-5">
              {groups.map((group) => (
                <div key={group.id} className="mb-6 last:mb-0">
                  <div className="mb-3 flex items-baseline justify-between gap-2">
                    <h3 className="font-display text-[15px] font-semibold text-text-primary">
                      {group.name}
                      {group.required && <span className="ml-1 text-[13px] text-green-primary">*</span>}
                    </h3>
                    <span className="font-body text-[12px] text-text-secondary">
                      {group.required
                        ? group.selectionType === "single"
                          ? "Select 1"
                          : "Required"
                        : "Optional"}
                    </span>
                  </div>

                  <div className="flex flex-col gap-2">
                    {group.options.map((option) => {
                      const isSelected = (selections[group.id] ?? []).includes(option.id);
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => toggleOption(group.id, option.id, group.selectionType)}
                          className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
                            isSelected
                              ? "border-green-primary bg-green-primary/[0.08]"
                              : "border-border-soft bg-bg-secondary/40"
                          }`}
                        >
                          <span className="font-body text-[14px] font-medium text-text-primary">
                            {option.name}
                            {option.priceDelta > 0 && (
                              <span className="ml-2 text-[13px] text-text-secondary">
                                +₹{option.priceDelta}
                              </span>
                            )}
                          </span>
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center border ${
                              group.selectionType === "single" ? "rounded-full" : "rounded-[6px]"
                            } ${
                              isSelected
                                ? "border-green-primary bg-green-primary"
                                : "border-border-soft bg-transparent"
                            }`}
                          >
                            {isSelected && <Check size={12} strokeWidth={3} className="text-bg-primary" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3 border-t border-border-soft/70 p-5">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 rounded-full border border-border-soft py-3 text-center font-body text-[15px] font-semibold text-text-primary transition-colors hover:bg-bg-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!canConfirm}
                className="flex-1 rounded-full bg-green-primary py-3 text-center font-body text-[15px] font-semibold text-bg-primary transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
              >
                Add to Cart
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
