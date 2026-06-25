---

description: "Task list for Multiplayer Persistent World"
---

# Tasks: Multiplayer Persistent World

**Input**: Design documents from `/specs/002-multiplayer-world/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/websocket-protocol.md, quickstart.md

**Tests**: Not requested as TDD. Per the constitution, automated tests are OPTIONAL; the primary
validation is the manual `quickstart.md` scenarios. A couple of optional pure-function Node checks
appear in Polish.

**Organization**: Grouped by the 4 user stories so each is an independently testable increment.
This feature *evolves* the existing Node + `ws` server and native-WebSocket client — many tasks
edit existing files (`server/server.js`, `js/net.js`, `js/game.js`) rather than create new ones.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1–US4 (user-story phases only)

## Path Conventions

Two-part web layout (per plan.md): vanilla client in repo root (`index.html`, `js/`), Node server
in `server/`. The server also serves the static client.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the tunable knobs and confirm dependencies before touching netcode.

- [X] T001 [P] Make `js/config.js` the SINGLE source of tunables for browser AND Node: add `TARGET_POPULATION` (10), `HARD_CAP` (32), `NET_TICK_HZ` (18), `RESPAWN_DELAY`; keep `SERVER_URL` (Railway value set in T028); append `if (typeof module !== 'undefined') module.exports = CONFIG;` so the server can `require` it (resolves analysis F1)
- [X] T002 [P] Point the server at the shared config in `server/server.js` / `server/world.js`: `require('../js/config.js')` for `TARGET_POPULATION`, `HARD_CAP`, `NET_TICK_HZ` — NO separate server gameplay config file
- [X] T003 Verify server dependency installs cleanly: `cd server && npm install` (confirms `ws` present)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The single-world transport everything else rides on — server world + snapshot loop,
and a slimmed client net layer. NO user story can be demoed until this is done.

**⚠️ CRITICAL**: Blocks all user stories.

- [X] T004 In `server/server.js`, collapse the lobby into ONE persistent world: remove `create`/`join`/`quickjoin`/`setmode`/host hand-off code paths; keep connection handling, static file serving, and heartbeat; add a single in-memory world object holding a `players` map (per data-model.md)
- [X] T005 In `server/server.js`, implement `hello` handling per contract: clean + length-cap the name (no content filter, FR-011), add the player to the world, reply `welcome {id, target, tickHz}`
- [X] T006 [P] Add the snapshot broadcast loop in `server/world.js` (new): every `tickHz`, build the `planes` array from players' `lastState` and broadcast `{t:"snapshot", planes}` to all clients (per websocket-protocol.md)
- [X] T007 In `server/server.js`, handle inbound `state` (store `lastState`) and disconnect/`close` (remove player, broadcast `player-left {id}` within a few seconds, FR-010)
- [X] T008 Slim down `js/net.js`: remove lobby/host/password methods (`createServer`/`joinServer`/`quickJoin`/`setMode`); keep connect/timeout/reconnect; on open send `hello {name}`; handle `welcome`, `snapshot`, `player-left`, `denied` via callbacks
- [X] T009 In `js/game.js`, maintain a client-side map of remote planes from `snapshot` messages with a short interpolation buffer (smooth movement between ticks, per research D5)

**Checkpoint**: Server runs one world and broadcasts snapshots; client connects and ingests them.

---

## Phase 3: User Story 1 - Enter a name and join the live world (Priority: P1) 🎯 MVP

**Goal**: Open app → enter name → flying in the shared world within ~15s.

**Independent Test**: Open the app fresh, enter a name, click Join, confirm you control a plane in
a shared world (quickstart V1).

- [ ] T010 [US1] Replace the current entry/"Click to Play" gate with a name-entry screen in `index.html` + `js/game.js`: a text field + **Join Game** button, with client-side length/charset capping
- [ ] T011 [US1] On Join in `js/game.js`: call `Net.setName`/`Net.connect(CONFIG.SERVER_URL)`, show connecting/error states, and transition to the flying state once `welcome` arrives
- [ ] T012 [US1] On join in `js/game.js`, spawn the local player plane (reuse `js/plane.js`) and start sending its own `state` at `NET_TICK_HZ`

**Checkpoint**: A player can name themselves and fly in the one shared world (MVP demoable).

---

## Phase 4: User Story 2 - See other players live (Priority: P1)

**Goal**: Every connected player sees others move in near-real-time, name-labeled.

**Independent Test**: Two browsers, move one plane, the other sees it move smoothly with the right
name; closing one removes its plane (quickstart V2).

- [ ] T013 [US2] Render remote planes from the interpolated snapshot map in `js/game.js`, reusing the existing plane drawing in `js/plane.js`/`js/sprites.js`
- [ ] T014 [US2] Draw each remote plane's name label above it in `js/game.js`
- [ ] T015 [US2] Remove planes promptly in `js/game.js` on `player-left` and when an id drops out of snapshots (FR-010)

**Checkpoint**: Multiple players see each other fly smoothly with names.

---

## Phase 5: User Story 3 - Bots backfill empty slots (Priority: P2)

**Goal**: Server-run bots keep the world full to `TARGET_POPULATION`; count = max(0, target − humans).

**Independent Test**: Join as the only human → see `target − 1` bots; add humans → bot count drops
one per human; bots are not visually marked (quickstart V3, SC-003/SC-004).

- [ ] T016 [P] [US3] Extract the DOM-free bot decision logic from `js/enemy.js` into `js/bot-ai.js` (no canvas/DOM/global refs), and have `js/enemy.js` call it so legacy behavior is unchanged
- [ ] T017 [US3] In `server/world.js`, simulate bots: maintain `bots = max(0, targetPopulation − players.size)`, step each bot via `js/bot-ai.js`, and assign ordinary-looking names (blend in, per spec Clarification)
- [ ] T018 [US3] Include bots in the snapshot `planes` array (same `PlaneState` shape, NO `isBot` flag) and recompute bot count on every join/leave in `server/world.js`
- [ ] T019 [US3] Confirm the client in `js/game.js` renders bots identically to humans (no special-casing); adjust only if bots reveal themselves

**Checkpoint**: The sky is never empty; bot math is correct and observable.

---

## Phase 6: User Story 4 - Combat, death, and auto-respawn (Priority: P2)

**Goal**: Free-for-all combat (shooter-detected hits, FR-015), explode on death, auto-respawn in
place, per-life score; server applies light sanity checks.

**Independent Test**: Get shot down → explode → auto-respawn in the same world after a short delay
with score reset to 0, never sent to the name screen (quickstart V4, SC-005/SC-008).

- [ ] T020 [US4] Fire visuals relay in `js/game.js` + `server/server.js`: client sends `fire {kind,x,y,heading}` on shooting; server broadcasts; other clients render the shot + SFX (reuse `js/bullet.js`/`js/missile.js`/`js/audio.js`). Visual only — damage is handled by `hit` (T021)
- [ ] T021 [US4] Hit detection + report in `js/game.js`: detect when YOUR OWN bullets strike another plane (using snapshot positions) and send `hit {targetId, kind}` (FR-015, contract)
- [ ] T022 [US4] Server hit handling in `server/world.js` + `server/server.js`: validate loosely + rate-limit; if `targetId` is a bot apply damage server-side; if human, forward `hit {targetId, byId}`; on destruction broadcast `down {victimId, byId}`
- [ ] T023 [US4] Damage + death + auto-respawn in `js/game.js`: on inbound `hit` apply damage to own plane; at 0 health → explosion (`js/explosion.js`), mark dead, auto-respawn after `RESPAWN_DELAY` at a safe spawn (spawn protection), no name-screen return (FR-009)
- [ ] T024 [US4] Per-life score in `js/game.js`: increment when a `down` credits you, include `score` in outbound `state`, reset to 0 on own death; display own score (and a simple live scoreboard) (FR-013, SC-008)
- [ ] T025 [US4] Light sanity checks in `server/world.js`: reject/clamp inbound `state` with implausible position delta or speed before broadcasting (FR-014)
- [ ] T026 [US4] Hard cap in `server/server.js`: refuse connections beyond `HARD_CAP` humans with `denied {msg}`; client shows the message (websocket-protocol invariant 5)

**Checkpoint**: All four user stories work; the world is a live free-for-all with backfill bots.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T027 [P] Remove now-dead single-player-only entry paths and leftover lobby code; confirm the game still runs by opening the served page (Principle IV)
- [ ] T028 Railway cutover: add a Railway run config (`railway.json` or root `Procfile`/`package.json` start → `node server/server.js`), set `js/config.js` `SERVER_URL` to `wss://pixel-planes-bryding-production.up.railway.app`, and retire `render.yaml` as the primary deploy
- [ ] T029 [P] (Optional) Pure-function Node checks in `server/` for the bot-count math, the sanity-check function, and the `hit` validation (no framework; a plain `node` assert script)
- [ ] T030 Run all `quickstart.md` validations V1–V5 locally, then V (Railway) on the live URL across two devices
- [ ] T031 [P] Update `README.md` / `FOR_BEN_PLEASE_READ.md` with how to run and deploy the multiplayer world

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: after Setup. BLOCKS all user stories.
- **User Stories (Phases 3–6)**: all require Foundational. US1 is the MVP and should land first
  because US2–US4 are easiest to demo once you can join. After Foundational, US2/US3/US4 are
  largely independent of each other and can be parallelized by different people.
