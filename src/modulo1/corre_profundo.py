"""Arranque del analisis profundo de la Ad Library.

`adlibrary_profundo` es biblioteca: no trae `main()`. Este es el puente entre
el crudo en disco y las tuplas que la biblioteca espera.

    python3 src/modulo1/corre_profundo.py <dir_corrida> <hoy> <desde> <hasta>

Una marca con `page_id` pero SIN archivo crudo se salta con registro, no en
silencio: un `continue` callado la hacia desaparecer del reporte en vez de
salir como no medida (trampa registrada en CLAUDE.md).
"""
import json, sys
from datetime import date
from pathlib import Path
sys.path.insert(0, "src")
from modulo1 import adlibrary_profundo as AP

CORRIDA = Path(sys.argv[1]); HOY = date.fromisoformat(sys.argv[2])
reg = json.loads(Path("config/competidores.json").read_text(encoding="utf-8"))
crudo = CORRIDA / "crudo"

marcas = []
saltadas = []   # nunca en silencio: un hueco no declarado es peor que un cero
for e in reg["competidores"]:
    clave = e["_clave_archivo"]
    for mercado in ("GT", "SV"):
        f = crudo / f"adlibrary_{clave}_{mercado}.json"
        if not f.exists():
            saltadas.append({"marca": e["nombre"], "mercado": mercado,
                             "motivo": "sin archivo crudo en esta corrida"})
            continue
        j = json.loads(f.read_text(encoding="utf-8"))
        crudos = j.get("ads") or []
        if not crudos:
            # Cero anuncios es un dato, no un hueco: se declara aparte para no
            # confundir "no anuncia aqui" con "no se midio".
            saltadas.append({"marca": e["nombre"], "mercado": mercado,
                             "motivo": "leida, cero anuncios activos"})
            continue
        # El modulo trabaja con tuplas (id, titular, creacion, entrega): la
        # conversion es el paso que faltaba entre el crudo y la biblioteca.
        ads = [(a["id"], a.get("ad_creative_link_title") or "",
                a.get("ad_creation_time"),
                a.get("ad_delivery_start_time") or a.get("ad_creation_time"))
               for a in crudos]
        p = AP.perfil(clave=clave, pagina=e.get("page_name_confirmado") or e["nombre"],
                      page_id=e["page_id"],
                      moneda=(crudos[0].get("currency") or "USD"),
                      total=j.get("estimated_total_count", len(ads)),
                      ads=ads, hoy=HOY, pais=mercado)
        p["marca"] = e["nombre"]
        p["rol"] = e.get("_rol", "competidor")
        p["mercado"] = mercado
        p["idioma"] = (reg.get("idioma_por_marca") or {}).get(clave, "es")
        marcas.append(p)

salida = {"_corrida": {"periodo": f"{sys.argv[3]} a {sys.argv[4]}",
                       "fecha_consulta": HOY.isoformat(),
                       "_fuente": "mcp__Meta_MCP__ads_library_search",
                       "_limite": ("La Ad Library no publica rendimiento de "
                         "anunciantes comerciales: no hay impresiones, ni gasto, "
                         "ni conversiones. Lo medible es cuanto repiten y que no "
                         "retiran.")},
          "marcas": marcas, "sin_perfil": saltadas,
          "no_respondible": AP.NO_RESPONDIBLE}
out = CORRIDA / "analisis" / "adlibrary_profundo.json"
out.write_text(json.dumps(salida, ensure_ascii=False, indent=1), encoding="utf-8")
print(f"profundo escrito: {len(marcas)} perfiles de marca x mercado")
for x in saltadas:
    print(f"   sin perfil: {x['marca']:20s} {x['mercado']}  {x['motivo']}")
for m in marcas:
    print(f"   {m['marca']:24s} {m['mercado']}  leidos {m['leidos']:3d} de {m['activos_declarados']:4d}")
