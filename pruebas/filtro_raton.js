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
/* Las piezas salen del RESULTADO DE LA CORRIDA, en el repositorio.

   Antes salían de `/tmp/kpi/esperado.json`, un archivo fuera del repositorio
   escrito a mano el 4 de septiembre. Al cargar junio, julio y agosto quedó
   viejo —36 piezas del 26 de agosto al 3 de septiembre— y con él todas las
   fechas que esta prueba deriva: PRIMERO, ULTIMO, MEDIO y las sumas. Reportó
   un fallo que era suyo.

   Es EXACTAMENTE la trampa que ya se había arreglado para `prueba:filtro`
   creando `pruebas/esperado_pauta.py` dentro del repositorio; esta prueba
   se quedó con el fixture de /tmp y volvió a caer en lo mismo. Un esperado
   que vive fuera del repositorio no se regenera con el dato: caduca en
   silencio y después acusa al producto. */
const CORRIDA = process.argv[3] ||
  "/home/user/ChallengeIA/data/historico/2026-09-04_25ago_a_03sep/analisis/resultado.json";
const RES = JSON.parse(fs.readFileSync(CORRIDA, "utf8"));
const PIEZAS = ((RES.pauta_diaria || {}).piezas) || [];
if (!PIEZAS.length) {
  console.error("La corrida no trae piezas de pauta diaria: " + CORRIDA);
  process.exit(1);
}
/* Las ventanas se DERIVAN de las piezas de esta corrida. Escritas a mano,
   caducaban en cuanto el periodo cambiaba: la corrida del 4 de septiembre las
   recortaba todas al tope y la prueba reportaba doce fallos que eran suyos. */
const DIAS = [...new Set(PIEZAS.map(p => p.f))].sort();
const PRIMERO = DIAS[0], ULTIMO = DIAS[DIAS.length - 1];
/* La VENTANA DE LA CORRIDA no es el primer y el último día con dato: desde que
   hay meses históricos cargados (ADR-050) el dato empieza en junio y la corrida
   es la semana. El botón «El periodo de la corrida» lleva a ESTA ventana, no al
   tope del dato, así que la prueba tiene que compararla contra ella. */
