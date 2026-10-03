# stats

- Descriptiva: `media`, `varianza` (muestral), `desviacion`, `mediana`, `cuantil` (tipo 7), `pearson`, `zScore`,
  `autocorrelacion(y, k)` = Σ(y_t-ȳ)(y_{t+k}-ȳ)/Σ(y_t-ȳ)², `tCritico95(gl)`.
- Cambios de nivel: `cusum(y)` tabular (S+ = máx(0, S+ + (y-μ0) - k), alarma S > h; k = 0.5σ, h = 4σ) y
  `ewmaControl(y)` (z_t = λy_t + (1-λ)z_{t-1}, límites μ0 ± Lσ√(λ/(2-λ)(1-(1-λ)^{2t}))).

**Supuestos**: línea base = primer tercio de la serie (mín. 3 datos); serie sin variación -> sin alarmas.
**Complejidad**: O(n).
**Cuándo usarlo**: CUSUM para saltos sostenidos pequeños, EWMA como confirmación.
