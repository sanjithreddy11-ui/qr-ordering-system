"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  Package,
  AlertTriangle,
  CircleOff,
  Wallet,
  Plus,
  ShoppingCart,
  Download,
  Search,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  PageHeader,
  Card,
  PrimaryButton,
  SecondaryButton,
  TextInput,
  TextArea,
  Select,
  Badge,
  Modal,
  adminColors,
} from "@/components/admin/ui";
import {
  fetchIngredients,
  fetchInventorySummary,
  fetchStockAlerts,
  createIngredient,
  updateIngredient,
  deleteIngredient,
  createPurchase,
  fetchSuppliers,
  Ingredient,
  InventorySummary,
  Supplier,
  IngredientUnit,
  StockStatus,
} from "@/lib/admin-api";
import SuppliersManager from "@/components/admin/SuppliersManager";
import PurchaseHistoryTab from "@/components/admin/PurchaseHistoryTab";
import RecipesManager from "@/components/admin/RecipesManager";

const RESTAURANT_ID = "maxibrew"; // TODO: make dynamic if you support multiple restaurants
const bodyFont = "var(--font-body, 'Inter', system-ui, sans-serif)";

const UNIT_OPTIONS: { value: IngredientUnit; label: string }[] = [
  { value: "g", label: "Grams (g)" },
  { value: "kg", label: "Kilograms (kg)" },
  { value: "ml", label: "Millilitres (ml)" },
  { value: "l", label: "Litres (l)" },
  { value: "pcs", label: "Pieces (pcs)" },
  { value: "dozen", label: "Dozen" },
  { value: "packet", label: "Packet" },
  { value: "box", label: "Box" },
];

const STATUS_LABEL: Record<StockStatus, string> = {
  "in-stock": "In Stock",
  "low-stock": "Low Stock",
  "out-of-stock": "Out of Stock",
};

const STATUS_COLOR: Record<StockStatus, string> = {
  "in-stock": adminColors.success,
  "low-stock": adminColors.warning,
  "out-of-stock": adminColors.danger,
};

const emptyIngredientForm = {
  name: "",
  category: "",
  quantity: "0",
  unit: "kg" as IngredientUnit,
  costPerUnit: "",
  minimumStock: "",
  supplierId: "",
  notes: "",
};

const emptyPurchaseForm = { ingredientId: "", quantity: "", cost: "", supplierId: "" };

function textFieldStyle(): React.CSSProperties {
  return {
    padding: "9px 12px",
    borderRadius: 8,
    border: `1px solid ${adminColors.border}`,
    fontFamily: bodyFont,
    fontSize: 13,
    color: adminColors.text,
    outline: "none",
    background: "#fff",
  };
}

function OverviewCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  accent?: string;
}) {
  const color = accent ?? adminColors.primary;
  return (
    <Card style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: `${color}12`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={20} color={color} strokeWidth={2} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontFamily: bodyFont,
            fontSize: 11,
            fontWeight: 700,
            color: adminColors.textSecondary,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {label}
        </div>
        <div style={{ fontFamily: bodyFont, fontSize: 22, fontWeight: 800, color: adminColors.text }}>{value}</div>
      </div>
    </Card>
  );
}

// Triggers a browser download for a Blob without any extra dependency —
// consistent with this project's "no extra libs unless already installed"
// approach elsewhere (e.g. the Menu page's plain <input type="file">).
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportCsv(ingredients: Ingredient[]) {
  const header = ["Ingredient Name", "Category", "Quantity", "Unit", "Minimum Stock", "Cost Per Unit", "Status", "Value"];
  const rows = ingredients.map((i) => [
    i.name,
    i.category,
    i.quantity,
    i.unit,
    i.minimumStock,
    i.costPerUnit,
    STATUS_LABEL[i.status],
    i.value,
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), "inventory-export.csv");
}

