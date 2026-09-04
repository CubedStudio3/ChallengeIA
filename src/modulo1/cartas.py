"""Una carta por pieza a producir, completa y en un solo lugar.

Lo que reemplaza: antes la mesa leia tres bloques separados —la recomendacion
en un lado, el copy en otro, la referencia en un tercero— y ninguno de los tres
decia lo unico que le sirve a quien produce: QUE hacer, DE QUE hablar, CON QUE
TEXTO y CON QUE IMAGEN. Cada carta ahora trae las cuatro cosas juntas, en el
orden en que se usan.

La regla que gobierna este modulo: **el numero nunca se escribe a mano.** Los
copys viven en `config/copys_propuestos.json` porque el texto publicable es
trabajo humano y necesita aprobacion (regla 5), pero su justificacion NO puede
venir de ahi: un `porque` escrito hace dos semanas decia «SV cuesta $1.89
contra $2.89» mientras la corrida decia $2.68 contra $3.35. Un numero viejo al
lado de un KPI vivo es exactamente la mentira que este tablero existe para no
contar.

Asi que el config declara QUE evidencia sostiene cada copy —no cuanto vale— y
aqui se resuelve contra la corrida. Si una evidencia no se puede resolver, la
carta lo DICE en `faltantes`; no se calla y no se rellena (regla 1).
"""
from __future__ import annotations

# El nombre visible de cada pieza. En el config van en minuscula porque son un
# valor de taxonomia; en la carta son un titulo.
PIEZA = {"arte": "Arte", "video": "Video"}


def _pct(x: float) -> str:
    return f"{round(x * 100)}%"


def _dinero(x: float) -> str:
    return f"${x:,.2f}"


# ---------------------------------------------------------------------------
# Los resolvedores. Uno por tipo de evidencia declarable. Cada uno devuelve
# {"frase", "evidencia"} o None si la corrida no trae con que responder.
# ---------------------------------------------------------------------------

def _costo_mercado(ref, F):
    m = ref.get("mercado")
    pm = F["por_mercado"]
    a = (pm.get(m) or {}).get("principal") or {}
    if not a.get("costo_por_resultado"):
        return None
    otros = [(k, (v.get("principal") or {}).get("costo_por_resultado"))
             for k, v in pm.items() if k != m and (v.get("principal") or {}).get("costo_por_resultado")]
    frase = f"En {m} el lead cuesta {_dinero(a['costo_por_resultado'])}"
    if otros:
        frase += " · " + " · ".join(f"{k} {_dinero(c)}" for k, c in sorted(otros))
    frase += "."
    return {"frase": frase,
            "evidencia": [f"pauta de Meta · {m} · {int(a['resultados'])} leads · "
                          f"{_dinero(a['gasto'])} · {_dinero(a['costo_por_resultado'])} por lead"]}


def _sin_competencia(ref, F):
    m = ref.get("mercado")
    c = (F["competencia"] or {}).get(m)
    if not c:
        return None
    if c.get("presion_total"):
        # No es un hueco: es que la premisa dejo de ser cierta. Y eso hay que
        # decirlo, porque un copy que se apoyaba en «nadie pauta aqui» cambia
        # de valor si alguien empezo a pautar.
        return {"frase": (f"Ojo: {m} ya NO está sin disputa. Los competidores "
                          f"medidos tienen {c['presion_total']} anuncios activos ahi."),
                "evidencia": [f"Ad Library · {m} · presion {c['presion_total']}"],
                "cambio_de_premisa": True}
    marcas = len(c.get("detalle") or {})
    return {"frase": (f"Cero anuncios activos en {m} entre las {marcas} marcas "
                      f"medidas. Hoy esa atención no se le compra a nadie."),
            "evidencia": [f"Ad Library · {m} · 0 anuncios activos de {marcas} marcas"]}


