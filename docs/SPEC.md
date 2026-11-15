# SPEC.md: "Houma" (حومة), a mini GTA-style game set in Tunisia

> **Name meaning:** "houma" is Tunisian for your neighborhood, the streets you grew up in ("weld el houma" = a guy everyone in the area knows). The player is a local, not a tourist.
> **Tagline:** *Houma: Streets of Tunisia*. Show it on the start screen with the title also written in Arabic: حومة.

> **For the AI agent reading this:** you are building this game from zero, alone, inside Claude Code.
> The owner (Ayoub) wants to test how far you can go and how **beautiful and polished** the result can be.
> Read this whole file before writing code. Then follow the build levels in order (section 12).
> When a choice is not covered here, decide yourself, write the decision in `DECISIONS.md`, and continue. Do not stop to ask small questions.

---

## 1. The idea in one paragraph

A 3D third-person open-world game in the browser, like a small GTA, set in a **fictional Tunisian city**. The player walks, gets into cars, drives through a living city with Tunisian traffic, louages, taxis, traffic lights and people on the sidewalks who talk in Tunisian Derja. Breaking the rules brings the police. There are 3 missions. The goal is not size. The goal is that a Tunisian player opens it and says "wow, this is really our country" and the game feels smooth and fun.

## 2. Success criteria (how the result will be judged)

The owner will score the game on these points. Optimize for them.

| # | Criterion | Pass means |
|---|---|---|
| 1 | Runs | `npm install && npm run dev` works first time. No console errors. |
| 2 | Performance | 30 FPS or more on a mid-range gaming laptop (Windows 11, 1080p). 60 FPS is a bonus. |
| 3 | Looks Tunisian | Someone from Tunisia recognizes the vibe in 5 seconds: white and blue buildings, louages, yellow taxis, cafés, medina. |
| 4 | Looks beautiful | Good lighting, shadows, sky, fog, color grading. No grey default boxes anywhere in the final build. |
| 5 | Feels good to play | Walking and driving feel smooth. Camera never goes inside walls. Car handling is fun (arcade, not a simulator). |
| 6 | City feels alive | AI cars follow lanes and lights. Pedestrians walk, cross, react, and talk. |
| 7 | Missions work | All 3 missions can be started and finished. Clear goals, markers, fail and win states. |
| 8 | No game-breaking bugs | Can't fall through the map, can't get stuck forever, can always respawn. |

## 3. Tech stack (versions checked on 15 Nov 2026)

| Tool | Version | Use |
|---|---|---|
| three.js | 0.187.0 | 3D rendering. Use `WebGLRenderer` (stable). WebGPU is not needed. |
| Vite | 8.3.8 | Dev server and build |
| TypeScript | 7.0.2 (latest) | Language. If TS 7 gives tooling problems with Vite, use the latest 6.x and note it in `DECISIONS.md`. |
| @dimforge/rapier3d-compat | 0.21.0 | Physics: collisions, character controller, vehicle controller |
| Playwright | 1.65.1 | Your own visual testing (screenshots), see section 13 |

Rules:
- Run `npm view <package> version` before installing. If a newer stable version exists, use it.
- Keep dependencies small. Use three.js addons (`three/addons/...`) for sky, post-processing, loaders and so on, before adding new packages.
- No game engine on top of three.js (no Babylon, no PlayCanvas, no React Three Fiber). Plain TypeScript + three.js.
- Desktop browser only (Chrome/Edge). Keyboard + mouse. No mobile support needed.

## 4. The world: a fictional Tunisian city

The game is called **Houma**. Invent a fitting fictional name for the city itself. It is a mix of Tunis downtown, a medina and a coastal corniche in **one compact map**. It is fictional so you are free to design it for fun driving. Do not copy a real city exactly.

**Size:** medium. About **1 km x 1 km** of playable area, with the sea on one side and hills or a highway exit as the map edge on the other sides. Invisible walls at the edges, hidden by terrain or buildings.

### 4.1 Districts

