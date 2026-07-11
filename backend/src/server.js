require("dotenv").config();
const http = require("http");
const createApp = require("./app");
const connectDB = require("./config/db");
const { initSocket } = require("./sockets/socket");

const PORT = process.env.PORT || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:3000";

async function start() {
  await connectDB();

  const app = createApp(CLIENT_ORIGIN);
  const httpServer = http.createServer(app);

  initSocket(httpServer, CLIENT_ORIGIN);

  httpServer.listen(PORT, () => {
    console.log(`SmartQR backend running on http://localhost:${PORT}`);
    console.log(`Accepting requests from: ${CLIENT_ORIGIN}`);
  });
}

start();
