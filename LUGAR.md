# Lugar 3D · «De la casa a Muniellos»

El camín (`data/lugar-camin.json`) y el módulo `lugar` de la sección `#lugar` (agente Lugar 3D, 2026-11-26).
Ficheros: `js/lugar.js`, `css/lugar.css`, `data/lugar-camin.json`, `data/lugar-escena.json`, `img/lugar/`,
`vendor/three-0.160.0.module.min.js`, `scripts/lugar-*` y `ref/raw/lugar-cache/` (caché de descargas, **146 MB**; `ref/`
ya está en `.gitignore`).

**Nadie ha visto el 3D pintado.** No se prueba con Playwright (reglas del PC): lo tiene que mirar Álvaro en su Chrome
(ver «Qué mirar»). Lo comprobado, en «Pruebas».

## El camín (`data/lugar-camin.json`) · lo usan la portada, la línea de la página y el 3D

| Dato | Valor | De dónde sale |
|---|---|---|
| Casa | 43,151667, −6,575460 · **495 m** | centro del cuerpo de la casa en el Catastro (parcela `U20301500PH98B`), cota del MDT05 |
| Destino | **Tablizas** · 43,035629, −6,681683 · **667 m** | el edificio «Centro recepción de Muniellos» de OpenStreetMap (way 412929021), en Las Tablizas |
| `kmTotal` | **19,6 km** (19.622 m) | OSRM, perfil de coche, sobre OpenStreetMap |
| `minutos` | **26** (26,3) | OSRM. Es su cálculo, optimista en carretera de montaña: decir «unos 26 min» |
| `ruta` | 462 puntos `[lon, lat, cota, km]` | geometría de OSRM (846 puntos) adelgazada con Douglas-Peucker a 1,5 m (410) más puntos intermedios para que ningún tramo pase de 100 m; cota del MDT05 suavizada ±25 m |
| `hitos` | 13 | pueblos: nodos `place` de OSM a menos de 120 m de la carretera; cruces: cambios de carretera de OSRM |

Comprobado con números: la suma de la geometría completa de OSRM da 19,610 km (−11 m frente a los 19,622 que declara
OSRM; el `km` de cada punto es el de esa suma) y la de la ruta adelgazada 19,597 km (−0,12 %). La ruta empieza a 7 m
del centro de la casa (el camino de acceso) y acaba a 15 m del centro de recepción. Baja de 495 m a **402 m** (el
cruce con la AS-15, junto al Narcea) y sube a 667 m: 351 m de subida y 183 de bajada.

**Su web dice 19 km en una página y 15 en otra: los 19 son los buenos** (19,6). Los «15 minutos» de su blog no:
son unos 26.

| km | cota | hito | fuente en OSM |
|---|---|---|---|
| 0,0 | 495 | **Camín de Muniellos** (Penlés) | el lugar: `Pinḷḷés`, node 972495071 |
| 0,75 | 403 | Cruce con la AS-15 | OSRM: se sale a la «Carretera Cornellana - Puerto de Cerredo» |
| 1,86 | 407 | La Regla | `La Riela` (name:es «La Regla»), a 31 m; aquí se cruza el ríu del Coutu (way 438196080) |
| 2,90 | 421 | Vega de Pope | `Veigaipope` (name:es «Vega de pope»: solo se ha puesto la mayúscula), a 9 m |
| 4,22 | 436 | Cibuyo | `Cibuyu`, a 56 m |
| 4,78 | 440 | El Cristu | a 5 m |
| 5,72 | 450 | Las Frauguas | a 1 m |
| 6,53 | 459 | Augüera | a 66 m |
| 7,08 | 466 | La Chana | a 29 m |
| 8,62 | 477 | Sasturrasu | a 5 m |
| 13,03 | 533 | **Ventanueva** (cruce: se deja la AS-15 y se toma la AS-348) | `La Venta` (old_name «Ventanueva»), a 5 m |
| 15,48 | 598 | Moal | `Mual`, a 107 m |
| 19,61 | 667 | **Tablizas** | `Centro recepción de Muniellos`; el lugar es `Las Tablizas` (node 4143388213) |

- Nombres: el de `name:es` de OSM si lo hay; si no, el oficial que trae OSM (El Cristu, Las Frauguas, Augüera, La
  Chana, Sasturrasu). Cada hito guarda `nombreOsm` y `osm`. **Ventanueva** sale con ese nombre (así la conoce todo
  el mundo y OSM lo guarda como `old_name`), con `alias: "La Venta"`. Ninguno inventado.
