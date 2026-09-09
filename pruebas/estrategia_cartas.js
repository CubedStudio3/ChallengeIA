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

  console.log("\n══ el plan de producción de cada estrategia");
  {
    /* Lo esperado se CUENTA de las cartas, igual que Python. Si las dos cuentas
       coinciden, la de la pantalla no es una tercera cuenta que pueda derivar.
       Y si Python cambia el criterio, esta prueba se pone roja: es el punto. */
    const planes = await pg.evaluate(`(() => {
      const D = JSON.parse(document.getElementById("datos").textContent);
      const cs = ((D.cartas || {}).cartas) || [];
      const sirve = (x, id) => x.siempre || (x.estrategias || []).indexOf(id) >= 0;
      return (((D.estrategia || {}).estrategias) || []).map(e => {
        const mias = cs.filter(c => sirve(c, e.id));
        const pl = e.plan || {};
        return {
          id: e.id, plan: !!e.plan,
          artes: (pl.piezas || {}).arte, videos: (pl.piezas || {}).video,
          contadas: { arte: mias.filter(c => c.pieza === "arte").length,
                      video: mias.filter(c => c.pieza === "video").length },
          total: pl.total, cartas: mias.length,
          pasos: (pl.pasos || []).length,
          veredicto: pl.veredicto,
          canal: pl.canal,
          // Lo que la evidencia dice de canal, contado aparte.
          canalContado: {
            pauta: mias.filter(c => (c.canales || []).indexOf("pauta") >= 0).length,
            organico: mias.filter(c => (c.canales || []).indexOf("organico") >= 0).length,
            sin: mias.filter(c => !(c.canales || []).length).length,
          },
          sinDato: (pl.pasos || []).filter(x => !x.dato || !x.que).map(x => x.orden),
        };
      });
    })()`);
    ok("las tres estrategias traen plan", planes.every(p => p.plan),
       planes.map(p => p.id + ":" + p.plan));
    for (const p of planes) {
      ok("  " + p.id + " · los artes y videos son las CARTAS que activa",
         p.artes.cuantas === p.contadas.arte &&
         p.videos.cuantas === p.contadas.video && p.total === p.cartas,
         { plan: [p.artes.cuantas, p.videos.cuantas, p.total],
           contado: [p.contadas.arte, p.contadas.video, p.cartas] });
      /* EL GUARDIA QUE IMPORTA: el veredicto tiene que decir la verdad sobre la
         capacidad. Un «cabe» con más piezas que capacidad es peor que no tener
         veredicto: la mesa produciría de más creyendo que estaba avisada. */
      const techos = [p.artes, p.videos].filter(x => x.capacidad != null);
      const excede = techos.some(x => x.cuantas > x.capacidad);
      ok("  " + p.id + " · el veredicto no miente sobre la capacidad",
         techos.length === 0 ? p.veredicto === "sin_capacidad"
                             : (excede ? p.veredicto === "no_cabe"
                                       : p.veredicto !== "no_cabe"),
         { veredicto: p.veredicto, excede: excede,
           techos: techos.map(x => x.cuantas + "/" + x.capacidad) });
      ok("  " + p.id + " · el corte de canal sale de la evidencia",
         p.canal.pauta.cuantas === p.canalContado.pauta &&
         p.canal.organico.cuantas === p.canalContado.organico &&
         p.canal.solo_ejecucion.cuantas === p.canalContado.sin,
         { plan: [p.canal.pauta.cuantas, p.canal.organico.cuantas,
                  p.canal.solo_ejecucion.cuantas],
           contado: [p.canalContado.pauta, p.canalContado.organico,
                     p.canalContado.sin] });
      /* Un paso sin dato detrás es una ocurrencia. */
      ok("  " + p.id + " · cada paso trae su dato", p.sinDato.length === 0,
         p.sinDato);
      ok("  " + p.id + " · hay pasos que seguir", p.pasos >= 3, p.pasos);
    }
  }

  console.log("\n══ el plan de la PANTALLA cambia al cambiar de estrategia");
  {
    /* Los números del plan se leen de la pantalla, no del JSON: es lo que la
       mesa va a leer. Si la tarjeta pintara el plan de otra estrategia, los
       conteos del JSON seguirían bien y la pantalla estaría mal. */
    /* Sin expresiones regulares dentro del literal: el escapado de `\b` se
       rompió al pasar por dos capas de comillas y la página tiró
       «Invalid regular expression». Partir el texto en líneas hace lo mismo y
       no tiene nada que escapar. */
    const leePlan = `(() => {
      return [...document.querySelectorAll('#estrategia div.bg-white')].map(c => {
        const ls = c.innerText.split("\\n").map(x => x.trim());
        const tras = (rot) => {
          const i = ls.indexOf(rot);
          return i >= 0 && /^[0-9]+$/.test(ls[i + 1] || "") ? +ls[i + 1] : null;
        };
        return { artes: tras("ARTES"), videos: tras("VIDEOS"),
                 elegida: ls.indexOf("Elegida") >= 0 };
      /* El selector div.bg-white tambien casa las tarjetas de carta y de
         angulo, que no traen contadores: se quedan las que si, que son las de
         estrategia. (Sin backticks: esto vive dentro de un template literal.) */
      }).filter(x => x.artes !== null || x.videos !== null);
    })()`;
    const esperadoPorId = {};
    for (const p of await pg.evaluate(`(() => {
      const D = JSON.parse(document.getElementById("datos").textContent);
      return (((D.estrategia || {}).estrategias) || []).map(e => ({
        id: e.id, nombre: e.nombre,
        artes: ((e.plan || {}).piezas || {}).arte.cuantas,
        videos: ((e.plan || {}).piezas || {}).video.cuantas }));
    })()`)) esperadoPorId[p.id] = p;

    for (const id of Object.keys(esperadoPorId)) {
      const btn = '#estrategia [data-estrategia="' + id + '"]';
      if (await pg.$(btn)) { await pg.click(btn); await pg.waitForTimeout(700); }
      const tarjetas = await pg.evaluate(leePlan);
      const eleg = tarjetas.filter(t => t.elegida)[0];
      const exp = esperadoPorId[id];
      ok("  la tarjeta elegida (" + id + ") muestra sus propias piezas",
         !!eleg && eleg.artes === exp.artes && eleg.videos === exp.videos,
         { pantalla: eleg && [eleg.artes, eleg.videos],
           esperado: [exp.artes, exp.videos] });
      /* Y las tres tarjetas tienen que mostrar SUS números, no los de la
         elegida: la comparación es la razón de que se vean las tres. */
      const setPantalla = tarjetas.map(t => t.artes + "/" + t.videos).sort();
      const setDato = Object.values(esperadoPorId)
        .map(p => p.artes + "/" + p.videos).sort();
      ok("  las tres muestran cada una lo suyo",
         JSON.stringify(setPantalla) === JSON.stringify(setDato),
         { pantalla: setPantalla, dato: setDato });
    }
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
    /* Dice «ángulos» y no «tareas» desde que el plan cuenta las CARTAS: las
       cartas son las piezas y los ángulos las agrupan, así que llamarlos igual
       invitaba a sumar dos cuentas de la misma capacidad. */
    ok("los rótulos nombran cartas y ángulos, no solo una de las dos",
       rot.every(r => /carta/.test(r.rotulo || "") && /ángulo/.test(r.rotulo || "")),
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
