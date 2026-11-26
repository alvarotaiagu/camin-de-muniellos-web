// Iconos: Phosphor Icons, peso «light» (licencia MIT), bajados de unpkg una vez a ref/raw/phosphor/ y montados en un
// sprite en línea (partes/iconos.html). Un solo peso y una sola familia en toda la web.
//   node scripts/iconos.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(RAIZ, 'ref/raw/phosphor');
fs.mkdirSync(CACHE, { recursive: true });
// nombre en la web → nombre en Phosphor (con alternativas por si alguno no existe en esta versión)
const ICONOS = {
  cama: ['bed'], metros: ['ruler'], personas: ['users'], euro: ['currency-eur'], terraza: ['mountains'],
  cocina: ['cooking-pot'], ducha: ['shower'], aseo: ['drop'], plancha: ['t-shirt'], lavadora: ['washing-machine'],
  calefaccion: ['thermometer-hot', 'thermometer'], wifi: ['wifi-high'], tele: ['television-simple', 'television'],
  juegos: ['puzzle-piece'], cuna: ['baby'], botiquin: ['first-aid-kit', 'first-aid'], barbacoa: ['fire'],
  paellera: ['frying-pan', 'bowl-food'], infantil: ['lego-smiley', 'balloon'], jardin: ['plant'], aparcar: ['car-profile', 'car'],
  libros: ['books'], sofa: ['couch', 'armchair'], sol: ['solar-panel', 'sun'], granja: ['barn', 'cow'], miel: ['jar-label', 'jar', 'drop-half'],
  huevo: ['egg'], hoja: ['leaf'], tel: ['phone'], correo: ['envelope-simple'], mapa: ['map-trifold'], pin: ['map-pin'],
  flecha: ['arrow-right'], fuera: ['arrow-up-right'], reloj: ['clock'], calendario: ['calendar-blank'], mascota: ['paw-print'],
  dni: ['identification-card'], ok: ['check'], cerrar: ['x'], whatsapp: ['whatsapp-logo'], instagram: ['instagram-logo'],
  facebook: ['facebook-logo'], vista: ['cube-focus', 'panorama'], coche: ['car-simple', 'car'], bota: ['boot', 'sneaker-move'],
  senda: ['person-simple-hike', 'person-simple-walk'], agua: ['drop-simple', 'drop'], menu: ['list'], tabla: ['table'],
  llave: ['key'], grupo: ['users-three'], maleta: ['backpack'], cafe: ['coffee'], aviso: ['warning-circle', 'info'], info: ['info'],
};
const UA = 'maqueta-web-local/1.0 (prueba de maqueta sin publicar)';
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
async function svg(n) {
  const f = path.join(CACHE, n + '-light.svg');
  if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8');
  const r = await fetch(`https://unpkg.com/@phosphor-icons/core@2.1.1/assets/light/${n}-light.svg`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
  await dormir(150);
  if (!r.ok) return null;
  const t = await r.text();
  if (!t.includes('<svg')) return null;
  fs.writeFileSync(f, t);
  return t;
}
let sprite = '<!-- Iconos: Phosphor Icons «light» (MIT, phosphoricons.com). Sprite generado por scripts/iconos.mjs: no editar a mano. -->\n<svg class="sprite" width="0" height="0" aria-hidden="true" focusable="false">\n';
const usados = {};
for (const [nombre, candidatos] of Object.entries(ICONOS)) {
  let hecho = false;
  for (const c of candidatos) {
    const t = await svg(c);
    if (!t) continue;
    const dentro = t.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/<rect width="256" height="256" fill="none"\/>/g, '').replace(/\s+fill="none"/g, ' fill="none"').trim();
    sprite += `<symbol id="i-${nombre}" viewBox="0 0 256 256">${dentro}</symbol>\n`;
    usados[nombre] = c; hecho = true; break;
  }
  if (!hecho) console.warn('  SIN ICONO:', nombre, candidatos);
}
sprite += '</svg>\n';
fs.writeFileSync(path.join(RAIZ, 'partes/iconos.html'), sprite);
console.log(Object.keys(usados).length + ' iconos → partes/iconos.html', (sprite.length / 1024).toFixed(0) + ' KB');
