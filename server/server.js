/**
 * ============================================================
 *  server.js  —  Application Entry Point
 * ============================================================
 *
 *  🛠 What happens here (in order):
 *
 *  1. Create an Express app (handles HTTP REST routes).
 *  2. Wrap it in a raw Node http.Server  — Socket.io NEEDS
 *     a raw http.Server, not the Express app directly.
 *  3. Pass that http.Server to initSocket() → Socket.io boots up.
 *  4. Register REST API routes (user auth + messages + groups).
 *  5. Connect to MongoDB.
 *  6. Start listening on PORT.
 *
 *  ⚠️  BUG FIXED: process.env.port (lowercase) → process.env.PORT
 */

import express from "express";
import "dotenv/config";
import cors from "cors";
import http from "http";
import { connectDB } from "./config/db.js";
import userRouter from "./routes/userRoutes.js";
import messageRouter from "./routes/messageRoutes.js";
import groupRouter from "./routes/groupRoutes.js";
import { initSocket } from "./lib/socket.js";

// ─── 1. Express app + raw HTTP server ─────────────────────────────────────
const app = express();

/*
 *  Why http.createServer(app)?
 *  ─────────────────────────
 *  Socket.io attaches a WebSocket "upgrade" listener to the raw http.Server.
 *  Express alone doesn't expose that upgrade event.
 *
 *  Flow of a request:
 *    Browser → http.Server → (if HTTP)       → Express routes
 *                          → (if WS upgrade) → Socket.io
 */
const server = http.createServer(app);

// ─── 2. Boot Socket.io on the SAME http.Server ────────────────────────────
initSocket(server);

// ─── 3. Global Middleware ──────────────────────────────────────────────────
// Parse JSON request bodies; 4MB limit allows base64-encoded images
app.use(express.json({ limit: "4mb" }));

app.use(
  cors({
    origin: process.env.CLIENT_URL || "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ─── 4. REST Routes ────────────────────────────────────────────────────────
// Health-check endpoint – Vercel/Render ping this to confirm the server is up
app.get("/", (req, res) => {
  res.json({ success: true, message: "AniChat server is live" });
});

app.use("/api/auth", userRouter);        // signup, login, profile update, check-auth
app.use("/api/messages", messageRouter); // get users, get/send messages, mark-seen
app.use("/api/groups", groupRouter);     // create group, get groups, group messages

// ─── 5. Connect DB then start server ──────────────────────────────────────
await connectDB();

const PORT = process.env.PORT || 8000;   // ⚠️ Fixed: was process.env.port (lowercase)

server.listen(PORT, () => {
  console.log(`AniChat HTTP + WebSocket server running on port ${PORT}`);
});
