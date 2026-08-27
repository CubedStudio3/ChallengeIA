from datetime import datetime, timezone
from collections import Counter, defaultdict

# Datos crudos tal como los devolvio ads_library_search el 2026-08-27
# page_ids=["105294361957860"], ad_active_status="ACTIVE", countries=["GT"], limit=50
gt = [
 ("1072593838598010","Gestiona tu Negocio Facil",1787575851,1787586979),
 ("840771772456130","Gestiona tu Negocio Facil",1787575847,1787609369),
 ("1576308797524199","Gestiona tu Negocio Facil",1787575845,1787587501),
 ("1435069508434629","Gestiona tu Negocio Facil",1787575845,1787603012),
 ("1858160832261072","Gestiona tu Negocio Facil",1787575844,1787581628),
 ("1075774758275110","Gestiona tu Negocio Facil",1787575844,1787585855),
 ("1037694482489726","Gestiona tu Negocio Facil",1787575844,1787601170),
 ("1385128470257515","Gestiona tu Negocio Facil",1787575844,1787629564),
 ("1371547778459181","Gestiona tu Negocio Facil",1787575840,1787580409),
 ("2105443233390306","Gestiona tu Negocio Facil",1787575266,1787603434),
 ("1581834916766209","Gestiona tu Negocio Facil",1787575266,1787581167),
 ("2543011292827132","Gestiona tu Negocio Facil",1787575266,1787609863),
 ("2246610336119550","Gestiona tu Negocio Facil",1787575266,1787685430),
 ("2201400850436380","Gestiona tu Negocio Facil",1787575266,1787646316),
 ("1100897862293856","Gestiona tu Negocio Facil",1787575262,1787701268),
 ("1801997117459775","Gestiona tu Negocio Facil",1787575262,1787705609),
 ("1554289652858568","Gestiona tu Negocio Facil",1787142980,1787147702),
 ("1887802498872348","Gestiona tu Negocio Facil",1787142979,1787147390),
 ("1347303467477998","Gestiona tu Negocio Facil",1787142979,1787156341),
 ("1378385277588743","Gestiona tu Negocio Facil",1787142979,1787167928),
 ("935765245534989","Gestiona tu Negocio Facil",1787142978,1787269090),
 ("1344039471232438","{{product.name}}",1786733983,1786739195),
 ("1894860191475897","{{product.name}}",1786733982,1786739329),
 ("1399649698742047","{{product.name}}",1786733982,1786735867),
 ("1528374525185114","{{product.name}}",1786733981,1786739392),
 ("2297360684132369","{{product.name}}",1786733980,1786747926),
 ("1031637079496581","{{product.name}}",1786733979,1786739488),
 ("1562389372112505","{{product.name}}",1781727939,1781732983),
 ("1357926956250285","{{product.name}}",1781727939,1781732848),
 ("1293243899679840","Gestiona x4 (concatenado)",1779106808,1779115213),
 ("26620958677575099","Gestiona x3 (concatenado)",1779106645,1779111325),
]

HOY = datetime(2026, 8, 27, tzinfo=timezone.utc)

def d(ts): return datetime.fromtimestamp(ts, tz=timezone.utc)

print(f"TOTAL GT activos (estimated_total_count): 31  |  devueltos: {len(gt)}")
print(f"TOTAL SV activos: 0")
print()

print("=== TITULARES ===")
fam = Counter()
for _, t, _, _ in gt:
    fam["Gestiona tu Negocio Facil" if "Gestiona" in t else t] += 1
for t, n in fam.most_common():
    print(f"  {n:2d}  ({n/len(gt)*100:4.1f}%)  {t}")
print()

print("=== COHORTES DE LANZAMIENTO (por fecha de creacion) ===")
coh = defaultdict(list)
for i, t, c, s in gt:
    coh[d(c).strftime("%Y-%m-%d")].append(t)
acum = 0
for fecha in sorted(coh, reverse=True):
    ads = coh[fecha]
    dias = (HOY - datetime.strptime(fecha, "%Y-%m-%d").replace(tzinfo=timezone.utc)).days
    acum += len(ads)
    tit = Counter("Gestiona" if "Gestiona" in x else "{{product.name}}" for x in ads)
    print(f"  {fecha}  hace {dias:3d} dias  {len(ads):2d} anuncios  acum {acum:2d}/31  {dict(tit)}")
print()

print("=== ANTIGUEDAD ===")
for i, t, c, s in gt:
    pass
edades = sorted(((HOY - d(c)).days for _, _, c, _ in gt))
print(f"  Mas nuevo: {edades[0]} dias  |  Mas viejo: {edades[-1]} dias")
print(f"  Lanzados en los ultimos 10 dias: {sum(1 for e in edades if e <= 10)}/31")
print(f"  Lanzados en los ultimos 30 dias: {sum(1 for e in edades if e <= 30)}/31")
