/* Comprobación del módulo lugar de Camín de Muniellos (agente Lugar 3D). NO pinta el 3D.
   1. Node: las funciones puras de js/lugar.js (sol, interpolación, hitos, sombra del relieve) y el sol contra
      JPL Horizons (si la respuesta está en la caché de scripts/lugar-sol.mjs).
   2. Datos: data/lugar-camin.json (el contrato del ENCARGO), data/lugar-escena.json, img/lugar/ y pesos.
   3. Plan B en Chromium sin WebGL (--disable-3d-apis + navigator.webdriver): monta, el perfil con sus hitos y km,
      la regla, sin scroll horizontal, destruir(); y las cotas de la casa y de Tablizas leídas de los PNG de alturas.
   4. La escena 3D con Three.js de verdad y un WebGLRenderer FALSO que no pinta: monta, sin NaN, el contador de km y
      el hito por tramos, la cinta de la carretera, la sombra del relieve (de día, al atardecer, de noche), los
      shaders parcheados (texto, sin compilar), pausa fuera de pantalla, «Ver el perfil», destruir(), el móvil.
   Uso: node scripts/lugar-prueba.mjs                 (puerto 8982; un solo Chromium, 1280×800 y 390×844, escala 1)
        node scripts/lugar-prueba.mjs --sin-navegador (solo 1 y 2)
   Antes de lanzarlo, mirar que no haya otra prueba en marcha (CLAUDE.md de WEBS NEGOCIOS); si la hay, el script se
   niega (salvo --aunque-haya-otra). */
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargaLugar, validar } from './lugar-sol.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUERTO = 8982;
let fallos = 0, bien = 0;
const ok = (c, txt) => { if (c) { bien++; console.log('  ok  ', txt); } else { fallos++; console.log('  MAL ', txt); } };
const lee = (f) => fs.readFileSync(path.join(RAIZ, f), 'utf8');
const json = (f) => JSON.parse(lee(f));
const coma = (v, d = 1) => v.toFixed(d).replace('.', ',');

/* ---------- 1. funciones puras ---------- */
console.log('1. funciones puras de js/lugar.js');
const L = cargaLugar();
const CAMIN = json('data/lugar-camin.json'), ESC = json('data/lugar-escena.json');
ok(typeof L.montar === 'function' && typeof L.sol === 'function', 'Camin.lugar expone montar() y sol()');
const pj = L.sol(new Date('2026-06-21T12:25:00Z'), CAMIN.casa.lat, CAMIN.casa.lon);
ok(pj.altura > 69.8 && pj.altura < 70.6 && pj.azimut > 170 && pj.azimut < 190, `sol el 21-jun a mediodía solar: ${pj.altura.toFixed(2)}° al ${pj.azimut.toFixed(0)}° (90 − 43,15 + 23,44 = 70,29)`);
const pn = L.sol(new Date('2026-12-21T00:30:00Z'), CAMIN.casa.lat, CAMIN.casa.lon);
ok(pn.altura < -60, `de madrugada en diciembre el sol está a ${pn.altura.toFixed(0)}°`);
const hz = await validar(true);
if (hz) ok(hz.errAz < 0.05 && hz.errEl < 0.05 && hz.errRefr < 0.08, `sol contra JPL Horizons (${hz.n} instantes de 2026, observador en la casa): acimut ±${hz.errAz.toFixed(4)}°, altura ±${hz.errEl.toFixed(4)}°, con refracción ±${hz.errRefr.toFixed(4)}°`);
else console.log('  --   sol contra JPL Horizons: sin respuesta en la caché (lanzar node scripts/lugar-sol.mjs)');
ok(/suroeste|sur|oeste/.test(L.fraseCielo(new Date('2026-11-26T15:00:00Z'), CAMIN.casa.lat, CAMIN.casa.lon, true)) && /de noche/.test(L.fraseCielo(new Date('2026-11-26T22:00:00Z'), CAMIN.casa.lat, CAMIN.casa.lon, true)),
  'frase del cielo: «' + L.fraseCielo(new Date('2026-11-26T15:00:00Z'), CAMIN.casa.lat, CAMIN.casa.lon, true) + '» / «' + L.fraseCielo(new Date('2026-11-26T22:00:00Z'), CAMIN.casa.lat, CAMIN.casa.lon, false) + '»');
const mono = L.monotona([0, 1, 2, 3], [0, 10, 10, 30]);
ok(mono(0.5) > 0 && mono(0.5) < 10 && Math.abs(mono(1.5) - 10) < 1e-9 && mono(2.5) > 10 && mono(2.5) < 30, 'la interpolación del vuelo no se pasa de sus claves');
const he = L.hitoEn(CAMIN.hitos, 13.5), h0 = L.hitoEn(CAMIN.hitos, 0), hf = L.hitoEn(CAMIN.hitos, 99);
ok(he.actual.nombre === 'Ventanueva' && he.siguiente.nombre === 'Moal' && h0.actual.tipo === 'casa' && hf.actual.tipo === 'destino' && hf.siguiente === null, 'hitoEn(13,5) = Ventanueva → Moal; en 0, la casa; al final, Tablizas');
// la sombra del relieve con un relieve inventado: un muro de 300 m al este del punto
{
  const muro = (x) => (x > 400 && x < 500 ? 300 : 0), caja = { x0: -1000, z0: -1000, x1: 1000, z1: 1000 }, o = new Uint8Array(20 * 20 * 4);
  L.sombraRelieve(muro, caja, 20, 20, 90, 20, o, 0, 20, 330);
  const en = (x, z) => o[(Math.floor((z + 1000) / 100) * 20 + Math.floor((x + 1000) / 100)) * 4];
  const a = en(-200, 0), b = en(250, 0), c = en(700, 0);
  L.sombraRelieve(muro, caja, 20, 20, 90, 80, o, 0, 20, 330); const d = en(250, 0);
  L.sombraRelieve(muro, caja, 20, 20, 270, 20, o, 0, 20, 330); const e = en(250, 0), f = en(700, 0);
  L.sombraRelieve(muro, caja, 20, 20, 90, -5, o, 0, 20, 330); const g = en(-200, 0);
  ok(a === 0 && b === 0 && c === 255 && d === 255 && e === 255 && f === 0 && g === 0, `sombra del relieve (muro de 300 m): sol bajo al este → sombra al oeste del muro (${a}, ${b}) y luz al este (${c}); sol alto → luz (${d}); sol al oeste → al revés (${e}, ${f}); sol bajo el horizonte → todo oscuro (${g})`);
}

