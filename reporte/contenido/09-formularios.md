## DISEÑO Y CÓDIGO DE LOS FORMULARIOS.

En SUSAN los formularios son formularios web y flujos guiados de la aplicación, construidos con las mismas primitivas de campo y de contenedor. El inventario hecho sobre `web/src` (commit `f742bb4` de `origin/main`) registra **41 formularios y flujos**: 4 de acceso, 7 de alumnos, 7 de catálogos y cuentas, 9 de grupos, 1 del portal del alumno, 5 del docente, 3 de filtros, 3 de la consola técnica y 2 que existen solo en el modo local de desarrollo. Además hay 4 controles de entrada que no son formularios (por ejemplo, la caja de búsqueda de la paleta de comandos).

Según su contenedor, **2 son asistentes** construidos sobre `ui/Asistente` (alta de alumno y alta de grupo), **5 son flujos guiados con guion propio** (activar cuenta, importar CSV, «Mi registro facial», registro facial guiado de cinco tomas y registrar justificante), **5 son altas de un paso en un panel lateral** (aula, materia, docente, cuenta de usuario y cámara) y el resto son formularios de página, diálogos con campos y barras de filtros. Esta sección describe cuáles son, qué principios de diseño los rigen, cómo se ven, cómo está organizado su código y qué parte de ellos se verificó.

### 1. Formularios del sistema.

La Tabla 1 resume doce de los formularios más representativos. El inventario completo, con cada campo, sus mensajes de validación, la función a la que llama y sus pruebas, se entrega en los anexos.

<!-- anchos: 22,53,25 -->
| Formulario | Campos principales | Ruta |
|---|---|---|
| Inicio de sesión | Correo institucional, contraseña | `/login` |
| Recuperar contraseña | Correo institucional | `/recuperar` |
| Activar cuenta (4 pasos) | Contraseña, color de avatar, aviso de privacidad | `/activar-cuenta` |
| Alta de alumno (3 pasos) | Matrícula, nombres, apellidos, correo, cuenta | `/admin/alumnos/nuevo` |
| Datos del alumno | Los de alta y el estatus | `/admin/alumnos/[id]` |
| Aula (panel lateral) | Clave, edificio, capacidad | `/admin/aulas` |
| Materia (panel lateral) | Clave, nombre, créditos, horas por semana | `/admin/materias` |
| Docente (panel lateral) | Número de empleado, correo, apellidos, nombres | `/admin/docentes` |
| Nueva cuenta de usuario | Rol, docente o alumno vinculado, correo de acceso | `/admin/usuarios` |
| Alta de grupo (3 pasos) | Materia, docente, aula, clave, periodo, horario | `/admin/grupos/nuevo` |
| Importar inscripciones (4 pasos) | Archivo CSV | `/admin/grupos/[id]`, pestaña Inscripciones |
| Registrar justificante | Falta, motivo, documento | `/alumno` |

Nota. Tabla 1. Elaboración propia con base en el inventario de formularios de `web/src` (commit `f742bb4`).

### 2. Principios de diseño.

El diseño de los formularios se destiló de los documentos de `docs/design/formularios/` (`BRIEF-COMUN-FRENTES.md`, `PRIMITIVAS-campos.md`, `PRIMITIVAS-contenedores.md`, `auditoria.md`, `referencias-campos-y-validacion.md`, `referencias-flujos-guiados.md` y los frentes `FRENTE-F2` a `FRENTE-F6`) y de `docs/design/SISTEMA.md`. La auditoría del 6 de octubre de 2026 encontró que los formularios de entonces validaban solo al enviar, no avisaban de cambios sin guardar, usaban selectores nativos de hasta 200 opciones, no declaraban los límites de la base en los campos y duplicaban errores en alerta y aviso emergente. Con ese diagnóstico se fijó la dirección de `SISTEMA.md`: todo formulario es guiado y dinámico, y el rediseño es solo capa de presentación y validación de conveniencia; no cambia las funciones RPC, las rutas, los payloads ni los códigos de error, de modo que el servidor sigue siendo la validación real. Los principios resultantes son los siguientes.

