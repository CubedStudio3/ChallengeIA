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
