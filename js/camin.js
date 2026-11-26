/* Camín de Muniellos · «el camín»: la línea de suelo del logo sale de la portada y recorre la página hasta el robledal
   del pie. Un solo trazo continuo, con MOJONES DE KILÓMETRO REALES: la casa es el km 0 y el final es Tablizas.
   - Los datos son los del vuelo 3D (data/lugar-camin.json → <script id="datos-camin">): los km de los mojones son los
     de la carretera, y los meandros de la línea son los de la carretera real (cuánto se aparta de la recta casa →
     Tablizas, cada 100 m). Nada se coloca «a ojo»: cada mojón cae en su kilómetro, a escala, a lo largo de la página.
   - El tramo que tapa #lugar (ahí el camín es el vuelo 3D) no cuenta: la línea «entra» y «sale» en el mismo kilómetro.
   - El caminante: un punto que va por la línea a la altura de lectura y dice por qué kilómetro vas (también en la
     cabecera). Los mojones ya pasados se llenan. Es contenido: se actualiza también con movimiento reducido.
   Camin.camin.montar(el, { movimiento, densidad }) → { destruir(), km() }. En la versión sobria no se monta. */
(function (w) {
  'use strict';
  var C = (w.Camin = w.Camin || {});
  var NS = 'http://www.w3.org/2000/svg';
  var fmt = function (v) { var s = (Math.round(v * 10) / 10).toFixed(1).replace('.', ','); return s.replace(/,0$/, ''); };

  C.camin = {
    montar: function (el, op) {
      op = op || {};
      var datos = document.getElementById('datos-camin');
      var pagina = document.getElementById('pagina'), ini = document.getElementById('suelo'), fin = document.getElementById('suelo-fin');
      if (!datos || !pagina || !ini || !fin) throw new Error('faltan los datos o los extremos del camín');
      if (op.densidad === 'sobria') return { destruir: function () {}, km: function () { return 0; } };
      var D = JSON.parse(datos.textContent);
      var raiz = document.documentElement;
      var cabKm = document.getElementById('cab-km'), cabN = document.getElementById('cab-km-n');
      var tapa = document.getElementById('lugar');

      el.innerHTML = '';
      var svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('class', 'camin__svg');
      var base = document.createElementNS(NS, 'path'); base.setAttribute('class', 'camin__base');
      var andado = document.createElementNS(NS, 'path'); andado.setAttribute('class', 'camin__andado');
      svg.appendChild(base); svg.appendChild(andado);
      el.appendChild(svg);
      var mojones = D.hitos.map(function (h, i) {
        var m = document.createElement('div');
        m.className = 'mojon mojon--' + (i === 0 ? 'casa' : h.tipo);
        m.innerHTML = '<span><b>km ' + fmt(h.km) + '</b>' + (i === 0 ? 'La casa' : h.n) + '</span>';
        el.appendChild(m);
        return { el: m, km: h.km };
      });
      var caminante = document.createElement('div');
      caminante.className = 'caminante';
      caminante.innerHTML = '<span></span>';
      el.appendChild(caminante);
      var rotulo = caminante.firstChild;
      raiz.classList.add('con-camin');
      if (cabKm) cabKm.hidden = false;

      // geometría (en coordenadas de la página, relativas a .camin)
      var y0 = 0, y1 = 0, hueco0 = 0, hueco1 = 0, eje = 0, radio = 0, amp = 0, largoUtil = 1;
      var pts = [], acum = [], total = 0, largoArco = 0;
      var kmAy = function (km) {                       // y de la página para un km (saltando el hueco de #lugar)
        var y = y0 + radio + (km / D.kmTotal) * largoUtil;
        return y >= hueco0 ? y + (hueco1 - hueco0) : y;
      };
      var yAkm = function (y) {
        if (y > hueco0 && y < hueco1) y = hueco0;
        else if (y >= hueco1) y -= (hueco1 - hueco0);
        return Math.max(0, Math.min(D.kmTotal, ((y - y0 - radio) / largoUtil) * D.kmTotal));
      };
      var xDe = function (i) { return eje - D.dev[i] * amp; };
      function medir() {
        var caja = el.getBoundingClientRect(), cs = getComputedStyle(raiz);
        eje = parseFloat(cs.getPropertyValue('--camin-eje')) || 9;
        radio = parseFloat(cs.getPropertyValue('--camin-radio')) || 14;
        amp = Math.max(0, Math.min(eje - 4, caja.width > 60 ? 22 : 4));
        y0 = ini.getBoundingClientRect().top - caja.top + 1;
        y1 = fin.getBoundingClientRect().top - caja.top + 1;
        if (tapa) { var r = tapa.getBoundingClientRect(); hueco0 = r.top - caja.top; hueco1 = r.bottom - caja.top; } else { hueco0 = hueco1 = 1e9; }
        if (hueco0 < y0 || hueco1 > y1) { hueco0 = hueco1 = 1e9; }
        largoUtil = Math.max(200, (y1 - radio) - (y0 + radio) - (hueco1 < 1e9 ? hueco1 - hueco0 : 0));
      }
      function trazar() {
        medir();
        pts = [];
        var n = D.dev.length;
        // sale de la línea de suelo de la portada con un cuarto de vuelta, baja con los meandros de la carretera
        // y llega a la línea de suelo del robledal con otro cuarto de vuelta
        var d = 'M' + (eje + radio).toFixed(1) + ' ' + y0.toFixed(1) + 'Q' + xDe(0).toFixed(1) + ' ' + y0.toFixed(1) + ' ' + xDe(0).toFixed(1) + ' ' + (y0 + radio).toFixed(1);
        largoArco = radio * 1.62;
        var prev = { x: xDe(0), y: y0 + radio };
        pts.push({ x: prev.x, y: prev.y, km: 0 });
        for (var i = 1; i < n; i++) {
          var km = Math.min(D.kmTotal, i / 10), p = { x: xDe(i), y: kmAy(km), km: km };
          // al cruzar el hueco de #lugar, recto
          d += 'L' + p.x.toFixed(1) + ' ' + p.y.toFixed(1);
          pts.push(p); prev = p;
        }
        d += 'Q' + prev.x.toFixed(1) + ' ' + y1.toFixed(1) + ' ' + (eje + radio).toFixed(1) + ' ' + y1.toFixed(1);
        base.setAttribute('d', d); andado.setAttribute('d', d);
        total = andado.getTotalLength();
        acum = [largoArco];
        for (var k = 1; k < pts.length; k++) acum.push(acum[k - 1] + Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y));
        andado.style.strokeDasharray = total.toFixed(1);
        mojones.forEach(function (m) {
          var i2 = Math.min(n - 1, Math.round(m.km * 10));
          m.y = kmAy(m.km);
          m.el.style.transform = 'translate(' + (xDe(i2) - 5).toFixed(1) + 'px,' + (m.y - 7).toFixed(1) + 'px)';
        });
        andar();
      }
      var kmActual = 0;
      function andar() {
        var caja = el.getBoundingClientRect();
        var y = Math.max(y0 + radio, Math.min(y1 - radio, innerHeight * 0.55 - caja.top));
        if (y > hueco0 && y < hueco1) y = hueco0;
        var km = yAkm(y), f = km * 10, i = Math.min(pts.length - 2, Math.floor(f)), t = f - i;
        if (i < 0 || !pts.length) return;
        var a = pts[i], b = pts[i + 1], x = a.x + (b.x - a.x) * t, yy = a.y + (b.y - a.y) * t;
        if (y <= hueco0 && yy > hueco0) yy = hueco0;
        var largo = acum[i] + (acum[i + 1] - acum[i]) * t;
        andado.style.strokeDashoffset = Math.max(0, total - largo).toFixed(1);
        caminante.style.transform = 'translate(' + x.toFixed(1) + 'px,' + yy.toFixed(1) + 'px)';
        var visto = scrollY > 40;
        caminante.style.opacity = visto ? '1' : '0';
        if (Math.abs(km - kmActual) >= 0.05 || km === 0 || km === D.kmTotal) {
          kmActual = km;
          var s = fmt(km);
          rotulo.textContent = 'km ' + s;
          if (cabN) cabN.textContent = s;
          mojones.forEach(function (m) { m.el.classList.toggle('es-pasado', m.km <= km + 0.02); });
        }
      }

      // con el scroll: un cálculo por fotograma, pasivo
      var pend = 0, vivo = true;
      var alScroll = function () { if (!pend) pend = requestAnimationFrame(function () { pend = 0; if (vivo) andar(); }); };
      addEventListener('scroll', alScroll, { passive: true });
      // la página cambia de alto (módulos que se montan, fotos, letras): se vuelve a trazar. La barra del móvil no cuenta:
      // no cambia el alto del documento.
      var tR = 0, altoDoc = 0;
      var ro = 'ResizeObserver' in w ? new ResizeObserver(function () {
        var h = pagina.offsetHeight;
        if (Math.abs(h - altoDoc) < 2) return;
        altoDoc = h;
        clearTimeout(tR); tR = setTimeout(function () { if (vivo) trazar(); }, 120);
      }) : null;
      if (ro) ro.observe(pagina);
      var alCambiar = function () { clearTimeout(tR); tR = setTimeout(function () { if (vivo) trazar(); }, 150); };
      document.addEventListener('camin:resize', alCambiar);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (vivo) trazar(); });
      altoDoc = pagina.offsetHeight;
      trazar();
      el.setAttribute('data-montado', '');

      return {
        km: function () { return kmActual; },
        geometria: function () { return { y0: y0, y1: y1, hueco0: hueco0, hueco1: hueco1, total: total, mojones: mojones.map(function (m) { return { km: m.km, y: m.y }; }) }; },
        destruir: function () {
          vivo = false; clearTimeout(tR); cancelAnimationFrame(pend);
          removeEventListener('scroll', alScroll);
          document.removeEventListener('camin:resize', alCambiar);
          if (ro) ro.disconnect();
          raiz.classList.remove('con-camin');
          if (cabKm) cabKm.hidden = true;
          el.removeAttribute('data-montado');
        },
      };
    },
  };
})(window);
