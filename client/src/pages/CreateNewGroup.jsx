/**
 * pages/CreateNewGroup.jsx  —  Create Group Page
 *
 *  Connected to backend:
 *    POST /api/groups/create
 *
 *  Image upload flow (same as ProfilePage):
 *    File → FileReader → base64 → server → Cloudinary → stored URL
 *
 *  On success → navigates back to home, new group appears in sidebar.
 *
 *  UI is unchanged from original — only the submit handler is wired up.
 */

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import assets from "../assets/assets";
import { BASE_URL, useAppContext } from "../context/ContextProvider";

export const CreateNewGroup = () => {
  const navigate = useNavigate();
  const { users, token, setGroups, groups } = useAppContext();

  const [selectedImage, setSelectedImage] = useState(null);
  const [groupName, setGroupName] = useState("");
  const [groupBio, setGroupBio] = useState("");
  const [search, setSearch] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleToggleMember = (user) => {
    setSelectedMembers((prev) =>
      prev.find((u) => u._id === user._id)
        ? prev.filter((u) => u._id !== user._id)
        : [...prev, user]
    );
  };

  // ─── Submit Handler ──────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (selectedMembers.length === 0) {
      setErrorMsg("Please add at least one member.");
      return;
    }

    setLoading(true);

    try {
      let groupPicBase64 = null;

      if (selectedImage) {
        groupPicBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(selectedImage);
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
        });
      }

      const { data } = await axios.post(
        `${BASE_URL}/api/groups/create`,
        {
          name: groupName,
          bio: groupBio,
          groupPic: groupPicBase64,
          memberIds: selectedMembers.map((u) => u._id),
        },
        { headers: { Authorization: token } }
      );

      if (data.success) {
        // Add the new group to the context so the sidebar updates immediately
        setGroups((prev) => [...prev, data.group]);
        navigate("/");
      } else {
        setErrorMsg(data.message);
      }
    } catch (error) {
      setErrorMsg("Something went wrong. Please try again.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Filter users by search
  const filteredUsers = (users || []).filter((user) =>
    user.fullName.toLowerCase().includes(search.toLowerCase())
  );

  // Star animation (unchanged from original)
  const [stars, setStars] = useState([]);
  useEffect(() => {
    const starArray = [];
    for (let i = 0; i < 50; i++) {
      starArray.push({
        id: i,
        top: Math.random() * 100,
        left: Math.random() * 100,
        size: Math.random() * 2 + 1,
        duration: (Math.random() * 2 + 2).toFixed(2),
        delay: (Math.random() * 2).toFixed(2),
      });
    }
    setStars(starArray);
  }, []);

  return (
    <div className="relative w-screen h-screen backdrop-blur-2xl overflow-hidden bg-transparent flex items-center justify-center animate-fade-in">

      {/* Flickering Stars */}
      <div className="stars-layer">
        {stars.map((star) => (
          <div key={star.id} className="star-flicker"
            style={{ position: "absolute", top: `${star.top}%`, left: `${star.left}%`, width: `${star.size}px`, height: `${star.size}px`, animationDuration: `${star.duration}s`, animationDelay: `${star.delay}s` }} />
        ))}
      </div>

      {/* Main Card */}
      <div className="relative z-10 w-full h-full max-w-none backdrop-blur-2xl border border-gray-600 shadow-2xl text-gray-300 flex flex-col lg:flex-row rounded-none overflow-hidden">

        {/* Logo */}
        <img className="w-full lg:max-w-sm object-contain p-6 animate-fade-in-slow" src={assets.logo} alt="AniChat Logo" />

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col justify-start gap-4 p-6 sm:p-10 flex-1 animate-fade-in will-change-transform overflow-y-auto">
          <h3 className="text-3xl font-semibold text-white mb-2">Create New Group</h3>

          {/* Group pic */}
          <label htmlFor="groupPic" className="flex items-center gap-4 cursor-pointer hover:opacity-80 transition-all">
            <input onChange={(e) => setSelectedImage(e.target.files[0])} type="file" id="groupPic" accept=".png, .jpg, .jpeg" hidden />
            <img
              src={selectedImage ? URL.createObjectURL(selectedImage) : assets.avatar_icon}
              alt="Group Pic"
              className={`w-16 h-16 object-cover ${selectedImage ? "rounded-full" : ""}`}
            />
            <span className="text-white text-sm">Upload Group Picture</span>
          </label>

          <input onChange={(e) => setGroupName(e.target.value)} type="text" placeholder="Group Name" required value={groupName}
            className="p-3 bg-white/10 text-white border border-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all" />

          <textarea className="p-3 bg-white/10 text-white border border-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all"
            placeholder="Group Description" rows={3} value={groupBio} onChange={(e) => setGroupBio(e.target.value)} required />

          {/* Search */}
          <input type="text" placeholder="Search users to add" value={search} onChange={(e) => setSearch(e.target.value)}
            className="p-2 bg-white/10 text-white border border-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all text-sm" />

          {/* User list */}
          <div className="max-h-96 overflow-y-auto rounded-md border border-gray-700">
            {filteredUsers.length === 0 && (
              <p className="text-gray-500 text-sm p-3">No users found</p>
            )}
            {filteredUsers.map((user) => (
              <div key={user._id} onClick={() => handleToggleMember(user)}
                className={`flex items-center gap-3 p-2 cursor-pointer hover:bg-violet-600/20 transition-all ${selectedMembers.find((u) => u._id === user._id) ? "bg-violet-600/30" : ""}`}>
                <img src={user.profilePic || assets.avatar_icon} alt="" className="w-8 h-8 rounded-full object-cover" />
                <span className="text-sm">{user.fullName}</span>
              </div>
            ))}
          </div>

          {/* Selected member chips */}
          {selectedMembers.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {selectedMembers.map((user) => (
                <div key={user._id} className="flex items-center gap-2 bg-violet-600/40 px-3 py-1 rounded-full text-xs">
                  <img src={user.profilePic || assets.avatar_icon} alt="" className="w-5 h-5 rounded-full object-cover" />
                  <span className="max-w-[100px] truncate">{user.fullName}</span>
                  <button type="button" onClick={() => handleToggleMember(user)} className="text-gray-200 hover:text-white text-xs cursor-pointer">✖</button>
                </div>
              ))}
            </div>
          )}

          {errorMsg && <p className="text-red-400 text-sm">{errorMsg}</p>}

          <button className="bg-gradient-to-r from-purple-500 to-violet-700 text-white py-3 px-6 rounded-full text-lg font-semibold hover:opacity-90 transition-all duration-300 mt-2 sm:w-40 disabled:opacity-60"
            type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create"}
          </button>
        </form>
      </div>
    </div>
  );
};
