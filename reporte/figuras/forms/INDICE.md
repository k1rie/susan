# Índice de capturas de formularios (114 imágenes)

Capturas reales de la aplicación en ejecución (Next 16.3.8 dev, `SUSAN_LOCAL=1`, reloj de demostración fijo en 2026-09-14 07:12 -06), tomadas con Playwright y Chromium por `form/capturar-forms.mjs`. Escritorio 1440x900 con factor de escala 2 (PNG de 2880x1800; las marcadas «recorte» fotografían solo la tarjeta del formulario cuando es más alta que la ventana) y móvil 390x844 a 3x. Con «reducir movimiento» activado para que las animaciones no dejen estados a medias. Solo se ocultaron con CSS las insignias de desarrollo (indicador de Next y la tarjeta «Reloj de demostración»). Los datos creados llevan el prefijo «ZZ» (ver `form/resumen.md`).

## Selección sugerida para el reporte (48)

| Archivo | Formulario | Estado | Ruta | Vista |
|---|---|---|---|---|
| f01-login-vacio.png | Inicio de sesión (LoginForm) | Vacío | `/login` | 1440x900 @2x |
| f03-login-errores-envio.png | Inicio de sesión (LoginForm) | Envío incompleto: errores en ambos campos y foco en el primero | `/login` | 1440x900 @2x |
| f04-login-credenciales-incorrectas.png | Inicio de sesión (LoginForm) | Error del servidor: credenciales incorrectas (se conserva lo escrito) | `/login` | 1440x900 @2x |
| f08-recuperar-exito.png | Recuperar contraseña (RecuperarForm) | Éxito: «Revisa tu correo» con mensaje neutro, «Reenviar enlace» con cuenta atrás de 60 s y «Usar otro correo» | `/recuperar` | 1440x900 @2x |
| f12-alumno-alta-1-identidad-vacio.png | Alta de alumno (asistente de 3 pasos, AltaAlumno) | Paso 1 Identidad, vacío | `/admin/alumnos/nuevo` | 1440x900 @2x |
| f13-alumno-alta-1-identidad-errores.png | Alta de alumno (asistente de 3 pasos, AltaAlumno) | Paso 1 Identidad, «Siguiente» con campos vacíos (errores y resumen «Revisa este paso») | `/admin/alumnos/nuevo` | 1440x900 @2x |
| f14-alumno-alta-1-matricula-duplicada.png | Alta de alumno (asistente de 3 pasos, AltaAlumno) | Paso 1 Identidad, matrícula repetida detectada antes de crear (con enlace a la ficha del alumno existente) | `/admin/alumnos/nuevo` | 1440x900 @2x |
| f15-alumno-alta-1-identidad-valido.png | Alta de alumno (asistente de 3 pasos, AltaAlumno) | Paso 1 Identidad, lleno y válido (matrícula normalizada a mayúsculas, «Matrícula disponible») | `/admin/alumnos/nuevo` | 1440x900 @2x |
| f18-alumno-alta-2-contacto-valido.png | Alta de alumno (asistente de 3 pasos, AltaAlumno) | Paso 2 Contacto y acceso, correo válido (normalizado a minúsculas) y «Crear su cuenta al terminar» activado | `/admin/alumnos/nuevo` | 1440x900 @2x |
| f19-alumno-alta-3-revision.png | Alta de alumno (asistente de 3 pasos, AltaAlumno) | Paso 3 Revisión con «Editar» por sección (la cuenta de acceso queda para después) | `/admin/alumnos/nuevo` | 1440x900 @2x |
| f20-alumno-alta-4-exito.png | Alta de alumno (asistente de 3 pasos, AltaAlumno) | Éxito: «Alumno creado» con siguientes pasos (consentimiento, plantilla facial, grupo, cuenta) | `/admin/alumnos/nuevo` | 1440x900 @2x |
| f22-ficha-datos-errores.png | Datos del alumno (AlumnoForm en la ficha) | Edición con errores (apellido vacío y correo incompleto) y «2 cambios sin guardar»; no se guarda (recorte de la tarjeta) | `/admin/alumnos/77` | 1440x900 @2x, recorte de la tarjeta |
| f26-consentimiento-valido.png | Consentimiento informado (FormularioConsentimiento en la ficha) | Firma con «Hoy» (reloj del plantel), vigencia sugerida de 1 año y PDF cargado; no se envía (recorte del formulario) | `/admin/alumnos/77` | 1440x900 @2x, recorte de la tarjeta |
| f29-aula-errores.png | Alta de aula (AulaForm en PanelLateral) | Envío vacío: errores junto a cada campo, foco en el primero y motivo en el pie («Revisa los campos marcados») | `/admin/aulas` | 1440x900 @2x |
| f30-aula-valido.png | Alta de aula (AulaForm en PanelLateral) | Lleno y válido (valores normalizados al salir del campo, «Válido» donde aplica) | `/admin/aulas` | 1440x900 @2x |
| f31-aula-exito.png | Alta de aula (AulaForm en PanelLateral) | Éxito: «Aula ZZ-P1 creada» con siguiente paso y salidas | `/admin/aulas` | 1440x900 @2x |
| f34-materia-valido.png | Alta de materia (MateriaForm en PanelLateral) | Lleno y válido (valores normalizados al salir del campo, «Válido» donde aplica) | `/admin/materias` | 1440x900 @2x |
| f37-docente-errores.png | Alta de docente (DocenteForm en PanelLateral) | Envío vacío: errores junto a cada campo, foco en el primero y motivo en el pie («Revisa los campos marcados») | `/admin/docentes` | 1440x900 @2x |
| f42-usuario-valido.png | Nueva cuenta de usuario (CrearUsuarioDialog en PanelLateral) | Docente elegido con búsqueda remota; el correo se prellena con el institucional del vínculo (editable); no se envía | `/admin/usuarios` | 1440x900 @2x |
| f44-usuario-cambiar-rol-elegido.png | Cambiar rol de una cuenta (AccionesUsuario, Modal full-mobile) | Rol nuevo elegido (Técnico): se habilita guardar y se avisa qué pasa con el vínculo actual; no se envía | `/admin/usuarios` | 1440x900 @2x |
| f46-grupo-alta-1-datos-errores.png | Alta de grupo (asistente de 3 pasos, AsistenteGrupo) | Paso 1, «Siguiente» con campos vacíos (errores y resumen «Revisa este paso») | `/admin/grupos/nuevo` | 1440x900 @2x |
| f47-grupo-alta-1-datos-valido.png | Alta de grupo (asistente de 3 pasos, AsistenteGrupo) | Paso 1, lleno y válido (selectores con búsqueda, clave en mayúsculas, resumen vivo a la derecha) | `/admin/grupos/nuevo` | 1440x900 @2x |
| f50-grupo-alta-2-aula-franja.png | Alta de grupo (asistente de 3 pasos, AsistenteGrupo) | Paso 2, aula elegida y franja Lun-Mié-Vie 07:00-08:00 (duración, comparación con las horas de la materia y vista semanal) | `/admin/grupos/nuevo` | 1440x900 @2x |
| f51-grupo-alta-3-revision.png | Alta de grupo (asistente de 3 pasos, AsistenteGrupo) | Paso 3 Revisión con «Editar» por sección (materia/docente, aula y horario) | `/admin/grupos/nuevo` | 1440x900 @2x |
| f52-grupo-alta-4-exito.png | Alta de grupo (asistente de 3 pasos, AsistenteGrupo) | Éxito: «Grupo ZZ1 creado» con siguientes pasos (generar sesiones, inscribir alumnos, cámara del aula) | `/admin/grupos/nuevo` | 1440x900 @2x |
| f57-grupo-generar-sesiones.png | Generar sesiones (GenerarSesiones, pestaña Horario) | Rango de fechas con atajos, fecha a omitir agregada y vista previa («Generar N sesiones»); no se envía | `/admin/grupos/4?tab=horario` | 1440x900 @2x |
| f68-importar-csv-2-revision.png | Importar inscripciones desde CSV (ImportarCsv, modal de 4 pasos) | Paso 2 Revisión: contadores, errores agrupados por causa y vista previa (el servidor aún no recibe nada) | `/admin/grupos/4?tab=inscripciones` | 1440x900 @2x |
| f65-inscribir-lista.png | Inscribir alumnos (InscribirAlumno, pestaña Inscripciones) | Dos alumnos elegidos en la lista y botón «Inscribir 2 alumnos» (no se envía) | `/admin/grupos/4?tab=inscripciones` | 1440x900 @2x |
| f60-camara-errores.png | Alta de cámara (CamaraForm en PanelLateral) | Envío sin dirección IP: error junto al campo | `/admin/grupos/4?tab=aula` | 1440x900 @2x |
| f70-justificante-vacio.png | Registrar justificante (RegistrarJustificanteForm, alumno) | Vacío: 3 bloques numerados (falta, motivo, documento) y la barra dice qué falta; con 2 faltas se ven como tarjetas | `/alumno` | 1440x900 @2x, recorte de la tarjeta |
| f71-justificante-errores.png | Registrar justificante (RegistrarJustificanteForm, alumno) | Envío incompleto: errores en los tres bloques y el foco en el primero (el botón no se apaga) | `/alumno` | 1440x900 @2x, recorte de la tarjeta |
| f72-justificante-valido.png | Registrar justificante (RegistrarJustificanteForm, alumno) | Lleno y válido: falta elegida, motivo con contador y miniatura del documento; la barra dice «Todo listo para enviar» | `/alumno` | 1440x900 @2x, recorte de la tarjeta |
| f73-justificante-exito.png | Registrar justificante (RegistrarJustificanteForm, alumno) | Éxito dentro de la tarjeta: «Justificante enviado» (Pendiente) con siguientes pasos | `/alumno` | 1440x900 @2x, recorte de la tarjeta |
| f79-activar-1-contrasena-parcial.png | Activar cuenta (Onboarding, asistente de 4 pasos) | Paso 1, contraseña parcial: requisitos en vivo («1 de 3») | `/activar-cuenta` | 1440x900 @2x |
| f83-activar-4-privacidad.png | Activar cuenta (Onboarding, asistente de 4 pasos) | Paso 4 Privacidad: el botón final está apagado y el motivo se escribe junto a él | `/activar-cuenta` | 1440x900 @2x |
| f86-registro-facial-1-aviso-error.png | Mi registro facial (MiRegistro: aviso de consentimiento y asistente de rostro) | Aceptar sin marcar la declaración: error junto a la casilla | `/alumno/registro` | 1440x900 @2x |
| f89-registro-facial-3-asistente-intro.png | Mi registro facial (MiRegistro: aviso de consentimiento y asistente de rostro) | Asistente de cámara: portada con consejos y «Comenzar» | `/alumno/registro` | 1440x900 @2x |
| f90-registro-facial-3-captura.png | Mi registro facial (MiRegistro: aviso de consentimiento y asistente de rostro) | Toma guiada con la cámara (cámara falsa de Chromium: sin rostro, la toma no se completa) | `/alumno/registro` | 1440x900 @2x |
| f93-revision-rechazar-error.png | Resolver justificante (JustificanteCard + ConfirmDialog con motivo) | Confirmar sin comentario: «Escribe el motivo para continuar.» con borde rojo y foco en el campo (no se rechaza) | `/docente/revision?pestana=justificantes` | 1440x900 @2x |
| f98-registro-manual-valido.png | Registrar manualmente (RegistroManualDialog) | Alumno elegido y estado Presente sugerido; listo para registrar (no se envía) | `/docente/sesiones/19?pasar-lista=1` | 1440x900 @2x |
| f102-tecnico-parametro-error.png | Consola técnica: parámetros del sistema (ParametrosEditor / ParametroFila) | Valor fuera de rango (1.5 en un parámetro de 0.500 a 0.999): error en línea y «Sin guardar»; no se envía | `/tecnico` | 1440x900 @2x |
| f103-tecnico-parametro-confirmar.png | Consola técnica: parámetros del sistema (ParametrosEditor / ParametroFila) | Cambio válido (0.850 a 0.900): confirmación con el aviso del parámetro crítico; se cancela (no se guarda) | `/tecnico` | 1440x900 @2x |
| f105-tecnico-indice-reconstruir.png | Consola técnica: índice facial (IndiceFacialPanel + ConfirmDialog) | Diálogo de reconstrucción con casilla «Reconstrucción completa»; se cancela (no se ejecuta) | `/tecnico` | 1440x900 @2x |
| f106-filtros-alumnos.png | Filtros del listado de alumnos (BarraFiltros) | Búsqueda con retraso («Díaz»), filtro de estatus con su chip activo, «Limpiar» y conteo de resultados | `/admin/alumnos` | 1440x900 @2x |
| f110-movil-login-errores.png | Inicio de sesión (LoginForm), móvil | Móvil 390x844: envío vacío con errores en ambos campos | `/login` | 390x844 @3x (móvil) |
| f112-movil-alumno-alta-paso2.png | Alta de alumno (asistente), móvil | Móvil 390x844: paso 2 Contacto y acceso con el interruptor de cuenta activado (no se crea ningún alumno) | `/admin/alumnos/nuevo` | 390x844 @3x (móvil) |
| f113-movil-aula-panel-errores.png | Alta de aula (PanelLateral a pantalla completa), móvil | Móvil 390x844: el panel lateral ocupa toda la pantalla; envío vacío con errores y el motivo en el pie | `/admin/aulas` | 390x844 @3x (móvil) |
| f114-movil-justificante.png | Registrar justificante (RegistrarJustificanteForm), móvil | Móvil 390x844: tarjetas de falta, motivo con ideas para empezar y zona de documento (con botón «Tomar foto» en pantallas táctiles) | `/alumno` | 390x844 @3x (móvil) |

