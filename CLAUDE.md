# Mesa Creativa · QPayPro

Sistema agéntico para el área de Mercadeo. Tres módulos sobre una base compartida.

- **Cierre de desarrollo:** 5 de septiembre de 2026
- **Demo Day:** 9 de septiembre de 2026
- **Repositorio:** CubedStudio3/ChallengeIA
- **Rama de trabajo:** `claude/proyecto-desde-cero-h3s7vr`

---

## Estado del proyecto

**Fase actual: 0 (verificaciones) — EN CURSO. 2 de 7 completadas.**

- ✅ **V0 · convención de fechas** — VERIFICADA. 12/12 valores idénticos entre
  la interfaz y la API. Desbloquea el paso 2 del Módulo 1.
- ✅ **V5 · premisa competitiva** — VERIFICADA y corregida. Ver
  `config/competidores.json`.

Ninguna verificación se ha ejecutado contra una API real todavía. Lo único
completado es el **inventario de la superficie de herramientas** (qué conectores
existen y qué operaciones exponen), que ya invalidó supuestos del documento
maestro. Ver `docs/01-inventario-conectores.md`.

No hay código. No se escribe código hasta que la Fase 0 esté reportada y el
alcance confirmado.

---

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
| Zoho Analytics Gerencia | ✅ | ❌ | ⚠️ desconocida |
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
- Las métricas orgánicas de Página e Instagram no vienen por API en esta
  configuración. Captura manual.

### Trampas descubiertas en este análisis (nuevas)

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