- **Un campo, una anatomía.** `ui/Field` envuelve un único control y lo conecta con su texto mediante `id`, `aria-describedby` y `aria-invalid`. Presenta etiqueta, control, ayuda con ejemplo, error con icono y `role="alert"`, estado «Válido» y contador `n/max`. Lo obligatorio se marca con `*` y lo opcional con la palabra «(opcional)»; nunca se mezclan ambas marcas.
- **El error dice qué se espera y cómo arreglarlo.** No se usan mensajes genéricos como «valor inválido»; por ejemplo: «Escribe los créditos: un número entero de 1 a 99 (no puede ser 0).».
- **Se valida al salir del campo o al enviar**, nunca la primera vez que se escribe; con un error visible se revalida en cada tecla. Enviar con datos inválidos no llama al servidor y enfoca el primer campo inválido.
- **El botón de alta no se apaga por datos inválidos**: el clic muestra los errores. Solo se apaga en edición sin cambios, y entonces dice el motivo junto al botón.
- **Un solo aviso por error y pegado a su campo.** Los códigos del servidor (`DUPLICADO`, `HORARIO_CHOQUE`, entre otros) se convierten en un mensaje bajo el campo que los causó; tras un error se conserva todo lo capturado.
- **Los límites son los de la base.** `lib/formularios/limites.js` declara `LIMITES` y `PATRONES` (por ejemplo, matrícula de 10 caracteres) y una prueba los compara con el DDL de la base.
- **Contenedor según la tarea.** Un paso de hasta unos seis campos va en `PanelLateral`; los datos con dependencias o que conviene revisar antes de crear van en `Asistente` con una pantalla de revisión; un asistente para dos o tres campos se considera un anti-patrón, por lo que el justificante son tres bloques numerados.
- **Nunca volver en silencio.** Al terminar, `ui/SuccessState` muestra el resultado y de dos a cuatro siguientes pasos reales.
- **Cambios sin guardar.** `FormActions` muestra «N cambios sin guardar» con punto de color y texto, y `useCambiosSinGuardar` avisa al recargar o cerrar la página.
- **Accesibilidad y móvil.** Nada se expresa solo con color (error = borde, icono y texto); el foco es visible; los diálogos atrapan y devuelven el foco; toda pantalla debe verse bien a 360 px, sin desborde horizontal y respetando «reducir movimiento» (regla de `CLAUDE.md`).
- **Forma y tokens.** Campos y botones de 8 px de radio, tarjetas sin sombra, botón primario negro, interfaz en Hanken Grotesk de 14 px y colores solo mediante tokens semánticos; los iconos son siempre de Lucide.

Las referencias de interfaz provienen de capturas de Mobbin (R01 a R18, con su dirección en `referencias-campos-y-validacion.md`), de las que se extrajeron 12 patrones y 14 anti-patrones a evitar; en este reporte no se reproducen imágenes de terceros.

### 3. Diseño de las pantallas.

Las capturas se tomaron de la aplicación en ejecución (Next 16.3.8 en modo de desarrollo, `SUSAN_LOCAL=1`, reloj de demostración fijo en el lunes 14 de septiembre de 2026, 07:12) con Playwright y Chromium, en escritorio de 1440x900 a factor 2 y en móvil de 390x844 a factor 3, con «reducir movimiento» activado. Los registros creados por las capturas llevan el prefijo «ZZ».

:::figura archivo="/tmp/claude-0/-home-user-susan/40436e6d-ab3e-5c65-9b75-f6742b8df0d9/scratchpad/susan-main/reporte/figuras/forms/f01-login-vacio.png" titulo="Pantalla de inicio de sesión en estado vacío." nota="Nota. Ruta `/login`; el foco inicial está en el correo y el ejemplo `nombre@unach.mx` aparece como texto de apoyo. Elaboración propia." ancho=15

:::figura archivo="/tmp/claude-0/-home-user-susan/40436e6d-ab3e-5c65-9b75-f6742b8df0d9/scratchpad/susan-main/reporte/figuras/forms/f03-login-errores-envio.png" titulo="Pantalla de inicio de sesión en estado de envío incompleto con errores." nota="Nota. Cada error aparece junto a su campo con icono, texto y borde rojo; el botón no se apaga. Elaboración propia." ancho=15

:::figura archivo="/tmp/claude-0/-home-user-susan/40436e6d-ab3e-5c65-9b75-f6742b8df0d9/scratchpad/susan-main/reporte/figuras/forms/f13-alumno-alta-1-identidad-errores.png" titulo="Pantalla de alta de alumno, paso 1 Identidad, en estado de errores al avanzar." nota="Nota. El resumen «Revisa este paso antes de continuar» enumera los errores y el foco pasa al primer campo inválido. Elaboración propia." ancho=15

:::figura archivo="/tmp/claude-0/-home-user-susan/40436e6d-ab3e-5c65-9b75-f6742b8df0d9/scratchpad/susan-main/reporte/figuras/forms/f15-alumno-alta-1-identidad-valido.png" titulo="Pantalla de alta de alumno, paso 1 Identidad, en estado lleno y válido." nota="Nota. La matrícula se normaliza a mayúsculas, muestra el contador 9/10 y el mensaje «Matrícula disponible»; el resumen de la derecha se actualiza en vivo. Datos de prueba. Elaboración propia." ancho=15