- Campos de más que no pide el contrato: `detalle`, `osm`, `nombreOsm`, `aMetros`, `alias`, `ref`; y en la raíz
  `cotaMin`, `cotaMax`, `subida`, `bajada`, `fuente`.
- Quedan fuera por estar a más de 120 m: La Pescal (198 m) y Sotiello (280 m), al otro lado del río.
- **La carretera no cruza el Narcea ni el río de Muniellos** (los sigue por una orilla): por eso no hay hitos de
  río. Solo cruza el ríu del Coutu, en La Regla (va en su `detalle`).
- **El río de Tablizas tiene dos nombres**: OSM lo llama «Río Muniellos» y el IGN (nomenclátor, vía CartoCiudad)
  «Río Tablizas». No se rotula en el 3D.
- El día de hacerlo Overpass estaba caído en todos los espejos (502 y tiempos agotados): los datos de OSM salen de
  la API principal (`/api/0.6/map`, una sola petición del corredor). El WMS del PNOA también daba 502: las
  ortofotos son del WMTS.

## La casa

- **Es la parcela `U20301500PH98B` del Catastro**, que el Catastro llama «Penlés 15» (686 m² construidos, 1899). El
  punto de su visita virtual de Google (43,1516784, −6,5753796) cae **dentro** de esa parcela, a 6,7 m del centro
  del cuerpo de la casa. En la ortofoto del PNOA se reconoce sin duda: tejado largo de pizarra con la cumbrera de
  suroeste a noreste, **cuatro buhardillas** en el faldón del sureste, el tejado a cuatro aguas del hórreo delante de
  la mitad suroeste de la fachada y la terraza redondeada en la punta noreste (la de la foto con nieve).
- **Dato dudoso: el número.** Ellos dan «Penlés n.º 4». El «Penlés 4» del Catastro (`U20300400PH98B`, 335 m², 1880)
  es **el edificio de al lado**, 25 m al norte, de teja roja: no es el de las fotos. O el Catastro numera distinto
  que el callejero, o ese edificio también es suyo. Para la web no cambia nada; conviene preguntarlo.
- La planta del Catastro explica la casa de las fotos: cuerpo de **15,6 m de largo**; muro de fachada, y por delante
  una banda de **2,05 m** (el corredor) con cuatro «dientes» de tres plantas que son las buhardillas (a 2,4, 6,5, 9,9
  y 14,4 m del extremo suroeste); cuerpo de tres plantas de 5,4 m de fondo y una crujía de dos plantas detrás, hasta
  7,3 m. **El corredor mira al sureste (rumbo 140°)**, hacia el valle. En la misma parcela hay otro edificio
  cuadrado al suroeste (10 × 12 m, tres plantas): va como vecino, sin detalle.
- **En el 3D**: planta baja de mampostería (lajas gris azulado y ocres), planta primera en crema, corredor de madera
  en voladizo a todo lo largo con canes, seis pies derechos y 139 balaustres torneados, tejado de pizarra a dos
  aguas que cubre el corredor, las cuatro buhardillas con su tejadillo de alero ancho, chimenea de piedra por fuera
  del hastial noreste, ventana ancha y portón de madera en la planta baja, geranios, la terraza de piedra sobre su
  planta del Catastro y el hórreo (pegollos con muelas, caja de madera oscura, pizarra a cuatro aguas).
  **De la planta salen el largo, los fondos, el corredor, las buhardillas y la terraza; las alturas, los huecos y
  los colores, a ojo de sus fotos. El hórreo está colocado a ojo de la ortofoto.**
- **El único retoque del relieve**: el MDT05 no ve la era (la plataforma llana de delante de la casa). En la caja de
  detalle se aplana a 493,7 m un rectángulo de ~23 × 13 m (cambia el relieve 2,8 m como mucho, en 42 celdas de 4 m),
  para que el zócalo no quede enterrado ni el hórreo en el aire. Por detrás la ladera tapa parte de la planta baja,
  como en la realidad (la casa está encajada en la pendiente).

## Qué hace el 3D

Un vuelo que avanza con el scroll (escenario `position: sticky` dentro de una pista de 640 vh, 540 en el móvil; sin
GSAP ni secuestro del scroll: se sale bajando o subiendo, y con el botón **«Saltar el vuelo»**, que es lo primero que
encuentra el teclado).