/* ---------- 2. datos ---------- */
console.log('2. datos');
const hav = (a, b) => { const R = Math.PI / 180, p1 = a[1] * R, p2 = b[1] * R, x = Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin((b[0] - a[0]) * R / 2) ** 2; return 2 * 6371008.8 * Math.asin(Math.sqrt(x)); };
const R_ = CAMIN.ruta;
ok(['casa', 'destino', 'kmTotal', 'minutos', 'ruta', 'hitos'].every((k) => k in CAMIN) && ['lat', 'lon', 'cota'].every((k) => typeof CAMIN.casa[k] === 'number') && ['nombre', 'lat', 'lon', 'cota'].every((k) => k in CAMIN.destino),
  'lugar-camin.json cumple el contrato: casa {lat, lon, cota}, destino {nombre, lat, lon, cota}, kmTotal, minutos, ruta, hitos');
ok(R_.length >= 400 && R_.length <= 800 && R_.every((p) => p.length === 4 && p.every(Number.isFinite)), `ruta: ${R_.length} puntos [lon, lat, cota, km]`);
let suma = 0, mono2 = true, saltoMax = 0;
for (let i = 1; i < R_.length; i++) { const d = hav(R_[i - 1], R_[i]); suma += d; saltoMax = Math.max(saltoMax, d); if (R_[i][3] <= R_[i - 1][3]) mono2 = false; }
const osrm = CAMIN.fuente.metrosOsrm;
ok(mono2 && R_[0][3] === 0 && Math.abs(R_[R_.length - 1][3] * 1000 - osrm) < 40, `km crecientes de 0 a ${R_[R_.length - 1][3]} (OSRM: ${(osrm / 1000).toFixed(3)} km)`);
ok(Math.abs(suma - osrm) / osrm < 0.004 && saltoMax < 135, `suma de la geometría adelgazada ${(suma / 1000).toFixed(3)} km frente a ${(osrm / 1000).toFixed(3)} km de OSRM (${((suma - osrm) / osrm * 100).toFixed(2)} %); tramo más largo ${saltoMax.toFixed(0)} m`);
ok(CAMIN.kmTotal === Math.round(osrm / 100) / 10 && CAMIN.minutos === Math.round(CAMIN.fuente.segundosOsrm / 60), `kmTotal ${CAMIN.kmTotal} y minutos ${CAMIN.minutos} son los de OSRM, redondeados`);
ok(hav(R_[0], [CAMIN.casa.lon, CAMIN.casa.lat]) < 25 && hav(R_[R_.length - 1], [CAMIN.destino.lon, CAMIN.destino.lat]) < 30, `la ruta empieza a ${hav(R_[0], [CAMIN.casa.lon, CAMIN.casa.lat]).toFixed(0)} m del centro de la casa y acaba a ${hav(R_[R_.length - 1], [CAMIN.destino.lon, CAMIN.destino.lat]).toFixed(0)} m del centro de recepción`);
const H_ = CAMIN.hitos;
ok(H_.length >= 8 && H_[0].tipo === 'casa' && H_[0].km === 0 && H_[H_.length - 1].tipo === 'destino' && H_.every((h, i) => !i || h.km > H_[i - 1].km) && H_.every((h) => h.nombre && ['casa', 'pueblo', 'cruce', 'rio', 'destino'].includes(h.tipo) && [h.km, h.lat, h.lon, h.cota].every(Number.isFinite)),
  `${H_.length} hitos en orden: ` + H_.map((h) => `${h.nombre} ${coma(h.km)}`).join(' · '));
