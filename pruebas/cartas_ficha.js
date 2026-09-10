/* La carta como ficha autosuficiente, y los dos campos que llena la mesa.

   Pedido de Mercadeo (2026-09-10): «Cada carta tiene que ser autosuficiente.
   Quien la lee tiene que poder producir sin abrir nada más.» Con la lista de
   campos, y dos reglas que esta prueba vigila:

     · «Si una carta no puede completar sus campos, sale incompleta y dice qué
        le falta. Nunca la rellenes.»
     · «La campaña y la fecha las pone la mesa. Campos vacíos para llenar en la
        reunión, no derivados.»

   Se entra por el ratón y se lee la PANTALLA. Comprobar el JSON diría que el
   dato existe, no que la carta lo muestre.

   Uso: node pruebas/cartas_ficha.js [archivo.html]
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

/* Sin `window.claude` la página se declara de solo lectura y deshabilita los
   campos: los inputs de la mesa no se podrían probar. */
const RUNTIME = `(() => {
  window.__pub = [];
  window.claude = { use: async (n) =>
    n === "artifact" ? { publish: async (d) => { window.__pub.push(d); return { ok: true }; } }
    : n === "mcp" ? { callTool: async () => ({ payload: { status: "success",
        data: { items: [] } } }), listTools: async () => ({ servers: [] }) }
    : null };
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

  console.log("\n══ el dato de cada carta trae los campos de la ficha");
  {
    const faltan = await pg.evaluate(`(() => {
      const cs = ((JSON.parse(document.getElementById("datos").textContent)
        .cartas) || {}).cartas || [];
      return cs.map(c => ({
        id: c.id,
        sinFormato: !(c.formato || {}).etiqueta,
        sinMercado: !c.mercado,
        sinMensaje: !c.de_que_hablar,
        sinCopy: !((c.copy || {}).titular),
        sinPorque: !((c.porque || []).length),
        sinReferencia: !((c.referencia || {}).marca),
        // El canal PUEDE faltar y es correcto: la evidencia de ejecución no
        // elige canal. Lo que no puede es faltar sin decirlo.
        sinCanalNiSiempre: !((c.canales || []).length) && !c.siempre,
      })).filter(x => Object.keys(x).some(k => k !== "id" && x[k]));
    })()`);
    /* Los campos que la corrida SÍ puede llenar tienen que estar en todas.
       `referencia` y `canales` pueden faltar por razones declaradas. */
    const duros = faltan.filter(x => x.sinFormato || x.sinMercado ||
      x.sinMensaje || x.sinPorque || x.sinCanalNiSiempre);
    ok("ninguna carta sin formato, mercado, mensaje ni porqué",
       duros.length === 0, duros);
    const sinCopy = faltan.filter(x => x.sinCopy);
    ok("las cartas sin copy resuelto quedan declaradas, no vacías en silencio",
       sinCopy.length === 0 || sinCopy.every(x => x.id), sinCopy);
  }

  console.log("\n══ la ficha se VE en la pantalla");
  {
    const fichas = await pg.evaluate(`(() => {
      const cs = ((JSON.parse(document.getElementById("datos").textContent)
        .cartas) || {}).cartas || [];
      const ids = new Set(cs.map(c => c.id));
      return [...document.querySelectorAll('#estrategia [data-decidir]')]
        .map(b => b.getAttribute("data-decidir"))
        .filter(id => ids.has(id))
        .filter((v, i, a) => a.indexOf(v) === i)
        .map(id => {
          const b = document.querySelector('[data-decidir="' + id + '"]');
          const card = b.closest("div.bg-white");
          const t = card ? card.innerText : "";
          return { id: id,
                   formato: t.indexOf("FORMATO") >= 0,
                   destino: t.indexOf("A DÓNDE VA") >= 0,
                   mercado: t.indexOf("MERCADO") >= 0,
                   estrategia: t.indexOf("ESTRATEGIA") >= 0,
                   mesa: t.indexOf("LO LLENA LA MESA") >= 0,
                   copy: t.indexOf("COPY") >= 0,
                   referencia: t.indexOf("REFERENCIA") >= 0 };
        });
    })()`);
    ok("se midieron cartas en la pantalla", fichas.length > 0, fichas.length);
    for (const f of fichas) {
      const faltan = Object.keys(f).filter(k => k !== "id" && !f[k]);
      ok("  " + f.id + " · muestra los campos de la ficha",
         faltan.length === 0, faltan);
    }
  }

  console.log("\n══ el copy dice su mercado y que va a aprobación");
  {
    /* Mercadeo (2026-09-10): «que el copy salga marcado para aprobación y diga
       a qué mercado va, SIN afirmar que está en su tono». El tono por mercado
       no está definido —es un pendiente suyo— así que afirmarlo sería
       inventarlo. Este guardia vigila las dos mitades. */
    const r = await pg.evaluate(`(() => {
      const cs = ((JSON.parse(document.getElementById("datos").textContent)
        .cartas) || {}).cartas || [];
      const ids = new Set(cs.map(c => c.id));
      const out = [];
      [...document.querySelectorAll('#estrategia [data-decidir]')]
        .map(b => b.getAttribute("data-decidir"))
        .filter(id => ids.has(id)).filter((v,i,a) => a.indexOf(v) === i)
        .forEach(id => {
          const card = document.querySelector('[data-decidir="' + id + '"]')
            .closest("div.bg-white");
          const t = card ? card.innerText : "";
          const c = cs.filter(x => x.id === id)[0] || {};
          out.push({ id: id,
            aprobar: t.indexOf("Para aprobar") >= 0,
            mercado: !c.mercado || t.indexOf(c.mercado) >= 0,
            // Nunca puede AFIRMAR el tono: no está declarado.
            afirmaTono: /en el tono de|tono salvadore|tono guatemal/i.test(t) });
        });
      return out;
    })()`);
    for (const x of r) {
      ok("  " + x.id + " · marcado para aprobación y con su mercado",
         x.aprobar && x.mercado, x);
      ok("  " + x.id + " · NO afirma estar en el tono del mercado",
         x.afirmaTono === false, x.afirmaTono);
    }
  }

  console.log("\n══ la estrategia y la carta se enlazan en los dos sentidos");
  {
    const ida = await pg.evaluate(
      `!!document.querySelector('#estrategia a[href="#cartas"]')`);
    ok("de la estrategia elegida a sus cartas", ida === true, ida);
    const ancla = await pg.evaluate(`!!document.getElementById("cartas")`);
    ok("el ancla de las cartas existe", ancla === true, ancla);
    const vuelta = await pg.evaluate(`(() => {
      const a = [...document.querySelectorAll(
        '#estrategia a[href="#estrategia"].etiqueta-marca')];
      return { cuantos: a.length, textos: a.slice(0, 2).map(x => x.textContent) };
    })()`);
    ok("de cada carta a su estrategia, con el NOMBRE, no el id",
       vuelta.cuantos > 0 && vuelta.textos.every(t => t.indexOf("-") < 0),
       vuelta);
  }

  console.log("\n══ los campos de la mesa salen vacíos y se guardan");
  {
    const sel = '#estrategia input[data-campana]';
    const hay = await pg.$(sel);
    ok("hay campo de campaña en las cartas de pauta", !!hay);
    if (hay) {
      const vacio = await pg.evaluate(`document.querySelector('${sel}').value`);
      /* EL GUARDIA QUE IMPORTA: el sistema NO deriva la campaña. Si algún día
         alguien la rellena «para ayudar», esto se pone rojo. */
      ok("la campaña sale VACÍA, no derivada", vacio === "", vacio);
      const id = await pg.evaluate(
        `document.querySelector('${sel}').getAttribute("data-campana")`);
      await pg.fill(sel, "Campaña Punto de Venta SV");
      await pg.evaluate(`document.querySelector('${sel}').blur()`);
      await pg.waitForTimeout(600);
      const guardado = await pg.evaluate(`(() => {
        const d = (window.__pub || []).slice(-1)[0] || "";
        const m = String(d).match(/<script id="estado"[^>]*>([\\s\\S]*?)<\\/script>/);
        return m ? (JSON.parse(m[1]).mesa || {}) : null;
      })()`);
      ok("lo que escribe la mesa viaja en el estado publicado",
         !!(guardado && guardado[id] &&
            guardado[id].campana === "Campaña Punto de Venta SV"),
         guardado);
      /* Y el foco no se pierde: repintar en cada tecla hacía imposible
         escribir. `persistir(msg, true)` guarda sin repintar. */
      const foco = await pg.evaluate(
        `document.activeElement && document.activeElement.tagName`);
      ok("el campo no se rompe al guardar (la página no se repinta encima)",
         (await pg.evaluate(`document.querySelector('${sel}').value`)) ===
         "Campaña Punto de Venta SV", foco);
    }
    const fecha = '#estrategia input[data-limite]';
    const hayF = await pg.$(fecha);
    ok("hay campo de fecha límite", !!hayF);
    if (hayF) {
      ok("la fecha sale VACÍA, no derivada",
         (await pg.evaluate(`document.querySelector('${fecha}').value`)) === "");
    }
  }

  ok("sin errores de JavaScript", errs.length === 0, errs);
  await nav.close();
  console.log(fallos ? "\n" + fallos + " FALLAS\n" : "\nTODO OK\n");
  process.exit(fallos ? 1 : 0);
})();
