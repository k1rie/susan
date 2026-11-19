# Pruebas unitarias y de integración de SUSAN

## 1. Objetivo y entorno de pruebas

El objetivo de esta sección es comprobar, con una muestra pequeña y reproducible, que tres funciones de negocio de SUSAN cumplen las reglas que documenta la especificación. Las funciones son la clasificación por minuto (RN-03), el cálculo de faltas equivalentes (RN-10) y la estimación de la semana de cruce del límite de 20 % (RN-11). Además, dos integraciones verifican el pase de lista manual (RF-09) y la cadena regresión → búsqueda de raíces. Las pruebas usan los entornos que el proyecto ya tenía: Vitest para la lógica en JavaScript y el arnés SQL propio (`supabase/tests/_harness.sql`, sin pgTAP), que corre contra una base PostgreSQL temporal. No se modificó código de producción ni se instalaron paquetes. Solo se agregaron cuatro archivos de prueba.

| Elemento | Lógica numérica (web) | Base de datos (reglas de negocio) |
|---|---|---|
| Lenguaje | JavaScript ESM (Node.js v24.11.1) | SQL / PL/pgSQL |
| Framework de pruebas | Vitest v5.0.3 (`web/vitest.config.mjs`, entorno `node`) | Arnés propio `t.*` (`supabase/tests/_harness.sql`) |
| Dependencias necesarias | `vitest` (ya en `devDependencies`) | PostgreSQL 16 local (`postgres (PostgreSQL) 16.14`), migraciones del repositorio y `_fixtures.sql` |
| Aislamiento | Funciones puras, sin red ni base de datos | BD temporal única por ejecución; cada archivo corre en una transacción con `ROLLBACK`; la BD se elimina al final |
| Comando de ejecución | `cd web && npx vitest run src/lib/numerics/reporte.unitarias.test.js src/lib/numerics/reporte.integracion.test.js` | `scripts/test-sql.sh reporte_` |

Archivos agregados (pruebas propuestas en este trabajo):

- `supabase/tests/reporte_01_estado_por_minuto.sql`: UT-01 y UT-02.
- `web/src/lib/numerics/reporte.unitarias.test.js`: UT-03 a UT-06.
- `supabase/tests/reporte_02_integracion_manual.sql`: IT-01.
- `web/src/lib/numerics/reporte.integracion.test.js`: IT-02.

El proyecto ya tenía pruebas previas que tocan estas mismas funciones (`api_a_sesiones_02_manual.sql`, `risk.test.js` y `forecast.test.js`). Las de este documento son nuevas y están separadas de esas.

## 2. Resumen de selección

| ID | Función real | Archivo | Responsabilidad | Motivo de selección |
|---|---|---|---|---|
| F1 | `app.estado_por_minuto(p_limite integer, p_tolerancia integer, p_minuto numeric)` | `supabase/migrations/0130_sesiones_helpers.sql` | Clasifica una lectura como presente, retardo o fuera de la ventana según el minuto de la sesión (RN-03). | Es la definición única de la ventana de tolerancia. La usan tanto el registro automático como la sugerencia del pase manual. |
| F2 | `resumirAsistencia(estados, rpa)` | `web/src/lib/numerics/risk/riesgo.js` | Cuenta ausencias, retardos y justificados, y calcula las faltas equivalentes (RN-10). | Es el acumulado que alimenta el puntaje de riesgo. Es pura y su regla está definida en la especificación. |
| F3 | `buscarCruce(modelo, limite, opciones)` | `web/src/lib/numerics/forecast/cruce.js` | Estima la semana en que el ausentismo proyectado alcanza el límite, con bisección y Newton-Raphson. | Es el núcleo de la estimación de tendencia (métodos numéricos). |

En lugar de una función de la familia «pase manual», se eligió `app.estado_por_minuto` porque `app.registrar_asistencia_manual` mide unas 90 líneas y depende de la sesión, las inscripciones y el consentimiento. Esa familia queda cubierta en la integración IT-01, que ejecuta el pase manual completo.

## 3. Pruebas unitarias

