# Shopify ↔ Qpaypro · sincronización de inventario
## Especificación de animación para After Effects

**Cómo se usa este archivo:** abrí After Effects en tu computadora, abrí ahí una
sesión de Claude de escritorio con el bridge `higgsfield-use-after-effects`
conectado, y pegá este documento completo como instrucción. La sesión local tiene
las herramientas `ae_project_info`, `ae_catalog`, `ae_do` y `ae_render_frame`;
esta especificación está escrita para que las use sin tener que inventar nada.

**Por qué existe:** un modelo de video genera movimiento *plausible*. Esto define
movimiento *decidido* — al frame, con curvas nombradas. Es la diferencia entre un
contador que más o menos cuenta y un 12 → 11 clavado.

---

## 0 · Composición

| Parámetro | Valor |
|---|---|
| Nombre | `QPP_Shopify_Sync_9x16` |
| Resolución | 1080 × 1920 |
| Frame rate | **60 fps** (el movimiento lento se delata a 30) |
| Duración | 12 s · **720 frames** |
| Color de fondo | `#FFFFFF` |
| Espacio de color | sRGB |

Todas las referencias de tiempo de aquí en adelante son **frames a 60 fps**.

---

## 1 · Paleta

Sale de `config/tema.json` del repositorio, que es el archivo que edita diseño.

| Rol | Hex | Uso |
|---|---|---|
| Fondo | `#FFFFFF` | Vacío infinito. Sin degradado, sin horizonte |
| Texto principal | `#14131F` | Titulares |
| Texto suave | `#65627A` | Bajadas, etiquetas de UI |
| Superficie de tarjeta | `#FFFFFF` | Tarjetas flotantes |
| Borde | `#E9E8F1` | Bordes de 1 px de las tarjetas |
| Positivo | `#12946B` | Solo el indicador de sincronizado |

> ⚠️ **Falta el color de marca real.** `tema.json` trae `marca: #000000`, que es
> un marcador de posición, no el color de Qpaypro. Antes de renderizar, que
> diseño lo reemplace en `config/tema.json` y se actualice acá. Mientras no
> esté, la línea de conexión va en `#14131F` al 40 %.

---

## 2 · Tipografía

| Parámetro | Valor |
|---|---|
| Familia | SF Pro Display · alternativas: Inter, Helvetica Now Display |
| Peso de titular | Semibold (600) |
| Cuerpo del titular | 68 px |
| Tracking | −20 (unidades AE) |
| Interlineado | 1.1 |
| Alineación | Centrada |
| Color | `#14131F` |

**Los tres titulares, en español latinoamericano.** Se escriben exactamente así:

1. `Shopify + Qpaypro`
2. `Tu inventario se sincroniza solo`
3. `Ves cada movimiento en Qpaypro`

Cierre: `Cobra, controla y crece`

> El copy queda **marcado para aprobación humana** antes de publicarse, según la
> regla 5 del proyecto.

---

## 3 · Curvas de easing

No usar «Easy Ease» por defecto en todo. Tres curvas, nombradas:

| Nombre | Bézier | Dónde |
|---|---|---|
| `ENTRADA` | `cubic-bezier(0.22, 1.00, 0.36, 1.00)` | Entradas de objetos y texto. Frena largo, sin rebote |
| `SALIDA` | `cubic-bezier(0.64, 0.00, 0.78, 0.00)` | Salidas y fundidos de salida |
| `CONTINUO` | `cubic-bezier(0.45, 0.05, 0.55, 0.95)` | El dolly-in largo del bloque 3 |

En AE: velocidad de keyframe con **influencia de salida 85 %, influencia de
entrada 15 %** aproxima `ENTRADA`. Nada de sobrepaso, nada de rebote.

**Regla de oro de este piezas:** nunca hay dos movimientos distintos corriendo al
mismo tiempo. Esa es la razón por la que las versiones generadas se veían
recargadas.

---

## 4 · Guion al frame

### Bloque 1 · Los dos sistemas · f0 – f240 (0.00 s – 4.00 s)

