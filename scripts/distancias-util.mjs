// Utilidades de los scripts de «A cuánto queda»: Overpass con espejos, OSRM (coche y a pie) y distancia en línea recta.
// Receta de ../apartamentos-montemar-navia-web/scripts/alrededor-util.mjs. User-Agent genérico, sin datos personales.
export const UA = 'maqueta-web-local/1.0 (prueba de maqueta sin publicar)';
const ESPEJOS = ['https://overpass.openstreetmap.fr/api/interpreter', 'https://overpass-api.de/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
export const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

export async function overpass(q, { rondas = 3, timeout = 90000 } = {}) {
  for (let ronda = 0; ronda < rondas; ronda++) for (const e of ESPEJOS) {
    try {
      const r = await fetch(e, { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q), signal: AbortSignal.timeout(timeout) });
      if (r.ok) { const j = await r.json(); if (j.elements) return j; } else console.error(e, r.status);
    } catch (err) { console.error(e, err.message); }
    await dormir(2000 * (ronda + 1));
  }
  throw new Error('Overpass no responde');
}

// perfil: 'coche' → router.project-osrm.org (driving); 'pie' → routing.openstreetmap.de/routed-foot
export async function ruta(a, b, perfil, intentos = 5) {
  const base = perfil === 'pie' ? 'https://routing.openstreetmap.de/routed-foot/route/v1/driving/' : 'https://router.project-osrm.org/route/v1/driving/';
  const url = `${base}${a.lon},${a.lat};${b.lon},${b.lat}?overview=full&geometries=geojson&steps=true&alternatives=false`;
  for (let i = 0; i < intentos; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) });
      if (r.ok) { const j = await r.json(); if (j.code === 'Ok') return j; }
    } catch (e) { /* reintenta */ }
    await dormir(2500 * (i + 1));
  }
  throw new Error('OSRM falla ' + url);
}

export const hav = (a, b) => { const r = Math.PI / 180, dx = (b.lon - a.lon) * r * Math.cos(((a.lat + b.lat) / 2) * r), dy = (b.lat - a.lat) * r; return 6371000 * Math.hypot(dx, dy); };
