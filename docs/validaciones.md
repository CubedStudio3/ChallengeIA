# Validaciones · resultado de la Fase 0

Este archivo es el registro oficial de las verificaciones de la Fase 0. Cada
entrada debe incluir **fecha, método, llamada exacta y salida obtenida**.

**Estado global: 2 de 7 verificaciones ejecutadas y APROBADAS.**

> **Regla de este archivo.** Nada se anota aquí sin una llamada real y su salida.
> Una conclusión sin evidencia registrada no cuenta como validación. Las
> observaciones obtenidas por otros medios (inventario de herramientas, lectura
> de esquemas) van en la sección de hallazgos preliminares, claramente separadas.

---

## Tablero de estado

| # | Verificación | Estado | Fecha | Resultado |
|---|---|---|---|---|
| V0 | Convención de fechas | ✅ **APROBADA** | 2026-08-27 | 12/12 valores idénticos interfaz vs API |
| V1 | ToS de Lead Generation | ⬜ pendiente del usuario | — | Método cambiado: se verifica en Business Manager, sin escritura (ADR-012) |
| V2 | CRM registra origen de campaña | ⬜ **ejecutable** al habilitar el conector | — | Corregido: el CRM está instalado, solo apagado en la sesión |
| V3 | Sprint expone adjuntos | ⬜ no ejecutada | — | preliminar: negativo |
| V4 | Origen de los leads diarios | ⬜ pendiente | — | Candidatos ahora disponibles: CRM, Analytics, Books |
| V5 | Premisa competitiva | ✅ **APROBADA** | 2026-08-27 | Corregida: 31 en GT no 51; 0 en SV; 6 competidores catalogados |
| V6 | Zoho Social y el candado | ⬜ no ejecutada | — | — |
| V7 | Runtime de la corrida automática | ⬜ no ejecutada | — | — |

**Alcance confirmado por módulo:** pendiente. Se determina al cerrar la Fase 0.

> **Nota de permisos (ADR-012):** ninguna verificación de la Fase 0 escribe en un
> sistema externo. Meta Ads es solo lectura por instrucción del usuario.

---

## Hallazgos preliminares · NO son validaciones

Obtenidos el **2026-08-27** por inventario de la superficie de herramientas MCP
y lectura de esquemas. **No se llamó a ninguna API.** Son observaciones sobre lo
que las herramientas declaran poder hacer, no sobre lo que devuelven.

### P1 · Inventario de conectores
**Método:** cuatro búsquedas independientes sobre el catálogo de herramientas
MCP, por nombre de servicio y por función.

**Salida:** de los ocho conectores que el documento maestro declara disponibles,
tres existen (Meta MCP, Zoho Sprint, Zoho Social MK) y cinco están ausentes
(Zoho CRM, Mail, Analytics, Books, Desk). La búsqueda `+mail send message inbox`
no devolvió ninguna coincidencia de ningún proveedor.

**Confianza:** alta. No requiere confirmación por API — un conector ausente del
catálogo no se puede llamar.

**Detalle completo:** `docs/01-inventario-conectores.md`.

### P2 · `ads_library_search` no acepta rango de fechas
**Método:** lectura del esquema completo de la herramienta.

**Salida:** parámetros expuestos = `search_terms`, `page_ids`, `countries`,
`ad_active_status`, `ad_type`, `limit`. Ningún parámetro temporal.

**Consecuencia:** las corridas retroactivas no pueden incluir competencia.

**Confianza:** alta. El esquema es la definición de la interfaz.

### P3 · `ads_library_search` tope de 50 sin paginación
**Método:** lectura del esquema.

**Salida:** `limit` — *"Maximum number of ads to return. Defaults to 25.
Maximum 50."* No hay parámetro de cursor ni offset.

**Consecuencia:** los 51 anuncios de Paggo no se enumeran en una pasada.
Mitigación: segmentar por país.

### P4 · Zoho Sprint no expone adjuntos
**Método:** revisión del inventario completo (~75 operaciones) del conector.

**Salida:** ninguna operación de subida, descarga o listado de adjuntos.

