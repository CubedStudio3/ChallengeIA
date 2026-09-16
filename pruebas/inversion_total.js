/* La Inversión del tablero tiene que ser TODO el dinero de la ventana.

   Lo encontró Mercadeo el 2026-09-16: «el presupuesto no cuadra con lo que dice
   Meta ¿no te esta faltando alguna campaña? (Talvez la que es el free)». Tenía
   razón. El tablero mostraba $591.42 para la semana del 25 de agosto y Meta
   decía $648.42 en la cuenta. La diferencia eran los $56.82 de «Plan Free
   Tráfico 2026», que optimiza por `actions:link_click`.

   La campaña estaba LEÍDA y en `piezas`. Lo que la dejaba fuera era el número
   que se eligió mostrar: Inversión salía del indicador principal. ADR-013
   prohíbe sumar RESULTADOS de indicadores distintos —158 leads y 10,771 clics
   no son 10,929 de nada— y esa regla se aplicó de más al gasto. Un dólar es un
   dólar (ADR-067).

   Esta prueba entra por el ratón y compara contra la suma de las piezas, que es
   el dato crudo del que sale todo. Y comprueba lo contrario también: que los
   RESULTADOS sigan siendo de un solo indicador.

   Uso: node pruebas/inversion_total.js [archivo.html]
*/
const { chromium } = require("../node_modules/playwright");
const fs = require("fs");
const { sinEstado } = require("./estado_limpio");

const ARCHIVO = process.argv[2] ||
  "/home/user/ChallengeIA/salidas/tablero-mesa-creativa.html";

let fallos = 0;
const ok = (etiqueta, bien, detalle) => {
  if (!bien) fallos++;
  console.log("  " + (bien ? "ok  " : "FALLA ") + etiqueta +
    (detalle !== undefined ? "  -> " + JSON.stringify(detalle) : ""));
};
const RUNTIME = `(() => { window.claude = { use: async () => null }; })()`;
const money = (x) => "$" + Number(x).toLocaleString("en-US",
  { minimumFractionDigits: 2, maximumFractionDigits: 2 });

