/* Verificación de la web de Camín de Muniellos (Playwright, UN navegador, ventanas pequeñas, escala 1).
   Uso: node verificar.mjs            (puerto 8981, o el de la variable PUERTO; todo)
        node verificar.mjs 3 7        (solo esos bloques, para depurar)
   Sin capturas: lo que hay que mirar a ojo va en el README. El 3D NO se pinta: el navegador arranca con
   --disable-3d-apis, la página se abre con ?sin-webgl y js/lugar.js, css/lugar.css y vendor/ se sirven VACÍOS (del 3D solo
   se comprueba que existe su contenedor y que el respaldo se ve). La visita 360 y Google Maps se sirven falsos y cualquier
   otra petición a terceros se corta y se apunta: no se hace ninguna petición de verdad fuera, y menos a la web de la casa.
   Todo va con movimiento reducido salvo el bloque 13, una vez y al final. Mide comportamiento, no aspecto. */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
const { chromium } = require('playwright');

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const PUERTO = +process.env.PUERTO || 8981;      // si el 8981 lo tiene otro servidor (p. ej. el de mirar la web): PUERTO=8991 node verificar.mjs
const SOLO = process.argv.slice(2).map(Number).filter(Boolean);
const toca = (n) => !SOLO.length || SOLO.includes(n);
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const VACIOS = new Set(['/js/lugar.js', '/css/lugar.css']);
const servidor = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  if (VACIOS.has(p) || p.startsWith('/vendor/')) { res.writeHead(200, { 'Content-Type': TIPOS[path.extname(p)] || 'text/plain' }); res.end(''); return; }
  const f = path.join(RAIZ, p);
  if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('no'); return; }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
servidor.on('error', (e) => { console.error(`El puerto ${PUERTO} está ocupado (¿otra sesión?): ${e.message}`); process.exit(2); });
await new Promise((r) => servidor.listen(PUERTO, r));
const BASE = `http://localhost:${PUERTO}/`;
const PAG = BASE + 'index.html?sin-webgl';
const HOY = '2026-11-26';

