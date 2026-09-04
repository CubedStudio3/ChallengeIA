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

---

## Sesión 4 · 1 y 2 de septiembre de 2026 · el hueco del alcance, la marca y los copys

Seis frentes. El primero cerró el hueco más viejo del proyecto.

### Paso 1 · El alcance orgánico apareció en una tercera fuente

Durante cinco días el proyecto declaró que el alcance orgánico «no viene por
API». Era falso, y por el mismo error de método que ya había cometido dos veces:
se midió que `ads_get_ig_media` no lo trae y que Zoho Social tampoco, y de ahí
se concluyó que no existía.

**Zoho Analytics sí lo tiene.** Estaba instalado, se habilitó el 28 de agosto y
quedó anotado como «sin probar». Nadie lo abrió hasta que el usuario insistió.

| Vista | Qué trae | Filas |
|---|---|---|
| `Post Insights (Páginas de Facebook)` | `Impressions` por publicación desde 2020 | 1000 |
| `Media Insights (Perfil de Instagram)` | `Reach` de feed | 85 |
| `Reels Insights` | `Reach`, `Saved`, `Shares` de reels | 206 |

Tercera vez del mismo error. La receta, los ids de vista y las cuatro trampas
del dato quedaron en `docs/09-alcance-por-zoho-analytics.md` para que la cuarta
no dependa de que alguien insista.

Cuatro trampas que salieron al usarlo:

1. **`Impressions` de Facebook no es `Reach` de Instagram.** Veces mostrado
   contra personas alcanzadas. No se suman ni se comparan de frente.
2. **No hay histórico antes de 2024.** Mediana de impresiones por año: 0 en
   2020-2022, 1 en 2023, 11 en 2024, 279 en 2025, 402 en 2026. Un cero viejo no
   es «no lo vio nadie», es que la métrica no está. De ahí el corte en
   2025-01-01.
3. **Un rótulo de columna no es una verificación.** `Saved` de Instagram trae
   valores 2 a 5 veces mayores que `Reach`, y guardar exige haber visto: es casi
   seguro impresiones mal rotulado. No se usa.
4. **El `CONFIG` de Zoho Analytics no va URL-encoded**, contra lo que dice su
   propia descripción.

Y el hallazgo que no se buscaba: `ads_get_ig_media` da un corte que Zoho Social
no da, `media_product_type`. **Los reels rinden 3.2x el promedio del feed** en
interacciones absolutas (12.3 vs 3.8), controlado por antigüedad. Pero con el
denominador que ahora existe, **ganan en alcance y no en tasa**: 3,509
impresiones contra 370 de las imágenes, con 0.39% contra 0.52%. El carrusel es
el mejor en las dos redes (FB 0.82%, IG 5.65%) — y eso converge con lo que ya
decía la Ad Library, que las referencias usan carrusel el doble que los
competidores locales (34% vs 19%).

Una segunda fuente del mismo dato no es redundancia.

### Paso 2 · El tono de marca, sacado del sitio y no inventado

`qpaypro.com` está bloqueado por la política de egreso del entorno —403 en el
CONNECT, verificado con `curl -sS "$HTTPS_PROXY/__agentproxy/status"`. Es una
política elegida al crear el entorno, **no un límite técnico**, y se puede
cambiar. Otra vez lo mismo: se había anotado como «no se puede» algo que era «no
está permitido todavía».

Como no se desbloqueó, el usuario pegó el texto de nueve landings. De ahí salió
`config/marca.json`, con lo que el sitio dice de verdad:

- El sitio se escribe **«Qpaypro»**; la documentación interna escribe «QPayPro».
- **Estructura verbal de tres verbos** en secuencia: «cobrar, operar y crecer».
- **Patrón de copy**: la fricción primero, la solución después.
- **Cero signos de exclamación y cero superlativos** en todo el sitio.
- Productos con su nombre real: QPayPOS, Qpayshop, POS Cute (GT), POS A920 (SV),
  Qpayradar + Qpayverify.
- Cinco territorios propios que **ninguna marca medida usa**: un solo
  inventario, técnico que instala, soporte local en tu horario, saber cuánto te
  queda, empezar sin comprar equipo.

