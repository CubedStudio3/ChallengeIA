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

/* ── La prueba fija su propio reloj y su propio flag ─────────────────────────
   Esta prueba VIVE de la relación entre el dato y el día de hoy, así que no
   puede depender de que el tablero publicado sea justo de hoy: el 2026-09-17
   se puso roja porque el bloque guardado era del 16 —correctísimo— y ella
   asumía «el dato es de hoy». Es la caducidad de siempre, ahora por el reloj.

   Se construye el punto de partida: el flag que Python escribió se fuerza al
   valor que cada sección quiere probar, y el reloj del navegador se ancla a la
   fecha del dato. Así «hoy» es cierto POR CONSTRUCCIÓN y la prueba dice lo
   mismo el martes que dentro de un año. */
const FRAGMENTO = fs.readFileSync(ARCHIVO, "utf8");

/* ── Y TAMBIÉN construye el BLOQUE, no solo el reloj ─────────────────────────
   El 2026-09-18 la pauta se apagó: Meta devolvió cero filas para hoy y el
   bloque publicado quedó sin un solo mercado. Ocho comprobaciones se pusieron
   rojas acusando al tablero de no pintar una cifra que no existe.

   Es la misma caducidad que ya se arregló para el reloj, un escalón más
   adentro: la prueba dependía de que la cuenta estuviera entregando. Ahora
   fabrica los dos estados —un día CON entrega y uno SIN— a partir de un día
   cerrado real de `pauta_meses/`, que es dato medido y no se mueve, y se los
   hace evaluar a Python para no escribir el esperado a mano. */
const { execFileSync } = require("child_process");
const path = require("path");
const os = require("os");
const py = (script, args) => JSON.parse(execFileSync("python3",
  [script].concat(args || []), { env: { ...process.env, PYTHONPATH: "src" },
  maxBuffer: 64 * 1024 * 1024 }).toString());

/* El JSON del tablero, sacado del fragmento. `documento()` escapa `</script`
   como `<\/script` DENTRO del JSON: hay que desescaparlo para parsear y
   volver a escaparlo al reinsertar, o el navegador corta el <script> a la
   mitad. */