| Scroll | Cámara |
|---|---|
| 0 – 13 % | **La casa**: empieza delante de la fachada, del lado de la terraza, a 3,4 m sobre la era (el hórreo a la izquierda, como en su foto); se retira y sube sobre Penlés |
| 13 – 92 % | **Sigue la carretera real** del km 0 al 19,6: va unos 520 m por detrás del punto actual y entre 240 y 450 m sobre el suelo, mirando 450 m por delante. La trayectoria está suavizada (las revueltas no marean) y calculada para que el relieve nunca tape el punto de la carretera en el que se está |
| 92 – 100 % | **Tablizas**: baja sobre la carretera hasta 55 m del suelo, a 390 m del centro de recepción, mirando valle arriba al robledal |

- **Relieve** a escala real, sin exagerar: MDT05 del IGN remuestreado a 25 m en una caja de 18 × 21 km (50 m en el
  móvil), a 4 m alrededor de la casa y a 5 m en Tablizas, y MDT25 a 400 m en un anillo de 67 × 70 km (las sierras
  del fondo). Malla en teselas de 500 m: a 20 m junto a la carretera, 50, 100 y 250 m al alejarse; dos parches a
  2,5 m (la casa y Tablizas). **~460.000 triángulos en escritorio, ~217.000 en el móvil**, en unas 70 llamadas.
- **Ortofoto PNOA**: una base de toda la caja (17,6 m/px) y, **según se acerca la cámara**, la de cada bloque de
  3 × 3 km del corredor (14 bloques a 2,9 m/px; 5,9 en el móvil), de dos en dos; 0,29 m/px alrededor de la casa (con
  los tejados borrados, porque los edificios van en 3D) y 0,59 en Tablizas.
- **La carretera** es una cinta de 14 m de ancho apoyada en la malla (no es su ancho real: es un trazo para que se
  vea desde el aire): lo andado en el color de la marca, lo que queda en claro, y una marca redonda en el km actual.
- **El contador de km** y el hito salen de `lugar-camin.json`: el número del 3D y el del mojón de la página son el
  mismo dato. Debajo, la cota del punto y «Siguiente: Moal, a 2,4 km». La **tira** de abajo es el perfil en pequeño:
  se rellena con lo andado y cada hito es un botón que lleva a su km. Los **rótulos** de los hitos aparecen sobre el
  relieve cuando quedan a menos de 3,6 km por delante (5 a la vez como mucho, 3 en el móvil) y solo si el relieve no
  los tapa; al final, «Reserva Natural Integral de Muniellos» sobre el valle.
- **El sol de ahora** (`Camin.ahora()`, con `?fecha=` y `?hora=`): posición con las fórmulas de la NOAA, color del
  cielo y de la luz según su altura, sol y luna dibujados en su sitio, estrellas de noche y las puertaventanas de la
  casa encendidas (halo dibujado, sin bloom). **Las sombras del relieve** se calculan en el navegador, sin GPU: para
  cada celda de una rejilla de 360 × 420 (50 m; 100 m en el móvil) se marcha hacia el sol por las alturas y se compara
  con su altura, con la penumbra del disco; el resultado es una textura que multiplica la luz directa del suelo y de
  los edificios. Se rehace por tandas de 9 ms solo cuando el sol cambia (cada minuto), sin parar el vuelo. Junto a la
  casa hay además un mapa de sombras normal (±48 m) para el corredor, el hórreo y los vecinos. De noche, la sombra
  es la de la luna.
- **Tablizas**: los cinco edificios que tiene OpenStreetMap, como volúmenes sencillos (muros claros, pizarra). No
  hay fotos suyas: no pretenden parecerse.

### Plan B (en el mismo hueco)

**El perfil de altura real del camino** (SVG): la carretera con sus cotas del MDT05, los 13 hitos como mojones con su
nombre y su km, ejes de km y de cota (alturas exageradas ×14, dicho en el pie), cuatro cifras (19,6 km · 26 min ·
495 → 667 m · 402 m lo más bajo), una **regla «Recorre el camín»** (deslizador con teclado; también se arrastra sobre
el perfil) que dice «km 13,0 · 533 m · en Ventanueva», la lista de hitos (cada uno, un botón) y **la planta** de la
carretera con el norte arriba y el mismo cursor. En pantallas estrechas el perfil se desplaza en horizontal dentro de
su marco (la página no) y la lista es la lectura principal.