(async () => {
  const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const pg = await nav.newPage({ viewport: { width: 1440, height: 2400 } });
  const errs = [];
  pg.on("pageerror", e => errs.push(e.message));
  await pg.setContent(
    '<!doctype html><html lang="es"><head><meta charset="utf-8">' +
    "</head><body><script>" + RUNTIME + "<\/script>" +
    sinEstado(fs.readFileSync(ARCHIVO, "utf8")) + "</body></html>",
    { waitUntil: "load" });
  await pg.waitForTimeout(1500);

  const D = await pg.evaluate(`(() => {
    const d = JSON.parse(document.getElementById("datos").textContent);
    const pd = d.pauta_diaria || {};
    return { piezas: pd.piezas || [],
             ventana: pd.ventana_de_la_corrida || null,
             excluidos: (d.integridad || {}).mercados_excluidos_con_gasto || {} };
  })()`);

  const leo = () => pg.evaluate(`(() => {
    const g = (sec, rot) => {
      const s = document.getElementById(sec); if (!s) return null;
      const t = [...s.querySelectorAll("span")].find(x => x.textContent.trim() === rot);
      if (!t) return null;
      const c = t.closest("div.bg-white");
      const v = c.querySelector('div[class*="text-[34px]"]');
      const n = c.querySelector('div[class*="text-[12px]"]');
      return { valor: v ? v.textContent.trim() : null,
               pie: n ? n.textContent.trim() : "" };
    };
    const h = document.querySelector("#resumen h3");
    const ap = h ? h.parentElement.querySelector("p") : null;
    return { inversion: g("resumen", "Inversión"),
             leads: g("resumen", "Leads del periodo"),
             titular: h ? h.textContent.trim() : "",
             apoyo: ap ? ap.textContent.trim() : "" };
  })()`);

  /* La ventana con la que ABRE el tablero es la de la corrida, así que los
     esperados se calculan sobre ESOS días y no sobre todo el dato. */
  const dentro = D.piezas.filter(p =>
    !D.ventana || (p.f >= D.ventana.desde && p.f <= D.ventana.hasta));

  const porInd = {};
  dentro.forEach(p => {
    const e = porInd[p.k] || (porInd[p.k] = { gasto: 0, res: 0, camp: {} });
    e.gasto += p.g; e.camp[p.c] = 1;
    if (p.r != null) e.res += p.r;
  });
  const total = Math.round(
    Object.values(porInd).reduce((a, e) => a + e.gasto, 0) * 100) / 100;
  const campanas = new Set(dentro.map(p => p.c)).size;
  const principal = "actions:lead";

  const V = await leo();

  console.log("\n══ 1 · la Inversión es TODO el dinero, no el de un indicador");
  ok("indicadores distintos en la ventana", Object.keys(porInd).length > 1,
     Object.keys(porInd));
  ok("la Inversión mostrada = suma de TODAS las piezas",
     V.inversion.valor === money(total),
     { pantalla: V.inversion.valor, todas: money(total),
       solo_principal: money(Math.round(porInd[principal].gasto * 100) / 100) });
  ok("y NO es solo la del indicador principal",
     V.inversion.valor !== money(Math.round(porInd[principal].gasto * 100) / 100));

  console.log("\n══ 2 · el pie dice cuántas campañas y cómo se reparte");
  ok("cuenta TODAS las campañas con entrega",
     V.inversion.pie.indexOf(String(campanas) + " campañas") === 0,
     { pie: V.inversion.pie, campanas });
  for (const k of Object.keys(porInd)) {
    const m = money(Math.round(porInd[k].gasto * 100) / 100);
    ok(`el reparto nombra ${k} con ${m}`, V.inversion.pie.includes(m),
       V.inversion.pie);
  }

  console.log("\n══ 2b · el TITULAR dice lo mismo que el KPI de abajo");
  /* El titular es lo primero que se lee y arrastraba el mismo defecto: decía
     «2 campañas con entrega · $591.42 invertidos» mientras el KPI ya mostraba
     $648.24 y 3 campañas. Dos números distintos para la misma cosa, en la misma
     pantalla, a diez centímetros uno del otro. */
  ok("el titular declara el mismo dinero que el KPI",
     V.apoyo.includes(money(total)),
     { apoyo: V.apoyo, esperado: money(total) });
  ok("y las mismas campañas con entrega",
     V.apoyo.indexOf(String(campanas) + " campañas") === 0, V.apoyo);
  ok("NO trae el gasto del indicador solo",
     !V.apoyo.includes(money(Math.round(porInd[principal].gasto * 100) / 100)),
     V.apoyo);

  console.log("\n══ 3 · los RESULTADOS siguen siendo de UN indicador (ADR-013)");
  /* Lo contrario del arreglo. El dinero se suma; los resultados jamás: en esta
     ventana son 194 leads y 14,324 clics, y un «14,518» no significaría nada. */
  const leadsPrin = Number(porInd[principal].res).toLocaleString("en-US");
  const sumaTodo = Object.values(porInd)
    .reduce((a, e) => a + e.res, 0).toLocaleString("en-US");
  ok("los leads mostrados son los del indicador principal",
     V.leads.valor === leadsPrin, { pantalla: V.leads.valor, principal: leadsPrin });
  ok("y NO la suma de todos los indicadores",
     V.leads.valor !== sumaTodo, { si_sumara: sumaTodo });
  ok("el pie declara de qué indicador son",
     /indicador /.test(V.leads.pie), V.leads.pie);

  console.log("\n══ 4 · el gasto excluido se declara, no se esconde");
  /* Honduras sale del análisis por decisión del usuario y su gasto se reporta
     aparte. Si además se sumara acá, el total dejaría de cuadrar con Meta por
     el otro lado. */
  const hn = Object.keys(D.excluidos);
  ok("hay mercado excluido declarado", hn.length > 0, hn);
  ok("su gasto NO está en las piezas de la ventana",
     !dentro.some(p => hn.includes(p.p)), hn);

  ok("sin errores de JavaScript", errs.length === 0, errs);
  await nav.close();
  console.log(fallos ? `\n>>> ${fallos} FALLAS` : "\n>>> TODO OK");
  process.exit(fallos ? 1 : 0);
})();
