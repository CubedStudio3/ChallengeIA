/* El botón «Generar referencia visual» con un conector de Higgsfield SIMULADO.

   Por qué simulado: cada generación real cuesta créditos de una cuenta de
   verdad, y una prueba que gasta dinero cada vez que corre es una prueba que
   nadie corre. Lo que se comprueba es todo lo que está de este lado del
   `callTool`: que el prompt enviado sea EXACTAMENTE el que armó Python —y no
   uno que la página se inventa—, que el sondeo esté acotado, que un trabajo
   pagado nunca se pierda, y que la página NO intente mostrar la imagen con una
   etiqueta que el visor bloquea.

   El par petición/respuesta de las dos herramientas se observó contra la API
   real el 2026-09-10 (trabajos a971203b… y 81b722f1…), así que las formas que
   devuelve el doble no son inventadas: son las medidas. `generate_image`
   responde `{results:[{id, status:"pending", ...}]}` y `jobs_wait` responde
   `{jobs:[{status, result_url}], summary, all_terminal}`.

   Uso: node pruebas/imagen_boton.js [archivo.html]
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

const JOB = "81b722f1-0833-4415-9708-e724f30f80f6";
const URL_RES = "https://d8j0ntlcm91z4.cloudfront.net/user_x/hf_prueba.png";

const PEDIDO = { payload: { results: [
  { id: JOB, type: "image", status: "pending", model: "gpt_image_2" }] } };
const LISTO = { payload: {
  jobs: [{ index: 0, job_id: JOB, status: "completed", type: "image",
           model: "gpt_image_2", result_url: URL_RES }],
  summary: { total: 1, completed: 1, failed: 0, active: 0, errors: 0 },
  all_terminal: true } };
/* `poll_after_seconds: 0` a propósito: es lo que deja probar el tope de
   esperas en milisegundos en vez de en tres minutos reales. */
const CORRIENDO = { payload: {
  jobs: [{ index: 0, job_id: JOB, status: "in_progress", type: "image" }],
  summary: { total: 1, completed: 0, failed: 0, active: 1, errors: 0 },
  all_terminal: false, timed_out: true, poll_after_seconds: 0 } };
const FALLIDO = { payload: {
  jobs: [{ index: 0, job_id: JOB, status: "failed", type: "image" }],
  summary: { total: 1, completed: 0, failed: 1, active: 0, errors: 0 },
  all_terminal: true } };

const DOBLE = (guion) => `(() => {
  const g = ${JSON.stringify(guion)};
  window.__llamadas = [];
  const artefacto = { publish: async () => ({ ok: true }) };
  const mcp = {
    callTool: async (server, tool, input, opts) => {
      window.__llamadas.push({ server, tool, input, opts });
      const n = window.__llamadas.filter(x => x.tool === tool).length;
      const paso = (g[tool] || [])[n - 1] || (g[tool] || []).slice(-1)[0];
      if (!paso) return { payload: { status: "success", data: {} } };
      if (paso.error) {
        const e = new Error(paso.error.message || "fallo");
        Object.assign(e, paso.error);
        throw e;
      }
      return { payload: paso.payload };
    },
    listTools: async () => ({ servers: [] }),
  };
  window.claude = {
    use: async (n) => (n === "artifact" ? artefacto : n === "mcp" ? mcp : null),
  };
})()`;

const abre = async (nav, guion) => {
  const pg = await nav.newPage({ viewport: { width: 1440, height: 2400 } });
  const errs = [];
  pg.on("pageerror", e => errs.push(e.message));
  await pg.setContent(
    '<!doctype html><html lang="es"><head><meta charset="utf-8">' +
    '<style>body{margin:0;font:14px system-ui;background:#fbfbfa}</style>' +
    "</head><body><script>" + DOBLE(guion) + "<\/script>" +
    sinEstado(fs.readFileSync(ARCHIVO, "utf8")) + "</body></html>",
    { waitUntil: "load" });
  await pg.waitForTimeout(1400);
  return { pg, errs };
};

/* La primera carta con botón de imagen. No sirve «la primera carta»: la de
   liquidación diaria está bloqueada en el mercado activo por defecto y sus
   botones salen deshabilitados a propósito. */
const primeraConImagen = `(() => {
  const b = [...document.querySelectorAll('[data-imagen]')].find(x => !x.disabled);
  return b ? b.getAttribute("data-imagen") : null;
})()`;

const leeCarta = (id) => `(() => {
  const b = document.querySelector('[data-imagen="${id}"]');
  const card = b ? b.closest("div.bg-white") : null;
  return card ? card.innerText : null;
})()`;