| Frames | Capa | Propiedad | De → A | Curva |
|---|---|---|---|---|
| 0–20 | — | — | Blanco vacío. Nada en pantalla | — |
| 20–50 | `tile_shopify` | Escala | 92 % → 100 % | ENTRADA |
| 20–50 | `tile_shopify` | Opacidad | 0 → 100 | ENTRADA |
| 35–65 | `tile_qpaypro` | Escala | 92 % → 100 % | ENTRADA |
| 35–65 | `tile_qpaypro` | Opacidad | 0 → 100 | ENTRADA |
| 80–140 | `linea_conexion` | Trim Paths · Fin | 0 % → 100 % | ENTRADA |
| 100–130 | `txt_01` | Opacidad | 0 → 100 | ENTRADA |
| 100–130 | `txt_01` | Posición Y | +12 px → 0 | ENTRADA |
| 145–175 | `linea_conexion` | Opacidad | 100 → 55 → 100 | CONTINUO |
| 210–240 | todo el bloque | Opacidad | 100 → 0 | SALIDA |

**Layout:** los dos tiles son cuadrados redondeados de **260 × 260 px**, radio
**58 px** (proporción de icono de iOS), separados **120 px**, centrados
horizontalmente, con su centro en **Y = 760** (arriba del centro óptico).

Sombra: `#14131F` al 8 %, desenfoque 48, distancia 16, dirección 180°. Una sola
sombra. Sin brillo interior, sin destellos.

`linea_conexion`: trazo de **2 px**, `#14131F` al 40 %, horizontal, une los bordes
internos de los dos tiles. Terminaciones redondeadas.

`txt_01` centrado en **Y = 1180**.

---

### Bloque 2 · La sincronización · f240 – f480 (4.00 s – 8.00 s)

| Frames | Capa | Propiedad | De → A | Curva |
|---|---|---|---|---|
| 240–275 | `card_inventario` | Opacidad | 0 → 100 | ENTRADA |
| 240–275 | `card_inventario` | Posición Y | +32 px → 0 | ENTRADA |
| 320–332 | `digito_viejo` | Posición Y | 0 → −28 px | SALIDA |
| 320–332 | `digito_viejo` | Opacidad | 100 → 0 | SALIDA |
| 326–344 | `digito_nuevo` | Posición Y | +28 px → 0 | ENTRADA |
| 326–344 | `digito_nuevo` | Opacidad | 0 → 100 | ENTRADA |
| 350–370 | `check_sync` | Escala | 0 % → 100 % | ENTRADA |
| 300–330 | `txt_02` | Opacidad + Y | igual que `txt_01` | ENTRADA |
| 450–480 | todo el bloque | Opacidad | 100 → 0 | SALIDA |

**`card_inventario`:** tarjeta de **720 × 420 px**, radio **32 px**, relleno
`#FFFFFF`, borde 1 px `#E9E8F1`, misma sombra que los tiles. Centrada, centro en
**Y = 800**.

Dentro de la tarjeta, una sola fila de producto:
- Miniatura cuadrada 88 px a la izquierda, radio 16 px, gris `#F6F6F9`
- Nombre del producto en `#14131F`, 34 px
- A la derecha, el stock: dígitos a **56 px**, Semibold, tabular
- `check_sync`: punto de 16 px en `#12946B` junto al número

**El cambio de dígito es lo único que se mueve en todo el bloque.** 12 → 11, con
el dígito viejo saliendo hacia arriba y el nuevo entrando desde abajo, solapados
6 frames. Máscara de recorte sobre el área del número para que no se vea salir.

> No inventar un segundo contador ni una segunda tarjeta. El bloque anterior ya
> estableció que son dos sistemas; acá el mensaje es que el número es **uno solo**.

---

### Bloque 3 · La plataforma · f480 – f720 (8.00 s – 12.00 s)

| Frames | Capa | Propiedad | De → A | Curva |
|---|---|---|---|---|
| 480–520 | `card_dashboard` | Opacidad | 0 → 100 | ENTRADA |
| 480–520 | `card_dashboard` | Escala | 96 % → 100 % | ENTRADA |
| 480–660 | `card_dashboard` | Escala | 100 % → 104 % | CONTINUO |
| 520–600 | `fila_01…05` | Opacidad + Y | 0 → 100 · +16 px → 0 | ENTRADA |
| 540–570 | `txt_03` | Opacidad + Y | igual que los anteriores | ENTRADA |
| 655–685 | `card_dashboard`, `txt_03` | Opacidad | 100 → 0 | SALIDA |
| 670–700 | `logo_qpaypro` | Opacidad | 0 → 100 | ENTRADA |
| 670–700 | `logo_qpaypro` | Escala | 96 % → 100 % | ENTRADA |
| 690–715 | `txt_cierre` | Opacidad | 0 → 100 | ENTRADA |

