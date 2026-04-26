import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { HomePage, ProfilePage, LoginPage, CreateNewGroup } from "../pages/indexPages";
import { useAppContext } from "../context/ContextProvider";
import assets from "../assets/assets";

export const AllRoutes = () => {
  const { authUser, setBg: setCtxBg } = useAppContext();

  const [bg, setBg] = useState(() => {
    return JSON.parse(localStorage.getItem("bg")) || assets.bgImage;
  });

  // Sync into context on every change
  useEffect(() => { setCtxBg(bg); }, [bg]);

  return (
    // No data-theme attribute — all theming is done via isSunMode from context
    <div className="bg-contain" style={{ backgroundImage: `url(${bg})` }}>
      <Routes>
        <Route path="/"          element={authUser ? <HomePage setBg={setBg} bg={bg} /> : <Navigate to="/login" replace />} />
        <Route path="/login"     element={!authUser ? <LoginPage /> : <Navigate to="/" replace />} />
        <Route path="/profile"   element={authUser ? <ProfilePage /> : <Navigate to="/login" replace />} />
        <Route path="/new-group" element={authUser ? <CreateNewGroup /> : <Navigate to="/login" replace />} />
      </Routes>
    </div>
  );
};
