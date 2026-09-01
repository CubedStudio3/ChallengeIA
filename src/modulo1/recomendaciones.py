"""Recomendaciones de ejecución derivadas del análisis profundo de la Ad Library.

QUÉ HACE Y QUÉ NO HACE, porque la diferencia es todo el valor de este archivo.

La Ad Library **no publica rendimiento** de anunciantes comerciales: no hay
impresiones, ni gasto, ni conversiones (ADR-018, ADR-032). Así que aquí NO se
dice «esto le funcionó a la competencia». Se dice **dónde apuestan**: qué
repiten, qué no matan, con qué formato, a qué ritmo y a qué vertical le hablan.
Eso sí se mide, y de eso sí se puede sacar una instrucción de producción.

CADA recomendación tiene que traer su evidencia numérica o NO SE EMITE. No hay
una sola regla de este archivo que produzca texto sin números detrás: si el
umbral no se cumple, la recomendación simplemente no aparece. Es la regla 1 del
proyecto aplicada al lugar donde más tentador sería romperla — una recomendación
inventada suena igual de bien que una medida.

Los tres tipos:

  copiar  · el referente lo hace sistemáticamente y aquí nadie lo hace
  evitar  · el competidor ya es dueño de ese territorio de mensaje
  probar  · la señal existe pero la muestra o la fuente no la sostienen del todo

Y una advertencia que viaja con todo lo que salga de Square: anuncian en inglés
y para otro mercado. Se copia el MECANISMO, nunca el texto.
"""

from __future__ import annotations

import statistics
from datetime import date

# ── Umbrales. Están aquí arriba y con su porqué para que se puedan discutir. ──

# Un territorio está ocupado si UNA marca concentra buena parte de su inventario
# en un mensaje Y lo lleva sosteniendo. Los dos a la vez: concentración sin
# permanencia puede ser una ráfaga de la semana, y permanencia sin concentración
# es un mensaje más de la cartera.
CUOTA_OCUPADO = 0.45
DIAS_OCUPADO = 30
CREATIVOS_OCUPADO = 5      # menos que esto no es una apuesta, es una prueba

# Un titular que no distingue nada —un dominio, el nombre de la marca a secas—
# no es un territorio de mensaje. Se excluye del análisis de territorios.
def _titular_vacio(m: str) -> bool:
    s = (m or "").strip().lower()
    if not s:
        return True
    if "." in s and " " not in s:            # api.whatsapp.com, bit.ly/...
        return True
    return len(s.split()) < 2                 # una sola palabra

DIAS_SILENCIO = 30         # sin lanzar nada: la ventana está abierta
CUOTA_RAFAGA = 0.5         # más de la mitad del inventario subido en lote
VERT_MINIMO_REF = 3        # una vertical con menos de 3 anuncios no es una apuesta
LONGEVIDAD_MINIMA = 90     # días que hacen de un creativo un sobreviviente


def _cuota(parte: int, total: int) -> float | None:
    return round(parte / total, 3) if total else None


def _pc(x: float | None) -> int | None:
    """Porcentaje redondeado. Con int(), 0.625 salía como 62 y el dato es 62.5:
    un punto perdido por truncar es un número que no cuadra con su evidencia."""
    return None if x is None else round(x * 100)


def _de_cada(x: float | None) -> str | None:
    """Una cuota expresada como «N de cada M», que es como se piensa una
    producción semanal. 0.16 -> «1 de cada 6»."""
    if not x:
        return None
    from fractions import Fraction
    f = Fraction(x).limit_denominator(9)
    return f"{f.numerator} de cada {f.denominator}"


def _verticales(marca: dict) -> dict[str, int]:
    """Verticales de una marca, sin la bolsa de lo no clasificable.

    «no clasificable por el titular» es un hueco declarado, no una vertical:
    contarlo mezclaría lo que no se pudo leer con lo que sí se leyó."""
    return {v["vertical"]: v["anuncios"] for v in marca.get("audiencia_inferida", [])
            if not v["vertical"].startswith("no clasificable")}


