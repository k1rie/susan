# Auditoría de formularios y pantallas de captura de datos

Fecha: 2026-10-06 · Rama `feat/video-v4` · Solo lectura: se leyó el código (`web/src`), `CLAUDE.md`, `docs/design/SISTEMA.md`, las migraciones
`supabase/migrations/02xx` (límites reales de la base) y `git status`. No se compiló ni se midió en navegador: lo dicho sobre 360 px y rendimiento es por lectura
del código y debe verificarse al implementar.

## 0. Alcance y convenciones del documento

- Cubre los formularios del producto salvo el asistente de registro facial con cámara (`RegistroFacialGuiado`, `CapturaGuiadaPlantilla`, `CameraCapture`,
  `SimuladorCamara`, `CapturaContinua`), que ya tiene diseño propio y trabajo sin commit.
- **Git**: `LIMPIO` = sin cambios; `M` = modificado sin commit; `??` = sin seguimiento. Detalle en §2.
- **Prueba** = existe un `.test.jsx` del componente. «Solo utils» = hay prueba de las funciones puras pero no del componente. «No» = ninguna.
- **Tamaño** = líneas del `.jsx` (y entre paréntesis hooks/utils propios).
- Ningún frente propuesto cambia RPC, rutas ni forma de los payloads: todo es capa de presentación y de validación de conveniencia
  (el servidor sigue siendo la validación real). Si algo exigiera tocar un contrato, va a `requests` (CLAUDE.md).

## 1. Lo más importante (resumen ejecutivo)

1. **Validación solo al enviar.** Casi todos los formularios muestran errores únicamente tras pulsar el botón; el campo no se valida al salir de él y tras un
   envío fallido el foco no va al primer error. Las únicas validaciones «vivas» son `ParametroFila` (tras cambiar el valor), `ReglasContrasena`,
   el contador de `Textarea` y la verificación de tipo y tamaño de `FileInput`.
2. **Ningún formulario avisa de «cambios sin guardar».** Casos críticos: los modales de catálogo se cierran con Esc y descartan lo escrito; las pestañas de
   `GrupoDetalle` desmontan su contenido (`{tab === 'x' && …}`) y pierden un horario a medio editar; las marcas de `PaseListaManual` viven en estado local y
   se pierden al salir. Solo el asistente facial registra `beforeunload`.
3. **Selects nativos sin búsqueda con listas enormes.** `GrupoForm` carga materias, docentes y aulas con `limit: 200` en tres `<select>`; `VinculoSelect` (docente)
   hasta 200; `RegistroManualDialog` y `FiltrosReporte` (alumno) hasta ~40; `PaseListaManual` pone un `<select>` por fila de alumno.
4. **Ningún campo declara el límite de la base.** `matricula` 10, `num_empleado` 10, `materia.clave` 8, `nombres` 60, apellidos 40, `edificio` 40,
   `materia.nombre` 80, correo 120. Solo `AulaForm.clave` (10), `GrupoForm.clave_grupo` (8) y `periodo` (6) llevan `maxLength`; el resto falla en el servidor y
   se ve como toast genérico tras enviar.
5. **Discrepancia cliente-servidor (error real):** `MateriaForm` acepta créditos de 0 a 99, pero la base exige `creditos > 0` (`ck_materia_creditos`;
   `0201_admin_catalogos.sql`: «creditos > 0»). Con 0 el cliente deja pasar y el servidor rechaza.
6. **Altas en dos llamadas con fallo parcial.** `NuevoAlumno` llama `alumnoGuardar` y luego `alumnoCambiarEstatus` si el estatus ≠ activo; `DocenteForm`
   guarda y luego cambia estatus. Si la segunda falla, el registro ya existe pero el toast dice «No se pudo guardar», y reintentar choca con `DUPLICADO`.
   En el alta de alumno el selector de Estatus no tiene sentido (nace activo): quitarlo del alta.
7. **Errores duplicados:** `GrupoForm` muestra el mismo error del servidor en un `Alert` y en un toast.
8. **Flujos sin «siguiente paso»:** alta de docente, aula y materia cierran con un toast; el alta de grupo aterriza en la pestaña *Datos* en vez de *Horario*;
   `CuentaAccesoPanel` solo aparece justo tras el alta de un alumno (la ficha no ofrece crear ni muestra el estado de la cuenta).
9. **Datos derivados sin aprovechar** (ver §3.x de cada ficha): correo desde la matrícula, correo desde el vínculo al crear una cuenta, vigencia del
   consentimiento (+1 año), fin de la hora de clase (+1 h), periodo por la fecha, vista previa de cuántas sesiones se generarán, etc.
10. **Duplicación:** la barra «buscar + filtros + botón Buscar» está copiada en `ListadoAlumnos`, `GruposTabla` y `CatalogoTabla` (y variantes en `BitacoraTabla`,
    `InscribirAlumno`, `VinculoSelect`); la contraseña temporal tiene dos interfaces (`PasswordTemporalModal` y el bloque de `CuentaAccesoPanel`); la
    regla de correo existe como regex en 3 archivos distintos (`alumnoForm.utils`, `catalogos/comun`, `importarCsv.utils`) y como `includes('@')` en login/recuperar;
    la capacidad del aula se edita en dos sitios (`AulaForm` y `CapacidadForm`).
11. **Accesibilidad de archivos:** `ConsentimientoPanel` y `RegistrarJustificanteForm` rotulan el `FileInput` con un `<span>` no asociado; `FileInput` ni siquiera
    acepta `id`, así que `Field` no puede etiquetarlo.
12. **Pase de lista manual lento:** 2 toques por alumno (abrir select + elegir) y sin «marcar todos presentes»; es el flujo cuyo objetivo es reducir tiempo.
13. **«Probar cámara» prueba lo guardado, no lo escrito:** `CamaraForm.probar` manda `id_camara`; si el usuario cambió la IP sin guardar, prueba la IP vieja.
14. **Dos textos sin tilde:** `CierreSesionDialog` («Cerrar sesion de clase» / «Cerrar sesion») y `RegistroManualDialog` («segun la hora»).
15. **Faltan primitivas** para resolver lo anterior de forma común: `Combobox`, `SegmentedControl`, `FormActions` (barra con «cambios sin guardar»), `FormSection`,
    `CampoFecha` con atajos, zona de arrastre para archivos, `Stepper`, `SuccessState`, `BarraFiltros` y un hook `useFormulario` (§4).

## 2. Estado del árbol de trabajo (git): NO pisar a ciegas

Archivos del alcance (y adyacentes) con cambios sin commit al 2026-10-06. El árbol tiene 96 entradas sucias, casi todas trabajo del usuario ajeno a formularios
(asistente facial, servicio de reconocimiento, video).

| Archivo | Estado | Qué hay sin commit | Regla para los frentes |
|---|---|---|---|
| `components/admin/alumnos/DetalleAlumno/DetalleAlumno.jsx` | M | 1 línea: pasa `nombreAlumno` a `PlantillaFacialPanel` | Editar solo con `Edit` quirúrgico; leer `git diff` antes; conservar esa línea |
| `components/revision/JustificanteCard/JustificanteCard.jsx` | M | +2 líneas: import y render de `EtiquetaSospechosa` (`j.sospechosa`) | Idem; conservar import y render |
| `components/ui/Button/Button.jsx` | M | Nuevo tamaño `lg` (`min-h-12 px-5 text-[15px]`), lo usa el asistente facial | Se puede añadir props nuevas con `Edit`; no tocar `TAMANOS` |
| `components/admin/alumnos/PlantillaFacialPanel/*` (+ test) | M | Rediseño del panel (192 líneas) hacia el asistente | **Congelado** (no está en ningún frente) |
| `components/admin/alumnos/CapturaGuiadaPlantilla/*` | D + M + `??` | Componente borrado; `capturaGuiada.utils.js` modificado | **Congelado**; `SubidaFotosPlantilla` importa sus utils |
| `components/admin/alumnos/RegistroFacialGuiado/` | `??` | Asistente nuevo, completo y con 744 líneas de prueba | **Congelado**; consume `ui/Select`, `ui/ConfirmDialog` |
| `components/admin/alumnos/SubidaFotosPlantilla/*` | LIMPIO | — | **Congelado de facto**: lo monta `RegistroFacialGuiado/PantallaArchivo` (sin commit) con su API actual (`tomas, minimo, maximo, onAgregar, onQuitar, botonRef`) |
| `components/revision/{CasoPendiente,ColaRevision/ListaCasos,LecturasCaso}` | M | Etiqueta «sospechosa» | No están en ningún frente |
| `components/revision/EtiquetaSospechosa/` | `??` | Componente nuevo | Importado por `JustificanteCard`; no tocar |
| `components/sesion/{CapturaContinua,SimuladorCamara/simuladorCamara.utils.js,VistaCamara}` | M | Cámara del pase de lista | **Congelado**; `CapturaContinua` y `SimuladorCamara` consumen `ui/Checkbox` y `ui/Select` |
| `components/ui/CameraCapture/*` | M | Cámara | Congelado |
| `components/ui/DeteccionRostros/`, `ui/MarcosRostros/` | `??` | Detección de rostros en vivo | Congelado |
| `components/layout/AppShell/AppShell.jsx`, `layout/Sidebar/Sidebar.jsx` | M | `relative` y `overscroll-contain` | Fuera de alcance (no tocar) |
| `app/globals.css` | M | `@keyframes registro-marca-entra` y `registro-guia-empuja` | Zona del integrador: **ningún frente lo edita**; si hace falta CSS global, a `requests` |
| `web/package.json`, `package-lock.json` | M | `@mediapipe/tasks-vision` y `postinstall` | Zona del integrador; los frentes **no añaden dependencias** |
| `lib/api/errors.js` | M | Código `FOTO_NO_CONSERVADA` (410) | Los formularios solo leen `ApiError`; no editar |
| `docs/design/SISTEMA.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md` | M | Texto del asistente facial y decisiones | Los frentes no los editan; el contrato de formularios va en archivos nuevos de `docs/design/formularios/` y el lead enlaza desde `SISTEMA.md` |

