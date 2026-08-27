# Inventario de conectores

> # ⚠️ CORRECCIÓN · 2026-08-27
>
> **La conclusión original de este documento era incorrecta y se corrige aquí.**
>
> Este documento afirmaba que Zoho CRM, Mail, Analytics, Books y Desk **"no
> existen"** / **"no están conectados"**. Es falso. Los seis **están instalados
> a nivel de la organización**. Lo que ocurre es que **no están habilitados en
> esta sesión de trabajo**, y por eso sus herramientas no aparecían en el
> catálogo.
>
> **Dónde falló el método.** La medición fue correcta: se buscó en el catálogo de
> herramientas cargadas y no había ninguna de CRM. El error fue de
> **interpretación**: se concluyó "no existe" a partir de "no está cargado". Son
> dos afirmaciones distintas y la segunda no implica la primera.
>
> **Cómo se detectó.** El usuario preguntó cómo conectar el CRM. Al buscar la
> respuesta se consultó el inventario de conectores de la organización
> (`ListConnectors`), que devuelve `installedServerId` y `enabledInChat` por
> separado — precisamente la distinción que faltaba.
>
> **Lección de método, aplicable al resto del proyecto.** Ausencia de evidencia
> no es evidencia de ausencia. Antes de declarar que algo no existe hay que
> agotar las formas de preguntarlo, y decir con precisión qué se midió: aquí lo
> medido era *"sus herramientas no están cargadas en esta sesión"*, y eso es lo
> que se debió reportar.
>
> **Estado real actualizado abajo.** Lo que sigue del documento se conserva sin
> editar, como registro de lo que se concluyó y por qué, pero sus conclusiones
> sobre módulos bloqueados quedan **superadas**.

---

## Estado real de conectores · corregido 2026-08-27

Fuente: `ListConnectors` sobre la organización.

| Conector | Instalado en la organización | Habilitado en esta sesión | Autenticación |
|---|---|---|---|
| Meta MCP | ✅ | ✅ | ✅ confirmada |
| Zoho Social MK | ✅ | ✅ | ✅ confirmada |
| Zoho Sprint | ✅ | ✅ | ✅ confirmada |
| **Zoho CRM** | ✅ | ❌ apagado | ⚠️ desconocida |
| **Zoho Mail Gerencia** | ✅ | ❌ apagado | ⚠️ desconocida |
| **Zoho Analytics Gerencia** | ✅ | ❌ apagado | ⚠️ desconocida |
| **Zoho Books** | ✅ | ❌ apagado | ⚠️ desconocida |
| **Zoho Desk** | ✅ | ❌ apagado | ⚠️ desconocida |
| **Zoho Desk Artículos** | ✅ | ❌ apagado | ⚠️ desconocida |

**Sobre la columna de autenticación:** `ListConnectors` reporta el estado como
*desconocido* para los apagados porque no pudo verificarlo. **No significa que
estén desautenticados.** Habilitarlos es la prueba.

### Consecuencias de la corrección

| Antes se dijo | Ahora |
|---|---|
| Módulo 3 bloqueado, sin ningún nivel de degradación viable | **Posiblemente viable.** Depende de habilitar CRM y de la Verificación 2 |
| Módulo 2 sin canal de entrega para sus reportes | **Posiblemente resuelto.** Zoho Mail está instalado |
| Verificación 2 no ejecutable | **Ejecutable** una vez habilitado el CRM |
| Verificación 4 sin fuente candidata | Hay tres candidatas: CRM, Analytics, Books |

**Lo que NO cambia:** Módulo 1 nunca dependió de estos conectores. Sigue siendo
el único módulo íntegramente construible y sigue siendo la prioridad. La
corrección no altera la estrategia de ejecución (ADR-003).

### Cómo habilitarlos

No requiere construir nada en la consola de Zoho: ya están instalados. Se
habilitan en la configuración de conectores de la sesión de Claude.

---

## Documento original · conservado como registro

### Encabezado original: hallazgo bloqueante

**Fecha:** 27 de agosto de 2026
**Severidad:** bloqueante — invalida el alcance de un módulo completo
**Estado:** confirmado por inventario de superficie; no requiere confirmación
por API

---

## El problema

El documento maestro afirma, bajo el encabezado *"Conectores disponibles hoy"*:

> Meta MCP · Zoho Sprint · Zoho Social MK · Zoho CRM · Zoho Mail Gerencia ·
> Zoho Analytics · Zoho Books · Zoho Desk

Ocho conectores. En la sesión de trabajo real existen **tres**.

---

## Método de verificación

Se inspeccionó el catálogo de herramientas MCP disponible en la sesión. Esto es
lectura de metadatos del entorno, no consulta de datos: no se llamó a ninguna
API, respetando la instrucción de no ejecutar la Fase 0 todavía.

Para no depender de una sola formulación de búsqueda, se hicieron cuatro
consultas independientes, dos por nombre de servicio y dos por función:

| # | Consulta | Resultado obtenido |
|---|---|---|
| 1 | `+zoho crm leads contacts deals` | Solo herramientas de `Zoho_Social_MK` |
| 2 | `+zoho mail analytics books desk email send report` | Solo herramientas de `Zoho_Social_MK` |
| 3 | `+crm lead record module` | Una herramienta de Meta (`ads_get_dataset_quality`), ninguna de Zoho CRM |
| 4 | `+mail send message inbox` | **Sin coincidencias** |

