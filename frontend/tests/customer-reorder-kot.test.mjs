// Regression tests: "a second order at the same table must not re-print the
// first order's items on its KOT".
//
// What is REAL here (the actual app code, imported unchanged):
//   - store/cart-store.ts   (persisted cart, rehydrated like the customer layout does)
//   - store/order-store.ts
//   - lib/checkout.ts       (payload construction + post-order cart reset)
//   - lib/printer/kot.ts    (category routing + ESC/POS ticket formatting)
//   - store/printer-store.ts printKOT (the exact function auto-print calls)
//
// What is FAKED:
//   - the HTTP backend: fakeBackend() mirrors what backend/src/services/
//     orderService.js does (one new order per request, containing exactly the
//     submitted lines). The real backend is covered by
//     backend/tests/order-isolation.test.js.
//   - QZ Tray / the physical printer (see helpers/mock-qzClient.mjs). These
//     tests assert on the exact bytes handed to the printer; they do NOT prove
//     anything about real printer hardware.
//
// Run: npm test   (from frontend/)
import "./helpers/browser-env.mjs";
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

import { printed, resetPrinterMock, failPrinter, clearPrinterFailure } from "./helpers/mock-qzClient.mjs";

const { useCartStore } = await import("@/store/cart-store");
const { useOrderStore } = await import("@/store/order-store");
const { usePrinterStore } = await import("@/store/printer-store");
const { buildOrderItemsPayload, placeOrderAndResetCart } = await import("@/lib/checkout");
const { splitKOTItemsByPrinter, buildEscPosKOT } = await import("@/lib/printer/kot");

// ---- fixtures -------------------------------------------------------------
const menu = (id, name, categoryTitle, price = 100) => ({
  id, name, price, categoryTitle, categoryId: categoryTitle, diet: "veg", description: "", image: "",
});
const X_DRINK = menu("iced-latte", "Iced Latte", "Iced Coffee", 200); // routes to Counter printer
const Y_FOOD = menu("margherita", "Margherita", "Pizzas (9 Inch)", 300); // routes to Kitchen printer
const Z_FOOD = menu("club-sandwich", "Club Sandwich", "Sandwiches", 250); // Kitchen
const W_DRINK = menu("mojito-mint", "Mint Mojito", "Mojitos", 180); // Counter

const KITCHEN = "KITCHEN-PRN";
const COUNTER = "COUNTER-PRN";

// ---- fake backend ---------------------------------------------------------
// One new, independent order per request, built ONLY from the request's lines.
let db;
let orderSeq;
function fakeBackend() {
  return async function place(payload) {
    if (!Array.isArray(payload.items) || payload.items.length === 0) {
      throw new Error("restaurantId, tableToken and at least one item are required");
    }
    const lookup = new Map([X_DRINK, Y_FOOD, Z_FOOD, W_DRINK].map((m) => [m.id, m]));
    const order = {
      orderId: `ORD-${++orderSeq}`,
      sessionId: payload.sessionId,
      tableToken: payload.tableToken,
      tableLabel: payload.tableToken === "tok-table-2" ? "Table 2" : "Table 1",
      orderType: payload.orderType,
      placedAt: new Date(2026, 9, 9, 12, orderSeq).toISOString(),
      specialInstructions: payload.specialInstructions,
      tokenNumber: payload.tableToken === "tok-table-2" ? 2 : 1,
      status: "pending",
      items: payload.items.map((l) => {
        const m = lookup.get(l.id);
        return {
          item: { id: m.id, name: m.name, price: m.price, categoryId: m.categoryId, categoryTitle: m.categoryTitle, diet: m.diet },
          quantity: l.quantity,
          modifiers: [],
        };
      }),
    };
    db.push(structuredClone(order));
    return order;
  };
}

// Mirrors KotAutoPrintProvider.tsx's mapping from the "new-order" payload.
const toKot = (order) => ({
  orderId: order.orderId,
  tableLabel: order.tableLabel,
  orderType: order.orderType,
  placedAt: order.placedAt,
  specialInstructions: order.specialInstructions,
  tokenNumber: order.tokenNumber,
  items: order.items,
});

