# F09 · Margen para imprevistos («¿Y si falto?»)

**Decisiones clave**
- **Una sola fuente de la regla.** RN-10 y RN-11 hoy se calculan dentro de `v_resumen_asistencia` (0100), con una segunda copia en `api_serie_alumno` (0103). Esa aritmética pasa a funciones SQL puras, que serán el motor de F07, F24, F31 y de este simulador. Las columnas de la vista no cambian, y una prueba cruzada exhaustiva compara las funciones con la fórmula original.
- **Primero solo lectura (cumple RF-21), después el simulador.** El simulador solo admite **una falta equivalente hipotética**: una ausencia, o el retardo que completa un bloque de tres. Lo controla el parámetro 15 `simulador_margen_activo`, que funciona como interruptor para apagarlo.
- **El nombre visible no es «¿Y si falto?».** El botón dice «Mi margen» (icono Lucide `Umbrella`) y el panel, «Margen para imprevistos». «¿Y si falto?» se queda como nombre interno.
- **Sin semana de cruce para el alumno.** La proyección va dentro de `Detalles`, contada en clases y faltas («en unas 13 clases»), siempre como «estimación».
- **El «plazo para justificar» no existe en el sistema.** `api_registrar_justificante` no tiene límite de tiempo, y RN-08 es el plazo del docente para corregir. En las fases 1 y 2 el panel dice «aún se puede justificar», sin fecha. El plazo queda como fase 3 y necesita una RN nueva.

---

## 1. Concepto y momento wow

El alumno abre «Mi margen» en una materia. Primero tiene que **adivinar** cuántas faltas lleva; al revelar, el tanque (`MedidorLiquido`) se llena hasta «3 de 9» y aparece la frase «Llevas 6, no 4». En la fase 2 toca «lun 21» como *Tarde*: tres puntos de retardo se funden en una falta, el tanque baja chapoteando a «2 de 9» y la frase dice «Ojo: llevas 2 retardos sueltos; este completaría una falta». «Justificar ahora» abre el formulario con la falta del vie 11 ya elegida.

Es el calendario real del alumno con la regla oficial, la misma que decide el derecho a examen. Nada se guarda.

## 2. Flujo de usuario

No hay ruta nueva: todo ocurre en un panel dentro de **`/alumno`** (`src/app/(app)/alumno/page.jsx`). Se agrega el enlace profundo `?margen` (materia activa) o `?margen=<id_grupo>`, que se lee igual que el `?justificar=` que ya existe. Sirve para el registro de módulos, la paleta ⌘K y los futuros Comunicados y Notificaciones. El escenario **nunca** viaja en la URL.

| Paso | Qué ve y hace | 360 px | Escritorio |
|---|---|---|---|
| **A. Tarjeta de materia** (`alumno/ResumenMaterias` → `Tarjeta`) | Junto a «Ver historial» aparece el botón secundario **«Mi margen»** (`Umbrella`, `aria-label="Mi margen para imprevistos en Administración Financiera"`). Al pasar el cursor o enfocar el botón se precarga el fragmento diferido. | Los dos botones se acomodan (`flex-wrap`) bajo el nombre de la materia; mínimo 40 px de alto. | En línea con «Ver historial». |
| **B. Adivina** (la primera vez por materia y semana) | `PanelLateral` con el título «Margen para imprevistos» y la descripción «Administración Financiera · 3A». Pregunta: «Antes de ver tu cifra: ¿cuántas faltas crees que llevas?». `Pills` del 0 a `faltas_maximas_permitidas + 3`; luego «Revelar» (primario) o «Saltar». | `PanelLateral` ocupa toda la pantalla (no existe la hoja inferior; ver §7). Las 13 píldoras ocupan 2 filas. | Panel `md` a la derecha. |
| **C. Revela** | Se monta el `MedidorLiquido` y su animación de entrada ES la revelación. A la derecha: «3 de 9», «faltas de margen». Debajo, la frase de contraste («Llevas 6, no 4…») y la frase de encuadre («Guárdalo para lo que no controlas: salud, transporte, trámites»). | Tanque de 72×144; la cifra va al lado y baja bajo el tanque si no cabe (el `flex-wrap` del medidor). | Tanque de 88×176. |
| **D. Pills de preguntas** | `Mi margen` (por omisión) · `Qué puedo justificar` (con conteo) · `¿Voy bien?`. Filtran el bloque inferior; no son pestañas. | Una fila (3 píldoras de ~100 px). | Igual. |
| **D1. Mi margen** | Conteo en faltas, no en porcentaje: «Llevas 6 faltas: 6 ausencias. Tus 2 retardos aún no suman (3 retardos = 1 falta)». `FusionRetardos` muestra ●●○. En la **fase 2** se agrega debajo «Prueba un imprevisto»: las próximas 8 sesiones reales en mosaicos que empiezan en «Asisto». | Mosaicos en 4×2, de ~66 px de ancho cada uno. | 8 en una fila. |
| **D2. Qué puedo justificar** | Lista de faltas y retardos del grupo que todavía se pueden justificar, cada una con su efecto calculado en SQL: «vie 11 · Falta · si te la aprueban, recuperas 1». Botón **«Justificar ahora»**, que cierra el panel, llama a `usePortalAlumno.justificar({ id_sesion })` y lleva a la sección Justificantes con la sesión preseleccionada (flujo actual de `RegistrarJustificanteForm idSesion`). | Lista con `TarjetaFila` y `StatusChip` sm. | Igual. |
| **D3. ¿Voy bien?** | `Detalles` con `montarAlAbrir` («¿Voy bien a este ritmo? · estimación»). Monta de forma diferida `ProyeccionAlumno`: «A tu ritmo de las últimas 8 clases (1 de cada 4) cerrarías el periodo con unas 13 faltas (estimación; entre 11 y 16). El límite es 9: si nada cambia, lo alcanzarías en unas 13 clases. Cada clase a la que llegas cambia esta cifra.» Adentro, otra sección plegable: «Ver el cálculo». | Texto y tabla de 8 filas dentro de su contenedor. | Igual. |
| **E. Cerrar** | Pie fijo: «Cerrar» y una nota gris: «Nada de esto se guarda». Al cerrar se borra el escenario. | | |

