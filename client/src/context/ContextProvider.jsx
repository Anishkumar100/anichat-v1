import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";
import axios from "axios";

export const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
export const appContext = createContext();

const idEq = (a, b) => a && b && String(a) === String(b);

const HEARTBEAT_MS = 25000;

export const ContextProvider = ({ children }) => {
  const [authUser, setAuthUser]             = useState(null);
  const [token,    setToken]                = useState(localStorage.getItem("token") || "");
  const [users,    setUsers]                = useState([]);
  const [groups,   setGroups]               = useState([]);
  const [unseenMessages, setUnseenMessages] = useState({});
  const [selectedUser,  setSelectedUser]    = useState(null);
  const [selectedGroup, setSelectedGroup]   = useState(null);
  const [messages,      setMessages]        = useState([]);
  const [groupMessages, setGroupMessages]   = useState([]);
  const [onlineUsers,   setOnlineUsers]     = useState([]);
  const [createGrp,     setCreateGrp]       = useState(false);
  const [bg, setBg] = useState(JSON.parse(localStorage.getItem("bg")) || null);

  const isSunMode = bg !== null ? String(bg).includes("blackhole") : false;

  const socketRef        = useRef(null);
  const heartbeatRef     = useRef(null);
  const onlinePollRef    = useRef(null);
  const selectedUserRef  = useRef(selectedUser);
  const selectedGroupRef = useRef(selectedGroup);
  const tokenRef         = useRef(token);
  const recentActivity   = useRef({});  // userId → last-seen timestamp (client-side)

  useEffect(() => { selectedUserRef.current  = selectedUser; }, [selectedUser]);
  useEffect(() => { selectedGroupRef.current = selectedGroup; }, [selectedGroup]);
  useEffect(() => { tokenRef.current = token; }, [token]);

  // ── Client-side online inference ──────────────────────────────────
  const markUserActive = useCallback((userId) => {
    if (!userId) return;
    recentActivity.current[String(userId)] = Date.now();
  }, []);

  const isUserOnline = useCallback((userId) => {
    if (!userId) return false;
    const uid = String(userId);
    if (onlineUsers.includes(uid)) return true;
    const last = recentActivity.current[uid];
    return !!(last && Date.now() - last < 30 * 1000);
  }, [onlineUsers]);

  // Session restore
  useEffect(() => {
    if (!token) return;
    axios.get(`${BASE_URL}/api/auth/check`, { headers: { Authorization: token } })
      .then(({ data }) => { data.success ? setAuthUser(data.user) : logout(); })
      .catch(logout);
  }, [token]);

  // ── Heartbeat — marks this user as online in DB (safety net alongside socket) ─
  const startHeartbeat = useCallback(() => {
    clearInterval(heartbeatRef.current);
    const ping = () => {
      if (!tokenRef.current) return;
      axios.post(`${BASE_URL}/api/auth/heartbeat`, {}, {
        headers: { Authorization: tokenRef.current }
      }).catch(() => {});
    };
    ping();
    heartbeatRef.current = setInterval(ping, HEARTBEAT_MS);
  }, []);

  // ── Socket.io bootstrap ─────────────────────────────────────────
  useEffect(() => {
    if (!authUser) {
      socketRef.current?.disconnect(); socketRef.current = null;
      clearInterval(heartbeatRef.current); heartbeatRef.current = null;
      clearInterval(onlinePollRef.current); onlinePollRef.current = null;
      return;
    }

    startHeartbeat(); // safety net for online presence

    // ── Full Socket.io ────────────────────────────────────────────
    const socket = io(BASE_URL, {
      query: { userId: authUser._id },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1500,
    });
    socketRef.current = socket;

    socket.on("onlineUsers", (ids) => setOnlineUsers(ids.map(String)));

    socket.on("newMessage", (msg) => {
      markUserActive(msg.senderId);
      if (idEq(selectedUserRef.current?._id, msg.senderId)) {
        setMessages(p => [...p, msg]);
      } else {
        const sid = String(msg.senderId);
        setUnseenMessages(p => ({ ...p, [sid]: (p[sid] || 0) + 1 }));
      }
    });

    socket.on("newGroupMessage", ({ groupId, message }) => {
      if (idEq(selectedGroupRef.current?._id, groupId)) {
        setGroupMessages(p => [...p, message]);
      } else {
        const key = `group_${groupId}`;
        setUnseenMessages(p => ({ ...p, [key]: (p[key] || 0) + 1 }));
      }
    });

    socket.on("messageSeen", ({ messageId }) => {
      setMessages(p => p.map(m => idEq(m._id, messageId) ? { ...m, seen: true } : m));
    });

    socket.on("messageDeleted",          ({ messageId }) => setMessages(p => p.map(m => idEq(m._id, messageId) ? { ...m, deleted: true, text: "", image: "" } : m)));
    socket.on("messageHardDeleted",      ({ messageId }) => setMessages(p => p.filter(m => !idEq(m._id, messageId))));
    socket.on("groupMessageDeleted",     ({ messageId }) => setGroupMessages(p => p.map(m => idEq(m._id, messageId) ? { ...m, deleted: true, text: "", image: "" } : m)));
    socket.on("groupMessageHardDeleted", ({ messageId }) => setGroupMessages(p => p.filter(m => !idEq(m._id, messageId))));
    socket.on("reactionUpdated",         ({ messageId, reactions }) => setMessages(p => p.map(m => idEq(m._id, messageId) ? { ...m, reactions } : m)));
    socket.on("groupReactionUpdated",    ({ messageId, reactions }) => setGroupMessages(p => p.map(m => idEq(m._id, messageId) ? { ...m, reactions } : m)));

    socket.on("groupUpdated", (g) => {
      setGroups(p => p.map(x => idEq(x._id, g._id) ? g : x));
      if (idEq(selectedGroupRef.current?._id, g._id)) setSelectedGroup(g);
    });
    socket.on("newGroup", (g) => {
      setGroups(p => p.some(x => idEq(x._id, g._id)) ? p.map(x => idEq(x._id, g._id) ? g : x) : [...p, g]);
    });
    socket.on("removedFromGroup", ({ groupId }) => {
      setGroups(p => p.filter(g => !idEq(g._id, groupId)));
      if (idEq(selectedGroupRef.current?._id, groupId)) setSelectedGroup(null);
    });

    // ── DB-based online polling (safety net — detects offline even if socket misses disconnect) ─
    const pollOnline = () => {
      if (!tokenRef.current) return;
      axios.get(`${BASE_URL}/api/auth/online`, { headers: { Authorization: tokenRef.current } })
        .then(({ data: ol }) => { if (ol.success) setOnlineUsers(ol.onlineIds); })
        .catch(() => {});
    };
    pollOnline();
    onlinePollRef.current = setInterval(pollOnline, 30000);

    return () => { socket.disconnect(); clearInterval(heartbeatRef.current); clearInterval(onlinePollRef.current); };
  }, [authUser]);

  const loginUser = (userData, jwtToken) => {
    setAuthUser(userData); setToken(jwtToken);
    localStorage.setItem("token", jwtToken);
  };

  const logout = () => {
    setAuthUser(null); setToken(""); setUsers([]); setGroups([]);
    setMessages([]); setGroupMessages([]); setSelectedUser(null);
    setSelectedGroup(null); setOnlineUsers([]); setUnseenMessages({});
    localStorage.removeItem("token");
    socketRef.current?.disconnect(); socketRef.current = null;
    clearInterval(heartbeatRef.current); heartbeatRef.current = null;
    clearInterval(onlinePollRef.current); onlinePollRef.current = null;
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
    isUserOnline, markUserActive,
    axiosConfig: { headers: { Authorization: token } },
  };

  return <appContext.Provider value={value}>{children}</appContext.Provider>;
};

export const useAppContext = () => useContext(appContext);
