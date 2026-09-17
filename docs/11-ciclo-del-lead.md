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

---

## Rediseño del 2026-09-17 · por día, con plan, y una corrección grande

Mercadeo pidió seis cambios de diseño. Dos de ellos obligaron a cambiar el
**dato**, no la página.

### Los filtros por día obligaron a extraer por fila

El tablero pasó de un selector de mes a dos calendarios (**desde** / **hasta**).
Un dato agregado por mes no puede contestar eso. La extracción ahora trae
**filas**, no cubos:

```
leads no convertidos   3 páginas de COQL   4.036
leads convertidos      1 página              1.010
                                        ─────────
                                            5.046
tratos                 1 página              1.013
```

No hay transcripción a mano en ningún punto: cuando la respuesta de una
herramienta pasa del tope de tokens, **se guarda en un archivo** y Python la lee
de ahí. Las respuestas crudas quedaron en `data/ciclo_lead/crudo/`.

El dataset se comprime con **diccionarios de índices**: cada texto es un entero
y la fecha es el índice de un vocabulario ordenado, así que filtrar por rango es
comparar enteros. De 1,3 MB de texto repetido a **249 KB**.

### Free y Premium: el campo existía, en el Trato

`Plan_migracion` en Leads está poblado en **23 de 4.036** — inservible. El corte
real es **`Producto`**, un lookup que en la interfaz se llama **«Plan QPayPro»**
y que vive en el **Trato**: poblado en **1.010 de 1.013**.

| Plan | Tratos |
|---|---|
| Free | 574 |
| Premium Anual | 413 |
| Premium Mensual | 10 |
| Elite Anual | 9 |
| Afiliación Premium Silver Anual | 3 |
| Kit de Punto de Venta QpayPOS | 1 |
| sin plan | 3 |

**Consecuencia de método:** un lead **no tiene plan** hasta que llega a Trato.
El KPI lo dice en voz alta en vez de rellenar: 966 de 5.046 tienen plan; los
4.080 restantes no lo tienen porque no llegaron.

### La corrección grande: el Importe en cero NO era un hueco

La primera entrega dijo: «571 de 698 Tratos ganados tienen Importe en cero → no
hay CAC ni ROAS que calcular». Con el plan a la vista, eso era **leer mal el
dato**:

| | |
|---|---|
| Ganados con Importe 0 | **572** — y son **todos** del plan Free |
| Ganados de plan de pago | **145** |
| De esos, con importe | **129**, que suman **$255.932,50** |
| Hueco real | **16** Tratos de pago sin importe |

El cero del plan gratuito **es el valor correcto**. El hueco no era del 82% de
las ventas: era del 11% de las ventas de pago. Y sí hay una cifra de ingreso
registrada.

Por canal, las ventas de pago:

| Canal | Ventas de pago | Importe registrado |
|---|---|---|
| Directo / Referidos | 55 | $93.901,50 |
| WhatsApp / Chat | 48 | $91.540,00 |
| Sin fuente | 5 | $27.848,00 |
| Redes sociales (Meta) | 18 | $25.404,00 |
| Página web | 19 | $17.239,00 |

**Y eso da vuelta la lectura del canal web.** El tablero decía que la web «trae
plan de pago». Es lo contrario: la web produce **538 ventas Free y 19 de pago**.
Los planes de pago salen de donde hay una persona en medio —WhatsApp y
referidos—. Se corrigió la recomendación.

### Trampa nueva, y me la comí yo

**`time_increment: 1` con `limit: 1000` devolvió exactamente 1.000 filas.** Sin
cursor en el esquema de la respuesta, el resultado se veía completo. Enero y
febrero cuadraban **al centavo** contra la lectura mensual ya verificada, y de
marzo en adelante faltaba gasto: $11.093,84 contra los $13.909,38 conocidos.

La lectura buena va **por trimestre** (382 + 596 + 319 = 1.297 filas, ninguna en
el tope) y ahora hay una compuerta que compara el gasto mes a mes contra la
lectura mensual —que se pidió por otro camino— y **detiene la corrida** si
alguno se desvía más de dos centavos. Los ocho meses cerrados cuadran al
centavo.

Es la misma trampa del ADR-050. La lección que faltaba: **una compuerta solo
sirve si el número con el que compara viene por un camino distinto.** Comparar
la lectura consigo misma es lo que dejó pasar el «3.983 = 3.983» de la semana
pasada.

### Lo que cambió en la página

- Filtros: **País · Canal · Desde · Hasta**. Fuera el de Fuente y el de Mes.
- El encabezado quedó en el título solo.
- KPIs: leads que entraron **con el desglose Free / Premium debajo**,
  calificados, ganados y % de cierre. Fuera el de seguimiento.
