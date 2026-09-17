# De dónde sale cada número del tablero Ciclo del Lead

Escrito el 2026-09-19 porque Mercadeo revisó el CRM y «no cuadra nada». Cada
cifra de abajo se volvió a pedir al CRM **ese día**, con una consulta de control
hecha aparte de la extracción, y la consulta queda escrita para que cualquiera
la repita.

**Ventana de todo este documento:** `Created_Time` entre `2026-01-01` y
`2026-09-16`, en la hora de la cuenta (`-06:00`).

---

## 1. La causa número uno de que no cuadre

> **Un informe o una vista de Zoho excluye los leads ya CONVERTIDOS por
> omisión. Este tablero los incluye.**

No es una diferencia menor y no es parejo entre canales:

| Canal | No convertidos | Convertidos | Total del tablero |
|---|---|---|---|
| Redes sociales (Meta) | 3.908 | 216 | **4.124** |
| Página web | **92** | **597** | **689** |
| WhatsApp / Chat | 12 | 94 | **106** |
| Directo / Referidos | 24 | 103 | **127** |
| **Total** | **4.036** | **1.010** | **5.046** |

Mirá la fila de **Página web**: un informe que excluya convertidos muestra
**92** donde el tablero muestra **689**. Son 7,5 veces. Y por país la asimetría
es igual de fuerte:

| País | No convertidos | Convertidos | Total |
|---|---|---|---|
| Guatemala | 1.444 | **893** | **2.337** |
| El Salvador | 2.498 | 105 | **2.603** |
| (vacío) | 94 | 12 | **106** |

En **Guatemala** el informe deja fuera el **38%** de los leads; en El Salvador,
el 4%. Por eso «no cuadra nada» se siente peor mirando Guatemala.

El motivo de fondo es razonable: para Zoho un lead convertido «ya no es un
lead». Para esta pregunta —*¿el lead era malo o Ventas no cerró?*— un lead
convertido es justo el que **sí** avanzó: excluirlos borraría el éxito del
embudo y dejaría solo lo que se cayó.

### Cómo verlo

```sql
-- lo que ve un informe normal (convertidos FUERA)
select COUNT(id) as n from Leads
 where (Created_Time >= '2026-01-01T00:00:00-06:00'
    and Created_Time <= '2026-09-16T23:59:59-06:00')
-- → 4036

-- los que el informe se salta
select Converted__s, COUNT(id) as n from Leads
 where ((Created_Time >= '2026-01-01T00:00:00-06:00'
    and Created_Time <= '2026-09-16T23:59:59-06:00')
    and Converted__s = true)
 group by Converted__s
-- → 1010          4036 + 1010 = 5046, el número del tablero
```

---

## 2. Las tres fuentes, y nada más

El tablero no tiene ninguna otra entrada. No hay hojas de cálculo, no hay
números escritos a mano, no hay estimaciones.

| Fuente | Cómo se lee | Qué campos |
|---|---|---|
| **Zoho CRM · Posibles clientes** | COQL paginado, 2.000 filas por página | `id`, `Created_Time`, `Lead_Source`, `Lead_Status`, `Pa_s`, `Converted__s`, `Converted_Deal`, `Owner` |
| **Zoho CRM · Tratos** | COQL paginado | `id`, `Created_Time`, `Lead_Source`, `Pa_s_Operaci_n`, `Stage`, `Producto`, `Amount`, `Raz_n_Stand_By`, `Selecciones_Razones`, `Owner` |
| **Zoho CRM · Usuarios** | `getUsers` | `id`, `name`, `status`, `role` |
| **Meta Ads** | `ads_get_ad_entities`, día por día y por país | `amount_spent`, `lead`, `onsite_conversion_lead_grouped`, `country`, `date_start` |

Las respuestas crudas se guardan tal cual en `data/ciclo_lead/crudo/` — se
pueden abrir y contar a mano. De ahí sale `dataset.json`, que es lo único que
viaja dentro de la página: el tablero calcula en el navegador sobre esas filas,
así que **los filtros recalculan de verdad** y ningún número está pre-cocinado.

---

## 3. Número por número

### Leads que entraron · 5.046

Todo registro de **Posibles clientes** creado en la ventana, **convertidos
incluidos**. El corte es por `Created_Time`, no por fecha de modificación ni de
cierre.

### Calificados · 966

Un lead cuenta como calificado cuando **tiene un Trato asociado** (`Converted_Deal`
apunta a un Trato que existe). No es un estado ni una etiqueta: es la existencia
del Trato.

**Hueco declarado:** hay **1.010** leads marcados como convertidos y solo
**966** tienen Trato. Los **44** restantes traen `Converted_Deal` **vacío** — el
CRM dice «convertido» y no apunta a ningún Trato. Medido: ninguno de los 44 es
un Trato fuera de la ventana; la llave está vacía. En el tablero cuentan como
**no** calificados, y el número aparece en el bloque «Cómo leer este tablero».

En el otro sentido: **47** Tratos de la ventana no tienen lead de origen dentro
de la ventana (nacieron como Trato, o vienen de un lead de antes de enero).

