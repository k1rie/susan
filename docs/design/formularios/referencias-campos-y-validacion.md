# Referencias de campos, validación y formularios guiados (Mobbin)

Investigación de UX para el rediseño de los formularios de captura de SUSAN (alumno, grupo, aula, materia, docente,
usuario con contraseña temporal, cámara, horario semanal, inscripción, importar CSV, justificante, filtros de reportes).
Fecha de la investigación: 2026-10-06. Fuente: Mobbin (plataforma Web), 18 referencias revisadas pantalla por pantalla.

Cómo leer este documento:

- Las URL tienen la forma `https://mobbin.com/screens/<id>` y requieren la sesión de Mobbin del equipo.
- Todo lo descrito está redactado con palabras propias a partir de lo que se ve en cada pantalla. Mobbin muestra
  capturas estáticas: el momento exacto en que aparece un error (al salir del campo, al enviar) no es observable, así
  que las reglas de **tiempo de validación** de la sección 2 son recomendación nuestra apoyada en el patrón visual.
- Cómo reproducir la búsqueda (útil para ampliar): `https://mobbin.com/search/apps/web?content_type=screens&sort=trending&text_in_screenshot=<texto>`
  (busca texto dentro de las capturas; probado con "Unsaved changes", "Test connection", "cannot be undone",
  "Generate password", "Invalid", "already exists", "valid email") y
  `https://mobbin.com/search/apps/web?content_type=ui-elements&sort=trending&filter=screenElements.<Elemento>`
  (probado con Combobox, Segmented Control, Date Picker, File Upload, Radio Button, Checkbox, Text Field, Accordion).
- Base actual de SUSAN a la que se refiere el texto: `ui/Field` (etiqueta, hint, error, `aria-describedby`),
  `ui/Select` (nativo), `ui/FileInput` (botón + validación de tipo y tamaño), `ui/ConfirmDialog`, `ui/Pills` (filtros con
  `aria-pressed`), `ui/Modal`, `ui/Toast`, `ui/Alert`.

---

## 1. Referencias

### Barra de acciones, cambios sin guardar y estructura del formulario

**R01. Shopify · Añadir producto (formulario largo con panel lateral)**
- URL: https://mobbin.com/screens/c5d11f2a-5534-41a1-9195-ed5ab17353e4 (variante editando: https://mobbin.com/screens/e663f41f-04c7-423f-8dbc-38ee9cf7fdd9)
- Patrón: una barra oscura fija en el encabezado dice «cambios sin guardar» con dos botones, Descartar (secundario) y
  Guardar (resaltado); aparece solo cuando el formulario está sucio. Cada campo lleva su explicación en una línea gris
  debajo (por qué importa el dato). El campo Categoría muestra la etiqueta «1 autocompletado» arriba a la derecha para
  decir que el sistema lo sugirió, y se puede cambiar. Los campos poco usados (precio de comparación, costo por
  artículo) viven como chips plegados bajo el precio y se despliegan al tocarlos. Las colecciones y etiquetas usan un
  campo con chips y un «+» para agregar.
- Aplica a: edición de alumno, grupo, materia y docente (barra de cambios sin guardar); «correo institucional» y «clave
  de grupo» con etiqueta «Autocompletado»; campos opcionales (segundo apellido, observaciones, teléfono) plegados como chips.

**R02. Combobox con búsqueda: Shopify (categorías), fal (operaciones), Dropbox Dash (adjuntar desde apps)**
- URL: Shopify https://mobbin.com/screens/e663f41f-04c7-423f-8dbc-38ee9cf7fdd9 · fal https://mobbin.com/screens/6dbe3a35-0092-4154-8b3f-86f1b4de6a5f · Dropbox https://mobbin.com/screens/4e91bfac-5d41-4465-8787-e66138361ac5
- Patrón: el desplegable abre con un cuadro de búsqueda arriba. En Shopify la lista es jerárquica: una fila «Volver a …»
  deja subir de nivel y la rama actual queda resaltada. En fal hay chips de tipo (Imagen, Video, Audio, 3D) como filtro
  rápido y un pie con atajos de teclado (flechas para moverse, Enter para elegir, Esc para cerrar). En Dropbox cada
  resultado tiene dos líneas (nombre y origen con fecha) más una acción fija al final del menú («Subir archivos»).
- Aplica a: materia, docente y aula en el formulario de grupo; inscribir alumno por matrícula o nombre (línea 1 nombre,
  línea 2 matrícula y grupo actual); pie de atajos para operadores que capturan con teclado; chips de filtro dentro del
  menú (por carrera o turno).

**R03. fal · Nuevo personaje (drawer lateral) y Square · formulario de proveedor (modal a pantalla casi completa)**
- URL: fal https://mobbin.com/screens/531b79e1-e46c-43ed-96d3-87ece02652bf · Square https://mobbin.com/screens/8d532129-4d8c-4920-949b-5892cc13fd8d
- Patrón fal: drawer a la derecha con título y X, contenido con scroll y **pie fijo** (Cancelar como texto a la izquierda,
  botón negro «Crear personaje» a la derecha; el verbo incluye el sustantivo). Dos campos en fila: Nombre e Identificador,
  donde el identificador se deriva del nombre (alex_smith) con una pista bajo el campo que explica para qué sirve.
  Textos de ayuda breves bajo el campo («Obligatorio. Descripción visual funciona mejor»), contador «1/20» en la zona de
  imágenes y un botón «Generar a partir de imágenes» que rellena el campo con una sugerencia.
  Patrón Square: formulario largo dividido por **encabezados de sección** (Proveedor, Contacto, Dirección (opcional)) en
  una sola columna estrecha; campos pareados en fila (teléfono con correo, estado con código postal); etiqueta flotante
  dentro del campo; X para limpiar un campo ya llenado; Guardar arriba a la derecha y cerrar arriba a la izquierda.
