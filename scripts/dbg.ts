import { generate } from '../src/lib/massing';
import { planById, sitesOf } from '../src/lib/site';
const s = sitesOf(planById('603-0811588'))[0];
for (const a of generate(s, 'mitar')) console.log(a.key, a.units, a.residentialM2, s.netToGross, a.mix, a.adjustments);
