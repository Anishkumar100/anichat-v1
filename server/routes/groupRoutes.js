import express from "express";
import { auth } from "../middleware/auth.js";
import {
  createGroup, getUserGroups, getGroupMessages, sendGroupMessage,
  updateGroup, addMembers, removeMember, promoteToAdmin, leaveGroup,
  deleteGroupMessage, toggleGroupReaction, hardDeleteGroupMessage
} from "../controller/groupController.js";

const groupRouter = express.Router();

groupRouter.post("/create",                auth, createGroup);
groupRouter.get("/",                       auth, getUserGroups);
groupRouter.patch("/:id/promote/:userId",  auth, promoteToAdmin);
groupRouter.post("/:id/members",           auth, addMembers);
groupRouter.delete("/:id/members/:userId", auth, removeMember);
groupRouter.delete("/:id/leave",           auth, leaveGroup);
groupRouter.get("/:id/messages",           auth, getGroupMessages);
groupRouter.post("/:id/messages",          auth, sendGroupMessage);
groupRouter.delete("/messages/:id/hard",   auth, hardDeleteGroupMessage);
groupRouter.delete("/messages/:id",        auth, deleteGroupMessage);
groupRouter.post("/messages/:id/react",    auth, toggleGroupReaction);
groupRouter.patch("/:id",                  auth, updateGroup);

export default groupRouter;
