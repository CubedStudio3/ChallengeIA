"""Alcance e impresiones del orgánico, vía Zoho Analytics.

LA TERCERA FUENTE. Zoho Social da interacciones y no alcance; `ads_get_ig_media`
tampoco. Zoho Analytics sí, y estuvo cinco días marcada «sin probar» mientras el
proyecto declaraba el hueco como insalvable. Ver
`docs/09-alcance-por-zoho-analytics.md`.

CUATRO REGLAS QUE GOBIERNAN TODO ESTE ARCHIVO, y ninguna es de estilo:

1. **`Impressions` de Facebook NO es `Reach` de Instagram.** Impresiones cuenta
   veces mostrado; alcance cuenta personas distintas. Nunca se suman, nunca se
   promedian juntas, y cada red reporta su métrica CON SU NOMBRE.

2. **El histórico de impresiones no existe antes de 2025.** Medido sobre las
   1000 filas: mediana 0 en 2020-2022, 1 en 2023, 11 en 2024, 279 en 2025. Un
   cero viejo no es «no lo vio nadie»: es que la métrica no está. Por eso hay un
   CORTE y por eso el corte se declara en la salida.

3. **La columna `Saved` de Instagram NO se usa.** Sus valores son 2 a 5 veces el
   `Reach` en casi todas las filas, y guardar algo exige haberlo visto. Es casi
   seguro impresiones con el rótulo equivocado. Un rótulo no es una
   verificación.

4. **Hay una sola página conectada.** El corte GT/SV sigue abierto y esta fuente
   no lo resuelve.
"""

from __future__ import annotations

import csv
import statistics
from datetime import date, datetime
from pathlib import Path

# El año desde el que la métrica de impresiones de Facebook es real. Sale de
# medir la mediana por año, no de elegirlo a ojo.
CORTE = date(2025, 1, 1)

# Mínimo de piezas para publicar una tasa. Una tasa sobre tres publicaciones es
# una anécdota con signo de porcentaje.
MINIMO_PARA_TASA = 5


def _lee(ruta: Path) -> list[dict]:
    if not ruta.exists():
        return []
    with ruta.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def _ent(v) -> int:
    try:
        return int(str(v).strip())
    except (TypeError, ValueError):
        return 0


def _fecha_fb(s: str) -> date | None:
    try:
        return datetime.strptime(s.strip(), "%d %b %Y %I:%M:%S %p").date()
    except (ValueError, AttributeError):
        return None


def _fecha_ig(s: str) -> date | None:
    try:
        return datetime.strptime(s.strip(), "%d %b %Y %H:%M:%S").date()
    except (ValueError, AttributeError):
        return None


def _formato_fb(tipo: str) -> str:
    return {"video": "reel o video", "photo": "imagen", "album": "carrusel",
            "link": "enlace", "status": "texto", "event": "evento"}.get(tipo, tipo or "sin tipo")


def _tasa(inter: int, base: int) -> float | None:
    """Interacciones sobre la base de exposición. None si no hay base: una tasa
    con denominador cero no es infinito, es un dato que falta."""
    return round(inter / base, 5) if base else None


def _piezas(filas: list[dict]) -> list[dict]:
    """Las piezas, una por una, con claves cortas.

    Van al tablero para que el filtro de fechas RECALCULE los agregados en vez
    de ocultar filas de una tabla ya sumada. Un filtro que oculta pero no
    recalcula muestra el total de otro periodo junto a las piezas del elegido,
    que es peor que no tener filtro.

    Claves de una letra porque son ~550 filas y el archivo del tablero ya pesa
    400 KB: `f` fecha, `t` formato, `b` base de exposición, `i` interacciones,
    `m` mensaje, `u` url."""
    return [{"f": x["fecha"].isoformat(), "t": x["formato"], "b": x["base"],
             "i": x["inter"], "m": (x["mensaje"] or "")[:110],
             "u": x.get("url") or "", "n": x.get("negativas", 0)}
            for x in sorted(filas, key=lambda y: y["fecha"])]


def _bloque(filas: list[dict], metrica: str, nombre_metrica: str) -> dict:
    """Resume un grupo de piezas. `metrica` es la clave y `nombre_metrica` el
    rótulo con el que se muestra: no se puede decir «alcance» de un número que
    son impresiones."""
    if not filas:
        return {}
    base = sum(f["base"] for f in filas)
    inter = sum(f["inter"] for f in filas)
    return {
        "piezas": len(filas),
        "metrica": metrica,
        "nombre_metrica": nombre_metrica,
        "total": base,
        "promedio": round(statistics.mean([f["base"] for f in filas])),
        "mediana": round(statistics.median([f["base"] for f in filas])),
        "interacciones": inter,
        "tasa": _tasa(inter, base) if len(filas) >= MINIMO_PARA_TASA else None,
        "_tasa_omitida": (None if len(filas) >= MINIMO_PARA_TASA else
                          f"Menos de {MINIMO_PARA_TASA} piezas: una tasa sobre "
                          f"{len(filas)} sería una anécdota con signo de porcentaje."),
    }


