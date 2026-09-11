/* El día que todavía no termina: que se vea, y que NO cuente.

   Pedido literal de Mercadeo (2026-09-11): «pero y si yo quisiera agarrar
   tambien el dia de hoy no se puede? la idea es que tengamos los datos reales
   en tiempo real». Sí se puede — Meta lo devuelve —, y la decisión fue
   mostrarlo APARTE porque un día en curso va al 20-27% de un día completo.

   Esta prueba vigila las dos mitades de esa decisión, que es fácil cumplir a
   medias:

     1. QUE SE VEA. Con su fecha, con el avance en porcentaje, y rotulado como
        lo que es. Un dato que existe en el JSON y no llega a la pantalla no se
        entregó.
     2. QUE NO CUENTE. Su gasto no puede aparecer en ningún total, ni con el
        filtro abierto de par en par. Ésta es la que importa: la primera falla
        se ve sola en la reunión, la segunda no la ve nadie y mueve decisiones.

   Y una tercera, de método: el porcentaje tiene que salir del dato. Si el
   promedio de días completos cambia, el rótulo tiene que cambiar con él —si no,
   es un número escrito a mano con cara de derivado, que es el error que este
   proyecto ya cometió con los copys (ADR-042).

   Uso: node pruebas/dia_en_curso.js [archivo.html]
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

const RUNTIME = `(() => {
  window.claude = { use: async () => null };
})()`;

(async () => {
  const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const pg = await nav.newPage({ viewport: { width: 1440, height: 2400 } });
  const errs = [];
  pg.on("pageerror", e => errs.push(e.message));
  await pg.setContent(
    '<!doctype html><html lang="es"><head><meta charset="utf-8">' +
    '<style>body{margin:0;font:14px system-ui;background:#fbfbfa}</style>' +
    "</head><body><script>" + RUNTIME + "<\/script>" +
    sinEstado(fs.readFileSync(ARCHIVO, "utf8")) + "</body></html>",
    { waitUntil: "load" });
  await pg.waitForTimeout(1500);

  const D = await pg.evaluate(`(() => {
    const d = JSON.parse(document.getElementById("datos").textContent);
    const pd = d.pauta_diaria || {};
    return { hoy: pd.dia_en_curso || null, piezas: pd.piezas || [],
             tope: pd.rango_disponible || null };
  })()`);

  console.log("\n══ 1 · el bloque existe y es de HOY, no de un día cerrado");
  ok("la corrida trae el bloque del día en curso", !!D.hoy,
     D.hoy && D.hoy.fecha);
  if (!D.hoy) {
    console.log("\n>>> sin bloque no hay nada que probar. FALLA");
    await nav.close();
    process.exit(1);
  }
  ok("su fecha es POSTERIOR al último día cerrado del dato",
     D.tope && D.hoy.fecha > D.tope.hasta,
     { dia_en_curso: D.hoy.fecha, dato_cerrado_hasta: D.tope && D.tope.hasta });
  ok("guarda la hora de su lectura, no solo la fecha",
     /T\d{2}:\d{2}/.test(String(D.hoy.consultado_a || "")),
     D.hoy.consultado_a);

  console.log("\n══ 2 · NO cuenta: su gasto no está en ninguna pieza");
  /* La separación es de dato, no de maquetación. Si el día en curso estuviera
     en `piezas`, el filtro lo sumaría por su cuenta y ningún rótulo de la
     pantalla podría arreglarlo. */
  const enPiezas = D.piezas.filter(p => p.f === D.hoy.fecha);
  ok("ninguna pieza lleva la fecha del día en curso", enPiezas.length === 0,
     enPiezas.slice(0, 3));
  ok("el rango de dato disponible NO llega al día en curso",
     D.tope.hasta < D.hoy.fecha, D.tope);

  console.log("\n══ 3 · con el filtro ABIERTO DE PAR EN PAR sigue sin sumarse");
  /* La ventana vacía es la que más dato muestra. Si el día en curso se colara
     en algún total, es aquí donde aparecería. */
  for (const id of ["fDesde", "fHasta"]) {
    await pg.focus("#" + id);
    await pg.keyboard.press("Control+A");
    await pg.keyboard.press("Delete");
  }
  await pg.waitForTimeout(700);

  const V = await pg.evaluate(`(() => {
    const g = (sec, rot) => {
      const s = document.getElementById(sec); if (!s) return null;
      const t = [...s.querySelectorAll("span")].find(x => x.textContent.trim() === rot);
      if (!t) return null;
      const c = t.closest("div.bg-white");
      const v = c.querySelector('div[class*="text-[34px]"]');
      return v ? v.textContent.trim() : null;
    };
    return { inversion: g("resumen", "Inversión"), leads: g("resumen", "Leads del periodo") };
  })()`);

  const money = x => "$" + Number(x).toLocaleString("en-US",
    { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /* El KPI es de UN indicador, no de todo el gasto. Esta prueba sumó al
     principio las piezas de los seis indicadores de 2026 y acusó al tablero de
     mostrar $6,164.71 donde «debían» ir $13,898.54 — que es exactamente el
     error que ADR-013 prohíbe: `actions:leadgen.other` y `link_click` no se
     suman con `actions:lead`. El esperado estaba mal, no la pantalla.

     Se agrupa por indicador ANTES de sumar, y el día en curso se compara
     contra el MISMO indicador que él mismo declara por mercado. */
  const IND = "actions:lead";
  const totalPiezas = D.piezas
    .filter(p => p.k === IND).reduce((a, p) => a + (p.g || 0), 0);
  const gastoHoy = Object.values(D.hoy.por_mercado)
    .filter(m => m.indicador === IND).reduce((a, m) => a + (m.gasto || 0), 0);

  ok("la inversión mostrada es la de las piezas de ese indicador",
     V.inversion === money(totalPiezas.toFixed(2)),
     { pantalla: V.inversion, piezas: money(totalPiezas.toFixed(2)) });
  ok("y NO es la que saldría si el día en curso se sumara",
     V.inversion !== money((totalPiezas + gastoHoy).toFixed(2)),
     { si_sumara_hoy: money((totalPiezas + gastoHoy).toFixed(2)),
       gasto_del_dia_en_curso: gastoHoy });

  console.log("\n══ 4 · se VE, con su avance en porcentaje");
  const P = await pg.evaluate(`(() => {
    const f = document.getElementById("diaEnCurso");
    if (!f) return null;
    return { txt: f.textContent.replace(/\\s+/g, " ").trim(),
             visible: f.getBoundingClientRect().height > 0 };
  })()`);
  ok("la franja está pintada", !!P && P.visible);
  if (P) {
    ok("dice que es el día en curso", /Día en curso/i.test(P.txt));
    ok("dice que no entra a los números de abajo",
       /No entra a ningún número/i.test(P.txt));
    ok("trae el avance en porcentaje, no en horas",
       /va al \d+% del gasto de un día típico/.test(P.txt),
       (P.txt.match(/va al \d+% del gasto de un día típico/g) || []).slice(0, 2));
    ok("nombra los mercados que sí tiene el bloque",
       Object.keys(D.hoy.por_mercado).every(m => P.txt.includes(m)),
       Object.keys(D.hoy.por_mercado));
    ok("rotula la hora como UTC, que es la del entorno y no la de la cuenta",
       /\d{2}:\d{2} UTC/.test(P.txt));
  }

  console.log("\n══ 5 · el porcentaje sale del dato, no está escrito a mano");
  /* Se recalcula acá con los mismos ingredientes y tiene que dar lo mismo. Si
     alguien congelara el número en el config, esta comprobación se pondría
     roja en cuanto cambiara un día. */
  for (const [m, b] of Object.entries(D.hoy.por_mercado)) {
    if (!b.referencia) continue;
    const dias = {};
    for (const p of D.piezas) {
      if (p.f >= D.hoy.fecha || p.p !== m || p.k !== b.indicador) continue;
      dias[p.f] = (dias[p.f] || 0) + p.g;
    }
    const ult = Object.keys(dias).sort().slice(-b.referencia.dias);
    const prom = ult.reduce((a, d) => a + dias[d], 0) / ult.length;
    const esperado = Math.round((b.gasto / prom) * 100);
    const pintado = Math.round(b.avance.gasto * 100);
    ok(`${m}: el avance reproduce el promedio de sus ${b.referencia.dias} días`,
       esperado === pintado, { pintado, recalculado: esperado });
  }

  console.log("\n══ 6 · SABOTAJE: si el crudo se quedó viejo, cambia el rótulo");
  /* La corrida semanal también regenera el tablero y tomaría el crudo que
     hubiera en disco. Un lunes mostraría la lectura del viernes rotulada «día
     en curso»: fecha correcta, afirmación falsa. Se simula marcando el bloque
     como no-de-hoy y repintando. */
  const S = await pg.evaluate(`(() => {
    const n = document.getElementById("datos");
    const d = JSON.parse(n.textContent);
    d.pauta_diaria.dia_en_curso.es_de_hoy = false;
    n.textContent = JSON.stringify(d);
    window.dispatchEvent(new Event("hashchange"));
    if (window.__pinta) window.__pinta();
    return true;
  })()`);
  ok("se pudo simular el crudo viejo", S === true);
  await pg.reload({ waitUntil: "load" }).catch(() => {});
  await pg.waitForTimeout(200);

  /* Recargar pierde el sabotaje, así que se carga de nuevo con el dato ya
     alterado: es la única forma de probar el camino completo de pintado. */
  const html = fs.readFileSync(ARCHIVO, "utf8");
  const viejo = html.replace(/"es_de_hoy":\s*true/, '"es_de_hoy":false');
  ok("el fragmento alterado es distinto del original", viejo !== html);
  await pg.setContent(
    '<!doctype html><html lang="es"><head><meta charset="utf-8">' +
    "</head><body><script>" + RUNTIME + "<\/script>" +
    sinEstado(viejo) + "</body></html>", { waitUntil: "load" });
  await pg.waitForTimeout(1200);
  const V2 = await pg.evaluate(`(() => {
    const f = document.getElementById("diaEnCurso");
    return f ? f.textContent.replace(/\\s+/g, " ").trim() : null;
  })()`);
  ok("la franja sigue ahí: lo último leído no se borra", !!V2);
  if (V2) {
    ok("ya NO se llama «Día en curso»", !/Día en curso/i.test(V2));
    ok("dice «Último día leído»", /Último día leído/i.test(V2));
    ok("y avisa explícitamente que no es hoy", /No es hoy/i.test(V2));
    ok("ya no promete que se mueve mientras se mira",
       !/se mueve mientras se mira/i.test(V2));
  }

  ok("sin errores de JavaScript", errs.length === 0, errs);
  await nav.close();
  console.log(fallos ? `\n>>> ${fallos} FALLAS` : "\n>>> TODO OK");
  process.exit(fallos ? 1 : 0);
})();
