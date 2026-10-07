# Frente F4 · Catálogos y usuarios (aulas, materias, docentes, usuarios, bitácora)

Zona: `web/src/components/admin/catalogos/**` y las páginas finas de `app/(app)/admin/{aulas,docentes,materias,usuarios,bitacora}`
(sin cambios: ya solo componen). Sin cambios de RPC, rutas, payloads ni códigos de error. Referencias: `auditoria.md` §3.4 y §5,
`PRIMITIVAS-campos.md`, `PRIMITIVAS-contenedores.md`, `referencias-flujos-guiados.md` (P3, P9, P10) y
`referencias-campos-y-validacion.md` (P1, P3, P7, R03, R05, A01, A10, A13).

## 1. Qué cambió (antes → después)

| Pieza | Antes | Después |
|---|---|---|
| **AulaForm** | Modal de 3 columnas; sin ejemplos; clave sin mayúsculas; error del servidor en toast | `PanelLateral` de un paso (pantalla completa en teléfono). `FormSection` Identificación / Cupo. Clave `maxLength` 10, mayúsculas al salir, «Válido», ejemplo `A-12`; edificio `maxLength` 40, ejemplo «Edificio A»; capacidad con `CampoNumerico` («−» y «+», flechas ↑↓, 1–1000). Validación al salir, foco al primer error, `DUPLICADO` junto a la clave y `AULA_CAPACIDAD_INSUFICIENTE` junto a la capacidad. «Crear aula» / «Crear y agregar otra» (conserva el edificio). Éxito con «Crear un grupo en esta aula», «Crear otra aula» e «Ir a la lista». |
| **MateriaForm** | Modal; créditos 0–99 (la base exige > 0); clave sin límite ni mayúsculas | Panel. Clave `maxLength` 8, mayúsculas y solo letras y dígitos (sin acentos ni guiones) al salir; nombre `maxLength` 80 con contador al 80 %; **créditos 1–99 («no puede ser 0»)**, horas 1–20, ambos con `CampoNumerico`. Éxito: «Crear un grupo con esta materia», «Crear otra materia». |
| **DocenteForm** | Modal; alta con selector de estatus y dos llamadas (guardar + cambiar estatus) con fallo parcial mentiroso («No se pudo guardar» aunque el registro ya existía) | Panel. **El alta no lleva estatus (nace activo): una sola llamada.** Número de empleado `maxLength` 10 alfanumérico en mayúsculas, correo en minúsculas (`maxLength` 120, «Válido»), apellidos 40, nombres 60, apellido materno «(opcional)». `DUPLICADO` distingue número de empleado y correo por el texto del servidor. En edición el estatus es un `SegmentedControl`; la baja pide confirmar (con los grupos) **antes** de guardar. Éxito: «Crear cuenta de acceso» (abre el panel de cuenta con vínculo y correo prellenados), «Crear otro docente». |
| **Fallo parcial (edición de docente)** | Toast genérico y reintento que chocaba | Si los datos se guardaron y falla el estatus (p. ej. `DOCENTE_CON_GRUPOS`): mensaje junto al campo «Los datos se guardaron, pero el estatus no cambió: …», la lista se refresca, el estatus vuelve al real, ya no hay «cambios sin guardar» y reintentar es seguro (la edición lleva el id). Probado contra el servidor real. |
| **CrearUsuarioDialog** | Modal: correo → rol (select) → vínculo (select de 200 o búsqueda + select) | `PanelLateral`: rol con `TarjetaOpcion` (descripción de lo que puede hacer cada rol) → vínculo con `Combobox` remoto (`loadOptions`, opción de dos líneas: nombre + clave y correo; docentes se ven al abrir, alumnos desde 2 caracteres) → correo **prellenado con el institucional del vínculo** (editable; si lo escribe a mano no se pisa). Con vínculo de entrada (desde un alta de docente) el rol se pliega. Errores del servidor junto a su campo (correo repetido, docente/alumno que ya tiene cuenta). |
| **VinculoSelect** | Dos controles para una elección | Un `Combobox` con búsqueda remota. |
| **AccionesUsuario** | 3 botones por fila (apiñados a 360 px); «Cambiar rol» con error solo al enviar | `MenuAcciones` «⋯» (Cambiar rol, Restablecer contraseña, Desactivar/Activar cuenta, esta en rojo y con texto). «Cambiar rol» es un `Modal size="full-mobile"` con `dirty`, el mismo selector de rol («rol actual» rotulado), botón apagado hasta elegir otro y aviso de qué pasa con el vínculo actual. |
| **PasswordTemporalModal** | — | Contrato (`{ open, correo, contrasena, titulo, onClose }`), textos y `index.js` intactos; solo iconos Lucide en «Copiar». |
| **CatalogoTabla / Listados** | Barra copiada «buscar + selects + botón Buscar», tabla que en 360 px escondía «Editar» | `BarraFiltros` (búsqueda mientras se escribe, chips de filtros activos, «Limpiar»). En teléfono la primera celda lleva una línea secundaria (edificio, clave y créditos, número y estatus, rol y estado) y las columnas secundarias se ocultan: la acción queda a la vista. Botón «Nuevo…» con icono `Plus`. **Contrato nuevo**: `onGuardado(registro)` solo refresca la lista; el formulario decide cuándo cerrar (`onClose`). |
| **BitacoraTabla** | Cinco campos y «Filtrar»; entidad en texto libre; usuario por id interno | Filtros que se aplican al cambiarlos: acción y entidad (lista cerrada de las 18 tablas auditables, con nombre legible) en `Combobox`; usuario por correo o nombre con `Combobox` remoto; periodo con `RangoFechas` y atajos «Hoy», «7 días», «30 días»; «Limpiar filtros». Un rango invertido se explica junto a las fechas y no se aplica (la lista conserva el último filtro válido). |

