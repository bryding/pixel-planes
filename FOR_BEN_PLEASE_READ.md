# 🛩️ Ben — please help get Pixel Planes online (a few minutes, free)

Your nephew built the whole game (it's great!). The only thing left is the
"online" part, which needs an account, so it needs you. Two options — **Option A
is the real fix** (works from the public link, anywhere).

---

## ✅ Option A — Make the public link work online for everyone (best)

This hosts the little game server so anyone with the link plays together in the
**one shared world**. We use **Railway**, which is already connected to the
GitHub repo — so this is mostly "make sure it's running".

1. Sign in at 👉 https://railway.app with your **GitHub** account.
2. Open the **pixel-planes** project. Railway auto-builds whenever new code is
   pushed (it reads `railway.json` and runs `node server/server.js`).
3. Check the service is **Active / Deployed** and has a public domain like
   **`pixel-planes-bryding-production.up.railway.app`**. If it asks, turn on a
   public domain (Railway sets the `PORT` automatically; the server already uses it).
4. That's it — the game is already pointed at
   `wss://pixel-planes-bryding-production.up.railway.app` (in `js/config.js`),
   so the moment the deploy is live, the public link works for everyone.

*(If Railway shows a different domain than the one above, just tell your nephew
the new address.)*

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
