# Artefacto «Ciclo del Lead» · build de diseño

Build del artefacto **compartido** (no es nuestro, tenemos permiso de escritura):
`https://claude.ai/code/artifact/faa310d8-b3fa-40ff-a1b1-674bd0fee9e4`

Lo ve toda la organización y **los cambios se publican en vivo**: quien tenga la
página abierta ve la versión nueva. No hay borrador.

## Por qué Tailwind va COMPILADO y no por CDN

Dos razones, las dos medidas:

1. La misma que ya está escrita en `tailwind.config.js` del tablero: el visor
   permite `cdn.tailwindcss.com`, pero si ese script no carga —red del cliente,
   bloqueo corporativo, el CDN caído— la página no sale «un poco distinta»,
   sale **sin una sola línea de CSS**. Y esta página se abre en reuniones.
2. En este entorno los CDN están **bloqueados por política de egreso**, medido
   el 2026-09-11: `connect_rejected · gateway answered 403 · cdn.tailwindcss.com:443`
   y lo mismo para `cdnjs.cloudflare.com`. Es política, no límite — se puede
   cambiar. Mientras no cambie, usar el CDN sería además **no verificable desde
   aquí**: no se puede probar lo que se publica.

Por eso el CSS y las librerías van **incrustados en el archivo**. La página no
depende de la red para verse.

## Cómo se edita

```sh
cd artefactos/ciclo-del-lead
npm install
# editar fuente.html
npm run construye     # compila Tailwind + ensambla ../../<salida>
npm run prueba        # compara antes/después píxel a píxel y valida Tailwind
```

`construye.js` escribe `ciclo-del-lead.html` (ignorado por git: es generado).
Ese archivo es el que se publica al artefacto **pasando su URL**, nunca sin
ella —publicar sin `url` crearía un artefacto nuevo en vez de actualizar este—.

**`fuente.html` es la fuente de verdad.** No editar el archivo generado: el
siguiente build lo pisa.

## Las tres cosas que hay que respetar

- **Preflight apagado.** La página ya trae su CSS completo; el reset de Tailwind
  le quitaría tamaños a los títulos y bordes a las tablas. Está desactivado en
  `corePlugins`. Verificado: las cinco firmas del reset no aparecen en la salida.
- **Al partir una cadena de clases en el JS, cortar SIEMPRE en un espacio.** La
  página se pinta con `innerHTML` y las clases viven en literales. El extractor
  lee texto plano: partir `'rounded-' + '2xl'` deja esa clase sin generar y **no
  da ningún error**. Misma trampa ya documentada en `CLAUDE.md`.
- **El `<style>` de Tailwind va DESPUÉS del propio de la página**, a propósito:
  a igual especificidad gana la regla posterior, así una utilidad corrige una
  regla de componente sin recurrir a `!`. Probado: `p-12` sobre `.kpi` pasa de
  `14px 15px 15px` a `48px`.

## Solo modo claro (2026-09-11)

Por decisión de Mercadeo. No hay bloque `@media (prefers-color-scheme:dark)`,
no hay `[data-theme]`, y Tailwind ya no genera la variante `dark:` (eso solo
quitó 123 KB de reglas muertas).

Que la página se comprometa con un solo mundo visual **obliga** a pintar todo
explícito: el visor compone el artefacto sobre un fondo que pinta él, en el
tema del lector. Un `body` sin `background` heredaría el fondo oscuro del
visor y dejaría texto oscuro sobre oscuro. Por eso `body` fija su fondo desde
el token y `:root` declara `color-scheme: light`. La prueba lo vigila: carga
la página con el visor en oscuro y compara contra claro; si algún día se cuela
una regla de modo oscuro, se pone roja.

## Paleta: pastel en todo (2026-09-11)

Decisión de Mercadeo: **los mismos pasteles en todo**, nada saturado aunque el
tono sea parecido.

| token | valor | rol |
|---|---|---|
| `--cielo` | `#a1caed` | Redes sociales · Mercadeo |
| `--salvia` | `#d0e4bb` | Página web · Producto · el desenlace del embudo |
| `--rosa` | `#f3d7e9` | Directo / Referidos · Ventas |
| `--lila` | `#cdc4ef` | WhatsApp / Chat |
| `--piedra` | `#dfe1da` | sin identidad (Sin fuente / Abierto) |
| `--tinta` | `#0a0d0b` | texto, riel, tarjeta del veredicto |

**Lo que esto obliga, medido.** Como marcas categóricas, estos pasteles fallan
4 de 5 comprobaciones del validador: quedan fuera de la banda de luminosidad,
bajo el piso de croma, y —lo que de verdad importa— su peor par, **rosa contra
verde, da ΔE 9,5 en visión normal**, debajo del piso de 15. Contra el blanco
dan 1,3–1,7:1.

