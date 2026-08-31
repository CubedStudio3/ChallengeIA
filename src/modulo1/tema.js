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
  const claro = vars(t.colores_claro, pal, false, ac);
  const oscuro = vars(t.colores_oscuro, pal, true, ac);

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

  return { css, enlaceFuentes };
}

module.exports = { construye };
