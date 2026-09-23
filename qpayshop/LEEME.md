# Secciones para Qpayshop

Biblioteca de **36 secciones** de tienda en línea para dar variedad a las
plantillas de Qpayshop. El cliente elige las que quiere; IT las pega.

**Catálogo visual:** `catalogo-secciones.html` — abrir en el navegador. Cada
sección se ve funcionando, con interruptor Escritorio/Móvil y su código listo
para copiar.

## Qué hay

| # | Archivo | Tipo | Para qué |
|---|---|---|---|
| 01 | `secciones/01-hero-dividido.html` | Hero | Texto y producto lado a lado, con tres datos de confianza |
| 02 | `secciones/02-hero-inmersivo.html` | Hero | Imagen a sangre con capa oscura y texto centrado |
| 03 | `secciones/03-hero-editorial.html` | Hero | Titular serif grande y tira de tres piezas con precio |
| 04 | `secciones/04-rejilla-productos.html` | Productos | Rejilla de 4 columnas con descuento y botón de agregar |
| 05 | `secciones/05-productos-alternos.html` | Productos | Filas grandes que se voltean solas; pocos productos que se explican |
| 06 | `secciones/06-mosaico-categorias.html` | Productos | Cinco bloques de distinto tamaño hacia las categorías |
| 07 | `secciones/07-carrusel-productos.html` | Carrusel | Desplazamiento con dedo, rueda o flechas, con puntos |
| 08 | `secciones/08-carrusel-resenas.html` | Carrusel | Testimonios que rotan solos y se detienen al pasar el mouse |
| 09 | `secciones/09-barra-anuncio.html` | Banner | Barra superior con cuenta regresiva y botón de cerrar |
| 10 | `secciones/10-franja-confianza.html` | Banner | Envío, devolución, pago verificado, cuotas y medios de pago |
| 11 | `secciones/11-marquesina.html` | Banner | Cinta que corre sin parar. Solo CSS |
| 12 | `secciones/12-banner-promocion.html` | Banner | Una oferta con porcentaje grande y código de cupón |
| 13 | `secciones/13-hero-buscador.html` | Hero | Búsqueda de protagonista, con las categorías más pedidas |
| 14 | `secciones/14-hero-diapositivas.html` | Hero | Tres mensajes que rotan, cada uno con su color de fondo |
| 15 | `secciones/15-hero-tarjeta.html` | Hero | Formas planas de color y tarjeta blanca encima. Sin fotos |
| 16 | `secciones/16-lista-compacta.html` | Productos | Filas densas con existencia y precio. Mayoreo e insumos |
| 17 | `secciones/17-producto-destacado.html` | Productos | Un producto con galería, variantes y cantidad |
| 18 | `secciones/18-rejilla-revista.html` | Productos | Una pieza grande y cuatro chicas, texto sobre la foto |
| 19 | `secciones/19-productos-pestanas.html` | Productos | Más vendidos, recién llegados y en oferta en un solo espacio |
| 20 | `secciones/20-carrusel-historias.html` | Carrusel | Círculos que se deslizan. Ocupa poco alto |
| 21 | `secciones/21-carrusel-pantalla.html` | Carrusel | Una imagen por vez con flechas encima y contador |
| 22 | `secciones/22-carrusel-videos.html` | Carrusel | Tarjetas 9:16 con el producto colgado abajo |
| 23 | `secciones/23-banner-newsletter.html` | Banner | Suscripción, con el aviso de privacidad visible |
| 24 | `secciones/24-banner-progreso.html` | Banner | Cuánto falta para el envío sin costo, con barra |
| 25 | `secciones/25-banner-cita.html` | Banner | Horario y dos formas de contacto, para servicios |
| 26 | `secciones/26-hero-departamentos.html` | Hero | Menú de categorías a la izquierda y el hero a la derecha |
| 27 | `secciones/27-hero-mosaico.html` | Hero | El hero ES el mosaico: cuatro bloques con su botón |
| 28 | `secciones/28-categorias-listas.html` | Productos | Tarjetas con las subcategorías escritas |
| 29 | `secciones/29-tarjetas-horizontales.html` | Productos | Rejilla con la foto al lado del texto |
| 30 | `secciones/30-compra-el-set.html` | Productos | Set con casillas y total que se recalcula |
| 31 | `secciones/31-carrusel-logos.html` | Carrusel | Marcas en cinta continua. Solo CSS |
| 32 | `secciones/32-comparador.html` | Carrusel | Antes y después con divisor arrastrable |
| 33 | `secciones/33-banner-flash.html` | Banner | Foto y reloj en cajas grandes |
| 34 | `secciones/34-notas-blog.html` | Contenido | Tres notas con categoría, autor y fecha |
| 35 | `secciones/35-galeria-social.html` | Contenido | Fotos de la cuenta con el usuario encima |
| 36 | `secciones/36-testimonio-destacado.html` | Contenido | Una sola cita, grande, sobre foto |

