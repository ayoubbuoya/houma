# Progress

Build levels from `docs/SPEC.md` section 12.

| Level | Status |
|---|---|
| 1. City + player | **Done** |
| 2. Traffic | **Done** |
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

## Level 2: what works

- AI cars drive on the lanes of the road graph (right-hand traffic), keep distance and slow down behind other cars.
- Working traffic lights on the boulevard crossings (green, yellow, red). AI cars stop at red.
- Left turns wait for oncoming cars. Plain intersections work "one street at a time". Roundabouts: cars give way to cars already on the ring.
- Mix of taxis, small cars, sedans, louages and pickups. Up to 14 / 20 / 25 cars (low / medium / high quality), spawned and removed around the player.
- Drivers honk when blocked for more than 2 seconds. Taxis sometimes stop for a few seconds. Cars stop for the player on foot and for the player's car.
- If the player crashes into an AI car, it stops and the driver shouts in a speech bubble ("Chbik?! Ma tchoufech?!").
- Soak test (`npm run test:traffic`): 4 simulated minutes at 5 places with 25 cars: no jams, no overlapping cars.

## Known bugs / things to improve later

- Performance has only been measured in software rendering. Triangle count (about 2 million) should be checked on a real GPU.
- Looking straight toward the sun from high up, the view is very hazy.
- Pedestrians, police and missions are not in yet (Levels 3 to 5).
- AI cars are solid like a wall when hit (they do not get pushed). The driver does not get out of the car yet (needs the pedestrian system, Level 3).
- AI cars have no brake lights and their wheels do not spin.
- A car left by the player in a lane blocks that lane; AI cars wait and honk instead of driving around it.
- The start screen and pause screen are simple (full menus, minimap and credits screen come in Level 5).
