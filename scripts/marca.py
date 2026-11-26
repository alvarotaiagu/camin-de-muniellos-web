# Marca pequeña (cabecera y favicons): el roble del logo reducido a lo que se lee a 16 px: copa festoneada, tronco de tres
# líneas que se abre en raíces y la línea de suelo. No sustituye al logo: es su versión de icono.
#   python -I -X utf8 scripts/marca.py   → partes/marca.svg, marca/favicon.svg, marca/*.png, manifest.json
import json, math
from pathlib import Path
from PIL import Image, ImageDraw

RAIZ = Path(__file__).resolve().parent.parent
(RAIZ / 'marca').mkdir(exist_ok=True)
OCRE = '#CE6B0F'; FONDO = '#F5F6F2'
f1 = lambda v: ('%.2f' % v).rstrip('0').rstrip('.')

def copa(cx, cy, r, n=9, hondo=0.16, pasos=72):
    return [(cx + math.cos(2 * math.pi * k / pasos) * r * (1 - hondo * (0.5 + 0.5 * math.cos(n * 2 * math.pi * k / pasos))),
             cy + math.sin(2 * math.pi * k / pasos) * r * (1 - hondo * (0.5 + 0.5 * math.cos(n * 2 * math.pi * k / pasos)))) for k in range(pasos)]
C = copa(16, 11.6, 9.6)
d_copa = 'M' + 'L'.join(f'{f1(x)} {f1(y)}' for x, y in C) + 'Z'
# tronco: tres líneas que suben de las raíces y se abren dentro de la copa
TRONCO = ['M12.2 27.2C14.6 26.6 15.2 24 15.2 20.5C15.2 17 13.8 14.6 11.6 12.6', 'M16 27.2V9.4', 'M19.8 27.2C17.4 26.6 16.8 24 16.8 20.5C16.8 17 18.2 14.6 20.4 12.6']
SUELO = 'M2.5 27.6C8 26.6 12 27.4 16 27.2C20 27 24 26.6 29.5 27.6'
dibujo = f'<path d="{d_copa}"/><path d="{"".join(TRONCO)}"/><path d="{SUELO}"/>'
(RAIZ / 'partes/marca.svg').write_text(f'<svg class="marca__dibujo" viewBox="0 0 32 32" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">{dibujo}</svg>\n', encoding='utf-8')
(RAIZ / 'marca/favicon.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="{FONDO}"/><g fill="none" stroke="{OCRE}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">{dibujo}</g></svg>\n', encoding='utf-8')

def png(lado, f, margen=0.0):
    E = 4; n = lado * E
    im = Image.new('RGB', (n, n), FONDO); dr = ImageDraw.Draw(im)
    k = n * (1 - 2 * margen) / 32; o = n * margen
    T = lambda p: (o + p[0] * k, o + p[1] * k)
    w = max(2, round(1.7 * k))
    dr.line([T(p) for p in C + [C[0]]], fill=OCRE, width=w, joint='curve')
    def bez(p0, p1, p2, p3, m=20):
        return [((1 - t) ** 3 * p0[0] + 3 * (1 - t) ** 2 * t * p1[0] + 3 * (1 - t) * t * t * p2[0] + t ** 3 * p3[0], (1 - t) ** 3 * p0[1] + 3 * (1 - t) ** 2 * t * p1[1] + 3 * (1 - t) * t * t * p2[1] + t ** 3 * p3[1]) for t in [i / m for i in range(m + 1)]]
    for s in (-1, 1):
        a = bez((16 + s * 3.8, 27.2), (16 + s * 1.4, 26.6), (16 + s * 0.8, 24), (16 + s * 0.8, 20.5)) + bez((16 + s * 0.8, 20.5), (16 + s * 0.8, 17), (16 + s * 2.2, 14.6), (16 + s * 4.4, 12.6))[1:]
        dr.line([T(p) for p in a], fill=OCRE, width=w, joint='curve')
    dr.line([T((16, 27.2)), T((16, 9.4))], fill=OCRE, width=w)
    g = bez((2.5, 27.6), (8, 26.6), (12, 27.4), (16, 27.2)) + bez((16, 27.2), (20, 27), (24, 26.6), (29.5, 27.6))[1:]
    dr.line([T(p) for p in g], fill=OCRE, width=w, joint='curve')
    im.resize((lado, lado), Image.LANCZOS).save(RAIZ / 'marca' / f)
png(32, 'favicon-32.png'); png(180, 'apple-touch-icon.png', 0.12); png(512, 'icono-512.png', 0.14)
(RAIZ / 'manifest.json').write_text(json.dumps({'name': 'Camín de Muniellos · Apartamentos rurales', 'short_name': 'Camín de Muniellos', 'lang': 'es', 'start_url': './', 'display': 'browser', 'background_color': FONDO, 'theme_color': FONDO,
    'icons': [{'src': 'marca/icono-512.png', 'sizes': '512x512', 'type': 'image/png'}, {'src': 'marca/apple-touch-icon.png', 'sizes': '180x180', 'type': 'image/png'}]}, ensure_ascii=False, indent=1), encoding='utf-8')
print('→ partes/marca.svg, marca/, manifest.json')
