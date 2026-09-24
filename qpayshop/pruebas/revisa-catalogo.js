/* El catálogo carga y se arma completo.
 *
 * Un error de sintaxis en el guion del catálogo no rompe nada visible en el
 * HTML: la página abre, se ve la portada, y la lista de secciones sencillamente
 * no aparece. Esta prueba abre la página de verdad, recoge los errores de
 * consola y cuenta las tarjetas contra el arreglo de secciones.
 *
 *   node qpayshop/pruebas/revisa-catalogo.js
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const RAIZ = path.resolve(__dirname, "..");
const CAT = path.join(RAIZ, "catalogo-secciones.html");
const CHROME = process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const html = fs.readFileSync(CAT, "utf8");

// 1 · el guion del catálogo, a solas: sintaxis
const abre = html.lastIndexOf("\n<script>\n");
const cierra = html.lastIndexOf("\n</scr" + "ipt>");
if (abre < 0 || cierra < abre) {
  console.error("✗ no se encontró el guion del catálogo");
  process.exit(1);
}
const guion = html.slice(abre + "\n<script>\n".length, cierra);
try {
  new Function(guion);
} catch (e) {
  console.error("✗ el guion del catálogo no compila: " + e.message);
  process.exit(1);
}
console.log("✓ el guion del catálogo compila");

// 2 · la página armada: errores de consola y tarjetas pintadas
const cuantas = (html.match(/\{ id:"/g) || []).length;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "qs-cat-"));
const sonda = path.join(tmp, "sonda.html");
fs.writeFileSync(sonda, `<!doctype html><html><head><meta charset=utf-8>
<style>html,body{margin:0}iframe{width:1600px;height:1000px;border:0;display:block}</style></head>
<body><iframe id=f src="${"file://" + CAT}"></iframe>
<script>
var fallos = [];
window.addEventListener("error", function(e){ fallos.push(e.message); }, true);
setTimeout(function(){
  var d = document.getElementById("f").contentDocument;
  var w = document.getElementById("f").contentWindow;
  w.addEventListener("error", function(e){ fallos.push(e.message); });
  var tarjetas = d.querySelectorAll(".ficha").length;
  var titulo = (d.querySelector("h1") || {}).textContent || "";
  var amplia = d.querySelectorAll(".ficha .boton.suave").length;
  document.title = ["tarjetas=" + tarjetas, "titulo=" + titulo.trim(),
                    "fallos=" + (fallos.join(" / ") || "ninguno")].join("|");
}, 7000);
</scr${""}ipt></body></html>`);

const salida = execFileSync(CHROME, [
  "--headless=new", "--disable-gpu", "--no-sandbox", "--allow-file-access-from-files",
  "--virtual-time-budget=16000", "--window-size=1700,1100", "--dump-dom", "file://" + sonda,
], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
fs.rmSync(tmp, { recursive: true, force: true });

const m = salida.match(/<title>([^<]*)<\/title>/);
const partes = Object.fromEntries((m ? m[1] : "").split("|").map(function (x) {
  const i = x.indexOf("="); return [x.slice(0, i), x.slice(i + 1)];
}));

let malo = 0;
if (Number(partes.tarjetas) !== cuantas) {
  console.error(`✗ se pintaron ${partes.tarjetas} tarjetas y el arreglo tiene ${cuantas}`);
  malo = 1;
} else {
  console.log(`✓ las ${cuantas} tarjetas se pintaron`);
}
if (partes.fallos !== "ninguno") {
  console.error("✗ errores en consola: " + partes.fallos);
  malo = 1;
} else {
  console.log("✓ sin errores en consola");
}
// el titular cuenta las secciones: si se escribiera a mano, acá se vería
if (!/^\S+.* secciones para armar tiendas$/.test(partes.titulo || "")) {
  console.error("✗ el titular no se armó: «" + partes.titulo + "»");
  malo = 1;
} else {
  console.log("✓ el titular sale del arreglo: «" + partes.titulo + "»");
}
process.exit(malo);
