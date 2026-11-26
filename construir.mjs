/* Genera las páginas a partir de sus fuentes *.src.html (arquitectura de ../apartamentos-alba-somiedo-web/construir.mjs):
   1. <!--parte:partes/archivo--> → el contenido de ese archivo (si falta, un comentario y la web sigue).
   2. Una sola fuente de datos del negocio: data/muniellos.json (de ref/DATOS-MUNIELLOS.md).
   3. El camín: data/lugar-camin.json (Lugar 3D); si aún no existe, data/camin-provisional.json (mismo esquema). De ahí
      salen los km de la portada, los mojones de la línea (js/camin.js), el respaldo de #lugar (el perfil del camín) y
      los km de Moal y Tablizas en «A cuánto queda» (los mismos que el vuelo 3D: no puede haber dos cifras).
   4. «A cuánto queda»: data/distancias.json (rutas de OSRM + MDT del IGN, scripts/distancias-rutas.mjs y relieve.py).
   5. Reservar: data/disponibilidad.json (lectura real de su MotoPress, scripts/disponibilidad.mjs).
   6. <img data-foto="nombre" ...> → <picture> WebP + JPG en los anchos de img/fotos/fotos.json (nunca se amplía).
   7. Los <link>/<script> propios que no existen se quitan con un aviso, SALVO los de Lugar 3D (css/lugar.css,
      js/lugar.js): se dejan siempre, para que en cuanto existan se carguen sin reconstruir.
   8. Ejecuta versionar.mjs (?v=<huella> en CSS y JS).
   Se edita SIEMPRE el *.src.html (o la parte); el .html generado se sobrescribe. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const existe = (f) => fs.existsSync(path.join(RAIZ, f));
const leerJson = (f) => JSON.parse(fs.readFileSync(path.join(RAIZ, f), 'utf8'));
const leerSi = (f) => (existe(f) ? leerJson(f) : null);
const D = leerJson('data/muniellos.json');
const FOTOS = new Map(leerJson('img/fotos/fotos.json').map((f) => [f.nombre, f]));
const COMMONS = leerJson('scripts/commons.json');
const CAMIN = leerSi('data/lugar-camin.json') || leerSi('data/camin-provisional.json');
if (!CAMIN) throw new Error('Falta el camín: ni data/lugar-camin.json ni data/camin-provisional.json');
if (!existe('data/lugar-camin.json')) console.warn('  (aún no está data/lugar-camin.json, de Lugar 3D: se usa el provisional)');
const DIST = leerSi('data/distancias.json');
const DISPO = leerSi('data/disponibilidad.json');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const num = (n) => String(n).replace('.', ',');
const ico = (n, t = 24) => `<svg class="ico" width="${t}" height="${t}" aria-hidden="true"><use href="#i-${n}" width="${t}" height="${t}"/></svg>`;
const kmTxt = (v) => (v < 30 ? num((Math.round(v * 10) / 10).toFixed(1)).replace(/,0$/, '') : String(Math.round(v)));
const tiempoTxt = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min` : `${m} min`);
const miles = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const KM_TOTAL = kmTxt(CAMIN.kmTotal);
const C = D.contacto;
const TEL = `<a class="cifra" href="tel:${C.telefono.tel}">${C.telefono.texto}</a>`;
const CORREO = `<a href="mailto:${C.correo}">${C.correo}</a>`;
const WA = `https://wa.me/${C.whatsapp.numero}`;

/* ---------- fotos ---------- */
function picture(atrs) {
  const nombre = /data-foto="([^"]+)"/.exec(atrs)[1];
  const f = FOTOS.get(nombre);
  if (!f) throw new Error('Foto desconocida: ' + nombre);
  const hasta = +((/\bdata-hasta="(\d+)"/.exec(atrs) || [, 0])[1]) || Infinity;
  const anchos = f.anchos.filter((w) => w <= hasta);
  const set = (ext) => anchos.map((w) => `img/fotos/${nombre}-${w}.${ext} ${w}w`).join(', ');
  const sizes = (/\bsizes="([^"]+)"/.exec(atrs) || [, '100vw'])[1];
  let resto = atrs.replace(/\s*data-foto="[^"]+"/, '').replace(/\s*\bsizes="[^"]+"/, '').replace(/\s*data-hasta="\d+"/, '');
  if (!/\bloading=/.test(resto)) resto += ' loading="lazy"';
  if (!/\bdecoding=/.test(resto)) resto += ' decoding="async"';
  return `<picture data-foto="${nombre}"><source type="image/webp" srcset="${set('webp')}" sizes="${sizes}"><img src="img/fotos/${nombre}-${anchos[0]}.jpg" srcset="${set('jpg')}" sizes="${sizes}" width="${f.ancho}" height="${f.alto}" style="--max:${f.ancho}px"${resto}></picture>`;
}

