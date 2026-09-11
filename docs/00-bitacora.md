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

### Sesión 5 · segunda parte · las cartas

Mercadeo revisó la sección de Estrategia y señaló dos cosas: que la información
estaba repartida en tres lados y que las recomendaciones no decían qué producir.
Buscando cómo arreglarlo apareció una tercera, peor: **los copys traían sus
números escritos a mano y estaban caducos.** Uno decía «SV cuesta $1.89 contra
$2.89» mientras el titular del tablero decía $2.68 contra $3.35.

Lo que se hizo (ADR-042):

1. **Una carta por pieza**, con cinco tramos: qué hacer · lo que dice el
   análisis · el copy · qué mostrar y qué NO · la referencia medida. 10 cartas,
   5 artes y 5 videos.
2. **El número deja de vivir en el config.** Cada copy declara QUÉ evidencia lo
   sostiene —diez tipos, con resolvedor cada uno— y `cartas.py` la resuelve
   contra la corrida. Lo escrito a mano es lo que no caduca: voz, ángulo, tono,
   dirección visual y texto publicable.
3. **El dato que contestaba «¿arte o video?»**, que no estaba: `ads_get_ig_media`
   sobre la cuenta propia. Los reels rinden **4.87x** el feed y se llevan los
   nueve comentarios de la muestra. `formato.py` se niega a publicarlo si la
   antigüedad lo explica.
4. **`npm run prueba:cartas`**: siete sabotajes, y una guardia permanente contra
   volver a escribir una medición a mano en el config.

Al publicar, el artefacto rechazó la publicación: alguien había guardado desde
dentro de la página a las 18:32. Se trajo su estado (v63) y se publicó encima.
El mecanismo de `fusiona_estado.js` funcionó como se diseñó — sin él, esa
decisión se habría borrado.

### Sesión 5 · tercera parte · quitar y comprobar

Mercadeo pidió quitar la tarjeta «Nosotros contra ellos» y el pie de
trazabilidad completo. Antes de quitarlos se revisó, uno por uno, dónde quedaba
cada cosa que el pie traía: los dos huecos del orgánico se declaran en sitio, HN
sale como tarea donde un humano la aplica, y el párrafo de método sigue en
`resultado.json`. Nada quedó sin declarar (ADR-043).

Los dos retiros quedaron clavados en `npm run prueba:tablero`, junto con los
tres bloques que no se pueden perder al quitarlos.

Y la revisión encontró un defecto propio: `paises_con_entrega` incluía **US con
0 impresiones y $0 de gasto**. Estaba en la segmentación sin entregar nada, y
además levantaba la alerta de mercado no declarado sobre una fila vacía. Ahora
un país entra a esa lista solo si entregó, y los segmentados sin entrega salen
aparte con su propia frase.

Sobre el estado del tablero: nadie perdió nada. El historial de versiones
guardadas dice que a las 18:32 alguien pulsó «Limpiar» desde dentro de la página
y con eso se fue la única decisión que había (`copy-belleza-anticipo`, del
periodo anterior). Las dos ideas del equipo se habían quitado el 1 de septiembre,
también desde la página. `fusiona_estado.js` trajo cada estado como estaba: no
hubo publicación que borrara trabajo.

### Sesión 5 · cuarta parte · la auditoría de accesos

Mercadeo preguntó por Zoho Flow y pidió el estado real de todos los conectores.
Se midió con `ListConnectors` y se probó cada uno con una lectura, no con la
documentación (ADR-044).

Dos correcciones al inventario: **Zoho CRM y Zoho Cliq están conectados,
encendidos y responden**. La documentación decía que CRM no estaba habilitado y
que Cliq no estaba instalado. Los dos se probaron hoy contra producción.

Zoho Flow no sirve hoy por dos razones medidas: no hay conector MCP, y
`flow.zoho.com` devuelve 403 en el CONNECT igual que `sprints.zoho.com` — los
conectores entran por otra puerta.

Y la auditoría encontró un error propio ya publicado: con el alcance de Zoho
Analytics a la vista, el «el reel rinde 4.87x el feed» de las cartas era casi
entero un efecto de alcance. El reel llega a 8.1x más gente; de la que alcanza,
el feed engancha 2.5x más. La carta ahora dice las dos cosas.

Dos hallazgos operativos que no son de código y que van al reporte para
Mercadeo: la licencia de Zoho One marca renovación el **5 de septiembre a las
18:00 GT** —el día antes del cierre de desarrollo y cuatro antes del Demo Day— y
la Rutina del lunes sigue sin conectores adjuntos, que es lo único que impide
que la corrida semanal se haga sola.

### Sesión 5 · quinta parte · el filtro terminado

