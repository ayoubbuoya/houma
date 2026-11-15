// Small helper for debugging: node tests/visual/probe.mjs "<query>" out.png ["js to evaluate"]
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [query = '?debug=1', file = 'tests/visual/out/probe.png', js, ...more] = process.argv.slice(2);
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', '4174', '--strictPort'], { stdio: 'pipe' });
await new Promise((r) => { server.stdout.on('data', (d) => String(d).includes('localhost') && r()); setTimeout(r, 5000); });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const [w, h] = (process.env.SIZE ?? '1280x720').split('x').map(Number);
const page = await browser.newPage({ viewport: { width: w, height: h } });
page.on('console', (m) => console.log(`[${m.type()}]`, m.text().slice(0, 600)));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('requestfailed', (r) => console.log('[failed]', r.url()));
page.on('response', (r) => r.status() >= 400 && console.log('[http]', r.status(), r.url()));
try {
  await page.goto('http://localhost:4174/' + query);
  await page.waitForFunction(() => window.__houma?.ready, null, { timeout: 120000 });
  if (js) console.log('eval:', JSON.stringify(await page.evaluate(js)));
  await page.waitForTimeout(Number(process.env.WAIT ?? 2500));
  await page.screenshot({ path: file });
  // extra pairs: "js" file "js" file ...
  for (let i = 0; i + 1 < more.length; i += 2) {
    console.log('eval:', JSON.stringify(await page.evaluate(more[i])));
    await page.waitForTimeout(Number(process.env.WAIT ?? 2500));
    await page.screenshot({ path: more[i + 1] });
  }
} finally {
  await browser.close();
  server.kill();
}
