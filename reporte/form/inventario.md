# Inventario de formularios y flujos guiados de SUSAN (`web/src`)

Fuente: código de `origin/main` (commit `f742bb4`), leído en `susan-main/web/src`. Todo lo de abajo sale del código; las rutas, los textos de validación y las llamadas
están copiados de los archivos citados. Convenciones de lectura:

- **Ruta**: la pantalla donde vive el formulario (las páginas `src/app/**/page.jsx` son delgadas y solo componen componentes).
- **Campos**: etiqueta visible, tipo de control y si es obligatorio (`*`) u opcional. «Normaliza» = transformación al salir del campo (`transform`) que se repite al armar el payload.
- **Validación**: la del cliente es de conveniencia (`validar` de `useFormulario`); la regla real es la del servidor (RPC en PostgreSQL o Route Handler con zod). Los textos son los literales del código.
- **Llamada**: función de `@/lib/api/*` (envoltorio de una RPC `api_*`) o de `@/lib/http/*` (cliente de un Route Handler). Los componentes nunca llaman a Supabase directamente (regla de `CLAUDE.md`).
- **Pruebas**: archivos `*.test.*` de la misma carpeta (vitest + jsdom). «—» = sin prueba propia.

## Resumen del conteo

| Familia | Formularios / flujos | Detalle |
|---|---|---|
| Acceso | 4 | F-01 a F-04 |
| Alumnos | 7 | F-05 a F-11 |
| Catálogos y cuentas | 7 | F-12 a F-18 |
| Grupos | 9 | F-19 a F-27 |
| Alumno (portal) | 1 | F-28 |
| Docente (revisión y pase de lista) | 5 | F-29 a F-33 |
| Filtros | 3 | F-34 a F-36 |
| Consola técnica | 3 | F-37 a F-39 |
| Solo desarrollo local | 2 | F-40 y F-41 |
| **Total** | **41** | más 4 controles de entrada que no son formularios (sección «Otros controles») |

Por contenedor: **2 asistentes sobre `ui/Asistente`** (alta de alumno F-05 y alta de grupo F-19); **5 flujos guiados con guion propio** (Onboarding F-04 en 4 o 3 pasos con `ui/Stepper`, importación CSV F-24 en 4 pasos
con `Stepper` dentro de un `Modal`, «Mi registro facial» F-10 en 3 pasos con `Stepper`, registro facial guiado F-09 con 5 tomas y justificante guiado F-28 en 3 bloques numerados);
**5 altas de un paso en `ui/PanelLateral`** (aula F-12, materia F-13, docente F-14, cuenta de usuario F-15 y cámara F-25); el resto son formularios de página con `FormSection` + `FormActions`,
diálogos con campos (`Modal`, `ConfirmDialog` con `reason`) y barras de filtros.

Primitivas compartidas por todos: `ui/Field` (etiqueta, ayuda, error, válido, contador), `ui/Input`, `ui/Textarea`, `ui/Select`, `ui/Combobox`, `ui/SegmentedControl`, `ui/Switch`, `ui/Checkbox`,
`ui/CampoFecha`, `ui/RangoFechas`, `ui/CampoPassword`, `ui/TarjetaOpcion`, `ui/FileInput`, `ui/FormActions`, `ui/FormSection`, `ui/Stepper`, `ui/SuccessState`, `ui/Asistente`, `ui/PanelLateral`, `ui/Modal`,
`ui/ConfirmDialog`, `ui/BarraFiltros`, `ui/MenuAcciones`; hooks `hooks/ui/useFormulario.js`, `useCambiosSinGuardar.js`, `useCierreContenedor.js`, `useDialog.js`; límites y normalizadores en `lib/formularios/`
(`LIMITES`, `PATRONES`, `esCorreo`, `mayusculas`, `minusculas`, `recortar`, `soloAlfanumerico`, fechas). Detalle en `diseno.md`.

Validación en el servidor de los Route Handlers (zod, `web/src/lib/server/schemas.js`): `usuarioCrearCuerpo` (correo, rol, `id_docente`/`id_alumno` coherentes con el rol), `consentimientoCampos` (`id_alumno`, `fecha_firma`,
`vigencia_hasta` posterior a la firma), `aceptarAvisoCuerpo` (`version_aviso` 1 a 20 caracteres y `acepto` verdadero: «Marca la declaración para continuar.»), `justificanteCampos` (`id_sesion`, `id_alumno`),
`reconstruirCuerpo`, `revertirCuerpo` (sin uso en la interfaz), `fechaISO` («Usa el formato AAAA-MM-DD.», «Fecha inválida.»). El resto de las reglas de los formularios (catálogos, grupos, justificantes, parámetros) las aplican las RPC.

---

## A. Acceso (`web/src/components/auth/`)

### F-01 Inicio de sesión
- **Ruta**: `/login` (`src/app/(public)/login/page.jsx`, acepta `?next=` y `?error=`/`?msg=`).
- **Componente**: `auth/LoginForm/LoginForm.jsx` + `useLoginForm.js` + `login.utils.js` + `rutaSegura.js`.
- **Campos**: Correo institucional `*` (email, `maxLength` 120, normaliza con `trim`, ejemplo `nombre@unach.mx`); Contraseña `*` (`CampoPassword` sin lista de requisitos, «Mostrar», aviso de Bloq Mayús, enlace «¿Olvidaste tu contraseña?» en la etiqueta).
- **Validación (al salir del campo y al enviar)**: `Escribe tu correo institucional.`; `El correo no puede llevar espacios.`; `Al correo le falta la @. Ejemplo: nombre@unach.mx`; `El correo solo puede llevar una @.`; `Escribe tu usuario antes de la @. …`;
  `Escribe el dominio después de la @. …`; `Revisa el dominio después de la @. …`; `El correo es demasiado largo (máximo 120 caracteres).`; contraseña vacía: `Escribe tu contraseña.`
  Errores del servidor (un solo aviso, se conserva lo escrito y el foco va a la contraseña): `Correo o contraseña incorrectos.`, `Tu cuenta está inactiva. Contacta al administrador.`, `Tu cuenta no está vinculada a un perfil. …`, `Demasiados intentos. Espera unos minutos e inténtalo de nuevo.`, `No se pudo conectar. …`.
- **Pasos**: 1.
- **Llamada**: `iniciarSesion` de `@/lib/api/auth.js` (Supabase Auth `signInWithPassword` y luego la RPC `api_yo`); redirige con `rutaSegura(next)` o `me.home`.
- **Pruebas**: `LoginForm.test.jsx` (16 pruebas en el archivo).

