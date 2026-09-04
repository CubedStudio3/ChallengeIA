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


def _evidencia(e) -> str:
    """Una línea de evidencia, venga como texto o como estructura.

    Las tareas traen evidencia de dos formas: unas veces una frase ya escrita,
    otras un dict con `dato`, `valor` y `fuente`. Interpolar el dict con f-string
    metía `{'dato': 'Más eficiente', 'valor': ...}` literal dentro de la
    descripción del work item — comillas de Python incluidas. Se vio en el
    --dry-run de la tarea de brecha de eficiencia, antes de escribir nada.

    La fuente NO se resume ni se recorta: es lo que hace auditable el número.
    """
    if isinstance(e, str):
        return e
    if isinstance(e, dict):
        dato = e.get("dato") or e.get("que") or ""
        valor = e.get("valor") or ""
        fuente = e.get("fuente") or ""
        partes = [x for x in (f"{dato}: {valor}".strip(": "), fuente) if x]
        return " · ".join(partes) if partes else str(e)
    return str(e)


def _usuarios(responsable) -> str:
    """El parámetro `users` de CreateItem, con la forma exacta que exige Zoho.

    NO es el ID suelto. Zoho espera un **arreglo JSON serializado como texto**:
    `["21897000001144001"]`. Pasar `"21897000001144001"` a secas devuelve

        {"code":7600,"message":"Given JSON is invalid","status":"failed"}

    que no dice nada sobre users y manda a buscar el problema a otra parte.
    Verificado el 2026-08-31 con una escritura real: el ID suelto falló, el
    arreglo creó el item I1149 asignado a la persona correcta.

    Acepta uno o varios responsables: el campo es plural del lado de Zoho.
    """
    if responsable is None:
        return "[]"
    ids = responsable if isinstance(responsable, (list, tuple)) else [responsable]
    return json.dumps([str(x) for x in ids if x])


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

    # El id de semana, de una sola fuente: el prefijo de la idempotencia que ya
    # traen las tareas de la corrida. Recalcularlo aquí sería una segunda
    # implementación de la misma convención, que es como se desincronizan.
    semana = ""
    for t in (est.get("tareas") or []):
        pref = (t.get("idempotencia") or "").split("::")[0]
        if pref:
            semana = pref
            break
    if not semana:
        semana = ((resultado.get("corrida") or {}).get("rango") or "sin-periodo")

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
                          "\n".join(f"  · {_evidencia(e)}" for e in t["evidencia"]))
        cp = t.get("copy") or {}
        if cp.get("titular"):
            cuerpo.append(f"\nCOPY PROPUESTO (pendiente de aprobación):\n"
                          f"  Titular: {cp['titular']}\n"
                          f"  Cuerpo: {cp.get('cuerpo', '')}\n"
                          f"  CTA: {cp.get('cta', '')}")
        elif cp.get("estado"):
            cuerpo.append(f"\nCopy: {cp.get('estado', '')} — {cp.get('motivo', '')}")
        cuerpo.append(f"\nGenerado por Mesa Creativa · corrida "
                      f"{(resultado.get('corrida') or {}).get('rango', '')}")

        params = {
            "name": f"{t['titulo']} {_marca(t['idempotencia'])}",
            "description": "\n".join(cuerpo).strip(),
            "projitemtypeid": str(proy.get("item_type_id") or ""),
            "projpriorityid": str(proy.get("priority_id") or ""),
        }
        if d.get("responsable"):
            params["users"] = _usuarios(d["responsable"])

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
            params["users"] = _usuarios(pt["responsable"])
        escrituras.append(Escritura(
            id_tarea=pid, nombre=pt["titulo"], descripcion=params["description"],
            tipo=pt.get("tipo", "arte"), responsable=pt.get("responsable"),
            idempotencia="equipo::" + pid, ruta=ruta, parametros=params))

    # --- Las cartas de producción ------------------------------------------
    # Desde ADR-042 la unidad que la mesa aprueba es la CARTA, no la tarea. El
    # paso 9 solo entendía las tareas, así que aprobar una carta en el tablero
    # no producía nada: se veía como que el botón no servía. Una carta trae más
    # que una tarea —el copy completo, la dirección visual y la referencia— y
    # todo eso va al work item, porque es lo que necesita quien produce.
    for c in ((resultado.get("cartas") or {}).get("cartas") or []):
        d = _acepta(decisiones, c["id"])
        if not d:
            continue
        cuerpo = [c.get("que_hacer", "")]
        if c.get("de_que_hablar"):
            cuerpo.append(f"\nENFOCARSE EN: {c['de_que_hablar']}")
        if c.get("como_hablarlo"):
            cuerpo.append(f"\nCÓMO HABLARLO: {c['como_hablarlo']}")
        if c.get("porque"):
            cuerpo.append("\nLO QUE DICE EL ANÁLISIS:\n" +
                           "\n".join(f"  · {x}" for x in c["porque"]))
        cp = c.get("copy") or {}
        if cp.get("titular"):
            cuerpo.append(f"\nCOPY (pendiente de aprobación · regla 5):\n"
                          f"  Titular: {cp['titular']}\n"
                          f"  Cuerpo: {cp.get('cuerpo', '')}\n"
                          f"  CTA: {cp.get('cta', '')}")
        if c.get("lo_que_no_se_dice"):
            cuerpo.append(f"\nNO DICE: {c['lo_que_no_se_dice']}")
        vis = c.get("visual") or {}
        est = vis.get("estructura") or {}
        if est.get("que"):
            cuerpo.append(f"\nESTRUCTURA: {est['que']} — {est.get('porque', '')}")
        if vis.get("mostrar"):
            cuerpo.append("\nQUÉ MOSTRAR:\n" +
                           "\n".join(f"  · {x}" for x in vis["mostrar"]))
        if vis.get("no_mostrar"):
            cuerpo.append("\nQUE NO VAYA:\n" +
                           "\n".join(f"  · {x}" for x in vis["no_mostrar"]))
        ref = c.get("referencia") or {}
        if ref.get("marca"):
            cuerpo.append(f"\nREFERENCIA · {ref['marca']} ({ref.get('rol', '')})"
                          f"\n  {ref.get('que_hace', '')}"
                          f"\n  Medido: {ref.get('medido', '')}"
                          f"\n  {ref.get('url', '')}")
        if c.get("bloqueada_en"):
            cuerpo.append(f"\nNO USAR EN: {', '.join(c['bloqueada_en'])} — "
                          f"{c.get('_por_que_bloqueada', '')}")
        if c.get("faltantes"):
            cuerpo.append("\nLO QUE ESTA CORRIDA NO PUDO CONFIRMAR:\n" +
                           "\n".join(f"  · {x}" for x in c["faltantes"]))
        cuerpo.append(f"\nGenerado por Mesa Creativa · corrida "
                      f"{(resultado.get('corrida') or {}).get('rango', '')}")

        # La marca de idempotencia lleva el id de semana, igual que las tareas.
        # No se recalcula aquí: se toma del prefijo que las tareas ya traen, para
        # que las dos familias usen LA MISMA convención. Si no hay tareas en la
        # corrida, cae al periodo, que también es estable por corrida.
        idem = f"{semana}::{c['pieza']}::{c['id']}"
        params = {
            "name": f"{c['titulo']} · {c.get('mercado', '')} {_marca(idem)}".strip(),
            "description": "\n".join(cuerpo).strip(),
            "projitemtypeid": str(proy.get("item_type_id") or ""),
            "projpriorityid": str(proy.get("priority_id") or ""),
        }
        if d.get("responsable"):
            params["users"] = _usuarios(d["responsable"])
        escrituras.append(Escritura(
            id_tarea=c["id"], nombre=params["name"],
            descripcion=params["description"], tipo=c["pieza"],
            responsable=d.get("responsable"), idempotencia=idem,
            ruta=ruta, parametros=params))

    if not decisiones.get("decisiones") and not decisiones.get("propias"):
        avisos.append(
            "No se recibieron decisiones de la mesa, así que el plan está vacío. "
            "NO se asume que todo está aceptado: la compuerta humana existe "
            "justamente para eso (ADR-002). Use --decisiones con el JSON que "
            "copia el tablero.")
    return escrituras, avisos