### Tratos · 1.013 · y las 7 etapas

```sql
select Stage, COUNT(id) as n from Deals
 where (Created_Time >= '2026-01-01T00:00:00-06:00'
    and Created_Time <= '2026-09-16T23:59:59-06:00')
 group by Stage
```

| Etapa | n |
|---|---|
| closed won | **717** |
| closed lost | **182** |
| Stand By | 66 |
| Calificado Interesado | 24 |
| Necesita validarlo con alguien más | 13 |
| Interesado listo para pagar | 7 |
| Interesado - Negociando | 4 |
| **Total** | **1.013** |

**Ganados** = `closed won`. **% de cierre** = ganados ÷ (ganados + perdidos) =
717 ÷ 899. Stand By y las etapas abiertas **no** entran en el denominador: un
Trato que sigue vivo todavía no se ganó ni se perdió.

### Canal · de `Lead_Source`, agrupado

El CRM tiene **12** valores de `Lead_Source` en esta ventana (10 aparecen entre
los no convertidos y 11 entre los convertidos; la unión es 12). El tablero los agrupa en 4 canales
y el mapa completo es este — no hay ningún «otros»:

| Canal del tablero | `Lead_Source` del CRM |
|---|---|
| Redes sociales (Meta) | `Meta Ads`, `Facebook Ads`, `Facebook Lead`, `Instagram DM` |
| Página web | `Página web` |
| WhatsApp / Chat | `Chat / WhatsApp`, `WHATSAPP - Qpaypro` |
| Directo / Referidos | `Cliente se comunicó`, `Llamada en Frio`, `Referido`, `Partner`, `Eventos` |

Si Ventas agrega un valor nuevo a `Lead_Source`, **la corrida se detiene** y lo
reporta. Nunca cae en un cajón de sobras.

### País · de `Pa_s` en el lead

Ojo, porque aquí hay dos campos distintos que es fácil confundir:

- el **lead** trae `Pa_s`;
- el **Trato** trae `Pa_s_Operaci_n`.

El filtro de País del tablero usa **el del lead** para los leads y **el del
Trato** para los Tratos. No se mezclan. **106** leads traen el campo vacío y
salen como «Sin país» en vez de repartirse a ojo.

### El plan · de `Producto` en el Trato

`Producto` —«Plan QPayPro» en la interfaz— tiene **siete** valores y el tablero
escribe **el nombre del CRM**, uno por uno:

| Plan | Tratos |
|---|---|
| Free | 574 |
| Premium Anual | 413 |
| Premium Mensual | 10 |
| Elite Anual | 9 |
| Afiliación Premium Silver Anual | 3 |
| Kit de Punto de Venta QpayPOS | 1 |
| (sin producto) | 3 |

**El plan vive en el Trato, no en el lead.** Un lead sin Trato no tiene plan, y
eso no se rellena. Donde el tablero necesita dos tramos —las barras del
embudo— el grupo se llama **«de pago»**, que no es el nombre de ningún plan.

### Leads de Meta · 4.634 del formulario + 1.078 del sitio

De Meta Ads, no del CRM. «Clientes potenciales» es una **suma de dos puertas**:

- `onsite_conversion_lead_grouped` = **4.634**, los que ocurren **dentro de
  Meta** (formulario instantáneo, Messenger, DM). Entran al CRM como **Redes**.
- la resta = **1.078**, los del **sitio web** por el pixel. Entran al CRM como
  **Página web**.

La cuadratura que sirve es la primera: **4.634** contra **4.124** de redes en el
CRM = **−510 · −11,0%**. La del sitio web **no** es una cuadratura y el tablero
lo declara: al sitio también llega quien nunca vio un anuncio.

---

## 4. Los cinco lugares donde un informe de Zoho y este tablero se separan con razón

1. **Los convertidos.** El informe los excluye; el tablero no. Ver §1.
2. **La fecha.** El tablero corta por `Created_Time`. Un informe que corte por
   fecha de cierre o de última modificación arma otra población.
3. **El país.** El del lead (`Pa_s`) no es el del Trato (`Pa_s_Operaci_n`), y
   una vista con filtro de país deja fuera los 106 que lo traen vacío.
4. **«Calificado».** Aquí significa *tiene Trato*, no un estado del lead.
5. **El momento.** El dato es una **foto del 2026-09-17**. El CRM sigue
   recibiendo: una captura de hace unos días es un **mes más corto**, no un mes
   distinto. Ya pasó una vez —60 contra 82 leads de Guatemala en septiembre eran
   el mismo filtro con seis días de diferencia—.

---

## 5. La trazabilidad no es este documento: es una compuerta

Todos los números de arriba están escritos **dentro** de
`src/modulo1/ciclo_lead.py`, con su consulta al lado, y se comprueban en **cada
corrida**. Si uno no cuadra, la corrida **se detiene** y no publica nada:

