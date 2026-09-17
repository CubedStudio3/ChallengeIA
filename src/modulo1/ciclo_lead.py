# -*- coding: utf-8 -*-
"""Ciclo del Lead · arma el dataset del tablero desde las filas crudas del CRM.

Desde el 2026-09-17 el dataset es **por dia**, no por mes: los filtros del
tablero son dos calendarios (desde / hasta) y un dato mensual no los puede
contestar. Las filas vienen de COQL paginado y se guardan tal cual en
`data/ciclo_lead/crudo/` — no hay transcripcion a mano en ningun punto.

Cada lead calificado hereda el **plan** de su Trato (`Producto`, el lookup que
en la interfaz se llama «Plan QPayPro»). El plan NO existe antes de que el lead
llegue a Trato: eso se declara, no se rellena.

Cero datos inventados: si una categoria no esta en el mapa, el script se detiene.
"""
import datetime, json, os, sys, collections

BASE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CRUDO = os.path.join(BASE, "data", "ciclo_lead", "crudo")
SALIDA = os.path.join(BASE, "data", "ciclo_lead")

CANAL = {
    "Meta Ads": "Redes sociales (Meta)",
    "Facebook Ads": "Redes sociales (Meta)",
    "Facebook Lead": "Redes sociales (Meta)",
    "Instagram DM": "Redes sociales (Meta)",
    "Página web": "Página web",
    "Chat / WhatsApp": "WhatsApp / Chat",
    "WHATSAPP - Qpaypro": "WhatsApp / Chat",
    "Cliente se comunicó": "Directo / Referidos",
    "Llamada en Frio": "Directo / Referidos",
    "Referido": "Directo / Referidos",
    "Partner": "Directo / Referidos",
    "Eventos": "Directo / Referidos",
    "": "Sin fuente",
}

BUCKETS = [
    ("Dato inválido / no elegible", "Mercadeo", [
        "SPAM", "Contacto Duplicado", "Número Incorrecto", "Sin Datos",
        "Contacto no calificado - Negocio Prohibido",
        "Contacto no Calificado - No cuenta con RTU",
        "Contacto no Calificado - No tiene RRSS o página Web",
        "no tiene NIT", "No tiene regimen", "Contacto no calificado",
        "Contacto ya es Cliente - Requiere Soporte", "PRUEBAS"]),
    ("Intención / segmentación", "Mercadeo", [
        "No les interesa (Solo quieren Información)", "Información plan FREE",
        "Información plan MINI", "piensa que damos créditos",
        "No tiene plata suficiente para invertir", "No tiene listo el negocio"]),
    ("Oferta / condiciones", "Producto / Comercial", [
        "tasa de comisión muy alta Salv",
        "No quiere aperturar cuenta en el banco atlantida",
        "Ya contactó con otra pasarela de pago", "Necesita POS físico",
        "Cuotas Banrural e Industrial", "ONGs, Asociaciones y Fundaciones"]),
    ("Contactabilidad / ejecución", "Ventas", [
        "No contesta", "No Contactado", "Contactado", "Attempted to Contact",
        "Lost Lead"]),
    ("Vivo / en seguimiento", "Abierto", [
        "En Seguimiento", "En Seguimiento ICP", "El Salvador Seguimiento",
        "Pre Calificado", "Contactar por IA", "Contact in Future", ""]),
]
ESTADO2BUCKET = {e: (b, a) for b, a, es in BUCKETS for e in es}
VIVO = set(BUCKETS[4][2])

