/* Prueba del filtro POR EL CAMINO DE UNA PERSONA.

   Existe porque las 43 comprobaciones de pruebas/pauta_filtro.js aplicaban la
   ventana con page.fill(), que escribe el valor de una vez y dispara UN evento.
   Nadie usa la página así. Un `input[type=date]` que ya tiene valor dispara
   `change` en CADA segmento tecleado, con fechas basura de paso —medido:
   0008-09-17, 0816-09-17, 8162-09-17— y cada una de esas redibujaba la página
   con innerHTML, destruyendo el campo en el que la persona estaba escribiendo.
   El resultado era una fecha que nadie escribió y cifras que no se movían.

   Aquí NO se usa fill(). Solo eventos que el navegador considera de confianza:
   focus, keyboard.type y click. Son indistinguibles de los de una persona.

   El orden de los segmentos del widget es mm/dd/aaaa y focus() cae en el
   primero, así que 2026-08-16 se teclea "08162026". Se comprueba, no se supone:
   si el widget cambiara de orden, la prueba lo dice en vez de fallar sin más.

   La comprobación que más vale es la ÚLTIMA, y es a prueba de idioma: las
   cifras de la página TIENEN que corresponder a lo que muestran los campos,
   sea lo que sea. Ahí es donde el error se veía. */
const { chromium } = require("../node_modules/playwright");
const fs = require("fs");

const ARCHIVO = process.argv[2] ||
  "/home/user/ChallengeIA/salidas/tablero-mesa-creativa.html";
const ESPERADO = JSON.parse(fs.readFileSync("/tmp/kpi/esperado.json", "utf8"));
const ESPERA = 700;   // > 350 ms del repintado diferido

const envuelve = f => '<!doctype html><html lang="es"><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1">' +
  "<style>:root{color-scheme:light}body{margin:0;font:14px system-ui;" +
  "background:#fbfbfa}img{max-width:100%}[hidden]{display:none!important}" +
  "</style></head><body>" + f + "</body></html>";

const FOTO = `(() => {
  const g = (sec, rot) => {
    const s = document.getElementById(sec); if (!s) return null;
    const t = [...s.querySelectorAll("span")].find(x => x.textContent.trim() === rot);
    if (!t) return null;
    const c = t.closest("div.bg-white");
    const v = c.querySelector('div[class*="text-[34px]"]');
    return v ? v.textContent.trim() : null;
  };
  const h = document.querySelector("#resumen h3");
  const p = h ? h.parentElement.querySelector("p") : null;
  return {
    desde: (document.getElementById("fDesde") || {}).value,
    hasta: (document.getElementById("fHasta") || {}).value,
    titular: h ? h.textContent.trim() : null,
    apoyo: p ? p.textContent.trim() : null,
    leads: g("resumen", "Leads del periodo"),
    inversion: g("resumen", "Inversión"),
    costo: g("resumen", "Costo por lead"),
  };
})()`;