function exportExcel(ingredients: Ingredient[]) {
  // Lightweight Excel export (no xlsx library needed): Excel opens
  // well-formed HTML tables saved with an .xls extension just fine.
  const header = ["Ingredient Name", "Category", "Quantity", "Unit", "Minimum Stock", "Cost Per Unit", "Status", "Value"];
  const rows = ingredients.map((i) => [
    i.name,
    i.category,
    i.quantity,
    i.unit,
    i.minimumStock,
    i.costPerUnit,
    STATUS_LABEL[i.status],
    i.value,
  ]);
  const html = `<table><thead><tr>${header.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows
    .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
  downloadBlob(
    new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" }),
    "inventory-export.xls"
  );
}

export default function StockManagementPage() {
  const [activeTab, setActiveTab] = useState<"inventory" | "purchases" | "suppliers" | "recipes">("inventory");

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [alerts, setAlerts] = useState<Ingredient[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | StockStatus>("");
  const [sort, setSort] = useState<"newest" | "oldest" | "quantity" | "alphabetical">("newest");

  // Add/Edit Ingredient modal
  const [showIngredientForm, setShowIngredientForm] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);
  const [ingredientForm, setIngredientForm] = useState(emptyIngredientForm);
  const [savingIngredient, setSavingIngredient] = useState(false);
  const [ingredientError, setIngredientError] = useState<string | null>(null);

  // Purchase Stock modal
  const [showPurchaseForm, setShowPurchaseForm] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState(emptyPurchaseForm);
  const [savingPurchase, setSavingPurchase] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetchIngredients(RESTAURANT_ID, {
        search: search || undefined,
        category: categoryFilter || undefined,
        status: statusFilter || undefined,
        sort,
      }),
      fetchInventorySummary(RESTAURANT_ID),
      fetchStockAlerts(RESTAURANT_ID),
      fetchSuppliers(RESTAURANT_ID),
    ])
      .then(([ingredientList, summaryData, alertList, supplierList]) => {
        setIngredients(ingredientList);
        setSummary(summaryData);
        setAlerts(alertList);
        setSuppliers(supplierList);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [search, categoryFilter, statusFilter, sort]);

  useEffect(() => {
    if (activeTab === "inventory") queueMicrotask(load);
  }, [load, activeTab]);

  const categories = useMemo(() => {
    const set = new Set(ingredients.map((i) => i.category).filter(Boolean));
    return Array.from(set).sort();
  }, [ingredients]);

  const supplierOptions = useMemo(
    () => [{ value: "", label: "No supplier" }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))],
    [suppliers]
  );

  const openCreateIngredient = () => {
    setEditingIngredient(null);
    setIngredientForm(emptyIngredientForm);
    setIngredientError(null);
    setShowIngredientForm(true);
  };

  const openEditIngredient = (ingredient: Ingredient) => {
    setEditingIngredient(ingredient);
    setIngredientForm({
      name: ingredient.name,
      category: ingredient.category,
      quantity: String(ingredient.quantity),
      unit: ingredient.unit,
      costPerUnit: String(ingredient.costPerUnit),
      minimumStock: String(ingredient.minimumStock),
      supplierId: ingredient.supplierId ?? "",
      notes: ingredient.notes,
    });
    setIngredientError(null);
    setShowIngredientForm(true);
  };

  const handleSaveIngredient = async () => {
    setSavingIngredient(true);
    setIngredientError(null);
    try {
      const name = ingredientForm.name.trim();
      const costPerUnit = Number(ingredientForm.costPerUnit);
      const minimumStock = Number(ingredientForm.minimumStock);
      const quantity = Number(ingredientForm.quantity) || 0;

      if (!name) throw new Error("Ingredient name is required");
      if (!ingredientForm.costPerUnit || Number.isNaN(costPerUnit) || costPerUnit < 0) {
        throw new Error("A valid cost per unit is required");
      }
      if (!ingredientForm.minimumStock || Number.isNaN(minimumStock) || minimumStock < 0) {
        throw new Error("A valid minimum stock level is required");
      }

      const payload = {
        name,
        category: ingredientForm.category.trim() || "General",
        quantity,
        unit: ingredientForm.unit,
        costPerUnit,
        minimumStock,
        supplierId: ingredientForm.supplierId || undefined,
        notes: ingredientForm.notes.trim(),
      };

      if (editingIngredient) {
        await updateIngredient(RESTAURANT_ID, editingIngredient.id, payload);
      } else {
        await createIngredient({ restaurantId: RESTAURANT_ID, ...payload });
      }
      setShowIngredientForm(false);
      load();
    } catch (err) {
      setIngredientError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSavingIngredient(false);
    }
  };

  const handleDeleteIngredient = async (ingredient: Ingredient) => {
    if (!confirm(`Delete "${ingredient.name}"? This can't be undone.`)) return;
    try {
      await deleteIngredient(RESTAURANT_ID, ingredient.id);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't delete this ingredient");
    }
  };

  const openPurchase = (ingredient?: Ingredient) => {
    setPurchaseForm({ ...emptyPurchaseForm, ingredientId: ingredient?.id ?? ingredients[0]?.id ?? "" });
    setPurchaseError(null);
    setShowPurchaseForm(true);
  };

  const handleSavePurchase = async () => {
    setSavingPurchase(true);
    setPurchaseError(null);
    try {
      const quantity = Number(purchaseForm.quantity);
      const cost = Number(purchaseForm.cost);
      if (!purchaseForm.ingredientId) throw new Error("Select an ingredient");
      if (!quantity || quantity <= 0) throw new Error("Enter a valid quantity");
      if (!purchaseForm.cost || Number.isNaN(cost) || cost < 0) throw new Error("Enter a valid cost");

      await createPurchase({
        restaurantId: RESTAURANT_ID,
        ingredientId: purchaseForm.ingredientId,
        quantity,
        cost,
        supplierId: purchaseForm.supplierId || undefined,
      });
      setShowPurchaseForm(false);
      load();
    } catch (err) {
      setPurchaseError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSavingPurchase(false);
    }
  };

  const ingredientOptionsForPurchase = ingredients.map((i) => ({ value: i.id, label: `${i.name} (${i.quantity} ${i.unit} left)` }));

  return (
    <div>
      <PageHeader
        title="Stock Management"
        description="Manage restaurant inventory, monitor stock levels, and track ingredient usage."
        action={
          activeTab === "inventory" ? (
            <div className="flex flex-wrap gap-2">
              <PrimaryButton onClick={openCreateIngredient}>
                <Plus size={15} /> Add Ingredient
              </PrimaryButton>
              <SecondaryButton onClick={() => openPurchase()}>
                <ShoppingCart size={13} /> Purchase Stock
              </SecondaryButton>
              <SecondaryButton onClick={() => exportCsv(ingredients)}>
                <Download size={13} /> Export CSV
              </SecondaryButton>
              <SecondaryButton onClick={() => exportExcel(ingredients)}>
                <Download size={13} /> Export Excel
              </SecondaryButton>
            </div>
          ) : undefined
        }
      />

      {/* ---- Tabs ---- */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: `1px solid ${adminColors.border}`, overflowX: "auto" }}>
        {(
          [
            { key: "inventory", label: "Inventory" },
            { key: "purchases", label: "Purchase History" },
            { key: "suppliers", label: "Suppliers" },
            { key: "recipes", label: "Recipes" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: "10px 16px",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontFamily: bodyFont,
              fontSize: 13,
              fontWeight: 700,
              whiteSpace: "nowrap",
              color: activeTab === tab.key ? adminColors.primary : adminColors.textSecondary,
              borderBottom: `2px solid ${activeTab === tab.key ? adminColors.primary : "transparent"}`,
              marginBottom: -1,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "purchases" && <PurchaseHistoryTab restaurantId={RESTAURANT_ID} />}
      {activeTab === "suppliers" && <SuppliersManager restaurantId={RESTAURANT_ID} />}
      {activeTab === "recipes" && <RecipesManager restaurantId={RESTAURANT_ID} />}

      {activeTab === "inventory" && (
        <>
          {/* ---- Overview cards ---- */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 16,
              marginBottom: 20,
            }}
          >
            <OverviewCard icon={Package} label="Total Ingredients" value={`${summary?.totalIngredients ?? 0}`} />
            <OverviewCard
              icon={AlertTriangle}
              label="Low Stock Items"
              value={`${summary?.lowStockCount ?? 0}`}
              accent={adminColors.warning}
            />
            <OverviewCard
              icon={CircleOff}
              label="Out of Stock"
              value={`${summary?.outOfStockCount ?? 0}`}
              accent={adminColors.danger}
            />
            <OverviewCard
              icon={Wallet}
              label="Inventory Value"
              value={`₹ ${(summary?.inventoryValue ?? 0).toLocaleString("en-IN")}`}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px]" style={{ gap: 16, alignItems: "start" }}>
            <div>
              {/* ---- Search & Filters ---- */}
              <Card style={{ marginBottom: 20, padding: 14 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                  <div style={{ position: "relative", flex: "1 1 220px", minWidth: 180 }}>
                    <Search
                      size={14}
                      style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: adminColors.textSecondary }}
                    />
                    <input
                      placeholder="Search ingredient…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      style={{ ...textFieldStyle(), width: "100%", paddingLeft: 30, boxSizing: "border-box" }}
                    />
                  </div>

                  <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={textFieldStyle()}>
                    <option value="">All Categories</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as "" | StockStatus)}
                    style={textFieldStyle()}
                  >
                    <option value="">All Statuses</option>
                    <option value="in-stock">In Stock</option>
                    <option value="low-stock">Low Stock</option>
                    <option value="out-of-stock">Out of Stock</option>
                  </select>

                  <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} style={textFieldStyle()}>
                    <option value="newest">Newest</option>
                    <option value="oldest">Oldest</option>
                    <option value="quantity">Quantity</option>
                    <option value="alphabetical">Alphabetical</option>
                  </select>
                </div>
              </Card>

              {loading && <p style={{ fontFamily: bodyFont, fontSize: 13, color: adminColors.textSecondary }}>Loading…</p>}

              {!loading && ingredients.length === 0 && (
                <Card>
                  <p style={{ fontFamily: bodyFont, fontSize: 13, color: adminColors.textSecondary, margin: 0 }}>
                    No ingredients match these filters.
                  </p>
                </Card>
              )}

              {!loading && ingredients.length > 0 && (
                <Card style={{ padding: 0 }}>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ textAlign: "left" }}>
                          {["Ingredient", "Category", "Available Qty", "Unit", "Min. Stock", "Status", "Last Updated", ""].map(
                            (h) => (
                              <th
                                key={h}
                                style={{
                                  fontFamily: bodyFont,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  color: adminColors.textSecondary,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.04em",
                                  padding: "12px 16px",
                                  borderBottom: `1px solid ${adminColors.border}`,
                                }}
                              >
                                {h}
                              </th>
                            )
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {ingredients.map((ingredient) => (
                          <tr key={ingredient.id}>
                            <td style={{ ...cellStyle, fontWeight: 700 }}>{ingredient.name}</td>
                            <td style={cellStyle}>{ingredient.category}</td>
                            <td style={cellStyle}>{ingredient.quantity}</td>
                            <td style={cellStyle}>{ingredient.unit}</td>
                            <td style={cellStyle}>{ingredient.minimumStock}</td>
                            <td style={cellStyle}>
                              <Badge color={STATUS_COLOR[ingredient.status]}>{STATUS_LABEL[ingredient.status]}</Badge>
                            </td>
                            <td style={cellStyle}>{new Date(ingredient.updatedAt).toLocaleDateString()}</td>
                            <td style={cellStyle}>
                              <div style={{ display: "flex", gap: 6 }}>
                                <SecondaryButton onClick={() => openPurchase(ingredient)}>
                                  <ShoppingCart size={13} />
                                </SecondaryButton>
                                <SecondaryButton onClick={() => openEditIngredient(ingredient)}>
                                  <Pencil size={13} />
                                </SecondaryButton>
                                <SecondaryButton danger onClick={() => handleDeleteIngredient(ingredient)}>
                                  <Trash2 size={13} />
                                </SecondaryButton>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </div>

            {/* ---- Low Stock Alerts side panel ---- */}
            <Card>
              <div style={{ fontFamily: bodyFont, fontSize: 14, fontWeight: 700, color: adminColors.text, marginBottom: 12 }}>
                Low Stock Alerts
              </div>
              {alerts.length === 0 && (
                <p style={{ fontFamily: bodyFont, fontSize: 13, color: adminColors.textSecondary, margin: 0 }}>
                  All ingredients are sufficiently stocked.
                </p>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {alerts.map((ingredient) => (
                  <div key={ingredient.id} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <AlertTriangle size={15} color={STATUS_COLOR[ingredient.status]} style={{ marginTop: 2, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontFamily: bodyFont, fontSize: 13, fontWeight: 700, color: adminColors.text }}>
                        {ingredient.name}
                      </div>
                      <div style={{ fontFamily: bodyFont, fontSize: 12, color: adminColors.textSecondary }}>
                        {ingredient.status === "out-of-stock"
                          ? "Out of Stock"
                          : `Only ${ingredient.quantity} ${ingredient.unit} left`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}

      {/* ---- Add/Edit Ingredient Modal ---- */}
      {showIngredientForm && (
        <Modal title={editingIngredient ? "Edit Ingredient" : "Add Ingredient"} onClose={() => setShowIngredientForm(false)}>
          <TextInput label="Ingredient Name" value={ingredientForm.name} onChange={(v) => setIngredientForm((f) => ({ ...f, name: v }))} />
          <TextInput
            label="Category"
            value={ingredientForm.category}
            onChange={(v) => setIngredientForm((f) => ({ ...f, category: v }))}
            placeholder="e.g. Dairy, Produce, Meat"
          />
          <TextInput
            label="Current Quantity"
            type="number"
            value={ingredientForm.quantity}
            onChange={(v) => setIngredientForm((f) => ({ ...f, quantity: v }))}
          />
          <Select
            label="Unit"
            value={ingredientForm.unit}
            onChange={(v) => setIngredientForm((f) => ({ ...f, unit: v as IngredientUnit }))}
            options={UNIT_OPTIONS}
          />
          <TextInput
            label="Cost Per Unit (₹)"
            type="number"
            value={ingredientForm.costPerUnit}
            onChange={(v) => setIngredientForm((f) => ({ ...f, costPerUnit: v }))}
          />
          <TextInput
            label="Minimum Stock Level"
            type="number"
            value={ingredientForm.minimumStock}
            onChange={(v) => setIngredientForm((f) => ({ ...f, minimumStock: v }))}
          />
          <Select
            label="Supplier"
            value={ingredientForm.supplierId}
            onChange={(v) => setIngredientForm((f) => ({ ...f, supplierId: v }))}
            options={supplierOptions}
          />
          <TextArea label="Notes" value={ingredientForm.notes} onChange={(v) => setIngredientForm((f) => ({ ...f, notes: v }))} />

          {ingredientError && <div style={{ fontSize: 12, fontWeight: 600, color: adminColors.danger }}>{ingredientError}</div>}

          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <PrimaryButton onClick={handleSaveIngredient} disabled={savingIngredient}>
              {savingIngredient ? "Saving…" : editingIngredient ? "Save Changes" : "Add Ingredient"}
            </PrimaryButton>
            <SecondaryButton onClick={() => setShowIngredientForm(false)}>Cancel</SecondaryButton>
          </div>
        </Modal>
      )}

      {/* ---- Purchase Stock Modal ---- */}
      {showPurchaseForm && (
        <Modal title="Purchase Stock" onClose={() => setShowPurchaseForm(false)}>
          {ingredients.length === 0 ? (
            <p style={{ fontFamily: bodyFont, fontSize: 13, color: adminColors.textSecondary }}>
              Add an ingredient first before recording a purchase.
            </p>
          ) : (
            <>
              <Select
                label="Ingredient"
                value={purchaseForm.ingredientId}
                onChange={(v) => setPurchaseForm((f) => ({ ...f, ingredientId: v }))}
                options={ingredientOptionsForPurchase}
              />
              <TextInput
                label="Quantity Purchased"
                type="number"
                value={purchaseForm.quantity}
                onChange={(v) => setPurchaseForm((f) => ({ ...f, quantity: v }))}
              />
              <TextInput
                label="Total Cost (₹)"
                type="number"
                value={purchaseForm.cost}
                onChange={(v) => setPurchaseForm((f) => ({ ...f, cost: v }))}
              />
              <Select
                label="Supplier"
                value={purchaseForm.supplierId}
                onChange={(v) => setPurchaseForm((f) => ({ ...f, supplierId: v }))}
                options={supplierOptions}
              />

              {purchaseError && <div style={{ fontSize: 12, fontWeight: 600, color: adminColors.danger }}>{purchaseError}</div>}

              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <PrimaryButton onClick={handleSavePurchase} disabled={savingPurchase}>
                  {savingPurchase ? "Saving…" : "Record Purchase"}
                </PrimaryButton>
                <SecondaryButton onClick={() => setShowPurchaseForm(false)}>Cancel</SecondaryButton>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

const cellStyle: React.CSSProperties = {
  fontFamily: bodyFont,
  fontSize: 13,
  color: adminColors.text,
  padding: "12px 16px",
  borderBottom: `1px solid ${adminColors.border}`,
};
