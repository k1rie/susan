# Frente F3 · Alumnos: alta, ficha y consentimiento

Resumen de lo hecho en `web/src/components/admin/alumnos/{AlumnoForm,NuevoAlumno,ListadoAlumnos,ConsentimientoPanel,CuentaAccesoPanel,DetalleAlumno,IndicadorEstado}` y
`web/src/app/(app)/admin/alumnos/**` (las páginas no cambiaron: siguen siendo delgadas). Es solo capa de presentación y validación de conveniencia: **ninguna RPC,
ruta, payload ni código de error cambió**. Fuente: `auditoria.md` §3.3 y §5 (F3), `PRIMITIVAS-campos.md`, `PRIMITIVAS-contenedores.md`, `referencias-flujos-guiados.md`.

## Antes → después, por pantalla

| Pantalla | Antes | Después |
|---|---|---|
| **Alta** (`NuevoAlumno`, `/admin/alumnos/nuevo`) | Un formulario plano de 6 campos (con selector de Estatus), `Alert` + toast de éxito, dos llamadas posibles (alta + cambio de estatus) y `CuentaAccesoPanel` suelto | **Asistente de 3 pasos**: Identidad (matrícula, nombres, apellidos) → Contacto y acceso (correo + interruptor «Crear su cuenta al terminar», opcional) → Revisión con «Editar» por sección; resumen vivo a la derecha en `lg`; pie fijo en el teléfono; **pantalla de éxito** con siguientes pasos reales |
| **Datos del alumno** (`AlumnoForm`, ficha) | 6 campos planos en rejilla, sin límites, sin normalización, errores solo al enviar, «Guardar» siempre activo | Secciones **Identidad / Contacto / Estado**, `maxLength` y contador reales, normalización al salir del campo, error al salir del campo, foco al primer error, error del servidor pegado al campo, «N cambios sin guardar», «Descartar», guardar apagado (con motivo) mientras no hay cambios |
| **Baja** | Dos caminos distintos: el select de Estatus guardaba `baja_definitiva` sin confirmar; el botón «Dar de baja» sí confirmaba | **Una sola confirmación** (`ConfirmDialog`) con el efecto real («Se darán de baja sus N inscripciones activas…»), venga del encabezado o del formulario |
| **Consentimiento** (`ConsentimientoPanel`) | Fechas con `Input type="date"` sin ayudas, rótulo del PDF en un `<span>` no asociado, toast al terminar, fechas ISO crudas | `CampoFecha` con atajos («Hoy», «+1 año», «+2 años») y **vigencia sugerida** (1 año, editable) con su duración escrita; `FileInput variant="zona"` etiquetado con `Field` y con las reglas visibles; estado de carga; resultado dentro de la tarjeta con enlace al siguiente paso; historial con fechas legibles |
| **Cuenta de acceso** (`CuentaAccesoPanel`) | Solo existía justo después del alta | Vive en la **ficha**: dice si el alumno tiene cuenta (activa, desactivada, sin cuenta, sin comprobar), la crea si no existe y muestra la contraseña **una sola vez** con `PasswordTemporalModal` |
| **Ficha** (`DetalleAlumno`) | Cuatro tarjetas apiladas, sin ancla ni resumen | Resumen «qué falta» (consentimiento, plantilla, cuenta, inscripciones) con enlaces a cada tarjeta, inscripciones con enlace al grupo y su estatus en texto, anclas (`#datos`, `#consentimiento`, `#plantilla`, `#cuenta`, `#inscripciones`) que funcionan aunque la ficha cargue después |
| **Listado** (`ListadoAlumnos`) | Barra buscar + estatus + botón «Buscar» copiada de otros listados; tabla que se desplaza a 360 px | `BarraFiltros` (búsqueda con retraso por matrícula, nombre o correo; chip del filtro; «Limpiar»; «N alumnos»); estados vacío (sin alumnos / sin coincidencias, con «Limpiar filtros») y de error con «Reintentar»; **tarjetas por alumno en el teléfono** y tabla desde `md` |
| `IndicadorEstado` | Solo `Badge` con texto | Texto + icono Lucide (palomita / círculo punteado) + color; `EstatusAlumno` nuevo (texto + tono) |

