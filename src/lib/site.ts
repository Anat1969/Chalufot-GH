// Site model: a lot with its rights, read from a real plan (תמל/2022) or typed by the user.
import tml from '../data/tml2022.json';
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
}

export const PLAN = tml.plan;
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

type TmlLot = (typeof tml.lots)[number];
export function siteFromLot(lot: TmlLot): Site {
  const r = rectFromRing(lot.ring, lot.areaM2);
  return {
    id: lot.lot,
    label: `מגרש ${lot.lot}`,
    planName: PLAN.name,
    areaM2: lot.areaM2,
    ...r,
    districtId: PLAN.districtId,
    residentialM2: lot.residentialM2,
    units: lot.units,
    maxFloors: lot.floors,
    commerceM2: lot.commerceM2,
    employmentM2: lot.employmentM2,
    publicM2: lot.publicM2,
    isRenewal: PLAN.isRenewal,
    distanceToMassTransit: null,
    sector: 'general',
    fabric: 'existing',
    openSpacePerUnit: +(PLAN.openSpaceM2 / PLAN.unitsTotal).toFixed(2),
    source: `${PLAN.name}, טבלה 5, תא שטח ${lot.lot}`,
  };
}

export const SITES: Site[] = tml.lots.map(siteFromLot);

/** A lot typed by the user. Rectangle 2:1 when no outline is known. */
export function customSite(v: Partial<Site> & { areaM2: number }): Site {
  const W = Math.sqrt(v.areaM2 / 2);
  return {
    id: 'custom', label: 'מגרש משלי', planName: 'הזנה ידנית', L: +(W * 2).toFixed(1), W: +W.toFixed(1), outline: null,
    districtId: 2, residentialM2: 20000, units: 160, maxFloors: null, commerceM2: 0, employmentM2: 0, publicM2: 0,
    isRenewal: true, distanceToMassTransit: null, sector: 'general', fabric: 'existing', openSpacePerUnit: null,
    source: 'הזנה ידנית של המשתמש', ...v,
  } as Site;
}

export const totalGross = (s: Pick<Site, 'residentialM2' | 'commerceM2' | 'employmentM2' | 'publicM2'>) =>
  s.residentialM2 + s.commerceM2 + s.employmentM2 + s.publicM2;
