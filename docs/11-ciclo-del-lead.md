# Ciclo del Lead · método, verificación y hallazgos

**Corte:** 1 de enero – 11 de septiembre de 2026 · **ejecutado el 2026-09-11**
**Fuentes:** Zoho CRM (Leads y Deals) + Meta Ads (cuenta `225318458221662`)
**Salida:** `salidas/ciclo-del-lead.html`, publicado como artifact

---

## Lo que contradice al prompt de origen

Tres cosas que el prompt daba por comprobadas y **no lo son**. Se midieron, no se
dedujeron.

### 1. COQL **sí** soporta agregación

El prompt decía: «COQL no soporta funciones de agregación. `count(id)` con
`group by` devuelve `INVALID_QUERY`. Traé las filas crudas y agregá en Python.»

Falso. Falla solo si al `COUNT` **no se le pone alias**:

```sql
-- falla: "select column should be given in group by clause"
select Lead_Source, count(id) from Leads ... group by Lead_Source
-- funciona
select Lead_Source, COUNT(id) as total from Leads ... group by Lead_Source
```

También funcionan `SUM(...) as x` y hasta **4 columnas en el `group by`** (la
quinta devuelve `LIMIT_EXCEEDED · group_by · limit 4`).

**Consecuencia de método:** no hubo que traer 5.000 filas crudas. Todo el
tablero sale de cubos agregados del lado del servidor, que además se pueden
reconciliar uno contra otro. Menos datos en tránsito, cero transcripción a mano.

### 2. `FB_Campaign_ID` **no** está vacío

El prompt decía: «0 de 4.835 leads traen `Campa_a_MK` o `FB_Campaign_ID`».

- `Campa_a_MK`: vacío en los 4.972 leads. **Cierto.**
- `FB_Campaign_ID`: **292 leads lo traen**, de 5 campañas distintas
  (`120239427144470783` con 190, `120245898463250783` con 73, etc.).

Y el hallazgo es más filoso que el original: de esos **292 leads con campaña
identificada, 0 convirtieron**. El cableado existe y está probado; lo que no
existe es un solo caso de campaña→venta que permita optimizar.

### 3. El Importe no es nulo: es **cero**

El prompt decía «552 de 673 ganados no tienen Importe». La consulta
`Stage = 'closed won' and Amount is null` devuelve **vacío**: ningún ganado tiene
Importe nulo. La que devuelve es `Amount = 0` → **571 de 698**.

Importa porque cambia cómo se trata: un nulo se excluye del promedio, un cero lo
arrastra hacia abajo. `SUM(Amount)` sobre los ganados suma solo los 127 con
valor y **no es el ingreso del periodo**. Por eso el tablero no publica ni CAC ni
ROAS.

---

## Trampas nuevas, medidas en esta corrida

- **`Owner.name` viene en `null` para usuarios desactivados o borrados.** No es un
  hueco del dato: son 5 de los 9 vendedores, con `status` `disabled` o `deleted`
  en `getUsers`. El tablero los nombra y los marca. Tomar el `null` por «sin
  asignar» habría escondido que **23 de los 42 ganados de redes los cerró gente
  que ya no está**.
- **Convertido ≠ calificado.** 989 leads tienen `Converted__s = true`, pero **41
  no tienen `Converted_Deal`**: se convirtieron a Cuenta o Contacto sin abrir
  oportunidad. Calificados reales: **948**. Tomar los 989 infla la tasa de
  calificación en 0.8 puntos y, peor, mete 41 leads en el paso equivocado del
  embudo.
- **Hay 44 Tratos sin lead de origen** (992 Tratos contra 948 leads calificados).
  El embudo lo declara en vez de forzar que los pasos encajen.