def _es_otro_idioma(marca: dict) -> bool:
    """Marca que anuncia en otro idioma.

    NO se detecta leyendo el texto: adivinar idioma con heurísticas es como se
    inventan datos. Se declara en `config/competidores.json →
    idioma_por_marca`, mirando la página. Una marca sin declarar no dispara el
    aviso, y el generador lo dice en consola."""
    return marca.get("idioma") not in (None, "es")


def resumen_por_marca(profundo: dict, idiomas: dict | None = None) -> list[dict]:
    """La versión corta de cada marca, la que cabe en el tablero.

    El reporte largo sigue existiendo aparte; esto es lo que se lee en una
    reunión sin abrir otra pestaña."""
    salida = []
    for m in profundo.get("marcas", []):
        est, vel = m.get("estructura", {}), m.get("velocidad", {})
        msgs = m.get("mensajes", [])
        leidos = m.get("leidos", 0)
        verts = sorted(_verticales(m).items(), key=lambda x: -x[1])
        cuota_rafaga = vel.get("cuota_en_rafaga")
        clave = m.get("clave")
        salida.append({
            "clave": clave,
            "page_id": m.get("page_id"),
            "idioma": (idiomas or {}).get(clave),
            "marca": m.get("pagina"),
            "rol": m.get("rol"),
            "mercado": m.get("pais_consultado"),
            "leidos": leidos,
            "activos_declarados": m.get("activos_declarados"),
            "muestra_completa": m.get("muestra_completa"),
            "advertencia_muestra": m.get("_advertencia_muestra"),
            "mensaje_top": msgs[0]["mensaje"] if msgs else None,
            "mensaje_top_cuota": msgs[0]["cuota"] if msgs else None,
            "mensaje_top_dias": msgs[0]["dias_vivo_max"] if msgs else None,
            "mensajes_distintos": len(msgs),
            "concentracion": m.get("concentracion"),
            "carrusel": est.get("carrusel"),
            "carrusel_cuota": _cuota(est.get("carrusel", 0), leidos),
            "tarjetas_max": est.get("tarjetas_max"),
            "dias_sin_lanzar": vel.get("dias_desde_la_ultima"),
            "creativos_por_semana": vel.get("creativos_por_semana"),
            "span_dias": vel.get("span_dias"),
            "cuota_en_rafaga": cuota_rafaga,
            "modo": ("ráfaga" if (cuota_rafaga or 0) >= CUOTA_RAFAGA else "goteo"),
            # Dos listas y no una: `verticales` son las tres que se MUESTRAN en
            # el tablero, y `verticales_todas` es el mapa completo con el que se
            # COMPARA. Comparar sobre las tres visibles decía «0 anuncios de
            # competidores» en verticales que sí tenían, solo que en cuarto
            # lugar. Truncar para mostrar está bien; truncar para calcular es
            # inventar un cero.
            "verticales": [{"vertical": v, "anuncios": n} for v, n in verts[:3]],
            "verticales_todas": dict(verts),
            "cobranding_cuota": (m.get("cobranding") or {}).get("cuota"),
        })
    return sorted(salida, key=lambda x: (x["rol"] != "referente", -x["leidos"]))


# ── El dossier por marca ─────────────────────────────────────────────────────

# Umbrales de la lectura estratégica. Cada frase de la lectura sale de un
# umbral: si no se cruza, la frase no se escribe. No hay una sola línea de
# narrativa en este bloque que no tenga un número detrás.
APUESTA_UNICA = 0.6        # cuota del mensaje dominante
CARTERA = 0.3
CARRUSEL_SISTEMATICO = 0.35
CARRUSEL_CASI_NULO = 0.1
AUDIENCIA_MONO = 0.5       # cuota de la vertical principal
AUDIENCIA_REPARTIDA = 4    # verticales distintas


