# Letras AUTOALOJADAS (encargo: «con licencia libre, autoalojada»). Baja de Google Fonts los woff2 de los subconjuntos
# latin y latin-ext (los topónimos asturianos llevan ḷ) y escribe css/fuentes.css. Las cuatro son SIL Open Font License.
#   python -I -X utf8 scripts/fuentes.py
# - Readex Pro (titulares, fina), Inclusive Sans (texto), Signika (cifras y mojones: es una letra de señalización) y
#   Shadows Into Light Two (la manuscrita del logo: «apartamentos rurales» y el libro de visitas).
# También baja el TTF de Shadows Into Light Two a ref/raw/fuentes/ para que scripts/roble.py convierta el nombre del logo
# en trazados, y comprueba que las cuatro tienen €, ñ, tildes, ¡ ¿ y « ».
import re, sys, time, urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
DEST = RAIZ / 'fuentes'
DEST.mkdir(exist_ok=True)
RAW = RAIZ / 'ref/raw/fuentes'
RAW.mkdir(parents=True, exist_ok=True)
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
FAMILIAS = [
    ('Readex Pro', 'family=Readex+Pro:wght@160..700', 'readex-pro'),
    ('Inclusive Sans', 'family=Inclusive+Sans:ital,wght@0,300..700;1,300..700', 'inclusive-sans'),
    ('Signika', 'family=Signika:wght@300..700', 'signika'),
    ('Shadows Into Light Two', 'family=Shadows+Into+Light+Two', 'shadows-into-light-two'),
]
TTF = {'ShadowsIntoLightTwo-Regular.ttf': 'https://raw.githubusercontent.com/google/fonts/main/ofl/shadowsintolighttwo/ShadowsIntoLightTwo-Regular.ttf'}


def pedir(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


css = ['/* Letras autoalojadas (scripts/fuentes.py). SIL Open Font License 1.1: Readex Pro, Inclusive Sans, Signika y\n   Shadows Into Light Two. Subconjuntos latin y latin-ext de Google Fonts. */']
for nombre, consulta, corto in FAMILIAS:
    hoja = pedir('https://fonts.googleapis.com/css2?' + consulta + '&display=swap').decode('utf-8')
    n = 0
    for sub, bloque in re.findall(r'/\* ([a-z-]+) \*/\s*(@font-face \{.*?\})', hoja, re.S):
        if sub not in ('latin', 'latin-ext'):
            continue
        url = re.search(r'url\((https://[^)]+\.woff2)\)', bloque).group(1)
        estilo = re.search(r'font-style: (\w+)', bloque).group(1)
        peso = re.search(r'font-weight: ([\d ]+)', bloque).group(1).strip()
        rango = re.search(r'unicode-range: ([^;]+);', bloque).group(1)
        f = f'{corto}-{sub}{"-cursiva" if estilo == "italic" else ""}.woff2'
        if not (DEST / f).exists():
            (DEST / f).write_bytes(pedir(url)); time.sleep(0.4)
        css.append(f'@font-face {{ font-family: "{nombre}"; font-style: {estilo}; font-weight: {peso}; font-display: swap; src: url(../fuentes/{f}) format("woff2"); unicode-range: {rango}; }}')
        n += 1
    print(nombre, n, 'ficheros')
# letras de reserva con las mismas proporciones (evita el salto al cargar)
css.append('@font-face { font-family: "Readex reserva"; src: local("Arial"); size-adjust: 112%; ascent-override: 92%; descent-override: 24%; line-gap-override: 0%; }')
css.append('@font-face { font-family: "Inclusive reserva"; src: local("Arial"); size-adjust: 101%; ascent-override: 95%; descent-override: 25%; line-gap-override: 0%; }')
(RAIZ / 'css').mkdir(exist_ok=True)
(RAIZ / 'css/fuentes.css').write_text('\n'.join(css) + '\n', encoding='utf-8')
for f, url in TTF.items():
    if not (RAW / f).exists():
        (RAW / f).write_bytes(pedir(url))

# glifos que hacen falta en castellano
from fontTools.ttLib import TTFont
NECESARIOS = '€ñÑáéíóúüÁÉÍÓÚ¡¿«»º·’'
for f in sorted(DEST.glob('*-latin.woff2')) + sorted(DEST.glob('*-latin-cursiva.woff2')):
    try:
        cmap = TTFont(f).getBestCmap()
    except Exception as e:
        print(' ', f.name, 'no se puede abrir (¿falta brotli?):', e); continue
    faltan = [c for c in NECESARIOS if ord(c) not in cmap]
    print(' ', f.name, f.stat().st_size // 1024, 'KB', 'faltan: ' + ' '.join(faltan) if faltan else 'glifos bien')
print('→ css/fuentes.css, fuentes/*.woff2')