- **La API de Meta truncó en 200 campañas, con cursor y sin aviso**, aun pidiendo
  `limit=1000` — la trampa del ADR-050 otra vez. La lectura buena se hizo
  filtrando `amount_spent > 0`: **25 campañas, sin cursor**, y su total cuadra con
  el de la lectura truncada (diferencia de 2 centavos por redondeo). Un total que
  coincide no prueba que la consulta esté completa: lo prueba la ausencia de
  cursor.
- **`COUNT(Amount)` cuenta filas, no valores presentes.** Devolvió 56 sobre 56
  filas con `SUM(Amount) = 0`. No sirve para detectar huecos; hay que preguntar
  por `is null` o por `= 0`.
- **Una condición de más rompe el `where`.** `where (A and B and C)` da
  `SYNTAX_ERROR near "where"`; hay que anidar: `where ((A and B) and C)`.
- **2026 tiene 6 indicadores de resultado en Meta**, incluido `mixed` con **$805.40
  y cero resultados atribuidos en junio** — el valor exacto que ya estaba
  documentado en `CLAUDE.md`, lo que sirvió de comprobación cruzada. Los
  indicadores no se suman: 4.769 leads y 114.302 clics en enlace no son la misma
  cosa.

---

## Verificación ejecutada (Paso 5 del encargo)

Cada cubo se comprobó contra una consulta **independiente** antes de usarlo.

| Qué | Cómo se verificó | Resultado |
|---|---|---|
| Leads no convertidos | suma mes a mes vs. `COUNT` del periodo completo | 3.983 = 3.983 ✅ |
| Convertidos | 948 calificados + 41 sin Trato vs. `COUNT(Converted__s = true)` | 989 = 989 ✅ |
| Total de leads | 3.983 + 948 + 41 | **4.972** ✅ |
| Tratos | suma del cubo vs. `COUNT` por etapa | 992, y las **7 etapas** cuadran una por una ✅ |
| Tratos de redes | cubo de tratos vs. cubo de vendedores vs. consulta por país | 246 = 246 = 246 ✅ |
| Stand By | cubo de razones vs. etapa en el cubo de tratos | 66 = 66 ✅ |
| Sondeo por `offset` | `offset N-1` devuelve fila, `offset N` devuelve vacío | Meta Ads junio **659** ✅ · `closed won` **698** ✅ · `closed lost` **179** ✅ |
| Meta Ads | lectura filtrada sin cursor vs. lectura truncada | $13.909,38 vs. $13.909,36 (2¢ de redondeo) ✅ |

`src/modulo1/ciclo_lead.py` repite las cuatro comprobaciones de totales en cada
corrida y **se detiene** si alguna no cuadra, igual que la compuerta de pauta.
También se detiene si aparece un `Lead_Status` o una razón de cierre que no esté
en el mapa de buckets: nada cae en «otros» en silencio.

---

## Contra la línea base del prompt (corte al 2 de septiembre)

| | Base 2-sep | Medido 11-sep |
|---|---|---|
| Leads | 4.835 | 4.972 |
| Tratos | 960 | 992 |
| Calificados | 913 (18,9%) | 948 (19,1%) |
| Ganados / perdidos | 673 / 175 | 698 / 179 |
| GT redes: cierre | 12,6% | 12,6% |
| Página web: cierre | 99,2% | 99,1% |

Nueve días más de dato, misma forma. La diferencia en «calificados» se explica
por los 41 convertidos sin Trato, que aquí se excluyen a propósito.

---

## Dónde vive cada cosa

| Archivo | Qué contiene |
|---|---|
| `data/ciclo_lead/leads_no_convertidos.csv` | mes × país × fuente × estado |
| `data/ciclo_lead/leads_calificados.csv` | mes × país × fuente (con Trato) |
| `data/ciclo_lead/leads_convertidos_sin_trato.csv` | los 41 |
| `data/ciclo_lead/tratos.csv` | mes × país × fuente × etapa × razón + monto |
| `data/ciclo_lead/vendedores_redes.csv` | vendedor × país × etapa × razón, solo redes |
| `data/ciclo_lead/standby_razones.csv` | país × fuente × razón de Stand By |
| `data/ciclo_lead/meta_mensual.json` | inversión, impresiones y leads de Meta por mes |
| `src/modulo1/ciclo_lead.py` | mapas de canal, bucket y área · compuertas · arma `dataset.json` |
| `src/modulo1/ciclo_lead.tpl.html` | la página, con el cálculo en el cliente |
| `src/modulo1/arma_tablero.py` | inyecta el dataset en la plantilla |