# Columnas del importador de work items de Zoho Sprints. El asistente de
# importacion deja mapear columna por columna, asi que estos nombres son un
# punto de partida razonable y no una promesa: no se pudo verificar el listado
# exacto desde aqui, y el paso de mapeo del asistente es donde se corrige
# cualquier diferencia.
COLUMNAS_CSV = ("Item Name", "Description", "Item Type", "Priority", "Assignee",
                "Status", "Tags")


def a_csv(escrituras: list[Escritura], tipos: dict | None = None) -> str:
    """Las mismas tareas, como archivo para el importador de Zoho Sprints.

    Existe porque el camino por API resultó frágil: el conector se cayó seis
    veces en una sesión y exige cinco identificadores que solo se leen estando
    conectado. El importador no necesita ninguno de los cinco — el proyecto y el
    sprint se eligen en el asistente— así que este camino funciona hoy, sin
    conector y sin que nadie tenga que buscar IDs en la consola del navegador.

    No reemplaza al camino por API: ése sigue siendo el que corre solo cada
    semana. Éste es el que desbloquea a la mesa mientras tanto.

    El nombre lleva la marca `[MC:...]` igual que por API, y NO es opcional. Sin
    ella, importar el CSV de dos semanas que comparten una tarea crea el item dos
    veces — y eso ya pasó: los items 1140 a 1142 del backlog de «Diseño y MK»
    entraron sin marca porque esta función escribía el título pelado. La marca es
    lo único que permite reconocer un item ya creado, porque Sprints no expone
    webhooks ni campo de clave externa.
    """
    import csv
    import io

    tipos = tipos or {"arte": "Task", "video": "Task", "pauta": "Task",
                      "dato": "Task"}
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\r\n")
    w.writerow(COLUMNAS_CSV)
    for e in escrituras:
        w.writerow([
            f"{e.nombre} {_marca(e.idempotencia)}",
            e.descripcion,
            tipos.get(e.tipo, "Task"),
            "Medium",
            e.responsable or "",
            "Open",
            f"mesa-creativa,{e.tipo}",
        ])
    return buf.getvalue()


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
    ap.add_argument("--csv", type=Path,
                    help="Escribe un CSV para el importador de Zoho Sprints. "
                         "No necesita conector ni los cinco identificadores.")
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

    if a.csv:
        a.csv.parent.mkdir(parents=True, exist_ok=True)
        a.csv.write_text(a_csv(escrituras), encoding="utf-8-sig")
        print(f"\nCSV para importar: {a.csv}")
        print(f"  {len(escrituras)} work items")
        print("  En Zoho Sprints: Configuración → Imports → Ítems de trabajo.")
        print("  El asistente deja mapear las columnas, así que si algún nombre")
        print("  no coincide se corrige ahí mismo, sin tocar el archivo.")
        print("  Se guarda con BOM para que Excel respete los acentos.")
        return 0

    imprime(escrituras, faltan, avisos, a.dry_run, _destino(equipo), limita)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except FallaRuidosa as e:
        print(f"\n{e}", file=sys.stderr)
        raise SystemExit(1)
