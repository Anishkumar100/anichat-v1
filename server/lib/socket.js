/**
 * lib/socket.js — Socket.io Server Setup
 *
 * VERCEL NOTE:
 * Vercel's serverless functions don't support persistent WebSocket connections.
 * Socket.io will automatically fall back to HTTP long-polling on Vercel.
 * For production real-time features, deploy the server on Railway/Render/Fly.io.
 *
 * The configuration below:
 *  - Allows both WebSocket and polling transports
 *  - Sets generous timeouts so polling feels near-real-time
 *  - Explicitly allows the client origin via CORS
 */

import { Server } from "socket.io";

let io;
const userSocketMap = {};

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
    // Allow both transports — Vercel will use polling, other hosts use WebSocket
    transports: ["websocket", "polling"],
    // Generous timeouts for polling transport
    pingTimeout:  60000,
    pingInterval: 25000,
    // Required for Vercel — allows the upgrade to be attempted
    allowUpgrades: true,
    // Path (default /socket.io/) — must match client
    path: "/socket.io/",
  });

  io.on("connection", (socket) => {
    const userId = socket.handshake.query.userId;
    if (userId) {
      userSocketMap[userId] = socket.id;
      console.log(`✅ User connected: ${userId} → ${socket.id} (${socket.conn.transport.name})`);
      io.emit("onlineUsers", Object.keys(userSocketMap));
    }

    socket.on("disconnect", () => {
      if (userId) {
        delete userSocketMap[userId];
        console.log(`❌ User disconnected: ${userId}`);
        io.emit("onlineUsers", Object.keys(userSocketMap));
      }
    });
  });

  return io;
};

export const getReceiverSocketId = (userId) => userSocketMap[String(userId)];
export { io };
