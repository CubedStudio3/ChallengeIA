---
name: analisis-creativo
description: Corrida semanal completa del Módulo 1 · Mesa Creativa. Produce la base estratégica de la reunión creativa a partir de rendimiento de pauta, competencia activa y métricas orgánicas. Úsala cuando toque preparar la reunión creativa, generar el deck semanal, o ejecutar una corrida retroactiva sobre un periodo pasado.
---

# Corrida semanal · Mesa Creativa

Produce la base estratégica de la reunión creativa: qué rindió, qué hace la
competencia, qué pasó con lo recomendado la semana anterior, y un plan de
producción donde **cada cantidad cita el dato que la justifica**.

## Antes de empezar

```bash
python3 src/base/verifica_permisos.py
```

Si reporta violaciones, **detente**. Significa que un agente de análisis puede
escribir en un sistema externo, y eso rompe la garantía de que un error de
análisis no toque producción.

Determina el periodo. La corrida del lunes analiza la **semana anterior cerrada**,
nunca la semana en curso — daría datos parciales.

```python
from base.convenciones import semana_anterior_a, id_semana
rango = semana_anterior_a(date.today())
```

Si `Corrida.existe(rango)` ya devuelve verdadero, esta corrida ya se hizo.
Reejecutar sobrescribe el mismo directorio, no duplica. Eso es intencional.

## Paso 1 · Integridad (agente `validador`)

Comprueba antes de leer nada de fondo: rango cerrado, coherencia
`gasto ÷ resultados`, indicadores presentes, países dentro de los declarados.

## Paso 2 · Rendimiento de pauta (agente `analista-meta`)

`ads_get_ad_entities` a nivel campaña, con `time_range` cerrado y
`breakdowns: ["country"]`. Campos mínimos: `id`, `name`, `results`,
`cost_per_result`, `spend`, `impressions`.

Volcá la respuesta **cruda** a `data/historico/<id>/crudo/meta_campanas_por_pais.json`
junto con los parámetros usados. Ese archivo es la evidencia auditable.

**No infieras el mercado del nombre de la campaña.** Está comprobado que falla.

## Paso 3 · Competencia (agente `analista-competencia`)

Por cada competidor de `config/competidores.json` con `page_id` validado, y por
cada mercado declarado: `ads_library_search` con `page_ids`, `ad_active_status:
"ACTIVE"` y `countries`.

Para un anunciante diversificado (`_politica_solapamiento: "medido"`), mide el
solapamiento combinando `page_ids` con `search_terms` y guárdalo como
`_solapamiento_medido` en el crudo. Si no lo mides, el código aborta — a propósito.

**Recuerda que la Ad Library no acepta fechas.** En una corrida retroactiva este
paso **se omite** y se declara como hueco: no se puede saber qué anunciaba un
competidor en junio.

## Paso 4 · Métricas orgánicas (captura manual)

No vienen por API en esta configuración. Se esperan en
`crudo/organico.json`.

Si no están: **la corrida procede** solo con pauta y competencia, y declara el
hueco en la portada del deck (ADR-002). No se estima, no se promedia, no se
copia de la semana anterior.

El sistema debe **pedirlas el viernes anterior**, no descubrir el hueco el lunes.

## Pasos 5, 6 y 7 · Análisis, verificación y plan (agente `estratega`)

```bash
cd src && python3 -m modulo1.corre \
  --corrida ../data/historico/<id> \
  --hoy <YYYY-MM-DD> --desde <YYYY-MM-DD> --hasta <YYYY-MM-DD> --dry-run
```

Esto agrupa por indicador, detecta hallazgos, consulta la corrida anterior para el
loop de verificación y arma el plan. Escribe `analisis/resultado.json`.

Si no hay corrida previa, el paso 6 reporta **"no aplicable, primera corrida"** y
continúa. Eso no es un dato faltante.

## Paso 8 · Deck (agente `constructor-deck`)

```bash
node src/modulo1/deck.js data/historico/<id>/analisis/resultado.json \
  salidas/MesaCreativa_<id>.pptx
```

QA obligatorio: `validate.py`, `markitdown` buscando placeholders, y **renderizar
a imágenes para mirar cada lámina**. El primer render casi siempre tiene un
defecto real.

## Paso 8b · Tablero de revisión (agente `constructor-deck`)

```bash
node src/modulo1/tablero.js data/historico/<id>/analisis/resultado.json \
  salidas/tablero-mesa-creativa.html
```

Luego se publica como artefacto **con la misma URL** para no crear uno nuevo cada
semana. El equipo abre ese enlace y ahí aprueba las tareas.

El tablero lleva el orden invertido respecto al deck, a propósito: el deck se
presenta en la reunión y construye narrativa; el tablero se **opera**, así que la
decisión va arriba y la evidencia debajo.

Declara `capabilities: {artifact: {}}` — es lo que permite que las aprobaciones
del equipo persistan y se compartan entre quienes abren la página.

## Paso 9 · Tareas en Sprint (agente `orquestador`, después de la reunión)

Solo sobre las tareas que el equipo **aprobó en el tablero**. **Con `--dry-run`
primero.** Cada work item lleva la clave de idempotencia de su tarea
(`<id_corrida>::<tipo>::<titulo>`) para que dos corridas no dupliquen.

Las tareas propuestas ya vienen derivadas en `resultado.json`, y su traducción no
es uno a uno: una recomendación **cuantificada** produce una tarea de acción; una
recomendación **sin dato** produce la tarea de *conseguir el dato*, nunca una
acción. Convertir un hueco en acción sería el salto que el proyecto prohíbe.

## Lo que esta skill nunca hace

- Rellenar un dato faltante con una estimación, un promedio o el valor de la
  semana anterior.
- Sumar `results` entre indicadores distintos.
- Convertir `Not available` o `mixed` en cero.
- Usar un rango de fechas móvil.
- Escribir en Meta Ads, ni siquiera en estado pausado.
- Publicar un copy sin aprobación humana.
- Presentar aritmética sobre el periodo medido como si fuera un pronóstico.