Candidatos de la lista del encargo **sin** cambios sin commit (LIMPIOS): `AlumnoForm`, `NuevoAlumno`, `ConsentimientoPanel`, `CuentaAccesoPanel`, `ListadoAlumnos`,
`AulaForm`, `DocenteForm`, `MateriaForm`, `CrearUsuarioDialog`, `PasswordTemporalModal`, `UsuariosPanel`, `CatalogoTabla`, `Listado{Aulas,Docentes,Materias}`,
todo `admin/grupos/*`, `RegistrarJustificanteForm`, `LoginForm`, `RecuperarForm`, `CambiarContrasenaForm`, `Onboarding`, `PasswordInput`, `FiltrosReporte`,
`RegistroManualDialog`, `PaseListaManual`, `ResolverComo`, `ParametroFila`, `IndiceFacialPanel`, `RelojDemo` y las primitivas `Field, Input, Select, Textarea, Checkbox,
FileInput, Modal, ConfirmDialog, Pills, Tabs, Toast, Alert`.

Higiene de commits para los frentes: `git add <rutas del frente>` explícitas (nunca `git add -A`/`-u`), sin `checkout`/`stash`/`reset` sobre el árbol compartido.

Consumidores de primitivas fuera del alcance que **no deben romperse** (cualquier cambio a `Select`, `Checkbox`, `ConfirmDialog`, `Modal`, `Button` es
compatible hacia atrás, mismas props y mismo DOM nativo por defecto): `RegistroFacialGuiado` (`PanelPose`, `PantallaCaptura`: `Select`; `RegistroFacialGuiado`:
`ConfirmDialog`), `CapturaContinua` y `SimuladorCamara` (`Checkbox`, `Select`), `ui/Pagination` (`Select`), `analitica/GraficaSerie` (`Checkbox`),
`tecnico/IndiceFacialPanel` (`Checkbox` dentro de `ConfirmDialog`).

## 3. Fichas

### 3.1 Primitivas `components/ui/*`

| Primitiva | Líneas | Prueba | Qué hace hoy | Qué le falta / problemas |
|---|---|---|---|---|
| `Field` | 37 | No | Envuelve **un** control: `label`, `hint`, `error` (`role="alert"` inmediato), `required` (asterisco + `required` al hijo), enlaza `aria-describedby`/`aria-invalid` con `cloneElement` | Sin «(opcional)», sin estado válido, sin contador ni ejemplo, el error aparece en cuanto existe (no sabe de «tocado»), solo un hijo (no sirve para grupos de radios), no reserva alto para el error (el layout salta) |
| `Input` | 22 | No | Base `CONTROL_BASE` (8 px, 40 px de alto, anillo de foco), `invalid`, `endAdornment` | Sin `startAdornment`, sin `onClear`, sin `maxLength` + contador, sin transformación al salir (`upper`/`lower`/`trim`), sin estado válido |
| `Select` | 29 | No | `<select>` nativo, `options` o hijos, `placeholder` como primera opción deshabilitada | Sin búsqueda, sin grupos, flecha nativa del SO (no hay `appearance-none` + Lucide), aspecto distinto por plataforma |
| `Textarea` | 25 | No | Contador `n/max` con `aria-live` | Sin autoajuste de alto |
| `Checkbox` | 35 | No | Casilla con fila táctil de 44 px, `hint`, `indeterminate` | Sin `Switch`, sin grupo de radios/segmentado |
| `FileInput` | 84 (+30 utils) | No | Botón + nombre + «Quitar», valida tipo y tamaño al elegir, error local o externo, `capture` | Un solo archivo (`multiple` no existe: por eso `SubidaFotosPlantilla` trae su propio `<input>`), sin arrastrar y soltar, sin vista previa, sin progreso, no acepta `id`/`aria-labelledby` (no se puede etiquetar con `Field`), nadie usa `capture` aunque el alumno suba desde el teléfono |
| `Modal` | 57 (+79 test) | Sí | `role="dialog"`, trampa de foco (`useDialog`), `size` sm/md/lg, `footer` aparte, `closeOnOverlay` | Sin botón cerrar visible, sin pantalla completa en teléfono, sin `dirty`/«descartar cambios», el pie no es pegajoso, Esc descarta sin preguntar |
| `ConfirmDialog` | 62 | Indirecta (Modal.test) | Confirmación con `onConfirm` asíncrono y `loading` | Sin campo de motivo/comentario integrado (útil para «Rechazar») |
| `Button` | 62 | No | primary/secondary/danger/ghost, `loading`, `icon`, `arrow`, `href` | `M`: tamaño `lg` sin commit |
| `Pills` | 36 (+test) | Sí | Filtro de un valor (`aria-pressed`) | No admite selección múltiple |
| `Tabs` | 68 | No | Pestañas con teclado | Sin aviso si hay cambios sin guardar al cambiar de pestaña |
| `Toast` | 89 | No | Hasta 3 avisos, errores duran el doble | Sin proveedor no hace nada (por diseño) |
| `Alert` | 34 | No | 4 tonos con icono Lucide | — |

Referencia para un combobox propio: `layout/PaletaComandos` ya implementa el patrón ARIA (`role="combobox"`, `aria-activedescendant`, listbox) sin dependencias.
`radix-ui` ya es dependencia (lo usa `shadcn/button.jsx`), pero un combobox hecho a mano evita peso y respeta el presupuesto de bundle.

### 3.2 Acceso y cuenta (`components/auth/*`, zona `screens-auth`)

**LoginForm** — `auth/LoginForm/LoginForm.jsx` (64; +46 hook `useLoginForm`, +30 utils, +7 `rutaSegura`)
- Dónde: página `/login` (`(public)/login/page.jsx` → `AuthCard`), pantalla dividida con `PanelProducto`.
- Campos: correo (`email`, requerido), contraseña (`PasswordInput`, requerida).
- Validación: al enviar (`validarLogin`: vacío o sin `@`); el error del servidor va a un `Alert` que recibe el foco (bien hecho).
- UX: sin validación al salir del campo; sin aviso de Bloq Mayús; tras un error se conserva el correo y se vacía la contraseña (correcto). Poco que rehacer: base buena.
- Prueba: sí (88). Git: LIMPIO.

**RecuperarForm** — `auth/RecuperarForm/RecuperarForm.jsx` (77)
- Dónde: `/recuperar`. Campo: correo (`email`, requerido).
- Validación: al enviar (`includes('@')`). Éxito: reemplaza el formulario por un `Alert` (anti-enumeración, correcto).
- UX: la pantalla de éxito no dice a qué correo se envió ni permite reenviar con enfriamiento; no hay «Abrir correo».
- Prueba: sí (37). Git: LIMPIO.

