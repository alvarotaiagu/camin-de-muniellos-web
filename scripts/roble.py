# El roble del logo, REDIBUJADO en vector (el original solo existe a 300 px: ref/origen/marca/logo-300.png).
# No se calca ni se amplía: se vuelve a dibujar con las mismas decisiones del logo: copa de hojas de roble lobuladas a
# línea, tronco de varias líneas que se abren en ramas arriba y en raíces abajo, línea de suelo que se afina hacia los
# lados, «CAMIN de» rodeando la copa por arriba y «MUNIELLOS» por abajo, y «apartamentos rurales» manuscrito.
#   python -I -X utf8 scripts/roble.py [carpeta-para-la-prueba.png]
# Salida: partes/roble.svg (dibujo en línea para la portada, el pie y el 404) y data/roble.json (cuántas hojas y su orden
# de caída, para js/roble.js). Todo sale de una semilla fija: el dibujo es siempre el mismo.
# El nombre va en TRAZADOS (no depende de que cargue la letra): Shadows Into Light Two (SIL OFL), la manuscrita de línea
# fina que más se parece a la del logo. Como en el logo, «CAMIN» va sin tilde.
import json, math, random, sys
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.recordingPen import DecomposingRecordingPen

RAIZ = Path(__file__).resolve().parent.parent
rnd = random.Random(2008)          # 2008: el año en que se restauró la casa
CX, CY, R = 500.0, 410.0, 255.0    # centro y radio de la copa
SUELO = 900.0                      # la línea de suelo
f1 = lambda v: ('%.1f' % v).rstrip('0').rstrip('.')


def suave(pts, cerrado=False):
    """Catmull-Rom → béziers cúbicas (trazado SVG)."""
    n = len(pts)
    if n < 3:
        return 'M' + 'L'.join(f'{f1(x)} {f1(y)}' for x, y in pts)
    g = (lambda i: pts[i % n]) if cerrado else (lambda i: pts[max(0, min(n - 1, i))])
    d = f'M{f1(pts[0][0])} {f1(pts[0][1])}'
    for i in range(n if cerrado else n - 1):
        p0, p1, p2, p3 = g(i - 1), g(i), g(i + 1), g(i + 2)
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d += f'C{f1(c1[0])} {f1(c1[1])} {f1(c2[0])} {f1(c2[1])} {f1(p2[0])} {f1(p2[1])}'
    return d + ('Z' if cerrado else '')


# ---------------------------------------------------------------- la hoja de roble (base en 0,0; punta hacia −y; largo 100)
def hoja(lobulos, ancho, fase, hondo):
    lado = {}
    for s in (1, -1):
        pts = []
        N = 44
        for k in range(N + 1):
            t = k / N
            env = math.sin(math.pi * t ** 0.82) ** 0.85 * (0.50 + 0.62 * t)      # obovada: más ancha arriba
            ond = 0.5 + 0.5 * math.cos(2 * math.pi * (lobulos * t + fase + (0.08 if s < 0 else 0)))
            w = ancho * env * (1 - hondo * (1 - ond) ** 1.5 * min(1, 4 * t) * min(1, 9 * (1 - t)))
            pts.append((s * (w + 0.9 * min(1, t * 14)), -100 * t))
        lado[s] = pts
    contorno = lado[1] + lado[-1][::-1][1:-1]
    # cada 2 puntos basta para el trazado suave
    c = [contorno[i] for i in range(0, len(contorno), 2)]
    venas = []
    for j in range(lobulos):
        t = (j + 0.5 - fase) / lobulos
        if not 0.14 < t < 0.9:
            continue
        for s in (1, -1):
            tt = t - (0.08 / lobulos if s < 0 else 0)
            k = min(44, max(0, round(tt * 44)))
            x, y = lado[s][k]
            venas.append(f'M0 {f1(-100 * tt + 9)}Q{f1(x * 0.45)} {f1(y + 5)} {f1(x * 0.72)} {f1(y - 1)}')
    return suave(c, True), 'M0 9L0 -92' + ''.join(venas)