Proyector: no aplica. Es una vista personal y no se proyecta en el aula. En la demo se refleja el teléfono o se usa el panel de escritorio.

Estados vacíos y de error:
- Sin sesiones programadas: «Aún no hay sesiones programadas».
- Sin sesiones futuras: «Tu grupo ya no tiene clases por delante» (la fase 2 oculta la tira).
- Menos de 4 sesiones cerradas: «Aún no hay suficientes clases para estimar» (contrato de §2.2).
- Inscripción en baja: el botón no aparece.

## 3. Datos

### 3.1 Lo que ya existe y se usa
- **Tablas:** `inscripcion` (estatus, derecho_examen), `sesion_clase` (fecha, hora_inicio/fin, estatus `programada|abierta|cerrada|suspendida`), `asistencia` (estado), `justificante` (estatus), `grupo`, `materia`, `parametro_sistema`.
- **Vista:** `v_resumen_asistencia` (faltas_equivalentes, ausencias, retardos, justificadas, pendientes, faltas_maximas_permitidas, faltas_restantes_antes_limite, supera_limite, en_limite, sesiones_programadas, que **incluye las futuras**, así que el límite ya es fijo).
- **RPC:** `api_alumno_resumen` (tarjetas), `api_serie_alumno` en modo propio (proyección; hoy **no tiene consumidor** en pantalla: solo existe su envoltorio `serieAlumno`), `api_alumno_historial` (`puede_justificar`), `api_parametros_publicos` (retardos_por_ausencia, porcentaje_max_ausencias y la bandera nueva), y `api_validar_justificante`/`api_registrar_justificante` (sin cambios).
- **RLS:** `participante_ve_sesiones_de_sus_grupos` ya deja que el alumno lea las `sesion_clase` de sus grupos; `alumno_ve_lo_propio` cubre la asistencia. **No hace falta ninguna política nueva.**
- **Ayudantes:** `app.param_num`, `app.id_alumno`, `app.exigir_rol`, `app.fallar`, `app.hoy`, `app.now` (respeta el reloj de demostración), `app.c1_limite`.

