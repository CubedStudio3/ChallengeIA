# Alcance orgánico · Zoho Analytics

Obtenido el 2026-09-04 con `ZohoAnalytics_exportDataView`.

    org-id       683128256          (getOrganizations)
    workspace    1909408000026698063  «Marketing»
    vista        1909408000026716986  Media Insights (Perfil de Instagram)
    vista        1909408000026717058  Reels Insights (Perfil de Instagram)
    CONFIG       {"responseFormat":"csv"}   <- SIN url-encode

## Los archivos de aquí están FILTRADOS, y eso es a propósito

El export completo trae 85 filas de Media y 215 de Reels, de 2020 en adelante.
Aquí se guardan **solo las 25 publicaciones de la muestra de esta corrida** —las
que `ads_get_ig_media` devolvió— porque son las únicas que se pueden cruzar con
interacciones y con fecha. El export completo se reproduce con la receta de
arriba; no se guarda entero para no meter 300 filas sin fecha al repositorio.

## Columnas que NO se usan, y por qué

- **`Saved` de Media Insights.** Trae valores de 2 a 5 veces mayores que `Reach`
  (ejemplo real: Reach 601, Saved 31525). Guardar exige haber visto: es casi
  seguro impresiones mal rotulado. En la vista de Reels, en cambio, `Saved` sí
  se ve plausible (0 a 5). No se usa ninguna de las dos hasta confirmarlo.
- **`Total Interactions` de Reels Insights.** Para el reel 18098767388528504
  dice 2854 con un alcance de 2036 y 69 interacciones reales. No son
  interacciones; probablemente son reproducciones.
- **`Engagement` de Media Insights.** Cruzado contra `ads_get_ig_media`,
  coincide en 11 de 15 y en 4 casos es MAYOR (7 vs 4, 13 vs 9). Casi seguro
  incluye shares o saves. Para la tasa se usa un numerador consistente en las
  dos cohortes: likes + comentarios de `ads_get_ig_media`.

## El control cruzado que sí pasó

21 de 25 publicaciones coinciden exactamente en likes + comentarios entre
`ads_get_ig_media` y Zoho Analytics. Las 4 que no, difieren por 1 a 4
interacciones y son las de la vista de feed, donde `Engagement` es otra cosa.
Dos fuentes independientes midiendo lo mismo y llegando al mismo número es la
única razón por la que este alcance se puede usar.