def lectura_estrategica(r: dict, crudo: dict) -> list[dict]:
    """Cómo se comporta esta marca, en frases con su número al lado.

    Es lo más cerca que se puede estar de una «lectura estratégica» sin
    inventar: cada frase es la traducción literal de un umbral cruzado. Lo que
    NO hay aquí es una interpretación de por qué lo hace ni de si le funciona —
    la Ad Library no publica rendimiento y eso no se deduce del inventario."""
    L, msgs = [], crudo.get("mensajes", [])
    di = lambda f, e: L.append({"frase": f, "evidencia": e})

    # 0 · Antes de leer la apuesta: ¿hay titulares que decir algo?
    # GuatePOS tenía «api.whatsapp.com» como mensaje dominante y la lectura
    # decía «apuesta a un solo mensaje: api.whatsapp.com», que no significa
    # nada. Un dominio o una palabra sola no es un territorio de mensaje.
    vacios = sum(m["creativos"] for m in msgs if _titular_vacio(m["mensaje"]))
    utiles = [m for m in msgs if not _titular_vacio(m["mensaje"])]
    if msgs and not utiles:
        di(f"No hay mensaje que leer: sus {vacios} anuncios con titular traen "
           f"un dominio o una sola palabra, no una promesa.",
           f"titulares observados: "
           f"{' · '.join(m['mensaje'] for m in msgs[:3])}")
        msgs = []
    elif vacios:
        di(f"{vacios} de sus anuncios traen un titular que no dice nada (un "
           f"dominio o una palabra sola) y quedan fuera de la lectura.",
           "un titular sin promesa no es un territorio de mensaje")
        msgs = utiles

    # 1 · Apuesta única o cartera repartida.
    c = r.get("concentracion")
    if c is not None and msgs:
        top = msgs[0]
        # La cuota se recalcula sobre los mensajes ÚTILES: si se descartaron
        # titulares vacíos, la concentración original ya no es la de esta lista.
        c = top["cuota"] if utiles else c
        if c >= APUESTA_UNICA:
            di(f"Apuesta a un solo mensaje: «{top['mensaje']}» carga "
               f"{_pc(c)}% de todo lo que tiene al aire.",
               f"{top['creativos']} de {r['leidos']} creativos · "
               f"{len(msgs)} mensajes distintos en total")
        elif c <= CARTERA:
            di(f"Cartera repartida: ningún mensaje pasa de {_pc(c)}% del "
               f"inventario, con {len(msgs)} mensajes distintos al aire.",
               f"el más repetido, «{top['mensaje']}», va en "
               f"{top['creativos']} creativos")
        else:
            di(f"Concentra sin apostarlo todo: «{top['mensaje']}» lleva "
               f"{_pc(c)}% y hay {len(msgs)} mensajes más.",
               f"{top['creativos']} de {r['leidos']} creativos")

    # 2 · A quién le habla.
    verts = sorted((r.get("verticales_todas") or {}).items(), key=lambda x: -x[1])
    tot = sum(n for _, n in verts)
    if verts and tot:
        v0, n0 = verts[0]
        if n0 / tot >= AUDIENCIA_MONO:
            di(f"Le habla casi solo a «{v0}»: {_pc(n0 / tot)}% de sus anuncios "
               f"clasificables.",
               f"{n0} de {tot} anuncios con titular clasificable")
        elif len(verts) >= AUDIENCIA_REPARTIDA:
            di(f"Reparte entre {len(verts)} verticales distintas; la mayor, "
               f"«{v0}», no pasa de {_pc(n0 / tot)}%.",
               " · ".join(f"{v} {n}" for v, n in verts[:5]))
    elif r.get("leidos"):
        di("No se puede decir a quién le habla: ninguno de sus titulares "
           "clasifica en una vertical.",
           f"{r['leidos']} anuncios leídos, 0 con titular clasificable")

    # 3 · Cómo carga los creativos.
    if r.get("modo") == "ráfaga":
        di(f"Despliega en lote: {_pc(r.get('cuota_en_rafaga'))}% de sus "
           f"creativos entraron en cargas del mismo segundo.",
           "varios anuncios con el mismo instante de creación son una subida "
           "en lote, no piezas pensadas una por una")
    elif r.get("creativos_por_semana") and (r.get("span_dias") or 0) >= 60:
        di(f"Sostiene un goteo: {r['creativos_por_semana']} creativos por "
           f"semana a lo largo de {r['span_dias']} días.",
           f"{_pc(r.get('cuota_en_rafaga') or 0)}% en ráfaga · el resto "
           f"repartido")

    # 4 · Si dejó de producir.
    d = r.get("dias_sin_lanzar")
    if d is not None and d >= DIAS_SILENCIO:
        di(f"Dejó de producir: su último creativo nuevo entró hace {d} días, "
           f"aunque sus anuncios siguen activos.",
           f"última creación registrada en la consulta del "
           f"{crudo.get('_fecha') or 'día de la lectura'}")

    # 5 · El formato.
    k = r.get("carrusel_cuota")
    if k is not None and r.get("leidos"):
        if k >= CARRUSEL_SISTEMATICO:
            di(f"Usa carrusel de forma sistemática: {_pc(k)}% de sus anuncios, "
               f"hasta {r.get('tarjetas_max')} tarjetas.",
               f"{r.get('carrusel')} de {r['leidos']} anuncios · el tipo de "
               f"medio (video o imagen) no lo devuelve la fuente")
        elif k <= CARRUSEL_CASI_NULO:
            di(f"Casi no usa carrusel: {_pc(k)}% de sus anuncios. Todo pieza "
               f"única.",
               f"{r.get('carrusel')} de {r['leidos']} anuncios")

    # 6 · La apuesta que no retira.
    top_vivo = ((crudo.get("longevidad") or {}).get("top") or [None])[0]
    if top_vivo and top_vivo.get("dias_vivo", 0) >= LONGEVIDAD_MINIMA:
        di(f"Tiene una apuesta que no retira: «{top_vivo['mensaje']}» lleva "
           f"{top_vivo['dias_vivo']} días al aire.",
           f"desde {top_vivo['entrega_desde']} · nadie deja pagando meses un "
           f"creativo que no le devuelve nada, pero la fuente no dice cuánto")

    return L


