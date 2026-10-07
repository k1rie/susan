# Frente F5: Grupos (rediseño de formularios)

Zona: `web/src/components/admin/grupos/**` y `web/src/app/(app)/admin/grupos/**`. Ningún RPC, ruta ni payload cambió: todo es presentación
y validación de conveniencia (el servidor sigue siendo la validación real). Ficha de partida: `auditoria.md` §3.5 y frente F5 en §5.

## Resumen por formulario (antes → después)

| Pantalla | Antes | Después | Primitivas |
|---|---|---|---|
| **Alta de grupo** (`NuevoGrupo/`) | Un formulario con tres `<select>` de hasta 200, spinner hasta cargar todo, error del servidor dos veces (Alert + toast), aterrizaba en *Datos* | Asistente de 3 pasos: *Materia y docente* → *Aula y horario* → *Revisión* (con «Editar» por sección y resumen vivo a la derecha en `lg`). Éxito con 3 siguientes pasos reales | `Asistente`, `useFormulario`, `Combobox`, `Field`, `FormSection`, `SuccessState` |
| **Datos del grupo** (`GrupoForm/`, pestaña Datos) | Mismo formulario de alta, siempre habilitado | `FormSection` (Materia y docente / Identificación / Aula), `FormActions` con «Cambios sin guardar» y botón apagado con motivo; error del servidor pegado a su campo | `FormSection`, `FormActions`, `Combobox`, `useFormulario` |
| **Detalle del grupo** (`GrupoDetalle/`) | Pestaña en estado local, el contenido se desmontaba y perdía lo editado sin avisar | Pestaña en `?tab=` (deep links), `Tabs.confirmLeave` + `useCambiosSinGuardar` (aviso al cambiar de pestaña y al recargar/cerrar) | `Tabs.confirmLeave`, `useCambiosSinGuardar` |
| **Horario** (`HorarioEditor/` + `HorarioSemanal/`) | Una fila (día + inicio + fin + quitar) por bloque; L-M-V pedía tres filas | Franjas: días como chips (`Pills multiple`) + una hora genera N bloques de golpe; fin = inicio + 1 h y conserva la duración al mover el inicio; duraciones rápidas; duplicar franja; total de horas por semana (y comparación con las de la materia); errores en línea; vista semanal; «Cambios sin guardar» | `Pills multiple`, `SegmentedControl`, `Field`, `Input`, `FormActions` |
| **Generar sesiones** (`GenerarSesiones/`) | Dos `date` y un textarea con fechas separadas por comas; sin vista previa | `RangoFechas` con atajos (2/4/8/16 semanas), valores por defecto (desde hoy del plantel, 4 semanas), fechas a omitir como chips, **vista previa del número de sesiones** (el botón dice «Generar 12 sesiones»), resultado con `SuccessState` | `RangoFechas`, `CampoFecha`, `SuccessState`, `FormActions` |
| **Inscribir alumno** (`InscribirAlumno/`) | Buscar + botón; una búsqueda por alumno; sin aviso de cupo | `Combobox` remoto (nombre, matrícula, estatus, avisos de consentimiento/plantilla); cada alumno elegido se suma a una lista y el campo queda listo para el siguiente; un botón inscribe todos; aviso de cupo del aula; fallos parciales por alumno | `Combobox` (`loadOptions`), `FormActions` |
| **Importar CSV** (`ImportarCsv/`) | Párrafo con las columnas, archivo, vista previa y reporte | Diálogo de 4 pasos: *Archivo* (plantilla descargable + zona de arrastre) → *Revisión* (4 contadores, errores agrupados por causa con rango de filas, vista previa) → *Confirmar* (qué pasará, cupo) → *Resultado* (cifras del servidor y reporte descargable de los fallidos) | `Modal fullMobile`, `Stepper`, `FileInput variant="zona"`, `StatCard`, `Detalles`, `SuccessState` |
| **Cámaras** (`CamaraForm/`, `CamaraPanel/`, `AulaCamaras/`) | Selects de tipo y estatus; «Probar» solo mostraba un toast y probaba lo GUARDADO sin avisar | Tipo y estatus en `SegmentedControl`; IP con ejemplo; «Probar conexión» con resultado y hora PERSISTENTES; con cambios sin guardar se apaga y dice por qué; alta en `PanelLateral`; modo del pase de lista (automático/manual) a la vista | `SegmentedControl`, `PanelLateral`, `FormActions`, `Badge` |
| **Capacidad** (`CapacidadForm/`) | Un número suelto | Inscritos del grupo frente a la capacidad (barra con texto), piso en los inscritos, botones − y +, error del servidor en el campo | `FormActions`, `useFormulario` |
| **Listado** (`GruposTabla/`) | Búsqueda + periodo como texto libre + botón «Buscar» | `BarraFiltros` (búsqueda con retraso, periodo como selector, chips activos, «Limpiar», conteo) y `MenuAcciones` por fila (Abrir / Editar horario / Inscribir alumnos, con `?tab=`) | `BarraFiltros`, `MenuAcciones` |
| **Inscripciones** (`InscripcionesTabla/`) | Tres tarjetas apiladas y avisos de cupo repetidos | Una tarjeta «Inscribir alumnos» con «Importar desde CSV» en su cabecera; el cupo se dice una vez; la baja explica sus consecuencias en el `ConfirmDialog` | `ConfirmDialog` |