Regenerar: `python3 src/modulo1/ciclo_lead.py && python3 src/modulo1/arma_tablero.py`

---

## Lo que queda sin hacer, por decisión

- **Cruce por campaña** (extensión 1 del encargo): bloqueado hasta que el CRM
  reciba el `campaign_id` de los leads que sí convierten. No se estima.
- **Refresco semanal con aviso a Zoho Cliq** (extensión 2): no se armó; el
  conector de Cliq está disponible y la Rutina se puede crear cuando se pida.
- **Excel de respaldo** (extensión 3) y **publicar el modelo en Zoho Analytics**
  (extensión 4): no se hicieron. Zoho Analytics **no tiene los módulos de CRM
  sincronizados** —se verificó: los dos workspaces son «Marketing» (Facebook Ads)
  y «GERENCIA QPAYPRO» (billing, transacciones, Survey)—, así que publicar ahí
  significa crear tablas nuevas, no apuntar a las existentes.

---

## Ampliación del 2026-09-11 · sincronización Meta → CRM y asignación

Pedido: monitorear que los leads lleguen al CRM, ver la diferencia contra Meta y
saber dónde se quedan, porque «no se están asignando al equipo de ventas».

### Primero, una corrección

Los **44** que reportó la primera entrega **no eran la brecha con Meta**: eran
Tratos sin lead de origen (992 Tratos contra 948 leads calificados). La brecha
Meta↔CRM es de otro orden y se midió aparte.

### Un agujero real en la verificación anterior

La compuerta decía «3.983 = 3.983 ✅». Las **dos** consultas agrupaban por
`Lead_Source`, así que compartían el mismo sesgo y la compuerta se aprobó a sí
misma. El conteo directo (`group by Converted__s`, una sola columna) da **3.987**.

La diferencia no era un error de extracción: **entraron 4 leads nuevos durante la
sesión** (09:59, 11:46, 12:16 y 12:58 del 11 de septiembre). El CRM está vivo y
la extracción es una foto. Ahora el tablero declara la hora de la foto.

**La lección de método:** una compuerta que compara dos consultas construidas
igual no verifica nada. La comprobación tiene que venir por un camino distinto —
aquí, agrupar por una columna sin nulos, o el sondeo por `offset`.

### La brecha Meta → CRM

| | |
|---|---|
| Leads que reporta Meta (indicadores de lead) | **4.777** |
| Leads de redes registrados en el CRM | **4.075** |
| Diferencia | **−702 · 14,7%** |
| De los de Meta, del evento de pixel `QualifiedLead` | 412 |

Mes por mes la brecha es negativa en 15 de los 19 cortes país-mes, entre −8% y
−90%. Dos excepciones que importan porque explican el mecanismo:

- **Junio GT: +234 a favor del CRM.** Ese mes hay **$805,39 con indicador
  `mixed` y cero resultados atribuidos**. Los leads existen y llegaron; Meta no
  los contó bajo ningún indicador.
- **Mayo y julio GT** salen levemente positivos, coherente con desfase de
  atribución.

**Los dos números no son comparables al registro** y el tablero lo dice: Meta
cuenta eventos y el CRM registros, Meta atribuye a la fecha del clic y el CRM a
la de creación, y el CRM deduplica. Sirve para el tamaño y la dirección.

### Dónde caen los leads: el hallazgo

Ningún lead del periodo está sin responsable. El problema es **quién** es ese
responsable.