HOJAS = [hoja(4, 30, 0.10, 0.50), hoja(5, 27, 0.32, 0.46), hoja(4, 33, 0.38, 0.54), hoja(3, 24, 0.20, 0.42)]

# ---------------------------------------------------------------- tronco, ramas y raíces
def bez(p0, p1, p2, p3, n=14):
    out = []
    for k in range(n + 1):
        t = k / n; u = 1 - t
        out.append((u ** 3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t ** 3 * p3[0],
                    u ** 3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t ** 3 * p3[1]))
    return out


ramas = []      # (nivel, [puntos])
puntas = []     # (x, y, ángulo de salida, nivel)
BASE_COPA = CY + R * 0.80
# siete hebras: cada una sale de una raíz, sube por el tronco y se abre en su rama
HEBRAS = [(-3, -152), (-2, -124), (-1, -103), (0, -89), (1, -74), (2, -52), (3, -26)]
for i, ang in HEBRAS:
    x0 = CX + i * 7.5
    raiz_x = CX + i * 30 + (18 * (1 if i > 0 else -1) if i else 0)
    a = math.radians(ang + rnd.uniform(-4, 4))
    largo = R * (0.82 + 0.30 * abs(math.sin(a)) + rnd.uniform(-0.05, 0.06)) * (1.0 if abs(i) < 3 else 0.86)
    fin = (CX + math.cos(a) * largo * 1.06, BASE_COPA - 40 + math.sin(a) * largo)
    raiz = bez((raiz_x + (26 if i > 0 else -26 if i < 0 else 0), SUELO + 1), (raiz_x - i * 9, SUELO - 6), (x0 + i * 1.5, SUELO - 58), (x0, SUELO - 120), 8)
    sube = [(x0 - i * 0.8 + math.sin(k * 1.7 + i) * 1.4, SUELO - 120 - (SUELO - 120 - BASE_COPA) * k / 5) for k in range(1, 6)]
    c1 = (x0 - i * 1.5 + (16 if i == 0 else 0), BASE_COPA - largo * 0.34)
    c2 = (fin[0] - math.cos(a) * largo * 0.42 + rnd.uniform(-14, 14), fin[1] - math.sin(a) * largo * 0.30 + rnd.uniform(4, 20))
    rama = bez(sube[-1], c1, c2, fin, 16)
    ramas.append((0, raiz[:-1] + sube[:-1] + rama))
    # brotes laterales (dos niveles)
    def brotar(pts, nivel, cuantos, lmin, lmax):
        n = len(pts)
        for q in range(cuantos):
            k = int(n * (0.38 + 0.56 * (q + rnd.random() * 0.7) / cuantos))
            k = min(n - 2, max(2, k))
            px, py = pts[k]
            dx, dy = pts[k + 1][0] - pts[k - 1][0], pts[k + 1][1] - pts[k - 1][1]
            base = math.atan2(dy, dx)
            lado = 1 if (q + i + nivel) % 2 else -1
            b = base + lado * math.radians(rnd.uniform(28, 58))
            if math.sin(b) > 0.35:            # nada de ramas que caigan hacia el suelo
                b = base - lado * math.radians(rnd.uniform(28, 50))
            L = rnd.uniform(lmin, lmax)
            fin2 = (px + math.cos(b) * L, py + math.sin(b) * L)
            # dentro de la copa
            d = math.hypot(fin2[0] - CX, (fin2[1] - CY) * 1.04)
            if d > R * 0.98:
                e = R * 0.98 / d
                fin2 = (CX + (fin2[0] - CX) * e, CY + (fin2[1] - CY) * e)
            m = ((px + fin2[0]) / 2 + math.cos(base) * L * 0.16, (py + fin2[1]) / 2 + math.sin(base) * L * 0.16 - 5)
            hijo = bez((px, py), ((px + m[0]) / 2, (py + m[1]) / 2), m, fin2, 8)
            ramas.append((nivel, hijo))
            puntas.append((fin2[0], fin2[1], math.atan2(fin2[1] - m[1], fin2[0] - m[0]), nivel))
            if nivel == 1:
                brotar(hijo, 2, 2, 34, 62)
    brotar(rama, 1, 3, 70, 128)
    puntas.append((fin[0], fin[1], a, 0))

