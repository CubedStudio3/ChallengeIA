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
---

## ADR-014 · El agente adquiere, Python computa

**Fecha:** 2026-08-27 · **Estado:** ACEPTADA — resuelve ADR-010

**Contexto.** Los conectores MCP están disponibles para el agente, no para un
proceso de Python. Un `.py` no puede invocar `ads_get_ad_entities`. Había que
decidir dónde vive cada capa.

**Decisión.** Cuatro capas con una frontera explícita:

| Capa | Quién | Qué hace |
|---|---|---|
| Adquisición | el agente, vía MCP | Llama a las APIs y vuelca la respuesta **cruda** |
| Trazabilidad | `data/historico/<corrida>/crudo/` | El JSON sin editar. La evidencia auditable |
| Cómputo | Python puro | Normaliza, analiza, arma el plan. **Sin red** |
| Presentación | Node + pptxgenjs | Lee el `resultado.json`. Sin red |
| Escritura externa | solo `orquestador` | Sprint y Social |

**Razón.** Hace la frontera de permisos **real** en lugar de declarativa: los
agentes de análisis reciben herramientas de lectura y de archivos, nunca las de
escritura. Y como el cómputo es puro sobre archivos en disco, la corrida es
reproducible: se puede ejecutar mil veces sobre los mismos datos y dar lo mismo.

**Consecuencia práctica.** El generador del deck no puede inventar nada: solo
puede mostrar lo que está en el `resultado.json`, que a su vez solo contiene lo
derivado del crudo. La trazabilidad es estructural, no una convención.

---

## ADR-015 · El QA visual del deck exige instalar Impress

**Fecha:** 2026-08-27 · **Estado:** ACEPTADA

**Contexto.** El entorno traía `libreoffice-core` y `libreoffice-common` pero
**ningún filtro de documentos** — ni Impress ni Writer. Cualquier conversión
fallaba con "source file could not be loaded", incluso de un `.txt`. Sin
conversión no hay imágenes, y sin imágenes no hay QA visual.

**Diagnóstico que evitó una conclusión falsa.** El primer instinto fue culpar al
deck generado. Se descartó generando un `.pptx` trivial de una sola caja de
texto: también falló. Eso movió la causa del archivo al entorno.

**Decisión.** El QA visual del deck requiere `libreoffice-impress` y
`poppler-utils` instalados. Se documenta como dependencia del proyecto, no como
accidente de una sesión.

**Consecuencia.** Un entorno nuevo debe instalarlos antes de poder validar
visualmente un deck. La validación de estructura (`validate.py`) y de contenido
(`markitdown`) sí funcionan sin ellos, pero no detectan solapamientos ni
desbordes: eso solo se ve renderizando.

---

## ADR-016 · Las métricas orgánicas SÍ vienen por API, salvo el alcance

**Fecha:** 2026-08-28 · **Estado:** ACEPTADA · **Corrige:** una trampa heredada

**Contexto.** El documento maestro y las trampas heredadas afirmaban que «las
métricas orgánicas de Página e Instagram no vienen por API en esta configuración»
y que había que capturarlas a mano. El código incluso declaraba el hueco y pedía
un `crudo/organico.json` inexistente.

**Qué se midió.** `ZohoSocial_getSocialPublishedPosts` sobre el portal 683127178,
marca 719804000000018021, en las cinco redes conectadas.

**Resultado.** Devuelve las publicaciones con sus métricas nativas:

| Red | Qué devuelve |
|---|---|
| Facebook | `reactions.summary.total_count`, `comment_count` |
| Instagram | `like_count`, `comment_count` |
| LinkedIn | `like_count`, `comment_count` — **cero en los 25 posts** |
| TikTok | `view_count`, `like_count`, `comment_count`, `share_count` |
| YouTube | `view_count`, `like_count`, `comment_count`, `dislike_count` |

**Decisión.** La adquisición de orgánico pasa a ser automática. Se retira el
requisito de captura manual **para interacciones**, y se mantiene **solo para
alcance**.

**Los tres límites que quedan, declarados y no rellenados.**

1. **No hay alcance ni impresiones orgánicas** en ninguna de las cinco redes.
   Sin alcance no hay tasa de engagement, así que el sistema **no la calcula**.
   Interacciones absolutas sí; porcentajes no.
2. **No hay desglose por mercado.** El portal tiene UNA marca y una cuenta por
   red: GT y SV comparten audiencia orgánica. El corte GT/SV que sí existe en
   pauta aquí **es imposible**, no es un dato faltante. Repartirlo a ojo lo
   inventaría.
3. **LinkedIn devuelve 0 en todo.** Es indistinguible entre cero real y campo no
   soportado por el conector. Se aplica la regla que ya gobierna `Not available`
   y `mixed`: un hueco no es un cero. LinkedIn queda **fuera del total** de
   interacciones en lugar de sumar ceros con apariencia de medición.

**Lección que se repite.** Es la segunda vez en este proyecto que un «no se
puede» heredado resulta falso al ir a preguntarlo — la primera fueron los cinco
conectores «inexistentes» que solo estaban apagados. Ausencia de evidencia no es
evidencia de ausencia.

---

## ADR-017 · Un referente no es un competidor, y se cuentan aparte

**Fecha:** 2026-08-28 · **Estado:** ACEPTADA

**Contexto.** El usuario pidió separar la sección de competencia en *referentes*
(Square, Shopify) y *competencia* (Paggo, Recurrente, GuatePOS). No es solo
organización visual: al medirlo, Square tiene **0 anuncios activos en GT y SV**.

**Decisión.** `config/competidores.json` declara un `_rol` por marca, y
`PanoramaCompetitivo.presion_total` **suma únicamente competidores**.

**Razón.** Meter a Square en el conteo de presión competitiva inventaría una
amenaza que la medición dice que no existe. Es la misma clase de error que sumar
los 845 anuncios de Banco Industrial: un número que parece medido y no lo es.

**Consecuencia.** La presión real de GT sigue siendo 42. Square aparece en su
propia pestaña, con la lectura correcta: no disputa territorio, sirve como
referencia creativa.

---

## ADR-018 · La Ad Library no mide efectividad, y el tablero no finge que sí

**Fecha:** 2026-08-28 · **Estado:** ACEPTADA

**Contexto.** El usuario pidió ver, por marca, el «top de anuncios efectivos» de
la competencia. Ese dato **no es público**: la Ad Library no publica rendimiento
de anunciantes comerciales — no hay impresiones, ni gasto, ni conversiones.

**Decisión.** No se entrega un ranking de efectividad. Se entrega un proxy con
las señales que sí son observables, rotulado como lo que es:

- **repeticiones** — cuántas veces duplicó el mismo mensaje. Duplicar cuesta
  dinero, así que repetir es una apuesta declarada.
- **días vivo** — cuánto lleva activo el más viejo con ese mensaje. Un mensaje
  que sigue arriba es un mensaje que no mataron.
- **días desde el último** — cuándo lo relanzaron por última vez.

Cada tarjeta lleva la advertencia explícita de que no es efectividad, y un
enlace a la Ad Library para que una persona vea los creativos reales.

**Defecto encontrado y corregido en el camino.** La cuota del titular dominante
se calculaba sobre los anuncios con título legible (23/23 = **100%**) mientras el
resto del reporte usaba el total de anuncios (23/31 = **74%**). Dos cifras del
mismo hecho en el mismo reporte, y el lector sin forma de saber cuál creer. Ahora
ambas usan el total de anuncios observados.

**Y una distinción que faltaba.** «Sin titulares legibles» y «no se guardó
muestra» no son lo mismo. Banco Industrial tiene 845 activos y su crudo guarda
`ads: []`, porque de él solo se midió el solapamiento sobre el universo completo.
Decir «sin titulares legibles» sugeriría que miramos y no había. El tablero ahora
dice que no se leyeron titulares, y con qué método se midió.

---

## ADR-019 · La asignación a Sprint se apaga en vez de inventar nombres

**Fecha:** 2026-08-28 · **Estado:** ACEPTADA

**Contexto.** El usuario pidió que una tarea aceptada se pueda asignar en Sprint
a la persona responsable. `ZohoSprints_CreateItem` sí acepta un parámetro `users`
(«User IDs of the users who will work on the item»), así que la asignación es
posible. Lo que **no** se puede es obtener la lista de personas: `GetProjects`
exige un `teamId` y no existe ninguna operación que liste los espacios de trabajo
entre las ~75 del conector.

**Decisión.** `config/equipo.json` nace bloqueado (`_lock: true`). Mientras lo
esté, el tablero muestra el selector de responsable **apagado, con el motivo y
los pasos para desbloquearlo**, en lugar de una lista de nombres inventados.

**Puerta de salida a ADR-009.** Para poder *reportar* el bloqueo hay que leer el
archivo bloqueado, y ADR-009 lo prohíbe. Se añadió `cargar(...,
permitir_bloqueado=True)`, con una regla escrita en su docstring: sirve para
mostrar el hueco, nunca para consumir valores de adentro como si estuvieran
verificados.

**Y una frontera que no se movió.** Aceptar una tarea en el tablero **no la crea
en Sprint**. La crea el agente `orquestador` en el paso 9, que sigue siendo el
único que escribe en sistemas externos (regla 4), y con `--dry-run` antes. El
tablero registra la decisión; no ejecuta la escritura.

---

## ADR-020 · Referencias visuales: búsquedas, nunca pines inventados

**Fecha:** 2026-08-28 · **Estado:** ACEPTADA

**Contexto.** El usuario pidió «links de pinterest de videos y posts y artes».
No hay conector de Pinterest en la sesión, y Pinterest tampoco figura entre los
canales conectados del portal de Zoho Social (verificado: facebookpage,
linkedinpage, instagram, youtube, tiktok).

**Decisión.** La sección entrega **URLs de búsqueda**, no referencias curadas.
Una URL de búsqueda es determinista y cualquiera la puede abrir y juzgar; una URL
de pin inventada devuelve 404 y quema la confianza en todo lo demás de la página.
Cada búsqueda va etiquetada «búsqueda sin curar» y lleva el dato del que sale.

**Consecuencia.** La curaduría del pin concreto la hace una persona. El sistema
le deja el terreno preparado y le dice por qué ese terreno.

---

## ADR-021 · El copy no se escribe; el ángulo sí

**Fecha:** 2026-08-28 · **Estado:** ACEPTADA

**Contexto.** Las tareas creativas piden «sugerencias de diseño y copies». La
skill `contexto-marca` está deliberadamente incompleta: faltan tono, claims
permitidos en fintech regulada, nombres oficiales de producto, diferenciadores
verificables y quién aprueba.

**Decisión.** Cada tarea entrega el **ángulo** (qué territorio atacar) y el **no
decir** (qué mensaje ya paga la competencia), porque ambos se deducen de la
medición. El campo de copy queda marcado `BLOQUEADO` con la lista exacta de los
cinco insumos que faltan y el archivo donde se llenan.

**Razón.** El ángulo sale del dato; el copy sale del tono de marca. Escribir el
segundo sin el insumo sería inventarlo, y en fintech regulada un claim inventado
no es un error de estilo.