| District | What it looks like | Gameplay role |
|---|---|---|
| **Downtown boulevard** | A wide avenue with a central walking promenade, big ficus trees, a clock tower roundabout at one end, colonial-style buildings (French-era facades, balconies, arches at street level, shop signs), cafés with chairs outside | Main driving street, busy traffic, traffic lights |
| **Medina** | Narrow alleys with whitewashed walls, arched doorways, painted doors (blue, green, yellow) with studs, small shops, a mosque with a square minaret, souk awnings | **Cars cannot enter** (alleys too narrow, bollards at gates). Walking only. Mission 2 happens here. |
| **Houma (residential)** | 2 to 3 storey white cube houses, flat roofs with water tanks and satellite dishes, half-finished concrete floors with rebar sticking out on top, blue shutters, small hanout shops, bougainvillea | Side streets, slower traffic, kids and neighbors |
| **Corniche** | Seaside road with palm trees, a low sea wall, a beach, a few cafés and a fish restaurant, sunset view | Fast scenic driving, end point of missions |
| **Louage station** | A big open lot full of louages, signs with destination names, sellers, people with bags | Mission 1 start, very busy |
| **Edge / highway** | A short highway section with a petrol station and a roundabout | Police chase escape route |

### 4.2 Architecture rules (make it feel Tunisian)

- Walls: mostly white or off-white, some cream and light ochre. Add dirt and stain at the bottom of walls (subtle gradient or texture). Perfectly clean walls look fake.
- Doors and shutters: blue (main), plus some green and yellow.
- Roofs: flat. Add water tanks (white or black), satellite dishes, laundry lines, and on some houses unfinished upper floors with rebar.
- Street details: high curbs painted red and white or black and white in some places, broken sidewalk patches, palm trees and ficus, street lamps, plastic chairs, trash bins, parked cars on both sides, some scooters.
- Signs: shop signs in **Arabic and French** (for example "Pâtisserie", "Hanout", "Café", "مقهى", "حلاق"). Render text with canvas textures. Use a font that supports Arabic. Make sure Arabic renders correctly (right to left, joined letters). If it does not render correctly, use French only and log it.
- Mosque: respectful, simple, beautiful. Square minaret with green or white details. Nothing silly happens near it.

### 4.3 How to build the city (important)

Build your **own modular Tunisian kit in code**: wall blocks, house variants, arches, doors, shutters, balconies, roof props, sidewalks, road pieces, crossings, roundabouts. Then generate the city layout procedurally from a **seed** (same seed = same city).

Why: the city must **know its own structure**. Traffic and pedestrians need data, not just meshes. So generate and keep:
- a **road graph**: nodes (intersections, roundabouts), edges (road segments), lanes with direction, speed limits, traffic light positions, crossings
- a **sidewalk graph** for pedestrians, connected at crosswalks
- **zones**: district type per area, medina no-car zone, parking spots, spawn points

Tunisia drives on the **right**.

You may use free external models (CC0 preferred) for props, characters and cars if they look better than code-made ones. See section 10 for credits.

## 5. Visual quality (the "wow" part)

- Renderer: `ACESFilmicToneMapping` (or AgX), sRGB output, physically based materials (`MeshStandardMaterial`).
- Sky: three.js `Sky` addon. Default time: **late afternoon / golden hour** (warm light, long shadows, looks best).
- Sun: one directional light with good shadows (cascaded shadow maps or a shadow camera that follows the player). Hemisphere light for fill.
- Fog: light distance fog with warm color, also hides the far city and helps performance.
- Post-processing: subtle bloom, SMAA or FXAA, slight vignette, a little color grading. Keep it subtle.
- Sea: animated water shader on the corniche side with sun reflection.
- Environment map from the sky (PMREM) so cars reflect the sky.
- Stretch goal: day/night cycle with street lamps, car headlights and lit windows at night.

**Never ship grey default boxes.** Every object needs a real material, color variation and details.

## 6. Player

- Third-person character, animated: idle, walk, run, jump (simple), enter/exit car (can be a short fade or snap if animation is hard).
- Use a good-looking free rigged character (CC0 or clearly allowed license). Dress it in normal Tunisian street clothes if you can recolor it (jeans, hoodie or t-shirt, sneakers).
- Physics: Rapier kinematic character controller. Handles stairs, slopes, curbs. Never falls through the ground.
- Camera: third-person orbit with mouse, smooth follow, **collision so it never goes inside walls**, closer camera in the medina alleys.
- Health: simple health value. If health reaches 0 or the player is "busted", fade out and respawn at a safe point.

