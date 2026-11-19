# F19 · ¿Lo habríamos visto venir? Rebobinar el semestre para auditar el pronóstico

Diseño basado en el código real del repositorio. Las cifras de 2026-2 que aparecen aquí las medí el 2026-10-08 sobre la base local (la semilla de demostración tal como está hoy), con un prototipo fuera del repo que llama a `evaluarRiesgoGrupo` sin modificarla. Las cifras de 2026-1 todavía no existen. Se publicarán tal como salgan de la primera corrida (ver §3.4).

**Dónde está cada una de las cinco piezas pedidas.** (1) El contrato de `lib/numerics/evaluacion` está en §4.2. (2) Las reglas de exclusión, en §4.1. (3) `ui/MatrizCalor`, en §5.2. (4) La semilla 2026-1 con ruido no diseñado, en §3.4. (5) La escena atada al reloj, en §2.3 y §8.

---

## 0. Lo que encontré al leer el código y medir (cambia partes del pitch)

1. **La verdad del periodo en curso está censurada a la derecha.** Medí sobre la semilla 2026-2 con cortes semanales 2 a 5 y la verdad al 11–13 de septiembre:
   - Con umbral 35, SUSAN avisó a **5 de 5** alumnos que ya llegaron al límite (IC 95 % de Wilson: 57–100 %), con una mediana de **3 semanas antes** y una media de 3,2.
   - Además hay **18 alertas sobre 67 alumnos que aún no llegan al límite**. Muchas de esas alertas son de patrones que casi seguro llegarán: k15 a k19, k21 y k22.
   - Por eso **en un periodo abierto no existen las «falsas alarmas»**: solo «alertas abiertas». Las falsas alarmas y la especificidad se calculan únicamente en periodos cerrados.
2. **La auditoría encuentra un punto ciego real del modelo.** Con umbral 60 avisó a **3 de 5** (IC 23–88 %), con 2 semanas de mediana. Se escapan los dos ausentistas crónicos, E260020 y E260070 (k20). Sus puntajes semanales se quedan entre 45 y 59. La causa es que el modelo premia el cambio (pendiente y racha) y no la constancia. Este es el «fallo» que más credibilidad da, y sale de los datos, no de un guion.
3. **El abandono repentino (k18) se detecta, no se predice.** Lo medí sesión por sesión en E260043 y E260068: empiezan a faltar en la sesión 10, el puntaje sube a 24 y luego a **42 en la segunda falta** (cruza 35) y a 67 en la cuarta (cruza 60). La frase del pitch, «lo detectó 2 sesiones después de que empezó», es literal.
4. **E260001 es un acierto fabricado.** `scripts/demo/limites.sql` convierte en `ausente` sus 9 primeras sesiones en modo réplica y no deja nada en la bitácora. Su puntaje ya es 53 en la semana 1. Sin una regla que lo saque, infla el resultado.
5. **Hay ruido real de la demostración.** El guion de reposición del 3A (`lib/demo/casos.js`, sábado 12 y domingo 13 de septiembre) marca **presente** a E260018 (k18), que llevaba 8 faltas seguidas. Su puntaje cae de 70 a 49. Lo dejamos como está: es ruido que nadie diseñó para el detector.
6. **El reloj de demostración no deshace sesiones.** Las sesiones antes del 14 de septiembre ya están `cerrada`. Mover el reloj solo puede mover el corte de esta pestaña, no «el pasado» del resto de la app.
7. **`api_alertas_docente` no filtra por periodo** cuando `p_id_grupo` es null. Si se siembra 2026-1 en la semilla base, sus alumnos sin derecho aparecerían en el panel de docente1. Por eso la semilla 2026-1 entra como opción de `seed-demo.sh` hasta que se corrija.
8. **La matriz trae estados actuales.** Los justificantes aprobados y las correcciones posteriores al corte «viajan al pasado». La bitácora (`correccion` y `aprobacion_justificante`, con `valor_anterior` y `fecha_hora`) permite reconstruir el **estado conocido al corte**.
9. **No existe un rol «evaluador externo».** `rol_usuario` solo tiene administrador, docente, alumno y técnico. El evaluador usa una cuenta de administrador.
10. **Costo medido en M-series.** 15 cortes × 25 alumnos × 48 sesiones con `evaluarRiesgoGrupo` tardan 21 ms en frío y 3 ms en caliente. Mover el umbral solo reclasifica puntajes ya calculados (menos de 1 ms). No hace falta un Worker. Hay que medirlo en un Android de gama media.

---

## 1. Concepto y momento wow

Una pestaña de `/analitica` regresa el semestre a la semana 2, 3 o 4. Ahí vuelve a calcular el riesgo **con lo que se sabía en esa fecha** y lo compara con lo que pasó después.

El evaluador lleva el control a la semana 3 y pulsa «Reproducir». El reloj de demostración de arriba retrocede a «lunes 23-feb-2026» y avanza una semana cada 0,6 s. La matriz de alumnos por semanas se enciende: aparecen anillos ámbar cuando SUSAN avisa y celdas rojas cuando el alumno llega al límite.

Al terminar aparece **una sola cifra grande**: «N semanas antes». Debajo, en frecuencias naturales: «avisó a a de p · f falsas alarmas», con su intervalo de Wilson. A propósito se muestra el caso que no se podía prever: «abandono repentino; lo marcó 2 sesiones después de que empezó».

---

## 2. Flujo de usuario

### 2.1 Rutas

| Ruta (bajo `src/app/(app)`) | Quién | Qué |
|---|---|---|
| `analitica/page.jsx` con `?periodo=&grupo=&vista=auditoria` | docente (sus grupos), administrador | Pestaña «¿Lo habríamos visto venir?» de un grupo. `Analitica.jsx` gana `ui/Tabs` con «Análisis» (lo actual) y la nueva pestaña. La pestaña elegida va en la URL (`vista`), igual que `periodo` y `grupo`. |
| `analitica/modelo/page.jsx` (nueva) | administrador (todos los grupos), docente (sus grupos: `api_reporte_filtros` ya acota) | Auditoría agregada del periodo: cifra protagonista, curva, calibración, **tabla de equidad** por grupo, franja y modo de registro, y la **ficha del modelo** imprimible. Por defecto abre el periodo cerrado más reciente. |
| Panel lateral (`ui/PanelLateral`) dentro de la pestaña | igual | Trayectoria de un alumno: puntaje por semana (`GraficaLinea` con `limite` = umbral y marca en la semana del evento) y factores en el corte elegido. |

La protección de `analitica/layout.jsx` ya existe (`ROLES_POR_AREA.analitica` = administrador y docente). La página `modelo/page.jsx` es delgada: lee `searchParams` con `await` y compone `components/analitica/AuditoriaModelo`.

### 2.2 Pantalla de la pestaña, de arriba abajo

1. **Banda de contexto.** Un `Badge` dice «Validación del método». Otro dice «Datos de demostración» cuando `api_ahora().reloj_simulado` es verdadero. En un periodo abierto se agrega «Verdad provisional: faltan K semanas». Debajo va una línea gris: «Con lo que SUSAN sabía cada lunes, comparado con lo que pasó hasta el {fecha_referencia}».
2. **Control de rebobinado** (`ControlRebobinado`):
   - Un `<input type="range">` nativo con ← → Home End incluidos y `aria-valuetext` como «Semana 3 de 16: lo que SUSAN sabía el lunes 23 de febrero».
   - Botones de paso ◀ ▶ (`ChevronLeft`/`ChevronRight`) y un botón «Reproducir/Pausar» (`Play`/`Pause` de Lucide).
   - Para el umbral: `ui/Pills` con «35» y «60» (accesos rápidos) y un rango de 0 a 100 en pasos de 5 con el valor escrito.
   - Si hay 5 cortes o menos, como en 2026-2 (cortes 2 a 5), el rango se sustituye por `ui/SegmentedControl`.
