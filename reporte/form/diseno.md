# Diseño de los formularios de SUSAN

Destilado de `docs/design/formularios/` (`BRIEF-COMUN-FRENTES.md`, `PRIMITIVAS-campos.md`, `PRIMITIVAS-contenedores.md`, `referencias-campos-y-validacion.md`, `referencias-flujos-guiados.md`, `auditoria.md`,
`FRENTE-F2` a `FRENTE-F6`) y de `docs/design/SISTEMA.md`, contrastado con el código de `web/src/components/ui/`, `web/src/hooks/ui/` y `web/src/lib/formularios/` (commit `f742bb4`).
Todo lo que sigue está en esos archivos; donde el documento y el código difieren se dice. Las capturas citadas están en `reporte/figuras/forms/` (índice en `INDICE.md` de esa carpeta).

## 1. Punto de partida y dirección

- La auditoría del 2026-10-06 (`auditoria.md` §1) encontró en los formularios de entonces: validación solo al enviar; ningún aviso de «cambios sin guardar»; selects nativos de hasta 200 opciones; límites de la base sin declarar en los campos (solo 3 campos con `maxLength`);
  una discrepancia real cliente-servidor (créditos de 0 a 99 contra `creditos > 0` en la base); altas en dos llamadas con fallo parcial que decían «No se pudo guardar» aunque el registro ya existía; errores duplicados (alerta y toast); flujos que terminaban sin «siguiente paso»; la misma barra de búsqueda copiada en tres listados.
- La dirección está en `SISTEMA.md` («Formularios»): **todo formulario o captura de datos es guiado y dinámico**, con patrones tomados de Mobbin; el rediseño es solo capa de presentación y validación de conveniencia: no cambia RPC, rutas, payloads ni códigos de error (el servidor sigue siendo la validación real).
- Se construyeron primero las primitivas (campos y contenedores) y después cinco frentes de pantallas (F2 acceso y consola, F3 alumnos, F4 catálogos, F5 grupos, F6 justificantes y pase manual) que las usan.

## 2. Anatomía de un campo (`ui/Field`)

`Field` envuelve a un único control y lo conecta con su texto (`id`, `aria-describedby`, `aria-invalid`, `required`). De arriba abajo:

1. **Etiqueta** (`text-sm font-medium`). Lo obligatorio lleva `*` rojo (`aria-hidden`, el control recibe `required`); lo opcional se rotula con la palabra «(opcional)» (convención del producto: no se mezclan las dos marcas; con `required` el prop `optional` se ignora). A la derecha de la etiqueta puede ir una acción (`labelAction`, p. ej. «¿Olvidaste tu contraseña?» o «Usar 2026-2»).
2. **Control** (`ui/Input` y hermanos): alto mínimo 40 px, `rounded-md` (8 px), borde `border-input`, fondo `bg-card`, texto 14 px. Adornos opcionales: icono de inicio, X para limpiar, contador «n/max» dentro del campo, palomita de válido.
3. **Ayuda** (`text-xs text-muted-foreground`) con un **ejemplo** al final («Hasta 10 letras o dígitos, sin espacios ni guiones. Ej. E260099»; prop `example`).
4. **Error**: icono Lucide `CircleAlert` + texto `text-sm text-destructive`, `role="alert"`, y borde rojo en el control (borde + icono + texto: el color nunca es la única señal).
5. **Válido**: palomita Lucide + «Válido» (`text-presente`, `role="status"`), solo en datos que la persona no puede comprobar a ojo (matrícula, correo, periodo, clave) y nunca en texto libre; se oculta si hay error.
6. **Contador** `n/max` a la derecha; aparece al llegar a una fracción del máximo (por omisión 80 %, `desde: 0.8`); en rojo si se excede; a lectores de pantalla solo se anuncia el límite alcanzado, no cada tecla.
7. **Reserva de altura** (`reserveError`): el formulario no «salta» cuando aparece el mensaje; se activa en formularios con validación al salir del campo.

