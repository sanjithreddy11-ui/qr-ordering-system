require("dotenv").config();
const connectDB = require("../config/db");
const MenuItem = require("../models/MenuItem");
const Table = require("../models/Table");
const Restaurant = require("../models/Restaurant");
const { RESTAURANT_ID, buildMenuItemDocs } = require("./menuData");
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
      name: "Lifafa",
      logo: "/logo.png",
      description:
        "A cozy neighborhood cafe serving fresh, seasonal comfort food and specialty drinks.",
      address: "123 Garden Lane, Hyderabad, Telangana",
      phone: "+91 98765 43210",
      theme: { primaryColor: "#3A4C3B", secondaryColor: "#263429" },
    },
    { upsert: true, new: true }
  );

  const menuDocs = buildMenuItemDocs();

  console.log(`Seeding ${menuDocs.length} menu items for ${RESTAURANT_ID}...`);
  for (const doc of menuDocs) {
    await MenuItem.findOneAndUpdate(
      { restaurantId: doc.restaurantId, id: doc.id },
      doc,
      { upsert: true, new: true }
    );
  }

  // Demo tables — the QR code for each physical table encodes a URL like:
  //   https://yourapp.com/lifafa?table=8d3af2e91c
  // Edit src/config/tables.js to add/remove/relabel tables.
  console.log(`Seeding ${DEMO_TABLES.length} demo tables...`);
  for (const t of DEMO_TABLES) {
    await Table.findOneAndUpdate({ token: t.token }, t, { upsert: true, new: true });
  }

  console.log("Seed complete.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
