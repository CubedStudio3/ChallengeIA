"""Desglose diario de la pauta de Meta, con su reconciliación como guardia.

Existe para que el filtro de fechas del tablero recorte la pauta de verdad en
lugar de llevar un sello que avise que no la recorta. Antes de esto, la corrida
pedía una sola fila agregada por campaña y el periodo quedaba fijo.

**La reconciliación no es una prueba que se corrió una vez: es una compuerta que
corre en cada corrida.** Si la suma de los días no reproduce el agregado al
centavo, la corrida se detiene. Un desglose que no cuadra con su propio total
es peor que no tener desglose, porque se ve igual de creíble.

Cuatro reglas que gobiernan este módulo:

1. **El costo NO se pide por día.** Se pide inversión y resultados, y la
   división se hace UNA vez sobre lo que queda dentro del filtro. Pedirlo por
   día traería `Not available` en los días flacos, que es un hueco, y promediar
   costos diarios no es el costo del periodo. Instrucción de Mercadeo
   2026-09-02, verificada en V8: la división reproduce el `cost_per_result` de
   la API en 6 de 6 campañas.
2. **Se agrupa por indicador antes de sumar, en cada punto.** 158 leads y
   10,771 clics en enlace no se suman. Un total sin indicador es un número
   inventado con cara de agregado.
3. **`Not available` en `results` con gasto no es cero, es un hueco** — y se
   guarda como `None`, no como `0`. Para SUMAR aporta cero, y eso está medido:
   los días con número de Qpayshop dan 12, que es su total agregado exacto. Si
   los huecos escondieran resultados, la suma daría de menos.
4. **Una campaña con gasto en el agregado y ausente del desglose detiene la
   corrida.** Saltarla en silencio es el error del `continue` sin registro que
   ya hizo desaparecer una marca de un reporte.
"""

from __future__ import annotations

import json
from pathlib import Path

from base.errores import DatoFaltante, FallaRuidosa
from base.normaliza import normaliza_campanas

# Al centavo. No es una tolerancia de comodidad: es la unidad de la moneda.
TOLERANCIA_DINERO = 0.005
ARCHIVO_DIA = "meta_campanas_por_dia.json"
ARCHIVO_AGREGADO = "meta_campanas.json"


def _lee(crudo: Path, nombre: str) -> list[dict]:
    f = crudo / nombre
    if not f.exists():
        raise DatoFaltante(
            f"Falta {nombre} en crudo/.",
            contexto={"esperado": str(f)},
            remedio=("Ejecutar la adquisición. El desglose diario se pide con "
                     "time_increment=\"1\" y object_ids de las campañas que la "
                     "llamada agregada devolvió."))
    bruto = json.loads(f.read_text(encoding="utf-8"))
    filas = bruto.get("ad_entities")
    if not isinstance(filas, list):
        raise DatoFaltante(f"{nombre} no trae ad_entities como lista.")
    return filas


def _fecha(c) -> str:
    """La fecha de una fila diaria. Viaja en el desglose, como `country`."""
    d = c.desglose_dict.get("date_start")
    if not d:
        raise DatoFaltante(
            "Una fila del desglose diario no trae date_start.",
            contexto={"campana": c.nombre, "id": c.id},
            remedio=("Confirmar que la llamada llevaba time_increment=\"1\". "
                     "Sin fecha por fila no hay nada que recortar."))
    return str(d)


def _suma(filas) -> dict:
    """Suma gasto, resultados e impresiones. Los huecos aportan cero (regla 3)."""
    return {
        "gasto": round(sum(c.gasto.numero or 0 for c in filas), 2),
        "resultados": sum(c.resultados.numero or 0 for c in filas),
        "impresiones": sum(c.impresiones.numero or 0 for c in filas),
    }


