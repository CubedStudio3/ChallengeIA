#!/usr/bin/env bash
# Revisa las 36 secciones a tres anchos y reporta solo defectos REALES:
#   · elementos que desbordan a lo ancho sin que ningún ancestro los recorte
#   · elementos posicionados que TAPAN texto que se pinta debajo de ellos
# No cuenta el interior de un <svg> con slice (se recorta a propósito), ni los
# carruseles horizontales, ni lo que está oculto. Ese afinado costó dos vueltas:
# la primera versión daba 17 avisos y 15 eran falsos.
#
#   bash qpayshop/pruebas/revisa-secciones.sh
set -euo pipefail
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
CHROME="${CHROME:-/opt/pw-browsers/chromium-1194/chrome-linux/chrome}"
cp "$RAIZ/pruebas/_armado.html" "$TMP/todas.html"
{ printf '<!doctype html><html lang=es><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><style>body{margin:0}</style></head><body>'
  for f in "$RAIZ"/secciones/*.html; do printf '<div data-sec="%s">' "$(basename "$f" .html)"; cat "$f"; printf '</div>'; done
  sed -n '/<script>/,$p' "$RAIZ/pruebas/_armado.html"
} > "$TMP/todas.html"
malo=0
for W in 1280 768 390; do
  # el ancho real se fuerza con un iframe: el navegador sin ventana no baja de 485 px
  cat > "$TMP/m.html" <<EOF
<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0}iframe{width:${W}px;height:1200px;border:0;display:block}</style></head>
<body><iframe id=f src="todas.html"></iframe>
<script>setTimeout(function(){try{document.title=document.getElementById('f').contentDocument.title||'VACIO'}catch(e){document.title='BLOQ '+e.message}},7000)</script></body></html>
EOF
  r=$("$CHROME" --headless=new --disable-gpu --no-sandbox --allow-file-access-from-files \
      --virtual-time-budget=15000 --window-size=1500,1300 --dump-dom "file://$TMP/m.html" 2>/dev/null \
      | grep -o '<title>[^<]*</title>' | head -1 | sed 's|</\?title>||g')
  echo "=== $W px ==="; echo "$r" | tr '|' '\n' | grep -v '^ *$'
  echo "$r" | grep -q 'SIN DEFECTOS' || malo=1
done
rm -rf "$TMP"
[ $malo -eq 0 ] && echo "✓ las 36 secciones limpias a los tres anchos" || { echo "✗ hay defectos"; exit 1; }
