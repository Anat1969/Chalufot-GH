# בונה את src/data/plans.json מתוך שלושה מקורות. הרצה: python3 scripts/build-plans.py
import json, math
tml = json.load(open('src/data/tml2022.json'))
m = json.load(open('scripts/sources/model-603-0811588.json'))
comp = json.load(open('scripts/sources/compounds.json'))
STATUS = {'approved': 'מאושרת', 'planning': 'בתכנון', 'permit': 'היתר', 'construction': 'בביצוע', 'deposited': 'הופקדה'}
GROSS_PER_UNIT = round(sum(l['residentialM2'] for l in tml['lots']) / sum(l['units'] for l in tml['lots']))
plans = []
plans.append({
  'id': 'tml-2022', 'number': 'תמל/2022', 'name': tml['plan']['title'], 'status': 'מאושרת', 'districtId': 2, 'level': 'lots',
  'unitsExisting': 487, 'unitsPlanned': tml['plan']['unitsTotal'], 'isRenewal': True, 'openSpaceM2': tml['plan']['openSpaceM2'],
  'source': 'קבצי מבא"ת: טבלה 5, טבלת שטחים ו-SHP, דרך תואם מתאר', 'sourceApp': 'תואם מתאר', 'sourceUrl': 'https://ashdod-mitar-twin.vercel.app/plan/%D7%AA%D7%9E%D7%9C%2F2022',
  'lots': [{'lot': l['lot'], 'areaM2': l['areaM2'], 'residentialM2': l['residentialM2'], 'units': l['units'], 'floors': l['floors'], 'commerceM2': l['commerceM2'], 'employmentM2': l['employmentM2'], 'publicM2': l['publicM2'], 'ring': l['ring']} for l in tml['lots']],
})
env = {f['properties']['lot']: f['geometry']['coordinates'][0] for f in m['massing']['features'] if f['properties']['kind'] == 'envelope'}
lots = []
for l in m['lots']:
  res = l['residential_main'] + l['residential_service']
  com = l.get('commercial_main', 0) + l.get('commercial_service', 0)
  lots.append({'lot': str(l['lot']), 'areaM2': l['lot_size'], 'residentialM2': res, 'units': l['units'], 'floors': l['floors_above'], 'commerceM2': com, 'employmentM2': 0, 'publicM2': None, 'residentialMainM2': l['residential_main'], 'mix': {'small': l['micro_55_min'], 'medium': l['small_75_min'] - l['micro_55_min']}, 'ring': env.get(l['lot'])})
plans.append({
  'id': '603-0811588', 'number': '603-0811588', 'name': 'תוספת דירות בקריית שמעון פרס', 'status': 'בתכנון', 'districtId': 7, 'level': 'lots',
  'unitsExisting': m['summary']['units_before_est'], 'unitsPlanned': m['summary']['units_after'], 'isRenewal': True, 'openSpaceM2': None,
  'source': 'טבלה 5, הוראות התכנית עמ\' 13 עד 16, ומעטפות KML מתכנון זמין, דרך "מה נבנה סביבי"', 'sourceApp': 'מה נבנה סביבי', 'sourceUrl': 'https://ashdod-ma-nivne.vercel.app/plan/603-0811588',
  'lots': lots,
})
for c in comp:
  net = c['a'] * 0.6
  k = max(1, round(net / 4000))
  u = round(c['up'] / k)
  plans.append({
    'id': c['n'].replace('/', '-'), 'number': c['n'], 'name': c['t'], 'status': STATUS.get(c['s'], c['s']), 'districtId': c['d'], 'level': 'compound',
    'unitsExisting': c['ue'], 'unitsPlanned': c['up'], 'isRenewal': c['tr'] != 'other', 'openSpaceM2': None, 'compoundM2': c['a'], 'repeat': k,
    'source': 'גבול ויח"ד מתוכננות מ"מה נבנה סביבי" (plan_projects). אין טבלת זכויות', 'sourceApp': 'מה נבנה סביבי', 'sourceUrl': 'https://ashdod-ma-nivne.vercel.app/',
    'lots': [{'lot': 'מייצג', 'areaM2': round(net / k), 'residentialM2': u * GROSS_PER_UNIT, 'units': u, 'floors': None, 'commerceM2': 0, 'employmentM2': 0, 'publicM2': None, 'ring': c['r']}],
  })
out = {'snapshot': '2026-11-05', 'grossPerUnit': GROSS_PER_UNIT, 'netShare': 0.6, 'typicalLotM2': 4000, 'plans': plans}
json.dump(out, open('src/data/plans.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(plans), 'plans', sum(len(p['lots']) for p in plans), 'lots, gross/unit', GROSS_PER_UNIT)
for p in plans[:0]: print(p['number'], p['level'], len(p['lots']), p.get('repeat'), p['lots'][0]['areaM2'], p['lots'][0]['units'])
