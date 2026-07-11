const express = require("express");
const { createSession, getSessionStatus } = require("../controllers/sessionController");

const router = express.Router();

router.post("/", createSession);
router.get("/:sessionId", getSessionStatus);

module.exports = router;