Grupos de controles (segmentado, tarjetas, rango de fechas) usan `Field as="fieldset"`: la etiqueta pasa a `<legend>`, el hijo no se clona y la ayuda y el error cuelgan del `<fieldset>`.
Un hijo que pinta sus propios mensajes (`CampoPassword`, marca `recibeMensajes`) los coloca justo bajo su caja. Código: `reporte/form/codigo/Field.jsx`. Capturas: `f13` y `f15` (alta de alumno con errores y con matrícula válida) y `f01` a `f05` (login).

## 3. Reglas de texto: etiqueta, ayuda y error

(`referencias-campos-y-validacion.md` §2 y §4; `auditoria.md`; `FRENTE-F3`/`F4`)

- **Etiqueta**: sustantivo corto sin dos puntos («Matrícula», «Correo institucional», «Hora de inicio»); nombre legible en lugar de la clave técnica («Umbral de similitud» con la clave `umbral_similitud` en mono debajo, en la consola técnica).
- **Ayuda**: dice el formato y da un ejemplo; lo largo va dentro de un plegable (`ui/Detalles`), no en párrafos repetidos por fila.
- **Error**: dice **qué se espera y cómo arreglarlo**, no «valor inválido» (anti-patrón A10). Ejemplos reales del código: `Al correo le falta la @. Ejemplo: nombre@unach.mx`, `Escribe el dominio después de la @. …`, `Usa hasta 10 letras, dígitos o guiones, por ejemplo A-12.`,
  `Escribe los créditos: un número entero de 1 a 99 (no puede ser 0).`, `La hora de fin debe ser posterior a la de inicio.`, `Aún no cumple: al menos 10 caracteres.`
- **Un solo aviso por error** y pegado al campo que lo causó: los códigos del servidor (`DUPLICADO`, `HORARIO_CHOQUE`, `AULA_CAPACIDAD_INSUFICIENTE`, `DOCENTE_NO_ACTIVO`…) se convierten con `mapearError` en un mensaje bajo su campo, con el foco en él; lo que no pertenece a un campo sale una vez junto a los botones («No se pudo guardar»). Nunca alerta más toast. Los toasts quedan para éxitos breves.
- **Mensajes del servidor con consecuencia**: un fallo parcial se dice tal cual («El alumno se creó, pero su cuenta de acceso no»; «El grupo ZZ1 ya se creó, pero su horario no se guardó… no se creará otro grupo»).
- **Normalización visible**: la matrícula, las claves y el número de empleado pasan a mayúsculas y el correo a minúsculas **al salir del campo** (`transform`), y se repite al armar el payload; mientras se escribe no se toca el texto.
- **Límites reales de la base** en `lib/formularios/limites.js` (`LIMITES`: matrícula 10, nombres 60, apellidos 40, correo 120, clave de grupo 8, periodo 6, clave de materia 8, nombre de materia 80, clave de aula 10, edificio 40) y `PATRONES`; una prueba compara cada `varchar(N)` con el DDL (`0003_tablas_academico.sql`).

## 4. Cuándo se valida

(`useFormulario`, `hooks/ui/useFormulario.js`; `PRIMITIVAS-contenedores.md` §2.1)

- **Primer error al salir del campo (blur) o al enviar**, nunca mientras se escribe por primera vez (anti-patrón A11); con un error visible se **revalida en cada tecla** y desaparece al corregir.
- **Enviar con datos inválidos** no llama al servidor: marca todos los errores, muestra «Revisa los campos marcados» y **enfoca el primer campo inválido** en orden de pantalla (incluye `Combobox` y `SegmentedControl`; salta lo deshabilitado u oculto).
- **El botón de alta no se apaga por datos inválidos** (patrón P10): el clic enseña los errores. Solo se apaga en edición sin cambios y **dice por qué** junto al botón (`motivoBloqueo`: «Aún no hay cambios que guardar.»).
- **Tras un error del servidor se conserva todo lo capturado** (anti-patrón A13); en el login el foco vuelve a la contraseña con el texto seleccionado.
- Mientras envía, los campos quedan `readOnly` (no `disabled`) para no perder el foco que el hook mueve al campo con error del servidor.
- Comprobaciones remotas (matrícula repetida) con «Comprobando si ya existe…» tras 400 ms de pausa, solo con formato válido; el resultado sale bajo el campo («Matrícula disponible» / «Esta matrícula ya está registrada» con enlace a la ficha).
- La validación del cliente es de conveniencia; la regla real es la del servidor (RPC y zod). API del hook en la sección 11. Código: `reporte/form/codigo/useFormulario.js`, `alumnoForm.utils.js`, `login.utils.js`, `registrarJustificante.utils.js`.

