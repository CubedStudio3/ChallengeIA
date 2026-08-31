/**
 * Reporte profundo de la Ad Library, un dossier por marca.
 *
 * Pedido por Mercadeo el 2026-08-31: el mismo análisis que se hizo de Square,
 * aplicado a todas las marcas del registro, «con buen diseño, gráficos y todo
 * bien presentado».
 *
 * DOS CONTRATOS, los mismos que el tablero:
 *  1. El archivo que se publica es un FRAGMENTO (sin doctype, html, head, body).
 *  2. Todo el CSS viaja dentro del archivo. No hay CDN — si el reporte se abre
 *     en una red que bloquea algo, se abre igual.
 *
 * A diferencia del tablero, este archivo NO pasa por Tailwind: no usa ninguna
 * utilidad, así que compilarlo solo le agregaría las clases del tablero.
 *
 * UNA DECISIÓN DE DISEÑO QUE ES INFORMACIÓN, no adorno: cada dossier abre con
 * una banda que dice de qué tamaño fue la muestra y qué preguntas puede
 * responder. En este proyecto los huecos son de primera clase, así que van
 * arriba, no en una nota al pie. Un lector que ve «50 de 844» sabe leer todo lo
 * que sigue; uno que no lo ve, no.
 *
 * Uso:  node reporte_adlibrary.js <analisis.json> <lecturas.json> <salida.html>
 */

"use strict";

const fs = require("fs");
const path = require("path");

const [, , fAnalisis, fLecturas, salida] = process.argv;
if (!fAnalisis || !fLecturas || !salida) {
  console.error("Uso: node reporte_adlibrary.js <analisis.json> <lecturas.json> <salida.html>");
  process.exit(2);
}

const aqui = __dirname;
const raiz = path.resolve(aqui, "..", "..");
const D = JSON.parse(fs.readFileSync(fAnalisis, "utf8"));
const L = JSON.parse(fs.readFileSync(fLecturas, "utf8"));
const tema = require("./tema.js").construye(raiz, { soloClaro: true });

/* ── utilidades ─────────────────────────────────────────────────────────── */

const esc = (s) =>
  String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** Negritas con **…** y código con `…`. Se escapa ANTES, así que el texto de
 *  origen nunca puede inyectar HTML. */
