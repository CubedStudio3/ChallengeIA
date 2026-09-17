# Crudos del Ciclo del Lead

Respuestas guardadas tal cual, sin transcripción a mano.

| Archivo | Qué es | Lo lee |
|---|---|---|
| `leads_p0/p1/p2.json` | Posibles clientes NO convertidos, COQL paginado | `ciclo_lead.py` |
| `leads_convertidos.json` | Posibles clientes ya convertidos (los informes de Zoho los excluyen por omisión) | `ciclo_lead.py` |
| `tratos.json` | Tratos con etapa, razón, plan y responsable | `ciclo_lead.py` |
| `meta_lead_q1/q2/q3.json` | Pauta día por día y por país con los campos **`lead`** y **`onsite_conversion_lead_grouped`** | `ciclo_lead.py` |
| `meta_q1/q2/q3.json` | ⚠️ **Ya no se lee.** La misma pauta pero con el `results` de cada campaña | nadie |

Los `meta_q*.json` se conservan como evidencia de la lectura anterior, que
**subcontaba los leads**: `results` devuelve el resultado del indicador por el
que cada campaña optimiza, así que los leads de una campaña de tráfico quedaban
invisibles —3.052 contra los 5.712 reales del año—. El porqué está en
`docs/11-ciclo-del-lead.md`, «Corrección del 2026-09-19». No usarlos para contar
leads.
