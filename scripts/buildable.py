"""שטח הבנייה של מגרש: המגרש פחות קו הבניין של כל צלע, והמלבן הגדול ביותר בתוכו.

קו הבניין לכל צלע נלקח מקווי הבניין שבקובץ ה-SHP (שכבת MVT_ARC): הקו הקרוב ביותר שמקביל לצלע
(עד 12 מעלות) ובתוך המגרש, עד 12 מ'. צלע בלי קו כזה מקבלת את ברירת המחדל (3 מ', הנחה).
המלבן מיושר לצלע ארוכה של המגרש, וצלע החזית (הקו הקרוב ביותר לגבול, "חזית פעילה") היא תחתית המלבן,
כדי שהאגפים הנמוכים יעמדו לאורך הרחוב.
"""
import math

DEFAULT_SETBACK = 3.0
GRID = 0.5


def _proj(ring):
    lat0 = sum(p[1] for p in ring) / len(ring)
    lon0 = sum(p[0] for p in ring) / len(ring)
    kx, ky = 111320 * math.cos(math.radians(lat0)), 110540
    return lon0, lat0, kx, ky


def _segdist(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy or 1)))
    return math.hypot(px - ax - t * dx, py - ay - t * dy)


def _inside(x, y, pts):
    c = False
    for i in range(len(pts)):
        x1, y1 = pts[i]; x2, y2 = pts[i - 1]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            c = not c
    return c


def _angle_diff(a, b):
    return abs((a - b + 90) % 180 - 90)


def edge_setbacks(pts, lines_m):
    """לכל צלע: קו הבניין במטרים, ושם הקו (קו בנין או חזית פעילה)."""
    out = []
    n = len(pts)
    for i in range(n):
        ax, ay = pts[i]; bx, by = pts[(i + 1) % n]
        ln = math.hypot(bx - ax, by - ay)
        if ln < 0.5:
            out.append((DEFAULT_SETBACK, None)); continue
        ang = math.degrees(math.atan2(by - ay, bx - ax))
        mx, my = (ax + bx) / 2, (ay + by) / 2
        best = None
        for name, c in lines_m:
            for j in range(len(c) - 1):
                (cx1, cy1), (cx2, cy2) = c[j], c[j + 1]
                a2 = math.degrees(math.atan2(cy2 - cy1, cx2 - cx1))
                if _angle_diff(ang, a2) > 12: continue
                d = _segdist(mx, my, cx1, cy1, cx2, cy2)
                if d <= 12 and (best is None or d < best[0]):
                    best = (d, name)
        out.append((round(best[0], 1), best[1]) if best else (DEFAULT_SETBACK, None))
    return out


def _max_rect(grid, min_short=0):
    """המלבן הטוב ביותר של תאים פנויים (שיטת ההיסטוגרמה). מחזיר (ציון, שורה עליונה, עמודה, גובה, רוחב).
    עם min_short (בתאים): מלבן צר ממנו נענש, כדי שמגרש מייצג לא ייצא רצועה."""
    best = (0, 0, 0, 0, 0)
    if not grid: return best
    h = [0] * len(grid[0])
    for r, row in enumerate(grid):
        for c, v in enumerate(row):
            h[c] = h[c] + 1 if v else 0
        stack = []
        for c in range(len(h) + 1):
            cur = h[c] if c < len(h) else 0
            start = c
            while stack and stack[-1][1] >= cur:
                s, hh = stack.pop()
                area = hh * (c - s)
                short = min(hh, c - s)
                score = area if not min_short or short >= min_short else area * (short / min_short) ** 2
                if score > best[0]: best = (score, r - hh + 1, s, hh, c - s)
                start = s
            stack.append((start, cur))
    return best