### F-02 Recuperar contraseña
- **Ruta**: `/recuperar`. **Componente**: `auth/RecuperarForm/RecuperarForm.jsx` + `useEnfriamiento.js`.
- **Campos**: Correo institucional `*` (igual que F-01).
- **Validación**: `mensajeCorreo` con el vacío `Escribe el correo de tu cuenta.`; error del servidor: `No se pudo enviar la solicitud.` / `No se pudo reenviar el enlace.`
- **Pasos**: 1 más una pantalla de éxito «Revisa tu correo» con el texto neutro «Si … está registrado, te enviamos un enlace…» (no revela si la cuenta existe), «Reenviar enlace» con enfriamiento de 60 s, «Usar otro correo» y «Volver a iniciar sesión».
- **Llamada**: `recuperarContrasena` (`@/lib/api/auth.js`, `resetPasswordForEmail`; solo propaga `DEMASIADOS_INTENTOS` y `ERROR_RED`).
- **Pruebas**: `RecuperarForm.test.jsx`.

### F-03 Cambiar o crear contraseña
- **Ruta**: `/cambiar-contrasena` (destino del enlace de recuperación) y primer paso de `/activar-cuenta` (`modo="activar"`).
- **Componente**: `auth/CambiarContrasenaForm/CambiarContrasenaForm.jsx` + `contrasena.utils.js`.
- **Campos**: «Nueva contraseña» o «Crea tu contraseña» `*` (`CampoPassword`; sin campo de confirmación a propósito).
- **Validación**: requisitos en vivo con icono y texto («N de 3 requisitos»): `Al menos 10 caracteres`, `Contiene una letra`, `Contiene un número`; mensaje de campo `Escribe tu contraseña nueva.`, `Aún no cumple: al menos 10 caracteres.` / `Aún no cumple N requisitos de la lista.`;
  del servidor: `La contraseña no cumple los requisitos de seguridad.` (`CONTRASENA_DEBIL`), `La nueva contraseña debe ser distinta de la actual.` (`CONTRASENA_IGUAL`), pegados al campo.
- **Pasos**: 1 (verifica antes que exista la sesión del enlace: «Verificando enlace…»). **Llamada**: `cambiarContrasena` (`@/lib/api/auth.js`). **Pruebas**: `CambiarContrasenaForm.test.jsx`.

### F-04 Onboarding / activar cuenta (asistente por pasos)
- **Rutas**: `/activar-cuenta` (`modo="activar"`, 4 pasos: Contraseña, Perfil, Guía, Privacidad) y `/bienvenida` (`modo="bienvenida"`, 3 pasos; se abre desde el menú de cuenta).
- **Componente**: `auth/Onboarding/Onboarding.jsx` + `PasoEstilo.jsx`, `PasoGuia.jsx`, `PasoPrivacidad.jsx`, `guia.js`.
- **Campos**: paso 1 = F-03; paso 2 «Color del avatar» (8 opciones, radio); paso 3 solo lectura (guía por rol); paso 4 casilla `He leído el aviso de privacidad` (obligatoria solo en `activar`).
- **Validación**: el botón final se apaga y dice por qué junto a él: `Marca «He leído el aviso de privacidad» para terminar.` Tras guardar la contraseña no se vuelve a ese paso.
- **Llamada**: contraseña vía F-03; estilo y acuse se guardan por navegador (`guardarPerfil`, `lib/perfil.js`, sin datos sensibles).
- **Pruebas**: `Onboarding.test.jsx`.

---

## B. Alumnos (`web/src/components/admin/alumnos/` y `alumno/`)

### F-05 Alta de alumno (asistente de 3 pasos sobre `ui/Asistente`)
- **Ruta**: `/admin/alumnos/nuevo`. **Componente**: `NuevoAlumno/AltaAlumno.jsx` (+ `NuevoAlumno.jsx`, `nuevoAlumno.utils.js`, `useMatriculaExistente.js`) con campos de `AlumnoForm/CamposAlumno.jsx`.
- **Pasos**: 1 Identidad → 2 Contacto y acceso → 3 Revisión (con «Editar» por sección y resumen vivo a la derecha en pantallas anchas) → pantalla de éxito con siguientes pasos (registrar consentimiento, tomar plantilla facial, inscribirlo en un grupo, crear su cuenta).
- **Campos**: Matrícula `*` (`maxLength` 10, normaliza a mayúsculas y solo letras/dígitos, ejemplo `E260099`, «Válido» y «Matrícula disponible»); Nombres `*` (60); Apellido paterno `*` (40); Apellido materno opcional (40); Correo institucional `*` (120, minúsculas, «Válido»);
  «Crear su cuenta al terminar» (interruptor `Switch`, opcional, «Se creará» / «Más tarde»).
- **Validación** (`alumnoForm.utils.js`, `validarAlumno`): `La matrícula es obligatoria.`; `La matrícula admite hasta 10 caracteres.`; `Usa solo letras y dígitos, sin espacios ni guiones.`; `El apellido paterno es obligatorio.`; `El apellido paterno admite hasta 40 caracteres.`;
  `El apellido materno admite hasta 40 caracteres.`; `El nombre es obligatorio.`; `El nombre admite hasta 60 caracteres.`; `El correo institucional es obligatorio.`; `Escribe un correo válido, con la forma nombre@dominio.`; `Esta matrícula ya está registrada.` (consulta previa con retraso de 400 ms).
  Si el paso falla: resumen «Revisa este paso antes de continuar» y foco al primer campo inválido. Errores del servidor pegados al campo (`mapearErrorAlumno`): `DUPLICADO` → matrícula o correo; `VALIDACION` → el campo que nombra el mensaje.
- **Llamadas**: `alumnoGuardar` (`api_alumno_guardar`) y, si se pidió cuenta, `crearUsuario` (`POST /api/admin/usuarios`, zod `usuarioCrearCuerpo`); si la cuenta falla el alumno ya existe y el mensaje lo dice («El alumno se creó, pero su cuenta de acceso no»).
- **Pruebas**: `NuevoAlumno.test.jsx`, `nuevoAlumno.utils.test.js`, `alumnoForm.utils.test.js`.

