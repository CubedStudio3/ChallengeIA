"""Normalización de respuestas de Meta.

Este módulo existe por ADR-013. El campo `results` de la API trae un indicador
que cambia por campaña: en la cuenta conviven `actions:lead`,
`actions:link_click`, `QualifiedLead`, `complete_registration` y `mixed`.

Sumar entre indicadores produce un número plausible y falso — que es peor que
un número absurdo, porque pasa la revisión visual. Aquí eso es imposible por
construcción: `consolida()` aborta si recibe indicadores distintos.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from .errores import DatoFaltante, IndicadorIncompatible

# La API declara explícitamente cuándo no tiene un dato. Son huecos, no ceros.
MARCAS_DE_HUECO = {"not available", "n/a", "", "-", "—"}

# Un indicador `mixed` significa que la campaña agrega tipos de resultado
# distintos internamente: su número no es interpretable.
INDICADOR_MIXTO = "mixed"


@dataclass(frozen=True)
class Valor:
    """Un número, o la declaración explícita de que el dato falta.

    Nunca se representa un hueco con 0. Un gasto de $0.00 es un dato real
    (la campaña no gastó); un resultado "Not available" es la ausencia del dato.
    Confundirlos inventaría información.
    """

    numero: float | None
    crudo: str
    motivo: str | None = None

    @property
    def hueco(self) -> bool:
        return self.numero is None

    def __str__(self) -> str:
        if self.hueco:
            return f"[sin dato: {self.motivo}]"
        return self.crudo


def _es_hueco(texto: str) -> bool:
    return texto.strip().lower() in MARCAS_DE_HUECO


def parsea_numero(crudo, *, etiqueta: str) -> Valor:
    """Convierte un valor de la API a número, o lo marca como hueco.

    Los importes llegan con formato local español: `$331,66 USD`, y en montos
    grandes `$1.234,56 USD` — punto de miles, coma decimal.
    """
    if crudo is None:
        return Valor(None, "", f"{etiqueta}: la API no devolvió el campo")
    texto = str(crudo).strip()
    if _es_hueco(texto):
        return Valor(None, texto, f"{etiqueta}: la API reportó '{texto or 'vacío'}'")

    # Quitar moneda, letras y paréntesis explicativos: "$2,10 USD (Leads)"
    limpio = re.sub(r"\([^)]*\)", "", texto)
    limpio = re.sub(r"[^\d,.\-]", "", limpio)
    if not limpio or limpio in {"-", ",", "."}:
        return Valor(None, texto, f"{etiqueta}: no se pudo interpretar '{texto}'")

    if "," in limpio and "." in limpio:
        # Formato español: punto de miles, coma decimal
        limpio = limpio.replace(".", "").replace(",", ".")
    elif "," in limpio:
        entero, _, decimal = limpio.rpartition(",")
        # Una coma con 1-2 dígitos al final es decimal; si no, es separador de miles
        limpio = f"{entero}.{decimal}" if len(decimal) in (1, 2) else limpio.replace(",", "")
    try:
        return Valor(float(limpio), texto)
    except ValueError:
        return Valor(None, texto, f"{etiqueta}: no se pudo interpretar '{texto}'")


def _extrae_indicador(bloque) -> str:
    if not isinstance(bloque, dict):
        return "desconocido"
    return bloque.get("indicator") or "desconocido"


def _extrae_valor_resultados(bloque, etiqueta: str) -> Valor:
    """`results` llega a veces como `value` y a veces como lista `values`."""
    if not isinstance(bloque, dict):
        return Valor(None, "", f"{etiqueta}: estructura inesperada")
    if "value" in bloque:
        return parsea_numero(bloque["value"], etiqueta=etiqueta)
    valores = bloque.get("values") or []
    if not valores:
        return Valor(None, "", f"{etiqueta}: la API no devolvió valores")
    if len(valores) > 1:
        ventanas = [v.get("attribution_windows") for v in valores]
        return Valor(
            None, str(valores),
            f"{etiqueta}: {len(valores)} ventanas de atribución ({ventanas}). "
            "Ambiguo: hay que fijar la ventana explícitamente antes de usarlo",
        )
    return parsea_numero(valores[0].get("value"), etiqueta=etiqueta)


@dataclass(frozen=True)
class Campana:
    """Una campaña con sus métricas y su indicador declarado."""

    id: str
    nombre: str
    indicador: str
    resultados: Valor
    costo_por_resultado: Valor
    gasto: Valor
    impresiones: Valor
    origen: str = ""
    desglose: tuple = ()          # p. ej. (("country","GT"),)

    @property
    def desglose_dict(self) -> dict:
        return dict(self.desglose)

    def etiqueta(self) -> str:
        if not self.desglose:
            return self.nombre
        detalle = " · ".join(f"{v}" for _, v in self.desglose)
        return f"{self.nombre} [{detalle}]"

    @property
    def mixto(self) -> bool:
        return self.indicador == INDICADOR_MIXTO

    @property
    def utilizable(self) -> bool:
        """Sirve para analizar solo si tiene indicador limpio y resultados."""
        return (
            not self.mixto
            and self.indicador != "desconocido"
            and not self.resultados.hueco
            and not self.gasto.hueco
        )

    @property
    def motivo_de_exclusion(self) -> str | None:
        if self.mixto:
            return ("indicador 'mixed': la campaña agrega tipos de resultado "
                    "distintos y su número no es interpretable")
        if self.indicador == "desconocido":
            return "la API no declaró indicador"
        if self.resultados.hueco:
            return self.resultados.motivo
        if self.gasto.hueco:
            return self.gasto.motivo
        return None

    def coherente(self, *, tolerancia: float = 0.02) -> bool | None:
        """¿gasto / resultados coincide con el costo por resultado reportado?

        Es la verificación que no se hizo en el caso $70.74. Devuelve None si
        falta algún dato para poder comprobarlo.
        """
        if self.gasto.hueco or self.resultados.hueco or self.costo_por_resultado.hueco:
            return None
        if self.resultados.numero == 0:
            return None
        calculado = self.gasto.numero / self.resultados.numero
        return abs(calculado - self.costo_por_resultado.numero) <= tolerancia


# Claves de desglose que la API puede devolver junto a las métricas.
CLAVES_DESGLOSE = ("country", "publisher_platform", "platform_position",
                   "impression_device", "age", "gender", "region")


def normaliza_campanas(crudo: list[dict], *, origen: str = "") -> list[Campana]:
    """Convierte la respuesta cruda de `ads_get_ad_entities` en Campanas.

    Si la respuesta trae desglose (`country`, `publisher_platform`...), cada
    fila es una combinación campaña×desglose y se conserva como tal. **No se
    infiere el desglose del nombre de la campaña**: se comprobó que "Campaña
    Punto de Venta SV" tiene entrega en GT y HN, así que el nombre no es dato.
    """
    if not isinstance(crudo, list):
        raise DatoFaltante(
            "Se esperaba una lista de campañas.",
            contexto={"tipo_recibido": type(crudo).__name__},
        )
    salida = []
    for fila in crudo:
        nombre = fila.get("name", "(sin nombre)")
        desglose = tuple((k, fila[k]) for k in CLAVES_DESGLOSE if k in fila)
        salida.append(Campana(
            id=str(fila.get("id", "")),
            nombre=nombre,
            indicador=_extrae_indicador(fila.get("results")),
            resultados=_extrae_valor_resultados(fila.get("results"), f"{nombre}/resultados"),
            costo_por_resultado=parsea_numero(
                (fila.get("cost_per_result") or {}).get("value"),
                etiqueta=f"{nombre}/costo_por_resultado"),
            gasto=parsea_numero(
                fila.get("amount_spent", fila.get("spend")), etiqueta=f"{nombre}/gasto"),
            impresiones=parsea_numero(fila.get("impressions"), etiqueta=f"{nombre}/impresiones"),
            origen=origen,
            desglose=desglose,
        ))
    return salida


def filtra_desglose(campanas: list[Campana], clave: str, valor: str) -> list[Campana]:
    """Las filas que corresponden a un valor de desglose, p. ej. country=SV."""
    return [c for c in campanas if c.desglose_dict.get(clave) == valor]


def valores_de_desglose(campanas: list[Campana], clave: str) -> list[str]:
    return sorted({v for c in campanas
                   if (v := c.desglose_dict.get(clave)) is not None})


def agrupa_por_indicador(campanas: list[Campana]) -> dict[str, list[Campana]]:
    """Agrupa por indicador. Es el paso obligatorio antes de comparar (ADR-013)."""
    grupos: dict[str, list[Campana]] = {}
    for c in campanas:
        grupos.setdefault(c.indicador, []).append(c)
    return grupos


@dataclass
class Consolidado:
    """Suma válida: un solo indicador, y declarándolo siempre."""

    indicador: str
    campanas: int
    resultados: float
    gasto: float
    impresiones: float
    excluidas: list[tuple[str, str]] = field(default_factory=list)

    @property
    def costo_por_resultado(self) -> float | None:
        return self.gasto / self.resultados if self.resultados else None

    def descripcion(self) -> str:
        """Nunca dice '370 leads'. Dice de qué indicador son."""
        cpr = self.costo_por_resultado
        cpr_txt = f"${cpr:.2f} por resultado" if cpr is not None else "costo no calculable"
        return (f"{self.resultados:,.0f} resultados con indicador '{self.indicador}' "
                f"en {self.campanas} campañas · ${self.gasto:,.2f} · {cpr_txt}")


def consolida(campanas: list[Campana]) -> Consolidado:
    """Suma campañas. **Aborta si los indicadores difieren** (ADR-013).

    Ésta es la barrera que impide el modo de falla más peligroso del proyecto.
    """
    utilizables = [c for c in campanas if c.utilizable]
    excluidas = [(c.nombre, c.motivo_de_exclusion) for c in campanas if not c.utilizable]

    if not utilizables:
        raise DatoFaltante(
            "Ninguna campaña tiene datos utilizables.",
            contexto={"excluidas": excluidas},
            remedio="Revisar el rango de fechas o si las campañas tuvieron entrega.",
        )

    indicadores = {c.indicador for c in utilizables}
    if len(indicadores) > 1:
        raise IndicadorIncompatible(
            "Se intentó consolidar campañas con indicadores distintos.",
            contexto={
                "indicadores": sorted(indicadores),
                "campanas": {c.nombre: c.indicador for c in utilizables},
            },
            remedio=(
                "Llamar agrupa_por_indicador() y consolidar cada grupo por "
                "separado. Sumar entre indicadores produce un número plausible "
                "y falso (ADR-013)."
            ),
        )

    return Consolidado(
        indicador=indicadores.pop(),
        campanas=len(utilizables),
        resultados=sum(c.resultados.numero for c in utilizables),
        gasto=sum(c.gasto.numero for c in utilizables),
        impresiones=sum(c.impresiones.numero or 0 for c in utilizables),
        excluidas=excluidas,
    )
