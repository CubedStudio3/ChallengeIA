"""Calcula los ESPERADOS del filtro de pauta, aparte del tablero.

    python3 pruebas/esperado_pauta.py <dir_corrida> [salida.json]

Por qué existe: si la prueba del filtro usara la misma función que el tablero,
comprobaría que el código coincide consigo mismo. Aquí la aritmética se hace de
nuevo, a mano, sobre el desglose diario ya reconciliado (V8).

Y por qué las ventanas se DERIVAN del dato y no se escriben a mano: la versión
anterior traía agosto fijo. Al cambiar el periodo de la corrida, esas fechas
quedaron **fuera del rango disponible** y el tablero —correctamente— las
ignoró: 31 comprobaciones en rojo señalando un defecto que no existía. Una
fecha escrita a mano en una prueba caduca sola.

Las semánticas se copian a propósito (no se reinventan), porque son decisiones
del proyecto, no aritmética:
  - la inversión suma TODAS las filas con número, incluidas las que no tienen
    resultado atribuido (si no, se tira gasto real);
  - los resultados suman solo donde hay número (`Not available` es hueco);
  - las campañas se cuentan distintas por id, con resultado o sin él;
  - el costo es UNA división al final, nunca un promedio de costos diarios;
  - todo agrupado por indicador antes de sumar (ADR-013).
"""
import json
import sys
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

CORRIDA = Path(sys.argv[1])
SALIDA = Path(sys.argv[2]) if len(sys.argv) > 2 else CORRIDA / "analisis" / "esperado_filtro.json"

R = json.loads((CORRIDA / "analisis" / "resultado.json").read_text(encoding="utf-8"))
PD = R["pauta_diaria"]
PIEZAS = PD["piezas"]
TOPE = PD["rango_disponible"]

DIAS = sorted({p["f"] for p in PIEZAS})
if not DIAS:
    sys.exit("la corrida no trae pauta diaria: no hay nada que esperar")


def agrega(piezas):
    """Un bloque de esperados por indicador. Mismo corte que usa el tablero."""
    ind = defaultdict(lambda: {"gasto": 0.0, "resultados": 0.0, "impresiones": 0,
                               "gasto_sin_resultado": 0.0, "camp": set(), "dias": set()})
    for p in piezas:
        e = ind[p["k"]]
        e["gasto"] += p["g"]
        e["impresiones"] += p["i"]
        e["camp"].add(p["c"])
        e["dias"].add(p["f"])
        if p["r"] is None:
            e["gasto_sin_resultado"] += p["g"]
        else:
            e["resultados"] += p["r"]
    out = {}
    for k, e in ind.items():
        gasto = round(e["gasto"], 2)
        out[k] = {"gasto": gasto,
                  "resultados": e["resultados"],
                  "campanas": len(e["camp"]),
                  "dias": len(e["dias"]),
                  "gasto_sin_resultado": round(e["gasto_sin_resultado"], 2),
                  # Una sola división. Sin resultados no hay costo, y no es 0.
                  "costo": (gasto / e["resultados"]) if e["resultados"] else None}
    return out


def bloque(desde, hasta):
    def dentro(p):
        return desde is None or (desde <= p["f"] <= hasta)
    ps = [p for p in PIEZAS if dentro(p)]
    b = {"total": agrega(ps)}
    for m in PD.get("mercados", ["GT", "SV"]):
        b[m] = agrega([p for p in ps if p["p"] == m])
    return b


# --- Las ventanas, derivadas ---------------------------------------------
medio = DIAS[len(DIAS) // 2]
ventanas = [
    {"nombre": "todo", "desde": None, "hasta": None,
     "nota": "sin ventana propia: el periodo completo de la corrida"},
    {"nombre": "primera mitad", "desde": DIAS[0], "hasta": medio,
     "nota": "del primer dia con dato a la mitad"},
    {"nombre": "segunda mitad", "desde": medio, "hasta": DIAS[-1],
     "nota": "de la mitad al ultimo dia con dato"},
    {"nombre": "un solo dia", "desde": medio, "hasta": medio,
     "nota": "el caso de una sola fecha, que es el que rompio con el raton"},
]

# Un dia DENTRO del tope pero sin ninguna pieza: la ventana vacia legitima.
d0 = date.fromisoformat(TOPE["desde"])
d1 = date.fromisoformat(TOPE["hasta"])
hueco = None
d = d0
while d <= d1:
    if d.isoformat() not in DIAS:
        hueco = d.isoformat()
        break
    d += timedelta(days=1)
if hueco:
    ventanas.append({"nombre": "dia sin pauta (dentro del tope)",
                     "desde": hueco, "hasta": hueco,
                     "nota": "dentro del rango disponible y sin una sola pieza: "
                             "el tablero tiene que DECLARARLO vacio, no mostrar el total"})

# Y una ventana entera fuera del tope: el tablero la IGNORA a proposito, porque
# un <input type=date> dispara change en cada segmento con fechas basura.
fuera_a = (d0 - timedelta(days=90)).isoformat()
fuera_b = (d0 - timedelta(days=60)).isoformat()
ventanas.append({"nombre": "fuera del tope", "desde": fuera_a, "hasta": fuera_b,
                 "ignorada": True,
                 "nota": "fuera del rango disponible: no cambia nada Y los campos "
                         "vuelven a la ventana que de verdad esta aplicada. Aqui no "
                         "hay numeros que esperar: lo que se comprueba es que el "
                         "campo y las cifras no puedan decir cosas distintas"})

for v in ventanas:
    # Una ventana ignorada no tiene esperado numerico: la comprobacion es que
    # nada se movio. Emitir aqui los numeros del periodo completo seria afirmar
    # que la ventana se descarta entera, y lo que pasa es que se conserva la
    # anterior.
    v["esperado"] = None if v.get("ignorada") else bloque(v["desde"], v["hasta"])

salida = {"_corrida": {"periodo": R["corrida"]["rango"], "hoy": R["corrida"]["hoy"],
                       "tope": TOPE, "dias_con_dato": len(DIAS)},
          "_fuente": "pauta diaria reconciliada al centavo (V8)",
          "ventanas": ventanas}
SALIDA.parent.mkdir(parents=True, exist_ok=True)
SALIDA.write_text(json.dumps(salida, ensure_ascii=False, indent=1), encoding="utf-8")
print(f"esperados escritos en {SALIDA}")
for v in ventanas:
    L = v["esperado"]["total"].get("actions:lead") if v["esperado"] else None
    print(f"   {v['nombre']:34s} {v['desde'] or '—':>10s}..{v['hasta'] or '—':<10s} "
          + (f"{int(L['resultados'])} leads · ${L['gasto']:.2f}" if L
             else ("se ignora, nada cambia" if v.get("ignorada") else "sin pauta")))
