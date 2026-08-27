# Mesa Creativa · QPayPro

Sistema agéntico para el área de Mercadeo de QPayPro. Automatiza la base
estratégica de la reunión creativa semanal, la mesa de servicio de solicitudes de
arte, y el cierre del ciclo del lead.

**Challenge de Innovación con IA · 2026**
Cierre de desarrollo: 5 de septiembre · Demo Day: 9 de septiembre

---

## Estado actual

**Fase 0 — verificaciones. NO INICIADA.**

No hay código. Por diseño: el proyecto tiene dependencias externas sin verificar
y la regla número uno es que ninguna línea de código que dependa de ellas se
escribe antes de comprobarlas contra las APIs reales.

Lo que sí está hecho es el análisis completo del alcance, que ya invalidó varios
supuestos del documento de partida.

### Hallazgo principal hasta ahora

De los ocho conectores que el proyecto asumía disponibles, **tres existen**.
Faltan Zoho CRM, Mail, Analytics, Books y Desk. Eso deja el Módulo 3 bloqueado y
el Módulo 2 sin canal de entrega para sus reportes.

Detalle en [`docs/01-inventario-conectores.md`](docs/01-inventario-conectores.md).

---

## Por dónde empezar a leer

| Si quieres… | Lee |
|---|---|
| El contexto permanente y las reglas | [`CLAUDE.md`](CLAUDE.md) |
| Cómo se llegó hasta aquí | [`docs/00-bitacora.md`](docs/00-bitacora.md) |
| Qué falta para desbloquear | [`docs/06-requerimientos-usuario.md`](docs/06-requerimientos-usuario.md) |
| El índice completo de documentación | [`docs/README.md`](docs/README.md) |

---

## Los tres módulos

**Módulo 1 · Mesa Creativa** *(prioridad máxima — único íntegramente construible hoy)*
Corrida semanal automática que lee rendimiento de pauta, revisa competencia,
cruza con orgánico, verifica lo recomendado la semana anterior, calcula un plan
de producción cuantificado y arma la presentación.

**Módulo 2 · Mesa de Servicio** *(parcialmente bloqueado)*
Entrada, seguimiento, entrega y publicación de solicitudes de arte. Reportes a
Ventas y Finanzas.

**Módulo 3 · Ciclo del lead** *(bloqueado)*
Devuelve a Meta qué leads cerraron, para que optimice por clientes ganados y no
por formularios llenados.

---

## Las reglas que rigen el proyecto

1. **Cero datos inventados.** Falta un dato → el sistema se detiene y lo reporta.
2. **Plan antes que código** en toda tarea no trivial.
3. **Falla ruidosamente.** Un reporte con un número inventado es peor que un
   reporte que no se generó.
4. **Solo el agente `orquestador` escribe en sistemas externos.**
5. **Ningún copy se publica sin aprobación humana.**
6. **`--dry-run` obligatorio** en toda escritura externa.
7. **Operaciones idempotentes.**

Las siete completas, con su contexto, en [`CLAUDE.md`](CLAUDE.md).

---

## Estructura

```
├── CLAUDE.md          Contexto permanente entre sesiones
├── .claude/
│   ├── agents/        Definiciones de subagentes
│   └── skills/        Skills del proyecto
├── config/            competidores · convenciones · destinatarios
├── src/
│   ├── base/          Conectores, normalización, logging
│   ├── modulo1/  modulo2/  modulo3/
├── data/
│   ├── capturas/      Métricas orgánicas ingresadas a mano
│   └── historico/     Corridas anteriores · loop de verificación · evidencia
├── docs/              Análisis, decisiones, validaciones
└── salidas/           Presentaciones y reportes generados
```

**Nota sobre `config/`:** cada valor lleva un campo `_estado` que declara si está
verificado. Los bloques con `_lock: true` deben hacer que el código se **detenga**
en lugar de consumirlos. Es la regla de "cero datos inventados" convertida en
barrera ejecutable — ver ADR-009 en
[`docs/decisiones.md`](docs/decisiones.md).