- el total de leads contra `4036 + 1010`;
- los Tratos contra el `COUNT` de las 7 etapas;
- **el corte por canal** contra los 4 totales de `Lead_Source` agrupados;
- **el corte por país** contra los 3 totales de `Pa_s`;
- el gasto de Meta contra la lectura mensual ya verificada, al centavo;
- los leads de Meta contra una lectura de **nivel de cuenta**, en las 18 celdas
  de mes × país.

Los dos cortes —canal y país— se agregaron el 2026-09-19. **Antes no estaban:**
las compuertas cuidaban los totales y dejaban sueltos justo los dos números que
el tablero muestra más grandes. Un total correcto con un corte torcido no avisa.

`npm run prueba:ciclo` rompe el dato a propósito **siete** veces y comprueba que
la corrida se detiene — entre ellas **un lead de redes movido a página web** y
**un lead de El Salvador movido a Guatemala**, que no cambian ningún total y
solo torcerían un corte. 7 de 7.

`npm run prueba:tablero-ciclo` abre la página en Chromium, filtra con el ratón
en tres ventanas y recuenta cada cifra contra el dataset, aparte.

---

## 6. Para comprobarlo por su cuenta

1. Abrir el tablero **sin filtros** (Reiniciar). Debe decir **5.046** leads.
2. En Zoho, un informe de Posibles clientes creados entre el 1 de enero y el 16
   de septiembre dará **4.036**: la diferencia son los **1.010** convertidos.
3. Para verlos, quitar el filtro de convertidos del informe, o pedirlos con la
   segunda consulta de §1.
4. Cualquier cifra que siga sin cuadrar: decir **qué número, en qué vista del
   tablero y con qué filtro puesto**, y contra qué informe. Con eso se puede
   reproducir la consulta exacta y comparar poblaciones, que es donde siempre
   está la diferencia.

---

## 7. Los endpoints exactos, y los enlaces para abrir al lado

**No hay ninguna URL que este sistema «visite».** Los datos entran por
conectores MCP que llaman a APIs con autenticación; no hay una página que se
pueda abrir y leer. Así que hay dos listas distintas y conviene no confundirlas.

### 7.1 De dónde salen los datos (el endpoint real)

| Dato del tablero | Sistema | Llamada |
|---|---|---|
| Posibles clientes (leads) | Zoho CRM | `POST https://www.zohoapis.com/crm/v8/coql` con `{"select_query": "..."}` |
| Tratos | Zoho CRM | el mismo endpoint COQL, módulo `Deals` |
| Responsable, estado y rol del usuario | Zoho CRM | `GET https://www.zohoapis.com/crm/v8/users?type=AllUsers` |
| Reglas de asignación (fechas de modificación) | Zoho CRM | `GET https://www.zohoapis.com/crm/v8/settings/automation/assignment_rules` |
| Gasto, leads e impresiones de pauta | Meta Ads | endpoint **Insights** de la Marketing API sobre `act_225318458221662`, `level=campaign`, `breakdowns=country`, `time_increment=1` |

Documentación de COQL:
<https://www.zoho.com/crm/developer/docs/api/v8/coql-overview.html>

Dos precisiones sobre Meta:

- El conector expone los campos con **su** nombre: `lead` y
  `onsite_conversion_lead_grouped`. En el Graph API crudo esos dos números
  viven dentro de `actions`, bajo `action_type = lead` y
  `action_type = onsite_conversion.lead_grouped`.
- **`facebook.com` y `business.facebook.com` están bloqueados desde este
  entorno** por la política de egreso (`connect_rejected · 403`). A Meta se
  llega **solo** por el conector; el enlace de Ads Manager de abajo es para
  abrirlo desde un navegador, no algo que este sistema pueda comprobar.

### 7.2 Los enlaces de la interfaz (para comparar a mano)

Armados con el **zgid `647794829`** —de `getOrganization`— y el `api_name` de
cada módulo —de su metadata—. Zona horaria de la cuenta:
**`America/Guatemala` (−06:00)**, la misma que usan todas las consultas.

| Para ver | Enlace |
|---|---|
| Posibles clientes | `https://crm.zoho.com/crm/org647794829/tab/Leads/list` |
| Tratos | `https://crm.zoho.com/crm/org647794829/tab/Deals/list` |
| Un lead concreto | `https://crm.zoho.com/crm/org647794829/tab/Leads/<id>` |
| Pauta del 1 al 15 de septiembre | `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=225318458221662&date=2026-09-01_2026-09-15` |

En Ads Manager, para llegar al mismo corte: **Desglose → Por entrega → País**,
y columnas **Clientes potenciales**, **Clientes potenciales en Meta** e
**Importe gastado**.

---

## 8. Ejemplo trabajado · Guatemala, 1 al 15 de septiembre de 2026

Las tres fuentes pedidas en vivo el 2026-09-19 y el tablero con el filtro
puesto. **Coinciden fuente por fuente.**

### CRM · 125 leads

