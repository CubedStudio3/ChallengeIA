/* Tablero semanal · lógica de cliente.
   Cinco secciones: Resumen, Rendimiento, Competencia, Referencias, Estrategia.

   Nota de arquitectura: el ARCHIVO que se publica es un fragmento (sin doctype,
   html, head ni body) porque el visor lo envuelve en su propio esqueleto. Pero
   documento(), que usa la auto-publicación, sí devuelve un documento COMPLETO,
   que es lo que exige la capability. Son dos contratos distintos y hay que
   respetar cada uno.

   Y una distinción que gobierna el estado: las DECISIONES (aceptar, rechazar,
   asignar) son compartidas y se publican como versión nueva de la página. Los
   FILTROS (qué mercado, qué grupo de competencia) son de quien mira, viven en
   localStorage y nunca se publican. Publicar un filtro repintaría la página de
   los demás cada vez que alguien cambia de pestaña. */
(function () {
  "use strict";

  var leer = function (id) {
    var n = document.getElementById(id);
    try { return n ? JSON.parse(n.textContent) : null; } catch (e) { return null; }
  };
  var D = leer("datos") || {};
  var E = leer("estado") || { aprobadas: {}, decisiones: {}, version: 1 };
  var P = leer("plantilla") || { head: "", app: "", estilos: "" };
  if (!E.aprobadas) E.aprobadas = {};
  if (!E.decisiones) E.decisiones = {};

  var soloLectura = false, api = null, temaManual = null;

  /* Vista local. Nunca se publica. */
  var V = { mercado: null, grupo: "competencia", categoria: "software" };
  try {
    var g = localStorage.getItem("mc.vista");
    if (g) { var o = JSON.parse(g); for (var k in o) if (k in V) V[k] = o[k]; }
  } catch (e) { /* almacenamiento bloqueado: se usa el valor por defecto */ }
  function guardarVista() {
    try { localStorage.setItem("mc.vista", JSON.stringify(V)); } catch (e) {}
  }

  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var dinero = function (n) {
    if (n == null) return "—";
    return "$" + Number(n).toLocaleString("en-US",
      { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  var ent = function (n) {
    if (n == null) return "—";
    return Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
  };
  var pct = function (n) { return n == null ? "—" : Math.round(n * 100) + "%"; };

  /* Capa de lenguaje llano: nadie debería necesitar saber qué es actions:lead. */
  function enClaro(ind) {
    if (!ind) return "sin indicador";
    if (/QualifiedLead/i.test(ind)) return "Leads calificados";
    if (/complete_registration/i.test(ind)) return "Registros completados";
    if (/link_click/i.test(ind)) return "Clics en el enlace";
    if (/:lead$/i.test(ind)) return "Leads";
    if (ind === "mixed") return "Mezclado";
    return ind.replace(/^actions:/, "");
  }
  var RED = {
    facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok",
    youtube: "YouTube", linkedin: "LinkedIn"
  };

  var SECCIONES = [
    { id: "resumen", n: "Resumen" },
    { id: "rendimiento", n: "Rendimiento" },
    { id: "competencia", n: "Competencia" },
    { id: "referencias", n: "Referencias" },
    { id: "estrategia", n: "Estrategia" }
  ];
  var ico = {
    tic: '<svg viewBox="0 0 24 24"><path d="M4 12.5 9 17.5 20 6.5"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    tema: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20h2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/></svg>',
    copiar: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg>',
    link: '<svg viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 6 .5l3-3a4 4 0 0 0-6-6l-1.5 1.5"/><path d="M14 10a4 4 0 0 0-6-.5l-3 3a4 4 0 0 0 6 6L12.5 17"/></svg>'
  };

  /* ═════════════ utilidades de datos ═════════════ */

  function mercados() { return Object.keys(D.por_mercado || {}).sort(); }
  function mercadoActivo() {
    var ms = mercados();
    if (!ms.length) return null;
    return ms.indexOf(V.mercado) >= 0 ? V.mercado : ms[0];
  }
  function leadTotal() {
    return (D.consolidados_detalle || {})["actions:lead"] || null;
  }
  function competidoresDe(mercado) {
    var c = (D.competencia || {})[mercado];
    if (!c) return [];
    return Object.keys(c.detalle || {}).map(function (n) {
      var d = c.detalle[n]; d = Object.assign({}, d); d.nombre = n; d.mercado = mercado;
      return d;
    });
  }
  /* Un competidor puede pautar en un mercado y no en otro. Para la vista de
     marca se juntan sus mediciones de todos los mercados en una sola tarjeta,
     conservando el desglose: decir solo "31 anuncios" escondería que en SV
     tiene cero, que es justamente el hallazgo. */
  function marcas() {
    var por = {};
    mercados().forEach(function (m) {
      competidoresDe(m).forEach(function (c) {
        var e = por[c.nombre] || (por[c.nombre] = {
          nombre: c.nombre, rol: c.rol, categorias: c.categorias,
          page_id: c.page_id, nota: c.nota_estrategica, mercados: {},
          mensajes: [], url: null, moneda: null, muestra: 0, activos: 0, metodo: null
        });
        e.mercados[m] = c;
        if (!e.url && c.url_biblioteca) e.url = c.url_biblioteca;
        if (!e.moneda && c.moneda) e.moneda = c.moneda;
        if (c.mensajes && c.mensajes.length > e.mensajes.length) {
          e.mensajes = c.mensajes; e.mensajesDe = m;
        }
        if (c.anuncios_en_muestra > (e.muestra || 0)) e.muestra = c.anuncios_en_muestra;
        if (c.activos_declarados > (e.activos || 0)) e.activos = c.activos_declarados;
        if (!e.metodo && c.metodo) e.metodo = c.metodo;
        if (c.advertencia_muestra) e.advertencia = c.advertencia_muestra;
      });
    });
    return Object.keys(por).map(function (n) { return por[n]; });
  }
  function sinMedir() {
    var c = D.competencia || {};
    for (var m in c) if (c[m] && c[m].sin_medir) return c[m].sin_medir;
    return [];
  }

  /* ═════════════ armazón ═════════════ */

  function lateral() {
    var c = D.corrida || {};
    var pend = (((D.estrategia || {}).tareas) || []).filter(function (t) {
      return !E.decisiones[t.id];
    }).length;
    return '<aside class="lateral">' +
      '<div class="logo"><div class="g">MC</div><div class="marca-txt">' +
        "<b>Mesa Creativa</b><span>QPayPro · Mercadeo</span></div></div>" +
      '<nav class="nav">' + SECCIONES.map(function (s, i) {
        var b = s.id === "estrategia" && pend ? '<b class="badge">' + pend + "</b>" : "";
        return '<a href="#' + s.id + '"' + (i === 0 ? ' class="on"' : "") +
          ' data-sec="' + s.id + '"><i></i>' + s.n + b + "</a>";
      }).join("") + "</nav>" +
      '<div class="pie">Corrida del<br><b>' + esc(c.rango || "") + "</b></div>" +
      "</aside>";
  }

  function barra() {
    var n = (((D.estrategia || {}).tareas) || []).length;
    return '<div class="barra"><div class="izq"><h1>Reunión creativa</h1>' +
      "<p>Lo que la semana dice, y las " + n +
      " tareas que quedan para decidir en la mesa.</p></div>" +
      '<div class="der">' +
      '<button class="btn chico" type="button" id="bCopiar">' + ico.copiar +
        "Copiar resumen</button>" +
      '<button class="btn chico" type="button" id="bTema" aria-label="Cambiar tema">' +
        ico.tema + "Tema</button>" +
      "</div></div>";
  }

  function kpi(et, val, nota, tono) {
    return '<div class="kpi' + (tono ? " " + tono : "") + '">' +
      '<span class="kpi-et">' + esc(et) + "</span>" +
      '<span class="kpi-v">' + val + "</span>" +
      (nota ? '<span class="kpi-n">' + esc(nota) + "</span>" : "") + "</div>";
  }

  /* ═════════════ 1 · Resumen ═════════════ */

  function tiras() {
    var L = leadTotal(), rs = D.redes_sociales, t = (rs && rs.totales) || {};
    var out = [];
    out.push('<div class="tira"><div class="tira-cab">Meta Ads · ' +
      esc((D.corrida || {}).rango || "") + "</div><div class=\"kpis\">");
    if (L) {
      out.push(kpi("Leads", ent(L.resultados), "indicador actions:lead"));
      out.push(kpi("Inversión", dinero(L.gasto), L.campanas + " campañas con entrega"));
      out.push(kpi("Costo por lead", dinero(L.costo_por_resultado), "promedio del periodo"));
      out.push(kpi("Impresiones", ent(L.impresiones), ""));
    } else {
      out.push('<div class="hueco">No hay datos utilizables de pauta para este periodo.</div>');
    }
    out.push("</div></div>");

    out.push('<div class="tira"><div class="tira-cab">Redes sociales · orgánico</div>' +
      '<div class="kpis">');
    if (rs) {
      out.push(kpi("Interacciones", ent(t.interacciones),
        (t.redes_contadas || []).map(function (r) { return RED[r] || r; }).join(", ")));
      out.push(kpi("Publicaciones", ent(t.publicaciones), "en el periodo"));
      out.push(t.vistas != null
        ? kpi("Vistas de video", ent(t.vistas), "solo TikTok y YouTube las reportan")
        : kpi("Vistas de video", "—", "ninguna red las reporta"));
      out.push(kpi("Alcance", "no disponible",
        "ninguna red lo devuelve por este conector", "tono-falta"));
    } else {
      out.push('<div class="hueco">No hay captura de redes para este periodo.</div>');
    }
    out.push("</div></div>");
    return '<div class="tiras">' + out.join("") + "</div>";
  }

  function tarjetaResumen(titulo, et, cuerpoHtml, ancla) {
    return '<article class="rcard"><div class="rcard-et">' + esc(et) + "</div>" +
      "<h3>" + esc(titulo) + "</h3>" + cuerpoHtml +
      '<a class="rcard-ir" href="#' + ancla + '">Ver el detalle →</a></article>';
  }

  function resumen() {
    var L = leadTotal(), pm = D.por_mercado || {};
    var filas = mercados().map(function (m) {
      var p = (pm[m] || {}).principal;
      return '<li><b>' + esc(m) + "</b> · " +
        (p ? ent(p.resultados) + " leads a " + dinero(p.costo_por_resultado)
           : "sin datos utilizables") + "</li>";
    }).join("");
    var c1 = "<p>" + (L
      ? "La pauta trajo <b>" + ent(L.resultados) + " leads</b> con " +
        dinero(L.gasto) + " de inversión, a " + dinero(L.costo_por_resultado) +
        " cada uno."
      : "No hay datos de pauta utilizables.") + "</p><ul class=\"mini\">" + filas + "</ul>";

    var comp = [], terr = ((D.referencias || {}).territorios) || {};
    (terr.saturados || []).forEach(function (s) {
      comp.push("<li><b>" + esc(s.de) + "</b> ocupa «" + esc(s.mensaje) +
        "» en " + pct(s.cuota) + " de sus anuncios en " + esc(s.mercado) + ".</li>");
    });
    (terr.libres || []).forEach(function (l) {
      comp.push("<li><b>" + esc(l.mercado) +
        "</b> no tiene competencia medida en pauta.</li>");
    });
    var sm = sinMedir();
    if (sm.length) {
      comp.push('<li class="ojo">' + sm.map(function (x) { return esc(x.nombre); })
        .join(", ") + (sm.length === 1 ? " no se midió" : " no se midieron") +
        ": falta su page_id.</li>");
    }
    var c2 = '<ul class="mini">' + (comp.join("") ||
      "<li>Sin patrones de competencia en esta corrida.</li>") + "</ul>";

    var est = D.estrategia || {}, ts = est.tareas || [];
    var cre = ts.filter(function (t) { return t.tipo !== "pauta"; }).length;
    var pau = ts.length - cre;
    var dec = Object.keys(E.decisiones).length;
    var c3 = "<p>El análisis propone <b>" + ts.length + " tareas</b>: " + cre +
      " de producción creativa y " + pau + " de configuración de pauta.</p>" +
      '<div class="prog"><div class="prog-b" style="width:' +
      (ts.length ? Math.round(dec / ts.length * 100) : 0) + '%"></div></div>' +
      '<p class="aclara">' + dec + " de " + ts.length +
      " ya tienen decisión de la mesa.</p>";

    return '<section id="resumen">' + tiras() +
      '<div class="grid3 rcards">' +
      tarjetaResumen("Rendimiento propio", "Meta Ads y leads", c1, "rendimiento") +
      tarjetaResumen("Qué hace la competencia", "Ad Library", c2, "competencia") +
      tarjetaResumen("La estrategia que se propone", "Para decidir", c3, "estrategia") +
      "</div></section>";
  }

  /* ═════════════ 2 · Rendimiento ═════════════ */

  function segmentado(id, opciones, activo) {
    return '<div class="seg" role="tablist">' + opciones.map(function (o) {
      return '<button type="button" role="tab" class="seg-b' +
        (o.v === activo ? " on" : "") + '" data-' + id + '="' + esc(o.v) +
        '" aria-selected="' + (o.v === activo) + '">' + esc(o.n) + "</button>";
    }).join("") + "</div>";
  }

  function tablaCampanas(m) {
    var d = (D.por_mercado || {})[m] || {};
    var cs = d.campanas || [];
    if (!cs.length) return '<div class="hueco">Sin campañas con entrega en ' +
      esc(m) + " en este periodo.</div>";
    return '<div class="tabla-wrap"><table class="tabla"><thead><tr>' +
      "<th>Campaña</th><th>Se mide por</th><th class=\"n\">Resultados</th>" +
      "<th class=\"n\">Inversión</th><th class=\"n\">Costo por resultado</th>" +
      "<th class=\"n\">Impresiones</th></tr></thead><tbody>" +
      cs.map(function (c) {
        return "<tr><td>" + esc(c.etiqueta) + "</td>" +
          '<td><span class="chip">' + esc(enClaro(c.indicador)) + "</span></td>" +
          '<td class="n">' + ent(c.resultados) + "</td>" +
          '<td class="n">' + dinero(c.gasto) + "</td>" +
          '<td class="n"><b>' + dinero(c.costo_por_resultado) + "</b></td>" +
          '<td class="n">' + ent(c.impresiones) + "</td></tr>";
      }).join("") + "</tbody></table></div>" +
      '<p class="aclara">Las campañas se muestran juntas pero <b>no se suman entre ' +
      "indicadores distintos</b>: 105 leads y 10,771 clics no son la misma cosa. " +
      "El total de arriba es solo del indicador principal.</p>";
  }

  function bloqueRedes() {
    var rs = D.redes_sociales;
    if (!rs) return '<div class="hueco">No hay captura de redes para este periodo.</div>';
    var det = rs.detalle || {};
    var tarjetas = Object.keys(det).sort().map(function (n) {
      var r = det[n];
      var cuerpo;
      if (!r.confiable) {
        cuerpo = '<div class="no-fiable"><b>Dato no verificable.</b> ' +
          esc(r.motivo_no_confiable) + "</div>";
      } else if (r.silenciosa) {
        cuerpo = '<div class="silencio"><b>' + r.dias_de_silencio +
          " días sin publicar.</b><br>Última publicación: " +
          esc(r.ultima_publicacion) + "</div>";
      } else {
        cuerpo = '<div class="kpis chicos">' +
          kpi("Publicaciones", ent(r.publicaciones), "") +
          kpi("Interacciones", ent(r.interacciones), "") +
          (r.vistas != null ? kpi("Vistas", ent(r.vistas), "") : "") + "</div>" +
          (r.mejores && r.mejores.length
            ? '<div class="mejor"><span class="mini-et">Lo que más rindió</span>' +
              r.mejores.map(function (m) {
                var marca = m.vistas != null ? ent(m.vistas) + " vistas"
                  : ent(m.interacciones) + " interacciones";
                return '<div class="mejor-f"><span>' +
                  esc(m.titulo || "(sin texto)") + '</span><b>' + marca + "</b></div>";
              }).join("") + "</div>"
            : "");
      }
      return '<article class="panel red' + (r.confiable ? "" : " atenuado") + '">' +
        "<h3>" + esc(RED[n] || n) + "</h3>" + cuerpo + "</article>";
    }).join("");

    var lims = (rs.limites || []).map(function (l) {
      return "<li><b>" + esc(l.que) + " · " + esc(l.estado) + ".</b> " +
        esc(l.detalle) + "</li>";
    }).join("");

    return '<div class="grid3">' + tarjetas + "</div>" +
      '<div class="panel aviso"><h3>Lo que este bloque no puede decir</h3>' +
      '<ul class="mini">' + lims + "</ul></div>";
  }

  function rendimiento() {
    var m = mercadoActivo();
    var ms = mercados();
    if (!m) return '<section id="rendimiento"><div class="cab"><h2>Rendimiento</h2>' +
      '</div><div class="hueco">Sin datos por mercado en esta corrida.</div></section>';
    var d = (D.por_mercado || {})[m] || {};
    var p = d.principal;
    var kpis = p
      ? '<div class="panel kpis-panel"><div class="kpis">' +
        kpi("Leads", ent(p.resultados), enClaro(d.indicador_principal)) +
        kpi("Inversión", dinero(p.gasto), "") +
        kpi("Costo por lead", dinero(p.costo_por_resultado), "") +
        kpi("Campañas con entrega", ent(p.campanas), "no es lo mismo que activas hoy") +
        kpi("Impresiones", ent(p.impresiones), "") + "</div></div>"
      : '<div class="hueco">Sin datos utilizables de ' +
        esc(enClaro(d.indicador_principal)) + " en " + esc(m) + ".</div>";

    return '<section id="rendimiento"><div class="cab"><h2>Rendimiento</h2>' +
      segmentado("mercado", ms.map(function (x) {
        return { v: x, n: x === "GT" ? "Guatemala" : x === "SV" ? "El Salvador" : x };
      }), m) + "</div>" +
      '<p class="sub">Pauta de Meta Ads en <b>' + esc(m) + "</b>, del periodo " +
      esc((D.corrida || {}).rango || "") + ".</p>" +
      kpis + tablaCampanas(m) +
      '<p class="aclara">' + esc(d._nota_activas || "") + "</p>" +
      '<div class="cab sub-cab"><h2>Redes sociales</h2></div>' +
      '<p class="sub">Orgánico de las cinco cuentas conectadas. <b>No hay corte por ' +
      "país</b>: el portal tiene una sola marca y GT y SV comparten cuenta, así que " +
      "repartir estas interacciones entre los dos mercados sería inventarlo.</p>" +
      bloqueRedes() + "</section>";
  }

  /* ═════════════ 3 · Competencia ═════════════ */

  function tarjetaMarca(b) {
    var ms = Object.keys(b.mercados).sort();
    var presion = ms.map(function (m) {
      var c = b.mercados[m];
      return '<div class="pres"><span>' + esc(m) + "</span><b>" +
        ent(c.presion_real) + "</b><i>anuncios que disputan</i>" +
        (c.activos_declarados !== c.presion_real
          ? '<u title="Anuncios activos totales de la página">de ' +
            ent(c.activos_declarados) + " activos</u>" : "") + "</div>";
    }).join("");

    var mensajes = (b.mensajes || []).length
      ? '<div class="mensajes"><span class="mini-et">Sus mensajes, por lo que ' +
        'repite y por lo que no mata</span>' +
        b.mensajes.map(function (m) {
          return '<div class="msg"><div class="msg-t">' + esc(m.titular) + "</div>" +
            '<div class="msg-d"><span><b>' + m.repeticiones +
            "</b> anuncios · " + pct(m.cuota) + " de su inventario</span>" +
            "<span><b>" + m.dias_vivo + "</b> días vivo · último hace " +
            m.dias_desde_el_ultimo + " d</span></div></div>";
        }).join("") +
        '<p class="aclara"><b>No es un ranking de efectividad.</b> La Ad Library no ' +
        "publica rendimiento de anunciantes comerciales: no hay impresiones, ni " +
        "gasto, ni conversiones. Lo que sí se ve es en qué apuestan — cuánto " +
        "repiten un mensaje y cuánto tiempo lo dejan vivo.</p></div>"
      : (!b.activos
        ? '<div class="hueco chico"><b>No tiene anuncios activos</b> en los mercados ' +
          "que medimos, así que no hay mensaje que leer. Eso no dice nada de lo que " +
          "anuncia fuera de aquí." + "</div>"
        : !b.muestra
        ? '<div class="hueco chico"><b>No se guardó muestra de sus anuncios.</b> ' +
          "De esta marca solo se midió cuántos de sus anuncios tocan nuestra " +
          "categoría, sobre su inventario completo. No se leyeron titulares, así " +
          "que no se puede decir qué mensaje repite." +
          (b.metodo ? '<div class="metodo">Método: ' + esc(b.metodo) + "</div>" : "") +
          "</div>"
        : '<div class="hueco chico">Se leyeron ' + b.muestra + " de sus anuncios y " +
          "ninguno trae un titular legible: son plantillas dinámicas sin renderizar " +
          "o anuncios sin titular.</div>");

    var extra = [];
    ms.forEach(function (m) {
      var c = b.mercados[m];
      if (c.lanzados_10d > 0) {
        extra.push("<li>" + esc(m) + ": <b>" + c.lanzados_10d +
          "</b> anuncios lanzados en los últimos 10 días" +
          (c.lanzados_3d ? " (" + c.lanzados_3d + " en los últimos 3)" : "") + ".</li>");
      }
      if (c.plantillas_sin_renderizar > 0) {
        extra.push("<li>" + esc(m) + ": <b>" + c.plantillas_sin_renderizar +
          "</b> anuncios muestran una plantilla dinámica sin renderizar " +
          "(<code>{{…}}</code>). Puede ser normal o un error suyo de " +
          "configuración; requiere revisión humana.</li>");
      }
    });

    return '<article class="panel marca">' +
      '<div class="marca-cab"><h3>' + esc(b.nombre) + "</h3>" +
      '<div class="tags">' + (b.categorias || []).map(function (c) {
        return '<span class="chip">' + esc(c === "hardware" ? "punto de venta" : c) +
          "</span>";
      }).join("") + (b.moneda ? '<span class="chip">' + esc(b.moneda) + "</span>" : "") +
      "</div></div>" +
      '<div class="presiones">' + presion + "</div>" +
      (b.nota ? '<p class="nota">' + esc(b.nota) + "</p>" : "") +
      mensajes +
      (extra.length ? '<ul class="mini">' + extra.join("") + "</ul>" : "") +
      (b.advertencia ? '<p class="adv">⚠ ' + esc(b.advertencia) + "</p>" : "") +
      (b.url ? '<a class="ext" href="' + esc(b.url) + '" target="_blank" ' +
        'rel="noopener noreferrer">' + ico.link +
        "Ver sus anuncios reales en la Ad Library</a>" : "") +
      "</article>";
  }

  function competencia() {
    var todas = marcas();
    var comp = todas.filter(function (b) { return b.rol === "competidor"; });
    var refs = todas.filter(function (b) { return b.rol === "referente"; });
    var sm = sinMedir();

    var lista, sub = "", explica;
    if (V.grupo === "referentes") {
      lista = refs;
      explica = "Marcas que <b>no disputan</b> nuestros mercados. Se miran para " +
        "aprender, no se cuentan como amenaza.";
    } else {
      var cat = V.categoria;
      lista = comp.filter(function (b) {
        return (b.categorias || []).indexOf(cat) >= 0;
      });
      sub = segmentado("categoria", [
        { v: "software", n: "Software" },
        { v: "hardware", n: "Punto de venta" }
      ], cat);
      explica = "Marcas que pautan en nuestros mercados y disputan nuestro espacio " +
        "de mensaje o de público.";
    }

    var faltantes = sm.filter(function (x) {
      return V.grupo === "referentes" ? x.rol === "referente" : x.rol === "competidor";
    });

    var avisosFalt = faltantes.map(function (x) {
      return '<article class="panel falta-marca"><h3>' + esc(x.nombre) + "</h3>" +
        '<div class="badge-falta">' + esc(x.estado) + "</div>" +
        "<p><b>No se midió.</b> Que no aparezca aquí no significa que no anuncie: " +
        "significa que no lo pudimos preguntar.</p>" +
        (x.por_que_falta ? '<p class="aclara">' + esc(x.por_que_falta) + "</p>" : "") +
        (x.como_obtenerlo ? '<p class="remedio"><b>Cómo desbloquearlo:</b> ' +
          esc(x.como_obtenerlo) + "</p>" : "") +
        "</article>";
    }).join("");

    var cuerpoL = lista.length || avisosFalt
      ? '<div class="grid2">' + lista.map(tarjetaMarca).join("") + avisosFalt + "</div>"
      : '<div class="hueco">Ninguna marca medida en esta categoría.</div>';

    return '<section id="competencia"><div class="cab"><h2>Competencia</h2>' +
      segmentado("grupo", [
        { v: "competencia", n: "Competencia" },
        { v: "referentes", n: "Referentes" }
      ], V.grupo) + "</div>" +
      '<p class="sub">' + explica + "</p>" +
      (sub ? '<div class="sub-seg">' + sub + "</div>" : "") +
      cuerpoL +
      '<div class="panel aviso"><h3>Cómo leer estos números</h3><ul class="mini">' +
      "<li><b>Es una foto, no una serie.</b> La Ad Library no acepta rango de " +
      "fechas: solo responde qué está activo ahora. Por eso una corrida " +
      "retroactiva no puede incluir competencia.</li>" +
      "<li><b>Volumen no es presión.</b> Banco Industrial tiene 845 anuncios " +
      "activos en GT y solo 2 tocan pagos. Sumar los 845 inflaría la presión " +
      "competitiva 21 veces.</li>" +
      "<li><b>Solo se midieron las marcas del registro.</b> Un competidor que " +
      "nadie agregó no aparece, y su ausencia aquí no es evidencia de nada.</li>" +
      "</ul></div></section>";
  }

  /* ═════════════ 4 · Referencias ═════════════ */

  function referencias() {
    var R = D.referencias;
    if (!R) return '<section id="referencias"><div class="cab"><h2>Referencias</h2>' +
      "</div><div class=\"hueco\">Sin datos de referencias en esta corrida.</div></section>";

    var filas = (R.contraste || []).map(function (f) {
      return "<tr><td><b>" + esc(f.dimension) + "</b></td><td>" + esc(f.qpaypro) +
        "</td><td>" + esc(f.competencia) + "</td><td>" + esc(f.referentes) +
        '</td></tr><tr class="lectura-f"><td colspan="4">' + esc(f.lectura) +
        "</td></tr>";
    }).join("");

    var t = R.territorios || {};
    var terr = "";
    if ((t.saturados || []).length || (t.libres || []).length) {
      terr = '<div class="grid2">' +
        (t.saturados || []).map(function (s) {
          return '<article class="panel terr ocupado"><div class="terr-et">' +
            "Territorio ocupado</div><h3>«" + esc(s.mensaje) + "»</h3>" +
            "<p>" + esc(s.lectura) + "</p>" +
            '<p class="aclara">' + esc(s.de) + " · " + esc(s.mercado) + " · " +
            s.repeticiones + " anuncios · " + s.dias_vivo + " días vivo</p></article>";
        }).join("") +
        (t.libres || []).map(function (l) {
          return '<article class="panel terr libre"><div class="terr-et">' +
            "Territorio sin disputa</div><h3>" + esc(l.mercado) + "</h3>" +
            "<p>" + esc(l.lectura) + "</p></article>";
        }).join("") + "</div>";
    }

    var bus = (R.busquedas || []).map(function (b) {
      return '<article class="panel busq"><div class="busq-cab">' +
        '<span class="chip">' + esc(b.formato) + "</span>" +
        '<span class="chip gris">búsqueda sin curar</span></div>' +
        "<h3>" + esc(b.tema) + "</h3>" +
        '<p class="aclara">' + esc(b.motivo) + "</p>" +
        '<div class="consulta">' + esc(b.consulta) + "</div>" +
        '<a class="ext" href="' + esc(b.url) + '" target="_blank" ' +
        'rel="noopener noreferrer">' + ico.link + "Abrir la búsqueda en Pinterest</a>" +
        "</article>";
    }).join("");

    var lims = (R.limites || []).map(function (l) {
      return "<li><b>" + esc(l.que) + " · " + esc(l.estado) + ".</b> " +
        esc(l.detalle) + (l.remedio ? " <i>" + esc(l.remedio) + "</i>" : "") + "</li>";
    }).join("");

    return '<section id="referencias"><div class="cab"><h2>Referencias</h2></div>' +
      '<p class="sub">Lo nuestro contra lo de ellos, y de ahí adónde ir a buscar ' +
      "cómo se ve.</p>" +
      '<div class="tabla-wrap"><table class="tabla contraste"><thead><tr>' +
      "<th>Dimensión</th><th>QPayPro</th><th>Competencia</th><th>Referentes</th>" +
      "</tr></thead><tbody>" + filas + "</tbody></table></div>" +
      (terr ? '<div class="cab sub-cab"><h2>Territorios de mensaje</h2></div>' + terr : "") +
      '<div class="cab sub-cab"><h2>Dónde buscar referencia visual</h2></div>' +
      '<p class="sub">Cada búsqueda sale de un dato de arriba. <b>Ningún pin fue ' +
      "visto ni verificado por el sistema</b>: son búsquedas, no referencias " +
      "curadas. Quien las abre elige.</p>" +
      (bus ? '<div class="grid3">' + bus + "</div>"
           : '<div class="hueco">Sin búsquedas que proponer en esta corrida.</div>') +
      '<div class="panel aviso"><h3>Lo que esta sección no puede dar</h3>' +
      '<ul class="mini">' + lims + "</ul></div></section>";
  }

  /* ═════════════ 5 · Estrategia ═════════════ */

  function selectorResponsable(t, asig) {
    var d = E.decisiones[t.id] || {};
    if (!asig.habilitada) {
      return '<div class="asig bloq"><span class="mini-et">Responsable</span>' +
        '<select disabled><option>Sin lista de personas</option></select>' +
        '<p class="aclara">' + esc(asig.motivo_bloqueo || "") + "</p></div>";
    }
    var ops = ['<option value="">Sin asignar</option>'].concat(
      (asig.personas || []).map(function (p) {
        return '<option value="' + esc(p.id_sprint) + '"' +
          (d.responsable === p.id_sprint ? " selected" : "") + ">" +
          esc(p.nombre) + (p.rol ? " · " + esc(p.rol) : "") + "</option>";
      }));
    return '<div class="asig"><span class="mini-et">Responsable</span>' +
      '<select data-asignar="' + esc(t.id) + '"' + (soloLectura ? " disabled" : "") +
      ">" + ops.join("") + "</select></div>";
  }

  function tarjetaTarea(t, asig) {
    var d = E.decisiones[t.id];
    var estado = d ? d.estado : null;
    var refs = (t.referencias || []).map(function (r) {
      return '<a class="ref-mini" href="' + esc(r.url) + '" target="_blank" ' +
        'rel="noopener noreferrer">' + esc(r.tema) + "</a>";
    }).join("");

    return '<article class="tarea' + (estado ? " " + estado : "") + '">' +
      '<div class="tarea-cab"><span class="chip ' + esc(t.tipo) + '">' +
        esc(t.tipo === "pauta" ? "cambio en pauta" : t.tipo) + "</span>" +
        (t.requiere_humano ? '<span class="chip alerta">la aplica una persona</span>' : "") +
        (estado ? '<span class="sello ' + esc(estado) + '">' +
          (estado === "aceptada" ? "Aceptada" : "Rechazada") + "</span>" : "") +
      "</div>" +
      "<h3>" + esc(t.titulo) + "</h3>" +
      '<p class="porque">' + esc(t.porque) + "</p>" +
      (t.angulo ? '<div class="campo"><span class="mini-et">Ángulo</span><p>' +
        esc(t.angulo) + "</p></div>" : "") +
      (t.no_decir ? '<div class="campo no-decir"><span class="mini-et">No decir</span>' +
        "<p>«" + esc(t.no_decir) + "» — ese terreno ya lo paga la competencia.</p>" +
        "</div>" : "") +
      (t.instruccion_exacta
        ? '<div class="campo instruccion"><span class="mini-et">Instrucción exacta ' +
          'para quien la aplique</span><p>' + esc(t.instruccion_exacta) + "</p></div>"
        : "") +
      (t.tipo !== "pauta"
        ? '<div class="campo"><span class="mini-et">Cuántas piezas</span><p>' +
          (t.piezas != null ? "<b>" + t.piezas + "</b> · " + esc(t.piezas_motivo)
            : "<b>Lo decide la mesa.</b> " + esc(t.piezas_motivo)) + "</p></div>"
        : "") +
      (t.copy ? '<div class="campo copy-bloq"><span class="mini-et">Copy</span>' +
        "<p><b>" + esc(t.copy.estado) + ".</b> " + esc(t.copy.motivo) + "</p>" +
        '<details><summary>Qué falta para desbloquearlo</summary><ul class="mini">' +
        (t.copy.falta || []).map(function (f) { return "<li>" + esc(f) + "</li>"; })
          .join("") + "</ul><p class=\"aclara\">Se llena en <code>" +
        esc(t.copy.donde) + "</code></p></details></div>" : "") +
      (refs ? '<div class="campo"><span class="mini-et">Referencia visual</span>' +
        '<div class="refs">' + refs + "</div></div>" : "") +
      '<details class="ev"><summary>Evidencia (' + (t.evidencia || []).length +
        ")</summary><ul class=\"mini\">" +
        (t.evidencia || []).map(function (e) { return "<li>" + esc(e) + "</li>"; })
          .join("") + "</ul></details>" +
      '<div class="tarea-pie">' +
        '<div class="acciones">' +
        '<button type="button" class="btn ok' + (estado === "aceptada" ? " on" : "") +
          '" data-decidir="' + esc(t.id) + '" data-estado="aceptada"' +
          (soloLectura ? " disabled" : "") + ">" + ico.tic + "Aceptar</button>" +
        '<button type="button" class="btn no' + (estado === "rechazada" ? " on" : "") +
          '" data-decidir="' + esc(t.id) + '" data-estado="rechazada"' +
          (soloLectura ? " disabled" : "") + ">" + ico.x + "Rechazar</button>" +
        "</div>" +
        (estado === "aceptada" ? selectorResponsable(t, asig) : "") +
      "</div></article>";
  }

  function estrategia() {
    var est = D.estrategia;
    if (!est) return '<section id="estrategia"><div class="cab"><h2>Estrategia</h2>' +
      "</div><div class=\"hueco\">Sin propuesta de estrategia en esta corrida.</div></section>";
    var asig = est.asignacion || {};
    var ts = est.tareas || [];
    var creativas = ts.filter(function (t) { return t.tipo !== "pauta"; });
    var pauta = ts.filter(function (t) { return t.tipo === "pauta"; });

    var lims = (est.limites || []).map(function (l) {
      return "<li><b>" + esc(l.que) + " · " + esc(l.estado) + ".</b> " +
        esc(l.detalle) + (l.remedio ? " <i>" + esc(l.remedio) + "</i>" : "") + "</li>";
    }).join("");

    var flujo = '<div class="panel flujo"><h3>Qué pasa cuando aceptas una tarea</h3>' +
      "<p>" + esc(asig._flujo || "") + "</p>" +
      (!asig.habilitada
        ? '<div class="bloqueo"><b>La asignación a Sprint está apagada.</b>' +
          "<p>" + esc(asig.motivo_bloqueo || "") + "</p>" +
          (asig._como_desbloquear
            ? '<ol class="mini">' + asig._como_desbloquear.map(function (p) {
                return "<li>" + esc(p) + "</li>"; }).join("") + "</ol>" : "") +
          "</div>"
        : "") + "</div>";

    return '<section id="estrategia"><div class="cab"><h2>Estrategia</h2>' +
      '<div class="acciones-masa">' +
      '<button type="button" class="btn chico pri" id="bTodas">Aceptar todas</button>' +
      '<button type="button" class="btn chico" id="bNada">Limpiar decisiones</button>' +
      "</div></div>" +
      '<p class="sub">Cada tarea sale de un dato medido y trae la evidencia que la ' +
      "sostiene. Aceptar o rechazar es decisión de la mesa; el sistema no la toma.</p>" +
      flujo +
      '<div class="cab sub-cab"><h2>Producción creativa · ' + creativas.length +
      "</h2></div>" +
      '<div class="grid2 tareas">' + creativas.map(function (t) {
        return tarjetaTarea(t, asig); }).join("") + "</div>" +
      (pauta.length
        ? '<div class="cab sub-cab"><h2>Cambios en Meta Ads · ' + pauta.length +
          "</h2></div>" +
          '<p class="sub"><b>El sistema no ejecuta ninguno.</b> Meta Ads es de solo ' +
          "lectura por decisión explícita, así que cada cambio sale escrito para que " +
          "una persona lo aplique a mano.</p>" +
          '<div class="grid2 tareas">' + pauta.map(function (t) {
            return tarjetaTarea(t, asig); }).join("") + "</div>"
        : "") +
      '<div class="panel aviso"><h3>Los límites de esta sección</h3>' +
      '<ul class="mini">' + lims + "</ul></div></section>";
  }

  /* ═════════════ armado ═════════════ */

  function huecos() {
    var h = D.huecos_declarados || [];
    if (!h.length) return "";
    return '<div class="panel aviso"><h3>Lo que esta corrida no incluye</h3>' +
      '<ul class="mini">' + h.map(function (x) {
        return "<li><b>" + esc(x.fuente) + ":</b> " + esc(x.descripcion) + " " +
          esc(x.impacto) + "</li>";
      }).join("") + "</ul></div>";
  }

  function cuerpo() {
    return '<div class="app">' + lateral() + '<main class="principal">' +
      (soloLectura ? '<div class="lectura">Estás viendo esta página en <b>modo ' +
        "lectura</b>. Puedes revisar todo; las decisiones las registra quien tiene " +
        "permiso de escritura.</div>" : "") +
      barra() + resumen() + rendimiento() + competencia() + referencias() +
      estrategia() + huecos() +
      '<footer class="pieP">Cada cifra de esta página es trazable hasta la consulta ' +
      "que la produjo. Las respuestas crudas de las APIs quedan guardadas sin editar " +
      "en <code>data/historico/</code> junto a la corrida, para que cualquiera pueda " +
      "verificar de dónde salió un número.</footer>" +
      '</main></div><div class="toast" id="toast" role="status"></div>';
  }

  /* ═════════════ interacción ═════════════ */

  function avisar(txt) {
    var t = document.getElementById("toast");
    if (!t) return;
    t.textContent = txt; t.classList.add("ver");
    clearTimeout(avisar._t);
    avisar._t = setTimeout(function () { t.classList.remove("ver"); }, 2600);
  }

  /* Se renderiza en un contenedor propio, NUNCA reemplazando todo el body.
     Cuando la página se publica como fragmento, el <style> y el <link> de
     fuentes viven dentro del body: hacer body.innerHTML = ... los destruía y
     la página quedaba sin una sola línea de CSS. Pasó, y así no puede volver
     a pasar. */
  function raiz() {
    var r = document.getElementById("raiz");
    if (!r) {
      r = document.createElement("div");
      r.id = "raiz";
      document.body.appendChild(r);
    }
    return r;
  }

  function pintar(anclaje) {
    var y = anclaje ? window.scrollY : null;
    raiz().innerHTML = cuerpo();
    if (temaManual) document.documentElement.setAttribute("data-theme", temaManual);
    conectar();
    if (y != null) window.scrollTo(0, y);
  }

  function conectar() {
    var R = raiz();

    R.querySelectorAll("[data-decidir]").forEach(function (b) {
      b.addEventListener("click", function () {
        decidir(b.dataset.decidir, b.dataset.estado);
      });
    });
    R.querySelectorAll("[data-asignar]").forEach(function (s) {
      s.addEventListener("change", function () {
        asignar(s.dataset.asignar, s.value || null);
      });
    });
    /* Los filtros no publican: solo repintan para quien mira. */
    ["mercado", "grupo", "categoria"].forEach(function (campo) {
      R.querySelectorAll("[data-" + campo + "]").forEach(function (b) {
        b.addEventListener("click", function () {
          V[campo] = b.dataset[campo];
          guardarVista();
          pintar(true);
        });
      });
    });

    var todas = document.getElementById("bTodas");
    if (todas) todas.addEventListener("click", function () {
      var ts = ((D.estrategia || {}).tareas) || [];
      ts.forEach(function (t) {
        if (!E.decisiones[t.id]) {
          E.decisiones[t.id] = { estado: "aceptada", responsable: null,
                                 en: new Date().toISOString() };
        }
      });
      persistir("Todas las tareas quedaron aceptadas");
    });
    var nada = document.getElementById("bNada");
    if (nada) nada.addEventListener("click", function () {
      E.decisiones = {};
      persistir("Decisiones borradas");
    });
    var tema = document.getElementById("bTema");
    if (tema) tema.addEventListener("click", function () {
      var actual = document.documentElement.getAttribute("data-theme");
      var oscuroSis = window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches;
      temaManual = actual ? (actual === "dark" ? "light" : "dark")
        : (oscuroSis ? "light" : "dark");
      document.documentElement.setAttribute("data-theme", temaManual);
    });
    var cop = document.getElementById("bCopiar");
    if (cop) cop.addEventListener("click", copiar);

    var secs = SECCIONES.map(function (s) { return document.getElementById(s.id); })
      .filter(Boolean);
    if (window.IntersectionObserver && secs.length) {
      var obs = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (!e.isIntersecting) return;
          R.querySelectorAll(".nav a").forEach(function (a) {
            a.classList.toggle("on", a.dataset.sec === e.target.id);
          });
        });
      }, { rootMargin: "-15% 0px -70% 0px" });
      secs.forEach(function (s) { obs.observe(s); });
    }
  }

  function decidir(id, estado) {
    if (soloLectura) return;
    var d = E.decisiones[id];
    if (d && d.estado === estado) delete E.decisiones[id];
    else {
      E.decisiones[id] = { estado: estado,
                           responsable: (d && d.responsable) || null,
                           en: new Date().toISOString() };
    }
    persistir();
  }

  function asignar(id, responsable) {
    if (soloLectura) return;
    var d = E.decisiones[id];
    if (!d) return;
    d.responsable = responsable;
    persistir(responsable ? "Responsable asignado" : "Sin asignar");
  }

  function persistir(mensaje) {
    E.version = (E.version || 1) + 1;
    pintar(true);
    if (mensaje) avisar(mensaje);
    if (!api) { if (!mensaje) avisar("Guardado solo en esta vista"); return; }
    api.publish(documento()).catch(function (err) {
      var c = err && err.code;
      if (c === "conflict") return;
      if (c === "not_writer" || c === "not_granted" || c === "not_declared" ||
          c === "consent_required" || c === "capability_disabled" ||
          c === "capability_removed") {
        soloLectura = true; api = null; pintar(true);
        avisar("Esta vista es de solo lectura"); return;
      }
      if (c === "rate_limited") {
        avisar("Demasiados cambios seguidos, espera un momento"); return;
      }
      avisar("No se pudo guardar la decisión");
    });
  }

  function copiar() {
    var c = D.corrida || {}, est = D.estrategia || {};
    var l = ["Mesa Creativa · " + (c.rango || ""), ""];
    var L = leadTotal();
    if (L) {
      l.push("Pauta: " + ent(L.resultados) + " leads · " + dinero(L.gasto) +
        " · " + dinero(L.costo_por_resultado) + " por lead");
    }
    var rs = D.redes_sociales;
    if (rs) {
      l.push("Orgánico: " + ent(rs.totales.interacciones) + " interacciones en " +
        ent(rs.totales.publicaciones) + " publicaciones");
    }
    l.push("");
    (est.tareas || []).forEach(function (t) {
      var d = E.decisiones[t.id];
      var m = d ? (d.estado === "aceptada" ? "[x]" : "[—]") : "[ ]";
      l.push(m + " " + t.titulo);
      l.push("    " + t.porque);
      if (d && d.responsable) l.push("    responsable: " + d.responsable);
    });
    var h = D.huecos_declarados || [];
    if (h.length) {
      l.push("", "No incluye:");
      h.forEach(function (x) { l.push("  - " + x.fuente + ": " + x.descripcion); });
    }
    var txt = l.join("\n");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(
        function () { avisar("Resumen copiado"); },
        function () { avisar("No se pudo copiar"); });
    } else { avisar("No se pudo copiar"); }
  }

  /* documento() DEBE devolver un documento completo: es lo que exige la
     capability de auto-publicación. El archivo original en cambio es un
     fragmento, porque el visor lo envuelve. */
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

  pintar();

  try {
    Object.defineProperty(window, "__tablero", {
      value: Object.freeze({ documento: documento }),
      writable: false, configurable: false, enumerable: false
    });
  } catch (e) { /* entorno que no lo permite: la página funciona igual */ }

  if (window.claude && typeof window.claude.use === "function") {
    window.claude.use("artifact").then(function (a) {
      if (!a) { soloLectura = true; pintar(true); return; }
      api = a;
    }).catch(function () { soloLectura = true; pintar(true); });
  } else { soloLectura = true; pintar(true); }
})();
