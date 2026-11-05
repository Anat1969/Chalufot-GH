import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './base.css';
import './app.css';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);

// service worker רק כשהבסיס הוא השורש (Vercel), לא בקישור raw.githack שבתיקיית app/.
if ('serviceWorker' in navigator && import.meta.env.BASE_URL === '/' && import.meta.env.PROD) {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