```sql
-- los que ve un informe normal (convertidos FUERA)
select Lead_Source, COUNT(id) as n from Leads
 where ((Created_Time >= '2026-09-01T00:00:00-06:00'
     and Created_Time <= '2026-09-15T23:59:59-06:00')
    and Pa_s = 'Guatemala')
 group by Lead_Source
-- → Meta Ads 64 · Página web 9 · Chat / WhatsApp 1   = 74

-- los convertidos, que el informe se salta
select Lead_Source, COUNT(id) as n from Leads
 where (((Created_Time >= '2026-09-01T00:00:00-06:00'
      and Created_Time <= '2026-09-15T23:59:59-06:00')
     and Pa_s = 'Guatemala') and Converted__s = true)
 group by Lead_Source
-- → Página web 37 · Llamada en Frio 5 · Chat / WhatsApp 3 · Cliente se comunicó 2
--   · Meta Ads 2 · Referido 1 · WHATSAPP - Qpaypro 1   = 51
```

**74 + 51 = 125**, el número del tablero. Aplicando el mapa de canal:

| Canal | No conv. | Conv. | Total |
|---|---|---|---|
| Redes sociales (Meta) | 64 | 2 | **66** |
| Página web | 9 | 37 | **46** |
| Directo / Referidos | 0 | 8 | **8** |
| WhatsApp / Chat | 1 | 4 | **5** |

Un informe sin convertidos mostraría **9** leads de página web en vez de 46.

### Meta · 136 clientes potenciales

| | GT, 1–15 sep |
|---|---|
| Clientes potenciales (`lead`) | **136** |
| · dentro de Meta (`onsite_conversion_lead_grouped`) | **77** |
| · del sitio web (la resta) | **59** |
| Importe gastado | **$525,43** |
| Impresiones | 148.253 |
| Costo por lead | $3,86 |

**Trampa al comparar en Ads Manager:** de esos $525,43, **$2,65 los gastó la
campaña llamada «Punto de Venta SV» entregando en Guatemala**. Filtrar por
nombre de campaña la deja fuera; el desglose por país la incluye. El gasto de
GT son tres filas: Punto de Venta GT $448,97 + Plan Free Tráfico $73,81 +
Punto de Venta SV $2,65.

### La cuadratura

| | Meta | CRM | |
|---|---|---|---|
| Dentro de Meta → canal Redes | **77** | **66** | **−11 · −14,3%** |
| Sitio web (pixel) → canal Página web | 59 | 46 | no se restan |

Y un detalle que explica una diferencia de 1: en esa misma ventana hay **1 lead
de Página web con el campo `Pa_s` vacío**. No entra en el filtro de Guatemala —
sale como «Sin país», no se reparte a ojo.

### El resto de la vista

| | |
|---|---|
| Leads | 125 |
| Calificados (tienen Trato) | 51 |
| Plan | Free 31 · Premium Anual 14 · Elite Anual 5 · sin plan 1 |
| Tratos en la vista | 54 |
| Ganados | 44 |
| % de cierre sobre Tratos | 93,6% |

Los Tratos (54) se cortan por **su** fecha de creación y por
`Pa_s_Operaci_n`, no por los campos del lead: por eso 54 no es 51.

### Cómo reproducirlo en la interfaz de Zoho

1. Posibles clientes → **Crear vista personalizada**.
2. Criterio: `Fecha de creación` entre `01/09/2026` y `15/09/2026`, **y**
   `País` = `Guatemala`.
3. En las opciones de la vista, **incluir los convertidos** (o quitar el
   criterio que los excluye). Sin este paso salen 74 en vez de 125.
4. Agrupar o filtrar por `Origen del posible cliente` para ver los 4 canales.


---

## 9. Las dos vistas del CRM con las que compara Mercadeo

### 9.1 `Leads Guatemala` · cuadra exacto

<https://crm.zoho.com/crm/qpaypro/tab/Leads/custom-view/2592238000187504053/list>
· **Registros totales 82**

Reproducida al registro: **no convertidos**, `Pa_s` = `Guatemala` **o vacío**,
`Created_Time` en septiembre.

| | |
|---|---|
| No convertidos, GT o vacío, creados en septiembre | **82** |
| · de los cuales GT | 81 |
| · de los cuales sin país | 1 |

El mismo filtro dio **60** en la captura de la semana anterior: es el acumulado
**al 11 de septiembre**, día por día. El mismo filtro, seis días menos.

**Por qué el tablero dice 132 y no 82 en Guatemala en septiembre:** la vista no
cuenta los **51 convertidos** del mes. 81 + 51 = 132. Los dos números son
correctos y miden cosas distintas: la vista es «lo que sigue en la bandeja», el
tablero es «todo lo que entró».

### 9.2 `Afiliaciones Free y Premium Solas` · Free cuadra, Premium no se puede reproducir

<https://crm.zoho.com/crm/qpaypro/tab/Reports/2592238000191665090>
· **Registros totales 38** · Free **33** (Guatemala 32) · segunda barra **5**

**Free cuadra exacto** con `Closing_Date` en septiembre:

| | |
|---|---|
| Free, fecha de cierre en septiembre, todos los países | **33** |
| · Guatemala | **32** |
| · y las 32 de Guatemala están todas en `closed won` | ✅ |

