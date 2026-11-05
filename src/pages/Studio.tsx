import { useEffect, useMemo, useState } from 'react';
import { Iso, PlanView, Section, isoBounds } from '../components/Drawings';
import Rich, { fmt, pct } from '../components/Rich';
import Stamp from '../components/Stamp';
import HowTo from '../components/HowTo';
import PlanMap from '../components/PlanMap';
import { requestBrief, type Brief } from '../lib/ai';
import type { AltKey } from '../lib/massing';
import { CERTAINTY_LABEL, STATUS_LABEL } from '../lib/rules';
import { DISTRICTS, LEVEL_LABEL, PLANS, sitesOf } from '../lib/site';
import { ALT_LETTER, bestOf, useStudio, keepBest } from '../lib/studio';
import { VERDICT_LABEL, type Verified } from '../lib/verify';

const KEYS: AltKey[] = ['A', 'B', 'C'];
const hhmm = (t: number) => new Date(t).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

export default function Studio() {
  const s = useStudio();
  const { site, verified, other, best, selected, mode } = s;
  const bounds = useMemo(() => isoBounds(site, verified.map((v) => v.alt)), [site, verified]);
  const passing = verified.filter((v) => v.verdict !== 'fail');
  const fitted = mode === 'mitar' ? verified : other;
  const asPlan = mode === 'mitar' ? other : verified;
  const bestFit = keepBest(fitted);
  const lost = site.units - bestFit.alt.units;
  const blockCount = new Map<string, number>();
  verified.forEach((v) => v.blocking.forEach((r) => blockCount.set(r.id, (blockCount.get(r.id) ?? 0) + 1)));
  const topBlock = [...blockCount.entries()].sort((a, b) => b[1] - a[1])[0];
  const topBlockRule = topBlock ? verified.flatMap((v) => v.results).find((r) => r.id === topBlock[0]) : null;

  useEffect(() => {
    if (s.saved.savedAt) dispatchEvent(new CustomEvent('chalufot:status', { detail: `נשמר ${hhmm(s.saved.savedAt)}` }));
  }, [s.saved.savedAt]);

  const rules = verified[0].results.map((r) => r.id);
  return (
    <main className="studio">
      <aside className="col-site scroll-in" aria-label="המגרש">
        <div className="col-head">
          <h2 className="col-title">איזה מגרש בודקים?</h2>
          <HowTo>
            <p>בוחרים <strong>תכנית</strong> מתוך {PLANS.length} התכניות שבאפליקציות, ואז מגרש. אפשר גם להזין מגרש משלך.</p>
            <p>בתכנית עם טבלה 5 כל מגרש נבדק בזכויות שלו. במתחם שיש לו רק גבול ויח"ד נבדק <strong>מגרש מייצג</strong>, וההנחות כתובות מתחתיו.</p>
            <p>המחולל מייצר <strong>3</strong> חלופות נפח, וכל אחת עוברת <strong>12</strong> בדיקות של תואם מתאר.</p>
            <p>"מותאם למתאר" מקצץ ומארגן מחדש את הזכויות עד שהחלופה עומדת. "כמו בתכנית" מראה את הזכויות כפי שאושרו.</p>
            <p>לחיצה על כלל בטבלה מדגישה אותו בכל החלופות.</p>
          </HowTo>
        </div>
        <label className="fld">
          <span className="label">תכנית</span>
          <select className="field plan-select" aria-label="תכנית" value={s.plan.id} onChange={(e) => s.setPlan(e.target.value)}>
            {(['lots', 'compound'] as const).map((lv) => (
              <optgroup key={lv} label={LEVEL_LABEL[lv]}>
                {PLANS.filter((p) => p.level === lv).map((p) => <option key={p.id} value={p.id}>{p.number} · {p.name}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        <p className="col-sub"><strong>{s.plan.name}</strong>. <span className={`lvl lvl-${s.plan.level}`}>{LEVEL_LABEL[s.plan.level]}</span> <span className="src">{s.plan.status} · <bdi className="num">{fmt(s.plan.unitsPlanned)}</bdi> יח"ד · מקור: <a href={s.plan.sourceUrl} target="_blank" rel="noreferrer">{s.plan.sourceApp}</a></span></p>
        <ul className="lots">
          {sitesOf(s.plan).map((l) => (
            <li key={l.id}>
              <button className={`lot press ${s.lot === l.id ? 'is-on' : ''}`} aria-pressed={s.lot === l.id} onClick={() => s.setLot(l.id)}>
                <LotGlyph outline={l.outline} L={l.L} W={l.W} />
                <span className="lot-name">{l.label}</span>
                <span className="lot-meta"><bdi className="num">{fmt(l.units)}</bdi> יח"ד · <bdi className="num">{fmt(l.areaM2)}</bdi> מ"ר</span>
              </button>
            </li>
          ))}
          <li>
            <button className={`lot press ${s.lot === 'custom' ? 'is-on' : ''}`} aria-pressed={s.lot === 'custom'} onClick={() => s.setLot('custom')}>
              <span className="lot-glyph lot-glyph-custom" aria-hidden />
              <span className="lot-name">מגרש משלי</span>
              <span className="lot-meta">הזנה ידנית, נשמרת אוטומטית</span>
            </button>
          </li>
        </ul>
        {s.lot === 'custom' && <CustomForm s={s} />}
        <label className="fld">
          <span className="label">מרחק מציר מתע"ן, מטרים</span>
          <input className="field" type="number" inputMode="numeric" min={0} placeholder="חסר: לא ידוע" value={site.distanceToMassTransit ?? ''} onChange={(e) => s.update({ transit: { ...s.saved.transit, [`${site.planId}:${site.id}`]: e.target.value === '' ? null : +e.target.value } })} />
        </label>
        <dl className="facts">
          <div><dt className="label">מתחם</dt><dd>{DISTRICTS.find((d) => d.id === site.districtId)?.name}</dd></div>
          <div><dt className="label">רח"ק בזכויות</dt><dd><bdi className="num">{((site.residentialM2 + site.commerceM2 + site.employmentM2 + site.publicM2) / site.areaM2).toFixed(1)}</bdi></dd></div>
          <div><dt className="label">קומות בטבלה 5</dt><dd><bdi className="num">{site.maxFloors ?? 'חסר'}</bdi></dd></div>
          <div><dt className="label">{site.buildable ? 'מלבן בנייה' : 'מגרש מוכלל'}</dt><dd><bdi className="num">{Math.round(site.L)}×{Math.round(site.W)}</bdi> מ'</dd></div>
          {site.setbacks && <div className="facts-wide"><dt className="label">קווי בניין לפי צלע</dt><dd><bdi className="num">{[...new Set(site.setbacks.map((x) => x.m))].sort((a, b) => a - b).join(' · ')}</bdi> מ'</dd></div>}
        </dl>
        <p className="src">{site.source}</p>
      </aside>

      <section className="col-main" aria-label="החלופות">
        <div className="kpis">
          <div className="kpi">
            <span className="kpi-q">כמה חלופות עוברות בדיקה?</span>
            <span className="kpi-v"><bdi className="num">{passing.length}</bdi><small> מתוך 3</small></span>
            <Rich as="p" className="kpi-i">{passing.length ? `**${verified.filter((v) => v.verdict === 'warn').length}** מותנות בהחלטת הוועדה, **${verified.filter((v) => v.verdict === 'fail').length}** נחסמות` : `כל החלופות נחסמות, בעיקר ב**${topBlockRule?.title ?? ''}**`}</Rich>
          </div>
          <div className="kpi">
            <span className="kpi-q">איזו חלופה מובילה?</span>
            <span className="kpi-v kpi-name">{ALT_LETTER[best.alt.key]}. {best.alt.name}</span>
            <Rich as="p" className="kpi-i">{`**${best.counts.pass}** בדיקות עומדות, **${best.counts.warn}** מותנות, **${best.counts.fail}** חוסמות`}</Rich>
          </div>
          <div className="kpi">
            <span className="kpi-q">מה עולה העמידה במתאר?</span>
            <span className={`kpi-v ${lost > 0 ? 'is-cost' : ''}`}><bdi className="num">{lost > 0 ? `−${fmt(lost)}` : fmt(Math.abs(lost))}</bdi><small> יח"ד</small></span>
            <Rich as="p" className="kpi-i">{`==${pct(Math.max(lost, 0) / site.units)} מהדירות==: מ-**${fmt(site.units)}** בתכנית ל-**${fmt(bestFit.alt.units)}** ב${bestFit.alt.name}${site.repeat > 1 ? `. בכל המתחם, **${site.repeat}** מגרשים: **${fmt(lost * site.repeat)}** יח"ד` : ''}`}</Rich>
          </div>
        </div>

        <div className="alts">
          {verified.map((v) => (
            <AltCard key={v.alt.key} v={v} site={site} bounds={bounds} on={selected.alt.key === v.alt.key} rule={s.rule} onClick={() => s.setAlt(v.alt.key)} />
          ))}
        </div>

        <div className="matrix-wrap">
          <div className="matrix-head">
            <h3>באיזה כלל כל חלופה נופלת?</h3>
            <Rich as="p" className="chart-insight">{topBlockRule ? `==${topBlockRule.title}== חוסם **${topBlock![1]}** מתוך 3 חלופות. ${asPlan.every((v) => v.verdict === 'fail') ? 'כמו בתכנית, אף חלופה לא עוברת.' : ''}` : '==אין כלל חוסם== במצב הזה: מה שנשאר מותנה בשיקול דעת הוועדה.'}</Rich>
          </div>
          <div className="scroll-in matrix-scroll">
            <table className="matrix">
              <thead>
                <tr><th scope="col">כלל</th>{verified.map((v) => <th key={v.alt.key} scope="col" className={selected.alt.key === v.alt.key ? 'is-sel' : ''}>{ALT_LETTER[v.alt.key]}. {v.alt.name}</th>)}<th scope="col">ודאות</th></tr>
              </thead>
              <tbody>
                {rules.map((id) => {
                  const row = verified.map((v) => v.results.find((r) => r.id === id)!);
                  return (
                    <tr key={id} className={s.rule === id ? 'is-row' : s.rule ? 'is-dim' : ''} onClick={() => s.setRule(s.rule === id ? null : id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && s.setRule(s.rule === id ? null : id)} aria-selected={s.rule === id}>
                      <th scope="row">{row[0].title}</th>
                      {row.map((r, i) => <td key={i} className={`st st-${r.status} ${selected.alt.key === verified[i].alt.key ? 'is-sel' : ''}`} title={r.message}>{STATUS_LABEL[r.status]}</td>)}
                      <td className="cert">{CERTAINTY_LABEL[row[0].certainty]}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <aside className="col-detail scroll-in" aria-label="החלופה שנבחרה">
        <Detail v={selected} all={verified} s={s} />
      </aside>

      <nav className="actionbar" aria-label="פעולות">
        <div className="ab-group" role="group" aria-label="חלופה">
          {KEYS.map((k) => {
            const v = verified.find((x) => x.alt.key === k)!;
            return <button key={k} className={`press btn ab-alt v-${v.verdict}`} aria-pressed={selected.alt.key === k} onClick={() => s.setAlt(k)}>חלופה {ALT_LETTER[k]}<i className="dot" aria-hidden /></button>;
          })}
        </div>
        <div className="ab-group" role="group" aria-label="בסיס הזכויות">
          <button className="press btn" aria-pressed={mode === 'rights'} onClick={() => s.setMode('rights')}>כמו בתכנית</button>
          <button className="press btn" aria-pressed={mode === 'mitar'} onClick={() => s.setMode('mitar')}>מותאם למתאר</button>
        </div>
        <div className="ab-group">
          <button className="press btn" onClick={() => print()}>דוח לוועדה</button>
        </div>
      </nav>
    </main>
  );
}

function LotGlyph({ outline, L, W }: { outline: [number, number][] | null; L: number; W: number }) {
  const pts = outline ?? [[0, 0], [L, 0], [L, W], [0, W]];
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs), y0 = Math.min(...ys), w = Math.max(...xs) - x0, h = Math.max(...ys) - y0;
  return (
    <svg className="lot-glyph" viewBox={`${x0 - 2} ${y0 - 2} ${w + 4} ${h + 4}`} aria-hidden style={{ direction: 'ltr' }}>
      <polygon points={pts.map((p) => p.join(',')).join(' ')} />
    </svg>
  );
}

function AltCard({ v, site, bounds, on, rule, onClick }: { v: Verified; site: import('../lib/site').Site; bounds: ReturnType<typeof isoBounds>; on: boolean; rule: string | null; onClick: () => void }) {
  const r = rule ? v.results.find((x) => x.id === rule) : null;
  return (
    <button className={`alt ${on ? 'is-on-card' : ''}`} aria-pressed={on} onClick={onClick}>
      <span className="alt-head">
        <span className="alt-name"><bdi>{ALT_LETTER[v.alt.key]}.</bdi> {v.alt.name}</span>
        <Rich className="alt-thesis">{v.alt.thesis}</Rich>
      </span>
      <span className="alt-fig">
        <Iso site={site} alt={v.alt} bounds={bounds} verdict={v.verdict} />
        <Stamp verdict={v.verdict} score={v.counts} />
      </span>
      {r && <span className={`alt-rule st-${r.status}`}><Rich>{`**${r.title}:** ${r.message}`}</Rich></span>}
      <span className="alt-nums">
        <span><b className="label">יח"ד</b><bdi className="num">{fmt(v.alt.units)}</bdi></span>
        <span><b className="label">קומות</b><bdi className="num">{v.alt.maxFloors}</bdi></span>
        <span><b className="label">גובה</b><bdi className="num">{Math.round(v.alt.heightM)}</bdi></span>
        <span><b className="label">תכסית</b><bdi className="num">{pct(v.alt.coverage)}</bdi></span>
        <span><b className="label">רח"ק</b><bdi className="num">{v.alt.far.toFixed(1)}</bdi></span>
      </span>
    </button>
  );
}

function Detail({ v, all, s }: { v: Verified; all: Verified[]; s: ReturnType<typeof useStudio> }) {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [state, setState] = useState<'idle' | 'busy' | 'error'>('idle');
  const [err, setErr] = useState('');
  useEffect(() => { setBrief(null); setState('idle'); }, [s.site.id, s.mode]);
  const ask = async () => {
    setState('busy');
    try { setBrief(await requestBrief(s.site, s.mode, all)); setState('idle'); } catch (e) { setErr((e as Error).message); setState('error'); }
  };
  const order = { fail: 0, warn: 1, missing: 2, pass: 3, info: 4 } as const;
  const list = [...v.results].sort((a, b) => order[a.status] - order[b.status]);
  const altText = brief?.alternatives.find((x) => x.key === v.alt.key)?.text;
  return (
    <div className="detail">
      <p className="crumbs">{s.site.label} · {s.mode === 'mitar' ? 'מותאם למתאר' : 'כמו בתכנית'}</p>
      <h1 className="detail-title"><bdi>{ALT_LETTER[v.alt.key]}.</bdi> {v.alt.name}: {VERDICT_LABEL[v.verdict]}</h1>
      <Rich as="p" className="detail-sub">{`${v.alt.thesis} **${fmt(v.alt.units)}** יח"ד, **${v.alt.maxFloors}** קומות, **${Math.round(v.alt.heightM)}** מ'.`}</Rich>
      {s.lot !== 'custom' && (
        <PlanMap planId={s.plan.id} checked={sitesOf(s.plan).map((x) => ({ id: x.id }))} selected={s.site.id} site={s.site} alt={v.alt} onPick={(l) => s.setLot(l)} height={290}
          label={`תשריט ${s.plan.number}: ${s.site.label} ונפחי ${v.alt.name}`} />
      )}
      <div className="drawings">
        <Section site={s.site} alt={v.alt} />
        <PlanView site={s.site} alt={v.alt} />
      </div>
      {v.alt.adjustments.length > 0 && (
        <div className="tone tone-solution"><h4>מה המחולל שינה כדי לעמוד</h4>{v.alt.adjustments.map((a, i) => <Rich key={i} as="p">{a}</Rich>)}</div>
      )}
      {v.alt.notes.length > 0 && (
        <div className="tone tone-neutral"><h4>הערות תכנון</h4>{v.alt.notes.map((a, i) => <Rich key={i} as="p">{a}</Rich>)}</div>
      )}
      <h3 className="section-title">12 בדיקות, מהחוסם אל העומד</h3>
      <ul className="checks">
        {list.map((r) => (
          <li key={r.id} className={`check st-${r.status} ${s.rule === r.id ? 'is-row' : ''}`}>
            <span className="check-st">{STATUS_LABEL[r.status]}</span>
            <span className="check-body">
              <strong>{r.title}</strong>
              <Rich as="span" className="check-msg">{r.message}</Rich>
              <span className="src">{r.source} · {CERTAINTY_LABEL[r.certainty]}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="ai-box">
        <div className="ai-head">
          <h3>ניסוח לוועדה</h3>
          <button className="press btn" onClick={ask} disabled={state === 'busy'}>{state === 'busy' ? 'מנסח...' : brief ? 'ניסוח מחדש' : 'ניסוח לוועדה'}</button>
        </div>
        {state === 'idle' && !brief && <p className="dim">Gemini החינמי מנסח המלצה לוועדה מתוך הבדיקות בלבד. Claude נכנס רק כגיבוי. נשלחים רק נתוני התכנית הציבוריים.</p>}
        {state === 'error' && <p className="tone tone-problem">הניסוח לא התקבל: {err}. הבדיקות עצמן חושבו בדפדפן ותקפות. נסו שוב בעוד דקה.</p>}
        {brief && (
          <div className="brief">
            <Rich as="p" className="brief-insight">{brief.headline.insight}</Rich>
            <Rich as="p">{brief.headline.detail}</Rich>
            {altText && <><Rich as="p" className="brief-insight sm">{altText.insight}</Rich><Rich as="p">{altText.detail}</Rich></>}
            <div className="tone tone-insight"><Rich as="h4">{brief.recommendation.insight}</Rich><Rich as="p">{brief.recommendation.detail}</Rich></div>
            <ol className="steps">{brief.steps.map((x, i) => <Rich key={i} as="li">{x}</Rich>)}</ol>
            <p className="src">נוסח על ידי {brief.engine === 'gemini' ? 'Gemini (חינמי)' : 'Claude (גיבוי)'} מתוך תוצאות הבדיקה. טיוטה לבדיקת איש המקצוע.</p>
          </div>
        )}
      </div>
      <p className="disclaimer">כלי תומך החלטה. אינו מחליף הוראות דין, תכנית תקפה או שיקול דעת מוסד התכנון. תכנית 603-0528026 אינה בתוקף.</p>
    </div>
  );
}

function CustomForm({ s }: { s: ReturnType<typeof useStudio> }) {
  const c = s.saved.custom;
  const set = (k: string, v: number | boolean) => s.update({ custom: { ...c, [k]: v } });
  const num = (k: keyof typeof c, label: string) => (
    <label className="fld" key={k as string}>
      <span className="label">{label}</span>
      <input className="field" type="number" inputMode="numeric" min={0} value={(c[k] as number | undefined) ?? ''} onChange={(e) => set(k as string, +e.target.value)} />
    </label>
  );
  return (
    <div className="custom">
      {num('areaM2', 'שטח מגרש, מ"ר')}
      {num('units', 'יח"ד')}
      {num('residentialM2', 'שטח מגורים, מ"ר ברוטו')}
      {num('maxFloors', 'קומות מרביות')}
      {num('commerceM2', 'מסחר, מ"ר')}
      {num('employmentM2', 'תעסוקה, מ"ר')}
      {num('publicM2', 'שטח ציבורי בנוי, מ"ר')}
      <label className="fld">
        <span className="label">מתחם במתאר</span>
        <select className="field" value={c.districtId ?? 2} onChange={(e) => set('districtId', +e.target.value)}>
          {DISTRICTS.map((d) => <option key={d.id} value={d.id}>{d.id}. {d.name}</option>)}
        </select>
      </label>
      <label className="fld-check"><input type="checkbox" checked={c.isRenewal ?? true} onChange={(e) => set('isRenewal', e.target.checked)} /> התחדשות עירונית</label>
      {s.saved.savedAt && <p className="saved">נשמר {hhmm(s.saved.savedAt)}</p>}
    </div>
  );
}