| Caso | Qué se ve |
|---|---|
| Escritorio con WebGL2 | la pista del 3D desde el principio; mientras carga, **el perfil dentro del escenario**; se enseña el 3D cuando han llegado la base, las texturas de cerca y la primera sombra (o a los 8 s) |
| Móvil (≤ 820 px o puntero grueso) o ahorro de datos | plan B + botón **«Ver el vuelo en 3D»** (Three.js y las imágenes no se piden hasta pulsar) |
| `prefers-reduced-motion`, `movimiento: false`, `densidad: 'sobria'`, sin WebGL2, `?sin-webgl` | plan B, sin botón |
| `navigator.webdriver` (Playwright) | plan B siempre; `?lugar=3d` lo fuerza (no usarlo con WebGL de verdad en pruebas) |
| En 3D | botones «Saltar el vuelo» y «Ver el perfil» |
| Si falla la carga o se pierde el contexto | vuelve solo al plan B |

## Para Web

1. **Cargar** (ya está en `index.src.html`): `css/lugar.css` en el `<head>` y `js/lugar.js` con `defer`, después de
   `js/ahora.js`. **Three.js no lo cargas tú**: `lugar.js` lo pide con `import()` a
   `vendor/three-0.160.0.module.min.js` (copia propia de Three.js r160, MIT, 655 KB) solo cuando hace falta. Sin
   import map, sin CDN, sin nada de fuera.
2. **Montar**: `Camin.lugar.montar(el, { movimiento, densidad, webgl })` → `{ destruir(), estado(), ver3d(),
   verPlano(), irA(km) }`. `irA(km)` lleva el vuelo (o el cursor del perfil) a ese km: sirve si quieres que un mojón
   de la línea de la página mueva el 3D. `estado()` da `{ modo, km, hito, cargado, … }`.
3. **La clase raíz es `.lugar-mod`** y todo lo mío lleva prefijo `lugar__`. Tú usas `.lugar`, `.lugar__cab`,
   `.lugar__respaldo`, `.lugar__hitos` y `.lugar__detalle`: **no chocan** con los míos (`lugar__hito`, en singular,
   es mío). El contenido del div se guarda y se repone al destruir.
4. **A sangre**: el módulo ocupa todo el ancho (así lo montas, con `padding: 0` al montar). El plan B y las fuentes
   se alinean solos con tu titular: `max-width: var(--ancho)` y `padding-inline: var(--gutter)`.
5. **Sticky**: `top: var(--lugar-arriba)`, que por defecto es tu `var(--cabecera)`. Ningún antepasado de
   `[data-modulo="lugar"]` puede llevar `overflow` (salvo el `overflow-x: clip` de `html` y `body`, que ya tienes)
   ni `transform`/`filter`: se rompería el escenario pegado.
6. **Variables que lee** (las de `#lugar`): `--fondo`, `--superficie`, `--texto`, `--texto-suave`, `--marca` (el
   trazo de la carretera, el perfil, lo andado; se puede cambiar solo aquí con `--lugar-trazo`), `--linea`, `--foco`,
   `--gutter`, `--ancho`, `--cabecera`, `--letra-titular`, `--letra-texto`, `--letra-cifras`. El texto sobre la
   marca va en oscuro (`#1a1208`). **Dentro del escenario del 3D los colores son fijos** (texto claro con velos sobre
   la imagen): no dependen de la paleta.
7. **Los km**: usa `data/lugar-camin.json` para la línea y para la regla de «A cuánto queda» (Tablizas: 19,6 km y
   26 min). Si tu `rutas.json` da otra cifra para Tablizas será por el punto de enganche: manda este fichero. Ya
   puedes quitar `data/camin-provisional.json`.
8. **Privacidad**: el módulo no pide nada fuera de la web. Créditos a la vista en el pie del módulo: IGN (CC BY 4.0),
   OpenStreetMap (ODbL), OSRM y Catastro. Conviene repetirlos en el aviso legal.
9. **Caché**: los `fetch` de `lugar.js` llevan la misma `?v=` que le ponga `versionar.mjs` al `<script>`. Esa
   huella es la de `lugar.js`, no la de los datos: si se rehacen solo los JSON o las imágenes, en Pages pueden tardar
   unos minutos en refrescarse (o tocar `lugar.js`).
10. **Peso**: con `defer` y la carga diferida, nada entra en el LCP.

| Qué | Peso |
|---|---|
| Plan B (los dos JSON) | **80 KB** |
| 3D escritorio, antes de enseñarse (Three.js 655 KB, alturas 832 KB, base, lejos y la ortofoto de la casa) | **2,15 MB** |
| 3D escritorio, todo el vuelo (más 14 bloques de ~175 KB y Tablizas, según avanza) | **4,75 MB** |
| 3D móvil, todo el vuelo | **2,09 MB** |
| `img/lugar/` entero (39 ficheros: las dos calidades) | 5,2 MB |
| `lugar.js` / `lugar.css`, sin minificar | 96 KB / 17 KB |

