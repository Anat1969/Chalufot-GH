// Site model: a lot with its rights, read from a real plan or typed by the user.
// src/data/plans.json נבנה ב-scripts/build-plans.py משלושה מקורות: תואם מתאר, "מה נבנה סביבי" וטבלה 5.
import plansJson from '../data/plans.json';
import districtsJson from '../data/districts.json';
import type { DistrictInput } from './rules';

export interface Site {
  id: string;
  label: string;
  planName: string;
  areaM2: number;
  /** Equivalent rectangle, metres. L is the long side. */
  L: number;
  W: number;
  /** Real lot outline in the rectangle's frame (metres), when known. */
  outline: [number, number][] | null;
  districtId: number;
  residentialM2: number;
  units: number;
  maxFloors: number | null;
  commerceM2: number;
  employmentM2: number;
  publicM2: number;
  isRenewal: boolean;
  distanceToMassTransit: number | null;
  sector: 'general' | 'haredi';
  fabric: 'existing' | 'new';
  /** Plan open space attributed per unit (m²), assumption. */
  openSpacePerUnit: number | null;
  source: string;
  planId: string;
  /** false when the source has no public built area: R04 is then "חסר", not a failure. */
  publicKnown: boolean;
  /** Representative lot: how many like it make up the compound. */
  repeat: number;
  /** עיקרי מתוך ברוטו במגורים, כשטבלה 5 מפרטת אותו. אחרת הנחת המחולל. */
  netToGross?: number | null;
  /** תמהיל מטבלה 5: דירות עד 55 מ"ר, ועד 75 מ"ר (כקירוב ל-80). */
  planMix?: { small: number; medium: number } | null;
}

export interface PlanLot { lot: string; areaM2: number; residentialM2: number; units: number; floors: number | null; commerceM2: number; employmentM2: number; publicM2: number | null; residentialMainM2?: number; mix?: { small: number; medium: number }; ring: number[][] | null }
export interface Plan {
  id: string; number: string; name: string; status: string; districtId: number; level: 'lots' | 'compound';
  unitsExisting: number | null; unitsPlanned: number; isRenewal: boolean; openSpaceM2: number | null;
  compoundM2?: number; repeat?: number; source: string; sourceApp: string; sourceUrl: string; lots: PlanLot[];
}
export const PLANS_DATA = plansJson as unknown as { snapshot: string; grossPerUnit: number; netShare: number; typicalLotM2: number; plans: Plan[] };
export const PLANS = PLANS_DATA.plans;
export const DEFAULT_PLAN = PLANS[0].id;
export const planById = (id: string | null | undefined) => PLANS.find((p) => p.id === id) ?? PLANS[0];
export const LEVEL_LABEL: Record<Plan['level'], string> = { lots: 'זכויות לכל מגרש, טבלה 5', compound: 'נתוני מתחם: גבול ויח"ד בלבד' };
export const DISTRICTS = (districtsJson as unknown as { districts: (DistrictInput & { name: string; source: string })[] }).districts;
export const districtById = (id: number) => DISTRICTS.find((d) => d.id === id) ?? null;

/** Project a lon/lat ring to metres and fit an equivalent rectangle along its principal axis. */
export function rectFromRing(ring: number[][], areaM2: number): { L: number; W: number; outline: [number, number][] } {
  const lat0 = ring.reduce((a, p) => a + p[1], 0) / ring.length;
  const lon0 = ring.reduce((a, p) => a + p[0], 0) / ring.length;
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180);
  const ky = 110540;
  const pts = ring.map((p) => [(p[0] - lon0) * kx, (p[1] - lat0) * ky]);
  let sxx = 0, syy = 0, sxy = 0;
  for (const [x, y] of pts) { sxx += x * x; syy += y * y; sxy += x * y; }
  const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const c = Math.cos(-ang), s = Math.sin(-ang);
  const rot = pts.map(([x, y]) => [x * c - y * s, x * s + y * c]);
  const xs = rot.map((p) => p[0]), ys = rot.map((p) => p[1]);
  let L = Math.max(...xs) - Math.min(...xs);
  let W = Math.max(...ys) - Math.min(...ys);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  let outline = rot.map(([x, y]) => [x - minX, y - minY] as [number, number]);
  if (W > L) { [L, W] = [W, L]; outline = outline.map(([x, y]) => [y, x]); }
  const k = Math.sqrt(areaM2 / (L * W));
  return { L: +(L * k).toFixed(1), W: +(W * k).toFixed(1), outline: outline.map(([x, y]) => [x * k, y * k]) };
}

