# NUMERICS: análisis numérico del ausentismo

Módulo de métodos numéricos de SUSAN en JavaScript puro, sin dependencias: `web/src/lib/numerics/`
(importable como `@/lib/numerics`). Objetivo del proyecto: identificar patrones de ausentismo y orientar la
intervención docente oportuna. Todas las funciones son puras y deterministas (sin `Date.now()` ni `Math.random()`),
validan entrada con `TypeError`/`RangeError` en español y exponen su procedimiento (pasos, tablas, trazas) para uso didáctico.

## 1. Familias de métodos

| Carpeta | Métodos | Uso en SUSAN |
|---|---|---|
| `linear-algebra` | Gauss con pivoteo parcial, LU (PA = LU), `resolverSistema`, `numeroCondicion` | Resolver las ecuaciones normales |
| `regression` | `ajusteLineal`, `ajustePolinomial`, r², r² ajustado, error estándar, residuos, AIC | Tendencia y curvatura |
| `interpolation` | Lagrange, diferencias divididas de Newton, spline cúbico natural, `rellenarHuecos` | Semanas con sesiones suspendidas |
| `smoothing` | SMA, EMA, WMA | Ver la tendencia sin ruido |
| `differentiation` | Diferencias adelante/atrás/centrales (no uniformes), Richardson | Tasa de cambio del ausentismo |
| `integration` | Trapecio, Simpson 1/3 y 3/8, Romberg, trapecio sobre datos | Ausentismo acumulado como área |
| `rootfinding` | Bisección, falsa posición, secante, Newton-Raphson | Semana de cruce del límite |
| `stats` | Media, varianza, mediana, cuantiles, Pearson, z-score, autocorrelación, CUSUM, EWMA | Descriptiva y cambios de nivel |
| `forecast` | Candidatos lineal/cuadrático, validación cruzada LOO, intervalo, cruce del límite | Proyección |
| `risk` | Puntaje 0-100 con factores explicables | Alumnos en riesgo |
| `analysis` | `analizarGrupo` | Pantalla `/analitica` |

Cada carpeta tiene `README.md` (fórmula, supuestos, complejidad, cuándo usarlo) y pruebas `*.test.js`.

## 2. Contratos de entrada (ARCHITECTURE.md sección 11)

- `serie`: arreglo de sesiones cerradas de `api_serie_grupo` (`fecha`, `dia_semana`, `inscritos`, `ausentes`, `retardos`, ...)
  o un objeto con `sesiones`/`items`. Las sesiones sin fecha válida o con `inscritos` no positivos se descartan (alerta `DATOS_FALTANTES`).
- `matriz`: `{ fechas: string[], alumnos: [{ id_alumno, matricula, nombre, estados: (string|null)[] }] }` de `api_matriz_grupo`.
  `null` = sin registro (no cuenta). Estados: `presente|retardo|ausente|justificado|pendiente`.
- `limitePct` (20), `sesionesProgramadas`, `retardosPorAusencia` (3). También se aceptan dentro de `opciones` (forma que usa la pantalla).

## 3. Definiciones del análisis de grupo

- **Semana relativa**: 1 = semana (lunes a domingo) de la primera sesión; las semanas sin sesiones tienen `tasa = null`.
- **Tasa semanal** = Σ ausentes / Σ inscritos de las sesiones de la semana (fracción 0-1).
- **Acumulado** (en %): promedio por alumno de faltas equivalentes acumuladas,
  `100 · Σ_sesiones (ausentes + retardos/rpa)/inscritos / sesionesProgramadas`. Es la curva que se compara con el límite
  (se usa la fracción exacta de retardos para que la curva sea continua).
- **Faltas equivalentes por alumno** = ausencias + ⌊retardos/rpa⌋; justificado y pendiente no cuentan (RN-10, RN-11).
  El límite se supera solo si `faltasEq · 100 > limitePct · sesionesProgramadas` (exactamente 20 % conserva el derecho).
