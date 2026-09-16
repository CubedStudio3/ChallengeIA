/* El botón «Actualizar ahora» del día en curso.

   Pedido de Mercadeo (2026-09-16), después de cinco días sin actualización
   automática: «¿no se si es posible como un boton que diga actualizar?».

   Lo que esta prueba vigila es lo que hace peligroso al botón: la página
   interpreta la respuesta de Meta POR SU CUENTA, así que hay una SEGUNDA copia
   de dos reglas que ya vivían en Python —cómo se parsea un número y cómo se
   arma el bloque del día—. Este proyecto ya vio divergir una tercera copia de
   un texto sin que nadie lo notara hasta que fue tarde.

   Por eso se compara contra Python, no contra un esperado escrito a mano:

     1. `parseaNumero` contra `parsea_numero()`, sobre los 3,000+ valores
        DISTINTOS de los veinte crudos — nueve meses de formatos reales.
     2. El bloque entero contra el que arma `dia_en_curso.arma()` sobre el
        mismo crudo.
     3. Que un fallo de conector diga QUÉ hacer, código por código, y que el
        dato viejo no se borre.
     4. Que el botón NO toque `piezas` ni ningún total.

   Uso: node pruebas/boton_actualizar.js [archivo.html]
*/
const { chromium } = require("../node_modules/playwright");
const { execFileSync } = require("child_process");
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

/* Los esperados se le piden a Python EN EL MOMENTO. Un fixture copiado a mano
   ya caducó dos veces en este proyecto. */
const py = (script, args) => JSON.parse(execFileSync("python3",
  [script].concat(args || []), { env: { ...process.env, PYTHONPATH: "src" },
  maxBuffer: 64 * 1024 * 1024 }).toString());

const VALORES = py("pruebas/valores_reales.py");
const CRUDO = JSON.parse(fs.readFileSync(
  "data/historico/dia_en_curso/crudo/meta_dia_en_curso.json", "utf8"));

/* Un conector simulado: responde lo que se le diga, o falla con el código que
   se le diga. Las llamadas quedan registradas para poder afirmar QUÉ se pidió. */
const runtime = (guion) => `(() => {
  window.__llamadas = [];
  const guion = ${JSON.stringify(guion)};
  window.claude = { use: async (n) => {
    if (n === "artifact") return { publish: async (html) => {
      // Se guarda lo publicado: es la unica forma de comprobar que el refresco
      // SOBREVIVE a recargar. Mercadeo lo reporto el 2026-09-16.
      window.__publicado = html; return { ok: true };
    } };
    if (n !== "mcp") return null;
    return {
      callTool: async (server, tool, input, opts) => {
        window.__llamadas.push({ server, tool, input, opts });
        if (guion.error) {
          const e = new Error(guion.error.code);
          Object.assign(e, guion.error);
          throw e;
        }
        /* guion.paginas sirve una respuesta por llamada, en orden, para
           poder probar que el boton SIGUE el cursor. La ultima de la lista se
           repite si se pide mas: asi se simula un cursor que nunca se apaga.
           Sin acentos graves: esto vive dentro de un template literal. */
        if (guion.paginas) {
          const i = Math.min(window.__llamadas.length - 1, guion.paginas.length - 1);
          return { payload: guion.paginas[i] };
        }
        return { payload: guion.payload };
      },
      listTools: async () => ({ servers: [] })
    };
  } };
})()`;

async function abre(nav, guion) {
  const pg = await nav.newPage({ viewport: { width: 1440, height: 2400 } });
  const errs = [];
  pg.on("pageerror", e => errs.push(e.message));
  await pg.setContent(
    '<!doctype html><html lang="es"><head><meta charset="utf-8">' +
    "</head><body><script>" + runtime(guion) + "<\/script>" +
    sinEstado(fs.readFileSync(ARCHIVO, "utf8")) + "</body></html>",
    { waitUntil: "load" });
  await pg.waitForTimeout(1500);
  return { pg, errs };
}

