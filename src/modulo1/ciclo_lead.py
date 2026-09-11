# -*- coding: utf-8 -*-
"""Ciclo del Lead · arma el dataset del tablero desde los cubos del CRM.

Los cubos vienen de COQL con `group by` (la agregacion SI existe en COQL: hay
que ponerle alias al COUNT). Cada cubo ya reconcilio contra una consulta
independiente antes de entrar aqui; ver docs/11-ciclo-del-lead.md.

Cero datos inventados: si una categoria no esta en el mapa, se detiene.
"""
import csv, json, os, sys, collections

BASE = os.path.join(os.path.dirname(__file__), "..", "..", "data", "ciclo_lead")
BASE = os.path.abspath(BASE)

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

# bucket -> (area, [estados])
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

RAZON = {
    "No contesta": ("Contactabilidad", "Ventas"),
    "Plan Mini - No contesta": ("Contactabilidad", "Ventas"),
    "Otra afiliación con otra empresa": ("Competencia", "Producto / Comercial"),
    "Solo quería información": ("Intención", "Mercadeo"),
    "No le es funcional": ("Fit de producto", "Producto / Comercial"),
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
    "No tiene cuenta de banco alineada al RTU": ("Dato inválido / no elegible", "Mercadeo"),
    "RTU no alineado a web/RRSS": ("Dato inválido / no elegible", "Mercadeo"),
    "No tiene página Web o RRSS": ("Dato inválido / no elegible", "Mercadeo"),
    "No tiene página Web o Redes Sociales": ("Dato inválido / no elegible", "Mercadeo"),
    "No tiene listo el negocio": ("Timing", "Mercadeo"),
    "En espera de una respuesta": ("Contactabilidad", "Ventas"),
}

ABIERTAS = {"Calificado Interesado", "Necesita validarlo con alguien más",
            "Interesado listo para pagar", "Interesado - Negociando"}


def alto(msg):
    print("DETENIDO · " + msg, file=sys.stderr)
    sys.exit(1)


def lee(nombre):
    with open(os.path.join(BASE, nombre), encoding="utf-8") as f:
        return list(csv.DictReader(f))


def canal(fuente):
    if fuente not in CANAL:
        alto("fuente sin canal en el mapa: %r" % fuente)
    return CANAL[fuente]


