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

---

# Resultado de V7 y sus consecuencias

**Se ejecutó la prueba. Resultado negativo, confirmado empíricamente.** Detalle
completo en `data/historico/2026-08-27_V7_runtime/resultado.md`.

La sesión disparada recibió **cero conectores MCP** y ningún acceso al
repositorio. Corrió 2.5 minutos, no produjo nada, y reportó `SUCCEEDED`.

## La trampa de monitoreo, y la regla que impone

`SUCCEEDED` significa que la sesión no se cayó. **No** significa que hizo el
trabajo.

**Regla obligatoria:** el monitoreo de la corrida semanal nunca se basa en el
estado de la Rutina. Verifica el **artefacto**:

| Comprobación | Cómo |
|---|---|
| ¿Corrió? | Existe `data/historico/<id_semana>/corrida.json` |
| ¿Analizó? | `analisis/resultado.json` trae el periodo esperado |
| ¿Produjo entregable? | Existe `salidas/MesaCreativa_<id_semana>.pptx` |

Si el artefacto no está, la corrida falló, diga lo que diga el estado.

---

# Tres preguntas del usuario, respondidas

## ¿Se puede personalizar cómo se ve la Rutina dentro de Claude?

**No, y es porque una Rutina no es una superficie visual.** Es una entrada de
calendario: nombre, horario, prompt y preferencias de notificación. Eso es todo
lo que tiene.

Lo que sí se personaliza es **lo que la Rutina produce**. Y ahí es donde entra
el artefacto: una página publicada, con diseño propio, que la Rutina puede
actualizar cada semana.

El usuario **ya usa ese patrón**: tiene un artefacto persistido llamado
`qpaypro-social-dashboard` que una Rutina de los lunes actualiza. Esa es la
respuesta a "personalizarlo bien cool" — no se estiliza la Rutina, se estiliza
su salida.

## ¿Qué es exactamente la Rutina dentro de Claude?

Un disparador programado guardado en la cuenta. Tiene cuatro cosas:

| Campo | Qué hace |
|---|---|
| Nombre | Cómo aparece en la lista de Rutinas |
| Horario | Cron en UTC, o una fecha única |
| Prompt | El mensaje que recibe la sesión al dispararse |
| Notificaciones | Push y/o correo al terminar |

Al dispararse abre una **sesión nueva**, le pega el prompt, y esa sesión
trabaja sola. Aparece en la lista de Rutinas con su próxima ejecución.

## ¿Se puede compartir para que el equipo lo corra desde su usuario?

**La Rutina no. Su resultado sí.** Y conviene que sea así.

La Rutina vive en la cuenta de quien la creó, con los permisos de conectores de
esa cuenta. No hay evidencia de que el objeto se pueda compartir.

Pero **no se quieren cinco Rutinas.** Cinco personas con la misma Rutina
significa cinco corridas del mismo periodo cada lunes: cinco lecturas a Meta,
cinco decks, y cinco intentos de crear las mismas tareas en Sprint. La guardia
de idempotencia lo aguantaría, pero es desperdicio y ruido.

**El patrón correcto: una Rutina, salida compartida.**

```
Una sola Rutina  →  corre el lunes  →  publica el artefacto
                                            │
                    ┌───────────────────────┼───────────────────────┐
                 diseño              contenido              gerencia
                (abre el link)      (abre el link)        (abre el link)
```

Nadie más necesita una Rutina. Abren el enlace y ven la corrida de la semana.

### Y para cuando el dueño de la Rutina no esté

Dos capas, no una:

1. **El artefacto compartido** cubre la lectura: el equipo ve el resultado sin
   depender de nadie.
2. **El repositorio cubre la ejecución manual**: el prompt está en
   `.claude/rutinas/corrida-semanal.md`. Cualquiera con acceso al repo y a los
   conectores puede correr la corrida a mano, o crear su propia Rutina en cinco
   minutos si hace falta un respaldo permanente.

**Recomendación:** que la Rutina viva en una cuenta que no se vaya de
vacaciones. Si la cuenta del área tiene los conectores, mejor ahí que en una
cuenta personal.

---

# Coordinación con la Rutina que ya existe

El usuario ya tiene esto corriendo:

```
"Qpaypro dashboard — recordatorio lunes (fin de semana)"
cron: 0 14 * * 1   →   lunes 8:00 a.m. Guatemala
```

Su prompt **pide los exports de Meta Business Suite del fin de semana**:
alcance, interacciones, seguidores, visitas y visualizaciones, separados por
Facebook e Instagram, más el detalle por publicación.

**Eso es exactamente el paso 4 del Módulo 1** — las métricas orgánicas que este
proyecto tenía como captura manual sin resolver.

## Oportunidad, y decisión pendiente

No conviene tener dos Rutinas de lunes pidiendo y produciendo cosas parecidas.
Hay dos caminos y es decisión del usuario:

**(a) Encadenarlas.** La Rutina existente pide los CSV y los deja en
`data/capturas/`. La corrida de Mesa Creativa arranca después y ya los
encuentra. Se respeta lo que ya funciona y se cierra el hueco del orgánico.

**(b) Absorberla.** Mesa Creativa asume también el pedido de los CSV, y la
Rutina vieja se retira. Menos piezas, pero se rehace algo que ya opera bien.

**Recomendación: (a).** La Rutina existente lleva meses funcionando y produce un
dashboard que el equipo ya usa. Encadenar es menos riesgoso que reemplazar, y a
diez días del cierre eso pesa.

Detalle de horarios si se encadena: la existente dispara a las 14:00 UTC. Mesa
Creativa debería ir **después**, no antes — porque necesita los CSV que la
primera solicita. Pero los CSV los sube un humano, así que la dependencia no es
de reloj sino de acción humana. Con ADR-002 eso no bloquea: si los CSV no están,
Mesa Creativa corre sin orgánico y lo declara.

## Un activo que ya existe y hay que reusar

La Rutina existente menciona una paleta validada para el dashboard:

| Red | Color |
|---|---|
| Facebook | `#2a78d6` |
| Instagram | `#eb6834` |

El deck de Mesa Creativa debería usar esos mismos colores cuando muestre
orgánico por red. Dos paletas distintas para la misma marca es ruido visual, y
esta ya está validada por uso.
