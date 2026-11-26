# Fotos publicables → img/fotos/<nombre>-<ancho>.{webp,jpg} + img/fotos/fotos.json. NUNCA se amplía.
#   python -I -X utf8 scripts/fotos.py
# Regla dura del encargo:
# - SUYAS (ref/origen/web/, de su web y de su biblioteca de medios): se publican. Sus «2560 px» están ampliadas (detalle
#   real de unos 1400-1600 px), así que se sirven como mucho a 1920.
#   20190526_162018-scaled.jpg NO se publica (salen dos niñas). paisajes-de-Muniellos.jpg tampoco: es un recorte de una
#   foto de Wikimedia Commons (Bosque de Muniellos 06, de Javier Pérez), no una foto suya.
# - Turismo Asturias (ref/origen/portales/ta-*.jpg, 708 px, sin marca): pequeñas, a su tamaño como mucho.
# - Las de archive.org (archivo-*) son solo referencia: no salen de aquí.
# - Paisaje de Wikimedia Commons (scripts/commons.json: autor, licencia y página comprobados uno a uno).
# También img/og.jpg (1200×630, de la fachada).
import json, time, urllib.request
from pathlib import Path
from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
SAL = RAIZ / 'img/fotos'; SAL.mkdir(parents=True, exist_ok=True)
CACHE = RAIZ / 'ref/raw/commons-cache'; CACHE.mkdir(parents=True, exist_ok=True)
WEB = RAIZ / 'ref/origen/web'; POR = RAIZ / 'ref/origen/portales'
UA = 'maqueta-web-local/1.0 (prueba de maqueta sin publicar)'
PROHIBIDAS = {'20190526_162018-scaled.jpg', 'paisajes-de-Muniellos.jpg'}

SUYAS = {   # nombre: (fichero, anchos)
    'fachada': ('foto-web-scaled.jpg', [640, 1024, 1440, 1920]),
    'dormitorio-mecedora': ('Camin-de-Muniellos-dormitorio-scaled.jpg', [480, 800, 1280, 1920]),
    'terraza-valle': ('IMG_20210224_135019_1-scaled.jpg', [480, 800, 1280, 1920]),
    'dormitorio-madera': ('DORMTORIO-PORTADA-scaled.jpg', [480, 800, 1280, 1920]),
    'jardin': ('jardin-scaled.jpg', [480, 800, 1280, 1920]),
    'colmenar': ('Colmenar-El-tio-Angel-Miel-de-Asturias-scaled.jpeg', [480, 800, 1280, 1920]),
    'miel-tarro': ('Miel-El-tio-Angel-Miel-de-Asturias.jpeg', [480, 800, 1170]),
    'miel-puesto': ('El-Tio-Angel-Miel-de-Asturias.jpeg', [480, 800, 1078]),
    'apicultores': ('IMG_8582.jpg', [480, 800, 1170]),
}
PORTALES = {'salon-verde': 'ta-3.jpg', 'dormitorio-azul': 'ta-4.jpg', 'casa-nevada': 'ta-5.jpg'}
COMMONS = json.loads((RAIZ / 'scripts/commons.json').read_text(encoding='utf-8'))
lista = []

def guardar(nombre, im, anchos, origen, fuente):
    im = im.convert('RGB'); w0, h0 = im.size; hechos = []
    for w in sorted(set(min(a, w0) for a in anchos)):
        r = im if w == w0 else im.resize((w, round(h0 * w / w0)), Image.LANCZOS)
        r.save(SAL / f'{nombre}-{w}.webp', 'WEBP', quality=80, method=6)
        r.save(SAL / f'{nombre}-{w}.jpg', 'JPEG', quality=82, optimize=True, progressive=True)
        hechos.append(w)
    lista.append({'nombre': nombre, 'ancho': max(hechos), 'alto': round(h0 * max(hechos) / w0), 'anchos': hechos, 'origen': origen, 'fuente': fuente})
    print(nombre.ljust(22), max(hechos), 'x', round(h0 * max(hechos) / w0), hechos)

for nombre, (f, anchos) in SUYAS.items():
    assert f not in PROHIBIDAS
    guardar(nombre, Image.open(WEB / f), anchos, 'Camín de Muniellos (su web)', f)
for nombre, f in PORTALES.items():
    guardar(nombre, Image.open(POR / f), [480, 708], 'Turismo Asturias (ficha del alojamiento), sin marca', f)
for c in COMMONS:
    f = CACHE / (c['nombre'] + '.jpg')
    if not f.exists():
        for intento in range(3):           # Commons limita las descargas seguidas (429): se espera y se prueba otra vez
            try:
                req = urllib.request.Request(c['miniatura'], headers={'User-Agent': UA})
                f.write_bytes(urllib.request.urlopen(req, timeout=90).read()); break
            except Exception as e:
                print('  espera', c['nombre'], e); time.sleep(25 * (intento + 1))
        time.sleep(6)
    guardar(c['nombre'], Image.open(f), [480, 800, 1280], 'Wikimedia Commons', c['pagina'])
(SAL / 'fotos.json').write_text(json.dumps(lista, ensure_ascii=False, indent=1), encoding='utf-8')
vivos = {f'{d["nombre"]}-{w}.{e}' for d in lista for w in d['anchos'] for e in ('webp', 'jpg')} | {'fotos.json'}
for p in SAL.iterdir():
    if p.name not in vivos:
        p.unlink(); print('  fuera', p.name)
# og:image: la fachada, 1200×630
im = Image.open(WEB / 'foto-web-scaled.jpg').convert('RGB')
w, h = im.size; alto = round(w * 630 / 1200); y = round(h * 0.30)
im.crop((0, y, w, y + alto)).resize((1200, 630), Image.LANCZOS).save(RAIZ / 'img/og.jpg', 'JPEG', quality=84, optimize=True)
print('→ img/fotos/fotos.json, img/og.jpg')
