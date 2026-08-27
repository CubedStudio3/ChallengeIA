/**
 * Generador del tablero semanal de Mesa Creativa.
 *
 * Toma el resultado.json de una corrida y emite el HTML del artefacto. La
 * página resultante puede publicar versiones de sí misma, así que las
 * aprobaciones del equipo persisten y se comparten entre quienes la abren.
 *
 * Para que eso funcione, la página lleva su propia plantilla embebida como
 * datos: `head` y `app` viajan en un bloque JSON aparte. Así `documento()`
 * puede reconstruir el archivo completo sin serializar el DOM vivo y sin
 * recursión infinita — el bloque de plantilla no se contiene a sí mismo.
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
const css = fs.readFileSync(path.join(aqui, "tablero_estilos.css"), "utf8");
const app = fs.readFileSync(path.join(aqui, "tablero_app.js"), "utf8");

const periodo = (datos.corrida && datos.corrida.rango) || "";
const titulo = "Mesa Creativa";

const head = [
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width,initial-scale=1">',
  `<title>${titulo}</title>`,
  '<link rel="preconnect" href="https://fonts.googleapis.com">',
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?' +
    'family=Fraunces:opsz,wght@9..144,400..700&' +
    'family=Public+Sans:wght@400;600;700&' +
    'family=IBM+Plex+Mono:wght@400;600&display=swap">',
  `<style>\n${css}\n</style>`,
].join("\n");

// El estado arranca vacío: nadie ha aprobado nada todavía.
const estado = { aprobadas: {}, version: 1, periodo };

const plantilla = { head, app };

const j = (o) => JSON.stringify(o).replace(/<\/script/gi, "<\\/script");

const html = `<!doctype html>
<html lang="es">
<head>
${head}
</head>
<body>
<script id="datos" type="application/json">${j(datos)}</script>
<script id="estado" type="application/json">${j(estado)}</script>
<script id="plantilla" type="application/json">${j(plantilla)}</script>
<script>${app}</script>
</body>
</html>`;

fs.writeFileSync(salida, html, "utf8");

const kb = (Buffer.byteLength(html, "utf8") / 1024).toFixed(0);
const nTareas = (datos.tareas_propuestas || []).length;
console.log(`Tablero generado: ${salida}`);
console.log(`  periodo ${periodo} · ${nTareas} tareas propuestas · ${kb} KB`);
