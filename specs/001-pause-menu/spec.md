# Feature Specification: Pause Menu

**Feature Branch**: `001-pause-menu`

**Created**: 2026-06-24

**Status**: Draft

**Input**: User description: "Pause menu for Pixel Planes. When the player presses the P key (or the Escape key) during play, the game pauses: all motion and gameplay (planes, bullets, physics, spawning) freezes, the screen dims with a translucent overlay, and the word PAUSED plus a short hint is shown centered. Pressing P or Escape again resumes exactly where it left off with no lost state. While paused, sound effects do not play."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Pause and resume in place (Priority: P1)

A player who is mid-flight needs to step away or take a breather. They press a single key and
the whole game freezes; pressing the same key brings the action back exactly as it was, with no
plane lost and no enemy progress made while they were away.

**Why this priority**: This is the entire purpose of the feature — without freeze-and-resume
there is no pause menu. It is the minimum viable, independently demonstrable slice.

**Independent Test**: Start the game, fly into a moving situation (enemies and bullets on
screen), press the pause key, confirm nothing moves for several seconds, press it again, and
confirm everything continues from the identical positions and speeds.

**Acceptance Scenarios**:

1. **Given** the game is actively playing with planes and bullets in motion, **When** the player
   presses the pause key, **Then** all planes, bullets, physics, and enemy spawning stop moving.
2. **Given** the game is paused, **When** the player presses the pause key again, **Then** play
   resumes from the exact positions, velocities, and timers that were frozen, with no lost state.
3. **Given** the game is paused, **When** several seconds pass without input, **Then** no enemy
   spawns, no bullet travels, and no score or timer advances.

---

### User Story 2 - Clear paused indication (Priority: P2)

A player needs to instantly recognize that the game is paused (and is not frozen/crashed) and
know how to get back in.

**Why this priority**: Without a visible indicator a frozen screen is ambiguous; this makes the
pause state legible and tells the player how to resume. It depends on Story 1 existing.

**Independent Test**: Pause the game and visually confirm a dimming overlay covers the play
field with centered "PAUSED" text and a short resume hint, all in the game's pixel-art style.

**Acceptance Scenarios**:

1. **Given** the game is playing, **When** the player pauses, **Then** a translucent overlay dims
   the play field and the word "PAUSED" appears centered.
2. **Given** the game is paused, **When** the overlay is shown, **Then** a short hint such as
   "press P to resume" is shown beneath the PAUSED text in the same pixel-art style.
3. **Given** the game resumes, **When** play continues, **Then** the overlay and text are removed
   and the unobstructed play field is visible again.

---

### User Story 3 - Silence while paused (Priority: P3)

A player who pauses should not keep hearing gameplay sounds firing in the background.

**Why this priority**: A polish/correctness detail that improves the pause experience but is not
required to demonstrate pause/resume. Lowest priority of the three.

**Independent Test**: Trigger a continuous or repeating sound effect, pause, and confirm no new
gameplay sound effects play until the game is resumed.

**Acceptance Scenarios**:

1. **Given** gameplay sounds would normally play, **When** the game is paused, **Then** no new
   gameplay sound effects are produced.
2. **Given** the game is resumed, **When** play continues, **Then** sound effects play normally
   again.

---

### Edge Cases

- What happens when the pause key is pressed rapidly multiple times in a row? The game MUST end
  in a consistent state (paused after an odd number of presses, playing after an even number),
  with no double-applied or skipped frames.
- What happens when the player pauses at the exact moment of an event (an explosion, the player
  being hit, or ejecting)? The event MUST be frozen mid-state and complete correctly on resume,
  not be skipped or duplicated.
- What happens if the pause key is pressed when the game is not in active play (e.g., on the
  start/"Click to Play" gate or a game-over screen)? Pause MUST have no effect in those states.
- What happens if the browser tab loses focus while paused? The game MUST remain paused and not
  silently resume.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The game MUST toggle between playing and paused when the player presses the P key
  or the Escape key during active play.
- **FR-002**: While paused, the system MUST freeze all gameplay motion and progression — planes,
  bullets, physics/momentum, enemy spawning, timers, and scoring.
- **FR-003**: Resuming MUST continue from the exact frozen state (positions, velocities, timers,
  health, score) with no loss, reset, or skip of game state.
- **FR-004**: While paused, the system MUST display a translucent dimming overlay over the play
  field with the word "PAUSED" centered and a short resume hint, rendered in the game's
  pixel-art style.
- **FR-005**: On resume, the system MUST remove the overlay and indicator so the play field is
  fully visible again.
- **FR-006**: While paused, the system MUST NOT produce new gameplay sound effects.
- **FR-007**: The pause toggle MUST only act during active play and MUST have no effect on the
  start gate, game-over, or other non-playing screens.
- **FR-008**: Player-tunable values for this feature (overlay dimness level and the displayed
  text strings) MUST live in the project's central tuning configuration so they can be changed
  without editing game logic.

### Key Entities

- **Pause State**: A single on/off condition representing whether the game is currently paused.
  It gates whether gameplay updates run and whether the overlay is drawn.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A player can pause and resume using a single key press each way, 100% of the time,
  with the game continuing from the identical on-screen state.
- **SC-002**: While paused, zero gameplay objects change position and zero new enemies spawn over
  any length of paused time.
- **SC-003**: The paused state is visually unambiguous — a test player shown a paused screen
  identifies it as "paused" (not crashed/frozen) within 2 seconds.
- **SC-004**: No new gameplay sound effects are heard at any point while the game is paused.
- **SC-005**: Overlay dimness and the pause text can be changed by editing only the central
  tuning configuration, with the change visible on the next run and no logic edits required.

## Assumptions

- "During play" means the active gameplay state that exists after the player has passed the
  "Click to Play" gate and before any game-over state.
- Both P and Escape act as the same toggle (press to pause, press again to resume); the user
  explicitly requested both keys.
- The overlay dims but does not fully hide the play field, so the player can see the frozen
  scene behind the "PAUSED" text.
- Pausing affects only gameplay sound effects; there is no separate background-music system to
  consider in the current game.
- This feature targets the existing single-player game; multiplayer/split-screen pausing is out
  of scope for this spec.
