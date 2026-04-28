import express from "express";
import { auth } from "../middleware/auth.js";
import {
  getMessagesForSelectedUser, getUsersForSideBar,
  markMessageAsSeen, sendMessageToUser,
  deleteMessage, toggleReaction, hardDeleteMessage, uploadGif
} from "../controller/messageController.js";

const messageRouter = express.Router();

// Static routes MUST come before dynamic /:id routes
messageRouter.get("/users",           auth, getUsersForSideBar);
messageRouter.post("/upload-gif",     auth, uploadGif);       // static path first
messageRouter.post("/send/:id",       auth, sendMessageToUser);
messageRouter.put("/mark/:id",        auth, markMessageAsSeen);
messageRouter.delete("/:id/hard",     auth, hardDeleteMessage);
messageRouter.delete("/:id",          auth, deleteMessage);
messageRouter.post("/:id/react",      auth, toggleReaction);
messageRouter.get("/:id",             auth, getMessagesForSelectedUser); // dynamic last

export default messageRouter;
