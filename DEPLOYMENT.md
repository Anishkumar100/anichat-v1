# AniChat — Deployment Guide

## Architecture Overview

```
Browser (React + Vite)
       │
       ├── HTTP (REST API) ──────────────────────► Express Server
       │                                                  │
       └── WebSocket (Socket.io) ───────────────────────► │
                                                           │
                                                    MongoDB Atlas
                                                    Cloudinary CDN
```

---

## Local Development Setup

### 1. Clone & Install

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 2. Configure Environment Variables

**Server** — create `server/.env`:

```env
PORT=8000
MONGODB_URL=mongodb+srv://<user>:<pass>@cluster.mongodb.net/anichat
JWT_SECRET_KEY=some_long_random_secret
CLOUD_NAME=your_cloudinary_cloud
CLOUDINARY_API_KEY=your_key
CLOUDINARY_API_KEY_SECRET=your_secret
CLIENT_URL=http://localhost:5173
```

**Client** — create `client/.env`:

```env
VITE_API_BASE_URL=http://localhost:8000
```

### 3. Run Both Servers

```bash
# Terminal 1 — start the backend
cd server
npm run dev

# Terminal 2 — start the frontend
cd client
npm run dev
```

Open http://localhost:5173

---

## Production Deployment on Vercel

> ⚠️ **Important:** Socket.io (WebSockets) have limitations on Vercel's
> serverless infrastructure. For full WebSocket support in production,
> consider **Railway**, **Render**, or **Fly.io** for the server.
> The REST API endpoints work perfectly on Vercel.

### Option A: Vercel (REST only, no real-time)

#### Deploy Server

1. Push the `server/` folder to a GitHub repo (or as root)
2. Go to vercel.com → New Project → import repo
3. Set Root Directory to `server`
4. Add all Environment Variables from `.env`
5. Deploy

#### Deploy Client

1. Push the `client/` folder to GitHub
2. New Project → import repo
3. Set Root Directory to `client`
4. Add environment variable:
   - `VITE_API_BASE_URL` = your deployed server URL (e.g. `https://anichat-server.vercel.app`)
5. Deploy

---

### Option B: Railway (Recommended for WebSockets)

#### Server on Railway

1. Go to railway.app → New Project → Deploy from GitHub
2. Select your server repo
3. Add environment variables (same as `.env`)
4. Railway auto-detects Node.js and runs `npm start`
5. Copy the generated URL (e.g. `https://anichat.up.railway.app`)

#### Client on Vercel

Same as Option A — set `VITE_API_BASE_URL` to your Railway server URL.

---

### Option C: Render (Free tier, supports WebSockets)

#### Server on Render

1. render.com → New → Web Service → Connect GitHub
2. Build Command: `npm install`
3. Start Command: `npm start`
4. Add all environment variables
5. Copy the URL (e.g. `https://anichat.onrender.com`)

#### Client on Vercel (same as above)

---

## MongoDB Atlas Setup

1. Go to mongodb.com/atlas → Create free cluster
2. Database Access → Add user with read/write permissions
3. Network Access → Allow access from anywhere (`0.0.0.0/0`) for Vercel/Railway
4. Connect → Drivers → Copy connection string
5. Replace `<password>` and add your database name: `mongodb+srv://.../<dbname>?...`

---

## Cloudinary Setup

1. cloudinary.com → Sign up for free
2. Dashboard → copy `Cloud Name`, `API Key`, `API Secret`
3. Add to your server `.env`

---

## API Reference

### Auth Routes (`/api/auth`)

| Method | Path             | Auth | Body                                | Description          |
|--------|------------------|------|-------------------------------------|----------------------|
| POST   | /signup          | ✗    | fullName, email, password, bio      | Create account       |
| POST   | /login           | ✗    | email, password                     | Login                |
| GET    | /check           | ✓    | —                                   | Verify token         |
| PUT    | /update-profile  | ✓    | fullName, bio, profilePic(base64)   | Update profile       |

### Message Routes (`/api/messages`)

| Method | Path           | Auth | Description                          |
|--------|----------------|------|--------------------------------------|
| GET    | /users         | ✓    | Get sidebar users + unseen counts    |
| GET    | /:id           | ✓    | Get conversation with user :id       |
| POST   | /send/:id      | ✓    | Send message to user :id             |
| PUT    | /mark/:id      | ✓    | Mark message :id as seen             |

### Group Routes (`/api/groups`)

| Method | Path               | Auth | Description                      |
|--------|--------------------|------|----------------------------------|
| POST   | /create            | ✓    | Create a new group               |
| GET    | /                  | ✓    | Get all groups user belongs to   |
| GET    | /:id/messages      | ✓    | Get group messages               |
| POST   | /:id/messages      | ✓    | Send message to group            |

### Socket.io Events

**Client → Server** (via connection query):
- `query.userId` — sent during connection to identify the user

**Server → Client**:
- `onlineUsers` — array of online user IDs (emitted on connect/disconnect)
- `newMessage` — a new DM arrived (emitted to receiver)
- `newGroupMessage` — a group message arrived (emitted to group members)
- `messageSeen` — a message was marked as seen (emitted to sender)

---

## Security Checklist

- [ ] Change `JWT_SECRET_KEY` to a long random string (32+ chars)
- [ ] Set `CLIENT_URL` to your exact frontend URL (not `*`)
- [ ] Restrict MongoDB Network Access to your server's IP in production
- [ ] Enable HTTPS on your deployment platform (automatic on Vercel/Railway/Render)
- [ ] Keep `.env` in `.gitignore` — never commit secrets

---

## Troubleshooting

**"Cannot connect to server"**
→ Check that the server is running and `VITE_API_BASE_URL` is correct

**"Socket.io not working on Vercel"**
→ Move the server to Railway or Render which supports persistent connections

**"Cloudinary upload failing"**
→ Verify your Cloudinary credentials in `.env`

**"Token expired" on page refresh**
→ Normal — user needs to log in again (tokens expire after 7 days)
