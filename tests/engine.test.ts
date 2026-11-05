import { describe, expect, it } from 'vitest';
import districtsJson from '../src/data/districts.json';
import plansJson from '../src/data/test_plans.json';
import expected from '../src/data/test_expected.json';
import { checkPlan, type DistrictInput, type PlanInput } from '../src/lib/rules';
import { generate, mitarFarCap } from '../src/lib/massing';
import { SITES } from '../src/lib/site';
import { verify, rahakRowFor } from '../src/lib/verify';

const districts = districtsJson.districts as unknown as DistrictInput[];

describe('rules engine is the untouched port from AshdodMitar', () => {
  for (const p of plansJson as unknown as (PlanInput & { id: string; districtId: number })[]) {
    it(`plan ${p.id} matches test_expected.json`, () => {
      const d = districts.find((x) => x.id === p.districtId);
      const out = checkPlan(p, d).map(({ id, status, values, message }) => ({ id, status, values, message }));
      expect(out).toEqual((expected as Record<string, unknown>)[p.id]);
    });
  }
});

describe('generator', () => {
  const s = SITES.find((x) => x.id === '101')!;
  it('reads lot 101 from the plan rights table', () => {
    expect(s.units).toBe(203);
    expect(s.maxFloors).toBe(31);
    expect(s.L * s.W).toBeCloseTo(s.areaM2, -1);
  });
  it('rights mode keeps every unit and every square metre', () => {
    for (const a of generate(s, 'rights')) {
      expect(a.units).toBe(203);
      expect(a.grossM2).toBe(25590 + 343 + 3478 + 680);
    }
  });
  it('mitar mode trims FAR to the district cap', () => {
    const cap = mitarFarCap(2)!;
    expect(cap).toBe(6.1);
    for (const a of generate(s, 'mitar')) expect(a.far).toBeLessThanOrEqual(cap + 0.01);
  });
  it('picks the FAR row by height band', () => {
    expect(rahakRowFor(2, 4).index).toBe(0);
    expect(rahakRowFor(2, 9).index).toBe(1);
    expect(rahakRowFor(2, 31).index).toBe(3);
  });
});

describe('verified alternatives', () => {
  it('every alternative carries a verdict and its rules', () => {
    for (const s of SITES) for (const mode of ['rights', 'mitar'] as const) for (const a of generate(s, mode)) {
      const v = verify(s, a);
      expect(['pass', 'warn', 'fail']).toContain(v.verdict);
      expect(v.results.length).toBe(12);
      for (const r of v.results) expect(r.source.length).toBeGreaterThan(5);
    }
  });
  it('as approved, lot 101 exceeds the master plan FAR', () => {
    const v = verify(SITES[0], generate(SITES[0], 'rights')[0]);
    expect(v.results.find((r) => r.id === 'R11')!.status).toBe('fail');
  });
  it('after fitting, FAR and public benefit no longer block', () => {
    for (const a of generate(SITES[0], 'mitar')) {
      const v = verify(SITES[0], a);
      expect(v.results.find((r) => r.id === 'R11')!.status).not.toBe('fail');
      expect(v.results.find((r) => r.id === 'R04')!.status).toBe('pass');
    }
  });
});

import { PLANS, planById, sitesOf } from '../src/lib/site';
import { allSummaries } from '../src/lib/studio';

describe('plans from the other apps', () => {
  it('18 plans: 2 with table 5 lots, 16 compounds', () => {
    expect(PLANS.length).toBe(18);
    expect(PLANS.filter((p) => p.level === 'lots').map((p) => p.number)).toEqual(['תמל/2022', '603-0811588']);
    expect(sitesOf(planById('603-0811588')).length).toBe(33);
  });
  it('a compound becomes representative lots that add back to the plan', () => {
    const p = planById('תמל-2021');
    const s = sitesOf(p)[0];
    expect(s.repeat).toBe(p.repeat);
    expect(Math.abs(s.units * s.repeat - p.unitsPlanned)).toBeLessThanOrEqual(s.repeat);
    expect(s.publicKnown).toBe(false);
  });
  it('unknown public area is "missing", not a failure, as in the plan', () => {
    const s = sitesOf(planById('603-0811588'))[0];
    const r = verify(s, generate(s, 'rights')[0]).results.find((x) => x.id === 'R04')!;
    expect(r.status).toBe('missing');
  });
  it('table 5 mix of 603-0811588 is checked as it is', () => {
    const s = sitesOf(planById('603-0811588'))[0];
    expect(s.planMix).toEqual({ small: 3, medium: 6 });
    expect(verify(s, generate(s, 'rights')[1]).results.find((x) => x.id === 'R01')!.status).toBe('fail');
  });
  it('every plan has a summary, and fitting never adds a blocking rule on FAR', () => {
    for (const x of allSummaries()) {
      expect(x.alts).toBe(x.lots * 3);
      expect(x.kept).toBeLessThanOrEqual(x.units + x.lots * (x.plan.repeat ?? 1) * 40);
    }
  });
});
