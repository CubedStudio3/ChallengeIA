"""Carga de configuración y convención de fechas.

La convención de fechas quedó verificada en V0 el 2026-08-27: 12 de 12 valores
idénticos entre la interfaz de Meta Ads Manager y la API. Este módulo la
convierte en algo que el código no puede violar por descuido.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path

from .errores import ConfiguracionBloqueada, ConvencionViolada, DatoFaltante

RAIZ = Path(__file__).resolve().parents[2]
CONFIG = RAIZ / "config"

# Presets que Meta acepta pero que este proyecto prohíbe: son rangos móviles y
# hacen que la misma consulta devuelva distinto al día siguiente.
PRESETS_PROHIBIDOS = {
    "today", "yesterday", "this_month", "last_month", "this_quarter",
    "maximum", "data_maximum", "last_3d", "last_7d", "last_14d", "last_28d",
    "last_30d", "last_90d", "last_week_mon_sun", "last_week_sun_sat",
    "last_quarter", "last_year", "this_week_mon_today", "this_week_sun_today",
    "this_year",
}


def cargar(nombre: str, *, bloque: str | None = None,
           permitir_bloqueado: bool = False) -> dict:
    """Carga un archivo de `config/`, rechazando bloques con `_lock: true`.

    ADR-009: un bloque bloqueado significa "este valor no está verificado".
    Consumirlo silenciosamente sería inventar un dato con apariencia de hecho.

    `permitir_bloqueado=True` es la única puerta de salida, y sirve para un caso
    concreto: **reportar el hueco**, no consumirlo. El tablero necesita leer
    `equipo.json` bloqueado para poder decir «no hay lista de personas y por eso
    el selector está apagado». Eso es lo contrario de inventar el dato. Quien
    use esta puerta tiene que mostrar el bloqueo, nunca leer valores de adentro
    como si estuvieran verificados.
    """
    ruta = CONFIG / f"{nombre}.json"
    if not ruta.exists():
        raise DatoFaltante(
            f"No existe el archivo de configuración {nombre}.json",
            contexto={"ruta": str(ruta)},
            remedio=f"Crear {ruta} o revisar el nombre.",
        )
    datos = json.loads(ruta.read_text(encoding="utf-8"))
    if bloque is not None:
        if bloque not in datos:
            raise DatoFaltante(
                f"El bloque '{bloque}' no existe en {nombre}.json",
                contexto={"bloques_disponibles": sorted(
                    k for k in datos if not k.startswith("_"))},
            )
        datos = datos[bloque]
    if not permitir_bloqueado:
        _verifica_desbloqueado(
            datos, f"{nombre}.json" + (f":{bloque}" if bloque else ""))
    return datos


def _verifica_desbloqueado(datos, ruta_legible: str) -> None:
    if not isinstance(datos, dict):
        return
    if datos.get("_lock") is True:
        raise ConfiguracionBloqueada(
            f"El bloque {ruta_legible} está marcado como no verificado.",
            contexto={
                "_estado": datos.get("_estado", "desconocido"),
                "_nota": datos.get("_nota") or datos.get("_desbloquea_con"),
            },
            remedio=(
                "Verificar el dato contra la fuente real, registrar la evidencia "
                "en docs/validaciones.md y poner _lock en false. No se consume "
                "configuración sin verificar (ADR-009)."
            ),
        )


@dataclass(frozen=True)
class RangoFechas:
    """Rango cerrado, la única forma permitida de pedir métricas.

    V0 verificó que `time_range` con `since`/`until` en YYYY-MM-DD reproduce la
    interfaz al centavo. Un rango móvil no es reproducible y queda prohibido.
    """

    desde: date
    hasta: date

    def __post_init__(self):
        if self.hasta < self.desde:
            raise ConvencionViolada(
                "El rango termina antes de empezar.",
                contexto={"desde": str(self.desde), "hasta": str(self.hasta)},
            )

    @property
    def dias(self) -> int:
        return (self.hasta - self.desde).days + 1

    def como_time_range(self) -> str:
        """El parámetro exacto que espera el conector de Meta."""
        return json.dumps(
            {"since": self.desde.isoformat(), "until": self.hasta.isoformat()},
            separators=(",", ":"),
        )

    def etiqueta(self) -> str:
        return f"{self.desde.isoformat()} a {self.hasta.isoformat()}"

    def __str__(self) -> str:
        return self.etiqueta()


def semana_iso(ancla: date) -> RangoFechas:
    """La semana lunes-domingo que contiene `ancla`.

    Convención del proyecto: la corrida del lunes analiza la semana anterior
    completa, nunca una semana en curso (que daría datos parciales).
    """
    lunes = ancla - timedelta(days=ancla.weekday())
    return RangoFechas(lunes, lunes + timedelta(days=6))


def semana_anterior_a(ancla: date) -> RangoFechas:
    """La semana cerrada previa a `ancla`. Es lo que lee la corrida del lunes."""
    return semana_iso(ancla - timedelta(days=7))


def id_semana(rango: RangoFechas) -> str:
    """Identificador estable de corrida, p. ej. `2026-W34`.

    Se usa como nombre de carpeta y es la clave de idempotencia: dos corridas
    del mismo periodo escriben en el mismo lugar en lugar de duplicar.
    """
    anio, semana, _ = rango.desde.isocalendar()
    return f"{anio}-W{semana:02d}"


def rechaza_preset(valor: str | None) -> None:
    """Aborta si alguien intenta usar un rango móvil."""
    if valor and valor in PRESETS_PROHIBIDOS:
        raise ConvencionViolada(
            f"El preset '{valor}' es un rango móvil y está prohibido.",
            contexto={"preset": valor},
            remedio=(
                "Usar RangoFechas con fechas explícitas. Un rango móvil hace que "
                "la misma corrida devuelva distinto al día siguiente y rompe la "
                "comparabilidad entre semanas."
            ),
        )
