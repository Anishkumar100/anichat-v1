import express from "express";
import { auth } from "../middleware/auth.js";
import {
  getMessagesForSelectedUser, getUsersForSideBar,
  markMessageAsSeen, sendMessageToUser,
  deleteMessage, toggleReaction, hardDeleteMessage, uploadGif
} from "../controller/messageController.js";

const messageRouter = express.Router();

messageRouter.get("/users",      auth, getUsersForSideBar);
messageRouter.get("/:id",        auth, getMessagesForSelectedUser);
messageRouter.post("/send/:id",  auth, sendMessageToUser);
messageRouter.put("/mark/:id",   auth, markMessageAsSeen);
messageRouter.delete("/:id",     auth, deleteMessage);
messageRouter.delete("/:id/hard",auth, hardDeleteMessage);
messageRouter.post("/:id/react", auth, toggleReaction);
messageRouter.post("/upload-gif", auth, uploadGif);  // personal GIF gallery upload

export default messageRouter;