**Lo mismo aplica a la cantidad de piezas.** Cuántos artes caben en una semana es
capacidad del equipo, no un dato de Meta ni de Ad Library. Si
`config/equipo.json` declara `capacidad_semanal`, se reparte; si no, la tarea
**pide el número a la mesa** en lugar de proponer uno.

---

## ADR-022 · El reporte de redes se limita a tres, y las excluidas se declaran

**Fecha:** 2026-08-28 · **Estado:** ACEPTADA

**Contexto.** El usuario pidió limitar el rendimiento de redes a Instagram,
Facebook y YouTube, quitando LinkedIn y TikTok.

**Decisión.** `config/convenciones.json` declara `redes_sociales.reportadas`. Las
excluidas **no se borran**: se siguen leyendo y su dato se reporta en un bloque
de exclusiones, igual que se hace con Honduras en pauta. Borrarlas en silencio
haría que el total pareciera completo cuando no lo es.

**Lo que se pierde, dicho para que sea una decisión y no un accidente.**

- **LinkedIn: nada medible.** Sus 25 publicaciones devuelven `like_count=0` y
  `comment_count=0` sin excepción. Ya estaba fuera del total por no ser
  verificable (ADR-016). La instrucción coincide con lo que el análisis
  recomendaba por otra razón.
- **TikTok: el hallazgo más fuerte del orgánico.** Era el canal con más vistas de
  todo lo leído — su mejor pieza llegó a 1,092 vistas — y el único caso de canal
  detenido: no publica desde 2026-07-16. **Al excluirlo, la tarea de reactivarlo
  deja de generarse**, y con ella desaparece la estrategia que se apoyaba en un
  canal callado que sí rendía.

**Consecuencia.** Es reversible en una línea: agregar `"tiktok"` a `reportadas`.
El motivo, el dato que se pierde y el remedio quedan escritos en el propio
archivo de configuración.

---

## ADR-023 · Primero la estrategia, después las tareas

**Fecha:** 2026-08-28 · **Estado:** ACEPTADA

**Contexto.** La sección de Estrategia entregaba una lista de tareas sin decir
cuál era la apuesta detrás. El usuario pidió un espacio que explique en pocas
palabras en qué consiste la estrategia y por qué es buena idea, con opción de
cambiarla — y que cambiar la estrategia cambie las tareas propuestas.

**Decisión.** El sistema deriva **estrategias candidatas**, cada una con su
premisa medida, y cada tarea declara a qué estrategias pertenece. Cambiar la
estrategia cambia el conjunto de tareas visibles.

Una estrategia **solo aparece si su premisa se cumple en los datos**. Si ningún
competidor tiene un mensaje saturado, no hay «disputar el flanco» que proponer.

**Lo que el sistema NO hace.** No elige por la mesa. Marca una como recomendada
**con la regla escrita a la vista** — gana la premisa que se apoya en más de una
señal independiente — y de cada una dice **cuándo NO conviene**. Esa última
parte es la que hace que la elección sea real: una recomendación sin su
contraparte es una orden disfrazada.

**Tres cosas que no dependen de la estrategia** y por eso se marcan `siempre`:
los cambios de configuración de pauta y las correcciones de integridad. Son
higiene; no se negocian con la apuesta creativa de la semana.

**Y una advertencia que viaja con la recomendación.** «SV tiene el mejor costo y
cero competencia medida» es una lectura del dato, **no un pronóstico**: nadie
midió qué pasa al mover el presupuesto. Además se declara el techo que no se
puede medir desde aquí — SV concentra solo el 21% de la inversión, así que
duplicar ahí mueve menos dinero absoluto que un punto de mejora en el mercado
grande.

---

## ADR-024 · Las ideas del equipo se guardan aparte de los hallazgos

**Fecha:** 2026-08-28 · **Estado:** ACEPTADA

**Contexto.** El usuario pidió un espacio de «nueva tarea» para que la mesa
agregue una idea propia si le parece mejor que lo que propone el análisis, y que
entre directo a aceptadas.

**Decisión.** Existe el formulario, y la tarea creada **se guarda y se muestra en
un grupo propio**, con la etiqueta «idea del equipo» y un campo de evidencia que
dice, textualmente, que no tiene ninguna.

**Razón.** Es la regla 1 del proyecto aplicada a la interfaz. Si una idea del
equipo se mezclara con las tareas derivadas de datos, la semana siguiente nadie
podría distinguir qué propuso el análisis y qué propuso una persona en una
reunión. La idea vale exactamente lo mismo como decisión; lo que no puede es
heredar una autoridad de evidencia que no tiene.

**Detalle que evita un enlace roto.** Del campo de referencias solo se guardan
las líneas que de verdad son una URL. Un texto pegado que no lo es se descarta y
el aviso dice cuántas líneas se ignoraron. Esta página existe para no poner
delante del equipo cosas que no se pueden verificar.

---

## ADR-025 · Dos medidas, dos gráficas — y un hueco no es un cero

**Fecha:** 2026-08-28 · **Estado:** ACEPTADA

**Contexto.** El usuario pidió ver la evolución semanal del engagement y de las
visualizaciones.

**Decisión.** Dos gráficas de líneas en SVG, sin librería. **Nunca un eje doble.**
Interacciones y vistas tienen escalas distintas (34 contra 184); un eje doble
haría que el lector compare alturas que no son comparables.

**Qué mide cada punto, dicho en la página.** La API devuelve el conteo
**acumulado** de cada publicación al día de la consulta, no una serie histórica.
Así que un punto es «las interacciones que hoy acumulan las publicaciones de esa
semana», no «las interacciones ocurridas esa semana». Sirve para comparar qué
semana produjo contenido que enganchó; **no** sirve para decir en qué semana hubo
más actividad de la audiencia.

**El defecto que se corrigió antes de publicar.** La primera versión mostraba
Facebook e Instagram con **ceros en junio**. No eran ceros: la lectura viene
topada en ~25 publicaciones por red, así que junio está fuera de la muestra. Un
cero ahí decía «no engancharon» cuando lo que pasaba era que no se leyeron. Ahora
cada serie arranca donde arranca su muestra y las semanas anteriores van como
hueco, con la línea cortada.

**Detalles de forma que no son de gusto.** Paleta validada con el validador de
`dataviz` en claro y en oscuro (las tres series pasan las seis pruebas). Líneas
de 2px, puntos con anillo del color de la superficie para que sigan legibles
donde se cruzan, rejilla hairline recesiva, y **el texto nunca lleva el color de
la serie**: la identidad la da el punto de color al lado. Se rotula **una sola
línea** al final — tres etiquetas al borde derecho se pisan cuando las series
convergen — y la leyenda más el tooltip cargan el resto. Existe vista de tabla,
así que ningún valor queda detrás del color.

---

## ADR-026 · Zoho Sprint conecta y autentica; falta un solo dato humano

**Fecha:** 2026-08-28 · **Estado:** ACEPTADA · **Corrige:** ADR-019 en un punto

**Contexto.** El conector volvió a la sesión, ahora con el nombre `Zoho_Sprints`
(en plural). Se probó de verdad, no por lectura de esquemas.

**Lo que quedó verificado.**

1. **La autenticación funciona.** Zoho devolvió su propio sobre de error
   —`{"code":7404,"message":"Given URL is wrong","status":"failed"}`— en lugar de
   un fallo de autorización. Un error estructurado del servicio significa que la
   llamada llegó y el token sirvió.
2. **El error no lo causa la cabecera.** Se repitió idéntico con
   `x-za-ui-version` en `v2` y en `v1`, así que no es la construcción de la URL.
3. **`CreateItem` exige CINCO identificadores, no dos.** `teamId`, `projectId` y
   `sprintId` en la ruta, más `projitemtypeid` y `projpriorityid` como
   parámetros obligatorios. El documento maestro suponía que bastaba el proyecto.
4. **Cuatro de los cinco se pueden leer por API** en cuanto se tenga el primero:
   `GetProjects`, `GetSprints`, `GetProjectPriorities`.
5. **El `teamId` no se puede obtener por API.** Las ~78 operaciones del conector
   lo exigen como variable de ruta y ninguna lista los espacios de trabajo.

**Dos hipótesis probadas y descartadas**, para que nadie las repita: el ID del
portal de Zoho Social (`683127178`) y el de la organización de Zoho Analytics
(`683128256`). Ambos devolvieron 7404. El `teamId` de Sprints es un ID propio.

**Decisión.** No se adivinan IDs. Se detuvo la exploración después de dos
hipótesis con fundamento en lugar de seguir probando números contra una API de
producción, que no es descubrimiento sino fuerza bruta.

**Lo que sí se construyó mientras falta ese dato.** `src/modulo1/sprint.py`
arma el plan de escritura completo y lo imprime sin tocar la red. Verificado de
extremo a extremo con IDs simulados: filtra por la estrategia elegida, incluye
solo lo aceptado, arrastra las ideas del equipo con su marca de origen, y produce
la llamada exacta a `CreateItem`. En cuanto llegue el `teamId`, el paso 9
funciona sin escribir una línea más.

**Tres cosas que el módulo se niega a hacer.**

- **Asumir que todo está aceptado.** Sin decisiones el plan sale vacío, no
  completo. La compuerta humana existe para eso (ADR-002).
- **Escribir sin confirmación de proyecto de prueba.** `--real` aborta si
  `_es_de_prueba` no es `true` (ADR-012).
- **Fallar a mitad de camino.** Comprueba los cinco IDs antes de armar nada: un
  plan que revienta en la llamada 3 de 7 deja medio Sprint escrito y rompe la
  idempotencia.

**Idempotencia, resuelta con lo que hay.** Sprint no expone webhooks ni un campo
de clave externa, así que el item lleva su marca `[MC:<clave>]` **dentro del
nombre**. El orquestador la busca con `GetItems(searchvalue=...)` antes de crear;
si la encuentra, actualiza. Dos corridas del mismo periodo no duplican (regla 7).

**El puente tablero → escritura.** El visor del artefacto bloquea cualquier
descarga que la página inicie, así que un botón de «bajar archivo» sería inerte.
El botón **Copiar decisiones** copia el JSON al portapapeles y ese JSON es lo que
consume `--decisiones`. Se copia solo la decisión, nunca el análisis: el análisis
ya vive en el `resultado.json` de la corrida, y duplicarlo abriría la puerta a
que las dos copias se desincronicen.

**Nota de mantenimiento.** El conector pasó de `Zoho_Sprint` a `Zoho_Sprints`.
Los agentes `orquestador` y `validador` apuntaban a herramientas que ya no
existen; se corrigieron y `verifica_permisos` vuelve a pasar sin violaciones.

---

## ADR-027 · El tablero se rediseña a un solo tema claro, y Tailwind se compila

**Fecha:** 2026-08-28
**Estado:** aceptada

### Contexto

Mercadeo pidió dos veces que el tablero se viera más ordenado, y la segunda vez
entregó una especificación de diseño completa: modo claro exclusivamente, fondo
`#F3F6F8`, tarjetas blancas de esquinas muy redondeadas con sombra amplia y
difusa y **sin bordes sólidos oscuros**, tipografía Inter, panel lateral solo de
iconos, saludo grande con buscador en píldora, curvas bezier suaves en lugar de
picos rígidos, **sin cuadrícula interna** en las gráficas, listas de **nunca más
de 3 o 4 elementos** con «Ver todo», y «preferiblemente usando HTML y Tailwind
CSS».