**CambiarContrasenaForm** — `auth/CambiarContrasenaForm/CambiarContrasenaForm.jsx` (116; +28 utils)
- Dónde: `/cambiar-contrasena` (recuperación) y como paso 1 de `/activar-cuenta` (`modo="activar"`, con `onExito`).
- Campos: nueva contraseña, confirmación (ambas `PasswordInput`, requeridas). Política: ≥ 10, letra y número.
- Validación: al enviar; además `ReglasContrasena` muestra las reglas en vivo (el único caso de validación en vivo de acceso). El error de `Field` repite lo que la regla ya dice.
- UX: sin barra de progreso de requisitos («2 de 3»); el botón siempre habilitado; sin aviso de Bloq Mayús.
- Prueba: sí (61). Git: LIMPIO.

**Onboarding** — `auth/Onboarding/Onboarding.jsx` (111; +`PasoEstilo` 44, `PasoGuia` 21, `PasoPrivacidad` 25, `guia.js` 49)
- Dónde: `/activar-cuenta` (4 pasos) y `/bienvenida` (3 pasos), panel blanco centrado con progreso numerado.
- Campos: contraseña (paso 1), color de avatar (radios), acuse «He leído el aviso de privacidad» (`Checkbox`, obligatorio solo al activar).
- UX: el botón principal se deshabilita sin decir por qué (acuse sin marcar); el progreso es una lista inline (candidato a extraer a `ui/Stepper`, con cuidado: la prueba fija `Paso 1 de 3`, `aria-label="Progreso"`).
- Prueba: sí (74). Git: LIMPIO.

**PasswordInput / ReglasContrasena** — `auth/PasswordInput` (36), `auth/ReglasContrasena` (20, test 32)
- Mostrar/ocultar con Lucide `Eye`/`EyeOff` y `aria-pressed`; reglas con icono + texto (nunca solo color). Bien resueltos; sin cambios mayores.
- Git: LIMPIO.

### 3.3 Alumnos (`components/admin/alumnos/*`, zona `screens-alumnos`)

**AlumnoForm** — `admin/alumnos/AlumnoForm/AlumnoForm.jsx` (53; +57 `alumnoForm.utils.js`)
- Dónde: tarjeta «Datos del alumno» en `/admin/alumnos/nuevo` (`NuevoAlumno`) y en `/admin/alumnos/[id]` (`DetalleAlumno`).
- Campos: matrícula\* (texto), correo institucional\* (`email`), apellido paterno\*, apellido materno, nombres\*, estatus (select de 4; en el alta también).
- Validación: al enviar (`validarAlumno`). Sin límites de longitud; sin normalizar al escribir (la matrícula no se pasa a mayúsculas).
- UX: seis campos planos en rejilla de 2 columnas, mezclando identidad, contacto y estado; el estatus en el alta no tiene sentido; `autoComplete="off"` en todo; sin «(opcional)» en apellido materno;
  el botón «Guardar cambios» siempre habilitado (sin detectar cambios); sin ejemplo en matrícula; correo no derivado de la matrícula (los datos de prueba usan `a001@unach.test` y la prueba
  `e260099@unach.mx`: patrón `matrícula@dominio`; el dominio habría que leerlo de configuración, ver §7).
- Prueba: sí (51). Git: LIMPIO.

**NuevoAlumno** — `admin/alumnos/NuevoAlumno/NuevoAlumno.jsx` (58)
- Dónde: página `/admin/alumnos/nuevo`. Tras guardar muestra `Alert` de éxito + «Ir a la ficha» + «Crear otro alumno» + `CuentaAccesoPanel` (base de pantalla de éxito, sin stepper).
- UX: el éxito se dice dos veces (toast y `Alert`); sin progreso «Datos → Cuenta → Consentimiento → Foto»; el alta en dos llamadas puede dejar el alumno creado con un toast de error (hallazgo 6).
- Prueba: no. Git: LIMPIO.

**DetalleAlumno** — `admin/alumnos/DetalleAlumno/DetalleAlumno.jsx` (115)
- Dónde: página `/admin/alumnos/[id]`; cuatro tarjetas apiladas (datos, consentimiento, plantilla, inscripciones) y acción de cabecera «Dar de baja» (con confirmación) / «Reactivar».
- UX: el **selector de Estatus del formulario permite `baja_definitiva` sin confirmación**, mientras que «Dar de baja» sí confirma (dos caminos con reglas distintas); tras guardar se refresca y el formulario se remonta por `key` (pierde el foco); sin ancla ni navegación entre tarjetas; la ficha no muestra ni ofrece la cuenta de acceso.
- Prueba: no. Git: **M** (1 línea; ver §2).

**ConsentimientoPanel** — `admin/alumnos/ConsentimientoPanel/ConsentimientoPanel.jsx` (207; +51 utils, +20 `useConsentimientos`)
- Dónde: tarjeta en la ficha del alumno. Si hay consentimiento vigente el formulario queda plegado tras «Registrar nuevo».
- Campos: fecha de firma\* (`date`, máx. hoy), vigente hasta\* (`date`, mín. firma), documento\* (PDF ≤ 10 MB, `FileInput`).
- Validación: al enviar (`validarConsentimiento`); `FileInput` valida tipo y tamaño al elegir.
- UX: sin valor por defecto en «vigente hasta» (derivable: firma + 1 año; atajos «+1 año/+2 años»); la fecha de firma podría ofrecer «Hoy»; el rótulo del documento es un `<span>` no asociado; sin progreso de subida de un PDF de hasta 10 MB;
  el historial muestra fechas ISO crudas («Firmado 2026-08-01»); tras registrar solo hay toast y el formulario se pliega.
- Prueba: sí (102). Git: LIMPIO.

**CuentaAccesoPanel** — `admin/alumnos/CuentaAccesoPanel/CuentaAccesoPanel.jsx` (78)
- Dónde: solo dentro de `NuevoAlumno` tras el alta. Un botón crea la cuenta con el correo institucional; muestra la contraseña temporal una vez, con «Copiar».
- UX: segunda interfaz de contraseña temporal distinta de `PasswordTemporalModal` (mismo secreto, dos pantallas); no existe en la ficha, así que un alumno sin cuenta solo se resuelve desde `/admin/usuarios`.
- Prueba: no. Git: LIMPIO.

**ListadoAlumnos** — `admin/alumnos/ListadoAlumnos/ListadoAlumnos.jsx` (115)
- Dónde: página `/admin/alumnos`. Barra: búsqueda (`type="search"`) + select de estatus + botón «Buscar»; tabla con paginación.
- Validación: n/a. UX: hay que pulsar «Buscar» (sin búsqueda mientras se escribe); sin chips de filtros activos ni «Limpiar»; copia de la barra de `CatalogoTabla`/`GruposTabla`.
- Prueba: no. Git: LIMPIO.

**IndicadorEstado**, **GaleriaTomas**, **CalidadFotoResumen**, **SubidaFotosPlantilla**, **PlantillaFacialPanel**, **RegistroFacialGuiado** — no se tocan (§2).
`SubidaFotosPlantilla` (90; +84 utils; test 177) tiene `<input type="file" multiple>` propio; cuando exista el modo `multiple` de `FileInput` conviene migrarla, pero **después** de que el asistente facial se confirme y se haga commit.

### 3.4 Catálogos y usuarios (`components/admin/catalogos/*`, zona `screens-catalogos`)

Contenedor común: `CatalogoTabla` (147, test 40) abre el formulario como **Modal** (`Formulario` con props `{ item, onClose, onGuardado }`) desde el botón «Nuevo…»/«Editar» de la fila. Todos usan el truco `type="submit" form={formId}` porque el pie del `Modal` está fuera del `<form>`.

**CatalogoTabla** — `catalogos/CatalogoTabla/CatalogoTabla.jsx` (147) · rutas `/admin/{aulas,docentes,materias,usuarios}` vía `Listado*`/`UsuariosPanel`
- Barra: búsqueda + filtros (selects con «Todos») + «Buscar»; `Pagination`. UX: sin debounce ni chips; tabla con scroll horizontal en 360 px; el vacío ofrece «Nuevo» (bien).
- Prueba: sí (40). Git: LIMPIO. `ListadoAulas` 29, `ListadoDocentes` 31, `ListadoMaterias` 29: solo configuración (sin prueba propia). LIMPIOS.

