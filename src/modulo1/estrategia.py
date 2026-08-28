"""Sección Estrategia: de los hallazgos a tareas que alguien puede aceptar.

La mesa creativa no necesita otro informe. Necesita saber qué producir. Este
módulo convierte cada hallazgo medido en una tarea concreta que se puede
aceptar, rechazar y asignar.

Tres reglas gobiernan lo que sale de aquí:

1. **Ninguna tarea sin evidencia.** Cada una carga el número que la justifica y
   de qué archivo salió. Una tarea sin evidencia no se propone.
2. **El copy final no se escribe.** La skill `contexto-marca` está
   deliberadamente incompleta: faltan tono, claims permitidos y restricciones
   legales de fintech. Sin eso, un copy sería inventado. Lo que sí se entrega
   es el **ángulo**: qué territorio atacar y cuál está ocupado. Eso se deduce
   de la medición, no del tono de marca.
3. **La cantidad de piezas no se adivina.** Cuántos artes caben en una semana
   es capacidad del equipo, no un dato de Meta ni de Ad Library. Si
   `config/equipo.json` declara capacidad, se reparte; si no, la tarea pide el
   número a la mesa en lugar de proponer uno.

Y una regla de permisos que atraviesa todo: **Meta Ads es solo lectura**
(ADR-012). Una tarea que implique cambiar pauta no se ejecuta: se redacta como
instrucción exacta para que una persona la aplique a mano.
"""

from __future__ import annotations

from dataclasses import dataclass, field

# Tipos de tarea. 'pauta' es especial: nunca la ejecuta el sistema.
TIPOS = ("video", "arte", "pauta", "dato")

COPY_BLOQUEADO = {
    "estado": "BLOQUEADO",
    "motivo": ("El copy publicable requiere el contexto de marca, que hoy está "
               "incompleto a propósito. Escribirlo sin eso sería inventarlo."),
    "falta": [
        "Tono de voz y ejemplos de lo que sí suena a QPayPro",
        "Claims permitidos y prohibidos en fintech regulada (GT y SV)",
        "Nombres oficiales de producto y cómo se escriben",
        "Diferenciadores verificables frente a competencia",
        "Quién aprueba un copy antes de publicarse",
    ],
    "donde": ".claude/skills/contexto-marca/SKILL.md",
    "_nota": ("Lo que sí entrega el sistema es el ÁNGULO: qué territorio atacar "
              "y cuál evitar. Eso sale de la medición, no del tono."),
}


@dataclass
class Tarea:
    id: str
    tipo: str
    titulo: str
    porque: str
    evidencia: list[str]
    angulo: str
    no_decir: str | None = None
    formato: str = ""
    rol_sugerido: str = ""
    piezas: int | None = None
    piezas_motivo: str = ""
    referencias: list[dict] = field(default_factory=list)
    requiere_humano: bool = False
    instruccion_exacta: str | None = None
    idempotencia: str = ""

    def __post_init__(self):
        if self.tipo not in TIPOS:
            raise ValueError(f"Tipo de tarea desconocido: {self.tipo}")
        if not self.evidencia:
            raise ValueError(
                f"La tarea '{self.titulo}' no trae evidencia. Una tarea sin el "
                f"dato que la justifica no se propone.")
        if self.tipo == "pauta" and not self.requiere_humano:
            raise ValueError(
                f"'{self.titulo}' es una tarea de pauta y no está marcada como "
                f"requiere_humano. Meta Ads es solo lectura (ADR-012): el sistema "
                f"nunca la ejecuta.")
        if self.requiere_humano and not self.instruccion_exacta:
            raise ValueError(
                f"'{self.titulo}' la aplica una persona pero no trae la "
                f"instrucción exacta. Decir 'ajustar la campaña' no es accionable.")

    def a_dict(self) -> dict:
        return {
            "id": self.id, "tipo": self.tipo, "titulo": self.titulo,
            "porque": self.porque, "evidencia": self.evidencia,
            "angulo": self.angulo, "no_decir": self.no_decir,
            "formato": self.formato, "rol_sugerido": self.rol_sugerido,
            "piezas": self.piezas, "piezas_motivo": self.piezas_motivo,
            "referencias": self.referencias,
            "requiere_humano": self.requiere_humano,
            "instruccion_exacta": self.instruccion_exacta,
            "copy": COPY_BLOQUEADO,
            "idempotencia": self.idempotencia,
            "_estado_inicial": "propuesta",
        }


