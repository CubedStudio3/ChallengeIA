# Estrategia de ejecución · secuencial vs. paralelo

**Fecha:** 27 de agosto de 2026
**Origen:** pregunta del usuario — *"¿es mejor hacer propuesta 1 completa, luego
2, luego 3, o hacerlo todo junto para ir viendo posibles errores y soluciones de
mejor manera?"*

**Decisión: secuencial, con un corte distinto al planteado.**

El instinto de detectar errores temprano es correcto. La herramienta para
lograrlo no es el paralelismo.

---

## 1 · "Todo junto" no es una opción material hoy

No es una preferencia de estilo. Es el estado de los conectores:

| Módulo | Bloqueo |
|---|---|
| Módulo 3 | Depende de Zoho CRM. **No conectado.** No hay nada que construir. |
| Módulo 2 | Depende de Zoho Mail para entregar sus dos reportes. **No conectado.** Se puede construir la lógica, no la entrega. |

Entonces "hacerlo todo junto" significa, en la práctica: *hacer el Módulo 1 y
dos módulos a medias que no se pueden probar de punta a punta.*

Eso es lo peor de ambos mundos. Se gastan días en código que no se puede
verificar contra datos reales — y la Regla 1 del documento maestro prohíbe
exactamente eso: *"Ninguna línea de código que dependa de ellas se escribe antes
de comprobarlas contra las APIs reales."*

---

## 2 · Por qué el paralelismo, aquí, esconde errores en lugar de revelarlos

Esto va justo en contra de la intuición, así que vale explicarlo.

### El mecanismo de falla

**La base compartida no existe todavía.** Si arrancan tres módulos a la vez
sobre una base que se está definiendo al mismo tiempo, el resultado previsible
es:

- Tres convenciones de fecha distintas (y el caso $70.74 demuestra lo que cuesta
  una convención mal alineada).
- Tres formas de registrar.
- Tres maneras de trazar un número hasta su consulta de origen.

Los errores de integración **no aparecen mientras se escribe código**. Aparecen
al unir las piezas. Con tres frentes, eso caería alrededor del **3 o 4 de
septiembre** — exactamente cuando no hay margen.

Es el modo de falla clásico de un proyecto con fecha fija: parece que se avanza
tres veces más rápido durante una semana, y la última semana se va entera en
reconciliar.

### El documento maestro ya había decidido esto

Los criterios de corte dicen:

> **1 de septiembre:** si la base compartida no está operativa, se abandonan los
> Módulos 2 y 3 y todo el esfuerzo va al Módulo 1.
>
> **3 de septiembre:** si el Módulo 1 no está completo, no se inicia ningún otro.

Eso **es** una secuencia obligatoria, escrita por adelantado precisamente para no
improvisar bajo presión. Solo hay que respetarla.

---

## 3 · Lo que sí resuelve la preocupación: profundidad, no ancho

La pregunta real era *cómo ver los errores temprano*. La respuesta es una
**rebanada vertical delgada** que atraviese todas las capas de una vez, antes de
ensanchar ninguna.

### La rebanada

```
Leer una campaña de Meta
    ↓
Normalizarla con la convención de fechas
    ↓
Guardar el artefacto trazable
    ↓
Generar un deck de 3 diapositivas
```

Sin agentes. Sin skills. Sin orquestación. Sin Sprint ni Social. Un solo camino,
de la API al PowerPoint.

### Por qué funciona: prueba los cuatro riesgos mayores a la vez

| Lo que prueba la rebanada | Riesgo que neutraliza |
|---|---|
| La convención de fechas reproduce el $1.57 | El caso $70.74 se repite dentro del entregable |
| La corrida autentica fuera de esta sesión | Riesgo A — el 25% de uso agéntico no existe |
| El número del deck se rastrea hasta su consulta | La trazabilidad era decorativa |
| El PowerPoint se genera de verdad | El entregable del Demo Day no sale |

Si algo de eso falla, se sabe el **día 2**, no el día 8. Y falla **en un lugar
conocido**, con una sola tubería que revisar, no repartido entre tres módulos
donde hay que averiguar primero cuál de los tres rompió.

