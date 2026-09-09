/* Cambiar de estrategia cambia las TAREAS y las CARTAS, probado con el ratón.

   El error que reportó Mercadeo el 2026-09-09: «cuando se selecciona una
   diferente no cambia las tareas, deja las mismas que las de la primera
   estrategia». Medido: las tareas SÍ obedecían —cada una declara `estrategias`
   y `tareasVisibles()` filtra—; las diez cartas de producción no, porque
   llegaban con `estrategias: null`. La sección grande de la pantalla es la de
   cartas, así que la impresión era que nada cambiaba.

   Esta prueba entra por el clic, no por debajo: pulsa «Usar esta» en cada
   tarjeta de estrategia y cuenta lo que queda visible. Una prueba que llamara
   a `sirveA()` directamente probaría el predicado, no el producto (ADR-041).

   Uso: node pruebas/estrategia_cartas.js [archivo.html]
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

/* Sin `window.claude` el tablero se declara de solo lectura y deshabilita
   TODOS los botones —incluido «Usar esta»—, así que el clic no movería nada y
   la prueba pasaría sin probar. El doble solo necesita existir: aquí no se
   escribe en ningún sistema. */
const RUNTIME = `(() => {
  window.claude = { use: async (n) =>
    n === "artifact" ? { publish: async () => ({ ok: true }) }
    : n === "mcp" ? { callTool: async () => ({ payload: { status: "success",
        data: { items: [] } } }), listTools: async () => ({ servers: [] }) }
    : null };
})()`;

/* Lo esperado NO se escribe a mano: se deriva del mismo `#datos` que lee la
   página. Un esperado escrito aparte caduca en silencio y después acusa al
   producto —ya pasó dos veces en este proyecto—. */
const ESPERADO = `(() => {
  const D = JSON.parse(document.getElementById("datos").textContent);
  const est = D.estrategia || {};
  const cs = ((D.cartas || {}).cartas) || [];
  const sirve = (x, id) => x.siempre || (x.estrategias || []).indexOf(id) >= 0;
  return (est.estrategias || []).map(e => ({
    id: e.id, nombre: e.nombre, recomendada: !!e.recomendada,
    cartas: cs.filter(c => sirve(c, e.id)).length,
    tareas: (est.tareas || []).filter(t => sirve(t, e.id)).length,
  }));
})()`;

/* Lo VISIBLE, contado en la pantalla.

   Las cartas y las tareas de estrategia COMPARTEN el mismo botón
   (`data-decidir`), así que contar botones las mezcla: la primera versión de
   esta prueba leyó 6 donde esperaba 4 y acusó al producto de un error que no
   tenía. Se separan por su origen —la lista de la que salió cada id—, que es
   la única distinción que existe de verdad. `data-propia` es otra cosa: las
   ideas que agrega el equipo a mano, sin evidencia del sistema. */