def _vertical_libre(ref, F):
    v = ref.get("vertical")
    comp = F["comparativo"]
    r = (comp.get("verticales_referentes") or {}).get(v)
    k = (comp.get("verticales_competidores") or {}).get(v, 0)
    if not r:
        return None
    frase = (f"«{v}» la trabajan los referentes con {r} anuncios y los "
             f"competidores medidos con {k}.")
    if k == 0:
        frase += " Nadie a quien le compitamos está ahí."
    return {"frase": frase,
            "evidencia": [f"Ad Library · titulares clasificados · {v} · "
                          f"referentes {r} · competidores {k}"]}


def _nadie_toca(ref, F):
    v = ref.get("vertical")
    comp = F["comparativo"]
    k = (comp.get("verticales_competidores") or {}).get(v, 0)
    total = sum((comp.get("verticales_competidores") or {}).values())
    if not total:
        return None
    # «solo 1 tocan» no concuerda. El verbo se conjuga con el número, y el
    # número lo pone el dato: no se puede dejar fijo en plural.
    verbo = "toca" if k == 1 else "tocan"
    return {"frase": (f"De los {total} anuncios de competidores con titular "
                      f"clasificable, solo {k} {verbo} «{v}»."),
            "evidencia": [f"Ad Library · competidores · {v} · {k} de {total}"]}


def _territorio_ocupado(ref, F):
    msg = (ref.get("mensaje") or "").lower()
    for t in F["territorios"]:
        if t["mensaje"].lower() == msg:
            return {"frase": (f"«{t['mensaje']}» ya tiene dueño: {t['de']} lo carga "
                              f"en {_pct(t['cuota'])} de sus {t['sobre']} anuncios "
                              f"en {t['mercado']}, y lo lleva {t['dias_vivo']} días "
                              f"vivo. Ahí no se entra con una versión mejor."),
                    "evidencia": [f"Ad Library · {t['de']} · {t['creativos']} de "
                                  f"{t['sobre']} anuncios con ese titular"]}
    return None


def _formato_propio(ref, F):
    f = F["formato"]
    if not f:
        return None
    c = f.get("comparacion") or {}
    if not c.get("publicable"):
        return {"frase": None, "evidencia": [],
                "no_resuelto": ("el corte por formato no es publicable en esta "
                                "corrida: " + str(c.get("motivo")))}

    # Con alcance a la vista, la frase que MANDA es la de tasa. Citar solo el
    # ratio de interacciones absolutas fue un error publicado el 2026-09-04: la
    # carta decia «el reel rinde 4.87x el feed» y eso era, casi entero, efecto
    # de que el reel llega a 8.1x mas gente. Las dos cosas son ciertas y
    # contestan preguntas distintas, asi que la carta dice las dos.
    al = f.get("alcance") or {}
    v = al.get("veredicto") or {}
    coh = al.get("cohortes") or {}
    if v and coh.get("REELS") and coh.get("FEED"):
        r, fe = coh["REELS"], coh["FEED"]
        return {"frase": (f"En nuestra cuenta el reel llega a {v['ratio_alcance']}x "
                          f"más personas que la pieza de feed ({r['alcance']:,} de "
                          f"alcance contra {fe['alcance']:,}). De los que alcanza "
                          f"engancha a menos: {r['tasa']}% contra {fe['tasa']}% del "
                          f"feed. Para que lo vea gente nueva, reel."),
                "evidencia": [
                    (f"ads_get_ig_media + Zoho Analytics · "
                     f"{r['publicaciones_con_alcance']} reels y "
                     f"{fe['publicaciones_con_alcance']} piezas de feed con alcance"),
                    f"numerador consistente: {al.get('_numerador')}",
                    v.get("_como_leerlo") or "",
                    ("dato PROPIO: la Ad Library no publica el tipo de medio de un "
                     "anuncio ajeno"),
                ]}

    # Sin alcance no hay tasa, y el ratio absoluto se rotula por lo que es. No
    # se calla: se dice que le falta el denominador.
    gana = "el reel" if c["gana"] == "REELS" else "la pieza de feed"
    # «de el feed» no existe: la contraccion va aqui, no en el llamador.
    pierde = "del feed" if c["gana"] == "REELS" else "del reel"
    return {"frase": (f"En nuestra cuenta {gana} junta {c['ratio']}x las "
                      f"interacciones {pierde} ({c['promedio_reels']} contra "
                      f"{c['promedio_feed']} de promedio). Son interacciones "
                      f"ABSOLUTAS: sin alcance no se sabe cuánto de eso es mejor "
                      f"creativo y cuánto es más gente alcanzada."),
            "evidencia": [f"ads_get_ig_media · {c['_control_de_edad']}",
                          ("sin exportaciones de Zoho Analytics en esta corrida: no "
                           "hay alcance, así que no hay tasa"),
                          ("dato PROPIO: la Ad Library no publica el tipo de medio "
                           "de un anuncio ajeno")]}


