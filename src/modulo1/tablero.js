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
 * EL CSS SE COMPILA, NO SE CARGA DE UN CDN.
 * El diseño usa Tailwind, como pidió el usuario. Pero el script de
 * cdn.tailwindcss.com no se usa: el tablero se abre en una reunión, y si ese
 * script no carga la página no sale «un poco distinta», sale sin CSS. Aquí se
 * corre el compilador de Tailwind sobre `tablero_app.js` y el resultado queda
 * dentro del archivo. Si Tailwind no está instalado, esto FALLA con un mensaje
 * claro en vez de generar un tablero sin estilos.
 *
 * Uso:  node tablero.js <resultado.json> <salida.html>
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const [, , entrada, salida] = process.argv;
if (!entrada || !salida) {
  console.error("Uso: node tablero.js <resultado.json> <salida.html>");
  process.exit(2);
}

const aqui = __dirname;
const raizProyecto = path.resolve(aqui, "..", "..");
const datos = JSON.parse(fs.readFileSync(entrada, "utf8"));

// soloClaro: el usuario pidió un tema único (2026-08-28). Ver tema.js.
const tema = require("./tema.js").construye(raizProyecto, { soloClaro: true });

/** Corre el compilador de Tailwind y devuelve el CSS. Falla ruidosamente. */
function compilaTailwind() {
  const entradaCss = path.join(aqui, "tablero_tailwind.css");
  const config = path.join(raizProyecto, "tailwind.config.js");
  const binario = path.join(raizProyecto, "node_modules", ".bin", "tailwindcss");
  if (!fs.existsSync(binario)) {
    console.error(
      "ERROR: falta el compilador de Tailwind.\n" +
      "  El CSS del tablero se compila, no se carga de un CDN.\n" +
      "  Instalarlo con:  npm install\n" +
      "  Generar un tablero sin CSS sería peor que no generarlo.");
    process.exit(3);
  }
  const destino = path.join(aqui, ".tailwind.salida.css");
  try {
    execFileSync(binario, ["-c", config, "-i", entradaCss, "-o", destino,
                           "--minify"],
                 { cwd: raizProyecto, stdio: ["ignore", "ignore", "pipe"] });
    return fs.readFileSync(destino, "utf8");
  } finally {
    if (fs.existsSync(destino)) fs.unlinkSync(destino);
  }
}

const css = tema.css + "\n" + compilaTailwind();
const app = fs.readFileSync(path.join(aqui, "tablero_app.js"), "utf8");

/* El logo viaja DENTRO de los datos, ya incrustado como data URI: el visor de
   artefactos bloquea las imagenes externas, asi que un enlace no cargaria nunca.
   Si tema.json no declara archivo, esto es null y el tablero dibuja su
   monograma. */
datos.logo = tema.logo;

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

const estado = { aprobadas: {}, decisiones: {}, propias: {}, estrategia: null,
                 version: 1, periodo };
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
const nTareas = ((datos.estrategia || {}).tareas || []).length;
console.log(`  periodo ${periodo} · ${nTareas} tareas · ${kb} KB`);
console.log(`  CSS compilado: ${(css.length / 1024).toFixed(0)} KB`);
console.log(tema.logo
  ? `  Logo incrustado: ${tema.logo.kb} KB`
  : "  Logo: sin archivo en config/tema.json, se dibuja el monograma MC");
if (/^\s*<!doctype/i.test(fragmento))
  console.error("  ERROR: el archivo empieza con doctype. Debe ser un fragmento.");
