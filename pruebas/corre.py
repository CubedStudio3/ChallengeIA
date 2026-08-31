import sys, json
from datetime import date
sys.path.insert(0, '/tmp/adlib')
sys.path.insert(0, 'src')
from modulo1.adlibrary_profundo import perfil, NO_RESPONDIBLE

HOY = date(2026, 8, 31)
MARCAS = [
    ("paggo",      "competidor", ["software"]),
    ("recurrente", "competidor", ["software"]),
    ("guatepos",   "competidor", ["hardware"]),
    ("bi",         "competidor", ["software"]),
    ("shopify",    "referente",  ["software"]),
    ("square_us",  "referente",  ["software", "hardware"]),
    ("square_uk",  "referente",  ["software", "hardware"]),
]
perfiles = []
for clave, rol, cats in MARCAS:
    m = __import__(clave)
    p = perfil(clave, m.PAGINA, m.PAGE_ID, m.MONEDA, m.TOTAL, m.ADS, HOY,
               getattr(m, "PAIS", None))
    p["rol"] = rol
    p["categorias"] = cats
    perfiles.append(p)

out = {
    "_corrida": {"fecha_consulta": "2026-08-31", "hoy": HOY.isoformat(),
                 "herramienta": "mcp__Meta_MCP__ads_library_search",
                 "_nota_fechas": ("La Ad Library NO acepta rango de fechas. Todo "
                                  "esto es una foto del 2026-08-31.")},
    "marcas": perfiles,
    "no_respondible": NO_RESPONDIBLE,
}
import os
os.makedirs("data/historico/2026-08-27_V0_convencion_fechas/analisis", exist_ok=True)
open("data/historico/2026-08-27_V0_convencion_fechas/analisis/adlibrary_profundo.json",
     "w", encoding="utf-8").write(json.dumps(out, indent=1, ensure_ascii=False))

for p in perfiles:
    print(f"\n{'='*70}\n{p['pagina']}  ({p['rol']}, {p['pais_consultado']}, {p['moneda']})")
    print(f"  activos={p['activos_declarados']} leidos={p['leidos']} "
          f"{'COMPLETO' if p['muestra_completa'] else 'MUESTRA'}")
    e = p['estructura']
    print(f"  estructura: {e['tarjeta_unica']} tarjeta unica · {e['carrusel']} carrusel"
          f" · {e['sin_titular']} sin titular · max {e['tarjetas_max']} tarjetas")
    c = p['cobranding']
    print(f"  co-branding: {c['anuncios_con_tercero']} ({c['cuota']*100:.0f}%) "
          f"terceros={c['terceros_nombrados'][:4]}")
    print(f"  concentracion del mensaje top: {(p['concentracion'] or 0)*100:.0f}%")
    for m in p['mensajes'][:4]:
        print(f"     {m['creativos']:3} creativos ({m['cuota']*100:4.0f}%) "
              f"{m['dias_vivo_max']:3}d vivo · {m['mensaje'][:58]}")
    print(f"  audiencia: {[(a['vertical'], a['anuncios']) for a in p['audiencia_inferida'][:4]]}")
    v = p['velocidad']
    print(f"  velocidad: {v['creativos_por_semana']}/sem · span {v['span_dias']}d · "
          f"{v['dias_de_actividad']} dias activos · ultima hace {v['dias_desde_la_ultima']}d")
    print(f"     rafagas: {len(v['rafagas'])} · {v['creativos_en_rafaga']} creativos "
          f"({v['cuota_en_rafaga']*100:.0f}%) subidos en lote")
    L = p['longevidad']
    if L['_respondible']:
        print(f"  longevidad: mediana {L['dias_vivo_mediana']}d · top: "
              f"{L['top'][0]['dias_vivo']}d ({L['top'][0]['mensaje'][:40]})")
    else:
        print(f"  longevidad: NO RESPONDIBLE (muestra recortada)")
