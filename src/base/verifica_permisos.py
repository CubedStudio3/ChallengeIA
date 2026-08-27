"""Prueba de la frontera de permisos.

La regla 4 del proyecto dice que solo el `orquestador` escribe en sistemas
externos, y ADR-012 que Meta Ads es solo lectura. Esas dos reglas están escritas
en documentos; este módulo las convierte en algo que falla ruidosamente si
alguien las rompe al editar un agente.

Se ejecuta como parte del arranque de cualquier corrida.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
AGENTES = RAIZ / ".claude" / "agents"

# Verbos que delatan una herramienta de escritura en el nombre.
VERBOS_DE_ESCRITURA = (
    "create", "update", "delete", "add", "remove", "publish", "upload",
    "activate", "boost", "connect", "disconnect", "move", "link", "delink",
    "start", "complete", "cancel", "approve", "edit", "change", "associate",
    "set", "trigger", "merge", "fork", "push",
)

# Excepciones: nombres que contienen un verbo de escritura pero solo leen.
LECTURAS_QUE_PARECEN_ESCRITURA = {
    "mcp__Zoho_Social_MK__ZohoSocial_validateSocialPost",  # valida, no crea
}

# Único agente autorizado a escribir en sistemas externos (regla 4).
UNICO_ESCRITOR = "orquestador"

# Sistemas donde ninguna escritura está permitida, para nadie (ADR-012).
SOLO_LECTURA_ABSOLUTA = ("mcp__Meta_MCP__",)


def herramientas_de(archivo: Path) -> list[str]:
    texto = archivo.read_text(encoding="utf-8")
    m = re.search(r"^tools:\s*(.+)$", texto, re.MULTILINE)
    if not m:
        return []
    return [t.strip() for t in m.group(1).split(",") if t.strip()]


def es_escritura(nombre: str) -> bool:
    if not nombre.startswith("mcp__"):
        return False
    if nombre in LECTURAS_QUE_PARECEN_ESCRITURA:
        return False
    operacion = nombre.split("__")[-1]
    # separar camelCase y snake_case para no confundir 'update' dentro de otra palabra
    palabras = re.findall(r"[a-z]+|[A-Z][a-z]*", operacion)
    return any(p.lower() in VERBOS_DE_ESCRITURA for p in palabras)


def verifica() -> list[str]:
    if not AGENTES.exists():
        return [f"No existe {AGENTES}"]
    fallas = []
    for archivo in sorted(AGENTES.glob("*.md")):
        agente = archivo.stem
        for h in herramientas_de(archivo):
            for prefijo in SOLO_LECTURA_ABSOLUTA:
                if h.startswith(prefijo) and es_escritura(h):
                    fallas.append(
                        f"{agente}: tiene '{h}'. {prefijo.strip('_')} es SOLO "
                        f"LECTURA para todos, incluido el orquestador (ADR-012).")
            if es_escritura(h) and agente != UNICO_ESCRITOR:
                fallas.append(
                    f"{agente}: tiene la herramienta de escritura '{h}'. Solo "
                    f"'{UNICO_ESCRITOR}' escribe en sistemas externos (regla 4).")
    return fallas


def informe() -> int:
    fallas = verifica()
    print("FRONTERA DE PERMISOS")
    print("─" * 74)
    for archivo in sorted(AGENTES.glob("*.md")):
        hs = herramientas_de(archivo)
        mcp = [h for h in hs if h.startswith("mcp__")]
        escrituras = [h for h in mcp if es_escritura(h)]
        marca = "ESCRIBE" if escrituras else "lectura"
        print(f"  {archivo.stem:22} {len(mcp):>3} conectores · {marca:8}"
              + (f" ({len(escrituras)} de escritura)" if escrituras else ""))
    print("─" * 74)
    if fallas:
        print(f"\n{len(fallas)} VIOLACIÓN(ES):")
        for f in fallas:
            print(f"  ✗ {f}")
        return 1
    print("\nSin violaciones: ningún agente de análisis escribe, y Meta Ads es")
    print("solo lectura para todos.")
    return 0


if __name__ == "__main__":
    raise SystemExit(informe())
