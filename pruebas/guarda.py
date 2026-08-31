"""Guarda una respuesta cruda de ads_library_search con sus metadatos.

El tope de 50 sin cursor de paginacion es la limitacion que gobierna todo el
reporte: si una marca tiene mas de 50 activos, lo que se lee son los 50 MAS
RECIENTES, y entonces la pregunta por los anuncios mas longevos NO se puede
responder — los viejos quedan fuera de la muestra. Se anota por marca.
"""
import json, sys
from pathlib import Path

def guarda(clave, page_id, page_name, total, ads, pais=None, extra=None):
    d = {"_metadatos": {
            "herramienta": "mcp__Meta_MCP__ads_library_search",
            "fecha_consulta": "2026-08-31",
            "parametros": {"page_ids": [page_id], "ad_active_status": "ACTIVE",
                           "limit": 50, **({"countries": [pais]} if pais else {})},
            "_alcance": ("GLOBAL: sin filtro de pais. Es lo que interesa de un "
                         "referente." if not pais else f"solo {pais}"),
            "_nota": ("La Ad Library NO acepta rango de fechas: es una foto del "
                      "2026-08-31."),
            "_muestra_completa": total <= 50,
            "_advertencia_muestra": (
                None if total <= 50 else
                f"Se leyeron 50 de {total} activos. El tope es 50 y el conector NO "
                f"expone cursor de paginacion, asi que la muestra son los 50 MAS "
                f"RECIENTES. Consecuencia directa: la pregunta por los anuncios mas "
                f"LONGEVOS no se puede responder para esta marca — los antiguos "
                f"quedan fuera por construccion."),
         },
         "estimated_total_count": total,
         "ads": ads}
    if extra: d["_metadatos"].update(extra)
    p = Path("/tmp/adlib") / f"{clave}.json"
    p.write_text(json.dumps(d, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"  {clave}: total={total} leidos={len(ads)} "
          f"{'COMPLETO' if total<=50 else 'MUESTRA'}")