RAZON = {
    "No contesta": ("Contactabilidad", "Ventas"),
    "Plan Mini - No contesta": ("Contactabilidad", "Ventas"),
    "En espera de una respuesta": ("Contactabilidad", "Ventas"),
    "Otra afiliación con otra empresa": ("Competencia", "Producto / Comercial"),
    "Solo quería información": ("Intención", "Mercadeo"),
    "No le es funcional": ("Fit de producto", "Producto / Comercial"),
    "Plan Mini - No me funciona": ("Fit de producto", "Producto / Comercial"),
    "Liquidación más rápida": ("Fit de producto", "Producto / Comercial"),
    "Necesitaba POS físico": ("Fit de producto", "Producto / Comercial"),
    "Necesitaba cuotas BAC y BANRURAL": ("Fit de producto", "Producto / Comercial"),
    "Problemas integración": ("Fit de producto", "Producto / Comercial"),
    "Anualidad muy alta": ("Precio", "Producto / Comercial"),
    "Mensualidad muy alta": ("Precio", "Producto / Comercial"),
    "% comisión alto": ("Precio", "Producto / Comercial"),
    "No quiere cuenta en Banco Atlántida": ("Oferta / condiciones", "Producto / Comercial"),
    "Negocio con operaciones ilegales": ("Dato inválido / no elegible", "Mercadeo"),
    "No tiene Patente": ("Dato inválido / no elegible", "Mercadeo"),
    "No tiene RTU": ("Dato inválido / no elegible", "Mercadeo"),
    "Plan Mini - No es válido": ("Dato inválido / no elegible", "Mercadeo"),
    "No tiene cuenta de banco alineada al RTU": ("Dato inválido / no elegible", "Mercadeo"),
    "RTU no alineado a web/RRSS": ("Dato inválido / no elegible", "Mercadeo"),
    "No tiene página Web o RRSS": ("Dato inválido / no elegible", "Mercadeo"),
    "No tiene página Web o Redes Sociales": ("Dato inválido / no elegible", "Mercadeo"),
    "No tiene listo el negocio": ("Timing", "Mercadeo"),
}

ABIERTAS = ["Calificado Interesado", "Necesita validarlo con alguien más",
            "Interesado listo para pagar", "Interesado - Negociando"]

# El unico plan gratuito se llama «Free»; todo lo demas que el CRM registra en
# «Plan QPayPro» es de pago. Se guarda el nombre crudo para poder abrirlo.
GRATIS = "Free"


def alto(msg):
    print("DETENIDO · " + msg, file=sys.stderr)
    sys.exit(1)


HOY = datetime.date.today().isoformat()

# Forma que `controles.json` TIENE que traer. Una llave que falta no es un
# control opcional: es una compuerta apagada, y apagada en silencio es peor que
# no tenerla. Por eso se comprueba la forma antes de usarla.
FORMA = {
    "_metadatos": ["ventana", "banda_cierre"],
    "crm": ["leads_no_convertidos", "leads_convertidos", "etapas", "canal",
            "pais", "won_por_cierre"],
    "meta": ["gasto_mes", "cuenta"],
}


def controles():
    ruta = os.path.join(CRUDO, "controles.json")
    if not os.path.exists(ruta):
        alto("falta %s: los controles se piden al CRM y a Meta en cada corrida "
             "y sin ellos las compuertas no verifican nada. La receta esta en "
             "docs/12-de-donde-sale-cada-numero.md" % ruta)
    ctl = json.load(open(ruta, encoding="utf-8"))
    for bloque, llaves in FORMA.items():
        if bloque not in ctl:
            alto("controles.json sin el bloque %r" % bloque)
        for k in llaves:
            if k not in ctl[bloque]:
                alto("controles.json sin %s.%s: esa compuerta quedaria apagada"
                     % (bloque, k))
    for k in ("etapas", "canal", "pais"):
        if not ctl["crm"][k]:
            alto("controles.json trae crm.%s vacio: un control vacio compara "
                 "contra nada" % k)
    if not ctl["meta"]["cuenta"]:
        alto("controles.json trae meta.cuenta vacio")
    return ctl


def filas(nombre):
    # La paginacion no se comprueba aqui: una pagina truncada se ve igual de
    # completa que una completa. Lo que verifica es la compuerta del final,
    # que compara el total contra un COUNT independiente del CRM.
    return json.load(open(os.path.join(CRUDO, nombre), encoding="utf-8"))["data"]["data"]


def canal(fuente):
    if fuente not in CANAL:
        alto("fuente sin canal en el mapa: %r" % fuente)
    return CANAL[fuente]