3. **Cifra protagonista** (`CifraProtagonista`): la mediana de semanas de anticipación, con `motion/CountUp`. Una frase debajo y el IC de Wilson. Antes de reproducir solo dice «Pulsa Reproducir para ver qué habría pasado».
4. **Matriz** (`ui/MatrizCalor` en `TarjetaGrafica`): hasta 8 alumnos relevantes por las semanas del periodo. El resto queda en `ui/Detalles` con `montarAlAbrir`.
5. **Composición en el corte** (`ui/BarraSegmentada`): aciertos, omisiones, falsas alarmas (o «alertas abiertas») y correctos negativos (o «sin alerta, sin desenlace»). La leyenda va en frecuencias: «5 de 5».
6. **Caso destacado** (`CasoDestacado`): el fallo o la limitación, elegido por regla (§4.4).
7. **Curva del umbral** (`CurvaUmbral`): `GraficaLinea` con sensibilidad y falsas alarmas (o alertas abiertas, discontinua) contra el umbral, con marcas en 35, en 60 y en el umbral actual. En `Detalles` va la curva ROC con su área (banda `[0, y]`) y el AUC calculado de dos formas.
8. **Ficha del modelo** (`FichaModelo`, en `Detalles`) y **procedimiento** (`PanelProcedimiento` y `PasoView` existentes, con los pasos que devuelve `backtest`).

### 2.3 La escena atada al reloj de demostración

El reloj solo existe en modo local (`SUSAN_LOCAL=1`). En producción todo esto se oculta y el cabezal es interno.

**Una sola fuente de verdad.** Mientras la pestaña está en «sincronía con el reloj», el corte se calcula como el número de semanas completas antes de la fecha del reloj. Si el reloj marca el lunes 23-feb-2026 07:12, el corte es la semana 3 (lo cerrado hasta el domingo 22). El backtest usa **todas** las sesiones cerradas como verdad, sin importar el reloj: «volviste al 23 de febrero; lo que pasó después ya está guardado y sirve para calificar».

**Del reloj a la escena.** La pestaña escucha `susan:reloj-cambio` (`EVENTO_RELOJ_CAMBIO` de `@/hooks/data`). Si el presentador mueve el reloj con la tarjeta `RelojDemo` y la fecha cae dentro de la ventana evaluable del periodo, el cabezal se mueve solo.

**De la escena al reloj.** El botón «Llevar el reloj a esta semana» llama a `cambiarRelojDemo({ fijar: '<lunes siguiente al corte> 07:12' })`. Antes guarda el valor anterior en `sessionStorage`, con try/catch: es una comodidad por espectador. Aparece un chip «El reloj está en el 23-feb · Volver al 14-sep 07:25»; ese botón restaura el valor guardado (o `restablecer` si se perdió).

**Reproducir en sincronía.** Cada paso hace `POST { avanzarMin: 10080 }`, que es exactamente una semana y el máximo de la API, y espera la respuesta. Cada paso dura como mínimo 0,6 s. La tarjeta del reloj de arriba avanza junto con la matriz. Si un POST falla, la reproducción sigue en modo interno y se avisa: «el reloj no respondió; la reproducción sigue sin él».

**Cerrar la clase de hoy cambia la verdad en vivo.**
- Si en el recorrido del 14-sep se cierra la sesión 19 del 3A sin el alumno 18 (CLI `captura.mjs` con la lista `1-17,19-24`), E260018 llega a 9 de 9.
- Al volver a la pestaña, `useApiQuery` vuelve a pedir los datos: ahora es positivo, y SUSAN lo había marcado en la semana 4.
- El caso destacado dice: «empezó a faltar el 24-ago; lo marcó tras su segunda falta; antes no había señal».

**Límite que hay que decir en voz alta.** El reloj no borra el futuro: solo esta pestaña lo oculta. `/analitica` («Análisis») y los reportes siguen mostrando todas las sesiones cerradas.

### 2.4 Cómo se ve a 360 px

- El orden es: cifra protagonista, control, matriz, barra, caso destacado, curva y ficha.
- El control va en dos renglones: arriba ◀ [rango] ▶ y abajo «Reproducir» a todo el ancho más las Pills 35/60.
- La matriz usa `grid-template-columns: minmax(4rem, 6rem) repeat(N, minmax(0, 1fr))`. Con 16 semanas en 288 px útiles quedan celdas de unos 12 px. Las etiquetas de columna se adelgazan con `adelgazarMarcas` (`lib/graficasGeometria.js`). No hay scroll horizontal.
- Tocar la etiqueta de un alumno abre el `PanelLateral`.
- Las etiquetas de la pestaña («Análisis» y «¿Lo habríamos visto venir?») caben en unos 290 px. Además, `ui/Tabs` ya permite desplazamiento.

### 2.5 En proyector (1024 a 1280 px)

- Dos columnas: la matriz a la izquierda (celdas de hasta 28 px) y, a la derecha, la cifra protagonista (unos 64 px) con la barra.
- **Los nombres están ocultos por omisión**: «Alumno 7» es el número de lista en el orden alfabético de `api_matriz_grupo`. El interruptor «Mostrar nombres» solo aparece al docente del grupo, no se guarda y nunca aparece en `/analitica/modelo`.
- Con «reducir movimiento», «Reproducir» salta al resultado final, sin transiciones y sin CountUp.

---

## 3. Datos

### 3.1 Lo que ya existe y se reutiliza (nombres reales)

| Fuente | Uso |
|---|---|
| `api_matriz_grupo` (0103), con `matrizCompleta()` de `useAnalitica.js` | `fechas` y `alumnos[].estados` alineados por sesión **cerrada**. El corte es un `slice` por semana. |
| `api_serie_grupo` (0103) | `sesiones_programadas` (no suspendidas: 3A 47, 3B 47, 5C 45, límite de 9 faltas en los tres), `limite_pct`, `retardos_por_ausencia`, `sesiones[]` para `normalizarSesiones` y `agruparSemanas`. |
| `v_resumen_asistencia` mediante `api_reporte_grupo` | Verdad oficial: `en_limite OR supera_limite`, que equivale a `faltasEq ≥ faltas_maximas_permitidas`. Se recalcula por semana en el cliente y **se contrasta** con `items[]` de `api_reporte_grupo` en la fecha de referencia. Se muestra «la verdad coincide con el reporte oficial en 24 de 24». |
| `api_reporte_filtros` | Periodos y grupos accesibles (para `/analitica/modelo`). |
| `api_ahora` | `fecha` (hoy de negocio) y `reloj_simulado`. |
| `bitacora_auditoria` | `correccion` sobre `asistencia` (`valor_anterior.estado`) y `aprobacion_justificante` sobre `justificante` (`valor_anterior.estado_asistencia`, `valor_nuevo.id_asistencia`). Solo se lee dentro de la RPC nueva. |
| `horario_grupo`, `sesion_clase.modo_registro`, `inscripcion.estatus` | Franja, modo (cámara o manual) y bajas. |
| `/api/_local/reloj` con `leerRelojDemo` y `cambiarRelojDemo` (`lib/local/relojCliente.js`) | La escena atada al reloj (solo local). |

