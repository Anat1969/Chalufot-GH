import { allSummaries } from '../src/lib/studio';
for (const s of allSummaries()) console.log(s.plan.number.padEnd(12), s.plan.level, 'lots', s.lots, 'okR', s.okRights, 'okF', s.okFit, '/', s.alts, 'units', s.units, 'kept', s.kept, 'lead', s.leadName, s.leadN, '| top', s.topFail);