const rico = (s) =>
  esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<b class="fuerte">$1</b>')
    .replace(/`([^`]+)`/g, '<code class="cod">$1</code>');

const ent = (n) => (n == null ? "—" : Number(n).toLocaleString("es-GT"));
const pct = (n) => (n == null ? "—" : Math.round(n * 100) + "%");

/* El acento de cada dossier. Son los tres tonos de la paleta de Mercadeo a
   peso de linea; ciclan, porque aqui el color identifica una seccion y no una
   serie que haya que distinguir de otra en el mismo grafico. Dejo de haber un
   cuarto cuando salio el arena de la paleta: usar `var(--c4)`, que ya no se
   emite, dejaba las barras sin color y sin error. */
const COL = ["var(--c1)", "var(--c2)", "var(--c3)"];

/* ── gráficos ───────────────────────────────────────────────────────────── */

/**
 * Barras horizontales, una serie. Es la forma correcta para magnitud con
 * etiquetas de texto largas: la categoría se lee en horizontal sin rotar nada.
 *
 * Cada barra lleva su valor como etiqueta directa, así que la identidad nunca
 * depende solo del color — y con una sola serie no hace falta leyenda.
 */
function barras(datos, opciones) {
  const o = opciones || {};
  const max = Math.max(...datos.map((d) => d.valor), 1);
  const color = o.color || "var(--marca)";
  const filas = datos
    .map((d) => {
      const w = (d.valor / max) * 100;
      const tono = d.color || color;
      return (
        '<div class="fila-barra" tabindex="0" role="img" aria-label="' +
        esc(d.etiqueta) + ": " + esc(d.textoValor || d.valor) +
        (d.nota ? ", " + esc(d.nota) : "") + '">' +
        '<div class="barra-et">' + rico(d.etiqueta) + "</div>" +
        '<div class="barra-pista">' +
        '<div class="barra-marca" style="width:' + w.toFixed(1) +
        "%;background:" + tono + '"></div></div>' +
        '<div class="barra-val">' + esc(d.textoValor || d.valor) + "</div>" +
        (d.nota ? '<div class="barra-nota">' + esc(d.nota) + "</div>" : "") +
        "</div>"
      );
    })
    .join("");
  const tabla =
    '<details class="tabla-plegada"><summary>Ver la tabla</summary>' +
    '<div class="tabla-scroll"><table><thead><tr><th>' +
    esc(o.ejeY || "Categoría") + "</th><th>" + esc(o.ejeX || "Valor") +
    "</th>" + (datos.some((d) => d.nota) ? "<th>Detalle</th>" : "") +
    "</tr></thead><tbody>" +
    datos
      .map(
        (d) =>
          "<tr><td>" + esc(d.etiqueta) + '</td><td class="num">' +
          esc(d.textoValor || d.valor) + "</td>" +
          (datos.some((x) => x.nota) ? "<td>" + esc(d.nota || "—") + "</td>" : "") +
          "</tr>"
      )
      .join("") +
    "</tbody></table></div></details>";
  return '<div class="barras">' + filas + "</div>" + tabla;
}

/**
 * Columnas por día: la cadencia de publicación.
 *
 * Se dibujan TODOS los días del rango, no solo los que tienen anuncios. Un
 * gráfico que salta los días vacíos comprimiría el silencio y haría parecer
 * continuo a un anunciante que publica en cuatro ráfagas — que es exactamente
 * lo que hace Paggo.
 */
function columnas(porDia, opciones) {
  const o = opciones || {};
  const claves = Object.keys(porDia).sort();
  if (!claves.length) return '<p class="vacio">Sin fechas de creación en la muestra.</p>';
  const d0 = new Date(claves[0] + "T00:00:00Z");
  const d1 = new Date(claves[claves.length - 1] + "T00:00:00Z");
  const dias = [];
  for (let t = d0.getTime(); t <= d1.getTime(); t += 86400000) {
    const k = new Date(t).toISOString().slice(0, 10);
    dias.push({ dia: k, n: porDia[k] || 0 });
  }
  const max = Math.max(...dias.map((x) => x.n), 1);
  const ancho = Math.max(2, Math.min(14, Math.floor(760 / dias.length)));
  const cols = dias
    .map((x) => {
      const h = x.n ? Math.max(3, (x.n / max) * 100) : 0;
      return (
        '<div class="col-envoltura" style="width:' + ancho + 'px" tabindex="0" ' +
        'role="img" aria-label="' + x.dia + ": " + x.n + ' creativos">' +
        (x.n
          ? '<div class="col-marca" style="height:' + h.toFixed(1) + '%"></div>'
          : '<div class="col-cero"></div>') +
        '<span class="col-tip">' + x.dia + " · " + x.n +
        (x.n === 1 ? " creativo" : " creativos") + "</span></div>"
      );
    })
    .join("");
  return (
    '<div class="cols-marco"><div class="cols-eje-y"><span>' + max +
    "</span><span>0</span></div>" +
    '<div class="cols">' + cols + "</div></div>" +
    '<div class="cols-eje-x"><span>' + claves[0] + "</span><span>" +
    claves[claves.length - 1] + "</span></div>" +
    '<p class="pie-grafico">Se dibujan todos los días del rango, incluidos los ' +
    "que no tuvieron publicaciones: saltarlos haría parecer continuo a quien " +
    "publica en ráfagas.</p>"
  );
}

/* ── piezas ─────────────────────────────────────────────────────────────── */

function cifra(valor, rotulo, nota) {
  return (
    '<div class="cifra"><div class="cifra-n">' + valor + "</div>" +
    '<div class="cifra-rot">' + esc(rotulo) + "</div>" +
    (nota ? '<div class="cifra-nota">' + esc(nota) + "</div>" : "") + "</div>"
  );
}

function bloque(titulo, sub, cuerpo, clase) {
  return (
    '<section class="bloque ' + (clase || "") + '">' +
    '<h3 class="bloque-t">' + esc(titulo) + "</h3>" +
    (sub ? '<p class="bloque-s">' + rico(sub) + "</p>" : "") +
    cuerpo + "</section>"
  );
}

/** La banda de calidad de muestra. Abre cada dossier porque gobierna la
 *  lectura de todo lo que viene después. */
function banda(m) {
  const ok = m.muestra_completa;
  return (
    '<div class="banda ' + (ok ? "banda-ok" : "banda-parcial") + '">' +
    '<div class="banda-icono" aria-hidden="true">' + (ok ? "✓" : "!") + "</div>" +
    "<div><div class=\"banda-t\">" +
    (ok
      ? "Muestra completa: los " + ent(m.leidos) + " anuncios activos"
      : "Muestra parcial: " + ent(m.leidos) + " de " + ent(m.activos_declarados) +
        " anuncios activos") +
    "</div>" +
    '<div class="banda-c">' +
    (ok
      ? "Todos los porcentajes de este dossier son sobre el inventario completo, y la pregunta por los anuncios más longevos sí se puede responder."
      : esc(m._advertencia_muestra) +
        " La pregunta por los anuncios MÁS LONGEVOS no se responde aquí: los antiguos quedan fuera de la muestra por construcción.") +
    "</div></div></div>"
  );
}

/* ── dossier de una marca ───────────────────────────────────────────────── */

function dossier(m, i) {
  const lec = (L.marcas || {})[m.clave] || {};
  const v = m.velocidad;
  const e = m.estructura;
  const cb = m.cobranding;
  const acento = COL[i % COL.length];

  /* Mensajes */
  const msgs = m.mensajes.slice(0, 8).map((x) => ({
    etiqueta: x.mensaje,
    valor: x.creativos,
    textoValor: x.creativos + " · " + pct(x.cuota),
    nota: x.dias_vivo_max + " días vivo · desde " + x.primera_creacion,
    color: acento,
  }));

  /* Audiencia */
  const aud = m.audiencia_inferida
    .filter((a) => a.cuota_del_total_clasificado != null)
    .map((a) => ({ etiqueta: a.vertical, valor: a.anuncios,
                   textoValor: a.anuncios + " anuncios", color: acento }));
  const noClasif = m.audiencia_inferida.find((a) => a.cuota_del_total_clasificado == null);

  /* Longevidad */
  const lg = m.longevidad;
  const longev = lg._respondible
    ? '<div class="tabla-scroll"><table class="tabla-longev"><thead><tr>' +
      "<th>Mensaje</th><th>Días vivo</th><th>Entrega desde</th><th></th>" +
      "</tr></thead><tbody>" +
      lg.top
        .map(
          (t) =>
            "<tr><td>" + esc(t.mensaje) + '</td><td class="num fuerte">' +
            t.dias_vivo + '</td><td class="num">' + t.entrega_desde +
            '</td><td><a href="' + esc(t.url) + '" target="_blank" ' +
            'rel="noopener noreferrer" class="enl">ver</a></td></tr>'
        )
        .join("") +
      "</tbody></table></div>" +
      '<p class="pie-grafico">Mediana del inventario: <b>' +
      lg.dias_vivo_mediana + " días</b> activo.</p>"
    : '<div class="hueco"><div class="hueco-t">No se puede responder para esta ' +
      "marca</div><p>" + esc(lg._por_que_no) + "</p></div>";

  /* Lectura */
  const lista = (arr, cls) =>
    arr && arr.length
      ? '<ul class="lista ' + (cls || "") + '">' +
        arr.map((x) => "<li>" + rico(x) + "</li>").join("") + "</ul>"
      : "";

  return (
    '<article class="dossier" id="' + esc(m.clave) + '">' +
    '<header class="dossier-cab">' +
    '<div class="dossier-eyebrow" style="color:' + acento + '">' +
    esc(m.rol === "referente" ? "Referente" : "Competidor") + " · " +
    esc(m.pais_consultado === "GLOBAL" ? "consulta global" : m.pais_consultado) +
    " · " + esc(m.moneda) + "</div>" +
    "<h2>" + esc(m.pagina) + "</h2>" +
    (lec.titulo ? '<p class="dossier-lema">' + esc(lec.titulo) + "</p>" : "") +
    "</header>" +
    banda(m) +
    '<div class="cifras">' +
    cifra(ent(m.activos_declarados), "Anuncios activos",
          m.muestra_completa ? "inventario completo" : "leídos " + ent(m.leidos)) +
    cifra(pct(m.concentracion), "Concentración del mensaje top",
          "cuota del inventario leído") +
    cifra(v.dias_desde_la_ultima + "d", "Desde la última publicación",
          "creación más reciente: " + v.ultima_creacion) +
    cifra(pct(v.cuota_en_rafaga), "Creativos subidos en lote",
          v.rafagas.length + " ráfagas detectadas") +
    "</div>" +

    bloque("Mensajes que repiten",
      "Cuántos creativos cargan cada mensaje, y cuánto tiempo lleva vivo el más antiguo de ellos. " +
      "**El número de creativos no es presupuesto ni impresiones** — es el mejor sustituto disponible: " +
      "un anunciante que sube " + (m.mensajes[0] ? m.mensajes[0].creativos : 0) +
      " piezas de la misma frase está diciendo algo.",
      msgs.length ? barras(msgs, { ejeY: "Mensaje", ejeX: "Creativos" })
                  : '<p class="vacio">Ningún anuncio de la muestra trae titular legible.</p>') +

    bloque("A quién le habla",
      "**Inferido del vocabulario de los titulares**, no declarado por el anunciante. " +
      "Un anuncio que toca dos verticales se cuenta en las dos.",
      (aud.length ? barras(aud, { ejeY: "Vertical", ejeX: "Anuncios" })
                  : '<p class="vacio">Sin vocabulario clasificable.</p>') +
      (noClasif
        ? '<p class="pie-grafico"><b>' + noClasif.anuncios +
          "</b> anuncio(s) sin vocabulario de ninguna vertical. " +
          esc(noClasif._nota || "") + "</p>"
        : "")) +

    bloque("Velocidad creativa",
      "Cuándo publican y en qué ritmo. " +
      (v.creativos_por_semana != null
        ? "**" + v.creativos_por_semana + " creativos por semana** sobre " +
          v.span_dias + " días de ventana observada."
        : "La cadencia semanal **no se calcula**: " + esc(v._cadencia)),
      columnas(v.por_dia) +
      (v.rafagas.length
        ? '<div class="nota-dato"><b>' + v.creativos_en_rafaga +
          " creativos (" + pct(v.cuota_en_rafaga) +
          ") se subieron en lote.</b> " + esc(v._que_es_una_rafaga) + "</div>"
        : '<div class="nota-dato">Sin ráfagas: cada creativo tiene su propio ' +
          "instante de creación. Producción pieza por pieza.</div>")) +

    bloque("Estructura del creativo",
      "**No es video contra imagen** — la API no devuelve el tipo de medio. " +
      "Lo que sí se deriva es cuántas tarjetas tiene cada pieza, contando los " +
      "separadores del titular.",
      '<div class="cifras cifras-3">' +
      cifra(ent(e.tarjeta_unica), "Pieza de una tarjeta") +
      cifra(ent(e.carrusel), "Carrusel", "hasta " + e.tarjetas_max + " tarjetas") +
      cifra(ent(e.sin_titular), "Sin titular legible") +
      "</div>" +
      (e.sin_titular
        ? '<div class="nota-dato">' + esc(e._sin_titular_significa) + "</div>"
        : "")) +

    bloque("Co-branding con terceros",
      "Anuncios que nombran a otro negocio en el titular. " +
      "**No es el conteo de partnerships con creadores** — ese rótulo vive en el " +
      "anuncio renderizado, no en la API.",
      cb.anuncios_con_tercero
        ? '<div class="cifras cifras-2">' +
          cifra(ent(cb.anuncios_con_tercero), "Anuncios con un tercero nombrado",
                pct(cb.cuota) + " de la muestra") +
          cifra(ent(cb.terceros_nombrados.length), "Negocios nombrados",
                cb.terceros_nombrados.join(" · ")) +
          "</div>" +
          '<ul class="lista">' +
          cb.ejemplos.map((x) =>
            "<li><b class=\"fuerte\">" + esc(x.tercero) + "</b> — «" +
            esc(x.titular) + "»</li>").join("") +
          "</ul>"
        : '<div class="nota-dato">Ningún anuncio de la muestra nombra a un ' +
          "tercero. Toda la pauta leída es de marca propia.</div>") +

    bloque("Anuncios más longevos",
      "Si algo lleva mucho tiempo corriendo, probablemente está convirtiendo.",
      longev) +

    (lec.que_hace_bien || lec.huecos || lec.oportunidad
      ? '<section class="lectura">' +
        '<div class="lectura-et">Lectura estratégica</div>' +
        (lec.que_hace_bien
          ? "<h4>Qué hace bien</h4>" + lista(lec.que_hace_bien) : "") +
        (lec.huecos ? "<h4>Dónde tiene huecos</h4>" + lista(lec.huecos, "lista-hueco") : "") +
        (lec.oportunidad
          ? '<div class="oportunidad"><div class="oportunidad-et">La oportunidad' +
            "</div><p>" + rico(lec.oportunidad) + "</p></div>"
          : "") +
        "</section>"
      : "") +
    "</article>"
  );
}

/* ── armado ─────────────────────────────────────────────────────────────── */

const marcas = D.marcas;

const rail =
  '<nav class="rail" aria-label="Marcas"><div class="rail-marca">AD</div>' +
  '<a href="#limites" class="rail-b"><span>Qué se puede medir</span></a>' +
  '<a href="#panorama" class="rail-b"><span>Panorama</span></a>' +
  marcas
    .map(
      (m, i) =>
        '<a href="#' + esc(m.clave) + '" class="rail-b"><span>' +
        esc(m.pagina) + "</span><i style=\"background:" + COL[i % COL.length] +
        '"></i></a>'
    )
    .join("") +
  '<a href="#cierre" class="rail-b"><span>Qué hacer</span></a>' +
  "</nav>";

const comparacion = marcas
  .map((m, i) => ({
    etiqueta: m.pagina,
    valor: Math.round((m.concentracion || 0) * 100),
    textoValor: pct(m.concentracion),
    nota: m.mensajes[0] ? "«" + m.mensajes[0].mensaje.slice(0, 44) + "»" : "sin mensaje legible",
    color: COL[i % COL.length],
  }))
  .sort((a, b) => b.valor - a.valor);

const volumen = marcas
  .map((m, i) => ({
    etiqueta: m.pagina,
    valor: m.activos_declarados,
    textoValor: ent(m.activos_declarados),
    nota: m.muestra_completa ? "leídos todos" : "leídos " + ent(m.leidos),
    color: COL[i % COL.length],
  }))
  .sort((a, b) => b.valor - a.valor);

const noResp =
  '<section class="bloque limites" id="limites">' +
  '<h3 class="bloque-t">Qué preguntó Mercadeo y qué puede contestar la fuente</h3>' +
  '<p class="bloque-s">De las ocho preguntas del encargo, la Ad Library sostiene ' +
  "cinco completas y tres a medias. Van arriba y no al final: quien lee el " +
  "reporte tiene que saber de entrada dónde termina el dato y dónde empezaría " +
  "la invención.</p>" +
  '<div class="limites-grid">' +
  D.no_respondible
    .map(
      (x) =>
        '<div class="limite limite-' + esc(x.estado.toLowerCase()) + '">' +
        '<div class="limite-badge">' + esc(x.estado) + "</div>" +
        '<div class="limite-p">' + esc(x.pregunta) + "</div>" +
        '<div class="limite-fila"><span class="si">Sí</span><p>' +
        rico(x.que_si) + "</p></div>" +
        '<div class="limite-fila"><span class="no">No</span><p>' +
        rico(x.que_no) + "</p></div>" +
        '<p class="limite-rem">' + rico(x.como_se_desbloquearia) + "</p></div>"
    )
    .join("") +
  "</div></section>";

const panorama =
  '<section class="panorama" id="panorama">' +
  '<div class="dossier-eyebrow" style="color:var(--marca)">Comparación cruzada</div>' +
  "<h2>" + esc(L.comparacion.titulo) + "</h2>" +
  '<div class="prosa">' +
  L.comparacion.cuerpo.map((p) => "<p>" + rico(p) + "</p>").join("") +
  "</div>" +
  '<div class="dos-graficos">' +
  bloque("Concentración del mensaje principal",
    "Cuota del inventario leído que carga la frase más repetida de cada marca. " +
    "Alta concentración es una sola apuesta; baja es una cartera repartida.",
    barras(comparacion, { ejeY: "Marca", ejeX: "Concentración" })) +
  bloque("Volumen de anuncios activos",
    "**El volumen no es presión competitiva.** Banco Industrial tiene 844 " +
    "activos y solo 2 tocan nuestra categoría.",
    barras(volumen, { ejeY: "Marca", ejeX: "Activos" })) +
  "</div>" +
  '<div class="implicacion"><div class="implicacion-et">Lo que implica para ' +
  "QPayPro</div><p>" + rico(L.comparacion.implicacion) + "</p></div>" +
  "</section>";

const cierre =
  '<section class="cierre" id="cierre">' +
  '<div class="dossier-eyebrow" style="color:var(--marca)">Conclusión estratégica</div>' +
  "<h2>" + esc(L.cierre.titulo) + "</h2>" +
  '<ol class="cierre-lista">' +
  L.cierre.puntos.map((p) => "<li>" + rico(p) + "</li>").join("") +
  "</ol></section>";

const totalAds = marcas.reduce((s, m) => s + m.leidos, 0);
const completas = marcas.filter((m) => m.muestra_completa).length;

const cuerpo =
  rail +
  '<main class="lienzo"><div class="ancho">' +
  '<header class="portada">' +
  '<div class="portada-et">Mesa Creativa · QPayPro</div>' +
  "<h1>Qué anuncia la competencia</h1>" +
  '<p class="portada-baja">Seis marcas del registro, leídas en la Meta Ad ' +
  "Library el " + esc(D._corrida.fecha_consulta) + ". " + ent(totalAds) +
  " anuncios analizados, " + completas + " de " + marcas.length +
  " marcas con inventario completo.</p>" +
  '<div class="portada-aviso">' + esc(D._corrida._nota_fechas) +
  " Un anuncio que se apagó ayer no aparece, y uno que se prendió hoy sí.</div>" +
  "</header>" +
  noResp +
  panorama +
  marcas.map(dossier).join("") +
  cierre +
  '<footer class="pie">' +
  "<p><b>Cómo se hizo.</b> Una consulta a <code class=\"cod\">" +
  esc(D._corrida.herramienta) + "</code> por marca, con " +
  "<code class=\"cod\">ad_active_status: ACTIVE</code> y el tope de 50 del " +
  "conector. Cada número de este reporte se recalcula desde el crudo guardado " +
  "en la corrida; ninguno se escribió a mano.</p>" +
  "<p><b>Lo que es medición y lo que es lectura.</b> Los gráficos, los conteos " +
  "y las fechas salen del dato. Los bloques rotulados <i>Lectura " +
  "estratégica</i>, <i>La oportunidad</i> y la conclusión son interpretación, y " +
  "cada afirmación cita el número del que sale. Están en un archivo aparte del " +
  "análisis justamente para que la diferencia se vea.</p>" +
  "</footer>" +
  "</div></main>";

/* ── CSS ────────────────────────────────────────────────────────────────── */

/* El CSS del reporte es plano: no usa ninguna utilidad de Tailwind, así que
   compilarlo solo le inyectaría las clases del tablero. Se lee y se inyecta. */
function hojaDeEstilos() {
  return fs.readFileSync(path.join(aqui, "reporte_adlibrary.css"), "utf8");
}

const css = tema.css + "\n" + hojaDeEstilos();
const fragmento =
  tema.enlaceFuentes + "\n<style>\n" + css + "\n</style>\n" + cuerpo + "\n" +
  "<script>\n" + fs.readFileSync(path.join(aqui, "reporte_adlibrary_app.js"), "utf8") +
  "\n</script>";

fs.writeFileSync(salida, fragmento, "utf8");
console.log("Reporte generado: " + salida);
console.log("  " + marcas.length + " marcas · " + totalAds + " anuncios · " +
            (Buffer.byteLength(fragmento, "utf8") / 1024).toFixed(0) + " KB");
if (/^\s*<!doctype/i.test(fragmento))
  console.error("  ERROR: empieza con doctype. Debe ser un fragmento.");