// Mirrors checkout/page.tsx handlePlaceOrder: snapshot payload -> place -> reset.
async function customerPlacesOrder({ sessionId = "sess-1", tableToken = "tok-table-1" } = {}) {
  const payload = {
    sessionId,
    restaurantId: "cafe-001",
    tableToken,
    items: buildOrderItemsPayload(useCartStore.getState().items),
    orderType: "dine-in",
    specialInstructions: "",
    paymentMethod: "cash",
  };
  return placeOrderAndResetCart(() => backend(payload));
}

// The customer layout calls persist.rehydrate() on every customer page mount,
// so this is what "go back to the menu" does to the in-memory store.
const customerReturnsToMenu = () => useCartStore.persist.rehydrate();
const customerAdds = (menuItem, { tableToken = "tok-table-1" } = {}) =>
  useCartStore.getState().addItem(menuItem, undefined, "cafe-001", tableToken);

const lineIds = (order) => order.items.map((l) => l.item.id);
const printedFor = (printerName) => printed.filter((p) => p.printerName === printerName);
const allPrintedText = () => printed.map((p) => p.payload).join("\n");

let backend;
beforeEach(() => {
  localStorage.clear();
  useCartStore.setState({ items: [], restaurantId: null, tableToken: null });
  useOrderStore.setState({ currentOrder: null });
  resetPrinterMock();
  usePrinterStore.setState({ kitchenPrinter: KITCHEN, counterPrinter: COUNTER });
  db = [];
  orderSeq = 0;
  backend = fakeBackend();
});

// ---------------------------------------------------------------------------
test("REPORTED BUG: X drink, then Y food at the same table -> KOT #2 has only Y", async () => {
  // Order A: one X drink.
  customerAdds(X_DRINK);
  const orderA = await customerPlacesOrder();
  assert.deepEqual(lineIds(orderA), ["iced-latte"], "Order A contains only X Drink");

  const snapshotA = structuredClone(db[0]);

  // KOT #1 — what auto-print sends when the "new-order" event arrives.
  const kot1 = await usePrinterStore.getState().printKOT(toKot(orderA));
  assert.equal(kot1.kitchen.ok && kot1.counter.ok, true);
  assert.equal(printed.length, 1, "a drinks-only order prints exactly one ticket");
  assert.equal(printed[0].printerName, COUNTER);
  assert.match(printed[0].payload, /Iced Latte/);
  assert.doesNotMatch(printed[0].payload, /Margherita/);

  // Customer goes back to the menu (layout rehydrates the persisted cart)...
  await customerReturnsToMenu();
  assert.equal(useCartStore.getState().items.length, 0, "cart must not still hold Order A's items");

  // ...and orders one Y food item.
  printed.length = 0;
  customerAdds(Y_FOOD);
  const orderB = await customerPlacesOrder();
  assert.deepEqual(lineIds(orderB), ["margherita"], "Order B contains only Y Food Item");

  // KOT #2.
  await usePrinterStore.getState().printKOT(toKot(orderB));
  assert.equal(printed.length, 1, "a food-only order prints exactly one ticket");
  assert.equal(printed[0].printerName, KITCHEN);
  assert.match(printed[0].payload, /Margherita/);
  assert.doesNotMatch(allPrintedText(), /Iced Latte/, "KOT #2 must not contain X Drink");

  // History intact, relationships correct.
  assert.equal(db.length, 2);
  assert.deepEqual(db[0], snapshotA, "Order A and its items are unchanged");
  assert.equal(db[0].sessionId, db[1].sessionId);
  assert.equal(db[0].tableToken, db[1].tableToken);
  assert.notEqual(db[0].orderId, db[1].orderId, "each order has its own identity");
});

test("after ordering, what is persisted in localStorage is an empty cart (survives a page reload)", async () => {
  customerAdds(X_DRINK);
  assert.equal(JSON.parse(localStorage.getItem("smartqr-cart")).state.items.length, 1, "sanity: cart was persisted");
  await customerPlacesOrder();

  // Take the raw persisted blob as it would be on disk when the tab is closed...
  const onDisk = localStorage.getItem("smartqr-cart");
  assert.equal(JSON.parse(onDisk).state.items.length, 0, "persisted cart is empty");

  // ...then a brand-new page load: memory wiped, only localStorage remains.
  useCartStore.setState({ items: [{ item: X_DRINK, quantity: 99 }] }); // junk in memory, overwritten by rehydrate
  localStorage.setItem("smartqr-cart", onDisk);
  await customerReturnsToMenu();
  assert.deepEqual(useCartStore.getState().items, []);
});

