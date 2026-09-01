# Bitácora del proceso

Registro cronológico de lo que se hizo, en qué orden, y con qué resultado.
Su propósito es que cualquiera —incluida una sesión futura sin memoria de esta—
pueda reconstruir cómo se llegó a las conclusiones actuales.

---

## Sesión 1 · 27 de agosto de 2026

### Paso 1 · Verificación del estado inicial del entorno

**Por qué se hizo primero:** el usuario preguntó si el proyecto arrancaba
realmente desde cero, sin accesos ni conexiones previas. Responder eso de
memoria habría sido un supuesto. Se verificó.

**Método:** inspección directa del repositorio y del entorno de ejecución.

```
git branch -a          → rama claude/proyecto-desde-cero-h3s7vr, sin commits
git remote -v          → origin https://github.com/CubedStudio3/ChallengeIA
git log                → fatal: no commits yet
git ls-files | wc -l   → 0
git ls-remote --heads  → (vacío: cero ramas en el remoto)
ls -la                 → solo .git/
ls .claude             → no existe
```

**Resultado:**

- El repositorio estaba **completamente vacío**: 0 commits, 0 ramas remotas,
  0 archivos versionados, sin `CLAUDE.md` ni `.claude/`.
- **Pero el entorno NO estaba aislado.** Había conexiones vivas y autenticadas
  a cuentas reales: Meta Ads, Zoho Social, Zoho Sprints, GitHub.

**Por qué importa:** el usuario creía que no había nada conectado. La respuesta
correcta era "el código sí está desde cero, las conexiones no". La diferencia
es material: una instrucción ambigua podría haber publicado un post real o
tocado una campaña real.

**Observación adicional:** el contenedor de ejecución es efímero — se recicla
por inactividad. Lo que no se commitea y se sube, se pierde. Ésta es la razón
por la que esta documentación existe como archivos en el repositorio y no solo
como conversación.

---

### Paso 2 · Recepción del documento maestro

El usuario entregó el "Prompt Maestro" del proyecto Mesa Creativa: contexto de
la empresa, tres módulos a construir, cuatro verificaciones obligatorias de
Fase 0, conocimiento técnico ya validado, siete subagentes, seis skills,
estructura de repositorio, reglas de ingeniería, criterios de corte y
definición de terminado.

Su instrucción explícita de primera tarea fue: **no escribir código**, y en su
lugar (1) confirmar el alcance y señalar contradicciones, (2) proponer el plan
de Fase 0, (3) pedir los accesos necesarios, (4) señalar riesgos no mencionados.

---

### Paso 3 · Inventario de la superficie de conectores

**Por qué se hizo:** el documento afirmaba que ocho conectores estaban
"disponibles hoy". La Regla 1 del propio documento prohíbe construir sobre
supuestos. Un conector listado en un documento no es un conector conectado.

**Qué NO se hizo:** no se llamó a ninguna API. Esto fue inspección del
*catálogo de herramientas* disponible en la sesión, que es una operación de
lectura de metadatos, no una consulta de datos. Se respetó la instrucción de
no ejecutar todavía las verificaciones de Fase 0.

**Método:** búsquedas sobre el catálogo de herramientas MCP, por nombre y por
función, con cuatro consultas independientes para no depender de una sola
formulación:

| Consulta | Resultado |
|---|---|
| `+zoho crm leads contacts deals` | solo herramientas de Zoho Social |
| `+zoho mail analytics books desk email send report` | solo herramientas de Zoho Social |
| `+crm lead record module` | una herramienta de Meta (datasets), ninguna de Zoho CRM |
| `+mail send message inbox` | **sin coincidencias** |

**Resultado:** cinco de los ocho conectores del documento **no existen** en la
superficie de esta sesión. Detalle completo, consecuencias y qué se descarta
en `docs/01-inventario-conectores.md`.

---

### Paso 4 · Lectura de esquemas de herramientas críticas

**Por qué:** dos pasos del Módulo 1 dependen de capacidades específicas que el
documento asumía. Leer el esquema de una herramienta es gratis y responde
preguntas de diseño sin gastar una llamada a la API.

