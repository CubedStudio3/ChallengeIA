# Riesgos del proyecto

**Fecha:** 27 de agosto de 2026

El documento maestro pidió señalar riesgos que no hubiera mencionado. Éstos son
los seis identificados, ordenados por severidad. Los riesgos que el propio
documento ya cubría (dependencias externas sin verificar, datos inventados,
publicación sin aprobación) no se repiten aquí; están atendidos por sus reglas.

---

## Riesgo A · No existe runtime para la corrida automática
**Severidad: CRÍTICA · Probabilidad: media-alta · Impacto: 25% de la evaluación**

### El problema

*"Arranca solo cada lunes"* necesita un lugar donde vivir. El contenedor de esta
sesión es **efímero**: se recicla por inactividad. No es infraestructura, es una
sesión de trabajo.

Y hay una capa peor. Los servidores MCP de esta sesión están autenticados
**a nivel de sesión y cuenta**, no por variables de entorno. La documentación del
propio entorno de ejecución advierte que *los servidores MCP con autenticación
interactiva pueden no estar disponibles en corridas headless o programadas*.

### Traducido

Es posible que Meta, Sprint y Social **no estén accesibles en una corrida
automática desatendida**. Si eso ocurre:

- El 25% de uso agéntico se cae por completo.
- Y se cae el 5 de septiembre, cuando ya no hay margen para replantear.

### Efecto secundario sobre las reglas de seguridad

El documento manda *"ninguna credencial en el repositorio; variables de
entorno"*. Pero el modelo de autenticación real aquí es **OAuth de sesión**, no
variables de entorno. La regla de seguridad se cumple igual —de hecho mejor,
porque no hay secretos que puedan filtrarse a un commit— pero por un mecanismo
distinto al que el documento supone. Conviene no escribir código que espere
credenciales en el entorno cuando no las hay.

### Mitigación

Verificación 7 de la Fase 0: programar una tarea de prueba que haga **una sola
llamada de lectura** a Meta y confirme que autenticó fuera de una sesión
interactiva. **Se prueba en Fase 0, no en Fase 2.**

---

## Riesgo B · El alcance no cabe en el tiempo disponible
**Severidad: ALTA · Probabilidad: alta si no se recorta**

### Las cuentas

Hoy es **27 de agosto**. Al cierre de desarrollo faltan **9 días**; al primer
criterio de corte, **5**.

Lo que el documento pide en ese plazo:

| Ítem | Cantidad |
|---|---|
| Módulos | 3 |
| Subagentes | 7 |
| Skills | 6 |
| Verificaciones de Fase 0 | 4 (ampliadas a 7) |
| Corridas retroactivas | 8–10 |
| Documentos de evidencia | 3 |

Sobre un repositorio que estaba vacío, con **5 de 8 conectores ausentes** y sin
runtime confirmado.

### Lectura honesta

- **Módulo 1 completo + evidencia retroactiva: alcanzable.**
- **Módulo 2: llega parcial** — su lógica sí, su entrega no (sin Mail).
- **Módulo 3: bloqueado** por un conector que no existe.

### Mitigación

Los criterios de corte del documento están bien diseñados. La propuesta es
**aplicar el del 1 de septiembre desde ahora, de forma preventiva**: todo el
esfuerzo al Módulo 1, y los Módulos 2 y 3 solo si el 1 llega terminado antes del
3 de septiembre.

Eso gana 5 días de foco. Y es mejor decidirlo hoy con calma que el 3 de
septiembre bajo presión.

---

## Riesgo C · La verificación de la semana anterior no tiene con qué arrancar
**Severidad: MEDIA · Probabilidad: certeza (100%)**

### El problema

El paso 6 del Módulo 1 —*"verifica lo recomendado la semana anterior: si se
ejecutó y qué pasó con la métrica"*— es, según el documento, la pieza central
del valor del sistema. Pero en la **primera corrida real no hay semana
anterior**: `data/historico/` está vacío.

Si el paso 6 trata la ausencia de historial como "dato faltante", la Regla 3
obliga a detener la corrida. La primera corrida abortaría por diseño.

### Mitigación

Dos cosas, y la segunda es una recomendación de secuencia:

1. El paso 6 debe distinguir entre **"dato faltante"** (error: detenerse) y
   **"no aplicable por ser la primera corrida"** (estado válido: reportar y
   continuar). Es una distinción que hay que codificar explícitamente.
2. **Adelantar las corridas retroactivas** respecto al orden del documento. Si
   se generan primero las corridas de junio, julio y agosto, la primera corrida
   real **sí tiene historial** contra el cual verificar. El loop se demuestra
   funcionando en lugar de reportando "no aplicable".

