# forecast

Proyección y cruce del límite de faltas.

- `ajustarCandidatos(x, y)`: polinomios de grado 1 y 2 con r², r² ajustado, AIC y RMSE leave-one-out.
- `elegirModelo(candidatos)`: parte del lineal; sube de grado solo si el RMSE LOO baja ≥ 2 %.
- `intervaloPrediccion(ajuste, x0)`: ŷ ± t·s·√(1 + φᵀ(XᵀX)⁻¹φ) al 95 % (aproximado).
- `proyectarSerie({ x, y, horizonte })`.
- `buscarCruce(modelo, limite, { desde, hasta })`: resuelve f(t) - límite = 0; barrido para el corchete, bisección y Newton.

**Supuestos**: la tendencia ajustada continúa; errores normales. Es una estimación, no una garantía.
**Complejidad**: O(n²·g³) por el LOO (n pequeño).
