> **BORRADOR PARCIAL (pantallas P-07, P-08 y /analitica).** Las RPC de reportes y la API de `lib/numerics` las fijan el SQL (`COMMENT ON FUNCTION`) y `docs/NUMERICS.md`; este borrador describe solo las pantallas y sus datos.

# Dominio REPORTES: acumulados, reportes, portal del alumno y analítica numérica

Documento: `docs/api/reportes-analitica.md`. Fuente de verdad para db-api-a (SQL), numerics (`web/src/lib/numerics/**`),
data-layer (`web/src/lib/api/reportes.js`) y screens-reportes / screens-analitica.
Fuentes: `docs/spec/Avance1.txt` (RF Tabla 3, parámetros Tabla 4, RN Tabla 2, Tabla 12 y 13, diccionario 14-32,
P-07 Tabla 43, P-08 Tabla 44, §3.2.2 y §3.2.3, §4.1 y §4.3) y `docs/ARCHITECTURE.md`.

**Estado: BASE.** El diseño visual es mínimo a propósito (el usuario pidió solo la base funcional; el rediseño vendrá
después). Este documento describe contenido y comportamiento, no estética. Todo debe funcionar a 360 px (RNF-13).

## 0. Convenciones del dominio

| Tema | Regla |
|---|---|
| Sesiones que cuentan | `sesion_clase.estatus <> 'suspendida'` (extensión ARCHITECTURE §8.1). Una sesión `programada` futura SÍ cuenta en el denominador de RN-11. |
| Porcentajes (SQL, reportes, CSV) | Escala 0 a 100 con 2 decimales (`18.75`). Claves `porcentaje_*`, `limite_pct`, `asistencia_promedio`. |
| Tasas (series y JS) | Fracción 0 a 1 (`0.1250`), claves `tasa_*`. La UI las formatea a porcentaje. |
| Faltas equivalentes | `ausencias + floor(retardos / retardos_por_ausencia)`. `justificado` y `pendiente` no cuentan (RN-10, RN-11). |
| Límite (RN-11) | `supera_limite` = `faltas_equivalentes * 100 > porcentaje_max_ausencias * sesiones_programadas` (aritmética exacta, sin redondear). Exactamente 20.00 % conserva el derecho. |
| Código compacto de estado | `P` presente, `R` retardo, `A` ausente, `J` justificado, `?` pendiente, `-` sin registro en esa sesión. |
| Día de la semana | ISO: 1 = lunes … 7 = domingo (el horario solo usa 1 a 6). |
| Semana ISO | `semana_iso` (1 a 53) junto con `anio_iso` (la semana 53 de 2026 contiene 2027-01-01). |
| Nombre de persona | `nombre_completo` = `apellido_paterno [apellido_materno] nombres` (p. ej. `García López Ana María`). Orden de listas: `apellido_paterno, apellido_materno NULLS FIRST, nombres, id_alumno`. |
| Marca † en una RPC | La RPC deja constancia `consulta` en bitácora (RF-19, RNF-08). |
| Rol en tablas | ADM administrador, DOC docente, ALU alumno, TEC técnico. |
| Paginación | `p_limit` (def. según RPC, tope 200; `NULL` o `< 1` equivale al default) y `p_offset` (`NULL` o `< 0` equivale a 0). Nunca error por esos valores. |
| JS vs API | La API devuelve `snake_case`. El módulo numérico recibe esos objetos tal cual y devuelve `camelCase`. |

## 1. Alcance y trazabilidad

Cubre M6 (acumulados y alertas), M7 (reportes y consultas) y el análisis por métodos numéricos (objetivo del proyecto:
identificar patrones de ausentismo para orientar la intervención docente oportuna y reducir el tiempo de pase de lista).

