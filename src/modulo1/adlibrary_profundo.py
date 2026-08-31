"""Análisis profundo de la Ad Library, por marca.

Responde las preguntas que pidió Mercadeo el 2026-08-31 — y declara con la misma
claridad las que la fuente NO puede responder. Esa segunda mitad es igual de
importante: un reporte que contesta ocho preguntas cuando el dato solo sostiene
seis está inventando dos.

QUÉ DEVUELVE LA API, LITERALMENTE
`ads_library_search` entrega ocho campos por anuncio: `id`, `page_id`,
`page_name`, `ad_creative_link_title`, `ad_creation_time`,
`ad_delivery_start_time`, `ad_snapshot_url` y `currency`. Nada más. En
particular **no** entrega el cuerpo del copy, ni el tipo de medio, ni las
impresiones, ni el creador etiquetado.

LO QUE SÍ SE PUEDE RESPONDER
- Mensajes que repiten, y con cuánto inventario los respaldan.
- Longevidad, cuando la muestra está completa.
- Velocidad creativa: cadencia, ráfagas, días desde la última publicación.
- Audiencia inferida del vocabulario de los titulares.
- Estructura del creativo: tarjeta única vs. carrusel.
- La lectura estratégica que sale de todo lo anterior.

LO QUE NO, Y POR QUÉ
- **Formato video / imagen estática:** no hay campo de tipo de medio. Lo único
  derivable es cuántas tarjetas tiene el creativo (ver `estructura()`), que
  distingue carrusel de pieza única pero NO video de imagen.
- **Impresiones, y por lo tanto un top por impresiones:** Meta no publica
  métricas de entrega de anunciantes comerciales. Solo los anuncios políticos y
  de asuntos sociales traen rangos de impresiones. Es una decisión de Meta, no
  una limitación del conector, y no hay forma de sortearla.
- **Creadores etiquetados («with @handle»):** ese rótulo vive en el anuncio
  renderizado, no en los campos de la API. Se intentó leer el
  `ad_snapshot_url`; `facebook.com` está bloqueado por la política de red del
  entorno. Lo que sí se detecta es **co-branding en el titular** (ver
  `cobranding()`), que es una señal más débil y se rotula como tal.

Y una advertencia que gobierna todo: la Ad Library **no acepta rango de
fechas**. Todo esto es una foto del día de la consulta.
"""

from __future__ import annotations

import re
import statistics
from collections import Counter, defaultdict
from datetime import date, datetime, timezone

# Un titular de carrusel llega con las tarjetas pegadas por " | ". Es la única
# pista de estructura que da la API.
SEP = " | "

# Verticales que se infieren del vocabulario del titular. La inferencia se
# reporta SIEMPRE como inferencia: es lectura de texto, no segmentación
# declarada por el anunciante.
VERTICALES = {
    "restaurante": ("restaurant", "kitchen", "counter to kitchen", "orders",
                    "wine bar", "menu", "cocina", "restaurante"),
    "belleza y citas": ("beauty", "appointments", "booking", "bookings",
                        "client", "salon", "citas", "belleza"),
    "retail y tienda": ("retail", "store", "tienda", "shop", "vender",
                        "sell", "selling", "ecommerce", "en línea", "online"),
    "punto de venta / hardware": ("reader", "terminal", "register", "kiosk",
                                  "handheld", "stand", "pos", "hardware",
                                  "datáfono", "punto de venta", "tarjeta"),
    "cobros y pagos": ("payments", "payment", "get paid", "take payments",
                       "acepta pagos", "cobra", "cobrar", "recibe pagos",
                       "factura", "soluciones de pago"),
    "gestión del negocio": ("manage", "grow", "tools", "dashboard", "business",
                            "gestiona", "negocio", "controla", "ecosistema"),
    "crédito y financiamiento": ("crédito", "credito", "crediauto", "moto en línea",
                                 "préstamo", "prestamo", "cuotas", "ahorro"),
    "seguridad": ("security", "protect", "seguro", "cuida tus datos", "fraude"),
    "promoción y precio": ("off", "free", "gratis", "descuento", "promoci",
                           "puntos", "beneficios"),
}


