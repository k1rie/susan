# Referencias de flujos guiados de creación (Mobbin, web)

Investigación de UX para el rediseño de los formularios de captura de SUSAN (alumno, grupo, aula, materia, docente,
usuario, cámara, horario del grupo, inscribir alumno, importar CSV, justificante, onboarding). Objetivo: pasar de
"formulario plano con botón Guardar" a flujos **dinámicos y guiados**: pasos cortos, progreso visible, resumen antes de
confirmar, pantalla de éxito con siguiente paso, pasos opcionales y borrador.

## Método y límites

- Fuente: Mobbin (mobbin.com), plataforma Web. Se recorrieron: el flujo "Onboarding" (640 flujos), las pantallas del
  patrón "Account Setup" (1,076), el elemento "Drawer" (1,211) y búsquedas por texto dentro de capturas
  ("Upload CSV", "Map fields", "Save as draft", "You're all set", "Step 2 of 3", "Review and submit").
- Todas las URL de pantalla tienen la forma `https://mobbin.com/screens/<id>` y son estables mientras la cuenta tenga
  acceso. La búsqueda por texto se arma así:
  `https://mobbin.com/search/apps/web?content_type=screens&sort=trending&text_in_screenshot=<texto>`.
  Otros filtros útiles: `...&filter=screenPatterns.Account+Setup`, `...content_type=flows&filter=flowActions.Onboarding`,
  `...content_type=ui-elements&filter=screenElements.Drawer`. (El elemento "Stepper" de Mobbin es el contador numérico
  de + / -, no un asistente de pasos: no sirve para esto, solo para el campo de capacidad del aula.)
- Solo se vieron pantallas **estáticas**. Las transiciones y microinteracciones no se verificaron; donde se infiere algo
  de una captura se dice "se ve" y no "se anima". Ninguna pantalla se guardó, copió ni descargó.
- Descripciones con palabras propias; los textos de las apps no se reproducen.

## Resumen: qué contenedor y qué referencias por formulario de SUSAN

| Formulario SUSAN (componente actual) | Contenedor recomendado | Referencias clave |
|---|---|---|
| Alta de grupo (`GrupoForm`) | Asistente de 3 pasos en página completa, con panel de resumen | R2, R7, R3, R14, R8 |
| Horario del grupo (`HorarioEditor`) | Paso 2 del grupo y también editor propio en panel lateral | R1, R2, R15 |
| Inscribir alumno (`InscribirAlumno`) | Panel con 3 modos: uno, varios, CSV | R12, R13 |
| Importar CSV (`ImportarCsv`) | Asistente modal de 4 pasos | R9, R10, R11 |
| Alta de alumno (`AlumnoForm` + plantilla facial) | Asistente de 3 pasos con foto opcional | R4, R5, R13 |
| Justificante (`RegistrarJustificanteForm`) | Asistente de 3 pasos, primero móvil | R14, R16 |
| Aula, materia, docente, usuario | Panel lateral de un solo paso (sin asistente) | R4, R6, R8, R15 |
| Cámara (`CamaraForm`) | Panel lateral con tipo en tarjetas de opción | R6, R4 |
| Onboarding (`Onboarding`) | Mantener 3-4 pasos; añadir omitir y cierre con siguiente paso | R1, R3, R4, R9 |

## 1. Referencias

Cada ficha: app, pantalla, URL, patrón concreto, a qué formulario aplica y por qué.

### A. Asistentes con progreso y onboarding

**R1. Calendly — configuración inicial con progreso segmentado y editor semanal**
- URL: paso "cómo vas a usarlo" `https://mobbin.com/screens/2e03488c-8740-477e-a044-035050ac6054`;
  disponibilidad semanal `https://mobbin.com/screens/c700d7f1-d270-4ac6-a09d-08732a2e47d9`;
  mapeo de columnas `https://mobbin.com/screens/58ac3eb5-7c72-4b6e-b15b-762963f871d3`.
