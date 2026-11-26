// «A cuánto queda»: rutas REALES desde la casa con OSRM (servidor público, perfil coche). Datos de © colaboradores de
// OpenStreetMap (ODbL). Nada a ojo y nada de las distancias de su web (da 15 y 19 km para Muniellos).
//   node scripts/distancias-rutas.mjs   → ref/raw/rutas.json  (geometría, km, minutos, carreteras)
// Los sitios se buscaron en OSM por nombre (Overpass, 2026-11-26) y se fijan aquí por su id; el script vuelve a pedir sus
// coordenadas y su nombre a OSM (si un id desaparece, ese sitio queda «por confirmar»).
// La casa y el destino del camín: los de data/lugar-camin.json (Lugar 3D, comprobados sobre el Catastro) si ya existe;
// si no, las coordenadas de partida de ref/DATOS-MUNIELLOS.md. Receta de ../apartamentos-alba-somiedo-web.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { overpass, ruta, dormir, hav } from './distancias-util.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let CASA = { lat: 43.1516784, lon: -6.5753796, fuente: 'coordenadas de partida de ref/DATOS-MUNIELLOS.md (su visita virtual de Google), sin comprobar' };
let DESTINO = null;
try {
  const L = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data/lugar-camin.json'), 'utf8'));
  if (Number.isFinite(L.casa.lat) && Number.isFinite(L.casa.lon)) CASA = { lat: L.casa.lat, lon: L.casa.lon, fuente: 'data/lugar-camin.json (Lugar 3D, comprobadas sobre el Catastro)' };
  if (L.destino && Number.isFinite(L.destino.lat)) DESTINO = { lat: L.destino.lat, lon: L.destino.lon };
} catch (e) { /* sin el fichero de Lugar todavía */ }

// grupo: villa (Cangas, a un paso), camin (la carretera a Muniellos), concejo (alrededor), fuera (para llegar y salir)
const SITIOS = [
  { id: 'cangas', nombre: 'Cangas del Narcea', tipo: 'La villa', grupo: 'villa', osm: 'node/1996612913' },
  { id: 'hospital', nombre: 'Hospital Carmen y Severo Ochoa', tipo: 'Hospital comarcal', grupo: 'villa', osm: 'way/217491126' },
  { id: 'museovino', nombre: 'Museo del Vino de Cangas', tipo: 'Museo', grupo: 'villa', osm: 'node/2268277442' },
  { id: 'corias', nombre: 'Monasterio de Corias', tipo: 'Monasterio', grupo: 'villa', osm: 'node/2682093491' },
  { id: 'moal', nombre: 'Moal', tipo: 'Pueblo. De aquí sale la ruta a pie a Tablizas', grupo: 'camin', osm: 'node/979949582' },
  { id: 'centro', nombre: 'Centro de Interpretación de Muniellos', tipo: 'Centro de visitantes con dos miradores', grupo: 'camin', osm: 'way/746505041' },
  { id: 'tablizas', nombre: 'Tablizas', tipo: 'La entrada a la Reserva de Muniellos', grupo: 'camin', osm: 'way/412929024', destino: true },
  { id: 'besullo', nombre: 'Besullo', tipo: 'Pueblo de mazos y fraguas', grupo: 'concejo', osm: 'node/997029108' },
  { id: 'llamas', nombre: 'Llamas del Mouro', tipo: 'El pueblo de la cerámica negra', grupo: 'concejo', osm: 'node/993783014' },
  { id: 'leitariegos', nombre: 'Puerto de Leitariegos', tipo: 'El alto. De aquí se sube a pie al Cueto de Arbas', grupo: 'concejo', osm: 'node/705312051' },
  { id: 'estacion', nombre: 'Estación de Leitariegos', tipo: 'Estación invernal', grupo: 'concejo', osm: 'way/191993446' },
  { id: 'oviedo', nombre: 'Oviedo', tipo: 'Ciudad', grupo: 'fuera', buscar: 'node(43.30,-5.90,43.40,-5.80)["place"="city"];out;', re: /oviedo/i },
  { id: 'aeropuerto', nombre: 'Aeropuerto de Asturias', tipo: 'Aeropuerto', grupo: 'fuera', osm: 'way/35951935' },
];
// el Cueto de Arbas (cima de la reserva): solo para comprobar que existe y su nombre; no lleva ruta en coche
const COMPROBAR = 'nwr["natural"="peak"]["name"~"Arbas|Arvas",i](42.93,-6.50,43.03,-6.35);';

