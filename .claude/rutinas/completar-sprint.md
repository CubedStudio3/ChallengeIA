# Completar la configuración de Zoho Sprint

> **Antes de leer esto: hay un camino que ya funciona y no necesita nada de aquí.**
> El botón «Copiar para Sprint» del tablero da un CSV que se importa en
> *Configuración → Imports → Ítems de trabajo*. Verificado en vivo el
> 2026-08-28: el asistente **mapea las seis columnas solo**, sin intervención.
>
> | Campo de Zoho | Columna del CSV |
> |---|---|
> | Nombre de elemento | `Item Name` |
> | Descripción | `Description` |
> | Tipo de artículo | `Item Type` |
> | Prioridad | `Priority` |
> | Item assignee | `Assignee` |
> | Estado | `Status` |
>
> El asistente avisa que «no ha asignado los campos» porque quedan en `None` los
> opcionales (horas, Epic, Versión, fechas). Se continúa sin problema.
>
> Pendiente de comprobar: si el proyecto usa nombres de estado y prioridad en
> español, los valores `Open` y `Medium` no coincidirán y Zoho pondrá el
> predeterminado. No falla la importación; solo hay que revisarlo después. Si se
> confirma, se cambian los valores en `a_csv()` de `src/modulo1/sprint.py`.
>
> Lo de abajo sirve para la creación AUTOMÁTICA por API, que es lo que corre
> solo cada semana. No es urgente.

**Para qué sirve:** faltan tres IDs para que el paso 9 pueda crear work items.
Los tres se leen por API en una sola pasada. Esta rutina existe porque el
conector de Sprint se cae y se levanta cada pocos minutos, y no hay que esperar
a que coincida con una conversación: se pega este texto cuando el conector esté
arriba y listo.

## Lo que ya está resuelto

| Dato | Valor |
|---|---|
| `team_id` | `667151262` |
| `project_id` | `21897000000139001` — *Diseño y MK* (P8) |
| Autorización de escritura | otorgada por mercadeo@qpaypro.com, 2026-08-28 |

## Lo que falta

`sprint_id`, `item_type_id`, `priority_id`.

## Cómo correrlo

Pegar esto en una conversación nueva, con el conector de Sprint conectado:

---

Usa el agente `orquestador`. Solo LECTURA en este paso: no crees ni modifiques
nada en Sprint.

Con `team_id = 667151262` y `project_id = 21897000000139001`:

1. `ZohoSprints_GetSprints` — dame el sprint activo. Necesito su ID numérico y su
   nombre. Si hay más de uno activo, lístalos todos y no elijas por mí.
2. `ZohoSprints_GetProjectPriorities` — dame las prioridades con su ID. Quiero la
   que sea "media" o equivalente; si los nombres no son obvios, muéstralos todos.
3. `ZohoSprints_GetItems` sobre ese sprint — de cualquier item existente, extrae
   el `projitemtypeid` del tipo que corresponda a una tarea. Si el proyecto no
   tiene items todavía, dilo: entonces ese ID hay que sacarlo de la configuración
   del proyecto a mano.

Escribe los tres valores en `config/equipo.json` dentro de `proyecto_sprint`, con
una nota de dónde salió cada uno. Después corre:

    PYTHONPATH=src python3 -m modulo1.sprint --descubrir

Debe reportar que solo falta `personas`. Si falta algo más, no lo rellenes:
repórtalo.

Si el conector devuelve `7404 Given URL is wrong`, detente y dilo. Significa que
el `team_id` dejó de ser válido, y NO hay que probar otros números.

---

## Después de eso

Con los IDs completos, el ensayo antes de escribir:

    PYTHONPATH=src python3 -m modulo1.sprint \
      --corrida data/historico/<carpeta> \
      --decisiones <el JSON del botón «Copiar decisiones»> \
      --dry-run

Imprime la llamada exacta de cada work item: nombre, descripción, responsable y
la marca de idempotencia. **No escribe nada.** Solo después de revisar esa salida
se corre con `--real`.

## Lo que falta aparte de los IDs

`personas` en `config/equipo.json`: nombre y User ID de Sprints de cada
integrante. Sin eso se pueden crear los items pero no asignarlos, porque el
parámetro `users` de `CreateItem` espera IDs, no correos.
