# -*- coding: utf-8 -*-
"""Escribe en el catálogo los altos que midió mide-altos.sh."""
import io, os, re, sys

# Sin piso: el marco se ajusta a la sección. Hubo uno de 608 px para que una
# barra de 60 px no dejara media pantalla en blanco, pero con la columna ancha
# el remedio era peor — la sección quedaba perdida dentro de un marco vacío.
PISO = 0
AIRE = 8     # holgura: un redondeo de menos deja una franja cortada

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAT = os.path.join(RAIZ, "catalogo-secciones.html")


def lee(ruta):
    txt = io.open(ruta, encoding="utf-8").read().strip()
    if not txt or "=" not in txt:
        sys.exit("Medición vacía en %s: el navegador no llegó a escribirla." % ruta)
    d = {}
    for par in txt.split("|"):
        if "=" not in par:
            continue
        ident, alto = par.rsplit("=", 1)
        if int(alto) < 0:
            sys.exit("El marco de %s no cargó." % ident)
        d[ident] = int(alto)
    return d


escritorio, tableta, movil = (lee(r) for r in sys.argv[1:4])
s = io.open(CAT, encoding="utf-8").read()
cambios = 0
movidas = []


def ajusta(m):
    global cambios
    ident = m.group(1)
    for d in (escritorio, tableta, movil):
        if ident not in d:
            sys.exit("Falta la medida de %s." % ident)
    def v(d):
        return max(PISO, d[ident] + AIRE)
    nuevo = '{ id:"%s", n:%s, cat:"%s"%salto:%d, altoTableta:%d, altoMovil:%d,' % (
        ident, m.group(2), m.group(3), m.group(4),
        v(escritorio), v(tableta), v(movil))
    if nuevo != m.group(0):
        cambios += 1
        movidas.append(ident)
    return nuevo


s, n = re.subn(
    r'\{ id:"([^"]+)", n:(\d+), cat:"([^"]+)"(.*?)alto:\d+, altoTableta:\d+, altoMovil:\d+,',
    ajusta, s, flags=re.S)
if n == 0:
    sys.exit("No se reconoció ninguna ficha: el formato del catálogo cambió.")
io.open(CAT, "w", encoding="utf-8").write(s)
print("%d fichas revisadas · %d altos actualizados%s" % (n, cambios, (" · " + ", ".join(movidas)) if movidas and len(movidas) <= 20 else ""))