**La segunda barra (5) no se puede reproducir con «solo este mes».** Con ese
único filtro, `Closing_Date` en septiembre da:

| Plan | Todos | Guatemala |
|---|---|---|
| Free | 33 | 32 |
| **Premium Anual** | **43** | 30 |
| Premium Mensual | 1 | 1 |
| Elite Anual | 8 | 5 |
| (sin plan) | 1 | 1 |
| **Total** | **86** | 69 |

El informe dice 38 y esta consulta dice 86, así que el informe tiene **otro
recorte** además del mes. Hay al menos tres combinaciones que caen cerca de 38
y **no pueden ser todas la definición**:

- Free 33 + **Elite Anual** 8 = 41
- Free 33 + Elite Anual **de Guatemala** 5 = **38** ← cae justo, mezclando ámbitos
- `Closing_Date` en septiembre **y creados en septiembre**: Free 33 + Premium
  Anual 15 + Premium Mensual 1 + Elite Anual 5 + 1 sin plan = 55

Elegir la que cuadra sería **inventar la definición para que dé el número**. La
definición de un informe de Zoho no la expone la API: hay que leerla en el
informe. Queda pendiente de un dato de Mercadeo —el criterio del informe, o los
nombres de los 5 registros de la segunda barra— y hasta entonces **no se
publica ninguna cifra derivada de él**.

### 9.3 Simplificación pedida · Free y Premium, dos tramos

Por pedido de Mercadeo del 2026-09-19, el desglose de plan del KPI de leads
vuelve a **dos** tramos con el vocabulario del informe: **Free** y **Premium**.
Los seis planes de pago del CRM y los Tratos sin plan anotado **no desaparecen**:
viven en el globo del chip de pago, así que el dato sigue a un clic y la tarjeta
se lee de un vistazo.

`npm run prueba:tablero-ciclo` vigila ese contrato: exactamente dos tramos,
`Free + Premium + sin plan = calificados`, y **el globo tiene que nombrar cada
plan real del CRM**. Si mañana Ventas agrega un plan y no aparece ahí, la prueba
se pone roja.


---

## 10. Corrección del 2026-09-19 (noche) · el encabezado son dos números

Mercadeo: *«solo quiero saber cuántos entraron y los close won; a mí no me
sirve si están negociando»*. El encabezado tenía cuatro tarjetas y dos de ellas
—**Calificados** y **% de cierre sobre Tratos**— contaban etapas intermedias.
Ahora son tres:

| | Guatemala, septiembre |
|---|---|
| **Leads que entraron** | **132** |
| **Compraron · closed won** | **42** · Free 31 · Premium 11 |
| **% que compró** | **31,8%** |

### El arreglo de fondo: una sola cohorte

«Ganados» se contaba sobre los **Tratos** del periodo, y los Tratos traen **su
propia fecha de creación y su propio `Pa_s_Operaci_n`**. Con el filtro en
Guatemala del 1 al 15 daba **44**, que no son 44 de los 125 leads de esa
ventana: mezclaba Tratos de leads más viejos y dejaba fuera Tratos de leads de
la ventana cerrados después. Dos cohortes presentadas como un embudo.

Ahora la etapa del Trato **viaja al lead que lo originó** (`ganado` en la fila
del lead), así que «entraron» y «compraron» se cuentan sobre el **mismo
conjunto**: los leads creados en la ventana. El porcentaje ya significa lo que
dice.

Medido sobre Guatemala en septiembre: de los **132** que entraron, **51**
llegaron a Trato, **42** compraron, **3** se perdieron, **6** siguen abiertos y
**81** nunca llegaron a Trato.

### La compuerta

`CONTROL_WON = 707` en `ciclo_lead.py`, y cierra contra el `COUNT` ya verificado
en vivo: de los **717** `closed won` del periodo, **707** tienen lead de origen
dentro de la ventana y **10** no (8 sin fuente y 2 de Facebook). **707 + 10 =
717.**

---

## 11. `Afiliaciones` · el módulo que Mercadeo señaló como fuente real del plan

<https://crm.zoho.com/crm/qpaypro/tab/CustomModule1/custom-view/2592238000003711186/kanban>

`CustomModule1` es el módulo **`Afiliaciones`** (id `2592238000003711174`), no
Tratos. La observación era buena: tiene **su propio** `Producto` («Plan
QPayPro»), su propio `Pa_s_Operaci_n`, `Fecha_de_activaci_n`,
`No_Afiliaci_n_QPay` y `Comercio_Activo` — es el registro operativo de la
afiliación, y se une a Tratos por el lookup **`Trato_Asociado`**.

**Medido: las dos fuentes NO se contradicen.** Se siguió la cadena completa
—lead → `Converted_Deal` → Trato → `Trato_Asociado` → Afiliación— para los 51
leads convertidos de Guatemala en septiembre:

| | |
|---|---|
| Tratos con Afiliación | 41 de 51 |
| Planes donde el Trato y la Afiliación **discrepan** | **0** |
| De los 42 que compraron, sin registro de Afiliación | 1 (`POS Soporte`, Free) |

