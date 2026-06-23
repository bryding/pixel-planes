# 🛩️ Ben — please help get Pixel Planes online (a few minutes, free)

Your nephew built the whole game (it's great!). The only thing left is the
"online" part, which needs an account, so it needs you. Two options — **Option A
is the real fix** (works from the public link, anywhere).

---

## ✅ Option A — Make the public link work online for everyone (best)

This hosts the little game server for free, so anyone with the link can play
together from any WiFi.

1. Click this link:
   👉 https://render.com/deploy?repo=https://github.com/bryding/pixel-planes
2. Sign in (the **GitHub** button — your account; free, no credit card).
3. Click **Apply**. Wait ~2 minutes while it builds.
4. It shows a web address ending in **`.onrender.com`**
   (e.g. `https://pixel-planes-bryding.onrender.com`).
5. **Send that address to Claude Code** (or your nephew), saying
   *"the server is at &lt;that address&gt;"*. Claude points the game at it and
   then the public link works online for everyone:
   **https://bryding.github.io/pixel-planes/**

*(Free tier "sleeps" when idle, so the first connection after a quiet spell
takes ~30–60s to wake — that's normal.)*

---

## 🏠 Option B — Just play in THIS house, no accounts (quick test)

1. Make sure **Node OR Python** is available (Macs have Python already).
2. Double-click **`Play Pixel Planes (same WiFi).command`** in the project
   folder. A black window opens and your browser opens the game.
   - If macOS asks **"Allow incoming connections?"** → click **Allow**
     (needed so other devices can join).
3. On other devices on the same WiFi, open the **`http://192.168.x.x:8080`**
   address the black window prints.

If Option B's window flashes and closes, or the browser says "couldn't reach,"
it's usually the firewall prompt (click Allow) or Python not found — tell Claude
what the black window shows and it'll sort it.

---

Thanks so much! Once you do **Option A step 5**, your nephew can play with
anyone, anywhere. — Claude