### F-06 Datos del alumno (ficha)
- **Ruta**: `/admin/alumnos/[id]` (`DetalleAlumno`). **Componente**: `AlumnoForm/AlumnoForm.jsx` + `CamposAlumno.jsx` + `alumnoForm.utils.js`.
- **Campos**: los de F-05 en las secciones Identidad y Contacto y, además, la sección Estado: «Estatus del alumno» (`SegmentedControl`: Activo, Baja temporal, Baja definitiva, Egresado) con aviso `Al guardar, se darán de baja sus N inscripciones activas.` o `Reactivarlo no restituye sus inscripciones…`.
- **Validación**: la de F-05. «Guardar cambios» apagado con el motivo `Aún no hay cambios que guardar.`; «N cambios sin guardar»; aviso al recargar o cerrar (`useCambiosSinGuardar`).
- **Llamadas**: `alumnoGuardar` y `alumnoCambiarEstatus` (`api_alumno_cambiar_estatus`) desde `DetalleAlumno`. **Pruebas**: `AlumnoForm.test.jsx`, `alumnoForm.utils.test.js`.

### F-07 Registrar consentimiento firmado
- **Ruta**: ficha del alumno, ancla `#consentimiento`. **Componente**: `ConsentimientoPanel/FormularioConsentimiento.jsx` + `consentimiento.utils.js`, `useHoyNegocio.js` (usa `api_ahora`, el reloj del plantel).
- **Campos**: Fecha de firma `*` (`CampoFecha`, atajo «Hoy»); Vigente hasta `*` (`CampoFecha`, atajos «+1 año», «+2 años», vigencia sugerida de 1 año); Documento firmado `*` (`FileInput variant="zona"`, PDF, máximo 10 MB).
- **Validación**: `Indica la fecha de firma.`; `Escribe una fecha de firma válida.`; `La fecha de firma no puede ser futura.`; `Indica hasta cuándo es vigente.`; `Escribe una fecha de vigencia válida.`; `La vigencia debe ser posterior a la firma.`; `La vigencia ya terminó: elige una fecha desde hoy.`; `Adjunta el PDF firmado.`
- **Llamada**: `registrarConsentimiento` (`@/lib/http/biometria.js`, `POST /api/consentimientos` multipart; zod `consentimientoCampos`). Revocar: `revocarConsentimiento`.
- **Pruebas**: `ConsentimientoPanel.test.jsx`.

### F-08 Cuenta de acceso del alumno
- **Ruta**: ficha del alumno, `#cuenta`. **Componente**: `CuentaAccesoPanel/CuentaAccesoPanel.jsx` + `useCuentaAcceso.js`; muestra la contraseña temporal una sola vez en `catalogos/PasswordTemporalModal` (campo de solo lectura + «Copiar»).
- **Campos**: ninguno (botón «Crear cuenta de acceso» con el correo institucional del alumno). **Llamada**: `crearUsuario` (`POST /api/admin/usuarios`, rol `alumno`). **Pruebas**: `CuentaAccesoPanel.test.jsx`, `PasswordTemporalModal.test.jsx`.

### F-09 Plantilla facial del alumno (captura por el administrador)
- **Ruta**: ficha del alumno, `#plantilla`. **Componentes**: `PlantillaFacialPanel/PlantillaFacialPanel.jsx` + `usePlantillaFacial.js`; asistente a pantalla completa `RegistroFacialGuiado/` (portada, 5 tomas guiadas con aro de progreso: De frente, Gira a la izquierda, Gira a la derecha, Inclina hacia arriba, Otra expresión o luz;
  revisión; registro) o alternativa «Subir fotos» (`SubidaFotosPlantilla`, `FileInput` múltiple).
- **Campos**: cámara a elegir (`Select`, si hay varias), fotos. Requiere consentimiento vigente («Registre un consentimiento vigente para habilitar la captura.»).
- **Llamadas**: `verificarFotos` y `registrarPlantilla` (`@/lib/http/biometria.js`, `POST /api/plantilla/verificar` y `POST /api/plantilla`; el vector nunca sale del servicio de reconocimiento).
- **Pruebas**: `PlantillaFacialPanel.test.jsx`, `plantillaFacial.utils.test.js`, `usePlantillaFacial.api.test.jsx`, `RegistroFacialGuiado.test.jsx`, `registroGuiado.pose.test.js`, `registroGuiado.utils.test.js`, `SubidaFotosPlantilla.test.jsx`.

### F-10 Mi registro facial (autoservicio del alumno)
- **Ruta**: `/alumno/registro`. **Componentes**: `alumno/MiRegistro/MiRegistro.jsx` + `AvisoConsentimiento.jsx`, `PasoRostro.jsx`, `RegistroCompleto.jsx`, `TarjetaConsentimiento.jsx`, `useMiRegistro.js`, `miRegistro.api.js`; reutiliza `RegistroFacialGuiado` con `propio`.
- **Pasos**: 1 Aviso y consentimiento → 2 Tu rostro (5 tomas con la cámara del dispositivo; no admite subir fotos) → 3 Listo (con «Rehacer» y «Revocar consentimiento»); el servidor decide el paso (`api_mi_registro`).
- **Campos**: casilla de declaración `He leído el aviso de privacidad y autorizo, de manera libre y por mi cuenta, el tratamiento de mi rostro para registrar mi asistencia a clase.` (obligatoria).
- **Validación**: `Marca la declaración para continuar.`; límite diario de registros («Llegaste al límite de hoy»).
- **Llamadas**: `aceptarAviso` (`POST /api/yo/consentimiento`, zod `aceptarAvisoCuerpo`), `verificarMisFotos`/`registrarMiPlantilla` (`POST /api/yo/plantilla/verificar`, `POST /api/yo/plantilla`), `revocarMiConsentimiento`, RPC `miRegistro`.
- **Pruebas**: `MiRegistro.test.jsx`, `miRegistro.api.test.js`, `miRegistro.utils.test.js`; `AvisoRegistro.test.jsx` para el aviso del portal.

### F-11 Dar de baja al alumno (confirmación)
- **Ruta**: ficha del alumno (botón «Dar de baja»). **Componente**: `DetalleAlumno/DetalleAlumno.jsx` con `ConfirmDialog` («Se darán de baja sus N inscripciones activas…»; una sola confirmación venga del encabezado o del formulario).
- **Llamada**: `alumnoCambiarEstatus` (`baja_definitiva`). **Pruebas**: `DetalleAlumno.test.jsx`, `detalleAlumno.utils.test.js`.

---

## C. Catálogos y cuentas (`web/src/components/admin/catalogos/`)

