// שלושה שרטוטים מאותו מקור נתונים: איזומטריה, תכנית וחתך. SVG בלבד, כיוון LTR בשורש (טקסט עברי בתוויות נפרדות).
import { ASSUMPTIONS, heightOfFloors, type Alternative, type Box } from '../lib/massing';
import type { Site } from '../lib/site';
import type { Verdict } from '../lib/verify';

const C30 = Math.cos(Math.PI / 6), S30 = 0.5;
const iso = (x: number, y: number, z: number): [number, number] => [(x - y) * C30, (x + y) * S30 - z];
const pts = (a: [number, number][]) => a.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ');
const base = (b: Box) => (b.z ? heightOfFloors(b.z) : 0);
const top = (b: Box) => heightOfFloors(b.z + b.floors);

const ROLE_LABEL: Record<Box['role'], string> = { podium: 'מסד', tower: 'מגדל', bar: 'אגף נמוך', ring: 'אגף' };

export function isoBounds(site: Site, alts: Alternative[]) {
  const xs: number[] = [], ys: number[] = [];
  const push = (x: number, y: number, z: number) => { const [a, b] = iso(x, y, z); xs.push(a); ys.push(b); };
  push(0, 0, 0); push(site.L, 0, 0); push(0, site.W, 0); push(site.L, site.W, 0);
  for (const a of alts) for (const b of a.boxes) push(b.x, b.y, top(b));
  const pad = 6;
  return { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad, w: Math.max(...xs) - Math.min(...xs) + 2 * pad, h: Math.max(...ys) - Math.min(...ys) + 2 * pad };
}

/** איזומטריה: הנפחים צומחים מהקרקע (מחלקת grow), תוחם משותף כדי שהשוואה בין חלופות תהיה בקנה מידה אחד. */
export function Iso({ site, alt, bounds, verdict, compact = false, label }: { site: Site; alt: Alternative; bounds: ReturnType<typeof isoBounds>; verdict?: Verdict; compact?: boolean; label?: string }) {
  const order = [...alt.boxes].sort((a, b) => a.x + a.y + a.w + a.d - (b.x + b.y + b.w + b.d) || base(a) - base(b));
  const ground: [number, number][] = [iso(0, 0, 0), iso(site.L, 0, 0), iso(site.L, site.W, 0), iso(0, site.W, 0)];
  const sb = ASSUMPTIONS.setbackM;
  const setback: [number, number][] = [iso(sb, sb, 0), iso(site.L - sb, sb, 0), iso(site.L - sb, site.W - sb, 0), iso(sb, site.W - sb, 0)];
  return (
    <svg className={`iso v-${verdict ?? 'none'}`} viewBox={`${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`} role="img" aria-label={label ?? `${alt.name}: ${alt.maxFloors} קומות, ${alt.units} יח"ד`} style={{ direction: 'ltr' }}>
      <polygon points={pts(ground)} className="iso-lot" />
      <polygon points={pts(setback)} className="iso-setback" />
      {order.map((b, i) => {
        const z0 = base(b), z1 = top(b);
        const A = iso(b.x, b.y, z1), B = iso(b.x + b.w, b.y, z1), Cc = iso(b.x + b.w, b.y + b.d, z1), D = iso(b.x, b.y + b.d, z1);
        const Cb = iso(b.x + b.w, b.y + b.d, z0), Db = iso(b.x, b.y + b.d, z0), Bb = iso(b.x + b.w, b.y, z0);
        const lines = compact ? [] : Array.from({ length: Math.max(b.floors - 1, 0) }, (_, k) => heightOfFloors(b.z + k + 1)).filter((_, k) => b.floors < 40 || k % 2 === 0);
        return (
          <g key={i} className={`mass role-${b.role}`} style={{ animationDelay: `${i * 90}ms`, transformOrigin: `${Db[0]}px ${Db[1]}px` }}>
            <polygon points={pts([D, Cc, Cb, Db])} className="face-l" />
            <polygon points={pts([Cc, B, Bb, Cb])} className="face-r" />
            <polygon points={pts([A, B, Cc, D])} className="face-t" />
            {lines.map((z, k) => {
              const p1 = iso(b.x, b.y + b.d, z), p2 = iso(b.x + b.w, b.y + b.d, z), p3 = iso(b.x + b.w, b.y, z);
              return <polyline key={k} points={pts([p1, p2, p3])} className="floor-line" />;
            })}
          </g>
        );
      })}
    </svg>
  );
}