export function siteFromLot(plan: Plan, lot: PlanLot): Site {
  const r = lot.ring ? rectFromRing(lot.ring, lot.areaM2) : { L: Math.sqrt(lot.areaM2 * 2), W: Math.sqrt(lot.areaM2 / 2), outline: null };
  const compound = plan.level === 'compound';
  const repeat = plan.repeat ?? 1;
  return {
    id: lot.lot,
    label: compound ? (repeat > 1 ? `מגרש מייצג, 1 מתוך ${repeat}` : 'המתחם כמגרש אחד') : `מגרש ${lot.lot}`,
    planName: plan.number,
    areaM2: lot.areaM2,
    L: +r.L.toFixed(1), W: +r.W.toFixed(1),
    // במתחם הגבול הוא של כל המתחם, לא של המגרש המייצג: משמש רק לכיוון.
    outline: compound ? null : r.outline,
    districtId: plan.districtId,
    residentialM2: lot.residentialM2,
    units: lot.units,
    maxFloors: lot.floors,
    commerceM2: lot.commerceM2,
    employmentM2: lot.employmentM2,
    publicM2: lot.publicM2 ?? 0,
    publicKnown: lot.publicM2 != null,
    isRenewal: plan.isRenewal,
    distanceToMassTransit: null,
    sector: 'general',
    fabric: 'existing',
    openSpacePerUnit: plan.openSpaceM2 ? +(plan.openSpaceM2 / plan.unitsPlanned).toFixed(2) : null,
    source: compound
      ? `${plan.number}: ${plan.unitsPlanned} יח"ד ב-${Math.round((plan.compoundM2 ?? 0) / 1000)} דונם, חלקי ${repeat} מגרשים מייצגים (הנחה: 60% נטו, כ-4,000 מ"ר למגרש, ${PLANS_DATA.grossPerUnit} מ"ר ברוטו ליח"ד כמו בתמל/2022)`
      : `${plan.number}, טבלה 5, תא שטח ${lot.lot}`,
    planId: plan.id,
    repeat,
    planMix: lot.mix ?? null,
    netToGross: lot.residentialMainM2 ? +(lot.residentialMainM2 / lot.residentialM2).toFixed(3) : null,
  };
}

export const sitesOf = (plan: Plan): Site[] => plan.lots.map((l) => siteFromLot(plan, l));
/** מגרשי תמל/2022: התכנית הראשונה, וברירת המחדל של כל המסכים. */
export const SITES: Site[] = sitesOf(PLANS[0]);
export const PLAN = { name: PLANS[0].number, title: PLANS[0].name, status: PLANS[0].status };

/** A lot typed by the user. Rectangle 2:1 when no outline is known. */
export function customSite(v: Partial<Site> & { areaM2: number }): Site {
  const W = Math.sqrt(v.areaM2 / 2);
  return {
    id: 'custom', label: 'מגרש משלי', planName: 'הזנה ידנית', L: +(W * 2).toFixed(1), W: +W.toFixed(1), outline: null,
    districtId: 2, residentialM2: 20000, units: 160, maxFloors: null, commerceM2: 0, employmentM2: 0, publicM2: 0,
    isRenewal: true, distanceToMassTransit: null, sector: 'general', fabric: 'existing', openSpacePerUnit: null,
    source: 'הזנה ידנית של המשתמש', planId: 'custom', publicKnown: true, repeat: 1, ...v,
  } as Site;
}

export const totalGross = (s: Pick<Site, 'residentialM2' | 'commerceM2' | 'employmentM2' | 'publicM2'>) =>
  s.residentialM2 + s.commerceM2 + s.employmentM2 + s.publicM2;
