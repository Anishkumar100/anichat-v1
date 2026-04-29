import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";
import axios from "axios";

export const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
export const appContext = createContext();

const idEq = (a, b) => a && b && String(a) === String(b);

// Vercel serverless: Lambda instances are stateless — socket sessions are lost
// between requests → 400 errors. Solution: skip socket on Vercel, use REST polling.
const IS_VERCEL =
  (typeof window !== "undefined" && window.location.hostname.includes("vercel.app")) ||
  BASE_URL.includes("vercel.app");

const POLL_MS      = 2500;
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
  const pollRef          = useRef(null);
  const heartbeatRef     = useRef(null);
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
    return !!(last && Date.now() - last < 5 * 60 * 1000);
  }, [onlineUsers]);

  // Session restore
  useEffect(() => {
    if (!token) return;
    axios.get(`${BASE_URL}/api/auth/check`, { headers: { Authorization: token } })
      .then(({ data }) => { data.success ? setAuthUser(data.user) : logout(); })
      .catch(logout);
  }, [token]);

  // ── Heartbeat — marks this user as online in DB (works on Vercel) ─
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

  // ── REST polling (Vercel) ─────────────────────────────────────────
  const startRestPolling = useCallback(() => {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const h = { Authorization: tokenRef.current };

        // Sidebar users + unseen
        const { data: ud } = await axios.get(`${BASE_URL}/api/messages/users`, { headers: h });
        if (ud.success) {
          setUsers(ud.users);
          setUnseenMessages(prev => {
            const next = { ...prev };
            Object.entries(ud.unseenMessages || {}).forEach(([uid, cnt]) => {
              if (!idEq(selectedUserRef.current?._id, uid)) next[uid] = cnt;
              else next[uid] = 0;
            });
            return next;
          });
        }

        // Active DM
        const ou = selectedUserRef.current;
        if (ou) {
          const { data: md } = await axios.get(`${BASE_URL}/api/messages/${ou._id}`, { headers: h });
          if (md.success) {
            setMessages(md.messages);
            // Mark sender as active if recent
            const latest = md.messages?.[md.messages.length - 1];
            if (latest && Date.now() - new Date(latest.createdAt).getTime() < 5 * 60 * 1000) {
              markUserActive(ou._id);
            }
          }
        }

        // Active group
        const og = selectedGroupRef.current;
        if (og) {
          const { data: gd } = await axios.get(`${BASE_URL}/api/groups/${og._id}/messages`, { headers: h });
          if (gd.success) setGroupMessages(gd.messages);
        }

        // Groups list
        const { data: grps } = await axios.get(`${BASE_URL}/api/groups`, { headers: h });
        if (grps.success) setGroups(grps.groups);

        // DB-based online presence
        const { data: ol } = await axios.get(`${BASE_URL}/api/auth/online`, { headers: h });
        if (ol.success) setOnlineUsers(ol.onlineIds);

      } catch { /* silent */ }
    }, POLL_MS);
  }, [markUserActive]);

  // ── Socket / polling bootstrap ────────────────────────────────────
  useEffect(() => {
    if (!authUser) {
      socketRef.current?.disconnect(); socketRef.current = null;
      clearInterval(pollRef.current);      pollRef.current = null;
      clearInterval(heartbeatRef.current); heartbeatRef.current = null;
      return;
    }

    startHeartbeat(); // always — works on both Vercel and non-Vercel

    if (IS_VERCEL) {
      startRestPolling();
      return () => { clearInterval(pollRef.current); clearInterval(heartbeatRef.current); };
    }

    // ── Full Socket.io (non-Vercel) ───────────────────────────────
    const socket = io(BASE_URL, {
      query: { userId: authUser._id },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
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

    return () => { socket.disconnect(); clearInterval(heartbeatRef.current); };
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
    clearInterval(pollRef.current);      pollRef.current = null;
    clearInterval(heartbeatRef.current); heartbeatRef.current = null;
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
    isVercel: IS_VERCEL,
    axiosConfig: { headers: { Authorization: token } },
  };

  return <appContext.Provider value={value}>{children}</appContext.Provider>;
};

export const useAppContext = () => useContext(appContext);
