#!/usr/bin/env python3
"""סנכרון לילי של התכניות: קורא את כל המקורות הציבוריים ובונה מחדש את src/data/plans.json ואת public/maps/*.json.

רץ ב-GitHub Actions (.github/workflows/sync-plans.yml), בלי Claude ובלי אישורים: רק קריאה ציבורית.
מקורות:
  1. Supabase ASHDODMAP (REST, מפתח anon ציבורי): plan_projects שפורסמו, ו-mt_districts לשיוך למתחם.
  2. AshdodMitar ב-GitHub: קבצי מבא"ת של תכניות עם טבלה 5 (seed.json ו-layers.json).
  3. "מה נבנה סביבי": קובץ model.json לכל תכנית שיש לה model_url.
תכנית עם טבלה 5 נבדקת לפי מגרש. מתחם בלי זכויות נבדק כמגרש מייצג.
הרצה מקומית בלי רשת: python3 scripts/sync_plans.py --offline (קורא מ-scripts/fixtures).
"""
import json, math, os, sys, urllib.request, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from buildable import buildable  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIX = os.path.join(ROOT, 'scripts', 'fixtures')
OFFLINE = '--offline' in sys.argv
SUPA = os.environ.get('ASHDODMAP_URL', 'https://cbhexpybdggwzyakgagd.supabase.co')
# מפתח anon ציבורי: הוא כבר בתוך הבנדל של תואם מתאר ושל "מה נבנה סביבי". קריאה בלבד, לפי RLS.
ANON = os.environ.get('ASHDODMAP_ANON', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNiaGV4cHliZGdnd3p5YWtnYWdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NDkzMjksImV4cCI6MjA5MTMyNTMyOX0.X1b7pLyig-bGfxM7XjmwH0TqiuhqoS_o-Czg5qdsN6o')
MITAR_RAW = 'https://raw.githubusercontent.com/Anat1969/AshdodMitar/main/public/plans/'
NIVNE = 'https://ashdod-ma-nivne.vercel.app'
# תכניות שיש להן קבצי מבא"ת בתואם מתאר: מספר תכנית -> תיקייה ב-public/plans.
MITAR_PLANS = {'תמל/2022': 'tml-2022'}
STATUS = {'approved': 'מאושרת', 'planning': 'בתכנון', 'permit': 'היתר', 'construction': 'בביצוע', 'deposited': 'הופקדה'}
NET_SHARE, TYPICAL_LOT = 0.6, 4000
SKIPPED = []


def get(url, fixture):
    if OFFLINE:
        with open(os.path.join(FIX, fixture), encoding='utf-8') as f:
            return json.load(f)
    # מפתח Supabase נשלח רק ל-Supabase: GitHub מחזיר 404 על כותרת הרשאה שאינה שלו.
    headers = {'User-Agent': 'chalufot-sync'}
    if url.startswith(SUPA):
        headers.update({'apikey': ANON, 'Authorization': f'Bearer {ANON}'})
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode('utf-8'))


def slug(number):
    """מזהה לטיני לכתובת ולשם קובץ: תמל/2021 -> tml-2021."""
    return number.replace('תמל/', 'tml-').replace('/', '-')


def rnd(ring, d=6):
    return [[round(x, d), round(y, d)] for x, y in ring]


def area_m2(ring):
    lat0 = sum(p[1] for p in ring) / len(ring)
    kx, ky = 111320 * math.cos(math.radians(lat0)), 110540
    pts = [(x * kx, y * ky) for x, y in ring]
    return abs(sum(pts[i][0] * pts[i - 1][1] - pts[i - 1][0] * pts[i][1] for i in range(len(pts)))) / 2


def inside(pt, ring):
    x, y, c = pt[0], pt[1], False
    for i in range(len(ring)):
        x1, y1 = ring[i]; x2, y2 = ring[i - 1]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            c = not c
    return c


def outer_rings(geom):
    g = geom.get('geometry', geom) if isinstance(geom, dict) else None
    if not g: return []
    if g['type'] == 'Polygon': return [g['coordinates'][0]]
    if g['type'] == 'MultiPolygon': return [p[0] for p in g['coordinates']]
    return []


def district_of(rings, districts):
    """המתחם שמכיל את רוב הקודקודים של התכנית (קירוב לחפיפה הגדולה)."""
    votes = {}
    for ring in rings:
        pts = ring + [[sum(p[0] for p in ring) / len(ring), sum(p[1] for p in ring) / len(ring)]]
        for pt in pts:
            for d in districts:
                if any(inside(pt, r) for r in d['rings']):
                    votes[d['id']] = votes.get(d['id'], 0) + 1
    return max(votes, key=votes.get) if votes else None