- Aplica a: crear alumno, docente, aula, materia en drawer (estilo fal) para no perder el contexto de la lista; formularios
  largos (grupo con horario) a pantalla casi completa (estilo Square). Marcar «(opcional)» en el encabezado de la
  sección y no un asterisco por campo.

### Contraseña, errores en línea y credenciales

**R04. Contraseña: DoorDash Merchant, Square y Squarespace (tres niveles de guía)**
- URL: DoorDash https://mobbin.com/screens/1ebb60ae-bd50-4792-a6ca-48d5672573a5 · Square https://mobbin.com/screens/4646d8d0-88b9-40df-8691-9d1a999619a5 · Squarespace https://mobbin.com/screens/01dcf99e-d3d8-46cd-9538-a72d26071a6e
- Patrón DoorDash: botón «Mostrar» dentro del campo y, debajo, una **lista de 4 reglas** que cambian en vivo de
  círculo gris con X a círculo verde con palomita (no contiene tu usuario de correo, no empieza ni termina con espacio,
  mínimo 10 caracteres, mayúscula, minúscula y símbolo). Cada regla es texto, no solo color.
  Patrón Square: ojo para mostrar y una sola regla («al menos 8 caracteres») con palomita que aparece bajo el campo.
  Patrón Squarespace: campos de solo línea inferior con etiqueta en versalitas; tras escribir aparece una etiqueta
  verde «Contraseña segura» con un icono de ayuda, y el aviso «ya existe una cuenta con este correo» queda pegado debajo
  del campo de correo, en color de error y sin caja.
  Nota: DoorDash también muestra el prefijo de país en el teléfono (selector +1) con pista «lo usamos para verificar tu
  cuenta», y el correo ya llenado y bloqueado con la pista «contacta a tu ejecutivo si necesitas otro correo».
- Aplica a: usuario con contraseña temporal (lista de reglas con palomitas; generador y copiar, ver regla 10); campo de
  correo derivado de la matrícula bloqueado con motivo; teléfono con prefijo.

**R05. Customer.io · Crear espacio de trabajo (tarjetas de opción con campo anidado y error espejado en la barra)**
- URL: https://mobbin.com/screens/0e779251-ec5c-4d95-86fc-585da96bca45
- Patrón: tres tarjetas seleccionables en fila (enviar normal, probar entrega, no enviar). La elegida lleva borde azul
  y **revela dentro de sí** un campo de correo. Ese campo muestra borde rojo, marcador de ejemplo en gris con
  «(no puede estar vacío)» y la etiqueta de error pegada debajo. El **mismo mensaje se repite en la barra inferior fija**,
  donde «Guardar cambios» queda deshabilitado y «Descartar cambios» sigue como enlace. Además hay un interruptor Sí/No con
  ayuda, un selector de color con el código hex visible y una tabla de accesos con interruptor por fila y «Deshabilitar todo».
- Aplica a: elegir tipo de usuario/rol, tipo de cámara (IP, USB, simulada) o tipo de justificante con tarjetas, mostrando
  el campo que depende de la opción dentro de la tarjeta; barra fija que explica por qué no se puede guardar.

**R06. Zendesk (registro paso 1 de 9) y Miro (inicio de sesión): estilos de error en el campo**
- URL: Zendesk https://mobbin.com/screens/15715099-d856-4a9f-9650-727037f9523d · Miro https://mobbin.com/screens/3d374575-e168-48a6-8cf7-bd1796ceb653
- Patrón: campo con borde rojo, icono de alerta (dentro del campo en Miro, a la izquierda del mensaje en Zendesk) y texto
  rojo corto debajo; en ambos el error no depende solo del color. Zendesk muestra una barra de progreso con «Paso 1 de 9»,
  un solo campo por paso y la pista «o presiona Enter» junto al botón principal. Miro agrega un bloque de ayuda gris
  («¿Problemas para entrar?») con las salidas alternativas bajo el formulario.
  En el fondo de Zendesk se ve además un panel de ticket con campos de persona (solicitante, asignado) con avatar, un
  enlace «tomarlo» y seguidores como chips con avatar y «+2 más».
- Aplica a: cualquier campo con error (borde + icono + texto), pistas de teclado, y selectores de persona con avatar
  (docente responsable, alumno a inscribir) con atajo «asignarme».

### Fecha, hora y horario

**R07. Calendly · Disponibilidad, horas semanales y fechas específicas**
- URL: https://mobbin.com/screens/3f9991d6-756e-4c76-89cf-deb95c8079b8 (vista de reserva con días y horarios: https://mobbin.com/screens/254dc09b-8dd5-4057-a1e6-261900b61f18)
- Patrón: una fila por día de la semana con un círculo con la inicial; si el día no tiene horario dice «No disponible» con
  un «+» para agregar. Cada franja son dos botones de hora (inicio y fin), una X para quitarla, un «+» para sumar otra
  franja ese día y un icono de **copiar** para pasar las mismas horas a otros días. Al pie, la zona horaria como enlace
  editable. A la derecha, un bloque «Horas por fecha» para excepciones puntuales. Un conmutador Lista/Calendario cambia
  la vista del mismo dato. La vista de reserva marca los días con cupo en color y atenúa los demás, y la hora elegida
  muestra el botón «Siguiente» sobre la misma fila.
- Aplica a: editor de horario semanal del grupo (días, franjas, copiar a otros días, excepciones por fecha para
  suspensiones y feriados), vista Lista/Rejilla; marcar con color solo los días con clase.

