// KOT data-isolation tests (backend half).
//
// The Kitchen Order Ticket is printed from the "new-order" Socket.IO payload
// (see frontend KotAutoPrintProvider.tsx), which is the order document the
// backend just created. So the backend's contract for KOTs is:
//   "each POST /api/orders creates a NEW order holding exactly the submitted
//    lines, emits exactly that order, and never touches earlier orders."
// These tests pin that contract down, using the REAL
// services/orderService.js (validateAndBuildOrder + finalizeOrder), so a
// future change that leaks a previous order's items into a new one — or into
// its broadcast — fails here.
//
// No MongoDB needed: the Mongoose models and the socket layer are replaced by
// tiny in-memory fakes via require.cache BEFORE the real service loads (same
// technique as visit-session.test.js). Run: npm test
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");

const src = (p) => path.join(__dirname, "..", "src", p);
const inject = (rel, exports) => {
  const p = require.resolve(src(rel));
  require.cache[p] = { id: p, filename: p, loaded: true, exports };
};

// ---- in-memory fakes ------------------------------------------------------
const emitted = []; // every "new-order" payload, deep-copied at emit time
const sideEffects = []; // names of other socket emits (kept so they're not silently dropped)

const state = {};
function resetState() {
  state.orders = [];
  state.tableSessions = [];
  state.tables = [];
  state.sessions = [];
  emitted.length = 0;
  sideEffects.length = 0;
  state.idSeq = 0;
}
resetState();

const withSave = (doc) => {
  Object.defineProperty(doc, "save", { value: async () => doc, enumerable: false, configurable: true });
  return doc;
};
const matches = (doc, q) => Object.entries(q).every(([k, v]) => String(doc[k]) === String(v));
// Mongoose-like query: awaitable, plus the chain createTableSessionWithToken uses.
const query = (result) => {
  const q = { then: (res, rej) => Promise.resolve(result).then(res, rej) };
  q.sort = q.select = q.lean = () => q;
  return q;
};

inject("models/Order.js", {
  async create(data) {
    const doc = withSave({ ...structuredClone(data) });
    state.orders.push(doc);
    return doc;
  },
  find: () => ({ lean: async () => [] }),
  STATUSES: ["pending", "preparing", "ready", "completed", "cancelled"],
});
inject("models/Table.js", {
  async findOne(q) {
    return state.tables.find((t) => matches(t, q)) || null;
  },
});
inject("models/Session.js", {
  async findOne(q) {
    return state.sessions.find((s) => matches(s, q)) || null;
  },
});
inject("models/TableSession.js", {
  async create(data) {
    const doc = withSave({ _id: `ts_${++state.idSeq}`, ...structuredClone(data) });
    state.tableSessions.push(doc);
    return doc;
  },
  findOne(q) {
    // createTableSessionWithToken: "highest token issued today for this restaurant"
    if ("businessDate" in q) {
      const same = state.tableSessions.filter((s) => s.restaurantId === q.restaurantId && s.businessDate === q.businessDate);
      return query(same.sort((a, b) => b.tokenNumber - a.tokenNumber)[0] || null);
    }
    return query(state.tableSessions.find((s) => matches(s, q)) || null);
  },
});
const menu = [
  { id: "iced-latte", name: "Iced Latte", price: 200, categoryId: "c-ice", categoryTitle: "Iced Coffee" },
  { id: "margherita", name: "Margherita", price: 300, categoryId: "c-pizza", categoryTitle: "Pizzas (9 Inch)" },
  { id: "club-sandwich", name: "Club Sandwich", price: 250, categoryId: "c-sand", categoryTitle: "Sandwiches" },
  { id: "mint-mojito", name: "Mint Mojito", price: 180, categoryId: "c-moj", categoryTitle: "Mojitos" },
].map((m) => ({ description: "", diet: "veg", image: "", gstSlab: null, modifierGroups: [], isAvailable: true, restaurantId: "cafe-001", ...m }));
inject("models/MenuItem.js", {
  async find(q) {
    const ids = q.id.$in;
    return menu.filter((m) => m.restaurantId === q.restaurantId && ids.includes(m.id));
  },
});
inject("models/Customer.js", { findOne: async () => null, findOneAndUpdate: async () => null });
inject("models/Settlement.js", {});
inject("models/GstSettings.js", {
  findOne: async () => ({ enabled: true, calculationMode: "exclusive", defaultGstPercentage: 5 }),
});
inject("models/Restaurant.js", { findOne: () => ({ lean: async () => null }) });
inject("services/stockService.js", { deductStockForOrder: async () => {} });

