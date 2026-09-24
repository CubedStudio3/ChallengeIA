#!/usr/bin/env bash
# Contraste de texto sobre su fondo REAL, medido en el navegador.
# Pisos WCAG AA: 4.5:1 normal, 3:1 en texto grande o en negrita grande.
#
#   bash qpayshop/pruebas/revisa-contraste.sh
set -euo pipefail
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
CHROME="${CHROME:-/opt/pw-browsers/chromium-1194/chrome-linux/chrome}"
{ printf '<!doctype html><html lang=es><head><meta charset=utf-8><style>body{margin:0}</style></head><body>'
  for f in "$RAIZ"/secciones/*.html; do printf '<div data-sec="%s">' "$(basename "$f" .html)"; cat "$f"; printf '</div>'; done
  cat "$RAIZ/pruebas/_contraste.js"
  printf '</body></html>'
} > "$TMP/todas.html"
cat > "$TMP/m.html" <<EOF
<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0}iframe{width:1280px;height:1200px;border:0;display:block}</style></head>
<body><iframe id=f src="todas.html"></iframe>
<script>setTimeout(function(){try{document.title=document.getElementById('f').contentDocument.title||'VACIO'}catch(e){document.title='BLOQ '+e.message}},7000)</script></body></html>
EOF
r=$("$CHROME" --headless=new --disable-gpu --no-sandbox --allow-file-access-from-files \
    --virtual-time-budget=15000 --window-size=1500,1300 --dump-dom "file://$TMP/m.html" 2>/dev/null \
    | grep -o '<title>[^<]*</title>' | head -1 | sed 's|</\?title>||g')
rm -rf "$TMP"
echo "$r" | tr '|' '\n' | sed 's/&amp;/\&/g; s/&lt;/</g; s/&gt;/>/g; s/&#39;/'"'"'/g'
echo "$r" | grep -q 'SIN BAJOS' || { echo "✗ hay texto por debajo del piso"; exit 1; }
echo "✓ contraste en regla"
