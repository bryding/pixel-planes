# Pixel Planes ✈️

A browser airplane game you fly with the arrow keys, in **one always-on shared
world** — type a name, join, and dogfight everyone else in the same sky. Made
for learning how to build games!

## How to play it

**The easy way — just open the live link:**

👉 **https://pixel-planes-bryding-production.up.railway.app**

When the game opens you pick how to play:

- **🤖 Single Player** — fly against bots offline, with all the extra game modes
  and options (Classic, Unicorn, WW2, Alien Invasion, Night, Black Hole, Bad
  Weather), the Modifier/Cheat menu, power-ups, eject + parachute, and even
  2-player split-screen. This part is self-contained in the `solo/` folder, so it
  works even with no internet.
- **🌍 Multiplayer Online** — type a name, press **JOIN GAME**, and fly with
  everyone else in the one shared world. Bots fill the empty spots so the sky is
  never lonely. Share the link and friends join the same world.

(Want to run it yourself for development or same-WiFi play? See
[Online play](#-online-play--one-shared-world) below.)

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
you play (Ctrl+C to stop).

### 🌍 Play worldwide — already deployed on Railway

The public game is **live** at
**https://pixel-planes-bryding-production.up.railway.app** (one address serves
the game *and* the live world over `wss://`). It's hosted on **Railway**, which is
connected to this GitHub repo, so **every push to `main` auto-redeploys** — there's
nothing to do but `git push`. The config (`railway.json` + the root `package.json`
`start` script) and the client's `SERVER_URL` (in `js/config.js`) already point
there. Setup notes for the account owner are in `FOR_BEN_PLEASE_READ.md`.

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

There are quick self-checks (no browser needed):

```
npm test        # server math: bot counts, name cleaning, anti-cheat (21 checks)
npm run validate # end-to-end protocol: join, see others, bots, combat, respawn
npm run smoke   # loads the client + runs the whole play path under a fake DOM
```
