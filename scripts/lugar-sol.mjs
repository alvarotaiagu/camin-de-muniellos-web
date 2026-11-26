/* Validación del sol de js/lugar.js (Camin.lugar.sol) contra una fuente independiente: JPL Horizons (NASA),
   observador topocéntrico en la casa, acimut y altura SIN refracción (APPARENT=AIRLESS) y CON refracción
   (REFRACTED), en 48 instantes de 2026 (el día 21 de cada mes a las 7:17, 10:17, 13:17 y 16:17 UTC).
   Las respuestas se guardan en ref/raw/lugar-cache/ (si están, no se vuelven a pedir).
   Uso: node scripts/lugar-sol.mjs
   También lo carga scripts/lugar-prueba.mjs (export validar), que solo compara si la respuesta está en la caché. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(RAIZ, 'ref/raw/lugar-cache');
const UA = { 'User-Agent': 'datos-mapa-script/1.0 (uso puntual)' };   // sin datos personales

export function cargaLugar() {
  const c = { URL, URLSearchParams, Intl, Math, Date, console, document: { currentScript: null }, location: { href: 'http://localhost/', search: '' } };
  c.window = c; vm.createContext(c);
  vm.runInContext(fs.readFileSync(path.join(RAIZ, 'js/lugar.js'), 'utf8'), c, { filename: 'lugar.js' });
  return c.Camin.lugar;
}

export const instantes = [];
for (let m = 0; m < 12; m++) for (const h of [7, 10, 13, 16]) instantes.push(Date.UTC(2026, m, 21, h, 17));
const jd = (t) => (t / 86400000 + 2440587.5).toFixed(6);

async function pide(url, nombre, soloCache) {
  const f = path.join(CACHE, nombre);
  if (fs.existsSync(f) && fs.statSync(f).size > 500) return fs.readFileSync(f, 'utf8');
  if (soloCache) return null;
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const t = await r.text();
  fs.mkdirSync(CACHE, { recursive: true }); fs.writeFileSync(f, t);
  return t;
}
async function horizons(casa, aparente, soloCache) {
  const p = new URLSearchParams({
    format: 'json', COMMAND: "'10'", OBJ_DATA: 'NO', MAKE_EPHEM: 'YES', EPHEM_TYPE: 'OBSERVER', CENTER: "'coord@399'",
    COORD_TYPE: 'GEODETIC', SITE_COORD: `'${casa.lon},${casa.lat},${(casa.cota / 1000).toFixed(3)}'`, TLIST: instantes.map(jd).join(' '), TLIST_TYPE: 'JD',
    TIME_TYPE: 'UT', QUANTITIES: "'4'", ANG_FORMAT: 'DEG', APPARENT: aparente, CSV_FORMAT: 'YES', EXTRA_PREC: 'YES',
  });
  const t = await pide('https://ssd.jpl.nasa.gov/api/horizons.api?' + p, `horizons-${aparente.toLowerCase()}.json`, soloCache);
  if (!t) return null;
  const filas = JSON.parse(t).result.split('$$SOE')[1].split('$$EOE')[0].trim().split('\n');
  return filas.map((l) => {       // CSV: fecha, (marcas), (marcas), acimut, altura,
    const nums = l.split(',').map((x) => x.trim()).filter((x) => x !== '' && /^-?\d+(\.\d+)?$/.test(x)).map(Number);
    return { az: nums[nums.length - 2], el: nums[nums.length - 1] };
  });
}

// → { n, errAz, errEl, errRefr, ejemplo } o null si no hay datos (sin red y sin caché)
export async function validar(soloCache) {
  const L = cargaLugar();
  const casa = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data/lugar-camin.json'), 'utf8')).casa;
  const geo = await horizons(casa, 'AIRLESS', soloCache), ref = await horizons(casa, 'REFRACTED', soloCache);
  if (!geo || !ref) return null;
  let errAz = 0, errEl = 0, errRefr = 0, n = 0, nR = 0, ejemplo = null;
  instantes.forEach((t, i) => {
    const p = L.sol(new Date(t), casa.lat, casa.lon), g = geo[i], r = ref[i];
    if (g.el > -1) {
      const dAz = Math.abs(((p.azimut - g.az + 540) % 360) - 180);
      errAz = Math.max(errAz, dAz * Math.cos(g.el * Math.PI / 180)); errEl = Math.max(errEl, Math.abs(p.alturaGeometrica - g.el)); n++;
    }
    if (r.el > 2) { errRefr = Math.max(errRefr, Math.abs(p.altura - r.el)); nR++; }
    if (t === Date.UTC(2026, 10, 21, 13, 17)) ejemplo = { cuando: new Date(t).toISOString(), lugar: p, horizons: g, horizonsRefr: r };
  });
  return { n, nR, errAz, errEl, errRefr, ejemplo, casa };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const v = await validar(false);
  console.log(`Sol de js/lugar.js contra JPL Horizons, observador en la casa (${v.casa.lat}, ${v.casa.lon}, ${v.casa.cota} m), ${instantes.length} instantes de 2026:`);
  console.log(`  acimut (en el cielo, × cos altura): error máx ${v.errAz.toFixed(4)}° · altura geométrica: error máx ${v.errEl.toFixed(4)}° (${v.n} instantes con el sol fuera)`);
  console.log(`  altura con refracción (> 2°; Horizons usa su atmósfera estándar): error máx ${v.errRefr.toFixed(4)}° (${v.nR})`);
  const e = v.ejemplo;
  console.log(`  ejemplo, ${e.cuando}: lugar.js acimut ${e.lugar.azimut.toFixed(3)}° altura ${e.lugar.alturaGeometrica.toFixed(3)}° · Horizons acimut ${e.horizons.az.toFixed(3)}° altura ${e.horizons.el.toFixed(3)}°`);
  process.exit(v.errAz < 0.05 && v.errEl < 0.05 ? 0 : 1);
}
