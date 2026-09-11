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

## Paleta: no hay colores nuevos

El tema de la página vive en variables CSS que ya cambian solas con claro/oscuro.
Están mapeadas al tema de Tailwind, así que `bg-sup`, `text-tinta2` o
`border-linea` siguen el modo **sin necesidad de una sola variante `dark:`**.
Los nombres son los de la página: `plano sup sup2 linea linea2 tinta tinta2
tinta3 mercadeo ventas producto abierto cuarto e1…e5 alerta alerta-fondo`.

La variante `dark:` existe igual, para lo que no es color. **Ojo con cómo se
define:** `darkMode: ["variant", [...]]` con una at-rule en la lista descarta el
`@media` y deja `:where(:root:not([data-theme=light]) *)` suelto, que es
verdadero en modo **claro** — `dark:bg-sup` se aplicaba siempre. Se arma con
`addVariant`, que sí respeta la at-rule. Medido en los dos modos.

## Qué se midió (2026-09-11)

| Comprobación | Resultado |
|---|---|
| Pintura antes/después a 1440, 834 y 390 px | **0 píxeles distintos** en los tres |
| Errores de consola nuevos | ninguno |
| Utilidades con variables del tema | `bg-mercadeo` → `rgb(42,120,214)` |
| Cascada sobre regla propia | `p-12` sobre `.kpi` → `48px` |
| `dark:` en claro / en oscuro | no se filtra / sí aplica |
| Globales de las librerías | `lucide` `gsap` `Chart` `Alpine` presentes |

## Peso

| | crudo | gzip |
|---|---|---|
| página sola | 133 KB | — |
| + Tailwind | 427 KB | 61 KB |
| + las 4 librerías | 1,090 KB | 253 KB |

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
