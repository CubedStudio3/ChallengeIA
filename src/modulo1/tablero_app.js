/* Tablero semanal · lógica de cliente.
   Renderiza desde los datos embebidos y publica las aprobaciones como una versión
   nueva del propio artefacto, para que el estado se comparta entre quienes abren
   la página.

   Nota de arquitectura: el ARCHIVO que se publica es un fragmento (sin doctype,
   html, head ni body) porque el visor lo envuelve en su propio esqueleto. Pero
   documento(), que usa la auto-publicación, sí devuelve un documento COMPLETO,
   que es lo que exige la capability. Son dos contratos distintos y hay que
   respetar cada uno. */
(function () {
  "use strict";

  var leer = function (id) {
    var n = document.getElementById(id);
    try { return n ? JSON.parse(n.textContent) : null; } catch (e) { return null; }
  };
  var D = leer("datos") || {};
  var E = leer("estado") || { aprobadas: {}, version: 1 };
  var P = leer("plantilla") || { head: "", app: "", estilos: "" };
  if (!E.aprobadas) E.aprobadas = {};

  var soloLectura = false, api = null, temaManual = null;

  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var dinero = function (n) {
    return "$" + Number(n).toLocaleString("en-US",
      { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  var ent = function (n) {
    return Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
  };
  var CAT = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)"];

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
  var TIPO = {
    accion: { et: "Se puede hacer ya", ex: "El dato alcanza para actuar." },
    obtener_dato: { et: "Falta un dato", ex: "Antes de actuar hay que conseguirlo." },
    integridad: { et: "Hay que corregir", ex: "Algo está mal configurado." }
  };
  var SECCIONES = [
    { id: "resumen", n: "Resumen" },
    { id: "decision", n: "Decisión" },
    { id: "rendimiento", n: "Rendimiento" },
    { id: "evidencia", n: "Evidencia" }
  ];
  var ico = {
    tic: '<svg viewBox="0 0 24 24"><path d="M4 12.5 9 17.5 20 6.5"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    ojo: '<svg viewBox="0 0 24 24"><path d="M12 3v13M12 20h.01"/></svg>',
    tema: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/></svg>',
    copiar: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg>'
  };

  /* ═════════════ piezas ═════════════ */

  function lateral() {
    var c = D.corrida || {};
    return '<aside class="lateral">' +
      '<div class="logo"><div class="g">MC</div><div class="marca-txt">' +
        "<b>Mesa Creativa</b><span>QPayPro · Mercadeo</span></div></div>" +
      '<nav class="nav">' + SECCIONES.map(function (s, i) {
        var T = D.tareas_propuestas || [];
        var falta = s.id === "decision"
          ? T.filter(function (x) { return !E.aprobadas[x.idempotencia]; }).length : 0;
        return '<a href="#' + s.id + '"' + (i === 0 ? ' class="on"' : "") +
          ' data-sec="' + s.id + '"><i></i>' + s.n +
          (falta ? '<b class="badge">' + falta + "</b>" : "") + "</a>";
      }).join("") + "</nav>" +
      '<div class="pie">Corrida del<br><b>' + esc(c.rango || "") + "</b></div>" +
      "</aside>";
  }

  function barra() {
    var n = (D.tareas_propuestas || []).length;
    return '<div class="barra"><div class="izq"><h1>Reunión creativa</h1>' +
      "<p>Lo que la semana dice, y las " + n + " decisiones que quedan para la mesa.</p></div>" +
      '<div class="der">' +
      '<button class="btn chico" type="button" id="bCopiar">' + ico.copiar +
        "Copiar resumen</button>" +
      '<button class="btn chico" type="button" id="bTema" aria-label="Cambiar tema">' +
        ico.tema + "Tema</button>" +
      "</div></div>";
  }

  function hero() {
    var recs = (D.plan || {}).recomendaciones || [];
    var q = recs.filter(function (r) { return r.cantidad; })[0];
    if (!q) {
      return '<div class="hero"><div class="et">Esta semana</div>' +
        '<div class="cifra">0</div><div class="un">recomendaciones cuantificadas</div>' +
        '<p class="exp">El análisis no encontró una diferencia que se pueda cuantificar ' +
        "con los datos de esta corrida. Lo que falta está listado más abajo.</p></div>";
    }
    var v = Math.abs(q.cantidad.valor - Math.round(q.cantidad.valor)) < 1e-9
      ? ent(q.cantidad.valor) : q.cantidad.valor.toFixed(0);
    return '<div class="hero"><div class="et">El número de la semana</div>' +
      '<div class="cifra">' + v + "</div>" +
      '<div class="un">' + esc(q.cantidad.unidad) + "</div>" +
      '<p class="exp">' + esc(q.accion) + "</p>" +
      '<div class="calc">' + esc(q.cantidad.calculo) + "</div>" +
      (q.advertencia ? '<p class="adv">' + esc(q.advertencia) + "</p>" : "") +
      "</div>";
  }

  function cifras() {
    var i = D.integridad || {}, det = D.consolidados_detalle || {};
    var exc = i.mercados_excluidos_con_gasto || {};
    var lead = det["actions:lead"];
    var t = [];
    if (lead && lead.costo_por_resultado != null) {
      t.push(cif(dinero(lead.costo_por_resultado), "cuesta cada lead, en promedio", ""));
    }
    var mal = (i.campanas_incoherentes || []).length;
    t.push(cif(mal === 0 ? "Todo cuadra" : String(mal),
      mal === 0 ? "los números de la API coinciden con la interfaz de Meta"
                : "campañas cuyo costo no cuadra", mal === 0 ? "ok" : "ojo"));
    Object.keys(exc).forEach(function (k) {
      t.push(cif(dinero(exc[k].gasto), "gastado en " + k + ", que ya no es mercado nuestro", "ojo"));
    });
    t.push(cif(String((D.tareas_propuestas || []).length), "decisiones esperando a la mesa", ""));
    return '<div class="cifras">' + t.join("") + "</div>";
  }
  function cif(v, e, cl) {
    return '<div class="cif' + (cl ? " " + cl : "") + '"><div class="v">' + esc(v) +
      '</div><div class="e">' + esc(e) + "</div></div>";
  }

  function avisos() {
    var h = D.huecos_declarados || [];
    var exc = (D.integridad || {}).mercados_excluidos_con_gasto || {};
    var li = h.map(function (x) {
      return "<li><b>" + esc(x.fuente) + ".</b> " + esc(x.descripcion) + " " +
        esc(x.impacto) + "</li>";
    });
    Object.keys(exc).forEach(function (k) {
      li.push("<li><b>Hubo gasto en " + esc(k) + ", que ya no es mercado nuestro.</b> " +
        esc(exc[k].accion_pendiente) + "</li>");
    });
    if (!li.length) return "";
    return '<div class="aviso"><h4>' + ico.ojo + "Lo que esta corrida NO incluye</h4>" +
      "<ul>" + li.join("") + "</ul>" +
      '<p class="cierre">Se declara, no se rellena. Si un dato falta, el sistema lo ' +
      "dice en lugar de estimarlo.</p></div>";
  }

  function decision() {
    var T = D.tareas_propuestas || [];
    if (!T.length) return "";
    var si = T.filter(function (t) { return E.aprobadas[t.idempotencia]; }).length;
    var pct = T.length ? (si / T.length) * 100 : 0;

    var filas = T.map(function (t) {
      var ap = !!E.aprobadas[t.idempotencia];
      var meta = TIPO[t.tipo] || { et: t.tipo, ex: "" };
      return '<article class="tarea' + (ap ? " si" : "") + '">' +
        '<div class="cu"><span class="pill ' + esc(t.tipo) + '">' + esc(meta.et) + "</span>" +
          "<h3>" + esc(t.titulo) + "</h3>" +
          '<p class="de">' + esc(t.descripcion) + "</p>" +
          '<div class="por"><b>Por qué:</b> ' + esc(t.justificacion) + "</div></div>" +
        '<button class="btn ' + (ap ? "" : "pri") + '" type="button"' +
          ' aria-pressed="' + ap + '" data-clave="' + esc(t.idempotencia) + '"' +
          (soloLectura ? " disabled" : "") + ">" +
          (ap ? ico.tic + "Aprobada" : "Aprobar") + "</button></article>";
    });

    return '<section id="decision"><div class="cab"><h2>Decisión de la mesa</h2></div>' +
      '<p class="sub">Marca lo que se acordó en la reunión. <b>Nada se crea en Zoho ' +
      "Sprint desde aquí</b>: esta página guarda la decisión, y el sistema crea " +
      "después solo lo aprobado.</p>" +
      '<div class="prog"><div class="txt"><b>' + si + " de " + T.length + "</b>" +
        "<span>tareas aprobadas</span></div>" +
        '<div class="pista"><div class="rell" style="width:' + pct.toFixed(0) +
        '%"></div></div>' +
        '<div class="acc">' +
          '<button class="btn chico" type="button" id="bTodas"' +
            (soloLectura ? " disabled" : "") + ">" + ico.tic + "Aprobar todas</button>" +
          '<button class="btn chico" type="button" id="bNada"' +
            (soloLectura || si === 0 ? " disabled" : "") + ">" + ico.x + "Limpiar</button>" +
        "</div></div>" +
      '<div class="tareas">' + filas.join("") + "</div>" +
      '<div class="aviso" style="margin-top:16px"><h4>' + ico.ojo +
      "Un hueco no se convierte en una acción</h4>" +
      "<ul><li>Cuando el análisis no alcanza para justificar una cantidad, la tarea " +
      "que propone el sistema es <b>conseguir el dato que falta</b>, no actuar sin él. " +
      "Por eso varias de arriba dicen «Falta un dato».</li></ul></div></section>";
  }

  function panelCosto() {
    var c = ((D.campanas_por_indicador_principal) || []).slice()
      .sort(function (a, b) { return b.costo_por_resultado - a.costo_por_resultado; });
    if (!c.length) return "";
    var max = Math.max.apply(null, c.map(function (x) { return x.costo_por_resultado; }));
    var min = Math.min.apply(null, c.map(function (x) { return x.costo_por_resultado; }));
    var limpio = function (s) {
      var n = String(s).replace(/^Campaña\s+/, "");
      var m = n.match(/^(.*?)\s*\[([A-Z]{2})\]$/);
      if (!m) return n;
      var base = m[1].trim();
      return new RegExp("\\b" + m[2] + "$").test(base) ? base : base + " · " + m[2];
    };
    var barras = c.map(function (x) {
      var mejor = x.costo_por_resultado === min;
      return '<div class="fila' + (mejor ? " mejor" : "") + '">' +
        '<div class="et"><span>' + esc(limpio(x.etiqueta)) +
        (mejor ? " · el más barato" : "") + "</span><b>" +
        dinero(x.costo_por_resultado) + "</b></div>" +
        '<div class="pista"><div class="rell" style="width:' +
        ((x.costo_por_resultado / max) * 100).toFixed(1) + '%"></div></div></div>';
    });
    var tabla = '<div class="tablaEnv"><table><thead><tr><th>Campaña</th>' +
      '<th class="n">Costo por lead</th><th class="n">Leads</th>' +
      '<th class="n">Invertido</th></tr></thead><tbody>' +
      c.map(function (x) {
        return "<tr><td>" + esc(limpio(x.etiqueta)) + '</td><td class="n">' +
          dinero(x.costo_por_resultado) + '</td><td class="n">' + ent(x.resultados) +
          '</td><td class="n">' + dinero(x.gasto) + "</td></tr>";
      }).join("") + "</tbody></table></div>";
    return '<div class="panel"><h3>Cuánto cuesta cada lead</h3>' +
      '<p class="aclara">Barra más corta es mejor. Solo se comparan campañas que miden ' +
      "lo mismo — no se mezclan leads con clics.</p>" +
      '<div class="barras">' + barras.join("") + "</div>" +
      "<details><summary>Ver los números en tabla</summary>" + tabla + "</details>" +
      '<p class="fuente">Periodo ' + esc((D.corrida || {}).rango || "") + "</p></div>";
  }

  function panelPresion() {
    var comp = D.competencia || {}, m = Object.keys(comp);
    if (!m.length) return "";
    var pr = m.reduce(function (a, b) {
      return comp[b].presion_total > comp[a].presion_total ? b : a;
    }, m[0]);
    var det = comp[pr].detalle || {};
    var act = Object.keys(det).filter(function (n) { return det[n].presion_real > 0; })
      .sort(function (a, b) { return det[b].presion_real - det[a].presion_real; });
    if (!act.length) return "";
    var total = act.reduce(function (s, n) { return s + det[n].presion_real; }, 0);
    var decl = Object.keys(det).reduce(function (s, n) {
      return s + det[n].activos_declarados; }, 0);
    var segs = act.map(function (n, k) {
      var v = det[n].presion_real, pct = (v / total) * 100;
      return '<div class="seg" style="flex:' + v + ";background:" + CAT[k % 4] + '">' +
        (pct >= 9 ? "<b>" + v + "</b>" : "") + "</div>";
    });
    var ley = act.map(function (n, k) {
      return "<span><i style=\"background:" + CAT[k % 4] + '"></i>' + esc(n) +
        " <b>" + det[n].presion_real + "</b></span>";
    });
    var libres = m.filter(function (x) { return comp[x].presion_total === 0; });
    var tabla = '<div class="tablaEnv"><table><thead><tr><th>Competidor</th>' +
      '<th class="n">Anuncios totales</th><th class="n">De pagos</th></tr></thead><tbody>' +
      Object.keys(det).sort(function (a, b) {
        return det[b].presion_real - det[a].presion_real; }).map(function (n) {
        return "<tr><td>" + esc(n) + '</td><td class="n">' +
          ent(det[n].activos_declarados) + '</td><td class="n">' +
          ent(det[n].presion_real) + "</td></tr>";
      }).join("") + "</tbody></table></div>";
    return '<div class="panel"><h3>Quién nos disputa el terreno en ' + esc(pr) + "</h3>" +
      '<p class="aclara">Contar anuncios engaña: entre todos suman ' + ent(decl) +
      " activos, pero solo <b>" + ent(total) + "</b> hablan de pagos. Esos son los " +
      "que compiten con nosotros.</p>" +
      '<div class="apil">' + segs.join("") + "</div>" +
      '<div class="ley">' + ley.join("") + "</div>" +
      (libres.length ? '<div class="libre"><b>' + esc(libres.join(", ")) +
        " está libre.</b> Ninguno de los competidores que seguimos pauta ahí.</div>" : "") +
      "<details><summary>Ver los números en tabla</summary>" + tabla + "</details>" +
      '<p class="fuente">La biblioteca de anuncios de Meta no acepta fechas: es una foto ' +
      "del día de la corrida, no una serie histórica.</p></div>";
  }

  function rendimiento() {
    var det = D.consolidados_detalle || {};
    var usables = Object.keys(det).filter(function (k) { return det[k].resultados > 0; });
    var chips = usables.sort(function (a, b) { return det[b].gasto - det[a].gasto; })
      .map(function (k) {
        var v = det[k];
        return '<div class="cif"><div class="v">' + ent(v.resultados) + "</div>" +
          '<div class="e"><b>' + esc(enClaro(k)) + "</b><br>" + dinero(v.gasto) + " · " +
          (v.costo_por_resultado != null ? dinero(v.costo_por_resultado) + " cada uno" : "—") +
          "</div></div>";
      });
    return '<section id="rendimiento"><div class="cab"><h2>Rendimiento</h2></div>' +
      '<p class="sub">Cada campaña mide un resultado distinto, así que se cuentan por ' +
      "separado. Sumarlos daría un número que parece correcto y no lo es.</p>" +
      (chips.length ? '<div class="cifras">' + chips.join("") + "</div>" : "") +
      '<div class="dos">' + panelCosto() + panelPresion() + "</div></section>";
  }

  function evidencia() {
    var h = D.hallazgos || [];
    if (!h.length) return "";
    var ord = { oportunidad: 0, riesgo: 1, observacion: 2 };
    var t = h.slice().sort(function (a, b) {
      return (ord[a.tipo] || 9) - (ord[b.tipo] || 9);
    }).map(function (x) {
      var ev = (x.evidencia || []).map(function (e) {
        return "<b>" + esc(e.dato) + ":</b> " + esc(e.valor); }).join("<br>");
      return '<article class="hal ' + esc(x.tipo) + '"><div class="tp">' +
        (x.tipo === "riesgo" ? "Ojo con esto" : x.tipo === "oportunidad"
          ? "Oportunidad" : "Observación") + "</div>" +
        "<h3>" + esc(x.titulo) + "</h3><p>" + esc(x.afirmacion) + "</p>" +
        (x.calculo ? '<div class="cal">' + esc(x.calculo) + "</div>" : "") +
        (ev ? '<div class="ev">' + ev + "</div>" : "") +
        (x.advertencia ? '<p class="adv">' + esc(x.advertencia) + "</p>" : "") +
        "</article>";
    });
    return '<section id="evidencia"><div class="cab"><h2>Evidencia</h2></div>' +
      '<p class="sub">Lo que sostiene las decisiones de arriba. Cada punto cita el dato ' +
      'del que salió.</p><div class="grid3">' + t.join("") + "</div></section>";
  }

  function cuerpo() {
    var v = D.verificacion_semana_anterior || "";
    return '<div class="app">' + lateral() + '<main class="principal">' +
      (soloLectura ? '<div class="lectura">Estás viendo esta página en <b>modo ' +
        "lectura</b>. Puedes revisar todo; las aprobaciones las registra quien tiene " +
        "permiso de escritura.</div>" : "") +
      barra() +
      '<section id="resumen">' + hero() + cifras() + avisos() +
      '<div class="panel"><h3>Comparación con la semana anterior</h3>' +
      '<p class="aclara" style="margin:6px 0 0">' + esc(v) + "</p></div></section>" +
      decision() + rendimiento() + evidencia() +
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
    avisar._t = setTimeout(function () { t.classList.remove("ver"); }, 2400);
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

  function pintar() {
    raiz().innerHTML = cuerpo();
    if (temaManual) document.documentElement.setAttribute("data-theme", temaManual);

    raiz().querySelectorAll("[data-clave]").forEach(function (b) {
      b.addEventListener("click", function () { alternar([b.dataset.clave]); });
    });
    var todas = document.getElementById("bTodas");
    if (todas) todas.addEventListener("click", function () {
      alternar((D.tareas_propuestas || []).filter(function (t) {
        return !E.aprobadas[t.idempotencia];
      }).map(function (t) { return t.idempotencia; }), "aprobar");
    });
    var nada = document.getElementById("bNada");
    if (nada) nada.addEventListener("click", function () {
      alternar(Object.keys(E.aprobadas), "quitar");
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
          raiz().querySelectorAll(".nav a").forEach(function (a) {
            a.classList.toggle("on", a.dataset.sec === e.target.id);
          });
        });
      }, { rootMargin: "-15% 0px -70% 0px" });
      secs.forEach(function (s) { obs.observe(s); });
    }
  }

  function copiar() {
    var T = D.tareas_propuestas || [], c = D.corrida || {};
    var l = ["Mesa Creativa · " + (c.rango || ""), ""];
    T.forEach(function (t) {
      l.push((E.aprobadas[t.idempotencia] ? "[x] " : "[ ] ") + t.titulo);
      l.push("    " + t.descripcion);
    });
    var h = D.huecos_declarados || [];
    if (h.length) {
      l.push("", "No incluye:");
      h.forEach(function (x) { l.push("  - " + x.fuente + ": " + x.descripcion); });
    }
    var txt = l.join("\n");
    var ok = function () { avisar("Resumen copiado"); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(ok, function () { avisar("No se pudo copiar"); });
    } else { avisar("No se pudo copiar"); }
  }

  function alternar(claves, forzar) {
    if (!claves || !claves.length || soloLectura) return;
    claves.forEach(function (k) {
      var hay = !!E.aprobadas[k];
      var quiero = forzar === "aprobar" ? true : forzar === "quitar" ? false : !hay;
      if (quiero) E.aprobadas[k] = { en: new Date().toISOString() };
      else delete E.aprobadas[k];
    });
    E.version = (E.version || 1) + 1;
    pintar();
    if (!api) { avisar("Guardado solo en esta vista"); return; }
    api.publish(documento()).catch(function (err) {
      var c = err && err.code;
      if (c === "conflict") return;
      if (c === "not_writer" || c === "not_granted" || c === "not_declared" ||
          c === "consent_required" || c === "capability_disabled" ||
          c === "capability_removed") {
        soloLectura = true; api = null; pintar();
        avisar("Esta vista es de solo lectura"); return;
      }
      if (c === "rate_limited") { avisar("Demasiados cambios seguidos, espera un momento"); return; }
      avisar("No se pudo guardar la aprobación");
    });
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
      if (!a) { soloLectura = true; pintar(); return; }
      api = a;
    }).catch(function () { soloLectura = true; pintar(); });
  } else { soloLectura = true; pintar(); }
})();