Así que leer `Producto` del Trato **no era asumir**: da el mismo plan que la
Afiliación en todos los casos medidos. Lo que la Afiliación agrega y el Trato no
tiene es el estado operativo —fecha de activación, número de afiliación,
comercio activo—, que es otra pregunta y hoy no está en el tablero.

**Y sigue sin poder reproducirse el informe `Afiliaciones Free y Premium
Solas` (38 registros).** Contando sobre el módulo `Afiliaciones`:

| Filtro | Free | Premium Anual | Elite Anual | otros | Total |
|---|---|---|---|---|---|
| `Created_Time` en septiembre | 32 | 10 | 3 | 1 | **46** |
| `Fecha_de_activaci_n` en septiembre | 15 | 7 | 2 | — | **24** |

Ni 46 ni 24 son 38, y ninguna combinación de ámbitos lo da sin mezclarlos. Van
**seis** intentos. El informe tiene un recorte que la API no expone y que no
está en el chip de filtro visible. Sigue pendiente del criterio del informe, y
hasta entonces no se publica ninguna cifra derivada de él.


---

## 12. Corrección del 2026-09-19 (cierre) · la venta se cuenta por FECHA DE CIERRE

Mercadeo: *«quitá el de ENDURA COSMETIC, porque la fecha de cierre fue en
agosto; no tomes en cuenta la fecha de última actividad, solo la de cierre. Creo
que por eso no nos cuadraba»*. Tenía razón, y era **la** causa.

Informe de referencia:
<https://crm.zoho.com/crm/qpaypro/tab/Reports/2592238000018735023>

### Lo que cambió

| | Antes | Ahora |
|---|---|---|
| Criterio de «Compraron» | fecha del **lead** que lo originó | **`Closing_Date` del Trato** |
| GT, septiembre | 42 (Free 31 · Premium 11) | **44** (Free **32** · Premium **12**) |
| Elite Anual en GT septiembre | 3 | **2** |

`ENDURA COSMETICS, S.A.` sale solo: su `Closing_Date` es **2026-08-31**. No hubo
que excluirlo a mano — cambiar el criterio lo saca, que es lo correcto.

Y **Free 32** ahora coincide exacto con el informe, igual que **Elite Anual 2**.

### `Closing_Date` no estaba en la extracción

Hubo que volver a pedir Tratos. Y pedirlos por fecha de cierre **cambia la
población**, no solo el corte:

```sql
select id, Created_Time, Closing_Date, Stage, Producto, Pa_s_Operaci_n,
       Amount, Lead_Source, Owner, Raz_n_Stand_By, Selecciones_Razones
  from Deals
 where ((Created_Time >= '2026-01-01T00:00:00-06:00'
     and Created_Time <= '2026-09-16T23:59:59-06:00')
    or (Closing_Date >= '2026-01-01' and Closing_Date <= '2026-12-31'))
 limit 2000                                              -- → 1.020 filas
```

La unión hace falta porque **hay Tratos creados fuera de la ventana que cierran
dentro**: 7 en total, 3 de ellos ganados (creados el 2025-09-10, el 2025-11-25 y
el 2026-09-17). Cortar solo por creación los perdía.

### Dos trampas que salieron al hacerlo

- **Una fecha de cierre puede ser POSTERIOR al último día con datos.** Dos
  ventas de Guatemala cierran el **17** y el **30 de septiembre**, después del
  16 que es el último día con leads. Sin ellas, Free daba 31 y no 32 — la mitad
  del descuadre era esto. El vocabulario de fechas del tablero se extendió al
  **30 de septiembre** para que existan.
- **Y puede ser muy ANTERIOR.** Al pedir la unión entraron Tratos creados en
  **2021** y cierres en **2025** y **noviembre de 2026**: el filtro del tablero
  se estiró de `2021-01-07` a `2026-11-05` y el rango dejó de significar «el
  periodo del análisis». Las dos fechas del Trato se **acotan a la banda**
  `2026-01-01 .. 2026-09-30`; la que cae fuera queda en `-1`, sale sola de los
  cortes que usan esa fecha, y el conteo se declara en `calidad`
  (`cierres_fuera: 14`, `creados_fuera: 4`). Ningún ganado de 2026 queda fuera
  de la banda, y hay una compuerta que lo comprueba.

### El porcentaje se fue, a propósito

Antes había una tercera tarjeta con «% que compró». Con las ventas por **fecha
de cierre** y los leads por **fecha de creación**, ese cociente mezcla dos
fechas y se leería como una tasa de conversión que no es. Cada tarjeta ahora
**declara sobre qué fecha cuenta** —«Por fecha de creación del lead», «Por fecha
de cierre del Trato»— y la prueba se pone roja si aparece un `%` en los rótulos.

### Compuertas

- `CONTROL_WON = 719` · verificado en vivo: `closed won` con `Closing_Date`
  entre el 1 de enero y el 16 de septiembre = **717**, más **2** que cierran
  después = **719**.
