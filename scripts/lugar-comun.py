# Utillaje común de los scripts lugar-* de Camín de Muniellos (agente Lugar 3D).
# No se ejecuta solo: lo cargan lugar-camin.py y lugar-datos.py con runpy.
#
# Fuentes (todas abiertas):
#   - MDT05 y MDT25 del IGN por WCS (servicios.idee.es/wcs-inspire/mdt)                 CC BY 4.0, © IGN
#   - Ortofoto PNOA por WMTS (www.ign.es/wmts/pnoa-ma)                                    CC BY 4.0, © IGN
#   - Edificios del Catastro INSPIRE (ovc.catastro.meh.es, WFS BU)                        © Dirección General del Catastro
#   - Carretera, pueblos y ríos de OpenStreetMap (API 0.6 /map; ruta de OSRM)             ODbL, © colaboradores de OSM
# Todo lo descargado se guarda en ref/raw/lugar-cache/ (no viaja a la web ni al repo).
import io, json, math, pathlib, re, time, urllib.request
import numpy as np
from scipy import ndimage
import tifffile

R = pathlib.Path(__file__).resolve().parent.parent
CACHE = R / 'ref' / 'raw' / 'lugar-cache'; CACHE.mkdir(parents=True, exist_ok=True)
DATA = R / 'data'; DATA.mkdir(exist_ok=True)
UA = {'User-Agent': 'datos-mapa-script/1.0 (uso puntual)'}       # sin datos personales

# El punto de partida (el de su visita virtual de Google) solo sirve para pedir datos alrededor.
PARTIDA = (43.1516784, -6.5753796)
RC_CASA = 'U20301500PH98B'          # la casa de la foto (ver LUGAR.md, «La casa»)
# Caja de datos: de la casa a Tablizas con margen (≈ 22 × 19,5 km)
CAJA = dict(S=42.995, N=43.195, O=-6.745, E=-6.505)