## 5. Pasos guiados y «siguiente paso»

- **Qué contenedor** (`PRIMITIVAS-contenedores.md` §1): un paso con hasta unos 6 campos y sin dependencias → `PanelLateral` (aula, materia, docente, cuenta, cámara); una o tres preguntas cortas o una confirmación → `Modal`/`ConfirmDialog`; datos con dependencias, más de unos 6 campos o que conviene revisar antes de crear (alumno, grupo) → `Asistente` en página;
  flujo guiado por los datos de un archivo (importar CSV) → `Modal` con `Stepper`; editar el registro que ya se ve → página con `FormSection` + `FormActions`. Regla de oro: **un asistente para dos o tres campos es un anti-patrón** (por eso el justificante son tres bloques numerados dentro de una tarjeta y no un asistente) y **nunca un modal sobre un modal** salvo la confirmación de descarte.
- **`ui/Asistente`**: `Stepper` arriba (barra segmentada compacta en teléfono: «Paso 2 de 3 · Contacto y acceso»), un `<form>` por paso (Enter avanza), «Atrás» sin validar, «Siguiente» que valida el paso y, si falla, muestra «Revisa este paso antes de continuar» con la lista de errores y enfoca el primero; pasos opcionales con «Omitir por ahora».
  Último paso = **Revisión** con una tarjeta por sección y «Editar <sección>» que vuelve a ese paso (el botón pasa a «Volver a la revisión»); resumen vivo a la derecha solo en pantallas anchas; el botón final es **verbo + objeto** («Crear alumno», «Crear grupo»), nunca «Siguiente» ni «Aceptar».
  Capturas: `f12` a `f20` (alta de alumno) y `f45` a `f52` (alta de grupo).
- **Al terminar, nunca volver a la lista en silencio**: `ui/SuccessState` con título («Alumno creado») y **2 a 4 siguientes pasos** reales, con el más probable marcado «Recomendado» (alumno → registrar consentimiento, plantilla facial, inscribirlo, crear su cuenta; grupo → generar sesiones o armar el horario, inscribir alumnos, configurar la cámara; aula → crear un grupo en esa aula; docente → crear su cuenta; materia → crear un grupo con esa materia; justificante → justificar otra falta / ver mis justificantes) y 1 a 3 salidas cortas («Ir a la ficha», «Crear otro…», «Ir a la lista»).
- **Preselección por enlace**: los éxitos de materia y aula enlazan a `/admin/grupos/nuevo?materia=<id>` y `?aula=<id>` y el asistente abre con esa elección hecha y el foco en el siguiente campo.
- **Datos derivados**: periodo sugerido por la fecha del plantel (`api_ahora`), vigencia del consentimiento +1 año, fin de franja = inicio + 1 h, correo de la cuenta tomado del vínculo, cuenta atrás de 60 s para reenviar el enlace, vista previa «Generar N sesiones».

## 6. Cambios sin guardar y descarte