### 3.2 Migración `0104_margen_reglas.sql` (db-api-a): extraer la regla
```sql
-- Regla RN-10/RN-11 en un solo lugar. IMMUTABLE y sin tablas: la usan la vista, api_serie_alumno,
-- api_simular_margen y (F07/F24/F31) cualquier RPC futura. search_path fijo (convención de 0010).
CREATE FUNCTION app.faltas_equivalentes(p_aus integer, p_ret integer, p_rpa numeric) RETURNS integer
    LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = pg_catalog, pg_temp
AS $$ SELECT p_aus + CASE WHEN p_rpa >= 1 THEN floor(p_ret / p_rpa)::integer ELSE 0 END $$;

CREATE FUNCTION app.margen_asistencia(p_aus integer, p_ret integer, p_n integer, p_rpa numeric, p_pct numeric)
RETURNS TABLE (faltas_equivalentes integer, porcentaje_faltas numeric, faltas_maximas_permitidas integer,
               supera_limite boolean, en_limite boolean, faltas_restantes_antes_limite integer,
               retardos_sueltos integer)
    LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = pg_catalog, pg_temp
AS $$
    SELECT b.fe,
           CASE WHEN p_n > 0 THEN round(100.0 * b.fe / p_n, 2) END,
           b.fm,
           b.fe * 100 > p_pct * p_n,                                   -- exactamente el límite conserva (RN-11)
           p_n > 0 AND b.fe * 100 <= p_pct * p_n AND b.fm - b.fe <= 0,
           CASE WHEN b.fe * 100 > p_pct * p_n THEN 0 ELSE greatest(b.fm - b.fe, 0) END,
           CASE WHEN p_rpa >= 1 THEN mod(p_ret, p_rpa::integer) ELSE 0 END
      FROM (SELECT app.faltas_equivalentes(p_aus, p_ret, p_rpa) AS fe,
                   floor(p_pct * p_n / 100)::integer AS fm) b
$$;
GRANT EXECUTE ON FUNCTION app.faltas_equivalentes(integer, integer, numeric),
      app.margen_asistencia(integer, integer, integer, numeric, numeric) TO authenticated, service_role;
```
- **Vista:** `CREATE OR REPLACE VIEW public.v_resumen_asistencia` con el mismo FROM y un `CROSS JOIN LATERAL app.margen_asistencia(ac.ausencias, ac.retardos, sp.n, p.retardos_por_ausencia, p.limite_pct) m`. Las **mismas columnas en el mismo orden y del mismo tipo**: `porcentaje` sigue siendo un alias duplicado de `porcentaje_faltas` y `retardos_sueltos` **no** se expone. Así `app.c1_resumen_json`, los `%ROWTYPE` y `app.recalcular_inscripcion` siguen igual sin tocarlos.
- **`api_serie_alumno`:** la expresión copiada se reemplaza por `app.faltas_equivalentes(q.aus, q.ret, v_rpa)`.
- **Rendimiento:** con `SET search_path` el planificador no puede incrustar (inline) la función. Se mide con `EXPLAIN ANALYZE` de `api_reporte_periodo` antes y después sobre la semilla de demostración. Si empeora más de 10 %, se documenta en DECISIONS una excepción sin `SET`, usando nombres calificados con `pg_catalog`.
- **Opcional, en la misma migración:** extraer el predicado «se puede justificar», hoy repetido en `api_alumno_historial.puede_justificar`, `api_mis_justificables` y `app.validar_destino_justificante`, a `app.asistencia_justificable(p_id_sesion, p_id_alumno)`.

### 3.3 Migración `0105_api_margen_alumno.sql` (db-api-a): dos RPC nuevas

**`api_mis_proximas_sesiones(p_id_grupo integer, p_n integer DEFAULT 8) RETURNS jsonb`** · `STABLE SECURITY INVOKER`
- `app.exigir_rol('alumno')`. Exige una inscripción **activa** propia en el grupo; si no la hay, `NO_AUTORIZADO`.
- Filtra `s.id_grupo = p_id_grupo AND s.estatus = 'programada' AND s.fecha >= app.hoy()`, ordena por fecha y hora y limita a `p_n` (de 1 a 16).
- Las sesiones salen de `api_generar_sesiones` (RN-06), que es la verdad del calendario: no se recalcula nada desde `horario_grupo`. Se descartó agregar una opción a `api_alumno_historial`, porque cambiaría su `total` y la paginación de las que dependen `HistorialMateria` y `CalendarioRacha`.
```json
{ "id_grupo": 12, "hoy": "2026-09-14", "restantes": 27,
  "items": [ { "id_sesion": 501, "fecha": "2026-09-18", "dia_semana": 5, "hora_inicio": "07:00:00", "hora_fin": "08:00:00" } ] }
```

**`api_simular_margen(p_id_grupo integer, p_escenario jsonb DEFAULT '[]') RETURNS jsonb`** · `STABLE SECURITY INVOKER`
- No puede escribir: PostgreSQL rechaza un `INSERT` dentro de una función STABLE, y PostgREST además la ejecuta en una transacción de solo lectura.
- Lee la fila propia de `v_resumen_asistencia`. `real` = `app.margen_asistencia` con los conteos reales, más `pendientes`, `justificadas` y `derecho_examen`.
- **El escenario** es un arreglo de `{ id_sesion, estado: presente|retardo|ausente }`. Validaciones:
  - Arreglo de 16 elementos como máximo, `id_sesion` sin repetir.
  - Cada sesión ∈ las de `api_mis_proximas_sesiones` (programada, del grupo, `fecha >= hoy`).
  - **Cota de la fase 2:** `simulado.faltas_equivalentes - real.faltas_equivalentes <= 1`, o `ESCENARIO_INVALIDO` con el HINT «Prueba un imprevisto a la vez».
  - Si el escenario no está vacío y `simulador_margen_activo = 0`: `SIMULADOR_NO_DISPONIBLE`.
