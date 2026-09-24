# -*- coding: utf-8 -*-
"""Dos revisiones de CSS que ninguna mirada a la pantalla encuentra.

1 · Ninguna clase puede significar dos cosas en dos secciones distintas.

IT pega varias secciones en la misma plantilla: si dos usan la misma clase
sin apellido, la segunda le cambia la maquetación a la primera y no hay
ningún error. Pasó de verdad — `producto-agotado` nació con el prefijo de
`productos-alternos` y le comió 136 px de alto a una sección ya terminada.

Una clase compartida SÍ vale si siempre va pegada a otra que la ata a su
sección (`.qs-cr-hoja.qs-activa`): ahí no hay forma de que alcance a otra.

    python3 pruebas/revisa-clases.py
"""
import collections, glob, io, os, re, sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
donde = collections.defaultdict(set)
sola = set()

for f in sorted(glob.glob(os.path.join(RAIZ, "secciones", "*.html"))):
    s = io.open(f, encoding="utf-8").read()
    nombre = os.path.basename(f)
    for c in set(re.findall(r'\.(qs-[a-z0-9-]+)', s)):
        donde[c].add(nombre)
    # ¿aparece alguna vez como selector suelto, sin otra clase pegada?
    for m in re.finditer(r'(?<![\w.-])\.(qs-[a-z0-9-]+)(?![\w-])', s):
        if s[m.end():m.end() + 1] != ".":
            sola.add(m.group(1))

choques = sorted((c, v) for c, v in donde.items() if len(v) > 1 and c in sola)
for c, v in choques:
    print("✗ .%s la usan %s" % (c, ", ".join(sorted(v))))

# 2 · Un elemento que el JS oculta con `hidden` tiene que poder ocultarse: una
# clase con `display:` le gana al `hidden` del navegador y el elemento se queda
# a la vista sin ningún error. La fila del descuento de `cupon-totales` mostró
# «− Q 0.00» en verde durante toda su primera versión por esto.
tercos = []
for f in sorted(glob.glob(os.path.join(RAIZ, "secciones", "*.html"))):
    s = io.open(f, encoding="utf-8").read()
    if not re.search(r'\.hidden\s*=', s):
        continue
    clases = set()
    for m in re.finditer(r'<[a-z0-9]+[^>]*>', s):
        if re.search(r'(?<![-\w])hidden(?=[\s/>])', m.group(0)):
            for c in re.findall(r'class="([^"]+)"', m.group(0)):
                clases.update(c.split())
    for c in sorted(clases):
        pone = re.search(r'\.' + re.escape(c) + r'(?![\w-])[^{,]*\{[^}]*display:', s)
        rescate = re.search(r'\.' + re.escape(c) + r'\[hidden\]', s)
        if pone and not rescate:
            tercos.append("✗ .%s en %s lleva display: y se oculta con hidden, sin .%s[hidden]{display:none}"
                          % (c, os.path.basename(f), c))
for t in tercos:
    print(t)

cuantas = len(glob.glob(os.path.join(RAIZ, "secciones", "*.html")))
if choques or tercos:
    sys.exit("\n%d clase(s) sueltas compartidas · %d elemento(s) que no se dejan ocultar."
             % (len(choques), len(tercos)))
print("✓ ninguna clase suelta se repite entre las %d secciones" % cuantas)
print("✓ todo lo que el JS oculta con hidden se puede ocultar")