let fallos = 0;
const ok = (t, real, esp) => {
  const bien = real === esp;
  if (!bien) fallos++;
  console.log("    " + (bien ? "ok  " : "FALLA ") + t +
    (bien ? " = " + real : "   esperaba " + esp + " · vino " + real));
};
const money = x => x == null ? "—" : "$" + x.toLocaleString("en-US",
  { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* Teclea una fecha en un campo como lo haría una persona: enfocar y escribir
   dígitos. Sin fill(), sin dispatchEvent. */
async function teclea(pg, id, iso) {
  const [a, m, d] = iso.split("-");
  await pg.focus("#" + id);
  await pg.keyboard.type(m + d + a, { delay: 25 });
}

(async () => {
  const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const pg = await nav.newPage({ viewport: { width: 1440, height: 2400 }, locale: "es-GT" });
  const errs = [];
  pg.on("pageerror", e => errs.push(e.message));
  await pg.setContent(envuelve(fs.readFileSync(ARCHIVO, "utf8")), { waitUntil: "load" });
  await pg.waitForTimeout(900);

  console.log("═══ 0 · el orden de segmentos del widget es el que la prueba supone ═══");
  await teclea(pg, "fDesde", "2026-08-16");
  await pg.waitForTimeout(ESPERA);
  const f0 = await pg.evaluate(FOTO);
  ok("teclear 2026-08-16 deja ese valor en el campo", f0.desde, "2026-08-16");
  if (f0.desde !== "2026-08-16") {
    console.log("    >>> el widget cambió de orden de segmentos. Ajustar teclea().");
  }

  console.log("\n═══ 1 · TECLEANDO una ventana de un día ═══");
  await teclea(pg, "fHasta", "2026-08-16");
  await pg.waitForTimeout(ESPERA);
  let f = await pg.evaluate(FOTO);
  const E = ESPERADO["solo 08-16"].total["actions:lead"];
  console.log("    campos: " + f.desde + " .. " + f.hasta);
  ok("desde", f.desde, "2026-08-16");
  ok("hasta", f.hasta, "2026-08-16");
  ok("leads", f.leads, String(E.resultados));
  ok("inversión", f.inversion, money(E.gasto));
  ok("costo", f.costo, money(Math.round(E.costo * 100) / 100));
  ok("el apoyo dice 1 día", /·\s*1 día en la ventana/.test(f.apoyo || ""), true);

  console.log("\n═══ 2 · TECLEANDO una ventana de rango ═══");
  await teclea(pg, "fDesde", "2026-08-11");
  await pg.waitForTimeout(ESPERA);
  await teclea(pg, "fHasta", "2026-08-24");
  await pg.waitForTimeout(ESPERA);
  f = await pg.evaluate(FOTO);
  const E2 = ESPERADO["11-24 ago"].total["actions:lead"];
  console.log("    campos: " + f.desde + " .. " + f.hasta);
  ok("leads", f.leads, String(E2.resultados));
  ok("inversión", f.inversion, money(E2.gasto));
  ok("costo", f.costo, money(Math.round(E2.costo * 100) / 100));

  console.log("\n═══ 3 · CLIC en «El periodo de la corrida» ═══");
  await pg.click('[data-rango="periodo"]');
  await pg.waitForTimeout(ESPERA);
  f = await pg.evaluate(FOTO);
  const E3 = ESPERADO["todo"].total["actions:lead"];
  ok("inversión", f.inversion, money(E3.gasto));
  ok("apoyo dice 22 días", /·\s*22 días en la ventana/.test(f.apoyo || ""), true);

  console.log("\n═══ 4 · CLIC en «Todo»: no debe quedar ventana propia ═══");
  await pg.click('[data-rango="todo"]');
  await pg.waitForTimeout(ESPERA);
  f = await pg.evaluate(FOTO);
  ok("inversión", f.inversion, money(E3.gasto));
  ok("sin «días en la ventana»", /días en la ventana/.test(f.apoyo || ""), false);

  console.log("\n═══ 5 · el invariante: las cifras SIEMPRE cuadran con los campos ═══");
  /* A prueba de idioma y de orden de segmentos: se teclea, se lee lo que
     quedó en los campos, y se exige que las cifras sean las de ESE rango.
     Aquí es donde se veía el error: los campos decían una cosa y las cifras
     otra. */
  const objetivos = ["2026-08-05", "2026-08-13", "2026-08-22", "2026-06-10"];
  for (const iso of objetivos) {
    await teclea(pg, "fDesde", iso);
    await pg.waitForTimeout(ESPERA);
    await teclea(pg, "fHasta", iso);
    await pg.waitForTimeout(ESPERA);
    f = await pg.evaluate(FOTO);
    // La verdad se calcula sobre lo que los CAMPOS muestran, no sobre lo tecleado.
    const dias = ESPERADO.__piezas.filter(p => p.f >= f.desde && p.f <= f.hasta);
    const lead = dias.filter(p => p.k === "actions:lead");
    const gasto = Math.round(lead.reduce((a, p) => a + p.g, 0) * 100) / 100;
    const res = lead.reduce((a, p) => a + (p.r || 0), 0);
    console.log("    campos " + f.desde + ".." + f.hasta +
      "  esperado: " + (lead.length ? res + " leads · " + money(gasto) : "sin pauta"));
    if (!lead.length) {
      ok("declara la ventana vacía",
         /Ningún día de pauta cae en el rango/.test(f.titular || ""), true);
      ok("costo sin dato", f.costo, "—");
    } else {
      ok("leads cuadran con los campos", f.leads, String(res));
      ok("inversión cuadra con los campos", f.inversion, money(gasto));
      ok("costo cuadra con los campos", f.costo,
         res ? money(Math.round(gasto / res * 100) / 100) : "—");
    }
  }

  console.log("\nerrores de consola: " + (errs.length ? errs.join(" | ") : "ninguno"));
  console.log(fallos || errs.length ? "\n>>> " + fallos + " FALLA(S)" : "\n>>> TODO OK");
  await nav.close();
  process.exit(fallos || errs.length ? 1 : 0);
})();