const VC = (RES.pauta_diaria || {}).ventana_de_la_corrida || null;
const CORR_INI = VC ? VC.desde : PRIMERO;
const CORR_FIN = VC ? VC.hasta : ULTIMO;
const MEDIO = DIAS[Math.floor(DIAS.length / 2)];
const FUERA = (Number(PRIMERO.slice(0, 4)) - 1) + PRIMERO.slice(4);  // un año antes
const suma = (a, b, m) => {
  const ps = PIEZAS.filter(p => p.f >= a && p.f <= b && p.k === "actions:lead" &&
                                (!m || p.p === m));
  const g = Math.round(ps.reduce((x, p) => x + p.g, 0) * 100) / 100;
  const r = ps.reduce((x, p) => x + (p.r || 0), 0);
  const c = new Set(ps.map(p => p.c)).size;
  return ps.length ? { gasto: g, resultados: r, campanas: c,
                       costo: r ? g / r : null } : null;
};
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
  // El tope real del control, leído de la página: es contra esto que se juzga
  // si una ventana recorta o no.
  /* El tope del DATO sale del dato, no de los `min`/`max` del input.

     Eran lo mismo hasta el 2026-09-07, cuando los límites nativos se abrieron
     un año por lado para que se pueda teclear el año —con min y max dentro del
     mismo año Chromium no deja escribirlo—. Desde entonces el input dice
     2025-01-01..2027-12-31 y el dato va de junio a septiembre: leer el tope del
     input hacía que la prueba esperara el 25 de diciembre de 2027. */
  const RD = (RES.pauta_diaria || {}).rango_disponible || {};
  const PRIMERO_TOPE = RD.desde || PRIMERO;
  const ULTIMO_TOPE = RD.hasta || ULTIMO;
  console.log("tope del control: " + PRIMERO_TOPE + " .. " + ULTIMO_TOPE + "\n");

  console.log("═══ 0 · el orden de segmentos del widget es el que la prueba supone ═══");
  console.log("    la corrida tiene " + DIAS.length + " días con pauta: " +
              PRIMERO + " .. " + ULTIMO);
  await teclea(pg, "fDesde", MEDIO);
  await pg.waitForTimeout(ESPERA);
  const f0 = await pg.evaluate(FOTO);
  ok("teclear mueve el campo", f0.desde !== ULTIMO && !!f0.desde, true);
  console.log("    tecleado " + MEDIO + " · el campo quedó en " + f0.desde +
    (f0.desde === MEDIO ? "" : "  (el widget completa segmentos a su manera; " +
     "lo que importa es que las cifras cuadren, y eso lo mide el paso 5)"));

  console.log("\n═══ 1 · TECLEANDO una ventana de un día ═══");
  await teclea(pg, "fHasta", MEDIO);
  await pg.waitForTimeout(ESPERA);
  let f = await pg.evaluate(FOTO);
  console.log("    campos: " + f.desde + " .. " + f.hasta);
  ok("los dos campos quedaron en el mismo día", f.desde === f.hasta, true);
  const E = suma(f.desde, f.hasta);
  if (E) {
    ok("leads", f.leads, String(E.resultados));
    ok("inversión", f.inversion, money(E.gasto));
    ok("costo", f.costo, money(Math.round(E.costo * 100) / 100));
    ok("el apoyo dice 1 día", /·\s*1 día en la ventana/.test(f.apoyo || ""), true);
  }

  console.log("\n═══ 2 · TECLEANDO una ventana de rango ═══");
  await teclea(pg, "fDesde", MEDIO);
  await pg.waitForTimeout(ESPERA);
  await teclea(pg, "fHasta", ULTIMO);
  await pg.waitForTimeout(ESPERA);
  f = await pg.evaluate(FOTO);
  console.log("    campos: " + f.desde + " .. " + f.hasta);
  ok("quedó un rango de más de un día", f.desde < f.hasta, true);
  const E2 = suma(f.desde, f.hasta);
  ok("leads", f.leads, String(E2.resultados));
  ok("inversión", f.inversion, money(E2.gasto));
  ok("costo", f.costo, money(Math.round(E2.costo * 100) / 100));

  /* VACIAR los campos es lo que devuelve la vista completa. «El periodo de la
     corrida» se quitó el 2026-09-07 —«no quiero más botones»— y esta es la
     única forma que queda de volver, así que es la que hay que probar. */
  const vacia = async () => {
    for (const id of ["fDesde", "fHasta"]) {
      await pg.focus("#" + id);
      for (let i = 0; i < 3; i++) await pg.keyboard.press("Delete");
      await pg.waitForTimeout(150);
    }
    await pg.click("#resumen h3");
    await pg.waitForTimeout(ESPERA);
  };

  console.log("\n═══ 3 · VACIAR los campos devuelve TODO el dato ═══");
  await vacia();
  f = await pg.evaluate(FOTO);
  const E3 = suma(PRIMERO_TOPE, ULTIMO_TOPE);
  ok("los campos quedan vacíos", (f.desde || "") + (f.hasta || ""), "");
  ok("inversión = todo el dato", f.inversion, money(E3.gasto));
  ok("leads = todo el dato", f.leads, E3.resultados.toLocaleString("en-US"));
  /* «días en la ventana» solo debe salir si el periodo de la corrida RECORTA
     algo. Cuando el rango disponible es exactamente el periodo —una corrida sin
     Zoho Analytics, donde el único dato con fecha es la pauta— elegirlo no
     recorta nada y el rótulo no corresponde. La prueba lo pedía siempre y esa
     expectativa era la equivocada, no el tablero. */
  /* Con los campos vacíos se está viendo TODO, así que no hay nada más
     ancho detrás y el rótulo «N días en la ventana» no corresponde. */
  ok("sin «días en la ventana» viendo todo",
     /\d+ días? en la ventana/.test(f.apoyo || ""), false);

  /* DOS atajos, y son los acordados. Si mañana vuelve un tercero, esto lo
     dice: la lista de botones es una decisión de producto, no un detalle. */
  console.log("\n═══ 4 · los atajos son dos, y son los acordados ═══");
  const atajos = await pg.evaluate(`(() => [...document.querySelectorAll(
    "[data-rango]")].map(b => [b.getAttribute("data-rango"),
                               b.textContent.trim()]))()`);
  ok("hay tres atajos", String(atajos.length), "3");
  ok("y son periodo · 7 · 30",
     atajos.map(a => a[0]).join(","), "periodo,7,30");
  console.log("    " + JSON.stringify(atajos.map(a => a[1])));
  ok("ninguno dice «Todo» ni «90»",
     /Todo|90/.test(atajos.map(a => a[1]).join(" ")), false);

  /* «Últimos 7 días» cuenta desde el último día CON DATO, no desde hoy, y el
     rango es cerrado: siete días son siete, no ocho. El esperado se calcula
     aquí a mano y no con la misma cuenta del tablero. */
  console.log("\n═══ 5 · CLIC en «Últimos 7 días» ═══");
  await pg.click('[data-rango="7"]');
  await pg.waitForTimeout(ESPERA);
  f = await pg.evaluate(FOTO);
  const sieteIni = (() => {
    const d = new Date(ULTIMO_TOPE + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - 6);
    const x = d.toISOString().slice(0, 10);
    return x < PRIMERO_TOPE ? PRIMERO_TOPE : x;   // recortado al dato
  })();
  ok("el campo Desde es el día correcto", f.desde, sieteIni);
  ok("el campo Hasta es el último con dato", f.hasta, ULTIMO_TOPE);
  ok("son 7 días de calendario, no 8",
     String(Math.round((new Date(f.hasta) - new Date(f.desde)) / 86400000) + 1),
     sieteIni === PRIMERO_TOPE ? String(Math.round(
       (new Date(ULTIMO_TOPE) - new Date(PRIMERO_TOPE)) / 86400000) + 1) : "7");
  const E7 = suma(sieteIni, ULTIMO_TOPE);
  ok("inversión", f.inversion, money(E7.gasto));
  ok("leads", f.leads, E7.resultados.toLocaleString("en-US"));
  ok("costo", f.costo, money(Math.round(E7.costo * 100) / 100));

  console.log("\n═══ 6 · vaciar deshace una ventana manual ═══");
  /* Es la única forma que queda de volver, y por eso se prueba DESPUÉS de una
     ventana estrecha: quien teclea una fecha corta tiene que poder salir. */
  await vacia();
  f = await pg.evaluate(FOTO);
  ok("inversión = todo el dato", f.inversion, money(E3.gasto));
  ok("los campos quedan vacíos", (f.desde || "") + (f.hasta || ""), "");
  /* El rótulo «N días en la ventana» sale si esta vista es más ANGOSTA que el
     dato disponible, que con tres meses cargados es cierto incluso mirando la
     semana. Antes esta prueba pedía su ausencia, y estaba bien mientras el
     periodo de la corrida FUERA todo el dato. Lo que prueba que la ventana
     manual se limpió es la línea de arriba: los campos vuelven al periodo. */
  ok("y sin «días en la ventana», porque se ve todo",
     /\d+ días? en la ventana/.test(f.apoyo || ""), false);

  console.log("\n═══ 7 · el invariante: las cifras SIEMPRE cuadran con los campos ═══");
  /* A prueba de idioma y de orden de segmentos: se teclea, se lee lo que
     quedó en los campos, y se exige que las cifras sean las de ESE rango.
     Aquí es donde se veía el error: los campos decían una cosa y las cifras
     otra. */
  const objetivos = [PRIMERO, MEDIO, ULTIMO, FUERA];
  for (const iso of objetivos) {
    await teclea(pg, "fDesde", iso);
    await pg.waitForTimeout(ESPERA);
    await teclea(pg, "fHasta", iso);
    await pg.waitForTimeout(ESPERA);
    f = await pg.evaluate(FOTO);
    /* Una fecha FUERA del dato ya no la rechaza el navegador —los límites
       nativos se abrieron para que se pueda teclear el año— así que el campo
       la muestra y el `change` la ignora. Eso no puede quedar mudo: el control
       lo dice mientras se escribe, y aquí se exige que lo diga. Comparar
       cifras contra un campo que la página declara ignorado no tendría
       sentido. */
    if (iso < PRIMERO_TOPE || iso > ULTIMO_TOPE) {
      const av = await pg.evaluate(`(() => {
        const n = document.getElementById("avisoFuera");
        return n ? n.textContent.trim() : "";
      })()`);
      ok("avisa que la fecha está fuera del dato",
         /fuera del dato/.test(av), true);
      ok("y dice que se ignora", /se ignora/.test(av), true);
      continue;
    }
    // La verdad se calcula sobre lo que los CAMPOS muestran, no sobre lo tecleado.
    const dias = PIEZAS.filter(p => p.f >= f.desde && p.f <= f.hasta);
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
  /* ── 8 · TECLEAR la fecha completa, en los dos campos seguidos ─────────

     Lo reportó Mercadeo tres veces y las dos primeras se arreglaron por el
     lado equivocado. Medido el 2026-09-07, aislado en un input pelado: con
     `min` y `max` dentro del MISMO año, Chromium no deja escribir el año y sus
     dígitos caen sobre el DÍA. 07/15/2026 quedaba en 26 de julio.

     Esta prueba teclea la fecha ENTERA —mes, día y año— con eventos de tecla
     reales, en los dos campos uno tras otro sin salir en medio, y exige que
     cada campo quede en lo que se escribió y que las cifras sean las de ESE
     rango. Es el único camino que no estaba cubierto: las comprobaciones
     anteriores tecleaban con `teclea()`, que asigna el valor. */
  console.log("\n═══ 8 · teclear la fecha COMPLETA en los dos campos ═══");
  {
    const DES = DIAS[Math.floor(DIAS.length * 0.25)];
    const HAS = DIAS[Math.floor(DIAS.length * 0.75)];
    const iso2us = d => d.slice(5, 7) + d.slice(8, 10) + d.slice(0, 4);
    const tecla = async (id, iso) => {
      await pg.focus("#" + id);
      for (const ch of iso2us(iso)) {
        await pg.keyboard.press(ch);
        await pg.waitForTimeout(60);
      }
      await pg.waitForTimeout(400);
    };
    await tecla("fDesde", DES);
    ok("«Desde» quedó en lo que se tecleó",
       await pg.$eval("#fDesde", e => e.value), DES);
    await tecla("fHasta", HAS);
    ok("«Hasta» quedó en lo que se tecleó",
       await pg.$eval("#fHasta", e => e.value), HAS);
    ok("y «Desde» NO se movió al teclear «Hasta»",
       await pg.$eval("#fDesde", e => e.value), DES);
    await pg.waitForTimeout(500);
    const f8 = await pg.evaluate(FOTO);
    const E8 = suma(DES, HAS);
    ok("inversión del rango tecleado", f8.inversion, money(E8.gasto));
    ok("leads del rango tecleado", f8.leads, E8.resultados.toLocaleString("en-US"));
  }

  await nav.close();
  process.exit(fallos || errs.length ? 1 : 0);
})();