## 2. Piezas nuevas de la zona

- `PanelCatalogo/` (`PanelCatalogo.jsx` + `useAltaCatalogo.js`): el panel de un paso con pie fijo (estado «Cambios sin guardar» / «Aún no hay cambios que guardar» / «Revisa los campos marcados» arriba y botones abajo, para que el estado crezca sin mover los botones), `dirty` (Esc, fondo y X piden confirmar), aviso general y pantalla de éxito. El hook reúne `useFormulario`, «Guardar y crear otro» (reinicia **después** del envío para que el formulario limpio no quede «sucio»), la pantalla de éxito, el fallo parcial (`guardadoParcial`) y `beforeunload`. Lo usan Aula, Materia, Docente y CrearUsuario.
- `CampoNumerico/`: entero con «−» y «+» (P9), solo dígitos, ↑↓. Candidato a subir a `ui/` (lo necesitan `CapacidadForm` y otros).
- `SelectorRol/`: `TarjetaOpcion` de roles (crear cuenta y cambiar rol).

## 3. Primitivas usadas

`PanelLateral`, `FormActions` (flat), `FormSection`, `Field` (`example`, `hint`, `valid`, `optional`, `counter`, `reserveError`), `Input` (`transform`, `showCount`), `Combobox` (opciones locales y `loadOptions`), `SegmentedControl`, `TarjetaOpcion`, `SuccessState`, `BarraFiltros`, `MenuAcciones`, `RangoFechas`, `Modal` (`full-mobile`, `dirty`), `ConfirmDialog`, `Alert`, `useFormulario`, `useCambiosSinGuardar`, `lib/formularios` (`LIMITES`, `PATRONES`, `esCorreo`, `enteroEnRango`…).

## 4. Decisiones

- **Contraseña temporal**: la genera el servidor (`generarContrasenaTemporal`) y el cuerpo de `POST /api/admin/usuarios` es `strict` (no acepta contraseña), así que **no hay campo de contraseña ni «Generar» al crear la cuenta**; el panel avisa que se verá una sola vez y `PasswordTemporalModal` la muestra. `CampoPassword` (con «Generar») queda para quien capture una contraseña.
- **`ConfirmDialog.reason` no se usa**: las RPC de baja de docente y desactivar cuenta no reciben motivo; pedirlo sin enviarlo engañaría.
- **Validación al salir solo en campos editados**: pasar de largo por un campo vacío no lo pinta de rojo (en desarrollo, React Strict Mode hacía que el panel abriera con la clave en rojo; ver `requests`). El error de un campo vacío llega al enviar, o al salir si la persona llegó a escribir.
- **El botón de alta no se apaga por datos inválidos** (flujos P10): el clic muestra los errores, enfoca el primero y el pie lo dice. En edición sí se apaga sin cambios y lo dice.
- **Límites del cliente**: capacidad 1–1000 (la base admite 32767: tope de sensatez ya existente), créditos 1–99, horas 1–20.
- **Normalización**: claves de aula y materia, número de empleado en mayúsculas; materia y número de empleado solo letras y dígitos (acentos convertidos antes de filtrar: «ÁDM101» → «ADM101»); correo en minúsculas; nombres sin espacios repetidos. Se aplica al salir del campo y de nuevo al enviar.
- **Siguiente paso del aula**: no existe una ruta directa de cámaras; se configuran en la pestaña «Aula y cámaras» de un grupo que use el aula, por eso el paso dice «Crear un grupo en esta aula» (y lo explica) en vez de «Configurar cámaras».