Traducido: **el color no puede ser quien identifica una serie.** Eso no impide
usarlos; obliga a mover la identidad a otro lado, y en esta hoja son dos cosas,
las dos obligatorias:

1. **Contorno de tinta** (`--contorno`, 30%) en toda marca pastel: leyendas,
   chips, barritas, tramos apilados, rectángulos y rutas de las gráficas. Es lo
   que separa un relleno de 1,3:1 del fondo blanco.
2. **El nombre escrito dentro o al lado**, nunca solo el color. Los tramos
   apilados dicen «Mercadeo 36%», no «36%». La prueba se pone roja si un tramo
   pierde su nombre.

Con eso el color acompaña y el texto identifica, que es al revés de como estaba.
Si alguna vez hay que volver a tonos con contraste propio, la vía es bajar el
tono sin cambiar el matiz (ADR-034), no cambiar la paleta.

## Aire

Las tarjetas **no llevan borde**: se separan por espacio y una sombra muy suave
sobre un lienzo apenas teñido (`--lienzo`), y las tarjetas van en blanco puro.
Una línea alrededor de cada bloque es ruido cuando ya hay aire. Las secciones
respiran a 66 px, las tarjetas tienen 22–28 px de relleno y el panel 44 px de
margen lateral.

## El riel

Es el índice del informe: cada icono es una sección y cada una tiene su propio
tono pastel al estar activa.

**El fallo que se corrigió.** La primera versión usaba `IntersectionObserver` y
tomaba la **primera** sección que tocara la banda de observación; con el margen
inferior de `-55%`, la sección anterior —que es alta— seguía tocándola, así que
al elegir una opción se marcaba otra. Ahora la regla es determinista: **la
última sección cuyo borde superior ya pasó la línea de lectura**, con dos casos
que antes no existían —el final del documento, donde las últimas secciones ya no
pueden alcanzar la línea, y el clic, que manda y fija su sección—. El bloqueo
del clic dura 700 ms y **recalcula al vencer**: sin eso, si nadie volvía a
desplazarse, el marcador se quedaba donde lo dejó el clic.

La prueba hace los nueve clics de verdad y comprueba que cada uno marca el suyo.

## El embudo

Tiene forma de embudo, como el widget del CRM, pero sin sus dos fallos: ahí las
etiquetas salen truncadas al final de una línea guía («Calificado Intere..») y
los tramos delgados no se pueden leer.

Aquí la forma lleva **solo** la geometría —una silueta continua, sin huecos
entre bandas— y el nombre, la cifra y la caída viven en columnas alineadas a
tamaño de texto real. La caída se cuelga del escalón donde **aterriza**, no en
el hueco de en medio, que es lo que permite pegar las bandas. En pantalla
angosta la fila se parte en bloque y el texto no encoge.

## Qué se midió (`npm run prueba`)

| Comprobación | Resultado |
|---|---|
| Carga sin errores de consola a 1440, 834 y 390 px | sin errores |
| Scroll horizontal del cuerpo | 0 px en los tres anchos |
| Se pinta igual con el visor en oscuro que en claro | idéntico |
| Los nueve clics del riel marcan su propia sección | 9/9 |
| El riel cambia de color entre opciones | 5 tonos |
| Arriba marca la primera; al final, la última | sí |
| Las cinco marcas de dato son los pasteles exactos | 5/5 |
| Toda marca pastel lleva contorno de tinta | 4/4 familias |
| Los tramos apilados dicen su nombre | Mercadeo, Ventas, Producto, Abierto |
| Texto sobre el relleno de cada tramo | 11,3 – 14,8:1 |
| El embudo se angosta escalón a escalón | 590 → 539 → 112 → 104 → 83 |
| Tailwind operativo, sin variante `dark:` | sí · sin ella |

Google Fonts sale bloqueado en las capturas locales: es la política de egreso de
**este entorno**, no de la página —en el visor sí carga—. La prueba lo separa y
lo reporta en vez de darlo por fallo, pero no lo calla.

## Peso## Peso## Peso

| | crudo | gzip |
|---|---|---|
| página sola | 149 KB | — |
| + Tailwind | 390 KB | 57 KB |
| + las 4 librerías | 1,057 KB | 250 KB |

Las librerías incrustadas son lucide 0.454.0 (iconos), gsap 3.12.5 (animación),
chart.js 4.4.4 (gráficas) y alpinejs 3.14.1 (interactividad). **Hoy no las usa
nada**: están para diseñar. Quitarlas es cambiar `--libs` en el script
`construye` y reconstruir.

## Lo que esto NO hace

Instalar Tailwind **no** da un editor visual. La página se sigue editando desde
una sesión de Claude con permiso de escritura sobre el artefacto, no a mano en
el visor.

Y quien edite el artefacto desde **otra** sesión sin este build puede escribir
clases de Tailwind y que funcionen —el safelist cubre el juego de uso común—,
pero cualquier clase fuera de ese juego necesita recompilar aquí.
