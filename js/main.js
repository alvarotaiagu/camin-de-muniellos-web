/* ------------------------------------------------------------------
   Camín de Muniellos · «El roble y el camín» · lo común de la página (receta de ../apartamentos-alba-somiedo-web)
   - Monta los módulos con su respaldo: el roble y el camín al cargar; el 3D (Camin.lugar, de Lugar 3D), las distancias y
     el calendario al acercarse (IntersectionObserver, 900 px). Contrato: Camin.<mod>.montar(el, { movimiento, densidad,
     webgl }) → { destruir() }. Si un módulo falla, vuelve su respaldo.
   - Cabecera, menú móvil, los tres apartamentos (acordeón en escritorio), la visita 360 a petición, el horario de
     Muniellos de este mes, el mapa a petición, cookies, el foco con forma de mojón y el mando de maqueta (bloque 12; no
     viaja al cliente).
   Sin GSAP ni Lenis: transiciones CSS y un rAF por fotograma de scroll.
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  const raiz = document.documentElement;
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motion = !quieto;
  const sobria = () => raiz.classList.contains('densidad-sobria');
  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
  const C = (window.Camin = window.Camin || {});
  const anno = $('#anno');
  if (anno) anno.textContent = (C.ahora ? C.ahora() : new Date()).getFullYear();

  // el resize de la barra del móvil (mismo ancho, poca altura) no rehace NADA (checklist punto 10)
  let anchoVista = innerWidth, altoVista = innerHeight;
  const esBarra = () => innerWidth === anchoVista && Math.abs(innerHeight - altoVista) < 160;

  /* ============ 1. ir a un sitio ============ */
  const cabAlto = () => parseFloat(getComputedStyle(raiz).getPropertyValue('--cabecera')) || 68;
  const irA = (sel) => {
    const el = typeof sel === 'string' ? $(sel) : sel;
    if (!el) return;
    const margen = Math.max(cabAlto() + 8, parseFloat(getComputedStyle(el).scrollMarginTop) || 0);
    const y = el.getBoundingClientRect().top + scrollY - (el.matches('main > section') ? 0 : margen);
    scrollTo({ top: Math.max(0, y), behavior: quieto || sobria() ? 'auto' : 'smooth' });
    // al llegar se montan módulos por encima y la página crece: se comprueba el sitio un par de veces y se corrige
    // (salvo que quien navega ya haya movido la página por su cuenta)
    const marca = ++viaje;
    const tope = el.matches('main > section') ? 0 : margen;
    [quieto || sobria() ? 260 : 1000, quieto || sobria() ? 700 : 1600].forEach((ms) => setTimeout(() => {
      if (marca !== viaje || tocado) return;
      const d = el.getBoundingClientRect().top - tope;
      if (Math.abs(d) > 6) scrollTo({ top: Math.max(0, scrollY + d), behavior: 'auto' });
    }, ms));
  };
  let viaje = 0, tocado = false;
  ['wheel', 'touchstart', 'keydown'].forEach((ev) => addEventListener(ev, () => { tocado = true; viaje++; setTimeout(() => { tocado = false; }, 50); }, { passive: true }));

  /* ============ 2. cabecera: fondo al bajar y el enlace de la sección que se ve ============ */
  const cab = $('#cab');
  const enlaces = $$('.cab__nav a');
  const secciones = enlaces.map((a) => $(a.getAttribute('href'))).filter(Boolean);
  let actual = null;
  function pintarCabecera() {
    cab.classList.toggle('sc', scrollY > 24);
    const y = cabAlto() + altoVista * 0.25;
    let sec = null;
    for (const s of secciones) { const r = s.getBoundingClientRect(); if (r.top <= y && r.bottom > y) sec = s; }
    if (sec !== actual) {
      actual = sec;
      enlaces.forEach((a) => { if (sec && a.getAttribute('href') === '#' + sec.id) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
    }
  }

  /* ============ 3. módulos ============ */
  const montados = new Map();
  const esperando = new Set();
  const modulo = (el) => { const m = C[el.dataset.modulo]; return m && typeof m.montar === 'function' ? m : null; };
  const opciones = () => ({ movimiento: motion && !sobria(), densidad: sobria() ? 'sobria' : 'camin', webgl: !raiz.classList.contains('sin-webgl') });
  function fallo(el, respaldo, er) {
    console.warn('Módulo ' + el.dataset.modulo + ': se queda el respaldo', er);
    if (el.innerHTML !== respaldo) el.innerHTML = respaldo;
    delete el.dataset.montado;
    el.classList.add('sin-modulo');
    raiz.classList.add('sin-' + el.dataset.modulo);
  }
  function montarModulo(el) {
    if (montados.has(el)) return;
    const mod = modulo(el);
    if (!mod) { esperando.add(el); if (document.readyState === 'complete') { el.classList.add('sin-modulo'); raiz.classList.add('sin-' + el.dataset.modulo); } return; }
    esperando.delete(el);
    el.classList.remove('sin-modulo');
    raiz.classList.remove('sin-' + el.dataset.modulo);
    const respaldo = el.innerHTML;
    try {
      const inst = mod.montar(el, opciones());
      montados.set(el, { inst, respaldo });
      if (inst && inst.listo && typeof inst.listo.catch === 'function') inst.listo.catch((er) => { try { inst.destruir && inst.destruir(); } catch (e) { /* nada */ } fallo(el, respaldo, er); });
    } catch (er) {
      fallo(el, respaldo, er);
      montados.set(el, { inst: null, respaldo });
    }
  }
  const reintentar = () => { if (esperando.size) [...esperando].forEach(montarModulo); };
  addEventListener('load', () => { reintentar(); esperando.forEach((el) => { el.classList.add('sin-modulo'); raiz.classList.add('sin-' + el.dataset.modulo); }); });
  function remontarTodos() {
    [...montados].forEach(([el, { inst, respaldo }]) => {
      try { inst && inst.destruir && inst.destruir(); } catch (er) { console.warn(er); }
      if (el.dataset.modulo !== 'roble') el.innerHTML = respaldo;        // el roble se pinta sobre su propio dibujo
      el.classList.remove('sin-modulo', 'es-montado');
      delete el.dataset.montado;
      montados.delete(el);
      montarModulo(el);
    });
  }
  const alCargar = $$('[data-modulo="roble"], [data-modulo="camin"]');
  alCargar.forEach(montarModulo);
  const resto = $$('[data-modulo]').filter((el) => !alCargar.includes(el));
  if ('IntersectionObserver' in window) {
    const ioMod = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { ioMod.unobserve(e.target); montarModulo(e.target); }
    }), { rootMargin: '900px 0px' });
    resto.forEach((el) => ioMod.observe(el));
  } else resto.forEach(montarModulo);
  // los clics dentro del 3D montado son del módulo
  const deModulo = (t) => !!t.closest('[data-modulo="lugar"][data-montado]');

  /* ============ 4. menú ============ */
  const btnMenu = $('#menu-btn'), menu = $('#menu-movil');
  const cerrarMenu = () => {
    document.body.classList.remove('menu');
    btnMenu.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-hidden', 'true');
  };
  btnMenu.addEventListener('click', () => {
    const abierto = document.body.classList.toggle('menu');
    btnMenu.setAttribute('aria-expanded', String(abierto));
    menu.setAttribute('aria-hidden', String(!abierto));
  });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.classList.contains('menu')) { cerrarMenu(); btnMenu.focus(); } });

  /* ============ 5. los tres apartamentos: acordeón en escritorio (el abierto se lleva el sitio) ============ */
  const pisos = $('#pisos');
  const listaPisos = pisos ? $$('.piso', pisos) : [];
  const ancho = matchMedia('(min-width: 900px)');
  function abrirPiso(id, conFoco) {
    const i = listaPisos.findIndex((p) => p.dataset.piso === id);
    if (i < 0) return;
    pisos.dataset.abierto = String(i);
    listaPisos.forEach((p, k) => {
      p.classList.toggle('es-abierto', k === i);
      const b = $('.piso__abrir', p);
      if (b) b.setAttribute('aria-expanded', String(k === i));
    });
    if (conFoco) { const t = $('.piso__nombre', listaPisos[i]); t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); }
  }
  if (pisos) {
    listaPisos.forEach((p) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'piso__abrir';
      b.setAttribute('aria-label', 'Ver ' + $('.piso__nombre', p).textContent);
      b.setAttribute('aria-controls', 'piso-' + p.dataset.piso);
      b.setAttribute('aria-expanded', String(p.classList.contains('es-abierto')));
      b.addEventListener('click', () => abrirPiso(p.dataset.piso, true));
      p.appendChild(b);
    });
    const poner = () => { pisos.classList.toggle('es-acordeon', ancho.matches); if (!pisos.dataset.abierto) pisos.dataset.abierto = '0'; };
    poner();
    (ancho.addEventListener ? ancho.addEventListener('change', poner) : ancho.addListener(poner));
  }
  C.abrirPiso = abrirPiso;

  /* ============ 6. enlaces internos y «Ver fechas» de cada apartamento ============ */
  C.reservar = function (apto) {
    if (apto && C.reserva && C.reserva.apto) C.reserva.apto(apto);
    cerrarMenu();
    irA('#reservar');
  };
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || deModulo(e.target)) return;
    const r = e.target.closest('[data-reservar]');
    if (r) { e.preventDefault(); C.reservar(r.getAttribute('data-reservar')); return; }
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const destino = a.getAttribute('href');
    if (destino.length < 2 || !$(destino)) return;
    e.preventDefault();
    cerrarMenu();
    irA(destino);
    setTimeout(() => {
      const t = $(destino);
      if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1');
      t.focus({ preventScroll: true });
    }, quieto ? 50 : 900);
  });

  /* ============ 7. la visita 360: el iframe no existe hasta que se pide ============ */
  const visitaBtn = $('#visita-btn');
  if (visitaBtn) visitaBtn.addEventListener('click', () => {
    const marco = $('#visita-marco');
    const f = document.createElement('iframe');
    f.src = marco.dataset.src;
    f.title = 'Visita 360 del interior de la casa (Google Maps)';
    f.allow = 'fullscreen; gyroscope; accelerometer';
    f.allowFullscreen = true;
    f.referrerPolicy = 'no-referrer-when-downgrade';
    marco.replaceChildren(f);
    marco.classList.add('es-abierta');
    f.focus();
  });

  /* ============ 8. Muniellos: el horario del mes en curso (contenido: también con movimiento reducido) ============ */
  (function () {
    const nodo = $('#datos-muniellos'), hoyTxt = $('#horario-hoy');
    if (!nodo || !hoyTxt || !C.madrid) return;
    const M = JSON.parse(nodo.textContent), m = C.madrid();
    const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const h = M.horario.find((x) => x.meses.includes(m.mes));
    if (!h) return;
    $$('.muni__anio li').forEach((li) => li.classList.toggle('es-ahora', +li.dataset.mes === m.mes));
    $$('.muni__tabla tr').forEach((tr) => tr.classList.toggle('es-ahora', tr.dataset.meses.split(',').map(Number).includes(m.mes)));
    hoyTxt.innerHTML = 'Este mes, ' + MESES[m.mes - 1] + ': de <b>' + h.abre + '</b> a <b>' + h.cierra + '</b>.' + (M.mesesMartes.includes(m.mes) ? ' Los martes, cerrado.' : '');
    hoyTxt.hidden = false;
  })();

  /* ============ 9. cookies (y el mando se aparta mientras están) ============ */
  const ck = $('#cookies');
  const LLAVE = 'camin-cookies';
  const leer = () => { try { return localStorage.getItem(LLAVE); } catch (e) { return null; } };
  const guardar = (v) => { try { localStorage.setItem(LLAVE, v); } catch (e) { /* sin almacenamiento */ } };
  let verMando = () => {};          // el mando de maqueta (bloque 12) la cambia para apartarse del aviso
  const cerrarCk = (v) => { guardar(v); ck.hidden = true; verMando(); };
  $('#ck-si').addEventListener('click', () => cerrarCk('si'));
  $('#ck-no').addEventListener('click', () => cerrarCk('no'));
  $('#abrir-cookies').addEventListener('click', () => { ck.hidden = false; verMando(); $('#ck-si').focus(); });
  if (!leer()) ck.hidden = false;

  /* ============ 10. mapa de Google solo al pedirlo (sin clave de API) ============ */
  const mapaBtn = $('#mapa-btn');
  if (mapaBtn) mapaBtn.addEventListener('click', () => {
    const marco = document.createElement('iframe');
    const q = $('#mapa').dataset.q;
    marco.src = 'https://www.google.com/maps?q=' + encodeURIComponent(q) + '&z=13&output=embed';
    marco.loading = 'lazy';
    marco.title = 'Mapa con Penlés (Cangas del Narcea) y los apartamentos';
    marco.referrerPolicy = 'no-referrer-when-downgrade';
    $('#mapa').appendChild(marco);
    mapaBtn.remove();
  });

  /* ============ 11. el foco del teclado: un mojón (arriba redondo, abajo recto) sobre la línea de suelo ============ */
  const marco = $('#foco-mojon');
  const marcoPath = marco && $('.foco-mojon__marco', marco);
  const sueloPath = marco && $('.foco-mojon__suelo', marco);
  if (marco) raiz.classList.add('foco-propio');
  let enfocado = null;
  function ponerMarco() {
    if (!marco) return;
    const el = enfocado;
    if (!el || !document.contains(el)) { marco.classList.remove('es-visible'); return; }
    const r = el.getBoundingClientRect();
    if (!r.width) { marco.classList.remove('es-visible'); return; }
    let fijo = false;                       // dentro de algo fijo (cabecera, menú, aviso de cookies…)
    for (let e = el; e && e !== document.body; e = e.parentElement) if (getComputedStyle(e).position === 'fixed') { fijo = true; break; }
    const m = 5, w = Math.round(r.width + 2 * m), h = Math.round(r.height + 2 * m);
    const rad = Math.min(15, h / 2, w / 2);
    marco.classList.toggle('es-fijo', fijo);
    marco.style.left = (r.left - m + (fijo ? 0 : scrollX)) + 'px';
    marco.style.top = (r.top - m + (fijo ? 0 : scrollY)) + 'px';
    marco.style.width = w + 'px'; marco.style.height = h + 'px';
    marco.setAttribute('viewBox', `0 0 ${w} ${h}`);
    // el mojón: los dos lados y el arco de arriba; abajo, la línea de suelo, que sobresale y ondula un poco
    marcoPath.setAttribute('d', `M1 ${h - 1}V${rad}A${rad - 1} ${rad - 1} 0 0 1 ${rad} 1H${w - rad}A${rad - 1} ${rad - 1} 0 0 1 ${w - 1} ${rad}V${h - 1}`);
    const s = Math.min(12, Math.max(6, w * 0.12));
    sueloPath.setAttribute('d', `M${-s} ${h}Q${w * 0.25} ${h - 2.5} ${w * 0.5} ${h - 1}T${w + s} ${h - 1}`);
    const oscuro = el.closest('#lugar, .cookies, .visita__antes');
    marco.style.color = oscuro ? '#F0A256' : '';
    marco.classList.add('es-visible');
  }
  let tFoco = 0;
  const mirarFoco = () => {
    clearTimeout(tFoco);
    tFoco = setTimeout(() => {
      const el = document.activeElement;
      let visible = false;
      try { visible = !!el && el !== document.body && el.matches(':focus-visible') && !el.closest('dialog'); } catch (er) { /* navegador viejo */ }
      enfocado = visible ? el : null;
      ponerMarco();
    }, 0);
  };
  document.addEventListener('focusin', mirarFoco);
  document.addEventListener('focusout', mirarFoco);

  /* ============ con el scroll (un rAF por fotograma, pasivo) ============ */
  let pend = 0;
  function alScroll() {
    pend = 0;
    pintarCabecera();
    reintentar();
    if (enfocado && marco && marco.classList.contains('es-fijo')) ponerMarco();
  }
  addEventListener('scroll', () => { if (!pend) pend = requestAnimationFrame(alScroll); }, { passive: true });
  pintarCabecera();

  /* ============ 12. MANDO DE MAQUETA (no viaja al cliente) ============ */
  const mando = $('#mando');
  if (mando && raiz.classList.contains('revision')) {
    verMando = () => { mando.hidden = !ck.hidden; };
    const botones = $$('button[data-densidad]', mando);
    const pintarMando = () => botones.forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.densidad === 'sobria') === sobria())));
    botones.forEach((b) => b.addEventListener('click', () => {
      const antes = sobria();
      raiz.classList.toggle('densidad-sobria', b.dataset.densidad === 'sobria');
      const u = new URL(location.href);
      if (b.dataset.densidad === 'sobria') u.searchParams.set('densidad', 'sobria'); else u.searchParams.delete('densidad');
      history.replaceState(null, '', u);
      pintarMando();
      if (antes === sobria()) return;
      remontarTodos();
      document.dispatchEvent(new CustomEvent('camin:densidad', { detail: sobria() ? 'sobria' : 'camin' }));
    }));
    pintarMando();
    verMando();
  }
  /* fin del MANDO DE MAQUETA */

  /* ============ 13. resize de verdad (no el de la barra del móvil) ============ */
  let tRes = 0;
  addEventListener('resize', () => {
    if (esBarra()) return;
    clearTimeout(tRes);
    tRes = setTimeout(() => {
      anchoVista = innerWidth; altoVista = innerHeight;
      document.dispatchEvent(new CustomEvent('camin:resize'));
      alScroll();
      ponerMarco();
    }, 200);
  });

  // recargar a media página: se entra arriba (checklist 12)
  addEventListener('pageshow', () => { if (!location.hash && scrollY > 0) scrollTo(0, 0); });

  // lo que pueden usar los módulos y las pruebas
  C.web = { motion, quieto, sobria, irA, montados, get altoVista() { return altoVista; } };
  document.dispatchEvent(new CustomEvent('camin:web'));
})();
