# Plan de la Fase 0 · verificaciones obligatorias

**Fecha:** 27 de agosto de 2026
**Estado:** propuesto, NO ejecutado. 0 de 7 completadas.

El documento maestro definió cuatro verificaciones. Este plan las mantiene y
añade tres, reordenándolas por el criterio de **cuánto alcance desbloquea o mata
cada una**. Las de lectura pura van primero; la única que escribe va al final.

Cada verificación se registra en `docs/validaciones.md` con fecha, método,
llamada exacta y salida obtenida. Sin excepción.

---

## Orden de ejecución

```
V0 → V5 → V6 → V3 → V7          ← ejecuta el agente (todo lectura)
V1 → en Business Manager        ← ejecuta el usuario
V4 → es una pregunta al usuario
V2 → no ejecutable (sin conector de CRM)
```

**Ninguna verificación escribe en ningún sistema externo.** Tras ADR-012, la
Fase 0 completa es de solo lectura.

**Racional del orden:**

- **V0 primero** porque toda métrica del proyecto depende de la convención de
  fechas. Si está mal, todo lo construido encima está mal, y el caso $70.74
  demuestra que el error es silencioso y de magnitud absurda.
- **V5 y V6 segundo** porque son lectura pura, baratas, y responden mucho:
  V5 valida la premisa estratégica completa del proyecto, V6 confirma que el
  candado de aprobación tiene soporte nativo.
- **V3 después** porque su respuesta preliminar ya se conoce y solo falta
  formalizarla.
- **V1 ya no la ejecuta el agente.** Tras ADR-012 la verifica el usuario en la
  interfaz de Business Manager: más rápido, sin riesgo y sin crear nada.
- **V7 al final** pero antes de cualquier código, porque si falla hay que
  replantear la arquitectura completa de ejecución.

---

## V0 · Convención de fechas *(nueva — la más importante)*

**Por qué es nueva y por qué va primera.** El documento pide *"fija y documenta
la convención de fechas del proyecto"*. Declarar una convención no prueba nada.
Una convención documentada pero equivocada es peor que ninguna, porque genera
confianza injustificada.

Se convierte en un **test falsable**: la convención es correcta si —y solo si—
reproduce un número que ya se sabe correcto.

### El dato de referencia

Del conocimiento validado: una discrepancia previa arrojó un costo por lead de
**$70.74** cuando el valor real era **$1.57**. El documento atribuye la causa a
desalineación de rangos de fecha.

**Observación analítica:** la razón entre ambos valores es ≈**45.06x**. Eso es
demasiado grande para un desfase de zona horaria simple (que produciría
diferencias de un dígito porcentual). Un factor de ~45 sugiere que numerador y
denominador provienen de ventanas de tamaño muy distinto — por ejemplo gasto
acumulado de un mes contra resultados de un solo día, o resultados
casi-cero en la ventana consultada.

Ésta es una hipótesis, no una conclusión. Se confirma o se descarta con el
test. **No se documentará ninguna causa como definitiva sin reproducirla.**

### Pasos

1. `ads_get_ad_accounts` → obtener la **zona horaria** de la cuenta
   `225318458221662`. Sin ese dato la convención es una adivinanza.
2. Consultar insights del periodo donde apareció la discrepancia, aplicando la
   convención candidata:

   | Elemento | Valor candidato |
   |---|---|
   | Zona horaria | la de la cuenta publicitaria (no UTC, no local del operador) |
   | Definición de semana | lunes a domingo |
   | Ventana de atribución | **fijada explícitamente en cada llamada**, nunca por defecto |
   | Métricas | `results` y `cost_per_result` atados a `QualifiedLead` |
   | Desglose por red | `publisher_platform` a nivel de conjunto de anuncios |

3. **Criterio de aprobación: el resultado reproduce ≈$1.57.**
4. Si no lo reproduce, la convención está mal y se itera **antes** de pasar a
   Fase 1.

### Insumo bloqueante

Se necesita del usuario el **periodo exacto y la campaña** donde se observaron
ambos números. Sin eso no hay test, y sin test la convención es una declaración
de fe. Ver `docs/06-requerimientos-usuario.md`, punto 3.

