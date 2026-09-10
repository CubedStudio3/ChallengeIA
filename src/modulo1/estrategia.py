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

from base.errores import FallaRuidosa

# Tipos de tarea. 'pauta' es especial: nunca la ejecuta el sistema.
TIPOS = ("video", "arte", "pauta", "dato")

def _linea_de_evidencia(e) -> str:
    """Una evidencia de hallazgo, como línea legible.

    Los hallazgos traen su evidencia como dicts con `dato`, `valor` y `fuente`.
    Aquí había un `str(e)`, y sobre un dict eso produce su repr de Python:
    dentro de la descripción de un work item real de Zoho llegó a leerse
    literalmente

        {'dato': 'Más eficiente', 'valor': 'Campaña Punto de Venta SV · $1.89'}

    con las comillas simples incluidas. Lo encontró el --dry-run antes de
    escribir, que es exactamente para lo que existe esa compuerta.

    La fuente se conserva completa: es lo que permite auditar el número, y es
    la razón por la que la evidencia viaja con la tarea en lugar de quedarse en
    el análisis.
    """
    if isinstance(e, str):
        return e
    if isinstance(e, dict):
        dato = str(e.get("dato") or e.get("que") or "").strip()
        valor = str(e.get("valor") or "").strip()
        fuente = str(e.get("fuente") or "").strip()
        cabeza = f"{dato}: {valor}" if dato and valor else (dato or valor)
        return " · ".join(x for x in (cabeza, fuente) if x) or repr(e)
    return str(e)


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
    """De qué bolsa de capacidad se sirve esta tarea, si hay alguna declarada.

    NO devuelve la cantidad final. Devolvía la capacidad **completa** a cada
    tarea, y con dos tareas de arte sobre una capacidad de 5 el plan pedía 10
    artes: el doble de lo que el equipo dijo que puede hacer. El propio docstring
    del módulo decía «se reparte» y el código no repartía nada.

    El reparto ocurre en `reparte_capacidad()`, después de saber cuántas tareas
    de cada tipo hay. Aquí solo se marca la bolsa (`_bolsa`) o el motivo por el
    que no hay ninguna.
    """
    if equipo.get("_lock"):
        return None, ("config/equipo.json está bloqueado: nadie ha declarado la "
                      "capacidad semanal. La mesa pone el número.")
    c = (equipo.get("capacidad_semanal") or {}).get(clave)
    if c is None:
        return None, (f"No hay capacidad declarada de '{clave}'. Cuántas piezas "
                      f"caben en una semana es capacidad del equipo, no un dato "
                      f"que exista en Meta ni en Ad Library.")
    return None, f"_bolsa:{clave}"


def reparte_capacidad(tareas_list: list, equipo: dict) -> None:
    """Reparte la capacidad semanal entre las tareas que se sirven de ella.

    Se hace aquí y no al construir cada tarea porque hasta que la lista no está
    completa no se sabe entre cuántas hay que dividir.

    Reparto por resto mayor: con capacidad 5 y 3 tareas sale 2, 2, 1 — nunca
    2, 2, 2, que sumaría 6. El total reparte **exactamente** la capacidad
    declarada, ni una pieza más.

    Y se dice en el motivo que el reparto es sobre TODAS las tareas de ese tipo:
    si la mesa descarta una, la capacidad que libera la pueden absorber las que
    queden. El número es una propuesta que respeta el techo, no una asignación
    cerrada.
    """
    cap = equipo.get("capacidad_semanal") or {}
    por_bolsa: dict[str, list] = {}
    for t in tareas_list:
        marca = t.piezas_motivo or ""
        if not marca.startswith("_bolsa:"):
            continue
        por_bolsa.setdefault(marca.split(":", 1)[1], []).append(t)

    for clave, grupo in por_bolsa.items():
        total = int(cap.get(clave) or 0)
        n = len(grupo)
        if not total or not n:
            for t in grupo:
                t.piezas = None
                t.piezas_motivo = (
                    f"No hay capacidad declarada de '{clave}'. La mesa pone el número.")
            continue
        base, resto = divmod(total, n)
        promedio = cap.get("_es_un_promedio")
        for i, t in enumerate(grupo):
            t.piezas = base + (1 if i < resto else 0)
            t.piezas_motivo = (
                f"{t.piezas} de las {total} {clave} de capacidad semanal, "
                f"repartidas entre las {n} tareas de este tipo que propone la "
                f"corrida"
                + (" (la capacidad es un promedio declarado por el equipo, no un "
                   "tope duro)" if promedio else "")
                + ". Si la mesa descarta alguna, las que queden pueden absorber "
                  "lo que libera. Es la MISMA capacidad que cuenta el plan de la "
                  "estrategia: un ángulo agrupa cartas, así que estas piezas no "
                  "se suman con las de las cartas.")


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

    # El reparto va al final, cuando ya se sabe cuántas tareas de cada tipo hay.
    reparte_capacidad(out, equipo)
    return out


def instruccion_presupuesto(por_mercado: dict, refs: dict) -> dict | None:
    """El movimiento de presupuesto que implica apostar a un mercado.

    El sistema NO lo ejecuta: Meta Ads es solo lectura (regla 8, ADR-012). Y la
    decisión tampoco la dice el dato — el dato dice qué cuesta cada lead hoy;
    que un mercado más barato aguante más volumen no está medido y por eso sale
    como pregunta para la mesa, con ese límite escrito adentro.
    """
    terr = (refs or {}).get("territorios") or {}
    libres = terr.get("libres") or []
    m = libres[0]["mercado"] if libres else None
    costos = {k: ((v.get("principal") or {}).get("costo_por_resultado"))
              for k, v in (por_mercado or {}).items()}
    costos = {k: c for k, c in costos.items() if c}
    if not m or m not in costos or len(costos) < 2:
        return None
    otro = max((k for k in costos if k != m), key=lambda k: costos[k])
    gastos = {k: ((v.get("principal") or {}).get("gasto") or 0)
              for k, v in por_mercado.items()}
    total = sum(gastos.values())
    cuota = gastos.get(m, 0) / total if total else 0
    dif = (costos[otro] - costos[m]) / costos[otro]
    camps = [c["etiqueta"] for c in ((por_mercado.get(m) or {}).get("campanas") or [])]
    return {
        "titulo": (f"Decidir en la mesa si se mueve presupuesto hacia {m}"),
        "porque": (f"Hoy {m} trae el lead {dif:.0%} más barato que {otro} "
                   f"(${costos[m]:.2f} contra ${costos[otro]:.2f}) y concentra "
                   f"solo el {cuota:.0%} de la inversión del periodo. Que sea "
                   f"más barato hoy NO garantiza que aguante más volumen: eso no "
                   f"lo dice el dato, y por eso es una decisión de la mesa y no "
                   f"una recomendación del sistema."),
        "evidencia": [f"pauta de Meta · {m} · ${costos[m]:.2f} por lead",
                      f"pauta de Meta · {otro} · ${costos[otro]:.2f} por lead",
                      f"pauta de Meta · {m} concentra {cuota:.0%} de la inversión"],
        "instruccion": (
            f"NO lo aplica el sistema. Si la mesa decide moverlo: en Meta Ads "
            f"Manager, subir el presupuesto diario de "
            f"{', '.join(camps) or f'las campañas de {m}'} y bajar el de las de "
            f"{otro} en la misma proporción. NO cambiar el objetivo de "
            f"optimización: un ad set con historial de entrega no se edita, se "
            f"duplica. Medir una semana antes de mover otra vez."),
    }