El motivo detrás de la petición fue explícito: *«que no se vea todo
amontonado»*. El diseño anterior era correcto en datos y denso en pantalla.

### Decisión

Se reescribe la capa de presentación completa siguiendo esa especificación al
pie de la letra, con **tres desviaciones deliberadas**, cada una porque seguir
la letra habría producido una página que miente:

1. **El indicador de variación (`+8.2%`) NO va en todos los KPI.** La
   especificación lo pedía en cada tarjeta de cifra. En esta corrida solo existe
   un periodo anterior con el que comparar: la serie semanal de orgánico, que da
   **+105.6 % real** (18 → 37 interacciones). En pauta **no hay corrida de la
   semana anterior**, así que un porcentaje ahí sería inventado. Las tarjetas de
   pauta llevan en su lugar el dato factual que sí se tiene (`GT $2.89 ·
   SV $1.89`). Un `+8.2 %` de adorno haría que alguien tomara una decisión sobre
   una cifra que nadie midió — regla 1 del proyecto.

2. **Los iconos del rail llevan `aria-label` y `title`.** «Sin textos largos» se
   respeta visualmente, pero un icono sin nombre accesible es un botón que un
   lector de pantalla no puede anunciar.

3. **Tailwind se compila, no se carga del CDN.** El visor permite el script de
   `cdn.tailwindcss.com`, así que la ruta fácil existía. No se usa: el tablero se
   abre en una reunión, y si ese script no baja la página no sale «un poco
   distinta», sale **sin una sola línea de CSS**. `tablero.js` corre el
   compilador sobre `tablero_app.js` y deja los ~24 KB dentro del archivo. Si
   Tailwind no está instalado, el generador **falla ruidosamente** en vez de
   escribir un tablero sin estilos.

Además, el tema deja de ser doble. `tema.js` acepta `{ soloClaro: true }`,
emite únicamente el bloque de modo claro y fija `color-scheme: light`, y el
`<body>` pinta su fondo explícitamente. Sin las tres cosas, quien abriera la
página con el sistema en oscuro vería los `<select>` negros sobre tarjetas
blancas. `colores_oscuro` se conserva en `tema.json`: volver atrás es quitar
esa opción.

### Consecuencias

- Se borra `src/modulo1/tablero_estilos.css` (491 líneas). Su trabajo lo hacen
  ahora `tablero_tailwind.css` (las clases propias) y las utilidades generadas.
- El proyecto adquiere una dependencia de desarrollo, `tailwindcss`. No es una
  dependencia de ejecución: el archivo publicado no pide nada a nadie.
- `config/tema.json` sigue siendo la fuente del color de marca y de la
  tipografía. Los **neutros** ahora son literales de la escala `slate` porque el
  usuario los pidió así por nombre. Es su decisión, y queda escrita para que no
  se lea como un descuido.
- Aparece una trampa nueva al editar: Tailwind extrae las clases leyendo texto,
  así que al partir una cadena hay que **cortar siempre en un espacio**. Partir
  `'rounded-' + '2xl'` deja la clase sin generar y no da ningún error.

---

## ADR-028 · La curva de las gráficas usa interpolación monótona

**Fecha:** 2026-08-28
**Estado:** aceptada

### Contexto

La especificación pedía «curvas bezier suaves, no picos rígidos». El primer
intento fue un spline de Catmull-Rom, que es la respuesta habitual — y está
mal por una razón que no es estética.

Un spline suave **se dispara por encima de sus propios datos**. Entre un valle y
un pico dibuja una panza que sube más alto que el pico. En una gráfica de
interacciones semanales eso significa dibujar un máximo que la semana no tuvo.
Nadie lo va a medir con una regla, pero la forma de la curva es el argumento
visual, y ese argumento sería falso.

El parche fue recortar las manijas de la bezier al rango vertical de cada tramo.
Eso sí evita el sobrepaso, pero en un pico deja la manija pegada al propio
vértice y el tramo entra recto: se recuperan exactamente los picos rígidos que
había que evitar. Se veía en la serie de Instagram del 13 de julio.

### Decisión

Interpolación cúbica monótona de **Fritsch-Carlson**. En un máximo o un mínimo
local pone la tangente horizontal — el pico sale redondeado — y garantiza por
construcción que la curva no se sale del rango de los dos puntos que une.

Suave y sin inventar un máximo que el dato no tiene. Las dos cosas a la vez, no
una a costa de la otra.

### Consecuencias

- La curva es más suave que el Catmull-Rom recortado y nunca sobrepasa.
- Un hueco (`null`) sigue cortando el trazo. Las semanas anteriores a la primera
  publicación leída de una red **no son ceros**, son semanas que no se leyeron
  (ADR-025), y eso no lo cambia ninguna interpolación.
- No se toca la regla de dos gráficas separadas: interacciones y vistas siguen
  en ejes propios. Un eje doble seguiría siendo una comparación falsa.

---

## ADR-029 · Escritura por API verificada, y la forma exacta de `users`

**Fecha:** 2026-08-31
**Estado:** aceptada

### Contexto

`CreateItem` nunca se había ejecutado. Todo el paso 9 estaba escrito contra un
contrato que solo se conocía por la documentación del conector. Mercadeo autorizó
una escritura de prueba en el proyecto real.

### Decisión

Se ejecutó el ciclo completo contra producción: crear → verificar → borrar →
confirmar el borrado. El item fue `I1149`, y quedó eliminado.

Tres cosas que solo se supieron escribiendo:

1. **`users` NO es el ID suelto.** Es un **arreglo JSON serializado como texto**:
   `["21897000001144001"]`. Pasar `"21897000001144001"` devuelve
   `{"code":7600,"message":"Given JSON is invalid"}` — un error que no menciona
   `users` y manda a buscar el problema a otra parte. El código construía el ID
   suelto: la primera corrida real habría fallado con un mensaje que no señala
   la causa. Ahora lo arma `_usuarios()`.
2. **El destino es el backlog, y Zoho lo confirma.** La respuesta trae
   `sprintInfo: {name: "Backlog", type: 5}`. El sprint activo «AGOSTO 2026»
   termina el 2026-08-31, así que escribir ahí metía las tareas en un sprint que
   cerraba el mismo día.
3. **La asignación funciona.** El item volvió con `ownerId` correcto, así que la
   lista de personas sí habilita el responsable de punta a punta.

### Consecuencias

- El paso 9 pasa de «escrito contra la documentación» a «verificado contra la
  API». La definición de terminado exige haber corrido al menos una vez contra
  datos reales, y ahora eso incluye la escritura.
- La compuerta `--dry-run` demostró su valor dos veces en la misma sesión: antes
  de esta escritura mostró un dict de Python crudo dentro de la descripción de un
  work item (ADR-030). Se corrigió antes de que llegara a producción.
- La autorización sigue siendo **solo** para el proyecto 21897000000139001. No se
  extiende a Meta Ads, que continúa en solo lectura (regla 8).

---

## ADR-030 · Tres fallos que salieron de completar los datos, no de buscarlos

**Fecha:** 2026-08-31
**Estado:** aceptada

### Contexto

Al llenar por fin `personas`, `capacidad_semanal` y el `page_id` de Shopify,
tres caminos que nunca se habían ejercitado se ejecutaron por primera vez. Los
tres estaban mal. Ninguno se habría visto sin los datos reales: el `_lock` los
mantenía apagados.

### Los tres

**1 · La capacidad no se repartía, se duplicaba.** `_cap()` devolvía la capacidad
**completa** a cada tarea. Con 4 tareas de arte sobre una capacidad de 5, el plan
pedía **20 artes**: cuatro veces lo que el equipo dijo que puede hacer. El
docstring del módulo decía «se reparte» y el código no repartía nada.

Ahora `reparte_capacidad()` divide por resto mayor después de construir la lista
— 2+1+1+1 sobre 5, nunca 2+2+2+2 que sumaría 8 — y el motivo dice que el reparto
es sobre todas las tareas de ese tipo, así que descartar una libera capacidad
para las demás. El número es una propuesta que respeta el techo, no una
asignación cerrada. Y se dice que la capacidad es un **promedio** declarado por
el equipo, porque así la declaró: presentarla como tope exacto le daría una
precisión que su fuente no tiene.

**2 · Una marca con `page_id` pero sin archivo crudo desaparecía.**
`carga_competencia()` la saltaba con un `continue` mudo. Shopify pasó de
aparecer correctamente como «no se midió, falta su page_id» a **no aparecer en
absoluto** en el momento en que se consiguió el page_id. De decir «no lo
medimos» a no decir nada, que es peor.

Arreglarlo destapó dos huecos que llevaban ahí desde el principio: **Square y
Banco Industrial nunca se habían consultado en SV**, y el reporte no lo decía. El
tablero mostraba las dos marcas como si la foto de SV estuviera completa.

`sin_medir` pasa además a calcularse **por mercado**: una marca puede estar leída
en GT y no en SV, y repetir una sola lista en los dos diría que falta donde no
falta.

**3 · La evidencia estructurada se imprimía como repr de Python.** Un `str(e)`
sobre un dict metía `{'dato': 'Más eficiente', 'valor': ...}` literal, comillas
simples incluidas, dentro de la descripción de un work item real.

### Consecuencias

- Con las seis marcas medidas en los dos mercados, **la presión competitiva en SV
  es 0 y eso ya no es ignorancia**: está comprobado. Refuerza la estrategia
  recomendada, que antes se apoyaba en cuatro marcas de seis.
- Shopify resultó ser un referente **observable**, no teórico: 16 anuncios
  activos en español. Ocupa el territorio de «empieza tu negocio»; Paggo el de
  «gestiónalo fácil». Ninguno de los dos habla de cobrar mejor — el hueco más
  claro que ha aparecido, y salió de leer dos inventarios, no de una hipótesis.
- Las consultas de GT y SV de Shopify devuelven **los mismos 16 anuncios**: son
  campañas regionales. Queda anotado en el crudo que no se suman, porque 16+16
  serían 32 anuncios que no existen.

### La lección

**Un camino que nunca se ejecutó no está probado, está apagado.** El `_lock` de
`config/equipo.json` protegía de mostrar nombres inventados, y eso estuvo bien.
Pero también escondía tres errores de aritmética y de reporte que solo aparecen
cuando el dato existe. Llenar la configuración fue, de hecho, la prueba de
integración que faltaba.

---

## ADR-031 · El alcance no existe por API, y buscarlo destapó dos cosas mejores

**Fecha:** 2026-08-31
**Estado:** aceptada

### Contexto

Mercadeo mandó la URL del panel de Insights de Business Suite preguntando si de
ahí se podía sacar el orgánico. El alcance era el único hueco que quedaba
declarado en el reporte de redes.

### Qué se probó, y con qué resultado

**La URL: no.** Dos razones independientes. El proxy de red la bloquea de raíz
(`EGRESS_BLOCKED`), y aun sin eso es una aplicación que exige sesión iniciada y
que pinta sus datos con llamadas internas. No es una página que se pueda leer.