## Todas las capturas, por formulario

### Acceso: inicio de sesión

| Archivo | Formulario | Estado | Ruta | Vista |
|---|---|---|---|---|
| f01-login-vacio.png | Inicio de sesión (LoginForm) | Vacío | `/login` | 1440x900 @2x |
| f02-login-errores-blur.png | Inicio de sesión (LoginForm) | Errores de validación al salir de los campos | `/login` | 1440x900 @2x |
| f03-login-errores-envio.png | Inicio de sesión (LoginForm) | Envío incompleto: errores en ambos campos y foco en el primero | `/login` | 1440x900 @2x |
| f04-login-credenciales-incorrectas.png | Inicio de sesión (LoginForm) | Error del servidor: credenciales incorrectas (se conserva lo escrito) | `/login` | 1440x900 @2x |
| f05-login-lleno-valido.png | Inicio de sesión (LoginForm) | Lleno y válido, contraseña visible (listo para enviar) | `/login` | 1440x900 @2x |

### Acceso: recuperar y cambiar contraseña

| Archivo | Formulario | Estado | Ruta | Vista |
|---|---|---|---|---|
| f06-recuperar-vacio.png | Recuperar contraseña (RecuperarForm) | Vacío | `/recuperar` | 1440x900 @2x |
| f07-recuperar-error.png | Recuperar contraseña (RecuperarForm) | Envío con un correo sin @: error concreto junto al campo | `/recuperar` | 1440x900 @2x |
| f08-recuperar-exito.png | Recuperar contraseña (RecuperarForm) | Éxito: «Revisa tu correo» con mensaje neutro, «Reenviar enlace» con cuenta atrás de 60 s y «Usar otro correo» | `/recuperar` | 1440x900 @2x |
| f09-cambiar-clave-vacio.png | Cambiar contraseña (CambiarContrasenaForm) | Vacío: un solo campo con requisitos en vivo (sin confirmación), «Mostrar» y aviso de Bloq Mayús | `/cambiar-contrasena` | 1440x900 @2x |
| f10-cambiar-clave-parcial.png | Cambiar contraseña (CambiarContrasenaForm) | Contraseña de solo letras: «2 de 3 requisitos» y falta el número (no se envía) | `/cambiar-contrasena` | 1440x900 @2x |
| f11-cambiar-clave-valida.png | Cambiar contraseña (CambiarContrasenaForm) | Cumple los 3 requisitos (no se envía: el administrador de demostración conserva su contraseña) | `/cambiar-contrasena` | 1440x900 @2x |

