# Mesa Creativa · QPayPro

Sistema agéntico para el área de Mercadeo. Tres módulos sobre una base compartida.

- **Cierre de desarrollo:** 5 de septiembre de 2026
- **Demo Day:** 9 de septiembre de 2026
- **Repositorio:** CubedStudio3/ChallengeIA
- **Rama de trabajo:** `claude/proyecto-desde-cero-h3s7vr`

---

## Estado del proyecto

**Módulo 1 · operativo de punta a punta. Decisión de alcance del 2026-08-31:
solo Módulo 1. Los Módulos 2 y 3 quedan fuera.**

Verificado contra sistemas reales, no contra documentación:

- ✅ **Meta Ads** — lectura, convención de fechas verificada al centavo (V0)
- ✅ **Meta Ad Library** — las 6 marcas del registro, en los 2 mercados
- ✅ **Zoho Social** — 3 redes, publicaciones con interacciones nativas
- ✅ **Zoho Sprints** — lectura Y **escritura**: ciclo crear/verificar/borrar
  ejecutado contra producción el 2026-08-31 (ADR-029)
- ✅ **Tablero** — publicado, con estado compartido que sobrevive a republicaciones
- ✅ **Rutina semanal** — `trig_01CWh3gdJWfDKGzR4MDB6qhs`, lunes 07:00 GT.
  ⚠️ **Le faltan los conectores**: el parámetro no está disponible para esta
  organización, así que hay que adjuntarlos desde la interfaz de Routines en
  claude.ai. Sin ellos la Rutina se detiene en su Compuerta 0 y NO toca el
  tablero, a propósito.

`config/equipo.json` está **desbloqueado** (`_lock: false`): los cinco IDs de
Sprints, las tres personas con su rol y la capacidad semanal están completos.

Falta por decisión, no por bloqueo: el **alcance orgánico** no viene por API y se
descartó en lugar de capturarlo a mano — un paso manual dentro de una
automatización semanal es una bomba de tiempo. Se reportan interacciones
absolutas y el hueco queda declarado.

## Reglas que no se negocian

1. **Cero datos inventados.** Falta un dato → el sistema se detiene y lo reporta.
   Está prohibido rellenar con estimaciones, promedios o ejemplos.
2. **Plan antes que código** en toda tarea no trivial. Si a mitad de la
   implementación el plan resulta incorrecto, se detiene y se replantea; no se
   parcha.
3. **Falla ruidosamente.** Un reporte con un número inventado es peor que un
   reporte que no se generó.
4. **Solo el agente `orquestador` escribe en sistemas externos.** Los agentes de
   análisis leen y producen archivos. Un error de análisis nunca puede publicar
   ni modificar algo en producción.
5. **Ningún copy se publica sin aprobación humana.** Decisión de diseño en
   contexto de fintech. No se elimina por conveniencia.
6. **`--dry-run` obligatorio** en toda operación que escriba en sistemas externos.
   Debe mostrar exactamente qué haría, sin hacerlo.
7. **Operaciones idempotentes.** Dos corridas del mismo periodo no duplican
   tareas ni posts.
8. **Meta Ads es SOLO LECTURA.** Ninguna escritura de ningún tipo: no crear
   campañas, conjuntos de anuncios ni anuncios; no modificar presupuestos,
   objetivos ni estados; no subir conversiones. **Ni siquiera en estado
   pausado.** Instrucción explícita del usuario, 2026-08-27. Ver ADR-012.
9. **Nunca escribir en producción durante desarrollo.** Ver la convención de
   pruebas en `docs/decisiones.md` (ADR-012).

### Matriz de permisos por sistema

| Sistema | Permiso | Nota |
|---|---|---|
| Meta Ads | 🔒 **solo lectura** | Prohibición explícita del usuario. Si una acción requiere escritura, se redacta la instrucción exacta y se crea la tarea en Sprint para que un humano la aplique |
| Meta Ad Library | 🔒 solo lectura | Es una API pública de consulta |
| Zoho Social | ✍️ escritura | Únicamente borradores con `isApprovalNeeded: true`. Nunca publicación directa. X/Twitter excluido (ADR-008) |
| Zoho Sprint | ✍️ escritura | Work items y tareas, en proyecto de prueba durante desarrollo |
| Sistema de archivos | ✍️ escritura | Artefactos, decks, registros |

Y sobre esa matriz sigue vigente la regla 4: **solo el agente `orquestador`
ejecuta cualquier escritura.** Los agentes de análisis leen y producen archivos.

