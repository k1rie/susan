# smoothing

Medias móviles para ver la tendencia sin ruido semanal.

- `sma(y, n)`: promedio de las últimas n observaciones.
- `wma(y, n)`: pesos lineales 1..n (lo reciente pesa más).
- `ema(y, α)`: S_t = α·y_t + (1-α)·S_{t-1}; `alfaDesdeVentana(n)` = 2/(n+1).

**Supuestos**: serie ordenada y equiespaciada; los huecos (null) producen null en SMA/WMA.
**Complejidad**: O(n·ventana) SMA/WMA, O(n) EMA.
**Cuándo usarlo**: visualización y detección de cambios; introducen retraso (SMA mayor que EMA/WMA).
