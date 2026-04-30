/**
 * ============================================================
 *  lib/socket.js  —  Socket.io Server Setup
 * ============================================================
 *
 *  🔌 WHAT IS A WEBSOCKET / SOCKET.IO?
 *
 *  Normal HTTP: Client asks → Server answers → connection closes.
 *  WebSocket:   Client connects ONCE → both sides can talk anytime.
 *
 *  Socket.io is a library built on top of WebSockets.
 *  It adds features like rooms, auto-reconnect, and fallback
 *  to long-polling when WebSockets aren't available.
 *
 *  🧠 HOW THIS FILE WORKS:
 *
 *  1. We create one `io` (Server) instance attached to the HTTP server.
 *  2. We keep a MAP of  userId → socketId  so we know WHERE to deliver
 *     messages to a specific user.
 *  3. When a user logs in on the client, they connect the socket and
 *     send their userId in the handshake query string.
 *  4. We store that, and broadcast who's online to everyone.
 *  5. When they disconnect, we remove them from the map + re-broadcast.
 *
 *  ─────────────────────────────────────────────
 *   userSocketMap = {
 *     "userId_A": "socket123",    ← Alison is online
 *     "userId_B": "socket456",    ← Martin is online
 *   }
 *  ─────────────────────────────────────────────
 *
 *  The controller uses getReceiverSocketId() to find out where
 *  to push a new message in real-time.
 */

import { Server } from "socket.io";
import userModel from "../models/user.js";

// ─── Module-level singletons ───────────────────────────────────────────────
// `io` is exported so controllers can emit events directly.
let io;

/**
 * userId → socketId mapping.
 * Object (not Map) so Object.keys() gives us online user IDs easily.
 */
const userSocketMap = {};

// ─── Initialiser ───────────────────────────────────────────────────────────
/**
 * Call this ONCE from server.js after the HTTP server is created.
 * Returns the io instance (also accessible via the named export).
 *
 * @param {import("http").Server} server  The Node http.Server instance
 */
export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      // Allow all origins in dev; lock this down to your frontend URL in prod
      origin: process.env.CLIENT_URL || "*",
      methods: ["GET", "POST"],
    },
  });

  // ── Event: A new client socket connects ──────────────────────────────────
  io.on("connection", (socket) => {
    /*
     *  socket.handshake.query contains everything the client passed
     *  when calling io("http://...", { query: { userId: "..." } }).
     *  This is how the server knows WHICH user just connected.
     */
    const userId = socket.handshake.query.userId;

    if (userId) {
      // Register this user as online
      userSocketMap[userId] = socket.id;
      console.log(`✅ User connected: ${userId} → socket ${socket.id}`);

      // Mark online in DB so the safety-net poll also agrees
      userModel.findByIdAndUpdate(userId, { lastSeen: new Date() }).catch(() => {});

      /*
       *  Broadcast the full list of online user IDs to EVERY connected client.
       *  The client stores this array in `onlineUsers` state and uses it
       *  to show the green dot next to user names in the sidebar.
       */
      io.emit("onlineUsers", Object.keys(userSocketMap));
    }

    // ── Event: Client disconnects (tab closed, logout, network drop) ────────
    socket.on("disconnect", () => {
      if (userId) {
        delete userSocketMap[userId];
        console.log(`❌ User disconnected: ${userId}`);

        // Clear lastSeen in DB so the safety-net poll won't re-add this user as online
        userModel.findByIdAndUpdate(userId, { lastSeen: new Date(0) }).catch(() => {});

        // Re-broadcast the updated online list
        io.emit("onlineUsers", Object.keys(userSocketMap));
      }
    });
  });

  return io;
};

// ─── Helper used by message/group controllers ──────────────────────────────
/**
 * Look up the current socket ID for a given user.
 * Returns undefined if the user is offline.
 *
 * @param {string} userId
 * @returns {string | undefined}
 */
export const getReceiverSocketId = (userId) => userSocketMap[String(userId)];

// Named export so controllers can do:  import { io } from "../lib/socket.js"
export { io };
