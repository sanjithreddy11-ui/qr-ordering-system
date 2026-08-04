const express = require("express");
const {
  listReservations,
  createReservation,
  updateReservation,
  cancelReservation,
  checkInReservation,
  markNoShow,
} = require("../controllers/reservationController");

const router = express.Router();

router.get("/:restaurantId", listReservations);
router.post("/", createReservation);
router.patch("/:reservationId", updateReservation);
router.delete("/:reservationId", cancelReservation);
router.post("/:reservationId/check-in", checkInReservation);
router.post("/:reservationId/no-show", markNoShow);

module.exports = router;
