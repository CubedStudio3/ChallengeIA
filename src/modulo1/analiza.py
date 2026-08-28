"""Detección de hallazgos: el paso 5 del Módulo 1.

Cada hallazgo carga su evidencia. Un hallazgo sin evidencia no se emite: se
convierte en un hueco declarado. Ésa es la diferencia entre este módulo y una
opinión bien escrita.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

from base.normaliza import Campana, Consolidado
from .competencia import Competidor, PanoramaCompetitivo


@dataclass(frozen=True)
class Evidencia:
    """Un dato con su origen. Es la unidad de trazabilidad del entregable."""

    dato: str
    valor: str
    fuente: str

    def __str__(self) -> str:
        return f"{self.dato}: {self.valor}  ←  {self.fuente}"


@dataclass
class Hallazgo:
    titulo: str
    afirmacion: str
    evidencia: list[Evidencia] = field(default_factory=list)
    tipo: str = "observacion"          # oportunidad · riesgo · observacion
    calculo: str | None = None
    advertencia: str | None = None

    def valido(self) -> bool:
        """Sin evidencia no hay hallazgo."""
        return bool(self.evidencia)


def brecha_de_eficiencia(campanas: list[Campana], indicador: str,
                         fuente: str) -> Hallazgo | None:
    """Distancia entre la campaña más eficiente y la menos, dentro de un indicador."""
    utiles = [c for c in campanas
              if c.utilizable and c.indicador == indicador
              and not c.costo_por_resultado.hueco]
    if len(utiles) < 2:
        return None
    mejor = min(utiles, key=lambda c: c.costo_por_resultado.numero)
    peor = max(utiles, key=lambda c: c.costo_por_resultado.numero)
    if mejor.costo_por_resultado.numero == 0:
        return None
    factor = peor.costo_por_resultado.numero / mejor.costo_por_resultado.numero
    return Hallazgo(
        titulo="Brecha de eficiencia entre campañas",
        afirmacion=(f"Dentro del indicador '{indicador}', la campaña más costosa "
                    f"paga {factor:.2f}x lo que paga la más eficiente."),
        tipo="oportunidad" if factor >= 1.5 else "observacion",
        evidencia=[
            Evidencia("Más eficiente", f"{mejor.nombre} · ${mejor.costo_por_resultado.numero:.2f}", fuente),
            Evidencia("Menos eficiente", f"{peor.nombre} · ${peor.costo_por_resultado.numero:.2f}", fuente),
        ],
        calculo=f"${peor.costo_por_resultado.numero:.2f} ÷ ${mejor.costo_por_resultado.numero:.2f} = {factor:.2f}x",
    )


def concentracion_vs_eficiencia(campanas: list[Campana], indicador: str,
                                fuente: str) -> Hallazgo | None:
    """¿La campaña que más gasta es también la más eficiente?

    Cuando no lo es, hay dinero mal colocado y es la pregunta más accionable
    que puede llevar el deck del lunes.
    """
    utiles = [c for c in campanas
              if c.utilizable and c.indicador == indicador
              and not c.costo_por_resultado.hueco]
    if len(utiles) < 2:
        return None
    por_gasto = sorted(utiles, key=lambda c: c.gasto.numero, reverse=True)
    por_costo = sorted(utiles, key=lambda c: c.costo_por_resultado.numero)
    mayor_gasto = por_gasto[0]
    puesto = por_costo.index(mayor_gasto) + 1
    if puesto == 1:
        return Hallazgo(
            titulo="El mayor presupuesto está bien colocado",
            afirmacion=(f"'{mayor_gasto.nombre}' concentra el mayor gasto y es "
                        f"también la más eficiente del indicador."),
            tipo="observacion",
            evidencia=[Evidencia("Mayor gasto y mejor costo",
                                 f"{mayor_gasto.nombre} · ${mayor_gasto.gasto.numero:,.2f} · "
                                 f"${mayor_gasto.costo_por_resultado.numero:.2f}", fuente)],
        )
    return Hallazgo(
        titulo="El mayor presupuesto no está en la campaña más eficiente",
        afirmacion=(f"'{mayor_gasto.nombre}' concentra el mayor gasto pero ocupa "
                    f"el puesto {puesto} de {len(utiles)} en eficiencia."),
        tipo="oportunidad",
        evidencia=[
            Evidencia("Mayor gasto", f"{mayor_gasto.nombre} · ${mayor_gasto.gasto.numero:,.2f} · "
                                     f"${mayor_gasto.costo_por_resultado.numero:.2f} por resultado", fuente),
            Evidencia("Mejor costo", f"{por_costo[0].nombre} · ${por_costo[0].gasto.numero:,.2f} · "
                                     f"${por_costo[0].costo_por_resultado.numero:.2f} por resultado", fuente),
        ],
    )


def costo_de_oportunidad(campanas: list[Campana], indicador: str,
                         fuente: str) -> Hallazgo | None:
    """Cuántos resultados más daría el mismo dinero al costo de la mejor campaña.

    Es **aritmética sobre el periodo medido**, no un pronóstico. La diferencia
    de costo puede venir de público, creativo, producto o etapa del embudo, y
    esa advertencia viaja pegada al número.
    """
    utiles = [c for c in campanas
              if c.utilizable and c.indicador == indicador
              and not c.costo_por_resultado.hueco
              and c.costo_por_resultado.numero > 0]
    if len(utiles) < 2:
        return None
    mejor = min(utiles, key=lambda c: c.costo_por_resultado.numero)
    resto = [c for c in utiles if c.id != mejor.id]
    gasto_resto = sum(c.gasto.numero for c in resto)
    reales = sum(c.resultados.numero for c in resto)
    hipoteticos = gasto_resto / mejor.costo_por_resultado.numero
    diferencia = hipoteticos - reales
    if diferencia <= 0:
        return None
    return Hallazgo(
        titulo="Costo de oportunidad del periodo",
        afirmacion=(f"Las demás campañas del indicador gastaron ${gasto_resto:,.2f} "
                    f"y obtuvieron {reales:,.0f} resultados. Al costo de "
                    f"'{mejor.nombre}' ese mismo dinero equivale a "
                    f"{hipoteticos:,.0f}."),
        tipo="oportunidad",
        evidencia=[
            Evidencia("Costo de referencia",
                      f"{mejor.nombre} · ${mejor.costo_por_resultado.numero:.2f}", fuente),
            Evidencia("Gasto y resultados del resto",
                      f"${gasto_resto:,.2f} · {reales:,.0f} resultados", fuente),
        ],
        calculo=(f"${gasto_resto:,.2f} ÷ ${mejor.costo_por_resultado.numero:.2f} = "
                 f"{hipoteticos:,.0f} vs {reales:,.0f} reales = "
                 f"{diferencia:,.0f} de diferencia"),
        advertencia=("Es aritmética sobre el periodo medido, NO un pronóstico. La "
                     "diferencia de costo puede venir de público, creativo, producto "
                     "o etapa del embudo. Sirve para dimensionar la pregunta, no "
                     "para prometer el resultado."),
    )


def concentracion_de_mensaje(competidor: Competidor, fuente: str) -> Hallazgo | None:
    """¿El competidor apuesta todo a un solo titular?"""
    dom = competidor.titular_dominante()
    if not dom:
        return None
    titular, veces, cuota = dom
    if cuota < 0.4:
        return None
    return Hallazgo(
        titulo=f"{competidor.nombre} concentra su mensaje",
        afirmacion=(f'{cuota*100:.0f}% de los anuncios observados de '
                    f'{competidor.nombre} usan el titular "{titular}".'),
        tipo="riesgo",
        evidencia=[Evidencia(f"Titular dominante de {competidor.nombre}",
                             f'"{titular}" en {veces} de {len(competidor.anuncios)} anuncios',
                             fuente)],
        advertencia=competidor.advertencia_de_muestra,
    )


def escalada_competitiva(competidor: Competidor, hoy: date, fuente: str,
                         *, ventana: int = 10) -> Hallazgo | None:
    """Un competidor que lanzó buena parte de su inventario hace días."""
    recientes = competidor.lanzados_en(hoy, ventana)
    if not competidor.anuncios or recientes == 0:
        return None
    cuota = recientes / len(competidor.anuncios)
    if cuota < 0.5:
        return None
    cohortes = competidor.cohortes(hoy)[:1]
    ev = [Evidencia(f"Lanzamientos recientes de {competidor.nombre}",
                    f"{recientes} de {len(competidor.anuncios)} anuncios en los últimos {ventana} días",
                    fuente)]
    if cohortes:
        fecha, cuantos = cohortes[0]
        ev.append(Evidencia("Cohorte más grande",
                            f"{cuantos} anuncios creados el {fecha.isoformat()} "
                            f"(hace {(hoy - fecha).days} días)", fuente))
    return Hallazgo(
        titulo=f"{competidor.nombre} está escalando ahora",
        afirmacion=(f"{cuota*100:.0f}% del inventario activo observado de "
                    f"{competidor.nombre} se lanzó en los últimos {ventana} días. "
                    "No es un estado estable."),
        tipo="riesgo",
        evidencia=ev,
        advertencia=competidor.advertencia_de_muestra,
    )


def mercado_sin_disputa(panorama: PanoramaCompetitivo, campanas_del_mercado: list[Campana],
                        indicador: str, fuente_propia: str,
                        fuente_competencia: str) -> Hallazgo | None:
    """Un mercado donde nosotros pautamos y la competencia medida no.

    Es el hallazgo que cruza las dos fuentes, y por tanto el que justifica que
    el módulo lea ambas en lugar de solo una.
    """
    if panorama.presion_total > 0:
        return None
    utiles = [c for c in campanas_del_mercado
              if c.utilizable and c.indicador == indicador
              and not c.costo_por_resultado.hueco]
    if not utiles:
        return None
    gasto = sum(c.gasto.numero for c in utiles)
    resultados = sum(c.resultados.numero for c in utiles)
    cpr = gasto / resultados if resultados else None
    medidos = ", ".join(c.nombre for c in panorama.competencia)
    return Hallazgo(
        titulo=f"{panorama.mercado} sin disputa medida",
        afirmacion=(f"Ninguno de los competidores medidos ({medidos}) tiene "
                    f"anuncios activos en {panorama.mercado}, y ahí ya hay "
                    f"inversión propia con resultados."),
        tipo="oportunidad",
        evidencia=[
            Evidencia(f"Competencia activa en {panorama.mercado}", "0 anuncios", fuente_competencia),
            Evidencia(f"Inversión propia en {panorama.mercado}",
                      f"${gasto:,.2f} · {resultados:,.0f} resultados"
                      + (f" · ${cpr:.2f} por resultado" if cpr else ""), fuente_propia),
        ],
        advertencia=("Solo se midieron los competidores del registro curado. La "
                     "ausencia de ellos no prueba ausencia de toda competencia."),
    )