- Patrón: arriba a la derecha una etiqueta "Paso N de M" con barra segmentada. Cada paso es una pregunta con tarjetas
  seleccionables (una opción, o varias con la leyenda "elige las que apliquen"). Botón principal a la derecha, "Atrás"
  a la izquierda. El paso de horario lista los días de la semana como círculos con la inicial, rango de horas por día,
  botón de añadir otro rango y botón de copiar a otros días; la zona horaria va al pie. A la derecha hay una
  ilustración que muestra el resultado (calendario de reserva).
- Aplica a: **horario del grupo** (filas por día + copiar) y **onboarding** (barra segmentada, tarjetas de opción).
  Por qué: es exactamente el problema de `HorarioEditor`, hoy con selector de día y dos campos de hora por bloque.

**R2. DoorDash Merchant — "Crear tienda" con pasos laterales, guardar en cabecera y horarios**
- URL: horarios `https://mobbin.com/screens/b1d76f2c-700e-4f87-8841-da943e461eae`;
  menú `https://mobbin.com/screens/2fd80f67-ebf0-4615-a9d0-74099c07498e`.
- Patrón: columna izquierda con cuatro pasos numerados; los terminados llevan palomita verde y los que aún no se pueden
  abrir llevan candado. El paso activo se resalta con color de marca. La cabecera trae "Ayuda" y "Guardar" siempre
  visibles (guardado parcial). Cada paso es una sola pregunta grande con botón "Atrás" circular. En horarios hay una
  casilla para aplicar las mismas horas a todos los días, una casilla "cerrado" por día y un botón + para segundo rango.
  En el paso del menú la decisión se hace con tres botones tipo píldora (ya lo tengo / lo tengo pero editable / empezar
  de cero) en lugar de un selector.
- Aplica a: **alta de grupo** (pasos laterales con candado hasta tener materia y docente) y **horario**.
  Por qué: muestra cómo dejar guardar un avance sin obligar a completar todo y cómo bloquear pasos dependientes.

**R3. Shopify — pantalla de arranque mínima con "hazlo después"**
- URL: `https://mobbin.com/screens/cc35b419-fc5b-4f2b-9c13-6ae6af73c562`.
- Patrón: una sola tarjeta centrada sobre fondo oscuro con un único campo de texto (nombre) y una selección múltiple
  con chips; botón principal negro y debajo un enlace discreto para posponerlo.
- Aplica a: **onboarding** y **paso 1 del grupo** (pedir lo mínimo para crear y dejar el resto para después).
  Por qué: baja la barrera de entrada; coincide con el estilo de botón primario negro de SUSAN.

**R4. fal — onboarding de dos preguntas con tarjetas, pregunta opcional y panel de creación lateral**
- URL: preguntas `https://mobbin.com/screens/cfe8027e-258b-4c75-8520-cda47b41f98a`;
  pregunta opcional y cierre `https://mobbin.com/screens/cac167a2-6868-4e8b-8daa-354ac4c2e9f9`;
  panel lateral "nuevo personaje" `https://mobbin.com/screens/531b79e1-e46c-43ed-96d3-87ece02652bf`.
- Patrón: tres segmentos de progreso arriba; tarjetas con icono para la elección principal; nota breve al pie
  ("puedes cambiarlo después"); pregunta marcada como opcional en el propio texto de la etiqueta; al terminar, una
  confirmación de una línea. El panel lateral de creación tiene nombre más identificador, descripción, zona de
  imágenes con contador (por ejemplo 1/20), tres orígenes para subir (equipo, biblioteca, enlace) y leyendas de ayuda
  bajo cada bloque; pie con Cancelar y Crear.
- Aplica a: **onboarding** (tarjetas, nota "puedes cambiarlo"), **alta de alumno** (zona de fotos con contador para la
  plantilla facial) y **catálogos** (panel lateral con pie fijo).
  Por qué: es el mejor ejemplo de captura de varias imágenes con progreso explícito y de formulario en panel.

