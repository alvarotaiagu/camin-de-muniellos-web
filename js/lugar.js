/* ------------------------------------------------------------------
   Camín de Muniellos · lugar.js · «De la casa a Muniellos» (agente Lugar 3D)
   window.Camin.lugar.montar(el, { movimiento, densidad, webgl }) → { destruir(), estado(), ver3d(), verPlano(), irA(km) }

   La casa modelada sobre su planta del Catastro y, con el scroll, un vuelo que
   sigue la carretera real (OSRM/OSM) valle del Narcea arriba hasta Tablizas, la
   entrada a la Reserva de Muniellos. Relieve (MDT05/MDT25) y ortofoto (PNOA) del
   IGN, CC BY 4.0, a escala real. El sol es el de ahora (Camin.ahora(), que admite
   ?fecha= y ?hora=) y el relieve echa su sombra: se calcula en el navegador
   marchando por las alturas hacia el sol, solo cuando el sol cambia.
   - Three.js 0.160.0, copia propia en vendor/, pedido con import() solo cuando
     hace falta (nunca en el móvil antes de pulsar el botón).
   - Plan B en el mismo hueco (sin WebGL, movimiento reducido, «sobria», ahorro de
     datos, móvil antes del botón, navegador automatizado y mientras carga el 3D):
     el perfil de altura real del camino, con sus hitos y sus km, y su planta.
   El HTML que trae `el` es el respaldo: se guarda y se repone al destruir.
   Parámetros: ?fps · ?sin-webgl · ?lugar=3d (fuerza el 3D en un navegador
   automatizado; solo para pruebas).
   ------------------------------------------------------------------ */
