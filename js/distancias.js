/* Camín de Muniellos · «A cuánto queda»: una pieza con la que se juega, no una lista.
   - Mapa propio sobre el sombreado REAL del relieve (MDT del IGN), con la casa en el centro. Los sitios son mojones.
   - El mando es una REGLA DE KILÓMETROS que se arrastra (o «tengo 20 min / 1 hora / medio día»): lo que queda dentro se
     enciende, en el mapa, en la regla y en la lista.
   - Al elegir un sitio, su carretera REAL (OSRM) se dibuja desde la casa y la ficha da km, minutos, carreteras y el
     perfil de altura (MDT). Moal y Tablizas llevan el mismo kilómetro que el camín de la página y el vuelo 3D.
   - Teclado: la regla es un deslizador; la lista se recorre con flechas (una sola parada de tabulación). Táctil: tocar
     el mojón en el mapa. Sin JS queda la tabla; montado, la tabla sigue en «Ver todo en una tabla».
   Datos: <script id="datos-distancias"> (construir.mjs, de data/distancias.json). Nada a ojo.
   Camin.distancias.montar(el, { movimiento, densidad }) → { destruir(), elegir(id), hasta(km) } */
(function (w) {
  'use strict';
  var C = (w.Camin = w.Camin || {});
  var NS = 'http://www.w3.org/2000/svg';
  var svgEl = function (n, a) { var e = document.createElementNS(NS, n); for (var k in a) e.setAttribute(k, a[k]); return e; };
  var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); };
  var kmTxt = function (v) { return v < 30 ? (Math.round(v * 10) / 10).toFixed(1).replace('.', ',').replace(/,0$/, '') : String(Math.round(v)); };
  var tiempoTxt = function (m) { return m >= 60 ? Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0') + ' min' : m + ' min'; };
  var miles = function (n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); };
  var ROTULO = { cangas: 1, corias: 1, moal: 1, tablizas: 1, besullo: 1, llamas: 1, leitariegos: 1, oviedo: 1, aeropuerto: 1 };
  var MAX_KM = 100;

  C.distancias = {
    montar: function (el, op) {
      op = op || {};
      var nodo = document.getElementById('datos-distancias');
      if (!nodo) throw new Error('faltan los datos de distancias');
      var D = JSON.parse(nodo.textContent);
      var ids = D.orden, S = D.sitios;
      var tabla = el.querySelector('.tabla-caja');
      var respaldo = el.innerHTML;
      var animar = !!op.movimiento;
      var modo = { tipo: 'km', v: 25 }, elegido = null, vista = 'valle', vivo = true;

      el.innerHTML =
        '<div class="regla">' +
          '<div class="regla__presets" role="group" aria-label="Cuánto tiempo tienes"><span>Tengo</span>' +
            '<button class="chip" type="button" data-min="20" aria-pressed="false">20 min</button>' +
            '<button class="chip" type="button" data-min="60" aria-pressed="false">1 hora</button>' +
            '<button class="chip" type="button" data-min="90" aria-pressed="false">Medio día</button>' +
          '</div>' +
          '<label class="regla__eti" for="regla-km">O arrastra la regla: hasta <output id="regla-out" class="cifra" for="regla-km"></output></label>' +
          '<div class="regla__pista"><div class="regla__marcas" aria-hidden="true"></div><div class="regla__lleno"></div>' +
            '<input type="range" id="regla-km" min="0" max="' + MAX_KM + '" step="1" value="25" aria-describedby="regla-cuenta"></div>' +
          '<p class="regla__cuenta" id="regla-cuenta" aria-live="polite"></p>' +
        '</div>' +
        '<div class="mapa-lienzo"><svg class="mapa-svg" role="img" aria-label="Mapa del relieve con la casa en el centro y los sitios de alrededor"></svg>' +
          '<div class="mapa-vistas" role="group" aria-label="Qué enseña el mapa"><button class="chip" type="button" data-vista="valle" aria-pressed="true">El concejo</button><button class="chip" type="button" data-vista="asturias" aria-pressed="false">Hasta Oviedo</button></div>' +
          '<span class="mapa-credito">Relieve: © IGN · Carreteras: © OpenStreetMap</span></div>' +
        '<div class="mapa-panel"><div class="ficha" id="ficha" aria-live="polite"></div><div class="sitios" id="sitios"></div></div>' +
        '<details class="mapa-tabla"><summary>Ver todo en una tabla</summary></details>';
      if (tabla) el.querySelector('.mapa-tabla').appendChild(tabla);
      el.classList.add('es-montado');

      var svg = el.querySelector('.mapa-svg'), lienzo = el.querySelector('.mapa-lienzo');
      var range = el.querySelector('#regla-km'), out = el.querySelector('#regla-out'), cuenta = el.querySelector('#regla-cuenta');
      var marcas = el.querySelector('.regla__marcas'), lleno = el.querySelector('.regla__lleno');
      var ficha = el.querySelector('#ficha'), lista = el.querySelector('#sitios');

      // ---- la regla: marcas cada 10 km y un mojón por sitio, en su kilómetro
      var m = '';
      for (var k = 0; k <= MAX_KM; k += 10) m += '<i class="regla__km" style="--p:' + (k / MAX_KM) + '"><b>' + k + '</b></i>';
      ids.forEach(function (id) { m += '<i class="regla__sitio" data-sitio="' + id + '" style="--p:' + Math.min(1, S[id].km / MAX_KM).toFixed(4) + '"></i>'; });
      marcas.innerHTML = m;

      // ---- el mapa
      var R = D.relieve;
      ['lejos', 'cerca'].forEach(function (k2) { var r = R[k2]; svg.appendChild(svgEl('image', { href: r.src, x: r.x, y: r.y, width: r.w, height: r.h, preserveAspectRatio: 'none' })); });
      var gRutas = svgEl('g', {}), gPuntos = svgEl('g', {});
      svg.appendChild(gRutas); svg.appendChild(gPuntos);
      var rutas = {}, puntos = {};
      ids.forEach(function (id) {
        var s = S[id];
        rutas[id] = svgEl('path', { 'class': 'ruta', d: s.d, pathLength: '1', 'data-sitio': id });
        gRutas.appendChild(rutas[id]);
        var g = svgEl('g', { 'class': 'punto', 'data-sitio': id });
        g.innerHTML = '<circle r="20" fill="transparent"/><path class="punto__m" d="M-6 7V-3a6 6 0 0 1 12 0V7Z"/><text x="11" y="5">' + esc(s.nombre) + '</text>';
        if (!ROTULO[id]) g.setAttribute('data-mudo', '');
        gPuntos.appendChild(g);
        puntos[id] = g;
      });
      var casa = svgEl('g', { 'class': 'casa' });
      casa.innerHTML = '<path class="casa-m" d="M-8 8V-2L0 -9L8 -2V8Z"/><text class="casa-t" x="-12" y="24">km 0</text>';
      gPuntos.appendChild(casa);

      var caja = function (lista2, margen) {
        var x0 = 0, x1 = 0, y0 = 0, y1 = 0;
        lista2.forEach(function (id) {
          var b = rutas[id].getBBox();
          x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.width); y1 = Math.max(y1, b.y + b.height);
        });
        var mx = Math.max(1800, (x1 - x0) * margen), my = Math.max(1800, (y1 - y0) * margen);
        return { x: x0 - mx, y: y0 - my, w: x1 - x0 + 2 * mx, h: y1 - y0 + 2 * my };
      };
      var VISTAS = { valle: null, asturias: null };
      var vb = null, anim = 0;
      function encajar(b) {                           // a la proporción del lienzo
        var r = lienzo.getBoundingClientRect(), ar = r.width / Math.max(1, r.height), bw = b.w, bh = b.h;
        if (bw / bh < ar) bw = bh * ar; else bh = bw / ar;
        return { x: b.x + b.w / 2 - bw / 2, y: b.y + b.h / 2 - bh / 2, w: bw, h: bh };
      }
      function ponerVista(b) {
        vb = b;
        svg.setAttribute('viewBox', b.x.toFixed(0) + ' ' + b.y.toFixed(0) + ' ' + b.w.toFixed(0) + ' ' + b.h.toFixed(0));
        var u = b.w / Math.max(1, lienzo.getBoundingClientRect().width);
        svg.style.setProperty('--u', u.toFixed(2));
        var t = function (xy) { return 'translate(' + xy[0] + ' ' + xy[1] + ') scale(' + u.toFixed(2) + ')'; };
        ids.forEach(function (id) { puntos[id].setAttribute('transform', t(S[id].xy)); });
        casa.setAttribute('transform', t([0, 0]));
      }
      function irA(b) {
        b = encajar(b);
        cancelAnimationFrame(anim);
        if (!animar || !vb) { ponerVista(b); return; }
        var a = vb, t0 = performance.now();
        (function paso(t) {
          if (!vivo) return;
          var k2 = Math.min(1, (t - t0) / 650), s = 1 - Math.pow(1 - k2, 3);
          ponerVista({ x: a.x + (b.x - a.x) * s, y: a.y + (b.y - a.y) * s, w: a.w + (b.w - a.w) * s, h: a.h + (b.h - a.h) * s });
          if (k2 < 1) anim = requestAnimationFrame(paso);
        })(t0);
      }
      function vistaGeneral() {
        if (!VISTAS.valle) {
          VISTAS.valle = caja(ids.filter(function (id) { return S[id].km < 50; }), 0.1);
          VISTAS.asturias = caja(ids, 0.07);
        }
        irA(VISTAS[vista]);
        el.querySelectorAll('.mapa-vistas button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.vista === vista && !elegido)); });
      }

      // ---- la lista (el mando con teclado)
      var h = '', grupos = {};
      ids.forEach(function (id) { (grupos[S[id].grupo] = grupos[S[id].grupo] || []).push(id); });
      Object.keys(D.grupos).forEach(function (g) {
        if (!grupos[g]) return;
        h += '<div><h4>' + esc(D.grupos[g]) + '</h4>' + grupos[g].map(function (id) {
          var s = S[id];
          return '<button class="sitio" type="button" data-sitio="' + id + '" aria-pressed="false" tabindex="-1"><span>' + esc(s.nombre) + '</span><span class="cifra">' + kmTxt(s.km) + ' km</span><span class="cifra">' + tiempoTxt(s.minutos) + '</span></button>';
        }).join('') + '</div>';
      });
      lista.innerHTML = h;
      var botones = Array.prototype.slice.call(lista.querySelectorAll('.sitio'));
      botones[0].tabIndex = 0;

      var dentro = function (s) { return modo.tipo === 'km' ? s.km <= modo.v : s.minutos <= modo.v; };
      function pintarRegla() {
        var n = 0, lejos = 0;
        ids.forEach(function (id) {
          var d = dentro(S[id]); if (d) { n++; lejos = Math.max(lejos, S[id].km); }
          [rutas[id], puntos[id]].forEach(function (e) { e.classList.toggle('es-dentro', d); });
          marcas.querySelector('[data-sitio="' + id + '"]').classList.toggle('es-dentro', d);
          lista.querySelector('[data-sitio="' + id + '"]').classList.toggle('es-dentro', d);
        });
        var v = modo.tipo === 'km' ? modo.v : Math.min(MAX_KM, Math.ceil(lejos));
        range.value = v;
        lleno.style.setProperty('--p', (v / MAX_KM).toFixed(3));
        out.textContent = modo.tipo === 'km' ? v + ' km' : (modo.v === 90 ? 'hora y media de ida' : tiempoTxt(modo.v) + ' de ida');
        range.setAttribute('aria-valuetext', out.textContent);
        el.querySelectorAll('.regla__presets button').forEach(function (b) { b.setAttribute('aria-pressed', String(modo.tipo === 'min' && +b.dataset.min === modo.v)); });
        var cerca = ids.slice().sort(function (a, b) { return S[a].km - S[b].km; })[0];
        cuenta.textContent = n === 0 ? 'Nada tan cerca: lo primero es ' + S[cerca].nombre + ', a ' + kmTxt(S[cerca].km) + ' km.' : n === ids.length ? 'Queda todo dentro: los ' + n + ' sitios.' : 'Dentro ' + (n === 1 ? 'queda 1 sitio' : 'quedan ' + n + ' sitios') + ' de ' + ids.length + (modo.tipo === 'min' ? ', el más lejano a ' + kmTxt(lejos) + ' km.' : '.');
      }

      function perfilSvg(p) {
        var W = 300, H = 80, n = p.km.length, kmF = p.km[n - 1], lo = Math.floor(p.min / 50) * 50, hi = Math.max(lo + 100, Math.ceil(p.max / 50) * 50);
        var X = function (v) { return (v / kmF) * W; }, Y = function (v) { return H - 4 - ((v - lo) / (hi - lo)) * (H - 10); };
        var d = '';
        for (var i = 0; i < n; i++) d += (i ? 'L' : 'M') + X(p.km[i]).toFixed(1) + ' ' + Y(p.m[i]).toFixed(1);
        return '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="Perfil de altura de la carretera: de ' + miles(p.m[0]) + ' a ' + miles(p.fin) + ' metros"><path class="a" d="' + d + 'L' + W + ' ' + H + 'L0 ' + H + 'Z"/><path class="l" d="' + d + '"/></svg>' +
          '<p><span>Sale a <b class="cifra">' + miles(p.m[0]) + ' m</b></span><span>Sube <b class="cifra">' + miles(p.sube) + ' m</b> y baja <b class="cifra">' + miles(p.baja) + ' m</b></span><span>Llega a <b class="cifra">' + miles(p.fin) + ' m</b></span></p>';
      }
      function pintarFicha() {
        if (!elegido) {
          ficha.innerHTML = '<h3 class="ficha__nombre">Elige un sitio</h3><p class="ficha__tipo">En la lista o en el mapa. Se dibuja su carretera desde la casa, con los kilómetros, los minutos y lo que sube.</p>';
          return;
        }
        var s = S[elegido], f = D.fotos[elegido];
        var foto = '';
        if (f) {
          var set = function (ext) { return f.anchos.map(function (a) { return 'img/fotos/' + f.n + '-' + a + '.' + ext + ' ' + a + 'w'; }).join(', '); };
          foto = '<figure class="ficha__foto"><picture><source type="image/webp" srcset="' + set('webp') + '" sizes="(max-width: 899px) 92vw, 34vw"><img src="img/fotos/' + f.n + '-' + f.anchos[0] + '.jpg" alt="' + esc(f.alt) + '" width="' + f.ancho + '" height="' + f.alto + '" loading="lazy"></picture><figcaption>' + esc(f.pie) + '. Foto: ' + esc(f.autor) + ', <a href="' + esc(f.pagina) + '" target="_blank" rel="noopener">' + esc(f.licencia) + '</a>.</figcaption></figure>';
        }
        ficha.innerHTML = '<h3 class="ficha__nombre">' + esc(s.nombre) + '</h3><p class="ficha__tipo">' + esc(s.tipo) + '</p>' +
          '<p class="ficha__cifras"><span><b>' + kmTxt(s.km) + '</b> km</span><span><b>' + tiempoTxt(s.minutos).replace(' min', '') + '</b> ' + (s.minutos >= 60 ? '' : 'min ') + 'en coche</span></p>' +
          '<p class="ficha__por">Por ' + esc(s.carreteras.slice(0, 5).join(', ')) + '.</p>' +
          (s.camin ? '<span class="ficha__camin">Está en el camín: es el mismo kilómetro que marca su mojón.</span>' : '') +
          '<div class="ficha__perfil">' + perfilSvg(s.perfil) + '</div>' + foto +
          '<p class="ficha__ir"><a class="enlace" href="https://www.google.com/maps/dir/?api=1&amp;origin=' + D.casa.lat + ',' + D.casa.lon + '&amp;destination=' + s.lat + ',' + s.lon + '&amp;travelmode=driving" target="_blank" rel="noopener">Abrir la ruta en Google Maps<span class="vh"> (en otra pestaña)</span></a></p>';
      }
      function elegir(id, foco) {
        elegido = id && S[id] ? (elegido === id ? null : id) : null;
        ids.forEach(function (x) {
          var si = x === elegido;
          rutas[x].classList.toggle('es-elegida', si);
          puntos[x].classList.toggle('es-elegido', si);
          var b = lista.querySelector('[data-sitio="' + x + '"]');
          b.setAttribute('aria-pressed', String(si));
        });
        if (elegido) {
          var r = rutas[elegido];
          gRutas.appendChild(r);                         // encima de las demás
          r.classList.add('es-trazando');
          void r.getBoundingClientRect();
          requestAnimationFrame(function () { requestAnimationFrame(function () { r.classList.remove('es-trazando'); }); });
          irA(caja([elegido], 0.22));
          el.querySelectorAll('.mapa-vistas button').forEach(function (b2) { b2.setAttribute('aria-pressed', 'false'); });
        } else vistaGeneral();
        pintarFicha();
        if (foco) { var b3 = lista.querySelector('[data-sitio="' + (elegido || id) + '"]'); if (b3) b3.focus({ preventScroll: true }); }
      }

      // ---- eventos
      var quitar = [];
      var oir = function (t, ev, fn, o) { t.addEventListener(ev, fn, o); quitar.push(function () { t.removeEventListener(ev, fn, o); }); };
      oir(range, 'input', function () { modo = { tipo: 'km', v: +range.value }; pintarRegla(); });
      oir(el, 'click', function (e) {
        var p = e.target.closest('[data-min]');
        if (p) { var v = +p.dataset.min; modo = modo.tipo === 'min' && modo.v === v ? { tipo: 'km', v: +range.value } : { tipo: 'min', v: v }; pintarRegla(); return; }
        var vv = e.target.closest('[data-vista]');
        if (vv) { vista = vv.dataset.vista; if (elegido) elegir(null); else vistaGeneral(); return; }
        var s = e.target.closest('.sitio, .punto');
        if (s) elegir(s.getAttribute('data-sitio'));
      });
      oir(lista, 'keydown', function (e) {
        var i = botones.indexOf(document.activeElement);
        if (i < 0) return;
        var j = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? botones.length - 1 : -1;
        if (j < 0 || j >= botones.length) return;
        e.preventDefault();
        botones[i].tabIndex = -1; botones[j].tabIndex = 0; botones[j].focus();
      });
      oir(lista, 'focusin', function (e) { var b = e.target.closest('.sitio'); if (b) { botones.forEach(function (x) { x.tabIndex = x === b ? 0 : -1; }); } });
      var alCambiar = function () { VISTAS.valle = null; if (elegido) irA(caja([elegido], 0.22)); else vistaGeneral(); };
      oir(document, 'camin:resize', alCambiar);

      pintarRegla();
      pintarFicha();
      vistaGeneral();
      el.setAttribute('data-montado', '');

      return {
        elegir: function (id) { if (elegido !== id) elegir(id); },
        hasta: function (km) { modo = { tipo: 'km', v: km }; pintarRegla(); },
        estado: function () { return { modo: modo, elegido: elegido, vista: vista }; },
        destruir: function () {
          vivo = false; cancelAnimationFrame(anim);
          quitar.forEach(function (f2) { f2(); });
          el.classList.remove('es-montado'); el.removeAttribute('data-montado');
          el.innerHTML = respaldo;
        },
      };
    },
  };
})(window);