---

## Constantes del proyecto

| Constante | Valor | Estado |
|---|---|---|
| Cuenta publicitaria Meta | `225318458221662` | heredado del trabajo previo |
| Pixel | `249008005669655` | heredado del trabajo previo |
| Evento de las campañas con gasto | **`actions:lead`** | ✅ verificado 2026-08-27 (V0) |
| `QualifiedLead` | evento personalizado del pixel, 1 campaña, 1 resultado | ✅ verificado 2026-08-27 |
| Métricas correctas | `results` / `cost_per_result` | ✅ verificado al centavo (V0) |
| Competidor: Paggo | page_id `105294361957860` | pendiente de re-confirmar (V5) |
| Competidor: Recurrente | — | page_id NO obtenido |
| Competidor: Square | — | page_id NO obtenido |
| Mercados | Guatemala (GT), El Salvador (SV) | — |
| Zona horaria de la cuenta | desconocida | ya NO bloquea: la API respeta la zona de la cuenta sin ajuste |
| Convención de fechas | `time_range` con rango **cerrado** | ✅ verificada, 12/12 valores |

---

## Conectores: estado real (corregido 2026-08-27)

Fuente: `ListConnectors`. **Distinguir dos cosas distintas:** que un conector
esté *instalado en la organización* y que esté *habilitado en la sesión*. Un
conector instalado pero apagado no expone herramientas — y eso NO significa que
no exista.

| Conector | Instalado | Habilitado aquí | Auth |
|---|---|---|---|
| Meta MCP (incluye Ad Library) | ✅ | ✅ | ✅ |
| Zoho Sprint | ✅ | ✅ | ✅ |
| Zoho Social MK | ✅ | ✅ | ✅ |
| Zoho CRM | ✅ | ❌ | ⚠️ desconocida |
| Zoho Mail Gerencia | ✅ | ❌ | ⚠️ desconocida |
| Zoho Analytics Gerencia | ✅ | ✅ habilitado 2026-08-28 | ⚠️ sin probar |
| Zoho Books | ✅ | ❌ | ⚠️ desconocida |
| Zoho Desk | ✅ | ❌ | ⚠️ desconocida |
| Zoho Desk Artículos | ✅ | ❌ | ⚠️ desconocida |
| Zoho Cliq, PageSense | ❌ no instalados | — | — |
| Pinterest, Lead Chain | ❌ sin MCP | — | — |

**Se habilitan** en la configuración de conectores de la sesión. No hay que
construir nada en la consola de Zoho.

**Consecuencia:** Módulo 3 y la entrega del Módulo 2 **no están descartados**
como se creyó al inicio; dependen de habilitar CRM y Mail. **Módulo 1 nunca
dependió de ninguno de estos** y sigue siendo la prioridad.

---

## Trampas conocidas

Heredadas del trabajo previo sobre estas mismas cuentas. Son errores ya
cometidos; no hay tiempo de repetirlos.

- ~~El campo `lead` no corresponde a la columna de Resultados.~~
  **CORREGIDO 2026-08-27 con evidencia (V0).** `results` y `cost_per_result` SÍ
  corresponden exactamente a la interfaz — verificado al centavo. Y las campañas
  que concentran el gasto optimizan por **`actions:lead`**, no por
  `QualifiedLead`. Este último existe como evento personalizado del pixel pero
  solo lo usa 1 campaña, con 1 resultado y $3.23 de gasto.
- ~~El caso $70.74 vs $1.57 por rangos desalineados.~~ **NO se reprodujo.** Con
  rango cerrado y `level=campaign` los números calzan al centavo. El usuario no
  reconoce el caso. Se trata como no verificable y se reemplazó por el test de
  V0. El riesgo real es otro: agregar campañas con indicadores distintos
  (ADR-013).
- **El indicador de `results` cambia por campaña.** 158 leads y 10,771 clics en
  enlace no se suman. Agrupar por indicador antes de comparar o agregar.
- **`Not available` y `mixed` son huecos, no ceros.** La API es honesta cuando no
  hay dato; convertirlo a 0 inventaría información.
- El objetivo de optimización no se edita en ad sets con historial de entrega.
  Hay que duplicar.
- La búsqueda por palabra clave en Ad Library no es confiable con términos
  genéricos en español. Usar `page_ids`.
