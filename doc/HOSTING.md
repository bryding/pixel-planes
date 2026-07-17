# Hosting & Deployment

The Pixel Planes server is hosted on **Railway**. Everything runs in one place, and deploys automatically when you push to GitHub.

## The live game

**Public URL:** `https://pixel-planes-bryding-production.up.railway.app`

- The chooser ("How do you want to play?"): `https://pixel-planes-bryding-production.up.railway.app/`
- Single-player: `.../solo/`
- Online multiplayer: `.../online/`

(Note: the online client also works over plain `http://` on a local network, but the public link is `https://` for security.)

## How deployment works

1. **Push to GitHub:** When you push to the `main` branch on GitHub, Railway automatically pulls the latest code.
2. **Build:** Railway reads `railway.json` (the build config) and uses NIXPACKS to build the project.
3. **Start:** The server starts with the command in `railway.json`: `node server/server.js`.
4. **Go live:** Within ~1–2 minutes, the new version is running.

No manual steps, no buttons to click — it's automatic.

### The Railway config (`railway.json`)

```json
{
  "build": { "builder": "NIXPACKS" },
  "deploy": {
    "startCommand": "node server/server.js",
    "restartPolicyType": "ON_FAILURE"
  }
}
```

This tells Railway to:
- Build with NIXPACKS (it sees `package.json` and runs `npm install` — just the `ws` package).
- Start the game server (it listens on Railway's `PORT`, or 8080 locally).

### Node dependencies (`package.json`)

```json
{
  "dependencies": {
    "ws": "^8.18.0"
  }
}
```

That's all the server needs: the `ws` library for WebSockets.

## Local testing

### Run the server locally

From the repo folder:

```bash
node server/server.js
```

This starts the server on `http://localhost:8080` (it prints the address,
including your same-WiFi IP, when it starts).

### Single-player (local server)

Open `http://localhost:8080` in your browser — you get the chooser; click
🤖 Single Player. Fly around, test changes.

### Online (same WiFi, local server)

1. Run `node server/server.js` on one computer.
2. On that computer, open `http://localhost:8080/online/`.
3. On another computer on the same WiFi, open `http://[YOUR-COMPUTER-IP]:8080/online/` (the server prints the IP when it starts).
4. You'll see each other's planes in real-time.

### Offline (no server)

You can also just double-click `solo/index.html` to play single-player offline (no internet, no server). Changes to `solo/js/` files won't take effect without a browser refresh.

## If the game is down or broken

**Check the Railway dashboard:**

1. Go to [Railway dashboard](https://railway.app) (you need a Railway account).
2. Find the Pixel Planes service.
3. Click **Deployments** to see the history (latest at the top).
4. If a recent deploy shows a red **X**, it crashed. Click it to see logs.
5. Look for error messages in the logs and fix the issue on your local machine, then push to `main` again.

**Common issues:**

- **Syntax error in `server.js`:** The server crashes on start. Fix the error and push.
- **Port already in use:** Another process is using port 8080. Stop it (`lsof -ti:8080 | xargs kill` on Mac/Linux) or change the port in `server.js`.
- **Module not found:** A required file is missing or has a typo. Check the error in the logs.

## Important: the server is the web root

The Node server (`server.js`) serves files itself (plain `http` +
`fs.readFile`) with the repo folder as its web root:

```javascript
const ROOT = path.join(__dirname, '..');   // the whole repo folder
```

This means **every file in the repo folder is served to the browser**. That includes:

- `index.html`, the `solo/` and `online/` folders ✅
- `server/server.js`, `server/world.js`, docs, specs — **all publicly readable** ⚠️

This is fine for a learning project. If you add secrets (API keys, passwords), put them in an environment variable (Railway can set those in Settings → Variables) and load them in `server.js`, not in files checked into Git.

## Automatic deploys (the GitHub connection)

Railway is connected to the GitHub repo `bryding/pixel-planes` on the `main` branch. Every push to `main` triggers a new deploy. You don't need to do anything else.

If you need to disable auto-deploy or deploy a different branch, go to the Railway dashboard and check Settings → Deploy on Push.

## Reverting to an old version

If a deploy breaks the game:

1. Go to Railway dashboard → Deployments.
2. Find an older, working deployment (look for a green checkmark).
3. Click it and select **Rollback** (if available).
4. Or just fix the bug on your local machine, push to `main`, and wait ~2 minutes.

(Note: rolling back doesn't undo your Git commits — it just re-runs an older deployment. Git history stays the same.)

## Adding or updating dependencies

If you add a new npm package:

1. Run `npm install <package-name>` on your local machine. This updates `package.json` and `package-lock.json`.
2. Commit both files.
3. Push to `main`.
4. Railway will run `npm install` again during the build, pulling in the new package.

## Manual builds / testing the Railway config locally

You can test that `railway.json` works by installing NIXPACKS and building locally (not usually needed):

```bash
npm install -g @nixpacks/cli
nixpacks build . --run
```

But it's faster to just push to `main` and watch the Railway dashboard for ~2 minutes.
