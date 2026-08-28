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
    # A qué estrategias pertenece. Vacío + siempre=True significa que la tarea
    # no depende de la estrategia elegida (higiene, integridad).
    estrategias: list[str] = field(default_factory=list)
    siempre: bool = False

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
            "estrategias": self.estrategias,
            "siempre": self.siempre,
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
            estrategias=["repetir-lo-propio"],
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
            estrategias=["disputar-el-flanco"],
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
            estrategias=["mercado-sin-disputa"],
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
            estrategias=["repetir-lo-propio"],
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
            siempre=True,
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
            siempre=True,
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



def estrategias(redes: dict, panoramas: dict, por_mercado: dict,
                refs: dict, tareas_list: list[Tarea]) -> list[dict]:
    """Las estrategias candidatas, cada una con su premisa medida.

    El sistema **no elige** por la mesa. Propone las que su premisa sostiene,
    marca una como recomendada con la regla escrita a la vista, y dice de cada
    una cuándo NO conviene. Cambiar de estrategia cambia el conjunto de tareas,
    porque una tarea sin una estrategia detrás es una ocurrencia.

    Una estrategia solo aparece si su premisa se cumple en los datos. Si nadie
    tiene un mensaje saturado, no hay «disputar el flanco» que proponer.
    """
    det = redes.get("detalle", {})
    terr = refs.get("territorios", {})
    ids = {t.id for t in tareas_list}
    out = []

    # --- 1. Un mercado sin competencia medida y con mejor costo ---
    for l in terr.get("libres", []):
        m = l["mercado"]
        pr = (por_mercado.get(m) or {}).get("principal") or {}
        cpr = pr.get("costo_por_resultado")
        if not cpr:
            continue
        otros = {k: ((v.get("principal") or {}).get("costo_por_resultado"))
                 for k, v in por_mercado.items() if k != m}
        comparables = {k: v for k, v in otros.items() if v}
        mejor = all(cpr <= v for v in comparables.values()) if comparables else False
        gasto = pr.get("gasto") or 0
        gasto_total = sum((v.get("principal") or {}).get("gasto") or 0
                          for v in por_mercado.values())
        cuota = gasto / gasto_total if gasto_total else 0
        out.append({
            "id": "mercado-sin-disputa",
            "nombre": f"Empujar {m}, que hoy no se le disputa a nadie",
            "en_pocas_palabras": (
                f"Concentrar la producción de la semana en {m} en lugar de "
                f"repartirla entre los dos mercados. Creativo hecho para {m}, no "
                f"reciclado del otro."),
            "por_que": (
                f"Es el único mercado donde se juntan las dos cosas: el costo por "
                f"resultado más bajo (${cpr:.2f}"
                + (f" contra " + ", ".join(f"{k} ${v:.2f}"
                                           for k, v in sorted(comparables.items()))
                   if comparables else "")
                + f") y cero anuncios activos entre los competidores medidos. "
                f"Cuando nadie más compra esa atención, el creativo no compite por "
                f"ella." if mejor else
                f"En {m} no hay anuncios activos entre los competidores medidos, "
                f"así que la atención no está disputada."),
            "evidencia": [
                f"meta_campanas_por_pais.json · {m} · ${cpr:.2f} por resultado",
                f"Ad Library · {m} · 0 anuncios activos entre los competidores medidos",
            ],
            "cuando_no_conviene": (
                f"Si el equipo comercial de {m} no puede atender más leads. Y hay "
                f"un techo que no se puede medir desde aquí: {m} concentra solo el "
                f"{cuota:.0%} de la inversión del periodo (${gasto:,.2f}), así que "
                f"duplicar ahí mueve menos dinero en términos absolutos que un "
                f"punto de mejora en el mercado grande."),
            "tareas": [t for t in (f"arte-mercado-libre-{m}",) if t in ids],
            "_fuerza": 2,  # dos señales independientes: costo y competencia
        })

    # --- 2. El mensaje del competidor está saturado ---
    sat = terr.get("saturados", [])
    if sat:
        top = max(sat, key=lambda x: x.get("cuota", 0))
        quienes = ", ".join(sorted({x["de"] for x in sat}))
        out.append({
            "id": "disputar-el-flanco",
            "nombre": f"Ocupar el flanco que {top['de']} deja libre",
            "en_pocas_palabras": (
                f"No repetir la promesa que la competencia ya paga. Producir el "
                f"mismo público con otra promesa, la que ellos no están cubriendo."),
            "por_que": (
                f"{top['de']} concentra {top['cuota']:.0%} de sus anuncios activos "
                f"en un solo mensaje ({top['repeticiones']} anuncios, "
                f"{top['dias_vivo']} días vivo). Un mensaje tan repetido y tan "
                f"longevo es una apuesta que no han querido matar. Entrar con la "
                f"misma promesa es pelear de frente contra un presupuesto que ya "
                f"ocupó ese terreno; entrar por al lado cuesta menos atención."),
            "evidencia": [
                f"Ad Library · {top['de']} · «{top['mensaje']}» en "
                f"{top['cuota']:.0%} de sus activos en {top['mercado']}",
                f"Registro de competencia · mensajes saturados detectados: {quienes}",
            ],
            "cuando_no_conviene": (
                "Si el mensaje que ellos repiten es el que de verdad describe "
                "nuestro producto. Ceder el territorio correcto por no chocar "
                "sería peor que chocar. Eso no lo dice el dato: lo decide la mesa."),
            "tareas": [t.id for t in tareas_list
                       if "disputar-el-flanco" in t.estrategias],
            "_fuerza": 1,
        })

    # --- 3. Repetir lo que ya funcionó en casa ---
    mejor, silenciosa = None, None
    for nombre, r in det.items():
        if not r.get("confiable", True):
            continue
        if r.get("silenciosa") and r.get("vistas") is not None:
            silenciosa = (nombre, r)
        for m in (r.get("mejores") or []):
            marca = m.get("vistas") if m.get("vistas") is not None else m.get("interacciones")
            if m.get("titulo") and (mejor is None or marca > mejor[1]):
                mejor = (nombre, marca, m)
    tareas_3 = [t.id for t in tareas_list if "repetir-lo-propio" in t.estrategias]
    if mejor and tareas_3:
        red, marca, m = mejor
        unidad = "vistas" if m.get("vistas") is not None else "interacciones"
        ev = [f"social_normalizado.json · {red} · «{m['titulo'][:60]}» · "
              f"{marca} {unidad} · {m['fecha']}"]
        extra = ""
        if silenciosa:
            n, r = silenciosa
            ev.append(f"social_normalizado.json · {n} · {r['dias_de_silencio']} días "
                      f"sin publicar (última {r['ultima_publicacion']})")
            extra = (f" Y {n}, que sí devuelve vistas, lleva "
                     f"{r['dias_de_silencio']} días sin publicar.")
        out.append({
            "id": "repetir-lo-propio",
            "nombre": "Repetir el tema que ya enganchó con la audiencia propia",
            "en_pocas_palabras": (
                "Tomar el contenido que mejor rindió en orgánico y llevarlo a otro "
                "formato y otra red, en lugar de estrenar temas sin validar."),
            "por_que": (
                f"«{m['titulo'][:70]}» hizo {marca} {unidad} en {red} el "
                f"{m['fecha']}: es el techo de lo medido en el periodo. El tema ya "
                f"está probado con nuestra propia audiencia, así que lo que se "
                f"repite es el tema, no el arte.{extra}"),
            "evidencia": ev,
            "cuando_no_conviene": (
                "Si lo que hizo funcionar esa pieza fue algo que no se puede "
                "repetir — una colaboración, una fecha, un anuncio de producto. "
                "El dato dice que rindió, no por qué rindió."),
            "tareas": tareas_3,
            "_fuerza": 1,
        })

    out = [e for e in out if e["tareas"]]
    if out:
        # Regla escrita, no criterio oculto: gana la premisa que se apoya en mas
        # de una senal independiente. Con empate, la primera del orden de arriba.
        rec = max(out, key=lambda e: e["_fuerza"])
        for e in out:
            e["recomendada"] = e is rec
            e["_por_que_recomendada"] = (
                "El análisis la propone porque su premisa se apoya en dos señales "
                "independientes (costo por resultado y competencia medida), no en "
                "una. Es una lectura del dato, NO un pronóstico: nadie midió qué "
                "pasa si se mueve el presupuesto." if e is rec else None)
            e.pop("_fuerza", None)
    return out

