"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Link2, Plus, X } from "lucide-react";
import { Card, PrimaryButton, SecondaryButton, Select, Modal, Badge, adminColors } from "@/components/admin/ui";
import {
  fetchAdminMenuItems,
  AdminMenuItem,
  fetchIngredients,
  Ingredient,
  fetchRecipe,
  saveRecipe,
  Recipe,
} from "@/lib/admin-api";

const bodyFont = "var(--font-body, 'Inter', system-ui, sans-serif)";

type DraftLine = { ingredientId: string; quantityPerUnit: string };

// Maps each menu item to the ingredients (and quantities) one unit of it
// consumes — this is what powers automatic stock deduction (see backend
// services/stockService.js:deductStockForOrder) and the "hide when it
// can't be prepared" behavior on the public menu.
export default function RecipesManager({ restaurantId }: { restaurantId: string }) {
  const [menuItems, setMenuItems] = useState<AdminMenuItem[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recipeCounts, setRecipeCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<AdminMenuItem | null>(null);
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([fetchAdminMenuItems(restaurantId, {}), fetchIngredients(restaurantId)])
      .then(async ([menuPage, ingredientList]) => {
        setMenuItems(menuPage.items);
        setIngredients(ingredientList);

        // Recipe existence per item, so the list can show "N ingredients
        // mapped" without opening the editor for every item.
        const entries = await Promise.all(
          menuPage.items.map(async (item) => {
            const recipe = await fetchRecipe(restaurantId, item.id).catch(() => null);
            return [item.id, recipe?.ingredients.length ?? 0] as const;
          })
        );
        setRecipeCounts(Object.fromEntries(entries));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [restaurantId]);

  useEffect(() => {
    queueMicrotask(load);
  }, [load]);

  const openEditor = async (item: AdminMenuItem) => {
    setEditingItem(item);
    setError(null);
    const recipe: Recipe | null = await fetchRecipe(restaurantId, item.id).catch(() => null);
    setDraftLines(
      recipe?.ingredients.map((l) => ({ ingredientId: l.ingredientId, quantityPerUnit: String(l.quantityPerUnit) })) ?? []
    );
  };

  const addLine = () => {
    if (ingredients.length === 0) return;
    setDraftLines((lines) => [...lines, { ingredientId: ingredients[0].id, quantityPerUnit: "" }]);
  };

  const updateLine = (idx: number, updates: Partial<DraftLine>) => {
    setDraftLines((lines) => lines.map((l, i) => (i === idx ? { ...l, ...updates } : l)));
  };

  const removeLine = (idx: number) => {
    setDraftLines((lines) => lines.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!editingItem) return;
    setSaving(true);
    setError(null);
    try {
      const payload = draftLines
        .filter((l) => l.ingredientId && Number(l.quantityPerUnit) > 0)
        .map((l) => ({ ingredientId: l.ingredientId, quantityPerUnit: Number(l.quantityPerUnit) }));

      await saveRecipe(restaurantId, editingItem.id, payload);
      setEditingItem(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const ingredientOptions = ingredients.map((i) => ({ value: i.id, label: `${i.name} (${i.unit})` }));
  const ingredientById = new Map(ingredients.map((i) => [i.id, i]));

  return (
    <div>
      <p style={{ fontFamily: bodyFont, fontSize: 13, color: adminColors.textSecondary, marginBottom: 16 }}>
        Link each menu item to the ingredients (and quantities) it uses. Once mapped, stock is deducted
        automatically on every order, and the item is hidden from customers if it can&apos;t currently be prepared.
      </p>

      {loading && <p style={{ fontFamily: bodyFont, fontSize: 13, color: adminColors.textSecondary }}>Loading…</p>}

      {!loading && menuItems.length === 0 && (
        <Card>
          <p style={{ fontFamily: bodyFont, fontSize: 13, color: adminColors.textSecondary, margin: 0 }}>
            No menu items yet — add items on the Menu page first.
          </p>
        </Card>
      )}

      {menuItems.length > 0 && (
        <Card style={{ padding: 0 }}>
          {menuItems.map((item, idx) => {
            const count = recipeCounts[item.id] ?? 0;
            return (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "14px 16px",
                  borderBottom: idx < menuItems.length - 1 ? `1px solid ${adminColors.border}` : "none",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontFamily: bodyFont, fontSize: 14, fontWeight: 700, color: adminColors.text }}>
                      {item.name}
                    </span>
                    {count > 0 ? (
                      <Badge color={adminColors.success}>{count} ingredient{count === 1 ? "" : "s"} mapped</Badge>
                    ) : (
                      <Badge color={adminColors.textSecondary}>Not mapped</Badge>
                    )}
                  </div>
                  <div style={{ fontFamily: bodyFont, fontSize: 12, color: adminColors.textSecondary, marginTop: 2 }}>
                    {item.categoryTitle}
                  </div>
                </div>

                <SecondaryButton onClick={() => openEditor(item)}>
                  <Link2 size={13} /> {count > 0 ? "Edit Recipe" : "Map Recipe"}
                </SecondaryButton>
              </div>
            );
          })}
        </Card>
      )}

      {editingItem && (
        <Modal title={`Recipe — ${editingItem.name}`} onClose={() => setEditingItem(null)} maxWidth={560}>
          {ingredients.length === 0 && (
            <p style={{ fontFamily: bodyFont, fontSize: 12, color: adminColors.textSecondary }}>
              Add ingredients on the Inventory tab first, then come back here to map them.
            </p>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {draftLines.map((line, idx) => {
              const ingredient = ingredientById.get(line.ingredientId);
              return (
                <div key={idx} style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                  <div style={{ flex: 2 }}>
                    <Select
                      label="Ingredient"
                      value={line.ingredientId}
                      onChange={(v) => updateLine(idx, { ingredientId: v })}
                      options={ingredientOptions}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <span
                        style={{
                          fontFamily: bodyFont,
                          fontSize: 12,
                          fontWeight: 700,
                          color: adminColors.textSecondary,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        Qty per unit ({ingredient?.unit ?? ""})
                      </span>
                      <input
                        type="number"
                        value={line.quantityPerUnit}
                        onChange={(e) => updateLine(idx, { quantityPerUnit: e.target.value })}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 8,
                          border: `1px solid ${adminColors.border}`,
                          fontFamily: bodyFont,
                          fontSize: 14,
                          color: adminColors.text,
                          outline: "none",
                        }}
                      />
                    </label>
                  </div>
                  <SecondaryButton danger onClick={() => removeLine(idx)}>
                    <X size={13} />
                  </SecondaryButton>
                </div>
              );
            })}
          </div>

          <SecondaryButton onClick={addLine}>
            <Plus size={13} /> Add Ingredient Line
          </SecondaryButton>

          {error && <div style={{ fontSize: 12, fontWeight: 600, color: adminColors.danger }}>{error}</div>}

          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <PrimaryButton onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save Recipe"}
            </PrimaryButton>
            <SecondaryButton onClick={() => setEditingItem(null)}>Cancel</SecondaryButton>
          </div>
        </Modal>
      )}
    </div>
  );
}
