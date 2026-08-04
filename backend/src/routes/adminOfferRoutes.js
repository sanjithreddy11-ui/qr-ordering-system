const express = require("express");
const {
  listOffers,
  createOffer,
  updateOffer,
  deleteOffer,
} = require("../controllers/offerController");

const router = express.Router();

router.get("/:restaurantId", listOffers);
router.post("/", createOffer);
router.patch("/:offerId", updateOffer);
router.delete("/:offerId", deleteOffer);

module.exports = router;