def _cap(equipo: dict, clave: str) -> tuple[int | None, str]:
    """Capacidad declarada por el equipo, o el motivo por el que no se propone."""
    if equipo.get("_lock"):
        return None, ("config/equipo.json está bloqueado: nadie ha declarado la "
                      "capacidad semanal. La mesa pone el número.")
    c = (equipo.get("capacidad_semanal") or {}).get(clave)
    if c is None:
        return None, (f"No hay capacidad declarada de '{clave}'. Cuántas piezas "
                      f"caben en una semana es capacidad del equipo, no un dato "
                      f"que exista en Meta ni en Ad Library.")
    return int(c), f"Reparto sobre la capacidad declarada de {c} {clave} por semana."


def tareas(periodo: str, redes: dict, panoramas: dict, por_mercado: dict,
           refs: dict, equipo: dict) -> list[Tarea]:
    out: list[Tarea] = []
    det = redes.get("detalle", {})
    terr = refs.get("territorios", {})
    busq = refs.get("busquedas", [])

    def refs_de(tema_contiene: str) -> list[dict]:
        return [b for b in busq if tema_contiene.lower() in b["tema"].lower()]

    # --- 1. Una red que rinde y está callada ---
    for nombre in ("tiktok", "youtube"):
        r = det.get(nombre) or {}
        if not (r.get("silenciosa") and r.get("vistas") is not None):
            continue
        # Una red callada no tiene mejor pieza DEL PERIODO. El argumento para
        # reactivarla es lo que rindió antes, y se rotula como histórico.
        mh = r.get("mejor_historico") or {}
        pico = mh.get("vistas") or 0
        n, motivo = _cap(equipo, "videos")
        out.append(Tarea(
            id=f"video-reactivar-{nombre}",
            tipo="video",
            titulo=f"Reactivar {nombre}: el canal con vistas reales lleva "
                   f"{r['dias_de_silencio']} días sin publicar",
            porque=(f"{nombre} es de las dos únicas redes que devuelven vistas. Su "
                    f"mejor pieza de todo lo leído ({r.get('publicaciones_leidas')} "
                    f"publicaciones) llegó a {pico:,} vistas, y no se ha publicado "
                    f"nada ahí desde {r['ultima_publicacion']}."),
            evidencia=[f"social_normalizado.json · {nombre} · última publicación "
                       f"{r['ultima_publicacion']}",
                       f"social_normalizado.json · {nombre} · máximo histórico "
                       f"{pico:,} vistas · «{(mh.get('titulo') or '')[:50]}» "
                       f"({mh.get('fecha')})"],
            angulo=("Retomar el tema que ya midió mejor en este canal, no estrenar "
                    "uno nuevo: el canal está frío y un tema probado arranca antes."),
            formato="video vertical corto",
            rol_sugerido="video",
            piezas=n, piezas_motivo=motivo,
            referencias=refs_de(nombre),
            idempotencia=f"{periodo}::video::reactivar-{nombre}",
        ))

    # --- 2. Un mensaje que la competencia tiene saturado ---
    for s in terr.get("saturados", []):
        n, motivo = _cap(equipo, "artes")
        out.append(Tarea(
            id=f"arte-contra-{s['de'].lower().replace(' ', '-')}-{s['mercado']}",
            tipo="arte",
            titulo=f"Contra-ángulo frente a {s['de']} en {s['mercado']}",
            porque=(f"{s['de']} concentra {s['cuota']:.0%} de sus anuncios activos "
                    f"en un solo mensaje ({s['repeticiones']} repeticiones, "
                    f"{s['dias_vivo']} días vivo). Repetir su promesa es competir "
                    f"de frente contra el presupuesto que ya la ocupa."),
            evidencia=[f"Ad Library · {s['de']} · «{s['mensaje']}» en "
                       f"{s['cuota']:.0%} de sus activos en {s['mercado']}",
                       f"Ad Library · foto del periodo, {s['repeticiones']} anuncios "
                       f"con ese titular"],
            angulo=("Resolver el mismo problema del dueño de negocio con otra "
                    "promesa. El terreno adyacente está libre; el de ellos no."),
            no_decir=s["mensaje"],
            formato="arte estático + variante para historia",
            rol_sugerido="diseño",
            piezas=n, piezas_motivo=motivo,
            referencias=refs_de(s["de"]),
            idempotencia=f"{periodo}::arte::contra-{s['de']}-{s['mercado']}",
        ))

    # --- 3. Un mercado sin disputa medida y con mejor costo ---
    for l in terr.get("libres", []):
        m = l["mercado"]
        pr = (por_mercado.get(m) or {}).get("principal") or {}
        cpr = pr.get("costo_por_resultado")
        otros = {k: (v.get("principal") or {}).get("costo_por_resultado")
                 for k, v in por_mercado.items() if k != m}
        comparables = {k: v for k, v in otros.items() if v}
        if not cpr:
            continue
        ev = [f"meta_campanas_por_pais.json · {m} · costo por resultado ${cpr:.2f}",
              f"Ad Library · {m} · 0 anuncios activos entre los competidores medidos"]
        mejor = all(cpr <= v for v in comparables.values()) if comparables else False
        comp_txt = (" y es el más barato de los mercados medidos ("
                    + ", ".join(f"{k} ${v:.2f}" for k, v in sorted(comparables.items()))
                    + ")") if mejor else ""
        n, motivo = _cap(equipo, "artes")
        out.append(Tarea(
            id=f"arte-mercado-libre-{m}",
            tipo="arte",
            titulo=f"Creativo propio para {m}: nadie más está pautando ahí",
            porque=(f"En {m} el costo por resultado es ${cpr:.2f}{comp_txt}, y "
                    f"ninguno de los competidores medidos tiene anuncios activos. "
                    f"Hoy se compite ahí contra nadie."),
            evidencia=ev,
            angulo=(f"Hablarle a {m} como {m}, no reciclar el creativo del otro "
                    f"mercado. El nombre de campaña no es dato de mercado: ya hubo "
                    f"una campaña con el país en el nombre entregando en otro país."),
            formato="arte estático + video corto",
            rol_sugerido="diseño",
            piezas=n, piezas_motivo=motivo,
            referencias=refs_de(m),
            idempotencia=f"{periodo}::arte::mercado-libre-{m}",
        ))

    # --- 4. Lo que ya rinde en orgánico y no se está repitiendo ---
    mejor_global = None
    for nombre, r in det.items():
        if not r.get("confiable", True):
            continue
        for m in (r.get("mejores") or []):
            marca = m.get("vistas") if m.get("vistas") is not None else m.get("interacciones")
            if m.get("titulo") and (mejor_global is None or marca > mejor_global[1]):
                mejor_global = (nombre, marca, m)
    if mejor_global:
        red, marca, m = mejor_global
        unidad = "vistas" if m.get("vistas") is not None else "interacciones"
        n, motivo = _cap(equipo, "artes")
        out.append(Tarea(
            id="arte-repetir-lo-que-rinde",
            tipo="arte",
            titulo=f"Repetir el tema que mejor rindió: «{m['titulo'][:60]}»",
            porque=(f"Es la pieza orgánica con más {unidad} del periodo medido "
                    f"({marca} en {red}, {m['fecha']}). El tema está validado con "
                    f"audiencia propia; lo que se repite es el tema, no el arte."),
            evidencia=[f"social_normalizado.json · {red} · {marca} {unidad} · {m['fecha']}"],
            angulo=("Tomar el tema que ya funcionó y llevarlo a otro formato y otra "
                    "red, en lugar de estrenar un tema sin validar."),
            formato="arte estático + adaptación vertical",
            rol_sugerido="diseño",
            piezas=n, piezas_motivo=motivo,
            referencias=refs_de("mejor rindió"),
            idempotencia=f"{periodo}::arte::repetir-{red}",
        ))

    return out