const ids = { node: new Set(), way: new Set(), relation: new Set() };
for (const s of SITIOS) if (s.osm) { const [t, i] = s.osm.split('/'); ids[t].add(i); }
const q = '[out:json][timeout:60];(' + Object.entries(ids).filter(([, v]) => v.size).map(([t, v]) => `${t}(id:${[...v].join(',')});`).join('') + COMPROBAR + ');out center tags;';
const J = await overpass(q);
const porId = new Map(J.elements.map((e) => [`${e.type}/${e.id}`, e]));
const punto = (e) => (Number.isFinite(e.lat) ? { lat: e.lat, lon: e.lon } : { lat: e.center.lat, lon: e.center.lon });
const nombreOsm = (e) => e.tags && (e.tags['name:es'] || e.tags.name);
const r5 = (v) => Math.round(v * 1e5) / 1e5;

function resumen(j) {
  const r = j.routes[0];
  const carreteras = [];
  for (const leg of r.legs) for (const s of leg.steps) { const ref = (s.ref || '').split(';')[0].trim(); if (ref && s.distance > 400 && !carreteras.includes(ref)) carreteras.push(ref); }
  return {
    km: +(r.distance / 1000).toFixed(2),
    minutos: Math.max(1, Math.round(r.duration / 60)),
    carreteras,
    snap_origen_m: Math.round(j.waypoints[0].distance),
    snap_destino_m: Math.round(j.waypoints[1].distance),
    geometria: r.geometry.coordinates.map(([lo, la]) => [r5(lo), r5(la)]),
  };
}

const salida = {
  fuente: 'OSRM: router.project-osrm.org (coche); datos de © colaboradores de OpenStreetMap, ODbL',
  fecha: new Date().toISOString().slice(0, 10),
  nota: 'Tiempos de OSRM con velocidades teóricas, sin tráfico ni paradas: orientativos. snap_*_m = distancia del punto pedido a la carretera donde empieza o acaba la ruta.',
  casa: CASA,
  orden: SITIOS.map((s) => s.id),
  sitios: {},
  comprobados: {},
};
for (const e of J.elements) if (e.tags && e.tags.natural === 'peak') salida.comprobados[`${e.type}/${e.id}`] = { nombre: nombreOsm(e), ele: e.tags.ele || null, ...punto(e) };

for (const s of SITIOS) {
  const d = { nombre: s.nombre, tipo: s.tipo, grupo: s.grupo };
  try {
    let e = s.osm ? porId.get(s.osm) : null;
    if (!e && s.buscar) { const jj = await overpass('[out:json][timeout:40];' + s.buscar); e = jj.elements.find((x) => s.re.test(nombreOsm(x) || '')); }
    if (!e) throw new Error('no está en OSM: ' + (s.osm || s.buscar));
    const pt = s.destino && DESTINO ? DESTINO : punto(e);
    Object.assign(d, { osm: `${e.type}/${e.id}`, osm_nombre: nombreOsm(e), lat: r5(pt.lat), lon: r5(pt.lon), ele_osm: e.tags && e.tags.ele ? +e.tags.ele : null });
    d.recta_km = +(hav(CASA, d) / 1000).toFixed(2);
    d.coche = resumen(await ruta(CASA, pt, 'coche'));
    await dormir(1300);
  } catch (er) { d.error = er.message; }
  salida.sitios[s.id] = d;
  const t = (x) => (x ? `${x.km} km ${x.minutos} min ${x.carreteras.join('>')} (snap ${x.snap_origen_m}/${x.snap_destino_m} m)` : '-');
  console.log(s.id.padEnd(12), (d.osm || '').padEnd(18), (d.osm_nombre || '').padEnd(40), '| recta', d.recta_km, '|', t(d.coche), d.error || '');
}
console.log('comprobados:', JSON.stringify(salida.comprobados));
fs.mkdirSync(path.join(RAIZ, 'ref/raw'), { recursive: true });
fs.writeFileSync(path.join(RAIZ, 'ref/raw/rutas.json'), JSON.stringify(salida));
console.log('→ ref/raw/rutas.json · casa:', CASA.fuente);