const noop = (name) => (payload) => sideEffects.push(name);
inject("sockets/socket.js", {
  emitNewOrder: (order) => emitted.push(structuredClone(JSON.parse(JSON.stringify(order)))),
  emitTableOccupied: noop("tableOccupied"),
  emitSessionStarted: noop("sessionStarted"),
  emitSettlementUpdated: noop("settlementUpdated"),
  emitOrderDeleted: noop("orderDeleted"),
  emitSessionEnded: noop("sessionEnded"),
  emitTableAvailable: noop("tableAvailable"),
  emitOrderStatusUpdate: noop("orderStatusUpdate"),
});

const { validateAndBuildOrder, finalizeOrder } = require(src("services/orderService.js"));
const ApiError = require(src("utils/ApiError.js"));

// ---- helpers --------------------------------------------------------------
function seedTable(token, label, sessionId) {
  state.tables.push(
    withSave({ _id: `tbl_${token}`, token, label, restaurantId: "cafe-001", status: "available", currentSessionId: null, occupiedAt: null })
  );
  state.sessions.push({ sessionId, isExpired: () => false });
}

async function placeOrder({ tableToken = "tok-1", sessionId = "sess-1", items, phone = "9876543210", name = "Asha" }) {
  const built = await validateAndBuildOrder({
    sessionId,
    restaurantId: "cafe-001",
    tableToken,
    items,
    orderType: "dine-in",
    specialInstructions: "",
    paymentMethod: "cash",
    customerName: name,
    customerPhone: phone,
  });
  return finalizeOrder(built);
}

const lineIds = (order) => order.items.map((l) => l.item.id);
const plain = (o) => JSON.parse(JSON.stringify(o));

test.beforeEach(() => {
  resetState();
  seedTable("tok-1", "Table 1", "sess-1");
  seedTable("tok-2", "Table 2", "sess-2");
});

// ---------------------------------------------------------------------------
test("REPORTED BUG: Order A (X drink) then Order B (Y food), same table + customer -> each has only its own items", async () => {
  const a = await placeOrder({ items: [{ id: "iced-latte", quantity: 1 }] });
  assert.deepEqual(lineIds(a), ["iced-latte"], "Order A contains only X Drink");
  assert.deepEqual(lineIds(emitted[0]), ["iced-latte"], "KOT #1 source payload: only X Drink");
  const snapshotA = plain(state.orders[0]);

  const b = await placeOrder({ items: [{ id: "margherita", quantity: 1 }] });
  assert.deepEqual(lineIds(b), ["margherita"], "Order B contains only Y Food Item");
  assert.equal(emitted.length, 2, "exactly one new-order broadcast per order");
  assert.deepEqual(lineIds(emitted[1]), ["margherita"], "KOT #2 source payload: only Y Food Item");
  assert.ok(!JSON.stringify(emitted[1]).includes("Iced Latte"), "X Drink must not appear anywhere in the second broadcast");

  // Order A is untouched in the database.
  assert.equal(state.orders.length, 2);
  assert.deepEqual(plain(state.orders[0]), snapshotA);
  assert.deepEqual(lineIds(state.orders[0]), ["iced-latte"]);

  // Distinct identities, same table/session relationships.
  assert.notEqual(a.orderId, b.orderId);
  assert.equal(a.sessionId, b.sessionId);
  assert.equal(a.tableToken, b.tableToken);
  assert.equal(a.tableLabel, "Table 1");
  assert.equal(a.tokenNumber, b.tokenNumber, "same dining session -> same Daily Token Number on both tickets");

  // The dining session rolls both orders up, without merging their items.
  assert.equal(state.tableSessions.length, 1, "one dining session for the visit");
  assert.deepEqual(state.tableSessions[0].orderIds, [a.orderId, b.orderId]);
  assert.equal(state.tableSessions[0].currentBill, a.totalAmount + b.totalAmount);
});

