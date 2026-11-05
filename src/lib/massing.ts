// מחולל חלופות הבינוי: מגרש וזכויות נכנסים, שלוש חלופות נפח יוצאות.
// דטרמיניסטי ורץ בלי שרת. כל מספר שאינו מהתכנית מסומן כהנחה ב-ASSUMPTIONS.
import { PARAMS } from './rules';
import { districtById, totalGross, type Site } from './site';

export type AltKey = 'A' | 'B' | 'C';
export type Mode = 'rights' | 'mitar';

export interface Box { x: number; y: number; w: number; d: number; z: number; floors: number; role: 'podium' | 'tower' | 'bar' | 'ring' }
export interface Alternative {
  key: AltKey;
  name: string;
  thesis: string;
  mode: Mode;
  boxes: Box[];
  units: number;
  residentialM2: number;
  nonResM2: number;
  publicM2: number;
  grossM2: number;
  footprintM2: number;
  coverage: number;
  far: number;
  maxFloors: number;
  heightM: number;
  maxUnitsPerFloor: number;
  hasPodium: boolean;
  nonHighRiseUnitsShare: number;
  openGroundM2: number;
  percolationM2: number;
  effectiveGreenM2: number;
  greenRoofM2: number;
  mix: { small: number; medium: number; rest: number; restAvgArea: number };
  /** What the generator changed to fit the master plan (mode mitar). */
  adjustments: string[];
  notes: string[];
}

export const ASSUMPTIONS = {
  groundFloorM: 5,
  floorM: 3.2,
  setbackM: 3,
  barDepthM: 12,
  netToGross: 0.8,
  smallUnitNet: 50,
  mediumUnitNet: 75,
  highRiseM: 29,
  softShareOfOpen: 0.7,
  basementShare: { A: 0.8, B: 0.75, C: 0.7 } as Record<AltKey, number>,
  greenRoofShare: { A: 0.5, B: 0.3, C: 0.3 } as Record<AltKey, number>,
  mixShares: { A: [0.2, 0.15], B: [0.25, 0.2], C: [0.22, 0.12] } as Record<AltKey, [number, number]>,
};

export const ASSUMPTION_TEXT: [string, string][] = [
  ['גובה קומה', `${ASSUMPTIONS.floorM} מ', קומת קרקע ${ASSUMPTIONS.groundFloorM} מ'`],
  ['קווי בניין', `${ASSUMPTIONS.setbackM} מ' מכל גבול, במגרש מוכלל למלבן שקול`],
  ['עומק אגף', `${ASSUMPTIONS.barDepthM} מ' בבלוק ובלוחות`],
  ['עיקרי מתוך ברוטו', `${ASSUMPTIONS.netToGross * 100}% לחישוב תמהיל`],
  ['דירה קטנה ובינונית', `${ASSUMPTIONS.smallUnitNet} ו-${ASSUMPTIONS.mediumUnitNet} מ"ר נטו`],
  ['בניין רב קומות', `מעל ${ASSUMPTIONS.highRiseM} מ', לפי הגדרת תקנות התכנון והבנייה`],
  ['מרתף מתחת למגרש', 'מגדל 80%, בלוק 75% (החצר לא נחפרת), לוחות 70%'],
  ['תמהיל', 'נקודת פתיחה לפי טיפוס, והמחולל מעלה את הבינוניות עד שממוצע היתרה עד 125 מ"ר'],
  ['גינון מתוך שטח פתוח', `${ASSUMPTIONS.softShareOfOpen * 100}%, היתר שבילים`],
  ['שצ"פ התכנית למגרש', 'חלק יחסי לפי מספר יח"ד'],
];

const hOf = (floors: number) => (floors <= 0 ? 0 : ASSUMPTIONS.groundFloorM + (floors - 1) * ASSUMPTIONS.floorM);
const area = (b: Box) => b.w * b.d;

