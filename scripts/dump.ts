import { generate } from '../src/lib/massing';
import { SITES } from '../src/lib/site';
import { verify } from '../src/lib/verify';
for (const s of SITES) for (const m of ['rights','mitar'] as const) {
  console.log(`\n== ${s.id} ${m} L=${s.L} W=${s.W}`);
  for (const a of generate(s, m)) { const v = verify(s, a);
    console.log(a.key, a.units, 'fl', a.maxFloors, 'h', a.heightM, 'cov', a.coverage, 'far', a.far, 'upf', a.maxUnitsPerFloor, 'low', a.nonHighRiseUnitsShare, 'perc', a.percolationM2, 'mix', JSON.stringify(a.mix), v.verdict, v.results.map(r=>r.id+':'+r.status).join(' '), a.notes.join('|'));
  }
}