## Decisiones

- **Alta de grupo y fallo parcial.** Son dos RPC (`api_grupo_guardar` y `api_horario_guardar`). Si el horario falla, el grupo YA existe: el
  asistente recuerda el grupo creado, el mensaje lo dice («El grupo ZZPRUEBA ya se creó, pero su horario no se guardó… no se creará otro
  grupo»), el botón pasa a «Guardar horario» y el reintento **actualiza** el grupo por su `id_grupo` (idempotente, sin `DUPLICADO`) y repite solo
  el horario. El paso 2 muestra un aviso con enlace a «abrir el grupo». Verificado en vivo con un choque real de aula (3A en A-12).
- **Horario opcional en el alta.** `api_horario_guardar` exige ≥ 1 bloque, así que sin franjas solo se crea el grupo y el éxito recomienda «Armar
  el horario». El tope de 42 bloques se valida en el cliente.
- **Franjas en vez de bloques.** El editor trabaja con «estos días a esta hora» y expande a un bloque por día al guardar (mismo payload). Lo
  que pedía la ficha (generar N bloques de golpe, «mismo horario en los días activos», copiar a otros días) es elegir días en la franja;
  «Duplicar» crea otra con las mismas horas. Los errores de orden y traslape se ven al instante; lo que solo falta llenar, tras el primer intento.
- **Vista semanal propia, no `TiraSemana`.** `TiraSemana` es un mapa de calor que tiñe con el color de **ausencia**: pintar horas de clase así
  leería como una mala noticia. `HorarioSemanal/VistaSemana.jsx` usa tonos neutros y la hora siempre escrita.
- **Inscripción rápida = lista + un botón.** En lugar de «Inscribir y agregar otro» (dos botones por alumno), cada elección se suma a la lista y el
  campo se vacía y conserva el foco: «agregar otro» es lo normal y un solo botón inscribe a todos («Inscribir 3 alumnos»).
- **Probar conexión usa lo guardado.** `POST /api/admin/camaras/{id}/probar` recibe solo el id (contrato intacto), así que con cambios sin guardar
  se deshabilita con el motivo visible. El resultado deja de valer si cambia la IP guardada. En el alta (aún sin id) se explica que se podrá probar al guardar.
- **Catálogos con `Combobox`.** Hasta 200 registros se cargan y filtran en memoria; si el servidor dice que hay más (`total`), pasa a búsqueda
  remota por texto en vez de ofrecer una lista truncada sin avisar.
- **Periodo sugerido** `AAAA-S` con la fecha del plantel (`api_ahora`, que respeta el reloj de demostración): enero–junio = 1, julio–diciembre = 2.
  Editable, con «Usar 2026-2» si se cambia. Es una sugerencia, no una regla del servidor.
- **Edición con historial.** Con inscripciones o sesiones la materia y el periodo se muestran deshabilitados con el motivo (`GRUPO_CON_HISTORIAL`).
- **Un solo aviso.** Los errores del servidor se pegan al campo que los causó (DUPLICADO → clave, HORARIO_CHOQUE → aula, DOCENTE_NO_ACTIVO →
  docente…) o salen una vez en un aviso general; los toasts quedan solo para éxitos breves (y la inscripción ya no usa toast).
- **Menú de acciones junto a la clave.** En 360 px la tabla desplaza en horizontal y una columna final de acciones quedaba fuera de pantalla.

## Cambio pedido por el lead: `?materia=` y `?aula=`

`/admin/grupos/nuevo?materia=<id>` y `?aula=<id>` preseleccionan esa materia o aula en el asistente (los enlazan los éxitos de F4).
`page.jsx` lee `searchParams` (asíncrono) y valida con `idPositivo` (entero positivo; texto, 0, decimales o varios valores se ignoran sin
error). El asistente espera a que carguen los catálogos y solo preselecciona si el id **existe en el catálogo cargado**; si no, abre vacío. Con
materia elegida el foco pasa al docente. Limitación: con un catálogo de más de 200 registros en modo remoto, un id fuera de los primeros 200 no se
preselecciona. Pruebas en `NuevoGrupo.test.jsx` y `nuevoGrupo.utils.test.js`.

