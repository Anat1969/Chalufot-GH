// הבודק: כל חלופה עוברת את מנוע הכללים של תואם מתאר (rules.ts, ללא שינוי), ועוד ארבעה כללי בינוי.
import { ASSUMPTIONS, type Alternative } from './massing';
import { PARAMS, checkPlan, type PlanInput, type RuleResult, type Status } from './rules';
import { districtById, type Site } from './site';

export type Verdict = 'pass' | 'warn' | 'fail';
export interface Verified { alt: Alternative; results: RuleResult[]; verdict: Verdict; counts: Record<Status, number>; score: number; blocking: RuleResult[]; reliability: number }

export const VERDICT_LABEL: Record<Verdict, string> = { pass: 'עומדת', warn: 'מותנית', fail: 'לא עומדת' };
export const RULE_SOURCE_APP = 'מנוע הכללים של תואם מתאר (src/lib/rules.ts)';

const SRC_H = 'מסמך מדיניות, פרק 4 מדיניות בינוי ומגורים (כללי מגדלים, שלב ב\')';

/** Choose the district FAR row by height band, among residential rows. */
export function rahakRowFor(districtId: number, floors: number): { index: number | null; note: string | null } {
  const d = districtById(districtId);
  if (!d) return { index: null, note: null };
  const rows = d.rahak.map((r, i) => ({ r, i })).filter(({ r }) => /^מגורים$/.test(String(r[0])) || (/מגורים/.test(String(r[0])) && !/מסחר|תיירות/.test(String(r[0]))));
  const pool = rows.length ? rows : d.rahak.map((r, i) => ({ r, i })).filter(({ r }) => /מגורים|מעורב/.test(String(r[0])));
  const band = (s: string) => { const m = s.match(/(\d+)/); return { n: m ? +m[1] : 0, up: /ומעלה/.test(s) } };
  const sorted = pool.map((x) => ({ ...x, b: band(String(x.r[1])) })).sort((a, b) => a.b.n - b.b.n);
  const fit = sorted.find((x) => !x.b.up && floors <= x.b.n);
  if (fit) return { index: fit.i, note: null };
  const up = sorted.find((x) => x.b.up);
  if (up) return { index: up.i, note: floors < up.b.n ? `${floors} קומות: אין שורה מתאימה בטבלה, הוחלה שורת "${up.r[1]}" (הנחה)` : null };
  return { index: sorted.at(-1)?.i ?? null, note: null };
}

export function toPlanInput(site: Site, a: Alternative): { input: PlanInput; rowNote: string | null } {
  const { index, note } = rahakRowFor(site.districtId, a.maxFloors);
  const plan = site.openSpacePerUnit ? site.openSpacePerUnit * a.units : 0;
  return {
    rowNote: note,
    input: {
      id: `${site.id}-${a.key}`,
      name: `${site.label}, ${a.name}`,
      districtId: site.districtId,
      status: 'pipeline',
      sector: site.sector,
      fabric: site.fabric,
      isRenewal: site.isRenewal,
      unitsAdded: a.units,
      mix: a.mix,
      addedAboveGroundArea: a.grossM2,
      publicBuiltArea: a.publicM2,
      intensive: true,
      yard: { green: Math.round(a.effectiveGreenM2 + plan), hard: Math.round(a.openGroundM2 - a.effectiveGreenM2), roofs: a.greenRoofM2, schoolyards: 0 },
      distanceToMassTransit: site.distanceToMassTransit,
      lotArea: site.areaM2,
      percolationArea: a.percolationM2,
      effectiveGreenArea: a.effectiveGreenM2,
      greenRoofArea: a.greenRoofM2,
      far: a.far,
      rahakRow: index,
    },
  };
}