Mercadeo pidió el estado antes de tocar nada, y la revisión encontró que
**ninguno** de los tres cambios al filtro estaba hecho —venían de otra
conversación— y que había un texto **falso publicado**: el plegado decía que la
pauta de Meta no obedecía la ventana, cierto por la mañana y falso desde la
tarde del mismo día (ADR-047).

Se corrigió el texto, se dejaron tres atajos —El periodo de la corrida ·
Últimos 7 días · Últimos 30 días— y se conservó el límite que ya existía, que
es más estricto que el piso de 2025 que se había pedido: solo se pueden elegir
fechas dentro del rango con dato.

Al implementarlo apareció un error de cuenta viejo: los atajos restaban los días
sin contar que el rango es cerrado, así que «7 días» daba ocho. El de 30 lo
tenía desde el principio.

La corrida fresca ya estaba: 2026-08-25 → 2026-09-03, publicada. El síntoma que
originó el pedido —«los últimos 7 días salen vacíos»— ya no ocurre: con el dato
de hoy esa ventana da 143 leads a $3.01.

Seis suites en verde. **Sin publicar**: Mercadeo pidió avisar antes.

### Sesión 5 · sexta parte · el botón vivo

Se declaró la capacidad `mcp` y el publish pasó: el botón de Sprints quedó
activo en el tablero publicado (ADR-048). Cierra el pendiente que llevaba
abierto desde ADR-045.

En el mismo publish entró el cambio del aviso de «no se filtra», que se había
dejado sin publicar a la espera de confirmación: ahora vive en la cabecera de
Competencia y de Referencias en vez del plegado de arriba (ADR-047).

### Sesión 5 · séptima parte · el responsable

Mercadeo reportó que el botón ya funcionaba —«me encanto que ya se pudiera»— y
que solo faltaba una cosa: «no me deja asignar a dulce, solo a jeremy».

Lo primero fue medir en lugar de interpretar. Las dos explicaciones cómodas —el
id de Dulce está mal, Dulce no es usuaria del proyecto— se descartaron con
evidencia: su id aparece en el mapa de usuarios que devuelve `GetItems` sobre
SP49, y un item de prueba creado con su id (I1174) quedó con `ownerId` en Dulce
y se borró. **La API la acepta sin objeción.** El defecto era del tablero.

Y era peor que el síntoma. El selector de responsable solo se pintaba después
de decidir, y `users` solo viaja en la creación, que ocurre en el mismo clic:
ningún item podía nacer con responsable, y elegirlo después no salía de la
página. Comprobado contra el estado en vivo (v80) y el backlog real: la carta
de Tienda en Línea decía Dulce y el item I1172 estaba sin dueño. **La página
afirmando algo que el sistema no tiene**, que es justo lo que la regla 3 llama
peor que no reportar.

El arreglo tiene tres piezas: el selector se pinta antes de decidir, así el
item nace con su dueño; `UpdateItem` reasigna lo que ya existe, con `newusers`
y `delusers` en una sola llamada —verificado en producción con I1175, creado
con Jeremy, reasignado a Dulce y borrado—; y la tarjeta declara el responsable
que **Sprints** tiene, escrito con el `ownerIds` que devuelve la respuesta y no
con lo que se pidió. Si los dos no coinciden, se ve la diferencia.

Dos trampas nuevas al arreglarlo. `Unassigned` es un id de verdad
(`21897000000002005`): tomarlo por persona haría creer que un item sin dueño
está asignado. Y contar decisiones por la presencia de la llave se rompió en
tres contadores, porque ahora existe un registro con `estado` en null —el que
guarda un responsable elegido antes de decidir—.

`npm run prueba:boton` pasa de 30 a 57 comprobaciones. Detalle en ADR-049.

### Sesión 5 · octava parte · tres meses para mirar

Mercadeo pidió más meses de dato con una condición explícita: «el análisis, la
estrategia y las recomendaciones tienen que seguir siendo de la semana. No
quiero recomendaciones sacadas de un promedio de tres meses.» Y el método:
cuatro pares, cada mes reconciliado contra sí mismo, y el mes que no cuadre no
entra y se declara.

Junio, julio y agosto de 2026, en pares agregado + desglose diario. Los tres
cuadran al centavo: 26, 16 y 22 valores comparados. 402 piezas históricas, 414
en total con la semana.

**La trampa del día:** `limit` sin especificar trunca en 200 filas, en silencio
y sin cursor. La consulta de los tres meses devolvió 200 cuando junio sola ya
daba 165. Con `limit=1000`, 416. Con `object_ids` no hay paginación que avise: un
truncamiento se ve igual de completo que el dato completo. **Lo agarraron las
tres compuertas a la vez** — primera vez que detienen un dato real y no un
sabotaje de prueba.

