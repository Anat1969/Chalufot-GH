// ניסוח לוועדה: Gemini החינמי דרך פונקציית Edge, Claude רק כגיבוי. המפתחות לא מגיעים לדפדפן.
// תקן הזיקוק: https://github.com/Anat1969/Claude-GH/blob/main/docs/ai-text-standard.md
import type { Verified } from './verify';
import type { Site } from './site';

export const SUPABASE_URL = 'https://ktqmwpbzcnzkhjskqisy.supabase.co';
export const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0cW13cGJ6Y256a2hqc2txaXN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxODM4OTgsImV4cCI6MjEwNTc1OTg5OH0.uPKn4hrLk16jhDoajMjPl4OmV5j1b3bMIECVmOdhWGI';
export const FN = `${SUPABASE_URL}/functions/v1/chalufot-brief`;

export interface Part { insight: string; detail: string }
export interface Brief { headline: Part; alternatives: { key: string; text: Part }[]; recommendation: Part; steps: string[]; engine: 'gemini' | 'claude' }

export function briefPayload(site: Site, mode: string, all: Verified[]) {
  return {
    site: { lot: site.label, plan: site.planName, areaM2: site.areaM2, units: site.units, maxFloors: site.maxFloors, districtId: site.districtId },
    mode: mode === 'mitar' ? 'מותאם למתאר' : 'כמו בזכויות התכנית',
    alternatives: all.map((v) => ({
      key: v.alt.key, letter: ({ A: 'א', B: 'ב', C: 'ג' } as const)[v.alt.key], name: v.alt.name, verdict: v.verdict, score: v.score, units: v.alt.units, floors: v.alt.maxFloors, heightM: v.alt.heightM,
      far: v.alt.far, coverage: v.alt.coverage, adjustments: v.alt.adjustments.map((s) => s.replace(/\*\*/g, '')),
      checks: v.results.filter((r) => r.status !== 'info').map((r) => ({ id: r.id, title: r.title, status: r.status, message: r.message, certainty: r.certainty })),
    })),
  };
}

export async function requestBrief(site: Site, mode: string, all: Verified[], signal?: AbortSignal): Promise<Brief> {
  const r = await fetch(FN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
    body: JSON.stringify(briefPayload(site, mode, all)),
    signal,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? `השרת החזיר ${r.status}`);
  return j as Brief;
}
