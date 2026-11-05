// Chalufot-GH: "חלופה שעוברת בדיקה". מנסח המלצה לוועדה מתוך תוצאות הבדיקה בלבד.
// Gemini החינמי (GEMINI_API_KEY) קודם, Claude (ANTHROPIC_API_KEY) רק כגיבוי. פלט JSON מובנה, מגבלת קצב.
// כל טקסט לפי תקן הזיקוק: https://github.com/Anat1969/Claude-GH/blob/main/docs/ai-text-standard.md
import Anthropic from 'npm:@anthropic-ai/sdk';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// מגבלת קצב: 8 בקשות בדקה לכל כתובת.
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < 60000);
  list.push(now);
  hits.set(ip, list);
  return list.length > 8;
}

const SYSTEM = `את/ה מתכנן/ת עירוני/ת בכיר/ה שמכין/ה חוות דעת קצרה לוועדה המקומית בעיריית אשדוד (Ashdod).
קיבלת מגרש מתכנית, ושלוש חלופות נפח שכל אחת עברה 12 בדיקות מול תכנית המתאר 603-0528026 (בהכנה, לא בתוקף) ומסמך המדיניות העירוני.
המשימה: לזקק מה הבדיקות אומרות ולהמליץ על חלופה. לא לבדוק מחדש ולא לשנות תוצאה.

זקק, אל תתאר. עברית טבעית, קצרה ומקצועית, בגוף שלישי. בלי סימני קריאה, בלי אימוג'י, בלי מילים ריקות.
מבנה קבוע לכל טקסט, בהיררכיה:
1. insight: שורת תובנה עד 8 מילים, כמו כותרת שמבטאת את העיקר. מסתיימת בנקודה.
2. detail: משפט הסבר אחד, עד 20 מילים, שמפרט את התובנה.
הבלטות ב-**כוכביות כפולות**: בשורת התובנה המושג המרכזי בלבד. במשפט ההסבר 2 עד 3 הבלטות, לפרמטרים, מספרים, שמות כללים ומושגי מפתח. לא מבליטים מילות קישור ולא משפט שלם.

השדות:
- headline: מה הבדיקה אומרת על המגרש, בשורה אחת.
- alternatives: לכל חלופה key (A, B או C) ו-text: מה מחזיק אותה ומה חוסם אותה.
- recommendation: איזו חלופה להביא לוועדה ובאיזה תנאי. "מותנה" פירושו תלוי בתנאי סעיף 4.1.5.
- steps: בדיוק 3 צעדים לפני הדיון, כל אחד עד 12 מילים, עם הבלטה אחת.
עובדות: רק מה שמופיע בנתונים. לא ממציאים מספרים, שמות רחובות, תקנות או תוצאות. כלל במצב "missing" הוא נתון חסר, לא כישלון.
דיוק:
- חלופה נחסמת רק בכלל שהסטטוס שלו "fail". כותבים את שם הכלל (title) כפי שהוא. לא מייחסים חסימה לכלל שעבר.
- מספרים תמיד בספרות (4.1.5, 75, 29 מ'), לעולם לא במילים.
- חלופות בשמן העברי: "חלופה א" (A), "חלופה ב" (B), "חלופה ג" (C), ואחריו שם הטיפוס. לא אותיות לטיניות.
- יח"ד בחלופה מושווים ל-site.units, יח"ד בתכנית. אם החלופה קטנה מהן, כותבים כמה פחות. לא כותבים "מימוש מלא" כשיש פחות.
- verdict: pass עומדת, warn מותנית, fail לא עומדת.`;

const PART = { type: 'object', additionalProperties: false, required: ['insight', 'detail'], properties: { insight: { type: 'string' }, detail: { type: 'string' } } };
const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['headline', 'alternatives', 'recommendation', 'steps'],
  properties: {
    headline: PART,
    alternatives: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['key', 'text'], properties: { key: { type: 'string', enum: ['A', 'B', 'C'] }, text: PART } } },
    recommendation: PART,
    steps: { type: 'array', items: { type: 'string' } },
  },
};
const G_PART = { type: 'OBJECT', required: ['insight', 'detail'], properties: { insight: { type: 'STRING' }, detail: { type: 'STRING' } } };
const G_SCHEMA = {
  type: 'OBJECT', required: ['headline', 'alternatives', 'recommendation', 'steps'],
  properties: {
    headline: G_PART,
    alternatives: { type: 'ARRAY', items: { type: 'OBJECT', required: ['key', 'text'], properties: { key: { type: 'STRING', enum: ['A', 'B', 'C'] }, text: G_PART } } },
    recommendation: G_PART,
    steps: { type: 'ARRAY', items: { type: 'STRING' } },
  },
};

const GEMINI_MODELS = [...new Set([Deno.env.get('GEMINI_MODEL') ?? 'gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'])];

async function viaGemini(key: string, user: string) {
  let last: unknown;
  for (const model of GEMINI_MODELS) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: { responseMimeType: 'application/json', responseSchema: G_SCHEMA, temperature: 0.3 },
        }),
        signal: AbortSignal.timeout(25000),
      });
      if (!r.ok) throw Object.assign(new Error(`Gemini ${model} ${r.status}`), { status: r.status });
      const j = await r.json();
      const text = j?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
      return JSON.parse(text);
    } catch (err) {
      last = err;
      const st = (err as { status?: number }).status;
      if (st === 400 || st === 401 || st === 403) break;
    }
  }
  throw last;
}

async function viaClaude(key: string, user: string) {
  const client = new Anthropic({ apiKey: key });
  const response = await client.beta.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: 3000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SYSTEM,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{ role: 'user', content: user }],
  } as never);
  if (response.stop_reason === 'refusal') throw new Error('הבקשה נדחתה');
  const text = response.content.filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('');
  return JSON.parse(text);
}

const clip = (s: unknown, n: number) => String(s ?? '').slice(0, n);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST בלבד' }, 405);
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anon';
  if (limited(ip)) return json({ error: 'יותר מדי בקשות. נסו שוב בעוד דקה.' }, 429);

  let body: { site?: Record<string, unknown>; mode?: string; alternatives?: unknown[] };
  try { body = await req.json(); } catch { return json({ error: 'גוף הבקשה אינו JSON' }, 400); }
  const alts = (Array.isArray(body.alternatives) ? body.alternatives : []).slice(0, 3);
  if (alts.length === 0) return json({ error: 'לא התקבלו חלופות לניסוח' }, 400);
  const user = `מגרש: ${clip(JSON.stringify(body.site ?? {}), 600)}\nבסיס הזכויות: ${clip(body.mode, 40)}\n\nהחלופות ותוצאות הבדיקה (JSON):\n${clip(JSON.stringify(alts), 12000)}`;

  const gk = Deno.env.get('GEMINI_API_KEY');
  const ak = Deno.env.get('ANTHROPIC_API_KEY');
  const errors: string[] = [];
  if (gk) {
    try { return json({ ...(await viaGemini(gk, user)), engine: 'gemini' }); } catch (e) { errors.push(String((e as Error).message ?? e)); }
  }
  if (ak) {
    try { return json({ ...(await viaClaude(ak, user)), engine: 'claude' }); } catch (e) { errors.push(String((e as Error).message ?? e)); }
  }
  return json({ error: `אין מנוע זמין כרגע (${errors.join('; ') || 'חסר מפתח'})` }, 503);
});