Después se ensancha: la rebanada ya definió las interfaces de la base
compartida, y ensanchar es agregar fuentes y pasos a una tubería que ya
funciona.

---

## 4 · El orden recomendado

| # | Etapa | Nota |
|---|---|---|
| 1 | **Fase 0** — las 7 verificaciones | Aquí se sabe qué alcance queda vivo |
| 2 | **Rebanada vertical** | La tubería delgada de arriba |
| 3 | **Módulo 1 completo** | Ensanchando esa tubería paso por paso, ejecutando contra datos reales después de cada paso |
| 4 | **Evidencia retroactiva** | **Adelantada** respecto al documento — ver abajo |
| 5 | **Módulo 2** | Solo si el 1 está terminado antes del 3 de sept. y Mail ya está conectado |
| 6 | **Módulo 3** | Solo si aparece Zoho CRM. Hoy no se cuenta. |

### Por qué se adelanta la evidencia retroactiva (etapa 4)

Por el riesgo C. El paso 6 del Módulo 1 verifica lo recomendado la semana
anterior, y en la primera corrida real no hay semana anterior. Si las corridas
de junio y julio se generan **antes**, la primera corrida real sí tiene
historial contra el cual verificar: el loop se demuestra **funcionando** en
lugar de reportando "no aplicable".

Es un cambio de orden respecto al documento maestro, que la ubicaba como Fase 3.
Registrado como ADR-004.

---

## 5 · Sobre los siete subagentes

Aplica el mismo principio: **no se crean todos de entrada.**

Un subagente sin tubería que coordinar es un archivo de configuración que nunca
se ejecuta — y como no se ejecuta, no se sabe si está mal hasta el final. Eso es
lo contrario de detectar errores temprano.

### Orden de aparición

| Momento | Agentes |
|---|---|
| Con la rebanada vertical | `analista-meta`, `validador` |
| Al agregar el cruce de fuentes | `estratega` |
| Al agregar competencia | `analista-competencia` |
| Al agregar el deck | `constructor-deck` |
| Al agregar copies | `redactor` |
| Al empezar a escribir en sistemas externos | `orquestador` |

### La excepción importante

**La separación de permisos se diseña desde la primera línea**, aunque al
principio solo existan dos agentes.

Que solo el `orquestador` escriba en sistemas externos no se puede
retro-ajustar sin reescribir la arquitectura. Y es la garantía estructural de
que un error de análisis nunca publique nada en producción. Es también donde
vive buena parte del 15% de reducción de riesgos de la evaluación.

O sea: los agentes aparecen tarde, pero **la frontera de permisos existe desde
el principio**.

---

## 6 · Lo único que sí va en paralelo

No son módulos. Son tareas del usuario que no dependen del desarrollo y que hoy
son el cuello de botella real. Esto es paralelismo verdadero: **cero costo de
integración**.

| Tarea en paralelo | Por qué no puede esperar |
|---|---|
| **Conectar Zoho CRM y Zoho Mail** en la consola de Zoho MCP | Desbloquea el Módulo 3 y la entrega del Módulo 2. Es trabajo en una consola externa, inaccesible desde esta sesión. |
| **Medir la línea base** — cronometrar la próxima preparación de reunión a la antigua | Es el respaldo del 25% de ahorro de tiempo, y **solo se puede capturar antes de automatizar**. Si esa reunión ocurre esta semana, es ahora o nunca. |
| **Recopilar la materia prima de `contexto-marca`** y los destinatarios de los reportes | Sin esto los copies salen genéricos, como advierte el propio documento |

**Esas tres cosas en paralelo valen más que tres módulos en paralelo.**

---

## Resumen de la decisión

> Secuencial en los módulos. Vertical antes que horizontal. Los agentes aparecen
> cuando la tubería los necesita, pero la frontera de permisos existe desde el
> primer día. Y lo que corre en paralelo son las gestiones del usuario, no el
> código.

Registrado como ADR-003.