### Alta de alumno (asistente de 3 pasos)

| Archivo | Formulario | Estado | Ruta | Vista |
|---|---|---|---|---|
| f12-alumno-alta-1-identidad-vacio.png | Alta de alumno (asistente de 3 pasos, AltaAlumno) | Paso 1 Identidad, vacío | `/admin/alumnos/nuevo` | 1440x900 @2x |
| f13-alumno-alta-1-identidad-errores.png | Alta de alumno (asistente de 3 pasos, AltaAlumno) | Paso 1 Identidad, «Siguiente» con campos vacíos (errores y resumen «Revisa este paso») | `/admin/alumnos/nuevo` | 1440x900 @2x |
| f14-alumno-alta-1-matricula-duplicada.png | Alta de alumno (asistente de 3 pasos, AltaAlumno) | Paso 1 Identidad, matrícula repetida detectada antes de crear (con enlace a la ficha del alumno existente) | `/admin/alumnos/nuevo` | 1440x900 @2x |
| f15-alumno-alta-1-identidad-valido.png | Alta de alumno (asistente de 3 pasos, AltaAlumno) | Paso 1 Identidad, lleno y válido (matrícula normalizada a mayúsculas, «Matrícula disponible») | `/admin/alumnos/nuevo` | 1440x900 @2x |
| f16-alumno-alta-2-contacto-vacio.png | Alta de alumno (asistente de 3 pasos, AltaAlumno) | Paso 2 Contacto y acceso, vacío | `/admin/alumnos/nuevo` | 1440x900 @2x |
| f17-alumno-alta-2-contacto-error.png | Alta de alumno (asistente de 3 pasos, AltaAlumno) | Paso 2 Contacto y acceso, «Siguiente» con un correo inválido | `/admin/alumnos/nuevo` | 1440x900 @2x |
| f18-alumno-alta-2-contacto-valido.png | Alta de alumno (asistente de 3 pasos, AltaAlumno) | Paso 2 Contacto y acceso, correo válido (normalizado a minúsculas) y «Crear su cuenta al terminar» activado | `/admin/alumnos/nuevo` | 1440x900 @2x |
| f19-alumno-alta-3-revision.png | Alta de alumno (asistente de 3 pasos, AltaAlumno) | Paso 3 Revisión con «Editar» por sección (la cuenta de acceso queda para después) | `/admin/alumnos/nuevo` | 1440x900 @2x |
| f20-alumno-alta-4-exito.png | Alta de alumno (asistente de 3 pasos, AltaAlumno) | Éxito: «Alumno creado» con siguientes pasos (consentimiento, plantilla facial, grupo, cuenta) | `/admin/alumnos/nuevo` | 1440x900 @2x |

