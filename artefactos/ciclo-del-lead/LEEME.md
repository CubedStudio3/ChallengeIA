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

## Paleta

Cuatro colores del equipo: `#d0e4bb` salvia · `#f3d7e9` rosa · `#a1caed`
cielo · `#0a0d0b` tinta.

**Los tres pasteles son SUPERFICIE, nunca marca.** Medidos contra blanco dan
**1.36:1**, **1.34:1** y **1.72:1** — una línea o un punto de ese color es
invisible. Con tinta encima dan **14.4:1**, **14.6:1** y **11.3:1**, que es
donde sirven: cuadros de icono, chips, lavados, el botón Reiniciar, los
números de las recomendaciones. Es exactamente ADR-034: *había que cambiar el
tono, no la paleta.*

**Las marcas de dato son pasos medios de los mismos tonos**, validados con el
validador de paleta de la guía de dataviz, 5/5 en modo claro:

| token | valor | rol | tinta encima |
|---|---|---|---|
| `--mercadeo` | `#4189c6` | Redes sociales · Mercadeo | 5.22:1 |
| `--producto` | `#6c9a40` | Página web · Producto | 5.89:1 |
| `--ventas` | `#cf5c96` | Directo / Referidos · Ventas | 5.23:1 |
| `--cuarto` | `#7a6cda` | WhatsApp / Chat | 4.64:1 |
| `--abierto` | `#8a938d` | sin identidad (Sin fuente / Abierto) | — |

Separación para daltonismo: peor par ΔE 10.4 (deután) y 19.5 en visión normal.
El par azul↔violeta queda en 6.5 para tritanopía —la tritanopía colapsa
azul y violeta por naturaleza—, que es legal solo con codificación
secundaria: la página tiene leyenda con nombre, etiquetas directas y tabla,
así que la identidad nunca depende del color solo.

El embudo (`--e1`…`--e5`) es **secuencial**: un solo tono, claro a oscuro. No
es categórico y por eso no se le aplican las reglas de arriba.

`--alerta` es **estado reservado** y nunca se usa como serie.

## Qué se midió (`npm run prueba`)

La prueba **ya no compara píxel a píxel** contra la versión anterior: el
diseño cambió a propósito, así que ese esperado caducó. Ahora comprueba lo que
puede romperse en silencio:

| Comprobación | Resultado |
|---|---|
| Carga sin errores de consola a 1440, 834 y 390 px | sin errores |
| Scroll horizontal del cuerpo | 0 px en los tres anchos |
| Se pinta igual con el visor en oscuro que en claro | idéntico |
| El fondo es el token explícito, no heredado | `rgb(236,238,232)` |
| Riel con sus 9 secciones, una marcada en reposo | 9 · 1 |
| Los 5 KPI traen su icono | 5/5 |
| Texto sobre el relleno de cada tramo apilado | 5.22 – 6.17:1 |
| Tailwind operativo, sin variante `dark:` | sí · sin ella |

Google Fonts sale bloqueado en las capturas locales: es la política de egreso
de **este entorno**, no de la página —en el visor sí carga—. La prueba lo
separa y lo reporta en vez de darlo por fallo, pero no lo calla.

## Peso## Peso

| | crudo | gzip |
|---|---|---|
| página sola | 145 KB | — |
| + Tailwind | 390 KB | 57 KB |
| + las 4 librerías | 1,053 KB | 249 KB |

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
