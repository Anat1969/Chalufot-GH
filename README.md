# חלופה שעוברת בדיקה

**[https://chalufot-gh.vercel.app](https://chalufot-gh.vercel.app)**

המיזוג האחרון בלי Vercel: https://raw.githack.com/Anat1969/Chalufot-GH/main/app/index.html

מחולל חלופות בינוי שכל חלופה שלו יוצאת עם סימון עמידה בהוראות תכנית המתאר של אשדוד.
נבנה משתי אפליקציות: **מחולל חלופות בינוי** (תיק העבודות, https://appofapp-gh.vercel.app) ו**תואם מתאר** (https://ashdod-mitar-twin.vercel.app, https://github.com/Anat1969/AshdodMitar).

## הרצה
```
npm install
npm run dev
npm test
npm run build && node tests/e2e.cjs
```

## מבנה
- `src/lib/rules.ts` מנוע הכללים של תואם מתאר, ללא שינוי.
- `src/lib/massing.ts` המחולל, `src/lib/verify.ts` הבודק, `src/lib/site.ts` המגרשים.
- `src/pages` בית, סטודיו, השוואה, שיטה. `supabase/functions/chalufot-brief` ניסוח לוועדה.
- אפיון: `docs/SPEC.md`. הנחיות: `CLAUDE.md`.

כלי תומך החלטה. אינו מחליף הוראות דין, תכנית תקפה או שיקול דעת מוסד התכנון. תכנית 603-0528026 אינה בתוקף.
