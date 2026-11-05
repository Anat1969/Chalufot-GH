// בדיקת קצה לקצה: npm run build && node tests/e2e.cjs
// vite preview, ai-menu מעותק מקומי (הסביבה לא מגיעה ל-vercel.app), ופונקציית ה-Edge מדומה.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const PORT = 4377;
const BASE = `http://localhost:${PORT}/`;
const MENU = fs.readFileSync(__dirname + '/ai-menu.local.js', 'utf8');
const fails = [];
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) fails.push(msg); };
const BRIEF = {
  headline: { insight: 'שתי חלופות **מותנות** בסעיף 4.1.5.', detail: 'הבלוק ההיקפי עומד בכלל **25%** דירות נמוכות.' },
  alternatives: [{ key: 'A', text: { insight: 'חלופה א **נחסמת**.', detail: 'נכשלת בכלל **דירות בבניין שאינו רב קומות**.' } }, { key: 'B', text: { insight: 'חלופה ב **מותנית**.', detail: 'רח"ק **3.1**.' } }, { key: 'C', text: { insight: 'חלופה ג **מותנית**.', detail: 'רח"ק **5.2**.' } }],
  recommendation: { insight: 'להביא את **חלופה ג**.', detail: 'בכפוף לתנאי **4.1.5**.' },
  steps: ['לבדוק **רח"ק**', 'לאמת **דירות נמוכות**', 'להכין **תיק**'],
  engine: 'gemini',
};

async function page(b, opts = {}) {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 }, ...opts });
  await p.route('**/appofapp-gh.vercel.app/ai-menu.js', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: MENU }));
  await p.route('**/fonts.googleapis.com/**', (r) => r.abort());
  return p;
}