### Controls

| Key | Action |
|---|---|
| W A S D | Move / drive |
| Mouse | Camera |
| Shift | Run |
| Space | Jump / handbrake in car |
| F | Enter or exit nearest car |
| H | Horn (very important in Tunisia) |
| M | Full map |
| E | Interact (talk, start mission) |
| R | Reset car if flipped |
| Esc | Pause menu (resume, controls, credits) |

## 7. Vehicles

No real brand logos or exact copies of real car models. Make clearly "Tunisian street" types with fictional names.

| Type | Looks like (style only) | Drivable | Notes |
|---|---|---|---|
| Small hatchback | small city car common in Tunisia | Yes | Fast, light, fun |
| Family sedan | common budget 4-door sedan | Yes | Balanced |
| Louage | white minibus/van with a **colored stripe** along the side and a roof sign | Yes (mission 1) | Heavy, slow to turn, 8 passenger seats. Make stripe color a config value (`LOUAGE_STRIPE_COLOR`), default red. The owner will confirm the correct color. |
| Taxi | yellow small sedan with roof sign "TAXI" | AI only (drivable is a bonus) | Very common in traffic |
| Old pickup / utility van | old small utility van, like the classic farm and work vans in Tunisia | Yes | Slow, bouncy, funny |
| Police car | config colors, light bar, siren | AI only | Section 9 |
| Scooter | stretch goal | Optional | |

Driving physics: Rapier `DynamicRayCastVehicleController` or your own raycast car. **Arcade feel**: responsive steering, handbrake drift, no flipping on small bumps, auto-reset if upside down for 3 seconds. Engine sound with Web Audio (pitch follows speed), horn sound. Generate sounds with code if no free audio is available.

## 8. Living city

### 8.1 Traffic AI
- Cars follow lanes on the road graph, keep distance, slow down behind other cars, stop at red lights, give way at roundabouts (roughly), turn at intersections randomly.
- Mix of types: lots of taxis and small cars, some louages, some pickups.
- Spawn and despawn around the player (for example within 150 to 250 m), so only around **15 to 25 AI cars** exist at once.
- Light Tunisian flavor: AI drivers honk if blocked for more than 2 seconds. Some taxis stop suddenly to pick people up.
- If the player crashes into an AI car, the driver gets out and shouts (speech bubble), then drives away.

### 8.2 Traffic lights
- Real working lights at the main boulevard intersections. Cycle green, yellow, red. Both AI cars and pedestrians respect them.

### 8.3 Pedestrians
- **Around 30 to 50** visible at once near the player, spawned and despawned like traffic.
- Walk on sidewalks along the sidewalk graph, cross at crosswalks (mostly on green, some cross anywhere, that is realistic 😄).
- Idle groups: men sitting at café tables, people chatting in pairs, someone at a hanout door, kids playing near the houma.
- Variety: recolor clothes and skin tones, different heights, some with bags.
- Reactions: if the player runs at them with a car they jump away and run. If hit, they fall, then get up and run away angry (**no blood, no gore, no deaths shown**). If the player honks near them, they shout something.
- Animation: use the same rigged character base with walk, run, idle, sit animations. Use LOD or simpler models for far people.

### 8.4 Talking (speech bubbles in Derja)
- Pedestrians and drivers show **short speech bubbles** in Tunisian Derja (Latin letters, the way Tunisians write in chat). No voice.
- Put all lines in one file: `src/data/dialogue.ts`, grouped by situation, so the owner can edit them easily.
- Starter lines (the owner will review and fix them, Derja must sound natural):

```ts
// TODO(owner): review all Derja lines
greet:        ["Aslema!", "Ahla khouya", "Labes?", "Sbah el khir"]
idle_chat:    ["Chnowa el jdid?", "El jaw behi lyoum", "Barcha karhabet lyoum"]
honked_at:    ["Chbik?!", "Saber chwaya!", "Ya khouya rod belek!"]
almost_hit:   ["Rod belek ya mahboul!", "Chbik tsouk haka?!"]
crash_driver: ["Chbik?! Ma tchoufech?!", "Haya, mchi!"]
louage_pass:  ["Win mechi?", "Fama blasa?", "Ya3tik essa7a"]
police:       ["Wa9ef!", "Ebda 3la jnab!"]
```