const VISIBLE = `(() => {
  const D = JSON.parse(document.getElementById("datos").textContent);
  const idsCartas = new Set((((D.cartas||{}).cartas)||[]).map(c => c.id));
  const idsTareas = new Set((((D.estrategia||{}).tareas)||[]).map(t => t.id));
  const decid = [...document.querySelectorAll(
    '#estrategia [data-decidir][data-estado="aceptada"]')]
    .map(b => b.getAttribute("data-decidir"));
  return {
    cartas: decid.filter(id => idsCartas.has(id)),
    tareas: decid.filter(id => idsTareas.has(id)),
    huerfanos: decid.filter(id => !idsCartas.has(id) && !idsTareas.has(id)),
    propias: [...document.querySelectorAll(
      '#estrategia [data-propia][data-estado="aceptada"]')]
      .map(b => b.getAttribute("data-propia")),
    botones: [...document.querySelectorAll('#estrategia [data-estrategia]')]
      .map(b => b.getAttribute("data-estrategia")),
  };
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
  await pg.waitForTimeout(1400);

  const esp = await pg.evaluate(ESPERADO);

  console.log("\n══ el dato reparte las cartas entre las estrategias");
  ok("hay más de una estrategia que elegir", esp.length > 1, esp.length);
  ok("exactamente una viene recomendada",
     esp.filter(e => e.recomendada).length === 1);
  /* EL GUARDIA QUE IMPORTA. Si una estrategia se queda con TODAS las cartas,
     elegirla no cambia nada y el error reportado sigue vivo aunque el código
     filtre. La primera versión del mapeo daba 10 de 10 a `disputar-el-flanco`. */
  const total = await pg.evaluate(
    `((JSON.parse(document.getElementById("datos").textContent).cartas||{}).cartas||[]).length`);
  ok("ninguna estrategia se queda con todas las cartas",
     esp.every(e => e.cartas < total),
     esp.map(e => e.id + ":" + e.cartas + "/" + total));
  ok("todas activan al menos una carta", esp.every(e => e.cartas > 0),
     esp.map(e => e.cartas));
  ok("las tres reparten distinto (hay al menos dos tamaños)",
     new Set(esp.map(e => e.cartas)).size > 1, esp.map(e => e.cartas));

  console.log("\n══ al abrir, se ve la recomendada");
  {
    const v = await pg.evaluate(VISIBLE);
    const rec = esp.filter(e => e.recomendada)[0];
    ok("la recomendada no trae botón «Usar esta»",
       v.botones.indexOf(rec.id) < 0, v.botones);
    ok("las otras dos sí lo traen", v.botones.length === esp.length - 1, v.botones);
    ok("se ven las cartas de la recomendada, no las diez",
       v.cartas.length === rec.cartas,
       { visible: v.cartas.length, esperado: rec.cartas, total });
    ok("se ven las tareas de la recomendada",
       v.tareas.length === rec.tareas,
       { visible: v.tareas.length, esperado: rec.tareas });
    ok("ningún botón de decisión sin dueño en los datos",
       v.huerfanos.length === 0, v.huerfanos);
  }

  console.log("\n══ el clic en «Usar esta» mueve cartas Y tareas");
  const vistos = [];
  for (const e of esp) {
    const btn = '#estrategia [data-estrategia="' + e.id + '"]';
    const hay = await pg.$(btn);
    if (hay) {
      await pg.click(btn);
      await pg.waitForTimeout(700);
    }
    const v = await pg.evaluate(VISIBLE);
    console.log("  · " + e.nombre);
    ok("    cartas visibles = las que sirven a esta estrategia",
       v.cartas.length === e.cartas,
       { visible: v.cartas.length, esperado: e.cartas });
    ok("    tareas visibles = las que sirven a esta estrategia",
       v.tareas.length === e.tareas,
       { visible: v.tareas.length, esperado: e.tareas });
    ok("    queda marcada como elegida (su botón desaparece)",
       v.botones.indexOf(e.id) < 0, v.botones);
    /* Cada carta visible tiene que declarar esta estrategia o ser de las que
       sirven a las tres. Contar bien pero mostrar las de otra estrategia
       pasaría el conteo y sería el mismo error. */
    const bien = await pg.evaluate(`(() => {
      const D = JSON.parse(document.getElementById("datos").textContent);
      const cs = ((D.cartas||{}).cartas)||[];
      const ids = new Set(cs.map(c => c.id));
      const vis = [...document.querySelectorAll(
        '#estrategia [data-decidir][data-estado="aceptada"]')]
        .map(b => b.getAttribute("data-decidir")).filter(id => ids.has(id));
      return vis.filter(id => {
        const c = cs.filter(x => x.id === id)[0];
        return !(c.siempre || (c.estrategias||[]).indexOf(${JSON.stringify(e.id)}) >= 0);
      });
    })()`);
    ok("    ninguna carta visible es de otra estrategia", bien.length === 0, bien);
    vistos.push({ id: e.id, cartas: v.cartas.slice().sort().join(",") });
  }

  console.log("\n══ la tarjeta dice cuánto mueve elegirla");
  {
    /* El rótulo es una frase que la página escribe sobre su propio estado, y
       por eso es un test: si dice «4 cartas» y se ven 9, una de las dos miente
       y en la mesa se decide con la que se ve. */
    const rot = await pg.evaluate(`(() => {
      return [...document.querySelectorAll('#estrategia [data-estrategia]')]
        .map(b => {
          const c = b.closest("div.bg-white");
          const m = (c ? c.innerText : "").match(/Activa ([^\\n]+)/);
          return { id: b.getAttribute("data-estrategia"), rotulo: m ? m[1] : null };
        });
    })()`);
    for (const r of rot) {
      const e = esp.filter(x => x.id === r.id)[0];
      ok("    el rótulo de «" + (e ? e.nombre : r.id) + "» cuenta bien",
         !!r.rotulo && r.rotulo.indexOf(String(e.tareas)) >= 0 &&
         r.rotulo.indexOf(String(e.cartas)) >= 0,
         { rotulo: r.rotulo, tareas: e.tareas, cartas: e.cartas });
    }
    ok("los rótulos nombran cartas y tareas, no solo tareas",
       rot.every(r => /carta/.test(r.rotulo || "") && /tarea/.test(r.rotulo || "")),
       rot.map(r => r.rotulo));
  }

  console.log("\n══ dos estrategias no muestran la MISMA lista");
  {
    /* El síntoma exacto que se reportó: la lista no cambiaba al cambiar de
       estrategia. Comparar los conteos no basta —dos listas distintas pueden
       tener el mismo tamaño—: se comparan las claves. */
    const listas = new Set(vistos.map(v => v.cartas));
    ok("la lista de cartas cambia al cambiar de estrategia",
       listas.size === vistos.length,
       vistos.map(v => v.id + ":" + v.cartas.split(",").length));
  }

  console.log("\n══ «territorios de mensaje» ya no está en la pantalla");
  {
    const t = await pg.evaluate(`document.body.innerText`);
    ok("ni el título ni el bloque", !/territorio/i.test(t),
       (t.match(/.{0,40}[Tt]erritorio.{0,40}/g) || []).slice(0, 3));
  }

  ok("sin errores de JavaScript", errs.length === 0, errs);
  await nav.close();
  console.log(fallos ? "\n" + fallos + " FALLAS\n" : "\nTODO OK\n");
  process.exit(fallos ? 1 : 0);
})();