Y una tabla que no existía: **`afirmaciones_bloqueadas_por_mercado`**, siete
entradas. La liquidación diaria aplica en SV y **no** en GT — lo corrigió el
usuario, y sin esa tabla un copy correcto en un mercado sería falso en el otro.

Un error propio en este paso, y vale registrarlo porque fue una inferencia mía
falsificada por el dato: atribuí el testimonio de María Belén a Belleza porque
dice «mis clientas». La landing de servicios la acredita como «María Belén
Coach». El código tenía el mismo error —tomaba el primer testimonio con sector,
no el del sector— y se corrigió con ella.

### Paso 3 · Recomendaciones con evidencia numérica obligatoria

`src/modulo1/recomendaciones.py`, ocho reglas. La regla del módulo es que **cada
recomendación carga su evidencia numérica o no se emite.** Nueve recomendaciones
salieron con la corrida real, seis de confianza alta.

Cuatro errores que encontró la revisión y que valen más que las reglas:

- `int(0.625*100)` daba 62 mientras la línea de evidencia decía `0.625`. Un
  `round()` donde iba.
- «21 promesas» para un equipo con capacidad 10: la regla contaba titulares
  distintos de un referente. Se reexpresó como **techo por promesa** («1 de cada
  6»), que transfiere entre escalas.
- La comparación de verticales se calculaba sobre el top-3 **visible**, y decía
  «0 de competidores» donde tenían en cuarto lugar.
- «44 anuncios clasificables de 43 leídos», imposible en pantalla: un titular
  que toca dos verticales cuenta en las dos, así que el total son
  *clasificaciones*. El cálculo estaba bien y el rótulo mal.

### Paso 4 · Los copys, y la skill que los redacta

Diez copys redactados —no generados por plantilla— en
`config/copys_propuestos.json`. Cada uno declara qué **no** dice y en qué
mercado está bloqueado. Y `.claude/skills/copys-qpaypro/SKILL.md`, con el tono
sacado del sitio en vez del «registro por defecto» que tenía antes.

Ningún copy se publica sin aprobación humana (regla 5). El tablero registra la
decisión; no toca Zoho Social.

### Paso 5 · Todo eso entra al tablero, y la poda

El usuario fue directo: «no me aparecen los copys y tampoco veo lo orgánico».
Se lo había contado en el chat y no lo había puesto en la herramienta. **Un
cambio que no está publicado no está entregado.**

Entraron el bloque de alcance, los copys, el dossier por marca y las
recomendaciones. Y con eso el tablero se volvió un informe: cada recomendación
con tres párrafos visibles y cada copy con cuatro. La poda dejó el texto visible
en 16,363 caracteres desde 22,373 —27% menos, 1,851 px menos de alto— **sin
borrar una sola declaración de hueco**: 38 pliegues, ninguno vacío. A la vista
queda lo que se ejecuta; a un clic, lo que lo justifica (ADR-038).

### Paso 6 · Los dos filtros, corregidos

El rango de fechas y el filtro de copy salieron mal en la primera entrega, y el
usuario corrigió las dos cosas. El rango estaba dentro de la sección de
orgánico —diciendo sin decirlo que solo filtraba eso— y el filtro de copy era
plano donde tenía que ser jerárquico.

El rango subió al encabezado y arrastró las gráficas semanales con él. Lo que no
puede filtrar —la pauta de Meta, que la corrida agrega por periodo, y la
competencia, que la Ad Library solo responde a hoy— lleva un sello ámbar «no
cambia con el rango» **en el sitio exacto**, y solo cuando hay una ventana
propia elegida. El filtro de copy quedó en dos niveles: Arte/Video, y las tres
soluciones apareciendo solo al elegir pieza (ADR-039).

También salió de aquí `src/modulo1/fusiona_estado.js`: el equipo decide dentro
de la página y la versión publicada va adelante de la del disco, así que
publicar el fragmento recién generado **borra las decisiones**. Pasó una vez con
la v48. Ahora es un script que valida antes de escribir. Esta publicación trajo
la v50 con una decisión tomada hoy y dos ideas propias del equipo.

### Estado al cierre de la Sesión 4