### Ficha del alumno: datos, consentimiento y cuenta

| Archivo | Formulario | Estado | Ruta | Vista |
|---|---|---|---|---|
| f21-ficha-datos-sin-cambios.png | Datos del alumno (AlumnoForm en la ficha) | Ficha sin cambios: secciones Identidad, Contacto y Estado; guardar apagado con su motivo (recorte de la tarjeta) | `/admin/alumnos/77` | 1440x900 @2x, recorte de la tarjeta |
| f22-ficha-datos-errores.png | Datos del alumno (AlumnoForm en la ficha) | Edición con errores (apellido vacío y correo incompleto) y «2 cambios sin guardar»; no se guarda (recorte de la tarjeta) | `/admin/alumnos/77` | 1440x900 @2x, recorte de la tarjeta |
| f23-ficha-estatus-baja.png | Datos del alumno (AlumnoForm en la ficha) | Cambio de estatus a «Baja temporal»: aviso con el efecto sobre sus inscripciones y «1 cambio sin guardar»; no se guarda (recorte de la tarjeta) | `/admin/alumnos/77` | 1440x900 @2x, recorte de la tarjeta |
| f24-consentimiento-vacio.png | Consentimiento informado (FormularioConsentimiento en la ficha) | Formulario vacío: fecha de firma, vigencia y documento PDF (zona de arrastre con reglas visibles; recorte del formulario) | `/admin/alumnos/77` | 1440x900 @2x, recorte de la tarjeta |
| f25-consentimiento-errores.png | Consentimiento informado (FormularioConsentimiento en la ficha) | Envío vacío: errores en fecha de firma, vigencia y documento (recorte del formulario) | `/admin/alumnos/77` | 1440x900 @2x, recorte de la tarjeta |
| f26-consentimiento-valido.png | Consentimiento informado (FormularioConsentimiento en la ficha) | Firma con «Hoy» (reloj del plantel), vigencia sugerida de 1 año y PDF cargado; no se envía (recorte del formulario) | `/admin/alumnos/77` | 1440x900 @2x, recorte de la tarjeta |
| f27-ficha-cuenta-acceso.png | Cuenta de acceso (CuentaAccesoPanel en la ficha) | Alumno sin cuenta: se explica qué se creará y se ofrece «Crear cuenta de acceso» (recorte de la tarjeta) | `/admin/alumnos/77` | 1440x900 @2x, recorte de la tarjeta |

### Catálogos en panel lateral: aula, materia y docente

| Archivo | Formulario | Estado | Ruta | Vista |
|---|---|---|---|---|
| f28-aula-vacio.png | Alta de aula (AulaForm en PanelLateral) | Panel lateral «Nueva aula», vacío | `/admin/aulas` | 1440x900 @2x |
| f29-aula-errores.png | Alta de aula (AulaForm en PanelLateral) | Envío vacío: errores junto a cada campo, foco en el primero y motivo en el pie («Revisa los campos marcados») | `/admin/aulas` | 1440x900 @2x |
| f30-aula-valido.png | Alta de aula (AulaForm en PanelLateral) | Lleno y válido (valores normalizados al salir del campo, «Válido» donde aplica) | `/admin/aulas` | 1440x900 @2x |
| f31-aula-exito.png | Alta de aula (AulaForm en PanelLateral) | Éxito: «Aula ZZ-P1 creada» con siguiente paso y salidas | `/admin/aulas` | 1440x900 @2x |
| f32-materia-vacio.png | Alta de materia (MateriaForm en PanelLateral) | Panel lateral «Nueva materia», vacío | `/admin/materias` | 1440x900 @2x |
| f33-materia-errores.png | Alta de materia (MateriaForm en PanelLateral) | Envío vacío: errores junto a cada campo, foco en el primero y motivo en el pie («Revisa los campos marcados») | `/admin/materias` | 1440x900 @2x |
| f34-materia-valido.png | Alta de materia (MateriaForm en PanelLateral) | Lleno y válido (valores normalizados al salir del campo, «Válido» donde aplica) | `/admin/materias` | 1440x900 @2x |
| f35-materia-exito.png | Alta de materia (MateriaForm en PanelLateral) | Éxito: «Materia ZZP101 creada» con siguientes pasos | `/admin/materias` | 1440x900 @2x |
| f36-docente-vacio.png | Alta de docente (DocenteForm en PanelLateral) | Panel lateral «Nuevo docente», vacío | `/admin/docentes` | 1440x900 @2x |
| f37-docente-errores.png | Alta de docente (DocenteForm en PanelLateral) | Envío vacío: errores junto a cada campo, foco en el primero y motivo en el pie («Revisa los campos marcados») | `/admin/docentes` | 1440x900 @2x |
| f38-docente-valido.png | Alta de docente (DocenteForm en PanelLateral) | Lleno y válido (valores normalizados al salir del campo, «Válido» donde aplica) | `/admin/docentes` | 1440x900 @2x |
| f39-docente-exito.png | Alta de docente (DocenteForm en PanelLateral) | Éxito del alta de docente con siguientes pasos (crear cuenta de acceso) | `/admin/docentes` | 1440x900 @2x |

