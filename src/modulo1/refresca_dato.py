"""Refresca SOLO el dato de pauta de una corrida ya hecha. Nunca el análisis.

Existe por ADR-065: son dos trabajos que se rompen distinto y por eso no
comparten Rutina. La corrida semanal recalcula estrategia, cartas y
recomendaciones; volverla diaria las movería todos los días mientras la mesa
trabaja encima, y consultaría a diario una Ad Library que solo responde «qué
está activo ahora».

Este módulo hace lo que la Rutina diaria: vuelve a leer los crudos de pauta
—los de la corrida, los meses históricos y el día en curso—, pasa las mismas
compuertas de reconciliación, y reescribe **únicamente** `pauta_diaria` dentro
del `resultado.json`. Todo lo demás del archivo queda intacto, byte a byte.

Se escribió a mano el 2026-09-18, el día de la presentación, porque hasta
entonces este camino solo existía dentro de `corre.py`: refrescar el dato
obligaba a recalcular el análisis entero, que es justo lo que ADR-065 dice que
no se debe hacer.

    python -m modulo1.refresca_dato --corrida <carpeta> --hoy YYYY-MM-DD
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from base.convenciones import cargar

from . import dia_en_curso as DHOY
from . import pauta_diaria as PDIA
from . import pauta_historica as PHIST


def refresca(corrida: Path, hoy: str) -> dict:
    """Devuelve el bloque `pauta_diaria` recalculado. No escribe nada."""
    destino = corrida / "analisis" / "resultado.json"
    doc = json.loads(destino.read_text(encoding="utf8"))

    # La ventana del ANÁLISIS sale de la corrida que ya existe, nunca del dato
    # disponible. Son dos campos distintos y no se unifican (compromiso con
    # Mercadeo, 2026-09-07): por eso se lee de aquí y no se recalcula.
    ventana = doc["pauta_diaria"]["ventana_de_la_corrida"]
    desde, hasta = ventana["desde"], ventana["hasta"]

    c = cargar("convenciones", bloque="mercados")
    declarados, excluidos = tuple(c["declarados"]), c.get("excluidos", {})

    # Compuerta 1: los días de la corrida contra su propio agregado, al centavo.
    pauta = PDIA.arma(corrida / "crudo", desde, hasta,
                      declarados=declarados, excluidos=excluidos)

    # Compuerta 2: un par por mes, cada uno contra sí mismo. Un mes que no
    # cuadra no entra y se declara. `excluir_periodo` quita los días que la
    # corrida ya trae: sin eso, ese gasto entraría dos veces.
    hist = PHIST.arma(declarados=declarados, excluidos=excluidos,
                      excluir_periodo=(desde, hasta))
    if hist["piezas"]:
        pauta["piezas"] = sorted(pauta["piezas"] + hist["piezas"],
                                 key=lambda p: (p["f"], p["n"], p["p"]))
        dias = sorted({p["f"] for p in pauta["piezas"]})
        tope = pauta["rango_disponible"]
        pauta["rango_disponible"] = {"desde": min(tope["desde"], dias[0]),
                                     "hasta": max(tope["hasta"], dias[-1])}
        pauta["dias_con_dato"] = len(dias)
        pauta["primer_dia"] = dias[0]
        pauta["ultimo_dia"] = dias[-1]
        pauta["mercados"] = sorted({p["p"] for p in pauta["piezas"]})
        for pais, e in (hist.get("fuera_de_mercado") or {}).items():
            acc = pauta["fuera_de_mercado"].setdefault(
                pais, {"gasto": 0.0, "impresiones": 0, "dias": 0,
                       "campanas": [], "motivo": e.get("motivo", "")})
            acc["gasto"] = round(acc["gasto"] + e.get("gasto", 0), 2)
            acc["impresiones"] += e.get("impresiones", 0)
            acc["dias"] += e.get("dias", 0)
            acc["campanas"] = sorted(set(acc["campanas"]) | set(e.get("campanas") or []))

    # El día que no terminó. Va DESPUÉS de mezclar los meses porque su rótulo
    # «va al N% de un día típico» se calcula contra los días completos que ya
    # están en `piezas`.
    pauta["dia_en_curso"] = DHOY.arma(piezas=pauta["piezas"], hoy=hoy,
                                      declarados=declarados, excluidos=excluidos)
    pauta["meses_historicos"] = {
        "meses": hist["meses"],
        "entran": hist["meses_que_entran"],
        "rechazados": hist["meses_rechazados"],
        "piezas": len(hist["piezas"]),
        "_que_es": hist["_que_es"],
    }
    pauta["ventana_de_la_corrida"] = ventana
    return pauta


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--corrida", required=True, type=Path)
    ap.add_argument("--hoy", required=True)
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args(argv)

    destino = a.corrida / "analisis" / "resultado.json"
    doc = json.loads(destino.read_text(encoding="utf8"))
    antes = doc["pauta_diaria"]
    nuevo = refresca(a.corrida, a.hoy)

    h = nuevo["dia_en_curso"]
    print(f"rango disponible : {antes['rango_disponible']['desde']} → "
          f"{antes['rango_disponible']['hasta']}  ==>  "
          f"{nuevo['rango_disponible']['desde']} → {nuevo['rango_disponible']['hasta']}")
    print(f"piezas           : {len(antes['piezas'])}  ==>  {len(nuevo['piezas'])}")
    print(f"días con dato    : {antes['dias_con_dato']}  ==>  {nuevo['dias_con_dato']}")
    if h:
        print(f"día en curso     : {h['fecha']} · es_de_hoy={h['es_de_hoy']} · "
              f"mercados con entrega={len(h['por_mercado'])}")
    else:
        print("día en curso     : no se leyó ninguno")

    if a.dry_run:
        print("MODO --dry-run · no se escribió nada")
        return 0

    doc["pauta_diaria"] = nuevo
    doc["corrida"]["hoy"] = a.hoy
    destino.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n",
                       encoding="utf8")
    print(f"escrito: {destino}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
