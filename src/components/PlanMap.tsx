// התשריט: גבול התכנית, ייעודי קרקע, בניינים קיימים ונפחי החלופה שנבדקת, על מפת רקע. SVG במרקטור.
// הנתונים: public/maps/<plan>.json, נבנים בסנכרון הלילי (scripts/sync_plans.py).
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Alternative } from '../lib/massing';
import { toLonLat, type Site } from '../lib/site';
import type { Verdict } from '../lib/verify';

type Ring = number[][];
interface MapData {
  bounds: [number, number, number, number] | null;
  boundary: Ring[];
  land: { lot: string; yeud: string; color: string | null; ring: Ring }[];
  buildings: { ring: Ring; h: number | null; kind: 'demolish' | 'existing' }[];
  proposed: { lot: string; ring: Ring; floors: number | null }[];
  lines: Ring[];
  credit: string;
}

const cache = new Map<string, Promise<MapData | null>>();
function load(id: string) {
  if (!cache.has(id)) cache.set(id, fetch(`./maps/${encodeURIComponent(id)}.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null));
  return cache.get(id)!;
}

const TILE = 256;
const mx = (lon: number, z: number) => ((lon + 180) / 360) * TILE * 2 ** z;
const my = (lat: number, z: number) => { const r = (lat * Math.PI) / 180; return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * TILE * 2 ** z; };
const Z = 18;
const path = (ring: Ring) => 'M' + ring.map(([x, y]) => `${mx(x, Z).toFixed(1)},${my(y, Z).toFixed(1)}`).join('L') + 'Z';

// צבעי ייעוד לפי נוהל מבא"ת, כשהשכבה לא נושאת צבע משלה.
const YEUD_COLOR: [RegExp, string][] = [[/מגורים/, '#F6D26B'], [/ציבור/, '#C8A27A'], [/שטח ציבורי פתוח|שצ"פ/, '#9FD39A'], [/דרך/, '#E9E3DA'], [/מסחר|תעסוקה/, '#D9A6D9']];
const colorOf = (yeud: string, c: string | null) => c || YEUD_COLOR.find(([r]) => r.test(yeud))?.[1] || '#EEEDE8';
const VERDICT_FILL: Record<Verdict, string> = { pass: 'var(--permit)', warn: 'var(--amber)', fail: 'var(--breach)' };

export interface PlanMapProps {
  planId: string;
  /** מגרשים שנבדקים, ותוצאת הבדיקה של כל אחד (לצביעה בהשוואה). */
  checked: { id: string; verdict?: Verdict }[];
  selected?: string | null;
  site?: Site | null;
  alt?: Alternative | null;
  onPick?: (lot: string) => void;
  height?: number | string;
  label?: string;
}

export default function PlanMap({ planId, checked, selected, site, alt, onPick, height = 260, label }: PlanMapProps) {
  const [data, setData] = useState<MapData | null | undefined>(undefined);
  const box = useRef<HTMLDivElement>(null);
  const [aspect, setAspect] = useState(1.6);
  useEffect(() => { let on = true; setData(undefined); load(planId).then((d) => on && setData(d)); return () => { on = false; }; }, [planId]);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => { const { width, height: h } = e.contentRect; if (width && h) setAspect(width / h); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const checkedSet = useMemo(() => new Map(checked.map((c) => [c.id, c.verdict])), [checked]);
  const [whole, setWhole] = useState(false);
  const repLot = useMemo(() => {
    if (!site?.frame || site.planId === 'custom' || site.outline) return null;
    return [[0, 0], [site.L, 0], [site.L, site.W], [0, site.W]].map(([u, v]) => toLonLat(site, u, v)!) as Ring;
  }, [site]);
  const focus = useMemo(() => (selected ? data?.land.find((l) => l.lot === selected)?.ring : null) ?? repLot, [data, selected, repLot]);
  const zoomed = !!focus && !whole;
  const view = useMemo(() => {
    if (!data?.bounds) return null;
    const fb = zoomed && focus ? [Math.min(...focus.map((p) => p[0])), Math.min(...focus.map((p) => p[1])), Math.max(...focus.map((p) => p[0])), Math.max(...focus.map((p) => p[1]))] : data.bounds;
    const [x0, y0, x1, y1] = fb;
    let minX = mx(x0, Z), maxX = mx(x1, Z), minY = my(y1, Z), maxY = my(y0, Z);
    // במגרש: חצי מגודל המגרש מכל צד. רואים את קווי הבניין, הרחוב והבניינים הסמוכים.
    const pad = zoomed ? Math.max(maxX - minX, maxY - minY) * 0.45 + 30 : Math.max(maxX - minX, maxY - minY) * 0.12 + 40;
    minX -= pad; maxX += pad; minY -= pad; maxY += pad;
    // הרחבה לפרופורציה של המסגרת: המפה ממלאת אותה, בלי שוליים מתים.
    let w = maxX - minX, h = maxY - minY;
    if (w / h < aspect) { const d = h * aspect - w; minX -= d / 2; w += d; } else { const d = w / aspect - h; minY -= d / 2; h += d; }
    // אריחי רקע בזום 16 (מספיק לבניינים, פחות בקשות), מוצגים בקנה מידה של זום 18.
    const tz = 16, f = 2 ** (Z - tz);
    const tiles: { x: number; y: number; href: string }[] = [];
    for (let tx = Math.floor(minX / f / TILE); tx <= Math.floor((minX + w) / f / TILE); tx++)
      for (let ty = Math.floor(minY / f / TILE); ty <= Math.floor((minY + h) / f / TILE); ty++)
        tiles.push({ x: tx * TILE * f, y: ty * TILE * f, href: `https://${'abcd'[(tx + ty) % 4]}.basemaps.cartocdn.com/light_all/${tz}/${tx}/${ty}@2x.png` });
    return { minX, minY, w, h, tiles, tileSize: TILE * f };
  }, [data, aspect, zoomed, focus]);

  // נפחי החלופה במקום האמיתי במגרש: מהמלבן השקול חזרה לקואורדינטות.
  const footprints = useMemo(() => {
    if (!site || !alt || !site.frame) return [];
    return alt.boxes.map((b) => {
      const ring = [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.d], [b.x, b.y + b.d]].map(([u, v]) => toLonLat(site, u, v)!) as Ring;
      return { ring, role: b.role, floors: b.z + b.floors };
    });
  }, [site, alt]);
  const hasDemolish = data?.buildings.some((b) => b.kind === 'demolish');
  const hasExisting = data?.buildings.some((b) => b.kind === 'existing');
  return (
    <figure className="planmap" aria-label={label ?? 'תשריט התכנית'}>
      <div className="planmap-box" ref={box} style={{ height }}>
        {focus && data && (
          <div className="pm-zoom chips" role="group" aria-label="היקף התשריט">
            <button className="chip-t" aria-pressed={!whole} onClick={() => setWhole(false)}>המגרש</button>
            <button className="chip-t" aria-pressed={whole} onClick={() => setWhole(true)}>כל התכנית</button>
          </div>
        )}
        {data === undefined && <p className="planmap-msg">טוען את התשריט...</p>}
        {data === null && <p className="planmap-msg">אין עדיין תשריט לתכנית הזו. הוא ייווצר בסנכרון הלילי.</p>}
        {view && data && (
          <svg viewBox={`${view.minX} ${view.minY} ${view.w} ${view.h}`} preserveAspectRatio="xMidYMid slice" role="img" aria-label={label ?? 'תשריט'} style={{ direction: 'ltr' }}>
            <g className="pm-tiles">{view.tiles.map((t) => <image key={t.href} href={t.href} x={t.x} y={t.y} width={view.tileSize} height={view.tileSize} />)}</g>
            {data.land.map((l) => {
              const v = checkedSet.get(l.lot);
              const isChecked = checkedSet.has(l.lot);
              return (
                <path key={'l' + l.lot} d={path(l.ring)} className={`pm-land ${isChecked ? 'is-checked' : ''} ${selected === l.lot ? 'is-sel' : ''} ${onPick && isChecked ? 'is-pick' : ''}`}
                  style={{ fill: v ? VERDICT_FILL[v] : colorOf(l.yeud, l.color) }} onClick={() => isChecked && onPick?.(l.lot)}>
                  <title>{`${l.yeud} ${l.lot}${isChecked ? ', נבדק' : ''}`}</title>
                </path>
              );
            })}
            {data.lines.map((ln, i) => <path key={'n' + i} d={'M' + ln.map(([x, y]) => `${mx(x, Z).toFixed(1)},${my(y, Z).toFixed(1)}`).join('L')} className="pm-line" />)}
            {data.buildings.map((b, i) => <path key={'b' + i} d={path(b.ring)} className={`pm-bld pm-${b.kind}`}><title>{`${b.kind === 'demolish' ? 'מבנה להריסה' : 'בניין קיים'}${b.h ? `, ${Math.round(b.h)} מ'` : ''}`}</title></path>)}
            {!alt && data.proposed.map((b, i) => <path key={'p' + i} d={path(b.ring)} className="pm-proposed"><title>{`מוצע בתכנית, מגרש ${b.lot}${b.floors ? `, ${b.floors} קומות` : ''}`}</title></path>)}
            {data.boundary.map((r, i) => <path key={'g' + i} d={path(r)} className="pm-boundary" />)}
            {repLot && <path d={path(repLot)} className="pm-rep"><title>מגרש מייצג</title></path>}
            {footprints.map((f, i) => <path key={'f' + i} d={path(f.ring)} className={`pm-alt role-${f.role}`}><title>{`החלופה: ${f.floors} קומות`}</title></path>)}
          </svg>
        )}
      </div>
      <figcaption className="pm-legend">
        <span><i className="sw sw-boundary" />גבול התכנית</span>
        {data?.land.length ? <span><i className="sw sw-res" />ייעוד מגורים</span> : null}
        {data?.land.length ? <span><i className="sw sw-pub" />ציבורי ושצ"פ</span> : null}
        {checked.some((c) => c.verdict) && <span><i className="sw sw-v" />צבע המגרש: תוצאת החלופה החסינה</span>}
        {data?.lines.length ? <span><i className="sw sw-line" />קו בניין</span> : null}
        {hasDemolish && <span><i className="sw sw-demolish" />מבנה קיים להריסה</span>}
        {hasExisting && <span><i className="sw sw-existing" />בניין קיים</span>}
        {repLot && <span><i className="sw sw-rep" />מגרש מייצג</span>}
        {footprints.length > 0 && <span><i className="sw sw-alt" />נפחי החלופה שנבדקת</span>}
        <span className="src">{data?.credit ?? ''}. רקע: © OpenStreetMap © CARTO</span>
      </figcaption>
    </figure>
  );
}