### Usuarios: nueva cuenta y cambio de rol

| Archivo | Formulario | Estado | Ruta | Vista |
|---|---|---|---|---|
| f40-usuario-vacio.png | Nueva cuenta de usuario (CrearUsuarioDialog en PanelLateral) | Panel lateral «Nueva cuenta de usuario», vacío (tarjetas de rol con su descripción) | `/admin/usuarios` | 1440x900 @2x |
| f41-usuario-errores.png | Nueva cuenta de usuario (CrearUsuarioDialog en PanelLateral) | Envío vacío: errores del vínculo y del correo | `/admin/usuarios` | 1440x900 @2x |
| f42-usuario-valido.png | Nueva cuenta de usuario (CrearUsuarioDialog en PanelLateral) | Docente elegido con búsqueda remota; el correo se prellena con el institucional del vínculo (editable); no se envía | `/admin/usuarios` | 1440x900 @2x |
| f43-usuario-cambiar-rol-menu.png | Cambiar rol de una cuenta (AccionesUsuario, Modal full-mobile) | Modal «Cambiar rol» abierto desde el menú «⋯» de la fila; guardar apagado hasta elegir otro rol | `/admin/usuarios` | 1440x900 @2x |
| f44-usuario-cambiar-rol-elegido.png | Cambiar rol de una cuenta (AccionesUsuario, Modal full-mobile) | Rol nuevo elegido (Técnico): se habilita guardar y se avisa qué pasa con el vínculo actual; no se envía | `/admin/usuarios` | 1440x900 @2x |

### Alta de grupo (asistente de 3 pasos)

| Archivo | Formulario | Estado | Ruta | Vista |
|---|---|---|---|---|
| f45-grupo-alta-1-datos-vacio.png | Alta de grupo (asistente de 3 pasos, AsistenteGrupo) | Paso 1 Materia y docente, vacío (periodo sugerido según el reloj del plantel) | `/admin/grupos/nuevo` | 1440x900 @2x |
| f46-grupo-alta-1-datos-errores.png | Alta de grupo (asistente de 3 pasos, AsistenteGrupo) | Paso 1, «Siguiente» con campos vacíos (errores y resumen «Revisa este paso») | `/admin/grupos/nuevo` | 1440x900 @2x |
| f47-grupo-alta-1-datos-valido.png | Alta de grupo (asistente de 3 pasos, AsistenteGrupo) | Paso 1, lleno y válido (selectores con búsqueda, clave en mayúsculas, resumen vivo a la derecha) | `/admin/grupos/nuevo` | 1440x900 @2x |
| f48-grupo-alta-2-aula-vacio.png | Alta de grupo (asistente de 3 pasos, AsistenteGrupo) | Paso 2 Aula y horario, vacío (horario opcional con atajos de días) | `/admin/grupos/nuevo` | 1440x900 @2x |
| f49-grupo-alta-2-aula-errores.png | Alta de grupo (asistente de 3 pasos, AsistenteGrupo) | Paso 2, «Siguiente» sin aula (error junto al campo y resumen) | `/admin/grupos/nuevo` | 1440x900 @2x |
| f50-grupo-alta-2-aula-franja.png | Alta de grupo (asistente de 3 pasos, AsistenteGrupo) | Paso 2, aula elegida y franja Lun-Mié-Vie 07:00-08:00 (duración, comparación con las horas de la materia y vista semanal) | `/admin/grupos/nuevo` | 1440x900 @2x |
| f51-grupo-alta-3-revision.png | Alta de grupo (asistente de 3 pasos, AsistenteGrupo) | Paso 3 Revisión con «Editar» por sección (materia/docente, aula y horario) | `/admin/grupos/nuevo` | 1440x900 @2x |
| f52-grupo-alta-4-exito.png | Alta de grupo (asistente de 3 pasos, AsistenteGrupo) | Éxito: «Grupo ZZ1 creado» con siguientes pasos (generar sesiones, inscribir alumnos, cámara del aula) | `/admin/grupos/nuevo` | 1440x900 @2x |

### Grupo: datos, horario, generar sesiones, capacidad, cámara, inscripciones e importación CSV

