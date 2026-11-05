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