### Alta como asistente: detalles

- **Fallo parcial resuelto.** El selector de Estatus salió del alta (el alumno nace activo), así que ya no hay «alta + cambio de estatus». La cuenta de acceso sí es una
  segunda llamada (`POST /api/admin/usuarios`, ruta ya existente); si falla, el alumno ya existe y el asistente **lo dice** («El alumno se creó, pero su cuenta de acceso no»)
  y ofrece reintentar en la pantalla de éxito, sin reenviar el alta (nunca «No se pudo guardar»).
- **Matrícula repetida detectada antes de la revisión**: tras una pausa de 400 ms y solo con formato válido, se consulta `api_alumnos_listar` (lectura) y se muestra
  «Matrícula disponible» o «Esta matrícula ya está registrada» con enlace a la ficha. Si aun así el servidor devuelve `DUPLICADO` al crear, el asistente **vuelve al paso**
  del dato (matrícula o correo) con el error pegado al campo.
- **Éxito (`SuccessState`)**: consentimiento (recomendado) → plantilla facial → inscribirlo en un grupo → cuenta de acceso (hecha / crear / reintentar); acciones «Ir a la ficha» y
  «Crear otro alumno». Los enlaces apuntan a `#consentimiento` / `#plantilla` de la ficha. La contraseña temporal se muestra al crear (modal de F4) y se descarta al cerrarlo.
- **Correo**: no se autocompleta ni se inventa dominio; solo `esCorreo` (formato) y minúsculas al salir del campo.

### Normalización y límites (`lib/formularios`, sin hex ni librerías nuevas)

| Campo | Límite | Al salir del campo |
|---|---|---|
| Matrícula | 10 (`LIMITES.matricula`) | mayúsculas y solo letras y dígitos (`PATRONES.matricula` valida) |
| Nombres / apellidos | 60 / 40 | espacios de los extremos y repetidos fuera |
| Correo | 120 | sin espacios y en minúsculas |

El contador `n/max` (en `Field`) aparece al llegar al 80 %. «Válido» solo en matrícula y correo, y solo después de salir del campo. El payload se vuelve a normalizar
al enviar (quien envía con Enter no pasó por el blur).

### Errores del servidor pegados al campo (`mapearErrorAlumno`, `mapearErrorConsentimiento`)

`DUPLICADO` → matrícula o correo (según el texto de la RPC; si dice ambos, la matrícula); `VALIDACION` → el campo que nombra el mensaje (matrícula, apellidos, nombres, correo;
fecha de firma, vigencia). Lo demás se muestra una sola vez, junto a los botones (nunca alerta + toast).

### Consentimiento

- «Hoy» y el máximo de la fecha de firma salen de **`api_ahora`** (el reloj del plantel, que en desarrollo puede ser el de demostración) y no del navegador: la RPC rechaza
  una firma «futura» comparándola con su propio reloj. El formulario espera esa respuesta (una fracción de segundo) antes de pintarse.
- Vigencia: al elegir la firma se sugiere +1 año mientras la persona no haya tocado la vigencia; «+1 año» / «+2 años» se ocultan si no hay firma o caen fuera del mínimo
  (la vigencia debe ser posterior a la firma y no estar vencida, igual que la RPC). La duración se escribe «1 año», «6 meses» o «20 días» (aritmética de calendario).
- Un alumno en baja no puede registrar consentimiento (la RPC lo rechaza con `ALUMNO_INACTIVO`): en lugar del formulario se explica qué hacer (`alumnoActivo`).
- Carga: `fetch` no informa progreso, así que **no se simula una barra**: el campo se bloquea y el pie dice «Subiendo el documento y registrando el consentimiento…».

## Primitivas usadas