/** תכנית: המגרש האמיתי (כחול־קו), קו בניין, טביעת רגל ושטח פתוח. */
export function PlanView({ site, alt }: { site: Site; alt: Alternative }) {
  const pad = 4;
  const sb = ASSUMPTIONS.setbackM;
  return (
    <figure className="drawing">
      <svg viewBox={`${-pad} ${-pad} ${site.L + 2 * pad} ${site.W + 2 * pad}`} role="img" aria-label={`תכנית: תכסית ${Math.round(alt.coverage * 100)}%`} style={{ direction: 'ltr' }}>
        <rect x={0} y={0} width={site.L} height={site.W} className="plan-lot" />
        {site.outline && <polygon points={pts(site.outline)} className="plan-outline" />}
        <rect x={sb} y={sb} width={site.L - 2 * sb} height={site.W - 2 * sb} className="plan-setback" />
        {alt.boxes.filter((b) => b.z === 0).map((b, i) => <rect key={i} x={b.x} y={b.y} width={b.w} height={b.d} className={`plan-fp role-${b.role}`} />)}
        {alt.boxes.filter((b) => b.z > 0).map((b, i) => <rect key={'u' + i} x={b.x} y={b.y} width={b.w} height={b.d} className={`plan-up role-${b.role}`} />)}
      </svg>
      <figcaption>
        <span><i className="sw sw-fp" />טביעת רגל</span>
        <span><i className="sw sw-up" />נפח על המסד</span>
        <span><i className="sw sw-lot" />גבול המגרש</span>
        {site.outline && <span><i className="sw sw-outline" />צורת המגרש האמיתית</span>}
      </figcaption>
    </figure>
  );
}

/** חתך לאורך המגרש: גובה מול מעטפת טבלה 5 ומול גבול 29 מ' של בניין רב קומות (בהשראת מעטפות פריס, 1922). */
export function Section({ site, alt }: { site: Site; alt: Alternative }) {
  const env = site.maxFloors ? heightOfFloors(site.maxFloors) : null;
  const H = Math.max(alt.heightM, env ?? 0, 40) * 1.08;
  const W = site.L;
  const sx = 300 / W, sy = 200 / H;
  const X = (x: number) => 30 + x * sx, Y = (z: number) => 210 - z * sy;
  const order = [...alt.boxes].sort((a, b) => b.y - a.y);
  const ticks = [0, 10, 20, 29, 40, 60, 80, 100, 120, 150, 200, 250].filter((t) => t <= H);
  return (
    <figure className="drawing">
      <svg viewBox="0 0 340 222" role="img" aria-label={`חתך: ${Math.round(alt.heightM)} מ'`} style={{ direction: 'ltr' }}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={26} x2={334} y1={Y(t)} y2={Y(t)} className={t === 0 ? 'sec-ground' : 'sec-grid'} />
            <text x={22} y={Y(t) + 3} className="sec-tick">{t}</text>
          </g>
        ))}
        <line x1={26} x2={334} y1={Y(ASSUMPTIONS.highRiseM)} y2={Y(ASSUMPTIONS.highRiseM)} className="sec-29" />
        {env && <line x1={26} x2={334} y1={Y(env)} y2={Y(env)} className="sec-env" />}
        {order.map((b, i) => (
          <rect key={i} x={X(b.x)} y={Y(top(b))} width={b.w * sx} height={(top(b) - base(b)) * sy} className={`sec-mass role-${b.role}`}>
            <title>{`${ROLE_LABEL[b.role]}: ${b.z + b.floors} קומות`}</title>
          </rect>
        ))}
      </svg>
      <figcaption>
        <span><i className="sw sw-29" />29 מ', גבול בניין רב קומות</span>
        {env && <span><i className="sw sw-env" />{site.maxFloors} קומות, מעטפת טבלה 5</span>}
        <span>מטרים, ציר אנכי</span>
      </figcaption>
    </figure>
  );
}

export const VERDICT_CLASS: Record<Verdict, string> = { pass: 'v-pass', warn: 'v-warn', fail: 'v-fail' };
