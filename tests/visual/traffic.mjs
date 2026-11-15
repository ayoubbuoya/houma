// Traffic soak test: simulates minutes of traffic at several places and checks for jams and overlaps.
// Usage: node tests/visual/traffic.mjs [minutes=5] [quality=low]  (quality sets the number of cars)
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const minutes = Number(process.argv[2] ?? 5);
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', '4175', '--strictPort'], { stdio: 'pipe' });
await new Promise((r) => { server.stdout.on('data', (d) => String(d).includes('localhost') && r()); setTimeout(r, 5000); });
const browser = await chromium.launch({
  executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
let failed = false;
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://localhost:4175/?debug=1&q=' + (process.argv[3] ?? 'low') + '&nopost=1&cam=top');
  await page.waitForFunction(() => window.__houma?.ready, null, { timeout: 120000 });
  const places = [['boulevard', 3, -112], ['clock roundabout', 30, 190], ['houma', 250, -52], ['highway', -60, 349], ['corniche', -100, -347]];
  for (const [name, x, z] of places) {
    await page.evaluate(([x, z]) => window.__houma.teleport(x, z), [x, z]);
    let worstStuck = 0, r;
    const before = await page.evaluate(() => window.__houma.traffic());
    for (let m = 0; m < minutes * 4; m++) {
      r = await page.evaluate(() => { window.__houma.steps(900); return window.__houma.traffic(); });
      worstStuck = Math.max(worstStuck, r.stuck);
    }
    const overlap = r.overlapSteps - before.overlapSteps;
    const removed = r.stuckRemoved - before.stuckRemoved;
    const ok = r.count >= 8 && r.moving >= r.count * 0.3 && overlap < 30 && removed <= minutes * 2 && worstStuck <= 3;
    if (!ok) failed = true;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: ${r.count} cars, ${r.moving} moving, avg ${r.avgKmh.toFixed(0)} km/h, on ring ${r.onRing}, worst stuck ${worstStuck}, jam removals ${removed}, overlap steps ${overlap}, honks ${r.honks - before.honks}`);
  }
} finally {
  await browser.close();
  server.kill();
}
if (errors.length) { console.log('CONSOLE ERRORS:\n' + [...new Set(errors)].slice(0, 10).join('\n')); failed = true; }
process.exit(failed ? 1 : 0);