**AulaForm** — `catalogos/AulaForm/AulaForm.jsx` (83)
- Dónde: modal de `/admin/aulas` (`sm`/`md`: `max-w-lg`).
- Campos: clave\* (`maxLength` 10), edificio\* (sin límite; base 40), capacidad\* (`number`, entero 1–1000; mensaje «mayor que 0»).
- Validación: al enviar. UX: tres columnas (`sm:grid-cols-3`) en un modal de 512 px; sin ejemplo («A-12», «Edificio A»; los datos de prueba mezclan «A» y «Edificio A», sugerir edificio a partir del prefijo de la clave solo como propuesta editable);
  la clave no se pasa a mayúsculas; al guardar solo toast: no hay camino a «Configurar cámaras» (las cámaras solo se configuran en la pestaña *Aula y cámaras* de un grupo de esa aula).
- Prueba: no. Git: LIMPIO.

**DocenteForm** — `catalogos/DocenteForm/DocenteForm.jsx` (152)
- Dónde: modal de `/admin/docentes`.
- Campos: número de empleado\* (sin `maxLength`; base 10), correo\*, apellido paterno\*, apellido materno, nombres\*, estatus (solo en edición; select de 3).
- Validación: al enviar; baja pide `ConfirmDialog` que avisa si hay grupos (bien). Guardar + cambiar estatus son dos llamadas (fallo parcial, hallazgo 6).
- UX: mismos seis campos planos que `AlumnoForm`; `ESTATUS_DOCENTE` y `etiquetaEstatusDocente` se exportan desde el componente (deberían vivir en utils); tras crear no ofrece «Crear cuenta de acceso» (el docente sin cuenta se resuelve desde `/admin/usuarios`).
- Prueba: no. Git: LIMPIO.

**MateriaForm** — `catalogos/MateriaForm/MateriaForm.jsx` (94)
- Dónde: modal de `/admin/materias`.
- Campos: clave\* (sin límite; servidor máx. 8), nombre\* (sin límite; base 80), créditos\* (`number`, **0–99; el servidor exige > 0**), horas por semana\* (1–20, con hint «De 1 a 20.»).
- UX: `validarMateria` se exporta desde el componente; clave sin forzar mayúsculas; sin ejemplo («ADM101», 3 letras + 3 dígitos en los datos de prueba).
- Prueba: no. Git: LIMPIO.

**CrearUsuarioDialog + VinculoSelect** — `catalogos/CrearUsuarioDialog/CrearUsuarioDialog.jsx` (89), `VinculoSelect.jsx` (57), `rolesUsuario.js` (8)
- Dónde: modal «Nueva cuenta de usuario» desde `/admin/usuarios` (`UsuariosPanel` lo monta como «Formulario» del `CatalogoTabla`).
- Campos: correo\* (`email`), rol\* (select de 4, por defecto docente), vínculo\* (docente: select de hasta 200; alumno: caja de búsqueda y después select de resultados).
- Validación: al enviar (`CORREO`, vínculo si el rol lo exige); `VinculoSelect` consulta en cada pulsación a partir de 2 caracteres, sin debounce.
- UX: el **orden obliga a escribir el correo antes de saber a quién se vincula**, cuando `alumnosListar`/`docentesListar` ya devuelven `correo_institucional` (se puede prellenar al elegir el vínculo, editable); alumno = dos controles para una elección (campo de búsqueda + select);
  rol como select de 4 opciones (candidato a segmentado); tras crear sí hay buena pantalla de éxito (`PasswordTemporalModal`).
- Prueba: no. Git: LIMPIO.

**PasswordTemporalModal** — `catalogos/PasswordTemporalModal/PasswordTemporalModal.jsx` (75, test 39)
- Muestra la contraseña una sola vez, «Copiar», cierra con «Ya la copié». No deja la contraseña en el DOM si está cerrado (la prueba lo fija). Es el patrón a conservar; su contrato de props (`open, correo, contrasena, titulo, onClose`) debe quedar estable porque `CuentaAccesoPanel` podría reutilizarlo.
- Git: LIMPIO.

**UsuariosPanel / AccionesUsuario** — `catalogos/UsuariosPanel/UsuariosPanel.jsx` (70), `AccionesUsuario.jsx` (166)
- Dónde: `/admin/usuarios`; por fila 3 botones («Cambiar rol», «Restablecer contraseña», «Desactivar/Activar») + dos `ConfirmDialog` + `CambiarRolDialog` (modal con rol + `VinculoSelect`).
- UX: tres botones por fila en una columna «Acciones» (se apiñan a 360 px; un menú de acciones lo resuelve); `CambiarRolDialog` solo avisa «Seleccione un rol distinto» al enviar y deja el botón siempre activo; sin aviso de qué pasa con el vínculo anterior.
- Prueba: no. Git: LIMPIO.

**BitacoraTabla** (filtros) — `catalogos/BitacoraTabla/BitacoraTabla.jsx` (132; +49 utils; test 21) · `/admin/bitacora`
- Campos del filtro: acción (select de 8), entidad (texto libre), ID de usuario (numérico libre), desde, hasta (`date`).
- Validación: al aplicar (`armarFiltros`: ID numérico y desde ≤ hasta). UX: «ID de usuario» obliga a conocer el id interno (debería buscarse por correo); «Entidad» libre en vez de lista; fechas sin atajos («Hoy», «7 días», «30 días»); cinco campos en una fila a `lg`.
- Git: LIMPIO.

`catalogos/comun.js` (21): `mensajeDeError`, `textoONulo`, `enteroEnRango`, `CORREO` (candidato a consolidarse con la regla de correo en `lib/formularios`).

### 3.5 Grupos (`components/admin/grupos/*`, zona `screens-grupos`)

Estructura: `/admin/grupos` (`GruposTabla`) → `/admin/grupos/nuevo` (`NuevoGrupo` → `GrupoForm`) y `/admin/grupos/[id]` (`GrupoDetalle` con `Tabs`: Datos · Horario · Aula y cámaras · Inscripciones). El contenido de cada pestaña se **desmonta** al cambiar.

**GrupoForm** — `grupos/GrupoForm/GrupoForm.jsx` (98; +39 utils; +19 `NuevoGrupo`)
- Dónde: página de alta y pestaña *Datos*.
- Campos: materia\* (select ≤ 200: «clave - nombre»), docente\* (select ≤ 200: solo nombre, sin número de empleado), aula\* (select ≤ 200: «clave (capacidad N)», sin edificio), clave de grupo\* (`maxLength` 8; el servidor la pasa a mayúsculas pero el campo no), periodo\* (`maxLength` 6, formato AAAA-S).
- Validación: al enviar (`validarGrupo`); duplicados (materia + clave + periodo) los dice el servidor.
- UX: tres selects enormes sin búsqueda; todo el formulario se reemplaza por un spinner hasta que cargan los tres catálogos; el error del servidor sale **dos veces** (Alert y toast); el periodo no se sugiere (por fecha o por el último grupo);
  tras crear va a `/admin/grupos/{id}` en la pestaña *Datos* (debería ser *Horario*); sin «(cambios sin guardar)» al editar; sin ejemplo de clave («3A»).
- Prueba: no (solo mock en `GrupoDetalle.test`). Git: LIMPIO.

**HorarioEditor** — `grupos/HorarioEditor/HorarioEditor.jsx` (82; +80 utils; test 54)
- Dónde: pestaña *Horario*, tarjeta «Horario semanal».
- Campos: lista de bloques; cada uno: día (select Lunes–Sábado), inicio (`type="time"`), fin (`type="time"`) + «Quitar»; «Agregar bloque» añade lunes con horas vacías.
- Validación: se calcula en cada render pero **se muestra solo tras el primer intento de guardar** (`intentado`); fin > inicio y sin traslape del mismo día (el choque con otros grupos del aula lo dice el servidor con `Alert` de advertencia).
- UX (la «tabla incómoda»): un bloque = tres campos + botón, repetido por cada día (un grupo L-M-V pide 3 bloques idénticos a mano); sin «copiar a otros días»; sin vista semanal; sin sugerir `fin = inicio + 1 h`; sin total de horas (la materia declara `horas_semana`; comparar exige leerla con `materiaObtener`);
  `type="time"` varía por SO (12/24 h); los errores por fila aparecen solo bajo «Hora de inicio»; el editor se pierde al cambiar de pestaña sin avisar; al agregar no se enfoca el bloque nuevo.
- Prueba: sí (54). Git: LIMPIO.