- **`simulado`** = `app.margen_asistencia(aus + #ausente, ret + #retardo, n, rpa, pct)`. `n` no cambia porque las futuras ya están en el denominador; por eso la simulación es pura aritmética.
- **`efectos`:** recorrido cronológico de las entradas con sus acumulados. Marca `completa_falta` (el retardo que cierra un bloque) y `pierde_derecho` (la entrada en la que `supera_limite` pasa a verdadero).
- **`tabla`:** solo con la bandera encendida. Lista todas las combinaciones alcanzables dentro de la cota (`ausencias_extra` ∈ {0,1} × `retardos_extra` ∈ 0..min(8, 2·rpa)), calculadas con la misma función. Así la interfaz responde **al instante** a cada toque, aunque la red sea lenta, sin copiar la regla en JS (ver §4.2).
- **`justificables`:** las del grupo con el mismo predicado que `puede_justificar`. Cada una trae `recupera_falta`, que se evalúa de una en una: en una ausencia siempre es verdadero; en un retardo, solo si `mod(ret, rpa) = 0`.
```json
{ "id_grupo": 12, "hoy": "2026-09-14", "simulador_activo": true,
  "reglas": { "retardos_por_ausencia": 3, "limite_pct": 20, "sesiones_programadas": 47 },
  "real":     { "ausencias": 6, "retardos": 2, "justificadas": 0, "pendientes": 1, "faltas_equivalentes": 6,
                "faltas_maximas_permitidas": 9, "faltas_restantes_antes_limite": 3, "supera_limite": false,
                "en_limite": false, "retardos_sueltos": 2, "derecho_examen": true },
  "simulado": { "...mismas claves...": 0, "faltas_equivalentes": 7, "faltas_restantes_antes_limite": 2, "conservaria_derecho": true },
  "efectos":  [ { "id_sesion": 502, "fecha": "2026-09-21", "estado": "retardo", "completa_falta": true, "pierde_derecho": false } ],
  "tabla":    [ { "ausencias_extra": 0, "retardos_extra": 1, "faltas_equivalentes": 7, "faltas_restantes_antes_limite": 2,
                  "supera_limite": false, "en_limite": false, "retardos_sueltos": 0 } ],
  "justificables": [ { "id_sesion": 488, "fecha": "2026-09-11", "estado": "ausente", "recupera_falta": true, "tiene_rechazado": false } ] }
```
- **Errores:** `NO_AUTORIZADO` (rol distinto de alumno, grupo ajeno o inscripción en baja), `ESCENARIO_INVALIDO` (422), `SIMULADOR_NO_DISPONIBLE` (409).
- **Roles:** solo el alumno, sobre lo propio. Si F24 o F31 necesitan la versión para docente o tutor, se agrega `p_id_alumno` con el mismo patrón de `api_serie_alumno`. Fuera de alcance aquí.

### 3.4 Parámetro y triggers
- **`0242_parametro_simulador.sql` (db-api-b, dueño de `app.parametro_meta` desde 0240):** `(15, 'simulador_margen_activo', 'entero', '0', '1', 'bandera')`, valor inicial `'0'`. El administrador lo enciende con `api_parametro_actualizar` y queda en bitácora como `cambio_parametro`.
- **Sin tablas, triggers ni políticas RLS nuevas.**

### 3.5 Prueba cruzada `supabase/tests/api_c_21_margen.sql`
1. **Rejilla exhaustiva** contra la fórmula original de 0100, copiada literalmente en la prueba como «oráculo». Recorre aus 0..15 × ret 0..15 × n ∈ {0, 1, 5, 44, 45, 47, 48, 50} × rpa ∈ {1, 2, 3, 10} × pct ∈ {1, 20, 33, 100}, unas 33 000 combinaciones, y exige igualdad en las 6 salidas.
2. **Vista contra RPC:** para cada inscripción de `api_c_escenario.inc`, actuando como su alumno, `api_simular_margen(g,'[]')`: `real` = `c1_resumen_json(v)` en las claves comunes, y `simulado` = `real`.
3. **Realidad:** dentro de un `SAVEPOINT` se simula `{s1: retardo, s2: ausente}`, se aplican esas mismas sesiones como registros reales (cierre más corrección, con los ayudantes de `api_c_00_recalculo`), se compara `v_resumen_asistencia` con `simulado` y `inscripcion.derecho_examen` con `conservaria_derecho`, y se hace `ROLLBACK TO SAVEPOINT`.
4. **Rechazos:** sesión cerrada en el escenario, sesión de otro grupo, duplicados, +2 faltas equivalentes, alumno ajeno, docente, bandera apagada.
5. `SET TRANSACTION READ ONLY` y llamar a la RPC no falla (demuestra que no escribe).

