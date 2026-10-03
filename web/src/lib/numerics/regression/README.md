# regression

Mínimos cuadrados con ecuaciones normales explícitas.

- `ajusteLineal(x, y)`: n·a + Σx·b = Σy ; Σx·a + Σx²·b = Σxy, resueltas con Gauss.
- `ajustePolinomial(x, y, grado)`: XᵀX c = Xᵀy con x centrado y escalado (u = (x-x̄)/máx|x-x̄|) para mejorar la condición.
- Métricas: `r2`, `r2Ajustado` (null si n-k-1 ≤ 0), `errorEstandar` = sqrt(SSE/(n-p)), `residuos`, `aic`.

**Supuestos**: errores independientes de varianza constante; x no todos iguales; n ≥ grado + 1.
Si y es constante, r² = 1 cuando el ajuste es exacto.
**Complejidad**: O(n·g + g³).
**Cuándo usarlo**: tendencia de la tasa semanal (grado 1) y curvatura del acumulado (grado 2). No usar grados altos con pocos datos.
