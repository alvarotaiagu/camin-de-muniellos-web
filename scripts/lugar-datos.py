# «De la casa a Muniellos» · datos del 3D de Camín de Muniellos (Penlés, Cangas del Narcea).
# Antes: python -I -X utf8 scripts/lugar-camin.py (hace data/lugar-camin.json y baja el MDT).
# Salida: img/lugar/ (alturas en PNG y ortofotos en WebP) y data/lugar-escena.json (la escena).
#
# Coordenadas locales en metros desde el centro de la casa (data/lugar-camin.json): x al este, z al sur, y = altura
# del MDT sobre el nivel del mar, A ESCALA REAL (sin exagerar y sin corregir la curvatura: a 15 km son 15 m).
# Alturas en PNG RGB: (R*256 + G) / 10 − 100 = metros.
#
# Uso: python -I -X utf8 scripts/lugar-datos.py [imagen-de-comprobación.jpg]
import io, json, math, runpy, sys, time, pathlib, xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

C = runpy.run_path(str(pathlib.Path(__file__).with_name('lugar-comun.py')))
R, CACHE, DATA, bajar, altura_geo = C['R'], C['CACHE'], C['DATA'], C['bajar'], C['altura_geo']
OUT = R / 'img' / 'lugar'; OUT.mkdir(parents=True, exist_ok=True)
CAM = json.loads((DATA / 'lugar-camin.json').read_text(encoding='utf-8'))
CASA = (CAM['casa']['lat'], CAM['casa']['lon'])
KX = 111320 * math.cos(math.radians(CASA[0])); KZ = 110950
def loc(lat, lon): return ((np.asarray(lon) - CASA[1]) * KX, (CASA[0] - np.asarray(lat)) * KZ)
def geo(x, z): return (CASA[0] - np.asarray(z) / KZ, CASA[1] + np.asarray(x) / KX)

X0, X1, Z0, Z1 = -13500.0, 4500.0, -4500.0, 16500.0     # la caja de la escena: 18 × 21 km
LEJOS = (-37600.0, 29600.0, -28800.0, 41600.0)          # el anillo lejano (MDT25 a 400 m)
CERCA = 400.0                                           # cajas de detalle (casa y Tablizas): ±400 m
ORTO_CERCA = 300.0                                      # su ortofoto: ±300 m
NBX, NBZ = 6, 7                                         # bloques de ortofoto: 3 × 3 km (6 teselas de malla de 500 m)


def alt_xz(x, z):
    x = np.asarray(x, np.float64); z = np.asarray(z, np.float64)
    la, lo = geo(x, z)
    return altura_geo(la, lo).reshape(x.shape)


def H(x, z): return float(alt_xz(np.array([x]), np.array([z]))[0])


def png_alturas(h, nombre, paso=0.5):
    h = np.round(h / paso) * paso
    v = np.clip(np.round((h + 100.0) * 10), 0, 65535).astype(np.uint16)
    rgb = np.stack([(v >> 8).astype(np.uint8), (v & 255).astype(np.uint8), np.zeros_like(v, np.uint8)], -1)
    Image.fromarray(rgb, 'RGB').save(OUT / nombre, optimize=True)


def rejilla(x0, x1, z0, z1, paso):
    xs = np.linspace(x0, x1, int(round((x1 - x0) / paso)) + 1); zs = np.linspace(z0, z1, int(round((z1 - z0) / paso)) + 1)
    X, Z = np.meshgrid(xs, zs)
    return X, Z


# ------------------------------------------------------------------ la carretera en metros locales
RUTA = np.array(CAM['ruta'])                                   # lon, lat, cota, km
rx, rz = loc(RUTA[:, 1], RUTA[:, 0]); rkm = RUTA[:, 3]
S_TOT = float(rkm[-1])
DEST = loc(CAM['destino']['lat'], CAM['destino']['lon']); DEST = (float(DEST[0]), float(DEST[1]))
print('destino en la escena:', [round(v) for v in DEST], '· carretera', S_TOT, 'km')

# ------------------------------------------------------------------ alturas
rasters = {}
def raster(nombre, x0, x1, z0, z1, paso, prec, archivo=None, suav=0, retoque=None):
    Xg, Zg = rejilla(x0, x1, z0, z1, paso)
    h = alt_xz(Xg, Zg)
    if retoque: h = retoque(Xg, Zg, h)
    if suav: h = ndimage.gaussian_filter(h, suav)
    assert not np.isnan(h).any(), 'huecos en el MDT de ' + nombre
    archivo = archivo or f'alturas-{nombre}.png'
    png_alturas(h, archivo, prec)
    rasters[nombre] = {'x0': x0, 'z0': z0, 'x1': x1, 'z1': z1, 'w': Xg.shape[1], 'h': Xg.shape[0], 'archivo': archivo}
    print('alturas', nombre, Xg.shape[1], 'x', Xg.shape[0], f'{h.min():.0f}-{h.max():.0f} m')
    return h

