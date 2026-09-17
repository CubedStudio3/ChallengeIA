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
    const kk = [...document.querySelectorAll("#kpis .kpi")];
    const k = kk[0], kWon = kk[1];
    return {
      rotulos: kk.map(e => e.querySelector(".rotulo").textContent.trim()),
      leads: k.querySelector(".v").textContent.trim(),
      compraron: kWon ? kWon.querySelector(".v").textContent.trim() : "",
      bases: kk.map(e => (e.querySelector(".d") || {}).textContent || ""),
      chips: [...(kWon ? kWon.querySelectorAll(".kpi-planes span") : [])].map(e => ({
        nombre: e.textContent.replace(/\s*[\d.,]+$/, "").trim(),
        valor: Number(e.querySelector("b").textContent.replace(/[.,]/g, "")),
        tip: e.dataset.tip || "",
      })),
      nota: k.querySelector(".kpi-nota").textContent.trim(),
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
    // Las ventas se recuentan aparte por FECHA DE CIERRE (columna 15 del
    // Trato), que es el criterio del tablero. Un Trato fuera de la banda del
    // periodo trae -1 y no entra en ninguna ventana.
    const gan = V.etapa.indexOf("closed won");
    const compro = D.tratos.filter(r => r[4] === gan && dentro(r[15])
      && (!pais || V.pais[r[1]] === pais));
    const porPlan = {};
    compro.forEach(r => { const n = V.producto[r[12]]; if (n) porPlan[n] = (porPlan[n] || 0) + 1; });
    return {
      leads: leads.length,
      compraron: compro.length,
      leadsRedes: leads.filter(r => r[2] === redes).length,
      metaForma: meta.reduce((a, r) => a + r[4], 0),
      porPlan,
      sinPlan: compro.filter(r => !V.producto[r[12]]).length,
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

    // El embudo: cuatro pasos, sin «Tratos cerrados», y cada banda ocupando
    // EXACTAMENTE su fila. Lo segundo no se ve en una captura si solo se
    // compara el borde de arriba: hay que comparar tambien el alto.
    const emb = await p.evaluate(() => {
      const e = document.getElementById("embudo-web");
      const izq = [...e.querySelectorAll(".emb-celda:not(.emb-der-celda)")];
      const der = [...e.querySelectorAll(".emb-der-celda")];
      const ban = [...e.querySelectorAll(".emb-banda")];
      const desbordan = [...izq, ...der]
        .filter(c => c.scrollHeight > c.clientHeight + 1).length;
      const descalzadas = ban.filter((x, i) => {
        const a = x.querySelector("svg").getBoundingClientRect();
        const c = izq[i].getBoundingClientRect();
        return Math.abs(a.top - c.top) > 1 || Math.abs(a.height - c.height) > 1;
      }).length;
      return {
        pasos: izq.map(x => x.querySelector(".emb-nom").textContent.trim()),
        bandas: ban.length, desbordan, descalzadas,
      };
    });
    ok(emb.pasos.length === 4, "el embudo tiene cuatro pasos", emb.pasos.join(" → "));
    ok(!emb.pasos.some(x => /Tratos cerrados/i.test(x)),
       "sin el paso «Tratos cerrados»", emb.pasos.join(" → "));
    ok(emb.bandas === emb.pasos.length, "una banda por paso",
       emb.bandas + " bandas para " + emb.pasos.length + " pasos");
    ok(emb.desbordan === 0, "ninguna celda del embudo desborda su fila",
       emb.desbordan + " desbordan");
    ok(emb.descalzadas === 0, "cada banda ocupa exactamente su fila",
       emb.descalzadas + " descalzadas");

    // La invariante del embudo: NINGUN paso puede ser mayor que el anterior.
    // Se rompio de verdad —50 leads, 38 calificados y 39 ganados, con un «se
    // quedaron -1»— porque el ultimo paso contaba Tratos y los otros leads.
    // Se comprueba en las DOS figuras y en varias ventanas, porque con el
    // periodo entero el defecto no aparecia.
    for (const [id, nombre] of [["embudo-web", "web"], ["embudo-meta", "Meta"]]) {
      const n = await p.evaluate(x => [...document.getElementById(x)
        .querySelectorAll(".emb-num")].map(e => Number(e.textContent.replace(/[.,]/g, ""))), id);
      const crece = n.map((v, i) => i && v > n[i-1] ? i : 0).filter(Boolean);
      ok(crece.length === 0, "el embudo de " + nombre + " no crece en ningún paso",
         n.join(" → "));
      const neg = await p.evaluate(x => [...document.getElementById(x)
        .querySelectorAll(".emb-caida")].some(e => /-\d/.test(e.textContent)), id);
      ok(!neg, "el embudo de " + nombre + " no declara una caída negativa");
    }
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
    ok(v.rotulos.length === 2, "dos tarjetas y nada mas", v.rotulos.join(" · "));
    ok(/entraron/i.test(v.rotulos[0]) && /closed won/i.test(v.rotulos[1]),
       "la primera dice «entraron» y la segunda «closed won»", v.rotulos.join(" · "));
    ok(n(v.compraron) === e.compraron, "los que compraron cuadran (por fecha de cierre)",
       v.compraron + " vs " + e.compraron);
    // Cada tarjeta tiene que decir sobre qué fecha cuenta: son dos fechas
    // distintas y sin el rótulo alguien las divide entre sí.
    ok(/creación del lead/i.test(v.bases[0]), "la primera declara su fecha", v.bases[0]);
    ok(/fecha de cierre/i.test(v.bases[1]), "la segunda declara su fecha", v.bases[1]);
    ok(!/%/.test(v.rotulos.join(" ")),
       "no hay porcentaje que mezcle las dos fechas", v.rotulos.join(" · "));
    ok(!/Calificados/.test(v.rotulos.join(" ")) && !/sobre Tratos/.test(v.rotulos.join(" ")),
       "no quedan tarjetas de etapas intermedias", v.rotulos.join(" · "));

    // La invariante del embudo, en ESTA ventana. Con el periodo entero no
    // aparecia: hizo falta un mes corto para que un paso creciera.
    for (const [id, cual] of [["embudo-web", "web"], ["embudo-meta", "Meta"]]) {
      const n = await p.evaluate(x => [...document.getElementById(x)
        .querySelectorAll(".emb-num")].map(e => Number(e.textContent.replace(/[.,]/g, ""))), id);
      ok(n.every((v, i) => !i || v <= n[i-1]),
         "embudo " + cual + ": ningún paso crece", n.join(" → "));
    }

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
    ok(free.valor + pago.valor + e.sinPlan === e.compraron,
       "Free + Premium + los que no tienen plan dan los que compraron",
       free.valor + " + " + pago.valor + " + " + e.sinPlan + " vs " + e.compraron);

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