## 5. Pruebas

`npx vitest run src/components/admin/catalogos`: 18 archivos, 126 pruebas (antes 5 y 24); `npx eslint src/components/admin/catalogos` limpio. Nuevas: `AulaForm`, `MateriaForm` (+ utils), `DocenteForm` (+ utils: alta sin estatus y en una llamada, fallo parcial, baja con confirmación), `CrearUsuarioDialog` (+ utils: correo prellenado, vínculo remoto, errores junto al campo), `AccionesUsuario` (+ `cambiarRol.utils`), `UsuariosPanel`, `ListadoDocentes` (flujo alta → cuenta → contraseña), `CatalogoTabla` (actualizada: sin botón «Buscar»), `BitacoraTabla` (componente), `comun`, `CampoNumerico` (utils). `PasswordTemporalModal.test.jsx` sin cambios.

## 6. `requests` (fuera de mi zona)

1. **`/admin/grupos/nuevo` (F5)**: aceptar `?materia=<id>` y `?aula=<id>` para preseleccionar. Hoy los pasos «Crear un grupo con esta materia / en esta aula» llevan a `/admin/grupos/nuevo` a secas.
2. **Cámaras de un aula**: no hay ruta propia (solo `/admin/grupos/[id]?tab=aula`, que exige un grupo). Si se quiere el paso «Configurar cámaras» directo, hace falta una ruta de aula (p. ej. `/admin/aulas/[id]`).
3. **`CapacidadForm` (F5)**: unificar con `CampoNumerico` (mismos «−»/«+», rango 1–1000 y mensajes) o promover `CampoNumerico` a `components/ui`.
4. **`useFormulario` / `useDialog`**: `useDialog` devuelve el foco al abridor en la limpieza del efecto; en desarrollo (Strict Mode) eso provoca un `blur` del primer campo apenas se abre un contenedor y `useFormulario` lo marca como «tocado» (error en rojo al abrir). Lo contorneo en `useAltaCatalogo.campo` (ignora el blur de campos no editados); conviene resolverlo en la primitiva.
5. **`enfocarPrimerError`**: no encuentra `Combobox` ni `SegmentedControl` (su elemento enfocable no lleva `name`), y con dos errores enfoca el segundo. Lo contorneo enfocando el primer `[aria-invalid="true"]` tras pintar. Sugerencia: que `Combobox` ponga `name` en su `<input>` de texto.
6. **`Modal`, `ConfirmDialog` y `PanelLateral` no usan portal**: un diálogo abierto desde una celda de tabla hereda su `text-align` (y otras propiedades heredables). Lo contorneo con `text-left` en la celda de acciones; un `createPortal` a `document.body` lo resolvería de raíz.
7. **`Table.hideBelow`** solo admite `sm` y `md`; con el riel lateral las columnas secundarias necesitan `lg`/`xl`: usé `className="hidden xl:table-cell"`. Sugerencia: ampliar `OCULTAR`.
8. **`FormActions`**: en un pie estrecho (panel de 32 rem) el texto de estado queda en una columna de ~80 px junto a tres botones y el pie salta. Lo resolví con dos `FormActions` (uno solo de estado y otro de botones); una opción `stacked` lo haría limpio.
9. **`RangoFechas`/atajos de la bitácora** usan la fecha del navegador, no el reloj de demostración (solo afecta al modo local de demostración).

## 7. Registros de prueba creados en la base local

Aula `ZZ-PRB1` (edificio «ZZ Prueba»); materia `ZZPRB1` «ZZ Prueba Materia»; docente `ZZP01` «ZZ Prueba Docente» (`zz.prueba.docente@unach.test`) con cuenta de acceso cuyo rol se cambió a técnico (contraseña temporal no registrada). Para verificar el fallo parcial se editó al docente `D0001` guardando **los mismos valores** y pidiendo la baja, que el servidor rechazó (`DOCENTE_CON_GRUPOS`): no cambió ningún dato.
