/* Camín de Muniellos · la fecha y la hora comunes a toda la web (contrato con Lugar 3D).
   window.Camin.ahora() → Date. Sin parámetros, es ahora mismo. Para probar: ?fecha=AAAA-MM-DD y ?hora=HH:MM
   (hora de Madrid). Lo usan el roble (la estación), el horario de Muniellos, el calendario y el sol del 3D.
   Camin.madrid(date) → { anio, mes, dia, hora, minuto, diaSemana } en hora de Madrid. */
(function (w) {
  'use strict';
  var C = (w.Camin = w.Camin || {});
  var q = null;
  try { q = new URLSearchParams(w.location.search); } catch (e) { /* sin URLSearchParams */ }

  function partes(t) {
    var p = {};
    try {
      new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
        .formatToParts(new Date(t)).forEach(function (x) { p[x.type] = +x.value; });
    } catch (e) {
      var u = new Date(t + 3600000);
      p = { year: u.getUTCFullYear(), month: u.getUTCMonth() + 1, day: u.getUTCDate(), hour: u.getUTCHours(), minute: u.getUTCMinutes() };
    }
    return p;
  }
  // el instante en que en Madrid son las hh:mi del día a-m-d
  function desdeMadrid(a, m, d, hh, mi) {
    var base = Date.UTC(a, m - 1, d, hh, mi), x = base - 3600000;
    for (var k = 0; k < 3; k++) {
      var v = partes(x), vista = Date.UTC(v.year, v.month - 1, v.day, v.hour, v.minute);
      if (vista === base) break;
      x += base - vista;
    }
    return x;
  }
  var hq = q && q.get('hora'), fq = q && q.get('fecha');
  var mh = hq && /^(\d{1,2}):(\d{2})$/.exec(hq), mf = fq && /^(\d{4})-(\d{2})-(\d{2})$/.exec(fq);
  var arranque = Date.now(), fijo = null;
  if (mh || mf) {
    var p = partes(arranque);
    fijo = desdeMadrid(mf ? +mf[1] : p.year, mf ? +mf[2] : p.month, mf ? +mf[3] : p.day, mh ? +mh[1] : p.hour, mh ? +mh[2] : p.minute);
  }
  // con fecha u hora de prueba, el reloj sigue andando desde ese instante
  C.ahora = function () { return new Date(fijo === null ? Date.now() : fijo + (Date.now() - arranque)); };
  C.deprueba = fijo !== null;
  C.madrid = function (fecha) {
    var t = (fecha || C.ahora()).getTime(), v = partes(t);
    return { anio: v.year, mes: v.month, dia: v.day, hora: v.hour, minuto: v.minute, diaSemana: new Date(Date.UTC(v.year, v.month - 1, v.day)).getUTCDay() };
  };
  C.desdeMadrid = function (a, m, d, hh, mi) { return new Date(desdeMadrid(a, m, d, hh || 0, mi || 0)); };
})(window);