- `FormActions` muestra «Cambios sin guardar», «1 cambio sin guardar» o «N cambios sin guardar» (punto de color **y** texto) y, si el botón está apagado, el motivo con icono `Info`. La zona es una región `aria-live="polite"` que existe siempre.
- `useCambiosSinGuardar(sucio)` registra `beforeunload` (recargar o cerrar) y expone `confirmarSalida` (para `Tabs confirmLeave`, como en la consola técnica y el detalle del grupo) y `alNavegar` para enlaces; mensaje: «Tienes cambios sin guardar. Si sales ahora, se perderán.» El botón «atrás» del navegador no se puede interceptar en el App Router.
- `Modal` y `PanelLateral` con `dirty` piden confirmar al cerrar (Esc, clic en el fondo, X o «Cancelar»): «¿Descartar los cambios?» / «Hay cambios sin guardar. Si sales ahora, se perderán.» con «Seguir editando» (con el foco) y «Descartar cambios». Los asistentes preguntan «¿Salir sin guardar?».
- «Descartar» (`reiniciar`) devuelve el formulario a lo guardado; tras un guardado exitoso, lo enviado pasa a ser «lo guardado» y ya no se pregunta al salir.

## 7. Panel lateral, modal, asistente y página (anchos y comportamiento)

| Contenedor | Comportamiento |
|---|---|
| `PanelLateral` | Entra por la derecha en escritorio con tres anchos (`sm` 28 rem, `md` 32 rem por omisión, `lg` 42 rem) y es **pantalla completa en teléfono**; cuerpo con scroll propio, pie fijo con `FormActions flat`; foco inicial en el primer campo, foco atrapado y devuelto; se dibuja en un portal a `document.body`. Capturas: `f28` a `f42` (aula, materia, docente y cuenta) y `f59` a `f63` (cámara). |
| `Modal` | Centrado; `size="full-mobile"` lo pasa a pantalla completa por debajo de 640 px (pie fijo, área segura); X visible con `showClose`; `closeDisabled` mientras guarda. |
| `Asistente` | En página; acciones pegadas al pie en teléfono (`sticky="movil"`) y en un contenedor adopta su cierre. |
| `FormSection` | `<fieldset>` + `<legend>`; columnas **según el ancho del contenedor** (container queries `@md` = 28 rem y `@2xl` = 42 rem): en 360 px siempre una; opcional plegable con `summary`, y marca «Revisar» que abre la sección si hay error. |
| `FormActions` | `sticky="movil"` (por omisión): por debajo de `lg` se pega al pie sobre la barra inferior de navegación (offset `5.25rem` + área segura); desde `lg` es una fila normal; `stacked` apila estado y botones en pies estrechos. |

## 8. Móvil y 360 px

- Regla de proyecto: toda pantalla nueva se ve bien a 360 px, sin desborde horizontal y respeta «reducir movimiento» (`CLAUDE.md`).
- `Stepper` por debajo de 640 px se vuelve una barra segmentada con «Paso N de M · título»; `TarjetaOpcion` pasa a una columna; `SegmentedControl fullWidth` reparte el ancho y parte textos largos en vez de salirse; las opciones del `Combobox` miden al menos 44 px y su lista va en un portal acotado a la zona visible (`visualViewport`, que baja con el teclado); `Switch` y filas táctiles de 44 px.
- Tablas largas se vuelven tarjetas por registro en teléfono (alumnos) o esconden columnas secundarias y dejan la acción a la vista (`hideBelow`); las acciones por fila pasan a un solo botón «⋯» (`MenuAcciones`).
- Justificante: en pantallas táctiles (`pointer: coarse`) aparece el botón «Tomar foto» (`capture="environment"`); la zona principal no lleva `capture` porque algunos teléfonos abrirían la cámara y no dejarían elegir un PDF.
- Capturas móviles: `f110` a `f114` (login con errores, alta de alumno pasos 1 y 2, panel de aula a pantalla completa, justificante).

## 9. Tokens, tipografía, color y forma

(`SISTEMA.md` y `web/src/app/globals.css`; nunca colores hex en componentes: solo tokens semánticos de Tailwind)