**GenerarSesiones** — `grupos/GenerarSesiones/GenerarSesiones.jsx` (68; +38 utils; test 44)
- Dónde: pestaña *Horario*, tarjeta «Generar sesiones».
- Campos: desde\*, hasta\* (`date`), fechas a omitir (textarea libre «AAAA-MM-DD separadas por coma, espacio o salto de línea»).
- Validación: al enviar (rango ≤ 366 días, fechas reales). UX: sin valores por defecto (hoy / fin de periodo); **sin vista previa** de cuántas sesiones se crearán (se puede calcular con el horario + rango − omitidas); las fechas a omitir como texto libre son propensas a error (mejor lista de fechas con chips);
  el resumen aparece en un `Alert` pero no lleva a «Ver sesiones» ni «Inscribir alumnos» (siguiente paso).
- Prueba: sí (44; fija etiquetas `/Desde/`, `/Hasta/`, `/Fechas a omitir/`, botón «Generar sesiones», textos `Creadas: 12`, `Omitidas: 3`). Git: LIMPIO.

**InscribirAlumno** — `grupos/InscribirAlumno/InscribirAlumno.jsx` (81)
- Dónde: pestaña *Inscripciones*, tarjeta «Inscribir alumno».
- Campos: búsqueda «Matrícula o nombre» (mín. 2 caracteres) + botón «Buscar»; lista de hasta 10 resultados con «Inscribir» o «Ya inscrito».
- UX: dos pasos (escribir + Buscar); sin buscar mientras se escribe; máximo 10 resultados sin «ver más»; sin indicar la capacidad restante en el momento de inscribir; para inscribir a varios alumnos seguidos hay que volver a buscar cada vez (la búsqueda no se limpia ni se mantiene el foco). Tras inscribir, `InscripcionesTabla` recarga y el alumno pasa a «Ya inscrito» (bien).
- Prueba: no. Git: LIMPIO.

**ImportarCsv** — `grupos/ImportarCsv/ImportarCsv.jsx` (107; +93 utils; test del parser 33)
- Dónde: pestaña *Inscripciones*, tarjeta «Importar desde CSV» (máx. 500 filas, 1 MB).
- Campos: archivo CSV (`FileInput`), vista previa de 20 filas, botón «Importar N fila(s)», reporte por fila.
- Validación: el parser valida al elegir (matrícula, correo, repetidas); descarta filas con motivo. UX: el formato se explica en un párrafo (columnas en texto corrido) sin **plantilla descargable**; sin arrastrar y soltar; el reporte final no se puede descargar; el flujo (elegir → revisar → importar → reporte) no se muestra como pasos.
- Prueba: solo utils. Git: LIMPIO.

**CamaraForm + AulaCamaras** — `grupos/CamaraForm/CamaraForm.jsx` (98; +35 utils), `grupos/AulaCamaras/AulaCamaras.jsx` (82)
- Dónde: pestaña *Aula y cámaras*: tarjeta de capacidad (`CapacidadForm`, dentro de `AulaCamaras`) y dos tarjetas (frente/fondo) con `CamaraForm`.
- Campos de cámara: tipo (select de 2: IP/navegador), dirección IP\* (solo si IP), estatus (select de 3); capacidad\* (`number`).
- Validación: al enviar (IP v4/v6 simple). UX: IP sin ejemplo ni máscara (`10.20.12.2`); tipo y estatus como selects de 2–3 opciones (segmentado); «Probar» prueba la IP **guardada**, no la escrita (hallazgo 13); la capacidad se edita aquí y también en `AulaForm` (dos caminos); `CapacidadForm` no muestra cuántos alumnos hay inscritos
  (el servidor rechaza una capacidad menor), solo lo dice después.
- Prueba: no. Git: LIMPIO.

**GruposTabla** — `grupos/GruposTabla/GruposTabla.jsx` (101) · `/admin/grupos`
- Barra: búsqueda libre + periodo como **texto libre** «AAAA-S» + «Buscar». UX: el periodo debería ser selector de periodos existentes o por defecto el vigente; sin chips ni debounce. Prueba: no. Git: LIMPIO.

**InscripcionesTabla / GrupoDetalle** — `grupos/InscripcionesTabla/InscripcionesTabla.jsx` (104), `grupos/GrupoDetalle/GrupoDetalle.jsx` (73; test 89)
- Contenedores: capacidad con alertas (bien), baja con `ConfirmDialog`; `GrupoDetalle` decide qué pestaña se ve (no recuerda ni acepta `?tab=`). `GrupoDetalle` tiene prueba; `InscripcionesTabla` no. Git: LIMPIO.

### 3.6 Justificantes, revisión y pase de lista manual

**RegistrarJustificanteForm** — `alumno/RegistrarJustificanteForm/RegistrarJustificanteForm.jsx` (98; +32 utils, +52 `useRegistrarJustificante`)
- Dónde: portal del alumno `/alumno` (`?justificar=<id_sesion>` preselecciona), tarjeta junto a «Mis justificantes» (dos columnas en `lg`).
- Campos: falta o retardo\* (select ≤ 50: «Materia · 3A — 14 sep — Ausente»), motivo\* (`Textarea`, máx. 200, contador), documento\* (PDF/JPG/PNG ≤ 5 MB).
- Validación: al enviar; `FileInput` valida al elegir. Envío en dos pasos con texto de fase y reintento sin resubir (bien hecho).
- UX: el alumno suele subir **desde el teléfono**, pero no se usa `capture` ni hay vista previa de la foto; el rótulo del documento es un `<span>` (no asociado); `misJustificables` devuelve `tiene_rechazado` y el formulario no lo muestra; el éxito es un toast y el formulario se vacía (el estado visible está en la tarjeta vecina);
  sin atajos de motivo.
- Prueba: sí (81; fija `/Falta o retardo/`, `/Motivo/` con `maxlength=200` y contador `4/200`). Git: LIMPIO.

**JustificanteCard** — `revision/JustificanteCard/JustificanteCard.jsx` (153; test 73)
- Dónde: panel de detalle de `/docente/revision?pestana=justificantes&caso=<id>`.
- Campos: comentario (opcional, máx. `MAX_COMENTARIO`, contador) + decisión «Aprobar» / «Rechazar», cada una con `ConfirmDialog`.
- UX: el comentario está arriba, **fuera del diálogo de confirmación**, y es opcional también al rechazar (el alumno puede quedarse sin explicación); los textos de confirmación no repiten la decisión ni el comentario.
- Git: **M** (+2 líneas de `EtiquetaSospechosa`; ver §2).

**ResolverComo** — `revision/ResolverComo/ResolverComo.jsx` (50; +34 utils; test 50)
- Dónde: `CasoPendiente` (pestaña *Pendientes*). Comentario opcional + un botón por estado destino (un clic ejecuta; reversible dentro del plazo); el estado sugerido es primario. Diseño correcto; solo falta alinear el contador y el texto de ayuda. Git: LIMPIO.

**RegistroManualDialog** — `sesion/RegistroManualDialog/RegistroManualDialog.jsx` (70)
- Dónde: modal desde la sesión en vivo (`/docente/sesiones/[id]`, `MonitorSesion`).
- Campos: alumno\* (select de elegibles o fijo si viene `alumno`), estado\* (select de 3: presente/retardo/ausente, sugerido según la hora).
- UX: select de alumnos sin búsqueda; estado como select (debería ser segmentado con el color del estado); **no hay «Guardar y registrar otro»** (cada alumno exige reabrir el diálogo); el modal se puede cerrar mientras guarda; etiquetas con `<label>` manual (no `Field`); texto «segun» sin tilde.
- Prueba: no. Git: LIMPIO.

**PaseListaManual** — `sesion/PaseListaManual/PaseListaManual.jsx` (121; +8 utils)
- Dónde: `/docente/sesiones/[id]` cuando el aula no tiene cámaras activas (modo manual, RN-06): barra de progreso, acciones («Guardar y cerrar», «Guardar», «Marcar restantes según la hora») y `Table` con un `Select` por alumno (Sin marcar/Presente/Retardo/Ausente).
- UX: **2 toques por alumno**; sin «Todos presentes»; las marcas son estado local (no se avisa si se sale sin guardar); en 360 px la tabla desplaza horizontalmente con el select de 9 rem; sin búsqueda de alumno; teclado: sin atajos.
- Prueba: solo utils. Git: LIMPIO.

**CierreSesionDialog** — `sesion/CierreSesionDialog/CierreSesionDialog.jsx` (40): confirmación con explicación; textos «Cerrar sesion de clase» y «Cerrar sesion» **sin tilde**. Prueba: no. Git: LIMPIO.