# ---------------------------------------------------------------- hojas: en las puntas y a lo largo de las ramas finas
hojas = []      # (x, y, giro°, escala, forma)
def poner(x, y, ang, esc):
    px, py = x + math.cos(ang) * 100 * esc, y + math.sin(ang) * 100 * esc      # la punta de la hoja
    if math.hypot(px - CX, py - CY) > R * 1.09 or math.hypot(x - CX, y - CY) > R or max(y, py) > BASE_COPA + 30:
        return
    hojas.append([x, y, math.degrees(ang) + 90, esc, rnd.randrange(len(HOJAS))])

for x, y, a, nivel in puntas:
    poner(x - math.cos(a) * 30, y - math.sin(a) * 30, a + rnd.uniform(-0.25, 0.25), rnd.uniform(1.15, 1.5) if nivel < 2 else rnd.uniform(0.9, 1.2))
    for s in (-1, 1):
        if rnd.random() < 0.5:
            poner(x - math.cos(a) * rnd.uniform(30, 50), y - math.sin(a) * rnd.uniform(30, 50), a + s * rnd.uniform(0.75, 1.35), rnd.uniform(0.75, 1.1))
for nivel, pts in ramas:
    if nivel == 0:
        continue
    for k in range(3, len(pts) - 1, 3):
        if rnd.random() < 0.22:
            dx, dy = pts[k + 1][0] - pts[k - 1][0], pts[k + 1][1] - pts[k - 1][1]
            poner(pts[k][0], pts[k][1], math.atan2(dy, dx) + rnd.choice((-1, 1)) * rnd.uniform(0.8, 1.4), rnd.uniform(0.7, 1.0))
# huecos de la copa: se rellenan con hojas sueltas que salen del centro
def cubierta(x, y):
    return any(math.hypot(x - (h[0] + math.sin(math.radians(h[2])) * 50 * h[3]), y - (h[1] - math.cos(math.radians(h[2])) * 50 * h[3])) < 62 * h[3] for h in hojas)
for _ in range(500):
    a = rnd.uniform(0, 2 * math.pi); rr = R * math.sqrt(rnd.random()) * 0.9
    x, y = CX + math.cos(a) * rr, CY + math.sin(a) * rr * 0.96
    if y > BASE_COPA - 6 or cubierta(x, y):
        continue
    out = math.atan2(y - (CY + R * 0.35), x - CX)
    e = rnd.uniform(0.95, 1.4)
    poner(x - math.cos(out) * 50 * e, y - math.sin(out) * 50 * e, out + rnd.uniform(-0.5, 0.5), e)
# de atrás adelante: primero las de dentro y arriba; las grandes de fuera, encima
hojas.sort(key=lambda h: (math.hypot(h[0] - CX, h[1] - CY) * 0.6 + h[1] * 0.5))
N = len(hojas)
# orden de caída (0 = la primera que cae): las de fuera y arriba antes; al brotar, al revés
orden = sorted(range(N), key=lambda i: -(math.hypot(hojas[i][0] - CX, hojas[i][1] - CY) + rnd.uniform(-70, 70)))
caida = [0] * N
for puesto, i in enumerate(orden):
    caida[i] = puesto

# ---------------------------------------------------------------- la línea de suelo (se afina hacia los lados) y las hojas caídas
def suelo_y(x):
    return SUELO + 5.5 * math.sin((x - CX) / 210.0) * math.exp(-abs(x - CX) / 900.0) - 9 * math.exp(-((x - CX) / 150.0) ** 2)
