// צילום של רכיב אחד: node scripts/shot-el.cjs <hash> <selector> <out>
const { chromium } = require('playwright');
const fs = require('fs');
const { spawn } = require('child_process');
(async () => {
  const [hash, sel, out] = process.argv.slice(2);
  const srv = spawn('npx', ['vite', 'preview', '--port', '4322', '--strictPort'], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 2500));
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  await p.route('**/appofapp-gh.vercel.app/ai-menu.js', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync('tests/ai-menu.local.js', 'utf8') }));
  await p.route('**/fonts.googleapis.com/**', (r) => r.abort());
  await p.route('**/basemaps.cartocdn.com/**', (r) => r.abort());
  await p.goto('http://localhost:4322/#' + hash, { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  await p.locator(sel).first().screenshot({ path: out });
  await b.close(); srv.kill();
})();