test("three consecutive orders at one table each print only their own items", async () => {
  const sequence = [X_DRINK, Y_FOOD, Z_FOOD];
  const orders = [];
  for (const m of sequence) {
    await customerReturnsToMenu();
    customerAdds(m);
    const order = await customerPlacesOrder();
    orders.push(order);
    resetPrinterMock();
    usePrinterStore.setState({ kitchenPrinter: KITCHEN, counterPrinter: COUNTER });
    await usePrinterStore.getState().printKOT(toKot(order));
    const text = allPrintedText();
    assert.match(text, new RegExp(m.name));
    for (const other of sequence.filter((o) => o.id !== m.id)) {
      assert.doesNotMatch(text, new RegExp(other.name), `${m.name}'s KOT must not contain ${other.name}`);
    }
  }
  assert.deepEqual(orders.map(lineIds), [["iced-latte"], ["margherita"], ["club-sandwich"]]);
  assert.deepEqual(db.map(lineIds), [["iced-latte"], ["margherita"], ["club-sandwich"]], "history intact");
});

test("one new order with several different items: all of them, split by printer, nothing from before", async () => {
  customerAdds(X_DRINK);
  await customerPlacesOrder(); // earlier order

  await customerReturnsToMenu();
  customerAdds(Y_FOOD);
  customerAdds(Y_FOOD); // quantity 2
  customerAdds(Z_FOOD);
  customerAdds(W_DRINK);
  const order = await customerPlacesOrder();
  assert.deepEqual(lineIds(order).sort(), ["club-sandwich", "margherita", "mojito-mint"]);
  assert.equal(order.items.find((l) => l.item.id === "margherita").quantity, 2);

  await usePrinterStore.getState().printKOT(toKot(order));
  const kitchen = printedFor(KITCHEN)[0].payload;
  const counter = printedFor(COUNTER)[0].payload;
  assert.match(kitchen, /Margherita/);
  assert.match(kitchen, /Club Sandwich/);
  assert.doesNotMatch(kitchen, /Mint Mojito|Iced Latte/);
  assert.match(counter, /Mint Mojito/);
  assert.doesNotMatch(counter, /Iced Latte|Margherita|Club Sandwich/);
});

test("two different tables order independently", async () => {
  customerAdds(X_DRINK, { tableToken: "tok-table-1" });
  const t1 = await customerPlacesOrder({ sessionId: "sess-1", tableToken: "tok-table-1" });

  // A different customer's phone: its own localStorage and cart.
  localStorage.clear();
  useCartStore.setState({ items: [], restaurantId: null, tableToken: null });
  await customerReturnsToMenu();
  customerAdds(Y_FOOD, { tableToken: "tok-table-2" });
  const t2 = await customerPlacesOrder({ sessionId: "sess-2", tableToken: "tok-table-2" });

  assert.deepEqual(lineIds(t1), ["iced-latte"]);
  assert.deepEqual(lineIds(t2), ["margherita"]);
  assert.equal(t1.tableLabel, "Table 1");
  assert.equal(t2.tableLabel, "Table 2");
  assert.notEqual(t1.sessionId, t2.sessionId);
});

test("modifiers on a line are carried into the request and then cleared with the cart", async () => {
  const sauce = { groupId: "sauce", groupName: "Sauce", optionId: "red", optionName: "Red Sauce", priceDelta: 0 };
  useCartStore.getState().addItem(Z_FOOD, [sauce], "cafe-001", "tok-table-1");
  const payload = buildOrderItemsPayload(useCartStore.getState().items);
  assert.deepEqual(payload, [{ id: "club-sandwich", quantity: 1, modifiers: [{ groupId: "sauce", optionIds: ["red"] }] }]);

  await customerPlacesOrder();
  assert.deepEqual(useCartStore.getState().items, []);
});

