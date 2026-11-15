# Decisions

Choices made while building, with the reason. Newest at the bottom.

1. **City name: Ras Yasmine (رأس الياسمين).** Fictional, sounds like a Tunisian coastal town.
2. **Macro layout is designed by hand, details are seeded.** The street grid and where each district sits are fixed in
   `src/world/roadGraph.ts` so the map is good for driving and missions. The seed controls the medina maze, lots,
   building variants, colors, shops, props and parked cars. Same seed = same city.
3. **Sea on the north side (-z), evening sun toward the sea.** The city is fictional, so the sun direction was chosen for looks:
   at golden hour the light comes diagonally to the street grid, so both street directions get some sun.
4. **Default time is 17:00.** At 17:30 or later the sun is so low that 5-floor buildings shade whole streets and the city looks flat.
5. **Code-made character instead of a downloaded rigged model.** The network in the build environment blocks most asset sites,
   and a code-made low-poly person keeps one art style with the city and can be recolored freely for pedestrians (Level 3).
   It can be swapped later for a CC0 rigged model without touching gameplay code (`src/player/character.ts`).
6. **Code-made cars.** No brands, fictional names (Bambino 206, Sahel Symbole, Louage Rafale, Taxi Jasmin, Bachée 404).
7. **All static city geometry is merged** into one mesh per material per 200 m chunk (`src/world/builder.ts`). This keeps draw calls low.
8. **Windows are flat plates, not boxes.** Windows are the most repeated piece; plates cut about one million triangles.
9. **Sidewalks are thin triangle-mesh colliders, buildings are boxes.** Curbs are 15 cm; the character controller steps over them and cars bump over them.
10. **Louage station and petrol station are at road level** (no curb) so cars can drive in.
11. **Playwright:** the project pins 1.65.1 (spec), but the cloud test machine ships another Chromium build, so the test runner uses
    `/opt/pw-browsers/chromium` when it exists. On a normal PC run `npx playwright install chromium` once.
12. **TypeScript 7.0.2 works** with Vite 8 for type checking (`tsc --noEmit`), so no fallback to 6.x was needed.
13. **Tunisian flag** is drawn on flag poles (police station, louage station, highway roundabout). It is a national symbol, not a brand logo.
14. **Louage stripe is red** by default (`LOUAGE_STRIPE_COLOR` in `src/data/config.ts`). Owner to confirm.
15. **Braking uses a deceleration value** (`brakeForce` in m/s²) instead of a raw force, so heavy and light cars stop in a similar way.
16. **Horn and engine sound came early** (spec puts sound in Level 6). They are tiny and make driving feel alive, so they are in Level 1.
17. **Sidewalk graph skips the highway.** There are no crosswalks on the highway, so the few sidewalks south of it are not connected to the rest.
