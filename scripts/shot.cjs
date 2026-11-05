// צילומי מסך מול vite preview, עם תחליף מקומי ל-ai-menu (הסביבה לא מגיעה ל-vercel.app).
const { chromium } = require('playwright');
const fs = require('fs');
const { spawn } = require('child_process');
const PORT = 4321;
(async () => {
  const srv = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 2500));
  const b = await chromium.launch();
  const menu = fs.readFileSync('tests/ai-menu.local.js', 'utf8');
  fs.mkdirSync('shots', { recursive: true });
  const pages = process.argv.slice(2).length ? process.argv.slice(2) : ['/', '/studio', '/compare', '/method'];
  for (const [n, w, h] of [['desk', 1440, 900], ['mob', 390, 844]]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
    await p.route('**/appofapp-gh.vercel.app/ai-menu.js', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: menu }));
    await p.route('**/fonts.googleapis.com/**', (r) => r.abort());
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    for (const path of pages) {
      await p.goto(`http://localhost:${PORT}/#${path}`, { waitUntil: 'networkidle' });
      await p.waitForTimeout(600);
      const f = `shots/${n}-${path.replace(/\W/g, '') || 'home'}.png`;
      await p.screenshot({ path: f, fullPage: n === 'mob' ? false : path !== '/studio' });
      const m = await p.evaluate(() => ({ ratio: +(document.documentElement.scrollHeight / innerHeight).toFixed(2), h: document.documentElement.scrollWidth > innerWidth }));
      console.log(n, path, JSON.stringify(m), f);
    }
    if (errs.length) console.log('ERR', errs);
    await p.close();
  }
  await b.close(); srv.kill();
})();
