import React, { useMemo, useState } from "react";
import axios from "axios";
import assets from "../../assets/assets";
import { BASE_URL, useAppContext } from "../../context/ContextProvider";

export const RightSidebar = () => {
  const {
    authUser, token,
    selectedUser, selectedGroup, setSelectedGroup, setGroups,
    users,
    messages, groupMessages,
    onlineUsers,
    logout,
    isSunMode,
  } = useAppContext();

  const [adminOpen,  setAdminOpen]  = useState(false);
  const [editName,   setEditName]   = useState("");
  const [editBio,    setEditBio]    = useState("");
  const [editImg,    setEditImg]    = useState(null);
  const [editPrev,   setEditPrev]   = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [adminMsg,   setAdminMsg]   = useState("");
  const [toast,      setToast]      = useState("");
  const [addSearch,  setAddSearch]  = useState("");
  const [addLoading, setAddLoading] = useState(false);

  // ── Centralised accent helpers — dark=purple  sun=orange/red ─────────────
  const btnGrad        = isSunMode ? "from-orange-500 to-red-600"    : "from-purple-400 to-violet-600";
  const adminBadgeCls  = isSunMode
    ? "bg-orange-600/30 border-orange-400/30 text-orange-200"
    : "bg-violet-600/40 border-violet-400/30 text-violet-200";
  const panelBorder    = isSunMode ? "border-orange-400/20 bg-orange-500/5" : "border-violet-400/20 bg-violet-500/5";
  const panelText      = isSunMode ? "text-orange-200" : "text-violet-200";
  const promoteCls     = isSunMode ? "admin-btn-promote-sun" : "admin-btn-promote";

  const sharedMedia = useMemo(() => {
    const list = selectedUser ? messages : groupMessages;
    return list.filter(m => m.image && !m.deleted).map(m => m.image).slice(-6);
  }, [messages, groupMessages, selectedUser, selectedGroup]);

  if (!selectedUser && !selectedGroup) return null;

  const isOnline = selectedUser ? onlineUsers.includes(selectedUser._id) : false;
  const isAdmin  = selectedGroup
    ? (selectedGroup.admin?._id?.toString() === authUser._id?.toString() ||
       selectedGroup.admin?.toString()       === authUser._id?.toString())
    : false;

  const nonMembers = (users || []).filter(u => {
    const inGroup = selectedGroup?.members?.some(m => (m._id || m)?.toString() === u._id?.toString());
    return !inGroup && u.fullName.toLowerCase().includes(addSearch.toLowerCase());
  });

  const showToast = (msg, isError = false) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(""), 3000);
  };

  const handleSaveGroup = async () => {
    setSaving(true); setAdminMsg("");
    try {
      let pic = null;
      if (editImg) {
        pic = await new Promise((res, rej) => {
          const r = new FileReader(); r.readAsDataURL(editImg);
          r.onload = () => res(r.result); r.onerror = rej;
        });
      }
      const { data } = await axios.patch(
        `${BASE_URL}/api/groups/${selectedGroup._id}`,
        { name: editName || undefined, bio: editBio, groupPic: pic },
        { headers: { Authorization: token } }
      );
      if (data.success) {
        setSelectedGroup(data.group);
        setGroups(p => p.map(g => g._id === data.group._id ? data.group : g));
        setAdminMsg("✓ Saved");
      } else setAdminMsg(data.message);
    } catch { setAdminMsg("Error saving"); } finally { setSaving(false); }
  };

  const handleAddMember = async (userId) => {
    setAddLoading(true);
    const { data } = await axios.post(
      `${BASE_URL}/api/groups/${selectedGroup._id}/members`,
      { userIds: [userId] },
      { headers: { Authorization: token } }
    );
    if (data.success) {
      setSelectedGroup(data.group);
      setGroups(p => p.map(g => g._id === data.group._id ? data.group : g));
      showToast("✓ Member added");
    } else showToast(data.message, true);
    setAddLoading(false);
  };

  const handleKick = async (memberId) => {
    if (!window.confirm("Remove this member?")) return;
    const { data } = await axios.delete(
      `${BASE_URL}/api/groups/${selectedGroup._id}/members/${memberId}`,
      { headers: { Authorization: token } }
    );
    if (data.success) {
      setSelectedGroup(data.group);
      setGroups(p => p.map(g => g._id === data.group._id ? data.group : g));
    }
  };

  const handlePromote = async (memberId) => {
    if (!window.confirm("Make this person admin? You will lose your admin rights.")) return;
    try {
      const { data } = await axios.patch(
        `${BASE_URL}/api/groups/${selectedGroup._id}/promote/${memberId}`,
        {},
        { headers: { Authorization: token } }
      );
      if (data.success) {
        showToast("✓ Admin transferred!");
        setSelectedGroup(data.group);
        setGroups(p => p.map(g => g._id === data.group._id ? data.group : g));
        setAdminOpen(false);
      } else showToast(data.message || "Failed", true);
    } catch (e) {
      showToast("Network error", true);
      console.error("promote error:", e);
    }
  };

  const handleLeave = async () => {
    if (!window.confirm("Leave this group?")) return;
    await axios.delete(`${BASE_URL}/api/groups/${selectedGroup._id}/leave`, { headers: { Authorization: token } });
    setSelectedGroup(null);
    setGroups(p => p.filter(g => g._id !== selectedGroup._id));
  };

  return (
    <div className="bg-[#8185B2]/10 text-white w-full h-full overflow-y-scroll relative flex flex-col">

      {/* ── Avatar + info ───────────────────────────────────────────── */}
      <div className="pt-16 flex flex-col items-center gap-2 text-xs font-light mx-auto">
        <img
          src={selectedUser ? (selectedUser?.profilePic || assets.avatar_icon) : (selectedGroup?.groupPic || assets.avatar_icon)}
          alt="" className="w-20 aspect-[1/1] rounded-full object-cover"
        />
        <h1 className="px-10 text-xl font-medium mx-auto flex items-center gap-2">
          {selectedUser && (
            <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-green-500" : "bg-gray-500"}`} />
          )}
          {selectedUser ? selectedUser.fullName : selectedGroup.name}
        </h1>
        {selectedUser  && <p className="px-10 mx-auto text-center">{selectedUser.bio}</p>}
        {selectedGroup && (
          <div className="flex flex-col items-center gap-1">
            <p className="px-10 mx-auto text-gray-300 text-xs">{selectedGroup.members.length} members</p>
            {isAdmin && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${adminBadgeCls}`}>⚙ Admin</span>
            )}
          </div>
        )}
      </div>

      <hr className="border-[#ffffff50] my-4" />

      {/* ── Shared media ────────────────────────────────────────────── */}
      <div className="px-5 text-xs">
        <p>Media</p>
        {sharedMedia.length === 0 ? (
          <p className="text-gray-500 mt-2">No shared images yet</p>
        ) : (
          <div className="mt-2 grid grid-cols-3 gap-1">
            {sharedMedia.map((url, i) => (
              <div key={i} onClick={() => window.open(url, "_blank")} className="cursor-pointer rounded aspect-square overflow-hidden">
                <img src={url} alt="" className="w-full h-full object-cover hover:opacity-80 transition-opacity" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Toast ───────────────────────────────────────────────────── */}
      {toast && (
        <div className={`mx-4 mt-4 px-3 py-2 rounded-lg text-xs text-center font-medium ${
          toast.isError
            ? "bg-red-500/20 border border-red-400/30 text-red-300"
            : "bg-emerald-500/20 border border-emerald-400/30 text-emerald-300"
        }`}>
          {toast.msg}
        </div>
      )}

      {/* ── Group admin panel ────────────────────────────────────────── */}
      {selectedGroup && (
        <div className="px-5 mt-5 text-xs flex flex-col gap-3">

          {isAdmin && (
            <div className={`rounded-xl border overflow-hidden ${panelBorder}`}>
              {/* Accordion header */}
              <button
                onClick={() => {
                  setAdminOpen(p => !p);
                  setEditName(selectedGroup.name);
                  setEditBio(selectedGroup.bio || "");
                  setEditImg(null); setEditPrev(null);
                  setAdminMsg(""); setAddSearch("");
                }}
                className={`w-full flex justify-between items-center px-4 py-3 hover:text-white transition-colors text-xs font-medium ${panelText}`}
              >
                <span>⚙ Admin Controls</span>
                <span className="text-white/30">{adminOpen ? "▲" : "▼"}</span>
              </button>

              {adminOpen && (
                <div className="px-3 pb-4 flex flex-col gap-3">

                  {/* Group photo */}
                  <label htmlFor="gp-edit" className="flex items-center gap-2 cursor-pointer hover:opacity-80">
                    <input type="file" id="gp-edit" accept="image/*" hidden
                      onChange={e => {
                        setEditImg(e.target.files[0]);
                        const r = new FileReader(); r.readAsDataURL(e.target.files[0]);
                        r.onload = () => setEditPrev(r.result);
                      }} />
                    <img src={editPrev || selectedGroup.groupPic || assets.avatar_icon} alt=""
                      className="w-10 h-10 rounded-full object-cover border border-white/10" />
                    <span className="text-white/50">Change photo</span>
                  </label>

                  <input value={editName} onChange={e => setEditName(e.target.value)}
                    placeholder="Group name"
                    className="bg-white/8 border border-white/10 rounded-lg px-3 py-2 text-white text-xs outline-none w-full" />
                  <textarea value={editBio} onChange={e => setEditBio(e.target.value)}
                    placeholder="Group description" rows={2}
                    className="bg-white/8 border border-white/10 rounded-lg px-3 py-2 text-white text-xs outline-none resize-none w-full" />

                  <button onClick={handleSaveGroup} disabled={saving}
                    className={`text-white rounded-lg py-2 text-xs font-medium disabled:opacity-50 w-full bg-gradient-to-r ${btnGrad}`}>
                    {saving ? "Saving…" : "Save Changes"}
                  </button>

                  {adminMsg && <p className="text-center text-emerald-400">{adminMsg}</p>}

                  <hr className="border-white/10" />

                  {/* Add members */}
                  <p className="text-white/40 uppercase tracking-wider text-[9px]">Add Members</p>
                  <input value={addSearch} onChange={e => setAddSearch(e.target.value)}
                    placeholder="Search users to add…"
                    className="bg-white/8 border border-white/10 rounded-lg px-3 py-2 text-white text-xs outline-none w-full" />
                  <div className="max-h-32 overflow-y-auto flex flex-col gap-1">
                    {nonMembers.length === 0
                      ? <p className="text-xs text-white/30 text-center py-2">No users to add</p>
                      : nonMembers.slice(0, 8).map(u => (
                          <div key={u._id} className="flex items-center gap-2 px-1 py-1">
                            <img src={u.profilePic || assets.avatar_icon} alt=""
                              className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                            <span className="flex-1 text-xs text-white/80 truncate">{u.fullName}</span>
                            <button onClick={() => handleAddMember(u._id)} disabled={addLoading}
                              className={`text-[10px] px-2 py-1 rounded-md text-white border disabled:opacity-50 flex-shrink-0 bg-gradient-to-r ${btnGrad} border-transparent`}>
                              + Add
                            </button>
                          </div>
                        ))
                    }
                  </div>

                  <hr className="border-white/10" />

                  {/* Members list */}
                  <p className="text-white/40 uppercase tracking-wider text-[9px]">Members</p>
                  <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                    {selectedGroup.members?.map(member => {
                      const mId     = (member._id || member)?.toString();
                      const mName   = member.fullName || "Member";
                      const mPic    = member.profilePic || assets.avatar_icon;
                      const isSelf  = mId === authUser._id?.toString();
                      const isGAdmin= (selectedGroup.admin?._id || selectedGroup.admin)?.toString() === mId;
                      return (
                        <div key={mId} className="admin-member-item">
                          <img src={mPic} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                          <span className="member-name">{mName}</span>
                          {isGAdmin && (
                            <span className={`text-[9px] border px-1.5 py-0.5 rounded-full flex-shrink-0 ${adminBadgeCls}`}>admin</span>
                          )}
                          {!isSelf && !isGAdmin && (
                            <div className="member-actions">
                              <button onClick={() => handleKick(mId)} className="admin-btn admin-btn-kick">Kick</button>
                              <button onClick={() => handlePromote(mId)} className={`admin-btn ${promoteCls}`}>↑ Admin</button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <button onClick={handleLeave}
            className="w-full border border-red-400/20 text-red-400 rounded-xl py-2 text-xs hover:bg-red-500/10 transition-colors cursor-pointer">
            🚪 Leave Group
          </button>
        </div>
      )}

      {/* ── Logout ──────────────────────────────────────────────────── */}
      <button onClick={logout}
        className={`absolute bottom-5 left-1/2 -translate-x-1/2 text-white border-none text-sm font-light py-2 px-20 rounded-full cursor-pointer bg-gradient-to-r ${btnGrad}`}>
        Logout
      </button>
    </div>
  );
};