def _dia(epoch: int) -> date:
    return datetime.fromtimestamp(epoch, tz=timezone.utc).date()


def _normaliza(titulo: str) -> str:
    """El mensaje detrás del titular, sin las repeticiones del carrusel.

    Un carrusel de 20 tarjetas llega como el mismo texto 20 veces. Contar eso
    como 20 mensajes distintos inflaría la variedad del anunciante; contarlo
    como uno solo pierde que hay 20 tarjetas. Aquí se colapsa al mensaje, y las
    tarjetas se cuentan aparte en `estructura()`.
    """
    if not titulo or not titulo.strip():
        return ""
    partes = [p.strip() for p in titulo.split(SEP.strip()) if p.strip()]
    if not partes:
        return ""
    unicas = list(dict.fromkeys(partes))
    # Un carrusel de producto lista piezas distintas: se conserva la primera y
    # se marca. Un carrusel con el mismo texto repetido colapsa a ese texto.
    # El separador NO puede ser " + ": ese es el patron que busca cobranding(),
    # y usarlo aqui hacia que leyera su propio join como el nombre de un
    # tercero («Square + Gordon's Wine Bar» salia como marca aliada).
    return unicas[0] if len(unicas) == 1 else " · ".join(unicas[:3])


def estructura(ads: list) -> dict:
    """Tarjeta única vs. carrusel, contando separadores en el titular.

    ESTO NO ES «video vs. imagen». La API no dice el tipo de medio. Lo que se
    puede afirmar es cuántas tarjetas trae el creativo, porque un carrusel pega
    el titular de cada tarjeta con " | ". Se rotula como inferencia estructural
    y nunca como formato de medio.
    """
    unicas, carruseles, tarjetas, sin_titular = 0, 0, [], 0
    for _, titulo, _, _ in ads:
        if not titulo or not titulo.strip():
            sin_titular += 1
            continue
        n = len([p for p in titulo.split(SEP.strip()) if p.strip()])
        tarjetas.append(n)
        if n > 1:
            carruseles += 1
        else:
            unicas += 1
    return {
        "tarjeta_unica": unicas,
        "carrusel": carruseles,
        "sin_titular": sin_titular,
        "_sin_titular_significa": (
            "El anuncio no trae `ad_creative_link_title`. Puede ser un formato "
            "sin enlace (video de marca, historia) o un creativo donde el título "
            "no se completó. NO se puede distinguir entre esos casos, así que no "
            "se cuenta como ninguno de los dos."),
        "tarjetas_max": max(tarjetas) if tarjetas else 0,
        "tarjetas_promedio": round(statistics.mean(tarjetas), 1) if tarjetas else 0,
        "_que_mide": (
            "Cuántas tarjetas tiene el creativo, derivado de los separadores del "
            "titular. NO es el tipo de medio: la API no dice si es video o "
            "imagen, y esa pregunta queda sin responder."),
    }


