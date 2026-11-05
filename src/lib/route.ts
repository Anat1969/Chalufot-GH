// ניתוב hash עם פרמטרים: המצב נשמר בכתובת, ו"העתקת קישור" פותחת את אותו מצב.
import { useEffect, useState } from 'react';

export interface Route { path: string; q: URLSearchParams }
const read = (): Route => {
  const h = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = h.split('?');
  return { path: path || '/', q: new URLSearchParams(qs ?? '') };
};
export function useRoute(): Route {
  const [r, setR] = useState(read);
  useEffect(() => {
    const on = () => setR(read());
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return r;
}
export function go(path: string, params?: Record<string, string | null | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) if (v != null && v !== '') q.set(k, v);
  const s = q.toString();
  location.hash = path + (s ? '?' + s : '');
}
export function setParams(params: Record<string, string | null | undefined>) {
  const { path, q } = read();
  for (const [k, v] of Object.entries(params)) (v == null || v === '' ? q.delete(k) : q.set(k, v));
  const s = q.toString();
  history.replaceState(null, '', '#' + path + (s ? '?' + s : ''));
  dispatchEvent(new HashChangeEvent('hashchange'));
}
