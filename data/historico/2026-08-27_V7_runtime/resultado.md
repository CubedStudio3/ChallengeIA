# V7 · Prueba de runtime desatendido — RESULTADO NEGATIVO

**Fecha:** 27 de agosto de 2026
**Veredicto:** una Rutina creada por el agente **no puede ejecutar la corrida**.
**Consecuencia:** confirma el riesgo A, el riesgo crítico del proyecto.

---

## Método

Se creó una Rutina de disparo único (`trig_015W68qWJvnQVRiN5Xw1gzJs`) que abría
una sesión nueva con la instrucción de hacer **una sola** llamada de lectura a
Meta (`ads_get_ad_accounts`) y commitear el resultado.

Antes de crearla, el sistema ya había advertido:

> *"this trigger stores no MCP connectors, so the sessions it fires will run
> without connector tools... If the routine needs connectors, create it from a
> session that holds them, or ask the user to create it from the claude.ai
> routines UI."*

Se ejecutó igual, para tener evidencia empírica y no solo la advertencia.

## Salida obtenida

```
status:      ROUTINE_RUN_STATUS_SUCCEEDED
fired_at:    2026-08-27T17:15:41Z
finished_at: 2026-08-27T17:18:12Z
session_id:  cse_01Tse3bNd5Qw79Z5jfuKxs19
commit producido: NINGUNO
```

Herramientas que recibió la sesión disparada (`session_context.allowed_tools`):

```
preset:default · Task · Bash · Glob · Grep · Read · Edit · MultiEdit · Write
NotebookEdit · WebFetch · TodoWrite · WebSearch · BashOutput · KillBash
Skill · Tmux · Monitor · SendUserFile · REPL
```

**Ningún `mcp__*`.** Sin Meta, sin Zoho Sprint, sin Zoho Social, sin GitHub.

## Interpretación

1. **La Rutina creada por el agente corre sin conectores.** La corrida moriría
   en el paso 2, al intentar leer Meta. Confirmado, no supuesto.
2. **Tampoco tuvo acceso al repositorio**: no había herramientas de GitHub y no
   se produjo commit.
3. La Rutina debe crearse **desde la interfaz de Rutinas de claude.ai**, donde
   se le adjunta el permiso de los conectores.

## Trampa de monitoreo descubierta

**El estado fue `SUCCEEDED` y el trabajo no se hizo.**

`SUCCEEDED` significa que la sesión terminó sin caerse, **no** que produjo su
entregable. Una Rutina mal configurada puede reportar éxito durante semanas
mientras no genera nada.

**Consecuencia de diseño, obligatoria:** el monitoreo de la corrida semanal
**no** puede basarse en el estado de la Rutina. Tiene que verificar el
**artefacto**: ¿existe el commit de la corrida? ¿existe el `.pptx`? ¿el
`resultado.json` trae el periodo esperado?

Si el artefacto no está, la corrida falló, diga lo que diga el estado.

## Estado de la verificación

| Pregunta | Respuesta |
|---|---|
| ¿Autentican los conectores en una corrida desatendida creada por el agente? | **NO** |
| ¿Hay una vía que sí funcione? | Sí: Rutina creada desde la interfaz de claude.ai con conectores adjuntos |
| ¿Está probada esa vía? | **NO todavía.** Es la verificación que sigue |
| ¿Se puede confiar en el estado de la Rutina para saber si corrió bien? | **NO.** Hay que verificar el artefacto |

## Evidencia de que la vía correcta funciona

El usuario **ya tiene** una Rutina operativa en su cuenta, creada por otra vía:

```
"Qpaypro dashboard — recordatorio lunes (fin de semana)"
cron: 0 14 * * 1  ·  notificaciones push  ·  último estado SUCCEEDED
```

Esa Rutina lleva meses funcionando y actualiza un artefacto persistido
(`qpaypro-social-dashboard`) usando un conector de escritorio. Es prueba de que
el mecanismo sirve cuando la Rutina se crea con los permisos correctos.