**El alcance: tampoco, por ninguna vía.** Se probó `ads_get_ig_media`, que era la
única ruta del MCP que quedaba sin explorar. Devuelve `like_count`,
`comments_count`, `media_type`, `media_product_type`, `permalink`, `timestamp` y
`caption`. **Ni alcance, ni impresiones, ni guardados, ni compartidos.** Las dos
fuentes disponibles coinciden en lo mismo, así que el hueco es real y queda
declarado, no pendiente.

### Pero la búsqueda produjo dos hallazgos

**1 · El corte por formato, que era invisible.** `media_product_type` distingue
REELS de FEED, y **Zoho Social no expone ese campo**. Sobre las 25 publicaciones
leídas:

| Formato | n | Interacciones | Promedio | Mediana | Máximo |
|---|---|---|---|---|---|
| REELS | 10 | 123 | **12.3** | 7.0 | 37 |
| FEED | 15 | 57 | **3.8** | 3.0 | 9 |

Los reels rinden **3.2x el promedio del feed** (2.3x por mediana, que es la cifra
conservadora). Las cinco mejores piezas del periodo son **todas** reels. Y los 7
comentarios de toda la muestra están **todos** en reels: el feed acumuló cero
comentarios en 15 publicaciones.

Se controló el sesgo obvio antes de reportarlo: si los reels ganaran solo por ser
más antiguos y haber acumulado más tiempo, la comparación no valdría. Las dos
cohortes promedian **exactamente 30 días** de antigüedad. El sesgo no explica la
diferencia.

Con la capacidad declarada de 5 artes y 5 videos por semana, esto es directamente
accionable: dice a qué formato conviene mover el peso.

**2 · El corte por mercado NO era imposible.** El proyecto documentaba como
trampa que «el orgánico no se puede partir por mercado: el portal tiene UNA marca
y GT y SV comparten audiencia». `ads_get_ad_account_pages` devuelve **dos**
páginas bajo la misma cuenta publicitaria: «Qpaypro» (1692583127699872 — que es
justo el `asset_id` de la URL que mandó Mercadeo) y **«Qpaypro El Salvador»
(829032443626700)**.

El corte existe del lado de Meta. Lo que falta es que la segunda página esté
conectada como marca en el portal de Zoho Social. Eso es **configuración, no
desarrollo**.

### Consecuencias

- El hueco de alcance pasa de «pendiente de probar» a **cerrado con evidencia**:
  no viene por API y no se va a capturar a mano, porque un paso manual dentro de
  una automatización semanal es una bomba de tiempo.
- El hueco de mercado cambia de `IMPOSIBLE EN ESTA CONFIGURACIÓN` a
  `FALTA CONECTAR UNA PÁGINA`, **con su remedio**. La diferencia no es de
  redacción: lo primero cierra la puerta, lo segundo dice cómo abrirla.
- Aparece una fuente nueva en `crudo/ig_media_organico.json`, con su método, su
  tope de 25 publicaciones y el control de sesgo anotados.

### La lección

**Declarar algo imposible cuando solo está desconectado cierra la puerta a
arreglarlo.** Es la misma lección de método del 2026-08-27 con los conectores
apagados, repetida en otra forma: entonces se dijo «no existe» de algo que estaba
instalado; aquí se dijo «imposible» de algo que estaba sin conectar. Y **una
segunda fuente del mismo dato no es redundancia**: buscando alcance apareció el
corte por formato, que con una sola fuente no se veía.

---

## ADR-032 · El análisis profundo de la Ad Library, y las tres preguntas que no tienen respuesta

**Fecha:** 2026-08-31
**Estado:** aceptada

### Contexto

Mercadeo pidió, literalmente, el mismo análisis que había visto hecho de Square,
aplicado a todas las marcas del registro: formatos, partnerships con creadores,
mensajes que repiten, a quién le hablan, top 10 por impresiones, anuncios más
longevos, velocidad creativa y conclusión estratégica. Con reporte HTML, gráficos
y buena presentación.

Ocho preguntas. La fuente sostiene cinco.

### Lo que se comprobó antes de construir

`ads_library_search` devuelve **ocho campos** por anuncio: `id`, `page_id`,
`page_name`, `ad_creative_link_title`, `ad_creation_time`,
`ad_delivery_start_time`, `ad_snapshot_url` y `currency`. No hay cuerpo del copy,
ni tipo de medio, ni impresiones, ni creador etiquetado.

Se intentó la vía obvia: abrir el `ad_snapshot_url` de cada anuncio, que sí
muestra todo eso. `www.facebook.com` está bloqueado por la política de red del
entorno (`EGRESS_BLOCKED`), igual que `business.facebook.com`. No hay vía.

### Decisión

Se responden **cinco preguntas completas y tres a medias**, y las tres a medias
se declaran arriba del reporte, no en una nota al pie:

| Pregunta | Estado | Qué sí, qué no |
|---|---|---|
| Formatos | **PARCIAL** | Sí: tarjeta única vs. carrusel, contando los separadores del titular. No: video vs. imagen — no existe el campo |
| Partnerships | **PARCIAL** | Sí: co-branding en el titular («Negocio + Marca», historias con nombre propio). No: el rótulo «with @handle» de un creador pagado |
| Top 10 por impresiones | **IMPOSIBLE** | Meta no publica métricas de entrega de anunciantes comerciales. Sustituto declarado: ranking por cantidad de creativos y por días vivo |

Y una regla que gobierna cada dossier: **la longevidad solo se responde si la
muestra está completa.** El conector topa en 50 sin cursor de paginación, así que
para una marca con más activos lo que se lee son los 50 **más recientes** — y los
antiguos, que son justo los que esa pregunta busca, quedan fuera por
construcción. Contestar con esa muestra daría «el más viejo de los nuevos».
Aplica a Square (112 y 102) y a Banco Industrial (844).

### Consecuencias, incluido lo que apareció por el camino

- **Consultar sin `countries` da el inventario global.** Square pasó de 0
  anuncios (la lectura GT/SV que teníamos) a **112 activos** en su página de
  EE.UU. y 102 en la de Reino Unido. Para un referente, el inventario global es
  justamente lo que interesa: se mira para aprender, no para medir presión.
- **La página de Square que faltaba.** Mercadeo mandó un `page_id` que no estaba
  en el registro (`200925806590732`, la operación de EE.UU.). Quedó agregado.
- El módulo `adlibrary_profundo.py` calcula todo desde el crudo, así que la
  corrida semanal lo reproduce. Las **lecturas estratégicas viven en un archivo
  aparte** (`adlibrary_lecturas.json`) a propósito: así se ve de un golpe qué es
  medición y qué es interpretación.

### Tres bugs propios que salieron al construirlo

1. **Colisión de separadores.** `_normaliza()` unía las tarjetas de un carrusel
   con `" + "`, que es exactamente el patrón que busca la detección de
   co-branding. Leía su propio join y reportaba «Square + Gordon's Wine Bar»
   como el nombre de una marca aliada. Ahora une con `" · "`, y la detección
   examina cada tarjeta por separado en vez del texto concatenado.
2. **Una tasa sobre una ventana diminuta.** «Creativos por semana» daba **350**
   para Square UK: con la muestra topada en los 50 más recientes, todas las
   creaciones caen en un día y dividir por ese span es un artefacto de la
   aritmética, no un ritmo de trabajo. Ahora la cadencia solo se publica si el
   span llega a 14 días; si no, se dice por qué no se calcula.
3. **El detector de desborde de la prueba daba falsos positivos.** Marcaba los
   hijos del rail, que es un contenedor con scroll horizontal propio: pasarse del
   viewport es lo que hace un scroller. Ahora excluye lo que vive dentro de un
   ancestro con `overflow-x: auto`.

### La lección

**Cuando el pedido excede al dato, la respuesta no es recortar el pedido en
silencio ni rellenarlo.** Es entregar lo que el dato sostiene, con la misma
calidad que si fueran las ocho preguntas, y poner arriba —donde no se pueda no
leer— qué falta y por qué. Un reporte que contesta ocho preguntas cuando la
fuente sostiene cinco está inventando tres, y quien lo lea tomará decisiones con
esas tres.

---

## ADR-033 · La paleta nueva entra como relleno, nunca como tinta ni como serie

**Fecha:** 2026-08-31
**Estado:** aceptada
**Pedido:** Mercadeo · «coloca a cada apartado un color de esta paleta: `000000
a1caed f3d7e9 d0e4bb dcd6c9`, no cambies la estructura, que el blanco siga
predominando».

### La decisión

Cada sección del tablero recibe un color, y ese color aparece en tres lugares y
en ninguno más: la **pastilla** del encabezado de sección, el **azulejo** de esa
sección en el rail lateral, y el **relleno** de las tarjetas de síntesis. El
resto del tablero —las tarjetas de dato, las gráficas, el fondo— sigue blanco
sobre `#F3F6F8`. El blanco predomina porque el color entra en la jerarquía de
navegación, no en la de contenido.

| Sección | Relleno | Tinta encima | Contraste medido |
|---|---|---|---|
| Resumen | `#000000` | `#FFFFFF` | 21.0:1 |
| Rendimiento | `#a1caed` | `#000000` | 12.19:1 |
| Competencia | `#f3d7e9` | `#000000` | 15.71:1 |
| Referencias | `#d0e4bb` | `#000000` | 15.50:1 |
| Estrategia | `#dcd6c9` | `#000000` | 14.51:1 |

### Por qué el pastel no puede ser color de letra

Se midió antes de usarlo. Los cuatro pasteles **sobre blanco** dan entre
**1.30:1 y 1.72:1**, cuando el mínimo para texto es 4.5:1. Como color de letra
son ilegibles — no «poco elegantes», ilegibles. Invertidos sí funcionan: el
negro encima de cualquiera de los cuatro pasa los 12:1. De ahí la regla, escrita
en `config/tema.json` para que sobreviva a quien edite el tema:
**el pastel es relleno, nunca tinta.**

Consecuencia de diseño: una tarjeta con relleno pastel necesita su propia escala
de tinta, porque el gris de texto secundario (`slate-700`) baja a 6.0-7.75:1
encima del pastel y los grises más claros no llegan. Se resolvió con una bandera
explícita `tinte` que se pasa a `cardCab()` y `fila()`, no con `!important`
encima de la cascada: un override global habría teñido también las tarjetas
blancas de la misma sección.

### Por qué NO son colores de gráfico

Se pasaron por el validador de paletas antes de considerarlo. **Fallan los cinco
checks.** Los dos peores: arena contra verde da **3.0 de ΔE** donde se pide 8, y
el piso de discriminación en visión normal queda en **4.9 donde se pide 15**. En
una serie de cuatro líneas serían cuatro líneas del mismo color pálido.
`paleta_graficos` queda intacta. La paleta de marca y la paleta de datos son dos
cosas distintas y confundirlas es lo que produce gráficas bonitas e ilegibles.

### El lavado, y por qué se calcula en vez de elegirse a ojo

Cada sección también expone un tono muy claro de su color, para fondos de nota y
estados sutiles. No es un valor escrito a mano por sección: se deriva de la
luminancia del color, `mezcla = 6 + luminancia * 34` por ciento contra blanco.
Así el negro produce un gris de 6% y los pasteles llegan a ~38%, y los cinco
lavados terminan con el mismo peso visual. Escribirlos a mano habría dado un
lavado de negro cinco veces más oscuro que el de arena.

### El logo

