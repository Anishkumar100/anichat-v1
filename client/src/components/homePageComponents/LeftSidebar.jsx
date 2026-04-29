import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import assets from "../../assets/assets";
import { BASE_URL, useAppContext } from "../../context/ContextProvider";

export const LeftSidebar = ({ setBg, bg }) => {
  const navigate = useNavigate();

  const {
    authUser, token, logout,
    users, setUsers,
    groups, setGroups,
    selectedUser, setSelectedUser,
    selectedGroup, setSelectedGroup,
    onlineUsers,
    unseenMessages, setUnseenMessages,
    createGrp, setCreateGrp,
    isSunMode,isUserOnline   // ← theme flag from context
  } = useAppContext();

  const [search, setSearch] = useState("");

  // Shared accent helpers — one source of truth for every themed colour in this component
  // dark = purple  |  sun = orange-red
  const accent      = isSunMode ? "bg-orange-500/60"           : "bg-violet-500/50";
  const hoverBg     = isSunMode ? "hover:bg-orange-500/10"     : "hover:bg-[#282142]/40";
  const activeBg    = isSunMode ? "bg-orange-500/15"           : "bg-[#282142]/50";
  const badgeBg     = isSunMode ? "bg-gradient-to-r from-orange-500 to-red-500" : "bg-violet-500/50";
  const toggleDot   = isSunMode ? "bg-yellow-400 text-black"   : "bg-purple-600 text-white";

  // Close dropdown on outside click/tap (works on mobile)
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, []);

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      try {
        const [{ data: ud }, { data: gd }] = await Promise.all([
          axios.get(`${BASE_URL}/api/messages/users`, { headers: { Authorization: token } }),
          axios.get(`${BASE_URL}/api/groups`, { headers: { Authorization: token } }),
        ]);
        if (ud.success) { setUsers(ud.users); setUnseenMessages(ud.unseenMessages || {}); }
        if (gd.success) setGroups(gd.groups);
      } catch (err) { console.error("Sidebar load error:", err.message); }
    };
    load();
  }, [token]);

  const filteredUsers  = users.filter(u => u.fullName.toLowerCase().includes(search.toLowerCase()));
  const filteredGroups = groups.filter(g => g.name.toLowerCase().includes(search.toLowerCase()));

  const handleSelectUser = (user) => {
    setSelectedUser(user); setSelectedGroup(null);
    setUnseenMessages(prev => { const u = { ...prev }; delete u[user._id]; return u; });
  };
  const handleSelectGroup = (group) => {
    setSelectedGroup(group); setSelectedUser(null);
    setUnseenMessages(prev => { const u = { ...prev }; delete u[`group_${group._id}`]; return u; });
  };

  return (
    <div className="bg-[#8185B2]/10 h-full p-5 overflow-y-scroll text-white">
      <div className="pb-5">

        {/* ── Logo + Menu ─────────────────────────────────────────────── */}
        <div className="flex justify-between items-center">
          <img src={assets.logo} alt="logo" className="max-w-40" />

          <div className="relative flex justify-between items-center gap-4 py-2 group">
            {/* Theme toggle */}
            <div
              onClick={() => {
                const newBg = bg === assets.bgImage ? assets.blackBg : assets.bgImage;
                setBg(newBg);
                localStorage.setItem("bg", JSON.stringify(newBg));
              }}
              className="flex items-center gap-1 bg-[#282142] border border-gray-600 rounded-full px-2 py-1 cursor-pointer transition-all duration-300 hover:scale-105"
            >
              <div className={`w-5 h-5 flex items-center justify-center rounded-full transition-all duration-300 ${toggleDot}`}>
                {bg === assets.bgImage ? "🌙" : "🔥"}
              </div>
            </div>

            <img src={assets.menu_icon} alt="menu" className="max-h-5 cursor-pointer select-none" onClick={() => setMenuOpen(p => !p)} />

            {/* Dropdown — state controlled, works on touch devices */}
            <div ref={menuRef} className={`absolute top-full right-0 z-50 w-36 py-2 rounded-md bg-[#282142] text-gray-100 shadow-xl border border-gray-600 ${menuOpen ? "block" : "hidden"}`}>
              <p onClick={() => { setMenuOpen(false); navigate("/profile"); }} className="cursor-pointer text-sm px-4 py-2 hover:bg-white/10">Edit Profile</p>
              <hr className="my-2 border-t border-gray-500" />
              <p onClick={() => { setMenuOpen(false); setCreateGrp(true); navigate("/new-group"); }} className="cursor-pointer text-sm px-4 py-2 hover:bg-white/10">Create Group</p>
              <hr className="my-2 border-t border-gray-500" />
              <p onClick={() => { setMenuOpen(false); logout(); }} className="cursor-pointer text-sm px-4 py-2 hover:bg-white/10 text-red-400">Logout</p>
            </div>
          </div>
        </div>

        {/* ── Search ──────────────────────────────────────────────────── */}
        <div className="bg-[#282142] rounded-full flex items-center gap-2 py-3 px-4 mt-5">
          <img src={assets.search_icon} alt="Search" className="w-3" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-transparent border-none outline-none text-white text-xs placeholder-[#c8c8c8] flex-1"
            placeholder="Search users and groups"
          />
        </div>

        {/* ── Users ───────────────────────────────────────────────────── */}
        <div className="flex flex-col">
          <p className="text-xs text-gray-400 mb-2 mt-5">Users</p>
          {filteredUsers.length === 0 && <p className="text-xs text-gray-500 pl-4">No users found</p>}

          {filteredUsers.map(user => {
            const isOnline = isUserOnline ? isUserOnline(user._id) : onlineUsers.includes(user._id);
            const unread   = unseenMessages[user._id];
            const isActive = selectedUser?._id === user._id;

            return (
              <div
                key={user._id}
                onClick={() => handleSelectUser(user)}
                className={`relative flex items-center gap-2 p-2 pl-4 rounded cursor-pointer max-sm:text-sm transition-colors duration-200 ${hoverBg} ${isActive ? activeBg : ""}`}
              >
                <div className="relative">
                  <img src={user.profilePic || assets.avatar_icon} alt=""
                    className="w-[35px] aspect-[1/1] rounded-full object-cover" />
                  {isOnline && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border border-[#282142]" />
                  )}
                </div>
                <div className="flex flex-col leading-5">
                  <p>{user.fullName}</p>
                  <span className={`text-xs ${isOnline ? "text-green-400" : "text-neutral-400"}`}>
                    {isOnline ? "Online" : "Offline"}
                  </span>
                </div>
                {unread > 0 && (
                  <p className={`absolute top-4 right-4 text-xs h-5 w-5 flex justify-center items-center rounded-full text-white ${badgeBg}`}>
                    {unread}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Groups ──────────────────────────────────────────────────────── */}
      <div className="mt-5 flex flex-col">
        <p className="text-xs text-gray-400 mb-2">Groups</p>
        {filteredGroups.length === 0 && <p className="text-xs text-gray-500 pl-4">No groups yet</p>}

        {filteredGroups.map(group => {
          const unread   = unseenMessages[`group_${group._id}`];
          const isActive = selectedGroup?._id === group._id;

          return (
            <div
              key={group._id}
              onClick={() => handleSelectGroup(group)}
              className={`relative flex items-center gap-2 p-2 pl-4 rounded cursor-pointer max-sm:text-sm transition-colors duration-200 ${hoverBg} ${isActive ? activeBg : ""}`}
            >
              <img src={group.groupPic || assets.avatar_icon} alt=""
                className="w-[35px] aspect-[1/1] rounded-full object-cover" />
              <div className="flex flex-col leading-5">
                <p>{group.name}</p>
                <span className="text-neutral-400 text-xs">{group.members.length} members</span>
              </div>
              {unread > 0 && (
                <p className={`absolute top-4 right-4 text-xs h-5 w-5 flex justify-center items-center rounded-full text-white ${badgeBg}`}>
                  {unread}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
