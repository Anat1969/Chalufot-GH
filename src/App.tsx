import { useEffect, useMemo, useState } from 'react';
import AIMenu, { type MenuItem } from './components/AIMenu';
import { go, useRoute } from './lib/route';
import Home from './pages/Home';
import Studio from './pages/Studio';
import Compare from './pages/Compare';
import Method from './pages/Method';

const NAV: [string, string][] = [['/', 'בית'], ['/studio', 'סטודיו'], ['/compare', 'השוואה'], ['/method', 'שיטה']];

interface BIPEvent extends Event { prompt: () => Promise<void> }

export default function App() {
  const { path } = useRoute();
  const [install, setInstall] = useState<BIPEvent | null>(null);
  const [status, setStatus] = useState('');
  useEffect(() => {
    const on = (e: Event) => { e.preventDefault(); setInstall(e as BIPEvent); };
    addEventListener('beforeinstallprompt', on);
    const saved = (e: Event) => setStatus((e as CustomEvent<string>).detail);
    addEventListener('chalufot:status', saved);
    return () => { removeEventListener('beforeinstallprompt', on); removeEventListener('chalufot:status', saved); };
  }, []);
  useEffect(() => { window.scrollTo(0, 0); }, [path]);
  const items = useMemo<MenuItem[]>(() => [
    { label: 'מקור: מחולל חלופות בינוי', hint: 'תיק העבודות', onSelect: () => open('https://appofapp-gh.vercel.app/', '_blank') },
    { label: 'מקור: תואם מתאר', hint: 'מנוע הכללים', onSelect: () => open('https://ashdod-mitar-twin.vercel.app/', '_blank') },
    { label: 'דוח לוועדה', hint: 'הדפסה או PDF', onSelect: () => { if (!location.hash.startsWith('#/studio')) go('/studio'); setTimeout(() => print(), 300); } },
    ...(install ? [{ label: 'התקנת האפליקציה', onSelect: () => install.prompt() }] : []),
    { label: 'איפוס מגרש משלי', hint: 'מוחק שמירה מקומית', onSelect: () => { try { localStorage.removeItem('chalufot:v1'); } catch { /* */ } location.reload(); } },
  ], [install]);
  const page = path.startsWith('/studio') ? <Studio /> : path.startsWith('/compare') ? <Compare /> : path.startsWith('/method') ? <Method /> : <Home />;
  return (
    <div className={path.startsWith('/studio') ? 'app-shell studio-shell' : 'site'}>
      <header className="topbar">
        <div className="topbar-in">
          <a className="brand press-text" href="#/" aria-label="חלופה שעוברת בדיקה, לדף הבית">
            <img src="./icon.svg" alt="" width={26} height={26} />
            <span>חלופה שעוברת בדיקה</span>
          </a>
          <nav className="tabs" aria-label="ניווט">
            {NAV.map(([p, l]) => (
              <button key={p} className="tab" aria-current={(p === '/' ? path === '/' : path.startsWith(p)) ? 'page' : undefined} onClick={() => go(p, p === '/studio' ? Object.fromEntries(new URLSearchParams(location.hash.split('?')[1] ?? '')) : undefined)}>{l}</button>
            ))}
          </nav>
          <AIMenu items={items} status={status} />
        </div>
      </header>
      {page}
    </div>
  );
}