---

## V1 · Términos de Servicio de Lead Generation
### ⚠️ MÉTODO CAMBIADO — sin escritura. Ver ADR-012.

**Pregunta original del documento:** ¿están aceptados los ToS de Lead Generation?
Probar una acción de escritura sobre una campaña de prueba.

**El método original queda anulado.** Meta Ads es solo lectura por instrucción
explícita del usuario (2026-08-27). No se crea ninguna campaña de prueba, ni en
estado pausado.

### Método nuevo

**Ejecuta el usuario, en la interfaz de Meta Business Manager.** Dos minutos,
cero riesgo, sin crear nada. Es estrictamente mejor que la vía por API.

1. El usuario revisa en Business Manager si los ToS de Lead Generation están
   aceptados para la cuenta `225318458221662`.
2. Reporta el resultado.
3. Se registra en `docs/validaciones.md` citando la fuente (captura o ruta de
   la interfaz), no como afirmación sin respaldo.

### Vía complementaria por API, solo lectura

`ads_get_errors` puede revelar bloqueos de ToS ya registrados. Es lectura y no
crea nada, así que se puede ejecutar sin problema. Sirve como corroboración, no
como método principal.

### Contingencia — que ahora es el modo normal de operación

El documento maestro ya la había definido:

> *El agente no ejecuta: crea la tarea en Sprint con la instrucción exacta y un
> humano la aplica.*

Con ADR-012 esto deja de ser plan B y se convierte en el patrón permanente para
cualquier acción que requiera escritura en Meta.

### Consecuencia sobre C4, y por qué se acepta

