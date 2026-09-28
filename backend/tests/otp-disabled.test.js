// Proves real 2Factor OTP is fully bypassed by default: no network call, no
// API key needed, phone format still validated, and the normal success path
// (token issued) still runs. Run: npm test
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");

const src = (p) => path.join(__dirname, "..", "src", p);
const inject = (rel, exports) => {
  const p = require.resolve(src(rel));
  require.cache[p] = { id: p, filename: p, loaded: true, exports };
};

const records = [];
inject("models/PhoneVerification.js", {
  VERIFIED_TTL_MINUTES: 30,
  OTP_TTL_MINUTES: 10,
  async findOneAndUpdate(q, doc) {
    const i = records.findIndex((r) => r.phone === q.phone);
    if (i >= 0) records[i] = doc; else records.push(doc);
    return doc;
  },
});

// Any 2Factor contact = test failure: trap fetch, and trap the client module.
let fetchCalls = 0;
global.fetch = async () => { fetchCalls++; throw new Error("network call attempted"); };
let twoFactorLoaded = false;
inject("config/twoFactor.js", {
  sendOtpSms: async () => { twoFactorLoaded = true; },
  verifyOtpSms: async () => { twoFactorLoaded = true; },
});

delete process.env.OTP_PROVIDER;
delete process.env.TWOFACTOR_API_KEY;
const { sendOtp, verifyOtp } = require(src("services/otpService.js"));

test("verify with no OTP and no API key succeeds and issues a token", async () => {
  const token = await verifyOtp("9963676377", "");
  assert.ok(token && token.length >= 32);
  assert.equal(records[0].verified, true);
  assert.equal(records[0].method, "dev-bypass");
});

test("send is a no-op (no OTP generated, nothing stored)", async () => {
  const before = records.length;
  await sendOtp("9963676377");
  assert.equal(records.length, before);
});

test("phone format is still validated", async () => {
  await assert.rejects(() => verifyOtp("12345", ""), { statusCode: 400 });
  await assert.rejects(() => sendOtp("abc"), { statusCode: 400 });
});

test("ZERO communication with 2Factor", () => {
  assert.equal(fetchCalls, 0);
  assert.equal(twoFactorLoaded, false);
});
