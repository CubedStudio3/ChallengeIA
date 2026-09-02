import json, tempfile, shutil
from pathlib import Path
from modulo1 import pauta_diaria as PD
from base.errores import FallaRuidosa

CRUDO = Path("data/historico/2026-08-27_V0_convencion_fechas/crudo")

print("═══ 1 · el caso real: ¿cuadra? ═══")
r = PD.arma(CRUDO, "2026-08-01", "2026-08-24",
            declarados=["GT","SV"], excluidos={"HN":{"motivo":"instruccion del usuario"}})
inf = r["reconciliacion"]
print("  campañas comparadas:", inf["campanas"], "· valores:", inf["valores_comparados"])
for f in inf["comparadas"]:
    if f["gasto"]["agregado"] == 0: continue
    print("   %-30s %-3s gasto %8.2f/%8.2f  res %6s/%-6s  imp %8s/%-8s  %s" % (
        f["nombre"][:30], f["pais"], f["gasto"]["dias"], f["gasto"]["agregado"],
        f["resultados"]["dias"], f["resultados"]["agregado"],
        f["impresiones"]["dias"], f["impresiones"]["agregado"],
        "ok" if f["cuadra"] else "DESCUADRA"))
print("  filas emitidas:", len(r["piezas"]), "· dias con dato:", r["dias_con_dato"],
      "·", r["primer_dia"], "->", r["ultimo_dia"])
print("  filas con hueco en r:", sum(1 for p in r['piezas'] if p['r'] is None))
print("  indicadores presentes:", sorted({p['k'] for p in r['piezas']}))
print("  mercados en piezas   :", r["mercados"])
print("  fuera de mercado     :", json.dumps(r["fuera_de_mercado"], ensure_ascii=False))
tot = {}
for p in r["piezas"]:
    e = tot.setdefault(p["k"], {"g":0.0,"r":0})
    e["g"] += p["g"]; e["r"] += (p["r"] or 0)
print("  por indicador (GT+SV):")
for k,v in sorted(tot.items()):
    print("     %-30s gasto %8.2f · resultados %6d" % (k[:30], v["g"], v["r"]))

def con_sabotaje(fn, etiqueta):
    tmp = Path(tempfile.mkdtemp())
    for n in (PD.ARCHIVO_DIA, PD.ARCHIVO_AGREGADO):
        shutil.copy(CRUDO/n, tmp/n)
    d = json.loads((tmp/PD.ARCHIVO_DIA).read_text(encoding="utf-8"))
    fn(d)
    (tmp/PD.ARCHIVO_DIA).write_text(json.dumps(d, ensure_ascii=False), encoding="utf-8")
    try:
        PD.arma(tmp, "2026-08-01", "2026-08-24",
                declarados=["GT","SV"], excluidos={"HN":{"motivo":"x"}})
        print("  FALLA: %s NO fue detectado" % etiqueta); return False
    except FallaRuidosa as e:
        que = ([x.get("descuadra_en") for x in e.contexto.get("descuadres",[])]
               or e.contexto.get("ausentes_con_gasto") or e.contexto or "?")
        print("  ok  detecta %-34s -> %s" % (etiqueta, json.dumps(que, ensure_ascii=False)[:66]))
        return True
    finally:
        shutil.rmtree(tmp)

print("\n═══ 2 · sabotajes: la compuerta debe romper ═══")
def un_centavo(d):
    for f in d["ad_entities"]:
        if f["id"]=="120249908467400783" and f["date_start"]=="2026-08-16":
            f["amount_spent"]="$41,94 USD"; return
def un_resultado(d):
    for f in d["ad_entities"]:
        if (f["id"]=="120249959697280783" and f["date_start"]=="2026-08-13"
                and f.get("country")=="SV"):
            f["results"]={"indicator":"actions:lead","values":[{"attribution_windows":["default"],"value":"16"}]}; return
def borra_dia(d):
    d["ad_entities"]=[f for f in d["ad_entities"]
        if not (f["id"]=="120238382458610783" and f["date_start"]=="2026-08-17")]
def borra_campana(d):
    d["ad_entities"]=[f for f in d["ad_entities"] if f["id"]!="120245898463250783"]
def tapa_resultado(d):
    for f in d["ad_entities"]:
        if f["id"]=="120245898463250783" and f["date_start"]=="2026-08-03":
            f["results"]={"indicator":"actions:lead","value":"Not available"}; return
def sin_fecha(d):
    for f in d["ad_entities"]:
        if f["id"]=="120249292740850783" and f["date_start"]=="2026-08-05":
            del f["date_start"]; return
def cambia_pais(d):
    # Mover gasto de un pais a otro: los totales globales cuadrarian, pero la
    # llave campaña+pais no. Es el sabotaje que una reconciliacion por campaña
    # sola NO detectaria.
    for f in d["ad_entities"]:
        if (f["id"]=="120249959697280783" and f["date_start"]=="2026-08-16"
                and f.get("country")=="SV"):
            f["country"]="GT"; return
def dia_de_otro_mes(d):
    for f in d["ad_entities"]:
        if f["id"]=="120249292740850783" and f["date_start"]=="2026-08-05":
            f["date_start"]="2026-09-05"; return

ok = all([
  con_sabotaje(un_centavo,      "un centavo de menos"),
  con_sabotaje(un_resultado,    "un resultado de mas"),
  con_sabotaje(borra_dia,       "un dia borrado"),
  con_sabotaje(borra_campana,   "una campaña con gasto ausente"),
  con_sabotaje(tapa_resultado,  "un resultado tapado como Not available"),
  con_sabotaje(sin_fecha,       "una fila sin date_start"),
  con_sabotaje(dia_de_otro_mes, "un dia fuera del periodo"),
  con_sabotaje(cambia_pais,     "gasto movido de SV a GT"),
])
print("\n" + ("TODOS los sabotajes detectados" if ok else ">>> ALGUNO PASO <<<"))
