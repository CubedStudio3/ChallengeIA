# -*- coding: utf-8 -*-
"""Inyecta el dataset del Ciclo del Lead en la plantilla y escribe la pagina."""
import os
BASE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
tpl = open(os.path.join(BASE, "src/modulo1/ciclo_lead.tpl.html"), encoding="utf-8").read()
datos = open(os.path.join(BASE, "data/ciclo_lead/dataset.json"), encoding="utf-8").read()
if "</script" in datos:
    raise SystemExit("DETENIDO: el dataset contiene </script")
sal = os.path.join(BASE, "salidas/ciclo-del-lead.html")
os.makedirs(os.path.dirname(sal), exist_ok=True)
open(sal, "w", encoding="utf-8").write(tpl.replace("__DATOS__", datos))
print("%s (%.0f KB)" % (sal, os.path.getsize(sal) / 1024))
