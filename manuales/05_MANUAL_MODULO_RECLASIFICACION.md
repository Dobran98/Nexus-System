# 🟡 MANUAL DEL MÓDULO RECLASIFICACIÓN — TRIAGE & CALIDAD OPERATIVA

**Ruta en Nexus:** `/reclasificacion`  
**Estado Actual:** Gobernado vía *Feature Flags* (`Solo Pruebas Dev` / `Público`)

---

## 1. Propósito del Módulo

El sistema de **Reclasificación & Triage** reemplaza las hojas de Excel compartidas (que sufrían bloqueos y pérdida de datos) por una **cola de auditoría colaborativa en tiempo real**. Permite revisar requerimientos ciudadanos captados por telefonía, corregir tipificaciones erróneas y redistribuir la carga equitativamente.

```
[Base Cruda / Excel] ──▶ [Cola de Triage Sin Bloqueos] ──▶ [Validación & Categoría] ──▶ [Despacho Limpio]
```

---

## 2. Flujo de Trabajo Operativo

1. Ingrese a **Reclasificación & Triage** (`/reclasificacion`).
2. Seleccione un caso pendiente de la cola asignada a su usuario.
3. Revise la **descripción original** y la **categoría preliminar** registrada en la llamada.
4. Si la categoría no corresponde al problema real (por ejemplo, fue clasificado como *Alumbrado Público* cuando describe una *Avería de Agua Potable*):
   - Seleccione la **Categoría Correcta** y **Subcategoría**.
   - Ajuste el nivel de **Prioridad** (`Urgente`, `Alta`, `Normal`).
5. Guarde el cambio; el caso pasará automáticamente al estado **Reclasificado / Validado** con registro de su `@username` y marca de tiempo.

---

## 3. Reglas de Distribución y Auditoría

- **Cero Colisiones:** Dos operadores nunca pueden editar simultáneamente el mismo registro; el sistema bloquea el ítem en edición de forma atómica.
- **Distribución Equitativa:** El panel administrativo permite repartir lotes de casos pendientes entre los analistas conectados en partes iguales.
- **Trazabilidad:** Todo cambio conserva la categoría original y la nueva categoría para retroalimentación de calidad.
