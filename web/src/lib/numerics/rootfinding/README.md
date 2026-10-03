# rootfinding

Raíces de f(t) = 0 (semana en que el ajuste alcanza el límite). Todos devuelven
`{ raiz, iteraciones, convergio, error, traza: [{ iter, x, fx, error }] }`.

| Método | Requisito | Convergencia |
|---|---|---|
| `biseccion(f, a, b)` | f(a)·f(b) ≤ 0 | lineal, garantizada |
| `falsaPosicion(f, a, b)` | f(a)·f(b) ≤ 0 | lineal (suele ser más rápida) |
| `secante(f, x0, x1)` | dos puntos iniciales | ≈ 1.618 |
| `newtonRaphson(f, x0, { df })` | f' ≠ 0 (analítica o numérica) | cuadrática |

Errores (`RangeError`, en español): sin cambio de signo, derivada nula, secante horizontal, f no finita.
**Cuándo usarlo**: bisección para asegurar; Newton para velocidad con derivada analítica.