| Archivo | Formulario | Estado | Ruta | Vista |
|---|---|---|---|---|
| f53-grupo-datos-sin-cambios.png | Datos del grupo (GrupoForm, pestaña Datos) | Edición sin cambios: «Guardar cambios» apagado y el motivo escrito («Aún no hay cambios que guardar») | `/admin/grupos/4` | 1440x900 @2x |
| f54-grupo-datos-errores.png | Datos del grupo (GrupoForm, pestaña Datos) | Edición con cambios inválidos: errores al salir de los campos y «2 cambios sin guardar» (no se guarda) | `/admin/grupos/4` | 1440x900 @2x |
| f55-grupo-horario-editor.png | Horario semanal (HorarioEditor / HorarioSemanal, pestaña Horario) | Horario guardado: franja Lun-Mié-Vie 07:00-08:00, total semanal y vista semanal | `/admin/grupos/4?tab=horario` | 1440x900 @2x |
| f56-grupo-horario-errores.png | Horario semanal (HorarioEditor / HorarioSemanal, pestaña Horario) | Hora de fin anterior a la de inicio: error en línea y «Cambios sin guardar» (no se guarda) | `/admin/grupos/4?tab=horario` | 1440x900 @2x |
| f57-grupo-generar-sesiones.png | Generar sesiones (GenerarSesiones, pestaña Horario) | Rango de fechas con atajos, fecha a omitir agregada y vista previa («Generar N sesiones»); no se envía | `/admin/grupos/4?tab=horario` | 1440x900 @2x |
| f58-grupo-capacidad-cambio.png | Capacidad del aula (CapacidadForm, pestaña Aula y cámaras) | Capacidad editada (25 → 10): «Cambios sin guardar» y botón de guardar habilitado; no se envía | `/admin/grupos/4?tab=aula` | 1440x900 @2x |
| f59-camara-vacio.png | Alta de cámara (CamaraForm en PanelLateral) | Panel lateral «Agregar cámara», vacío (tipo Cámara IP, estatus Activa) | `/admin/grupos/4?tab=aula` | 1440x900 @2x |
| f60-camara-errores.png | Alta de cámara (CamaraForm en PanelLateral) | Envío sin dirección IP: error junto al campo | `/admin/grupos/4?tab=aula` | 1440x900 @2x |
| f61-camara-ip-invalida.png | Alta de cámara (CamaraForm en PanelLateral) | Dirección IP con formato inválido (999.1.1.1) | `/admin/grupos/4?tab=aula` | 1440x900 @2x |
| f62-camara-valido.png | Alta de cámara (CamaraForm en PanelLateral) | Dirección IP válida (10.20.12.99), lista para guardar | `/admin/grupos/4?tab=aula` | 1440x900 @2x |
| f63-camara-guardada.png | Alta de cámara (CamaraForm en PanelLateral) | Tras guardar: la cámara aparece en su posición (con «Probar conexión» disponible) | `/admin/grupos/4?tab=aula` | 1440x900 @2x |
| f64-inscribir-busqueda.png | Inscribir alumnos (InscribirAlumno, pestaña Inscripciones) | Búsqueda remota de alumnos con opciones de dos líneas (nombre; matrícula y avisos) | `/admin/grupos/4?tab=inscripciones` | 1440x900 @2x |
| f65-inscribir-lista.png | Inscribir alumnos (InscribirAlumno, pestaña Inscripciones) | Dos alumnos elegidos en la lista y botón «Inscribir 2 alumnos» (no se envía) | `/admin/grupos/4?tab=inscripciones` | 1440x900 @2x |
| f66-importar-csv-1-archivo-vacio.png | Importar inscripciones desde CSV (ImportarCsv, modal de 4 pasos) | Paso 1 Archivo, vacío (plantilla descargable y zona de arrastre) | `/admin/grupos/4?tab=inscripciones` | 1440x900 @2x |
| f67-importar-csv-1-archivo-cargado.png | Importar inscripciones desde CSV (ImportarCsv, modal de 4 pasos) | Paso 1 Archivo, CSV de demostración cargado | `/admin/grupos/4?tab=inscripciones` | 1440x900 @2x |
| f68-importar-csv-2-revision.png | Importar inscripciones desde CSV (ImportarCsv, modal de 4 pasos) | Paso 2 Revisión: contadores, errores agrupados por causa y vista previa (el servidor aún no recibe nada) | `/admin/grupos/4?tab=inscripciones` | 1440x900 @2x |
| f69-importar-csv-3-confirmar.png | Importar inscripciones desde CSV (ImportarCsv, modal de 4 pasos) | Paso 3 Confirmar: qué pasará y cupo; no se confirma la importación | `/admin/grupos/4?tab=inscripciones` | 1440x900 @2x |

### Justificante guiado (alumno)

| Archivo | Formulario | Estado | Ruta | Vista |
|---|---|---|---|---|
| f70-justificante-vacio.png | Registrar justificante (RegistrarJustificanteForm, alumno) | Vacío: 3 bloques numerados (falta, motivo, documento) y la barra dice qué falta; con 2 faltas se ven como tarjetas | `/alumno` | 1440x900 @2x, recorte de la tarjeta |
| f71-justificante-errores.png | Registrar justificante (RegistrarJustificanteForm, alumno) | Envío incompleto: errores en los tres bloques y el foco en el primero (el botón no se apaga) | `/alumno` | 1440x900 @2x, recorte de la tarjeta |
| f72-justificante-valido.png | Registrar justificante (RegistrarJustificanteForm, alumno) | Lleno y válido: falta elegida, motivo con contador y miniatura del documento; la barra dice «Todo listo para enviar» | `/alumno` | 1440x900 @2x, recorte de la tarjeta |
| f73-justificante-exito.png | Registrar justificante (RegistrarJustificanteForm, alumno) | Éxito dentro de la tarjeta: «Justificante enviado» (Pendiente) con siguientes pasos | `/alumno` | 1440x900 @2x, recorte de la tarjeta |
| f74-justificante-selector-faltas.png | Registrar justificante (RegistrarJustificanteForm, alumno) | Con más de 4 faltas la elección es un selector con búsqueda (opciones con fecha, materia y estado en texto) | `/alumno` | 1440x900 @2x |

