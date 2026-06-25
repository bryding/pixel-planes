# Phase 0 Research: Multiplayer Persistent World

All decisions are grounded in what already exists in the repo (a working Node + `ws` server, a
native-WebSocket client `net.js`, client-side bots in `enemy.js`) and the amended constitution
(v2.0.0: a server is allowed; the client stays buildless).

## D1. Network transport

- **Decision**: Keep the **browser-native `WebSocket` (client) + Node `ws` (server)** already in
  use. JSON text messages.
- **Rationale**: Already working and battle-tested in `js/net.js` (timeouts, auto-reconnect,
  https/ws mixed-content guard). Adds **no client dependency** and no build step, satisfying
  Principle II. `ws` is the only server dependency and is already declared.
- **Alternatives considered**: *Socket.IO* — friendlier API but pulls a client-side library
  (erodes "client stays vanilla") and adds weight; *WebRTC data channels* — peer-to-peer is far
  more complex (signaling, NAT) and unnecessary for a small authoritative world.

## D2. Authority model (who decides truth)

- **Decision**: **Hybrid, matching FR-014.** Each client simulates *its own* plane with the
  existing local physics and reports state ~18 Hz. The server **relays** those states to others and
  **simulates the bots authoritatively**. The server applies **light sanity checks** (reject
  teleports / impossible speed) but is not a full physics/hit authority.
- **Rationale**: Reuses the existing client flight feel untouched (Principle V), keeps the server
  small (Principle I), and gives one consistent set of bots for everyone. Cheating is possible but
  bounded — an explicitly accepted v1 tradeoff (spec Clarifications).
- **Alternatives considered**: *Full server authority* (server simulates every plane from inputs) —
  best anti-cheat but requires moving/duplicating all flight physics server-side and adds latency
  compensation; rejected as too much for v1. *Pure relay, no checks* (today's behavior) — simplest
  but trivially abusable and can't host shared bots; rejected.

## D3. Where bots run

- **Decision**: **On the server.** The world keeps `bots = max(0, TARGET_POPULATION − humansOnline)`
  and steps their AI each tick, broadcasting them like any other plane.
- **Rationale**: FR-004/005/006 require every client to see the *same* backfill. That is only
  possible if one place owns the bots. Server ownership also makes the count math trivially correct.
- **Implementation note**: The current bot "personality"/decision logic lives in `js/enemy.js`,
  which is browser code. Extract the pure decision math into a **DOM-free `bot-ai.js`** that both
  the server (for simulation) and the client (for single-player legacy / rendering) can load.
- **Alternatives considered**: *Client-side bots* (today) — each client would invent different
  bots; rejected as inconsistent. *One client acts as bot host* (the old "host" concept) — fragile
  (host leaves → bots vanish); rejected.

## D4. World model (rooms vs one world)

- **Decision**: **One implicit persistent world.** Drop the multi-room/host/password lobby from the
  online path. Connecting + setting a name puts you in the single world.
- **Rationale**: Spec FR-002 mandates exactly one shared world; the lobby/host machinery is now
  unused complexity. Simpler model is more beginner-readable (Principle I).
- **Migration**: The existing `quickjoin` already collapses toward "one shared room"; we formalize
  that to a single fixed world and remove `create`/`join`/`setmode`/host hand-off code paths (kept
  in git history). The legacy single-player game is retired but its rendering/physics/effects are
  reused by the networked client.

## D5. State sync & smoothing

- **Decision**: Server broadcasts a **snapshot of all planes ~18 Hz** (`NET_TICK_HZ`, configurable):
  per plane `{id, name, isBot, x, y, heading, vx, vy, health, alive, score}`. Clients render their
  own plane locally and **interpolate remote planes** between snapshots. Bullet fire is sent as
  discrete **fire events**; hit resolution stays lightweight for v1.
- **Rationale**: 18 Hz + interpolation is the standard cheap recipe for smooth-looking arcade
  movement (SC-002) without heavy prediction code. Discrete fire events are tiny and easy to reason
  about.
- **Alternatives considered**: Full client-side prediction + server reconciliation (overkill for
  v1); broadcasting every frame at 60 Hz (wasteful bandwidth, no real benefit with interpolation).

## D6. Score & names

- **Decision**: **Per-life score** (FR-013): the client tracks its own score, resets to 0 on death,
  and includes it in its state so others/leaderboard can show it. **Names** are length/charset
  limited on the server (reuse the existing `cleanName`/length cap), **no content filter** (FR-011).
- **Rationale**: Keeps the server from needing authoritative kill accounting in v1 while still
  meeting the spec; name handling already mostly exists server-side.

## D7. Hosting / deployment (Render → Railway)

- **Decision**: Deploy the existing server to the **Railway** project already connected to this
  GitHub repo (`pixel-planes-bryding-production.up.railway.app`). Add a Railway run configuration
  so it runs `node server/server.js`, and update `config.js` `SERVER_URL` to the Railway `wss://`
  address. Retire `render.yaml` as the primary (may keep as a documented alternative).
- **Rationale**: The user already has Railway wired to GitHub; the server already binds
  `process.env.PORT` and serves the static client, so it is Railway-ready with only a start/build
  declaration. One deployment serves game + socket over `wss://` (no mixed-content issue).
- **Open implementation detail (for tasks, not blocking)**: exact Railway config file form
  (`railway.json` vs root `package.json` start script vs `Procfile`) and whether the server's
  static root path resolves correctly when Railway's build root is the repo root — verify during
  the Railway cutover phase.

## D8. Single config source of truth (resolves analysis F1)

- **Decision**: Keep **all** gameplay tunables in `js/config.js` and let the Node server read that
  same file. Append `if (typeof module !== 'undefined') module.exports = CONFIG;` so the browser
  still gets the global `CONFIG` while the server can `require('../js/config.js')`. No separate
  server gameplay config.
- **Rationale**: FR-007 and Principle III require tuning values to live in `js/config.js`. Because
  bot population is server-authoritative, a mirrored server copy would become the *real* value and
  silently diverge (analysis finding F1). One shared file keeps the spec literally true and is the
  simplest thing for a beginner to reason about.
- **Alternatives considered**: A shared `config.json` read by both sides (extra fetch/loader on the
  browser, more moving parts); a separate `server/config.server.js` mirror (the rejected source of
  F1 drift).

## D9. Combat hit model (resolves analysis C1)

- **Decision**: **Shooter-detected hits** (FR-015). A client detects when *its own* bullets strike
  another plane and sends `hit {targetId}`. The server validates loosely + rate-limits, then: for a
  **bot** target it applies damage server-side; for a **human** target it forwards `hit` so that
  client damages itself. A destroyed plane triggers `down {victimId, byId}`, crediting the shooter
  (drives FR-013 scoring). The `fire` message stays separate and is visual-only.
- **Rationale**: Makes combat and scoring actually function without server-side trajectory
  re-simulation. Matches the accepted low-stakes anti-cheat posture (FR-014) and reuses the existing
  client bullet/collision code.
- **Alternatives considered**: Full server-authoritative hit detection (re-simulate every bullet —
  too heavy for v1); pure visual `fire` relay with no damage (the C1 gap — combat wouldn't work).

## Resolved unknowns

No `NEEDS CLARIFICATION` markers remain from the spec (resolved in `/speckit-clarify`). Remaining
items above are normal implementation details deferred to `/speckit-tasks`, not blocking gates.