Aula, materia, docente y cuenta de usuario comparten `PanelCatalogo/PanelCatalogo.jsx` + `useAltaCatalogo.js`: panel lateral (pantalla completa en teléfono), pie fijo con «Cambios sin guardar» / «Revisa los campos marcados.», botones «Cancelar», «Crear y agregar otra» y el principal, aviso de descarte
(«¿Descartar los cambios?»), pantalla de éxito con siguientes pasos. El botón de alta no se apaga por datos inválidos: el clic muestra los errores y enfoca el primero.

### F-12 Aula
- **Ruta**: `/admin/aulas` (botón «Nueva aula» o «Editar»). **Componente**: `AulaForm/AulaForm.jsx` + `aula.utils.js`.
- **Campos**: Clave `*` (10, mayúsculas, ejemplo `A-12`, «Válido»); Edificio `*` (40, ejemplo «Edificio A»); Capacidad `*` (`CampoNumerico` con «−» y «+», 1 a 1000, arranca en 30).
- **Validación**: `Escribe la clave del aula, por ejemplo A-12.`; `Usa hasta 10 letras, dígitos o guiones, por ejemplo A-12.`; `Escribe el edificio, por ejemplo Edificio A.`; `El edificio admite máximo 40 caracteres.`; `Escribe la capacidad: un número entero de 1 a 1000.`
  Servidor: `DUPLICADO` → clave; `AULA_CAPACIDAD_INSUFICIENTE` → capacidad.
- **Llamada**: `aulaGuardar` (`api_aula_guardar`). **Pruebas**: `AulaForm.test.jsx`, `campoNumerico.utils.test.js`.

### F-13 Materia
- **Ruta**: `/admin/materias`. **Componente**: `MateriaForm/MateriaForm.jsx` + `materia.utils.js`.
- **Campos**: Clave `*` (8, mayúsculas, solo letras y dígitos, ejemplo `ADM101`); Nombre `*` (80, contador desde 80 %); Créditos `*` (1 a 99); Horas por semana `*` (1 a 20).
- **Validación**: `Escribe la clave de la materia, por ejemplo ADM101.`; `Usa hasta 8 letras o dígitos, por ejemplo ADM101.`; `Escribe el nombre de la materia, por ejemplo Administración I.`; `El nombre admite máximo 80 caracteres.`;
  `Escribe los créditos: un número entero de 1 a 99 (no puede ser 0).`; `Las horas por semana deben ser un número entero de 1 a 20.`
- **Llamada**: `materiaGuardar` (`api_materia_guardar`). **Pruebas**: `MateriaForm.test.jsx`, `materia.utils.test.js`.

### F-14 Docente
- **Ruta**: `/admin/docentes`. **Componente**: `DocenteForm/DocenteForm.jsx` + `docente.utils.js`.
- **Campos**: Número de empleado `*` (10, mayúsculas, ejemplo `D001`); Correo institucional `*` (120, minúsculas); Apellido paterno `*`; Apellido materno opcional; Nombres `*`; en edición, Estatus (`SegmentedControl`: Activo, Licencia, Baja). El alta no lleva estatus (nace activo).
- **Validación**: `Escribe el número de empleado, por ejemplo D001.`; `Usa hasta 10 letras o dígitos, por ejemplo D001.`; `Escribe el correo institucional, por ejemplo ana.lopez@unach.mx.`; `Escribe un correo válido, por ejemplo ana.lopez@unach.mx.`; `Escribe el apellido paterno.`; `Escribe el nombre o los nombres.`
  La baja pide confirmar (con los grupos) antes de guardar; fallo parcial explicado («Los datos se guardaron, pero el estatus no cambió: …»).
- **Llamadas**: `docenteGuardar` (`api_docente_guardar`), `docenteCambiarEstatus` (`api_docente_cambiar_estatus`). **Pruebas**: `DocenteForm.test.jsx`, `docente.utils.test.js`.

### F-15 Nueva cuenta de usuario
- **Ruta**: `/admin/usuarios` («Nueva cuenta»; también desde el éxito de F-14). **Componente**: `CrearUsuarioDialog/CrearUsuarioDialog.jsx` + `VinculoSelect.jsx`, `rolesUsuario.js`, `usuario.utils.js`; `SelectorRol` (`TarjetaOpcion`).
- **Campos**: Rol `*` (tarjetas: Administrador, Docente, Alumno, Técnico, cada una con lo que puede hacer); Docente o Alumno vinculado `*` (`Combobox` remoto, solo docentes activos; aparece solo para esos roles); Correo de acceso `*` (se prellena con el institucional del vínculo; editable).
- **Validación**: `Elige el docente al que pertenece la cuenta.` / `Elige el alumno …`; `Escribe el correo con el que iniciará sesión.`; `Escribe un correo válido, por ejemplo ana.lopez@unach.mx.`; servidor: `DUPLICADO`, `CORREO_RESERVADO`, `ROL_VINCULO_INCOHERENTE`, `DOCENTE_NO_ACTIVO`, `ALUMNO_NO_ACTIVO` pegados al campo.
- **Llamada**: `crearUsuario` (`POST /api/admin/usuarios`; zod `usuarioCrearCuerpo`; devuelve `contrasena_temporal` una sola vez → `PasswordTemporalModal`). **Pruebas**: `CrearUsuarioDialog.test.jsx`, `usuario.utils.test.js`, `UsuariosPanel.test.jsx`.

### F-16 Cambiar rol de una cuenta
- **Ruta**: `/admin/usuarios`, menú «⋯» de la fila → «Cambiar rol». **Componente**: `UsuariosPanel/AccionesUsuario.jsx` (`Modal size="full-mobile"` con `dirty`) + `cambiarRol.utils.js`.
- **Campos**: Rol nuevo `*` (`SelectorRol`; el actual va rotulado «rol actual»). Guardar apagado hasta elegir otro rol; avisa qué pasa con el vínculo actual.
- **Llamada**: `usuarioActualizar` (`api_usuario_actualizar`). **Pruebas**: `AccionesUsuario.test.jsx`, `cambiarRol.utils.test.js`.

### F-17 Restablecer contraseña y activar o desactivar una cuenta
- **Ruta**: igual que F-16. **Componente**: `AccionesUsuario.jsx` (dos `ConfirmDialog` sin campos). Restablecer genera otra contraseña temporal que se muestra una vez.
- **Llamadas**: `restablecerUsuario` (`POST /api/admin/usuarios/{id}/restablecer`), `usuarioActualizar` (`activo`). **Pruebas**: `AccionesUsuario.test.jsx`.

