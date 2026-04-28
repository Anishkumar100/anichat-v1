import { Server } from "socket.io";

let io;
// Map: userId (string) → socketId
const userSocketMap = {};

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
    pingTimeout:  60000,
    pingInterval: 25000,
    allowUpgrades: true,
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
