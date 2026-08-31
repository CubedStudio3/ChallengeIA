/**
 * Convierte config/tema.json en las variables CSS del tablero.
 *
 * Esto es lo que hace que tema.json sea la única fuente de verdad del diseño:
 * el equipo edita ese archivo y el CSS sale de ahí. No hay colores escritos a
 * mano en dos lugares que se puedan desincronizar.
 */

"use strict";

const fs = require("fs");
const path = require("path");

// Nombre en tema.json → variable CSS que usan los componentes.
const MAPA = {
  texto: "tinta", texto_suave: "tinta-2", texto_tenue: "tinta-3",
  fondo: "ground", superficie: "sup", superficie_2: "sup-2", superficie_3: "sup-3",
  borde: "borde", borde_fuerte: "borde-2",
  lateral: "lateral", lateral_texto: "lateral-tex", lateral_tenue: "lateral-tenue",
  lateral_activo: "lateral-act",
  marca: "marca", marca_oscura: "marca-2", marca_suave: "marca-suave",
  marca_fondo: "marca-fondo", marca_fondo_2: "marca-fondo-2",
  bien: "bien", bien_texto: "bien-tex", bien_suave: "bien-suave",
  falta: "falta", falta_texto: "falta-tex", falta_suave: "falta-suave",
  alerta: "alerta", alerta_texto: "alerta-tex", alerta_suave: "alerta-suave",
  pista: "pista",
  panel_oscuro: "oscuro", panel_oscuro_texto: "oscuro-tex",
};

// Sombras deliberadamente tenues: en este diseno la separacion entre bloques
// la hace el espacio en blanco, no la linea ni la sombra. Una sombra que se
// nota es una sombra que ensucia.
const SOMBRA_CLARA =
  "0 1px 2px rgba(20,19,31,.03), 0 6px 20px -10px rgba(20,19,31,.08)";
const SOMBRA_CLARA_ALTA =
  "0 2px 4px rgba(20,19,31,.04), 0 16px 36px -14px rgba(20,19,31,.16)";
const SOMBRA_OSCURA = "0 1px 2px rgba(0,0,0,.3), 0 6px 20px -10px rgba(0,0,0,.45)";
const SOMBRA_OSCURA_ALTA = "0 2px 4px rgba(0,0,0,.4), 0 18px 40px -12px rgba(0,0,0,.6)";

function vars(cols, paleta, oscuro, acentos) {
  const l = [];
  for (const [k, v] of Object.entries(acentos || {})) {
    if (k.startsWith("_") || !Array.isArray(v)) continue;
    l.push(`  --ac-${k}:${v[oscuro ? 1 : 0]};`);
  }
  for (const [k, v] of Object.entries(MAPA)) {
    if (cols[k]) l.push(`  --${v}:${cols[k]};`);
  }
  const p = Object.keys(paleta).filter((k) => !k.startsWith("_"));
  p.forEach((k, i) => l.push(`  --c${i + 1}:${paleta[k]};`));
  l.push(`  --sombra:${oscuro ? SOMBRA_OSCURA : SOMBRA_CLARA};`);
  l.push(`  --sombra-alta:${oscuro ? SOMBRA_OSCURA_ALTA : SOMBRA_CLARA_ALTA};`);
  return l.join("\n");
}

function pila(fuente, respaldo) {
  return `"${fuente}",${respaldo}`;
}

/**
 * Las variables de la paleta de secciones.
 *
 * Cada seccion del tablero tiene su color de identidad. Se emiten TRES
 * variables por seccion y no una, porque el pastel solo sirve de relleno:
 *
 *   --sec-<id>          el relleno
 *   --sec-<id>-tinta    la tinta que va ENCIMA de ese relleno
 *   --sec-<id>-lavado   el mismo color a baja opacidad sobre blanco
 *
 * El lavado existe para los bloques secundarios: el pastel puro compite con las
 * tarjetas de dato, y bajado sobre blanco se nota sin gritar. Se calcula con
 * color-mix() y lleva respaldo en rgba, porque un navegador sin color-mix()
 * dejaria el bloque transparente en lugar de teñido.
 */
