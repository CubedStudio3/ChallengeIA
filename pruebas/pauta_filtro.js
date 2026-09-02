/* Prueba del paso 3: que la pauta OBEDEZCA la ventana y que los números sean
   los correctos. Los esperados NO se calculan aquí: se calculan aparte en
   Python sobre el crudo diario (pruebas/pauta_diaria.py deja el desglose
   reconciliado) y se comparan contra lo que pinta el navegador. Si la prueba
   usara la misma función que el tablero, comprobaría que el código coincide
   consigo mismo. */
const { chromium } = require("../node_modules/playwright");
const fs = require("fs");

const ARCHIVO = process.argv[2] || "/home/user/ChallengeIA/salidas/tablero-mesa-creativa.html";
const ESPERADO = JSON.parse(fs.readFileSync("/tmp/kpi/esperado.json", "utf8"));

const envuelve = f => '<!doctype html><html lang="es"><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1">' +
  "<style>:root{color-scheme:light}body{margin:0;font:14px system-ui;" +
  "background:#fbfbfa}img{max-width:100%}[hidden]{display:none!important}" +
  "</style></head><body>" + f + "</body></html>";

// Lee un KPI por su rótulo exacto, dentro de una sección.
/* Se genera la EXPRESION completa por llamada, sin argumentos. Pasar una
   cadena-funcion con argumentos devolvia undefined en silencio, y un lector
   que devuelve undefined hace fallar la prueba por su propia culpa: parecia
   que el tablero no pintaba nada. */
const LEE = (sec, rotulo) => `(() => {
  const s = document.getElementById(${JSON.stringify(sec)});
  if (!s) return null;
  const t = [...s.querySelectorAll("span")]
    .find(x => x.textContent.trim() === ${JSON.stringify(rotulo)});
  if (!t) return null;
  const c = t.closest("div.bg-white");
  const v = c.querySelector('div[class*="text-[34px]"]');
  const n = c.querySelector('div[class*="mt-2.5"]');
  return { valor: v ? v.textContent.trim() : null,
           nota: n ? n.textContent.trim() : null };
})()`;

/* Sin argumentos, Playwright trata la cadena como EXPRESION y no la invoca:
   devolvia la funcion, que serializa a undefined. Va como IIFE. */
const TITULAR = `(() => {
  const h = document.querySelector("#resumen h3");
  const p = h ? h.parentElement.querySelector("p") : null;
  return { titular: h ? h.textContent.trim() : null,
           apoyo: p ? p.textContent.trim() : null };
})()`;

const VACIA = (sec) => `/Ningún día de pauta cae en el rango/.test(
  (document.getElementById(${JSON.stringify(sec)}) || {}).innerText || "")`;

let fallos = 0;
const ok = (etiqueta, real, esp) => {
  const bien = real === esp;
  if (!bien) fallos++;
  console.log("    " + (bien ? "ok  " : "FALLA ") + etiqueta +
    (bien ? " = " + real : "  esperaba " + esp + " · vino " + real));
};
const money = x => x == null ? "—" :
  "$" + x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

(async () => {
  const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const pg = await nav.newPage({ viewport: { width: 1440, height: 2400 } });
  const errs = [];
  pg.on("pageerror", e => errs.push(e.message));
  await pg.setContent(envuelve(fs.readFileSync(ARCHIVO, "utf8")), { waitUntil: "load" });
  await pg.waitForTimeout(800);

  const pon = async (desde, hasta) => {
    if (!desde) {
      await pg.evaluate(`(() => { const b=[...document.querySelectorAll("[data-rango]")]
        .find(x=>x.getAttribute("data-rango")==="todo"); if(b) b.click(); })()`);
    } else {
      await pg.fill("#fDesde", desde);
      await pg.fill("#fHasta", hasta);
      await pg.evaluate(`document.getElementById("fHasta").blur()`);
    }
    await pg.waitForTimeout(700);
  };
  const mercado = async (m) => {
    await pg.evaluate(`(() => { const b=document.querySelector('[data-mercado="${m}"]');
      if(b) b.click(); })()`);
    await pg.waitForTimeout(600);
  };

  const VENTANAS = [
    ["todo", null, null],
    ["1-10 ago", "2026-08-01", "2026-08-10"],
    ["11-24 ago", "2026-08-11", "2026-08-24"],
    ["solo 08-16", "2026-08-16", "2026-08-16"],
    ["junio (vacia)", "2026-06-01", "2026-06-30"],
  ];

  for (const [nom, a, b] of VENTANAS) {
    console.log("\n══ ventana: " + nom);
    await pon(a, b);
    const E = ESPERADO[nom];
    const L = E.total["actions:lead"];

    if (!L) {
      const v = await pg.evaluate(VACIA("resumen"));
      const t = await pg.evaluate(TITULAR);
      console.log("    titular: " + JSON.stringify(t.titular));
      ok("resumen declara la ventana vacía",
         /Ningún día de pauta cae en el rango/.test(t.titular || ""), true);
      // Y el costo por lead no puede inventar un número.
      const k = await pg.evaluate(LEE("resumen", "Costo por lead"));
      ok("costo por lead sin dato", k && k.valor, "—");
    } else {
      const t = await pg.evaluate(TITULAR);
      ok("titular · leads", /(\d[\d,]*) leads/.exec(t.titular || "")?.[1],
         L.resultados.toLocaleString("en-US"));
      ok("titular · costo", (t.titular.match(/\$[\d,.]+/) || [])[0],
         money(Math.round(L.costo * 100) / 100));
      const kL = await pg.evaluate(LEE("resumen", "Leads del periodo"));
      ok("KPI leads", kL && kL.valor, L.resultados.toLocaleString("en-US"));
      const kI = await pg.evaluate(LEE("resumen", "Inversión"));
      ok("KPI inversión", kI && kI.valor, money(L.gasto));
      const kC = await pg.evaluate(LEE("resumen", "Costo por lead"));
      ok("KPI costo", kC && kC.valor, money(Math.round(L.costo * 100) / 100));
      console.log("      nota del costo: " + JSON.stringify(kC && kC.nota));
    }

    // Rendimiento, mercado por mercado.
    for (const m of ["GT", "SV"]) {
      await mercado(m);
      const q = E[m]["actions:lead"];
      if (!q) {
        ok("rendimiento " + m + " declara vacío",
           await pg.evaluate(VACIA("rendimiento")), true);
        continue;
      }
      const kv = await pg.evaluate(LEE("rendimiento", "Inversión"));
      ok("rendimiento " + m + " inversión", kv && kv.valor, money(q.gasto));
      const kc = await pg.evaluate(LEE("rendimiento", "Costo por lead"));
      ok("rendimiento " + m + " costo", kc && kc.valor,
         q.costo ? money(Math.round(q.costo * 100) / 100) : "—");
      const kk = await pg.evaluate(LEE("rendimiento", "Campañas con entrega"));
      ok("rendimiento " + m + " campañas", kk && kk.valor, String(q.campanas));
    }
    await mercado("GT");
  }

  console.log("\nerrores de consola: " + (errs.length ? errs.join(" | ") : "ninguno"));
  console.log(fallos || errs.length ? "\n>>> " + fallos + " FALLA(S)" : "\n>>> TODO OK");
  await nav.close();
  process.exit(fallos || errs.length ? 1 : 0);
})();
