import { briefPayload } from '../src/lib/ai';
import { generate } from '../src/lib/massing';
import { SITES } from '../src/lib/site';
import { verify } from '../src/lib/verify';
const s = SITES[0];
console.log(JSON.stringify(briefPayload(s, 'mitar', generate(s, 'mitar').map((a) => verify(s, a)))));