def dossier(marcas: list[dict], profundo: dict) -> list[dict]:
    """Por cada marca: a quién le habla, qué repite, qué no retira y la lectura.

    Es la versión completa del análisis pero recortable: el tablero muestra los
    primeros de cada lista y despliega el resto. Los `mensajes` salen del
    análisis profundo y NO de la lectura por país — son dos universos, y en la
    tarjeta se declara cuál se está viendo."""
    por_clave = {m.get("clave"): m for m in profundo.get("marcas", [])}
    fecha = (profundo.get("_corrida") or {}).get("fecha_consulta")
    salida = []
    for r in marcas:
        crudo = dict(por_clave.get(r["clave"]) or {})
        crudo["_fecha"] = fecha
        verts = sorted((r.get("verticales_todas") or {}).items(),
                       key=lambda x: -x[1])
        tot = sum(n for _, n in verts) or 1
        d = dict(r)
        d["audiencia"] = [{"vertical": v, "anuncios": n,
                           "cuota": round(n / tot, 3)} for v, n in verts]
        # OJO con este total: NO es un conteo de anuncios, es un conteo de
        # CLASIFICACIONES. Un titular que dice «gestiona tu negocio y cobra»
        # toca dos verticales y se cuenta en las dos (ver audiencia() en
        # adlibrary_profundo.py). Por eso puede superar el número de anuncios
        # leídos, y por eso el tablero lo rotula como clasificaciones: decir
        # «44 anuncios de 43 leídos» era un imposible en pantalla.
        d["audiencia_clasificaciones"] = tot
        d["mensajes_lista"] = [
            {"mensaje": m["mensaje"], "creativos": m["creativos"],
             "cuota": m["cuota"], "dias_vivo": m["dias_vivo_max"],
             "desde": m["primera_creacion"], "ultima": m["ultima_creacion"]}
            for m in crudo.get("mensajes", [])]
        lon = crudo.get("longevidad") or {}
        d["top_anuncios"] = [
            {"mensaje": a.get("mensaje"), "dias_vivo": a.get("dias_vivo"),
             "desde": a.get("entrega_desde"), "url": a.get("url")}
            for a in (lon.get("top") or [])]
        d["top_respondible"] = lon.get("_respondible", False)
        d["top_por_que_no"] = lon.get("_por_que_no")
        d["dias_vivo_mediana"] = lon.get("dias_vivo_mediana")
        d["lectura"] = lectura_estrategica(r, crudo)
        d["cobranding"] = crudo.get("cobranding") or {}
        salida.append(d)
    return salida


