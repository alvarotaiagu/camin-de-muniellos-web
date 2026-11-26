/* Lee la ocupación REAL de los tres apartamentos en su MotoPress Hotel Booking (solo lectura) → data/disponibilidad.json.
   Uso: node scripts/disponibilidad.mjs && node construir.mjs
        node scripts/disponibilidad.mjs --html ref/raw/portada.html   (saca el nonce de una página ya guardada: una petición menos)
   Aprobado por Álvaro el 2026-11-26 (ref/DATOS-MUNIELLOS.md, «Reservas: su motor»). Receta de ../valbanera-colombres-web.
   - DOS peticiones GET y nada más: su portada (de ahí sale "restApiWpNonce", que caduca) y
     /wp-json/mphb/v1/availability con la cabecera X-WP-Nonce, UNA vez para todo el periodo.
   - Sin bucles ni reintentos: es el servidor de un negocio pequeño. Si falla, se conserva la última lectura buena y se dice.
   - NUNCA se envía un formulario, una búsqueda ni una reserva. User-Agent genérico, sin datos de nadie.
   Salida: { leido: ISO, fuente, desde: 'AAAA-MM-DD', dias: n, apartamentos: { <id>: { mphb, libre, min, sinEntrada, sinSalida } } }
   - libre: una letra por NOCHE desde «desde»: '1' = esa noche está libre, '0' = ocupada (roomTypeStatus distinto de
     «available» o sin habitaciones).
   - min: estancia mínima (noches) si se entra ese día, una cifra por día (9 = nueve o más).
   - sinEntrada / sinSalida: '1' si ese día el motor no deja entrar / salir. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = path.join(RAIZ, 'data/disponibilidad.json');
const SITIO = 'https://camindemuniellos.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const APARTAMENTOS = { carujo: 1026, fonrin: 1037, xelin: 1039 };
const MESES = 12;

const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const pedir = async (url, cab = {}) => {
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'es-ES,es;q=0.9', ...cab }, signal: AbortSignal.timeout(45000) });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText} en ${url.split('?')[0]}`);
  return r.text();
};
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const previo = fs.existsSync(SALIDA) ? JSON.parse(fs.readFileSync(SALIDA, 'utf8')) : null;
try {
  const guardada = arg('--html');
  const pagina = guardada ? fs.readFileSync(path.resolve(RAIZ, guardada), 'utf8') : await pedir(SITIO + '/');
  const nonce = (/"restApiWpNonce":"([0-9a-f]{6,16})"/.exec(pagina) || [])[1];
  if (!nonce) throw new Error('sin restApiWpNonce en la página');
  const hoy = new Date();
  const fin = new Date(hoy.getFullYear(), hoy.getMonth() + MESES, hoy.getDate());
  const q = `start_date=${iso(hoy)}&end_date=${iso(fin)}` + Object.values(APARTAMENTOS).map((id) => `&room_type_ids[]=${id}`).join('');
  const texto = await pedir(`${SITIO}/wp-json/mphb/v1/availability?${q}`, { 'X-WP-Nonce': nonce, Accept: 'application/json' });
  const J = JSON.parse(texto);
  fs.mkdirSync(path.join(RAIZ, 'ref/raw'), { recursive: true });
  fs.writeFileSync(path.join(RAIZ, 'ref/raw/mphb-availability-ultima.json'), texto);
  const salida = { leido: new Date().toISOString(), fuente: 'MotoPress Hotel Booking de camindemuniellos.com (GET /wp-json/mphb/v1/availability, solo lectura)', desde: iso(hoy), dias: 0, apartamentos: {} };
  for (const [id, mphb] of Object.entries(APARTAMENTOS)) {
    const d = J[String(mphb)];
    if (!d) throw new Error(`la respuesta no trae el apartamento ${mphb}`);
    let libre = '', min = '', sinEntrada = '', sinSalida = '';
    for (let f = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()); ; f.setDate(f.getDate() + 1)) {
      const x = d[iso(f)];
      if (!x) break;
      libre += x.roomTypeStatus === 'available' && x.availableRoomsCount > 0 && !x.isStayInNotAllowed && !x.isEarlierThanMinAdvanceDate && !x.isLaterThanMaxAdvanceDate ? '1' : '0';
      min += String(Math.min(9, Math.max(1, x.minStayNights || 1)));
      sinEntrada += x.isCheckInNotAllowed ? '1' : '0';
      sinSalida += x.isCheckOutNotAllowed ? '1' : '0';
    }
    if (libre.length < 60) throw new Error(`solo ${libre.length} días seguidos leídos para ${id}`);
    salida.apartamentos[id] = { mphb, libre, min, sinEntrada, sinSalida };
    console.log(id.padEnd(8), libre.length, 'días ·', (libre.match(/0/g) || []).length, 'noches ocupadas');
  }
  salida.dias = Math.min(...Object.values(salida.apartamentos).map((a) => a.libre.length));
  fs.writeFileSync(SALIDA, JSON.stringify(salida));
  console.log(`→ data/disponibilidad.json (leído ${salida.leido}, ${salida.dias} días desde ${salida.desde}). Ahora: node construir.mjs`);
} catch (e) {
  console.error('FALLA la lectura: ' + e.message + (previo ? `. Se conserva la del ${previo.leido}.` : '. No hay lectura anterior: la web enseñará solo el salto a su motor.'));
  process.exitCode = 2;
}