### F-18 Filtros de la bitácora
- **Ruta**: `/admin/bitacora`. **Componente**: `BitacoraTabla/BitacoraTabla.jsx` + `bitacora.utils.js`.
- **Campos** (se aplican al cambiarlos): Acción (`Combobox`), Entidad (`Combobox`, lista cerrada de las tablas auditables), Usuario (`Combobox` remoto por correo o nombre), Periodo (`RangoFechas`: Desde, Hasta, atajos «Hoy», «7 días», «30 días»), «Limpiar filtros».
- **Validación**: `La fecha inicial debe ser anterior o igual a la final.` (el rango inválido no se aplica). **Llamada**: `bitacoraListar` (`api_bitacora_listar`). **Pruebas**: `BitacoraTabla.test.jsx`.

---

## D. Grupos (`web/src/components/admin/grupos/`)

### F-19 Alta de grupo (asistente de 3 pasos sobre `ui/Asistente`)
- **Ruta**: `/admin/grupos/nuevo` (acepta `?materia=<id>` y `?aula=<id>` para preseleccionar). **Componente**: `NuevoGrupo/AsistenteGrupo.jsx` (+ `NuevoGrupo.jsx`, `nuevoGrupo.utils.js`) con `GrupoForm/CamposGrupo.jsx`, `useCatalogosGrupo.js` y `HorarioSemanal`.
- **Pasos**: 1 Materia y docente → 2 Aula y horario → 3 Revisión (resumen vivo) → éxito con siguientes pasos (generar sesiones o armar el horario, inscribir alumnos, configurar la cámara del aula).
- **Campos**: Materia `*`, Docente `*`, Aula `*` (tres `Combobox` con búsqueda; opciones de dos líneas); Clave del grupo `*` (8, mayúsculas, ejemplo `3A`); Periodo `*` (formato `AAAA-S`, sugerido según el reloj del plantel, «Usar 2026-2»);
  Horario semanal opcional (franjas con días como chips, hora de inicio y fin, duración 1 h / 1 h 30 / 2 h / 3 h).
- **Validación** (`grupoForm.utils.js`): `Elige la materia.`; `Elige el docente.`; `Elige el aula.`; `Escribe la clave del grupo, por ejemplo 3A.`; `Usa hasta 8 letras, dígitos o guiones, por ejemplo 3A.`; `Escribe el periodo, por ejemplo 2026-2.`;
  `Usa el formato AAAA-S, donde S es 1 o 2 (por ejemplo 2026-2).`; `Revisa las franjas del horario: hay campos por corregir.` Servidor pegado al campo: `DUPLICADO` → clave, `PERIODO_INVALIDO`, `DOCENTE_NO_ACTIVO`, `HORARIO_CHOQUE` → aula.
- **Llamadas**: `grupoGuardar` (`api_grupo_guardar`) y, si hay franjas, `horarioGuardar` (`api_horario_guardar`). Fallo parcial: si el horario falla el grupo ya existe y el reintento lo actualiza por su `id_grupo` (no crea otro).
- **Pruebas**: `NuevoGrupo.test.jsx`, `nuevoGrupo.utils.test.js`, `grupoForm.utils.test.js`.

### F-20 Datos del grupo
- **Ruta**: `/admin/grupos/[id]` pestaña Datos (`?tab=`). **Componente**: `GrupoForm/GrupoForm.jsx` + `CamposGrupo.jsx` + `grupoForm.utils.js`.
- **Campos**: los de F-19 (sin horario) en secciones «Materia y docente», «Identificación del grupo», «Aula». Con inscripciones o sesiones la materia y el periodo se muestran deshabilitados con el motivo (`GRUPO_CON_HISTORIAL`).
- **Validación**: la de F-19; «N cambios sin guardar», «Descartar cambios», aviso al cambiar de pestaña con cambios (`Tabs confirmLeave`). **Llamada**: `grupoGuardar`. **Pruebas**: `GrupoForm.test.jsx`, `grupoForm.utils.test.js`.

### F-21 Horario del grupo
- **Ruta**: pestaña Horario. **Componente**: `HorarioEditor/HorarioEditor.jsx` + `HorarioSemanal/HorarioSemanal.jsx`, `VistaSemana.jsx`, `horarioSemanal.utils.js`.
- **Campos**: por franja, días (`Pills multiple`: Lunes a Sábado), Hora de inicio, Hora de fin, Duración; «Agregar otra franja», «Duplicar», «Quitar»; vista semanal y total de horas contra las de la materia.
- **Validación**: `Elige al menos un día.`; `Indica la hora de inicio.`; `Indica la hora de fin.`; `La hora de fin debe ser posterior a la de inicio.`; `Se traslapa el <día> con otra franja (…).`; `Un grupo admite como máximo 42 bloques semanales (hoy son N).`; `Agrega al menos una franja de horario.` (fuera del alta).
- **Llamada**: `horarioGuardar` (`api_horario_guardar`, un bloque por día). **Pruebas**: `HorarioEditor.test.jsx`, `HorarioSemanal.test.jsx`, `horarioSemanal.utils.test.js`.

### F-22 Generar sesiones
- **Ruta**: pestaña Horario. **Componente**: `GenerarSesiones/GenerarSesiones.jsx` + `generarSesiones.utils.js`.
- **Campos**: Rango de fechas `*` (`RangoFechas`: Desde, Hasta, atajos 2 / 4 / 8 / 16 semanas); Fecha a omitir opcional (`CampoFecha` + «Agregar fecha», chips). Vista previa: «Se crearán hasta N sesiones»; el botón dice «Generar N sesiones».
- **Validación**: `Indica la fecha inicial.`; `Indica la fecha final.`; `La fecha final no puede ser anterior a la inicial.`; `El rango no puede pasar de 366 días.`; `Fechas no válidas (usa AAAA-MM-DD): …`.
- **Llamada**: `generarSesiones` (`api_generar_sesiones`). **Pruebas**: `GenerarSesiones.test.jsx`.