| Requisito | Artefacto que lo cubre |
|---|---|
| RF-13 Faltas equivalentes | Vista `v_resumen_asistencia.faltas_equivalentes`; `api_reporte_grupo`, `api_alumno_resumen`; columna P-07 «Faltas eq.»; pruebas V01, V04, V10. |
| RN-10 3 retardos = 1 ausencia | Misma vista, parámetro `retardos_por_ausencia` (RNF-02); pruebas V01, V04, V10. |
| RF-14 Recalcular y notificar | `app.recalcular_inscripcion`, `app.recalcular_grupo`, `app.recalcular_todo`; bitácora `notificacion` solo al cambiar de estado; `api_alertas_asistencia`; pruebas R01 a R12. |
| RN-11 20 % y derecho reversible | `v_resumen_asistencia.supera_limite/en_limite`, `inscripcion.derecho_examen`; P-07 columna «Derecho»; alertas de P-02 (dominio docente puede reutilizar `api_alertas_asistencia`); pruebas V02, V03, V07, V11, R01 a R06. |
| RF-17 Reportes filtrables, CSV | `api_reporte_filtros`, `api_reporte_grupo`, `api_reporte_periodo`; pantalla P-07 `/reportes`; `ReporteExportar` (CSV en cliente) y `HojaImpresion` (PDF con `window.print()`); pruebas P01 a P14, 6.3. |
| RF-21 Portal del alumno | `api_alumno_resumen`, `api_alumno_historial`, `api_serie_alumno` (solo propios, sin imágenes); pantalla P-08 `/alumno`; pruebas A01 a A09. |
| RF-19 (consultas de asistencia en bitácora, solo grupos propios) | Guardia `app.exigir_reporte_grupo` + †: `api_reporte_grupo`, `api_reporte_periodo`, `api_matriz_grupo`, `api_serie_alumno`; pruebas P06, P08, S12, X01. |
| RNF-02 Parámetros configurables | Se leen siempre con `app.param_num`: `retardos_por_ausencia`, `porcentaje_max_ausencias`, `minutos_pase_lista_base`. |
| RNF-03 Sin imágenes ni vectores | Ninguna RPC de este dominio devuelve `objeto_*`, detecciones ni scores; prueba X03. |
| RNF-08 Trazabilidad | Bitácora `notificacion` (cambio de derecho) y `consulta` (†). |
| RNF-10 Integridad | Solo lectura salvo `inscripcion.derecho_examen` (único campo que escribe este dominio) y bitácora. |
| RNF-11 Usabilidad | Reporte y portal a una pantalla, filtros en la URL, sin pasos intermedios. |
| RNF-13 360 px | Tablas con modo tarjeta bajo 640 px; gráficas de `components/ui` (SVG/CSS) que miden su ancho con `ResizeObserver` y no desbordan; 6.3. |
| Objetivo «reducir tiempos operativos» (spec §4.1) | `api_impacto_tiempo` (estimación) + componente `ImpactoTiempo`. |
| Objetivo «patrones de ausentismo» | `api_serie_grupo`, `api_matriz_grupo`, `api_serie_alumno`, `web/src/lib/numerics/**`, pantalla `/analitica`. |
| P-07 Tabla 43 (marcadores 1 a 5) | Filtros, KPIs, faltas equivalentes sobre sesiones programadas, derecho a examen, exportar. |
| P-08 Tabla 44 (marcadores 1 a 5) | Resumen por materia, historial, estatus de justificante (dato de solo lectura aquí), botón «Justificar» (formulario = dominio `revision`). |

---

## 2. Pantallas

Rutas (ARCHITECTURE §3): `/reportes` (ADM, DOC), `/alumno` (ALU), `/analitica` (ADM, DOC). Las páginas son delgadas: la
`page.jsx` lee `searchParams` (asíncrono) y monta un único componente contenedor. El layout `(app)` ya aplica el control
por rol; aun así toda RPC valida el rol (un acceso indebido devuelve `NO_AUTORIZADO`).