(function () {
  'use strict';
  var A = (window.Camin = window.Camin || {});
  if (A.lugar && A.lugar.montar) return;

  var SCRIPT = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '';
  var RAIZ = SCRIPT ? new URL('../', SCRIPT).href : (typeof location !== 'undefined' ? new URL('./', location.href).href : './');
  var VER = SCRIPT.indexOf('?') > 0 ? SCRIPT.slice(SCRIPT.indexOf('?')) : '';       // la misma huella que le ponga versionar.mjs
  var BASE = RAIZ + 'img/lugar/';
  var CAMIN = RAIZ + 'data/lugar-camin.json' + VER;
  var ESCENA = RAIZ + 'data/lugar-escena.json' + VER;
  var THREE_URL = RAIZ + 'vendor/three-0.160.0.module.min.js';
  var RAD = Math.PI / 180;

  /* ============ utilidades ============ */
  var lim = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var suave = function (a, b, x) { var t = lim((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var hexA = function (c) { return [1, 3, 5].map(function (i) { return parseInt(c.slice(i, i + 2), 16); }); };
  var mezcla = function (a, b, t) { var x = hexA(a), y = hexA(b); return '#' + x.map(function (v, i) { return pad(Math.round(lim(lerp(v, y[i], t), 0, 255)).toString(16)); }).join(''); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var coma = function (v, d) { return v.toFixed(d === undefined ? 1 : d).replace('.', ','); };
  var RUMBOS = ['norte', 'noreste', 'este', 'sureste', 'sur', 'suroeste', 'oeste', 'noroeste'];
  var rumbo = function (az) { return RUMBOS[Math.round((((az % 360) + 360) % 360) / 45) % 8]; };
  function ahora() { try { if (A.ahora) { var f = A.ahora(); if (f instanceof Date && !isNaN(f)) return f; } } catch (e) { /* sin ahora.js */ } return new Date(); }
  var fmtHora = null;
  function horaDe(f) {
    try { fmtHora = fmtHora || new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hour12: false }); return fmtHora.format(f); }
    catch (e) { return pad(f.getHours()) + ':' + pad(f.getMinutes()); }
  }

  /* ============ el sol (fórmulas de la NOAA / Meeus; validado contra JPL Horizons en scripts/lugar-sol.mjs) ============ */
  // { azimut (desde el norte, hacia el este), altura (aparente, con refracción), alturaGeometrica } en grados
  function sol(f, lat, lon) {
    var jd = f.valueOf() / 864e5 + 2440587.5, T = (jd - 2451545) / 36525;
    var L0 = (((280.46646 + T * (36000.76983 + T * 0.0003032)) % 360) + 360) % 360;
    var M = 357.52911 + T * (35999.05029 - 0.0001537 * T), Mr = M * RAD;
    var e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
    var C = Math.sin(Mr) * (1.914602 - T * (0.004817 + 0.000014 * T)) + Math.sin(2 * Mr) * (0.019993 - 0.000101 * T) + Math.sin(3 * Mr) * 0.000289;
    var om = (125.04 - 1934.136 * T) * RAD;
    var lam = (L0 + C - 0.00569 - 0.00478 * Math.sin(om)) * RAD;
    var eps = (23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60 + 0.00256 * Math.cos(om)) * RAD;
    var dec = Math.asin(Math.sin(eps) * Math.sin(lam));
    var y = Math.tan(eps / 2); y *= y;
    var L0r = L0 * RAD;
    var eqT = 4 / RAD * (y * Math.sin(2 * L0r) - 2 * e * Math.sin(Mr) + 4 * e * y * Math.sin(Mr) * Math.cos(2 * L0r) - 0.5 * y * y * Math.sin(4 * L0r) - 1.25 * e * e * Math.sin(2 * Mr));
    var minUTC = (((f.valueOf() % 864e5) + 864e5) % 864e5) / 6e4;
    var tst = (((minUTC + eqT + 4 * lon) % 1440) + 1440) % 1440;
    var ha = (tst / 4 - 180) * RAD, la = lat * RAD;
    var cosZ = lim(Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(ha), -1, 1);
    var geo = 90 - Math.acos(cosZ) / RAD;
    var az = (Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(la) - Math.tan(dec) * Math.cos(la)) / RAD + 180 + 360) % 360;
    var refr = geo > -1 ? 1.02 / Math.tan((geo + 10.3 / (geo + 5.11)) * RAD) / 60 : 0;      // Bennett, en grados
    return { azimut: az, altura: geo + refr, alturaGeometrica: geo };
  }

  /* ============ la luna (fórmulas de SunCalc, V. Agafonkin; solo para la noche) ============ */
  var J1970 = 2440588, J2000 = 2451545, OBL = RAD * 23.4397;
  var diasJ = function (f) { return f.valueOf() / 864e5 - 0.5 + J1970 - J2000; };
  var ascRec = function (l, b) { return Math.atan2(Math.sin(l) * Math.cos(OBL) - Math.tan(b) * Math.sin(OBL), Math.cos(l)); };
  var declin = function (l, b) { return Math.asin(Math.sin(b) * Math.cos(OBL) + Math.cos(b) * Math.sin(OBL) * Math.sin(l)); };
  function luna(f, lat, lon) {
    var d = diasJ(f), phi = RAD * lat;
    var L = RAD * (218.316 + 13.176396 * d), M = RAD * (134.963 + 13.064993 * d), F = RAD * (93.272 + 13.22935 * d);
    var l = L + RAD * 6.289 * Math.sin(M), b = RAD * 5.128 * Math.sin(F), dist = 385001 - 20905 * Math.cos(M);
    var ra = ascRec(l, b), dec = declin(l, b);
    var Ms = RAD * (357.5291 + 0.98560028 * d), Ls = Ms + RAD * (1.9148 * Math.sin(Ms) + 0.02 * Math.sin(2 * Ms) + 0.0003 * Math.sin(3 * Ms)) + RAD * 102.9372 + Math.PI;
    var sra = ascRec(Ls, 0), sdec = declin(Ls, 0);
    var H = RAD * (280.16 + 360.9856235 * d) + RAD * lon - ra;
    var alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H)) / RAD;
    var az = (Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)) / RAD + 180 + 360) % 360;
    var fi = Math.acos(Math.sin(sdec) * Math.sin(dec) + Math.cos(sdec) * Math.cos(dec) * Math.cos(sra - ra));
    var inc = Math.atan2(149598000 * Math.sin(fi), dist - 149598000 * Math.cos(fi));
    var ang = Math.atan2(Math.cos(sdec) * Math.sin(sra - ra), Math.sin(sdec) * Math.cos(dec) - Math.cos(sdec) * Math.sin(dec) * Math.cos(sra - ra));
    return { alt: alt, az: az, luz: (1 + Math.cos(inc)) / 2, fase: 0.5 + 0.5 * inc * (ang < 0 ? -1 : 1) / Math.PI };
  }

  /* ============ el cielo según la altura del sol ============ */
  var CIELO = [            // [altura del sol, cenit, horizonte]
    [-18, '#04060d', '#0a0f1e'],
    [-10, '#0a1230', '#22284a'],
    [-4, '#22305c', '#8a5c6c'],
    [0, '#3c5893', '#ee9e7a'],
    [5, '#5a80bd', '#f4c7a0'],
    [15, '#6c96ce', '#dce5ec'],
    [40, '#4c82c4', '#cfdeea'],
  ];
  function cieloPara(alt) {
    if (alt <= CIELO[0][0]) return { cz: CIELO[0][1], ch: CIELO[0][2] };
    for (var i = 1; i < CIELO.length; i++) {
      if (alt <= CIELO[i][0]) { var a = CIELO[i - 1], b = CIELO[i], t = (alt - a[0]) / (b[0] - a[0]); return { cz: mezcla(a[1], b[1], t), ch: mezcla(a[2], b[2], t) }; }
    }
    var u = CIELO[CIELO.length - 1]; return { cz: u[1], ch: u[2] };
  }
  function fraseCielo(f, lat, lon, fijada) {
    var s = sol(f, lat, lon), h = horaDe(f), ini = fijada ? 'A las ' + h : 'Ahora, ' + h;
    if (s.altura > 0.5) return ini + ': el sol está al ' + rumbo(s.azimut) + ', a ' + Math.round(s.altura) + '° sobre el horizonte.';
    if (s.altura > -6) return ini + ': el sol está justo bajo el horizonte, al ' + rumbo(s.azimut) + '.';
    var l = luna(f, lat, lon);
    return ini + ': es de noche en el valle' + (l.alt > 0 && l.luz > 0.05 ? '; la luna está al ' + rumbo(l.az) + ', a ' + Math.round(l.alt) + '°.' : '.');
  }

  /* ============ interpolación monótona (Hermite con tangentes de Fritsch-Butland), como en scripts/lugar-datos.py ============ */
  function monotona(ps, vs) {
    var n = ps.length, d = [], m = [], i;
    for (i = 0; i < n - 1; i++) d[i] = (vs[i + 1] - vs[i]) / (ps[i + 1] - ps[i]);
    m[0] = 0; m[n - 1] = 0;
    for (i = 1; i < n - 1; i++) {
      if (d[i - 1] * d[i] <= 0) { m[i] = 0; continue; }
      var h0 = ps[i] - ps[i - 1], h1 = ps[i + 1] - ps[i];
      m[i] = 3 * (h0 + h1) / ((2 * h1 + h0) / d[i - 1] + (h1 + 2 * h0) / d[i]);
    }
    var k = 0;
    return function (p) {
      if (p <= ps[0]) return vs[0];
      if (p >= ps[n - 1]) return vs[n - 1];
      if (p < ps[k]) k = 0;
      while (k < n - 2 && p > ps[k + 1]) k++;
      var h = ps[k + 1] - ps[k], t = (p - ps[k]) / h, t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * vs[k] + (t3 - 2 * t2 + t) * h * m[k] + (-2 * t3 + 3 * t2) * vs[k + 1] + (t3 - t2) * h * m[k + 1];
    };
  }
  function lineal(xs, ys) {
    var k = 0, n = xs.length;
    return function (x) {
      if (x <= xs[0]) return ys[0];
      if (x >= xs[n - 1]) return ys[n - 1];
      if (x < xs[k]) k = 0;
      while (k < n - 2 && x > xs[k + 1]) k++;
      return ys[k] + (ys[k + 1] - ys[k]) * (x - xs[k]) / (xs[k + 1] - xs[k]);
    };
  }
  function camino(vuelo) {
    var ps = vuelo.map(function (r) { return r.p; });
    var f = [0, 1, 2].map(function (k) { return monotona(ps, vuelo.map(function (r) { return r.pos[k]; })); });
    var g = [0, 1, 2].map(function (k) { return monotona(ps, vuelo.map(function (r) { return r.mira[k]; })); });
    var km = lineal(ps, vuelo.map(function (r) { return r.km; }));
    return function (p) { return { pos: [f[0](p), f[1](p), f[2](p)], mira: [g[0](p), g[1](p), g[2](p)], km: km(p) }; };
  }
  // el hito en el que se está (el último ya pasado) y el siguiente
  function hitoEn(hitos, km) {
    var i = 0;
    for (var k = 0; k < hitos.length; k++) if (hitos[k].km <= km + 0.05) i = k;
    return { actual: hitos[i], indice: i, siguiente: hitos[i + 1] || null };
  }

  /* ============ alturas: PNG RGB → metros ============ */
  function cargarAlturas(url) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error('alturas ' + r.status); return r.blob(); })
      .then(function (b) {
        var op = { colorSpaceConversion: 'none', premultiplyAlpha: 'none' };
        return (window.createImageBitmap ? createImageBitmap(b, op).catch(function () { return createImageBitmap(b); }) : Promise.reject(new Error('sin createImageBitmap')));
      })
      .then(function (bmp) {
        var c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
        var g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(bmp, 0, 0);
        var d = g.getImageData(0, 0, c.width, c.height).data, n = c.width * c.height, out = new Float32Array(n);
        for (var i = 0; i < n; i++) out[i] = (d[i * 4] * 256 + d[i * 4 + 1]) / 10 - 100;
        if (bmp.close) bmp.close();
        return { w: c.width, h: c.height, data: out };
      });
  }
  function muestreador(r) {
    var sx = (r.w - 1) / (r.x1 - r.x0), sz = (r.h - 1) / (r.z1 - r.z0), w = r.w, h = r.h, a = r.data;
    return function (x, z) {
      var fx = lim((x - r.x0) * sx, 0, w - 1.0001), fz = lim((z - r.z0) * sz, 0, h - 1.0001);
      var i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, k = j * w + i;
      return (a[k] * (1 - u) + a[k + 1] * u) * (1 - v) + (a[k + w] * (1 - u) + a[k + w + 1] * u) * v;
    };
  }
  function pesoCaja(r, x, z, b) { var d = Math.min(x - r.x0, r.x1 - x, z - r.z0, r.z1 - z); return lim(d / b, 0, 1); }

  /* ============ la sombra del relieve (en el navegador, sin GPU) ============ */
  // Para cada celda de una rejilla W × H sobre `caja`, ¿le da el sol? Marcha hacia el sol por el relieve (pasos que
  // crecen) y compara la pendiente máxima con la altura del sol, con la penumbra del disco. Escribe 0..255 en el
  // canal rojo (y en verde y azul) de `out` (RGBA), filas j0..j1. az y alt en grados; hMax: la cota más alta.
  function sombraRelieve(hFn, caja, W, H, az, alt, out, j0, j1, hMax) {
    var dx = Math.sin(az * RAD), dz = -Math.cos(az * RAD), tanS = Math.tan(alt * RAD);
    var pw = (caja.x1 - caja.x0) / W, ph = (caja.z1 - caja.z0) / H, wd = 0.0047 * (1 + tanS * tanS);
    for (var j = j0; j < j1; j++) {
      for (var i = 0; i < W; i++) {
        var luz = 0;
        if (alt > -1) {
          var x = caja.x0 + (i + 0.5) * pw, z = caja.z0 + (j + 0.5) * ph, y = hFn(x, z) + 2, t = 30, maxT = -10;
          while (t < 14000) {
            var a = (hFn(x + dx * t, z + dz * t) - y) / t;
            if (a > maxT) { maxT = a; if (maxT > tanS + wd) break; }
            if (y + (tanS + wd) * t > hMax) break;
            t += Math.min(t * 0.14 + 18, 220);
          }
          luz = suave(-wd, wd, tanS - maxT);
        }
        var k = (j * W + i) * 4, v = Math.round(luz * 255);
        out[k] = v; out[k + 1] = v; out[k + 2] = v; out[k + 3] = 255;
      }
    }
  }

  /* ============ texturas dibujadas (ligeras) ============ */
  function azar(semilla) { var s = semilla >>> 0 || 1; return function () { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
  function lienzo(lado, pintar, alto) { var c = document.createElement('canvas'); c.width = lado; c.height = alto || lado; pintar(c.getContext('2d'), lado, alto || lado); return c; }
  function ruidoPlano(g, L, r, k) {
    var im = g.getImageData(0, 0, L, L), d = im.data;
    for (var i = 0; i < d.length; i += 4) { var n = (r() - 0.5) * k; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    g.putImageData(im, 0, 0);
  }
  // la mampostería de su planta baja: lajas irregulares gris azulado y ocres, con junta clara
  function texPiedra(semilla) {
    return lienzo(512, function (g, L) {
      var r = azar(semilla);
      g.fillStyle = '#9a9488'; g.fillRect(0, 0, L, L);
      var y = 0;
      while (y < L) {
        var hh = 20 + r() * 22, x = -r() * 50;
        while (x < L + 50) {
          var ww = 34 + r() * 70, q = r();
          var base = q < 0.46 ? '#6f7882' : q < 0.72 ? '#b98f52' : q < 0.88 ? '#8a8378' : '#c7a66a';
          g.fillStyle = mezcla(base, r() < 0.5 ? '#4d535a' : '#d9cfbb', r() * 0.3);
          g.beginPath();
          g.moveTo(x + 2, y + 2 + (r() - 0.5) * 5); g.lineTo(x + ww - 2, y + 2 + (r() - 0.5) * 5); g.lineTo(x + ww - 2 + (r() - 0.5) * 6, y + hh - 2); g.lineTo(x + 2 + (r() - 0.5) * 6, y + hh - 2);
          g.closePath(); g.fill();
          g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(x + 2, y + hh - 5, ww - 4, 3);
          x += ww;
        }
        y += hh;
      }
      ruidoPlano(g, L, r, 16);
    });
  }
  function texRevoco(base, semilla) {
    return lienzo(256, function (g, L) {
      var r = azar(semilla); g.fillStyle = base; g.fillRect(0, 0, L, L);
      ruidoPlano(g, L, r, 9);
      for (var k = 0; k < 26; k++) { g.fillStyle = 'rgba(70,55,35,' + (r() * 0.03).toFixed(3) + ')'; g.fillRect(r() * L, r() * L, 10 + r() * 40, 2 + r() * 30); }
    });
  }
  function texMadera(base, semilla) {       // tablas verticales con veta
    return lienzo(256, function (g, L) {
      var r = azar(semilla); g.fillStyle = base; g.fillRect(0, 0, L, L);
      for (var x = 0; x < L; x += 32) {
        g.fillStyle = mezcla(base, r() < 0.5 ? '#2a1a0e' : '#c79a62', r() * 0.22); g.fillRect(x, 0, 31, L);
        g.fillStyle = 'rgba(20,10,4,.55)'; g.fillRect(x + 31, 0, 1.5, L);
      }
      for (var k = 0; k < 160; k++) { g.fillStyle = 'rgba(' + (r() < 0.5 ? '40,24,10' : '190,140,90') + ',' + (0.05 + r() * 0.1).toFixed(2) + ')'; g.fillRect(r() * L, r() * L, 1 + r() * 2, 20 + r() * 80); }
    });
  }
  function texPizarra(semilla) {            // losas de pizarra en hileras, cada una con su tono
    return lienzo(256, function (g, L) {
      var r = azar(semilla), fh = L / 10;
      g.fillStyle = '#2f343b'; g.fillRect(0, 0, L, L);
      for (var j = 0; j < 10; j++) {
        var x = -r() * 30;
        while (x < L) {
          var ww = 18 + r() * 26;
          g.fillStyle = mezcla('#59616b', r() < 0.5 ? '#3c424a' : '#7b838c', r() * 0.6);
          g.fillRect(x + 0.6, j * fh + 0.6, ww - 1.2, fh - 1.2);
          g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(x + 0.6, (j + 1) * fh - 3, ww - 1.2, 2.4);
          x += ww;
        }
      }
      ruidoPlano(g, L, r, 10);
    });
  }
  function texTejado(semilla) {             // hileras neutras: el color de cada tejado del pueblo lo pone la ortofoto
    return lienzo(128, function (g, L) {
      var r = azar(semilla); g.fillStyle = '#e4e2de'; g.fillRect(0, 0, L, L);
      for (var j = 0; j < 8; j++) { g.fillStyle = 'rgba(0,0,0,.16)'; g.fillRect(0, (j + 1) * L / 8 - 2, L, 2); }
      ruidoPlano(g, L, r, 20);
    });
  }

  /* ============ el perfil del camino (SVG): lo usan el plan B, la espera del 3D y la tira del vuelo ============ */
  // ruta: [[lon, lat, cota, km], …]. Devuelve { svg, X(km), Y(cota), exageracion } en un viewBox de W × H.
  function perfil(camin, o) {
    var W = o.w, H = o.h, mi = o.izq || 0, md = o.der || 0, ma = o.arriba || 0, mb = o.abajo || 0;
    var R = camin.ruta, kmF = R[R.length - 1][3];
    var c0 = Math.floor((camin.cotaMin - 30) / 50) * 50, c1 = Math.ceil((camin.cotaMax + 20) / 50) * 50;
    var X = function (km) { return mi + (W - mi - md) * km / kmF; };
    var Y = function (c) { return H - mb - (H - ma - mb) * (c - c0) / (c1 - c0); };
    var linea = R.map(function (p, i) { return (i ? 'L' : 'M') + X(p[3]).toFixed(1) + ' ' + Y(p[2]).toFixed(1); }).join('');
    var area = linea + 'L' + X(kmF).toFixed(1) + ' ' + (H - mb) + 'L' + X(0).toFixed(1) + ' ' + (H - mb) + 'Z';
    var exag = ((H - ma - mb) / (c1 - c0)) / ((W - mi - md) / (kmF * 1000));
    return { linea: linea, area: area, X: X, Y: Y, c0: c0, c1: c1, kmF: kmF, exageracion: exag };
  }
  function cotaEn(camin) { return lineal(camin.ruta.map(function (p) { return p[3]; }), camin.ruta.map(function (p) { return p[2]; })); }

  /* ============ módulo ============ */
  function montar(el, opciones) {
    opciones = opciones || {};
    var q = new URLSearchParams(location.search);
    var reduce = opciones.movimiento === false || matchMedia('(prefers-reduced-motion: reduce)').matches;
    var sobria = opciones.densidad === 'sobria';
    var movil = matchMedia('(max-width: 820px)').matches || matchMedia('(pointer: coarse)').matches;
    var ahorro = !!(navigator.connection && navigator.connection.saveData);
    var forzar3d = q.get('lugar') === '3d';                                       // solo para pruebas
    var automatizado = !!navigator.webdriver && !forzar3d;                         // Playwright: nunca pinta el 3D
    var sinWebgl = opciones.webgl === false || q.has('sin-webgl') || automatizado;
    if (!sinWebgl && !sobria && !reduce && !forzar3d) {
      try { var cv0 = document.createElement('canvas'); sinWebgl = !cv0.getContext('webgl2'); } catch (e) { sinWebgl = true; }
    }
    var puede3d = !sinWebgl && !sobria && !reduce;
    var auto3d = puede3d && !movil && !ahorro;
    var fijada = A.deprueba !== undefined ? !!A.deprueba : (q.has('hora') || q.has('fecha'));
    var respaldo = el.innerHTML;
    var estado = { modo: 'plano', destruido: false, error3d: null, cargado: false, p: 0, pVis: 0, km: 0, calidad: 0, hito: '' };
    var escuchas = [];
    var escucha = function (o, ev, fn, op) { o.addEventListener(ev, fn, op); escuchas.push(function () { o.removeEventListener(ev, fn, op); }); };
    var t3 = null, meta = null, camin = null, cargando = null, intervalo = 0, cotaDe = null, planoB = null, tira = null;

    /* ---------- DOM ---------- */
    el.classList.add('lugar-mod');
    el.innerHTML =
      '<div class="lugar__pista">' +
        '<div class="lugar__escenario">' +
          '<p class="lugar__sr" data-l="resumen"></p>' +
          '<p class="lugar__botones"><button type="button" class="lugar__btn lugar__btn--suave" data-l="saltar">Saltar el vuelo</button>' +
          '<button type="button" class="lugar__btn lugar__btn--suave" data-l="aplano">Ver el perfil</button></p>' +
          '<div class="lugar__espera" data-l="espera"><div class="lugar__espera-perfil" data-l="esperaPerfil"></div><p class="lugar__aviso" data-l="aviso" role="status"></p></div>' +
          '<div class="lugar__rotulos" aria-hidden="true"></div>' +
          '<div class="lugar__hud" aria-hidden="true">' +
            '<p class="lugar__km"><span class="lugar__km-pre">km</span><b class="lugar__km-n" data-l="km">0,0</b><span class="lugar__km-de" data-l="kmDe"></span></p>' +
            '<p class="lugar__hito"><b data-l="hito"></b><span data-l="hitoSub"></span></p>' +
            '<p class="lugar__sig" data-l="sig"></p>' +
          '</div>' +
          '<p class="lugar__cielo" data-l="cielo3d"></p>' +
          '<div class="lugar__tira" data-l="tira"></div>' +
          '<p class="lugar__creditos">Relieve y ortofoto: IGN (CC BY 4.0) · Carretera y nombres: OpenStreetMap · Casa: Catastro</p>' +
        '</div>' +
      '</div>' +
      '<div class="lugar__planob">' +
        '<div class="lugar__cifras" data-l="cifras"></div>' +
        '<figure class="lugar__perfil">' +
          '<div class="lugar__perfil-marco" data-l="perfilMarco" tabindex="0" role="group" aria-label="Perfil de altura del camino, de la casa a Tablizas. Se puede desplazar en horizontal."></div>' +
          '<figcaption data-l="perfilPie"></figcaption>' +
        '</figure>' +
        '<div class="lugar__recorre">' +
          '<label class="lugar__regla"><span class="lugar__regla-tit">Recorre el camín</span>' +
          '<input type="range" data-l="regla" min="0" max="19.6" step="0.1" value="0" aria-label="Kilómetro del camino, de la casa a Tablizas"></label>' +
          '<p class="lugar__lectura" data-l="lectura" aria-live="polite"></p>' +
        '</div>' +
        '<div class="lugar__abajo">' +
          '<ol class="lugar__lista" data-l="lista"></ol>' +
          '<figure class="lugar__planta"><div data-l="planta"></div><figcaption>La carretera vista desde arriba, con el norte arriba.</figcaption></figure>' +
        '</div>' +
        '<p class="lugar__cielo" data-l="cielo2d"></p>' +
        '<p class="lugar__acciones"><button type="button" class="lugar__btn" data-l="a3d" hidden>Ver el vuelo en 3D</button></p>' +
      '</div>' +
      '<p class="lugar__fuente">Relieve MDT05 y MDT25 y ortofoto PNOA © Instituto Geográfico Nacional (CC BY 4.0), a escala real y sin exagerar. Carretera, pueblos y ríos © colaboradores de OpenStreetMap (ODbL); kilómetros y minutos calculados con OSRM. Planta de la casa © Dirección General del Catastro. El sol se calcula en tu navegador para Penlés.</p>';
    var $ = function (k, raiz) { return (raiz || el).querySelector('[data-l="' + k + '"]'); };
    var pista = el.querySelector('.lugar__pista'), escenario = el.querySelector('.lugar__escenario');
    var capaRot = el.querySelector('.lugar__rotulos');
    var aviso = $('aviso');
    var avisar = function (t) { aviso.textContent = t || ''; };

    function ponModo(m) {
      estado.modo = m;
      el.dataset.modo = m;
      $('a3d').hidden = !(puede3d && m === 'plano' && !estado.error3d);
      if (t3) t3.activo(m === '3d');
    }

    /* ---------- el cielo de ahora (texto) ---------- */
    function ponCielo() {
      if (!meta) return;
      var f = ahora(), t = fraseCielo(f, meta.lat, meta.lon, fijada);
      $('cielo3d').textContent = t; $('cielo2d').textContent = t + ' En el 3D, la luz y las sombras del relieve son las de este momento.';
      if (t3) t3.luces(f);
    }

    /* ---------- el camino: km → cota, hito ---------- */
    function ponKm(km) {
      if (!camin) return;
      estado.km = km;
      var h = hitoEn(camin.hitos, km), c = cotaDe(km);
      estado.hito = h.actual.nombre;
      $('km').textContent = coma(km);
      $('hito').textContent = h.actual.nombre;
      $('hitoSub').textContent = (h.actual.tipo === 'casa' ? 'Penlés · ' : '') + Math.round(c) + ' m' + (h.actual.detalle ? ' · ' + h.actual.detalle : '');
      $('sig').textContent = h.siguiente ? 'Siguiente: ' + h.siguiente.nombre + ', a ' + coma(Math.max(0, h.siguiente.km - km)) + ' km' : 'Fin del camín: aquí empieza la Reserva de Muniellos.';
      if (tira) tira.mover(km, h.indice);
    }
    function irA(km) {
      if (!meta) return;
      if (estado.modo !== '3d') { if (planoB) planoB.mover(km); return; }
      var tr = meta.tramos, p = km <= 0 ? 0 : km >= meta.kmFinal ? 1 : tr.sale + (tr.llega - tr.sale) * km / meta.kmFinal;
      var r = pista.getBoundingClientRect(), largo = pista.offsetHeight - escenario.offsetHeight;
      window.scrollTo({ top: r.top + window.scrollY + p * largo, behavior: reduce ? 'auto' : 'smooth' });
    }

    /* ---------- la tira del vuelo: el perfil en pequeño con los hitos como botones ---------- */
    function montarTira() {
      var P = perfil(camin, { w: 1000, h: 60, arriba: 8, abajo: 2 }), caja = $('tira');
      caja.innerHTML = '<svg viewBox="0 0 1000 60" preserveAspectRatio="none" aria-hidden="true"><defs><clipPath id="lugar-hecho"><rect data-l="hecho" x="0" y="0" width="0" height="60"/></clipPath></defs>' +
        '<path class="lugar__tira-area" d="' + P.area + '"/><path class="lugar__tira-hecho" clip-path="url(#lugar-hecho)" d="' + P.area + '"/>' +
        '<path class="lugar__tira-linea" d="' + P.linea + '"/></svg><span class="lugar__tira-cursor" data-l="cursor"></span>' +
        '<ol class="lugar__tira-hitos">' + camin.hitos.map(function (h, i) {
          return '<li style="left:' + (h.km / P.kmF * 100).toFixed(2) + '%" class="es-' + h.tipo + '"><button type="button" data-i="' + i + '" title="' + esc(h.nombre) + ' · km ' + coma(h.km) + '"><span class="lugar__sr">Ir al km ' + coma(h.km) + ', </span><span class="lugar__tira-n">' + esc(h.nombre) + '</span></button></li>';
        }).join('') + '</ol>';
      var hecho = $('hecho', caja), cursor = $('cursor', caja), lis = [].slice.call(caja.querySelectorAll('li')), act = -1;
      escucha(caja, 'click', function (e) { var b = e.target.closest('button[data-i]'); if (b) irA(camin.hitos[+b.dataset.i].km); });
      return { mover: function (km, i) {
        var f = lim(km / P.kmF, 0, 1);
        hecho.setAttribute('width', (f * 1000).toFixed(1)); cursor.style.left = (f * 100).toFixed(2) + '%';
        if (i !== act) { act = i; lis.forEach(function (li, k) { li.classList.toggle('es-actual', k === i); li.classList.toggle('es-pasado', k < i); }); }
      } };
    }

    /* ---------- plan B: el perfil de altura real del camino, con sus hitos, y su planta ---------- */
    function svgPerfil(grande) {
      var W = 1000, H = grande ? 400 : 300;
      var IZQ = 46, DER = grande ? 64 : 22;
      var P = perfil(camin, { w: W, h: H, izq: IZQ, der: DER, arriba: grande ? 150 : 40, abajo: 34 });
      var s = '<svg class="lugar__svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Perfil de altura de la carretera de Camín de Muniellos a Tablizas: ' + coma(camin.kmTotal) + ' kilómetros, de ' + camin.casa.cota + ' a ' + camin.destino.cota + ' metros">';
      for (var c = P.c0; c <= P.c1; c += 100) s += '<line class="lugar__eje" x1="' + IZQ + '" x2="' + (W - DER) + '" y1="' + P.Y(c).toFixed(1) + '" y2="' + P.Y(c).toFixed(1) + '"/><text class="lugar__eje-t" x="40" y="' + (P.Y(c) + 4).toFixed(1) + '" text-anchor="end">' + c + ' m</text>';
      for (var k = 0; k <= P.kmF; k += 1) s += '<line class="lugar__marca-km' + (k % 5 ? '' : ' es-cinco') + '" x1="' + P.X(k).toFixed(1) + '" x2="' + P.X(k).toFixed(1) + '" y1="' + (H - 34) + '" y2="' + (H - (k % 5 ? 29 : 24)) + '"/>' + (k % 5 ? '' : '<text class="lugar__eje-t" x="' + P.X(k).toFixed(1) + '" y="' + (H - 9) + '" text-anchor="middle">km ' + k + '</text>');
      s += '<path class="lugar__perfil-area" d="' + P.area + '"/><path class="lugar__perfil-linea" d="' + P.linea + '"/>';
      if (grande) {
        camin.hitos.forEach(function (h, i) {
          var x = P.X(h.km), y = P.Y(h.cota), y1 = 142, fin = h.tipo === 'casa' || h.tipo === 'destino';
          s += '<g class="lugar__mojon es-' + h.tipo + '" data-i="' + i + '"><line x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" y1="' + y.toFixed(1) + '" y2="' + y1 + '"/><circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (fin ? 5 : 3.2) + '"/>' +
            '<text transform="translate(' + (x + 3).toFixed(1) + ' ' + (y1 - 6) + ') rotate(-52)">' + esc(h.nombre) + '<tspan class="lugar__mojon-km" dx="6">' + coma(h.km) + '</tspan></text></g>';
        });
      }
      s += '<g class="lugar__cursor" data-l="cur"><line x1="0" x2="0" y1="' + (grande ? 146 : 36) + '" y2="' + (H - 34) + '"/><circle cx="0" cy="0" r="6"/></g></svg>';
      return { svg: s, P: P, izq: IZQ, der: DER };
    }
    function montarPlano() {
      var g = svgPerfil(true), P = g.P, marco = $('perfilMarco');
      marco.innerHTML = g.svg;
      var cur = $('cur', marco), regla = $('regla'), kmF = P.kmF;
      regla.max = String(Math.round(kmF * 10) / 10);
      var bajo = camin.ruta.reduce(function (a, p) { return p[2] < a[2] ? p : a; });
      var hBajo = camin.hitos.reduce(function (a, h) { return Math.abs(h.km - bajo[3]) < Math.abs(a.km - bajo[3]) ? h : a; });
      $('cifras').innerHTML =
        '<p><b>' + coma(camin.kmTotal) + '</b><span>km por carretera</span></p>' +
        '<p><b>' + camin.minutos + '</b><span>min en coche</span></p>' +
        '<p><b>' + camin.casa.cota + ' → ' + camin.destino.cota + '</b><span>m, de la casa a Tablizas</span></p>' +
        '<p><b>' + Math.round(bajo[2]) + '</b><span>m, lo más bajo: ' + esc(Math.abs(hBajo.km - bajo[3]) < 0.4 ? (hBajo.tipo === 'cruce' && /^Cruce/.test(hBajo.nombre) ? 'el ' + hBajo.nombre.charAt(0).toLowerCase() + hBajo.nombre.slice(1) : hBajo.nombre) : 'km ' + coma(bajo[3])) + '</span></p>';
      $('perfilPie').textContent = 'Perfil real de la carretera (cotas del MDT05 del IGN). Las alturas van exageradas ×' + Math.round(P.exageracion) + ' para que se lean; en el vuelo en 3D el relieve va a escala real.';
      $('lista').innerHTML = camin.hitos.map(function (h, i) {
        return '<li class="es-' + h.tipo + '"><button type="button" data-i="' + i + '"><span class="lugar__lista-km">km ' + coma(h.km) + '</span><b>' + esc(h.nombre) + '</b><span class="lugar__lista-cota">' + h.cota + ' m</span>' +
          (h.detalle ? '<small>' + esc(h.detalle) + '</small>' : (h.tipo === 'casa' ? '<small>Penlés: de aquí sale el camín</small>' : '')) + '</button></li>';
      }).join('');
      // la planta: la carretera desde arriba, norte arriba (misma escala en los dos ejes)
      var R = camin.ruta, kx = Math.cos(camin.casa.lat * RAD), lo0 = Infinity, lo1 = -Infinity, la0 = Infinity, la1 = -Infinity;
      R.forEach(function (p) { lo0 = Math.min(lo0, p[0]); lo1 = Math.max(lo1, p[0]); la0 = Math.min(la0, p[1]); la1 = Math.max(la1, p[1]); });
      var aw = (lo1 - lo0) * kx, ah = la1 - la0, PW = 300, m = 26, sc = (PW - 2 * m) / aw, PH = Math.round(ah * sc + 2 * m);
      var px = function (lon) { return m + (lon - lo0) * kx * sc; }, py = function (lat) { return m + (la1 - lat) * sc; };
      var d = R.map(function (p, i) { return (i ? 'L' : 'M') + px(p[0]).toFixed(1) + ' ' + py(p[1]).toFixed(1); }).join('');
      $('planta').innerHTML = '<svg viewBox="0 0 ' + PW + ' ' + PH + '" role="img" aria-label="Planta de la carretera, de Penlés (arriba a la derecha) a Tablizas (abajo a la izquierda)">' +
        '<path class="lugar__planta-linea" d="' + d + '"/>' +
        camin.hitos.map(function (h) { var fin = h.tipo === 'casa' || h.tipo === 'destino'; return '<circle class="lugar__planta-hito es-' + h.tipo + '" cx="' + px(h.lon).toFixed(1) + '" cy="' + py(h.lat).toFixed(1) + '" r="' + (fin ? 5 : 2.6) + '"/>' + (fin || h.tipo === 'cruce' ? '<text class="lugar__planta-t" x="' + (px(h.lon) + (h.tipo === 'casa' ? -9 : 9)).toFixed(1) + '" y="' + (py(h.lat) + 4).toFixed(1) + '"' + (h.tipo === 'casa' ? ' text-anchor="end"' : '') + '>' + esc(h.nombre) + '</text>' : ''); }).join('') +
        '<circle class="lugar__planta-cursor" data-l="pcur" r="6" cx="0" cy="0"/><text class="lugar__planta-n" x="' + (PW - 14) + '" y="18" text-anchor="middle">N</text><path class="lugar__planta-flecha" d="M' + (PW - 14) + ' 24v14m-4 -9l4 -6l4 6"/></svg>';
      var pcur = $('pcur'), lonDe = lineal(R.map(function (p) { return p[3]; }), R.map(function (p) { return p[0]; })), latDe = lineal(R.map(function (p) { return p[3]; }), R.map(function (p) { return p[1]; }));
      var lis = [].slice.call($('lista').querySelectorAll('li')), mojones = [].slice.call(marco.querySelectorAll('.lugar__mojon')), act = -1;
      function mover(km, desdeRegla) {
        km = lim(km, 0, kmF);
        var c = cotaDe(km), h = hitoEn(camin.hitos, km);
        cur.setAttribute('transform', 'translate(' + P.X(km).toFixed(1) + ' 0)'); cur.querySelector('circle').setAttribute('cy', P.Y(c).toFixed(1));
        pcur.setAttribute('cx', px(lonDe(km)).toFixed(1)); pcur.setAttribute('cy', py(latDe(km)).toFixed(1));
        if (!desdeRegla) regla.value = String(Math.round(km * 10) / 10);
        var cerca = Math.abs(h.actual.km - km) < 0.15;
        var txt = 'km ' + coma(km) + ' · ' + Math.round(c) + ' m · ' + (cerca ? 'en ' + h.actual.nombre : 'pasado ' + h.actual.nombre + (h.siguiente ? ', a ' + coma(h.siguiente.km - km) + ' km de ' + h.siguiente.nombre : ''));
        $('lectura').textContent = txt; regla.setAttribute('aria-valuetext', txt);
        if (h.indice !== act) { act = h.indice; lis.forEach(function (li, k) { li.classList.toggle('es-actual', k === act); }); mojones.forEach(function (g2, k) { g2.classList.toggle('es-actual', k === act); }); }
        estado.km = km; estado.hito = h.actual.nombre;
      }
      escucha(regla, 'input', function () { mover(+regla.value, true); });
      var svg = marco.querySelector('svg');
      var dePuntero = function (e) { var r = svg.getBoundingClientRect(); var x = (e.clientX - r.left) / r.width * 1000; mover((x - g.izq) / (1000 - g.izq - g.der) * kmF); };
      escucha(svg, 'pointermove', function (e) { if (e.pointerType === 'mouse' || e.buttons) dePuntero(e); });
      escucha(svg, 'pointerdown', dePuntero);
      escucha($('lista'), 'click', function (e) { var b = e.target.closest('button[data-i]'); if (b) mover(camin.hitos[+b.dataset.i].km); });
      mover(0);
      return { mover: mover };
    }

    /* ---------- datos ---------- */
    var pDatos = Promise.all([
      fetch(CAMIN).then(function (r) { if (!r.ok) throw new Error('lugar-camin.json ' + r.status); return r.json(); }),
      fetch(ESCENA).then(function (r) { if (!r.ok) throw new Error('lugar-escena.json ' + r.status); return r.json(); }),
    ]).then(function (r) {
      camin = r[0]; meta = r[1];
      if (estado.destruido) return meta;
      var cotaRuta = cotaEn(camin);
      cotaDe = function (km) { return km < 0.02 ? camin.casa.cota : cotaRuta(km); };       // en el km 0 se está en la casa, no en el arranque del camino
      $('kmDe').textContent = 'de ' + coma(camin.kmTotal);
      $('resumen').textContent = 'Vuelo en 3D sobre el relieve real desde Camín de Muniellos, en Penlés, hasta Tablizas, la entrada a la Reserva de Muniellos: ' + coma(camin.kmTotal) + ' kilómetros por la AS-15 y la AS-348, unos ' + camin.minutos + ' minutos en coche. Pasa por ' +
        camin.hitos.slice(1, -1).map(function (h) { return h.nombre + ' (km ' + coma(h.km) + ')'; }).join(', ') + '. El vuelo avanza al bajar por la página; con «Saltar el vuelo» se pasa de largo.';
      planoB = montarPlano(); tira = montarTira();
      $('esperaPerfil').innerHTML = svgPerfil(false).svg;
      ponKm(0); ponCielo();
      return meta;
    });
    pDatos.catch(function (e) { console.warn('Lugar: sin datos', e); });

    /* ---------- el 3D ---------- */
    function cargar3d() {
      if (t3) return Promise.resolve(t3);
      if (cargando) return cargando;
      avisar('Cargando el relieve del valle del Narcea…');
      var hiDef = !movil && !ahorro;
      cargando = pDatos.then(function (m) {
        var R = m.rasters, v = hiDef ? R.valle : R.valle50;
        return Promise.all([
          import(THREE_URL),
          cargarAlturas(BASE + v.archivo + VER), cargarAlturas(BASE + R.casa.archivo + VER), cargarAlturas(BASE + R.tablizas.archivo + VER), cargarAlturas(BASE + R.lejos.archivo + VER),
        ]).then(function (r) {
          if (estado.destruido) return null;
          var RR = {};
          [['valle', v], ['casa', R.casa], ['tablizas', R.tablizas], ['lejos', R.lejos]].forEach(function (x, i) { var b = r[i + 1]; RR[x[0]] = Object.assign({}, x[1], { w: b.w, h: b.h, data: b.data }); });
          return crear3d(r[0], m, RR, hiDef);
        });
      }).then(function (t) { return t; }, function (e) {
        estado.error3d = String((e && e.message) || e);
        console.warn('Lugar: el 3D no está disponible:', e);
        avisar(''); cargando = null; ponModo('plano');
        return null;
      });
      return cargando;
    }

    function crear3d(THREE, m, R, hiDef) {
      var cv = document.createElement('canvas');
      cv.className = 'lugar__lienzo'; cv.setAttribute('aria-hidden', 'true');
      escenario.insertBefore(cv, escenario.firstChild);
      var ren = new THREE.WebGLRenderer({ canvas: cv, antialias: hiDef, powerPreference: 'high-performance', alpha: false, stencil: false });
      var topeDPR = function () { return estado.calidad >= 1 ? 1 : (movil ? 1.25 : 1.5); };
      ren.setPixelRatio(Math.min(devicePixelRatio || 1, topeDPR()));
      ren.outputColorSpace = THREE.SRGBColorSpace;
      ren.shadowMap.enabled = true; ren.shadowMap.type = THREE.PCFSoftShadowMap; ren.shadowMap.autoUpdate = false;
      var anis = Math.min(8, ren.capabilities.getMaxAnisotropy());
      var esc3 = new THREE.Scene();
      var cam = new THREE.PerspectiveCamera(46, 1.6, 1, 220000);
      var disponer = [];
      var guarda = function (o) { disponer.push(o); return o; };
      var i, j;
      var CAS = m.casa, DES = m.destino, CJ = m.caja, Y0 = CAS.sueloDelante;
      var estilo = getComputedStyle(el);
      var colorDe = function (v, def) { var c = (estilo.getPropertyValue(v) || '').trim(); return /^#[0-9a-f]{6}$/i.test(c) ? c : def; };
      var COL_TRAZO = colorDe('--lugar-trazo', colorDe('--marca', '#e08a2e'));

      /* --- alturas combinadas: valle (25 m; 50 en el móvil), casa (4 m), Tablizas (5 m) y lejos (400 m). A escala real. --- */
      var hV = muestreador(R.valle), hC = muestreador(R.casa), hT = muestreador(R.tablizas), hL = muestreador(R.lejos);
      function altura(x, z) {
        if (x <= CJ.x0 || x >= CJ.x1 || z <= CJ.z0 || z >= CJ.z1) return hL(x, z);
        var h = hV(x, z), w = pesoCaja(R.casa, x, z, 60);
        if (w > 0) return lerp(h, hC(x, z), w);
        w = pesoCaja(R.tablizas, x, z, 60);
        return w > 0 ? lerp(h, hT(x, z), w) : h;
      }
      var hMax = 0; for (i = 0; i < R.valle.data.length; i += 7) if (R.valle.data[i] > hMax) hMax = R.valle.data[i];
      hMax += 30;

      /* --- la sombra del relieve: una textura que se rehace en el navegador (por tandas) solo cuando el sol cambia --- */
      var SW = hiDef ? 360 : 180, SH = hiDef ? 420 : 210;
      var sDatos = new Uint8Array(SW * SH * 4).fill(255), sTrabajo = new Uint8Array(SW * SH * 4);
      var sTex = guarda(new THREE.DataTexture(sDatos, SW, SH, THREE.RGBAFormat, THREE.UnsignedByteType));
      sTex.minFilter = sTex.magFilter = THREE.LinearFilter; sTex.generateMipmaps = false; sTex.flipY = false; sTex.needsUpdate = true;
      var uSom = { sRelieve: { value: sTex }, scRelieve: { value: new THREE.Vector4(CJ.x0, CJ.z0, CJ.x1, CJ.z1) } };
      var sombra = { tarea: 0, fila: 0, az: 0, alt: 0, lista: false, veces: 0, pend: null };
      function pasoSombra() {
        sombra.tarea = 0;
        if (estado.destruido) return;
        var t0 = performance.now();
        while (sombra.fila < SH && performance.now() - t0 < 9) {
          var j1 = Math.min(SH, sombra.fila + 6);
          sombraRelieve(altura, CJ, SW, SH, sombra.az, sombra.alt, sTrabajo, sombra.fila, j1, hMax);
          sombra.fila = j1;
        }
        if (sombra.fila < SH) { sombra.tarea = setTimeout(pasoSombra, 0); return; }
        sDatos.set(sTrabajo); sTex.needsUpdate = true; sombra.lista = true; sombra.veces++;
        if (sombra.pend) { var n = sombra.pend; sombra.pend = null; pideSombra(n[0], n[1]); }
        pedir(true);
      }
      function pideSombra(az, alt) {
        if (sombra.tarea) { sombra.pend = [az, alt]; return; }
        sombra.az = az; sombra.alt = alt; sombra.fila = 0;
        sombra.tarea = setTimeout(pasoSombra, 0);
      }
      // Lambert + la sombra del relieve en la luz direccional (sol o luna); el suelo, además, funde la ortofoto de detalle
      function parchea(mat, cerca) {
        var u = cerca ? { mapCerca: { value: null }, cerCaja: { value: new THREE.Vector4(0, 0, 1, 1) }, cercaListo: { value: 0 } } : null;
        mat.userData.u = u;
        mat.onBeforeCompile = function (sh) {
          Object.assign(sh.uniforms, uSom); if (u) Object.assign(sh.uniforms, u);
          sh.vertexShader = 'varying vec3 vMundo;\n' + sh.vertexShader.replace('#include <begin_vertex>', [
            '#include <begin_vertex>',
            'vec4 mw_ = vec4( transformed, 1.0 );',
            '#ifdef USE_INSTANCING', 'mw_ = instanceMatrix * mw_;', '#endif',
            'vMundo = ( modelMatrix * mw_ ).xyz;'].join('\n'));
          var luces = THREE.ShaderChunk.lights_fragment_begin.replace('getDirectionalLightInfo( directionalLight, directLight );',
            'getDirectionalLightInfo( directionalLight, directLight ); directLight.color *= factorRelieve;');
          var fs = sh.fragmentShader.replace('#include <lights_fragment_begin>',
            'vec2 uvRelieve = clamp( ( vMundo.xz - scRelieve.xy ) / ( scRelieve.zw - scRelieve.xy ), 0.0, 1.0 );\nfloat factorRelieve = texture2D( sRelieve, uvRelieve ).r;\n' + luces);
          if (u) fs = fs.replace('#include <map_fragment>', [
            '#ifdef USE_MAP',
            '  vec4 texelSuelo = texture2D( map, vMapUv );',
            '  vec2 cu = ( vMundo.xz - cerCaja.xy ) / ( cerCaja.zw - cerCaja.xy );',
            '  float wCerca = cercaListo * smoothstep( 0.0, 0.12, min( min( cu.x, 1.0 - cu.x ), min( cu.y, 1.0 - cu.y ) ) );',
            '  vec4 texelCerca = texture2D( mapCerca, clamp( vec2( cu.x, 1.0 - cu.y ), 0.0, 1.0 ) );',
            '  texelSuelo = mix( texelSuelo, texelCerca, wCerca );',
            // la ortofoto trae las sombras del día del vuelo: se aclaran un poco los oscuros (las de ahora las pone el relieve)
            '  texelSuelo.rgb = pow( texelSuelo.rgb, vec3( 0.88 ) );',
            '  diffuseColor *= texelSuelo;',
            '#endif'].join('\n'));
          sh.fragmentShader = 'varying vec3 vMundo;\nuniform sampler2D sRelieve;\nuniform vec4 scRelieve;\n' + (u ? 'uniform sampler2D mapCerca;\nuniform vec4 cerCaja;\nuniform float cercaListo;\n' : '') + fs;
          mat.userData.sh = sh;
        };
        mat.customProgramCacheKey = function () { return cerca ? 'camin-suelo' : 'camin-relieve'; };
        return mat;
      }

      /* --- texturas del suelo: la base (toda la caja) y, según se acerca la cámara, la de cada bloque del corredor --- */
      var ldr = new THREE.TextureLoader(), pendientes = 0, tListo = performance.now() + 8000;
      var cargaTex = function (url, alListo) {
        pendientes++;
        return ldr.load(url, function (t) { if (estado.destruido) { t.dispose(); return; } t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = anis; guarda(t); if (alListo) alListo(t); pendientes--; pedir(true); },
          undefined, function () { pendientes--; console.warn('Lugar: no carga', url); pedir(true); });
      };
      var O = m.orto, cal = hiDef ? 'alta' : 'baja';
      var NBX = 6, NBZ = 7, BW = (CJ.x1 - CJ.x0) / NBX, BH = (CJ.z1 - CJ.z0) / NBZ;
      var cajaV4 = function (o) { return new THREE.Vector4(o.x0, o.z0, o.x1, o.z1); };
      var texBase = null;
      var bloques = O.bloques.map(function (b) {
        var mat = parchea(guarda(new THREE.MeshLambertMaterial({ color: '#5f6a55' })), true);
        return { b: b, mat: mat, cx: (b.x0 + b.x1) / 2, cz: (b.z0 + b.z1) / 2, pedido: false, pos: [], uv: [], nor: [], idx: [], n: 0 };
      });
      cargaTex(BASE + O.base.archivo + VER, function (t) { texBase = t; bloques.forEach(function (B) { if (!B.mat.map) { B.mat.map = t; B.mat.color.set('#ffffff'); B.mat.needsUpdate = true; } }); matPar.forEach(function (mp) { if (!mp.map) { mp.map = t; mp.color.set('#ffffff'); mp.needsUpdate = true; } }); });
      var enCola = 0, nBloques = 0;
      function pideBloques(x, z) {              // los bloques a menos de 7 km de la cámara que aún no tienen su ortofoto
        if (enCola >= 2) return;
        var mejor = null, dm = 7000;
        bloques.forEach(function (B) { if (B.b.archivos && !B.pedido) { var d = Math.hypot(B.cx - x, B.cz - z); if (d < dm) { dm = d; mejor = B; } } });
        if (!mejor) return;
        mejor.pedido = true; enCola++;
        var fin = function () { enCola--; };
        pendientes++;
        ldr.load(BASE + mejor.b.archivos[cal] + VER, function (t) {
          pendientes--; fin(); if (estado.destruido) { t.dispose(); return; }
          t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = anis; guarda(t);
          // las UV del suelo van en coordenadas de toda la caja: la textura del bloque se coloca con repeat/offset
          t.repeat.set(NBX, NBZ); t.offset.set(-mejor.b.i, mejor.b.j + 1 - NBZ);
          mejor.mat.map = t; mejor.mat.color.set('#ffffff'); nBloques++; pedir(true);
        }, undefined, function () { pendientes--; fin(); pedir(true); });
      }
      // las dos ortofotos de detalle (la casa y Tablizas): se funden en el sombreado del suelo
      var cercas = [{ o: O.casa, cx: 0, cz: 0, tex: null, pedido: false }, { o: O.tablizas, cx: DES.x, cz: DES.z, tex: null, pedido: false }];
      function ponCerca(mat, x0, z0, x1, z1) {   // el material de un trozo de suelo usa la ortofoto de detalle que le toque
        cercas.forEach(function (c) { if (x1 > c.o.x0 && x0 < c.o.x1 && z1 > c.o.z0 && z0 < c.o.z1) { mat.userData.cerca = c; mat.userData.u.cerCaja.value.copy(cajaV4(c.o)); if (c.tex) { mat.userData.u.mapCerca.value = c.tex; mat.userData.u.cercaListo.value = 1; } } });
      }
      function pideCerca(c) {
        if (c.pedido) return; c.pedido = true;
        cargaTex(BASE + c.o.archivos[cal] + VER, function (t) { c.tex = t; bloques.map(function (B) { return B.mat; }).concat(matPar).forEach(function (mt) { if (mt.userData.cerca === c) { mt.userData.u.mapCerca.value = t; mt.userData.u.cercaListo.value = 1; } }); });
      }

      /* --- el relieve: teselas de 500 m, más finas junto a la carretera; dos parches finos (la casa y Tablizas) --- */
      var TES = 500, NTX = Math.round((CJ.x1 - CJ.x0) / TES), NTZ = Math.round((CJ.z1 - CJ.z0) / TES);
      var cinta = m.cinta, pasoTes = new Float32Array(NTX * NTZ);
      var PASOS = hiDef ? [[620, 20], [2000, 50], [5200, 100]] : [[700, 50], [2600, 100]], P_PARCHE = hiDef ? 2.5 : 5;
      var snap = function (v, o) { return o + Math.round((v - o) / 100) * 100; };
      var HUECOS = [[-100, -100, 100, 100], [snap(DES.x - 100, CJ.x0), snap(DES.z - 100, CJ.z0), 0, 0]];
      HUECOS[1][2] = HUECOS[1][0] + 200; HUECOS[1][3] = HUECOS[1][1] + 200;
      var enHueco = function (x, z, s) { for (var k = 0; k < 2; k++) { var hh = HUECOS[k]; if (x >= hh[0] - 0.01 && x + s <= hh[2] + 0.01 && z >= hh[1] - 0.01 && z + s <= hh[3] + 0.01) return k + 1; } return 0; };
      var normalEn = function (x, z, d, out, o) {
        var nx = (altura(x - d, z) - altura(x + d, z)) / (2 * d), nz = (altura(x, z - d) - altura(x, z + d)) / (2 * d), l = 1 / Math.sqrt(nx * nx + nz * nz + 1);
        out[o] = nx * l; out[o + 1] = l; out[o + 2] = nz * l;
      };
      // una rejilla regular (n × n celdas de paso s) con faldón; la mete en el lote B (pos, uv, nor, idx)
      function rejilla(B, x0, z0, n, s, saltar, faldon, uvFn) {
        var base = B.n, nv = n + 1, ii, jj, nor = [0, 0, 0];
        for (jj = 0; jj <= n; jj++) for (ii = 0; ii <= n; ii++) {
          var x = x0 + ii * s, z = z0 + jj * s;
          B.pos.push(x, altura(x, z), z); uvFn(B.uv, x, z);
          normalEn(x, z, Math.max(s, 10), nor, 0); B.nor.push(nor[0], nor[1], nor[2]);
        }
        B.n += nv * nv;
        for (jj = 0; jj < n; jj++) for (ii = 0; ii < n; ii++) {
          if (saltar && saltar(x0 + ii * s, z0 + jj * s, s)) continue;
          var a = base + jj * nv + ii, b = a + 1, c = a + nv, d = c + 1;
          B.idx.push(a, c, b, b, c, d);
        }
        // el borde baja como una pared: tapa las rendijas entre teselas de distinto paso
        var borde = [];
        for (ii = 0; ii <= n; ii++) borde.push(ii);
        for (jj = 1; jj <= n; jj++) borde.push(jj * nv + n);
        for (ii = n - 1; ii >= 0; ii--) borde.push(n * nv + ii);
        for (jj = n - 1; jj > 0; jj--) borde.push(jj * nv);
        var f0 = B.n;
        borde.forEach(function (v) {
          var k = (base + v) * 3, ku = (base + v) * 2;
          B.pos.push(B.pos[k], B.pos[k + 1] - faldon, B.pos[k + 2]); B.uv.push(B.uv[ku], B.uv[ku + 1]); B.nor.push(B.nor[k], B.nor[k + 1], B.nor[k + 2]);
        });
        B.n += borde.length;
        for (var q2 = 0; q2 < borde.length; q2++) {
          var v0 = base + borde[q2], v1 = base + borde[(q2 + 1) % borde.length], w0 = f0 + q2, w1 = f0 + (q2 + 1) % borde.length;
          B.idx.push(v0, w0, v1, v1, w0, w1, v0, v1, w0, v1, w1, w0);
        }
      }
      var uvCaja = function (uv, x, z) { uv.push((x - CJ.x0) / (CJ.x1 - CJ.x0), 1 - (z - CJ.z0) / (CJ.z1 - CJ.z0)); };
      function geoDe(B) {
        var g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(B.pos), 3));
        g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(B.nor), 3));
        g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(B.uv), 2));
        g.setIndex(B.n > 65535 ? new THREE.Uint32BufferAttribute(B.idx, 1) : new THREE.Uint16BufferAttribute(B.idx, 1));
        g.computeBoundingSphere();
        B.pos = B.uv = B.nor = B.idx = null;
        return guarda(g);
      }
      for (j = 0; j < NTZ; j++) for (i = 0; i < NTX; i++) {
        var tx0 = CJ.x0 + i * TES, tz0 = CJ.z0 + j * TES, tcx = tx0 + TES / 2, tcz = tz0 + TES / 2, dmin = 1e9;
        for (var c4 = 0; c4 < cinta.length; c4 += 4) { var dd = Math.hypot(cinta[c4][0] - tcx, cinta[c4][1] - tcz); if (dd < dmin) dmin = dd; }
        var s = 250; for (var pp = 0; pp < PASOS.length; pp++) if (dmin < PASOS[pp][0]) { s = PASOS[pp][1]; break; }
        pasoTes[j * NTX + i] = s;
        var B = bloques[Math.min(NBZ - 1, Math.floor((tcz - CJ.z0) / BH)) * NBX + Math.min(NBX - 1, Math.floor((tcx - CJ.x0) / BW))];
        rejilla(B, tx0, tz0, TES / s, s, enHueco, Math.max(12, s * 0.45), uvCaja);
      }
      var suelo = new THREE.Group(); esc3.add(suelo);
      bloques.forEach(function (B) {
        ponCerca(B.mat, B.b.x0, B.b.z0, B.b.x1, B.b.z1);
        var me = new THREE.Mesh(geoDe(B), B.mat); me.name = 'bloque ' + B.b.i + B.b.j; suelo.add(me);
      });
      var matPar = [], parches = HUECOS.map(function (hh, k) {
        var mat = parchea(guarda(new THREE.MeshLambertMaterial({ color: '#5f6a55' })), true), B = { pos: [], uv: [], nor: [], idx: [], n: 0 };
        matPar.push(mat); ponCerca(mat, hh[0], hh[1], hh[2], hh[3]);
        rejilla(B, hh[0], hh[1], Math.round(200 / P_PARCHE), P_PARCHE, null, 8, uvCaja);
        var me = new THREE.Mesh(geoDe(B), mat); me.name = 'parche ' + k; me.receiveShadow = k === 0; suelo.add(me);
        return me;
      });
      // la altura de la MALLA en un punto (no la del MDT): la cinta de la carretera se apoya en los triángulos que se pintan
      function alturaMalla(x, z) {
        if (x <= CJ.x0 || x >= CJ.x1 || z <= CJ.z0 || z >= CJ.z1) return altura(x, z);
        var s = enHueco(x, z, 0) ? P_PARCHE : pasoTes[Math.min(NTZ - 1, Math.floor((z - CJ.z0) / TES)) * NTX + Math.min(NTX - 1, Math.floor((x - CJ.x0) / TES))];
        var gx = Math.floor((x - CJ.x0) / s), gz = Math.floor((z - CJ.z0) / s), xa = CJ.x0 + gx * s, za = CJ.z0 + gz * s, fx = (x - xa) / s, fz = (z - za) / s;
        var hb = altura(xa + s, za), hc = altura(xa, za + s);
        if (fx + fz <= 1) { var ha = altura(xa, za); return ha + (hb - ha) * fx + (hc - ha) * fz; }
        var hd = altura(xa + s, za + s); return hd + (hc - hd) * (1 - fx) + (hb - hd) * (1 - fz);
      }
      // el anillo lejano (MDT25 a 400 m): las sierras del fondo
      var matLejos = parchea(guarda(new THREE.MeshLambertMaterial({ color: '#5c6658', polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 2 })), false);
      cargaTex(BASE + O.lejos.archivo + VER, function (t) { matLejos.map = t; matLejos.color.set('#ffffff'); matLejos.needsUpdate = true; });
      (function () {
        var L = R.lejos, B = { pos: [], uv: [], nor: [], idx: [], n: 0 }, nor = [0, 0, 0], sx = (L.x1 - L.x0) / (L.w - 1), sz = (L.z1 - L.z0) / (L.h - 1), ii, jj;
        for (jj = 0; jj < L.h; jj++) for (ii = 0; ii < L.w; ii++) {
          var x = L.x0 + ii * sx, z = L.z0 + jj * sz;
          B.pos.push(x, L.data[jj * L.w + ii], z); B.uv.push(ii / (L.w - 1), 1 - jj / (L.h - 1));
          var nx = (hL(x - sx, z) - hL(x + sx, z)) / (2 * sx), nz = (hL(x, z - sz) - hL(x, z + sz)) / (2 * sz), l = 1 / Math.sqrt(nx * nx + nz * nz + 1);
          B.nor.push(nx * l, l, nz * l);
        }
        B.n = L.w * L.h;
        var hu = L.hueco;
        for (jj = 0; jj < L.h - 1; jj++) for (ii = 0; ii < L.w - 1; ii++) {
          if (ii >= hu[0] && ii < hu[2] && jj >= hu[1] && jj < hu[3]) continue;
          var a = jj * L.w + ii, b = a + 1, c = a + L.w, d = c + 1;
          B.idx.push(a, c, b, b, c, d);
        }
        var me = new THREE.Mesh(geoDe(B), matLejos); me.name = 'lejos'; esc3.add(me);
      })();

      /* --- cielo: cúpula con el degradado en los vértices (sin shader propio), sol y luna dibujados, estrellas --- */
      var geoCielo = guarda(new THREE.SphereGeometry(180000, 48, 24)), nC = geoCielo.attributes.position.count;
      geoCielo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(nC * 3), 3));
      var cielo = new THREE.Mesh(geoCielo, guarda(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false })));
      cielo.renderOrder = -10; cielo.frustumCulled = false; esc3.add(cielo);
      var cZ = new THREE.Color(), cH = new THREE.Color(), cL = new THREE.Color('#ffb27a');
      function pintarCielo(c, dir, brillo) {
        cZ.set(c.cz); cH.set(c.ch);
        var P = geoCielo.attributes.position.array, Cc = geoCielo.attributes.color.array;
        for (var k = 0; k < nC; k++) {
          var x = P[k * 3] / 180000, y = P[k * 3 + 1] / 180000, z = P[k * 3 + 2] / 180000;
          var t = y < -0.02 ? 0 : suave(-0.02, 0.5, y), sd = Math.max(0, x * dir.x + y * dir.y + z * dir.z), vel = 1 - suave(0, 0.5, Math.abs(y));
          var g = brillo * (Math.pow(sd, 5) * 0.45 + Math.pow(sd, 40) * 0.4) * vel;
          Cc[k * 3] = lerp(cH.r, cZ.r, t) + cL.r * g; Cc[k * 3 + 1] = lerp(cH.g, cZ.g, t) + cL.g * g; Cc[k * 3 + 2] = lerp(cH.b, cZ.b, t) + cL.b * g;
        }
        geoCielo.attributes.color.needsUpdate = true;
      }
      esc3.fog = new THREE.FogExp2('#d9e2e9', 1 / 26000);
      var rnd = azar(23), nE = hiDef ? 1000 : 500, ePos = new Float32Array(nE * 3);
      for (i = 0; i < nE; i++) {
        var a0 = rnd() * Math.PI * 2, hh0 = Math.asin(0.02 + rnd() * 0.97);
        ePos[i * 3] = Math.cos(hh0) * Math.sin(a0) * 150000; ePos[i * 3 + 1] = Math.sin(hh0) * 150000; ePos[i * 3 + 2] = -Math.cos(hh0) * Math.cos(a0) * 150000;
      }
      var eGeo = guarda(new THREE.BufferGeometry()); eGeo.setAttribute('position', new THREE.BufferAttribute(ePos, 3));
      var estrellas = new THREE.Points(eGeo, guarda(new THREE.PointsMaterial({ color: '#f3eee4', size: movil ? 1.4 : 1.7, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false })));
      estrellas.frustumCulled = false; estrellas.visible = false; esc3.add(estrellas);
      var texDe = function (lado, f) { var c = lienzo(lado, f), t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return guarda(t); };
      var solS = new THREE.Sprite(guarda(new THREE.SpriteMaterial({ map: texDe(128, function (g, l) { var r = g.createRadialGradient(l / 2, l / 2, 0, l / 2, l / 2, l / 2); r.addColorStop(0, 'rgba(255,248,226,1)'); r.addColorStop(0.13, 'rgba(255,236,190,1)'); r.addColorStop(0.3, 'rgba(255,205,150,.35)'); r.addColorStop(1, 'rgba(255,205,150,0)'); g.fillStyle = r; g.fillRect(0, 0, l, l); }), fog: false, depthWrite: false, transparent: true, toneMapped: false })));
      solS.scale.set(13000, 13000, 1); esc3.add(solS);
      var lunaCv = document.createElement('canvas'); lunaCv.width = lunaCv.height = 128;
      var lunaTex = guarda(new THREE.CanvasTexture(lunaCv)); lunaTex.colorSpace = THREE.SRGBColorSpace;
      var lunaS = new THREE.Sprite(guarda(new THREE.SpriteMaterial({ map: lunaTex, fog: false, depthWrite: false, transparent: true, toneMapped: false })));
      lunaS.scale.set(5000, 5000, 1); lunaS.visible = false; esc3.add(lunaS);
      var faseLuna = -1;
      function pintarLuna(fase) {
        var g = lunaCv.getContext('2d'), Ld = 128, r = Ld * 0.36, c = Ld / 2;
        g.clearRect(0, 0, Ld, Ld); g.save(); g.translate(c, c);
        g.fillStyle = 'rgba(40,50,70,.5)'; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
        var crec = fase < 0.5, p = crec ? fase : 1 - fase; if (!crec) g.scale(-1, 1);
        var kk = Math.cos(2 * Math.PI * p);
        g.shadowColor = 'rgba(242,236,227,.55)'; g.shadowBlur = Ld * 0.1; g.fillStyle = '#f1ebdc';
        g.beginPath(); g.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
        g.ellipse(0, 0, Math.max(0.01, Math.abs(kk)) * r, r, 0, Math.PI / 2, kk >= 0 ? -Math.PI / 2 : 3 * Math.PI / 2, kk >= 0);
        g.fill(); g.restore(); lunaTex.needsUpdate = true;
      }

      /* --- luces --- */
      var CASA3 = new THREE.Vector3(CAS.x, Y0 + 3, CAS.z);
      var luzSol = new THREE.DirectionalLight('#ffffff', 2.6);
      luzSol.castShadow = true;
      var SM = hiDef ? 2048 : 1024;
      luzSol.shadow.mapSize.set(SM, SM);
      Object.assign(luzSol.shadow.camera, { left: -48, right: 48, top: 48, bottom: -48, near: 1, far: 900 });
      luzSol.shadow.camera.updateProjectionMatrix();
      luzSol.shadow.bias = -0.0005; luzSol.shadow.normalBias = 0.05;
      luzSol.target.position.copy(CASA3);
      var luzLuna = new THREE.DirectionalLight('#a8bce0', 0);
      luzLuna.target.position.copy(CASA3);
      var hemi = new THREE.HemisphereLight('#dfe8f0', '#5d5444', 1.6);
      esc3.add(luzSol, luzSol.target, luzLuna, luzLuna.target, hemi);

      /* --- materiales y piezas de los edificios --- */
      var texRep = function (c) { var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = anis; return guarda(t); };
      var lam = function (o) { return parchea(guarda(new THREE.MeshLambertMaterial(o)), false); };
      var MAT = {
        piedra: lam({ map: texRep(texPiedra(7)) }), crema: lam({ map: texRep(texRevoco('#efe6cf', 11)) }), madera: lam({ map: texRep(texMadera('#8a5a34', 9)) }),
        oscura: lam({ map: texRep(texMadera('#4a3424', 5)) }), pizarra: lam({ map: texRep(texPizarra(3)), side: THREE.DoubleSide }), granito: lam({ color: '#cfcbc2' }),
        cristal: lam({ color: '#2a3038' }), visillo: lam({ color: '#d9d2c2' }), barro: lam({ color: '#b5653a' }), flor: lam({ color: '#c9242b' }), hoja: lam({ color: '#4f7a3a' }),
        claro: lam({ map: texRep(texRevoco('#d9d3c8', 13)) }), tejado: lam({ map: texRep(texTejado(4)), vertexColors: true, side: THREE.DoubleSide }),
      };
      function cajaGeo(w, h, d, tesela) {           // caja con la textura a escala real (tesela de 2,4 m), por cara
        var g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, T = tesela || 2.4;
        var dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
        for (var f = 0; f < 6; f++) for (var v = 0; v < 4; v++) { var ix = f * 4 + v; uv.setXY(ix, uv.getX(ix) * dims[f][0] / T, uv.getY(ix) * dims[f][1] / T); }
        return g;
      }
      // faldones a dos aguas sobre un rectángulo (cumbrera a lo largo de x): pasa por el borde del muro (y = 0 en
      // z = ±lv/2) y vuela `vuelo` por los aleros y `vueloH` por los hastiales
      function tejadoGeo(lu, lv, pend, vuelo, vueloH) {
        var hu = lu / 2 + vueloH, hv = lv / 2 + vuelo, pos = [], uv = [], T = 2.0, alto = lv / 2 * pend, ye = -vuelo * pend;
        var Pp = [[-hu, ye, -hv], [hu, ye, -hv], [hu, alto, 0], [-hu, alto, 0], [-hu, ye, hv], [hu, ye, hv]];
        [[0, 1, 2, 0, 2, 3], [4, 3, 2, 4, 2, 5]].forEach(function (ids) {
          ids.forEach(function (id) { var p = Pp[id]; pos.push(p[0], p[1], p[2]); uv.push((p[0] + hu) / T, Math.hypot(p[2], p[1] - alto) / T); });
        });
        var g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        g.computeVertexNormals();
        return g;
      }
      function hastialGeo(lv, alto) {              // el triángulo de un hastial (en el plano x = 0, mirando a +x)
        var g = new THREE.BufferGeometry(), hv = lv / 2;
        g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, hv, 0, 0, -hv, 0, alto, 0], 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute([hv / 2.4, 0, -hv / 2.4, 0, 0, alto / 2.4], 2));
        g.computeVertexNormals();
        return g;
      }
      function muroGeo(anillo, y0, y1) {           // muros sobre una planta (anillo de [x, z]); las caras miran hacia fuera
        var pos = [], uv = [], u = 0, n = anillo.length, ar = 0, k;
        for (k = 0; k < n; k++) { var p0 = anillo[k], p1 = anillo[(k + 1) % n]; ar += p0[0] * p1[1] - p1[0] * p0[1]; }
        var sg = ar > 0 ? 1 : -1;
        for (k = 0; k < n; k++) {
          var a = anillo[k], b = anillo[(k + 1) % n], lg = Math.hypot(b[0] - a[0], b[1] - a[1]);
          var qd = [[a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]]];
          var o = sg > 0 ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3], uvs = [[u, y0], [u + lg, y0], [u + lg, y1], [u, y1]];
          o.forEach(function (id) { pos.push(qd[id][0], qd[id][1], qd[id][2]); uv.push(uvs[id][0] / 2.4, uvs[id][1] / 2.4); });
          u += lg;
        }
        var g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        g.computeVertexNormals();
        return g;
      }
      // lotes: las piezas de un mismo material se unen en una sola malla (pocas llamadas de dibujo)
      var mPieza = new THREE.Matrix4(), qPieza = new THREE.Quaternion(), ePieza = new THREE.Euler(), vPieza = new THREE.Vector3(), uno = new THREE.Vector3(1, 1, 1);
      function coloca(g, x, y, z, ry) { ePieza.set(0, ry || 0, 0); qPieza.setFromEuler(ePieza); mPieza.compose(vPieza.set(x, y, z), qPieza, uno); g.applyMatrix4(mPieza); return g; }
      function junta(lista, conColor) {
        var n = 0; lista.forEach(function (x) { n += x.g.attributes.position.count; });
        var Pp = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2), Cc = conColor ? new Float32Array(n * 3) : null, o = 0;
        lista.forEach(function (x) {
          var g = x.g, c = g.attributes.position.count;
          Pp.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); U.set(g.attributes.uv.array, o * 2);
          if (Cc) for (var k = 0; k < c; k++) { Cc[(o + k) * 3] = x.c.r; Cc[(o + k) * 3 + 1] = x.c.g; Cc[(o + k) * 3 + 2] = x.c.b; }
          o += c; g.dispose();
        });
        var r = new THREE.BufferGeometry();
        r.setAttribute('position', new THREE.BufferAttribute(Pp, 3)); r.setAttribute('normal', new THREE.BufferAttribute(N, 3)); r.setAttribute('uv', new THREE.BufferAttribute(U, 2));
        if (Cc) r.setAttribute('color', new THREE.BufferAttribute(Cc, 3));
        r.computeBoundingSphere();
        return guarda(r);
      }
      function Lote() { this.l = {}; this.n = 0; }
      Lote.prototype.pon = function (mat, g, x, y, z, ry, color) { if (g.index) { var g2 = g.toNonIndexed(); g.dispose(); g = g2; } coloca(g, x, y, z, ry); (this.l[mat] = this.l[mat] || []).push({ g: g, c: color }); this.n++; return this; };
      Lote.prototype.caja = function (mat, w, h, d, x, y, z, ry) { return this.pon(mat, cajaGeo(w, h, d), x, y, z, ry); };
      Lote.prototype.mallas = function (grupo, sombra) {
        var l = this.l;
        Object.keys(l).forEach(function (k) { var me = new THREE.Mesh(junta(l[k], k === 'tejado'), MAT[k]); me.name = k; me.castShadow = !!sombra; me.receiveShadow = !!sombra; grupo.add(me); });
      };

      /* --- la casa (Catastro U20301500PH98B). Marco propio: x a lo largo de la fachada (hacia el suroeste), z hacia la
             ladera (noroeste), y desde la era. La fachada del corredor mira a −z. Largo, fondos, corredor, buhardillas y
             terraza salen de la planta del Catastro; las alturas y los huecos, a ojo de sus fotos (LUGAR.md). --- */
      var casa = new THREE.Group(); casa.position.set(CAS.x, Y0, CAS.z); casa.rotation.y = -CAS.ang; esc3.add(casa);
      var LC = new Lote(), balaustres = [];
      var Lg = CAS.largo, hx = Lg / 2, CO = CAS.corredor, F = CAS.fondo, P1 = 2.95, P2 = 5.65, PEND = 0.5;
      var luzT = F + CO, zR = (F - CO) / 2, cumbre = P2 + luzT / 2 * PEND;
      (function () {
        var k, x;
        // planta baja de mampostería (baja 3 m bajo la era: la ladera la tapa por detrás) y planta primera en crema
        LC.caja('piedra', Lg, P1 + 3, F, 0, (P1 - 3) / 2, F / 2);
        LC.caja('crema', Lg - 0.04, P2 - P1, F - 0.04, 0, (P1 + P2) / 2, F / 2);
        [-1, 1].forEach(function (sg) { LC.pon('crema', hastialGeo(luzT, cumbre - P2), sg * (hx - 0.02), P2, zR, sg > 0 ? 0 : Math.PI); });
        // tejado de pizarra a dos aguas: cubre también el corredor
        LC.pon('pizarra', tejadoGeo(Lg, luzT, PEND, 0.6, 0.45), 0, P2 + 0.06, zR);
        LC.caja('oscura', Lg + 0.9, 0.14, 0.16, 0, P2 - 0.24, -CO - 0.52); LC.caja('oscura', Lg + 0.9, 0.14, 0.16, 0, P2 - 0.24, F + 0.52);
        for (x = -hx + 0.3; x <= hx - 0.2; x += 0.86) LC.caja('madera', 0.1, 0.14, CO + 0.7, x, P2 - 0.12, -CO / 2 - 0.2);      // cabios del alero, vistos desde abajo
        // el corredor: suelo de madera en voladizo, canes, pies derechos, barandilla de balaustres torneados
        LC.caja('madera', Lg, 0.2, CO + 0.1, 0, P1 - 0.1, -CO / 2);
        for (x = -hx + 0.25; x <= hx - 0.2; x += 0.9) LC.caja('oscura', 0.14, 0.2, CO + 0.3, x, P1 - 0.3, -CO / 2 + 0.05);
        LC.caja('oscura', Lg + 0.1, 0.24, 0.16, 0, P1 - 0.12, -CO - 0.02);
        for (k = 0; k < 6; k++) LC.caja('madera', 0.17, P2 - P1 - 0.1, 0.17, -hx + 0.12 + k * (Lg - 0.24) / 5, (P1 + P2) / 2 - 0.05, -CO + 0.1);
        LC.caja('madera', Lg, 0.08, 0.1, 0, P1 + 0.97, -CO + 0.08); LC.caja('madera', Lg, 0.06, 0.08, 0, P1 + 0.1, -CO + 0.08);
        for (x = -hx + 0.2; x <= hx - 0.15; x += 0.135) balaustres.push([x, P1 + 0.1, -CO + 0.08]);
        [-1, 1].forEach(function (sg) {             // los dos testeros del corredor
          LC.caja('madera', 0.1, 0.08, CO - 0.1, sg * (hx - 0.06), P1 + 0.97, -CO / 2);
          for (var z = -CO + 0.25; z < -0.1; z += 0.135) balaustres.push([sg * (hx - 0.06), P1 + 0.1, z]);
        });
        // huecos de la planta primera (bajo el corredor): puertaventanas con visillo y dos puertas de celosía de madera
        [[6.3, 'celosia'], [4.6, 'vidrio'], [2.9, 'vidrio'], [0.4, 'celosia'], [-1.9, 'vidrio'], [-3.6, 'vidrio'], [-6.0, 'vidrio']].forEach(function (h) {
          LC.caja('oscura', 1.16, 2.16, 0.1, h[0], P1 + 1.1, -0.03);
          LC.caja(h[1] === 'celosia' ? 'madera' : 'visillo', 0.96, 1.96, 0.1, h[0], P1 + 1.05, -0.06);
          if (h[1] === 'vidrio') { LC.caja('oscura', 0.05, 1.96, 0.1, h[0], P1 + 1.05, -0.09); LC.caja('oscura', 0.96, 0.05, 0.1, h[0], P1 + 0.75, -0.09); }
        });
        // planta baja: la ventana ancha de cuatro hojas y el portón de madera, con sus cargaderos de madera
        LC.caja('oscura', 3.2, 0.2, 0.16, 3.3, 2.28, -0.05); LC.caja('madera', 2.7, 1.3, 0.12, 3.3, 1.5, -0.03); LC.caja('cristal', 2.5, 1.1, 0.1, 3.3, 1.5, -0.07);
        [-0.625, 0, 0.625].forEach(function (dx) { LC.caja('madera', 0.07, 1.1, 0.1, 3.3 + dx, 1.5, -0.1); }); LC.caja('madera', 2.5, 0.06, 0.1, 3.3, 1.5, -0.1);
        LC.caja('oscura', 3.6, 0.22, 0.18, -3.6, 2.52, -0.05); LC.caja('madera', 3.1, 2.4, 0.12, -3.6, 1.2, -0.04); LC.caja('oscura', 0.05, 2.4, 0.1, -3.6, 1.2, -0.09);
        // geranios: dos jardineras en la barandilla y tres bajo la ventana
        [[3.2, P1 + 0.62, -CO - 0.14], [0.2, P1 + 0.62, -CO - 0.14], [2.5, 0.72, -0.22], [3.3, 0.72, -0.22], [4.1, 0.72, -0.22], [-5.6, 0.25, -0.5]].forEach(function (p) {
          LC.caja('barro', 0.62, 0.2, 0.2, p[0], p[1], p[2]); LC.caja('hoja', 0.6, 0.14, 0.2, p[0], p[1] + 0.16, p[2]); LC.caja('flor', 0.5, 0.14, 0.16, p[0], p[1] + 0.26, p[2]);
        });
        // las cuatro buhardillas (sus «dientes» en el Catastro): cuerpo crema, ventana de madera y tejadillo de pizarra con alero ancho
        CAS.buhardillas.forEach(function (u) {
          var zf = -CO + 0.45, zt = 1.1, alto = 1.42;
          LC.caja('crema', 1.5, alto, zt - zf, u, P2 + alto / 2 - 0.05, (zf + zt) / 2);
          LC.caja('oscura', 1.08, 0.92, 0.1, u, P2 + 0.72, zf - 0.02); LC.caja('visillo', 0.9, 0.76, 0.1, u, P2 + 0.72, zf - 0.05); LC.caja('oscura', 0.05, 0.76, 0.1, u, P2 + 0.72, zf - 0.08);
          LC.caja('oscura', 2.3, 0.12, zt - zf + 0.9, u, P2 + alto + 0.01, (zf + zt) / 2 - 0.3);
          var cono = new THREE.ConeGeometry(1.6, 0.62, 4, 1); cono.rotateY(Math.PI / 4);
          LC.pon('pizarra', cono, u, P2 + alto + 0.38, (zf + zt) / 2 - 0.3);
        });
        // la chimenea de piedra, por fuera del hastial del noreste
        LC.caja('piedra', 0.75, cumbre + 1.0 + 1, 0.95, -hx - 0.36, (cumbre + 1.0 - 1) / 2, zR - 1.4); LC.caja('pizarra', 1.0, 0.1, 1.2, -hx - 0.36, cumbre + 1.05, zR - 1.4);
        // la terraza del noreste: un cuerpo de piedra sobre su planta del Catastro, a la altura del corredor, con barandilla
        var T = CAS.terraza;
        LC.pon('piedra', muroGeo(T, -3, P1 - 0.05), 0, 0, 0);
        var sh = new THREE.Shape(); T.forEach(function (p, n) { if (n) sh.lineTo(p[0], -p[1]); else sh.moveTo(p[0], -p[1]); });
        var tapa = new THREE.ShapeGeometry(sh); tapa.rotateX(-Math.PI / 2); LC.pon('granito', tapa, 0, P1 - 0.05, 0);
        for (k = 0; k < T.length; k++) {
          var a = T[k], b = T[(k + 1) % T.length], lg = Math.hypot(b[0] - a[0], b[1] - a[1]);
          if (Math.max(a[0], b[0]) > -hx - 0.4 && lg > 1.5) continue;                 // el lado pegado a la casa no lleva barandilla
          LC.caja('madera', 0.12, 1.0, 0.12, a[0], P1 + 0.45, a[1]);
          if (lg > 0.3) { var ry = -Math.atan2(b[1] - a[1], b[0] - a[0]); LC.caja('madera', lg, 0.08, 0.09, (a[0] + b[0]) / 2, P1 + 0.92, (a[1] + b[1]) / 2, ry); LC.caja('madera', lg, 0.06, 0.07, (a[0] + b[0]) / 2, P1 + 0.45, (a[1] + b[1]) / 2, ry); }
        }
        // el hórreo: basamento de piedra, cuatro pegollos con sus muelas, trabes, caja de madera oscura y tejado de pizarra a cuatro aguas
        var hu = CAS.horreo.u, hv = CAS.horreo.v, lado = 4.5, yb = 2.55;
        LC.caja('piedra', lado + 0.7, 0.7 + 3, lado + 0.7, hu, (0.7 - 3) / 2, hv);
        [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (c) {
          var pg = new THREE.CylinderGeometry(0.2, 0.33, 1.55, 4, 1); pg.rotateY(Math.PI / 4);
          LC.pon('granito', pg, hu + c[0] * (lado / 2 - 0.35), 0.7 + 0.775, hv + c[1] * (lado / 2 - 0.35));
          LC.caja('granito', 0.9, 0.12, 0.9, hu + c[0] * (lado / 2 - 0.35), 0.7 + 1.61, hv + c[1] * (lado / 2 - 0.35));
        });
        [-1, 1].forEach(function (sg) { LC.caja('oscura', lado + 0.5, 0.26, 0.3, hu, yb - 0.14, hv + sg * (lado / 2 - 0.35)); LC.caja('oscura', 0.3, 0.26, lado + 0.5, hu + sg * (lado / 2 - 0.35), yb - 0.14, hv); });
        LC.caja('oscura', lado, 2.15, lado, hu, yb + 1.075, hv);
        LC.caja('madera', 0.9, 1.5, 0.08, hu + 0.6, yb + 0.85, hv - lado / 2 - 0.03);
        var tj = new THREE.ConeGeometry(4.75, 1.9, 4, 1); tj.rotateY(Math.PI / 4);
        LC.pon('pizarra', tj, hu, yb + 2.15 + 0.95, hv);
      })();
      LC.mallas(casa, true);
      var balGeo = guarda(new THREE.LatheGeometry([[0.0, 0], [0.04, 0], [0.04, 0.07], [0.026, 0.11], [0.045, 0.28], [0.024, 0.42], [0.045, 0.58], [0.026, 0.74], [0.036, 0.8], [0.036, 0.87], [0, 0.87]].map(function (p) { return new THREE.Vector2(p[0], p[1]); }), 6));
      var bal = new THREE.InstancedMesh(balGeo, MAT.madera, Math.max(1, balaustres.length));
      balaustres.forEach(function (p, n) { mPieza.makeTranslation(p[0], p[1], p[2]); bal.setMatrixAt(n, mPieza); });
      bal.count = balaustres.length; bal.castShadow = true; bal.name = 'balaustres'; casa.add(bal);
      // de noche: las puertaventanas encendidas, con un halo dibujado (sin bloom)
      var luzV = new THREE.Group(); luzV.visible = false; casa.add(luzV);
      var matLuz = guarda(new THREE.MeshBasicMaterial({ color: '#ffc883', toneMapped: false, transparent: true, opacity: 0 }));
      var haloTex = texDe(64, function (g, l) { var r = g.createRadialGradient(l / 2, l / 2, 0, l / 2, l / 2, l / 2); r.addColorStop(0, 'rgba(255,196,120,.85)'); r.addColorStop(0.3, 'rgba(255,190,110,.25)'); r.addColorStop(1, 'rgba(255,190,110,0)'); g.fillStyle = r; g.fillRect(0, 0, l, l); });
      var matHalo = guarda(new THREE.SpriteMaterial({ map: haloTex, transparent: true, depthWrite: false, opacity: 0, toneMapped: false, fog: false }));
      var geoLuz = guarda(new THREE.PlaneGeometry(0.9, 1.9));
      [4.6, -1.9, -6.0].forEach(function (x) {
        var pl = new THREE.Mesh(geoLuz, matLuz); pl.position.set(x, P1 + 1.05, -0.13); pl.rotation.y = Math.PI; luzV.add(pl);
        var hs = new THREE.Sprite(matHalo); hs.scale.set(3, 3, 1); hs.position.set(x, P1 + 1.05, -0.4); luzV.add(hs);
      });

      /* --- los vecinos de Penlés (plantas del Catastro) y los edificios de Tablizas (plantas de OpenStreetMap):
             muros claros y tejado a dos aguas; el color del tejado del pueblo es el de la ortofoto --- */
      var colTmp = new THREE.Color(), nVecinos = 0;
      function volumenes(lista, grupo, colorFn, sombra) {
        var L = new Lote();
        lista.forEach(function (e) {
          if (!hiDef && grupo === pueblo && Math.hypot(e.rect.cx, e.rect.cz) > 220) return;
          var alto = Math.max(1, e.pisos) * 2.85 + 0.15, techo = e.sueloMax + alto, rc = e.rect;
          L.pon('claro', muroGeo(e.anillo, e.suelo - 1.5, techo), 0, 0, 0);
          colTmp.set(colorFn(e));
          L.pon('tejado', tejadoGeo(rc.lu, rc.lv, 0.45, 0.45, 0.3), rc.cx, techo, rc.cz, -rc.ang, colTmp.clone());
          [-1, 1].forEach(function (sg) { L.pon('claro', hastialGeo(rc.lv, rc.lv / 2 * 0.45), rc.cx + Math.cos(rc.ang) * sg * rc.lu / 2, techo, rc.cz + Math.sin(rc.ang) * sg * rc.lu / 2, -rc.ang + (sg > 0 ? 0 : Math.PI)); });
          nVecinos++;
        });
        L.mallas(grupo, sombra);
      }
      var pueblo = new THREE.Group(); esc3.add(pueblo);
      volumenes(m.edificios, pueblo, function (e) { var c = hexA(e.tejado), l = (c[0] + c[1] + c[2]) / 3; return l > 215 ? '#8c9198' : mezcla(e.tejado, '#6b6f76', 0.2); }, true);
      var recepcion = new THREE.Group(); esc3.add(recepcion);
      volumenes(m.tablizas, recepcion, function () { return '#6f757d'; }, false);

      /* --- la carretera: una cinta apoyada en la malla, con lo andado en el color de la marca y lo que queda en claro --- */
      var ANCHO = hiDef ? 7 : 9, nP = cinta.length, cPos = new Float32Array(nP * 9), cIdx = [], kmCinta = new Float32Array(nP);
      for (i = 0; i < nP; i++) {
        var pa = cinta[Math.max(0, i - 1)], pb = cinta[Math.min(nP - 1, i + 1)], tx = pb[0] - pa[0], tz = pb[1] - pa[1], tl = Math.hypot(tx, tz) || 1;
        var nxr = -tz / tl, nzr = tx / tl;
        for (var e3 = -1; e3 <= 1; e3++) { var px = cinta[i][0] + nxr * ANCHO * e3, pz = cinta[i][1] + nzr * ANCHO * e3, o3 = (i * 3 + e3 + 1) * 3; cPos[o3] = px; cPos[o3 + 1] = alturaMalla(px, pz) + 2.2; cPos[o3 + 2] = pz; }
        kmCinta[i] = cinta[i][2];
        if (i < nP - 1) { var v0 = i * 3; cIdx.push(v0, v0 + 3, v0 + 1, v0 + 1, v0 + 3, v0 + 4, v0 + 1, v0 + 4, v0 + 2, v0 + 2, v0 + 4, v0 + 5); }
      }
      var cAtr = new THREE.BufferAttribute(cPos, 3), cInd = new THREE.Uint16BufferAttribute(cIdx, 1);
      var geoHecho = guarda(new THREE.BufferGeometry()), geoFalta = guarda(new THREE.BufferGeometry());
      [geoHecho, geoFalta].forEach(function (g) { g.setAttribute('position', cAtr); g.setIndex(cInd); g.computeBoundingSphere(); });
      var opCinta = { side: THREE.DoubleSide, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 };
      var cHecho = new THREE.Mesh(geoHecho, guarda(new THREE.MeshBasicMaterial(Object.assign({ color: COL_TRAZO }, opCinta))));
      var cFalta = new THREE.Mesh(geoFalta, guarda(new THREE.MeshBasicMaterial(Object.assign({ color: '#fff3dc', transparent: true, opacity: 0.62 }, opCinta))));
      cHecho.name = 'carretera andada'; cFalta.name = 'carretera por andar'; cHecho.frustumCulled = cFalta.frustumCulled = false; cHecho.renderOrder = 3; cFalta.renderOrder = 2;
      esc3.add(cHecho, cFalta);
      var xDe = lineal(cinta.map(function (p) { return p[2]; }), cinta.map(function (p) { return p[0]; })), zDe = lineal(cinta.map(function (p) { return p[2]; }), cinta.map(function (p) { return p[1]; }));
      var marca = new THREE.Sprite(guarda(new THREE.SpriteMaterial({ map: texDe(96, function (g, l) {
        g.beginPath(); g.arc(l / 2, l / 2, l * 0.42, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,.22)'; g.fill();
        g.beginPath(); g.arc(l / 2, l / 2, l * 0.26, 0, Math.PI * 2); g.fillStyle = '#ffffff'; g.fill();
        g.beginPath(); g.arc(l / 2, l / 2, l * 0.17, 0, Math.PI * 2); g.fillStyle = COL_TRAZO; g.fill();
      }), depthTest: false, depthWrite: false, transparent: true, toneMapped: false, fog: false })));
      marca.renderOrder = 20; marca.name = 'marca del km'; esc3.add(marca);
      function ponCinta(km) {
        var a = 0, b = nP - 1;
        while (b - a > 1) { var c = (a + b) >> 1; if (kmCinta[c] <= km) a = c; else b = c; }
        var n = (km >= kmCinta[nP - 1] ? nP - 1 : a) * 12;
        geoHecho.setDrawRange(0, n); geoFalta.setDrawRange(n, cIdx.length - n);
        var x = xDe(km), z = zDe(km);
        marca.position.set(x, alturaMalla(x, z) + 6, z);
      }

      /* --- rótulos (HTML encima del lienzo): los hitos del camino, según se acercan --- */
      var extra = { nombre: 'Reserva Natural Integral de Muniellos', km: m.kmFinal + 1.2, tipo: 'reserva', cota: null, x: DES.x + DES.rumbo[0] * 1300, z: DES.z + DES.rumbo[1] * 1300 };
      extra.y = altura(extra.x, extra.z);
      var rotulos = m.hitos.concat([extra]).map(function (h) {
        var s = document.createElement('span');
        s.className = 'lugar__rotulo lugar__rotulo--' + h.tipo;
        s.innerHTML = '<span><b>' + esc(h.nombre) + '</b>' + (h.tipo === 'reserva' ? '' : '<small>' + (h.tipo === 'casa' ? 'Penlés · ' : 'km ' + coma(h.km) + ' · ') + h.cota + ' m</small>') + '</span>';
        capaRot.appendChild(s);
        var alto = h.tipo === 'reserva' ? 90 : 26;
        // el de la casa, sobre la cumbrera (si no, de cerca se sale por arriba del encuadre)
        var v = h.tipo === 'casa' ? casa.localToWorld(new THREE.Vector3(0, cumbre + 1.3, zR)) : new THREE.Vector3(h.x, h.y + alto, h.z);
        return { el: s, h: h, v: v, visto: false };
      });
      function tapado(a, b) {                     // ¿el relieve tapa la línea de la cámara al rótulo?
        for (var n = 1; n < 24; n++) {
          var t = n / 24, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t, y = a.y + (b.y - a.y) * t;
          if (altura(x, z) > y + 4) return true;
        }
        return false;
      }
      var v3 = new THREE.Vector3(), vista = { w: 0, h: 0 };
      function colocarRotulos(p, km) {
        var w = vista.w, h = vista.h, n = 0, MAX = movil ? 3 : 5, tr = m.tramos, enCasa = p < tr.sale * 0.82, fin = p > tr.llega + 0.02;
        rotulos.forEach(function (r) {
          var t = r.h.tipo, ok = n < MAX;
          if (ok) ok = t === 'casa' ? p < tr.sale + 0.05 : t === 'reserva' ? fin : t === 'destino' ? km > m.kmFinal - 4 : (!enCasa && r.h.km > km - 0.5 && r.h.km < km + 3.6);
          if (ok) {
            v3.copy(r.v).project(cam);
            ok = v3.z < 1 && Math.abs(v3.x) < 0.9 && v3.y > -0.5 && v3.y < 0.8;
            if (ok && t !== 'casa') ok = !tapado(cam.position, r.v);
          }
          if (ok) { n++; r.el.style.transform = 'translate3d(' + ((v3.x + 1) / 2 * w).toFixed(1) + 'px,' + ((1 - v3.y) / 2 * h).toFixed(1) + 'px,0)'; }
          if (ok !== r.visto) { r.visto = ok; r.el.classList.toggle('es-visible', ok); }
        });
      }

      /* --- la luz de un instante: sol, luna, cielo y la sombra del relieve --- */
      var dirSol = new THREE.Vector3(0, 1, 0), dirLuna = new THREE.Vector3(0, 1, 0), dirPase = new THREE.Vector3(), ultPase = new THREE.Vector3(9, 9, 9);
      var dirDe = function (az, alt, v) { return v.set(Math.sin(az * RAD) * Math.cos(alt * RAD), Math.sin(alt * RAD), -Math.cos(az * RAD) * Math.cos(alt * RAD)); };
      var noche = 0, solAhora = { azimut: 180, altura: 30 };
      function luces(f) {
        f = f || ahora();
        var s = sol(f, m.lat, m.lon), l = luna(f, m.lat, m.lon), c = cieloPara(s.altura);
        solAhora = s;
        noche = lim((-s.altura - 2) / 10, 0, 1);
        var diaL = lim((s.altura + 4) / 14, 0, 1);
        dirDe(s.azimut, s.altura, dirSol); dirDe(l.az, l.alt, dirLuna);
        pintarCielo(c, dirSol, lim(1 - Math.abs(s.altura - 2) / 16, 0, 1));
        esc3.fog.color.set(mezcla(c.ch, c.cz, 0.15));
        luzSol.position.copy(CASA3).addScaledVector(dirSol, 400);
        luzSol.intensity = 2.6 * suave(-1, 8, s.altura);
        luzSol.color.set(mezcla('#fff4e6', '#ff9a5a', lim(1 - s.altura / 20, 0, 1)));
        solS.visible = s.altura > -3; solS.material.opacity = lim((s.altura + 3) / 4, 0, 1);
        luzLuna.position.copy(CASA3).addScaledVector(dirLuna, 400);
        luzLuna.intensity = l.alt > 0 ? (0.2 + 0.8 * l.luz) * noche : 0;
        lunaS.visible = l.alt > -1.5 && l.luz > 0.03;
        if (lunaS.visible) { var fk = Math.round(l.fase * 100); if (fk !== faseLuna) { faseLuna = fk; pintarLuna(l.fase); } lunaS.material.opacity = lim((l.alt + 1.5) / 3, 0, 1); }
        hemi.intensity = lerp(0.5, 1.6, diaL);
        hemi.color.set(mezcla('#3c4f86', '#d8e4f0', diaL)); hemi.groundColor.set(mezcla('#15131c', '#5a5040', diaL));
        estrellas.visible = noche > 0.02; estrellas.material.opacity = noche * noche;
        // la sombra del relieve, para el sol (o para la luna, de noche); solo si se ha movido
        var deSol = s.altura > -4;
        dirPase.copy(deSol ? dirSol : dirLuna);
        if (dirPase.distanceToSquared(ultPase) > 2e-6) { ultPase.copy(dirPase); pideSombra(deSol ? s.azimut : l.az, deSol ? s.altura : l.alt); }
        luzV.visible = noche > 0.05; matLuz.opacity = lim(noche * 1.4, 0, 1); matHalo.opacity = noche * 0.9;
        ren.shadowMap.needsUpdate = true;
        pedir(true);
      }

      /* --- cámara: el vuelo con el scroll --- */
      var ruta = camino(m.vuelo), hCam = 0;
      function ajustar() {
        var w = escenario.clientWidth, h = escenario.clientHeight;
        if (!w || !h) return;
        // la barra del navegador del móvil cambia solo el alto: no se rehace nada (si no, salta)
        if (vista.w === w && Math.abs(vista.h - h) < 160 && vista.h) { if (vista.h !== h) { vista.h = h; ren.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); pedir(true); } return; }
        vista.w = w; vista.h = h;
        ren.setPixelRatio(Math.min(devicePixelRatio || 1, topeDPR()));
        ren.setSize(w, h, false);
        cam.aspect = w / h;
        cam.fov = w / h < 1 ? 62 : w / h < 1.3 ? 52 : 46;
        cam.updateProjectionMatrix();
        pedir(true);
      }
      var kmAnt = -1;
      function situar(p) {
        var r = ruta(p);
        cam.position.set(r.pos[0], r.pos[1], r.pos[2]);
        cam.lookAt(r.mira[0], r.mira[1], r.mira[2]);
        cam.updateMatrixWorld();                    // los rótulos se proyectan con esta cámara
        hCam = Math.max(1, r.pos[1] - altura(r.pos[0], r.pos[2]));
        var cerca2 = lim(hCam * 0.1, 0.3, 30);
        if (Math.abs(cerca2 - cam.near) / cam.near > 0.1) { cam.near = cerca2; cam.updateProjectionMatrix(); }
        if (Math.abs(r.km - kmAnt) > 0.0005) { kmAnt = r.km; ponCinta(r.km); ponKm(r.km); }
        marca.visible = p > m.tramos.sale * 0.6;
        var dm = marca.position.distanceTo(cam.position); marca.scale.setScalar(dm * 0.03);
        pideBloques(r.pos[0] * 0.4 + r.mira[0] * 0.6, r.pos[2] * 0.4 + r.mira[2] * 0.6);
        if (r.km > m.kmFinal - 6) pideCerca(cercas[1]);
        return r;
      }

      /* --- bucle: pinta solo si algo cambia; se para fuera de pantalla --- */
      var raf = 0, tPrev = 0, activo = false, visible = true, sucio = true, primero = true, pAnt = -1;
      var fpsEl = null, fN = 0, fT0 = 0, tAc = 0, nAc = 0;
      if (q.has('fps')) { fpsEl = document.createElement('p'); fpsEl.className = 'lugar__fps'; escenario.appendChild(fpsEl); }
      function leerScroll() {
        var r = pista.getBoundingClientRect(), largo = pista.offsetHeight - escenario.offsetHeight;
        estado.p = largo > 0 ? lim(-r.top / largo, 0, 1) : 0;
      }
      function paso(t) {
        raf = 0;
        if (estado.destruido || !activo || !visible) return;
        var dt = tPrev ? Math.min(0.1, (t - tPrev) / 1000) : 0.016; tPrev = t;
        leerScroll();
        var kk = reduce ? 1 : 1 - Math.exp(-dt * 5.5);                  // inercia suave, independiente de los fps
        var pV = estado.pVis + (estado.p - estado.pVis) * kk;
        if (Math.abs(estado.p - pV) < 0.00003) pV = estado.p;
        var mueve = Math.abs(pV - pAnt) > 0.000005;
        estado.pVis = pV;
        if (mueve || sucio || primero) {
          var r = situar(pV);
          cielo.position.copy(cam.position); estrellas.position.copy(cam.position);
          solS.position.copy(cam.position).addScaledVector(dirSol, 160000);
          lunaS.position.copy(cam.position).addScaledVector(dirLuna, 160000);
          ren.render(esc3, cam);
          colocarRotulos(pV, r.km);
          pAnt = pV; sucio = false;
          if (primero && ((sombra.lista && texBase && pendientes <= 0) || t > tListo)) { primero = false; escenario.classList.add('lugar--listo'); estado.cargado = true; avisar(''); }
          if (fpsEl) { fN++; if (!fT0) fT0 = t; if (t - fT0 > 500) { fpsEl.textContent = (fN * 1000 / (t - fT0)).toFixed(0) + ' fps · calidad ' + estado.calidad + ' · DPR ' + ren.getPixelRatio().toFixed(2) + ' · cámara a ' + Math.round(hCam) + ' m del suelo · ' + Math.round(ren.info.render.triangles / 1000) + ' k triángulos · ' + ren.info.render.calls + ' llamadas · bloques ' + nBloques + ' · sol ' + solAhora.altura.toFixed(1) + '° al ' + Math.round(solAhora.azimut) + '° · sombras ' + sombra.veces; fN = 0; fT0 = t; } }
          if (mueve) { tAc += dt; nAc++; }
          if (nAc >= 50) { var media = tAc / nAc; tAc = 0; nAc = 0; if (media > 0.03 && estado.calidad < 2 && !document.hidden) bajarCalidad(); }
          raf = requestAnimationFrame(paso);
        }
      }
      function pedir(ensuciar) { if (ensuciar) sucio = true; if (!raf && activo && visible && !estado.destruido) { tPrev = 0; raf = requestAnimationFrame(paso); } }
      function bajarCalidad() {
        estado.calidad++;
        if (estado.calidad === 1) { ren.setPixelRatio(1); ren.setSize(vista.w, vista.h, false); }
        if (estado.calidad === 2) { ren.shadowMap.enabled = false; luzSol.castShadow = false; ren.setPixelRatio(0.8); ren.setSize(vista.w, vista.h, false); esc3.traverse(function (o) { if (o.material) o.material.needsUpdate = true; }); }
        pedir(true);
      }
      var alRedim = new ResizeObserver(function () { ajustar(); });
      alRedim.observe(escenario);
      var io = new IntersectionObserver(function (es) {
        visible = es[0].isIntersecting;
        if (visible) pedir(true); else { cancelAnimationFrame(raf); raf = 0; }
      }, { rootMargin: '160px' });
      io.observe(pista);
      escucha(window, 'scroll', function () { pedir(false); }, { passive: true });
      cv.addEventListener('webglcontextlost', function (e) { e.preventDefault(); estado.error3d = 'contexto perdido'; ponModo('plano'); });

      pideCerca(cercas[0]);
      ajustar();
      try { ren.compile(esc3, cam); } catch (e) { /* sin compilación previa */ }

      t3 = {
        luces: luces,
        activo: function (si) { activo = si; cv.hidden = !si; if (si) { vista.w = 0; ajustar(); pedir(true); } else { cancelAnimationFrame(raf); raf = 0; } },
        estado: function () {
          return { p: estado.p, pVis: estado.pVis, km: kmAnt, calidad: estado.calidad, near: cam.near, fov: cam.fov, hCam: hCam, triangulos: ren.info.render.triangles, llamadas: ren.info.render.calls,
            balaustres: balaustres.length, piezasCasa: LC.n, vecinos: nVecinos, bloques: nBloques, sombras: sombra.veces, sombraMedia: (function () { var sm = 0; for (var k = 0; k < sDatos.length; k += 4) sm += sDatos[k]; return sm / (sDatos.length / 4) / 255; })(),
            sol: solAhora, noche: noche, cam: [cam.position.x, cam.position.y, cam.position.z], andado: geoHecho.drawRange.count, marca: [marca.position.x, marca.position.y, marca.position.z] };
        },
        // para las pruebas (no pinta): los shaders de Lambert ya parcheados, con los #include resueltos
        shaders: function () {
          var res = function (s) { for (var n = 0; n < 6 && /#include <\w+>/.test(s); n++) s = s.replace(/^[ \t]*#include <(\w+)>/gm, function (_, c) { return THREE.ShaderChunk[c] || ''; }); return s; };
          return [bloques[0].mat, matLejos, MAT.madera].map(function (mt) {
            var sh = { uniforms: {}, vertexShader: THREE.ShaderLib.lambert.vertexShader, fragmentShader: THREE.ShaderLib.lambert.fragmentShader };
            mt.onBeforeCompile(sh);
            return { clave: mt.customProgramCacheKey(), uniformes: Object.keys(sh.uniforms), v: res(sh.vertexShader), f: res(sh.fragmentShader) };
          });
        },
        alturaMalla: alturaMalla, altura: altura,
        destruir: function () {
          cancelAnimationFrame(raf); raf = 0; clearTimeout(sombra.tarea); alRedim.disconnect(); io.disconnect();
          disponer.forEach(function (o) { try { o.dispose(); } catch (e) { /* ya */ } });
          esc3.traverse(function (o) { if (o.geometry && o.geometry.dispose) o.geometry.dispose(); if (o.material && o.material.dispose) o.material.dispose(); });
          try { ren.dispose(); ren.forceContextLoss(); } catch (e) { /* ya */ }
          cv.remove(); capaRot.innerHTML = '';
        },
      };
      luces(ahora());
      return t3;
    }

    /* ---------- mandos ---------- */
    function activar3d(desdeBoton) {
      ponModo('3d');
      if (desdeBoton) el.scrollIntoView({ block: 'start', behavior: 'auto' });
      cargar3d().then(function (t) { if (t && !estado.destruido && estado.modo === '3d') t.activo(true); });
    }
    escucha($('a3d'), 'click', function () { activar3d(true); });
    escucha($('aplano'), 'click', function () { ponModo('plano'); el.scrollIntoView({ block: 'start', behavior: 'auto' }); });
    escucha($('saltar'), 'click', function () {
      var r = pista.getBoundingClientRect();
      window.scrollTo({ top: r.bottom + window.scrollY - Math.min(120, window.innerHeight * 0.2), behavior: 'auto' });
      var f = el.querySelector('.lugar__fuente'); if (f) { f.setAttribute('tabindex', '-1'); f.focus({ preventScroll: true }); }
    });

    intervalo = setInterval(function () { if (!document.hidden) ponCielo(); }, 60000);
    if (auto3d) activar3d(false); else ponModo('plano');
    el.dataset.montado = '1';

    return {
      destruir: function () {
        estado.destruido = true;
        clearInterval(intervalo);
        escuchas.forEach(function (f) { f(); });
        if (t3) t3.destruir();
        t3 = null;
        el.classList.remove('lugar-mod'); delete el.dataset.modo; delete el.dataset.montado;
        el.innerHTML = respaldo;
      },
      estado: function () { return { modo: estado.modo, puede3d: puede3d, auto3d: auto3d, error3d: estado.error3d, cargado: estado.cargado, km: estado.km, hito: estado.hito, t3: t3 ? t3.estado() : null }; },
      ver3d: function () { activar3d(false); },
      verPlano: function () { ponModo('plano'); },
      irA: irA,
      _t3: function () { return t3; },
    };
  }

  A.lugar = { montar: montar, sol: sol, luna: luna, monotona: monotona, lineal: lineal, camino: camino, hitoEn: hitoEn, cieloPara: cieloPara, fraseCielo: fraseCielo, sombraRelieve: sombraRelieve, perfil: perfil, muestreador: muestreador };
})();