**R08. Sweatpals · Fecha y hora (drawer con tarjetas, segmentos y días)**
- URL: https://mobbin.com/screens/756ab6a0-6724-4b94-9ef8-4b700d7a937a
- Patrón: arriba dos tarjetas seleccionables con icono y subtítulo («Una vez» / «Recurrente»). Siguen fecha y hora de
  inicio y fin como botones compactos junto a la zona horaria. La frecuencia es un **control segmentado** (Diario,
  Semanal, Mensual) seguido de «cada [1] semana». «Se repite en» son chips de dos letras por día (Do Lu Ma…) que se
  encienden. «Repetir hasta» es otro segmentado (Siempre / Fecha concreta) que muestra la fecha solo si se elige. El
  botón Guardar es fijo al pie del drawer.
- Aplica a: sesiones de clase recurrentes del grupo (días como chips, «hasta» el fin del periodo); segmentados en lugar de
  selects para tipo de sesión y frecuencia.

**R09. Selectores de rango de fechas: Shopify, fal y Canny**
- URL: Shopify https://mobbin.com/screens/bd05437f-c66e-4e9b-a77c-340a7f961531 · fal https://mobbin.com/screens/477a1c96-8fc1-4586-8ca8-d230c68ecfd5 · Canny https://mobbin.com/screens/2c6d0181-b6d6-43ae-bea8-ec078468c69e
- Patrón Shopify: riel izquierdo con atajos (Hoy, Ayer, Últimos N, Periodo hasta hoy, temporadas, Rango personalizado); en
  «Últimos» hay un campo numérico, un selector de unidad y la casilla «incluir hoy»; dos meses lado a lado con el rango
  sombreado; en el pie, el rango elegido escrito en texto y Cancelar / Aplicar (Aplicar deshabilitado si no hubo cambio).
  fal agrega una **entrada rápida por texto** («escribe un valor y presiona Enter», ejemplo `4d`), la zona horaria a la
  vista, campos de fecha y hora de inicio y fin editables y «Aplicar» con el símbolo de Enter. Canny muestra atajos de
  periodo (este mes, mes pasado) y los atajos no disponibles con candado.
- Aplica a: filtros de reportes (periodo, semana, rango personalizado) con atajos «Hoy, Esta semana, Este parcial,
  Todo el periodo», entrada rápida por texto, resumen del rango en el pie; fecha de justificante (desde/hasta).

### Archivos, CSV y vista previa

**R10. Shopify · Importar clientes por CSV y Klaviyo · Importar plantilla**
- URL: Shopify https://mobbin.com/screens/d59f1540-6eb8-4a43-a331-625bb58defe4 · Klaviyo https://mobbin.com/screens/47b0fd4d-e311-472e-93a9-c6fb0d2c2c9c
- Patrón Shopify: modal corto con una zona punteada, botón «Agregar archivos» y la leyenda del tipo aceptado (.csv); en el
  pie, a la izquierda, enlace «Descargar un CSV de muestra» y a la derecha Cancelar y el botón principal deshabilitado
  hasta que haya archivo.
  Patrón Klaviyo: tras elegir el archivo, la zona muestra el nombre con una X para quitarlo; el campo «Nombre de plantilla»
  aparece ya relleno con un nombre muy cercano al del archivo (capturas estáticas: no se ve si lo derivó el sistema); hay un conmutador Subir archivo / Pegar HTML; una nota azul advierte por
  adelantado de un requisito del archivo; una segunda zona de archivos está rotulada «Opcional»; un **banner rojo
  arriba del modal** describe el error encontrado en el contenido y se puede cerrar.
- Aplica a: importar alumnos o inscripciones por CSV: plantilla descargable, tipo y tamaño visibles antes de elegir,
  nombre del lote sugerido a partir del archivo, errores de archivo en banner y errores de fila en la vista previa (R11).

**R11. Resultados de importación: Square y Shopify**
- URL: Square https://mobbin.com/screens/a5bd7016-7437-4c36-af4a-6449d1911371 · Shopify https://mobbin.com/screens/16fc3a9e-faeb-4ae3-8bec-59851031656d
- Patrón Square: pantalla de resultado con titular de conteo («10 clientes no se importaron»), una frase que explica el
  archivo de errores, botón «Descargar archivo de errores», una vista previa de errores **agrupada por causa** (el texto
  del error y un rango de filas «Filas 2-11») y «Importar de nuevo» arriba.
  Patrón Shopify: resumen en filas (importados con éxito, fallidos, duplicados omitidos, etiqueta aplicada); la fila de
  fallidos se expande y lista la causa con el número de línea; texto previo que avisa que la importación sobrescribe a
  quien coincida por correo o teléfono; botones Cerrar y «Ver segmento».
- Aplica a: resumen de importación de alumnos (importados, con error, duplicados por matrícula), errores agrupados por
  motivo y por rango de filas, descarga del CSV con errores, aviso de política de duplicados antes de confirmar.

**R12. Dropzones con reglas visibles y vista previa: DoorDash Merchant, Higgsfield, fal (campo de URL con ayuda)**
- URL: DoorDash https://mobbin.com/screens/4079bc94-0f22-49b5-a052-1e514269e49f · Higgsfield https://mobbin.com/screens/692a00a8-eb08-4315-8f53-afbeb1444633 · fal https://mobbin.com/screens/7e5016b9-b632-47f8-a184-d52d8586cdd0 · Dropbox Dash (foto de cuenta) https://mobbin.com/screens/685afeee-7ed8-4a32-a734-fa7d25310835
- Patrón: la zona de arrastre dice en la misma pieza «arrastra y suelta, o» + botón «Seleccionar archivo», y debajo los
  **tipos aceptados y la resolución mínima** (DoorDash) o el peso máximo (Higgsfield, 10 MB). Un enlace a las guías va
  en el pie. fal junta tres entradas en un solo campo: pegar una URL, arrastrar, o pegar desde el portapapeles; una línea
  de pista enumera los formatos aceptados y, al cargar, aparece una **miniatura con palomita** y un botón Restablecer.
  Su botón principal muestra el atajo (Cmd+Enter). Dropbox ofrece «elegir desde la nube» como alternativa al archivo local.
