"""Sección Referencias: contrastar y proponer, sin inventar la fuente.

Aquí hay una línea que no se cruza. El tablero puede:

- **contrastar** lo nuestro con lo de ellos, porque los dos lados están medidos;
- **proponer** una búsqueda de referencia visual, porque una URL de búsqueda es
  determinista y cualquiera la puede abrir y juzgar;

y no puede **citar una referencia concreta** — un pin, un post, un video de
otra marca — porque no hay conector de Pinterest en la sesión (tampoco está
conectado como canal en el portal de Zoho Social, verificado el 2026-08-27) y
porque una URL inventada que devuelve 404 es peor que no dar ninguna.

Por eso lo que sale de aquí son *búsquedas* etiquetadas como búsquedas, nunca
«la referencia que encontramos». La curaduría del pin concreto la hace una
persona; el sistema le deja el terreno preparado y dice por qué ese terreno.
"""

from __future__ import annotations

from urllib.parse import quote_plus

BASE_PINTEREST = "https://www.pinterest.com/search/pins/?q="


def _busqueda(tema: str, consulta: str, motivo: str, formato: str) -> dict:
    return {
        "tema": tema,
        "consulta": consulta,
        "formato": formato,
        "motivo": motivo,
        "url": BASE_PINTEREST + quote_plus(consulta),
        "_estado": "BUSQUEDA_NO_CURADA",
    }


def contraste(redes: dict, panoramas: dict, por_mercado: dict) -> list[dict]:
    """Filas de contraste. Cada una cita de dónde sale cada lado.

    Solo se compara lo comparable. No se pone 'engagement' de competencia
    porque la Ad Library no lo publica: la celda dice que no existe, no un cero.
    """
    filas = []
    det = redes.get("detalle", {})
    tot = redes.get("totales", {})

    vistas = tot.get("vistas")
    filas.append({
        "dimension": "Interacciones orgánicas en el periodo",
        "qpaypro": (f"{tot.get('interacciones', 0)} interacciones en "
                    f"{tot.get('publicaciones', 0)} publicaciones"),
        "referentes": "no disponible",
        "competencia": "no disponible",
        "lectura": ("La Ad Library solo expone pauta pagada. El orgánico de "
                    "competidores y referentes no está disponible por API y no se "
                    "simula: la comparación de orgánico contra ellos no se puede hacer."),
    })

    if vistas is not None:
        filas.append({
            "dimension": "Vistas de video orgánico",
            "qpaypro": f"{vistas} vistas (TikTok y YouTube)",
            "referentes": "no disponible",
            "competencia": "no disponible",
            "lectura": ("Solo TikTok y YouTube devuelven vistas. Facebook, Instagram "
                        "y LinkedIn no las dan por este conector, así que el total NO "
                        "es 'todas las vistas': es el de dos redes."),
        })

    for mercado, pan in sorted(panoramas.items()):
        comp = pan.get("detalle", {})
        activos = {n: v for n, v in comp.items() if v.get("presion_real", 0) > 0}
        nuestro = por_mercado.get(mercado, {}).get("principal") or {}
        filas.append({
            "dimension": f"Anuncios activos disputando pagos · {mercado}",
            "qpaypro": (f"{nuestro.get('campanas', 0)} campañas con entrega, "
                        f"{nuestro.get('resultados', 0)} leads"
                        if nuestro else "sin datos utilizables en este mercado"),
            "referentes": "0 (ninguno pauta en este mercado)",
            "competencia": (", ".join(f"{n}: {v['presion_real']}"
                                      for n, v in sorted(
                                          activos.items(),
                                          key=lambda x: -x[1]["presion_real"]))
                            or "0 anuncios medidos"),
            "lectura": ("Nuestro lado son campañas con entrega y leads; el suyo son "
                        "anuncios activos. Son unidades distintas y no se restan: la "
                        "fila sirve para ver quién está en el terreno, no para "
                        "declarar un ganador."),
        })
    return filas


def territorios(panoramas: dict) -> dict:
    """Qué mensaje está saturado y qué mensaje está libre.

    Se apoya en la concentración de titulares medida en Ad Library. Un titular
    que un competidor repite en 3 de cada 4 anuncios es un terreno que él está
    pagando por ocupar; entrar ahí es competir de frente en su mensaje.
    """
    saturados, libres = [], []
    for mercado, pan in sorted(panoramas.items()):
        for nombre, c in (pan.get("detalle") or {}).items():
            if c.get("rol") != "competidor":
                continue
            señales = c.get("mensajes") or []
            if not señales:
                continue
            top = señales[0]
            if top.get("cuota", 0) >= 0.5 and top.get("repeticiones", 0) >= 3:
                saturados.append({
                    "mercado": mercado, "de": nombre, "mensaje": top["titular"],
                    "cuota": round(top["cuota"], 3),
                    "repeticiones": top["repeticiones"],
                    "dias_vivo": top.get("dias_vivo"),
                    "lectura": (f"{nombre} concentra {top['cuota']:.0%} de sus anuncios "
                                f"activos en este mensaje. Es el terreno que está "
                                f"pagando por ocupar."),
                })
        if pan.get("presion_total", 0) == 0:
            libres.append({
                "mercado": mercado,
                "lectura": ("Ninguno de los competidores medidos tiene anuncios activos "
                            "aquí. El terreno está sin disputa medida — con la salvedad "
                            "de que solo se midieron los competidores del registro."),
            })
    return {"saturados": saturados, "libres": libres}