Del lado del tablero hubo que cambiar algo que antes no importaba. Con un solo
periodo de pauta, «todo el dato» y «la semana» eran lo mismo; con tres meses
cargados, abrir sin ventana sumaba junio a septiembre y lo mostraba como si
fuera la semana, al lado de cartas calculadas sobre la semana. Ahora el tablero
abre en `ventana_de_la_corrida`, y el ámbar se mide contra esa ventana y no
contra el tope del dato: ámbar significa «alguien acotó esto».

**Dos predicciones propias resultaron falsas.** Se eligieron estos meses
argumentando que «el indicador ya es el mismo de hoy y no hay Honduras». Junio
trae cinco indicadores, y `mixed` son $805.40 con cero resultados atribuidos —el
mayor gasto del mes—; agosto trae Honduras, $0.04 en 8 días. La decisión se
sostiene igual, pero por el diseño —agrupar por indicador ya era obligatorio
(ADR-013), Honduras ya se excluía declarando su gasto— no por el pronóstico.

La prueba del filtro destapó un tercer hallazgo: daba por hecho que «este
mercado no tiene `actions:lead`» equivalía a «no tiene pauta». El 17 de julio SV
solo trae `QualifiedLead`. El producto se portó bien —nombra el indicador, no
inventa costo por lead, avisa que no se suman—; la prueba estaba mal.

El peso, medido: **716 KB, de 672. +6.5%.** Se había estimado 1.8 MB; el error
fue de 2.4x en la dirección segura. Detalle en ADR-050.

### Sesión 5 · novena parte · el tablero para la reunión

Mercadeo pidió limpiar el tablero con una regla: «lo que el sistema no puede
medir no se borra, se pliega». Nueve textos de relleno fuera, las leyendas de
periodo reducidas a una línea, los cuatro bloques de huecos plegados con un
renglón por punto —«Qué no incluye · N»— y el detalle largo en el repositorio.
Las fechas pasan a «mar 25 ago – jue 3 sep».

El error del teclado resultaron ser TRES, y dos los abrí yo al arreglar el
primero. (1) Con `min` y `max` dentro del mismo año, Chromium no deja escribir
el año y sus dígitos caen sobre el día. (2) Al preservar el control para no
romper el tecleo, desprenderlo del DOM disparaba `focusout` y la reconciliación
sobrescribía lo tecleado —`activeElement` seguía diciendo «fDesde» mientras el
valor cambiaba solo—. (3) El campo sin foco quedaba congelado mostrando la
ventana anterior. Los tres medidos y cerrados, con la secuencia de dos campos
como comprobación permanente.

Después Mercadeo cambió el punto 4: sin botón de reemplazo, y borrar las fechas
tiene que devolver la vista completa. **No lo hacía** —vaciar y no haber tocado
eran el mismo estado— y se arregló separándolos (ADR-051).

Y se trajo del 4 al 6 de septiembre, que faltaban porque la última corrida es
del 4 y la Rutina se detuvo hoy en su compuerta por no tener conectores. El
tope llega a 1 jun – 6 sep, con los cuatro meses cuadrando al centavo.

### Sesión 5 · décima parte · Square global, y las dos mitades aparte

Tres cambios pedidos por Mercadeo. Los dos bloques de prosa de las tarjetas
—«Lectura estratégica» y «Cómo apuesta»— fuera: la tarjeta ya muestra lo
medible y el texto interpretado competía con él.

Square aparecía vacío y la causa era la consulta, no la marca: se le preguntaba
por GT y SV, donde tiene cero. Sin `countries`, 123 anuncios activos y un perfil
completo. Dos trampas del corte global se cerraron en la vista: el rótulo decía
«anuncios que disputan» —lo contrario de por qué se leyó global— y el número se
repetía bajo GT y bajo SV, 123 y 123, que lado a lado suman 246 en la cabeza de
cualquiera.

Y Pauta y Orgánico quedaron en dos secciones. El pedido fue de legibilidad, pero
la razón de fondo es que los dos números no se pueden sumar: uno trae leads con
corte por país y el otro interacciones absolutas sin corte, con serie acumulada
y sin tasa. Tenerlos juntos invitaba a la operación que este proyecto no permite.

Detalle en ADR-052.

### Sesión 5 · undécima parte · La estrategia elegida ahora sí manda

Mercadeo reportó que al elegir otra estrategia las tareas no cambiaban. Se midió
antes de tocar nada y el reporte apuntaba al síntoma correcto con la causa en la
lista de al lado: las tareas SÍ filtraban; las **diez cartas de producción** no,
porque llegaban sin declarar a qué estrategia sirven. Como las cartas son la
sección grande de la pantalla, «no cambia nada» era la lectura honesta.

La estrategia de cada carta se **deriva de la evidencia que ya declara**, no se
escribe en el config. Cada tipo de evidencia afirma algo —«este mercado es más
barato» apunta a un lado, «el competidor dice esto» a otro, «esto ya funcionó en
nuestra cuenta» a otro— y la que solo dice *cómo producir* no elige: esa carta
sirve a las tres. Escribirlo a mano habría repetido el error que ADR-042 ya
había corregido para los números.