- Aplica a: justificante con archivo (PDF/JPG, peso máximo, miniatura o ícono con nombre y tamaño), foto de alumno,
  captura de prueba de cámara como vista previa; pegar archivo desde el portapapeles.

### Conexión, edición en línea y permisos

**R13. Apollo · Probar conexión (tres estados en la misma pantalla)**
- URL: https://mobbin.com/screens/00c7c5e8-393a-4bf8-8cd8-e19dc717ecc1 (copiado: https://mobbin.com/screens/82314c7e-f291-41df-8722-817855a4cf92 · resultado: https://mobbin.com/screens/9bc266c2-d912-482b-b224-2ff02ece964c)
- Patrón: una guía numerada de 5 pasos con un bloque de código y un botón amarillo «Copiar código» que responde con un
  toast de éxito. Más abajo, la sección de dominios tiene a la derecha un botón secundario «Probar conexión» junto a «Agregar
  dominio»; cada dominio muestra un chip de estado (Inactivo) y acciones de editar y borrar. Al probar, aparece un toast
  «Prueba de conexión completa: dominios actualizados».
- Aplica a: formulario de cámara (URL + credenciales): guía corta de pasos, botón «Probar conexión» al lado de Guardar,
  chip de estado persistente. Ver anti-patrón A03: el resultado no debe vivir solo en un toast.

**R14. DoorDash Merchant · Gestor de menú con edición en línea y barra «N cambios sin guardar»**
- URL: https://mobbin.com/screens/cfb1f6b5-ef6e-4ddd-8526-bcab55408b8e
- Patrón: celdas editables directamente en la tabla (nombre y precio); la celda en edición tiene un borde y la fila
  modificada lleva un punto rojo. Una barra fija al pie dice «Editar detalles: haz clic en cualquier nombre o precio»,
  muestra en rojo «2 cambios sin guardar» y ofrece Cancelar y «Guardar cambios». El estado de cada ítem es un selector
  con punto de color y texto.
- Aplica a: captura masiva en tabla (asistencia corregida, estatus de inscripciones), con contador de cambios en la barra
  y marca en la fila cambiada.

**R15. Shopify · Permisos con casillas de tres estados, contadores y barra de cambios**
- URL: https://mobbin.com/screens/aee42bb6-f7c2-48ec-b0a1-caae95988e37
- Patrón: buscador arriba, casilla «Seleccionar todos los permisos» en estado intermedio cuando hay selección parcial y
  «Expandir todo». Cada grupo es una fila colapsable con casilla propia y contador «11/11», «0/20». Los permisos hijos van
  con sangría bajo el padre del que dependen. La barra superior «cambios sin guardar» con Descartar y Guardar sigue visible.
- Aplica a: asignar varios grupos o materias a un docente, y elegir permisos de rol; contadores por grupo («3/5 grupos»),
  seleccionar todos con estado intermedio.

### Confirmaciones, bloqueos, secciones y opciones

**R16. Confirmaciones destructivas: AirOps, Mintlify y DoorDash Merchant**
- URL: AirOps https://mobbin.com/screens/f374a23a-b488-4cd8-9ab6-c6d0f62ab38f · Mintlify https://mobbin.com/screens/5cc195f3-5987-45ac-844d-9b66ba228cb5 · DoorDash https://mobbin.com/screens/0f5d4c54-b24c-4b16-bc08-0a72a86d4b3a
- Patrón AirOps: titular «¿Eliminar definitivamente los elementos seleccionados?», dos párrafos (qué se pierde y que no hay
  vuelta atrás, y qué dependencias se rompen), una **lista de los elementos afectados**, un campo «Escribe Eliminar para
  confirmar» y un botón de confirmación cuya etiqueta lleva el conteo («Sí, eliminar 2 elementos»).
  Patrón Mintlify: icono de papelera, titular corto y **una frase con la consecuencia** («las apps que usan esta
  credencial perderán acceso de inmediato»), Cancelar y Eliminar en rojo.
  Patrón DoorDash: titular con el **nombre del objeto** («¿Eliminar Tratos y Bebidas?») y una frase con «no se puede
  deshacer» en negritas; Cancelar y Eliminar en rojo.
- Aplica a: eliminar grupo con asistencias, docente con grupos, aula con horarios, inscripción, cámara; escribir el nombre
  solo si el daño es irreversible o masivo; en el resto, consecuencia en una frase y botón con el nombre del objeto.

**R17. Square · Diálogo bloqueante por requisito faltante y secciones colapsables con resumen**
- URL: bloqueante https://mobbin.com/screens/bb3b05e9-0bd4-4c52-9e22-5dcabe2ad5e8 · secciones https://mobbin.com/screens/8d25364c-a526-4014-8b57-a642262c8d61
- Patrón: al intentar enviar sin tener configurado el cobro, un diálogo corto explica por qué no se puede, qué pasará con
  el borrador y ofrece «Ahora no» y «Configurar pagos». El editor tiene «Guardar como borrador» a la vista. El panel
  derecho se compone de **secciones colapsables que muestran un resumen del valor actual bajo el título** (por ejemplo
  «Programación: se envía de inmediato, vence hoy»), de modo que se ven las decisiones sin abrir cada sección. Un modal de
  «Escribir con IA» usa campo opcional, dos selects (longitud, tono) y el botón Generar.
- Aplica a: crear grupo sin materias, aulas o docentes dados de alta (diálogo con acción «Crear aula ahora»); secciones del
  formulario de grupo (Horario, Inscripciones, Avanzado) con resumen en el encabezado; «Guardar borrador» para formularios largos.

