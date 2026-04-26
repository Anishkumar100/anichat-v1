import express from "express";
import { auth } from "../middleware/auth.js";
import { getMessagesForSelectedUser, getUsersForSideBar, markMessageAsSeen, sendMessageToUser, deleteMessage, toggleReaction } from "../controller/messageController.js";

const messageRouter = express.Router();

messageRouter.get("/users", auth, getUsersForSideBar);
messageRouter.get("/:id", auth, getMessagesForSelectedUser);
messageRouter.post("/send/:id", auth, sendMessageToUser);
messageRouter.put("/mark/:id", auth, markMessageAsSeen);
messageRouter.delete("/:id", auth, deleteMessage);
messageRouter.post("/:id/react", auth, toggleReaction);

export default messageRouter;
