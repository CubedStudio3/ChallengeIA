# Pinterest · qué se puede, qué no, y qué falta desbloquear

**Fecha:** 2026-09-02
**Estado:** bloqueado por la política de egreso del entorno. Nada medido del
token todavía.

Mercadeo aportó un token de la API de Pinterest (`pina_…`) y preguntó si con eso
se pueden **seleccionar pines para cada tarea y curarlos según lo que sea
mejor**. Este documento separa las tres cosas distintas que hay que resolver,
porque tienen arreglos distintos y se confunden entre sí.

---

## 1 · Bloqueo de red · lo arregla el usuario

Los cuatro dominios de Pinterest devuelven **403 en el CONNECT**. Es la política
de egreso elegida al crear el entorno, **no un límite técnico** — el mismo caso
que `qpaypro.com` (ADR de la Sesión 4).

| Dominio | Estado | Para qué se necesita |
|---|---|---|
| `api.pinterest.com` | 🔒 403 | **Imprescindible.** Es la API. |
| `pin.it` | 🔒 403 | Resolver los links cortos que el equipo ya pega. Sin esto un `pin.it/xxxx` no se puede convertir en id de pin, y por lo tanto no se puede consultar. |
| `www.pinterest.com` | 🔒 403 | Destino de los links cortos, y las imágenes de vista previa. |
| `developers.pinterest.com` | 🔒 403 | Los docs. Sin esto, lo de la sección 2 **no se pudo verificar**. |

Verificado con `curl -sS "$HTTPS_PROXY/__agentproxy/status"`, que registra
`connect_rejected · gateway answered 403 · api.pinterest.com:443`.

**Advertencia:** la política se aplica al **crear** el entorno. Habilitar los
dominios puede no afectar a un contenedor ya corriendo — puede hacer falta una
sesión nueva. La sonda lo dice explícitamente si sigue cerrado.

## 2 · Lo que la API deja hacer · NO verificado

⚠️ **Esta sección es de conocimiento previo, no de medición.** Los docs están
bloqueados y el token no se pudo probar. Es exactamente el tipo de afirmación
que en este proyecto ya salió mal tres veces, así que se marca como pendiente de
confirmar y **la sonda existe para confirmarla o tumbarla**.

Lo que se espera de la API v5 con un token normal:

| Se espera que sí | Se espera que no |
|---|---|
| Leer los tableros **propios** de la cuenta | Buscar el **catálogo público** de Pinterest — está detrás de acceso de *partner*, que Pinterest aprueba caso por caso |
| Leer los pines **propios** | Analíticas de un pin **ajeno** |
| Buscar dentro de lo propio | |
| Analíticas de los pines **propios** | |

## 3 · «Curar según lo que sea mejor» · el problema de fondo

Este no lo arregla ningún permiso. **Pinterest no publica analíticas de pines
ajenos**: de un pin que no es de la cuenta no hay saves, ni impresiones, ni
clics. Así que «el mejor pin» del catálogo **no tiene denominador**.

Elegir por cómo se ve la imagen sería un número inventado con cara de criterio.
Regla 1.

### La vuelta que sí es defendible

**«Mejor» no lo define la popularidad en Pinterest — que además no dice nada de
GT ni de SV — lo define la evidencia que ya está medida en este proyecto:**

- el **carrusel** es el mejor formato en las dos redes (FB 0.82%, IG 5.65%)
- los referentes lo usan el **doble** que los competidores locales (34% vs 19%)
- los **cinco territorios** que ninguna marca medida ocupa
- las **verticales libres** en competencia que QPayPro ya atiende

Un pin se puntúa por **a qué recomendación medida sirve**, no por cuántos saves
tiene. Y ese puntaje es auditable, que es el punto.

---

## Por qué vale la pena · ya hay demanda real

No es una idea de laboratorio: **el equipo ya usa Pinterest.** La idea propia
que subió el equipo al tablero trae `pin.it/…` en su campo de referencias. Hoy
eso se pinta como una URL truncada y sin vista previa.

Y el bloque «Dónde buscar referencia visual» de la sección de Referencias dice
literalmente *«búsquedas, no referencias curadas: ningún pin fue verificado»* —
un hueco declarado que esto cerraría, al menos a medias.

## Qué hacer, en orden

1. **Habilitar los cuatro dominios** de la tabla de arriba en el entorno. Si el
   tiempo aprieta, `api.pinterest.com` y `pin.it` son los que mandan.
2. **Correr la sonda.** Es lo único que hay que hacer para saber en qué queda
   la sección 2:

   ```bash
   export PINTEREST_TOKEN='pina_...'
   python3 src/modulo1/pinterest_sonda.py --json salidas/pinterest_sonda.json
   ```

   Separa los tres fracasos —red bloqueada, token rechazado, permiso
   faltante— que si no se ven todos igual. El token **no** se imprime ni se
   guarda; se lee del entorno y no por argumento, porque los argumentos quedan
   en el historial del shell y en la lista de procesos.
3. **Según el veredicto**, construir la curaduría contra los tableros propios
   (el caso probable) o también contra el catálogo (si respondiera).

## Seguridad

El token que se aportó **quedó escrito en el chat, así que ya no es secreto.**
Hay que generar uno nuevo en el portal de desarrolladores de Pinterest y revocar
ese. No está en el repositorio, ni en ningún archivo, ni en el historial de git
— se comprobó.
