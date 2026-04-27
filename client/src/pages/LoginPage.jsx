import React, { useState, useRef, useEffect } from 'react'
import axios from "axios"
import { useNavigate } from "react-router-dom"
import assets from "../assets/assets"
import { BASE_URL, useAppContext } from "../context/ContextProvider"

// ─────────────────────────────────────────────────────────────────────────────
//  MeteorCanvas — natural physics-based meteor shower
//
//  Each meteor has a full life-cycle:
//   • Born off-screen top-left, travels top-left → bottom-right
//   • Opacity eases IN over first 8% of journey (no hard pop)
//   • Opacity eases OUT over last 15% (natural fade, not a cut)
//   • Two-pass drawing: wide soft glow + narrow bright core
//   • No ctx.filter blur (causes canvas artifacting / performance issues)
//   • Max ~3-4 visible at once, staggered by random delays
//   • Canvas is fully transparent — page bg always shows through
// ─────────────────────────────────────────────────────────────────────────────
const MeteorCanvas = () => {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let raf, W, H

    const resize = () => {
      W = canvas.width  = window.innerWidth
      H = canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // ── Twinkling star field ──────────────────────────────────────────
    const stars = Array.from({ length: 160 }, () => ({
      x: Math.random(), y: Math.random(),
      r: 0.25 + Math.random() * 1.0,
      base: 0.06 + Math.random() * 0.38,
      spd:  0.25 + Math.random() * 0.9,
      ph:   Math.random() * Math.PI * 2,
      blue: Math.random() > 0.8,
    }))

    // ── Meteor class ──────────────────────────────────────────────────
    class Meteor {
      constructor(delay) {
        this.waiting = delay   // seconds before first activation
        this.active  = false
        this._reset()
      }

      _reset() {
        // Angle: 35°–50° — consistent left→right diagonal direction
        this.angle = (35 + Math.random() * 15) * Math.PI / 180

        // Speed tier
        const r = Math.random()
        if (r < 0.28) {
          // Slow / faint — atmospheric background
          this.speed = 110 + Math.random() * 80
          this.width = 0.55 + Math.random() * 0.5
          this.tail  = 65  + Math.random() * 75
          this.peak  = 0.2  + Math.random() * 0.18
          this.glow  = 2.5  + Math.random() * 2
          this.hue   = 235  + Math.random() * 45
        } else if (r < 0.68) {
          // Medium — the most common
          this.speed = 230 + Math.random() * 170
          this.width = 0.9  + Math.random() * 0.9
          this.tail  = 120  + Math.random() * 110
          this.peak  = 0.42 + Math.random() * 0.28
          this.glow  = 4.5  + Math.random() * 4
          this.hue   = 238  + Math.random() * 55
        } else if (r < 0.92) {
          // Fast / bright
          this.speed = 460 + Math.random() * 280
          this.width = 1.4  + Math.random() * 1.3
          this.tail  = 190  + Math.random() * 170
          this.peak  = 0.68 + Math.random() * 0.3
          this.glow  = 7    + Math.random() * 5
          this.hue   = 218  + Math.random() * 68
        } else {
          // Rare comet — slow, long, majestic
          this.speed = 85   + Math.random() * 55
          this.width = 1.9  + Math.random() * 1.8
          this.tail  = 290  + Math.random() * 190
          this.peak  = 0.82
          this.glow  = 11   + Math.random() * 8
          this.hue   = 188  + Math.random() * 82
        }

        this.dist  = 0
        this.total = Math.sqrt(W * W + H * H) + 280

        this.vx = Math.cos(this.angle) * this.speed
        this.vy = Math.sin(this.angle) * this.speed

        // Entry point: left edge (60%) or top edge (40%), biased toward top-left
        if (Math.random() < 0.6) {
          this.x = -(35 + Math.random() * 90)
          this.y = Math.random() * H * 0.65 - 50
        } else {
          this.x = Math.random() * W * 0.55 - 75
          this.y = -(35 + Math.random() * 70)
        }
      }

      tick(dt) {
        if (!this.active) {
          this.waiting -= dt
          if (this.waiting <= 0) this.active = true
          return
        }

        this.x    += this.vx * dt
        this.y    += this.vy * dt
        this.dist += this.speed * dt

        if (this.dist >= this.total) {
          this.active  = false
          this.waiting = 0.9 + Math.random() * 2.8   // gap before next
          this._reset()
        }
      }

      draw() {
        if (!this.active) return

        // Life-cycle opacity: ease-in (0→8%), hold, ease-out (85→100%)
        const p = this.dist / this.total
        let fade
        if (p < 0.08)      fade = p / 0.08
        else if (p > 0.85) fade = (1 - p) / 0.15
        else               fade = 1

        const alpha = this.peak * Math.max(0, fade)
        if (alpha < 0.008) return

        const tx = this.x - Math.cos(this.angle) * this.tail
        const ty = this.y - Math.sin(this.angle) * this.tail

        // ── Wide soft-glow pass (no filter — pure gradient) ──────────
        const g1 = ctx.createLinearGradient(tx, ty, this.x, this.y)
        g1.addColorStop(0,   `hsla(${this.hue},82%,92%,0)`)
        g1.addColorStop(0.55,`hsla(${this.hue},82%,92%,${alpha * 0.07})`)
        g1.addColorStop(1,   `hsla(${this.hue},82%,92%,${alpha * 0.17})`)
        ctx.save()
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(this.x, this.y)
        ctx.strokeStyle = g1
        ctx.lineWidth   = this.width * 5.5
        ctx.lineCap     = 'round'
        ctx.stroke()
        ctx.restore()

        // ── Narrow bright core ────────────────────────────────────────
        const g2 = ctx.createLinearGradient(tx, ty, this.x, this.y)
        g2.addColorStop(0,    `hsla(${this.hue},100%,98%,0)`)
        g2.addColorStop(0.42, `hsla(${this.hue},100%,98%,${alpha * 0.32})`)
        g2.addColorStop(0.75, `hsla(${this.hue},100%,98%,${alpha * 0.75})`)
        g2.addColorStop(1,    `rgba(255,255,255,${alpha})`)
        ctx.save()
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(this.x, this.y)
        ctx.strokeStyle = g2
        ctx.lineWidth   = this.width
        ctx.lineCap     = 'round'
        ctx.stroke()
        ctx.restore()

        // ── Head glow: outer halo ─────────────────────────────────────
        const hR = this.glow * 3.2
        const gh = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, hR)
        gh.addColorStop(0,    `hsla(${this.hue},88%,90%,${alpha * 0.42})`)
        gh.addColorStop(0.48, `hsla(${this.hue},78%,80%,${alpha * 0.11})`)
        gh.addColorStop(1,    `hsla(${this.hue},68%,70%,0)`)
        ctx.save()
        ctx.beginPath(); ctx.arc(this.x, this.y, hR, 0, Math.PI * 2)
        ctx.fillStyle = gh; ctx.fill()
        ctx.restore()

        // ── Head glow: bright core point ─────────────────────────────
        const gc = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.glow)
        gc.addColorStop(0,   `rgba(255,255,255,${alpha})`)
        gc.addColorStop(0.3, `hsla(${this.hue},92%,94%,${alpha * 0.72})`)
        gc.addColorStop(1,   `hsla(${this.hue},78%,78%,0)`)
        ctx.save()
        ctx.beginPath(); ctx.arc(this.x, this.y, this.glow, 0, Math.PI * 2)
        ctx.fillStyle = gc; ctx.fill()
        ctx.restore()
      }
    }

    // 13 slots — staggered initial delays so shower populates naturally
    const meteors = Array.from({ length: 13 }, (_, i) =>
      new Meteor(i * 0.38 + Math.random() * 0.25)
    )

    let last = performance.now()
    let t    = 0

    const animate = () => {
      const now = performance.now()
      const dt  = Math.min((now - last) / 1000, 0.05)  // cap at 50ms
      last = now; t += dt

      ctx.clearRect(0, 0, W, H)   // transparent clear

      stars.forEach(s => {
        const a = s.base * (0.28 + 0.72 * Math.sin(t * s.spd + s.ph))
        ctx.fillStyle = s.blue ? `hsla(218,80%,88%,${a})` : `rgba(255,255,255,${a})`
        ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2); ctx.fill()
      })

      meteors.forEach(m => { m.tick(dt); m.draw() })

      raf = requestAnimationFrame(animate)
    }

    animate()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [])

  return (
    <canvas ref={ref}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0, background: 'transparent' }}
    />
  )
}