def cobranding(ads: list) -> dict:
    """Anuncios que nombran a un tercero en el titular.

    Es lo más cerca que se puede llegar de «marca propia vs. con creadores» sin
    ver el anuncio renderizado. Detecta el patrón «X + Marca» y los titulares
    que cuentan la historia de un negocio con nombre propio.

    NO es lo mismo que el rótulo «with @handle» de un creador pagado: ese vive
    en el render, no en la API. Un caso de cliente y una colaboración con un
    creador se ven igual desde aquí, y por eso el resultado se rotula como
    señal de co-branding, no como conteo de partnerships.
    """
    marcas = set()
    con_tercero = []
    for aid, titulo, _, _ in ads:
        if not titulo or not titulo.strip():
            continue
        # Se examina CADA TARJETA por separado, no el titular unido. Correr el
        # patron sobre el texto ya concatenado leia «Square · Gordon's Wine Bar»
        # como el nombre del tercero, arrastrando el separador propio.
        partes = [p.strip() for p in titulo.split(SEP.strip()) if p.strip()]
        encontrado = None
        for parte in partes:
            # «Gordon's Wine Bar + Square» → el tercero va antes del +
            m = re.match(r"^(.{3,40}?)\s\+\s(\w{3,20})\s*$", parte)
            if m:
                encontrado = m.group(1).strip()
                break
            # «Tender Cow's rapid rise» → posesivo de un negocio con nombre propio
            m2 = re.match(r"^([A-Z][\w'\u2019]+(?:\s[A-Z][\w'\u2019]+){0,2})['\u2019]s\s",
                          parte)
            if m2:
                encontrado = m2.group(1).strip()
                break
        if encontrado:
            marcas.add(encontrado)
            con_tercero.append((aid, encontrado, partes[0][:60]))
    return {
        "anuncios_con_tercero": len(con_tercero),
        "terceros_nombrados": sorted(marcas),
        "cuota": round(len(con_tercero) / len(ads), 3) if ads else 0,
        "ejemplos": [{"tercero": t, "titular": ti}
                     for _, t, ti in con_tercero[:5]],
        "_que_es_y_que_no": (
            "Señal de CO-BRANDING en el titular, no un conteo de partnerships "
            "con creadores. El rótulo «with @handle» vive en el anuncio "
            "renderizado, y facebook.com está bloqueado por la política de red "
            "del entorno. Desde la API, un caso de cliente y una colaboración "
            "pagada se ven idénticos."),
    }


def mensajes(ads: list, hoy: date) -> list[dict]:
    """Los mensajes que repiten, con cuánto inventario los respalda.

    El conteo de creativos que cargan el mismo mensaje es el mejor sustituto
    disponible de «dónde está apostando el presupuesto»: no son impresiones,
    pero un anunciante que sube quince piezas del mismo titular está diciendo
    algo. Se rotula como proxy, nunca como gasto ni como alcance.
    """
    por = defaultdict(list)
    for aid, titulo, creado, entrega in ads:
        msg = _normaliza(titulo)
        if not msg:
            continue
        por[msg].append((aid, creado, entrega))
    salida = []
    for msg, filas in por.items():
        entregas = [f[2] for f in filas]
        creaciones = [f[1] for f in filas]
        salida.append({
            "mensaje": msg,
            "creativos": len(filas),
            "cuota": round(len(filas) / len(ads), 3),
            "dias_vivo_max": (hoy - _dia(min(entregas))).days,
            "dias_vivo_min": (hoy - _dia(max(entregas))).days,
            "primera_creacion": _dia(min(creaciones)).isoformat(),
            "ultima_creacion": _dia(max(creaciones)).isoformat(),
            "ejemplo_id": filas[0][0],
        })
    return sorted(salida, key=lambda x: (-x["creativos"], -x["dias_vivo_max"]))


def audiencia(ads: list) -> list[dict]:
    """A quién le habla, inferido del vocabulario de los titulares.

    Es una inferencia sobre texto, no una segmentación declarada. Un anuncio
    puede tocar dos verticales y se cuenta en las dos. Los que no caen en
    ninguna se reportan como no clasificables en lugar de forzarlos a un cajón.
    """
    cuenta = Counter()
    sin_clasificar = 0
    for _, titulo, _, _ in ads:
        msg = _normaliza(titulo).lower()
        if not msg:
            continue
        toco = False
        for vertical, claves in VERTICALES.items():
            if any(k in msg for k in claves):
                cuenta[vertical] += 1
                toco = True
        if not toco:
            sin_clasificar += 1
    total = sum(cuenta.values()) or 1
    salida = [{"vertical": v, "anuncios": n, "cuota_del_total_clasificado":
               round(n / total, 3)} for v, n in cuenta.most_common()]
    if sin_clasificar:
        salida.append({"vertical": "no clasificable por el titular",
                       "anuncios": sin_clasificar,
                       "cuota_del_total_clasificado": None,
                       "_nota": ("El titular no contiene vocabulario de ninguna "
                                 "vertical. Forzarlo a un cajón sería inventar "
                                 "una audiencia.")})
    return salida


