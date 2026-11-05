import { useMemo } from 'react';
import Rich, { pct } from '../components/Rich';
import { ASSUMPTION_TEXT } from '../lib/massing';
import { allLots } from '../lib/studio';
import { RULE_CATALOG } from '../lib/verify';

export default function Method() {
  const rel = useMemo(() => {
    const all = allLots().flatMap((l) => [...l.rights, ...l.mitar]);
    const checks = all.flatMap((v) => v.results.filter((r) => r.status !== 'info'));
    const doc = checks.filter((r) => r.certainty === 'statutory' || r.certainty === 'plan-draft' || r.certainty === 'policy-draft').length;
    const missing = checks.filter((r) => r.status === 'missing').length;
    return { alts: all.length, checks: checks.length, doc, missing };
  }, []);
  return (
    <main className="page">
      <h1 className="page-title">על מה הבדיקה נשענת, ואיך היא מודדת את עצמה.</h1>
      <p className="page-sub">שלוש שכבות שקופות: מה חושב בקוד, מה ניסח מודל, ומה נשאר לאיש המקצוע.</p>

      <section className="kpis">
        <div className="kpi"><span className="kpi-q">כמה בדיקות נשענות על מסמך?</span><span className="kpi-v is-ok"><bdi className="num">{pct(rel.doc / rel.checks)}</bdi></span><Rich as="p" className="kpi-i">{`**${rel.doc}** מתוך **${rel.checks}** בדיקות ב-**${rel.alts}** חלופות`}</Rich></div>
        <div className="kpi"><span className="kpi-q">כמה חסרות נתון?</span><span className="kpi-v"><bdi className="num">{rel.missing}</bdi></span><Rich as="p" className="kpi-i">{`בעיקר **מרחק ממתע"ן**: מסומן "חסר", לא מנוחש`}</Rich></div>
        <div className="kpi"><span className="kpi-q">האם המנוע זהה לתואם מתאר?</span><span className="kpi-v is-ok"><bdi className="num">3/3</bdi></span><Rich as="p" className="kpi-i">{`תכניות הבדיקה של תואם מתאר עוברות **1:1** בכל בנייה`}</Rich></div>
      </section>

      <h2 className="section-title">שלוש השכבות</h2>
      <div className="grid-3">
        <div className="tone tone-neutral"><h4>חושב בקוד</h4><p>הנפחים, השטחים, הרח"ק, הגובה והבדיקות.<br />דטרמיניסטי, רץ בדפדפן, עובד גם בלי רשת.</p></div>
        <div className="tone tone-insight"><h4>ניסח מודל</h4><p>רק "ניסוח לוועדה": Gemini החינמי, Claude כגיבוי.<br />המודל מקבל את תוצאות הבדיקה ואינו משנה אותן.</p></div>
        <div className="tone tone-solution"><h4>קובע איש המקצוע</h4><p>תנאי סעיף 4.1.5, הצללה, רוח, תנועה, חניה ובעלויות.<br />אלה <strong>לא נמדדים</strong> כאן.</p></div>
      </div>

      <h2 className="section-title">12 הבדיקות</h2>
      <div className="table-wrap">
        <table className="catalog">
          <thead><tr><th>קוד</th><th>כלל</th><th>נוסחה</th><th>מקור</th><th>ודאות</th></tr></thead>
          <tbody>{RULE_CATALOG.map((r) => <tr key={r.id}><td><bdi className="rid">{r.id}</bdi></td><td><strong>{r.title}</strong></td><td>{r.formula}</td><td className="src">{r.source}</td><td>{r.certainty}</td></tr>)}</tbody>
        </table>
      </div>

      <h2 className="section-title">הנחות המחולל</h2>
      <p className="page-sub">כל מספר שאינו מהתכנית. משנים אותו בקוד במקום אחד, וכל החלופות מתעדכנות.</p>
      <dl className="assume">{ASSUMPTION_TEXT.map(([k, v]) => <div key={k}><dt className="label">{k}</dt><dd>{v}</dd></div>)}</dl>

      <h2 className="section-title">המקורות</h2>
      <ul className="refs">
        <li><strong>תכנית מתאר כוללנית 603-0528026</strong>, נוסח אפריל 2019. <span className="tag-warn">לא בתוקף, בהתנעה מחודשת</span>. טבלאות רח"ק למתחם, סעיפים 4.1.5, 6.1, 6.3.</li>
        <li><strong>מסמך מדיניות עירונית תכנונית</strong>, טיוטה 09/2026, פרקים 2, 4, 6, 7.</li>
        <li><strong>מנגנון תועלות ציבוריות</strong>, 05/2024, עדכון 07/2025.</li>
        <li><strong>תמל/2022</strong> 603-0380584: טבלה 5, טבלת שטחים וקובץ SHP ממבא"ת, דרך תואם מתאר.</li>
        <li><strong>מנוע הכללים</strong>: <a href="https://github.com/Anat1969/AshdodMitar/blob/main/src/lib/rules.ts" target="_blank" rel="noreferrer">AshdodMitar/src/lib/rules.ts</a>, מועתק כמו שהוא.</li>
        <li><strong>רעיון המחולל</strong>: <a href="https://appofapp-gh.vercel.app/" target="_blank" rel="noreferrer">תיק העבודות</a>, "מחולל חלופות בינוי".</li>
      </ul>
      <p className="disclaimer">כלי תומך החלטה. אינו מחליף הוראות דין, תכנית תקפה או שיקול דעת מוסד התכנון.</p>
    </main>
  );
}