### F-23 Inscribir alumnos
- **Ruta**: pestaña Inscripciones. **Componente**: `InscribirAlumno/InscribirAlumno.jsx` + `inscribirAlumno.utils.js`.
- **Campos**: Buscar alumno (`Combobox` remoto por matrícula o nombre, solo activos, aviso de consentimiento/plantilla); lista de elegidos con «Quitar»; botón «Inscribir N alumnos»; aviso de cupo del aula.
- **Validación**: motivo del botón `Elige al menos un alumno para inscribir.`; fallos parciales por alumno (se quedan en la lista con su error).
- **Llamadas**: `alumnosListar` (`api_alumnos_listar`) e `inscribir` (`api_inscribir`). **Pruebas**: `InscribirAlumno.test.jsx`.

### F-24 Importar inscripciones desde CSV (modal de 4 pasos)
- **Ruta**: pestaña Inscripciones, «Importar desde CSV». **Componente**: `ImportarCsv/ImportarCsv.jsx` + `PasoArchivo.jsx`, `PasoRevision.jsx`, `PasoConfirmar.jsx`, `PasoResultado.jsx`, `importarCsv.utils.js` (`Modal` + `ui/Stepper`).
- **Pasos**: Archivo → Revisión (4 contadores, errores agrupados por causa, vista previa) → Confirmar → Resultado (cifras del servidor y descarga de las filas fallidas).
- **Campos**: Archivo CSV `*` (`FileInput variant="zona"`, hasta 1 MB y 500 filas, columnas `matricula`, `apellido_paterno`, `apellido_materno`, `nombres`, `correo`; plantilla descargable).
- **Validación local por fila**: `Falta la matrícula.`; `El correo no es válido.`; `Falta la columna "matricula" en la primera fila.`; `El archivo está vacío.`; filas con solo matrícula se avisan («Sirven si el alumno ya existe en SUSAN…»).
- **Llamada**: `importarInscripciones` (`api_importar_inscripciones`). **Pruebas**: `ImportarCsv.test.jsx`, `importarCsv.test.js`.

### F-25 Cámara del aula
- **Ruta**: pestaña «Aula y cámaras» (botones «Agregar cámara de frente / de fondo» o editar). **Componente**: `CamaraPanel/CamaraPanel.jsx` (`PanelLateral`) + `CamaraForm/CamaraForm.jsx`, `CamposCamara.jsx`, `useCamaraForm.js`, `camaraForm.utils.js`.
- **Campos**: Tipo de cámara (`SegmentedControl`: Cámara IP / Webcam del navegador); Dirección IP `*` solo para tipo IP (ejemplo `10.20.12.2`); Estatus (Activa / Inactiva / En mantenimiento); «Probar conexión» (con resultado y hora que persisten).
- **Validación**: `Escribe la dirección IP de la cámara, por ejemplo 10.20.12.2.`; `La dirección IP no es válida. Usa el formato 10.20.12.2.`; servidor: `CAMARA_IP_REQUERIDA`, `DUPLICADO` pegados a la IP; «Probar» se apaga con cambios sin guardar y dice por qué.
- **Llamadas**: `camaraGuardar` (`api_camara_guardar`) y `probarCamara` (`POST /api/admin/camaras/{id}/probar`). **Pruebas**: `CamaraForm.test.jsx`.

### F-26 Capacidad del aula
- **Ruta**: pestaña «Aula y cámaras». **Componente**: `CapacidadForm/CapacidadForm.jsx` + `capacidadForm.utils.js`.
- **Campos**: Capacidad del aula `*` (botones «Quitar un lugar» / «Agregar un lugar»; barra de inscritos del grupo contra la capacidad).
- **Validación**: `La capacidad debe ser un número entero mayor que 0.`; `La capacidad máxima es N.`; `Este grupo ya tiene N inscritos activos: la capacidad no puede ser menor.`
- **Llamada**: `aulaGuardar`. **Pruebas**: `CapacidadForm.test.jsx`.

### F-27 Dar de baja una inscripción (confirmación)
- **Ruta**: pestaña Inscripciones. **Componente**: `InscripcionesTabla/InscripcionesTabla.jsx` con `ConfirmDialog` que explica las consecuencias. **Llamada**: `bajaInscripcion` (`api_baja_inscripcion`). **Pruebas**: `InscripcionesTabla.test.jsx`.

---

## E. Alumno (portal)

### F-28 Registrar justificante (guiado en 3 bloques)
- **Ruta**: `/alumno` (sección Justificantes; acepta `?justificar=<id_sesion>`). **Componente**: `alumno/RegistrarJustificanteForm/RegistrarJustificanteForm.jsx` + `ElegirFalta.jsx`, `EtiquetaPaso.jsx`, `useRegistrarJustificante.js`, `registrarJustificante.utils.js`.
- **Campos**: 1 Falta o retardo a justificar `*` (hasta 4 faltas = `TarjetaOpcion` con estado en texto; más = `Combobox`); 2 Motivo `*` (`Textarea` con autoajuste, 200 caracteres, contador, ideas «Cita médica», «Enfermedad», «Trámite oficial», «Asunto familiar»);
  3 Documento `*` (`FileInput variant="zona"` con miniatura; PDF, JPG o PNG hasta 5 MB; en pantallas táctiles botón «Tomar foto»).
- **Validación**: `Elige la falta o el retardo que quieres justificar.`; `Escribe el motivo.`; `El motivo admite hasta 200 caracteres.`; `Adjunta el documento (PDF, JPG o PNG).`; barra «Faltan el motivo y el documento.» / «Todo listo para enviar.»; el botón nunca se apaga, el clic muestra los errores y enfoca el primero;
  servidor: `Ya tienes un justificante pendiente para esta sesión.` (`JUSTIFICANTE_DUPLICADO`).
- **Pasos**: 3 bloques numerados que pasan a palomita; éxito dentro de la tarjeta («Justificante enviado», estado Pendiente, siguientes pasos «Justificar otra falta» y «Ver mis justificantes»).
- **Llamadas**: `subirDocumentoJustificante` (`@/lib/http/revision.js`, `POST /api/justificantes/documento`, zod `justificanteCampos`, máximo 5 MiB, tipos pdf/jpg/png) y `registrarJustificante` (`api_registrar_justificante`). Si el segundo paso falla se conserva el documento ya subido para reintentar.
- **Pruebas**: `RegistrarJustificanteForm.test.jsx`.

---

## F. Docente (`web/src/components/revision/` y `sesion/`)