### Función 1 — `app.estado_por_minuto`

**Propósito:** asigna el estado de asistencia según el minuto transcurrido desde el inicio de la sesión. Es presente antes del límite y retardo desde el límite hasta la tolerancia, inclusive. Fuera de la ventana devuelve `NULL`.

**Ubicación:** `supabase/migrations/0130_sesiones_helpers.sql`, `app.estado_por_minuto(p_limite integer, p_tolerancia integer, p_minuto numeric) RETURNS public.estado_asistencia`.

**Código de la función:**

```sql
CREATE OR REPLACE FUNCTION app.estado_por_minuto(p_limite integer, p_tolerancia integer, p_minuto numeric)
    RETURNS public.estado_asistencia
    LANGUAGE sql IMMUTABLE
    SET search_path = pg_catalog, pg_temp
AS $$
    SELECT CASE WHEN p_minuto < p_limite THEN 'presente'::public.estado_asistencia
                WHEN p_minuto <= p_tolerancia THEN 'retardo'::public.estado_asistencia
           END
$$;
```

**Casos de prueba** (límite 10 y tolerancia 20: son los valores por omisión de `sesion_clase` en `0005_tablas_operacion.sql`):

| ID | Escenario | Entradas concretas | Resultado esperado |
|---|---|---|---|
| UT-01 | Caso normal | `(10, 20, 5.0)` y `(10, 20, 15.0)` | `presente` y `retardo` |
| UT-02 | Caso límite | `(10, 20, 9.99)`, `(10, 20, 10.0)`, `(10, 20, 20.0)` y `(10, 20, 20.01)` | `presente`, `retardo`, `retardo` y `NULL` |

**Código de la prueba** (`supabase/tests/reporte_01_estado_por_minuto.sql`):

```sql
-- Reporte de pruebas · UT-01 y UT-02: app.estado_por_minuto (RN-03).
-- Funcion pura (IMMUTABLE): no toca tablas, solo se necesita la BD temporal con las migraciones.
-- Esperados tomados de RN-03 con los valores por omision de la sesion (limite_presente_min = 10, tolerancia_min = 20).
BEGIN;
SELECT t.begin('reporte_01_estado_por_minuto');

-- UT-01 · caso normal: dentro de cada tramo de la ventana
SELECT t.eq(app.estado_por_minuto(10, 20, 5.0)::text, 'presente', 'UT-01a: minuto 5 -> presente');
SELECT t.eq(app.estado_por_minuto(10, 20, 15.0)::text, 'retardo', 'UT-01b: minuto 15 -> retardo');

-- UT-02 · casos limite: fronteras exactas y fuera de la ventana
SELECT t.eq(app.estado_por_minuto(10, 20, 9.99)::text, 'presente', 'UT-02a: minuto 9.99 -> presente');
SELECT t.eq(app.estado_por_minuto(10, 20, 10.0)::text, 'retardo', 'UT-02b: minuto 10.00 -> retardo');
SELECT t.eq(app.estado_por_minuto(10, 20, 20.0)::text, 'retardo', 'UT-02c: minuto 20.00 aun es retardo');
SELECT t.ok(app.estado_por_minuto(10, 20, 20.01) IS NULL, 'UT-02d: minuto 20.01 -> NULL (fuera de la ventana)');

SELECT t.summary();
ROLLBACK;
```

**Explicación:** se compara el estado devuelto con el que dicta RN-03 («presente en los primeros 10 minutos, retardo hasta el minuto 20»). La especificación no aclara si el minuto 10.00 exacto es presente o retardo. El código y el diseño del equipo («retardo desde el minuto 10») lo tratan como retardo, y la prueba fija esa interpretación. Fuera de la ventana la función devuelve `NULL`, no `ausente`: el ausente lo asignan el cierre de sesión (RN-07) o `app.estado_sugerido`.

### Función 2 — `resumirAsistencia`

**Propósito:** resume la asistencia de un alumno. Las faltas equivalentes son las ausencias más `⌊retardos / rpa⌋`; el justificado y el pendiente no cuentan como falta.

