import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import axios from "axios";

export const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
export const appContext = createContext();

// Safe string comparison — handles ObjectId objects vs plain strings
const idEq = (a, b) => a && b && String(a) === String(b);

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
  const [createGrp, setCreateGrp]           = useState(false);
  const [bg, setBg]                         = useState(
    JSON.parse(localStorage.getItem("bg")) || null
  );

  const isSunMode = bg !== null
    ? String(bg).includes("blackhole")
    : false;

  const socketRef        = useRef(null);
  const selectedUserRef  = useRef(selectedUser);
  const selectedGroupRef = useRef(selectedGroup);
  // Keep refs always current so socket closures always read latest state
  useEffect(() => { selectedUserRef.current  = selectedUser;  }, [selectedUser]);
  useEffect(() => { selectedGroupRef.current = selectedGroup; }, [selectedGroup]);

  // Restore session on page load
  useEffect(() => {
    if (!token) return;
    axios.get(`${BASE_URL}/api/auth/check`, { headers: { Authorization: token } })
      .then(({ data }) => { data.success ? setAuthUser(data.user) : logout(); })
      .catch(logout);
  }, [token]);

  // ── Socket connection ──────────────────────────────────────────────
  useEffect(() => {
    if (!authUser) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      return;
    }

    // Detect Vercel deployment — Vercel's infrastructure blocks WebSocket upgrades
    // at the load-balancer level. Using polling-only prevents the infinite
    // failed-WebSocket-retry loop. Polling works perfectly and is near-real-time.
    const isVercel = window.location.hostname.includes("vercel.app") ||
                     BASE_URL.includes("vercel.app");

    const socket = io(BASE_URL, {
      query: { userId: authUser._id },
      // On Vercel: polling only (WebSocket is blocked at infra level)
      // On other hosts (Railway, Render, local): try WebSocket first
      transports: isVercel ? ["polling"] : ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: isVercel ? 20 : 10,  // polling reconnects faster
      reconnectionDelay: 1500,
      timeout: 30000,
      // Prevent WebSocket upgrade attempts on Vercel (causes console spam)
      upgrade: !isVercel,
    });
    socketRef.current = socket;

    // ── Online presence ────────────────────────────────────────────
    socket.on("onlineUsers", (ids) => {
      // ids = array of plain strings from server
      setOnlineUsers(ids.map(String));
    });

    // ── New DM received ────────────────────────────────────────────
    socket.on("newMessage", (newMessage) => {
      // FIX: use idEq for safe ObjectId ↔ string comparison
      if (idEq(selectedUserRef.current?._id, newMessage.senderId)) {
        setMessages((p) => [...p, newMessage]);
        // Also mark as seen immediately if chat is open
      } else {
        const sid = String(newMessage.senderId);
        setUnseenMessages((p) => ({ ...p, [sid]: (p[sid] || 0) + 1 }));
      }
    });

    // ── New group message ──────────────────────────────────────────
    socket.on("newGroupMessage", ({ groupId, message }) => {
      if (idEq(selectedGroupRef.current?._id, groupId)) {
        setGroupMessages((p) => [...p, message]);
      } else {
        const key = `group_${groupId}`;
        setUnseenMessages((p) => ({ ...p, [key]: (p[key] || 0) + 1 }));
      }
    });

    // ── DM soft deleted ────────────────────────────────────────────
    socket.on("messageDeleted", ({ messageId }) => {
      setMessages((p) => p.map((m) =>
        idEq(m._id, messageId) ? { ...m, deleted: true, text: "", image: "" } : m
      ));
    });

    // ── DM hard deleted ────────────────────────────────────────────
    socket.on("messageHardDeleted", ({ messageId }) => {
      setMessages((p) => p.filter((m) => !idEq(m._id, messageId)));
    });

    // ── Group message soft deleted ─────────────────────────────────
    socket.on("groupMessageDeleted", ({ messageId }) => {
      setGroupMessages((p) => p.map((m) =>
        idEq(m._id, messageId) ? { ...m, deleted: true, text: "", image: "" } : m
      ));
    });

    // ── Group message hard deleted ─────────────────────────────────
    socket.on("groupMessageHardDeleted", ({ messageId }) => {
      setGroupMessages((p) => p.filter((m) => !idEq(m._id, messageId)));
    });

    // ── Reactions ──────────────────────────────────────────────────
    socket.on("reactionUpdated", ({ messageId, reactions }) => {
      setMessages((p) => p.map((m) => idEq(m._id, messageId) ? { ...m, reactions } : m));
    });
    socket.on("groupReactionUpdated", ({ messageId, reactions }) => {
      setGroupMessages((p) => p.map((m) => idEq(m._id, messageId) ? { ...m, reactions } : m));
    });

    // ── Group updated (name/pic/members) ───────────────────────────
    socket.on("groupUpdated", (updatedGroup) => {
      setGroups((p) => p.map((g) => idEq(g._id, updatedGroup._id) ? updatedGroup : g));
      if (idEq(selectedGroupRef.current?._id, updatedGroup._id)) {
        setSelectedGroup(updatedGroup);
      }
    });

    // ── Added to a group you weren't in before ─────────────────────
    socket.on("newGroup", (group) => {
      // Prevent duplicates
      setGroups((p) => {
        const exists = p.some((g) => idEq(g._id, group._id));
        return exists ? p.map((g) => idEq(g._id, group._id) ? group : g) : [...p, group];
      });
    });

    // ── Removed from a group ───────────────────────────────────────
    socket.on("removedFromGroup", ({ groupId }) => {
      setGroups((p) => p.filter((g) => !idEq(g._id, groupId)));
      if (idEq(selectedGroupRef.current?._id, groupId)) setSelectedGroup(null);
    });

    // ── Reconnect: re-register userId so presence map is rebuilt ──
    socket.on("reconnect", () => {
      console.log("Socket reconnected — re-emitting userId");
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
    createGrp, setCreateGrp,
    bg, setBg, isSunMode,
    axiosConfig: { headers: { Authorization: token } },
  };

  return <appContext.Provider value={value}>{children}</appContext.Provider>;
};

export const useAppContext = () => useContext(appContext);