- ~~Las métricas orgánicas de Página e Instagram no vienen por API.~~
  **CORREGIDO 2026-08-28 (ADR-016).** Zoho Social SÍ devuelve las publicaciones
  con sus interacciones nativas en las cinco redes conectadas. Lo que NO viene
  es el **alcance** — y sin alcance no hay tasa de engagement, así que no se
  calcula. La captura manual queda solo para alcance.

### Trampas descubiertas en este análisis (nuevas)

- **LinkedIn devuelve 0 en todos sus posts.** 25 de 25 con `like_count` y
  `comment_count` en cero. Indistinguible entre cero real y campo no soportado.
  Queda FUERA del total de interacciones en vez de sumar ceros que parecerían
  medidos.
- ~~El orgánico no se puede partir por mercado. Es imposible en esta
  configuración.~~ **CORREGIDO 2026-08-31.** No es imposible: falta conectar una
  página. `ads_get_ad_account_pages` devuelve DOS — «Qpaypro» y **«Qpaypro El
  Salvador» (829032443626700)**. El corte existe del lado de Meta; lo que falta
  es esa segunda página como marca en el portal de Zoho Social. Es configuración,
  no desarrollo. Declarar algo imposible cuando solo está desconectado cierra la
  puerta a arreglarlo.
- **La serie semanal de orgánico es acumulada, no histórica.** La API devuelve el
  conteo de cada publicación al día de la consulta. Un punto es «lo que hoy
  acumulan las piezas de esa semana», no «lo que pasó esa semana» (ADR-025).
- **Antes de la muestra no hay ceros, hay hueco.** La lectura viene topada en ~25
  publicaciones por red. Un cero en una semana anterior a la primera publicación
  leída diría «no engancharon» cuando lo que pasa es que no se leyó.
- **La API de pauta no devolvió `effective_status`.** Por eso «campañas» significa
  campañas CON ENTREGA en el periodo, no campañas activas hoy. No es lo mismo.
- **Un referente no suma a la presión competitiva.** Square tiene 0 anuncios en
  GT y SV. Contarlo como competidor inventaría una amenaza (ADR-017).
- **La Ad Library no publica efectividad de anunciantes comerciales.** Lo
  medible es qué repiten y qué no matan, y así se rotula (ADR-018).
- **Cuidado con el denominador.** La cuota de un titular se calcula sobre TODOS
  los anuncios observados, no sobre los que tienen título legible: 23/23 daba
  100% donde el resto del reporte decía 74%.

- **Ad Library no acepta rango de fechas.** El esquema de `ads_library_search`
  no expone ningún parámetro temporal. Solo responde qué está activo *ahora*.
  → Las corridas retroactivas **no pueden incluir competencia**.
- **Ad Library: `limit` máximo 50, sin cursor de paginación.** No se pueden
  enumerar los 51 anuncios de Paggo en una pasada.
- **Zoho Sprint no expone adjuntos.** No hay herramienta de subida, bajada ni
  listado en las ~80 operaciones del conector. La Verificación 3 tiene respuesta
  preliminar negativa.
- **Zoho Sprint no expone webhooks.** El Módulo 2 requiere sondeo periódico
  para detectar cambios de estado, no eventos.
- **El Meta MCP exige contexto conversacional humano** (`advertiser_request`
  con las palabras textuales del anunciante, `client_conversation_id`) en cada
  llamada. Fricción real contra la corrida automática desatendida.
- **`ads_create_ad_set` SÍ existe** en el conector, contra lo que afirma el
  documento maestro. Queda **sin verificar** por la prohibición de escritura
  (ADR-012).
- **`page_ids` + `search_terms` se combinan.** Es la forma de sortear el tope de
  50 sin paginación: permite preguntar sobre el universo completo de una página.
  Pero la **ausencia** de un término es evidencia débil — un anuncio de POS puede
  decir "datáfono". Reportar "sin coincidencias para X", nunca "no anuncia X".
- **El volumen de anuncios no equivale a presión competitiva.** BI tiene 845
  activos en GT y solo 2 tocan pagos. Medir solapamiento de mensaje, no contar.

- **Un spline suave se dispara por encima del dato.** Catmull-Rom dibuja un
  máximo donde la semana no lo tuvo. Recortar las manijas lo evita pero devuelve
  los picos rectos. La respuesta es interpolación monótona (Fritsch-Carlson):
  suave y sin sobrepasar (ADR-028).