## Estructura nueva

`compartido/` (`useAvisarSucio`, `useHoyNegocio`, `descargar`, `grupos.utils`), `NuevoGrupo/` (reemplaza a `GrupoForm/NuevoGrupo.jsx`),
`HorarioSemanal/` (editor controlado de franjas, lo usan la pestaña y el alta), `CapacidadForm/` (antes dentro de `AulaCamaras`),
`CamaraPanel/`, y dentro de las carpetas existentes: `GrupoForm/{CamposGrupo,useCatalogosGrupo}`, `CamaraForm/{CamposCamara,useCamaraForm}`,
`ImportarCsv/Paso*.jsx`.

## Pruebas y verificación

- `npx eslint src/components/admin/grupos "src/app/(app)/admin/grupos"`: limpio.
- `npx vitest run src/components/admin/grupos`: 18 archivos, 175 pruebas (las existentes de `GrupoDetalle`, `HorarioEditor`, `GenerarSesiones` e
  `ImportarCsv` siguen; se actualizaron a propósito `GrupoDetalle.test` —mocks con marcador y mock de `materiaObtener`— y `GenerarSesiones.test` —fechas a
  omitir como chips y valores por defecto—).
- Navegador (tab propia en `f5.localhost:3000`, escritorio y 360 px, sin desborde horizontal; claro y paleta `.dark` aplicando la clase a `<html>`, porque la
  app aún no tiene interruptor): alta completa con choque real, éxito, `?tab=` en las cuatro pestañas, editor de horario con barra de cambios, tarjetas
  de cámara y prueba fallida persistente, bloqueo de la prueba con IP editada, `Combobox` remoto, lista de inscripción y lote, flujo CSV de 4 pasos en
  escritorio y a 360 px (pantalla completa), deep link `?materia=&aula=`.
- Sin verificar en navegador: el `PanelLateral` de alta de cámara (en el seed todas las aulas ya tienen sus dos cámaras y crear un aula es zona de F4);
  está cubierto por `AulaCamaras.test.jsx`. La descarga real de la plantilla y del reporte CSV (se prueba que se llama con el contenido correcto).

## Registros de prueba creados en la base local

- Grupo **ZZPRUEBA** (id 5; materia ECO101, docente Ortega Salinas Patricia, aula A-12, periodo 2026-2), horario Lun/Mié/Vie 20:00–21:00.
- Alumnos creados por el CSV de prueba: **ZZP001**, **ZZP002**, **ZZP006** («ZZ Prueba Uno/Dos/Seis», `zzprueba1|2|6@unach.test`), inscritos en el grupo 5.
- Inscripciones en el grupo 5 de los alumnos de prueba ya existentes `ZZPRUEBA1` («ZZ Prueba Ana María») y `ZZPRUEBA2` («ZZ Prueba Dos Luis»), de F3.
- No se generaron sesiones. No se tocaron los grupos del seed.

## requests (fuera de mi zona)

1. **`Combobox` sin `onBlur`, `ref` ni `autoFocus`.** Para validar al salir del campo se escucha el foco en un contenedor `display: contents` (`data-campo`) y
   el foco inicial se busca por DOM. Un `onBlur` y un `ref` en la primitiva lo harían directo.
2. **`FormActions` en tarjetas angostas** (≈ 290 px): el texto «N cambios sin guardar» se parte letra a letra junto a los botones. Se contornó con
   `className="sm:!flex-col sm:!items-stretch"` en `CamaraForm`; conviene que apile por container query.
3. **`SuccessState`/`TarjetaFila`** truncan el subtítulo de cada paso a una línea; se acortaron los textos, pero convendría permitir 2 líneas.
4. **Hora de 12 h.** `type="time"` sigue el idioma del navegador («06:00 p. m.»); una primitiva `CampoHora` de 24 h evitaría la ambigüedad (la ficha ya la
   mencionaba).
5. **`callRpc` no acepta `signal`**: el `Combobox` descarta la respuesta vieja pero no cancela la petición en vuelo.
6. **`api_grupo_obtener` no devuelve `horas_semana`** (ya en la auditoría §6): la pestaña Horario hace una consulta extra a `materiaObtener`.
7. **`POST /api/admin/camaras/{id}/probar` solo prueba la cámara guardada.** Si se quisiera probar una IP sin guardar habría que aceptar `direccion_ip` en el
   cuerpo (cambio de contrato; no se hizo).
8. **Herramienta de navegador:** con el panel oculto los límites de Suspense en streaming no se revelan (la página se queda en «Cargando») y las capturas
   fallan; hay que traer la pestaña al frente antes de mirar.
