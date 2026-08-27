/**
 * Medición de color para validar paletas. Sin dependencias.
 *
 * Implementa algoritmos publicados, no criterio:
 *  - sRGB → OKLab / OKLCH (Björn Ottosson, 2020)
 *  - Contraste WCAG 2.x
 *  - Simulación de dicromacia por el método de Viénot, Brettel y Mollon (1999),
 *    vía el espacio LMS de Smith-Pokorny
 *
 * La distancia entre colores se mide en OKLab ΔE ×100, que es perceptualmente
 * más fiel que comparar hexadecimales a ojo. El punto es exactamente ése: la
 * accesibilidad de una paleta se calcula, no se opina.
 */

"use strict";

function aRGB(hex) {
  var h = String(hex).trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map(function (c) { return c + c; }).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error("Color inválido: " + hex);
  return [0, 2, 4].map(function (i) { return parseInt(h.slice(i, i + 2), 16) / 255; });
}
function lineal(c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
function aLineal(hex) { return aRGB(hex).map(lineal); }

/** Luminancia relativa WCAG. */
function luminancia(hex) {
  var l = aLineal(hex);
  return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
}

/** Razón de contraste WCAG entre dos colores. 1:1 = idénticos, 21:1 = máximo. */
function contraste(a, b) {
  var x = luminancia(a), y = luminancia(b);
  if (x < y) { var t = x; x = y; y = t; }
  return (x + 0.05) / (y + 0.05);
}

/** OKLab desde sRGB lineal. */
function aOKLab(hex) {
  var v = aLineal(hex), r = v[0], g = v[1], b = v[2];
  var l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  var m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  var s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    L: 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
  };
}

/** OKLCH: L de 0 a 1, C = croma. Por debajo de ~0.1 de croma un tono lee gris. */
function aOKLCH(hex) {
  var o = aOKLab(hex);
  return { L: o.L, C: Math.sqrt(o.a * o.a + o.b * o.b),
           H: (Math.atan2(o.b, o.a) * 180 / Math.PI + 360) % 360 };
}

// Viénot, Brettel y Mollon (1999). LMS de Smith-Pokorny.
var RGB_LMS = [[17.8824, 43.5161, 4.11935],
               [3.45565, 27.1554, 3.86714],
               [0.0299566, 0.184309, 1.46709]];
var LMS_RGB = [[0.080944, -0.130504, 0.116721],
               [-0.0102485, 0.0540194, -0.113615],
               [-0.000365294, -0.00412163, 0.693513]];
var PROYECCION = {
  protan: function (L, M, S) { return [2.02344 * M - 2.52581 * S, M, S]; },
  deutan: function (L, M, S) { return [L, 0.494207 * L + 1.24827 * S, S]; },
  tritan: function (L, M, S) { return [L, M, -0.395913 * L + 0.801109 * M]; }
};

function mult(m, v) {
  return m.map(function (f) { return f[0] * v[0] + f[1] * v[1] + f[2] * v[2]; });
}
function aHex(v) {
  return "#" + v.map(function (c) {
    c = Math.max(0, Math.min(1, c));
    c = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return Math.round(Math.max(0, Math.min(1, c)) * 255)
      .toString(16).padStart(2, "0");
  }).join("");
}

/** Cómo ve este color alguien con protanopia, deuteranopia o tritanopia. */
function simula(hex, tipo) {
  var lms = mult(RGB_LMS, aLineal(hex));
  var p = PROYECCION[tipo](lms[0], lms[1], lms[2]);
  return aHex(mult(LMS_RGB, p));
}

/** Distancia perceptual en OKLab, escalada ×100 como usa la industria. */
function distancia(a, b) {
  var x = aOKLab(a), y = aOKLab(b);
  return Math.sqrt(Math.pow(x.L - y.L, 2) + Math.pow(x.a - y.a, 2) +
                   Math.pow(x.b - y.b, 2)) * 100;
}

/** La peor distancia entre dos colores tal como los vería un dicrómata. */
function distanciaCVD(a, b) {
  return ["protan", "deutan", "tritan"].reduce(function (acc, t) {
    acc[t] = distancia(simula(a, t), simula(b, t));
    return acc;
  }, {});
}

module.exports = { contraste, luminancia, aOKLab, aOKLCH, simula, distancia,
                   distanciaCVD };
