/* Tablero semanal · lógica de cliente.
   Renderiza desde los datos embebidos y publica las aprobaciones como una
   versión nueva del propio artefacto, para que el estado se comparta entre
   quienes abren la página. */
(function () {
  "use strict";

  var leer = function (id) {
    var n = document.getElementById(id);
    try { return n ? JSON.parse(n.textContent) : null; } catch (e) { return null; }
  };
  var D = leer("datos") || {};
  var E = leer("estado") || { aprobadas: {}, version: 1 };
  var P = leer("plantilla") || { head: "", app: "" };
  if (!E.aprobadas) E.aprobadas = {};

  var soloLectura = false;
  var api = null;

  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var dinero = function (n) {
    return "$" + Number(n).toLocaleString("en-US",
      { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  var entero = function (n) {
    return Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
  };

  var CAT = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)"];
  var ETIQUETA_TIPO = {
    accion: "Acción",
    obtener_dato: "Falta el dato",
    integridad: "Integridad"
  };

  /* ───────────────── render ───────────────── */

  function banda() {
    var i = D.integridad || {};
    var exc = i.mercados_excluidos_con_gasto || {};
    var t = [];
    t.push(tarjeta(entero(i.campanas_leidas || 0), "filas campaña×país leídas", false));
    t.push(tarjeta((i.paises_con_entrega || []).join("  "), "países con entrega", false));
    t.push(tarjeta(String((i.campanas_incoherentes || []).length),
      "costos incoherentes", (i.campanas_incoherentes || []).length > 0));
    var nExc = Object.keys(exc).length;
    if (nExc) {
      var k = Object.keys(exc)[0];
      t.push(tarjeta(dinero(exc[k].gasto),
        "gasto en " + k + ", mercado excluido", true));
    }
    return '<div class="banda">' + t.join("") + "</div>";
  }
  function tarjeta(v, e, alerta) {
    return '<div class="metrica' + (alerta ? " alerta" : "") + '">' +
      '<div class="v">' + esc(v) + "</div>" +
      '<div class="e">' + esc(e) + "</div></div>";
  }

  function avisoHuecos() {
    var h = D.huecos_declarados || [];
    var exc = (D.integridad || {}).mercados_excluidos_con_gasto || {};
    var items = h.map(function (x) {
      return "<li><b>" + esc(x.fuente) + ".</b> " + esc(x.descripcion) +
        " " + esc(x.impacto) + "</li>";
    });
    Object.keys(exc).forEach(function (k) {
      items.push("<li><b>" + esc(k) + " tuvo gasto y está excluido.</b> " +
        esc(exc[k].accion_pendiente) + "</li>");
    });
    if (!items.length) return "";
    return '<div class="aviso"><h3>Lo que esta corrida no incluye</h3><ul>' +
      items.join("") + '</ul><p class="cierre">Se declara, no se rellena.</p></div>';
  }

  function zonaDecision() {
    var tareas = D.tareas_propuestas || [];
    if (!tareas.length) return "";
    var aprob = tareas.filter(function (t) { return E.aprobadas[t.idempotencia]; }).length;
    var filas = tareas.map(function (t) {
      var si = !!E.aprobadas[t.idempotencia];
      return '<article class="tarea' + (si ? " aprobada" : "") + '">' +
        '<div class="cuerpo">' +
          '<span class="chip ' + esc(t.tipo) + '">' +
            esc(ETIQUETA_TIPO[t.tipo] || t.tipo) + "</span>" +
          "<h3>" + esc(t.titulo) + "</h3>" +
          '<p class="desc">' + esc(t.descripcion) + "</p>" +
          '<div class="just mono">' + esc(t.justificacion) + "</div>" +
          '<p class="origen">Origen: ' + esc(t.origen) + "</p>" +
        "</div>" +
        '<button class="palanca" type="button" aria-pressed="' + si + '"' +
          ' data-clave="' + esc(t.idempotencia) + '"' +
          (soloLectura ? " disabled" : "") + ">" +
          '<span class="caja"><svg class="tic" viewBox="0 0 12 12" aria-hidden="true">' +
          '<path d="M2 6.4 4.6 9 10 3"/></svg></span>' +
          "<span>" + (si ? "Aprobada" : "Aprobar") + "</span></button>" +
        "</article>";
    });
    return '<section><div class="tituloSeccion"><h2>Decisión de la mesa</h2></div>' +
      '<p class="subtitulo">Marca lo que se acordó. Nada se crea en Zoho Sprint desde ' +
      'aquí: esta página es el registro de la decisión, y el orquestador crea las ' +
      'tareas aprobadas en una corrida aparte, con dry-run previo.</p>' +
      '<div class="contador"><span class="n">' + aprob + " de " + tareas.length +
      "</span><span>aprobadas</span></div>" +
      '<div class="tareas">' + filas.join("") + "</div>" +
      '<p class="nota"><b>Un hueco no se convierte en una acción.</b> Cuando el ' +
      'análisis no alcanza para justificar una cantidad, la tarea propuesta es ' +
      'conseguir el dato que falta, no actuar sin él.</p></section>';
  }

  function graficoCosto() {
    var c = (D.campanas_por_indicador_principal || []).slice()
      .sort(function (a, b) { return b.costo_por_resultado - a.costo_por_resultado; });
    if (!c.length) return "";
    var max = Math.max.apply(null, c.map(function (x) { return x.costo_por_resultado; }));
    var barras = c.map(function (x) {
      // Se quita el sufijo [PAIS] cuando el nombre ya termina en ese código:
      // "Punto de Venta SV [SV]" lee como un error, no como información.
      var nom = String(x.etiqueta).replace(/^Campaña\s+/, "");
      var m = nom.match(/^(.*?)\s*\[([A-Z]{2})\]$/);
      if (m) nom = new RegExp("\\b" + m[2] + "$").test(m[1].trim())
        ? m[1].trim() : m[1].trim() + " · " + m[2];
      var pct = (x.costo_por_resultado / max) * 100;
      return '<div class="fila" title="' + esc(nom) + " · " +
        dinero(x.costo_por_resultado) + " por resultado · " +
        dinero(x.gasto) + ' gastado">' +
        '<div class="et"><span>' + esc(nom) + '</span>' +
        '<span class="v">' + dinero(x.costo_por_resultado) + "</span></div>" +
        '<div class="pista"><div class="rell" style="width:' + pct.toFixed(1) +
        '%"></div></div></div>';
    });
    var tabla = '<div class="tablaEnv"><table><thead><tr><th>Campaña</th>' +
      '<th>Costo/result.</th><th>Resultados</th><th>Gasto</th></tr></thead><tbody>' +
      c.map(function (x) {
        var n2 = String(x.etiqueta).replace(/^Campaña\s+/, "");
        var m2 = n2.match(/^(.*?)\s*\[([A-Z]{2})\]$/);
        if (m2) n2 = new RegExp("\\b" + m2[2] + "$").test(m2[1].trim())
          ? m2[1].trim() : m2[1].trim() + " · " + m2[2];
        return "<tr><td>" + esc(n2) +
          '</td><td class="n">' + dinero(x.costo_por_resultado) +
          '</td><td class="n">' + entero(x.resultados) +
          '</td><td class="n">' + dinero(x.gasto) + "</td></tr>";
      }).join("") + "</tbody></table></div>";
    return '<div class="panel"><h3>Costo por resultado</h3>' +
      '<p class="subtitulo" style="margin:3px 0 0">Solo campañas con indicador ' +
      '<span class="mono">actions:lead</span>. No se comparan indicadores distintos.</p>' +
      '<div class="barras">' + barras.join("") + "</div>" +
      "<details><summary>Ver tabla</summary>" + tabla + "</details>" +
      '<p class="fuente">Rango cerrado ' + esc((D.corrida || {}).rango || "") + "</p></div>";
  }

  function graficoPresion() {
    var comp = D.competencia || {};
    var mercados = Object.keys(comp);
    if (!mercados.length) return "";
    var principal = mercados.reduce(function (a, b) {
      return comp[b].presion_total > comp[a].presion_total ? b : a;
    }, mercados[0]);
    var det = comp[principal].detalle || {};
    var activos = Object.keys(det)
      .filter(function (n) { return det[n].presion_real > 0; })
      .sort(function (a, b) { return det[b].presion_real - det[a].presion_real; });
    if (!activos.length) return "";
    var total = activos.reduce(function (s, n) { return s + det[n].presion_real; }, 0);
    var declarado = Object.keys(det).reduce(function (s, n) {
      return s + det[n].activos_declarados;
    }, 0);

    var segs = activos.map(function (n, k) {
      var v = det[n].presion_real, pct = (v / total) * 100;
      return '<div class="seg" style="flex:' + v + ";background:" + CAT[k % 4] +
        '" title="' + esc(n) + " · " + v + " anuncios · " + pct.toFixed(0) + '%">' +
        (pct >= 9 ? "<span>" + v + "</span>" : "") + "</div>";
    });
    var leyenda = activos.map(function (n, k) {
      return '<span><i style="background:' + CAT[k % 4] + '"></i>' + esc(n) +
        " <b>" + det[n].presion_real + "</b></span>";
    });
    var vacios = mercados.filter(function (m) { return comp[m].presion_total === 0; });
    var tabla = '<div class="tablaEnv"><table><thead><tr><th>Competidor</th>' +
      '<th>Activos totales</th><th>Presión real</th></tr></thead><tbody>' +
      Object.keys(det).sort(function (a, b) {
        return det[b].presion_real - det[a].presion_real;
      }).map(function (n) {
        return "<tr><td>" + esc(n) + '</td><td class="n">' +
          entero(det[n].activos_declarados) + '</td><td class="n">' +
          entero(det[n].presion_real) + "</td></tr>";
      }).join("") + "</tbody></table></div>";

    return '<div class="panel"><h3>Presión competitiva en ' + esc(principal) + "</h3>" +
      '<p class="subtitulo" style="margin:3px 0 0">Sumar los anuncios activos de todos ' +
      "daría " + entero(declarado) + ". Solo " + entero(total) +
      " disputan nuestra categoría.</p>" +
      '<div class="apilada">' + segs.join("") + "</div>" +
      '<div class="leyenda">' + leyenda.join("") + "</div>" +
      (vacios.length ? '<p class="fuente"><b>' + esc(vacios.join(", ")) +
        ":</b> sin disputa medida — ningún competidor del registro curado pauta ahí.</p>" : "") +
      "<details><summary>Ver tabla</summary>" + tabla + "</details>" +
      '<p class="fuente">La Ad Library no acepta rango de fechas: es una foto del día ' +
      "de la corrida, no una serie.</p></div>";
  }

  function hallazgos() {
    var h = D.hallazgos || [];
    if (!h.length) return "";
    var orden = { oportunidad: 0, riesgo: 1, observacion: 2 };
    var tarj = h.slice().sort(function (a, b) {
      return (orden[a.tipo] || 9) - (orden[b.tipo] || 9);
    }).map(function (x) {
      var ev = (x.evidencia || []).map(function (e) {
        return esc(e.dato) + ": " + esc(e.valor);
      }).join("<br>");
      return '<article class="hallazgo ' + esc(x.tipo) + '">' +
        '<div class="tipo">' + esc(x.tipo) + "</div>" +
        "<h3>" + esc(x.titulo) + "</h3>" +
        "<p>" + esc(x.afirmacion) + "</p>" +
        (x.calculo ? '<div class="calc">' + esc(x.calculo) + "</div>" : "") +
        (ev ? '<div class="ev">' + ev + "</div>" : "") +
        (x.advertencia ? '<p class="adv">' + esc(x.advertencia) + "</p>" : "") +
        "</article>";
    });
    return '<section><div class="tituloSeccion"><h2>Evidencia</h2></div>' +
      '<p class="subtitulo">Lo que sostiene las tareas de arriba. Cada hallazgo cita ' +
      'su dato de origen.</p><div class="hallazgos">' + tarj.join("") + "</div></section>";
  }

  function cuerpo() {
    var c = D.corrida || {};
    var v = D.verificacion_semana_anterior || "";
    return '<div class="envoltura">' +
      (soloLectura ? '<div class="aviso-lectura">Estás viendo esta página en modo ' +
        "lectura. Puedes revisar todo, pero las aprobaciones las registra quien tiene " +
        "permiso de escritura.</div>" : "") +
      '<header class="cabecera"><div><h1>Mesa Creativa</h1>' +
      "<p>Base estratégica de la reunión creativa</p></div>" +
      '<div class="periodo">' + esc(c.rango || "") + "</div></header>" +
      banda() + avisoHuecos() + zonaDecision() +
      '<section><div class="tituloSeccion"><h2>Cómo llegamos ahí</h2></div>' +
      '<p class="subtitulo">' + esc(v) + '</p>' +
      '<div class="dos">' + graficoCosto() + graficoPresion() + "</div></section>" +
      hallazgos() +
      '<footer class="pie">Cada cifra de esta página es trazable hasta la consulta ' +
      "que la produjo. Las respuestas crudas quedan guardadas sin editar en " +
      "<code>data/historico/</code> junto a la corrida.</footer></div>";
  }

  function pintar() {
    document.body.innerHTML = cuerpo();
    document.querySelectorAll(".palanca").forEach(function (b) {
      b.addEventListener("click", function () { alternar(b.dataset.clave); });
    });
  }

  /* ───────────────── publicar ───────────────── */

  function documento() {
    var j = function (o) {
      return JSON.stringify(o).replace(/<\/script/gi, "<\\/script");
    };
    return "<!doctype html>\n<html lang=\"es\">\n<head>\n" + P.head +
      "\n</head>\n<body>\n" +
      '<script id="datos" type="application/json">' + j(D) + "<\/script>\n" +
      '<script id="estado" type="application/json">' + j(E) + "<\/script>\n" +
      '<script id="plantilla" type="application/json">' + j(P) + "<\/script>\n" +
      "<script>" + P.app + "<\/script>\n</body>\n</html>";
  }

  function alternar(clave) {
    if (!clave || soloLectura) return;
    if (E.aprobadas[clave]) delete E.aprobadas[clave];
    else E.aprobadas[clave] = { en: new Date().toISOString() };
    E.version = (E.version || 1) + 1;
    pintar();
    if (!api) return;
    api.publish(documento()).catch(function (err) {
      var c = err && err.code;
      if (c === "conflict") return;                       // la recarga trae la verdad
      if (c === "not_writer" || c === "not_granted" ||
          c === "not_declared" || c === "consent_required" ||
          c === "capability_disabled" || c === "capability_removed") {
        soloLectura = true; api = null; pintar(); return;
      }
      console.warn("no se pudo registrar la aprobación:", c);
    });
  }

  pintar();

  // Gancho de diagnóstico: permite verificar en pruebas que la página puede
  // reconstruirse a sí misma sin romperse. Solo lee, nunca muta.
  try {
    Object.defineProperty(window, "__tablero", {
      value: Object.freeze({ documento: documento, tareas: (D.tareas_propuestas || []).length }),
      writable: false, configurable: false, enumerable: false
    });
  } catch (e) { /* entorno que no lo permite: la página funciona igual */ }

  if (window.claude && typeof window.claude.use === "function") {
    window.claude.use("artifact").then(function (a) {
      if (!a) { soloLectura = true; pintar(); return; }
      api = a;
    }).catch(function () { soloLectura = true; pintar(); });
  } else {
    soloLectura = true; pintar();
  }
})();
