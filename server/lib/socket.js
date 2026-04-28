import { Server } from "socket.io";

let io;
// Map: userId (string) → socketId
const userSocketMap = {};

export const initSocket = (server) => {
  // On Vercel: restrict to polling only — WebSocket upgrade requests are
  // silently dropped by Vercel's load-balancer before reaching this code.
  // Allowing upgrades causes the client to loop endlessly attempting WebSocket.
  const onVercel = process.env.VERCEL === "1" || !!process.env.VERCEL_URL;

  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || "*",
      methods: ["GET", "POST", "OPTIONS"],
      credentials: true,
    },
    transports: onVercel ? ["polling"] : ["websocket", "polling"],
    // Polling tuning — faster interval = lower perceived latency
    pingTimeout:   60000,
    pingInterval:  25000,
    // Disable upgrade on Vercel to stop the retry loop
    allowUpgrades: !onVercel,
    // Required for polling to work across serverless invocations
    // Note: socket state is NOT persisted across serverless calls on Vercel.
    // For persistent sockets, deploy to Railway/Render/Fly.io instead.
  });

  io.on("connection", (socket) => {
    const userId = socket.handshake.query.userId
      ? String(socket.handshake.query.userId)
      : null;

    if (userId) {
      userSocketMap[userId] = socket.id;
      console.log(`✅ Connected: ${userId} via ${socket.conn.transport.name}`);
      // Broadcast updated online list to everyone
      io.emit("onlineUsers", Object.keys(userSocketMap));
    }

    // Handle transport upgrade (polling → websocket)
    socket.conn.on("upgrade", (transport) => {
      console.log(`⬆️  Upgraded to: ${transport.name} for ${userId}`);
    });

    socket.on("disconnect", (reason) => {
      if (userId) {
        delete userSocketMap[userId];
        console.log(`❌ Disconnected: ${userId} (${reason})`);
        io.emit("onlineUsers", Object.keys(userSocketMap));
      }
    });

    // Client can explicitly ping to check connection
    socket.on("ping", () => socket.emit("pong"));
  });

  return io;
};

export const getReceiverSocketId = (userId) => {
  if (!userId) return undefined;
  return userSocketMap[String(userId)];
};

export { io };
