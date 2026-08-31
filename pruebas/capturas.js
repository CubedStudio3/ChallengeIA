const { chromium } = require("../node_modules/playwright");
const fs = require("fs");
(async () => {
  const frag = fs.readFileSync("salidas/tablero-mesa-creativa.html", "utf8");
  fs.writeFileSync("/tmp/capturas/envuelto.html",
    '<!doctype html><html lang="es"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    "<style>:root{color-scheme:light}body{margin:0;font:14px system-ui;" +
    "background:#fbfbfa}img{max-width:100%}</style></head><body>" + frag +
    "</body></html>", "utf8");
  const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  for (const [n, w, h] of [["graf", 1440, 900], ["movil-arriba", 390, 844]]) {
    const ctx = await nav.newContext({ viewport: { width: w, height: h } });
    const p = await ctx.newPage();
    await p.addInitScript(() => {
      window.claude = { use: () => Promise.resolve({ publish: () => Promise.resolve() }) };
    });
    await p.goto("file:///tmp/capturas/envuelto.html", { waitUntil: "load" });
    await p.waitForTimeout(900);
    if (n === "graf") {
      const g = await p.$("#gInt");
      await g.scrollIntoViewIfNeeded();
      await p.waitForTimeout(300);
      await p.screenshot({ path: "/tmp/capturas/zoom-graficas.png" });
      // Formulario de idea nueva.
      await p.evaluate(() => document.getElementById("npTitulo")
        .scrollIntoView({ block: "center" }));
      await p.waitForTimeout(300);
      await p.screenshot({ path: "/tmp/capturas/zoom-formulario.png" });
      // Referencias.
      await p.evaluate(() => document.getElementById("referencias")
        .scrollIntoView({ block: "start" }));
      await p.waitForTimeout(300);
      await p.screenshot({ path: "/tmp/capturas/zoom-referencias.png" });
    } else {
      await p.screenshot({ path: "/tmp/capturas/movil-arriba.png" });
      await p.evaluate(() => document.getElementById("gInt")
        .scrollIntoView({ block: "center" }));
      await p.waitForTimeout(300);
      await p.screenshot({ path: "/tmp/capturas/movil-grafica.png" });
    }
    await ctx.close();
  }
  await nav.close();
  console.log("capturas listas");
})();
