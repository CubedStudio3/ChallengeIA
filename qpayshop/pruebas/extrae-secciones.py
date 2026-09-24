# -*- coding: utf-8 -*-
"""Escribe secciones/NN-id.html desde las <template> del catálogo.

El catálogo es la ÚNICA fuente: el mismo texto alimenta la vista previa,
el panel de copiar y estos archivos. Escribir un archivo a mano crearía
una segunda copia que se queda vieja en silencio — ya pasó en este
proyecto con esperados de prueba fuera del repositorio.

    python3 pruebas/extrae-secciones.py
"""
import io, os, re, sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAT = os.path.join(RAIZ, "catalogo-secciones.html")
DIR = os.path.join(RAIZ, "secciones")

s_cat = s = io.open(CAT, encoding="utf-8").read()

fichas = re.findall(r'\{ id:"([^"]+)", n:(\d+), cat:"([^"]+)"', s)
if not fichas:
    sys.exit("No se encontró ninguna ficha en el catálogo.")

plantillas = dict(re.findall(
    r'<template id="tpl-([^"]+)">\n(.*?)\n</template>', s, re.S))

escritos, esperados = set(), set()
for ident, n, _cat in fichas:
    if ident not in plantillas:
        sys.exit("La ficha %s no tiene <template>." % ident)
    nombre = "%02d-%s.html" % (int(n), ident)
    esperados.add(nombre)
    cuerpo = plantillas[ident].strip() + "\n"
    io.open(os.path.join(DIR, nombre), "w", encoding="utf-8").write(cuerpo)
    escritos.add(nombre)

# Un archivo que ya no corresponde a ninguna ficha se queda estorbando y
# se ve igual de válido que los demás: se declara en vez de ignorarlo.
sobran = sorted(set(os.listdir(DIR)) - esperados)
if sobran:
    print("Sobran en secciones/ (ninguna ficha los nombra): %s" % ", ".join(sobran))

# La tabla del LEEME también sale de acá. Escrita a mano se quedó diciendo
# "48 secciones" con 63 en el catálogo, que es el error que este proyecto
# lleva anotado tres veces: todo número visible se deriva del dato.
TITULO_CAT = {"hero": "Hero", "productos": "Productos", "carruseles": "Carrusel",
              "banners": "Banner", "contenido": "Contenido", "carrito": "Carrito y pago",
              "estados": "Estados", "estructura": "Estructura"}
paras = dict(re.findall(r'\{ id:"([^"]+)",.*?para:"([^"]*)"', s_cat, re.S))

filas = ["| # | Archivo | Tipo | Para qué |", "|---|---|---|---|"]
for ident, n, cat in fichas:
    para = paras.get(ident, "").replace("|", "·")
    filas.append("| %02d | `secciones/%02d-%s.html` | %s | %s |"
                 % (int(n), int(n), ident, TITULO_CAT.get(cat, cat), para))

LEEME = os.path.join(RAIZ, "LEEME.md")
t = io.open(LEEME, encoding="utf-8").read()
a, b = "<!-- TABLA · la escribe pruebas/extrae-secciones.py, no se edita a mano -->", "<!-- /TABLA -->"
if a in t and b in t:
    t = t[:t.index(a) + len(a)] + "\n" + "\n".join(filas) + "\n" + t[t.index(b):]
t = re.sub(r"(<!-- CUENTA -->Biblioteca de \*\*)\d+( secciones\*\*)",
           r"\g<1>%d\g<2>" % len(fichas), t)
io.open(LEEME, "w", encoding="utf-8").write(t)

print("%d secciones escritas en secciones/ · LEEME al día" % len(escritos))
