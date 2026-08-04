// Thin wrapper around the 2Factor.in SMS OTP API. Used only by
// services/otpService.js — no DLT registration needed for this route
// (2Factor's OTP product is a pre-approved real-time verification route),
// unlike regular branded/templated SMS.
//
// Docs: https://2factor.in/API/DOCS/SMS_OTP.html
const BASE_URL = "https://2factor.in/API/V1";

function getApiKey() {
  const apiKey = process.env.TWOFACTOR_API_KEY;
  if (!apiKey) {
    throw new Error("Missing TWOFACTOR_API_KEY in .env file");
  }
  return apiKey;
}

// Sends an OTP to a 10-digit Indian mobile number. 2Factor generates and
// stores the OTP on their end — we never see or store the code itself,
// only the session id it hands back (see verifyOtpSms below).
// Returns the session id on success, throws on failure.
async function sendOtpSms(phoneDigits) {
  const apiKey = getApiKey();
  const url = `${BASE_URL}/${apiKey}/SMS/91${phoneDigits}/AUTOGEN`;

  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));

  if (data.Status !== "Success" || !data.Details) {
    console.error("2Factor sendOtpSms failed:", data);
    throw new Error("Couldn't send the OTP. Please try again.");
  }

  return data.Details; // session id
}

// Verifies a customer-entered OTP against a 2Factor session id (from
// sendOtpSms above). Returns true if matched, false otherwise — never
// throws for a simple mismatch, only for a genuine API/network failure.
async function verifyOtpSms(sessionId, otp) {
  const apiKey = getApiKey();
  const url = `${BASE_URL}/${apiKey}/SMS/VERIFY/${sessionId}/${otp}`;

  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));

  if (data.Status === "Success") {
    return true;
  }
  // Any other Status (e.g. "Error" for a wrong/expired code) just means
  // "not verified" — not a system failure.
  return false;
}

module.exports = { sendOtpSms, verifyOtpSms };
