# Houma حومة: Streets of Tunisia

A small GTA-style open-world game in the browser, set in **Ras Yasmine**, a fictional Tunisian city:
a downtown boulevard, a medina, residential houma streets, a corniche, a louage station and a highway edge.

Built with plain TypeScript, three.js and Rapier. The full design is in [`docs/SPEC.md`](docs/SPEC.md).

## Run

```bash
npm install
npm run dev
```

Then open the address Vite prints (usually http://localhost:5173). Use a desktop Chrome or Edge.

Build a static version into `dist/`:

```bash
npm run build
```

## Controls

| Key | Action |
|---|---|
| W A S D | Move / drive |
| Mouse | Camera (click the game first) |
| Shift | Run |
| Space | Jump / handbrake in a car |
| F | Enter or exit the nearest car |
| H | Horn |
| R | Reset the car if it is stuck or flipped |
| F3 | FPS counter |

## What is in the game now

See [`PROGRESS.md`](PROGRESS.md) for the build levels. Short version:

- A procedural city generated from a seed (same seed = same city), built from a modular Tunisian kit made in code.
- Golden hour lighting: sky, sun shadows that follow the player, fog, bloom, color grading, animated sea.
- Third-person player with camera collision.
- Drivable cars with arcade physics: hatchback, sedan, pickup, taxi, louage.
- Living traffic: AI cars on lanes, traffic lights, roundabouts, horns, taxis that stop suddenly.
- Road graph and sidewalk graph data (pedestrians come next).

## Tests

The game tests itself with headless Chromium screenshots and simple physics checks:

```bash
npm run build
npm run test:visual            # screenshots of every district into tests/visual/out/
node tests/visual/run.mjs boulevard medina --checks   # chosen cameras + walking/driving checks
npm run test:traffic           # 5 simulated minutes of traffic at 5 places: no jams, no overlaps
```

Debug URL options: `?debug=1&cam=medina&time=17&q=high&seed=2026`.

## Other docs

- [`PROGRESS.md`](PROGRESS.md): what is done, known bugs
- [`DECISIONS.md`](DECISIONS.md): choices made while building, and why
- [`CREDITS.md`](CREDITS.md): external assets and licenses
