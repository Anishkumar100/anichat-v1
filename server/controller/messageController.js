import userModel from "../models/user.js";
import messageModel from "../models/messages.js";
import cloudinary from "../config/cloudinary.js";
import { io, getReceiverSocketId } from "../lib/socket.js";

// ── Get users for sidebar ─────────────────────────────────────────────────────
export const getUsersForSideBar = async (req, res) => {
  try {
    const userId = req.user._id;
    const filteredUsers = await userModel.find({ _id: { $ne: userId } }).select("-password");
    const unseenMessages = {};
    await Promise.all(filteredUsers.map(async (user) => {
      const unread = await messageModel.find({ senderId: user._id, recieverId: userId, seen: false, deleted: false });
      if (unread.length > 0) unseenMessages[user._id] = unread.length;
    }));
    res.json({ success: true, users: filteredUsers, unseenMessages });
  } catch (error) {
    console.error("getUsersForSideBar error:", error.message);
    res.json({ success: false, message: error.message });
  }
};

// ── Get messages ──────────────────────────────────────────────────────────────
export const getMessagesForSelectedUser = async (req, res) => {
  try {
    const myId = req.user._id;
    const { id: selectedUserId } = req.params;
    const messages = await messageModel.find({
      $or: [
        { senderId: myId, recieverId: selectedUserId },
        { senderId: selectedUserId, recieverId: myId },
      ],
    }).sort({ createdAt: 1 });
    await messageModel.updateMany({ senderId: selectedUserId, recieverId: myId, seen: false }, { seen: true });
    res.json({ success: true, messages });
  } catch (error) {
    console.error("getMessagesForSelectedUser error:", error.message);
    res.json({ success: false, message: error.message });
  }
};

// ── Send message ──────────────────────────────────────────────────────────────
export const sendMessageToUser = async (req, res) => {
  try {
    const { text, image } = req.body;
    const recieverId = req.params.id;
    const senderId = req.user._id;
    let imageUrl = "";
    if (image) {
      const upload = await cloudinary.uploader.upload(image);
      imageUrl = upload.secure_url;
    }
    const newMessage = await messageModel.create({ senderId, recieverId, text: text || "", image: imageUrl });
    const receiverSocketId = getReceiverSocketId(recieverId);
    if (receiverSocketId) io.to(receiverSocketId).emit("newMessage", newMessage);
    res.json({ success: true, newMessage });
  } catch (error) {
    console.error("sendMessageToUser error:", error.message);
    res.json({ success: false, message: error.message });
  }
};

// ── Mark seen ─────────────────────────────────────────────────────────────────
export const markMessageAsSeen = async (req, res) => {
  try {
    const { id } = req.params;
    const message = await messageModel.findByIdAndUpdate(id, { seen: true }, { new: true });
    if (!message) return res.json({ success: false, message: "Message not found." });
    const senderSocketId = getReceiverSocketId(message.senderId.toString());
    if (senderSocketId) io.to(senderSocketId).emit("messageSeen", { messageId: id });
    res.json({ success: true, message: "Message marked as seen." });
  } catch (error) {
    console.error("markMessageAsSeen error:", error.message);
    res.json({ success: false, message: error.message });
  }
};

// ── Delete message (soft) ─────────────────────────────────────────────────────
export const deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const message = await messageModel.findById(id);
    if (!message) return res.json({ success: false, message: "Message not found." });
    if (message.senderId.toString() !== userId.toString())
      return res.json({ success: false, message: "You can only delete your own messages." });

    await messageModel.findByIdAndUpdate(id, { deleted: true, text: "", image: "", reactions: [] });

    // Notify both sides in real-time
    const receiverSocketId = getReceiverSocketId(message.recieverId.toString());
    if (receiverSocketId) io.to(receiverSocketId).emit("messageDeleted", { messageId: id });
    const senderSocketId = getReceiverSocketId(userId.toString());
    if (senderSocketId) io.to(senderSocketId).emit("messageDeleted", { messageId: id });

    res.json({ success: true });
  } catch (error) {
    console.error("deleteMessage error:", error.message);
    res.json({ success: false, message: error.message });
  }
};

// ── Toggle emoji reaction ─────────────────────────────────────────────────────
export const toggleReaction = async (req, res) => {
  try {
    const { id } = req.params;
    const { emoji } = req.body;
    const userId = req.user._id;

    const message = await messageModel.findById(id);
    if (!message) return res.json({ success: false, message: "Message not found." });

    const existingIdx = message.reactions.findIndex((r) => r.emoji === emoji);
    if (existingIdx > -1) {
      const reaction = message.reactions[existingIdx];
      const userIdx = reaction.users.findIndex((u) => u.toString() === userId.toString());
      if (userIdx > -1) {
        reaction.users.splice(userIdx, 1);
        if (reaction.users.length === 0) message.reactions.splice(existingIdx, 1);
      } else {
        reaction.users.push(userId);
      }
    } else {
      message.reactions.push({ emoji, users: [userId] });
    }
    await message.save();

    // Notify both participants
    [message.senderId.toString(), message.recieverId.toString()].forEach((uid) => {
      const sid = getReceiverSocketId(uid);
      if (sid) io.to(sid).emit("reactionUpdated", { messageId: id, reactions: message.reactions });
    });

    res.json({ success: true, reactions: message.reactions });
  } catch (error) {
    console.error("toggleReaction error:", error.message);
    res.json({ success: false, message: error.message });
  }
};