HV = raster('valle', X0, X1, Z0, Z1, 25.0, 0.5)
raster('valle50', X0, X1, Z0, Z1, 50.0, 0.5, suav=0.5)
raster('tablizas', DEST[0] - CERCA, DEST[0] + CERCA, DEST[1] - CERCA, DEST[1] + CERCA, 5.0, 0.1)
hl = raster('lejos', LEJOS[0], LEJOS[1], LEJOS[2], LEJOS[3], 400.0, 0.5, suav=0.6)
a = int(math.floor((X0 - LEJOS[0]) / 400)) + 1; b = int(math.ceil((X1 - LEJOS[0]) / 400)) - 1
c = int(math.floor((Z0 - LEJOS[2]) / 400)) + 1; d = int(math.ceil((Z1 - LEJOS[2]) / 400)) - 1
rasters['lejos']['hueco'] = [a, c, b, d]                # celdas tapadas por la caja de la escena (con una de solape)


# ------------------------------------------------------------------ ortofotos (WMTS del PNOA, teselas en caché)
def tesela(zoom, c, r):
    f = CACHE / f'wmts{zoom}' / f'{c}-{r}.jpg'
    if f.exists() and f.stat().st_size > 300:
        return f
    f.parent.mkdir(exist_ok=True)
    url = ('https://www.ign.es/wmts/pnoa-ma?layer=OI.OrthoimageCoverage&style=default&tilematrixset=GoogleMapsCompatible'
           f'&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/jpeg&TileMatrix={zoom}&TileCol={c}&TileRow={r}')
    bajar(url, f, minimo=300, espera=1)
    return f


def wmts_caja(x0, x1, z0, z1, zoom, W, Hh, nombre):
    f = CACHE / (nombre + '.png')
    if f.exists():
        return Image.open(f).convert('RGB')
    (N, O), (S, E) = geo(x0, z0), geo(x1, z1)
    n = 2 ** zoom
    tx = lambda lon: (np.asarray(lon, np.float64) + 180) / 360 * n
    ty = lambda lat: (1 - np.arcsinh(np.tan(np.radians(np.asarray(lat, np.float64)))) / np.pi) / 2 * n
    tx0, tx1, ty0, ty1 = float(tx(O)), float(tx(E)), float(ty(N)), float(ty(S))
    cols = range(int(tx0), int(tx1) + 1); filas = range(int(ty0), int(ty1) + 1)
    pares = [(cc, rr) for cc in cols for rr in filas]
    with ThreadPoolExecutor(4) as ex:
        list(ex.map(lambda p: tesela(zoom, *p), pares))
    lienzo = Image.new('RGB', (len(cols) * 256, len(filas) * 256))
    for i, cc in enumerate(cols):
        for j, rr in enumerate(filas):
            lienzo.paste(Image.open(tesela(zoom, cc, rr)).convert('RGB'), (i * 256, j * 256))
    A = np.asarray(lienzo, np.float32)
    # se sobremuestrea ×2 y se reduce con Lanczos (el WMTS viene en Mercator; la escena, en metros locales)
    W2, H2 = W * 2, Hh * 2
    lat = float(N) - (np.arange(H2) + 0.5) / H2 * (float(N) - float(S)); lon = float(O) + (np.arange(W2) + 0.5) / W2 * (float(E) - float(O))
    py = (ty(lat) - int(ty0)) * 256 - 0.5; px = (tx(lon) - int(tx0)) * 256 - 0.5
    PY, PX = np.meshgrid(py, px, indexing='ij')
    out = np.stack([ndimage.map_coordinates(A[..., k], [PY, PX], order=1, mode='nearest') for k in range(3)], -1)
    im = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).resize((W, Hh), Image.LANCZOS)
    im.save(f); print('ortofoto', nombre, im.size, len(pares), 'teselas z' + str(zoom)); return im


def webp(im, nombre, q):
    im.save(OUT / nombre, quality=q, method=6)


orto = {}
# base: toda la caja a ~17,6 m/px (lo primero que se ve, y lo único fuera del corredor)
base = wmts_caja(X0, X1, Z0, Z1, 13, 1024, 1195, 'pnoa-base')
webp(base, 'orto-base.webp', 66)
orto['base'] = {'x0': X0, 'z0': Z0, 'x1': X1, 'z1': Z1, 'archivo': 'orto-base.webp'}
# bloques del corredor: los que quedan a menos de 1,3 km de la carretera, a ~2,9 m/px (y a ~5,9 en el móvil)
bw, bh = (X1 - X0) / NBX, (Z1 - Z0) / NBZ
dens = np.arange(0, S_TOT, 0.02); dx_ = np.interp(dens, rkm, rx); dz_ = np.interp(dens, rkm, rz)
bloques = []
for j in range(NBZ):
    for i in range(NBX):
        bx0, bz0 = X0 + i * bw, Z0 + j * bh
        dd = np.hypot(np.clip(dx_, bx0, bx0 + bw) - dx_, np.clip(dz_, bz0, bz0 + bh) - dz_)
        k = int(dd.argmin())
        b = {'i': i, 'j': j, 'x0': round(bx0, 1), 'z0': round(bz0, 1), 'x1': round(bx0 + bw, 1), 'z1': round(bz0 + bh, 1), 'dist': round(float(dd[k])), 'km': round(float(dens[k]), 2)}
        if dd[k] < 1300:
            im = wmts_caja(bx0, bx0 + bw, bz0, bz0 + bh, 16, 1024, 1024, f'pnoa-b{i}{j}')
            webp(im, f'orto-b{i}{j}-1024.webp', 68); webp(im.resize((512, 512), Image.LANCZOS), f'orto-b{i}{j}-512.webp', 70)
            b['archivos'] = {'alta': f'orto-b{i}{j}-1024.webp', 'baja': f'orto-b{i}{j}-512.webp'}
        bloques.append(b)