Estados comunes (usar `DataState` del ui-kit): **carga** = `Spinner` con texto «Cargando…»; **error** = `ErrorState` con el
`message` del `ApiError` y botón «Reintentar»; `NO_AUTORIZADO` muestra «No tienes acceso a este grupo.» sin botón.
Todas las fechas se muestran `dd/mm/aaaa` en la zona `TIMEZONE` (config.js); las horas `HH:mm`.

### 2.1 P-07 Reporte de asistencia por grupo y periodo: `/reportes`

- **Roles**: ADM (todos los grupos), DOC (solo los suyos, impuesto por la base).
- **Objetivo**: acumulados de un grupo en el periodo, derecho a examen y exportación (RF-17, RF-13, RF-14).
- **URL como estado**: `/reportes?periodo=2026-2&grupo=12&alumno=345` (todos opcionales). Los cambios de filtro hacen
  `router.replace` (sin recargar la página completa).
- **Datos que carga** (en este orden):
  1. `reporteFiltros({ periodo })` -> `api_reporte_filtros(p_periodo)`: periodos y grupos accesibles. Si no hay `periodo` en
     la URL se usa `periodo_actual` de la respuesta.
  2. Con `grupo` en la URL: `reporteGrupo({ idGrupo, idAlumno?, limit: 200, offset })` -> `api_reporte_grupo`. Si `total > 200`
     el componente pide las páginas siguientes (la exportación necesita todas).
  3. ADM sin `grupo` (o DOC sin `grupo`): `reportePeriodo({ periodo })` -> `api_reporte_periodo` (una fila por grupo).
  4. `impactoTiempo({ idGrupo?, periodo })` -> `api_impacto_tiempo` (tarjeta secundaria; si falla no bloquea el reporte).
- **Acciones**:
  - Cambiar periodo, grupo o alumno (filtros; alumno se elige de las filas ya cargadas del grupo).
  - Clic en una fila de grupo (vista por periodo) -> fija `grupo` en la URL.
  - «Exportar CSV» (cliente, sección 2.1.1), «Imprimir / PDF» (`window.print()`), «Ver analítica» -> `/analitica?grupo=ID`.
  - Con un alumno seleccionado se muestra su detalle sesión por sesión (`detalle` de `api_reporte_grupo`).
- **Estados vacíos**: sin grupos -> «No hay grupos para este periodo.»; grupo sin inscritos -> «El grupo no tiene alumnos
  inscritos.»; `sesiones_programadas = 0` -> aviso «Aún no hay sesiones programadas: el porcentaje se calculará al generar
  el horario.» y la columna de porcentaje muestra «—».
- **360 px**: filtros apilados en una columna; KPIs en rejilla de 2 columnas; `ReporteTabla` pinta `<table>` desde 640 px
  y una lista de tarjetas (una por alumno, mismos datos) por debajo; sin scroll horizontal de página.

**Columnas de `ReporteTabla`**: Matrícula, Alumno, Presentes, Retardos, Ausencias, Justificadas, Pendientes, Faltas eq.,
% faltas (`18.75 %`), Faltas restantes, Derecho (`DerechoBadge`). La fila con `derecho_examen = false` se marca con el
texto «Sin derecho» (no solo color); `en_limite` con «En el límite».

**Componentes** (`web/src/components/reportes/<Nombre>/`):