:::figura archivo="/tmp/claude-0/-home-user-susan/40436e6d-ab3e-5c65-9b75-f6742b8df0d9/scratchpad/susan-main/reporte/figuras/forms/f19-alumno-alta-3-revision.png" titulo="Pantalla de alta de alumno, paso 3 Revisión, en estado previo a la creación." nota="Nota. Cada sección tiene su botón «Editar» y la acción final es «Crear alumno» (verbo y objeto). Datos de prueba. Elaboración propia." ancho=15

:::figura archivo="/tmp/claude-0/-home-user-susan/40436e6d-ab3e-5c65-9b75-f6742b8df0d9/scratchpad/susan-main/reporte/figuras/forms/f71-justificante-errores.png" titulo="Pantalla de registro de justificante en estado de envío incompleto." nota="Nota. Tres bloques numerados con errores en cada uno; la barra inferior dice qué falta y el botón permanece activo. Recorte de la tarjeta del formulario. Elaboración propia." ancho=7

:::figura archivo="/tmp/claude-0/-home-user-susan/40436e6d-ab3e-5c65-9b75-f6742b8df0d9/scratchpad/susan-main/reporte/figuras/forms/f29-aula-errores.png" titulo="Pantalla de alta de aula en panel lateral en estado de envío vacío." nota="Nota. Ruta `/admin/aulas`; el pie fijo indica «Revisa los campos marcados.» y ofrece «Crear y agregar otra». Elaboración propia." ancho=15

:::figura archivo="/tmp/claude-0/-home-user-susan/40436e6d-ab3e-5c65-9b75-f6742b8df0d9/scratchpad/susan-main/reporte/figuras/forms/f113-movil-aula-panel-errores.png" titulo="Pantalla móvil de alta de aula en estado de envío vacío." nota="Nota. En teléfono el panel lateral ocupa toda la pantalla (390x844). Elaboración propia." ancho=5.5

:::figura archivo="/tmp/claude-0/-home-user-susan/40436e6d-ab3e-5c65-9b75-f6742b8df0d9/scratchpad/susan-main/reporte/figuras/forms/f110-movil-login-errores.png" titulo="Pantalla móvil de inicio de sesión en estado de envío vacío con errores." nota="Nota. Los campos y el botón ocupan el ancho disponible sin desborde horizontal. Elaboración propia." ancho=5.5

### 4. Organización del código.

Por convención del proyecto, cada componente vive en su propia carpeta y las páginas solo lo componen. La Tabla 2 enumera los diez archivos de `web/src` que se copiaron literalmente para este reporte (1345 líneas en total); cada copia se comparó con `diff -q` contra el archivo del repositorio y es idéntica.

<!-- anchos: 24,50,10,16 -->
| Archivo | Ruta de origen (`web/src/`) | Líneas | Función |
|---|---|---|---|
| `Field.jsx` | `components/ui/Field/` | 150 | Primitiva de campo |
| `useFormulario.js` | `hooks/ui/` | 223 | Estado y validación |
| `login.utils.js` | `components/auth/LoginForm/` | 53 | Reglas del acceso |
| `LoginForm.jsx` | `components/auth/LoginForm/` | 76 | Formulario de acceso |
| `alumnoForm.utils.js` | `components/admin/alumnos/AlumnoForm/` | 118 | Reglas del alumno |
| `CamposAlumno.jsx` | `components/admin/alumnos/AlumnoForm/` | 136 | Campos compartidos |
| `AlumnoForm.jsx` | `components/admin/alumnos/AlumnoForm/` | 102 | Ficha del alumno |
| `AltaAlumno.jsx` | `components/admin/alumnos/NuevoAlumno/` | 182 | Asistente de alta |
| `registrarJustificante.utils.js` | `components/alumno/RegistrarJustificanteForm/` | 76 | Reglas del justificante |
| `RegistrarJustificanteForm.jsx` | `components/alumno/RegistrarJustificanteForm/` | 229 | Formulario guiado |

Nota. Tabla 2. Elaboración propia con base en `reporte/form/codigo/INDICE.md`. No se copiaron los contenedores `FormActions`, `FormSection`, `Asistente`, `Stepper`, `SuccessState`, `PanelLateral` e `Input`, ni `lib/formularios/limites.js`, que los archivos anteriores importan.

