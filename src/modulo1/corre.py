"""Ejecutor del Módulo 1 · Mesa Creativa.

Trabaja **solo sobre archivos**: la adquisición la hace el agente vía MCP y
vuelca el JSON crudo a `crudo/`. Este módulo no toca la red, así que es
reproducible y se puede correr mil veces sobre los mismos datos.

Uso:
    python -m modulo1.corre --corrida <carpeta> --hoy 2026-08-27 [--dry-run]
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict, is_dataclass
from datetime import date, datetime
from pathlib import Path

from base.convenciones import RangoFechas, cargar, id_semana
from base.errores import FallaRuidosa
from base.normaliza import (agrupa_por_indicador, consolida, filtra_desglose,
                            normaliza_campanas, valores_de_desglose)
from . import analiza as A
from . import cartas as CARTAS
from . import estrategia as E
from . import formato as FMT
from . import redes as R
from . import alcance as ALC
from . import pauta_diaria as PDIA
from . import recomendaciones as RECO
from . import referencias as REF
from .competencia import PanoramaCompetitivo, normaliza_adlibrary
from .plan import arma_plan, tareas_propuestas

def _mercados():
    """Mercados declarados y excluidos, desde config. Nunca hardcodeados."""
    c = cargar("convenciones", bloque="mercados")
    return tuple(c["declarados"]), c.get("excluidos", {})


def _serializa(obj):
    if is_dataclass(obj) and not isinstance(obj, type):
        return {k: _serializa(v) for k, v in asdict(obj).items()}
    if isinstance(obj, dict):
        return {k: _serializa(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_serializa(v) for v in obj]
    if isinstance(obj, date):
        return obj.isoformat()
    return obj


def carga_competencia(
    crudo: Path, registro: dict, mercado: str
) -> tuple[PanoramaCompetitivo, list[dict]]:
    """Arma el panorama de un mercado a partir de los fixtures de Ad Library.

    Devuelve DOS cosas: el panorama y la lista de marcas del registro que
    quedaron sin leer en este mercado por falta de su archivo crudo.

    Esa segunda lista existe por un fallo real. Shopify estaba en el registro sin
    `page_id`, y el tablero lo mostraba correctamente como «no se midió, falta su
    page_id». Al conseguir el page_id, el archivo crudo seguía sin existir, y
    este bucle lo saltaba con un `continue` mudo: la marca **desapareció** del
    reporte. Pasó de decir «no lo medimos» a no decir nada, que es peor.

    Una marca que no se pudo leer es un hueco, y los huecos se declaran.
    """
    comps = []
    no_leidos = []
    for entrada in registro["competidores"]:
        if entrada.get("page_id") is None:
            continue
        clave = entrada.get("_clave_archivo")
        if not clave:
            raise FallaRuidosa(
                f"El competidor '{entrada['nombre']}' no declara _clave_archivo.",
                remedio="Agregarla en config/competidores.json. Derivarla del "
                        "nombre es fragil: 'Banco Industrial (BI)' no da 'bi'.")
        archivo = crudo / f"adlibrary_{clave}_{mercado}.json"
        if not archivo.exists():
            no_leidos.append({
                "nombre": entrada["nombre"],
                "rol": entrada.get("_rol", "competidor"),
                "categorias": entrada.get("categorias", []),
                "estado": "SIN_CONSULTAR_EN_ESTE_MERCADO",
                "por_que_falta": (
                    f"Tiene page_id ({entrada['page_id']}), pero la adquisición no "
                    f"guardó {archivo.name}. Es una consulta que nunca se hizo en "
                    f"{mercado}, no una marca sin anuncios."),
                "como_obtenerlo": (
                    f"Correr la adquisición de Ad Library para «{entrada['nombre']}» "
                    f"en {mercado} con page_ids=[{entrada['page_id']}] y guardar el "
                    f"resultado en crudo/{archivo.name}."),
            })
            continue
        datos = json.loads(archivo.read_text(encoding="utf-8"))
        # Politica de solapamiento: los monoproducto aportan su total; los
        # diversificados exigen medicion explicita (ver config).
        politica = entrada.get("_politica_solapamiento", "medido")
        if politica == "total":
            solap = datos.get("estimated_total_count", 0)
        else:
            solap = datos.get("_metadatos", {}).get("_solapamiento_medido")
            if solap is None:
                raise FallaRuidosa(
                    f"'{entrada['nombre']}' es un anunciante diversificado y no "
                    f"trae solapamiento medido en {archivo.name}.",
                    remedio="Medirlo con page_ids + search_terms y guardarlo como "
                            "_solapamiento_medido en el crudo. Asumir el total "
                            "inflaria la presion competitiva.")
        medicion = entrada.get(f"medicion_{registro['_ultima_medicion'].replace('-', '_')}", {})
        comps.append(normaliza_adlibrary(
            datos, nombre=entrada["nombre"], page_id=entrada["page_id"],
            categorias=entrada.get("categorias", []), mercado=mercado,
            solapamiento=solap, origen=archivo.name,
            rol=entrada.get("_rol", "competidor"),
            nota_estrategica=medicion.get("_nota_estrategica", "")))
    return PanoramaCompetitivo(mercado=mercado, competidores=comps), no_leidos


def carga_profundo(carpeta: Path) -> dict | None:
    """El análisis profundo de la Ad Library de esta misma corrida.

    Vive en `analisis/adlibrary_profundo.json` porque lo produce un paso
    aparte (`adlibrary_profundo.py`) que lee el crudo. Si no está, se devuelve
    None y la corrida declara el hueco: es mejor un tablero sin la sección de
    recomendaciones que uno con recomendaciones de otra semana."""
    ruta = carpeta / "analisis" / "adlibrary_profundo.json"
    if not ruta.exists():
        return None
    return json.loads(ruta.read_text(encoding="utf-8"))


def rendimiento_por_mercado(campanas, mercados, indicador_principal):
    """Consolida por mercado SIN mezclar indicadores.

    El botón GT/SV del tablero se apoya en esto. Consolidar por país en el
    cliente sería fácil y estaría mal: dentro de un mismo país conviven
    campañas con indicadores distintos, y `consolida()` es lo único que se
    niega a sumarlas (ADR-013). Por eso el corte se hace aquí, donde esa
    protección existe, y no en JavaScript.
    """
    salida = {}
    for m in mercados:
        filas = filtra_desglose(campanas, "country", m)
        indicadores = {}
        for ind, grupo in sorted(agrupa_por_indicador(filas).items()):
            try:
                c = consolida(grupo)
            except FallaRuidosa as e:
                indicadores[ind] = {"utilizable": False, "motivo": e.args[0],
                                    "campanas": len(grupo)}
                continue
            indicadores[ind] = {
                "utilizable": True,
                "campanas": c.campanas, "resultados": c.resultados,
                "gasto": round(c.gasto, 2), "impresiones": c.impresiones,
                "costo_por_resultado": (round(c.costo_por_resultado, 4)
                                        if c.costo_por_resultado else None),
                "excluidas": len(c.excluidas),
                # Gasto real de filas sin resultado atribuido. Va DENTRO del
                # total y se declara aparte: se gastó, pero no produjo nada
                # medible. Antes se descartaba entero, y con él su inversión.
                "gasto_sin_resultado": c.gasto_sin_resultado,
            }
        principal = indicadores.get(indicador_principal)
        salida[m] = {
            "indicadores": indicadores,
            "principal": principal if (principal or {}).get("utilizable") else None,
            "indicador_principal": indicador_principal,
            "campanas": sorted(
                ({"etiqueta": c.etiqueta(), "indicador": c.indicador,
                  "resultados": c.resultados.numero, "gasto": c.gasto.numero,
                  "costo_por_resultado": c.costo_por_resultado.numero,
                  "impresiones": c.impresiones.numero}
                 for c in filas if c.utilizable),
                key=lambda f: -(f["gasto"] or 0)),
            "_nota_activas": ("La API no devolvió `effective_status` en esta corrida, "
                              "así que 'campañas' significa campañas CON ENTREGA en el "
                              "periodo, no campañas activas hoy. No es lo mismo y no "
                              "se rotula como tal."),
        }
    return salida


def ejecuta(carpeta: Path, hoy: date, rango: RangoFechas, *, dry_run: bool) -> dict:
    crudo = carpeta / "crudo"
    if not crudo.exists():
        raise FallaRuidosa(f"No existe {crudo}", remedio="Ejecutar la adquisición primero.")

    # --- Paso 2 · rendimiento de pauta, con desglose por país ---
    archivo_pauta = "meta_campanas_por_pais.json"
    bruto = json.loads((crudo / archivo_pauta).read_text(encoding="utf-8"))
    campanas = normaliza_campanas(bruto["ad_entities"], origen=archivo_pauta)
    fuente_pauta = f"{archivo_pauta} · {rango.etiqueta()}"

    declarados, excluidos = _mercados()

    # --- Paso 2b · desglose DIARIO de la pauta, con su compuerta -------------
    # Va aqui, antes de cualquier analisis, porque reconcilia contra el mismo
    # agregado que se acaba de cargar: si la suma de los dias no lo reproduce
    # al centavo, la corrida se detiene y no se analiza nada.
    pauta_dia = PDIA.arma(crudo, rango.desde.isoformat(), rango.hasta.isoformat(),
                          declarados=declarados, excluidos=excluidos)

    incoherentes = [c.etiqueta() for c in campanas if c.coherente() is False]
    paises_crudos = valores_de_desglose(campanas, "country")

    # Los mercados excluidos por decision del usuario se retiran del analisis,
    # pero su gasto se REPORTA. Ignorarlo en silencio esconderia que una
    # campana sigue segmentando un pais que ya no es objetivo.
    gasto_excluido = {}
    for pais, meta in excluidos.items():
        filas = filtra_desglose(campanas, "country", pais)
        if not filas:
            continue
        gasto_excluido[pais] = {
            "gasto": round(sum(f.gasto.numero or 0 for f in filas), 2),
            "impresiones": sum(f.impresiones.numero or 0 for f in filas),
            "campanas": sorted({f.nombre for f in filas}),
            "motivo_de_exclusion": meta.get("motivo", ""),
            "accion_pendiente": meta.get("_accion_pendiente", ""),
        }
    campanas = [c for c in campanas
                if c.desglose_dict.get("country") not in excluidos]
    paises = valores_de_desglose(campanas, "country")
    fuera_de_mercado = [p for p in paises if p not in declarados]

    # --- Paso 3 · competencia ---
    registro = cargar("competidores")
    cargas = {m: carga_competencia(crudo, registro, m) for m in declarados}
    panoramas = {m: c[0] for m, c in cargas.items()}
    no_leidos_por_mercado = {m: c[1] for m, c in cargas.items()}

    # --- Paso 4 · orgánico, vía Zoho Social ---
    # Corrección de un supuesto del documento maestro: SÍ viene por API. Lo que
    # no viene es el alcance. Ver src/modulo1/redes.py.
    huecos = []
    crudos_social = {}
    for red in ("facebook", "instagram"):
        f = crudo / f"social_{red}.json"
        if f.exists():
            crudos_social[red] = json.loads(f.read_text(encoding="utf-8"))
    f_norm = crudo / "social_normalizado.json"
    normalizado = (json.loads(f_norm.read_text(encoding="utf-8"))
                   if f_norm.exists() else {})

    if not crudos_social and not normalizado:
        redes_resumen = None
        huecos.append({
            "fuente": "redes sociales orgánicas (Zoho Social)",
            "descripcion": ("No hay captura de publicaciones para este periodo en "
                            "crudo/. Faltan social_facebook.json, "
                            "social_instagram.json y social_normalizado.json."),
            "impacto": ("La corrida procede solo con pauta y competencia. Las "
                        "secciones de Referencias y Estrategia pierden la mitad de "
                        "su evidencia y lo declaran."),
        })
    else:
        cfg_redes = cargar("convenciones", bloque="redes_sociales")
        reportadas = tuple(cfg_redes["reportadas"])
        redes_obj = R.normaliza(crudos_social, normalizado,
                                desde=rango.desde, hasta=rango.hasta)
        dentro, fuera_redes = R.parte(redes_obj, reportadas)
        serie = R.serie_semanal(dentro, rango.hasta)
        redes_resumen = R.resumen(dentro, hoy, excluidas=fuera_redes,
                                  motivos=cfg_redes.get("excluidas", {}),
                                  serie=serie)
        for nombre, blq in redes_resumen["excluidas"].items():
            huecos.append({
                "fuente": f"red social excluida del reporte: {nombre}",
                "descripcion": blq["motivo"],
                "impacto": blq["dato_que_se_pierde"] or "Sin dato medible perdido.",
            })
        # El `remedio` viaja hasta el final. Se estaba descartando aquí, y sin
        # remedio un hueco se vuelve a leer como imposible: la diferencia entre
        # «no se puede» y «falta conectar una página» es justamente ese campo.
        for lim in redes_resumen["limites"]:
            h = {"fuente": lim["que"], "descripcion": lim["estado"],
                 "impacto": lim.get("impacto") or lim["detalle"]}
            if lim.get("impacto") and lim.get("detalle"):
                h["detalle"] = lim["detalle"]
            if lim.get("remedio"):
                h["remedio"] = lim["remedio"]
            huecos.append(h)

    # --- Paso 5 · hallazgos, por indicador ---
    grupos = agrupa_por_indicador(campanas)
    consolidados, detalle_num, hallazgos = {}, {}, []
    for indicador, grupo in sorted(grupos.items()):
        try:
            c = consolida(grupo)
            consolidados[indicador] = c.descripcion()
            detalle_num[indicador] = {
                "campanas": c.campanas, "resultados": c.resultados,
                "gasto": round(c.gasto, 2), "impresiones": c.impresiones,
                "costo_por_resultado": (round(c.costo_por_resultado, 4)
                                        if c.costo_por_resultado else None),
                "excluidas": len(c.excluidas),
                # Gasto real de filas sin resultado atribuido. Va DENTRO del
                # total y se declara aparte: se gastó, pero no produjo nada
                # medible. Antes se descartaba entero, y con él su inversión.
                "gasto_sin_resultado": c.gasto_sin_resultado,
            }
        except FallaRuidosa as e:
            consolidados[indicador] = f"sin datos utilizables: {e.args[0]}"
            detalle_num[indicador] = {"campanas": 0, "resultados": 0, "gasto": 0.0,
                                      "impresiones": 0, "costo_por_resultado": None,
                                      "excluidas": len(grupo)}
            continue
        for fn in (A.brecha_de_eficiencia, A.concentracion_vs_eficiencia,
                   A.costo_de_oportunidad):
            h = fn(campanas, indicador, fuente_pauta)
            if h and h.valido():
                hallazgos.append(h)

    for pan in panoramas.values():
        for comp in pan.competidores:
            for fn in (A.concentracion_de_mensaje,):
                h = fn(comp, comp.origen)
                if h and h.valido():
                    hallazgos.append(h)
            h = A.escalada_competitiva(comp, hoy, comp.origen)
            if h and h.valido():
                hallazgos.append(h)

    indicador_principal = "actions:lead"
    for mercado, pan in panoramas.items():
        h = A.mercado_sin_disputa(
            pan, filtra_desglose(campanas, "country", mercado),
            indicador_principal, fuente_pauta,
            f"Ad Library, {mercado}, foto del {hoy.isoformat()}")
        if h and h.valido():
            hallazgos.append(h)

    # --- Paso 6 · loop de verificación ---
    from base.registro import Corrida
    previa = Corrida.anterior_a(rango)
    verificacion = ("No aplicable: no existe corrida de la semana anterior. "
                    "No es un dato faltante, es la primera corrida."
                    if previa is None else
                    f"Corrida previa encontrada: {previa['id']}")

    # --- Paso 7 · plan ---
    plan = arma_plan(rango.etiqueta(), campanas, indicador_principal,
                     hallazgos, fuente_pauta, datos_por_formato=None)

    # --- Paso 8 · las secciones del tablero ---
    por_mercado = rendimiento_por_mercado(campanas, declarados, indicador_principal)

    competencia = {
        m: {"presion_total": p.presion_total,
            "dominante": p.dominante().nombre if p.dominante() else None,
            "detalle": {c.nombre: {
                "rol": c.rol,
                "categorias": c.categorias,
                "page_id": c.page_id,
                "activos_declarados": c.total_activos,
                "anuncios_en_muestra": len(c.anuncios),
                "metodo": c.metodo or None,
                "presion_real": c.presion_real,
                "presion_medida": c.presion_es_medida,
                "advertencia_muestra": c.advertencia_de_muestra,
                "nota_estrategica": c.nota_estrategica or None,
                "moneda": next((a.moneda for a in c.anuncios if a.moneda), None),
                "plantillas_sin_renderizar": c.plantillas_sin_renderizar(),
                "lanzados_10d": c.lanzados_en(hoy, 10),
                "lanzados_3d": c.lanzados_en(hoy, 3),
                "cohortes": [{"fecha": f.isoformat(), "anuncios": n}
                             for f, n in c.cohortes(hoy)[:6] if f != date.min],
                "mensajes": c.mensajes_con_senales(hoy)[:5],
                "url_biblioteca": c.url_biblioteca(),
            } for c in p.competidores}}
        for m, p in panoramas.items()}

    # Competidores del registro que no se pudieron medir. Un competidor sin
    # page_id no es un competidor sin anuncios: es uno que no se midió, y el
    # tablero tiene que mostrar la diferencia.
    sin_page_id = [{"nombre": e["nombre"], "rol": e.get("_rol", "competidor"),
                    "categorias": e.get("categorias", []),
                    "estado": e.get("_estado"),
                    "por_que_falta": e.get("_por_que_falta"),
                    "como_obtenerlo": e.get("_como_obtenerlo")}
                   for e in registro["competidores"] if not e.get("page_id")]
    # Se arma por mercado: una marca puede estar leída en GT y no en SV, y
    # repetir una sola lista en los dos diría que falta donde no falta.
    for m in competencia:
        competencia[m]["sin_medir"] = (
            sin_page_id + no_leidos_por_mercado.get(m, []))

    redes_para_secciones = redes_resumen or {"detalle": {}, "totales": {}}
    refs = REF.arma(redes_para_secciones, competencia, por_mercado,
                    registro.get("categorias", {}))

    # --- Paso 8b · recomendaciones de ejecución ---
    # Salen del análisis profundo de la Ad Library, no de la lectura básica: lo
    # que se necesita para recomendar es el corte por formato, cadencia y
    # vertical, y eso solo lo trae el paso profundo.
    # --- Paso 8a · alcance e impresiones del organico ---
    # Tercera fuente: Zoho Analytics. Zoho Social da interacciones sin
    # denominador; esta da el denominador. Ver docs/09-alcance-por-zoho-analytics.md.
    alc = ALC.arma(crudo, rango.desde, rango.hasta)
    if alc:
        # Ojo: `redes_resumen` es None cuando Zoho Social no devolvio nada. El
        # alcance viene de OTRA fuente y no puede depender de esa: si se
        # colgara de ella, un fallo de Zoho Social se llevaria el alcance por
        # delante sin motivo.
        if redes_resumen is None:
            redes_resumen = {"detalle": {}, "totales": {}, "limites": [],
                             "excluidas": {},
                             "_solo_alcance": ("Zoho Social no devolvio "
                                               "publicaciones; esto es solo el "
                                               "alcance de Zoho Analytics.")}
        redes_resumen["alcance"] = alc
    else:
        huecos.append({
            "fuente": "alcance del organico",
            "descripcion": "SIN EXPORTACIONES DE ZOHO ANALYTICS",
            "impacto": ("Se reportan interacciones absolutas sin tasa, como antes del "
                        "2026-09-02. La tasa de interaccion no se calcula: sin "
                        "denominador seria un numero inventado."),
            "remedio": ("Exportar las cuatro vistas de Zoho Analytics a "
                        "`crudo/analytics/`. Los ids y la receta estan en "
                        "docs/09-alcance-por-zoho-analytics.md."),
        })

    redes_para_secciones = redes_resumen or {"detalle": {}, "totales": {}}

    # --- Paso 8c · copys propuestos ---
    # Vienen de config/copys_propuestos.json, redactados a partir del lenguaje
    # real del sitio y de un angulo con evidencia. La tuberia los transporta y
    # los marca; no los inventa. Ninguno se publica sin aprobacion (regla 5).
    try:
        copys_cfg = cargar("copys_propuestos", permitir_bloqueado=True)
    except Exception:
        copys_cfg = None
    copys = (copys_cfg or {}).get("copys") or None
    if not copys:
        huecos.append({
            "fuente": "copys propuestos",
            "descripcion": "SIN PROPUESTAS DE COPY",
            "impacto": "La mesa no tiene texto que aprobar; solo angulos.",
            "remedio": ("Redactarlos con la skill copys-qpaypro y dejarlos en "
                        "config/copys_propuestos.json."),
        })

    profundo = carga_profundo(carpeta)
    idiomas = {k: v for k, v in (registro.get("idioma_por_marca") or {}).items()
               if not k.startswith("_")}
    # Los datos de marca salen de config/marca.json, extraídos del sitio. Sin
    # ellos las recomendaciones no pueden distinguir una vertical que ya
    # atendemos de una que sería una apuesta nueva.
    try:
        marca_datos = cargar("marca", permitir_bloqueado=True)
    except Exception:
        marca_datos = None
    reco = RECO.arma(profundo, hoy, idiomas, marca_datos)
    if reco is None:
        huecos.append({
            "fuente": "recomendaciones de ejecución",
            "descripcion": "SIN ANÁLISIS PROFUNDO DE LA AD LIBRARY",
            "impacto": ("El tablero no muestra recomendaciones de ejecución. No "
                        "se reutilizan las de otra corrida: la Ad Library es una "
                        "foto del día y una recomendación vieja se leería como "
                        "actual."),
            "remedio": ("Correr `python -m src.modulo1.adlibrary_profundo` sobre "
                        "el crudo de esta corrida antes de generar el tablero."),
        })

    # --- Paso 8d · formato propio: la unica fuente que distingue reel de feed ---
    # No sale de la competencia a proposito: la Ad Library devuelve OCHO campos y
    # ninguno dice si un anuncio es video o imagen (ADR-032). La pregunta
    # «¿arte o video?» solo se puede contestar con dato propio.
    fmt = FMT.arma(carpeta / "crudo", hoy)
    if fmt is None:
        huecos.append({
            "fuente": "formato propio (reel contra feed)",
            "descripcion": "SIN LECTURA DE ads_get_ig_media",
            "impacto": ("Las cartas no pueden decir si conviene arte o video con "
                        "un numero detras. La estructura sale por convencion de "
                        "la red, y se rotula asi."),
            "remedio": ("Correr ads_get_ig_accounts y ads_get_ig_media sobre la "
                        "cuenta y dejar el crudo en crudo/ig_media.json."),
        })

    # --- Paso 8e · las cartas: una por pieza, con todo junto ---
    cartas = CARTAS.arma(copys_cfg, reco, por_mercado, competencia, fmt, marca_datos)
    if cartas and cartas["sin_evidencia"]:
        # Una carta sin un solo numero vivo no se muestra como si lo tuviera, y
        # tampoco desaparece en silencio: el hueco se declara.
        huecos.append({
            "fuente": "cartas de produccion",
            "descripcion": (f"{len(cartas['sin_evidencia'])} copys quedaron sin "
                            "carta porque esta corrida no resuelve NINGUNA de sus "
                            "evidencias declaradas"),
            "impacto": "Esas piezas no se proponen. Aparecen listadas con lo que les falta.",
            "remedio": ("Revisar `porque_de` de esos copys en "
                        "config/copys_propuestos.json contra lo que la corrida si trae."),
        })

    equipo = cargar("equipo", permitir_bloqueado=True)
    estrat = E.arma(id_semana(rango), redes_para_secciones, competencia,
                    por_mercado, refs, equipo, _serializa(hallazgos),
                    {"mercados_excluidos_con_gasto": gasto_excluido})

    return {
        "corrida": {"rango": rango.etiqueta(), "hoy": hoy.isoformat(),
                    "dry_run": dry_run},
        "integridad": {
            "campanas_leidas": len(campanas),
            "paises_con_entrega": paises,
            "paises_fuera_de_mercados_declarados": fuera_de_mercado,
            "campanas_incoherentes": incoherentes,
            "mercados_excluidos_con_gasto": gasto_excluido,
        },
        "consolidados_por_indicador": consolidados,
        "consolidados_detalle": detalle_num,
        "campanas_por_indicador_principal": [
            {"etiqueta": c.etiqueta(), "pais": c.desglose_dict.get("country"),
             "resultados": c.resultados.numero, "gasto": c.gasto.numero,
             "costo_por_resultado": c.costo_por_resultado.numero,
             "impresiones": c.impresiones.numero}
            for c in campanas
            if c.utilizable and c.indicador == "actions:lead"
            and not c.costo_por_resultado.hueco],
        "por_mercado": por_mercado,
        # El desglose diario. El tablero suma sobre la ventana elegida y
        # agrupa por indicador; aqui no se pre-agrega nada mas que el control.
        "pauta_diaria": pauta_dia,
        "redes_sociales": redes_resumen,
        "competencia": competencia,
        "competencia_registro": {"categorias": registro.get("categorias", {}),
                                 "roles": registro.get("_roles", {})},
        "referencias": refs,
        "recomendaciones": reco,
        # El formato propio va aparte del bloque de redes porque no es una
        # metrica de la semana: es la respuesta a «arte o video».
        "formato_propio": fmt,
        # Las cartas: una por pieza a producir, con que hacer, de que hablar,
        # con que texto y con que imagen, todo en el mismo lugar.
        "cartas": cartas,
        "copys": ({"_registro": (copys_cfg or {}).get("_registro"),
                   "_estado_de_todos": (copys_cfg or {}).get("_estado_de_todos"),
                   "lista": copys} if copys else None),
        "estrategia": estrat,
        "hallazgos": _serializa(hallazgos),
        "verificacion_semana_anterior": verificacion,
        "plan": _serializa(plan),
        "tareas_propuestas": _serializa(tareas_propuestas(
            plan,
            {"mercados_excluidos_con_gasto": gasto_excluido},
            id_semana(rango))),
        "huecos_declarados": huecos,
    }


def imprime(r: dict) -> None:
    L = "─" * 74
    print(f"\n{'═'*74}\nMESA CREATIVA · corrida {r['corrida']['rango']}")
    if r["corrida"]["dry_run"]:
        print("MODO --dry-run · no se escribe en ningún sistema externo")
    print("═"*74)

    i = r["integridad"]
    print(f"\nINTEGRIDAD\n{L}")
    print(f"  Filas de campaña×país leídas: {i['campanas_leidas']}")
    print(f"  Países con entrega: {', '.join(i['paises_con_entrega'])}")
    if i["paises_fuera_de_mercados_declarados"]:
        print(f"  ⚠ FUERA DE MERCADOS DECLARADOS: "
              f"{', '.join(i['paises_fuera_de_mercados_declarados'])}")
    print(f"  Campañas con costo incoherente: "
          f"{i['campanas_incoherentes'] or 'ninguna'}")
    for pais, g in (i.get("mercados_excluidos_con_gasto") or {}).items():
        print(f"  ⚠ {pais} está EXCLUIDO por decisión del usuario, pero tuvo "
              f"${g['gasto']:.2f} y {g['impresiones']:,.0f} impresiones")
        print(f"      en: {', '.join(g['campanas'])}")
        print(f"      pendiente: {g['accion_pendiente']}")

    print(f"\nCONSOLIDADOS POR INDICADOR (ADR-013)\n{L}")
    for ind, desc in r["consolidados_por_indicador"].items():
        print(f"  {desc}" if "sin datos" not in desc else f"  [{ind}] {desc}")

    pm = r.get("por_mercado") or {}
    if pm:
        print(f"\nRENDIMIENTO POR MERCADO\n{L}")
        for m, d in sorted(pm.items()):
            pr = d.get("principal")
            if not pr:
                print(f"  {m}: sin datos utilizables para "
                      f"{d['indicador_principal']}")
                continue
            cpr = pr.get("costo_por_resultado")
            print(f"  {m}: {pr['resultados']:.0f} resultados · ${pr['gasto']:,.2f} · "
                  f"${cpr:.2f} por resultado · {pr['campanas']} campañas con entrega")

    rs = r.get("redes_sociales")
    print(f"\nREDES SOCIALES (orgánico)\n{L}")
    if not rs:
        print("  sin captura para este periodo")
    else:
        t = rs["totales"]
        vistas = f" · {t['vistas']:,} vistas" if t.get("vistas") is not None else ""
        print(f"  {t['interacciones']} interacciones en {t['publicaciones']} "
              f"publicaciones{vistas}")
        print(f"  contadas: {', '.join(t['redes_contadas']) or 'ninguna'}")
        if t["redes_excluidas_del_total"]:
            print(f"  ⚠ excluidas del total (dato no verificable): "
                  f"{', '.join(t['redes_excluidas_del_total'])}")
        for nombre, d in sorted(rs["detalle"].items()):
            if d["silenciosa"]:
                print(f"      {nombre:12} ⚠ 0 publicaciones · "
                      f"{d['dias_de_silencio']} días de silencio "
                      f"(última {d['ultima_publicacion']})")
        for nombre, d in sorted((rs.get("excluidas") or {}).items()):
            print(f"      {nombre:12} EXCLUIDA del reporte · "
                  f"{d['publicaciones_leidas']} publicaciones leídas")
            if d["dato_que_se_pierde"]:
                print(f"          se pierde: {d['dato_que_se_pierde'][:110]}…")
        se = rs.get("serie_semanal") or {}
        if se:
            print(f"      serie semanal: {len(se['semanas'])} semanas · "
                  f"interacciones de {', '.join(sorted(se['interacciones']))} · "
                  f"vistas de {', '.join(se['_vistas_de']) or 'ninguna'}")

    print(f"\nCOMPETENCIA\n{L}")
    for m, d in r["competencia"].items():
        if m.startswith("_"):
            continue
        dom = d["dominante"]
        cola = f" · dominante {dom}" if dom else " · sin presencia medida"
        print(f"  {m}: presión real {d['presion_total']} anuncios{cola}")
        for nombre, det in d["detalle"].items():
            if det["rol"] == "referente":
                continue
            medida = "medida" if det["presion_medida"] else "sin medir solapamiento"
            print(f"      {nombre:24} declarados {det['activos_declarados']:>4} → "
                  f"presión {det['presion_real']:>3} ({medida})")
            if det["advertencia_muestra"]:
                print(f"          ⚠ {det['advertencia_muestra']}")
        refs_m = [n for n, det in d["detalle"].items() if det["rol"] == "referente"]
        if refs_m:
            print(f"      referentes (no disputan territorio): {', '.join(refs_m)}")
        for sm in d.get("sin_medir", []):
            print(f"      ⚠ {sm['nombre']} ({sm['rol']}) NO SE MIDIÓ: "
                  f"{sm['estado']}")

    print(f"\nHALLAZGOS ({len(r['hallazgos'])})\n{L}")
    for h in r["hallazgos"]:
        print(f"\n  [{h['tipo'].upper()}] {h['titulo']}")
        print(f"    {h['afirmacion']}")
        if h.get("calculo"):
            print(f"    cálculo: {h['calculo']}")
        for e in h["evidencia"]:
            print(f"      · {e['dato']}: {e['valor']}")
            print(f"        ← {e['fuente']}")
        if h.get("advertencia"):
            print(f"    ⚠ {h['advertencia']}")

    est = r.get("estrategia") or {}
    if est and est.get("estrategias"):
        print(f"\nESTRATEGIAS CANDIDATAS ({len(est['estrategias'])})\n{L}")
        for e in est["estrategias"]:
            marca = "  ★ RECOMENDADA" if e.get("recomendada") else ""
            print(f"\n  [{e['id']}]{marca}\n  {e['nombre']}")
            print(f"    qué es: {e['en_pocas_palabras']}")
            print(f"    por qué: {e['por_que']}")
            print(f"    cuándo NO: {e['cuando_no_conviene']}")
            print(f"    tareas que activa: {', '.join(e['tareas'])}")
    if est:
        c = est["conteo"]
        print(f"\nESTRATEGIA · {c['total']} tareas "
              f"({c['creativas']} creativas, {c['de_pauta']} de pauta)\n{L}")
        for t in est["tareas"]:
            marca = " [LA APLICA UNA PERSONA]" if t["requiere_humano"] else ""
            print(f"\n  [{t['tipo'].upper()}]{marca} {t['titulo']}")
            print(f"    {t['porque']}")
            if t["no_decir"]:
                print(f"    NO decir: «{t['no_decir']}» (ocupado por competencia)")
            if t["tipo"] == "pauta":
                print(f"    instrucción: {t['instruccion_exacta'][:150]}…")
            elif t["piezas"] is None:
                print(f"    piezas: las decide la mesa — {t['piezas_motivo']}")
            else:
                print(f"    piezas: {t['piezas']} · {t['piezas_motivo']}")
        a = est["asignacion"]
        if not a["habilitada"]:
            print(f"\n  ⚠ ASIGNACIÓN A SPRINT APAGADA: {a['motivo_bloqueo']}")

    print(f"\nVERIFICACIÓN DE LA SEMANA ANTERIOR (paso 6)\n{L}")
    print(f"  {r['verificacion_semana_anterior']}")

    p = r["plan"]
    cuant = [x for x in p["recomendaciones"] if x["cantidad"]]
    sind = [x for x in p["recomendaciones"] if not x["cantidad"]]
    print(f"\nPLAN DE PRODUCCIÓN · {len(cuant)} cuantificadas, "
          f"{len(sind)} declaradas sin dato\n{L}")
    for x in cuant:
        print(f"\n  ✔ {x['titulo']}")
        print(f"    {x['accion']}")
        print(f"    CANTIDAD: {x['cantidad']['valor']:,.2f} {x['cantidad']['unidad']}")
        print(f"    cálculo: {x['cantidad']['calculo']}")
        for e in x["evidencia"]:
            print(f"      ← {e['dato']}: {e['valor']}")
        if x.get("advertencia"):
            print(f"    ⚠ {x['advertencia']}")
    for x in sind:
        print(f"\n  ○ {x['titulo']}  ·  SIN CUANTIFICAR")
        print(f"    {x['accion']}")
        print(f"    por qué: {x['no_cuantificable']}")
        print(f"    dato que falta: {x['dato_que_falta']}")

    tp = r.get("tareas_propuestas") or []
    if tp:
        print(f"\nTAREAS PROPUESTAS PARA SPRINT · {len(tp)} · NINGUNA CREADA\n{L}")
        for t in tp:
            print(f"  [{t['tipo']:13}] {t['titulo']}")
            print(f"      {t['descripcion'][:110]}")

    if r["huecos_declarados"]:
        print(f"\nHUECOS DECLARADOS\n{L}")
        for h in r["huecos_declarados"]:
            print(f"  · {h['fuente']}: {h['descripcion']}")
            if h.get("detalle"):
                print(f"    detalle: {h['detalle']}")
            print(f"    impacto: {h['impacto']}")
            if h.get("remedio"):
                print(f"    → cómo se arregla: {h['remedio']}")
    print()


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Módulo 1 · Mesa Creativa")
    ap.add_argument("--corrida", required=True, type=Path)
    ap.add_argument("--hoy", required=True)
    ap.add_argument("--desde", required=True)
    ap.add_argument("--hasta", required=True)
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args(argv)
    f = lambda s: datetime.strptime(s, "%Y-%m-%d").date()
    try:
        r = ejecuta(a.corrida, f(a.hoy), RangoFechas(f(a.desde), f(a.hasta)),
                    dry_run=a.dry_run)
    except FallaRuidosa as e:
        print(f"\nLA CORRIDA SE DETUVO\n{'─'*74}\n{e}\n", file=sys.stderr)
        return 1
    imprime(r)
    destino = a.corrida / "analisis" / "resultado.json"
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(json.dumps(r, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Resultado guardado en {destino}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
