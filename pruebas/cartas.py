"""Que las cartas esten completas y que sus numeros sean VIVOS.

La prueba que de verdad importa aqui es el sabotaje 1: se cambia el costo por
lead en la corrida y la carta tiene que cambiar con el. Si no cambia, el numero
esta escrito a mano en alguna parte y va a caducar sin avisar — que es
exactamente lo que paso: un copy decia «SV cuesta $1.89 contra $2.89» mientras
la corrida decia $2.68 contra $3.35.

    PYTHONPATH=src python3 pruebas/cartas.py
"""
from __future__ import annotations

import copy as copiar
import json
import re
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, "src")
from modulo1 import cartas as C  # noqa: E402
from modulo1 import formato as F  # noqa: E402

CORRIDA = Path(sys.argv[1] if len(sys.argv) > 1
               else "data/historico/2026-09-04_25ago_a_03sep")
HOY = date(2026, 9, 4)

R = json.loads((CORRIDA / "analisis" / "resultado.json").read_text(encoding="utf-8"))
CFG = json.loads(Path("config/copys_propuestos.json").read_text(encoding="utf-8"))
FMT = F.arma(CORRIDA / "crudo", HOY)

fallos = 0


def ok(etiqueta, bien, detalle=""):
    global fallos
    if not bien:
        fallos += 1
    print(("  ok  " if bien else "  FALLA ") + etiqueta +
          (("  -> " + str(detalle)) if detalle else ""))


def arma(res=None, cfg=None):
    r = res or R
    return C.arma(cfg or CFG, r["recomendaciones"], r["por_mercado"],
                  r["competencia"], FMT, None)


print("\n== la carta esta completa ==")
out = arma()
ok("hay cartas", bool(out and out["cartas"]), (out or {}).get("conteo"))
for c in out["cartas"]:
    falta = [k for k in ("titulo", "que_hacer", "de_que_hablar", "porque",
                         "copy", "visual") if not c.get(k)]
    ok(f"{c['id']}: sin campos vacios", not falta, falta)
    ok(f"{c['id']}: titulo trae formato y solucion",
       " · " in c["titulo"] and c["solucion"] in c["titulo"], c["titulo"])
    ok(f"{c['id']}: el copy trae titular y cuerpo",
       bool(c["copy"].get("titular") and c["copy"].get("cuerpo")))
    ok(f"{c['id']}: al menos un porque con dato de la corrida",
       len(c["porque"]) >= 1, len(c["porque"]))
    ok(f"{c['id']}: trae referencia medida o la declara",
       c.get("referencia") is not None or "referencia" in str(c.get("faltantes")))
    ok(f"{c['id']}: la aprobacion queda pendiente (regla 5)",
       c["aprobacion"] == "PENDIENTE")

print("\n== ningun numero escrito a mano en el config ==")
# Un numero que parece medicion en un campo humano caduca sin avisar. Los
# campos humanos pueden decir «24 horas» (una promesa de producto) pero no
# «$2.68» ni «95%» ni «109 dias» (mediciones de una corrida).
MEDICION = re.compile(r"\$\s?\d|\d+\s?%|\b\d+\s+(?:d[ií]as|anuncios|personas|"
                      r"impresiones|interacciones|leads)\b", re.I)
HUMANOS = ("porque_marca", "como_hablarlo", "no_dice", "angulo", "para_quien",
           "titular", "cuerpo", "cta")
for c in CFG["copys"]:
    for k in HUMANOS:
        v = c.get(k) or ""
        hall = MEDICION.findall(v)
        ok(f"{c['id']}.{k} sin medicion escrita a mano", not hall, hall)
    for x in (c.get("mostrar") or []) + (c.get("no_mostrar") or []):
        ok(f"{c['id']} direccion visual sin medicion", not MEDICION.findall(x), x)

print("\n== toda evidencia declarada tiene resolvedor ==")
for c in CFG["copys"]:
    for ref in (c.get("porque_de") or []):
        ok(f"{c['id']}: resolvedor para «{ref['tipo']}»",
           ref["tipo"] in C.RESOLVEDORES)
    ok(f"{c['id']}: declara al menos una evidencia", bool(c.get("porque_de")))

print("\n== sabotajes ==")

# 1 · El numero es vivo: se mueve la corrida y la carta se mueve con ella.
r2 = copiar.deepcopy(R)
r2["por_mercado"]["SV"]["principal"]["costo_por_resultado"] = 9.99
o2 = arma(r2)
antes = [x for c in out["cartas"] for x in c["porque"] if "el lead cuesta" in x]
ahora = [x for c in o2["cartas"] for x in c["porque"] if "el lead cuesta" in x]
ok("el costo de la carta sigue a la corrida",
   any("$9.99" in x for x in ahora) and not any("$9.99" in x for x in antes),
   (antes[:1], ahora[:1]))

# 2 · Si un mercado deja de estar sin disputa, la carta lo DICE en vez de
#     seguir prometiendo un mercado libre.
r3 = copiar.deepcopy(R)
r3["competencia"]["SV"]["presion_total"] = 42
o3 = arma(r3)
ok("avisa si SV dejo de estar sin disputa",
   any(c.get("premisa_movida") for c in o3["cartas"]) and
   any("ya NO está sin disputa" in x for c in o3["cartas"] for x in c["porque"]))

# 3 · Una evidencia que no resuelve se DECLARA, no se calla.
cfg4 = copiar.deepcopy(CFG)
for c in cfg4["copys"]:
    c["porque_de"] = [{"tipo": "vertical_libre", "vertical": "vertical que no existe",
                       "_si_falta": "no medido"}]
