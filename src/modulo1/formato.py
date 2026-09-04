"""Que rinde mas en lo nuestro: reel o pieza de feed.

Existe porque la pregunta «¿arte o video?» no se puede contestar con la
competencia: la Ad Library devuelve OCHO campos y ninguno dice si un anuncio es
video o imagen (ADR-032). Zoho Social tampoco lo distingue. El unico lugar donde
ese corte existe es `ads_get_ig_media`, sobre nuestra propia cuenta, en
`media_product_type` (ADR-031).

Asi que la recomendacion de formato se sostiene en dato PROPIO, no en el
competidor, y se rotula asi.

Las cuatro trampas de este dato, todas declaradas en la salida:

1. Los contadores son ACUMULADOS AL DIA DE LA CONSULTA, no lo que paso en la
   semana de la publicacion (ADR-025). Una pieza vieja tuvo mas dias para
   juntar interacciones.
2. Por eso se controla por antiguedad: si las dos cohortes no tienen edad
   parecida, la comparacion no se publica.
3. La muestra viene topada en 25 publicaciones por pagina. Es la pagina mas
   reciente, no el historico.
4. No hay alcance en esta fuente, asi que son interacciones ABSOLUTAS. Sin
   denominador no hay tasa, y una tasa inventada seria peor que ninguna.
"""
from __future__ import annotations

import json
import statistics as st
from datetime import date, datetime
from pathlib import Path

ARCHIVO = "ig_media.json"

# Si las dos cohortes difieren mas que esto en edad promedio, la diferencia de
# interacciones puede ser antiguedad y no formato: no se publica el ratio.
TOLERANCIA_EDAD_DIAS = 10
# Con menos de esto por cohorte, un solo reel afortunado mueve el promedio.
MINIMO_POR_COHORTE = 4


def _edad(sello: str, hoy: date) -> int:
    return (hoy - datetime.fromisoformat(sello).date()).days


def _resumen(piezas: list[dict], hoy: date) -> dict:
    inter = [p["like_count"] + p["comments_count"] for p in piezas]
    com = [p["comments_count"] for p in piezas]
    ed = [_edad(p["timestamp"], hoy) for p in piezas]
    return {
        "publicaciones": len(piezas),
        "interacciones": sum(inter),
        "promedio": round(sum(inter) / len(piezas), 1),
        "mediana": st.median(inter),
        "comentarios": sum(com),
        "sin_comentarios": sum(1 for c in com if c == 0),
        "edad_promedio_dias": round(sum(ed) / len(ed), 1),
    }


