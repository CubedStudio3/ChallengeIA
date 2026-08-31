/* Reporte de la Ad Library · comportamiento.
 *
 * El reporte se lee, no se opera, así que aquí hay muy poco a propósito: solo
 * lo que un documento largo necesita para no perder al lector.
 *
 * 1. El rail marca en qué dossier va el scroll.
 * 2. Las barras crecen desde cero al entrar en pantalla, una vez. No es adorno:
 *    con quince barras estáticas la vista no sabe dónde empezar a leer, y el
 *    crecimiento ordena la entrada. Se respeta `prefers-reduced-motion`.
 *
 * Todo el contenido ya viene renderizado en el HTML: si este script no corre,
 * el reporte se lee completo. Eso es deliberado — es un documento, no una app.
 */
(function () {
  "use strict";

  var quieto = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ── 1 · El rail sigue al scroll ──────────────────────────────────────── */

  var enlaces = Array.prototype.slice.call(
    document.querySelectorAll(".rail-b[href^='#']"));
  var secciones = enlaces
    .map(function (a) {
      return { a: a, n: document.getElementById(a.getAttribute("href").slice(1)) };
    })
    .filter(function (x) { return x.n; });

  function marca(id) {
    secciones.forEach(function (s) {
      s.a.classList.toggle("activo", s.n.id === id);
    });
  }

  if (typeof IntersectionObserver === "function" && secciones.length) {
    var obs = new IntersectionObserver(function (entradas) {
      var mejor = null;
      entradas.forEach(function (e) {
        if (e.isIntersecting &&
            (!mejor || e.intersectionRatio > mejor.intersectionRatio)) mejor = e;
      });
      if (mejor) marca(mejor.target.id);
    }, { rootMargin: "-40% 0px -55% 0px", threshold: [0, 0.01, 0.3] });
    secciones.forEach(function (s) { obs.observe(s.n); });
  }

  /* En móvil el rail es horizontal: cuando el dossier activo queda fuera de
     vista, se lo trae. Sin esto el indicador existe pero no se ve. */
  var rail = document.querySelector(".rail");
  if (rail) {
    var traer = function () {
      var act = rail.querySelector(".rail-b.activo");
      if (!act || rail.scrollWidth <= rail.clientWidth) return;
      var r = act.getBoundingClientRect(), rr = rail.getBoundingClientRect();
      if (r.left < rr.left || r.right > rr.right) {
        rail.scrollTo({ left: act.offsetLeft - rail.clientWidth / 2 + r.width / 2,
                        behavior: quieto ? "auto" : "smooth" });
      }
    };
    var reloj = null;
    document.addEventListener("scroll", function () {
      clearTimeout(reloj);
      reloj = setTimeout(traer, 140);
    }, { passive: true });
  }

  /* ── 2 · Las barras crecen al entrar ──────────────────────────────────── */

  var barras = Array.prototype.slice.call(document.querySelectorAll(".barra-marca"));
  if (!barras.length) return;

  if (quieto || typeof IntersectionObserver !== "function") {
    return; /* ya están en su ancho final: el HTML lo trae puesto */
  }

  /* Se guarda el ancho final y se parte de cero. Si algo falla a partir de
     aquí, la barra queda en su ancho real, no en cero: el ancho se restituye
     en el mismo cuadro en que se observa. */
  var finales = barras.map(function (b) { return b.style.width; });
  barras.forEach(function (b) { b.style.width = "0%"; });

  var ob = new IntersectionObserver(function (entradas) {
    entradas.forEach(function (e) {
      if (!e.isIntersecting) return;
      var i = barras.indexOf(e.target);
      if (i < 0) return;
      e.target.style.width = finales[i];
      ob.unobserve(e.target);
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });

  barras.forEach(function (b) { ob.observe(b); });

  /* Red de seguridad: si el observador no dispara en dos segundos —pestaña en
     segundo plano, por ejemplo— se restituyen todos los anchos. Un reporte con
     las barras en cero sería peor que un reporte sin animación. */
  setTimeout(function () {
    barras.forEach(function (b, i) {
      if (b.style.width === "0%") b.style.width = finales[i];
    });
  }, 2000);
})();
