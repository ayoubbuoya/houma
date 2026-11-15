// Visual tests: build must exist (npm run build). Starts `vite preview`, opens the game in headless
// Chromium, takes screenshots from fixed cameras and runs a few sanity checks.
// Usage: node tests/visual/run.mjs [cam1 cam2 ...] [--time=17] [--checks] [--size=1280x720] [--out=screenshots]
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const opt = (name, def) => (args.find((a) => a.startsWith(`--${name}=`)) ?? `--${name}=${def}`).split('=')[1];
const out = path.join(root, opt('out', 'tests/visual/out'));
mkdirSync(out, { recursive: true });
const cams = args.filter((a) => !a.startsWith('--'));
const ALL = ['boulevard', 'clock', 'medina', 'medinagate', 'houma2', 'corniche', 'beach', 'louage', 'highway', 'aerial2'];
const list = cams.length ? cams : ALL;
const time = opt('time', '17');
const [W, H] = opt('size', '1280x720').split('x').map(Number);
const PORT = 4173;
const base = `http://localhost:${PORT}/`;

const server = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), 'preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'pipe' });
await new Promise((res, rej) => {
  server.stdout.on('data', (d) => String(d).includes('localhost') && res());
  server.on('exit', () => rej(new Error('preview server stopped')));
  setTimeout(res, 6000);
});

// Cloud sessions ship one Chromium build; use it when the pinned Playwright version expects another.
const exe = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const browser = await chromium.launch({
  executablePath: exe,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const errors = [];
let failed = false;
const newPage = async (url) => {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`${url}: ${m.text()}`);
    else if (m.text().startsWith('[houma]')) console.log('  ' + m.text());
  });
  page.on('pageerror', (e) => errors.push(`${url}: ${e.message}`));
  await page.goto(base + url);
  await page.waitForFunction(() => window.__houma?.ready, null, { timeout: 180000 });
  return page;
};

