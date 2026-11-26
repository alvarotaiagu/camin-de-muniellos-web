# Camín de Muniellos · «El roble y el camín»

Propuesta de web para **Camín de Muniellos** (Penlés n.º 4, 33814 Cangas del Narcea, Asturias): una casa asturiana
restaurada en 2008 con tres apartamentos rurales de 3 llaves (Carujo, Fonrín y Xelín), en la carretera que sube a la
Reserva de Muniellos. No la han encargado. Una sola página (`index.html`) más legales y 404. **En local, sin publicar y
sin commits.** `noindex, nofollow` en todas las páginas. Solo castellano.

Encargo: `ENCARGO.md`. Datos: `ref/DATOS-MUNIELLOS.md` → `data/muniellos.json` (lo que no está ahí, en `PENDIENTES.md`).
El 3D («De la casa a Muniellos») y `data/lugar-camin.json` son del agente Lugar 3D: sus notas, en [`LUGAR.md`](LUGAR.md).

## El concepto

**Su logo hecho literal: un roble y una línea de suelo.** «Camín» es camino, y la casa está en el kilómetro cero de la
carretera que acaba en Muniellos, el mayor robledal de España.

- **Portada**: el roble de su logo **redibujado en vector** (el original solo existe a 300 px), con «CAMIN de
  MUNIELLOS» rodeando la copa y «apartamentos rurales» debajo, como en el logo. El roble lleva **la hoja de la estación
  de hoy** (brote, verde, ocre, desnudo) y una frase que lo dice sin fingir dato en vivo («Finales de noviembre: el
  robledal está ocre y va perdiendo la hoja»). En otoño el roble es, tal cual, su logo: en ocre.
- **El camín**: la línea de suelo del logo sale de la portada, dobla y baja por el margen de toda la página hasta el
  pie. Es un solo trazo con **mojones de kilómetro reales** (los 13 hitos de `data/lugar-camin.json`: la casa, el cruce
  con la AS-15, La Regla, Vega de Pope, Cibuyo… Ventanueva, Moal, Tablizas). Cada mojón cae **en su kilómetro, a
  escala**, y los meandros de la línea son los de la carretera real (cuánto se aparta de la recta casa → Tablizas).
  Un punto, el caminante, va por la línea a la altura de lectura y dice por qué kilómetro vas (también en la cabecera).
- **El pie lo cierra**: la línea llega al robledal, el mismo roble de la portada repetido hasta hacer bosque, con la
  hoja de hoy: «km 19,6. Tablizas. Aquí empieza Muniellos».

Lectura de diseño (`design-taste-frontend`): página de alojamiento para quien decide y reserva; lenguaje de marca
(línea fina, un solo ocre) y de dato (kilómetros, alturas, ocupación real); diales 7 / 6 / 4. Un solo tema, claro;
`#lugar` es el único tramo oscuro (contrato con el 3D): es el bosque. Formas: botones y mandos con **forma de mojón**
(redondos arriba, rectos abajo); fotos y cajas, 5 px.

### Las letras (autoalojadas en `fuentes/`, SIL OFL; `scripts/fuentes.py`)

- **Shadows Into Light Two**: la manuscrita de línea fina más parecida a la del logo. El nombre de la portada va en
  **trazados** (no depende de que cargue la letra); como letra, solo en el libro de visitas.
- **Readex Pro** fina (300): titulares, por las mayúsculas finas del logo.
- **Inclusive Sans**: texto.
- **Signika**: cifras y mojones. Es una letra de señalización: aquí marca kilómetros.

Las cuatro tienen €, ñ, tildes, ¡ ¿ y « » (lo comprueba `scripts/fuentes.py`). Ninguna estaba en la cartera al
elegirlas; el mismo día, después, `casa-freixe-oscos-web` cogió Inclusive Sans.

### Los colores (`css/base.css`; `node scripts/paleta.mjs`: todas las parejas llegan a su mínimo)

