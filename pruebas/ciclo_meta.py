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
QL = "leads_p0.json"
QT = "tratos.json"


def corre(dir_crudo):
    """Arma el dataset con CRUDO apuntando a otra carpeta. Devuelve (ok, salida)."""
    codigo = (
        "import sys, os; sys.path.insert(0, %r);"
        "import modulo1.ciclo_lead as m; m.CRUDO = %r;"
        "m.SALIDA = %r; m.main()" % (os.path.join(BASE, "src"), dir_crudo, dir_crudo)
    )
    r = subprocess.run([sys.executable, "-c", codigo], capture_output=True, text=True)
    return r.returncode == 0, (r.stdout + r.stderr)


def con_leads(cambia):
    """Igual que `con` pero rompiendo las filas de LEADS, para probar las
    compuertas de canal y de pais contra el COUNT del CRM."""
    tmp = tempfile.mkdtemp()
    for n in os.listdir(CRUDO):
        shutil.copy(os.path.join(CRUDO, n), tmp)
    shutil.copy(os.path.join(BASE, "data", "ciclo_lead", "usuarios.csv"), tmp)
    ruta = os.path.join(tmp, QL)
    env = json.load(open(ruta, encoding="utf-8"))
    env["data"]["data"] = cambia(env["data"]["data"])
    json.dump(env, open(ruta, "w", encoding="utf-8"), ensure_ascii=False)
    ok, salida = corre(tmp)
    shutil.rmtree(tmp)
    return ok, salida


def con_tratos(cambia):
    """Rompe las filas de TRATOS, para probar la compuerta de las ventas."""
    tmp = tempfile.mkdtemp()
    for n in os.listdir(CRUDO):
        shutil.copy(os.path.join(CRUDO, n), tmp)
    shutil.copy(os.path.join(BASE, "data", "ciclo_lead", "usuarios.csv"), tmp)
    ruta = os.path.join(tmp, QT)
    env = json.load(open(ruta, encoding="utf-8"))
    env["data"]["data"] = cambia(env["data"]["data"])
    json.dump(env, open(ruta, "w", encoding="utf-8"), ensure_ascii=False)
    ok, salida = corre(tmp)
    shutil.rmtree(tmp)
    return ok, salida


def cierre_fuera_de_2026(filas):
    """Una venta se va de año. El conteo de Tratos por creacion NO cambia:
    solo el de ventas por fecha de cierre."""
    f = next(f for f in filas if f["Stage"] == "closed won"
             and f["Closing_Date"][:4] == "2026")
    f["Closing_Date"] = "2027-03-15"
    return filas


def venta_a_noviembre(filas):
    """Una venta de 2026 se mueve FUERA de la banda del periodo: sigue siendo
    de 2026, asi que el conteo anual no la pierde, pero el tablero no podria
    situarla en ninguna ventana."""
    f = next(f for f in filas if f["Stage"] == "closed won"
             and f["Closing_Date"][:4] == "2026")
    f["Closing_Date"] = "2026-11-20"
    return filas


def sin_controles(tmp):
    """Se borra el archivo de controles. Una compuerta sin control no verifica
    nada, asi que la corrida NO puede seguir como si nada."""
    os.remove(os.path.join(tmp, "controles.json"))


def control_incompleto(tmp):
    """Se quita UNA llave. Es el caso peligroso: el archivo esta, se lee, y esa
    compuerta queda apagada en silencio."""
    ruta = os.path.join(tmp, "controles.json")
    ctl = json.load(open(ruta, encoding="utf-8"))
    del ctl["crm"]["canal"]
    json.dump(ctl, open(ruta, "w", encoding="utf-8"), ensure_ascii=False)


def control_vacio(tmp):
    """El bloque esta pero viene vacio. Es el caso mas silencioso de todos:
    comparar contra {} no compara nada y el archivo se ve completo."""
    ruta = os.path.join(tmp, "controles.json")
    ctl = json.load(open(ruta, encoding="utf-8"))
    ctl["crm"]["pais"] = {}
    json.dump(ctl, open(ruta, "w", encoding="utf-8"), ensure_ascii=False)


def con_archivos(toca):
    """Copia todo el crudo y deja que `toca` manipule la carpeta entera."""
    tmp = tempfile.mkdtemp()
    for n in os.listdir(CRUDO):
        shutil.copy(os.path.join(CRUDO, n), tmp)
    shutil.copy(os.path.join(BASE, "data", "ciclo_lead", "usuarios.csv"), tmp)
    toca(tmp)
    ok, salida = corre(tmp)
    shutil.rmtree(tmp)
    return ok, salida


def canal_movido(filas):
    """Un lead de redes pasa a pagina web. El TOTAL no cambia: solo el corte."""
    f = next(f for f in filas if f.get("Lead_Source") == "Meta Ads")
    f["Lead_Source"] = "Página web"
    return filas


def pais_movido(filas):
    """Un lead de SV pasa a GT. El total no cambia; el corte por pais si."""
    f = next(f for f in filas if (f.get("Pa_s") or "") == "El Salvador")
    f["Pa_s"] = "Guatemala"
    return filas


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
    for nombre, cambia in [("un lead de redes movido a página web", canal_movido),
                           ("un lead de SV movido a GT", pais_movido)]:
        ok, salida = con_leads(cambia)
        if ok:
            fallos.append(nombre)
            print("  ✗ %s → la corrida NO se detuvo" % nombre)
        else:
            linea = next((l for l in salida.splitlines() if "DETENIDO" in l), "(sin motivo)")
            print("  ✓ %s → %s" % (nombre, linea.strip()[:110]))

    for nombre, cambia in [("una venta con fecha de cierre movida a 2027", cierre_fuera_de_2026),
                           ("una venta de 2026 movida a noviembre, fuera de la banda",
                            venta_a_noviembre)]:
        ok, salida = con_tratos(cambia)
        if ok:
            fallos.append(nombre)
            print("  ✗ %s → la corrida NO se detuvo" % nombre)
        else:
            linea = next((l for l in salida.splitlines() if "DETENIDO" in l), "(sin motivo)")
            print("  ✓ %s → %s" % (nombre, linea.strip()[:110]))
    for nombre, toca in [("el archivo de controles borrado", sin_controles),
                         ("una llave del control quitada", control_incompleto),
                         ("un bloque del control vacío", control_vacio)]:
        ok, salida = con_archivos(toca)
        if ok:
            fallos.append(nombre)
            print("  ✗ %s → la corrida NO se detuvo" % nombre)
        else:
            linea = next((l for l in salida.splitlines() if "DETENIDO" in l), "(sin motivo)")
            print("  ✓ %s → %s" % (nombre, linea.strip()[:110]))

    total = len(SABOTAJES) + 7
    if fallos:
        print("\n%d sabotaje(s) sin detectar: %s" % (len(fallos), ", ".join(fallos)))
        return 1
    print("\n%d de %d sabotajes detenidos." % (total, total))
    return 0


if __name__ == "__main__":
    sys.exit(main())
