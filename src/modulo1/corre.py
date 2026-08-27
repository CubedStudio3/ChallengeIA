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

from base.convenciones import RangoFechas, cargar
from base.errores import FallaRuidosa
from base.normaliza import (agrupa_por_indicador, consolida, filtra_desglose,
                            normaliza_campanas, valores_de_desglose)
from . import analiza as A
from .competencia import PanoramaCompetitivo, normaliza_adlibrary
from .plan import arma_plan

MERCADOS_DECLARADOS = ("GT", "SV")


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


def carga_competencia(crudo: Path, registro: dict, mercado: str) -> PanoramaCompetitivo:
    """Arma el panorama de un mercado a partir de los fixtures de Ad Library."""
    comps = []
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
        comps.append(normaliza_adlibrary(
            datos, nombre=entrada["nombre"], page_id=entrada["page_id"],
            categorias=entrada.get("categorias", []), mercado=mercado,
            solapamiento=solap, origen=archivo.name))
    return PanoramaCompetitivo(mercado=mercado, competidores=comps)


def ejecuta(carpeta: Path, hoy: date, rango: RangoFechas, *, dry_run: bool) -> dict:
    crudo = carpeta / "crudo"
    if not crudo.exists():
        raise FallaRuidosa(f"No existe {crudo}", remedio="Ejecutar la adquisición primero.")

    # --- Paso 2 · rendimiento de pauta, con desglose por país ---
    archivo_pauta = "meta_campanas_por_pais.json"
    bruto = json.loads((crudo / archivo_pauta).read_text(encoding="utf-8"))
    campanas = normaliza_campanas(bruto["ad_entities"], origen=archivo_pauta)
    fuente_pauta = f"{archivo_pauta} · {rango.etiqueta()}"

    incoherentes = [c.etiqueta() for c in campanas if c.coherente() is False]
    paises = valores_de_desglose(campanas, "country")
    fuera_de_mercado = [p for p in paises if p not in MERCADOS_DECLARADOS]

    # --- Paso 3 · competencia ---
    registro = cargar("competidores")
    panoramas = {m: carga_competencia(crudo, registro, m) for m in MERCADOS_DECLARADOS}

    # --- Paso 4 · orgánico: no viene por API ---
    organico = crudo / "organico.json"
    huecos = []
    if not organico.exists():
        huecos.append({
            "fuente": "métricas orgánicas de Página e Instagram",
            "descripcion": "No hay captura manual para este periodo.",
            "impacto": ("La corrida procede solo con datos de pauta y competencia. "
                        "Ninguna recomendación cita orgánico (ADR-002)."),
        })

    # --- Paso 5 · hallazgos, por indicador ---
    grupos = agrupa_por_indicador(campanas)
    consolidados, hallazgos = {}, []
    for indicador, grupo in sorted(grupos.items()):
        try:
            consolidados[indicador] = consolida(grupo).descripcion()
        except FallaRuidosa as e:
            consolidados[indicador] = f"sin datos utilizables: {e.args[0]}"
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

    return {
        "corrida": {"rango": rango.etiqueta(), "hoy": hoy.isoformat(),
                    "dry_run": dry_run},
        "integridad": {
            "campanas_leidas": len(campanas),
            "paises_con_entrega": paises,
            "paises_fuera_de_mercados_declarados": fuera_de_mercado,
            "campanas_incoherentes": incoherentes,
        },
        "consolidados_por_indicador": consolidados,
        "competencia": {
            m: {"presion_total": p.presion_total,
                "dominante": p.dominante().nombre if p.dominante() else None,
                "detalle": {c.nombre: {
                    "activos_declarados": c.total_activos,
                    "presion_real": c.presion_real,
                    "presion_medida": c.presion_es_medida,
                    "advertencia_muestra": c.advertencia_de_muestra} for c in p.competidores}}
            for m, p in panoramas.items()},
        "hallazgos": _serializa(hallazgos),
        "verificacion_semana_anterior": verificacion,
        "plan": _serializa(plan),
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

    print(f"\nCONSOLIDADOS POR INDICADOR (ADR-013)\n{L}")
    for ind, desc in r["consolidados_por_indicador"].items():
        print(f"  {desc}" if "sin datos" not in desc else f"  [{ind}] {desc}")

    print(f"\nCOMPETENCIA\n{L}")
    for m, d in r["competencia"].items():
        dom = d["dominante"]
        cola = f" · dominante {dom}" if dom else " · sin presencia medida"
        print(f"  {m}: presión real {d['presion_total']} anuncios{cola}")
        for nombre, det in d["detalle"].items():
            medida = "medida" if det["presion_medida"] else "sin medir solapamiento"
            print(f"      {nombre:24} declarados {det['activos_declarados']:>4} → "
                  f"presión {det['presion_real']:>3} ({medida})")
            if det["advertencia_muestra"]:
                print(f"          ⚠ {det['advertencia_muestra']}")

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

    if r["huecos_declarados"]:
        print(f"\nHUECOS DECLARADOS\n{L}")
        for h in r["huecos_declarados"]:
            print(f"  · {h['fuente']}: {h['descripcion']}")
            print(f"    impacto: {h['impacto']}")
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