### F-29 Resolver un justificante (aprobar o rechazar)
- **Ruta**: `/docente/revision?pestana=justificantes`. **Componente**: `revision/JustificanteCard/JustificanteCard.jsx` con un único `ConfirmDialog` y campo de motivo (`reason`).
- **Campos**: Comentario opcional al aprobar (`Comentario (opcional)`); «Motivo del rechazo» obligatorio al rechazar (200 caracteres, contador).
- **Validación**: `Escribe el motivo para continuar.` (borde rojo, `aria-invalid`, foco en el campo). **Llamada**: `resolverJustificante` (`api_resolver_justificante`); «Ver documento» usa `obtenerDocumentoJustificante`. **Pruebas**: `JustificanteCard.test.jsx`.

### F-30 Resolver un caso pendiente
- **Ruta**: `/docente/revision` pestaña Pendientes. **Componente**: `revision/ResolverComo/ResolverComo.jsx` (dentro de `CasoPendiente`).
- **Campos**: Comentario opcional (200 caracteres, contador); botones «Presente», «Retardo», «Ausente» con el sugerido marcado. **Llamada**: `corregirAsistencia` (`api_corregir_asistencia`). **Pruebas**: `ResolverComo.test.jsx`.

### F-31 Registrar manualmente a un alumno
- **Ruta**: `/docente/sesiones/[id]` (botón «Registrar manualmente»). **Componente**: `sesion/RegistroManualDialog/RegistroManualDialog.jsx` (`Modal`).
- **Campos**: Alumno `*` (`Combobox` con avatar y motivo por el que puede registrarse a mano); Estado `*` (`SegmentedControl` Presente / Retardo / Ausente con «Sugerido según la hora: …»); botones «Guardar» y «Guardar y registrar otro».
- **Validación**: `Elige al alumno que quieres registrar.`; error del servidor dentro del diálogo, sin perder lo elegido. **Llamada**: `registrarManual` (`api_registrar_manual`). **Pruebas**: `RegistroManualDialog.test.jsx`.

### F-32 Pase de lista manual
- **Ruta**: `/docente/sesiones/[id]` en una sesión sin cámaras activas. **Componente**: `sesion/PaseListaManual/PaseListaManual.jsx` + `paseListaManual.utils.js`.
- **Campos**: por alumno, tres botones de alternancia (`aria-pressed`) Presente / Retardo / Ausente; «Marcar restantes según la hora»; guardar y cerrar. Avisa al recargar o salir con marcas sin guardar.
- **Llamadas**: `paseListaManual` (`api_pase_lista_manual`) y `cerrarSesion` (`api_cerrar_sesion`). **Pruebas**: `PaseListaManual.test.jsx`, `paseListaManual.utils.test.js`.

### F-33 Cerrar la sesión de clase (confirmación)
- **Ruta**: `/docente/sesiones/[id]`. **Componente**: `sesion/CierreSesionDialog/CierreSesionDialog.jsx` (resumen de lo que se cierra: Presentes, Retardos, Ausentes marcados, Sin registro, Pendientes). **Llamada**: `cerrarSesion`. **Pruebas**: `CierreSesionDialog.test.jsx`.

---

## G. Filtros

### F-34 Barra de búsqueda y filtros de listados
- **Rutas**: `/admin/alumnos`, `/admin/grupos`, `/admin/aulas`, `/admin/materias`, `/admin/docentes`, `/admin/usuarios`. **Componentes**: `ui/BarraFiltros` usado por `ListadoAlumnos`, `GruposTabla` y `CatalogoTabla` (esta última sirve a aulas, materias, docentes y usuarios).
- **Campos**: búsqueda con retraso de 300 ms (matrícula, nombre, correo, clave…), filtros de estatus, periodo o rol, chips de filtros activos con «Quitar filtro …», «Limpiar» y conteo de resultados. **Llamadas**: `alumnosListar`, `gruposListar`, `aulasListar`, `materiasListar`, `docentesListar`, `usuariosListar`. **Pruebas**: `BarraFiltros.test.jsx`, `CatalogoTabla.test.jsx`, `ListadoDocentes.test.jsx`.

### F-35 Filtros del reporte de asistencia
- **Ruta**: `/reportes`. **Componente**: `reportes/FiltrosReporte/FiltrosReporte.jsx`. **Campos**: Periodo (`Select`), Grupo (`Combobox`), Alumno (`Combobox`, deshabilitado hasta elegir grupo). **Pruebas**: `FiltrosReporte.test.jsx`.

### F-36 Selección de grupo a analizar
- **Ruta**: `/analitica`. **Componente**: `analitica/SelectorGrupo/SelectorGrupo.jsx`. **Campos**: Periodo (`Select`), Grupo (`Combobox`; opción con materia y clave, docente e inscritos). **Pruebas**: `SelectorGrupo.test.jsx`.

---

## H. Consola técnica (`web/src/components/tecnico/`, ruta `/tecnico`, solo lectura para el administrador)

### F-37 Estatus de las cámaras
- **Componente**: `CamarasEstado/CamarasEstado.jsx` + `camaras.utils.js`. **Campos**: por cámara, Estatus (`SegmentedControl`: Activa / Inactiva / Mantenimiento); `ConfirmDialog` con el nombre de la cámara y la consecuencia (advierte si hay una sesión abierta en el aula).
- **Llamada**: `camaraCambiarEstatus` (`api_camara_cambiar_estatus`). **Pruebas**: `CamarasEstado.test.jsx`, `camaras.utils.test.js`.

### F-38 Parámetros del sistema
- **Componente**: `ParametrosEditor/ParametrosEditor.jsx` + `ParametroFila/ParametroFila.jsx`, `parametros.utils.js`. **Campos**: un valor por parámetro (12, en 4 secciones; 4 «críticos»), con unidad, rango válido, valor de fábrica, «Usar valor de fábrica», «Descartar», deslizador para el umbral de similitud.
- **Validación**: `El valor no puede estar en blanco.`; `Debe ser un número entero.` / `Debe ser un número.`; `Usa hasta 3 decimales.`; `Fuera de rango: de 0.500 a 0.999.` (rango de cada parámetro); coherencia entre parámetros (`Debe ser menor que la tolerancia de retardo (N min).`,
  `Debe ser mayor que el límite para marcar presente (N min).`). Cada cambio pide confirmación y queda en bitácora con el valor anterior.
- **Llamadas**: `parametrosListar`, `parametroActualizar` (`api_parametros_listar`, `api_parametro_actualizar`). **Pruebas**: `ParametrosEditor.test.jsx`, `parametros.utils.test.js`.

