# Guía de diseño del tablero

**Para el equipo de diseño.** Explica qué se puede cambiar, cómo, y qué no
conviene tocar.

---

## Lo primero: qué puede y qué no puede hacer cada quien

| Quiero… | ¿Se puede? | Cómo |
|---|---|---|
| Aprobar tareas desde el tablero | ✅ Sí | Con el enlace compartido con permiso de edición |
| Ver el tablero | ✅ Sí | Con el enlace, aunque sea de solo lectura |
| Cambiar colores, fuentes, radios | ✅ Sí | Editando `config/tema.json` en el repositorio |
| Reordenar secciones o agregar bloques | ✅ Sí | Editando `src/modulo1/tablero_app.js` |
| Rediseñarlo desde la interfaz de Claude, sin repositorio | ❌ No | Un artefacto compartido se puede leer, no actualizar. Solo su dueño lo republica |

**En resumen:** el uso se comparte por enlace; el diseño se cambia en el
repositorio. Eso último no es una traba, es lo correcto: queda versionado,
revisable, y un cambio de diseño no puede romper los datos.

---

## Cambiar colores, fuentes y formas · sin tocar código

Todo el diseño visual vive en **un solo archivo**:

```
config/tema.json
```

Ahí están los colores de modo claro, los de modo oscuro, las fuentes, los
radios de esquina y el ancho del panel lateral. No hay colores escritos en
ningún otro lugar: el CSS se genera desde ese archivo.

### El flujo, tres comandos

```bash
# 1. Editar config/tema.json

# 2. Comprobar que lo que elegiste se puede leer
node src/modulo1/valida_tema.js

# 3. Regenerar el tablero
node src/modulo1/tablero.js \
  data/historico/<corrida>/analisis/resultado.json \
  salidas/tablero-mesa-creativa.html
```

Luego se abre el HTML en el navegador para verlo.

### El validador es tu amigo, no un obstáculo

`valida_tema.js` **no opina de estética**. Mide si alguien puede leer lo que
diseñaste, y cuando algo falla dice exactamente qué par de colores y qué valor
hace falta:

```
FALLA  falta_texto sobre falta_suave      4.33:1  (mínimo 4.5)
       #9E6708 sobre #FCF3E2 — necesita 4.5:1
```

Qué comprueba:

| Chequeo | Por qué importa |
|---|---|
| Contraste WCAG de cada par texto/fondo | Si no pasa, hay gente que literalmente no lee ese texto |
| Banda de luminosidad de las series | Fuera de banda, unas barras pesan mucho más que otras sin querer |
| Piso de croma | Por debajo, un color "de marca" simplemente lee gris |
| Distancia entre series en visión normal | Dos series parecidas se confunden aunque veas bien |
| Separación bajo protanopia y deuteranopia | Cerca de 1 de cada 12 hombres tiene alguna deficiencia al color |

**Lo que NO comprueba, dicho con precisión:** tritanopia. El método disponible
en el repositorio no es fiable para ese caso y preferimos no dar un número que
no podemos verificar. La protanopia y la deuteranopia cubren la enorme mayoría
de los casos; la tritanopia es muy poco frecuente.

### Dos fallas que el validador ya atrapó

No es teórico. Al construirlo encontró dos problemas reales en el diseño que
ya estaba publicado:

1. El ámbar de «Falta un dato» quedaba a 4.33:1 sobre su fondo, cuando el
   mínimo es 4.5. Se oscureció.
2. El badge violeta del panel lateral llevaba texto blanco a 3.01:1 en modo
   oscuro. La causa era de fondo: **`marca` tenía dos trabajos que se pelean** —
   ser acento de texto (donde en oscuro conviene un violeta claro) y ser fondo
   de un botón con texto blanco (donde hace falta uno oscuro). Se separó en
   `marca` y `marca_fondo`.

Ese segundo caso es la clase de error que se ve como un detalle y en realidad
es un token mal diseñado. Si al cambiar algo el validador se queja de un token
que parece correcto, vale preguntarse si ese token está haciendo dos cosas.

---

## Los bloques de `config/tema.json`, uno por uno

| Bloque | Qué controla |
|---|---|
| `tipografia` | Familias (solo Google Fonts: es el único host que el visor permite), pilas de respaldo y pesos a cargar |
| `forma` | Radios de esquina y ancho del panel lateral |
| `colores_claro` / `colores_oscuro` | La paleta completa de cada modo. **El oscuro no es un invertido automático**: son pasos elegidos y validados aparte |
| `paleta_graficos` | Los colores de las series, en orden. Nunca en ciclo |
| `acentos_suaves` | Los tres tintes decorativos de las tarjetas del resumen. Cada valor es `[claro, oscuro]` |

### Tres tokens que existen porque hacen trabajos distintos

Es la parte que más fácil se rompe si se simplifica:

- **`marca`** es acento de *texto* y de series de gráfico.
- **`marca_fondo`** es un *fondo* que lleva texto blanco encima (botón, badge).
  Un violeta claro sirve de acento y NO sirve de fondo con texto blanco. Estaban
  juntos y por eso el badge del lateral quedó a 3.01:1.
- **`panel_oscuro`** es el negro del botón principal y del aviso flotante. Antes
  se reusaba el color del panel lateral; cuando el lateral pasó a blanco, el
  aviso quedó **blanco sobre blanco**. Tiene su propio token para que eso no
  pueda volver a pasar.

### Los acentos suaves son adorno, no semántica

`acentos_suaves` da tres tintes — verde, crema y lavanda — para las tres
tarjetas del resumen. **No significan bien, atención ni mal.** Para eso están
`bien_suave`, `falta_suave` y `alerta_suave`, y ésos **no** se deben usar de
adorno: quien lee la página interpreta el rosa como una alerta, y una alerta
falsa es peor que una tarjeta sin color.

El validador comprueba dos cosas de cada tinte: que el texto se lea encima
(4.5:1) y que el tinte se distinga de la superficie blanca. Un tinte que no se
distingue no adorna nada y sobra.

---

## El CSS: Tailwind compilado, no un CDN

El tablero usa **Tailwind CSS**, como lo pidió Mercadeo. Pero **no** carga el
script de `cdn.tailwindcss.com`. La razón es práctica: el tablero se abre en una
reunión, y si ese script no baja — red del cliente, bloqueo corporativo, el CDN
caído — la página no sale «un poco distinta», sale **sin una sola línea de
CSS**.

Así que se compila:

```bash
npm install                       # una vez
node src/modulo1/tablero.js <resultado.json> <salida.html>
```

`tablero.js` corre el compilador de Tailwind sobre `tablero_app.js` y mete el
CSS resultante dentro del archivo. Son ~24 KB. **Si Tailwind no está instalado,
el generador falla con un mensaje claro** en vez de escribir un tablero sin
estilos.

### Dos archivos, dos trabajos

| Archivo | Qué es |
|---|---|
| `config/tema.json` | Colores, tipografía y radios. **Esto es lo que edita diseño** |
| `src/modulo1/tablero_tailwind.css` | Las clases propias (`.btn-oscuro`, `.etiqueta-verde`, `.campo`…) y la capa base |
| `tailwind.config.js` | Qué archivos escanea Tailwind para saber qué utilidades generar |

### Una trampa al editar `tablero_app.js`

Tailwind encuentra las clases leyendo el archivo como texto. El tablero se pinta
con `innerHTML`, así que las clases viven dentro de literales de cadena partidos
en varias líneas. **Al partir una cadena hay que cortar siempre en un espacio.**
Partir `'rounded-' + '2xl'` deja esa clase sin generar, y el fallo es
silencioso: no hay error, solo una esquina que dejó de ser redonda.

---

## El principio visual: la separación la hace el aire

No hay bordes sólidos oscuros en ninguna parte. Los bloques se distinguen
porque son tarjetas blancas sobre un fondo gris muy claro (`#F3F6F8`), con
esquinas de 24 px y una sombra amplia y difusa
(`0 4px 20px rgba(0,0,0,.05)`) — nada más.

Quedan solo dos clases de línea, y las dos se pueden justificar:

1. Los *hairlines* que separan filas de una lista (`divide-slate-50`).
2. El anillo interior que marca una tarjeta elegida o aceptada — ahí el color
   **es** información, y va acompañado de una etiqueta con el texto del estado,
   nunca solo del color.

Si van a agregar una línea, la pregunta es cuál de esos dos casos es.

---

## Un solo tema, claro

El tablero se pinta **solo en modo claro**, por petición de Mercadeo
(2026-08-28). Eso no es descuido: `tema.js` recibe `{ soloClaro: true }`, emite
únicamente el bloque de modo claro y fija `color-scheme: light`, y el `<body>`
pinta su fondo explícitamente. Sin esas tres cosas, quien abra la página con el
sistema en oscuro vería los `<select>` negros sobre tarjetas blancas.

`colores_oscuro` se conserva en `tema.json`: si algún día se quiere el modo
oscuro de vuelta, es quitar esa opción en `tablero.js`.

---

## Cambiar la estructura · reordenar, agregar, quitar

Vive en `src/modulo1/tablero_app.js`. Cada bloque es una función que devuelve
HTML:

| Función | Qué dibuja |
|---|---|
| `rail()` | La barra de iconos: columna a la izquierda en escritorio, barra abajo en móvil |
| `encabezado()` | El saludo, el buscador y los dos botones de copiar |
| `resumen()` | Sección 1: los cuatro KPI y las tres tarjetas de síntesis |
| `rendimiento()` | Sección 2: pauta por mercado, campañas y las dos gráficas semanales |
| `competencia()` | Sección 3: las marcas medidas, con el interruptor competencia/referentes |
| `referencias()` | Sección 4: el contraste y dónde buscar referencia visual |
| `estrategia()` | Sección 5: elegir la apuesta, decidir las tareas, agregar ideas |
| `pie()` | La trazabilidad y los huecos declarados de la corrida |