def busquedas(redes: dict, terr: dict, categorias: dict) -> list[dict]:
    """Búsquedas de referencia visual, cada una justificada por un dato.

    No hay búsqueda sin motivo. Si no se puede decir de qué dato sale, no entra.
    """
    out = []
    det = redes.get("detalle", {})

    # 1. La red que ya rinde y está callada manda el formato.
    for nombre in ("tiktok", "youtube"):
        r = det.get(nombre) or {}
        if r.get("silenciosa") and r.get("vistas") is not None:
            out.append(_busqueda(
                tema=f"Video vertical para {nombre}",
                consulta="fintech short vertical video ad layout",
                formato="video",
                motivo=(f"{nombre} acumuló vistas reales y lleva "
                        f"{r.get('dias_de_silencio')} días sin publicar. El formato que "
                        f"ya funcionaba está detenido."),
            ))

    # 2. Lo que mejor rindió en cada red define el tema, con su número.
    for nombre, r in sorted(det.items()):
        mejores = r.get("mejores") or []
        if not mejores or not r.get("confiable", True):
            continue
        m = mejores[0]
        marca = (f"{m['vistas']} vistas" if m.get("vistas") is not None
                 else f"{m['interacciones']} interacciones")
        if not m.get("titulo"):
            continue
        out.append(_busqueda(
            tema=f"Lo que mejor rindió en {nombre}",
            consulta="ecommerce integration announcement social post design",
            formato="arte",
            motivo=(f"«{m['titulo'][:70]}» fue el mejor de {nombre} con {marca}. "
                    f"Buscar referencia visual para repetir el tema, no el arte."),
        ))
        break  # una por corrida: la mejor de todas, no cinco variantes

    # 3. Un mensaje saturado por la competencia pide un contra-ángulo, no una copia.
    for s in terr.get("saturados", []):
        out.append(_busqueda(
            tema=f"Contra-ángulo frente a {s['de']}",
            consulta="payments brand differentiation poster minimal",
            formato="arte",
            motivo=(f"{s['de']} ocupa «{s['mensaje']}» en {s['cuota']:.0%} de sus "
                    f"anuncios en {s['mercado']}. Buscar referencias que resuelvan el "
                    f"mismo problema con otra promesa."),
        ))

    # 4. Un mercado sin disputa medida pide su propio creativo.
    for l in terr.get("libres", []):
        out.append(_busqueda(
            tema=f"Creativo propio para {l['mercado']}",
            consulta="local market payments campaign key visual",
            formato="arte",
            motivo=(f"{l['mercado']} no tiene competencia medida en pauta. Un creativo "
                    f"hecho para ese mercado no compite contra nadie por la atención."),
        ))
    return out


def arma(redes: dict, panoramas: dict, por_mercado: dict, categorias: dict) -> dict:
    terr = territorios(panoramas)
    return {
        "contraste": contraste(redes, panoramas, por_mercado),
        "territorios": terr,
        "busquedas": busquedas(redes, terr, categorias),
        "limites": [
            {"que": "referencias concretas de Pinterest",
             "estado": "NO DISPONIBLE",
             "detalle": ("No hay conector de Pinterest en la sesión, y Pinterest "
                         "tampoco figura entre los canales conectados del portal de "
                         "Zoho Social (verificado 2026-08-27: facebookpage, "
                         "linkedinpage, instagram, youtube, tiktok). Lo que entrega "
                         "esta sección son BÚSQUEDAS, no pines curados. Ningún pin "
                         "fue visto ni verificado por el sistema."),
             "remedio": ("Una persona abre la búsqueda, elige los pines que sirven y "
                         "los pega en la tarea. O se habilita un conector de Pinterest "
                         "y entonces sí se puede curar automáticamente.")},
            {"que": "orgánico de competidores y referentes",
             "estado": "NO DISPONIBLE",
             "detalle": ("La Ad Library expone únicamente publicidad pagada. El "
                         "contenido orgánico de otras marcas no viene por API. El "
                         "contraste de orgánico contra ellos no se puede hacer y no "
                         "se estima.")},
        ],
    }
