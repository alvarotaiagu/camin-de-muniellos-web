// Contraste de las parejas de color de css/base.css: WCAG 2 para el mínimo y APCA para ELEGIR el texto sobre el ocre
// (WCAG 2 sobrevalora el texto oscuro sobre naranjas de luz media).   node scripts/paleta.mjs  → sale con 1 si algo no llega
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = fs.readFileSync(path.join(RAIZ, 'css/base.css'), 'utf8');
function bloque(selector) {
  const i = css.indexOf(selector + ' {');
  if (i < 0) throw new Error('falta ' + selector);
  const v = {};
  for (const m of css.slice(css.indexOf('{', i) + 1, css.indexOf('}', i)).matchAll(/--([\w-]+):\s*(#[0-9A-Fa-f]{6})/g)) v[m[1]] = m[2];
  return v;
}
const canal = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const lum = (hex) => { const c = canal(hex).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
export const contraste = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
// APCA 0.0.98G-4g (Lc; negativo = texto claro sobre fondo oscuro)
export function apca(texto, fondo) {
  const Y = (hex) => { const [r, g, b] = canal(hex).map((x) => x ** 2.4); let y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b; return y < 0.022 ? y + (0.022 - y) ** 1.414 : y; };
  const t = Y(texto), f = Y(fondo);
  if (Math.abs(f - t) < 0.0005) return 0;
  const lc = f > t ? (f ** 0.56 - t ** 0.57) * 1.14 : (f ** 0.65 - t ** 0.62) * 1.14;
  return Math.abs(lc) < 0.1 ? 0 : (lc > 0 ? lc - 0.027 : lc + 0.027) * 100;
}

const R = bloque(':root'), L = { ...R, ...bloque('#lugar') };
const filas = [];
const par = (v, a, b, min, que, donde) => filas.push([donde, a, b, v[a], v[b], min, que]);
for (const f of ['fondo', 'fondo-2', 'superficie']) {
  par(R, 'texto', f, 7, 'texto', 'claro'); par(R, 'texto-suave', f, 4.5, 'texto secundario', 'claro'); par(R, 'acento-texto', f, 4.5, 'enlaces', 'claro'); par(R, 'foco', f, 3, 'foco', 'claro');
}
par(R, 'sobre-acento', 'acento', 4.5, 'botón principal', 'claro'); par(R, 'sobre-acento', 'acento-fuerte', 4.5, 'botón al pasar', 'claro');
par(R, 'marca', 'fondo', 3, 'línea del roble y del camín (no es texto)', 'claro'); par(R, 'marca', 'fondo-2', 3, 'línea sobre el tramo alterno', 'claro');
par(R, 'fondo', 'texto', 7, 'mandos pulsados y aviso de cookies', 'claro');
for (const f of ['fondo', 'superficie']) { par(L, 'texto', f, 7, 'texto', '#lugar'); par(L, 'texto-suave', f, 4.5, 'secundario', '#lugar'); par(L, 'acento-texto', f, 4.5, 'enlaces', '#lugar'); }
par(L, 'marca', 'fondo', 3, 'línea', '#lugar'); par(L, 'sobre-acento', 'acento', 4.5, 'botón', '#lugar');
let mal = 0;
for (const [donde, a, b, ca, cb, min, que] of filas) {
  if (!ca || !cb) { console.log(`  falta --${a} o --${b}`); mal++; continue; }
  const c = contraste(ca, cb), ok = c >= min; if (!ok) mal++;
  console.log(`  ${ok ? 'ok ' : 'MAL'} ${c.toFixed(2).padStart(6)} ≥ ${min}  ${donde.padEnd(7)} --${a} sobre --${b}  (${que})  APCA Lc ${apca(ca, cb).toFixed(0)}`);
}
console.log(`\nTexto sobre el botón (${R.acento}): blanco Lc ${apca('#FFFFFF', R.acento).toFixed(0)} · tinta ${R.texto} Lc ${apca(R.texto, R.acento).toFixed(0)} → se elige el de mayor |Lc|`);
console.log(`Sobre el ocre del logo sin oscurecer (${R.marca}): blanco ${contraste('#FFFFFF', R.marca).toFixed(2)}:1 (no llega a 4,5: por eso el botón usa --acento)`);
// los colores de los apartamentos: el texto va en tinta sobre un tinte al 15-24 %; aquí, lo más desfavorable (24 %)
const mezcla = (a, b, t) => '#' + canal(a).map((x, i) => Math.round((x * t + canal(b)[i] * (1 - t)) * 255).toString(16).padStart(2, '0')).join('');
for (const k of ['carujo', 'fonrin', 'xelin']) {
  const f = mezcla(R[k], R.superficie, 0.24), c = contraste(R.texto, f), c2 = contraste(R['texto-suave'], f);
  if (c < 7 || c2 < 4.5) mal++;
  console.log(`  ${c >= 7 && c2 >= 4.5 ? 'ok ' : 'MAL'} ${k}: tinta ${c.toFixed(2)} y secundario ${c2.toFixed(2)} sobre su tinte al 24 % (${f})`);
}
console.log(mal ? `\n${mal} parejas por debajo` : '\nTodas las parejas llegan a su mínimo');
process.exitCode = mal ? 1 : 0;
