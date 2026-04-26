/**
 * pages/ProfilePage.jsx  —  Edit Profile Page
 *
 *  Connected to backend:
 *    PUT /api/auth/update-profile
 *
 *  Image upload flow:
 *    User picks a file → FileReader converts to base64 data URI →
 *    Sent in request body → Server uploads to Cloudinary → stores URL
 *
 *  UI is unchanged from original. Only the submit handler is wired up.
 */

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import assets from "../assets/assets";
import { BASE_URL, useAppContext } from "../context/ContextProvider";

export const ProfilePage = () => {
  const navigate = useNavigate();
  const { authUser, setAuthUser, token } = useAppContext();

  const [selectedImage, setSelectedImage] = useState(null); // File object (for preview)
  const [name, setName] = useState(authUser?.fullName || "");
  const [bio, setBio] = useState(authUser?.bio || "");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // ─── Submit Handler ──────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);

    try {
      let profilePicBase64 = null;

      if (selectedImage) {
        /*
         *  Convert the selected File to a base64 data URI.
         *  FileReader is a browser API that reads file contents.
         *  We wrap it in a Promise so we can await it cleanly.
         */
        profilePicBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(selectedImage);       // reads as base64 data URI
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
        });
      }

      const { data } = await axios.put(
        `${BASE_URL}/api/auth/update-profile`,
        {
          fullName: name,
          bio,
          profilePic: profilePicBase64, // null if no image change → server skips upload
        },
        { headers: { Authorization: token } }
      );

      if (data.success) {
        setAuthUser(data.user); // update global state with fresh user data
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

  // ─── Star animation (original, unchanged) ────────────────────────────────
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

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="relative w-screen h-screen backdrop-blur-2xl overflow-hidden bg-transparent flex items-center justify-center animate-fade-in">

      {/* Flickering Stars */}
      <div className="stars-layer">
        {stars.map((star) => (
          <div
            key={star.id}
            className="star-flicker"
            style={{
              position: "absolute",
              top: `${star.top}%`,
              left: `${star.left}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              animationDuration: `${star.duration}s`,
              animationDelay: `${star.delay}s`,
            }}
          />
        ))}
      </div>

      {/* Main Card */}
      <div className="relative z-10 w-full h-full max-w-none backdrop-blur-2xl border border-gray-600 shadow-2xl text-gray-300 flex flex-col lg:flex-row rounded-none overflow-hidden">

        {/* Logo */}
        <img
          className="w-full lg:max-w-sm object-contain p-6 animate-fade-in-slow"
          src={assets.logo}
          alt="AniChat Logo"
        />

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="flex flex-col justify-center gap-6 p-6 sm:p-10 flex-1 animate-fade-in will-change-transform"
        >
          <h3 className="text-3xl font-semibold text-white">Edit Your Profile</h3>

          {/* Avatar picker */}
          <label htmlFor="avatar" className="flex items-center gap-4 cursor-pointer hover:opacity-80 transition-all">
            <input
              onChange={(e) => setSelectedImage(e.target.files[0])}
              type="file"
              id="avatar"
              accept=".png, .jpg, .jpeg"
              hidden
            />
            <img
              src={
                selectedImage
                  ? URL.createObjectURL(selectedImage)
                  : authUser?.profilePic || assets.avatar_icon
              }
              alt="Profile Avatar"
              className={`w-16 h-16 object-cover ${selectedImage || authUser?.profilePic ? "rounded-full" : ""}`}
            />
            <span className="text-white text-sm">Upload Profile Picture</span>
          </label>

          {/* Name */}
          <input
            onChange={(e) => setName(e.target.value)}
            type="text"
            required
            placeholder="Your Name"
            value={name}
            className="p-3 bg-white/10 text-white border border-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all"
          />

          {/* Bio */}
          <textarea
            className="p-3 bg-white/10 text-white border border-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all"
            placeholder="Tell the world about yourself"
            rows={4}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            required
          />

          {errorMsg && <p className="text-red-400 text-sm">{errorMsg}</p>}

          <button
            className="bg-gradient-to-r from-purple-500 to-violet-700 text-white py-3 px-6 rounded-full text-lg font-semibold hover:opacity-90 transition-all duration-300 sm:w-40 disabled:opacity-60"
            type="submit"
            disabled={loading}
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </form>
      </div>
    </div>
  );
};