try {
  for (const cam of list) {
    if (cam === 'none') continue;
    const page = await newPage(`?debug=1&cam=${cam}&time=${time}`);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(out, `${cam}.png`) });
    const s = await page.evaluate(() => window.__houma.stats());
    console.log(`shot ${cam}: ${s.calls} draw calls, ${(s.triangles / 1000).toFixed(0)}k tris`);
    await page.close();
  }

  if (args.includes('--checks')) {
    const page = await newPage('?debug=1&q=low&nopost=1');
    const check = (name, ok, info = '') => {
      console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`);
      if (!ok) failed = true;
    };
    const r = await page.evaluate(() => {
      const h = window.__houma;
      const res = {};
      res.start = h.player();
      // walk for 10 seconds in four directions
      const walk = [];
      for (const dir of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
        h.auto({ move: dir });
        h.steps(150);
        walk.push(h.player());
      }
      h.auto(null);
      res.walk = walk;
      // drive every car: straight, then a hard turn (traffic off so the road is empty)
      h.trafficEnabled(false);
      res.cars = [];
      for (let i = 0; i < h.cars(); i++) {
        const home = h.car(i);
        // open road: the highway, heading east
        h.placeCar(i, -330, 365.4, Math.PI / 2);
        h.steps(40);
        h.enter(i);
        const a = h.car(i);
        h.auto({ car: { throttle: 1, steer: 0, handbrake: false } });
        h.steps(180);
        const b = h.car(i);
        h.auto({ car: { throttle: 0.3, steer: 1, handbrake: false } });
        h.steps(50);
        const c = h.car(i);
        h.auto({ car: { throttle: -1, steer: 0, handbrake: false } });
        h.steps(90);
        const d = h.car(i);
        h.auto(null);
        h.exit();
        h.steps(30);
        h.placeCar(i, home.x, home.z, home.yaw);
        res.cars.push({ name: a.name, a, b, c, d, moved: Math.hypot(b.x - a.x, b.z - a.z), forward: (b.x - a.x) * Math.sin(a.yaw) + (b.z - a.z) * Math.cos(a.yaw), turned: c.yaw - b.yaw, after: h.player() });
      }
      h.trafficEnabled(true);
      // medina: walk around inside, stay above ground
      h.teleport(-203.6, -60);
      h.steps(60);
      res.medina = h.player();
      h.teleport(60, -365, 1);
      h.steps(120);
      res.beach = h.player();
      return res;
    });
    const fin = (p) => Number.isFinite(p.x + p.y + p.z);
    check('player starts on the ground', fin(r.start) && r.start.y > 0 && r.start.y < 0.5, JSON.stringify(r.start));
    check('player walks and stays above ground', r.walk.every((p) => fin(p) && p.y > -0.01 && p.y < 3), r.walk.map((p) => p.y.toFixed(2)).join(' '));
    for (const c of r.cars) {
      check(`car ${c.name} accelerates forward`, c.forward > 15 && c.b.kmh > 30, `moved ${c.forward.toFixed(1)} m, ${c.b.kmh.toFixed(0)} km/h`);
      check(`car ${c.name} stays upright`, c.b.upY > 0.9 && c.c.upY > 0.8 && c.d.upY > 0.8 && [c.b, c.c, c.d].every(fin), `up ${c.b.upY.toFixed(2)} ${c.c.upY.toFixed(2)} ${c.d.upY.toFixed(2)}`);
      check(`car ${c.name} turns left with positive steer`, Math.abs(c.turned) > 0.15, `yaw change ${c.turned.toFixed(2)}`);
      check(`car ${c.name} brakes`, c.d.kmh < 15, `${c.d.kmh.toFixed(0)} km/h`);
      check(`player can exit ${c.name}`, fin(c.after) && c.after.y > -0.3 && !c.after.inVehicle, JSON.stringify(c.after));
    }
    // traffic: count stays in limits, and a crash into an AI car is handled
    const tr = await page.evaluate(() => {
      const h = window.__houma;
      h.teleport(3, -112);
      h.steps(600);
      const t0 = h.traffic();
      const cars = h.trafficCars().filter((c) => c.path === 'lane' && c.toEnd > 40 && c.v > 3);
      let crash = null;
      if (cars.length) {
        const c = cars[0];
        const g = h.game.traffic.agents.find((a) => a.id === c.id);
        // put the player's car in front of the AI car, facing it, and floor it
        h.placeCar(0, g.x + Math.sin(g.yaw) * 30, g.z + Math.cos(g.yaw) * 30, g.yaw + Math.PI);
        h.enter(0);
        h.auto({ car: { throttle: 1, steer: 0, handbrake: false } });
        h.steps(240);
        h.auto(null);
        const pc = h.car(0);
        h.exit();
        crash = { crashes: h.traffic().crashes - t0.crashes, upY: pc.upY, y: pc.y, ok: Number.isFinite(pc.x + pc.y + pc.z) };
      }
      return { t0, crash, lights: [h.light(0, true), h.light(0, false)] };
    });
    check('traffic count is within limits', tr.t0.count >= 6 && tr.t0.count <= 25, `${tr.t0.count} cars, ${tr.t0.moving} moving`);
    check('no AI cars overlap', tr.t0.overlapSteps === 0, `min distance ${tr.t0.minPair.toFixed(1)} m`);
    check('crash into an AI car is handled', !!tr.crash && tr.crash.crashes >= 1 && tr.crash.ok && tr.crash.upY > 0.5 && tr.crash.y < 3, JSON.stringify(tr.crash));
    const st = await page.evaluate(() => window.__houma.stats());
    check('sidewalk graph is one connected network', st.walk.reachable > st.walk.nodes * 0.9 && st.walk.crossings > 50, JSON.stringify(st.walk));
    check('road graph exists', st.roads.nodes > 40 && st.roads.edges > 60, JSON.stringify(st.roads));
    check('medina ground is solid', r.medina.y > 0 && r.medina.y < 0.6, JSON.stringify(r.medina));
    check('beach is solid', r.beach.y > -2 && r.beach.y < 0.5, JSON.stringify(r.beach));
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
}
if (errors.length) {
  console.log('CONSOLE ERRORS:\n' + [...new Set(errors)].slice(0, 20).join('\n'));
  failed = true;
} else console.log('no console errors');
process.exit(failed ? 1 : 0);
