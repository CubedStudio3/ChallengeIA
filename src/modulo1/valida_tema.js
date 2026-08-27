/**
 * Validador del tema del tablero. PARA EL EQUIPO DE DISEÑO.
 *
 *   node src/modulo1/valida_tema.js
 *
 * Lee config/tema.json y comprueba que los colores elegidos sean legibles.
 * No opina de estética: mide. Si algo falla, dice exactamente qué par de
 * colores y qué valor hace falta.
 *
 * ALCANCE, dicho con precisión:
 *  - Sí mide: contraste WCAG, banda de luminosidad, piso de croma, distancia
 *    perceptual en visión normal, y separación bajo protanopia y deuteranopia.
 *  - NO mide tritanopia. El método de Viénot que usa este validador es
 *    conocidamente poco fiable para ese caso, y preferimos no reportar un
 *    número que no podemos verificar. La protanopia y la deuteranopia cubren
 *    la enorme mayoría de las deficiencias de visión al color; la tritanopia
 *    es muy poco frecuente. Si hace falta cubrirla, hay que usar una
 *    herramienta con el método de Brettel de dos semiplanos.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const C = require("../base/color.js");

const RAIZ = path.resolve(__dirname, "..", "..");
const tema = JSON.parse(fs.readFileSync(path.join(RAIZ, "config", "tema.json"), "utf8"));

// Umbrales. Los de contraste son WCAG; los de color vienen de la práctica de
// visualización de datos.
const U = {
  textoNormal: 4.5,     // WCAG AA para texto de tamaño normal
  textoGrande: 3.0,     // WCAG AA para texto grande y componentes de interfaz
  marcaFondo: 3.0,      // una barra o segmento contra su fondo
  cromaPiso: 0.10,      // por debajo, un tono lee gris
  visionNormal: 15.0,   // dos series adyacentes deben distinguirse a simple vista
  cvdPiso: 6.0,         // mínimo bajo daltonismo; de 6 a 8 exige etiqueta directa
  cvdBueno: 8.0,
};

let fallas = 0, avisos = 0;
const linea = "─".repeat(74);

function estado(ok, aviso) {
  if (ok) return "\x1b[32mBIEN\x1b[0m";
  if (aviso) { avisos++; return "\x1b[33mAVISO\x1b[0m"; }
  fallas++; return "\x1b[31mFALLA\x1b[0m";
}

function chequeaTexto(modo, cols) {
  console.log(`\n${modo.toUpperCase()} · legibilidad del texto\n${linea}`);
  const pares = [
    ["texto sobre superficie", cols.texto, cols.superficie, U.textoNormal],
    ["texto sobre fondo", cols.texto, cols.fondo, U.textoNormal],
    ["texto_suave sobre superficie", cols.texto_suave, cols.superficie, U.textoNormal],
    ["texto_tenue sobre superficie", cols.texto_tenue, cols.superficie, U.textoGrande],
    ["lateral_texto sobre lateral", cols.lateral_texto, cols.lateral, U.textoNormal],
    ["lateral_tenue sobre lateral", cols.lateral_tenue, cols.lateral, U.textoNormal],
    ["blanco sobre marca_fondo", "#FFFFFF", cols.marca_fondo, U.textoNormal],
    ["blanco sobre marca_fondo_2", "#FFFFFF", cols.marca_fondo_2, U.textoNormal],
    ["marca_fondo contra superficie", cols.marca_fondo, cols.superficie, U.marcaFondo],
    ["marca como texto sobre superficie", cols.marca, cols.superficie, U.textoGrande],
    ["bien_texto sobre bien_suave", cols.bien_texto, cols.bien_suave, U.textoNormal],
    ["falta_texto sobre falta_suave", cols.falta_texto, cols.falta_suave, U.textoNormal],
    ["alerta_texto sobre alerta_suave", cols.alerta_texto, cols.alerta_suave, U.textoNormal],
    ["borde sobre superficie", cols.borde, cols.superficie, 1.2],
  ];
  for (const [n, a, b, min] of pares) {
    const r = C.contraste(a, b);
    console.log(`  ${estado(r >= min)}  ${n.padEnd(32)} ${r.toFixed(2).padStart(6)}:1` +
      `  (mínimo ${min})`);
    if (r < min) console.log(`         ${a} sobre ${b} — necesita ${min}:1`);
  }
}

function chequeaPaleta(modo, superficie) {
  const p = tema.paleta_graficos;
  const hex = Object.keys(p).filter(k => !k.startsWith("_")).map(k => p[k]);
  console.log(`\n${modo.toUpperCase()} · paleta de gráficos (${hex.length} series)\n${linea}`);

  const banda = modo === "claro" ? [0.43, 0.77] : [0.42, 0.72];
  for (const h of hex) {
    const o = C.aOKLCH(h);
    const dentro = o.L >= banda[0] && o.L <= banda[1];
    console.log(`  ${estado(dentro)}  ${h}  luminosidad ${o.L.toFixed(3)}` +
      `  (banda ${banda[0]}–${banda[1]})`);
    console.log(`  ${estado(o.C >= U.cromaPiso)}  ${h}  croma ${o.C.toFixed(3)}` +
      `  (piso ${U.cromaPiso}${o.C < U.cromaPiso ? " — este tono lee GRIS" : ""})`);
    const r = C.contraste(h, superficie);
    console.log(`  ${estado(r >= U.marcaFondo)}  ${h}  contra la superficie ` +
      `${r.toFixed(2)}:1  (mínimo ${U.marcaFondo})`);
  }

  console.log(`\n  Separación entre series adyacentes:`);
  for (let i = 0; i < hex.length - 1; i++) {
    const a = hex[i], b = hex[i + 1];
    const dn = C.distancia(a, b);
    const cvd = C.distanciaCVD(a, b);
    const peor = Math.min(cvd.protan, cvd.deutan);
    console.log(`  ${estado(dn >= U.visionNormal)}  ${a} vs ${b}  visión normal ` +
      `ΔE ${dn.toFixed(1)}  (piso ${U.visionNormal})`);
    console.log(`  ${estado(peor >= U.cvdBueno, peor >= U.cvdPiso)}  ${a} vs ${b}  ` +
      `daltonismo ΔE ${peor.toFixed(1)}  (protan ${cvd.protan.toFixed(1)}, ` +
      `deutan ${cvd.deutan.toFixed(1)})`);
    if (peor < U.cvdBueno && peor >= U.cvdPiso)
      console.log(`         Aceptable SOLO porque el tablero pone etiquetas ` +
        `directas y separación entre segmentos. No quitar esas etiquetas.`);
    if (peor < U.cvdPiso)
      console.log(`         Demasiado parecidos: alguien con daltonismo no los ` +
        `va a distinguir. Cambiar uno de los dos.`);
  }
}

console.log(`\n${"═".repeat(74)}\nVALIDACIÓN DEL TEMA · config/tema.json\n${"═".repeat(74)}`);
console.log("No mide estética. Mide si alguien puede leer lo que diseñaste.");

chequeaTexto("claro", tema.colores_claro);
chequeaPaleta("claro", tema.colores_claro.superficie);
chequeaTexto("oscuro", tema.colores_oscuro);
chequeaPaleta("oscuro", tema.colores_oscuro.superficie);

console.log(`\n${linea}`);
console.log("  No se mide tritanopia: el método disponible aquí no es fiable para");
console.log("  ese caso y preferimos no dar un número que no podemos verificar.");
console.log(linea);
if (fallas) {
  console.log(`\n\x1b[31m${fallas} FALLA(S)\x1b[0m` +
    (avisos ? ` y ${avisos} aviso(s)` : "") +
    ". Hay que corregirlas antes de generar el tablero.\n");
  process.exit(1);
}
console.log(`\n\x1b[32mTODO BIEN\x1b[0m` + (avisos ? ` · ${avisos} aviso(s)` : "") +
  ". El tema es legible. Ya puedes generar el tablero.\n");
