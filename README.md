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
- **Space** = shoot your guns
- **X** = fire a homing missile

Try to keep flying without crashing into the ground! Gravity always pulls you
down, so you need gas to stay up.

## Want to change something?

Open the file **`js/config.js`**. It has all the numbers you can play with,
like how fast the plane goes, how strong gravity is, and the colors.
Change a number, save the file, and refresh your browser to see what happens.
You can't break anything — just experiment and have fun!

## 🌐 Online play — one shared world

There are no rooms or passwords any more. You open the game, **type a name**,
click **JOIN GAME**, and you're flying in the **one shared sky** with everyone
else (like agar.io). If only a few real people are online, the server fills the
empty spots with **bots** so the sky is never lonely. It's a free-for-all:
shoot others down, get shot down, and **respawn right away** with a fresh score.

This needs a little **server program** (in the **`server/`** folder) that also
hands out the game files, so one address does everything.

### ▶️ Run it on your computer (and same-WiFi friends)

Install Node from **https://nodejs.org**, then from this folder:

```
cd server
npm install        # one time — installs "ws"
cd ..
node server/server.js
```

It prints addresses like:
```
- on THIS computer:  http://localhost:8080
- others on WiFi:    http://192.168.1.16:8080
```

Open **http://localhost:8080**, type a name, press **JOIN GAME**. Friends on the
same WiFi open the `192.168…:8080` address it printed. Keep the window open while
you play (Ctrl+C to stop). There's also a **🛩 Play offline** button if you just
want the single-player game with no server.

### 🌍 Play worldwide — one-time deploy to Railway

The public github.io link is **https**, and a browser will only let an https
page talk to a **secure `wss://`** server, so the server has to be hosted online
(a grown-up with the accounts does this once — see `FOR_BEN_PLEASE_READ.md`).

This repo is set up for **Railway**: it has a `railway.json` and a root
`package.json` whose `start` script runs `node server/server.js`. Railway is
already connected to the GitHub repo, so pushing the code auto-builds it at
**`https://pixel-planes-bryding-production.up.railway.app`**. The game is already
pointed there (`SERVER_URL` in `js/config.js`), so once the deploy is live the
public link works for everyone, on any device.

> A page on **https** can ONLY use **wss://** (never `ws://`) — a browser rule on
> every device. When you run the server yourself over `http://localhost`, the
> game connects to that same address automatically, so there's nothing to type.

### 🔧 Change the world

Everything tweakable is in **`js/config.js`** — and the server reads that **same
file**, so there's only one place to change things:

- `TARGET_POPULATION` — how many planes fill the sky (default 10)
- `NET_TICK_HZ` — how often the server updates everyone (default 18)
- `HARD_CAP` — most real people allowed at once (default 32)
- `RESPAWN_DELAY` — how long before you fly back in after being shot down

There's also a quick self-check for the server's math:

```
npm test        # runs server/checks.js (bot counts, name cleaning, anti-cheat)
```