### 3.6 Bloqueador: plazo para justificar (fase 3 opcional)
Si la coordinación lo decide, se agrega una **RN-14** con el parámetro 16 `horas_limite_justificante`, `app.limite_justificante(fecha, hora_fin)` (análoga a `app.limite_correccion`) y la comprobación en `app.validar_destino_justificante`, que devolvería `JUSTIFICANTE_FUERA_DE_PLAZO` (422).

Es un cambio de comportamiento sobre RF-12, no de presentación: requiere su sección en DECISIONS y avisar a screens-revision. Sin esa RN, el panel nunca menciona una fecha límite.

## 4. Cálculo

**4.1 Regla (SQL).** Faltas equivalentes = ausencias + ⌊retardos / 3⌋. Máximo = ⌊20 · n / 100⌋. Se pierde el derecho si faltas · 100 > 20 · n.

Ejemplo E260021 (3A, n = 47): 6 ausencias + ⌊2/3⌋ = **6**; máximo ⌊9.4⌋ = **9**; margen **3**; retardos sueltos 2.
- Un retardo hipotético: ⌊3/3⌋ = 1, faltas = 7, margen 2, `completa_falta`.
- Una ausencia hipotética: faltas = 7, margen 2.
- Retardo y ausencia juntos (+2): fuera de la cota.

**4.2 Respuesta instantánea sin copiar la regla en JS.** Al abrir el panel, una llamada `api_simular_margen(g,'[]')` trae la `tabla`. Cada toque cuenta (ausencias_extra, retardos_extra) y **busca** la fila. La frase «completaría una falta» sale de comparar dos filas de la tabla, no de calcular nada.

Después, `useDebounce(escenario, 250)` confirma con el escenario real y obtiene `efectos` con fechas. Si la confirmación no coincidiera con la tabla, manda el servidor (más un aviso solo en desarrollo). Si no hay red, la tabla ya dio la respuesta correcta. Esto pesa en Android de gama media con conectividad variable.

**4.3 Proyección (`ProyeccionAlumno`, contrato de reportes-analitica §2.2).** Función nueva `web/src/lib/numerics/forecast/proyeccionAlumno.js` (zona numerics):
```js
// Entrada: serie de api_serie_alumno. x = índice de sesión cerrada, y = faltas_equivalentes_acumuladas.
proyeccionAlumno({ sesiones, sesionesProgramadas, limitePct, faltasActuales, ventana = 8, minimo = 4 })
// < minimo cerradas -> { suficiente: false }
// tramo = últimas `ventana`; pr = proyectarSerie({ x, y, horizonte: sesionesProgramadas - m, grados: [1] })
// cierre = último punto, acotado a [faltasActuales, faltasActuales + restantes] (el acumulado no baja ni sube más de 1 por clase)
// umbral = limitePct * sesionesProgramadas / 100 (se supera con > umbral)
// cruce = buscarCruce(pr.modelo, umbral, { desde: m, hasta: sesionesProgramadas }) -> sesionesHasta = ceil(t - m)
// -> { suficiente, ritmo, cierre: { valor, inferior, superior }, cruce: { estado, sesionesHasta }, procedimiento }
```
- **Solo grado 1:** sobre un acumulado escalonado, un cuadrático extrapola su curvatura 28 clases hacia adelante, y con 8 puntos la selección por validación cruzada LOO es inestable.
- **El intervalo** es el de `intervaloPrediccion`: aproximado, porque los residuos de un acumulado están correlacionados. Así se dice en «Ver el cálculo».
- **E260021**, con la ventana 4,5,5,5,5,6,6,6: pendiente ≈ 0.26 faltas por clase («1 de cada 4»), cierre ≈ 13 o 14, cruce en unas 12 o 13 clases. Bisección y Newton salen en la traza.
- **Coherencia con el docente:** el factor 5 de `risk/evaluarRiesgoAlumno` usa el ritmo de todo el periodo (6/19 ≈ 0.32). Se pide a numerics que ese factor use `proyeccionAlumno`, para que alumno y docente nunca vean estimaciones distintas.