def comparativo(marcas: list[dict]) -> dict:
    """Lo que separa a los referentes de los competidores, en números.

    Se comparan CUOTAS y no totales: un referente con 50 anuncios leídos y un
    competidor con 3 no se comparan por volumen sin mentir."""
    ref = [m for m in marcas if m["rol"] == "referente"]
    com = [m for m in marcas if m["rol"] == "competidor"]

    def carr(grupo):
        c = sum(m["carrusel"] or 0 for m in grupo)
        n = sum(m["leidos"] or 0 for m in grupo)
        return {"carruseles": c, "anuncios": n, "cuota": _cuota(c, n)}

    def conc(grupo):
        vs = [m["concentracion"] for m in grupo if m["concentracion"] is not None]
        return {"mediana": round(statistics.median(vs), 3) if vs else None,
                "marcas": len(vs)}

    vref, vcom = {}, {}
    for m in ref:
        for v, n in (m.get("verticales_todas") or {}).items():
            vref[v] = vref.get(v, 0) + n
    for m in com:
        for v, n in (m.get("verticales_todas") or {}).items():
            vcom[v] = vcom.get(v, 0) + n

    return {
        "referentes": [m["marca"] for m in ref],
        "competidores": [m["marca"] for m in com],
        "carrusel": {"referentes": carr(ref), "competidores": carr(com)},
        "concentracion": {"referentes": conc(ref), "competidores": conc(com)},
        "verticales_referentes": vref,
        "verticales_competidores": vcom,
        "_como_leer_verticales": (
            "Las verticales salen de clasificar el TITULAR de cada anuncio. Un "
            "anuncio cuyo titular no dice a quién le habla queda fuera del "
            "conteo en vez de repartirse: es un hueco, no una vertical."),
    }


def _rec(id_, tipo, titulo, que_hacer, porque, evidencia, confianza="alta",
         advertencia=None):
    return {"id": id_, "tipo": tipo, "titulo": titulo, "que_hacer": que_hacer,
            "porque": porque, "evidencia": evidencia, "confianza": confianza,
            "advertencia": advertencia}


def territorios_ocupados(marcas: list[dict], profundo: dict) -> list[dict]:
    """Promesas de las que un competidor ya es dueño.

    No se emite por concentración a secas: hacen falta las tres condiciones
    —cuota, permanencia y volumen— porque cualquiera sola produce falsos
    positivos. Y un titular que no dice nada (un dominio, una palabra) se
    descarta antes de mirar los números."""
    por_clave = {m.get("clave"): m for m in profundo.get("marcas", [])}
    salida = []
    for r in marcas:
        if r["rol"] != "competidor":
            continue
        crudo = por_clave.get(r["clave"], {})
        for msg in crudo.get("mensajes", []):
            if _titular_vacio(msg["mensaje"]):
                continue
            if (msg["cuota"] >= CUOTA_OCUPADO
                    and msg["dias_vivo_max"] >= DIAS_OCUPADO
                    and msg["creativos"] >= CREATIVOS_OCUPADO):
                salida.append({
                    "mensaje": msg["mensaje"],
                    "de": r["marca"],
                    "cuota": msg["cuota"],
                    "creativos": msg["creativos"],
                    "dias_vivo": msg["dias_vivo_max"],
                    "desde": msg["primera_creacion"],
                    # El UNIVERSO sobre el que se calculó la cuota. Sin esto, el
                    # 84% de la consulta global choca contra el 74% de la lectura
                    # de GT en la misma tarjeta del tablero y parece un error.
                    # Son dos universos distintos y hay que nombrarlos.
                    "mercado": r["mercado"],
                    "sobre": r["leidos"],
                })
    return sorted(salida, key=lambda x: -x["cuota"])