- **`minmax(400px, 1fr)` es un piso, no una sugerencia.** En una pantalla de
  390 px desborda. Va siempre `minmax(min(400px, 100%), 1fr)`. Lo encontró la
  prueba en navegador, no la vista.
- **`auto-fit` estira una tarjeta sola a todo el ancho; `auto-fill` no.** Con una
  sola tarjeta en la fila la diferencia es toda la maquetación.
- **Tailwind extrae las clases leyendo texto plano.** El tablero se pinta con
  `innerHTML`, así que las clases viven en literales partidos en varias líneas:
  **cortar siempre en un espacio.** Partir `'rounded-' + '2xl'` deja la clase sin
  generar y no da ningún error.
- **Sin `window.claude` la página se declara de solo lectura** y desactiva todos
  los botones — que es correcto, pero deja las interacciones sin probar. La
  prueba en navegador tiene que simular ese runtime o no prueba nada.
- **Números escritos a mano en la interfaz se desincronizan.** El tablero decía
  «105 leads» mientras la pantalla mostraba 265: el 105 era de SV y la vista
  estaba en GT. Todo número visible se deriva del dato, sin excepción.

- **`users` de CreateItem es un arreglo JSON como texto**, no el ID suelto:
  `["21897000...144001"]`. El ID solo devuelve `7600 · Given JSON is invalid`,
  que no menciona `users` (ADR-029).
- **En Sprints, tipo y prioridad están en inglés; el estado en español.** `Task`,
  `Medium`, pero `Por Hacer`. En el CSV se escriben en inglés y Zoho los traduce.
- **Un camino que nunca se ejecutó no está probado, está apagado.** El `_lock` de
  `equipo.json` escondía tres errores reales de aritmética y de reporte que solo
  aparecieron al llenar la configuración (ADR-030). Llenar la config fue la
  prueba de integración que faltaba.
- **Repartir una capacidad exige saber entre cuántos.** Devolver la capacidad
  completa a cada tarea pedía 20 artes sobre una capacidad de 5. El reparto va
  después de construir la lista, por resto mayor.
- **Conseguir un dato faltante puede empeorar el reporte.** Al darle `page_id` a
  Shopify, la marca pasó de salir como «no medida» a **desaparecer**: tenía ID
  pero no archivo crudo, y el bucle la saltaba en silencio. Un `continue` sin
  registro es un hueco no declarado.
- **`sin_medir` es por mercado, no global.** Una marca puede estar leída en GT y
  no en SV; una sola lista repetida dice que falta donde no falta.
- **Las consultas de GT y SV pueden devolver los MISMOS anuncios.** Shopify
  devuelve los 16 idénticos en los dos: son campañas regionales. Sumarlos daría
  32 anuncios que no existen.

- ~~El alcance orgánico no viene por NINGUNA de las dos fuentes.~~
  **CORREGIDO 2026-09-02 · el alcance SÍ existe, en una TERCERA fuente.**
  `ads_get_ig_media` y Zoho Social efectivamente no lo dan. **Zoho Analytics
  sí:** `Post Insights (Páginas de Facebook)` trae `Impressions` por
  publicación en 1000 filas desde 2020, y `Media Insights (Perfil de
  Instagram)` trae `Reach`. Estaba instalado, habilitado el 2026-08-28 y
  anotado como «sin probar» — nadie lo abrió hasta que el usuario insistió.
  **Tercera vez del mismo error de método en este proyecto.** Receta completa,
  ids de vista y las cuatro trampas del dato en `docs/09-alcance-por-zoho-analytics.md`.
- **`Impressions` de Facebook NO es `Reach` de Instagram.** Impresiones cuenta
  veces mostrado; alcance cuenta personas. No se suman entre redes ni se
  comparan de frente.
- **El histórico de impresiones no existe antes de 2024.** Medido: mediana 0 en
  2020-2022, 1 en 2023, 11 en 2024, 279 en 2025, 402 en 2026. Un cero viejo no
  es «no lo vio nadie», es que la métrica no está.
- **Un rótulo de columna no es una verificación.** La columna `Saved` de
  Instagram trae valores 2 a 5 veces mayores que `Reach`, y guardar exige haber
  visto: es casi seguro impresiones mal rotulado. No se usa hasta confirmarlo.
- **El `CONFIG` de Zoho Analytics NO va URL-encoded**, contra lo que dice su
  propia descripción: `%7B%22...` devuelve `8534 Invalid JSON Format` y
  `{"responseFormat":"csv"}` funciona.
