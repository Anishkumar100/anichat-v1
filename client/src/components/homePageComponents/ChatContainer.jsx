import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import assets from "../../assets/assets";
import { formatMessageTime } from "../../lib/utils";
import { BASE_URL, useAppContext } from "../../context/ContextProvider";

const REACT_EMOJIS = ["❤️","😂","😮","😢","😡","👍","🔥","🎉","💯","✨"];
const INPUT_EMOJIS = [
  "😀","😂","😍","😎","🥹","😭","😡","🤔","🥳","😴",
  "👍","👎","🙏","💪","🫶","❤️","🔥","✨","🎉","💯",
  "🌟","🚀","🎵","🍕","😺","🦋","🌸","⚡","💎","🎯",
];

// ─────────────────────────────────────────────────────────────────────────────
//  CosmosCanvas — natural, smooth cosmic particle field
//
//  Layers:
//    1. Large glowing orbs  (8)  — slow, bright, multi-pass radial glow
//    2. Medium particles   (20)  — moderate glow, varied hues
//    3. Dust pinpoints     (60)  — tiny, barely visible, very slow
//
//  Each particle has:
//    • Sinusoidal "wander" — vx/vy shift gently over time (no jitter)
//    • Breathing opacity   — sine-wave alpha at its own phase/speed
//    • Soft wrap around edges
//    • Canvas stays fully transparent — page background shows through
// ─────────────────────────────────────────────────────────────────────────────
const CosmosCanvas = () => {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let raf, W, H

    const resize = () => {
      W = canvas.width  = canvas.offsetWidth
      H = canvas.height = canvas.offsetHeight
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const rnd = (a, b) => a + Math.random() * (b - a)

    // Build particle pool
    const make = (tier) => ({
      x:      rnd(0, W || 600),
      y:      rnd(0, H || 400),
      // Base drift direction (very slow)
      angle:  rnd(0, Math.PI * 2),
      // Speed: orbs slower, dust faster (but all imperceptibly slow)
      spd:    tier === 0 ? rnd(0.03, 0.08) : tier === 1 ? rnd(0.06, 0.16) : rnd(0.10, 0.22),
      // Wander: the angle slowly oscillates, giving organic drift
      wanderSpd:   rnd(0.08, 0.22),
      wanderAmp:   rnd(0.2,  0.5),
      wanderPhase: rnd(0, Math.PI * 2),
      // Visual
      r:    tier === 0 ? rnd(3.5, 6.5) : tier === 1 ? rnd(1.5, 3.0) : rnd(0.3, 1.1),
      hue:  rnd(230, 310),          // purple → cyan spectrum
      base: tier === 0 ? rnd(0.25, 0.55) : tier === 1 ? rnd(0.12, 0.32) : rnd(0.05, 0.18),
      breathSpd:   rnd(0.18, 0.55),
      breathPhase: rnd(0, Math.PI * 2),
      tier,
    })

    const orbs   = Array.from({ length: 8  }, () => make(0))
    const mids   = Array.from({ length: 20 }, () => make(1))
    const dust   = Array.from({ length: 60 }, () => make(2))
    const all    = [...orbs, ...mids, ...dust]

    let t    = 0
    let last = performance.now()

    const animate = () => {
      const now = performance.now()
      const dt  = Math.min((now - last) / 1000, 0.05)
      last = now; t += dt

      // Transparent clear — never opaque
      ctx.clearRect(0, 0, W, H)

      all.forEach(p => {
        // Wander: slowly rotate the drift angle
        p.angle += Math.sin(t * p.wanderSpd + p.wanderPhase) * p.wanderAmp * dt

        p.x += Math.cos(p.angle) * p.spd
        p.y += Math.sin(p.angle) * p.spd

        // Soft edge wrap
        if (p.x < -20)  p.x = W + 20
        if (p.x > W+20) p.x = -20
        if (p.y < -20)  p.y = H + 20
        if (p.y > H+20) p.y = -20

        // Breathing alpha
        const alpha = p.base * (0.3 + 0.7 * Math.sin(t * p.breathSpd + p.breathPhase))
        if (alpha < 0.005) return

        if (p.tier === 0) {
          // Orb: three-pass glow for deep luminosity
          // Pass 1 — wide diffuse halo
          const g1 = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 7)
          g1.addColorStop(0,   `hsla(${p.hue},80%,80%,${alpha * 0.22})`)
          g1.addColorStop(0.5, `hsla(${p.hue},75%,72%,${alpha * 0.08})`)
          g1.addColorStop(1,   `hsla(${p.hue},65%,60%,0)`)
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 7, 0, Math.PI * 2)
          ctx.fillStyle = g1; ctx.fill()

          // Pass 2 — mid glow
          const g2 = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3)
          g2.addColorStop(0,   `hsla(${p.hue},88%,88%,${alpha * 0.5})`)
          g2.addColorStop(0.6, `hsla(${p.hue},80%,78%,${alpha * 0.18})`)
          g2.addColorStop(1,   `hsla(${p.hue},70%,65%,0)`)
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2)
          ctx.fillStyle = g2; ctx.fill()

          // Pass 3 — bright pinpoint core
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
          ctx.fillStyle = `hsla(${p.hue},95%,96%,${alpha})`
          ctx.fill()

        } else if (p.tier === 1) {
          // Medium: two-pass
          const gm = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4)
          gm.addColorStop(0,   `hsla(${p.hue},80%,85%,${alpha * 0.38})`)
          gm.addColorStop(0.5, `hsla(${p.hue},72%,75%,${alpha * 0.10})`)
          gm.addColorStop(1,   `hsla(${p.hue},60%,60%,0)`)
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2)
          ctx.fillStyle = gm; ctx.fill()

          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
          ctx.fillStyle = `hsla(${p.hue},88%,92%,${alpha})`
          ctx.fill()

        } else {
          // Dust: just a tiny dot
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
          ctx.fillStyle = `hsla(${p.hue},65%,85%,${alpha})`
          ctx.fill()
        }
      })

      raf = requestAnimationFrame(animate)
    }

    animate()
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [])

  return (
    <canvas ref={ref}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ background: 'transparent', zIndex: 1 }}
    />
  )
}
// ─────────────────────────────────────────────────────────────────────────────
export const ChatContainer = () => {
  const {
    authUser, token,
    selectedUser,  setSelectedUser,
    selectedGroup, setSelectedGroup,
    messages,      setMessages,
    groupMessages, setGroupMessages,
    isSunMode,
  } = useAppContext();

  const [inputText,     setInputText]     = useState("");
  const [imagePreview,  setImagePreview]  = useState(null);
  const [imageFile,     setImageFile]     = useState(null);
  const [sending,       setSending]       = useState(false);
  const [hoveredMsgId,  setHoveredMsgId]  = useState(null);
  const [reactPicker,   setReactPicker]   = useState(null);
  const [showInputEmoji,setShowInputEmoji]= useState(false);

  const scrollEnd = useRef();
  const inputRef  = useRef();

  useEffect(() => {
    scrollEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, groupMessages]);

  // Close portals on outside click
  useEffect(() => {
    const close = (e) => {
      if (!e.target.closest?.("[data-react-picker]")) setReactPicker(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => {
    const close = (e) => {
      if (!e.target.closest?.("[data-input-emoji]")) setShowInputEmoji(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => {
    if (!selectedUser || !token) return;
    setMessages([]);
    axios.get(`${BASE_URL}/api/messages/${selectedUser._id}`, { headers: { Authorization: token } })
      .then(({ data }) => { if (data.success) setMessages(data.messages); })
      .catch(console.error);
  }, [selectedUser, token]);

  useEffect(() => {
    if (!selectedGroup || !token) return;
    setGroupMessages([]);
    axios.get(`${BASE_URL}/api/groups/${selectedGroup._id}/messages`, { headers: { Authorization: token } })
      .then(({ data }) => { if (data.success) setGroupMessages(data.messages); })
      .catch(console.error);
  }, [selectedGroup, token]);

  const toBase64 = (file) => new Promise((res, rej) => {
    const r = new FileReader(); r.readAsDataURL(file);
    r.onload = () => res(r.result); r.onerror = rej;
  });

  const handleImageSelect = (e) => {
    const file = e.target.files[0]; if (!file) return;
    setImageFile(file);
    const r = new FileReader(); r.readAsDataURL(file);
    r.onload = () => setImagePreview(r.result);
  };

  const handleSendDM = async () => {
    if (!inputText.trim() && !imageFile) return;
    setSending(true);
    try {
      const img = imageFile ? await toBase64(imageFile) : null;
      const { data } = await axios.post(
        `${BASE_URL}/api/messages/send/${selectedUser._id}`,
        { text: inputText, image: img }, { headers: { Authorization: token } }
      );
      if (data.success) { setMessages(p => [...p, data.newMessage]); setInputText(""); setImageFile(null); setImagePreview(null); }
    } catch(e) { console.error(e); } finally { setSending(false); }
  };

  const handleSendGroup = async () => {
    if (!inputText.trim() && !imageFile) return;
    setSending(true);
    try {
      const img = imageFile ? await toBase64(imageFile) : null;
      const { data } = await axios.post(
        `${BASE_URL}/api/groups/${selectedGroup._id}/messages`,
        { text: inputText, image: img }, { headers: { Authorization: token } }
      );
      if (data.success) { setGroupMessages(p => [...p, data.newMessage]); setInputText(""); setImageFile(null); setImagePreview(null); }
    } catch(e) { console.error(e); } finally { setSending(false); }
  };

  const handleDeleteDM = async (msgId) => {
    const { data } = await axios.delete(`${BASE_URL}/api/messages/${msgId}`, { headers: { Authorization: token } });
    if (data.success) setMessages(p => p.map(m => m._id === msgId ? { ...m, deleted: true, text: "", image: "" } : m));
    setHoveredMsgId(null);
  };

  const handleDeleteGroup = async (msgId) => {
    const { data } = await axios.delete(`${BASE_URL}/api/groups/messages/${msgId}`, { headers: { Authorization: token } });
    if (data.success) setGroupMessages(p => p.map(m => m._id === msgId ? { ...m, deleted: true, text: "", image: "" } : m));
    setHoveredMsgId(null);
  };

  const handleReactDM = async (msgId, emoji) => {
    setReactPicker(null);
    const { data } = await axios.post(`${BASE_URL}/api/messages/${msgId}/react`, { emoji }, { headers: { Authorization: token } });
    if (data.success) setMessages(p => p.map(m => m._id === msgId ? { ...m, reactions: data.reactions } : m));
  };

  const handleReactGroup = async (msgId, emoji) => {
    setReactPicker(null);
    const { data } = await axios.post(`${BASE_URL}/api/groups/messages/${msgId}/react`, { emoji }, { headers: { Authorization: token } });
    if (data.success) setGroupMessages(p => p.map(m => m._id === msgId ? { ...m, reactions: data.reactions } : m));
  };

  const openReactPicker = (e, msgId, isMine, isGroup) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setReactPicker(prev => prev?.msgId === msgId ? null : { msgId, rect, isMine, isGroup });
  };

  const insertEmoji = (emoji) => {
    const el = inputRef.current;
    if (!el) { setInputText(p => p + emoji); return; }
    const start = el.selectionStart ?? inputText.length;
    const end   = el.selectionEnd   ?? inputText.length;
    setInputText(inputText.slice(0, start) + emoji + inputText.slice(end));
    setTimeout(() => { el.focus(); el.setSelectionRange(start + emoji.length, start + emoji.length); }, 0);
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (selectedUser) handleSendDM();
      else if (selectedGroup) handleSendGroup();
    }
  };

  // ── Reaction picker portal (escapes overflow/backdrop-filter) ──────
  const ReactPickerPortal = () => {
    if (!reactPicker) return null;
    const { msgId, rect, isMine, isGroup } = reactPicker;
    const panelW = Math.min(330, window.innerWidth - 16);
    let left = isMine ? rect.right - panelW : rect.left;
    left = Math.max(8, Math.min(left, window.innerWidth - panelW - 8));
    const top = Math.max(8, rect.top - 54);
    const onReact = isGroup ? e => handleReactGroup(msgId, e) : e => handleReactDM(msgId, e);
    return createPortal(
      <div data-react-picker style={{
        position:"fixed", top:`${top}px`, left:`${left}px`, width:`${panelW}px`, zIndex:99999,
        display:"flex", flexWrap:"nowrap", gap:"2px", padding:"6px 8px",
        background:"rgba(22,19,52,0.98)", border:"1px solid rgba(255,255,255,0.14)",
        borderRadius:"14px", backdropFilter:"blur(20px)",
        boxShadow:"0 8px 40px rgba(0,0,0,0.6)", animation:"popIn 0.18s ease-out both",
      }}>
        {REACT_EMOJIS.map(em => (
          <div key={em} onClick={() => onReact(em)}
            style={{ fontSize:"1.2rem", width:"32px", height:"32px", display:"flex",
              alignItems:"center", justifyContent:"center", borderRadius:"8px",
              cursor:"pointer", transition:"transform 0.15s ease", userSelect:"none" }}
            onMouseEnter={e => e.currentTarget.style.transform="scale(1.45)"}
            onMouseLeave={e => e.currentTarget.style.transform="scale(1)"}
          >{em}</div>
        ))}
      </div>,
      document.body
    );
  };

  // ── Input emoji portal ─────────────────────────────────────────────
  const InputEmojiPortal = () => {
    if (!showInputEmoji) return null;
    return createPortal(
      <div data-input-emoji style={{
        position:"fixed", bottom:"72px", left:"50%", transform:"translateX(-50%)",
        width:"min(340px, 96vw)", zIndex:99999, display:"flex", flexWrap:"wrap", gap:"4px",
        padding:"10px", background:"rgba(22,19,52,0.98)",
        border:"1px solid rgba(255,255,255,0.14)", borderRadius:"16px",
        backdropFilter:"blur(20px)", boxShadow:"0 -8px 40px rgba(0,0,0,0.55)",
        animation:"popIn 0.2s ease-out both",
      }}>
        {INPUT_EMOJIS.map(em => (
          <div key={em} onClick={() => insertEmoji(em)}
            style={{ fontSize:"1.35rem", width:"36px", height:"36px", display:"flex",
              alignItems:"center", justifyContent:"center", borderRadius:"8px",
              cursor:"pointer", userSelect:"none", transition:"transform 0.15s ease" }}
            onMouseEnter={e => e.currentTarget.style.transform="scale(1.35)"}
            onMouseLeave={e => e.currentTarget.style.transform="scale(1)"}
          >{em}</div>
        ))}
      </div>,
      document.body
    );
  };

  // ── Message bubble ─────────────────────────────────────────────────
  const renderBubble = (msg, index, isGroup) => {
    const senderId = typeof msg.senderId === "object" ? msg.senderId?._id : msg.senderId;
    const isMine   = senderId === authUser._id || senderId?.toString() === authUser._id?.toString();
    const senderPic = typeof msg.senderId === "object"
      ? msg.senderId?.profilePic
      : isMine ? authUser?.profilePic : selectedUser?.profilePic;
    const senderName = isGroup && !isMine && typeof msg.senderId === "object"
      ? msg.senderId?.fullName : null;
    const isHovered = hoveredMsgId === msg._id;
    const onDelete  = isGroup ? () => handleDeleteGroup(msg._id) : () => handleDeleteDM(msg._id);

    return (
      <div key={msg._id || index}
        className={`flex items-end gap-2 w-full ${isMine ? "flex-row-reverse" : "flex-row"}`}
        onMouseEnter={() => setHoveredMsgId(msg._id)}
        onMouseLeave={() => setHoveredMsgId(null)}
      >
        <img src={senderPic || assets.avatar_icon} alt=""
          className="w-7 h-7 rounded-full object-cover flex-shrink-0 self-end mb-1" />

        <div className={`flex flex-col gap-1 min-w-0 ${isMine ? "items-end" : "items-start"}`}
          style={{ maxWidth: "65%" }}>

          {senderName && <p className="text-xs text-violet-300 px-1 truncate">{senderName}</p>}

          {/* Action bar — uses opacity, NEVER absolute, so it doesn't clip/overlap */}
          {!msg.deleted && (
            <div className={`flex items-center gap-1 ${isMine ? "flex-row-reverse" : "flex-row"}`}
              style={{ opacity: isHovered ? 1 : 0, pointerEvents: isHovered ? "auto" : "none",
                transition: "opacity 0.15s ease", height: "26px" }}>
              <button className="msg-action-btn" title="React"
                onClick={e => openReactPicker(e, msg._id, isMine, isGroup)}>😊</button>
              {isMine && <button className="msg-action-btn delete" title="Delete" onClick={onDelete}>🗑️</button>}
            </div>
          )}

          {/* Bubble — image AND text both shown when present */}
          {msg.deleted ? (
            <div className="msg-deleted-bubble">
              <span>🚫</span><span>This message was deleted</span>
            </div>
          ) : (
            <div className={`px-3 py-2 rounded-2xl text-sm font-light text-white
              ${isSunMode ? "bg-gradient-to-br from-orange-500/25 to-red-500/20" : "bg-violet-500/30"} ${isMine ? "rounded-br-sm" : "rounded-bl-sm"}`}
              style={{ wordBreak:"break-word", overflowWrap:"break-word", maxWidth:"100%" }}>
              {msg.image && (
                <img src={msg.image} alt="shared" onClick={() => window.open(msg.image, "_blank")}
                  className="rounded-xl mb-1 cursor-zoom-in hover:opacity-90 transition-opacity block"
                  style={{ maxWidth:"200px" }} />
              )}
              {msg.text && <span>{msg.text}</span>}
            </div>
          )}

          {/* Reaction chips */}
          {msg.reactions && msg.reactions.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {msg.reactions.map(r => {
                const iMine = r.users.some(u => (u._id || u)?.toString() === authUser._id?.toString());
                const onReact = isGroup
                  ? () => handleReactGroup(msg._id, r.emoji)
                  : () => handleReactDM(msg._id, r.emoji);
                return (
                  <span key={r.emoji} className={`reaction-chip ${iMine ? (isSunMode ? "mine-sun" : "mine") : ""}`} onClick={onReact}>
                    {r.emoji}
                    <span style={{ color:"rgba(255,255,255,0.5)", fontSize:"0.65rem" }}>{r.users.length}</span>
                  </span>
                );
              })}
            </div>
          )}
          <p className="text-gray-500 text-xs px-1">{formatMessageTime(msg.createdAt)}</p>
        </div>
      </div>
    );
  };

  // ── Input bar — NOT absolute, sits at bottom of flex column ────────
  // This is the key fix for the "overlapping input" bug:
  // absolute positioning was causing the input to overlap messages.
  // Now it's a flex-shrink-0 element at the bottom of the flex column.
  const renderInputBar = (onSend, placeholder) => (
  <div className="flex-shrink-0 flex items-center gap-2 p-2 sm:p-3 border-t border-white/5">
    <div className="flex-1 flex flex-col items-start bg-gray-100/12 px-3 rounded-2xl min-w-0">
      {imagePreview && (
        <div className="relative pt-2 pl-1">
          <img src={imagePreview} alt="preview" className="h-14 sm:h-16 rounded-md" />
          <button onClick={() => { setImagePreview(null); setImageFile(null); }}
            className="absolute top-1 right-1 text-white bg-black/50 rounded-full w-5 h-5 flex items-center justify-center text-xs">✕</button>
        </div>
      )}
      <div className="flex w-full items-center gap-1">
        <button data-input-emoji onClick={() => setShowInputEmoji(p => !p)}
          className={`text-lg flex-shrink-0 transition-opacity px-1 ${isSunMode ? "opacity-80 hover:opacity-100" : "opacity-60 hover:opacity-100"}`}
          title="Emoji">🙂</button>
        <input ref={inputRef} type="text" value={inputText}
          onChange={e => setInputText(e.target.value)} onKeyDown={handleKey}
          placeholder={placeholder}
          className="flex-1 text-sm p-2 sm:p-3 border-none outline-none text-white placeholder-gray-400 bg-transparent min-w-0" />
        <input type="file" id="chat-image" accept="image/png,image/jpeg" hidden onChange={handleImageSelect} />
        <label htmlFor="chat-image" className="cursor-pointer flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity">
          <img src={assets.gallery_icon} alt="" className="w-5 mr-1"
            style={{ filter: isSunMode ? "brightness(0) saturate(100%) invert(55%) sepia(1) hue-rotate(330deg) saturate(3)" : "brightness(0) saturate(100%) invert(70%) sepia(1) hue-rotate(230deg) saturate(2)" }} />
        </label>
      </div>
    </div>

    {/* ── Only change: img → svg ── */}
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={`w-7 cursor-pointer flex-shrink-0 ${sending ? "opacity-50" : ""}`}
      style={{ filter: isSunMode ? "brightness(0) saturate(100%) invert(45%) sepia(1) hue-rotate(330deg) saturate(4)" : "brightness(0) saturate(100%) invert(60%) sepia(1) hue-rotate(230deg) saturate(3)" }}
      onClick={!sending ? onSend : undefined}
    >
      <path d="M3.478 2.405a.75.75 0 0 0-.926.94l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.405Z" />
    </svg>
  </div>
);

  // ── DM view ────────────────────────────────────────────────────────
  if (selectedUser) return (
    <>
      <ReactPickerPortal /><InputEmojiPortal />
      <div className="h-full flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 py-3 px-3 sm:px-4 border-b border-stone-500 flex-shrink-0">
          <img src={selectedUser?.profilePic || assets.avatar_icon} alt=""
            className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
          <p className="flex-1 text-base sm:text-lg text-white flex items-center gap-2 min-w-0">
            <span className="truncate">{selectedUser?.fullName}</span>
            <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
          </p>
          <img onClick={() => setSelectedUser(null)} src={assets.arrow_icon}
            className="md:hidden max-w-7 cursor-pointer flex-shrink-0" alt="" />
          <img src={assets.help_icon} alt="" className="max-md:hidden max-w-5 flex-shrink-0" />
        </div>
        {/* flex-1 + overflow-y-auto = proper scroll, never grows past container */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 flex flex-col gap-4 min-h-0">
          {messages.map((msg, i) => renderBubble(msg, i, false))}
          <div ref={scrollEnd} />
        </div>
        {renderInputBar(handleSendDM, "Send a message")}
      </div>
    </>
  );

  // ── Group view ─────────────────────────────────────────────────────
  if (selectedGroup) return (
    <>
      <ReactPickerPortal /><InputEmojiPortal />
      <div className="h-full flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 py-3 px-3 sm:px-4 border-b border-stone-500 flex-shrink-0">
          <img src={selectedGroup?.groupPic || assets.avatar_icon} alt=""
            className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
          <p className="flex-1 text-base sm:text-lg text-white flex items-center gap-2 min-w-0">
            <span className="truncate">{selectedGroup?.name}</span>
            <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
          </p>
          <img onClick={() => setSelectedGroup(null)} src={assets.arrow_icon}
            className="md:hidden max-w-7 cursor-pointer flex-shrink-0" alt="" />
          <img src={assets.help_icon} alt="" className="max-md:hidden max-w-5 flex-shrink-0" />
        </div>
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 flex flex-col gap-4 min-h-0">
          {groupMessages.map((msg, i) => renderBubble(msg, i, true))}
          <div ref={scrollEnd} />
        </div>
        {renderInputBar(handleSendGroup, "Message the group")}
      </div>
    </>
  );

  // ── Empty state — ConstellationCanvas + butterflies ────────────────
  return (
    <div className="relative flex flex-col items-center justify-center h-full bg-white/5 backdrop-blur-xl max-md:hidden px-4 overflow-hidden">

      {/* Canvas sits behind everything, fully transparent */}
      <CosmosCanvas />

      {/* Existing decorative elements on top of canvas */}
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-white/10 via-sky-200/10 to-transparent blur-3xl pointer-events-none z-0" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={`ring-${i}`} className="absolute border border-white/10 rounded-full animate-soft-pulse blur-[2px]"
          style={{ width:`${60+i*30}px`, height:`${60+i*30}px`, top:`${40+i*10}%`, left:`${40+i*5}%`,
            animationDuration:`${6+i*2}s`, zIndex:2 }} />
      ))}

      {/* Butterflies (z-index 2 — above canvas) */}
      {Array.from({ length: 12 }).map((_, i) => {
        const paths  = ["animate-drift-1","animate-drift-2","animate-drift-3"];
        const colors = ["butterfly-blue","butterfly-indigo","butterfly-cyan","butterfly-pink","butterfly-purple"];
        const scale  = (0.35 + Math.random() * 0.55).toFixed(2);
        return (
          <svg key={`d-${i}`} className={`absolute ${colors[i%5]} ${paths[i%3]}`}
            fill="currentColor" viewBox="0 0 20 20" style={{ zIndex:2,
              width:`${scale*1.3}rem`, height:`${scale*1.3}rem`, top:`${Math.random()*90}%`, left:`-60px`,
              opacity: 0.3+Math.random()*0.5, animationDuration:`${14+Math.random()*12}s`, animationDelay:`-${Math.random()*20}s` }}>
            <path d="M10 1C7 2 6 6 4 6S1 4 1 4s1 3 3 4c-2 1-3 4-3 4s2-2 4-2c2 0 3 4 5 5 2-1 3-5 5-5 2 0 4 2 4 2s-1-3-3-4c2-1 3-4 3-4s-2 2-4 2-3-4-6-5z" />
          </svg>
        );
      })}
      {Array.from({ length: 10 }).map((_, i) => {
        const colors = ["butterfly-blue","butterfly-indigo","butterfly-cyan","butterfly-pink","butterfly-purple"];
        const scale  = (0.3 + Math.random() * 0.6).toFixed(2);
        return (
          <svg key={`b-${i}`} className={`absolute ${colors[i%5]}`} fill="currentColor" viewBox="0 0 20 20"
            style={{ zIndex:2, width:`${scale*1.3}rem`, height:`${scale*1.3}rem`,
              top:`${10+Math.random()*80}%`, left:`${5+Math.random()*85}%`, opacity: 0.15+Math.random()*0.4,
              animation:`gentleBob ${6+Math.random()*6}s ease-in-out infinite, wingFlap ${0.8+Math.random()*0.7}s ease-in-out infinite`,
              animationDelay:`${Math.random()*6}s,${Math.random()*2}s` }}>
            <path d="M10 1C7 2 6 6 4 6S1 4 1 4s1 3 3 4c-2 1-3 4-3 4s2-2 4-2c2 0 3 4 5 5 2-1 3-5 5-5 2 0 4 2 4 2s-1-3-3-4c2-1 3-4 3-4s-2 2-4 2-3-4-6-5z" />
          </svg>
        );
      })}

      <div className="z-10 text-center mt-4 px-6 relative">
        <h2 className="text-xl font-semibold text-white tracking-tight">This space feels calm...</h2>
        <p className="text-sm text-gray-300 mt-2 max-w-sm mx-auto leading-relaxed">
          Start a conversation to bring life to this moment. Until then, enjoy the breeze.
        </p>
      </div>
    </div>
  );
};
