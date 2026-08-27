# Validaciones · resultado de la Fase 0

Este archivo es el registro oficial de las verificaciones de la Fase 0. Cada
entrada debe incluir **fecha, método, llamada exacta y salida obtenida**.

**Estado global: 0 de 7 verificaciones ejecutadas.**

> **Regla de este archivo.** Nada se anota aquí sin una llamada real y su salida.
> Una conclusión sin evidencia registrada no cuenta como validación. Las
> observaciones obtenidas por otros medios (inventario de herramientas, lectura
> de esquemas) van en la sección de hallazgos preliminares, claramente separadas.

---

## Tablero de estado

| # | Verificación | Estado | Fecha | Resultado |
|---|---|---|---|---|
| V0 | Convención de fechas (test del $1.57) | ⬜ no ejecutada | — | — |
| V1 | ToS de Lead Generation | ⬜ pendiente del usuario | — | Método cambiado: se verifica en Business Manager, sin escritura (ADR-012) |
| V2 | CRM registra origen de campaña | 🚫 **no ejecutable** | 2026-08-27 | Conector ausente |
| V3 | Sprint expone adjuntos | ⬜ no ejecutada | — | preliminar: negativo |
| V4 | Origen de los leads diarios | ⬜ pendiente del usuario | — | — |
| V5 | Premisa competitiva (Paggo) | ⬜ no ejecutada | — | — |
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