- **Lienzo y panel**: `bg-background` crema `#F7F5F2`; el contenido va en un panel blanco `bg-card` flotante (margen de 8 px, esquinas de 18 px, borde casi invisible); tarjetas `rounded-xl border border-border bg-card` **sin sombra**; sombra (`--shadow-lift`) solo en menús, diálogos y la ficha del icono.
- **Tinta y texto**: `text-foreground` `#1E1919`, `text-muted-foreground` `#6F6A65`; bordes `border-border` `#E7E2DC`; campos `border-input` `#D8D2CA`.
- **Acción primaria**: botón negro `bg-primary` (`#1E1919`, texto blanco), `rounded-md`; secundario blanco con borde; `Button` admite `arrow`, `loading` y `variant` (`primary`, `secondary`, `ghost`, `danger`).
- **Estados**: error `text-destructive` `#B3261E`; válido y presente `text-presente` `#1F7A47` (fondo `-bg`); retardo y ausente con sus propios tokens; enlaces y foco `--link` / `--ring` `#0061FE`. **Los estados de asistencia siempre llevan texto además de color** (`StatusChip`, `SegmentedControl` con punto de color más texto y palomita al elegir).
- **Tipografía**: toda la interfaz en **Hanken Grotesk** a 14 px (título de página 26 px / 500, sección 20 px / 600); **EB Garamond** (`font-display`) solo en el saludo del Home y los titulares de acceso y onboarding («Inicia sesión», «Crea tu contraseña»); Geist Mono para datos técnicos (contraseña temporal, claves de parámetros).
- **Radios**: campos y botones 8 px (`rounded-md`), tarjetas 14 px, panel y diálogos 18 px, píldora para chips y filtros.
- **Iconos**: siempre Lucide (`lucide-react`, `aria-hidden="true"`, trazo 1.5–1.75); prohibidos el SVG a mano, los emojis y los símbolos de texto como icono.
- **Movimiento**: solo `transform`/`opacity` (con las excepciones documentadas de las gráficas), una vez, y apagado con «reducir movimiento».

## 10. Foco y accesibilidad

- **Foco visible** siempre: regla de proyecto `focus-visible:ring-4 ring-ring/30`; los campos de `Input`/`Select`/`Textarea`/`Combobox` usan `focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/20` (`CONTROL_BASE`, un anillo más tenue que el de los botones). Un campo inválido **conserva el borde rojo con el foco** (`CONTROL_INVALIDO`).
- **Errores y estado**: `role="alert"` en el error del campo, `aria-invalid`, `aria-describedby` encadenando ayuda → error → válido; el estado de `FormActions` y el avance del asistente son regiones `aria-live` («Paso N de M: título»); al cambiar de paso el foco va al título.
- **Etiquetas asociadas**: `Field` etiqueta con `<label for>` o `<legend>`; los grupos son `radiogroup` con una sola parada de tabulador y flechas; el `Combobox` sigue el patrón ARIA 1.2 (`role="combobox"`, `aria-activedescendant`, región de estado con «N opciones disponibles»); `Stepper` es `<nav aria-label="Progreso">` con `aria-current="step"` y el estado de cada paso dicho en texto.
- **Teclado**: Enter en el asistente avanza; en `Combobox` elige y no envía; Esc cierra solo la lista (el segundo cierra el diálogo); los diálogos atrapan el foco y lo devuelven al abridor; pila de diálogos (solo el de arriba atiende Esc y Tab).
- **Nada solo por color**: error = borde + icono + texto; válido = palomita + «Válido»; requisitos de contraseña = icono + texto («cumple» / «falta» para lectores); estados = punto + texto. Las gráficas llevan texto alternativo.
- **Privacidad**: la contraseña temporal se muestra una sola vez en un campo de solo lectura y no se conserva; el aviso de consentimiento facial se acepta con una casilla explícita («Marca la declaración para continuar.»).

## 11. API real de las primitivas (props leídas del código)