| Uso | Color |
|---|---|
| Marca: la línea del roble, del camín y de los mojones | `#CE6B0F`, el ocre del logo medido en su PNG (206, 107, 15) |
| Botón principal | `#B25905`: el ocre oscurecido lo justo para llevar texto blanco (4,86:1; APCA Lc 79 frente a 28 de la tinta) |
| Ocre como texto y foco | `#9A4B00` (5,7:1 sobre el fondo) |
| Fondo / tramo alterno / cajas | `#F5F6F2` niebla · `#EBEEE6` · `#FCFCFA` |
| Texto / secundario | `#17231C` · `#4E5B53` |
| Hoja según la estación | brote `#86A93A` → verde `#2F7A3B` → ocre de la marca |
| Carujo / Fonrín / Xelín | `#B7C83F` verde limón · `#2F64AE` azul · `#D3BD95` arena (solo en su ficha y en el calendario) |
| `#lugar` (oscura) | fondo `#101714`, texto `#EEF1EA`, ocre `#E07F24`, enlaces `#F0A256` |

Ningún texto se apaga con opacidad: se apaga con color.

## Las secciones

1. **Portada** (`js/roble.js`, `Camin.roble`). Titular, una frase con los km reales del camín y «Ver fechas». **Gesto**:
   arrastrar el roble en horizontal recorre el año (brota, verdea, se pone ocre, pierde la hoja) y al soltar vuelve a
   hoy; con teclado es un deslizador (flechas ±10 días, Inicio = hoy). `touch-action: pan-y`. `?fecha=AAAA-MM-DD`.
2. **La casa**: la foto de la fachada, grande y a sangre, con `mix-blend-mode: multiply` para que su cielo quemado se
   funda con la página; 2008, los nombres de los apartamentos y los cuatro materiales (piedra, corredor, pizarra, hórreo).
3. **Los tres apartamentos**: en escritorio, tres fichas en fila; la abierta se lleva el sitio y las otras dos quedan
   en resumen (nombre, cama y m²). Cifras grandes (cama, m², personas, desde 80 €), su color real, la terraza como punto
   fuerte y la foto que hay. Debajo, los 12 servicios en tres grupos, con icono. En el móvil, las tres abiertas.
4. **Por dentro**: su panorámica 360 de Google, **creada solo al pulsar**, con el aviso de contenido externo.
5. **De la casa a Muniellos** (`#lugar`): el 3D de Lugar. Respaldo de la Web: el **perfil real del camín** (cotas del
   MDT) y sus 13 hitos con km y altura.
6. **A cuánto queda** (`js/distancias.js`): mapa propio sobre el sombreado real del relieve (MDT25 y MDT200 del IGN),
   con la casa en el centro y los sitios como mojones. El mando es una **regla de kilómetros** que se arrastra, o
   «Tengo 20 min / 1 hora / medio día»: lo que queda dentro se enciende en el mapa, en la regla y en la lista. Al elegir
   un sitio se dibuja su carretera real y la ficha da km, minutos, carreteras, perfil de altura, foto y la ruta en
   Google Maps. Sin JS, la tabla.
7. **Muniellos, veinte al día**: cupo, cómo pedir la visita (enlace oficial vivo), confirmar entre 23 y 15 días antes,
   qué llevar, por dónde se entra, el horario **del mes en curso** destacado y las dos rutas.
8. **Lo de casa**: miel «El Tío Ángel», granja, placas solares y Club Ecoturismo, con sus fotos del colmenar.
9. **Libro de visitas**: nueve notas literales de su web, con firma y fecha, en la manuscrita. Sin nota ni recuento.
10. **Reservar** (`js/reserva.js`): **ocupación real** de los tres apartamentos, con la fecha y la hora de la lectura a
    la vista; por día, qué apartamentos están libres. Respeta la estancia mínima y los días sin entrada o salida del
    motor. Al elegir fechas, «Reservar en su web» abre **su** buscador con las fechas, en otra pestaña. No envía nada.
11. **Cómo llegar y contacto**: tiempos de OSRM desde Oviedo y el aeropuerto, sus indicaciones, teléfono, WhatsApp,
    correo y Google Maps solo al pulsar.