### 3.2 SQL nuevo: `api_auditoria_pronostico_grupo` (zona db-api-a, `0104_auditoria_pronostico.sql`)

Es una lectura de solo los insumos que el backtest necesita y que hoy no llegan al cliente. Es `SECURITY DEFINER` porque la bitácora solo la lee el administrador. Comprueba el rol y la pertenencia con la misma ayuda que `api_matriz_grupo`. **No devuelve** comentarios, usuarios ni IP.

```sql
CREATE OR REPLACE FUNCTION public.api_auditoria_pronostico_grupo(p_id_grupo integer) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path = public, app, pg_temp
AS $$
DECLARE
    v_rol text := app.exigir_rol('administrador', 'docente');
    g     public.grupo%ROWTYPE := app.c1_grupo_visible(p_id_grupo);
    v_hoy date := app.hoy();
BEGIN
    RETURN jsonb_build_object(
      'id_grupo', g.id_grupo, 'periodo', g.periodo, 'hoy', v_hoy, 'reloj_simulado', app.reloj_simulado(),
      'franja', (SELECT to_char(min(h.hora_inicio), 'HH24:MI') FROM horario_grupo h WHERE h.id_grupo = g.id_grupo),
      'modo_registro', (SELECT mode() WITHIN GROUP (ORDER BY s.modo_registro) FROM sesion_clase s
                         WHERE s.id_grupo = g.id_grupo AND s.estatus = 'cerrada'),
      'fecha_referencia', (SELECT max(s.fecha) FROM sesion_clase s WHERE s.id_grupo = g.id_grupo AND s.estatus = 'cerrada'),
      -- cerrado = ya no queda ninguna sesión no suspendida de hoy en adelante
      'periodo_cerrado', NOT EXISTS (SELECT 1 FROM sesion_clase s WHERE s.id_grupo = g.id_grupo
                                       AND s.estatus <> 'suspendida' AND s.fecha >= v_hoy),
      'sesiones_vencidas_sin_cerrar', (SELECT coalesce(jsonb_agg(jsonb_build_object('id_sesion', s.id_sesion,
                                         'fecha', s.fecha, 'estatus', s.estatus) ORDER BY s.fecha), '[]')
                                         FROM sesion_clase s WHERE s.id_grupo = g.id_grupo
                                          AND s.fecha < v_hoy AND s.estatus IN ('programada', 'abierta')),
      'bajas', (SELECT coalesce(jsonb_agg(i.id_alumno), '[]') FROM inscripcion i
                 WHERE i.id_grupo = g.id_grupo AND i.estatus = 'baja'),
      'cambios', (SELECT coalesce(jsonb_agg(c ORDER BY c->>'fecha_cambio'), '[]') FROM (
          -- correcciones (RF-11) con estado anterior y nuevo
          SELECT jsonb_build_object('tipo', 'correccion', 'id_alumno', a.id_alumno, 'id_sesion', s.id_sesion,
                   'fecha_sesion', s.fecha, 'fecha_cambio', b.fecha_hora,
                   'de', b.valor_anterior->>'estado', 'a', b.valor_nuevo->>'estado',
                   'fuera_de_plazo', b.fecha_hora > app.limite_correccion(s.fecha, s.hora_fin)) AS c
            FROM bitacora_auditoria b
            JOIN asistencia a ON b.entidad = 'asistencia' AND b.accion = 'correccion' AND a.id_asistencia = b.id_registro
            JOIN sesion_clase s ON s.id_sesion = a.id_sesion
           WHERE s.id_grupo = g.id_grupo AND s.estatus = 'cerrada'
          UNION ALL
          -- justificantes aprobados (RN-09): la falta pasa a justificado en fecha_hora
          SELECT jsonb_build_object('tipo', 'justificante', 'id_alumno', a.id_alumno, 'id_sesion', s.id_sesion,
                   'fecha_sesion', s.fecha, 'fecha_cambio', b.fecha_hora,
                   'de', b.valor_anterior->>'estado_asistencia', 'a', 'justificado', 'fuera_de_plazo', false)
            FROM bitacora_auditoria b
            JOIN asistencia a ON b.entidad = 'justificante' AND b.accion = 'aprobacion_justificante'
                             AND a.id_asistencia = (b.valor_nuevo->>'id_asistencia')::integer
            JOIN sesion_clase s ON s.id_sesion = a.id_sesion
           WHERE s.id_grupo = g.id_grupo AND s.estatus = 'cerrada') q));
END
$$;
-- COMMENT ON FUNCTION con ARGS / RETURNS / ERRORES (NO_AUTORIZADO, NO_ENCONTRADO, VALIDACION) / ROLES, como las de 0103.
REVOKE ALL ON FUNCTION public.api_auditoria_pronostico_grupo(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_auditoria_pronostico_grupo(integer) TO authenticated;
```

- **Prueba nueva:** `supabase/tests/api_c_21_auditoria_pronostico.sql`. Cubre que un docente de otro grupo recibe `NO_AUTORIZADO`, que no salen comentarios ni usuarios, que una corrección fuera de plazo se marca y que un justificante aprobado aparece con `a = 'justificado'`.
- **Índice:** si el `EXPLAIN` lo pide, uno parcial en `bitacora_auditoria (entidad, accion, id_registro)`.
- **Modo local:** funciona sin cambios. `lib/local/rpc.js` decide qué funciones se pueden llamar consultando `pg_proc`.
- **Documentación:** agregar el contrato a `docs/api/reportes-analitica.md` y regenerar `docs/API-RPC.md` con `scripts/gen-api-catalog.mjs`. Es un contrato nuevo: hay que avisarlo en el reporte final.

### 3.3 Cambios fuera de la RPC

| Cambio | Zona | Por qué |
|---|---|---|
| `scripts/demo/limites.sql` registra en la bitácora cada asistencia que reescribe: `correccion` sobre `asistencia`, con `valor_anterior {estado:'presente'}`, `valor_nuevo {estado:'ausente', comentario:'Ajuste de demostración'}` y `fecha_hora = app.now()`. Se hace con un `UPDATE … RETURNING` en un CTE, como la carga masiva de `03_historial.sql`. | demo | Hoy reescribe la historia sin dejar rastro. Con el registro, la regla R3 (§4.1) saca a E260001 sin nombrarlo en el código. |
| `api_alertas_docente`: con `p_id_grupo IS NULL`, limitar a `g.periodo = (SELECT max(periodo) FROM grupo)`. | db-api-a | Condición previa para que 2026-1 entre en la semilla base sin contaminar el panel del docente. Es un error latente también en producción. |
| (Versión completa) Parámetros 13 y 14 `umbral_riesgo_medio` (35) y `umbral_riesgo_alto` (60) en `parametro_sistema` y `app.parametro_meta` (entero de 1 a 99), con la regla «medio < alto» en `app.validar_parametro`. | db-schema | Que el umbral elegido con la curva se aplique en todo el sistema. Lo cambia el técnico con `api_parametro_actualizar`, que ya asienta `cambio_parametro` en la bitácora. `evaluarRiesgoAlumno` acepta `contexto.umbrales` con los valores de hoy por omisión. |
| (Opcional) Tabla `evaluacion_modelo` (`id_evaluacion`, `periodo`, `version_modelo`, `umbral`, `metricas jsonb`, `generado_en`, `generado_por`), escritura solo del administrador mediante `api_evaluacion_modelo_publicar(p jsonb)` y lectura para administrador y docente. Hay que ampliar `ck_bitacora_entidad`. | db-schema + db-api-b | Congelar la «ficha v1» publicada para que se pueda citar. Sin vectores ni nombres: solo métricas agregadas. |

