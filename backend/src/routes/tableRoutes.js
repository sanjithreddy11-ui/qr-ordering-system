const express = require("express");
const { getTableByToken } = require("../controllers/tableController");

const router = express.Router();

router.get("/:token", getTableByToken);

module.exports = router;