ok(H_.slice(1).every((h) => /^(node|way)\/\d+$/.test(h.osm || '') || h.ref), 'cada hito lleva su fuente (elemento de OpenStreetMap o referencia de carretera)');
ok(H_.every((h) => { const c = L.lineal(R_.map((p) => p[3]), R_.map((p) => p[2]))(h.km); return h.tipo === 'casa' || h.tipo === 'destino' || Math.abs(c - h.cota) < 2; }), 'la cota de cada hito es la del perfil en su km');
ok(CAMIN.casa.cota > 480 && CAMIN.casa.cota < 510 && CAMIN.destino.cota > 650 && CAMIN.destino.cota < 690, `cotas: casa ${CAMIN.casa.cota} m, Tablizas ${CAMIN.destino.cota} m, mínimo ${CAMIN.cotaMin} m`);
const V_ = ESC.vuelo;
ok(V_[0].p === 0 && V_[V_.length - 1].p === 1 && V_.every((v, i) => !i || (v.p > V_[i - 1].p && v.km >= V_[i - 1].km)) && V_.every((v) => v.pos.concat(v.mira).every(Number.isFinite)), `vuelo: ${V_.length} claves de p = 0 a 1, km sin retroceder`);
ok(Math.abs(ESC.kmFinal - R_[R_.length - 1][3]) < 1e-6 && ESC.cinta.length > 1000 && ESC.hitos.length === H_.length && ESC.hitos.every((h, i) => h.km === H_[i].km && h.nombre === H_[i].nombre), 'la escena lleva los mismos hitos y km que lugar-camin.json');
// ficheros
const dir = path.join(RAIZ, 'img/lugar'), hay = new Set(fs.readdirSync(dir)), pide = new Set();
Object.values(ESC.rasters).forEach((r) => pide.add(r.archivo));
[ESC.orto.base.archivo, ESC.orto.lejos.archivo].forEach((a) => pide.add(a));
[ESC.orto.casa, ESC.orto.tablizas, ...ESC.orto.bloques.filter((b) => b.archivos)].forEach((o) => Object.values(o.archivos).forEach((a) => pide.add(a)));
ok([...pide].every((a) => hay.has(a)) && [...hay].every((a) => pide.has(a)), `img/lugar: ${hay.size} ficheros, todos usados y ninguno de más` + ([...hay].filter((a) => !pide.has(a)).length ? ' · SOBRAN ' + [...hay].filter((a) => !pide.has(a)).join(', ') : ''));
const dimPng = (f) => { const b = fs.readFileSync(path.join(dir, f)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
ok(Object.values(ESC.rasters).every((r) => { const d = dimPng(r.archivo); return d[0] === r.w && d[1] === r.h; }), 'tamaño de los PNG de alturas = el del JSON');
const kb = (fs_) => fs_.reduce((s, f) => s + fs.statSync(path.join(RAIZ, f)).size, 0) / 1048576;
const R3 = ESC.rasters, comun = ['data/lugar-camin.json', 'data/lugar-escena.json', 'vendor/three-0.160.0.module.min.js', 'img/lugar/' + R3.casa.archivo, 'img/lugar/' + R3.tablizas.archivo, 'img/lugar/' + R3.lejos.archivo, 'img/lugar/' + ESC.orto.base.archivo, 'img/lugar/' + ESC.orto.lejos.archivo];
const conBloques = (cal, valle) => comun.concat(['img/lugar/' + valle, 'img/lugar/' + ESC.orto.casa.archivos[cal], 'img/lugar/' + ESC.orto.tablizas.archivos[cal]], ESC.orto.bloques.filter((b) => b.archivos).map((b) => 'img/lugar/' + b.archivos[cal]));
const pAlta = kb(conBloques('alta', R3.valle.archivo)), pBaja = kb(conBloques('baja', R3.valle50.archivo)), pB = kb(['data/lugar-camin.json', 'data/lugar-escena.json']);
const pIni = kb(comun.concat(['img/lugar/' + R3.valle.archivo, 'img/lugar/' + ESC.orto.casa.archivos.alta]));
ok(pAlta < 6.5 && pBaja < 3.2 && pB < 0.12, `pesos: 3D escritorio ${pAlta.toFixed(2)} MB en total (${pIni.toFixed(2)} MB antes de enseñarse; el resto, según avanza), 3D móvil ${pBaja.toFixed(2)} MB, plan B ${(pB * 1024).toFixed(0)} KB · img/lugar ${(kb([...hay].map((a) => 'img/lugar/' + a))).toFixed(2)} MB`);

if (process.argv.includes('--sin-navegador')) { console.log(`\n${bien} bien, ${fallos} mal (sin navegador)`); process.exit(fallos ? 1 : 0); }

/* ---------- 3. plan B en el navegador, sin WebGL ---------- */
console.log('3. plan B en Chromium sin WebGL');
if (process.platform === 'win32' && !process.argv.includes('--aunque-haya-otra')) {
  const t = execSync('tasklist /FI "IMAGENAME eq chrome-headless-shell.exe" /NH', { encoding: 'utf8' });
  if (/chrome-headless-shell/i.test(t)) { console.log('  Hay otra prueba de Playwright en marcha (chrome-headless-shell.exe). Espera a que acabe y vuelve a lanzar.'); process.exit(2); }
}
const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
const { chromium } = require('playwright');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
const srv = http.createServer((req, res) => {
  const f = path.join(RAIZ, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TIPOS[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
await new Promise((z) => srv.listen(PUERTO, z));
const URLP = `http://localhost:${PUERTO}/scripts/lugar-prueba.html`;
const browser = await chromium.launch({ args: ['--disable-3d-apis', '--disable-webgl', '--disable-gpu'] });
const errDe = (page, lista) => {
  page.on('pageerror', (e) => lista.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && /Lugar/.test(m.text()))) lista.push(m.text()); });
  page.on('requestfailed', (q) => lista.push('falla ' + q.url()));
};
try {
  for (const [w, h] of [[1280, 800], [390, 844]]) {
    const ctxB = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    const page = await ctxB.newPage();
    const errores = []; errDe(page, errores);
    let pidioThree = false; page.on('request', (q) => { if (/three-0\.160/.test(q.url())) pidioThree = true; });
    await page.goto(URLP + '?hora=10:30&fecha=2026-11-26');
    await page.waitForFunction(() => document.querySelector('[data-modulo="lugar"]').dataset.montado === '1');
    await page.locator('#lugar').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelectorAll('.lugar__perfil-marco .lugar__mojon').length > 5 && document.querySelector('[data-l="lectura"]').textContent.length > 5, null, { timeout: 8000 });
    const r = await page.evaluate(() => {
      const el = document.querySelector('[data-modulo="lugar"]'), svg = el.querySelector('.lugar__perfil-marco svg'), b = svg.getBoundingClientRect();
      const visible = (n) => { const c = n.getBoundingClientRect(); return c.width > 0 && c.height > 0 && getComputedStyle(n).visibility !== 'hidden'; };
      return {
        modo: el.dataset.modo, pista: getComputedStyle(el.querySelector('.lugar__pista')).display !== 'none', lienzo: !!el.querySelector('canvas.lugar__lienzo'),
        mojones: [...el.querySelectorAll('.lugar__perfil-marco .lugar__mojon text')].map((t) => t.textContent), linea: el.querySelector('.lugar__perfil-linea').getTotalLength(),
        cifras: [...el.querySelectorAll('.lugar__cifras p')].map((p) => p.textContent), lista: [...el.querySelectorAll('.lugar__lista li b')].map((x) => x.textContent),
        lectura: el.querySelector('[data-l="lectura"]').textContent, pie: el.querySelector('[data-l="perfilPie"]').textContent, cielo: el.querySelector('[data-l="cielo2d"]').textContent,
        planta: el.querySelector('.lugar__planta-linea').getTotalLength() > 100 && visible(el.querySelector('.lugar__planta svg')), svgAncho: b.width, svgAlto: b.height, marcoAncho: el.querySelector('.lugar__perfil-marco').clientWidth,
        boton: !el.querySelector('[data-l="a3d"]').hidden, anchoDoc: document.documentElement.scrollWidth, anchoVista: innerWidth,
        fuente: el.querySelector('.lugar__fuente').textContent, texto: getComputedStyle(el.querySelector('.lugar__lectura')).color, fondo: getComputedStyle(document.querySelector('#lugar')).backgroundColor,
      };
    });
    console.log(`   ${w}×${h}`);
    ok(r.modo === 'plano' && !r.pista && !r.lienzo && !pidioThree, 'plan B, sin pista, sin lienzo y sin pedir Three.js (no se pinta WebGL)');
    ok(r.mojones.length === H_.length && r.mojones[0].startsWith('Camín de Muniellos') && r.mojones[r.mojones.length - 1].startsWith('Tablizas') && r.linea > 800, `el perfil lleva los ${r.mojones.length} hitos, de «${r.mojones[0]}» a «${r.mojones[r.mojones.length - 1]}»`);
    ok(r.cifras[0].startsWith(coma(CAMIN.kmTotal)) && r.cifras[1].startsWith(String(CAMIN.minutos)) && r.cifras[2].includes(CAMIN.casa.cota + ' → ' + CAMIN.destino.cota), 'cifras: ' + r.cifras.join(' | '));
    ok(r.lista.length === H_.length && r.lista.every((n, i) => n === H_[i].nombre) && r.planta, 'la lista de hitos en su orden y la planta de la carretera');
    ok(r.lectura.startsWith('km 0,0 · ' + CAMIN.casa.cota + ' m · en Camín de Muniellos') && /exageradas ×\d+/.test(r.pie), `lectura inicial: «${r.lectura}»; pie: «${r.pie.slice(0, 96)}…»`);
    ok(/^A las 10:30: el sol está al sureste/.test(r.cielo), 'el cielo de ?fecha=2026-11-26&hora=10:30: ' + r.cielo.slice(0, 70));
    ok(/Instituto Geográfico Nacional \(CC BY 4\.0\)/.test(r.fuente) && /OpenStreetMap/.test(r.fuente) && /Catastro/.test(r.fuente), 'créditos a la vista: IGN (CC BY 4.0), OpenStreetMap y Catastro');
    ok(!r.boton, 'sin botón 3D (navegador automatizado y movimiento reducido)');
    ok(r.anchoDoc <= r.anchoVista, `sin scroll horizontal de página (${r.anchoDoc} ≤ ${r.anchoVista}); el perfil mide ${Math.round(r.svgAncho)} px en un marco de ${r.marcoAncho}`);
    // la regla: km 13 es Ventanueva; km 17,5, pasado Moal
    const r2 = await page.evaluate(() => {
      const rg = document.querySelector('[data-l="regla"]'), lee = () => document.querySelector('[data-l="lectura"]').textContent;
      rg.value = '13'; rg.dispatchEvent(new Event('input', { bubbles: true })); const a = lee();
      rg.value = '17.5'; rg.dispatchEvent(new Event('input', { bubbles: true })); const b = lee();
      const act = document.querySelector('.lugar__lista li.es-actual b').textContent, cur = document.querySelector('.lugar__perfil-marco [data-l="cur"]').getAttribute('transform');
      document.querySelector('.lugar__lista li:nth-child(4) button').click();
      return { a, b, act, cur, c: lee(), max: rg.max, valor: rg.value };
    });
    ok(/^km 13,0 · 53\d m · en Ventanueva/.test(r2.a) && /^km 17,5 · \d+ m · pasado Moal, a 2,1 km de Tablizas/.test(r2.b) && r2.act === 'Moal' && /translate\(/.test(r2.cur), `la regla: «${r2.a}» · «${r2.b}»`);
    ok(r2.c.includes('en ' + H_[3].nombre) && Math.abs(+r2.valor - H_[3].km) < 0.06 && Math.abs(+r2.max - CAMIN.kmTotal) < 0.05, `pulsar un hito de la lista lleva la regla a su km: «${r2.c}»`);
    if (w === 1280) {
      // las cotas, leídas de los PNG de alturas que usa el 3D
      const co = await page.evaluate(async () => {
        const m = await (await fetch('../data/lugar-escena.json')).json();
        const dec = async (r) => {
          const b = await (await fetch('../img/lugar/' + r.archivo)).blob();
          const bmp = await createImageBitmap(b, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
          const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
          const g = c.getContext('2d'); g.drawImage(bmp, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data;
          return window.Camin.lugar.muestreador(Object.assign({}, r, { w: c.width, h: c.height, data: Float32Array.from({ length: c.width * c.height }, (_, i) => (d[i * 4] * 256 + d[i * 4 + 1]) / 10 - 100) }));
        };
        const v = await dec(m.rasters.valle), c = await dec(m.rasters.casa), t = await dec(m.rasters.tablizas), l = await dec(m.rasters.lejos);
        let peor = 0; m.hitos.forEach((h) => { peor = Math.max(peor, Math.abs(v(h.x, h.z) - h.cota)); });
        return { casa: c(m.casa.x, m.casa.z - 0), casaValle: v(0, 0), era: c(m.casa.x + 3, m.casa.z + 3), tab: t(m.destino.x, m.destino.z), tabValle: v(m.destino.x, m.destino.z), peor, borde: Math.abs(v(m.caja.x0 + 1, 5000) - l(m.caja.x0 + 1, 5000)), sueloDelante: m.casa.sueloDelante, cotaDest: m.destino.cota };
      });
      ok(Math.abs(co.casa - CAMIN.casa.cota) < 3 && Math.abs(co.casaValle - CAMIN.casa.cota) < 6 && Math.abs(co.era - co.sueloDelante) < 0.6, `la casa en los PNG: ${co.casa.toFixed(1)} m en la caja de detalle (la era aplanada a ${co.sueloDelante} m), ${co.casaValle.toFixed(1)} m en la rejilla de 25 m; JSON ${CAMIN.casa.cota} m`);
      ok(Math.abs(co.tab - CAMIN.destino.cota) < 2.5 && Math.abs(co.tabValle - CAMIN.destino.cota) < 8, `Tablizas en los PNG: ${co.tab.toFixed(1)} m (detalle) y ${co.tabValle.toFixed(1)} m (25 m); JSON ${CAMIN.destino.cota} m`);
      ok(co.peor < 14 && co.borde < 60, `los hitos caen sobre el relieve (peor diferencia con la rejilla de 25 m: ${co.peor.toFixed(1)} m); escalón valle/lejos en el borde: ${co.borde.toFixed(0)} m`);
      const rep = await page.evaluate(() => { window.__lugar.destruir(); const el = document.querySelector('[data-modulo="lugar"]'); return { resp: !!el.querySelector('.respaldo'), clase: el.classList.contains('lugar-mod'), modo: el.dataset.modo }; });
      ok(rep.resp && !rep.clase && rep.modo === undefined, 'destruir() repone el HTML de respaldo');
    }
    ok(errores.length === 0, 'sin errores en consola' + (errores.length ? ': ' + errores.join(' | ') : ''));
    await ctxB.close();
  }

  /* ---------- 4. la escena 3D se construye y se recorre, SIN WebGL ----------
     Three.js real, con un WebGLRenderer falso que no pinta (solo cuenta triángulos y mira que no haya NaN).
     Los shaders (GLSL) NO se compilan aquí: eso solo se ve en el Chrome de Álvaro. */
  console.log('4. escena 3D con renderizador falso (no pinta)');
  const ENVOLTORIO = `import * as T from '/vendor/three-0.160.0.module.min.js?real';
export * from '/vendor/three-0.160.0.module.min.js?real';
export class WebGLRenderer {
  constructor(o) { this.domElement = o.canvas; this.shadowMap = { enabled: false, type: 0, autoUpdate: true, needsUpdate: false };
    this.capabilities = { getMaxAnisotropy: () => 8 }; this.info = { render: { triangles: 0, calls: 0 } }; this._pr = 1; window.__pintadas = 0; }
  setPixelRatio(v) { this._pr = v; } getPixelRatio() { return this._pr; } setSize() {} compile() {}
  render(esc, cam) {
    window.__pintadas++; let tri = 0, calls = 0;
    esc.updateMatrixWorld();
    esc.traverse((o) => { if ((o.isMesh || o.isPoints || o.isSprite) && o.visible && o.geometry) { calls++; const g = o.geometry; let n = g.index ? g.index.count : g.attributes.position.count;
      if (g.drawRange && Number.isFinite(g.drawRange.count)) n = Math.min(n, g.drawRange.count); tri += n / 3 * (o.isInstancedMesh ? o.count : 1);
      for (const k of ['position', 'normal', 'uv']) { const pa = g.attributes[k] && g.attributes[k].array; if (pa && !window.__nan) { for (let i = 0; i < pa.length; i += 53) if (!Number.isFinite(pa[i])) { window.__nan = (o.name || o.type) + ' ' + k + ' ' + i; break; } } }
      if (g.index && !window.__nan) { const ia = g.index.array, np = g.attributes.position.count; for (let i = 0; i < ia.length; i += 31) if (!(ia[i] < np)) { window.__nan = (o.name || o.type) + ' índice fuera ' + i; break; } }
      if (o.isInstancedMesh && !window.__nan) { const a = o.instanceMatrix.array; for (let i = 0; i < o.count * 16; i += 13) if (!Number.isFinite(a[i])) { window.__nan = 'instancias ' + i; break; } } } });
    this.info.render.triangles = tri; this.info.render.calls = calls;
    if (![cam.position.x, cam.position.y, cam.position.z, cam.quaternion.x, cam.quaternion.w].every(Number.isFinite)) throw new Error('cámara con NaN');
    window.__cam = [cam.position.x, cam.position.y, cam.position.z, cam.near, cam.fov];
  }
  dispose() {} forceContextLoss() {}
}`;
  const fuerza3d = async (ctxB) => {
    await ctxB.route((u) => u.pathname.endsWith('/vendor/three-0.160.0.module.min.js') && !u.search.includes('real'),
      (q) => q.fulfill({ status: 200, contentType: 'text/javascript', body: ENVOLTORIO }));
  };
  const ctx3 = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
  await fuerza3d(ctx3);
  const page = await ctx3.newPage();
  const errores = []; errDe(page, errores);
  await page.goto(URLP + '?lugar=3d&hora=13:30&fecha=2026-06-21');
  await page.locator('#lugar').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => window.__lugar && window.__lugar.estado().t3 && window.__pintadas > 0 && window.__lugar.estado().cargado, null, { timeout: 60000 });
  const irP = async (pp) => {
    await page.evaluate((pp) => { const pista = document.querySelector('.lugar__pista'), e = document.querySelector('.lugar__escenario'); const y0 = pista.getBoundingClientRect().top + scrollY; scrollTo(0, y0 + pp * (pista.offsetHeight - e.offsetHeight)); }, pp);
    await page.waitForFunction((pp) => { const t = window.__lugar.estado().t3; return t && Math.abs(t.pVis - pp) < 0.0015; }, pp, { timeout: 20000 });
    await page.waitForTimeout(120);
  };
  await irP(0);
  const e0 = await page.evaluate(() => ({ est: window.__lugar.estado(), modo: document.querySelector('[data-modulo="lugar"]').dataset.modo, nan: window.__nan || null,
    listo: document.querySelector('.lugar__escenario').classList.contains('lugar--listo'), km: document.querySelector('[data-l="km"]').textContent, hito: document.querySelector('[data-l="hito"]').textContent,
    cielo: document.querySelector('[data-l="cielo3d"]').textContent, espera: getComputedStyle(document.querySelector('.lugar__espera')).opacity,
    rot: [...document.querySelectorAll('.lugar__rotulo.es-visible b')].map((b) => b.textContent), sticky: getComputedStyle(document.querySelector('.lugar__escenario')).position,
    pista: document.querySelector('.lugar__pista').offsetHeight / innerHeight, tira: document.querySelectorAll('.lugar__tira-hitos button').length }));
  ok(e0.modo === '3d' && e0.listo && e0.sticky === 'sticky' && e0.pista > 4, `modo 3D montado; el escenario se queda pegado en una pista de ${e0.pista.toFixed(1)} pantallas y se enseña al llegar las texturas y la sombra`);
  ok(!e0.nan, 'ninguna geometría, índice ni instancia con NaN o fuera de rango' + (e0.nan ? ': ' + e0.nan : ''));
  const t0 = e0.est.t3;
  console.log('       triángulos', Math.round(t0.triangulos), '· llamadas', t0.llamadas, '· piezas de la casa', t0.piezasCasa, '· balaustres', t0.balaustres, '· vecinos y Tablizas', t0.vecinos, '· bloques con ortofoto', t0.bloques);
  ok(t0.triangulos > 150000 && t0.triangulos < 900000 && t0.llamadas < 110, 'triángulos y llamadas de dibujo en un rango razonable');
  ok(t0.balaustres > 100 && t0.piezasCasa > 120 && t0.vecinos > 20, 'la casa lleva sus piezas (corredor con balaustres, buhardillas, hórreo, terraza) y los vecinos del Catastro');
  ok(e0.km === '0,0' && e0.hito === 'Camín de Muniellos' && e0.rot.includes('Camín de Muniellos') && e0.tira === H_.length, `p = 0: km ${e0.km}, «${e0.hito}», rótulos: ${e0.rot.join(' · ')}; la tira lleva ${e0.tira} hitos`);
  ok(t0.hCam > 4 && t0.hCam < 20 && t0.near < 2.1, `al empezar la cámara está delante de la casa, a ${t0.hCam.toFixed(1)} m del suelo (near ${t0.near.toFixed(2)})`);
  ok(/^A las 13:30: el sol está al (sureste|sur), a 6\d°/.test(e0.cielo) && t0.sombras >= 1 && t0.sombraMedia > 0.9, `21-jun 13:30: ${e0.cielo} Relieve al sol: ${(t0.sombraMedia * 100).toFixed(0)} %`);
  // los shaders de Lambert parcheados: el texto final, con los #include resueltos (no se compilan)
  const sh = await page.evaluate(() => window.__lugar._t3().shaders().map((s) => {
    const cuenta = (t, a, b) => t.split(a).length - t.split(b).length;
    return { clave: s.clave, uniformes: s.uniformes, inc: /#include/.test(s.v + s.f), llaves: cuenta(s.v, '{', '}') + cuenta(s.f, '{', '}'), parentesis: cuenta(s.v, '(', ')') + cuenta(s.f, '(', ')'),
      vMundoV: /varying vec3 vMundo;/.test(s.v) && /vMundo = \( modelMatrix \* mw_ \)\.xyz;/.test(s.v), relieve: /float factorRelieve = texture2D\( sRelieve, uvRelieve \)\.r;/.test(s.f) && /directLight\.color \*= factorRelieve;/.test(s.f),
      veces: s.f.split('directLight.color *= factorRelieve;').length - 1, cerca: /texelSuelo = mix\( texelSuelo, texelCerca, wCerca \);/.test(s.f), dup: (s.f.match(/uniform sampler2D sRelieve;/g) || []).length, largo: s.f.length };
  }));
  ok(sh.every((s) => !s.inc && s.llaves === 0 && s.parentesis === 0 && s.vMundoV && s.relieve && s.veces === 1 && s.dup === 1) && sh[0].cerca && !sh[1].cerca && sh[0].uniformes.includes('mapCerca') && sh.every((s) => s.uniformes.includes('sRelieve')),
    `shaders parcheados (${sh.map((s) => s.clave).join(', ')}): la sombra del relieve entra una vez en la luz direccional, el suelo funde la ortofoto de detalle, llaves y paréntesis cuadran (SIN compilar)`);
  // la cinta va apoyada en la malla, y la malla en el MDT
  const cin = await page.evaluate(async () => {
    const t = window.__lugar._t3(), m = await (await fetch('../data/lugar-escena.json')).json(); let peor = 0, bajo = 0;
    for (let i = 0; i < m.cinta.length; i += 3) { const c = m.cinta[i], d = t.alturaMalla(c[0], c[1]) - t.altura(c[0], c[1]); peor = Math.max(peor, Math.abs(d)); if (!Number.isFinite(d)) bajo++; }
    return { peor, bajo, vert: Math.abs(t.alturaMalla(-13000, 2000) - t.altura(-13000, 2000)), casa: t.altura(m.casa.x, m.casa.z) };
  });
  ok(cin.bajo === 0 && cin.peor < 8 && cin.vert < 1e-6, `la malla sigue al MDT bajo la carretera (peor diferencia ${cin.peor.toFixed(2)} m; la cinta va 2,2 m por encima de la malla)`);
  // el vuelo: km, hito y rótulos por tramos
  const tr = ESC.tramos, pDe = (km) => tr.sale + (tr.llega - tr.sale) * km / ESC.kmFinal;
  let hMin = 1e9, hMaxV = 0, andadoAnt = -1, creceAndado = true;
  for (const [km, hito, rot] of [[1.0, 'Cruce con la AS-15', 'La Regla'], [4.3, 'Cibuyo', 'El Cristu'], [8.7, 'Sasturrasu', null], [13.1, 'Ventanueva', 'Moal'], [16.5, 'Moal', null], [19.4, 'Moal', 'Tablizas']]) {
    await irP(pDe(km));
    const q = await page.evaluate(() => ({ km: document.querySelector('[data-l="km"]').textContent, hito: document.querySelector('[data-l="hito"]').textContent, sig: document.querySelector('[data-l="sig"]').textContent,
      rot: [...document.querySelectorAll('.lugar__rotulo.es-visible b')].map((b) => b.textContent), t: window.__lugar.estado().t3, cursor: document.querySelector('[data-l="cursor"]').style.left }));
    hMin = Math.min(hMin, q.t.hCam); hMaxV = Math.max(hMaxV, q.t.hCam); if (q.t.andado <= andadoAnt) creceAndado = false; andadoAnt = q.t.andado;
    const dMarca = Math.min(...ESC.cinta.filter((c) => Math.abs(c[2] - km) < 0.03).map((c) => Math.hypot(c[0] - q.t.marca[0], c[1] - q.t.marca[2])));
    ok(q.km === coma(km) && q.hito === hito && (!rot || q.rot.includes(rot)) && dMarca < 25 && Math.abs(parseFloat(q.cursor) - km / ESC.kmFinal * 100) < 0.2,
      `km ${q.km}: «${q.hito}» · ${q.sig} · rótulos: ${q.rot.join(' · ') || '(ninguno)'} · cámara a ${q.t.hCam.toFixed(0)} m del suelo`);
  }
  await irP(1);
  const fin = await page.evaluate(() => ({ km: document.querySelector('[data-l="km"]').textContent, hito: document.querySelector('[data-l="hito"]').textContent, sig: document.querySelector('[data-l="sig"]').textContent,
    rot: [...document.querySelectorAll('.lugar__rotulo.es-visible b')].map((b) => b.textContent), t: window.__lugar.estado().t3 }));
  ok(fin.km === coma(CAMIN.kmTotal) && fin.hito === 'Tablizas' && fin.rot.includes('Tablizas') && fin.rot.includes('Reserva Natural Integral de Muniellos') && /Fin del camín/.test(fin.sig),
    `p = 1: km ${fin.km}, «${fin.hito}», rótulos: ${fin.rot.join(' · ')}; cámara a ${fin.t.hCam.toFixed(0)} m del suelo; ${fin.t.bloques} bloques de ortofoto cargados por el camino`);
  ok(creceAndado && hMin > 100 && hMaxV < 700 && fin.t.bloques >= 10, `lo andado crece con el km; en el vuelo la cámara va entre ${hMin.toFixed(0)} y ${hMaxV.toFixed(0)} m sobre el suelo`);
  // la luz: al atardecer de diciembre el valle está casi todo en sombra; de noche, a oscuras con las ventanas encendidas
  const luz = async (iso) => page.evaluate(async (iso) => {
    const t = window.__lugar._t3(), antes = window.__lugar.estado().t3.sombras; t.luces(new Date(iso));
    await new Promise((z) => { const f = () => (window.__lugar.estado().t3.sombras > antes ? z() : setTimeout(f, 50)); f(); });
    const e = window.__lugar.estado().t3; return { media: e.sombraMedia, sol: e.sol, noche: e.noche };
  }, iso);
  const tarde = await luz('2026-12-21T15:40:00Z'), nocheL = await luz('2026-12-21T23:00:00Z');
  ok(tarde.media < 0.55 && tarde.media > 0.02 && tarde.sol.altura > 3 && tarde.sol.altura < 12, `21-dic 16:40: sol a ${tarde.sol.altura.toFixed(1)}° al ${tarde.sol.azimut.toFixed(0)}°; el relieve deja al sol solo el ${(tarde.media * 100).toFixed(0)} % de la escena (el 21-jun a mediodía, ${(t0.sombraMedia * 100).toFixed(0)} %)`);
  ok(nocheL.noche === 1 && nocheL.sol.altura < -40, `21-dic 00:00: noche (${nocheL.noche}); la sombra del relieve pasa a ser la de la luna (${(nocheL.media * 100).toFixed(0)} % alumbrado)`);
  // saltar con el teclado, fuera de pantalla no pinta, plan B, destruir
  await irP(0.3);
  const salto = await page.evaluate(() => { const b = document.querySelector('[data-l="saltar"]'); b.focus(); const enfocable = document.activeElement === b; b.click(); const r = document.querySelector('.lugar__pista').getBoundingClientRect(); return { enfocable, abajo: r.bottom, vh: innerHeight, foco: document.activeElement.className }; });
  ok(salto.enfocable && salto.abajo < salto.vh * 0.3 && /lugar__fuente/.test(salto.foco), `«Saltar el vuelo» (con teclado) deja el final de la pista a ${Math.round(salto.abajo)} px del borde de arriba y lleva el foco a lo que sigue`);
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  const fuera = await page.evaluate(() => { const a = window.__pintadas; return new Promise((z) => setTimeout(() => z(window.__pintadas - a), 700)); });
  ok(fuera === 0, `fuera de pantalla no pinta (${fuera} fotogramas en 0,7 s)`);
  await page.evaluate(() => document.querySelector('[data-l="aplano"]').click());
  const pl = await page.evaluate(() => ({ modo: document.querySelector('[data-modulo="lugar"]').dataset.modo, boton: !document.querySelector('[data-l="a3d"]').hidden, perfil: document.querySelectorAll('.lugar__perfil-marco .lugar__mojon').length }));
  ok(pl.modo === 'plano' && pl.boton && pl.perfil === H_.length, '«Ver el perfil» vuelve al plan B y ofrece volver al 3D');
  const rep = await page.evaluate(() => { window.__lugar.destruir(); return !!document.querySelector('[data-modulo="lugar"] .respaldo') && !document.querySelector('canvas.lugar__lienzo'); });
  ok(rep, 'destruir() con el 3D montado repone el respaldo y quita el lienzo');
  ok(errores.length === 0, 'sin errores en consola' + (errores.length ? ': ' + errores.join(' | ') : ''));
  await ctx3.close();

  // el móvil: plan B con botón y sin Three.js; al pulsar, monta el 3D
  const ctxM = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true, reducedMotion: 'no-preference' });
  await fuerza3d(ctxM);
  let pidioThree = false; const pedidas = [];
  const pm = await ctxM.newPage();
  pm.on('request', (q) => { if (/three-0\.160/.test(q.url())) pidioThree = true; if (/img\/lugar\//.test(q.url())) pedidas.push(q.url().split('/').pop().split('?')[0]); });
  const erroresM = []; errDe(pm, erroresM);
  await pm.goto(URLP + '?lugar=3d');
  await pm.locator('#lugar').scrollIntoViewIfNeeded();
  await pm.waitForFunction(() => window.__lugar && document.querySelector('[data-modulo="lugar"]').dataset.montado === '1' && document.querySelectorAll('.lugar__lista li').length > 5);
  await pm.waitForTimeout(300);
  const m0 = await pm.evaluate(() => ({ modo: document.querySelector('[data-modulo="lugar"]').dataset.modo, boton: !document.querySelector('[data-l="a3d"]').hidden, t3: !!window.__lugar.estado().t3, ancho: document.documentElement.scrollWidth }));
  ok(m0.modo === 'plano' && m0.boton && !m0.t3 && !pidioThree && pedidas.length === 0 && m0.ancho <= 390, 'móvil: plan B con el botón «Ver el vuelo en 3D», sin pedir Three.js ni imágenes, sin scroll horizontal');
  await pm.evaluate(() => document.querySelector('[data-l="a3d"]').click());
  await pm.waitForFunction(() => window.__lugar.estado().t3 && window.__pintadas > 0 && window.__lugar.estado().cargado, null, { timeout: 60000 });
  const m1 = await pm.evaluate(() => ({ modo: document.querySelector('[data-modulo="lugar"]').dataset.modo, est: window.__lugar.estado(), ancho: document.documentElement.scrollWidth, nan: window.__nan || null }));
  ok(m1.modo === '3d' && m1.ancho <= 390 && !m1.nan && m1.est.t3.triangulos < t0.triangulos * 0.6, `al pulsar monta el 3D (móvil: ${Math.round(m1.est.t3.triangulos)} triángulos), sin scroll horizontal`);
  ok(pedidas.includes('alturas-valle50.png') && !pedidas.includes('alturas-valle.png') && !pedidas.some((a) => /orto-b\d+-1024\.webp|-2048\.webp/.test(a)), 'el móvil pide el relieve a 50 m y las ortofotos pequeñas: ' + [...new Set(pedidas)].length + ' ficheros');
  ok(erroresM.length === 0, 'móvil sin errores' + (erroresM.length ? ': ' + erroresM.join(' | ') : ''));
  await ctxM.close();

  /* ---------- 5. Three.js de verdad contra un contexto WebGL DE PEGA ----------
     El WebGLRenderer auténtico recorre la escena entera (programas, sombras, texturas, instancias) contra un objeto
     que imita la API de WebGL2 y no hace nada: no hay GPU, no hay contexto y no se pinta. Sirve para dos cosas:
     que el camino real de Three.js no lance errores con esta escena, y sacar el texto FINAL de cada shader (con
     su cabecera y sus #define) para revisarlo: se guarda en ref/raw/lugar-cache/shaders/. Sigue sin compilarse. */
  console.log('5. Three.js real contra un contexto WebGL de pega (sin GPU, no pinta)');
  const ENVOLTORIO2 = `import * as T from '/vendor/three-0.160.0.module.min.js?real';
export * from '/vendor/three-0.160.0.module.min.js?real';
function pega(canvas) {
  if (typeof window.WebGL2RenderingContext === 'undefined') window.WebGL2RenderingContext = class WebGL2RenderingContext {};   // con --disable-3d-apis no existe
  const C = window.WebGL2RenderingContext.prototype;
  window.__fuentes = []; window.__gl = { dibujos: 0, programas: 0, texturas: 0 };
  const num = { 34930: 16, 35660: 16, 35661: 32, 3379: 8192, 34076: 8192, 34921: 16, 36347: 4096, 36348: 30, 36349: 1024, 36183: 4, 34024: 8192, 32883: 2048, 35071: 2048, 34852: 8, 36063: 8 };
  const f = {
    getContextAttributes: () => ({ alpha: false, depth: true, stencil: false, antialias: true, premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: 'default', failIfMajorPerformanceCaveat: false }),
    getParameter: (p) => p === 7938 ? 'WebGL 2.0 (de pega)' : p === 35724 ? 'WebGL GLSL ES 3.00 (de pega)' : (p === 3088 || p === 2978) ? new Int32Array([0, 0, 300, 150]) : p === 3386 ? new Int32Array([8192, 8192]) : (num[p] || 0),
    getExtension: () => null, getSupportedExtensions: () => [], getShaderPrecisionFormat: () => ({ precision: 23, rangeMin: 127, rangeMax: 127 }),
    createShader: (t) => ({ tipo: t }), shaderSource: (sh, src) => { sh.src = src; window.__fuentes.push({ tipo: sh.tipo === 35633 ? 'vert' : 'frag', src }); },
    createProgram: () => { window.__gl.programas++; return {}; }, createTexture: () => { window.__gl.texturas++; return {}; },
    getShaderParameter: () => true, getProgramParameter: (pr, p) => (p === 35714 || p === 35715 ? true : 0), getShaderInfoLog: () => '', getProgramInfoLog: () => '',
    getUniformLocation: () => null, getAttribLocation: () => -1, getActiveUniform: () => null, getActiveAttrib: () => null,
    checkFramebufferStatus: () => 36053, getError: () => 0, isContextLost: () => false,
    drawArrays: () => { window.__gl.dibujos++; }, drawElements: () => { window.__gl.dibujos++; }, drawArraysInstanced: () => { window.__gl.dibujos++; }, drawElementsInstanced: () => { window.__gl.dibujos++; },
  };
  const propios = { constructor: { name: 'WebGL2RenderingContext' }, canvas, drawingBufferWidth: 300, drawingBufferHeight: 150, drawingBufferColorSpace: 'srgb', unpackColorSpace: 'srgb' };
  return new Proxy(propios, {
    get(t, k) { if (Object.hasOwn(t, k)) return t[k]; if (Object.hasOwn(f, k)) return f[k]; if (typeof k === 'string' && typeof C[k] === 'number') return C[k];
      if (typeof k !== 'string') return undefined; return /^create/.test(k) ? () => ({}) : () => undefined; },
    set(t, k, v) { t[k] = v; return true; },
  });
}
export class WebGLRenderer extends T.WebGLRenderer {
  constructor(o) { super(Object.assign({}, o, { context: pega(o.canvas) })); window.__pintadas = 0; const r = this.render.bind(this); this.render = (e, c) => { window.__pintadas++; return r(e, c); }; }
  forceContextLoss() {}
}`;
  const ctx5 = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
  await ctx5.route((u) => u.pathname.endsWith('/vendor/three-0.160.0.module.min.js') && !u.search.includes('real'), (q) => q.fulfill({ status: 200, contentType: 'text/javascript', body: ENVOLTORIO2 }));
  const p5 = await ctx5.newPage();
  const err5 = []; errDe(p5, err5);
  const avisos5 = []; p5.on('console', (m) => { if (/THREE\./.test(m.text())) avisos5.push(m.text().slice(0, 300)); });
  await p5.goto(URLP + '?lugar=3d&hora=11:00&fecha=2026-11-26');
  await p5.locator('#lugar').scrollIntoViewIfNeeded();
  await p5.waitForFunction(() => window.__lugar && window.__lugar.estado().t3 && window.__pintadas > 2 && window.__lugar.estado().cargado, null, { timeout: 60000 });
  await p5.evaluate(() => { const pista = document.querySelector('.lugar__pista'), e = document.querySelector('.lugar__escenario'); scrollTo(0, pista.getBoundingClientRect().top + scrollY + 0.5 * (pista.offsetHeight - e.offsetHeight)); });
  await p5.waitForFunction(() => Math.abs(window.__lugar.estado().t3.pVis - 0.5) < 0.002, null, { timeout: 20000 });
  const g5 = await p5.evaluate(() => ({ gl: window.__gl, fuentes: window.__fuentes, tri: window.__lugar.estado().t3.triangulos, llamadas: window.__lugar.estado().t3.llamadas }));
  const dirSh = path.join(RAIZ, 'ref/raw/lugar-cache/shaders'); fs.rmSync(dirSh, { recursive: true, force: true }); fs.mkdirSync(dirSh, { recursive: true });
  const unicos = [...new Map(g5.fuentes.map((x) => [x.tipo + x.src, x])).values()];
  unicos.forEach((x, i) => fs.writeFileSync(path.join(dirSh, String(i).padStart(2, '0') + '-' + ((/#define SHADER_NAME (\w+)/.exec(x.src) || [])[1] || 'x') + '.' + x.tipo), x.src));
  ok(g5.gl.programas >= 5 && g5.gl.dibujos > 50 && unicos.length >= 10, `el WebGLRenderer de verdad recorre la escena sin errores: ${g5.gl.programas} programas, ${unicos.length} shaders distintos, ${g5.gl.dibujos} llamadas de dibujo (a la nada), ${Math.round(g5.tri)} triángulos a mitad de camino`);
  const mios = unicos.filter((x) => /sRelieve/.test(x.src));
  const lint = (src) => {
    const sinCom = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const c = (a, b) => sinCom.split(a).length - sinCom.split(b).length, mal = [];
    if (c('{', '}')) mal.push('llaves'); if (c('(', ')')) mal.push('paréntesis'); if (c('[', ']')) mal.push('corchetes');
    if (/#include/.test(sinCom)) mal.push('#include sin resolver');
    if (!/^#version 300 es/.test(src)) mal.push('sin #version 300 es');
    const ifs = (sinCom.match(/^\s*#\s*if(def|ndef)?\b/gm) || []).length, endifs = (sinCom.match(/^\s*#\s*endif\b/gm) || []).length; if (ifs !== endifs) mal.push('#if/#endif');
    return mal;
  };
  const malos = unicos.map((x) => lint(x.src)).filter((m) => m.length);
  const fragSuelo = mios.find((x) => x.tipo === 'frag' && /mapCerca/.test(x.src) && /#define USE_MAP/.test(x.src));
  const vertMios = unicos.filter((x) => x.tipo === 'vert' && /vMundo = \( modelMatrix \* mw_ \)\.xyz;/.test(x.src));
  const vertInst = vertMios.find((x) => /#define USE_INSTANCING/.test(x.src));
  const dosLuces = fragSuelo && fragSuelo.src.split('directLight.color *= factorRelieve;').length - 1;
  ok(malos.length === 0 && mios.length >= 5 && mios.every((x) => x.tipo === 'frag') && vertMios.length >= 4 && !!fragSuelo && !!vertInst && dosLuces === 2,
    `texto final de los shaders: ${mios.length} de fragmentos llevan la sombra del relieve (en las ${dosLuces} luces direccionales: sol y luna) y ${vertMios.length} de vértices su posición en la escena (uno, con instancias: los balaustres); el del suelo funde la ortofoto de detalle; cabecera #version 300 es, sin #include, llaves, paréntesis y #if cuadran` + (malos.length ? ' · MAL: ' + JSON.stringify(malos) : ''));
  ok(avisos5.length === 0 && err5.length === 0, 'Three.js no avisa de nada (texturas, materiales, uniformes)' + (avisos5.length + err5.length ? ': ' + avisos5.concat(err5).slice(0, 4).join(' | ') : ''));
  await p5.evaluate(() => window.__lugar.destruir());
  await ctx5.close();
} finally {
  await browser.close();
  srv.close();
}
console.log(`\n${bien} bien, ${fallos} mal`);
process.exit(fallos ? 1 : 0);