**`ads_library_search`** — se leyó el esquema completo. Parámetros expuestos:
`search_terms`, `page_ids`, `countries`, `ad_active_status`, `ad_type`, `limit`.

Dos hallazgos que cambian el alcance:

1. **No hay ningún parámetro de rango de fechas.** No existe
   `ad_delivery_date_min` ni equivalente. → Es imposible reconstruir qué
   anunciaba un competidor en junio. Las corridas retroactivas quedan limitadas
   a pauta propia.
2. **`limit` máximo 50, sin cursor de paginación.** Paggo corre 51 anuncios
   según el documento. No se pueden enumerar todos en una llamada.

**Inventario de Zoho Sprint** (~80 operaciones) — se revisó la lista completa
buscando dos capacidades:

- *Adjuntos:* no existe ninguna operación de subida, bajada o listado de
  adjuntos. → La Verificación 3 tiene respuesta preliminar **negativa** y su
  contingencia (entrega por enlace) se activa con alta probabilidad.
- *Webhooks o suscripciones:* no existen. Solo lectura por consulta
  (`GetItems`, `GetItemDetails`, `GetItemActivity`). → El Módulo 2 debe
  detectar cambios de estado por **sondeo periódico**, no por eventos.

**Inventario del Meta MCP** — se detectó que existe `ads_create_ad_set`, lo
que **contradice** el conocimiento validado del documento maestro ("los ad sets
no se pueden crear de forma independiente por la API del MCP"). No se corrigió
el documento: se registró como punto a re-verificar, porque el fallo original
pudo haber sido de permisos o de Términos de Servicio mal diagnosticado.

**Observación de diseño en el Meta MCP:** todas sus herramientas exigen dos
campos en cada llamada — `client_conversation_id` y `advertiser_request`, este
último definido como *"lo que el anunciante pide, en sus palabras exactas,
citadas textualmente"*. En una corrida automática desatendida no existe
ninguna frase del anunciante. Es una fricción real contra el requisito
agéntico y hay que resolverla explícitamente.

---

### Paso 5 · Entrega del análisis y respuesta a la primera tarea

Se entregaron los cuatro puntos que pidió el documento:

1. **Contradicciones y ambigüedades** — 9 puntos. Ver `docs/02-contradicciones.md`.
2. **Plan de Fase 0** — reordenado y ampliado de 4 a 7 verificaciones, con una
   nueva puesta en primer lugar (la convención de fechas, como test falsable).
   Ver `docs/03-plan-fase-0.md`.
3. **Accesos y permisos necesarios** — 13 puntos, 5 de ellos bloqueantes.
   Ver `docs/06-requerimientos-usuario.md`.
4. **Riesgos no mencionados** — 6 riesgos (A–F), siendo el A crítico (no existe
   runtime para la corrida automática). Ver `docs/04-riesgos.md`.

**No se creó ningún archivo en este paso.** Se esperó aprobación, conforme a la
instrucción del documento.

---

### Paso 6 · Consulta del usuario sobre estrategia de ejecución

El usuario preguntó si conviene construir los módulos uno por uno hasta
completarlos, o los tres en paralelo para detectar errores antes.

**Respuesta: secuencial, pero con un corte distinto al que planteaba.**
El razonamiento completo está en `docs/05-estrategia-ejecucion.md`. En resumen:

- "Todo junto" no es opción material hoy: los Módulos 2 y 3 tienen bloqueos
  externos duros (Mail y CRM desconectados). Paralelizar significaría escribir
  código que no se puede verificar contra datos reales, lo que la Regla 1
  prohíbe.
- El paralelismo, sobre una base compartida que aún no existe, produce tres
  convenciones de fecha distintas y tres formas de trazar. Los errores no
  aparecen al escribir, aparecen al integrar — y eso caería alrededor del 3 o 4
  de septiembre, sin margen.
- La preocupación legítima del usuario (ver errores temprano) se resuelve con
  **profundidad, no con ancho**: una rebanada vertical delgada que atraviese
  todas las capas de una vez.

---

### Paso 7 · Documentación del proceso (este commit)

El usuario pidió documentar todo el proceso a detalle antes de continuar.
Se creó la estructura del repositorio conforme al documento maestro y se
escribieron los diez documentos de `docs/`, más `CLAUDE.md` como contexto
persistente.

**Decisión tomada aquí:** los archivos de `config/` se crearon con un campo
`estado` explícito que marca cada valor como verificado o no verificado, y con
`_lock` en los no verificados. Escribir una convención sin verificar como si
fuera un hecho habría violado la regla central del proyecto. Ver ADR-009.

---

## Estado al cierre de la Sesión 1

| Ítem | Estado |
|---|---|
| Fase 0 ejecutada | ❌ no iniciada (0 de 7 verificaciones) |
| Código escrito | ❌ ninguno (por diseño) |
| Documentación del análisis | ✅ completa |
| Estructura del repositorio | ✅ creada |
| Alcance confirmado | ❌ depende de Fase 0 |
| Bloqueantes pendientes del usuario | 5 (ver `docs/06-requerimientos-usuario.md`) |

**Siguiente acción esperada:** el usuario resuelve los 5 bloqueantes y aprueba
la ejecución de la Fase 0.

---

### Paso 8 · Restricción de permisos sobre Meta Ads

**Origen:** instrucción explícita del usuario, 2026-08-27.

> *"Solo quiero saber algo, ya van 2 veces que me dices como que tú activarás
> campañas de marketing. Yo no quiero que hagas eso, solo que me des la info,
> no publicar nada en ads de Meta, solo en Social de Zoho."*

**Qué se había propuesto.** En ADR-007 y en la Verificación 1 se propuso crear
una campaña en estado `PAUSED` en la cuenta de producción, como prueba de
escritura para verificar los Términos de Servicio de Lead Generation. La
propuesta incluía "jamás activar" y estaba condicionada a autorización expresa
en ambas menciones. No se creó ni activó nada.

**Por qué el usuario tenía razón en cortarlo.** Aunque la propuesta era
conservadora, el beneficio era una sola verificación y el riesgo era crear
objetos en una cuenta publicitaria de producción. Ese mismo dato se obtiene
revisando Meta Business Manager en dos minutos, con cero riesgo.

**Decisión adoptada.** Meta Ads pasa a **solo lectura**, sin excepciones,
incluido el estado pausado. Registrado en ADR-012, que supera la parte de
ADR-007 relativa a Meta.

**Archivos modificados en este paso:**

| Archivo | Cambio |
|---|---|
| `CLAUDE.md` | Nueva regla 8 no negociable + matriz de permisos por sistema |
| `docs/decisiones.md` | ADR-012 agregado; ADR-007 marcado como superado |
| `config/convenciones.json` | Bloque `escritura_de_prueba` reescrito con permisos por sistema |
| `docs/03-plan-fase-0.md` | V1 reescrita sin escritura; orden de ejecución actualizado |
| `docs/validaciones.md` | Tablero y nota de permisos |

**Observación relevante.** Esto no es una desviación del documento maestro. Su
contingencia para la Verificación 1 ya decía *"el agente no ejecuta: crea la
tarea en Sprint con la instrucción exacta y un humano la aplica"*. La decisión
adopta esa contingencia como **modo normal de operación** en lugar de plan B.

**Consecuencias de alcance:**

1. La Fase 0 completa queda de **solo lectura**. Ninguna verificación escribe.
2. C4 (¿funciona `ads_create_ad_set`?) queda **sin resolver a propósito**. El
   conocimiento heredado se mantiene como supuesto declarado y marcado como no
   verificado. Documentar la incertidumbre es preferible a resolverla con una
   acción prohibida.
3. El **Módulo 3** cambia de forma: su función central (devolver a Meta cuáles
   leads cerraron) es una escritura. Podrá calcular qué cargar y dejarlo como
   instrucción para un humano, pero no cerrar el circuito solo. Ya estaba
   bloqueado por la ausencia de Zoho CRM, así que no altera el plan inmediato.

---

## Sesión 2 · 27 y 28 de agosto de 2026 · de las verificaciones al tablero

La Sesión 1 terminó sin una sola línea de código, a propósito. Esta sesión
resolvió los bloqueantes y construyó la rebanada vertical completa.

### Paso 1 · Fase 0, y la trampa heredada que NO era cierta

Las verificaciones se corrieron contra las cuentas reales, en solo lectura.

| Verificación | Resultado |
|---|---|
| V0 · convención de fechas y métricas | ✅ **12/12 valores al centavo** contra la interfaz |
| V1 · escritura en Sprint | postergada por ADR-012 (solo lectura en Fase 0) |
| V5 · page_id de competidores | ✅ Paggo confirmado; Square y Recurrente pendientes entonces |

El hallazgo más caro de la Fase 0 fue **desmontar una trampa heredada**. El
documento maestro advertía que el campo `lead` no correspondía a la columna de
Resultados. Con rango **cerrado** y `level=campaign`, `results` y
`cost_per_result` calzan **exactamente** con la interfaz. Y las campañas que
concentran el gasto optimizan por `actions:lead`, no por `QualifiedLead` — este
último existe como evento del pixel pero lo usa **1 campaña, con 1 resultado y
$3.23**. Se documentó en ADR-013.

El caso «$70.74 vs $1.57» del documento maestro **no se reprodujo** y el usuario
no lo reconoció. Se trató como no verificable en lugar de heredarlo como verdad.

### Paso 2 · El error propio de método, y su corrección

Se concluyó que cinco conectores de Zoho «no existían» porque sus herramientas
no estaban cargadas en la sesión. **Estaban instalados, solo apagados.**
`ListConnectors` lo mostró. Quedó como lección permanente en `CLAUDE.md`:
*ausencia de evidencia no es evidencia de ausencia*.

Consecuencia: los Módulos 2 y 3 dejaron de estar «descartados» y pasaron a
«dependen de habilitar CRM y Mail».

### Paso 3 · El tablero, en cinco secciones

Se construyó el tablero semanal como artefacto publicado, con estado compartido
que sobrevive a las republicaciones: Resumen, Rendimiento, Competencia,
Referencias, Estrategia.

Decisiones de esta etapa: primero la estrategia y después las tareas (ADR-023);
las ideas del equipo se guardan aparte de los hallazgos del sistema (ADR-024);
dos gráficas en vez de una porque son dos medidas distintas, y un hueco no es un
cero (ADR-025).

### Paso 4 · Zoho Sprint: el camino que no dependía del conector

El conector autenticaba pero faltaba el `teamId`. Se probaron tres formas y las
tres dieron el mismo error. En vez de quedarse esperando, se abrió una segunda
vía: **importación por CSV**, que no necesita ninguno de los cinco IDs. El
mapeo de columnas se confirmó en vivo con Zoho.

Ese fue el paso que salvó el módulo. Y trajo una trampa que se documentó: en
Sprints, **tipo y prioridad van en inglés y el estado en español** — `Task`,
`Medium`, pero `Por Hacer`.

### Estado al cierre de la Sesión 2

| Ítem | Estado |
|---|---|
| Fase 0 | ✅ ejecutada, con V0 verificada al centavo |
| Tablero | ✅ publicado y operativo |
| Sprint por CSV | ✅ probado en producción (ítems 1140-1142) |
| Sprint por API | ⚠️ autentica, falta el `teamId` |
| ADR escritos | 027 |

---

## Sesión 3 · 31 de agosto de 2026 · cerrar los datos y el diseño

La sesión más larga. Cinco frentes, en este orden.

### Paso 1 · Los cinco IDs de Sprints, y la escritura real

El usuario autorizó explícitamente una escritura de prueba en producción,
acotada al proyecto `21897000000139001`. Se ejecutó el ciclo completo:

```
CreateItem  → ítem I1149 creado y asignado a la persona correcta
GetItems    → verificado que existe con los campos esperados
DeleteItem  → borrado
GetItems    → confirmado que ya no está
```

**La escritura por API funciona.** Y apareció la trampa que costó las horas:
`users` **no es el ID suelto**, es un **arreglo JSON serializado como texto** —
`["21897000...144001"]`. El ID a secas devuelve `7600 · Given JSON is invalid`,
un mensaje que ni menciona el campo `users` (ADR-029).

Los cinco IDs quedaron en `config/equipo.json` y el destino es el **backlog**,
porque el sprint «AGOSTO 2026» cierra el 31 de agosto.

### Paso 2 · Llenar la configuración destapó tres fallos reales

`config/equipo.json` estaba bloqueado con `_lock: true`. Al llenarlo con los
datos verdaderos, el camino que nunca se había ejecutado reveló tres errores:

1. La capacidad semanal se **devolvía completa a cada tarea**: pedía 20 artes
   sobre una capacidad de 5. El reparto tiene que ir después de construir la
   lista, por resto mayor.
2. La evidencia estructurada se imprimía como **repr de Python** dentro de la
   descripción del work item.
3. El campo `remedio` de cada hueco se **descartaba** antes de llegar al tablero.

**Lección:** *un camino que nunca se ejecutó no está probado, está apagado.*
Llenar la configuración fue la prueba de integración que faltaba (ADR-030).

### Paso 3 · Buscando el alcance orgánico: no existe, y apareció algo mejor

Se probó por las dos fuentes. Zoho Social devuelve interacciones pero no
alcance. `ads_get_ig_media` tampoco: solo `like_count` y `comments_count`. La
URL de Business Suite Insights que mandó el usuario es una app con sesión
iniciada y el proxy la bloquea de raíz.

**El alcance no viene por ninguna vía.** Se declara el hueco en vez de
capturarlo a mano: un paso manual dentro de una automatización semanal es una
bomba de tiempo.

Pero la segunda fuente trajo un corte que la primera no tiene:
**`media_product_type`**, que distingue REELS de FEED. Sobre 25 publicaciones,
**los reels rinden 3.2× el promedio del feed** (12.3 vs 3.8 interacciones), las
5 mejores piezas son todas reels, y los 7 comentarios de la muestra están todos
en reels. Controlado por antigüedad: las dos cohortes promedian 30 días, así que
no es sesgo (ADR-031).

**Lección:** *una segunda fuente del mismo dato no es redundancia.*

Y se corrigió otro «imposible» heredado: el corte del orgánico por mercado no es
imposible, **falta conectar una página**. `ads_get_ad_account_pages` devuelve
dos: «Qpaypro» y «Qpaypro El Salvador» (829032443626700). Es configuración, no
desarrollo.

### Paso 4 · El análisis profundo de la Ad Library

El usuario pidió el mismo análisis que se hizo de Square, aplicado a todas las
marcas. Se entregó como reporte HTML propio, con siete dossiers.

De ocho preguntas, **la fuente sostiene cinco**. Las otras tres se declaran
arriba, donde no se pueden no leer: la Ad Library devuelve **ocho campos y nada
más**, y **Meta no publica impresiones de anunciantes comerciales** — un «top 10
por impresiones» de un competidor comercial es imposible, no difícil (ADR-032).

Cuatro trampas nuevas salieron de aquí:

- `_normaliza()` unía las tarjetas de un carrusel con `" + "`, que es justo el
  patrón que busca la detección de co-branding: **leía su propio join** y
  reportaba «Square + Gordon's Wine Bar» como marca aliada.
- «Creativos por semana» daba **350** para Square UK: con la muestra topada en
  los 50 más recientes el span colapsa a 1 día. Si el span no la sostiene, la
  tasa no se publica.
- Consultar **sin `countries`** da el inventario global: Square pasó de 0
  anuncios (GT/SV) a 112 activos en su página de EE.UU.
- Varios anuncios con el **mismo segundo de creación** son una carga en lote, no
  piezas pensadas una por una. Paggo sube el 65% de sus creativos en ráfagas.

### Paso 5 · Dos rondas de diseño

Mercadeo entregó una paleta y una imagen de referencia. Se aplicó en dos rondas,
y la segunda **corrigió una conclusión de la primera**.

- **Ronda 1 (ADR-033):** se midió antes de aplicar. Los pasteles sobre blanco
  dan **1.34-1.72:1**, cuando el mínimo para texto es 4.5:1 — como color de
  letra son ilegibles. Regla: **el pastel es relleno, nunca tinta.** De ahí se
  concluyó, de más, que la paleta tampoco servía para gráficas.
- **Ronda 2 (ADR-034):** sale el arena. Y se probó lo que faltaba probar:
  bajando cada tono a **peso de línea**, los tres **pasan 5/5 del validador**.
  La paleta sí puede pintar las gráficas — el pastel rellena el área y el tono
  oscuro traza la línea.

**Lección:** *un límite medido puede ser el límite del uso, no del color.*
Había que cambiar el tono, no la paleta.

El Resumen se rearmó con la estructura de la imagen de referencia. Una
diferencia deliberada: la imagen trae un «28%» de adorno en cada tarjeta; aquí
**cada barra tiene un denominador real** y el pie dice cuál es.

Los adjuntos de la conversación **no aterrizan en el disco de la sesión**, así
que los cuatro logos son redibujos en SVG, verificados en navegador a 120 y a
44 px. Queda declarado y se reemplazan sin tocar código.

### Paso 6 · La Rutina semanal

Se creó la Rutina `trig_01CWh3gdJWfDKGzR4MDB6qhs`, lunes 07:00 GT. El parámetro
de conectores **no está disponible para esta organización**, así que hay que
adjuntarlos desde la interfaz de Routines. Sin ellos la Rutina se detiene en su
Compuerta 0 y **no toca el tablero, a propósito**: es preferible que no corra a
que corra a ciegas y sobrescriba el trabajo del equipo.

---

## Estado al cierre de la Sesión 3 · 31 de agosto de 2026

### Lo que está operativo

| Componente | Estado | Verificado contra |
|---|---|---|
| Meta Ads · lectura | ✅ | 12/12 valores al centavo (V0) |
| Meta Ad Library | ✅ | 6 marcas × 2 mercados |
| Zoho Social · lectura | ✅ | 3 redes, 17 publicaciones |
| Zoho Sprints · lectura y **escritura** | ✅ | ciclo crear/verificar/borrar en producción |
| Tablero publicado | ✅ | Chromium a 1440, 834 y 390 px |
| Reporte de Ad Library | ✅ | Chromium, 7 dossiers |
| Rutina semanal | ⚠️ | creada; **le faltan los conectores** |

### Los números de la corrida de referencia (2026-08-01 a 2026-08-24)

| Dato | Valor |
|---|---|
| Leads (`actions:lead`) | **370** — GT 265, SV 105 |
| Inversión | **$963.46** |
| Costo por lead | **$2.60** — GT $2.89, SV $1.89 |
| Campañas con entrega | 4 (1 excluida por indicador distinto) |
| Interacciones orgánicas | 49 en 17 publicaciones |
| Presión competitiva GT | 42 anuncios que disputan, **4** competidores |
| Presión competitiva SV | **0** — medido, no supuesto |
| Estrategias propuestas | 3, con su premisa |
| Tareas con evidencia | 6 |

### Los huecos, declarados

1. **Alcance orgánico** — no viene por ninguna de las dos fuentes. Se reportan
   interacciones absolutas y el hueco se declara. Sin alcance no hay tasa de
   engagement, así que **no se calcula**.
2. **Corte del orgánico por mercado** — falta conectar «Qpaypro El Salvador» en
   el portal de Zoho Social. Configuración, no desarrollo.
3. **LinkedIn y TikTok** — fuera del reporte por instrucción del usuario.
   LinkedIn además devolvía 0 en 25 de 25 publicaciones, indistinguible entre
   cero real y campo no soportado.
4. **Impresiones de la competencia** — Meta no las publica para anunciantes
   comerciales. Imposible, no pendiente.

### Alcance

Decisión del 2026-08-31: **solo Módulo 1**. Los Módulos 2 y 3 quedan fuera. No
es un fracaso de criterio de corte — es el criterio de corte del 1 de
septiembre aplicado un día antes, con el Módulo 1 completo en lugar de tres
módulos a medias.

### Lo que falta, y de quién depende

| Pendiente | De quién |
|---|---|
| Adjuntar los conectores a la Rutina desde claude.ai | **del usuario** (solo él puede) |
| Conectar «Qpaypro El Salvador» en Zoho Social | del usuario, opcional |
| Sustituir los logos redibujados por los oficiales | del usuario, opcional |
| Corridas retroactivas de junio y julio para el Demo Day | del sistema |
| El deck de la presentación | del sistema |
