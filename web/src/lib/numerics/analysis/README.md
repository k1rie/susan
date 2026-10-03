# analysis

`analizarGrupo({ serie, matriz, limitePct, sesionesProgramadas, retardosPorAusencia })` orquesta todo el módulo.
Forma estable del resultado y procedimiento: ver `docs/NUMERICS.md` y el JSDoc `AnalisisGrupo`.

Pasos: sesiones -> semanas relativas (tasa y acumulado) -> regresión -> suavizado (huecos por spline) -> proyección
-> cruce del límite -> patrón por día -> CUSUM/EWMA -> riesgo por alumno -> alertas -> procedimientos.

**Supuestos**: la serie trae solo sesiones cerradas. Menos de 4 semanas con datos: degrada (`resumen.suficiente = false`).
**Complejidad**: O(sesiones + alumnos·sesiones).