(async () => {
  const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

  // ── 1 · el caso feliz ────────────────────────────────────────────────
  console.log("\n══ generar la referencia visual");
  {
    const { pg, errs } = await abre(nav, {
      generate_image: [PEDIDO], jobs_wait: [LISTO] });
    const id = await pg.evaluate(primeraConImagen);
    ok("hay una carta con botón de imagen", !!id, id);

    await pg.click('[data-imagen="' + id + '"]');
    await pg.waitForTimeout(1200);

    const ll = await pg.evaluate("window.__llamadas");
    ok("pide la imagen y después consulta el trabajo",
       ll.length === 2 && ll[0].tool === "generate_image" &&
       ll[1].tool === "jobs_wait", ll.map(x => x.tool));
    ok("llama al conector de Higgsfield, no al de Sprints",
       ll[0] && ll[0].server === "Higgsfield MCP", ll[0] && ll[0].server);

    // EL GUARDIA QUE IMPORTA: el prompt es el que armó Python.
    const esperado = await pg.evaluate(`(() => {
      const cs = JSON.parse(document.getElementById("datos").textContent)
        .cartas.cartas;
      const c = cs.filter(x => x.id === ${JSON.stringify(id)})[0];
      return c ? c.imagen : null;
    })()`);
    const env = ll[0] && ll[0].input && ll[0].input.params;
    ok("el prompt enviado es el de la corrida, al carácter",
       !!esperado && env && env.prompt === esperado.prompt,
       env && esperado && env.prompt === esperado.prompt ? undefined
         : (env && env.prompt || "").slice(0, 90));
    ok("manda el modelo, el aspecto, la resolución y la calidad de la corrida",
       env && env.model === esperado.model &&
       env.aspect_ratio === esperado.aspect_ratio &&
       env.resolution === esperado.resolution &&
       env.quality === esperado.quality,
       env && { model: env.model, aspecto: env.aspect_ratio,
                res: env.resolution, cal: env.quality });
    /* `_declara` es para la tarjeta, no para el modelo. Mandarlo sería mandar
       un parámetro que la API no conoce. */
    ok("NO manda las llaves internas de la petición",
       env && !("_declara" in env), env && Object.keys(env));
    ok("no gasta la cuota gratuita por su cuenta",
       env && env.use_unlim === false, env && env.use_unlim);
    ok("consulta el trabajo que devolvió la petición",
       ll[1] && ll[1].input.jobs && ll[1].input.jobs[0].job_id === JOB,
       ll[1] && ll[1].input.jobs);
    ok("la consulta NO se sirve de caché",
       ll[1] && ll[1].opts && ll[1].opts.cache === false);

    const txt = await pg.evaluate(leeCarta(id));
    ok("la tarjeta dice que la referencia está lista",
       /Referencia visual lista/.test(txt || ""));
    ok("y ofrece abrirla en otra pestaña",
       /Abrir la referencia/.test(txt || ""));
    /* El rótulo NO es decorativo: el titular dentro de la imagen lo escribió
       un modelo y esto es fintech. Si se cae, alguien manda una tilde mal
       puesta a aprobación legal. */
    ok("y la rotula como referencia, no como arte final",
       /Es referencia, no arte final/.test(txt || ""));

    const enlace = await pg.evaluate(`(() => {
      const a = document.querySelector('a[href="${URL_RES}"]');
      return a ? { destino: a.target, rel: a.rel } : null;
    })()`);
    ok("el enlace abre en otra pestaña y sin pasar referente",
       !!enlace && enlace.destino === "_blank" &&
       /noopener/.test(enlace.rel), enlace);

    /* LA TRAMPA MEDIDA: el visor bloquea toda imagen de otro dominio, sin
       error visible. Una etiqueta `<img>` dejaría un hueco gris que se lee
       como un error del tablero. */
    const img = await pg.evaluate(`(() => {
      return [...document.querySelectorAll("img")]
        .map(x => x.getAttribute("src") || "")
        .filter(x => /cloudfront|higgsfield/i.test(x));
    })()`);
    ok("NO intenta mostrar la imagen con una etiqueta que el visor bloquea",
       img.length === 0, img);

    ok("sin errores de JavaScript", !errs.length, errs);
    await pg.close();
  }

  // ── 2 · no se paga dos veces por distracción ─────────────────────────
  console.log("\n══ dos clics seguidos no cobran dos veces");
  {
    const { pg, errs } = await abre(nav, {
      generate_image: [PEDIDO], jobs_wait: [CORRIENDO] });
    const id = await pg.evaluate(primeraConImagen);
    await pg.click('[data-imagen="' + id + '"]');
    await pg.waitForTimeout(200);
    /* El botón se va del DOM mientras genera —la tarjeta pinta «Pidiendo la
       referencia…»—, así que el segundo intento se hace por el camino que una
       persona sí podría repetir: volver a invocar la acción. */
    await pg.evaluate(`(() => {
      const b = document.querySelector('[data-imagen="${id}"]');
      if (b) b.click();
    })()`);
    await pg.waitForTimeout(600);
    const ll = await pg.evaluate("window.__llamadas");
    ok("generate_image se llamó UNA sola vez",
       ll.filter(x => x.tool === "generate_image").length === 1,
       ll.map(x => x.tool));
    ok("sin errores de JavaScript", !errs.length, errs);
    await pg.close();
  }

  // ── 3 · el sondeo está acotado y el trabajo no se pierde ─────────────
  /* Un bucle sin techo contra un conector ajeno convierte un modelo lento en
     una página que consulta para siempre. Y al parar, lo que NO puede pasar es
     perder el id: el trabajo está pagado. */
  console.log("\n══ un trabajo lento se para y queda consultable");
  {
    const { pg, errs } = await abre(nav, {
      generate_image: [PEDIDO], jobs_wait: [CORRIENDO] });
    const id = await pg.evaluate(primeraConImagen);
    await pg.click('[data-imagen="' + id + '"]');
    /* 12 esperas con el piso de un segundo. El piso es del producto —un cero
       del conector no puede volverse un bucle caliente— así que la prueba
       espera de verdad: es el precio de probar el tope y no simularlo. */
    await pg.waitForTimeout(16000);
    const ll = await pg.evaluate("window.__llamadas");
    const consultas = ll.filter(x => x.tool === "jobs_wait").length;
    ok("el sondeo se detiene y no consulta para siempre",
       consultas > 1 && consultas <= 12, consultas);
    ok("NO vuelve a generar, que cobraría otra vez",
       ll.filter(x => x.tool === "generate_image").length === 1);
    const txt = await pg.evaluate(leeCarta(id)) ||
      await pg.evaluate(`(() => {
        const b = document.querySelector('[data-imagen-consulta="${id}"]');
        const c = b ? b.closest("div.bg-white") : null;
        return c ? c.innerText : null;
      })()`);
    ok("la tarjeta dice que está tardando", /Está tardando/.test(txt || ""),
       (txt || "").slice(0, 160));
    ok("y ofrece volver a CONSULTAR, que es gratis", await pg.evaluate(
       `!!document.querySelector('[data-imagen-consulta="${id}"]')`));
    /* El id del trabajo queda guardado: sin eso, un trabajo pagado se
       perdería en silencio al recargar. */
    const guardado = await pg.evaluate(`(() => {
      const b = document.querySelector('[data-imagen-consulta="${id}"]');
      return !!b;
    })()`);
    ok("el trabajo sigue identificado en el estado", guardado);
    ok("sin errores de JavaScript", !errs.length, errs);
    await pg.close();
  }

  // ── 4 · un trabajo fallido se dice, no se disfraza ───────────────────
  console.log("\n══ si Higgsfield falla, la tarjeta lo dice");
  {
    const { pg, errs } = await abre(nav, {
      generate_image: [PEDIDO], jobs_wait: [FALLIDO] });
    const id = await pg.evaluate(primeraConImagen);
    await pg.click('[data-imagen="' + id + '"]');
    await pg.waitForTimeout(1000);
    const txt = await pg.evaluate(`(() => {
      const b = document.querySelector('[data-imagen="${id}"]');
      const c = b ? b.closest("div.bg-white") : null;
      return c ? c.innerText : null;
    })()`);
    ok("dice que no se generó", /No se generó la referencia/.test(txt || ""),
       (txt || "").slice(0, 160));
    ok("y ofrece volver a intentar", await pg.evaluate(
       `!!document.querySelector('[data-imagen="${id}"]')`));
    ok("sin errores de JavaScript", !errs.length, errs);
    await pg.close();
  }

  // ── 5 · un error tipado del conector tiene su propio arreglo ─────────
  console.log("\n══ sin conector agregado, se dice cómo se agrega");
  {
    const { pg, errs } = await abre(nav, {
      generate_image: [{ error: { code: "server_not_connected",
                                  message: "no connector" } }] });
    const id = await pg.evaluate(primeraConImagen);
    await pg.click('[data-imagen="' + id + '"]');
    await pg.waitForTimeout(900);
    const txt = await pg.evaluate(`(() => {
      const b = document.querySelector('[data-imagen="${id}"]');
      const c = b ? b.closest("div.bg-white") : null;
      return c ? c.innerText : null;
    })()`);
    ok("nombra el conector que falta y dónde se agrega",
       /Conectores/i.test(txt || ""), (txt || "").slice(0, 200));
    ok("sin errores de JavaScript", !errs.length, errs);
    await pg.close();
  }

  await nav.close();
  console.log("\n" + (fallos ? ">>> " + fallos + " FALLA(S)" : ">>> TODO OK"));
  process.exit(fallos ? 1 : 0);
})();
