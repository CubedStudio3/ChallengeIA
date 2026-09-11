/**
 * Ensambla el artefacto publicable a partir de fuente.html.
 *
 *   node construye.js            -> solo Tailwind
 *   node construye.js --libs     -> Tailwind + las librerias JS
 *
 * El CSS de Tailwind se inyecta DESPUES del <style> propio de la pagina, a
 * proposito: a igual especificidad gana la regla posterior, asi una utilidad
 * puede corregir una regla de componente sin recurrir a `!`.
 */
"use strict";
const fs = require("fs"), path = require("path");

const conLibs = process.argv.includes("--libs");
const fuente = fs.readFileSync("fuente.html", "utf8");
const css = fs.readFileSync("tailwind.css", "utf8");

const LIBS = [
  ["lucide",   "node_modules/lucide/dist/umd/lucide.min.js"],
  ["gsap",     "node_modules/gsap/dist/gsap.min.js"],
  ["chart.js", "node_modules/chart.js/dist/chart.umd.js"],
  ["alpine",   "node_modules/alpinejs/dist/cdn.min.js"],
];

const marca = "</style>";
const i = fuente.indexOf(marca);
if (i === -1) throw new Error("no se encontro el <style> de la pagina");
const corte = i + marca.length;

let bloque = `
<!-- ────────────────────────────────────────────────────────────────────────
     Tailwind CSS ${require("tailwindcss/package.json").version} — COMPILADO, no CDN.
     Preflight apagado: el CSS de arriba manda, Tailwind solo agrega utilidades.
     Va despues del <style> propio para poder sobrescribir a igual especificidad.
     Para regenerar tras editar el marcado:
       cd diseno && npx tailwindcss -c tailwind.config.js -i entrada.css \\
         -o tailwind.css --minify && node construye.js${conLibs ? " --libs" : ""}
     Al partir una cadena de clases en el JS, cortar SIEMPRE en un espacio.
     ──────────────────────────────────────────────────────────────────────── -->
<style id="tw">${css.trim()}</style>`;

if (conLibs) {
  for (const [nombre, rel] of LIBS) {
    const js = fs.readFileSync(rel, "utf8");
    bloque += `\n<!-- ${nombre} ${require(path.resolve(rel.split("/dist")[0], "package.json")).version} — incrustado (los CDN estan bloqueados por politica de egreso) -->\n<script>${js}</script>`;
  }
  bloque += `\n<script>if(window.lucide&&lucide.createIcons)lucide.createIcons();</script>`;
}

const salida = fuente.slice(0, corte) + bloque + fuente.slice(corte);
const destino = "../ciclo-del-lead.html";
fs.writeFileSync(destino, salida);
const kb = (n) => (n / 1024).toFixed(0) + " KB";
console.log(`escrito ${destino}`);
console.log(`  fuente        ${kb(fuente.length)}`);
console.log(`  tailwind      ${kb(css.length)}`);
console.log(`  total         ${kb(salida.length)}  ${conLibs ? "(con librerias)" : "(solo tailwind)"}`);
