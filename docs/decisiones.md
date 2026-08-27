# Registro de decisiones técnicas (ADR)

Cada decisión técnica no obvia se registra aquí con su porqué, conforme a las
reglas de proceso del documento maestro.

**Formato:** contexto → decisión → razón → consecuencias → estado.

---

## ADR-001 · La estructura va en la raíz del repositorio

**Fecha:** 2026-08-27 · **Estado:** aceptada

**Contexto.** El documento maestro dibuja la estructura bajo una carpeta
`mesa-creativa/`. El repositorio real se llama `ChallengeIA`.

**Decisión.** La estructura se coloca en la raíz del repositorio, sin subcarpeta
intermedia.

**Razón.** Una carpeta `mesa-creativa/` dentro de un repo llamado `ChallengeIA`
añade un nivel de anidamiento sin aportar información. El nombre del repositorio
ya cumple esa función.

**Consecuencias.** Todas las rutas del documento maestro se leen relativas a la
raíz: `config/`, `src/`, `docs/`, `data/`, `salidas/`, `.claude/`.

**Reversible:** sí, con un `git mv`, mientras no haya código que dependa de las
rutas.

---

## ADR-002 · El orgánico es un insumo opcional con degradación declarada

**Fecha:** 2026-08-27 · **Estado:** ⚠️ PROPUESTA — requiere decisión del usuario

**Contexto.** Contradicción C1. Las métricas orgánicas requieren captura manual.
La Regla 3 obliga a detenerse ante un dato faltante. Combinadas, un olvido humano
del viernes aborta la corrida del lunes, que es el entregable principal.

**Decisión propuesta.** El orgánico es un insumo **opcional**. Si no está, la
corrida procede solo con datos de pauta y **declara el hueco explícitamente** en
la portada del deck y en el registro de la corrida.

**Razón.** Declarar un hueco no es inventar un dato: cumple la regla de cero
datos inventados. Y protege el entregable del que depende la evaluación de un
fallo humano previsible.

La alternativa —abortar— exigiría reescribir la Definición de terminado #1, que
hoy dice "sin intervención manual".

**Consecuencias.**
- El deck debe tener un mecanismo de declaración de huecos en portada.
- El registro de la corrida marca qué fuentes estuvieron disponibles.
- Las recomendaciones que **dependían** del orgánico no se emiten; no se emiten
  degradadas. Un plan sin justificación de dato no se publica.

**Pendiente:** confirmación del usuario. Ver `docs/06-requerimientos-usuario.md`
punto 11.

---

## ADR-003 · Desarrollo secuencial con rebanada vertical primero

**Fecha:** 2026-08-27 · **Estado:** aceptada (a confirmar por el usuario)

**Contexto.** El usuario preguntó si conviene desarrollar los tres módulos en
paralelo para detectar errores antes.

**Decisión.** Secuencial. Y antes del Módulo 1 completo, una **rebanada vertical
delgada** que atraviese todas las capas: leer Meta → normalizar → persistir
artefacto trazable → generar deck de 3 diapositivas.

**Razón.**
1. El paralelismo no es materialmente posible: los Módulos 2 y 3 tienen bloqueos
   externos duros (Mail y CRM ausentes).
2. Sobre una base compartida inexistente, el paralelismo produce convenciones
   divergentes cuyos errores solo aparecen al integrar — alrededor del 3 o 4 de
   septiembre, sin margen.
3. La detección temprana de errores se logra con profundidad, no con ancho. La
   rebanada prueba los cuatro riesgos mayores en el día 2.

**Consecuencias.** Ver `docs/05-estrategia-ejecucion.md` para el orden completo.

---

## ADR-004 · Las corridas retroactivas se adelantan

**Fecha:** 2026-08-27 · **Estado:** aceptada

**Contexto.** El documento maestro ubica la evidencia retroactiva como Fase 3,
después del Módulo 1. Pero el paso 6 del Módulo 1 (verificar lo recomendado la
semana anterior) no tiene historial contra el cual verificar en su primera
corrida real.

**Decisión.** Las corridas retroactivas se ejecutan **inmediatamente después** de
que el Módulo 1 pueda producirlas, y antes de la primera corrida semanal real.

