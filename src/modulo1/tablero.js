/**
 * Generador del tablero semanal de Mesa Creativa.
 *
 * DOS CONTRATOS DISTINTOS, y hay que respetar cada uno:
 *
 * 1. El ARCHIVO que se publica con la herramienta Artifact es un **fragmento**:
 *    sin doctype, sin <html>, sin <head>, sin <body>. El visor lo envuelve en su
 *    propio esqueleto. Mandar un documento completo deja el <style> anidado
 *    dentro del body, donde el navegador lo descarta — la página sale sin una
 *    sola línea de CSS. Ocurrió; de ahí esta nota.
 *
 * 2. La auto-publicación de la página (capability `artifact`) sí exige un
 *    documento **completo** que empiece con doctype. Por eso `plantilla.head`
 *    viaja embebido: `documento()` lo usa para reconstruir el archivo entero.
 *
 * Uso:  node tablero.js <resultado.json> <salida.html>
 */

const fs = require("fs");
const path = require("path");

const [, , entrada, salida] = process.argv;
if (!entrada || !salida) {
  console.error("Uso: node tablero.js <resultado.json> <salida.html>");
  process.exit(2);
}

const aqui = __dirname;
const datos = JSON.parse(fs.readFileSync(entrada, "utf8"));
const tema = require("./tema.js").construye(path.resolve(aqui, "..", ".."));
const componentes = fs.readFileSync(path.join(aqui, "tablero_estilos.css"), "utf8");
const css = tema.css + "\n\n" + componentes;
const app = fs.readFileSync(path.join(aqui, "tablero_app.js"), "utf8");

const periodo = (datos.corrida && datos.corrida.rango) || "";

const FUENTES = tema.enlaceFuentes;

const ESTILOS = `<style>\n${css}\n</style>`;

// Cabeza completa: solo la usa documento() al auto-publicar.
const head = [
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width,initial-scale=1">',
  "<title>Mesa Creativa</title>",
  FUENTES,
  ESTILOS,
].join("\n");

const estado = { aprobadas: {}, version: 1, periodo };
const plantilla = { head, app };

const j = (o) => JSON.stringify(o).replace(/<\/script/gi, "<\\/script");

// El archivo: fragmento. El <link> de fuentes y el <style> funcionan en body.
const fragmento = `${FUENTES}
${ESTILOS}
<div id="raiz"></div>
<script id="datos" type="application/json">${j(datos)}</script>
<script id="estado" type="application/json">${j(estado)}</script>
<script id="plantilla" type="application/json">${j(plantilla)}</script>
<script>${app}</script>`;

fs.writeFileSync(salida, fragmento, "utf8");

const kb = (Buffer.byteLength(fragmento, "utf8") / 1024).toFixed(0);
console.log(`Tablero generado: ${salida}`);
console.log(`  periodo ${periodo} · ${(datos.tareas_propuestas || []).length} tareas · ${kb} KB`);
if (/^\s*<!doctype/i.test(fragmento))
  console.error("  ERROR: el archivo empieza con doctype. Debe ser un fragmento.");