### 3.7 Filtros de reportes y analítica

**FiltrosReporte** — `reportes/FiltrosReporte/FiltrosReporte.jsx` (49) · `/reportes` (`?periodo&grupo&alumno`)
- Tres selects en cascada (periodo → grupo → alumno). UX: «alumno» es un select de hasta ~40 sin búsqueda; el periodo no tiene opción vacía; no hay chips ni «Limpiar». Prueba: no. Git: LIMPIO.

**SelectorGrupo** — `analitica/SelectorGrupo/SelectorGrupo.jsx` (36) · `/analitica` (`?periodo&grupo`): periodo + grupo; mismo patrón; la opción «Elige un grupo» está deshabilitada. Prueba: no (solo mock). Git: LIMPIO.

### 3.8 Consola técnica y reloj de demostración

**ParametroFila / ParametrosEditor** — `tecnico/ParametroFila/ParametroFila.jsx` (84; +61 utils), `tecnico/ParametrosEditor/ParametrosEditor.jsx` (54; test 71) · `/tecnico` (el técnico edita; el administrador solo consulta)
- Campo: valor numérico por parámetro (`inputMode="decimal"`), «Guardar» + `ConfirmDialog` que muestra «de X a Y» y, para críticos, un `Alert` con el aviso.
- Validación: **en línea** (tras cambiar el valor) y de rango; mejor ejemplo de validación viva del proyecto.
- UX: la etiqueta es la clave técnica cruda (`umbral_similitud`); sin control de rango visual para umbrales 0–1. Prueba: sí (el editor; solo utils para la fila). Git: LIMPIO.

**IndiceFacialPanel / CamarasEstado** — `tecnico/IndiceFacialPanel` (171; test 115), `tecnico/CamarasEstado` (157; test 139): acciones con `ConfirmDialog` (casilla «Reconstrucción completa»; select de estatus por cámara). No son capturas de datos; solo heredan los cambios de primitivas. Git: LIMPIO.

**RelojDemo** — `layout/RelojDemo/RelojDemo.jsx` (168; +78 utils, +115 hook; test 427): solo desarrollo local, `datetime-local` y botones de salto. No se rediseña; hereda `Input`/`Button`. Git: LIMPIO.

## 4. Mejoras transversales propuestas a `components/ui/*`

Reglas para todas (de `CLAUDE.md`/`SISTEMA.md`): un componente por carpeta (`Nombre.jsx`, `nombre.utils.js`, `Nombre.test.jsx`, `index.js`); solo tokens semánticos; iconos Lucide con `aria-hidden`; 360 px sin desborde;
solo `transform`/`opacity` y apagado con «reducir movimiento»; **sin dependencias nuevas** y sin tocar `globals.css`; compatibles hacia atrás (`Select`, `Checkbox`, `ConfirmDialog`, `Modal`, `Button` conservan su API y su DOM por defecto, ver §2).

### 4.1 Piezas nuevas

| Componente | Para qué | API de props sugerida | Quién lo usa |
|---|---|---|---|
| **`Combobox`** | Selector con búsqueda; sustituye a los `<select>` largos y a «caja de búsqueda + select» | `value`, `onChange(value, opcion)`, `options` `[{ value, label, description?, group?, disabled? }]` **o** `loadOptions(q, { signal })` (remoto, `debounceMs` 250, `minChars` 2), `selected` `{ value, label }` (etiqueta inicial en modo remoto), `placeholder`, `emptyText`, `loadingText`, `clearable`, `disabled`, `invalid`, `id`, `name`, `renderOption`. Patrón ARIA combobox/listbox (como `PaletaComandos`), opción ≥ 44 px, Esc cierra, Enter elige, búsqueda sin acentos | `GrupoForm` (3), `VinculoSelect`, `InscribirAlumno`, `RegistroManualDialog`, `FiltrosReporte`/`SelectorGrupo`, `BitacoraTabla` (usuario) |
| **`SegmentedControl`** | 2–4 opciones excluyentes visibles a la vez (no filtro, no navegación) | `items` `[{ value, label, icon?, tone? }]` (`tone`: tokens de estado), `value`, `onChange`, `label` (aria-label), `size` `sm\|md`, `fullWidth`, `disabled`. `role="radiogroup"`/`radio`, flechas | Estatus (alumno/docente/cámara), tipo de cámara, rol, estado P/R/A en `RegistroManualDialog` y `PaseListaManual` (con color + texto) |
| **`FormActions`** | Barra de acciones del formulario: pegajosa al pie en teléfono, con «Cambios sin guardar» | `children`, `sticky` (por defecto en < `sm`), `dirty`, `dirtyText` («Cambios sin guardar»), `summary?`, `align`. Respeta el área segura (`pb-[env(safe-area-inset-bottom)]`) | `AlumnoForm`, `GrupoForm`, `HorarioEditor`, `PaseListaManual`, `ConsentimientoPanel` |
| **`FormSection`** | Agrupar campos con título y ayuda (`<fieldset>` + `<legend>`) | `title`, `description?`, `columns` 1\|2\|3, `children`, `collapsible?` | `AlumnoForm`, `DocenteForm`, `GrupoForm`, `CamaraForm` |
| **`CampoFecha`** (y `RangoFechas`) | `Input type="date"` con atajos y límites; el par desde/hasta con validación cruzada | `value`, `onChange`, `min`, `max`, `atajos` `[{ label, valor \| () => valor }]` («Hoy», «+1 año», «Fin de periodo»); `RangoFechas`: `desde`, `hasta`, `onChange({ desde, hasta })`, `atajos` («7 días», «30 días») | `ConsentimientoPanel`, `GenerarSesiones`, `BitacoraTabla` |
| **`Stepper`** | Progreso de flujos de varios pasos | `steps` `[{ id, label, description?, estado?: 'hecho'\|'actual'\|'pendiente'\|'error' }]`, `current`, `onSelect?`, `compact` (en móvil «Paso 2 de 4 · Horario»). Lucide `Check`; `aria-current="step"` | Flujo del alumno nuevo, flujo del grupo nuevo, importación CSV; `Onboarding` puede migrar después |
| **`SuccessState`** | Pantalla de éxito con «siguiente paso» (hermana de `EmptyState`/`ErrorState`) | `title`, `description`, `actions` `[{ label, href \| onClick, variant }]`, `steps?` (lista de pendientes con enlace), `icon` (Lucide por defecto `CircleCheck`) | `NuevoAlumno`, `NuevoGrupo`, altas de docente/aula/materia, `GenerarSesiones` |
| **`BarraFiltros`** | Búsqueda con retraso + filtros + chips de filtros activos + «Limpiar» | `q`, `onQ`, `placeholder`, `debounceMs` 300, `filtros` `[{ name, label, options, value, onChange }]`, `resultado?` (texto «N resultados»), `onLimpiar`. Si `q` cambia a 0 caracteres limpia al instante | `ListadoAlumnos`, `CatalogoTabla`, `GruposTabla`, `BitacoraTabla` |
| **`Switch`** (baja prioridad) | Interruptor con efecto inmediato | `checked`, `onChange`, `label`, `hint`, `disabled`; `role="switch"` | opcional: «Reconstrucción completa», activo/inactivo |
| **`MenuAcciones`** (baja prioridad) | Menú «⋯» para acciones por fila (Lucide `EllipsisVertical`) | `items` `[{ label, onClick, danger?, disabled? }]`, `label` (aria-label) | `AccionesUsuario`, tablas con 3+ botones por fila |

### 4.2 Ampliaciones compatibles de primitivas existentes

