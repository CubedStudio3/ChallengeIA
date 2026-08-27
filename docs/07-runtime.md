# Runtime · dónde corre la Mesa Creativa

**Fecha:** 27 de agosto de 2026
**Resuelve:** Verificación 7 · riesgo A (el riesgo crítico del proyecto)

---

## La pregunta

*"¿Cuándo esto esté terminado, dónde corro la acción? ¿Tengo que entrar a este
chat o vas a crear un artefacto?"*

**Respuesta corta:** no entras a ningún chat. Corre solo con una **Rutina
programada**. Pero hay un requisito que solo puedes cumplir tú, una vez.

---

## El hallazgo que define la arquitectura

Se intentó crear la Rutina desde la sesión de trabajo. El sistema respondió:

> *"this trigger stores no MCP connectors, so the sessions it fires will run
> without connector (mcp__\<server\>__*) tools. Connectors on triggers created
> via this tool are limited to those the calling session itself holds... If the
> routine needs connectors, create it from a session that holds them, or ask the
> user to create it from the claude.ai routines UI."*

**Consecuencia:** una Rutina creada por el agente **no lleva conectores**. La
corrida moriría en el paso 2, al intentar leer Meta.

Esto es exactamente el riesgo A que se identificó el primer día, confirmado.

---

## Lo que hay que hacer, una sola vez

La Rutina se crea **desde la interfaz de Rutinas de claude.ai**, donde sí se
puede adjuntar el permiso de los conectores.

### Configuración

| Campo | Valor |
|---|---|
| Nombre | `Mesa Creativa · corrida semanal` |
| Programación | Lunes, temprano. Ver la nota de zona horaria abajo |
| Conectores a adjuntar | **Meta MCP**, **Zoho Sprint**, **Zoho Social MK** |
| Tipo de sesión | Nueva sesión en cada disparo |
| Notificaciones | Push y/o correo al terminar |
| Entorno | El mismo de esta sesión |

### Nota de zona horaria

Las Rutinas se evalúan en **UTC**. Guatemala y El Salvador están en UTC-6 sin
horario de verano, así que:

| Hora local deseada | Cron UTC | Nota |
|---|---|---|
| Lunes 06:00 | `0 12 * * 1` | Recomendada: el deck está listo antes de que llegue el equipo |
| Lunes 07:00 | `0 13 * * 1` | |
| Lunes 05:00 | `0 11 * * 1` | |

---

## El prompt de la Rutina

Va en `.claude/rutinas/corrida-semanal.md`. Se pega tal cual en la Rutina.

---

## Qué pasa cada lunes, sin que nadie toque nada

```
06:00  La Rutina dispara una sesión nueva con los conectores adjuntos
       │
       ├─ Verifica la frontera de permisos. Si falla, se detiene y reporta
       ├─ Paso 2 · lee pauta de Meta con rango cerrado y desglose por país
       ├─ Paso 3 · lee competencia en Ad Library por page_id
       ├─ Paso 4 · orgánico: si no hay captura, DECLARA el hueco y sigue
       ├─ Pasos 5-7 · cruza, verifica la semana anterior, calcula el plan
       ├─ Paso 8 · genera el deck y lo valida visualmente
       ├─ Paso 9 · prepara las tareas de Sprint en --dry-run, SIN crearlas
       └─ Commitea la corrida y notifica
       │
06:20  Llega la notificación con el deck y la lista de tareas propuestas
```

**Ahí termina lo automático.** El equipo revisa el deck en la reunión y aprueba
qué tareas se crean. Esa aprobación es la única acción humana del ciclo, y es
deliberada: es la compuerta que el proyecto decidió no eliminar.

---

## Por qué el paso 9 no se automatiza

No es una limitación técnica: `orquestador` tiene las herramientas para crear
work items en Sprint. Es una decisión.

Las tareas de la semana salen de lo que se **acordó en la reunión**, no de lo que
el análisis sugirió. Crearlas antes de la reunión sería asumir que la mesa va a
estar de acuerdo con el sistema, y el sistema no está ahí para decidir por el
equipo: está para que el equipo llegue a decidir con la base ya hecha.

Lo que sí queda listo es el `--dry-run`: la lista exacta de tareas propuestas,
con su título y su justificación. Aprobar es un sí, no un trabajo.

---

## Si la orgánica se habilita en el futuro

Hoy el paso 4 es el único insumo manual, y la corrida procede sin él declarando
el hueco (ADR-002). La herramienta de Instagram del conector devolvió:

> *"This tool is new and is being gradually rolled out across ad accounts.
> Please check back at a later date."*

No es que el dato no exista: la herramienta no está habilitada para esta cuenta
**todavía**. Conviene reintentarlo cada cierto tiempo. Si se habilita, el último
insumo manual del ciclo desaparece.

---

## Verificación pendiente

Esta Rutina hay que **probarla una vez** antes de confiarle el lunes 31: se
programa un disparo único a pocos minutos, se revisa que autentique y que
produzca el deck, y recién entonces se pasa a la programación semanal.

Nunca se confía una corrida programada que no se ha visto correr.
