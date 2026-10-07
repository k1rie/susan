# Frente F6: justificantes, revisión, pase de lista manual y filtros de análisis

Zona (autorizada por el lead a cruzar `docs/ARCHITECTURE.md` §7 solo en estos archivos): `alumno/RegistrarJustificanteForm`,
`revision/{JustificanteCard,ResolverComo}`, `sesion/{RegistroManualDialog,PaseListaManual,CierreSesionDialog}`,
`reportes/FiltrosReporte`, `analitica/SelectorGrupo`. Sin cambios de RPC, rutas ni payloads: todo es presentación y validación de
conveniencia. Referencias: auditoría §3.6 y §3.7, patrones P3, P4, P6 y P12 de `referencias-campos-y-validacion.md`, P8 de
`referencias-flujos-guiados.md`.

## Antes → después por formulario

### `PaseListaManual` (se conserva el rediseño de `main`; solo se añade el aviso de cambios sin guardar)

El frente F6 propuso reescribir esta pantalla (un `SegmentedControl` por alumno, «Todos presentes», «Limpiar», búsqueda, «Deshacer»,
`FormActions` pegada al pie y confirmación con `CierreSesionDialog`). Mientras tanto, el PR de «pasar lista por pasos» ya había
fusionado en `main` su propio rediseño de la misma pantalla: botones de alternancia de un toque (`aria-pressed`), franja
`PasosPaseLista`, tarjeta de avance y «Marcar restantes según la hora». Para no pisar ni duplicar ese diseño, **este PR no reemplaza la
pantalla**: conserva la de `main` y añade solo lo que no tenía.

| Antes (en `main`) | Después |
|---|---|
| Las marcas viven en estado local: recargar, cerrar la pestaña o salir por el riel o la barra inferior las pierde en silencio | `useCambiosSinGuardar` avisa en los tres casos. Hay cambios cuando alguna marca difiere de lo guardado en el servidor; al guardar y actualizar los datos el aviso se apaga solo. Payload idéntico |

Quedan como propuesta futura, por si el pase de 30 a 40 alumnos lo pide: «Todos presentes», búsqueda por nombre o matrícula, «Deshacer» y
«Ir al primero sin marcar». La propuesta completa (con estados, textos y pruebas) estuvo en la rama de trabajo y no se incluye aquí.

### `RegistroManualDialog`

`<select>` de ~40 alumnos + `<select>` de estado → `Combobox` (búsqueda sin acentos; opción de dos líneas: nombre y «matrícula · Sin
lecturas válidas / Sin consentimiento vigente», con avatar) + `SegmentedControl` del estado con la sugerencia ya elegida y el texto
«Sugerido según la hora: …» (tilde corregida). Nuevo **«Guardar y registrar otro»**: guarda, deja el diálogo abierto, vacía la elección,
devuelve el foco al campo, no vuelve a ofrecer al registrado (aunque el monitor tarde en refrescar) y dice «Registrado: X como Presente».
El error del servidor va dentro del diálogo (un solo aviso, se conserva lo elegido); el diálogo no se cierra mientras guarda. Con alumno
fijo (desde la fila de la tabla) muestra su ficha y no ofrece «registrar otro». En teléfono el pie se acomoda en dos filas (tres botones no
caben en 360 px).

### `CierreSesionDialog`

«Cerrar sesion de clase» / «Cerrar sesion» → **«Cerrar sesión de clase» / «Cerrar sesión»**. Antes: dos viñetas y una línea de cifras;
ahora, las mismas viñetas (más la variante de modo manual) y un resumen de lo que se cierra: Presentes, Retardos, Ausentes marcados (si hay),
Sin registro («Quedarán como ausentes») y Pendientes («Pasan a Revisión») (si hay). Props nuevas, opcionales y compatibles con
`MonitorSesion`: `modo`, `antesDeCerrar`.

### `RegistrarJustificanteForm` (alumno)

Formulario guiado de tres bloques numerados dentro de la misma tarjeta (cada número se vuelve palomita al resolverse), en lugar de un
`Asistente`: son tres campos, la falta suele venir preseleccionada (`?justificar=`) y el formulario es una tarjeta más de un panel (la regla
«un asistente para dos o tres campos es un anti-patrón» de flujos §3.4).

1. **Falta o retardo**: ≤ 4 faltas → `TarjetaOpcion` (todas visibles, estado con `StatusChip`; si hubo un justificante rechazado, la tarjeta lo
   dice y al elegirla aparece un aviso); más → `Combobox` (la etiqueta empieza con la fecha: es lo que queda escrito en el campo y a 360 px lo
   que se alcanza a leer; la opción se dibuja con el estado en texto y color). Con una sola falta ya viene elegida. `tiene_rechazado` (que
   `api_mis_justificables` ya traía) ahora se ve.