**Razón.** Así la primera corrida real sí tiene historial: el loop de
verificación se demuestra funcionando en lugar de reportando "no aplicable". Y la
evidencia del Demo Day queda lista antes, no en los últimos días.

**Consecuencias.** El paso 6 debe distinguir explícitamente entre "dato faltante"
(error → detenerse) y "primera corrida, no aplicable" (estado válido → continuar).

---

## ADR-005 · El Módulo 2 detecta cambios por sondeo, no por eventos

**Fecha:** 2026-08-27 · **Estado:** aceptada (forzada por la plataforma)

**Contexto.** Zoho Sprint no expone webhooks ni suscripciones (hallazgo P5). El
Módulo 2 requiere reaccionar a cambios de estado y a aprobaciones de artes.

**Decisión.** Sondeo periódico contra Sprint, con estado persistido de la última
pasada.

**Razón.** No hay alternativa en la plataforma.

**Consecuencias.**
- Latencia de hasta un ciclo de sondeo entre el cambio real y el aviso.
- El estado persistido es lo que garantiza la **idempotencia**: sin él, dos
  pasadas avisarían dos veces del mismo cambio, violando la regla de operaciones
  idempotentes.
- Hay que decidir la frecuencia del sondeo (pendiente, depende del runtime).

---

## ADR-006 · Los subagentes aparecen cuando la tubería los necesita

**Fecha:** 2026-08-27 · **Estado:** aceptada

**Contexto.** El documento define siete subagentes. Crearlos todos antes de que
exista la tubería produce configuración que nunca se ejecuta.

**Decisión.** Los agentes se crean incrementalmente, en el orden en que la
tubería los requiere. **Con una excepción no negociable: la frontera de permisos
—solo `orquestador` escribe en sistemas externos— se diseña desde la primera
línea de código.**

**Razón.** Un agente que no se ejecuta no se puede verificar. Pero la frontera de
permisos no se puede retro-ajustar sin reescribir, y es la garantía estructural
de que un error de análisis no publique en producción.

**Consecuencias.** Ver el orden de aparición en
`docs/05-estrategia-ejecucion.md`, sección 5.

---

## ADR-007 · Convención de escritura de prueba en sistemas reales

**Fecha:** 2026-08-27 · **Estado:** ❌ RECHAZADA en su parte de Meta — **superada por ADR-012**

> **Nota:** la parte de esta propuesta que contemplaba crear una campaña de
> prueba en Meta Ads fue rechazada por el usuario el 2026-08-27. Meta Ads pasa a
> solo lectura. Lo que sigue vale únicamente para Zoho Sprint y Zoho Social.
> Ver ADR-012.

**Contexto.** Contradicción C7. La Verificación 1 exige una escritura de prueba;
las reglas prohíben escribir en producción. Meta no ofrece sandbox: la cuenta
`225318458221662` es producción.

**Decisión propuesta.** Toda escritura de prueba en un sistema real cumple:

| Regla | Detalle |
|---|---|
| Estado | `PAUSED` desde la creación, sin excepción |
| Presupuesto | el mínimo que permita la plataforma |
| Nombre | prefijo obligatorio `[TEST-MC]` |
| Activación | **jamás**, bajo ninguna circunstancia |
| Registro | todo objeto creado se anota en `docs/validaciones.md` con su ID |
| Limpieza | los objetos de prueba se eliminan al cerrar la Fase 0 |

Lo mismo aplica a Zoho Sprint (proyecto de prueba dedicado) y Zoho Social
(borradores con `isApprovalNeeded: true`, nunca publicación directa).

**Razón.** Es la única forma de cumplir el espíritu de la regla —no afectar
producción— cuando la letra ("usa una campaña de prueba") es imposible de
cumplir literalmente.

**Pendiente:** autorización expresa. No se crea nada sin ella.

---

## ADR-008 · X/Twitter queda excluido de la automatización

**Fecha:** 2026-08-27 · **Estado:** aceptada

**Contexto.** El esquema de Zoho Social advierte que publicar en X vía MCP puede
hacer que la cuenta sea marcada como bot y **terminada** (hallazgo P9).

**Decisión.** X/Twitter se excluye de toda automatización de publicación. Si el
área publica ahí, se hace manualmente.

