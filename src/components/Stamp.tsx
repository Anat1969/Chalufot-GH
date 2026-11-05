// חותמת הוועדה: תוצאת הבדיקה על גבי השרטוט. מלבן כפול, נוחתת בסיבוב קל.
import type { Status } from '../lib/rules';
import { VERDICT_LABEL, type Verdict } from '../lib/verify';

export default function Stamp({ verdict, score, small = false }: { verdict: Verdict; score: Record<Status, number>; small?: boolean }) {
  const gated = score.pass + score.warn + score.fail;
  return (
    <span className={`stamp v-${verdict} ${small ? 'sm' : ''}`} role="img" aria-label={`${VERDICT_LABEL[verdict]}, ${score.pass} מתוך ${gated} עומדות`}>
      <span className="stamp-v">{VERDICT_LABEL[verdict]}</span>
      {!small && <span className="stamp-s"><bdi className="num">{score.pass}/{gated}</bdi> עומדות{score.missing ? <> · <bdi className="num">{score.missing}</bdi> חסר</> : null}</span>}
    </span>
  );
}