izq, der = -260.0, 1260.0
xs = [izq + (der - izq) * k / 40 for k in range(41)]
gros = lambda x: 0.8 + 3.6 * math.exp(-((x - CX) / 430.0) ** 2)
arriba = [(x, suelo_y(x) - gros(x) / 2) for x in xs]
abajo = [(x, suelo_y(x) + gros(x) / 2) for x in xs][::-1]
d_suelo = suave(arriba) + 'L' + suave(abajo)[1:] + 'Z'
caidas = []
for k in range(11):
    x = CX + rnd.choice((-1, 1)) * rnd.uniform(60, 330)
    caidas.append((x, suelo_y(x) - 3, rnd.choice((78, 96, 104, -82, -98, 88)) + rnd.uniform(-10, 10), rnd.uniform(0.42, 0.6), rnd.randrange(len(HOJAS))))

# ---------------------------------------------------------------- el nombre, en trazados, alrededor de la copa
fuente = TTFont(RAIZ / 'ref/raw/fuentes/ShadowsIntoLightTwo-Regular.ttf')
gs = fuente.getGlyphSet(); cmap = fuente.getBestCmap(); UPM = fuente['head'].unitsPerEm
def glifo(ch):
    nombre = cmap[ord(ch)]
    pen = DecomposingRecordingPen(gs); gs[nombre].draw(pen)
    return pen.value, gs[nombre].width

def texto_recto(txt, x, y, tam, espacio=0.0):
    k = tam / UPM; d = ''; polis = []
    for ch in txt:
        ops, ancho = glifo(ch)
        T = lambda p: (x + p[0] * k, y - p[1] * k)
        d += ops_a_d(ops, T, polis)
        x += ancho * k + espacio
    return d, x, polis

def ops_a_d(ops, T, polis):
    d = ''; act = []
    for op, args in ops:
        if op == 'moveTo':
            p = T(args[0]); d += f'M{f1(p[0])} {f1(p[1])}'; act = [p]
        elif op == 'lineTo':
            p = T(args[0]); d += f'L{f1(p[0])} {f1(p[1])}'; act.append(p)
        elif op == 'qCurveTo':
            pts = [T(a) for a in args if a is not None]
            # TrueType: puntos de control seguidos llevan un punto implícito en medio
            for j in range(len(pts) - 1):
                c = pts[j]
                fin = pts[j + 1] if j == len(pts) - 2 else ((pts[j][0] + pts[j + 1][0]) / 2, (pts[j][1] + pts[j + 1][1]) / 2)
                d += f'Q{f1(c[0])} {f1(c[1])} {f1(fin[0])} {f1(fin[1])}'; act.append(c); act.append(fin)
        elif op == 'curveTo':
            p1, p2, p3 = [T(a) for a in args]
            d += f'C{f1(p1[0])} {f1(p1[1])} {f1(p2[0])} {f1(p2[1])} {f1(p3[0])} {f1(p3[1])}'; act += [p1, p2, p3]
        elif op in ('closePath', 'endPath'):
            d += 'Z'
            if act: polis.append(act); act = []
    return d

def texto_arco(tramos, radio, a_ini, a_fin, por_dentro):
    """tramos: [(texto, tamaño)]. Reparte las letras entre los dos ángulos (grados; y hacia abajo).
       por_dentro=False: letras de pie sobre el círculo, cabeza hacia fuera (arriba de la copa).
       por_dentro=True: línea de base en el círculo, cabeza hacia el centro (abajo de la copa)."""
    letras = []
    for txt, tam in tramos:
        for ch in txt:
            ops, ancho = glifo(ch)
            letras.append((ops, ancho * tam / UPM, tam, ch))
    total = sum(l[1] for l in letras)
    arco = abs(math.radians(a_fin - a_ini)) * radio
    extra = (arco - total) / (len(letras) - 1)
    sentido = 1 if a_fin > a_ini else -1
    d = ''; polis = []; s = 0.0
    for ops, ancho, tam, ch in letras:
        medio = s + ancho / 2
        a = math.radians(a_ini) + sentido * medio / radio
        px, py = CX + math.cos(a) * radio, CY + math.sin(a) * radio
        giro = a + (math.pi / 2 if not por_dentro else -math.pi / 2)
        k = tam / UPM; co, si = math.cos(giro), math.sin(giro)
        def T(p, k=k, co=co, si=si, px=px, py=py, ancho=ancho):
            gx, gy = p[0] * k - ancho / 2, -p[1] * k
            return (px + gx * co - gy * si, py + gx * si + gy * co)
        if ch != ' ':
            d += ops_a_d(ops, T, polis)
        s += ancho + extra
    return d, polis