// ── LoginPage ─────────────────────────────────────────────────────────────────
export const LoginPage = () => {
  const navigate = useNavigate()
  const { loginUser } = useAppContext()
  const [currState, setCurrState] = useState('Sign Up')
  const [fullName,  setFullName]  = useState("")
  const [email,     setEmail]     = useState("")
  const [password,  setPassword]  = useState("")
  const [bio,       setBio]       = useState("")
  const [isDataSubmitted, setIsDataSubmitted] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  const onSubmitHandler = async (e) => {
    e.preventDefault(); setErrorMsg("")
    if (currState === "Sign Up" && !isDataSubmitted) { setIsDataSubmitted(true); return }
    setLoading(true)
    try {
      if (currState === "Sign Up") {
        const { data } = await axios.post(`${BASE_URL}/api/auth/signup`, { fullName, email, password, bio })
        if (data.success) { loginUser(data.userData, data.token); navigate("/") }
        else setErrorMsg(data.message)
      } else {
        const { data } = await axios.post(`${BASE_URL}/api/auth/login`, { email, password })
        if (data.success) { loginUser(data.userData, data.token); navigate("/") }
        else setErrorMsg(data.message)
      }
    } catch { setErrorMsg("Something went wrong. Please try again.") }
    finally { setLoading(false) }
  }

  return (
    <div className='relative min-h-screen bg-cover flex items-center justify-center gap-8 sm:justify-evenly max-sm:flex-col max-sm:justify-start max-sm:py-10 backdrop-blur-2xl overflow-x-hidden'>
      <MeteorCanvas />
      <div className="starry-bg-blur" />
      <div className="relative z-10 w-full sm:w-1/2 flex flex-col items-center justify-center text-center px-6 sm:px-10 py-10">
        <img src={assets.logo} alt="Logo" className="max-w-[240px] sm:max-w-[300px] mb-6 drop-shadow-lg" />
        <h2 className="text-white text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight mb-3 leading-tight">
          Welcome to <span className="text-red-400">ANICHAT!</span>
        </h2>
        <p className="text-sm text-gray-300 max-w-xs sm:max-w-sm leading-relaxed">
          Join the community and let's build something extraordinary together.
        </p>
      </div>
      <form onSubmit={onSubmitHandler}
        className='relative z-10 border-2 bg-white/8 text-white border-gray-500 p-5 sm:p-6 flex flex-col gap-4 sm:gap-6 rounded-lg shadow-lg w-[90vw] max-w-sm'>
        <h2 className='font-medium text-2xl flex justify-between items-center'>
          {currState}
          {isDataSubmitted && <img onClick={() => setIsDataSubmitted(false)} src={assets.arrow_icon} alt="" className='w-5 cursor-pointer' />}
        </h2>
        {currState === "Sign Up" && !isDataSubmitted && (
          <input onChange={e => setFullName(e.target.value)} value={fullName} type="text"
            className='p-2 border border-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-white'
            placeholder='Full Name' required />
        )}
        {!isDataSubmitted && <>
          <input onChange={e => setEmail(e.target.value)} value={email} type="email"
            className='p-2 border border-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-white'
            placeholder='Email Address' required />
          <input onChange={e => setPassword(e.target.value)} value={password} type="password"
            className='p-2 border border-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-white'
            placeholder='Password' required />
        </>}
        {currState === "Sign Up" && isDataSubmitted && (
          <textarea onChange={e => setBio(e.target.value)} value={bio} rows={4}
            className='p-2 border border-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-white'
            placeholder="Provide a short bio..." />
        )}
        {errorMsg && <p className="text-red-400 text-sm text-center">{errorMsg}</p>}
        <button type="submit" disabled={loading}
          className='py-3 bg-gradient-to-r from-purple-400 to-violet-600 text-white rounded-md cursor-pointer disabled:opacity-60'>
          {loading ? "Please wait…" : currState === "Sign Up" ? "Create Account" : "Login"}
        </button>
        <div className='flex items-center gap-2 text-sm text-gray-500'>
          <input type="checkbox" required />
          <p>I Agree to the terms of use &amp; privacy policy</p>
        </div>
        <div className='flex flex-col gap-2'>
          {currState === "Sign Up" ? (
            <p className='text-sm text-gray-600'>Already have an account?{" "}
              <span className='font-medium text-violet-500 cursor-pointer'
                onClick={() => { setCurrState("Login"); setIsDataSubmitted(false); setErrorMsg("") }}>Login here</span></p>
          ) : (
            <p className='text-sm text-gray-600'>Create An Account{" "}
              <span onClick={() => { setCurrState("Sign Up"); setErrorMsg("") }}
                className='font-medium text-violet-500 cursor-pointer'>Click here</span></p>
          )}
        </div>
      </form>
    </div>
  )
}