| Componente | Props | Responsabilidad |
|---|---|---|
| `ReporteAsistencia` | `{ rol: 'administrador'\|'docente', filtrosIniciales: { periodo?: string, idGrupo?: number, idAlumno?: number } }` | Contenedor. Sincroniza URL, llama a las RPC, decide vista de periodo o de grupo, pagina. Hook propio `useReporteAsistencia`. |
| `ReporteFiltros` | `{ periodos: string[], grupos: GrupoOpcion[], alumnos: {idAlumno:number, nombreCompleto:string}[], valor: {periodo, idGrupo, idAlumno}, onCambio(valor) }` | Tres `Select`; al cambiar periodo limpia grupo y alumno. `GrupoOpcion` = fila de `api_reporte_filtros.grupos`. |
| `ReporteKpis` | `{ kpis: object }` (clave `kpis` de `api_reporte_grupo`) | Cuatro `StatCard` de Tabla 43: Sesiones cerradas (`sesiones_cerradas` de `sesiones_programadas`), Asistencia promedio (`asistencia_promedio` %), Alumnos en el límite, Alumnos sin derecho. |
| `ReporteTabla` | `{ items: ReporteFila[], limitePct: number, seleccionado?: number, onSeleccionar?(idAlumno) }` | Tabla/tarjetas descritas arriba. |
| `ReportePeriodoTabla` | `{ items: ReporteGrupoFila[], onAbrirGrupo(idGrupo) }` | Una fila por grupo: Grupo, Materia, Docente, Inscritos, Sesiones cerradas/programadas, Asistencia promedio, En el límite, Sin derecho. |
| `ReporteExportar` | `{ reporte: object, tipo: 'grupo'\|'periodo' }` | Botones «Exportar CSV» y «Imprimir / PDF». Usa `reporteCsv.utils.js`. No hace llamadas de red. |
| `HojaImpresion` | `{ reporte: object, tipo }` | Versión para papel (tabla completa, título, filtros aplicados, `generado_en`). Oculta en pantalla (`hidden print:block`); el resto de la página lleva `print:hidden`. |
| `DerechoBadge` | `{ derechoExamen: boolean, enLimite: boolean }` | `Badge` con texto «Sin derecho» / «En el límite» / «Con derecho». |
| `ImpactoTiempo` | `{ impacto: object }` (respuesta de `api_impacto_tiempo`) | Tarjeta: sesiones automáticas vs manuales, minutos y horas recuperados, y la leyenda «Estimación: sesiones automáticas × N min de pase de lista manual.» (`nota` de la respuesta). Reutilizado por `/analitica`. |

Utilidades puras de `ReporteExportar/reporteCsv.utils.js`: `construirCsvGrupo(reporte)`, `construirCsvPeriodo(reporte)`,
`nombreArchivoCsv(reporte, tipo)`, `escaparCelda(valor)`, `descargarCsv(texto, nombre)` (Blob + `<a download>`).

#### 2.1.1 Exportación CSV (cliente) y PDF

El CSV se arma en el navegador con los datos ya cargados (autorizados por RLS); no existe Route Handler.

- Codificación UTF-8 **con BOM** (`﻿` al inicio). Separador **coma**. Fin de línea `\r\n` (también tras la última fila).
- Una celda se encierra en comillas dobles si contiene `,`, `"`, `\r` o `\n`; las comillas internas se duplican.
- Anti inyección de fórmulas: si un texto empieza con `=`, `+`, `-`, `@`, tabulador o `\r`, se antepone `'`.
  (Los números no se prefijan.)
- Decimales con punto, sin separador de miles. Booleanos de derecho: `Sí` / `No`. Valor ausente (`null`): celda vacía.

**CSV de grupo** (una fila por alumno activo, orden de la tabla; encabezado exacto, 17 columnas):

```
Periodo,Grupo,Materia,Matrícula,Apellido paterno,Apellido materno,Nombres,Sesiones programadas,Presentes,Retardos,Ausencias,Justificadas,Pendientes,Faltas equivalentes,Porcentaje de faltas,Faltas restantes,Derecho a examen
```

Origen de cada columna (`reporte` = respuesta de `api_reporte_grupo`): `grupo.periodo`, `grupo.clave_grupo`,
`grupo.materia_nombre`, `items[].matricula`, `apellido_paterno`, `apellido_materno`, `nombres`, `sesiones_programadas`,
`presentes`, `retardos`, `ausencias`, `justificadas`, `pendientes`, `faltas_equivalentes`, `porcentaje_faltas` (2 decimales),
`faltas_restantes_antes_limite`, `derecho_examen` -> `Sí`/`No`. Ejemplo:

```
2026-2,3A,Contabilidad Financiera,A210045,García,López,Ana María,48,25,3,2,0,0,3,6.25,6,Sí
2026-2,3A,Contabilidad Financiera,A210071,"Pérez, hijo",,Luis,48,12,5,9,3,1,10,20.83,0,No
```

**CSV de periodo** (una fila por grupo; 10 columnas):

```
Periodo,Grupo,Materia,Docente,Inscritos,Sesiones programadas,Sesiones cerradas,Asistencia promedio,Alumnos en el límite,Alumnos sin derecho
```

**Nombre de archivo**: `asistencia_<periodo>_<materia_clave>-<clave_grupo>_<AAAAMMDD>.csv` en minúsculas, solo
`[a-z0-9_-]` (el resto se sustituye por `-`); la fecha sale de `generado_en` (no de `Date.now()`). Periodo:
`asistencia_<periodo>_periodo_<AAAAMMDD>.csv`. Ejemplo: `asistencia_2026-2_adm301-3a_20261014.csv`.

**PDF**: `window.print()` sobre `HojaImpresion`. Requiere (ver 7.4) que `AppShell/Sidebar/Topbar` usen `print:hidden` y que
`globals.css` defina `@page` A4 horizontal. No se genera PDF en servidor.

### 2.2 P-08 Portal del alumno: `/alumno`

- **Rol**: ALU (solo propios; sin imágenes ni detecciones).
- **Objetivo**: resumen por materia del periodo con porcentaje frente al 20 %, historial por sesión y proyección simple (RF-21).
- **Datos**:
  1. `alumnoResumen({ periodo? })` -> `api_alumno_resumen`. Sin `periodo` usa el más reciente del alumno
     (`periodos_disponibles` permite cambiarlo).
  2. Al elegir una materia (por defecto la primera): `alumnoHistorial({ idGrupo, limit: 50, offset })` ->
     `api_alumno_historial` y `serieAlumno({ idGrupo })` -> `api_serie_alumno` (con `p_id_alumno` omitido = el propio) para la
     proyección (`proyeccionAlumno` del módulo numérico).
- **Acciones**: elegir periodo; elegir materia; paginar historial; «Justificar» en filas con `puede_justificar = true`
  (invoca `onJustificar(item)`; el formulario, la carga del documento y el estatus nuevo son del dominio `revision`).
  Tras el éxito de ese formulario el contenedor recarga historial y resumen.
- **Avisos** (constante `UMBRAL_AVISO_FALTAS = 2` en `alumno.utils.js`): `supera_limite`/`derecho_examen=false` -> «Superaste el
  límite de faltas: sin derecho a examen.»; `en_limite` -> «Estás en el límite: una falta más y pierdes el derecho a examen.»;
  `faltas_restantes_antes_limite <= 2` -> «Te quedan N falta(s) antes del límite.». Nota fija: «Los registros pendientes de
  revisión no cuentan hasta que el docente los resuelva.» (Tabla 44, marcador 1).
- **Estados vacíos**: sin inscripciones en el periodo -> «No tienes materias inscritas en este periodo.»; sin sesiones
  cerradas -> «Aún no hay sesiones registradas en esta materia.»; menos de 4 sesiones cerradas -> la proyección muestra
  «Aún no hay suficientes sesiones para proyectar.».
- **360 px**: tarjetas de materia apiladas; el historial es una lista (fecha, estado con `StatusChip`, hora, origen, justificante)
  y no una tabla ancha.

