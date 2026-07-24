/**
 * One-time migration: renames every existing document's `restaurantId`
 * field from the old demo value ("lifafa") to the new value ("maxibrew"),
 * across every collection that stores it — WITHOUT creating new documents
 * or breaking any existing relationships (orders <-> menu items <-> tables
 * <-> staff <-> customers all reference restaurantId by value, so this
 * updates them all in place, in one pass).
 *
 * Run this ONCE, before deploying the rebranded code, if your database
 * already has real data seeded under the old "lifafa" restaurantId
 * (e.g. a production DB that predates this rebrand). If you're starting
 * from a fresh/empty database, you don't need this — just run the normal
 * `npm run seed` script instead, which will seed directly under
 * "maxibrew".
 *
 * Usage:
 *   node src/seed/migrate-rename-restaurant.js
 */

require("dotenv").config();
const connectDB = require("../config/db");

const OLD_RESTAURANT_ID = "lifafa";
const NEW_RESTAURANT_ID = "maxibrew";

// Every model that stores a top-level `restaurantId` field.
const MODELS = [
  require("../models/Restaurant"),
  require("../models/MenuItem"),
  require("../models/Category"),
  require("../models/Table"),
  require("../models/TableSession"),
  require("../models/Session"),
  require("../models/Staff"),
  require("../models/Customer"),
  require("../models/Order"),
  require("../models/Reservation"),
];

async function migrate() {
  await connectDB();

  console.log(`Renaming restaurantId "${OLD_RESTAURANT_ID}" -> "${NEW_RESTAURANT_ID}"...`);

  let totalMatched = 0;
  let totalModified = 0;

  for (const Model of MODELS) {
    const result = await Model.updateMany(
      { restaurantId: OLD_RESTAURANT_ID },
      { $set: { restaurantId: NEW_RESTAURANT_ID } }
    );

    const matched = result.matchedCount ?? result.n ?? 0;
    const modified = result.modifiedCount ?? result.nModified ?? 0;
    totalMatched += matched;
    totalModified += modified;

    console.log(`  ${Model.modelName}: matched ${matched}, modified ${modified}`);
  }

  console.log(`Done. Total matched: ${totalMatched}, total modified: ${totalModified}.`);
  process.exit(0);
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