### Cuenta de acceso, activación de cuenta (Onboarding) y registro facial del alumno

| Archivo | Formulario | Estado | Ruta | Vista |
|---|---|---|---|---|
| f75-cuenta-clave-temporal.png | Cuenta de acceso del alumno: contraseña temporal (PasswordTemporalModal) | Tras crear la cuenta: la contraseña temporal se muestra una sola vez, con «Copiar» (cuenta de prueba que se elimina al terminar; la clave se enmascara en la captura) | `/admin/alumnos/78` | 1440x900 @2x |
| f76-ficha-cuenta-creada.png | Cuenta de acceso (CuentaAccesoPanel en la ficha) | Después de crear la cuenta: la tarjeta pasa a «Cuenta activa» con su correo | `/admin/alumnos/78` | 1440x900 @2x, recorte de la tarjeta |
| f77-activar-1-contrasena-vacio.png | Activar cuenta (Onboarding, asistente de 4 pasos) | Paso 1 Contraseña, vacío (requisitos con icono y texto) | `/activar-cuenta` | 1440x900 @2x |
| f78-activar-1-contrasena-error.png | Activar cuenta (Onboarding, asistente de 4 pasos) | Paso 1, envío vacío: error junto al campo | `/activar-cuenta` | 1440x900 @2x |
| f79-activar-1-contrasena-parcial.png | Activar cuenta (Onboarding, asistente de 4 pasos) | Paso 1, contraseña parcial: requisitos en vivo («1 de 3») | `/activar-cuenta` | 1440x900 @2x |
| f80-activar-1-contrasena-valida.png | Activar cuenta (Onboarding, asistente de 4 pasos) | Paso 1, contraseña válida (3 de 3 requisitos) y visible con «Mostrar» | `/activar-cuenta` | 1440x900 @2x |
| f81-activar-2-estilo.png | Activar cuenta (Onboarding, asistente de 4 pasos) | Paso 2 Estilo: color del avatar (se guarda por navegador) | `/activar-cuenta` | 1440x900 @2x |
| f82-activar-3-guia.png | Activar cuenta (Onboarding, asistente de 4 pasos) | Paso 3 Guía de SUSAN según el rol (alumno) | `/activar-cuenta` | 1440x900 @2x |
| f83-activar-4-privacidad.png | Activar cuenta (Onboarding, asistente de 4 pasos) | Paso 4 Privacidad: el botón final está apagado y el motivo se escribe junto a él | `/activar-cuenta` | 1440x900 @2x |
| f84-activar-4-privacidad-aceptada.png | Activar cuenta (Onboarding, asistente de 4 pasos) | Paso 4, acuse marcado: se habilita «Empezar a usar SUSAN» | `/activar-cuenta` | 1440x900 @2x |
| f85-registro-facial-1-aviso.png | Mi registro facial (MiRegistro: aviso de consentimiento y asistente de rostro) | Paso 1 Aviso y consentimiento: texto del aviso por secciones y declaración de aceptación | `/alumno/registro` | 1440x900 @2x |
| f86-registro-facial-1-aviso-error.png | Mi registro facial (MiRegistro: aviso de consentimiento y asistente de rostro) | Aceptar sin marcar la declaración: error junto a la casilla | `/alumno/registro` | 1440x900 @2x |
| f87-registro-facial-1-aviso-marcado.png | Mi registro facial (MiRegistro: aviso de consentimiento y asistente de rostro) | Declaración marcada y botón «Aceptar y continuar» (registra el consentimiento propio) | `/alumno/registro` | 1440x900 @2x |
| f88-registro-facial-2-rostro.png | Mi registro facial (MiRegistro: aviso de consentimiento y asistente de rostro) | Paso 2 Tu rostro: indicaciones y «Registrar mi rostro» (consentimiento ya registrado) | `/alumno/registro` | 1440x900 @2x |
| f89-registro-facial-3-asistente-intro.png | Mi registro facial (MiRegistro: aviso de consentimiento y asistente de rostro) | Asistente de cámara: portada con consejos y «Comenzar» | `/alumno/registro` | 1440x900 @2x |
| f90-registro-facial-3-captura.png | Mi registro facial (MiRegistro: aviso de consentimiento y asistente de rostro) | Toma guiada con la cámara (cámara falsa de Chromium: sin rostro, la toma no se completa) | `/alumno/registro` | 1440x900 @2x |

### Revisión de justificantes (docente)

| Archivo | Formulario | Estado | Ruta | Vista |
|---|---|---|---|---|
| f91-revision-justificante-caso.png | Resolver justificante (JustificanteCard + ConfirmDialog con motivo) | Caso abierto: motivo del justificante, lecturas bajo demanda y botones «Aprobar» / «Rechazar» | `/docente/revision?pestana=justificantes` | 1440x900 @2x |
| f92-revision-rechazar-vacio.png | Resolver justificante (JustificanteCard + ConfirmDialog con motivo) | Diálogo «Rechazar justificante» con el comentario obligatorio, vacío | `/docente/revision?pestana=justificantes` | 1440x900 @2x |
| f93-revision-rechazar-error.png | Resolver justificante (JustificanteCard + ConfirmDialog con motivo) | Confirmar sin comentario: «Escribe el motivo para continuar.» con borde rojo y foco en el campo (no se rechaza) | `/docente/revision?pestana=justificantes` | 1440x900 @2x |
| f94-revision-rechazar-lleno.png | Resolver justificante (JustificanteCard + ConfirmDialog con motivo) | Comentario escrito: listo para confirmar (se cancela, no se rechaza) | `/docente/revision?pestana=justificantes` | 1440x900 @2x |

### Pase de lista: registro manual