La división es la misma en todos los formularios: un componente de presentación (`.jsx`), un archivo de funciones puras con las reglas y los mensajes (`*.utils.js`, que se prueba por separado), el hook compartido `useFormulario` que gestiona valores, errores, foco y envío, y las llamadas al servidor, que pasan siempre por `@/lib/api/*` o `@/lib/http/*` y nunca directamente por Supabase.

### 5. Código de los formularios.

El texto completo de los diez archivos de la Tabla 2 se entrega en el archivo de anexos; aquí se reproducen tres fragmentos sin modificar.

La primitiva `Field` genera los identificadores, compone el texto de ayuda, el error y el estado «Válido», y los enlaza con el control mediante `aria-describedby`.

:::codigo etiqueta="Código JavaScript." archivo="/tmp/claude-0/-home-user-susan/40436e6d-ab3e-5c65-9b75-f6742b8df0d9/scratchpad/susan-main/reporte/form/codigo/Field.jsx" lineas="36-74"

La lógica de pasos del asistente de alta de alumno define cuáles campos valida cada paso y declara los pasos de captura; la revisión y el éxito los aporta `ui/Asistente`.

:::codigo etiqueta="Código JavaScript." archivo="/tmp/claude-0/-home-user-susan/40436e6d-ab3e-5c65-9b75-f6742b8df0d9/scratchpad/susan-main/reporte/form/codigo/AltaAlumno.jsx" lineas="102-150"

Las reglas de validación del alumno, con los mensajes reales en español, y la función que arma el payload ya normalizado se mantienen en un archivo de funciones puras.

:::codigo etiqueta="Código JavaScript." archivo="/tmp/claude-0/-home-user-susan/40436e6d-ab3e-5c65-9b75-f6742b8df0d9/scratchpad/susan-main/reporte/form/codigo/alumnoForm.utils.js" lineas="42-76"

### 6. Estado de verificación.

Las pruebas automáticas se ejecutaron con `npx vitest run` sobre las carpetas de formularios y de primitivas (`auth`, `admin`, `alumno`, `ui`, `hooks/ui`, `lib/formularios`, `sesion/RegistroManualDialog`, `revision`, `tecnico`, `reportes` y `analitica/SelectorGrupo`). El resultado fue de **176 archivos de prueba y 2008 pruebas, de las cuales 2007 pasaron y 1 falló**, en 123 s con el servidor de desarrollo y Playwright corriendo a la vez. La prueba que falló es la de `DeteccionRostros.test.jsx` («carga el detector, dibuja un recuadro por rostro y avisa cuántos ve»: esperaba el estado `listo` y recibió `cargando`), un temporizado ajeno a los formularios; al repetirla sola (`npx vitest run src/components/ui/DeteccionRostros`) pasaron 2 archivos y 19 pruebas. `docs/design/formularios/PRIMITIVAS-campos.md` registra el mismo caso. Todos los formularios tienen archivo de prueba propio, salvo `ConsolaTecnico`, que solo compone pestañas, y `ParametroFila` y `CampoNumerico`, que tienen únicamente la prueba de sus utilidades.

Las 114 capturas se revisaron una por una con la herramienta de lectura; se repitieron las que salieron mal (estado persistente de un error previo, formularios cortados por la ventana, sesión sin hidratar). Muestran los estados vacío, con errores, válido y de éxito de la mayoría de los formularios, la revisión previa a crear en los asistentes y cinco pantallas móviles.

Lo que **no** queda cubierto es lo siguiente:

- No se corrió la suite completa (`web/src` tiene 296 archivos `*.test.*`), ni `npm run lint` ni `npm run build`.
- El registro facial completo no se capturó: Chromium no tiene cámara real y el reconocimiento usó el embedder `fake`; se llegó hasta la pantalla de toma.
- No se ejecutaron el pase de lista manual ni el cierre de sesión, y no se confirmaron la importación CSV, el guardado de parámetros, el estatus de cámaras ni la reconstrucción del índice, para no alterar los datos de demostración.
- Todas las capturas son en tema claro (la interfaz no tiene interruptor de modo oscuro), y el aviso de Bloq Mayús y la protección `beforeunload` solo tienen pruebas de componente, no se ejercitaron en navegador.
- El diseño no se cotejó pantalla por pantalla contra las pantallas P-01 a P-09 de `docs/spec/Avance1.txt`.
- Las capturas con éxito ejecutaron operaciones reales contra la base local; quedó un residuo en la bitácora de solo anexar (una cuenta de prueba desactivada y su alumno), por lo que los conteos de la base ya no coinciden con los de la semilla.
