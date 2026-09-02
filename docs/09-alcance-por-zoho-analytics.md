# El alcance SÍ existe · Zoho Analytics

**Fecha del hallazgo:** 2026-09-02
**Estado:** verificado ejecutando las consultas, no leído de documentación

---

## Lo que se creía, y por qué estaba mal

Durante cinco días el proyecto declaró este hueco:

> **El alcance orgánico no viene por NINGUNA de las dos fuentes.** Probado el
> 2026-08-31 contra `ads_get_ig_media` además de Zoho Social.

Era cierto **de esas dos fuentes**. Y era falso del sistema: existe una tercera,
**Zoho Analytics**, que estaba instalada, se habilitó el 2026-08-28 y quedó
anotada como «⚠️ sin probar». Nadie la probó hasta hoy.

Es la **tercera vez** que este proyecto comete el mismo error de método:

1. 2026-08-27 · cinco conectores de Zoho «no existen» — estaban apagados.
2. 2026-08-31 · el orgánico «no se puede partir por mercado» — faltaba conectar
   una página.
3. 2026-09-02 · el alcance «no existe» — faltaba abrir un conector habilitado.

Las tres veces, la conclusión venía de no haber agotado las formas de preguntar.
Y las tres veces bastó que alguien insistiera.

---

## La receta, para que no haya que redescubrirla

```
Organización        683128256          (getOrganizations)
Workspace           1909408000026698063   «Marketing»
                    "El espacio de trabajo de Facebook Ads Analytics..."
Vistas totales      412
```

**Trampa del conector:** `CONFIG` **no** va URL-encoded, contra lo que dice su
propia descripción. Con `%7B%22responseFormat%22...` devuelve
`8534 · Invalid JSON Format`; con `{"responseFormat":"csv"}` funciona. Se perdió
un intento en cada llamada hasta descubrirlo.

### Las tablas que importan

| Vista | id | Qué trae |
|---|---|---|
| Media Insights (Perfil de Instagram) | `1909408000026716986` | **Reach** por publicación |
| Reels Insights (Perfil de Instagram) | `1909408000026717058` | reels aparte |
| Story Insights (Perfil de Instagram) | `1909408000026716912` | historias |
| Profile Insights (Perfil de Instagram) | `1909408000026717020` | perfil |
| Post Insights (Páginas de Facebook) | `1909408000026703149` | **Impressions**, tipo, fecha, mensaje, shares |
| Insights by Paid/Unpaid (Páginas de Facebook) | `1909408000026703129` | corte orgánico vs pagado |
| General Insights (Páginas de Facebook) | `1909408000026701963` | página |
| Video Insights (Vídeo de YouTube) | `1909408000026718780` | video |

Y hay un reporte que se llama, literalmente, **«Organic Reach Trend (Páginas de
Facebook)»**.

---

## Lo que se verificó

### Facebook · `Post Insights` — 1000 filas, 2020-05-28 a 2026-08-31

Columnas reales: `Post Id`, `Post URL`, `Page Id`, `Created Time`, `Type`,
`Message`, `Reactions Like/Love/Wow/Haha/Sorry/Anger Total`, `Comments`,
`Shares`, `Impressions`, `Engaged Fan`, `Link`, `Total Reactions`.

Con eso, **la tasa de interacción se puede calcular por primera vez.** Sobre los
119 posts de 2026:

| Tipo | n | Impresiones prom. | Interacciones prom. | Tasa |
|---|---|---|---|---|
| video | 59 | 503 | 4.5 | **0.89%** |
| album | 17 | 420 | 4.5 | 1.06% |
| photo | 42 | 444 | 3.4 | 0.77% |
| link | 1 | 456 | 5.0 | 1.10% |

### Instagram · `Media Insights` — 85 filas

Columnas: `Profile ID`, `Media ID`, `Engagement`, **`Reach`**, `Saved`.
Alcance observado entre 32 y 4,754 por publicación.

---

## Cuatro trampas de este dato, y ninguna es opcional

1. **`Impressions` (Facebook) NO es `Reach` (Instagram).** Impresiones cuenta
   veces mostrado; alcance cuenta personas distintas. Son métricas diferentes con
   nombres parecidos. **No se suman entre redes y no se comparan de frente.**

2. **El histórico de impresiones no sirve antes de 2024.** Medido:

   | Año | posts | mediana de impresiones |
   |---|---|---|
   | 2020 | 164 | 0 |
   | 2021 | 175 | 0 |
   | 2022 | 127 | 0 |
   | 2023 | 121 | 1 |
   | 2024 | 155 | 11 |
   | 2025 | 139 | 279 |
   | 2026 | 119 | 402 |

   Un cero de 2021 no es «no lo vio nadie»: es que la métrica no está. Cualquier
   serie tiene que arrancar en **2025** o declarar el corte.

3. **La columna `Saved` de Instagram es sospechosa.** Sus valores son 2 a 5 veces
   el `Reach` en casi todas las filas, y guardar algo exige haberlo visto: nadie
   guarda 98 veces algo que alcanzó a 40 personas. Lo más probable es que sea
   **impresiones** con el rótulo equivocado. **No se usa hasta confirmarlo.**
   Un rótulo no es una verificación.

4. **Sigue habiendo una sola página.** `Page Id` es `1692583127699872` en las
   1000 filas: solo Qpaypro GT. La página de El Salvador
   (`829032443626700`) tampoco está conectada aquí, así que **el corte por
   mercado sigue abierto** — con el mismo remedio de siempre.

---

## Lo que esto desbloquea

- **Tasa de interacción real.** Se venía negando a calcularla por falta de
  denominador (ADR-016). Ya hay denominador.
- **Serie semanal de verdad.** El conector de Zoho Social topa en ~25
  publicaciones por red; esta tabla trae 1000. Muere la trampa de «antes de la
  muestra no hay ceros, hay hueco» (ADR-025) para Facebook.
- **`Shares`**, que Zoho Social no devolvía.
- **Reacciones por tipo**, incluidas `Sorry` y `Anger`: una señal de recepción
  negativa que hoy no se mide en ninguna parte.
- **Orgánico vs pagado** en la misma tabla, para no atribuirle al orgánico un
  alcance que compró la pauta.

## Lo que falta para meterlo a la corrida

No está integrado todavía, y no se integró de apuro a propósito: son cuatro
decisiones que hay que tomar bien, no rápido.

1. Resolver el rótulo de `Saved`.
2. Elegir el corte del histórico y declararlo.
3. Decidir cómo se reporta Facebook (impresiones) junto a Instagram (alcance)
   sin mezclarlos.
4. Cruzar `Media ID` de Instagram con la tabla `Media` para tener fecha y
   texto, que en `Media Insights` no vienen.