- Ningún ganado de 2026 puede cerrar fuera de la banda del periodo.
- Los conteos por **creación** (1.013 Tratos, las 7 etapas) se aplican ahora a
  **su subconjunto** del archivo, no al total: el archivo cubre la unión de dos
  criterios y su total ya no es el de la consulta por creación.

`npm run prueba:ciclo` pasa de 7 a **9 de 9** sabotajes: se agregaron **una
venta movida a 2027** —que el conteo por creación no vería— y **una venta de
2026 movida a noviembre**, que sigue siendo de 2026 pero el tablero no podría
situar en ninguna ventana.


---

## 13. Hacia la corrida diaria · las compuertas dejaron de tener números adentro

Para que esto pueda correr solo, lo primero no era programarlo: era que las
compuertas **dejaran de comparar contra números congelados**. Estaban escritos
en `ciclo_lead.py` (5.046 leads, 1.013 Tratos, 719 ventas, los 4 canales, los 3
países, las 18 celdas de Meta). Con el CRM recibiendo todos los días, mañana
ninguno coincide y la corrida se detendría **sin que nada estuviera mal**.

Ahora todos salen de `crudo/controles.json`, que se pide al CRM y a Meta
**aparte de la extracción y en la misma corrida**. Lo que verifica sigue siendo
lo mismo: que **dos caminos distintos** den el mismo número — el volcado de
filas paginado contra la agregación del servidor. Y de ese archivo salen también
**la ventana y la banda de fechas**, no solo los valores.

`controles.json` trae: la ventana, la banda de cierre, y por bloque —
`crm`: no convertidos, convertidos, etapas, canal, país, ganados por cierre;
`meta`: gasto por mes y las celdas de mes × país.

**Un archivo incompleto es peor que uno ausente**, así que se comprueba la
forma antes de usarla: una llave que falta o un bloque vacío detienen la
corrida en vez de dejar esa compuerta apagada en silencio. `npm run
prueba:ciclo` pasa de 9 a **12 de 12** sabotajes: se agregaron el archivo
borrado, una llave quitada y un bloque vacío.

### Dos compuertas que medían lo mismo

Las de fecha de cierre contaban las dos «ganados dentro de la banda», así que la
segunda **no podía dispararse nunca** — y un camino que nunca se ejecuta no está
probado, está apagado. Ahora tienen trabajos distintos: una cuenta los ganados
**del año** contra el `COUNT` del CRM, y la otra comprueba que **todos** entren
en la banda. Cada sabotaje pega en la suya.

### Lo que falta para que sea diario

1. La Rutina, con Zoho CRM y Meta adjuntos y su Compuerta 0: sin conectores
   **no publica** y lo dice.
2. Que la ventana del control se escriba «del 1 de enero a ayer» en cada
   corrida, en vez de las fechas fijas de hoy.

---

## 14. El embudo · sin «Tratos cerrados», y la geometría arreglada

Mercadeo pidió quitar el paso **Tratos cerrados**: mezclaba ganados con
perdidos en un solo escalón y no era una decisión que nadie tome. El embudo va
ahora de lo que entró a lo que compró:

> Leads que entraron → Leads elegibles → Calificados → Ganados

Al tocarlo salieron **tres defectos** que la vista no mostraba:

- **`.embudos` estaba en `display:block`.** Las reglas de la rejilla se habían
  perdido —quedaron siete selectores `.embudos` **sin cuerpo**— y los dos
  embudos llevaban **apilados en todos los anchos** mientras el texto de la
  sección decía «a la izquierda… a la derecha». Un selector vacío no da ningún
  error. Restituidas, con `minmax(min(520px, 100%), 1fr)`.
- **El alto de fila estaba escrito dos veces**, 96px en el CSS y 96 en el
  generador. Cambiarlo en un solo lado desalinea el texto del SVG sin avisar.
  Ahora vive en `--emb-fila` y el JS lo lee de ahí.
- **Ningún alto fijo servía.** Medido: la celda más alta pide **89px** a 1100 de
  ancho y **148px** a 390. Con 96 fijos el número de una fila se montaba sobre
  la barra de plan de la anterior. La respuesta no era un número más grande:
  ahora las **tres columnas son una sola rejilla** con filas que crecen con su
  contenido, y **cada banda es su propio SVG dentro de su fila**, así que se
  alinea sola a cualquier ancho sin medir nada.

Y una trampa dentro de la solución: con el SVG **en flujo**, su alto intrínseco
—viewBox cuadrado a lo ancho de la columna— terminaba **mandando sobre la
fila**: filas de 222px donde el texto pedía 112. Va absoluto, fuera del flujo,
para que la fila la mande el texto.

`prueba:tablero-ciclo` vigila el contrato a 1440 y 390: cuatro pasos, sin
«Tratos cerrados», una banda por paso, ninguna celda desbordando su fila, y
**cada banda ocupando exactamente su fila** — comparando el alto, no solo el
borde de arriba, que es lo que dejó pasar el choque la primera vez.


---

## 15. Corrección · el embudo decía «se quedaron −1»