- El hueco del alcance orgánico, **cerrado**. Era el pendiente más viejo.
- El tono de marca, **verificado contra el sitio** y no inventado.
- Nueve recomendaciones y diez copys, con evidencia y con compuerta humana.
- El tablero publicado en la v51, con el estado del equipo intacto.

Lo que sigue: el deck del Demo Day, y las corridas retroactivas de junio y julio
como evidencia.

---

## Sesión 5 · 2026-09-04 · Datos frescos y el filtro que sí obedece

### El bloqueo real

El tablero mostraba datos hasta el **24 de agosto**. Abierto el 4 de septiembre
y filtrado a «últimos 7 días» salía vacío: no por un error, sino porque no había
dato en esa ventana. Todo lo demás era cosmética.

### Lo que se hizo

**1 · La pauta día por día, con reconciliación como compuerta.**
`src/modulo1/pauta_diaria.py` pide la pauta con `time_increment` y
`breakdowns:["country"]`, y **antes de usarla la reconcilia contra el agregado
ya verificado en V0**: mismo gasto, mismos resultados, mismas impresiones, por
campaña Y por país, al centavo. Si un valor no cuadra, la corrida **se detiene**.
No es un test que corrió una vez: corre en cada corrida (V8, 18/18 y luego
13/13 idénticos).

Cuatro reglas en el encabezado del módulo, todas nacidas de un error real:

- El **costo nunca se pide por día**. Se piden inversión y resultados, y se
  divide una sola vez sobre lo que queda dentro del filtro.
- Se **agrupa por indicador antes de sumar**, en cada punto (ADR-013).
- Un `Not available` con gasto es `None`, **no `0`** — pero contribuye cero a
  las sumas, que es lo medido.
- Una campaña con gasto en el agregado y **ausente** del desglose detiene la
  corrida.

**2 · `consolida()` estaba tirando gasto real.** $1.30 de gasto en GT sin
resultado atribuido desaparecía. Por día, eso habría borrado **$24.89 solo en
Qpayshop**. Ahora inversión e impresiones suman de **todas** las filas con
número; resultados y el conteo de campañas, solo de las utilizables. Nuevo
campo `gasto_sin_resultado`, visible.

**3 · El filtro con el ratón.** Ver ADR-041. Tres defectos, uno de ellos ya
publicado: el tablero escribía «22 días en la ventana» con una ventana de un
día. La prueba nueva (`npm run prueba:raton`) entra por el clic, no por el
estado.

**4 · Corrida completa 2026-08-25 → 2026-09-03**, de punta a punta, con las
cuatro suites en verde.

### Lo que dice el dato fresco

| | Leads | Inversión | Costo |
|---|---|---|---|
| Total | **194** | $591.42 | **$3.05** |
| GT | 107 | $358.30 | $3.35 |
| SV | 87 | $233.12 | $2.68 |

- 9 días con dato, 36 piezas día×campaña×país, 2 campañas con entrega en
  `actions:lead`.
- **$1.93 de gasto sin resultado atribuido**, declarado en el consolidado.
- **US apareció como país fuera de los mercados declarados** — nuevo, no estaba
  en la corrida de agosto. HN sigue goteando $0.02.
- Competencia GT: presión 164. **SV sigue en 0.** El mercado sin disputa
  aguanta una corrida más.
- 118 interacciones orgánicas en 10 publicaciones.

### El hallazgo para la reunión

En la corrida de agosto, **Qpayshop gastó $24.89 de $53.15 (46.8%) en 5 de sus
11 días sin un solo lead atribuido.** Eso explica su costo de $4.43, el peor del
portafolio. No es un detalle contable: es casi la mitad de un presupuesto en
días que no produjeron. En el total de todas las campañas fueron $26.19 (2.4%),
así que el problema está concentrado, no repartido.

Y «Campaña Punto de Venta SV» **entrega en GT todos los días que corre**.

### Huecos que siguen declarados

- Sin exportación de Zoho Analytics en esta corrida → **no hay tasa de
  interacción**, solo interacciones absolutas.
- El corte GT/SV de la competencia **no se filtra por fecha**: la Ad Library no
  acepta rango. Lleva su sello ámbar.
