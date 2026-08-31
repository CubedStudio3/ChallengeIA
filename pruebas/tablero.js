/* Prueba del tablero en un navegador real. No es opcional: los dos fallos de
   maquetacion mas caros de este proyecto (una tarjeta sola estirada a todo el
   ancho, y un minmax(400px,1fr) que desbordaba en movil) los encontro esta
   prueba, no la vista. */
const { chromium } = require("../node_modules/playwright");
const fs = require("fs");
const path = require("path");

const ARCHIVO = process.argv[2] ||
  "/home/user/ChallengeIA/salidas/tablero-mesa-creativa.html";
const SALIDA = "/tmp/capturas";

// El visor envuelve el fragmento; aqui se reproduce ese esqueleto para probar
// exactamente lo que va a ver el equipo.
function envuelve(frag) {
  return '<!doctype html><html lang="es"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    "<style>:root{color-scheme:light}body{margin:0;font:14px system-ui;" +
    "background:#fbfbfa}img{max-width:100%}[hidden]{display:none!important}" +
    "</style></head><body>" + frag + "</body></html>";
}

(async () => {
  fs.mkdirSync(SALIDA, { recursive: true });
  const frag = fs.readFileSync(ARCHIVO, "utf8");
  const doc = path.join(SALIDA, "envuelto.html");
  fs.writeFileSync(doc, envuelve(frag), "utf8");

  // El entorno trae Chromium preinstalado; se apunta a ese binario en vez de
  // bajar otro.
  const navegador = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium' });
  let fallos = 0;

  for (const [nombre, ancho, alto] of [["escritorio", 1440, 900],
                                       ["tableta", 834, 1000],
                                       ["movil", 390, 844]]) {
    const ctx = await navegador.newContext({ viewport: { width: ancho, height: alto } });
    const pag = await ctx.newPage();
    const errores = [];
    pag.on("pageerror", (e) => errores.push("pageerror: " + e.message));
    pag.on("console", (m) => {
      if (m.type() !== "error") return;
      /* En este entorno la pagina se abre por file:// y sin salida a
         fonts.gstatic.com, asi que la fuente no baja. NO es un fallo de la
         pagina: la pila de respaldo la cubre. Se ignora solo ese caso y se
         deja pasar cualquier otro error de consola. */
      if (/ERR_CONNECTION_RESET|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED/
          .test(m.text())) return;
      errores.push("console: " + m.text());
    });
    /* Sin window.claude la pagina se declara de solo lectura y desactiva todos
       los botones de decision — que es lo correcto, pero deja las
       interacciones sin probar. Aqui se simula el runtime del visor. */
    await pag.addInitScript(() => {
      window.__publicaciones = [];
      window.claude = {
        use: (nombre) => Promise.resolve(nombre === "artifact" ? {
          publish: (html) => {
            window.__publicaciones.push(html.length);
            return Promise.resolve();
          },
        } : null),
      };
    });
    await pag.goto("file://" + doc, { waitUntil: "load" });
    await pag.waitForTimeout(900);

    const info = await pag.evaluate(() => {
      const r = document.getElementById("raiz");
      return {
        secciones: Array.from(document.querySelectorAll("section[id]"))
          .map((s) => s.id),
        pintado: !!(r && r.children.length),
        anchoDoc: document.documentElement.scrollWidth,
        anchoVis: document.documentElement.clientWidth,
        tarjetas: document.querySelectorAll(".tarjeta-sombra").length,
        graficas: document.querySelectorAll(".graf svg").length,
        botones: document.querySelectorAll("[data-decidir]").length,
        rail: document.querySelectorAll("[data-rail]").length,
        // Cualquier elemento que se salga por la derecha.
        desborde: Array.from(document.querySelectorAll("#raiz *"))
          .filter((e) => e.getBoundingClientRect().right >
                         document.documentElement.clientWidth + 1)
          .slice(0, 5)
          .map((e) => e.tagName + "." + (e.className || "").toString().slice(0, 70)),
        // Que la fuente cargo y el CSS aplico.
        fuente: getComputedStyle(document.body).fontFamily,
        fondo: getComputedStyle(document.body).backgroundColor,
        sombra: (() => {
          const t = document.querySelector(".tarjeta-sombra");
          return t ? getComputedStyle(t).boxShadow : null;
        })(),
        radio: (() => {
          const t = document.querySelector(".tarjeta-sombra");
          return t ? getComputedStyle(t).borderRadius : null;
        })(),
      };
    });

    const overflow = info.anchoDoc > info.anchoVis + 1;
    console.log(`\n=== ${nombre} ${ancho}x${alto} ===`);
    console.log("  pintado:", info.pintado, "| secciones:", info.secciones.join(","));
    console.log("  tarjetas:", info.tarjetas, "| graficas:", info.graficas,
                "| botones decidir:", info.botones, "| rail:", info.rail);
    console.log("  fondo:", info.fondo, "| radio:", info.radio);
    console.log("  sombra:", info.sombra);
    console.log("  fuente:", info.fuente);
    console.log("  ancho doc/vis:", info.anchoDoc, "/", info.anchoVis,
                overflow ? "<<< DESBORDE HORIZONTAL" : "ok");
    if (info.desborde.length) console.log("  se salen:", info.desborde);
    if (errores.length) console.log("  ERRORES JS:", errores);
    if (overflow || errores.length || !info.pintado ||
        info.secciones.length !== 5) fallos++;

    await pag.screenshot({ path: path.join(SALIDA, nombre + "-completo.png"),
                           fullPage: true });

    // Interacciones, solo en escritorio.
    if (nombre === "escritorio") {
      for (const s of ["resumen", "rendimiento", "competencia", "referencias",
                       "estrategia"]) {
        await pag.evaluate((id) => document.getElementById(id)
          .scrollIntoView({ block: "start" }), s);
        await pag.waitForTimeout(450);
        await pag.screenshot({ path: path.join(SALIDA, "s-" + s + ".png") });
      }

      const prueba = async (etiqueta, fn) => {
        const antes = errores.length;
        try { await fn(); } catch (e) {
          console.log("  FALLO " + etiqueta + ": " + e.message); fallos++; return;
        }
        await pag.waitForTimeout(500);
        const nuevos = errores.slice(antes);
        console.log("  " + (nuevos.length ? "FALLO " : "ok ") + etiqueta +
                    (nuevos.length ? " -> " + nuevos.join(" | ") : ""));
        if (nuevos.length) fallos++;
      };

      console.log("\n--- interacciones ---");
      await prueba("cambiar mercado a SV",
        () => pag.click('[data-mercado="SV"]'));
      /* «Ver todo» solo existe cuando hay mas elementos que el tope. Su
         ausencia en un mercado con pocas campanas es correcto, no un fallo. */
      await prueba("ver todo (donde exista)", async () => {
        const b = await pag.$("[data-vertodo]");
        if (!b) { console.log("    (ningun «ver todo» en esta vista)"); return; }
        await b.click();
      });
      await prueba("grupo referentes",
        () => pag.click('[data-grupo="referentes"]'));
      await prueba("grupo competencia",
        () => pag.click('[data-grupo="competencia"]'));
      await prueba("categoria punto de venta",
        () => pag.click('[data-categoria="hardware"]'));
      await prueba("aceptar una tarea",
        () => pag.click("[data-decidir]:first-of-type"));
      await prueba("cambiar de estrategia",
        () => pag.click("[data-estrategia]"));
      await prueba("aceptar todas", () => pag.click("#bTodas"));
      await prueba("limpiar", () => pag.click("#bNada"));
      await prueba("tipo video", () => pag.click('[data-nptipo="video"]'));
      await prueba("idea nueva", async () => {
        await pag.fill("#npTitulo", "Video del POS en un negocio de San Salvador");
        await pag.fill("#npDetalle", "Probando el formulario.");
        await pag.fill("#npRefs", "https://ejemplo.com/uno\nesto no es un enlace");
        await pag.click("#npAgregar");
      });
      const propias = await pag.evaluate(
        () => document.querySelectorAll("[data-propia]").length);
      console.log("  botones de idea propia tras agregar:", propias,
                  propias >= 2 ? "ok" : "<<< la idea no se pinto");
      if (propias < 2) fallos++;

      await prueba("buscar 'punto'", async () => {
        await pag.fill("#buscar", "punto");
        await pag.waitForTimeout(450);
      });
      const trasBusq = await pag.evaluate(() => ({
        chip: !!document.getElementById("limpiarBusqueda"),
        camp: document.querySelectorAll("[data-vertodo='camp']").length,
      }));
      console.log("  chip de filtro:", trasBusq.chip ? "ok" : "<<< no aparecio");
      if (!trasBusq.chip) fallos++;
      await prueba("limpiar busqueda", () => pag.click("#limpiarBusqueda"));

      await prueba("tooltip de la grafica", async () => {
        await pag.evaluate(() => document.getElementById("gInt")
          .scrollIntoView({ block: "center" }));
        await pag.waitForTimeout(300);
        const caza = await pag.$("#gInt-caza");
        if (!caza) throw new Error("no hay grafica de interacciones");
        const b = await caza.boundingBox();
        await pag.mouse.move(b.x + b.width * 0.7, b.y + b.height / 2);
      });
      const tip = await pag.evaluate(() => {
        const t = document.getElementById("gInt-tip");
        return t ? { op: getComputedStyle(t).opacity, txt: t.textContent.slice(0, 60),
                     izq: t.style.left, der: t.style.right } : null;
      });
      console.log("  globo:", JSON.stringify(tip));
      if (!tip || tip.op !== "1") { console.log("  <<< el globo no se mostro"); fallos++; }

      const pub = await pag.evaluate(() => window.__publicaciones.length);
      console.log("  publicaciones al runtime:", pub,
                  pub > 0 ? "ok" : "<<< no se guardo ninguna decision");
      if (!pub) fallos++;

      await pag.screenshot({ path: path.join(SALIDA, "tras-interacciones.png"),
                             fullPage: true });
      if (errores.length) console.log("\n  ERRORES JS ACUMULADOS:", errores);
    }

    await ctx.close();
  }

  await navegador.close();
  console.log(fallos ? "\nFALLOS: " + fallos : "\nTODO OK");
  process.exit(fallos ? 1 : 0);
})();
