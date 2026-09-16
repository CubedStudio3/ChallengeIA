"""Todos los valores distintos que la API devolvió en los veinte crudos.

Existe porque `tablero_app.js` tiene un PUERTO de `parsea_numero()`: el botón de
«Actualizar ahora» recibe la respuesta de Meta en el navegador y tiene que
interpretarla igual que Python. Dos copias de la misma regla es exactamente lo
que este proyecto ya vio divergir en silencio.

La lista NO se escribe a mano: sale de los crudos en disco, que son nueve meses
de formatos reales —`$1.234,56 USD`, `Not available`, enteros pelados—. Si
mañana aparece un formato nuevo, entra solo.

Uso:  PYTHONPATH=src python3 pruebas/valores_reales.py
Salida: JSON con {valor: numero|null} según Python, para que la prueba en
navegador compare contra lo mismo.
"""

from __future__ import annotations

import glob
import json
import sys
from pathlib import Path

sys.path.insert(0, "src")
from base.normaliza import parsea_numero  # noqa: E402

CRUDOS = ["data/historico/pauta_meses/*/crudo/*.json",
          "data/historico/dia_en_curso/crudo/*.json",
          "data/historico/*/crudo/meta_campanas_por_pais*.json"]


def valores() -> list[str]:
    vistos: set[str] = set()
    for patron in CRUDOS:
        for ruta in glob.glob(patron):
            try:
                doc = json.loads(Path(ruta).read_text(encoding="utf-8"))
            except Exception:                                    # noqa: BLE001
                continue
            filas = doc.get("ad_entities")
            if isinstance(filas, str):
                filas = json.loads(filas)
            for f in filas or []:
                for campo in ("amount_spent", "impressions"):
                    if campo in f:
                        vistos.add(str(f[campo]))
                cpr = (f.get("cost_per_result") or {}).get("value")
                if cpr is not None:
                    vistos.add(str(cpr))
                res = f.get("results") or {}
                if res.get("value") is not None:
                    vistos.add(str(res["value"]))
                for v in res.get("values") or []:
                    if v.get("value") is not None:
                        vistos.add(str(v["value"]))
    return sorted(vistos)


if __name__ == "__main__":
    out = {}
    for v in valores():
        out[v] = parsea_numero(v, etiqueta="x").numero
    json.dump(out, sys.stdout, ensure_ascii=False)
