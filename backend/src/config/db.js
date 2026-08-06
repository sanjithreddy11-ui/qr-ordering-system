const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);
const mongoose = require("mongoose");

async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error("Missing MONGODB_URI in .env file");
    process.exit(1);
  }

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    console.log("MongoDB connected:", mongoose.connection.name);
  } catch (err) {
    console.error("MongoDB connection failed:", err.message);
    throw err;
  }
}

module.exports = connectDB;
