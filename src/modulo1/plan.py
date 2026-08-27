"""Plan de producción cuantificado: el paso 7 del Módulo 1.

La regla central del módulo: *las cantidades se derivan del dato, nunca del
criterio.* Aquí eso es estructural, no una buena intención.

`Recomendacion` exige **exactamente una** de dos cosas: una cantidad con su
aritmética y su evidencia, o la declaración explícita de qué dato falta para
poder calcularla. Nunca ninguna de las dos, y nunca un número suelto. Construir
una recomendación que incumpla eso levanta una excepción.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from base.errores import DatoFaltante
from base.normaliza import Campana
from .analiza import Evidencia, Hallazgo


@dataclass(frozen=True)
class Cantidad:
    """Un número con su aritmética a la vista."""

    valor: float
    unidad: str
    calculo: str

    def __str__(self) -> str:
        entero = abs(self.valor - round(self.valor)) < 1e-9
        v = f"{self.valor:,.0f}" if entero else f"{self.valor:,.2f}"
        return f"{v} {self.unidad}"


@dataclass
class Recomendacion:
    titulo: str
    accion: str
    evidencia: list[Evidencia] = field(default_factory=list)
    cantidad: Cantidad | None = None
    no_cuantificable: str | None = None
    dato_que_falta: str | None = None
    advertencia: str | None = None

    def __post_init__(self):
        if self.cantidad is not None and self.no_cuantificable is not None:
            raise DatoFaltante(
                "Una recomendación no puede tener cantidad y declararse "
                "no cuantificable a la vez.",
                contexto={"titulo": self.titulo},
            )
        if self.cantidad is None and self.no_cuantificable is None:
            raise DatoFaltante(
                "Recomendación sin cantidad y sin declarar por qué no la tiene.",
                contexto={"titulo": self.titulo},
                remedio=("Calcular la cantidad con su aritmética, o declarar "
                         "explícitamente qué dato falta. Una recomendación sin "
                         "número y sin explicación es criterio disfrazado de dato."),
            )
        if self.cantidad is not None and not self.evidencia:
            raise DatoFaltante(
                "Recomendación con cantidad pero sin evidencia de origen.",
                contexto={"titulo": self.titulo, "cantidad": str(self.cantidad)},
                remedio="Toda cantidad debe ser trazable hasta su consulta de origen.",
            )
        if self.no_cuantificable is not None and not self.dato_que_falta:
            raise DatoFaltante(
                "Se declaró no cuantificable sin nombrar el dato que falta.",
                contexto={"titulo": self.titulo},
                remedio="Nombrar exactamente qué consulta o captura lo resolvería.",
            )

    @property
    def cuantificada(self) -> bool:
        return self.cantidad is not None


@dataclass
class Plan:
    periodo: str
    recomendaciones: list[Recomendacion] = field(default_factory=list)
    fuentes_usadas: list[str] = field(default_factory=list)

    @property
    def cuantificadas(self) -> list[Recomendacion]:
        return [r for r in self.recomendaciones if r.cuantificada]

    @property
    def declaradas_sin_dato(self) -> list[Recomendacion]:
        return [r for r in self.recomendaciones if not r.cuantificada]

    def resumen(self) -> str:
        return (f"{len(self.cuantificadas)} recomendaciones cuantificadas, "
                f"{len(self.declaradas_sin_dato)} declaradas sin dato suficiente")


def reasignacion_de_presupuesto(campanas: list[Campana], indicador: str,
                                fuente: str, *, umbral_factor: float = 1.5
                                ) -> Recomendacion | None:
    """Mover presupuesto de la campaña más costosa a la más eficiente.

    Cuantificable porque el costo por resultado por campaña es un dato medido.
    """
    utiles = [c for c in campanas
              if c.utilizable and c.indicador == indicador
              and not c.costo_por_resultado.hueco
              and c.costo_por_resultado.numero > 0]
    if len(utiles) < 2:
        return None
    mejor = min(utiles, key=lambda c: c.costo_por_resultado.numero)

    # La campaña a revisar no es la de peor costo por resultado, sino la de
    # mayor OPORTUNIDAD ABSOLUTA: cuántos resultados más daría su presupuesto
    # al costo de la mejor. Una campaña carísima con $50 de gasto importa menos
    # que una mediana con $380.
    def oportunidad(c):
        return c.gasto.numero / mejor.costo_por_resultado.numero - c.resultados.numero

    candidatas = [c for c in utiles if c.id != mejor.id and oportunidad(c) > 0]
    if not candidatas:
        return None
    peor = max(candidatas, key=oportunidad)
    factor = peor.costo_por_resultado.numero / mejor.costo_por_resultado.numero
    if factor < umbral_factor:
        return None
    equivalente = peor.gasto.numero / mejor.costo_por_resultado.numero
    diferencia = equivalente - peor.resultados.numero
    return Recomendacion(
        titulo="Revisar la campaña con mayor oportunidad de reasignación",
        accion=(f"Llevar a la mesa la diferencia de costo entre "
                f"'{peor.etiqueta()}' y '{mejor.etiqueta()}' y decidir si se "
                f"reasigna presupuesto o se investiga la causa."),
        cantidad=Cantidad(
            valor=diferencia, unidad="resultados de diferencia en el periodo",
            calculo=(f"'{peor.etiqueta()}' gastó ${peor.gasto.numero:,.2f} a "
                     f"${peor.costo_por_resultado.numero:.2f} = "
                     f"{peor.resultados.numero:,.0f} resultados. Al costo de "
                     f"'{mejor.etiqueta()}' (${mejor.costo_por_resultado.numero:.2f}) "
                     f"ese mismo monto equivale a {equivalente:,.0f}, "
                     f"{diferencia:,.0f} más. Se eligió esta campaña por mayor "
                     f"oportunidad absoluta, no por peor costo unitario"),
        ),
        evidencia=[
            Evidencia("Campaña menos eficiente",
                      f"{peor.nombre} · ${peor.costo_por_resultado.numero:.2f} · "
                      f"${peor.gasto.numero:,.2f} gastados", fuente),
            Evidencia("Campaña más eficiente",
                      f"{mejor.nombre} · ${mejor.costo_por_resultado.numero:.2f}", fuente),
        ],
        advertencia=("El equivalente es aritmética sobre el periodo medido, no un "
                     "pronóstico. Antes de mover dinero hay que descartar que la "
                     "diferencia venga de público, producto o etapa del embudo."),
    )


def cantidades_por_formato(datos_por_formato: dict | None) -> Recomendacion:
    """Cuántas piezas producir de cada formato.

    Es **la** recomendación que el documento maestro pone como ejemplo: *"6
    reels y 2 artes, citando la métrica que lo justifica"*. Requiere rendimiento
    por formato, que vive a nivel de anuncio con información de creativo.

    Cuando ese dato no está, esta función NO adivina: declara el hueco y nombra
    la consulta exacta que lo resolvería.
    """
    if not datos_por_formato:
        return Recomendacion(
            titulo="Cantidades de producción por formato",
            accion=("Pendiente. No se puede repartir la producción entre video "
                    "y arte estática sin rendimiento por formato."),
            no_cuantificable=(
                "El rendimiento por formato no está en los datos de esta corrida. "
                "Se leyó a nivel de campaña, y el formato del creativo vive a "
                "nivel de anuncio."),
            dato_que_falta=(
                "Consulta a nivel de anuncio (level='ad') incluyendo los campos "
                "de creativo, para poder agrupar por tipo de formato y comparar "
                "su costo por resultado dentro del mismo indicador."),
        )
    mejor = max(datos_por_formato.items(), key=lambda kv: kv[1].get("eficiencia", 0))
    raise NotImplementedError(
        "El reparto por formato se implementa cuando exista la consulta a nivel "
        f"de anuncio. Datos recibidos para: {sorted(datos_por_formato)}, "
        f"mejor candidato {mejor[0]}."
    )


def contrapropuesta_de_angulo(hallazgos: list[Hallazgo]) -> Recomendacion | None:
    """Reaccionar a la concentración de mensaje de un competidor.

    No se cuantifica en piezas: eso dependería del rendimiento por formato. Lo
    que sí es un dato es la concentración del competidor.
    """
    concentracion = [h for h in hallazgos if h.titulo.endswith("concentra su mensaje")]
    if not concentracion:
        return None
    h = concentracion[0]
    return Recomendacion(
        titulo="Decidir posición frente al mensaje dominante del competidor",
        accion=(f"{h.afirmacion} Decidir en la mesa si se disputa ese territorio "
                "de frente o se ocupa uno distinto."),
        no_cuantificable=("La decisión de ángulo es estratégica y humana. El dato "
                          "sustenta la pregunta, no la respuesta."),
        dato_que_falta=("Para cuantificar cuántas piezas dedicar a cada ángulo se "
                        "necesitaría rendimiento propio por ángulo, que hoy no se "
                        "captura de forma estructurada."),
        evidencia=list(h.evidencia),
        advertencia=h.advertencia,
    )


def concentrar_en_mercado(hallazgos: list[Hallazgo]) -> Recomendacion | None:
    """Aprovechar un mercado sin disputa medida."""
    sin_disputa = [h for h in hallazgos if "sin disputa medida" in h.titulo]
    if not sin_disputa:
        return None
    h = sin_disputa[0]
    return Recomendacion(
        titulo=h.titulo,
        accion=(f"{h.afirmacion} Evaluar en la mesa si conviene aumentar la "
                "inversión ahí antes de que entre competencia."),
        no_cuantificable=("Cuánto aumentar depende de la capacidad de atención "
                          "comercial del mercado, que no es un dato de pauta."),
        dato_que_falta=("Capacidad de seguimiento del equipo comercial en ese "
                        "mercado: cuántos leads por semana puede atender sin "
                        "degradar la tasa de contacto."),
        evidencia=list(h.evidencia),
        advertencia=h.advertencia,
    )


def arma_plan(periodo: str, campanas: list[Campana], indicador: str,
              hallazgos: list[Hallazgo], fuente_pauta: str,
              *, datos_por_formato: dict | None = None) -> Plan:
    """Compone el plan a partir de los hallazgos y los datos disponibles."""
    candidatas = [
        reasignacion_de_presupuesto(campanas, indicador, fuente_pauta),
        cantidades_por_formato(datos_por_formato),
        contrapropuesta_de_angulo(hallazgos),
        concentrar_en_mercado(hallazgos),
    ]
    return Plan(
        periodo=periodo,
        recomendaciones=[r for r in candidatas if r is not None],
        fuentes_usadas=sorted({e.fuente for r in candidatas if r
                               for e in r.evidencia}),
    )
