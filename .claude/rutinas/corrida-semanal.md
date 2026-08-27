# Prompt de la Rutina semanal · pegar tal cual

Este texto va en el campo de mensaje de la Rutina. Está escrito como
instrucción **autónoma**: la sesión que lo recibe arranca desde cero, sin
memoria de conversaciones previas.

---

```
Ejecuta la corrida semanal del Módulo 1 · Mesa Creativa.

Repositorio: CubedStudio3/ChallengeIA
Rama: claude/proyecto-desde-cero-h3s7vr

Lee CLAUDE.md antes de empezar: contiene las reglas que no se negocian, las
constantes verificadas y las trampas conocidas de este proyecto.

Luego invoca la skill `analisis-creativo` y sigue sus nueve pasos. La skill
tiene los comandos exactos.

PERIODO: la semana anterior cerrada, de lunes a domingo. Nunca la semana en
curso, que daría datos parciales.

ANTES DE CUALQUIER OTRA COSA, ejecuta:
    python3 src/base/verifica_permisos.py
Si reporta violaciones, detente y repórtalas. Significa que un agente de
análisis puede escribir en un sistema externo.

LÍMITES QUE NO SE NEGOCIAN:

- Meta Ads es SOLO LECTURA. Ninguna escritura de ningún tipo: no crear
  campañas, conjuntos ni anuncios; no modificar presupuestos, objetivos ni
  estados; no subir conversiones. Ni siquiera en estado pausado. Si una acción
  requiere escritura en Meta, redacta la instrucción exacta y créala como tarea
  en Sprint para que un humano la aplique.

- NO crees las tareas de Sprint. Prepáralas en --dry-run y déjalas listas. Las
  tareas salen de lo que se acuerde en la reunión, no de lo que sugirió el
  análisis. Esa aprobación humana es deliberada.

- NO publiques nada en redes. Si generas copies, quedan como borrador con
  aprobación pendiente. X/Twitter está excluido de toda automatización.

- Mercados declarados: Guatemala (GT) y El Salvador (SV). Honduras está
  excluido por decisión del usuario. Si aparece gasto en un país excluido,
  repórtalo como nota de integridad: no lo sumes ni lo ignores en silencio.

- Rango de fechas CERRADO siempre, con since y until explícitos. Nunca un
  preset móvil como last_30d: el mismo reporte daría distinto mañana.

- Cero datos inventados. Si falta un dato, decláralo como hueco y continúa con
  lo demás. Si el hueco impide una recomendación, di qué dato falta en lugar de
  estimar la cifra. Nunca conviertas "Not available" ni "mixed" en cero.

- Nunca sumes el campo results entre campañas con indicadores distintos. En
  esta cuenta conviven actions:lead, actions:link_click, QualifiedLead,
  complete_registration y mixed. Agrupa por indicador y declara siempre de cuál
  hablas.

MÉTRICAS ORGÁNICAS: se esperan en crudo/organico.json de la corrida. Si no
están, la corrida PROCEDE solo con pauta y competencia, y declara el hueco en
la portada del deck. No las estimes ni las copies de la semana anterior.

AL TERMINAR:

1. Commitea la corrida completa —crudo, normalizado, análisis y deck— a la
   rama de trabajo y súbela.
2. Reporta en un mensaje breve: el periodo analizado, cuántas recomendaciones
   quedaron cuantificadas y cuántas declaradas sin dato, qué huecos hubo, y la
   lista de tareas de Sprint propuestas para aprobación.
3. Si la corrida se detuvo, di exactamente en qué paso y por qué. Una corrida
   detenida con un motivo claro es un resultado válido; una corrida que
   completó rellenando huecos no lo es.
```
