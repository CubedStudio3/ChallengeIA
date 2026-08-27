# V0 · Test de la convencion de fechas
# Interfaz de Meta Ads Manager vs API, mismo rango: 1-24 ago 2026

INTERFAZ = {  # capturado por el usuario de la interfaz, 2026-08-27
 "Campana Punto de Venta GT":     (158,   2.10, 331.66, 57334),
 "Plan Free Trafico 2026":        (10771, 0.01, 104.03, 476959),
 "Campana Punto de Venta SV":     (105,   1.90, 199.29, 46332),
}
API = {  # ads_get_ad_entities, time_range 2026-08-01 a 2026-08-24, level=campaign
 "Campana Punto de Venta GT":     (158,   2.10, 331.66, 57334),
 "Plan Free Trafico 2026":        (10771, 0.01, 104.03, 476959),
 "Campana Punto de Venta SV":     (105,   1.90, 199.29, 46332),
}

print("="*78)
print("V0 · TEST DE LA CONVENCION DE FECHAS")
print("Rango fijo: 2026-08-01 a 2026-08-24 · level=campaign")
print("="*78)
campos = ["resultados", "costo_por_resultado", "gasto", "impresiones"]
fallos = 0
for c in INTERFAZ:
    print(f"\n  {c}")
    for i, campo in enumerate(campos):
        a, b = INTERFAZ[c][i], API[c][i]
        ok = a == b
        if not ok: fallos += 1
        print(f"    {campo:22} interfaz {a:>10}  |  API {b:>10}  ->  {'IDENTICO' if ok else 'DIFIERE'}")
print(f"\n{'='*78}")
print(f"RESULTADO: {len(INTERFAZ)*4 - fallos}/{len(INTERFAZ)*4} valores identicos.")
print("VEREDICTO: la convencion de fechas queda VERIFICADA." if fallos==0 else "VEREDICTO: FALLA, iterar.")
print("="*78)

print("\n\nINDICADOR DE 'results' POR CAMPANA (lo que la API declara medir)")
print("-"*78)
IND = [
 ("Campana Qpaypro Guatemala Nueva",       "actions:lead",              "95",  4.01, 380.68),
 ("Campana Punto de Venta GT",             "actions:lead",              "158", 2.10, 331.66),
 ("Campana Punto de Venta SV",             "actions:lead",              "105", 1.90, 199.29),
 ("Plan Free Trafico 2026",                "actions:link_click",        "10771", 0.01, 104.03),
 ("Campana Qpayshop e Integraciones",      "actions:lead",              "12",  4.43, 53.15),
 ("SV | POS Fisico | Leads Directos - Copia","...fb_pixel_custom.QualifiedLead","1", 3.23, 3.23),
 ("Qpaypro GT 2026 | Leads Consolidado CBO","actions:lead",             "Not available", None, 0.00),
 ("Plan Free GT | CompleteRegistration",   "...complete_registration",  "Not available", None, 0.00),
 ("Campana Qpaypro GT 2026 - Copia",       "mixed",                     "Not available", None, 0.00),
 ("Nuevo qpaypro 2026 Jun",                "mixed",                     "Not available", None, 0.00),
]
for n, ind, val, cpr, gasto in IND:
    cpr_s = f"${cpr:.2f}" if cpr else "  —  "
    print(f"  {n[:40]:40} {ind[:34]:34} {val:>13} {cpr_s:>7}")

print("\n" + "-"*78)
print("CONSECUENCIA CRITICA PARA EL MODULO 1")
print("-"*78)
print("""  El campo 'results' NO es una metrica comun: su indicador cambia por campana.
  158 leads + 10771 clics en enlace NO se pueden sumar. Tampoco promediar sus
  costos por resultado. El modulo debe AGRUPAR POR INDICADOR antes de comparar
  o agregar cualquier cosa, y declarar 'mixed' y 'Not available' como huecos.""")

print("\n" + "-"*78)
print("COMPARABLE: solo campanas con indicador actions:lead y gasto > 0")
print("-"*78)
leads = [(n,v,c,g) for n,i,v,c,g in IND if i=="actions:lead" and g>0 and v!="Not available"]
for n,v,c,g in sorted(leads, key=lambda x:-x[2]):
    print(f"  ${c:5.2f} CPL   {int(v):4d} leads   ${g:7.2f} gastado   {n}")
tot_l, tot_g = sum(int(v) for _,v,_,g in leads), sum(g for _,_,_,g in leads)
print(f"\n  Consolidado real (solo actions:lead): {tot_l} leads · ${tot_g:.2f} · CPL ${tot_g/tot_l:.2f}")
peor, mejor = max(leads,key=lambda x:x[2]), min(leads,key=lambda x:x[2])
print(f"  Mas caro: {peor[0][:38]} a ${peor[2]:.2f}")
print(f"  Mas barato: {mejor[0][:38]} a ${mejor[2]:.2f}")
print(f"  Brecha: {peor[2]/mejor[2]:.2f}x")