El pedido incluía usar un archivo como logo del usuario principal. **El adjunto
no llegó a la sesión**, así que no hay archivo que incrustar. Queda el hueco
declarado y listo: `config/tema.json → marca_logo.archivo`, que apunta a una
ruta relativa; el generador lee el archivo y lo incrusta como **data URI**,
porque el visor de artefactos bloquea cualquier imagen externa y un enlace no
cargaría nunca. Sin archivo, el tablero dibuja su monograma y lo dice en la
consola de la corrida. No se inventó un logo ni se dejó un `<img>` roto.

### La lección

**Medir el color antes de aplicarlo cuesta cinco minutos y cambia el diseño.**
La misma paleta, sin medir, habría terminado como texto de KPI a 1.4:1 y como
cuatro series indistinguibles en las gráficas — ambas cosas invisibles en la
pantalla del que las escribe y evidentes en la reunión.

---

## ADR-034 · La paleta de cuatro colores, y cómo entró a las gráficas

**Fecha:** 2026-08-31
**Estado:** aceptada
**Pedido:** Mercadeo, mismo día que el ADR-033 · «no uses el color marrón, solo
deja el azul, rosado, verde, negro y blanco. utiliza esta misma paleta para las
gráficas de rendimiento. Quiero que la estructura inicial sea más similar a esta
imagen de referencia. […] Aplica los colores pastel en detalles también, excepto
cuando sea algo para aprobado o desaprobado, ahí sí utiliza verde y rojo. incluso
amarillo si es un estado intermedio. También coloca los logos de la competencia:
paggo, recurrente y Bi.»

### 1 · Fuera el arena, y qué hace Estrategia con el hueco

Sale `#dcd6c9`. Quedan cuatro colores para cinco secciones, así que Estrategia
—que tenía el arena— pasa a **negro**, igual que Resumen. No es un empate por
falta de colores: en la imagen de referencia la tarjeta de acción también es la
oscura, y Resumen y Estrategia son justamente la portada y el cierre.

Pero el negro tiene un problema que el pastel no tiene: **su lavado es un gris.**
La sección donde el equipo pasa el rato —donde se acepta, se rechaza y se
asigna— se habría quedado sin una gota de color. Por eso una sección ahora puede
declarar `lavado_base`: el relleno sigue siendo negro y el lavado arranca del
azul. Azul y no verde a propósito, y esa es la regla del punto 3.

### 2 · La paleta SÍ puede pintar las gráficas — bajada a peso de línea

El ADR-033 dejó dicho que los pasteles fallan los cinco checks del validador.
Eso sigue siendo cierto **de los pasteles**. Lo que no se había probado es el
tono: conservando H y bajando la luminosidad a peso de línea, los tres

| Serie | Pastel (relleno) | Trazo (línea) | vs blanco |
|---|---|---|---|
| Facebook | `#a1caed` | `#1A5B93` | 7.09:1 |
| Instagram | `#f3d7e9` | `#931A68` | 8.11:1 |
| YouTube | `#d0e4bb` | `#4E7722` | 5.27:1 |

**pasan 5/5** — banda de luminosidad, piso de croma, separación para daltonismo
(ΔE 8.8 deutan), piso de visión normal (ΔE 20.9) y contraste contra blanco. Así
que la gráfica es de la paleta de Mercadeo Y se lee: **el pastel rellena el área
bajo la curva, el tono oscuro traza la línea.**

Queda un margen estrecho: la separación para **tritanopia es 6.9**, dentro de la
banda 6–8 que el validador solo admite con **codificación secundaria**. Está
puesta y no es adorno: cada serie tiene su patrón de trazo (continuo, guiones,
puntos) y la leyenda dibuja el mismo patrón en su muestra. Con eso las tres
líneas se distinguen incluso impresas en blanco y negro.

Un detalle que salió de la primera versión: el patrón se ató a la POSICIÓN de la
serie en la gráfica, y entonces YouTube salía punteado en «Interacciones» y
continuo en «Vistas», donde es la única serie. El patrón va pegado al color, no
al orden. La serie lo declara.

Y desapareció `serie_4`: la paleta tiene tres tonos. Inventar un cuarto color
fuera de la paleta para llenar el hueco sería salirse de lo que se pidió. El
reporte de la Ad Library usaba `var(--c4)` y se quedaba **sin color y sin
error** — una variable CSS que no existe no avisa. Ahora cicla sobre tres.

### 3 · Pastel en el detalle, semáforo en el estado

El pastel entra en la capa de detalle: etiquetas, círculos de las listas, anillo
de foco de los campos, segmento activo del formulario, bloques de nota. Cada uno
toma el lavado de **la sección en la que vive** (`var(--sec-lavado)`), así que el
detalle lleva el color de su apartado sin una regla por sección.

El estado NO. Aprobado va en verde, rechazado en rojo y **sin decidir en ámbar**
—un intermedio de verdad, no un hueco—, con los colores semánticos saturados que
el tema ya tenía, y con la palabra escrita al lado: solo color dejaría fuera a
quien no lo percibe, solo palabra obligaría a leer tres filas para saber cómo va
la mesa.

Esta separación es la razón por la que el lavado de Estrategia es azul: es la
sección donde se aprueba y se rechaza, y un fondo verde pálido debajo de una
etiqueta verde de «aceptada» convierte el semáforo en decoración.

### 4 · La portada, con la estructura de la referencia

Resumen se rearmó según la imagen: tarjeta oscura grande con la frase de la
semana y el botón de decidir, tres tarjetas numeradas 01/02/03 en azul, rosado y
verde al lado, la fila de Estadísticas en blanco debajo, y la lista de
Pendientes al final.

La imagen de referencia trae un `28%` de adorno en cada tarjeta. Aquí **cada
barra tiene un denominador real y el pie de la tarjeta dice cuál es**: 01 reparte
los leads entre mercados, 02 cuenta marcas medidas sobre el registro, 03 parte
los territorios de mensaje entre ocupados y libres. Una barra sin denominador es
un dibujo.

En 02 se cuentan **marcas, no anuncios**: sumar los anuncios de los dos mercados
duplicaría las campañas regionales — Shopify devuelve los mismos 16 en GT y en
SV (ADR-032). Contar marcas no tiene ese problema.

Dos cosas que encontró la prueba en navegador, no la vista:

1. `xl:[grid-template-columns:1.05fr_1fr]` dejaba la columna de las tres
   tarjetas en **552 px**, y tres tarjetas de 172 px con dos huecos de 20 piden
   556. Se rompía en 2+1 por cuatro píxeles. Ahora la proporción es `1fr_1.18fr`
   y las tres declaran `repeat(3,minmax(0,1fr))` solo desde xl.
2. `.etiqueta-sec` se agregó al bloque de estilo de las etiquetas pero **no al
   selector de grupo** que les pone el `display`, el relleno y el radio. La
   pastilla salía como texto suelto con un tinte detrás. Una clase nueva en una
   familia de clases hay que darla de alta en los dos lados.

### 5 · Los logos, y de dónde salieron

Los adjuntos de la conversación **no aterrizan en el sistema de archivos de la
sesión** — se ven en el mensaje y `/mnt/attach` está vacío. Es la segunda vez que
pasa con el mismo pedido. Así que los cuatro logos —el principal y los de Paggo,
Recurrente y Banco Industrial— son **redibujos en SVG** hechos a partir de las
imágenes: sin fondo, vectoriales, de 300 a 600 bytes cada uno, y verificados en
navegador a 120 px y a 44 px antes de aceptarlos. Se incrustan como data URI
porque el visor bloquea cualquier imagen externa.

Para sustituirlos por el asset oficial: dejar el archivo en `config/` o
`config/logos/` con el mismo nombre. No hay que tocar código. Una marca sin
archivo cae en sus iniciales y no se dibuja un logo genérico: una marca con logo
inventado se leería como medida cuando no lo está.

### La lección

**Un límite medido puede ser el límite del uso, no del color.** El ADR-033 midió
que los pasteles no sirven de línea y de ahí se concluyó, de más, que la paleta
no servía para gráficas. Servía: había que cambiar el tono, no la paleta. La
diferencia entre las dos conclusiones son cinco minutos de validador — los
mismos cinco minutos que la primera vez.

---

## ADR-035 · El análisis profundo entra al tablero, y de él salen recomendaciones

**Fecha:** 2026-09-01
**Estado:** aceptada
**Pedido:** Mercadeo · «algo que hiciste mal fue que hiciste un artefacto aparte
[…] yo lo quiero en la mesa creativa, obviamente de manera más resumida, pero
eso también te va a ayudar hacer el análisis para ver cómo nos dar las
recomendaciones para nosotros ejecutar y hacer campañas, en base a lo mejor
tanto de nuestra competencia como las de nuestras referencias.»

### El error que se corrige

El análisis profundo de la Ad Library (ADR-032) se entregó como un reporte HTML
publicado aparte. Era completo y estaba bien probado, pero **quedó fuera del
lugar donde se decide.** Nadie va a abrir una segunda pestaña en medio de la
reunión, así que un análisis que vive fuera del tablero es un análisis que no se
usa. Se movió adentro, resumido, y el reporte largo queda como anexo para quien
quiera el detalle de una marca.

### La pieza que faltaba: `recomendaciones.py`

El análisis decía qué hace cada marca. No decía qué hacer nosotros. Ese salto lo
da un módulo nuevo con **ocho reglas**, y la disciplina del archivo es una sola:

> **Cada recomendación trae su evidencia numérica o no se emite.** Si el umbral
> no se cumple, la recomendación simplemente no aparece.

No hay ninguna regla que produzca texto sin números detrás. Es la regla 1 del
proyecto aplicada al lugar donde más tentador sería romperla: una recomendación
inventada suena exactamente igual de bien que una medida, y nadie la puede
distinguir leyéndola.

Los tres tipos, y por qué el color no es un semáforo:

| Tipo | De dónde sale | Color |
|---|---|---|
| **evitar** | un competidor ya es dueño de ese territorio | rosa (Competencia) |
| **copiar** | el referente lo hace y aquí nadie lo hace | verde (Referencias) |
| **probar** | la señal existe pero la muestra no la sostiene del todo | azul |

El color de cada tipo es el de **la sección de donde salió la evidencia**, no un
juicio. El verde y el rojo saturados siguen reservados para aceptar y rechazar,
que es una decisión; esto es una lectura.

### Lo que salió de la primera corrida

Nueve recomendaciones. Las tres que más cambian la producción:

- **No usar «Gestiona tu Negocio Fácil».** Paggo carga el 84% de sus 43 anuncios
  en esa promesa y lleva 105 días sosteniéndola.
- **Hablarle a un nicho, no a «los negocios».** Los referentes trabajan «belleza
  y citas» (11 anuncios) y «restaurante» (5) y **ningún competidor medido las
  toca**.
- **Repartir el mensaje.** En un referente el mensaje más repetido carga 16% del
  inventario; en un competidor local, 62%.

### Cuatro errores que salieron al construirlo

1. **Una cuota no se traduce en un conteo.** La regla de repartir el mensaje
   medía los titulares distintos de un referente y salía «**21 promesas**» para
   un equipo con capacidad de 10 piezas. El número de titulares de quien produce
   50 anuncios no es una meta para quien produce 10. Ahora el objetivo es un
   **techo por promesa** —«que ninguna pase de 1 de cada 6 piezas»—, que sí se
   traslada de escala.