**Razón.** El riesgo es la pérdida de la cuenta. No hay beneficio de
automatización que lo justifique.

**Consecuencias.** `programar-post` debe rechazar explícitamente la red
`twitter` en lugar de intentarlo y fallar.

---

## ADR-009 · Los archivos de configuración declaran su estado de verificación

**Fecha:** 2026-08-27 · **Estado:** aceptada

**Contexto.** Al crear la estructura del repositorio surge la tentación de
poblar `config/convenciones.json` con la convención de fechas propuesta. Pero esa
convención **no está verificada** (V0 no se ha ejecutado).

**Decisión.** Todo archivo de `config/` incluye un campo `_estado` por valor o
por bloque, con uno de: `VERIFICADO`, `NO_VERIFICADO`, `PENDIENTE_DE_DATO`. Los
bloques no verificados llevan además `_lock: true`.

**Razón.** Escribir una convención sin verificar como si fuera un hecho es
exactamente el modo de falla que el proyecto prohíbe: un dato que genera
confianza injustificada. El caso $70.74 nació de confiar en una convención que
nadie había probado.

**Consecuencias.** El código debe **rechazar** consumir un bloque con
`_lock: true` y detenerse con un mensaje claro. Eso convierte la regla de
documentación en una barrera ejecutable, no en una nota de buena intención.

---

## ADR-010 · Persistencia de la trazabilidad
**Fecha:** 2026-08-27 · **Estado:** 🔲 SIN RESOLVER — se decide en Fase 1

**Contexto.** Riesgo E. *"Cada número del plan debe ser trazable hasta su dato de
origen"* implica guardar la respuesta cruda de cada consulta, no solo el número
derivado.

**Preguntas abiertas.**
- ¿Dónde se persiste la respuesta cruda? ¿Con qué esquema de nombres?
- ¿Cómo se relaciona un número del deck con la consulta que lo produjo? ¿Un ID
  de consulta citado en la nota al pie?
- ¿Cuánto crece con 8–10 corridas retroactivas más las semanales?
- ¿Se versiona en git o queda fuera con `.gitignore`?

**Por qué no se decide ahora.** Depende de los resultados de la Fase 0 (qué
fuentes existen realmente) y del runtime elegido (dónde puede escribir).

**Cuándo se decide.** Fase 1, como parte de las interfaces de la base compartida.
**No se improvisa al implementar el Módulo 1.**

---

## ADR-011 · Contexto conversacional en las llamadas al Meta MCP
**Fecha:** 2026-08-27 · **Estado:** 🔲 SIN RESOLVER — requiere decisión

**Contexto.** Hallazgo P7 / contradicción C8. El Meta MCP exige
`advertiser_request` con las palabras textuales del anunciante en cada llamada.
En una corrida automática desatendida no existe tal frase.

**Opciones a evaluar.**
1. Que la corrida programada arranque desde una instrucción persistida que el
   usuario escribió una vez, y se cite esa.
2. Que la corrida automática solo haga lo que no requiera el campo, y lo demás
   quede para sesiones interactivas.
3. Otra, según lo que revele la Verificación 7.

**Por qué no se decide ahora.** Depende de si el runtime autentica (V7) y de cómo
se comporte el conector en ese contexto. Decidirlo antes sería un supuesto.

**Riesgo si se ignora:** afecta directamente el 25% de uso agéntico.

---

## ADR-012 · Meta Ads es solo lectura

**Fecha:** 2026-08-27 · **Estado:** ACEPTADA — instrucción directa del usuario
**Supera:** la parte de ADR-007 relativa a Meta

**Contexto.** ADR-007 proponía crear una campaña de prueba en estado `PAUSED`
en la cuenta `225318458221662` para verificar los Términos de Servicio de Lead
Generation (V1), con autorización previa y sin activarla nunca.

El usuario instruyó explícitamente que **no se publique ni se cree nada en Meta
Ads**, y que el conector se use únicamente para obtener información.

**Decisión.** Meta Ads es **solo lectura**, sin excepciones:

- No crear campañas, conjuntos de anuncios ni anuncios.
- No modificar presupuestos, objetivos, segmentaciones ni estados.
- No subir conversiones ni eventos offline.
- **La prohibición incluye el estado pausado.** Un objeto pausado sigue siendo un
  objeto creado en una cuenta de producción.

