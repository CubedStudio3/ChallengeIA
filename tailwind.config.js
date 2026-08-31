/**
 * Tailwind del tablero.
 *
 * POR QUE SE COMPILA Y NO SE CARGA DEL CDN
 * El visor de artefactos permite el script de cdn.tailwindcss.com, asi que la
 * ruta facil existe. No se usa: el tablero se abre en una reunion, y si ese
 * script no carga — red del cliente, bloqueo corporativo, el CDN caido — la
 * pagina no sale "un poco distinta", sale sin una sola linea de CSS. Compilarlo
 * aqui deja el CSS dentro del archivo y no depende de nadie.
 *
 * COMO SE EXTRAEN LAS CLASES
 * `content` apunta al JS de la app, no a un HTML: el tablero se pinta con
 * innerHTML, asi que las clases viven en literales de cadena. El extractor de
 * Tailwind lee texto plano y las encuentra igual, con UNA condicion que hay que
 * respetar al editar: al partir una cadena larga, cortar SIEMPRE en un espacio.
 * Partir `rounded-` + `2xl` deja esa clase sin generar y el fallo es silencioso.
 */

"use strict";

module.exports = {
  content: [
    "./src/modulo1/tablero_app.js",
    "./src/modulo1/tablero_tailwind.css",
  ],
  // Un solo tema, por peticion del usuario: no se generan variantes `dark:`.
  darkMode: [],
  theme: {
    extend: {
      // Las familias siguen saliendo de config/tema.json a traves de las
      // variables CSS: el equipo de diseno cambia la fuente ahi, no aqui.
      fontFamily: {
        sans: ["var(--fam-cuerpo)"],
        mono: ["var(--fam-datos)"],
      },
      colors: {
        marca: "var(--marca)",
      },
    },
  },
  plugins: [],
};
