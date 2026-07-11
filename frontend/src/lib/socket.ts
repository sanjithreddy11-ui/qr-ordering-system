import { io, Socket } from "socket.io-client";
import { API_BASE_URL } from "@/lib/config";

let socket: Socket | null = null;

// One shared connection for the whole app (kitchen dashboard AND
// order-success page can both use this without opening duplicate sockets).
export function getSocket(): Socket {
  if (!socket) {
    socket = io(API_BASE_URL, {
      transports: ["websocket"],
      autoConnect: true,
    });
  }
  return socket;
}