2. **`int()` sobre un porcentaje pierde el medio punto.** `int(0.625*100)` daba
   62 donde el dato es 62.5, y la evidencia justo abajo decía `0.625`. Un número
   que no cuadra con su propia evidencia destruye la confianza en toda la lista.
   Ahora todo porcentaje pasa por `round()`.

3. **Truncar para mostrar está bien; truncar para calcular es inventar un cero.**
   El comparativo de verticales se estaba calculando sobre las **tres verticales
   que se muestran** en el tablero, no sobre todas. Decía «0 anuncios de
   competidores» en verticales que sí tenían, solo que en cuarto lugar. Ahora hay
   dos listas: `verticales` (las que se muestran) y `verticales_todas` (con la
   que se compara). En esta corrida la conclusión no cambió, pero «seguridad»
   dejó de aparecer como libre — y en otra semana habría cambiado.

4. **El aviso de idioma decía «una marca» donde son dos de tres.** Las reglas que
   promedian varios referentes llevaban un aviso impreciso. Ahora los cuenta y
   los nombra: «2 de los 3 referentes medidos anuncian en otro idioma y para otro
   mercado (Square US, Square UK)».

### El 84% contra el 74%: el mismo dato, dos universos

La lectura básica de Paggo es **por país** (31 anuncios en GT, mensaje dominante
74%). La profunda es **global** (43 anuncios, 84%). Las dos son correctas. Pero
al meter el análisis profundo en la misma tarjeta, los dos porcentajes quedaron a
diez centímetros uno del otro y se leían como un error de cálculo.

No se resolvió unificando —serían dos preguntas distintas contestadas con una— ni
escondiendo una. **Cada porcentaje declara su universo:** «consulta global · 43
anuncios leídos», «consulta GT · 50 de 844 activos», y la tarjeta lleva una línea
que dice que son universos distintos y no tienen por qué coincidir. Se le agregó
también la **fecha** de la consulta profunda, porque la básica y la profunda se
corrieron días distintos y los activos declarados difieren en una unidad.

### El idioma se declara, no se adivina

Una recomendación que sale de un referente que anuncia en inglés no se copia al
pie de la letra. El tablero necesita saberlo, y el idioma **no se detecta leyendo
el texto**: adivinar idioma con heurísticas es exactamente la clase de dato
inventado que este proyecto prohíbe. Se declara en `config/competidores.json →
idioma_por_marca`, mirando la página, y una marca sin declarar no dispara el
aviso — el generador lo dice en consola.

### La lección

**Un análisis que vive fuera del lugar donde se decide es un análisis que no se
usa.** El reporte largo estaba bien hecho y bien probado, y eso no lo salvó: en
una reunión de una hora nadie abre una segunda pestaña. Lo que hay que resumir no
es el análisis — es la distancia entre el análisis y la decisión.

---

## ADR-036 · El dossier por marca, y la skill de copys que no inventa el tono

**Fecha:** 2026-09-01
**Estado:** aceptada
**Pedido:** Mercadeo · «lo que quiero es a quién le están hablando, sus tops
anuncios, lectura estratégica, mensajes que repiten […] me estás dando algo muy
general […] crea la skill para darme los copys, somos qpaypro.com».

### El diagnóstico correcto del reclamo

El ADR-035 metió el análisis al tablero, pero metió **cuatro números por marca**
—concentración, carrusel, cadencia, días sin lanzar— cuando el dato tenía mucho
más. La lista de mensajes con su cuota y sus días vivo, las verticales con su
peso, los anuncios más longevos con su enlace: todo eso ya estaba calculado y
guardado, y no se estaba mostrando. **No era un problema de análisis, era de
render.**

Ahora cada marca trae los cuatro bloques que se pidieron:

| Bloque | De dónde sale |
|---|---|
| **A quién le habla** | verticales inferidas del titular, con su cuota |
| **Qué repite** | mensajes con creativos, cuota, días vivo y desde cuándo |
| **Sus anuncios que llevan más tiempo** | longevidad, con enlace al anuncio real |
| **Lectura estratégica** | frases derivadas, cada una con su número |

### La lectura estratégica es traducción, no interpretación

Cada frase sale de **un umbral cruzado** y trae su evidencia al lado:
concentración ≥ 0.6 → «apuesta a un solo mensaje»; ≤ 0.3 → «cartera repartida»;
`cuota_en_rafaga` ≥ 0.5 → «despliega en lote»; `dias_sin_lanzar` ≥ 30 → «dejó de
producir»; el creativo más viejo ≥ 90 días → «tiene una apuesta que no retira».

Lo que **no** hay ahí es una interpretación de *por qué* lo hace ni de si le
funciona. La Ad Library no publica rendimiento y eso no se deduce del inventario.
Una «lectura estratégica» que dijera «Paggo apuesta ahí porque le está
funcionando» sería exactamente el dato inventado que este proyecto prohíbe, con
el agravante de sonar como análisis.

### Tres errores que salieron al mostrar el detalle

1. **«44 anuncios clasificables de 43 leídos».** Un imposible en pantalla. La
   causa no era un bug de suma: `audiencia()` cuenta un titular que toca dos
   verticales **en las dos**, así que el total son *clasificaciones*, no
   anuncios. El cálculo estaba bien y el rótulo estaba mal. Ahora dice
   «clasificaciones de titular» y explica por qué puede pasar del número de
   anuncios.

2. **«api.whatsapp.com carga 67% de su inventario».** La lectura de GuatePOS
   trataba un dominio como si fuera un territorio de mensaje. El filtro de
   titulares vacíos existía en el detector de territorios ocupados pero no en la
   lectura. Ahora, si ningún titular dice nada, la frase es esa: «no hay mensaje
   que leer», con los titulares observados como evidencia.

3. **El bloque de anuncios longevos salía vacío** para Square US, Square UK y BI,
   sin decir por qué. La razón es buena —con más de 50 activos la muestra son los
   50 más recientes, y «el más viejo de los nuevos» no es el más viejo— y estaba
   escrita en el módulo. Faltaba subirla a la pantalla. Un bloque vacío sin razón
   se lee como «no tiene»; lo que pasa es que no se pudo preguntar.

Y el dossier **sustituye** la lista básica de mensajes en lugar de sumarse a
ella: tener las dos era el problema del 74% contra el 84% (ADR-035). Una tarjeta,
un universo, declarado al pie.

### La skill de copys, y por qué no escribe con el tono de QPayPro

`.claude/skills/copys-qpaypro/` convierte una recomendación medida en dos o tres
opciones de copy, cada una con su ángulo, la evidencia que lo sostiene, lo que
evita a propósito, y el estado `PROPUESTA · requiere aprobación humana`.

**El tono de QPayPro no está y no se inventa.** Se intentó leerlo de
`qpaypro.com` el 2026-09-01: el proxy de red del entorno bloquea el dominio.
Así que la skill escribe en un **registro declarado por defecto** —español de
Guatemala, segunda persona, frases cortas, sin superlativos ni signos de
exclamación— y **rotula cada entrega** con `REGISTRO POR DEFECTO · falta el tono
de marca`.

Esto es deliberado y es la parte más importante de la skill. Un copy escrito con
un tono inventado no se distingue de uno escrito con el tono real hasta que
alguien de la marca lo lee y dice «nosotros no hablamos así» — y para entonces ya
se produjo la pieza. Rotularlo cuesta una línea y evita esa pérdida.

Para quitar el rótulo hacen falta tres cosas, y son cortas: cinco frases
aprobadas, tres rechazadas con su motivo, y el nombre comercial de cada producto.

### Lo que la skill sí tiene anclado

Los territorios que no se pueden usar (con su cuota y sus días), los que están
libres y medidos («belleza y citas» y «restaurante»: 0 anuncios de competidores),
el formato que el dato propio sostiene (los reels rinden 3.2× el feed), y cinco
reglas duras: cero cifras inventadas, cero superlativos sin sustento, nada se
publica desde ahí, si falta el tono se rotula, y el nombre de un producto no se
inventa.

### La lección

**Mostrar cuatro números de un análisis de veinte campos no es resumir: es
recortar.** Resumir es elegir qué preguntas contesta la tarjeta y contestarlas
completas. El pedido original —a quién le hablan, qué repiten, qué no matan, qué
se lee de eso— ya era la estructura correcta; lo que faltaba era respetarla.

---

## ADR-037 · El alcance y los copys entran al tablero

**Fecha:** 2026-09-02
**Estado:** aceptada
**Pedido:** Mercadeo · «no me aparecen los copys y tampoco veo lo orgánico».

Tenía razón las dos veces: se lo conté en el chat y no se lo puse en la
herramienta. Un hallazgo que solo existe en una conversación no existe.

### 1 · El alcance, y cómo cambia la conclusión

El alcance entró como bloque propio en Rendimiento, con la tasa de interacción
que este proyecto se venía negando a calcular por falta de denominador
(ADR-016). Fuente: Zoho Analytics, la tercera vía, documentada en
`docs/09-alcance-por-zoho-analytics.md`.

**Y con el denominador, la conclusión se da la vuelta.** Sin él, el hallazgo era
«los reels rinden 3.2× el feed». Con él:

| Red | Formato | n | Exposición prom. | Tasa |
|---|---|---|---|---|
| Facebook | reel o video | 93 | **3,509** impresiones | 0.39% |
| Facebook | imagen | 121 | 370 | 0.52% |
| Facebook | **carrusel** | 32 | 353 | **0.82%** |
| Instagram | reel | 206 | 292 alcance | 3.80% |
| Instagram | imagen | 60 | 310 | 3.24% |
| Instagram | **carrusel** | 25 | 300 | **5.65%** |

**Los reels ganan porque alcanzan a mucha más gente, no porque enganchen mejor
a quien los ve.** En Facebook alcanzan 9.5 veces más y convierten una porción
MENOR. El carrusel tiene la mejor tasa en las dos redes.

Eso no invalida «hacer reels»: los precisa. Reel para llegar, carrusel para
enganchar. Y converge con lo que dijo el análisis de la Ad Library por otro
camino: los referentes usan carrusel el doble que los competidores locales
(34% contra 19%). Dos análisis independientes apuntan al mismo formato.

### 2 · El bug que el guardia destapó

La primera versión del módulo cruzó `Media` con `Media Insights` y dejó **206 de
291** publicaciones «sin alcance». El número delató el error: 206 es exactamente
la cantidad de reels. El alcance de Instagram vive en **dos** tablas y la de
reels es aparte.

**Si la cifra hubiera sido cualquier otra, el tablero habría reportado «alcance
de Instagram» excluyendo en silencio a los reels** — que son 71% de las piezas y
las que mejor rinden. Lo que salvó el dato fue haber programado el contador de
piezas sin métrica en lugar de contarlas como cero.

Y de paso quedó **probado** lo que era una sospecha: la columna `Saved` de la
tabla de feed está mal rotulada. En la tabla de reels `Saved` es ≤ `Reach` en las
206 filas; en la de feed es 2 a 5 veces mayor, y guardar exige haber visto. Se
usa la de reels y no la de feed.

### 3 · Los copys, y por qué NO los genera una plantilla

