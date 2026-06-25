<!--
Sync Impact Report
==================
Version change: 1.0.0 → 2.0.0
Bump rationale: MAJOR — Principle II was redefined (a backward-incompatible governance change).
The hard "no build step / no server / no network" rule was relaxed to "simple by default; a
server or build step is permitted only when a specific feature genuinely needs it." Driven by the
002-multiplayer-world feature, which requires a server and networking.

Modified principles:
  II. "Vanilla Simplicity — No Build Step" → "Simple by Default, Tools Only When a Feature Needs Them"

Modified sections:
  - Technology Constraints — softened the "no dependencies / no network" bullet; added a
    server-code-stays-small-and-separated bullet.
  - Development Workflow — testing bullet no longer forbids a build step outright.

Principles unchanged: I (Beginner-Friendly), III (Tweakable), IV (Always Runnable), V (Game Feel)

Templates / artifacts reviewed for alignment:
  ✅ .specify/templates/plan-template.md   — generic "Constitution Check" gate; still compatible
  ✅ .specify/templates/spec-template.md    — no mandatory sections conflict; compatible
  ✅ .specify/templates/tasks-template.md   — compatible; tooling now allowed when justified
  ✅ specs/002-multiplayer-world/spec.md    — its dependency on this amendment is now satisfied
  ⚠ CLAUDE.md                              — "no build step" framing in project doc may want a
                                              light touch-up by the owner; not blocking

History:
  1.0.0 (2026-06-24) — Initial ratification (5 principles).
  2.0.0 (2026-06-24) — Relaxed Principle II to allow server/build tooling per feature need.

Deferred TODOs: none
-->

# Pixel Planes Constitution

Pixel Planes is a browser-based 2D pixel-art airplane combat game built as a learning
project. This constitution captures the non-negotiable principles that keep the project
approachable, hackable, and fun. Every spec, plan, and task MUST comply with it.

## Core Principles

### I. Beginner-Friendly & Learning-First

This is a learning project for a 12-year-old developer. The reader, not the machine, is the
primary audience for the code.

- Code MUST be readable and explained with friendly comments where intent is non-obvious.
- Any programming jargon introduced in explanations MUST be defined in plain language.
- Changes MUST be delivered in small steps — one idea at a time — never a large opaque rewrite.
- Comments MUST add meaning; single-line comments that merely restate the code are prohibited.

Rationale: The goal is for a learner to understand and extend the game, so clarity and
teachability outrank cleverness or brevity.

### II. Simple by Default, Tools Only When a Feature Needs Them

Simplicity is the default, not an absolute ban. The game starts as plain files you can open in a
browser, and stays that way until a feature genuinely requires more.

- The browser game MUST default to plain HTML5 Canvas + vanilla JavaScript with no frameworks
  and no build step.
- A build step, bundler, transpiler, package dependency, or a server MAY be introduced ONLY when
  a specific feature genuinely requires it (for example, multiplayer needs a server and
  networking).
- When such tooling is introduced, it MUST be justified in that feature's plan, kept as simple as
  practical, and MUST NOT make the rest of the codebase harder for a beginner to read or run.
- Any part of the game that can still run by opening files directly SHOULD continue to do so.

Rationale: The project now includes networked multiplayer, which cannot exist without a server.
Pretending otherwise would be dishonest. The value we actually care about is keeping things as
simple as the feature allows — so we permit tools deliberately and sparingly rather than banning
them outright.

### III. Tweakable by Design

The fun of this project is experimenting with numbers and instantly seeing the effect.

- All gameplay-tuning values (speed, gravity, throttle, colors, sizes) MUST live in
  `js/config.js`, not be hard-coded in logic files.
- Tunable values MUST be named clearly so their purpose is obvious without reading the logic.

Rationale: Centralizing the knobs lets the learner safely experiment and see cause and effect
without hunting through logic, which is where most of the learning happens.

### IV. Always Runnable, Commit Often

The game MUST stay playable at every step of development.

- Every change MUST leave `index.html` opening to a playable game — no broken intermediate states.
- Work MUST be committed after each working change or stage, with short, clear messages.
- Each commit SHOULD represent a safe point the project can be rolled back to.

Rationale: A always-working game keeps motivation high and guarantees there is always a safe
point to return to, which is essential when learning by experimentation.

### V. Game Feel First

Flying must feel satisfying before the game grows.

- Momentum-based flight (throttle, nose turning, gravity, carried momentum) MUST feel good
  before new features are added on top of it.
- When a feature and game feel conflict, game feel wins; tune the feel first.

Rationale: This is an arcade game inspired by BitPlanes/Sopwith — its value is the moment-to-
moment feel of flying, so polishing that is prioritized over feature count.

## Technology Constraints

- Rendering MUST target a low internal resolution (480×270) scaled up for a crisp, chunky
  pixel look.
- The project structure MUST stay simple and predictable: `index.html`, `css/style.css`, and
  `js/` modules (`config.js`, `input.js`, `plane.js`, `game.js`, and similar small files).
- The browser client SHOULD avoid external runtime dependencies and CDNs unless a feature needs
  them; networked features (e.g. multiplayer) MAY require a server and network connection.
- Server-side code, when present, MUST be kept small and readable and SHOULD live in a clearly
  separated folder so the client stays easy to find and understand.

## Development Workflow

- Build the game stage by stage, keeping it runnable at every stage (see Principle IV).
- Prefer offering the learner options and explaining *why* over silently making choices.
- Put any number a learner might want to change into `js/config.js` (see Principle III).
- Automated tests are OPTIONAL for this project; when added they SHOULD stay lightweight and
  MUST NOT block the browser game from running by opening `index.html`.

## Governance

This constitution supersedes other conventions when they conflict. All work produced through
the Spec Kit workflow (specs, plans, tasks, implementation) MUST be checked against these
principles before completion.

- Amendments MUST be recorded in this file with an updated version and a Sync Impact Report.
- Versioning follows semantic versioning: MAJOR for principle removals/redefinitions, MINOR
  for added principles or materially expanded guidance, PATCH for clarifications and wording.
- Runtime development guidance for agents and contributors lives in `CLAUDE.md`; it MUST stay
  consistent with this constitution.

**Version**: 2.0.0 | **Ratified**: 2026-06-24 | **Last Amended**: 2026-06-24