| Primitiva | Props principales (valor por omisión) |
|---|---|
| `ui/Field` | `label`, `hint`, `error`, `required`, `optional`, `valid` (booleano o texto), `example`, `counter {actual, max, desde}`, `labelAction`, `reserveError`, `as` (`'div'` o `'fieldset'`), `htmlFor`, `className` |
| `ui/Input` | `type` (`'text'`), `invalid`, `valid`, `startAdornment`, `endAdornment`, `onClear`/`clearLabel`, `showCount` (con `maxLength`), `transform` (`'upper'`, `'lower'`, `'trim'` o función; se aplica al salir), `onBlur` |
| `ui/Textarea` | `rows` (3), `maxRows`, `autoGrow`, `maxLength`, `showCount`, `invalid`, `ref` |
| `ui/Select` | `options`, `groups`, `placeholder`, `invalid` (contenedor con chevron propio) |
| `ui/Checkbox` | `label`, `checked`, `onChange(evento)`, `indeterminate`, `hint`, `error`, `invalid` |
| `ui/Switch` | `checked`, `onChange(boolean)`, `label`, `hint`, `onLabel`/`offLabel` («Activado»/«Desactivado»), `showState` |
| `ui/SegmentedControl` | `items [{value, label, icon, tone, disabled}]`, `value`, `onChange(valor)`, `label`, `size` (`'md'`), `fullWidth`, `name` |
| `ui/Combobox` | `options [{value, label, description, group, disabled, avatar}]` o `loadOptions(q, {signal})` (`debounceMs` 250, `minChars` 2), `value`, `onChange(valor, opcion)`, `selected`, `clearable`, `placeholder`, `emptyText` («Sin resultados»), `invalid`, `onBlur`, `ref`, `autoFocus`, `name` |
| `ui/CampoFecha` | `value`, `onChange(evento)`, `min`, `max`, `atajos` (por omisión «Hoy»), `hoy`, `mostrarTexto` (fecha en palabras bajo el campo) |
| `ui/RangoFechas` | `desde`, `hasta`, `onChange({desde, hasta})`, `min`, `max`, `maxDias`, `atajos`, `label`, `resumen`, `error` |
| `ui/CampoPassword` | `value`, `onChange(evento)`, `reglas` (3 reglas: 10 caracteres, letra, número; `false` las quita), `generar`, `copiar`, `longitudGenerada` (16), `avisoMayusculas`, `autoComplete` |
| `ui/TarjetaOpcion` | `opciones [{value, titulo, descripcion, icono, extra}]`, `value`, `onChange(valor)`, `renderExtra`, `columnas` (2), `invalid`, `required` |
| `ui/FileInput` | `value`, `onSelect(file)`, `accept`, `maxBytes`, `variant` (`'boton'` o `'zona'`), `multiple`, `maxFiles`, `hint`, `progress`, `preview` (`'nombre'` o `'imagen'`), `capture`, `error` |
| `ui/FormActions` | `dirty` (booleano o número), `dirtyText`, `summary`, `motivoBloqueo`, `sticky` (`'movil'`, `'contenedor'`, `false`), `flat`, `align`, `stacked` |
| `ui/FormSection` | `title`, `description`, `optional`, `columns` (1, 2 o 3), `collapsible`, `defaultOpen`, `summary`, `error` |
| `ui/Stepper` | `steps [{id, label, description, estado, disabled}]`, `current`, `onSelect(id)`, `compact`, `label` («Progreso») |
| `ui/SuccessState` | `title`, `description`, `steps [{label, description, href|onClick, icon, recommended, done}]`, `actions [{label, href|onClick, variant}]`, `icon`, `focusOnMount`, `wrap` |
| `ui/Asistente` | `pasos [{id, titulo, descripcion, contenido, opcional}]`, `valores`, `validarPaso(id)`, `resumen(valores)`, `onFinalizar(valores)`, `exito`, `etiquetaFinalizar`, `sucio`, `onCancelar`, `resumenLateral`, `tituloRevision`, `ref.current.irAPaso(id)` |
| `ui/PanelLateral` | `open`, `onClose`, `title`, `description`, `children`, `footer` (nodo o `({cerrar}) => nodo`), `size` (`'md'`), `dirty`, `onDiscard`, `closeDisabled`, `showClose` |
| `ui/Modal` | `open`, `onClose`, `title`, `size` (`'full-mobile'`), `dirty`, `onDiscard`, `closeDisabled`, `showClose`, `footer` |
| `ui/ConfirmDialog` | `open`, `title`, `message`, `confirmLabel`, `cancelLabel`, `variant` (`'primary'`, `'danger'`), `reason {label, required, maxLength}`, `onConfirm(texto)`, `onCancel` |
| `hooks/ui/useFormulario` | entrada `{ inicial, validar(valores), onSubmit(valores), validarAlSalir (true), mapearError(error) }`; salida `valores, setCampo, campo(nombre) → {name, value, onChange, onBlur, invalid, error, props}, errores, sucio, cambios, valido, primerError, enviando, errorEnvio, enviar, reiniciar, tocar, validarCampos, erroresDe, fijarErrores` |
| `hooks/ui/useCambiosSinGuardar` | `useCambiosSinGuardar(sucio, {mensaje})`; exports `confirmarNavegacion`, `alNavegarProtegido`, `hayCambiosSinGuardar`, `MENSAJE_CAMBIOS` |