## 5. Interfaz

**Se reutilizan:**
- **ui:** `ui/MedidorLiquido` (permitido en la vista del alumno; chapotea al cambiar `valor`), `ui/PanelLateral`, `ui/Pills`, `ui/StatusChip`, `ui/Detalles` (`montarAlAbrir`), `ui/TarjetaGrafica` (con `resumen` «Te quedan 3 de 9 faltas antes del límite»), `ui/TarjetaFila`, `ui/Alert`, `ui/Button`, `ui/DataState`, `ui/EmptyState`.
- **motion y lib/motion:** `motion/CountUp`, `lib/motion` (`usePrefersReducedMotion`, `useEnVista`).
- **hooks:** `hooks/data/useApiQuery.js` (importación directa, sin el barril), `hooks/ui/useDebounce`.
- **alumno:** `alumno.utils` (`UMBRAL_AVISO_FALTAS`, `avisoMateria`) y `usePortalAlumno.justificar`.

**Componentes nuevos (zona screens-reportes):**
```
web/src/components/alumno/MargenImprevistos/
    MargenImprevistos.jsx          # PanelLateral + Suspense; se importa con React.lazy desde PortalAlumno al abrir
    ContenidoMargen.jsx            # medidor, Pills, secciones (fragmento diferido)
    useMargenImprevistos.js        # simularMargen('[]') + misProximasSesiones; escenario en memoria; búsqueda en la tabla; confirmación a 250 ms
    AdivinaRevela.jsx              # paso «adivina y revela» (modo individual de F10)
    FusionRetardos.jsx             # puntos de retardos sueltos; tres se funden en una falta
    TiraImprevistos.jsx            # fase 2: 8 mosaicos Asisto -> Tarde -> Falta -> Asisto, saltando estados fuera de la cota
    margenImprevistos.utils.js     # SOLO frases y formato (sin aritmética de la regla): fraseMargen, fraseEfecto, fraseContraste, diaCorto
    MargenImprevistos.test.jsx · margenImprevistos.utils.test.js · index.js
web/src/components/alumno/ProyeccionAlumno/
    ProyeccionAlumno.jsx           # texto de la estimación + «Ver el cálculo»; importa proyeccionAlumno.js directo (no el barril de numerics)
    ProyeccionAlumno.test.jsx · index.js
```
- **`MedidorLiquido` (petición a ui-kit):** prop opcional `cifra` (nodo) y `textoValor`, para mostrar «3 de 9» en lugar del `CountUp` en %. `valor` = restantes / máximo · 100. Tono `presente` si el margen es mayor que 2, `retardo` si es de 1 a 2 y `ausente` si es 0 o superó el límite.
- **Fechas:** «vie 18» se arma con `dia_semana` del servidor más el día del texto `YYYY-MM-DD`, nunca con `new Date(fecha)` (evita el desfase UTC y los errores de hidratación). El «hoy» sale de la RPC, no del navegador.
- **Accesibilidad:**
  - Cada mosaico es un `<button>` con `aria-label="viernes 18: asisto. Cambiar"`.
  - Una región `aria-live="polite"` anuncia la frase resultante.
  - El medidor es `role="meter"` con el texto «3 de 9 faltas de margen».
  - Nunca se usa solo el color: cada estado lleva su etiqueta de texto.
- **Movimiento:** la fusión usa solo `transform`/`opacity` y dura unos 400 ms. Con «reducir movimiento» el cambio es instantáneo y el tanque aparece ya lleno.
- **Peso:**
  - Lo único estático en `/alumno` es el botón; todo el panel y `proyeccionAlumno` cargan con `React.lazy` (patrón de DECISIONS §7) y se precargan al pasar el cursor o enfocar.
  - Meta: el JS inicial de `/alumno` crece menos de 1 KB gz (`scripts/measure-bundle.mjs`). Hoy está en +21,3 %.
- **localStorage**, solo como comodidad (envuelto en try/catch): la clave `susan.margen.adivino.<id_grupo>.<semana>` evita repetir la adivinanza en la misma semana. No guarda cifras.

## 6. Privacidad, ética y mitigaciones

- **Solo lo propio:**
  - `exigir_rol('alumno')` + `app.id_alumno()`, la vista con `security_invoker` y RLS. No hay parámetro de alumno.
  - Nunca muestra puntaje, probabilidad, ranking ni comparación con compañeros.
  - Cumple LFPDPPP: no se recolecta ningún dato nuevo. La adivinanza no sale del navegador y el escenario no se guarda ni se registra; sigue la Decisión 8 de que las lecturas STABLE no asientan bitácora.
