# «El camín» · de la casa a Tablizas (entrada a la Reserva de Muniellos) por la carretera real.
# Salida: data/lugar-camin.json (contrato del ENCARGO; lo usan la portada, la línea de la página y el 3D).
#
#   casa     centro de la casa en el Catastro (parcela U20301500PH98B; ver LUGAR.md) y su cota en el MDT05
#   destino  el edificio «Centro recepción de Muniellos» de OpenStreetMap (way 412929021), en Las Tablizas
#   ruta     la carretera de OSRM (perfil de coche, datos de OSM) adelgazada a 400-800 puntos, con la cota
#            del MDT05 del IGN y el km acumulado medido sobre la geometría COMPLETA de OSRM
#   hitos    pueblos (nodos place de OSM a menos de 120 m de la carretera), cruces (cambios de carretera de
#            OSRM, con su referencia AS-…) y ríos con nombre que la carretera cruza (vías waterway de OSM)
#
# Uso: python -I -X utf8 scripts/lugar-camin.py
import json, math, runpy, time, pathlib, xml.etree.ElementTree as ET
import numpy as np

C = runpy.run_path(str(pathlib.Path(__file__).with_name('lugar-comun.py')))
CACHE, DATA, bajar, altura_geo, haversine = C['CACHE'], C['DATA'], C['bajar'], C['altura_geo'], C['haversine']
PARTIDA, RC_CASA = C['PARTIDA'], C['RC_CASA']

# ------------------------------------------------------------------ la casa (Catastro)
la0, lo0 = PARTIDA
xml = C['wfs_bu']('BU:BuildingPart', la0 - 0.0012, lo0 - 0.0016, la0 + 0.0012, lo0 + 0.0016, 'bp-casa.xml')
partes = [p for p in C['poligonos'](xml) if p['id'].startswith(RC_CASA)]
# El cuerpo de la casa (el tejado largo de pizarra con las cuatro buhardillas): todas las partes de la parcela
# menos el «anexo», que es el edificio cuadrado del suroeste (otro tejado en la ortofoto).
cl = C['clasifica_casa'](partes)
cuerpo = [p for p in partes if p is not cl['anexo']]
A = sx = sy = 0.0
for p in cuerpo:
    an = p['anillos'][0][:-1]
    cy, cx, a = C['centroide']([(q[0], q[1] * math.cos(math.radians(la0))) for q in an])
    A += a; sy += cy * a; sx += cx / math.cos(math.radians(la0)) * a
CASA_LAT, CASA_LON = sy / A, sx / A
h_casa = float(altura_geo([CASA_LAT], [CASA_LON])[0])
d_part = float(haversine(la0, lo0, CASA_LAT, CASA_LON))
print(f'casa: {CASA_LAT:.6f}, {CASA_LON:.6f} · cota MDT05 {h_casa:.1f} m · a {d_part:.1f} m del punto de su visita virtual · {len(cuerpo)} partes')

# ------------------------------------------------------------------ OSM (API 0.6 /map: Overpass estaba caído)
osm = CACHE / 'osm-corredor.osm'
bajar('https://api.openstreetmap.org/api/0.6/map?bbox=-6.705,43.020,-6.550,43.165', osm)
root = ET.parse(osm).getroot()
NOD = {n.get('id'): (float(n.get('lat')), float(n.get('lon'))) for n in root.iter('node')}
tags = lambda e: {t.get('k'): t.get('v') for t in e.findall('tag')}

dest = None
for w in root.iter('way'):
    if w.get('id') == '412929021':
        pts = [NOD[nd.get('ref')] for nd in w.findall('nd')][:-1]
        dest = (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts), tags(w).get('name'))
assert dest, 'no está el Centro de recepción en OSM'
print('destino:', dest)

# ------------------------------------------------------------------ OSRM
url = (f'https://router.project-osrm.org/route/v1/driving/{CASA_LON:.6f},{CASA_LAT:.6f};{dest[1]:.6f},{dest[0]:.6f}'
       '?overview=full&geometries=geojson&steps=true&annotations=distance,duration')