Seis propuestas entraron a Estrategia, cada una con su titular, cuerpo, CTA,
ángulo, la evidencia que lo sostiene y **qué evita a propósito**. Se aprueban o
se rechazan con los mismos botones que las tareas.

**Están en `config/copys_propuestos.json`, redactados, no generados.** Una
plantilla de Python produce copy que suena a plantilla; lo que sí se automatiza
es la **disciplina**: que cada propuesta declare su ángulo, su evidencia, su
mercado y su estado, y que ninguna llegue a producción sin que una persona la
apruebe. Eso es lo que pide la regla 5, y aquí la aprobación es un registro
consultable, no una promesa.

Esto **matiza el ADR-021** («el copy no se escribe; el ángulo sí»). Esa decisión
se tomó cuando no había contexto de marca y escribir habría sido inventar el
tono. Hoy el tono está verificado contra nueve landings del sitio, así que la
premisa cambió y la decisión con ella. Lo que no cambia es la compuerta humana.

### 4 · La compuerta de mercado, en la interfaz

Hay afirmaciones verdaderas en un mercado y falsas en el otro: la liquidación
diaria existe en SV y no en GT; el POS se llama Cute en GT y A920 en SV.

Un copy bloqueado en el mercado que se está viendo **se muestra con el botón de
aprobar desactivado y el motivo escrito**, no se oculta. Ocultarlo haría creer
que no existe, y alguien lo escribiría de nuevo. Verificado en navegador: con la
vista en GT, los dos copys de liquidación diaria tienen «Aprobar» deshabilitado.

### La lección

**Un hallazgo que solo vive en el chat no es un entregable.** El alcance estuvo
encontrado y documentado un día antes de estar usable, y en ese día no servía
para nada. La distancia entre «lo descubrí» y «está en la herramienta donde se
decide» es todo el trabajo que importa.

---

## ADR-038 · Filtros de copy, rango de fechas que recalcula, y una poda de texto

**Fecha:** 2026-09-02
**Estado:** aceptada
**Pedido:** Mercadeo · filtrar los copys por pieza (arte/video) y por las tres
soluciones fuertes, un filtro de fechas «para visualizar las fechas que
queramos», y después: «elimina textos innecesarios […] deja solo las cosas que
se puedan poner en práctica».

### 1 · Los dos filtros de copy

Cada copy declara ahora **pieza** (arte o video) y **solución** (Punto de Venta,
Pasarela de Pagos, Tienda en Línea, con el nombre exacto del sitio). Las seis
combinaciones están cubiertas: se redactaron cuatro copys más para completar la
matriz, y ahora son diez.

Dos decisiones de taxonomía:

- **Una sola solución por copy.** Uno que dijera «Punto de Venta y Tienda en
  Línea» no se podría filtrar por ninguna de las dos sin mentir. Si el ángulo
  toca dos, se clasifica por la que manda en el titular y la otra va en
  `tambien_toca`.
- **Un copy sin taxonomía no se esconde: se cuenta y se avisa.** Si no
  apareciera en ningún filtro, se vería siempre — que es peor que no verse.

### 2 · El filtro de fechas RECALCULA, no oculta

Aquí estaba la decisión de fondo. Un filtro que oculta filas de una tabla ya
sumada deja **el total de un periodo al lado de las piezas de otro**, y eso es
peor que no tener filtro.

Para que recalcule de verdad, `alcance.py` emite ahora las **piezas una por
una** —549 filas, claves de una letra para no inflar el archivo— y el tablero
suma en el navegador sobre la ventana elegida. Se recalculan la tasa, el total,
el promedio, la mediana, la tabla por formato, las mejores tres y las
reacciones negativas.

Verificado moviendo el rango:

| Ventana | Piezas | Tasa |
|---|---|---|
| todo el dato | 258 de 258 | 0.42% |
| el periodo de la corrida | 8 | 0.47% |
| últimos 30 días | 11 | 0.53% |
| desde 2026-01-01 | 116 | 0.88% |

Tres detalles que no son de adorno:

- El **mínimo de 5 piezas** para publicar una tasa se respeta también en el
  navegador. Si la ventana elegida deja tres piezas, no sale tasa: sale por qué.
- Los atajos de días se cuentan **desde la última pieza que hay**, no desde hoy.
  Contar desde hoy daría una ventana vacía en una corrida retroactiva.
- Las fechas se **recortan al rango del dato**. Pedir una ventana donde no hay
  dato mostraría ceros que parecerían medidos.

Y un número que se me quedó atrás en la primera versión: **las reacciones
negativas no se movían con el rango.** Todo lo demás recalculaba y ese no. Un
número que no se mueve cuando los otros sí es un número que nadie va a creer, y
con razón. Ahora también se recalcula.

### 3 · La poda: 22,373 → 16,363 caracteres visibles

Medido en navegador contando solo el texto que **no** está dentro de un pliegue
cerrado. Un 27% menos de texto a la vista y 1,851 px menos de alto. Estrategia,
que es donde se trabaja, bajó 44%.

**No se borró una sola línea de las que declaran un hueco o una limitación.** Se
movieron a pliegues: 38 en total, ninguno vacío. La regla que apliqué es que a
la vista queda **lo que se ejecuta** —el texto del copy, la recomendación, la
cifra— y a un clic queda **lo que lo justifica**. Antes cada recomendación tenía
tres párrafos visibles y cada copy cuatro; con nueve recomendaciones y diez
copys, las secciones se leían como un informe en vez de como una lista de cosas
que hacer.

Dos cosas rompí al podar y las dos las encontró la prueba, no la vista:

1. Un `<p>` abierto con `'` y cerrado con `"` — SyntaxError, la página entera en
   blanco.
2. Un `<details>` dentro de un `<p>`. Un `details` es contenido de flujo y un
   `p` solo admite contenido de frase, así que el navegador cierra el párrafo
   antes de tiempo y el pliegue sale fuera. Se agregó a la prueba una
   comprobación de que ningún `details` tenga un `<p>` como padre.

Y el grupo de pastillas desbordaba en móvil: cuatro opciones de nombre largo
miden 421 px y la pantalla tiene 390. `flex-wrap` y `max-w-full`.

### La lección

**La credibilidad y la usabilidad no se pelean; compiten por el mismo espacio.**
Todo el aparato que hace creíble a este tablero —el universo de cada
porcentaje, por qué una tasa no se publica, qué se dejó fuera— seguía siendo
necesario y estaba estorbando. La respuesta no era elegir: era decidir qué se
lee y qué se consulta.

---

## ADR-039 · El rango es global, y el filtro de copy es en dos niveles

**Fecha:** 2026-09-02
**Estado:** aceptada
**Pedido:** Mercadeo, corrigiendo la entrega anterior: «el filtro de fechas era
para todo, osea todo literal, (quítalo de donde está ahorita), en teoría el
filtro tenía que estar hasta arriba»; y «el filtro de los copys está mal […]
tienen que haber 2 botones: Arte, Video. Cuando alguien le dé click a alguno de
esos 2 tendrán que desplegarse 3 opciones más».

Las dos correcciones son sobre lo mismo: **dónde vive un control dice a qué
manda.** Yo puse el rango dentro de la sección de orgánico porque era lo único
que sabía recalcular, y con eso le dije al equipo, sin decírselo, que solo
filtraba eso.

### 1 · El rango sube al encabezado, y por eso hay que declarar qué NO filtra

El control está ahora en el `<header>`, antes de la primera sección. Es una
promesa más grande que la anterior, y en este proyecto una promesa que no se
puede cumplir se declara en vez de esconderse.

Qué se hizo alcanzable al subirlo:

- **Las gráficas de evolución semanal.** `grafico()` recorta la serie a la
  ventana usando la fecha ISO de inicio de cada semana, y filtra los valores en
  paralelo con las semanas. Con 30 días, 12 semanas pasan a 4. Si ninguna semana
  cae dentro, no dibuja un lienzo vacío: dice que ninguna cae.
- Todo el orgánico, que ya recalculaba (ADR-038).

Qué **no** se puede, y por qué:

| Bloque | Por qué no | Cómo se dice en pantalla |
|---|---|---|
| Pauta de Meta | La corrida la agrega por periodo; no hay desglose diario en el resultado | Sello ámbar «no cambia con el rango» en *Campañas con entrega* |
| Competencia y referencias | La Ad Library solo responde qué está activo **hoy**; no acepta rango (trampa ya registrada) | Sello ámbar en la nota de Competencia |

**El sello aparece solo cuando hay una ventana propia elegida.** Con el rango
por defecto —todo el dato— no hay nada que aclarar, y un aviso permanente se
vuelve mobiliario que nadie lee. Y el control mismo lleva un pliegue «Qué no
filtra» con los dos casos y el periodo exacto de la corrida.

Esto es preferible a la alternativa que consideré, que era recortar la pauta con
un prorrateo por días. Habría dado un número que se mueve —y por lo tanto
creíble— **inventado**: el gasto no es uniforme entre días. Regla 1.

### 2 · El filtro de copy: jerárquico, no plano

Antes eran dos grupos de pastillas al mismo nivel: pieza y solución, cinco
controles a la vez. Ahora:

- **Nivel 1** siempre visible: `Arte · 5` / `Video · 5`.
- **Nivel 2** solo existe después de elegir pieza, rotulado con lo que se está
  mirando («Artes de …», «Videos de …») y con el conteo ya cruzado por pieza:
  *Punto de Venta · 1*, *Pasarela de Pagos · 2*, *Tienda en Línea · 2*.

Tres detalles del comportamiento:

- Una solución que quede en cero **se ve deshabilitada, no desaparece.** Que
  «Punto de Venta» tenga un solo arte es información de producción: dice dónde
  falta redactar. Ocultarla escondería el hueco.
- Volver a pulsar la pieza activa limpia los dos niveles. Cambiar de pieza
  reinicia la solución, porque un conteo de la pieza anterior aplicado a la
  nueva mentiría.
- Los conteos del nivel 2 son del cruce, no del total. `Pasarela de Pagos` dice
  2 dentro de Arte y 2 dentro de Video, y son cuatro copys distintos.

Verificado en navegador con los cinco pasos de la secuencia:

| Paso | Nivel 1 | Nivel 2 | Copys |
|---|---|---|---|
| inicio | 2 | 0 | 10 |
| clic en Arte | 2 | 3 | 5 |
| + Punto de Venta | 2 | 4 (con «las tres») | 1 |
| cambio a Video | 2 | 3 | 5 |
| Video otra vez | 2 | 0 | 10 |

### 3 · `fusiona_estado.js`

Fuera del pedido, pero de la misma sesión. El equipo decide **dentro** de la
página y esta se republica a sí misma, así que la versión publicada va adelante
de la del disco: publicar el fragmento recién generado tal cual **borra las
decisiones**. Ya pasó una vez (v48) y se resolvió a mano.

Ahora es un script: lee el `#estado` de la versión en vivo, valida los dos JSON
antes de escribir e informa qué trajo. En esta publicación trajo la v50 con una
decisión tomada hoy y dos ideas propias del equipo — que en la prueba se ven
como 28 botones de decidir donde el disco solo tenía 26.

Un detalle que lo hace necesario y no cosmético: hay **dos** `<script
id="estado">` en el archivo. El segundo es el literal del propio
`tablero_app.js` incrustado más abajo. Tocar el equivocado deja la página sin
estado y **sin error visible**.

