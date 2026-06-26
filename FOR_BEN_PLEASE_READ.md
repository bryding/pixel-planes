# 🛩️ Pixel Planes — online status

## ✅ IT'S LIVE — play here:

👉 **https://pixel-planes-bryding-production.up.railway.app**

When it opens you pick **🤖 Single Player** (offline, with all the game modes,
cheats, power-ups, eject and split-screen — lives in the `solo/` folder) or
**🌍 Multiplayer Online**. For multiplayer, type a name, press **JOIN GAME**, and
you're in the one shared world with everyone else. Share that link with anyone,
on any network.

---

## How the hosting works (for the account owner)

The game server runs on **Railway**, connected to this GitHub repo. **Every push
to `main` auto-redeploys** — there's nothing to click. It reads `railway.json`
and runs `node server/server.js`; Railway sets `$PORT` and the server uses it.
The client's `SERVER_URL` (in `js/config.js`) already points at the Railway
`wss://` domain, so one address serves the game *and* the live world.

If you ever need to check it: sign in at https://railway.app (GitHub account),
open the **pixel-planes** project → **Deployments** shows each build; **Settings →
Networking** shows the public domain. If the domain ever changes, update
`SERVER_URL` in `js/config.js` and push.

---

### 👦 For my nephew — what to send to Claude

If Uncle Ben's Railway address is different from the default, open Claude Code
and paste this (with the real address):

> **the server is at https://<your-railway-domain>.up.railway.app**

Claude will point the game at it, and the public link works online for everyone,
any WiFi: **https://bryding.github.io/pixel-planes/**

---

## 🏠 Option B — Just play in THIS house, no accounts (quick test)

The shared-world server is **Node** (it needs the tiny `ws` library), so this
one needs Node installed.

1. Install **Node** once from **https://nodejs.org** (the big green button).
2. Double-click **`Play Pixel Planes (same WiFi).command`** in the project
   folder. A black window opens and your browser opens the game.
   - The very first time, it runs `npm install` in `server/` (a few seconds).
   - If macOS asks **"Allow incoming connections?"** → click **Allow**
     (needed so other devices can join).
3. On other devices on the same WiFi, open the **`http://192.168.x.x:8080`**
   address the black window prints.

If the window flashes and closes, or the browser says "couldn't reach," it's
usually the firewall prompt (click Allow) or Node not installed — tell Claude
what the black window shows and it'll sort it.

---

Thanks so much! Once you do **Option A step 5**, your nephew can play with
anyone, anywhere. — Claude