def cambios_en_pauta(hallazgos: list[dict], integridad: dict, periodo: str) -> list[Tarea]:
    """Cambios en Meta Ads. Ninguno lo ejecuta el sistema.

    Meta Ads es solo lectura por instrucción explícita del usuario (ADR-012).
    Cada cambio sale como instrucción exacta para que una persona la aplique.
    """
    out = []
    for pais, blq in (integridad.get("mercados_excluidos_con_gasto") or {}).items():
        camps = ", ".join(blq.get("campanas", []))
        out.append(Tarea(
            id=f"pauta-excluir-{pais}",
            tipo="pauta",
            titulo=f"Quitar {pais} de la segmentación: sigue gastando en un mercado "
                   f"que ya no es objetivo",
            porque=(f"{pais} está excluido de los mercados declarados y aun así "
                    f"registró ${blq.get('gasto', 0):.2f} y "
                    f"{int(blq.get('impresiones', 0)):,} impresiones en el periodo."),
            evidencia=[f"meta_campanas_por_pais.json · {pais} · "
                       f"${blq.get('gasto', 0):.2f} de gasto",
                       f"config/convenciones.json · {pais} excluido: "
                       f"{blq.get('motivo_de_exclusion', '')[:80]}"],
            angulo="No es creativo: es higiene de segmentación.",
            rol_sugerido="pauta",
            piezas_motivo="No aplica: es un cambio de configuración, no producción.",
            requiere_humano=True,
            instruccion_exacta=(
                f"En Meta Ads Manager, abrir el conjunto de anuncios de: {camps}. "
                f"En Audiencia → Ubicaciones, quitar {pais} de la lista de países. "
                f"Guardar. NO cambiar el objetivo de optimización: un ad set con "
                f"historial de entrega no se edita, se duplica. El sistema no lo "
                f"hace porque Meta Ads es solo lectura (ADR-012)."),
            idempotencia=f"{periodo}::pauta::excluir-{pais}",
        ))

    for h in hallazgos:
        if h.get("tipo") != "oportunidad" or "eficiencia" not in h.get("titulo", "").lower():
            continue
        out.append(Tarea(
            id="pauta-revisar-brecha",
            tipo="pauta",
            titulo=h["titulo"],
            porque=h["afirmacion"],
            evidencia=[str(e) for e in (h.get("evidencia") or [])] or [h.get("calculo", "")],
            angulo="Reasignación de presupuesto entre campañas del mismo indicador.",
            rol_sugerido="pauta",
            piezas_motivo="No aplica: es una decisión de presupuesto, no producción.",
            requiere_humano=True,
            instruccion_exacta=(
                "Llevar la brecha a la mesa y decidir ahí el monto a mover. El "
                "sistema NO propone la cifra: hacerlo sería un pronóstico, y el "
                "cálculo de oportunidad es aritmética sobre lo ya gastado, no una "
                "predicción de lo que pasaría al mover el presupuesto. "
                "El cambio lo aplica una persona en Ads Manager (ADR-012)."),
            idempotencia=f"{periodo}::pauta::brecha-eficiencia",
        ))
        break
    return out