El primer mapeo le dio a `disputar-el-flanco` las 10 de 10, o sea el mismo
síntoma con código que filtraba. Por eso la prueba lleva un guardia explícito
contra que una estrategia se quede con todas. El reparto que quedó, medido:
4 / 9 / 6 sobre 10, con la recomendada en 4. `disputar-el-flanco` cubre 9 porque
la mayoría de los copys se apoyan en el mensaje del competidor: es la estrategia
más ancha, y se deja así en vez de ajustar el mapeo para que se vea parejo.

Las dos listas comparten ahora un solo predicado. Estaban separadas y por eso
divergieron.

La prueba nueva —`npm run prueba:estrategia`, por el clic, no por debajo—
encontró algo que ninguna revisión visual hubiera visto: el rótulo decía «Activa
1 tarea» donde se ven 2, porque contaba con la lista que arma Python y esa no
incluye la tarea que sirve a las tres. Y la primera versión de la prueba **acusó
al producto de un error que no tenía**: contó botones sin saber que las cartas y
las tareas comparten el mismo, leyó 6 donde esperaba 4. Las dos cosas quedan
anotadas como trampas.

«Territorios de mensaje» se quitó entero de la pantalla. El dato sigue en
`resultado.json` a propósito: de ahí derivan las tareas de estrategia. Borrarlo
porque se quitó su tarjeta habría vaciado las tareas.

Detalle en ADR-053.

### Sesión 5 · duodécima parte · Las tareas también llegan a Sprints

Mercadeo preguntó si las tareas aceptadas se crean en Sprints igual que las
cartas. La respuesta era **no, y en silencio**: se pulsó el botón con el
conector simulado y la tarea no hacía ni una llamada. Guardaba «Aceptada» y
nada más.

Dos causas reales, no una: `decidir()` preguntaba solo por cartas, y las tareas
no traían payload porque ese constructor **no existía** —el cuerpo de una tarea
se armaba en línea dentro del paso 9, así que la línea de comandos sabía
crearlas y el botón no—. Ahora vive en su propia función y los dos caminos la
usan; comprobado campo por campo que producen el mismo item.

La tarjeta de tarea también muestra qué pasó en Sprints. Sin eso, el arreglo
habría cambiado un fallo callado por un acierto callado.

Y buscando confirmar la forma del número de item apareció una trampa que solo
contesta producción: **`CreateItem` devuelve «I1180» y `GetItems`, para ese
mismo item, «1180»**. Los dos endpoints de Zoho, el mismo campo, dos formas. La
página ponía su propia «I» delante de las dos y escribía «II1180» después de
crear. Estaba en cuatro llamadas repetidas; ahora se normaliza en una.

En el camino me equivoqué: con solo `GetItems` medido concluí que el doble de la
prueba mentía y cambié el doble. Era al revés. Un endpoint no dice la forma del
otro, y medio dato dio un diagnóstico invertido.

El hueco duró porque la prueba del botón cubría las cartas desde ADR-046 y las
cartas funcionaban. Una prueba que cubre un camino de dos no dice nada del otro,
y su verde se lee como si dijera algo.

Verificado contra producción con el ciclo crear / comprobar / borrar: item
I1180 creado con su responsable (Elizabeth Sierra), leído y borrado. El backlog
quedó limpio.

Detalle en ADR-054.

### Sesión 5 · decimotercera parte · Lo que el estado en vivo delató

Al fusionar el estado para publicar aparecieron dos cosas.

La doble «I» no era teórica: el estado de la versión en vivo la tiene grabada
con las dos formas a la vez —«I1170» en los items creados, «1171» en los
encontrados—. En la página que el equipo usó el 7 de septiembre, unas tarjetas
decían «II1170» y otras «I1171». La normalización al pintar arregla también lo
ya guardado, sin migrar nada.

Y seis items que el estado declara creados **no están en el backlog de
Sprints**. Se borraron a mano, probablemente después de probar. La página no lo
sabe: sigue diciendo «Creada en Sprints» de un item que no existe, porque solo
vuelve a leer cuando se acepta otra vez. Queda declarado, sin tocar: borrarle
el estado a Mercadeo por decisión propia sería peor que el desajuste.

Lo tercero es un defecto de método, y es el que más vale: las suites corrían
contra el archivo publicado, que lleva el estado del equipo dentro. Dos se
pusieron rojas sin un error de código —la página abría en la estrategia que
alguien eligió, y el botón pulsaba una carta ya aceptada, que es un toggle—.
El caso simétrico es el peligroso: un estado en vivo puede poner una suite
verde por la razón equivocada y eso no avisa. Ahora las pruebas blanquean el
estado antes de cargar la página. Misma clase de error que el fixture en /tmp,
en forma nueva.