def bounds(rings):
    xs = [p[0] for r in rings for p in r]; ys = [p[1] for r in rings for p in r]
    return [min(xs), min(ys), max(xs), max(ys)]


def mitar_plan(number, folder, pp_row, districts):
    seed = get(MITAR_RAW + folder + '/seed.json', 'seed.json')
    layers = get(MITAR_RAW + folder + '/layers.json', 'layers.json')
    by = {l['kind']: l['geojson']['features'] for l in layers}
    blines = [(f['properties'].get('name'), f['geometry']['coordinates']) for f in by.get('building_lines', []) if f['geometry']['type'] == 'LineString']
    lots, land = [], []
    for f in seed['lots']['features']:
        p = f['properties']
        ring = f['geometry']['coordinates'][0]
        res = [r for r in p['rights'] if r['use'] == 'מגורים']
        land.append({'lot': p['lot'], 'yeud': p['yeud'], 'ring': rnd(ring)})
        if not res: continue
        r = res[0]
        other = {x['use']: x['builtM2'] or 0 for x in p['rights'] if x['use'] != 'מגורים'}
        lots.append({'lot': p['lot'], 'areaM2': r['lotArea'] or p['areaM2'], 'residentialM2': r['builtM2'], 'units': r['units'], 'floors': r['floors'],
                     'commerceM2': other.get('מסחר', 0), 'employmentM2': other.get('תעסוקה', 0) + other.get('מסחר ותעסוקה', 0),
                     'publicM2': other.get('מבנים ומוסדות ציבור', 0), 'ring': rnd(ring),
                     # שטח הבנייה לפי קווי הבניין של התשריט, והמלבן המרבי בתוכו לאורך החזית
                     'build': buildable(ring, blines)})
    lots.sort(key=lambda l: l['lot'])
    colors = {f['properties'].get('lot'): f['properties'].get('color') for f in by.get('land_use', [])}
    for l in land: l['color'] = colors.get(l['lot'])
    boundary = [rnd(r) for f in by.get('blue_line', []) for r in outer_rings(f)] or [rnd(r) for r in outer_rings(seed['boundary'])]
    open_space = sum(q['value'] for q in seed.get('quantities', []) if q['domain_key'] == 'openspace') or None
    housing = [q['value'] for q in seed.get('quantities', []) if q['domain_key'] == 'housing']
    units_total = housing[0] if housing else sum(l['units'] for l in lots)
    plan = {
        'id': folder, 'number': number, 'name': pp_row['title'] if pp_row else number, 'status': STATUS.get((pp_row or {}).get('status'), 'מאושרת'),
        'districtId': district_of(boundary, districts) or 2, 'level': 'lots',
        'unitsExisting': (pp_row or {}).get('units_existing'), 'unitsPlanned': units_total, 'isRenewal': True, 'openSpaceM2': open_space,
        'source': 'קבצי מבא"ת: טבלה 5, טבלת שטחים ו-SHP, דרך תואם מתאר', 'sourceApp': 'תואם מתאר',
        'sourceUrl': 'https://ashdod-mitar-twin.vercel.app/plan/' + urllib.request.quote(number, safe=''), 'lots': lots,
    }
    mp = {'boundary': boundary, 'land': land,
          'buildings': [{'ring': rnd(r), 'h': f['properties'].get('height'), 'kind': 'demolish'} for f in by.get('demolish', []) for r in outer_rings(f)],
          'proposed': [{'lot': str(f['properties'].get('lot')), 'ring': rnd(r), 'floors': f['properties'].get('floors')} for f in by.get('proposed', []) for r in outer_rings(f)],
          'lines': [rnd(f['geometry']['coordinates']) for f in by.get('building_lines', []) if f['geometry']['type'] == 'LineString'],
          'credit': 'תשריט: קבצי SHP ממבא"ת (MVT_PLAN, MVT_GVUL, MVT_ARC, MVT_POL), דרך תואם מתאר'}
    return plan, mp