**R5. Delphi — una pregunta por pantalla con barra fina y atrás**
- URL: `https://mobbin.com/screens/63788801-f16a-43e3-8e2e-9472ef0a6dbf`;
  segunda pregunta `https://mobbin.com/screens/a9279163-b67e-4f4f-a76a-40b0b63ea706`.
- Patrón: barra de progreso delgada pegada al borde superior, flecha de regreso en la esquina, título corto, uno o dos
  campos y botón ancho de continuar centrado.
- Aplica a: **alta de alumno y justificante en celular** (360 px): un tema por pantalla.
  Por qué: la barra delgada ocupa casi nada de altura. No conviene usarlo en formularios de 3 campos (ver
  anti-patrones).

**R6. Mintlify — tarjetas de opción con descripción, "omitir" y panel de configuración**
- URL: elegir método `https://mobbin.com/screens/04a01dec-87e3-4a36-a5b0-0826ea30ba4f`;
  paso 1 de 4 con punto de partida `https://mobbin.com/screens/22789158-098a-4aae-8ffe-42e373a85fcb`;
  panel lateral de automatización `https://mobbin.com/screens/791d3aee-ef0c-4427-8ba1-89077c6efb68`.
- Patrón: lista vertical de tarjetas de radio con título y una línea de descripción cada una; botón primario y, debajo,
  enlace de omitir. En el paso 1 de 4 se describe lo que se quiere y se genera un arranque, con salida a "empezar en
  blanco". En el panel lateral el campo "¿cuándo debe correr?" son tarjetas de radio con ayuda; el pie aclara el costo.
- Aplica a: **cámara** (tipo de cámara como tarjetas con descripción: IP, webcam, simulada), **onboarding** y
  cualquier elección de tipo con consecuencias.
  Por qué: cada opción explica su efecto antes de elegir; el select actual de `CamaraForm` no lo hace.

**R7. Stripe — pasos laterales con palomitas y revisión editable por secciones**
- URL: `https://mobbin.com/screens/7a1e1a52-db4d-46fe-9740-61036f6821e0`.
- Patrón: lista vertical de cinco pasos con palomitas verdes en los hechos y el actual resaltado ("Revisar y terminar",
  con "Resumen" como subpaso). La pantalla final agrupa lo capturado en tarjetas por sección (negocio, datos públicos,
  titular) y cada tarjeta tiene su enlace "Editar" arriba a la derecha.
- Aplica a: **alta de grupo**, **alta de alumno** y **justificante** (último paso = resumen editable).
  Por qué: evita el "creé algo mal y no sé dónde corregirlo"; el Editar vuelve al paso exacto.

### B. Revisión, borrador y éxito

**R8. Square — "Nueva factura": página completa con borrador y resumen vivo**
- URL: formulario `https://mobbin.com/screens/f1ab2bf3-a5da-4338-a964-aa56c6a3b157`;
  buscador de cliente `https://mobbin.com/screens/9e088c5b-8d6d-472c-a5a0-0dedfb55a899`.
- Patrón: pantalla completa con X para cerrar, título al centro y tres acciones arriba a la derecha: vista previa,
  guardar como borrador y enviar. La columna principal es el formulario; la columna derecha es un resumen de ajustes con
  secciones plegables que muestran el valor actual en una línea (programación, métodos, recordatorios...). El campo de
  cliente es un buscador: la primera opción es crear uno nuevo y los resultados traen iniciales, correo y teléfono.
- Aplica a: **alta de grupo** (panel de resumen que se llena solo), **justificante** (guardar borrador), **inscribir
  alumno** (buscador con "crear nuevo" integrado).
  Por qué: combina borrador, resumen en vivo y creación anidada sin salir de la pantalla.

