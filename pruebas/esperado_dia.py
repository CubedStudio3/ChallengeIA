"""El bloque del día en curso, armado por Python, para comparar contra el navegador.

Existe porque el botón «Actualizar ahora» interpreta la respuesta de Meta EN LA
PÁGINA: hay una segunda copia de `dia_en_curso.arma()` escrita en JavaScript. La
única forma honesta de saber que no divergieron es preguntarle a Python en el
momento, no copiar un esperado a mano — eso ya caducó dos veces acá.

Uso:  PYTHONPATH=src python3 pruebas/esperado_dia.py [fecha]
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, "src")
from modulo1 import dia_en_curso as DHOY      # noqa: E402
from modulo1 import pauta_historica as PHIST  # noqa: E402
from modulo1.corre import _mercados           # noqa: E402

CORRIDA = Path("data/historico/2026-09-04_25ago_a_03sep/analisis/resultado.json")

if __name__ == "__main__":
    hoy = sys.argv[1] if len(sys.argv) > 1 else None
    declarados, excluidos = _mercados()

    # Las piezas salen del resultado ya publicado: son las mismas que el
    # navegador tiene en `#datos`, así que el «día típico» se calcula sobre el
    # mismo universo en los dos lados.
    piezas = json.loads(CORRIDA.read_text(encoding="utf-8"))["pauta_diaria"]["piezas"]

    b = DHOY.arma(piezas=piezas, hoy=hoy or "1970-01-01",
                  declarados=declarados, excluidos=excluidos)
    if b is None:
        print(json.dumps({"por_mercado": {}, "fuera_de_mercado": {}}))
        sys.exit(0)
    json.dump({k: v for k, v in b.items() if not k.startswith("_")},
              sys.stdout, ensure_ascii=False)
