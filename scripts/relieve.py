# Relieve REAL del IGN para «A cuánto queda» (no para el 3D, que es de Lugar 3D):
#   - img/relieve/valle.webp y img/relieve/asturias.webp: sombreado del relieve (gris 128 = llano) para el mapa.
#   - data/distancias.json: el mapa (rutas de ref/raw/rutas.json proyectadas y simplificadas) y el PERFIL DE ALTURA de
#     cada ruta, medido sobre el MDT.
#   - data/camin-provisional.json: SOLO si aún no existe data/lugar-camin.json (de Lugar 3D). Mismo esquema: la ruta de
#     OSRM a Tablizas con cota del MDT25 y los pueblos de OSM por los que pasa. Cuando llega el de Lugar, este se borra.
# Fuentes: MDT25 y MDT200 del IGN por WCS (servicios.idee.es/wcs-inspire/mdt), CC BY 4.0 «© Instituto Geográfico
# Nacional»; sitios de OpenStreetMap (Overpass), ODbL. User-Agent genérico, sin datos personales.
#   python -I -X utf8 scripts/relieve.py        (receta de ../apartamentos-alba-somiedo-web/scripts/relieve.py)
import json, math, os, time, urllib.request, urllib.parse
from pathlib import Path
import numpy as np
import tifffile
from PIL import Image
from scipy import ndimage

RAIZ = Path(__file__).resolve().parent.parent
CACHE = RAIZ / 'ref/raw/relieve-cache'
CACHE.mkdir(parents=True, exist_ok=True)
UA = 'datos-mapa-script/1.0 (uso puntual)'

rutas = json.loads((RAIZ / 'ref/raw/rutas.json').read_text(encoding='utf-8'))
CASA = rutas['casa']
LAT0, LON0 = CASA['lat'], CASA['lon']
KX = 111320 * math.cos(math.radians(LAT0)); KY = 110574


def bajar(url, f):
    if f.exists() and f.stat().st_size > 1000:
        return
    for i in range(4):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=240) as r:
                data = r.read()
            if len(data) > 1000:
                f.write_bytes(data)
                return
        except Exception as e:
            print('  reintento', i, e)
        time.sleep(4 * (i + 1))
    raise SystemExit('no baja ' + url)


def wcs(cov, S, N, O, E, nombre):
    url = ('https://servicios.idee.es/wcs-inspire/mdt?SERVICE=WCS&VERSION=2.0.1&REQUEST=GetCoverage'
           f'&COVERAGEID={cov}&FORMAT=image/tiff&SUBSET=Lat({S},{N})&SUBSET=Long({O},{E})')
    f = CACHE / nombre
    bajar(url, f)
    with tifffile.TiffFile(f) as t:
        a = t.pages[0].asarray().astype(np.float32)
        tags = t.pages[0].tags
        escala = tags['ModelPixelScaleTag'].value
        tie = tags['ModelTiepointTag'].value
    lon0, lat0 = tie[3], tie[4]
    dlon, dlat = escala[0], escala[1]
    a[a < -1000] = np.nan
    return {'z': a, 'lon0': lon0, 'lat0': lat0, 'dlon': dlon, 'dlat': dlat,
            'S': lat0 - a.shape[0] * dlat, 'N': lat0, 'O': lon0, 'E': lon0 + a.shape[1] * dlon}


def muestrear(M, lat, lon):
    fy = (M['lat0'] - lat) / M['dlat'] - 0.5
    fx = (lon - M['lon0']) / M['dlon'] - 0.5
    return ndimage.map_coordinates(np.nan_to_num(M['z'], nan=0.0), [np.atleast_1d(fy), np.atleast_1d(fx)], order=1, mode='nearest')


# el valle del Narcea, de Llamas del Mouro a Leitariegos y Muniellos (MDT25) y el occidente de Asturias (MDT200)
CERCA = (42.930, 43.300, -6.800, -6.340)
LEJOS = (42.880, 43.640, -6.900, -5.720)
print('MDT25 (el valle)…')
M25 = wcs('Elevacion4258_25', 42.92, 43.31, -6.81, -6.33, 'mdt25.tif')
print('  ', M25['z'].shape, 'paso', round(M25['dlat'] * 111000, 1), 'm')
print('MDT200 (Oviedo y el aeropuerto)…')
M200 = wcs('Elevacion4258_200', 42.86, 43.66, -6.92, -5.70, 'mdt200.tif')
print('  ', M200['z'].shape)
en25 = lambda la, lo: (la > M25['S'] + 0.002) & (la < M25['N'] - 0.002) & (lo > M25['O'] + 0.002) & (lo < M25['E'] - 0.002)
cota = float(muestrear(M25, np.array([LAT0]), np.array([LON0]))[0])
print('cota de la casa en el MDT25:', round(cota, 1), 'm')