**R9. Klaviyo — asistente de importación a pantalla completa, y cierre con tres siguientes pasos**
- URL: mapeo `https://mobbin.com/screens/18f46ecc-50b5-48c8-9b8e-2358b8d611d0`;
  segundo paso (canales y consentimiento) `https://mobbin.com/screens/07f48918-d16e-42b7-b79b-c6095e9ec8ec`;
  tarjetas de opción múltiple `https://mobbin.com/screens/164e5c58-1f6c-4418-8e32-f3b541d1388f`;
  borrador `https://mobbin.com/screens/96b6f857-4b5b-4d3e-b246-f3441d63a8cf`;
  **cierre** `https://mobbin.com/screens/fad90f78-8ae6-4418-ad5f-43238cc02042`.
- Patrón (importar): barra superior con título, ayuda y cerrar; segunda barra con Atrás y Siguiente, y un indicador de
  dos segmentos. La tabla de mapeo tiene casilla de importar, columna del CSV, flecha, campo destino (selector), datos de
  muestra y tipo; arriba una línea "seleccionadas 11/12". En el último paso el botón cambia a "Importar".
- Patrón (cierre): icono con insignia de verificación, título de "todo listo" y tres tarjetas con la siguiente acción
  (una marcada "popular", la última es simplemente ir al panel).
- Aplica a: **importar CSV** y **pantalla de éxito de todas las altas**.
  Por qué: el cierre como lista de siguientes pasos es el patrón más aprovechable para SUSAN.

### C. Importación guiada de archivo

**R10. Workable — importar empleados desde CSV en modal con pasos laterales**
- URL: `https://mobbin.com/screens/07959514-ff7f-4d1c-ba53-4d61b871ebaf`.
- Patrón: modal ancho; izquierda, cuatro pasos numerados (archivo, campos, valores, selección); derecha, zona de carga
  con el archivo ya subido y su barra de progreso, enlace para reemplazarlo o arrastrar, casilla "la primera fila son
  encabezados" y una tarjeta de ayuda con botón para descargar la plantilla. Cancelar y Siguiente arriba a la derecha.
- Aplica a: **importar CSV**. Por qué: plantilla descargable y casilla de encabezados resuelven los dos errores más
  comunes de un CSV de alumnos.

**R11. Customer.io — revisión de importación con contadores**
- URL: `https://mobbin.com/screens/0c5ac827-0cf9-4208-9421-9d914a9b96a8`.
- Patrón: tres pestañas numeradas con palomita en las hechas (archivo, campos, revisión). La revisión abre con un banner
  verde de éxito y cinco cifras (nuevos, ya existentes, cambios de id, avisos, errores) y un enlace de vista previa.
  Debajo, una acción opcional (añadir los importados a un segmento, con campo de nombre), "Atrás" y "Completar
  importación"; "Cancelar importación" en rojo arriba a la derecha.
- Aplica a: **importar CSV** (paso de revisión) y la opción "inscribir a todos en este grupo".
  Por qué: las cinco cifras dan confianza antes de escribir en la base; encajan con `StatCard`.

**R12. Notion — importar CSV en modal con vista previa en vivo, más Intercom y Flodesk para alta masiva**
- URL: Notion `https://mobbin.com/screens/0616d54f-6fba-4d7e-bf92-2780564f5363`;
  Flodesk (menú "añadir uno" / "subir CSV") `https://mobbin.com/screens/0704f5e0-d31d-4a2f-8144-c351f8b2c4bb`;
  Intercom (tres métodos de carga y alta manual por filas): búsqueda
  `https://mobbin.com/search/apps/web?content_type=screens&sort=trending&text_in_screenshot=Upload+CSV`.
- Patrón: Notion divide el modal en dos: izquierda botón de elegir archivo, derecha una tabla fantasma que se llena con
  la vista previa; el botón de continuar está deshabilitado hasta que hay archivo. Flodesk esconde las dos vías (uno o
  CSV) tras un menú del botón de añadir. Intercom ofrece tres tarjetas de método (generar, manual, subir CSV con tope de
  50) y en la vía manual un modal con varias filas y "añadir otra".
- Aplica a: **inscribir alumno** (un alumno, varios, o CSV) y **importar CSV**.
  Por qué: la vista previa inmediata y las tres vías con el mismo destino reducen pasos.

