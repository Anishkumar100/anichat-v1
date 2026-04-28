import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import assets from "../../assets/assets";
import { formatMessageTime } from "../../lib/utils";
import { BASE_URL, useAppContext } from "../../context/ContextProvider";

const REACT_EMOJIS  = ["❤️","😂","😮","😢","😡","👍","🔥","🎉","💯","✨"];
const INPUT_EMOJIS  = [
  "😀","😂","😍","😎","🥹","😭","😡","🤔","🥳","😴",
  "👍","👎","🙏","💪","🫶","❤️","🔥","✨","🎉","💯",
  "🌟","🚀","🎵","🍕","😺","🦋","🌸","⚡","💎","🎯",
];
const STICKER_EMOJIS = [
  "🐶","🐱","🐸","🐼","🦊","🐨","🐯","🦁","🐮","🐷",
  "🌈","⭐","🌸","🔥","💫","🎉","🎊","💖","🥳","😎",
  "👑","🎵","🍕","🍦","🌺","🦋","🌙","✨","🎭","🚀",
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
    onlineUsers,
    isSunMode,
  } = useAppContext();

  const [inputText,      setInputText]      = useState("");
  const [imagePreview,   setImagePreview]   = useState(null);
  const [imageFile,      setImageFile]      = useState(null);
  const [sending,        setSending]        = useState(false);
  const [hoveredMsgId,   setHoveredMsgId]   = useState(null);
  const [reactPicker,    setReactPicker]    = useState(null);
  // mediaPanel: null | "emoji" | "gif" | "sticker"
  const [mediaPanel,     setMediaPanel]     = useState(null);
  const [gifSearch,      setGifSearch]      = useState("");
  const [gifResults,     setGifResults]     = useState([]);
  const [gifLoading,     setGifLoading]     = useState(false);
  const [copyToast,      setCopyToast]      = useState(false);

  const scrollEnd    = useRef();
  const inputRef     = useRef();
  const gifSearchRef = useRef();

  useEffect(() => { scrollEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, groupMessages]);

  // Close pickers on outside click
  useEffect(() => {
    const close = (e) => {
      if (!e.target.closest?.("[data-react-picker]")) setReactPicker(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => {
    const close = (e) => {
      if (!e.target.closest?.("[data-media-panel]") && !e.target.closest?.("[data-media-toggle]"))
        setMediaPanel(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  // Load messages
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

  const handleFileSelect = (e) => {
    const file = e.target.files[0]; if (!file) return;
    setImageFile(file);
    const r = new FileReader(); r.readAsDataURL(file);
    r.onload = () => setImagePreview(r.result);
    e.target.value = "";
  };

  // ── Send helpers ──────────────────────────────────────────────────
  const sendDM = async (textOverride, imageOverride) => {
    const text = textOverride ?? inputText;
    const file = imageOverride ?? imageFile;
    if (!text.trim() && !file) return;
    setSending(true);
    try {
      const img = (typeof file === "string") ? file : (file ? await toBase64(file) : null);
      const { data } = await axios.post(
        `${BASE_URL}/api/messages/send/${selectedUser._id}`,
        { text, image: img }, { headers: { Authorization: token } }
      );
      if (data.success) {
        setMessages(p => [...p, data.newMessage]);
        setInputText(""); setImageFile(null); setImagePreview(null);
      }
    } catch(e) { console.error(e); } finally { setSending(false); }
  };

  const sendGroup = async (textOverride, imageOverride) => {
    const text = textOverride ?? inputText;
    const file = imageOverride ?? imageFile;
    if (!text.trim() && !file) return;
    setSending(true);
    try {
      const img = (typeof file === "string") ? file : (file ? await toBase64(file) : null);
      const { data } = await axios.post(
        `${BASE_URL}/api/groups/${selectedGroup._id}/messages`,
        { text, image: img }, { headers: { Authorization: token } }
      );
      if (data.success) {
        setGroupMessages(p => [...p, data.newMessage]);
        setInputText(""); setImageFile(null); setImagePreview(null);
      }
    } catch(e) { console.error(e); } finally { setSending(false); }
  };

  const doSend    = () => selectedUser ? sendDM()    : sendGroup();
  const sendMedia = (url) => {
    setMediaPanel(null);
    if (selectedUser)  sendDM(inputText, url);
    else               sendGroup(inputText, url);
  };

  // ── Delete handlers ───────────────────────────────────────────────
  const handleSoftDeleteDM = async (msgId) => {
    const { data } = await axios.delete(`${BASE_URL}/api/messages/${msgId}`, { headers: { Authorization: token } });
    if (data.success) setMessages(p => p.map(m => m._id === msgId ? { ...m, deleted: true, text: "", image: "" } : m));
    setHoveredMsgId(null);
  };
  const handleHardDeleteDM = async (msgId) => {
    const { data } = await axios.delete(`${BASE_URL}/api/messages/${msgId}/hard`, { headers: { Authorization: token } });
    if (data.success) setMessages(p => p.filter(m => m._id !== msgId));
    setHoveredMsgId(null);
  };
  const handleSoftDeleteGroup = async (msgId) => {
    const { data } = await axios.delete(`${BASE_URL}/api/groups/messages/${msgId}`, { headers: { Authorization: token } });
    if (data.success) setGroupMessages(p => p.map(m => m._id === msgId ? { ...m, deleted: true, text: "", image: "" } : m));
    setHoveredMsgId(null);
  };
  const handleHardDeleteGroup = async (msgId) => {
    const { data } = await axios.delete(`${BASE_URL}/api/groups/messages/${msgId}/hard`, { headers: { Authorization: token } });
    if (data.success) setGroupMessages(p => p.filter(m => m._id !== msgId));
    setHoveredMsgId(null);
  };

  // ── Reactions ─────────────────────────────────────────────────────
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

  // ── Copy to clipboard ─────────────────────────────────────────────
  const handleCopy = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 2000);
    });
    setHoveredMsgId(null);
  };

  // ── GIF search via Tenor ──────────────────────────────────────────
  const searchGifs = async (query) => {
    const apiKey = import.meta.env.VITE_TENOR_API_KEY;
    if (!apiKey) {
      // Fallback: show placeholder message
      setGifResults([{ url: null, preview: null, placeholder: true }]);
      return;
    }
    setGifLoading(true);
    try {
      const q = query || "trending";
      const res = await fetch(
        `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(q)}&key=${apiKey}&limit=20&media_filter=gif`
      );
      const json = await res.json();
      const results = (json.results || []).map(r => ({
        url:     r.media_formats?.gif?.url     || r.url,
        preview: r.media_formats?.tinygif?.url || r.media_formats?.gif?.url,
        id:      r.id,
      }));
      setGifResults(results);
    } catch { setGifResults([]); }
    finally { setGifLoading(false); }
  };

  useEffect(() => {
    if (mediaPanel === "gif") searchGifs(gifSearch);
  }, [mediaPanel]);

  // ── Insert emoji at cursor ────────────────────────────────────────
  const insertEmoji = (emoji) => {
    const el = inputRef.current;
    if (!el) { setInputText(p => p + emoji); return; }
    const start = el.selectionStart ?? inputText.length;
    const end   = el.selectionEnd   ?? inputText.length;
    setInputText(inputText.slice(0, start) + emoji + inputText.slice(end));
    setTimeout(() => { el.focus(); el.setSelectionRange(start + emoji.length, start + emoji.length); }, 0);
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doSend(); }
  };

  // ── Icon CSS filter (theme-aware) ─────────────────────────────────
  const iconFilter = isSunMode
    ? "brightness(0) saturate(100%) invert(45%) sepia(1) hue-rotate(330deg) saturate(4)"
    : "brightness(0) saturate(100%) invert(60%) sepia(1) hue-rotate(230deg) saturate(3)";

  // ── Portals ───────────────────────────────────────────────────────
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

  // ── Media panel (emoji / gif / sticker) ───────────────────────────
  const MediaPanelPortal = () => {
    if (!mediaPanel) return null;

    const btnGrad = isSunMode ? "from-orange-500 to-red-600" : "from-purple-500 to-violet-600";
    const tabActive = isSunMode
      ? "bg-orange-500/30 text-orange-200 border-orange-400/40"
      : "bg-violet-500/30 text-violet-200 border-violet-400/40";

    return createPortal(
      <div data-media-panel style={{
        position:"fixed", bottom:"72px", left:"50%", transform:"translateX(-50%)",
        width:"min(380px, 96vw)", maxHeight:"300px", zIndex:99999,
        display:"flex", flexDirection:"column",
        background:"rgba(18,15,40,0.98)", border:"1px solid rgba(255,255,255,0.12)",
        borderRadius:"18px", backdropFilter:"blur(20px)",
        boxShadow:"0 -8px 40px rgba(0,0,0,0.6)", animation:"popIn 0.2s ease-out both",
        overflow:"hidden",
      }}>
        {/* Tab bar */}
        <div style={{ display:"flex", gap:"4px", padding:"8px 8px 0", flexShrink:0 }}>
          {["emoji","gif","sticker"].map(tab => (
            <button key={tab} onClick={() => {
              setMediaPanel(tab);
              if (tab === "gif") searchGifs(gifSearch);
            }}
              style={{
                flex:1, padding:"5px 8px", borderRadius:"10px", border:"1px solid transparent",
                background: mediaPanel === tab ? undefined : "transparent",
                color: mediaPanel === tab ? undefined : "rgba(255,255,255,0.5)",
                cursor:"pointer", fontSize:"0.75rem", fontWeight:600,
                fontFamily:"inherit", transition:"all 0.15s ease",
              }}
              className={mediaPanel === tab ? `bg-gradient-to-r ${btnGrad} text-white` : ""}
            >
              {tab === "emoji" ? "😀 Emoji" : tab === "gif" ? "🎬 GIF" : "🎭 Sticker"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex:1, overflowY:"auto", padding:"8px" }}>

          {/* Emoji grid */}
          {mediaPanel === "emoji" && (
            <div style={{ display:"flex", flexWrap:"wrap", gap:"2px" }}>
              {INPUT_EMOJIS.map(em => (
                <div key={em} onClick={() => { insertEmoji(em); }}
                  style={{ fontSize:"1.4rem", width:"38px", height:"38px", display:"flex",
                    alignItems:"center", justifyContent:"center", borderRadius:"8px",
                    cursor:"pointer", transition:"transform 0.12s ease", userSelect:"none" }}
                  onMouseEnter={e => { e.currentTarget.style.transform="scale(1.35)"; e.currentTarget.style.background="rgba(255,255,255,0.08)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform="scale(1)"; e.currentTarget.style.background="transparent"; }}
                >{em}</div>
              ))}
            </div>
          )}

          {/* GIF search */}
          {mediaPanel === "gif" && (
            <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
              <div style={{ display:"flex", gap:"6px" }}>
                <input
                  ref={gifSearchRef}
                  value={gifSearch}
                  onChange={e => setGifSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") searchGifs(gifSearch); }}
                  placeholder="Search GIFs (requires VITE_TENOR_API_KEY)…"
                  style={{
                    flex:1, padding:"6px 10px", background:"rgba(255,255,255,0.08)",
                    border:"1px solid rgba(255,255,255,0.15)", borderRadius:"8px",
                    color:"white", fontSize:"0.75rem", outline:"none", fontFamily:"inherit",
                  }}
                />
                <button onClick={() => searchGifs(gifSearch)}
                  style={{ padding:"6px 12px", borderRadius:"8px", border:"none",
                    background:"linear-gradient(135deg,#7c3aed,#9333ea)", color:"white",
                    cursor:"pointer", fontSize:"0.75rem", fontFamily:"inherit" }}>
                  Go
                </button>
              </div>
              {gifLoading && <p style={{ color:"rgba(255,255,255,0.4)", fontSize:"0.75rem", textAlign:"center" }}>Searching…</p>}
              {!gifLoading && gifResults.length === 0 && (
                <p style={{ color:"rgba(255,255,255,0.3)", fontSize:"0.72rem", textAlign:"center", padding:"12px" }}>
                  Add VITE_TENOR_API_KEY to your .env to enable GIF search
                </p>
              )}
              {!gifLoading && gifResults.length > 0 && (
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:"4px" }}>
                  {gifResults.map((gif, i) => gif.url ? (
                    <img key={i} src={gif.preview || gif.url} alt="gif"
                      onClick={() => sendMedia(gif.url)}
                      style={{ width:"100%", aspectRatio:"1", objectFit:"cover",
                        borderRadius:"6px", cursor:"pointer", transition:"opacity 0.15s" }}
                      onMouseEnter={e => e.target.style.opacity="0.8"}
                      onMouseLeave={e => e.target.style.opacity="1"}
                    />
                  ) : null)}
                </div>
              )}
            </div>
          )}

          {/* Sticker grid */}
          {mediaPanel === "sticker" && (
            <div style={{ display:"flex", flexWrap:"wrap", gap:"4px" }}>
              {STICKER_EMOJIS.map(em => (
                <div key={em} onClick={() => { sendMedia(null); insertEmoji(em); setMediaPanel(null); }}
                  style={{ fontSize:"2rem", width:"52px", height:"52px", display:"flex",
                    alignItems:"center", justifyContent:"center", borderRadius:"10px",
                    cursor:"pointer", transition:"transform 0.15s ease, background 0.12s ease",
                    userSelect:"none" }}
                  onMouseEnter={e => { e.currentTarget.style.transform="scale(1.25)"; e.currentTarget.style.background="rgba(255,255,255,0.08)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform="scale(1)"; e.currentTarget.style.background="transparent"; }}
                >{em}</div>
              ))}
            </div>
          )}
        </div>
      </div>,
      document.body
    );
  };

  // ── Copy toast ────────────────────────────────────────────────────
  const CopyToast = () => copyToast ? createPortal(
    <div style={{
      position:"fixed", bottom:"90px", left:"50%", transform:"translateX(-50%)",
      padding:"8px 18px", background:"rgba(22,19,52,0.96)", color:"white",
      borderRadius:"20px", fontSize:"0.8rem", fontFamily:"inherit",
      border:"1px solid rgba(255,255,255,0.15)", zIndex:99999,
      animation:"popIn 0.15s ease-out both", backdropFilter:"blur(12px)",
      boxShadow:"0 4px 20px rgba(0,0,0,0.4)",
    }}>
      ✓ Copied to clipboard
    </div>,
    document.body
  ) : null;

  // ── Single bubble ─────────────────────────────────────────────────
  const renderBubble = (msg, index, isGroup) => {
    const senderId  = typeof msg.senderId === "object" ? msg.senderId?._id : msg.senderId;
    const isMine    = senderId === authUser._id || senderId?.toString() === authUser._id?.toString();
    const senderPic = typeof msg.senderId === "object"
      ? msg.senderId?.profilePic
      : isMine ? authUser?.profilePic : selectedUser?.profilePic;
    const senderName = isGroup && !isMine && typeof msg.senderId === "object"
      ? msg.senderId?.fullName : null;
    const isHovered = hoveredMsgId === msg._id;

    const onSoftDel = isGroup ? () => handleSoftDeleteGroup(msg._id) : () => handleSoftDeleteDM(msg._id);
    const onHardDel = isGroup ? () => handleHardDeleteGroup(msg._id) : () => handleHardDeleteDM(msg._id);

    return (
      <div key={msg._id || index}
        className={`flex items-end gap-2 w-full ${isMine ? "flex-row-reverse" : "flex-row"}`}
        onMouseEnter={() => setHoveredMsgId(msg._id)}
        onMouseLeave={() => setHoveredMsgId(null)}
      >
        <img src={senderPic || assets.avatar_icon} alt=""
          className="w-7 h-7 rounded-full object-cover flex-shrink-0 self-end mb-1" />

        <div className={`flex flex-col gap-1 min-w-0 ${isMine ? "items-end" : "items-start"}`}
          style={{ maxWidth:"65%" }}>

          {senderName && <p className="text-xs text-violet-300 px-1 truncate">{senderName}</p>}

          {/* Action bar */}
          <div className={`flex items-center gap-1 ${isMine ? "flex-row-reverse" : "flex-row"}`}
            style={{ opacity: isHovered ? 1 : 0, pointerEvents: isHovered ? "auto" : "none",
              transition:"opacity 0.15s ease", height:"26px" }}>

            {/* React (only on live messages) */}
            {!msg.deleted && (
              <button className="msg-action-btn" title="React"
                onClick={e => openReactPicker(e, msg._id, isMine, isGroup)}>😊</button>
            )}

            {/* Copy (only when text exists) */}
            {!msg.deleted && msg.text && (
              <button className="msg-action-btn" title="Copy" onClick={() => handleCopy(msg.text)}>📋</button>
            )}

            {/* Soft delete (only sender, live messages) */}
            {isMine && !msg.deleted && (
              <button className="msg-action-btn delete" title="Delete for everyone" onClick={onSoftDel}>🗑️</button>
            )}

            {/* Hard delete — shown on already-deleted messages so sender can fully remove it */}
            {isMine && msg.deleted && (
              <button className="msg-action-btn delete" title="Remove completely"
                style={{ fontSize:"0.7rem", padding:"2px 6px", width:"auto", color:"#f87171" }}
                onClick={() => { if (window.confirm("Remove this message completely?")) onHardDel(); }}>
                Remove
              </button>
            )}
          </div>

          {/* Bubble */}
          {msg.deleted ? (
            <div className="msg-deleted-bubble">
              <span>🚫</span>
              <span style={{ flex:1 }}>This message was deleted</span>
              {/* Hard delete option visible to sender on hover */}
            </div>
          ) : (
            <div className={`px-3 py-2 rounded-2xl text-sm font-light text-white
              ${isSunMode ? "bg-gradient-to-br from-orange-500/25 to-red-500/20" : "bg-violet-500/30"}
              ${isMine ? "rounded-br-sm" : "rounded-bl-sm"}`}
              style={{ wordBreak:"break-word", overflowWrap:"break-word", maxWidth:"100%" }}>
              {msg.image && (
                <img src={msg.image} alt="shared"
                  onClick={() => window.open(msg.image, "_blank")}
                  className="rounded-xl mb-1 cursor-zoom-in hover:opacity-90 transition-opacity block"
                  style={{ maxWidth:"200px" }} />
              )}
              {msg.text && <span>{msg.text}</span>}
            </div>
          )}

          {/* Reactions */}
          {msg.reactions && msg.reactions.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {msg.reactions.map(r => {
                const iMine = r.users.some(u => (u._id || u)?.toString() === authUser._id?.toString());
                const onReact = isGroup
                  ? () => handleReactGroup(msg._id, r.emoji)
                  : () => handleReactDM(msg._id, r.emoji);
                return (
                  <span key={r.emoji} className={`reaction-chip ${iMine ? (isSunMode ? "mine-sun" : "mine") : ""}`}
                    onClick={onReact}>
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

  // ── Input bar ─────────────────────────────────────────────────────
  const renderInputBar = (onSend, placeholder) => (
    <div className="flex-shrink-0 flex items-center gap-2 p-2 sm:p-3 border-t border-white/5">
      <div className="flex-1 flex flex-col items-start bg-gray-100/12 px-3 rounded-2xl min-w-0">
        {imagePreview && (
          <div className="relative pt-2 pl-1">
            <img src={imagePreview} alt="preview" className="h-14 rounded-md" />
            <button onClick={() => { setImagePreview(null); setImageFile(null); }}
              className="absolute top-1 right-1 text-white bg-black/50 rounded-full w-5 h-5 flex items-center justify-center text-xs">✕</button>
          </div>
        )}
        <div className="flex w-full items-center gap-1">
          {/* Emoji/GIF/Sticker toggle */}
          <button
            data-media-toggle
            onClick={() => setMediaPanel(p => p ? null : "emoji")}
            className="text-lg flex-shrink-0 transition-opacity px-1 opacity-70 hover:opacity-100"
            title="Emoji / GIF / Sticker"
          >🙂</button>

          <input ref={inputRef} type="text" value={inputText}
            onChange={e => setInputText(e.target.value)} onKeyDown={handleKey}
            placeholder={placeholder}
            className="flex-1 text-sm p-2 sm:p-3 border-none outline-none text-white placeholder-gray-400 bg-transparent min-w-0" />

          {/* File / GIF upload */}
          <input type="file" id="chat-file" accept="image/png,image/jpeg,image/gif,image/webp" hidden
            onChange={handleFileSelect} />
          <label htmlFor="chat-file" className="cursor-pointer flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity">
            <img src={assets.gallery_icon} alt="" className="w-5 mr-1" style={{ filter: iconFilter }} />
          </label>
        </div>
      </div>
      <img src={assets.send_button} alt="send"
        className={`w-7 cursor-pointer flex-shrink-0 ${sending ? "opacity-50" : ""}`}
        style={{ filter: iconFilter }}
        onClick={!sending ? onSend : undefined} />
    </div>
  );

  // ── Is the selected user actually online? ─────────────────────────
  const selectedUserOnline = selectedUser ? onlineUsers.includes(selectedUser._id) : false;

  // ── DM view ───────────────────────────────────────────────────────
  if (selectedUser) return (
    <>
      <ReactPickerPortal />
      <MediaPanelPortal />
      <CopyToast />
      <div className="h-full flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 py-3 px-3 sm:px-4 border-b border-stone-500 flex-shrink-0">
          <img onClick={() => setSelectedUser(null)} src={assets.arrow_icon}
            className="md:hidden w-6 h-6 cursor-pointer flex-shrink-0" alt="back" />
          <img src={selectedUser?.profilePic || assets.avatar_icon} alt=""
            className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-white font-medium text-sm sm:text-base truncate">{selectedUser?.fullName}</p>
            <p className={`text-xs ${selectedUserOnline ? "text-green-400" : "text-gray-400"}`}>
              {selectedUserOnline ? "Online" : "Offline"}
            </p>
          </div>
          <img src={assets.help_icon} alt="" className="max-md:hidden max-w-5 flex-shrink-0 opacity-60" />
        </div>
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 flex flex-col gap-4 min-h-0">
          {messages.map((msg, i) => renderBubble(msg, i, false))}
          <div ref={scrollEnd} />
        </div>
        {renderInputBar(doSend, "Send a message")}
      </div>
    </>
  );

  // ── Group view ────────────────────────────────────────────────────
  if (selectedGroup) return (
    <>
      <ReactPickerPortal />
      <MediaPanelPortal />
      <CopyToast />
      <div className="h-full flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 py-3 px-3 sm:px-4 border-b border-stone-500 flex-shrink-0">
          <img onClick={() => setSelectedGroup(null)} src={assets.arrow_icon}
            className="md:hidden w-6 h-6 cursor-pointer flex-shrink-0" alt="back" />
          <img src={selectedGroup?.groupPic || assets.avatar_icon} alt=""
            className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-white font-medium text-sm sm:text-base truncate">{selectedGroup?.name}</p>
            <p className="text-gray-400 text-xs">{selectedGroup?.members?.length} members</p>
          </div>
          <img src={assets.help_icon} alt="" className="max-md:hidden max-w-5 flex-shrink-0 opacity-60" />
        </div>
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 flex flex-col gap-4 min-h-0">
          {groupMessages.map((msg, i) => renderBubble(msg, i, true))}
          <div ref={scrollEnd} />
        </div>
        {renderInputBar(doSend, "Message the group")}
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