### Sesión 5 · decimocuarta parte · La estrategia con plan

Mercadeo pidió que la tarjeta de estrategia dejara de ser solo la premisa y
trajera el plan: cuántos artes y videos, por qué funciona, y qué es de pauta y
qué de orgánico.

Las piezas se cuentan de las **cartas** que cada estrategia activa —la unidad
que la mesa aprueba— contra la capacidad declarada. Medido: 2+2 para empujar SV,
4+5 para el flanco de Paggo, 1+5 para repetir lo propio. Las dos últimas dejan
los videos al tope exacto, y el veredicto lo dice: decir solo «sobra 1 arte»
habría dejado creer que había margen en los dos.

El corte pauta/orgánico sale de **dónde se midió** la evidencia de cada carta, no
de una predicción. Meta Ads y la Ad Library son pauta —la Ad Library solo
publica anuncios pagados—; la cuenta propia es orgánico. No es una distinción
inventada: los dos canales traen recomendaciones distintas y medidas por
separado, y una carta con las dos sirve en los dos por razones distintas. Los
subtotales no suman el total, y eso se dice donde está el número.

El paso que más cuidado necesitó fue el del formato. El reel gana en alcance
8.1x pero el feed gana en tasa 2.51x: el análisis marca que se contradicen.
Citar solo la mitad que conviene era el uso más fácil del dato y el más
deshonesto. El paso dice las dos y se limita a las piezas de descubrimiento, que
es la lectura del análisis.

Cada plan deja además contra qué se sabrá si funcionó: la base de esta corrida y
cuál de esos números apuesta a mover cada estrategia. Sin meta: escribir «bajar
a $2.40» sería un pronóstico con cara de dato.

Y el bloque de ángulos quedó alineado sin abrir una segunda cuenta de la misma
semana: el rótulo dice «ángulos» y no «tareas», y tanto la cabecera como el
motivo de cada tarea dicen que no son piezas adicionales. Reestructurar esa capa
es más grande que el pedido y hoy es Demo Day; queda como deuda declarada.

Las tres tarjetas abiertas daban 8000 px de sección. La elegida va abierta y las
alternativas plegadas: se comparan las premisas, se elige, y de ahí se siguen
los pasos.

Detalle en ADR-055.

### Sesión 5 · decimoquinta parte · La estrategia, recortada para la mesa

Mercadeo dijo que la tarjeta ganó estructura pero se llenó de cosas, y que es
para leerla rápido en una reunión. Se midió antes de recortar: había párrafos de
317, 247, 216 y 102 caracteres, y la frase de arriba tenía 137.

La medición destapó dos duplicaciones que a ojo no se veían. El paso «Repartir
las piezas» repetía **palabra por palabra** el bloque de canal que ya está
arriba —tres bloques para una pregunta—, y «Cabe en la semana» salía dos veces,
en la etiqueta y otra vez en la línea de abajo. El paso se quitó y la línea
quedó con el delta, que es lo que se lee.

Arriba quedó lo que se decide: nombre, una frase, los contadores con su techo,
el delta, una línea de canal, los pasos como imperativos y la apuesta con la
base compacta. Todo el sustento —premisa, cuándo no conviene, evidencia, el por
qué y el dato de cada paso— bajó a **un solo** pliegue. No se borró nada: es la
misma regla de siempre, lo que no es relevante ahora se pliega.

Y las tres tarjetas volvieron a mostrarse iguales. Con los párrafos dentro de
los pasos había que plegar las alternativas; con el imperativo solo, la tarjeta
cabe de un vistazo y comparar las tres es justo lo que hace la mesa.

De ~7.900 px a ~2.400 px de sección, y el renglón más largo de 317 a 60
caracteres. La brevedad quedó como medida, no como opinión: la prueba mide la
tarjeta con el pliegue cerrado y se pone roja si un renglón pasa de 72
caracteres.

Dos errores propios: «Sobran 1 arte» mal conjugado, y mi propia prueba acusando
al producto de un «territorio» que era el sustantivo común en prosa, no el
bloque que se quitó. Buscaba la palabra donde debía buscar el bloque.

Detalle en ADR-056.

### Sesión 5 · decimosexta parte · La estrategia se rediseña alrededor de la apuesta

Mercadeo pidió un rediseño en tres partes, con una regla que ordena todo: la
reunión tiene que poder elegir entre tres opciones y salir con tareas listas,
sin armar la conexión mentalmente.

**Primero el error que reportó, porque tenía razón.** «8 pauta · 5 orgánico · 5
en los dos · 1 sin canal» sumaba 19 sobre 9 cartas. La aritmética estaba bien
—3 + 0 + 5 + 1 = 9— y el rótulo estaba mal: eran conjuntos solapados
presentados como una lista de partes. Había una nota mía al lado diciendo «no se
suman», que era una curita sobre un rótulo roto. Ahora se publica la partición,
con el total al final para comprobarla de un vistazo, y Python se detiene si no
suma.

