/**
 * Generador del deck semanal de Mesa Creativa.
 *
 * Lee el resultado.json de una corrida y produce el PowerPoint. No consulta
 * nada: todo lo que aparece en el deck viene del archivo, y por tanto es
 * trazable hasta el JSON crudo que produjo la corrida.
 *
 * Motivo visual: cada afirmación numérica lleva su marca de confianza. Un chip
 * sólido significa cantidad derivada del dato; un chip abierto en ámbar
 * significa hueco declarado. Es la regla central del proyecto hecha diseño.
 *
 * Uso:  node deck.js <resultado.json> <salida.pptx>
 */

const pptxgen = require("pptxgenjs");
const fs = require("fs");

const C = {
  oscuro:   "0B3C49",
  medio:    "1C7293",
  claro:    "F4F7F8",
  blanco:   "FFFFFF",
  texto:    "1A2B31",
  muted:    "5A6B72",
  mutedInv: "9DB7BF",
  dato:     "02C39A",  // cuantificado
  hueco:    "E8A33D",  // dato faltante declarado
  riesgo:   "B85042",
  linea:    "D9E2E5",
};
const F = { titulo: "Cambria", cuerpo: "Calibri" };

const [ , , entrada, salida ] = process.argv;
if (!entrada || !salida) {
  console.error("Uso: node deck.js <resultado.json> <salida.pptx>");
  process.exit(2);
}
const R = JSON.parse(fs.readFileSync(entrada, "utf8"));

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";           // 13.3 x 7.5
const W = 13.3, H = 7.5, M = 0.6;