| Componente (`web/src/components/alumno/<Nombre>/`) | Props | Responsabilidad |
|---|---|---|
| `AlumnoPortal` | `{ periodoInicial?: string, renderJustificante?: (ctx: { item: object, grupo: object, onListo(): void }) => ReactNode }` | Contenedor y hook `useAlumnoPortal`. `renderJustificante` es el punto de enganche con el dominio `revision` (se muestra en un `Modal` al pulsar «Justificar»). |
| `ResumenMateria` | `{ item: object, seleccionada: boolean, onSeleccionar(idGrupo) }` | Tarjeta: materia, grupo, `porcentaje_faltas` frente a `limite_pct`, `faltas_equivalentes` de `faltas_maximas_permitidas`, restantes, desglose (presentes, retardos, ausencias, justificadas, pendientes), avisos. Barra con `<progress>` y texto. |
| `HistorialSesiones` | `{ items: object[], total: number, limit: number, offset: number, onPagina(offset), onJustificar?(item) }` | Lista/tabla: fecha, hora, `StatusChip` del estado (o «Sin registro»), origen (automático/manual/corrección), estatus de justificante (pendiente/aprobado/rechazado), botón «Justificar». Sesiones `suspendida` con la etiqueta «Suspendida». `Pagination` del ui-kit. |
| `ProyeccionAlumno` | `{ proyeccion: object }` (resultado de `proyeccionAlumno`) | Texto de la proyección simple: ritmo, faltas proyectadas al final del periodo, si superaría el límite y en cuántas sesiones. Declara que es una estimación. |

### 2.3 Analítica numérica: `/analitica`

- **Roles**: ADM, DOC (DOC solo grupos propios por RLS/guardia).
- **Objetivo**: patrones y proyección del ausentismo de un grupo con métodos numéricos, mostrando el procedimiento.
- **URL**: `/analitica?periodo=2026-2&grupo=12`.
- **Datos**: `reporteFiltros({ periodo })` (selectores); con grupo: en paralelo `serieGrupo({ idGrupo })` y
  `matrizGrupo({ idGrupo, limit: 200, offset })` (se repite hasta cubrir `total`). `/analitica` ya no pide `impactoTiempo` ni muestra la tarjeta
  `ImpactoTiempo` (queda solo en `/reportes`).
  Con ambas respuestas el hook `useAnalitica` ejecuta `analizarGrupo({ serie: serie.items, matriz, limitePct: serie.limite_pct,
  sesionesProgramadas: serie.sesiones_programadas, opciones: { retardosPorAusencia: serie.retardos_por_ausencia } })` dentro
  de `useMemo` (cálculo síncrono, < 50 ms para 60 alumnos x 100 sesiones).
