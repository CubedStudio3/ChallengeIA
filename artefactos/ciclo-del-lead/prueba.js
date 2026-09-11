/**
 * Prueba del artefacto «Ciclo del Lead».
 *
 * Ya NO compara pixel a pixel contra la version anterior: el diseño cambió a
 * propósito el 2026-09-11, así que ese esperado caducó. Lo que se comprueba
 * ahora es lo que puede romperse en silencio:
 *
 *  1. Que cargue sin errores de consola en 1440 / 834 / 390.
 *  2. Que el cuerpo NO tenga scroll horizontal en ningún ancho.
 *  3. Que sea SOLO MODO CLARO: la página se pinta igual con el visor en
 *     oscuro que en claro. Si algún día se cuela una regla de modo oscuro,
 *     esta comprobación se pone roja.
 *  4. Que la interfaz nueva esté: riel con sus 9 secciones e iconos en los KPI.
 *  5. Que Tailwind siga operativo y sin la variante `dark:`.
 *  6. Que el texto de los tramos apilados tenga contraste suficiente sobre
 *     su relleno (los pasteles del equipo solo sirven con tinta encima).
 *
 * Deja capturas en salida/ para mirarlas.
 */
"use strict";
const fs = require("fs");
const { chromium } = require("playwright");

const envuelve = (cuerpo) => `<!doctype html><html><head><meta charset=utf8>`
  + `<meta name=viewport content="width=device-width,initial-scale=1"><style>`
  + `:root{color-scheme:light}body{margin:0;padding:0;font:14px -apple-system,`
  + `BlinkMacSystemFont,sans-serif;background:#faf9f5;color:#141413}`
  + `img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}`
  + `</style></head><body>\n${cuerpo}\n</body></html>`;

const SALIDA = "salida";
fs.mkdirSync(SALIDA, { recursive: true });
fs.writeFileSync(`${SALIDA}/pagina.html`,
  envuelve(fs.readFileSync(`${SALIDA}/ciclo-del-lead.html`, "utf8")));
const PAGINA = "file://" + require("path").resolve(`${SALIDA}/pagina.html`);

let fallos = 0;
const ok = (c, m) => { console.log(`  ${c ? "OK  " : "FALLA"} ${m}`); if (!c) fallos++; };