print('bloques con ortofoto propia:', sum(1 for b in bloques if 'archivos' in b), 'de', len(bloques))
orto['bloques'] = bloques
# lejos: el anillo (~105 m/px), graduado al color de la base y algo desaturado (bruma)
lej = wmts_caja(LEJOS[0], LEJOS[1], LEJOS[2], LEJOS[3], 10, 640, 672, 'pnoa-lejos')
la_ = np.asarray(lej, np.float32); ba_ = np.asarray(base, np.float32)
la_ = (la_ - la_.reshape(-1, 3).mean(0)) / (la_.reshape(-1, 3).std(0) + 1e-3) * ba_.reshape(-1, 3).std(0) + ba_.reshape(-1, 3).mean(0)
g_ = la_.mean(-1, keepdims=True); la_ = g_ + (la_ - g_) * 0.8
webp(Image.fromarray(np.clip(la_, 0, 255).astype(np.uint8)), 'orto-lejos.webp', 66)
orto['lejos'] = {'x0': LEJOS[0], 'z0': LEJOS[2], 'x1': LEJOS[1], 'z1': LEJOS[3], 'archivo': 'orto-lejos.webp'}
# detalle: la casa (z19, ~0,29 m/px) y Tablizas (z18, ~0,59 m/px)
orto_casa = wmts_caja(-ORTO_CERCA, ORTO_CERCA, -ORTO_CERCA, ORTO_CERCA, 19, 2048, 2048, 'pnoa-casa-z19')
orto_tab = wmts_caja(DEST[0] - ORTO_CERCA, DEST[0] + ORTO_CERCA, DEST[1] - ORTO_CERCA, DEST[1] + ORTO_CERCA, 18, 1024, 1024, 'pnoa-tablizas-z18')
webp(orto_tab, 'orto-tablizas-1024.webp', 72); webp(orto_tab.resize((512, 512), Image.LANCZOS), 'orto-tablizas-512.webp', 74)
orto['tablizas'] = {'x0': DEST[0] - ORTO_CERCA, 'z0': DEST[1] - ORTO_CERCA, 'x1': DEST[0] + ORTO_CERCA, 'z1': DEST[1] + ORTO_CERCA,
                    'archivos': {'alta': 'orto-tablizas-1024.webp', 'baja': 'orto-tablizas-512.webp'}}


# ------------------------------------------------------------------ Catastro: la casa y el pueblo
(S_, O_), (N_, E_) = geo(-330, 330), geo(330, -330)
bp = C['poligonos'](C['wfs_bu']('BU:BuildingPart', float(S_), float(O_), float(N_), float(E_), 'bp-pueblo.xml'))
print('Catastro: partes de edificio alrededor de la casa:', len(bp))
RC = C['RC_CASA']
cl = C['clasifica_casa']([b for b in bp if b['id'].startswith(RC)])
PAPEL = {id(cl['cuerpo']): 'part3', id(cl['trasera']): 'part1', id(cl['terraza']): 'part8', id(cl['anexo']): 'anexo'}
oc = np.asarray(orto_casa, np.float32); CW = orto_casa.width
def a_px(x, z): return ((np.asarray(x) + ORTO_CERCA) / (2 * ORTO_CERCA) * CW, (np.asarray(z) + ORTO_CERCA) / (2 * ORTO_CERCA) * CW)

