<script>
/* Contraste medido EN EL NAVEGADOR, no deducido de los hexadecimales del
   bloque EDITA AQUÍ. La primera versión de esta prueba comparaba contra la
   variable que parecía el fondo y daba tres avisos, dos falsos: el texto no
   siempre vive sobre la superficie que uno supone.
   Lo que no se puede medir —texto sobre foto o sobre degradado— NO se
   aprueba en silencio: sale declarado aparte. */
setTimeout(function(){
  /* `color-mix()` no se devuelve como rgb(): sale `color(srgb .89 .91 .93)`,
     con los canales de 0 a 1. Leerlos como si fueran de 0 a 255 daba casi
     negro y tres avisos falsos en la tabla comparativa. */
  function rgb(t){
    var m = t.match(/[\d.]+/g); if (!m) return null;
    var k = /^color\(/.test(t) ? 255 : 1;
    return { r:+m[0]*k, g:+m[1]*k, b:+m[2]*k, a: m.length > 3 ? +m[3] : 1 };
  }
  // ¿hay algo pintado entre este texto y el fondo que encontramos arriba?
  // Una foto o un velo puestos con position:absolute no son ancestros suyos,
  // así que el recorrido hacia arriba los salta y mide contra la superficie
  // equivocada. Ahí no se aprueba: se declara como no medible.
  function tapadoPor(el, padre, caja){
    for (var i = 0; i < padre.children.length; i++) {
      var ch = padre.children[i];
      if (ch === el || ch.contains(el)) continue;
      var cs = getComputedStyle(ch);
      var pinta = cs.backgroundImage !== "none" ||
                  (rgb(cs.backgroundColor) || {a:0}).a > 0 ||
                  /^(img|svg|video|picture)$/i.test(ch.tagName);
      if (!pinta) continue;
      var a = ch.getBoundingClientRect(), b = caja;
      if (a.left <= b.left && a.top <= b.top && a.right >= b.right && a.bottom >= b.bottom) return true;
    }
    return false;
  }
  function sobre(f, d){           // f sobre d, con la alfa de f
    return { r: f.r*f.a + d.r*(1-f.a), g: f.g*f.a + d.g*(1-f.a), b: f.b*f.a + d.b*(1-f.a), a:1 };
  }
  function lum(c){
    var v = [c.r, c.g, c.b].map(function(x){
      x /= 255; return x <= .03928 ? x/12.92 : Math.pow((x+.055)/1.055, 2.4);
    });
    return .2126*v[0] + .7152*v[1] + .0722*v[2];
  }
  function razon(a, b){
    var la = lum(a), lb = lum(b);
    return (Math.max(la,lb) + .05) / (Math.min(la,lb) + .05);
  }
  var bajos = [], nomedibles = [];
  document.querySelectorAll("[data-sec]").forEach(function(caja){
    var sec = caja.getAttribute("data-sec");
    var vistos = {};
    caja.querySelectorAll("*").forEach(function(el){
      var texto = "";
      for (var k = 0; k < el.childNodes.length; k++)
        if (el.childNodes[k].nodeType === 3) texto += el.childNodes[k].nodeValue;
      texto = texto.replace(/\s+/g, " ").trim();
      if (!texto) return;
      var s = getComputedStyle(el);
      if (s.display === "none" || s.visibility === "hidden") return;
      var r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;

      // Alfa acumulada de los `opacity` del camino, que también apaga el texto.
      var alfa = 1, fondo = null, imagen = false, capas = [];
      for (var p = el; p && p !== document.documentElement; p = p.parentElement) {
        var ps = getComputedStyle(p);
        alfa *= parseFloat(ps.opacity);
        if (!fondo) {
          if (ps.backgroundImage !== "none") { imagen = true; break; }
          if (p !== el && tapadoPor(el, p, r)) { imagen = true; break; }
          var c = rgb(ps.backgroundColor);
          if (c && c.a === 1) fondo = c;
          else if (c && c.a > 0) capas.push(c);   // se apila y se resuelve al llegar a lo opaco
        }
      }
      // Un chip con fondo translúcido sobre otra superficie SÍ se puede medir:
      // se componen las capas de abajo hacia arriba. Saltárselas daba por
      // ilegible un rótulo que en pantalla se lee bien.
      if (fondo) for (var q = capas.length - 1; q >= 0; q--) fondo = sobre(capas[q], fondo);
      if (imagen) { if (!vistos["img"]) { vistos["img"] = 1; nomedibles.push(sec + " sobre imagen o degradado"); } return; }
      if (!fondo) return;

      var col = rgb(s.color); if (!col) return;
      col.a *= alfa;
      var px = parseFloat(s.fontSize), peso = parseInt(s.fontWeight, 10) || 400;
      var grande = px >= 24 || (px >= 18.66 && peso >= 700);
      var piso = grande ? 3 : 4.5;
      var v = razon(sobre(col, fondo), fondo);
      if (v < piso) {
        var clave = sec + "|" + el.className;
        if (vistos[clave]) return; vistos[clave] = 1;
        bajos.push(sec + " · " + (el.className || el.tagName.toLowerCase()) + " " +
                   v.toFixed(2) + ":1 (pide " + piso + ") «" + texto.slice(0, 28) + "»");
      }
    });
  });
  var sal = bajos.length ? bajos : ["SIN BAJOS"];
  if (nomedibles.length) sal = sal.concat(["— no medibles: " + nomedibles.length + " secciones con texto sobre foto o degradado"]);
  document.title = sal.join("|");
}, 3000);
</script>