El sub-paso que iba a probar si `ads_create_ad_set` funciona **no se ejecuta**:
requeriría una escritura. El conocimiento heredado del documento maestro ("los
ad sets no se crean de forma independiente por la API del MCP") se mantiene como
**supuesto declarado y no verificado**.

Esto es coherente con la regla del proyecto: se documenta la incertidumbre en
lugar de resolverla con una acción que el usuario prohibió. Un supuesto marcado
como supuesto no es un dato inventado.

---

## V2 · Zoho CRM registra el origen de campaña

**Estado: NO EJECUTABLE.**

Zoho CRM no está conectado (ver `docs/01-inventario-conectores.md`). No se puede
interrogar a un conector inexistente.

**Consecuencia:** el Módulo 3 no degrada a nivel intermedio ni mínimo — los tres
niveles de degradación que definió el documento requieren CRM. El módulo queda
en cero hasta que el conector exista.

**Desbloqueo:** conectar Zoho CRM en la consola de Zoho MCP (trabajo del
usuario, fuera de esta sesión), o autorizar declarar el Módulo 3 fuera de
alcance.

---

## V3 · Zoho Sprint expone adjuntos por API

**Contingencia definida:** la pieza se entrega por enlace dentro del work item.

**Respuesta preliminar: NO.** El inventario completo del conector no contiene
ninguna operación de adjuntos.

### Pasos de confirmación formal

1. `ZohoSprints_GetProjects` → identificar el proyecto de prueba.
2. `ZohoSprints_GetItemDetails` sobre un item que **se sepa** que tiene un
   adjunto → verificar si el campo aparece en la respuesta aunque no haya
   herramienta dedicada.
3. Activar la contingencia de entrega por enlace y documentarla.

El paso 2 importa: la ausencia de una *herramienta* de adjuntos no implica
necesariamente la ausencia del *campo* en la respuesta. Vale la pena mirar antes
de concluir.

---

## V4 · Origen de los datos de leads diarios

**Estado: es una pregunta al usuario antes que a una API.**

El documento advierte que si el origen es Lead Chain, no hay servidor MCP. Pero
el problema es más amplio: **todas las fuentes candidatas están ausentes** —
Zoho CRM, Zoho Analytics, Zoho Books, y Lead Chain.

**Lo que se necesita saber, en términos operativos y no técnicos:**

- ¿De dónde salen hoy, en la práctica, los números de leads diarios?
- ¿Quién los ve, en qué formato, y con qué frecuencia?
- ¿Hay alguna exportación, hoja de cálculo o correo recurrente que ya exista?

Sin esa respuesta no se puede construir `reporte-leads`, que es uno de los dos
entregables del Módulo 2.

---

## V5 · Premisa estratégica competitiva *(nueva — barata, alto valor)*

**Por qué es nueva.** La premisa competitiva completa del proyecto —Paggo corre
51 anuncios, ~35 con el titular "Gestiona tu Negocio Fácil", ocupando el
territorio de gestión de negocio y facturación— **no está fechada en el
documento**. Si cambió, cambia la estrategia que el Módulo 1 va a recomendar.

### Pasos

1. `ads_library_search` con:
   - `page_ids: ["105294361957860"]`
   - `ad_active_status: "ACTIVE"`
   - `countries: ["GT"]` y luego `["SV"]` por separado (para sortear el tope de
     50 sin paginación — ver C3)
2. Clasificar los resultados por titular, ángulo y formato.
3. Buscar los `page_id` de **Recurrente** y **Square**, que faltan, y
   presentarlos al usuario para validación antes de agregarlos a
   `config/competidores.json`.

### Tres respuestas de una sola llamada

- ¿Sigue siendo válido el `page_id` de Paggo?
- ¿Cuántos anuncios corre hoy?
- ¿Sigue dominando ese titular?

---

## V6 · Zoho Social y el mecanismo del candado *(nueva)*

**Por qué es nueva.** El candado de aprobación humana es una regla no negociable
del proyecto. Conviene confirmar que el conector lo soporta nativamente, en
lugar de tener que construirlo.

### Pasos (lectura pura)

1. `getSocialPortals` → obtener el `portal_id`.
2. `getSocialBrands` → obtener el `brand_id`.
3. `getSocialChannels` → confirmar qué canales existen y su estado de conexión.
4. `getSocialNetworkProperties` → límites de caracteres y restricciones de media
   por red, que el `redactor` necesitará respetar.

### Buena noticia ya confirmada por esquema

- `createSocialSchedule` acepta `isApprovalNeeded: true`.
- Existe el tipo *draft* (`type: 6`) y el tipo *"approval without time"*
  (`type: 8`).
- El conector **obliga** a llamar `validateSocialPost` antes de crear.

**El candado obligatorio tiene soporte nativo.** Es un riesgo menos: no hay que
construir el mecanismo, solo usarlo correctamente.

**Nota de riesgo detectada en el esquema:** el conector advierte explícitamente
que publicar en X/Twitter vía MCP puede marcar la cuenta como bot y llevar a su
terminación. **X queda excluido de toda automatización de publicación.**
Registrado en ADR-008.

---

## V7 · Runtime de la corrida automática *(nueva — crítica)*

**Por qué es nueva y por qué es crítica.** Ver `docs/04-riesgos.md`, riesgo A.
En resumen: *"arranca solo cada lunes"* necesita un lugar donde vivir, y este
contenedor es efímero. Peor: los conectores MCP están autenticados a nivel de
sesión, y la documentación del entorno advierte que **los servidores MCP con
autenticación interactiva pueden no estar disponibles en corridas headless o
programadas**.

Si eso ocurre, el 25% de uso agéntico se cae por completo.

### Paso

Programar una tarea de prueba que haga **una sola llamada de lectura** a Meta y
confirme que autenticó correctamente fuera de una sesión interactiva.

### Interpretación del resultado

| Resultado | Consecuencia |
|---|---|
| Autentica | El proyecto es viable tal como se diseñó |
| No autentica | Replanteo inmediato de la arquitectura de ejecución. Probablemente sacrifica los Módulos 2 y 3 antes del 1 de septiembre |

**Debe probarse ahora, no en Fase 2.** Descubrirlo el 4 de septiembre no deja
margen de reacción.

---

## Qué se reporta al terminar

Conforme al prompt de arranque de Fase 0 del documento maestro:

1. Cada verificación en `docs/validaciones.md` con fecha, método, llamada y
   salida obtenida — incluidas las que no se pudieron ejecutar, con el motivo.
2. **El nivel de alcance confirmado para cada módulo.**
3. Nada de arquitectura todavía. La arquitectura se propone después, con los
   resultados en la mano.