mascara = Image.new('L', (CW, CW), 0); dm = ImageDraw.Draw(mascara)
edificios = []; partes_casa = {}
for b in bp:
    if not b['anillos']: continue
    pts = [tuple(float(t) for t in loc(la, lo)) for la, lo in b['anillos'][0]]
    if pts[0] == pts[-1]: pts = pts[:-1]
    es_casa = b['id'].startswith(RC) and b is not cl['anexo']
    if es_casa:
        partes_casa[PAPEL.get(id(b), b['id'].split('_')[1] + 'c')] = pts
    if C['area'](pts) < 6 and not es_casa: continue
    cx, cz = np.mean(pts, 0)
    if abs(cx) > 300 or abs(cz) > 300: continue
    for dz in (0.0, -0.8, -1.6):                   # para borrar el tejado de la foto (el edificio va en 3D)
        dm.polygon([tuple(map(float, a_px(x, z + dz))) for x, z in pts], fill=255)
    if es_casa: continue
    mk = Image.new('L', (CW, CW), 0)
    ImageDraw.Draw(mk).polygon([tuple(map(float, a_px(x, z - 0.8))) for x, z in pts], fill=255)
    mkA = ndimage.binary_erosion(np.asarray(mk) > 0, iterations=4)
    col = np.median(oc[mkA], 0) if mkA.sum() > 30 else np.array([96, 100, 108], np.float32)
    suelo = alt_xz(np.array([p[0] for p in pts]), np.array([p[1] for p in pts]))
    edificios.append({'id': b['id'], 'pisos': b['pisos'] or 1, 'anillo': [[round(x, 2), round(z, 2)] for x, z in pts], 'rect': {k: float(v) for k, v in C['rect_orientado'](pts).items()},
                      'suelo': round(float(suelo.min()), 2), 'sueloMax': round(float(suelo.max()), 2),
                      'tejado': '#%02x%02x%02x' % tuple(int(v) for v in np.clip(col, 0, 255)), 'area': round(C['area'](pts), 1)})
print('edificios del pueblo en 3D:', len(edificios))

# la casa en su propio marco: u a lo largo de la fachada (hacia el suroeste), v hacia la ladera (noroeste).
# Medidas del Catastro (ver LUGAR.md): fachada en v = −0,6; banda del corredor hasta v = −2,7 con cuatro «dientes» de
# tres plantas que son las buhardillas; cuerpo de 3 plantas hasta v = 4,7 y una crujía de 2 plantas hasta v = 6,7.
todo = [q for k, an in partes_casa.items() if k != 'part8' for q in an]
rc = C['rect_orientado'](todo)
ang = rc['ang']; ca, sa = math.cos(ang), math.sin(ang)
# origen del marco: el centro de part1+part3 a lo largo y la línea de fachada (v = 0 en el muro)
def a_uv(x, z, ox=0.0, oz=0.0): return ((x - ox) * ca + (z - oz) * sa, -(x - ox) * sa + (z - oz) * ca)
uv3 = [a_uv(x, z) for x, z in partes_casa['part3']]
us = sorted(set(round(u, 1) for u, v in uv3)); vs = [v for u, v in uv3]
u_min, u_max = min(u for u, v in uv3), max(u for u, v in uv3)
v_front = min(vs)                                             # el borde de fuera del corredor
vv = sorted(vs); v_fach = float(np.median([v for v in vs if v_front + 1 < v < v_front + 3]))     # el muro de fachada
v_tras3 = max(vs); v_tras = max(v for x, z in partes_casa['part1'] for u, v in [a_uv(x, z)])
u0 = (u_min + u_max) / 2
ox, oz = u0 * ca - v_fach * sa, u0 * sa + v_fach * ca         # origen del marco en la escena
def marco(x, z): return a_uv(x, z, ox, oz)
def mundo(u, v): return (ox + u * ca - v * sa, oz + u * sa + v * ca)
# los dientes de 3 plantas (las buhardillas): tramos de part3 que llegan al borde del corredor
m3 = [marco(x, z) for x, z in partes_casa['part3']]
dientes = []
for i in range(len(m3)):
    p, q = m3[i], m3[(i + 1) % len(m3)]
    if abs(p[1] - q[1]) < 0.4 and p[1] < (v_front - v_fach) + 0.5 and abs(p[0] - q[0]) > 0.8:
        dientes.append(round((p[0] + q[0]) / 2, 2))
dientes.sort()
terr = [[round(v, 2) for v in marco(x, z)] for x, z in partes_casa['part8']]
largo = u_max - u_min
# cotas del suelo: la era de delante (entre la fachada y 7 m por delante) y detrás
fr = [H(*mundo(u, v)) for u in np.linspace(-largo / 2, largo / 2, 7) for v in (-1.0, -3.0, -5.0, -7.0)]
tr = [H(*mundo(u, v_tras - v_fach + 1.0)) for u in np.linspace(-largo / 2, largo / 2, 7)]
# el hórreo: su tejado a cuatro aguas se ve en la ortofoto delante de la mitad suroeste de la fachada (posición a ojo)
HORREO_UV = (2.6, -7.4)
hxw = mundo(*HORREO_UV)
casa = {
    'x': round(ox, 2), 'z': round(oz, 2), 'ang': round(ang, 4), 'rumboFachada': round((math.degrees(math.atan2(sa, -ca)) + 360) % 360, 1),
    'largo': round(largo, 2), 'corredor': round(v_fach - v_front, 2), 'fondo3': round(v_tras3 - v_fach, 2), 'fondo': round(v_tras - v_fach, 2),
    'buhardillas': dientes, 'terraza': terr,
    'sueloDelante': round(float(np.median(fr)), 2), 'sueloDetras': round(float(np.mean(tr)), 2), 'sueloCentro': round(H(ox, oz), 2),
    'horreo': {'u': HORREO_UV[0], 'v': HORREO_UV[1], 'suelo': round(H(*hxw), 2)},
    'cota': CAM['casa']['cota'], 'catastro': RC,
}
print('la casa:', casa)