## 9. Rules and police

Rules the game checks:
- Running a **red light**
- **Speeding** over the zone limit (lower in houma and near the medina)
- **Hitting a pedestrian**
- **Crashing into a police car** or driving on the promenade

System:
- "Wanted" level from 0 to 3 stars shown in the HUD.
- 1 star: a police car follows you with siren. 2 stars: two cars, they try to box you in. 3 stars: road block on the highway exit.
- Lose them by breaking line of sight for about 15 seconds or hiding in a garage or the medina on foot.
- If the police stop you and you stay still for 3 seconds = "busted", fade out, respawn at the police station with no penalty except mission fail.
- Police vehicle and uniform colors in a config file. Do not use real official logos.

## 10. Missions

All missions start from a marker on the map (press E). Each mission has a clear objective text in the HUD, a GPS line on the minimap, a timer if needed, and win and fail screens.

### Mission 1: "Louage to the Corniche"
- At the louage station, get into the louage. A crowd of passengers boards one by one (with bubbles like "Fama blasa?").
- Drive them to the corniche drop-off before the timer ends.
- Bonus: passengers complain if you drive like a maniac ("Rod belek!") and you lose tip money. Smooth driving = big tip.
- Fail if the timer ends or the louage is destroyed.

### Mission 2: "Delivery in the Medina"
- A shop owner downtown gives you a package (bread, a cake box, anything).
- Cars can't enter the medina, so park at the gate and go **on foot** through the alleys to a specific door.
- The alleys must feel like a small maze. Guide with a waypoint marker and the minimap.
- Twist: a scooter thief grabs the package halfway. Chase him on foot to the next square to get it back (simple chase, no fighting needed).

### Mission 3: "Escape"
- A friend calls you: he needs to get to the airport highway fast. Pick him up in the houma and drive.
- On the way a scripted event forces a red light, which brings 2 stars of police.
- Lose the police and reach the highway petrol station.

## 11. HUD and menus

- **Minimap** (circle, bottom-left) rotating with the player, showing roads, player arrow, mission marker, police cars.
- Full map on M.
- Speedometer in car (km/h), money in **TND** (dinars), wanted stars, mission objective text, timer.
- Start screen with the game title, a "Play" button, controls list. Nice looking, with the city in the background (slow camera fly-over).
- Pause menu: Resume, Controls, Graphics quality (Low / Medium / High: shadows, pedestrian count, draw distance), **Credits**.
- A small FPS counter that can be toggled with F3.

## 12. Build levels (do them in order)

Each level must end with a **playable game**, not half-done systems. After each level: commit to git, run the visual tests (section 13), update `PROGRESS.md`, and fix bugs before moving on. Polish beats more features.

| Level | Content | Done when |
|---|---|---|
| **1. City + player** | Project setup, renderer with all lighting/sky/fog/post, procedural Tunisian city (all districts, even if simple), road and sidewalk graphs, player walking with camera, 3 drivable cars, enter/exit | You can walk and drive around a beautiful Tunisian city at 30+ FPS |
| **2. Traffic** | AI cars on lanes, traffic lights, roundabouts, spawning around player, horns | Traffic flows for 5 minutes with no stuck jams and no cars driving through each other |
| **3. Pedestrians** | Sidewalk walkers, crossings, idle groups, cafés, reactions, speech bubbles | City looks alive from any street |
| **4. Rules + police** | Rule checks, wanted stars, police chase, busted/respawn | You can trigger and escape a 2-star chase |
| **5. Missions + UI** | 3 missions, minimap, full map, start screen, pause, credits, quality settings | All 3 missions playable start to finish |
| **6. Polish** | Sound, small details, bug hunt, performance tuning, better materials, stretch goals (night cycle, scooter) | Every success criterion in section 2 passes |