osrm = json.loads(bajar(url, CACHE / 'osrm-camin.json', minimo=500))
assert osrm['code'] == 'Ok'
ruta = osrm['routes'][0]
G = np.array(ruta['geometry']['coordinates'])                 # lon, lat
tramo = haversine(G[:-1, 1], G[:-1, 0], G[1:, 1], G[1:, 0])
KM = np.concatenate([[0], np.cumsum(tramo)]) / 1000
print(f"OSRM: {ruta['distance'] / 1000:.3f} km · {ruta['duration'] / 60:.1f} min · {len(G)} puntos · suma de la geometría {KM[-1]:.3f} km "
      f"({(KM[-1] * 1000 - ruta['distance']):+.0f} m) · enganche: casa a {osrm['waypoints'][0]['distance']:.0f} m de la vía, destino a {osrm['waypoints'][1]['distance']:.0f} m")

# cota del MDT05 en cada punto (el MDT es el suelo desnudo: en los puentes da el fondo del río; se suaviza ±25 m)
dens_km = np.arange(0, KM[-1], 0.005)
dlat = np.interp(dens_km, KM, G[:, 1]); dlon = np.interp(dens_km, KM, G[:, 0])
dh = altura_geo(dlat, dlon)
k = np.ones(11) / 11
dhs = np.convolve(np.pad(dh, 5, mode='edge'), k, mode='valid')
cota_en = lambda km: np.interp(km, dens_km, dhs)


# adelgazar (Douglas-Peucker en metros) sin perder los giros
def dp(P, eps):
    keep = np.zeros(len(P), bool); keep[0] = keep[-1] = True; pila = [(0, len(P) - 1)]
    while pila:
        a, b = pila.pop()
        if b <= a + 1: continue
        ab = P[b] - P[a]; L = np.hypot(*ab)
        d = np.abs(ab[0] * (P[a + 1:b, 1] - P[a, 1]) - ab[1] * (P[a + 1:b, 0] - P[a, 0])) / L if L > 0 else np.hypot(*(P[a + 1:b] - P[a]).T)
        i = int(d.argmax())
        if d[i] > eps:
            keep[a + 1 + i] = True; pila += [(a, a + 1 + i), (a + 1 + i, b)]
    return keep


kx = 111320 * math.cos(math.radians(CASA_LAT))
XY = np.stack([(G[:, 0] - CASA_LON) * kx, (CASA_LAT - G[:, 1]) * 110950], 1)
eps = 1.5
while True:
    keep = dp(XY, eps)
    if keep.sum() <= 800: break
    eps += 0.25
# ningún tramo de más de 100 m sin punto (el perfil y el vuelo interpolan en línea recta): en las rectas largas de
# OSRM se añaden puntos intermedios sobre la propia recta
kms = [float(KM[i]) for i in np.flatnonzero(keep)]
todos = [kms[0]]
for k0, k1 in zip(kms[:-1], kms[1:]):
    n = int(math.ceil((k1 - k0) / 0.1))
    todos += [k0 + (k1 - k0) * (i + 1) / n for i in range(n)]
lon_en = lambda km: float(np.interp(km, KM, G[:, 0])); lat_en = lambda km: float(np.interp(km, KM, G[:, 1]))
RUTA = [[round(lon_en(k), 6), round(lat_en(k), 6), round(float(cota_en(k)), 1), round(k, 3)] for k in todos]
print(f'ruta adelgazada: {len(RUTA)} puntos (Douglas-Peucker {eps} m: {int(keep.sum())}; el resto, intermedios en rectas) · su suma '
      f'{sum(float(haversine(a_[1], a_[0], b_[1], b_[0])) for a_, b_ in zip(RUTA[:-1], RUTA[1:])) / 1000:.3f} km')
assert 400 <= len(RUTA) <= 800


def proyecta(lat, lon):
    """(distancia en m a la carretera, km en ese punto)."""
    x, z = (lon - CASA_LON) * kx, (CASA_LAT - lat) * 110950
    a, b = XY[:-1], XY[1:]; ab = b - a
    t = np.clip(((x - a[:, 0]) * ab[:, 0] + (z - a[:, 1]) * ab[:, 1]) / np.maximum((ab ** 2).sum(1), 1e-9), 0, 1)
    d = np.hypot(a[:, 0] + ab[:, 0] * t - x, a[:, 1] + ab[:, 1] * t - z); i = int(d.argmin())
    return float(d[i]), float(KM[i] + (KM[i + 1] - KM[i]) * t[i])


def punto(km):
    return float(np.interp(km, KM, G[:, 1])), float(np.interp(km, KM, G[:, 0]))