- **Contra el incentivo perverso:**
  - **Nombre:** «Margen para imprevistos», nunca «faltas disponibles». Se propone además cambiar en `ResumenMaterias` «de 9 faltas permitidas» por «de 9 antes del límite».
  - **Arranque:** siempre en «si asistes».
  - **Cota:** una sola falta equivalente hipotética, validada en SQL. No hay botón para planear faltas ni para exportar fechas.
  - **Neutralidad:** nunca resalta qué día «conviene» faltar, y un retardo que no completa falta jamás se presenta como «gratis». La frase es «1 retardo suelto más (3 = 1 falta)».
  - **Frases según el margen:**
    - Amplio (más de 2): «Guárdalo para lo que no controlas: salud, transporte, trámites».
    - Corto (1 o 2): «Tu margen es corto: si surge algo, justifícalo».
    - En el límite: el aviso actual de `avisoMateria`.
    - Superado: «Sin derecho a examen. Si te aprueban justificantes puedes recuperarlo» (solo si algún `recupera_falta` lo hace posible; si no, «Habla con tu docente o tutor»). RN-11 es reversible.
- **La proyección no es una sentencia:** va dentro de `Detalles`, en clases y no en semanas, siempre marcada «estimación» y con su intervalo. Termina con «Cada clase a la que llegas cambia esta cifra».
- **Honestidad del límite:** en «Ver el cálculo» se aclara que si se suspenden clases el límite puede bajar (47 → 44 sesiones = 8 faltas) y que los pendientes no cuentan hasta resolverse.
- **Interruptor y evaluación:**
  - El parámetro 15 apaga el simulador sin desplegar nada.
  - Evaluación sin registrar quién consulta: comparar las faltas equivalentes por alumno y semana del periodo frente al anterior a la misma altura, en los grupos piloto de la fase 2.
  - Criterio para apagarlo: si suben las faltas en los grupos con simulador.

## 7. Plan

| Fase | Pieza | Zona | Esfuerzo |
|---|---|---|---|
| **1 · Solo lectura (RF-21)** | 0104 funciones + vista + `api_serie_alumno` + rejilla cruzada | db-api-a | 1 d |
| | 0105 `api_mis_proximas_sesiones` + `api_simular_margen` (completa, con la bandera apagada) + pruebas 2–5 | db-api-a | 1 d |
| | Parámetro 15 (0242) | db-api-b | 0,1 d |
| | Envoltorios `misProximasSesiones`, `simularMargen` en `lib/api/reportes.js`; `errors.js` (+2 códigos); `sincronia.test.js` 82 → 84; regenerar `docs/API-RPC.md` | data-layer / db-api-b | 0,3 d |
| | `proyeccionAlumno` + pruebas (incluido E260021) | numerics | 0,5 d |
| | `MedidorLiquido` con `cifra` | ui-kit | 0,2 d |
| | `MargenImprevistos` (adivina y revela, medidor, conteo con fusión estática, justificables con «Justificar ahora», `ProyeccionAlumno` en Detalles), carga diferida, `?margen`, pruebas, revisión a 360 px claro y oscuro, medición de peso | screens-reportes | 1,5 d |
| | Docs: reportes-analitica §2.2 (componentes y contrato de ProyeccionAlumno en clases), DECISIONS §12, ARCHITECTURE §8 ext. 21 | docs / lead | 0,3 d |
| **2 · Simulador acotado** | `TiraImprevistos` + búsqueda en la tabla + confirmación a 250 ms + animación de fusión + pruebas de la cota y de aria-live; encender la bandera en grupos piloto | screens-reportes | 1,5 d |
| **3 · Opcional** | RN-14 plazo para justificar (§3.6) · variante de hoja inferior de `PanelLateral` · versión de la RPC para docente o tutor (F24/F31) · factor 5 de riesgo con `proyeccionAlumno` | varias | 1–2 d c/u |

**MVP demostrable:** solo la fase 1, unos 4,9 días. Ya produce el wow de «adivina y revela», el tanque en «3 de 9» y «Justificar ahora». La versión completa son la fase 1 y la 2, unos 6,4 días (tamaño M).

## 8. Guion de demo (60 s)

Antes: `scripts/seed-demo.sh --reset`, reloj en «Restablecer» (lun 14-sep 07:12), bandera 15 en 1. Cuenta `e260021@susan.local`.