def facebook(carpeta: Path, desde: date, hasta: date) -> dict | None:
    """Impresiones por publicación de la página de Facebook."""
    filas = _lee(carpeta / "analytics" / "fb_post_insights.csv")
    if not filas:
        return None
    paginas, utiles, en_periodo, antes_del_corte = set(), [], [], 0
    for r in filas:
        f = _fecha_fb(r.get("Created Time", ""))
        if not f:
            continue
        paginas.add(r.get("Page Id"))
        if f < CORTE:
            antes_del_corte += 1
            continue
        item = {
            "fecha": f,
            "formato": _formato_fb(r.get("Type", "")),
            "base": _ent(r.get("Impressions")),
            "inter": (_ent(r.get("Total Reactions")) + _ent(r.get("Comments"))
                      + _ent(r.get("Shares"))),
            "shares": _ent(r.get("Shares")),
            "negativas": _ent(r.get("Reactions Sorry Total")) + _ent(r.get("Reactions Anger Total")),
            "mensaje": (r.get("Message") or "").strip(),
            "url": r.get("Post URL") or r.get("Link") or "",
        }
        utiles.append(item)
        if desde <= f <= hasta:
            en_periodo.append(item)

    por_formato = {}
    for it in utiles:
        por_formato.setdefault(it["formato"], []).append(it)

    mejores = sorted([x for x in utiles if x["base"] >= 50],
                     key=lambda x: -(x["inter"] / x["base"]))[:5]
    return {
        "red": "Facebook",
        "metrica": "impresiones",
        "_que_mide": ("Impresiones: cuántas VECES se mostró la publicación. No es "
                      "alcance — una misma persona puede contar varias veces."),
        "paginas_conectadas": sorted(p for p in paginas if p),
        "piezas_desde_el_corte": len(utiles),
        "piezas_en_el_periodo": len(en_periodo),
        "descartadas_por_el_corte": antes_del_corte,
        "_el_corte": (f"Se descartan las publicaciones anteriores a {CORTE.isoformat()}: "
                      f"la mediana de impresiones era 0 en 2020-2022, 1 en 2023 y 11 en "
                      f"2024. Un cero de esos años no es «no lo vio nadie», es que la "
                      f"métrica no está."),
        "periodo": _bloque(en_periodo, "impresiones", "impresiones"),
        "acumulado": _bloque(utiles, "impresiones", "impresiones"),
        "por_formato": {k: _bloque(v, "impresiones", "impresiones")
                        for k, v in sorted(por_formato.items(),
                                           key=lambda x: -len(x[1]))},
        "mejores_por_tasa": [
            {"mensaje": m["mensaje"][:120], "fecha": m["fecha"].isoformat(),
             "formato": m["formato"], "impresiones": m["base"],
             "interacciones": m["inter"], "tasa": _tasa(m["inter"], m["base"]),
             "url": m["url"]} for m in mejores],
        "piezas": _piezas(utiles),
        "recepcion_negativa": sum(x["negativas"] for x in utiles),
        "_recepcion_negativa": ("Reacciones «me entristece» y «me enoja». No se medía en "
                                "ninguna otra fuente."),
    }