2. **Motivo**: `Textarea` con `autoGrow` y contador `n/200` (antes había `showCount`, se conserva), ayuda y «ideas para empezar» (Cita médica,
   Enfermedad, Trámite oficial, Asunto familiar) que solo aparecen con el campo vacío y escriben «Cita médica: » para seguir.
3. **Documento**: `Field` + `FileInput variant="zona"` correctamente etiquetado (antes un `<span>` no asociado): arrastrar y soltar, clic o
   teclado, miniatura (`preview="imagen"`), reglas visibles **antes** de elegir (se deducen de `ACCEPT`/`MAX_BYTES`: «PDF, JPG o PNG. Máximo
   5 MB.»; límite real verificado: `MAX_ARCHIVO_BYTES` = 5 MiB y tipos `pdf, jpg, png` en `POST /api/justificantes/documento`). En pantallas
   táctiles (`pointer: coarse`) un botón «Tomar foto» con `capture="environment"` (la zona principal **no** lleva `capture`: junto con PDF en
   `accept`, algunos teléfonos abren la cámara y no dejan elegir un PDF).

La barra de abajo (`FormActions`) dice qué falta («Faltan el motivo y el documento.», «Todo listo para enviar.») o la fase del envío
(«Subiendo documento…», «Registrando justificante…»). El botón **no se apaga**: con datos incompletos marca los errores, lleva el foco al
primero y los errores desaparecen al corregirse (se recalculan en cada cambio tras el primer intento). Aviso al recargar o cerrar con lo
capturado. **Éxito dentro de la tarjeta** (`SuccessState`): «Justificante enviado», estado Pendiente, y los siguientes pasos «Justificar otra
falta» (si quedan) y «Ver mis justificantes» (centra la tarjeta vecina); el éxito sigue a la vista aunque la lista recargada quede vacía.
El hook agrega un segundo argumento a `onRegistrado(j, { idSesion })` (compatible: `PortalAlumno` lo ignora).

### `JustificanteCard` y `ResolverComo` (revisión)

`JustificanteCard`: el comentario ya no se escribe suelto arriba y fuera de la confirmación. Un **único** `ConfirmDialog` para las dos
decisiones, con `reason`: comentario opcional al aprobar y **«Motivo del rechazo» obligatorio** al rechazar (`Escribe el motivo para
continuar.`), nombrando al alumno, la materia y la sesión. Texto de decisión con el estado que conserva el registro y botones con icono
(`Check`/`X`). Aviso exacto sobre el destino del comentario: según `docs/api/revision.md` va a la bitácora y `api_mis_justificantes` **no** lo
devuelve al alumno; el diálogo lo dice («El comentario queda en la bitácora; el alumno solo ve el estatus.»), no promete que el alumno lo lea.
Se conservaron las dos líneas sin commit del usuario (import y render de `EtiquetaSospechosa`).
`ResolverComo`: «Comentario» con `optional` y ayuda «Queda en el historial de correcciones del caso.»; el motivo del botón deshabilitado lleva
icono. El clic en el estado sigue ejecutando directo (es reversible dentro del plazo), sin diálogo.

### `FiltrosReporte` y `SelectorGrupo`

`Select` de grupo y de alumno → `Combobox` con búsqueda sin acentos, `clearable` y opción de dos líneas (grupo: «Materia · 3A» y «docente ·
N inscritos»; alumno: nombre y matrícula, con avatar). El periodo sigue siendo `Select` (2 o 3 valores). Debajo, los **filtros activos** como
chips con «Quitar filtro Grupo: …» y «Limpiar» (conserva el periodo; quitar el grupo quita también al alumno; el chip espera a conocer el
nombre en lugar de inventar uno). `SelectorGrupo` reutiliza `FiltrosActivos` y `filtrosReporte.utils.js` de `reportes/FiltrosReporte`.

**Decisión: no hay `RangoFechas`.** Ninguna RPC de reportes o analítica admite un rango (`api_reporte_grupo` y `api_reporte_periodo` filtran
por periodo, grupo y alumno; `api_serie_grupo`/`api_matriz_grupo` toman todo el grupo): un rango aquí no filtraría nada. «Este periodo» ya es el
selector de periodo. Si se quiere, hace falta `p_desde`/`p_hasta` en esas RPC; `ui/RangoFechas` ya está listo para adoptarse.

## Primitivas usadas

