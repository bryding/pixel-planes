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

### 1. Install Node.js (one time)
Download and install it from **https://nodejs.org** (the "LTS" button).

### 2. Start the server
Open a terminal in this project and run:

```
cd server
npm install        # one time — downloads the 'ws' library
npm start          # starts the server on port 8080
```

You should see: `Pixel Planes server listening on port 8080`. Leave it running.

### 3. Point the game at it
In **`js/config.js`**, set `SERVER_URL`:

- **Same computer:** `ws://localhost:8080`
- **Other devices on your home WiFi:** use your computer's local IP, e.g.
  `ws://192.168.1.50:8080` (find it in your WiFi settings).
- **Worldwide:** deploy the `server/` folder to a free host like Render,
  Railway, or Fly.io, then use its address (starts with `wss://`).

### 4. Play
Press **ESC** → **Create Server** (pick a name + optional password) or
**Server List** (join one). The person who creates a server is the **host** —
only they get the Mode and Modifier menus.

> Heads-up: right now this is the **lobby** — creating, listing, joining, and
> host control all work. *Seeing each other fly in the same sky* is the next
> piece we're building on top of this.
