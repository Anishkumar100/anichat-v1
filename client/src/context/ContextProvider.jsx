import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import axios from "axios";

export const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
export const appContext = createContext();

export const ContextProvider = ({ children }) => {
  const [authUser, setAuthUser]             = useState(null);
  const [token, setToken]                   = useState(localStorage.getItem("token") || "");
  const [users, setUsers]                   = useState([]);
  const [groups, setGroups]                 = useState([]);
  const [unseenMessages, setUnseenMessages] = useState({});
  const [selectedUser, setSelectedUser]     = useState(null);
  const [selectedGroup, setSelectedGroup]   = useState(null);
  const [messages, setMessages]             = useState([]);
  const [groupMessages, setGroupMessages]   = useState([]);
  const [onlineUsers, setOnlineUsers]       = useState([]);
  // Client-side online inference: track when we last saw activity from each user.
  // If someone sent a message in the last 5 minutes, they're online — no DB needed.
  const recentActivity = useRef({});   // { userId: timestamp }

  // Call this any time we know a user is active
  const markUserActive = (userId) => {
    if (!userId) return;
    recentActivity.current[String(userId)] = Date.now();
  };

  // Merge DB online list with client-side activity inference
  const isUserOnline = (userId) => {
    if (!userId) return false;
    const uid = String(userId);
    if (onlineUsers.includes(uid)) return true;
    const last = recentActivity.current[uid];
    return last && (Date.now() - last) < 5 * 60 * 1000;  // 5 minutes
  };
  const [createGrp, setCreateGrp]           = useState(false);
  const [bg, setBg]                         = useState(
    JSON.parse(localStorage.getItem("bg")) || null
  );
  // isSunMode: true when blackhole.jpg (sun = red/orange), false when bgImage (dark = purple)
  // We import assets lazily to avoid circular deps — check the stored string key
  const isSunMode = bg !== null
    ? String(bg).includes("blackhole")    // blackhole.jpg → red/orange sun theme
    : false;                               // default: dark mode (bgImage is default bg)

  const socketRef        = useRef(null);
  const selectedUserRef  = useRef(selectedUser);
  const selectedGroupRef = useRef(selectedGroup);

  useEffect(() => { selectedUserRef.current  = selectedUser;  }, [selectedUser]);
  useEffect(() => { selectedGroupRef.current = selectedGroup; }, [selectedGroup]);

  // Restore session on page load
  useEffect(() => {
    if (!token) return;
    axios.get(`${BASE_URL}/api/auth/check`, { headers: { Authorization: token } })
      .then(({ data }) => { data.success ? setAuthUser(data.user) : logout(); })
      .catch(logout);
  }, [token]);

  // Socket connection
  useEffect(() => {
    if (!authUser) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      return;
    }

    const socket = io(BASE_URL, { query: { userId: authUser._id } });
    socketRef.current = socket;

    socket.on("onlineUsers", setOnlineUsers);

    // ── New DM received ──────────────────────────────────────────
    socket.on("newMessage", (newMessage) => {
      if (selectedUserRef.current?._id === newMessage.senderId) {
        setMessages((p) => [...p, newMessage]);
      } else {
        setUnseenMessages((p) => ({ ...p, [newMessage.senderId]: (p[newMessage.senderId] || 0) + 1 }));
      }
    });

    // ── New group message received ────────────────────────────────
    socket.on("newGroupMessage", ({ groupId, message }) => {
      if (selectedGroupRef.current?._id === groupId) {
        setGroupMessages((p) => [...p, message]);
      } else {
        setUnseenMessages((p) => ({ ...p, [`group_${groupId}`]: (p[`group_${groupId}`] || 0) + 1 }));
      }
    });

    // ── DM deleted ────────────────────────────────────────────────
    socket.on("messageDeleted", ({ messageId }) => {
      setMessages((p) => p.map((m) => m._id === messageId ? { ...m, deleted: true, text: "", image: "" } : m));
    });

    // ── Group message deleted ─────────────────────────────────────
    socket.on("groupMessageDeleted", ({ messageId }) => {
      setGroupMessages((p) => p.map((m) => m._id === messageId ? { ...m, deleted: true, text: "", image: "" } : m));
    });

    // ── DM reaction updated ───────────────────────────────────────
    socket.on("reactionUpdated", ({ messageId, reactions }) => {
      setMessages((p) => p.map((m) => m._id === messageId ? { ...m, reactions } : m));
    });

    // ── Group reaction updated ────────────────────────────────────
    socket.on("groupReactionUpdated", ({ messageId, reactions }) => {
      setGroupMessages((p) => p.map((m) => m._id === messageId ? { ...m, reactions } : m));
    });

    // ── Group metadata changed (name/pic/members) ─────────────────
    socket.on("groupUpdated", (updatedGroup) => {
      setGroups((p) => p.map((g) => g._id === updatedGroup._id ? updatedGroup : g));
      if (selectedGroupRef.current?._id === updatedGroup._id) setSelectedGroup(updatedGroup);
    });

    // ── You were removed from a group ────────────────────────────
    socket.on("removedFromGroup", ({ groupId }) => {
      setGroups((p) => p.filter((g) => g._id !== groupId));
      if (selectedGroupRef.current?._id === groupId) setSelectedGroup(null);
    });

    // ── A new group was created and you are a member ──────────────
    socket.on("newGroup", (group) => {
      setGroups((p) => [...p, group]);
    });

    return () => { socket.disconnect(); };
  }, [authUser]);

  const loginUser = (userData, jwtToken) => {
    setAuthUser(userData);
    setToken(jwtToken);
    localStorage.setItem("token", jwtToken);
  };

  const logout = () => {
    setAuthUser(null); setToken(""); setUsers([]); setGroups([]);
    setMessages([]); setGroupMessages([]); setSelectedUser(null);
    setSelectedGroup(null); setOnlineUsers([]); setUnseenMessages({});
    localStorage.removeItem("token");
    socketRef.current?.disconnect();
    socketRef.current = null;
  };

  const value = {
    authUser, setAuthUser, token, loginUser, logout,
    users, setUsers, groups, setGroups,
    selectedUser, setSelectedUser, selectedGroup, setSelectedGroup,
    messages, setMessages, groupMessages, setGroupMessages,
    onlineUsers, unseenMessages, setUnseenMessages,
    socket: socketRef.current,
    isUserOnline,
    markUserActive,
    createGrp, setCreateGrp,
    bg, setBg, isSunMode,
    axiosConfig: { headers: { Authorization: token } },
  };

  return <appContext.Provider value={value}>{children}</appContext.Provider>;
};

export const useAppContext = () => useContext(appContext);
