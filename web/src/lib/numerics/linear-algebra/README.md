# linear-algebra

Sistemas lineales Ax = b. Base de la regresión (ecuaciones normales) y de la spline.

- `eliminacionGaussiana(A, b)` -> `{ solucion, determinante, matrizTriangular, pasos }`.
- `descomposicionLU(A)` -> `P·A = L·U`; `resolverConLU(lu, b)` reutiliza la factorización.
- `resolverSistema(A, b, { metodo })` -> solución, residuo ||Ax-b||∞, número de condición y advertencias.
- `numeroCondicion(A)` = ||A||∞·||A⁻¹||∞.

**Fórmula**: m_ik = a_ik / a_kk; fila_i -= m_ik · fila_k, con pivoteo parcial (mayor |a_ik| de la columna).
**Supuestos**: A cuadrada, no singular (pivote > n·ε·máx|a|; si no, `RangeError`).
**Complejidad**: O(n³) la factorización; O(n²) cada sustitución.
**Cuándo usarlo**: sistemas densos pequeños (n < 50). Con cond(A) > 1e8 se advierte pérdida de cifras.
