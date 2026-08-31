/* Prueba del reporte de la Ad Library en un navegador real.
   Mismo criterio que la prueba del tablero: desborde horizontal, errores de
   JavaScript y las interacciones, a tres anchos. */
const { chromium } = require("../node_modules/playwright");
const fs = require("fs");
const path = require("path");

const ARCHIVO = process.argv[2] ||
  "/home/user/ChallengeIA/salidas/reporte-adlibrary.html";
const SALIDA = "/tmp/capturas-reporte";

function envuelve(frag) {
  return '<!doctype html><html lang="es"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    "<style>:root{color-scheme:light}body{margin:0;font:14px system-ui;" +
    "background:#fbfbfa}img{max-width:100%}</style></head><body>" + frag +
    "</body></html>";
}

(async () => {
  fs.mkdirSync(SALIDA, { recursive: true });
  const doc = path.join(SALIDA, "envuelto.html");
  fs.writeFileSync(doc, envuelve(fs.readFileSync(ARCHIVO, "utf8")), "utf8");

  const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  let fallos = 0;

  for (const [nombre, w, h] of [["escritorio", 1440, 900],
                                ["tableta", 834, 1000],
                                ["movil", 390, 844]]) {
    const ctx = await nav.newContext({ viewport: { width: w, height: h } });
    const pag = await ctx.newPage();
    const errores = [];
    pag.on("pageerror", (e) => errores.push("pageerror: " + e.message));
    pag.on("console", (m) => {
      if (m.type() !== "error") return;
      /* En este entorno la pagina se abre por file:// y sin salida a
         fonts.gstatic.com: la fuente no baja y el certificado del proxy no
         valida. No es un fallo de la pagina — la pila de respaldo la cubre. */
      if (/ERR_CONNECTION_RESET|ERR_NAME_NOT_RESOLVED|ERR_CERT_AUTHORITY_INVALID/
          .test(m.text())) return;
      errores.push("console: " + m.text());
    });
    await pag.goto("file://" + doc, { waitUntil: "load" });
    /* El CSS pide scroll suave. Para capturar hay que apagarlo: con la
       animacion en curso, scrollIntoView + espera corta fotografiaba el hueco
       entre dos secciones y salia una captura en blanco. */
    await pag.addStyleTag({ content: "html{scroll-behavior:auto!important}" });
    await pag.waitForTimeout(900);

    const info = await pag.evaluate(() => ({
      dossiers: document.querySelectorAll(".dossier").length,
      bloques: document.querySelectorAll(".bloque").length,
      barras: document.querySelectorAll(".barra-marca").length,
      columnas: document.querySelectorAll(".col-envoltura").length,
      limites: document.querySelectorAll(".limite").length,
      bandas: document.querySelectorAll(".banda").length,
      railB: document.querySelectorAll(".rail-b").length,
      tablas: document.querySelectorAll(".tabla-plegada").length,
      anchoDoc: document.documentElement.scrollWidth,
      anchoVis: document.documentElement.clientWidth,
      fondo: getComputedStyle(document.body).backgroundColor,
      fuente: getComputedStyle(document.body).fontFamily,
      // Barras en cero: seria el bug de la animacion sin restituir.
      barrasEnCero: Array.from(document.querySelectorAll(".barra-marca"))
        .filter((b) => b.style.width === "0%").length,
      /* Un elemento dentro de un contenedor con scroll horizontal propio
         SI puede pasarse del viewport: eso es lo que hace un scroller. Medir
         contra el viewport sin excluirlos daba falsos positivos con el rail
         y con las tablas anchas. */
      desborde: Array.from(document.querySelectorAll("*"))
        .filter((e) => {
          if (e.getBoundingClientRect().right <=
              document.documentElement.clientWidth + 1) return false;
          for (let p = e.parentElement; p; p = p.parentElement) {
            const ox = getComputedStyle(p).overflowX;
            if (ox === "auto" || ox === "scroll") return false;
          }
          return true;
        })
        .slice(0, 5)
        .map((e) => e.tagName + "." + (e.className || "").toString().slice(0, 60)),
    }));

    const overflow = info.anchoDoc > info.anchoVis + 1;
    console.log(`\n=== ${nombre} ${w}x${h} ===`);
    console.log("  dossiers:", info.dossiers, "| bloques:", info.bloques,
                "| bandas:", info.bandas, "| limites:", info.limites);
    console.log("  barras:", info.barras, "| columnas:", info.columnas,
                "| tablas:", info.tablas, "| rail:", info.railB);
    console.log("  fondo:", info.fondo);
    console.log("  fuente:", info.fuente);
    console.log("  ancho doc/vis:", info.anchoDoc, "/", info.anchoVis,
                overflow ? "<<< DESBORDE" : "ok");
    if (info.desborde.length) console.log("  se salen:", info.desborde);
    if (errores.length) console.log("  ERRORES JS:", errores);
    if (overflow || errores.length || info.dossiers !== 7) fallos++;

    await pag.screenshot({ path: path.join(SALIDA, nombre + "-completo.png"),
                           fullPage: true });

    if (nombre === "escritorio") {
      // Las barras deben crecer al entrar en pantalla y NUNCA quedar en cero.
      await pag.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await pag.waitForTimeout(1200);
      await pag.evaluate(() => window.scrollTo(0, 0));
      await pag.waitForTimeout(600);
      const cero = await pag.evaluate(() =>
        Array.from(document.querySelectorAll(".barra-marca"))
          .filter((b) => b.style.width === "0%").length);
      console.log("  barras en cero tras recorrer:", cero,
                  cero === 0 ? "ok" : "<<< quedaron sin restituir");
      if (cero) fallos++;

      // El rail debe marcar el dossier visible.
      await pag.evaluate(() => document.getElementById("square_uk")
        .scrollIntoView({ block: "start" }));
      await pag.waitForTimeout(700);
      const act = await pag.evaluate(() => {
        const a = document.querySelector(".rail-b.activo");
        return a ? a.textContent.trim() : null;
      });
      console.log("  rail activo en Square UK:", JSON.stringify(act),
                  act && /Square/.test(act) ? "ok" : "<<< no marco");
      if (!act) fallos++;

      for (const s of ["limites", "panorama", "paggo", "square_us", "cierre"]) {
        await pag.evaluate((id) => document.getElementById(id)
          .scrollIntoView({ block: "start" }), s);
        await pag.waitForTimeout(500);
        await pag.screenshot({ path: path.join(SALIDA, "s-" + s + ".png") });
      }
    }
    await ctx.close();
  }
  await nav.close();
  console.log(fallos ? "\nFALLOS: " + fallos : "\nTODO OK");
  process.exit(fallos ? 1 : 0);
})();
