// "איך משתמשים": הסבר קבוע בחלון, כדי שהתצוגה תקבל את המסך.
import { useEffect, useRef, useState, type ReactNode } from 'react';

export default function HowTo({ children, label = 'איך משתמשים' }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const out = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    addEventListener('keydown', key);
    addEventListener('mousedown', out);
    return () => { removeEventListener('keydown', key); removeEventListener('mousedown', out); };
  }, [open]);
  return (
    <div className="howto" ref={ref}>
      <button className="press chip howto-btn" aria-expanded={open} onClick={() => setOpen(!open)}>{label}</button>
      {open && (
        <div className="howto-pop" role="dialog" aria-label={label}>
          <button className="howto-x" aria-label="סגירה" onClick={() => setOpen(false)}>×</button>
          {children}
        </div>
      )}
    </div>
  );
}