def motivo_de_bloqueo(equipo: dict) -> str:
    """Por qué está apagada la asignación, calculado de los campos.

    Antes esto se leía de un texto escrito a mano en `config/equipo.json`. Ese
    texto decía que el ID del espacio de trabajo no se podía obtener, y siguió
    diciéndolo después de que se obtuvo — el tablero mostraba una explicación
    falsa junto al dato que la desmentía. Derivarlo es lo que impide que vuelva
    a pasar: si el archivo cambia, este mensaje cambia con él.
    """
    proy = equipo.get("proyecto_sprint") or {}
    faltan_ids = [k for k in ("team_id", "project_id", "sprint_id",
                              "item_type_id", "priority_id") if not proy.get(k)]
    partes = []
    if not equipo.get("personas"):
        partes.append(
            "No hay lista de personas en config/equipo.json, y no existe forma de "
            "obtenerla por API: el parámetro `users` de CreateItem espera User IDs "
            "de Sprints, no correos. Inventar nombres para llenar el selector "
            "rompería la regla 1 del proyecto.")
    if faltan_ids:
        partes.append(
            f"Faltan {len(faltan_ids)} de los 5 identificadores que exige "
            f"CreateItem ({', '.join(faltan_ids)}). Se leen por API en una pasada "
            f"con el team_id; ver .claude/rutinas/completar-sprint.md.")
    if not partes:
        partes.append("El archivo sigue con _lock en true.")
    return " ".join(partes)


