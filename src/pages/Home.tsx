import { useMemo } from 'react';
import { Iso, isoBounds } from '../components/Drawings';
import Rich, { fmt, pct } from '../components/Rich';
import Stamp from '../components/Stamp';
import { go } from '../lib/route';
import { PLAN } from '../lib/site';
import { ALT_LETTER, allLots, bestOf } from '../lib/studio';

export default function Home() {
  const lots = useMemo(allLots, []);
  const stats = useMemo(() => {
    const flat = (k: 'rights' | 'mitar') => lots.flatMap((l) => l[k]);
    const okRights = flat('rights').filter((v) => v.verdict !== 'fail').length;
    const okFit = flat('mitar').filter((v) => v.verdict !== 'fail').length;
    const byType = (['A', 'B', 'C'] as const).map((k) => ({ k, name: lots[0].mitar.find((v) => v.alt.key === k)!.alt.name, n: lots.filter((l) => l.mitar.find((v) => v.alt.key === k)!.verdict !== 'fail').length }));
    const lead = [...byType].sort((a, b) => b.n - a.n)[0];
    const units = lots.reduce((a, l) => a + l.site.units, 0);
    const kept = lots.reduce((a, l) => a + bestOf(l.mitar).alt.units, 0);
    const fails = new Map<string, { t: string; n: number }>();
    flat('rights').forEach((v) => v.blocking.forEach((r) => fails.set(r.id, { t: r.title, n: (fails.get(r.id)?.n ?? 0) + 1 })));
    const topFail = [...fails.values()].sort((a, b) => b.n - a.n)[0];
    return { okRights, okFit, total: flat('rights').length, lead, units, kept, topFail };
  }, [lots]);
  const hero = lots[0];
  const bounds = isoBounds(hero.site, hero.mitar.map((v) => v.alt));
  return (
    <main className="page home">
      <section className="hero">
        <div className="hero-text rise">
          <p className="eyebrow">מחולל חלופות בינוי + תואם מתאר</p>
          <h1 className="hero-h1"><Rich>{`**${stats.lead.name}** עובר בדיקה ב-${stats.lead.n} מתוך ${lots.length} מגרשים.`}</Rich></h1>
          <p className="hero-sub">כל חלופת נפח יוצאת מהמחולל עם <strong>חותמת</strong>.<br />12 בדיקות של תואם מתאר, לכל אחת מקור ורמת ודאות.<br />בדיקה על <strong>{PLAN.name}</strong>, ציר הרצל-המעפילים, <strong>אשדוד</strong> <span className="latin">Ashdod</span>.</p>
          <div className="hero-cta">
            <button className="press btn btn-primary" onClick={() => go('/studio', { lot: hero.site.id })}>פתיחת הסטודיו</button>
            <button className="press btn" onClick={() => go('/compare')}>כל המגרשים</button>
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
          <p className="fig-cap">{hero.site.label}, מותאם למתאר. אותו קנה מידה לשלוש החלופות.</p>
        </div>
      </section>

      <section className="kpis home-kpis" aria-label="התשובות הראשונות">
        <div className="kpi"><span className="kpi-q">כמה חלופות עומדות כמו בתכנית?</span><span className="kpi-v is-cost"><bdi className="num">{stats.okRights}</bdi><small> מתוך {stats.total}</small></span><Rich as="p" className="kpi-i">{`רח"ק התכנית **9.7** עד **13.4**, המרבי במתחם **6.1**`}</Rich></div>
        <div className="kpi"><span className="kpi-q">כמה עוברות אחרי התאמה?</span><span className="kpi-v is-ok"><bdi className="num">{stats.okFit}</bdi><small> מתוך {stats.total}</small></span><Rich as="p" className="kpi-i">{`כולן **מותנות** בסעיף 4.1.5: מעל רח"ק הבסיס **1.8**`}</Rich></div>
        <div className="kpi"><span className="kpi-q">כמה דירות עולה העמידה?</span><span className="kpi-v is-cost"><bdi className="num">−{fmt(stats.units - stats.kept)}</bdi><small> יח"ד</small></span><Rich as="p" className="kpi-i">{`==${pct((stats.units - stats.kept) / stats.units)} מהדירות== בשבעת מגרשי המגורים`}</Rich></div>
        <div className="kpi"><span className="kpi-q">מה חוסם הכי הרבה?</span><span className="kpi-v kpi-name">{stats.topFail.t}</span><Rich as="p" className="kpi-i">{`**${stats.topFail.n}** מתוך **${stats.total}** חלופות, כמו בתכנית`}</Rich></div>
      </section>

      <section className="flow" aria-label="איך זה עובד">
        {[['מגרש וזכויות', 'טבלה 5 של התכנית'], ['3 חלופות נפח', 'מגדל, בלוק, לוחות'], ['12 בדיקות', 'מנוע תואם מתאר'], ['חותמת', 'עומדת, מותנית, לא עומדת'], ['ניסוח לוועדה', 'Gemini, טיוטה לאישור']].map(([t, d], i) => (
          <div key={t} className="flow-step rise" style={{ animationDelay: `${200 + i * 80}ms` }}>
            <span className="flow-n num">{i + 1}</span>
            <strong>{t}</strong>
            <span className="dim">{d}</span>
          </div>
        ))}
      </section>

      <section className="grid-3">
        <div className="tone tone-problem"><h4>הבעיה</h4><p>מחולל נפחים מייצר צורות.<br />בודק התאמה בודק תכנית גמורה.<br />בין השניים, החלופה מגיעה לוועדה <strong>בלי לדעת אם היא עומדת</strong>.</p></div>
        <div className="tone tone-solution"><h4>הפתרון</h4><p>כל חלופה נבדקת <strong>ברגע שנוצרה</strong>.<br />"מותאם למתאר" מקצץ ומארגן מחדש עד שהיא עומדת.<br />ההפרש בין שני המצבים הוא <strong>מחיר העמידה</strong>.</p></div>
        <div className="tone tone-insight"><h4>התובנה</h4><Rich as="p">{`==רבע מהדירות עד 29 מ'== הוא הכלל שמכריע בין הטיפוסים. הבלוק המדורג עומד בו, המגדל על מסד לרוב לא.`}</Rich></div>
      </section>

      <section className="sources">
        <h2 className="section-title">נבנה משתי אפליקציות, ומפיק מה שאף אחת לא מפיקה לבד</h2>
        <div className="grid-2">
          <a className="card press-card src-card" href="https://appofapp-gh.vercel.app/" target="_blank" rel="noreferrer">
            <span className="label">יצירה · תכנון עירוני</span>
            <strong>מחולל חלופות בינוי</strong>
            <span>מגרש וזכויות נכנסים, שלוש חלופות נפח עם חתך, תכסית וגובה יוצאות. הרעיון רשום בתיק העבודות, והמנוע שלו נבנה כאן.</span>
          </a>
          <a className="card press-card src-card" href="https://ashdod-mitar-twin.vercel.app/" target="_blank" rel="noreferrer">
            <span className="label">אבחון · תכנון עירוני</span>
            <strong>תואם מתאר</strong>
            <span>מנוע הכללים של תכנית המתאר 603-0528026, מועתק כמו שהוא ונבדק מול שלוש תכניות הבדיקה שלו. קוד: github.com/Anat1969/AshdodMitar</span>
          </a>
        </div>
      </section>
      <p className="inspire">בהשראת <strong>יו פריס</strong> <span className="latin">Hugh Ferriss</span>, "התפתחות בניין הנסיגות", 1922: שרטוט שהופך תקנה לנפח.</p>
      <p className="disclaimer">כלי תומך החלטה. אינו מחליף הוראות דין, תכנית תקפה או שיקול דעת מוסד התכנון.</p>
    </main>
  );
}