# El MDT05 no ve la era: la plataforma llana de delante de la casa (donde están el hórreo y la terraza). En la
# caja de detalle se aplana a la cota «sueloDelante» (un rectángulo de ~23 × 13 m, con 5 m de transición), para
# que el zócalo no quede enterrado ni el hórreo en el aire. Es el único retoque del relieve (ver LUGAR.md).
def aplana_era(Xg, Zg, h):
    u = (Xg - ox) * ca + (Zg - oz) * sa; v = -(Xg - ox) * sa + (Zg - oz) * ca
    du = np.maximum(np.maximum(-12.0 - u, u - 10.5), 0); dv = np.maximum(np.maximum(-11.5 - v, v - 1.5), 0)
    w = np.clip(1 - np.hypot(du, dv) / 5.0, 0, 1); w = w * w * (3 - 2 * w)
    print('  era aplanada: el relieve cambia como mucho', round(float(np.abs((casa['sueloDelante'] - h) * w).max()), 1), 'm en', int((w > 0.02).sum()), 'celdas de 4 m')
    return h * (1 - w) + casa['sueloDelante'] * w


raster('casa', -CERCA, CERCA, -CERCA, CERCA, 4.0, 0.1, retoque=aplana_era)
# rumbo de la fachada: hacia dónde mira el corredor (−v), en grados desde el norte
nx, nz = sa, -ca                                               # −v en la escena
casa['rumboFachada'] = round((math.degrees(math.atan2(nx, -nz)) + 360) % 360, 1)
print('el corredor mira al rumbo', casa['rumboFachada'], '°')

# la ortofoto de la casa sin tejados (relleno por convolución normalizada)
for dz in (0.0, -0.8):                             # y el hórreo (5 m de lado, con su alero)
    hq = [mundo(HORREO_UV[0] + du, HORREO_UV[1] + dv) for du, dv in ((-3.6, -3.6), (3.6, -3.6), (3.6, 3.6), (-3.6, 3.6))]
    dm.polygon([tuple(map(float, a_px(x, z + dz))) for x, z in hq], fill=255)
m = ndimage.binary_dilation(np.asarray(mascara) > 0, iterations=4)
a_ = oc.copy(); peso = (~m).astype(np.float32)
for sigma in (4, 8, 16, 32):
    num = np.stack([ndimage.gaussian_filter(a_[..., k] * peso, sigma) for k in range(3)], -1)
    den = ndimage.gaussian_filter(peso, sigma)[..., None]
    hueco = m & (den[..., 0] > 0.15)
    a_[hueco] = (num / np.maximum(den, 1e-4))[hueco]; peso = np.maximum(peso, hueco.astype(np.float32)); m = m & ~hueco
orto_c2 = Image.fromarray(np.clip(a_, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.4))
webp(orto_c2, 'orto-casa-2048.webp', 72); webp(orto_c2.resize((1024, 1024), Image.LANCZOS), 'orto-casa-1024.webp', 74)
orto['casa'] = {'x0': -ORTO_CERCA, 'z0': -ORTO_CERCA, 'x1': ORTO_CERCA, 'z1': ORTO_CERCA, 'archivos': {'alta': 'orto-casa-2048.webp', 'baja': 'orto-casa-1024.webp'}}

# Tablizas: los edificios del centro de recepción (plantas de OpenStreetMap; el Catastro no los tiene como urbanos)
root = ET.parse(CACHE / 'osm-corredor.osm').getroot()
NOD = {n.get('id'): (float(n.get('lat')), float(n.get('lon'))) for n in root.iter('node')}
tablizas = []
for w in root.iter('way'):
    t = {q.get('k'): q.get('v') for q in w.findall('tag')}
    if 'building' not in t: continue
    pts = [tuple(float(v) for v in loc(*NOD[nd.get('ref')])) for nd in w.findall('nd')][:-1]
    cx, cz = np.mean(pts, 0)
    if math.hypot(cx - DEST[0], cz - DEST[1]) > 200: continue
    suelo = alt_xz(np.array([p[0] for p in pts]), np.array([p[1] for p in pts]))
    tablizas.append({'id': 'way/' + w.get('id'), 'nombre': t.get('name', ''), 'anillo': [[round(x, 2), round(z, 2)] for x, z in pts], 'rect': {k: float(v) for k, v in C['rect_orientado'](pts).items()},
                     'suelo': round(float(suelo.min()), 2), 'sueloMax': round(float(suelo.max()), 2), 'pisos': 1})
print('edificios de Tablizas (OSM):', [(e['id'], e['nombre'], e['rect']['lu'], e['rect']['lv']) for e in tablizas])