| Tiempo | Acción | Se dice |
|---|---|---|
| 0–8 s | `/alumno`, tarjeta «Administración Financiera» (6 de 9). | «Todo alumno ve "6 de 9". Nadie sabe qué significa eso para el viernes.» |
| 8–20 s | «Mi margen» → «¿Cuántas faltas crees que llevas?» → toca **4** → «Revelar». El tanque se llena a **3 de 9**. | «Primero adivina. Casi todos se quedan cortos; ver la diferencia corrige esa idea mejor que un porcentaje.» |
| 20–38 s | «Prueba un imprevisto»: toca **lun 21**. Pasa a *Tarde*; ●●○ se funden en una falta y el tanque baja a 2. Toca otra vez: *Falta*. Toca **mié 23**: no avanza («Prueba un imprevisto a la vez»). | «Son sus clases reales, con la regla oficial: tres retardos son una falta. La calcula la misma base de datos que decide el derecho a examen, así que el simulador y la realidad no pueden contradecirse.» |
| 38–50 s | Píldora «Qué puedo justificar» → «vie 11 · Falta · si te la aprueban, recuperas 1» → **Justificar ahora**: el formulario abre con esa sesión elegida. | «Además le dice qué trámite le devuelve margen.» |
| 50–60 s | «Cerrar» («Nada de esto se guarda»). | «No es una calculadora para faltar: es un margen para imprevistos. Empieza en "si asistes", admite un solo imprevisto y no se guarda.» |

Petición a demo: fijar a E260021 (6 ausencias, 2 retardos, 1 pendiente, margen 3, ausencia del vie 11 justificable) como persona de F09, con su comprobación en `seed-demo.mjs`.

## 9. Entrada para `web/src/lib/modulos.js`

```js
// Importar Umbrella de lucide-react.
{
    id: 'margen-imprevistos', titulo: 'Margen para imprevistos',
    descripcion: 'Cuántas faltas te separan del límite en cada materia, qué puedes justificar y cómo vas a tu ritmo.',
    icono: Umbrella, categoria: 'asistencia', roles: ['alumno'], estado: 'pronto', tono: 'verde',
    queIncluye: ['Tu margen por materia, contado en faltas', 'Faltas y retardos que aún puedes justificar', 'Estimación de cómo cerrarías el periodo'],
},
// Al publicar la fase 1: estado: 'activo', href: '/alumno?margen' (abre el panel de la materia elegida); se quita queIncluye.
```

## 10. Cambios de contrato y peticiones por zona

- **Contratos nuevos:**
  - `api_mis_proximas_sesiones` y `api_simular_margen`, documentados en `COMMENT ON FUNCTION` y en `docs/API-RPC.md` (regenerado).
  - Códigos `ESCENARIO_INVALIDO` (422) y `SIMULADOR_NO_DISPONIBLE` (409).
  - Parámetro 15 `simulador_margen_activo`.
  - Extensión 21 en ARCHITECTURE §8 y DECISIONS §12.
  - Contrato de `ProyeccionAlumno` en reportes-analitica §2.2: «en cuántas sesiones», sin semana.
- **Sin cambio:** las columnas de `v_resumen_asistencia` y la forma de `api_serie_alumno` y `api_alumno_*`.
- **Peticiones:**
  - db-api-a: 0104, 0105 y `api_c_21_margen.sql`.
  - db-api-b: 0242 y el catálogo.
  - data-layer: envoltorios, `errors.js` y el conteo de sincronía.
  - numerics: `proyeccionAlumno` y alinear el factor 5 de riesgo.
  - ui-kit: prop `cifra` de `MedidorLiquido`.
  - screens-reportes: componentes y `?margen` en `alumno/page.jsx`.
  - demo: persona E260021.
  - lead: registro de módulos.

Archivos de referencia:
- `/Users/diegoguerrero/Developer/SUSAN/supabase/migrations/0100_reportes_base.sql`
- `/Users/diegoguerrero/Developer/SUSAN/supabase/migrations/0102_reportes_rpc.sql`
- `/Users/diegoguerrero/Developer/SUSAN/supabase/migrations/0103_series_alertas_rpc.sql`
- `/Users/diegoguerrero/Developer/SUSAN/supabase/migrations/0121_revision_escrituras.sql`
- `/Users/diegoguerrero/Developer/SUSAN/web/src/lib/numerics/forecast/`
- `/Users/diegoguerrero/Developer/SUSAN/web/src/components/alumno/`
- `/Users/diegoguerrero/Developer/SUSAN/web/src/components/ui/MedidorLiquido/MedidorLiquido.jsx`
- `/Users/diegoguerrero/Developer/SUSAN/docs/api/reportes-analitica.md`