import express from "express";
import { auth } from "../middleware/auth.js";
import {
  createGroup, getUserGroups, getGroupMessages, sendGroupMessage,
  updateGroup, addMembers, removeMember, promoteToAdmin, leaveGroup,
  deleteGroupMessage, toggleGroupReaction
} from "../controller/groupController.js";

const groupRouter = express.Router();

// Static and specific-path routes MUST come before generic /:id patterns
// so Express doesn't accidentally swallow them with the wildcard

groupRouter.post("/create",                  auth, createGroup);
groupRouter.get("/",                         auth, getUserGroups);

// ── Message sub-routes (static "messages" segment first) ────────────
groupRouter.get("/messages/group/:id",       auth, getGroupMessages);    // alt fallback
groupRouter.delete("/messages/:id",          auth, deleteGroupMessage);
groupRouter.post("/messages/:id/react",      auth, toggleGroupReaction);

// ── Dynamic group-level routes (more specific path first) ────────────
groupRouter.patch("/:id/promote/:userId",    auth, promoteToAdmin);      // MUST be before /:id
groupRouter.post("/:id/members",             auth, addMembers);
groupRouter.delete("/:id/members/:userId",   auth, removeMember);
groupRouter.delete("/:id/leave",             auth, leaveGroup);
groupRouter.get("/:id/messages",             auth, getGroupMessages);
groupRouter.post("/:id/messages",            auth, sendGroupMessage);

// ── Generic /:id last so it doesn't swallow other routes ────────────
groupRouter.patch("/:id",                    auth, updateGroup);

export default groupRouter;