**Ubicación:** `web/src/lib/numerics/risk/riesgo.js`, `export function resumirAsistencia(estados, rpa)`. Recibe `estados: (string|null)[]` y `rpa: number` (retardos por ausencia).

**Código de la función:**

```js
/**
 * Conteos de un alumno: faltas equivalentes = ausencias + floor(retardos / retardosPorAusencia);
 * justificado y pendiente no cuentan (RN-10, RN-11).
 * @param {(string|null)[]} estados
 * @param {number} rpa
 */
export function resumirAsistencia(estados, rpa) {
    let ausentes = 0;
    let retardos = 0;
    let justificados = 0;
    let registradas = 0;
    for (const e of estados) {
        if (e === null || e === undefined) {
            continue;
        }
        registradas += 1;
        if (e === 'ausente') {
            ausentes += 1;
        } else if (e === 'retardo') {
            retardos += 1;
        } else if (e === 'justificado') {
            justificados += 1;
        }
    }
    return { ausentes, retardos, justificados, registradas, faltasEq: ausentes + Math.floor(retardos / rpa) };
}
```

**Casos de prueba:**

| ID | Escenario | Entradas concretas | Resultado esperado |
|---|---|---|---|
| UT-03 | Caso normal | `['presente','ausente','retardo','retardo','retardo','justificado','pendiente',null]`, `rpa = 3` | `ausentes 1, retardos 3, justificados 1, faltasEq 2` |
| UT-04 | Caso límite (redondeo hacia abajo) | 2 retardos y, aparte, 5 retardos, ambos con `rpa = 3` | `faltasEq 0` y `faltasEq 1` |

**Código de la prueba** (`web/src/lib/numerics/reporte.unitarias.test.js`, primera parte):

```js
import { describe, expect, it } from 'vitest';
import { resumirAsistencia } from './risk/riesgo.js';

describe('resumirAsistencia (RN-10: tres retardos = una falta; justificado y pendiente no cuentan)', () => {
    it('UT-03 caso normal: 1 ausencia + 3 retardos = 2 faltas equivalentes', () => {
        // Preparar
        const estados = ['presente', 'ausente', 'retardo', 'retardo', 'retardo', 'justificado', 'pendiente', null];
        // Ejecutar
        const r = resumirAsistencia(estados, 3);
        // Verificar
        expect(r).toMatchObject({ ausentes: 1, retardos: 3, justificados: 1, faltasEq: 2 });
    });

    it.each([
        [2, 0], // dos retardos aun no forman una falta
        [5, 1], // cinco retardos: una falta completa, sobran dos
    ])('UT-04 caso limite: %i retardos -> %i falta(s) equivalente(s)', (retardos, esperado) => {
        const estados = Array(retardos).fill('retardo');
        const r = resumirAsistencia(estados, 3);
        expect(r.faltasEq).toBe(esperado);
    });
});
```

**Explicación:** los esperados salen de contar a mano con RN-10 («tres retardos equivalen a una ausencia»). En UT-03 son 1 ausencia + ⌊3/3⌋ = 2, y el justificado y el pendiente no suman. En UT-04, ⌊2/3⌋ = 0 y ⌊5/3⌋ = 1, porque la regla no reconoce fracciones de falta. No se verifica el campo `registradas`: la especificación no lo define y, en el código, también cuenta los pendientes.

### Función 3 — `buscarCruce`

**Propósito:** resuelve `f(t) − límite = 0` sobre el modelo de tendencia. Primero barre el horizonte para encontrar un corchete y luego lo refina con bisección, con Newton-Raphson como contraste. Devuelve `superado`, `cruza` o `no_cruza` y la semana entera del cruce. Es una estimación informativa: no equivale a faltas confirmadas ni a una sanción.

**Ubicación:** `web/src/lib/numerics/forecast/cruce.js`, `export function buscarCruce(modelo, limite, opciones)`. Depende de `validarNumero` (`../common/validar.js`), de `biseccion` y `newtonRaphson` (`../rootfinding/metodos.js`) y de `semanaDeCruce` (mismo archivo, se muestra porque la función la usa).