- **Suficiencia**: se requieren al menos 4 semanas con sesiones cerradas; con menos, `resumen.suficiente = false` y se
  degradan tendencia, proyección, cruce y cambios (el patrón semanal y el riesgo por alumno sí se calculan).

## 4. Resultado de `analizarGrupo` (forma estable)

Tasas de `tendencia`, `suavizado` y `proyeccion` en fracción (0.12 = 12 %); `resumen`, `cruceLimite.acumulado` y
`pendientePuntosPorSemana` en % o puntos porcentuales.

```text
{
  resumen: { suficiente, semanasObservadas, semanasConDatos, sesionesCerradas, sesionesProgramadas|null, inscritos,
             tasaActual|null (%), tasaPrevia|null (%), variacionPP|null, tasaPromedio|null (%), acumuladoActualPct|null,
             limitePct, retardosPorAusencia, sesionesPorSemana|null, semanasTotales|null,
             alumnosEvaluados, alumnosEnRiesgo, alumnosSuperanLimite, areaAusentismo|null },
  tendencia: { disponible, semanas[], tasas[] (null en huecos), ajuste: {intercepto, pendiente, r2, errorEstandar, n}|null,
               pendientePuntosPorSemana|null, direccion: 'alza'|'baja'|'estable'|null (umbral ±0.25 pp/semana),
               puntosAjustados[{semana, valor}], tasaCambio[{semana, puntosPorSemana}] },
  suavizado: { ventana: 3, alfa: 0.5, semanas[], tasasRellenas[], rellenadas[] (semanas), sma[], ema[], wma[] },
  proyeccion: { disponible, horizonte, grado|null, razon|null, modelo|null, candidatos[{grado, r2, r2Ajustado, aic, errorEstandar, errorLOO}],
                ajuste[{semana, valor}], puntos[{semana, valor, inferior, superior}], mensaje },
  cruceLimite: { estado: 'cruza'|'no_cruza'|'superado'|'insuficiente', semana|null, t|null,
                 mensaje: 'Semana N (estimada)'|'No cruza dentro del periodo'|'Ya superado'|'Datos insuficientes', limitePct, semanasTotales,
                 acumulado: {semanas[], valores[] (%)}, ajuste[{semana, valor}], proyeccion[{semana, valor, inferior, superior}],
                 grado|null, biseccion|null, newton|null },
  patronSemanal: { dias[{dia 1-7, nombre, sesiones, ausentes, tasa, critico}], diaCritico|null, nombreDiaCritico|null },
  cambios: { disponible, semanaCambio|null, semanaDeteccion|null, direccion|null, mensaje, cusum|null, ewma|null },
  alumnosEnRiesgo: [ resultado de evaluarRiesgoAlumno con nivel 'medio'|'alto', de mayor a menor puntaje ],
  alertas: [{ codigo, nivel: 'alta'|'media'|'info', mensaje }],
  procedimientos: [{ id, titulo, pasos?: Paso[], traza?: {iter, x, fx, error}[] }]
}
```

`Paso` = `{ titulo, texto?, valores?: [{etiqueta, valor}], tabla?: {columnas, filas}, matriz?: number[][] }`.
Ids de `procedimientos` (solo aparecen los disponibles): `regresion`, `suavizado`, `proyeccion`, `cruce-biseccion`,
`cruce-newton`, `cambio-nivel`, `derivacion-integracion`, `riesgo`. El procedimiento de un alumno está en
`alumnosEnRiesgo[i].pasos`. Códigos de alerta: `DATOS_INSUFICIENTES`, `LIMITE_SUPERADO_GRUPO`, `CRUCE_PROYECTADO`,
`ALUMNOS_SUPERAN_LIMITE`, `ALUMNOS_EN_RIESGO`, `TENDENCIA_AL_ALZA`, `CAMBIO_DE_NIVEL`, `DIA_CRITICO`, `SIN_AUSENCIAS`,
`DATOS_FALTANTES`, `PROGRAMADAS_NO_DEFINIDAS`.