def instagram(carpeta: Path, desde: date, hasta: date) -> dict | None:
    """Alcance por publicación de Instagram, cruzando dos tablas.

    `Media Insights` trae el alcance pero no la fecha ni el formato; `Media`
    trae la fecha, el formato y el texto pero no el alcance. El cruce va por
    `Media ID`. Las piezas sin alcance NO se cuentan como cero: quedan fuera y
    se reportan aparte."""
    med = _lee(carpeta / "analytics" / "ig_media.csv")
    ins = _lee(carpeta / "analytics" / "ig_media_insights.csv")
    reels = _lee(carpeta / "analytics" / "ig_reels_insights.csv")
    if not med:
        return None

    # DOS tablas de alcance, no una. `Media Insights` cubre el feed y `Reels
    # Insights` los reels, y eso NO estaba a la vista: la primera versión de
    # este módulo cruzó solo la de feed y dejó 206 de 291 publicaciones «sin
    # alcance». El número delató el bug — 206 es exactamente la cantidad de
    # reels—, pero si la cifra hubiera sido cualquier otra, el tablero habría
    # reportado «alcance de Instagram» excluyendo en silencio a los reels, que
    # son justo las piezas que mejor rinden.
    alcance = {}
    for r in ins:
        mid = (r.get("Media ID") or "").strip()
        if mid:
            alcance[mid] = {"reach": _ent(r.get("Reach")), "shares": 0}
    for r in reels:
        mid = (r.get("Reel ID") or "").strip()
        if mid:
            alcance[mid] = {"reach": _ent(r.get("Reach")),
                            "shares": _ent(r.get("Shares"))}

    utiles, en_periodo, sin_alcance = [], [], 0
    for r in med:
        f = _fecha_ig(r.get("Timestamp", ""))
        mid = (r.get("Media ID") or "").strip()
        a = alcance.get(mid)
        if not f:
            continue
        if not a or not a["reach"]:
            sin_alcance += 1
            continue
        prod = (r.get("Media Product Type") or "").upper()
        item = {
            "fecha": f,
            "formato": "reel" if prod == "REELS" else (
                "carrusel" if (r.get("Media Type") or "").upper() == "CAROUSEL_ALBUM"
                else "imagen"),
            "base": a["reach"],
            # Likes + comentarios en las DOS, aunque la tabla de reels traiga
            # shares: sumarle shares solo a los reels los inflaría contra el
            # feed, que no los trae. Los shares se reportan aparte.
            "inter": _ent(r.get("Like Count")) + _ent(r.get("Comments Count")),
            "shares": a.get("shares", 0),
            "mensaje": (r.get("Caption") or "").strip(),
            "url": r.get("Permalink") or "",
        }
        utiles.append(item)
        if desde <= f <= hasta:
            en_periodo.append(item)

    por_formato = {}
    for it in utiles:
        por_formato.setdefault(it["formato"], []).append(it)
    mejores = sorted([x for x in utiles if x["base"] >= 50],
                     key=lambda x: -(x["inter"] / x["base"]))[:5]
    return {
        "red": "Instagram",
        "metrica": "alcance",
        "_que_mide": ("Alcance: cuántas PERSONAS distintas vieron la publicación. No es "
                      "comparable de frente con las impresiones de Facebook."),
        "piezas_leidas": len(med),
        "piezas_con_alcance": len(utiles),
        "piezas_sin_alcance": sin_alcance,
        "_las_sin_alcance": ("La tabla de alcance cubre solo una parte de las "
                             "publicaciones. Las que no están quedan FUERA en lugar de "
                             "contarse como cero, que es lo que las convertiría en un "
                             "dato inventado."),
        "_saved_no_se_usa": (
            "La columna `Saved` de la tabla de FEED trae valores 2 a 5 veces mayores que "
            "`Reach`, y guardar algo exige haberlo visto: está mal rotulada, casi seguro "
            "son impresiones. Queda PROBADO al comparar con la tabla de REELS, donde "
            "`Saved` es menor o igual que `Reach` en las 206 filas. Se usa el `Saved` de "
            "reels y NO el de feed."),
        "_dos_tablas": (
            "El alcance de Instagram vive en DOS tablas: `Media Insights` para el feed y "
            "`Reels Insights` para los reels. Cruzar solo la primera dejaba 206 de 291 "
            "publicaciones sin alcance — y esos 206 son exactamente los reels, o sea las "
            "piezas que mejor rinden."),
        "piezas_en_el_periodo": len(en_periodo),
        "shares": sum(x.get("shares", 0) for x in utiles),
        "periodo": _bloque(en_periodo, "alcance", "alcance"),
        "acumulado": _bloque(utiles, "alcance", "alcance"),
        "por_formato": {k: _bloque(v, "alcance", "alcance")
                        for k, v in sorted(por_formato.items(),
                                           key=lambda x: -len(x[1]))},
        "mejores_por_tasa": [
            {"mensaje": m["mensaje"][:120], "fecha": m["fecha"].isoformat(),
             "formato": m["formato"], "alcance": m["base"],
             "interacciones": m["inter"], "tasa": _tasa(m["inter"], m["base"]),
             "url": m["url"]} for m in mejores],
        "piezas": _piezas(utiles),
    }


def arma(carpeta: Path, desde: date, hasta: date) -> dict | None:
    """El bloque completo, o None si no hay exportaciones que leer."""
    fb, ig = facebook(carpeta, desde, hasta), instagram(carpeta, desde, hasta)
    if not fb and not ig:
        return None
    redes = [r for r in (fb, ig) if r]
    fechas = [p["f"] for r in redes for p in r.get("piezas", [])]
    return {
        "rango_disponible": ({"desde": min(fechas), "hasta": max(fechas)}
                             if fechas else None),
        "_el_rango": ("Es el rango que tienen los datos, no el de la corrida. El "
                      "tablero deja elegir cualquier ventana dentro de esto y "
                      "recalcula; fuera de esto no hay dato y no se inventa."),
        "_fuente": "Zoho Analytics · workspace Marketing · ZohoAnalytics_exportDataView",
        "_la_regla": ("Cada red reporta SU métrica con SU nombre. Facebook da "
                      "impresiones (veces mostrado) e Instagram da alcance (personas "
                      "distintas). No se suman entre redes ni se comparan de frente: "
                      "hacerlo produciría un número que no existe."),
        "_lo_que_desbloquea": ("La tasa de interacción, que hasta hoy no se calculaba por "
                               "falta de denominador. Ver ADR-016."),
        "_sigue_abierto": ("El corte por mercado. Hay una sola página conectada, así que "
                           "esta fuente tampoco parte GT de SV."),
        "redes": redes,
    }