function seccionesVars(bloque) {
  const secs = (bloque && bloque.secciones) || {};
  const l = [];
  if (bloque && bloque.negro) l.push(`  --negro:${bloque.negro};`);
  for (const [id, v] of Object.entries(secs)) {
    if (id.startsWith("_") || !v || !v.relleno) continue;
    l.push(`  --sec-${id}:${v.relleno};`);
    l.push(`  --sec-${id}-tinta:${v.tinta || "#000000"};`);
    // El lavado puede arrancar de OTRO color que el relleno. Lo usa Estrategia,
    // cuyo relleno es negro: un lavado de negro es un gris, y dejaria la seccion
    // que mas se usa sin una gota de color. Ver tema.json.
    const base = v.lavado_base || v.relleno;
    const r = parseInt(base.slice(1, 3), 16);
    const g = parseInt(base.slice(3, 5), 16);
    const b = parseInt(base.slice(5, 7), 16);
    // La proporcion del lavado NO puede ser fija. Un pastel al 38% sobre blanco
    // da un tinte suave; el negro al 38% da un gris oscuro que se traga el
    // texto. Se escala con la luminosidad del relleno: cuanto mas oscuro, menos
    // proporcion. El negro termina en 6%, que es el gris de una tarjeta.
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const mezcla = Math.round(6 + lum * 34);   // negro -> 6%, pastel -> ~38%
    const alfa = (mezcla / 100).toFixed(2);
    // Respaldo primero, color-mix despues: quien entienda las dos usa la segunda.
    l.push(`  --sec-${id}-lavado:rgba(${r},${g},${b},${alfa});`);
    l.push(`  --sec-${id}-lavado:color-mix(in srgb, ${base} ${mezcla}%, #fff);`);
  }
  const pt = (bloque && bloque.pasteles) || {};
  for (const [k, v] of Object.entries(pt)) {
    if (k.startsWith("_")) continue;
    l.push(`  --pastel-${k}:${v};`);
  }
  const tz = (bloque && bloque.trazos) || {};
  // El tono de cada color a peso de linea, para lo que necesite dibujar con el
  // color de la paleta y ser legible: una linea de grafica, un borde, un icono.
  for (const [k, v] of Object.entries(tz)) {
    if (k.startsWith("_")) continue;
    l.push(`  --trazo-${k}:${v};`);
  }
  return l.join("\n");
}

/**
 * El logo del usuario principal, incrustado como data URI.
 *
 * Se incrusta y no se enlaza porque el visor de artefactos bloquea las imagenes
 * externas: un `<img src="config/logo.png">` no cargaria nunca. Si el archivo no
 * existe se devuelve null y el tablero dibuja su monograma — un logo faltante no
 * puede romper la pagina.
 */
const TIPOS_IMAGEN = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml", ".webp": "image/webp",
};

/** Incrusta una imagen como data URI. Devuelve null y AVISA si no se puede. */
function imagen(raiz, rel, quien) {
  const ruta = path.join(raiz, rel);
  if (!fs.existsSync(ruta)) {
    console.error(`  AVISO: ${quien} apunta a ${rel} y ese archivo no existe.`);
    return null;
  }
  const tipo = TIPOS_IMAGEN[path.extname(ruta).toLowerCase()];
  if (!tipo) {
    console.error(`  AVISO: ${rel} no es un formato que el visor acepte ` +
                  `(png, jpg, svg, webp).`);
    return null;
  }
  const datos = fs.readFileSync(ruta).toString("base64");
  return `data:${tipo};base64,${datos}`;
}

