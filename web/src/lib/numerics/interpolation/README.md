# interpolation

Reconstruir valores entre puntos conocidos (p. ej. semanas con sesiones suspendidas).

- `lagrange(xs, ys, x)`: P(x) = Σ y_i · Π_{j≠i}(x-x_j)/(x_i-x_j); devuelve cada término.
- `newtonDiferenciasDivididas(xs, ys)`: tabla f[x_i..x_{i+k}] y evaluación anidada.
- `splineCubicoNatural(xs, ys)`: S'' = 0 en los extremos; momentos por sistema tridiagonal (Thomas).
- `rellenarHuecos(xs, ys)`: rellena nulls interiores (spline) sin extrapolar extremos.

**Supuestos**: nodos distintos (spline: estrictamente crecientes).
**Complejidad**: Lagrange O(n²) por evaluación; Newton O(n²) construcción, O(n) evaluación; spline O(n).
**Cuándo usarlo**: Lagrange/Newton con pocos nodos (< 8; oscilan con muchos). El spline es el método por omisión para huecos.