def hito(nombre, km, tipo, **mas):
    la, lo = punto(km)
    return dict(nombre=nombre, km=round(km, 2), lat=round(la, 6), lon=round(lo, 6), cota=round(float(cota_en(km))), tipo=tipo, **mas)


hitos = []
# --- pueblos: nodos place (hamlet/village/town) a menos de 120 m de la carretera
for n in root.iter('node'):
    t = tags(n)
    if t.get('place') not in ('hamlet', 'village', 'town') or 'name' not in t: continue
    d, km = proyecta(float(n.get('lat')), float(n.get('lon')))
    if d <= 120 and km > 0.25 and km < KM[-1] - 0.3:
        mas = dict(osm='node/' + n.get('id'), nombreOsm=t['name'], aMetros=round(d))
        if t.get('old_name'): mas['antes'] = t['old_name']
        hitos.append(hito(t.get('name:es') or t['name'], km, 'pueblo', **mas))
# --- cruces: donde OSRM cambia de carretera y la nueva tiene referencia
acc = 0.0
ref_ant = None
for s in ruta['legs'][0]['steps']:
    ref = s.get('ref')
    if ref and ref != ref_ant and acc > 50:
        hitos.append(hito('Cruce con la ' + ref.split(';')[0], acc / 1000, 'cruce', ref=ref, via=s.get('name') or ''))
    if ref: ref_ant = ref
    acc += s['distance']
# --- ríos con nombre que la carretera cruza (corte de segmentos)
def corta(p, p2, q, q2):
    r = p2 - p; s = q2 - q; den = r[0] * s[1] - r[1] * s[0]
    if abs(den) < 1e-12: return None
    t = ((q[0] - p[0]) * s[1] - (q[1] - p[1]) * s[0]) / den; u = ((q[0] - p[0]) * r[1] - (q[1] - p[1]) * r[0]) / den
    return t if 0 <= t <= 1 and 0 <= u <= 1 else None


nombre_rel = {}
for rl in root.iter('relation'):
    t = tags(rl)
    if t.get('type') == 'waterway' and 'name' in t:
        for mb in rl.findall('member'):
            if mb.get('type') == 'way': nombre_rel[mb.get('ref')] = t['name']
cruces_rio = {}
for w in root.iter('way'):
    t = tags(w)
    if 'name' not in t and w.get('id') in nombre_rel: t['name'] = nombre_rel[w.get('id')]
    if t.get('waterway') not in ('river', 'stream') or 'name' not in t: continue
    pts = [NOD[nd.get('ref')] for nd in w.findall('nd') if nd.get('ref') in NOD]
    W = np.array([((lo - CASA_LON) * kx, (CASA_LAT - la) * 110950) for la, lo in pts])
    if len(W) < 2: continue
    # solo los tramos de carretera cerca de la caja del río
    cerca = np.flatnonzero((XY[:, 0] > W[:, 0].min() - 50) & (XY[:, 0] < W[:, 0].max() + 50) & (XY[:, 1] > W[:, 1].min() - 50) & (XY[:, 1] < W[:, 1].max() + 50))
    for i in cerca:
        if i >= len(XY) - 1: continue
        for j in range(len(W) - 1):
            tt = corta(XY[i], XY[i + 1], W[j], W[j + 1])
            if tt is not None:
                cruces_rio.setdefault(t['name'], []).append((float(KM[i] + (KM[i + 1] - KM[i]) * tt), 'way/' + w.get('id'), t.get('name:es')))
for nombre, lista in cruces_rio.items():
    lista.sort()
    ultimo = -9
    for km, wid, es in lista:
        if km - ultimo > 0.6:                 # cruces seguidos del mismo río a menos de 600 m: uno
            hitos.append(hito(es or nombre, km, 'rio', osm=wid, nombreOsm=nombre))
        ultimo = km
hitos.sort(key=lambda h: h['km'])
# --- retoques (todos con su fuente en OSM):
#  · «La Venta» lleva old_name=Ventanueva en OSM, que es como la conoce todo el mundo: sale como Ventanueva.
#  · un cruce o un río a menos de 300 m de un pueblo no es otro mojón: va en el «detalle» del pueblo.
#  · name:es «Vega de pope» → «Vega de Pope» (solo la mayúscula).
for h in hitos:
    if h.get('antes') == 'Ventanueva':
        h['alias'] = h['nombre']; h['nombre'] = 'Ventanueva'
    if h['nombre'] == 'Vega de pope':
        h['nombre'] = 'Vega de Pope'
