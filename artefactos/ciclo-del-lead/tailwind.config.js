/**
 * Tailwind del artefacto «Ciclo del Lead».
 *
 * POR QUE SE COMPILA Y NO SE CARGA DEL CDN
 * Misma razon que el tablero (ver tailwind.config.js del repo): el visor
 * permite cdn.tailwindcss.com, pero si ese script no carga la pagina no sale
 * "un poco distinta", sale sin CSS. Ademas este entorno tiene ese dominio
 * bloqueado por politica de egreso, asi que el CDN seria ademas no verificable.
 *
 * SOLO MODO CLARO (decision de Mercadeo, 2026-09-11)
 * No se configura `darkMode` ni se genera la variante `dark:`. La pagina se
 * compromete con un solo mundo visual y pinta todos sus colores explicitos,
 * para no heredar el fondo del visor.
 *
 * PREFLIGHT APAGADO, A PROPOSITO
 * La pagina ya trae su propio CSS completo. El reset de Tailwind le quitaria
 * tamanos a los titulos, vinetas a las listas y bordes a las tablas.
 *
 * COMO SE EXTRAEN LAS CLASES
 * `content` apunta a fuente.html, que incluye el JS inline: la pagina se pinta
 * con innerHTML y las clases viven en literales de cadena. El extractor lee
 * texto plano y las encuentra, con UNA condicion al editar: al partir una
 * cadena larga, cortar SIEMPRE en un espacio. Partir 'rounded-' + '2xl' deja
 * esa clase sin generar y el fallo es silencioso.
 */

"use strict";

// El tema vive en variables CSS. Mapearlas aqui deja que las utilidades y el
// CSS propio hablen el mismo idioma: `bg-salvia` es el mismo verde que
// `var(--salvia)`, y cambiar el tono se hace en un solo lugar.
const v = (n) => `var(--${n})`;

