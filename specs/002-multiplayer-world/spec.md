# Feature Specification: Multiplayer Persistent World

**Feature Branch**: `002-multiplayer-world`

**Created**: 2026-06-24

**Status**: Draft

**Input**: User description: "we need to implement basic multiplayer. we can just have one persistent world running all the time that players can join. i have a railway setup that i have connected this github too (pixel-planes-bryding-production.up.railway.app), although we will need to setup the server and everything still. when players go to the app, it should ask them to enter a name and then join the game, kind of like agar.io"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Enter a name and join the live world (Priority: P1)

A player opens the app and is asked for a name, types it, and clicks to join. Within moments
they are flying their plane in one shared world alongside everyone else who is online, with
AI-controlled planes filling any empty slots so the sky is never empty.

**Why this priority**: This is the heart of the feature — a name-gated join into a single shared
world. Without it there is no multiplayer. It is the minimum viable, demonstrable slice.

**Independent Test**: Open the app fresh, enter a name, click join, and confirm you are flying in
the world. Open a second browser, join with a different name, and confirm both planes appear in
the same world.

**Acceptance Scenarios**:

1. **Given** a player opens the app, **When** the app loads, **Then** they are prompted to enter a
   name before any gameplay begins.
2. **Given** a player has entered a name, **When** they choose to join, **Then** their plane
   appears in the shared world and they can fly it immediately.
3. **Given** the world is already running, **When** a new player joins, **Then** they enter the
   same ongoing world (not a new private game) and can see other planes that are present.

---

### User Story 2 - See other players live (Priority: P1)

While flying, a player sees every other connected player's plane moving in real time, each
labelled with that player's name, so the world feels alive and shared.

**Why this priority**: A shared world that doesn't show the other people in it isn't multiplayer.
This is co-essential with Story 1 for a believable experience.

**Independent Test**: With two players connected, move one plane and confirm the other player sees
that movement happen smoothly and sees the correct name label.

**Acceptance Scenarios**:

1. **Given** two or more players are connected, **When** one moves their plane, **Then** the other
   players see that plane move in near-real-time.
2. **Given** other players are present, **When** a player looks at them, **Then** each plane shows
   the owning player's name.
3. **Given** a player disconnects (closes the tab), **When** they leave, **Then** their plane is
   promptly removed from everyone else's view.

---

### User Story 3 - Bots backfill empty slots (Priority: P2)

To keep the world full and fun even when few humans are online, AI-controlled planes fill the
empty slots. As more humans join, the number of bots goes down one-for-one, and as humans leave,
bots come back to refill.

**Why this priority**: Makes the world enjoyable at any population, including a single player
alone. Important for feel but the world still functions for humans without it.

**Independent Test**: Join as the only player and confirm the configured number of bot planes
(default 10, minus you) are present and flying. Add more players and confirm the bot count drops
by one per player.

**Acceptance Scenarios**:

1. **Given** no human players are online, **When** the world is running, **Then** the configured
   target number of planes (default 10) are present as bots, flying and fighting.
2. **Given** the target population is 10, **When** N human players are online (N ≤ 10), **Then**
   exactly 10 − N bot planes are present.
3. **Given** the target population is reached or exceeded by humans, **When** 10 or more humans are
   online, **Then** zero bots are present; additional humans may still join.
4. **Given** humans leave the world, **When** the population drops below target, **Then** bots are
   added back to refill up to the target.

---

### User Story 4 - Combat, death, and auto-respawn (Priority: P2)

Players dogfight each other and the bots. When a player is shot down they briefly explode and
then automatically respawn back in the world after a short delay, without being kicked to a menu,
so the action keeps flowing.

**Why this priority**: Combat is the point of the game; respawn keeps players in the action. Comes
after join/visibility because those must exist first.

**Independent Test**: Get shot down (by a bot or another player) and confirm you explode, then
reappear flying in the same world a couple of seconds later with no menu interruption.

**Acceptance Scenarios**:

1. **Given** a player is flying, **When** their plane is destroyed, **Then** it explodes and the
   player is removed from active flight momentarily.
2. **Given** a player has just been shot down, **When** a short delay passes, **Then** they
   automatically respawn in the same world at a safe location, keeping their name.
3. **Given** a player respawns, **When** they return, **Then** they are not sent back to the
   name-entry screen.

---

### Edge Cases

- **Blank or over-long name**: A player who submits an empty name MUST be given a sensible default
  or asked again; over-long names MUST be limited to a maximum length so labels stay readable.
- **Duplicate names**: Two players MAY choose the same name; the system MUST still treat them as
  distinct participants and not merge or confuse their planes.
- **Abrupt disconnect**: If a player closes the tab or loses connection, their plane MUST be
  removed within a few seconds and a bot MUST be allowed to refill the slot if below target.
- **Join at full target**: A player joining when the target population is already met by humans
  MUST still be able to join; the world simply runs with zero bots.