Legales (`scripts/legales.mjs`) con el titular de DATOS. 404 «Por aquí no pasa el camín» (el roble sin hoja).

## Fotos (regla dura del encargo)

- **Suyas** (`ref/origen/web/`): fachada, dormitorio con mecedora, terraza, dormitorio de la ficha de Fonrín, jardín y
  las de la miel (colmenar, tarro, expositor, apicultores). Sus «2560 px» están ampliados: se sirven a 1920 como mucho.
- **`20190526_162018-scaled.jpg` no se publica** (dos niñas). Tampoco `paisajes-de-Muniellos.jpg` (es un recorte de una
  foto de Commons, no suya). Lo comprueba `verificar.mjs`.
- **Turismo Asturias** (708 px, sin marca): salón verde, dormitorio azul y casa nevada, pequeñas. La del salón con
  chimenea no se usa.
- **Wikimedia Commons** (`scripts/commons.json`, licencia comprobada una a una): robledal de Muniellos (Tanja Freibott,
  CC BY-SA 3.0 ES), arroyo de Muniellos (Javier Pérez, CC BY-SA 3.0), monasterio de Corias (Paradores, CC BY-SA 4.0),
  Cangas del Narcea y Leitariegos (Carmenmoran, CC BY 4.0). Créditos en el pie y en la ficha de cada sitio.
- La galería por estancias no está montada (no hay fotos para ello): `data/fotos.json` queda preparado.

## Datos (cómo se rehacen)

```
node scripts/disponibilidad.mjs        # DOS GET a su web (nonce + ocupación) → data/disponibilidad.json
node scripts/distancias-rutas.mjs      # sitios (OSM por id) y rutas OSRM desde la casa → ref/raw/rutas.json
python -I -X utf8 scripts/relieve.py   # MDT25/MDT200 del IGN → img/relieve/, data/distancias.json (perfiles)
python -I -X utf8 scripts/roble.py     # el roble → partes/roble.svg (semilla fija: siempre el mismo dibujo)
python -I -X utf8 scripts/fotos.py     # img/fotos/ (WebP y JPG, nunca amplía) + img/og.jpg
python -I -X utf8 scripts/fuentes.py   # fuentes/ + css/fuentes.css
python -I -X utf8 scripts/marca.py     # marca pequeña, favicons y manifest
node scripts/iconos.mjs                # Phosphor «light» (MIT) → partes/iconos.html
node scripts/legales.mjs               # *.src.html de las legales y el 404
node scripts/paleta.mjs                # contraste (sale con 1 si algo no llega)
node construir.mjs                     # partes + datos → *.html; versionar.mjs pone ?v=<huella>
node verificar.mjs                     # Playwright, puerto 8981 (o PUERTO=8991 si está ocupado)
```

- **La casa y el camín**: `data/lugar-camin.json` (Lugar 3D; casa comprobada sobre el Catastro). De ahí salen los km de
  la portada, los mojones, el respaldo de `#lugar` y los km de Moal y Tablizas en «A cuánto queda» (no puede haber dos
  cifras para el mismo sitio).
- **Distancias: solo OSRM.** Su web da 15 y 19 km a Muniellos, 5 a Cangas, 6 al hospital, 39 a Leitariegos y 86 al
  aeropuerto; OSRM da 19,6 · 6 · 7,8 · 40,3 y 88,2.
- **Sitios comprobados en OSM** (2026-11-26): Cangas del Narcea, Hospital Carmen y Severo Ochoa, Museo del Vino,
  Monasterio de Corias, Moal, Centro de Interpretación de Muniellos, parking de Tablizas, Besullo, Llamas del Mouro,
  Puerto de Leitariegos (1.525 m), estación de esquí de Leitariegos, Oviedo y aeropuerto de Asturias.
- **Muniellos**: `ref/raw/muniellos-oficial.txt` (ficha del trámite en miprincipado.asturias.es, leída el 2026-11-26).