## Datos (cómo se rehacen)

```
python -I -X utf8 scripts/lugar-camin.py    # la casa (Catastro), el MDT, OSRM y OSM → data/lugar-camin.json
python -I -X utf8 scripts/lugar-datos.py    # alturas, ortofotos, edificios, la cinta y el vuelo → img/lugar/, data/lugar-escena.json
node scripts/lugar-sol.mjs                  # el sol contra JPL Horizons
node scripts/lugar-prueba.mjs               # pruebas (ver abajo); --sin-navegador: solo las de Node
```

`scripts/lugar-comun.py` es el utillaje de los dos primeros. User-Agent genérico `datos-mapa-script/1.0 (uso
puntual)`, sin datos personales. Coordenadas locales en metros desde el centro de la casa: x al este, z al sur,
y = cota del MDT. Alturas en PNG RGB: `(R·256 + G) / 10 − 100` m. Si se cambia la caja de la escena hay que borrar
`ref/raw/lugar-cache/pnoa-*.png` (los mosaicos se guardan por nombre).

| Fuente | Servicio | Uso |
|---|---|---|
| MDT05 / MDT25 IGN | WCS `servicios.idee.es/wcs-inspire/mdt` (`Elevacion4258_5`, `_25`) | cotas del camino y relieve |
| PNOA | WMTS `www.ign.es/wmts/pnoa-ma` (z10, z13, z16, z18 y z19) | suelo |
| Catastro | `Consulta_RCCOOR_Distancia`, `Consulta_DNPRC`, INSPIRE `wfsBU` | la casa y los vecinos |
| OSM | API 0.6 `/map` (el corredor) | pueblos, ríos, el centro de recepción y sus edificios |
| OSRM | `router.project-osrm.org` (coche) | la carretera, los km y los minutos |
| JPL Horizons | API pública | solo validar el sol (no lo usa la web) |

## Pruebas

`node scripts/lugar-prueba.mjs` (servidor propio en el **8982**, un solo Chromium **con WebGL desactivado**,
1280×800 y 390×844, escala 1; se cierra al acabar; se niega a arrancar si hay otra prueba de Playwright en marcha).
Página de prueba: `scripts/lugar-prueba.html`. Última pasada (2026-11-26, 16:26, con el código final): **82 bien,
0 mal**. Comprueba:

1. **Node**: el sol (21-jun a mediodía: 70,28°; **contra JPL Horizons, 48 instantes de 2026: ±0,011° en acimut y
   altura**, también con refracción), la frase del cielo, la interpolación del vuelo, el hito de cada km y la sombra
   del relieve con un muro inventado.
2. **Datos**: el contrato de `lugar-camin.json`, km crecientes, **suma de la geometría contra OSRM (−0,12 %)**, ningún
   tramo de más de 100 m, hitos en orden y con su fuente de OSM, cotas, el vuelo, `img/lugar` sin ficheros de más y
   los pesos.
3. **Plan B** (escritorio y móvil): sin lienzo y sin pedir Three.js; el perfil con los 13 hitos; cifras; la regla
   (km 13 → «en Ventanueva»; 17,5 → «pasado Moal, a 2,1 km de Tablizas»); la lista; el cielo de `?fecha&hora`;
   créditos; sin scroll horizontal; sin errores; `destruir()`; y **las cotas leídas de los PNG que usa el 3D**: la
   casa 493,7 m (la era) y 495,5 m en la rejilla de 25 m; Tablizas 666,5 m.
4. **Escena con un `WebGLRenderer` falso** (Three.js real, no pinta): monta sin NaN ni índices fuera de rango; la
   casa con sus piezas; el contador, el hito, el siguiente, los rótulos y la marca en seis km del vuelo, en el 0 y en
   el 1; la cinta apoyada en la malla; la cámara entre 236 y 450 m del suelo; **la sombra del relieve** (21-jun 13:30:
   todo al sol; 21-dic 16:40, sol a 9,8°: solo el 43 % de la escena al sol; de noche, la luna); «Saltar el vuelo» con
   teclado; fuera de pantalla no pinta; «Ver el perfil»; `destruir()`; y el móvil (plan B con botón, sin pedir nada
   hasta pulsar; después, relieve a 50 m y ortofotos pequeñas).
