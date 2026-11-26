/* Genera los *.src.html de las páginas legales y el 404 con una plantilla común (receta de Alba y Montemar).
   Uso: node scripts/legales.mjs  (después, node construir.mjs)
   Titular: el de ref/DATOS-MUNIELLOS.md (data/muniellos.json). Solo castellano; noindex en todas. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const D = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data/muniellos.json'), 'utf8'));
const T = D.titular, C = D.contacto;
const TEL = `<a href="tel:${C.telefono.tel}">${C.telefono.texto}</a>`;
const CORREO = `<a href="mailto:${C.correo}">${C.correo}</a>`;
const MOTOR = `<a href="${D.web}">camindemuniellos.com</a>`;

const TITULAR = `<dl>
  <dt>Titular</dt><dd>${T.nombre}</dd>
  <dt>NIF</dt><dd>${T.nif}</dd>
  <dt>Domicilio</dt><dd>${T.domicilio}</dd>
  <dt>Nombre comercial</dt><dd>${D.nombre}</dd>
  <dt>Teléfono</dt><dd>${TEL}</dd>
  <dt>Correo</dt><dd>${CORREO}</dd>
  <dt>Registro de turismo</dt><dd>${D.registro} (apartamentos rurales, ${D.categoria})</dd>
</dl>
<p class="aviso">PENDIENTE: revisar estos textos con la casa antes de publicar. Esta web es una propuesta que nadie ha encargado todavía; los datos del titular son los del aviso legal de su web actual.</p>`;

const paginas = {
  'aviso-legal': {
    titulo: 'Aviso legal',
    cuerpo: `
<p>En cumplimiento del artículo 10 de la Ley 34/2002, de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE), estos son los datos del titular de esta web:</p>
${TITULAR}
<h2>Uso de la web</h2>
<p>Esta web informa sobre ${D.nombre}, tres apartamentos rurales en Penlés (Cangas del Narcea, Asturias). Los precios «desde» son los que publica la casa; el precio, la disponibilidad y las condiciones de cada reserva los confirma su motor de reservas.</p>
<p>El calendario de «Elige fechas» enseña la ocupación que devolvió el motor de reservas de la casa en la última lectura, con su fecha y su hora a la vista. No reserva nada: al elegir fechas se abre la página de reservas de ${MOTOR}, donde se contrata y se paga. La reserva existe cuando esa web la confirma.</p>
<h2>Propiedad intelectual</h2>
<p>Los textos son de esta web y de la casa. El roble de la portada está redibujado a partir del logotipo de ${D.nombre}, que es de sus titulares. Las fotos de la casa, de los apartamentos y de la miel son las que la casa publica en su web; dos (el salón verde y el dormitorio azul) vienen de su ficha en Turismo Asturias.</p>
<p class="aviso">PENDIENTE: confirmar con la casa el uso de sus fotos y del logotipo redibujado, y pedirle las fotos originales.</p>
<p>Las fotos del paisaje son de Wikimedia Commons, cada una con su autor y su licencia libre (Creative Commons), citados en el pie de la página principal.</p>
<p>El relieve y las alturas salen del Modelo Digital del Terreno del Instituto Geográfico Nacional: «© Instituto Geográfico Nacional», CC BY 4.0. Las carreteras, los sitios y las rutas son de OpenStreetMap (© colaboradores de OpenStreetMap, ODbL, <a href="https://www.openstreetmap.org/copyright">openstreetmap.org/copyright</a>), con el enrutador OSRM. Las condiciones de visita a Muniellos son las que publica el Principado de Asturias.</p>
<p>Las letras Readex Pro, Inclusive Sans, Signika y Shadows Into Light Two se usan con su licencia libre (SIL Open Font License) y van alojadas en esta misma web. Los iconos son de Phosphor Icons (licencia MIT).</p>
<p>La sección «De la casa a Muniellos» usa el relieve y la foto aérea del IGN (CC BY 4.0) y la cartografía de la Dirección General del Catastro.</p>
<h2>Responsabilidad</h2>
<p>Los enlaces a otras webs (el motor de reservas de la casa, la visita 360 y el mapa de Google, la web del Principado) llevan a servicios de terceros con sus propias condiciones. Los tiempos por carretera son orientativos.</p>
<h2>Ley aplicable</h2>
<p>Estas condiciones se rigen por la ley española.</p>`,
  },
  privacidad: {
    titulo: 'Política de privacidad',
    cuerpo: `
<h2>Responsable</h2>
${TITULAR}
<h2>Qué datos tratamos y para qué</h2>
<p>Los que nos das al escribirnos o al llamarnos: nombre, teléfono, correo, las fechas, cuántos venís y lo que quieras contarnos. Los usamos para contestarte y gestionar tu reserva.</p>
<p>Al alojarte, la ley obliga a registrar los datos de los viajeros y comunicarlos a las autoridades (Real Decreto 933/2021).</p>
<h2>El calendario de la web</h2>
<p>El calendario no guarda ni envía nada: funciona en tu navegador con una copia de la ocupación. El botón «Reservar en su web» abre el motor de reservas de ${MOTOR} con las fechas elegidas; los datos de la reserva y del pago los recoge esa web, con su propia política de privacidad.</p>
<h2>Base legal y plazos</h2>
<p>La base es tu consentimiento al escribirnos, la gestión de la reserva que pides y, para el registro de viajeros, una obligación legal. Los datos se guardan mientras dura la relación y, después, el tiempo que exige la ley.</p>
<h2>Con quién se comparten</h2>
<p>Con nadie, salvo lo que obliga la ley (el registro de viajeros).</p>
<h2>Tus derechos</h2>
<p>Puedes pedir el acceso, la rectificación, la supresión, la oposición, la limitación o la portabilidad de tus datos escribiendo a ${CORREO} o llamando al ${TEL}. Si crees que no se han respetado, puedes reclamar ante la Agencia Española de Protección de Datos (<a href="https://www.aepd.es">aepd.es</a>).</p>
<h2>Lo que guarda esta web en tu navegador</h2>
<p>Una sola cosa: <code>camin-cookies</code> en el almacenamiento local, para recordar que ya has visto el aviso de cookies. Más detalles en <a href="cookies.html">cookies</a>.</p>`,
  },
  cookies: {
    titulo: 'Política de cookies',
    cuerpo: `
<p>Esta web no usa cookies propias de análisis ni de publicidad.</p>
<h2>Lo que se guarda en tu navegador</h2>
<ul>
  <li><b>camin-cookies</b> (almacenamiento local): recuerda que has visto el aviso, para no enseñártelo en cada visita. Es técnica y no caduca sola; puedes borrarla desde tu navegador.</li>
</ul>
<h2>Servicios de terceros</h2>
<ul>
  <li><b>Visita 360 (Google Maps)</b>: solo se carga si pulsas «Abrir la visita 360». Es una panorámica alojada en Google Maps; a partir de ese momento, Google puede poner sus cookies.</li>
  <li><b>Google Maps</b>: el mapa de «Cómo llegar» solo se carga si pulsas «Ver el mapa». A partir de ese momento, Google puede poner sus cookies.</li>
  <li><b>WhatsApp</b>: el enlace abre WhatsApp en otra pestaña; hasta que lo pulsas, no se carga nada suyo.</li>
  <li><b>El motor de reservas de la casa</b>: «Reservar en su web» abre ${MOTOR} en otra pestaña, con sus propias cookies.</li>
</ul>
<h2>Las letras, los dibujos y el 3D</h2>
<p>Las letras, el roble, el mapa de «A cuánto queda», el calendario y la escena en 3D se sirven desde esta misma web y se dibujan en tu navegador: no ponen cookies ni llaman a otros servidores.</p>
<p>Puedes volver a ver el aviso desde «Preferencias de cookies», en el pie de la página.</p>
<p class="aviso">PENDIENTE: si la escena en 3D de «De la casa a Muniellos» pide datos a otro servicio, añadirlo aquí. Ver LUGAR.md.</p>`,
  },
  accesibilidad: {
    titulo: 'Declaración de accesibilidad',
    cuerpo: `
<p>El titular se compromete a que esta web sea accesible conforme a la norma UNE-EN 301 549 (nivel AA de las WCAG 2.1).</p>
<h2>Situación de cumplimiento</h2>
<p class="aviso">PENDIENTE: completar tras la revisión de accesibilidad previa a la publicación.</p>
<p>La web se ha construido para poder usarse entera con el teclado y con lector de pantalla: contrastes de al menos 4,5:1 en el texto, foco visible, textos alternativos en las fotos, el calendario y la lista de sitios con flechas, y animaciones que se quitan si tu sistema pide reducir el movimiento. El roble, el mapa y el 3D son un apoyo: la información está también en el texto y en tablas.</p>
<h2>Contenido de terceros</h2>
<p>La visita 360 y el mapa de Google, y el motor de reservas de la casa, no dependen de esta web: su accesibilidad es la de sus servicios.</p>
<h2>Contacto</h2>
<p>Si encuentras una barrera, llama al ${TEL} o escribe a ${CORREO}. Te daremos la información en un formato accesible.</p>`,
  },
};

const cabeza = (titulo) => `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex, nofollow">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titulo} · Camín de Muniellos</title>
<link rel="stylesheet" href="css/fuentes.css">
<link rel="stylesheet" href="css/base.css">
<link rel="stylesheet" href="css/estilos.css">
<link rel="stylesheet" href="css/legal.css">
<link rel="icon" href="marca/favicon.svg" type="image/svg+xml">
<link rel="icon" href="marca/favicon-32.png" sizes="32x32" type="image/png">
</head>`;
const MARCA = `<a class="legal-marca" href="./" aria-label="Camín de Muniellos, a la portada"><!--parte:partes/marca.svg--><span>Camín de Muniellos</span></a>`;

for (const [nombre, p] of Object.entries(paginas)) {
  fs.writeFileSync(path.join(RAIZ, `${nombre}.src.html`), `${cabeza(p.titulo)}
<body>
<header class="legal-cab">
  <div class="env">
    ${MARCA}
    <a class="volver" href="./">Volver a la portada</a>
  </div>
</header>
<main class="legal">
  <div class="env">
    <h1>${p.titulo}</h1>
${p.cuerpo}
  </div>
</main>
<footer class="legal-pie">
  <div class="env">
    <a href="aviso-legal.html">Aviso legal</a>
    <a href="privacidad.html">Privacidad</a>
    <a href="cookies.html">Cookies</a>
    <a href="accesibilidad.html">Accesibilidad</a>
  </div>
</footer>
</body>
</html>
`);
  console.log(`${nombre}.src.html`);
}
// el 404: el roble en invierno (sin hoja, con las hojas en el suelo)
fs.writeFileSync(path.join(RAIZ, '404.src.html'), `${cabeza('Página no encontrada')}
<body class="no-hay">
  <main class="no">
    <div class="no__dibujo">
<!--parte:partes/roble.svg-->
    </div>
    <h1>Por aquí no pasa el camín</h1>
    <p>La página que buscas no existe o ha cambiado de sitio. La casa sigue en Penlés, en el kilómetro cero del camino a Muniellos.</p>
    <p class="no__acc"><a class="btn btn--acento" href="./#reservar">Ver fechas</a><a class="btn btn--linea" href="./">Volver a la portada</a></p>
  </main>
</body>
</html>
`);
console.log('404.src.html');
