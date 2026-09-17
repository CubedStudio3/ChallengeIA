"""El día que todavía no termina.

Existe por un pedido literal de Mercadeo (2026-09-11):

    «pero y si yo quisiera agarrar tambien el dia de hoy no se puede? la idea
    es que tengamos los datos reales en tiempo real»

Sí se puede: Meta devuelve el día en curso. El problema no es el acceso, es
que **un día a medias no es comparable con días completos**. Medido el
2026-09-11 contra el promedio de los cuatro días previos:

    GT   $7.53 de $29.73  ·  25% del gasto  ·  1,012 de 4,989 impresiones
    SV   $4.15 de $20.93  ·  20% del gasto  ·  1,054 de 5,254 impresiones

Puesto en la misma serie que los días cerrados, eso dibuja un desplome del
75% que es puro horario. Por eso el día en curso **no entra a `piezas`**: no
lo suma el filtro, no lo promedia ninguna gráfica y no toca ningún costo por
lead. Vive en su propio bloque, y el tablero lo pinta rotulado.

**Por qué el rótulo dice un porcentaje y no una hora.** La zona horaria de la
cuenta es una constante declarada como DESCONOCIDA. Decir «van 6 horas del
día» exigiría saberla; decir «va al 25% del gasto de un día típico» sale del
dato y no supone nada. Se reporta lo segundo.

**El día en curso se mueve mientras lo mirás.** Medido: dos consultas
separadas por minutos el 2026-09-11 dieron $7.53 y $7.93 en GT (1,012 y 1,032
impresiones). Por eso el bloque guarda la hora de su consulta: un número sin
el momento en que se leyó no se puede volver a comprobar.
"""

from __future__ import annotations

import json
from pathlib import Path

from base.errores import FallaRuidosa
from base.normaliza import agrupa_por_indicador, normaliza_campanas

RAIZ = Path("data/historico/dia_en_curso")
ARCHIVO = "meta_dia_en_curso.json"

# Contra cuántos días completos se compara para decir «va al N% de un día
# típico». Siete cubre la semana entera, así que un lunes no se compara solo
# contra fines de semana. Si no hay siete, se usan los que haya y se declara
# cuántos fueron: el rótulo dice el N que de verdad se promedió.
DIAS_DE_REFERENCIA = 7


def _lee(crudo: Path) -> dict:
    ruta = crudo / ARCHIVO
    if not ruta.exists():
        return {}
    with open(ruta, encoding="utf-8") as f:
        doc = json.load(f)
    filas = doc.get("ad_entities")
    if isinstance(filas, str):
        filas = json.loads(filas)
    doc["ad_entities"] = filas or []
    return doc


def _el_dia(meta: dict) -> str:
    """La fecha sale del `time_range` declarado, no de las filas.

    El agregado de un solo día NO trae `date_start` —ese campo solo aparece
    con `time_increment`—, así que la única fuente de la fecha es el parámetro
    con el que se pidió. Y se exige `since == until`: un archivo con un rango
    de varios días no es «el día en curso», es otra cosa, y confundirlos haría
    que el rótulo mintiera sobre qué se está mirando.
    """
    rango = ((meta.get("parametros") or {}).get("time_range")) or {}
    desde, hasta = rango.get("since"), rango.get("until")
    if not desde or desde != hasta:
        raise FallaRuidosa(
            "El crudo del día en curso no declara un rango de UN solo día.",
            contexto={"time_range": rango},
            remedio=("Pedirlo con `time_range` de since == until, que es la "
                     "convención de rango cerrado ya verificada."))
    return desde


def _referencia(piezas: list[dict], fecha: str, mercado: str,
                indicador: str) -> dict | None:
    """El día típico de ese mercado y ese indicador, de días ya cerrados.

    Solo mira piezas ANTERIORES al día en curso. Incluir el propio día
    parcial en su promedio lo abarataría y el porcentaje saldría inflado.
    """
    por_dia: dict[str, dict] = {}
    for p in piezas:
        if p["f"] >= fecha or p["p"] != mercado or p["k"] != indicador:
            continue
        d = por_dia.setdefault(p["f"], {"gasto": 0.0, "impresiones": 0})
        d["gasto"] += p["g"]
        d["impresiones"] += p["i"]
    if not por_dia:
        return None
    dias = sorted(por_dia)[-DIAS_DE_REFERENCIA:]
    n = len(dias)
    return {
        "dias": n,
        "desde": dias[0],
        "hasta": dias[-1],
        "gasto": round(sum(por_dia[d]["gasto"] for d in dias) / n, 2),
        "impresiones": round(sum(por_dia[d]["impresiones"] for d in dias) / n),
    }


