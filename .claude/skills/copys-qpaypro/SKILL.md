---
name: copys-qpaypro
description: Redacta propuestas de copy para QPayPro a partir del análisis medido de la competencia y los referentes. Cada copy sale de un ángulo con evidencia, evita los territorios que ya tienen dueño y queda marcado para aprobación humana. Úsala cuando haya que escribir textos de anuncio o de publicación para la semana.
---

# Copys de QPayPro, escritos desde el dato

## Lo primero: qué hace esta skill y qué NO hace

**Hace:** convertir una recomendación medida en dos o tres opciones de copy, con
el ángulo declarado y la evidencia que lo sostiene pegada al texto.

**No hace:** inventar el tono de QPayPro, publicar nada, ni prometer nada que la
marca no pueda cumplir. Todo lo que salga de aquí es una **propuesta marcada
para aprobación humana** (regla 5 del proyecto). Nada se publica sin que una
persona lo apruebe, y eso no se elimina por conveniencia: es fintech.

## El tono: ya está, y sale del sitio

**Ya no se escribe en registro por defecto.** Mercadeo pegó el texto de
`www.qpaypro.com/gt` el 2026-09-02 y de ahí salieron el tono, los nombres
comerciales, los sectores y la letra chica. Todo vive en **`config/marca.json`**
y explicado en la skill `contexto-marca`. **Se lee ese archivo antes de escribir
una línea.**

Lo esencial, para no tener que abrirlo cada vez:

- **Tú, en imperativo.** Nunca voseo en voz de marca; el voseo es de los
  testimonios.
- **Tres verbos en secuencia** es la firma verbal: cobrar, operar y crecer.
- **Fricción primero, solución después.** Es el patrón de sus landings y el más
  reusable en un anuncio: nombrar el problema con las palabras del negocio
  («cerrar caja te toma media hora y casi nunca cuadra») y responder con un
  hecho.
- **Cero signos de exclamación. Cero superlativos.** No aparece uno solo en todo
  el sitio.
- **Los sectores se nombran como los nombra el sitio:** «Salones y barberías»,
  no «belleza y citas».

### Lo que sigue faltando, y qué se rotula

Falta lo de abajo. Un copy que lo necesite sale marcado en vez de inventarlo:

| Falta | Qué se rotula |
|---|---|
| Tres frases rechazadas con su motivo | nada se bloquea, pero el afinado fino no está |
| La página `/sv` | todo copy para SV sale `SIN LOCALIZAR · falta el lenguaje de El Salvador` |
| Restricciones de fintech por escrito | la lista de `REVISIÓN LEGAL` es un mínimo conservador |
| El nombre correcto: «Qpaypro» o «QPayPro» | se usa el del sitio y se marca |

## Lo que SÍ está medido y manda sobre cada copy

Sale de la corrida más reciente (`analisis/resultado.json → recomendaciones`).
**No se escribe de memoria: se lee el archivo.**

### Territorios que NO se pueden usar

Un territorio ocupado es un mensaje que un competidor ya carga con buena parte
de su inventario y lleva sosteniendo. Escribir ahí es pagar por pelear en su
terreno con su misma promesa.

Al 2026-08-31:

| No usar | De quién | Por qué |
|---|---|---|
| «Gestiona tu negocio fácil» y sus variantes | Paggo | 84% de sus 43 anuncios, 105 días vivo |
| «Recibe pagos con oro digital / USDT» | Recurrente | 58% de sus 12 anuncios, 38 días vivo |

**La regla no es evitar la palabra, es evitar la promesa.** «Gestioná tu negocio
sin complicarte» sigue siendo el territorio de Paggo aunque cambien las
palabras. Si el ángulo es gestión del negocio, hay que entrar por otro lado
—precio, velocidad de activación, soporte, un vertical concreto— o no entrar.

### Territorios libres, medidos

- **«belleza y citas»** — 11 anuncios de referentes, **0 de competidores
  locales**.
- **«restaurante»** — 5 anuncios de referentes, **0 de competidores locales**.
- **El Salvador entero** — 0 anuncios activos de las seis marcas medidas, y el
  costo por lead propio más bajo de la cuenta ($1.89 contra $2.89 en GT).

### Forma que sostiene el dato

- **Nichos, no «negocios».** Un titular que nombra el negocio de quien lo lee
  compite distinto que uno que dice «tu negocio».
- **Repartir.** Que ninguna promesa cargue más de ~1 de cada 6 piezas. Los
  referentes van en 16%; los competidores locales, en 62%.
