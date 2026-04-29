import express from "express";
import { auth } from "../middleware/auth.js";
import {
  getMessagesForSelectedUser, getUsersForSideBar,
  markMessageAsSeen, sendMessageToUser,
  deleteMessage, toggleReaction, hardDeleteMessage, uploadGif
} from "../controller/messageController.js";

const messageRouter = express.Router();

// Static routes BEFORE dynamic /:id routes (order matters in Express)
messageRouter.get("/users",           auth, getUsersForSideBar);
messageRouter.post("/upload-gif",     auth, uploadGif);
messageRouter.post("/send/:id",       auth, sendMessageToUser);
messageRouter.put("/mark/:id",        auth, markMessageAsSeen);
messageRouter.delete("/:id/hard",     auth, hardDeleteMessage);
messageRouter.delete("/:id",          auth, deleteMessage);
messageRouter.post("/:id/react",      auth, toggleReaction);
messageRouter.get("/:id",             auth, getMessagesForSelectedUser);

export default messageRouter;
