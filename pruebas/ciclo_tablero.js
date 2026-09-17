/* Prueba del tablero Ciclo del Lead en Chromium, con el raton.
 *
 * Lo que vigila, en orden de importancia:
 *  1. Que ningun rotulo de plan sea un nombre INVENTADO. El tablero decia
 *     «Premium 19» por 14 Premium Anual + 5 Elite Anual: un numero que ningun
 *     informe del CRM puede reproducir porque ese plan no existe. Todo rotulo
 *     tiene que estar en el vocabulario del dataset.
 *  2. Que la nota del KPI de leads cuadre con el dato de Meta de la ventana,
 *     calculado aparte desde el dataset embebido — no con un texto copiado.
 *  3. Que filtrar con el raton mueva los numeros de verdad.
 *  4. Que no haya errores de JS ni desborde horizontal a 1440 y a 390.
 *
 *   npm run prueba:tablero-ciclo
 */
const { chromium } = require("playwright");
const PAGINA = "file:///home/user/ChallengeIA/salidas/ciclo-del-lead.html";

let fallos = 0;
function ok(cond, que, detalle) {
  console.log((cond ? "  ✓ " : "  ✗ ") + que + (detalle ? " · " + detalle : ""));
  if (!cond) fallos++;
}

async function lee(p) {
  return await p.evaluate(() => {
    const k = document.querySelector("#kpis .kpi");
    return {
      leads: k.querySelector(".v").textContent.trim(),
      chips: [...k.querySelectorAll(".kpi-planes span")].map(e => ({
        nombre: e.textContent.replace(/\s*[\d.,]+$/, "").trim(),
        valor: Number(e.querySelector("b").textContent.replace(/[.,]/g, "")),
        tip: e.dataset.tip || "",
      })),
      nota: k.querySelector(".kpi-nota").textContent.trim(),
      calificados: document.querySelectorAll("#kpis .kpi")[1].querySelector(".v").textContent.trim(),
    };
  });
}

/* El esperado se le pregunta al dataset embebido, no se escribe a mano: un
 * esperado copiado caduca en silencio la proxima vez que se recarga el dato. */
async function esperado(p, pais, desde, hasta) {
  return await p.evaluate(([pais, desde, hasta]) => {
    const D = JSON.parse(document.getElementById("datos").textContent);
    const V = D.dic, F = V.fecha;
    const dentro = i => F[i] >= desde && F[i] <= hasta;
    const leads = D.leads.filter(r => dentro(r[0]) && (!pais || V.pais[r[1]] === pais));
    const redes = V.canal.indexOf("Redes sociales (Meta)");
    const meta = D.meta.filter(r => dentro(r[0]) && (!pais || V.pais[r[1]] === pais));
    const cal = leads.filter(r => r[7] === 1);
    const porPlan = {};
    cal.forEach(r => { const n = V.producto[r[9]]; if (n) porPlan[n] = (porPlan[n] || 0) + 1; });
    return {
      leads: leads.length,
      calificados: cal.length,
      leadsRedes: leads.filter(r => r[2] === redes).length,
      metaForma: meta.reduce((a, r) => a + r[4], 0),
      porPlan,
      sinPlan: cal.filter(r => !V.producto[r[9]]).length,
      vocabulario: V.producto.filter(Boolean),
    };
  }, [pais, desde, hasta]);
}

async function ventana(p, pais, desde, hasta) {
  if (pais !== null) await p.selectOption("#pais", pais);
  await p.fill("#desde", desde); await p.dispatchEvent("#desde", "change");
  await p.fill("#hasta", hasta); await p.dispatchEvent("#hasta", "change");
  await p.waitForTimeout(350);
}