**La apuesta era lo que faltaba y era lo importante.** La tarjeta decía «la
promesa que la competencia no cubre» sin nombrarla nunca. El problema de fondo:
una estrategia activa hasta 9 cartas con ángulos distintos, así que no tiene una
promesa, tiene un criterio. La salida fue derivar la frase de los ángulos de sus
propias cartas: no puede contradecirlas porque está hecha de ellas. Hoy dice
«Paggo paga por "Gestiona tu Negocio Fácil" —95% de sus activos, 109 días vivo—
y ninguno de esos ángulos lo toca».

**Y el dato con comparación destapó algo incómodo.** Contra los 10 días
anteriores —posible por primera vez desde que hay pauta diaria— el costo por
lead subió 51% en la cuenta: GT +71%, SV +27%, verificado con las mismas
campañas y el mismo indicador. SV sigue siendo el mercado más barato y el que
menos se degradó, así que la recomendación se sostiene; pero con solo «12% bajo
el promedio de la cuenta» el número se leía halagüeño. Es exactamente por lo que
Mercadeo pidió que ningún número saliera suelto.

Los pasos se fueron. El de presupuesto no: bajó a Cambios en Meta Ads ligado a
su estrategia, porque es la única salida que tiene la regla 8.

**Las cartas quedaron autosuficientes.** Formato como etiqueta, a dónde va,
mercado, la estrategia con su nombre enlazado, y el copy con su mercado y el
sello «Para aprobar» —sin afirmar el tono, que no está definido—. La campaña y la
fecha salen vacías porque el sistema no puede derivarlas: una es decisión de
medios y la otra de personas. La prueba se pone roja si alguien las rellena.

Y apareció una trampa nueva: `persistir()` repintaba el innerHTML, así que el
input perdía el foco en cada tecla y escribir una campaña era imposible. Mismo
problema que el retardo del buscador, en otra forma.

Queda escrito sin hacer, por decisión de Mercadeo: partir las estrategias más
finas (ADR-060). El sistema ya avisa cuando una agrupa más de 3 ángulos, para
que la decisión se tome con la evidencia enfrente.

Detalle en ADR-057, ADR-058, ADR-059 y ADR-060.

---

## Sesión 17 · 2026-09-10 · el tercer camino

Pedido de Mercadeo, en una línea: que cada idea que la mesa escribe se vuelva
una tarea en Sprint «así», como las otras. Y que se borre el texto que explica
por qué no se crean solas.

Las dos mitades del pedido resultaron ser la misma cosa. El texto decía que
esta página vive en un navegador y no puede llamar a Zoho — y **eso dejó de ser
verdad el 2026-09-08**, cuando el tablero declaró la capacidad `mcp` y empezó a
crear items con el conector del visitante. Un texto que explica una limitación
que ya no existe enseña a no confiar en el botón que sí funciona.

El tablero tenía tres orígenes de trabajo y dos escribían: las cartas y las
tareas de estrategia. La idea del equipo se quedaba en la página. Es la misma
forma del hueco de ADR-054, un mes después y en la otra lista.

**Por qué se había quedado fuera, y no fue olvido.** Las cartas y las tareas
traen su payload armado por Python, y el botón solo lo reenvía; es deliberado,
para que los dos caminos creen items idénticos. La idea del equipo no puede
tener payload de Python: nace escrita en el navegador cuando Python ya corrió.
Así que se arma en el navegador — y la garantía de que no divergen es una
prueba que le pide el esperado a `sprint.plan()` en el momento, no un texto
copiado a mano. Ya caducó dos veces un esperado escrito aparte (ADR-050).

**Y ya había divergido en silencio.** El CSV tenía una tercera copia del mismo
texto que unía las referencias con `"  - "` donde las otras dos usan `"  · "`.
Solo se habría visto comparando un item importado por CSV con uno creado por el
botón, que es cuando ya no sirve enterarse.

Lo que el arreglo arrastró: dos ids nuevos en el destino de Sprints, una
compuerta para el tablero viejo que no los trae, `responsableDe()` porque el
dueño de una idea vive en otro sitio que el de una carta, un tercer texto en el
sello de Sprints —de una idea del equipo NO se puede decir «con la evidencia
adentro», porque justamente no la tiene—, el aviso de que quitar una idea ya
creada no borra su item, y el quinto `"I" + itemNo` que ADR-054 no había
alcanzado.

Detalle en ADR-061.

Y no se dejó en «probado contra el doble»: se corrió el ciclo de ADR-029 contra
el proyecto de producción con el payload exacto de una idea del equipo. Zoho lo
aceptó (`I1187`), la lectura lo devolvió como `1187` —la trampa del doble número
confirmada en un segundo item, no solo en el de ADR-054—, el item nació con su
responsable, y se borró dejando el backlog como estaba.