def main():
    leads_nc = lee("leads_no_convertidos.csv")
    leads_cal = lee("leads_calificados.csv")
    leads_sd = lee("leads_convertidos_sin_trato.csv")
    tratos = lee("tratos.csv")
    vend = lee("vendedores_redes.csv")
    standby = lee("standby_razones.csv")
    meta = json.load(open(os.path.join(BASE, "meta_mensual.json"), encoding="utf-8"))

    # --- celdas de leads: [mes, pais, canal, fuente, estado, bucket, area, calificado, n]
    celdas_lead = []
    def agrega_lead(r, calificado, estado):
        if calificado:
            bucket, area = "Calificado (llegó a Trato)", "Calificado"
        else:
            if estado not in ESTADO2BUCKET:
                alto("estado de lead sin bucket: %r" % estado)
            bucket, area = ESTADO2BUCKET[estado]
        celdas_lead.append([r["mes"], r["pais"] or "Sin país", canal(r["fuente"]),
                            r["fuente"] or "Sin fuente", estado or "Sin estado",
                            bucket, area, 1 if calificado else 0, int(r["n"])])
    for r in leads_nc:
        agrega_lead(r, False, r["estado"])
    for r in leads_sd:
        agrega_lead(r, False, r["estado"])
    for r in leads_cal:
        agrega_lead(r, True, "")

    # --- celdas de tratos: [mes, pais, canal, fuente, etapa, razon, categoria, area, n, monto]
    celdas_trato = []
    for r in tratos:
        raz = r["razon"]
        if raz:
            if raz not in RAZON:
                alto("razón de cierre sin categoría: %r" % raz)
            cat, area = RAZON[raz]
        else:
            cat, area = "", ""
        celdas_trato.append([r["mes"], r["pais"] or "Sin país", canal(r["fuente"]),
                             r["fuente"] or "Sin fuente", r["etapa"], raz, cat, area,
                             int(r["n"]), round(float(r["monto"]), 2)])

    celdas_vend = []
    for r in vend:
        raz = r["razon"]
        cat, area = RAZON[raz] if raz else ("", "")
        celdas_vend.append([r["vendedor"], r["estado_usuario"], r["pais"] or "Sin país",
                            r["etapa"], raz, cat, area, int(r["n"])])

    # --- sincronizacion Meta -> CRM y asignacion
    sinc = [[r["mes"], r["pais"], int(r["meta_leads"]), int(r["meta_pixel"]),
             int(r["crm_redes"])] for r in lee("sincronizacion.csv")]
    usuarios = {r["nombre"]: r for r in lee("usuarios.csv")}
    VIVO = set(BUCKETS[4][2])   # bucket "Vivo / en seguimiento"
    resp_mes = []
    for r in lee("responsables_mes.csv"):
        u = usuarios.get(r["nombre"])
        if u is None:
            alto("responsable sin usuario en usuarios.csv: %r" % r["nombre"])
        resp_mes.append([r["mes"], r["nombre"], u["estado_usuario"], u["rol"], int(r["n"])])
    resp_estado = []
    for r in lee("responsables_estado.csv"):
        u = usuarios[r["nombre"]]
        est = r["estado"]
        if est not in ESTADO2BUCKET:
            alto("estado sin bucket en responsables_estado: %r" % est)
        bucket, area = ESTADO2BUCKET[est]
        resp_estado.append([r["nombre"], u["estado_usuario"], u["rol"],
                            est or "Sin estado", bucket,
                            1 if est in VIVO else 0, int(r["n"])])

    celdas_sb = []
    for r in standby:
        raz = r["razon"]
        if raz not in RAZON:
            alto("razón de Stand By sin categoría: %r" % raz)
        cat, area = RAZON[raz]
        celdas_sb.append([r["pais"] or "Sin país", canal(r["fuente"]),
                          r["fuente"] or "Sin fuente", raz, cat, area, int(r["n"])])

    datos = {
        "generado": "2026-09-11",
        "periodo": {"desde": "2026-01-01", "hasta": "2026-09-11"},
        "leads": celdas_lead,
        "tratos": celdas_trato,
        "vendedores": celdas_vend,
        "standby": celdas_sb,
        "meta": meta,
        "sinc": sinc,
        "resp_mes": resp_mes,
        "resp_estado": resp_estado,
        "etapas_abiertas": sorted(ABIERTAS),
        "calidad": {
            "ganados_total": 698,
            "ganados_monto_cero": 571,
            "leads_con_campa_a_mk": 0,
            "leads_con_fb_campaign_id": 292,
            "leads_con_fb_campaign_id_convertidos": 0,
            "convertidos_sin_trato": 41,
            "mes_en_curso": "2026-09",
            "foto": "2026-09-11 13:10 GT",
            "reglas_asignacion": 6,
            "regla_gt_modificada": "2026-08-01",
            "regla_sv_modificada": "2026-08-12",
        },
    }
    sal = os.path.join(BASE, "dataset.json")
    json.dump(datos, open(sal, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))

    tot_l = sum(c[8] for c in celdas_lead)
    cal = sum(c[8] for c in celdas_lead if c[7])
    tot_t = sum(c[8] for c in celdas_trato)
    won = sum(c[8] for c in celdas_trato if c[4] == "closed won")
    lost = sum(c[8] for c in celdas_trato if c[4] == "closed lost")
    if tot_l != 4972: alto("leads %d != 4972" % tot_l)
    if cal != 948: alto("calificados %d != 948" % cal)
    if tot_t != 992: alto("tratos %d != 992" % tot_t)
    if won != 698 or lost != 179: alto("won/lost %d/%d" % (won, lost))
    rm = sum(r[4] for r in resp_mes); re_ = sum(r[6] for r in resp_estado)
    if rm != 3987 or re_ != 3987:
        alto("cubos de responsable %d / %d != 3987" % (rm, re_))
    por_persona_mes, por_persona_est = {}, {}
    for r in resp_mes: por_persona_mes[r[1]] = por_persona_mes.get(r[1], 0) + r[4]
    for r in resp_estado: por_persona_est[r[0]] = por_persona_est.get(r[0], 0) + r[6]
    if por_persona_mes != por_persona_est:
        alto("los dos cubos de responsable no cuadran por persona")
    print("dataset: %s (%d bytes)" % (sal, os.path.getsize(sal)))
    print("leads %d · calificados %d (%.1f%%) · tratos %d · ganados %d · perdidos %d"
          % (tot_l, cal, 100.0*cal/tot_l, tot_t, won, lost))
    return datos, celdas_lead, celdas_trato


if __name__ == "__main__":
    main()