### 3.4 Semilla 2026-1 con el generador G1 (pieza 4)

**Dónde va.** En `scripts/demo/periodo_cerrado.sql`, que se ejecuta con `scripts/seed-demo.sh --periodo-cerrado` (zona demo, opcional). Pasa a `supabase/seed/04_periodo_cerrado.sql` cuando exista el filtro por periodo de `api_alertas_docente`. Tiene que correr **después** de `03_historial.sql`: ese archivo genera los patrones k1 a k25 para toda sesión cerrada que exista en ese momento.

**Catálogo.**
- 100 alumnos nuevos, **E250001 a E250100** (otra generación), sin cuentas. Así no se tocan las vistas de los alumnos de 2026-2.
- Los nombres salen de la misma aritmética de `01_catalogo.sql`.
- Cuatro grupos `2026-1`, con los docentes y aulas existentes. Dan **3 franjas y los 2 modos de registro** para la tabla de equidad:

| Grupo | Materia | Días | Hora | Aula | Docente | Modo |
|---|---|---|---|---|---|---|
| 2A | ADM301 | lun/mié/vie | 07:00 | A-12 | D0001 | cámara |
| 2B | CON302 | mar/jue/vie | 09:00 | A-12 | D0002 | cámara |
| 4C | MAT501 | lun/mié/vie | 09:00 | B-04 | D0001 | manual |
| 1D | ECO101 | lun/mié/vie | 13:00 | B-04 | D0002 | manual |

**Calendario.**
- 16 semanas de clase desde el lunes 2-feb-2026, **sin** las semanas del 30-mar y del 6-abr (Semana Santa y Pascua). Esos huecos ponen a prueba que «sin dato» no es 0.
- Sesiones suspendidas: 2-feb y 16-mar (lunes) y 1-may (viernes).
- **Una sesión vencida que nunca se abrió**: 1D, 20-mar, en `programada`. Pone a prueba la regla R2.

**Modelo generativo.** Describe conducta, no factores. El archivo **no** importa ni menciona `riesgo.js`. El azar es `pg_temp.u(alumno, n, clave)` = `(hashtext(alumno||':'||n||':'||clave||':g1')::bigint & 2147483647) / 2147483647.0`. Es determinista, como en `03_historial.sql`, y la sal es `g1`.

| Mecanismo | Parámetros (fijos antes de la primera corrida) |
|---|---|
| Propensión base de ausencia, distinta por alumno | `b = 0.01 + 0.12·u²` (cola larga hacia arriba) |
| Retardo; más a las 07:00 por transporte | `r = (0.02 + 0.10·u) × 1.6 si la franja es 07:00` |
| Cadena de Markov por sesión: E (enganchado), D (desenganchado), A (abandono, absorbente) | `P(E→D) = h = 0.002 + 0.03·u³`; desde D: `P(D→A) = 0.06`, `P(D→E) = 0.20`; ausencia en D: `0.60 + 0.30·u`; en A: 0.97 |
| Episodio de enfermedad (35 % de los alumnos) | 2 a 4 sesiones con ausencia de 0.9; la mitad se **justifica**, con justificante aprobado de 2 a 6 días después (`bitacora` `aprobacion_justificante` con esa fecha) |
| Choques de grupo: bloqueo carretero o lluvia | 2 fechas por grupo con +0.40 de ausencia para todos |
| Semanas de exámenes (8 y 16) y efecto viernes | ausencia ×0.5; viernes +0.03 |
| Ruido de captura en pase manual (B-04) | «pase rápido» en el 5 % de las sesiones (todos presentes); retardos ×0.5 |
| Ruido de captura con cámara (A-12) | 1 % de faltas espurias; el 70 % se corrige dentro de 48 h (`correccion` en la bitácora, dentro de plazo) |
| Baja formal | La mitad de quienes entran a A antes de la sesión 30 quedan en `inscripcion.estatus = 'baja'` |

```sql
-- Esbozo del núcleo (WITH RECURSIVE: la fase de cada sesión depende de la anterior)
cadena AS (
    SELECT l.id_alumno, l.id_grupo, 1 AS n, 'E'::text AS fase FROM latentes l
    UNION ALL
    SELECT c.id_alumno, c.id_grupo, c.n + 1,
           CASE c.fase
               WHEN 'A' THEN 'A'
               WHEN 'E' THEN CASE WHEN pg_temp.u(c.id_alumno, c.n + 1, 't') < l.h THEN 'D' ELSE 'E' END
               ELSE CASE WHEN pg_temp.u(c.id_alumno, c.n + 1, 't') < 0.06 THEN 'A'
                         WHEN pg_temp.u(c.id_alumno, c.n + 1, 't') < 0.26 THEN 'E' ELSE 'D' END
           END
      FROM cadena c JOIN latentes l USING (id_alumno, id_grupo)
     WHERE c.n < (SELECT max(n) FROM ses s WHERE s.id_grupo = c.id_grupo))
```

**Protocolo de credibilidad (pre-registro).**
- La **única** calibración permitida es la prevalencia, y se calcula **sin** el detector. Simulé solo el generador en 200 réplicas: da **cerca de 18 %** de alumnos que llegan al límite, unos 18 de 100.
- Si se quiere entre 12 y 15 %, se baja `h` **antes** de la primera corrida y después se congela.
- El encabezado del archivo lleva los parámetros, la sal y la fecha. Su SHA-256 se anota en `docs/NUMERICS.md` §7 **antes** de correr el backtest.
- La «ficha v1» se publica con lo que salga. Cualquier cambio exige una sal nueva (`g2`) y publicar las dos.
- Lo ideal es que G1 lo escriba alguien que no haya abierto `riesgo.js`.
- La prueba de verdad sería un semestre real anonimizado, con aviso de privacidad y convenio. Se anota como trabajo futuro.

**Volumen.** Unas 4 600 filas de `asistencia`, con `SET LOCAL session_replication_role = replica` solo para la carga histórica (el mismo criterio que `03_historial.sql`). Al final se ejecuta `app.recalcular_grupo` en los cuatro grupos.

---

## 4. Cálculo

### 4.1 Definiciones y reglas de exclusión (pieza 2)

**Semanas.** Semana relativa = `round((lunes(fecha) − lunes(primera sesión)) / 7) + 1`, igual que `agruparSemanas`. Las semanas sin sesiones cerradas (vacaciones) son columnas «sin clase»: nunca valen 0.

**Corte `c`.** Lo que SUSAN sabía el lunes de la semana `c+1` a primera hora: columnas con semana ≤ `c`, **en el estado conocido al corte** (ver «estado conocido al corte» más abajo). Las métricas suponen una **revisión semanal**. Revisar después de cada clase adelanta algunos avisos: E260020 habría pasado de 60 en la sesión 4. Se dice en la ficha.

**Verdad.** La semana del evento `E` es la primera en que `faltasEq ≥ ⌊limitePct·prog/100⌋`, calculada con los estados **actuales**. Es exactamente `en_limite OR supera_limite` de `v_resumen_asistencia`. La referencia `R` es la semana de la última sesión cerrada, nunca la fecha del reloj.

