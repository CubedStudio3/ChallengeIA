# Línea base · mediciones antes / después

**Estado: SIN DATOS.** Este archivo es una plantilla con su método definido.
Ningún número se anota aquí sin registrar cómo se obtuvo.

**Peso en la evaluación del challenge: 25% (ahorro de tiempo) + 10% (evidencia).**

---

## Por qué este archivo importa más de lo que parece

El 25% de la evaluación depende de una comparación antes/después. Hoy el "antes"
es la frase *"preparar una reunión creativa cuesta de 3 a 4 horas"*, y no consta
cómo se midió.

Un proyecto cuya regla central es **cero datos inventados** no puede presentar su
métrica estrella como una estimación de memoria. Si un evaluador pregunta *"¿cómo
midieron las 3 a 4 horas?"*, debe haber una respuesta.

**Y hay una restricción de tiempo irreversible: el "antes" solo se puede medir
antes de automatizar.** Una vez que el sistema funcione, esa medición ya no se
puede tomar — solo reconstruir de memoria, que es justo lo que hay que evitar.

---

## Medición del ANTES · pendiente

### Qué hay que capturar

| Campo | Estado |
|---|---|
| Fecha de la medición | ⬜ |
| Quién realizó el trabajo medido | ⬜ |
| Quién tomó el tiempo | ⬜ |
| Instrumento (cronómetro, registro de calendario, bitácora) | ⬜ |
| Tiempo total | ⬜ |

### Desglose por paso · el más importante

No sirve solo el total. Para argumentar el ahorro hay que saber **qué pasos
absorbe el sistema** y cuáles siguen siendo humanos. Un total de 3.5 horas del
que el sistema solo puede quitar 40 minutos es un ahorro muy distinto al que
sugiere la cifra global.

| Paso del proceso manual actual | Tiempo | ¿Lo absorbe el sistema? |
|---|---|---|
| Extraer rendimiento de Meta Ads | ⬜ | Sí (Módulo 1, paso 2) |
| Revisar anuncios de competidores | ⬜ | Sí (Módulo 1, paso 3) |
| Capturar métricas orgánicas | ⬜ | **No** — sigue siendo manual |
| Cruzar datos y detectar patrones | ⬜ | Sí (Módulo 1, paso 5) |
| Revisar qué se recomendó la semana pasada | ⬜ | Sí (Módulo 1, paso 6) |
| Calcular el plan de producción | ⬜ | Sí (Módulo 1, paso 7) |
| Armar la presentación | ⬜ | Sí (Módulo 1, paso 8) |
| Buscar referencias visuales / moodboard | ⬜ | Parcial |
| Conducir la reunión | ⬜ | **No** |
| Crear las tareas acordadas | ⬜ | Sí (Módulo 1, paso 9) |

### Otros procesos a medir

| Proceso | Tiempo actual | Estado |
|---|---|---|
| Atender una solicitud de arte (entrada → registro) | ⬜ | Módulo 2 |
| Armar el reporte diario de leads | ⬜ | Módulo 2 |
| Armar el reporte mensual de pauta | ⬜ | Módulo 2 |

---

## Medición del DESPUÉS · pendiente

### Qué hay que instrumentar, y desde cuándo

**Desde la primera corrida real**, no al final. Si se deja para el 6 de
septiembre habrá que reconstruirlo, con el mismo problema que el "antes".

| Métrica | Cómo se captura |
|---|---|
| Duración de la corrida automática | Registro de la corrida en `data/historico/` |
| Tiempo humano restante antes de la reunión | Medición manual, una vez |
| Duración de la reunión creativa | Medición manual, comparable con el antes |
| Intervenciones humanas necesarias | Contador en el registro de la corrida |
| Corridas que abortaron y por qué | Registro de errores |

### Métrica secundaria de valor · calidad, no solo tiempo

El ahorro de tiempo no es el único valor. Vale la pena capturar dos cosas que el
proceso manual no producía en absoluto:

- **Trazabilidad:** porcentaje de números del plan que citan su dato de origen.
  En el proceso manual esto era esencialmente 0%.
- **Loop de verificación:** cuántas recomendaciones de la semana anterior se
  ejecutaron y qué pasó con su métrica. En el proceso manual no se medía.

---

## Reglas de este archivo

1. Ningún número sin su método de obtención al lado.
2. Si una medición es una estimación, **se marca como estimación**, no se
   presenta como medición.
3. Si un dato no se pudo capturar, se anota como no capturado y por qué. No se
   deja el renglón vacío ni se rellena con un promedio.