5. **Three.js de verdad contra un contexto WebGL de pega** (un objeto que imita la API y no hace nada: sin GPU y sin
   pintar): el `WebGLRenderer` auténtico recorre la escena entera (15 programas, 26 shaders, mapa de sombras,
   instancias) sin errores ni avisos, y se guarda **el texto final de cada shader** en
   `ref/raw/lugar-cache/shaders/` para revisarlo: la sombra del relieve entra en las dos luces direccionales, el
   suelo funde la ortofoto de detalle, cabecera `#version 300 es`, llaves y `#if` cuadran.

**No comprobado**: nada se ha pintado con WebGL. Los shaders están revisados como texto pero **no compilados** (no
había compilador de GLSL a mano); ni la casa vista, ni las sombras en la escena, ni los colores, ni los fps. Un error
de GLSL solo se vería en Chrome (consola: `THREE.WebGLProgram: Shader Error`), con el suelo negro o sin pintar.

## Rendimiento

Sin `transmission`, sin `RectAreaLight`, sin bloom (halos dibujados), colores en sRGB (`'#hex'`), **sin ningún
`ShaderMaterial` propio** (el cielo es una cúpula con el degradado en los vértices; el único GLSL añadido son doce
líneas en el Lambert de Three.js), DPR ≤ 1,5 (1,25 en el móvil) con bajada automática (DPR 1; luego sin mapa de
sombras y DPR 0,8 si los fotogramas pasan de 30 ms), mapa de sombras solo junto a la casa y recalculado solo cuando
cambia el sol, **se pinta solo cuando algo cambia** y nada fuera de pantalla. Lo más caro: los ~460.000 triángulos
(si va justo, subir los pasos de `PASOS` en `lugar.js`) y la sombra del relieve, que ocupa el hilo principal ~0,3 s
repartidos en tandas cada vez que cambia el minuto.

## Qué mirar (Álvaro, en su Chrome)

Servidor en la carpeta de la web (`python -m http.server 8982`) y abrir
**`http://localhost:8982/scripts/lugar-prueba.html?fps`** (solo el módulo) o la página de Web. Lo primero:

1. **Que se pinte** y la consola sin `Shader Error`. Con `?fps` (arriba a la izquierda): fps, calidad, DPR, altura de
   la cámara, triángulos, bloques cargados y el sol. Si la calidad baja sola a 1 o 2, va justo.
2. **La casa** (los primeros 13 % del scroll): piedra abajo, crema arriba, el corredor de madera con su barandilla,
   las cuatro buhardillas, pizarra, la chimenea a la derecha, el hórreo a la izquierda y la terraza a la derecha.
   Si algo sale al revés o el hórreo queda raro (está puesto a ojo), decirlo con una captura.
3. **El vuelo**: que la cámara siga la carretera sin marear ni meterse en el monte, que la cinta naranja no se
   hunda ni flote a trozos y que los rótulos de los pueblos caigan en su sitio y no se monten.
4. **Las costuras**: al avanzar, cada bloque de ortofoto pasa de borroso a nítido; mirar que no queden rayas entre
   bloques ni un escalón feo en el borde de la caja (a 18 km) contra las sierras del fondo.
5. **La luz**: `?fecha=2026-12-21&hora=16:40` (el valle casi entero en sombra, luz naranja), `?hora=13:00` y de
   noche `?hora=23:00` (estrellas, luna, puertaventanas encendidas). Mirar que la sombra del relieve no haga
   escalones (va a 50 m).
6. **El final**: Tablizas abajo y el robledal de Muniellos al fondo, con su rótulo.
7. **Móvil real**: el plan B, el botón «Ver el vuelo en 3D», que el scroll no se trabe y que los botones no tapen
   el contador.
8. Si va a menos de 5 fps: Chrome sin aceleración por hardware (`chrome://settings/system`).

## Pendiente

- Que Álvaro lo vea pintado (nadie lo ha visto).
- Preguntar a la casa por el número: el Catastro la tiene como Penlés 15, y su «n.º 4» es el edificio de al lado.
- Los 26 min son de OSRM; el tramo de Moal a Tablizas (3,5 km) es una carretera estrecha: decir «unos 26 min».
- Las alturas, huecos y colores de la casa y la posición del hórreo son a ojo de las fotos y de la ortofoto.
- Los edificios de Tablizas son volúmenes sin detalle; si se quiere el centro de recepción reconocible, hacen
  falta fotos.
