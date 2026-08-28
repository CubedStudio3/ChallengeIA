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