def cambios_en_pauta(hallazgos: list[dict], integridad: dict, periodo: str,
                     presupuesto: dict | None = None) -> list[Tarea]:
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

    # El movimiento de presupuesto entre mercados. ERA un paso de la tarjeta de
    # estrategia y bajó aquí el 2026-09-10, a pedido de Mercadeo: los otros
    # pasos se quitaron por redundantes o por ser proceso, pero este no es
    # ninguna de las dos cosas. Es la única salida que tiene la regla 8 —Meta
    # Ads es solo lectura— y con los demás se habría cortado ese hilo en
    # silencio. Va ligado a su estrategia, no `siempre`: solo tiene sentido si
    # la mesa eligió apostar a ese mercado.
    if presupuesto:
        out.append(Tarea(
            id="pauta-mover-presupuesto",
            tipo="pauta",
            titulo=presupuesto["titulo"],
            porque=presupuesto["porque"],
            evidencia=presupuesto["evidencia"],
            angulo="No es creativo: es reparto de presupuesto entre mercados.",
            rol_sugerido="pauta",
            piezas_motivo="No aplica: es un cambio de configuración, no producción.",
            estrategias=["mercado-sin-disputa"],
            requiere_humano=True,
            instruccion_exacta=presupuesto["instruccion"],
            idempotencia=f"{periodo}::pauta::mover-presupuesto",
        ))

    for h in hallazgos:
        if h.get("tipo") != "oportunidad" or "eficiencia" not in h.get("titulo", "").lower():
            continue
        out.append(Tarea(
            id="pauta-revisar-brecha",
            tipo="pauta",
            titulo=h["titulo"],
            porque=h["afirmacion"],
            evidencia=[_linea_de_evidencia(e)
                       for e in (h.get("evidencia") or [])] or [h.get("calculo", "")],
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



# ── La apuesta, el dato de origen, la diferencia y la dirección ────────────
#
# Los cuatro salen de un pedido de Mercadeo (2026-09-10):
#
#     «La apuesta, una frase: qué le decimos, a quién, y por qué ahora. Esto
#     hoy no existe y es lo más importante. La tarjeta dice "la promesa que la
#     competencia no cubre" pero nunca dice cuál es. Tiene que nombrarla en
#     concreto.»
#
# El problema de fondo, y cómo se resolvió: una estrategia activa hasta NUEVE
# cartas con ángulos distintos —salones, inventario, soporte—, así que no tiene
# UNA promesa: tiene un CRITERIO. Escribir una frase singular inventada sobre
# eso mentiría sobre ocho de las nueve cartas.
#
# Por eso **la frase se DERIVA de los ángulos de sus propias cartas**. No puede
# contradecirlas porque está hecha de ellas. Decisión de Mercadeo del
# 2026-09-10, sobre dos opciones que se le plantearon.
#
# Queda anotado como opción para después: partir las estrategias más finas, para
# que cada una sí tenga una promesa. Mercadeo: «meter salones, inventario y
# soporte técnico en una sola estrategia es ancho: son públicos distintos con
# dolores distintos. No lo hagas ahora, pero dejalo escrito. Si al usarlo un par
# de semanas se siente borroso, lo partimos.»


def _angulos(sirve: list[dict], tope: int = 3) -> tuple[list[str], int]:
    """Los ángulos concretos de las cartas, por frecuencia. Sin inventar.

    El ángulo de una carta viene como «Salones y barberías · nicho libre donde
    ya hay producto y cliente»: el primer tramo es el territorio concreto y es
    lo único que hace falta para nombrar la apuesta.
    """
    cuenta: dict[str, int] = {}
    for c in sirve:
        a = (c.get("de_que_hablar") or "").split("·")[0].strip()
        if a:
            cuenta[a] = cuenta.get(a, 0) + 1
    orden = sorted(cuenta, key=lambda a: (-cuenta[a], a))
    return orden[:tope], max(0, len(orden) - tope)


def _apuesta(est: dict, sirve: list[dict], refs: dict, por_mercado: dict,
             fmt: dict | None, competencia: dict | None) -> dict:
    """Qué le decimos, a quién, y por qué ahora — en una frase, derivada.

    `por_que_ahora` puede quedar en None y eso NO se rellena. La Ad Library
    solo dice qué está activo AHORA, así que para las dos estrategias
    competitivas el «ahora» es literal y medido. Para `repetir-lo-propio` no
    hay señal temporal —el corte reel contra feed es acumulado al día de la
    consulta—, y ahí la frase se calla en lugar de inventar urgencia.
    """
    angs, resto = _angulos(sirve)
    if not angs:
        return {"frase": None,
                "_por_que_no": ("Ninguna de sus cartas declara un ángulo, así "
                                "que no hay promesa concreta que nombrar. No se "
                                "escribe una genérica.")}
    lista = ", ".join(angs) + (f" y {resto} más" if resto else "")
    audiencias = len({(c.get("que_hacer") or "")[-60:] for c in sirve})

    terr = (refs or {}).get("territorios") or {}
    ahora = None
    partes = []

    if est["id"] == "disputar-el-flanco":
        sat = terr.get("saturados") or []
        if sat:
            top = max(sat, key=lambda x: x.get("cuota", 0))
            partes.append(f"Hablamos de {lista}")
            ahora = (f"{top['de']} paga por «{top['mensaje']}» —{top['cuota']:.0%} "
                     f"de sus activos, {top['dias_vivo']} días vivo— y ninguno "
                     f"de esos ángulos lo toca")
    elif est["id"] == "mercado-sin-disputa":
        libres = [l for l in (terr.get("libres") or [])]
        m = libres[0]["mercado"] if libres else None
        marcas = len(((competencia or {}).get(m) or {}).get("detalle") or {}) if m else 0
        partes.append(f"Hablamos de {lista}" + (f", concentrado en {m}" if m else ""))
        if m:
            ahora = (f"hoy ninguna de las {marcas} marcas medidas tiene anuncios "
                     f"activos en {m}" if marcas else
                     f"hoy ningún competidor medido tiene anuncios activos en {m}")
    elif est["id"] == "repetir-lo-propio":
        ver = (((fmt or {}).get("alcance") or {}).get("veredicto") or {})
        partes.append(f"Hablamos de {lista}, en el formato que ya rinde en casa")
        if ver.get("ratio_alcance"):
            # NO es un «ahora»: es una constante medida de la cuenta. Se dice
            # como tal y no se disfraza de urgencia.
            partes.append(f"el reel alcanza {ver['ratio_alcance']}x más gente "
                          f"que el feed en la cuenta propia")

    if not partes:
        return {"frase": None,
                "_por_que_no": ("La corrida no trae la medición que sostiene la "
                                "premisa de esta estrategia.")}

    # Cada parte empieza con mayúscula al coserlas: unir con «. » dejaba
    # «...en casa. el reel alcanza...» y eso se lee como un error de dedo.
    partes = [x[0].upper() + x[1:] if x else x for x in partes]
    frase = ". ".join(partes) + (f". Por qué ahora: {ahora}." if ahora else ".")
    return {
        "frase": frase,
        "que_decimos": lista,
        "a_quien_cuantos": audiencias,
        "por_que_ahora": ahora,
        "_de_donde": (
            "Los ángulos son los de SUS PROPIAS cartas, contados por frecuencia. "
            "La frase no se escribe a mano: se arma de las cartas que la "
            "estrategia activa, así que no puede contradecirlas. El «por qué "
            "ahora» sale de la Ad Library, que solo publica lo que está activo "
            "hoy; cuando no hay señal temporal medida, no se escribe."),
        # El aviso solo cuando de verdad es ancha. Con el umbral en 2 salía en
        # las tres y un aviso que sale siempre no avisa de nada.
        "_ojo_ancho": (
            f"Ancha: {len(angs) + resto} ángulos, públicos distintos (ADR-058)."
            if (len(angs) + resto) > 3 else None),
    }


def _origen(est: dict, por_mercado: dict, refs: dict, fmt: dict | None,
            piezas: list[dict] | None, rango: str = "") -> dict | None:
    """El dato que origina la estrategia, SIEMPRE con su comparación.

    Pedido de Mercadeo: «No "GT $3.35" suelto, sino contra qué: el promedio de
    la cuenta, el periodo anterior, o el competidor. Un número sin referencia
    no sirve para decidir.»

    Las tres referencias no están disponibles por igual, y eso se declara en
    lugar de rellenarse:

    · **el promedio de la cuenta** y **el competidor** salen de esta corrida;
    · **el periodo anterior** solo existe para PAUTA, porque hay pauta diaria
      desde junio. Para el orgánico NO: su serie es acumulada al día de la
      consulta, no histórica, así que un «+X% contra la semana pasada» del
      orgánico sería falso (trampa ya documentada).
    """
    terr = (refs or {}).get("territorios") or {}

    if est["id"] == "disputar-el-flanco":
        sat = terr.get("saturados") or []
        if not sat:
            return None
        top = max(sat, key=lambda x: x.get("cuota", 0))
        otros = [s for s in sat if s is not top]
        comp = (f"el siguiente más concentrado es {otros[0]['de']} con "
                f"{otros[0]['cuota']:.0%}" if otros else
                "no hay otro competidor medido con un mensaje concentrado")
        return {
            "linea": (f"{top['de']} concentra {top['cuota']:.0%} de sus anuncios "
                      f"activos en un solo mensaje ({top['repeticiones']} "
                      f"anuncios, {top['dias_vivo']} días vivo)"),
            "contra": comp,
            "fuente": "Meta Ad Library · anuncios activos hoy",
        }

    if est["id"] == "repetir-lo-propio":
        ver = (((fmt or {}).get("alcance") or {}).get("veredicto") or {})
        if not ver.get("ratio_alcance"):
            return None
        return {
            "linea": (f"El reel alcanza {ver['ratio_alcance']}x más personas que "
                      f"el feed en la cuenta propia"),
            "contra": (f"y pierde en tasa: el feed engancha "
                       f"{ver.get('ratio_tasa')}x más de quien alcanza. Las dos "
                       f"cosas son ciertas"
                       if ver.get("se_contradicen") else
                       "medido sobre las publicaciones de la cuenta"),
            "fuente": "ads_get_ig_media + Zoho Analytics · cuenta propia",
            "_sin_periodo_anterior": (
                "El orgánico NO se compara con el periodo anterior: su serie es "
                "acumulada al día de la consulta, no histórica."),
        }

    # mercado-sin-disputa: el costo del mercado, contra la cuenta, contra el
    # otro mercado, y contra su propio periodo anterior.
    libres = terr.get("libres") or []
    m = libres[0]["mercado"] if libres else None
    pr = ((por_mercado or {}).get(m) or {}).get("principal") or {}
    cpr = pr.get("costo_por_resultado")
    if not (m and cpr):
        return None

    ind = (por_mercado.get(m) or {}).get("indicador_principal")
    tot_g = tot_r = 0.0
    for mm, v in (por_mercado or {}).items():
        p = (v.get("indicadores") or {}).get(ind) or {}
        tot_g += p.get("gasto") or 0
        tot_r += p.get("resultados") or 0
    prom = (tot_g / tot_r) if tot_r else None

    contra = []
    if prom:
        contra.append(f"{abs(cpr - prom) / prom:.0%} "
                      f"{'bajo' if cpr < prom else 'sobre'} el promedio de la "
                      f"cuenta (${prom:.2f})")
    otros = {k: ((v.get("principal") or {}).get("costo_por_resultado"))
             for k, v in (por_mercado or {}).items() if k != m}
    otros = {k: v for k, v in otros.items() if v}
    for k, v in sorted(otros.items()):
        contra.append(f"{abs(cpr - v) / v:.0%} {'bajo' if cpr < v else 'sobre'} "
                      f"{k} (${v:.2f})")

    ant = _periodo_anterior(piezas, rango, m, ind)
    return {
        "linea": f"En {m} el lead cuesta ${cpr:.2f}",
        "contra": " · ".join(contra) if contra else "sin otro mercado con qué comparar",
        "anterior": ant,
        "fuente": "pauta de Meta · agrupado por indicador (ADR-013)",
    }


def _periodo_anterior(piezas: list[dict] | None, rango: str, mercado: str,
                      indicador: str | None) -> dict | None:
    """El mismo mercado, en la ventana anterior del mismo largo.

    Existe porque hay pauta diaria desde junio (ADR-050). Se compara el COSTO
    POR RESULTADO, que es una razón y sobrevive a que las dos ventanas tengan
    distinto número de días con entrega — pero el número de días se declara,
    porque los totales de gasto NO son comparables si difieren.

    Y solo el indicador principal: sumar indicadores distintos es la trampa
    más vieja de este proyecto (ADR-013).
    """
    if not piezas or not rango or not indicador:
        return None
    try:
        d0, h0 = [x.strip() for x in rango.split(" a ")]
        from datetime import date, timedelta
        i0, f0 = date.fromisoformat(d0), date.fromisoformat(h0)
    except Exception:                                   # noqa: BLE001
        return None
    n = (f0 - i0).days + 1
    fp = i0 - timedelta(days=1)
    ip = fp - timedelta(days=n - 1)

    def mide(desde, hasta):
        g = r = 0.0
        dias = set()
        for p in piezas:
            if p.get("k") != indicador or p.get("p") != mercado:
                continue
            if not (desde.isoformat() <= p["f"] <= hasta.isoformat()):
                continue
            g += p.get("g") or 0
            if p.get("r"):
                r += p["r"]
            dias.add(p["f"])
        return g, r, len(dias)

    g0, r0, d0n = mide(i0, f0)
    gp, rp, dpn = mide(ip, fp)
    if not (r0 and rp):
        return None
    c0, cp = g0 / r0, gp / rp
    return {
        "costo": round(cp, 4),
        "resultados": int(rp),
        "desde": ip.isoformat(), "hasta": fp.isoformat(),
        "dias_con_dato": dpn, "dias_con_dato_corrida": d0n,
        "variacion": round((c0 - cp) / cp, 4),
        "peor": c0 > cp,
        "_ojo_dias": (f"La ventana anterior tuvo {dpn} días con entrega y esta "
                      f"{d0n}. El costo por resultado es una razón y aguanta la "
                      f"diferencia; los totales de gasto NO son comparables."),
    }


def _diferencia(est: dict, todas: list[dict]) -> str | None:
    """En qué se diferencia de las otras dos. Una línea, derivada.

    Se deriva de la FUENTE de su premisa, que es lo que de verdad las separa:
    una mira el costo por mercado, otra los anuncios del competidor, otra la
    cuenta propia. Si dos comparten fuente, no se dice «la única»: se dice qué
    comparten. Un diferenciador de relleno es peor que ninguno, porque se lee
    como si hubiera una diferencia que no existe.
    """
    FUENTE = {
        "mercado-sin-disputa": ("el costo por lead por mercado",
                                "aparta el foco a un mercado en vez de repartir"),
        "disputar-el-flanco": ("los anuncios activos del competidor",
                               "se define por lo que hace la competencia, "
                               "no por nuestro dato"),
        "repetir-lo-propio": ("la cuenta propia",
                              "no mira afuera: su premisa se midió en nuestra "
                              "propia audiencia"),
    }
    mia = FUENTE.get(est["id"])
    if not mia:
        return None
    otras = [FUENTE[e["id"]][0] for e in todas
             if e["id"] != est["id"] and e["id"] in FUENTE]
    if mia[0] in otras:
        return (f"Comparte fuente con otra de las opciones ({mia[0]}), así que "
                f"aquí no hay una diferencia de fondo que señalar.")
    if not otras:
        return None
    return f"Es la que {mia[1]}. Las otras miran {' y '.join(otras)}."


def _direccion(est: dict, por_mercado: dict, refs: dict, redes: dict,
               fmt: dict | None) -> dict | None:
    """Qué métrica esperamos mover y en qué dirección. SIN meta numérica.

    Decisión de Mercadeo (2026-09-10): «dirección sin meta numérica. No quiero
    que el sistema prometa cifras que nadie midió.»

    La dirección es falsable y no inventa magnitud: la semana que viene el
    número está arriba o abajo del de hoy. Una meta («bajar a $2.40») sería un
    pronóstico con cara de dato, porque nadie midió qué pasa si se mueve el
    presupuesto.
    """
    terr = (refs or {}).get("territorios") or {}
    if est["id"] == "mercado-sin-disputa":
        libres = terr.get("libres") or []
        m = libres[0]["mercado"] if libres else None
        pr = ((por_mercado or {}).get(m) or {}).get("principal") or {}
        if not (m and pr.get("costo_por_resultado")):
            return None
        return {"metrica": f"costo por lead en {m}", "hacia": "abajo",
                "hoy": f"${pr['costo_por_resultado']:.2f}"}
    if est["id"] == "disputar-el-flanco":
        sat = terr.get("saturados") or []
        if not sat:
            return None
        m = max(sat, key=lambda x: x.get("cuota", 0)).get("mercado")
        pr = ((por_mercado or {}).get(m) or {}).get("principal") or {}
        if not pr.get("costo_por_resultado"):
            return None
        return {"metrica": f"costo por lead en {m}, donde está el competidor "
                           f"saturado", "hacia": "abajo",
                "hoy": f"${pr['costo_por_resultado']:.2f}"}
    if est["id"] == "repetir-lo-propio":
        t = (redes or {}).get("totales") or {}
        if t.get("interacciones") is None:
            return None
        return {"metrica": "interacciones del orgánico", "hacia": "arriba",
                "hoy": f"{t['interacciones']} en {t.get('publicaciones', 0)} "
                       f"publicaciones"}
    return None


PIEZA_PL = {"arte": ("arte", "artes"), "video": ("video", "videos")}


def _cuenta(n: int, clave: str) -> str:
    uno, varios = PIEZA_PL.get(clave, (clave, clave + "s"))
    return f"{n} {uno if n == 1 else varios}"


def plan_de_produccion(est: dict, cartas: list[dict], equipo: dict,
                       fmt: dict | None, redes: dict, por_mercado: dict,
                       refs: dict | None = None,
                       competencia: dict | None = None,
                       piezas_diarias: list[dict] | None = None,
                       rango: str = "", todas: list[dict] | None = None) -> dict:
    """Qué producir esta semana si la mesa elige ESTA estrategia.

    Existe por un pedido de Mercadeo (2026-09-09): «que sea una estrategia
    realista basada en el análisis de los datos del dashboard y que tenga pasos
    concretos a seguir: cuantos artes y videos crear, por qué la estrategia es
    efectiva, diferenciar entre contenido de meta/orgánico».

    Todo lo que devuelve se CUENTA o se DERIVA de la corrida. Ningún número se
    escribe a mano, por la misma razón que las cartas resuelven su evidencia
    contra el dato (ADR-042): un plan con un número viejo se lee igual de bien
    que uno correcto.

    ## La unidad son las CARTAS, no las tareas

    Desde ADR-042 la pieza que la mesa aprueba es la carta. Así que «cuántos
    artes y videos» se cuenta de las cartas que esta estrategia activa, y la
    capacidad declarada es el techo contra el que se comparan.

    El bloque de ángulos («Cómo se reparte la capacidad») describe la MISMA
    capacidad a un grano más grueso: un ángulo agrupa cartas. **No son piezas
    adicionales**, y el plan lo dice en voz alta para que nadie las sume.

    ## Pauta y orgánico no se promedian

    Cada carta declara en qué canal se MIDIÓ su evidencia (`canales`). No es un
    pronóstico: es de dónde salió el número. Los dos canales traen
    recomendaciones distintas —la pauta sabe qué mercado sale más barato, el
    orgánico sabe qué formato engancha— y juntarlas en una sola cifra perdería
    las dos.
    """
    sirve = [c for c in cartas
             if c.get("siempre") or est["id"] in (c.get("estrategias") or [])]
    cap = equipo.get("capacidad_semanal") or {}
    bloqueado = bool(equipo.get("_lock"))

    # --- 1 · cuántas piezas, por tipo, contra el techo declarado -----------
    piezas = {}
    for clave in ("arte", "video"):
        n = len([c for c in sirve if c.get("pieza") == clave])
        techo = None if bloqueado else cap.get(clave + "s")
        cabe = None if techo is None else n <= techo
        piezas[clave] = {
            "cuantas": n,
            "capacidad": techo,
            "cabe": cabe,
            "holgura": None if techo is None else techo - n,
        }

    techos = [v["capacidad"] for v in piezas.values() if v["capacidad"] is not None]
    corto = ""            # el delta, sin repetir lo que ya dice la etiqueta
    if not techos:
        veredicto = "sin_capacidad"
        veredicto_txt = ((
            "config/equipo.json está bloqueado: nadie declaró la capacidad "
            "semanal, así que no se puede decir si estas piezas caben. El "
            "número lo pone la mesa.") if bloqueado else (
            "No hay capacidad semanal declarada, así que no se puede decir si "
            "estas piezas caben. Cuántas piezas entran en una semana es "
            "capacidad del equipo: no existe en Meta ni en Ad Library."))
    elif any(v["cabe"] is False for v in piezas.values()):
        veredicto = "no_cabe"
        exceso = [f"{_cuenta(v['cuantas'], k)} contra una capacidad de {v['capacidad']}"
                  for k, v in piezas.items() if v["cabe"] is False]
        veredicto_txt = (
            "NO cabe en la semana: " + " y ".join(exceso) +
            ". La mesa tiene que descartar cartas o subir la capacidad; el "
            "sistema no elige cuáles.")
        corto = "Sobran " + " y ".join(
            _cuenta(v["cuantas"] - v["capacidad"], k) for k, v in piezas.items()
            if v["cabe"] is False) + " que no caben."
    elif all(v["holgura"] == 0 for v in piezas.values() if v["capacidad"]):
        veredicto = "justo"
        veredicto_txt = ("Llena la semana exacta: no queda holgura para nada "
                         "que salga de la mesa.")
        corto = "Sin holgura para nada que salga de la mesa."
    else:
        veredicto = "cabe"
        sobra = [f"{_cuenta(v['holgura'], k)}" for k, v in piezas.items()
                 if v["holgura"]]
        # Un tipo al tope EXACTO no es holgura, y decir solo lo que sobra lo
        # esconde: con 4 artes de 5 y 5 videos de 5, «sobra 1 arte» es cierto y
        # deja creer que hay margen en los dos.
        tope = [PIEZA_PL[k][1] for k, v in piezas.items()
                if v["capacidad"] and v["holgura"] == 0 and v["cuantas"]]
        veredicto_txt = ("Cabe en la semana" +
                         (", y sobra capacidad para " + " y ".join(sobra) +
                          " más" if sobra else "") + "."
                         + (" Los " + " y ".join(tope) + " quedan al tope exacto: "
                            "ahí no entra nada que salga de la mesa."
                            if tope else ""))
        # La etiqueta ya dice «Cabe en la semana». Repetirlo en la línea de
        # abajo gasta el renglón que la mesa lee de verdad, que es el delta.
        # «Sobran 1 arte» estaba mal conjugado. Singular solo si la lista es
        # UNA cosa de cantidad uno; «3 artes y 3 videos» es plural igual.
        uno = len(sobra) == 1 and sobra[0].startswith("1 ")
        corto = " · ".join(
            ([("Sobra " if uno else "Sobran ") + " y ".join(sobra)] if sobra else [])
            + ([" y ".join(tope) + " al tope"] if tope else []))

    # --- 2 · el corte por canal, contado de la evidencia -------------------
    def _de(pred):
        return [c for c in sirve if pred(c.get("canales") or [])]
    solo_p = _de(lambda cs: cs == ["pauta"])
    solo_o = _de(lambda cs: cs == ["organico"])
    ambos = _de(lambda cs: len(cs) > 1)
    ninguno = _de(lambda cs: not cs)

    # La PARTICIÓN: cuatro grupos que no se solapan y suman el total. Es lo que
    # se pinta.
    #
    # Antes se publicaban los conjuntos SOLAPADOS —«8 pauta · 5 orgánico · 5 en
    # los dos · 1 sin canal»— porque `pauta` ya contenía las 5 compartidas y
    # después las 5 volvían a aparecer como su propio trozo. Sumaba 19 sobre 9
    # cartas. Lo reportó Mercadeo el 2026-09-10 y tenía razón: la aritmética
    # estaba bien y el rótulo estaba mal.
    #
    # Había una nota que decía «los subtotales no suman el total». Si hay que
    # leer una nota para no sumar mal, el rótulo está mal: no se arregla
    # avisando, se arregla publicando grupos que sí sumen.
    particion = {
        "solo_pauta": len(solo_p),
        "solo_organico": len(solo_o),
        "en_los_dos": len(ambos),
        "sin_canal": len(ninguno),
    }
    if sum(particion.values()) != len(sirve):
        # Regla 3: falla ruidosamente. Una partición que no suma el total
        # significa que una carta cayó en dos grupos o en ninguno, y eso
        # invalida todos los números de la tarjeta.
        raise FallaRuidosa(
            f"La partición por canal de «{est['id']}» no suma el total de "
            f"cartas: {particion} suma {sum(particion.values())} y hay "
            f"{len(sirve)} cartas.")

    canal = {
        "particion": particion,
        # Los agregados se conservan, porque contestan otra pregunta —«¿en
        # cuántas piezas se apoya la pauta?»— pero ya NO son lo que se pinta.
        "pauta": {"cuantas": len(solo_p) + len(ambos),
                  "solo": len(solo_p), "titulos": [c["titulo"] for c in solo_p]},
        "organico": {"cuantas": len(solo_o) + len(ambos),
                     "solo": len(solo_o), "titulos": [c["titulo"] for c in solo_o]},
        "ambos": {"cuantas": len(ambos), "titulos": [c["titulo"] for c in ambos]},
        "solo_ejecucion": {"cuantas": len(ninguno),
                           "titulos": [c["titulo"] for c in ninguno]},
        "total": len(sirve),
        "_como_se_cuenta": (
            "Por el canal donde se MIDIÓ la evidencia de cada carta, no por una "
            "predicción de dónde va a rendir. Meta Ads y la Ad Library son "
            "pauta —la Ad Library solo muestra anuncios pagados—; la cuenta "
            "propia es orgánico."),
        "_por_que_particion": (
            "Lo que se pinta son los cuatro grupos de `particion`, que no se "
            "solapan y suman el total de cartas. `pauta` y `organico` de aquí "
            "abajo SÍ se solapan —una carta con evidencia de los dos cuenta en "
            "los dos— y por eso no se muestran como si fueran una lista de "
            "partes."),
    }

    return {
        "piezas": piezas,
        "total": len(sirve),
        "veredicto": veredicto,
        "veredicto_texto": veredicto_txt,
        "veredicto_corto": corto,
        "canal": canal,
        # El ORDEN de la tarjeta lo pidió Mercadeo (2026-09-10): nombre, la
        # apuesta, el dato que la origina, en qué se diferencia, qué esperamos,
        # y la capacidad en una línea chiquita al final. Antes la capacidad se
        # mencionaba cinco veces y el razonamiento estaba plegado: al revés.
        "apuesta": _apuesta(est, sirve, refs or {}, por_mercado, fmt, competencia),
        "origen": _origen(est, por_mercado, refs or {}, fmt, piezas_diarias, rango),
        "diferencia": _diferencia(est, todas or [est]),
        "direccion": _direccion(est, por_mercado, refs or {}, redes, fmt),
        # Los PASOS se quitaron. «Producir 4 artes y 5 videos» ya está en los
        # contadores y «aprobar los copys» es proceso, no estrategia. Lo que sí
        # tenía contenido —el reel 9:16— ya vive en la carta de cada pieza
        # (`visual.estructura`), que es donde lo lee quien produce.
        #
        # El paso de presupuesto NO se perdió: bajó al bloque «Cambios en Meta
        # Ads» ligado a su estrategia, porque es la única salida que tiene la
        # regla 8 —Meta Ads es solo lectura— y con los demás pasos se habría
        # cortado ese hilo en silencio.
        "medir": _que_medir(est, por_mercado, redes, fmt),
        "_la_unidad": (
            "Las piezas se cuentan de las CARTAS que esta estrategia activa: es "
            "la unidad que la mesa aprueba (ADR-042). El bloque de ángulos de "
            "abajo reparte la MISMA capacidad a un grano más grueso —un ángulo "
            "agrupa cartas—, así que no son piezas adicionales y no se suman."),
    }


def _pasos(est: dict, sirve: list[dict], piezas: dict, canal: dict,
           fmt: dict | None, redes: dict, por_mercado: dict) -> list[dict]:
    """Los pasos, en el orden en que se ejecutan. Cada uno con el dato detrás.

    Un paso sin dato detrás es una ocurrencia, así que cada uno lleva `dato`
    con la medición que lo sostiene. Si la corrida no trae con qué sostener un
    paso, el paso NO se escribe.
    """
    pasos = []

    # 1 · producir. Es el paso que contesta «cuántos artes y videos».
    cuantos = " y ".join(_cuenta(v["cuantas"], k) for k, v in piezas.items()
                         if v["cuantas"])
    if cuantos:
        pasos.append({
            "orden": len(pasos) + 1,
            "corto": f"Producir {cuantos}.",
            "que": f"Producir {cuantos}.",
            "porque": ("Son las cartas que esta estrategia activa. Cada una trae "
                       "su copy, qué mostrar y su referencia medida."),
            "dato": f"{len(sirve)} cartas de esta corrida sirven a esta estrategia",
        })

    # 2 · el formato del video, SOLO si la comparación es publicable.
    #
    # Y con la contradicción a la vista. El reel gana en ALCANCE (8.1x) y el
    # feed gana en TASA (2.51x): las dos cosas son ciertas y contestan preguntas
    # distintas. Citar solo la mitad que conviene sería el uso más fácil de
    # hacer de este dato y el más deshonesto. La lectura del análisis es «para
    # descubrimiento, reel», así que el paso se limita a eso y dice el resto.
    cmp_ = ((fmt or {}).get("comparacion") or {})
    ver = (((fmt or {}).get("alcance") or {}).get("veredicto") or {})
    if piezas["video"]["cuantas"] and cmp_.get("publicable") and cmp_.get("gana") == "REELS":
        desc = len([c for c in sirve
                    if c.get("pieza") == "video" and c.get("etapa") == "descubrimiento"])
        peros = []
        if ver.get("se_contradicen") and ver.get("gana_en_tasa"):
            peros.append(
                f"El {ver['gana_en_tasa'].lower()} gana en TASA "
                f"({ver.get('ratio_tasa')}x): de la gente que alcanza, engancha a "
                f"una fracción mayor. Las dos cosas son ciertas. Para "
                f"descubrimiento manda el alcance; para una pieza que ya le habla "
                f"a quien te conoce, no está dicho.")
        pasos.append({
            "orden": len(pasos) + 1,
            "corto": ("Los videos, como reel 9:16"
                      + (f" (al menos {'el' if desc == 1 else 'los ' + str(desc)} "
                         f"de descubrimiento)" if desc else "") + "."),
            "que": ("Los videos van como reel vertical 9:16, no como pieza de feed"
                    + ((f" — al menos el de descubrimiento." if desc == 1
                         else f" — al menos los {desc} de descubrimiento.")
                       if desc else ".")),
            "porque": ("Es el único corte de formato medido en la cuenta propia, y "
                       "el margen no lo explica la antigüedad. "
                       + (peros[0] if peros else "")),
            "dato": (f"reel contra feed · {ver.get('ratio_alcance')}x en alcance "
                     f"({ver.get('gana_en_alcance', 'REELS')})"
                     if ver.get("ratio_alcance") else
                     f"reel contra feed · {cmp_['ratio']}x en interacciones")
                    + f" · {cmp_['ratio']}x en interacciones "
                      f"({cmp_['promedio_reels']} contra {cmp_['promedio_feed']}) · "
                    + (cmp_.get("_control_de_edad") or ""),
        })

    # 3 · (vacante) El reparto por canal ERA un paso, y repetía palabra por
    #     palabra el bloque «De qué canal sale su evidencia» de la tarjeta.
    #     Dos bloques que contestan la misma pregunta es el error que este
    #     proyecto lleva repitiendo; en una tarjeta de reunión además gastaba
    #     tres renglones. El corte sigue en `plan["canal"]`, que es de donde
    #     lo pinta la tarjeta: se quitó el duplicado, no el dato.

    # 4 · la red donde publicar lo organico, si hay una callada que rinde.
    det = (redes or {}).get("detalle") or {}
    for nombre, r in det.items():
        if not r.get("confiable", True) or not r.get("silenciosa"):
            continue
        if r.get("dias_de_silencio") is None:
            continue
        pasos.append({
            "orden": len(pasos) + 1,
            "corto": f"Publicar en {nombre.capitalize()}, que está callada.",
            "que": f"Publicar en {nombre.capitalize()}, que está callada.",
            "porque": ("Devuelve resultado y no se está usando. Reactivar una red "
                       "que ya rinde cuesta menos que estrenar una."),
            "dato": (f"{nombre} · {r['dias_de_silencio']} días sin publicar · "
                     f"última {r.get('ultima_publicacion', 'desconocida')}"),
        })
        break

    # 5 · la instruccion de pauta. NUNCA la ejecuta el sistema (regla 8).
    ins = _instruccion_de_pauta(est, por_mercado)
    if ins:
        pasos.append(ins | {"orden": len(pasos) + 1})

    # 6 · la compuerta humana del copy (regla 5). Siempre aplica.
    pasos.append({
        "orden": len(pasos) + 1,
        "corto": "Aprobar los copys antes de publicar.",
        "que": "Aprobar los copys en la mesa antes de publicar nada.",
        "porque": ("Ningún copy se publica sin aprobación humana. Es una decisión "
                   "de diseño en contexto de fintech, no un paso administrativo."),
        "dato": "regla 5 del proyecto · los copys salen marcados para aprobación",
    })
    return pasos


def _instruccion_de_pauta(est: dict, por_mercado: dict) -> dict | None:
    """El movimiento de pauta que esta estrategia implica, como INSTRUCCIÓN.

    Meta Ads es solo lectura (regla 8, ADR-012). El sistema no mueve
    presupuesto ni segmentación: redacta lo que habría que hacer y la mesa
    decide. Y la decisión de mover dinero **no la dice el dato**: el dato dice
    qué cuesta cada lead hoy.
    """
    if est["id"] != "mercado-sin-disputa":
        return None
    costos = {m: ((v.get("principal") or {}).get("costo_por_resultado"))
              for m, v in (por_mercado or {}).items()}
    costos = {m: c for m, c in costos.items() if c}
    if len(costos) < 2:
        return None
    barato = min(costos, key=costos.get)
    caro = max(costos, key=costos.get)
    gastos = {m: ((v.get("principal") or {}).get("gasto") or 0)
              for m, v in por_mercado.items()}
    total = sum(gastos.values())
    cuota = gastos.get(barato, 0) / total if total else 0
    dif = (costos[caro] - costos[barato]) / costos[caro]
    return {
        "corto": f"¿Mover presupuesto a {barato}? Lo decide la mesa.",
        "que": (f"Poner a la mesa si mueve presupuesto hacia {barato}. "
                f"El sistema NO lo mueve."),
        "porque": (f"Hoy {barato} trae el lead {dif:.0%} más barato que {caro} y "
                   f"concentra solo el {cuota:.0%} de la inversión. Que sea más "
                   f"barato hoy no garantiza que aguante más volumen: eso no lo "
                   f"dice el dato, y por eso es una pregunta para la mesa y no "
                   f"una recomendación del sistema."),
        "dato": (f"{barato} ${costos[barato]:.2f} por lead · {caro} "
                 f"${costos[caro]:.2f} · {barato} tiene ${gastos[barato]:,.2f} "
                 f"de ${total:,.2f}"),
        "humano": True,
    }


def _que_medir(est: dict, por_mercado: dict, redes: dict,
               fmt: dict | None) -> dict | None:
    """Contra qué número se sabrá la semana que viene si esto funcionó.

    Una estrategia que no se puede desmentir no es una estrategia. Así que se
    deja escrita la BASE de esta corrida: el número con el que se compara.

    No lleva meta ni pronóstico. Poner «bajar a $2.40» sería inventar un
    número: nadie midió qué pasa si se mueve el presupuesto.
    """
    # Dos formas del mismo dato: `corta` para el renglón que se lee en la mesa
    # y `base` para el sustento plegado. Son la misma medición formateada
    # distinto —no dos cuentas—, así que no pueden divergir.
    base, corta = [], []
    for m, v in sorted((por_mercado or {}).items()):
        pr = v.get("principal") or {}
        if pr.get("costo_por_resultado") and pr.get("resultados"):
            # Entero: los resultados son un conteo. «107.0 leads» delata que el
            # numero pasó por un float y no le da precision, le quita crédito.
            base.append(f"{m} · {int(round(pr['resultados']))} leads a "
                        f"${pr['costo_por_resultado']:.2f}")
            corta.append(f"{m} ${pr['costo_por_resultado']:.2f}")
    t = (redes or {}).get("totales") or {}
    if t.get("interacciones") is not None:
        base.append(f"orgánico · {t['interacciones']} interacciones en "
                    f"{t.get('publicaciones', 0)} publicaciones")
        corta.append(f"orgánico {t['interacciones']} inter.")
    cmp_ = ((fmt or {}).get("comparacion") or {})
    if cmp_.get("publicable"):
        base.append(f"reel contra feed · {cmp_['ratio']}x")
        corta.append(f"reel {cmp_['ratio']}x")
    if not base:
        return None
    # Cuál de esos números apuesta a mover ESTA estrategia. Sin eso, las tres
    # muestran la misma base y ninguna dice qué tendría que cambiar si funcionó.
    # Sale de la premisa de cada una, que es lo mismo de lo que sale su
    # evidencia: no es una asignación aparte.
    apuesta = {
        "mercado-sin-disputa": "El costo por lead del mercado sin disputa.",
        "disputar-el-flanco": ("El costo por lead donde está el competidor "
                               "saturado."),
        "repetir-lo-propio": ("Las interacciones del orgánico y el ratio "
                              "reel contra feed."),
    }.get(est["id"])

    return {
        "base": base,
        "base_corta": " · ".join(corta),
        "apuesta": apuesta,
        "_como_leerlo": (
            "Es la BASE de esta corrida, no una meta. La corrida de la semana que "
            "viene compara contra estos números. No se escribe un objetivo porque "
            "nadie midió qué pasa si se mueve el presupuesto: sería un pronóstico "
            "con cara de dato."),
        "_ojo": ("El orgánico no se puede partir por mercado con una sola marca "
                 "conectada en Zoho Social, así que su base es de los dos juntos."),
    }


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
                f"Concentrar la semana en {m}, con creativo hecho para {m}."),
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
                "Ir al mismo público con la promesa que la competencia no "
                "cubre."),
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
                "nuestro producto. Ceder el argumento correcto por no chocar "
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
                "Llevar lo que ya rindió en orgánico a otro formato y otra "
                "red."),
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
    if faltan_ids:
        return (f"Faltan {len(faltan_ids)} de los 5 identificadores que exige "
                f"Sprint para crear un work item ({', '.join(faltan_ids)}). Se "
                f"leen por API en una sola pasada; ver "
                f".claude/rutinas/completar-sprint.md.")
    if not equipo.get("personas"):
        # Ojo: esto NO impide crear la tarea. Solo apaga el selector.
        return ("Las tareas SÍ se pueden crear en Sprint; lo que no se puede es "
                "elegir responsable desde aquí, porque no hay lista de personas "
                "en config/equipo.json y no existe forma de obtenerla por API. "
                "Los work items saldrán sin asignar y alguien los reparte en "
                "Sprint.")
    return "El archivo config/equipo.json sigue con _lock en true."