const contraste = (a, b) => {
  const lum = (s) => {
    const [r, g, bl] = s.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map((x) => {
      const v = x / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

(async () => {
  const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

  const capturas = {};
  for (const ancho of [1440, 834, 390]) {
    const ctx = await nav.newContext({ viewport: { width: ancho, height: 900 }, colorScheme: "light" });
    const pg = await ctx.newPage();
    // Los CDN y Google Fonts estan bloqueados por la politica de egreso de
    // ESTE entorno, no por la pagina: en el visor si cargan. Se separan para
    // no dar por rota la pagina por una condicion del sandbox — pero se
    // reportan, porque callarlos escondería un fallo de verdad.
    const HOSTS_BLOQUEADOS = ["fonts.googleapis.com", "fonts.gstatic.com"];
    const errores = [], bloqueados = new Set();
    pg.on("requestfailed", (r) => {
      const h = new URL(r.url()).host;
      HOSTS_BLOQUEADOS.includes(h) ? bloqueados.add(h) : errores.push("request: " + r.url());
    });
    pg.on("console", (m) => {
      if (m.type() !== "error") return;
      if (/Failed to load resource/.test(m.text())) return; // lo cubre requestfailed
      errores.push(m.text());
    });
    pg.on("pageerror", (e) => errores.push("pageerror: " + e.message));
    await pg.goto(PAGINA, { waitUntil: "load" });
    await pg.waitForTimeout(700);

    console.log(`\n${ancho}px`);
    ok(errores.length === 0, `sin errores de consola${errores.length ? " → " + errores.slice(0, 2).join(" | ") : ""}`);
    if (bloqueados.size) console.log(`  nota  bloqueado por el entorno, no por la página: ${[...bloqueados].join(", ")}`);
    const desborde = await pg.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(desborde <= 0, `sin scroll horizontal (desborde ${desborde}px)`);
    capturas[ancho] = await pg.screenshot({ path: `${SALIDA}/captura-${ancho}.png`, fullPage: ancho !== 1440 });
    if (ancho === 1440) await pg.screenshot({ path: `${SALIDA}/captura-1440-completa.png`, fullPage: true });
    await ctx.close();
  }

  // ── solo modo claro ────────────────────────────────────────────────────
  console.log("\nSolo modo claro");
  const tono = {};
  for (const esquema of ["light", "dark"]) {
    const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: esquema });
    const pg = await ctx.newPage();
    await pg.goto(PAGINA, { waitUntil: "load" });
    await pg.waitForTimeout(500);
    tono[esquema] = await pg.evaluate(() => {
      const g = (s, p) => getComputedStyle(document.querySelector(s))[p];
      return JSON.stringify({
        fondo: g("body", "backgroundColor"),
        texto: g("body", "color"),
        panel: g(".lienzo", "backgroundColor"),
        kpi: g(".kpi", "backgroundColor"),
      });
    });
    await ctx.close();
  }
  ok(tono.light === tono.dark, `la página se pinta igual en claro y en oscuro`);
  ok(/rgb\(236, 238, 232\)/.test(tono.light), `el fondo es el gris salvia explícito, no heredado`);

  // ── interfaz nueva + tailwind + contraste ──────────────────────────────
  console.log("\nInterfaz y color");
  const ctx = await nav.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: "light" });
  const pg = await ctx.newPage();
  await pg.goto(PAGINA, { waitUntil: "load" });
  await pg.waitForTimeout(600);
  const r = await pg.evaluate(() => {
    const d = document.createElement("div");
    d.className = "bg-mercadeo p-6 rounded-xl";
    document.body.appendChild(d);
    const tramos = [...document.querySelectorAll(".apilada span")].map((s) => {
      const c = getComputedStyle(s);
      return { fondo: c.backgroundColor, texto: c.color, txt: s.textContent.trim() };
    });
    return {
      rielEnlaces: document.querySelectorAll(".riel a[data-sec]").length,
      rielActivo: document.querySelectorAll(".riel a.activo").length,
      iconosKpi: document.querySelectorAll(".kpi .icono svg").length,
      kpis: document.querySelectorAll(".kpi").length,
      veredictoFondo: getComputedStyle(document.querySelector(".veredicto")).backgroundColor,
      twFondo: getComputedStyle(d).backgroundColor,
      twRelleno: getComputedStyle(d).padding,
      fuenteTitulo: getComputedStyle(document.querySelector("h1")).fontFamily,
      tramos,
    };
  });
  ok(r.rielEnlaces === 9, `el riel tiene las 9 secciones (${r.rielEnlaces})`);
  ok(r.rielActivo === 1, `exactamente una marcada en reposo (${r.rielActivo})`);
  ok(r.iconosKpi === r.kpis && r.kpis === 5, `los 5 KPI traen su icono (${r.iconosKpi}/${r.kpis})`);
  ok(r.veredictoFondo === "rgb(10, 13, 11)", `el veredicto es la tarjeta negra (${r.veredictoFondo})`);
  ok(r.twFondo === "rgb(65, 137, 198)" && r.twRelleno === "24px", `Tailwind sigue operativo`);
  ok(/Outfit/.test(r.fuenteTitulo), `los títulos usan Outfit (${r.fuenteTitulo.split(",")[0]})`);
  for (const t of r.tramos) {
    const c = contraste(t.texto, t.fondo);
    ok(c >= 4.5, `tramo «${t.txt}» ${c.toFixed(2)}:1 de texto sobre relleno`);
  }
  await ctx.close();

  // Sin comentarios: el CSS EXPLICA que ya no hay modo oscuro, y esa frase
  // contiene el patron que se busca. Un comentario no es una regla.
  const css = fs.readFileSync(`${SALIDA}/ciclo-del-lead.html`, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  ok(!/dark\\:/.test(css), `el CSS ya no trae la variante dark:`);
  ok(!/@media\s*\([^)]*prefers-color-scheme\s*:\s*dark/.test(css), `no hay regla de modo oscuro`);

  await nav.close();
  console.log(fallos === 0 ? "\nTODO EN VERDE" : `\n${fallos} FALLAS`);
  process.exit(fallos === 0 ? 0 : 1);
})();