**R18. fal · Créditos (tarjetas de opción con valor «Otro») y Dropbox Dash · interruptores con ayuda**
- URL: fal https://mobbin.com/screens/c008ab9d-3e86-4bea-adbe-6a23c278783d · Dropbox https://mobbin.com/screens/9e886ea7-ad4d-4395-b11c-bb4c740e2e6f
- Patrón fal: lista de opciones como filas-tarjeta (monto y descripción de lo que equivale); la elegida se sombrea; la
  última, «Otro», trae su propio campo numérico con prefijo «$». El botón principal **refleja la selección** («Comprar
  $20.00»). El campo de cupón tiene su botón «Canjear» deshabilitado hasta escribir. Un aviso naranja explica por qué
  falta una función. Un campo de alerta tiene su propio botón «Activar» al lado.
  Patrón Dropbox: ajustes como filas con título, ayuda de una línea y el interruptor con el **texto «Activado»** al lado
  (el estado no es solo color); el tema se elige con radios (Sistema, Claro, Oscuro).
- Aplica a: opciones con «Otro» (motivo de justificante: enfermedad, trámite, otro con campo de texto); etiqueta del botón
  que refleja la selección («Inscribir a 3 alumnos»); interruptores de estatus (activo/inactivo) con ayuda y texto de estado.

---

## 2. Patrones recomendados para SUSAN

Orden de prioridad: P1 a P6 primero (definen la sensación de formulario guiado y se usan en todas las pantallas), P7 a P12
después. Todos los componentes siguen las convenciones del proyecto (carpeta propia, Lucide para iconos, tokens
semánticos, `clsx`, sin sombras, foco con `ring-4`, textos en español, respetar «reducir movimiento»). Las firmas son
propuestas de API, no código final.

### P1. `ui/Field` v2: validar al salir del campo, estado «válido», contador, ejemplo y campo derivado (prioridad alta)

Evoluciona el `ui/Field` actual (que ya enlaza hint y error). Reglas de comportamiento:
1. **Primer error al salir del campo (blur) o al enviar**, nunca mientras se escribe por primera vez.
2. Con un error visible, **revalidar en cada tecla** para que desaparezca en cuanto se corrija.
3. Estado «válido» (palomita verde + texto breve) **solo** en campos con formato o unicidad que el usuario no puede
   comprobar a ojo (matrícula, correo, periodo, URL). No marcar válidos los campos de texto libre.
4. Comprobaciones remotas (matrícula duplicada) con «Comprobando…» tras 400 ms de pausa, y el error **debajo del
   campo causante**, no al final del formulario (ver A01).
5. Error = borde + icono + texto (nunca solo color); el contador de caracteres aparece al 80 % del máximo (justificante,
   observaciones); la pista siempre muestra un **ejemplo** con el formato esperado.
6. «Obligatorio» se asume; se rotula «(opcional)» en el campo o en el encabezado de sección (R03, R12).

```jsx
<Field
    label="Matrícula" ejemplo="A001234" hint="Máximo 10 caracteres"
    error={errores.matricula} estado="idle|validando|valido|aviso"   // 'aviso' = no bloquea (ver A09)
    contador={{ actual: valor.length, max: 10 }} opcional={false}
    derivado={{ de: 'la matrícula', onEditar: () => {} }}             // etiqueta «Autocompletado» + «Editar»
>
    <Input mask="matricula" />
</Field>
```
Hook asociado: `useCampo({ validar, asincrono, debounceMs })` que devuelve `{ value, touched, error, estado, props }`.

### P2. `ui/BarraAcciones`: pie fijo con «N cambios sin guardar», motivo del bloqueo y atajos (alta)

Aplica a toda edición (R01, R05, R14, R15). Siempre visible al fondo del panel o del drawer; muestra el conteo de
cambios, **el motivo cuando Guardar está deshabilitado** (el mismo texto del primer error, R05), «Descartar» pide
confirmación solo si hay cambios, Cmd/Ctrl+Enter guarda y Esc cierra. Protege la salida (aviso de navegación) mientras haya
cambios. En formularios de creación el botón dice el verbo con el sustantivo («Crear alumno», «Inscribir 3 alumnos»).

```jsx
<BarraAcciones
    cambios={3} guardando={false} deshabilitadoMotivo="Falta la matrícula del alumno"
    etiquetaGuardar="Guardar cambios" onGuardar={...} onDescartar={...}
    secundario={<Button variant="ghost">Guardar borrador</Button>}   // formularios largos
/>
```

### P3. `ui/Combobox` con búsqueda, dos líneas y avatar (alta)

Reemplaza `Select` nativo cuando hay más de 7 opciones o los datos tienen identidad (materia, docente, aula, alumno,
grupo). Debe permitir teclear para filtrar, flechas y Enter, Esc, estado vacío con acción («No hay aulas. Crear aula»),
carga asíncrona con «Buscando…», selección múltiple como chips con «+N más» (R02, R06).

```jsx
<Combobox
    opciones={[{ value, label, descripcion, avatar, meta, grupo, deshabilitado, motivo }]}
    value={v} onChange={set} multiple={false}
    onBuscar={async (q) => []}                       // omitir para filtrar en memoria
    vacio={{ texto: 'No hay aulas', accion: { label: 'Crear aula', onClick } }}
    mostrarAtajos                                     // pie «↑↓ navegar · Enter elegir · Esc cerrar»
/>
```
Inscribir alumno: la búsqueda acepta matrícula o nombre y la fila muestra nombre, matrícula y grupo actual; las ya
inscritas aparecen deshabilitadas con el motivo («Ya inscrito en 3A»).

### P4. `ui/Dropzone`: arrastrar y soltar con reglas visibles, vista previa y estados (alta)