o4 = arma(cfg=cfg4)
ok("un copy sin evidencia resoluble no sale como carta",
   o4["conteo"]["cartas"] == 0 and o4["conteo"]["sin_evidencia"] == len(CFG["copys"]),
   o4["conteo"])
ok("y aparece con lo que le falta",
   all(s["faltantes"] for s in o4["sin_evidencia"]))

# 4 · Sin el corte de formato, la estructura NO se inventa: se declara.
o5 = C.arma(CFG, R["recomendaciones"], R["por_mercado"], R["competencia"], None, None)
vids = [c for c in o5["cartas"] if c["pieza"] == "video"]
ok("sin dato de formato, el video declara que va por convencion",
   all("convención de la red" in ((c["visual"]["estructura"] or {}).get("porque") or "")
       for c in vids), len(vids))

# 5 · Los territorios ocupados llegan a la carta con el numero de la corrida.
t = (R["recomendaciones"].get("territorios_ocupados") or [{}])[0]
if t:
    esperado = f"{round((t['cuota'] or 0) * 100)}%"
    ok("el territorio ocupado cita la cuota de la corrida",
       any(esperado in x and t["de"] in x
           for c in out["cartas"] for x in c["porque"]), esperado)

# 6 · El numero de formato de la carta es el que midio el modulo, no otro. Y
#     cuando hay alcance, el que manda es el de ALCANCE: citar solo el ratio de
#     interacciones absolutas fue un error publicado el 2026-09-04, porque ese
#     ratio es casi entero un efecto de alcance disfrazado de calidad creativa.
ver = ((FMT or {}).get("alcance") or {}).get("veredicto") or {}
absoluto = ((FMT or {}).get("comparacion") or {}).get("ratio")
frases_formato = [x for c in out["cartas"] for x in c["porque"]
                  if x.startswith("En nuestra cuenta")]
if ver.get("ratio_alcance"):
    ok("con alcance, la carta cita el ratio de ALCANCE",
       any(f"{ver['ratio_alcance']}x" in x for x in frases_formato),
       ver["ratio_alcance"])
    ok("y cita las dos tasas, no solo una",
       all(("%" in x) for x in frases_formato) and bool(frases_formato))
    # La guardia contra el error corregido: el ratio absoluto NO puede salir en
    # la carta cuando hay alcance para calcular la tasa.
    ok("con alcance, la carta NO cita el ratio absoluto solo",
       not any(f"{absoluto}x" in x for x in frases_formato), absoluto)
elif absoluto:
    ok("sin alcance, la carta cita el absoluto Y dice que le falta el denominador",
       any(f"{absoluto}x" in x and "ABSOLUTAS" in x for x in frases_formato), absoluto)

# 7 · Sabotaje: si se borra el alcance, la carta tiene que CAMBIAR de frase y
#     declarar que sin denominador no hay tasa. No puede quedarse con la buena.
import copy as _c
fmt_sin = _c.deepcopy(FMT)
fmt_sin.pop("alcance", None)
o6 = C.arma(CFG, R["recomendaciones"], R["por_mercado"], R["competencia"], fmt_sin, None)
sin = [x for c in o6["cartas"] for x in c["porque"]
       if x.startswith("En nuestra cuenta")]
ok("sin alcance la carta se degrada y lo dice",
   bool(sin) and all("ABSOLUTAS" in x for x in sin) and
   not any("alcance contra" in x for x in sin))

print("\n== la carta aprobada llega a Sprints ==")
# El hueco que abrio ADR-042: la mesa aprueba CARTAS y el paso 9 solo entendia
# las tareas viejas, asi que aprobar una carta no producia nada. Se veia como un
# boton roto y era una familia de ids sin camino.
from modulo1 import sprint as S  # noqa: E402

equipo = json.loads(Path("config/equipo.json").read_text(encoding="utf-8"))
R2 = dict(R)
R2["cartas"] = out
una = out["cartas"][0]
dec = {"decisiones": {una["id"]: {"estado": "aceptada",
                                  "responsable": "21897000001319001"}}}
esc, _ = S.plan(R2, dec, equipo)
ok("una carta aceptada produce un work item", len(esc) == 1, len(esc))
if esc:
    e = esc[0]
    d = e.parametros["description"]
    ok("el work item lleva el copy completo",
       all(x in d for x in (una["copy"]["titular"], una["copy"]["cuerpo"],
                            una["copy"]["cta"])))
    ok("y la direccion visual", "QUÉ MOSTRAR" in d and "QUE NO VAYA" in d)
    ok("y la referencia medida",
       (una["referencia"] or {}).get("marca", "\0") in d)
    ok("y los porques con el numero de la corrida",
       all(x in d for x in una["porque"]))
    ok("el copy sale marcado como pendiente de aprobacion (regla 5)",
       "pendiente de aprobación" in d)
    ok("la marca de idempotencia lleva el id de semana",
       e.idempotencia.startswith("2026-W") and una["id"] in e.idempotencia,
       e.idempotencia)
# Y sin decision NO se escribe nada: la compuerta humana es el punto.
esc0, _ = S.plan(R2, {}, equipo)
ok("sin decisiones de la mesa, cero escrituras", not esc0, len(esc0))

print("\n" + (f">>> {fallos} FALLA(S)" if fallos else ">>> TODO OK"))
sys.exit(1 if fallos else 0)
