#!/usr/bin/env bash
# La vista previa no corta ni deja hueco: cada sección se pinta en un marco
# del alto que el catálogo declara y se compara con lo que ocupa de verdad.
# Se revisan las dos direcciones — cortar esconde contenido, sobrar deja una
# franja en blanco que se lee como un defecto de la sección.
#
#   bash qpayshop/pruebas/revisa-altos.sh
set -euo pipefail
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
CHROME="${CHROME:-/opt/pw-browsers/chromium-1194/chrome-linux/chrome}"
trap 'rm -rf "$TMP"' EXIT
HOLGURA=8   # la misma que escribe mide-altos.sh

python3 "$RAIZ/pruebas/_arma_marcos.py" "$RAIZ" "$TMP"
malo=0
for COL in 1:1280 2:768 3:390; do
  IDX="${COL%%:*}"; W="${COL##*:}"
  r=$("$CHROME" --headless=new --disable-gpu --no-sandbox --allow-file-access-from-files \
      --virtual-time-budget=12000 --window-size=1500,1300 --dump-dom "file://$TMP/p$IDX.html" 2>/dev/null \
      | grep -o '<title>[^<]*</title>' | head -1 | sed 's|</\?title>||g')
  echo "$r" > "$TMP/m$IDX.txt"
  echo "=== $W px ==="
  python3 - "$RAIZ" "$TMP/m$IDX.txt" "$IDX" "$HOLGURA" <<'PY' || malo=1
import io, os, re, sys
raiz, medida, idx, holgura = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
s = io.open(os.path.join(raiz, "catalogo-secciones.html"), encoding="utf-8").read()
declarado = {i: (int(a), int(t), int(m))[idx-1] for i, _n, a, t, m in re.findall(
    r'\{ id:"([^"]+)", n:(\d+), cat:"[^"]+",.*?alto:(\d+), altoTableta:(\d+), altoMovil:(\d+),', s, re.S)}
txt = io.open(medida, encoding="utf-8").read().strip()
if "=" not in txt:
    sys.exit("La medición salió vacía: el navegador no llegó a escribirla.")
malas = []
for par in txt.split("|"):
    ident, alto = par.rsplit("=", 1)
    alto = int(alto)
    if ident not in declarado:
        malas.append("%s no está en el catálogo" % ident); continue
    d = declarado[ident]
    if alto < 0: malas.append("%s no cargó" % ident)
    elif alto > d: malas.append("%s corta %d px" % (ident, alto - d))
    elif d > alto + holgura: malas.append("%s sobra %d px" % (ident, d - alto - holgura))
print("\n".join(malas) if malas else "SIN CORTES NI HUECOS")
sys.exit(1 if malas else 0)
PY
done
n=$(ls "$RAIZ"/secciones/*.html | wc -l)
if [ $malo -eq 0 ]; then echo "✓ las $n secciones encajan en su marco a los tres anchos"
else echo "✗ hay secciones cortadas o con hueco"; exit 1; fi