`Asistente`, `Stepper` (dentro del asistente; compacto por debajo de 640 px), `SuccessState`, `FormSection`, `FormActions`, `Field` (`optional`, `valid`, `example`, `counter`,
`reserveError`), `Input` (`transform`, `maxLength`), `SegmentedControl` (estatus), `Switch` (cuenta), `CampoFecha`, `FileInput variant="zona"`, `BarraFiltros`, `ConfirmDialog`,
`Alert compact`, `useFormulario`, `useCambiosSinGuardar`, `useDebounce`, `lib/formularios` y `PasswordTemporalModal` de F4 (contrato `{ open, correo, contrasena, titulo, onClose }`, sin tocarlo).

## Archivos

- Nuevos: `AlumnoForm/CamposAlumno.jsx` (campos compartidos por la ficha y el asistente), `NuevoAlumno/{AltaAlumno.jsx, nuevoAlumno.utils.js, useMatriculaExistente.js}`,
  `ConsentimientoPanel/{FormularioConsentimiento.jsx, useHoyNegocio.js}`, `CuentaAccesoPanel/useCuentaAcceso.js`, `DetalleAlumno/{ResumenFicha.jsx, detalleAlumno.utils.js}`,
  `ListadoAlumnos/FilaAlumno.jsx`, `IndicadorEstado/EstatusAlumno.jsx`.
- Reescritos: `AlumnoForm`, `alumnoForm.utils.js`, `NuevoAlumno`, `ListadoAlumnos`, `ConsentimientoPanel`, `consentimiento.utils.js`, `CuentaAccesoPanel`, `IndicadorEstado`.
- `DetalleAlumno.jsx` (tenía 1 línea sin commit del usuario): solo con `Edit`; la línea que pasa `nombreAlumno` a `PlantillaFacialPanel` quedó **intacta** (para no moverla, el ancla
  `#plantilla` es un `<span>` vacío antes del panel en vez de un envoltorio).
- Textos de la zona pasados a «tú» (como los de las primitivas): «Escribe…», «Indica…», «Adjunta…».

## Pruebas

`npx eslint web/src/components/admin/alumnos` limpio. `npx vitest run src/components/admin/alumnos`: **19 archivos, 263 pruebas verdes** (incluye las del asistente facial, que no se tocó).
Las siete carpetas de F3 pasaron de 13 pruebas a **111 en 10 archivos**: `alumnoForm.utils.test.js`, `AlumnoForm.test.jsx` (alta simple y edición), `NuevoAlumno.test.jsx` + `nuevoAlumno.utils.test.js`
(pasos, revisión, alta, cuenta, fallo de cuenta, `DUPLICADO` de vuelta al paso, matrícula repetida, cancelar), `ConsentimientoPanel.test.jsx` (formulario completo, atajos, vigencia,
errores por campo, carga, resultado, revocar), `CuentaAccesoPanel.test.jsx` (+ `useCuentaAcceso`), `DetalleAlumno.test.jsx` + `detalleAlumno.utils.test.js` (confirmación única, fallo
parcial, ancla, resumen), `ListadoAlumnos.test.jsx`, `IndicadorEstado.test.jsx`. Se actualizaron a propósito: el payload de `AlumnoForm.onSubmit` (ahora lleva `cambioDatos` y
`cambioEstatus`), el texto de la vigencia («Vigente hasta 1 ago 2027 (100 días)») y los textos de validación en «tú».

## Verificación en el navegador

Servidor de desarrollo en `localhost:3000`, sesión de administrador del seed. A **360 px** y en escritorio (1280): listado (tarjetas y tabla), alta completa (errores, matrícula
normalizada y «disponible», correo con «Válido», interruptor de cuenta, revisión, éxito con contraseña temporal), ficha (resumen, secciones, «N cambios sin guardar», confirmación de
baja con cancelar y aceptar, reactivar, `DUPLICADO` pegado a la matrícula, consentimiento con «Hoy» y PDF, cuenta de acceso creada desde la ficha, ancla `#cuenta`). Sin desborde
horizontal (medido por JS: `scrollWidth` = 360), sin errores ni avisos en la consola, foco al primer error y diálogo de confirmación con foco. Modo oscuro revisado con la clase `.dark`.
Sin animaciones propias (solo las del asistente, que ya respetan «reducir movimiento»).

