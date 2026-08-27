"""Errores del proyecto.

Todos heredan de `FallaRuidosa`. La regla 3 del proyecto exige que el sistema
se detenga y reporte en lugar de continuar con un dato dudoso, así que ninguno
de estos se captura para "seguir adelante": se capturan para reportar y abortar.
"""


class FallaRuidosa(Exception):
    """Base de todo error que debe detener una corrida."""

    def __init__(self, mensaje, *, contexto=None, remedio=None):
        self.contexto = contexto or {}
        self.remedio = remedio
        super().__init__(mensaje)

    def __str__(self):
        partes = [super().__str__()]
        if self.contexto:
            detalle = ", ".join(f"{k}={v!r}" for k, v in self.contexto.items())
            partes.append(f"  contexto: {detalle}")
        if self.remedio:
            partes.append(f"  qué hacer: {self.remedio}")
        return "\n".join(partes)


class DatoFaltante(FallaRuidosa):
    """Falta un dato necesario. Prohibido rellenar con estimaciones."""


class ConfiguracionBloqueada(FallaRuidosa):
    """Se intentó consumir un bloque de config con `_lock: true` (ADR-009)."""


class ConvencionViolada(FallaRuidosa):
    """Una consulta no cumple la convención de fechas verificada en V0."""


class IndicadorIncompatible(FallaRuidosa):
    """Se intentó agregar métricas con indicadores distintos (ADR-013).

    Éste es el error que evita el modo de falla más peligroso del proyecto:
    sumar 158 leads con 10,771 clics en enlace produce un número plausible y
    completamente falso.
    """


class PermisoDenegado(FallaRuidosa):
    """Se intentó una escritura prohibida. Meta Ads es solo lectura (ADR-012)."""