function buildRules(site: Site, a: Alternative): RuleResult[] {
  const out: RuleResult[] = [];
  const isHigh = a.heightM > ASSUMPTIONS.highRiseM;
  const upfMax = a.hasPodium ? PARAMS.highRise.maxUnitsPerFloorPodium : PARAMS.highRise.maxUnitsPerFloor;
  out.push(isHigh
    ? { id: 'H01', title: 'יח"ד בקומה במגדל', status: a.maxUnitsPerFloor <= PARAMS.highRise.maxUnitsPerFloor ? 'pass' : a.maxUnitsPerFloor <= upfMax ? 'warn' : 'fail', values: { upf: a.maxUnitsPerFloor, max: PARAMS.highRise.maxUnitsPerFloor }, message: `עד ${a.maxUnitsPerFloor} יח"ד בקומה (מותר 6, ובקומת מסד 8)`, source: SRC_H, certainty: 'policy-draft' }
    : { id: 'H01', title: 'יח"ד בקומה במגדל', status: 'info', values: {}, message: 'אין בניין רב קומות: הסעיף אינו חל', source: SRC_H, certainty: 'policy-draft' });
  out.push({ id: 'H02', title: 'דירות בבניין שאינו רב קומות', status: a.nonHighRiseUnitsShare >= PARAMS.highRise.minNonHighRiseShare ? 'pass' : 'fail', values: { share: a.nonHighRiseUnitsShare }, message: `${Math.round(a.nonHighRiseUnitsShare * 100)}% מהדירות עד ${ASSUMPTIONS.highRiseM} מ' (נדרש 25%)`, source: SRC_H, certainty: 'policy-draft' });
  out.push({ id: 'H03', title: 'גובה מרבי', status: a.maxFloors <= 40 ? 'pass' : a.maxFloors <= 60 ? 'warn' : 'fail', values: { floors: a.maxFloors, heightM: a.heightM }, message: `${a.maxFloors} קומות, ${Math.round(a.heightM)} מ' (עד 40 קומות, 60 בחריג)`, source: SRC_H, certainty: 'policy-draft' });
  out.push(site.maxFloors == null
    ? { id: 'H04', title: 'קומות מול טבלת הזכויות', status: 'missing', values: {}, message: 'לא הוזן מספר קומות מרבי', source: site.source, certainty: 'missing' }
    : { id: 'H04', title: 'קומות מול טבלת הזכויות', status: a.maxFloors <= site.maxFloors ? 'pass' : 'fail', values: { floors: a.maxFloors, max: site.maxFloors }, message: `${a.maxFloors} קומות מול ${site.maxFloors} בטבלה 5`, source: site.source, certainty: 'statutory' });
  return out;
}

const ORDER = ['R11', 'R04', 'R07', 'R05', 'R01', 'H01', 'H02', 'H03', 'H04', 'R06', 'R02', 'R03'];

export function verify(site: Site, a: Alternative): Verified {
  const { input, rowNote } = toPlanInput(site, a);
  const base = checkPlan(input, districtById(site.districtId));
  if (rowNote) { const r = base.find((x) => x.id === 'R11'); if (r) r.message += `. ${rowNote}`; }
  // בלי שטח ציבורי במקור, אין מה לבדוק: חסר, לא כישלון. במצב מותאם המחולל עצמו קובע 5.5%.
  if (!site.publicKnown && a.mode === 'rights' && site.isRenewal) {
    const i = base.findIndex((x) => x.id === 'R04');
    if (i >= 0) base[i] = { ...base[i], status: 'missing', values: {}, message: 'חסר: המקור לא מפרט שטח ציבורי בנוי למגרש', certainty: 'missing' };
  }
  const results = [...base, ...buildRules(site, a)].sort((x, y) => ORDER.indexOf(x.id) - ORDER.indexOf(y.id));
  const counts = { pass: 0, fail: 0, warn: 0, info: 0, missing: 0 } as Record<Status, number>;
  results.forEach((r) => counts[r.status]++);
  const verdict: Verdict = counts.fail ? 'fail' : counts.warn ? 'warn' : 'pass';
  const gated = counts.pass + counts.fail + counts.warn;
  const score = gated ? (counts.pass + counts.warn * 0.5) / gated : 0;
  const firm = results.filter((r) => r.status !== 'info' && (r.certainty === 'statutory' || r.certainty === 'plan-draft' || r.certainty === 'policy-draft')).length;
  const all = results.filter((r) => r.status !== 'info').length;
  return { alt: a, results, verdict, counts, score: +score.toFixed(2), blocking: results.filter((r) => r.status === 'fail'), reliability: all ? +(firm / all).toFixed(2) : 0 };
}