### D. Pasos cortos, ayuda y listas de tareas

**R13. Slack — "¿quién más está en el equipo?" (paso 2 de 3)**
- URL: `https://mobbin.com/screens/0f4da30e-ff46-47b5-8208-0695858a7a02`.
- Patrón: campo de varios correos; al teclear aparece una sugerencia en línea para invitar ese correo; tres salidas:
  Siguiente, copiar enlace de invitación y un enlace discreto de omitir este paso.
- Aplica a: **inscribir alumno** (pegar varias matrículas o correos) y **alta de usuario**.
  Por qué: entrada de lote sin tabla, con salida opcional.

**R14. Zillow Rental Manager — paso 2 de 3 con vista previa viva; Gusto — pasos con título y ayuda**
- URL: Zillow `https://mobbin.com/screens/023ca361-e647-4b37-8361-a998fc5ae1d5`;
  Gusto paso 2 de 3 `https://mobbin.com/screens/0b7efa53-1426-4de9-958f-27f9e5aa0497`;
  Gusto, barra de dos etapas con nombre `https://mobbin.com/screens/70caa9f3-3a31-4677-996c-636ffd3f7871`.
- Patrón: Zillow muestra "Paso 2 de 3" con barra azul, un formulario de tres o cuatro campos con texto de ayuda justo
  bajo el campo (por ejemplo, qué pasa si el dato no se puede editar después) y la palabra "opcional" en la etiqueta;
  a la derecha una tarjeta de vista previa del objeto que se está creando; botón de salir arriba, Atrás y Siguiente al
  pie. Gusto pone el nombre del paso sobre la barra y, a un lado, una tarjeta de ayuda ("¿dudas?") con enlace a
  preguntas frecuentes; en su otra pantalla la barra tiene dos tramos rotulados (editar, revisar y enviar).
- Aplica a: **alta de grupo** (tarjeta de vista previa del grupo), **justificante** (nombre de paso, tarjeta de ayuda
  sobre qué documento sirve).
  Por qué: la vista previa y la ayuda contextual responden al "¿esto cómo va a quedar?".

**R15. Sweatpals — panel de repetición para horarios recurrentes**
- URL: `https://mobbin.com/screens/756ab6a0-6724-4b94-9ef8-4b700d7a937a`.
- Patrón: control segmentado diario / semanal / mensual, campo "cada N semanas", fila de botones con las iniciales de los
  días (activables), "repetir hasta" con dos opciones (siempre, fecha) y botón de guardar al pie.
- Aplica a: **horario del grupo** y **generar sesiones** (`GenerarSesiones`).
  Por qué: los días como botones activables son más rápidos que un selector de día por bloque.

**R16. Etsy y Deputy — pie fijo con botón de creación y lista de secciones completadas**
- URL: Etsy `https://mobbin.com/screens/0ff32a80-5fad-4696-bf38-27ce61044fa5`;
  Deputy `https://mobbin.com/screens/0f96e0b6-c017-4b77-9c79-feb4010a41bb`.
- Patrón: Etsy es una página de formulario corto con pie fijo (Cancelar y botón principal que sigue apagado hasta que
  el formulario es válido) y una frase que avisa que lo demás se puede añadir y revisar después. Deputy presenta las
  secciones pendientes como lista de tarjetas con palomita al completar y un botón final apagado hasta terminar todas.
- Aplica a: **justificante** (pie fijo, 360 px) y **checklist de configuración del grupo** (materia, horario, cámara,
  alumnos).
  Por qué: el pie fijo mantiene el botón al alcance del pulgar; la lista de secciones convierte "crear" en progreso.

### Pantallas de apoyo (vistas, no cuentan como referencia principal)

