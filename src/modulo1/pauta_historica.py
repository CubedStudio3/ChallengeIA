"""Meses anteriores de pauta, día por día, para que el filtro pueda mirar atrás.

Existe por un pedido explícito de Mercadeo (2026-09-07):

    «yo quiero más meses de dato para poder mirar, pero el análisis, la
    estrategia y las recomendaciones tienen que seguir siendo de la semana. No
    quiero recomendaciones sacadas de un promedio de tres meses.»

Esas dos frases son el contrato de este módulo, y la separación es la razón de
que sea un módulo aparte y no un rango más ancho en la corrida:

1. **Solo aporta PIEZAS.** Filas diarias con fecha, campaña, país e indicador.
   No toca `consolidados_*`, ni `por_mercado`, ni las cartas, ni la estrategia.
   Esos los calcula la corrida sobre SU periodo, y de ahí resuelven las cartas
   su evidencia (ADR-042). Ensanchar el rango de la corrida habría cambiado
   todos esos números a la vez: es exactamente lo que Mercadeo no quiere.
2. **El periodo del análisis se escribe desde la corrida**, nunca desde el
   rango de dato disponible. Son dos campos distintos y no se unifican.

## La compuerta es por PAR, no global

Cada mes es su propio par: su agregado y su desglose diario, pedidos con el
mismo `time_range`, y reconciliados uno contra el otro al centavo. Meter tres
meses de días contra el agregado de una semana no cuadra y detendría la
corrida, con razón.

Un mes que no cuadra **no entra y se declara**. Los otros sí. Es la instrucción
literal de Mercadeo, y es la única forma honesta: un mes malo no contamina a los
buenos, y su ausencia no queda en silencio.

## La trampa que costó una corrida

`limit` por defecto trunca en **200 filas**, sin cursor y sin aviso. La primera
consulta de los tres meses devolvió 200 filas cuando junio solo ya daba 165. Con
`object_ids` no hay paginación que avise: el truncamiento se ve igual de completo
que el dato completo. Lo agarraron las tres compuertas a la vez.

Por eso este módulo NO adquiere: lee lo que ya está en disco y reconciliado. La
adquisición lleva `limit=1000` y queda registrada en el `_metadatos` del crudo.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from base.errores import FallaRuidosa

from . import pauta_diaria as PDIA

# Un mes es una carpeta `YYYY-MM/crudo` con el par adentro. El nombre de la
# carpeta ES el mes: se usa para derivar el periodo, así que tiene que calzar.
RAIZ = Path("data/historico/pauta_meses")
PATRON_MES = re.compile(r"^(\d{4})-(\d{2})$")

_DIAS = {1: 31, 2: 28, 3: 31, 4: 30, 5: 31, 6: 30,
         7: 31, 8: 31, 9: 30, 10: 31, 11: 30, 12: 31}


def _fin_de_mes(anio: int, mes: int) -> int:
    if mes == 2 and (anio % 4 == 0 and (anio % 100 != 0 or anio % 400 == 0)):
        return 29
    return _DIAS[mes]


def meses_disponibles(raiz: Path | None = None) -> list[str]:
    """Los meses que hay en disco, ordenados. No valida su contenido."""
    r = raiz or RAIZ
    if not r.exists():
        return []
    return sorted(d.name for d in r.iterdir()
                  if d.is_dir() and PATRON_MES.match(d.name)
                  and (d / "crudo").is_dir())


def arma(raiz: Path | None = None, *,
         declarados: list[str] | None = None,
         excluidos: dict | None = None,
         excluir_periodo: tuple[str, str] | None = None) -> dict:
    """Las piezas de los meses que pasan su compuerta, más el informe de todos.

    `excluir_periodo` quita los días que ya trae la corrida. Sin eso, un día
    que cae en los dos lados entra DOS VECES y el gasto se duplica: la semana
    del 25 de agosto al 3 de septiembre pisa siete días de agosto. Es el
    descuadre más fácil de no ver, porque no rompe nada —solo infla—.
    """
    r = raiz or RAIZ
    piezas: list[dict] = []
    informe: list[dict] = []
    fuera_de_mercado: dict = {}

    for mes in meses_disponibles(r):
        m = PATRON_MES.match(mes)
        anio, num = int(m.group(1)), int(m.group(2))
        desde = f"{anio:04d}-{num:02d}-01"
        hasta = f"{anio:04d}-{num:02d}-{_fin_de_mes(anio, num):02d}"
        crudo = r / mes / "crudo"

        try:
            uno = PDIA.arma(crudo, desde, hasta,
                            declarados=declarados, excluidos=excluidos)
        except FallaRuidosa as e:
            # El mes NO entra. Y se dice por qué: un mes ausente en silencio
            # se lee como «no hubo pauta», que es una afirmación distinta.
            informe.append({"mes": mes, "entra": False,
                            "motivo": str(e).splitlines()[0],
                            "detalle": getattr(e, "contexto", None)})
            continue
        except Exception as e:                      # noqa: BLE001
            informe.append({"mes": mes, "entra": False,
                            "motivo": f"{type(e).__name__}: {e}"})
            continue

        ps = uno["piezas"]
        solapados = 0
        if excluir_periodo:
            d0, h0 = excluir_periodo
            antes = len(ps)
            ps = [p for p in ps if not (d0 <= p["f"] <= h0)]
            solapados = antes - len(ps)

        piezas.extend(ps)
        for pais, e in (uno.get("fuera_de_mercado") or {}).items():
            acc = fuera_de_mercado.setdefault(
                pais, {"gasto": 0.0, "impresiones": 0, "dias": 0,
                       "campanas": [], "motivo": e.get("motivo", "")})
            acc["gasto"] = round(acc["gasto"] + e.get("gasto", 0), 2)
            acc["impresiones"] += e.get("impresiones", 0)
            acc["dias"] += e.get("dias", 0)
            acc["campanas"] = sorted(set(acc["campanas"]) | set(e.get("campanas") or []))

        rec = uno.get("reconciliacion") or {}
        informe.append({
            "mes": mes, "entra": True,
            "piezas": len(ps),
            "dias_con_dato": uno.get("dias_con_dato"),
            "campanas_comparadas": rec.get("campanas"),
            "valores_comparados": rec.get("valores_comparados"),
            "dias_quitados_por_solape": solapados,
            "indicadores": sorted({p["k"] for p in ps}),
        })

    piezas.sort(key=lambda p: (p["f"], p["n"], p["p"]))
    return {
        "piezas": piezas,
        "meses": informe,
        "meses_que_entran": [i["mes"] for i in informe if i["entra"]],
        "meses_rechazados": [i["mes"] for i in informe if not i["entra"]],
        "fuera_de_mercado": fuera_de_mercado,
        "_que_es": (
            "Meses anteriores de pauta, día por día. Sirven SOLO para que el "
            "filtro de fechas y las gráficas puedan mirar atrás. El análisis, "
            "la estrategia y las cartas son de la corrida de la semana y no se "
            "recalculan con estos días: es un requisito de Mercadeo "
            "(2026-09-07), no un efecto lateral."),
        "_la_compuerta": (
            "Cada mes se reconcilió contra SU PROPIO agregado, al centavo, por "
            "campaña y por país. Un mes que no cuadra no entra y queda "
            "declarado en `meses_rechazados`."),
    }


def cli() -> None:
    import argparse
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--raiz", type=Path, default=RAIZ)
    ap.add_argument("--convenciones", type=Path, default=Path("config/convenciones.json"))
    a = ap.parse_args()
    cfg = json.loads(a.convenciones.read_text(encoding="utf-8"))["mercados"]
    r = arma(a.raiz, declarados=cfg["declarados"], excluidos=cfg["excluidos"])
    print(f"meses en disco: {meses_disponibles(a.raiz)}")
    for i in r["meses"]:
        if i["entra"]:
            print(f"  {i['mes']}  entra   {i['piezas']:>4} piezas · "
                  f"{i['dias_con_dato']} días · {i['valores_comparados']} valores "
                  f"reconciliados")
            print(f"            indicadores: {', '.join(i['indicadores'])}")
        else:
            print(f"  {i['mes']}  NO ENTRA  {i['motivo'][:90]}")
    print(f"total de piezas: {len(r['piezas'])}")
    if r["fuera_de_mercado"]:
        print(f"fuera de mercado: {json.dumps(r['fuera_de_mercado'], ensure_ascii=False)}")


if __name__ == "__main__":
    cli()