/** The master plan's maximal FAR for residential or mixed rows in the district. */
export function mitarFarCap(districtId: number): number | null {
  const d = districtById(districtId);
  if (!d) return null;
  const rows = d.rahak.filter((r) => /מגורים|מעורב/.test(String(r[0])) && typeof r[3] === 'number');
  return rows.length ? Math.max(...rows.map((r) => r[3] as number)) : null;
}

interface Program { residentialM2: number; units: number; commerceM2: number; employmentM2: number; publicM2: number; adjustments: string[] }

/** Mode "mitar": trim to the district FAR cap and raise public area to 5.5% of the added area. */
export function program(site: Site, mode: Mode, capOverride?: number | null): Program {
  const base: Program = { residentialM2: site.residentialM2, units: site.units, commerceM2: site.commerceM2, employmentM2: site.employmentM2, publicM2: site.publicM2, adjustments: [] };
  if (mode === 'rights') return base;
  const p = { ...base, adjustments: [] as string[] };
  const cap = capOverride ?? mitarFarCap(site.districtId);
  const gross = totalGross(site);
  if (cap && gross / site.areaM2 > cap) {
    const s = (cap * site.areaM2) / gross;
    p.residentialM2 = Math.round(site.residentialM2 * s);
    p.units = Math.floor(site.units * s);
    p.commerceM2 = Math.round(site.commerceM2 * s);
    p.employmentM2 = Math.round(site.employmentM2 * s);
    p.publicM2 = Math.round(site.publicM2 * s);
    p.adjustments.push(`רח"ק ירד מ-**${(gross / site.areaM2).toFixed(1)}** ל-**${cap}**, המרבי לשורת הגובה: **${site.units - p.units}** יח"ד פחות`);
  }
  if (site.isRenewal) {
    const total = p.residentialM2 + p.commerceM2 + p.employmentM2 + p.publicM2;
    const need = Math.ceil(total * PARAMS.publicBenefitShare);
    if (p.publicM2 < need) {
      const move = need - p.publicM2;
      const g = p.residentialM2 / p.units;
      p.residentialM2 -= move;
      const before = p.units;
      p.units = Math.floor(p.residentialM2 / g);
      p.publicM2 = need;
      p.adjustments.push(`שטח ציבורי הועלה ל-**${need.toLocaleString('he-IL')}** מ"ר (5.5%) על חשבון מגורים: **${before - p.units}** יח"ד פחות`);
    }
  }
  const avgNet = (p.residentialM2 * ASSUMPTIONS.netToGross) / p.units;
  if (avgNet > MAX_AVG_NET) {
    const before = p.units;
    p.units = Math.ceil((p.residentialM2 * ASSUMPTIONS.netToGross) / MAX_AVG_NET);
    p.adjustments.push(`דירות קטנות יותר לתמהיל תקין: **${p.units - before}+** יח"ד באותו שטח`);
  }
  return p;
}

/** תמהיל: נקודת פתיחה לפי טיפוס, ואם ממוצע היתרה גדול מדי יורדים אל המינימום (20% קטנות, 10% בינוניות). */
function mixFor(key: AltKey, units: number, residentialM2: number) {
  const net = residentialM2 * ASSUMPTIONS.netToGross;
  const calc = (sS: number, sM: number) => {
    const small = Math.ceil(units * sS);
    const medium = Math.ceil(units * sM);
    const rest = Math.max(units - small - medium, 0);
    const restAvgArea = rest ? Math.round((net - small * ASSUMPTIONS.smallUnitNet - medium * ASSUMPTIONS.mediumUnitNet) / rest) : 0;
    return { small, medium, rest, restAvgArea };
  };
  const first = calc(...ASSUMPTIONS.mixShares[key]);
  return first.restAvgArea <= 125 ? first : calc(PARAMS.mix.smallShare, PARAMS.mix.mediumShare);
}

/** הדירה הממוצעת הגדולה ביותר (נטו) שעוד מאפשרת תמהיל תקין במינימום. */
export const MAX_AVG_NET = Math.floor(PARAMS.mix.smallShare * 50 + PARAMS.mix.mediumShare * 75 + (1 - PARAMS.mix.smallShare - PARAMS.mix.mediumShare) * 125) - 1;