- **Contenido** (de arriba abajo; las gráficas son la familia hecha a mano de `components/ui`, sin recharts: ver `docs/design/SISTEMA.md`):
  1. Encabezado con el botón «Exportar resumen CSV» (solo con el análisis listo) y `SelectorGrupo` (periodo y grupo).
  2. `TarjetasAnalitica`, cuatro `StatCard`: **Ausentismo actual** (`resumen.tasaActual` en %, con variación en puntos porcentuales
     frente a la semana previa); **Proyección al cierre** (último punto de `proyeccion.puntos` con su intervalo); **Cruce del límite**
     (`cruceLimite`: «Semana 11» estimada, «No cruza», «Ya superado» o «-» sin datos); **Alumnos en riesgo** (`resumen.alumnosEnRiesgo` de
     `alumnosEvaluados`). Solo «Ausentismo actual» y «Cruce del límite» llevan línea de tendencia (`serie`), y solo con series observadas.
  3. `AlertasAnalitica` (`alertas[]` de más a menos grave, con nivel textual «Alta / Media / Info»; las 3 primeras a la vista y el resto
     plegado en `Detalles`).
  4. `GraficaSerie` (sobre `ui/GraficaLinea`, SVG propio, dentro de `ui/TarjetaGrafica`): tasa semanal observada (puntos), ajuste
     (línea), proyección (línea discontinua) con banda de intervalo y medias móviles SMA/EMA/WMA activables con casillas (`Checkbox`).
  5. `GraficaAcumulado` (sobre `GraficaLinea`): faltas equivalentes acumuladas promedio (% de las sesiones programadas), su ajuste y
     línea de referencia en el límite (20 %), con la semana estimada de cruce marcada en vertical. En pantallas anchas (`lg`) va junto a la 4.
  6. `PatronSemanal` (sobre `ui/TiraSemana`, mapa de calor): tasa por día de la semana, con la cifra en cada casilla; el día crítico se
     marca con anillo y se nombra en texto (descripción y detalle «Ver cifras por día»), no solo en color.
  7. `TablaRiesgo`: anillo con la distribución por nivel (`AnilloEstados`), ranking de píldoras con los 8 de mayor puntaje
     (`BarrasPildora`) y la tabla completa plegada en `Detalles` («Ver tabla completa»): nivel, puntaje, tendencia, faltas eq. con barra de
     uso del límite (`BarraSegmentada`), restantes y semana estimada de cruce; cada fila despliega el detalle (acción sugerida, factores con
     nombre, aporte y explicación, enlace al historial en `/reportes` y «Ver el procedimiento del puntaje»).
  8. `PanelProcedimiento`: una divulgación general («Ver el procedimiento paso a paso») con una `Detalles` por cada elemento de `analisis.procedimientos` que traiga pasos o traza (valor didáctico):
     **Regresión** (sumas, ecuaciones normales y su eliminación gaussiana), **Suavizado** (tabla t, y, SMA, EMA, WMA), **Proyección**
     (candidatos con r², AIC y error LOO), **Cruce: bisección**, **Cruce: Newton-Raphson** (tablas `iter, x, f(x), error`) y **Cambio de
     nivel** (CUSUM/EWMA). El procedimiento de cada alumno vive en el detalle de su fila de `TablaRiesgo`.
- **Estados**: carga con `Spinner`; sin grupo seleccionado -> «Elige un grupo para analizar.»; grupo sin sesiones cerradas ->
  «Este grupo aún no tiene sesiones cerradas.»; `analisis.resumen.suficiente = false`
  -> alerta `DATOS_INSUFICIENTES` visible y las tarjetas/gráficas dependientes muestran «Datos insuficientes: se requieren al menos
  4 semanas con sesiones cerradas.»; el patrón semanal y la tabla de riesgo sí se muestran; `alumnosEnRiesgo` vacío ->
  «Ningún alumno en riesgo con los datos actuales.».
- **Accesibilidad mínima**: cada gráfica va en una `TarjetaGrafica`, un `<figure role="group">` con título y un resumen de texto `sr-only`
  enlazado con `aria-describedby` (p. ej. «Ausentismo semanal, tendencia al alza de 0.8 puntos por semana»). `GraficaLinea` es un
  `role="group"` enfocable con `aria-label`, navegable con ← → Home End (Esc cierra la guía), con una región `aria-live` que anuncia la
  fila activa y una lista oculta con una frase por fila; los mismos datos están en el panel de procedimiento. `TiraSemana`, `AnilloEstados`
  y `BarrasPildora` dibujan `aria-hidden` y traen su propio texto (cifras, leyenda o lista oculta).
- **360 px**: tarjetas en 1 columna (2 desde 480 px y 4 desde `xl`); `GraficaLinea` con `alto={280}` y ancho medido con `ResizeObserver`;
  `AnilloEstados`, `BarrasPildora` y `TiraSemana` se adaptan al ancho del contenedor; leyenda bajo la gráfica; la tabla de riesgo oculta
  columnas secundarias bajo `md`/`xl` (sus valores van en el detalle de la fila) y se desplaza dentro de su propio contenedor, sin scroll
  horizontal de página.