def arma(crudo: Path | None = None, *, piezas: list[dict], hoy: str,
         declarados: list[str] | None = None,
         excluidos: dict | None = None) -> dict | None:
    """El bloque del día en curso, o None si no se pidió.

    Devolver None es legítimo y NO es un dato faltante: el día en curso es un
    añadido, no una entrada obligatoria de la corrida. Lo que sí sería un
    dato inventado es dibujar la franja sin haber leído nada.

    **`hoy` existe porque este archivo se queda viejo solo.** La corrida
    semanal también regenera el tablero, y tomaría el crudo que haya en disco:
    un lunes mostraría la lectura del viernes rotulada «día en curso». El
    bloque declara `es_de_hoy` y la franja cambia de rótulo — no se calla y no
    se borra, porque «lo último que se leyó» sigue siendo cierto y útil.
    """
    doc = _lee(crudo or (RAIZ / "crudo"))
    if not doc:
        return None

    meta = doc.get("_metadatos") or {}
    fecha = _el_dia(meta)
    filas = normaliza_campanas(doc["ad_entities"], origen=ARCHIVO)

    declarados = declarados or []
    excluidos = excluidos or {}

    mercados: dict[str, dict] = {}
    fuera_de_mercado: dict[str, dict] = {}
    for c in filas:
        gasto = c.gasto.numero or 0
        imp = c.impresiones.numero or 0
        if gasto == 0 and imp == 0:
            continue
        pais = c.desglose_dict.get("country") or "?"
        if pais in excluidos or (declarados and pais not in declarados):
            e = fuera_de_mercado.setdefault(
                pais, {"gasto": 0.0, "impresiones": 0, "campanas": set(),
                       "motivo": (excluidos.get(pais) or {}).get(
                           "motivo", "no está en los mercados declarados")})
            e["gasto"] += gasto
            e["impresiones"] += imp
            e["campanas"].add(c.nombre)
            continue
        mercados.setdefault(pais, []).append(c)

    for e in fuera_de_mercado.values():
        e["gasto"] = round(e["gasto"], 2)
        e["campanas"] = sorted(e["campanas"])

    salida: dict[str, dict] = {}
    for pais, cs in sorted(mercados.items()):
        grupos = agrupa_por_indicador(cs)
        # El indicador principal es el que concentra el gasto, igual que en el
        # resto del reporte. Los demás existen y se declaran: en GT conviven
        # `actions:lead` y `actions:link_click`, y sumarlos daría un número sin
        # significado (ADR-013).
        def _gasto(g):
            return sum(c.gasto.numero or 0 for c in g)
        principal = max(grupos, key=lambda k: _gasto(grupos[k]))
        cs_p = grupos[principal]

        gasto = round(sum(c.gasto.numero or 0 for c in cs_p), 2)
        imp = int(sum(c.impresiones.numero or 0 for c in cs_p))
        # Mismo criterio que `consolida()`: el gasto suma de todas las filas;
        # los resultados, solo de las que tienen uno atribuido.
        con_res = [c for c in cs_p if not c.resultados.hueco]
        res = sum(c.resultados.numero or 0 for c in con_res)
        sin_res = round(sum(c.gasto.numero or 0
                            for c in cs_p if c.resultados.hueco), 2)

        ref = _referencia(piezas, fecha, pais, principal)
        avance = None
        if ref and ref["gasto"]:
            avance = {
                "gasto": round(gasto / ref["gasto"], 3),
                "impresiones": (round(imp / ref["impresiones"], 3)
                                if ref["impresiones"] else None),
            }

        salida[pais] = {
            "indicador": principal,
            "gasto": gasto,
            "resultados": res,
            "impresiones": imp,
            "gasto_sin_resultado": sin_res,
            "costo_por_resultado": round(gasto / res, 4) if res else None,
            "otros_indicadores": sorted(k for k in grupos if k != principal),
            "referencia": ref,
            "avance": avance,
        }

    return {
        "fecha": fecha,
        "es_de_hoy": fecha == hoy,
        "hoy_de_la_corrida": hoy,
        "consultado_a": meta.get("hora_consulta") or meta.get("fecha_consulta"),
        "por_mercado": salida,
        "fuera_de_mercado": fuera_de_mercado,
        "_no_entra_a_piezas": (
            "Este bloque NO está en `piezas`. El filtro no lo suma, ninguna "
            "gráfica lo promedia y ningún costo por lead lo incluye. Un día al "
            "20-25% de su gasto puesto al lado de días completos dibuja una "
            "caída que es puro horario (ADR-065)."),
        "_por_que_un_porcentaje_y_no_una_hora": (
            "La zona horaria de la cuenta está declarada como DESCONOCIDA, así "
            "que «van N horas del día» no se puede afirmar. El avance se mide "
            "contra el promedio de días completos, que sale del dato."),
        "_si_no_es_de_hoy": (
            "Cuando `es_de_hoy` es falso, el crudo se quedó viejo: se leyó otro "
            "día y nadie lo refrescó. No se borra —lo último leído sigue siendo "
            "cierto— pero la franja deja de decir «día en curso» y dice de qué "
            "día es. Un dato viejo rotulado como de hoy es peor que no tenerlo."),
        "_se_mueve": (
            "El día en curso cambia mientras se mira: dos consultas separadas "
            "por minutos el 2026-09-11 dieron $7.53 y $7.93 en GT. Por eso el "
            "bloque guarda la hora de su consulta."),
    }