def arma(periodo: str, redes: dict, panoramas: dict, por_mercado: dict,
         refs: dict, equipo: dict, hallazgos: list[dict], integridad: dict) -> dict:
    creativas = tareas(periodo, redes, panoramas, por_mercado, refs, equipo)
    de_pauta = cambios_en_pauta(hallazgos, integridad, periodo)
    todas = creativas + de_pauta
    ests = estrategias(redes, panoramas, por_mercado, refs, todas)

    bloqueado = bool(equipo.get("_lock"))
    return {
        "estrategias": ests,
        "recomendada": next((e["id"] for e in ests if e.get("recomendada")), None),
        "tareas": [t.a_dict() for t in todas],
        "conteo": {"creativas": len(creativas), "de_pauta": len(de_pauta),
                   "total": len(todas)},
        "asignacion": {
            "habilitada": not bloqueado,
            "personas": equipo.get("personas", []),
            "proyecto_sprint": equipo.get("proyecto_sprint", {}),
            "motivo_bloqueo": motivo_de_bloqueo(equipo) if bloqueado else None,
            "_como_desbloquear": equipo.get("_como_desbloquear") if bloqueado else None,
            "_flujo": ("Aceptar una tarea NO la crea en Sprint. El tablero registra "
                       "la decisión; el botón «Copiar decisiones» las entrega como "
                       "JSON, y ese JSON lo consume "
                       "`python -m modulo1.sprint --dry-run`, que imprime la llamada "
                       "exacta antes de hacer nada. La escritura la ejecuta el agente "
                       "orquestador, único con permiso (regla 4)."),
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