# ------------------------------------------------------------------ la carretera y los hitos en la escena
PASO = 12.0                                         # un punto cada 12 m (para la cinta sobre el relieve)
sk = np.arange(0, S_TOT * 1000 + PASO, PASO) / 1000; sk[-1] = S_TOT
cx_ = np.interp(sk, rkm, rx); cz_ = np.interp(sk, rkm, rz)
cinta = [[round(float(x), 1), round(float(z), 1), round(float(k), 3)] for x, z, k in zip(cx_, cz_, sk)]
hitos = []
for h in CAM['hitos']:
    x, z = loc(h['lat'], h['lon'])
    hitos.append({'nombre': h['nombre'], 'km': h['km'], 'tipo': h['tipo'], 'cota': h['cota'], 'x': round(float(x), 1), 'z': round(float(z), 1),
                  'y': round(H(float(x), float(z)), 1), 'detalle': h.get('detalle', '')})


# ------------------------------------------------------------------ el vuelo de la cámara
# p 0 → P_SALE: la casa de cerca.  P_SALE → P_LLEGA: sigue la carretera (km 0 → final).  P_LLEGA → 1: Tablizas.
P_SALE, P_LLEGA = 0.13, 0.92
ds = 10.0
s = np.arange(-3000, S_TOT * 1000 + 3000 + ds, ds)
sx = np.interp(s, rkm * 1000, rx); sz = np.interp(s, rkm * 1000, rz)
# antes de la casa y después de Tablizas: recto, con el rumbo medio del primer y del último medio kilómetro
def rumbo_medio(a, b): v = np.array([np.interp(b, rkm * 1000, rx) - np.interp(a, rkm * 1000, rx), np.interp(b, rkm * 1000, rz) - np.interp(a, rkm * 1000, rz)]); return v / np.hypot(*v)
d_ini = rumbo_medio(0, 1500); d_fin = rumbo_medio(S_TOT * 1000 - 900, S_TOT * 1000)
antes = s < 0; desp = s > S_TOT * 1000
sx[antes] = rx[0] + d_ini[0] * s[antes]; sz[antes] = rz[0] + d_ini[1] * s[antes]
sx[desp] = rx[-1] + d_fin[0] * (s[desp] - S_TOT * 1000); sz[desp] = rz[-1] + d_fin[1] * (s[desp] - S_TOT * 1000)
gs = lambda v, sig: ndimage.gaussian_filter1d(v, sig / ds, mode='nearest')
ax_, az_ = gs(sx, 400), gs(sz, 400)                 # la carretera suavizada (las revueltas no marean a la cámara)
i_de = lambda m: np.clip(((m - s[0]) / ds).astype(int), 0, len(s) - 1)
ii = np.arange(len(s))
dxv = ax_[np.clip(ii + 90, 0, len(s) - 1)] - ax_[np.clip(ii - 30, 0, len(s) - 1)]; dzv = az_[np.clip(ii + 90, 0, len(s) - 1)] - az_[np.clip(ii - 30, 0, len(s) - 1)]
nn = np.hypot(dxv, dzv); dxv /= nn; dzv /= nn
ATRAS, ALTO = 520.0, 250.0
camx = gs(ax_ - ATRAS * dxv, 300); camz = gs(az_ - ATRAS * dzv, 300)
# a dónde mira: la carretera 450 m por delante del punto actual
mirx = ax_[np.clip(ii + 45, 0, len(s) - 1)]; mirz = az_[np.clip(ii + 45, 0, len(s) - 1)]
miry = alt_xz(mirx, mirz)
# altura: sobre la carretera y, además, con holgura sobre lo más alto del relieve en 250 m alrededor de la cámara
suelo_ruta = alt_xz(sx, sz)
tope = np.full(len(s), -1e9)
for ddx, ddz in [(0, 0)] + [(250 * math.cos(t), 250 * math.sin(t)) for t in np.linspace(0, 2 * math.pi, 8, endpoint=False)] + [(120 * math.cos(t), 120 * math.sin(t)) for t in np.linspace(0, 2 * math.pi, 6, endpoint=False)]:
    tope = np.maximum(tope, alt_xz(camx + ddx, camz + ddz))
camy = np.maximum(gs(suelo_ruta, 300) + ALTO, tope + 110)
# la marca del punto actual tiene que verse: si el relieve tapa la línea cámara → carretera, la cámara sube
for vuelta in range(14):
    malo = np.zeros(len(s), bool)
    for t in np.linspace(0.08, 0.95, 24):
        lx = camx + (sx - camx) * t; lz = camz + (sz - camz) * t; ly = camy + (suelo_ruta + 4 - camy) * t
        malo |= alt_xz(lx, lz) > ly - 6
    if not malo.any(): break
    camy = camy + 25 * ndimage.maximum_filter1d(malo.astype(float), 41)
print('  vuelo: puntos con la carretera tapada tras subir la cámara:', int(malo.sum()), '(vueltas:', vuelta + 1, ')')
camy = gs(ndimage.maximum_filter1d(camy, 41), 300)

