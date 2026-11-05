import { useMemo } from 'react';
import { Iso, isoBounds } from '../components/Drawings';
import Rich, { fmt, pct } from '../components/Rich';
import Stamp from '../components/Stamp';
import HowTo from '../components/HowTo';
import { go, setParams, useRoute } from '../lib/route';
import { ALT_LETTER, allLots, bestOf } from '../lib/studio';

export default function Compare() {
  const { q } = useRoute();
  const mode = q.get('mode') === 'rights' ? 'rights' : 'mitar';
  const lots = useMemo(allLots, []);
  const bounds = useMemo(() => Object.fromEntries(lots.map((l) => [l.site.id, isoBounds(l.site, l[mode].map((v) => v.alt))])), [lots, mode]);
  const cells = lots.flatMap((l) => l[mode]);
  const ok = cells.filter((v) => v.verdict !== 'fail').length;
  const byType = (['A', 'B', 'C'] as const).map((k) => ({ k, name: lots[0][mode].find((v) => v.alt.key === k)!.alt.name, n: lots.filter((l) => l[mode].find((v) => v.alt.key === k)!.verdict !== 'fail').length }));
  const lead = [...byType].sort((a, b) => b.n - a.n)[0];

  const cost = lots.map((l) => ({ id: l.site.id, label: l.site.label, plan: l.site.units, fit: bestOf(l.mitar).alt.units, name: bestOf(l.mitar).alt.name }));
  const maxU = Math.max(...cost.map((c) => c.plan));
  const lostAll = cost.reduce((a, c) => a + c.plan - c.fit, 0), planAll = cost.reduce((a, c) => a + c.plan, 0);
  const worst = [...cost].sort((a, b) => (b.plan - b.fit) / b.plan - (a.plan - a.fit) / a.plan)[0];

  const fails = new Map<string, { t: string; n: number }>();
  cells.forEach((v) => v.blocking.forEach((r) => fails.set(r.id, { t: r.title, n: (fails.get(r.id)?.n ?? 0) + 1 })));
  const failList = [...fails.entries()].sort((a, b) => b[1].n - a[1].n);

  return (
    <main className="page wide">
      <div className="page-head">
        <div>
          <h1 className="page-title"><Rich>{`${ok} מתוך ${cells.length} חלופות עוברות, ${mode === 'mitar' ? 'אחרי התאמה' : 'כמו בתכנית'}.`}</Rich></h1>
          <p className="page-sub">שבעת מגרשי המגורים של {lots[0].site.planName}, שלוש חלופות לכל מגרש, אותן 12 בדיקות.</p>
        </div>
        <div className="head-tools">
          <div className="chips" role="group" aria-label="בסיס הזכויות">
            <button className="chip-t" aria-pressed={mode === 'rights'} onClick={() => setParams({ mode: 'rights' })}>כמו בתכנית</button>
            <button className="chip-t" aria-pressed={mode === 'mitar'} onClick={() => setParams({ mode: 'mitar' })}>מותאם למתאר</button>
          </div>
          <HowTo><p>כל תא הוא חלופה במגרש.</p><p>לחיצה על תא פותחת אותה בסטודיו.</p><p>הבורר מחליף בין הזכויות כפי שאושרו לבין חלופות שהמחולל התאים למתאר.</p></HowTo>
        </div>
      </div>

      <div className="compare-layout">
      <section className="chart-card">
        <h3>באיזה מגרש כל חלופה עוברת?</h3>
        <Rich as="p" className="chart-insight">{ok ? `==${lead.name}== עובר ב-**${lead.n}** מתוך **${lots.length}** מגרשים. ${byType.filter((b) => b !== lead).map((b) => `${b.name}: **${b.n}**`).join(', ')}.` : `==אף חלופה לא עוברת== כמו בתכנית: הרח"ק בכל המגרשים מעל המרבי במתחם.`}</Rich>
        <div className="grid-lots">
          <div className="gl-h" />
          {lots[0][mode].map((v) => <div key={v.alt.key} className="gl-h">{ALT_LETTER[v.alt.key]}. {v.alt.name}</div>)}
          {lots.map((l) => (
            <div key={l.site.id} className="gl-row">
              <div className="gl-lot"><strong>{l.site.label}</strong><span className="dim"><bdi className="num">{fmt(l.site.units)}</bdi> יח"ד</span></div>
              {l[mode].map((v) => (
                <button key={v.alt.key} className={`gl-cell press-card v-${v.verdict}`} onClick={() => go('/studio', { lot: l.site.id, alt: v.alt.key, mode })} aria-label={`${l.site.label}, ${v.alt.name}`}>
                  <Iso site={l.site} alt={v.alt} bounds={bounds[l.site.id]} verdict={v.verdict} compact />
                  <Stamp verdict={v.verdict} score={v.counts} small />
                  <span className="gl-nums"><bdi className="num">{fmt(v.alt.units)}</bdi> יח"ד · <bdi className="num">{v.alt.maxFloors}</bdi> ק'</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </section>

      <div className="compare-side">
        <section className="chart-card">
          <h3>כמה דירות עולה העמידה במתאר בכל מגרש?</h3>
          <Rich as="p" className="chart-insight">{`==${pct(lostAll / planAll)} מהדירות== יורדות כדי לעמוד. הכי יקר: **${worst.label}**, מ-**${fmt(worst.plan)}** ל-**${fmt(worst.fit)}**.`}</Rich>
          <ul className="bars" aria-label="יח&quot;ד בתכנית מול יח&quot;ד בחלופה המובילה">
            {cost.map((c) => (
              <li key={c.id}>
                <span className="bar-l">{c.label}</span>
                <span className="bar-track">
                  <span className="bar bar-plan" style={{ width: `${(c.plan / maxU) * 100}%` }} />
                  <span className="bar bar-fit" style={{ width: `${(c.fit / maxU) * 100}%` }} />
                </span>
                <span className="bar-v"><bdi className="num">{fmt(c.fit)}</bdi><span className="dim">/<bdi className="num">{fmt(c.plan)}</bdi></span></span>
              </li>
            ))}
          </ul>
          <p className="legend"><span><i className="sw sw-plan" />בתכנית</span><span><i className="sw sw-fit" />בחלופה המובילה אחרי התאמה</span></p>
        </section>
        <section className="chart-card">
          <h3>איזה כלל חוסם הכי הרבה?</h3>
          <Rich as="p" className="chart-insight">{failList.length ? `==${failList[0][1].t}== חוסם **${failList[0][1].n}** מתוך **${cells.length}** חלופות${mode === 'mitar' ? ', גם אחרי ההתאמה' : ''}.` : '==אין כלל חוסם== אחרי ההתאמה.'}</Rich>
          <ul className="bars" aria-label="מספר החלופות שכל כלל חוסם">
            {failList.map(([id, f]) => (
              <li key={id}>
                <span className="bar-l"><bdi className="rid">{id}</bdi> {f.t}</span>
                <span className="bar-track"><span className="bar bar-fail" style={{ width: `${(f.n / cells.length) * 100}%` }} /></span>
                <span className="bar-v"><bdi className="num">{f.n}</bdi></span>
              </li>
            ))}
          </ul>
          <p className="legend"><span><i className="sw sw-failbar" />מספר חלופות שהכלל חוסם, מתוך {cells.length}</span></p>
        </section>
      </div>
      </div>
      <p className="disclaimer">כלי תומך החלטה. אינו מחליף הוראות דין, תכנית תקפה או שיקול דעת מוסד התכנון.</p>
    </main>
  );
}
