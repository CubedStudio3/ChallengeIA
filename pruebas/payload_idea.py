"""El payload que Python arma para una idea del equipo, por stdin/stdout.

Existe para que `prueba:boton` compare el payload que manda el tablero con el
que arma `sprint.plan()` DE VERDAD, llamando a este modulo, y no contra un
texto copiado a mano en la prueba. Ya paso dos veces en este proyecto que un
esperado escrito aparte caduco en silencio y despues acuso al producto; y la
idea del equipo es el unico caso donde el payload lo arma el navegador, asi que
es justo donde hace falta un esperado que no pueda quedarse viejo.

Uso:  echo '{"idea": {...}, "proyecto": {...}}' | python -m pruebas.payload_idea
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from modulo1.sprint import plan  # noqa: E402


def main() -> int:
    entrada = json.load(sys.stdin)
    idea = entrada["idea"]
    escrituras, _ = plan(
        resultado={"corrida": {"rango": entrada.get("rango", "")}},
        decisiones={"propias": {idea["id"]: idea}},
        equipo={"proyecto_sprint": entrada.get("proyecto") or {}},
    )
    if len(escrituras) != 1:
        # Falla ruidosamente: si el plan no produjo exactamente una escritura,
        # no hay nada contra lo que comparar y la prueba tiene que enterarse.
        print(json.dumps({"_error": f"{len(escrituras)} escrituras, se esperaba 1"}))
        return 1
    e = escrituras[0]
    print(json.dumps({"parametros": e.parametros,
                      "idempotencia": e.idempotencia}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