- **Dos embudos lado a lado**: página web y formulario de Meta, cada uno con su
  split de plan en los escalones donde el plan ya existe.
- «¿Son leads malos o es el cierre?» y «Dónde se caen» quedaron **juntos, debajo
  de los embudos**, para que la leyenda se lea con su detalle al lado.
- Las gráficas de tiempo cambian de grano solas: **por día** si el rango es de
  dos meses o menos, **por mes** si es más largo.
- Se cayeron dos limitaciones que estaban declaradas: la tabla de vendedores y
  el desglose de Stand By ahora responden a todos los filtros, porque el dato
  por fila los soporta.

---

## Rediseño del 2026-09-18 · seis cambios de presentación

Ninguno necesitó dato nuevo. Todos son de cómo se lee.

1. **Embudos completos.** Antes cada escalón era un SVG suelto con su propia
   fila, así que la silueta se leía como cinco figuras sueltas. Ahora cada
   embudo es **un solo SVG** con las cinco bandas pegadas —el borde de abajo de
   una es el de arriba de la siguiente— y el texto vive en dos columnas
   alineadas por una rejilla de filas de altura fija.

2. **«¿Son leads malos o es el cierre?» ahora se explica solo.** El problema no
   era el dato: la barra decía «Mercadeo 36%» sin decir qué cuenta como
   Mercadeo. Ahora cada área abre una tarjeta con **los criterios que la
   componen**, separados en los que nunca llegaron a Trato y los que llegaron y
   se cayeron, más una frase de qué significa el área y el detalle exacto en un
   desplegable. Las cuatro tarjetas suman el total.

3. **«¿A quién le caen?»** quedó en el aviso y la tabla de responsables. Fuera
   la gráfica de asignación en el tiempo, los cuatro KPI y el párrafo.

4. **«¿Llegan al CRM?»** pasó de cuatro tarjetas a tres: Meta, CRM de redes —que
   ahora lleva la diferencia en su propia línea— y **leads de página web**. La
   brecha sigue viéndose completa en la gráfica y en la tabla.

5. **«Lectura y recomendaciones» → «Acciones a tomar».** Ocho acciones, cada una
   con quién la ejecuta, **los pasos concretos**, un esfuerzo estimado rotulado
   como juicio y no como dato, y la cifra medida que la justifica.

6. **Las notas se partieron en tres bloques rotulados**: *Glosario* (qué
   significa cada palabra), *Dónde es fácil equivocarse* (las cinco lecturas que
   parecen obvias y están mal, cada una salida de un error real) y *Estado del
   dato* (qué tan fresco, qué falta, cómo se regenera). Antes era un muro sin
   jerarquía y no se entendía si era glosario o notas.

### Dos defectos que encontró la prueba en navegador

- **Una regla CSS muerta seguía ganando.** `.emb-barra` tenía `flex: 0 1 220px`
  del diseño anterior; dentro de un flex en **columna** ese 220px es **altura**,
  así que la barra de plan de 6 px se dibujaba de 220 px y se comía las filas.
  Se borraron las 33 reglas del embudo por filas —su marcado ya no existe— en
  vez de taparlas con una regla más específica.
- **Mover un bloque cambia su fondo.** La leyenda entró al cuadro oscuro y
  quedó gris sobre negro; la lectura salió del cuadro y quedó blanca sobre
  blanco. Las dos heredaban colores escritos para el otro fondo. Cada elemento
  toma ahora su color del mismo juego que la superficie que tiene detrás.

### Ajuste del 2026-09-18 (tarde)

- **Fuera la sección «Cierre por vendedor».** Se borró completa —encabezado,
  nota y tabla—, junto con su entrada en el riel y la función que la pintaba.
- **«Acciones a tomar» pasó de 8 a 6 tarjetas y de ~1.900 px a 492.** Se
  quitaron las dos que no cambiaban nada por sí solas (llenar el Importe de 16
  Tratos y una de las de estrategia, que se fusionó). Cada tarjeta deja a la
  vista solo lo que hace falta para decidir —qué, quién, cuánto cuesta y la
  cifra que lo justifica— y esconde los pasos en un desplegable «Cómo».
- **«Cómo leer este tablero» bajó de ~1.100 px a 630.** Diecisiete entradas
  largas pasaron a quince de **una sola frase**, en tres columnas rotuladas por
  su propósito. Lo que había que conservar y no cabía —el comando para
  regenerar, qué no responde a los filtros, la advertencia de que el ingreso es
  lo registrado y no facturación auditada— vive en un desplegable al pie.

**Defecto propio, encontrado por la prueba:** al cortar la sección de vendedor
se fue con ella `globales()`, que vivía entre esa sección y las acciones, y la
página quedó con `globales is not defined`. Cortar por rangos de texto se lleva
lo que está en medio; la prueba en navegador lo agarró antes de publicar.
