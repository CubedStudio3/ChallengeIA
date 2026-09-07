/* El botón APROBAR creando el work item en Zoho Sprints, probado con el ratón
   y con un conector SIMULADO.

   Por qué simulado: el conector real escribe en producción, y una prueba que
   crea items de verdad cada vez que corre es una prueba que nadie va a correr.
   Lo que se comprueba aquí es todo lo que está de este lado del `callTool`:
   que la idempotencia se consulte ANTES de crear, que el payload enviado sea
   EXACTAMENTE el que armó Python —y no un texto que la página se inventa—,
   que cada código de error tenga su propio arreglo a la vista, y que un fallo
   ambiguo vuelva a LEER en vez de volver a crear.

   El par petición/respuesta real de las dos herramientas se observó contra
   producción el 2026-09-04 (items I1163 a I1169), así que las formas que
   devuelve el doble no son inventadas: son las medidas.

   Uso: node pruebas/sprint_boton.js [archivo.html]
*/
const { chromium } = require("../node_modules/playwright");
const fs = require("fs");

const ARCHIVO = process.argv[2] ||
  "/home/user/ChallengeIA/salidas/tablero-mesa-creativa.html";

let fallos = 0;
const ok = (etiqueta, bien, detalle) => {
  if (!bien) fallos++;
  console.log("  " + (bien ? "ok  " : "FALLA ") + etiqueta +
    (detalle !== undefined ? "  -> " + JSON.stringify(detalle) : ""));
};

/* El doble del conector.

   Va INYECTADO EN EL HTML, antes del script del tablero, y no con
   `addInitScript`: ahí no llega a tiempo. Los scripts de inicialización corren
   al navegar, y `setContent` escribe sobre el documento que ya existe, así que
   el tablero arrancaba viendo `window.claude` sin definir, se declaraba de
   solo lectura y deshabilitaba los botones. Los doce botones deshabilitados
   fueron la pista. */
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

const VACIO = { payload: { status: "success", data: { items: [] } } };
const CREADO = { payload: { status: "success",
  data: { addedItemId: "21897000009999001", itemNo: "I9999",
          statusId: "21897000000156037", status: "success" } } };
const YA = (marca, duenio) => ({ payload: { status: "success", data: { items: [
  { itemNo: "1163", itemId: "21897000001566072",
    sprintId: "21897000000139025",
    /* «Unassigned» es un id de verdad —21897000000002005, medido en
       producción—, no un hueco. El doble lo devuelve así a propósito. */
    ownerId: [duenio || "21897000000002005"],
    itemName: "Una carta cualquiera [MC:" + marca + "]" }] } } });
const REASIGNADO = (id) => ({ payload: { status: "success",
  data: { followers: [], ownerIds: [id], status: "success" } } });

const abre = async (nav, guion) => {
  const pg = await nav.newPage({ viewport: { width: 1440, height: 2400 } });
  const errs = [];
  pg.on("pageerror", e => errs.push(e.message));
  await pg.setContent(
    '<!doctype html><html lang="es"><head><meta charset="utf-8">' +
    '<style>body{margin:0;font:14px system-ui;background:#fbfbfa}</style>' +
    "</head><body><script>" + DOBLE(guion) + "<\/script>" +
    fs.readFileSync(ARCHIVO, "utf8") + "</body></html>",
    { waitUntil: "load" });
  await pg.waitForTimeout(1400);
  return { pg, errs };
};

/* Aprobar la primera carta APROBABLE, con el ratón, como una persona.
   No sirve «la primera»: la de liquidación diaria está bloqueada en GT, que es
   el mercado activo por defecto, y su botón sale deshabilitado a propósito.
   Una prueba que da por hecho que el primer botón se puede pulsar estaría
   probando el orden de la lista, no el flujo. */
const primeraAprobable = `(() => {
  const bs = [...document.querySelectorAll(
    '#estrategia [data-decidir][data-estado="aceptada"]')];
  const b = bs.find(x => !x.disabled);
  return b ? b.getAttribute("data-decidir") : null;
})()`;

const apruebaPrimera = async (pg) => {
  const id = await pg.evaluate(primeraAprobable);
  if (!id) return null;
  await pg.click('#estrategia [data-decidir="' + id + '"][data-estado="aceptada"]');
  await pg.waitForTimeout(900);
  return id;
};

