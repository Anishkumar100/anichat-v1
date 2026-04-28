import groupModel from "../models/group.js";
import groupMessageModel from "../models/groupMessages.js";
import cloudinary from "../config/cloudinary.js";
import { io, getReceiverSocketId } from "../lib/socket.js";

const emitToGroup = (group, event, data, excludeId = null) => {
  const memberList = group.members || [];
  memberList.forEach((m) => {
    const id = m._id ? m._id.toString() : m.toString();
    if (excludeId && id === excludeId.toString()) return;
    const sid = getReceiverSocketId(id);
    if (sid) io.to(sid).emit(event, data);
  });
};

export const createGroup = async (req, res) => {
  try {
    const { name, bio, groupPic, memberIds } = req.body;
    const adminId = req.user._id;
    if (!name || !memberIds || memberIds.length === 0)
      return res.json({ success: false, message: "Group name and at least one member are required." });
    let groupPicUrl = "";
    if (groupPic) { const u = await cloudinary.uploader.upload(groupPic); groupPicUrl = u.secure_url; }
    const allMembers = [...new Set([...memberIds, adminId.toString()])];
    const newGroup = await groupModel.create({ name, bio: bio || "", groupPic: groupPicUrl, members: allMembers, admin: adminId });
    const populated = await groupModel.findById(newGroup._id).populate("members", "-password").populate("admin", "-password");
    emitToGroup(populated, "newGroup", populated, adminId);
    res.json({ success: true, group: populated });
  } catch (e) { res.json({ success: false, message: e.message }); }
};

export const getUserGroups = async (req, res) => {
  try {
    const groups = await groupModel.find({ members: req.user._id }).populate("members", "-password").populate("admin", "-password");
    res.json({ success: true, groups });
  } catch (e) { res.json({ success: false, message: e.message }); }
};

export const updateGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, bio, groupPic } = req.body;
    const group = await groupModel.findById(id);
    if (!group) return res.json({ success: false, message: "Group not found." });
    if (group.admin.toString() !== req.user._id.toString())
      return res.json({ success: false, message: "Only admin can edit." });
    const updates = {};
    if (name) updates.name = name;
    if (bio !== undefined) updates.bio = bio;
    if (groupPic) { const u = await cloudinary.uploader.upload(groupPic); updates.groupPic = u.secure_url; }
    const updated = await groupModel.findByIdAndUpdate(id, updates, { new: true }).populate("members", "-password").populate("admin", "-password");
    emitToGroup(updated, "groupUpdated", updated);
    res.json({ success: true, group: updated });
  } catch (e) { res.json({ success: false, message: e.message }); }
};

// ── Add members (admin only) ──────────────────────────────────────
export const addMembers = async (req, res) => {
  try {
    const { id: groupId } = req.params;
    const { userIds } = req.body;          // array of user IDs to add
    const adminId = req.user._id;
    const group = await groupModel.findById(groupId);
    if (!group) return res.json({ success: false, message: "Group not found." });
    if (group.admin.toString() !== adminId.toString())
      return res.json({ success: false, message: "Only admin can add members." });
    // $addToSet prevents duplicates
    await groupModel.findByIdAndUpdate(groupId, { $addToSet: { members: { $each: userIds } } });
    const updated = await groupModel.findById(groupId).populate("members", "-password").populate("admin", "-password");
    // Notify newly added members so their sidebar refreshes
    userIds.forEach((uid) => {
      const sid = getReceiverSocketId(uid);
      if (sid) io.to(sid).emit("newGroup", updated);
    });
    emitToGroup(updated, "groupUpdated", updated);
    res.json({ success: true, group: updated });
  } catch (e) { res.json({ success: false, message: e.message }); }
};

export const removeMember = async (req, res) => {
  try {
    const { id: groupId, userId: targetId } = req.params;
    const group = await groupModel.findById(groupId);
    if (!group) return res.json({ success: false, message: "Group not found." });
    if (group.admin.toString() !== req.user._id.toString())
      return res.json({ success: false, message: "Only admin can remove members." });
    await groupModel.findByIdAndUpdate(groupId, { $pull: { members: targetId } });
    const updated = await groupModel.findById(groupId).populate("members", "-password").populate("admin", "-password");
    const sid = getReceiverSocketId(targetId);
    if (sid) io.to(sid).emit("removedFromGroup", { groupId });
    emitToGroup(updated, "groupUpdated", updated);
    res.json({ success: true, group: updated });
  } catch (e) { res.json({ success: false, message: e.message }); }
};

export const promoteToAdmin = async (req, res) => {
  try {
    const { id: groupId, userId: newAdminId } = req.params;
    const group = await groupModel.findById(groupId);
    if (!group) return res.json({ success: false, message: "Group not found." });
    if (group.admin.toString() !== req.user._id.toString())
      return res.json({ success: false, message: "Only admin can promote." });
    const updated = await groupModel.findByIdAndUpdate(groupId, { admin: newAdminId }, { new: true }).populate("members", "-password").populate("admin", "-password");
    emitToGroup(updated, "groupUpdated", updated);
    res.json({ success: true, group: updated });
  } catch (e) { res.json({ success: false, message: e.message }); }
};

