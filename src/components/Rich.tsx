// טקסט עשיר: **מודגש**, ==תובנה== (מרקר), ומספרים מודגשים אוטומטית בכיוון LTR מבודד.
import { Fragment } from 'react';

const TOKEN = /(\*\*[^*]+\*\*|==[^=]+==)/g;
const NUM = /(\d[\d,]*(?:\.\d+)?%?)/g;

function Numbers({ text }: { text: string }) {
  return <>{text.split(NUM).map((part, i) => (i % 2 ? <bdi key={i} className="num">{part}</bdi> : <Fragment key={i}>{part}</Fragment>))}</>;
}

export default function Rich({ children, as: Tag = 'span', className }: { children: string; as?: 'span' | 'p' | 'div' | 'h1' | 'h2' | 'h3' | 'h4' | 'li' | 'strong'; className?: string }) {
  const parts = String(children).split(TOKEN);
  return (
    <Tag className={className}>
      {parts.map((part, i) => {
        if (part.startsWith('**')) return <strong key={i}><Numbers text={part.slice(2, -2)} /></strong>;
        if (part.startsWith('==')) return <mark key={i} className="insight"><Numbers text={part.slice(2, -2)} /></mark>;
        return <Numbers key={i} text={part} />;
      })}
    </Tag>
  );
}

export const fmt = (n: number, d = 0) => n.toLocaleString('he-IL', { maximumFractionDigits: d, minimumFractionDigits: d });
export const pct = (n: number) => `${Math.round(n * 100)}%`;