**Código de la función:**

```js
/**
 * Convierte un instante continuo t (en semanas) a la semana entera en que se alcanza el límite
 * (la primera semana cuyo cierre ya lo supera). La tolerancia evita que 13.0000000001 pase a 14.
 * @param {number} t
 */
export function semanaDeCruce(t) {
    return Math.ceil(t - 1e-6);
}

/**
 * Busca cuándo el ajuste f(t) alcanza el límite resolviendo g(t) = f(t) - límite = 0.
 * 1) Si g(desde) >= 0 el límite ya está superado.
 * 2) Se barre [desde, hasta] con paso `paso` para encontrar el primer cambio de signo (corchete).
 * 3) Se refina con bisección (siempre converge) y, como contraste didáctico, con Newton-Raphson
 *    (derivada analítica del modelo) partiendo del centro del corchete.
 *
 * @param {{predecir: (t: number) => number, derivada: (t: number) => number}} modelo
 * @param {number} limite
 * @param {{desde: number, hasta: number, paso?: number, tolerancia?: number}} opciones
 * @returns {{estado: 'superado'|'cruza'|'no_cruza', t: number|null, semana: number|null,
 *   corchete: [number, number]|null, biseccion: import('../rootfinding/metodos.js').ResultadoRaiz|null,
 *   newton: (import('../rootfinding/metodos.js').ResultadoRaiz & {aviso?: string})|null}}
 */
export function buscarCruce(modelo, limite, opciones) {
    validarNumero(limite, 'limite');
    const { desde, hasta } = opciones;
    const paso = opciones.paso ?? 0.25;
    const tolerancia = opciones.tolerancia ?? 1e-8;
    validarNumero(desde, 'desde');
    validarNumero(hasta, 'hasta');
    validarNumero(paso, 'paso');
    if (!(hasta > desde) || paso <= 0) {
        throw new RangeError('Se requiere hasta > desde y paso > 0.');
    }
    const g = (t) => modelo.predecir(t) - limite;
    if (g(desde) >= 0) {
        return { estado: 'superado', t: desde, semana: semanaDeCruce(desde), corchete: null, biseccion: null, newton: null };
    }
    let previo = desde;
    for (let t = desde + paso; ; t += paso) {
        const actual = Math.min(t, hasta);
        if (g(actual) >= 0) {
            const bis = biseccion(g, previo, actual, { tolerancia });
            let newton = null;
            try {
                newton = newtonRaphson(g, (previo + actual) / 2, { df: modelo.derivada, tolerancia, maxIter: 50 });
            } catch (e) {
                // La derivada nula no invalida el cruce (ya lo da la bisección); solo se informa.
                newton = { raiz: NaN, iteraciones: 0, convergio: false, error: NaN, traza: [], aviso: e.message };
            }
            return { estado: 'cruza', t: bis.raiz, semana: semanaDeCruce(bis.raiz), corchete: [previo, actual], biseccion: bis, newton };
        }
        if (actual >= hasta) {
            break;
        }
        previo = actual;
    }
    return { estado: 'no_cruza', t: null, semana: null, corchete: null, biseccion: null, newton: null };
}
```

**Casos de prueba:**

| ID | Escenario | Entradas concretas | Resultado esperado |
|---|---|---|---|
| UT-05 | Caso normal | modelo `f(t) = 2t`, `f'(t) = 2`; límite 20; `{ desde: 0, hasta: 16 }` | `estado 'cruza'`, `t ≈ 10` (tolerancia 1e-6), `semana 10`, raíz de Newton ≈ 10 |
| UT-06 | Caso inválido | mismo modelo; límite 20; `{ desde: 8, hasta: 8 }` | `RangeError('Se requiere hasta > desde y paso > 0.')` |

**Código de la prueba** (`web/src/lib/numerics/reporte.unitarias.test.js`, segunda parte):