**Vigilancia desde `s0` (por omisión 2) con umbral `U`.** La primera alerta `A` es el menor `c` en `[s0, min(E, R) − 1]` con `puntaje(c) ≥ U`.
- Positivo (`E` existe y `E > s0`): es **acierto** si hay `A`, con anticipación = semanas con clase entre `A` y `E`. Si no hay `A`, es **omisión**.
- Negativo (no hay `E`): en un periodo cerrado es **falsa alarma** si hubo alerta y **correcto negativo** si no. En un periodo abierto se llaman «alerta abierta» y «sin alerta», y quedan censurados (no entran en especificidad).
- Equivalencia útil: hay alerta si y solo si el puntaje máximo en la ventana es ≥ `U`. Por eso la curva por umbral sale de un solo número por alumno.

| Regla | Condición | Por qué | Cómo se ve |
|---|---|---|---|
| **R1** Ya en el límite al empezar | `E ≤ s0` | El factor «distancia al límite» (25 pts) se parece demasiado al resultado: sería fuga de información. | Fuera del cálculo, contado: «2 ya estaban en el límite en la semana 2». |
| **R2** Sesiones nunca abiertas | Sesiones con `fecha < hoy` en `programada`/`abierta` (`sesiones_vencidas_sin_cerrar`) | No son faltas de nadie y no están en la matriz. Sí cuentan en `sesiones_programadas`, igual que en `v_resumen_asistencia`. | No son columnas. La referencia es la última sesión **cerrada**. Aviso con el conteo y las fechas. Si son ≥ 10 % de las sesiones hasta la referencia, el grupo queda como «datos incompletos» y sale del agregado de `/analitica/modelo` (se puede ver aparte). |
| **R3** Faltas registradas fuera de plazo | Un cambio en `cambios` con `fuera_de_plazo = true` que **agrega** una falta (de presente, retardo, pendiente o justificado a `ausente`) | Historia reescrita: el modelo no podía verla. Así sale **E260001** sin nombrarlo en el código. | Fuera, en una lista aparte: «1 alumno: sus faltas de agosto se cargaron el 14-sep». |
| **R4** Bajas | `id_alumno` en `bajas` | La tabla no guarda la fecha de baja; el desenlace no es de asistencia. | Fuera, contado. La ficha aclara que la baja es el peor desenlace y SUSAN no la mide. |
| **R5** Sin datos al corte | Menos de 4 sesiones con registro en `s0` (alta tardía, nulos) | Un puntaje sin base. | Fuera en ese corte. |
| — Cambios **dentro** de plazo | Correcciones RN-08 y justificantes aprobados después del corte | El estado de hoy no es el que se veía entonces. | **No** excluye. Se reconstruye «estado conocido al corte» con `de` del primer cambio posterior al fin de la semana `c`. |

### 4.2 Contrato de `web/src/lib/numerics/evaluacion` (pieza 1, zona numerics)

Son funciones puras, sin dependencias, con una forma estable como `AnalisisGrupo`. Se exportan desde `lib/numerics/index.js` con `export * from './evaluacion/index.js'`.

**Para no evaluar un modelo distinto del que se muestra**, se extrae de `analizarGrupo` la construcción del contexto de riesgo a una función compartida en `analysis/`, `contextoRiesgo({ sesiones, fechas, prog, limitePct, rpa })`. Hoy esa lógica está en línea (`diasSemana`, `sesionesPorSemana = sesiones/W`, `semanaActual = W`). La usan `analizarGrupo` y `backtest`, así el puntaje del corte es **el mismo** que vería la pantalla.

```js
// evaluacion/index.js
export { backtest } from './backtest.js';               // corridas por corte (lo caro: una vez por grupo)
export { resumirBacktest } from './resumen.js';         // clasificación por umbral (barato: < 1 ms)
export { estadosAlCorte } from './corte.js';            // reconstrucción punto en el tiempo
export { matrizConfusion, intervaloWilson } from './metricas.js';
export { curvaUmbral, aucMannWhitney } from './curva.js';
export { calibracion } from './calibracion.js';

/**
 * @param {object} e
 * @param {{fechas: string[], alumnos: {id_alumno, matricula, nombre, estados: (string|null)[]}[]}} e.matriz  api_matriz_grupo completa
 * @param {{sesiones: object[], sesiones_programadas: number, limite_pct: number, retardos_por_ausencia: number}} e.serie  api_serie_grupo
 * @param {object} [e.insumos]  api_auditoria_pronostico_grupo (cambios, bajas, fecha_referencia, periodo_cerrado, sesiones_vencidas_sin_cerrar)
 * @param {number} [e.semanaMinima=2]
 * @returns {{
 *   semanas: {semana, lunes, sesiones, conClase: boolean}[],
 *   semanaReferencia: number, periodoCerrado: boolean, faltasMaximas: number,
 *   cortes: number[],                                  // semanaMinima..semanaReferencia-1, solo semanas con clase
 *   alumnos: {
 *     idAlumno, matricula, nombre, ordinal,             // ordinal = número de lista (seudónimo)
 *     puntajes: (number|null)[],                        // uno por corte; null = no evaluable (ya en el límite, R5)
 *     faltasEqPorSemana: number[],
 *     semanaEvento: number|null,
 *     inicioCambio: {sesion: number, fecha: string}|null,  // racha terminal de >= 3 ausencias tras >= 6 sesiones sin falta
 *     exclusion: {regla: 'R1'|'R3'|'R4'|'R5', motivo: string}|null,
 *   }[],
 *   exclusiones: {regla, n, motivo}[],
 *   avisos: {codigo: 'VERDAD_PROVISIONAL'|'SESIONES_SIN_CERRAR'|'DATOS_INCOMPLETOS'|'POCOS_POSITIVOS', mensaje}[],
 *   verificacion: {coinciden: number, total: number}|null,   // contra api_reporte_grupo, si se pasa
 *   procedimientos: object[],                           // pasos para PanelProcedimiento
 * }}
 */
export function backtest(e) {}

/**
 * Clasifica con un umbral sin volver a calcular puntajes.
 * @returns {{
 *   vigilancia: { positivos, aciertos, omisiones, falsasAlarmas: number|null, alertasAbiertas: number|null,
 *                 correctosNegativos: number|null, sinAlerta: number|null,
 *                 sensibilidad: Wilson, tasaFalsasAlarmas: Wilson|null, vpp: Wilson|null,
 *                 anticipaciones: number[], medianaAnticipacion: number|null },
 *   porCorte: {corte, ...ReturnType<matrizConfusion>}[],
 *   casos: {idAlumno, tipo: 'acierto'|'omision'|'falsa_alarma'|'abierta', primeraAlerta, semanaEvento}[],
 *   casoDestacado: {idAlumno, tipo: 'omision'|'repentino', texto, datos}|null,
 * }}
 */
export function resumirBacktest(bt, { umbral = 35, desde, hasta } = {}) {}

/** Wilson al 95 % (z = 1.959964, tabulado: no hace falta la inversa de la normal). n = 0 -> p null, [0, 1]. */
export function intervaloWilson(exitos, n, { z = 1.959964 } = {}) {
    // p = x/n; d = 1 + z²/n; centro = (p + z²/(2n))/d; margen = z·√(p(1−p)/n + z²/(4n²))/d
    // -> { p, inferior, superior, exitos, n, pasos }
}

/** @param {{alerta: boolean, positivo: boolean}[]} pares  -> { aciertos, omisiones, falsasAlarmas, correctosNegativos, n,
 *  sensibilidad, especificidad, vpp, vpn, exactitud }, cada proporción con su Wilson */
export function matrizConfusion(pares) {}

/** @param {{puntaje: number, positivo: boolean}[]} items  (puntaje = máximo en la ventana de vigilancia)
 *  -> { filas: [{umbral, aciertos, omisiones, falsasAlarmas, correctosNegativos, sensibilidad, tasaFalsasAlarmas, medianaAnticipacion}],
 *       roc: [{fpr, tpr}], auc: { trapecio, mannWhitney, errorEstandar } } */
export function curvaUmbral(items, { paso = 5 } = {}) {}

/** Tasa observada por banda de puntaje en un corte (no es una probabilidad: el puntaje no lo es).
 *  -> { bandas: [{desde, hasta, n, positivos, tasa: Wilson}], monotona: boolean } */
export function calibracion(bt, { corte, bandas = [0, 20, 35, 60, 101] } = {}) {}
```