test("three consecutive orders: every broadcast carries only that order's lines", async () => {
  const wanted = [["iced-latte"], ["margherita"], ["club-sandwich"]];
  for (const ids of wanted) await placeOrder({ items: ids.map((id) => ({ id, quantity: 1 })) });

  assert.deepEqual(emitted.map(lineIds), wanted);
  assert.deepEqual(state.orders.map(lineIds), wanted, "history intact");
  assert.equal(new Set(state.orders.map((o) => o.orderId)).size, 3);
});

test("a new order with several different items and quantities contains exactly those lines", async () => {
  await placeOrder({ items: [{ id: "iced-latte", quantity: 1 }] });
  const b = await placeOrder({
    items: [
      { id: "margherita", quantity: 2 },
      { id: "club-sandwich", quantity: 1 },
      { id: "mint-mojito", quantity: 3 },
    ],
  });
  assert.deepEqual(lineIds(b), ["margherita", "club-sandwich", "mint-mojito"]);
  assert.deepEqual(b.items.map((l) => l.quantity), [2, 1, 3]);
  assert.deepEqual(lineIds(emitted[1]), ["margherita", "club-sandwich", "mint-mojito"]);
});

test("two tables order independently", async () => {
  const t1 = await placeOrder({ tableToken: "tok-1", sessionId: "sess-1", items: [{ id: "iced-latte", quantity: 1 }] });
  const t2 = await placeOrder({ tableToken: "tok-2", sessionId: "sess-2", phone: "9123456780", items: [{ id: "margherita", quantity: 1 }] });
  assert.deepEqual(lineIds(t1), ["iced-latte"]);
  assert.deepEqual(lineIds(t2), ["margherita"]);
  assert.equal(t2.tableLabel, "Table 2");
  assert.equal(state.tableSessions.length, 2, "each table has its own dining session");
  assert.deepEqual(state.tableSessions.map((s) => s.orderIds.length), [1, 1]);
  assert.notEqual(state.tableSessions[0].tokenNumber, state.tableSessions[1].tokenNumber);
});

test("the request body is not mutated and the same body can't alias a previous order's items", async () => {
  const body = {
    sessionId: "sess-1", restaurantId: "cafe-001", tableToken: "tok-1",
    items: [{ id: "iced-latte", quantity: 1 }], orderType: "dine-in", specialInstructions: "",
    paymentMethod: "cash", customerName: "Asha", customerPhone: "9876543210",
  };
  const first = await validateAndBuildOrder(body);
  body.items = [{ id: "margherita", quantity: 1 }]; // customer's next request
  const second = await validateAndBuildOrder(body);
  assert.deepEqual(lineIds(first), ["iced-latte"]);
  assert.deepEqual(lineIds(second), ["margherita"]);
  assert.notEqual(first.items, second.items);
  assert.notEqual(first.orderId, second.orderId);
});

test("invalid / empty payloads are rejected and create no order and no broadcast", async () => {
  const bad = [
    { items: [] },
    { items: undefined },
    { items: [{ id: "does-not-exist", quantity: 1 }] },
  ];
  for (const b of bad) {
    await assert.rejects(() => placeOrder(b), (err) => err instanceof ApiError && err.statusCode === 400);
  }
  await assert.rejects(
    () => placeOrder({ items: [{ id: "iced-latte", quantity: 1 }], tableToken: "tok-unknown" }),
    (err) => err instanceof ApiError && err.statusCode === 404
  );
  assert.equal(state.orders.length, 0, "no order persisted");
  assert.equal(emitted.length, 0, "no KOT trigger emitted");
  assert.equal(state.tableSessions.length, 0, "no dining session opened");
});

test("a rejected order does not disturb orders already placed", async () => {
  const a = await placeOrder({ items: [{ id: "iced-latte", quantity: 1 }] });
  const snapshot = plain(state.orders[0]);
  await assert.rejects(() => placeOrder({ items: [] }));
  assert.equal(state.orders.length, 1);
  assert.deepEqual(plain(state.orders[0]), snapshot);
  assert.equal(emitted.length, 1);
  assert.ok(a);
});