La consulta 4 es la más concluyente: no existe *ninguna* herramienta de envío de
correo en toda la sesión, de ningún proveedor.

**Interpretación:** no se trata de conectores presentes con permisos
restringidos. No existen en la superficie de la sesión. Los servidores MCP
efectivamente cargados son `Meta_MCP`, `Zoho_Sprint`, `Zoho_Social_MK`,
`github` y `Claude_Code_Remote`.

---

## Resultado

| Conector | Documento | Realidad | Herramientas |
|---|---|---|---|
| Meta MCP | disponible | ✅ conectado | ~102 |
| Zoho Sprint | disponible | ✅ conectado | ~75 |
| Zoho Social MK | disponible | ✅ conectado | ~31 |
| **Zoho CRM** | disponible | ❌ **ausente** | 0 |
| **Zoho Mail Gerencia** | disponible | ❌ **ausente** | 0 |
| **Zoho Analytics** | disponible | ❌ **ausente** | 0 |
| **Zoho Books** | disponible | ❌ **ausente** | 0 |
| **Zoho Desk** | disponible | ❌ **ausente** | 0 |

Adicionalmente, ya declarados como inexistentes en el propio documento maestro:
Zoho Cliq y Zoho PageSense ("por construir"), Pinterest y Lead Chain ("sin MCP").

---

## Consecuencias, módulo por módulo

### Módulo 1 · Mesa Creativa — **no afectado**

Depende de Meta MCP (pauta y Ad Library), Zoho Sprint (crear tareas tras la
reunión) y del sistema de archivos (deck y artefactos). Los tres están
disponibles. **Es el único módulo íntegramente construible hoy.**

Esto refuerza, por vía independiente, la prioridad que el documento maestro ya
le asignaba.

### Módulo 2 · Mesa de Servicio — **parcialmente bloqueado**

| Componente | Conector requerido | Estado |
|---|---|---|
| Formulario → work item en Sprint | Zoho Sprint | ✅ posible |
| Confirmación y avisos de estado | Sprint + un canal de notificación | ⚠️ sin canal (Mail y Cliq ausentes) |
| Reporte diario de leads a Ventas | origen de leads + Mail | ❌ bloqueado por ambos |
| Reporte mensual de pauta a Finanzas | Meta + Mail | ❌ bloqueado por la entrega |
| Aprobado en Sprint → post en Social | Sprint + Social | ✅ posible |

Se puede construir la *lógica* de los reportes, pero no su **entrega**. Y sin
entrega no se cumple la Definición de terminado #1 ("corre de principio a fin").
Un reporte que se genera en disco y que nadie recibe no es el entregable que
Ventas y Finanzas necesitan.

### Módulo 3 · Ciclo del lead — **bloqueado por completo**

El módulo entero existe para devolverle a Meta cuáles leads cerraron. Su
degradación en tres niveles, según el documento, es:

| Nivel | Requiere |
|---|---|
| Completo | CRM con origen de campaña + escritura a Meta |
| Intermedio | CRM, cruce por teléfono o correo |
| Mínimo | CRM, tasa de cierre sin devolución a Meta |

**Los tres niveles requieren Zoho CRM.** No hay nivel de degradación que
funcione sin él. El módulo no degrada: queda en cero.

Esto también significa que **la Verificación 2 de la Fase 0 no es ejecutable**.
No se puede preguntarle a un conector inexistente si registra el origen de
campaña.

---

## Impacto sobre la Fase 0

| Verificación | Estado |
|---|---|
| V1 · ToS de Lead Generation en Meta | ✅ ejecutable |
| V2 · CRM registra origen de campaña | ❌ **no ejecutable** — sin conector |
| V3 · Sprint expone adjuntos | ✅ ejecutable (respuesta preliminar: no) |
| V4 · Origen de los leads diarios | ⚠️ probablemente no ejecutable — las fuentes candidatas (CRM, Analytics, Lead Chain) están todas ausentes |

Dos de las cuatro verificaciones originales quedan comprometidas por esta causa
única.

---

## Qué se necesita para desbloquear

1. **Conectar Zoho CRM** en la consola de Zoho MCP → desbloquea el Módulo 3 y
   la Verificación 2.
2. **Conectar Zoho Mail** → desbloquea la entrega de los dos reportes del
   Módulo 2.
3. **O bien**, autorización explícita para declarar el Módulo 3 fuera de
   alcance y documentarlo como tal.

Los puntos 1 y 2 son trabajo del usuario en una consola externa, no accesible
desde esta sesión. **Pueden ejecutarse en paralelo al desarrollo del Módulo 1
sin ningún costo de integración** — ver `docs/05-estrategia-ejecucion.md`,
sección "Lo único que sí va en paralelo".

---

## Nota sobre por qué este hallazgo apareció tan temprano

El documento maestro abre con: *"No construyas sobre supuestos. Este proyecto
tiene cuatro dependencias externas sin verificar."*

Resultó tener cinco más, y de un tipo distinto: no eran dependencias cuyo
*comportamiento* estuviera sin verificar, sino dependencias cuya *existencia*
se daba por supuesta. La lección operativa para el resto del proyecto es que la
lista de conectores de un documento no es evidencia; el inventario de la sesión
sí lo es, y verificarlo cuesta minutos.