`onChange` recibe el **evento** en los controles de texto (`Input`, `Textarea`, `Select`, `Checkbox`, `CampoPassword`, `CampoFecha`) y el **valor** en las elecciones (`Combobox`, `SegmentedControl`, `TarjetaOpcion`, `Switch`, `RangoFechas`); `useFormulario` acepta ambos. Cada control necesita un `name` único para el foco al primer error.

## 12. Referencias de diseño y anti-patrones que se evitaron

Las referencias son capturas de Mobbin (R01–R18 en `referencias-campos-y-validacion.md`, con URL) de productos como Shopify, Stripe, Klaviyo, Square, Customer.io, DoorDash, Dropbox, Zillow y fal; de ellas salieron 12 patrones (P1 `Field` con validación al salir, P2 barra de acciones con «N cambios sin guardar» y motivo del bloqueo, P3 selector con búsqueda y dos líneas,
P4 zona de archivos, P5 importación en pasos, P6 segmentados, P7 tarjetas de opción, P8 horario semanal por franjas, P9 fechas con atajos, P10 contraseña con reglas en vivo, P11 «Probar conexión», P12 confirmación destructiva) y 14 anti-patrones (A01 error lejos del campo, A02 botón apagado sin motivo, A03 resultado solo en un toast, A05 candados en opciones no disponibles,
A06 doble campo de contraseña, A07 mezclar asteriscos y «(opcional)», A08 estado solo por color, A09 bloquear por una advertencia, A10 mensajes genéricos, A11 validar mientras se escribe, A12 selects largos y modal sobre modal, A13 limpiar tras un error, A14 importaciones silenciosas). Para qué referencia respalda cada pieza ver `PRIMITIVAS-campos.md` y `PRIMITIVAS-contenedores.md`.

## 13. Lo que no se pudo verificar

- Las capturas de `reporte/figuras/forms/` se tomaron en Chromium sin cámara real: el asistente de registro facial llega hasta la pantalla de toma («No vemos tu rostro. Colócalo dentro del círculo.») y no se completa.
- La detección del aviso de Bloq Mayús y la protección `beforeunload` solo tienen pruebas de componente (lo reconoce `FRENTE-F2`); no se ejercitaron en navegador aquí.
- `BRIEF-COMUN-FRENTES.md` exige revisar claro y oscuro y `FRENTE-F2` dice haberlo hecho con `.dark`; las capturas de este reporte son todas en tema claro (el modo oscuro «no tiene interruptor todavía», `SISTEMA.md`).
- No se cotejó el diseño contra `docs/spec/Avance1.txt` pantalla por pantalla (P-01 a P-09).
