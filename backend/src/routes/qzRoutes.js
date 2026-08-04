const express = require("express");
const { getCertificate, signRequest } = require("../controllers/qzController");

const router = express.Router();

// Intentionally NOT behind requireAuth: this is called directly by the
// qz-tray browser SDK (see frontend/src/lib/printer/qzClient.ts), and only
// ever exposes the public certificate + a signature of an already-public
// nonce — never the private key, so there's nothing sensitive to protect
// behind a login here.
router.get("/cert", getCertificate);
router.get("/sign", signRequest);

module.exports = router;