test("a failed order request keeps the cart so nothing is lost; the retry sends the same items once", async () => {
  customerAdds(X_DRINK);

  const failing = async () => { throw new Error("network down"); };
  await assert.rejects(() => placeOrderAndResetCart(failing), /network down/);
  assert.equal(useCartStore.getState().items.length, 1, "cart untouched after a failed request");
  assert.equal(useOrderStore.getState().currentOrder, null, "no phantom order recorded");

  const order = await customerPlacesOrder(); // retry
  assert.deepEqual(lineIds(order), ["iced-latte"]);
  assert.equal(db.length, 1, "exactly one order stored");
  assert.deepEqual(useCartStore.getState().items, []);
  assert.equal(useOrderStore.getState().currentOrder.orderId, order.orderId);
});

test("empty cart produces an empty payload, which the backend rejects (no empty KOT)", async () => {
  assert.deepEqual(buildOrderItemsPayload([]), []);
  await assert.rejects(() => customerPlacesOrder(), /at least one item/);
  assert.equal(db.length, 0);
  assert.equal(printed.length, 0);
});

test("placing an order clears only the cart — other persisted customer/session state is untouched", async () => {
  localStorage.setItem("smartqr-session", '{"state":{"sessionId":"sess-1","tableToken":"tok-table-1"}}');
  localStorage.setItem("smartqr-visit-auth", '{"state":{"deviceId":"dev-1"}}');
  customerAdds(X_DRINK);
  const order = await customerPlacesOrder();
  assert.equal(localStorage.getItem("smartqr-session"), '{"state":{"sessionId":"sess-1","tableToken":"tok-table-1"}}');
  assert.equal(localStorage.getItem("smartqr-visit-auth"), '{"state":{"deviceId":"dev-1"}}');
  assert.equal(useOrderStore.getState().currentOrder.orderId, order.orderId, "order-success page still has its order");
});

// ---------------------------------------------------------------------------
// KOT generation / printing behaviour (real kot.ts + real printKOT)
// ---------------------------------------------------------------------------
test("reprinting an existing KOT reproduces that order's ticket only", async () => {
  customerAdds(X_DRINK);
  const orderA = await customerPlacesOrder();
  await customerReturnsToMenu();
  customerAdds(Y_FOOD);
  const orderB = await customerPlacesOrder();

  // Reprint A after B exists (what the admin "Print KOT" button does from a stored order).
  await usePrinterStore.getState().printKOT(toKot(db.find((o) => o.orderId === orderA.orderId)));
  const first = printed.map((p) => p.payload);
  resetPrinterMock();
  usePrinterStore.setState({ kitchenPrinter: KITCHEN, counterPrinter: COUNTER });
  await usePrinterStore.getState().printKOT(toKot(db.find((o) => o.orderId === orderA.orderId)));
  assert.deepEqual(printed.map((p) => p.payload), first, "reprint is byte-identical");
  assert.match(first.join("\n"), /Iced Latte/);
  assert.doesNotMatch(first.join("\n"), /Margherita/);
  assert.ok(orderB);
});

test("failed print, then retry: the retried KOT still contains only that order's items", async () => {
  customerAdds(X_DRINK);
  await customerPlacesOrder();
  await customerReturnsToMenu();
  customerAdds(Y_FOOD);
  const orderB = await customerPlacesOrder();

  failPrinter(KITCHEN);
  const failed = await usePrinterStore.getState().printKOT(toKot(orderB));
  assert.equal(failed.kitchen.ok, false);
  assert.match(failed.kitchen.error, /offline/);
  assert.equal(printed.length, 0, "nothing reached the printer");

  clearPrinterFailure(KITCHEN);
  const retried = await usePrinterStore.getState().printKOT(toKot(orderB));
  assert.equal(retried.kitchen.ok, true);
  assert.equal(printed.length, 1);
  assert.match(printed[0].payload, /Margherita/);
  assert.doesNotMatch(printed[0].payload, /Iced Latte/);
});

test("building a KOT twice from the same order payload yields the same ticket (no hidden accumulated state)", async () => {
  customerAdds(Y_FOOD);
  const order = await customerPlacesOrder();
  const a = buildEscPosKOT(toKot(order), "kitchen", splitKOTItemsByPrinter(order.items).kitchen);
  const b = buildEscPosKOT(toKot(order), "kitchen", splitKOTItemsByPrinter(order.items).kitchen);
  assert.equal(a, b);
});