| Primitiva | Cambio (props opcionales; sin cambiar defaults) |
|---|---|
| `Field` | `optional` (muestra «(opcional)»), `valid` (icono `Check` + `text-presente` y texto accesible «válido»), `example` («Ej. E260099»), `counter` `{ actual, max }`, `labelAction` (enlace a la derecha), reserva de alto para el error, aceptar hijos no controlables (grupos) con `as="fieldset"` |
| `Input` | `startAdornment`, `onClear`, `showCount` + `maxLength`, `transform` (`'upper'\|'lower'\|'trim'`, se aplica al salir del campo), `valid` |
| `Select` | `appearance-none` + `ChevronDown` de Lucide para igualar plataformas, `groups` (`optgroup`); API de `options`/`placeholder`/`children` intacta |
| `FileInput` | `variant="zona"` (arrastrar y soltar + clic + teclado), `multiple` + `maxFiles`, `hint` («PDF, máx. 10 MB»), `progress` (0–100 \| null), `preview` (`'imagen'\|'nombre'`), aceptar `id`/`aria-labelledby`/`aria-describedby` para que `Field` lo etiquete; `onSelect(file)` sigue funcionando |
| `Modal` | `dirty` + `onDiscard` (Esc, overlay y «Cancelar» piden confirmar con un `ConfirmDialog`), botón cerrar visible (Lucide `X`), `size="full-mobile"` (pantalla completa < 640 px con pie fijo); defaults idénticos a los de hoy |
| `ConfirmDialog` | `reason` `{ label, required, maxLength }` (campo de motivo/comentario integrado; `onConfirm(texto)`) para «Rechazar» y «Dar de baja» |
| `Alert` | Prop `compact` opcional; sin otros cambios |
| `Tabs` | `confirmLeave` `(() => boolean)` para frenar el cambio de pestaña con cambios sin guardar |
| `Pills` | `multiple` (valor como arreglo) para chips de selección múltiple |

### 4.3 Hooks y utilidades

| Pieza | API sugerida | Ubicación (zona `ui-kit`) |
|---|---|---|
| `useFormulario` | `useFormulario({ inicial, validar(valores) => errores, onSubmit(valores) => Promise, validarAlSalir = true })` → `{ valores, setCampo, campo(nombre) => { value, onChange, onBlur, invalid, error }, errores (solo de campos tocados o tras intentar enviar), sucio, valido, enviando, errorEnvio, enviar, reiniciar(nuevoInicial) }`. Enfoca el primer campo inválido tras un envío fallido; reutiliza `useApiMutation` para evitar doble envío | `hooks/ui/useFormulario.js` (+ prueba) |
| `useCambiosSinGuardar` | `useCambiosSinGuardar(sucio)` → registra `beforeunload` (cubre recargar y cerrar pestaña) y expone `confirmarSalida()` para modales y pestañas propias. **Para navegación interna** el App Router no ofrece un bloqueo oficial: confirmar en `web/node_modules/next/dist/docs/01-app/` antes de decidir (CLAUDE.md: «este Next NO es el que conoces»); mientras tanto basta con interceptar los `Link`/pestañas propios | `hooks/ui/useCambiosSinGuardar.js` |
| `useDebounce` | `useDebounce(valor, ms)` | `hooks/ui/useDebounce.js` |
| `lib/formularios` | `esCorreo`, `enteroEnRango`, `soloDigitos`, `mayusculas`, `sinAcentos`, `LIMITES` (matricula 10, num_empleado 10, materia.clave 8, materia.nombre 80, aula.clave 10, aula.edificio 40, nombres 60, apellidos 40, correo 120, clave_grupo 8) para consolidar las tres regex de correo y los `maxLength` | `lib/formularios/*.js` (+ pruebas) |

### 4.4 Qué NO se propone (para no inflar)

Sin librería de formularios (react-hook-form/formik), sin librería de combobox ni de fechas, sin medidor de «fuerza» de contraseña inventado (la política real son 3 reglas: usar `ReglasContrasena` con barra «N de 3»,
local a `auth`), sin guardado automático. Un selector de fechas propio (calendario desplegable) no entra en esta fase: `type="date"` con atajos cubre los casos.

## 5. Partición en 6 frentes con archivos disjuntos

Todas las rutas relativas a `web/src/` salvo indicación. Verificado por directorio: ningún archivo aparece en dos frentes. Lo que no figura aquí **no se toca** (incluye todo lo de §2 marcado como congelado).

### F1 · Primitivas, hooks y utilidades de formulario (zona `ui-kit`) — **bloqueante**

- Edita (cambios aditivos): `components/ui/{Field,Input,Select,Textarea,Checkbox,FileInput,Modal,ConfirmDialog,Alert,Tabs,Pills}/**`. `ui/Button/Button.jsx` (M): solo con `Edit` quirúrgico y solo si hace falta; no tocar `TAMANOS`.
- Crea: `components/ui/{Combobox,SegmentedControl,FormActions,FormSection,CampoFecha,Stepper,SuccessState,BarraFiltros,Switch,MenuAcciones}/**`, `hooks/ui/{useFormulario,useCambiosSinGuardar,useDebounce}.js` (+ pruebas), `lib/formularios/**`.
- Documenta: `docs/design/formularios/PRIMITIVAS.md` (contrato de cada pieza; el lead lo enlaza desde `SISTEMA.md`).
- Pruebas nuevas: `Field`, `Input`, `Select`, `Textarea`, `Checkbox`, `FileInput`, `ConfirmDialog`, `Tabs` y todas las piezas nuevas (hoy ninguna de esas tiene prueba).
- Entrega en dos oleadas: **A1** (desbloquea a los demás): `useFormulario`, `Field` ampliado, `FormSection`, `FormActions`, `Combobox`, `SegmentedControl`, `BarraFiltros`, `CampoFecha`, `Modal` con `dirty`/`full-mobile`, `FileInput` zona, `lib/formularios`. **A2**: `Stepper`, `SuccessState`, `Switch`, `MenuAcciones`, `ConfirmDialog.reason`, `Tabs.confirmLeave`, `Pills.multiple`.
- Si hubiera capacidad extra, F1 se parte limpiamente en dos agentes por carpetas: F1a (campos: `Field`, `Input`, `Select`, `Textarea`, `Checkbox`, `FileInput`, `Combobox`, `SegmentedControl`, `Switch`, `CampoFecha`, `lib/formularios`) y F1b (contenedores y hooks: `Modal`, `ConfirmDialog`, `Alert`, `Tabs`, `Pills`, `FormActions`, `FormSection`, `Stepper`, `SuccessState`, `BarraFiltros`, `MenuAcciones`, `hooks/ui/*`).

### F2 · Acceso y consola técnica (zonas `screens-auth` y `screens-tecnico`)

- `components/auth/{LoginForm,RecuperarForm,CambiarContrasenaForm,Onboarding,PasswordInput,ReglasContrasena}/**`
- `components/tecnico/{ParametroFila,ParametrosEditor,IndiceFacialPanel,CamarasEstado}/**`
- `components/layout/RelojDemo/**` (opcional y al final; solo desarrollo)
- Páginas finas si hiciera falta: `app/(public)/**`, `app/(flujo)/**`, `app/(app)/tecnico/**`.
- Alcance: validación al salir del campo, aviso de Bloq Mayús, barra «N de 3 requisitos», reenvío con enfriamiento en `RecuperarForm`, motivo del botón deshabilitado en `Onboarding`, etiquetas amigables en parámetros (clave técnica en mono), `SegmentedControl` para estatus de cámara.
- Sin dependencias de otros frentes salvo la adopción tardía de A1.

### F3 · Alumnos: alta, ficha y consentimiento (zona `screens-alumnos`, solo la parte de formularios)

- `components/admin/alumnos/{AlumnoForm,NuevoAlumno,ListadoAlumnos,ConsentimientoPanel,CuentaAccesoPanel,DetalleAlumno,IndicadorEstado}/**` (`DetalleAlumno` es M: solo `Edit` quirúrgico, conservar `nombreAlumno`).
- `app/(app)/admin/alumnos/**`.
- **Congelado** (no tocar): `SubidaFotosPlantilla`, `GaleriaTomas`, `CalidadFotoResumen`, `PlantillaFacialPanel`, `RegistroFacialGuiado`, `CapturaGuiadaPlantilla`.
- Alcance: secciones (Identidad / Contacto / Estado), límites y normalización, quitar Estatus del alta (y resolver el fallo parcial), correo sugerido desde la matrícula (dominio por configuración), vigencia +1 año con atajos, `FileInput` etiquetado y con progreso, mostrar y ofrecer la cuenta de acceso en la ficha (reutilizando `PasswordTemporalModal` de F4 con su contrato congelado, o su propio bloque), `SuccessState` con pasos del alta, `BarraFiltros`, confirmación única para la baja.

### F4 · Catálogos y usuarios (zona `screens-catalogos`)

