# Progress

Build levels from `docs/SPEC.md` section 12.

| Level | Status |
|---|---|
| 1. City + player | **Done** |
| 2. Traffic | Not started |
| 3. Pedestrians | Not started |
| 4. Rules + police | Not started |
| 5. Missions + UI | Not started |
| 6. Polish | Not started |

## Level 1: what works

- Project setup: Vite + TypeScript + three.js + Rapier. `npm install && npm run dev` runs, `npm run build` makes `dist/`.
- Renderer: ACES tone mapping, sky with clouds, sun with follow shadows, hemisphere fill, fog, sky reflections, bloom, FXAA, vignette, color grading.
- City generated from a seed: boulevard with promenade and ficus trees, colonial arcades with shops, medina maze with mosque and gates,
  houma houses (blue shutters, studded doors, water tanks, unfinished floors with rebar), corniche with palms and a beach, louage station,
  police station and public garden, petrol station, two roundabouts (one with a clock tower), highway with tunnel mouths, hills around the map.
- Shop signs in Arabic and French (canvas textures, Cairo font).
- Data: road graph (nodes, edges, lanes, speed limits, traffic light positions), sidewalk graph (with crosswalks and medina alleys), districts.
- Player: walk, run, jump, camera orbit with wall collision, closer camera in the medina.
- Cars: 8 drivable cars (hatchback, sedan, pickup, taxi, louage). Enter/exit with F, reset with R, auto-reset when flipped.
- Simple horn (H) and engine sound made with Web Audio. Pause screen when Esc releases the mouse.
- Start screen with a slow fly-over of the city.
- Tests: screenshot cameras for every district, walking and driving checks, zero console errors.
- Screenshots of Level 1 are in `screenshots/`.

## Known bugs / things to improve later

- Performance has only been measured in software rendering. Triangle count (about 2 million) should be checked on a real GPU.
- Looking straight toward the sun from high up, the view is very hazy.
- AI traffic, pedestrians, police and missions are not in yet (Levels 2 to 5), so the city is still empty of life.
- Traffic light poles exist but have no working lamps yet (Level 2).
- The start screen and pause screen are simple (full menus, minimap and credits screen come in Level 5).