- Hootsuite, "Paso 2 de 3" con franja de color: `https://mobbin.com/screens/0a3ae68b-3d35-4f1b-a0de-2a8eba88b358`.
- Linktree, asistente en barra inferior con título de paso y botón de acción: `https://mobbin.com/screens/106e12e7-d613-4448-83e5-8da3e15ffc40`.
- OpenPhone, mapeo CSV a campos con marca verde por campo resuelto: `https://mobbin.com/screens/05d7e62b-d20f-46ea-8f9a-fdf1a0dca653`.
- Mintlify, flujo completo de onboarding (19 pantallas): `https://mobbin.com/flows/5e36e3f3-4de0-4391-9a86-906b69570c8a`.
- AirOps, "personaliza tu espacio" con selección por tarjetas: `https://mobbin.com/screens/98234706-c979-4c48-aa59-7735cac3958f`.
- Dropbox Dash, cierre sin siguiente paso (anti-patrón): `https://mobbin.com/screens/654d1eff-5b5e-411e-820d-2eeca4b4e369`.

## 2. Patrones recomendados para SUSAN (priorizados)

Convenciones: una pieza compartida por patrón, en `components/ui/` o `components/layout/`; sin cambiar contratos de
`docs/API*.md` (el asistente acumula en estado local y llama a la **misma RPC** al final); todo a 360 px, con
"reducir movimiento", Lucide, tokens y `ui/Field`, `ui/Select`, `ui/Input`, `ui/Modal`, `ui/FileInput`,
`ui/Detalles`, `ui/TiraSemana`, `ui/StatCard`. Piezas nuevas sugeridas (hoy no existen en `ui/`): `Pasos` (el indicador
de `Onboarding.jsx` extraído y reutilizable), `PanelLateral` (envoltura del sheet de shadcn, mismo patrón que `Modal`) y
`Asistente` (marco con barra de pasos, pie fijo Atrás/Siguiente y foco al título del paso).

**P1. Elegir contenedor según la complejidad (prioridad alta)**
- Regla: hasta 6 campos y sin dependencias -> panel lateral de un paso; datos con dependencias o más de 6 campos ->
  asistente de 3 pasos en página completa; carga de archivo -> modal ancho de 4 pasos.
- Panel lateral: aula, materia, docente, usuario, cámara, horario (editor suelto). Asistente: grupo, alumno,
  justificante. Modal: importar CSV. Onboarding sigue siendo página.
- Pie fijo en los tres (Cancelar a la izquierda, acción a la derecha) y cerrar con confirmación si hay cambios.
- Refs: R4, R8, R16, R10.

**P2. Alta de grupo en 3 pasos con resumen vivo y revisión editable (alta)**
- Paso 1, Materia y docente: Materia, Docente, Clave de grupo, Periodo. Periodo precargado con el vigente y clave con
  ejemplo en gris; "Crear materia" y "Crear docente" dentro del selector (primera opción de la lista), sin salir.
- Paso 2, Aula y horario: Aula con su capacidad visible en la opción; horario con el editor de P4. Aviso en línea si el
  aula ya está ocupada en ese bloque.
- Paso 3, Revisión: tarjetas por sección (Materia y docente / Aula / Horario) con enlace Editar que regresa al paso;
  casilla opcional "generar sesiones ahora". Botón con verbo específico: "Crear grupo".
- Panel "Resumen" a la derecha en pantallas anchas (se llena mientras se captura); en celular, barra inferior
  colapsable. Pasos laterales con palomita; el paso 3 se desbloquea cuando 1 y 2 son válidos.
- Guardar borrador solo en el navegador (sessionStorage, sin datos personales); sin cambios de contrato.
- Refs: R2, R7, R14, R8.

**P3. Pantalla de éxito con el siguiente paso natural (alta)**
- Al crear cualquier entidad, en vez de volver a la lista: icono con verificación, una línea de qué se creó y 2 o 3
  tarjetas de acción (`TarjetaFila`) con la más probable marcada.
- Grupo -> Inscribir alumnos, Importar CSV, Configurar cámara, Ver grupo. Alumno -> Tomar fotos de la plantilla,
  Inscribirlo a un grupo, Crear otro. Aula -> Asignar a un grupo. Justificante -> Ver mis justificantes (estado
  Pendiente). Onboarding -> primera acción por rol (docente: Pasar lista; admin: Crear grupo).