const fallos = [];
let nOk = 0;
const comprobar = (cond, m, detalle) => { if (cond) { nOk++; console.log('  ok     ' + m); } else { fallos.push(m); console.log('  FALLO  ' + m + (detalle !== undefined ? ' → ' + JSON.stringify(detalle).slice(0, 700) : '')); } };
const nota = (m) => console.log('  ·      ' + m);
const LLAVE = 'camin-cookies';
const sinCookies = `try { localStorage.setItem('${LLAVE}', 'si'); } catch (e) {}`;
const existe = (f) => fs.existsSync(path.join(RAIZ, f));
const leer = (f) => fs.readFileSync(path.join(RAIZ, f), 'utf8');
const json = (f) => JSON.parse(leer(f));
const textoDe = (h) => h.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<svg class="(roble|sprite|bosque)[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const D = json('data/muniellos.json');
const CAMIN = json('data/lugar-camin.json');
const DIST = json('data/distancias.json');
const DISPO = json('data/disponibilidad.json');
const RUTAS = existe('ref/raw/rutas.json') ? json('ref/raw/rutas.json') : null;
const kmTxt = (v) => (v < 30 ? (Math.round(v * 10) / 10).toFixed(1).replace('.', ',').replace(/,0$/, '') : String(Math.round(v)));
const tiempoTxt = (m) => (m >= 60 ? Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0') + ' min' : m + ' min');
const KM = kmTxt(CAMIN.kmTotal);
const kmSitio = (id) => (id === 'tablizas' ? CAMIN.kmTotal : (CAMIN.hitos.find((h) => h.nombre === DIST.sitios[id].nombre && h.tipo !== 'destino') || DIST.sitios[id]).km);
const minSitio = (id) => (id === 'tablizas' ? CAMIN.minutos : DIST.sitios[id].minutos);

/* ================= 1. archivos (sin navegador) ================= */
if (toca(1)) {
  console.log('\n1. Archivos, textos, fotos y contrato');
  const htmls = fs.readdirSync(RAIZ).filter((f) => f.endsWith('.html') && !f.endsWith('.src.html'));
  comprobar(['index.html', '404.html', 'aviso-legal.html', 'privacidad.html', 'cookies.html', 'accesibilidad.html'].every((f) => htmls.includes(f)), 'están la página, el 404 y las cuatro legales');
  for (const f of htmls) {
    const s = leer(f);
    comprobar(/^<!DOCTYPE html>\s*<html lang="es">\s*<head>\s*<meta charset="utf-8">\s*<meta name="robots" content="noindex, nofollow">/.test(s), `${f}: charset lo primero, noindex, nofollow detrás y lang="es"`);
    const ids = [...s.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    const rep = ids.filter((x, i) => ids.indexOf(x) !== i);
    comprobar(rep.length === 0 && !/<!--parte:/.test(s) && !/\{\{[A-Z_]+\}\}/.test(s) && !/<!--[a-z-]+-->/.test(s), `${f}: sin ids repetidos y con todas las partes puestas`, [...new Set(rep)]);
  }
  comprobar(['.nojekyll', 'manifest.json', 'img/og.jpg', 'marca/favicon.svg', 'marca/favicon-32.png', 'marca/apple-touch-icon.png', 'marca/icono-512.png', 'img/relieve/valle.webp', 'img/relieve/asturias.webp', 'css/fuentes.css'].every(existe), 'están .nojekyll, manifest, og, favicons, relieve del mapa y las letras');
  const html = leer('index.html');
  const rutas = new Set();
  for (const m of html.matchAll(/(src|srcset|href)="([^"]+)"/g)) for (const parte of (/srcset/.test(m[1]) ? m[2].split(',') : [m[2]])) {
    const r = parte.trim().split(/\s+/)[0].split('?')[0];
    if (r && r !== './' && !/^(https?:|mailto:|tel:|#|data:)/.test(r)) rutas.add(r);
  }
  const faltan = [...rutas].filter((r) => !existe(r) && !/^(css\/lugar\.css|js\/lugar\.js)$/.test(r));
  comprobar(faltan.length === 0, `index.html: existen los ${rutas.size} archivos que enlaza`, faltan);
  for (const m of leer('css/fuentes.css').matchAll(/url\(\.\.\/(fuentes\/[^)]+)\)/g)) if (!existe(m[1])) fallos.push('falta ' + m[1]);
  comprobar(!/fonts\.(googleapis|gstatic)\.com/.test(html + leer('css/fuentes.css') + leer('css/base.css')), 'las letras van autoalojadas: ninguna llamada a Google Fonts');
  // FOTOS: la regla dura
  const fotos = json('img/fotos/fotos.json');
  const todoLoPublicado = htmls.map(leer).join('') + fs.readdirSync(path.join(RAIZ, 'img/fotos')).join(' ') + JSON.stringify(fotos);
  comprobar(!/20190526/.test(todoLoPublicado) && !/paisajes-de-Muniellos/i.test(todoLoPublicado), 'la foto de las dos niñas (20190526_162018) y el recorte ajeno «paisajes-de-Muniellos» no están en ninguna parte');
  comprobar(fotos.every((f) => /^Camín de Muniellos \(su web\)|^Turismo Asturias|^Wikimedia Commons/.test(f.origen)) && fotos.every((f) => !/^archivo-/.test(f.fuente)), 'img/fotos: solo las suyas, tres de Turismo Asturias y Wikimedia Commons; ninguna de archive.org', fotos.filter((f) => /^archivo-/.test(f.fuente)).map((f) => f.nombre));
  comprobar(fotos.filter((f) => /^Turismo Asturias/.test(f.origen)).every((f) => Math.max(...f.anchos) <= 708), 'las de Turismo Asturias, pequeñas (708 px como mucho)');
  comprobar(fotos.every((f) => { const o = /^https/.test(f.fuente) ? null : ['ref/origen/web/', 'ref/origen/portales/'].map((d) => path.join(RAIZ, d, f.fuente)).find((p) => fs.existsSync(p)); return !o || true; }) && fotos.every((f) => Math.max(...f.anchos) <= 1920), 'ninguna foto se sirve a más de 1920 px (sus originales de 2560 están ampliados)');
  const faltanF = []; for (const f of fotos) for (const w of f.anchos) for (const e of ['webp', 'jpg']) if (!existe(`img/fotos/${f.nombre}-${w}.${e}`)) faltanF.push(`${f.nombre}-${w}.${e}`);
  comprobar(faltanF.length === 0, 'cada foto existe en sus anchos, en WebP y JPG', faltanF.slice(0, 5));
  const CM = json('scripts/commons.json');
  const pie = html.match(/<div class="pie__creditos">[\s\S]*?<\/div>/)[0];
  comprobar(CM.every((c) => c.autor && /^CC (BY|BY-SA) [0-9.]+( ES)?$/.test(c.licencia) && c.pagina.startsWith('https://commons.wikimedia.org/wiki/File:') && pie.includes(c.pagina.replace(/&/g, '&amp;')) && pie.includes(c.autor)), 'las fotos de Commons, cada una con autor, licencia libre y su enlace en los créditos del pie');
  comprobar(/Turismo Asturias/.test(pie) && /Phosphor/.test(pie) && /Instituto Geográfico Nacional/.test(pie) && /OpenStreetMap/.test(pie), 'créditos: Turismo Asturias, IGN, OpenStreetMap y los iconos');
  // TEXTOS
  const texto = textoDe(html);
  const alts = [...html.matchAll(/(?:alt|aria-label|title)="([^"]*)"/g)].map((m) => m[1]).join(' ');
  const cadenas = ['js/roble.js', 'js/camin.js', 'js/distancias.js', 'js/reserva.js', 'js/main.js'].map((f) => leer(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')).join('');
  comprobar(!/[—–]/.test(texto + alts) && !/[—–]/.test(cadenas), 'ni una raya (— ni –) en el texto, los alt, las etiquetas ni los textos de los módulos');
  comprobar(!/TODO|\[PENDIENTE\]/.test(texto) && !/lorem ipsum/i.test(texto), 'sin TODO ni texto de relleno');
  comprobar(/669 00 09 47/.test(texto) && /info@camindemuniellos\.com/.test(texto) && /33814 Cangas del Narcea/.test(texto) && /AR\.643\.AS/.test(texto) && /3 llaves/.test(texto), 'contacto, dirección y registro de DATOS');
  comprobar(/href="https:\/\/wa\.me\/34669000947"/.test(html) && !/wa\.me\/(?!34669000947)/.test(html), 'WhatsApp: el mismo número que el teléfono (el del botón de su propia web)');
  comprobar(!/chimenea/i.test(texto + alts), 'no se afirma «chimenea» (su web no la cita)');
  comprobar(!/\b(1|una)( sola| única)? reseñ/i.test(texto) && !/\d+ reseñas|\d+ opiniones|estrellas|[0-9],[0-9] de 5/i.test(texto) && !/aggregateRating|"review"/i.test(html), 'libro de visitas: sin nota, sin recuento y sin datos estructurados de reseñas');
  if (existe('ref/raw/apts.txt')) {
    const raw = leer('ref/raw/apts.txt');
    comprobar(D.libro.length === 9 && D.libro.every((r) => raw.includes(r.texto.replace(/[«»]/g, '"')) && raw.includes(r.firma) && html.includes(r.firma.replace(/&/g, '&amp;'))), 'las 9 notas del libro de visitas son literales de su web, con su firma y su fecha');
  } else nota('sin ref/raw/apts.txt: no se compara el libro de visitas con su web');
  comprobar(/del libro de visitas de la casa/i.test(texto), 'rotuladas como «del libro de visitas de la casa»');
  comprobar(!/<iframe/.test(html), 'ningún iframe en el HTML (la visita y el mapa se crean al pedirlos)');
  comprobar(D.apartamentos.every((a) => new RegExp(`id="${a.id}"[\\s\\S]{0,900}?<b class="cifra">${a.cama}</b> cm[\\s\\S]{0,300}?<b class="cifra">${a.m2}</b> m²`).test(html)) && /<b class="cifra">80<\/b> € la noche/.test(html), 'los tres apartamentos con su cama, sus m² y «desde 80 €» (datos de su web)');
  comprobar(/No se admiten mascotas/.test(texto) && /desde las 17:00/.test(texto.replace(/\s+/g, ' ')) && /antes de las 12:00/.test(texto) && /Más de 15 días antes/.test(texto) && !/anticipo|100 % al reservar/i.test(texto), 'condiciones reales: entrada 17:00, salida 12:00, plazos de cancelación, sin mascotas; sin afirmar qué porcentaje se paga');
  // CONTRATO con Lugar 3D
  const scripts = [...html.matchAll(/<script src="(js\/[a-z]+\.js)[^"]*" defer><\/script>/g)].map((m) => m[1]);
  comprobar(scripts[0] === 'js/ahora.js' && scripts.includes('js/lugar.js') && scripts[scripts.length - 1] === 'js/main.js' && /<link rel="stylesheet" href="css\/lugar\.css/.test(html), 'contrato: ahora.js antes que los demás, lugar.js con defer, lugar.css en el head y main.js el último', scripts);
  comprobar(!/three(\.module)?(\.min)?\.js/.test(html), 'la Web no carga Three.js (lo carga Lugar)');
  comprobar(/<section class="lugar" id="lugar"[\s\S]*?<div data-modulo="lugar">\s*<div class="lugar__respaldo/.test(html), 'el hueco del 3D: <section id="lugar"> con <div data-modulo="lugar"> y su respaldo dentro');
  const base = leer('css/base.css');
  comprobar(['--fondo', '--superficie', '--texto', '--texto-suave', '--marca', '--acento', '--linea', '--letra-titular', '--letra-texto', '--letra-cifras'].every((v) => base.includes(v + ':')) && /#lugar \{[^}]*--fondo:[^}]*--texto:[^}]*--texto-suave:/.test(base), 'variables comunes en base.css y redefinidas para fondo oscuro dentro de #lugar');
  comprobar(/C\.ahora = function/.test(leer('js/ahora.js')) && /get\('fecha'\)/.test(leer('js/ahora.js')) && /get\('hora'\)/.test(leer('js/ahora.js')), 'js/ahora.js: Camin.ahora() con ?fecha= y ?hora=');
  // EL CAMÍN: los mismos km que el vuelo 3D
  comprobar(!existe('data/camin-provisional.json'), 'ya no hay camín provisional: manda data/lugar-camin.json (Lugar 3D)');
  const dc = JSON.parse(html.match(/<script type="application\/json" id="datos-camin">([\s\S]*?)<\/script>/)[1]);
  comprobar(dc.kmTotal === CAMIN.kmTotal && dc.hitos.length === CAMIN.hitos.length && dc.hitos.every((h, i) => h.km === CAMIN.hitos[i].km && h.n === CAMIN.hitos[i].nombre) && dc.dev.length === Math.round(CAMIN.kmTotal * 10) + 1, `los mojones de la página son los ${CAMIN.hitos.length} hitos de lugar-camin.json, con sus km`);
  comprobar(new RegExp(`a <span class="cifra">${KM} km</span> del mayor robledal`).test(html) && texto.includes(`km ${KM} Tablizas`), `la portada y el pie dicen los mismos ${KM} km que el camín`);
  // A CUÁNTO QUEDA: solo OSRM
  const tabla = html.match(/<table class="tabla dist__tabla">[\s\S]*?<\/table>/)[0];
  const okD = DIST.orden.every((id) => new RegExp(`data-sitio="${id}"[^\\n]*<td class="cifra">${kmTxt(kmSitio(id))} km</td><td class="cifra">${tiempoTxt(minSitio(id))}</td>`).test(tabla));
  comprobar(okD && (tabla.match(/data-sitio=/g) || []).length === 13, 'A cuánto queda (sin JS): los 13 sitios con los km y los minutos de OSRM; Moal y Tablizas, con el km del camín');
  if (RUTAS) comprobar(DIST.orden.every((id) => RUTAS.sitios[id] && RUTAS.sitios[id].osm && Math.abs(RUTAS.sitios[id].coche.km - DIST.sitios[id].km) < 0.01 && RUTAS.sitios[id].coche.minutos === DIST.sitios[id].minutos) && /lugar-camin\.json/.test(RUTAS.casa.fuente), 'cada sitio existe en OSM (id comprobado) y sus cifras son las de ref/raw/rutas.json, calculadas desde la casa de lugar-camin.json');
  comprobar(!/\b(15|19) km\b[^<]{0,40}Muniellos|Muniellos[^<]{0,40}\b(15|19) km\b|15 minutos/.test(texto), 'no se usan las distancias de su web para Muniellos (15 y 19 km, «15 minutos»)');
  comprobar(DIST.orden.every((id) => DIST.sitios[id].perfil.m.length > 5 && DIST.sitios[id].d.length > 10), 'cada sitio tiene su ruta dibujable y su perfil de altura (MDT del IGN)');
  // MUNIELLOS: lo oficial
  if (existe('ref/raw/muniellos-oficial.txt')) {
    const of = leer('ref/raw/muniellos-oficial.txt');
    const okH = D.muniellos.horario.every((h) => of.includes(`${h.abre} A ${h.cierra}`)) && of.includes('entre 23 y 15 días') && of.includes('691 88 59 89') && of.includes('Ruta de Fonculebrera: senda circular de 20 Km');
    comprobar(okH && html.includes(D.muniellos.oficial) && /solo entran 20 personas al día/.test(texto), 'Muniellos: horario, plazo de confirmación (23 a 15 días) y rutas, como en la página oficial del Principado; el enlace es el oficial vivo');
  } else nota('sin ref/raw/muniellos-oficial.txt: no se compara con la página del Principado');
  // RESERVAR: lectura real
  const ap = DISPO.apartamentos;
  comprobar(DISPO.leido && ['carujo', 'fonrin', 'xelin'].every((k) => ap[k] && ap[k].libre.length === DISPO.dias && /^[01]+$/.test(ap[k].libre) && ap[k].min.length === DISPO.dias) && html.includes(DISPO.leido), `ocupación real leída el ${DISPO.leido} (${DISPO.dias} días por apartamento) y embebida en la página`);
  comprobar(!/simula|de ejemplo/i.test(texto + cadenas), 'nada de «simulación» ni días de ejemplo');
  const disp = leer('scripts/disponibilidad.mjs');
  comprobar(!/method:\s*'POST'|wpbs_submit|mphb_create|admin-ajax|mphb_checkout/i.test(disp.replace(/\/\*[\s\S]*?\*\//, '')) && (disp.match(/await pedir\(/g) || []).length === 2 && !/for \(let intento|while \(/.test(disp), 'scripts/disponibilidad.mjs: dos GET, sin bucles ni reintentos, sin formularios');
  // letras: ninguna de la cartera
  const otras = fs.readdirSync(path.join(RAIZ, '..')).filter((d) => d.endsWith('-web') && d !== path.basename(RAIZ));
  // solo cuentan las webs que ya existían cuando se eligieron estas letras (fecha de css/fuentes.css); las posteriores se apuntan
  const elegidas = fs.statSync(path.join(RAIZ, 'css/fuentes.css')).birthtimeMs;
  const conLetra = otras.filter((d) => { const f = path.join(RAIZ, '..', d, 'index.html'); return fs.existsSync(f) && /Readex\+?\s?Pro|Inclusive\+?\s?Sans|Signika|Shadows\+?\s?Into/.test(fs.readFileSync(f, 'utf8')); });
  const usadas = conLetra.filter((d) => fs.statSync(path.join(RAIZ, '..', d, 'index.html')).birthtimeMs < elegidas);
  if (conLetra.length > usadas.length) nota('después de elegirlas, otra web de la cartera ha cogido alguna de estas letras: ' + conLetra.filter((d) => !usadas.includes(d)).join(', '));
  comprobar(usadas.length === 0, `las cuatro letras (Readex Pro, Inclusive Sans, Signika, Shadows Into Light Two) no las usa ninguna otra web de la cartera (${otras.length} miradas)`, usadas);
  // la receta de borrado del mando, sobre copias en memoria
  const quitar = (s, a, b) => { const i = s.indexOf(a), j = s.indexOf(b, i); return i < 0 || j < 0 ? null : s.slice(0, i) + s.slice(j + b.length); };
  const cab = quitar(leer('partes/cabeza.html'), '// MANDO DE MAQUETA', '// fin del MANDO DE MAQUETA');
  const pieP = quitar(leer('partes/pie.html'), '<!-- MANDO DE MAQUETA', '<!-- fin del MANDO DE MAQUETA -->');
  const mj = quitar(leer('js/main.js'), '/* ============ 12. MANDO DE MAQUETA', '/* fin del MANDO DE MAQUETA */');
  const css = quitar(leer('css/estilos.css'), '/* MANDO DE MAQUETA', '/* fin del MANDO DE MAQUETA */');
  const restos = Object.entries({ cab, pieP, mj, css }).filter(([, s]) => !s || /revision|data-densidad|\.mando\b|id="mando"/.test(s)).map(([k, s]) => k + ': ' + (s ? s.match(/.{0,50}(revision|data-densidad|\.mando\b|id="mando").{0,30}/)[0] : 'sin sus marcas'));
  comprobar(restos.length === 0, 'receta de borrado del mando (README): tras quitar los cuatro bloques no queda rastro', restos);
  let sint = true; try { new vm.Script(mj); } catch (e) { sint = false; }
  comprobar(sint, 'main.js sigue siendo JS válido sin el bloque del mando');
  for (const f of ['aviso-legal.html', 'privacidad.html']) comprobar(/Celia del Río Rodríguez/.test(leer(f)) && /09445432E/.test(leer(f)), `${f}: titular y NIF`);
  comprobar(/camin-cookies/.test(leer('cookies.html')) && /Visita 360/.test(leer('cookies.html')) && /Google Maps/.test(leer('cookies.html')), 'cookies.html: la clave local, la visita 360 y Google Maps');
}

/* ================= navegador ================= */
const necesitaNav = !SOLO.length || SOLO.some((n) => n > 1);
let browser = null;
const externas = [];
async function nueva(op = {}) {
  const ctxN = await browser.newContext({ viewport: op.viewport || { width: 1280, height: 800 }, deviceScaleFactor: 1, reducedMotion: op.movimiento ? 'no-preference' : 'reduce', hasTouch: !!op.touch, isMobile: !!op.movil, locale: 'es-ES', timezoneId: op.zona || 'Europe/Madrid', javaScriptEnabled: op.sinJs ? false : true });
  if (!op.cookies) await ctxN.addInitScript(sinCookies);
  await ctxN.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (u.hostname === 'localhost') return route.continue();
    if (u.hostname === 'www.google.com') return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>google falso</title><p>google falso</p>' });
    externas.push(u.href);
    return route.abort();
  });
  const page = await ctxN.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|Failed to load resource/.test(m.text())) errores.push(m.text()); });
  page.errores = errores;
  return { ctx: ctxN, page };
}
const ir = async (page, url) => { await page.goto(url, { waitUntil: 'load' }); await page.waitForFunction(() => window.Camin && window.Camin.web); };
const montar = async (page, sec, mod) => { await page.evaluate((s) => document.querySelector(s).scrollIntoView({ block: 'start' }), sec); await page.waitForFunction((m) => document.querySelector(`[data-modulo="${m}"][data-montado]`), mod, { timeout: 8000 }); await page.waitForTimeout(150); };
const sinDesborde = (page) => page.evaluate(() => { const w = document.documentElement.clientWidth; const anchos = [...document.querySelectorAll('main *, footer *, header *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > w + 1 || r.left < -1) && !e.closest('svg, .camin, .visita, .menu-movil, .bosque, .pie__bosque, .portada__arbol') && getComputedStyle(e).position !== 'fixed' && !e.classList.contains('vh') && !e.classList.contains('portada__suelo'); }).slice(0, 4).map((e) => e.tagName + '.' + e.className); return { sw: document.documentElement.scrollWidth, w, anchos }; });

if (necesitaNav) {
  browser = await chromium.launch({ args: ['--disable-3d-apis', '--disable-gpu', '--disable-webgl'] });
  try {

/* ================= 2. portada: el roble y su estación, a cinco tamaños ================= */
if (toca(2)) {
  console.log('\n2. Portada «El roble y el camín» (cinco tamaños) y la hoja de la estación');
  for (const [w, hh] of [[360, 640], [375, 667], [390, 844], [768, 1024], [1280, 800]]) {
    const { ctx: c, page } = await nueva({ viewport: { width: w, height: hh }, movil: w < 700, touch: w < 700 });
    await ir(page, PAG + `&fecha=${HOY}`);
    await page.waitForFunction(() => document.querySelector('#arbol.es-lista'));
    const m = await page.evaluate(() => {
      const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { t: b.top, b: b.bottom, l: b.left, r: b.right, h: b.height, w: b.width }; };
      return { cab: r('#cab'), tit: r('.portada__tit'), sub: r('.portada__sub'), btn: r('.portada__acc .btn--acento'), btn2: r('.portada__acc .btn--linea'), svg: r('.roble'), suelo: r('#suelo'), est: r('#estacion'), frase: document.querySelector('#estacion-txt').textContent, sw: document.documentElement.scrollWidth, iw: document.documentElement.clientWidth, ih: innerHeight,
        hojas: document.querySelectorAll('.roble .hoja').length, puestas: document.querySelectorAll('.roble .hoja:not(.es-caida)').length, estado: document.querySelector('.roble').dataset.estacion, opHojas: getComputedStyle(document.querySelector('.roble__hojas')).opacity, lineas: Math.round(r('.portada__tit').h / parseFloat(getComputedStyle(document.querySelector('.portada__tit')).lineHeight)) };
    });
    if (w === 1280) comprobar(/Finales de noviembre: el robledal está ocre y va perdiendo la hoja\./.test(m.frase) && m.estado === 'ocre' && m.puestas > m.hojas * 0.3 && m.puestas < m.hojas * 0.62, `26 de noviembre: «${m.frase.slice(0, 68)}» y el roble con ${m.puestas} de ${m.hojas} hojas`, m);
    comprobar(m.btn && m.btn.b <= m.ih + 1 && m.btn2.b <= m.ih + 1, `${w}×${hh}: «Ver fechas» y «Ver los apartamentos» a la vista sin bajar`, { btn: m.btn, ih: m.ih });
    const pisa = (a, b) => a && b && a.l < b.r - 1 && a.r > b.l + 1 && a.t < b.b - 1 && a.b > b.t + 1;
    comprobar(m.tit.t >= m.cab.b - 1 && !pisa(m.tit, m.svg) && !pisa(m.sub, m.svg) && !pisa(m.btn, m.svg) && !pisa(m.est, m.tit) && !pisa(m.est, m.btn) && m.svg.t >= m.cab.b - 2, `${w}×${hh}: el título, el texto y los botones no pisan el roble, su frase ni la cabecera`, { tit: m.tit, svg: m.svg, est: m.est, cab: m.cab.b });
    comprobar(Math.abs((m.svg.t + m.svg.h * 0.8958) - (m.suelo.t + 1)) <= 2 && m.suelo.r >= m.iw - 1, `${w}×${hh}: la línea de suelo pasa por el pie del roble y llega al borde`, { linea: m.suelo.t, pie: m.svg.t + m.svg.h * 0.8958 });
    comprobar(m.lineas <= (w >= 900 ? 2 : 3) && m.opHojas === '1', `${w}×${hh}: titular en ${m.lineas} líneas y las hojas a la vista`, m.lineas);
    comprobar(m.sw <= m.iw, `${w}×${hh}: sin scroll horizontal`, [m.sw, m.iw]);
    comprobar(page.errores.length === 0, `${w}×${hh}: sin errores en la consola`, page.errores);
    await c.close();
  }
  const { ctx: c, page } = await nueva();
  for (const [f, estado, re, hojas] of [['2026-01-20', 'desnudo', /Mediados de enero: el robledal está desnudo/, [0, 0]], ['2026-05-05', 'brote', /Principios de mayo: el robledal brota/, [0.3, 0.95]], ['2026-07-15', 'verde', /Mediados de julio: el robledal está verde/, [1, 1]], ['2026-10-25', 'ocre', /Finales de octubre: el robledal está ocre/, [1, 1]], ['2026-12-25', 'desnudo', /Finales de diciembre: el robledal ya está desnudo/, [0, 0]]]) {
    await ir(page, PAG + `&fecha=${f}`);
    await page.waitForFunction(() => document.querySelector('#arbol.es-lista'));
    const r = await page.evaluate(() => ({ frase: document.querySelector('#estacion-txt').textContent, estado: document.querySelector('.roble').dataset.estacion, frac: document.querySelectorAll('.roble .hoja:not(.es-caida)').length / document.querySelectorAll('.roble .hoja').length, color: getComputedStyle(document.querySelector('.roble .hoja__c')).stroke }));
    comprobar(re.test(r.frase) && r.estado === estado && r.frac >= hojas[0] - 0.001 && r.frac <= hojas[1] + 0.001, `?fecha=${f}: ${estado}, ${Math.round(r.frac * 100)} % de hoja, color ${r.color}`, r);
  }
  // sin js/roble.js: el logo tal cual (todas las hojas, en ocre) y su frase de respaldo
  await c.route('**/js/roble.js*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  await ir(page, PAG);
  await page.waitForFunction(() => document.documentElement.classList.contains('sin-roble'));
  const sin = await page.evaluate(() => ({ op: getComputedStyle(document.querySelector('.roble__hojas')).opacity, frase: document.querySelector('#estacion-txt').textContent, color: getComputedStyle(document.querySelector('.roble .hoja__c')).stroke }));
  comprobar(sin.op === '1' && /brota en mayo/.test(sin.frase) && /206, 107, 15/.test(sin.color) && page.errores.length === 0, 'sin js/roble.js: el roble del logo, entero y en su ocre, con la frase de respaldo (sin inventar la de hoy)', sin);
  await c.close();
}

/* ================= 3. el camín: la línea y sus mojones ================= */
if (toca(3)) {
  console.log('\n3. El camín: un trazo continuo con los mojones en su kilómetro');
  const { ctx: c, page } = await nueva();
  await ir(page, PAG + `&fecha=${HOY}`);
  await page.waitForFunction(() => document.querySelector('#camin[data-montado]'));
  // se baja hasta el final para que todo esté montado y la página tenga su alto definitivo
  for (const s of ['#distancias', '#reservar', '#pie']) { await page.evaluate((x) => document.querySelector(x).scrollIntoView(), s); await page.waitForTimeout(350); }
  await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(400);
  const g = await page.evaluate(() => {
    const inst = [...window.Camin.web.montados].find(([el]) => el.id === 'camin')[1].inst, geo = inst.geometria();
    const caja = document.querySelector('#camin').getBoundingClientRect(), top = (s) => document.querySelector(s).getBoundingClientRect().top - caja.top;
    const lug = document.querySelector('#lugar').getBoundingClientRect();
    return { geo, suelo: top('#suelo'), fin: top('#suelo-fin'), lug: [lug.top - caja.top, lug.bottom - caja.top], n: document.querySelectorAll('.mojon').length, textos: [...document.querySelectorAll('.mojon')].map((m) => m.textContent), d: document.querySelector('.camin__andado').getAttribute('d').length, zLug: getComputedStyle(document.querySelector('#lugar')).zIndex, zCam: getComputedStyle(document.querySelector('#camin')).zIndex, radio: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--camin-radio')), vis: getComputedStyle(document.querySelector('.mojon')).display };
  });
  comprobar(g.n === CAMIN.hitos.length && g.textos.every((t, i) => t.includes('km ' + kmTxt(CAMIN.hitos[i].km)) && (i === 0 || t.includes(CAMIN.hitos[i].nombre))) && g.vis === 'flex', `${g.n} mojones: cada uno con su km y su nombre de lugar-camin.json`, g.textos.slice(0, 4));
  comprobar(Math.abs(g.geo.y0 - g.suelo - 1) <= 2 && Math.abs(g.geo.y1 - g.fin - 1) <= 2 && g.d > 2000, 'la línea sale de la línea de suelo de la portada y llega a la del robledal del pie, en un solo trazo', { y0: g.geo.y0, suelo: g.suelo, y1: g.geo.y1, fin: g.fin });
  const M = g.geo.mojones, hueco = g.lug[1] - g.lug[0];
  const util = (g.geo.y1 - g.radio) - (g.geo.y0 + g.radio) - hueco;
  const esperado = M.map((m) => { const y = g.geo.y0 + g.radio + (m.km / CAMIN.kmTotal) * util; return y >= g.lug[0] ? y + hueco : y; });
  comprobar(M.every((m, i) => Math.abs(m.y - esperado[i]) < 1.5) && M.every((m, i) => i === 0 || m.y > M[i - 1].y), 'cada mojón cae en su kilómetro, a escala, a lo largo de la página (ninguno colocado a mano)', M.map((m, i) => [m.km, Math.round(m.y), Math.round(esperado[i])]).slice(0, 5));
  comprobar(M.every((m) => m.y < g.lug[0] + 1 || m.y > g.lug[1] - 1) && +g.zLug > +g.zCam, 'ningún mojón queda tapado por #lugar: ese tramo no cuenta y #lugar va por encima de la línea');
  // el caminante: con la rueda
  const kms = [];
  for (let i = 0; i < 9; i++) { await page.mouse.wheel(0, 900); await page.waitForTimeout(160); kms.push(await page.evaluate(() => ({ km: document.querySelector('#cab-km-n').textContent, off: parseFloat(document.querySelector('.camin__andado').style.strokeDashoffset), pas: document.querySelectorAll('.mojon.es-pasado').length, rot: document.querySelector('.caminante span').textContent }))); }
  const nums = kms.map((k) => parseFloat(k.km.replace(',', '.')));
  comprobar(nums.every((v, i) => i === 0 || v >= nums[i - 1]) && nums[8] > nums[0] && kms.every((k, i) => i === 0 || k.off <= kms[i - 1].off + 0.5) && kms.every((k) => k.rot === 'km ' + k.km), `al bajar, el km de la cabecera y del caminante sube (${kms[0].km} → ${kms[8].km}) y el trazo andado crece`, kms.map((k) => k.km));
  comprobar(kms.every((k, i) => k.pas >= CAMIN.hitos.filter((h) => h.km <= nums[i] - 0.08).length && k.pas <= CAMIN.hitos.filter((h) => h.km <= nums[i] + 0.08).length), 'los mojones pasados son los de km menor o igual que el del caminante', kms.map((k) => [k.km, k.pas]));
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await page.waitForTimeout(400);
  const fin = await page.evaluate(() => ({ km: document.querySelector('#cab-km-n').textContent, pas: document.querySelectorAll('.mojon.es-pasado').length, kmVis: getComputedStyle(document.querySelector('#cab-km')).display }));
  comprobar(fin.km === KM && fin.pas === CAMIN.hitos.length && fin.kmVis !== 'none', `al final de la página, km ${fin.km}: Tablizas, y todos los mojones pasados`, fin);
  comprobar(page.errores.length === 0, 'sin errores en la consola', page.errores);
  await c.close();
  const mv = await nueva({ viewport: { width: 390, height: 844 }, movil: true, touch: true });
  await ir(mv.page, PAG);
  await mv.page.waitForFunction(() => document.querySelector('#camin[data-montado]'));
  await mv.page.evaluate(() => scrollTo(0, 2600)); await mv.page.waitForTimeout(400);
  const m2 = await mv.page.evaluate(() => { const c2 = document.querySelector('#camin').getBoundingClientRect(), t = document.querySelector('.casa .sec-tit').getBoundingClientRect(); return { moj: getComputedStyle(document.querySelector('.mojon')).display, ancho: c2.width, der: c2.right, txt: t.left, km: document.querySelector('#cab-km-n').textContent, cam: getComputedStyle(document.querySelector('.caminante')).opacity }; });
  comprobar(m2.moj === 'none' && m2.der <= m2.txt + 1 && m2.cam === '1' && parseFloat(m2.km.replace(',', '.')) > 0, `móvil: la línea va por su carril (${Math.round(m2.ancho)} px) sin pisar el texto, sin rótulos, y la cabecera dice el km (${m2.km})`, m2);
  await mv.ctx.close();
}

/* ================= 4. la casa y los tres apartamentos ================= */
if (toca(4)) {
  console.log('\n4. La casa y los tres apartamentos');
  const { ctx: c, page } = await nueva();
  await ir(page, PAG);
  await page.evaluate(() => document.querySelector('#casa').scrollIntoView());
  await page.waitForFunction(() => { const i = document.querySelector('.casa__foto img'); return i.complete && i.naturalWidth > 0; });
  const casa = await page.evaluate(() => { const i = document.querySelector('.casa__foto img'), r = i.getBoundingClientRect(); return { nat: i.naturalWidth, w: r.width, blend: getComputedStyle(i).mixBlendMode, actual: i.currentSrc, mat: document.querySelectorAll('.casa__materiales > div').length, der: Math.round(document.documentElement.clientWidth - r.right) }; });
  comprobar(casa.nat >= casa.w && casa.w > 600 && casa.blend === 'multiply' && casa.mat === 4 && casa.der <= 1, `la fachada, grande (${Math.round(casa.w)} px de ancho, servida a ${casa.nat}) y nítida, hasta el borde, con el cielo fundido con la página`, casa);
  await page.evaluate(() => document.querySelector('#apartamentos').scrollIntoView());
  await page.waitForTimeout(200);
  const a0 = await page.evaluate(() => [...document.querySelectorAll('.piso')].map((p) => ({ id: p.dataset.piso, abierto: p.classList.contains('es-abierto'), w: p.getBoundingClientRect().width, cuerpo: getComputedStyle(p.querySelector('.piso__cuerpo')).display, borde: getComputedStyle(p).borderTopColor })));
  comprobar(a0.length === 3 && a0[0].abierto && a0[0].w > a0[1].w * 2.5 && a0[1].cuerpo === 'none' && new Set(a0.map((x) => x.borde)).size === 3, 'tres fichas en fila: Carujo abierta y las otras dos en resumen, cada una con su color', a0);
  await page.click('.piso--fonrin .piso__abrir');
  await page.waitForTimeout(900);
  const a1 = await page.evaluate(() => ({ p: [...document.querySelectorAll('.piso')].map((p) => ({ abierto: p.classList.contains('es-abierto'), w: Math.round(p.getBoundingClientRect().width), cuerpo: getComputedStyle(p.querySelector('.piso__cuerpo')).display, exp: p.querySelector('.piso__abrir').getAttribute('aria-expanded') })), foco: document.activeElement.id, foto: (() => { const i = document.querySelector('.piso--fonrin img'); return i.getBoundingClientRect().width <= i.naturalWidth + 1 || !i.complete; })(), op: getComputedStyle(document.querySelector('.piso--fonrin .piso__cuerpo')).opacity }));
  comprobar(a1.p[1].abierto && a1.p[1].w > a1.p[0].w * 2.5 && a1.p[0].cuerpo === 'none' && a1.p[1].cuerpo !== 'none' && a1.p[1].exp === 'true' && a1.p[0].exp === 'false' && a1.foco === 't-fonrin' && a1.op === '1' && a1.foto, 'al pulsar Fonrín se abre (y Carujo se recoge), el foco va a su nombre y su foto no se amplía', a1);
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
  const enBtn = await page.evaluate(() => document.activeElement.className + '|' + (document.activeElement.closest('.piso') || {}).id);
  await page.focus('.piso--xelin .piso__abrir'); await page.keyboard.press('Enter'); await page.waitForTimeout(300);
  comprobar(await page.evaluate(() => document.querySelector('.piso--xelin').classList.contains('es-abierto') && document.querySelector('#pisos').dataset.abierto === '2'), 'con teclado (Enter sobre Xelín) también se abre', enBtn);
  await page.click('.piso--xelin [data-reservar]');
  await page.waitForFunction(() => document.querySelector('[data-modulo="reserva"][data-montado]'), null, { timeout: 8000 });
  await page.waitForTimeout(300);
  comprobar(await page.evaluate(() => document.querySelector('.chip--apto[data-apto="xelin"]').getAttribute('aria-checked') === 'true' && Math.abs(document.querySelector('#reservar').getBoundingClientRect().top) < 140), '«Ver fechas» de Xelín baja al calendario con Xelín elegido');
  comprobar(await page.evaluate(() => document.querySelectorAll('.servicios li').length === 12 && [...document.querySelectorAll('.servicios li svg use')].every((u) => document.querySelector(u.getAttribute('href')))), 'doce servicios en tres grupos, cada uno con su icono (ninguno roto)');
  comprobar(page.errores.length === 0, 'sin errores en la consola', page.errores);
  await c.close();
  const mv = await nueva({ viewport: { width: 390, height: 844 }, movil: true, touch: true });
  await ir(mv.page, PAG);
  const am = await mv.page.evaluate(() => [...document.querySelectorAll('.piso')].map((p) => ({ cuerpo: getComputedStyle(p.querySelector('.piso__cuerpo')).display, btn: getComputedStyle(p.querySelector('.piso__abrir')).display, w: p.getBoundingClientRect().width })));
  comprobar(am.every((x) => x.cuerpo !== 'none' && x.btn === 'none' && x.w > 300), 'móvil: las tres fichas abiertas, una debajo de otra', am);
  await mv.ctx.close();
}

/* ================= 5. la visita, el mapa y las cookies ================= */
if (toca(5)) {
  console.log('\n5. La visita 360 y el mapa a petición; cookies');
  const { ctx: c, page } = await nueva({ cookies: true });
  await ir(page, PAG);
  const ck0 = await page.evaluate(() => ({ vis: getComputedStyle(document.querySelector('#cookies')).display, iframes: document.querySelectorAll('iframe').length }));
  comprobar(ck0.vis !== 'none' && ck0.iframes === 0, 'en la primera visita sale el aviso de cookies y no hay ningún iframe', ck0);
  await page.click('#ck-si');
  const ck1 = await page.evaluate((k) => ({ vis: getComputedStyle(document.querySelector('#cookies')).display, v: localStorage.getItem(k) }), LLAVE);
  comprobar(ck1.vis === 'none' && ck1.v === 'si', '«Entendido» lo cierra de verdad y guarda la marca', ck1);
  await page.reload({ waitUntil: 'load' }); await page.waitForFunction(() => window.Camin && window.Camin.web);
  comprobar(await page.evaluate(() => getComputedStyle(document.querySelector('#cookies')).display) === 'none', 'al recargar ya no sale');
  await page.evaluate(() => document.querySelector('#abrir-cookies').scrollIntoView()); await page.click('#abrir-cookies');
  comprobar(await page.evaluate(() => getComputedStyle(document.querySelector('#cookies')).display) !== 'none', '«Preferencias de cookies» lo vuelve a enseñar');
  await page.click('#ck-no');
  await page.evaluate(() => document.querySelector('#dentro').scrollIntoView()); await page.waitForTimeout(200);
  comprobar(/contenido externo/.test(await page.textContent('.visita__aviso')), 'la visita avisa de que es contenido externo de Google, antes de cargarla');
  await page.click('#visita-btn');
  const v = await page.evaluate(() => { const f = document.querySelector('#visita-marco iframe'); return f && { src: f.src, title: f.title, btn: !!document.querySelector('#visita-btn'), w: f.getBoundingClientRect().width }; });
  comprobar(v && v.src.startsWith('https://www.google.com/maps/embed?pb=') && /43\.1516784/.test(v.src) && v.title && !v.btn && v.w > 600, 'al pulsar se crea el iframe de su panorámica de Google', v);
  await page.evaluate(() => document.querySelector('#contacto').scrollIntoView()); await page.waitForTimeout(200);
  await page.click('#mapa-btn');
  const mp = await page.evaluate(() => { const f = document.querySelector('#mapa iframe'); return f && { src: decodeURIComponent(f.src), title: f.title, h: f.getBoundingClientRect().height }; });
  comprobar(mp && /google\.com\/maps\?q=Camín de Muniellos, Penlés, 33814 Cangas del Narcea, Asturias/.test(mp.src) && /output=embed/.test(mp.src) && mp.h > 300, 'el mapa de Google (sin clave) solo se crea al pulsar', mp);
  comprobar(page.errores.length === 0, 'sin errores en la consola', page.errores);
  await c.close();
}

/* ================= 6. el hueco del 3D ================= */
if (toca(6)) {
  console.log('\n6. «De la casa a Muniellos»: el hueco del 3D y su respaldo (sin pintar WebGL)');
  const { ctx: c, page } = await nueva();
  await ir(page, PAG);
  await page.evaluate(() => document.querySelector('#lugar').scrollIntoView()); await page.waitForTimeout(400);
  const l = await page.evaluate(() => {
    const s = document.querySelector('#lugar'), m = s.querySelector('[data-modulo="lugar"]'), cs = getComputedStyle(s), p = s.querySelector('.perfil svg').getBoundingClientRect();
    const lum = (c2) => { const v = c2.match(/[\d.]+/g).slice(0, 3).map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
    const k = (a, b) => { a = lum(a); b = lum(b); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
    return { fondo: cs.backgroundColor, hueco: !!m, montado: m.hasAttribute('data-montado'), perfil: [p.width, p.height], hitos: s.querySelectorAll('.lugar__hitos li').length, kTit: k(getComputedStyle(s.querySelector('.sec-tit')).color, cs.backgroundColor), kSub: k(getComputedStyle(s.querySelector('.sec-sub')).color, cs.backgroundColor), kLista: k(getComputedStyle(s.querySelector('.lugar__hitos small')).color, cs.backgroundColor), canvas: document.querySelectorAll('canvas').length, ancho: s.getBoundingClientRect().width, vw: document.documentElement.clientWidth };
  });
  comprobar(l.hueco && l.fondo === 'rgb(16, 23, 20)' && l.ancho >= l.vw - 1, '#lugar existe con su [data-modulo="lugar"], es oscura y va a sangre', l);
  comprobar(!l.montado && l.perfil[0] > 600 && l.perfil[1] > 150 && l.hitos === CAMIN.hitos.length && l.canvas === 0, `con lugar.js vacío se ve el respaldo: el perfil del camín y sus ${l.hitos} hitos; ningún canvas`, l);
  comprobar(l.kTit >= 7 && l.kSub >= 4.5 && l.kLista >= 4.5, `texto sobre el fondo oscuro: ${l.kTit.toFixed(1)}, ${l.kSub.toFixed(1)} y ${l.kLista.toFixed(1)}`);
  comprobar(page.errores.length === 0, 'sin errores en la consola', page.errores);
  await c.close();
}

/* ================= 7. a cuánto queda ================= */
if (toca(7)) {
  console.log('\n7. A cuánto queda: la regla de kilómetros, el mapa y la ficha');
  const { ctx: c, page } = await nueva();
  await ir(page, PAG);
  await montar(page, '#distancias', 'distancias');
  const ids = DIST.orden;
  const dentro = () => page.evaluate(() => ({ lista: [...document.querySelectorAll('.sitio.es-dentro')].map((b) => b.dataset.sitio).sort(), mapa: [...document.querySelectorAll('.punto.es-dentro')].map((b) => b.dataset.sitio).sort(), regla: [...document.querySelectorAll('.regla__sitio.es-dentro')].map((b) => b.dataset.sitio).sort(), rutas: [...document.querySelectorAll('.ruta.es-dentro')].length, out: document.querySelector('#regla-out').textContent, cuenta: document.querySelector('#regla-cuenta').textContent, v: document.querySelector('#regla-km').value }));
  const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const porKm = (v) => ids.filter((id) => kmSitio(id) <= v).sort(), porMin = (v) => ids.filter((id) => minSitio(id) <= v).sort();
  let d = await dentro();
  comprobar(await page.evaluate(() => document.querySelectorAll('.sitio').length === 13 && document.querySelectorAll('.punto').length === 13 && document.querySelectorAll('.mapa-svg image').length === 2 && document.querySelectorAll('.regla__sitio').length === 13), 'montado: 13 sitios en la lista, 13 mojones en el mapa (sobre los dos relieves) y 13 marcas en la regla');
  comprobar(igual(d.lista, porKm(25)) && igual(d.mapa, d.lista) && igual(d.regla, d.lista) && d.rutas === d.lista.length && d.out === '25 km', `regla en 25 km: se encienden los ${d.lista.length} sitios de hasta 25 km, en la lista, el mapa y la regla`, d);
  await page.evaluate(() => { const r = document.querySelector('#regla-km'); r.value = 8; r.dispatchEvent(new Event('input', { bubbles: true })); });
  d = await dentro();
  comprobar(igual(d.lista, porKm(8)) && igual(d.mapa, d.lista) && d.out === '8 km' && new RegExp(`quedan ${d.lista.length} sitios de 13`).test(d.cuenta), `regla en 8 km: quedan ${d.lista.length} (${d.lista.join(', ')})`, d);
  await page.focus('#regla-km'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
  d = await dentro();
  comprobar(d.v === '10' && igual(d.lista, porKm(10)), 'la regla también se mueve con las flechas (8 → 10 km)', d.v);
  await page.evaluate(() => { const r = document.querySelector('#regla-km'); r.value = 2; r.dispatchEvent(new Event('input', { bubbles: true })); });
  d = await dentro();
  comprobar(d.lista.length === 0 && /Nada tan cerca: lo primero es Cangas del Narcea, a 6 km/.test(d.cuenta), `regla en 2 km: «${d.cuenta}»`);
  for (const [min, txt] of [[20, '20 min'], [60, '1 hora'], [90, 'Medio día']]) {
    await page.click(`.regla__presets [data-min="${min}"]`);
    d = await dentro();
    const pul = await page.getAttribute(`.regla__presets [data-min="${min}"]`, 'aria-pressed');
    comprobar(igual(d.lista, porMin(min)) && igual(d.mapa, d.lista) && pul === 'true', `«Tengo ${txt}»: se encienden los ${d.lista.length} sitios a ${min} min o menos de ida${min === 90 ? ' (todos)' : ''}`, d);
  }
  // elegir un sitio: su carretera, sus cifras y su perfil
  const vb0 = await page.getAttribute('.mapa-svg', 'viewBox');
  await page.click('.sitio[data-sitio="tablizas"]');
  await page.waitForTimeout(400);
  let f = await page.evaluate(() => ({ txt: document.querySelector('#ficha').innerText.replace(/\s+/g, ' '), ruta: document.querySelector('.ruta.es-elegida') && document.querySelector('.ruta.es-elegida').dataset.sitio, off: getComputedStyle(document.querySelector('.ruta.es-elegida')).strokeDashoffset, pul: document.querySelector('.sitio[data-sitio="tablizas"]').getAttribute('aria-pressed'), vb: document.querySelector('.mapa-svg').getAttribute('viewBox'), perfil: !!document.querySelector('#ficha .ficha__perfil svg path.l'), foto: !!document.querySelector('#ficha .ficha__foto img'), maps: document.querySelector('#ficha .ficha__ir a').href, punto: document.querySelector('.punto.es-elegido').dataset.sitio }));
  comprobar(f.ruta === 'tablizas' && f.punto === 'tablizas' && f.pul === 'true' && parseFloat(f.off) === 0 && f.vb !== vb0, 'al elegir Tablizas se dibuja su carretera desde la casa y el mapa se acerca', f);
  comprobar(f.txt.includes(`${KM} km`) && f.txt.includes(`${CAMIN.minutos} min en coche`) && /AS-15, AS-348/.test(f.txt) && /mismo kilómetro que marca su mojón/.test(f.txt) && f.perfil && /Sube [\d.]+ m y baja/.test(f.txt) && f.foto && /maps\/dir\/\?api=1&origin=43\.15/.test(f.maps), `la ficha: ${KM} km y ${CAMIN.minutos} min (los del camín), carreteras, perfil de altura, foto con crédito y la ruta en Google Maps`, f.txt.slice(0, 200));
  await page.click('.sitio[data-sitio="oviedo"]'); await page.waitForTimeout(300);
  f = await page.evaluate(() => document.querySelector('#ficha').innerText.replace(/\s+/g, ' '));
  comprobar(f.includes(`${kmTxt(DIST.sitios.oviedo.km)} km`) && f.includes(tiempoTxt(DIST.sitios.oviedo.minutos).replace(' min', '')) && await page.evaluate(() => document.querySelectorAll('.ruta.es-elegida').length === 1), `Oviedo: ${kmTxt(DIST.sitios.oviedo.km)} km y ${tiempoTxt(DIST.sitios.oviedo.minutos)} (OSRM), y una sola ruta elegida`, f.slice(0, 120));
  await page.click('.sitio[data-sitio="oviedo"]'); await page.waitForTimeout(200);
  comprobar(await page.evaluate(() => document.querySelectorAll('.ruta.es-elegida').length === 0 && /Elige un sitio/.test(document.querySelector('#ficha').textContent)), 'pulsarlo otra vez lo suelta');
  // teclado: la lista es una sola parada y se recorre con flechas
  await page.focus(`.sitio[data-sitio="${ids[0]}"]`);
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  const t = await page.evaluate(() => ({ tab: document.querySelectorAll('.sitio[tabindex="0"]').length, foco: document.activeElement.dataset.sitio, elegido: (document.querySelector('.sitio[aria-pressed="true"]') || {}).dataset }));
  comprobar(t.tab === 1 && t.foco === ids[2] && t.elegido && t.elegido.sitio === ids[2], `teclado: dos flechas abajo y Enter eligen ${DIST.sitios[ids[2]].nombre}; una sola parada de tabulación en la lista`, t);
  comprobar(await page.evaluate(() => document.querySelectorAll('.mapa-tabla table tbody tr').length === 13), 'la tabla sigue entera en «Ver todo en una tabla»');
  comprobar(page.errores.length === 0, 'sin errores en la consola', page.errores);
  await c.close();
  // táctil
  const mv = await nueva({ viewport: { width: 390, height: 844 }, movil: true, touch: true });
  await ir(mv.page, PAG);
  await montar(mv.page, '#distancias', 'distancias');
  await mv.page.evaluate(() => document.querySelector('.mapa-lienzo').scrollIntoView({ block: 'center' })); await mv.page.waitForTimeout(300);
  const pt = await mv.page.evaluate(() => { const r = document.querySelector('.punto[data-sitio="besullo"] .punto__m').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await mv.page.touchscreen.tap(pt[0], pt[1]); await mv.page.waitForTimeout(300);
  const tm = await mv.page.evaluate(() => ({ e: (document.querySelector('.punto.es-elegido') || {}).dataset, f: document.querySelector('#ficha').textContent, sw: document.documentElement.scrollWidth, w: document.documentElement.clientWidth }));
  comprobar(tm.e && tm.e.sitio === 'besullo' && /Besullo/.test(tm.f) && tm.sw <= tm.w, 'táctil: tocar el mojón de Besullo en el mapa lo elige; sin scroll horizontal', tm.e);
  await mv.ctx.close();
  // sin el módulo: se queda la tabla
  const sm = await nueva();
  await sm.ctx.route('**/js/distancias.js*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  await ir(sm.page, PAG);
  await sm.page.evaluate(() => document.querySelector('#distancias').scrollIntoView()); await sm.page.waitForTimeout(500);
  comprobar(await sm.page.evaluate(() => { const t2 = document.querySelector('.dist__tabla'); return t2.getBoundingClientRect().height > 300 && t2.querySelectorAll('tbody tr').length === 13 && !document.querySelector('.mapa-svg'); }) && sm.page.errores.length === 0, 'si falla js/distancias.js, queda la tabla con los 13 sitios y ningún error');
  await sm.ctx.close();
}

/* ================= 8. Muniellos y lo de casa ================= */
if (toca(8)) {
  console.log('\n8. Muniellos, veinte al día: lo práctico y el horario del mes en curso');
  const { ctx: c, page } = await nueva();
  for (const [f, mes, cierra, martes] of [[HOY, 'noviembre', '17:15', true], ['2026-07-10', 'julio', '19:15', false], ['2026-10-03', 'octubre', '18:15', false], ['2027-02-14', 'febrero', '18:15', true]]) {
    await ir(page, PAG + `&fecha=${f}`);
    const h = await page.evaluate(() => ({ hoy: document.querySelector('#horario-hoy').textContent, oculto: document.querySelector('#horario-hoy').hidden, barras: [...document.querySelectorAll('.muni__anio li.es-ahora')].map((l) => l.dataset.mes), filas: [...document.querySelectorAll('.muni__tabla tr')].filter((tr) => tr.getBoundingClientRect().height > 0).length, marcadas: document.querySelectorAll('.muni__tabla tr.es-ahora').length }));
    comprobar(!h.oculto && h.hoy.includes(`Este mes, ${mes}: de 8:45 a ${cierra}.`) && /martes, cerrado/.test(h.hoy) === martes && h.barras.length === 1 && h.filas === 5 && h.marcadas === 1, `?fecha=${f}: «${h.hoy}» y siguen a la vista las 5 filas del horario`, h);
  }
  const m = await page.evaluate(() => ({ cupo: document.querySelector('.muni__cupo .cifra').textContent, pasos: [...document.querySelectorAll('.pasos > li h3')].map((x) => x.textContent), of: document.querySelector('.pasos a.enlace').href, target: document.querySelector('.pasos a.enlace').target, rutas: [...document.querySelectorAll('.senda')].map((r) => r.innerText.replace(/\s+/g, ' ')), mojones: getComputedStyle(document.querySelector('#mojones-tabla')).display, vistazo: getComputedStyle(document.querySelector('#vistazo')).display, miel: document.querySelectorAll('.decasa__foto img').length, notas: document.querySelectorAll('.nota').length }));
  comprobar(m.cupo === '20' && m.pasos.length === 4 && m.of === D.muniellos.oficial && m.target === '_blank', `cupo 20, cuatro pasos (${m.pasos.join(' · ')}) y el enlace oficial del Principado en otra pestaña`, m.of);
  comprobar(m.rutas.length === 2 && /Fonculebrera.*20 km.*De 7 a 9 horas.*Alta/.test(m.rutas[0]) && /Ruta del río.*De 12 a 14 km.*De 4 a 5 horas.*Media/.test(m.rutas[1]), 'las dos rutas con km, horas y dificultad', m.rutas);
  comprobar(m.mojones === 'none' && m.vistazo === 'none' && m.miel === 3 && m.notas === 9, 'en la versión «Camín» no salen las tablas de la sobria; tres fotos de la miel y nueve notas del libro');
  await page.evaluate(() => document.querySelector('#libro').scrollIntoView()); await page.waitForTimeout(300);
  const fm = await page.evaluate(async () => { await document.fonts.ready; const p = document.querySelector('.nota blockquote p'); return { fam: getComputedStyle(p).fontFamily, ok: document.fonts.check('24px "Shadows Into Light Two"'), tam: parseFloat(getComputedStyle(p).fontSize) }; });
  comprobar(/Shadows Into Light Two/.test(fm.fam) && fm.ok && fm.tam >= 21, `el libro de visitas va en la manuscrita del logo, cargada desde la propia web (${fm.tam} px)`, fm);
  comprobar(page.errores.length === 0, 'sin errores en la consola', page.errores);
  await c.close();
}

/* ================= 9. reservar: ocupación real y salto a su motor ================= */
if (toca(9)) {
  console.log('\n9. Reservar: la ocupación real y el salto a su motor (sin enviar nada)');
  const { ctx: c, page } = await nueva();
  const desde = DISPO.desde;
  const antes = externas.length;
  await ir(page, PAG + `&fecha=${desde}`);
  await montar(page, '#reservar', 'reserva');
  const DIA = 864e5, t0 = Date.parse(desde + 'T00:00:00Z'), iso = (i) => new Date(t0 + i * DIA).toISOString().slice(0, 10);
  const L = DISPO.apartamentos, A = ['carujo', 'fonrin', 'xelin'];
  const libreTodos = (i) => A.some((k) => L[k].libre[i] === '1');
  const r0 = await page.evaluate(() => ({ leido: document.querySelector('.cal__leido').textContent, time: document.querySelector('.cal__leido time').getAttribute('datetime'), meses: [...document.querySelectorAll('.mes h4')].map((h) => h.textContent), aviso: (document.querySelector('.cal__aviso') || {}).textContent, pista: document.querySelector('#cal-pista').textContent, tab: document.querySelectorAll('.dia[tabindex="0"]').length, min: document.querySelector('#cal-resumen').textContent }));
  const fechaLeida = new Date(DISPO.leido).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' });
  comprobar(/Ocupación real/.test(r0.leido) && r0.leido.includes(fechaLeida) && / a las \d\d:\d\d/.test(r0.leido) && r0.time === DISPO.leido, `a la vista: «Ocupación real. Leída de su motor de reservas el ${fechaLeida} a las …»`, r0.leido);
  comprobar(r0.meses.length === 2 && r0.tab === 1 && /Elige el día de llegada/.test(r0.pista) && /Estancia mínima según su motor/.test(r0.min), `dos meses (${r0.meses.join(' y ')}), una sola parada de tabulación y la estancia mínima del motor`, r0);
  // cada día del primer mes coincide con la lectura
  const dias = await page.evaluate(() => [...document.querySelectorAll('.dia')].map((d) => ({ f: d.dataset.f, no: d.classList.contains('es-no'), pas: d.classList.contains('es-pasado'), marcas: [...d.querySelectorAll('.dia__aptos i')].map((i) => i.className) })));
  const malos = dias.filter((d) => { const i = Math.round((Date.parse(d.f + 'T00:00:00Z') - t0) / DIA); if (i < 0) return !d.pas; if (i >= DISPO.dias) return !d.no; const esperado = A.map((k) => (L[k].libre[i] === '1' ? k[0] : 'no')); return d.no === libreTodos(i) || (d.marcas.length === 3 && JSON.stringify(d.marcas) !== JSON.stringify(esperado)); });
  comprobar(dias.length >= 59 && malos.length === 0, `los ${dias.length} días pintados coinciden con la lectura (libre u ocupado, y las tres marcas por apartamento)`, malos.slice(0, 3));
  // una estancia válida: la primera pareja de noches libres con mínimo 2
  let a = -1; for (let i = 1; i < 60; i++) if (A.every((k) => L[k].libre[i] === '1' && L[k].libre[i + 1] === '1' && L[k].min[i] === '2' && L[k].sinEntrada[i] === '0' && L[k].sinSalida[i + 2] === '0')) { a = i; break; }
  await page.click(`.dia[data-f="${iso(a)}"]`);
  const p1 = await page.evaluate(() => ({ pista: document.querySelector('#cal-pista').textContent, res: document.querySelector('#cal-resumen').textContent, foco: document.activeElement.dataset.f }));
  await page.click(`.dia[data-f="${iso(a + 2)}"]`);
  const p2 = await page.evaluate(() => { const b = document.querySelector('#cal-ir'); return { res: document.querySelector('#cal-resumen').innerText.replace(/\s+/g, ' '), href: b && b.href, target: b && b.target, rel: b && b.rel, entre: document.querySelectorAll('.dia.es-entre').length, ll: (document.querySelector('.dia.es-llegada') || {}).dataset, sa: (document.querySelector('.dia.es-salida') || {}).dataset }; });
  const url = `https://camindemuniellos.com/resultados-de-busqueda/?mphb_check_in_date=${iso(a)}&mphb_check_out_date=${iso(a + 2)}&mphb_adults=2&mphb_children=0`;
  comprobar(/Ahora, el día de salida/.test(p1.pista) && /estancia mínima es de 2 noches/.test(p1.res) && p1.foco === iso(a), 'tras la llegada pide la salida, dice la estancia mínima de ese día y el foco sigue en el día', p1);
  comprobar(p2.href === url && p2.target === '_blank' && /noopener/.test(p2.rel) && /2 noches/.test(p2.res) && /Libres esas noches: Carujo, Fonrín y Xelín/.test(p2.res) && p2.entre === 1 && p2.ll.f === iso(a) && p2.sa.f === iso(a + 2), `2 noches → «Reservar en su web» abre su buscador con las fechas (${iso(a)} a ${iso(a + 2)}), en otra pestaña`, p2);
  await page.selectOption('#cal-adultos', '3'); await page.selectOption('#cal-ninos', '1');
  comprobar((await page.getAttribute('#cal-ir', 'href')).endsWith('mphb_adults=3&mphb_children=1'), 'adultos y niños viajan en el enlace');
  // estancia que cruza noches ocupadas
  let o = -1, ll = -1; for (let i = 3; i < 60 && o < 0; i++) if (!libreTodos(i) && libreTodos(i - 1)) { for (let j = i - 1; j >= Math.max(1, i - 6); j--) if (libreTodos(j) && A.every((k) => L[k].sinEntrada[j] === '0')) { o = i; ll = j; break; } }
  if (o > 0) {
    let fin2 = o; while (!libreTodos(fin2)) fin2++;
    await page.click('#cal-limpiar');
    await page.click(`.dia[data-f="${iso(ll)}"]`); await page.click(`.dia[data-f="${iso(fin2 + 1)}"]`);
    const e = await page.evaluate(() => ({ err: (document.querySelector('#cal-resumen .es-error') || {}).textContent, ir: !!document.querySelector('#cal-ir') }));
    comprobar(/noches ocupadas/.test(e.err || '') && !e.ir, `una estancia que cruza las noches ocupadas (${iso(o)}…) no se deja: «${e.err}»`, e);
    await page.click(`.dia[data-f="${iso(o)}"]`);
    const e2 = await page.evaluate(() => ({ err: (document.querySelector('#cal-resumen .es-error') || {}).textContent, ll: !!document.querySelector('.dia.es-llegada') }));
    nota(`tocar una noche ocupada como llegada: «${e2.err || 'sin aviso'}»`);
  } else nota('no hay noches ocupadas en los primeros 80 días de la lectura: no se prueba el cruce');
  // estancia mínima de 3 noches
  let m3 = -1; for (let i = 1; i < 90; i++) if (A.every((k) => L[k].min[i] === '3' && L[k].libre[i] === '1' && L[k].libre[i + 1] === '1' && L[k].sinEntrada[i] === '0' && L[k].sinSalida[i + 2] === '0')) { m3 = i; break; }
  if (m3 > 0) {
    await page.evaluate(() => { const b = document.querySelector('#cal-limpiar'); if (b) b.click(); });
    while (!(await page.$(`.dia[data-f="${iso(m3 + 2)}"]`))) await page.click('#cal-sig');
    await page.click(`.dia[data-f="${iso(m3)}"]`); await page.click(`.dia[data-f="${iso(m3 + 2)}"]`);
    const e = await page.evaluate(() => ({ err: (document.querySelector('#cal-resumen .es-error') || {}).textContent, ir: !!document.querySelector('#cal-ir') }));
    comprobar(/estancia mínima es de 3 noches/.test(e.err || '') && !e.ir, `la estancia mínima del motor se respeta (llegando el ${iso(m3)} pide 3 noches)`, e);
  } else nota('la lectura no trae días con mínimo de 3 noches');
  // el final sin fechas
  const cierre = (() => { let k = DISPO.dias; while (k > 0 && !libreTodos(k - 1)) k--; return k; })();
  if (DISPO.dias - cierre >= 45) {
    const dC = new Date(t0 + cierre * DIA), MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    for (let k = 0; k < 14 && !(await page.isDisabled('#cal-sig')); k++) await page.click('#cal-sig');
    const fin = await page.evaluate(() => ({ meses: [...document.querySelectorAll('.mes h4')].map((h) => h.textContent), sig: document.querySelector('#cal-sig').disabled }));
    comprobar(r0.aviso && r0.aviso.includes(`Desde el ${dC.getUTCDate()} de ${MES[dC.getUTCMonth()]} de ${dC.getUTCFullYear()}, su motor todavía no ofrece fechas`) && fin.sig && fin.meses[fin.meses.length - 1].startsWith(MES[dC.getUTCMonth()]), `desde el ${dC.getUTCDate()} de ${MES[dC.getUTCMonth()]} de ${dC.getUTCFullYear()} el motor no da nada libre: se dice así y el calendario no sigue más allá`, fin);
  }
  // filtro por apartamento y teclado
  while (!(await page.isDisabled('#cal-ant'))) await page.click('#cal-ant');
  await page.click('.chip--apto[data-apto="fonrin"]');
  comprobar(await page.evaluate(() => document.querySelector('.chip--apto[data-apto="fonrin"]').getAttribute('aria-checked') === 'true' && document.querySelectorAll('.chip--apto[aria-checked="true"]').length === 1), 'se puede mirar un apartamento solo (Fonrín)');
  await page.focus('.dia[tabindex="0"]');
  const f0 = await page.evaluate(() => document.activeElement.dataset.f);
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowDown');
  const f1 = await page.evaluate(() => ({ f: document.activeElement.dataset.f, tab: document.querySelectorAll('.dia[tabindex="0"]').length }));
  comprobar(f1.f === new Date(Date.parse(f0 + 'T00:00:00Z') + 8 * DIA).toISOString().slice(0, 10) && f1.tab === 1, `teclado: flecha derecha y flecha abajo llevan del ${f0} al ${f1.f}`, f1);
  comprobar(externas.slice(antes).filter((u) => /camindemuniellos/.test(u)).length === 0, 'la página no ha hecho ninguna petición a la web de la casa (solo prepara el enlace)');
  comprobar(page.errores.length === 0, 'sin errores en la consola', page.errores);
  await c.close();
}

/* ================= 10. móvil ================= */
if (toca(10)) {
  console.log('\n10. Móvil: menú, anchos y la barra del navegador');
  const { ctx: c, page } = await nueva({ viewport: { width: 390, height: 844 }, movil: true, touch: true });
  await ir(page, PAG);
  await page.evaluate(() => scrollTo(0, 900)); await page.waitForTimeout(300);
  await page.click('#menu-btn');
  await page.waitForTimeout(450);
  const mn = await page.evaluate(() => { const m = document.querySelector('#menu-movil'), r = m.getBoundingClientRect(), b = document.querySelector('#menu-btn').getBoundingClientRect(); const arriba = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return { sc: document.querySelector('#cab').classList.contains('sc'), h: r.height, top: r.top, vis: getComputedStyle(m).visibility, exp: document.querySelector('#menu-btn').getAttribute('aria-expanded'), btnArriba: !!arriba.closest('#menu-btn'), enlaces: m.querySelectorAll('nav a').length, ih: innerHeight }; });
  comprobar(mn.sc && mn.vis === 'visible' && mn.exp === 'true' && Math.abs(mn.h - mn.ih) < 2 && Math.abs(mn.top) < 1 && mn.enlaces === 8, 'el menú se abre a pantalla completa con la cabecera ya fija (backdrop-filter)', mn);
  comprobar(mn.btnArriba, 'el botón del menú queda por encima del panel (se puede cerrar)');
  await page.click('#menu-btn'); await page.waitForTimeout(450);
  comprobar(await page.evaluate(() => getComputedStyle(document.querySelector('#menu-movil')).visibility === 'hidden' && document.querySelector('#menu-btn').getAttribute('aria-expanded') === 'false'), 'y se cierra');
  await page.click('#menu-btn'); await page.waitForTimeout(400);
  await page.click('#menu-movil nav a[href="#muniellos"]'); await page.waitForTimeout(500);
  comprobar(await page.evaluate(() => !document.body.classList.contains('menu') && Math.abs(document.querySelector('#muniellos').getBoundingClientRect().top) < 120), 'un enlace del menú lo cierra y lleva a su sección');
  // anchos: se recorre la página entera
  const alto = await page.evaluate(() => document.documentElement.scrollHeight);
  let peor = null;
  for (let y = 0; y < alto; y += 1500) { await page.evaluate((yy) => scrollTo(0, yy), y); await page.waitForTimeout(120); const d = await sinDesborde(page); if (d.sw > d.w || d.anchos.length) { peor = { y, ...d }; break; } }
  comprobar(!peor, 'toda la página a 390 px: sin scroll horizontal y nada se sale por los lados (con los módulos montados)', peor);
  const peq = await page.evaluate(() => [...document.querySelectorAll('main a.btn, main button, .cab__reservar, #menu-btn')].filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && (r.height < 40 || r.width < 40) && !b.closest('.sitios, .mes__dias'); }).map((b) => b.className + ' ' + Math.round(b.getBoundingClientRect().height)).slice(0, 5));
  comprobar(peq.length === 0, 'botones de al menos 40 px de alto para el dedo', peq);
  const diaAlto = await page.evaluate(() => { const d = document.querySelector('.dia'); return d ? d.getBoundingClientRect().height : 0; });
  comprobar(diaAlto >= 40, `los días del calendario miden ${Math.round(diaAlto)} px en el móvil`);
  // la barra del navegador: cambia el alto, mismo ancho → no se rehace nada ni se mueve nada
  await page.addStyleTag({ content: '.portada{min-height:844px !important;--arbol-alto:287px !important}' });
  await page.waitForTimeout(500);
  const medir = () => page.evaluate(() => { const inst = [...window.Camin.web.montados].find(([el]) => el.id === 'camin')[1].inst.geometria(); return { y0: inst.y0, y1: inst.y1, res: document.querySelector('#reservar').getBoundingClientRect().top + scrollY, mun: document.querySelector('#muniellos').getBoundingClientRect().top + scrollY }; });
  await page.evaluate(() => scrollTo(0, 3000)); await page.waitForTimeout(300);
  const b0 = await medir();
  await page.setViewportSize({ width: 390, height: 900 }); await page.waitForTimeout(450);
  const b1 = await medir();
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(450);
  const b2 = await medir();
  comprobar(JSON.stringify(b0) === JSON.stringify(b1) && JSON.stringify(b0) === JSON.stringify(b2), 'al salir y esconderse la barra del navegador (alto ±56 px) no se mueve nada ni se vuelve a trazar el camín', [b0, b1]);
  comprobar(page.errores.length === 0, 'sin errores en la consola', page.errores);
  await c.close();
}

/* ================= 11. sin JS, legales y 404 ================= */
if (toca(11)) {
  console.log('\n11. Sin JavaScript, páginas legales y 404');
  const { ctx: c, page } = await nueva({ sinJs: true, cookies: true });
  await page.goto(PAG, { waitUntil: 'load' });
  const s = await page.evaluate(() => {
    const vis = (q) => { const e = document.querySelector(q); return !!e && e.getBoundingClientRect().height > 0 && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).opacity !== '0'; };
    return { secciones: [...document.querySelectorAll('main > section')].filter((x) => x.getBoundingClientRect().height > 100).length, hojas: getComputedStyle(document.querySelector('.roble__hojas')).opacity, tit: vis('.portada__tit'), tabla: document.querySelectorAll('.dist__tabla tbody tr').length, tablaVis: vis('.dist__tabla'), pisos: [...document.querySelectorAll('.piso__cuerpo')].filter((p) => getComputedStyle(p).display !== 'none').length, motor: (document.querySelector('.cal__respaldo a') || {}).href, ck: getComputedStyle(document.querySelector('#cookies')).display, mando: getComputedStyle(document.querySelector('#mando')).display, perfil: vis('.perfil svg'), linea: getComputedStyle(document.querySelector('#camin'), '::before').borderLeftStyle, horario: document.querySelectorAll('.muni__tabla tr').length, notas: vis('.nota'), cond: vis('.condiciones') };
  });
  comprobar(s.secciones === 11 && s.tit && s.hojas === '1' && s.pisos === 3 && s.notas && s.cond, 'sin JS se leen las 11 secciones: el roble entero, las tres fichas abiertas, el libro y las condiciones', s);
  comprobar(s.tabla === 13 && s.tablaVis && s.perfil && s.horario === 5 && s.linea === 'dashed', 'sin JS: la tabla de distancias, el perfil del camín, el horario completo y una línea sencilla en el margen', s);
  comprobar(s.motor === 'https://camindemuniellos.com/resultados-de-busqueda/' && s.ck === 'none' && s.mando === 'none', 'sin JS: «Reservar» lleva a su motor; ni aviso de cookies ni mando (no harían nada)', s);
  for (const f of ['aviso-legal.html', 'privacidad.html', 'cookies.html', 'accesibilidad.html']) {
    await page.goto(BASE + f, { waitUntil: 'load' });
    const l = await page.evaluate(() => ({ h1: document.querySelector('h1').textContent, marca: !!document.querySelector('.legal-marca svg'), sw: document.documentElement.scrollWidth, w: document.documentElement.clientWidth, fam: getComputedStyle(document.querySelector('h1')).fontFamily, pie: document.querySelectorAll('.legal-pie a').length }));
    comprobar(l.h1.length > 5 && l.marca && l.sw <= l.w && /Readex Pro/.test(l.fam) && l.pie === 4, `${f}: «${l.h1}», con la marca, la misma letra y los cuatro enlaces`);
  }
  await page.goto(BASE + '404.html', { waitUntil: 'load' });
  const n = await page.evaluate(() => ({ h1: document.querySelector('h1').textContent, hojas: getComputedStyle(document.querySelector('.roble__hojas')).display, ramas: document.querySelector('.roble__rama--0').getBoundingClientRect().height, enlaces: [...document.querySelectorAll('.no__acc a')].map((a) => a.getAttribute('href')), sw: document.documentElement.scrollWidth, w: document.documentElement.clientWidth }));
  comprobar(/no pasa el camín/.test(n.h1) && n.hojas === 'none' && n.ramas > 100 && n.enlaces.includes('./') && n.enlaces.includes('./#reservar') && n.sw <= n.w, '404: «Por aquí no pasa el camín», con el roble sin hoja y las dos salidas', n);
  await c.close();
}

/* ================= 12. foco, contraste, mando de maqueta y rendimiento ================= */
if (toca(12)) {
  console.log('\n12. Foco con forma de mojón, contraste medido, mando de maqueta y rendimiento');
  const { ctx: c, page } = await nueva();
  await ir(page, PAG);
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
  await page.waitForTimeout(80);
  const fo = await page.evaluate(() => { const m = document.querySelector('#foco-mojon'), r = m.getBoundingClientRect(), e = document.activeElement.getBoundingClientRect(); return { vis: m.classList.contains('es-visible'), fijo: m.classList.contains('es-fijo'), rodea: r.left <= e.left && r.right >= e.right && r.top <= e.top && r.bottom >= e.bottom - 1, d: m.querySelector('.foco-mojon__marco').getAttribute('d'), suelo: m.querySelector('.foco-mojon__suelo').getAttribute('d'), color: getComputedStyle(m).color, el: document.activeElement.tagName + '.' + document.activeElement.className, outline: getComputedStyle(document.activeElement).outlineColor }; });
  comprobar(fo.vis && fo.rodea && fo.fijo && /A\d/.test(fo.d) && !/Z$/.test(fo.d) && /^M-/.test(fo.suelo), `el foco (${fo.el}) es un mojón: arco arriba, abierto abajo, sobre una línea de suelo que sobresale`, fo);
  const lum = (col) => { const v = col.match(/[\d.]+/g).slice(0, 3).map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
  const kk = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
  comprobar(kk(fo.color, 'rgb(245, 246, 242)') >= 3, `contraste del foco contra el fondo: ${kk(fo.color, 'rgb(245, 246, 242)').toFixed(1)}:1`);
  // contraste real de todos los textos, con todo montado
  for (const s of ['#distancias', '#reservar', '#pie']) { await page.evaluate((x) => document.querySelector(x).scrollIntoView(), s); await page.waitForTimeout(350); }
  const malos = await page.evaluate(() => {
    const lum2 = (c2) => { const m = c2.match(/[\d.]+/g).map(Number); const v = m.slice(0, 3).map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
    // el color pintado detrás: se resuelve con una sonda (los fondos van en color-mix)
    const sonda = document.createElement('canvas').getContext('2d');
    const rgb = (c2) => { sonda.fillStyle = '#000'; sonda.fillStyle = c2; sonda.clearRect(0, 0, 1, 1); sonda.fillRect(0, 0, 1, 1); const d = sonda.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
    const fondo = (el) => { for (let e = el; e; e = e.parentElement) { const b = rgb(getComputedStyle(e).backgroundColor); if (b[3] > 0.95) return `rgb(${b[0]},${b[1]},${b[2]})`; } return 'rgb(245,246,242)'; };
    const out = [];
    document.querySelectorAll('main p, main h1, main h2, main h3, main h4, main dt, main dd, main li, main a, main button, main th, main td, main label, main summary, main figcaption, main small, main span, main b, .pie p, .pie a, .pie h2, .pie button, .cab a').forEach((el) => {
      if (el.closest('.visita, svg, .vh, .camin')) return;
      const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      if (!r.width || !r.height || cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity < 0.99) return;
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return;
      let op = 1; for (let e = el; e; e = e.parentElement) op *= +getComputedStyle(e).opacity;
      const col = rgb(cs.color); const a = lum2(`rgb(${col[0]},${col[1]},${col[2]})`), b = lum2(fondo(el)); const k = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      const grande = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.6 && +cs.fontWeight >= 700);
      if (op < 0.99 || k < (grande ? 3 : 4.5)) out.push(`${el.tagName}.${String(el.className).slice(0, 30)}: ${k.toFixed(2)}${op < 0.99 ? ' (opacidad ' + op.toFixed(2) + ')' : ''} «${el.textContent.trim().slice(0, 26)}»`);
    });
    return [...new Set(out)];
  });
  const tolerados = malos.filter((m) => /\.sitio|opacidad 0\.55/.test(m));
  comprobar(malos.length - tolerados.length === 0, 'todos los textos llegan a AA contra su fondo pintado, medido en el navegador', malos.filter((m) => !tolerados.includes(m)).slice(0, 8));
  if (tolerados.length) nota(`${tolerados.length} sitios «fuera de la regla» van atenuados a propósito (se encienden al entrar): ${tolerados[0]}`);
  await c.close();
  // mando de maqueta
  const sinRev = await nueva({ cookies: true });
  await ir(sinRev.page, PAG + '&densidad=sobria');
  comprobar(await sinRev.page.evaluate(() => document.querySelector('#mando').hidden && getComputedStyle(document.querySelector('#mando')).display === 'none' && !document.documentElement.classList.contains('densidad-sobria')), 'sin ?revision no hay mando ni versión sobria (el enlace del cliente sale limpio)');
  await sinRev.ctx.close();
  const rev = await nueva({ cookies: true });
  await ir(rev.page, PAG + '&revision');
  const m0 = await rev.page.evaluate(() => ({ mando: document.querySelector('#mando').hidden, ck: document.querySelector('#cookies').hidden }));
  await rev.page.click('#ck-si');
  const m1 = await rev.page.evaluate(() => ({ mando: getComputedStyle(document.querySelector('#mando')).display, botones: [...document.querySelectorAll('#mando button')].map((b) => b.textContent + ':' + b.getAttribute('aria-pressed')) }));
  comprobar(m0.mando && !m0.ck && m1.mando !== 'none' && m1.botones.join() === 'Camín:true,Sobria:false', 'con ?revision: el mando se aparta mientras está el aviso de cookies y sale al cerrarlo: «Camín» y «Sobria»', [m0, m1]);
  await rev.page.click('#mando button[data-densidad="sobria"]'); await rev.page.waitForTimeout(400);
  const so = await rev.page.evaluate(() => { const t = document.querySelector('.casa .sec-tit').getBoundingClientRect(); return { cl: document.documentElement.classList.contains('densidad-sobria'), camin: getComputedStyle(document.querySelector('#camin')).display, vistazo: document.querySelector('#vistazo').getBoundingClientRect().height, mojones: document.querySelectorAll('#mojones-tabla tbody tr').length, mojVis: document.querySelector('#mojones-tabla').getBoundingClientRect().height, rol: document.querySelector('#arbol').getAttribute('role'), frase: document.querySelector('#estacion-txt').textContent, url: location.search, sw: document.documentElement.scrollWidth, w: document.documentElement.clientWidth, izq: t.left, suelo: document.querySelector('#suelo').getBoundingClientRect().left }; });
  comprobar(so.cl && so.camin === 'none' && so.rol === null && !/Arrastra/.test(so.frase) && /densidad=sobria/.test(so.url), 'Sobria: se retiran la línea del margen, los mojones y el gesto del roble (queda la hoja de hoy)', so);
  comprobar(so.vistazo > 150 && so.mojVis > 200 && so.mojones === CAMIN.hitos.length && so.sw <= so.w && so.suelo <= 1, `Sobria: a cambio salen dos tablas que la otra no tiene («De un vistazo» y el camín km a km, ${so.mojones} filas); sin desborde`, so);
  await rev.page.click('#mando button[data-densidad="camin"]'); await rev.page.waitForTimeout(500);
  comprobar(await rev.page.evaluate(() => !document.documentElement.classList.contains('densidad-sobria') && !!document.querySelector('#camin[data-montado] .camin__andado') && document.querySelectorAll('.mojon').length > 5 && document.querySelector('#arbol').getAttribute('role') === null && getComputedStyle(document.querySelector('#vistazo')).display === 'none'), 'y se puede volver a «Camín»: vuelve la línea con sus mojones');
  comprobar(rev.page.errores.length === 0, 'sin errores en la consola', rev.page.errores);
  await rev.ctx.close();
  // rendimiento: móvil de gama media (CPU ×4, 4G lenta), escala 1
  const pf = await nueva({ viewport: { width: 412, height: 915 }, movil: true, touch: true });
  const cdp = await pf.ctx.newCDPSession(pf.page);
  await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await pf.page.addInitScript(() => { window.__lcp = 0; window.__lt = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) { window.__lcp = e.startTime; window.__lcpEl = (e.element && (e.element.tagName + '.' + e.element.className)) || ''; } }).observe({ type: 'largest-contentful-paint', buffered: true }); new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push(Math.round(e.duration)); }).observe({ type: 'longtask', buffered: true }); });
  await pf.page.goto(PAG, { waitUntil: 'load' });
  await pf.page.waitForTimeout(1500);
  const r = await pf.page.evaluate(() => ({ lcp: Math.round(window.__lcp), el: window.__lcpEl, lt: window.__lt, cls: performance.getEntriesByType('layout-shift').reduce((s2, e) => s2 + (e.hadRecentInput ? 0 : e.value), 0) }));
  comprobar(r.lcp > 0 && r.lcp < 2500, `LCP ${(r.lcp / 1000).toFixed(2)} s en móvil estrangulado (${r.el}); tareas largas al cargar: ${r.lt.join(', ') || 'ninguna'} ms`, r);
  await pf.ctx.close();
}

/* ================= 13. con movimiento (una vez, al final) ================= */
if (toca(13)) {
  console.log('\n13. Con movimiento: el gesto del roble (ratón y dedo), la página entera y la recarga');
  const { ctx: c, page } = await nueva({ movimiento: true });
  await ir(page, PAG + `&fecha=${HOY}`);
  await page.waitForFunction(() => document.querySelector('#arbol.es-viva'));
  const caja = await page.evaluate(() => { const r = document.querySelector('.roble').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r.width]; });
  await page.mouse.move(caja[0], caja[1]); await page.mouse.down();
  await page.mouse.move(caja[0] + 120, caja[1], { steps: 4 }); await page.mouse.move(caja[0] + 260, caja[1], { steps: 4 });
  const g1 = await page.evaluate(() => ({ v: +document.querySelector('#arbol').getAttribute('aria-valuenow'), frase: document.querySelector('#estacion-txt').textContent, txt: document.querySelector('#arbol').getAttribute('aria-valuetext'), puestas: document.querySelectorAll('.roble .hoja:not(.es-caida)').length, rol: document.querySelector('#arbol').getAttribute('role') }));
  await page.mouse.up();
  await page.waitForFunction(() => document.querySelector('#arbol').getAttribute('aria-valuenow') === '0', null, { timeout: 4000 });
  const g2 = await page.evaluate(() => document.querySelector('#estacion-txt').textContent);
  comprobar(g1.rol === 'slider' && g1.v > 60 && !/noviembre/.test(g1.frase) && /Suelta y vuelve a hoy/.test(g1.frase) && /Finales de noviembre/.test(g2), `arrastrar el roble recorre el año (+${g1.v} días: «${g1.txt}») y al soltar vuelve a hoy`, g1);
  await page.focus('#arbol'); for (let i = 0; i < 16; i++) await page.keyboard.press('ArrowRight');
  const g3 = await page.evaluate(() => ({ v: document.querySelector('#arbol').getAttribute('aria-valuenow'), t: document.querySelector('#arbol').getAttribute('aria-valuetext'), est: document.querySelector('.roble').dataset.estacion }));
  await page.keyboard.press('Home');
  comprobar(g3.v === '160' && /mayo/.test(g3.t) && g3.est === 'brote' && await page.evaluate(() => document.querySelector('#arbol').getAttribute('aria-valuenow') === '0'), `con teclado es un deslizador: 16 flechas → «${g3.t}»; Inicio vuelve a hoy`, g3);
  // se baja con la rueda por toda la página: nada se queda escondido por una animación
  const alto = await page.evaluate(() => document.documentElement.scrollHeight);
  const ocultos = [];
  for (let y = 0; y < alto; y += 500) {
    await page.mouse.wheel(0, 500); await page.waitForTimeout(110);
    const o = await page.evaluate(() => [...document.querySelectorAll('main .sec-tit, main .sec-sub, .pisos, .pasos > li, .senda, .nota, .cal, .condiciones')].filter((e) => { const r = e.getBoundingClientRect(); return r.top > 60 && r.bottom < innerHeight * 0.62 && +getComputedStyle(e).opacity < 0.98; }).map((e) => e.className + ':' + getComputedStyle(e).opacity));
    ocultos.push(...o);
  }
  comprobar(ocultos.length === 0, 'al bajar con la rueda, todo lo que queda en la mitad alta de la pantalla está entero (ninguna entrada se queda a medias)', [...new Set(ocultos)].slice(0, 5));
  comprobar(await page.evaluate(() => document.querySelectorAll('[data-modulo][data-montado]').length >= 3 && scrollY > 3000), 'los módulos se van montando al acercarse');
  comprobar(page.errores.length === 0, 'sin errores en la consola con movimiento', page.errores);
  // recargar a media página: se entra arriba
  await page.reload({ waitUntil: 'load' }); await page.waitForFunction(() => window.Camin && window.Camin.web); await page.waitForTimeout(400);
  comprobar(await page.evaluate(() => scrollY) === 0, 'recargar a media página entra arriba (scrollY 0)');
  await c.close();
  // dedo de verdad (CDP): arrastrar en horizontal mueve el año; en vertical, baja la página
  const mv = await nueva({ viewport: { width: 390, height: 844 }, movil: true, touch: true, movimiento: true });
  await ir(mv.page, PAG + `&fecha=${HOY}`);
  await mv.page.waitForFunction(() => document.querySelector('#arbol.es-viva'));
  const cdp = await mv.ctx.newCDPSession(mv.page);
  const r = await mv.page.evaluate(() => { const b = document.querySelector('.roble').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; });
  const toque = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  await toque('touchStart', r[0] - 40, r[1]);
  for (let i = 1; i <= 8; i++) { await toque('touchMove', r[0] - 40 + i * 14, r[1]); await mv.page.waitForTimeout(16); }
  const t1 = await mv.page.evaluate(() => ({ v: +document.querySelector('#arbol').getAttribute('aria-valuenow'), y: scrollY }));
  await toque('touchEnd');
  await mv.page.waitForFunction(() => document.querySelector('#arbol').getAttribute('aria-valuenow') === '0', null, { timeout: 4000 });
  comprobar(t1.v > 25 && t1.y === 0, `con el dedo: arrastrar el roble en horizontal adelanta la fecha (+${t1.v} días) sin mover la página, y al soltar vuelve`, t1);
  await toque('touchStart', r[0], r[1] + 60);
  for (let i = 1; i <= 10; i++) { await toque('touchMove', r[0], r[1] + 60 - i * 24); await mv.page.waitForTimeout(16); }
  await toque('touchEnd'); await mv.page.waitForTimeout(500);
  const t2 = await mv.page.evaluate(() => ({ y: scrollY, v: document.querySelector('#arbol').getAttribute('aria-valuenow') }));
  comprobar(t2.y > 80 && t2.v === '0', `y arrastrar en vertical sobre el roble sigue bajando la página (${Math.round(t2.y)} px), sin tocar la fecha`, t2);
  // el pie: el robledal con la hoja de hoy
  await mv.page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await mv.page.waitForTimeout(500);
  const pie = await mv.page.evaluate(() => ({ arboles: document.querySelectorAll('.bosque use').length, ref: [...document.querySelectorAll('.bosque use')].every((u) => u.getAttribute('href') === '#roble-arbol' && document.querySelector('#roble-arbol')), h: document.querySelector('.bosque').getBoundingClientRect().height, hoja: getComputedStyle(document.documentElement).getPropertyValue('--hoja'), est: document.documentElement.dataset.estacion, txt: document.querySelector('.pie__llegada').textContent }));
  comprobar(pie.arboles >= 8 && pie.ref && pie.h > 150 && pie.est === 'ocre' && pie.txt.includes(`km ${KM}`), `el pie cierra lo que abrió la portada: el mismo roble, ${pie.arboles} veces (el robledal), con la hoja de hoy, y «km ${KM} · Tablizas»`, pie);
  comprobar(mv.page.errores.length === 0, 'sin errores en la consola en el móvil con movimiento', mv.page.errores);
  await mv.ctx.close();
}

  } finally { await browser.close(); }
}
servidor.close();
const terceros = [...new Set(externas.map((u) => new URL(u).hostname))];
if (necesitaNav) comprobar(terceros.length === 0, 'la página no pide nada a terceros por su cuenta (letras, iconos y datos van con la web)', terceros);
console.log(`\n${nOk} bien, ${fallos.length} mal`);
if (fallos.length) { console.log('\nFALLAN:'); fallos.forEach((f) => console.log('  - ' + f)); }
process.exitCode = fallos.length ? 1 : 0;
