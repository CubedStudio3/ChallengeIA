# Lo que se necesita del usuario

**Fecha:** 27 de agosto de 2026
**Estado actualizado 2026-08-27:** 3 resueltos · 1 bloqueante real (runtime)

Sin los puntos bloqueantes no se puede iniciar la Fase 0 de forma completa, ni
verificar que lo construido dice la verdad.

---

## Bloqueantes · sin esto no hay módulo

### 1 y 2 · Habilitar los conectores de Zoho apagados
**Corregido 2026-08-27.** No hay que *conectar* nada: Zoho CRM, Mail, Analytics,
Books y Desk **ya están instalados** en la organización. Están **apagados en
esta sesión**, y por eso sus herramientas no aparecen.

**Acción:** habilitarlos en la configuración de conectores de la sesión de
Claude. No requiere trabajo en la consola de Zoho.

**Desbloquea:**
- **Zoho CRM** → Verificación 2 y el Módulo 3
- **Zoho Mail** → la entrega de `reporte-leads` y `reporte-pauta`
- **Zoho Analytics / Books** → candidatos para la Verificación 4 (origen de los
  leads diarios)

**Nota:** el estado de autenticación de los apagados se reporta como
*desconocido*. Habilitarlos es también la prueba.

**Prioridad real:** media, no bloqueante. **El Módulo 1 no depende de ninguno de
estos conectores.** Se puede habilitar cuando convenga, sin detener el
desarrollo.

### 3 · Periodo y campaña exactos del caso $70.74 vs $1.57
**Desbloquea:** la Verificación 0, que es el test de la convención de fechas.

Es el insumo más importante de esta lista. Sin él la convención de fechas es una
declaración sin prueba, y toda métrica del proyecto se construye encima.

**Qué se necesita concretamente:** el rango de fechas donde se observó cada
número y la campaña o conjunto de anuncios involucrado. Si existe una captura de
pantalla de la interfaz con el $1.57, mejor todavía.

### 4 · Autorización para crear una campaña PAUSED de prueba
**Cuenta:** `225318458221662` (es la cuenta de producción; Meta no ofrece
sandbox).
**Desbloquea:** la Verificación 1 (ToS de Lead Generation) si la vía de lectura
resulta inconclusa.

**Convención propuesta, ADR-007:** estado `PAUSED` desde la creación,
presupuesto mínimo, prefijo `[TEST-MC]` en el nombre, jamás activar, registro de
todo ID creado para poder limpiarlo.

**No se crea nada sin un sí explícito.**

### 5 · Dónde va a correr la corrida automática del lunes
**Desbloquea:** el 25% de uso agéntico de la evaluación.
**Contexto:** riesgo A en `docs/04-riesgos.md`.

Este contenedor es efímero y los conectores están autenticados a nivel de
sesión. Hay que definir y **probar** el runtime en Fase 0, no en Fase 2.

---

## Necesario para que la salida no sea genérica

### 6 · Materia prima de `contexto-marca`

El documento identifica esta skill como crítica: *"sin ella, los copies salen
genéricos"*. No se entregó nada de su contenido. Se necesita:

| Elemento | Detalle |
|---|---|
| Tono de voz | Cómo habla QPayPro, con ejemplos de lo que sí y lo que no |
| Posicionamiento | Qué lugar ocupa frente a Paggo y Recurrente |
| Productos | Nombre comercial real de POS físico, POS virtual, links de pago, QR, pasarela, APIs |
| Diferencias por mercado | Qué cambia entre Guatemala y El Salvador |
| **Restricciones de comunicación de fintech** | Qué no se puede prometer, qué exige aviso legal, qué comparaciones están vedadas |

El último renglón es el más importante y el que suele faltar. Alimenta el
riesgo F y suma directamente al 15% de reducción de riesgos de la evaluación.

### 7 · `config/destinatarios.json`

Quién recibe qué, con nombre y correo:

- Reporte diario de leads → Ventas y jefatura
- Reporte mensual de inversión en pauta → Finanzas
- Solicitud de captura de métricas orgánicas (el recordatorio del viernes) → ¿quién?

### 8 · Proyecto de prueba en Zoho Sprint

Nombre o ID. No se toca el proyecto real durante el desarrollo.

### 9 · `page_id` de Recurrente y Square

`config/competidores.json` solo tiene Paggo. Si no los tienes a mano, se buscan
en la Verificación 5 y **se te presentan para validación** antes de agregarlos
— la búsqueda por palabra clave en Ad Library no es confiable, así que un
`page_id` encontrado por búsqueda necesita confirmación humana.

### 10 · Método de la línea base

El *"3 a 4 horas"* de preparación sostiene el 25% de ahorro de tiempo de la
evaluación.

**La pregunta:** ¿hay registro de esa medición, o es estimación de memoria?

Si es de memoria, hay que documentar cómo se midió —quién, qué pasos,
cronometrado— **antes** del Demo Day. Una cifra sin método es atacable, y sería
irónico que el proyecto que prohíbe datos inventados presente su métrica
estrella sin respaldo.

**Y hay urgencia:** el "antes" solo se puede capturar antes de automatizar. Si
la próxima reunión creativa a la antigua ocurre esta semana, es ahora o nunca.

---

## Decisiones pendientes

### 11 · Opción (A) o (B) para el orgánico faltante
Ver contradicción C1 en `docs/02-contradicciones.md`.

- **(A)** Insumo opcional con degradación declarada: la corrida procede solo con
  pauta y declara el hueco en portada. *(Recomendada.)*
- **(B)** Insumo obligatorio: la corrida aborta, y se reescribe la Definición de
  terminado #1.

### 12 · ¿Zoho Cliq y PageSense se van a construir? ¿Cuándo?
El documento los marca como "por construir en la consola de Zoho MCP". Cliq es
el candidato natural para el recordatorio del viernes; si no existe y Mail
tampoco, no hay canal para pedir las métricas orgánicas.

### 13 · Tecnología del formulario del Módulo 2
Zoho Forms no está entre los conectores. ¿Formulario web? ¿Un item creado a mano
en Sprint? ¿Un correo a una dirección específica? Hoy es alcance indefinido.

---

## Tabla de seguimiento

| # | Requerimiento | Tipo | Estado |
|---|---|---|---|
| 1 | Habilitar Zoho CRM en la sesión | Media · ya instalado | ⬜ pendiente |
| 2 | Habilitar Zoho Mail en la sesión | Media · ya instalado | ⬜ pendiente |
| 3 | ~~Periodo del caso $70.74~~ | — | ✅ **resuelto** por V0 con otro método |
| 4 | ~~Autorización campaña PAUSED~~ | — | ✅ **anulado** por ADR-012 (Meta solo lectura) |
| 5 | Runtime de la corrida | Bloqueante | ⬜ pendiente |
| 6 | Materia prima `contexto-marca` | Insumo | ⬜ pendiente |
| 7 | Destinatarios de reportes | Insumo | ⬜ pendiente |
| 8 | Proyecto de prueba en Sprint | Insumo | ⬜ pendiente |
| 9 | `page_id` de competidores | Insumo | ✅ **entregados** y verificados |
| 10 | Método de la línea base | Insumo · **urgente** | ⬜ pendiente |
| 11 | Decisión (A)/(B) orgánico | Decisión | ⬜ pendiente |
| 12 | Cliq y PageSense | Decisión | ⬜ pendiente |
| 13 | Formulario del Módulo 2 | Decisión | ⬜ pendiente |
