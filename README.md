# Pixel Planes ✈️

A little airplane game you fly with the arrow keys. Made for learning how to
build games!

## How to play it

**The easy way:** find the file `index.html` and double-click it. It opens in
your web browser and you can play.

**If that doesn't work**, open a terminal in this folder and type:

```
python3 -m http.server
```

Then open your browser to **http://localhost:8000**

## Controls

- **Up arrow** = more gas (go faster)
- **Down arrow** = less gas (slow down)
- **Left arrow** = turn the nose left
- **Right arrow** = turn the nose right

Try to keep flying without crashing into the ground! Gravity always pulls you
down, so you need gas to stay up.

## Want to change something?

Open the file **`js/config.js`**. It has all the numbers you can play with,
like how fast the plane goes, how strong gravity is, and the colors.
Change a number, save the file, and refresh your browser to see what happens.
You can't break anything — just experiment and have fun!

## 🌐 Online play (the server)

Online play (server list, creating/joining servers, passwords, host control)
needs a little **server program** to run. The game itself can be on GitHub
Pages, but the server has to run somewhere too. It lives in the **`server/`**
folder.

### ▶️ Play online on your WiFi (easiest — no accounts, no deploying)

The server now hands out the game too, so it's **one command and one address**:

1. **Install Node.js** (one time): get it from **https://nodejs.org** (the big
   "LTS" button) and run the installer.
2. **Start it.** Open a terminal in this project and run:
   ```
   cd server
   npm install     # one time — downloads the 'ws' library
   npm start       # starts everything
   ```
3. It prints the addresses to open. **On this computer:** `http://localhost:8080`.
   **Anyone else on your WiFi:** `http://YOUR-IP:8080` (it prints your IP).
4. Everyone opens that address, presses **ESC → Create Server** (or Server
   List), and you're playing together. Nothing to type — it connects to the
   same computer automatically. Keep the terminal window open while you play.

### 🌍 Play worldwide (from the public https link) — needs a one-time deploy

The public github.io link is **https**, and a browser will only let an https
page talk to a **secure `wss://`** server. So for the link to work for anyone
anywhere, the server has to be hosted online (a grown-up with the accounts
should do this part):

- **Worldwide (from the https game link):** the server must have a **secure
  `wss://`** address. Deploy it free on **Render** — basically one click:

  **[➡️ Click here to Deploy to Render](https://render.com/deploy?repo=https://github.com/bryding/pixel-planes)**

  1. Sign in with your GitHub account (free).
  2. Click **Apply** — Render reads `render.yaml` and builds the `server/` folder.
  3. Wait ~2 minutes. It creates a server at
     **`https://pixel-planes-bryding.onrender.com`**.

  The game is already pointed at `wss://pixel-planes-bryding.onrender.com`
  (in `js/config.js`), so the moment that deploy is live, **the public game
  link works online for everyone, on any device/OS** — no other changes needed.

  > Notes: a page on **https** can ONLY use **wss://** (never `ws://`) — that's
  > a browser rule on every device. If Render gives a slightly different URL,
  > paste it into the lobby's server box (or tell me and I'll update the
  > default). The free tier sleeps when idle, so the first connect after a quiet
  > spell takes ~30–60s to wake — the game keeps retrying, just wait a moment.

### 4. Play
Press **ESC** → **Create Server** (pick a name + optional password) or
**Server List** (join one). The person who creates a server is the **host** —
only they get the Mode and Modifier menus.

> Heads-up: right now this is the **lobby** — creating, listing, joining, and
> host control all work. *Seeing each other fly in the same sky* is the next
> piece we're building on top of this.