| Archivo | Formulario | Estado | Ruta | Vista |
|---|---|---|---|---|
| f95-pase-lista-panel.png | Pasar lista (PasosPaseLista + panel de la sesión) | Sesión 3A abierta con la franja de 3 pasos, la vista de cámara y los botones «Revisar y cerrar» / «Registrar manualmente» | `/docente/sesiones/19?pasar-lista=1` | 1440x900 @2x |
| f96-registro-manual-vacio.png | Registrar manualmente (RegistroManualDialog) | Diálogo vacío: alumno (selector con búsqueda) y estado con la sugerencia según la hora | `/docente/sesiones/19?pasar-lista=1` | 1440x900 @2x |
| f97-registro-manual-errores.png | Registrar manualmente (RegistroManualDialog) | Envío sin elegir alumno: error junto al selector | `/docente/sesiones/19?pasar-lista=1` | 1440x900 @2x |
| f98-registro-manual-valido.png | Registrar manualmente (RegistroManualDialog) | Alumno elegido y estado Presente sugerido; listo para registrar (no se envía) | `/docente/sesiones/19?pasar-lista=1` | 1440x900 @2x |

### Consola técnica

| Archivo | Formulario | Estado | Ruta | Vista |
|---|---|---|---|---|
| f99-tecnico-camaras.png | Consola técnica: cámaras (CamarasEstado, SegmentedControl + ConfirmDialog) | Pestaña Cámaras: resumen y una tarjeta por cámara con su estatus como control segmentado (texto + color) | `/tecnico` | 1440x900 @2x |
| f100-tecnico-camaras-confirmar.png | Consola técnica: cámaras (CamarasEstado, SegmentedControl + ConfirmDialog) | Cambiar el estatus pide confirmación con el nombre de la cámara y la consecuencia; se cancela (no se aplica) | `/tecnico` | 1440x900 @2x |
| f101-tecnico-parametros.png | Consola técnica: parámetros del sistema (ParametrosEditor / ParametroFila) | Pestaña Parámetros: 12 parámetros en 4 secciones, con unidad, rango válido, valor de fábrica y marca «Crítico» | `/tecnico` | 1440x900 @2x |
| f102-tecnico-parametro-error.png | Consola técnica: parámetros del sistema (ParametrosEditor / ParametroFila) | Valor fuera de rango (1.5 en un parámetro de 0.500 a 0.999): error en línea y «Sin guardar»; no se envía | `/tecnico` | 1440x900 @2x |
| f103-tecnico-parametro-confirmar.png | Consola técnica: parámetros del sistema (ParametrosEditor / ParametroFila) | Cambio válido (0.850 a 0.900): confirmación con el aviso del parámetro crítico; se cancela (no se guarda) | `/tecnico` | 1440x900 @2x |
| f104-tecnico-indice.png | Consola técnica: índice facial (IndiceFacialPanel + ConfirmDialog) | Pestaña Índice facial: versión en uso, plantillas indexadas y «Reconstruir índice» | `/tecnico` | 1440x900 @2x |
| f105-tecnico-indice-reconstruir.png | Consola técnica: índice facial (IndiceFacialPanel + ConfirmDialog) | Diálogo de reconstrucción con casilla «Reconstrucción completa»; se cancela (no se ejecuta) | `/tecnico` | 1440x900 @2x |

### Filtros de listados, reportes, analítica y bitácora

| Archivo | Formulario | Estado | Ruta | Vista |
|---|---|---|---|---|
| f106-filtros-alumnos.png | Filtros del listado de alumnos (BarraFiltros) | Búsqueda con retraso («Díaz»), filtro de estatus con su chip activo, «Limpiar» y conteo de resultados | `/admin/alumnos` | 1440x900 @2x |
| f107-filtros-reporte.png | Filtros del reporte de asistencia (FiltrosReporte) | Periodo, grupo y alumno (el alumno se habilita al elegir grupo) | `/reportes` | 1440x900 @2x |
| f108-filtros-analitica.png | Selección de grupo para la analítica (SelectorGrupo) | Periodo y grupo a analizar | `/analitica` | 1440x900 @2x |
| f109-filtros-bitacora-rango-invertido.png | Filtros de la bitácora (BitacoraTabla: Combobox, RangoFechas) | Rango de fechas invertido: se explica junto a las fechas y no se aplica (la lista conserva el último filtro válido) | `/admin/bitacora` | 1440x900 @2x |

### Capturas móviles (390x844 a 3x)

| Archivo | Formulario | Estado | Ruta | Vista |
|---|---|---|---|---|
| f110-movil-login-errores.png | Inicio de sesión (LoginForm), móvil | Móvil 390x844: envío vacío con errores en ambos campos | `/login` | 390x844 @3x (móvil) |
| f111-movil-alumno-alta-paso1.png | Alta de alumno (asistente), móvil | Móvil 390x844: paso 1 con el progreso compacto («Paso 1 de 3») y las acciones al pie | `/admin/alumnos/nuevo` | 390x844 @3x (móvil) |
| f112-movil-alumno-alta-paso2.png | Alta de alumno (asistente), móvil | Móvil 390x844: paso 2 Contacto y acceso con el interruptor de cuenta activado (no se crea ningún alumno) | `/admin/alumnos/nuevo` | 390x844 @3x (móvil) |
| f113-movil-aula-panel-errores.png | Alta de aula (PanelLateral a pantalla completa), móvil | Móvil 390x844: el panel lateral ocupa toda la pantalla; envío vacío con errores y el motivo en el pie | `/admin/aulas` | 390x844 @3x (móvil) |
| f114-movil-justificante.png | Registrar justificante (RegistrarJustificanteForm), móvil | Móvil 390x844: tarjetas de falta, motivo con ideas para empezar y zona de documento (con botón «Tomar foto» en pantallas táctiles) | `/alumno` | 390x844 @3x (móvil) |