def longevidad(ads: list, hoy: date, completa: bool, tope: int = 10) -> dict:
    """Los anuncios que llevan más tiempo entregando.

    Si algo lleva mucho corriendo, probablemente está convirtiendo — es la
    lectura que pidió Mercadeo, y es razonable. Pero solo vale si la muestra
    está COMPLETA: cuando una marca tiene más de 50 activos, el conector
    devuelve los 50 más recientes y no expone cursor, así que los antiguos
    quedan fuera por construcción. En ese caso esta pregunta NO se responde.
    """
    if not completa:
        return {
            "_respondible": False,
            "_por_que_no": (
                "La muestra son los 50 anuncios MÁS RECIENTES de un inventario "
                "mayor. El conector topa en 50 y no expone cursor de paginación, "
                "así que los anuncios más antiguos —que son justo los que esta "
                "pregunta busca— quedan fuera. Responder con la muestra daría "
                "el más viejo DE LOS NUEVOS, que no es lo mismo y engañaría."),
            "top": [],
        }
    filas = sorted(ads, key=lambda a: a[3])
    top = [{"id": a[0], "mensaje": _normaliza(a[1]) or "(sin titular)",
            "dias_vivo": (hoy - _dia(a[3])).days,
            "entrega_desde": _dia(a[3]).isoformat(),
            "url": f"https://www.facebook.com/ads/library/?id={a[0]}"}
           for a in filas[:tope]]
    return {"_respondible": True, "top": top,
            "dias_vivo_mediana": int(statistics.median(
                [(hoy - _dia(a[3])).days for a in ads]))}


def velocidad(ads: list, hoy: date) -> dict:
    """Cadencia de publicación: si testean mucho o apuestan a pocos creativos.

    El hallazgo que sale de aquí y no se ve de otra forma: varios anuncios con
    el MISMO segundo de creación son una carga masiva, no piezas pensadas una
    por una. Distinguir ráfagas de goteo dice si el equipo del competidor está
    testeando o desplegando un lote ya decidido.
    """
    creaciones = sorted(a[2] for a in ads)
    dias = [_dia(c) for c in creaciones]
    por_dia = Counter(d.isoformat() for d in dias)

    # Una ráfaga: dos o más creativos creados en el mismo segundo.
    por_segundo = Counter(creaciones)
    rafagas = [{"instante": _dia(s).isoformat(), "creativos": n}
               for s, n in sorted(por_segundo.items()) if n > 1]

    span = (max(dias) - min(dias)).days

    # La cadencia por semana SOLO se publica si el span la sostiene. Con la
    # muestra topada en los 50 mas recientes, todas las creaciones caen en unos
    # pocos dias y el span colapsa: dividir por 1 dia daba «350 creativos por
    # semana» para Square UK, que es un artefacto de la aritmetica y no un ritmo
    # de trabajo. Cuando no se sostiene, se dice que no se sostiene.
    MINIMO_SPAN = 14
    if span >= MINIMO_SPAN:
        cadencia = round(len(ads) / span * 7, 1)
        cadencia_nota = (f"{len(ads)} creativos repartidos en {span} dias de "
                         f"ventana observada.")
    else:
        cadencia = None
        cadencia_nota = (
            f"NO se calcula. Las creaciones observadas caben en {span} dia(s), "
            f"asi que una tasa semanal seria un artefacto de dividir por una "
            f"ventana diminuta. Lo que si dice el dato: los {len(ads)} creativos "
            f"leidos se crearon en {len(por_dia)} dia(s) distintos.")

    return {
        "primera_creacion": min(dias).isoformat(),
        "ultima_creacion": max(dias).isoformat(),
        "dias_desde_la_ultima": (hoy - max(dias)).days,
        "dias_de_actividad": len(por_dia),
        "span_dias": span,
        "creativos_por_semana": cadencia,
        "_cadencia": cadencia_nota,
        "dia_mas_activo": max(por_dia.items(), key=lambda x: x[1]),
        "rafagas": rafagas[:8],
        "creativos_en_rafaga": sum(r["creativos"] for r in rafagas),
        "cuota_en_rafaga": round(
            sum(r["creativos"] for r in rafagas) / len(ads), 3) if ads else 0,
        "por_dia": dict(sorted(por_dia.items())),
        "_que_es_una_rafaga": (
            "Dos o más creativos con el mismo segundo de creación. Es una carga "
            "masiva: creativo dinámico o una subida en lote, no piezas pensadas "
            "una por una."),
    }


