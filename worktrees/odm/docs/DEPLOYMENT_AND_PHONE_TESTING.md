# Deployment and Phone Testing Guide

How to run Driiva locally on your phone, and options for deploying to production.

---

## Option A: Test on Phone via Local Network (Fastest)

Best for manual testing without deploying.

### 1. Start the app on your computer

```bash
cd /Users/joa/Documents/DRIIVA-1
npm run dev
```

Server runs at `http://localhost:3001`.

### 2. Find your computer's IP address

**macOS:**
```bash
ipconfig getifaddr en0
```
Example: `192.168.1.42`

**Windows:** `ipconfig` → look for IPv4 Address under your WiFi adapter.

### 3. Add IP to CORS

Edit `.env` and add your IP to `CORS_ORIGINS`:

```
CORS_ORIGINS="http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000,http://192.168.1.42:3001"
```

Replace `192.168.1.42` with your actual IP. Restart `npm run dev`.

### 4. Open on your phone

1. Ensure your phone is on the **same WiFi** as your computer.
2. Open the browser (Safari, Chrome) and go to: `http://192.168.1.42:3001`
3. The app should load.

### 5. Firebase authorized domains

Go to **Firebase Console** → **Authentication** → **Settings** → **Authorized domains**.

Add: `192.168.1.42` (or your machine’s hostname if you use it).

### 6. Add to home screen (PWA)

On iOS Safari: Share → Add to Home Screen.  
On Android Chrome: Menu → Add to Home Screen.

---

## Option B: Deploy to Vercel

Vercel is good for the frontend, but Driiva uses a **custom Express server** for the API. That requires extra setup.

### Current setup

- **Frontend:** Vite + React (static build)
- **Backend:** Express server (Node.js) on port 3001
- **APIs:** `/api/profile/me`, `/api/community-pool`, etc.

### Vercel approach

1. **Frontend only** – Deploy the built client as static files.  
   - API calls would go to a separate backend (e.g. Railway, Render).

2. **Full app** – Use Vercel’s Node.js runtime and adapt the Express app into a serverless function.  
   - Requires refactoring `server/index.ts` into an exported handler.

### Recommendation

For a quick beta, prefer **Option A (local network)** or a platform that supports a long‑running Node server:

- **Railway**
- **Render**
- **Fly.io**

These can run `npm run build && npm run start` without converting to serverless.

---

## Option C: Firebase Hosting + Cloud Functions

For production, you can:

- **Frontend:** Firebase Hosting (static)
- **Backend:** Express hosted elsewhere, or APIs moved into Cloud Functions

This needs more configuration and is better suited to a later production phase.

---

## Summary: Get it on your phone today

1. Run `npm run dev` on your computer.
2. Add your computer’s IP to `CORS_ORIGINS` in `.env`.
3. Add your IP to Firebase **Authorized domains**.
4. On your phone (same WiFi), open `http://<your-ip>:3001`.
5. Optionally add to home screen.

---

## Troubleshooting

| Issue | Possible fix |
|-------|---------------|
| Blank page on phone | Check CORS, HTTPS vs HTTP, and Firebase authorized domains |
| Sign-in fails | Ensure Firebase URL/domain is authorized |
| Trip recording stuck | Grant location permission; allow up to 25s for setup |
| "Connection refused" | Confirm phone and computer are on same WiFi and firewall isn’t blocking port 3001 |

---

*Last updated: Feb 2026*