def buildable(ring, lines=None, default_setback=DEFAULT_SETBACK, min_short_m=0):
    """ring: [lon,lat] של המגרש. lines: רשימת (שם, [lon,lat]...) של קווי בניין. מחזיר את מסגרת המלבן ושטח הבנייה."""
    lon0, lat0, kx, ky = _proj(ring)
    pts = [((p[0] - lon0) * kx, (p[1] - lat0) * ky) for p in ring]
    if pts[0] == pts[-1]: pts = pts[:-1]
    lines_m = [(n, [((p[0] - lon0) * kx, (p[1] - lat0) * ky) for p in c]) for n, c in (lines or [])]
    sbs = edge_setbacks(pts, lines_m) if lines_m else [(default_setback, None)] * len(pts)
    edges = [(pts[i], pts[(i + 1) % len(pts)], sbs[i][0]) for i in range(len(pts))]

    # שטח הבנייה כמצולע (לתצוגה): הזזת כל צלע פנימה בקו הבניין שלה, וחיתוך צלעות סמוכות.
    # המלבן חייב להיות גם בתוך המצולע הזה, כדי שמה שמוצג ומה שנבדק יהיו אותו דבר.
    # (שורה זו מחליפה את ההערה הקודמת): הזזת כל צלע פנימה בקו הבניין שלה, וחיתוך צלעות סמוכות.
    sign = 1 if sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1] for i in range(len(pts))) > 0 else -1
    offs = []
    for a, b, sb in edges:
        dx, dy = b[0] - a[0], b[1] - a[1]
        ln = math.hypot(dx, dy)
        if ln < 0.5: continue
        nxp, nyp = -dy / ln * sign, dx / ln * sign  # נורמל פנימה
        offs.append(((a[0] + nxp * sb, a[1] + nyp * sb), (dx, dy)))
    poly = []
    for k in range(len(offs)):
        (p1, d1), (p2, d2) = offs[k - 1], offs[k]
        den = d1[0] * d2[1] - d1[1] * d2[0]
        if abs(den) < 1e-9:
            poly.append(p2); continue
        tt = ((p2[0] - p1[0]) * d2[1] - (p2[1] - p1[1]) * d2[0]) / den
        poly.append((p1[0] + d1[0] * tt, p1[1] + d1[1] * tt))

    def ok(x, y):
        if not _inside(x, y, pts) or not _inside(x, y, poly): return False
        return all(_segdist(x, y, a[0], a[1], b[0], b[1]) >= s - 1e-6 for a, b, s in edges if math.hypot(b[0] - a[0], b[1] - a[1]) >= 0.5)

    # זוויות מועמדות: כיווני הצלעות הארוכות, מודולו 90.
    cands = sorted({round(math.degrees(math.atan2(b[1] - a[1], b[0] - a[0])) % 90, 1) for a, b, _ in edges if math.hypot(b[0] - a[0], b[1] - a[1]) >= 6})
    best = None
    for deg in cands or [0.0]:
        t = math.radians(deg)
        c, s = math.cos(-t), math.sin(-t)
        rot = [(x * c - y * s, x * s + y * c) for x, y in pts]
        x0, x1 = min(p[0] for p in rot), max(p[0] for p in rot)
        y0, y1 = min(p[1] for p in rot), max(p[1] for p in rot)
        # רשת לפי גודל: חצי מטר במגרש, גסה יותר במתחם גדול (כ-160 תאים לאורך הצלע הארוכה).
        gs = max(GRID, max(x1 - x0, y1 - y0) / 160)
        nx, ny = int((x1 - x0) / gs) + 1, int((y1 - y0) / gs) + 1
        ci, si = math.cos(t), math.sin(t)
        grid = []
        for j in range(ny):
            yy = y0 + (j + 0.5) * gs
            row = []
            for i in range(nx):
                xx = x0 + (i + 0.5) * gs
                row.append(ok(xx * ci - yy * si, xx * si + yy * ci))
            grid.append(row)
        area, r, col, hh, ww = _max_rect(grid, min_short_m / gs)
        if best is None or area * gs * gs > best[0]:
            best = (area * gs * gs, deg, x0 + col * gs, y0 + r * gs, ww * gs, hh * gs)
    _, deg, rx, ry, w, h = best
    t = math.radians(deg)
    ccx, ccy = rx + w / 2, ry + h / 2
    cx, cy = ccx * math.cos(t) - ccy * math.sin(t), ccx * math.sin(t) + ccy * math.cos(t)  # מרכז המלבן במטרים מקומיים
    # הצלע הארוכה של המלבן היא ציר u.
    if h > w:
        t += math.pi / 2
        w, h = h, w
    ci, si = math.cos(t), math.sin(t)

    def to_uv(x, y):
        dx, dy = x - cx, y - cy
        return (dx * ci + dy * si + w / 2, -dx * si + dy * ci + h / 2)

    # החזית: הצלע עם קו הבניין הקטן ביותר. אם היא בצד v הגבוה, מסובבים ב-180 כדי שתהיה בתחתית (v=0).
    front = min(range(len(edges)), key=lambda i: (edges[i][2], -math.hypot(edges[i][1][0] - edges[i][0][0], edges[i][1][1] - edges[i][0][1])))
    fa, fb, _ = edges[front]
    fv = to_uv((fa[0] + fb[0]) / 2, (fa[1] + fb[1]) / 2)[1]
    if fv > h / 2:
        t += math.pi; ci, si = math.cos(t), math.sin(t)

    def to_uv2(x, y):
        dx, dy = x - cx, y - cy
        return [round(dx * ci + dy * si + w / 2, 2), round(-dx * si + dy * ci + h / 2, 2)]

    return {
        'lon': round(cx / kx + lon0, 7), 'lat': round(cy / ky + lat0, 7), 'ang': round(t, 5),
        'L': round(w, 1), 'W': round(h, 1),
        'outline': [to_uv2(x, y) for x, y in pts],
        'buildable': [to_uv2(x, y) for x, y in poly],
        'setbacks': [{'m': s, 'line': n} for s, n in sbs],
    }