Piezas que reutilizan todas:

| Función | Qué dibuja |
|---|---|
| `kpi()` | Tarjeta de cifra grande, con indicador de variación **solo si existe periodo anterior** |
| `cardCab()` | Encabezado de tarjeta con el «Ver todo» arriba a la derecha |
| `recorta()` | Corta una lista a 3 o 4 elementos según el estado de «Ver todo» |
| `fila()` | Fila de lista: avatar circular, nombre, descripción, valor a la derecha |
| `grafico()` | Área con curva suave, degradado que se desvanece y sin cuadrícula interna |
| `seccion()` | El marco de una sección: rótulo, título, bajada y control |
| `pastillas()` | El interruptor de píldoras (mercado, grupo, categoría) |
| `plegado()` | El bloque «lo que esto no puede decir» |

El orden se arma en `pintar()`. Mover una sección es mover una llamada.

### Si agregas una sección nueva

Súmala a la lista `SECCIONES` para que aparezca en la navegación y el
resaltado por scroll funcione.

---

## Lo que conviene NO tocar, y por qué

No es capricho: cada una de estas cosas está sosteniendo algo.

| No cambiar | Por qué |
|---|---|
| Que la página se renderice en `#raiz` | Si vuelve a `document.body.innerHTML`, **borra su propia hoja de estilos** cuando se publica como fragmento. Ya pasó |
| Que el archivo generado NO lleve `<!doctype>`, `<html>`, `<head>` ni `<body>` | El visor lo envuelve. Un documento completo deja el `<style>` dentro del body, donde se descarta. Ya pasó |
| Que `documento()` SÍ devuelva un documento completo | Es lo que exige la auto-publicación. Es un contrato distinto al del archivo |
| Las etiquetas directas y la separación de 2px entre segmentos de la barra apilada | Son el encoding secundario que hace legible la paleta para alguien con daltonismo. Quitarlas invalida la validación |
| El bloque «Por qué» de cada tarea | Es la trazabilidad del número. Sin él, el tablero pide confianza en lugar de ofrecer verificación |
| El aviso de «lo que esta corrida NO incluye» | Es una regla del proyecto, no un adorno: si falta un dato se declara |
| Que el indicador de variación (`+8.2%`) salga **solo** cuando hay periodo anterior | La especificación de diseño lo pedía en todos los KPI. En pauta no existe corrida previa: ese porcentaje sería inventado, y alguien tomaría una decisión con él |
| Que la curva use interpolación monótona y no un spline cualquiera | Un spline suave se dispara por encima de un pico y dibuja un máximo que el dato no tiene. Fritsch-Carlson es suave **y** no sobrepasa |
| Que las listas se recorten a 3 o 4 con «Ver todo» | Es lo que descongestiona la página. Volver a listar todo de golpe deshace el rediseño completo |

---

## Cómo probar sin romper nada

El generador trabaja **solo sobre archivos**. No toca ninguna API, así que se
puede correr mil veces sin consecuencias. Para probar:

```bash
node src/modulo1/tablero.js \
  data/historico/2026-08-27_V0_convencion_fechas/analisis/resultado.json \
  /tmp/prueba.html
```

Y abrir `/tmp/prueba.html`. Esa corrida tiene datos reales guardados, así que
lo que ves es lo que verá el equipo.

### Y la prueba en navegador, que no es opcional

```bash
node .prueba-tablero.js
```

Abre el tablero en Chromium a 1440, 834 y 390 px, comprueba que no haya
desborde horizontal ni errores de JavaScript, hace clic en todos los
interruptores y en el formulario, y deja capturas en `/tmp/capturas`.

Los dos fallos de maquetación más caros de este proyecto los encontró esa
prueba, no la vista: una tarjeta sola estirada a todo el ancho, y un
`minmax(400px, 1fr)` que desbordaba en móvil porque 400 px es un **piso**, no
una sugerencia. A ojo, en una pantalla de escritorio, los dos se veían bien.

Para publicar el cambio al enlace que ya usa el equipo, hay que republicar el
artefacto sobre la misma URL. Eso lo hace quien es dueño del artefacto.

---

## Si prefieren diseñar visualmente en lugar de en JSON

Se puede: se arma un lienzo de diseño donde ustedes mueven los bloques,
cambian tipografías y colores a mano, y guardan. Después ese resultado se
traduce al generador. Es más cómodo para explorar, pero el que manda al final
sigue siendo `config/tema.json` — porque es el que la corrida del lunes lee.

Pídanlo y se arma.
