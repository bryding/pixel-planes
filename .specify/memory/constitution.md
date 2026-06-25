<!--
Sync Impact Report
==================
Version change: (template / unversioned) → 1.0.0
Bump rationale: Initial ratification of the project constitution (first concrete version).

Principles defined:
  I.   Beginner-Friendly & Learning-First
  II.  Vanilla Simplicity — No Build Step
  III. Tweakable by Design
  IV.  Always Runnable, Commit Often
  V.   Game Feel First

Added sections:
  - Core Principles (5)
  - Technology Constraints
  - Development Workflow
  - Governance

Removed sections: none (template placeholders replaced)

Templates / artifacts reviewed for alignment:
  ✅ .specify/templates/plan-template.md   — generic "Constitution Check" gate; compatible
  ✅ .specify/templates/spec-template.md    — no mandatory sections conflict; compatible
  ✅ .specify/templates/tasks-template.md   — task categories compatible; testing kept SHOULD not MUST
  ✅ CLAUDE.md                              — runtime guidance file referenced below; consistent

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

### II. Vanilla Simplicity — No Build Step

The project runs by opening `index.html` in a browser. Nothing may break that.

- The game MUST use plain HTML5 Canvas + vanilla JavaScript with no frameworks.
- No build step, bundler, transpiler, or package-install requirement may be introduced.
- New code MUST load via plain `<script>` tags and run directly in the browser.

Rationale: Zero-tooling setup keeps the feedback loop instant and removes barriers for a
beginner; introducing a toolchain would trade learning time for configuration overhead.

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
- No external runtime dependencies, CDNs, or network calls are required to play the game.

## Development Workflow

- Build the game stage by stage, keeping it runnable at every stage (see Principle IV).
- Prefer offering the learner options and explaining *why* over silently making choices.
- Put any number a learner might want to change into `js/config.js` (see Principle III).
- Automated tests are OPTIONAL for this project; when added they MUST NOT introduce a build
  step or block the game from running by opening `index.html`.

## Governance

This constitution supersedes other conventions when they conflict. All work produced through
the Spec Kit workflow (specs, plans, tasks, implementation) MUST be checked against these
principles before completion.

- Amendments MUST be recorded in this file with an updated version and a Sync Impact Report.
- Versioning follows semantic versioning: MAJOR for principle removals/redefinitions, MINOR
  for added principles or materially expanded guidance, PATCH for clarifications and wording.
- Runtime development guidance for agents and contributors lives in `CLAUDE.md`; it MUST stay
  consistent with this constitution.

**Version**: 1.0.0 | **Ratified**: 2026-06-24 | **Last Amended**: 2026-06-24
