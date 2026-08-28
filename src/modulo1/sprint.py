"""Paso 9 · convertir decisiones de la mesa en work items de Zoho Sprint.

Este módulo **no toca la red**. Construye el plan de escritura y lo imprime; la
llamada la hace el agente `orquestador`, que es el único con herramientas de
escritura (regla 4). Así el plan es reproducible y revisable sin arriesgar nada.

Lo que se aprendió al conectar el conector el 2026-08-28, y que cambia el
diseño:

- `CreateItem` exige **cinco** identificadores, no dos: `teamId`, `projectId` y
  `sprintId` en la ruta, más `projitemtypeid` y `projpriorityid` como parámetros
  obligatorios. El documento maestro suponía que bastaba con el proyecto.
- De los cinco, **cuatro se pueden leer por API** una vez que se tiene el
  primero. El `teamId` es el único que tiene que venir de una persona: ninguna
  de las ~78 operaciones del conector lista los espacios de trabajo.
- La autenticación **ya funciona**. Se verificó porque Zoho devolvió su propio
  sobre de error (`7404 · Given URL is wrong`) en lugar de un fallo de
  autorización: un error estructurado significa que la llamada llegó y el token
  sirvió.

Uso:
    python -m modulo1.sprint --corrida <carpeta> [--decisiones <archivo>] [--dry-run]
    python -m modulo1.sprint --descubrir      # imprime qué falta y cómo obtenerlo
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path

from base.convenciones import cargar
from base.errores import ConfiguracionBloqueada, DatoFaltante, FallaRuidosa

# Los cinco que exige CreateItem. Se comprueban todos antes de armar nada: un
# plan a medias que falla en la llamada 3 de 7 deja la mitad de los items
# creados y rompe la idempotencia.
IDS_REQUERIDOS = ("team_id", "project_id", "sprint_id", "item_type_id", "priority_id")

# Solo el primero necesita a una persona. Los otros se descubren por API.
SOLO_HUMANO = ("team_id",)


@dataclass
class Escritura:
    """Una llamada a CreateItem, ya armada y lista para revisar."""

    id_tarea: str
    nombre: str
    descripcion: str
    tipo: str
    responsable: str | None
    idempotencia: str
    ruta: dict = field(default_factory=dict)
    parametros: dict = field(default_factory=dict)

    def como_llamada(self) -> dict:
        """La forma exacta que espera el conector. Esto es lo que muestra --dry-run."""
        return {
            "herramienta": "mcp__Zoho_Sprints__ZohoSprints_CreateItem",
            "path_variables": self.ruta,
            "query_params": self.parametros,
            "headers": {"x-za-ui-version": "v2", "X-convert-response": "true"},
        }


def _marca(idem: str) -> str:
    """Marca de idempotencia que viaja DENTRO del item.

    Sprint no expone webhooks ni un campo de clave externa, así que la única
    forma de reconocer un item ya creado en una segunda corrida es buscar esta
    marca en su nombre con `GetItems --searchvalue`. Es fea a propósito: tiene
    que ser improbable de escribir a mano.
    """
    return f"[MC:{idem}]"


def revisa_configuracion(equipo: dict) -> tuple[list[dict], list[dict]]:
    """Qué falta, separado en dos cosas que NO son lo mismo.

    - **Bloqueos**: sin esto no se puede crear el work item. Son los cinco
      identificadores de `CreateItem` y el permiso de escritura.
    - **Limitaciones**: se puede crear igual, pero algo queda a medias.

    La distinción existe porque estaban mezcladas y eso fue un error real: la
    falta de lista de personas figuraba como bloqueo, cuando el propio texto que
    la acompañaba decía «se puede crear el item, pero no asignarlo». El
    parámetro `users` es opcional; un item sin responsable se crea perfectamente
    y alguien lo asigna después en Sprint. Tratar eso como bloqueo dejaba el paso
    9 apagado por un motivo que no lo justificaba.

    Devuelve las listas completas en lugar de abortar en el primer faltante:
    quien lee esto quiere saber todo lo que falta, no descubrirlo de uno en uno.
    """
    faltan = []
    proy = equipo.get("proyecto_sprint") or {}
    for k in IDS_REQUERIDOS:
        if proy.get(k):
            continue
        faltan.append({
            "campo": f"proyecto_sprint.{k}",
            "lo_da": "una persona" if k in SOLO_HUMANO else "la API, con el team_id",
            "como": (proy.get("_nota", "") if k in SOLO_HUMANO
                     else {
                         "project_id": "GetProjects(teamId)",
                         "sprint_id": "GetSprints(teamId, projectId)",
                         "priority_id": "GetProjectPriorities(teamId, projectId)",
                         "item_type_id": ("GetItems o la configuración del proyecto; "
                                          "el conector no expone un listado propio "
                                          "de tipos de item"),
                     }[k]),
        })
    if not _puede_escribir(proy):
        faltan.append({
            "campo": "proyecto_sprint._es_de_prueba  o  _autorizacion_produccion",
            "lo_da": "una persona",
            "como": ("Una de dos: marcar _es_de_prueba en true (proyecto de "
                     "prueba), o registrar _autorizacion_produccion.otorgada en "
                     "true con quién la dio y con qué texto. ADR-012 prohíbe "
                     "escribir en producción durante desarrollo; la excepción "
                     "existe pero tiene que quedar firmada, no supuesta."),
        })
    limita = []
    if not equipo.get("personas"):
        limita.append({
            "campo": "personas",
            "que_pasa": ("Los work items se crean SIN responsable. Alguien los "
                         "asigna después a mano en Sprint."),
            "como": ("Llenar 'personas' con nombre y User ID de Sprints. El "
                     "parámetro `users` de CreateItem espera IDs, no correos."),
        })
    if not (equipo.get("capacidad_semanal") or {}).get("artes"):
        limita.append({
            "campo": "capacidad_semanal",
            "que_pasa": ("Las tareas creativas salen sin cantidad de piezas: la "
                         "decide la mesa."),
            "como": "Declarar capacidad_semanal en config/equipo.json.",
        })
    return faltan, limita


def _puede_escribir(proy: dict) -> bool:
    """Si el destino admite escritura real, y por qué motivo.

    Dos caminos, y ninguno es marcar la casilla a la ligera:

    - `_es_de_prueba: true` — el proyecto es de prueba (el camino de ADR-012).
    - `_autorizacion_produccion.otorgada: true` — una persona autorizó escribir
      en un proyecto real, y quedó registrado quién, cuándo y con qué palabras.

    Se separan a propósito. Marcar un proyecto de producción como «de prueba»
    para que pase la validación dejaría el archivo mintiendo sobre qué es ese
    proyecto, y la próxima persona que lo lea tomaría una decisión sobre una
    premisa falsa.
    """
    if proy.get("_es_de_prueba") is True:
        return True
    return bool((proy.get("_autorizacion_produccion") or {}).get("otorgada"))


def _motivo_de_escritura(proy: dict) -> str:
    if proy.get("_es_de_prueba") is True:
        return "el proyecto está marcado como de PRUEBA"
    a = proy.get("_autorizacion_produccion") or {}
    return (f"escritura en PRODUCCIÓN autorizada por {a.get('por', 'alguien')} "
            f"el {a.get('fecha', 'sin fecha')} · alcance: "
            f"{a.get('_alcance', 'no declarado')}")


def _destino(equipo: dict) -> str:
    """Una línea que diga a dónde iría esto y con qué permiso.

    Va en la cabecera del reporte porque es lo primero que alguien tiene que
    poder verificar de un vistazo: si el proyecto es el correcto y si el permiso
    para escribir ahí existe de verdad.
    """
    proy = equipo.get("proyecto_sprint") or {}
    nombre = proy.get("nombre") or "(sin nombre)"
    pid = proy.get("project_id") or "?"
    permiso = (_motivo_de_escritura(proy) if _puede_escribir(proy)
               else "SIN PERMISO de escritura")
    return f"DESTINO · «{nombre}» ({pid})\nPERMISO · {permiso}"


def _acepta(dec: dict, id_tarea: str) -> dict | None:
    d = (dec.get("decisiones") or {}).get(id_tarea)
    return d if d and d.get("estado") == "aceptada" else None


def plan(resultado: dict, decisiones: dict, equipo: dict) -> tuple[list[Escritura], list[str]]:
    """Arma el plan de escritura a partir de lo que la mesa aceptó.

    Si no se pasan decisiones, NO se asume que todo está aceptado: se devuelve
    un plan vacío y se dice por qué. Crear tareas que nadie aprobó sería
    exactamente lo que la compuerta humana existe para impedir (ADR-002).
    """
    est = resultado.get("estrategia") or {}
    proy = (equipo.get("proyecto_sprint") or {})
    avisos = []

    elegida = decisiones.get("estrategia") or est.get("recomendada")
    tareas = est.get("tareas") or []
    if elegida:
        tareas = [t for t in tareas
                  if t.get("siempre") or elegida in (t.get("estrategias") or [])]
        avisos.append(f"Estrategia aplicada: {elegida}")

    ruta = {"teamId": str(proy.get("team_id") or ""),
            "projectId": str(proy.get("project_id") or ""),
            "sprintId": str(proy.get("sprint_id") or "")}

    escrituras = []
    for t in tareas:
        d = _acepta(decisiones, t["id"])
        if not d:
            continue
        cuerpo = [t.get("porque", "")]
        if t.get("angulo"):
            cuerpo.append(f"\nÁNGULO: {t['angulo']}")
        if t.get("no_decir"):
            cuerpo.append(f"\nNO DECIR: «{t['no_decir']}» — ese terreno ya lo paga "
                          f"la competencia.")
        if t.get("instruccion_exacta"):
            cuerpo.append(f"\nINSTRUCCIÓN EXACTA: {t['instruccion_exacta']}")
        if t.get("evidencia"):
            cuerpo.append("\nEVIDENCIA:\n" +
                          "\n".join(f"  · {e}" for e in t["evidencia"]))
        cuerpo.append(f"\nCopy: {(t.get('copy') or {}).get('estado', '')} — "
                      f"{(t.get('copy') or {}).get('motivo', '')}")
        cuerpo.append(f"\nGenerado por Mesa Creativa · corrida "
                      f"{(resultado.get('corrida') or {}).get('rango', '')}")

        params = {
            "name": f"{t['titulo']} {_marca(t['idempotencia'])}",
            "description": "\n".join(cuerpo).strip(),
            "projitemtypeid": str(proy.get("item_type_id") or ""),
            "projpriorityid": str(proy.get("priority_id") or ""),
        }
        if d.get("responsable"):
            params["users"] = str(d["responsable"])

        escrituras.append(Escritura(
            id_tarea=t["id"], nombre=t["titulo"],
            descripcion=params["description"], tipo=t["tipo"],
            responsable=d.get("responsable"),
            idempotencia=t["idempotencia"], ruta=ruta, parametros=params))

    for pid, pt in (decisiones.get("propias") or {}).items():
        if pt.get("estado") != "aceptada":
            continue
        cuerpo = [pt.get("detalle") or ""]
        cuerpo.append("\nORIGEN: idea del equipo. NO tiene evidencia del sistema; "
                      "la propuso una persona en la mesa.")
        if pt.get("referencias"):
            cuerpo.append("\nREFERENCIAS:\n" +
                          "\n".join(f"  · {u}" for u in pt["referencias"]))
        params = {
            "name": f"{pt['titulo']} {_marca('equipo::' + pid)}",
            "description": "\n".join(cuerpo).strip(),
            "projitemtypeid": str(proy.get("item_type_id") or ""),
            "projpriorityid": str(proy.get("priority_id") or ""),
        }
        if pt.get("responsable"):
            params["users"] = str(pt["responsable"])
        escrituras.append(Escritura(
            id_tarea=pid, nombre=pt["titulo"], descripcion=params["description"],
            tipo=pt.get("tipo", "arte"), responsable=pt.get("responsable"),
            idempotencia="equipo::" + pid, ruta=ruta, parametros=params))

    if not decisiones.get("decisiones") and not decisiones.get("propias"):
        avisos.append(
            "No se recibieron decisiones de la mesa, así que el plan está vacío. "
            "NO se asume que todo está aceptado: la compuerta humana existe "
            "justamente para eso (ADR-002). Use --decisiones con el JSON que "
            "copia el tablero.")
    return escrituras, avisos


def imprime(escrituras: list[Escritura], faltan: list[dict], avisos: list[str],
            dry_run: bool, destino: str = "", limita: list[dict] | None = None) -> None:
    L = "─" * 74
    print(f"\n{'═' * 74}\nPASO 9 · ESCRITURA EN ZOHO SPRINT")
    print("MODO --dry-run · NO se escribe nada" if dry_run
          else "MODO REAL · el orquestador ejecutaría estas llamadas")
    if destino:
        print(destino)
    print("═" * 74)

    for a in avisos:
        print(f"\n  {a}")

    if faltan:
        print(f"\nFALTA CONFIGURACIÓN · {len(faltan)} campos\n{L}")
        for f in faltan:
            print(f"\n  {f['campo']}")
            print(f"    lo da: {f['lo_da']}")
            print(f"    cómo:  {f['como']}")
        print(f"\n  → Con estos campos vacíos NO se puede escribir. El plan de "
              f"abajo se imprime igual\n    para que se pueda revisar el "
              f"contenido, pero sus IDs saldrían en blanco.")

    if limita:
        n = len(limita)
        print(f"\nSE PUEDE ESCRIBIR IGUAL · {n} "
              f"{'limitación' if n == 1 else 'limitaciones'}\n{L}")
        for l in limita:
            print(f"\n  {l['campo']}: {l['que_pasa']}")
            print(f"    cómo levantarla: {l['como']}")

    print(f"\nPLAN · {len(escrituras)} work items\n{L}")
    if not escrituras:
        print("  (ninguno)")
    for e in escrituras:
        print(f"\n  [{e.tipo}] {e.nombre}")
        print(f"    responsable: {e.responsable or 'sin asignar'}")
        print(f"    idempotencia: {e.idempotencia}")
        print(f"    marca en el nombre: {_marca(e.idempotencia)}")
        print("    llamada:")
        for linea in json.dumps(e.como_llamada(), indent=2,
                                ensure_ascii=False).splitlines():
            print(f"      {linea}")

    print(f"\nIDEMPOTENCIA\n{L}")
    print("  Sprint no expone webhooks ni un campo de clave externa, así que la")
    print("  única forma de reconocer un item ya creado es buscar su marca con")
    print("  GetItems(searchvalue='[MC:...]') ANTES de crear. El orquestador debe")
    print("  hacer esa lectura por cada item; si la encuentra, actualiza en lugar")
    print("  de crear. Dos corridas del mismo periodo no duplican (regla 7).")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--corrida", type=Path)
    ap.add_argument("--decisiones", type=Path,
                    help="JSON de decisiones copiado del tablero")
    ap.add_argument("--descubrir", action="store_true",
                    help="Solo reporta qué falta para poder escribir")
    ap.add_argument("--dry-run", action="store_true", default=True)
    ap.add_argument("--real", dest="dry_run", action="store_false",
                    help="Desactiva --dry-run. Requiere _es_de_prueba en true.")
    a = ap.parse_args()

    equipo = cargar("equipo", permitir_bloqueado=True)
    faltan, limita = revisa_configuracion(equipo)

    if a.descubrir:
        imprime([], faltan, ["Modo --descubrir: solo se revisa la configuración."],
                True, _destino(equipo), limita)
        return 1 if faltan else 0

    if not a.corrida:
        print("Falta --corrida (o usar --descubrir).", file=sys.stderr)
        return 2

    r = json.loads((a.corrida / "analisis" / "resultado.json")
                   .read_text(encoding="utf-8"))
    dec = (json.loads(a.decisiones.read_text(encoding="utf-8"))
           if a.decisiones else {})

    if not a.dry_run:
        if faltan:
            raise FallaRuidosa(
                "Se pidió escritura real y falta configuración.",
                contexto={"faltantes": [f["campo"] for f in faltan]},
                remedio="Llenar config/equipo.json. Ver --descubrir.")
        proy = equipo.get("proyecto_sprint") or {}
        if not _puede_escribir(proy):
            raise ConfiguracionBloqueada(
                "El destino no admite escritura real.",
                contexto={"proyecto": proy.get("nombre")},
                remedio=("ADR-012: durante desarrollo no se escribe en producción. "
                         "Marcar _es_de_prueba, o registrar "
                         "_autorizacion_produccion con quién la otorgó."))

    escrituras, avisos = plan(r, dec, equipo)
    imprime(escrituras, faltan, avisos, a.dry_run, _destino(equipo), limita)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except FallaRuidosa as e:
        print(f"\n{e}", file=sys.stderr)
        raise SystemExit(1)