/* ---------- el camín: la forma real de la carretera, «estirada» a lo largo de la página ----------
   Para la línea de js/camin.js: cada 100 m, cuánto se aparta la carretera real de la recta casa → Tablizas (de −1 a 1).
   Así los meandros de la línea son los de la carretera, y cada mojón cae en su kilómetro. */
function caminDatos() {
  const R = CAMIN.ruta, r = Math.PI / 180, lat0 = CAMIN.casa.lat;
  const P = R.map(([lo, la, , km]) => ({ x: (lo - CAMIN.casa.lon) * 111320 * Math.cos(lat0 * r), y: (la - lat0) * 110574, km }));
  const fin = P[P.length - 1], L = Math.hypot(fin.x, fin.y), ux = fin.x / L, uy = fin.y / L;
  const lado = (p) => p.x * uy - p.y * ux;                // a la derecha del sentido de la marcha
  const n = Math.round(CAMIN.kmTotal * 10);
  const dev = [];
  let j = 0;
  for (let i = 0; i <= n; i++) {
    const km = Math.min(CAMIN.kmTotal, i / 10);
    while (j < P.length - 2 && P[j + 1].km < km) j++;
    const a = P[j], b = P[j + 1], t = b.km > a.km ? Math.min(1, Math.max(0, (km - a.km) / (b.km - a.km))) : 0;
    dev.push(lado(a) * (1 - t) + lado(b) * t);
  }
  const max = Math.max(...dev.map(Math.abs)) || 1;
  // media móvil corta: la línea de la página es fina y las curvas cerradas se vuelven ruido
  const suave = dev.map((_, i) => { let s = 0, c = 0; for (let k = -2; k <= 2; k++) if (dev[i + k] !== undefined) { s += dev[i + k]; c++; } return s / c; });
  const hitos = CAMIN.hitos.map((h) => ({ n: h.nombre, km: h.km, cota: Math.round(h.cota), tipo: h.tipo || 'pueblo', d: h.detalle || '' }));
  return { kmTotal: CAMIN.kmTotal, minutos: CAMIN.minutos, cotaCasa: Math.round(CAMIN.casa.cota), destino: CAMIN.destino.nombre, cotaDestino: Math.round(CAMIN.destino.cota), dev: suave.map((v) => +(v / max).toFixed(3)), hitos, provisional: !!CAMIN.provisional };
}
const CD = caminDatos();

/* ---------- #lugar: el respaldo de la Web (sin JS, sin WebGL o con movimiento reducido): el perfil REAL del camín ---------- */
function lugarRespaldo() {
  const R = CAMIN.ruta, W = 1200, H = 380, mi = 70, md = 40, ar = 70, ab = 300;
  const cotas = R.map((p) => p[2]), cmin = Math.floor(Math.min(...cotas) / 50) * 50, cmax = Math.ceil(Math.max(...cotas) / 50) * 50 + 50;
  const X = (km) => mi + (km / CAMIN.kmTotal) * (W - mi - md), Y = (c) => ab - ((c - cmin) / (cmax - cmin)) * (ab - ar);
  const paso = Math.max(1, Math.floor(R.length / 220));
  const pts = R.filter((_, i) => i % paso === 0 || i === R.length - 1).map((p) => `${X(p[3]).toFixed(1)} ${Y(p[2]).toFixed(1)}`);
  const linea = 'M' + pts.join('L');
  let ultimo = -1e9;
  const marcas = CD.hitos.map((h, i) => {
    const x = X(h.km), y = Y(h.cota);
    const rotulo = i === 0 || i === CD.hitos.length - 1 || x - ultimo > 118;
    if (rotulo) ultimo = x;
    const ancla = i === 0 ? 'start' : i === CD.hitos.length - 1 ? 'end' : 'middle';
    return `<g class="perfil__hito${rotulo ? '' : ' perfil__hito--mudo'}"><path d="M${x.toFixed(1)} ${(y - 5).toFixed(1)}V${(rotulo ? y - 30 : y - 14).toFixed(1)}"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4"/>${rotulo ? `<text x="${x.toFixed(1)}" y="${(y - 52).toFixed(1)}" text-anchor="${ancla}" class="perfil__km">km ${kmTxt(h.km)}</text><text x="${x.toFixed(1)}" y="${(y - 36).toFixed(1)}" text-anchor="${ancla}">${esc(i === 0 ? 'La casa' : h.n)}</text>` : ''}</g>`;
  }).join('');
  const ejes = [cmin, (cmin + cmax) / 2, cmax].map((c) => `<path class="perfil__reja" d="M${mi} ${Y(c).toFixed(1)}H${W - md}"/><text class="perfil__cota" x="${mi - 10}" y="${(Y(c) + 4).toFixed(1)}" text-anchor="end">${miles(c)} m</text>`).join('');
  const lista = CD.hitos.map((h, i) => `            <li><span class="cifra">km ${kmTxt(h.km)}</span><b>${esc(i === 0 ? 'La casa, en ' + D.lugar.pueblo : h.n)}</b><small class="cifra">${miles(h.cota)} m</small>${h.d ? `<span class="lugar__detalle">${esc(h.d)}</span>` : ''}</li>`).join('\n');
  return `      <div class="lugar__respaldo env">
        <figure class="perfil">
          <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Perfil de altura de la carretera de la casa a Tablizas: sale a ${miles(CD.cotaCasa)} metros, baja al valle del Narcea y sube hasta ${miles(CD.cotaDestino)} metros">
            ${ejes}
            <path class="perfil__area" d="${linea}L${X(CAMIN.kmTotal).toFixed(1)} ${ab}L${mi} ${ab}Z"/>
            <path class="perfil__linea" d="${linea}"/>
            ${marcas}
          </svg>
          <figcaption>El perfil del camín: la carretera baja de la casa al Narcea y sube ${miles(CAMIN.subida || 0)} m, poco a poco, hasta la entrada del bosque.</figcaption>
        </figure>
        <ol class="lugar__hitos">
${lista}
        </ol>
      </div>`;
}