## Cómo se instala

Copiar el contenido del archivo y pegarlo donde va la sección, dentro del
`<body>` de la plantilla. Nada más.

- **Sin dependencias.** No hay librerías, no hay build, no hay CDN.
- **Sin colisiones.** Todo el CSS va prefijado con `.qs-…`, así que no pisa los
  estilos de la tienda ni las secciones se pisan entre sí. Se pueden poner
  varias en la misma página, y la misma dos veces.
- **Sin JavaScript también funcionan.** Las cuatro que lo usan (07, 08, 09 y la
  cuenta regresiva) se degradan: el carrusel se sigue desplazando con el dedo
  porque el `scroll-snap` es CSS.
- **Responsivas.** Cada una tiene sus puntos de quiebre; a 390 px ninguna
  desborda horizontalmente.

## Cómo las personaliza el cliente

Cada sección abre con un bloque de variables CSS comentadas en español:

```css
.qs-hero-dividido{
  /* ═══ EDITA AQUÍ ═══════════════════════════════════════════ */
  --qs-fondo:        #F1EFE9;   /* fondo de toda la sección      */
  --qs-tinta:        #191713;   /* color del título              */
  --qs-acento:       #191713;   /* fondo del botón principal     */
  --qs-radio:        16px;      /* redondeo de botones e imagen  */
  --qs-aire:         72px;      /* espacio arriba y abajo        */
  /* ═════════════════════════════════════════════════════════ */
```

Cambiar esos valores reacomoda la sección entera. No hay que entrar a la
maquetación.

## Imágenes

Ninguna sección trae fotos: en su lugar van dibujos SVG, y cada uno lleva al
lado el comentario que dice con qué `<img>` reemplazarlo. Por ejemplo:

```html
<!-- Reemplazar el <svg> por: <img src="producto.jpg" alt="Nombre del producto"> -->
```

Se hizo así para que el archivo sea autosuficiente y no dependa de ningún
servidor de imágenes para verse.

## Tipografías

Solo la 03 carga una tipografía propia (una serif para el titular) con un `@import`
dentro de su propio bloque. Si la plantilla ya trae una serif, se borra esa
línea y se cambia `--qs-serif`. Las demás usan la tipografía de la tienda con
respaldo a la del sistema.

## Sobre el contenido de ejemplo

Los textos, precios, nombres y reseñas son **de ejemplo**, escritos para que se
vea la maquetación con contenido realista de los rubros que atiende Qpaypro
(ferretería, abarrotes, barbería, taller). **Ninguno es un dato medido de un
cliente real** y todos se reemplazan al instalar.

## Lo que el catálogo hace por IT

- **Buscador** por nombre, formato, archivo o variable.
- **Ficha técnica derivada del código**, no escrita a mano: líneas, si lleva
  JavaScript, si carga una tipografía externa, si tiene campos de formulario y
  cuántas variables expone. Si a una sección se le agrega un `<script>`, la
  ficha lo dice sola.
- **Tres anchos** de vista previa: escritorio, tableta (768 px) y móvil (390 px).
- **Selección múltiple.** El cliente elige sus secciones, y un solo botón copia
  el código de todas juntas —en el orden del catálogo, no en el que se fueron
  marcando— con un índice arriba que dice cuáles son y en qué orden pegarlas.
  La selección se recuerda en el navegador de quien mira.

## Sobre las referencias

Las maquetaciones se estudiaron a partir de plantillas comerciales para ver qué
formatos usan las tiendas (bento de colecciones, categorías con subcategorías
listadas, compra del set, comparador antes/después, notas del blog). **Nada de
ese código se copió:** cada sección está escrita desde cero con el sistema de
variables de esta biblioteca, así que no arrastra la licencia de nadie. Los
archivos de referencia no están en el repositorio.

## De dónde salen los archivos

`catalogo-secciones.html` es la fuente: cada sección vive en un `<template>`
dentro de él, y es la misma cadena que se muestra en la vista previa y la que
se copia. Los archivos de `secciones/` se extraen de ahí, así que no pueden
divergir del catálogo.
