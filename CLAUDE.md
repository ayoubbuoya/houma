# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this project is

**Houma (حومة): Streets of Tunisia.** A small GTA-style 3D open-world game in the browser, set in a fictional Tunisian city (downtown boulevard, medina, residential houma, corniche, louage station, highway edge). Third-person walking and arcade driving, living traffic and pedestrians, police with wanted stars, and 3 missions.

The full product spec is **`docs/SPEC.md`**. It is the source of truth. Read it fully before starting a new build level, and re-read the relevant section before working on a system. If this file and the spec disagree, the spec wins.

The real goal is quality: a Tunisian player should recognize the vibe in 5 seconds, and the game must look beautiful and feel smooth. Polish beats more features. A polished Level 3 is better than a broken Level 5.

## Current state

The repo starts with only `docs/SPEC.md`. No code exists yet. Check `PROGRESS.md` (once created) to see which build level is done before doing anything.

## Tech stack

- **three.js** with `WebGLRenderer` (no WebGPU), plus `three/addons/...` for sky, post-processing, loaders.
- **Vite** dev server and build.
- **TypeScript**. Try the latest 7.x; if it breaks with Vite, use latest 6.x and record it in `DECISIONS.md`.
- **@dimforge/rapier3d-compat** for physics (character controller, raycast vehicle).
- **Playwright** for visual self-testing (Chromium is pre-installed in cloud sessions; do not run `playwright install`).

Rules:
- Run `npm view <package> version` before installing anything. Use the newest stable version.
- Keep dependencies small. No engine on top of three.js (no Babylon, PlayCanvas, React Three Fiber).
- Desktop Chrome/Edge only, keyboard + mouse.

## Commands

These are the required scripts (create them in `package.json` at Level 1):

```bash
npm install
npm run dev        # Vite dev server
npm run build      # static build into dist/ (must work from any static host)
npm run test:visual  # Playwright screenshot + sanity tests in tests/visual/
```

`npm install && npm run dev` must work the first time with zero console errors.

## Code layout

```
src/
  main.ts            entry, game loop
  core/              renderer, input, audio, time, config, debug
  world/             city generator, modular kit, road graph, sidewalk graph, sea, sky
  physics/           rapier setup, colliders
  player/            character controller, camera
  vehicles/          vehicle types, controller, damage, sounds
  ai/traffic/        lane following, traffic lights, spawning
  ai/pedestrians/    walking, crossing, idle groups, reactions
  police/            rules, wanted level, police AI
  missions/          one state machine file per mission
  ui/                HUD, minimap, menus, speech bubbles
  data/              config.ts (all tunable numbers, colors), dialogue.ts (all Derja lines)
public/assets/       models, textures, sounds (with license files)
tests/visual/        Playwright tests
screenshots/         final screenshots
```

## Architecture rules

- **City is procedural from a seed** (same seed = same city), built from a modular Tunisian kit made in code. The generator must output data, not just meshes: road graph (nodes, edges, lanes with direction, speed limits, lights, crossings), sidewalk graph (linked at crosswalks), and zones (district, medina no-car zone, parking, spawn points).
- Tunisia drives on the **right**.
- Keep systems decoupled with a simple event bus. Fixed physics timestep.
- **All tunable numbers and colors go in `src/data/config.ts`** (for example `LOUAGE_STRIPE_COLOR`, default red; police colors; traffic and pedestrian counts; speed limits).
- **All dialogue lines go in `src/data/dialogue.ts`**, grouped by situation, Derja in Latin letters. Keep the `// TODO(owner): review all Derja lines` comment.
- Performance: target 30+ FPS (60 bonus) on a mid-range laptop. Keep draw calls under ~300-500. Use `InstancedMesh` for repeated props, merge static geometry per chunk, LOD for people and cars. Spawn/despawn AI around the player (15-25 cars, 30-50 pedestrians).

## Visual rules

- ACES Filmic (or AgX) tone mapping, sRGB output, `MeshStandardMaterial`.
- `Sky` addon, golden hour by default, one shadowed directional sun + hemisphere fill, warm distance fog, PMREM env map from the sky.
- Subtle post: bloom, SMAA/FXAA, vignette, light color grading.
- Animated sea with sun reflection on the corniche.
- **Never ship grey default boxes.** Every object needs a real material, color variation and detail.
- Tunisian look: white/off-white walls with dirt at the bottom, blue doors and shutters (some green/yellow), flat roofs with water tanks, dishes, laundry, rebar on unfinished floors. Shop signs in Arabic and French via canvas textures; verify Arabic renders right-to-left with joined letters, otherwise fall back to French and log it.

## Content rules

- Warm, funny, respectful. Jokes are about everyday life (traffic, horns, louages, cafés), never about regions, religion or groups.
- No blood, gore, weapons or shown deaths. Hit pedestrians fall and get back up.
- Mosques are respectful background scenery only.
- No real brand logos, no exact copies of real car models, no real official police logos.

## Workflow

1. Follow the **build levels in `docs/SPEC.md` section 12 in order**. Each level must end playable.
2. After each level: commit, run visual tests, **look at the screenshots yourself**, fix what looks bad, update `PROGRESS.md`.
3. Visual testing (spec section 13): support a debug URL like `?debug=1&cam=medina&time=17` for repeatable shots. Capture boulevard, medina alley, houma, corniche, louage station, and a chase view. Zero console errors. Add checks for falling below ground, NaN positions, AI count limits, and a scripted mission run reaching "complete". Headless FPS is only for before/after comparison.
4. "It compiles" is not done. A level is done only after play-testing through scripts and checking screenshots.
5. Work autonomously. For small choices not covered by the spec, decide, write it in `DECISIONS.md`, and keep going. Do not stop to ask. The louage stripe color and Derja lines are already owner-review items: use the defaults.
6. Commit often with clear messages, at least one commit per level.

## Required docs to maintain

- `README.md`: how to run, controls, features.
- `PROGRESS.md`: levels done, what works, known bugs.
- `DECISIONS.md`: important choices and why.
- `CREDITS.md`: every external asset (file, author, source URL, license). Same list on the in-game Credits screen. Prefer CC0 (Kenney, Quaternius, Poly Haven, ambientCG). No unclear licenses, no ripped assets. Keep total download under ~80 MB.