If time is short, a polished Level 3 is better than a broken Level 5.

## 13. Testing yourself (very important)

You can't see the screen directly, so **build your own eyes**:
- Write Playwright scripts in `tests/visual/` that open the game in headless Chromium (use `--use-gl=angle` or `--use-angle=swiftshader` if needed), wait for loading, and take screenshots from fixed camera points: boulevard, medina alley, houma, corniche, louage station, a car interior/chase view.
- Add a debug URL mode, for example `?debug=1&cam=medina&time=17`, to put the camera at a fixed place and time, so screenshots are repeatable.
- **Look at your own screenshots** after every level and fix what looks bad (floating objects, z-fighting, black textures, ugly colors, text not readable, Arabic letters broken).
- Read the browser console in the test. Zero errors is the rule.
- Add simple automated checks: player falls below ground? any NaN positions? AI car count stays within limits? mission state machine reaches "complete" in a scripted run?
- Log FPS in the test, but remember headless software rendering is much slower than a real GPU. Use it to compare before and after, not as the real number. Keep draw calls low (target under 300 to 500), use `InstancedMesh` for repeated props, merge static city geometry per chunk, use LOD for people and cars.

## 14. Code structure (suggested)

```
/src
  main.ts               entry, game loop
  core/                 renderer, input, audio, time, config, debug
  world/                city generator, kit (buildings, roads, props), road graph, sidewalk graph, sea, sky
  physics/              rapier setup, colliders
  player/               character controller, camera
  vehicles/             vehicle types, controller, damage, sounds
  ai/traffic/           lane following, traffic lights, spawning
  ai/pedestrians/       walking, crossing, idle groups, reactions
  police/               rules, wanted level, police AI
  missions/             mission state machines (one file per mission)
  ui/                   HUD, minimap, menus, speech bubbles
  data/                 dialogue.ts, config.ts (colors, counts, limits)
/public/assets          models, textures, sounds (with license files)
/tests/visual           Playwright screenshot tests
CREDITS.md  DECISIONS.md  PROGRESS.md  README.md
```

Keep systems decoupled (simple event bus is fine). Use a fixed physics timestep. All tunable numbers go in `config.ts`.

## 15. Assets and credits

- Prefer **CC0** assets (no attribution required, but credit them anyway). CC-BY is fine with credit. **No assets with unclear licenses. No ripped game assets. No real brand logos.**
- Good sources to check: Kenney (CC0), Quaternius (CC0 animated characters and props), Poly Haven (CC0 textures and HDRIs), ambientCG (CC0 textures), the three.js repository example models (check each model's license before using it).
- For every external file, add a line to `CREDITS.md`: file, author, source URL, license. Show the same list on the in-game Credits screen.
- Keep total download size reasonable (target under ~80 MB). Compress textures, use Draco or Meshopt for big models if needed.

## 16. Content rules

- Fun, warm, a bit funny, respectful to Tunisia and its people. The joke is everyday Tunisian life (traffic, horns, louage drivers, café guys), never insults to regions, religion or groups.
- No blood, no gore, no weapons in this version. Pedestrians who get hit fall and get back up.
- Mosque and religious places are background scenery only.

## 17. Deliverables

1. Source code that runs with `npm install && npm run dev`, and builds with `npm run build` into a static `dist/` folder that can be opened from any static host.
2. `README.md`: how to run, controls, short feature list.
3. `PROGRESS.md`: which levels are done, what works, known bugs.
4. `DECISIONS.md`: important choices you made and why.
5. `CREDITS.md`: all external assets and licenses.
6. `screenshots/`: final screenshots from the visual tests (one per district + one chase + one mission).

## 18. Final notes for the agent

- Work autonomously. Make good decisions, write them down, keep going.
- Commit often with clear messages. Each level = at least one commit.
- When something is hard (vehicle physics, Arabic text, shadows), make a simple working version first, then improve it.
- Before you say a level is done, play-test it through your scripts and look at the screenshots. "It compiles" is not done.
- Ask the owner only for things you truly can't decide: the louage stripe color and the Derja lines are already marked as owner-review items, so use the defaults and keep moving.
- Make it beautiful. That's the real test. 🇹🇳