`analizarGrupo` nunca lanza por datos pobres (serie corta, nulls, sin ausencias, entradas vacías); solo lanza
`TypeError`/`RangeError` por argumentos inválidos (entrada no objeto, `limitePct` fuera de (0, 100], `retardosPorAusencia` < 1).
Rendimiento: el costo es O(sesiones + alumnos·sesiones) más un LOO sobre pocos puntos semanales.

## 5. Decisiones de modelado

1. **Proyección**: se ajustan polinomios de grado 1 y 2 y se elige por RMSE de validación cruzada leave-one-out; el
   cuadrático solo gana si mejora el RMSE ≥ 2 % (preferencia por el modelo simple). Se reportan también r², r² ajustado y AIC.
2. **Intervalo**: ŷ ± t·s·√(1 + φᵀ(XᵀX)⁻¹φ) al 95 % (valores t tabulados, 1.96 si gl > 30). Es aproximado y se recorta a [0, 1] en tasas.
3. **Cruce del límite**: se resuelve f(t) - límite = 0 sobre el ajuste del acumulado. Barrido de paso 0.25 semanas para
   hallar el corchete; bisección entrega la raíz y Newton-Raphson (derivada analítica) la contrasta. La semana es `⌈t⌉`
   (con tolerancia 1e-6). Si la raíz excede las semanas totales del periodo (`sesionesProgramadas / sesionesPorSemana`)
   el estado es `no_cruza`.
4. **Huecos**: las semanas sin clase se rellenan con spline cúbico natural solo para suavizado y control de cambios; la
   regresión y la proyección usan únicamente semanas observadas.
5. **Cambios de nivel**: CUSUM tabular (k = 0.5σ, h = 4σ) y carta EWMA (λ = 0.3, L = 3) con línea base del primer tercio
   de la serie. La semana de cambio es el último instante con suma 0 antes de la alarma.
6. **Riesgo por alumno** (0-100), suma de aportes acotados:

| Factor | Máx. | Aporte |
|---|---|---|
| Distancia al límite | 25 | 25·mín(1, % faltas / límite) |
| Pendiente reciente | 15 | 15·acot(pendiente/0.10, 0, 1); pendiente MCO del indicador de falta en las últimas ≤ 8 sesiones (necesita ≥ 4) |
| Faltas consecutivas | 15 | 15·mín(1, racha/3); justificado/pendiente no cortan la racha |
| Concentración por día | 5 | 5·acot((participación-0.5)/0.5, 0, 1); requiere ≥ 3 ausencias |
| Proyección al cruce | 20 | 20·acot(% proyectado al cierre / límite - 0.5, 0, 1), con ritmo propio |
| z-score frente al grupo | 10 | 10·acot(z/2, 0, 1) (grupo de ≥ 3) |
| Retardos acumulados | 10 | 10·mín(1, retardos/(2·rpa)) |

   Nivel: `alto` si puntaje ≥ 60 o ya superó el límite; `medio` si ≥ 35; `bajo` en otro caso. La acción sugerida depende
   del nivel y del factor dominante. Los umbrales son heurísticos y están centralizados en `risk/riesgo.js` (`PESOS_RIESGO`).
7. **Derivación e integración**: la tasa de cambio por semana usa diferencias finitas de tres puntos (nodos no uniformes);
   el área bajo la tasa semanal usa trapecio sobre datos y se contrasta con Simpson y Romberg sobre el ajuste lineal.

## 6. Verificación

`cd web && npx vitest run src/lib/numerics` y `npx eslint src/lib/numerics`. Las pruebas cubren valores conocidos
(recta y parábola exactas, Newton sobre x²-2, bisección sobre cos(x)-x, Simpson de sin en [0, π] = 2, Romberg, spline
que reproduce los nudos, Lagrange = Newton, sistema 3x3, Hilbert mal condicionado, CUSUM sobre un salto sintético) y el
pipeline completo con una serie creciente (cruce en la semana esperada), una plana (sin cruce) y casos degenerados.