`SegmentedControl`, `Combobox`, `TarjetaOpcion`, `FileInput variant="zona"`, `FormActions`, `SuccessState`, `ConfirmDialog.reason`, `Modal`
(`showClose`, `closeDisabled`, pie con función), `Field` (`as="fieldset"`, `optional`, etiqueta con nodo), `Textarea autoGrow`, `Input`
(`startAdornment`, `onClear`), `useCambiosSinGuardar`. No se usó `useFormulario` (el justificante necesita el envío en dos fases con reintento
sin resubir de `useRegistrarJustificante`) ni `Asistente` (ver arriba).

## Pruebas

Pruebas de la zona (nuevas: `RegistroManualDialog.test.jsx`, `CierreSesionDialog.test.jsx`,
`FiltrosReporte.test.jsx`, `SelectorGrupo.test.jsx`; ampliadas: justificante, `JustificanteCard`, `ResolverComo`). Se editaron con cambios mínimos 5 aserciones de pruebas de **otras carpetas** que fijaban el
`<select>` de los componentes de esta zona: `alumno/PortalAlumno/PortalAlumno.test.jsx` (2: `getByLabelText(/Falta o retardo/)` →
radio de la falta), `reportes/ReporteAsistencia/ReporteAsistencia.test.jsx` (2: `selectOptions` de Grupo y Alumno → combobox) y
`analitica/analitica.componentes.test.jsx` (1: Grupo).

## Hallazgos y `requests` para el lead

1. **`globals.css` anulaba `position: sticky` en toda la app (alta prioridad). Resuelto en este PR con `overflow-x: clip`.** `html, body { max-width: 100vw; overflow-x: hidden }` hace
   que `overflow-y` de ambos pase a `auto`: `body` se vuelve un contenedor de scroll que nunca desplaza y todo `sticky` dentro queda inerte
   cuando el que hace scroll es el documento (teléfono y tablet). Comprobado en el navegador: con `overflow-x: clip` en `html` y `body` la
   barra pasa de `top: 3118` a quedar pegada (`bottom: 684` con `innerHeight` 780). Afecta a `FormActions sticky="movil"` de **todos** los
   frentes (la comprobación de F1b se hizo en un banco sin esta regla). Arreglo de una línea: `overflow-x: clip` en lugar de `hidden`.
2. Documentación a actualizar (no la toqué, regla de zona): `docs/api/reportes-analitica.md` líneas 101 y 233 («Tres/Dos `Select`» → periodo
   `Select` + `Combobox` de grupo y alumno + filtros activos), `docs/api/revision.md` líneas 166 y 168 (`ResolverComo`, comentario y
   `Aprobar`/`Rechazar` con un `ConfirmDialog` con `reason`), y donde se describa el pase manual (`Select` por alumno → segmentado).
3. `ui/ConfirmDialog` con `reason` y error: el mensaje sale pero el `Textarea` no se pinta en rojo (le falta `invalid={faltaMotivo}`).
4. Advertencia de hidratación en desarrollo con el esquema oscuro del sistema: el `className` de `<html>` difiere entre servidor y cliente
   (el script del tema agrega `dark` antes de hidratar). Solo desarrollo; se resuelve con `suppressHydrationWarning` en `<html>` del layout.
5. `RegistrarJustificanteForm` apunta a la tarjeta vecina por el `id="t-mis-just"` de `MisJustificantes` (congelado): conviene no cambiarlo.
6. Sin filtro por fechas: ver «Decisión» arriba.

## Registros de prueba en la base local

- Justificante de `e260016@` (Hernández Peña Paola, 3A, falta del 24-ago-2026), motivo «Cita médica: ZZ Prueba F6, revision de interfaz» con
  un PNG de 1×1 («ZZ Prueba F6.png»); queda **pendiente** y aparece en la pestaña Justificantes de `docente1@` (5 en lugar de 4). Su documento
  quedó en el bucket local. `scripts/seed-demo.sh --reset` **no** lo deshace (es de una sesión antigua de la semilla).
- Asistencia de la sesión 115 (5C, manual): guardé 24 marcas (22 presente, 1 retardo, 1 ausente) para verificar el flujo; sigue **abierta**.
  Sesión 19 (3A): un registro manual de «Aguilar Ramos Luis» como presente con «Guardar y registrar otro». Ambas se restablecen con
  `scripts/seed-demo.sh --reset` (que no ejecuté).
- El reloj de demostración se movió a 14-sep-2026 09:05 para abrir la sesión 115 y se **restauró** al estado en que estaba (archivo
  `run/fake_now` original, corriendo desde su ancla).
