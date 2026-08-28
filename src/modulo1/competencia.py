"""Normalización y clasificación de anuncios de competidores.

Dos límites de la Ad Library gobiernan este módulo:

1. **No acepta rango de fechas.** Solo responde qué está activo *ahora*. Toda
   lectura es una foto, nunca una serie. Por eso las corridas retroactivas no
   pueden incluir competencia (C2).
2. **Tope de 50 sin cursor.** Cuando `estimated_total_count` supera 50, la
   muestra está truncada y los conteos por titular son de la muestra, no del
   universo. Se marca explícitamente.

Y una lección propia: el volumen de anuncios **no** equivale a presión
competitiva. Banco Industrial tiene 845 activos en Guatemala y solo 2 tocan
pagos. Contar sin medir solapamiento de mensaje infla la amenaza 21 veces.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field
from datetime import date, datetime, timezone

TOPE_ADLIBRARY = 50

# Un titular con esta forma es una plantilla dinámica sin renderizar. No es un
# mensaje: es la sintaxis de anuncios de catálogo. Clasificarlo como ángulo
# creativo sería leer un dato que no está ahí.
MARCAS_DE_PLANTILLA = ("{{", "}}")


@dataclass(frozen=True)
class Anuncio:
    id: str
    titular: str
    creado: date
    moneda: str

    @property
    def es_plantilla(self) -> bool:
        return any(m in self.titular for m in MARCAS_DE_PLANTILLA)

    @property
    def sin_titular(self) -> bool:
        return not self.titular.strip()

    def antiguedad(self, hoy: date) -> int:
        return (hoy - self.creado).days

    def titular_normalizado(self) -> str:
        """Un titular repetido con ' | ' es el mismo mensaje en varias tarjetas."""
        if "|" not in self.titular:
            return self.titular.strip()
        partes = [p.strip() for p in self.titular.split("|") if p.strip()]
        if partes and len(set(partes)) == 1:
            return partes[0]
        return self.titular.strip()


@dataclass
class Competidor:
    nombre: str
    page_id: str
    categorias: list[str]
    total_activos: int
    anuncios: list[Anuncio] = field(default_factory=list)
    mercado: str = ""
    solapamiento: int | None = None
    origen: str = ""
    # Rol frente a QPayPro: 'competidor' disputa nuestros mercados, 'referente'
    # no. Square tiene 0 anuncios en GT: mezclarlo con Paggo en el mismo conteo
    # inventaria una amenaza. Viene de config/competidores.json, no se deduce.
    rol: str = "competidor"
    nota_estrategica: str = ""

    @property
    def muestra_truncada(self) -> bool:
        return self.total_activos > len(self.anuncios)

    @property
    def advertencia_de_muestra(self) -> str | None:
        """Advierte solo cuando de verdad se depende de una muestra truncada.

        Si el solapamiento se midió con `search_terms` sobre el universo
        completo, no hay muestra de la que depender y la advertencia sería ruido.
        """
        if not self.muestra_truncada or not self.anuncios:
            return None
        pct = len(self.anuncios) / self.total_activos * 100
        return (f"los titulares son muestra del {pct:.1f}% "
                f"({len(self.anuncios)} de {self.total_activos}): el tope de "
                f"{TOPE_ADLIBRARY} sin paginación impide enumerar el universo")

    @property
    def presion_real(self) -> int:
        """Anuncios que de verdad disputan nuestro espacio.

        Si se midió solapamiento de mensaje, ése es el número. Si no, el total
        — pero entonces el total es un límite superior, no una medición.
        """
        return self.solapamiento if self.solapamiento is not None else self.total_activos

    @property
    def presion_es_medida(self) -> bool:
        return self.solapamiento is not None

    def titulares(self) -> Counter:
        return Counter(a.titular_normalizado() for a in self.anuncios
                       if not a.es_plantilla and not a.sin_titular)

    def titular_dominante(self) -> tuple[str, int, float] | None:
        t = self.titulares()
        if not t:
            return None
        titular, veces = t.most_common(1)[0]
        return titular, veces, veces / len(self.anuncios)

    def plantillas_sin_renderizar(self) -> int:
        return sum(1 for a in self.anuncios if a.es_plantilla)

    def mensajes_con_senales(self, hoy: date) -> list[dict]:
        """Mensajes del competidor con las señales que SÍ se pueden medir.

        No es un ranking de efectividad y no debe presentarse como tal. La Ad
        Library no publica rendimiento de anunciantes comerciales: no hay
        impresiones, ni gasto, ni conversiones. Lo que sí es observable es en
        qué apuesta el anunciante:

        - `repeticiones`: cuántas veces duplicó el mismo mensaje. Duplicar
          cuesta dinero, así que la repetición es una apuesta declarada.
        - `dias_vivo`: cuántos días lleva activo el más viejo con ese mensaje.
          Un mensaje que sigue arriba es un mensaje que no mataron.
        - `dias_desde_el_ultimo`: cuándo fue la última vez que lo relanzaron.

        Un mensaje muy repetido y muy longevo es la mejor evidencia disponible
        de que le funciona. Sigue siendo inferencia, no medición.
        """
        vivos = [a for a in self.anuncios
                 if not a.es_plantilla and not a.sin_titular and a.creado != date.min]
        if not vivos:
            return []
        por_titular: dict[str, list[Anuncio]] = {}
        for a in vivos:
            por_titular.setdefault(a.titular_normalizado(), []).append(a)
        filas = []
        for titular, grupo in por_titular.items():
            mas_viejo = min(a.creado for a in grupo)
            mas_nuevo = max(a.creado for a in grupo)
            filas.append({
                "titular": titular,
                "repeticiones": len(grupo),
                # Denominador = TODOS los anuncios observados, igual que
                # titular_dominante(). Dividir entre los que tienen titular daria
                # 23/23 = 100% donde el resto del reporte dice 23/31 = 74%: dos
                # cifras para el mismo hecho, y el lector no sabria cual creer.
                "cuota": len(grupo) / len(self.anuncios),
                "sobre_anuncios": len(self.anuncios),
                "con_titular_legible": len(vivos),
                "dias_vivo": (hoy - mas_viejo).days,
                "dias_desde_el_ultimo": (hoy - mas_nuevo).days,
                "primer_lanzamiento": mas_viejo.isoformat(),
            })
        filas.sort(key=lambda f: (-f["repeticiones"], -f["dias_vivo"]))
        return filas

    def url_biblioteca(self) -> str | None:
        """Enlace a la Ad Library para ver los anuncios reales de esta página.

        Se construye con el page_id verificado, así que apunta a algo que
        existe. Es la única forma de ver los creativos: la API devuelve
        `ad_snapshot_url` por anuncio, pero el tablero no los guarda uno por uno.
        """
        if not self.page_id:
            return None
        return ("https://www.facebook.com/ads/library/?active_status=active"
                f"&ad_type=all&country={self.mercado or 'ALL'}"
                f"&view_all_page_id={self.page_id}")

    def cohortes(self, hoy: date) -> list[tuple[date, int]]:
        """Anuncios agrupados por fecha de creación, de más nuevo a más viejo."""
        c = Counter(a.creado for a in self.anuncios)
        return sorted(c.items(), key=lambda x: x[0], reverse=True)

    def lanzados_en(self, hoy: date, dias: int) -> int:
        return sum(1 for a in self.anuncios if a.antiguedad(hoy) <= dias)


def normaliza_adlibrary(crudo: dict, *, nombre: str, page_id: str,
                        categorias: list[str], mercado: str,
                        solapamiento: int | None = None,
                        origen: str = "", rol: str = "competidor",
                        nota_estrategica: str = "") -> Competidor:
    """Convierte una respuesta de `ads_library_search` en un Competidor."""
    total = crudo.get("estimated_total_count", 0)
    anuncios = []
    for a in crudo.get("ads", []):
        ts = a.get("ad_creation_time")
        creado = (datetime.fromtimestamp(ts, tz=timezone.utc).date()
                  if ts else date.min)
        anuncios.append(Anuncio(
            id=str(a.get("id", "")),
            titular=a.get("ad_creative_link_title", "") or "",
            creado=creado,
            moneda=a.get("currency", ""),
        ))
    return Competidor(nombre=nombre, page_id=page_id, categorias=categorias,
                      total_activos=total, anuncios=anuncios, mercado=mercado,
                      solapamiento=solapamiento, origen=origen, rol=rol,
                      nota_estrategica=nota_estrategica)


@dataclass
class PanoramaCompetitivo:
    mercado: str
    competidores: list[Competidor]

    @property
    def competencia(self) -> list[Competidor]:
        return [c for c in self.competidores if c.rol == "competidor"]

    @property
    def referentes(self) -> list[Competidor]:
        return [c for c in self.competidores if c.rol == "referente"]

    def por_categoria(self, categoria: str) -> list[Competidor]:
        return [c for c in self.competencia if categoria in c.categorias]

    @property
    def presion_total(self) -> int:
        """Solo los competidores presionan. Un referente que no pauta aquí no."""
        return sum(c.presion_real for c in self.competencia)

    def cuota(self, competidor: Competidor) -> float | None:
        total = self.presion_total
        return competidor.presion_real / total if total else None

    def sin_presencia(self) -> list[Competidor]:
        return [c for c in self.competencia if c.presion_real == 0]

    def dominante(self) -> Competidor | None:
        activos = [c for c in self.competencia if c.presion_real > 0]
        return max(activos, key=lambda c: c.presion_real) if activos else None
