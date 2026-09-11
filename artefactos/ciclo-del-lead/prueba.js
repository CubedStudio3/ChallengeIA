/**
 * Prueba del artefacto con Tailwind instalado.
 *
 * Lo que comprueba:
 *  1. Que la pagina siga pintandose igual que ANTES de instalar Tailwind
 *     (comparacion pixel a pixel en 1440 / 834 / 390).
 *  2. Que no aparezcan errores de consola nuevos.
 *  3. Que una utilidad de Tailwind SI se aplique.
 *  4. Que una utilidad pueda SOBRESCRIBIR una regla propia de la pagina
 *     (el punto de la cascada: el <style> de Tailwind va despues).
 *  5. Que la variante `dark:` aplique en oscuro y NO se filtre en claro.
 *  6. Que las librerias, si estan, expongan su global.
 */
"use strict";
const fs = require("fs");
const { chromium } = require("playwright");
const { PNG } = require("pngjs");
const pixelmatch = require("pixelmatch");

// El publicador envuelve el contenido en este esqueleto. Se replica igual o la
// prueba no estaria probando la pagina que se publica.
const envuelve = (cuerpo) => `<!doctype html><html><head><meta charset=utf8>`
  + `<meta name=viewport content="width=device-width,initial-scale=1"><style>`
  + `:root{color-scheme:light}body{margin:0;padding:0;font:14px -apple-system,`
  + `BlinkMacSystemFont,sans-serif;background:#faf9f5;color:#141413}`
  + `img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}`
  + `</style></head><body>\n${cuerpo}\n</body></html>`;

fs.writeFileSync("/tmp/antes.html",  envuelve(fs.readFileSync("fuente.html", "utf8")));
fs.writeFileSync("/tmp/despues.html", envuelve(fs.readFileSync("../ciclo-del-lead.html", "utf8")));

const ANCHOS = [1440, 834, 390];
let fallos = 0;
const ok = (c, m) => { console.log(`  ${c ? "OK  " : "FALLA"} ${m}`); if (!c) fallos++; };

(async () => {
  const navegador = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

  // ── 1 y 2 · misma pintura, sin errores nuevos ──────────────────────────
  for (const ancho of ANCHOS) {
    const tomas = {};
    for (const [etiqueta, archivo] of [["antes", "/tmp/antes.html"], ["despues", "/tmp/despues.html"]]) {
      const ctx = await navegador.newContext({ viewport: { width: ancho, height: 900 }, colorScheme: "light" });
      const pg = await ctx.newPage();
      const errores = [];
      pg.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); });
      pg.on("pageerror", (e) => errores.push("pageerror: " + e.message));
      await pg.goto("file://" + archivo, { waitUntil: "load" });
      await pg.waitForTimeout(700);
      tomas[etiqueta] = { png: await pg.screenshot({ fullPage: true }), errores };
      await ctx.close();
    }
    const a = PNG.sync.read(tomas.antes.png), b = PNG.sync.read(tomas.despues.png);
    console.log(`\n${ancho}px  —  antes ${a.width}x${a.height} · despues ${b.width}x${b.height}`);
    if (a.width === b.width && a.height === b.height) {
      const distintos = pixelmatch(a.data, b.data, null, a.width, a.height, { threshold: 0.1 });
      const pct = (distintos / (a.width * a.height) * 100).toFixed(4);
      ok(distintos === 0, `pintura identica (${distintos} pixeles distintos, ${pct}%)`);
    } else {
      ok(false, `el alto o ancho cambio — la maquetacion se movio`);
    }
    const nuevos = tomas.despues.errores.filter((e) => !tomas.antes.errores.includes(e));
    ok(nuevos.length === 0, `sin errores de consola nuevos${nuevos.length ? " → " + nuevos.slice(0,3).join(" | ") : ""}`);
  }

  // ── 3 a 6 · que Tailwind realmente funcione ────────────────────────────
  console.log("\nTailwind operativo");
  const ctx = await navegador.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "light" });
  const pg = await ctx.newPage();
  await pg.goto("file:///tmp/despues.html", { waitUntil: "load" });
  await pg.waitForTimeout(500);

  const r = await pg.evaluate(() => {
    const res = {};
    const gc = (el, prop) => getComputedStyle(el)[prop];

    // 3 · una utilidad suelta se aplica
    const d = document.createElement("div");
    d.className = "bg-mercadeo text-tinta2 rounded-xl p-6 font-mono";
    document.body.appendChild(d);
    res.bg      = gc(d, "backgroundColor");
    res.relleno = gc(d, "padding");
    res.radio   = gc(d, "borderRadius");
    res.fuente  = gc(d, "fontFamily");

    // 4 · una utilidad sobrescribe una regla propia de la pagina
    const kpi = document.querySelector(".kpi");
    res.kpiAntes = kpi ? gc(kpi, "padding") : null;
    if (kpi) kpi.classList.add("p-12");
    res.kpiDespues = kpi ? gc(kpi, "padding") : null;

    // 5 · dark: no se filtra en claro
    const dk = document.createElement("div");
    dk.className = "dark:bg-alerta";
    document.body.appendChild(dk);
    res.darkEnClaro = gc(dk, "backgroundColor");

    // 6 · globales de las librerias
    res.libs = {
      lucide: typeof window.lucide,
      gsap: typeof window.gsap,
      Chart: typeof window.Chart,
      Alpine: typeof window.Alpine,
    };
    return res;
  });

  ok(r.bg === "rgb(42, 120, 214)", `bg-mercadeo usa la variable del tema (${r.bg})`);
  ok(r.relleno === "24px", `p-6 aplica (${r.relleno})`);
  ok(r.radio === "12px", `rounded-xl aplica (${r.radio})`);
  ok(/IBM Plex Mono/.test(r.fuente), `font-mono usa la fuente de la pagina`);
  ok(r.kpiAntes === "14px 15px 15px", `regla propia intacta antes (${r.kpiAntes})`);
  ok(r.kpiDespues === "48px", `p-12 SOBRESCRIBE la regla .kpi (${r.kpiDespues}) — la cascada quedo bien`);
  ok(r.darkEnClaro === "rgba(0, 0, 0, 0)", `dark: NO se filtra en modo claro (${r.darkEnClaro})`);
  await ctx.close();

  // dark: si aplica en oscuro
  const ctxD = await navegador.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
  const pgD = await ctxD.newPage();
  await pgD.goto("file:///tmp/despues.html", { waitUntil: "load" });
  await pgD.waitForTimeout(400);
  const oscuro = await pgD.evaluate(() => {
    const d = document.createElement("div");
    d.className = "dark:bg-alerta";
    document.body.appendChild(d);
    return getComputedStyle(d).backgroundColor;
  });
  ok(oscuro === "rgb(232, 112, 95)", `dark: SI aplica en modo oscuro (${oscuro})`);
  await ctxD.close();

  console.log("\nlibrerias:", JSON.stringify(r.libs));
  await navegador.close();
  console.log(fallos === 0 ? "\nTODO EN VERDE" : `\n${fallos} FALLAS`);
  process.exit(fallos === 0 ? 0 : 1);
})();