def _carrusel(ref, F):
    c = (F["comparativo"] or {}).get("carrusel") or {}
    r, k = c.get("referentes"), c.get("competidores")
    if not r or not k:
        return None
    return {"frase": (f"Los referentes usan carrusel en {_pct(r['cuota'])} de sus "
                      f"anuncios y los competidores locales en {_pct(k['cuota'])}. "
                      f"Hay margen para contar algo por pasos en vez de una sola "
                      f"imagen."),
            "evidencia": [f"Ad Library · referentes {r['carruseles']} de {r['anuncios']}",
                          f"Ad Library · competidores {k['carruseles']} de {k['anuncios']}",
                          "el carrusel se detecta porque el titular llega con las "
                          "tarjetas pegadas por « | »"]}


def _concentracion(ref, F):
    c = (F["comparativo"] or {}).get("concentracion") or {}
    r, k = c.get("referentes"), c.get("competidores")
    if not r or not k:
        return None
    return {"frase": (f"Los competidores apuestan a un solo mensaje —la mediana "
                      f"concentra {_pct(k['mediana'])} de su inventario— y los "
                      f"referentes lo reparten ({_pct(r['mediana'])})."),
            "evidencia": [f"Ad Library · mediana de concentracion · competidores "
                          f"{_pct(k['mediana'])} sobre {k['marcas']} marcas · "
                          f"referentes {_pct(r['mediana'])} sobre {r['marcas']}"]}


def _sobreviviente(ref, F):
    marca = (ref.get("marca") or "").lower()
    for s in F["sobrevivientes"]:
        if marca in s["marca"].lower():
            return {"frase": (f"Lo que {s['marca']} no mata: «{s['mensaje']}» lleva "
                              f"{s['dias_vivo']} días vivo. Un anuncio que no se "
                              f"retira es lo más cerca que da esta fuente de decir "
                              f"que funciona."),
                    "evidencia": [f"Ad Library · {s['marca']} · vivo desde {s['desde']}"],
                    "url": s.get("url")}
    return None


def _con_mencion(ref, F):
    f = F["formato"]
    m = (f or {}).get("con_mencion")
    if not m:
        return None
    return {"frase": (f"Los reels que mencionan a alguien promedian "
                      f"{m['promedio_con']} interacciones contra {m['promedio_sin']} "
                      f"de los que no ({m['ratio']}x) — con {m['reels_con_mencion']} "
                      f"piezas, es una pista para probar, no un hallazgo."),
            "evidencia": ["ads_get_ig_media · " + m["_que_no_prueba"]]}


RESOLVEDORES = {
    "costo_mercado": _costo_mercado,
    "sin_competencia": _sin_competencia,
    "vertical_libre": _vertical_libre,
    "nadie_toca": _nadie_toca,
    "territorio_ocupado": _territorio_ocupado,
    "formato_propio": _formato_propio,
    "carrusel": _carrusel,
    "concentracion": _concentracion,
    "sobreviviente": _sobreviviente,
    "con_mencion": _con_mencion,
}


# ---------------------------------------------------------------------------

