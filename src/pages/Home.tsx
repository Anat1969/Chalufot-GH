// דף הבית: החזון, הסיפור בחמישה פרקים, והתובנות. כל מספר מחושב מהבדיקה עצמה, בלי קודים.
import { useMemo } from 'react';
import { Iso, isoBounds } from '../components/Drawings';
import Rich, { fmt, pct } from '../components/Rich';
import Stamp from '../components/Stamp';
import { go } from '../lib/route';
import { PLAN, PLANS, planById } from '../lib/site';
import { ALT_LETTER, allLots, allSummaries, keepBest } from '../lib/studio';

export default function Home() {
  const lots = useMemo(() => allLots(), []);
  const s = useMemo(() => {
    const flat = (k: 'rights' | 'mitar') => lots.flatMap((l) => l[k]);
    const total = flat('rights').length;
    const okRights = flat('rights').filter((v) => v.verdict !== 'fail').length;
    const okFit = flat('mitar').filter((v) => v.verdict !== 'fail').length;
    const byType = (['A', 'B', 'C'] as const).map((k) => ({ k, name: lots[0].mitar.find((v) => v.alt.key === k)!.alt.name, n: lots.filter((l) => l.mitar.find((v) => v.alt.key === k)!.verdict !== 'fail').length }));
    const lead = [...byType].sort((a, b) => b.n - a.n)[0];
    const tower = byType.find((b) => b.k === 'A')!;
    const units = lots.reduce((a, l) => a + l.site.units, 0);
    const kept = lots.reduce((a, l) => a + keepBest(l.mitar).alt.units, 0);
    const fars = lots.map((l) => (l.site.residentialM2 + l.site.commerceM2 + l.site.employmentM2 + l.site.publicM2) / l.site.areaM2);
    const capFar = Math.max(...lots[0].rights.map((v) => Number(v.results.find((r) => r.id === 'R11')?.values.max ?? 0)));
    const sums = allSummaries();
    const allUnits = sums.reduce((a, x) => a + x.units, 0);
    const allKept = sums.reduce((a, x) => a + x.kept, 0);
    const byCost = [...sums].sort((a, b) => (a.units - a.kept) / a.units - (b.units - b.kept) / b.units);
    const noneRights = sums.filter((x) => x.okRights === 0).length;
    const peres = planById('603-0811588');
    const smallShare = peres.lots.reduce((a, l) => a + (l.mix?.small ?? 0), 0) / peres.lots.reduce((a, l) => a + l.units, 0);
    return { total, okRights, okFit, lead, tower, units, kept, farMin: Math.min(...fars), farMax: Math.max(...fars), capFar, sums, allUnits, allKept, cheap: byCost[0], dear: byCost[byCost.length - 1], noneRights, smallShare, lotsAll: sums.reduce((a, x) => a + x.lots, 0) };
  }, [lots]);
  const hero = lots[0];
  const bounds = isoBounds(hero.site, hero.mitar.map((v) => v.alt));
  const costOf = (x: typeof s.cheap) => pct((x.units - x.kept) / x.units);

  const chapters: { n: string; big: string; unit: string; title: string; body: string[] }[] = [
    {
      n: '1', big: '3', unit: 'צורות, שאלה אחת', title: 'המתכננת מביאה שלוש צורות. הוועדה שואלת שאלה אחת.',
      body: ['**האם זה עומד בתכנית המתאר?**', 'היום התשובה מגיעה אחרי הדיון, בבדיקה ידנית מול טבלאות ומסמכי מדיניות.', 'חלופה שלא עומדת חוזרת לשולחן, והסבב מתחיל מחדש.'],
    },
    {
      n: '2', big: `פי ${(s.farMax / s.capFar).toFixed(1)}`, unit: 'מעל מה שהמתאר מתיר', title: `בציר הרצל, הזכויות גבוהות פי ${(s.farMax / s.capFar).toFixed(1)} ממה שהמתאר מתיר.`,
      body: [`בתמל/2022 מותר לבנות **${s.farMin.toFixed(1)}** עד **${s.farMax.toFixed(1)}** מ"ר לכל מ"ר מגרש.`, `תכנית המתאר מתירה במתחם עד **${s.capFar}**.`, `לכן, כמו שהתכנית אושרה, **${s.okRights} מתוך ${s.total}** חלופות עומדות.`],
    },
    {
      n: '3', big: `${s.lead.n}/${lots.length}`, unit: 'מגרשים', title: `כשמתאימים, ${s.lead.name} מדורג עובר בכל מגרש.`,
      body: ['המחולל מוריד צפיפות, מוסיף שטח ציבורי ומקטין דירות, עד שהחלופה עומדת.', '==כלל אחד מכריע: רבע מהדירות בבניין נמוך, עד 29 מטר.==', `בלוק עם אגף נמוך עומד בו. מגדל על מסד עובר רק ב-**${s.tower.n}** מתוך **${lots.length}** מגרשים.`],
    },
    {
      n: '4', big: pct((s.units - s.kept) / s.units), unit: 'מהדירות', title: 'העמידה עולה בדירות, ועכשיו רואים כמה.',
      body: [`בציר הרצל יורדות **${fmt(s.units - s.kept)}** מתוך **${fmt(s.units)}** דירות.`, `בכל **${s.sums.length}** התכניות יחד: **${pct((s.allUnits - s.allKept) / s.allUnits)}**.`, `המחיר משתנה מאוד: **${costOf(s.cheap)}** ב${s.cheap.plan.name}, ו-**${costOf(s.dear)}** ב${s.dear.plan.name}.`],
    },
    {
      n: '5', big: 'כמה', unit: 'במקום "האם"', title: 'ההחלטה נשארת בוועדה, עם מספר על השולחן.',
      body: ['מעל צפיפות הבסיס, כל חלופה **מותנית בהחלטת הוועדה**: הקצאה לציבור ותרומה למרחב.', 'הכלי לא מחליט. הוא מראה מה עומד, מה חוסם, וכמה זה עולה.', '==הדיון עובר מ"האם זה עובר" ל"כמה אנחנו מוכנים לשלם".=='],
    },
  ];

  return (
    <main className="page home">
      <section className="hero">
        <div className="hero-text rise">
          <p className="eyebrow">חלופה שעוברת בדיקה · אשדוד Ashdod</p>
          <h1 className="hero-h1">כל חלופה מגיעה לוועדה <strong>כשהיא כבר בדוקה</strong>.</h1>
          <p className="hero-sub">
            מגרש וזכויות נכנסים.<br />
            יוצאות <strong>שלוש חלופות בינוי</strong>, וכל אחת עם חותמת: עומדת, מותנית או לא עומדת.<br />
            הבדיקה נשענת על תכנית המתאר של אשדוד ועל מסמך המדיניות העירוני.<br />
            ומה שאף כלי לא הראה עד היום: <strong>כמה דירות עולה העמידה</strong>.
          </p>
          <div className="hero-cta">
            <button className="press btn btn-primary" onClick={() => go('/studio', { lot: hero.site.id })}>לבדוק מגרש</button>
            <button className="press btn" onClick={() => go('/compare')}>כל {PLANS.length} התכניות</button>
          </div>
        </div>
        <div className="hero-fig rise" style={{ animationDelay: '120ms' }} aria-label={`שלוש חלופות ל${hero.site.label}`}>
          {hero.mitar.map((v) => (
            <button key={v.alt.key} className="hero-alt press-card" onClick={() => go('/studio', { lot: hero.site.id, alt: v.alt.key })}>
              <Iso site={hero.site} alt={v.alt} bounds={bounds} verdict={v.verdict} compact />
              <Stamp verdict={v.verdict} score={v.counts} small />
              <span className="hero-alt-name"><bdi>{ALT_LETTER[v.alt.key]}.</bdi> {v.alt.name}</span>
            </button>
          ))}
          <p className="fig-cap">{hero.site.label} ב{PLAN.name}, ציר הרצל-המעפילים. שלוש חלופות באותו קנה מידה, אחרי התאמה למתאר.</p>
        </div>
      </section>

      <section className="story" aria-label="הסיפור">
        <h2 className="story-h">הסיפור, בחמישה צעדים</h2>
        <ol className="chapters">
          {chapters.map((c, i) => (
            <li key={c.n} className="chapter rise" style={{ animationDelay: `${150 + i * 90}ms` }}>
              <div className="ch-fig">
                <span className="ch-n">{c.n}</span>
                <span className="ch-big">{c.big}</span>
                <span className="ch-unit">{c.unit}</span>
              </div>
              <div className="ch-text">
                <h3>{c.title}</h3>
                {c.body.map((b, j) => <Rich key={j} as="p">{b}</Rich>)}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid-3">
        <div className="tone tone-problem"><h4>הבעיה</h4><p>מחולל נפחים מייצר צורות, ובודק התאמה בודק תכנית גמורה.<br />בין השניים, חלופה מגיעה לוועדה <strong>בלי לדעת אם היא עומדת</strong>.</p></div>
        <div className="tone tone-solution"><h4>הפתרון</h4><p>כל חלופה נבדקת <strong>ברגע שנוצרה</strong>, מול אותן 12 בדיקות.<br />גרסה "כמו בתכנית" לצד גרסה "מותאמת למתאר", וההפרש ביניהן הוא <strong>מחיר העמידה</strong>.</p></div>
        <div className="tone tone-insight"><h4>התובנה</h4><Rich as="p">{`==הצפיפות לא חוסמת לבד.== מה שמבדיל בין צורות הוא הדרישה לבניין נמוך לרבע מהדירות. ב-${s.noneRights} מתוך ${s.sums.length} תכניות, אף חלופה לא עוברת כמו שהתכנית תוכננה.`}</Rich></div>
      </section>

      <section className="also">
        <h2 className="section-title">מה עוד עולה מהבדיקה</h2>
        <ul className="also-list">
          <li><Rich>{`בקריית שמעון פרס החסם הוא **התמהיל**: רק **${pct(s.smallShare)}** מהדירות עד 55 מ"ר, והמדיניות מבקשת **20%**.`}</Rich></li>
          <li><Rich>{`שם גם מופיעות לראשונה חלופות **שעומדות בלי תנאי**, כי הצפיפות נמוכה מהבסיס של המתחם.`}</Rich></li>
          <li><Rich>{`ב-**${PLANS.filter((p) => p.level === 'compound').length}** מתחמים אין טבלת זכויות. הם נבדקים כמגרש מייצג, וההנחות כתובות בכל מסך.`}</Rich></li>
        </ul>
      </section>

      <section className="flow" aria-label="איך זה עובד">
        {[['מגרש וזכויות', 'מתוך התכנית עצמה'], ['שלוש חלופות', 'מגדל, בלוק, לוחות'], ['12 בדיקות', 'מתכנית המתאר והמדיניות'], ['חותמת', 'עומדת, מותנית, לא עומדת'], ['נוסח לוועדה', 'טיוטה לבדיקת המתכננת']].map(([t, d], i) => (
          <div key={t} className="flow-step rise" style={{ animationDelay: `${200 + i * 80}ms` }}>
            <span className="flow-n num">{i + 1}</span>
            <strong>{t}</strong>
            <span className="dim">{d}</span>
          </div>
        ))}
      </section>

      <section className="map-of-content">
        <h2 className="section-title">לאן ממשיכים</h2>
        <div className="grid-3">
          <button className="card press-card src-card" onClick={() => go('/studio', { lot: hero.site.id })}>
            <span className="label">סטודיו</span>
            <strong>בודקים מגרש</strong>
            <span>בוחרים תכנית ומגרש. רואים את התשריט, שלוש חלופות עם חותמת, ומה חוסם כל אחת.</span>
          </button>
          <button className="card press-card src-card" onClick={() => go('/compare')}>
            <span className="label">השוואה</span>
            <strong>{s.sums.length} תכניות, {s.lotsAll} מגרשים</strong>
            <span>איזו תכנית עוברת, איפה בתשריט, וכמה דירות עולה העמידה בכל אחת.</span>
          </button>
          <button className="card press-card src-card" onClick={() => go('/method')}>
            <span className="label">שיטה</span>
            <strong>על מה הבדיקה נשענת</strong>
            <span>הכללים והמקורות שלהם, ההנחות של המחולל, ומה נשאר לשיקול דעת המתכננת.</span>
          </button>
        </div>
      </section>

      <section className="haiku" aria-label="הייקו">
        <p className="haiku-text">קו כחול על נייר<br />המגדל מבקש קומה<br />החותמת שותקת</p>
        <p className="haiku-note">מה ההייקו מאיר: התקנה היא גבול שקט, וההחלטה מה לוותר נשארת של אדם.</p>
      </section>

      <section className="sources">
        <h2 className="section-title">נבנה משתי אפליקציות, ומפיק מה שאף אחת לא מפיקה לבד</h2>
        <div className="grid-2">
          <a className="card press-card src-card" href="https://appofapp-gh.vercel.app/" target="_blank" rel="noreferrer">
            <span className="label">יצירה · תכנון עירוני</span>
            <strong>מחולל חלופות בינוי</strong>
            <span>מגרש וזכויות נכנסים, ויוצאות שלוש חלופות נפח עם חתך, תכסית וגובה. הרעיון רשום בתיק העבודות, והמנוע שלו נבנה כאן.</span>
          </a>
          <a className="card press-card src-card" href="https://ashdod-mitar-twin.vercel.app/" target="_blank" rel="noreferrer">
            <span className="label">אבחון · תכנון עירוני</span>
            <strong>תואם מתאר</strong>
            <span>בודק תכניות מול תכנית המתאר של אשדוד. הכללים שלו עובדים כאן כמו שהם, ונבדקים מולו בכל בנייה.</span>
          </a>
        </div>
      </section>
      <p className="inspire">בהשראת <strong>יו פריס</strong> <span className="latin">Hugh Ferriss</span>, "התפתחות בניין הנסיגות", 1922: שרטוט שהופך תקנה לנפח.</p>
      <p className="disclaimer">כלי תומך החלטה. אינו מחליף הוראות דין, תכנית תקפה או שיקול דעת מוסד התכנון. תכנית המתאר 603-0528026 נמצאת בהכנה ואינה בתוקף.</p>
    </main>
  );
}
