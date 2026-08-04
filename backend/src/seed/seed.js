require("dotenv").config();
const bcrypt = require("bcryptjs");
const connectDB = require("../config/db");
const MenuItem = require("../models/MenuItem");
const Category = require("../models/Category");
const Table = require("../models/Table");
const Restaurant = require("../models/Restaurant");
const Staff = require("../models/Staff");
const { RESTAURANT_ID, buildMenuItemDocs, buildCategoryDocs } = require("./menuData");
const { DEMO_TABLES } = require("../config/tables");

async function seed() {
  await connectDB();

  // Edit these details to match your actual cafe — they power the new
  // landing page. Re-run `npm run seed` after editing.
  console.log("Seeding restaurant profile...");
  await Restaurant.findOneAndUpdate(
    { restaurantId: RESTAURANT_ID },
    {
      restaurantId: RESTAURANT_ID,
      name: "Maxibrew",
      logo: "/logo.png",
      description:
        "A cozy neighborhood cafe serving fresh, seasonal comfort food and specialty drinks.",
      address: "H.No,11-8-99/27,Block no 8,Narasimhapuri colony,Sarrornagar,Kothapet,Hyderabad,500035",
      phone: "9392428760",
      email:"cafemaxibrew@gmail.com",
      fssaiNumber:"13624012000027",
      gstNumber:"36AATFC4089N1ZK",

      theme: { primaryColor: "#3A4C3B", secondaryColor: "#263429" },
    },
    { upsert: true, new: true }
  );

  // Categories power the filter chips in the admin "Create Order" picker
  // (CreateOrderFlow.tsx). These live in their own collection separate from
  // MenuItem, so they need to be seeded explicitly — without this, the
  // picker's category chips are always empty even once menu items exist.
  const categoryDocs = buildCategoryDocs();
  const currentCategoryIds = categoryDocs.map((c) => c.categoryId);
  const { deletedCount: deletedCategoryCount } = await Category.deleteMany({
    restaurantId: RESTAURANT_ID,
    categoryId: { $nin: currentCategoryIds },
  });
  if (deletedCategoryCount > 0) {
    console.log(`Removed ${deletedCategoryCount} stale categor${deletedCategoryCount === 1 ? "y" : "ies"} no longer in menuData.js...`);
  }

  console.log(`Seeding ${categoryDocs.length} categories for ${RESTAURANT_ID}...`);
  for (const doc of categoryDocs) {
    await Category.findOneAndUpdate(
      { restaurantId: doc.restaurantId, categoryId: doc.categoryId },
      doc,
      { upsert: true, new: true }
    );
  }

  const menuDocs = buildMenuItemDocs();

  // Full replace, not merge: delete any menu item for this restaurant that
  // isn't in the current menuData.js before upserting. Without this, old
  // items (including ones hand-edited via the Admin Menu Management
  // screen) stick around forever since findOneAndUpdate below only
  // adds/updates by id — it never removes items that were dropped from
  // menuData.js.
  const currentIds = menuDocs.map((d) => d.id);
  const { deletedCount } = await MenuItem.deleteMany({
    restaurantId: RESTAURANT_ID,
    id: { $nin: currentIds },
  });
  if (deletedCount > 0) {
    console.log(`Removed ${deletedCount} stale menu item(s) no longer in menuData.js...`);
  }

  console.log(`Seeding ${menuDocs.length} menu items for ${RESTAURANT_ID}...`);
  for (const doc of menuDocs) {
    await MenuItem.findOneAndUpdate(
      { restaurantId: doc.restaurantId, id: doc.id },
      doc,
      { upsert: true, new: true }
    );
  }

  // Demo tables — the QR code for each physical table encodes a URL like:
  //   https://yourapp.com/?table=8d3af2e91c
  // Edit src/config/tables.js to add/remove/relabel tables.
  console.log(`Seeding ${DEMO_TABLES.length} demo tables...`);
  for (const t of DEMO_TABLES) {
    await Table.findOneAndUpdate({ token: t.token }, t, { upsert: true, new: true });
  }

  // Default admin login for the dashboard — replaces the old hardcoded
  // frontend check (admin@maxibrew.com / maxibrew123) with a real Staff
  // record now that /api/auth/login validates against this collection.
  console.log("Seeding default admin account...");
  const defaultPasswordHash = await bcrypt.hash("maxibrew123", 10);
  await Staff.findOneAndUpdate(
    { restaurantId: RESTAURANT_ID, email: "admin@maxibrew.com" },
    {
      restaurantId: RESTAURANT_ID,
      name: "Maxibrew Admin",
      role: "admin",
      email: "admin@maxibrew.com",
      phone: "",
      passwordHash: defaultPasswordHash,
      isActive: true,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  console.log("Seed complete.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});