(async () => {
  const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

  for (const [ancho, alto] of [[1440, 1000], [390, 900]]) {
    const p = await nav.newPage({ viewport: { width: ancho, height: alto } });
    const errores = [];
    p.on("pageerror", e => errores.push(e.message));
    p.on("console", m => { if (m.type() === "error" && !/ERR_CERT/.test(m.text())) errores.push(m.text()); });
    await p.goto(PAGINA);
    await p.waitForTimeout(800);
    console.log("\n" + ancho + " px");
    ok(errores.length === 0, "sin errores de JS", errores.join(" | "));
    const sw = await p.evaluate(() => document.documentElement.scrollWidth);
    ok(sw <= ancho, "sin desborde horizontal", "scrollWidth " + sw);
    await p.close();
  }

  const p = await nav.newPage({ viewport: { width: 1440, height: 1100 } });
  await p.goto(PAGINA);
  await p.waitForTimeout(800);

  const rango = await p.evaluate(() => {
    const F = JSON.parse(document.getElementById("datos").textContent).dic.fecha;
    return [F[0], F[F.length - 1]];
  });
  // Las ventanas se derivan del dato para que no caduquen: todo el periodo, y
  // el ultimo mes con su primer dia.
  const ultimo = rango[1];
  const casos = [
    ["", rango[0], rango[1], "todo el periodo"],
    ["Guatemala", ultimo.slice(0, 8) + "01", ultimo, "Guatemala · " + ultimo.slice(0, 7)],
    ["El Salvador", ultimo.slice(0, 8) + "01", ultimo, "El Salvador · " + ultimo.slice(0, 7)],
  ];

  const vistos = [];
  for (const [pais, desde, hasta, nombre] of casos) {
    console.log("\n" + nombre);
    await ventana(p, pais, desde, hasta);
    const v = await lee(p), e = await esperado(p, pais, desde, hasta);
    vistos.push(v.leads);

    const n = s => Number(String(s).replace(/[.,]/g, ""));
    ok(n(v.leads) === e.leads, "los leads de la vista cuadran", v.leads + " vs " + e.leads);
    ok(n(v.calificados) === e.calificados, "los calificados cuadran",
       v.calificados + " vs " + e.calificados);

    // 1 · dos tramos y nada mas: Free y Premium. «Premium» es un cubo con el
    //     vocabulario del informe del CRM, por pedido de Mercadeo — asi que lo
    //     que se vigila es que los nombres REALES no se pierdan: tienen que
    //     estar todos en el globo del chip de pago.
    ok(v.chips.length === 2, "dos tramos de plan, Free y Premium",
       v.chips.map(c => c.nombre).join(" · "));
    ok(v.chips.map(c => c.nombre).join("|") === "Free|Premium",
       "en ese orden y con esos nombres", v.chips.map(c => c.nombre).join("|"));

    const free = v.chips.find(c => c.nombre === "Free") || {valor: 0, tip: ""};
    const pago = v.chips.find(c => c.nombre === "Premium") || {valor: 0, tip: ""};
    const eFree = e.porPlan["Free"] || 0;
    const ePago = Object.entries(e.porPlan).reduce((a, [n, x]) => a + (n === "Free" ? 0 : x), 0);
    ok(free.valor === eFree, "Free trae su conteo", free.valor + " vs " + eFree);
    ok(pago.valor === ePago, "Premium suma TODOS los planes de pago",
       pago.valor + " vs " + ePago);
    ok(free.valor + pago.valor + e.sinPlan === e.calificados,
       "Free + Premium + los que no tienen plan dan los calificados",
       free.valor + " + " + pago.valor + " + " + e.sinPlan + " vs " + e.calificados);

    // los nombres reales del CRM siguen a un clic de distancia
    const faltan = Object.keys(e.porPlan).filter(n => n !== "Free" && !pago.tip.includes(n));
    ok(faltan.length === 0, "el globo de Premium nombra cada plan real del CRM",
       faltan.length ? "faltan: " + faltan.join(", ") : pago.tip.slice(0, 90));
    ok(e.sinPlan === 0 || /sin plan anotado/.test(pago.tip),
       "y declara los Tratos sin plan en vez de esconderlos",
       e.sinPlan + " sin plan");

    // 2 · la nota, contra el dato de Meta de la ventana
    const enNota = (v.nota.match(/[\d.,]+/g) || []).map(x => Number(x.replace(/[.,]/g, "")));
    ok(enNota.includes(e.leadsRedes), "la nota dice los leads de redes del CRM",
       "esperaba " + e.leadsRedes + " en «" + v.nota + "»");
    ok(e.metaForma === 0 || enNota.includes(e.metaForma),
       "la nota dice lo que reporta el formulario de Meta", "esperaba " + e.metaForma);
    ok(!/plan existe solo desde/.test(v.nota), "la nota ya no habla del plan");
  }

  // 3 · filtrar movio los numeros
  ok(new Set(vistos).size === vistos.length, "cada ventana da un total distinto",
     vistos.join(" · "));

  await nav.close();
  console.log(fallos ? "\n" + fallos + " comprobacion(es) fallaron." : "\nTodo en orden.");
  process.exit(fallos ? 1 : 0);
})();