- Siempre una salida corta ("Ir a la lista") y nunca una pantalla sin acciones.
- Refs: R9 (cierre), R4; anti-patrón: Dropbox Dash.

**P4. Horario del grupo: días como botones, "aplicar a todos" y vista semanal (alta)**
- Fila de botones con las iniciales L M X J V S; al activar un día aparece su rango de horas. Casilla "mismo horario en
  los días activos". Botón "copiar a..." por bloque. Segundo rango por día con botón +.
- Vista previa con `ui/TiraSemana` bajo el editor (el horario resultante, no ilustración decorativa).
- Validación inmediata: fin posterior al inicio y traslape; el mensaje señala la fila.
- Refs: R1, R2, R15.

**P5. Importar CSV en 4 pasos con vista previa, mapeo y contadores (alta)**
- Paso 1, Archivo: zona de carga, "Descargar plantilla", casilla "la primera fila son encabezados", tope 1 MB y tipo;
  tabla de las primeras 5 filas apenas se elige el archivo.
- Paso 2, Columnas: tabla columna del CSV -> campo de SUSAN (matrícula, nombres, apellidos, correo) con dato de muestra y
  marca verde por campo resuelto; "reconocidas 4/4".
- Paso 3, Revisión: `StatCard`s con nuevos, ya existentes, con aviso, con error; vista previa de filas con error y
  opción de descargar errores; casilla opcional "inscribir a todos en este grupo".
- Paso 4, Resultado: éxito con conteos reales y siguiente paso (Ver alumnos, Importar otro). El botón del paso 3 dice
  "Importar N alumnos" (N real) y existe "Cancelar importación".
- Refs: R10, R11, R9, R12.

**P6. Inscribir alumnos con un buscador y tres modos (media-alta)**
- Un solo campo de búsqueda por matrícula o nombre; resultados con iniciales, matrícula y estatus (`Avatar`,
  `StatusChip`). Primera opción de la lista: "Crear alumno nuevo" (abre el panel de P7 y regresa con él seleccionado).
- Modos: uno (seleccionar), varios (pegar matrículas separadas por coma o salto de línea, con sugerencia en línea y
  cola de "agregados") y CSV (lleva a P5). Selector de modo en la parte superior (`ui/Pills`).
- Refs: R12, R13, R8.

**P7. Alta de alumno en 3 pasos con foto opcional (media)**
- Paso 1, Datos: matrícula, nombres, apellido paterno, apellido materno (opcional), correo institucional; Estatus oculto
  en el alta (activo por defecto, visible solo al editar).
- Paso 2, Foto de plantilla (opcional): contador de tomas "3 de 5", ayuda de calidad bajo cada bloque y enlace "Omitir
  por ahora" que deja el alumno marcado como "Sin plantilla" en el listado. Usa la captura guiada existente.
- Paso 3, Inscripción (opcional): elegir grupos o dejarlo para después. Cierre con P3.
- Refs: R4, R5, R7.

**P8. Justificante en 3 pasos, primero celular (media)**
- Paso 1, ¿Qué se justifica?: lista de faltas y retardos con casillas (permitir varias sesiones del mismo motivo).
- Paso 2, Motivo y documento: texto del motivo con contador, `FileInput` para PDF, JPG o PNG hasta 5 MB y miniatura;
  tarjeta de ayuda "qué documento sirve" en acordeón (`Detalles`) en celular y lateral en pantallas anchas.
- Paso 3, Revisar y enviar: resumen con Editar; envío y cierre "Enviado, estado Pendiente" con enlace a Mis
  justificantes. Nombre del paso encima de la barra y pie fijo.
- Refs: R14, R16, R7, R5.

**P9. Catálogos y cámara en panel lateral de un paso (media)**
- Aula (clave, edificio, capacidad), materia (clave, nombre, créditos, horas por semana), docente (número de empleado,
  correo, apellidos, nombres, estatus) y usuario (correo, rol): panel con pie fijo y acciones "Guardar" y "Guardar y
  crear otro" (mantiene el contexto, limpia el formulario).