T_ARRIBA = 92
d_arriba, pol1 = texto_arco([('CAMIN', T_ARRIBA), (' ', T_ARRIBA * 0.6), ('de', T_ARRIBA * 0.92)], R * 1.19, -141, -33, False)
d_abajo, pol2 = texto_arco([('MUNIELLOS', T_ARRIBA * 1.04)], R * 1.19 + T_ARRIBA * 0.70, 157, 20, True)
d_lema, fin_x, pol3 = texto_recto('apartamentos  rurales', 0, 0, 62, 4.5)
d_lema, _, pol3 = texto_recto('apartamentos  rurales', CX - fin_x / 2, SUELO + 72, 62, 4.5)

# ---------------------------------------------------------------- SVG
G = {0: [], 1: [], 2: []}
for nivel, pts in ramas:
    G[nivel].append(suave(pts))
svg = []
svg.append(f'<svg class="roble" viewBox="120 40 760 960" data-hojas="{N}" aria-hidden="true" focusable="false">')
svg.append('<defs>')
for i, (cont, ven) in enumerate(HOJAS):
    svg.append(f'<g id="hoja-{i}"><path class="hoja__c" d="{cont}"/><path class="hoja__v" d="{ven}"/></g>')
svg.append('</defs>')
svg.append(f'<path class="roble__suelo" d="{d_suelo}"/>')
svg.append('<g class="roble__arbol" id="roble-arbol">')
svg.append(f'<path class="roble__rama roble__rama--2" d="{"".join(G[2])}"/>')
svg.append(f'<path class="roble__rama roble__rama--1" d="{"".join(G[1])}"/>')
svg.append(f'<path class="roble__rama roble__rama--0" d="{"".join(G[0])}"/>')
svg.append('<g class="roble__caidas">')
for i, (x, y, g, e, fo) in enumerate(caidas):
    svg.append(f'<g transform="translate({f1(x)} {f1(y)}) rotate({f1(g)}) scale({e:.2f})"><use class="caida" data-i="{i}" href="#hoja-{fo}"/></g>')
svg.append('</g>')
svg.append('<g class="roble__hojas">')
for i, (x, y, g, e, fo) in enumerate(hojas):
    svg.append(f'<g transform="translate({f1(x)} {f1(y)}) rotate({f1(g)}) scale({e:.2f})"><use class="hoja" data-c="{caida[i]}" href="#hoja-{fo}"/></g>')