def perfil(clave: str, pagina: str, page_id: str, moneda: str, total: int,
           ads: list, hoy: date, pais: str | None = None) -> dict:
    """El perfil completo de una marca, con sus huecos declarados."""
    completa = total <= 50
    msgs = mensajes(ads, hoy)
    return {
        "clave": clave,
        "pagina": pagina,
        "page_id": page_id,
        "moneda": moneda,
        "pais_consultado": pais or "GLOBAL",
        "activos_declarados": total,
        "leidos": len(ads),
        "muestra_completa": completa,
        "_advertencia_muestra": None if completa else (
            f"Se leyeron {len(ads)} de {total} activos. El tope del conector es "
            f"50 y no expone cursor, así que la muestra son los MÁS RECIENTES. "
            f"Todo porcentaje de esta marca es sobre la muestra, no sobre el "
            f"inventario completo."),
        "estructura": estructura(ads),
        "cobranding": cobranding(ads),
        "mensajes": msgs,
        "concentracion": msgs[0]["cuota"] if msgs else None,
        "_concentracion_significa": (
            "Cuota del inventario leído que carga el mensaje más repetido. Alta "
            "concentración = una sola apuesta; baja = cartera repartida."),
        "audiencia_inferida": audiencia(ads),
        "longevidad": longevidad(ads, hoy, completa),
        "velocidad": velocidad(ads, hoy),
    }


NO_RESPONDIBLE = [
    {
        "pregunta": "Formatos: video, imagen estática, carrusel y su distribución",
        "estado": "PARCIAL",
        "que_si": ("Se distingue tarjeta única de carrusel contando los "
                   "separadores del titular, y se reporta el promedio y el "
                   "máximo de tarjetas."),
        "que_no": ("Video vs. imagen estática. La API no devuelve ningún campo "
                   "de tipo de medio para los anuncios de la Ad Library."),
        "como_se_desbloquearia": (
            "Habría que abrir el `ad_snapshot_url` de cada anuncio y mirarlo. "
            "Se intentó: facebook.com está bloqueado por la política de red del "
            "entorno, así que desde aquí no hay vía."),
    },
    {
        "pregunta": "Partnerships vs. brand ads: los que llevan «with» + handle",
        "estado": "PARCIAL",
        "que_si": ("Se detecta co-branding en el titular: el patrón «Negocio + "
                   "Marca» y las historias de un negocio con nombre propio."),
        "que_no": ("El rótulo «with @handle» que identifica a un creador pagado. "
                   "Vive en el anuncio renderizado, no en los campos de la API. "
                   "Desde aquí, un caso de cliente y una colaboración pagada son "
                   "indistinguibles."),
        "como_se_desbloquearia": (
            "Mismo camino que los formatos: ver el anuncio renderizado."),
    },
    {
        "pregunta": "Top 10 anuncios con más impresiones",
        "estado": "IMPOSIBLE",
        "que_si": ("Un sustituto declarado: el ranking por CANTIDAD DE CREATIVOS "
                   "que cargan el mismo mensaje, y el ranking por días vivo. Los "
                   "dos dicen dónde apuesta el anunciante. Ninguno es "
                   "impresiones."),
        "que_no": ("Impresiones. Meta NO publica métricas de entrega de "
                   "anunciantes comerciales en la Ad Library — solo los anuncios "
                   "políticos y de asuntos sociales traen rangos. Es una "
                   "decisión de Meta, no una limitación del conector, y no hay "
                   "manera de sortearla."),
        "como_se_desbloquearia": (
            "No se desbloquea. Ningún permiso ni herramienta lo expone para un "
            "anunciante comercial ajeno."),
    },
]
