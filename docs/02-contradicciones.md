# Contradicciones y ambigüedades del documento maestro

**Fecha:** 27 de agosto de 2026

El documento maestro pidió explícitamente señalar contradicciones antes de
proponer arquitectura. Éstas son las nueve encontradas, ordenadas por impacto.
Cada una incluye el conflicto, por qué importa y la resolución propuesta.

Ninguna de estas notas corrige el documento por cuenta propia. Cuatro requieren
una decisión del usuario y están marcadas como tal.

---

## C1 · "Sin intervención manual" es incompatible con tres pasos del Módulo 1
**Requiere decisión del usuario.**

**El conflicto.** La Definición de terminado #1 exige que un módulo *"corra de
principio a fin sin intervención manual"*. Pero el Módulo 1 tiene tres puntos
donde un humano es obligatorio **por diseño**, no por defecto:

| Paso | Dependencia humana |
|---|---|
| Módulo 1, paso 4 | Las métricas orgánicas son captura manual — el documento confirma que no vienen por API |
| Módulo 1, paso 9 | "Crea las tareas acordadas" requiere saber qué se acordó en la reunión |
| Módulo 2 | El candado de aprobación humana antes de publicar |

**Por qué importa, y es grave.** El choque real no es semántico. Si el orgánico
no se capturó el viernes, la Regla 3 (*"falla ruidosamente, el sistema se
detiene"*) obliga a **abortar la corrida del lunes**. Es decir: un olvido humano
del viernes mata el entregable principal del proyecto. Y el documento pide que
el sistema *pida activamente* esas métricas el viernes anterior — pero los
canales candidatos para pedirlas (Mail, Cliq) no están conectados.

**Las dos salidas posibles:**

- **(A) El orgánico es un insumo opcional con degradación declarada.** La
  corrida procede solo con datos de pauta, y el deck declara en portada:
  *"esta corrida no incluye orgánico — dato no capturado el viernes 28"*. No se
  inventa nada; se declara el hueco. La corrida sobrevive al olvido.
- **(B) El orgánico es obligatorio y la corrida aborta.** Entonces hay que
  reescribir la Definición de terminado #1 como: *"corre sin intervención
  manual, con compuertas humanas declaradas en los pasos 4 y 9"*.

**Recomendación: (A).** Declarar un hueco no es inventar un dato, así que
cumple la regla de cero datos inventados; y protege el entregable del que
depende la evaluación. Registrado como ADR-002.

---

## C2 · Las corridas retroactivas no pueden incluir competencia
**Verificado técnicamente. No hay decisión que tomar; hay que asumirlo.**

**El conflicto.** La sección de Evidencia para el Demo Day propone ejecutar el
Módulo 1 retroactivamente sobre junio, julio y agosto para generar 8–10
corridas de historial real. El Módulo 1, paso 3, incluye revisar los anuncios
activos de competidores en Ad Library.

**La evidencia.** Se leyó el esquema completo de `ads_library_search`. Sus
parámetros son:

```
search_terms · page_ids · countries · ad_active_status · ad_type · limit
```

**No existe ningún parámetro de rango de fechas.** No hay
`ad_delivery_date_min`, `ad_delivery_date_max` ni equivalente. La Ad Library
solo responde qué está activo o inactivo **ahora**.

**Consecuencia.** Es imposible reconstruir qué anunciaba Paggo en junio. Las
corridas retroactivas serán de **pauta propia únicamente**: sin competencia y
sin orgánico (que tampoco existe para esas semanas). Siguen siendo valiosas,
pero no son corridas completas del Módulo 1.

**Cómo manejarlo en el Demo Day.** Decirlo, no maquillarlo. Si un evaluador
pregunta si es una corrida completa, la respuesta honesta es no, y conviene
tenerla preparada en lugar de improvisarla. Un proyecto cuya regla central es
"cero datos inventados" no puede presentar evidencia que insinúe más de lo que
contiene.

**Lo que sí funciona retroactivamente, y funciona bien.** El **loop de
verificación**. Meta conserva los resultados reales de julio y agosto, así que
se puede contrastar de verdad lo que el agente habría recomendado en junio
contra lo que efectivamente ocurrió. Ese es el argumento fuerte de la evidencia
y no depende de la Ad Library en absoluto.

---

## C3 · Ad Library: tope de 50 resultados sin paginación

**El conflicto.** El documento afirma que Paggo corre 51 anuncios activos, de
los cuales ~35 comparten un titular. El esquema de `ads_library_search` fija
`limit` en un máximo de **50** y **no expone cursor ni offset**.

**Consecuencia.** No se pueden enumerar los 51 en una sola pasada, y no hay
manera de pedir "los siguientes".

**Mitigación viable.** Segmentar por `countries` (GT y SV en llamadas
separadas) para partir el conjunto. Hay que verificar que la partición cubra el
total; si no lo cubre, el conteo de competencia debe reportarse como **límite
inferior** (*"≥50 anuncios activos"*), nunca como cifra exacta. Reportar 51
cuando la herramienta solo puede ver 50 sería exactamente el tipo de número no
trazable que el proyecto prohíbe.

---

## C4 · El documento puede estar equivocado sobre los conjuntos de anuncios

**El conflicto.** El conocimiento validado afirma:

> Los conjuntos de anuncios no se pueden crear de forma independiente por la API
> del MCP: solo se crea la estructura de campaña.

Pero la herramienta **`ads_create_ad_set` existe** en el Meta MCP conectado.

**Dos lecturas posibles.** O el conector se actualizó desde el trabajo previo,
o el fallo original fue de permisos / Términos de Servicio y se diagnosticó como
un límite de la API.

**Qué se hizo.** No se corrigió el documento. El conocimiento heredado se
respeta hasta tener evidencia en contra — así lo pide el propio documento. Se
añadió como sub-paso de la Verificación 1, porque probarlo es barato y **si
funciona, amplía lo que el Módulo 1 puede automatizar**.

---

## C5 · El Módulo 2 necesita sondeo, no eventos

**El conflicto.** El Módulo 2 dice *"el agente confirma recepción y avisa cada
cambio de estado"* y *"al aprobarse un arte en Sprint: el agente redacta el
copy…"*. Ambas frases describen reacciones a eventos.

**La evidencia.** Se revisó el inventario completo de Zoho Sprint (~75–80
operaciones). **No hay webhooks ni suscripciones.** Solo lectura por consulta:
`GetItems`, `GetItemDetails`, `GetItemActivity`.

**Consecuencia de arquitectura.** "Avisar cada cambio de estado" es
técnicamente **sondeo periódico contra Sprint**. Implica dos cosas que hay que
diseñar desde el principio, no descubrir implementando:

1. **Latencia** de hasta un ciclo de sondeo entre el cambio real y el aviso.
2. **Estado persistido** de la última pasada, para saber qué cambió. Y ese
   estado es también lo que garantiza la idempotencia (que dos pasadas no
   avisen dos veces del mismo cambio).

Registrado como ADR-005.

---

## C6 · Verificación 3 ya tiene respuesta preliminar: no

**El conflicto.** No es una contradicción del documento, sino una verificación
que ya se puede responder sin ejecutarla.

**La evidencia.** En el inventario completo de Zoho Sprint **no aparece ninguna
herramienta de adjuntos** — ni subir, ni descargar, ni listar.

**Consecuencia.** La contingencia que el propio documento definió (*"la pieza se
entrega por enlace dentro del work item"*) se activa con alta probabilidad. Se
confirmará formalmente en Fase 0, pero puede darse casi por hecho al planificar.

---

## C7 · Campaña de prueba vs. "nunca escribas en producción"
**Requiere autorización del usuario.**

**El conflicto.** La Verificación 1 pide *"probar una acción de escritura sobre
una campaña de prueba"*. Las Reglas de ingeniería dicen *"nunca escribas en
producción durante desarrollo; usa campaña y proyecto de prueba"*.

**El problema.** Una campaña de prueba creada en la cuenta `225318458221662`
**es** la cuenta de producción. Meta no ofrece un sandbox para esto. La regla
se contradice consigo misma en la práctica.

**Resolución propuesta (ADR-007).** Convención explícita de escritura de prueba:

- Estado `PAUSED` **siempre**, desde la creación.
- Presupuesto mínimo permitido por la plataforma.
- Prefijo obligatorio `[TEST-MC]` en el nombre.
- **Jamás activar.**
- Registro en `docs/validaciones.md` de todo objeto creado, con su ID, para
  poder limpiarlo después.

Requiere autorización expresa del usuario. No se crea nada sin ella.

---

## C8 · El Meta MCP exige contexto conversacional humano

**El conflicto.** Todas las herramientas del Meta MCP exigen dos campos en cada
llamada:

- `client_conversation_id` — identificador de 20 caracteres que agrupa las
  llamadas de una conversación.
- `advertiser_request` — definido en el esquema como *"lo que el anunciante
  pide, en sus palabras exactas, citadas textualmente… no parafrasees, no
  resumas, no traduzcas a términos técnicos"*.

**El problema.** En una corrida automática del lunes a las 6:00 no existe
ninguna frase del anunciante que citar. El conector está diseñado para uso
conversacional; el challenge exige uso agéntico desatendido. Son requisitos en
tensión.

**Por qué importa.** El uso agéntico pesa 25% de la evaluación. Es la fricción
menos obvia y la más fácil de descubrir tarde. Debe resolverse explícitamente y
registrarse la decisión, no improvisarse en la primera corrida real.

---

## C9 · Ambigüedades menores que necesitan definición

| # | Ambigüedad | Estado |
|---|---|---|
| a | **`config/convenciones.json` no está especificado.** El documento manda "fija y documenta la convención de fechas" pero no dice cuál es. | Propuesta en `docs/03-plan-fase-0.md`, V0. **Requiere el periodo del caso $70.74 para validarse.** |
| b | **El formulario del Módulo 2 no tiene tecnología definida.** Zoho Forms no está en la lista de conectores. ¿Formulario web? ¿Item creado a mano en Sprint? | **Requiere decisión del usuario.** Alcance indefinido. |
| c | **La estructura dice `mesa-creativa/` en la raíz, pero el repositorio se llama `ChallengeIA`.** | Resuelto: la estructura va en la raíz del repositorio, sin subcarpeta. ADR-001. |
| d | **`contexto-marca` no tiene contenido.** El documento la identifica como crítica ("sin ella los copies salen genéricos") y no se entregó nada de su materia prima. | **Requiere insumo del usuario.** Ver `docs/06-requerimientos-usuario.md`, punto 6. |
| e | **Zoho Cliq y PageSense "por construir".** Es trabajo del usuario en una consola externa. Cliq es el candidato natural para el recordatorio del viernes (C1). | **Requiere confirmación de si ocurrirá y cuándo.** |
| f | **La premisa competitiva no está fechada.** "Paggo corre 51 anuncios, ~35 con el mismo titular" es la base estratégica de todo el proyecto y no se sabe cuándo se midió. | Añadido como Verificación 5. Es barato y de alto valor. |

---

## Resumen: qué necesita decisión del usuario

| Contradicción | Decisión pendiente |
|---|---|
| C1 | Opción (A) degradación declarada, u (B) aborto con definición reescrita |
| C7 | Autorización para crear campaña PAUSED de prueba en la cuenta real |
| C9-a | Entregar el periodo y campaña del caso $70.74 vs $1.57 |
| C9-b | Tecnología del formulario del Módulo 2 |
| C9-d | Materia prima de `contexto-marca` |
| C9-e | Si Cliq y PageSense se construirán, y cuándo |
