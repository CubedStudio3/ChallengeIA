#!/usr/bin/env python3
"""
Aplica el logo del imán a una fuente del artefacto «Ciclo del Lead».

POR QUE ES UN SCRIPT Y NO UN PARCHE A MANO
Hay otra sesión publicando sobre el mismo artefacto cada pocos minutos. Cada
vez que su versión gana la carrera hay que rehacer la fusión sobre la nueva
base; a mano eso se equivoca. Esto lo repite igual siempre y falla ruidoso si
un anclaje ya no existe.

  python3 aplica_logo.py <fuente.html> <logo.svg>

El logo es un REDIBUJO en SVG: los adjuntos de la conversación no aterrizan en
el disco de la sesión, así que no hay archivo original que incrustar.
"""
import re, sys

fuente, logo_svg = sys.argv[1], sys.argv[2]
s = open(fuente, encoding="utf-8").read()
logo = open(logo_svg, encoding="utf-8").read()

if 'id="logo-iman"' in s:
    print("ya tiene el logo; no se toca"); sys.exit(0)

def rep(viejo, nuevo, veces=1):
    global s
    n = s.count(viejo)
    if n != veces:
        sys.exit(f"ANCLAJE PERDIDO ({n} != {veces}): {viejo[:70]!r}")
    s = s.replace(viejo, nuevo)

# 1 · el símbolo, definido una sola vez
rep('<div class="app">',
    '<!-- El logo del imán. Redibujo en SVG: los adjuntos de la conversación no\n'
    '     aterrizan en el disco de la sesión, así que no hay archivo original que\n'
    '     incrustar. Para poner el oficial, reemplazar este símbolo. -->\n'
    '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>'
    + logo + '</defs></svg>\n<div class="app">')

# 2 · la marca del riel
m = re.search(r'<span class="marca".*?</span>', s, re.S)
if not m:
    sys.exit("ANCLAJE PERDIDO: no se encontró <span class=\"marca\"> en el riel")
s = s[:m.start()] + ('<span class="marca"><svg viewBox="0 0 64 64" role="img" '
                     'aria-label="QPayPro · Ciclo del Lead"><use href="#logo-iman"/></svg></span>') + s[m.end():]

# 3 · junto al título
m = re.search(r'<header class="cabecera">\s*(?:<div[^>]*>\s*)?<h1>([^<]*)</h1>', s)
if not m:
    sys.exit("ANCLAJE PERDIDO: no se encontró el <h1> de la cabecera")
rep(m.group(0),
    '<header class="cabecera"><div class="titulo-con-logo">'
    '<span class="logo-marca" aria-hidden="true"><svg viewBox="0 0 64 64"><use href="#logo-iman"/></svg></span>'
    '<h1>' + m.group(1) + '</h1></div>')

# 4 · CSS: se editan las reglas existentes, no se apilan overrides
i, j = s.index("<style>") + len("<style>"), s.index("</style>")
c = s[i:j]

def repc(viejo, nuevo, veces=1):
    global c
    n = c.count(viejo)
    if n != veces:
        sys.exit(f"ANCLAJE CSS PERDIDO ({n} != {veces}): {viejo[:70]!r}")
    c = c.replace(viejo, nuevo)

# la baldosa pasa a blanca: el imán es negro y sobre la salvia no se lee
c = re.sub(r'(\.riel \.marca\{[^}]*?)background:var\(--salvia\)', r'\1background:var(--sup)', c, count=1)
if "background:var(--sup)" not in c:
    sys.exit("ANCLAJE CSS PERDIDO: fondo de .riel .marca")
repc('.riel .marca svg{width:22px;height:22px}', '.riel .marca svg{width:34px;height:34px}')
repc('.riel .marca{margin-bottom:0;margin-right:10px;width:36px;height:36px;border-radius:12px}',
     '.riel .marca{margin-bottom:0;margin-right:10px;width:36px;height:36px;border-radius:12px}\n'
     '  .riel .marca svg{width:29px;height:29px}')
repc('.cabecera h1{margin-top:10px}',
     '.cabecera h1{margin-top:10px}\n'
     '.titulo-con-logo{display:flex;align-items:center;gap:15px}\n'
     '.logo-marca{flex:none;display:block}\n'
     '.logo-marca svg{display:block;width:clamp(44px,5.4vw,58px);height:clamp(44px,5.4vw,58px)}')

s = s[:i] + c + s[j:]
open(fuente, "w", encoding="utf-8").write(s)
print(f"logo aplicado a {fuente} · {len(s)} bytes")
