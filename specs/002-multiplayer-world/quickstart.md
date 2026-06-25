# Quickstart: Multiplayer Persistent World

How to run and **validate** the feature end-to-end. This is a run/validation guide — implementation
detail lives in `tasks.md` and the code.

## Prerequisites

- Node.js ≥ 18 (`node -v`).
- Server dependency installed once: `cd server && npm install` (installs `ws`).

## Run locally (one address, no https/ws mismatch)

```bash
node server/server.js
```

Then open **http://localhost:8080** in a browser. The server serves the game files *and* hosts the
WebSocket on the same origin, so the client connects with no mixed-content problem.

> For local testing, point the client at the local server (e.g. `ws://localhost:8080`) rather than
> the deployed `wss://` URL — `js/net.js` already explains this mismatch if you get it wrong.

## Validation scenarios (map to spec acceptance criteria)

### V1 — Join the world (User Story 1, SC-001)
1. Open the app → you are asked for a **name** before any gameplay.
2. Type a name, click **Join Game** → you are flying within ~15 seconds.
   - ✅ Pass: you control a plane in a shared world (not a private game).

### V2 — See other players live (User Story 2, SC-002)
1. Open a **second** browser window, join with a different name.
2. Move one plane.
   - ✅ Pass: the other window shows that plane moving smoothly, labeled with its name.
3. Close one window.
   - ✅ Pass: that plane disappears from the other within a few seconds (FR-010).

### V3 — Bots backfill (User Story 3, SC-003/SC-004)
1. Join as the **only** human.
   - ✅ Pass: `TARGET_POPULATION − 1` bot planes are flying (default → 9 bots + you = 10).
2. Add humans one at a time.
   - ✅ Pass: visible bot count drops by exactly one per human (10 − N).
3. Confirm bots are **not** visually marked as bots (they blend in).

### V4 — Combat, death, auto-respawn (User Story 4, SC-005)
1. Let a bot or player shoot you down.
   - ✅ Pass: you explode, then **auto-respawn** in the same world after a short delay, **without**
     returning to the name screen; your score resets to 0 (SC-008).

### V5 — Tweakability (SC-006)
1. Change `TARGET_POPULATION` in `js/config.js` (the **single** source — the server reads this same
   file), restart the server.
   - ✅ Pass: the filled world size changes on the next run with no other code edits.

## Deploy to Railway (production)

1. Railway is already connected to this GitHub repo. Ensure the run config starts the server
   (`node server/server.js`) and that Railway's `PORT` env var is used (the server already reads
   `process.env.PORT`).
2. Push to the deployed branch → Railway auto-builds and serves at
   `https://pixel-planes-bryding-production.up.railway.app`.
3. Set `SERVER_URL` in `js/config.js` to the matching `wss://pixel-planes-bryding-production.up.railway.app`.
4. Open the public URL in two devices and re-run V1–V4.
   - ✅ Pass: players on different networks share one world; bots backfill when few humans are on.

## Notes

- Reference `contracts/websocket-protocol.md` for the exact message shapes and the testable
  invariants (e.g. `planeCount == humans + max(0, target − humans)`).
- Reference `data-model.md` for entity fields and lifecycle transitions.