def plan_de(producto):
    if not producto:
        return "", ""
    nom = producto.get("name") or ""
    if not nom:
        return "", ""
    return ("Free" if nom == GRATIS else "Premium"), nom


def main():
    # Los controles se cargan PRIMERO: de ahi salen la ventana y la banda de
    # fechas, no solo los numeros con que se comparan. Si el archivo no esta o
    # le falta una llave, la corrida se detiene aqui y no mas adelante, con el
    # dataset a medio armar.
    ctl = controles()
    PISO_CIERRE = ctl["_metadatos"]["banda_cierre"]["desde"]
    TOPE_CIERRE = ctl["_metadatos"]["banda_cierre"]["hasta"]
    en_banda = lambda d: PISO_CIERRE <= d <= TOPE_CIERRE

    leads = filas("leads_p0.json") + filas("leads_p1.json") + filas("leads_p2.json")
    conv = filas("leads_convertidos.json")
    tratos = filas("tratos.json")

    ids = set(r["id"] for r in leads) | set(r["id"] for r in conv)
    if len(ids) != len(leads) + len(conv):
        alto("hay ids repetidos entre las paginas de leads")
    if any(r["Converted__s"] for r in leads) or any(not r["Converted__s"] for r in conv):
        alto("las dos extracciones de leads se contaminaron entre si")

    # plan por trato, para heredarlo al lead que lo origino.
    plan_trato = {}
    for t in tratos:
        plan_trato[t["id"]] = plan_de(t.get("Producto"))

    celdas_lead = []
    sin_trato = 0
    for r in leads + conv:
        fecha = r["Created_Time"][:10]
        fuente = r.get("Lead_Source") or ""
        estado = r.get("Lead_Status") or ""
        trato = (r.get("Converted_Deal") or {}).get("id")
        calif = 1 if trato else 0
        if r["Converted__s"] and not trato:
            sin_trato += 1
        if calif:
            bucket, area = "Calificado (llegó a Trato)", "Calificado"
            plan, producto = plan_trato.get(trato, ("", ""))
        else:
            if estado not in ESTADO2BUCKET:
                alto("estado de lead sin bucket: %r" % estado)
            bucket, area = ESTADO2BUCKET[estado]
            plan, producto = "", ""
        celdas_lead.append([fecha, r.get("Pa_s") or "Sin país", canal(fuente),
                            fuente or "Sin fuente", estado or "Sin estado",
                            bucket, area, calif, plan, producto, 1])

    celdas_trato = []
    for t in tratos:
        raz = t.get("Selecciones_Razones") or ""
        if raz and raz not in RAZON:
            alto("razón de cierre sin categoría: %r" % raz)
        cat, area = RAZON[raz] if raz else ("", "")
        sb = t.get("Raz_n_Stand_By") or ""
        if sb and sb not in RAZON:
            alto("razón de Stand By sin categoría: %r" % sb)
        sbcat, sbarea = RAZON[sb] if sb else ("", "")
        fuente = t.get("Lead_Source") or ""
        plan, producto = plan_de(t.get("Producto"))
        # La FECHA DE CIERRE va aparte de la de creacion: «cuantos compraron»
        # se cuenta por cierre —es el criterio de Mercadeo y el de sus informes
        # del CRM— y el resto de la seccion sigue cortando por creacion. Son dos
        # fechas distintas y no se unifican.
        celdas_trato.append([t["Created_Time"][:10], t.get("Pa_s_Operaci_n") or "Sin país",
                             canal(fuente), fuente or "Sin fuente", t.get("Stage") or "",
                             raz, cat, area, sb, sbcat, sbarea, plan, producto,
                             (t.get("Owner") or {}).get("name") or "",
                             (t.get("Owner") or {}).get("id") or "",
                             1, float(t.get("Amount") or 0), t["Closing_Date"][:10]])

    # responsable de los leads que NO llegaron a Trato
    import csv
    with open(os.path.join(SALIDA, "usuarios.csv"), encoding="utf-8") as f:
        usuarios = {r["id"]: r for r in csv.DictReader(f)}

    celdas_resp = []
    for r in leads + conv:
        if (r.get("Converted_Deal") or {}).get("id"):
            continue
        o = r.get("Owner") or {}
        u = usuarios.get(o.get("id"))
        if u is None:
            alto("responsable desconocido: %r (%r)" % (o.get("id"), o.get("name")))
        estado = r.get("Lead_Status") or ""
        bucket, area = ESTADO2BUCKET[estado]
        celdas_resp.append([r["Created_Time"][:10], u["nombre"], u["estado_usuario"],
                            u["rol"], estado or "Sin estado", bucket,
                            1 if estado in VIVO else 0, 1])

    # Meta, dia por dia. Se pide por trimestre y NO por el periodo entero: con
    # `time_increment: 1` una sola llamada devolvio exactamente 1000 filas —el
    # tope— y el resultado se ve igual de completo que uno completo. Enero y
    # febrero cuadraban al centavo y de marzo en adelante faltaba gasto.
    #
    # Y se piden los CAMPOS de lead, no el `results` de cada campaña. `results`
    # trae el resultado del indicador por el que esa campaña optimiza, asi que
    # una campaña de trafico reporta clics y sus leads quedaban invisibles: el
    # periodo entero daba 3,052 leads contra los 5,712 que Meta muestra en la
    # interfaz. `lead` los cuenta todos y `onsite_conversion_lead_grouped` es el
    # subconjunto que ocurre DENTRO de Meta (formulario instantaneo, Messenger,
    # DM de Instagram). La resta —los del sitio web, por el pixel— es la otra
    # mitad, y entra al CRM por otro canal. Verificado 2026-09-17 contra la
    # interfaz: SV 165 = 96 + 69 y GT 146 = 83 + 63.
    meta = []
    for q in ("meta_lead_q1.json", "meta_lead_q2.json", "meta_lead_q3.json"):
        trozo = json.loads(json.load(open(os.path.join(CRUDO, q),
                                          encoding="utf-8"))["ad_entities"])
        if len(trozo) >= 1000:
            alto("%s trae %d filas: esta en el tope y viene truncado" % (q, len(trozo)))
        meta += trozo
    import re

    def num(s):
        if s is None:
            return None
        limpio = re.sub(r"[^\d,.\-]", "", str(s))
        if limpio in ("", "-"):
            return None
        if "," in limpio and "." in limpio:
            limpio = limpio.replace(".", "").replace(",", ".")
        elif "," in limpio:
            limpio = limpio.replace(",", ".")
        return float(limpio)

    dia_meta = collections.defaultdict(lambda: [0.0, 0, 0])  # gasto, leads, en Meta
    for f in meta:
        pais = {"GT": "Guatemala", "SV": "El Salvador"}.get(f.get("country"), "Otro")
        k = (f["date_start"], pais)
        total = int(num(f.get("lead")) or 0)
        dentro = int(num(f.get("onsite_conversion_lead_grouped")) or 0)
        if dentro > total:
            alto("%s %s: 'en Meta' (%d) pasa del total de leads (%d); la resta "
                 "del sitio web saldria negativa" % (f["date_start"], pais, dentro, total))
        dia_meta[k][0] += num(f.get("amount_spent")) or 0.0
        dia_meta[k][1] += total
        dia_meta[k][2] += dentro
    celdas_meta = [[d, p, round(v[0], 2), v[1], v[2]] for (d, p), v in sorted(dia_meta.items())]

    # ── compresion por diccionarios de indices ───────────────────────────
    # El tablero calcula en el cliente sobre estas filas. Sin diccionarios el
    # dataset pesa 1.3 MB de texto repetido; con ellos, una fraccion. Y la
    # fecha queda como indice de un vocabulario ordenado, asi que el filtro
    # por rango es una comparacion de enteros.
    # Las fechas de CIERRE entran al vocabulario, pero ACOTADAS. Una venta
    # puede quedar cerrada con fecha posterior al ultimo dia con leads —medido:
    # un Free el 17 y un Premium Anual el 30 de septiembre— y esa fecha tiene
    # que existir o la venta se vuelve invisible. Pero tambien hay Tratos
    # creados en la ventana con cierre en 2025 o en noviembre: meterlas al
    # vocabulario estiraba el filtro de 2021 a noviembre de 2026 y el rango
    # dejaba de significar «el periodo del analisis». Se acotan a la BANDA del
    # periodo y las de fuera se declaran, no se tiran en silencio.
    # La banda vale para las DOS fechas del Trato. Al pedir la union por
    # cierre entraron Tratos creados en 2021 y 2025 —existen y cierran en
    # 2026—, y su fecha de creacion estiraba el filtro a 2021. Un Trato fuera
    # de banda en una de sus fechas queda con indice -1 en ESA fecha: sale de
    # los cortes que usan esa fecha y sigue contando en los que usan la otra.
    fechas = sorted({c[0] for c in celdas_lead}
                    | {c[0] for c in celdas_trato if en_banda(c[0])}
                    | {c[17] for c in celdas_trato if en_banda(c[17])}
                    | {c[0] for c in celdas_resp} | {c[0] for c in celdas_meta})
    ifecha = {f: i for i, f in enumerate(fechas)}
    dic = {"fecha": fechas}

    def vocab(nombre, valores):
        orden = sorted(set(valores))
        dic[nombre] = orden
        return {v: i for i, v in enumerate(orden)}

    vp = vocab("pais", [c[1] for c in celdas_lead] + [c[1] for c in celdas_trato]
               + [c[1] for c in celdas_meta])
    vc = vocab("canal", [c[2] for c in celdas_lead] + [c[2] for c in celdas_trato])
    vf = vocab("fuente", [c[3] for c in celdas_lead] + [c[3] for c in celdas_trato])
    ve = vocab("estado", [c[4] for c in celdas_lead] + [c[4] for c in celdas_resp])
    vb = vocab("bucket", [c[5] for c in celdas_lead] + [c[5] for c in celdas_resp])
    va = vocab("area", [c[6] for c in celdas_lead] + [c[7] for c in celdas_trato]
               + [c[10] for c in celdas_trato])
    vpl = vocab("plan", [c[8] for c in celdas_lead] + [c[11] for c in celdas_trato])
    vpr = vocab("producto", [c[9] for c in celdas_lead] + [c[12] for c in celdas_trato])
    vet = vocab("etapa", [c[4] for c in celdas_trato])
    vr = vocab("razon", [c[5] for c in celdas_trato] + [c[8] for c in celdas_trato])
    vca = vocab("categoria", [c[6] for c in celdas_trato] + [c[9] for c in celdas_trato])
    vv = vocab("vendedor", [c[13] for c in celdas_trato] + [c[1] for c in celdas_resp])
    vu = vocab("usuario", [c[2] for c in celdas_resp])
    vro = vocab("rol", [c[3] for c in celdas_resp])

    L = [[ifecha[c[0]], vp[c[1]], vc[c[2]], vf[c[3]], ve[c[4]], vb[c[5]], va[c[6]],
          c[7], vpl[c[8]], vpr[c[9]]] for c in celdas_lead]
    T = [[ifecha[c[0]] if en_banda(c[0]) else -1,
          vp[c[1]], vc[c[2]], vf[c[3]], vet[c[4]], vr[c[5]], vca[c[6]],
          va[c[7]], vr[c[8]], vca[c[9]], va[c[10]], vpl[c[11]], vpr[c[12]], vv[c[13]],
          round(c[16], 2),
          ifecha[c[17]] if en_banda(c[17]) else -1] for c in celdas_trato]
    R = [[ifecha[c[0]], vv[c[1]], vu[c[2]], vro[c[3]], ve[c[4]], vb[c[5]], c[6]]
         for c in celdas_resp]
    M = [[ifecha[c[0]], vp[c[1]], c[2], c[3], c[4]] for c in celdas_meta]

    datos = {
        # La fecha de la corrida se DERIVA, no se escribe. Estaba fija en
        # "2026-09-17": el dia que alguien volviera a correr esto, el tablero
        # seguiria diciendo que la foto es del 17 y estaria mintiendo sin que
        # ninguna compuerta lo note, porque no es un numero que se reconcilie.
        "generado": HOY,
        "rango": {"desde": fechas[0], "hasta": fechas[-1]},
        "dic": dic,
        "leads": L,
        "tratos": T,
        "resp": R,
        "meta": M,
        "etapas_abiertas": ABIERTAS,
        "calidad": {
            "convertidos_sin_trato": sin_trato,
            "ganados_total": sum(1 for t in celdas_trato if t[4] == "closed won"),
            "ganados_monto_cero": sum(1 for t in celdas_trato
                                      if t[4] == "closed won" and t[16] == 0),
            "tratos_sin_plan": sum(1 for t in celdas_trato if not t[11]),
            # Tratos cuya fecha de cierre cae fuera de la banda del periodo:
            # existen, el tablero no los puede situar, y se dicen en voz alta.
            "cierres_fuera": sum(1 for t in celdas_trato if not en_banda(t[17])),
            "creados_fuera": sum(1 for t in celdas_trato if not en_banda(t[0])),
            "banda_cierre": [PISO_CIERRE, TOPE_CIERRE],
            "foto": HOY,
            "reglas_asignacion": 6,
            "regla_gt_modificada": "2026-08-01",
            "regla_sv_modificada": "2026-08-12",
        },
    }
    sal = os.path.join(SALIDA, "dataset.json")
    json.dump(datos, open(sal, "w", encoding="utf-8"), ensure_ascii=False,
              separators=(",", ":"))

    # ── compuertas ───────────────────────────────────────────────────────
    #
    # Ningun numero de control vive aqui. Todos salen de `crudo/controles.json`,
    # que se pide al CRM y a Meta APARTE de la extraccion y en la MISMA corrida.
    # Antes estaban escritos en este archivo, y eso hacia imposible correr esto
    # a diario: el CRM sigue recibiendo, asi que al dia siguiente ningun numero
    # congelado coincide y la corrida se detendria todos los dias sin que nada
    # estuviera mal. Lo que verifica es que DOS caminos distintos den lo mismo:
    # el volcado de filas paginado contra la agregacion del servidor.
    #
    # Las consultas exactas estan en `docs/12-de-donde-sale-cada-numero.md`.
    VENTANA = (ctl["_metadatos"]["ventana"]["desde"],
               ctl["_metadatos"]["ventana"]["hasta"])
    C = ctl["crm"]

    n_l = len(celdas_lead)
    esperado_l = C["leads_no_convertidos"] + C["leads_convertidos"]
    if n_l != esperado_l:
        alto("leads %d != %d (COUNT del CRM: %d no convertidos + %d convertidos)"
             % (n_l, esperado_l, C["leads_no_convertidos"], C["leads_convertidos"]))

    # El archivo de Tratos cubre la UNION de dos criterios —creados en la
    # ventana, o con fecha de cierre en la banda— asi que el total del archivo
    # ya no es el de la consulta por creacion. Cada compuerta va a su subconjunto.
    en_ventana = lambda d: VENTANA[0] <= d <= VENTANA[1]
    etapas = collections.Counter(t[4] for t in celdas_trato if en_ventana(t[0]))
    if dict(etapas) != C["etapas"]:
        alto("las etapas no cuadran con el COUNT del CRM: leido %r, control %r"
             % (dict(etapas), C["etapas"]))

    if len(celdas_resp) + sum(c[7] for c in celdas_lead) != n_l:
        alto("el cubo de responsable no cubre a los leads sin Trato")

    # El corte por CANAL y por PAIS tambien contra su COUNT. Un total correcto
    # con un corte torcido no avisa: mover un lead de redes a pagina web, o de
    # SV a GT, no cambia ningun total.
    for nombre, col, clave in (("canal", 2, "canal"), ("país", 1, "pais")):
        leido = dict(collections.Counter(c[col] for c in celdas_lead))
        if leido != C[clave]:
            alto("el corte de leads por %s no cuadra con el COUNT del CRM: "
                 "leido %r, control %r" % (nombre, leido, C[clave]))

    # «Compraron» se cuenta por FECHA DE CIERRE, que es el criterio de Mercadeo
    # y el de sus informes del CRM.
    # Dos compuertas con trabajos DISTINTOS. Si las dos contaran «ganados
    # dentro de la banda», la segunda no podria dispararse nunca — y un camino
    # que nunca se ejecuta no esta probado, esta apagado.
    #   1. cuantos ganados hay en el año: contra el COUNT del CRM.
    anio = PISO_CIERRE[:4]
    won_anio = sum(1 for c in celdas_trato
                   if c[4] == "closed won" and c[17][:4] == anio)
    if won_anio != C["won_por_cierre"]:
        alto("Tratos closed won con cierre en %s: %d, control %d"
             % (anio, won_anio, C["won_por_cierre"]))
    #   2. que TODOS ellos entren en la banda. Uno fuera existe pero el tablero
    #      no lo podria mostrar con ningun filtro: seria una venta invisible.
    won_fuera = sum(1 for c in celdas_trato if c[4] == "closed won"
                    and c[17][:4] == anio and not en_banda(c[17]))
    if won_fuera:
        alto("%d Tratos ganados de %s cierran fuera de la banda %s..%s: "
             "el tablero no podria mostrarlos"
             % (won_fuera, anio, PISO_CIERRE, TOPE_CIERRE))
    won = won_anio

    # El gasto de Meta, contra la lectura MENSUAL pedida por otro camino: una
    # llamada por el periodo entero agregada por mes. Dos caminos distintos que
    # dan el mismo numero es lo que verifica; comparar una lectura consigo
    # misma, no. El mes en curso NO entra: esta a medias y cambia mientras se
    # mira, asi que el control solo trae los meses cerrados.
    por_mes = collections.Counter()
    for c in celdas_meta:
        por_mes[c[0][:7]] += c[2]
    for mes, esperado in sorted(ctl["meta"]["gasto_mes"].items()):
        if abs(por_mes[mes] - esperado) > 0.02:
            alto("gasto de Meta en %s: %.2f, control %.2f" % (mes, por_mes[mes], esperado))

    # Los leads de Meta, contra una lectura de NIVEL DE CUENTA agregada por mes
    # y pais: otro camino, no la suma de las mismas filas. Sumar campañas
    # podria duplicar un lead atribuido a dos campañas; las dos lecturas
    # coinciden exactas, asi que no lo hace.
    leido = collections.defaultdict(lambda: [0, 0])
    for c in celdas_meta:
        leido[c[0][:7] + "|" + c[1]][0] += c[3]
        leido[c[0][:7] + "|" + c[1]][1] += c[4]
    for k, (t, d) in sorted(ctl["meta"]["cuenta"].items()):
        v = leido.get(k, [0, 0])
        if v[0] != t or v[1] != d:
            alto("leads de Meta en %s: dia por dia da %d/%d y la lectura de "
                 "cuenta da %d/%d (total / dentro de Meta)" % (k, v[0], v[1], t, d))

    cal = sum(c[7] for c in celdas_lead)
    free = sum(1 for c in celdas_lead if c[8] == "Free")
    prem = sum(1 for c in celdas_lead if c[8] == "Premium")
    print("dataset: %s (%.0f KB)" % (sal, os.path.getsize(sal) / 1024))
    print("leads %d · calificados %d (%.1f%%) · free %d · premium %d · sin plan %d"
          % (n_l, cal, 100.0 * cal / n_l, free, prem, cal - free - prem))
    print("tratos %d en la ventana · ganados %d por fecha de cierre · "
          "convertidos sin Trato %d"
          % (sum(etapas.values()), won, sin_trato))
    print("rango de fechas: %s → %s" % (datos["rango"]["desde"], datos["rango"]["hasta"]))
    return datos


if __name__ == "__main__":
    main()