pueblos = [h for h in hitos if h['tipo'] == 'pueblo']
fuera = []
for h in hitos:
    if h['tipo'] == 'pueblo': continue
    p = min(pueblos, key=lambda q: abs(q['km'] - h['km']))
    if abs(p['km'] - h['km']) < 0.3:
        if h['tipo'] == 'cruce':
            p['tipo'] = 'cruce'; p['ref'] = h['ref']
            p['detalle'] = 'Se deja la AS-15 y se toma la ' + h['ref'] + ', la carretera del puerto del Connio' if h['ref'] == 'AS-348' else h['nombre']
        else:
            p['detalle'] = 'La carretera cruza aquí el ' + h['nombre'][0].lower() + h['nombre'][1:]; p['rio'] = h['nombre']; p['rioOsm'] = h['osm']
        fuera.append(h)
    elif h['tipo'] == 'cruce' and h.get('via'):
        h['detalle'] = h['via']
hitos = [h for h in hitos if h not in fuera]
# la casa y el destino
la, lo = punto(0)
hitos.insert(0, dict(nombre='Camín de Muniellos', km=0, lat=round(CASA_LAT, 6), lon=round(CASA_LON, 6), cota=round(h_casa), tipo='casa', lugar='Penlés', nombreOsm='Pinḷḷés', osm='node/972495071'))
h_dest = float(altura_geo([dest[0]], [dest[1]])[0])
hitos.append(dict(nombre='Tablizas', km=round(float(KM[-1]), 2), lat=round(dest[0], 6), lon=round(dest[1], 6), cota=round(h_dest), tipo='destino',
                  detalle='Centro de recepción de la Reserva Natural Integral de Muniellos', nombreOsm=dest[2], osm='way/412929021', lugarOsm='Las Tablizas (node/4143388213)'))

camin = {
    'casa': {'lat': round(CASA_LAT, 6), 'lon': round(CASA_LON, 6), 'cota': round(h_casa), 'catastro': RC_CASA, 'lugar': 'Penlés'},
    'destino': {'nombre': 'Tablizas', 'detalle': 'Centro de recepción de la Reserva Natural Integral de Muniellos', 'lat': round(dest[0], 6), 'lon': round(dest[1], 6), 'cota': round(h_dest)},
    'kmTotal': round(ruta['distance'] / 1000, 1),
    'minutos': int(round(ruta['duration'] / 60)),
    'ruta': RUTA,
    'hitos': hitos,
    'cotaMin': round(float(dhs.min())), 'cotaMax': round(float(dhs.max())),
    'subida': round(float(np.clip(np.diff(dhs[::10]), 0, None).sum())), 'bajada': round(float(-np.clip(np.diff(dhs[::10]), None, 0).sum())),
    'fuente': {
        'ruta': 'OSRM (router.project-osrm.org, perfil de coche) sobre OpenStreetMap', 'metrosOsrm': round(ruta['distance'], 1), 'segundosOsrm': round(ruta['duration'], 1),
        'cotas': 'MDT05 del IGN (CC BY 4.0), suavizado ±25 m a lo largo de la carretera',
        'nombres': '© colaboradores de OpenStreetMap (ODbL)', 'casa': 'Dirección General del Catastro (INSPIRE BU)',
        'script': 'scripts/lugar-camin.py', 'fecha': time.strftime('%Y-%m-%d'),
    },
}
(DATA / 'lugar-camin.json').write_text(json.dumps(camin, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print('escrito data/lugar-camin.json', (DATA / 'lugar-camin.json').stat().st_size // 1024, 'KB ·', len(RUTA), 'puntos ·', len(hitos), 'hitos')
print(f"cotas: casa {h_casa:.1f} · destino {h_dest:.1f} · mín {dhs.min():.0f} · máx {dhs.max():.0f} · subida {camin['subida']} m · bajada {camin['bajada']} m")
for h in hitos:
    print(f"  km {h['km']:5.2f} · {h['cota']:4d} m · {h['tipo']:7s} · {h['nombre']}" + (f"  [OSM: {h['nombreOsm']}]" if h.get('nombreOsm') and h['nombreOsm'] != h['nombre'] else '') + (f"  (a {h['aMetros']} m)" if 'aMetros' in h else ''))