const leeCarta = (id) => `(() => {
  const b = document.querySelector('[data-decidir="${id}"]');
  const card = b ? b.closest("div.bg-white") : null;
  return { txt: card ? card.innerText : null,
           estado: (window.__tablero ? null : null) };
})()`;

(async () => {
  const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

  // ── 1 · el caso feliz ────────────────────────────────────────────────
  console.log("\n══ aprobar crea el item");
  {
    const { pg, errs } = await abre(nav, {
      ZohoSprints_GetItems: [VACIO], ZohoSprints_CreateItem: [CREADO] });
    const id = await apruebaPrimera(pg);
    ok("hay una carta que aprobar", !!id, id);
    const ll = await pg.evaluate("window.__llamadas");
    ok("primero consulta la idempotencia, después crea",
       ll.length === 2 && ll[0].tool === "ZohoSprints_GetItems" &&
       ll[1].tool === "ZohoSprints_CreateItem",
       ll.map(x => x.tool));
    ok("la búsqueda va por la marca de la carta",
       ll[0] && String(ll[0].input.query_params.searchvalue).indexOf("::") > 0,
       ll[0] && ll[0].input.query_params.searchvalue);
    ok("la búsqueda NO se sirve de caché",
       ll[0] && ll[0].opts && ll[0].opts.cache === false);
    // EL GUARDIA QUE IMPORTA: el payload es el que armó Python, no uno nuevo.
    const esperado = await pg.evaluate(`(() => {
      const cs = JSON.parse(document.getElementById("datos").textContent).cartas.cartas;
      const c = cs.filter(x => x.id === ${JSON.stringify(id)})[0];
      return c ? c.sprint : null;
    })()`);
    const env = ll[1] && ll[1].input.query_params;
    ok("el nombre enviado es el de la corrida, al carácter",
       !!esperado && env.name === esperado.name);
    ok("la descripción enviada es la de la corrida, al carácter",
       !!esperado && env.description === esperado.description, 
       esperado && env.description === esperado.description ? undefined
         : (env && env.description || "").slice(0, 80));
    ok("va al backlog del proyecto de la corrida",
       ll[1].input.path_variables.projectId === "21897000000139001" &&
       ll[1].input.path_variables.sprintId === "21897000000139025");
    ok("sin responsable elegido NO se asigna a nadie",
       env.users === undefined, env.users);
    const t = await pg.evaluate(leeCarta(id));
    ok("la carta muestra el número de item", /I9999/.test(t.txt || ""));
    ok("sin errores de JavaScript", !errs.length, errs);
    await pg.close();
  }

  // ── 2 · idempotencia: ya existía ─────────────────────────────────────
  console.log("\n══ si ya existe, no se crea otro");
  {
    const { pg } = await abre(nav, { ZohoSprints_GetItems: [], ZohoSprints_CreateItem: [] });
    const marca = await pg.evaluate(`(() => {
      const cs = JSON.parse(document.getElementById("datos").textContent).cartas.cartas;
      const bs = [...document.querySelectorAll(
        '#estrategia [data-decidir][data-estado="aceptada"]')];
      const id = bs.find(x => !x.disabled).getAttribute("data-decidir");
      return (cs.filter(x => x.id === id)[0] || {}).idempotencia;
    })()`);
    await pg.close();
    const { pg: pg2 } = await abre(nav, {
      ZohoSprints_GetItems: [YA(marca)], ZohoSprints_CreateItem: [CREADO] });
    const id = await apruebaPrimera(pg2);
    const ll = await pg2.evaluate("window.__llamadas");
    ok("NO se llama a CreateItem",
       !ll.some(x => x.tool === "ZohoSprints_CreateItem"), ll.map(x => x.tool));
    const t = await pg2.evaluate(leeCarta(id));
    ok("y la carta dice que ya estaba", /[Yy]a estaba en Sprints/.test(t.txt || ""));
    ok("con el número del item que ya existía", /I1163/.test(t.txt || ""));
    await pg2.close();
  }

  // ── 3 · un error tipado tiene su propio arreglo a la vista ───────────
  console.log("\n══ cada error dice cómo se arregla");
  for (const [code, aguja] of [
    ["server_not_connected", /agregar Zoho Sprints/i],
    ["needs_reauth", /reconectar Zoho Sprints/i],
    ["selection_required", /más de un conector/i],
    ["tool_error", /Sprints respondió con un error/i],
  ]) {
    const { pg } = await abre(nav, {
      ZohoSprints_GetItems: [{ error: { code: code, message: "x" } }] });
    const id = await apruebaPrimera(pg);
    const t = await pg.evaluate(leeCarta(id));
    ok(code + " · explica el arreglo", aguja.test(t.txt || ""),
       aguja.test(t.txt || "") ? undefined : (t.txt || "").slice(-160));
    ok(code + " · la decisión NO se perdió",
       await pg.evaluate(`!!(document.querySelector('[data-decidir="${id}"]')
          .closest("div.bg-white").innerText.match(/Aceptada/))`));
    await pg.close();
  }

  // ── 4 · el ambiguo vuelve a LEER, no a crear ─────────────────────────
  console.log("\n══ un fallo ambiguo no duplica");
  {
    // Falla el create con server_unavailable, y la relectura lo encuentra.
    const { pg } = await abre(nav, {
      ZohoSprints_GetItems: [VACIO, null],
      ZohoSprints_CreateItem: [{ error: { code: "server_unavailable",
                                          message: "timeout", retryable: true } }] });
    const marca = await pg.evaluate(`(() => {
      const cs = JSON.parse(document.getElementById("datos").textContent).cartas.cartas;
      const bs = [...document.querySelectorAll(
        '#estrategia [data-decidir][data-estado="aceptada"]')];
      const id = bs.find(x => !x.disabled).getAttribute("data-decidir");
      return (cs.filter(x => x.id === id)[0] || {}).idempotencia;
    })()`);
    await pg.close();
    const { pg: p2 } = await abre(nav, {
      ZohoSprints_GetItems: [VACIO, YA(marca)],
      ZohoSprints_CreateItem: [{ error: { code: "server_unavailable",
                                          message: "timeout", retryable: true } }] });
    const id = await apruebaPrimera(p2);
    await p2.waitForTimeout(600);
    const ll = await p2.evaluate("window.__llamadas");
    ok("se vuelve a leer el backlog",
       ll.filter(x => x.tool === "ZohoSprints_GetItems").length === 2,
       ll.map(x => x.tool));
    ok("NO se vuelve a crear",
       ll.filter(x => x.tool === "ZohoSprints_CreateItem").length === 1);
    const t = await p2.evaluate(leeCarta(id));
    ok("y se reporta como creado, porque sí quedó", /I1163/.test(t.txt || ""));
    await p2.close();

    // Y si la relectura NO lo encuentra: se ofrece reintentar, no se afirma nada.
    const { pg: p3 } = await abre(nav, {
      ZohoSprints_GetItems: [VACIO, VACIO],
      ZohoSprints_CreateItem: [{ error: { code: "upstream_error", message: "x" } }] });
    const id3 = await apruebaPrimera(p3);
    await p3.waitForTimeout(600);
    const t3 = await p3.evaluate(leeCarta(id3));
    ok("si no está, lo dice y ofrece reintentar",
       /no está/.test(t3.txt || "") && /Volver a intentar/.test(t3.txt || ""));
    await p3.close();
  }

  // ── 5 · sin conector, la página sigue sirviendo ──────────────────────
  console.log("\n══ sin conector no se rompe nada");
  {
    const pg = await nav.newPage({ viewport: { width: 1440, height: 2400 } });
    const errs = [];
    pg.on("pageerror", e => errs.push(e.message));
    await pg.setContent(
      '<!doctype html><html lang="es"><head><meta charset="utf-8"></head><body>' +
      "<script>window.claude = { use: async (n) => (n === 'artifact' " +
      "? { publish: async () => ({}) } : null) };<\/script>" +
      fs.readFileSync(ARCHIVO, "utf8") + "</body></html>", { waitUntil: "load" });
    await pg.waitForTimeout(1400);
    const id = await apruebaPrimera(pg);
    ok("se puede aprobar igual", !!id, id);
    const t = await pg.evaluate(leeCarta(id));
    ok("la carta queda aceptada", /Aceptada/.test(t.txt || ""));
    ok("y no promete nada de Sprints",
       !/Crear en Sprints|Creada en Sprints/.test(t.txt || ""));
    ok("sin errores de JavaScript", !errs.length, errs);
    await pg.close();
  }

  /* ── 6 · el responsable ──────────────────────────────────────────────

     Lo reportó Mercadeo el 2026-09-07: «no me deja asignar a dulce desde el
     tablero, solo a jeremy». Medido contra producción, la API acepta a
     cualquiera de los tres —se creó y se borró un item con Dulce como dueño—,
     así que el defecto estaba de este lado: el selector solo aparecía DESPUÉS
     de aprobar y `users` solo viaja en la creación, así que ningún item podía
     nacer con responsable y elegirlo después no llegaba a ningún lado. La
     tarjeta mostraba un nombre que Sprints no tenía. */
  const DULCE = "21897000001319001";
  const JEREMY = "21897000001317019";

  console.log("\n══ el responsable se elige ANTES de aprobar");
  {
    const { pg, errs } = await abre(nav, {
      ZohoSprints_GetItems: [VACIO], ZohoSprints_CreateItem: [CREADO] });
    const id = await pg.evaluate(primeraAprobable);
    const sel = 'select[data-asignar="' + id + '"]';
    const hay = await pg.$(sel);
    ok("el selector está antes de decidir", !!hay);
    const ops = await pg.evaluate(`[...document.querySelectorAll('${sel} option')]
      .map(o => o.value)`);
    ok("ofrece a las tres personas", ops.length === 4, ops);
    ok("Dulce está entre las opciones", ops.indexOf(DULCE) >= 0);

    await pg.selectOption(sel, DULCE);
    await pg.waitForTimeout(400);
    ok("el selector se queda en Dulce",
       (await pg.$eval(sel, e => e.value)) === DULCE);
    ok("elegir responsable NO crea nada en Sprints todavía",
       (await pg.evaluate("window.__llamadas")).length === 0);

    await pg.click('#estrategia [data-decidir="' + id + '"][data-estado="aceptada"]');
    await pg.waitForTimeout(900);
    const ll = await pg.evaluate("window.__llamadas");
    const cre = ll.find(x => x.tool === "ZohoSprints_CreateItem");
    ok("el item nace CON el responsable", !!cre &&
       cre.input.query_params.users === JSON.stringify([DULCE]),
       cre && cre.input.query_params.users);
    const t = await pg.evaluate(leeCarta(id));
    ok("y la tarjeta dice que quedó asignada a Dulce",
       /Asignada a Dulce/.test(t.txt || ""), (t.txt || "").slice(0, 0));
    ok("sin errores de JavaScript", !errs.length, errs);
    await pg.close();
  }

  console.log("\n══ cambiar el responsable después llega a Sprints");
  {
    const { pg, errs } = await abre(nav, {
      ZohoSprints_GetItems: [VACIO], ZohoSprints_CreateItem: [CREADO],
      ZohoSprints_UpdateItem: [REASIGNADO(DULCE)] });
    const id = await apruebaPrimera(pg);
    const sel = 'select[data-asignar="' + id + '"]';
    ok("el item se creó sin responsable",
       (await pg.evaluate("window.__llamadas"))
         .find(x => x.tool === "ZohoSprints_CreateItem")
         .input.query_params.users === undefined);
    let t = await pg.evaluate(leeCarta(id));
    ok("y la tarjeta lo dice, no lo esconde",
       /Sin responsable en Sprints/.test(t.txt || ""));

    await pg.selectOption(sel, DULCE);
    await pg.waitForTimeout(900);
    const up = (await pg.evaluate("window.__llamadas"))
      .find(x => x.tool === "ZohoSprints_UpdateItem");
    ok("se llama a UpdateItem", !!up);
    ok("con newusers = Dulce", up &&
       up.input.query_params.newusers === JSON.stringify([DULCE]),
       up && up.input.query_params.newusers);
    ok("y SIN delusers, porque no había nadie antes",
       up && up.input.query_params.delusers === undefined,
       up && up.input.query_params.delusers);
    ok("el itemId es el del item creado", up &&
       up.input.path_variables.itemId === "21897000009999001",
       up && up.input.path_variables.itemId);
    t = await pg.evaluate(leeCarta(id));
    ok("la tarjeta pasa a decir que está asignada a Dulce",
       /Asignada a Dulce/.test(t.txt || ""));
    ok("sin errores de JavaScript", !errs.length, errs);
    await pg.close();
  }

  console.log("\n══ reasignar saca al anterior");
  {
    const { pg, errs } = await abre(nav, {
      ZohoSprints_GetItems: [VACIO], ZohoSprints_CreateItem: [CREADO],
      ZohoSprints_UpdateItem: [REASIGNADO(JEREMY), REASIGNADO(DULCE)] });
    const id = await pg.evaluate(primeraAprobable);
    const sel = 'select[data-asignar="' + id + '"]';
    await pg.selectOption(sel, JEREMY);
    await pg.click('#estrategia [data-decidir="' + id + '"][data-estado="aceptada"]');
    await pg.waitForTimeout(900);
    await pg.selectOption(sel, DULCE);
    await pg.waitForTimeout(900);
    const ups = (await pg.evaluate("window.__llamadas"))
      .filter(x => x.tool === "ZohoSprints_UpdateItem");
    ok("una sola llamada de reasignación", ups.length === 1, ups.length);
    ok("entra Dulce", ups[0] &&
       ups[0].input.query_params.newusers === JSON.stringify([DULCE]));
    ok("y sale Jeremy", ups[0] &&
       ups[0].input.query_params.delusers === JSON.stringify([JEREMY]),
       ups[0] && ups[0].input.query_params.delusers);
    ok("sin errores de JavaScript", !errs.length, errs);
    await pg.close();
  }

  console.log("\n══ si Sprints deja otro dueño, se dice");
  {
    /* La respuesta es la autoridad, no la petición. Se pide Dulce y Sprints
       contesta que quedó Jeremy: pintar «Asignada a Dulce» ahí sería la página
       afirmando algo que el sistema no tiene. */
    const { pg, errs } = await abre(nav, {
      ZohoSprints_GetItems: [VACIO], ZohoSprints_CreateItem: [CREADO],
      ZohoSprints_UpdateItem: [REASIGNADO(JEREMY)] });
    const id = await apruebaPrimera(pg);
    await pg.selectOption('select[data-asignar="' + id + '"]', DULCE);
    await pg.waitForTimeout(900);
    const t = await pg.evaluate(leeCarta(id));
    ok("no dice que quedó Dulce", !/Asignada a Dulce/.test(t.txt || ""));
    ok("dice que Sprints dejó otro responsable",
       /otro responsable/.test(t.txt || ""));
    ok("sin errores de JavaScript", !errs.length, errs);
    await pg.close();
  }

  console.log("\n══ un item que ya existía sin dueño no se declara asignado");
  {
    /* «Unassigned» es un id real. Si se tomara por persona, la tarjeta diría
       que el item tiene dueño cuando no lo tiene.

       La marca tiene que ser la DE VERDAD: con una inventada, `buscaEnSprints`
       no reconoce el item, el flujo sigue a CreateItem y lo que se acaba
       probando es otra cosa. Pasó en la primera corrida de esta prueba. */
    const { pg: pgm } = await abre(nav, {});
    const marca2 = await pgm.evaluate(`(() => {
      const cs = JSON.parse(document.getElementById("datos").textContent)
        .cartas.cartas;
      const bs = [...document.querySelectorAll(
        '#estrategia [data-decidir][data-estado="aceptada"]')];
      const id = bs.find(x => !x.disabled).getAttribute("data-decidir");
      return (cs.filter(x => x.id === id)[0] || {}).idempotencia;
    })()`);
    await pgm.close();
    const { pg, errs } = await abre(nav, {
      ZohoSprints_GetItems: [YA(marca2), YA(marca2)],
      ZohoSprints_UpdateItem: [REASIGNADO(DULCE)] });
    const id = await apruebaPrimera(pg);
    const t = await pg.evaluate(leeCarta(id));
    ok("dice que no hay responsable en Sprints",
       /Sin responsable en Sprints/.test(t.txt || ""));
    ok("y no nombra a Unassigned", !/Unassigned|21897000000002005/.test(t.txt || ""));
    ok("sin errores de JavaScript", !errs.length, errs);
    await pg.close();
  }

  await nav.close();
  console.log("\n" + (fallos ? ">>> " + fallos + " FALLA(S)" : ">>> TODO OK"));
  process.exit(fallos ? 1 : 0);
})();