function logo(raiz, bloque) {
  if (!bloque || !bloque.archivo) return null;
  const uri = imagen(raiz, bloque.archivo, "tema.json marca_logo");
  if (!uri) {
    console.error("  Se dibuja el monograma «MC» en su lugar.");
    return null;
  }
  return { uri: uri,
           alt: bloque.texto_alternativo || "Logo",
           kb: Math.round(uri.length / 1024) };
}

/**
 * Los logos de las marcas medidas, tambien como data URI.
 *
 * Devuelve un objeto { clave: uri }. Una marca sin archivo simplemente no
 * aparece, y el tablero cae en sus iniciales: es mejor una inicial honesta que
 * un logo generico que haria parecer medida a una marca que no lo esta.
 */
function logosCompetencia(raiz, bloque) {
  if (!bloque || !bloque.archivos) return {};
  const dir = bloque.directorio || "config/logos";
  const salida = {};
  for (const [clave, nombre] of Object.entries(bloque.archivos)) {
    if (clave.startsWith("_")) continue;
    const rel = path.join(dir, nombre);
    const uri = imagen(raiz, rel, `logos_competencia.${clave}`);
    if (uri) salida[clave] = uri;
  }
  return salida;
}

/**
 * Devuelve { css, enlaceFuentes } listos para inyectar.
 *
 * `opciones.soloClaro` emite UNICAMENTE el bloque de modo claro y fija
 * color-scheme:light. El tablero lo usa porque el usuario pidio un solo tema
 * (2026-08-28): asi la pagina se ve igual sin importar si quien la abre tiene
 * el sistema en oscuro. Sin esa fijacion, los <select> y los <input> los
 * pintaria el navegador en oscuro sobre tarjetas blancas.
 */
function construye(raiz, opciones) {
  const soloClaro = !!(opciones && opciones.soloClaro);
  const t = JSON.parse(
    fs.readFileSync(path.join(raiz, "config", "tema.json"), "utf8"));
  const f = t.tipografia, forma = t.forma, pal = t.paleta_graficos;

  const base = [
    `  --fam-titulo:${pila(f.titulos, f._respaldo_titulos)};`,
    `  --fam-cuerpo:${pila(f.cuerpo, f._respaldo_cuerpo)};`,
    `  --fam-datos:${pila(f.datos, f._respaldo_datos)};`,
    `  --r:${forma.radio_grande}px;`,
    `  --r-s:${forma.radio_medio}px;`,
    `  --r-xs:${forma.radio_chico}px;`,
    `  --lateral-w:${forma.ancho_lateral}px;`,
  ].join("\n");

  const ac = t.acentos_suaves || {};
  const secs = seccionesVars(t.paleta_secciones);
  const claro = vars(t.colores_claro, pal, false, ac) + (secs ? "\n" + secs : "");
  const oscuro = vars(t.colores_oscuro, pal, true, ac) + (secs ? "\n" + secs : "");

  const cabecera = `/* GENERADO desde config/tema.json — no editar aquí.
   Para cambiar el diseño: editar config/tema.json y correr
   node src/modulo1/valida_tema.js antes de generar. */`;

  const css = soloClaro
    ? `${cabecera}
:root{
  color-scheme:light;
${base}
${claro}
}`
    : `${cabecera}
:root{
${base}
${claro}
}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){
${oscuro.split("\n").map((s) => "  " + s).join("\n")}
  }
}
:root[data-theme="dark"]{
${oscuro}
}`;

  // Solo Google Fonts: es el único host que permite el visor.
  const familias = [...new Set([f.titulos, f.cuerpo, f.datos])];
  const pesos = (f.pesos_a_cargar || [400, 700]).join(";");
  const enlaceFuentes =
    '<link rel="preconnect" href="https://fonts.googleapis.com">\n' +
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?' +
    familias.map((n) => "family=" + n.replace(/\s+/g, "+") +
      ":wght@" + pesos).join("&") + '&display=swap">';

  return { css, enlaceFuentes, logo: logo(raiz, t.marca_logo),
           logosCompetencia: logosCompetencia(raiz, t.logos_competencia) };
}

module.exports = { construye };