**Razón.** El beneficio de la escritura de prueba era verificar los ToS. Ese
mismo dato se obtiene en dos minutos revisando Meta Business Manager, con cero
riesgo y sin crear nada. El riesgo no se justificaba.

Además, esto **no es una desviación del documento maestro**: su contingencia
para la Verificación 1 ya decía *"el agente no ejecuta: crea la tarea en Sprint
con la instrucción exacta y un humano la aplica"*. La decisión adopta esa
contingencia como el modo normal de operación, no como plan B.

**Consecuencias.**

1. **V1 cambia de método.** Ya no se sondea ni se escribe. El usuario verifica en
   Business Manager y reporta el resultado, que se registra en
   `docs/validaciones.md` citando la fuente.
2. **C4 queda sin resolver, y así se queda.** No se puede probar si
   `ads_create_ad_set` funciona sin llamarla. El conocimiento heredado del
   documento maestro ("los ad sets no se crean por la API del MCP") se mantiene
   como supuesto declarado, marcado como no verificado. Se documenta la
   incertidumbre en lugar de resolverla con una escritura.
3. **El Módulo 3 cambia de forma.** Su función central —devolver a Meta cuáles
   leads cerraron— es una escritura. Con este límite el módulo puede *calcular*
   qué habría que cargar y dejarlo como instrucción para un humano, pero no
   cerrar el circuito por sí mismo. Ya estaba bloqueado por la ausencia de Zoho
   CRM, así que en la práctica no altera el plan inmediato.
4. **Patrón general para toda acción que requiera escritura en Meta:** el agente
   redacta la instrucción exacta, la registra como work item en Sprint, y un
   humano la aplica. El agente nunca ejecuta.

**Reversible:** sí, pero solo con instrucción explícita del usuario. No se asume
por conveniencia ni porque una verificación resulte incómoda de otra forma.

---

## ADR-013 · `results` no es una métrica común: agrupar por indicador

**Fecha:** 2026-08-27 · **Estado:** ACEPTADA — impuesta por la evidencia de V0

**Contexto.** V0 reveló que el campo `results` de la API trae un
`results.indicator` que **cambia por campaña**. En la cuenta hoy conviven al
menos cinco indicadores distintos: `actions:lead`, `actions:link_click`,
`custom_event...fb_pixel_custom.QualifiedLead`,
`actions:offsite_conversion.fb_pixel_complete_registration`, y `mixed`.

**El riesgo concreto.** Sumar `results` entre campañas produce un número sin
significado. 158 leads más 10,771 clics en enlace no son 10,929 de nada. Y
promediar sus `cost_per_result` mezcla $2.10 por lead con $0.01 por clic.

Este es un modo de falla **más peligroso** que el del $70.74, porque el
resultado no se ve absurdo: se ve como un número plausible. Un CPL "promedio"
de $0.09 pasaría cualquier revisión visual y estaría completamente mal.

**Decisión.** Toda lectura de `results` o `cost_per_result`:

1. **Agrupa por `results.indicator` antes de comparar o agregar.** Nunca se
   suman ni promedian valores de indicadores distintos.
2. **Trata `mixed` como hueco declarado, no como dato.** Una campaña con
   indicador `mixed` agrega tipos de resultado distintos internamente y su
   número no es interpretable.
3. **Trata `Not available` como hueco, nunca como 0.** La API es honesta cuando
   no tiene el dato; convertirlo a cero inventaría información.
4. **Todo agregado declara su indicador.** Un entregable nunca dice "370 leads":
   dice "370 resultados con indicador `actions:lead` en 4 campañas".

**Consecuencia sobre el Módulo 1.** El paso 5 (cruzar datos y detectar qué
formato y ángulo rinde) solo puede comparar dentro de un mismo indicador. Si el
módulo quiere comparar formato de video contra imagen estática, ambos tienen que
venir de campañas con el mismo indicador, o la comparación es inválida.

**Consolidado válido observado (1–24 ago 2026, solo `actions:lead`, gasto > 0):**
370 resultados · $964.78 gastado · $2.61 por resultado · brecha de 2.33x entre
la campaña más barata ($1.90) y la más cara ($4.43).