### 4.3 Los métodos numéricos que se ven

- **Área bajo la curva ROC, calculada de dos formas.**
  - Una es `trapecioDatos(fpr, tpr)`, de `integration/cuadratura.js`.
  - La otra es Mann–Whitney: `Σ[sᵢ > sⱼ] + ½·Σ[sᵢ = sⱼ]` sobre `|P|·|N|`.
  - Con todos los puntajes distintos como umbrales, las dos coinciden. Con la rejilla de 5 en 5, la diferencia es el error de discretización y se muestra.
  - Es el mismo recurso didáctico que bisección contra Newton en el cruce.
  - El error estándar es el de Hanley–McNeil.
- **Wilson** en vez de Wald. Con n = 5, Wald da intervalos absurdos (5 de 5 da [100 %, 100 %]); Wilson da 57–100 %.
- **Calibración en frecuencias naturales.** Ejemplo: «de cada 10 alumnos con 35–59 en la semana 3, 4 llegaron al límite». La bandera `monotona` avisa si el puntaje no ordena bien.
- **Equidad** por grupo, franja y modo de registro: `matrizConfusion` por segmento, con Wilson.
  - Una diferencia se marca como «notable» **solo** si los intervalos no se solapan. Si se solapan, dice «sin diferencia demostrable con estos datos».
  - Si un segmento tiene menos de 5 positivos, sale «pocos casos» y no se muestra la tasa.
- **Prueba de no fuga** (`evaluacion.test.js`): si se cambian al azar, con semilla fija, las columnas posteriores a `c`, los puntajes en `c` no cambian. Más pruebas:
  - Wilson: 5 de 5 da [0.5655, 1] y 3 de 5 da [0.2307, 0.8824].
  - AUC: separación perfecta da 1 y puntajes todos empatados dan 0,5.
  - Reconstrucción con cambios sintéticos y cada regla de R1 a R5.

### 4.4 Caso destacado (el fallo mostrado a propósito)

La regla es determinista. Nunca se escribe una matrícula en el código.

1. **Si hay omisiones** con el umbral actual, se muestra la de evento más temprano.
   - Se recalcula ese alumno en el corte `E − 1` y se listan los dos factores con mayor `maximo − aporte`.
   - Texto: «Se nos escapó: ausentismo crónico estable. Su puntaje antes del límite fue 45–49 (umbral 60). La tendencia (0 de 15) y la racha (5 de 15) casi no sumaron: el modelo premia el cambio, no la constancia.»
   - Es el caso real de E260020 y E260070 con umbral 60.
2. **Si no hay omisiones**, se muestra el alumno con `inicioCambio` (abandono repentino) y el mayor retraso de detección.
   - Ese retraso se mide **por sesión**: el puntaje de ese alumno se recalcula con todo el grupo en cada sesión desde el inicio. Son unas 45 corridas y tardan unos 7 ms.
   - Texto: «Abandono repentino: empezó a faltar el {fecha}; SUSAN lo marcó {d} sesiones después. Antes no había ninguna señal en sus datos.»
   - En 3B y 5C, con umbral 35, d = 2 (E260043 y E260068).

### 4.5 Rendimiento

`backtest` se calcula una vez por grupo y por cambio de datos, en un `useMemo` alimentado con `useDeferredValue`; mientras tanto se muestra un esqueleto. `resumirBacktest` se ejecuta en cada movimiento del umbral o del cabezal. Solo se pasa a un Worker (`new Worker(new URL(...), import.meta.url)`) si en un Android de gama media se mide más de 150 ms.

---

## 5. Interfaz

### 5.1 Lo que se reutiliza

- **De `ui/`:** `Tabs`, `SegmentedControl`, `Pills`, `Button`, `Badge`, `Alert`, `TarjetaGrafica` (con `resumen` obligatorio), `Detalles` (con `montarAlAbrir`), `BarraSegmentada`, `BarrasPildora` (calibración en columnas, con «4 de 10» en `formatoValor`), `GraficaLinea`, `StatCard` (solo en `/analitica/modelo`: evaluados, positivos, excluidos; **sin** `serie`, porque no hay serie real), `PanelLateral`, `EmptyState`, `ErrorState`.
- **De `motion/` y `lib/motion`:** `CountUp`, `Reveal` (entrada del caso destacado), `usePrefersReducedMotion`, `useEnVista`.
- **De `analitica/`:** `SelectorGrupo`, `PanelProcedimiento` y `PasoView`, y `matrizCompleta()` y `useAnalitica()`. La pestaña reutiliza la `serie` y la `matriz` ya cargadas.
- **De `layout/` y `lib/local/`:** `RelojDemo` sin cambios, más `relojCliente.js` y `EVENTO_RELOJ_CAMBIO`.
- **Colores por token, pasados por `colorGrafica`:** aciertos `var(--chart-1)`, omisiones `var(--ausente)`, alertas y falsas alarmas `var(--retardo)` (el mismo ámbar de la matriz), correctos negativos `var(--chart-4)`.

### 5.2 `ui/MatrizCalor` (pieza 3, zona ui-kit, compartida con F06, F17, F20 y F26)

```
components/ui/MatrizCalor/
    MatrizCalor.jsx · matrizCalor.utils.js · MatrizCalor.test.jsx · index.js
```

```jsx
<MatrizCalor
    filas={[{ id, etiqueta, detalle, celdas: [{ valor: 47, estado: 'alerta', titulo: 'Semana 3: 47 de 100, alerta' }] }]}
    // estado de celda: 'normal' | 'alerta' | 'evento' | 'posterior' (tras el evento) | 'excluida'; valor null = sin dato
    columnas={[{ id: 3, etiqueta: 'Semana 3', corta: 'S3', sinClase: false }]}
    escala={{ dominio: [0, 100], color: 'var(--chart-5)', pasos: 5 }}   // secuencial por opacidad del token
    estados={{ alerta: { label: 'Alerta', color: 'var(--retardo)' }, evento: { label: 'Llegó al límite', color: 'var(--ausente)' } }}
    revelarHasta={3}          // columnas posteriores: «futuro» (contorno discontinuo, sin valor)
    columnaActiva={3}         // guía vertical (cabezal)
    onFila={(id) => abrirDetalle(id)}   // la etiqueta de fila es un <button>
    maxFilas={8} leyenda etiqueta="Resumen para lectores" vacio="Sin datos" className
/>
```