def arma(crudo: Path, hoy: date) -> dict | None:
    """Mide reel contra feed. Devuelve None si no hay el archivo."""
    f = Path(crudo) / ARCHIVO
    if not f.exists():
        return None
    d = json.loads(f.read_text(encoding="utf-8"))
    piezas = d.get("media") or []
    if not piezas:
        return None

    cohortes: dict[str, list[dict]] = {}
    for p in piezas:
        cohortes.setdefault(p["media_product_type"], []).append(p)

    res = {k: _resumen(v, hoy) for k, v in cohortes.items()}
    fechas = sorted(p["timestamp"][:10] for p in piezas)

    out = {
        "_fuente": d.get("_fuente"),
        "_fecha_consulta": d.get("_fecha_consulta"),
        "_cuenta": d.get("_usuario"),
        "_es_dato_propio": True,
        "_por_que_propio": ("La Ad Library no publica el tipo de medio de un "
                            "anuncio ajeno. Video contra imagen solo se puede "
                            "medir en la cuenta propia."),
        "_muestra": {"publicaciones": len(piezas), "desde": fechas[0],
                     "hasta": fechas[-1], "topada_en": 25},
        "_limites": [
            ("Los contadores son el acumulado al día de la consulta, no lo que "
             "pasó en la semana de cada publicación."),
            ("Son interacciones absolutas: esta fuente no trae alcance, así que "
             "no hay tasa de interacción."),
            "La lectura viene topada en 25 publicaciones: no es el histórico.",
        ],
        "cohortes": res,
        "carrusel": {
            "piezas": sum(1 for p in piezas if p["media_type"] == "CAROUSEL_ALBUM"),
            "de": len(piezas),
        },
    }

    # --- El ratio, solo si la antiguedad no lo explica ---------------------
    r, fe = res.get("REELS"), res.get("FEED")
    if not r or not fe:
        out["comparacion"] = {"publicable": False,
                              "motivo": "falta una de las dos cohortes en la muestra"}
        return out
    if r["publicaciones"] < MINIMO_POR_COHORTE or fe["publicaciones"] < MINIMO_POR_COHORTE:
        out["comparacion"] = {
            "publicable": False,
            "motivo": (f"muestra corta: {r['publicaciones']} reels y "
                       f"{fe['publicaciones']} de feed, y hacen falta "
                       f"{MINIMO_POR_COHORTE} por lado")}
        return out
    brecha = abs(r["edad_promedio_dias"] - fe["edad_promedio_dias"])
    if brecha > TOLERANCIA_EDAD_DIAS:
        out["comparacion"] = {
            "publicable": False,
            "motivo": (f"las cohortes no son comparables: {r['edad_promedio_dias']} "
                       f"dias de edad promedio en reels contra "
                       f"{fe['edad_promedio_dias']} en feed. La diferencia de "
                       f"interacciones podría ser antigüedad.")}
        return out

    ratio = r["promedio"] / fe["promedio"] if fe["promedio"] else None
    out["comparacion"] = {
        "publicable": True,
        "gana": "REELS" if r["promedio"] > fe["promedio"] else "FEED",
        "ratio": round(ratio, 2) if ratio else None,
        "promedio_reels": r["promedio"],
        "promedio_feed": fe["promedio"],
        "mediana_reels": r["mediana"],
        "mediana_feed": fe["mediana"],
        "_control_de_edad": (f"{r['edad_promedio_dias']} dias de edad promedio en "
                             f"reels contra {fe['edad_promedio_dias']} en feed: "
                             f"la brecha es de {round(brecha,1)} días, así que la "
                             f"diferencia no es antigüedad."),
        "comentarios_reels": r["comentarios"],
        "comentarios_feed": fe["comentarios"],
        "feed_sin_comentarios": f"{fe['sin_comentarios']} de {fe['publicaciones']}",
    }

    # --- Las mejores piezas, para que la mesa vea el ejemplo --------------
    todo = sorted(piezas, key=lambda p: p["like_count"] + p["comments_count"],
                  reverse=True)
    out["mejores"] = [{
        "interacciones": p["like_count"] + p["comments_count"],
        "formato": p["media_product_type"],
        "dias": _edad(p["timestamp"], hoy),
        "texto": (p.get("caption") or "").split("\n")[0][:90] or "(sin texto)",
        "url": p.get("permalink"),
    } for p in todo[:5]]

    # --- Colaboraciones: aparecio buscando formato ------------------------
    # Un @ en el texto no prueba que sea una colaboracion pagada; prueba que la
    # pieza menciona a alguien. Se rotula por lo que es: piezas CON MENCION.
    con, sin = [], []
    for p in piezas:
        if p["media_product_type"] != "REELS":
            continue
        (con if "@" in (p.get("caption") or "") else sin).append(p)
    if len(con) >= 2 and len(sin) >= 2:
        rc = _resumen(con, hoy)
        rs = _resumen(sin, hoy)
        out["con_mencion"] = {
            "reels_con_mencion": rc["publicaciones"],
            "promedio_con": rc["promedio"],
            "reels_sin_mencion": rs["publicaciones"],
            "promedio_sin": rs["promedio"],
            "ratio": round(rc["promedio"] / rs["promedio"], 2) if rs["promedio"] else None,
            "_que_no_prueba": ("Una mención no prueba una colaboración pagada, y "
                               f"la muestra son {rc['publicaciones']} piezas. Es "
                               "una pista para probar, no un hallazgo."),
        }
    return out
