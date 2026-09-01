/* Tablero semanal · Mesa Creativa.

   Diseño según especificación del usuario (2026-08-28): modo claro
   exclusivamente, fondo #F3F6F8, tarjetas blancas de esquinas muy redondeadas,
   sombras amplias y difusas, tipografía Inter con contraste fuerte, y
   revelación progresiva — resúmenes a la vista y «Ver todo» para el resto.

   DOS NOTAS DE ARQUITECTURA que no se pueden perder:

   1. El ARCHIVO que se publica es un fragmento (sin doctype, html, head ni
      body): el visor lo envuelve. Pero documento(), que usa la
      auto-publicación, devuelve un documento COMPLETO. Son dos contratos y hay
      que respetar cada uno.
   2. Este diseño es de un solo tema a propósito. Los colores neutros son
      literales de la paleta que pidió el usuario, no tokens que cambian con el
      tema del visor: así la página se ve igual sin importar si quien la abre
      tiene el sistema en oscuro. El color de marca sí sigue viniendo de
      config/tema.json, para que el equipo de diseño lo siga controlando.

   Y una distinción que gobierna el estado: las DECISIONES (aceptar, rechazar,
   asignar, elegir estrategia) son de la mesa, se comparten y se publican. Los
   FILTROS (mercado, grupo, búsqueda, qué lista está expandida) son de quien
   mira, viven en localStorage y nunca se publican. */