def arma(periodo: str, redes: dict, panoramas: dict, por_mercado: dict,
         refs: dict, equipo: dict, hallazgos: list[dict], integridad: dict) -> dict:
    creativas = tareas(periodo, redes, panoramas, por_mercado, refs, equipo)
    de_pauta = cambios_en_pauta(hallazgos, integridad, periodo)
    todas = creativas + de_pauta

    bloqueado = bool(equipo.get("_lock"))
    return {
        "tareas": [t.a_dict() for t in todas],
        "conteo": {"creativas": len(creativas), "de_pauta": len(de_pauta),
                   "total": len(todas)},
        "asignacion": {
            "habilitada": not bloqueado,
            "personas": equipo.get("personas", []),
            "proyecto_sprint": equipo.get("proyecto_sprint", {}),
            "motivo_bloqueo": (equipo.get("_por_que_esta_bloqueado")
                               if bloqueado else None),
            "_como_desbloquear": equipo.get("_como_desbloquear") if bloqueado else None,
            "_flujo": ("Aceptar una tarea NO la crea en Sprint. La crea el agente "
                       "orquestador en el paso 9, y solo él: es el único que escribe "
                       "en sistemas externos (regla 4). El tablero registra la "
                       "decisión y a quién va; la escritura pasa por --dry-run antes."),
        },
        "limites": [
            {"que": "copy publicable",
             "estado": "BLOQUEADO",
             "detalle": COPY_BLOQUEADO["motivo"],
             "remedio": f"Llenar {COPY_BLOQUEADO['donde']} con los 5 insumos que lista."},
            {"que": "cantidad de piezas por tarea",
             "estado": ("DECLARADA" if not bloqueado else "LA DECIDE LA MESA"),
             "detalle": ("Cuántos artes o videos caben en una semana es capacidad "
                         "del equipo. No existe en Meta ni en Ad Library, así que "
                         "no se estima."),
             "remedio": "Declarar capacidad_semanal en config/equipo.json."},
            {"que": "ejecución de cambios en Meta Ads",
             "estado": "PROHIBIDA",
             "detalle": ("Meta Ads es solo lectura por instrucción explícita del "
                         "usuario (ADR-012). Ni siquiera en estado pausado."),
             "remedio": ("Las tareas de pauta salen con la instrucción exacta para "
                         "que una persona la aplique a mano.")},
        ],
    }