def model_plan(row, districts):
    m = get(NIVNE + row['model_url'], 'model-' + row['plan_number'].replace('/', '-') + '.json')
    env = {f['properties']['lot']: f['geometry']['coordinates'][0] for f in m['massing']['features'] if f['properties']['kind'] == 'envelope'}
    lots = []
    for l in m['lots']:
        res = l['residential_main'] + l['residential_service']
        com = l.get('commercial_main', 0) + l.get('commercial_service', 0)
        lots.append({'lot': str(l['lot']), 'areaM2': l['lot_size'], 'residentialM2': res, 'units': l['units'], 'floors': l['floors_above'],
                     'commerceM2': com, 'employmentM2': 0, 'publicM2': None, 'residentialMainM2': l['residential_main'],
                     'mix': {'small': l['micro_55_min'], 'medium': l['small_75_min'] - l['micro_55_min']},
                     'ring': rnd(env[l['lot']]) if l['lot'] in env else None,
                     # המעטפת מתכנון זמין היא כבר שטח הבנייה: בלי קו בניין נוסף
                     'build': buildable(env[l['lot']], None, 0.0) if l['lot'] in env else None})
    boundary = [rnd(r) for f in m['boundary']['features'] for r in outer_rings(f)]
    s = m['sources']
    plan = {
        'id': slug(row['plan_number']), 'number': row['plan_number'], 'name': row['title'], 'status': STATUS.get(row['status'], row['status']),
        'districtId': district_of(boundary, districts) or 7, 'level': 'lots',
        'unitsExisting': m['summary'].get('units_before_est'), 'unitsPlanned': m['summary']['units_after'], 'isRenewal': True, 'openSpaceM2': None,
        'source': f"{s.get('table5', 'טבלה 5')}, ומעטפות מ{s.get('envelopes', 'תכנון זמין')}, דרך \"מה נבנה סביבי\"", 'sourceApp': 'מה נבנה סביבי',
        'sourceUrl': NIVNE + '/plan/' + urllib.request.quote(row['plan_number'], safe=''), 'lots': lots,
    }
    mp = {'boundary': boundary,
          'land': [{'lot': str(l['lot']), 'yeud': 'מגורים מסחר ותעסוקה' if l.get('mixed') else 'מגורים', 'color': None, 'ring': rnd(env[l['lot']])} for l in m['lots'] if l['lot'] in env],
          'buildings': [{'ring': rnd(r), 'h': f['properties'].get('h'), 'kind': 'existing'} for f in m['context']['features'] for r in outer_rings(f)],
          'proposed': [{'lot': str(f['properties']['lot']), 'ring': rnd(r), 'floors': f['properties'].get('floors')} for f in m['massing']['features'] if f['properties']['kind'] in ('tower', 'podium') for r in outer_rings(f)],
          'lines': [], 'credit': 'תשריט: מעטפות ומבנים קיימים מקובץ KML של תכנון זמין, דרך "מה נבנה סביבי"'}
    return plan, mp


def rep_build(ring, area):
    """המגרש המייצג בתוך גבול המתחם: מלבן בשטח המגרש, בתוך המלבן הגדול ביותר במתחם (קו בניין 3 מ' מגבול המתחם),
    ובזווית שלו. בתוך המגרש המייצג, קו בניין של 3 מ' (הנחה)."""
    b = buildable(ring, None, 3.0, min_short_m=24)
    sb = 3.0
    w = min(b['W'], math.sqrt(area / 1.6))
    l = min(b['L'], area / w)
    if l * w < area * 0.98: w = min(b['W'], area / l)
    L, W = round(l - 2 * sb, 1), round(w - 2 * sb, 1)
    return {'lon': b['lon'], 'lat': b['lat'], 'ang': b['ang'], 'L': L, 'W': W,
            'outline': [[-sb, -sb], [L + sb, -sb], [L + sb, W + sb], [-sb, W + sb]],
            'buildable': [[0, 0], [L, 0], [L, W], [0, W]],
            'setbacks': [{'m': sb, 'line': None}] * 4, 'representative': True}