**Consecuencia:** V3 tendrá respuesta negativa con alta probabilidad; la
contingencia de entrega por enlace se activa.

**Pendiente de confirmar por API:** si el campo de adjunto aparece en la
respuesta de `GetItemDetails` aunque no haya herramienta dedicada.

### P5 · Zoho Sprint no expone webhooks
**Método:** revisión del inventario completo del conector.

**Salida:** ninguna operación de suscripción o webhook. Solo lectura por
consulta.

**Consecuencia:** el Módulo 2 requiere sondeo periódico con estado persistido.

### P6 · `ads_create_ad_set` existe
**Método:** inventario del Meta MCP.

**Salida:** la herramienta está presente, lo que **contradice** el conocimiento
validado del documento maestro.

**Pendiente:** re-verificar por llamada real en V1. El conocimiento heredado se
respeta hasta tener evidencia en contra.

### P7 · El Meta MCP exige contexto conversacional
**Método:** lectura de esquemas de múltiples herramientas del Meta MCP.

**Salida:** todas exigen `client_conversation_id` (20 caracteres) y
`advertiser_request` (*"las palabras exactas del anunciante, citadas
textualmente"*).

**Consecuencia:** fricción con la corrida automática desatendida. Requiere
decisión explícita de diseño.

### P8 · El candado de aprobación tiene soporte nativo en Zoho Social
**Método:** lectura de esquemas de `createSocialSchedule` y `createSocialDraft`.

**Salida:** existe `isApprovalNeeded: true`; existen los tipos *draft* (`type:6`)
y *approval without time* (`type:8`); el conector obliga a llamar
`validateSocialPost` antes de crear.

**Consecuencia:** el candado obligatorio no hay que construirlo, solo usarlo
correctamente. Un riesgo menos.

### P9 · X/Twitter puede terminar la cuenta
**Método:** lectura del esquema de Zoho Social.

**Salida:** advertencia explícita — *"Avoid Twitter for post creation since MCP
publishing for X will be marked as bots leading to account termination."*

**Consecuencia:** X excluido de toda automatización. Ver ADR-008.

---

## Plantilla para las entradas reales

Al ejecutar cada verificación, usar este formato:

```
## V{n} · {nombre}

**Fecha y hora:** YYYY-MM-DD HH:MM (zona horaria)
**Ejecutado por:** {agente o persona}

**Método:**
{qué se hizo y por qué se eligió ese método}

**Llamada exacta:**
{herramienta + parámetros completos, verbatim}

**Salida obtenida:**
{respuesta cruda o su transcripción fiel — no un resumen}

**Interpretación:**
{qué significa}

**Consecuencia sobre el alcance:**
{qué se desbloquea, qué se degrada, qué contingencia se activa}

**Objetos creados (si aplica):**
{IDs, para poder limpiarlos después}
```

---

## V0 · Convención de fechas — ✅ APROBADA

**Fecha:** 2026-08-27
**Ejecutado por:** usuario (interfaz) + agente (API)
**Escrituras realizadas:** ninguna. Solo lectura.

### Método

El método original —reproducir el caso $70.74 vs $1.57— se **descartó**: el
usuario no reconoce ese caso, así que no tiene respaldo verificable y no puede
servir de referencia.

Se sustituyó por un test reproducible y de mejor calidad probatoria:

1. El usuario fijó en Meta Ads Manager un rango **cerrado**: 1 al 24 de agosto
   de 2026 (no un preset móvil).
2. Reportó de tres campañas: Resultados, Costo por resultado, Importe gastado e
   Impresiones.
3. Se consultó la API con el mismo rango, sin ningún ajuste de zona horaria.
4. Se compararon los 12 valores.

### Llamada exacta

```
mcp__Meta_MCP__ads_get_ad_entities
  ad_account_id = "225318458221662"
  level         = "campaign"
  time_range    = {"since":"2026-08-01","until":"2026-08-24"}
  fields        = ["id","name","results","cost_per_result","spend","impressions"]
  sort          = "spend_descending"
  limit         = 10
```

### Salida comparada

| Campaña | Campo | Interfaz | API | |
|---|---|---|---|---|
| Punto de Venta GT | resultados | 158 | 158 | ✅ |
| Punto de Venta GT | costo/resultado | $2.10 | $2.10 | ✅ |
| Punto de Venta GT | gasto | $331.66 | $331.66 | ✅ |
| Punto de Venta GT | impresiones | 57,334 | 57,334 | ✅ |
| Plan Free Tráfico 2026 | resultados | 10,771 | 10,771 | ✅ |
| Plan Free Tráfico 2026 | costo/resultado | $0.01 | $0.01 | ✅ |
| Plan Free Tráfico 2026 | gasto | $104.03 | $104.03 | ✅ |
| Plan Free Tráfico 2026 | impresiones | 476,959 | 476,959 | ✅ |
| Punto de Venta SV | resultados | 105 | 105 | ✅ |
| Punto de Venta SV | costo/resultado | $1.90 | $1.90 | ✅ |
| Punto de Venta SV | gasto | $199.29 | $199.29 | ✅ |
| Punto de Venta SV | impresiones | 46,332 | 46,332 | ✅ |

**12 de 12 idénticos.**

### Interpretación

1. **La convención de fechas queda verificada.** `time_range` con rango cerrado
   en `YYYY-MM-DD`, a nivel de campaña, reproduce la interfaz al centavo.
2. **La zona horaria resultó innecesaria.** La API interpreta `time_range` en la
   zona de la cuenta igual que la interfaz. No hubo que aplicar ningún ajuste.
   El dato sigue pendiente por si se necesita para programar la corrida.
3. **`results` y `cost_per_result` SÍ corresponden a la interfaz.** Esa parte del
   documento maestro es correcta y queda confirmada.
4. **El desfase del $70.74 no se reprodujo.** Con rango cerrado no aparece
   ninguna anomalía. Se trata como no verificable.

### Corrección al documento maestro

El documento afirma que el evento correcto es `QualifiedLead` y que el campo
`lead` *"no corresponde a la columna de Resultados"*. **La evidencia dice otra
cosa:**

| Campaña | Indicador real | Resultados | Costo |
|---|---|---|---|
| Qpaypro Guatemala Nueva | `actions:lead` | 95 | $4.01 |
| Punto de Venta GT | `actions:lead` | 158 | $2.10 |
| Punto de Venta SV | `actions:lead` | 105 | $1.90 |
| Qpayshop e Integraciones | `actions:lead` | 12 | $4.43 |
| Plan Free Tráfico 2026 | `actions:link_click` | 10,771 | $0.01 |
| SV \| POS Físico \| Leads Directos - **Copia** | `...fb_pixel_custom.QualifiedLead` | **1** | $3.23 |
| Qpaypro GT 2026 \| Leads Consolidado CBO | `actions:lead` | Not available | — |
| Plan Free GT \| CompleteRegistration | `...complete_registration` | Not available | — |
| Qpaypro GT 2026 - Copia | `mixed` | Not available | — |
| Nuevo qpaypro 2026 Jun | `mixed` | Not available | — |

Las campañas que concentran el gasto optimizan por **`actions:lead`**, y ese
indicador **sí** corresponde exactamente a la columna Resultados.

`QualifiedLead` existe como evento personalizado del pixel, pero lo usa **una
sola campaña**, con **1 resultado** y **$3.23** de gasto.

**Hipótesis, no conclusión:** esa campaña se llama *"- Copia"*, y el documento
maestro advierte que el objetivo de optimización no se puede editar en ad sets
con historial de entrega y hay que duplicar. El patrón es compatible con una
migración a `QualifiedLead` que se inició duplicando y quedó sin terminar. **Es
una lectura plausible, no un hecho verificado.** Confirmarla requiere revisar la
configuración de esa campaña.

### Consecuencia sobre el alcance

**Desbloquea el paso 2 del Módulo 1** (leer rendimiento de pauta). Con la
convención verificada, el módulo ya puede calcular cantidades trazables en lugar
de solo describir competencia.

**Y añade una restricción de diseño no anticipada:** ver ADR-013.