export const leaveGroup = async (req, res) => {
  try {
    const { id: groupId } = req.params;
    const userId = req.user._id;
    const group = await groupModel.findById(groupId);
    if (!group) return res.json({ success: false, message: "Group not found." });
    const updates = { $pull: { members: userId } };
    if (group.admin.toString() === userId.toString()) {
      const next = group.members.find(m => m.toString() !== userId.toString());
      if (next) updates.admin = next;
    }
    await groupModel.findByIdAndUpdate(groupId, updates);
    const updated = await groupModel.findById(groupId).populate("members", "-password").populate("admin", "-password");
    if (updated) emitToGroup(updated, "groupUpdated", updated, userId);
    res.json({ success: true });
  } catch (e) { res.json({ success: false, message: e.message }); }
};

export const getGroupMessages = async (req, res) => {
  try {
    const { id: groupId } = req.params;
    const userId = req.user._id;
    const messages = await groupMessageModel.find({ groupId }).populate("senderId", "fullName profilePic").sort({ createdAt: 1 });
    await groupMessageModel.updateMany({ groupId, seenBy: { $ne: userId } }, { $addToSet: { seenBy: userId } });
    res.json({ success: true, messages });
  } catch (e) { res.json({ success: false, message: e.message }); }
};

export const sendGroupMessage = async (req, res) => {
  try {
    const { text, image } = req.body;
    const { id: groupId } = req.params;
    const senderId = req.user._id;
    const group = await groupModel.findById(groupId);
    if (!group) return res.json({ success: false, message: "Group not found." });
    if (!group.members.some(m => m.toString() === senderId.toString()))
      return res.json({ success: false, message: "Not a member." });
    let imageUrl = "";
    if (image) { const u = await cloudinary.uploader.upload(image); imageUrl = u.secure_url; }
    const newMessage = await groupMessageModel.create({ groupId, senderId, text: text || "", image: imageUrl, seenBy: [senderId] });
    const populated = await groupMessageModel.findById(newMessage._id).populate("senderId", "fullName profilePic");
    emitToGroup(group, "newGroupMessage", { groupId, message: populated }, senderId);
    res.json({ success: true, newMessage: populated });
  } catch (e) { res.json({ success: false, message: e.message }); }
};

export const deleteGroupMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const message = await groupMessageModel.findById(id);
    if (!message) return res.json({ success: false, message: "Not found." });
    const group = await groupModel.findById(message.groupId);
    const isAdmin = group.admin.toString() === userId.toString();
    const isSender = message.senderId.toString() === userId.toString();
    if (!isAdmin && !isSender) return res.json({ success: false, message: "Cannot delete." });
    await groupMessageModel.findByIdAndUpdate(id, { deleted: true, text: "", image: "", reactions: [] });
    emitToGroup(group, "groupMessageDeleted", { messageId: id, groupId: message.groupId.toString() });
    res.json({ success: true });
  } catch (e) { res.json({ success: false, message: e.message }); }
};

export const toggleGroupReaction = async (req, res) => {
  try {
    const { id } = req.params;
    const { emoji } = req.body;
    const userId = req.user._id;
    const message = await groupMessageModel.findById(id);
    if (!message) return res.json({ success: false, message: "Not found." });
    const group = await groupModel.findById(message.groupId);
    const idx = message.reactions.findIndex(r => r.emoji === emoji);
    if (idx > -1) {
      const ui = message.reactions[idx].users.findIndex(u => u.toString() === userId.toString());
      if (ui > -1) { message.reactions[idx].users.splice(ui, 1); if (!message.reactions[idx].users.length) message.reactions.splice(idx, 1); }
      else message.reactions[idx].users.push(userId);
    } else { message.reactions.push({ emoji, users: [userId] }); }
    await message.save();
    emitToGroup(group, "groupReactionUpdated", { messageId: id, reactions: message.reactions });
    res.json({ success: true, reactions: message.reactions });
  } catch (e) { res.json({ success: false, message: e.message }); }
};

// ── Hard delete group message ─────────────────────────────────────────────────
export const hardDeleteGroupMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const message = await groupMessageModel.findById(id);
    if (!message) return res.json({ success: false, message: "Not found." });
    const group = await groupModel.findById(message.groupId);
    const isAdmin  = group.admin.toString() === userId.toString();
    const isSender = message.senderId.toString() === userId.toString();
    if (!isAdmin && !isSender)
      return res.json({ success: false, message: "Cannot delete this message." });

    await groupMessageModel.findByIdAndDelete(id);
    emitToGroup(group, "groupMessageHardDeleted", { messageId: id, groupId: message.groupId.toString() });
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};