def _estructura(pieza: str, F) -> dict | None:
    """Con que forma producirlo. Sale de lo medido, no del gusto."""
    f = F["formato"] or {}
    c = f.get("comparacion") or {}
    if pieza == "video":
        if not c.get("publicable"):
            return {"que": "Reel vertical 9:16",
                    "porque": ("El corte reel contra feed no es publicable en esta "
                               "corrida, así que el formato va por convención de la "
                               "red, no por dato: " + str(c.get("motivo")))}
        v = (f.get("alcance") or {}).get("veredicto") or {}
        if v.get("ratio_alcance"):
            return {"que": "Reel vertical 9:16, no video de feed",
                    "porque": (f"El reel llega a {v['ratio_alcance']}x más personas "
                               f"que la pieza de feed en la cuenta propia. Esa es la "
                               f"razón para usarlo: alcance, no tasa.")}
        return {"que": "Reel vertical 9:16, no video de feed",
                "porque": (f"El reel junta {c['ratio']}x las interacciones del feed "
                           f"en la cuenta propia y es donde están todos los "
                           f"comentarios de la muestra. Sin alcance no se puede "
                           f"separar cuánto es creativo y cuánto es audiencia.")}
    car = (F["comparativo"] or {}).get("carrusel") or {}
    ref = car.get("referentes") or {}
    tope = F.get("tarjetas_max")
    if ref.get("cuota"):
        return {"que": (f"Carrusel de 3 a {tope or 4} tarjetas" if (tope or 4) >= 3
                        else "Pieza única"),
                "porque": (f"Los referentes lo usan en {_pct(ref['cuota'])} de sus "
                           f"anuncios contra {_pct((car.get('competidores') or {}).get('cuota', 0))} "
                           f"de los competidores, y llegan hasta {tope or 4} tarjetas.")}
    return None


def _referencia(cfg, F):
    """La referencia MEDIDA. La busqueda de Pinterest es secundaria y se rotula."""
    d = cfg.get("referencia_de") or {}
    marca = (d.get("marca") or "").lower()
    if marca:
        for m in F["dossier"]:
            if marca in (m.get("marca") or "").lower():
                msg = m.get("mensaje_top")
                return {
                    "marca": m["marca"],
                    "rol": m.get("rol"),
                    "mercado": m.get("mercado"),
                    "que_hace": d.get("que_copiar") or "",
                    "medido": ((f"Su titular más repetido es «{msg}» "
                                f"({_pct(m.get('mensaje_top_cuota') or 0)} de "
                                f"{m.get('leidos')} anuncios leídos, "
                                f"{m.get('mensaje_top_dias')} días vivo). "
                                f"Carrusel en {_pct(m.get('carrusel_cuota') or 0)} "
                                f"de sus piezas, hasta {m.get('tarjetas_max')} "
                                f"tarjetas. Sube en modo {m.get('modo')}.")
                               if msg else None),
                    "url": ("https://www.facebook.com/ads/library/?active_status=active"
                            "&ad_type=all&country=" + str(m.get("mercado") or "GT") +
                            "&view_all_page_id=" + str(m.get("page_id"))),
                    "_ojo": ("Meta no publica impresiones de anunciantes comerciales: "
                             "«el mejor anuncio» de un competidor no se puede saber. "
                             "Lo medible es qué repite y qué no retira."),
                }
    return None


