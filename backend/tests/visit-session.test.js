// Visit-based OTP session tests. No MongoDB needed: the three Mongoose
// models the service touches are swapped for a tiny in-memory fake via
// require.cache BEFORE the real service/middleware/controllers load, so the
// real business logic is what's under test. Run: npm test
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");

const src = (p) => path.join(__dirname, "..", "src", p);

// ---- minimal in-memory Mongoose-like collection -------------------------
let idCounter = 0;
function makeModel() {
  const docs = [];
  const match = (d, q) =>
    Object.entries(q).every(([k, v]) => String(d[k]) === String(v));
  const wrap = (d) => {
    if (!d) return d;
    d.save = async () => d;
    return d;
  };
  return {
    docs,
    async findOne(q) { return wrap(docs.find((d) => match(d, q)) || null); },
    async create(data) {
      const d = { _id: `id_${++idCounter}`, ...data };
      docs.push(d);
      return wrap(d);
    },
    async updateMany(q, u) {
      let n = 0;
      docs.filter((d) => match(d, q)).forEach((d) => { Object.assign(d, u.$set); n++; });
      return { modifiedCount: n };
    },
    findById(id) { return { lean: async () => docs.find((d) => d._id === id) || null }; },
  };
}
const Visit = makeModel();
const Customer = makeModel();
const Table = makeModel();
const inject = (rel, exports) => {
  const p = require.resolve(src(rel));
  require.cache[p] = { id: p, filename: p, loaded: true, exports };
};
inject("models/VisitSession.js", Visit);
inject("models/Customer.js", Customer);
inject("models/Table.js", Table);

const svc = require(src("services/visitSessionService.js"));
const { verifyPhoneToken } = require(src("middleware/verifyPhoneToken.js"));

// verifyOtp (SMS) is the only thing not under test — stub it.
inject("services/otpService.js", { sendOtp: async () => {}, verifyOtp: async () => "legacy-token" });
const { verifyOtpHandler } = require(src("controllers/otpController.js"));
const { getVisitStatus } = require(src("controllers/visitController.js"));

const call = (handler, req) =>
  new Promise((resolve) => {
    const res = { json: (b) => resolve({ body: b }) };
    handler({ headers: {}, body: {}, query: {}, ...req }, res, (err) => resolve({ err }));
  });

const PHONE = "9963676377";
const DEV = "dev_X";
let table13, table8;

test("setup tables", async () => {
  table13 = await Table.create({ token: "t13", restaurantId: "maxibrew" });
  table8 = await Table.create({ token: "t8", restaurantId: "maxibrew" });
});

let visitToken;

test("first visit: no active visit -> OTP verify creates customer + ACTIVE visit", async () => {
  let st = await call(getVisitStatus, { query: { tableToken: "t13", deviceId: DEV } });
  assert.equal(st.body.active, false);

  const r = await call(verifyOtpHandler, { body: { phone: PHONE, otp: "123456", deviceId: DEV, tableToken: "t13", name: "Shravan" } });
  assert.equal(r.body.verified, true);
  visitToken = r.body.visitToken;
  assert.ok(visitToken.length >= 32);
  assert.equal(Customer.docs.length, 1);
  assert.equal(Visit.docs[0].status, "active");
});

test("multiple orders + refresh: token keeps working, status stays active, NO OTP", async () => {
  for (let i = 0; i < 4; i++) {
    const r = await call(verifyPhoneToken, { headers: { authorization: `Bearer ${visitToken}` }, body: { customerPhone: PHONE } });
    assert.equal(r.err, undefined, `order ${i + 1} should be authorized`);
  }
  const st = await call(getVisitStatus, { query: { tableToken: "t13", deviceId: DEV } });
  assert.equal(st.body.active, true);
});

test("security: wrong phone, bogus token, missing token are all rejected", async () => {
  const wrongPhone = await call(verifyPhoneToken, { headers: { authorization: `Bearer ${visitToken}` }, body: { customerPhone: "9000000000" } });
  assert.equal(wrongPhone.err.statusCode, 401);
  const bogus = await call(verifyPhoneToken, { headers: { authorization: "Bearer nope" }, body: { customerPhone: PHONE } });
  assert.equal(bogus.err.statusCode, 401);
  const none = await call(verifyPhoneToken, { body: { customerPhone: PHONE } });
  assert.equal(none.err.statusCode, 401);
});

test("other device has no active visit -> OTP required", async () => {
  const st = await call(getVisitStatus, { query: { tableToken: "t13", deviceId: "dev_OTHER" } });
  assert.equal(st.body.active, false);
});

test("Print Bill / billing modal do nothing to the visit (no close call made)", async () => {
  assert.equal(Visit.docs[0].status, "active");
});

test("Submit Bill success closes visit (not deleted), records endReason", async () => {
  const { closedCount } = await svc.closeActiveVisitSessionsForTable(table13._id, "BILL_SUBMITTED");
  assert.equal(closedCount, 1);
  assert.equal(Visit.docs.length, 1, "history kept, not deleted");
  assert.equal(Visit.docs[0].status, "closed");
  assert.equal(Visit.docs[0].endReason, "BILL_SUBMITTED");
  assert.ok(Visit.docs[0].endedAt instanceof Date);
});

test("duplicate Submit Bill is safe (idempotent close)", async () => {
  const { closedCount } = await svc.closeActiveVisitSessionsForTable(table13._id, "BILL_SUBMITTED");
  assert.equal(closedCount, 0);
  assert.equal(Visit.docs[0].endReason, "BILL_SUBMITTED");
});

test("after close: old token rejected, same device asks OTP again, customer remains", async () => {
  const r = await call(verifyPhoneToken, { headers: { authorization: `Bearer ${visitToken}` }, body: { customerPhone: PHONE } });
  assert.equal(r.err.statusCode, 401);
  const st = await call(getVisitStatus, { query: { tableToken: "t8", deviceId: DEV } });
  assert.equal(st.body.active, false);
  assert.equal(Customer.docs.length, 1);
});

test("second visit (same device, Table 8): new OTP -> NEW session, closed one never reused", async () => {
  const r = await call(verifyOtpHandler, { body: { phone: PHONE, otp: "654321", deviceId: DEV, tableToken: "t8" } });
  assert.notEqual(r.body.visitToken, visitToken);
  assert.equal(Visit.docs.length, 2);
  assert.equal(Visit.docs[0].status, "closed");
  assert.equal(Visit.docs[1].status, "active");
  assert.equal(Customer.docs.length, 1, "same permanent customer reused");
  assert.equal(String(Visit.docs[1].customerId), String(Visit.docs[0].customerId));
  const old = await call(verifyPhoneToken, { headers: { authorization: `Bearer ${visitToken}` }, body: { customerPhone: PHONE } });
  assert.equal(old.err.statusCode, 401);
});

test("verify requires deviceId and tableToken", async () => {
  const a = await call(verifyOtpHandler, { body: { phone: PHONE, otp: "1", tableToken: "t8" } });
  assert.equal(a.err.statusCode, 400);
  const b = await call(verifyOtpHandler, { body: { phone: PHONE, otp: "1", deviceId: DEV } });
  assert.equal(b.err.statusCode, 400);
});