- **Polish (Phase 7)**: after the desired user stories; T028 (Railway) can be done any time after
  US1 works locally, but is grouped here as the production cutover.

### User Story Dependencies

- **US1 (P1)**: needs Foundational only — MVP.
- **US2 (P1)**: needs Foundational (snapshot ingest from T009); independent of US1's UI.
- **US3 (P2)**: needs Foundational + the `bot-ai.js` extraction (T016); independent of US1/US2.
- **US4 (P2)**: needs Foundational; combat relay/score independent of US2/US3.

### Within Each User Story

- Server changes before the client behavior that depends on them.
- Commit after each task or logical group (Principle IV — stay runnable).

### Parallel Opportunities

- Setup: T001 + T002 in parallel (different files).
- Foundational: T006 (`server/world.js`) can progress alongside client T008/T009 edits.
- Across stories (post-Foundational): US2, US3, US4 can be staffed in parallel.
- Polish: T027, T029, T031 in parallel.

---

## Parallel Example: Setup

```bash
# Different files, no dependency — do together:
Task: "Make js/config.js the single source of tunables (browser + Node)"   # T001
Task: "Point the server at ../js/config.js"                                # T002
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 Setup → 2. Phase 2 Foundational (critical) → 3. Phase 3 US1.
4. **STOP & VALIDATE** quickstart V1 (you can name yourself and fly in one shared world).
5. Optionally do T028 early to demo it live on Railway.

### Incremental Delivery

Foundational → US1 (MVP, join) → US2 (see others) → US3 (bots backfill) → US4 (combat/respawn).
Each adds value without breaking the last; deploy/demo at any checkpoint.

---

## Notes

- [P] = different files, no dependency. Many netcode tasks share `server/server.js` or `js/game.js`,
  so they are intentionally NOT marked [P].
- The legacy single-player systems (rendering, physics, effects, bot AI) are *reused*, not deleted,
  per the plan; only the lobby/host model and the single-player-only entry are retired.
- Verify each checkpoint with the matching `quickstart.md` scenario before moving on.