function finish(key: AltKey, name: string, thesis: string, mode: Mode, site: Site, p: Program, boxes: Box[], resBoxes: { box: Box; units: number; upf: number }[], notes: string[]): Alternative {
  const ground = boxes.filter((b) => b.z === 0);
  const footprint = ground.reduce((a, b) => a + area(b), 0);
  const open = Math.max(site.areaM2 - footprint, 0);
  const nonRes = p.commerceM2 + p.employmentM2 + p.publicM2;
  const gross = p.residentialM2 + nonRes;
  const top = Math.max(...boxes.map((b) => b.z + b.floors));
  const tops = boxes.map((b) => hOf(b.z + b.floors));
  const units = resBoxes.reduce((a, r) => a + r.units, 0);
  const low = resBoxes.filter((r) => hOf(r.box.z + r.box.floors) <= ASSUMPTIONS.highRiseM).reduce((a, r) => a + r.units, 0);
  const high = resBoxes.filter((r) => hOf(r.box.z + r.box.floors) > ASSUMPTIONS.highRiseM);
  const roofs = boxes.filter((b) => b.role !== 'tower').reduce((a, b) => a + area(b), 0) - boxes.filter((b) => b.role === 'tower' && b.z > 0).reduce((a, b) => a + area(b), 0);
  return {
    key, name, thesis, mode, boxes,
    units, residentialM2: p.residentialM2, nonResM2: nonRes, publicM2: p.publicM2, grossM2: gross,
    footprintM2: Math.round(footprint), coverage: +(footprint / site.areaM2).toFixed(3), far: +(gross / site.areaM2).toFixed(2),
    maxFloors: top, heightM: +Math.max(...tops).toFixed(1),
    maxUnitsPerFloor: high.length ? Math.max(...high.map((r) => r.upf)) : Math.max(0, ...resBoxes.map((r) => r.upf)),
    hasPodium: boxes.some((b) => b.role === 'podium'),
    nonHighRiseUnitsShare: units ? +(low / units).toFixed(3) : 0,
    openGroundM2: Math.round(open),
    percolationM2: Math.round(Math.min(open, site.areaM2 * (1 - ASSUMPTIONS.basementShare[key]))),
    effectiveGreenM2: Math.round(open * ASSUMPTIONS.softShareOfOpen),
    greenRoofM2: Math.round(Math.max(roofs, 0) * ASSUMPTIONS.greenRoofShare[key]),
    mix: mixFor(key, units, p.residentialM2),
    adjustments: p.adjustments,
    notes,
  };
}

type Res = { box: Box; units: number; upf: number };
const LOW_FLOORS = 8; // 5 + 7 × 3.2 = 27.4 מ', מתחת ל-29 מ'

/** אגף נמוך (עד 29 מ') לרבע מהדירות. מחזיר את האגף, היחידות והאורך שתפס. */
function lowWing(x0: number, y0: number, maxLen: number, depth: number, z: number, units: number, g: number): Res | null {
  const floors = LOW_FLOORS - z;
  if (floors < 2 || maxLen < 12) return null;
  const need = Math.ceil(units * PARAMS.highRise.minNonHighRiseShare);
  const len = Math.min((need * g) / (floors * depth), maxLen);
  const u = Math.floor((len * depth * floors) / g);
  const box: Box = { x: x0 - len, y: y0, w: len, d: depth, z, floors, role: 'bar' };
  return { box, units: Math.min(u, units), upf: Math.ceil(u / floors / 2) };
}