- **Server restart**: If the always-on world restarts, connected players MUST be returned to a
  usable state (re-prompted to join) rather than left on a broken screen.
- **Spawn protection**: A freshly respawned or newly joined plane SHOULD appear at a location that
  does not cause an instant, unavoidable death.
- **Empty world**: With zero humans online, the world MUST keep running with the full set of bots.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST prompt every visitor to enter a name before entering gameplay, and the
  primary entry path MUST be name-entry → join the shared world (the multiplayer world is the
  game; the previous offline single-player mode is retired).
- **FR-002**: There MUST be exactly one shared, persistent world that runs continuously and that
  all players join; joining MUST place the player into that ongoing world rather than a private
  instance.
- **FR-003**: Each connected player MUST see all other connected players' planes update in
  near-real-time, each labelled with the owning player's chosen name.
- **FR-004**: The world MUST maintain a configurable target plane population (default 10) by
  filling empty slots with AI-controlled bot planes.
- **FR-005**: The number of bots MUST equal the target population minus the number of connected
  human players, never below zero; when humans meet or exceed the target, there MUST be zero bots.
- **FR-006**: Bots MUST be added back automatically when the population falls below target (e.g.
  players leave) and removed as human players take their slots.
- **FR-007**: The target population value MUST live in the project's central tuning configuration
  (`js/config.js`) so it can be changed easily without editing game logic.
- **FR-008**: Players MUST be able to engage in combat (shoot/be shot) with other players and with
  bots in the shared world.
- **FR-009**: When a plane is destroyed, the system MUST show an explosion and then automatically
  respawn that human player in the same world after a short, configurable delay, without returning
  them to the name-entry screen.
- **FR-010**: When a player disconnects, the system MUST remove their plane from all other players'
  views within a few seconds.
- **FR-011**: Player names MUST be validated to a maximum length and a non-empty value (with a
  sensible default substituted if blank).
- **FR-012**: Player identity MUST be ephemeral session-based identity only — no accounts,
  passwords, or login are required; a name plus a live connection is sufficient to play.

### Key Entities

- **World**: The single, always-running shared space. Holds the current set of planes and the
  configurable target population. Continues running with zero humans online.
- **Player**: A connected human participant — has a chosen name, a live plane, a score for the
  current life, and an alive/respawning state. Ephemeral; exists only while connected.
- **Bot**: An AI-controlled plane that exists only to backfill empty slots up to the target
  population; behaves like an enemy plane in combat.
- **Plane State**: The per-plane data shared with everyone — position, heading, velocity/momentum,
  health, and owner label — so every client can draw every plane.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new visitor can go from opening the app to flying in the shared world in under 15
  seconds (enter name → join → in control).
- **SC-002**: With two or more players connected, each player sees others' movements update
  continuously enough to look like smooth flight, with no perceptible teleporting under normal
  conditions.
- **SC-003**: With zero humans online, the world always shows the configured target number of bot
  planes (default 10) flying.
- **SC-004**: When the Nth human joins (for N from 1 to the target), the number of visible bots is
  exactly target − N, observable in the world.
- **SC-005**: A shot-down player is flying again within a few seconds via automatic respawn, never
  bounced back to the name-entry screen.
- **SC-006**: Changing the target-population number in the central configuration changes the
  world's filled size on the next run, with no other code edits required.
- **SC-007**: The shared world supports at least the target population of simultaneous human
  players (default 10) flying and fighting together without noticeable degradation.

## Assumptions

- **Persistence meaning**: "Persistent world" means the world/server runs continuously and is
  always joinable; individual player identity and score are ephemeral (reset between sessions /
  on the configured death behavior). No long-term saved accounts or stats are in scope for v1.
- **Free-for-all combat**: Everyone (humans and bots) can damage everyone else; there are no teams
  in v1.
- **Score handling**: Each player has a live score for their current life; the exact persistence of
  score across respawns is a tuning detail to be decided in planning, defaulting to a simple live
  scoreboard.
- **Hard capacity cap**: Beyond the bot-backfill target, a reasonable maximum number of concurrent
  players (a configurable cap) protects the server; the default cap is a planning detail and is set
  comfortably above the default target of 10.
- **Hosting**: The always-on world is hosted on the existing Railway deployment
  (pixel-planes-bryding-production.up.railway.app), connected to this GitHub repo; standing up the
  actual server is part of implementation, not yet built.
- **Client stays approachable**: Per the project constitution (as amended to permit a server and
  build step where a feature needs them), the browser client should remain as simple and readable
  as practical; the server is new and kept as simple as possible.

## Dependencies

- A running server process hosting the shared world and relaying player/bot state between clients.
- The existing Railway hosting environment connected to this repository.
- An amendment to the project constitution (Principle II) permitting a server and an optional build
  step for features that require them — chosen during clarification and to be applied via
  `/speckit-constitution`.