svg.append('</g></g>')
svg.append(f'<g class="roble__nombre"><path d="{d_arriba}"/><path d="{d_abajo}"/></g>')
svg.append(f'<path class="roble__lema" d="{d_lema}"/>')
svg.append('</svg>')
(RAIZ / 'partes').mkdir(exist_ok=True)
(RAIZ / 'partes/roble.svg').write_text('\n'.join(svg) + '\n', encoding='utf-8')
(RAIZ / 'data').mkdir(exist_ok=True)
(RAIZ / 'data/roble.json').write_text(json.dumps({'hojas': N, 'caidas': len(caidas), 'suelo': SUELO, 'centro': [CX, CY], 'radio': R, 'vista': [120, 40, 760, 960]}), encoding='utf-8')
print('hojas', N, '· ramas', len(ramas), '· partes/roble.svg', (RAIZ / 'partes/roble.svg').stat().st_size // 1024, 'KB')

# ---------------------------------------------------------------- prueba (PNG con PIL, sin navegador) para mirar el dibujo
if len(sys.argv) > 1:
    from PIL import Image, ImageDraw
    import re
    def puntos_de(d):
        """Aplana un trazado M/L/C/Q/Z a polilíneas."""
        out = []; act = []; nums = re.findall(r'[MLCQZ]|-?\d+\.?\d*', d); i = 0; cur = (0, 0)
        while i < len(nums):
            c = nums[i]; i += 1
            if c == 'M' or c == 'L':
                if c == 'M' and act: out.append(act); act = []
                cur = (float(nums[i]), float(nums[i + 1])); i += 2; act.append(cur)
                while i < len(nums) and nums[i] not in 'MLCQZ':
                    cur = (float(nums[i]), float(nums[i + 1])); i += 2; act.append(cur)
            elif c == 'C':
                while i < len(nums) and nums[i] not in 'MLCQZ':
                    p = [float(v) for v in nums[i:i + 6]]; i += 6
                    act += bez(cur, (p[0], p[1]), (p[2], p[3]), (p[4], p[5]), 6)[1:]; cur = (p[4], p[5])
            elif c == 'Q':
                while i < len(nums) and nums[i] not in 'MLCQZ':
                    p = [float(v) for v in nums[i:i + 4]]; i += 4
                    c1 = (cur[0] + 2 / 3 * (p[0] - cur[0]), cur[1] + 2 / 3 * (p[1] - cur[1])); c2 = (p[2] + 2 / 3 * (p[0] - p[2]), p[3] + 2 / 3 * (p[1] - p[3]))
                    act += bez(cur, c1, c2, (p[2], p[3]), 5)[1:]; cur = (p[2], p[3])
            elif c == 'Z':
                if act: act.append(act[0]); out.append(act); act = []
        if act: out.append(act)
        return out
    def pintar(nombre, frac, color_hoja, sin_nombre=False):
        E = 2.0; W, H = int(1500 * E), int(1060 * E); ox, oy = 250 * E, 0
        im = Image.new('RGB', (W, H), (246, 247, 244)); dr = ImageDraw.Draw(im)
        MARCA = (206, 107, 15)
        tr = lambda p: (p[0] * E + ox, p[1] * E + oy)
        for pl in puntos_de(d_suelo): dr.polygon([tr(p) for p in pl], fill=MARCA)
        for nivel, w in ((2, 2.0), (1, 2.6), (0, 3.4)):
            for d in G[nivel]:
                for pl in puntos_de(d): dr.line([tr(p) for p in pl], fill=MARCA, width=round(w * E), joint='curve')
        for i, (x, y, g, e, fo) in enumerate(hojas):
            if caida[i] < (1 - frac) * N: continue
            co, si = math.cos(math.radians(g)), math.sin(math.radians(g))
            M = lambda p: tr((x + (p[0] * co - p[1] * si) * e, y + (p[0] * si + p[1] * co) * e))
            for pl in puntos_de(HOJAS[fo][0]): dr.polygon([M(p) for p in pl], fill=(246, 247, 244)); dr.line([M(p) for p in pl], fill=color_hoja, width=round(2.3 * E), joint='curve')
            for pl in puntos_de(HOJAS[fo][1]): dr.line([M(p) for p in pl], fill=color_hoja, width=round(1.4 * E))
        if not sin_nombre:
            for pols in (pol1, pol2, pol3):
                for pl in pols: dr.polygon([tr(p) for p in pl], fill=MARCA)
        im = im.resize((W // 2, H // 2), Image.LANCZOS)
        im.save(Path(sys.argv[1]) / nombre)
    pintar('roble-ocre.png', 1.0, (206, 107, 15))
    pintar('roble-desnudo.png', 0.0, (206, 107, 15))
    pintar('roble-medio.png', 0.45, (190, 120, 30))
    print('prueba en', sys.argv[1])