- **El color nunca es la única señal.**
  - La alerta lleva anillo (forma).
  - El evento lleva relleno sólido más un punto interior hecho con CSS (sin símbolos de texto ni SVG de icono).
  - Las celdas excluidas llevan rayado diagonal.
  - «Sin clase» es una columna atenuada con «-» en la tabla accesible.
- **Accesibilidad.**
  - El dibujo es `aria-hidden`. Debajo va una `<table className="sr-only">` generada con los mismos datos, con `caption` = `etiqueta` y una frase por celda.
  - El cabezal se anuncia en un `aria-live="polite"` solo al pausar o terminar.
  - Más adelante se puede agregar un explorador con teclado al estilo de `useFilaActiva` de `GraficaLinea`.
- **Movimiento.** Cuando crece `revelarHasta`, cada columna entra con `opacity` en 150 ms. Es dato vivo, no una entrada nueva, igual que en `BarraSegmentada`. Con «reducir movimiento» no hay transiciones. El contenedor con `ref` existe siempre (regla 8 de `SISTEMA.md`). No hay `Math.random` ni `Date.now` en el render.
- **360 px.** Usa `grid-template-columns: minmax(4rem, 6rem) repeat(N, minmax(0, 1fr))`, celdas con `aspect-ratio: 1` y un máximo de 1,75 rem. Las marcas de columna se adelgazan con `adelgazarMarcas`.
- **No sirve `CalendarioAsistencia`**: es semanas por días de una sola persona. Esta es filas por columnas de propósito general.
- Hay que documentarla en `docs/design/SISTEMA.md` («Cuándo usar cada una» y «Contrato resumido»).

### 5.3 Extensión de `ui/GraficaLinea` (ui-kit)

Una prop nueva, `marcasX = [{ valor, etiqueta }]`. Se conserva `marcaX` (objeto) por compatibilidad. Las etiquetas que chocan se resuelven con `cajasSeSolapan`; la que no cabe pasa a la leyenda, igual que hoy pasa con `limite`. La curva la necesita para marcar 35, 60 y el umbral actual.

### 5.4 Componentes nuevos de la pantalla (zona screens-analitica, una carpeta por componente)

```
components/analitica/AuditoriaPronostico/   AuditoriaPronostico.jsx · useAuditoriaPronostico.js (insumos + ahora + backtest diferido)
                                            · auditoriaPronostico.utils.js (8 relevantes, frases en frecuencias) · test · index.js
components/analitica/ControlRebobinado/     ControlRebobinado.jsx · useReproduccion.js (setTimeout 600 ms; pausa si la pestaña se oculta;
                                            reducido -> salta al final) · useSincroniaReloj.js (solo local) · controlRebobinado.utils.js · test · index.js
components/analitica/CifraProtagonista/     la cifra, la frase, el IC y las insignias; si hay menos de 3 aciertos, la cifra es «a de p», no una mediana
components/analitica/CasoDestacado/
components/analitica/CurvaUmbral/          GraficaLinea (umbral) + Detalles con la ROC y su área (serie 'banda' [0, tpr])
components/analitica/FichaModelo/          Detalles imprimible (§6)
components/analitica/TablaEquidad/         solo /analitica/modelo
components/analitica/AuditoriaModelo/      contenedor de /analitica/modelo (recorre grupos con concurrencia 3)
```

`lib/api/reportes.js` (zona data-layer) gana `auditoriaPronosticoGrupo({ idGrupo })`, que llama a `api_auditoria_pronostico_grupo` con el mismo estilo JSDoc que `matrizGrupo`.

Más adelante, una ruta `GET /api/analitica/auditoria?periodo=` (route-handlers) calcularía el agregado en el servidor con `lib/numerics` y caché por periodo y última sesión cerrada. Su orden sería: autenticar, autorizar rol, validar `periodo` con zod contra `^\d{4}-[12]$`. Solo hace falta cuando haya cientos de grupos.

---

## 6. Privacidad, ética y mitigaciones

- **Sin datos nuevos.** El puntaje por alumno ya lo ve el docente en `TablaRiesgo`. La RPC nueva solo devuelve transiciones de estado con fecha, sin comentarios ni usuarios. Ningún dato biométrico: el reconocimiento facial solo aporta el estado de asistencia.
- **Seudónimos por omisión** («Alumno 7») en la pestaña y siempre en proyector. Los nombres solo se ven con el interruptor del docente del grupo, que no se guarda. `/analitica/modelo` no muestra nombres, nunca. Los segmentos con menos de 5 positivos no publican tasas, para evitar la reidentificación (LFPDPPP, minimización). El CSV de exportación es solo agregado.
- **El alumno nunca ve esto.** No hay rankings ni etiquetas visibles para alumnos. El lenguaje es «alerta de asistencia», nunca «alumno en riesgo»: la investigación de KQED muestra que las etiquetas bajan expectativas. La pantalla audita al **modelo**, no a las personas.
- **No usa nada demográfico.** La ficha lo dice explícitamente: ni sexo, edad, lengua indígena, procedencia, beca, domicilio ni calificaciones. La auditoría de equidad usa solo atributos operativos (grupo, franja, modo de registro). Advierte que la franja de las 07:00 puede ser un **sustituto** de la carga de transporte: eso es justo lo que se mide. Auditar por atributos sensibles exigiría consentimiento y un protocolo aparte.
- **Contra la sobreventa (Course Signals).**
  - El título fijo es «Validación del método».
  - «Datos de demostración» aparece siempre que el reloj es simulado.
  - El intervalo y n están siempre visibles.
  - Se prohíbe en el texto y en el guion decir «SUSAN reduce el ausentismo».
  - En 2026-2 la pantalla dice que el acierto es **circular**, porque los patrones k14 a k21 se diseñaron para detectarse. La credibilidad viene de 2026-1 (G1 pre-registrado) y, a futuro, de datos reales.
- **Paradoja de la prevención.** Si los docentes actúan sobre las alertas, los alumnos atendidos no llegan al límite y parecen falsas alarmas. La ficha lo advierte. La validación solo es limpia en periodos sin intervención registrada, o separando los casos atendidos cuando exista el módulo «Tutorías».
- **Otras limitaciones en la ficha.**
  - Con n pequeño, cada alumno pesa unos 4 puntos.
  - En un periodo abierto la verdad es provisional.
  - El puntaje no es una probabilidad.
  - El modelo no predice el **inicio** de un abandono.
  - Granularidad semanal.
  - `sesiones_programadas` se toma de hoy: las reposiciones del 3A cambiaron 45 por 47, aunque el límite sigue en 9.
- **Ajustar el modelo después de ver la prueba es sobreajuste.** Si el hallazgo de los crónicos motiva un factor nuevo («ritmo acumulado»), se valida en **otro** periodo, no en el mismo.

---

## 7. Plan