**`card_dashboard`:** la captura real de la plataforma, colocada dentro de un
marco de **860 × 1120 px**, radio 36 px, borde 1 px `#E9E8F1`. Inclinación cero —
nada de perspectiva. Centro en **Y = 860**.

**`fila_01…05`:** las cinco filas de movimientos entran **escalonadas cada 4
frames**. No 20 filas: cinco. El resto de la captura ya está ahí desde f520.

El dolly de 100 % → 104 % corre **180 frames** debajo de todo lo demás. Es lento a
propósito: se siente, no se ve.

**Cierre:** logo centrado en **Y = 900**, `txt_cierre` a 38 px en `#65627A`,
centrado en **Y = 1060**.

---

## 5 · Insumos

Los archivos están subidos en Higgsfield con estos `media_id`. Si los necesitás en
disco para AE, bajalos desde tu navegador — el contenedor de la nube tiene ese
dominio bloqueado.

| `media_id` | Archivo |
|---|---|
| `ad92c31d-639d-413d-9b20-083078600d8c` | `Untitled design-17.png` |
| `82e34b70-9982-41e4-b7dd-0314fd875bba` | `Untitled design-18.png` |
| `10a5b4ec-cfff-46f2-8663-c4f84bb4caba` | `Shopify-Logo-PNG.png` |
| `2c02ad31-d467-4efb-9374-03439b11436a` | `Esto lo hicimos-6.png` |
| `79ce1f53-2715-49ea-a0e8-7644a7d4d4f1` | `IMG_1361.JPG` |
| `79d502d6-c398-4f71-bf5e-f7ebcb69c8e9` | `IMG_1365.JPG` |
| `aaa7a92f-4703-4e33-9a76-f64d40e1c200` | `IMG_1369.JPG` |

> **Sin etiquetar.** Solo está confirmado cuál es el logo de Shopify, por el
> nombre del archivo. Cuál de las demás es el logo de Qpaypro, cuál la captura de
> inventario y cuál la de movimientos hay que decidirlo al abrirlas.

**Los logos van como archivo, nunca redibujados.** Ese fue el problema de todas
las versiones generadas: el modelo los reinterpretaba. En AE se colocan tal cual.

---

## 6 · Render

| Parámetro | Valor |
|---|---|
| Formato | H.264 · MP4 |
| Resolución | 1080 × 1920 |
| Frame rate | 60 fps |
| Bitrate | 12–16 Mbps VBR 2 pasadas |
| Audio | ninguno |

Antes del render final, sacar **frames de prueba en f30, f150, f340, f560 y f700**
con `ae_render_frame` y mirarlos. Son los cinco momentos donde algo acaba de
asentar.

---

## 7 · Lo que esta pieza NO dice

- **Ningún número de rendimiento.** Nada de «X % más rápido» ni «Y comercios». El
  dato que no está medido no se escribe (regla 1 del proyecto).
- **Nada de «en minutos».** El sitio lo dice, pero como promesa de titular hace
  falta confirmarlo.
- **Las capturas van con datos de demo.** Un nombre de comercio, un monto o unos
  últimos cuatro dígitos reales en una pieza que se va a pautar es un problema que
  no se arregla después.

---

## 8 · Pendiente de Mercadeo

**`config/marca.json` no sabe que esta función existe.** Ese archivo —extraído del
sitio de Qpaypro— describe la integración con Shopify como pasarela de cobro
(«instala el plugin y cobra con tarjeta»), no como sincronización de inventario
con el punto de venta.

Mientras no se actualice, cualquier copy que genere el sistema va a seguir sin
saber que esto existe. Hay que:

1. Confirmar la redacción exacta de la función.
2. Agregarla a `config/marca.json` con su procedencia.
3. Volver a correr la generación de copys.