def bajar(url, destino, intentos=5, minimo=2000, espera=3):
    if destino.exists() and destino.stat().st_size > minimo:
        return destino.read_bytes()
    for k in range(intentos):
        try:
            b = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=180).read()
            if len(b) < minimo and b'<' in b[:200]:
                raise IOError(b[:120])
            destino.write_bytes(b); print('bajado', destino.name, len(b) // 1024, 'KB'); return b
        except Exception as e:
            print('falla', destino.name, str(e)[:90]); time.sleep(espera + 4 * k)
    raise SystemExit('No se pudo bajar ' + destino.name)


class Raster:
    def __init__(self, f):
        t = tifffile.TiffFile(f); p = t.pages[0]
        self.a = p.asarray().astype(np.float32)
        sx, sy = p.tags['ModelPixelScaleTag'].value[:2]
        tp = p.tags['ModelTiepointTag'].value
        self.O, self.N = tp[3], tp[4]; self.sx, self.sy = sx, sy
        self.E = self.O + sx * self.a.shape[1]; self.S = self.N - sy * self.a.shape[0]
        self.a[self.a < -100] = np.nan
        t.close()

    def dentro(self, lat, lon, margen=2):
        return ((lat > self.S + margen * self.sy) & (lat < self.N - margen * self.sy) &
                (lon > self.O + margen * self.sx) & (lon < self.E - margen * self.sx))

    def muestrea(self, lat, lon, orden=1):
        fil = (self.N - lat) / self.sy - 0.5; col = (lon - self.O) / self.sx - 0.5
        return ndimage.map_coordinates(self.a, [fil, col], order=orden, mode='nearest', prefilter=False)


def wcs(cov, S, N, O, E, nombre):
    url = ('https://servicios.idee.es/wcs-inspire/mdt?SERVICE=WCS&VERSION=2.0.1&REQUEST=GetCoverage'
           f'&COVERAGEID={cov}&FORMAT=image/tiff&SUBSET=Lat({S},{N})&SUBSET=Long({O},{E})')
    bajar(url, CACHE / nombre)
    return Raster(CACHE / nombre)


def teselas(cov, S, N, O, E, nx, ny, base):
    out = []
    for i in range(nx):
        for j in range(ny):
            o, e = O + (E - O) * i / nx, O + (E - O) * (i + 1) / nx
            s, n = S + (N - S) * j / ny, S + (N - S) * (j + 1) / ny
            # solape de 0,004° para que el muestreo bilineal no caiga en el borde
            out.append(wcs(cov, round(s - 0.004, 5), round(n + 0.004, 5), round(o - 0.004, 5), round(e + 0.004, 5), f'{base}-{i}{j}.tif'))
    return out


_CAPAS = None


def capas():
    global _CAPAS
    if _CAPAS is None:
        c = CAJA
        m5 = teselas('Elevacion4258_5', c['S'], c['N'], c['O'], c['E'], 3, 3, 'mdt5')
        m25 = teselas('Elevacion4258_25', c['S'] - 0.22, c['N'] + 0.22, c['O'] - 0.30, c['E'] + 0.30, 2, 2, 'mdt25')
        _CAPAS = [m5, m25]
    return _CAPAS


def altura_geo(lat, lon):
    """Altura (m) del MDT más fino que cubra cada punto (MDT05 y, fuera de su caja, MDT25)."""
    lat = np.asarray(lat, np.float64).ravel(); lon = np.asarray(lon, np.float64).ravel()
    h = np.full(lat.shape, np.nan)
    for capa in capas():
        for r in capa:
            pend = np.isnan(h)
            if not pend.any():
                return h
            m = pend & r.dentro(lat, lon)
            if m.any():
                h[m] = r.muestrea(lat[m], lon[m])
    return h


def haversine(lat1, lon1, lat2, lon2):
    p1, p2 = np.radians(lat1), np.radians(lat2)
    a = np.sin((p2 - p1) / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(np.radians(lon2 - lon1) / 2) ** 2
    return 2 * 6371008.8 * np.arcsin(np.sqrt(a))


# ------------------------------------------------------------------ Catastro
def wfs_bu(tipo, S, O, N, E, nombre):
    url = (f'https://ovc.catastro.meh.es/INSPIRE/wfsBU.aspx?service=WFS&version=2.0.0&request=GetFeature'
           f'&typenames={tipo}&srsname=EPSG::4258&bbox={S},{O},{N},{E}')
    return bajar(url, CACHE / nombre, minimo=600).decode('latin-1')


def poligonos(xml):
    """[{id, pisos, bajo, anillos: [[(lat, lon), …]]}] de un GML de edificios del Catastro."""
    out = []
    for m in re.finditer(r'<(?:gml:featureMember|wfs:member|member)>(.*?)</(?:gml:featureMember|wfs:member|member)>', xml, re.S):
        f = m.group(1)
        lid = re.search(r'localId>([^<]+)', f)
        pis = re.search(r'numberOfFloorsAboveGround>(\d+)', f); baj = re.search(r'numberOfFloorsBelowGround>(\d+)', f)
        anillos = []
        for pl in re.findall(r'<gml:posList[^>]*>([^<]+)</gml:posList>', f):
            v = list(map(float, pl.split()))
            anillos.append([(v[i], v[i + 1]) for i in range(0, len(v), 2)])
        out.append({'id': lid.group(1) if lid else '?', 'pisos': int(pis.group(1)) if pis else None,
                    'bajo': int(baj.group(1)) if baj else 0, 'anillos': anillos})
    return out


def area(pts):
    return 0.5 * abs(sum(pts[i][0] * pts[i - 1][1] - pts[i - 1][0] * pts[i][1] for i in range(len(pts))))


def centroide(pts):
    a = cx = cy = 0.0
    for i in range(len(pts)):
        x0, y0 = pts[i - 1]; x1, y1 = pts[i]; c = x0 * y1 - x1 * y0
        a += c; cx += (x0 + x1) * c; cy += (y0 + y1) * c
    return (cx / (3 * a), cy / (3 * a), abs(a) / 2) if abs(a) > 1e-9 else (pts[0][0], pts[0][1], 0.0)


def rect_orientado(pts):
    P = np.array(pts); mejor = None
    for g in np.radians(np.arange(0, 180, 0.25)):
        c, s = math.cos(g), math.sin(g)
        u = P[:, 0] * c + P[:, 1] * s; v = -P[:, 0] * s + P[:, 1] * c
        a = (u.max() - u.min()) * (v.max() - v.min())
        if (mejor is None or a < mejor[0] - 1e-6) and (u.max() - u.min()) >= (v.max() - v.min()):
            mejor = (a, g, (u.max() + u.min()) / 2, (v.max() + v.min()) / 2, u.max() - u.min(), v.max() - v.min())
    a, g, uc, vc, lu, lv = mejor
    c, s = math.cos(g), math.sin(g)
    # lu = lado largo (a lo largo de «ang», medido desde +x hacia +z), lv = lado corto
    return {'cx': round(uc * c - vc * s, 2), 'cz': round(uc * s + vc * c, 2), 'lu': round(lu, 2), 'lv': round(lv, 2), 'ang': round(g, 4)}


def clasifica_casa(partes):
    """Las partes de la parcela de la casa, por su forma (el WFS no numera igual las partes en cada consulta):
    cuerpo (3 plantas, el polígono dentado), anexo (3 plantas, el edificio cuadrado del suroeste: no es la casa de
    la foto), trasera (la crujía de 2 plantas más grande), terraza (1 planta) y corredor (el resto, 2 plantas)."""
    tres = sorted([p for p in partes if p['pisos'] == 3], key=lambda p: -len(p['anillos'][0]))
    dos = sorted([p for p in partes if p['pisos'] == 2], key=lambda p: -area([(la * 110950, lo * 81000) for la, lo in p['anillos'][0][:-1]]))
    una = [p for p in partes if p['pisos'] == 1]
    assert len(tres) == 2 and len(una) == 1 and len(dos) >= 2 and len(tres[0]['anillos'][0]) > 15, 'la parcela de la casa ya no tiene la forma esperada'
    return {'cuerpo': tres[0], 'anexo': tres[1], 'trasera': dos[0], 'terraza': una[0], 'corredor': dos[1:]}
