# integration

Ausentismo acumulado como área bajo la curva de la tasa.

- `trapecioCompuesto`, `simpson13` (n par), `simpson38` (n múltiplo de 3) sobre funciones.
- `trapecioDatos(xs, ys)` (no uniforme, con área acumulada) y `simpsonDatos(ys, h)`.
- `romberg(f, a, b)`: T(2^i) + extrapolación de Richardson; devuelve la tabla.

**Errores**: trapecio O(h²); Simpson O(h⁴); Romberg orden creciente por columna.
**Supuestos**: f suave en [a, b]; para datos ruidosos usar trapecio.
**Complejidad**: O(n) evaluaciones; Romberg 2^niveles.