Mercadeo, mirando el 1 al 16 de septiembre: **Calificados 38 y Ganados 39**, con
una caída de **−1 (−2,6%)**. Un paso de un embudo no puede ser mayor que el de
arriba. Es un defecto mío y es el mismo de siempre, en otra forma: **dos
cohortes en una sola figura**.

- **Calificados** salía de los **leads** creados en la ventana.
- **Ganados** salía de los **Tratos** creados en la ventana — otra población,
  con su propia fecha.

Así que un Trato ganado cuyo lead entró **antes** de la ventana contaba en uno y
no en el otro, y el último paso podía quedar por encima.

Estaba desde antes, pero con el paso «Tratos cerrados» en medio el número
quedaba escondido; al quitarlo, la contradicción salió a la superficie. **Quitar
un intermediario no causó el defecto: lo destapó.**

### El arreglo

El embudo es una figura de **cohorte**: sigue a los leads que entraron. Sus
cuatro pasos se cuentan ahora sobre **el mismo conjunto de leads**, así que cada
paso es, por construcción, menor o igual que el anterior. La etapa del Trato
vuelve a viajar al lead que lo originó (`lWON`).

| | antes | ahora |
|---|---|---|
| Página web, 1–16 sep | 50 → 49 → 38 → **39** | 50 → 49 → 38 → **37** |
| Formulario de Meta | 163 → 156 → 2 → 1 | 163 → 156 → 2 → **0** |

**Y no contradice la tarjeta de arriba.** «Compraron · closed won» cuenta por
**fecha de cierre** —el criterio de Mercadeo y el de sus informes—; el embudo
cuenta sobre los leads que dibuja. Son dos preguntas distintas y cada una dice
sobre qué fecha cuenta: la tarjeta en su subtítulo, el embudo en el suyo
(«closed won · de estos mismos leads»).

### La guardia

`prueba:tablero-ciclo` comprueba ahora la **invariante del embudo** en las dos
figuras: **ningún paso puede ser mayor que el anterior**, y ninguna caída puede
ser negativa. Se verifica en cada ventana que la prueba recorre — y hacía falta
justamente eso: **con el periodo entero el defecto no aparecía**, solo con un
mes corto.


---

## 16. «¿No hubo ninguna venta del formulario?» · las dos lecturas, las dos ciertas

Mercadeo, sobre el embudo del 1 al 16 de septiembre: *«¿me estás diciendo que no
hubo ningún trato won de los que entraron por formulario? Según Ventas sí
hubo»*. **Ventas tiene razón y el embudo también.** Son dos preguntas distintas.

Medido, y confirmado en vivo contra el CRM:

| | |
|---|---|
| Leads de redes que entraron del 1 al 16 | **163** |
| De esos, con Trato | 2 |
| De esos, **ganados** | **0** |
| Ventas de redes **cerradas** en esa quincena | **1** |

La venta existe: **`Amplitech Solutions SA de CV`**, Premium Anual, El Salvador,
Trato creado el **1 de septiembre** y cerrado el **7**. Y su lead entró el
**29 de agosto**:

```sql
select id, Created_Time, Lead_Source, Pa_s, Converted_Deal from Leads
 where ((Created_Time >= '2026-01-01T00:00:00-06:00' and Converted__s = true)
    and Converted_Deal = '2592238000219532213')
-- → creado 2026-08-29, Lead_Source «Meta Ads», El Salvador
```

En todo septiembre hay **una sola** venta con origen Meta, y es esa. Así que:

- **El embudo** contesta *«de los leads que entraron en esta ventana, ¿cuántos
  compraron?»* → **0**, porque los 163 tienen entre 1 y 16 días.
- **Ventas** contesta *«¿cuántas ventas de redes se cerraron en estas fechas?»*
  → **1**, y viene de un lead de agosto.

### Por qué el tablero igual estaba mal

Un dato correcto publicado de una forma que induce al error sigue siendo un
problema: **«Ganados 0» se lee como «el formulario de Meta no vendió nada»**, y
eso es falso en el sentido en que lo dice Ventas. Es la cuarta vez que este
proyecto tropieza con lo mismo.

Debajo de cada embudo va ahora **la otra lectura**, rotulada:

> **En la ventana** se cerraron **1** venta de este canal, contando por **fecha
> de cierre** — no son las mismas **0** de arriba: ahí se cuentan solo las de
> leads que entraron en la ventana, y una venta puede cerrarse con un lead más
> viejo.

Los dos números, cada uno con su criterio, en vez de uno que invita a concluir
de más. `prueba:tablero-ciclo` comprueba que el pie cuadre con el recuento por
fecha de cierre hecho aparte, en cada ventana.

### Y el efecto de madurez, que conviene tener presente

El embudo de una ventana reciente **siempre** subestima: sus leads no han tenido
tiempo. En el periodo completo, el formulario de Meta convierte 213 de 4.124
(5,2%); en una quincena, 2 de 163 (1,2%). No es que haya empeorado — es que la
mitad de esos leads tiene menos de una semana.
