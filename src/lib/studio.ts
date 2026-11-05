// מצב הסטודיו: מגרש, מצב וחלופה בכתובת. מגרש משלי ומרחק ממתע"ן נשמרים אוטומטית ב-localStorage.
import { useEffect, useMemo, useState } from 'react';
import { generate, type AltKey, type Mode } from './massing';
import { useRoute, setParams } from './route';
import { SITES, customSite, type Site } from './site';
import { verify, type Verified } from './verify';

const KEY = 'chalufot:v1';
export interface Saved { custom: Partial<Site> & { areaM2: number }; transit: Record<string, number | null>; savedAt: number | null }
const DEFAULT: Saved = { custom: { areaM2: 2400, units: 160, residentialM2: 20000, maxFloors: 25, commerceM2: 600, employmentM2: 0, publicM2: 0, districtId: 2, isRenewal: true }, transit: {}, savedAt: null };

export function loadSaved(): Saved {
  try { const s = JSON.parse(localStorage.getItem(KEY) ?? 'null'); return s ? { ...DEFAULT, ...s, custom: { ...DEFAULT.custom, ...s.custom } } : DEFAULT; } catch { return DEFAULT; }
}
function store(s: Saved) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* מצב פרטי: ממשיכים בלי שמירה */ } }

export function siteFor(lot: string, saved: Saved): Site {
  const base = lot === 'custom' ? customSite(saved.custom) : SITES.find((s) => s.id === lot) ?? SITES[0];
  const t = saved.transit[base.id];
  return { ...base, distanceToMassTransit: t ?? base.distanceToMassTransit };
}

export function bestOf(list: Verified[]): Verified {
  const rank = { pass: 2, warn: 1, fail: 0 } as const;
  return [...list].sort((a, b) => rank[b.verdict] - rank[a.verdict] || b.score - a.score || b.alt.units - a.alt.units)[0];
}

export function useStudio() {
  const { q } = useRoute();
  const lot = q.get('lot') ?? SITES[0].id;
  const mode = (q.get('mode') === 'rights' ? 'rights' : 'mitar') as Mode;
  const [saved, setSaved] = useState<Saved>(loadSaved);
  useEffect(() => { if (saved.savedAt) store(saved); }, [saved]);
  const site = useMemo(() => siteFor(lot, saved), [lot, saved]);
  const verified = useMemo(() => generate(site, mode).map((a) => verify(site, a)), [site, mode]);
  const other = useMemo(() => generate(site, mode === 'mitar' ? 'rights' : 'mitar').map((a) => verify(site, a)), [site, mode]);
  const best = bestOf(verified);
  const altKey = (q.get('alt') as AltKey) || best.alt.key;
  const selected = verified.find((v) => v.alt.key === altKey) ?? best;
  const rule = q.get('rule');
  return {
    lot, mode, site, verified, other, best, selected, rule, saved,
    setLot: (l: string) => setParams({ lot: l, alt: null, rule: null }),
    setMode: (m: Mode) => setParams({ mode: m }),
    setAlt: (k: AltKey) => setParams({ alt: k }),
    setRule: (r: string | null) => setParams({ rule: r }),
    update: (patch: Partial<Saved>) => setSaved((s) => ({ ...s, ...patch, savedAt: Date.now() })),
  };
}

/** כל המגרשים בשני המצבים: חומר הגלם לדף ההשוואה ולדף הבית. */
export function allLots(): { site: Site; rights: Verified[]; mitar: Verified[] }[] {
  return SITES.map((site) => ({ site, rights: generate(site, 'rights').map((a) => verify(site, a)), mitar: generate(site, 'mitar').map((a) => verify(site, a)) }));
}

export const ALT_LETTER: Record<AltKey, string> = { A: 'א', B: 'ב', C: 'ג' };