/* ---------- la casa ---------- */
const materiales = () => `        <dl class="casa__materiales">
${D.casa.materiales.map((m) => `          <div><dt>${esc(m.nombre)}</dt><dd>${esc(m.detalle)}</dd></div>`).join('\n')}
        </dl>`;

/* ---------- los tres apartamentos ---------- */
function apartamentos() {
  const piso = (a, i) => `        <article class="piso piso--${a.id}${i === 0 ? ' es-abierto' : ''}" id="${a.id}" data-piso="${a.id}" aria-labelledby="t-${a.id}">
          <div class="piso__resumen">
            <h3 class="piso__nombre" id="t-${a.id}">${esc(a.nombre)}</h3>
            <p class="piso__mini"><span><b class="cifra">${a.cama}</b> cm de cama</span><span><b class="cifra">${a.m2}</b> m²</span></p>
          </div>
          <div class="piso__cuerpo" id="piso-${a.id}">
            <dl class="piso__cifras">
              <div>${ico('cama', 26)}<dt>Cama</dt><dd><b class="cifra">${a.cama}</b> cm</dd></div>
              <div>${ico('metros', 26)}<dt>Tamaño</dt><dd><b class="cifra">${a.m2}</b> m²</dd></div>
              <div>${ico('personas', 26)}<dt>Personas</dt><dd><b class="cifra">${a.personas}</b></dd></div>
              <div>${ico('euro', 26)}<dt>Desde</dt><dd><b class="cifra">${D.precioDesde}</b> € la noche</dd></div>
            </dl>
            <p class="piso__deco">${esc(a.decoracion)}</p>
            <p class="piso__terraza">${ico('terraza', 28)}<span><b>Terraza privada</b> con vistas al valle: su punto fuerte.</span></p>
            <p class="piso__acc"><a class="btn btn--acento" href="#reservar" data-reservar="${a.id}">Ver fechas<span class="vh"> de ${esc(a.nombre)}</span></a></p>
            <figure class="piso__foto">
              <img data-foto="${a.foto}" alt="${esc(a.fotoAlt)}" sizes="(max-width: 899px) 92vw, 34vw">
              <figcaption>${esc(a.fotoPie)}</figcaption>
            </figure>
          </div>
        </article>`;
  return `      <div class="pisos" id="pisos">
${D.apartamentos.map(piso).join('\n')}
      </div>`;
}
function vistazo() {
  const A = D.apartamentos;
  const filas = [
    ['Cama', (a) => `${a.cama} cm`], ['Tamaño', (a) => `${a.m2} m²`], ['Personas', (a) => `${a.personas} (2 + sofá cama)`],
    ['Color', (a) => a.color], ['Terraza privada', () => 'Sí'], ['Desde', () => `${D.precioDesde} € la noche`],
  ];
  return `      <div class="vistazo" id="vistazo">
        <h3 class="sub-tit">De un vistazo</h3>
        <div class="tabla-caja" role="group" aria-label="Tabla comparativa de los tres apartamentos">
          <table class="tabla">
            <caption class="vh">Los tres apartamentos comparados</caption>
            <thead><tr><th scope="col"><span class="vh">Dato</span></th>${A.map((a) => `<th scope="col">${esc(a.nombre)}</th>`).join('')}</tr></thead>
            <tbody>
${filas.map(([h, f]) => `              <tr><th scope="row">${h}</th>${A.map((a) => `<td class="cifra">${esc(f(a))}</td>`).join('')}</tr>`).join('\n')}
            </tbody>
          </table>
        </div>
      </div>`;
}
const servicios = () => `      <div class="servicios">
${D.servicios.map((g) => `        <div class="servicios__grupo">
          <h3 class="sub-tit">${esc(g.grupo)}</h3>
          <ul>