---

## Sesión 18 · 2026-09-10 / 11 · la referencia visual y todo 2026

Dos pedidos que llegaron juntos: un botón para generar el arte de una carta con
Higgsfield sin salir del tablero, y cargar enero a mayo de pauta porque «al
pedir enero parece que el filtro no responde».

### El botón de imagen

Se midió antes de escribir, y lo medido cambió el diseño entero. **Generar sí;
mostrar no.** El visor de artefactos bloquea toda carga externa de imágenes y
todo `fetch`, sin error visible — así que la imagen no se puede mostrar dentro
del tablero ni con `<img>` ni bajándola para subirla con `assets`. Se entrega
como enlace y la tarjeta lo dice, porque un rectángulo gris bloqueado se lee
como un error del tablero.

El segundo muro es de otra clase: `d8j0ntlcm91z4.cloudfront.net` está bloqueado
**también en el entorno de esta sesión** (`connect_rejected · 403`). Eso es
política de egreso y se cambia — y mientras no se cambie, **nadie de este lado
puede ver una imagen generada**. Tercera vez que este proyecto anota como
límite algo que era «no está permitido todavía».

El prompt lo arma Python, por la misma razón que el payload de Sprints. Tres
reglas dentro: ninguna medición entra a la imagen —la guardia de ADR-042 se
subió de la prueba al código, porque ahora la usan dos módulos—, el logo no se
genera, y un formato desconocido detiene la petición en vez de caer en un
cuadrado.

Tres defectos que aparecieron al escribirlo: el collage (las tres tarjetas de un
carrusel en una imagen no son ninguna de las tres), la justificación de
`no_mostrar` escrita DENTRO del arte («marcada REVISIÓN LEGAL»), y el cero-falsy
en `poll_after_seconds || 10`. Los dos primeros los vi leyendo la salida; el
tercero lo encontró la prueba.

Detalle en ADR-062.

### Los nueve meses

Enero se trajo a mano y pasó la compuerta —81 piezas, 30 valores reconciliados—
y con la receta probada se delegaron febrero a mayo a `analista-meta`. Dos
agentes murieron por límite de sesión y uno no reportó, pero **lo que importa no
es su reporte: es la compuerta**. Al medir el disco, marzo, abril y mayo estaban
completos y reconciliaban al centavo; solo faltaba el diario de febrero.

**El tope de 200 filas dejó de ser hipotético:** abril devolvió 212 y marzo 195.
Sin el `limit=1000` explícito, abril habría salido truncado en silencio.

**Aparecieron dos indicadores que no estaban en ninguna parte de esta
documentación:** `actions:onsite_conversion.lead_grouped` y
`actions:leadgen.other`. Con eso 2026 tiene seis. En enero, `link_click` son
8,740 «resultados» al lado de 243 leads.

**Y un defecto de evidencia, propio.** Al transcribir el diario de enero a mano
se perdió el espacio duro que la API pone antes de «USD». Midiendo se vio que
no era solo enero: seis de dieciocho archivos crudos no son copia byte a byte,
incluidos tres de sesiones anteriores. Ningún número cambia —`parsea_numero()`
borra todo lo que no sea dígito, coma, punto o signo, y los nueve meses
reconcilian— pero la promesa de que el crudo es copia fiel de la consulta es
falsa en esos seis. **No se arregló insertando los NBSP a mano:** un crudo
editado a mano es peor evidencia que uno declarado como no fiel.

De paso, el agente de febrero reportó una fidelidad que no tenía —dijo 200
ocurrencias «igual que su agregado» sobre un archivo con 202 montos—. Un reporte
de subagente es una hipótesis; lo que verifica es la compuerta.

`rango_disponible` quedó en **2026-01-03**, no 01-01: el 3 es el primer día con
entrega. Un rango que empezara el 1 afirmaría dato donde no hay.

---

## Sesión 19 · 2026-09-11 · se quita la referencia visual

Mercadeo la vio y fue directo: «quedó muy mal, mejor quitemos lo de Higgsfield».

Se quitó entera —botón, render, lógica de sondeo, estado, el módulo del prompt,
su prueba y sus dos scripts— y la capacidad `mcp` del artefacto vuelve a
declarar solo Zoho Sprints. El alias `mcp`/`sprints` se revirtió a la variable
única: con un conector era indirección sin uso.

**La lección es la que vale, y es incómoda.** Se construyó una función visual
completa sin poder ver su salida: `d8j0ntlcm91z4.cloudfront.net` está bloqueado
por la política de egreso, así que desde acá no se abrió ni una sola imagen
generada. Las 28 comprobaciones en verde miraban todas lo que pasa ANTES del
generador —que el prompt fuera el de Python, que el sondeo estuviera acotado,
que un trabajo pagado no se perdiera— y ninguna podía contestar la única
pregunta que importaba.