```js
import { buscarCruce } from './forecast/cruce.js';

describe('buscarCruce (semana en que el ausentismo acumulado alcanza el limite)', () => {
    // Doble de prueba: un modelo lineal conocido f(t) = 2t sustituye al ajuste de regresion.
    const modelo = { predecir: (t) => 2 * t, derivada: () => 2 };

    it('UT-05 caso normal: f(t) = 2t alcanza 20 % en t = 10 (semana 10)', () => {
        const r = buscarCruce(modelo, 20, { desde: 0, hasta: 16 });
        expect(r.estado).toBe('cruza');
        expect(r.t).toBeCloseTo(10, 6);
        expect(r.semana).toBe(10);
        expect(r.newton.raiz).toBeCloseTo(10, 6);
    });

    it('UT-06 caso invalido: horizonte con hasta <= desde lanza RangeError', () => {
        expect(() => buscarCruce(modelo, 20, { desde: 8, hasta: 8 }))
            .toThrow(new RangeError('Se requiere hasta > desde y paso > 0.'));
    });
});
```

**Explicación:** el doble `f(t) = 2t` sustituye al ajuste de regresión para que el esperado se pueda despejar a mano: 2t = 20 ⇒ t = 10. Las raíces se comparan con `toBeCloseTo(…, 6)`, es decir, con un error menor que 5 × 10⁻⁷, porque los métodos iterativos se detienen en una tolerancia de 10⁻⁸. UT-06 comprueba que un horizonte vacío se rechaza con el error documentado en lugar de devolver un resultado falso.

## 4. Pruebas de integración

### IT-01 — Pase de lista manual de punta a punta en la base de datos

- **Objetivo:** comprobar que un registro manual hecho por el docente titular se clasifica por la hora de marcado, se persiste con origen `manual` y rechaza a un alumno sin inscripción activa.
- **Componentes reales:**
  - `public.api_registrar_manual`: valida el rol y bloquea la sesión con `app.sesion_bloqueada`.
  - `app.registrar_asistencia_manual`: valida la inscripción (RN-01) y garantiza un registro único por alumno y sesión (RN-02).
  - `app.estado_sugerido` y `app.estado_por_minuto`: clasifican según RN-03.
  - La tabla `public.asistencia`, con sus restricciones y disparadores.
- **Dobles:** ninguno sustituye lógica de negocio. La identidad del docente se simula con `t.as_user` (claims JWT de prueba) y la hora con `t.reloj`, que fija `app.fake_now`, el reloj simulado que solo habilita la BD de prueba.
- **Precondiciones y datos sintéticos** (`_fixtures.sql`): grupo 5B (lunes de 09:00 a 10:00, docente `docente2@susan.test`) con su sesión manual abierta del 14-sep-2026. A004 está inscrito en 5B; A002 no. El reloj marca 2026-09-14 09:14 (−06).

| Entrada | Interacción | Resultado esperado |
|---|---|---|
| `api_registrar_manual(sesión 5B 14-sep, A004, NULL, '2026-09-14 09:12-06')` como `docente2` | La RPC autoriza y bloquea la sesión; el núcleo sugiere el estado para el minuto 12 e inserta en `asistencia` | Respuesta `estado 'retardo'`, `origen 'manual'`, `creado true`; **una** fila persistida con `retardo` / `manual` / 09:12 |
| La misma RPC con A002 y estado `'presente'` | El núcleo valida la inscripción antes de insertar | Error `P0001:ALUMNO_NO_INSCRITO` y **cero** filas persistidas para A002 |

**Código de la prueba** (`supabase/tests/reporte_02_integracion_manual.sql`):

