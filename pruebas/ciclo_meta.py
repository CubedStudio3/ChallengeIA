# -*- coding: utf-8 -*-
"""Sabotajes de la compuerta de leads de Meta del Ciclo del Lead.

La compuerta compara la lectura DIA POR DIA contra una lectura de NIVEL DE
CUENTA agregada por mes y pais —otro camino, no la misma suma—. Una compuerta
que nunca detuvo nada no esta probada: aqui se rompe el dato a proposito y se
comprueba que la corrida se detiene.

    PYTHONPATH=src python3 pruebas/ciclo_meta.py
"""
import json, os, shutil, subprocess, sys, tempfile

BASE = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CRUDO = os.path.join(BASE, "data", "ciclo_lead", "crudo")
Q = "meta_lead_q3.json"


def corre(dir_crudo):
    """Arma el dataset con CRUDO apuntando a otra carpeta. Devuelve (ok, salida)."""
    codigo = (
        "import sys, os; sys.path.insert(0, %r);"
        "import modulo1.ciclo_lead as m; m.CRUDO = %r;"
        "m.SALIDA = %r; m.main()" % (os.path.join(BASE, "src"), dir_crudo, dir_crudo)
    )
    r = subprocess.run([sys.executable, "-c", codigo], capture_output=True, text=True)
    return r.returncode == 0, (r.stdout + r.stderr)


def con(cambia):
    """Copia el crudo a un temporal, aplica `cambia` a las filas de Q y corre.

    `usuarios.csv` no esta en el crudo pero el extractor lo lee desde la misma
    carpeta de salida, asi que tambien viaja."""
    tmp = tempfile.mkdtemp()
    for n in os.listdir(CRUDO):
        shutil.copy(os.path.join(CRUDO, n), tmp)
    shutil.copy(os.path.join(BASE, "data", "ciclo_lead", "usuarios.csv"), tmp)
    ruta = os.path.join(tmp, Q)
    envoltura = json.load(open(ruta, encoding="utf-8"))
    filas = json.loads(envoltura["ad_entities"])
    filas = cambia(filas)
    envoltura["ad_entities"] = json.dumps(filas, ensure_ascii=False)
    json.dump(envoltura, open(ruta, "w", encoding="utf-8"), ensure_ascii=False)
    ok, salida = corre(tmp)
    shutil.rmtree(tmp)
    return ok, salida


def un_lead_menos(filas):
    for f in filas:
        if f.get("country") == "GT" and (f.get("lead") or "0") not in ("0", None):
            f["lead"] = str(int(f["lead"]) - 1)
            return filas
    raise SystemExit("el sabotaje no encontro una fila con leads")


def mueve_de_sv_a_gt(filas):
    """No cambia el total: mueve un lead de un pais al otro. La compuerta global
    no lo veria; la de mes Y pais si."""
    sv = next(f for f in filas if f.get("country") == "SV" and int(f.get("lead") or 0) > 0)
    gt = next(f for f in filas if f.get("country") == "GT" and f["date_start"] == sv["date_start"])
    sv["lead"] = str(int(sv["lead"]) - 1)
    gt["lead"] = str(int(gt.get("lead") or 0) + 1)
    return filas


def dentro_pasa_del_total(filas):
    f = next(f for f in filas if int(f.get("lead") or 0) > 0)
    f["onsite_conversion_lead_grouped"] = str(int(f["lead"]) + 1)
    return filas


def borra_un_dia(filas):
    dia = filas[0]["date_start"]
    return [f for f in filas if f["date_start"] != dia]


def solo_el_total(filas):
    """Se pierde el corte de la puerta: todos los leads pasan a 'dentro de Meta'."""
    for f in filas:
        if f.get("lead"):
            f["onsite_conversion_lead_grouped"] = f["lead"]
    return filas


SABOTAJES = [
    ("un lead menos en una fila de GT", un_lead_menos),
    ("un lead movido de SV a GT (el total no cambia)", mueve_de_sv_a_gt),
    ("'dentro de Meta' por encima del total", dentro_pasa_del_total),
    ("un dia entero borrado", borra_un_dia),
    ("el corte de las dos puertas aplanado", solo_el_total),
]


def main():
    fallos = []
    ok, salida = con(lambda filas: filas)
    if not ok:
        print("DETENIDO · el dato real no pasa sus propias compuertas:\n" + salida)
        return 1
    print("  ✓ el dato real pasa las compuertas")
    for nombre, cambia in SABOTAJES:
        ok, salida = con(cambia)
        if ok:
            fallos.append(nombre)
            print("  ✗ %s → la corrida NO se detuvo" % nombre)
        else:
            linea = next((l for l in salida.splitlines() if "DETENIDO" in l), "(sin motivo)")
            print("  ✓ %s → %s" % (nombre, linea.strip()[:110]))
    if fallos:
        print("\n%d sabotaje(s) sin detectar: %s" % (len(fallos), ", ".join(fallos)))
        return 1
    print("\n%d de %d sabotajes detenidos." % (len(SABOTAJES), len(SABOTAJES)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