def sobrevivientes(profundo: dict) -> list[dict]:
    """Los creativos que ninguna marca medida ha retirado.

    Es el sustituto declarado de «los que más impresiones tuvieron», que no
    existe. Lo que dice: nadie deja pagando 90 días un creativo que no le
    devuelve nada. Lo que NO dice: cuánto le devolvió."""
    salida = []
    for m in profundo.get("marcas", []):
        for a in (m.get("longevidad") or {}).get("top", []):
            if a.get("dias_vivo", 0) >= LONGEVIDAD_MINIMA:
                salida.append({"marca": m.get("pagina"), "rol": m.get("rol"),
                               "mensaje": a.get("mensaje"),
                               "dias_vivo": a.get("dias_vivo"),
                               "desde": a.get("entrega_desde"),
                               "url": a.get("url")})
    # Un mismo mensaje con varios creativos vivos aparecería repetido; se queda
    # el más longevo de cada mensaje por marca.
    vistos, unicos = set(), []
    for a in sorted(salida, key=lambda x: -x["dias_vivo"]):
        k = (a["marca"], a["mensaje"])
        if k in vistos:
            continue
        vistos.add(k)
        unicos.append(a)
    return unicos


def recomienda(marcas: list[dict], comp: dict, ocupados: list[dict],
               sobrev: list[dict]) -> list[dict]:
    """Las reglas. Cada una emite solo si su umbral se cumple."""
    recs = []
    ref = [m for m in marcas if m["rol"] == "referente"]
    com = [m for m in marcas if m["rol"] == "competidor"]
    # El aviso nombra las marcas y las cuenta. «Sale de una marca en otro
    # idioma» era impreciso en las reglas que promedian varios referentes: de
    # tres, uno anuncia en español.
    otros = [m["marca"] for m in ref if _es_otro_idioma(m)]
    aviso = None
    if otros:
        aviso = (f"{len(otros)} de los {len(ref)} referentes medidos anuncian en "
                 f"otro idioma y para otro mercado ({', '.join(otros)}). Se copia "
                 f"el mecanismo, nunca el texto.")

    # R1 · No repetir la promesa que ya tiene dueño.
    for t in ocupados:
        recs.append(_rec(
            "evitar-" + t["mensaje"][:28].lower().replace(" ", "-"),
            "evitar",
            f"No usar la promesa «{t['mensaje']}»",
            (f"Buscar otra promesa para el mismo producto. Si hay que competir "
             f"ahí, tiene que ser con un ángulo distinto, no con una versión "
             f"mejor de la suya."),
            (f"{t['de']} ya es dueña de ese territorio: carga "
             f"{_pc(t['cuota'])}% de los {t['sobre']} anuncios de su "
             f"{'inventario global' if t['mercado'] == 'GLOBAL' else t['mercado']}"
             f", y lo lleva sosteniendo {t['dias_vivo']} días."),
            [f"{t['creativos']} de {t['sobre']} anuncios con ese titular",
             f"{_pc(t['cuota'])}% · universo: "
             f"{'consulta global' if t['mercado'] == 'GLOBAL' else t['mercado']}",
             f"vivo desde {t['desde']} · {t['dias_vivo']} días"]))

    # R2 · Repartir el mensaje en vez de apostar todo a uno.
    cr, cc = comp["concentracion"]["referentes"], comp["concentracion"]["competidores"]
    if cr["mediana"] is not None and cc["mediana"] is not None and cc["mediana"] > cr["mediana"]:
        # El objetivo se expresa como TECHO POR PROMESA y no como una cantidad
        # de promesas. El primer intento contaba los titulares distintos de un
        # referente y salía «21 promesas» para un equipo con capacidad de 5: el
        # número de titulares de quien produce 50 anuncios no es una meta para
        # quien produce 10. La cuota sí se traslada de escala.
        techo, hoy_local = _de_cada(cr["mediana"]), _de_cada(cc["mediana"])
        recs.append(_rec(
            "repartir-mensaje", "copiar",
            "Repartir el mensaje: que ninguna promesa cargue toda la semana",
            (f"Que la promesa más repetida no pase de {techo} piezas producidas, "
             f"y que cada una apunte a una vertical distinta. Es una cuota, así "
             f"que aplica igual con capacidad de 5 que de 50."),
            (f"Los referentes reparten y los competidores locales concentran. En "
             f"un referente el mensaje más repetido carga "
             f"{_pc(cr['mediana'])}% del inventario — {techo} anuncios. En un "
             f"competidor local, {_pc(cc['mediana'])}%: {hoy_local}."),
            [f"mediana de concentración · referentes {cr['mediana']}",
             f"mediana de concentración · competidores {cc['mediana']}",
             f"{cr['marcas']} referentes y {cc['marcas']} competidores medidos"],
            advertencia=aviso))

    # R3 · Carrusel.
    kr, kc = comp["carrusel"]["referentes"], comp["carrusel"]["competidores"]
    if kr["cuota"] and kc["cuota"] is not None and kr["cuota"] > kc["cuota"]:
        maxt = max((m["tarjetas_max"] or 0) for m in ref) if ref else 0
        recs.append(_rec(
            "formato-carrusel", "copiar",
            "Producir en carrusel de varias tarjetas",
            (f"Meter carrusel en la producción de la semana. En los referentes "
             f"llegan hasta {maxt} tarjetas, así que hay margen para contar algo "
             f"por pasos en lugar de una sola imagen."),
            (f"Los referentes usan carrusel casi el doble que los competidores "
             f"locales: {_pc(kr['cuota'])}% de sus anuncios contra "
             f"{_pc(kc['cuota'])}%."),
            [f"referentes · {kr['carruseles']} de {kr['anuncios']} anuncios",
             f"competidores · {kc['carruseles']} de {kc['anuncios']} anuncios",
             "el tipo de medio (video o imagen) no lo devuelve la fuente"],
            confianza="media"))

    # R4 · Verticales que el referente trabaja y aquí nadie toca.
    vr, vc = comp["verticales_referentes"], comp["verticales_competidores"]
    libres = sorted(((v, n) for v, n in vr.items()
                     if n >= VERT_MINIMO_REF and vc.get(v, 0) == 0),
                    key=lambda x: -x[1])
    if libres:
        lista = ", ".join(f"«{v}» ({n})" for v, n in libres)
        # Qué referentes aportan esas verticales: si TODOS son hispanos, el
        # aviso de idioma no aplica y ponerlo restaría confianza sin motivo.
        aportan = sorted({m["marca"] for m in ref
                          for v in (m.get("verticales_todas") or {})
                          if v in dict(libres)})
        aviso_v = (aviso if any(_es_otro_idioma(m) for m in ref
                                if m["marca"] in aportan) else None)
        recs.append(_rec(
            "verticales-libres", "copiar",
            "Hablarle a un nicho concreto, no a «los negocios»",
            (f"Hacer una pieza por nicho: {', '.join(v for v, _ in libres)}. "
             f"Un titular que nombra el negocio del que lo lee compite distinto "
             f"que uno que dice «tu negocio»."),
            (f"Los referentes le hablan a verticales que ningún competidor "
             f"medido está tocando: {lista}."),
            [f"{v} · {n} anuncios de referentes, 0 de competidores"
             for v, n in libres] + [f"lo trabajan: {', '.join(aportan)}"],
            advertencia=aviso_v))

    # R5 · Cadencia: goteo sostenido en vez de ráfaga y silencio.
    goteo = [m for m in ref if m["modo"] == "goteo" and (m["span_dias"] or 0) >= 60
             and m["creativos_por_semana"]]
    rafaga = [m for m in com if m["modo"] == "ráfaga"]
    if goteo and rafaga:
        g, r = goteo[0], rafaga[0]
        recs.append(_rec(
            "cadencia-goteo", "copiar",
            "Sostener un goteo semanal en vez de una ráfaga y luego nada",
            (f"Repartir la producción de la semana a lo largo de la semana. "
             f"{g['creativos_por_semana']} creativos por semana sostenidos "
             f"mantienen presencia; una carga de golpe la concentra en un día."),
            (f"{g['marca']} mantiene presencia {g['span_dias']} días con "
             f"{g['creativos_por_semana']} creativos por semana. "
             f"{r['marca']} sube {_pc(r['cuota_en_rafaga'] or 0)}% de sus "
             f"creativos en lotes del mismo segundo."),
            [f"{g['marca']} · span {g['span_dias']} días, "
             f"{g['creativos_por_semana']}/semana, "
             f"{_pc(g['cuota_en_rafaga'] or 0)}% en ráfaga",
             f"{r['marca']} · {_pc(r['cuota_en_rafaga'] or 0)}% en ráfaga"]))

    # R6 · La ventana abierta: un competidor que dejó de publicar.
    for m in com:
        d = m["dias_sin_lanzar"]
        if d is not None and d >= DIAS_SILENCIO:
            recs.append(_rec(
                f"ventana-{m['clave']}", "probar",
                f"{m['marca']} lleva {d} días sin lanzar nada",
                (f"Si hay algo que se le quiera disputar a {m['marca']}, esta es "
                 f"la ventana. Verificar antes de producir: la lectura es una "
                 f"foto de un día."),
                (f"Su último creativo nuevo entró hace {d} días. Sus anuncios "
                 f"siguen activos, pero no está produciendo nuevos."),
                [f"último creativo · hace {d} días",
                 f"{m['leidos']} anuncios activos leídos",
                 (f"toda su carga cayó en {m['span_dias'] + 1} días"
                  if (m["span_dias"] or 0) > 0 else
                  "toda su carga cayó en un solo día")],
                confianza="media"))

    # R7 · Oferta con número.
    precio_ref = vr.get("promoción y precio", 0)
    precio_com = vc.get("promoción y precio", 0)
    if precio_ref >= VERT_MINIMO_REF and precio_ref > precio_com:
        recs.append(_rec(
            "oferta-con-numero", "probar",
            "Probar una oferta con cifra, no un beneficio genérico",
            ("Una pieza cuyo titular lleve un número concreto — descuento, "
             "meses, monto. Es lo único de esta lista que se puede medir contra "
             "el resto en una semana."),
            (f"Los referentes tienen {precio_ref} anuncios de promoción y precio "
             f"contra {precio_com} de los competidores locales."),
            [f"referentes · {precio_ref} anuncios con oferta",
             f"competidores · {precio_com}"],
            confianza="media",
            advertencia=aviso))

    # R8 · Lo que nadie mata.
    if sobrev:
        recs.append(_rec(
            "sobrevivientes", "probar",
            f"Leer los {len(sobrev)} titulares que nadie ha retirado",
            ("Antes de escribir el titular de la semana, leer estos. No para "
             "copiarlos: para ver qué forma tiene un titular que su dueño deja "
             f"pagando más de {LONGEVIDAD_MINIMA} días."),
            ("La Ad Library no dice qué funcionó, pero nadie deja vivo "
             f"{LONGEVIDAD_MINIMA} días un creativo que no le devuelve nada. Es "
             "el sustituto declarado del ranking por impresiones, que no existe "
             "para anunciantes comerciales."),
            [f"«{a['mensaje']}» · {a['marca']} · {a['dias_vivo']} días"
             for a in sobrev[:5]],
            confianza="media"))

    orden = {"evitar": 0, "copiar": 1, "probar": 2}
    return sorted(recs, key=lambda r: (orden.get(r["tipo"], 9), r["titulo"]))