- **Carrusel.** Los referentes lo usan 34% contra 19% de los locales.
- **Oferta con cifra.** Es lo único de la lista que se puede medir contra el
  resto en una semana.

## Cómo se escribe un copy aquí

### Paso 1 · Leer el dato, no la memoria

```
analisis/resultado.json → recomendaciones.recomendaciones   (los ángulos)
analisis/resultado.json → recomendaciones.dossier           (qué dice cada marca)
```

Si el archivo no existe o es de otra semana, **detenerse y decirlo.** La Ad
Library es una foto del día: un territorio que estaba libre hace tres semanas
puede tener dueño hoy.

### Paso 2 · Un ángulo por copy, declarado

Cada propuesta arranca nombrando su ángulo y de qué recomendación sale. Un copy
sin ángulo declarado no se entrega: si nadie puede decir por qué existe, tampoco
puede decir si funcionó.

### Paso 3 · Escribir dos o tres opciones, no una

Una sola opción obliga a aprobar o rechazar. Dos o tres dejan elegir, que es lo
que hace una mesa creativa.

### Paso 4 · Formato de entrega

Cada copy sale así, y **todos los campos son obligatorios**:

```
ÁNGULO      · de qué recomendación sale, con su número
RED         · Instagram / Facebook / YouTube  (X queda fuera, ADR-008)
FORMATO     · reel / carrusel / pieza única
MERCADO     · GT / SV  (y qué cambia entre los dos, si cambia)
ETAPA       · descubrimiento / consideración / conversión

TITULAR     · máx. 40 caracteres
CUERPO      · máx. 125 caracteres
CTA         · el botón

POR QUÉ     · el dato que lo sostiene, con su número
NO DICE     · qué se evitó a propósito y por qué
ESTADO      · PROPUESTA · requiere aprobación humana
```

### Paso 5 · Marcar lo que necesita revisión legal

Cualquier copy que toque uno de estos temas sale con `REVISIÓN LEGAL` encima:

- Cifras de comisión, tarifa, plazo o tiempo de acreditación.
- Comparaciones con un competidor nombrado o aludido.
- Promesas de aprobación, de disponibilidad de fondos o de rendimiento.
- Cualquier cifra sin fuente citada.

**Sin el punto 5 del contexto de marca —las restricciones de comunicación de
fintech— esta lista es un mínimo conservador, no la lista real.** Se declara así
en la entrega.

## Reglas duras

1. **Cero cifras inventadas.** Si un copy quiere decir «en 24 horas» o «sin
   comisión», el número tiene que venir de alguien de QPayPro. Si no lo hay, el
   copy se escribe sin la cifra o no se escribe.
2. **Cero superlativos sin sustento.** «El más rápido» es una comparación, y una
   comparación sin fuente es un problema legal, no un problema de estilo.
3. **Nada se publica desde aquí.** Esta skill produce texto. La publicación es
   del agente `orquestador`, en borrador y con aprobación pendiente.
4. **Si falta el tono, se rotula.** Nunca se entrega un copy dando a entender
   que suena como QPayPro cuando el tono no se ha verificado.
5. **El nombre de un producto no se inventa.** Si no está el nombre comercial,
   se escribe el genérico («el punto de venta», «el link de pago») y se marca.

## Lo que se sabe de QPayPro, y de dónde salió

| Dato | Valor | Procedencia |
|---|---|---|
| Qué es | fintech de pagos digitales | documento maestro |
| Mercados | Guatemala, El Salvador | documento maestro · verificado en la cuenta |
| Productos | POS físico y virtual, links de pago, QR, pasarela, APIs | documento maestro · **nombres comerciales sin confirmar** |
| Moneda de la cuenta | USD | verificado |
| Red excluida | X / Twitter | ADR-008 |
| Rendimiento propio | 370 leads, $2.60 por lead · GT $2.89, SV $1.89 | corrida 2026-08-01 a 2026-08-24 |
| Orgánico | los reels rinden 3.2× el feed | `ads_get_ig_media`, n=25 |

Ese último dato manda sobre el formato: **si hay que elegir uno, es reel.**

## Lo que esta skill no puede saber

- **Qué copy le funcionó a la competencia.** La Ad Library no publica
  rendimiento de anunciantes comerciales. Lo que se lee es dónde apuestan: qué
  repiten y qué no retiran.
- **Cómo suena QPayPro.** Ver arriba.
- **Qué se puede prometer legalmente.** Ver el punto 5 del contexto de marca.