- **2.674 de 3.987** leads sin Trato (**67,1%**) están asignados a usuarios
  **desactivados o borrados**.
- De esos, **804 siguen vivos** —en seguimiento o precalificados—: el **79,4%**
  de todos los leads vivos sin Trato.
- Los dos casos más grandes: **Edson Mejia** (desactivado) con 451 leads, **378
  vivos**; **Ernesto Melara** (desactivado) con 1.234 leads, **303 vivos**.

`Owner.name` llega en `null` justamente para esos usuarios. Leerlo como «sin
asignar» habría contado mal el problema; hay que resolver el id contra
`getUsers`, que devuelve `status` `disabled` o `deleted`.

### Y la buena noticia: ya se arregló el flujo

| Mes | Leads sin Trato | A usuario inactivo |
|---|---|---|
| enero | 210 | 113 (54%) |
| febrero | 362 | 270 (75%) |
| marzo | 664 | 560 (84%) |
| abril | 691 | 641 (**93%**) |
| mayo | 561 | 440 (78%) |
| junio | 668 | 377 (56%) |
| julio | 428 | 262 (61%) |
| **agosto** | 278 | **11 (4%)** |
| **septiembre** | 125 | **0 (0%)** |

La fuga se cortó en agosto. Las fechas coinciden con `getAssignmentRules`: la
regla **GT ASIGNACION AUTOMATICA QPAYPRO** se modificó el **2026-08-01** y **SV
ASIGNACION AUTOMATICA QPAYPRO** el **2026-08-12**. Hay 6 reglas activas sobre
Leads, todas con `default_assignee` Mariana Rendon o el usuario conectado.

**El flujo nuevo está sano; el atraso no se movió solo.** Los 804 leads vivos
siguen donde estaban.

### Trampa nueva

- **Al filtrar por un mes, leads y Tratos son dos cohortes distintas.** Cada uno
  se corta por su propia fecha de creación, así que un Trato de agosto puede
  venir de un lead de julio. En agosto, WhatsApp/Chat da «lead → venta 200%» (1
  lead, 2 ganados) sin que nada esté mal. En el periodo completo el efecto
  desaparece. Queda declarado en las notas del tablero.

---

## El informe «LEADS 2026» del CRM no cuenta lo que parece

Mercadeo señaló el caso concreto: Meta reporta ~216 clientes potenciales del 1 al
11 de septiembre y el informe **LEADS 2026** del CRM muestra **60**.

Se buscó qué fórmula reproduce esa serie. **La encontrada, comprobada consulta por
consulta contra el CRM:**

> leads **no convertidos** cuyo **País es Guatemala o está vacío**

| Mes | Informe | La fórmula |
|---|---|---|
| enero | 207 | **207** |
| julio | (tapado por el globo) | 164 |
| agosto | 201 | **201** |
| septiembre | 60 | **60** |

Calza al número. El informe deja fuera **El Salvador** y deja fuera los **leads ya
convertidos** — los informes de Zoho sobre Posibles clientes excluyen los
convertidos por omisión, y eso no se ve en el gráfico.

**Septiembre de verdad, medido el 2026-09-11:**

| | |
|---|---|
| Leads creados en septiembre (todos) | **162** |
| De ellos, con fuente Meta Ads | **118** (116 sin convertir + 2 convertidos) |
| Por país (Meta Ads) | GT **51** · SV **65** |
| Lo que muestra el informe | 60 |
| Lo que reporta Meta (1–11 sep) | **216** en el panel del usuario · 222 en la lectura por API |

La brecha real de septiembre es **216 contra 118: −98, un 45%**. No es 216 contra
60. El instinto era correcto —falta cerca de la mitad— pero el tamaño que sugería
el informe estaba inflado por lo que el informe esconde.

**La trampa, para que no se repita:** un informe del CRM no es «el CRM». Antes de
comparar contra Meta hay que saber qué filtra: el país, y sobre todo los
convertidos, que son justamente los leads que sí avanzaron.
