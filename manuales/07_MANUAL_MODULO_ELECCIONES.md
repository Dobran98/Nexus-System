# 🗳️ MANUAL DEL MÓDULO ELECCIONES — SALA NACIONAL ELECTORAL

**Ruta en Nexus:** `/elecciones`  
**Cobertura:** 335 Municipios · Cortes por Franjas Horarias (9:00 AM a 8:00 PM)

---

## 1. Propósito del Módulo

La **Sala Nacional Electoral** centraliza el monitoreo de movilización ciudadana y apertura de centros de votación en los **335 municipios**, registrando cortes horarios continuos para la toma de decisiones estratégicas en tiempo real.

---

## 2. Franjas Horarias de Reporte

El tablero opera bajo cortes estrictos de jornada electoral:

| Corte | Ventana Horaria | Objetivo del Reporte |
| :---: | :--- | :--- |
| **Corte 1** | **09:00 AM** | Confirmación de apertura de mesas, asistencia de testigos y primeros votantes. |
| **Corte 2** | **11:00 AM** | Primer balance de movilización matutina y detección de centros con retraso. |
| **Corte 3** | **01:00 PM** | Balance de mediodía y efectividad de movilización de condominios/sectores. |
| **Corte 4** | **04:00 PM** | Impulso de tarde y alertas de refuerzo en municipios rezagados. |
| **Corte 5** | **06:00 PM — 08:00 PM** | Cierre de mesas, totalización de movilización y consolidado final. |

---

## 3. Procedimiento para Operadores de Sala

1. Reciba la llamada de reporte del coordinador municipal o testigo de centro.
2. En `/elecciones`, filtre por **Estado** y **Municipio**.
3. Seleccione la **Franja Horaria Activa** e introduzca el conteo acumulado validado.
4. Guarde el corte y verifique que el indicador del municipio cambie a **Reportado** en el tablero nacional.