const MARCA = '<script id="datos"';
const _ini = FRAGMENTO.indexOf(MARCA);
const _abre = FRAGMENTO.indexOf(">", _ini) + 1;
const _cierra = FRAGMENTO.indexOf("</script", _abre);
const DATOS = JSON.parse(FRAGMENTO.slice(_abre, _cierra).replace(/<\\\//g, "</"));
const conBloque = (bloque) => FRAGMENTO.slice(0, _abre) +
  JSON.stringify({ ...DATOS,
    pauta_diaria: { ...DATOS.pauta_diaria, dia_en_curso: bloque } })
    .replace(/<\//g, "<\\/") +
  FRAGMENTO.slice(_cierra);

/* Un día en curso con entrega, fabricado: las filas son de un día cerrado real
   y la fecha es el día siguiente al último dato cerrado, que es exactamente la
   relación que tiene un día en curso de verdad. */
const DIARIO = JSON.parse(fs.readFileSync(
  "data/historico/pauta_meses/2026-09/crudo/meta_campanas_por_pais_por_dia.json",
  "utf8"));
const _filas = (Array.isArray(DIARIO.ad_entities)
  ? DIARIO.ad_entities : JSON.parse(DIARIO.ad_entities));
const _gasto = (r) => parseFloat(
  String(r.amount_spent).replace(/[^\d,.-]/g, "").replace(",", "."));
const _conEntrega = _filas.filter((r) => _gasto(r) > 0 || +r.impressions > 0);
const _ultimoDia = _conEntrega.map((r) => r.date_start).sort().pop();
const FILAS = _conEntrega.filter((r) => r.date_start === _ultimoDia)
  .map(({ date_start, date_stop, ...resto }) => resto);

const TOPE = DATOS.pauta_diaria.rango_disponible.hasta;
const FECHA_DATO = (function () {
  const d = new Date(TOPE + "T12:00:00Z");
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
})();

const DIR_SIM = path.join(os.tmpdir(), "mesa-hoy-simulado");
fs.mkdirSync(path.join(DIR_SIM, "crudo"), { recursive: true });
fs.writeFileSync(path.join(DIR_SIM, "crudo", "meta_dia_en_curso.json"),
  JSON.stringify({
    _metadatos: {
      fecha_consulta: FECHA_DATO,
      hora_consulta: FECHA_DATO + "T15:35:00+00:00",
      parametros: { time_range: { since: FECHA_DATO, until: FECHA_DATO } },
    },
    ad_entities: FILAS,
  }, null, 1), "utf8");

const BLOQUE_CON = py("pruebas/esperado_dia.py", [FECHA_DATO, DIR_SIM]);
if (!Object.keys(BLOQUE_CON.por_mercado || {}).length) {
  throw new Error("el bloque simulado salió sin mercados: revisar pauta_meses");
}
/* El mismo bloque, pero como lo devuelve Meta cuando no hubo entrega: se
   preguntó y no hay filas. Es el estado real del 2026-09-18. */
const BLOQUE_SIN = { ...BLOQUE_CON, por_mercado: {}, fuera_de_mercado: {} };

const conFlag = (v) => conBloque({ ...BLOQUE_CON, es_de_hoy: v === "true" });
/* El stub del reloj va en el MISMO <script> que corre antes del tablero, no en
   addInitScript: con setContent los init scripts no llegan a aplicarse. */
const RELOJ = (iso, masDias) => {
  const d = new Date(iso + "T12:00:00Z");
  if (masDias) d.setDate(d.getDate() + masDias);
  return `(() => {
    const Real = Date, fijo = ${d.getTime()};
    function Falsa(...a) { return a.length ? new Real(...a) : new Real(fijo); }
    Falsa.prototype = Real.prototype;
    Falsa.now = () => fijo;
    Falsa.parse = Real.parse;
    Falsa.UTC = Real.UTC;
    window.Date = Falsa;
  })()`;
};
const pagina = (html, reloj) =>
  '<!doctype html><html lang="es"><head><meta charset="utf-8">' +
  '<style>body{margin:0;font:14px system-ui;background:#fbfbfa}</style>' +
  "</head><body>" + (reloj ? "<script>" + reloj + "<\/script>" : "") +
  "<script>" + RUNTIME + "<\/script>" + sinEstado(html) + "</body></html>";

(async () => {
  const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const pg = await nav.newPage({ viewport: { width: 1440, height: 2400 } });
  const errs = [];
  pg.on("pageerror", e => errs.push(e.message));
  if (!FECHA_DATO) {
    ok("se pudo leer la fecha del bloque del día", false, FECHA_DATO);
    process.exit(1);
  }
  await pg.setContent(pagina(conFlag("true"), RELOJ(FECHA_DATO)),
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

  /* Esta comparación se equivocó DOS veces en direcciones opuestas, y las dos
     valen la pena de recordar:

     1. Primero sumó los seis indicadores de 2026 para compararlos contra el
        KPI de leads y acusó al tablero de mostrar $6,164.71 donde «debían» ir
        $13,898.54 — el error que ADR-013 prohíbe.
     2. Al corregirla se ató al indicador principal... justo cuando el KPI de
        Inversión pasó a mostrar TODO el dinero (ADR-067). Otra vez roja, y
        otra vez el esperado era el equivocado.

     Lo que vale es la distinción: la Inversión suma TODOS los indicadores
     —dólares— y el costo por lead sale de UNO —resultados—. Acá se compara
     contra el total, que es lo que el KPI muestra. */
  const totalPiezas = D.piezas.reduce((a, p) => a + (p.g || 0), 0);
  const gastoHoy = Object.values(D.hoy.por_mercado)
    .reduce((a, m) => a + (m.gasto || 0), 0);

  ok("la inversión mostrada es la de TODAS las piezas cerradas",
     V.inversion === money(totalPiezas.toFixed(2)),
     { pantalla: V.inversion, piezas: money(totalPiezas.toFixed(2)) });
  ok("y NO es la que saldría si el día en curso se sumara",
     V.inversion !== money((totalPiezas + gastoHoy).toFixed(2)),
     { si_sumara_hoy: money((totalPiezas + gastoHoy).toFixed(2)),
       gasto_del_dia_en_curso: gastoHoy });

  console.log("\n══ 4 · la franja YA NO se pinta, y el dato sigue ahí");
  /* Mercadeo la pidió fuera el 2026-09-18: «quita la parte que muestra como va
     hoy, el cosito amarillo». Antes esta sección comprobaba lo contrario —que
     se viera, con su avance en porcentaje y sus rótulos— y todo eso se fue con
     ella.

     Lo que queda es el par que importa y que es fácil confundir: la franja no
     se dibuja, PERO el día se sigue leyendo y guardando. Si alguien quitara
     también la lectura, el botón «Actualizar ahora» dejaría de tener qué
     refrescar y nadie se enteraría: la pantalla se ve igual en los dos casos.
     Por eso se afirman las dos mitades. */
  const F4 = await pg.evaluate(`(() => {
    const f = document.getElementById("diaEnCurso");
    const d = JSON.parse(document.getElementById("datos").textContent);
    return { franja: !!f,
             bloque: !!(d.pauta_diaria && d.pauta_diaria.dia_en_curso),
             boton: !!document.getElementById("bActualizaHoy"),
             sinConector: /Abr[íi] el tablero en claude\\.ai/.test(
               document.body.textContent),
             cuerpo: document.body.textContent };
  })()`);
  ok("la franja ámbar del día en curso NO está", F4.franja === false);
  ok("pero el bloque del día sigue en el dato", F4.bloque === true);
  /* Esta prueba corre SIN conector (`use()` devuelve null), así que lo correcto
     es que no haya botón: un botón muerto es peor que decir por qué no está.
     Se afirma esa rama, que es la que este runtime produce. */
  ok("sin conector no hay botón muerto, hay explicación",
     F4.boton === false && F4.sinConector === true,
     { boton: F4.boton, explica: F4.sinConector });
  /* Y su gasto tampoco aparece escrito por ningún lado de la página: quitar la
     franja no puede haberlo dejado colgando en otra tarjeta. */
  {
    const g = Object.values(D.hoy.por_mercado || {})
      .map(m => money(Number(m.gasto).toFixed(2)));
    ok("y ninguna cifra suya quedó suelta en la página",
       g.every(x => !F4.cuerpo.includes(x)), g);
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
    /* Los DOS redondeos de Python, en el mismo orden: el día típico se guarda
       al centavo y el avance a tres decimales. Dividir por el promedio sin
       redondear daba 69% donde la pantalla pinta 70 —diferencia de un punto,
       solo en el borde— y acusaba al producto de un número que está bien.
       Reproducir el cálculo significa reproducirlo entero. */
    const prom = Math.round(
      (ult.reduce((a, d) => a + dias[d], 0) / ult.length) * 100) / 100;
    const esperado = Math.round(Math.round((b.gasto / prom) * 1000) / 10);
    const pintado = Math.round(b.avance.gasto * 100);
    ok(`${m}: el avance reproduce el promedio de sus ${b.referencia.dias} días`,
       esperado === pintado, { pintado, recalculado: esperado });
  }

  ok("sin errores de JavaScript", errs.length === 0, errs);
  await nav.close();
  console.log(fallos ? `\n>>> ${fallos} FALLAS` : "\n>>> TODO OK");
  process.exit(fallos ? 1 : 0);
})();