| Pieza | Zona | MVP-0 (ver que funciona) | MVP (listo para demo) | Completa | Esfuerzo |
|---|---|---|---|---|---|
| `contextoRiesgo` compartido y `lib/numerics/evaluacion` (backtest, resumen, Wilson, matriz de confusión, curva con AUC doble, reconstrucción, pruebas, README) | numerics | sí | sí | más calibración | 2 d |
| `docs/NUMERICS.md` §7 «Validación del pronóstico» (definiciones, reglas, ficha, hash de G1) | numerics | — | sí | — | 0,25 d |
| `api_auditoria_pronostico_grupo` con prueba y documentación | db-api-a | sí | sí | — | 0,75 d |
| Envoltorio en `lib/api/reportes.js` | data-layer | sí | sí | — | 0,1 d |
| `limites.sql` registra en la bitácora (R3 saca a E260001) | demo | sí | sí | — | 0,1 d |
| `ui/MatrizCalor` | ui-kit | sí | sí | explorador con teclado | 1,5 d |
| `GraficaLinea` con `marcasX` | ui-kit | — | sí | — | 0,25 d |
| Pestaña (Tabs en `Analitica.jsx`, control, reproducir, cifra, matriz, barra, caso destacado, ficha) | screens-analitica | sí (sin reloj) | sí | — | 2 d |
| Escena atada al reloj (escuchar, llevar, volver, reproducir en sincronía) | screens-analitica | — | sí | — | 0,5 d |
| Semilla 2026-1 con G1 (`--periodo-cerrado`) y `DEMO.md` | demo | — | sí | pasa a la semilla base | 2–3 d |
| Filtro por periodo en `api_alertas_docente` | db-api-a | — | recomendado | condición previa de la semilla base | 0,25 d |
| `/analitica/modelo` con agregado, calibración, equidad y ficha imprimible | screens-analitica | — | — | sí | 1,5 d |
| Módulo y navegación (§9) | integrador / ui-kit | — | sí | — | 0,1 d |
| Parámetros de umbral 13 y 14, más `contexto.umbrales` | db-schema + numerics | — | — | sí | 1 d |
| `evaluacion_modelo` para publicar la ficha (opcional) | db-schema + db-api-b | — | — | opcional | 1 d |
| Ruta del agregado en el servidor con caché (escala) | route-handlers | — | — | si hay más de 30 grupos | 1 d |

- **MVP-0:** unos 4 días, con 2026-2 y la verdad provisional rotulada. Ya da las cifras reales («5 de 5, 3 semanas; 18 alertas abiertas»).
- **MVP:** unos 9 días. Es el que se presenta.
- **Completa:** unos 4 a 5 días más.

**Peticiones a otras zonas** (cada dueño las hace; la pantalla no las toca):
- db-api-a: la RPC y el filtro de `api_alertas_docente`.
- demo: `limites.sql`, `periodo_cerrado.sql`, la opción en `seed-demo.sh` y `DEMO.md`. Opcional: alinear `casos.js` para que el alumno 18 falte en las reposiciones; es mejor **no** alinearlo y mostrar ese ruido.
- ui-kit: `MatrizCalor`, `marcasX`, la entrada en `Sidebar/navItems.js` y `SISTEMA.md`.
- data-layer: el envoltorio.
- integrador: `modulos.js`.

---

## 8. Guion de demo de 60 s

**Antes de empezar:** `scripts/seed-demo.sh --reset --periodo-cerrado`. Entrar con `admin@` (hace de evaluador). Abrir `/analitica?periodo=2026-1&grupo=<2A>&vista=auditoria`. La ventana va a 1280 px en proyector.

| Tiempo | Qué se hace | Qué se dice |
|---|---|---|
| 0:00–0:07 | La pestaña ya está abierta; se señala la insignia «Validación del método · datos de demostración». | «La pregunta de cualquier evaluador: ¿cómo saben que el puntaje de riesgo acierta? Lo comprobamos con un semestre que ya terminó.» |
| 0:07–0:13 | Control en la semana 3. «Llevar el reloj a esta semana»: la tarjeta del reloj de arriba cambia a «lunes 23-feb-2026». | «La app vuelve, literalmente, al 23 de febrero. SUSAN solo ve lo que se sabía ese lunes.» |
| 0:13–0:23 | «Reproducir». La matriz se enciende semana a semana y el reloj de arriba avanza con ella. | «Ámbar es cuando SUSAN avisó. Rojo, cuando el alumno llegó al límite de faltas. Fíjense cuánto espacio hay entre los dos.» |
| 0:23–0:32 | Aparece la cifra grande: «{m} semanas antes», con «avisó a {a} de {p} · {f} falsas alarmas · IC 95 %». | «Con 25 alumnos, cada uno pesa 4 puntos. Por eso siempre mostramos el intervalo, no solo el porcentaje.» |
| 0:32–0:41 | Tarjeta del caso destacado. | «Y este no se podía prever: abandono repentino. Lo marcó dos sesiones después de que empezó a faltar. Ningún dato de asistencia avisa antes de la primera falta.» |
| 0:41–0:51 | Pills 35 → 60: los anillos desaparecen y la marca de la curva se mueve. Las cifras se recalculan al instante. | «Subir el umbral quita falsas alarmas, pero se escapan los ausentistas crónicos: el modelo premia el cambio, no la constancia. El umbral se elige con esta curva, no por intuición.» |
| 0:51–1:00 | Abrir «Ficha del modelo»: 7 factores con sus pesos y «Nada demográfico». Pulsar «Volver al 14-sep». | «Siete factores explicables, cero datos personales sensibles, n y limitaciones a la vista. Es validación del método, no la promesa de que SUSAN reduzca el ausentismo.» |

Las cifras de 2026-1 se leen en vivo de la primera corrida y no se ensayan con valores inventados.

**Variante B, sin 2026-1:** las mismas acciones sobre el 3B de 2026-2. Se dice: «5 de 5 que ya llegaron al límite, 3 semanas antes; 18 alertas siguen abiertas porque el semestre no ha terminado». Con umbral 60, en el 3A el caso destacado pasa a ser el ausentista crónico que se escapó.

---

## 9. Entrada para `web/src/lib/modulos.js`

Es un módulo nuevo (no eleva ninguno de los «pronto»). Mientras se construye entra como `'pronto'`:

```js
{
    id: 'auditoria-pronostico', titulo: 'Auditoría del pronóstico',
    descripcion: '¿Lo habríamos visto venir? Rebobina el semestre y comprueba si las alertas de riesgo llegaron a tiempo.',
    icono: History, categoria: 'analisis', roles: ['docente', 'administrador'], estado: 'pronto', tono: 'violeta',
    queIncluye: ['Rebobinar el semestre semana a semana', 'Aciertos, falsas alarmas y semanas de anticipación con su intervalo',
                 'Curva para elegir el umbral y ficha del modelo imprimible'],
},
```

Al activarlo cambia a `estado: 'activo', href: '/analitica/modelo'` y se quita `queIncluye`. Por la prueba de `modulos.test.js` que exige que cada activo esté en la navegación de su rol, hay que agregar en `components/layout/Sidebar/navItems.js` (grupo «Análisis», para administrador y docente):

```js
{ href: '/analitica/modelo', label: 'Auditoría del pronóstico', icon: History, grupo: 'Análisis' },
```

`History` existe en el `lucide-react` instalado. También hay que actualizar `docs/design/MODULOS.md`.

---

Archivos de medición, fuera del repo (los datos son una exportación de solo lectura de la base local), en `/tmp/susan-scratch`:
- `proto.mjs`: backtest con umbral 35 y 60.
- `trayectorias.mjs`: puntaje por semana de cada alumno.
- `sesion.mjs`: puntaje sesión por sesión de k18 y k20.
- `bench.mjs`: costo en milisegundos.
- `prevalencia.mjs`: solo el generador G1, sin el detector.
- `datos.json`: la exportación de la base.