/** א: מגדל על מסד. קרקע פנויה ככל האפשר, הצפיפות לגובה. */
export function towerOnPodium(site: Site, mode: Mode, cap?: number | null): Alternative {
  const p = program(site, mode, cap);
  const sb = ASSUMPTIONS.setbackM;
  const nonRes = p.commerceM2 + p.employmentM2 + p.publicM2;
  const g = p.residentialM2 / p.units;
  const upf = PARAMS.highRise.maxUnitsPerFloor;
  const side = Math.sqrt(upf * g);
  const pw = Math.max(site.L - 2 * sb, side);
  const pd = Math.max(Math.min(site.W - 2 * sb, (0.55 * site.areaM2) / pw), side);
  const podiumFloors = Math.min(Math.max(Math.ceil(nonRes / (pw * pd)), 1), 3);
  const boxes: Box[] = [{ x: sb, y: sb, w: pw, d: pd, z: 0, floors: podiumFloors, role: 'podium' }];
  const res: Res[] = [];
  const notes: string[] = [];
  let towerZone = pw;
  let left = p.units;
  if (mode === 'mitar') {
    const dw = Math.min(ASSUMPTIONS.barDepthM, pd / 2);
    const w1 = lowWing(sb + pw, sb, pw - side - 8, dw, podiumFloors, p.units, g);
    if (w1) {
      boxes.push(w1.box); res.push(w1); left -= w1.units;
      const need = Math.ceil(p.units * PARAMS.highRise.minNonHighRiseShare) - w1.units;
      if (need > 0 && pd >= 2 * dw) {
        const w2 = lowWing(sb + pw, sb + pd - dw, w1.box.w, dw, podiumFloors, need / PARAMS.highRise.minNonHighRiseShare, g);
        if (w2) { boxes.push(w2.box); res.push(w2); left -= w2.units; }
      }
      const low = p.units - left;
      towerZone = pw - w1.box.w - 8;
      notes.push(`אגפי רחוב נמוכים על המסד: **${low}** יח"ד עד 29 מ'`);
    }
  }
  const capF = site.maxFloors ?? 40;
  let n = 1;
  let tf = Math.ceil(left / (n * upf));
  while (podiumFloors + tf > capF && n < 4) { n++; tf = Math.ceil(left / (n * upf)); }
  if (n * side + (n - 1) * 12 > towerZone) notes.push(`**${n}** מגדלים צפופים: המרווח ביניהם קטן מ-12 מ'`);
  const gap = n > 1 ? Math.max((towerZone - n * side) / (n - 1), 0) : 0;
  for (let i = 0; i < n; i++) {
    const u = Math.ceil(left / (n - i));
    left -= u;
    const f = Math.ceil(u / upf);
    const x = n === 1 ? sb + Math.max((towerZone - side) / 2, 0) : sb + i * (side + gap);
    const t: Box = { x, y: sb + (pd - side) / 2, w: side, d: side, z: podiumFloors, floors: f, role: 'tower' };
    boxes.push(t);
    res.push({ box: t, units: u, upf: Math.ceil(u / f) });
  }
  return finish('A', 'מגדל על מסד', 'מקסימום **קרקע פנויה**, הצפיפות עולה לגובה.', mode, site, p, boxes, res, notes);
}

