# risk

`evaluarRiesgoAlumno(alumno, contexto)` y `evaluarRiesgoGrupo(alumnos, contexto)`: puntaje 0-100 como suma de
siete factores (máximos entre paréntesis): distancia al límite (25), pendiente reciente de faltas (15), faltas
consecutivas (15), concentración por día (5), proyección al cruce (20), z-score frente al grupo (10), retardos (10).
Nivel: alto (≥ 60 o límite superado), medio (≥ 35), bajo. Cada factor trae `valor`, `aporte` y `explicacion`.

**Supuestos**: faltas equivalentes = ausencias + ⌊retardos/3⌋; justificado y pendiente no cuentan (RN-10, RN-11);
exactamente el límite conserva el derecho. Los umbrales son heurísticos y se documentan en `docs/NUMERICS.md`.
**Complejidad**: O(sesiones) por alumno.
