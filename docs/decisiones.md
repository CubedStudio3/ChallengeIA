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
