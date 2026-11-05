// מצב הסטודיו: מגרש, מצב וחלופה בכתובת. מגרש משלי ומרחק ממתע"ן נשמרים אוטומטית ב-localStorage.
import { useEffect, useMemo, useState } from 'react';
import { generate, type AltKey, type Mode } from './massing';
import { useRoute, setParams } from './route';
import { PLANS, DEFAULT_PLAN, customSite, planById, sitesOf, type Plan, type Site } from './site';
import { verify, type Verified } from './verify';

const KEY = 'chalufot:v1';
export interface Saved { custom: Partial<Site> & { areaM2: number }; transit: Record<string, number | null>; savedAt: number | null }
const DEFAULT: Saved = { custom: { areaM2: 2400, units: 160, residentialM2: 20000, maxFloors: 25, commerceM2: 600, employmentM2: 0, publicM2: 0, districtId: 2, isRenewal: true }, transit: {}, savedAt: null };

export function loadSaved(): Saved {
  try { const s = JSON.parse(localStorage.getItem(KEY) ?? 'null'); return s ? { ...DEFAULT, ...s, custom: { ...DEFAULT.custom, ...s.custom } } : DEFAULT; } catch { return DEFAULT; }
}
function store(s: Saved) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* מצב פרטי: ממשיכים בלי שמירה */ } }

export function siteFor(plan: Plan, lot: string, saved: Saved): Site {
  const sites = sitesOf(plan);
  const base = lot === 'custom' ? customSite(saved.custom) : sites.find((s) => s.id === lot) ?? sites[0];
  const t = saved.transit[`${base.planId}:${base.id}`];
  return { ...base, distanceToMassTransit: t ?? base.distanceToMassTransit };
}

export function bestOf(list: Verified[]): Verified {
  const rank = { pass: 2, warn: 1, fail: 0 } as const;
  return [...list].sort((a, b) => rank[b.verdict] - rank[a.verdict] || b.score - a.score || b.alt.units - a.alt.units)[0];
}

/** מחיר העמידה: מבין החלופות שאינן נחסמות, זו ששומרת הכי הרבה דירות. אם כולן נחסמות, המובילה. */
export function keepBest(list: Verified[]): Verified {
  const ok = list.filter((v) => v.verdict !== 'fail').sort((a, b) => b.alt.units - a.alt.units || b.score - a.score);
  return ok[0] ?? bestOf(list);
}

export function useStudio() {
  const { q } = useRoute();
  const plan = planById(q.get('plan') ?? DEFAULT_PLAN);
  const lot = q.get('lot') ?? plan.lots[0].lot;
  const mode = (q.get('mode') === 'rights' ? 'rights' : 'mitar') as Mode;
  const [saved, setSaved] = useState<Saved>(loadSaved);
  useEffect(() => { if (saved.savedAt) store(saved); }, [saved]);
  const site = useMemo(() => siteFor(plan, lot, saved), [plan, lot, saved]);
  const verified = useMemo(() => generate(site, mode).map((a) => verify(site, a)), [site, mode]);
  const other = useMemo(() => generate(site, mode === 'mitar' ? 'rights' : 'mitar').map((a) => verify(site, a)), [site, mode]);
  const best = bestOf(verified);
  const altKey = (q.get('alt') as AltKey) || best.alt.key;
  const selected = verified.find((v) => v.alt.key === altKey) ?? best;
  const rule = q.get('rule');
  return {
    plan, lot, mode, site, verified, other, best, selected, rule, saved,
    setLot: (l: string) => setParams({ lot: l, alt: null, rule: null }),
    setPlan: (id: string) => setParams({ plan: id, lot: null, alt: null, rule: null }),
    setMode: (m: Mode) => setParams({ mode: m }),
    setAlt: (k: AltKey) => setParams({ alt: k }),
    setRule: (r: string | null) => setParams({ rule: r }),
    update: (patch: Partial<Saved>) => setSaved((s) => ({ ...s, ...patch, savedAt: Date.now() })),
  };
}

export interface LotResult { site: Site; rights: Verified[]; mitar: Verified[] }
const cache = new Map<string, LotResult[]>();
/** כל המגרשים של תכנית בשני המצבים: חומר הגלם לדף ההשוואה ולדף הבית. */
export function allLots(planId: string = DEFAULT_PLAN): LotResult[] {
  const hit = cache.get(planId);
  if (hit) return hit;
  const out = sitesOf(planById(planId)).map((site) => ({ site, rights: generate(site, 'rights').map((a) => verify(site, a)), mitar: generate(site, 'mitar').map((a) => verify(site, a)) }));
  cache.set(planId, out);
  return out;
}

export interface PlanSummary { plan: Plan; lots: number; alts: number; okRights: number; okFit: number; lotsWithFit: number; units: number; kept: number; topFail: string | null; leadName: string; leadN: number }
/** תמונת מצב לתכנית: כמה חלופות עוברות, ומה מחיר העמידה ביח"ד. במתחם, המגרש המייצג מוכפל. */
export function summarize(plan: Plan): PlanSummary {
  const lots = allLots(plan.id);
  const rep = plan.repeat ?? 1;
  const flat = (k: 'rights' | 'mitar') => lots.flatMap((l) => l[k]);
  const fails = new Map<string, { t: string; n: number }>();
  flat('rights').forEach((v) => v.blocking.forEach((r) => fails.set(r.id, { t: r.title, n: (fails.get(r.id)?.n ?? 0) + 1 })));
  const byType = (['A', 'B', 'C'] as const).map((k) => ({ name: lots[0].mitar.find((v) => v.alt.key === k)!.alt.name, n: lots.filter((l) => l.mitar.find((v) => v.alt.key === k)!.verdict !== 'fail').length }));
  const lead = [...byType].sort((a, b) => b.n - a.n)[0];
  return {
    plan, lots: lots.length, alts: lots.length * 3,
    okRights: flat('rights').filter((v) => v.verdict !== 'fail').length,
    okFit: flat('mitar').filter((v) => v.verdict !== 'fail').length,
    lotsWithFit: lots.filter((l) => l.mitar.some((v) => v.verdict !== 'fail')).length,
    units: lots.reduce((a, l) => a + l.site.units, 0) * rep,
    kept: lots.reduce((a, l) => a + keepBest(l.mitar).alt.units, 0) * rep,
    topFail: [...fails.values()].sort((a, b) => b.n - a.n)[0]?.t ?? null,
    leadName: lead.name, leadN: lead.n,
  };
}
export const allSummaries = (): PlanSummary[] => PLANS.map(summarize);

export const ALT_LETTER: Record<AltKey, string> = { A: 'א', B: 'ב', C: 'ג' };