Extiende `ui/FileInput` (conserva su validación de tipo y tamaño). Reglas visibles **antes** de elegir (tipos, peso
máximo, resolución mínima si aplica), enlace «Descargar plantilla» en el pie (R10), archivo elegido como chip con nombre,
tamaño y X, y miniatura si es imagen (R12). El botón principal del formulario queda deshabilitado hasta que haya archivo
válido y dice por qué. Admite pegar desde el portapapeles.

```jsx
<Dropzone
    accept={['.pdf', '.jpg', '.png']} maxBytes={5 * 1024 * 1024} value={file} onChange={setFile}
    vista="chip|imagen|tabla" plantillaHref="/plantillas/alumnos.csv"
    estado="reposo|arrastrando|validando|error|listo" error={msg} ayuda="PDF, JPG o PNG, hasta 5 MB"
/>
```

### P5. `ui/ImportadorCsv`: flujo en 3 pasos con vista previa fila por fila (alta)

Flujo guiado: **1) Subir** (Dropzone con plantilla), **2) Revisar** (tabla de las primeras 10 filas más conteos
«válidas · con error · duplicadas», celdas con error marcadas con icono y texto, errores **agrupados por causa** con rango
de filas, R11), **3) Resumen** (importados, con error, duplicados omitidos, descarga «archivo de errores», aviso de
política de duplicados antes de confirmar). Permitir «Importar solo las válidas» o «Corregir y subir de nuevo».
Se valida en el cliente solo para guiar; la validación autoritativa es la RPC (las reglas de negocio no se duplican).

```jsx
<ImportadorCsv
    columnas={[{ key: 'matricula', label: 'Matrícula', requerida: true, ejemplo: 'A001234', normalizar, validar }]}
    previsualizar={async (archivo) => ({ filas, errores })}   // llama a la RPC en modo simulacro
    onConfirmar={async (filasValidas) => resumen} politicaDuplicados="omitir|actualizar"
/>
```

### P6. `ui/SegmentedControl` y `ui/GrupoChips` en lugar de selects pequeños (alta)

Regla: **hasta 5 opciones excluyentes y visibles a la vez -> control segmentado**; opciones múltiples cortas (días de la
semana) -> chips conmutables; más de 5 -> Combobox o Select. Cubre estatus (activo/inactivo), turno, tipo de sesión,
frecuencia (R08), vista Lista/Rejilla (R07). Distinto de `ui/Pills` (filtros de lista con `aria-pressed`): el segmentado es
un `radiogroup` con valor de formulario, navegación por flechas y estado seleccionado con texto/icono además del color.

```jsx
<SegmentedControl ariaLabel="Estatus" opciones={[{ value: 'activo', label: 'Activo' }, { value: 'inactivo', label: 'Inactivo' }]} value={v} onChange={set} />
<GrupoChips multiple ariaLabel="Días" opciones={DIAS} value={dias} onChange={setDias} tamaño="sm" />
```

### P7. `ui/TarjetaOpcion` (radio-cards) con contenido anidado (media)

Para decisiones con consecuencias que conviene explicar: rol de usuario, tipo de cámara, tipo de justificante, motivo (con
«Otro» + campo, R18). Selección con borde, icono de palomita y `role="radio"`; la tarjeta elegida despliega el campo que le
corresponde (R05). Máximo 4 tarjetas por fila; en móvil se apilan.

```jsx
<TarjetaOpcion value={tipo} onChange={set} columnas={3}
    opciones={[{ value: 'ip', titulo: 'Cámara IP', descripcion: 'RTSP o HTTP en la red del plantel', icono: Wifi }]}
    renderExtra={(valor) => valor === 'ip' ? <CampoConexion /> : null} />
```

### P8. `ui/EditorHorarioSemanal` (alta para grupo/aula)

Fila por día con círculo de inicial (L M M J V S D), «Sin clase» con «+», franjas inicio-fin con selector de hora cada 30
min que además admite escribir `08:30` (máscara HH:MM de 24 h), «+» para otra franja, copiar a otros días (R07), X para quitar.
Validación inmediata **por fila**: fin mayor que inicio, sin traslape en el mismo día, **conflicto de aula** con aviso y
sugerencia («Aula 4 ocupada lunes 08:00-10:00 por 3B»). Atajos de plantilla («Lun a Vie 07:00-15:00»), resumen en una línea
(«Lun, Mié 08:00-10:00 · 4 h/semana») y excepciones por fecha para suspensiones.

```jsx
<EditorHorarioSemanal
    value={{ lun: [{ inicio: '08:00', fin: '10:00' }], mar: [] }} onChange={set}
    paso={30} min="06:00" max="22:00" aulaId={aula} onValidarConflicto={async (franja) => conflicto|null}
    plantillas={[{ label: 'Lun a Vie 07:00-15:00', value: {} }]} excepciones
/>
```

### P9. `ui/RangoFechas` y `ui/CampoFecha` con atajos y entrada rápida (media)

Atajos a la izquierda (Hoy, Esta semana, Últimos N días, Este parcial/periodo, Personalizado, R09), calendario de dos
meses con semana que inicia en lunes, **resumen del rango en texto** en el pie, Cancelar/Aplicar con Aplicar deshabilitado
sin cambios, entrada rápida por texto (`7d`, `2026-2`) y formato de captura DD/MM/AAAA con máscara. Los atajos que no
aplican se **ocultan**, no se muestran con candado.

```jsx
<RangoFechas value={{ desde, hasta }} onChange={set} atajos={['hoy', 'semana', 'ultimosN', 'periodo']}
    min={inicioPeriodo} max={finPeriodo} entradaRapida aplicar="confirmar|inmediato" resumen />
```

### P10. `ui/CampoPassword` con reglas en vivo, mostrar, generar y copiar (media, crítica en «usuario nuevo»)