def sombreado(M, S, N, O, E, ancho, f, exag=1.0):
    alto = int(round(ancho * ((N - S) * KY) / ((E - O) * KX)))
    lat = N - (np.arange(alto) + 0.5) / alto * (N - S)
    lon = O + (np.arange(ancho) + 0.5) / ancho * (E - O)
    LA, LO = np.meshgrid(lat, lon, indexing='ij')
    z = muestrear(M, LA.ravel(), LO.ravel()).reshape(alto, ancho)
    px = (E - O) * KX / ancho; py = (N - S) * KY / alto
    gy, gx = np.gradient(z * exag, py, px)
    az, el = math.radians(315), math.radians(45)          # luz del noroeste a 45° (la convención de los mapas)
    pend = np.arctan(np.hypot(gx, gy))
    asp = np.arctan2(-gx, gy)
    luz = np.sin(el) * np.cos(pend) + np.cos(el) * np.sin(pend) * np.cos(az - asp)
    g = 128 + (luz - math.sin(el)) * 150
    g = np.clip(g, 18, 238).astype(np.uint8)
    # el mar (cota 0 en el MDT200) en gris llano
    (RAIZ / 'img/relieve').mkdir(parents=True, exist_ok=True)
    Image.fromarray(g, 'L').save(RAIZ / f, 'WEBP', quality=72, method=6)
    print(' ', f, ancho, 'x', alto, os.path.getsize(RAIZ / f) // 1024, 'KB')


def P(lon, lat):
    return [(lon - LON0) * KX, -(lat - LAT0) * KY]


sombreado(M25, *CERCA, 1100, 'img/relieve/valle.webp', exag=1.0)
sombreado(M200, *LEJOS, 820, 'img/relieve/asturias.webp', exag=1.7)


def simplificar(pts, tol):
    if len(pts) < 3:
        return pts
    keep = [False] * len(pts); keep[0] = keep[-1] = True
    pila = [(0, len(pts) - 1)]
    while pila:
        a, b = pila.pop()
        ax, ay = pts[a][0], pts[a][1]; bx, by = pts[b][0], pts[b][1]
        dx, dy = bx - ax, by - ay; L = dx * dx + dy * dy
        mx, im = -1, -1
        for i in range(a + 1, b):
            px, py = pts[i][0], pts[i][1]
            t = ((px - ax) * dx + (py - ay) * dy) / L if L else 0
            t = max(0, min(1, t))
            ex, ey = ax + t * dx - px, ay + t * dy - py
            d = ex * ex + ey * ey
            if d > mx:
                mx, im = d, i
        if mx > tol * tol:
            keep[im] = True; pila.append((a, im)); pila.append((im, b))
    return [p for p, k in zip(pts, keep) if k]


def camino(pts):
    s = 'M%d %d' % (round(pts[0][0]), round(pts[0][1]))
    px, py = round(pts[0][0]), round(pts[0][1])
    for p in pts[1:]:
        x, y = round(p[0]), round(p[1])
        if x == px and y == py:
            continue
        s += 'l%d %d' % (x - px, y - py); px, py = x, y
    return s.replace(' -', '-')


def alturas(geo, paso=40):
    lon = np.array([g[0] for g in geo]); lat = np.array([g[1] for g in geo])
    x = (lon - LON0) * KX; y = (lat - LAT0) * KY
    seg = np.hypot(np.diff(x), np.diff(y)); acum = np.concatenate([[0], np.cumsum(seg)])
    total = acum[-1]
    n = int(max(2, min(4000, total // paso)))
    s = np.linspace(0, total, n)
    la = np.interp(s, acum, lat); lo = np.interp(s, acum, lon)
    dentro = en25(la, lo)
    z = np.where(dentro, muestrear(M25, la, lo), muestrear(M200, la, lo))
    z = ndimage.uniform_filter1d(z, 3)
    return s, z, dentro.all(), acum


def perfil(geo):
    s, z, todo25, _ = alturas(geo)
    n = len(s)
    subida = float(np.clip(np.diff(z), 0, None).sum()); bajada = float(np.clip(-np.diff(z), 0, None).sum())
    k = np.linspace(0, n - 1, min(n, 120)).round().astype(int)
    return {'km': [round(float(v) / 1000, 2) for v in s[k]], 'm': [round(float(v)) for v in z[k]],
            'min': round(float(z.min())), 'max': round(float(z.max())), 'sube': round(subida), 'baja': round(bajada),
            'fin': round(float(z[-1])), 'mdt': 'MDT25' if todo25 else 'MDT25 y MDT200'}


mapa = {'fuente': 'Rutas: OSRM sobre OpenStreetMap (ODbL). Relieve y alturas: MDT25 y MDT200 del IGN (CC BY 4.0).',
        'fecha': rutas['fecha'], 'casa': {'lat': LAT0, 'lon': LON0, 'cota': round(cota)},
        'relieve': {}, 'orden': rutas['orden'], 'sitios': {}}
for k, caja, src in (('cerca', CERCA, 'img/relieve/valle.webp'), ('lejos', LEJOS, 'img/relieve/asturias.webp')):
    x, y = P(caja[2], caja[1])
    mapa['relieve'][k] = {'x': round(x), 'y': round(y), 'w': round((caja[3] - caja[2]) * KX), 'h': round((caja[1] - caja[0]) * KY), 'src': src}
for sid in rutas['orden']:
    s = rutas['sitios'][sid]
    if 'lat' not in s or not s.get('coche'):
        continue
    M = M25 if en25(np.array([s['lat']]), np.array([s['lon']]))[0] else M200
    zp = float(muestrear(M, np.array([s['lat']]), np.array([s['lon']]))[0])
    t = s['coche']
    pts = [P(lo, la) for lo, la in t['geometria']]
    tol = 8 if t['km'] < 45 else 45
    mapa['sitios'][sid] = {'nombre': s['nombre'], 'tipo': s['tipo'], 'grupo': s['grupo'], 'osm': s['osm'], 'lat': s['lat'], 'lon': s['lon'],
                           'xy': [round(v) for v in P(s['lon'], s['lat'])], 'cota': round(zp), 'rectaKm': s['recta_km'],
                           'km': t['km'], 'minutos': t['minutos'], 'carreteras': t['carreteras'],
                           'd': camino(simplificar(pts, tol)), 'perfil': perfil(t['geometria'])}
    p = mapa['sitios'][sid]['perfil']
    print(' ', sid.ljust(12), 'cota', round(zp), '| perfil', p['min'], '-', p['max'], 'sube', p['sube'], 'baja', p['baja'])
(RAIZ / 'data').mkdir(exist_ok=True)
(RAIZ / 'data/distancias.json').write_text(json.dumps(mapa, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print('→ data/distancias.json, img/relieve/*.webp')

# ---------------------------------------------------------------- el camín provisional (solo si falta el de Lugar 3D)
if (RAIZ / 'data/lugar-camin.json').exists():
    f = RAIZ / 'data/camin-provisional.json'
    if f.exists():
        f.unlink(); print('ya está data/lugar-camin.json: se borra el provisional')
else:
    t = rutas['sitios']['tablizas']
    geo = t['coche']['geometria']
    lon = np.array([g[0] for g in geo]); lat = np.array([g[1] for g in geo])
    x = (lon - LON0) * KX; y = (lat - LAT0) * KY
    acum = np.concatenate([[0], np.cumsum(np.hypot(np.diff(x), np.diff(y)))])
    escala = t['coche']['km'] * 1000 / acum[-1]            # el km de OSRM manda (la proyección plana se desvía unos metros)
    simp = simplificar([[x[i], y[i], i] for i in range(len(geo))], 6)
    idx = [p[2] for p in simp]
    z = muestrear(M25, lat[idx], lon[idx])
    ruta = [[round(float(lon[i]), 5), round(float(lat[i]), 5), round(float(zz)), round(float(acum[i] * escala / 1000), 3)] for i, zz in zip(idx, z)]
    # pueblos de OSM a menos de 260 m de la carretera, en su orden
    S, N, O, E = lat.min() - 0.01, lat.max() + 0.01, lon.min() - 0.01, lon.max() + 0.01
    fq = CACHE / 'pueblos-camin.json'
    if not fq.exists():
        q = f'[out:json][timeout:60];node["place"~"^(village|hamlet|town)$"]["name"]({S},{O},{N},{E});out;'
        for url in ['https://overpass.openstreetmap.fr/api/interpreter', 'https://overpass-api.de/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter']:
            try:
                req = urllib.request.Request(url, data=urllib.parse.urlencode({'data': q}).encode(), headers={'User-Agent': UA})
                with urllib.request.urlopen(req, timeout=120) as r:
                    fq.write_bytes(r.read()); break
            except Exception as e:
                print('  overpass', url, e); time.sleep(3)
    hitos = []
    if fq.exists():
        for e in json.loads(fq.read_text(encoding='utf-8'))['elements']:
            px = (e['lon'] - LON0) * KX; py = (e['lat'] - LAT0) * KY
            d = np.hypot(x - px, y - py); i = int(d.argmin())
            if d[i] < 260:
                nombre = e['tags'].get('name:es') or e['tags']['name']
                hitos.append({'nombre': nombre, 'km': round(float(acum[i] * escala / 1000), 2), 'lat': e['lat'], 'lon': e['lon'],
                              'cota': round(float(muestrear(M25, np.array([lat[i]]), np.array([lon[i]]))[0])), 'tipo': 'pueblo'})
    hitos.sort(key=lambda h: h['km'])
    camin = {'provisional': True, 'fuente': 'PROVISIONAL de la Web (scripts/relieve.py): OSRM + MDT25 del IGN + pueblos de OSM. Manda data/lugar-camin.json (Lugar 3D).',
             'casa': {'lat': LAT0, 'lon': LON0, 'cota': round(cota)},
             'destino': {'nombre': 'Tablizas', 'lat': t['lat'], 'lon': t['lon'], 'cota': ruta[-1][2]},
             'kmTotal': t['coche']['km'], 'minutos': t['coche']['minutos'], 'ruta': ruta, 'hitos': hitos}
    (RAIZ / 'data/camin-provisional.json').write_text(json.dumps(camin, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print('→ data/camin-provisional.json:', len(ruta), 'puntos,', [(h['nombre'], h['km']) for h in hitos])