${g.lista.map((s) => `            <li>${ico(s.icono, 30)}<span><b>${esc(s.nombre)}</b><small>${esc(s.detalle)}</small></span></li>`).join('\n')}
          </ul>
        </div>`).join('\n')}
      </div>`;

/* ---------- por dentro ---------- */
const visita = () => `      <div class="visita" id="visita-marco" data-src="${esc(D.visita.url)}">
        <img data-foto="terraza-valle" alt="La terraza de madera de un apartamento, con mesa y sillas, y el valle verde al fondo" sizes="(max-width: 899px) 100vw, 80vw">
        <div class="visita__antes">
          <button class="btn btn--acento btn--grande" type="button" id="visita-btn">${ico('vista', 26)}Abrir la visita 360</button>
          <p class="visita__aviso">Es una panorámica de Google Maps hecha dentro de la casa: contenido externo, que puede poner cookies de Google. <a href="cookies.html">Más información</a></p>
        </div>
      </div>
      <p class="dentro__pie">Mientras no la abras, lo que ves es la terraza de uno de los apartamentos y el valle.</p>`;

/* ---------- a cuánto queda ---------- */
const GRUPOS = { villa: 'En Cangas, a un paso', camin: 'Por el camín, hacia Muniellos', concejo: 'Por el concejo', fuera: 'Para llegar y salir' };
function sitiosWeb() {
  if (!DIST) return null;
  const S = {};
  for (const id of DIST.orden) {
    const s = DIST.sitios[id];
    if (!s) continue;
    const o = { ...s };
    // los que están en el camín llevan SU kilómetro (el del vuelo 3D)
    if (id === 'tablizas') { o.km = CAMIN.kmTotal; o.minutos = CAMIN.minutos; o.cota = Math.round(CAMIN.destino.cota); o.camin = true; }
    const hito = CAMIN.hitos.find((h) => h.nombre === s.nombre && h.tipo !== 'destino');
    if (hito) { o.km = hito.km; o.camin = true; }
    S[id] = o;
  }
  return S;
}
const SITIOS = sitiosWeb();
function distancias() {
  if (!SITIOS) { console.warn('  (sin data/distancias.json: «A cuánto queda» va sin cifras)'); return '      <p class="fino">Las distancias están por confirmar.</p>'; }
  const fecha = new Date(DIST.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  const filas = DIST.orden.filter((id) => SITIOS[id]).map((id) => {
    const s = SITIOS[id];
    return `              <tr data-sitio="${id}"><th scope="row">${esc(s.nombre)}<small>${esc(s.tipo)}</small></th><td class="cifra">${kmTxt(s.km)} km</td><td class="cifra">${tiempoTxt(s.minutos)}</td><td>${esc(s.carreteras.slice(0, 4).join(', '))}</td></tr>`;
  }).join('\n');
  return `      <div class="mapa-app" data-modulo="distancias">
        <div class="tabla-caja" role="group" aria-label="Tabla: a cuánto queda cada sitio">
          <table class="tabla dist__tabla">
            <caption class="vh">Kilómetros y minutos en coche desde la casa</caption>
            <thead><tr><th scope="col">Sitio</th><th scope="col">Distancia</th><th scope="col">En coche</th><th scope="col">Por</th></tr></thead>
            <tbody>
${filas}
            </tbody>
          </table>
        </div>
      </div>
      <p class="fino">Rutas de OSRM sobre OpenStreetMap, calculadas el ${fecha}: tiempos sin tráfico ni paradas, orientativos (en carreteras de montaña, cuenta con algo más). Alturas y relieve: MDT del IGN.</p>`;
}

/* ---------- Muniellos, veinte al día ---------- */
function muniellos() {
  const M = D.muniellos;
  const leido = new Date(M.leido).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  const horario = M.horario.map((h) => `            <tr data-meses="${h.meses.join(',')}"><th scope="row">${esc(h.texto)}</th><td class="cifra">${h.abre} a ${h.cierra}</td></tr>`).join('\n');
  const anio = Array.from({ length: 12 }, (_, i) => {
    const h = M.horario.find((x) => x.meses.includes(i + 1));
    const [hh, mm] = h.cierra.split(':').map(Number), alto = Math.round(((hh + mm / 60 - 15) / 4.5) * 100);
    return `<li data-mes="${i + 1}" style="--alto:${alto}%"><span class="muni__barra"></span><abbr title="${MESES[i]}: de ${h.abre} a ${h.cierra}">${MESES[i].slice(0, 3)}</abbr></li>`;
  }).join('');
  const rutas = M.rutas.map((r) => `          <article class="senda">
            <h4 class="senda__nombre">${esc(r.nombre)}</h4>
            <p class="senda__forma">${esc(r.forma)}</p>
            <dl class="senda__cifras"><div><dt>Largo</dt><dd class="cifra">${esc(r.km)}</dd></div><div><dt>Tiempo</dt><dd class="cifra">${esc(r.horas)}</dd></div><div><dt>Dificultad</dt><dd>${esc(r.dificultad)}</dd></div></dl>
            <p>${esc(r.detalle)}</p>
          </article>`).join('\n');
  const mojones = CD.hitos.map((h, i) => `              <tr><td class="cifra">km ${kmTxt(h.km)}</td><th scope="row">${esc(i === 0 ? 'La casa, en ' + D.lugar.pueblo : h.n)}${h.d ? `<small>${esc(h.d)}</small>` : ''}</th><td class="cifra">${miles(h.cota)} m</td></tr>`).join('\n');
  return `      <div class="muni__cab">
        <p class="muni__cupo" aria-hidden="true"><span class="cifra">${M.cupo}</span></p>
        <div>
          <h2 class="sec-tit" id="t-muni">Muniellos, veinte al día</h2>
          <p class="sec-sub">En la Reserva Natural Integral de Muniellos, el mayor robledal de España, solo entran ${M.cupo} personas al día. Hay que pedir sitio con tiempo: esto es lo que hace falta.</p>
        </div>
      </div>
      <ol class="pasos">
        <li>${ico('calendario', 30)}<h3>Pide la visita</h3><p>En la web del Principado de Asturias o por teléfono, en el <span class="cifra">${M.telefonos}</span>. Hace falta el nombre y el DNI de cada persona.</p><p><a class="enlace" href="${M.oficial}" target="_blank" rel="noopener">Pedir la autorización<span class="vh"> en la web del Principado (se abre en otra pestaña)</span> ${ico('fuera', 18)}</a></p></li>
        <li>${ico('ok', 30)}<h3>Confírmala</h3><p>Entre <span class="cifra">${M.confirmar[0]}</span> y <span class="cifra">${M.confirmar[1]}</span> días antes de la fecha. Si no se confirma, la reserva queda anulada.</p></li>
        <li>${ico('maleta', 30)}<h3>Prepara la mochila</h3><ul>${M.llevar.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></li>
        <li>${ico('coche', 30)}<h3>Entra por Tablizas</h3><p>La única entrada. Desde la casa son <span class="cifra">${KM_TOTAL} km</span>, unos <span class="cifra">${CAMIN.minutos} min</span> en coche. ${esc(M.nota)}</p></li>
      </ol>
      <div class="muni__cuerpo">
        <div class="muni__horario" id="horario">
          <h3 class="sub-tit">A qué hora abre Tablizas</h3>
          <p class="muni__hoy" id="horario-hoy" hidden></p>
          <ol class="muni__anio" aria-hidden="true">${anio}</ol>
          <table class="tabla muni__tabla">
            <caption class="vh">Horario del Centro de Recepción de Visitantes de Tablizas por meses</caption>
            <tbody>
${horario}
            </tbody>
          </table>
          <p class="fino">${esc(M.cerrado)}</p>
        </div>
        <div class="muni__rutas">
          <h3 class="sub-tit">Las dos rutas de dentro</h3>
${rutas}
        </div>
        <figure class="muni__foto muni__foto--a"><img data-foto="muniellos-valle" alt="${esc(COMMONS[0].alt)}" sizes="(max-width: 899px) 92vw, 44vw"></figure>
        <figure class="muni__foto muni__foto--b"><img data-foto="muniellos-rio" alt="${esc(COMMONS[1].alt)}" sizes="(max-width: 899px) 92vw, 30vw"></figure>
        <div class="muni__dormir">
          <p>El propio Principado lo dice en la autorización: para hacer la ruta, conviene dormir cerca de la Reserva.</p>
          <a class="btn btn--acento" href="#reservar">Ver fechas</a>
        </div>
      </div>
      <p class="fino">Condiciones oficiales del Principado de Asturias, leídas el ${leido}: compruébalas al pedir la visita. El largo de la ruta del río y el tiempo y la dificultad de las dos son los que da la casa.</p>
      <div class="mojones-tabla" id="mojones-tabla">
        <h3 class="sub-tit">El camín, kilómetro a kilómetro</h3>
        <div class="tabla-caja" role="group" aria-label="Tabla: la carretera de la casa a Tablizas">
          <table class="tabla">
            <caption class="vh">Pueblos y cruces de la carretera de la casa a Tablizas, con su kilómetro y su altura</caption>
            <thead><tr><th scope="col">Kilómetro</th><th scope="col">Sitio</th><th scope="col">Altura</th></tr></thead>
            <tbody>
${mojones}
            </tbody>
          </table>
        </div>
      </div>`;
}

/* ---------- lo de casa ---------- */
const decasa = () => `      <div class="decasa__texto">
        <h2 class="sec-tit" id="t-decasa">Lo de casa</h2>
        <p class="sec-sub">La familia tiene granja y colmenas. La miel «El Tío Ángel» sale de aquí.</p>
        <ul class="decasa__lista">
${D.deCasa.map((x) => `          <li>${ico(x.icono, 30)}<span><b>${esc(x.nombre)}</b><small>${esc(x.detalle)}</small></span></li>`).join('\n')}
        </ul>
      </div>
      <figure class="decasa__foto decasa__foto--a"><img data-foto="colmenar" alt="Las colmenas de colores de la familia en una ladera de monte" sizes="(max-width: 899px) 92vw, 46vw"><figcaption>El colmenar de «El Tío Ángel».</figcaption></figure>
      <figure class="decasa__foto decasa__foto--b"><img data-foto="miel-tarro" alt="Una mano con guante de apicultor sostiene un tarro de miel «El Tío Ángel»" sizes="(max-width: 899px) 60vw, 24vw"></figure>
      <figure class="decasa__foto decasa__foto--c"><img data-foto="miel-puesto" alt="Tarros de miel y polen en un expositor de madera con forma de panal, con el valle al fondo" sizes="(max-width: 899px) 60vw, 24vw"></figure>`;

/* ---------- libro de visitas ---------- */
const libro = () => `      <p class="sec-sub">Lo que dejaron escrito algunos huéspedes, tal como la casa lo publica en su web.</p>
      <ul class="notas" id="notas">
${D.libro.map((r) => `        <li class="nota nota--${r.apto}"><blockquote><p>${esc(r.texto)}</p></blockquote><p class="nota__firma"><b>${esc(r.firma)}</b><span class="cifra">${esc(r.fecha)}</span></p></li>`).join('\n')}
      </ul>`;

/* ---------- reservar ---------- */
function reserva() {
  const K = D.condiciones;
  return `      <div class="reservar__in">
        <div class="cal" data-modulo="reserva">
          <div class="cal__respaldo">
            <p>Las fechas libres se ven en el motor de reservas de la casa, y allí mismo se paga.</p>
            <p><a class="btn btn--acento" href="${D.motor.buscar}" target="_blank" rel="noopener">Ir a su motor de reservas<span class="vh"> (se abre en otra pestaña)</span></a></p>
          </div>
        </div>
        <aside class="condiciones" aria-labelledby="t-cond">
          <h3 class="sub-tit" id="t-cond">Antes de reservar</h3>
          <dl class="condiciones__horas">
            <div><dt>Entrada</dt><dd>desde las <b class="cifra">${K.entrada}</b></dd></div>
            <div><dt>Salida</dt><dd>antes de las <b class="cifra">${K.salida}</b></dd></div>
          </dl>
          <h4 class="condiciones__h">Si cancelas</h4>
          <table class="tabla condiciones__tabla">
            <caption class="vh">Qué devuelven si se cancela la reserva</caption>
            <tbody>
${K.cancelacion.map((c) => `              <tr><th scope="row">${esc(c.cuando)}</th><td>devuelven ${esc(c.devuelven)}</td></tr>`).join('\n')}
            </tbody>
          </table>
          <ul class="condiciones__normas">
${K.normas.map((n) => `            <li>${esc(n)}</li>`).join('\n')}
          </ul>
          <p class="fino">${esc(K.pago)}</p>
          <p class="condiciones__otra">¿Prefieres hablarlo? ${TEL} · ${CORREO}</p>
        </aside>
      </div>`;
}

/* ---------- contacto y cómo llegar ---------- */
function contacto() {
  const ruta = (r) => {
    const s = r.sitio && SITIOS ? SITIOS[r.sitio] : null;
    return `          <div><dt>${esc(r.desde)}</dt><dd>${s ? `<span class="cifra contacto__t">${tiempoTxt(s.minutos)}</span><span class="cifra contacto__km">${kmTxt(s.km)} km</span>` : ''}${r.texto ? `<p>${esc(r.texto)}</p>` : ''}</dd></div>`;
  };
  const q = `${D.nombre}, ${D.lugar.pueblo}, ${D.lugar.cp} ${D.lugar.municipio}, ${D.lugar.provincia}`;
  return `    <div class="env contacto__in">
      <div class="contacto__texto">
        <h2 class="sec-tit" id="t-contacto">Cómo llegar</h2>
        <p class="contacto__dir">${esc(D.lugar.calle)}<br><span class="cifra">${D.lugar.cp}</span> ${esc(D.lugar.municipio)}, ${esc(D.lugar.provincia)}</p>
        <p class="sec-sub">En Penlés, apartada de la carretera general${CD.hitos[1] && CD.hitos[1].tipo === 'cruce' ? `: el cruce con la AS-15 queda a <span class="cifra">${kmTxt(CD.hitos[1].km)} km</span>` : ''}.</p>
        <dl class="contacto__rutas">
${D.llegar.map(ruta).join('\n')}
        </dl>
        <ul class="contacto__medios">
          <li>${ico('tel', 24)}${TEL}<small>Teléfono</small></li>
          <li>${ico('whatsapp', 24)}<a href="${WA}" target="_blank" rel="noopener">WhatsApp<span class="vh"> (se abre en otra pestaña)</span></a><small>El mismo número</small></li>
          <li>${ico('correo', 24)}${CORREO}<small>Correo</small></li>
        </ul>
      </div>
      <div class="mapa" id="mapa" data-q="${esc(q)}">
        <button class="mapa__btn" type="button" id="mapa-btn">${ico('mapa', 34)}<b>Ver el mapa</b><small>Se carga Google Maps, que puede poner sus cookies.</small></button>
      </div>
    </div>`;
}

/* ---------- el pie: el robledal (el mismo roble de la portada, repetido) ---------- */
function bosque() {
  const SUELO = 900, CX = 500, Y0 = 560;
  //        x     escala  capa (0 = al fondo)
  const A = [[300, 0.26, 0], [840, 0.22, 0], [1240, 0.25, 0], [1960, 0.24, 0],
    [110, 0.38, 1], [1010, 0.36, 1], [2190, 0.38, 1],
    [560, 0.56, 2], [1560, 0.6, 2]];
  const uno = ([x, s, capa]) => `        <use class="bosque__arbol bosque__arbol--${capa}" href="#roble-arbol" transform="translate(${(x - CX * s).toFixed(1)} ${(Y0 - SUELO * s).toFixed(1)}) scale(${s})"/>`;
  return `    <svg class="bosque" viewBox="0 0 2400 572" preserveAspectRatio="xMidYMax slice" focusable="false">
${A.map(uno).join('\n')}
    </svg>`;
}
function creditos() {
  const fotos = COMMONS.map((c) => `<a href="${esc(c.pagina)}">${esc(c.pie)}</a>, de ${esc(c.autor)} (<a href="${esc(c.licenciaUrl)}">${esc(c.licencia)}</a>)`).join('; ');
  return `    <div class="pie__creditos">
      <h2 class="pie__h">Fotos y datos</h2>
      <p>Fotos de la casa, de los apartamentos y de la miel: las de la propia casa en su web. Las del salón verde y el dormitorio azul son de su ficha en Turismo Asturias. Paisaje, de Wikimedia Commons: ${fotos}. Relieve y alturas: © Instituto Geográfico Nacional (MDT, CC BY 4.0). Carreteras y sitios: © colaboradores de OpenStreetMap (ODbL), rutas con OSRM. Condiciones de Muniellos: Principado de Asturias. Iconos: Phosphor (MIT). El roble de la portada está redibujado a partir del logotipo de la casa.</p>
    </div>`;
}

/* ---------- los datos que leen los módulos ---------- */
function datos() {
  const json = (id, o) => `<script type="application/json" id="${id}">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;
  const fotos = {};
  for (const c of COMMONS) { const f = FOTOS.get(c.nombre); if (f && c.sitio) fotos[c.sitio] = { n: c.nombre, alt: c.alt, pie: c.pie, autor: c.autor, licencia: c.licencia, licenciaUrl: c.licenciaUrl, pagina: c.pagina, anchos: f.anchos, ancho: f.ancho, alto: f.alto }; }
  const dist = DIST ? { fecha: DIST.fecha, casa: DIST.casa, relieve: DIST.relieve, orden: DIST.orden.filter((id) => SITIOS[id]), grupos: GRUPOS, sitios: SITIOS, fotos } : null;
  const res = { motor: D.motor, precioDesde: D.precioDesde, contacto: { tel: C.telefono.tel, telTxt: C.telefono.texto, correo: C.correo }, apartamentos: D.apartamentos.map((a) => ({ id: a.id, nombre: a.nombre, cama: a.cama, m2: a.m2 })), dispo: DISPO };
  const muni = { horario: D.muniellos.horario, mesesMartes: D.muniellos.mesesMartes };
  return [json('datos-camin', CD), dist ? json('datos-distancias', dist) : '', json('datos-reserva', res), json('datos-muniellos', muni)].join('\n');
}

/* ---------- partes y ausentes ---------- */
const partes = (html, prof = 0) => html.replace(/<!--parte:([^\s>]+)\s*-->/g, (m, ruta) => {
  const f = path.join(RAIZ, ruta);
  if (!fs.existsSync(f)) { console.warn('  (falta ' + ruta + ')'); return `<!-- sin ${ruta} -->`; }
  if (prof > 3) throw new Error('Partes anidadas de más: ' + ruta);
  return partes(fs.readFileSync(f, 'utf8').trim(), prof + 1);
});
const DE_LUGAR = new Set(['css/lugar.css', 'js/lugar.js']);
const quitarAusentes = (html) => html
  .replace(/[ \t]*<link rel="stylesheet" href="(css\/[^"?]+)"[^>]*>\r?\n?/g, (m, r) => (DE_LUGAR.has(r) || existe(r) ? m : (console.warn('  (sin ' + r + ': se quita su <link>)'), '')))
  .replace(/[ \t]*<script src="(js\/[^"?]+)"[^>]*><\/script>\r?\n?/g, (m, r) => (DE_LUGAR.has(r) || existe(r) ? m : (console.warn('  (sin ' + r + ': se quita su <script>)'), '')));
for (const r of DE_LUGAR) if (!existe(r)) console.warn(`  (aún no está ${r}, de Lugar 3D: la etiqueta se queda y la página usa el respaldo)`);

const fuentes = fs.readdirSync(RAIZ).filter((f) => f.endsWith('.src.html'));
for (const src of fuentes) {
  let html = quitarAusentes(partes(fs.readFileSync(path.join(RAIZ, src), 'utf8')));
  const rep = (marca, fn) => { if (html.includes(marca)) html = html.split(marca).join(fn()); };
  html = html.replace(/\{\{KM_TOTAL\}\}/g, KM_TOTAL).replace(/\{\{MIN_TOTAL\}\}/g, String(CAMIN.minutos));
  rep('<!--historia-->', () => esc(D.casa.historia));
  rep('<!--materiales-->', materiales);
  rep('<!--comun-->', () => esc(D.comun));
  rep('<!--apartamentos-->', apartamentos);
  rep('<!--vistazo-->', vistazo);
  rep('<!--servicios-->', servicios);
  rep('<!--visita-->', visita);
  rep('<!--lugar-respaldo-->', lugarRespaldo);
  rep('<!--distancias-->', distancias);
  rep('<!--muniellos-->', muniellos);
  rep('<!--decasa-->', decasa);
  rep('<!--libro-->', libro);
  rep('<!--reserva-->', reserva);
  rep('<!--contacto-->', contacto);
  rep('<!--bosque-->', bosque);
  rep('<!--creditos-->', creditos);
  rep('<!--menu-contacto-->', () => `${TEL}${CORREO}`);
  rep('<!--pie-donde-->', () => `${esc(D.lugar.calle)}<br><span class="cifra">${D.lugar.cp}</span> ${esc(D.lugar.municipio)}, ${esc(D.lugar.provincia)}`);
  rep('<!--pie-contacto-->', () => `${TEL}<br><a href="${WA}" target="_blank" rel="noopener">WhatsApp</a><br>${CORREO}`);
  rep('<!--pie-redes-->', () => `<a href="${C.instagram}" target="_blank" rel="noopener">Instagram</a><br><a href="${C.facebook}" target="_blank" rel="noopener">Facebook</a><br><a href="${D.web}" target="_blank" rel="noopener">Su web actual</a>`);
  rep('<!--pie-titular-->', () => `© <span id="anno">${new Date().getFullYear()}</span> ${esc(D.nombre)} · Registro de turismo <span class="cifra">${D.registro}</span> · ${D.categoria}`);
  rep('<!--datos-->', datos);
  html = html.replace(/<img\b([^>]*\bdata-foto="[^"]+"[^>]*)>/g, (m, a) => picture(a.replace(/\s*\/$/, '')));
  const destino = src.replace('.src.html', '.html');
  fs.writeFileSync(path.join(RAIZ, destino), html);
  console.log(`${src} → ${destino} (${(html.length / 1024).toFixed(0)} KB)`);
}
execFileSync(process.execPath, [path.join(RAIZ, 'versionar.mjs')], { stdio: 'inherit' });
