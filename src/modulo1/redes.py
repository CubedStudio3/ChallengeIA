"""Rendimiento orgánico de redes sociales, vía Zoho Social.

Este módulo existe porque un supuesto del documento maestro resultó falso. Se
daba por hecho que las métricas orgánicas «no vienen por API en esta
configuración» y que había que capturarlas a mano. Sí vienen: Zoho Social
expone los posts publicados con sus interacciones nativas por red. Lo que **no**
viene es el alcance.

Tres límites reales, y ninguno se rellena:

1. **No hay alcance ni impresiones orgánicas.** Ninguna de las cinco redes lo
   devuelve por este conector. Sin alcance no hay tasa de engagement, así que
   este módulo no la calcula. Interacciones absolutas sí; porcentajes no.
2. **No hay desglose por mercado.** El portal tiene UNA marca y una página por
   red. GT y SV comparten cuenta. El desglose que sí existe en pauta aquí no
   existe, y eso se declara en lugar de repartir a ojo.
3. **LinkedIn devuelve cero en todo.** En los 25 posts leídos,
   `like_count` y `comment_count` son 0 sin excepción. Eso es indistinguible
   entre cero real y campo no soportado. Se marca como no verificable — es la
   misma regla que ya gobierna `Not available` y `mixed` en pauta: un hueco no
   es un cero.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta

# Redes cuyo conteo de interacciones es utilizable. LinkedIn queda fuera hasta
# que alguien confirme a mano si el cero es real.
REDES_CON_INTERACCIONES_CONFIABLES = ("facebook", "instagram", "tiktok", "youtube")
# Solo estas dos devuelven vistas. En las otras, `vistas` es None y no es 0.
REDES_CON_VISTAS = ("tiktok", "youtube")


@dataclass(frozen=True)
class Publicacion:
    red: str
    fecha: date
    reacciones: int
    comentarios: int
    compartidos: int = 0
    vistas: int | None = None
    titulo: str = ""

    @property
    def interacciones(self) -> int:
        return self.reacciones + self.comentarios + self.compartidos

    def en_rango(self, desde: date, hasta: date) -> bool:
        """Rango CERRADO, igual que la convención de fechas de pauta (V0)."""
        return desde <= self.fecha <= hasta


@dataclass
class Red:
    nombre: str
    publicaciones: list[Publicacion] = field(default_factory=list)
    confiable: bool = True
    motivo_no_confiable: str = ""
    _todas: list[Publicacion] = field(default_factory=list)

    @property
    def posts(self) -> int:
        return len(self.publicaciones)

    @property
    def interacciones(self) -> int:
        return sum(p.interacciones for p in self.publicaciones)

    @property
    def vistas(self) -> int | None:
        """None cuando la red no reporta vistas. Nunca 0 por defecto."""
        if self.nombre not in REDES_CON_VISTAS:
            return None
        return sum(p.vistas or 0 for p in self.publicaciones)

    @property
    def silenciosa(self) -> bool:
        """Publicó antes, pero nada en el periodo. No es lo mismo que no existir."""
        return self.posts == 0 and bool(self._todas)

    def ultima_publicacion(self) -> date | None:
        return max((p.fecha for p in self._todas), default=None)

    def dias_de_silencio(self, hoy: date) -> int | None:
        u = self.ultima_publicacion()
        return (hoy - u).days if u else None

    def _clave_orden(self):
        return ((lambda p: (p.vistas or 0, p.interacciones))
                if self.nombre in REDES_CON_VISTAS
                else (lambda p: p.interacciones))

    def mejores(self, n: int = 3) -> list[Publicacion]:
        """Ordena por vistas si la red las da; si no, por interacciones."""
        return sorted(self.publicaciones, key=self._clave_orden(), reverse=True)[:n]

    def mejor_historico(self) -> Publicacion | None:
        """La mejor pieza de TODO lo leído, no solo del periodo.

        Una red callada no tiene nada en el periodo, así que su mejor pieza del
        periodo no existe. Decir «llegó a 0 vistas» sería falso: el canal sí
        rindió, antes. Para argumentar que vale la pena reactivarlo hace falta
        el número histórico, y hay que rotularlo como histórico.
        """
        return max(self._todas, key=self._clave_orden(), default=None)


def _pub(red: str, d: dict) -> Publicacion:
    return Publicacion(
        red=red,
        fecha=date.fromisoformat(d["fecha"]),
        reacciones=int(d.get("reacciones") or 0),
        comentarios=int(d.get("comentarios") or 0),
        compartidos=int(d.get("compartidos") or 0),
        vistas=(int(d["vistas"]) if d.get("vistas") is not None else None),
        titulo=d.get("titulo", "") or "",
    )


def _de_crudo_meta(crudo: dict, red: str) -> list[dict]:
    """Facebook e Instagram vienen con la forma nativa de la Graph API.

    Son formas distintas y hay que respetarlas: Facebook trae
    `reactions.summary.total_count`, Instagram trae `like_count` plano. Leer el
    campo equivocado devolvería 0 en silencio, que es exactamente el error que
    este proyecto no puede cometer.
    """
    import datetime as _dt
    filas = []
    for p in crudo.get("data", {}).get("data", []):
        ts = p.get("created_time")
        if not ts:
            continue
        if red == "facebook":
            reac = (p.get("reactions") or {}).get("summary", {}).get("total_count")
            if reac is None:
                reac = (p.get("likes") or {}).get("summary", {}).get("like_count", 0)
        else:
            reac = p.get("like_count", 0)
        filas.append({
            "fecha": _dt.datetime.fromtimestamp(
                ts / 1000, _dt.timezone.utc).date().isoformat(),
            "reacciones": reac or 0,
            "comentarios": p.get("comment_count") or p.get("comments_count") or 0,
            "vistas": None,
            "titulo": (p.get("message") or p.get("caption") or "").split("\n")[0][:90],
        })
    return filas


def normaliza(crudos: dict[str, dict], normalizado: dict, *,
              desde: date, hasta: date) -> dict[str, Red]:
    """Arma las cinco redes a partir del crudo de Meta y el normalizado de Zoho.

    `crudos` lleva las respuestas nativas de facebook e instagram;
    `normalizado` lleva linkedinpage, tiktok y youtube ya en forma común.
    """
    redes: dict[str, Red] = {}

    for red in ("facebook", "instagram"):
        if red not in crudos:
            continue
        todas = [_pub(red, f) for f in _de_crudo_meta(crudos[red], red)]
        redes[red] = Red(nombre=red, _todas=todas,
                         publicaciones=[p for p in todas if p.en_rango(desde, hasta)])

    for red, blq in (normalizado.get("redes") or {}).items():
        clave = "linkedin" if red == "linkedinpage" else red
        todas = [_pub(clave, f) for f in blq.get("posts", [])]
        r = Red(nombre=clave, _todas=todas,
                publicaciones=[p for p in todas if p.en_rango(desde, hasta)])
        if clave == "linkedin":
            r.confiable = False
            r.motivo_no_confiable = (normalizado.get("_linkedin_advertencia") or
                                     "el conector devuelve cero en todos los posts")
        redes[clave] = r

    return redes


def _lunes(d: date) -> date:
    return d - timedelta(days=d.weekday())


def _etiqueta_semana(d: date) -> str:
    MES = ("ene", "feb", "mar", "abr", "may", "jun",
           "jul", "ago", "sep", "oct", "nov", "dic")
    return f"{d.day} {MES[d.month - 1]}"


def serie_semanal(redes: dict[str, Red], hasta: date, semanas: int = 12) -> dict:
    """Interacciones y vistas por semana, para las redes reportadas.

    **Qué mide exactamente, porque no es obvio.** La API devuelve el conteo
    ACUMULADO de cada publicación al día de la consulta, no una serie histórica.
    Así que cada punto es «las interacciones que hoy acumulan las publicaciones
    de esa semana», no «las interacciones ocurridas esa semana». Una publicación
    vieja sigue sumando likes y eso se le atribuye a su semana de origen.

    Es una diferencia real y el gráfico la tiene que declarar. Sirve para
    comparar qué semana produjo contenido que enganchó; no sirve para decir en
    qué semana hubo más actividad de la audiencia.

    Una semana sin publicaciones vale 0, y ese 0 sí es un cero medido: no hubo
    piezas, así que no hubo interacciones de piezas de esa semana.
    """
    fin = _lunes(hasta)
    inicios = [fin - timedelta(weeks=semanas - 1 - i) for i in range(semanas)]
    ejes = [{"inicio": d.isoformat(), "etiqueta": _etiqueta_semana(d)} for d in inicios]

    inter, vistas, arranques = {}, {}, {}
    for nombre, r in redes.items():
        if not r.confiable or not r._todas:
            continue
        acum_i = [0] * semanas
        acum_v = [0] * semanas
        for p in r._todas:
            L = _lunes(p.fecha)
            if L < inicios[0] or L > fin:
                continue
            i = (L - inicios[0]).days // 7
            acum_i[i] += p.interacciones
            acum_v[i] += p.vistas or 0

        # Las semanas anteriores a la publicacion mas antigua LEIDA no son ceros
        # medidos: estan fuera de la muestra. La lectura viene topada (~25 posts
        # por red), asi que el inicio de cada serie es donde empieza su muestra,
        # no donde empieza su historia. Un cero ahi diria "no engancharon", y lo
        # que pasa es que no los leimos. Van como hueco, y la linea arranca ahi.
        primera = _lunes(min(p.fecha for p in r._todas))
        corte = max(0, (primera - inicios[0]).days // 7) if primera > inicios[0] else 0
        arranques[nombre] = {
            "semana": max(primera, inicios[0]).isoformat(),
            "indice": corte,
            "publicaciones_leidas": len(r._todas),
        }
        inter[nombre] = [None] * corte + acum_i[corte:]
        if nombre in REDES_CON_VISTAS:
            vistas[nombre] = [None] * corte + acum_v[corte:]

    return {
        "semanas": ejes,
        "interacciones": inter,
        "vistas": vistas,
        "_que_mide": ("Cada punto son las interacciones que HOY acumulan las "
                      "publicaciones de esa semana. La API no devuelve serie "
                      "histórica: devuelve el acumulado de cada pieza al día de "
                      "la consulta. Sirve para comparar qué semana produjo "
                      "contenido que enganchó, no para decir en qué semana hubo "
                      "más actividad."),
        "_vistas_de": sorted(vistas.keys()),
        "_sin_vistas": sorted(n for n in inter if n not in vistas),
        "arranques": arranques,
        "_por_que_arrancan_distinto": (
            "Cada red arranca donde arranca su muestra. La lectura viene topada "
            "en unas 25 publicaciones por red, así que las semanas anteriores a "
            "la publicación más antigua leída quedan como hueco, no como cero: "
            "un cero ahí diría que no engancharon, cuando lo que pasa es que no "
            "se leyeron."),
    }


def parte(redes: dict[str, Red], reportadas: tuple[str, ...]) -> tuple[dict, dict]:
    """Separa las redes que entran al reporte de las excluidas por decisión.

    Las excluidas no se borran: se devuelven aparte para poder reportar qué se
    dejó fuera y cuánto era. Borrarlas en silencio haría que el total pareciera
    completo cuando no lo es.
    """
    dentro = {n: r for n, r in redes.items() if n in reportadas}
    fuera = {n: r for n, r in redes.items() if n not in reportadas}
    return dentro, fuera


def resumen(redes: dict[str, Red], hoy: date, *,
            excluidas: dict[str, Red] | None = None,
            motivos: dict | None = None,
            serie: dict | None = None) -> dict:
    """Agrega lo que se puede agregar, y declara lo que no.

    No suma interacciones de redes confiables con las de LinkedIn: mezclar un
    dato medido con un dato no verificable produce un total que parece correcto
    y no lo es. Es el mismo criterio de ADR-013 sobre indicadores distintos.
    """
    detalle = {}
    for nombre, r in sorted(redes.items()):
        detalle[nombre] = {
            "publicaciones": r.posts,
            "interacciones": r.interacciones if r.confiable else None,
            "vistas": r.vistas,
            "confiable": r.confiable,
            "motivo_no_confiable": r.motivo_no_confiable or None,
            "silenciosa": r.silenciosa,
            "ultima_publicacion": (r.ultima_publicacion().isoformat()
                                   if r.ultima_publicacion() else None),
            "dias_de_silencio": r.dias_de_silencio(hoy) if r.silenciosa else None,
            "mejores": [{"fecha": p.fecha.isoformat(), "titulo": p.titulo,
                         "interacciones": p.interacciones, "vistas": p.vistas}
                        for p in r.mejores(3)],
            "mejor_historico": (
                {"fecha": mh.fecha.isoformat(), "titulo": mh.titulo,
                 "interacciones": mh.interacciones, "vistas": mh.vistas}
                if (mh := r.mejor_historico()) else None),
            "publicaciones_leidas": len(r._todas),
        }

    confiables = [r for r in redes.values() if r.confiable]
    total_int = sum(r.interacciones for r in confiables)
    total_posts = sum(r.posts for r in confiables)
    con_vistas = [r for r in confiables if r.nombre in REDES_CON_VISTAS]
    total_vistas = sum(r.vistas or 0 for r in con_vistas)

    fuera = {}
    for nombre, r in sorted((excluidas or {}).items()):
        meta = (motivos or {}).get(nombre, {})
        fuera[nombre] = {
            "publicaciones_leidas": len(r._todas),
            "publicaciones_en_periodo": r.posts,
            "interacciones_en_periodo": r.interacciones if r.confiable else None,
            "vistas_en_periodo": r.vistas,
            "confiable": r.confiable,
            "ultima_publicacion": (r.ultima_publicacion().isoformat()
                                   if r.ultima_publicacion() else None),
            "mejor_historico": (
                {"fecha": mh.fecha.isoformat(), "titulo": mh.titulo,
                 "interacciones": mh.interacciones, "vistas": mh.vistas}
                if (mh := r.mejor_historico()) else None),
            "motivo": meta.get("motivo", ""),
            "dato_que_se_pierde": meta.get("_dato_que_se_pierde", ""),
            "reversible": meta.get("_reversible", ""),
        }

    return {
        "detalle": detalle,
        "serie_semanal": serie,
        "excluidas": fuera,
        "totales": {
            "interacciones": total_int,
            "publicaciones": total_posts,
            "vistas": total_vistas if con_vistas else None,
            "redes_contadas": sorted(r.nombre for r in confiables),
            "redes_excluidas_del_total": sorted(
                r.nombre for r in redes.values() if not r.confiable),
        },
        "limites": [
            {"que": "alcance e impresiones orgánicas",
             "estado": "NO DISPONIBLE",
             "detalle": ("Ninguna de las cinco redes lo devuelve por este conector. "
                         "Sin alcance no se puede calcular tasa de engagement, así "
                         "que no se calcula. Requiere captura manual en Business Suite.")},
            {"que": "desglose por mercado (GT / SV)",
             "estado": "IMPOSIBLE EN ESTA CONFIGURACIÓN",
             "detalle": ("El portal tiene una sola marca y una sola cuenta por red. "
                         "GT y SV comparten audiencia orgánica. Repartir las "
                         "interacciones entre los dos mercados sería inventarlo.")},
        ],
    }