(async () => {
  const srv = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 2500));
  const b = await chromium.launch();
  try {
    const p = await page(b);
    const errors = [];
    p.on('pageerror', (e) => errors.push(e.message));
    const calls = [];
    let mode = 'ok';
    await p.route('**/functions/v1/chalufot-brief', async (r) => {
      calls.push(JSON.parse(r.request().postData() || '{}'));
      if (mode === 'ok') await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(BRIEF) });
      else await r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'אין מנוע זמין כרגע' }) });
    });

    // בית
    await p.goto(BASE, { waitUntil: 'networkidle' });
    const h1 = await p.locator('h1').innerText();
    ok(/בלוק היקפי.*7 מתוך 7/.test(h1), 'בית: התובנה המחושבת היא בלוק היקפי ב-7 מתוך 7 (' + h1 + ')');
    ok(await p.locator('.home-kpis .kpi').count() === 4, 'בית: ארבע שאלות עם מספר גדול');
    ok((await p.locator('.home-kpis .kpi').first().locator('.kpi-v').innerText()).includes('0'), 'בית: 0 חלופות עומדות כמו בתכנית');
    ok(await p.locator('.hero-alt .stamp').count() === 3, 'בית: שלוש חלופות עם חותמת');
    ok(await p.locator('ai-menu').evaluate((el) => !!el.shadowRoot?.querySelector('.logo')), 'כפתור הלוגו A&I בסרגל');
    ok(!(await p.locator('header >> text=העתקת קישור').first().isVisible().catch(() => false)), 'אין כפתורי פיתוח חופשיים בסרגל');
    ok(await p.locator('a[href="https://ashdod-mitar-twin.vercel.app/"]').count() === 1 && await p.locator('a[href="https://appofapp-gh.vercel.app/"]').count() === 1, 'בית: קישור חזרה לשתי אפליקציות המקור');
    await p.locator('.hero-alt').nth(1).click();
    await p.waitForFunction(() => location.hash.includes('/studio'));
    ok(p.url().includes('alt=B'), 'לחיצה על חלופה בבית פותחת אותה בסטודיו');

    // סטודיו
    await p.goto(BASE + '#/studio?lot=101', { waitUntil: 'networkidle' });
    ok(await p.locator('.alt').count() === 3, 'סטודיו: שלוש חלופות');
    ok(await p.locator('.alt .stamp').count() === 3, 'סטודיו: לכל חלופה חותמת');
    ok(await p.locator('.matrix tbody tr').count() === 12, 'סטודיו: 12 בדיקות בטבלה');
    ok(await p.locator('.studio .kpi').count() === 3, 'סטודיו: שלוש השאלות הראשונות');
    ok((await p.locator('.studio .kpi-v').nth(2).innerText()).includes('−'), 'סטודיו: מחיר העמידה מוצג כהפחתה');
    await p.locator('.lots .lot').nth(1).click();
    await p.waitForFunction(() => location.hash.includes('lot=102'));
    ok((await p.locator('.detail .crumbs').innerText()).includes('מגרש 102'), 'בחירת מגרש 102 מעדכנת את הפרטים');
    await p.locator('.actionbar').getByRole('button', { name: 'כמו בתכנית' }).click();
    await p.waitForFunction(() => location.hash.includes('mode=rights'));
    ok(await p.locator('.alt .stamp.v-fail').count() === 3, 'כמו בתכנית: שלוש החלופות לא עומדות');
    const r11 = await p.locator('.matrix tbody tr', { hasText: 'R11' }).locator('td.st').allInnerTexts();
    ok(r11.every((t) => t === 'לא עומד'), 'כמו בתכנית: הרח"ק חוסם את כולן');
    await p.locator('.actionbar').getByRole('button', { name: 'מותאם למתאר' }).click();
    await p.waitForFunction(() => location.hash.includes('mode=mitar'));
    ok(await p.locator('.alt .stamp.v-fail').count() < 3, 'מותאם למתאר: לפחות חלופה אחת עוברת');
    await p.locator('.actionbar').getByRole('button', { name: /חלופה ג/ }).click();
    await p.waitForFunction(() => location.hash.includes('alt=C'));
    ok((await p.locator('.detail-title').innerText()).includes('לוחות ונקודה'), 'כפתור חלופה ג בסרגל הקבוע');
    await p.locator('.alt').nth(1).click();
    ok((await p.locator('.detail-title').innerText()).includes('בלוק היקפי'), 'לחיצה על כרטיס בוחרת חלופה');
    await p.locator('.matrix tbody tr', { hasText: 'H02' }).click();
    ok(p.url().includes('rule=H02') && await p.locator('.matrix tr.is-row').count() === 1 && await p.locator('.matrix tr.is-dim').count() === 11, 'לחיצה על כלל מדגישה אותו ומעמעמת את השאר');
    ok(await p.locator('.alt-rule').count() === 3, 'הכלל הנבחר מוצג בכל כרטיס');
    await p.locator('.matrix tbody tr', { hasText: 'H02' }).click();
    ok(await p.locator('.matrix tr.is-dim').count() === 0, 'לחיצה שנייה מבטלת את ההדגשה');
    ok(await p.locator('.drawing svg').count() === 2, 'חתך ותכנית לחלופה שנבחרה');
    await p.reload({ waitUntil: 'networkidle' });
    ok((await p.locator('.detail-title').innerText()).includes('בלוק היקפי') && (await p.locator('.detail .crumbs').innerText()).includes('102'), 'המצב נשמר בכתובת אחרי רענון');

    // בחירת תכנית בסטודיו
    await p.getByLabel('תכנית', { exact: true }).selectOption('603-0811588');
    await p.waitForFunction(() => location.hash.includes('plan=603-0811588'));
    ok(await p.locator('.lots .lot').count() === 34, 'תכנית 603-0811588: 33 מגרשים ועוד מגרש משלי');
    ok((await p.locator('.detail .crumbs').innerText()).includes('מגרש 601'), 'המגרש הראשון בתכנית נבחר');
    ok((await p.locator('.col-sub .lvl').innerText()).includes('טבלה 5'), 'רמת הנתונים מסומנת');
    await p.locator('.actionbar').getByRole('button', { name: 'כמו בתכנית' }).click();
    ok((await p.locator('.matrix tbody tr', { hasText: 'R04' }).locator('td.st').first().innerText()) === 'חסר', 'שטח ציבורי לא ידוע: חסר, לא כישלון');
    await p.locator('.actionbar').getByRole('button', { name: 'מותאם למתאר' }).click();
    ok(await p.locator('.alt .stamp.v-pass').count() >= 1, 'בקריית שמעון פרס יש חלופה שעומדת בלי תנאי');
    await p.getByLabel('תכנית', { exact: true }).selectOption('תמל-2021');
    await p.waitForFunction(() => location.hash.includes('plan=%D7%AA%D7%9E%D7%9C-2021') || location.hash.includes('plan=תמל-2021'));
    ok((await p.locator('.lots .lot').first().innerText()).includes('מגרש מייצג'), 'מתחם: מגרש מייצג');
    ok((await p.locator('.studio .kpi-i').nth(2).innerText()).includes('בכל המתחם'), 'מתחם: מחיר העמידה מוכפל לכל המתחם');
    await p.goto(BASE + '#/studio?plan=tml-2022&lot=102&mode=mitar&alt=B', { waitUntil: 'networkidle' });

    // ניסוח לוועדה
    await p.locator('.ai-head button').click();
    await p.locator('.brief').waitFor({ timeout: 5000 });
    ok(calls.length === 1 && calls[0].alternatives.length === 3 && calls[0].alternatives[0].checks.length > 5, 'ניסוח: נשלחות שלוש החלופות עם הבדיקות');
    ok(calls[0].alternatives[0].letter === 'א', 'ניסוח: שם עברי לחלופה בבקשה');
    ok(await p.locator('.brief mark, .brief strong').count() > 3 && (await p.locator('.brief .src').innerText()).includes('Gemini'), 'ניסוח: תשובה מזוקקת עם הבלטות ומקור המנוע');
    mode = 'error';
    await p.locator('.ai-head button').click();
    await p.locator('.ai-box .tone-problem').waitFor({ timeout: 5000 });
    ok((await p.locator('.ai-box .tone-problem').innerText()).includes('נסו שוב'), 'ניסוח: שגיאה מגיעה עם הוראה');

    // מגרש משלי: נשמר אוטומטית
    await p.locator('.lots .lot', { hasText: 'מגרש משלי' }).click();
    await p.waitForFunction(() => location.hash.includes('lot=custom'));
    await p.getByLabel('יח"ד', { exact: true }).fill('240');
    ok(await p.locator('.saved').isVisible(), 'מגרש משלי: חיווי "נשמר"');
    await p.reload({ waitUntil: 'networkidle' });
    ok(await p.getByLabel('יח"ד', { exact: true }).inputValue() === '240', 'מגרש משלי: נטען מחדש אחרי רענון');
    ok(await p.locator('.alt').count() === 3, 'מגרש משלי: שלוש חלופות');
    await p.getByLabel('מרחק מציר מתע"ן, מטרים').fill('250');
    ok((await p.locator('.check', { hasText: 'אזור חניה' }).innerText()).includes('אזור א'), 'מרחק ממתע"ן מפעיל את בדיקת החניה');

    // איך משתמשים
    await p.getByRole('button', { name: 'איך משתמשים' }).first().click();
    ok(await p.locator('.howto-pop').isVisible(), 'איך משתמשים נפתח');
    await p.keyboard.press('Escape');
    ok(!(await p.locator('.howto-pop').isVisible().catch(() => false)), 'Escape סוגר');

    // השוואה
    await p.locator('.tabs').getByRole('button', { name: 'השוואה' }).click();
    await p.waitForFunction(() => location.hash.startsWith('#/compare'));
    ok(await p.locator('.gl-cell').count() === 21, 'השוואה: 21 חלופות');
    ok(await p.locator('.chart-card .chart-insight').count() === 4, 'השוואה: תובנה מחושבת מתחת לכל גרף');
    ok(await p.locator('.plans-table tbody tr').count() === 18, 'השוואה: טבלה של 18 תכניות');
    ok(/מתוך 18 תכניות/.test(await p.locator('h1').innerText()), 'השוואה: כותרת על כל התכניות');
    await p.getByRole('button', { name: 'כמו בתכנית' }).click();
    ok((await p.locator('.chart-card').nth(1).locator('.chart-insight').innerText()).includes('אף חלופה לא עוברת'), 'השוואה כמו בתכנית: תמל/2022 לא עוברת באף חלופה');
    await p.locator('.plans-table tbody tr', { hasText: '603-0811588' }).click();
    await p.waitForFunction(() => location.hash.includes('plan=603-0811588'));
    ok(await p.locator('.gl-cell').count() === 99, 'בחירת תכנית בטבלה: 33 מגרשים, 99 חלופות');
    await p.locator('.plans-table tbody tr', { hasText: 'תמל/2022' }).click();
    await p.waitForFunction(() => location.hash.includes('plan=tml-2022'));
    await p.locator('.gl-cell').nth(4).click();
    await p.waitForFunction(() => location.hash.startsWith('#/studio'));
    ok(p.url().includes('lot=102') && p.url().includes('alt=B') && p.url().includes('plan=tml-2022'), 'תא בהשוואה פותח את החלופה בסטודיו');

    // שיטה
    await p.locator('.tabs').getByRole('button', { name: 'שיטה' }).click();
    await p.waitForFunction(() => location.hash.startsWith('#/method'));
    await p.locator('.catalog tbody tr').first().waitFor({ timeout: 4000 }).catch(() => {});
    ok(await p.locator('.catalog tbody tr').count() === 12, 'שיטה: 12 כללים עם מקור');
    ok(await p.locator('.assume div').count() >= 9, 'שיטה: הנחות המחולל גלויות');
    await p.locator('.brand').click();
    await p.waitForFunction(() => /7 מתוך 7/.test(document.querySelector('h1')?.textContent ?? ''), null, { timeout: 4000 }).catch(() => {});
    ok(/7 מתוך 7/.test(await p.locator('h1').innerText()), 'שם האפליקציה מוביל לבית (' + p.url() + ')');

    ok(await p.evaluate(() => [...document.querySelectorAll('button')].every((x) => getComputedStyle(x).borderRadius === '0px')), 'כל הכפתורים מרובעים');
    ok(await p.evaluate(() => document.documentElement.dir === 'rtl'), 'הדף ב-RTL');
    const cdp = await p.context().newCDPSession(p);
    const inst = await cdp.send('Page.getInstallabilityErrors');
    ok(inst.installabilityErrors.length === 0, 'התקנה מ-Chrome: ' + (JSON.stringify(inst.installabilityErrors) || 'אין שגיאות'));
    ok(errors.length === 0, 'אין שגיאות JavaScript ' + errors.join(' | '));

    for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
      const m = await page(b, { viewport: vp, reducedMotion: 'reduce' });
      for (const h of ['', '#/studio', '#/studio?mode=rights&lot=102', '#/studio?plan=603-0811588', '#/compare', '#/compare?plan=603-0811588', '#/method']) {
        await m.goto(BASE + h, { waitUntil: 'networkidle' });
        ok(!(await m.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), `${vp.width}px ${h || 'בית'}: בלי גלילה אופקית`);
      }
      if (vp.width >= 1280) {
        await m.goto(BASE + '#/studio', { waitUntil: 'networkidle' });
        const ratio = await m.evaluate(() => document.documentElement.scrollHeight / innerHeight);
        ok(ratio <= 1.0, `${vp.width}px סטודיו בגודל המסך (יחס ${ratio.toFixed(2)})`);
      }
      const anim = await m.evaluate(() => getComputedStyle(document.querySelector('.mass') || document.body).animationName);
      ok(anim === 'none', `${vp.width}px: הפחתת תנועה מכובדת`);
      await m.close();
    }
  } finally {
    await b.close();
    srv.kill();
  }
  console.log(fails.length ? `\n${fails.length} נכשלו` : '\nהכול עבר');
  process.exit(fails.length ? 1 : 0);
})();