def arma(periodo: str, redes: dict, panoramas: dict, por_mercado: dict,
         refs: dict, equipo: dict, hallazgos: list[dict], integridad: dict,
         cartas: list[dict] | None = None, fmt: dict | None = None,
         piezas_diarias: list[dict] | None = None,
         rango_corrida: str = "") -> dict:
    creativas = tareas(periodo, redes, panoramas, por_mercado, refs, equipo)
    de_pauta = cambios_en_pauta(
        hallazgos, integridad, periodo,
        presupuesto=instruccion_presupuesto(por_mercado, refs))
    todas = creativas + de_pauta
    ests = estrategias(redes, panoramas, por_mercado, refs, todas)

    # El plan de produccion de CADA estrategia. Va aqui y no en el tablero
    # porque cuenta cartas contra capacidad, y eso es analisis: el tablero
    # pinta, no calcula. `cartas` es opcional para no romper a quien llame sin
    # ellas —una corrida sin copys resueltos no tiene piezas que planificar—,
    # y en ese caso el plan queda en None y la tarjeta lo dice.
    for e in ests:
        e["plan"] = (plan_de_produccion(
            e, cartas, equipo, fmt, redes, por_mercado,
            refs=refs, competencia=panoramas, piezas_diarias=piezas_diarias,
            rango=rango_corrida, todas=ests) if cartas else None)

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
             "corto": "ningún copy se publica sin aprobación humana (regla 5)",
             "detalle": COPY_BLOQUEADO["motivo"],
             "remedio": f"Llenar {COPY_BLOQUEADO['donde']} con los 5 insumos que lista."},
            {"que": "cantidad de piezas por tarea",
             "corto": "es capacidad del equipo, no sale de ninguna API",
             "estado": ("DECLARADA" if not bloqueado else "LA DECIDE LA MESA"),
             "detalle": ("Cuántos artes o videos caben en una semana es capacidad "
                         "del equipo. No existe en Meta ni en Ad Library, así que "
                         "no se estima."),
             "remedio": "Declarar capacidad_semanal en config/equipo.json."},
            {"que": "ejecución de cambios en Meta Ads",
             "estado": "PROHIBIDA",
             "corto": "Meta Ads es solo lectura; las tareas salen con la "
                      "instrucción para aplicarla a mano",
             "detalle": ("Meta Ads es solo lectura por instrucción explícita del "
                         "usuario (ADR-012). Ni siquiera en estado pausado."),
             "remedio": ("Las tareas de pauta salen con la instrucción exacta para "
                         "que una persona la aplique a mano.")},
        ],
    }