def arma(profundo: dict | None, hoy: date,
         idiomas: dict | None = None) -> dict | None:
    """El bloque completo. Devuelve None si no hay análisis profundo que leer.

    None y no un bloque vacío: un bloque vacío se vería igual que «no hay
    recomendaciones porque nada lo amerita», y eso es otra cosa."""
    if not profundo or not profundo.get("marcas"):
        return None
    marcas = resumen_por_marca(profundo, idiomas)
    comp = comparativo(marcas)
    ocupados = territorios_ocupados(marcas, profundo)
    sobrev = sobrevivientes(profundo)
    recs = recomienda(marcas, comp, ocupados, sobrev)
    return {
        "_fuente": (profundo.get("_corrida") or {}).get("herramienta"),
        "dossier": dossier(marcas, profundo),
        "_fecha_consulta": (profundo.get("_corrida") or {}).get("fecha_consulta"),
        "_limite": (
            "La Ad Library no publica rendimiento de anunciantes comerciales. "
            "Estas recomendaciones dicen DÓNDE APUESTAN las marcas medidas —qué "
            "repiten, qué no matan, con qué formato y a qué ritmo—, no qué les "
            "funcionó. Es una foto del día de la consulta, no una serie."),
        "por_marca": marcas,
        "comparativo": comp,
        "territorios_ocupados": ocupados,
        "sobrevivientes": sobrev,
        "recomendaciones": recs,
        "no_respondible": profundo.get("no_respondible", []),
    }