Mostrar/ocultar dentro del campo, **lista de reglas** con palomita/X en vivo (R04, texto + icono), sin campo de
confirmación (con «mostrar» sobra el doble tecleo, ver A06). Para la contraseña temporal del administrador: botón
«Generar» (por defecto ya generada, legible y sin caracteres ambiguos como 0/O, 1/l), «Copiar» con aviso breve, se muestra
**una sola vez** al crear, y un conmutador «Pedir cambio al primer inicio» activo por defecto. Medidor de fuerza opcional
solo como complemento de las reglas, nunca como único criterio.

```jsx
<CampoPassword value={v} onChange={set}
    reglas={[{ id: 'len', label: 'Mínimo 10 caracteres', test: (p) => p.length >= 10 }]}
    generador={{ longitud: 12, legible: true }} copiable mostrarMedidor={false} ocultoPorDefecto />
```

### P11. `ui/CampoConexion` con «Probar conexión» y estado persistente (media)

Para la cámara: selector de protocolo (rtsp://, http://), URL con ejemplo, usuario y contraseña enmascarada con «mostrar»,
y el botón «Probar conexión» **junto a Guardar**. Resultado en un chip persistente con marca de hora: Sin probar,
Probando…, Conectada (resolución y fotogramas), Falló con motivo y sugerencia (timeout, credenciales, formato de URL).
Si hay captura de prueba, mostrar la miniatura (R12). Permitir guardar sin probar solo con aviso (ver A09). Nunca registrar
las credenciales en logs ni mostrarlas completas en el estado.

```jsx
<CampoConexion value={{ url, usuario, clave }} onChange={set}
    onProbar={async (v) => ({ ok: true, detalle: '1280x720 · 24 fps', captura })}
    estado={estado} ultimaPrueba={fecha} bloqueaGuardar={false} />
```

### P12. `ui/ConfirmDestructivo` y diálogo de requisito faltante (media)

Extiende `ui/ConfirmDialog`. Estructura fija (R16): titular con el **nombre del objeto**, frase con la consecuencia
(qué se pierde y qué se rompe), lista de elementos afectados si son varios, botón con el conteo («Sí, eliminar 2 alumnos»),
variante destructiva. **Escribir el nombre** solo para acciones irreversibles o masivas (borrar grupo con asistencias);
para el resto, preferir «Archivar» con aviso «Deshacer» durante 8 s. El diálogo de requisito faltante (R17) explica el
bloqueo y da la acción directa («No hay aulas: Crear aula»).

```jsx
<ConfirmDestructivo abierto objeto="Grupo 3A (2026-2)" consecuencia="Se perderán 48 sesiones y su asistencia."
    afectados={[{ icono: Users, texto: '32 inscripciones' }]} confirmarTexto="3A" etiquetaConfirmar={(n) => `Sí, eliminar ${n} grupo`}
    onConfirmar={async () => {}} onCancelar={...} />
```

### Complementos (sin componente propio grande)

- **`ui/Input` con `mask`**: matrícula (máx. 10, mayúsculas, sin espacios; el formato exacto se confirma con Servicios
  Escolares, solo se sabe `VARCHAR(10)` único), periodo `AAAA-S` (se completa el guion y sugiere el periodo vigente), hora
  `HH:MM`, teléfono con prefijo (R04). Siempre con ejemplo visible y sin impedir pegar.
- **`ui/SeccionColapsable`** (R17): título, **resumen del valor actual** en el encabezado, marca «Revisar» si hay error dentro
  aunque esté plegada, `opcional`, `abiertaPorDefecto`. Los campos poco usados como chips que se despliegan (R01).
- **Campos derivados**: correo institucional a partir de la matrícula (R03, R04, R10), clave de grupo desde materia y
  periodo, periodo sugerido por la fecha de hoy, nombre de importación desde el archivo. Siempre con etiqueta «Autocompletado»,
  editable con un clic, y bloqueado con motivo si la regla es del sistema.
- **Drawer para crear/editar** (R03): `ui/Drawer` (o Modal lateral) con pie fijo (`BarraAcciones`); a pantalla casi completa
  cuando el formulario tiene secciones largas.

### Mapa de formularios de SUSAN a patrones

| Formulario | Patrones principales |
| --- | --- |
| Crear/editar alumno | Drawer R03, Field v2 con matrícula y correo derivado (P1), BarraAcciones (P2), chips de campos opcionales (R01) |
| Crear/editar docente | Field v2, correo derivado, Combobox de grupos (P3), casillas con contadores (R15) |
| Crear/editar grupo | Combobox materia/docente/aula (P3), periodo con máscara, EditorHorarioSemanal (P8), secciones con resumen (R17), diálogo bloqueante si faltan catálogos (P12) |
| Aula y materia | Drawer con Field v2, SegmentedControl de estatus (P6), ConfirmDestructivo (P12) |
| Usuario con contraseña temporal | TarjetaOpcion de rol (P7), CampoPassword con generar y copiar (P10), conmutador «pedir cambio» |
| Cámara | TarjetaOpcion de tipo (P7), CampoConexion con probar (P11), miniatura de captura |
| Inscribir alumno | Combobox con dos líneas (P3), etiqueta de botón con conteo (P2) |
| Importar CSV | Dropzone (P4) + ImportadorCsv (P5) |
| Justificante con archivo | TarjetaOpcion de motivo con «Otro» (R18), RangoFechas (P9), Dropzone con vista previa (P4), contador de caracteres (P1) |
| Filtros de reportes | RangoFechas con atajos y entrada rápida (P9), SegmentedControl, Combobox múltiple con chips |

Orden de implementación sugerido: P1 + P2 (base de todo), P3, P6, P4 + P5, P8, P9, P10 + P11, P7, P12, complementos.

---

## 3. Anti-patrones vistos (o evidentes en las referencias) que debemos evitar

- **A01. Error del servidor lejos del campo que lo causa.** En Canny (https://mobbin.com/screens/851952ce-320f-4099-a533-89bfecd88562)
  el aviso de dominio duplicado aparece debajo del último campo (ARR) y no del campo Dominio, y el botón de crear sigue
  activo. En SUSAN el error de matrícula o correo duplicado va pegado a su campo, con foco en él.
- **A02. Botón principal deshabilitado sin explicar el motivo.** En el modal de importar de Shopify (R10) el botón gris no
  dice qué falta. Preferir el patrón de Customer.io (R05): el motivo se escribe junto al botón.
- **A03. Resultado de una prueba solo en un toast.** En Apollo (R13) el toast dice que la prueba terminó pero el chip del
  dominio sigue como «Inactivo» sin más detalle. La prueba de cámara deja un estado persistente con resultado y motivo.
- **A04. Banner de error arriba, lejos del control.** En Klaviyo (R10) el error del archivo va en la parte alta del modal
  mientras la zona del archivo está más abajo y no se resalta. Resaltar también la zona o la celda afectada.
- **A05. Candados en opciones no disponibles.** Canny (R09) muestra atajos con candado en el selector de fechas. En SUSAN no
  hay planes: ocultar lo que no aplica o mostrar el motivo concreto («no hay datos de este periodo»).
- **A06. Doble campo de contraseña.** AirOps (https://mobbin.com/screens/815db2cc-c26f-4046-9a82-897b87146e7e) pide
  contraseña y confirmación lado a lado sin botón de mostrar. Con «mostrar» y generador sobra la confirmación.
- **A07. Mezclar asteriscos y «(opcional)».** fal marca obligatorios con asterisco y Square rotula lo opcional con la
  palabra; verlos juntos en un producto confunde. Elegir una convención: en SUSAN, «(opcional)» en español.
- **A08. Estado solo por color.** Rojo/verde sin texto ni icono. Las referencias buenas (DoorDash, R04; Dropbox, R18)
  repiten el estado con texto («Activado») o icono (palomita).
- **A09. Bloquear el guardado por una advertencia.** Klaviyo (https://mobbin.com/screens/6607e72a-a4dd-4225-a958-b1beeeb9079e)
  usa una nota azul informativa (correo personal puede ir a spam) y una insignia amarilla «Remitente inválido» en el
  encabezado plegado de cada variante: la advertencia se ve sin bloquear. Distinguir **error** (bloquea) de **aviso** (no
  bloquea) también en SUSAN (cámara sin probar, aula con holgura mínima).
- **A10. Mensajes genéricos de «inválido».** «Valor no válido» no ayuda. Cada regla dice qué se espera y da un ejemplo
  («Usa el formato AAAA-S, por ejemplo 2026-2»).
- **A11. Validar mientras se escribe por primera vez.** Marcar rojo el correo en la primera letra es ruido; esperar al blur.
- **A12. Selects nativos largos y modal sobre modal.** Para listas largas usar Combobox; abrir un segundo diálogo encima del
  formulario hace perder el contexto (preferir sección colapsable o paso siguiente dentro del mismo drawer).
- **A13. Limpiar el formulario tras un error del servidor.** Conservar lo capturado, enfocar el primer campo con error y
  resumir en la barra de acciones.
- **A14. Importaciones silenciosas.** Mostrar siempre el resumen (importados, con error, duplicados) y la política de
  duplicados antes de confirmar, como hacen Shopify y Square (R11).

---

## 4. Textos de ayuda y error sugeridos (español, tono directo)

| Campo | Ayuda con ejemplo | Error típico |
| --- | --- | --- |
| Matrícula | «Hasta 10 caracteres, por ejemplo A001234» | «Esta matrícula ya está registrada» (con enlace «Ver alumno») |
| Correo institucional | «Se completa con la matrícula; puedes editarlo» | «Escribe un correo con el dominio institucional» |
| Periodo | «Formato AAAA-S, por ejemplo 2026-2» | «El periodo debe ser AAAA-S (S es 1 o 2)» |
| Hora | «Formato 24 h, por ejemplo 08:30» | «La hora de fin debe ser posterior a la de inicio» |
| Horario/aula | «Se avisa si el aula ya está ocupada» | «Aula 4 ocupada el lunes de 08:00 a 10:00 por 3B» |
| URL de cámara | «Por ejemplo rtsp://192.168.1.20:554/stream1» | «No se pudo conectar: tiempo de espera agotado. Revisa la red» |
| Contraseña temporal | «Se generó una contraseña; se muestra una sola vez» | «Falta una mayúscula» (regla en vivo, no mensaje de error) |
| Archivo | «PDF, JPG o PNG, hasta 5 MB» | «El archivo pesa 8 MB; el máximo es 5 MB» |
| CSV | «Usa la plantilla; primera fila con encabezados» | «Filas 2 a 11: matrícula con formato inválido» |

---

## 5. Resumen de apoyos por regla

| Regla | Referencias |
| --- | --- |
| P1 Field v2 | R01, R03, R04, R05, R06 |
| P2 BarraAcciones | R01, R05, R14, R15 |
| P3 Combobox | R02, R06 |
| P4 Dropzone | R10, R12 |
| P5 ImportadorCsv | R10, R11 |
| P6 SegmentedControl / GrupoChips | R07, R08 |
| P7 TarjetaOpcion | R05, R08, R18 |
| P8 EditorHorarioSemanal | R07, R08 |
| P9 RangoFechas | R09 |
| P10 CampoPassword | R04 |
| P11 CampoConexion | R12, R13 |
| P12 ConfirmDestructivo | R16, R17 |