def arma(copys_cfg: dict | None, reco: dict | None, por_mercado: dict,
         competencia: dict | None, fmt: dict | None, marca: dict | None,
         semana: str = "") -> dict | None:
    """Una carta por copy propuesto, con la evidencia resuelta contra la corrida.

    `semana` es el id de semana de la corrida. Cada carta se lleva su marca de
    idempotencia YA CALCULADA, para que ni el paso 9 ni el tablero tengan que
    volver a derivar la convención. Dos implementaciones de la misma convención
    es como se desincronizan dos caminos que tienen que crear lo mismo.
    """
    copys = (copys_cfg or {}).get("copys") or []
    if not copys:
        return None

    dossier = (reco or {}).get("dossier") or []
    F = {
        "por_mercado": por_mercado or {},
        "competencia": competencia or {},
        "comparativo": (reco or {}).get("comparativo") or {},
        "territorios": (reco or {}).get("territorios_ocupados") or [],
        "sobrevivientes": (reco or {}).get("sobrevivientes") or [],
        "dossier": dossier,
        "formato": fmt,
        # El tope de tarjetas que se vio en los referentes, para no recomendar
        # un carrusel de 10 cuando lo medido llega a 4.
        "tarjetas_max": max([m.get("tarjetas_max") or 0 for m in dossier
                             if m.get("rol") == "referente"] or [0]) or None,
    }

    cartas, sin_evidencia = [], []
    for c in copys:
        pieza = c.get("pieza")
        porques, evidencia, faltantes, premisa_movida = [], [], [], False
        for ref in (c.get("porque_de") or []):
            fn = RESOLVEDORES.get(ref.get("tipo"))
            if not fn:
                faltantes.append(f"evidencia de tipo desconocido: {ref.get('tipo')}")
                continue
            r = fn(ref, F)
            if not r:
                faltantes.append(ref.get("_si_falta")
                                 or f"la corrida no trae con que resolver «{ref['tipo']}»")
                continue
            if r.get("no_resuelto"):
                faltantes.append(r["no_resuelto"])
                continue
            if r.get("frase"):
                porques.append(r["frase"])
            evidencia += r.get("evidencia") or []
            if r.get("cambio_de_premisa"):
                premisa_movida = True

        if not porques:
            # Una carta sin un solo numero vivo no se publica como si lo tuviera.
            sin_evidencia.append({"id": c["id"], "titular": c.get("titular"),
                                  "faltantes": faltantes})
            continue

        est = _estructura(pieza, F)
        idem = f"{semana}::{pieza}::{c['id']}" if semana else f"{pieza}::{c['id']}"
        cartas.append({
            "id": c["id"],
            "idempotencia": idem,
            # La marca va en el nombre del work item porque Sprints no expone un
            # campo de clave externa: es la unica forma de reconocer un item ya
            # creado antes de crear otro (regla 7).
            "marca": f"[MC:{idem}]",
            "titulo": f"{PIEZA.get(pieza, pieza)} · {c.get('solucion')}",
            "pieza": pieza,
            "solucion": c.get("solucion"),
            "mercado": c.get("mercado"),
            "red": c.get("red"),
            "etapa": c.get("etapa"),
            "que_hacer": (f"Producir un {PIEZA.get(pieza, pieza).lower()} de "
                          f"{c.get('solucion')} para {c.get('mercado')}, "
                          f"{c.get('para_quien') or 'para dueño de negocio'}."),
            "de_que_hablar": c.get("angulo"),
            "como_hablarlo": c.get("como_hablarlo"),
            "porque": porques,
            "lo_que_no_se_dice": c.get("no_dice"),
            "copy": {"titular": c.get("titular"), "cuerpo": c.get("cuerpo"),
                     "cta": c.get("cta")},
            "voz_de_marca": c.get("porque_marca"),
            "visual": {
                "estructura": est,
                "mostrar": c.get("mostrar") or [],
                "no_mostrar": c.get("no_mostrar") or [],
                "_limite": ("El tipo de medio de un anuncio ajeno no lo publica la "
                            "Ad Library: la direccion visual sale de dato propio y "
                            "de la estructura observable (cuantas tarjetas), nunca "
                            "de mirar la pieza del competidor."),
            },
            "referencia": _referencia(c, F),
            "evidencia": evidencia,
            "faltantes": faltantes,
            "premisa_movida": premisa_movida,
            "bloqueada_en": c.get("bloqueada_en") or [],
            "_por_que_bloqueada": c.get("_por_que_bloqueada"),
            "aprobacion": "PENDIENTE",
            "_por_que_pendiente": ("Ningún copy se publica sin aprobación humana "
                                   "(regla 5). La carta propone; la mesa decide."),
        })

    return {
        "_registro": (copys_cfg or {}).get("_registro"),
        "_como_se_arma": ("El texto y la dirección creativa vienen de "
                          "config/copys_propuestos.json, que es trabajo humano. Los "
                          "números se resuelven contra ESTA corrida: el config "
                          "declara QUÉ evidencia sostiene cada carta, nunca cuánto "
                          "vale."),
        "cartas": cartas,
        "sin_evidencia": sin_evidencia,
        "conteo": {"cartas": len(cartas),
                   "artes": sum(1 for c in cartas if c["pieza"] == "arte"),
                   "videos": sum(1 for c in cartas if c["pieza"] == "video"),
                   "sin_evidencia": len(sin_evidencia)},
    }