Por eso ADR-062 dice textualmente «no se afirma que el prompt produzca buen
arte: solo que produce el prompt correcto». La reserva era correcta y resultó
ser el punto entero.

Lo barato era desbloquear el dominio, generar UNA imagen y mirarla. Media hora
al principio habría ahorrado el resto. **Verificar lo barato antes de construir
lo caro** — la versión cara de la lección de método del 2026-08-27.

Lo que NO se borró: las trampas medidas sobre el visor y sobre la política de
egreso siguen en CLAUDE.md, porque valen para cualquier intento futuro; y
ADR-062 se queda, porque sin él ADR-064 no explica qué revierte. Un hallazgo no
se borra porque la función que lo descubrió se haya quitado.

Detalle en ADR-064.

---

## Sesión 20 · 2026-09-11 · «datos reales en tiempo real»

**Pregunta de Mercadeo, en dos tiempos:** primero «porque me dice que solo
podemos ver hasta al 6 de septiembre?», y al contestarla, «pero y si yo quisiera
agarrar tambien el dia de hoy no se puede? la idea es que tengamos los datos
reales en tiempo real».

### Por qué el filtro se detenía el 6 de septiembre

No era un tope del filtro. Era el borde del dato: el par de crudos de septiembre
se pidió el día 7 con `until: 2026-09-06`, y nadie volvió a pedir nada. El día 6
era el último completo en ese momento, y el 4 el primero para no pisar la
corrida del 25 de agosto al 3 de septiembre. `rango_disponible` decía la verdad
—sale del dato— pero la verdad era que el dato se había quedado atrás.

### Se midió antes de decidir

1. **Meta sí devuelve el día en curso.** No hay límite de acceso.
2. **Va al 20-27% de un día completo.** GT $7.97 contra $29.65 de día típico;
   SV $4.28 contra $20.01. Las impresiones, al 21-22%.
3. **Un día queda firme a los ~2 días de cerrar.** Se volvió a pedir el 4-6 de
   septiembre y se comparó fila por fila contra lo guardado: el 4 y el 5,
   idénticos; el 6 —consultado un día después de cerrar— se movió $0.07. Los
   leads, quietos en los tres.
4. **El día en curso se mueve mientras se mira:** dos consultas con minutos de
   diferencia dieron $7.53 y $7.93 en GT.

### Qué quedó hecho

- Septiembre re-pedido del **4 al 10**. Compuerta en verde: 7 días, 15 valores
  al centavo. `rango_disponible` → **2026-09-10**; el filtro, **1,245 piezas**.
- `dia_en_curso.py` y su crudo aparte. **Fuera de `piezas`**, que es lo único
  que el filtro suma: la separación es de dato, no de rótulo.
- La franja del tablero, pegada al filtro, con el avance en **porcentaje** —la
  zona horaria de la cuenta sigue siendo desconocida— y la hora de lectura
  rotulada UTC.
- `npm run prueba:hoy`, 15 comprobaciones. La que importa: con el filtro abierto
  de par en par, la inversión sigue sin incluir el día en curso.
- Rutina **diaria** `trig_01G5JLyctdfbuViKw79AEMgS` (06:00 GT), separada de la
  semanal: solo mueve el dato, nunca el análisis.

### Lo que no quedó resuelto

- **Las dos Rutinas siguen sin conectores.** La creación de hoy devolvió la misma
  advertencia de siempre: el parámetro está cerrado para esta organización y hay
  que adjuntarlos desde la interfaz de Routines en claude.ai. Sin eso la diaria
  se detiene en su Compuerta 0 y no toca el tablero.
- **«Tiempo real» literal no existe acá** y se dijo así: el visor bloquea todo
  `fetch` externo, la única capacidad MCP declarada es Zoho Sprints, y la
  frescura viene de volver a correr.

### Un agujero cerrado antes de publicar

El crudo del día en curso lo refresca la Rutina diaria — pero **la corrida
semanal también regenera el tablero**, y habría tomado el archivo que hubiera en
disco. Un lunes habría mostrado la lectura del viernes rotulada «día en curso».
El bloque ahora declara `es_de_hoy` contra el `--hoy` de la corrida, y la franja
pasa a «Último día leído · No es hoy» en vez de mentir. Con su sabotaje en
`prueba:hoy`.

### Un error propio, anotado

`prueba:hoy` acusó al tablero de mostrar $6,164.71 donde «debían» ir
$13,898.54. El tablero tenía razón: la prueba había sumado los seis indicadores
de 2026 en un solo número, que es exactamente lo que ADR-013 prohíbe. El
esperado de una prueba puede cometer la trampa que el producto ya esquiva.