| Componente (`web/src/components/analitica/<Nombre>/`) | Props | Responsabilidad |
|---|---|---|
| `Analitica` | `{ filtrosIniciales: { periodo?: string, idGrupo?: number } }` | Contenedor; hook `useAnalitica({ idGrupo })` -> `{ estado: 'sin_grupo'\|'cargando'\|'error'\|'vacio'\|'listo', error, serie, matriz, analisis, recargar() }`. |
| `SelectorGrupo` | `{ periodos: string[], grupos: GrupoOpcion[], valor: {periodo, idGrupo}, onCambio(valor), deshabilitado?: boolean }` | Dos `Select`; al cambiar el periodo limpia el grupo. |
| `TarjetasAnalitica` | `{ resumen, tendencia, proyeccion, cruceLimite, limitePct }` | Las cuatro `StatCard` (contenido 2). |
| `AlertasAnalitica` | `{ alertas: Alerta[] }` | Alertas con nivel y mensaje (el código va en `data-codigo`); `Alert` del ui-kit; las 3 primeras a la vista y el resto en `Detalles`. |
| `GraficaSerie` | `{ tendencia, suavizado, proyeccion, resumen, cruceLimite, limitePct }` | Contenido 4 (sobre `GraficaLinea`); casillas de series; datos combinados por `semana`. |
| `GraficaAcumulado` | `{ cruceLimite, limitePct }` | Contenido 5 (sobre `GraficaLinea`). |
| `PatronSemanal` | `{ patronSemanal }` | Contenido 6 (sobre `TiraSemana`). |
| `TablaRiesgo` | `{ items: AlumnoRiesgo[], evaluados: number\|null, hrefHistorial(idAlumno): string }` | Contenido 7: distribución, ranking y tabla plegada con factores; el procedimiento por alumno va en el detalle de cada fila. |
| `PanelProcedimiento` | `{ procedimientos: { id: string, titulo: string, pasos?: Paso[], traza?: object[] }[] }` | `Detalles` por cada procedimiento con pasos o traza; cada paso se pinta con `PasoView` y cada traza con `TablaIteraciones`. |
| `PasoView` | `{ paso: Paso }` | Pinta `titulo`, `texto` (primera frase a la vista y el resto tras «Más»), lista de `valores`, `tabla` o `matriz` (tabla numérica con 6 decimales significativos). Solo presentación. |
| `TablaIteraciones` | `{ traza: object[], caption?: string }` | Traza de un método iterativo (columnas = claves del primer elemento). Solo presentación. |

La pantalla `/analitica` no muestra puntajes de riesgo al alumno ni los exporta (ver riesgos, 7.3).

### 2.4 Capa de datos (`web/src/lib/api/reportes.js`, la genera data-layer)

Una función `async` por RPC (camelCase, argumentos sin `p_`), devuelve `data` o lanza `ApiError`:

| Función | RPC | Argumentos |
|---|---|---|
| `reporteFiltros` | `api_reporte_filtros` | `{ periodo? }` |
| `reporteGrupo` | `api_reporte_grupo` | `{ idGrupo, idAlumno?, limit?, offset? }` |
| `reportePeriodo` | `api_reporte_periodo` | `{ periodo, idGrupo?, limit?, offset? }` |
| `alertasAsistencia` | `api_alertas_asistencia` | `{ idGrupo?, limit?, offset? }` |
| `alumnoResumen` | `api_alumno_resumen` | `{ periodo? }` |
| `alumnoHistorial` | `api_alumno_historial` | `{ idGrupo, limit?, offset? }` |
| `impactoTiempo` | `api_impacto_tiempo` | `{ idGrupo?, periodo? }` |
| `serieGrupo` | `api_serie_grupo` | `{ idGrupo }` |
| `matrizGrupo` | `api_matriz_grupo` | `{ idGrupo, limit?, offset? }` |
| `serieAlumno` | `api_serie_alumno` | `{ idGrupo, idAlumno? }` |

Los argumentos `undefined` no se envían (se aplica el default SQL).

---