/** ב: בלוק היקפי. דופן רחוב רציפה וחצר פנימית, גובה בינוני. */
export function perimeterBlock(site: Site, mode: Mode, cap?: number | null): Alternative {
  const p = program(site, mode, cap);
  const sb = ASSUMPTIONS.setbackM;
  const D = ASSUMPTIONS.barDepthM;
  const iw = site.L - 2 * sb, id = site.W - 2 * sb;
  const notes: string[] = [];
  const boxes: Box[] = [];
  const twoBars = id < 2 * D + 10;
  if (twoBars) {
    notes.push('המגרש צר לחצר סגורה: **שני אגפים** מקבילים');
    const d = Math.min(D, id / 2 - 2);
    boxes.push({ x: sb, y: sb, w: iw, d, z: 0, floors: 0, role: 'ring' }, { x: sb, y: sb + id - d, w: iw, d, z: 0, floors: 0, role: 'ring' });
  } else {
    boxes.push(
      { x: sb, y: sb, w: iw, d: D, z: 0, floors: 0, role: 'ring' },
      { x: sb, y: sb + id - D, w: iw, d: D, z: 0, floors: 0, role: 'ring' },
      { x: sb, y: sb + D, w: D, d: id - 2 * D, z: 0, floors: 0, role: 'ring' },
      { x: sb + iw - D, y: sb + D, w: D, d: id - 2 * D, z: 0, floors: 0, role: 'ring' },
    );
  }
  const ring = boxes.reduce((a, b) => a + area(b), 0);
  const gross = p.residentialM2 + p.commerceM2 + p.employmentM2 + p.publicM2;
  const floors = Math.ceil(gross / ring);
  const cores = Math.max(2, Math.round((twoBars ? 2 * iw : 2 * (iw + id)) / 30));
  const upf = Math.ceil(p.units / Math.max(floors - 1, 1) / cores);
  const res: Res[] = [];
  if (mode === 'mitar' && floors > LOW_FLOORS && boxes.length >= 2) {
    // מדרג: האגף הדרומי נמוך (עד 29 מ'), השאר עולים. אור לחצר ורבע מהדירות בגובה הרחוב.
    const low = boxes[1];
    low.floors = LOW_FLOORS;
    const lowUnits = Math.floor((area(low) * (LOW_FLOORS - 1)) / (p.residentialM2 / p.units));
    const restRing = ring - area(low);
    const hf = Math.ceil((gross - area(low) * LOW_FLOORS) / restRing);
    boxes.forEach((b) => { if (b !== low) b.floors = hf; });
    const hiUnits = p.units - lowUnits;
    boxes.forEach((b) => res.push(b === low ? { box: b, units: lowUnits, upf } : { box: b, units: Math.round((hiUnits * area(b)) / restRing), upf }));
    notes.push(`מדרג: אגף אחד ב-**${LOW_FLOORS}** קומות, השאר ב-**${hf}**`);
  } else {
    boxes.forEach((b) => (b.floors = floors));
    boxes.forEach((b) => res.push({ box: b, units: Math.round((p.units * area(b)) / ring), upf }));
  }
  res[0].units += p.units - res.reduce((a, r) => a + r.units, 0);
  const top = Math.max(...boxes.map((b) => b.floors));
  if (top > 12) notes.push(`בלוק של **${top}** קומות: החצר הופכת לבאר מוצלת`);
  return finish('B', 'בלוק היקפי', 'דופן **רחוב רציפה** וחצר פנימית, בגובה בינוני.', mode, site, p, boxes, res, notes);
}

