// כפתור הלוגו A&I (https://appofapp-gh.vercel.app/ai-menu.js). כל פעולות העריכה והפיתוח בתוכו בלבד.
import { useEffect, useRef } from 'react';

export const DEV_SESSION_URL = 'https://claude.ai/code/session_01UBnSCLb8SMjGWZwD2HLSAt';
export interface MenuItem { label: string; hint?: string; pressed?: boolean; disabled?: boolean; onSelect: () => unknown }
interface MenuElement extends HTMLElement { items: MenuItem[]; status: string }

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'ai-menu': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { chat?: string; research?: string };
    }
  }
}

export default function AIMenu({ items, status }: { items: MenuItem[]; status: string }) {
  const ref = useRef<MenuElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.items = items;
    el.status = status;
  }, [items, status]);
  return <ai-menu ref={ref} chat={DEV_SESSION_URL} />;
}