```sql
-- Reporte de pruebas · IT-01: pase manual de punta a punta en la BD de prueba.
-- Componentes reales: public.api_registrar_manual (rol + bloqueo de la sesion) -> app.registrar_asistencia_manual
-- (RN-01 inscripcion, RN-02 registro unico) -> app.estado_sugerido / app.estado_por_minuto (RN-03)
-- -> tabla public.asistencia con sus restricciones y disparadores.
-- Datos sinteticos de _fixtures.sql: grupo 5B (lun 09:00-10:00, docente2@), sesion manual ABIERTA del 14-sep-2026,
-- A004 inscrito en 5B; A002 NO inscrito en 5B. Todo corre en una transaccion que termina en ROLLBACK.
BEGIN;
SELECT t.begin('reporte_02_integracion_manual');
SELECT t.cargar_fixtures();
SELECT t.reloj('2026-09-14 09:14:00-06');   -- reloj controlado: minuto 14 de la sesion

CREATE TEMP TABLE r (k text PRIMARY KEY, v jsonb);
GRANT ALL ON r TO PUBLIC;

-- Ejecutar como el docente titular; sin estado explicito, con hora de marcado 09:12 (minuto 12).
SELECT t.as_user('docente2@susan.test');
INSERT INTO r SELECT 'resp', public.api_registrar_manual(
    t.id_sesion('5B', DATE '2026-09-14'), t.id_alumno('A004'), NULL, '2026-09-14 09:12:00-06');
SELECT t.as_postgres();

-- Verificar la respuesta de la RPC
SELECT t.eq((SELECT v ->> 'estado' FROM r WHERE k = 'resp'), 'retardo', 'IT-01a: respuesta estado = retardo (minuto 12)');
SELECT t.eq((SELECT v ->> 'origen' FROM r WHERE k = 'resp'), 'manual', 'IT-01b: respuesta origen = manual');
SELECT t.eq((SELECT v ->> 'creado' FROM r WHERE k = 'resp'), 'true', 'IT-01c: respuesta creado = true');

-- Verificar el efecto persistido
SELECT t.eq(t.n($$ SELECT 1 FROM public.asistencia
                   WHERE id_sesion = t.id_sesion('5B', DATE '2026-09-14') AND id_alumno = t.id_alumno('A004')
                     AND estado = 'retardo' AND origen = 'manual'
                     AND hora_registro = '2026-09-14 09:12:00-06'::timestamptz $$), 1,
            'IT-01d: un registro persistido con estado retardo, origen manual y hora 09:12');

-- Alumno sin inscripcion activa en el grupo: se rechaza y no se persiste nada.
-- La sentencia se arma como postgres: el docente2 no ve por RLS al alumno A002 de otro grupo.
INSERT INTO r SELECT 'sql', to_jsonb(format($q$ SELECT public.api_registrar_manual(%s, %s, 'presente', '2026-09-14 09:05:00-06') $q$,
                       t.id_sesion('5B', DATE '2026-09-14'), t.id_alumno('A002')));
SELECT t.as_user('docente2@susan.test');
SELECT t.throws((SELECT v #>> '{}' FROM r WHERE k = 'sql'),
                'P0001:ALUMNO_NO_INSCRITO', 'IT-01e: alumno no inscrito en 5B -> ALUMNO_NO_INSCRITO');
SELECT t.as_postgres();
SELECT t.eq(t.n($$ SELECT 1 FROM public.asistencia
                   WHERE id_sesion = t.id_sesion('5B', DATE '2026-09-14') AND id_alumno = t.id_alumno('A002') $$), 0,
            'IT-01f: no se persistio registro del alumno no inscrito');

SELECT t.summary();
ROLLBACK;
```

- **Preparación y limpieza:** `scripts/test-sql.sh` crea una BD temporal con nombre único (`susan_test_<pid>_<n>`), aplica las migraciones, el arnés y los fixtures, y la elimina al terminar. Además, el archivo corre en una transacción con `ROLLBACK`. No toca la base de desarrollo ni la de producción.
- **Por qué es integración:** la RPC pública, el núcleo de registro, las funciones de clasificación y la tabla con sus restricciones se ejecutan juntas. Se verifican tanto la respuesta como la fila persistida, y ningún colaborador de negocio está simulado.

### IT-02 — Regresión por mínimos cuadrados → búsqueda del cruce del límite