# marco de la casa → escena, para los planos de cerca
y0 = casa['sueloDelante']
def P(u, v, alto): x, z = mundo(u, v); return [round(x, 1), round(y0 + alto, 1), round(z, 1)]
claves = [
    # p, cámara, mira, km
    (0.000, P(-9.5, -17.5, 3.4), P(0.8, 0, 4.3), 0.0),          # delante, desde el lado de la terraza: el hórreo a la izquierda, como en su foto
    (0.040, P(-15, -38, 9.5), P(1.0, 0, 4.2), 0.0),
    (0.075, P(-34, -78, 34), P(0, 0, 3.5), 0.0),               # se retira y sube: la casa en Penlés
    (0.105, P(-70, -190, 110), P(8, 30, 0), 0.0),
]
k0 = int(i_de(np.array([0.0]))[0]); k1 = int(i_de(np.array([S_TOT * 1000]))[0])
paso_clave = 25                                     # una clave cada 250 m de carretera
ks = list(range(k0, k1, paso_clave)) + [k1]
for k in ks:
    f = (s[k] / 1000) / S_TOT
    claves.append((round(P_SALE + (P_LLEGA - P_SALE) * f, 5), [round(float(camx[k]), 1), round(float(camy[k]), 1), round(float(camz[k]), 1)],
                   [round(float(mirx[k]), 1), round(float(miry[k]) + 20, 1), round(float(mirz[k]), 1)], round(float(s[k] / 1000), 3)))
# Tablizas: baja hacia el centro de recepción y mira valle arriba, al robledal
def en_ruta(km): return float(np.interp(km, rkm, rx)), float(np.interp(km, rkm, rz))
ax1, az1 = en_ruta(S_TOT - 0.95); ax2, az2 = en_ruta(S_TOT - 0.40)
mx, mz = DEST[0] + d_fin[0] * 800, DEST[1] + d_fin[1] * 800
claves.append((0.965, [round(ax1, 1), round(H(ax1, az1) + 150, 1), round(az1, 1)], [round(DEST[0], 1), round(H(*DEST) + 25, 1), round(DEST[1], 1)], S_TOT))
claves.append((1.0, [round(ax2, 1), round(H(ax2, az2) + 55, 1), round(az2, 1)], [round(float(mx), 1), round(H(mx, mz) + 45, 1), round(float(mz), 1)], S_TOT))
vuelo = [{'p': c[0], 'pos': c[1], 'mira': c[2], 'km': c[3]} for c in claves]


def monotona(ps, vs):
    k = len(ps); dd = [(vs[i + 1] - vs[i]) / (ps[i + 1] - ps[i]) for i in range(k - 1)]; mm = [0.0] * k
    for i in range(1, k - 1):
        if dd[i - 1] * dd[i] <= 0: continue
        h0, h1 = ps[i] - ps[i - 1], ps[i + 1] - ps[i]
        mm[i] = 3 * (h0 + h1) / ((2 * h1 + h0) / dd[i - 1] + (h1 + 2 * h0) / dd[i])
    ps = np.array(ps); vs = np.array(vs); mm = np.array(mm)
    def f(p):
        j = np.clip(np.searchsorted(ps, p, side='right') - 1, 0, k - 2)
        h = ps[j + 1] - ps[j]; t = np.clip((p - ps[j]) / h, 0, 1)
        return (2 * t**3 - 3 * t**2 + 1) * vs[j] + (t**3 - 2 * t**2 + t) * h * mm[j] + (-2 * t**3 + 3 * t**2) * vs[j + 1] + (t**3 - t**2) * h * mm[j + 1]
    return f


def holgura(vu, n=6000):
    ps = [v['p'] for v in vu]
    fx_, fy_, fz_ = (monotona(ps, [v['pos'][i] for v in vu]) for i in range(3))
    Pp = np.linspace(0, 1, n)
    return fy_(Pp) - alt_xz(fx_(Pp), fz_(Pp)), Pp


minimo = lambda Pp: np.where(Pp < 0.05, 3.0, np.where(Pp < 0.11, 12.0, np.where(Pp > 0.985, 30.0, np.where(Pp > 0.95, 45.0, 70.0))))
for vuelta in range(40):
    hol, Pp = holgura(vuelo)
    falta = hol - minimo(Pp)
    if falta.min() >= 0: break
    k = int(falta.argmin()); j = min(range(len(vuelo)), key=lambda i: abs(vuelo[i]['p'] - Pp[k]))
    vuelo[j]['pos'][1] = round(vuelo[j]['pos'][1] + max(15.0, -float(falta[k]) + 5), 1)
hol, Pp = holgura(vuelo)
print(f'vuelo: {len(vuelo)} claves · holgura mínima sobre el relieve: {hol[Pp < 0.05].min():.1f} m (casa) · {hol[(Pp >= 0.11) & (Pp <= 0.97)].min():.0f} m (carretera) · {hol[Pp > 0.97].min():.0f} m (Tablizas)')
print('  altura de la cámara sobre la carretera, cada 2 km:', [round(float(camy[int(i_de(np.array([m * 1000.0]))[0])] - suelo_ruta[int(i_de(np.array([m * 1000.0]))[0])])) for m in range(0, 20, 2)])

