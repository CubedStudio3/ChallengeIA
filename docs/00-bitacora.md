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