const dinero = (n) => "$" + Number(n).toLocaleString("en-US",
  { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const entero = (n) => Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
const corta = (s, n) => (s && s.length > n ? s.slice(0, n - 1) + "…" : s || "");

/** Encabezado de una lámina clara. */
function encabeza(s, kicker, titulo) {
  s.addText(kicker.toUpperCase(), {
    x: M, y: 0.42, w: W - 2 * M, h: 0.24, isTextBox: true, margin: 0,
    fontFace: F.cuerpo, fontSize: 11, bold: true, color: C.medio, charSpacing: 2,
  });
  s.addText(titulo, {
    x: M, y: 0.68, w: W - 2 * M, h: 0.62, isTextBox: true, margin: 0,
    fontFace: F.titulo, fontSize: 34, bold: true, color: C.oscuro,
  });
}

/** Chip de confianza: el motivo que se repite en todo el deck. */
function chip(s, x, y, texto, cuantificado, w) {
  const ancho = w || 1.9;
  s.addShape(pres.ShapeType.roundRect, {
    x, y, w: ancho, h: 0.42, rectRadius: 0.2,
    fill: cuantificado ? { color: C.dato } : { color: C.blanco },
    line: { color: cuantificado ? C.dato : C.hueco, width: 1.5 },
  });
  s.addText(texto, {
    x, y, w: ancho, h: 0.42, isTextBox: true, margin: 0, align: "center",
    valign: "middle", fontFace: F.cuerpo, fontSize: 11, bold: true,
    color: cuantificado ? C.oscuro : C.hueco,
  });
}

/* ══════════════ 1 · Portada ══════════════ */
{
  const s = pres.addSlide();
  s.background = { color: C.oscuro };
  s.addText("MESA CREATIVA", {
    x: M, y: 1.5, w: W - 2 * M, h: 0.4, isTextBox: true, margin: 0,
    fontFace: F.cuerpo, fontSize: 13, bold: true, color: C.dato, charSpacing: 4,
  });
  s.addText("Base estratégica de la\nreunión creativa", {
    x: M, y: 1.95, w: 7.6, h: 1.7, isTextBox: true, margin: 0,
    fontFace: F.titulo, fontSize: 44, bold: true, color: C.blanco, lineSpacing: 46,
  });
  s.addText(`Periodo analizado · ${R.corrida.rango}`, {
    x: M, y: 3.75, w: 7.6, h: 0.32, isTextBox: true, margin: 0,
    fontFace: F.cuerpo, fontSize: 15, color: C.mutedInv,
  });
  if (R.corrida.dry_run) {
    s.addShape(pres.ShapeType.roundRect, {
      x: M, y: 4.25, w: 2.5, h: 0.4, rectRadius: 0.2,
      fill: { color: C.oscuro }, line: { color: C.hueco, width: 1.5 },
    });
    s.addText("MODO DRY-RUN", {
      x: M, y: 4.25, w: 2.5, h: 0.4, isTextBox: true, margin: 0, align: "center",
      valign: "middle", fontFace: F.cuerpo, fontSize: 10, bold: true, color: C.hueco,
    });
  }

  // Los huecos van en PORTADA, no escondidos al final (ADR-002).
  const huecos = R.huecos_declarados || [];
  const bx = 8.55, bw = W - bx - M;
  s.addShape(pres.ShapeType.roundRect, {
    x: bx, y: 1.5, w: bw, h: 3.15, rectRadius: 0.08,
    fill: { color: C.blanco, transparency: 92 },
    line: { color: C.hueco, width: 1.5 },
  });
  s.addText(huecos.length ? "LO QUE ESTA CORRIDA NO INCLUYE" : "SIN HUECOS DECLARADOS", {
    x: bx + 0.28, y: 1.75, w: bw - 0.56, h: 0.5, isTextBox: true, margin: 0,
    fontFace: F.cuerpo, fontSize: 11, bold: true, color: C.hueco, charSpacing: 1,
  });
  s.addText(
    huecos.length
      ? huecos.flatMap((h, i) => [
          { text: h.fuente, options: { bullet: true, breakLine: true,
              fontSize: 11, bold: true, color: C.blanco } },
          { text: h.descripcion, options: { bullet: false,
              breakLine: i < huecos.length - 1, paraSpaceAfter: 10,
              indentLevel: 1, fontSize: 10.5, color: C.mutedInv } },
        ])
      : [{ text: "Todas las fuentes previstas respondieron.",
           options: { fontSize: 11, color: C.blanco } }],
    { x: bx + 0.28, y: 2.3, w: bw - 0.56, h: 2.1, isTextBox: true, margin: 0,
      fontFace: F.cuerpo, valign: "top" });
  s.addText("Se declara, no se rellena.", {
    x: bx + 0.28, y: 4.24, w: bw - 0.56, h: 0.26, isTextBox: true, margin: 0,
    fontFace: F.cuerpo, fontSize: 10, italic: true, color: C.hueco });

  s.addText("Cada cifra de este documento es trazable hasta la consulta que la produjo.", {
    x: M, y: 6.5, w: W - 2 * M, h: 0.3, isTextBox: true, margin: 0,
    fontFace: F.cuerpo, fontSize: 11, italic: true, color: C.mutedInv });
  s.addNotes(`Corrida ${R.corrida.rango}. Verificación de la semana anterior: ${R.verificacion_semana_anterior}`);
}

/* ══════════════ 2 · Integridad de los datos ══════════════ */
{
  const s = pres.addSlide();
  s.background = { color: C.claro };
  encabeza(s, "Antes de creerle a un número", "Integridad de los datos");
  const i = R.integridad;
  const tarjetas = [
    { n: entero(i.campanas_leidas), l: "filas campaña×país leídas", ok: true },
    { n: i.paises_con_entrega.join("  "), l: "países con entrega", ok: true },
    { n: i.campanas_incoherentes.length === 0 ? "0" : String(i.campanas_incoherentes.length),
      l: "costos incoherentes", ok: i.campanas_incoherentes.length === 0 },
    { n: String(i.paises_fuera_de_mercados_declarados.length),
      l: "países fuera de mercado declarado",
      ok: i.paises_fuera_de_mercados_declarados.length === 0 },
  ];
  const tw = 2.85, gap = 0.32;
  tarjetas.forEach((t, k) => {
    const x = M + k * (tw + gap);
    s.addShape(pres.ShapeType.roundRect, {
      x, y: 1.6, w: tw, h: 1.55, rectRadius: 0.08,
      fill: { color: C.blanco },
      line: { color: t.ok ? C.linea : C.hueco, width: t.ok ? 1 : 2 },
      shadow: { type: "outer", angle: 90, blur: 8, offset: 1, color: "000000", opacity: 0.06 },
    });
    s.addText(t.n, {
      x: x + 0.24, y: 1.78, w: tw - 0.48, h: 0.72, isTextBox: true, margin: 0,
      fontFace: F.titulo, fontSize: t.n.length > 8 ? 26 : 40, bold: true,
      color: t.ok ? C.oscuro : C.hueco });
    s.addText(t.l, {
      x: x + 0.24, y: 2.56, w: tw - 0.48, h: 0.46, isTextBox: true, margin: 0,
      fontFace: F.cuerpo, fontSize: 11, color: C.muted });
  });

  const fuera = i.paises_fuera_de_mercados_declarados;
  const y0 = 3.5;
  s.addShape(pres.ShapeType.roundRect, {
    x: M, y: y0, w: W - 2 * M, h: 1.35, rectRadius: 0.08,
    fill: { color: fuera.length ? "FDF3E3" : C.blanco },
    line: { color: fuera.length ? C.hueco : C.linea, width: fuera.length ? 2 : 1 } });
  s.addText(fuera.length ? "Entrega fuera de los mercados declarados" : "Entrega dentro de lo declarado", {
    x: M + 0.3, y: y0 + 0.2, w: W - 2 * M - 0.6, h: 0.32, isTextBox: true, margin: 0,
    fontFace: F.cuerpo, fontSize: 15, bold: true, color: fuera.length ? C.hueco : C.oscuro });
  s.addText(fuera.length
      ? `El proyecto declara Guatemala y El Salvador. Hay gasto registrado en ${fuera.join(", ")}. `
        + "El mercado se toma del desglose por país de la API, nunca del nombre de la campaña: "
        + "se comprobó que una campaña llamada «SV» entrega también en GT y HN."
      : "Todos los países con gasto corresponden a los mercados del proyecto.", {
    x: M + 0.3, y: y0 + 0.58, w: W - 2 * M - 0.6, h: 0.62, isTextBox: true, margin: 0,
    fontFace: F.cuerpo, fontSize: 12, color: C.texto });

  s.addText("Paso 6 · verificación de la semana anterior", {
    x: M, y: 5.2, w: W - 2 * M, h: 0.3, isTextBox: true, margin: 0,
    fontFace: F.cuerpo, fontSize: 11, bold: true, color: C.medio, charSpacing: 1 });
  s.addText(R.verificacion_semana_anterior, {
    x: M, y: 5.5, w: W - 2 * M, h: 0.5, isTextBox: true, margin: 0,
    fontFace: F.cuerpo, fontSize: 13, color: C.texto });
}

/* ══════════════ 3 · Rendimiento por indicador ══════════════ */
{
  const s = pres.addSlide();
  s.background = { color: C.claro };
  encabeza(s, "Paso 2 · rendimiento de pauta", "No todo se suma");

  const det = R.consolidados_detalle || {};
  const filas = Object.entries(det)
    .filter(([, v]) => v.resultados > 0)
    .sort((a, b) => b[1].gasto - a[1].gasto);

  s.addText("El campo de resultados mide algo distinto en cada campaña. Sumar entre indicadores "
    + "produce un número plausible y falso, así que cada uno se consolida por separado.", {
    x: M, y: 1.42, w: W - 2 * M, h: 0.4, isTextBox: true, margin: 0,
    fontFace: F.cuerpo, fontSize: 12.5, color: C.muted });

  let y = 1.95;
  filas.forEach(([ind, v]) => {
    const nombre = ind.includes("QualifiedLead") ? "QualifiedLead (evento personalizado)"
                 : ind.replace("actions:", "");
    s.addShape(pres.ShapeType.roundRect, {
      x: M, y, w: 6.1, h: 0.86, rectRadius: 0.06,
      fill: { color: C.blanco }, line: { color: C.linea, width: 1 } });
    s.addText(nombre, {
      x: M + 0.24, y: y + 0.11, w: 4.2, h: 0.3, isTextBox: true, margin: 0,
      fontFace: F.cuerpo, fontSize: 12.5, bold: true, color: C.oscuro });
    s.addText(`${entero(v.resultados)} resultados · ${dinero(v.gasto)} · ${v.campanas} campaña(s)`
      + (v.excluidas ? ` · ${v.excluidas} excluida(s) por hueco` : ""), {
      x: M + 0.24, y: y + 0.44, w: 4.4, h: 0.3, isTextBox: true, margin: 0,
      fontFace: F.cuerpo, fontSize: 10.5, color: C.muted });
    s.addText(v.costo_por_resultado != null
        ? "$" + v.costo_por_resultado.toFixed(2) : "—", {
      x: M + 4.75, y: y + 0.18, w: 1.15, h: 0.5, isTextBox: true, margin: 0,
      align: "right", fontFace: F.titulo, fontSize: 21, bold: true, color: C.dato });
    y += 1.0;
  });

  const camps = (R.campanas_por_indicador_principal || [])
    .sort((a, b) => a.costo_por_resultado - b.costo_por_resultado);
  if (camps.length) {
    s.addChart(pres.ChartType.bar, [{
      name: "Costo por resultado (USD)",
      // Sin el sufijo [PAIS]: en un grafico de campañas el pais es redundante
      // y antes la etiqueta se cortaba a media llave.
      labels: camps.map(c => corta(
        c.etiqueta.replace("Campaña ", "").replace(/\s*\[[^\]]*\]$/, ""), 30)),
      values: camps.map(c => c.costo_por_resultado),
    }], {
      x: 7.0, y: 1.9, w: W - 7.0 - M, h: 3.4,
      barDir: "bar", showTitle: true,
      title: "Costo por resultado · indicador actions:lead",
      titleFontSize: 12, titleFontFace: F.cuerpo, titleColor: C.oscuro,
      chartColors: [C.medio], showLegend: false,
      showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "$0.00",
      dataLabelFontSize: 10, dataLabelFontFace: F.cuerpo, dataLabelColor: C.texto,
      catAxisLabelColor: C.muted, catAxisLabelFontSize: 9.5, catAxisLabelFontFace: F.cuerpo,
      valAxisLabelColor: C.muted, valAxisLabelFontSize: 9, valAxisLabelFormatCode: "$0.00",
      valGridLine: { color: C.linea, size: 1 }, catGridLine: { style: "none" },
      valAxisMaxVal: Math.ceil(Math.max(...camps.map(c => c.costo_por_resultado)) * 1.25),
    });
  }
  s.addText("Fuente: desglose por país de la cuenta publicitaria, rango cerrado " + R.corrida.rango, {
    x: M, y: 6.55, w: W - 2 * M, h: 0.28, isTextBox: true, margin: 0,
    fontFace: F.cuerpo, fontSize: 9.5, italic: true, color: C.muted });
}

/* ══════════════ 4 · Competencia ══════════════ */
{
  const s = pres.addSlide();
  s.background = { color: C.claro };
  encabeza(s, "Paso 3 · competencia activa", "Contar anuncios no mide presión");

  const mercados = Object.entries(R.competencia || {});
  const principal = mercados.reduce((a, b) => b[1].presion_total > a[1].presion_total ? b : a, mercados[0]);
  const [mNom, mDat] = principal;
  const todos = Object.entries(mDat.detalle)
    .sort((a, b) => b[1].presion_real - a[1].presion_real);
  const inflado = todos.reduce((t, [, d]) => t + d.activos_declarados, 0);
  // Solo se dibujan tarjetas de quien ejerce presion. Los de presion cero van
  // en una linea: ocupar una tarjeta con un cero desperdicia espacio y antes
  // provocaba que la quinta tarjeta se solapara con el bloque de mercado libre.
  const comps = todos.filter(([, d]) => d.presion_real > 0);
  const ausentes = todos.filter(([, d]) => d.presion_real === 0).map(([n]) => n);

  s.addText(`En ${mNom}, sumar los anuncios activos de todos daría ${entero(inflado)}. `
    + `La presión real —solo los que disputan nuestra categoría— es ${entero(mDat.presion_total)}.`, {
    x: M, y: 1.42, w: W - 2 * M, h: 0.42, isTextBox: true, margin: 0,
    fontFace: F.cuerpo, fontSize: 12.5, color: C.muted });

  let y = 2.0;
  comps.forEach(([nombre, d]) => {
    const brecha = d.activos_declarados !== d.presion_real;
    s.addShape(pres.ShapeType.roundRect, {
      x: M, y, w: 6.5, h: 0.72, rectRadius: 0.06,
      fill: { color: C.blanco },
      line: { color: brecha ? C.hueco : C.linea, width: brecha ? 1.5 : 1 } });
    s.addText(nombre, {
      x: M + 0.22, y: y + 0.09, w: 3.0, h: 0.3, isTextBox: true, margin: 0,
      fontFace: F.cuerpo, fontSize: 12.5, bold: true, color: C.oscuro });
    s.addText(brecha ? `${entero(d.activos_declarados)} activos en total` : "todo su inventario en categoría", {
      x: M + 0.22, y: y + 0.38, w: 3.4, h: 0.26, isTextBox: true, margin: 0,
      fontFace: F.cuerpo, fontSize: 10, color: C.muted });
    s.addText(entero(d.presion_real), {
      x: M + 4.5, y: y + 0.12, w: 1.05, h: 0.48, isTextBox: true, margin: 0,
      align: "right", fontFace: F.titulo, fontSize: 22, bold: true,
      color: d.presion_real > 0 ? C.oscuro : C.mutedInv });
    s.addText("presión", {
      x: M + 5.6, y: y + 0.26, w: 0.75, h: 0.26, isTextBox: true, margin: 0,
      fontFace: F.cuerpo, fontSize: 9.5, color: C.muted });
    y += 0.84;
  });
  if (ausentes.length) {
    s.addText(`Sin presencia medida en ${mNom}: ${ausentes.join(", ")}.`, {
      x: M + 0.22, y: 5.28, w: 6.3, h: 0.26, isTextBox: true, margin: 0,
      fontFace: F.cuerpo, fontSize: 10.5, italic: true, color: C.muted });
  }

  const activos = comps;
  if (activos.length) {
    s.addChart(pres.ChartType.doughnut, [{
      name: "Presión real",
      labels: activos.map(([n]) => corta(n, 22)),
      values: activos.map(([, d]) => d.presion_real),
    }], {
      x: 7.35, y: 1.9, w: W - 7.35 - M, h: 3.5,
      showTitle: true, title: `Reparto de la presión real · ${mNom}`,
      titleFontSize: 12, titleFontFace: F.cuerpo, titleColor: C.oscuro,
      chartColors: [C.medio, C.dato, C.hueco, C.riesgo, C.mutedInv],
      holeSize: 52, showLegend: true, legendPos: "b",
      legendFontSize: 10, legendFontFace: F.cuerpo, legendColor: C.texto,
      showValue: true, dataLabelFontSize: 11, dataLabelColor: C.blanco,
      dataLabelFontFace: F.cuerpo,
    });
  }

  const vacios = mercados.filter(([, d]) => d.presion_total === 0).map(([n]) => n);
  if (vacios.length) {
    s.addShape(pres.ShapeType.roundRect, {
      x: M, y: 5.72, w: 6.5, h: 0.92, rectRadius: 0.08,
      fill: { color: C.oscuro }, line: { color: C.dato, width: 1.5 } });
    s.addText(`${vacios.join(", ")}: sin disputa medida`, {
      x: M + 0.24, y: 5.86, w: 6.0, h: 0.3, isTextBox: true, margin: 0,
      fontFace: F.cuerpo, fontSize: 13, bold: true, color: C.dato });
    s.addText("Ninguno de los competidores del registro curado tiene anuncios activos ahí.", {
      x: M + 0.24, y: 6.18, w: 6.0, h: 0.34, isTextBox: true, margin: 0,
      fontFace: F.cuerpo, fontSize: 10.5, color: C.mutedInv });
  }
  s.addText("La Ad Library no acepta rango de fechas: esto es una foto del día de la corrida, no una serie.", {
    x: 7.35, y: 5.62, w: W - 7.35 - M, h: 0.5, isTextBox: true, margin: 0,
    fontFace: F.cuerpo, fontSize: 9.5, italic: true, color: C.muted });
}

/* ══════════════ 5-6 · Hallazgos ══════════════ */
["oportunidad", "riesgo"].forEach((tipo) => {
  const lista = (R.hallazgos || []).filter(h => h.tipo === tipo);
  if (!lista.length) return;
  const s = pres.addSlide();
  s.background = { color: tipo === "riesgo" ? C.oscuro : C.claro };
  const fondoOscuro = tipo === "riesgo";
  const cTitulo = fondoOscuro ? C.blanco : C.oscuro;
  const cTexto = fondoOscuro ? C.blanco : C.texto;
  const cSuave = fondoOscuro ? C.mutedInv : C.muted;
  const acento = tipo === "riesgo" ? C.riesgo : C.dato;

  s.addText((tipo === "riesgo" ? "Paso 5 · riesgos detectados" : "Paso 5 · oportunidades detectadas").toUpperCase(), {
    x: M, y: 0.42, w: W - 2 * M, h: 0.24, isTextBox: true, margin: 0,
    fontFace: F.cuerpo, fontSize: 11, bold: true, color: acento, charSpacing: 2 });
  s.addText(tipo === "riesgo" ? "Lo que la competencia está haciendo" : "Dónde hay dinero mal colocado", {
    x: M, y: 0.68, w: W - 2 * M, h: 0.62, isTextBox: true, margin: 0,
    fontFace: F.titulo, fontSize: 34, bold: true, color: cTitulo });

  const cols = Math.min(lista.length, 3);
  const cw = (W - 2 * M - (cols - 1) * 0.3) / cols;
  lista.slice(0, 3).forEach((h, k) => {
    const x = M + k * (cw + 0.3);
    s.addShape(pres.ShapeType.roundRect, {
      x, y: 1.55, w: cw, h: 4.05, rectRadius: 0.08,
      fill: { color: fondoOscuro ? C.blanco : C.blanco, transparency: fondoOscuro ? 92 : 0 },
      line: { color: acento, width: 1.5 } });
    s.addShape(pres.ShapeType.ellipse, {
      x: x + 0.26, y: 1.8, w: 0.42, h: 0.42, fill: { color: acento } });
    s.addText(String(k + 1), {
      x: x + 0.26, y: 1.8, w: 0.42, h: 0.42, isTextBox: true, margin: 0,
      align: "center", valign: "middle", fontFace: F.cuerpo, fontSize: 13,
      bold: true, color: C.oscuro });
    s.addText(h.titulo, {
      x: x + 0.26, y: 2.34, w: cw - 0.52, h: 0.78, isTextBox: true, margin: 0,
      fontFace: F.cuerpo, fontSize: 14, bold: true, color: cTitulo, valign: "top" });
    s.addText(h.afirmacion, {
      x: x + 0.26, y: 3.14, w: cw - 0.52, h: 1.35, isTextBox: true, margin: 0,
      fontFace: F.cuerpo, fontSize: 11.5, color: cTexto, valign: "top" });
    if (h.calculo) {
      s.addText(h.calculo, {
        x: x + 0.26, y: 4.30, w: cw - 0.52, h: 0.42, isTextBox: true, margin: 0,
        fontFace: "Courier New", fontSize: 9.5, color: acento, valign: "top" });
    }
    const ev = (h.evidencia || []).map(e => `${e.dato}: ${e.valor}`).join("\n");
    s.addText("EVIDENCIA", {
      x: x + 0.26, y: 4.76, w: cw - 0.52, h: 0.22, isTextBox: true, margin: 0,
      fontFace: F.cuerpo, fontSize: 8.5, bold: true, color: cSuave, charSpacing: 1 });
    s.addText(ev, {
      x: x + 0.26, y: 4.98, w: cw - 0.52, h: 0.58, isTextBox: true, margin: 0,
      fontFace: F.cuerpo, fontSize: 9, color: cSuave, valign: "top" });
  });
  if (lista.length > 3) {
    s.addText(`+ ${lista.length - 3} hallazgo(s) más en el anexo de la corrida.`, {
      x: M, y: 5.85, w: W - 2 * M, h: 0.28, isTextBox: true, margin: 0,
      fontFace: F.cuerpo, fontSize: 10, italic: true, color: cSuave });
  }
  s.addNotes(lista.map(h => `${h.titulo}\n${h.afirmacion}\n${h.advertencia || ""}`).join("\n\n"));
});

/* ══════════════ 7 · Plan de producción ══════════════ */
{
  const s = pres.addSlide();
  s.background = { color: C.claro };
  encabeza(s, "Paso 7 · plan de producción", "Las cantidades salen del dato");
  const recs = R.plan.recomendaciones || [];
  const cuant = recs.filter(r => r.cantidad);
  const sinDato = recs.filter(r => !r.cantidad);

  chip(s, M, 1.45, `${cuant.length} CUANTIFICADAS`, true, 2.15);
  chip(s, M + 2.35, 1.45, `${sinDato.length} SIN DATO`, false, 2.15);

  let y = 2.15;
  cuant.slice(0, 2).forEach(r => {
    s.addShape(pres.ShapeType.roundRect, {
      x: M, y, w: W - 2 * M, h: 1.72, rectRadius: 0.08,
      fill: { color: C.blanco }, line: { color: C.dato, width: 2 },
      shadow: { type: "outer", angle: 90, blur: 8, offset: 1, color: "000000", opacity: 0.06 } });
    s.addText(r.titulo, {
      x: M + 0.3, y: y + 0.16, w: 7.5, h: 0.32, isTextBox: true, margin: 0,
      fontFace: F.cuerpo, fontSize: 14, bold: true, color: C.oscuro });
    s.addText(r.accion, {
      x: M + 0.3, y: y + 0.5, w: 7.5, h: 0.56, isTextBox: true, margin: 0,
      fontFace: F.cuerpo, fontSize: 11, color: C.texto, valign: "top" });
    s.addText(r.cantidad.calculo, {
      x: M + 0.3, y: y + 1.08, w: 7.5, h: 0.52, isTextBox: true, margin: 0,
      fontFace: "Courier New", fontSize: 8.5, color: C.muted, valign: "top" });
    const v = Math.abs(r.cantidad.valor - Math.round(r.cantidad.valor)) < 1e-9
      ? entero(r.cantidad.valor) : r.cantidad.valor.toFixed(0);
    s.addText(v, {
      x: 8.35, y: y + 0.28, w: 4.35 - 0.3, h: 0.78, isTextBox: true, margin: 0,
      align: "center", fontFace: F.titulo, fontSize: 46, bold: true, color: C.dato });
    s.addText(r.cantidad.unidad, {
      x: 8.35, y: y + 1.06, w: 4.35 - 0.3, h: 0.5, isTextBox: true, margin: 0,
      align: "center", fontFace: F.cuerpo, fontSize: 10.5, color: C.muted, valign: "top" });
    y += 1.9;
  });

  const conAdv = cuant.filter(r => r.advertencia);
  if (conAdv.length) {
    s.addShape(pres.ShapeType.roundRect, {
      x: M, y: y + 0.15, w: W - 2 * M, h: 1.1, rectRadius: 0.08,
      fill: { color: "FDF3E3" }, line: { color: C.hueco, width: 1.5 } });
    s.addText("CÓMO LEER ESTE NÚMERO", {
      x: M + 0.3, y: y + 0.32, w: W - 2 * M - 0.6, h: 0.24, isTextBox: true,
      margin: 0, fontFace: F.cuerpo, fontSize: 9.5, bold: true,
      color: C.hueco, charSpacing: 1 });
    s.addText(conAdv[0].advertencia, {
      x: M + 0.3, y: y + 0.58, w: W - 2 * M - 0.6, h: 0.5, isTextBox: true,
      margin: 0, fontFace: F.cuerpo, fontSize: 11.5, color: C.texto, valign: "top" });
  }
  s.addText("Toda cantidad viaja con su aritmética. Si el dato no alcanza, no hay número.", {
    x: M, y: 6.5, w: W - 2 * M, h: 0.3, isTextBox: true, margin: 0,
    fontFace: F.cuerpo, fontSize: 11, italic: true, color: C.muted });
  s.addNotes(cuant.map(r => `${r.titulo}\n${r.cantidad.calculo}\n${r.advertencia || ""}`).join("\n\n"));
}

/* ══════════════ 8 · Lo que no se pudo cuantificar ══════════════ */
{
  const sinDato = (R.plan.recomendaciones || []).filter(r => !r.cantidad);
  if (sinDato.length) {
    const s = pres.addSlide();
    s.background = { color: C.claro };
    encabeza(s, "Paso 7 · huecos del plan", "Lo que no se pudo cuantificar");
    s.addText("Estas decisiones quedan para la mesa. El sistema dice qué dato falta "
      + "para poder calcularlas, en lugar de estimarlas.", {
      x: M, y: 1.42, w: W - 2 * M, h: 0.4, isTextBox: true, margin: 0,
      fontFace: F.cuerpo, fontSize: 12.5, color: C.muted });
    let y = 1.95;
    sinDato.slice(0, 3).forEach(r => {
      s.addShape(pres.ShapeType.roundRect, {
        x: M, y, w: W - 2 * M, h: 1.45, rectRadius: 0.08,
        fill: { color: C.blanco }, line: { color: C.hueco, width: 1.5 } });
      s.addText(r.titulo, {
        x: M + 0.3, y: y + 0.14, w: 5.6, h: 0.58, isTextBox: true, margin: 0,
        fontFace: F.cuerpo, fontSize: 13.5, bold: true, color: C.oscuro, valign: "top" });
      s.addText(r.no_cuantificable, {
        x: M + 0.3, y: y + 0.74, w: 5.6, h: 0.58, isTextBox: true, margin: 0,
        fontFace: F.cuerpo, fontSize: 10, color: C.muted, valign: "top" });
      s.addText("DATO QUE FALTA", {
        x: M + 6.15, y: y + 0.14, w: W - 2 * M - 6.45, h: 0.22, isTextBox: true, margin: 0,
        fontFace: F.cuerpo, fontSize: 8.5, bold: true, color: C.hueco, charSpacing: 1 });
      s.addText(r.dato_que_falta, {
        x: M + 6.15, y: y + 0.38, w: W - 2 * M - 6.45, h: 0.92, isTextBox: true, margin: 0,
        fontFace: F.cuerpo, fontSize: 10.5, color: C.texto, valign: "top" });
      y += 1.6;
    });
  }
}

/* ══════════════ 9 · Trazabilidad ══════════════ */
{
  const s = pres.addSlide();
  s.background = { color: C.oscuro };
  s.addText("TRAZABILIDAD", {
    x: M, y: 1.4, w: W - 2 * M, h: 0.3, isTextBox: true, margin: 0,
    fontFace: F.cuerpo, fontSize: 12, bold: true, color: C.dato, charSpacing: 3 });
  s.addText("De dónde salió cada número", {
    x: M, y: 1.75, w: W - 2 * M, h: 0.7, isTextBox: true, margin: 0,
    fontFace: F.titulo, fontSize: 38, bold: true, color: C.blanco });
  const fuentes = R.plan.fuentes_usadas || [];
  s.addText(
    fuentes.length
      ? fuentes.map((f, i) => ({ text: f, options: { bullet: true,
          breakLine: i < fuentes.length - 1, paraSpaceAfter: 10,
          fontSize: 12.5, color: C.blanco } }))
      : [{ text: "Sin fuentes registradas.", options: { fontSize: 12.5, color: C.blanco } }],
    { x: M, y: 2.7, w: 8.0, h: 2.2, isTextBox: true, margin: 0, fontFace: F.cuerpo, valign: "top" });
  s.addText("Las respuestas crudas de cada consulta quedan guardadas sin editar junto a "
    + "esta corrida. Cualquier cifra del deck se puede seguir hasta el JSON que la produjo.", {
    x: M, y: 5.1, w: 8.0, h: 0.7, isTextBox: true, margin: 0,
    fontFace: F.cuerpo, fontSize: 11.5, color: C.mutedInv, valign: "top" });
  s.addShape(pres.ShapeType.roundRect, {
    x: 8.9, y: 2.7, w: W - 8.9 - M, h: 2.35, rectRadius: 0.08,
    fill: { color: C.blanco, transparency: 92 }, line: { color: C.dato, width: 1.5 } });
  s.addText("PERIODO", {
    x: 9.15, y: 2.95, w: 3.2, h: 0.24, isTextBox: true, margin: 0,
    fontFace: F.cuerpo, fontSize: 9, bold: true, color: C.dato, charSpacing: 1 });
  s.addText(R.corrida.rango, {
    x: 9.15, y: 3.2, w: 3.2, h: 0.5, isTextBox: true, margin: 0,
    fontFace: F.cuerpo, fontSize: 14, bold: true, color: C.blanco, valign: "top" });
  s.addText("RANGO CERRADO", {
    x: 9.15, y: 3.78, w: 3.2, h: 0.24, isTextBox: true, margin: 0,
    fontFace: F.cuerpo, fontSize: 9, bold: true, color: C.dato, charSpacing: 1 });
  s.addText("Nunca un preset móvil: el mismo reporte debe dar el mismo número mañana.", {
    x: 9.15, y: 4.02, w: 3.2, h: 0.85, isTextBox: true, margin: 0,
    fontFace: F.cuerpo, fontSize: 10.5, color: C.mutedInv, valign: "top" });
}

pres.writeFile({ fileName: salida }).then(() => {
  console.log(`Deck generado: ${salida} · ${pres.slides.length} láminas`);
});
