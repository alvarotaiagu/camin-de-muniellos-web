/* Camín de Muniellos · el roble de la portada lleva la hoja de la ESTACIÓN DE HOY.
   Camin.estacion(fecha) → { estado, hojas, tam, color, caidas, cuando, frase }. No es un dato en vivo: es el calendario
   habitual de un robledal de montaña del suroccidente de Asturias, y la frase lo dice así («Finales de noviembre: …»).
     desnudo: de mediados de diciembre a finales de abril · brote: de finales de abril a mayo
     verde: de junio a septiembre · ocre: de octubre a primeros de diciembre (pierde la hoja a lo largo de noviembre)
   Camin.roble.montar(el, { movimiento, densidad }) → { destruir() }  (contrato de módulos; el respaldo es el dibujo fijo).
   Gesto: arrastrar el roble en horizontal recorre el año (un ancho = seis meses); al soltar vuelve a hoy. Con teclado es
   un deslizador (flechas ±10 días, RePág/AvPág ±1 mes, Inicio o Esc = hoy). touch-action: pan-y: el gesto vertical
   sigue bajando la página. Con movimiento reducido o en la versión sobria: la hoja de hoy, sin gesto. */
(function (w) {
  'use strict';
  var C = (w.Camin = w.Camin || {});
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var BROTE = [134, 169, 58], VERDE = [47, 122, 59], OCRE = [206, 107, 15];
  var mezcla = function (a, b, t) { t = Math.max(0, Math.min(1, t)); return [0, 1, 2].map(function (i) { return Math.round(a[i] + (b[i] - a[i]) * t); }); };
  var rgb = function (c) { return 'rgb(' + c.join(',') + ')'; };
  var tramo = function (x, a, b) { return Math.max(0, Math.min(1, (x - a) / (b - a))); };

  // lo que se dice de cada mes; con tres frases, una por tercio (principios, mediados, finales)
  var FRASES = {
    1: 'el robledal está desnudo y se ve el monte entero entre las ramas',
    2: 'el roble sigue sin hoja; hay niebla en el valle y nieve en lo alto',
    3: 'el roble aún no tiene hoja, pero las yemas ya engordan',
    4: ['el roble es de los últimos en brotar: sigue desnudo', 'el roble es de los últimos en brotar: sigue desnudo', 'asoman las primeras hojas del roble'],
    5: 'el robledal brota; la hoja nueva es de un verde muy claro',
    6: 'el robledal ya está verde y cerrado',
    7: 'el robledal está verde y cerrado; dentro del bosque siempre hay sombra',
    8: 'el robledal está verde y cerrado; dentro del bosque siempre hay sombra',
    9: ['el robledal sigue verde', 'el robledal sigue verde', 'el robledal sigue verde, y las primeras hojas amarillean'],
    10: ['el robledal empieza a cambiar de color', 'el robledal se vuelve ocre: es el otoño de Muniellos', 'el robledal está ocre: es el otoño de Muniellos'],
    11: ['el robledal está ocre', 'el robledal está ocre y empieza a perder la hoja', 'el robledal está ocre y va perdiendo la hoja'],
    12: ['al roble le quedan las últimas hojas', 'el robledal ya está desnudo', 'el robledal ya está desnudo'],
  };
  C.estacion = function (fecha) {
    var m = C.madrid ? C.madrid(fecha) : { anio: fecha.getFullYear(), mes: fecha.getMonth() + 1, dia: fecha.getDate() };
    var dia = Math.round((Date.UTC(2023, m.mes - 1, m.dia) - Date.UTC(2023, 0, 1)) / 864e5) + 1;      // día del año (sin bisiesto)
    var hojas, tam = 1, color;
    if (dia < 112 || dia > 352) hojas = 0;                              // del 19 de diciembre al 21 de abril
    else if (dia < 152) hojas = tramo(dia, 112, 150);                   // brota hasta finales de mayo
    else if (dia < 305) hojas = 1;
    else hojas = 1 - tramo(dia, 305, 349);                              // noviembre: pierde la hoja
    if (dia < 152) { tam = 0.45 + 0.55 * tramo(dia, 112, 152); color = mezcla(BROTE, VERDE, tramo(dia, 135, 165)); }
    else if (dia < 262) color = VERDE;
    else color = mezcla(VERDE, OCRE, tramo(dia, 262, 300));             // de finales de septiembre a finales de octubre
    var estado = hojas < 0.04 ? 'desnudo' : dia < 152 ? 'brote' : dia < 274 ? 'verde' : 'ocre';
    var caidas = dia >= 300 ? tramo(dia, 300, 345) : dia < 40 ? 1 - tramo(dia, 5, 40) : 0;
    var f = FRASES[m.mes], tercio = m.dia <= 10 ? 0 : m.dia <= 20 ? 1 : 2;
    var cuando = ['Principios', 'Mediados', 'Finales'][tercio] + ' de ' + MESES[m.mes - 1];
    return { estado: estado, hojas: hojas, tam: tam, color: rgb(color), caidas: caidas, cuando: cuando, frase: typeof f === 'string' ? f : f[tercio], dia: dia, mes: m.mes };
  };

  C.roble = {
    montar: function (el, op) {
      op = op || {};
      var svg = el.querySelector('.roble');
      if (!svg || !C.ahora) throw new Error('falta el dibujo del roble o Camin.ahora');
      var hojas = Array.prototype.slice.call(svg.querySelectorAll('.hoja'));
      var caidas = Array.prototype.slice.call(svg.querySelectorAll('.caida'));
      var grupo = svg.querySelector('.roble__hojas');
      var N = hojas.length;
      var rango = hojas.map(function (h) { return +h.getAttribute('data-c'); });   // 0 = la primera que cae
      var txt = document.getElementById('estacion-txt');
      var respaldo = txt ? txt.innerHTML : '';
      var gesto = !!op.movimiento && op.densidad !== 'sobria';
      var DIA = 864e5, desfase = 0, vuelve = 0, vivo = true;
      var raiz = document.documentElement;

      function pintar() {
        var hoy = C.ahora(), fecha = new Date(hoy.getTime() + desfase * DIA), e = C.estacion(fecha);
        var caen = Math.round((1 - e.hojas) * N);
        for (var i = 0; i < N; i++) hojas[i].classList.toggle('es-caida', rango[i] < caen);
        var vistas = Math.round(e.caidas * caidas.length);
        for (var k = 0; k < caidas.length; k++) caidas[k].classList.toggle('es-vista', k < vistas);
        svg.style.setProperty('--hoja', e.color);
        raiz.style.setProperty('--hoja', e.color);                          // el bosque del pie lleva la misma hoja
        grupo.style.transform = e.tam < 0.999 ? 'scale(' + e.tam.toFixed(3) + ')' : '';
        grupo.style.transformOrigin = '50% 60%';
        svg.setAttribute('data-estacion', e.estado);
        raiz.setAttribute('data-estacion', e.estado);
        if (txt) {
          var otra = Math.abs(desfase) > 2;
          txt.innerHTML = '<b>' + e.cuando + ':</b> ' + e.frase + '.' + (gesto ? '<span class="portada__pista">' + (otra ? 'Suelta y vuelve a hoy.' : 'Arrastra el roble y recorre el año.') + '</span>' : '');
        }
        el.setAttribute('aria-valuenow', String(Math.round(desfase)));
        el.setAttribute('aria-valuetext', e.cuando + ': ' + e.frase);
        return e;
      }
      var actual = pintar();
      el.classList.add('es-lista');
      C.estacionHoy = actual;

      var quitar = [];
      var oir = function (t, ev, fn, o) { t.addEventListener(ev, fn, o); quitar.push(function () { t.removeEventListener(ev, fn, o); }); };
      if (gesto) {
        el.classList.add('es-viva');
        el.setAttribute('role', 'slider');
        el.setAttribute('tabindex', '0');
        el.setAttribute('aria-label', 'El roble a lo largo del año. Con las flechas se adelanta o se atrasa la fecha; Inicio vuelve a hoy');
        el.setAttribute('aria-valuemin', '-182'); el.setAttribute('aria-valuemax', '182');
        var x0 = null, d0 = 0, id = null;
        var volver = function () {
          cancelAnimationFrame(vuelve);
          var desde = desfase, t0 = performance.now(), dur = 900;
          (function paso(t) {
            if (!vivo) return;
            var k = Math.min(1, (t - t0) / dur), s = 1 - Math.pow(1 - k, 3);
            desfase = desde * (1 - s);
            if (k >= 1) desfase = 0;
            pintar();
            if (k < 1) vuelve = requestAnimationFrame(paso);
          })(t0);
        };
        oir(el, 'pointerdown', function (e) { if (e.button) return; cancelAnimationFrame(vuelve); x0 = e.clientX; d0 = desfase; id = e.pointerId; });
        oir(w, 'pointermove', function (e) {
          if (x0 === null || e.pointerId !== id) return;
          var dx = e.clientX - x0;
          if (Math.abs(dx) < 6 && desfase === d0) return;
          try { el.setPointerCapture(id); } catch (er) { /* nada */ }
          var ancho = Math.max(220, el.getBoundingClientRect().width);
          desfase = Math.max(-182, Math.min(182, d0 + (dx / ancho) * 182));
          pintar();
        });
        var soltar = function (e) { if (x0 === null || (e && e.pointerId !== id)) return; x0 = null; id = null; if (desfase) volver(); };
        oir(w, 'pointerup', soltar); oir(w, 'pointercancel', soltar);
        oir(el, 'dragstart', function (e) { e.preventDefault(); });
        oir(el, 'keydown', function (e) {
          var paso = { ArrowRight: 10, ArrowUp: 10, ArrowLeft: -10, ArrowDown: -10, PageUp: 30, PageDown: -30 }[e.key];
          if (paso) { e.preventDefault(); cancelAnimationFrame(vuelve); desfase = Math.max(-182, Math.min(182, desfase + paso)); pintar(); }
          else if (e.key === 'Home' || e.key === 'Escape') { e.preventDefault(); cancelAnimationFrame(vuelve); desfase = 0; pintar(); }
        });
        oir(el, 'blur', function () { if (desfase && x0 === null) volver(); });
      }
      // a medianoche puede cambiar la frase: se revisa cada diez minutos (no pinta nada si no cambia)
      var reloj = setInterval(function () { if (!desfase && document.visibilityState !== 'hidden') pintar(); }, 600000);

      return {
        estacion: function () { return actual; },
        destruir: function () {
          vivo = false; clearInterval(reloj); cancelAnimationFrame(vuelve);
          quitar.forEach(function (f) { f(); });
          ['role', 'tabindex', 'aria-label', 'aria-valuemin', 'aria-valuemax', 'aria-valuenow', 'aria-valuetext'].forEach(function (a) { el.removeAttribute(a); });
          el.classList.remove('es-viva', 'es-lista');
          if (txt) txt.innerHTML = respaldo;
        },
      };
    },
  };
})(window);
