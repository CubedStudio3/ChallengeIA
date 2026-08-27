from datetime import datetime, timezone
from collections import Counter

HOY = datetime(2026, 8, 27, tzinfo=timezone.utc)
def f(ts): return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d")
def dias(ts): return (HOY - datetime.fromtimestamp(ts, tz=timezone.utc)).days

# Datos crudos de ads_library_search, 2026-08-27, ad_active_status=ACTIVE
DATOS = {
 "Paggo": {"page_id":"105294361957860","cat":["software"],"gt":31,"sv":0,"moneda":"USD",
   "titulares":{"Gestiona tu Negocio Facil":23,"{{product.name}} (placeholder)":8},
   "creacion":[1787575851,1787575266,1787142980,1786733983,1781727939,1779106808]},
 "Recurrente": {"page_id":"100735292254927","cat":["software"],"gt":6,"sv":0,"moneda":"USD",
   "titulares":{"Recibe pagos con oro digital":3,"Recibe pagos con USDT en Guatemala":3},
   "creacion":[1784922823,1784922821,1784922814,1784922812,1784922811,1784922802]},
 "GuatePOS": {"page_id":"593092353887127","cat":["hardware"],"gt":3,"sv":0,"moneda":"GTQ",
   "titulares":{"api.whatsapp.com":2,"(sin titular)":1},
   "creacion":[1786715542,1786715537,1786715527]},
 "Square": {"page_id":"1689602518029813","cat":["hardware","software"],"gt":0,"sv":None,"moneda":"GBP",
   "titulares":{"Make the smarter choice. Choose Square.":5,"Make the smarter choice. Get Square.":2,
                "Manage everything with Square":2,"Square | | |":1},
   "creacion":[1787690617,1787690570], "global":130},
}

print("="*74)
print("COMPETENCIA ACTIVA · Meta Ad Library · foto del 2026-08-27")
print("="*74)

for cat, etiqueta in [("software","SOFTWARE · pasarela de pagos, tienda en linea, gestion"),
                      ("hardware","HARDWARE · punto de venta, terminal POS")]:
    print(f"\n{'─'*74}\n{etiqueta}\n{'─'*74}")
    for n, d in DATOS.items():
        if cat not in d["cat"]: continue
        sv = "0" if d["sv"] == 0 else ("no consultado" if d["sv"] is None else d["sv"])
        extra = f"  ({d['global']} activos a nivel global)" if "global" in d else ""
        print(f"\n  {n}  ·  page_id {d['page_id']}  ·  moneda {d['moneda']}")
        print(f"    Activos en GT: {d['gt']}{extra}   |   Activos en SV: {sv}")
        nuevo, viejo = min(dias(t) for t in d["creacion"]), max(dias(t) for t in d["creacion"])
        print(f"    Antiguedad observada: {nuevo} a {viejo} dias  (creacion {f(max(d['creacion']))} a {f(min(d['creacion']))})")
        print(f"    Titulares:")
        for t, c in sorted(d["titulares"].items(), key=lambda x: -x[1]):
            pct = f"{c/d['gt']*100:.0f}%" if d["gt"] else "—"
            print(f"      {c:2d}  {pct:>4}  {t}")

print(f"\n{'='*74}\nTOTALES EN NUESTROS MERCADOS\n{'='*74}")
tg = sum(d["gt"] for d in DATOS.values())
print(f"  Guatemala:    {tg} anuncios activos entre los 4 competidores medidos")
print(f"  El Salvador:   0 anuncios activos  ← ninguno de los 4 compite ahi")
print(f"\n  Reparto en GT:")
for n, d in sorted(DATOS.items(), key=lambda x: -x[1]["gt"]):
    if d["gt"]:
        print(f"    {n:12} {d['gt']:2d}  {'█'*int(d['gt']/tg*45)} {d['gt']/tg*100:.0f}%")