### Registros de prueba creados en la base local (prefijo «ZZ Prueba»)

| Matrícula | Nombre | Notas |
|---|---|---|
| `ZZPRUEBA1` | ZZ Prueba Ana María | Cuenta de acceso creada (`zz.prueba1@zz-prueba.test`); consentimiento registrado (PDF de prueba `zz-prueba-consentimiento.pdf`); pasó por baja temporal y se reactivó |
| `ZZPRUEBA2` | ZZ Prueba Dos Luis | Cuenta de acceso creada desde la ficha (`zz.prueba2@zz-prueba.test`) |

## `requests` (cambios fuera de mi zona o fallos de primitivas)

1. **`Asistente`: no hay forma de saltar a un paso desde fuera.** Cuando `onFinalizar` falla por un `DUPLICADO` y la persona está en la revisión, hay que volver al paso del dato;
   el asistente solo entrega `irAPaso` a los pasos que se están pintando. Lo resolví guardando `irAPaso` en un ref desde un efecto de un hijo del paso (`GuardaIrAPaso` en `AltaAlumno.jsx`).
   Propuesta: que `onFinalizar` pueda lanzar un error con `{ paso: 'identidad' }` (o aceptar `pasoActual`/`ref` imperativo) y el asistente vuelva solo.
2. **`SuccessState` / `TarjetaFila` truncan título y subtítulo en una sola línea** (`truncate`): a 360 px «Registrar el consentimiento firmado» salía «Registrar el consentimien…».
   Lo contorné con títulos de ≤ 25 y descripciones de ≤ 30 caracteres (hay una prueba que lo fija). Propuesta: que `SuccessState` permita dos líneas (`line-clamp-2`) en sus tarjetas.
3. **Progreso real de subida (`FileInput progress`)**: `lib/http/client.js#postForm` usa `fetch`, que no reporta progreso; para el PDF del consentimiento (hasta 10 MB) habría que usar
   `XMLHttpRequest` (o un `onUploadProgress`) en `registrarConsentimiento`. Hoy el formulario muestra estado de carga sin porcentaje inventado.
4. **Layout (`components/layout/**`)**: la barra inferior (`BottomNav`) cubre el campo que recibe el foco al tabular en el teléfono (p. ej. al pasar de la matrícula a los nombres); falta
   un `scroll-padding-bottom` en el contenedor con scroll. Los formularios largos lo notan.
5. **`api_alumno_obtener` / `api_alumnos_listar` no dicen si el alumno tiene cuenta.** Para mostrarlo en la ficha hago una consulta extra a `api_usuarios_listar` buscando por matrícula y
   filtrando por `id_alumno` (sin cambiar contratos). Opcional para db-api: añadir `cuenta: { id_usuario, activo } | null` a `api_alumno_obtener`.
6. **`docs/DEMO.md` §(recorrido de alta, ~línea 301)** dice «Pulsa **Ir a la ficha (consentimiento y foto)**»: ahora el alta es un asistente de 3 pasos y el botón se llama **Ir a la ficha**.
7. **Dominio del correo institucional** (decisión abierta del lead, auditoría §7.1): sigue sin configurarse, así que el correo no se sugiere ni se completa. Cuando exista, `CamposContacto`
   es el único sitio que hay que tocar (sugerir `matrícula@dominio` como valor editable con la etiqueta «Autocompletado»).
8. **`PasswordTemporalModal` (F4)** no tiene botón «X» (`Modal showClose` por omisión en `false`): se cierra con «Ya la copié, cerrar», que es el comportamiento deseado; solo se anota por si F4 lo cambia.