---

## Riesgo D · El 25% de ahorro de tiempo no se mide solo
**Severidad: MEDIA-ALTA · Probabilidad: alta · Impacto: 25% de la evaluación**

### El problema

Nada en la arquitectura propuesta captura el "después". Se automatiza el trabajo
y luego **nadie cronometró la reunión nueva**. El 6 de septiembre habría que
reconstruir la cifra de memoria.

Y el "antes" está igual de flojo: el *"3 a 4 horas"* de preparación es la línea
base de la que depende el 25% de la evaluación, y no consta cómo se midió.

### Por qué es delicado

Sería irónico —y atacable en la presentación— que el proyecto cuya regla central
es *"cero datos inventados"* presente su métrica estrella sin método. Un
evaluador que pregunte *"¿cómo midieron las 3 a 4 horas?"* debe recibir una
respuesta, no una estimación de memoria.

### Mitigación

1. **Capturar el "antes" ahora.** Que alguien cronometre la próxima preparación
   de reunión creativa a la antigua, con desglose por paso. Solo se puede
   capturar **antes** de automatizar. Si esa reunión ocurre esta semana, es
   ahora o nunca.
2. **Instrumentar el "después" desde la primera corrida real**, no al final.
3. Documentar el método en `docs/linea-base.md`: quién midió, qué pasos, con qué
   instrumento.

---

## Riesgo E · Trazabilidad: volumen y persistencia
**Severidad: MEDIA · Probabilidad: media**

### El problema

*"Cada número del plan debe ser trazable hasta su dato de origen"* implica
guardar **la respuesta cruda de cada consulta**, no solo el número derivado. Es
la única forma de auditar de verdad, y es también la evidencia del Demo Day.

Eso tiene costo de diseño: dónde se persiste, con qué nombre, cómo se relaciona
un número del deck con la consulta que lo produjo, y cuánto crece con 8–10
corridas retroactivas más las semanales.

### Mitigación

Decidirlo en Fase 1, como parte de las interfaces de la base compartida. No
improvisarlo al implementar el Módulo 1. Registrado como pendiente en
`docs/decisiones.md` (ADR-010, sin resolver).

---

## Riesgo F · Riesgo reputacional del candado por inercia
**Severidad: MEDIA · Probabilidad: media · Impacto: 15% de reducción de riesgos**

### El problema

El candado de aprobación humana está bien y no se va a tocar. El riesgo es
distinto y más sutil: **un copy de fintech mal redactado, aunque quede en
borrador, puede aprobarse por inercia** cuando la revisión se vuelve rutina
semanal. El candado protege contra la publicación automática, no contra la
aprobación desatenta.

En una fintech regulada, un copy que promete rendimientos, compara directamente
con un competidor nombrado, o cita cifras sin fuente, es exposición real.

### Mitigación

Defensa en profundidad, no un segundo candado:

1. `contexto-marca` debe incluir una **lista explícita de prohibiciones**:
   promesas de rendimiento, comparaciones directas con competidores nombrados,
   cifras sin fuente, afirmaciones sobre tiempos de acreditación o costos que no
   estén respaldadas.
2. El `redactor` **marca** cualquier copy que roce una prohibición, en lugar de
   entregarlo silenciosamente. El humano aprueba viendo la marca.
3. Esto suma al 15% de reducción de riesgos de la evaluación, no solo a la
   seguridad operativa.

---

## Riesgo G · Exclusión de X/Twitter *(detectado al leer esquemas)*
**Severidad: BAJA en impacto, ALTA en consecuencia si se ignora**

El esquema de Zoho Social advierte explícitamente que publicar en X/Twitter vía
MCP puede hacer que la cuenta sea **marcada como bot y terminada**.

**Mitigación:** X queda excluido de toda automatización de publicación. Si el
área publica en X, se hace manualmente. Registrado en ADR-008.

---

## Tabla resumen

| # | Riesgo | Severidad | Se mitiga en |
|---|---|---|---|
| A | No existe runtime para la corrida automática | **Crítica** | Fase 0 · V7 |
| B | El alcance no cabe en el tiempo | Alta | Recorte preventivo ahora |
| C | El loop de verificación arranca sin historial | Media | Adelantar corridas retroactivas |
| D | El ahorro de tiempo no se mide solo | Media-alta | Medir el "antes" esta semana |
| E | Trazabilidad: volumen y persistencia | Media | Fase 1 · interfaces de la base |
| F | Aprobación por inercia del candado | Media | `contexto-marca` + marcado del `redactor` |
| G | X/Twitter puede terminar la cuenta | Baja / alta consecuencia | ADR-008 · exclusión |
