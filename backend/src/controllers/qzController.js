const crypto = require("crypto");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { loadQzCert } = require("../config/qzCert");

// GET /api/qz/cert
// QZ Tray's security.setCertificatePromise() calls this to fetch the
// public certificate identifying this app. Plain text response, exactly
// as the QZ Tray client expects — not JSON.
const getCertificate = asyncHandler(async (req, res) => {
  const cert = loadQzCert();
  if (!cert) {
    throw new ApiError(
      500,
      "QZ Tray signing certificate is not configured. Set QZ_CERTIFICATE/QZ_PRIVATE_KEY or generate backend/certs/ (see config/qzCert.js)."
    );
  }
  res.type("text/plain").send(cert.certificate);
});

// GET /api/qz/sign?request=<string to sign>
// QZ Tray's security.setSignaturePromise() calls this with the exact
// string it wants signed (a per-request nonce QZ generates itself), and
// expects back a base64 RSA-SHA512 signature made with the private key
// that matches the certificate above. The private key never leaves the
// backend. Plain text response, matching the QZ Tray client's expectation.
const signRequest = asyncHandler(async (req, res) => {
  const { request } = req.query;
  if (!request || typeof request !== "string") {
    throw new ApiError(400, "request query param is required");
  }

  const cert = loadQzCert();
  if (!cert) {
    throw new ApiError(500, "QZ Tray signing certificate is not configured.");
  }

  const signer = crypto.createSign("SHA512");
  signer.update(request);
  signer.end();
  const signature = signer.sign(cert.privateKey, "base64");

  res.type("text/plain").send(signature);
});

module.exports = { getCertificate, signRequest };