/** ג: לוחות ונקודה. רבע מהדירות בגובה הרחוב, השאר במגדל אחד. */
export function barsAndPoint(site: Site, mode: Mode, cap?: number | null): Alternative {
  const p = program(site, mode, cap);
  const sb = ASSUMPTIONS.setbackM;
  const D = ASSUMPTIONS.barDepthM;
  const iw = site.L - 2 * sb, id = site.W - 2 * sb;
  const g = p.residentialM2 / p.units;
  const nonRes = p.commerceM2 + p.employmentM2 + p.publicM2;
  const upf = PARAMS.highRise.maxUnitsPerFloor;
  const side = Math.sqrt(upf * g);
  const twoBars = id >= 2 * D + 8;
  const nb = twoBars ? 2 : 1;
  const d = Math.min(D, id);
  const fit = mode === 'mitar';
  // במצב מותאם: המסחר יורד לבסיס המגדל, והלוחות מתארכים עד שהם מכילים רבע מהדירות.
  const barNonRes = fit ? 0 : nonRes;
  const minLow = Math.ceil(p.units * PARAMS.highRise.minNonHighRiseShare);
  const maxBl = Math.max(iw - side - 6, 12);
  const bl = fit ? Math.min(Math.max(((minLow * g) / (LOW_FLOORS - 1) + barNonRes) / (nb * d), iw * 0.4), maxBl) : iw * 0.55;
  const bars: Box[] = [{ x: sb + iw - bl, y: sb, w: bl, d, z: 0, floors: LOW_FLOORS, role: 'bar' }];
  if (twoBars) bars.push({ x: sb + iw - bl, y: sb + id - D, w: bl, d: D, z: 0, floors: LOW_FLOORS, role: 'bar' });
  const barArea = bars.reduce((a, b) => a + area(b) * b.floors, 0);
  const barRes = Math.max(barArea - barNonRes - (fit ? bars.reduce((a, b) => a + area(b), 0) : 0), 0);
  const barUnits = Math.min(Math.floor(barRes / g), p.units);
  const notes: string[] = [];
  if (barUnits < minLow) notes.push(`הלוחות מכילים **${barUnits}** יח"ד, פחות מרבע${fit ? '' : ': המסחר תופס את קומות הקרקע'}`);
  const tUnits = p.units - barUnits;
  const boxes: Box[] = [...bars];
  const res: Res[] = bars.map((b) => ({ box: b, units: Math.round(barUnits / bars.length), upf: Math.ceil(barUnits / bars.length / LOW_FLOORS / 2) }));
  res[0].units += barUnits - res.reduce((a, r) => a + r.units, 0);
  if (tUnits > 0) {
    const baseFloors = fit ? Math.max(Math.ceil(nonRes / (side * side)), 1) : 0;
    const capF = site.maxFloors ?? 40;
    const w = Math.min(side, iw - bl - 6);
    const dd = w < side ? Math.min((side * side) / w, id) : side;
    const two = fit && Math.ceil(tUnits / upf) + baseFloors > capF && id >= 2 * dd + 12;
    const n = two ? 2 : 1;
    if (w < side) notes.push('המגדל נמתח לעומק: אין רוחב מספיק לצד הלוחות');
    if (two) notes.push('שתי נקודות במקום אחת: כדי לא לחרוג ממספר הקומות בטבלה');
    let left = tUnits;
    for (let i = 0; i < n; i++) {
      const u = Math.ceil(left / (n - i));
      left -= u;
      const tf = Math.ceil(u / upf) + baseFloors;
      const y = n === 1 ? sb + (id - dd) / 2 : i === 0 ? sb : sb + id - dd;
      const t: Box = { x: sb, y, w, d: dd, z: 0, floors: tf, role: 'tower' };
      boxes.push(t);
      res.push({ box: t, units: u, upf: Math.ceil(u / Math.max(tf - baseFloors, 1)) });
    }
  }
  return finish('C', 'לוחות ונקודה', '**גובה רחוב** לשכונה, מגדל אחד לנוף.', mode, site, p, boxes, res, notes);
}

const MAKERS = [towerOnPodium, perimeterBlock, barsAndPoint];

/** הרח"ק המרבי בשורת הגובה של החלופה. */
export function rowMaxFar(districtId: number, floors: number): number | null {
  const d = districtById(districtId);
  const rows = d?.rahak ?? [];
  const res = rows.map((r) => ({ r, n: +(String(r[1]).match(/\d+/)?.[0] ?? 0), up: /ומעלה/.test(String(r[1])) })).filter((x) => /^מגורים$/.test(String(x.r[0])) && typeof x.r[3] === 'number').sort((a, b) => a.n - b.n);
  const hit = res.find((x) => !x.up && floors <= x.n) ?? res.find((x) => x.up) ?? res.at(-1);
  return hit ? (hit.r[3] as number) : mitarFarCap(districtId);
}

/** במצב מותאם: מחפשים לכל טיפוס את הרח"ק שמתאים לשורת הגובה שלו, עד שהם מתייצבים. */
export function generate(site: Site, mode: Mode): Alternative[] {
  return MAKERS.map((make) => {
    let a = make(site, mode);
    if (mode !== 'mitar') return a;
    for (let i = 0; i < 5; i++) {
      const cap = rowMaxFar(site.districtId, a.maxFloors);
      if (cap == null || a.far <= cap + 0.005) break;
      a = make(site, mode, cap);
    }
    return a;
  });
}
export { hOf as heightOfFloors };