(function () {
  "use strict";

  var leer = function (id) {
    var n = document.getElementById(id);
    try { return n ? JSON.parse(n.textContent) : null; } catch (e) { return null; }
  };
  var D = leer("datos") || {};
  var E = leer("estado") || {};
  var P = leer("plantilla") || { head: "", app: "", estilos: "" };
  if (!E.aprobadas) E.aprobadas = {};
  if (!E.decisiones) E.decisiones = {};
  if (!E.propias) E.propias = {};
  if (E.estrategia === undefined) E.estrategia = null;

  var soloLectura = false, api = null;

  /* Vista local. Nunca se publica. */
  var V = { mercado: null, grupo: "competencia", categoria: "software",
            busqueda: "", verTodo: {} };
  try {
    var g = localStorage.getItem("mc.vista");
    if (g) { var o = JSON.parse(g); for (var k in o) if (k in V) V[k] = o[k]; }
  } catch (e) { /* almacenamiento bloqueado: se usan los valores por defecto */ }
  function guardarVista() {
    try { localStorage.setItem("mc.vista", JSON.stringify(V)); } catch (e) {}
  }

  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var esc2 = esc;
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

  /* Una linea de evidencia, venga como texto o como estructura.

     Las tareas traen evidencia de dos formas: a veces una frase escrita, a veces
     un objeto con dato, valor y fuente. Pasar el objeto por esc() imprimia
     «[object Object]» donde tenia que ir el numero que respalda la tarea. La
     fuente NO se recorta: es lo que hace auditable el dato. */
  function evidencia(e) {
    if (e == null) return "";
    if (typeof e === "string") return e;
    if (typeof e === "object") {
      var dato = e.dato || e.que || "", valor = e.valor || "", fuente = e.fuente || "";
      var cab = dato && valor ? dato + ": " + valor : (dato || valor);
      return [cab, fuente].filter(function (x) { return x; }).join(" · ");
    }
    return String(e);
  }

  function enClaro(ind) {
    if (!ind) return "sin indicador";
    if (/QualifiedLead/i.test(ind)) return "Leads calificados";
    if (/complete_registration/i.test(ind)) return "Registros completados";
    if (/link_click/i.test(ind)) return "Clics en el enlace";
    if (/:lead$/i.test(ind)) return "Leads";
    if (ind === "mixed") return "Mezclado";
    return ind.replace(/^actions:/, "");
  }
  var RED = { facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok",
              youtube: "YouTube", linkedin: "LinkedIn" };

  var SECCIONES = [
    { id: "resumen", n: "Resumen", i: "cuadros" },
    { id: "rendimiento", n: "Rendimiento", i: "grafico" },
    { id: "competencia", n: "Competencia", i: "objetivo" },
    { id: "referencias", n: "Referencias", i: "brujula" },
    { id: "estrategia", n: "Estrategia", i: "chispa" }
  ];

  var ico = {
    cuadros: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/>',
    grafico: '<path d="M4 19V5M4 19h16M8 15l4-5 3 3 4-6"/>',
    objetivo: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
    brujula: '<circle cx="12" cy="12" r="8"/><path d="M15 9l-2.5 5.5L7 17l2.5-5.5z"/>',
    chispa: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/>' +
             '<path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
    lupa: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
    tic: '<path d="M4 12.5 9 17.5 20 6.5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    copiar: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
    link: '<path d="M10 14a4 4 0 0 0 6 .5l3-3a4 4 0 0 0-6-6l-1.5 1.5"/><path d="M14 10a4 4 0 0 0-6-.5l-3 3a4 4 0 0 0 6 6L12.5 17"/>',
    arriba: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    abajo: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    flecha: '<path d="M5 12h13M13 6l6 6-6 6"/>'
  };
  function svg(d, cls) {
    return '<svg viewBox="0 0 24 24" class="' + (cls || "w-5 h-5") +
      '" fill="none" stroke="currentColor" stroke-width="1.7" ' +
      'stroke-linecap="round" stroke-linejoin="round">' + d + "</svg>";
  }

  /* ═════════════ utilidades de datos ═════════════ */

  /* El logo de una marca medida, incrustado por el generador y buscado por su
     nombre exacto. Una marca sin logo devuelve null y la fila cae en sus
     iniciales: es mejor una inicial honesta que un logo generico, que haria
     parecer medida a una marca que no lo esta. */
  /* ═════════════ el análisis profundo de la Ad Library ═════════════

     Vive en D.recomendaciones y puede no estar: si la corrida no encontró el
     análisis profundo, el bloque es null y el hueco quedó declarado. Todo lo
     que lo consume comprueba primero. */

  function reco() { return D.recomendaciones || null; }

  /* Nombres «Banco Industrial» y «Banco Industrial (BI)» son la misma marca; el
     registro y el análisis profundo no siempre coinciden en el rótulo. Se cruza
     primero por page_id, que es el dato duro, y solo si no hay se compara el
     nombre normalizado en las dos direcciones. */
  function mismaMarca(a, b) {
    var n = function (x) {
      return String(x || "").toLowerCase().replace(/\(.*?\)/g, "")
        .replace(/[^a-z0-9]/g, "");
    };
    var x = n(a), y = n(b);
    return !!x && !!y && (x === y || x.indexOf(y) === 0 || y.indexOf(x) === 0);
  }

  /* Las filas del análisis profundo de una marca. Devuelve un ARREGLO porque
     una marca puede tener varias páginas: Square tiene la de EE.UU. y la de
     Reino Unido, con inventarios distintos. */
  function profundoDe(marca) {
    var R = reco();
    if (!R) return [];
    return (R.por_marca || []).filter(function (p) {
      return (marca.page_id && p.page_id &&
              String(marca.page_id) === String(p.page_id)) ||
             mismaMarca(marca.nombre, p.marca);
    });
  }

  function logoDe(nombre) {
    return (D.logos_competencia || {})[nombre] || null;
  }

  function mercados() { return Object.keys(D.por_mercado || {}).sort(); }
  function mercadoActivo() {
    var ms = mercados();
    if (!ms.length) return null;
    return ms.indexOf(V.mercado) >= 0 ? V.mercado : ms[0];
  }
  function leadTotal() { return (D.consolidados_detalle || {})["actions:lead"] || null; }

  function competidoresDe(mercado) {
    var c = (D.competencia || {})[mercado];
    if (!c) return [];
    return Object.keys(c.detalle || {}).map(function (n) {
      var d = Object.assign({}, c.detalle[n]); d.nombre = n; d.mercado = mercado;
      return d;
    });
  }
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
        if (c.mensajes && c.mensajes.length > e.mensajes.length) e.mensajes = c.mensajes;
        if (c.anuncios_en_muestra > e.muestra) e.muestra = c.anuncios_en_muestra;
        if (c.activos_declarados > e.activos) e.activos = c.activos_declarados;
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

  function estrategiaActiva() {
    var es = ((D.estrategia || {}).estrategias) || [];
    if (!es.length) return null;
    return es.filter(function (e) { return e.id === E.estrategia; })[0] ||
           es.filter(function (e) { return e.recomendada; })[0] || es[0];
  }
  function tareasVisibles() {
    var act = estrategiaActiva();
    return (((D.estrategia || {}).tareas) || []).filter(function (t) {
      return t.siempre || !act || (t.estrategias || []).indexOf(act.id) >= 0;
    });
  }

  /* La serie semanal permite la ÚNICA comparación real que existe en esta
     corrida. No hay corrida de la semana anterior, así que un porcentaje de
     variación en las cifras de pauta sería inventado: ahí no se pone ninguno. */
  function serieTotal() {
    var se = ((D.redes_sociales || {}).serie_semanal) || null;
    if (!se) return null;
    var tot = se.semanas.map(function (_, i) {
      var suma = 0, hay = false;
      Object.keys(se.interacciones).forEach(function (r) {
        var v = se.interacciones[r][i];
        if (v != null) { suma += v; hay = true; }
      });
      return hay ? suma : null;
    });
    return { semanas: se.semanas, total: tot, crudo: se };
  }
  function variacionOrganico() {
    var s = serieTotal();
    if (!s) return null;
    var t = s.total.filter(function (v) { return v != null; });
    if (t.length < 2) return null;
    var a = t[t.length - 2], b = t[t.length - 1];
    if (!a) return null;
    return { pct: (b - a) / a * 100, de: a, a: b };
  }

  /* ═════════════ armazón ═════════════ */

  /* Rail de iconos. Sin etiquetas largas, como pide la especificación — pero
     con aria-label y title, porque un icono sin nombre accesible no es
     minimalismo, es un botón que un lector de pantalla no puede anunciar. */
  function rail() {
    var act = seccionVisible;
    return '<nav data-rail-nav aria-label="Secciones" ' +
      'class="fixed z-30 bg-white left-0 right-0 bottom-0 h-[68px] flex-row ' +
      'justify-center gap-1.5 px-4 rail-borde ' +
      'md:right-auto md:top-0 md:bottom-auto md:h-full md:w-[76px] ' +
      'md:flex-col md:justify-start md:py-7 md:gap-2 md:px-0 ' +
      'flex items-center">' +
      marcaDelRail() +
      SECCIONES.map(function (s) {
        var on = s.id === act;
        return '<a href="#' + s.id + '" data-rail="' + s.id + '" title="' + esc(s.n) +
          '" aria-label="' + esc(s.n) + '"' +
          (on ? ' aria-current="true"' : "") +
          ' style="--sec:var(--sec-' + s.id + ');--sec-tinta:var(--sec-' + s.id +
          '-tinta);--sec-lavado:var(--sec-' + s.id + '-lavado)"' +
          ' class="rail-b group relative w-11 h-11 shrink-0 ' +
          'rounded-2xl grid place-items-center transition-colors ' +
          (on ? "rail-azulejo-on" : "rail-azulejo hover:opacity-80") + '">' +
          svg(ico[s.i], "w-[21px] h-[21px]") +
          '<span class="rail-tip">' + esc(s.n) + "</span></a>";
      }).join("") +
      "</nav>";
  }

  /* El logo del usuario principal. Si config/tema.json trae un archivo, el
     generador lo incrusta como data URI y llega aqui en D.logo; si no, se dibuja
     el monograma. Un logo que falta no puede romper la pagina. */
  function marcaDelRail() {
    var lg = D.logo;
    if (lg && lg.uri) {
      return '<img src="' + esc(lg.uri) + '" alt="' + esc(lg.alt || "") + '" ' +
        'class="w-12 h-12 object-contain mb-6 hidden md:block">';
    }
    return '<div class="w-10 h-10 rounded-2xl grid place-items-center ' +
      'font-bold text-[13px] mb-6 hidden md:grid" ' +
      'style="background:var(--negro);color:#fff">MC</div>';
  }

  function encabezado() {
    var c = D.corrida || {};
    var chip = buscando()
      ? '<button type="button" id="limpiarBusqueda" class="etiqueta-marca ' +
        'hover:underline">Filtrando por «' + esc(V.busqueda.trim()) +
        '» · quitar</button>'
      : "";
    return '<header class="mb-10">' +
      '<div class="flex flex-wrap items-center gap-x-6 gap-y-5 justify-between">' +
      "<div>" +
      '<h1 class="text-[28px] sm:text-[32px] leading-tight font-bold ' +
      'text-slate-800 tracking-[-0.02em]">Hola, Merca</h1>' +
      '<p class="text-slate-400 mt-1.5 text-[13.5px] sm:text-[14px]">' +
      "Reunión creativa de la semana del " + esc(c.rango || "") + "</p></div>" +
      '<div class="flex items-center gap-3 flex-wrap">' +
      '<div class="relative">' +
      '<span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300">' +
      svg(ico.lupa, "w-[18px] h-[18px]") + "</span>" +
      '<input id="buscar" type="search" value="' + esc(V.busqueda) + '" ' +
      'aria-label="Buscar" placeholder="Buscar campaña, marca o tarea" ' +
      'class="w-full sm:w-[280px] bg-white rounded-full pl-11 pr-4 py-3 ' +
      'text-[13.5px] text-slate-700 placeholder:text-slate-300 outline-none ' +
      'focus:ring-2 focus:ring-slate-200 tarjeta-sombra"></div>' +
      '<button type="button" id="bCsv" class="btn-oscuro">' +
      svg(ico.copiar, "w-4 h-4") + "Copiar para Sprint</button>" +
      '<button type="button" id="bDecisiones" class="btn-claro" ' +
      'title="JSON para la creación automática por API">' +
      svg(ico.copiar, "w-4 h-4") + "Decisiones</button>" +
      "</div></div>" +
      (chip ? '<div class="mt-5">' + chip + "</div>" : "") +
      "</header>";
  }

  /* ═════════════ piezas de dato ═════════════ */

  /* Una tarjeta de KPI. El indicador de variación se muestra SOLO cuando existe
     un periodo anterior con el que comparar. En esta corrida eso pasa
     únicamente en orgánico, porque la serie semanal lo permite; en pauta no hay
     corrida previa, así que en lugar de un porcentaje inventado va el dato
     factual que sí se tiene. Un +8.2% de adorno haría que alguien tome una
     decisión sobre una cifra que nadie midió. */
  function kpi(titulo, valor, nota, variacion) {
    var ind = "";
    if (variacion && variacion.pct != null) {
      var sube = variacion.pct >= 0;
      ind = '<span class="inline-flex items-center gap-1 text-[12px] font-semibold ' +
        'px-2 py-1 rounded-lg ' +
        (sube ? "text-emerald-600 bg-emerald-50" : "text-rose-600 bg-rose-50") +
        '">' + svg(sube ? ico.arriba : ico.abajo, "w-3 h-3") +
        (sube ? "+" : "") + variacion.pct.toFixed(1) + "%</span>";
    }
    return '<div class="bg-white rounded-3xl p-7 tarjeta-sombra">' +
      '<div class="flex items-start justify-between gap-3 min-h-[34px]">' +
      '<span class="text-[12.5px] font-medium text-slate-400 leading-snug">' +
      esc(titulo) + "</span>" + ind + "</div>" +
      '<div class="text-[34px] font-bold text-slate-800 tracking-[-0.03em] ' +
      'mt-3 tabular-nums leading-none">' + valor + "</div>" +
      (nota ? '<div class="text-[12px] text-slate-400 mt-2.5 leading-snug">' +
        esc(nota) + "</div>" : "") + "</div>";
  }

  /* Encabezado de tarjeta con «Ver todo» opcional. El enlace no es decorativo:
     expande la lista en su lugar. Un «Ver todo» que no lleva a ninguna parte
     sería peor que no tenerlo. */
  /* `tinte` avisa que esta tarjeta va sobre un pastel de la paleta.
     NO es un detalle estetico: medido, el gris claro de las tarjetas blancas
     (slate-400) da 1.9:1 sobre el pastel mas oscuro, cuando el minimo es 4.5:1.
     Sobre pastel la escala sube a slate-700, que da entre 6.0:1 y 7.8:1 en los
     cuatro colores. Se pasa como parametro en lugar de sobrescribir la cascada
     con !important, que es como se rompen los estilos sin darse cuenta. */
  function cardCab(titulo, sub, clave, total, mostrados, tinte) {
    var ver = "";
    if (clave && total > mostrados) {
      ver = '<button type="button" data-vertodo="' + esc(clave) + '" ' +
        'class="text-[12.5px] font-semibold shrink-0 hover:underline ' +
        (tinte ? "text-slate-900" : "") + '"' +
        (tinte ? "" : ' style="color:var(--marca)"') + ">" +
        (V.verTodo[clave] ? "Ver menos" : "Ver todo (" + total + ")") + "</button>";
    }
    return '<div class="flex items-start justify-between gap-4 mb-6">' +
      "<div><h3 class=\"text-[16px] font-bold text-slate-900 tracking-[-0.01em]\">" +
      esc(titulo) + "</h3>" +
      (sub ? '<p class="text-[12.5px] mt-1 ' +
        (tinte ? "text-slate-700" : "text-slate-400") + '">' + sub + "</p>" : "") +
      "</div>" + ver + "</div>";
  }

  function recorta(lista, clave, tope) {
    return V.verTodo[clave] ? lista : lista.slice(0, tope || 3);
  }

  /* Una fila de lista: avatar circular, nombre en negrita, descripción sutil,
     valor a la derecha. */
  /* `tono` es el SEMAFORO y solo eso: verde aprobado, rojo rechazado, ambar
     intermedio. Esos tres colores no salen de la paleta pastel a proposito —
     instruccion de Mercadeo (2026-08-31) y ademas es lo correcto: si «bien» y
     «pendiente» fueran dos pasteles del mismo tablero, el estado dejaria de
     leerse de un golpe. Cuando no hay estado, el circulo lleva el lavado de la
     seccion, que si es de la paleta.

     `logo` gana sobre `inicial`: una marca con logo se reconoce sin leer. */
  function fila(inicial, nombre, desc, valor, sub, tono, tinte, logo) {
    var col = { verde: "bg-emerald-50 text-emerald-700",
                rojo: "bg-rose-50 text-rose-700",
                ambar: "bg-amber-50 text-amber-700" }[tono] ||
              (tinte ? "fila-ini-tinte" : "fila-ini");
    var suave = tinte ? "text-slate-700" : "text-slate-400";
    var avatar = logo
      ? '<div class="w-10 h-10 rounded-full shrink-0 fila-logo"><img src="' +
        esc(logo) + '" alt="' + esc(nombre) + '"></div>'
      : '<div class="w-10 h-10 rounded-full grid place-items-center shrink-0 ' +
        'text-[13px] font-bold ' + col + '">' + esc(inicial) + "</div>";
    return '<div class="flex items-center gap-4 py-3.5">' + avatar +
      '<div class="min-w-0 flex-1">' +
      '<div class="text-[13.5px] font-semibold text-slate-900 truncate">' +
      esc(nombre) + "</div>" +
      (desc ? '<div class="text-[12px] ' + suave + ' truncate mt-0.5">' +
        esc(desc) + "</div>" : "") + "</div>" +
      '<div class="text-right shrink-0">' +
      '<div class="text-[14px] font-bold text-slate-900 tabular-nums">' + valor +
      "</div>" +
      (sub ? '<div class="text-[11px] ' + suave + ' mt-0.5">' + esc(sub) +
        "</div>" : "") + "</div></div>";
  }

  /* ═════════════ gráfica ═════════════ */

  /* Área suave, sin cuadrícula interna, con degradado que se desvanece hacia
     abajo — la especificación pidió exactamente eso.

     La curva se traza con un spline de Catmull-Rom convertido a bezier cúbica,
     con tensión bajada a 0.5 y las manijas recortadas para que la curva NO se
     dispare por encima de un pico ni por debajo de un valle. Una curva que
     sobrepasa el dato lo está falseando: dibujaría un máximo donde el número no
     lo tiene.

     Un hueco (null) corta el trazo. Las semanas anteriores a la muestra de una
     red no son ceros: son semanas que no se leyeron. */
  var GEO = { w: 760, h: 260, iz: 46, de: 26, ar: 22, ab: 40 };

  function escalaLinda(max) {
    if (!(max > 0)) return { max: 1, pasos: [0, 1] };
    var mag = Math.pow(10, Math.floor(Math.log10(max)));
    var paso = mag / 2;
    while (max / paso > 4) paso *= 2;
    var tope = Math.ceil(max / paso) * paso;
    var pasos = [];
    for (var v = 0; v <= tope + 1e-9; v += paso) pasos.push(v);
    return { max: tope, pasos: pasos };
  }

  /* Interpolacion cubica monotona (Fritsch-Carlson).

     El primer intento fue un spline de Catmull-Rom con las manijas recortadas
     al rango vertical de cada tramo. Recortar evitaba que la curva se
     disparara, si — pero en un pico la manija quedaba pegada al propio vertice
     y el tramo entraba recto: exactamente los «picos rigidos» que el diseno
     pide evitar. Se veia en la serie de Instagram del 13 de julio.

     Fritsch-Carlson resuelve las dos cosas de una vez: en un maximo o un minimo
     local pone la tangente horizontal, asi que el pico sale redondeado, y
     garantiza por construccion que la curva no se sale del rango de sus dos
     extremos. Suave y sin inventar un maximo que el dato no tiene. */
  function curva(pts) {
    var n = pts.length;
    if (n < 2) return "";
    if (n === 2) {
      return "M" + pts[0][0].toFixed(1) + " " + pts[0][1].toFixed(1) +
             " L" + pts[1][0].toFixed(1) + " " + pts[1][1].toFixed(1);
    }

    var h = [], d = [], i;
    for (i = 0; i < n - 1; i++) {
      h.push(pts[i + 1][0] - pts[i][0]);
      d.push(h[i] ? (pts[i + 1][1] - pts[i][1]) / h[i] : 0);
    }

    var m = [d[0]];
    for (i = 1; i < n - 1; i++) {
      if (d[i - 1] * d[i] <= 0) {
        m.push(0);                       // extremo local: tangente horizontal
      } else {
        var t = (d[i - 1] + d[i]) / 2;
        var tope = 3 * Math.min(Math.abs(d[i - 1]), Math.abs(d[i]));
        m.push(Math.sign(t) * Math.min(Math.abs(t), tope));
      }
    }
    m.push(d[n - 2]);

    var s = "M" + pts[0][0].toFixed(1) + " " + pts[0][1].toFixed(1);
    for (i = 0; i < n - 1; i++) {
      var c1x = pts[i][0] + h[i] / 3,
          c1y = pts[i][1] + m[i] * h[i] / 3,
          c2x = pts[i + 1][0] - h[i] / 3,
          c2y = pts[i + 1][1] - m[i + 1] * h[i] / 3;
      s += " C" + c1x.toFixed(1) + " " + c1y.toFixed(1) + "," +
           c2x.toFixed(1) + " " + c2y.toFixed(1) + "," +
           pts[i + 1][0].toFixed(1) + " " + pts[i + 1][1].toFixed(1);
    }
    return s;
  }

  function grafico(id, cfg) {
    var S = cfg.series.filter(function (s) {
      return s.valores.some(function (v) { return v != null; });
    });
    if (!S.length || !cfg.semanas.length) {
      return '<div class="text-[13px] text-slate-400 py-8 text-center">' +
        "Sin serie para graficar en este periodo.</div>";
    }
    var G = GEO, n = cfg.semanas.length, pico = 0;
    S.forEach(function (s) {
      s.valores.forEach(function (v) { if (v != null && v > pico) pico = v; });
    });
    var esc_ = escalaLinda(pico);
    var px = function (i) {
      return G.iz + (n === 1 ? 0 : i * (G.w - G.iz - G.de) / (n - 1));
    };
    var py = function (v) { return G.ar + (1 - v / esc_.max) * (G.h - G.ar - G.ab); };

    var partes = [], defs = [];

    // Solo el eje Y con sus valores y una línea base. Sin cuadrícula interna.
    esc_.pasos.forEach(function (v) {
      partes.push('<text x="' + (G.iz - 12) + '" y="' + (py(v) + 4).toFixed(1) +
        '" text-anchor="end" class="g-tick">' + ent(v) + "</text>");
    });
    partes.push('<line x1="' + G.iz + '" y1="' + py(0).toFixed(1) + '" x2="' +
      (G.w - G.de) + '" y2="' + py(0).toFixed(1) + '" class="g-eje"/>');

    cfg.semanas.forEach(function (w, i) {
      if (n > 8 && i % 2 !== (n - 1) % 2) return;
      partes.push('<text x="' + px(i).toFixed(1) + '" y="' + (G.h - 14) +
        '" text-anchor="middle" class="g-tick">' + esc(w.etiqueta) + "</text>");
    });

    S.forEach(function (s, si) {
      var gid = id + "-grad-" + si;
      /* El relleno del area es el PASTEL de la paleta; el trazo es el mismo
         tono bajado a peso de linea. Es lo que permite pintar la grafica con
         la paleta de Mercadeo y que se siga leyendo: el pastel puro como
         linea da 1.34:1 sobre blanco. */
      var relleno = s.relleno || s.color;
      /* El patron va PEGADO al color, no a la posicion en la grafica: si en una
         grafica YouTube es la tercera serie y en otra la unica, en las dos
         tiene que verse igual. Por eso la serie puede declarar el suyo. */
      var patron = "g-l" + Math.min(s.patron || si + 1, 3);
      defs.push('<linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="' + relleno + '" stop-opacity="0.85"/>' +
        '<stop offset="55%" stop-color="' + relleno + '" stop-opacity="0.32"/>' +
        '<stop offset="100%" stop-color="' + relleno + '" stop-opacity="0"/>' +
        "</linearGradient>");
      var tramos = [], actual = [];
      s.valores.forEach(function (v, i) {
        if (v == null) { if (actual.length) { tramos.push(actual); actual = []; } return; }
        actual.push([px(i), py(v)]);
      });
      if (actual.length) tramos.push(actual);

      tramos.forEach(function (t) {
        var d = curva(t);
        if (!d) {
          partes.push('<circle cx="' + t[0][0].toFixed(1) + '" cy="' +
            t[0][1].toFixed(1) + '" r="4" fill="' + s.color + '" class="g-pto"/>');
          return;
        }
        if (cfg.area) {
          var base = py(0).toFixed(1);
          partes.push('<path d="' + d + " L" + t[t.length - 1][0].toFixed(1) +
            " " + base + " L" + t[0][0].toFixed(1) + " " + base + ' Z" fill="url(#' +
            gid + ')" stroke="none"/>');
        }
        partes.push('<path d="' + d + '" fill="none" stroke="' + s.color +
          '" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" ' +
          'class="' + patron + '"/>');
      });
      s.valores.forEach(function (v, i) {
        if (v == null) return;
        var ultimo = i === s.valores.length - 1 ||
          s.valores.slice(i + 1).every(function (x) { return x == null; });
        partes.push('<circle cx="' + px(i).toFixed(1) + '" cy="' + py(v).toFixed(1) +
          '" r="' + (ultimo ? 5 : 3.5) + '" fill="' + s.color + '" class="g-pto"/>');
      });
    });

    partes.push('<line id="' + id + '-cruz" x1="0" y1="' + G.ar + '" x2="0" y2="' +
      (G.h - G.ab) + '" class="g-cruz" style="opacity:0"/>');
    partes.push('<rect id="' + id + '-caza" x="' + G.iz + '" y="' + G.ar +
      '" width="' + (G.w - G.iz - G.de) + '" height="' + (G.h - G.ar - G.ab) +
      '" fill="transparent" style="cursor:crosshair"/>');

    /* La muestra de la leyenda dibuja el MISMO patron de trazo que la linea,
       no un punto de color. Con tres tonos de una sola paleta el patron es lo
       que separa las series para quien no distingue esos tres colores. */
    var leyenda = S.length < 2
      ? '<div class="mb-5 h-[18px]"></div>'
      : '<div class="flex flex-wrap gap-x-5 gap-y-2 mb-5 min-h-[18px]">' +
        S.map(function (s, si) {
          var n = Math.min(s.patron || si + 1, 3);
          return '<span class="inline-flex items-center gap-2 text-[12px] ' +
            'text-slate-500"><i class="g-muestra' +
            (n > 1 ? " g-muestra-" + n : "") + '" style="border-top-color:' +
            s.color + '"></i>' + esc(s.nombre) + "</span>";
        }).join("") + "</div>";

    var tabla = '<details class="mt-5 pt-4 border-t border-slate-100">' +
      '<summary class="text-[12px] text-slate-400 font-medium cursor-pointer ' +
      'hover:text-slate-600">Ver la tabla</summary>' +
      '<div class="overflow-x-auto mt-4"><table class="w-full text-[12px]">' +
      '<thead><tr class="text-slate-300 text-left"><th class="py-2 pr-4 font-semibold ' +
      'uppercase tracking-wider text-[10px]">Semana</th>' +
      S.map(function (s) {
        return '<th class="py-2 pl-4 text-right font-semibold uppercase ' +
          'tracking-wider text-[10px]">' + esc(s.nombre) + "</th>";
      }).join("") + "</tr></thead><tbody>" +
      cfg.semanas.map(function (w, i) {
        return '<tr class="border-t border-slate-50"><td class="py-2 pr-4 ' +
          'text-slate-500">' + esc(w.etiqueta) + "</td>" + S.map(function (s) {
            var v = s.valores[i];
            return '<td class="py-2 pl-4 text-right tabular-nums text-slate-700">' +
              (v == null ? '<span class="text-slate-300">sin muestra</span>' : ent(v)) +
              "</td>";
          }).join("") + "</tr>";
      }).join("") + "</tbody></table></div></details>";

    return '<div class="graf" id="' + id + '" data-graf=\'' +
      esc(JSON.stringify({
        semanas: cfg.semanas.map(function (w) { return w.etiqueta; }),
        series: S.map(function (s) { return { n: s.nombre, v: s.valores, c: s.color }; }),
        geo: G
      })) + "'>" + leyenda +
      '<div class="relative"><svg viewBox="0 0 ' + G.w + " " + G.h +
      '" class="block w-full h-auto" role="img" aria-label="' + esc(cfg.titulo) +
      '"><defs>' + defs.join("") + "</defs>" + partes.join("") + "</svg>" +
      '<div class="g-tip" id="' + id + '-tip"></div></div>' + tabla + "</div>";
  }

  /* ═════════════ piezas del análisis profundo ═════════════ */

  /* El perfil corto de una marca: cómo apuesta, no cuánto tiene.

     Se muestra dentro de su tarjeta en Competencia. El reporte largo sigue
     existiendo aparte; esto es lo que se lee en la reunión sin abrir otra
     pestaña. Cada número trae su rótulo, y el que no vino no se dibuja. */
  function perfilProfundo(p) {
    var celdas = [];
    var mete = function (rot, val, nota) {
      if (val == null || val === "") return;
      celdas.push('<div class="min-w-[92px]">' +
        '<div class="text-[10px] font-bold tracking-wider text-slate-300 ' +
        'uppercase">' + esc(rot) + "</div>" +
        '<div class="text-[15px] font-bold text-slate-800 tabular-nums ' +
        'leading-tight mt-0.5">' + val + "</div>" +
        (nota ? '<div class="text-[10.5px] text-slate-400 leading-tight">' +
          esc(nota) + "</div>" : "") + "</div>");
    };
    mete("concentración", pct(p.concentracion),
         p.mensajes_distintos + " mensajes");
    mete("carrusel", pct(p.carrusel_cuota),
         p.tarjetas_max ? "hasta " + p.tarjetas_max + " tarjetas" : null);
    mete("cadencia", esc(p.modo),
         p.creativos_por_semana ? p.creativos_por_semana + "/semana" : null);
    mete("sin lanzar", p.dias_sin_lanzar != null ? p.dias_sin_lanzar + " d" : null,
         p.span_dias != null ? "carga en " + (p.span_dias + 1) + " d" : null);
    var verts = (p.verticales || []).map(function (v) {
      return '<span class="etiqueta-sec">' + esc(v.vertical) + " · " +
        v.anuncios + "</span>";
    }).join("");
    return '<div class="mt-1">' +
      /* El UNIVERSO va escrito. Sin él, el 84% de la consulta global choca
         contra el 74% de la lectura por país unos centímetros arriba, en la
         misma tarjeta, y se lee como un error de cálculo. Son dos universos
         distintos: uno es lo que pauta en GT, el otro todo lo que tiene activo. */
      '<div class="text-[11px] text-slate-400 mb-3">' + esc(p.marca) + " · " +
      (p.mercado === "GLOBAL" ? "consulta global" : "consulta " + esc(p.mercado)) +
      " · " + p.leidos + " anuncios leídos" +
      (p.muestra_completa
        ? " (inventario completo)"
        : " de " + ent(p.activos_declarados) + " activos") + "</div>" +
      '<div class="flex flex-wrap gap-x-6 gap-y-4">' + celdas.join("") + "</div>" +
      (verts ? '<div class="flex flex-wrap gap-1.5 mt-4">' + verts + "</div>" : "") +
      (p.advertencia_muestra
        ? '<p class="text-[11px] text-slate-400 leading-relaxed mt-4">' +
          esc(p.advertencia_muestra) + "</p>" : "") + "</div>";
  }

  /* Una recomendación.

     El color del tipo NO es un semáforo: es el color de la SECCIÓN de donde
     salió la evidencia. «Evitar» viene de un competidor (rosa), «copiar» de un
     referente (verde), «probar» de una señal que la muestra no sostiene del
     todo (azul). El verde y el rojo saturados siguen reservados para aceptar y
     rechazar, que es una decisión y esto es una lectura. */
  var TIPO = {
    evitar:  { et: "Evitar", v: "--pastel-rosa" },
    copiar:  { et: "Copiar", v: "--pastel-verde" },
    probar:  { et: "Probar", v: "--pastel-azul" }
  };

  function recomendacion(r) {
    var t = TIPO[r.tipo] || { et: r.tipo, v: "--pastel-azul" };
    return '<div class="bg-white rounded-3xl p-7 tarjeta-sombra flex flex-col">' +
      '<div class="flex items-center gap-2 flex-wrap mb-4">' +
      '<span class="etiqueta" style="background:var(' + t.v + ');color:#0b0b0b">' +
      esc(t.et) + "</span>" +
      (r.confianza === "media"
        ? '<span class="micro-et !mb-0 !inline">confianza media</span>' : "") +
      "</div>" +
      '<h3 class="text-[16px] font-bold text-slate-800 leading-snug mb-3">' +
      esc(r.titulo) + "</h3>" +
      '<p class="text-[13.5px] text-slate-600 leading-relaxed mb-4">' +
      esc(r.que_hacer) + "</p>" +
      '<p class="text-[12.5px] text-slate-400 leading-relaxed">' +
      esc(r.porque) + "</p>" +
      (r.advertencia
        ? '<p class="text-[11.5px] leading-relaxed mt-4 sec-lavado rounded-2xl ' +
          'px-4 py-3 text-slate-600">' + esc(r.advertencia) + "</p>" : "") +
      ((r.evidencia || []).length
        ? '<details class="mt-auto pt-5">' +
          '<summary class="text-[12px] font-semibold text-slate-400 ' +
          'cursor-pointer hover:text-slate-600">La evidencia</summary>' +
          '<ul class="mt-3 space-y-1.5 text-[11.5px] text-slate-500 ' +
          'leading-relaxed list-disc pl-5 font-mono">' +
          r.evidencia.map(function (e) { return "<li>" + esc(e) + "</li>"; })
            .join("") + "</ul></details>"
        : "") + "</div>";
  }

  /* Referentes contra competidores, en las dos cuotas que sí se pueden
     comparar entre grupos de tamaño distinto. Se comparan CUOTAS y no totales:
     un referente con 50 anuncios leídos y un competidor con 3 no se comparan
     por volumen sin mentir. */
  function comparativoProfundo() {
    var R = reco();
    if (!R || !R.comparativo) return "";
    var c = R.comparativo;
    var barra = function (rot, ref, com, nota) {
      if (ref == null || com == null) return "";
      var tope = Math.max(ref, com, 0.01);
      var fila_ = function (et, v, color) {
        return '<div class="flex items-center gap-3 mb-2">' +
          '<span class="text-[11px] text-slate-400 w-[92px] shrink-0">' +
          esc(et) + "</span>" +
          '<div class="flex-1 h-2.5 rounded-full bg-slate-50 overflow-hidden">' +
          '<div class="h-full rounded-full" style="width:' +
          Math.round(v / tope * 100) + "%;background:var(" + color + ')"></div>' +
          "</div>" +
          '<span class="text-[12.5px] font-bold text-slate-800 tabular-nums ' +
          'w-[42px] text-right">' + Math.round(v * 100) + "%</span></div>";
      };
      return '<div class="mb-6 last:mb-0">' +
        '<div class="text-[12.5px] font-semibold text-slate-700 mb-3">' +
        esc(rot) + "</div>" +
        fila_("Referentes", ref, "--pastel-verde") +
        fila_("Competidores", com, "--pastel-rosa") +
        (nota ? '<div class="text-[11px] text-slate-400 mt-1.5 leading-snug">' +
          esc(nota) + "</div>" : "") + "</div>";
    };
    var k = c.carrusel || {}, n = c.concentracion || {};
    return '<div class="bg-white rounded-3xl p-7 tarjeta-sombra">' +
      cardCab("Cómo apuestan unos y otros",
        "Cuotas, no totales: los grupos no tienen el mismo tamaño") +
      barra("Anuncios en carrusel", (k.referentes || {}).cuota,
            (k.competidores || {}).cuota,
            (k.referentes || {}).carruseles + " de " +
            (k.referentes || {}).anuncios + " contra " +
            (k.competidores || {}).carruseles + " de " +
            (k.competidores || {}).anuncios) +
      barra("Cuota del mensaje más repetido", (n.referentes || {}).mediana,
            (n.competidores || {}).mediana,
            "Mediana. Alto = una sola apuesta; bajo = cartera repartida.") +
      "</div>";
  }

  /* Los creativos que ninguna marca medida ha retirado.

     Es el sustituto DECLARADO del «top por impresiones», que no existe para un
     anunciante comercial (ADR-032). Lo que dice: nadie deja pagando meses un
     creativo que no le devuelve nada. Lo que NO dice: cuánto le devolvió. El
     rótulo lo repite para que no se lea como un ranking de efectividad. */
  function sobrevivientesCard() {
    var R = reco();
    var lista = R ? (R.sobrevivientes || []) : [];
    if (!lista.length) return "";
    return '<div class="bg-white rounded-3xl p-7 tarjeta-sombra">' +
      cardCab("Lo que nadie ha retirado",
        "No es un ranking de efectividad: es qué dejan pagando") +
      '<div class="divide-y divide-slate-50">' +
      lista.slice(0, 5).map(function (a) {
        return fila(a.rol === "referente" ? "REF" : "COM", "«" + a.mensaje + "»",
          a.marca + " · desde " + a.desde, a.dias_vivo + " d", "vivo",
          a.rol === "referente" ? null : "ambar");
      }).join("") + "</div>" +
      '<p class="text-[11px] text-slate-400 mt-5 leading-relaxed">' +
      "Los de la competencia salen en ámbar a propósito: son los que hay que " +
      "leer y NO repetir — ese territorio ya tiene dueño.</p></div>";
  }

  /* ═════════════ secciones ═════════════ */

  /* Cada seccion declara su color una sola vez, en una variable local de CSS.
     Todo lo que lleva color dentro de la seccion lo hereda de ahi, asi que
     cambiar la paleta de una seccion es cambiar una linea de tema.json. */
  function seccion(id, rotulo, titulo, sub, ctl, cuerpo) {
    var vars = "--sec:var(--sec-" + id + ");--sec-tinta:var(--sec-" + id +
      "-tinta);--sec-lavado:var(--sec-" + id + "-lavado)";
    var icono = (SECCIONES.filter(function (s) { return s.id === id; })[0] || {}).i;
    return '<section id="' + id + '" class="mb-16" style="' + vars + '">' +
      '<div class="flex flex-wrap items-end justify-between gap-5 mb-7">' +
      '<div><div class="sec-pastilla mb-3">' +
      (icono ? svg(ico[icono], "w-[13px] h-[13px]") : "") +
      esc(rotulo) + "</div>" +
      '<h2 class="text-[26px] font-bold text-slate-800 tracking-[-0.025em] ' +
      'leading-tight">' + esc(titulo) + "</h2>" +
      (sub ? '<p class="text-[13.5px] text-slate-400 mt-2 max-w-[62ch] ' +
        'leading-relaxed">' + sub + "</p>" : "") + "</div>" +
      (ctl ? "<div>" + ctl + "</div>" : "") + "</div>" + cuerpo + "</section>";
  }

  function pastillas(campo, opciones, activo) {
    return '<div class="inline-flex bg-white rounded-full p-1 tarjeta-sombra">' +
      opciones.map(function (o) {
        var on = o.v === activo;
        return '<button type="button" data-' + campo + '="' + esc(o.v) + '" ' +
          'class="px-5 py-2.5 rounded-full text-[13px] font-semibold transition-colors ' +
          (on ? "text-white" : "text-slate-400 hover:text-slate-600") + '"' +
          (on ? ' style="background:var(--marca)"' : "") + ">" + esc(o.n) + "</button>";
      }).join("") + "</div>";
  }

  /* Los bloques secundarios llevan el lavado de su seccion. Son los que
     explican y advierten, no los que muestran numeros: ahi el color ayuda a
     separarlos de la lectura principal sin quitarle el blanco a los datos. */
  function nota(texto) {
    return '<div class="sec-lavado rounded-3xl p-6 text-[12.5px] ' +
      'text-slate-600 leading-relaxed">' + texto + "</div>";
  }

  function plegado(titulo, items) {
    if (!items || !items.length) return "";
    return '<details class="sec-lavado rounded-3xl px-7 py-5 mt-5">' +
      '<summary class="text-[12.5px] font-semibold text-slate-600 cursor-pointer ' +
      'hover:text-slate-900">' + esc(titulo) + " · " + items.length + "</summary>" +
      '<ul class="mt-5 space-y-3 text-[12.5px] text-slate-500 leading-relaxed ' +
      'list-disc pl-5">' + items.map(function (l) {
        if (typeof l === "string") return "<li>" + l + "</li>";
        return '<li><b class="text-slate-700 font-semibold">' +
          esc(l.que || l.fuente || "") + (l.estado ? " · " + esc(l.estado) : "") +
          ".</b> " + esc(l.detalle || l.descripcion || "") +
          (l.impacto ? " " + esc(l.impacto) : "") +
          (l.remedio ? ' <i class="text-slate-400">' + esc(l.remedio) + "</i>" : "") +
          "</li>";
      }).join("") + "</ul></details>";
  }

  /* ── 1 · Resumen ─────────────────────────────────────────────────────────── */

  /* La portada, con la estructura de la imagen de referencia que mando Mercadeo
     el 2026-08-31: una tarjeta oscura grande a la izquierda con la frase de la
     semana y el boton de accion, tres tarjetas numeradas de color al lado, la
     fila de estadisticas en blanco debajo, y la lista de pendientes al final.

     TODO numero de aqui se deriva del dato. La imagen de referencia trae un
     «28%» de adorno en cada tarjeta; aqui cada barra tiene un denominador real
     y el pie de la tarjeta dice cual es. Una barra sin denominador es un dibujo.

     Los tres colores van en las tarjetas de PREVIO, no en las de dato: las
     cuatro tarjetas de estadistica siguen blancas, que es lo que pidio
     Mercadeo. */

  /* Una tarjeta numerada, del color de la seccion que previsualiza. Es un
     enlace entero: la tarjeta lleva a su seccion. */
  function cardNum(num, secId, icono, titulo, valor, sub, frac, pie) {
    var barra = "";
    if (frac && frac.total > 0) {
      var pc = Math.round(frac.parte / frac.total * 100);
      barra = '<div class="mt-4"><div class="h-1.5 rounded-full ' +
        'bg-black/[0.12] overflow-hidden"><div class="h-full rounded-full ' +
        'bg-black/75 transition-all duration-700" style="width:' + pc +
        '%"></div></div></div>';
    }
    return '<a href="#' + secId + '" class="rounded-3xl p-6 flex flex-col ' +
      'min-h-[212px] transition-transform hover:-translate-y-0.5" ' +
      'style="background:var(--sec-' + secId + ');color:var(--sec-' + secId +
      '-tinta)">' +
      '<div class="flex items-start justify-between">' +
      '<span class="text-[12px] font-bold tabular-nums opacity-45">' + num +
      "</span>" +
      '<span class="opacity-70">' + svg(icono, "w-[18px] h-[18px]") + "</span>" +
      "</div>" +
      '<div class="mt-auto pt-6">' +
      '<div class="text-[13.5px] font-bold leading-snug">' + esc(titulo) +
      "</div>" +
      '<div class="text-[27px] font-bold tracking-[-0.03em] tabular-nums ' +
      'leading-none mt-2.5">' + valor + "</div>" +
      '<div class="text-[11.5px] opacity-70 mt-1.5 leading-snug">' + esc(sub) +
      "</div>" + barra +
      (pie ? '<div class="text-[10.5px] opacity-60 mt-2 leading-snug">' +
        esc(pie) + "</div>" : "") +
      "</div></a>";
  }

  function resumen() {
    var L = leadTotal(), rs = D.redes_sociales, t = (rs && rs.totales) || {};
    var vari = variacionOrganico();
    var act = estrategiaActiva();
    var vis = tareasVisibles();
    var decid = vis.filter(function (x) { return E.decisiones[x.id]; }).length;

    /* ── la tarjeta oscura ───────────────────────────────────────────────── */

    /* La frase de la semana sale del dato o no sale. Sin pauta leida no se
       escribe una frase generica: se dice que falta. */
    var titular, apoyo;
    if (L && L.resultados != null) {
      titular = 'La pauta trajo <b class="font-bold">' + ent(L.resultados) +
        " leads</b> a " + dinero(L.costo_por_resultado) + " cada uno.";
      apoyo = ent(L.campanas) + " campañas con entrega · " + dinero(L.gasto) +
        " invertidos";
    } else {
      titular = "Esta corrida no trae rendimiento de pauta.";
      apoyo = "Sin el dato no se escribe la frase de la semana.";
    }

    var pcDec = vis.length ? Math.round(decid / vis.length * 100) : 0;
    var heroe = '<div class="rounded-3xl p-8 sm:p-9 flex flex-col" ' +
      'style="background:var(--sec-resumen);color:var(--sec-resumen-tinta)">' +
      '<div class="text-[10.5px] font-bold tracking-[0.14em] uppercase ' +
      'opacity-50">Semana del ' + esc((D.corrida || {}).rango || "") + "</div>" +
      '<h3 class="text-[25px] sm:text-[29px] font-bold leading-[1.18] ' +
      'tracking-[-0.02em] mt-4 max-w-[24ch]">' + titular + "</h3>" +
      '<p class="text-[12.5px] opacity-60 mt-3">' + esc(apoyo) + "</p>" +
      (act
        ? '<p class="text-[13px] opacity-85 mt-6 leading-relaxed max-w-[46ch] ' +
          'line-clamp-3"><b class="font-semibold">' + esc(act.nombre) + ".</b> " +
          esc(act.en_pocas_palabras) + "</p>"
        : '<p class="text-[13px] opacity-85 mt-6 leading-relaxed">Ninguna ' +
          "estrategia sostenida por los datos de esta corrida.</p>") +
      '<div class="mt-auto pt-7">' +
      '<div class="flex items-baseline justify-between text-[11.5px] ' +
      'opacity-60 mb-2"><span>Decisiones tomadas</span>' +
      '<span class="tabular-nums font-semibold">' + decid + " / " + vis.length +
      "</span></div>" +
      '<div class="h-1.5 rounded-full bg-white/20 overflow-hidden mb-7">' +
      '<div class="h-full rounded-full bg-white transition-all duration-700" ' +
      'style="width:' + pcDec + '%"></div></div>' +
      '<a href="#estrategia" class="inline-flex items-center gap-2 bg-white ' +
      'text-slate-900 rounded-full px-6 py-3.5 text-[13px] font-semibold ' +
      'hover:opacity-90 transition-opacity">Ir a decidir' +
      svg(ico.flecha, "w-4 h-4") + "</a></div></div>";

    /* ── 01 · Rendimiento ────────────────────────────────────────────────── */

    var porM = mercados().map(function (m) {
      var q = (D.por_mercado[m] || {}).principal;
      return { m: m, r: (q && q.resultados) || 0 };
    });
    var sumaM = porM.reduce(function (a, x) { return a + x.r; }, 0);
    var lider = porM.slice().sort(function (a, b) { return b.r - a.r; })[0];
    var c01 = cardNum("01", "rendimiento", ico.grafico, "Rendimiento",
      ent(L && L.resultados), "leads del indicador actions:lead",
      lider && sumaM ? { parte: lider.r, total: sumaM } : null,
      lider && sumaM
        ? lider.m + " concentra " + Math.round(lider.r / sumaM * 100) +
          "% de los leads medidos"
        : "");

    /* ── 02 · Competencia ────────────────────────────────────────────────── */

    /* Se cuentan MARCAS, no anuncios. Sumar los anuncios de los dos mercados
       duplicaria las campañas regionales: Shopify devuelve los mismos 16 en GT
       y en SV. Contar marcas no tiene ese problema. */
    var todasM = marcas();
    /* Solo COMPETIDORES. Shopify tiene 16 anuncios activos y es un referente:
       contarlo aqui diria que nos disputa el mercado cuando lo que hace es
       ensenarnos como se ve un buen anuncio. Un referente no suma a la presion
       competitiva (ADR-017). */
    var comps = todasM.filter(function (b) { return b.rol === "competidor"; });
    var disputan = comps.filter(function (b) {
      return Object.keys(b.mercados || {}).some(function (m) {
        return b.mercados[m].presion_real > 0;
      });
    });
    var faltanM = sinMedir().filter(function (x) {
      return x.rol === "competidor";
    }).length;
    var registro = comps.length + faltanM;
    var terr = ((D.referencias || {}).territorios) || {};
    var top = (terr.saturados || [])[0];
    var c02 = cardNum("02", "competencia", ico.objetivo, "Competencia",
      ent(disputan.length), "competidores con anuncios que nos disputan",
      registro ? { parte: disputan.length, total: registro } : null,
      "de " + registro + " del registro" +
      (faltanM ? " · " + faltanM + " sin medir" : "") +
      (top ? " · repite «" + top.mensaje + "»" : ""));

    /* ── 03 · Referencias ────────────────────────────────────────────────── */

    var ocup = (terr.saturados || []).length, libres = (terr.libres || []).length;
    /* La tarjeta previsualiza lo ACCIONABLE de la sección. Antes contaba
       territorios de mensaje; desde que la corrida trae el análisis profundo, lo
       que se va a usar en la mesa son las recomendaciones. Si no hay análisis
       profundo, vuelve a los territorios: la tarjeta no puede quedar vacía ni
       mostrar un cero que parecería medido. */
    var RC = reco(), c03;
    if (RC && (RC.recomendaciones || []).length) {
      var rs = RC.recomendaciones;
      var altas = rs.filter(function (x) { return x.confianza === "alta"; }).length;
      var evitar = rs.filter(function (x) { return x.tipo === "evitar"; }).length;
      c03 = cardNum("03", "referencias", ico.brujula, "Qué hacer",
        ent(rs.length), "recomendaciones con evidencia",
        { parte: altas, total: rs.length },
        altas + " de confianza alta" +
        (evitar ? " · " + evitar + " territorio" + (evitar === 1 ? "" : "s") +
          " que no tocar" : ""));
    } else {
      c03 = cardNum("03", "referencias", ico.brujula, "Referencias",
        ent(ocup + libres), "territorios de mensaje leídos",
        ocup + libres ? { parte: ocup, total: ocup + libres } : null,
        ocup + " ocupado" + (ocup === 1 ? "" : "s") + " · " + libres +
        " sin disputa");
    }

    /* ── la fila de estadisticas, en blanco ──────────────────────────────── */

    var kpis = [
      kpi("Leads del periodo", ent(L && L.resultados), "indicador actions:lead"),
      kpi("Inversión", dinero(L && L.gasto),
        (L ? L.campanas + " campañas con entrega" : "")),
      kpi("Costo por lead", dinero(L && L.costo_por_resultado),
        mercados().map(function (m) {
          var q = (D.por_mercado[m] || {}).principal;
          return m + " " + dinero(q && q.costo_por_resultado);
        }).join(" · ")),
      kpi("Interacciones orgánicas", ent(t.interacciones),
        vari ? "de " + vari.de + " a " + vari.a + " contra la semana anterior"
             : (t.publicaciones || 0) + " publicaciones", vari),
    ].join("");

    /* ── la lista de pendientes ──────────────────────────────────────────── */

    /* Aqui el color NO es de la paleta: es el semaforo. Aceptada verde,
       rechazada roja, sin decidir ambar — un estado intermedio de verdad, no
       un hueco. Instruccion de Mercadeo (2026-08-31) y ademas es lo correcto:
       si el estado fuera pastel se confundiria con la identidad de la
       seccion. */
    /* La misma lista que usa el selector de la seccion Estrategia, para que el
       nombre que se ve aqui sea el que se guardo alla. */
    var personas = (((D.estrategia || {}).asignacion) || {}).personas || [];
    var quien = function (id) {
      for (var i = 0; i < personas.length; i++) {
        if (String(personas[i].id_sprint) === String(id)) return personas[i].nombre;
      }
      return null;
    };
    var pend = vis.map(function (x) {
      var d = E.decisiones[x.id], e = d ? d.estado : null;
      var nom = d && d.responsable ? quien(d.responsable) : null;
      return fila(
        (x.tipo || "?").slice(0, 2).toUpperCase(),
        x.titulo,
        (x.tipo === "pauta" ? "cambio en pauta" : x.tipo) +
          (nom ? " · " + nom : e === "aceptada" ? " · sin responsable" : ""),
        /* El estado va escrito Y en color. Solo con color quedaria fuera quien
           no lo percibe; solo con la palabra habria que leer tres filas para
           ver como va la mesa. */
        '<span class="' + (e === "aceptada" ? "text-emerald-600"
          : e === "rechazada" ? "text-rose-600" : "text-amber-600") + '">' +
        (e === "aceptada" ? "Aceptada" : e === "rechazada" ? "Rechazada"
          : "Sin decidir") + "</span>",
        e ? "" : "esperando la mesa",
        e === "aceptada" ? "verde" : e === "rechazada" ? "rojo" : "ambar");
    });

    var lista = '<div class="bg-white rounded-3xl p-7 tarjeta-sombra">' +
      cardCab("Para decidir en la mesa",
        decid + " de " + vis.length + " ya tienen decisión",
        "pend", pend.length, 3) +
      (pend.length
        ? '<div class="divide-y divide-slate-50">' +
          recorta(pend, "pend").join("") + "</div>"
        : '<p class="text-[13px] text-slate-400 py-2">Ninguna tarea coincide ' +
          "con la búsqueda.</p>") + "</div>";

    var rotulo = function (txt) {
      return '<h3 class="text-[15px] font-bold text-slate-800 ' +
        'tracking-[-0.01em] mb-5 mt-10">' + esc(txt) + "</h3>";
    };

    return seccion("resumen", "La semana", "Resumen",
      "Lo que dicen los datos, y qué hay que decidir con eso.", "",
      /* Una sola columna hasta xl: por debajo de eso el heroe a media pantalla
         deja las tres tarjetas en 170 px y el titulo se parte en cinco lineas.
         Medido en la prueba, no supuesto: con 1.05fr_1fr desde tableta las
         tres no caben en fila y se rompe el 2+1. */
      '<div class="grid gap-6 xl:[grid-template-columns:1fr_1.18fr]">' +
      heroe +
      '<div class="grid gap-5 ' +
      '[grid-template-columns:repeat(auto-fill,minmax(min(160px,100%),1fr))] ' +
      'xl:[grid-template-columns:repeat(3,minmax(0,1fr))]">' +
      c01 + c02 + c03 + "</div></div>" +
      rotulo("Estadísticas") +
      '<div class="grid gap-6 ' +
      '[grid-template-columns:repeat(auto-fill,minmax(min(230px,100%),1fr))]">' +
      kpis + "</div>" +
      rotulo("Pendientes") + lista);
  }

  /* La advertencia de que los indicadores no se suman, con los numeros del
     mercado que se esta viendo. Antes eran dos literales y contradecian el
     total de la pantalla al cambiar de mercado. */
  function noSeSuman(d) {
    var base = "El total de arriba es solo del indicador principal: las " +
      "campañas no se suman entre indicadores distintos.";
    var ind = d.indicadores || {}, pr = d.indicador_principal;
    var otro = null;
    Object.keys(ind).forEach(function (k) {
      if (k === pr || !ind[k].utilizable) return;
      if (!otro || ind[k].resultados > ind[otro].resultados) otro = k;
    });
    if (!otro || !pr || !ind[pr]) return base;
    return "Las campañas no se suman entre indicadores distintos: " +
      ent(ind[pr].resultados) + " " + enClaro(pr).toLowerCase() + " y " +
      ent(ind[otro].resultados) + " " + enClaro(otro).toLowerCase() +
      " no son la misma cosa. El total de arriba es solo del indicador " +
      "principal.";
  }

  /* ── 2 · Rendimiento ─────────────────────────────────────────────────────── */
  function rendimiento() {
    var m = mercadoActivo(), ms = mercados();
    if (!m) return seccion("rendimiento", "Pauta y orgánico", "Rendimiento", "", "",
      nota("Sin datos por mercado en esta corrida."));
    var d = D.por_mercado[m] || {}, p = d.principal;
    var s = serieTotal(), se = s && s.crudo;

    var kpis = p ? [
      kpi(enClaro(d.indicador_principal), ent(p.resultados),
        "indicador " + (d.indicador_principal || "—")),
      kpi("Inversión", dinero(p.gasto), ""),
      kpi("Costo por lead", dinero(p.costo_por_resultado), ""),
      kpi("Campañas con entrega", ent(p.campanas), "no es lo mismo que activas hoy"),
    ].join("") : "";

    var cs = (d.campanas || []).filter(function (c) {
      return coincide(c.etiqueta, enClaro(c.indicador));
    });
    var filas = recorta(cs, "camp", 4).map(function (c) {
      return fila((c.etiqueta.match(/[A-Z]/g) || ["C"]).slice(0, 2).join(""),
        c.etiqueta.replace(/\s*\[[A-Z]{2}\]\s*$/, ""),
        enClaro(c.indicador) + " · " + ent(c.resultados) + " resultados",
        dinero(c.costo_por_resultado), dinero(c.gasto) + " invertidos",
        c.costo_por_resultado <= 2.6 ? "verde" : null);
    }).join("");

    /* Cada serie va con DOS colores del mismo tono: el trazo (oscuro, para la
       linea) y el pastel (para el area). Los dos salen de config/tema.json. */
    var COL = ["var(--trazo-azul)", "var(--trazo-rosa)", "var(--trazo-verde)"];
    var REL = ["var(--pastel-azul)", "var(--pastel-rosa)", "var(--pastel-verde)"];
    var orden = ["facebook", "instagram", "youtube"];
    var gInt = "", gVis = "";
    if (se) {
      gInt = grafico("gInt", {
        titulo: "Interacciones por semana", semanas: se.semanas, area: true,
        series: orden.filter(function (r) { return se.interacciones[r]; })
          .map(function (r, i) {
            return { nombre: RED[r] || r, valores: se.interacciones[r],
                     color: COL[i], relleno: REL[i] };
          }),
      });
      var conVistas = orden.filter(function (r) { return se.vistas[r]; });
      gVis = conVistas.length ? grafico("gVis", {
        titulo: "Vistas de video por semana", semanas: se.semanas, area: true,
        series: conVistas.map(function (r) {
          return { nombre: RED[r] || r, valores: se.vistas[r],
                   color: COL[orden.indexOf(r)],
                   relleno: REL[orden.indexOf(r)],
                   patron: orden.indexOf(r) + 1 };
        }),
      }) : "";
    }

    var det = (D.redes_sociales || {}).detalle || {};
    var redes = Object.keys(det).sort().map(function (n) {
      var r = det[n];
      if (r.silenciosa) {
        return fila(n.slice(0, 2).toUpperCase(), RED[n] || n,
          r.dias_de_silencio + " días sin publicar", "0", "publicaciones", "rojo");
      }
      return fila(n.slice(0, 2).toUpperCase(), RED[n] || n,
        r.publicaciones + " publicaciones" +
        (r.vistas != null ? " · " + ent(r.vistas) + " vistas" : ""),
        ent(r.interacciones), "interacciones");
    }).join("");

    return seccion("rendimiento", "Pauta y orgánico", "Rendimiento",
      "Meta Ads en <b class=\"text-slate-600 font-semibold\">" + esc(m) +
      "</b>, del periodo " + esc((D.corrida || {}).rango || "") + ".",
      pastillas("mercado", ms.map(function (x) {
        return { v: x, n: x === "GT" ? "Guatemala" : x === "SV" ? "El Salvador" : x };
      }), m),
      '<div class="grid gap-6 [grid-template-columns:repeat(auto-fill,minmax(min(230px,100%),1fr))] mb-6">' +
      kpis + "</div>" +
      '<div class="bg-white rounded-3xl p-7 tarjeta-sombra mb-6">' +
      cardCab("Campañas con entrega", buscando()
        ? "Solo las que coinciden con la búsqueda"
        : "Ordenadas por inversión", "camp", cs.length, 4) +
      (cs.length
        ? '<div class="divide-y divide-slate-50">' + filas + "</div>"
        : '<p class="text-[13px] text-slate-400 py-2">Ninguna campaña del ' +
          "periodo coincide con la búsqueda.</p>") +
      '<p class="text-[11.5px] text-slate-400 mt-5 leading-relaxed">' +
      noSeSuman(d) + "</p></div>" +
      (gInt ? '<div class="grid gap-6 [grid-template-columns:repeat(auto-fill,minmax(min(420px,100%),1fr))] mb-6">' +
        '<div class="bg-white rounded-3xl p-7 tarjeta-sombra">' +
        cardCab("Interacciones por semana",
          "Reacciones más comentarios de las piezas de cada semana") + gInt + "</div>" +
        (gVis ? '<div class="bg-white rounded-3xl p-7 tarjeta-sombra">' +
          cardCab("Vistas de video por semana",
            "Solo YouTube las reporta entre las redes del informe") + gVis + "</div>"
          : "") + "</div>" : "") +
      '<div class="bg-white rounded-3xl p-7 tarjeta-sombra">' +
      cardCab("Redes sociales", "Sin corte por país: una sola marca para GT y SV") +
      '<div class="divide-y divide-slate-50">' + redes + "</div></div>" +
      plegado("Lo que este bloque no puede decir",
        ((D.redes_sociales || {}).limites || []).concat(
          se ? [{ que: "qué mide cada punto", detalle: se._que_mide },
                { que: "por qué las líneas arrancan distinto",
                  detalle: se._por_que_arrancan_distinto }] : [])));
  }

  /* ── 3 · Competencia ─────────────────────────────────────────────────────── */
  function competencia() {
    var todas = marcas();
    var lista, explica, sub = "";
    if (V.grupo === "referentes") {
      lista = todas.filter(function (b) { return b.rol === "referente"; });
      explica = "Marcas que <b class=\"text-slate-600 font-semibold\">no disputan" +
        "</b> nuestros mercados. Se miran para aprender.";
    } else {
      lista = todas.filter(function (b) {
        return b.rol === "competidor" &&
          (b.categorias || []).indexOf(V.categoria) >= 0;
      });
      explica = "Marcas que pautan en nuestros mercados y disputan nuestro espacio.";
      sub = pastillas("categoria", [{ v: "software", n: "Software" },
                                    { v: "hardware", n: "Punto de venta" }],
                      V.categoria);
    }
    var faltan = sinMedir().filter(function (x) {
      return V.grupo === "referentes" ? x.rol === "referente" : x.rol === "competidor";
    });
    lista = lista.filter(function (b) {
      return coincide(b.nombre, (b.mensajes || []).map(function (m) {
        return m.titular; }).join(" "));
    });
    faltan = faltan.filter(function (x) { return coincide(x.nombre); });

    var tarjetas = lista.map(function (b) {
      var pres = Object.keys(b.mercados).sort().map(function (m) {
        var c = b.mercados[m];
        return '<div class="flex-1 min-w-[104px]">' +
          '<div class="text-[10.5px] font-bold tracking-wider text-slate-300 ' +
          'uppercase">' + esc(m) + "</div>" +
          '<div class="text-[26px] font-bold text-slate-800 tabular-nums ' +
          'leading-tight mt-0.5">' + ent(c.presion_real) + "</div>" +
          '<div class="text-[11px] text-slate-400 leading-tight">anuncios que ' +
          "disputan" + (c.activos_declarados !== c.presion_real
            ? "<br>de " + ent(c.activos_declarados) + " activos" : "") + "</div></div>";
      }).join("");

      var msgs = (b.mensajes || []).length
        ? recorta(b.mensajes, "msg-" + b.nombre, 3).map(function (m) {
            return fila(String(m.repeticiones), m.titular,
              pct(m.cuota) + " de su inventario", m.dias_vivo + " d", "vivo");
          }).join("")
        : '<p class="text-[12.5px] text-slate-400 leading-relaxed py-2">' +
          (!b.activos
            ? "<b class=\"text-slate-600 font-semibold\">No tiene anuncios activos" +
              "</b> en los mercados medidos, así que no hay mensaje que leer."
            : "<b class=\"text-slate-600 font-semibold\">No se guardó muestra de sus " +
              "anuncios.</b> Solo se midió cuántos tocan nuestra categoría sobre su " +
              "inventario completo.") + "</p>";

      var extra = [];
      Object.keys(b.mercados).forEach(function (m) {
        var c = b.mercados[m];
        if (c.lanzados_10d > 0) {
          extra.push(esc(m) + ": <b>" + c.lanzados_10d + "</b> anuncios lanzados en " +
            "los últimos 10 días" +
            (c.lanzados_3d ? " (" + c.lanzados_3d + " en los últimos 3)" : "") + ".");
        }
        if (c.plantillas_sin_renderizar > 0) {
          extra.push(esc(m) + ": <b>" + c.plantillas_sin_renderizar + "</b> anuncios " +
            "muestran una plantilla dinámica sin renderizar. Requiere revisión humana.");
        }
      });
      if (b.nota) extra.push(esc(b.nota));
      if (b.advertencia) extra.push(esc(b.advertencia));
      if (b.metodo) extra.push("Método: " + esc(b.metodo));

      var lg = logoDe(b.nombre), prof = profundoDe(b);
      return '<div class="bg-white rounded-3xl p-7 tarjeta-sombra">' +
        '<div class="flex items-start justify-between gap-3 mb-6">' +
        '<div class="flex items-center gap-3 min-w-0">' +
        (lg ? '<span class="w-11 h-11 rounded-2xl shrink-0 fila-logo grid ' +
              'place-items-center"><img src="' + esc(lg) + '" alt="' +
              esc(b.nombre) + '"></span>' : "") +
        '<h3 class="text-[17px] font-bold text-slate-800 tracking-[-0.01em] ' +
        'truncate">' + esc(b.nombre) + "</h3></div>" +
        '<div class="flex gap-1.5 flex-wrap justify-end">' +
        (b.categorias || []).map(function (c) {
          return '<span class="etiqueta-sec">' +
            esc(c === "hardware" ? "punto de venta" : c) + "</span>";
        }).join("") +
        (b.moneda ? '<span class="etiqueta-sec">' + esc(b.moneda) + "</span>" : "") +
        "</div></div>" +
        '<div class="flex gap-5 pb-6 mb-2 border-b border-slate-50">' + pres +
        "</div>" +
        '<div class="text-[10.5px] font-bold tracking-wider text-slate-300 ' +
        'uppercase mt-5 mb-1">Lo que repite</div>' +
        '<div class="divide-y divide-slate-50">' + msgs + "</div>" +
        /* El análisis profundo de esta marca, si la corrida lo trae. Una marca
           puede tener varias páginas y cada una es un perfil aparte: Square
           tiene la de EE.UU. y la de Reino Unido. */
        (prof.length
          ? '<div class="mt-6 pt-5 border-t border-slate-50">' +
            /* La FECHA de la consulta profunda va en el rótulo. La lectura
               básica y la profunda se corrieron días distintos, así que los
               activos declarados pueden diferir en una unidad o dos. Sin la
               fecha eso parece un error de conteo; con la fecha es lo que es:
               dos fotos de días distintos. */
            '<div class="text-[10.5px] font-bold tracking-wider text-slate-300 ' +
            'uppercase mb-4">Cómo apuesta' +
            ((reco() || {})._fecha_consulta
              ? ' · foto del ' + esc(reco()._fecha_consulta) : "") + "</div>" +
            prof.map(perfilProfundo).join(
              '<div class="h-px bg-slate-50 my-5"></div>') +
            (prof.some(function (x) { return x.mercado === "GLOBAL"; })
              ? '<p class="text-[11px] text-slate-400 leading-relaxed mt-4">' +
                "Estos porcentajes son sobre la consulta global; los de " +
                "«Lo que repite» son sobre el país. Dos universos distintos, " +
                "así que no tienen por qué coincidir.</p>"
              : "") + "</div>"
          : "") +
        (extra.length
          ? '<details class="mt-4 pt-4 border-t border-slate-50">' +
            '<summary class="text-[12px] font-semibold text-slate-400 ' +
            'cursor-pointer hover:text-slate-600">Cómo lee el análisis a esta ' +
            'marca</summary><ul class="mt-4 space-y-2.5 text-[12px] text-slate-500 ' +
            'leading-relaxed list-disc pl-5">' +
            extra.map(function (x) { return "<li>" + x + "</li>"; }).join("") +
            "</ul></details>"
          : "") +
        (b.url ? '<a href="' + esc(b.url) + '" target="_blank" ' +
          'rel="noopener noreferrer" class="enlace mt-5">' + svg(ico.link, "w-4 h-4") +
          "Ver sus anuncios reales</a>" : "") + "</div>";
    }).join("");

    var avisos = faltan.map(function (x) {
      var lgx = logoDe(x.nombre);
      return '<div class="bg-white rounded-3xl p-7 tarjeta-sombra ' +
        'ring-1 ring-amber-100">' +
        '<div class="flex items-center gap-3 mb-4">' +
        (lgx ? '<span class="w-11 h-11 rounded-2xl shrink-0 fila-logo grid ' +
               'place-items-center"><img src="' + esc(lgx) + '" alt="' +
               esc(x.nombre) + '"></span>' : "") +
        '<h3 class="text-[17px] font-bold text-slate-800">' + esc(x.nombre) +
        "</h3>" +
        '<span class="etiqueta-ambar">' + esc(x.estado) + "</span></div>" +
        '<p class="text-[13px] text-slate-500 leading-relaxed mb-4">' +
        "<b class=\"text-slate-700 font-semibold\">No se midió.</b> Que no aparezca " +
        "aquí no significa que no anuncie: significa que no lo pudimos preguntar.</p>" +
        (x.por_que_falta ? '<p class="text-[12px] text-slate-400 leading-relaxed ' +
          'mb-4">' + esc(x.por_que_falta) + "</p>" : "") +
        (x.como_obtenerlo ? '<div class="bg-emerald-50 rounded-2xl p-4 text-[12px] ' +
          'text-emerald-700 leading-relaxed"><b>Cómo desbloquearlo:</b> ' +
          esc(x.como_obtenerlo) + "</div>" : "") + "</div>";
    }).join("");

    return seccion("competencia", "Ad Library", "Competencia", explica,
      pastillas("grupo", [{ v: "competencia", n: "Competencia" },
                          { v: "referentes", n: "Referentes" }], V.grupo),
      (sub ? '<div class="mb-6">' + sub + "</div>" : "") +
      nota("<b class=\"text-slate-700 font-semibold\">Lo de abajo no es un ranking " +
        "de efectividad.</b> La Ad Library no publica rendimiento de anunciantes " +
        "comerciales: no hay impresiones, ni gasto, ni conversiones. Lo que sí se " +
        "ve es en qué apuestan — cuánto repiten un mensaje y cuánto lo dejan vivo.") +
      '<div class="grid gap-6 mt-6 [grid-template-columns:repeat(auto-fill,minmax(min(400px,100%),1fr))]">' +
      (tarjetas + avisos ||
        '<div class="bg-white rounded-3xl p-7 tarjeta-sombra text-[13px] ' +
        'text-slate-400">' + (buscando()
          ? "Ninguna marca de este grupo coincide con la búsqueda."
          : "Ninguna marca en este grupo con los filtros de arriba.") +
        "</div>") + "</div>" +
      plegado("Cómo leer estos números", [
        "<b class=\"text-slate-700 font-semibold\">Es una foto, no una serie.</b> " +
        "La Ad Library no acepta rango de fechas: solo responde qué está activo " +
        "ahora. Por eso una corrida retroactiva no puede incluir competencia.",
        "<b class=\"text-slate-700 font-semibold\">Volumen no es presión.</b> Banco " +
        "Industrial tiene 845 anuncios activos en GT y solo 2 tocan pagos. Sumar " +
        "los 845 inflaría la presión competitiva 21 veces.",
        "<b class=\"text-slate-700 font-semibold\">Solo se midieron las marcas del " +
        "registro.</b> Un competidor que nadie agregó no aparece, y su ausencia " +
        "aquí no es evidencia de nada.",
      ]));
  }

  /* ── 4 · Referencias ─────────────────────────────────────────────────────── */
  function referencias() {
    var R = D.referencias;
    if (!R) return seccion("referencias", "Contraste", "Referencias", "", "",
      nota("Sin datos de referencias en esta corrida."));

    var filasC = (R.contraste || []).map(function (f) {
      return '<div class="py-5">' +
        '<div class="text-[13.5px] font-semibold text-slate-700 mb-3">' +
        esc(f.dimension) + "</div>" +
        '<div class="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(180px,100%),1fr))] mb-3">' +
        [["QPayPro", f.qpaypro], ["Competencia", f.competencia],
         ["Referentes", f.referentes]].map(function (par) {
          return "<div><div class=\"text-[10.5px] font-bold tracking-wider " +
            'text-slate-300 uppercase mb-1">' + esc(par[0]) + "</div>" +
            '<div class="text-[12.5px] text-slate-600 leading-snug">' +
            esc(par[1]) + "</div></div>";
        }).join("") + "</div>" +
        '<p class="text-[11.5px] text-slate-400 leading-relaxed">' +
        esc(f.lectura) + "</p></div>";
    }).join("");

    var t = R.territorios || {};
    var terr = (t.saturados || []).map(function (s) {
      return '<div class="bg-white rounded-3xl p-7 tarjeta-sombra">' +
        '<div class="etiqueta-rojo mb-4">Territorio ocupado</div>' +
        '<h3 class="text-[17px] font-bold text-slate-800 leading-snug mb-3">«' +
        esc(s.mensaje) + "»</h3>" +
        '<p class="text-[13px] text-slate-500 leading-relaxed mb-4">' +
        esc(s.lectura) + "</p>" +
        '<div class="text-[11.5px] text-slate-400">' + esc(s.de) + " · " +
        esc(s.mercado) + " · " + s.repeticiones + " anuncios · " + s.dias_vivo +
        " días vivo</div></div>";
    }).concat((t.libres || []).map(function (l) {
      return '<div class="bg-white rounded-3xl p-7 tarjeta-sombra">' +
        '<div class="etiqueta-verde mb-4">Territorio sin disputa</div>' +
        '<h3 class="text-[17px] font-bold text-slate-800 mb-3">' + esc(l.mercado) +
        "</h3>" +
        '<p class="text-[13px] text-slate-500 leading-relaxed">' + esc(l.lectura) +
        "</p></div>";
    })).join("");

    /* ── Qué hacer con todo esto ──────────────────────────────────────────
       Es el puente entre «qué hacen ellos» y «qué producimos nosotros». Va en
       Referencias porque cruza las dos fuentes: lo que el competidor ocupa y lo
       que el referente hace y aquí nadie hace. */
    var RC = reco();
    var recs = RC ? (RC.recomendaciones || []).filter(function (x) {
      return coincide(x.titulo, x.que_hacer, x.porque);
    }) : [];
    var bloqueRecs = "";
    if (RC) {
      bloqueRecs =
        '<div class="flex items-start justify-between gap-4 mb-5">' +
        '<div><h3 class="text-[17px] font-bold text-slate-800">Qué hacer con ' +
        'esto</h3>' +
        '<p class="text-[12.5px] text-slate-400 mt-1.5 max-w-[64ch] ' +
        'leading-relaxed">Sale de cruzar lo que la competencia ocupa con lo que ' +
        "los referentes hacen y aquí nadie hace. Cada una trae su evidencia; " +
        "las que el dato no sostenía no aparecen.</p></div>" +
        (recs.length > 3
          ? '<button type="button" data-vertodo="recs" class="text-[12.5px] ' +
            'font-semibold shrink-0 hover:underline mt-1" ' +
            'style="color:var(--marca)">' +
            (V.verTodo.recs ? "Ver menos" : "Ver todo (" + recs.length + ")") +
            "</button>"
          : "") + "</div>" +
        nota("<b class=\"text-slate-700 font-semibold\">Esto no dice qué le " +
          "funcionó a la competencia.</b> " + esc(RC._limite || "")) +
        (recs.length
          ? '<div class="grid gap-6 mt-6 ' +
            '[grid-template-columns:repeat(auto-fill,minmax(min(330px,100%),1fr))]">' +
            recorta(recs, "recs").map(recomendacion).join("") + "</div>"
          : '<div class="bg-white rounded-3xl p-7 tarjeta-sombra text-[13px] ' +
            'text-slate-400 mt-6">' + (buscando()
              ? "Ninguna recomendación coincide con la búsqueda."
              : "El análisis no encontró ninguna señal que sostenga una " +
                "recomendación en esta corrida.") + "</div>") +
        '<div class="grid gap-6 mt-6 ' +
        '[grid-template-columns:repeat(auto-fill,minmax(min(340px,100%),1fr))]">' +
        comparativoProfundo() + sobrevivientesCard() + "</div>";
    }

    var bus = (R.busquedas || []);
    var busq = recorta(bus, "busq", 3).map(function (b) {
      return '<div class="bg-white rounded-3xl p-7 tarjeta-sombra">' +
        '<div class="flex gap-1.5 mb-4"><span class="etiqueta">' + esc(b.formato) +
        '</span><span class="etiqueta-gris">búsqueda sin curar</span></div>' +
        '<h3 class="text-[15px] font-bold text-slate-800 leading-snug mb-3">' +
        esc(b.tema) + "</h3>" +
        '<p class="text-[12px] text-slate-400 leading-relaxed mb-4">' +
        esc(b.motivo) + "</p>" +
        '<div class="bg-slate-50 rounded-2xl px-4 py-3 font-mono text-[11.5px] ' +
        'text-slate-500 leading-relaxed break-words">' + esc(b.consulta) + "</div>" +
        '<a href="' + esc(b.url) + '" target="_blank" rel="noopener noreferrer" ' +
        'class="enlace mt-4">' + svg(ico.link, "w-4 h-4") +
        "Abrir la búsqueda</a></div>";
    }).join("");

    return seccion("referencias", "Contraste", "Referencias",
      "Lo nuestro contra lo de ellos, y de ahí adónde ir a buscar cómo se ve.", "",
      '<div class="bg-white rounded-3xl p-7 tarjeta-sombra mb-6">' +
      cardCab("Nosotros contra ellos", "Solo se compara lo comparable") +
      '<div class="divide-y divide-slate-50">' + filasC + "</div></div>" +
      (bloqueRecs ? '<div class="mt-10">' + bloqueRecs + "</div>" : "") +
      (terr ? '<h3 class="text-[17px] font-bold text-slate-800 mb-5 mt-10">' +
        'Territorios de mensaje</h3>' +
        '<div class="grid gap-6 [grid-template-columns:repeat(auto-fill,minmax(min(340px,100%),1fr))] mb-6">' +
        terr + "</div>" : "") +
      '<div class="flex items-end justify-between gap-4 mb-5 mt-10">' +
      '<div><h3 class="text-[17px] font-bold text-slate-800">Dónde buscar ' +
      'referencia visual</h3>' +
      '<p class="text-[12.5px] text-slate-400 mt-1.5 max-w-[62ch] leading-relaxed">' +
      "Cada búsqueda sale de un dato de arriba. <b class=\"text-slate-600 " +
      "font-semibold\">Ningún pin fue visto ni verificado por el sistema</b>: son " +
      "búsquedas, no referencias curadas.</p></div>" +
      (bus.length > 3
        ? '<button type="button" data-vertodo="busq" class="text-[12.5px] ' +
          'font-semibold shrink-0 hover:underline" style="color:var(--marca)">' +
          (V.verTodo.busq ? "Ver menos" : "Ver todo (" + bus.length + ")") +
          "</button>"
        : "") + "</div>" +
      '<div class="grid gap-6 [grid-template-columns:repeat(auto-fill,minmax(min(300px,100%),1fr))]">' +
      busq + "</div>" +
      plegado("Lo que esta sección no puede dar", R.limites || []));
  }

  /* ── 5 · Estrategia ──────────────────────────────────────────────────────── */
  function selectorEstrategia() {
    var es = ((D.estrategia || {}).estrategias) || [];
    if (!es.length) return "";
    var act = estrategiaActiva();
    return '<div class="grid gap-6 [grid-template-columns:repeat(auto-fill,minmax(min(340px,100%),1fr))] mb-6">' +
      es.map(function (e) {
        var on = e.id === act.id;
        return '<div class="bg-white rounded-3xl p-7 flex flex-col ' +
          (on ? "tarjeta-elegida" : "tarjeta-sombra") + '">' +
          '<div class="flex items-center justify-between gap-3 mb-4">' +
          (e.recomendada ? '<span class="etiqueta-marca">Recomendada</span>'
                         : '<span class="etiqueta-gris">Alternativa</span>') +
          (on ? '<span class="inline-flex items-center gap-1.5 text-[11.5px] ' +
            'font-bold" style="color:var(--marca)">' + svg(ico.tic, "w-3.5 h-3.5") +
            "Elegida</span>" : "") + "</div>" +
          '<h3 class="text-[17px] font-bold text-slate-800 leading-snug mb-3">' +
          esc(e.nombre) + "</h3>" +
          '<p class="text-[13px] text-slate-500 leading-relaxed mb-5">' +
          esc(e.en_pocas_palabras) + "</p>" +
          '<details class="mb-5"><summary class="text-[12px] font-semibold ' +
          'text-slate-400 cursor-pointer hover:text-slate-600">Por qué, cuándo no, ' +
          'y la evidencia</summary>' +
          '<div class="mt-4 space-y-4">' +
          '<div><div class="micro-et">Por qué es buena idea</div>' +
          '<p class="text-[12.5px] text-slate-500 leading-relaxed">' +
          esc(e.por_que) + "</p></div>" +
          '<div><div class="micro-et">Cuándo NO conviene</div>' +
          '<p class="text-[12.5px] text-amber-700 leading-relaxed">' +
          esc(e.cuando_no_conviene) + "</p></div>" +
          (e._por_que_recomendada
            ? '<div><div class="micro-et">Por qué la recomienda el análisis</div>' +
              '<p class="text-[12.5px] text-slate-500 leading-relaxed">' +
              esc(e._por_que_recomendada) + "</p></div>" : "") +
          '<div><div class="micro-et">Evidencia</div><ul class="text-[12px] ' +
          'text-slate-500 leading-relaxed list-disc pl-5 space-y-1.5">' +
          (e.evidencia || []).map(function (x) {
            return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></div>" +
          "</div></details>" +
          '<div class="mt-auto pt-5 border-t border-slate-50 flex items-center ' +
          'justify-between gap-3">' +
          '<span class="text-[12px] text-slate-400">Activa ' + e.tareas.length +
          (e.tareas.length === 1 ? " tarea" : " tareas") + "</span>" +
          (on ? "" : '<button type="button" data-estrategia="' + esc(e.id) + '" ' +
            'class="btn-claro"' + (soloLectura ? " disabled" : "") +
            ">Usar esta</button>") + "</div></div>";
      }).join("") + "</div>";
  }

  function selectorResponsable(id, actual, asig) {
    if (!asig.habilitada) {
      return '<select disabled class="campo w-full max-w-[220px] opacity-50">' +
        "<option>Sin lista de personas</option></select>";
    }
    return '<select data-asignar="' + esc(id) + '" class="campo w-full ' +
      'max-w-[220px]"' + (soloLectura ? " disabled" : "") +
      '><option value="">Sin asignar</option>' +
      (asig.personas || []).map(function (p) {
        return '<option value="' + esc(p.id_sprint) + '"' +
          (actual === p.id_sprint ? " selected" : "") + ">" + esc(p.nombre) +
          "</option>";
      }).join("") + "</select>";
  }

  function tarjetaTarea(t, asig) {
    var d = E.decisiones[t.id], estado = d ? d.estado : null;
    var det = [];
    if (t.angulo) det.push(["Ángulo", esc(t.angulo)]);
    if (t.instruccion_exacta) det.push(["Instrucción exacta", esc(t.instruccion_exacta)]);
    if (t.tipo !== "pauta") {
      det.push(["Cuántas piezas", t.piezas != null
        ? "<b class=\"text-slate-700\">" + t.piezas + "</b> · " + esc(t.piezas_motivo)
        : "<b class=\"text-slate-700\">Lo decide la mesa.</b> " + esc(t.piezas_motivo)]);
    }
    if (t.copy) {
      det.push(["Copy", "<b class=\"text-slate-700\">" + esc(t.copy.estado) +
        ".</b> " + esc(t.copy.motivo) + '<ul class="list-disc pl-5 mt-2 space-y-1">' +
        (t.copy.falta || []).map(function (f) {
          return "<li>" + esc(f) + "</li>"; }).join("") + "</ul>"]);
    }
    if ((t.referencias || []).length) {
      det.push(["Referencia visual", (t.referencias).map(function (r) {
        return '<a href="' + esc(r.url) + '" target="_blank" ' +
          'rel="noopener noreferrer" class="etiqueta-marca mr-1.5 mb-1.5 ' +
          'inline-block hover:underline">' + esc(r.tema) + "</a>";
      }).join("")]);
    }
    if ((t.evidencia || []).length) {
      det.push(["Evidencia", '<ul class="list-disc pl-5 space-y-1.5">' +
        t.evidencia.map(function (e) {
          return "<li>" + esc(evidencia(e)) + "</li>"; }).join("") +
        "</ul>"]);
    }

    return '<div class="bg-white rounded-3xl p-7 flex flex-col ' +
      (estado === "aceptada" ? "tarjeta-aceptada"
        : estado === "rechazada" ? "tarjeta-sombra opacity-60" : "tarjeta-sombra") +
      '">' +
      '<div class="flex items-center gap-2 flex-wrap mb-4">' +
      '<span class="etiqueta-marca">' +
      esc(t.tipo === "pauta" ? "cambio en pauta" : t.tipo) + "</span>" +
      (t.requiere_humano ? '<span class="etiqueta-ambar">la aplica una persona' +
        "</span>" : "") +
      (estado ? '<span class="ml-auto ' +
        (estado === "aceptada" ? "etiqueta-verde" : "etiqueta-rojo") + '">' +
        (estado === "aceptada" ? "Aceptada" : "Rechazada") + "</span>" : "") +
      "</div>" +
      '<h3 class="text-[17px] font-bold text-slate-800 leading-snug mb-3">' +
      esc(t.titulo) + "</h3>" +
      '<p class="text-[13px] text-slate-500 leading-relaxed mb-4 max-w-[56ch]">' +
      esc(t.porque) + "</p>" +
      (t.no_decir ? '<div class="bg-rose-50 rounded-2xl px-4 py-3 text-[12.5px] ' +
        'text-rose-700 leading-relaxed mb-4"><b>No decir:</b> «' + esc(t.no_decir) +
        "» — ese terreno ya lo paga la competencia.</div>" : "") +
      (det.length
        ? '<details class="mb-5"><summary class="text-[12px] font-semibold ' +
          'text-slate-400 cursor-pointer hover:text-slate-600">Ver el detalle' +
          '</summary><div class="mt-4 space-y-4">' + det.map(function (p) {
            return '<div><div class="micro-et">' + esc(p[0]) + "</div>" +
              '<div class="text-[12.5px] text-slate-500 leading-relaxed">' + p[1] +
              "</div></div>";
          }).join("") + "</div></details>"
        : "") +
      '<div class="mt-auto pt-5 border-t border-slate-50 flex flex-wrap ' +
      'items-center gap-3 justify-between">' +
      '<div class="flex gap-2">' +
      '<button type="button" data-decidir="' + esc(t.id) + '" data-estado="aceptada" ' +
      'class="' + (estado === "aceptada" ? "btn-verde" : "btn-claro") + '"' +
      (soloLectura ? " disabled" : "") + ">" + svg(ico.tic, "w-4 h-4") +
      "Aceptar</button>" +
      '<button type="button" data-decidir="' + esc(t.id) + '" data-estado="rechazada" ' +
      'class="' + (estado === "rechazada" ? "btn-rojo" : "btn-claro") + '"' +
      (soloLectura ? " disabled" : "") + ">" + svg(ico.x, "w-4 h-4") +
      "Rechazar</button></div>" +
      (estado === "aceptada"
        ? selectorResponsable(t.id, d && d.responsable, asig) : "") +
      "</div></div>";
  }

  function tarjetaPropia(t, asig) {
    var estado = t.estado || "aceptada";
    return '<div class="bg-white rounded-3xl p-7 flex flex-col ' +
      (estado === "aceptada" ? "tarjeta-aceptada" : "tarjeta-sombra opacity-60") +
      '">' +
      '<div class="flex items-center gap-2 flex-wrap mb-4">' +
      '<span class="etiqueta-marca">' + esc(t.tipo) + "</span>" +
      '<span class="etiqueta-gris">idea del equipo</span>' +
      '<span class="ml-auto ' +
      (estado === "aceptada" ? "etiqueta-verde" : "etiqueta-rojo") + '">' +
      (estado === "aceptada" ? "Aceptada" : "Rechazada") + "</span></div>" +
      '<h3 class="text-[17px] font-bold text-slate-800 leading-snug mb-3">' +
      esc(t.titulo) + "</h3>" +
      (t.detalle ? '<p class="text-[13px] text-slate-500 leading-relaxed mb-4">' +
        esc(t.detalle) + "</p>" : "") +
      '<div class="bg-slate-50 rounded-2xl px-4 py-3 text-[12px] text-slate-500 ' +
      'leading-relaxed mb-4"><b class="text-slate-700">Sin evidencia del sistema.' +
      "</b> La propuso el equipo, no el análisis.</div>" +
      ((t.referencias || []).length
        ? '<div class="mb-4 flex flex-wrap gap-1.5">' + t.referencias.map(function (u) {
            return '<a href="' + esc(u) + '" target="_blank" ' +
              'rel="noopener noreferrer" class="etiqueta-marca hover:underline">' +
              esc(u.replace(/^https?:\/\//, "").slice(0, 40)) + "</a>";
          }).join("") + "</div>"
        : "") +
      '<div class="mt-auto pt-5 border-t border-slate-50 flex flex-wrap ' +
      'items-center gap-3 justify-between">' +
      '<div class="flex gap-2">' +
      '<button type="button" data-propia="' + esc(t.id) + '" data-estado="aceptada" ' +
      'class="' + (estado === "aceptada" ? "btn-verde" : "btn-claro") + '"' +
      (soloLectura ? " disabled" : "") + ">" + svg(ico.tic, "w-4 h-4") +
      "Aceptada</button>" +
      '<button type="button" data-propia="' + esc(t.id) + '" data-estado="rechazada" ' +
      'class="' + (estado === "rechazada" ? "btn-rojo" : "btn-claro") + '"' +
      (soloLectura ? " disabled" : "") + ">Rechazar</button>" +
      '<button type="button" data-borrar="' + esc(t.id) + '" class="btn-claro"' +
      (soloLectura ? " disabled" : "") + ">Quitar</button></div>" +
      (estado === "aceptada"
        ? '<select data-asignar-propia="' + esc(t.id) + '" class="campo w-full ' +
          'max-w-[220px]"' + (asig.habilitada && !soloLectura ? "" : " disabled") +
          '><option value="">' + (asig.habilitada ? "Sin asignar"
            : "Sin lista de personas") + "</option>" +
          (asig.personas || []).map(function (p) {
            return '<option value="' + esc(p.id_sprint) + '"' +
              (t.responsable === p.id_sprint ? " selected" : "") + ">" +
              esc(p.nombre) + "</option>";
          }).join("") + "</select>"
        : "") + "</div></div>";
  }

  function formNuevaTarea(asig) {
    return '<div class="bg-white rounded-3xl p-8 tarjeta-sombra">' +
      '<div class="flex items-center gap-3 flex-wrap mb-2">' +
      '<h3 class="text-[16px] font-bold text-slate-800">Agregar una idea del ' +
      'equipo</h3><span class="etiqueta-gris">entra directo a aceptadas</span></div>' +
      '<p class="text-[12.5px] text-slate-400 leading-relaxed mb-6 max-w-[70ch]">' +
      "Si a la mesa se le ocurre algo mejor que lo que propone el análisis, va " +
      "aquí. Queda marcada como idea del equipo: no trae evidencia del sistema, y " +
      "esa diferencia se conserva.</p>" +
      '<div class="grid gap-5 [grid-template-columns:repeat(auto-fill,minmax(min(240px,100%),1fr))]">' +
      '<label class="block [grid-column:1/-1]"><span class="micro-et">Qué hay que ' +
      'hacer</span><input type="text" id="npTitulo" maxlength="140" class="campo" ' +
      'placeholder="Ej. Video del POS en un negocio real de San Salvador"></label>' +
      '<label class="block [grid-column:1/-1]"><span class="micro-et">En qué ' +
      'consiste y por qué</span><textarea id="npDetalle" rows="3" maxlength="900" ' +
      'class="campo" placeholder="El ángulo, el público, qué debería mostrar…">' +
      "</textarea></label>" +
      '<div><span class="micro-et">Tipo de pieza</span>' +
      '<div class="inline-flex bg-slate-50 rounded-full p-1" id="npTipo">' +
      '<button type="button" data-nptipo="arte" class="np-tipo on">Arte</button>' +
      '<button type="button" data-nptipo="video" class="np-tipo">Video</button>' +
      "</div></div>" +
      (asig.habilitada
        ? '<label class="block"><span class="micro-et">Responsable</span>' +
          '<select id="npResp" class="campo"><option value="">Sin asignar</option>' +
          (asig.personas || []).map(function (p) {
            return '<option value="' + esc(p.id_sprint) + '">' + esc(p.nombre) +
              "</option>";
          }).join("") + "</select></label>"
        : "") +
      '<label class="block [grid-column:1/-1]"><span class="micro-et">Links o ' +
      'referencias (uno por línea)</span><textarea id="npRefs" rows="2" ' +
      'maxlength="900" class="campo" placeholder="https://…"></textarea></label>' +
      "</div>" +
      '<div class="mt-6 flex items-center gap-4 flex-wrap">' +
      '<button type="button" id="npAgregar" class="btn-oscuro"' +
      (soloLectura ? " disabled" : "") + ">Agregar a aceptadas</button>" +
      (soloLectura ? '<span class="text-[12px] text-slate-400">Esta vista es de ' +
        "solo lectura.</span>" : "") + "</div></div>";
  }

  function estrategia() {
    var est = D.estrategia;
    if (!est) return seccion("estrategia", "Para decidir", "Estrategia", "", "",
      nota("Sin propuesta de estrategia en esta corrida."));
    var asig = est.asignacion || {}, act = estrategiaActiva();
    var vis = tareasVisibles().filter(function (t) {
      return coincide(t.titulo, t.porque, t.angulo, t.instruccion_exacta);
    });
    var creativas = vis.filter(function (t) { return t.tipo !== "pauta"; });
    var pauta = vis.filter(function (t) { return t.tipo === "pauta"; });
    var propias = Object.keys(E.propias).map(function (k) { return E.propias[k]; })
      .filter(function (t) { return coincide(t.titulo, t.detalle); })
      .sort(function (a, b) { return (a.en || "") < (b.en || "") ? 1 : -1; });

    var G = '<div class="grid gap-6 [grid-template-columns:repeat(auto-fill,minmax(min(400px,100%),1fr))]">';

    return seccion("estrategia", "Para decidir", "Estrategia",
      "Primero la apuesta, después las tareas. El sistema propone la que su " +
      "premisa sostiene mejor; elegir es de la mesa.",
      '<div class="flex gap-2 flex-wrap">' +
      '<button type="button" id="bTodas" class="btn-oscuro"' +
      (soloLectura ? " disabled" : "") + ">Aceptar todas</button>" +
      '<button type="button" id="bNada" class="btn-claro"' +
      (soloLectura ? " disabled" : "") + ">Limpiar</button></div>",
      selectorEstrategia() +
      nota("<b class=\"text-slate-700 font-semibold\">Aceptar registra la decisión " +
        "aquí; las tareas se crean en Sprint en un segundo paso.</b> Esta página " +
        "vive en un navegador y no puede llamar a Zoho. Cuando terminen de decidir, " +
        "<b class=\"text-slate-700 font-semibold\">Copiar para Sprint</b> da un CSV " +
        "que se sube en <i>Configuración → Imports → Ítems de trabajo</i>. Zoho " +
        "mapea las siete columnas solo.") +
      '<h3 class="text-[17px] font-bold text-slate-800 mt-10 mb-1.5">' +
      "Producción creativa · " + creativas.length + "</h3>" +
      '<p class="text-[12.5px] text-slate-400 mb-6 max-w-[62ch] leading-relaxed">' +
      "Cada tarea sale de un dato medido y trae su evidencia." +
      (act ? " Estas son las que activa <b class=\"text-slate-600 font-semibold\">" +
        esc(act.nombre) + "</b>." : "") + "</p>" +
      (creativas.length
        ? G + creativas.map(function (t) { return tarjetaTarea(t, asig); }).join("") +
          "</div>"
        : nota(buscando()
            ? "Ninguna tarea de producción coincide con la búsqueda."
            : "Esta estrategia no activa tareas de producción en esta corrida.")) +
      '<h3 class="text-[17px] font-bold text-slate-800 mt-10 mb-1.5">' +
      "Ideas del equipo · " + propias.length + "</h3>" +
      '<p class="text-[12.5px] text-slate-400 mb-6">Lo que propone la mesa.</p>' +
      formNuevaTarea(asig) +
      (propias.length
        ? '<div class="mt-6">' + G +
          propias.map(function (t) { return tarjetaPropia(t, asig); }).join("") +
          "</div></div>"
        : "") +
      (pauta.length
        ? '<h3 class="text-[17px] font-bold text-slate-800 mt-10 mb-1.5">' +
          "Cambios en Meta Ads · " + pauta.length + "</h3>" +
          '<p class="text-[12.5px] text-slate-400 mb-6 max-w-[62ch] leading-relaxed">' +
          "<b class=\"text-slate-600 font-semibold\">El sistema no ejecuta " +
          "ninguno.</b> Meta Ads es de solo lectura, así que cada cambio sale " +
          "escrito para que una persona lo aplique.</p>" +
          G + pauta.map(function (t) { return tarjetaTarea(t, asig); }).join("") +
          "</div>"
        : "") +
      (!asig.habilitada
        ? '<div class="bg-white rounded-3xl p-7 tarjeta-sombra mt-6 ' +
          'ring-1 ring-amber-100">' +
          '<h3 class="text-[15px] font-bold text-slate-800 mb-3">La asignación a ' +
          'Sprint está apagada</h3>' +
          '<p class="text-[12.5px] text-slate-500 leading-relaxed mb-4">' +
          esc(asig.motivo_bloqueo || "") + "</p>" +
          (asig._como_desbloquear
            ? '<ol class="text-[12px] text-slate-500 leading-relaxed list-decimal ' +
              'pl-5 space-y-2">' + asig._como_desbloquear.map(function (p) {
                return "<li>" + esc(p) + "</li>"; }).join("") + "</ol>"
            : "") + "</div>"
        : "") +
      plegado("Los límites de esta sección", est.limites || []));
  }
  /* -- 6 · Pie: la trazabilidad ------------------------------------------- */

  /* No es decoracion. La definicion de terminado del proyecto exige que la
     salida sea trazable hasta las consultas de origen, y que los huecos se
     declaren en vez de rellenarse. Van al final porque no se leen primero,
     pero van. */
  function pie() {
    var c = D.corrida || {}, ig = D.integridad || {};
    var hu = D.huecos_declarados || [];
    var ex = ig.mercados_excluidos_con_gasto || {};
    var exl = Object.keys(ex).map(function (k) {
      return { que: k + " excluido", detalle: ex[k].motivo_de_exclusion,
               impacto: "Gasto detectado: " + dinero(ex[k].gasto) + " en " +
                        (ex[k].campanas || []).join(", ") + ".",
               remedio: ex[k].accion_pendiente };
    });

    return '<footer class="mt-4 mb-6">' +
      '<div class="bg-white rounded-3xl p-8 tarjeta-sombra">' +
      '<div class="grid gap-7 [grid-template-columns:repeat(auto-fill,minmax(min(200px,100%),1fr))]">' +
      [["Periodo leído", esc(c.rango || "—")],
       ["Consultado el", esc(c.hoy || "—")],
       ["Campañas leídas", ent(ig.campanas_leidas)],
       ["Redes en el informe", "Facebook · Instagram · YouTube"]].map(function (p) {
        return '<div><div class="micro-et">' + p[0] + "</div>" +
          '<div class="text-[13.5px] font-semibold text-slate-700">' + p[1] +
          "</div></div>";
      }).join("") + "</div>" +
      '<p class="text-[12px] text-slate-400 leading-relaxed mt-7 pt-6 ' +
      'border-t border-slate-50 max-w-[80ch]">' +
      "Todo número de esta página sale de una consulta a la API de Meta Ads, a la " +
      "Meta Ad Library o a Zoho Social en las fechas de arriba. " +
      "<b class=\"text-slate-600 font-semibold\">Donde no hubo dato no se puso un " +
      "cero</b>: se dice que falta y por qué. Un reporte con un número inventado " +
      "es peor que un reporte que no se generó.</p>" +
      plegado("Huecos declarados de la corrida", hu.concat(exl)) +
      "</footer>";
  }

  /* ============ pintado ============ */

  /* Que seccion resalta el rail. La calcula un IntersectionObserver, y se
     guarda fuera de V porque no es una preferencia que valga la pena
     persistir: es donde esta el scroll ahora mismo. */
  var seccionVisible = "resumen";
  var observador = null;

  /* Un <details> abierto es trabajo del lector: lo abrio para leer algo. Si un
     repintado lo cierra, la pagina le quita de las manos lo que estaba
     leyendo. Se identifican por el texto de su resumen mas su ordinal, no por
     indice global, para que agregar una tarjeta arriba no descoloque a las de
     abajo. */
  function estadoDetalles() {
    var m = {}, n = {};
    Array.prototype.forEach.call(
      document.querySelectorAll("#raiz details"), function (d) {
        var s = d.querySelector("summary");
        var k = (s ? s.textContent : "?").trim();
        n[k] = (n[k] || 0) + 1;
        m[k + " " + n[k]] = d.open;
      });
    return m;
  }
  function restauraDetalles(m) {
    var n = {};
    Array.prototype.forEach.call(
      document.querySelectorAll("#raiz details"), function (d) {
        var s = d.querySelector("summary");
        var k = (s ? s.textContent : "?").trim();
        n[k] = (n[k] || 0) + 1;
        var v = m[k + " " + n[k]];
        if (v !== undefined) d.open = v;
      });
  }

  function pintar(preservar) {
    var det = preservar ? estadoDetalles() : null;
    var y = preservar ? window.scrollY : 0;
    var act = document.activeElement;
    var idFoco = preservar && act && act.id ? act.id : null;
    var cursor = null;
    if (idFoco) { try { cursor = act.selectionStart; } catch (e) {} }

    raiz().innerHTML =
      rail() +
      '<main class="md:ml-[76px] pb-28 md:pb-0">' +
      '<div class="mx-auto w-full max-w-[1240px] px-5 sm:px-7 md:px-10 ' +
      'py-9 md:py-12">' +
      encabezado() + resumen() + rendimiento() + competencia() +
      referencias() + estrategia() + pie() +
      "</div></main>";

    if (det) restauraDetalles(det);
    conectarGraficos();
    observa();
    if (preservar) {
      window.scrollTo(0, y);
      if (idFoco) {
        var n = document.getElementById(idFoco);
        if (n && n.focus) {
          n.focus();
          if (cursor != null && n.setSelectionRange) {
            try { n.setSelectionRange(cursor, cursor); } catch (e) {}
          }
        }
      }
    }
  }

  function observa() {
    if (observador) observador.disconnect();
    if (typeof IntersectionObserver !== "function") return;
    observador = new IntersectionObserver(function (entradas) {
      var mejor = null;
      entradas.forEach(function (e) {
        if (e.isIntersecting &&
            (!mejor || e.intersectionRatio > mejor.intersectionRatio)) mejor = e;
      });
      if (!mejor) return;
      var id = mejor.target.id;
      if (id === seccionVisible) return;
      seccionVisible = id;
      /* Se reemplaza SOLO el rail. Repintar todo por un scroll cerraria los
         <details> abiertos y sacaria el foco del buscador en cada rueda del
         raton. */
      var viejo = document.querySelector("[data-rail-nav]");
      if (viejo) {
        var tmp = document.createElement("div");
        tmp.innerHTML = rail();
        viejo.parentNode.replaceChild(tmp.firstChild, viejo);
      }
    }, { rootMargin: "-45% 0px -45% 0px", threshold: [0, 0.01, 0.5] });
    SECCIONES.forEach(function (s) {
      var n = document.getElementById(s.id);
      if (n) observador.observe(n);
    });
  }

  /* ============ graficas: cruz y globo ============ */

  /* El globo se ancla en la esquina OPUESTA al cursor. Si va siempre al mismo
     lado, tapa justo el tramo de curva que la persona esta mirando. */
  function conectarGraficos() {
    Array.prototype.forEach.call(
      document.querySelectorAll("#raiz .graf"), function (g) {
        var cfg;
        try { cfg = JSON.parse(g.getAttribute("data-graf")); } catch (e) { return; }
        var id = g.id, G = cfg.geo, n = cfg.semanas.length;
        var caza = document.getElementById(id + "-caza");
        var cruz = document.getElementById(id + "-cruz");
        var tip = document.getElementById(id + "-tip");
        if (!caza || !cruz || !tip) return;
        var lienzo = g.querySelector("svg");

        function indice(clienteX) {
          var r = lienzo.getBoundingClientRect();
          if (!r.width || n === 1) return 0;
          var x = (clienteX - r.left) / r.width * G.w;
          var paso = (G.w - G.iz - G.de) / (n - 1);
          var i = Math.round((x - G.iz) / paso);
          return Math.max(0, Math.min(n - 1, i));
        }

        function muestra(ev) {
          var i = indice(ev.clientX);
          var paso = n === 1 ? 0 : (G.w - G.iz - G.de) / (n - 1);
          var xs = G.iz + i * paso;
          cruz.setAttribute("x1", xs); cruz.setAttribute("x2", xs);
          cruz.style.opacity = "1";

          var lineas = cfg.series.map(function (s) {
            var v = s.v[i];
            return '<div class="flex items-center gap-2.5 mt-1.5">' +
              '<i class="w-2 h-2 rounded-full shrink-0" style="background:' +
              s.c + '"></i><span class="text-slate-400">' + esc(s.n) +
              '</span><b class="ml-auto tabular-nums text-slate-800">' +
              (v == null ? "sin muestra" : ent(v)) + "</b></div>";
          }).join("");
          tip.innerHTML = '<div class="font-bold text-slate-800">' +
            esc(cfg.semanas[i]) + "</div>" + lineas;

          var r = lienzo.getBoundingClientRect();
          var rel = r.width ? (ev.clientX - r.left) / r.width : 0;
          tip.style.left = rel > 0.5 ? "10px" : "auto";
          tip.style.right = rel > 0.5 ? "auto" : "10px";
          tip.style.opacity = "1";
        }
        function oculta() { cruz.style.opacity = "0"; tip.style.opacity = "0"; }

        caza.addEventListener("mousemove", muestra);
        caza.addEventListener("mouseleave", oculta);
        caza.addEventListener("touchstart", function (ev) {
          if (ev.touches[0]) muestra(ev.touches[0]);
        }, { passive: true });
        caza.addEventListener("touchmove", function (ev) {
          if (ev.touches[0]) muestra(ev.touches[0]);
        }, { passive: true });
        caza.addEventListener("touchend", oculta);
      });
  }

  /* ============ busqueda ============ */

  /* Filtra las tres listas largas: campanas, marcas y tareas. Un buscador que
     no busca seria adorno, y la barra de arriba es demasiado prominente para
     ser adorno. */
  function coincide() {
    var q = (V.busqueda || "").trim().toLowerCase();
    if (!q) return true;
    var s = Array.prototype.slice.call(arguments)
      .filter(function (x) { return x != null; }).join(" ").toLowerCase();
    return q.split(/\s+/).every(function (t) { return s.indexOf(t) >= 0; });
  }
  function buscando() { return (V.busqueda || "").trim().length > 0; }

  /* ============ eventos ============ */

  var SELECTOR_CLIC = "[data-vertodo],[data-mercado],[data-grupo]," +
    "[data-categoria],[data-estrategia],[data-decidir],[data-propia]," +
    "[data-borrar],[data-nptipo],#bCsv,#bDecisiones,#bTodas,#bNada," +
    "#npAgregar,#limpiarBusqueda";

  function conectar() {
    var r = raiz();

    r.addEventListener("click", function (ev) {
      if (!ev.target.closest) return;

      /* Navegacion interna primero: el rail y el «Ir a decidir» son anclas. */
      var a = ev.target.closest("a[href^='#']");
      if (a) {
        var idA = (a.getAttribute("href") || "").replace(/^#/, "");
        var nA = idA && document.getElementById(idA);
        if (nA) {
          ev.preventDefault();
          nA.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
      }

      var t = ev.target.closest(SELECTOR_CLIC);
      if (!t) return;
      var d = t.dataset || {};

      if (d.vertodo) {
        V.verTodo[d.vertodo] = !V.verTodo[d.vertodo];
        guardarVista(); pintar(true); return;
      }
      if (d.mercado) { V.mercado = d.mercado; guardarVista(); pintar(true); return; }
      if (d.grupo) { V.grupo = d.grupo; guardarVista(); pintar(true); return; }
      if (d.categoria) {
        V.categoria = d.categoria; guardarVista(); pintar(true); return;
      }
      if (d.nptipo) {
        Array.prototype.forEach.call(
          r.querySelectorAll("#npTipo .np-tipo"), function (b) {
            b.classList.toggle("on", b.dataset.nptipo === d.nptipo);
          });
        return;
      }
      if (t.id === "limpiarBusqueda") {
        V.busqueda = ""; guardarVista(); pintar(true); return;
      }
      if (t.id === "bCsv") { copiarCsv(); return; }
      if (t.id === "bDecisiones") { copiarDecisiones(); return; }

      if (soloLectura) { avisar("Esta vista es de solo lectura"); return; }

      if (t.id === "npAgregar") { nuevaTarea(); return; }
      if (d.estrategia) {
        E.estrategia = d.estrategia;
        var e = (((D.estrategia || {}).estrategias) || []).filter(function (x) {
          return x.id === d.estrategia;
        })[0];
        persistir(e ? "Estrategia: " + e.nombre : "Estrategia cambiada");
        return;
      }
      if (d.decidir) { decidir(d.decidir, d.estado); return; }
      if (d.propia) {
        var p = E.propias[d.propia];
        if (p) {
          p.estado = d.estado;
          persistir(d.estado === "aceptada" ? "Idea aceptada" : "Idea rechazada");
        }
        return;
      }
      if (d.borrar) {
        if (E.propias[d.borrar]) {
          delete E.propias[d.borrar]; persistir("Idea quitada");
        }
        return;
      }
      if (t.id === "bTodas") {
        tareasVisibles().forEach(function (x) {
          var prev = E.decisiones[x.id];
          E.decisiones[x.id] = { estado: "aceptada",
                                 responsable: (prev && prev.responsable) || null,
                                 en: new Date().toISOString() };
        });
        persistir("Todas aceptadas"); return;
      }
      if (t.id === "bNada") {
        E.decisiones = {}; persistir("Decisiones limpiadas"); return;
      }
    });

    r.addEventListener("change", function (ev) {
      var s = ev.target;
      if (!s.dataset) return;
      if (s.dataset.asignar) { asignar(s.dataset.asignar, s.value || null); return; }
      if (s.dataset.asignarPropia) {
        var p = E.propias[s.dataset.asignarPropia];
        if (p) {
          p.responsable = s.value || null;
          persistir(s.value ? "Responsable asignado" : "Sin asignar");
        }
      }
    });

    /* El buscador se repinta con retardo: repintar en cada tecla haria perder
       el ritmo de escritura en una pagina con seis secciones. */
    var reloj = null;
    r.addEventListener("input", function (ev) {
      if (ev.target.id !== "buscar") return;
      V.busqueda = ev.target.value;
      clearTimeout(reloj);
      reloj = setTimeout(function () { guardarVista(); pintar(true); }, 260);
    });
    r.addEventListener("keydown", function (ev) {
      if (ev.target.id !== "buscar") return;
      if (ev.key === "Escape") {
        clearTimeout(reloj);
        V.busqueda = ""; ev.target.value = ""; guardarVista(); pintar(true);
      }
    });
  }

  function montaToast() {
    if (document.getElementById("toast")) return;
    var t = document.createElement("div");
    t.id = "toast";
    t.setAttribute("role", "status");
    t.setAttribute("aria-live", "polite");
    document.body.appendChild(t);
  }
  /* ============ salida hacia Sprint ============ */

  function csvEscapa(v) {
    v = String(v == null ? "" : v);
    return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }

  /* Las columnas y su orden son los que el asistente de importacion de Zoho
     Sprints mapea solo, verificado en la corrida del 2026-08-28. Cambiar el
     orden obliga a mapear a mano campo por campo. */
  var COLUMNAS_CSV = ["Item Name", "Description", "Item Type", "Priority",
                      "Assignee", "Status", "Tags"];

  /* La marca de idempotencia, dentro del nombre.

     Sprints no expone webhooks ni un campo de clave externa, asi que el nombre
     es el unico lugar donde puede viajar algo que permita reconocer un item ya
     creado. Sin ella, importar el CSV de dos semanas que comparten una tarea la
     crea dos veces — y ya paso: los items 1140 a 1142 del backlog de «Diseno y
     MK» entraron sin marca. Es fea a proposito: tiene que ser improbable de
     escribir a mano.

     Si falta la clave se avisa en lugar de inventarse una: una marca distinta
     cada vez seria peor que ninguna, porque parecerian items nuevos. */
  function marcado(titulo, clave) {
    return clave ? titulo + " [MC:" + clave + "]" : titulo;
  }

  function filasParaSprint() {
    var est = D.estrategia || {}, act = estrategiaActiva();
    var filas = [];
    (est.tareas || []).forEach(function (t) {
      if (!t.siempre && act && (t.estrategias || []).indexOf(act.id) < 0) return;
      var d = E.decisiones[t.id];
      if (!d || d.estado !== "aceptada") return;
      var cuerpo = [t.porque];
      if (t.angulo) cuerpo.push("\nANGULO: " + t.angulo);
      if (t.no_decir) cuerpo.push("\nNO DECIR: «" + t.no_decir +
        "» — ese terreno ya lo paga la competencia.");
      if (t.instruccion_exacta) cuerpo.push("\nINSTRUCCION: " + t.instruccion_exacta);
      if ((t.evidencia || []).length) {
        cuerpo.push("\nEVIDENCIA:\n" + t.evidencia.map(function (e) {
          return "  - " + evidencia(e); }).join("\n"));
      }
      if (t.copy) cuerpo.push("\nCopy: " + t.copy.estado + " — " + t.copy.motivo);
      cuerpo.push("\nMesa Creativa · corrida " + ((D.corrida || {}).rango || ""));
      filas.push([marcado(t.titulo, t.idempotencia), cuerpo.join("\n"), "Task",
                  "Medium", d.responsable || "", "Open",
                  "mesa-creativa," + t.tipo]);
    });
    Object.keys(E.propias).forEach(function (k) {
      var t = E.propias[k];
      if (t.estado !== "aceptada") return;
      var cuerpo = [t.detalle || ""];
      cuerpo.push("\nORIGEN: idea del equipo. NO tiene evidencia del sistema; " +
        "la propuso una persona en la mesa.");
      if ((t.referencias || []).length) {
        cuerpo.push("\nREFERENCIAS:\n" + t.referencias.map(function (u) {
          return "  - " + u; }).join("\n"));
      }
      filas.push([marcado(t.titulo, "equipo::" + t.id), cuerpo.join("\n"), "Task",
                  "Medium", t.responsable || "", "Open",
                  "mesa-creativa," + t.tipo]);
    });
    return filas;
  }

  /* Se copia al portapapeles en vez de descargar un archivo: el visor de
     artefactos bloquea toda descarga que inicie la propia pagina. Un boton de
     descarga aqui no daria error, simplemente no haria nada. */
  function copiarCsv() {
    var filas = filasParaSprint();
    if (!filas.length) { avisar("No hay ninguna tarea aceptada todavía"); return; }
    var txt = [COLUMNAS_CSV].concat(filas).map(function (f) {
      return f.map(csvEscapa).join(",");
    }).join("\r\n");
    copiar(txt, filas.length + " tarea(s) copiadas · pégalas en un archivo .csv " +
      "y súbelo en Sprints → Configuración → Imports → Ítems de trabajo");
  }

  function copiarDecisiones() {
    var act = estrategiaActiva();
    var payload = {
      _para: "python -m modulo1.sprint --corrida <carpeta> --decisiones <este archivo>",
      _corrida: (D.corrida || {}).rango || null,
      _copiado: new Date().toISOString(),
      estrategia: act ? act.id : null,
      decisiones: E.decisiones,
      propias: E.propias,
    };
    var n = Object.keys(E.decisiones).length + Object.keys(E.propias).length;
    copiar(JSON.stringify(payload, null, 2), n
      ? "Decisiones copiadas · " + n + " en total. Pégalas en un .json"
      : "No hay ninguna decisión todavía; se copió la plantilla vacía");
  }

  function copiar(txt, exito) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(
        function () { avisar(exito); },
        function () { avisar("El navegador no dejó copiar al portapapeles"); });
      return;
    }
    avisar("Este navegador no expone el portapapeles");
  }

  /* ============ decisiones ============ */

  function nuevaTarea() {
    if (soloLectura) return;
    var campo = document.getElementById("npTitulo");
    var tit = ((campo && campo.value) || "").trim();
    if (!tit) {
      avisar("Falta escribir qué hay que hacer");
      if (campo) campo.focus();
      return;
    }
    var det = ((document.getElementById("npDetalle") || {}).value || "").trim();
    var elegido = document.querySelector("#npTipo .np-tipo.on");
    var tipo = elegido ? elegido.dataset.nptipo : "arte";
    var resp = (document.getElementById("npResp") || {}).value || null;
    /* Solo se guardan enlaces que de verdad lo son. Un texto pegado que no es
       una URL se convertiria en un enlace roto, y esta pagina existe para no
       poner delante del equipo cosas que no se pueden verificar. */
    var crudo = (document.getElementById("npRefs") || {}).value || "";
    var lineas = crudo.split(/\r?\n/).map(function (x) { return x.trim(); })
      .filter(function (x) { return x; });
    var refs = lineas.filter(function (x) { return /^https?:\/\/\S+$/i.test(x); });

    var id = "propia-" + Date.now().toString(36) +
      Math.random().toString(36).slice(2, 6);
    E.propias[id] = {
      id: id, titulo: tit, detalle: det, tipo: tipo,
      referencias: refs, responsable: resp,
      estado: "aceptada", en: new Date().toISOString(),
    };
    persistir(lineas.length > refs.length
      ? "Idea agregada · " + (lineas.length - refs.length) +
        " línea(s) de referencia no eran un enlace y no se guardaron"
      : "Idea agregada a aceptadas");
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

  /* OJO: aqui SI va un documento completo, con doctype. Es el otro contrato
     -- el archivo que se publica es un fragmento, este no. */
  function documento() {
    var j = function (o) {
      return JSON.stringify(o).replace(/<\/script/gi, "<\\/script");
    };
    return "<!doctype html>\n<html lang=\"es\">\n<head>\n" + P.head +
      "\n</head>\n<body>\n<div id=\"raiz\"></div>\n" +
      '<script id="datos" type="application/json">' + j(D) + "<\/script>\n" +
      '<script id="estado" type="application/json">' + j(E) + "<\/script>\n" +
      '<script id="plantilla" type="application/json">' + j(P) + "<\/script>\n" +
      "<script>" + P.app + "<\/script>\n</body>\n</html>";
  }

  /* ============ utilidades del DOM ============ */

  function raiz() {
    var r = document.getElementById("raiz");
    if (!r) {
      r = document.createElement("div");
      r.id = "raiz";
      document.body.appendChild(r);
    }
    return r;
  }

  function avisar(txt) {
    var t = document.getElementById("toast");
    if (!t) return;
    t.textContent = txt;
    t.classList.add("ver");
    clearTimeout(avisar._t);
    avisar._t = setTimeout(function () { t.classList.remove("ver"); }, 2800);
  }

  /* ============ arranque ============ */

  montaToast();
  conectar();
  pintar();

  try {
    Object.defineProperty(window, "__tablero", {
      value: Object.freeze({ documento: documento }),
      writable: false, configurable: false, enumerable: false
    });
  } catch (e) { /* entorno que no lo permite: la pagina funciona igual */ }

  /* Sin la capacidad `artifact` la pagina sigue siendo util para leer, pero no
     puede guardar decisiones. Se dice, no se finge. */
  if (window.claude && typeof window.claude.use === "function") {
    window.claude.use("artifact").then(function (a) {
      if (!a) { soloLectura = true; pintar(true); return; }
      api = a;
    }).catch(function () { soloLectura = true; pintar(true); });
  } else { soloLectura = true; pintar(true); }
})();