- **`ads_get_ig_media` da un corte que Zoho Social no da: `media_product_type`.**
  Distingue REELS de FEED. Sobre 25 publicaciones, **los reels rinden 3.2x el
  promedio del feed** (12.3 vs 3.8 interacciones), las 5 mejores piezas son todas
  reels, y los 7 comentarios de la muestra están todos en reels — el feed tiene
  cero en 15 publicaciones. Controlado por antigüedad: las dos cohortes promedian
  30 días, así que no es sesgo (ADR-031).
- **Una segunda fuente del mismo dato no es redundancia.** Buscando alcance
  apareció el corte por formato, que era invisible con una sola fuente.

- **La Ad Library devuelve OCHO campos, no más:** `id`, `page_id`, `page_name`,
  `ad_creative_link_title`, `ad_creation_time`, `ad_delivery_start_time`,
  `ad_snapshot_url`, `currency`. Sin cuerpo del copy, sin tipo de medio, sin
  impresiones, sin el creador etiquetado (ADR-032).
- **Meta no publica impresiones de anunciantes comerciales.** Solo los anuncios
  políticos y de asuntos sociales traen rangos. Un «top 10 por impresiones» de un
  competidor comercial es imposible, no difícil.
- **Los dominios bloqueados por el proxy son una POLÍTICA, no un límite.**
  `facebook.com`, `business.facebook.com` y `qpaypro.com` devuelven 403 en el
  CONNECT: es la política de egreso del entorno, elegida al crearlo, y se puede
  cambiar. Verificado el 2026-09-02 con
  `curl -sS "$HTTPS_PROXY/__agentproxy/status"`, que registra
  `connect_rejected · gateway answered 403 · qpaypro.com:443`. Es el mismo error
  de método de siempre: se anotó como «no se puede» algo que era «no está
  permitido todavía». Lo que se desbloquea si se permiten esos tres: el tono real
  de QPayPro para los copys, y el `ad_snapshot_url` — que es donde viven el tipo
  de medio (video vs. imagen) y el «with @handle» de los creadores pagados, hoy
  declarados como huecos.
- **El titular sí dice cuántas TARJETAS tiene el creativo.** Un carrusel llega con
  los títulos pegados por `" | "`. Distingue carrusel de pieza única — nunca video
  de imagen.
- **Consultar sin `countries` da el inventario GLOBAL.** Es lo que interesa de un
  referente: Square pasó de 0 anuncios (GT/SV) a 112 activos en su página de EE.UU.
- **Cuidado con el separador propio.** `_normaliza()` unía las tarjetas con `" + "`,
  que es justo el patrón que busca la detección de co-branding: leía su propio
  join y reportaba «Square + Gordon's Wine Bar» como marca aliada.
- **Una tasa sobre una ventana diminuta es un número inventado.** Con la muestra
  topada en los 50 más recientes, el span colapsa a 1 día y «creativos por semana»
  daba 350 para Square UK. Si el span no la sostiene, no se publica.
- **Varios anuncios con el MISMO segundo de creación son una carga en lote**, no
  piezas pensadas una por una. Distinguir ráfaga de goteo dice si el competidor
  testea o despliega: Paggo sube el 65% de sus creativos en ráfagas.

- **Un límite medido puede ser el límite del USO, no del color.** Se midió que los
  pasteles no sirven de línea (1.34:1 sobre blanco) y de ahí se concluyó, de más,
  que la paleta no servía para gráficas. Servía: bajando cada tono a peso de
  línea los tres pasan 5/5 del validador. Había que cambiar el tono, no la
  paleta (ADR-034).
- **Una variable CSS que no existe no avisa.** Al salir el arena desapareció
  `serie_4`, y el reporte de la Ad Library seguía pidiendo `var(--c4)`: barras
  sin color, cero errores en consola.
- **Una clase nueva en una familia de clases hay que darla de alta en los dos
  lados.** `.etiqueta-sec` tenía su color pero no estaba en el selector de grupo
  que pone el `display`, el relleno y el radio: salía como texto suelto.
- **Cuatro píxeles rompen una fila.** Tres tarjetas de 172 px con dos huecos de
  20 piden 556 y la columna daba 552: la fila se partía en 2+1. Lo vio la prueba
  en navegador, no la vista.
- **El patrón de trazo de una serie va atado a su COLOR, no a su posición.** Si
  no, YouTube sale punteado donde es la tercera serie y continuo donde es la
  única.
