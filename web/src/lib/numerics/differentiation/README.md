# differentiation

Tasa de cambio del ausentismo.

- `diferenciaAdelante/Atras` (orden 1) y `diferenciaCentral` (orden 2, nodos no uniformes:
  f'(x_i) ≈ -h2/(h1(h1+h2))·y_{i-1} + (h2-h1)/(h1·h2)·y_i + h1/(h2(h1+h2))·y_{i+1}).
- `derivadaSerie(xs, ys)`: central adentro y unilateral de 2.º orden en los extremos.
- `derivadaFuncion(f, x)` y `richardson(f, x)`: D(h) central extrapolada, R[i][j] = (4^j·R[i][j-1] - R[i-1][j-1])/(4^j-1).

**Supuestos**: nodos crecientes; la derivada amplifica el ruido (usar datos suavizados).
**Complejidad**: O(n) por serie; Richardson O(niveles²) evaluaciones.
**Cuándo usarlo**: pendiente local de la serie; Richardson cuando se conoce f (el ajuste).