- `components/admin/catalogos/**` (`AulaForm`, `DocenteForm`, `MateriaForm`, `CatalogoTabla`, `Listado{Aulas,Docentes,Materias}`, `CrearUsuarioDialog` y `VinculoSelect`, `PasswordTemporalModal`, `UsuariosPanel` y `AccionesUsuario`, `BitacoraTabla`, `comun.js`, `ResumenAdmin` sin cambios).
- `app/(app)/admin/{aulas,docentes,materias,usuarios,bitacora}/**`.
- Alcance: `maxLength`/límites de la base, corregir créditos > 0, mayúsculas en claves, resolver altas en dos llamadas, `SuccessState`/«siguiente paso» (docente → crear cuenta; aula → configurar cámaras), `Combobox` en `VinculoSelect` con correo prellenado, `BarraFiltros` en `CatalogoTabla`, `MenuAcciones` en `AccionesUsuario`, `RangoFechas` y filtro de usuario por correo en `BitacoraTabla`, formularios a pantalla completa en teléfono (`Modal size="full-mobile"`), pruebas de los formularios que hoy no tienen.
- **Contrato congelado:** `PasswordTemporalModal` conserva `{ open, correo, contrasena, titulo, onClose }` y `index.js` (lo puede importar F3).

### F5 · Grupos (zona `screens-grupos`) — el de mayor trabajo propio

- `components/admin/grupos/**` (10 carpetas) y `app/(app)/admin/grupos/**`.
- Alcance: `GrupoForm` con `Combobox`, periodo sugerido, clave en mayúsculas, un solo aviso de error y aterrizaje en *Horario*; `GrupoDetalle` con `?tab=` y aviso de cambios sin guardar al cambiar de pestaña (`Tabs.confirmLeave`);
  `HorarioEditor` rediseñado (días como chips + una hora para generar N bloques, copiar a otros días, fin = inicio + 1 h, total de horas, errores en línea, vista semanal compacta);
  `GenerarSesiones` con valores por defecto, vista previa de sesiones y lista de fechas a omitir con chips; `InscribirAlumno` con `Combobox` remoto; `ImportarCsv` con plantilla descargable, arrastrar y soltar, reporte descargable y `Stepper`;
  `CamaraForm` con ejemplo de IP, `SegmentedControl` y «Probar» solo con cambios guardados (o aviso); `CapacidadForm` con inscritos actuales; `GruposTabla` con `BarraFiltros` y periodo como selector.
- Mantener las pruebas existentes (`GrupoDetalle`, `HorarioEditor`, `GenerarSesiones`, `ImportarCsv`) o actualizarlas en el mismo frente.

### F6 · Justificantes, revisión, pase manual y filtros de análisis (zonas `screens-revision`, `screens-sesiones`, `screens-reportes`, `screens-analitica`, solo los archivos listados)

- `components/alumno/RegistrarJustificanteForm/**`
- `components/revision/{JustificanteCard,ResolverComo}/**` (`JustificanteCard` es M: solo `Edit` quirúrgico, conservar `EtiquetaSospechosa`)
- `components/sesion/{RegistroManualDialog,PaseListaManual,CierreSesionDialog}/**`
- `components/reportes/FiltrosReporte/**`, `components/analitica/SelectorGrupo/**`
- **No tocar:** `CapturaContinua`, `SimuladorCamara`, `VistaCamara`, `AbrirSesion`, `MonitorSesion`, `MisJustificantes`, `CasoPendiente`, `ColaRevision`, `LecturasCaso`.
- Alcance: `PaseListaManual` con `SegmentedControl` por alumno (un toque), «Todos presentes», búsqueda y aviso de cambios sin guardar; `RegistroManualDialog` con `Combobox`, `SegmentedControl`, «Guardar y registrar otro» y tildes; `CierreSesionDialog` con tildes;
  `RegistrarJustificanteForm` con `capture`, vista previa, rótulo asociado, `tiene_rechazado` visible y estado de éxito dentro de la tarjeta; `JustificanteCard` con motivo dentro del diálogo al rechazar (`ConfirmDialog.reason`); `FiltrosReporte`/`SelectorGrupo` con `Combobox` para grupo y alumno.
- Zonas cruzadas: este frente toca archivos de varias zonas de `docs/ARCHITECTURE.md` §7; el lead debe autorizarlo explícitamente (hoy cada agente solo edita lo suyo).

### Orden y dependencias

```
Paso 0  Lead: decidir §7 (preguntas abiertas) y asignar frentes.
Paso 1  F1-A1 (bloqueante). En paralelo, F2…F6 hacen su «pasada 1» sin primitivas nuevas:
        límites y normalización, correcciones de validación (créditos > 0), tildes, defaults derivados,
        reglas de «siguiente paso», lógica pura con sus pruebas (utils), copia de textos.
Paso 2  F1-A1 entregada y con commit → F2…F6 hacen su «pasada 2»: adoptar Combobox, SegmentedControl, FormActions,
        FormSection, CampoFecha, BarraFiltros, Modal dirty/full-mobile, FileInput zona, useFormulario.
Paso 3  F1-A2 (Stepper, SuccessState, Switch, MenuAcciones, ConfirmDialog.reason, Tabs.confirmLeave) en paralelo con la
        pasada 2; F4, F5 y F6 las adoptan cuando aterricen.
Paso 4  Lead: integración (SISTEMA.md → sección «Formularios», `npm run lint`, `npm test`, un único `npm run build`,
        revisión a 360 px, claro y oscuro, reducir movimiento).
```

Dependencias entre frentes: **F2–F6 dependen de F1** (primitivas); F2–F6 son **independientes entre sí**. Única dependencia blanda: F3 puede reutilizar `PasswordTemporalModal` de F4 (contrato fijo; no requiere orden de fusión).
Orden de fusión sugerido: F1-A1 → F4 → F3 → F5 → F6 → F2 → F1-A2.

### Criterios comunes de aceptación por frente

- 360 px sin desborde horizontal; foco visible; «reducir movimiento»; tokens semánticos (sin hex); Lucide con `aria-hidden`; texto en español con tildes; 4 espacios, comillas simples, punto y coma.
- Un componente = una carpeta; utilidades puras en `*.utils.js`; pruebas con `// @vitest-environment jsdom`; no romper las pruebas existentes: fijan etiquetas y textos
  (p. ej. `/Matrícula/`, `Crear alumno`, `Guardar horario`, `Generar sesiones`, `/Falta o retardo/`, `4/200`, `Paso 1 de 3`, `Copiada al portapapeles.`); si se cambia un texto a propósito, se actualiza la prueba en el mismo frente.
- `npm run lint` y `npx vitest run <rutas del frente>` verdes; `next build` solo lo corre el lead.
- Sin cambios a RPC, rutas, payloads ni `docs/api/*`; hallazgos de contrato a `requests`.
- Antes de editar un archivo marcado M en §2: `git diff -- <archivo>`; usar `Edit`, no reescribir el archivo entero.

## 6. Trabajo derivado que NO es de estos frentes (`requests`)

- **Integrador (`globals.css`, `package.json`, `config.js`):** ninguna dependencia nueva prevista; si el pie pegajoso o una animación de éxito necesitaran CSS global, pedirlo aquí. Exponer el **dominio de correo institucional** en configuración (para sugerir el correo del alumno).
- **db-api-b (opcional, no bloqueante):** `api_grupo_obtener` no devuelve `horas_semana` de la materia (para comparar con el total del horario sin una consulta extra); `api_mis_justificables` ya trae `tiene_rechazado` (basta usarlo).
- **Asistente facial:** cuando se haga commit del asistente, migrar `SubidaFotosPlantilla` al modo `multiple` de `FileInput` y retirar su `<input>` propio.

## 7. Decisiones abiertas para el lead

1. ¿Dominio institucional para sugerir el correo del alumno (`@unach.mx`?) y de dónde se lee (configuración)? Sin dominio, la sugerencia se omite.
2. ¿Quitar el selector de **Estatus del alta de alumno** (nace activo) y unificar la baja con confirmación en la ficha? (Recomendado: sí.)
3. ¿Créditos = 0 son válidos para alguna materia? La base dice que no: alinear el cliente a `> 0` (recomendado).
4. ¿Se acepta un `Combobox` hecho a mano (sin `cmdk` ni Radix) para respetar el presupuesto de JS? (Recomendado: sí; el patrón ya existe en `PaletaComandos`.)
5. ¿Se autoriza que F6 cruce zonas (revisión, sesión, reportes, analítica) o se parte en dos agentes?
6. ¿Calendario de periodos (inicio y fin de cada `AAAA-S`) para sugerir fechas en `GenerarSesiones`? Sin él, solo se sugiere «hoy» y se deja el fin vacío.
