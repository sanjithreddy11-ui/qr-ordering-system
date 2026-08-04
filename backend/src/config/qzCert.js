const fs = require("fs");
const path = require("path");

// QZ Tray signing material — this is what lets QZ Tray remember "yes,
// trust this app" ONCE instead of prompting on every single print job.
//
// QZ Tray identifies a caller by its certificate. Without a certificate
// (the previous implementation sent a blank one), there's no stable
// identity to remember, so QZ re-prompts on every connection. With a
// certificate + matching signature on every request, QZ Tray shows its
// "Action Required" dialog only the first time it sees this certificate;
// once staff check "Remember this decision" there, it's silent from then
// on — exactly QZ's recommended production setup (see qz.io/wiki/signing).
//
// In production, set QZ_CERTIFICATE and QZ_PRIVATE_KEY as env vars (PEM
// text, with real newlines replaced by "\n"). For local dev, these fall
// back to backend/certs/digital-certificate.txt and
// backend/certs/private-key.pem — generate them once with:
//
//   openssl req -x509 -newkey rsa:2048 -nodes -days 3650 \
//     -subj "/CN=Your Restaurant QZ Signing" \
//     -keyout backend/certs/private-key.pem \
//     -out backend/certs/digital-certificate.txt
//
// The private key must NEVER be sent to the browser — only the backend
// signs requests (see controllers/qzController.js); the frontend only
// ever receives the public certificate and a signature.
const CERT_PATH = path.join(__dirname, "..", "..", "certs", "digital-certificate.txt");
const KEY_PATH = path.join(__dirname, "..", "..", "certs", "private-key.pem");

let cached = null;

function loadQzCert() {
  if (cached) return cached;

  const certificate = process.env.QZ_CERTIFICATE
    ? process.env.QZ_CERTIFICATE.replace(/\\n/g, "\n")
    : fs.existsSync(CERT_PATH)
    ? fs.readFileSync(CERT_PATH, "utf8")
    : null;

  const privateKey = process.env.QZ_PRIVATE_KEY
    ? process.env.QZ_PRIVATE_KEY.replace(/\\n/g, "\n")
    : fs.existsSync(KEY_PATH)
    ? fs.readFileSync(KEY_PATH, "utf8")
    : null;

  if (!certificate || !privateKey) {
    return null;
  }

  cached = { certificate, privateKey };
  return cached;
}

module.exports = { loadQzCert };