## Módulos y contrato

| Módulo | Agente | Hueco | Ficheros |
|---|---|---|---|
| `roble` | Web | `#arbol` (respaldo: el dibujo fijo, el logo) | `js/roble.js`, `partes/roble.svg` |
| `camin` | Web | `#camin` (respaldo: una línea sencilla) | `js/camin.js`, `<script id="datos-camin">` |
| `lugar` | Lugar 3D | `#lugar [data-modulo="lugar"]` (respaldo: el perfil del camín) | `js/lugar.js`, `css/lugar.css`, `img/lugar/`, `data/lugar*.json` |
| `distancias` | Web | `[data-modulo="distancias"]` (respaldo: la tabla) | `js/distancias.js`, `img/relieve/` |
| `reserva` | Web | `[data-modulo="reserva"]` (respaldo: el enlace a su motor) | `js/reserva.js` |

`Camin.<mod>.montar(el, { movimiento, densidad, webgl })` → `{ destruir() }`. `main.js` monta el roble y el camín al
cargar y el resto al acercarse (900 px); si un módulo falla, vuelve su respaldo. `js/ahora.js` va el primero:
`Camin.ahora()` con `?fecha=` y `?hora=`. Eventos: `camin:resize` (resizes de verdad, no la barra del móvil) y
`camin:densidad`. La Web no carga Three.js. Sin GSAP ni Lenis.

## Mando de densidades (solo con `?revision`)

`index.html?revision` enseña «Versión: **Camín** / **Sobria**» abajo a la izquierda (se aparta mientras está el aviso
de cookies). Sin `?revision` no existe.

- **Camín** (cargada): la línea con mojones por toda la página, el caminante y el gesto del roble.
- **Sobria**: el camín solo donde significa algo (la portada y el pie), el roble con la hoja de hoy sin gesto, y
  **añade** dos tablas: «De un vistazo» (los tres apartamentos comparados) y «El camín, kilómetro a kilómetro».

### Receta de borrado (antes de enseñársela al cliente como web suya)

1. `partes/cabeza.html`: borrar desde `// MANDO DE MAQUETA` hasta `// fin del MANDO DE MAQUETA`.
2. `partes/pie.html`: borrar desde `<!-- MANDO DE MAQUETA` hasta `<!-- fin del MANDO DE MAQUETA -->`.
3. `js/main.js`: borrar el bloque `/* ============ 12. MANDO DE MAQUETA` … `/* fin del MANDO DE MAQUETA */`.
4. `css/estilos.css`: borrar desde `/* MANDO DE MAQUETA` hasta `/* fin del MANDO DE MAQUETA */`.
5. `node construir.mjs && node verificar.mjs` (el bloque 1 comprueba esta receta sobre copias en memoria).

## Nivel (§5 bis) y «no repetir» (§3 bis)

- **Fórmula rota**: sin cortina, sin pila sticky, sin marquesina, sin cursor propio, sin letra a letra, sin botones
  magnéticos y sin GSAP ni Lenis. **Pieza propia**: el camín con mojones a escala y el caminante.
- **Gesto táctil del hero**: arrastrar el roble por el año (probado con toques reales por CDP, bloque 13).
- **El objeto se completa en el pie**: el roble se vuelve robledal y la línea llega a Tablizas.
- **Foco con forma propia**: un mojón (arco arriba, abierto abajo) sobre una línea de suelo que sobresale.
- **Menú §5 bis**: rótulo del hero en trazados SVG, y dato real más allá del horario (la ocupación de su motor).