### F-39 Índice facial
- **Componente**: `IndiceFacialPanel/IndiceFacialPanel.jsx` + `useIndiceFacial.js`, `indiceFacial.utils.js`. **Campos**: casilla «Reconstrucción completa (reprocesa todas las fotos; tarda más)» dentro del diálogo «Reconstruir índice facial» (sugerida si la dimensión no coincide); «Sincronizar servicio».
- **Llamadas**: `reconstruirIndice` (`POST /api/indice/reconstruir`, zod `reconstruirCuerpo`), `sincronizarIndice` (`POST /api/indice/sincronizar`) y `obtenerEstadoIndice` (`GET /api/indice`). `revertirIndice` existe en `@/lib/http/biometria.js` (zod `revertirCuerpo`) pero ningún componente lo usa hoy. **Pruebas**: `IndiceFacialPanel.test.jsx`, `indiceFacial.utils.test.js`.

---

## I. Solo desarrollo local

- **F-40 Reloj de demostración**: `layout/RelojDemo/RelojDemo.jsx` + `relojDemo.utils.js`; botones «+5 min», «+10 min», «+30 min», «Correr / Pausar», «Restablecer», «Fijar hora» (campo de fecha y hora). Solo existe con `SUSAN_LOCAL=1`; llama a `/api/_local/reloj` (`lib/local/relojCliente.js`). Pruebas: `RelojDemo.test.jsx`, `relojDemo.utils.test.js`.
- **F-41 Cámara simulada**: `sesion/SimuladorCamara/SimuladorCamara.jsx` y `sesion/CapturaContinua/` (selectores de escenario, casillas «Que pase un visitante de vez en cuando» y «Empezar en el minuto N de la clase»). Solo con reloj simulado y embedder `fake`. Pruebas en sus carpetas.

## Otros controles de entrada que no son formularios

`layout/PaletaComandos` (caja de búsqueda ⌘K, combobox ARIA sobre páginas y acciones), `analitica/GraficaSerie` (casillas SMA/EMA/WMA y selector de serie), `alumno/PortalAlumno` (selector «Periodo» del calendario), `auth/PasswordInput` y `auth/ReglasContrasena` (sin uso: los sustituye `ui/CampoPassword`, se conservan con sus pruebas).

---

## Cómo se verificó la completitud

Comandos corridos en `susan-main/web/src` (excluyendo `*.test.*`):

1. `grep -rlE '<form\b' --include=*.jsx .` → **20 archivos**: `AlumnoForm`, `FormularioConsentimiento`, `AccionesUsuario`, `PanelCatalogo`, `HorarioEditor`, `GenerarSesiones`, `CamaraPanel`, `CamaraForm`, `CapacidadForm`, `GrupoForm`, `RegistrarJustificanteForm`,
   `RecuperarForm`, `CambiarContrasenaForm`, `LoginForm`, `FiltrosReporte`, `RelojDemo`, `SelectorGrupo`, `RegistroManualDialog` y las primitivas `Asistente` y `BarraFiltros`. Todos tienen su ficha arriba (las dos primitivas son el contenedor de F-05/F-19 y F-34).
2. `grep -rlE '<(Input|Textarea|Select|Combobox|SegmentedControl|CampoFecha|CampoPassword|FileInput|Checkbox|Switch|TarjetaOpcion|RangoFechas|CampoNumerico)\b|<input|<textarea|<select' --include=*.jsx .` fuera de `components/ui/` → **46 archivos**; cada uno se asignó a una ficha:
   campos de F-05/F-06 (`CamposAlumno`, `AltaAlumno`, `AlumnoForm`), F-07, F-08 (`PasswordTemporalModal`), F-09 (`SubidaFotosPlantilla`, `PanelPose`, `PantallaCaptura`), F-10 (`AvisoConsentimiento`), F-12 a F-15 (`AulaForm`, `MateriaForm`, `DocenteForm`, `CampoNumerico`, `CrearUsuarioDialog`, `VinculoSelect`, `SelectorRol`), F-18,
   F-19 a F-26 (`CamposGrupo`, `GrupoForm`, `HorarioSemanal`, `GenerarSesiones`, `InscribirAlumno`, `PasoArchivo`, `CamposCamara`, `CapacidadForm`), F-28 (`ElegirFalta`, `RegistrarJustificanteForm`), F-01 a F-04 (`LoginForm`, `RecuperarForm`, `CambiarContrasenaForm`, `PasoEstilo`, `PasoPrivacidad`), F-30, F-31, F-35, F-36, F-37 a F-39,
   F-40, F-41 y la sección «Otros controles» (`PaletaComandos`, `GraficaSerie`, `PortalAlumno`, `PasswordInput`).
3. `grep -rl useFormulario` fuera de `hooks/ui` → 21 archivos (incluidas las primitivas `Combobox`, `SegmentedControl`, `Asistente` y `FormActions` que lo mencionan en su contrato); los formularios que no lo usan (justificante, filtros, pase manual, consola técnica) manejan su estado a mano.
4. `grep -rl "ui/Asistente"` → solo `AltaAlumno.jsx` y `AsistenteGrupo.jsx`; `grep -rl "ui/PanelLateral"` → `PanelCatalogo.jsx` y `CamaraPanel.jsx`; `grep -rln "reason="` → `JustificanteCard.jsx` (único `ConfirmDialog` con campo de texto).
5. Se recorrieron las 29 `page.jsx` de `src/app` para asociar cada ruta con su componente. Rutas con formulario: `/login`, `/recuperar`, `/cambiar-contrasena`, `/activar-cuenta`, `/bienvenida`, `/admin/alumnos` y `/nuevo` y `/[id]`, `/admin/aulas`, `/admin/materias`, `/admin/docentes`, `/admin/usuarios`, `/admin/bitacora`, `/admin/grupos` y `/nuevo` y `/[id]`,
   `/alumno`, `/alumno/registro`, `/docente/revision`, `/docente/sesiones/[id]`, `/reportes`, `/analitica`, `/tecnico`. Sin formulario: `/`, `/admin`, `/docente`, `/docente/pasar-lista` (lista sesiones y abre la sesión), `/modulos` y `/modulos/[id]`.

Límites de esta verificación: la búsqueda es textual (un formulario construido sin ninguno de esos componentes ni `<form>` no aparecería); `docs/spec/Avance1.txt` lista 9 pantallas P-01 a P-09, que aquí se cubren con las rutas de arriba pero no se cotejaron una por una contra la especificación.
