#!/usr/bin/env bash
# Mide el alto de cada sección DENTRO del marco en el que se va a ver, y
# repite hasta que el número deja de moverse.
#
# No basta medirla una vez en un marco cualquiera: una sección con el alto
# en `vh` cambia de tamaño con el marco que la contiene, así que la medida
# y el marco se persiguen. Se itera hasta el punto fijo. `hero-inmersivo`
# quedó cortada 92 px por medirla una sola vez, y después con 108 px en
# blanco por medirla en un marco más alto del que iba a tener.
#
# El piso de 608 px es el alto del escenario de la vista previa: una barra
# de 60 px no deja media pantalla vacía.
#
#   bash qpayshop/pruebas/mide-altos.sh
set -euo pipefail
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
CHROME="${CHROME:-/opt/pw-browsers/chromium-1194/chrome-linux/chrome}"
trap 'rm -rf "$TMP"' EXIT

for RONDA in 1 2 3 4 5 6; do
  python3 "$RAIZ/pruebas/_arma_marcos.py" "$RAIZ" "$TMP"
  for IDX in 1 2 3; do
    "$CHROME" --headless=new --disable-gpu --no-sandbox --allow-file-access-from-files \
      --virtual-time-budget=12000 --window-size=1500,1300 --dump-dom "file://$TMP/p$IDX.html" 2>/dev/null \
      | grep -o '<title>[^<]*</title>' | head -1 | sed 's|</\?title>||g' > "$TMP/m$IDX.txt"
  done
  salida=$(python3 "$RAIZ/pruebas/_escribe_altos.py" "$TMP/m1.txt" "$TMP/m2.txt" "$TMP/m3.txt")
  echo "ronda $RONDA · $salida"
  case "$salida" in *"0 altos actualizados"*) echo "✓ altos estables"; exit 0;; esac
done
echo "✗ los altos no se estabilizaron en 6 rondas"; exit 1