- **Los adjuntos de la conversación NO aterrizan en el disco de la sesión.**
  `/mnt/attach` está vacío; la imagen se ve en el mensaje y no hay archivo. Los
  logos del tablero son redibujos en SVG por eso, y se declara.

### Lección de método (error propio, 2026-08-27)

**Ausencia de evidencia no es evidencia de ausencia.** Se concluyó que cinco
conectores "no existen" porque sus herramientas no estaban cargadas en la
sesión. Estaban instalados, solo apagados. Antes de declarar que algo no existe:
agotar las formas de preguntarlo, y reportar con precisión qué se midió.

---

## Cómo navegar la documentación

| Archivo | Qué contiene |
|---|---|
| `docs/00-bitacora.md` | Bitácora cronológica del proceso: qué se hizo, cuándo, con qué resultado |
| `docs/01-inventario-conectores.md` | El hallazgo bloqueante de conectores, su método y evidencia |
| `docs/02-contradicciones.md` | Las contradicciones y ambigüedades del documento maestro |
| `docs/03-plan-fase-0.md` | Plan de las verificaciones obligatorias |
| `docs/04-riesgos.md` | Riesgos identificados, incluidos los no previstos en el documento |
| `docs/05-estrategia-ejecucion.md` | Secuencial vs. paralelo y la rebanada vertical |
| `docs/06-requerimientos-usuario.md` | Lo que se necesita del usuario para desbloquear |
| `docs/validaciones.md` | Resultado de la Fase 0 (se llena al ejecutar) |
| `docs/decisiones.md` | Registro de decisiones técnicas (ADR) con su porqué |
| `docs/linea-base.md` | Mediciones antes/después (pendiente de datos) |
| `config/tema.json` | **El diseño.** Lo edita el equipo de diseño; no hay que tocar código. Incluye la paleta por sección, los tres pasteles con su tono de línea, y las rutas de los logos |
| `config/logo.svg`, `config/logos/` | El logo principal y los de las marcas medidas. Redibujos en SVG: para poner el oficial, reemplazar el archivo con el mismo nombre |
| `config/equipo.json` | Personas y proyecto de Sprint. **Bloqueado** hasta que Mercadeo lo llene |
| `config/convenciones.json` | Fechas, métricas, mercados y **qué redes entran al reporte** |
| `src/modulo1/tablero_tailwind.css` | Las clases propias del tablero. El CSS se **compila** con Tailwind; no hay CDN |
| `tailwind.config.js` | Qué archivos escanea Tailwind. Ver la trampa del corte en un espacio |
| `pruebas/tablero.js` | Prueba del tablero en Chromium a 1440, 834 y 390 px. `npm run prueba:tablero` |
| `src/modulo1/fusiona_estado.js` | Trae el `#estado` de la versión EN VIVO al fragmento recién generado. **Correr siempre antes de republicar el tablero**, o se borran las decisiones del equipo |
| `pruebas/reporte.js` | Prueba del reporte de Ad Library. `npm run prueba:reporte` |
| `src/modulo1/adlibrary_profundo.py` | Análisis profundo por marca: mensajes, audiencia, velocidad, longevidad. Declara lo que la fuente NO responde |
| `src/modulo1/reporte_adlibrary.js` | Genera el reporte HTML. CSS plano, sin Tailwind: no usa utilidades |
| `docs/08-guia-de-diseno.md` | Guía para el equipo de diseño: qué editar y qué no tocar |

---

## Criterios de corte

Decisiones tomadas por adelantado para no improvisar bajo presión.

- **1 de septiembre:** si la base compartida no está operativa, se abandonan los
  Módulos 2 y 3 y todo el esfuerzo va al Módulo 1.
- **3 de septiembre:** si el Módulo 1 no está completo, no se inicia ningún otro.
- **5 de septiembre:** cierre de desarrollo. Del 6 al 8 solo evidencia y
  presentación. Estos días no se sacrifican por más código.

**Recordar estas fechas al usuario si se desvía.**

---

## Definición de terminado

Un módulo está terminado cuando cumple **todas** estas condiciones:

1. Corre de principio a fin sin intervención manual (con las compuertas humanas
   declaradas — ver ADR-002).
2. Se ejecutó al menos una vez contra datos reales, no de prueba.
3. Falla de forma controlada y comprensible cuando falta un dato.
4. Su salida es trazable hasta las consultas de origen.
5. Tiene modo `--dry-run` funcional.
6. Está documentado en `docs/decisiones.md`.