def compound_plan(row, districts, gross_per_unit):
    rings = [rnd(r, 6) for f in (row.get('geojson') or {}).get('features', []) for r in outer_rings(f)]
    # תכנית בלי יח"ד מתוכננות (תעסוקה, נמל, תשתית): מחולל המגורים לא חל עליה. מדלגים, ולא נופלים.
    if not rings or not row.get('units_planned'):
        SKIPPED.append(f"{row['plan_number']} {row['title']}: {'אין יח\"ד מתוכננות' if rings else 'אין גבול'}")
        return None, None
    a = sum(area_m2(r) for r in rings)
    k = max(1, round(a * NET_SHARE / TYPICAL_LOT))
    u = round(row['units_planned'] / k)
    main = max(rings, key=area_m2)
    plan = {
        'id': slug(row['plan_number']), 'number': row['plan_number'], 'name': row['title'], 'status': STATUS.get(row['status'], row['status']),
        'districtId': district_of(rings, districts) or 2, 'level': 'compound',
        'unitsExisting': row['units_existing'], 'unitsPlanned': row['units_planned'], 'isRenewal': row['renewal_track'] != 'other', 'openSpaceM2': None,
        'compoundM2': round(a), 'repeat': k,
        'source': 'גבול ויח"ד מתוכננות מ"מה נבנה סביבי" (plan_projects). אין טבלת זכויות', 'sourceApp': 'מה נבנה סביבי', 'sourceUrl': NIVNE + '/',
        'lots': [{'lot': 'מייצג', 'areaM2': round(a * NET_SHARE / k), 'residentialM2': u * gross_per_unit, 'units': u, 'floors': None,
                  'commerceM2': 0, 'employmentM2': 0, 'publicM2': None, 'ring': main,
                  'build': rep_build(main, a * NET_SHARE / k)}],
    }
    mp = {'boundary': rings, 'land': [], 'buildings': [], 'proposed': [], 'lines': [], 'credit': 'גבול המתחם מ"מה נבנה סביבי". בניינים קיימים: מפת הרקע'}
    return plan, mp


def main():
    pp = get(f'{SUPA}/rest/v1/plan_projects?published=eq.true&select=plan_number,title,status,units_existing,units_planned,renewal_track,model_url,geojson&order=plan_number', 'plan_projects.json')
    dist = get(f'{SUPA}/rest/v1/mt_districts?select=id,geom', 'mt_districts.json')
    districts = [{'id': d['id'], 'rings': outer_rings(d['geom'])} for d in dist if d.get('geom')]
    by_number = {r['plan_number']: r for r in pp}
    plans, maps = [], {}
    for number, folder in MITAR_PLANS.items():
        p, m = mitar_plan(number, folder, by_number.get(number), districts)
        plans.append(p); maps[p['id']] = m
    gross = round(sum(l['residentialM2'] for l in plans[0]['lots']) / sum(l['units'] for l in plans[0]['lots']))
    done = set(MITAR_PLANS)
    for row in [r for r in pp if r.get('model_url') and r['plan_number'] not in done]:
        try:
            p, m = model_plan(row, districts)
            plans.append(p); maps[p['id']] = m; done.add(row['plan_number'])
        except Exception as e:  # מודל שלא נקרא: התכנית נבדקת כמתחם, ולא נעלמת
            print('model failed', row['plan_number'], e, file=sys.stderr)
    for row in [r for r in pp if r['plan_number'] not in done]:
        p, m = compound_plan(row, districts, gross)
        if p: plans.append(p); maps[p['id']] = m
    if len(plans) < 3:
        sys.exit('fewer than 3 plans: not writing, the sources look broken')
    out = {'snapshot': datetime.date.today().isoformat() if not OFFLINE else os.environ.get('SNAPSHOT', '2026-11-05'),
           'grossPerUnit': gross, 'netShare': NET_SHARE, 'typicalLotM2': TYPICAL_LOT, 'plans': plans}
    path = os.path.join(ROOT, 'src', 'data', 'plans.json')
    old = None
    if os.path.exists(path):
        with open(path, encoding='utf-8') as f: old = json.load(f)
    same = old is not None and {**old, 'snapshot': None} == {**out, 'snapshot': None}
    if same: out['snapshot'] = old['snapshot']  # בלי שינוי בנתונים, אין קומיט ואין פריסה
    with open(path, 'w', encoding='utf-8') as f: json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    os.makedirs(os.path.join(ROOT, 'public', 'maps'), exist_ok=True)
    for pid, m in maps.items():
        rings = m['boundary'] + [l['ring'] for l in m['land']]
        m['bounds'] = bounds(rings) if rings else None
        with open(os.path.join(ROOT, 'public', 'maps', pid + '.json'), 'w', encoding='utf-8') as f: json.dump(m, f, ensure_ascii=False, separators=(',', ':'))
    print(f"{len(plans)} plans, {sum(len(p['lots']) for p in plans)} lots, {'unchanged' if same else 'changed'}")
    for x in SKIPPED: print('skipped:', x)


if __name__ == '__main__':
    main()