- Capacidad del aula con control +/- además de teclear.
- Usuario: el rol como tarjetas de opción con una línea que explica qué puede hacer; tras crear, mostrar una sola vez la
  contraseña temporal con botón de copiar.
- Cámara: tipo (IP, webcam, simulada) como tarjetas de opción con descripción; el campo de dirección IP aparece solo si
  el tipo es IP; botón "Probar conexión" antes de guardar (propuesta propia, no es una captura vista).
- Refs: R4, R6, R8, R16.

**P10. Reglas transversales de formulario (alta, todas las pantallas)**
- Marcar lo opcional con la palabra "opcional" en la etiqueta cuando casi todo es obligatorio (R4, R14), en lugar de
  asteriscos por todos lados.
- Texto de ayuda justo bajo el campo y solo cuando evita un error (formato de periodo, qué no se podrá editar después).
- Botones con verbo y objeto ("Crear grupo", "Importar 38 alumnos"), nunca "Aceptar" ni "Siguiente" en el último paso.
- "Omitir por ahora" solo en pasos opcionales, con consecuencia visible después (insignia "Pendiente").
- Botón principal apagado solo mientras nada cambió; ante datos inválidos, habilitado y con resumen de errores
  (decisión de SUSAN: en Etsy y Deputy el botón apagado no dice qué falta).
- Al cambiar de paso el foco va al título (ya existe en `Onboarding.jsx`), con `aria-live` para "Paso N de M".
- Onboarding: conservar los cuatro pasos actuales pero marcar como omitible el de estilo y cerrar con tarjetas de
  primera acción por rol (P3).
- Refs: R4, R14, R16, R5.

## 3. Anti-patrones vistos (evitar)

1. **Cierre sin siguiente paso**: una pantalla de "todo listo" cuyo único botón es cerrar la ventana, o una confirmación
   casi vacía con texto diminuto. Dropbox Dash `https://mobbin.com/screens/654d1eff-5b5e-411e-820d-2eeca4b4e369`;
   Shopify `https://mobbin.com/screens/e7ce422e-8da9-4092-a176-c6b26cf1124d`. Alternativa: P3.
2. **Panel decorativo a media pantalla**: ilustraciones, fotos de clientes o confeti junto al formulario (AirOps, fal,
   Hootsuite, Calendly). Rompe a 360 px y no informa. Solo se admite un panel que muestre el resultado real (R14).
3. **Botón principal apagado sin explicar** (Etsy `https://mobbin.com/screens/0ff32a80-5fad-4696-bf38-27ce61044fa5`,
   Deputy). Preferir habilitado + errores visibles (P10).
4. **Un asistente para formularios de dos o tres campos** (Delphi en nombre y apellido): para catálogos simples basta un
   panel de un paso (P1, P9).
5. **Tres selectores seguidos con texto de relleno** para datos demográficos (Hootsuite): chips o tarjetas son más
   rápidos de elegir. En SUSAN, tipo de cámara, rol y estatus mejor como tarjetas o píldoras.
6. **Preguntas de marketing en el flujo** (de dónde nos conociste, objetivos de uso): SUSAN solo debe pedir lo que
   cambia lo que se muestra o se crea.
7. **Mapeo de importación denso con avisos legales delante** (Klaviyo antes de la tabla): ordenar al revés: primero la
   tabla y el resultado esperado, avisos plegados con `Detalles`.
8. **Horario como siete filas de selectores nativos largos** (DoorDash, horarios): para cursos de pocos bloques son
   mejores los días como botones y copiar (P4).
9. **Revisión final sin Editar** o sin volver al paso exacto: en cuanto hay revisión, cada bloque debe tener su Editar
   (R7).
10. **Pasos bloqueados sin motivo**: si un paso muestra candado, decir qué falta (R2 solo lo insinúa con el icono).
