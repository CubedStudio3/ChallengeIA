# -*- coding: utf-8 -*-
"""Arma las tres páginas de medición: cada sección en un marco de su ancho
y de su alto declarado. Medir dentro del marco real es lo único que vale
cuando el alto de la sección depende del alto del marco."""
import io, os, re, sys

raiz, tmp = sys.argv[1], sys.argv[2]
s = io.open(os.path.join(raiz, "catalogo-secciones.html"), encoding="utf-8").read()
fichas = re.findall(
    r'\{ id:"([^"]+)", n:(\d+), cat:"[^"]+",.*?alto:(\d+), altoTableta:(\d+), altoMovil:(\d+),',
    s, re.S)
if not fichas:
    sys.exit("No se reconoció ninguna ficha en el catálogo.")

for ident, n, _a, _t, _m in fichas:
    cuerpo = io.open(os.path.join(raiz, "secciones", "%02d-%s.html" % (int(n), ident)),
                     encoding="utf-8").read()
    io.open(os.path.join(tmp, ident + ".html"), "w", encoding="utf-8").write(
        '<!doctype html><html lang=es><head><meta charset=utf-8>'
        # Sin barra de desplazamiento: si el marco se queda corto, la barra
        # le quita ancho a la página, el contenido se estira y la medida sale
        # más alta — y a la ronda siguiente sobra alto, no hay barra, y la
        # medida baja. Así los números nunca se quedaban quietos.
        '<style>html,body{margin:0}html{scrollbar-width:none}'
        'html::-webkit-scrollbar{display:none}</style></head><body>'
        + cuerpo + '</body></html>')

MEDIDOR = """
<script>
setTimeout(function(){
  var sal = [];
  document.querySelectorAll("iframe[data-sec]").forEach(function(f){
    var d = f.contentDocument;
    /* El alto de la SECCIÓN, no el del documento: `scrollHeight` del
       documento nunca baja del alto del marco, así que medirlo hacía
       crecer el número 8 px por ronda sin llegar nunca a un punto fijo. */
    var sec = d && d.body.firstElementChild;
    sal.push(f.dataset.sec + "=" + (sec ? Math.ceil(sec.getBoundingClientRect().height) : -1));
  });
  document.title = sal.join("|");
}, 3500);
</script>
"""

for idx, ancho in ((1, 1280), (2, 768), (3, 390)):
    partes = ['<!doctype html><html><head><meta charset=utf-8>'
              '<style>html,body{margin:0}iframe{border:0;display:block}</style></head><body>']
    for ident, _n, a, t, m in fichas:
        alto = (a, t, m)[idx - 1]
        partes.append('<iframe data-sec="%s" src="%s.html" style="width:%dpx;height:%spx"></iframe>'
                      % (ident, ident, ancho, alto))
    partes.append(MEDIDOR)
    partes.append('</body></html>')
    io.open(os.path.join(tmp, "p%d.html" % idx), "w", encoding="utf-8").write("".join(partes))