### La lección

**Un control colocado dentro de una sección promete solo esa sección; subirlo
promete todo.** Y cuando la promesa grande es la correcta pero no se puede
cumplir completa, la salida no es achicar la promesa ni fingir que se cumple:
es cumplirla donde se puede y **marcar en el sitio exacto** lo que quedó fuera.
Los dos sellos ámbar valen más que el filtro, porque son lo que evita leer la
pauta de agosto como si fuera la de la ventana elegida.

---

## ADR-040 · El indicador de variación recorta con el rango, y el cero no es verde

**Fecha:** 2026-09-02
**Estado:** aceptada
**Pedido:** Mercadeo, antes de la corrida del lunes: verificar si el indicador
de variación de los KPI se había ejecutado alguna vez con datos reales.

### Lo que la verificación encontró

La sospecha era que el código nunca había corrido porque «no hay periodo
anterior». Las dos mitades de esa premisa eran falsas, y averiguarlo destapó un
error real:

1. **No compara contra una corrida anterior.** `variacionOrganico()` toma los
   dos últimos puntos no nulos de la **serie semanal de orgánico de la misma
   corrida**. No necesita historial. Un solo KPI lo recibe —Interacciones
   orgánicas—; los otros siete no, y eso es correcto: en pauta sí haría falta
   una corrida previa, y ahí un porcentaje sería inventado.
2. **Sí se había ejecutado.** `+105.6%` está en el tablero publicado.
   Recalculado desde el JSON crudo: `(37 − 18) / 18 × 100 = 105.5556`. Correcto
   al decimal.

Lo que **nunca** se había ejecutado con datos reales era la **rama negativa** —
esta corrida solo tiene subida. Forzada en `/tmp`, funciona.

### El error que destapó · el indicador ignoraba el filtro global

Con la ventana puesta en junio, la gráfica recortaba a junio y el KPI de al lado
seguía diciendo `+105.6% contra la semana anterior`, que eran el **17 y el 24 de
agosto**. Y a diferencia de *Campañas con entrega* y de la nota de *Competencia*,
este KPI no llevaba el sello ámbar: nada avisaba.

Es el modo de falla que nombra el ADR-038 —*el total de un periodo al lado de las
piezas de otro*— y es un error mío de la sesión anterior: al subir el filtro al
encabezado revisé las gráficas y me salté este KPI.

**La corrección no fue un sello, fue recortar de verdad.** La serie semanal trae
`inicio` en ISO por semana, que es exactamente lo que ya usaba la gráfica: el
dato alcanzaba, faltaba usarlo.

### Por qué la máscara es UNA función y no dos

El recorte estaba escrito dentro de `grafico()` y en ningún otro lado. Copiarlo
al KPI habría dejado dos copias que pueden divergir otra vez. Se extrajo a
`semanasEnRango(semanas)`, que usan las dos. **Una misma función no puede
discrepar consigo misma**; dos copias sí, y ya lo hicieron.

Devuelve `null` cuando no hay nada que recortar y `{hay:false}` cuando la
ventana existe y ninguna semana cae dentro. Son casos distintos: el primero usa
la serie completa, el segundo no tiene nada que mostrar.

### El orden importa

El recorte va **antes** del guardia de «se necesitan dos semanas». Al revés,
una ventana de una sola semana compararía dos semanas que el equipo no está
mirando.

Verificado con la ventana movida sobre el dato real:

| Ventana | Gráfica | Indicador | Nota |
|---|---|---|---|
| sin filtro | 12 semanas | `+105.6%` | de 18 (17 ago) a 37 (24 ago) |
| jul 06 – jul 27 | 4 semanas | `−49.4%` | de 89 (20 jul) a 45 (27 jul) |
| jun 01 – jun 30 | 4 semanas | ninguno | «17 publicaciones» |
| 20 – 28 ago · **una semana** | 1 semana | ninguno | «17 publicaciones» |
| mayo 2026 · **ninguna** | «ninguna semana cae» | ninguno | «17 publicaciones» |

Junio cae al texto alterno por una razón que no se había previsto: sus cuatro
semanas son `4, 0, 0, 1` y la penúltima es **0**. El guardia de división por
cero se activa, y está bien — un 0 que sube a 1 no es «+Infinito%», es que antes
no había nada que medir.

### El residuo, declarado

El **valor** del KPI (49) sigue sin poder recortarse: viene de la lectura de
Zoho Social, que no trae fecha por publicación. Así que con una ventana activa
la tarjeta muestra un valor del periodo al lado de una variación de la ventana.

En lugar de esconderlo, **la nota nombra las dos semanas**: «de 89 (20 jul) a 45
(27 jul)» en vez de «contra la semana anterior». El lector ve de dónde sale el
porcentaje sin tener que adivinar.

### El cero exacto no es una subida

`pct >= 0` metía el cero en la rama de subida: «sin cambio» salía verde con
flecha arriba. Y al implementarlo apareció el caso simétrico, que no estaba en
la lista: **un `−0.04%` redondea a `−0.0%`** y salía en rojo con flecha abajo.

El signo se decide ahora sobre la **cifra redondeada, que es la que se lee**, con
tres estados: sube verde, baja rojo, **igual gris con una raya**. Y el texto se
normaliza a `0.0%`, porque un menos delante insinúa una caída que el dato no
sostiene.

| Serie | Antes | Ahora |
|---|---|---|
| 18 → 18 | `↑ +0.0%` verde | `— 0.0%` gris |
| 2500 → 2499 | `↓ -0.0%` rojo | `— 0.0%` gris |

### La lección

**Un camino que sí se ejecutó puede estar igual de sin probar que uno que no.**
La pregunta era si el código había corrido; había corrido, y el número estaba
bien. Lo que no se había probado nunca era la **combinación** — el indicador
junto al filtro que se le puso encima un día antes. Cada pieza verificada por
separado y el cruce sin mirar.

Y el corolario del ADR-039, ahora con un caso: cuando un control global no puede
filtrar algo, el sello es el último recurso, no el primero. Aquí el dato para
recortar **ya existía**; el sello habría documentado un hueco evitable.

---

## ADR-041 · El camino del ratón es el único camino real

**Fecha:** 2026-09-04
**Estado:** aceptada

### Contexto

El filtro de fechas se probó con 43 comprobaciones que aplicaban la ventana
**por código**: se escribía el valor en el estado y se repintaba. Todas pasaron.
El usuario abrió el tablero, eligió una fecha **con el ratón** y los números no
se movieron. La frase que lo delató la escribió el propio tablero:

> «4 campañas con entrega · $964.76 invertidos · **22 días en la ventana**»

O sea: sabía que había una ventana puesta —escribió la oración— y aun así estaba
mostrando agosto completo. Leía la fecha para el texto y no para calcular.

### Lo que estaba roto

1. **`propio: !!(V.desde || V.hasta)`.** Una fecha *dentro* del tope encendía
   «ventana propia» aunque el rango efectivo siguiera siendo el completo. De ahí
   la oración con 22 días.
2. **El recorte se hacía contra el tope, no contra lo elegido**, porque los
   valores fuera de rango se **pegaban al borde** (clamp). Con un rango de 10
   días, escribir a mano es imposible: un `<input type=date>` con valor dispara
   `change` en **cada segmento**, con fechas basura intermedias —`0008-09-17`,
   `0816-09-17`, `8162-09-17`— y todas se pegaban al borde antes de llegar a la
   fecha buena.
3. **El filtro no se dibujaba** en la corrida nueva. `controlFechas()` y el
   manejador de presets se apoyaban en `alcance()` (Zoho Analytics). Sin ese
   archivo no había control, aunque la pauta diaria sí traía rango.

### Decisión

- `rango()` **une las dos fuentes** —alcance orgánico y pauta diaria— y toma el
  mínimo `desde` y el máximo `hasta`. El control se dibuja si **cualquiera** de
  las dos tiene rango.
- `propio` se calcula comparando contra el tope: `desde !== r.desde ||
  hasta !== r.hasta`. Si no cambia nada, no hay ventana propia y no se escribe
  la oración.
- Un valor fuera de rango se **ignora**, no se pega al borde. La basura
  intermedia del teclado deja de mover el estado.
- Cada campo escribe **solo su propio valor**. La inversión (`desde > hasta`) se
  resuelve al leer, no al escribir: antes, corregirla al escribir borraba el
  otro campo.
- `pintar()` con **debounce de 350 ms**, o el repintado destruye el campo que la
  persona está tecleando.

### El defecto que descubrió la propia corrección

Ignorar la fecha fuera de rango arregló el cálculo y abrió un hueco nuevo: el
`<input>` se queda en pantalla con la fecha rechazada. La persona lee **junio en
el campo y agosto en las cifras** — el mismo engaño de antes, ahora con el campo
del lado equivocado.

Al **salir del campo** se reconcilia contra la ventana que de verdad está
aplicada, y se dice por qué («del 25/08 al 03/09 es lo que hay medido»). Vaciar
el campo no es un error —es «sin tope por este lado»— así que ahí vuelve callado.

Lo encontró la prueba del filtro después de arreglar sus propias fechas
caducadas: 31 fallas eran fixture viejo, y detrás había una real.

### Las fechas de una prueba caducan solas

`pruebas/pauta_filtro.js` traía agosto escrito a mano y sus esperados vivían en
`/tmp`. Al cambiar el periodo de la corrida, esas cinco ventanas quedaron
**fuera del rango disponible**: el tablero las ignoró —correctamente— y la suite
marcó 31 fallas señalando un defecto que no existía. Peor: la suite no era
reproducible, porque el generador de esperados no estaba en el repositorio.

Ahora `pruebas/esperado_pauta.py` vive en el repo, calcula los esperados aparte
—a mano, sobre el desglose diario reconciliado— y **deriva las ventanas del
dato**: primera mitad, segunda mitad, un solo día, un día dentro del tope sin
pauta, y una ventana entera fuera del tope. Ninguna fecha escrita a mano.

Y la ventana fuera del tope **no tiene esperado numérico**: lo que se comprueba
es que nada se movió y que los campos volvieron a la ventana aplicada. Afirmar
«se muestra el periodo completo» habría sido falso —lo que pasa es que se
conserva la ventana anterior.

### La prueba que faltaba

`pruebas/filtro_raton.js` (`npm run prueba:raton`). Solo usa eventos de
confianza —`focus`, `keyboard.type`, `click`—, nunca escribe en el estado, y las
ventanas salen **del dato de la corrida**, no de fechas escritas a mano que
caducan cuando cambia el periodo.

Su invariante es a prueba de idioma: **los números de la página tienen que
coincidir con lo que muestran los campos.** No compara contra un valor esperado
—compara la página contra sí misma.

### La lección

**Una prueba que entra por debajo de la interfaz prueba el cálculo, no el
producto.** Las 43 comprobaciones eran correctas y no servían para esto: nadie
usa el tablero llamando funciones. El único camino que importa es el que empieza
en un clic.

Y el corolario: **cuando el sistema escribe una frase sobre su propio estado,
esa frase es un test.** «22 días en la ventana» junto a una ventana de 1 día es
una contradicción que la página se dijo a sí misma en voz alta.
