import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";
import axios from "axios";

export const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
export const appContext = createContext();

const idEq = (a, b) => a && b && String(a) === String(b);

// Vercel serverless: Lambda instances don't share memory.
// Socket.io sessions created in one Lambda are unknown to the next → 400.
// Fix: skip Socket.io on Vercel, use REST polling + DB heartbeats instead.
const IS_VERCEL =
  (typeof window !== "undefined" && window.location.hostname.includes("vercel.app")) ||
  BASE_URL.includes("vercel.app");

const POLL_INTERVAL      = 2500;  // message/group refresh (ms)
const HEARTBEAT_INTERVAL = 25000; // online presence ping (ms)

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

  const isSunMode = bg !== null ? String(bg).includes("blackhole") : false;

  const socketRef        = useRef(null);
  const pollRef          = useRef(null);
  const heartbeatRef     = useRef(null);
  const selectedUserRef  = useRef(selectedUser);
  const selectedGroupRef = useRef(selectedGroup);
  const tokenRef         = useRef(token);

  useEffect(() => { selectedUserRef.current  = selectedUser;  }, [selectedUser]);
  useEffect(() => { selectedGroupRef.current = selectedGroup; }, [selectedGroup]);
  useEffect(() => { tokenRef.current         = token;         }, [token]);

  // Session restore
  useEffect(() => {
    if (!token) return;
    axios.get(`${BASE_URL}/api/auth/check`, { headers: { Authorization: token } })
      .then(({ data }) => { data.success ? setAuthUser(data.user) : logout(); })
      .catch(logout);
  }, [token]);

  // ── REST polling (Vercel path) ────────────────────────────────────
  const startRestPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const headers = { Authorization: tokenRef.current };

        // Sidebar users + unseen counts
        const { data: ud } = await axios.get(`${BASE_URL}/api/messages/users`, { headers });
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

        // Active DM messages
        const openUser = selectedUserRef.current;
        if (openUser) {
          const { data: md } = await axios.get(`${BASE_URL}/api/messages/${openUser._id}`, { headers });
          if (md.success) setMessages(md.messages);
        }

        // Active group messages
        const openGroup = selectedGroupRef.current;
        if (openGroup) {
          const { data: gd } = await axios.get(`${BASE_URL}/api/groups/${openGroup._id}/messages`, { headers });
          if (gd.success) setGroupMessages(gd.messages);
        }

        // Groups list
        const { data: grps } = await axios.get(`${BASE_URL}/api/groups`, { headers });
        if (grps.success) setGroups(grps.groups);

        // Online users — DB heartbeat based (works on Vercel, no Socket.io needed)
        const { data: ol } = await axios.get(`${BASE_URL}/api/auth/online`, { headers });
        if (ol.success) setOnlineUsers(ol.onlineIds);

      } catch { /* silent */ }
    }, POLL_INTERVAL);
  }, []);

  // ── Heartbeat — marks this user as online in the DB ──────────────
  const startHeartbeat = useCallback(() => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);

    // Ping immediately, then every HEARTBEAT_INTERVAL
    const ping = () => {
      if (!tokenRef.current) return;
      axios.post(`${BASE_URL}/api/auth/heartbeat`, {}, { headers: { Authorization: tokenRef.current } })
        .catch(() => {});
    };
    ping();
    heartbeatRef.current = setInterval(ping, HEARTBEAT_INTERVAL);
  }, []);

  // ── Socket.io (non-Vercel) OR REST polling (Vercel) ──────────────
  useEffect(() => {
    if (!authUser) {
      socketRef.current?.disconnect(); socketRef.current = null;
      clearInterval(pollRef.current);      pollRef.current = null;
      clearInterval(heartbeatRef.current); heartbeatRef.current = null;
      return;
    }

    // Always send heartbeat regardless of platform
    startHeartbeat();

    if (IS_VERCEL) {
      // Pure REST polling on Vercel — no socket errors, no 400s
      startRestPolling();
      return () => {
        clearInterval(pollRef.current);
        clearInterval(heartbeatRef.current);
      };
    }

    // ── Non-Vercel: full Socket.io ────────────────────────────────
    const socket = io(BASE_URL, {
      query: { userId: authUser._id },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1500,
      timeout: 20000,
    });
    socketRef.current = socket;

    socket.on("onlineUsers", (ids) => setOnlineUsers(ids.map(String)));

    socket.on("newMessage", (msg) => {
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
    socket.on("messageDeleted",      ({ messageId }) => setMessages(p => p.map(m => idEq(m._id, messageId) ? {...m, deleted:true, text:"", image:""} : m)));
    socket.on("messageHardDeleted",  ({ messageId }) => setMessages(p => p.filter(m => !idEq(m._id, messageId))));
    socket.on("groupMessageDeleted", ({ messageId }) => setGroupMessages(p => p.map(m => idEq(m._id, messageId) ? {...m, deleted:true, text:"", image:""} : m)));
    socket.on("groupMessageHardDeleted", ({ messageId }) => setGroupMessages(p => p.filter(m => !idEq(m._id, messageId))));
    socket.on("reactionUpdated",      ({ messageId, reactions }) => setMessages(p => p.map(m => idEq(m._id, messageId) ? {...m, reactions} : m)));
    socket.on("groupReactionUpdated", ({ messageId, reactions }) => setGroupMessages(p => p.map(m => idEq(m._id, messageId) ? {...m, reactions} : m)));
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

    return () => {
      socket.disconnect();
      clearInterval(heartbeatRef.current);
    };
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
    isVercel: IS_VERCEL,
    axiosConfig: { headers: { Authorization: token } },
  };

  return <appContext.Provider value={value}>{children}</appContext.Provider>;
};

export const useAppContext = () => useContext(appContext);