module.exports = {
  content: ["./fuente.html"],

  theme: {
    extend: {
      colors: {
        // superficies y tinta
        plano: v("plano"), sup: v("sup"), sup2: v("sup2"),
        linea: v("linea"), linea2: v("linea2"),
        tinta: v("tinta"), tinta2: v("tinta2"), tinta3: v("tinta3"),
        // los tres pasteles del equipo · SUPERFICIE, nunca marca fina
        salvia: v("salvia"), rosa: v("rosa"), cielo: v("cielo"),
        // marcas de dato · categoricas, validadas 5/5
        mercadeo: v("mercadeo"), producto: v("producto"), ventas: v("ventas"),
        cuarto: v("cuarto"), abierto: v("abierto"),
        // embudo · secuencial de un solo tono
        e1: v("e1"), e2: v("e2"), e3: v("e3"), e4: v("e4"), e5: v("e5"),
        // estado · reservado
        alerta: v("alerta"), "alerta-fondo": v("alerta-fondo"),
      },
      fontFamily: {
        titulo: ["Outfit", '"IBM Plex Sans"', "system-ui", "sans-serif"],
        sans: ['"IBM Plex Sans"', "system-ui", "-apple-system", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "Menlo", "monospace"],
      },
      borderRadius: { panel: "30px", tarjeta: "18px", chico: "12px" },
      boxShadow: { sombra: v("sombra"), alta: v("sombra-alta") },
      borderColor: { DEFAULT: v("linea") },
    },
  },

  // Juego de utilidades disponible SIN recompilar, para que la hoja sea
  // autosuficiente: quien edite la pagina puede escribir una clase y que
  // exista, como con el CDN pero sin depender de la red. Lo que se salga de
  // este juego se genera al recompilar.
  safelist: [
    { pattern: /^(p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml)-(0|px|0\.5|1|1\.5|2|2\.5|3|3\.5|4|5|6|7|8|9|10|11|12|14|16|20|24|28|32|auto)$/, variants: ["sm","md","lg"] },
    { pattern: /^(gap|gap-x|gap-y|space-x|space-y)-(0|px|1|1\.5|2|2\.5|3|3\.5|4|5|6|7|8|10|12|14|16)$/, variants: ["sm","md","lg"] },
    { pattern: /^(w|h)-(0|px|1|2|3|4|5|6|8|10|12|16|20|24|32|40|48|56|64|72|80|96|auto|full|screen|min|max|fit|1\/2|1\/3|2\/3|1\/4|3\/4)$/, variants: ["sm","md","lg"] },
    { pattern: /^(min-w|max-w|min-h|max-h)-(0|full|screen|min|max|fit|xs|sm|md|lg|xl|2xl|3xl|4xl|5xl|6xl|prose|none)$/, variants: ["sm","md","lg"] },
    { pattern: /^text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|left|center|right|justify|balance|pretty|nowrap|wrap|ellipsis|clip|uppercase|lowercase|capitalize|normal-case)$/, variants: ["sm","md","lg"] },
    { pattern: /^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black|sans|mono|titulo)$/ },
    { pattern: /^(leading|tracking)-(none|tight|snug|normal|relaxed|loose|tighter|wide|wider|widest|3|4|5|6|7|8|9|10)$/ },
    { pattern: /^(bg|text|border|ring|fill|stroke|decoration|divide|outline|accent|caret)-(plano|sup|sup2|linea|linea2|tinta|tinta2|tinta3|salvia|rosa|cielo|mercadeo|producto|ventas|cuarto|abierto|e1|e2|e3|e4|e5|alerta|alerta-fondo|transparent|current|inherit|white|black)$/, variants: ["hover","focus","sm","md","lg"] },
    { pattern: /^(flex|inline-flex|grid|inline-grid|block|inline-block|inline|hidden|contents|table|flow-root)$/, variants: ["sm","md","lg"] },
    { pattern: /^(flex)-(row|row-reverse|col|col-reverse|wrap|wrap-reverse|nowrap|1|auto|initial|none)$/, variants: ["sm","md","lg"] },
    { pattern: /^(items|justify|content|self|justify-items|justify-self|place-items|place-content)-(start|end|center|between|around|evenly|stretch|baseline|auto|normal)$/, variants: ["sm","md","lg"] },
    { pattern: /^(grid-cols|grid-rows)-(1|2|3|4|5|6|7|8|9|10|11|12|none)$/, variants: ["sm","md","lg"] },
    { pattern: /^(col|row)-(span|start|end)-(1|2|3|4|5|6|7|8|9|10|11|12|full|auto)$/, variants: ["sm","md","lg"] },
    { pattern: /^order-(1|2|3|4|5|6|7|8|9|10|11|12|first|last|none)$/, variants: ["sm","md","lg"] },
    { pattern: /^(static|fixed|absolute|relative|sticky)$/, variants: ["sm","md","lg"] },
    { pattern: /^(top|right|bottom|left|inset|inset-x|inset-y)-(0|px|1|2|3|4|5|6|8|10|12|16|20|24|auto|full|1\/2)$/ },
    { pattern: /^z-(0|10|20|30|40|50|auto)$/ },
    { pattern: /^rounded(-(none|sm|md|lg|xl|2xl|3xl|full|panel|tarjeta|chico))?(-(t|r|b|l|tl|tr|br|bl))?$/ },
    { pattern: /^rounded-(t|r|b|l|tl|tr|br|bl)-(none|sm|md|lg|xl|2xl|3xl|full|panel|tarjeta|chico)$/ },
    { pattern: /^border(-(0|2|4|8|x|y|t|r|b|l))?$/ },
    { pattern: /^border-(x|y|t|r|b|l)-(0|2|4|8)$/ },
    { pattern: /^border-(solid|dashed|dotted|double|none)$/ },
    { pattern: /^shadow(-(sm|md|lg|xl|2xl|inner|none|sombra|alta))?$/, variants: ["hover"] },
    { pattern: /^opacity-(0|5|10|20|25|30|40|50|60|70|75|80|90|95|100)$/, variants: ["hover"] },
    { pattern: /^(overflow|overflow-x|overflow-y)-(auto|hidden|clip|visible|scroll)$/ },
    { pattern: /^cursor-(pointer|default|not-allowed|text|move|grab|wait|help)$/ },
    { pattern: /^transition(-(all|colors|opacity|transform|none))?$/ },
    { pattern: /^duration-(75|100|150|200|300|500|700|1000)$/ },
    { pattern: /^ease-(linear|in|out|in-out)$/ },
    { pattern: /^(scale|rotate|translate-x|translate-y)-(0|1|2|3|6|12|45|50|75|90|95|100|105|110|125|150|180)$/, variants: ["hover"] },
    { pattern: /^(select|pointer-events|whitespace|break|truncate|align|list|object|aspect)-/ },
    "truncate", "sr-only", "not-sr-only", "antialiased", "isolate", "container",
  ],

  corePlugins: { preflight: false },
};