`node ../plantillas-negocios-web/scripts/repeticion.mjs ../camin-de-muniellos-web` (2026-11-26): en las últimas diez
webs no domina ninguna pieza. «camin-de-muniellos-web usa: ninguna del kit (crema + acento chillón: fondo #F5F6F2)»
→ **Repite 0 de las dominantes (tope 2)**. El fondo es un casi blanco frío, no crema.

## Rendimiento

Medido el 2026-11-26 en `verificar.mjs` (bloque 12: 412×915, escala 1, CPU ×4, 4G lenta 1,6 Mb/s y 150 ms, 3D vacío):
**LCP 1,32 s** (el titular de la portada) y **dos tareas largas al cargar, de 60 y 312 ms** (montar el roble y trazar
el camín, con la CPU estrangulada). **INP sin medir.** Sin canvas ni WebGL en la parte de la Web (el 3D tiene su
presupuesto en `LUGAR.md`). El roble solo se repinta mientras se arrastra; el camín hace un cálculo por fotograma de
scroll; el bosque del pie lleva `content-visibility: auto`. `index.html` pesa 218 KB (84 del roble en línea).

## Verificación

`PUERTO=8991 node verificar.mjs` (2026-11-26; el 8981 lo tenía otro servidor): **199 bien, 0 mal**. La primera pasada
dio 191 bien y 8 mal: tres fallos eran de la web y se arreglaron (las fichas de las rutas de Muniellos se llamaban
`.ruta`, igual que los trazados del mapa, y heredaban sus estilos; el correo del pie se salía por la derecha en el
móvil; al saltar a una sección, lo que se montaba por encima la desplazaba) y cinco eran de la propia prueba.
Trece bloques: archivos, textos, fotos y contrato; portada a cinco tamaños y cinco fechas; el camín (mojones a escala,
caminante); la casa y los apartamentos; visita, mapa y cookies; el hueco del 3D; a cuánto queda; Muniellos; reservar;
móvil; sin JS, legales y 404; foco, contraste, mando y rendimiento; y, con movimiento, el gesto con ratón y con dedo.

## Qué mirar en Chrome

**Nadie ha visto la web pintada**: las pruebas miden comportamiento, no aspecto (sin capturas, por las reglas del PC).
Lo único que se ha mirado es una imagen de prueba del roble, hecha con Python, sin navegador.

1. **El roble**: que se parezca al del logo y que el nombre alrededor de la copa se lea bien; que «MUNIELLOS» no pise
   las hojas. Probar `?fecha=2027-01-20`, `2027-05-05`, `2027-07-15` y `2026-10-25`.
2. **Arrastrar el roble** (ratón y dedo): que la hoja caiga y brote con gracia, y que al soltar vuelva.
3. **La línea del camín**: que salga de la línea de suelo de la portada sin escalón, que los mojones no se monten
   (hay dos muy juntos: Cibuyo y El Cristu) y que el paso por detrás de `#lugar` no se note raro.
4. **La fachada**: que el cielo se funda con la página y no quede un borde.
5. **Los tres apartamentos**: abrir y cerrar; que los colores (lima, azul, arena) no desentonen.
6. **A cuánto queda**: arrastrar la regla, «Tengo 1 hora», elegir Tablizas, Leitariegos y Oviedo.
7. **El calendario**: elegir fechas y pulsar «Reservar en su web» (ver PENDIENTES, punto 2 de Álvaro).
8. **El pie**: el robledal y la llegada de la línea.
9. `?revision` → **Sobria**. Y el **foco** con Tab.

## Decisiones tomadas (y por qué)

- **Tema claro, casi blanco y frío**: es como va su logo, deja que la foto de la fachada se funda y evita la paleta
  crema con ocre. El ocre es el único acento.
- **WhatsApp enlazado** con el 669 00 09 47: es el número del botón de chat de su propia web (DATOS decía «por
  confirmar»). A PENDIENTES para que lo confirmen.
- **Enlace oficial de Muniellos**: el de DATOS da 404; se usa el vivo de miprincipado.asturias.es.
- **«No disponible» no es «ocupado»** a partir de febrero de 2027: se dice «su motor todavía no ofrece fechas».
- **«CAMIN» sin tilde** en el dibujo del logo, como en su logo; «Camín» en los textos.
- **Sin galería por estancias** y **sin control de paleta**: ver PENDIENTES.
- **Cueto de Arbas** sin sitio propio: no está en OSM con ese nombre; se nombra en el Puerto de Leitariegos.