def reconcilia(crudo: Path) -> dict:
    """Compuerta: la suma de los días contra el agregado, campaña por campaña.

    Devuelve el informe si cuadra. Si no cuadra, levanta FallaRuidosa con las
    filas que no cuadran — no con un «no coincide» que no dice dónde.
    """
    dias = normaliza_campanas(_lee(crudo, ARCHIVO_DIA), origen=ARCHIVO_DIA)
    agg = normaliza_campanas(_lee(crudo, ARCHIVO_AGREGADO), origen=ARCHIVO_AGREGADO)

    por_id: dict[str, list] = {}
    for c in dias:
        por_id.setdefault(c.id, []).append(c)

    comparadas, descuadres, ausentes = [], [], []
    for a in agg:
        gasto_agg = a.gasto.numero or 0
        if a.id not in por_id:
            # Solo importa si el agregado dice que hubo gasto: una campaña sin
            # entrega no tiene dias que pedir. Con gasto, es un hueco que
            # ROMPE la corrida (regla 4).
            if gasto_agg > 0:
                ausentes.append({"id": a.id, "nombre": a.nombre,
                                 "gasto_en_el_agregado": round(gasto_agg, 2)})
            continue
        s = _suma(por_id[a.id])
        fila = {
            "id": a.id, "nombre": a.nombre, "indicador": a.indicador,
            "dias_leidos": len(por_id[a.id]),
            "dias_con_resultado": sum(
                1 for c in por_id[a.id] if not c.resultados.hueco),
            "gasto": {"dias": s["gasto"], "agregado": round(gasto_agg, 2)},
            "resultados": {"dias": s["resultados"],
                           "agregado": a.resultados.numero},
            "impresiones": {"dias": s["impresiones"],
                            "agregado": a.impresiones.numero},
        }
        mal = []
        if abs(s["gasto"] - gasto_agg) > TOLERANCIA_DINERO:
            mal.append("gasto")
        # Un agregado en hueco no se compara contra la suma: no hay contra qué.
        if not a.resultados.hueco and s["resultados"] != a.resultados.numero:
            mal.append("resultados")
        if not a.impresiones.hueco and s["impresiones"] != a.impresiones.numero:
            mal.append("impresiones")
        fila["cuadra"] = not mal
        if mal:
            fila["descuadra_en"] = mal
            descuadres.append(fila)
        comparadas.append(fila)

    if ausentes or descuadres:
        raise FallaRuidosa(
            "El desglose diario NO reproduce el agregado. La corrida se "
            "detiene: un desglose que no cuadra con su total se ve igual de "
            "creíble y no lo es.",
            contexto={"descuadres": descuadres, "ausentes_con_gasto": ausentes},
            remedio=("Volver a pedir el desglose con time_increment=\"1\" y el "
                     "MISMO time_range del agregado, con object_ids de todas "
                     "las campañas que el agregado devolvió con gasto. Si "
                     "persiste, no publicar: reportarlo."))

    return {
        "comparadas": comparadas,
        "campanas": len(comparadas),
        "valores_comparados": sum(
            1 for f in comparadas
            for k in ("gasto", "resultados", "impresiones")
            if f[k]["agregado"] is not None),
        "_que_prueba": (
            "Que pedir la pauta dia por dia devuelve exactamente lo mismo que "
            "el agregado ya verificado contra la interfaz en V0. Corre en CADA "
            "corrida, no una sola vez."),
    }


def arma(crudo: Path, desde: str, hasta: str) -> dict:
    """Las filas diarias para el tablero, ya reconciliadas.

    El tablero recibe filas —no agregados— y suma en el navegador sobre la
    ventana elegida, agrupando por indicador. Las claves son de una letra
    porque son ~150 por corrida y el fragmento ya pesa 620 KB.
    """
    informe = reconcilia(crudo)
    filas = normaliza_campanas(_lee(crudo, ARCHIVO_DIA), origen=ARCHIVO_DIA)

    fuera = [c for c in filas if not (desde <= _fecha(c) <= hasta)]
    if fuera:
        raise FallaRuidosa(
            "El desglose diario trae días fuera del periodo de la corrida.",
            contexto={"periodo": f"{desde} a {hasta}",
                      "ejemplos": sorted({_fecha(c) for c in fuera})[:5]},
            remedio="Pedir el desglose con el mismo time_range de la corrida.")

    piezas = []
    for c in filas:
        # Una fila sin gasto NI impresiones no es dato, es relleno: la API
        # devuelve un renglon por campaña × dia aunque no haya pasado nada.
        gasto = c.gasto.numero or 0
        imp = c.impresiones.numero or 0
        if gasto == 0 and imp == 0:
            continue
        piezas.append({
            "f": _fecha(c),
            "c": c.id,
            "n": c.nombre,
            "k": c.indicador,
            "g": round(gasto, 2),
            "r": None if c.resultados.hueco else c.resultados.numero,
            "i": imp,
        })
    piezas.sort(key=lambda p: (p["f"], p["n"]))

    dias_con_dato = sorted({p["f"] for p in piezas})
    return {
        "piezas": piezas,
        "rango_disponible": {"desde": desde, "hasta": hasta},
        "dias_con_dato": len(dias_con_dato),
        "primer_dia": dias_con_dato[0] if dias_con_dato else None,
        "ultimo_dia": dias_con_dato[-1] if dias_con_dato else None,
        "reconciliacion": informe,
        "_el_costo": (
            "No viene por día. Se calcula dividiendo gasto entre resultados "
            "UNA vez, sobre lo que queda dentro de la ventana y dentro de un "
            "mismo indicador. Verificado en V8: la división reproduce el "
            "cost_per_result de la API en 6 de 6 campañas."),
        "_el_indicador": (
            "Cada fila trae el suyo. Hay que agrupar por indicador antes de "
            "sumar: 158 leads y 10,771 clics en enlace no se suman."),
        "_los_huecos": (
            "`r` en null es un día con gasto y sin resultado atribuido. Para "
            "sumar aporta cero, y eso está medido, no supuesto: los días con "
            "número de Qpayshop dan 12, su total agregado exacto."),
        "_sin_corte_por_mercado": (
            "Este desglose es por campaña, no por campaña × país. El corte "
            "GT/SV sigue siendo del periodo de la corrida y lleva sello en el "
            "tablero. Se midió que breakdowns=country SÍ se combina con "
            "time_increment, así que es trabajo pendiente y no un imposible."),
    }
