"""Registro de corridas: trazabilidad e idempotencia.

Resuelve ADR-010. Cada corrida vive en una carpeta nombrada por su periodo
(`2026-W34`), lo que da idempotencia gratis: dos corridas del mismo periodo
escriben en el mismo lugar en lugar de duplicar.

La estructura separa lo crudo de lo derivado, y esa separación **es** la
trazabilidad: cualquier número de un entregable se puede seguir hasta el JSON
que devolvió la API.

    data/historico/<id_semana>/
      corrida.json        metadatos: rango, fuentes usadas, huecos declarados
      crudo/              respuestas de las APIs, sin editar
      normalizado/        lo que produjo src/base
      analisis/           hallazgos y plan
      *.pptx              el entregable
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field, asdict
from datetime import date
from pathlib import Path

from .convenciones import RAIZ, RangoFechas, id_semana
from .errores import DatoFaltante

HISTORICO = RAIZ / "data" / "historico"


@dataclass
class Hueco:
    """Un dato que faltó. Se declara, nunca se rellena."""

    fuente: str
    descripcion: str
    impacto: str


@dataclass
class Fuente:
    """Una consulta que alimentó la corrida. Es la unidad de trazabilidad."""

    nombre: str
    herramienta: str
    parametros: dict
    archivo_crudo: str
    registros: int | None = None

    def cita(self) -> str:
        """Cómo se cita esta fuente en un entregable."""
        return f"{self.nombre} ({self.herramienta}, {self.archivo_crudo})"


@dataclass
class Corrida:
    """Una ejecución del Módulo 1."""

    rango: RangoFechas
    ejecutada: str
    dry_run: bool = False
    fuentes: list[Fuente] = field(default_factory=list)
    huecos: list[Hueco] = field(default_factory=list)
    notas: list[str] = field(default_factory=list)

    @property
    def id(self) -> str:
        return id_semana(self.rango)

    @property
    def carpeta(self) -> Path:
        return HISTORICO / self.id

    def prepara(self) -> Path:
        for sub in ("crudo", "normalizado", "analisis"):
            (self.carpeta / sub).mkdir(parents=True, exist_ok=True)
        return self.carpeta

    def guarda_crudo(self, nombre: str, datos, *, herramienta: str,
                     parametros: dict, registros: int | None = None) -> Fuente:
        """Persiste una respuesta sin editar y la registra como fuente."""
        self.prepara()
        archivo = f"crudo/{nombre}.json"
        (self.carpeta / archivo).write_text(
            json.dumps(datos, indent=2, ensure_ascii=False), encoding="utf-8")
        fuente = Fuente(nombre, herramienta, parametros, archivo, registros)
        self.fuentes.append(fuente)
        return fuente

    def lee_crudo(self, nombre: str):
        ruta = self.carpeta / "crudo" / f"{nombre}.json"
        if not ruta.exists():
            raise DatoFaltante(
                f"Falta la respuesta cruda '{nombre}' de la corrida {self.id}.",
                contexto={"ruta": str(ruta)},
                remedio="Ejecutar el paso de adquisición antes del de análisis.",
            )
        return json.loads(ruta.read_text(encoding="utf-8"))

    def guarda(self, subcarpeta: str, nombre: str, datos) -> Path:
        self.prepara()
        ruta = self.carpeta / subcarpeta / f"{nombre}.json"
        ruta.write_text(json.dumps(datos, indent=2, ensure_ascii=False,
                                   default=str), encoding="utf-8")
        return ruta

    def declara_hueco(self, fuente: str, descripcion: str, impacto: str) -> None:
        """Registra un dato faltante. Es la alternativa a inventarlo."""
        self.huecos.append(Hueco(fuente, descripcion, impacto))

    def cierra(self) -> Path:
        meta = {
            "id": self.id,
            "rango": {"desde": self.rango.desde.isoformat(),
                      "hasta": self.rango.hasta.isoformat(),
                      "dias": self.rango.dias},
            "ejecutada": self.ejecutada,
            "dry_run": self.dry_run,
            "fuentes": [asdict(f) for f in self.fuentes],
            "huecos": [asdict(h) for h in self.huecos],
            "notas": self.notas,
        }
        self.prepara()
        ruta = self.carpeta / "corrida.json"
        ruta.write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")
        return ruta

    @classmethod
    def existe(cls, rango: RangoFechas) -> bool:
        """Idempotencia: ¿ya se corrió este periodo?"""
        return (HISTORICO / id_semana(rango) / "corrida.json").exists()

    @classmethod
    def anterior_a(cls, rango: RangoFechas) -> dict | None:
        """La corrida de la semana previa, para el loop de verificación.

        Devuelve None si no existe. Eso NO es un dato faltante: en la primera
        corrida es un estado válido y el paso 6 debe reportar "no aplicable"
        en lugar de abortar (riesgo C).
        """
        from datetime import timedelta
        previo = RangoFechas(rango.desde - timedelta(days=7),
                             rango.hasta - timedelta(days=7))
        ruta = HISTORICO / id_semana(previo) / "corrida.json"
        if not ruta.exists():
            return None
        return json.loads(ruta.read_text(encoding="utf-8"))