- **Objetivo:** comprobar que el ajuste de tendencia y la búsqueda de raíces, encadenados como lo hace `analizarGrupo`, producen la semana de cruce correcta.
- **Componentes reales:**
  - `ajustePolinomial` (`regression/minimosCuadrados.js`): resuelve las ecuaciones normales con `eliminacionGaussiana`.
  - `buscarCruce` (`forecast/cruce.js`): usa `biseccion` y `newtonRaphson` (`rootfinding/metodos.js`).
  - Dobles: ninguno.
- **Precondiciones y datos sintéticos:** porcentaje acumulado de ausentismo `[3, 5, 7, 9, 11, 13]` en las semanas 1 a 6, que es exactamente la recta y = 1 + 2t; límite de 20 %; horizonte de la semana 6 a la 16.

| Entrada | Interacción | Resultado esperado |
|---|---|---|
| `ajustePolinomial([1..6], [3,5,7,9,11,13], 1)` | Mínimos cuadrados + Gauss producen `predecir` y `derivada` | `r² ≈ 1`, `predecir(6) ≈ 13`, `derivada(6) ≈ 2` |
| `buscarCruce(ajuste, 20, { desde: 6, hasta: 16 })` | Usa el modelo ajustado para barrer el horizonte, aplicar bisección y contrastar con Newton | `estado 'cruza'`, `t ≈ 9.5`, `semana 10`, bisección convergida, raíz de Newton ≈ 9.5 |

**Código de la prueba** (`web/src/lib/numerics/reporte.integracion.test.js`):

```js
// Reporte de pruebas · IT-02: regresion por minimos cuadrados (con Gauss) -> busqueda del cruce (biseccion y Newton).
// Mismo encadenamiento que usa analizarGrupo; ningun colaborador esta simulado.
import { describe, expect, it } from 'vitest';
import { ajustePolinomial } from './regression/minimosCuadrados.js';
import { buscarCruce } from './forecast/cruce.js';

describe('IT-02 ajustePolinomial + buscarCruce', () => {
    it('una serie sintetica exactamente lineal (y = 1 + 2t) cruza el 20 % en t = 9.5, semana 10', () => {
        // Preparar: ausentismo acumulado (%) de las semanas 1 a 6
        const semanas = [1, 2, 3, 4, 5, 6];
        const acumulado = [3, 5, 7, 9, 11, 13];

        // Ejecutar: ajuste real de grado 1 y busqueda real del cruce sobre ese ajuste
        const ajuste = ajustePolinomial(semanas, acumulado, 1);
        const cruce = buscarCruce(ajuste, 20, { desde: 6, hasta: 16 });

        // Verificar: el ajuste reproduce la recta y el cruce es la solucion de 1 + 2t = 20
        expect(ajuste.r2).toBeCloseTo(1, 9);
        expect(ajuste.predecir(6)).toBeCloseTo(13, 9);
        expect(ajuste.derivada(6)).toBeCloseTo(2, 9);
        expect(cruce.estado).toBe('cruza');
        expect(cruce.t).toBeCloseTo(9.5, 6);
        expect(cruce.semana).toBe(10);
        expect(cruce.biseccion.convergio).toBe(true);
        expect(cruce.newton.raiz).toBeCloseTo(9.5, 6);
    });
});
```

- **Preparación y limpieza:** no aplica. Son funciones puras, sin base de datos, red ni reloj.
- **Por qué es integración:** el modelo que consume `buscarCruce` no es un doble, sino el objeto real que produce `ajustePolinomial`. Si cambiara el contrato entre ambos (`predecir`, `derivada`, escalado de la variable), la prueba fallaría. El esperado se despeja a mano: 1 + 2t = 20 ⇒ t = 9.5, y la semana entera en que se alcanza el límite es la 10.

## 5. Ejecución y evidencia

Las pruebas se ejecutaron el 13-nov-2026 en la máquina de desarrollo, con la BD temporal y los datos sintéticos.