export const RULE_CATALOG: { id: string; title: string; formula: string; source: string; certainty: string }[] = [
  { id: 'R11', title: 'רח"ק מול טבלת המתחם', formula: 'עד הבסיס: עומד. בין הבסיס למרבי: מותנה בסעיף 4.1.5. מעל המרבי: לא עומד. השורה נבחרת לפי מספר הקומות', source: 'תכנית 603-0528026, סעיף 4.1.5 וטבלאות 4.3', certainty: 'תכנית בהכנה' },
  { id: 'R04', title: 'תועלות ציבוריות', formula: 'שטח ציבורי בנוי ≥ 5.5% מהשטח מעל הקרקע, בהתחדשות עירונית', source: 'מנגנון תועלות ציבוריות, 05/2024, עדכון 07/2025', certainty: 'מדיניות טיוטה' },
  { id: 'R07', title: 'חלחול ושטח מגונן', formula: 'חלחול ≥ 15% מהמגרש בלי מרתף מתחת. מגונן אפקטיבי ≥ 20%, עד 5% מגגות', source: 'מסמך מדיניות, פרק 4', certainty: 'מדיניות טיוטה' },
  { id: 'R05', title: 'סף-בית', formula: '2 מ"ר לנפש במרקם אינטנסיבי. קשיח עד 20%, גגות עד 30% מהמשלים. כולל חלק יחסי משצ"פ התכנית', source: 'מסמך מדיניות, פרק 7', certainty: 'מדיניות טיוטה' },
  { id: 'R01', title: 'תמהיל יח"ד', formula: 'עד 55 מ"ר ≥ 20%, עד 80 מ"ר ≥ 10%, ממוצע היתרה ≤ 125 מ"ר', source: 'מסמך מדיניות, פרק 4', certainty: 'מדיניות טיוטה' },
  { id: 'H01', title: 'יח"ד בקומה במגדל', formula: 'בבניין רב קומות: עד 6 בקומה, 8 בקומת מסד', source: SRC_H, certainty: 'מדיניות טיוטה' },
  { id: 'H02', title: 'דירות בבניין שאינו רב קומות', formula: 'לפחות 25% מהדירות בבניין עד 29 מ\'', source: SRC_H, certainty: 'מדיניות טיוטה' },
  { id: 'H03', title: 'גובה מרבי', formula: 'עד 40 קומות. 41 עד 60: חריג מותנה. מעל 60: לא עומד', source: SRC_H, certainty: 'מדיניות טיוטה' },
  { id: 'H04', title: 'קומות מול טבלת הזכויות', formula: 'מספר הקומות ≤ "מעל הכניסה" בטבלה 5 של התכנית', source: 'הוראות התכנית, טבלה 5', certainty: 'תכנית מאושרת' },
  { id: 'R06', title: 'אזור חניה', formula: 'עד 300 מ\' מציר מתע"ן: אזור א. 300 עד 600: ב. מעבר: ג', source: 'תקנות החניה ופרק 6', certainty: 'חוק / תקנה' },
  { id: 'R02', title: 'אוכלוסייה נגזרת', formula: 'יח"ד × 3.3 (התחדשות), 3.5 (חדש), 5.5 (חרדי)', source: 'מסמך מדיניות, פרק 2', certainty: 'מדיניות טיוטה' },
  { id: 'R03', title: 'ביקוש לחינוך יסודי', formula: 'שנתון × 6 שכבות ÷ 30 בכיתה × דונם לכיתה', source: 'פרקים 2 ו-7', certainty: 'הנחת עבודה' },
];