(async () => {
  const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

  console.log("\n══ 1 · parseaNumero contra Python, sobre el dato real");
  {
    const { pg, errs } = await abre(nav, { payload: { ad_entities: [] } });
    const malos = await pg.evaluate(`(() => {
      const esperado = ${JSON.stringify(VALORES)};
      const malos = [];
      for (const k of Object.keys(esperado)) {
        const mio = window.__parseaNumero(k);
        const suyo = esperado[k];
        const igual = (mio === null && suyo === null) ||
          (mio !== null && suyo !== null && Math.abs(mio - suyo) < 1e-9);
        if (!igual) malos.push({ valor: k, js: mio, py: suyo });
      }
      return { total: Object.keys(esperado).length, malos: malos.slice(0, 8),
               cuantos: malos.length };
    })()`);
    ok(`los ${malos.total} valores distintos se parsean igual que en Python`,
       malos.cuantos === 0, malos.malos);
    ok("hay volumen de verdad, no cuatro casos", malos.total > 1000, malos.total);
    ok("sin errores de JavaScript", errs.length === 0, errs);
    await pg.close();
  }

  console.log("\n══ 2 · el bloque del día, contra el que arma Python");
  {
    const filas = Array.isArray(CRUDO.ad_entities)
      ? CRUDO.ad_entities : JSON.parse(CRUDO.ad_entities);
    const fecha = CRUDO._metadatos.parametros.time_range.since;
    const esperado = py("pruebas/esperado_dia.py", [fecha]);
    const { pg, errs } = await abre(nav, { payload: { ad_entities: filas } });
    const mio = await pg.evaluate(`(() => {
      const d = JSON.parse(document.getElementById("datos").textContent);
      return window.__bloqueDelDia(${JSON.stringify(filas)}, ${JSON.stringify(fecha)},
        d.pauta_diaria.piezas, null);
    })()`);
    for (const m of Object.keys(esperado.por_mercado)) {
      const a = esperado.por_mercado[m], b = (mio.por_mercado || {})[m] || {};
      ok(`${m}: indicador`, a.indicador === b.indicador, { py: a.indicador, js: b.indicador });
      ok(`${m}: gasto`, a.gasto === b.gasto, { py: a.gasto, js: b.gasto });
      ok(`${m}: resultados`, a.resultados === b.resultados, { py: a.resultados, js: b.resultados });
      ok(`${m}: impresiones`, a.impresiones === b.impresiones, { py: a.impresiones, js: b.impresiones });
      ok(`${m}: gasto sin resultado`,
         a.gasto_sin_resultado === b.gasto_sin_resultado,
         { py: a.gasto_sin_resultado, js: b.gasto_sin_resultado });
      ok(`${m}: costo por resultado`,
         (a.costo_por_resultado === null && b.costo_por_resultado === null) ||
         Math.abs((a.costo_por_resultado || 0) - (b.costo_por_resultado || 0)) < 1e-6,
         { py: a.costo_por_resultado, js: b.costo_por_resultado });
      ok(`${m}: el día típico sale de los mismos días`,
         JSON.stringify(a.referencia) === JSON.stringify(b.referencia),
         { py: a.referencia, js: b.referencia });
      ok(`${m}: avance`, JSON.stringify(a.avance) === JSON.stringify(b.avance),
         { py: a.avance, js: b.avance });
    }
    ok("los mismos mercados, ni uno más",
       JSON.stringify(Object.keys(esperado.por_mercado).sort()) ===
       JSON.stringify(Object.keys(mio.por_mercado || {}).sort()),
       { py: Object.keys(esperado.por_mercado), js: Object.keys(mio.por_mercado || {}) });
    ok("sin errores de JavaScript", errs.length === 0, errs);
    await pg.close();
  }

  console.log("\n══ 3 · el clic pide a Meta lo que tiene que pedir");
  {
    const filas = Array.isArray(CRUDO.ad_entities)
      ? CRUDO.ad_entities : JSON.parse(CRUDO.ad_entities);
    const { pg, errs } = await abre(nav, { payload: { ad_entities: filas } });
    const antes = await pg.evaluate(`(() => {
      const d = JSON.parse(document.getElementById("datos").textContent);
      return { piezas: d.pauta_diaria.piezas.length,
               inversion: (() => {
                 const s = document.getElementById("resumen");
                 const t = [...s.querySelectorAll("span")].find(
                   x => x.textContent.trim() === "Inversión");
                 const c = t.closest("div.bg-white");
                 return c.querySelector('div[class*="text-[34px]"]').textContent.trim();
               })() };
    })()`);
    await pg.click("#bActualizaHoy");
    await pg.waitForTimeout(900);
    const L = await pg.evaluate("window.__llamadas");
    ok("hubo exactamente una llamada", L.length === 1, L.length);
    if (L.length) {
      const c = L[0];
      ok("al conector de Meta", c.server === "Meta MCP", c.server);
      ok("al tool de lectura de entidades",
         c.tool === "ads_get_ad_entities", c.tool);
      ok("sobre la cuenta del proyecto",
         c.input.ad_account_id === "225318458221662", c.input.ad_account_id);
      /* El esquema del conector declara `time_range` como `type: "string"`:
         va JSON serializado, igual que `Rango.como_time_range()` en Python.
         Mandarlo como objeto devuelve `tool_error` y la primera version de
         esta prueba lo dio por bueno porque derivó la forma del CRUDO, donde
         `parametros` es un registro legible y no el payload que viajó. */
      ok("con `time_range` como TEXTO JSON, no como objeto",
         typeof c.input.time_range === "string", typeof c.input.time_range);
      const TR = (() => { try { return JSON.parse(c.input.time_range); }
                          catch (e) { return null; } })();
      ok("que parsea a un rango CERRADO de un solo día",
         !!TR && TR.since === TR.until && /^\d{4}-\d{2}-\d{2}$/.test(TR.since),
         c.input.time_range);
      ok("con el corte por país", JSON.stringify(c.input.breakdowns) ===
         JSON.stringify(["country"]), c.input.breakdowns);
      ok("con limit explícito (ADR-050)", c.input.limit === 1000, c.input.limit);
      ok("con el id de conversación de 20 caracteres",
         typeof c.input.client_conversation_id === "string" &&
         c.input.client_conversation_id.length === 20,
         c.input.client_conversation_id);
      ok("saltándose la caché a propósito",
         !!(c.opts && c.opts.cache && c.opts.cache.refresh === true), c.opts);
      /* Meta es SOLO LECTURA (regla 8). Que el tool sea de lectura no es un
         detalle: es la regla más dura del proyecto. */
      ok("el tool pedido NO escribe nada en Meta",
         /^ads_get_/.test(c.tool), c.tool);
    }

    /* Medido contra Meta el 2026-09-16: la respuesta trae `next_cursor` AUNQUE
     no quede nada —la página siguiente vino vacía—, así que el cursor no se
     puede ignorar por «seguro que cabe en una». Un truncamiento silencioso se
     ve igual de completo que el dato completo (ADR-050). */
  console.log("\n══ 3b · el cursor se sigue, y si no se apaga NO se publica");
  {
    const filas = Array.isArray(CRUDO.ad_entities)
      ? CRUDO.ad_entities : JSON.parse(CRUDO.ad_entities);
    const corte = Math.max(1, Math.floor(filas.length / 2));
    const { pg, errs } = await abre(nav, { paginas: [
      { ad_entities: filas.slice(0, corte), pagination: { next_cursor: "CUR-1" } },
      { ad_entities: filas.slice(corte) }
    ] });
    await pg.click("#bActualizaHoy");
    await pg.waitForTimeout(900);
    const L = await pg.evaluate("window.__llamadas");
    ok("partido en dos páginas, hubo DOS llamadas", L.length === 2, L.length);
    ok("la segunda mandó el cursor de la primera",
       L[1] && L[1].input.cursor === "CUR-1", L[1] && L[1].input.cursor);
    ok("y todo lo demás viajó idéntico, que es lo que pide el esquema",
       L[1] && ["ad_account_id", "level", "time_range", "limit",
                "client_conversation_id"].every(
         k => JSON.stringify(L[0].input[k]) === JSON.stringify(L[1].input[k])),
       L[1] && L[1].input);
    const franja = await pg.evaluate(
      `document.getElementById("avisoHoy") ? "" : "sin aviso"`);
    ok("sin aviso de error: la lectura se completó", franja === "sin aviso", franja);
    /* Lo que importa no es que llame dos veces, sino que el número que sale
       sea el MISMO que con las filas juntas. */
    const partido = await pg.evaluate(`(() => {
      const d = JSON.parse(document.getElementById("datos").textContent);
      return d.pauta_diaria.dia_en_curso.por_mercado;
    })()`);
    const entero = await pg.evaluate(`(() => {
      const d = JSON.parse(document.getElementById("datos").textContent);
      return window.__bloqueDelDia(${JSON.stringify(filas)},
        ${JSON.stringify(CRUDO._metadatos.parametros.time_range.since)},
        d.pauta_diaria.piezas, null).por_mercado;
    })()`);
    ok("dos páginas dan el mismo número que una sola",
       JSON.stringify(partido) === JSON.stringify(entero),
       { partido, entero });
    ok("sin errores de JavaScript", errs.length === 0, errs);
    await pg.close();
  }
  {
    const filas = Array.isArray(CRUDO.ad_entities)
      ? CRUDO.ad_entities : JSON.parse(CRUDO.ad_entities);
    const { pg, errs } = await abre(nav, { paginas: [
      { ad_entities: filas, pagination: { next_cursor: "NUNCA-SE-APAGA" } }
    ] });
    const antes = await pg.evaluate(`(() => {
      const d = JSON.parse(document.getElementById("datos").textContent);
      return JSON.stringify(d.pauta_diaria.dia_en_curso.por_mercado);
    })()`);
    await pg.click("#bActualizaHoy");
    await pg.waitForTimeout(1200);
    const L = await pg.evaluate("window.__llamadas");
    ok("un cursor que no se apaga se corta en 5 vueltas, no gira para siempre",
       L.length === 5, L.length);
    const aviso = await pg.evaluate(
      `(document.getElementById("avisoHoy") || {}).textContent || ""`);
    ok("y lo DICE en vez de publicar un total parcial",
       /incompleta/.test(aviso), aviso);
    const desp = await pg.evaluate(`(() => {
      const d = JSON.parse(document.getElementById("datos").textContent);
      return JSON.stringify(d.pauta_diaria.dia_en_curso.por_mercado);
    })()`);
    ok("el dato de antes sigue intacto", antes === desp, { antes, desp });
    ok("sin errores de JavaScript", errs.length === 0, errs);
    await pg.close();
  }

  console.log("\n══ 3c · el refresco se GUARDA: recargar no lo borra");
  {
    const filas = Array.isArray(CRUDO.ad_entities)
      ? CRUDO.ad_entities : JSON.parse(CRUDO.ad_entities);
    const { pg, errs } = await abre(nav, { payload: { ad_entities: filas } });
    await pg.click("#bActualizaHoy");
    await pg.waitForTimeout(1200);
    /* El HTML publicado se trae ENTERO y se parsea acá, no dentro de la página:
       una expresión regular anidada en un template literal es ilegible y ya
       rompió una vez. */
    const html = await pg.evaluate("window.__publicado || ''");
    ok("el clic publicó el estado, no se quedó solo en memoria", !!html, !!html);
    let dia = null;
    if (html) {
      const abre_ = html.indexOf('<script id="datos"');
      const cuerpo = abre_ >= 0 ? html.slice(html.indexOf(">", abre_) + 1) : "";
      /* El cierre real es `</script>`: `documento()` lo escribe como
         "<\\/script>" en el fuente, que en JS ES `</script>`. Lo que sí viaja
         escapado es cualquier `</script` DENTRO del JSON, y por eso se
         desescapa abajo. Buscar el escapado dejaba `cierra` en -1 y parseaba
         el resto del documento. */
      const cierra = cuerpo.indexOf("</script");
      try {
        dia = JSON.parse(cuerpo.slice(0, cierra < 0 ? undefined : cierra)
                               .replace(/<\\\//g, "</"))
                  .pauta_diaria.dia_en_curso;
      } catch (e) { dia = { _error: e.message }; }
    }
    ok("y lo publicado trae el día leído en la página",
       !!(dia && dia._leido_en_la_pagina === true), dia && Object.keys(dia));
    ok("con la fecha de hoy y marcado como de hoy",
       !!(dia && dia.es_de_hoy === true && /^\d{4}-\d{2}-\d{2}$/.test(dia.fecha)),
       dia && { fecha: dia.fecha, es_de_hoy: dia.es_de_hoy });
    ok("sin errores de JavaScript", errs.length === 0, errs);
    await pg.close();
  }

  console.log("\n══ 4 · y NO toca nada más que la franja");
    const desp = await pg.evaluate(`(() => {
      const d = JSON.parse(document.getElementById("datos").textContent);
      return { piezas: d.pauta_diaria.piezas.length,
               inversion: (() => {
                 const s = document.getElementById("resumen");
                 const t = [...s.querySelectorAll("span")].find(
                   x => x.textContent.trim() === "Inversión");
                 const c = t.closest("div.bg-white");
                 return c.querySelector('div[class*="text-[34px]"]').textContent.trim();
               })() };
    })()`);
    ok("`piezas` no cambió", desp.piezas === antes.piezas,
       { antes: antes.piezas, después: desp.piezas });
    ok("la Inversión no cambió", desp.inversion === antes.inversion,
       { antes: antes.inversion, después: desp.inversion });
    ok("sin errores de JavaScript", errs.length === 0, errs);
    await pg.close();
  }

  console.log("\n══ 5 · cada falla dice QUÉ hacer, y no borra el dato");
  /* El anti-patrón nombrado del contrato es colapsar todos los códigos en un
     «algo salió mal»: esconde la única acción que destraba la página. */
  const CASOS = [
    ["server_not_connected", /Conectores/i],
    ["needs_reauth", /caduc/i],
    ["not_in_manifest", /publicar/i],
    ["blocked_by_policy", /pol[ií]tica/i],
    ["tool_error", /Meta respondió/i],
    ["server_unavailable", /no respondió/i],
  ];
  const textos = [];
  for (const [codigo, patron] of CASOS) {
    const { pg, errs } = await abre(nav, { error: { code: codigo } });
    await pg.click("#bActualizaHoy");
    await pg.waitForTimeout(700);
    /* Se lee el AVISO, no la franja entera: comparar el texto completo dejaba
       pasar seis mensajes idénticos porque todos comparten el prefijo de la
       tarjeta. La primera versión de esta prueba lo dio por bueno. */
    const F = await pg.evaluate(`(() => {
      const a = document.getElementById("avisoHoy");
      const f = document.getElementById("diaEnCurso");
      return { aviso: a ? a.textContent.replace(/\\s+/g, " ").trim() : "",
               hayCifra: !!(f && /\\$\\d/.test(f.textContent)) };
    })()`);
    ok(`${codigo}: hay un aviso`, !!F.aviso);
    ok(`${codigo}: explica el arreglo`, patron.test(F.aviso), F.aviso);
    ok(`${codigo}: el dato de antes sigue en pantalla`, F.hayCifra);
    ok(`${codigo}: sin errores de JavaScript`, errs.length === 0, errs);
    textos.push(F.aviso);
    await pg.close();
  }
  /* Y que no sean todos el mismo párrafo, que es el anti-patrón exacto. */
  ok("los seis mensajes son distintos entre sí",
     new Set(textos).size === textos.length, new Set(textos).size);

  await nav.close();
  console.log(fallos ? `\n>>> ${fallos} FALLAS` : "\n>>> TODO OK");
  process.exit(fallos ? 1 : 0);
})();