| Caso | Tipo | Resultado esperado | Resultado observado | Estado |
|---|---|---|---|---|
| UT-01 | Unitaria (SQL) | `presente` (min 5) y `retardo` (min 15) | Iguales al esperado (2 aserciones `ok`) | Aprobada |
| UT-02 | Unitaria (SQL) | `presente`, `retardo`, `retardo` y `NULL` en 9.99, 10, 20 y 20.01 | Iguales al esperado (4 aserciones `ok`) | Aprobada |
| UT-03 | Unitaria (JS) | `ausentes 1, retardos 3, justificados 1, faltasEq 2` | Igual al esperado | Aprobada |
| UT-04 | Unitaria (JS) | `faltasEq 0` (2 retardos) y `1` (5 retardos) | Igual al esperado (2 casos parametrizados) | Aprobada |
| UT-05 | Unitaria (JS) | `cruza`, `t ≈ 10`, semana 10 | Igual al esperado | Aprobada |
| UT-06 | Unitaria (JS) | `RangeError` con el mensaje documentado | Igual al esperado | Aprobada |
| IT-01 | Integración (SQL) | Respuesta `retardo/manual/creado`, 1 fila persistida; rechazo `ALUMNO_NO_INSCRITO` y 0 filas | Iguales al esperado (5 positivas + 1 negativa esperada) | Aprobada |
| IT-02 | Integración (JS) | `r² ≈ 1`, `t ≈ 9.5`, semana 10, bisección y Newton convergen | Igual al esperado | Aprobada |

**Comandos y salida real:**

```
$ scripts/test-sql.sh reporte_
ok    reporte_01_estado_por_minuto.sql         pos=6 neg=0
ok    reporte_02_integracion_manual.sql        pos=5 neg=1
----
archivos=2 con_fallas=0 | pruebas positivas=11 negativas=1 fallos=0
```

```
$ cd web && npx vitest run src/lib/numerics/reporte.unitarias.test.js src/lib/numerics/reporte.integracion.test.js
 Test Files  2 passed (2)
      Tests  6 passed (6)
```

En `pos=5 neg=1`, `neg` es una aserción **negativa esperada** (que la RPC lance un error), no una falla. Vitest cuenta 6 pruebas porque UT-04 es parametrizada (2 casos) y IT-02 es una sola. `npx eslint` no reportó problemas en los archivos nuevos.

**Hallazgos durante la ejecución:**

1. **Defecto en la prueba, no en el sistema.** La primera ejecución de IT-01 falló en el caso IT-01e con `sqlstate=42601 … syntax error at or near ","`. La sentencia buscaba el id de A002 cuando ya se actuaba como `docente2`. La seguridad por filas oculta a ese alumno (es de otro grupo), así que la búsqueda devolvió `NULL` y la sentencia quedó mal formada. Se corrigió armando la sentencia como `postgres` antes de cambiar de usuario. El esperado (`ALUMNO_NO_INSCRITO`) no se modificó.
2. **Entrada no validada (observación, sin prueba).** `resumirAsistencia` no valida `rpa`. Con `rpa = 0` devuelve `faltasEq = Infinity` si hay retardos y `NaN` si no los hay. La especificación no define ese caso, por lo que no se inventó un esperado. Una posible corrección sería validar `rpa > 0` con `validarNumero`, como hacen las demás funciones del módulo; no se aplicó.

## 6. Conclusión breve

La muestra comprueba que tres reglas de SUSAN están implementadas como las describe la especificación:

- **Clasificación por minuto (RN-03):** incluidas sus fronteras en 10 y 20 minutos.
- **Faltas equivalentes (RN-10):** con redondeo hacia abajo.
- **Semana de cruce del límite de 20 %:** mediante bisección y Newton, y encadenada con la regresión por mínimos cuadrados.

También comprueba que el pase manual persiste un único registro con origen `manual` y rechaza a un alumno sin inscripción activa. El alcance se limita a ocho casos con datos sintéticos y a una BD temporal. No se probaron el reconocimiento facial, la captura desde la Raspberry Pi, el cierre de sesión, los justificantes ni la interfaz. La estimación de tendencia se verificó solo con series exactamente lineales y es informativa: no equivale a faltas confirmadas. Por eso estos resultados no validan SUSAN en su conjunto ni la precisión del reconocimiento en un aula real.