# en el último plano, Tablizas tiene que caer dentro del encuadre
c_ = np.array(vuelo[-1]['pos']); t_ = np.array(vuelo[-1]['mira']); q_ = np.array([DEST[0], H(*DEST) + 3, DEST[1]])
def ang_h(v): return math.degrees(math.atan2(v[0], -v[2]))
def ang_v(v): return math.degrees(math.atan2(v[1], math.hypot(v[0], v[2])))
print(f'  plano final: Tablizas a {np.linalg.norm(q_ - c_):.0f} m, {ang_h(q_ - c_) - ang_h(t_ - c_):+.1f}° en horizontal y {ang_v(q_ - c_) - ang_v(t_ - c_):+.1f}° en vertical respecto al centro del encuadre')
assert abs(ang_h(q_ - c_) - ang_h(t_ - c_)) < 16 and abs(ang_v(q_ - c_) - ang_v(t_ - c_)) < 14, 'Tablizas se sale del último plano'

# la cámara de la casa no puede caer dentro de un edificio
def dentro_pol(x, z, an):
    c_ = False
    for i in range(len(an)):
        (x1, z1), (x2, z2) = an[i], an[i - 1]
        if (z1 > z) != (z2 > z) and x < (x2 - x1) * (z - z1) / (z2 - z1) + x1: c_ = not c_
    return c_
for v in vuelo[:3]:
    assert not any(dentro_pol(v['pos'][0], v['pos'][2], e['anillo']) for e in edificios), 'la cámara cae dentro de un edificio'
    print('  clave p =', v['p'], '· cámara a', round(v['pos'][1] - H(v['pos'][0], v['pos'][2]), 1), 'm del suelo ·', round(min(math.hypot(v['pos'][0] - x, v['pos'][2] - z) for e in edificios for x, z in e['anillo']), 1), 'm del edificio vecino más cercano')

escena = {
    'caja': {'x0': X0, 'z0': Z0, 'x1': X1, 'z1': Z1}, 'kx': round(KX, 2), 'kz': KZ, 'lat': CASA[0], 'lon': CASA[1],
    'casa': casa, 'destino': {'x': round(DEST[0], 1), 'z': round(DEST[1], 1), 'y': round(H(*DEST), 1), 'cota': CAM['destino']['cota'], 'rumbo': [round(float(d_fin[0]), 4), round(float(d_fin[1]), 4)]},
    'kmTotal': CAM['kmTotal'], 'kmFinal': S_TOT, 'minutos': CAM['minutos'],
    'rasters': rasters, 'orto': orto, 'edificios': edificios, 'tablizas': tablizas,
    'cinta': cinta, 'hitos': hitos, 'vuelo': vuelo, 'tramos': {'sale': P_SALE, 'llega': P_LLEGA},
    'fuente': 'scripts/lugar-datos.py (agente Lugar 3D)', 'fecha': time.strftime('%Y-%m-%d'),
}
(DATA / 'lugar-escena.json').write_text(json.dumps(escena, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print('escrito data/lugar-escena.json', (DATA / 'lugar-escena.json').stat().st_size // 1024, 'KB')
tot = 0
for f in sorted(OUT.iterdir()):
    tot += f.stat().st_size
print('img/lugar/:', len(list(OUT.iterdir())), 'ficheros ·', tot // 1024, 'KB')

# imagen de comprobación (no va a la web): la ortofoto de la casa con las plantas del modelo encima
if len(sys.argv) > 1:
    L = 45.0; k0_ = int((ORTO_CERCA - L) / (2 * ORTO_CERCA) * CW); k1_ = CW - k0_
    im = orto_casa.crop((k0_, k0_, k1_, k1_)).resize((1100, 1100), Image.LANCZOS); dr = ImageDraw.Draw(im)
    px = lambda x, z: ((x + L) / (2 * L) * 1100, (z + L) / (2 * L) * 1100)
    lg = casa['largo'] / 2
    caja_ = lambda u0_, u1_, v0_, v1_: [px(*mundo(u, v)) for u, v in ((u0_, v0_), (u1_, v0_), (u1_, v1_), (u0_, v1_), (u0_, v0_))]
    dr.line(caja_(-lg, lg, 0, casa['fondo']), fill=(255, 60, 60), width=2)
    dr.line(caja_(-lg, lg, -casa['corredor'], 0), fill=(255, 200, 0), width=2)
    for u in casa['buhardillas']: dr.line(caja_(u - 0.75, u + 0.75, -casa['corredor'], 1.2), fill=(0, 255, 255), width=2)
    dr.line([px(*mundo(u, v)) for u, v in terr + terr[:1]], fill=(255, 0, 255), width=2)
    dr.line(caja_(HORREO_UV[0] - 2.3, HORREO_UV[0] + 2.3, HORREO_UV[1] - 2.3, HORREO_UV[1] + 2.3), fill=(0, 255, 0), width=2)
    for v in vuelo[:2]: x, y = px(v['pos'][0], v['pos'][2]); dr.ellipse((x - 5, y - 5, x + 5, y + 5), outline=(255, 255, 255), width=2)
    im.save(sys.argv[1], quality=90); print('comprobación en', sys.argv[1])
