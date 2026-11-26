/* Camín de Muniellos · «Elige fechas»: OCUPACIÓN REAL + su pago. Nada se simula.
   - Los días libres y ocupados de cada apartamento son los que devolvió su motor (MotoPress Hotel Booking) en la última
     lectura (scripts/disponibilidad.mjs → data/disponibilidad.json → <script id="datos-reserva">). La fecha y la hora de
     esa lectura van a la vista. La estancia mínima y los días sin entrada o sin salida también son los del motor.
   - Al elegir llegada y salida se abre SU página de búsqueda, con las fechas puestas, en otra pestaña. El precio, la
     reserva y el pago son suyos. Esta web no envía ni guarda nada.
   - Calendario: dos meses (uno en el móvil), teclado con flechas (una sola parada de tabulación), y por día, qué
     apartamentos están libres (tres marcas con su color y su orden: Carujo, Fonrín, Xelín).
   Camin.reserva.montar(el, { movimiento, densidad }) → { destruir(), apto(id), estado() } · Camin.reserva.apto(id) */
(function (w) {
  'use strict';
  var C = (w.Camin = w.Camin || {});
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var DIA = 864e5;
  var utc = function (iso) { var p = iso.split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); };
  var isoDe = function (t) { var d = new Date(t); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0'); };
  var lista = function (a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' y ' + a[a.length - 1]; };
  var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); };
  var instancia = null, pendiente = null;

  C.reserva = {
    apto: function (id) { if (instancia) instancia.apto(id); else pendiente = id; },
    montar: function (el, op) {
      var nodo = document.getElementById('datos-reserva');
      if (!nodo) throw new Error('faltan los datos de la reserva');
      var D = JSON.parse(nodo.textContent), P = D.dispo;
      if (!P || !P.apartamentos || !P.dias) throw new Error('sin lectura de ocupación: se queda el enlace a su motor');
      var A = D.apartamentos, LETRA = { carujo: 'c', fonrin: 'f', xelin: 'x' };
      var respaldo = el.innerHTML;
      var t0 = utc(P.desde), N = P.dias;
      var m = C.madrid ? C.madrid() : null;
      var hoy = m ? Date.UTC(m.anio, m.mes - 1, m.dia) : utc(isoDe(Date.now()));
      var idx = function (t) { return Math.round((t - t0) / DIA); };
      var libre = function (id, i) { return i >= 0 && i < N && P.apartamentos[id].libre.charAt(i) === '1'; };
      var dato = function (id, campo, i) { return i >= 0 && i < N ? P.apartamentos[id][campo].charAt(i) : '0'; };
      var quienes = function () { return estado.apto === 'todos' ? A.map(function (a) { return a.id; }) : [estado.apto]; };
      // el final sin fechas: desde qué día NINGUNO tiene nada libre hasta el final de la lectura
      var cierre = N;
      while (cierre > 0 && !A.some(function (a) { return libre(a.id, cierre - 1); })) cierre--;
      var hayCierre = N - cierre >= 45;
      var ultimo = t0 + (hayCierre ? cierre : N - 1) * DIA;            // último día que tiene sentido enseñar
      var estado = { apto: 'todos', llegada: null, salida: null, error: '', mes: null, adultos: 2, ninos: 0 };
      var primerMes = function () { var d = new Date(Math.max(hoy, t0)); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1); };
      var ultimoMes = function () { var d = new Date(ultimo); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1); };
      estado.mes = primerMes();
      var masMes = function (t, n) { var d = new Date(t); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1); };

      // quién puede alojar las noches [a, b): todas libres, estancia mínima y máxima, y días con entrada y salida permitidas
      function valida(id, a, b) {
        var ia = idx(a), ib = idx(b), n = ib - ia;
        if (ia < 0 || ib > N || a < hoy) return 'fuera';
        for (var i = ia; i < ib; i++) if (!libre(id, i)) return 'ocupado';
        if (dato(id, 'sinEntrada', ia) === '1') return 'entrada';
        if (ib < N && dato(id, 'sinSalida', ib) === '1') return 'salida';
        var min = +dato(id, 'min', ia) || 1;
        if (n < min) return 'min' + min;
        if (n > 30) return 'max';
        return '';
      }
      var puedeEntrar = function (t) { var i = idx(t); return t >= hoy && quienes().some(function (id) { return libre(id, i) && dato(id, 'sinEntrada', i) !== '1'; }); };

      var leido = new Date(P.leido);
      var leidoTxt = leido.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' }) + ' a las ' + leido.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });
      var mins = {};
      A.forEach(function (a) { for (var i = Math.max(0, idx(hoy)); i < cierre; i++) if (libre(a.id, i)) mins[dato(a.id, 'min', i)] = 1; });
      var minTxt = Object.keys(mins).sort();
      var fechaLarga = function (t) { var d = new Date(t); return DIAS[d.getUTCDay()] + ' ' + d.getUTCDate() + ' de ' + MESES[d.getUTCMonth()]; };
      var fechaCorta = function (t) { var d = new Date(t); return DIAS[d.getUTCDay()].slice(0, 3) + ' ' + d.getUTCDate() + ' de ' + MESES[d.getUTCMonth()]; };

      el.innerHTML =
        '<p class="cal__leido">' + '<b>Ocupación real.</b> Leída de su motor de reservas el <time datetime="' + esc(P.leido) + '">' + leidoTxt + '</time>. Puede haber cambiado desde entonces: lo confirma su web al reservar.</p>' +
        '<div class="cal__quien">' +
          '<div class="chips" role="radiogroup" aria-label="Apartamento">' +
            '<button class="chip chip--apto" type="button" role="radio" data-apto="todos" aria-checked="true">Cualquiera</button>' +
            A.map(function (a) { return '<button class="chip chip--apto" type="button" role="radio" data-apto="' + a.id + '" aria-checked="false">' + esc(a.nombre) + '</button>'; }).join('') +
          '</div>' +
          '<label>Adultos<select id="cal-adultos">' + D.motor.adultos.map(function (n) { return '<option' + (n === 2 ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></label>' +
          '<label>Niños<select id="cal-ninos">' + D.motor.ninos.map(function (n) { return '<option>' + n + '</option>'; }).join('') + '</select></label>' +
        '</div>' +
        '<div class="cal__nav"><button type="button" id="cal-ant" aria-label="Mes anterior"><svg class="ico" width="22" height="22" aria-hidden="true" style="transform:scaleX(-1)"><use href="#i-flecha" width="22" height="22"/></svg></button><p id="cal-pista" aria-live="polite"></p><button type="button" id="cal-sig" aria-label="Mes siguiente"><svg class="ico" width="22" height="22" aria-hidden="true"><use href="#i-flecha" width="22" height="22"/></svg></button></div>' +
        '<div class="cal__meses" id="cal-meses"></div>' +
        '<ul class="leyenda" aria-hidden="true">' + A.map(function (a) { return '<li><i class="' + LETRA[a.id] + '"></i>' + esc(a.nombre) + ' libre</li>'; }).join('') + '<li><i class="no"></i>Ocupado</li></ul>' +
        (hayCierre ? '<p class="cal__aviso">Desde el ' + new Date(t0 + cierre * DIA).getUTCDate() + ' de ' + MESES[new Date(t0 + cierre * DIA).getUTCMonth()] + ' de ' + new Date(t0 + cierre * DIA).getUTCFullYear() + ', su motor todavía no ofrece fechas. Para más adelante, pregunta: <a class="cifra" href="tel:' + D.contacto.tel + '">' + D.contacto.telTxt + '</a> o <a href="mailto:' + D.contacto.correo + '">' + D.contacto.correo + '</a>.</p>' : '') +
        '<div class="cal__resumen" id="cal-resumen" aria-live="polite"></div>';
      el.classList.add('es-montado');
      var meses = el.querySelector('#cal-meses'), resumen = el.querySelector('#cal-resumen'), pista = el.querySelector('#cal-pista');
      var ant = el.querySelector('#cal-ant'), sig = el.querySelector('#cal-sig');
      var foco = null;                                   // el día que lleva el tabindex

      function mesHtml(t) {
        var d = new Date(t), anio = d.getUTCFullYear(), mes = d.getUTCMonth(), n = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
        var hueco = (d.getUTCDay() + 6) % 7, h = '<div class="mes"><h4>' + MESES[mes] + ' de ' + anio + '</h4><div class="mes__dias">';
        ['L', 'M', 'X', 'J', 'V', 'S', 'D'].forEach(function (x) { h += '<span aria-hidden="true">' + x + '</span>'; });
        for (var k = 0; k < hueco; k++) h += '<span></span>';
        for (var dia = 1; dia <= n; dia++) {
          var tt = Date.UTC(anio, mes, dia), i = idx(tt), cl = 'dia', eti = fechaLarga(tt), marcas = '';
          var libres = A.filter(function (a) { return libre(a.id, i); });
          var mios = libres.filter(function (a) { return estado.apto === 'todos' || a.id === estado.apto; });
          if (tt < hoy) { cl += ' es-pasado'; eti += ': ya pasó'; }
          else if (i >= N || (hayCierre && i >= cierre)) { cl += ' es-no'; eti += ': su motor todavía no ofrece esta fecha'; }
          else {
            if (!mios.length) {
              // una noche ocupada puede ser día de salida si la anterior está libre
              var sale = quienes().some(function (id) { return libre(id, i - 1); });
              cl += sale ? ' es-no es-sale' : ' es-no';
              eti += sale ? ': noche ocupada (se puede salir ese día)' : ': ocupado';
            } else eti += ': libre ' + lista(libres.map(function (a) { return a.nombre; }));
            marcas = '<span class="dia__aptos">' + A.map(function (a) { return '<i class="' + (libre(a.id, i) ? LETRA[a.id] : 'no') + '"></i>'; }).join('') + '</span>';
          }
          if (estado.llegada === tt) { cl += ' es-llegada'; eti += '. Llegada'; }
          if (estado.salida === tt) { cl += ' es-salida'; eti += '. Salida'; }
          if (estado.llegada && estado.salida && tt > estado.llegada && tt < estado.salida) cl += ' es-entre';
          h += '<button type="button" class="' + cl + '" data-f="' + isoDe(tt) + '" tabindex="-1" aria-label="' + esc(eti) + '">' + dia + marcas + '</button>';
        }
        return h + '</div></div>';
      }
      function pintar(conFoco) {
        meses.innerHTML = mesHtml(estado.mes) + (masMes(estado.mes, 1) <= ultimoMes() ? mesHtml(masMes(estado.mes, 1)) : '');
        ant.disabled = estado.mes <= primerMes();
        sig.disabled = masMes(estado.mes, 1) > ultimoMes();
        var botones = meses.querySelectorAll('.dia');
        var b = (foco && meses.querySelector('[data-f="' + foco + '"]')) || meses.querySelector('.dia:not(.es-pasado):not(.es-no)') || botones[0];
        if (b) { b.tabIndex = 0; foco = b.getAttribute('data-f'); if (conFoco) b.focus({ preventScroll: true }); }
        el.querySelectorAll('[data-apto]').forEach(function (c) { c.setAttribute('aria-checked', String(c.dataset.apto === estado.apto)); });
        pista.textContent = !estado.llegada ? 'Elige el día de llegada' : !estado.salida ? 'Ahora, el día de salida' : '';
        pintarResumen();
      }
      function pintarResumen() {
        var h = '';
        if (estado.error) h += '<p class="es-error">' + esc(estado.error) + '</p>';
        if (estado.llegada && estado.salida) {
          var n = Math.round((estado.salida - estado.llegada) / DIA);
          var caben = quienes().filter(function (id) { return !valida(id, estado.llegada, estado.salida); }).map(function (id) { return A.filter(function (a) { return a.id === id; })[0].nombre; });
          var q = D.motor.campos, url = D.motor.buscar + '?' + q.entrada + '=' + isoDe(estado.llegada) + '&' + q.salida + '=' + isoDe(estado.salida) + '&' + q.adultos + '=' + estado.adultos + '&' + q.ninos + '=' + estado.ninos;
          h += '<p class="cal__grande"><span class="cifra">' + n + '</span> ' + (n === 1 ? 'noche' : 'noches') + ', del ' + fechaCorta(estado.llegada) + ' al ' + fechaCorta(estado.salida) + '</p>' +
            '<p>' + (caben.length === 1 ? 'Libre esas noches: ' : 'Libres esas noches: ') + '<b>' + esc(lista(caben)) + '</b>. Desde <span class="cifra">' + D.precioDesde + ' €</span> la noche; el precio de esas fechas lo da su web.</p>' +
            '<a class="btn btn--acento btn--grande" id="cal-ir" href="' + esc(url) + '" target="_blank" rel="noopener">Reservar en su web<span class="vh"> (se abre en otra pestaña, con estas fechas)</span></a>' +
            '<p class="fino" style="margin-top:0">Se abre el motor de reservas de la casa con las fechas puestas. Allí eliges apartamento y pagas.</p>' +
            '<button type="button" class="cal__limpiar" id="cal-limpiar">Cambiar las fechas</button>';
        } else if (estado.llegada) {
          var min = Math.min.apply(null, quienes().filter(function (id) { return libre(id, idx(estado.llegada)); }).map(function (id) { return +dato(id, 'min', idx(estado.llegada)) || 1; }));
          h += '<p>Llegada el <b>' + fechaLarga(estado.llegada) + '</b>. Ese día, la estancia mínima es de <span class="cifra">' + min + '</span> noches.</p><button type="button" class="cal__limpiar" id="cal-limpiar">Empezar de nuevo</button>';
        } else {
          h += '<p>Estancia mínima según su motor: ' + (minTxt.length > 1 ? 'de <span class="cifra">' + minTxt[0] + '</span> a <span class="cifra">' + minTxt[minTxt.length - 1] + '</span> noches, según la fecha.' : '<span class="cifra">' + (minTxt[0] || 2) + '</span> noches.') + '</p>';
        }
        resumen.innerHTML = h;
      }
      var MOTIVO = function (r) {
        return r === 'ocupado' ? 'Entre esas fechas hay noches ocupadas: prueba con otra salida o con otro apartamento.' : r === 'salida' ? 'Su motor no deja salir ese día.' : r === 'entrada' ? 'Su motor no deja entrar ese día.' : r === 'max' ? 'Su motor admite como mucho 30 noches.' : r.indexOf('min') === 0 ? 'Llegando ese día, la estancia mínima es de ' + r.slice(3) + ' noches.' : 'Esas fechas quedan fuera de lo que ofrece su motor.';
      };
      function tocar(t) {
        estado.error = '';
        if (!estado.llegada || estado.salida || t <= estado.llegada) {
          if (!puedeEntrar(t)) { estado.error = t < hoy ? '' : 'Ese día no se puede llegar: la noche está ocupada o su motor no deja entrar.'; if (estado.salida) { estado.llegada = estado.salida = null; } pintar(true); return; }
          estado.llegada = t; estado.salida = null;
        } else {
          var motivos = quienes().map(function (id) { return valida(id, estado.llegada, t); });
          if (motivos.every(function (r) { return r; })) { estado.error = MOTIVO(motivos.filter(function (r) { return r !== 'ocupado'; })[0] || 'ocupado'); }
          else estado.salida = t;
        }
        pintar(true);
      }

      var quitar = [];
      var oir = function (tg, ev, fn) { tg.addEventListener(ev, fn); quitar.push(function () { tg.removeEventListener(ev, fn); }); };
      oir(el, 'click', function (e) {
        var d = e.target.closest('.dia');
        if (d) { foco = d.getAttribute('data-f'); if (d.classList.contains('es-pasado')) return; tocar(utc(foco)); return; }
        var c = e.target.closest('[data-apto]');
        if (c) { estado.apto = c.dataset.apto; if (estado.llegada && estado.salida && quienes().every(function (id) { return valida(id, estado.llegada, estado.salida); })) { estado.llegada = estado.salida = null; } estado.error = ''; pintar(); return; }
        if (e.target.closest('#cal-ant') && !ant.disabled) { estado.mes = masMes(estado.mes, -1); foco = null; pintar(); return; }
        if (e.target.closest('#cal-sig') && !sig.disabled) { estado.mes = masMes(estado.mes, 1); foco = null; pintar(); return; }
        if (e.target.closest('#cal-limpiar')) { estado.llegada = estado.salida = null; estado.error = ''; pintar(true); }
      });
      oir(el, 'change', function (e) {
        if (e.target.id === 'cal-adultos') estado.adultos = +e.target.value;
        if (e.target.id === 'cal-ninos') estado.ninos = +e.target.value;
        pintarResumen();
      });
      oir(meses, 'keydown', function (e) {
        var d = e.target.closest('.dia');
        if (!d) return;
        var paso = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
        if (!paso) return;
        e.preventDefault();
        var t = utc(d.getAttribute('data-f')) + paso * DIA;
        if (t < Math.max(hoy, t0) || t > ultimo + 31 * DIA) return;
        var iso = isoDe(t);
        if (!meses.querySelector('[data-f="' + iso + '"]')) {
          var otro = masMes(estado.mes, paso > 0 ? 1 : -1);
          if (otro < primerMes() || masMes(otro, paso > 0 ? 1 : 0) > ultimoMes()) return;
          estado.mes = otro;
        }
        d.tabIndex = -1; foco = iso; pintar(true);
      });

      var api = {
        apto: function (id) { if (id && (id === 'todos' || LETRA[id])) { estado.apto = id; estado.error = ''; pintar(); } },
        estado: function () { return { apto: estado.apto, llegada: estado.llegada ? isoDe(estado.llegada) : null, salida: estado.salida ? isoDe(estado.salida) : null, error: estado.error, mes: isoDe(estado.mes), cierre: hayCierre ? isoDe(t0 + cierre * DIA) : null }; },
        valida: function (id, a, b) { return valida(id, utc(a), utc(b)); },
        destruir: function () { quitar.forEach(function (f) { f(); }); el.classList.remove('es-montado'); el.removeAttribute('data-montado'); el.innerHTML = respaldo; instancia = null; },
      };
      instancia = api;
      pintar();
      if (pendiente) { api.apto(pendiente); pendiente = null; }
      el.setAttribute('data-montado', '');
      return api;
    },
  };
})(window);
