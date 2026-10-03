# Dominio REVISION: revisión, correcciones y justificantes (M5)

Contrato técnico de la cola de revisión P-05, la corrección de asistencia (RF-11), los justificantes (RF-12) y la consulta
de recortes (RF-18/RF-19). Cubre BPMN-02. Fuente: `docs/spec/Avance1.txt` (Tabla 3, 4, 5, 6, 12, 13, diccionario Tablas 22-31,
Tabla 36, §3.2.3, §3.6.5). Reglas transversales: `docs/ARCHITECTURE.md`. Diseño visual **mínimo** (solo base funcional;
el rediseño vendrá después): este documento describe contenido y comportamiento, no estética.

Convenciones de este documento:

- Esquema `public` para `api_*` / `svc_*`; esquema privado `app` para lo interno. Toda función lleva
  `SET search_path = public, app, pg_temp`.
- Tipos de enum de la spec: `estado_asistencia` (`presente|retardo|ausente|pendiente|justificado`),
  `origen_asistencia` (`automatico|manual|correccion`), `estatus_justificante` (`pendiente|aprobado|rechazado`),
  `accion_bitacora`, `estatus_sesion` (`programada|abierta|cerrada`, más `suspendida` por extensión), `posicion_camara`.
- Los parámetros que reciben un estado usan `text` (no el enum) para que un valor ajeno devuelva `VALIDACION` y no el error
  22P02 del motor.
- Fechas ISO 8601: `fecha` = `YYYY-MM-DD`, `hora_*` = `HH:MM:SS`, instantes con offset (`-06:00`). Todo tiempo de negocio
  usa `app.now()`; la hora de clase es `(fecha + hora) AT TIME ZONE app.tz()`.
- Errores: `RAISE EXCEPTION '<mensaje>' USING ERRCODE = 'P0001', HINT = '<CODIGO>'`.

---

## 1. Alcance y trazabilidad

### 1.1 Qué entra y qué no

Entra: cola de revisión del docente (pendientes, justificantes, correcciones), resolución de pendientes y correcciones
(plazo de 48 h), registro y resolución de justificantes con documento en el bucket, consulta de lecturas y recortes por URL
firmada con asiento en bitácora, resolución automática de pendientes vencidos (función interna que ejecuta el job), y el
componente del alumno para registrar y ver justificantes.

No entra (otros dominios): cierre de sesión y creación de pendientes (`sesiones`), recálculo de faltas y derecho a examen
(`reportes`: `app.recalcular_inscripcion`), el job HTTP `/api/jobs/resolver-pendientes` y su `svc_*` (`biometria`), la página
`/alumno` y su historial (`reportes`), el panel P-02 (`screens-docente`).

### 1.2 Trazabilidad requisito → artefacto

| Requisito | Artefacto que lo cubre |
|---|---|
| RF-11 (corregir hasta 48 h, origen `correccion`, bitácora) | `api_corregir_asistencia`, `app.aplicar_correccion`, `app.limite_correccion`, `trg_asistencia_ciclo` (requisitos en §5.4), pantalla P-05 (`ResolverComo`, `CorregirRegistro`) |
| RF-11 (vencido: job resuelve a `ausente` con cuenta de servicio) | `app.resolver_pendientes_vencidos` (la invoca el `svc_*` del job de `biometria`) |
| RF-11 (corrección iniciada por el docente, evento «Registro por corregir» de BPMN-02) | `api_sesiones_corregibles`, `api_registros_corregibles`, componente `CorregirRegistro` |
| RF-12 (registrar justificante, alumno o docente) | `api_validar_justificante`, `api_registrar_justificante`, `POST /api/justificantes/documento`, `RegistrarJustificanteForm`, FK compuesta `fk_justificante_asistencia` |
| RF-12 (aprobar/rechazar; RN-09 conserva registro y detecciones) | `api_resolver_justificante`, `ResolverJustificante`, `ck_justificante_resolucion` |
| RF-12 (alumno ve estatus) / P-08 | `api_mis_justificantes`, `api_mis_justificables`, `MisJustificantes`, `JustificantesAlumno` |
| RF-12 (docente consulta documento por URL firmada) | `api_justificante_documento`, `GET /api/justificantes/{id}/documento` |
| RF-18 (cola con lecturas, score, recortes por URL firmada, plazo) | `api_cola_revision`, `ColaRevision`, `ListaCasos`, `DetalleCaso`, `LecturasCaso`, `PlazoRestante` |
| RF-19 (consulta de recortes/detecciones: solo sus grupos + bitácora con IP) | `api_detecciones_caso` (INVOKER + RLS), `GET /api/casos/{id_asistencia}/detecciones`, `svc_registrar_consulta_revision`, `app.bitacora` |
| RN-08 (48 h desde `hora_fin`, valor anterior en bitácora) | `app.limite_correccion`, `api_corregir_asistencia`, `app.aplicar_correccion`, `ck_bitacora_valores` |
| RN-09 (aprobado = `justificado` sin borrar nada) | `api_resolver_justificante` (solo `UPDATE asistencia.estado/origen`; no toca `deteccion`) |
| RN-03 (límites 9:59 / 10:00 para sugerir estado) | `app.estado_sugerido_revision`, campo `estado_sugerido` de la cola |
| RN-05 (1-2 lecturas = pendiente → cola) | `api_cola_revision` (pestaña Pendientes) |
| RN-10 / RN-11 (recálculo, `derecho_examen` reversible, bitácora `notificacion`) | llamada a `app.recalcular_inscripcion` (dominio `reportes`) desde corrección, resolución y job |
| RNF-04 (URL firmada ≤ 300 s) | handlers de §4 con TTL = `LEAST(vigencia_url_firmada_seg, 300)` |
| RNF-05 (recorte purgado a 7 días → `objeto_recorte` NULL) | `RecorteImagen` muestra silueta; `api_detecciones_caso` devuelve `objeto_recorte` nulo sin error |
| RNF-08 (100 % correcciones, resoluciones y consultas en bitácora) | acciones `correccion`, `aprobacion_justificante`, `rechazo_justificante`, `consulta` (§3, §4) |
| RNF-10 (sin registros huérfanos) | FK compuesta del justificante; `api_registrar_justificante` valida antes de insertar |
| RNF-11 (≤ 3 interacciones por caso pendiente) | diseño de `DetalleCaso` + `ResolverComo` (§2.1.4) |
| RNF-13 (funcional desde 360 px) | §2.1.5 |
| RNF-03 (ninguna imagen en la BD) | la BD guarda solo `objeto_documento`/`objeto_recorte`/`objeto_foto`; los handlers no persisten bytes fuera del bucket |
| Tabla 36 (permisos) | Corregir, aprobar/rechazar y consultar recortes: docente de **sus** grupos; registrar justificante: docente (sus grupos) y alumno (propios); admin y técnico no participan |
| BPMN-02, inicio «Pendiente al cierre» | `api_cola_revision.pendientes` |
| BPMN-02, inicio «Justificante enviado» | `RegistrarJustificanteForm` → `api_registrar_justificante` → `api_cola_revision.justificantes` |
| BPMN-02, inicio «Registro por corregir» | `CorregirRegistro` → `api_corregir_asistencia` |
| BPMN-02, inicio «48 h después de hora_fin» | `app.resolver_pendientes_vencidos` |
| BPMN-02, compuerta «¿Dentro de 48 h?» | `RN_08_PLAZO_VENCIDO` |
| BPMN-02, compuerta «¿Justificante aprobado?» | `api_resolver_justificante(p_aprobar)` |

---

## 2. Pantallas

### 2.1 P-05 Cola de revisión

#### 2.1.1 Ficha

| Campo | Valor |
|---|---|
| Ruta | `/docente/revision` (grupo `(app)`, archivo `web/src/app/(app)/docente/revision/page.jsx`) |
| Parámetros de URL | `?pestana=pendientes\|justificantes\|correcciones` (def. `pendientes`) y `?caso=<id>` (`id_asistencia` en Pendientes, `id_justificante` en Justificantes). P-02 enlaza los contadores a `?pestana=pendientes` y `?pestana=justificantes` |
| Roles | `docente`. Cualquier otro rol: el layout redirige a su inicio; si llegara a las RPC, `NO_AUTORIZADO` |
| Objetivo | Que el docente vea todos los casos por decidir de **sus** grupos y los resuelva (RF-18, RF-11, RF-12, RF-19) |
| Página | Delgada: `const sp = await searchParams;` y renderiza `<ColaRevision pestanaInicial={sp.pestana} casoInicial={Number(sp.caso) \|\| null} />` |

#### 2.1.2 Datos y acciones

| Qué | RPC / ruta | Cuándo |
|---|---|---|
| Cola inicial y contadores | `api_cola_revision` (`colaRevision({})`) | al montar y tras cada acción exitosa |
| Más casos de una pestaña | `colaRevision({ pestana, limit: 50, offset })` | botón «Ver más» |
| Lecturas, foto de registro y recortes del caso | `GET /api/casos/{id_asistencia}/detecciones` (cliente `obtenerDeteccionesCaso`) | al abrir un caso de Pendientes o Justificantes (cada apertura deja una fila `consulta` en bitácora) |
| Resolver pendiente / corregir | `api_corregir_asistencia` (`corregirAsistencia`) | clic en «Resolver como …» |
| Aprobar / rechazar justificante | `api_resolver_justificante` (`resolverJustificante`) | botones del caso, con `ConfirmDialog` |
| Ver documento del justificante | `GET /api/justificantes/{id}/documento` (`obtenerDocumentoJustificante`) | botón «Ver documento» |
| Sesiones corregibles | `api_sesiones_corregibles` (`sesionesCorregibles`) | pestaña Correcciones, bloque «Corregir un registro» |
| Registros de una sesión | `api_registros_corregibles` (`registrosCorregibles`) | al elegir una sesión |
| Registrar justificante a nombre de un alumno | `POST /api/justificantes/documento` + `api_registrar_justificante` | modal con `RegistrarJustificanteForm` (modo `docente`) |

#### 2.1.3 Contenido y comportamiento

Encabezado: `PageHeader` «Revisión» y `Tabs` **Pendientes (n) · Justificantes (n) · Correcciones (n)** con los contadores de
`contadores` (la pestaña Correcciones cuenta `correcciones_recientes`). Cada contador tiene texto accesible
«n casos». Orden: pendientes por `vence_en` ascendente (el más urgente primero), justificantes por `fecha_registro` ascendente.

**Pestaña Pendientes.** Lista de casos; al elegir uno se abre `DetalleCaso` con:

1. Alumno (matrícula, nombre), materia, grupo, sesión (fecha, horario) y `StatusChip` «pendiente».
2. `PlazoRestante` (48 h desde `hora_fin`; «Plazo vencido» si `segundos_restantes <= 0`).
3. Resumen «Lecturas válidas: x/3» (3 = `min_detecciones_validas`; el valor viene del servidor, no se codifica: se muestra `conteo_detecciones` y el mínimo se lee de la respuesta).
4. `LecturasCaso`: foto de registro (por URL firmada) y una fila por lectura: cámara (frente/fondo), hora, minuto de la sesión, score con 3 decimales, «Válida» / «No válida» y el recorte (`RecorteImagen`).
5. `ResolverComo` con tres botones (**Presente**, **Retardo**, **Ausente**); el sugerido (`estado_sugerido`, regla RN-03 sobre la primera lectura válida) va marcado con el texto «Sugerido». Campo opcional «Comentario» (máx. 200).

**Pestaña Justificantes.** Lista de justificantes `pendiente`; el detalle muestra alumno/sesión, estado actual del registro
(`ausente` o `retardo`), motivo, quién lo registró (alumno o docente) y cuándo, botón «Ver documento», las lecturas del caso
(si las hay; una ausencia puede no tener ninguna), campo «Comentario» opcional y los botones **Aprobar** / **Rechazar**
(`ConfirmDialog`: «Aprobar cambia el registro a justificado y no se puede deshacer»; «Rechazar conserva el estado del registro»).

**Pestaña Correcciones.** Dos bloques:

- «Corregir un registro» (`CorregirRegistro`): `Select` de sesiones corregibles (muestra grupo, fecha y plazo restante) → lista de los registros de la sesión (alumno, `StatusChip` del estado, origen) con botones de los estados destino permitidos (todos menos el actual; `justificado` y `pendiente` nunca se ofrecen) y, en `ausente`/`retardo`, el botón «Registrar justificante» (abre el modal).
- «Correcciones recientes» (`HistorialCorrecciones`): por cada corrección: alumno, sesión, `estado_anterior → estado_nuevo`, quién (tú / sistema), cuándo, comentario y, si `corregible`, botón «Corregir de nuevo» que lleva al bloque anterior con ese registro. Las resoluciones automáticas por plazo vencido aparecen con la etiqueta «Automática (plazo vencido)».

#### 2.1.4 Interacciones para resolver un pendiente (RNF-11, ≤ 3)

1. Abrir la cola (entrar a `/docente/revision`; la pestaña Pendientes es la inicial).
2. Elegir el caso (clic en la fila; evidencia y sugerido ya visibles).
3. Clic en «Resolver como X». **No hay diálogo de confirmación**: la decisión es reversible dentro del plazo (el docente puede volver a corregir entre `presente`/`retardo`/`ausente`). Al terminar: `Toast` «Resuelto como X», el caso sale de la lista, se recargan los contadores y se selecciona el siguiente caso pendiente (en 360 px se vuelve a la lista).

Aprobar/rechazar un justificante sí pide confirmación (acción no reversible); RNF-11 se mide sobre pendientes.
Si la respuesta de la RPC trae `inscripcion.derecho_examen = false` con `derecho_examen_anterior = true`, el `Toast` agrega
«El alumno queda sin derecho a examen»; si pasó de `false` a `true`, «El alumno recupera el derecho a examen».

#### 2.1.5 Estados de pantalla y 360 px

| Estado | Comportamiento |
|---|---|
| Carga inicial | `DataState` con `Spinner` y texto «Cargando casos…» |
| Vacío por pestaña | `EmptyState`: «No tienes pendientes por revisar.» / «No hay justificantes por resolver.» / «Aún no hay correcciones en los últimos 30 días.» |
| Error de carga de la cola | `ErrorState` con mensaje de `ApiError.message` y botón «Reintentar» |
| Carga de lecturas | dentro de `LecturasCaso`: `Spinner` pequeño; si falla, `Alert` «No se pudieron cargar las lecturas» con «Reintentar». **Resolver sigue habilitado** (la evidencia no es requisito de la decisión) |
| Recorte purgado (`objeto_recorte` NULL, más de 7 días) | `RecorteImagen` muestra silueta y la leyenda «Recorte eliminado» |
| URL firmada vencida (la imagen falla al cargar tras ~5 min) | `RecorteImagen` muestra «Enlace vencido» y el botón «Volver a cargar» (vuelve a llamar al handler, lo que asienta otra consulta en bitácora; es lo esperado) |
| Acción en curso | botones del caso deshabilitados con `Spinner`; sin doble envío |
| Error de acción | `Alert` dentro del detalle con el `message` de la RPC. `RN_08_PLAZO_VENCIDO`: además se recarga la cola (el caso ya habrá pasado a `ausente` o quedará sin acción) |
| Plazo vencido | `ResolverComo` deshabilitado con el texto «El plazo de corrección venció; el sistema lo resolverá como ausente» (el servidor sigue siendo quien decide) |
| Concurrencia | `SIN_CAMBIO` / `TRANSICION_NO_PERMITIDA`: `Alert` y recarga de la cola |

360 px: una sola columna. Lista y detalle se alternan (el detalle reemplaza a la lista con un botón «Volver a la lista»); desde
`md` (768 px) van en dos columnas. Las lecturas se muestran como filas apiladas (hora · cámara · score · válida), sin tabla con
desplazamiento horizontal. Los botones de «Resolver como» ocupan todo el ancho y se apilan. Ningún dato depende solo del color
(`StatusChip` siempre lleva texto). Objetivos táctiles ≥ 44 px.

#### 2.1.6 Componentes (`web/src/components/revision/`)

Los componentes ui-kit se usan por nombre (`Button`, `Tabs`, `Modal`, `ConfirmDialog`, `StatusChip`, `Alert`, `Toast`,
`DataState`, `EmptyState`, `ErrorState`, `Select`, `Textarea`, `Spinner`, `PageHeader`); sus props las fija `plataforma`.
Acceso a datos solo por `@/lib/api/revision` y `@/lib/http/revision` (§4.4).

| Carpeta | Props | Responsabilidad |
|---|---|---|
| `ColaRevision/` (`ColaRevision.jsx`, `useColaRevision.js`, `colaRevision.utils.js`) | `pestanaInicial?: 'pendientes'\|'justificantes'\|'correcciones'`, `casoInicial?: number\|null` | Contenedor `'use client'`. Carga `colaRevision`, guarda pestaña y caso seleccionado (sincroniza `?pestana`/`?caso` con `router.replace`), aplica «Ver más», recarga tras cada acción, selecciona el siguiente caso. Calcula el estado de pantalla (§2.1.5) |
| `ListaCasos/` | `tipo: 'pendiente'\|'justificante'`, `items: object[]`, `total: number`, `seleccionadoId: number\|null`, `onSeleccionar(item)`, `onCargarMas?()`, `cargandoMas?: boolean` | Una fila por caso: alumno, materia · grupo, fecha de la sesión, `PlazoRestante` (pendientes) o fecha de registro y quién lo registró (justificantes), `StatusChip` del estado. Botón «Ver más» si `items.length < total` |
| `DetalleCaso/` (`DetalleCaso.jsx`, `useDetalleCaso.js`) | `tipo: 'pendiente'\|'justificante'`, `caso: object` (elemento de la cola), `onResuelto(resultado)`, `onCerrar()` | Panel del caso. `useDetalleCaso(idAsistencia)` llama `obtenerDeteccionesCaso` (estado `cargando\|listo\|error`, `recargar`). Compone encabezado, `PlazoRestante`, `LecturasCaso` y `ResolverComo` o `ResolverJustificante`. Llama `corregirAsistencia` y mapea el resultado a `onResuelto` |
| `LecturasCaso/` | `fotoRegistro: {url, expira_en}\|null`, `lecturas: Lectura[]`, `total: number`, `estado: 'cargando'\|'listo'\|'error'`, `error?: ApiError`, `onRecargar()` | Lista de lecturas (§2.1.3); sin lecturas: texto «Sin lecturas del reconocimiento facial en esta sesión» |
| `RecorteImagen/` | `url?: string\|null`, `expiraEn?: string`, `purgado?: boolean`, `alt: string`, `onExpirada?()` | `<img>` de la URL firmada con `loading="lazy"`; silueta si no hay URL; en `onError` muestra «Enlace vencido» y «Volver a cargar» (`onExpirada`). No guarda la URL fuera de memoria |
| `ResolverComo/` | `estadoActual: 'pendiente'\|'presente'\|'retardo'\|'ausente'`, `estadoSugerido?: string`, `deshabilitado?: boolean`, `motivoDeshabilitado?: string`, `cargando?: boolean`, `compacto?: boolean`, `onResolver(estado: string, comentario: string\|null): Promise<void>` | Botones de estado destino (todos menos el actual), marca «Sugerido», `Textarea` opcional de comentario (≤ 200, contador). Un clic en un botón ejecuta `onResolver` |
| `PlazoRestante/` (`PlazoRestante.jsx`, `plazoRestante.utils.js`) | `venceEn: string`, `segundosRestantes: number` | Texto «Quedan 31 h 12 min» / «Quedan 42 min» / «Plazo vencido» y la fecha límite en `America/Mexico_City`. Para no depender del reloj del navegador, descuenta localmente `(Date.now() - instanteDeRecepcion)` a `segundosRestantes`; refresca cada 60 s |
| `ResolverJustificante/` | `justificante: object` (elemento de la cola), `onResuelto(resultado)` | Motivo, quién y cuándo, «Ver documento» (obtiene URL y la abre con `window.open(url, '_blank', 'noopener')`; si el navegador la bloquea muestra el enlace en el panel), comentario opcional, **Aprobar**/**Rechazar** con `ConfirmDialog`; llama `resolverJustificante` |
| `HistorialCorrecciones/` | `items: Correccion[]`, `total: number`, `onCorregirDeNuevo(item)`, `onCargarMas?()` | Lista de correcciones recientes (§2.1.3) |
| `CorregirRegistro/` | `registroInicial?: {idSesion: number, idAsistencia: number}`, `onCorregido()` | Selector de sesión corregible, lista de registros con `ResolverComo` compacto y modal con `RegistrarJustificanteForm` (modo `docente`) |

Tipos usados arriba: `Lectura` y `Correccion` son los objetos definidos en §3 (`lecturas[]` de la cola o de
`api_detecciones_caso`, y `correcciones_recientes[]`).

### 2.2 Bloque del alumno dentro de P-08 (`/alumno`)

La página `/alumno` es del dominio `reportes`; este dominio define los componentes que ella monta, en
`web/src/components/alumno/`. La página solo agrega `<JustificantesAlumno idSesionInicial={Number(sp.justificar) || null} />`
(el historial de `reportes` puede enlazar una falta con `/alumno?justificar=<id_sesion>`).

| Carpeta | Props | Responsabilidad |
|---|---|---|
| `JustificantesAlumno/` | `idSesionInicial?: number\|null` | Contenedor: monta `RegistrarJustificanteForm` y `MisJustificantes`; al registrar incrementa un `refreshKey` compartido para recargar ambos |
| `RegistrarJustificanteForm/` (`RegistrarJustificanteForm.jsx`, `useRegistrarJustificante.js`, `registrarJustificante.utils.js`) | `modo?: 'alumno'\|'docente'` (def. `'alumno'`), `idSesion?: number\|null`, `idAlumno?: number\|null`, `registros?: Justificable[]`, `onRegistrado?(justificante)`, `onCancelar?()` | Formulario (ver abajo) |
| `MisJustificantes/` | `refreshKey?: number` | Lista de mis justificantes con su estatus (`Pendiente`, `Aprobado`, `Rechazado`) junto a la sesión y la materia; llama `misJustificantes`. Vacío: «Aún no has enviado justificantes» |

**RegistrarJustificanteForm.**

- Modo `alumno`: si no recibe `registros`, los carga con `misJustificables` (RPC §3.6). Campos: `Select` «Falta o retardo a justificar»
  (texto: «Materia · Grupo — fecha — Ausente/Retardo»; preselecciona `idSesion` si coincide), `Textarea` «Motivo» (1 a 200, contador),
  `FileInput` «Documento» (`.pdf`, `.jpg`, `.jpeg`, `.png`; ≤ 5 MB; mismo límite que valida el servidor). Botón «Enviar justificante».
- Modo `docente`: `idSesion` e `idAlumno` son obligatorios y fijos (sin `Select`); mismos campos de motivo y documento.
- Validación en cliente (espejo, no sustituye al servidor): motivo no vacío tras `trim` y ≤ 200; archivo presente, tipo permitido,
  tamaño ≤ 5 242 880 bytes.
- Envío en dos pasos con estados `inactivo → subiendo → guardando → listo | error`:
  1. `subirDocumentoJustificante({ archivo, idSesion, idAlumno? })` → `{ objeto_documento }`.
  2. `registrarJustificante({ idSesion, motivo, objetoDocumento, idAlumno? })`.
  Si el paso 2 falla (p. ej. `JUSTIFICANTE_DUPLICADO`), el hook **conserva** el `objeto_documento` ya subido para reintentar sin volver a subir.
- Errores: `Alert` con el `message` del `ApiError`; `JUSTIFICANTE_DUPLICADO` → «Ya tienes un justificante pendiente para esta sesión»;
  `ESTADO_NO_JUSTIFICABLE` → mensaje de la RPC y recarga de `registros`.
- Vacío (modo alumno sin justificables): `EmptyState` «No tienes faltas ni retardos por justificar».
- Éxito: `Toast` «Justificante enviado; tu docente lo revisará», limpia el formulario, `onRegistrado`.
- 360 px: una columna, campos a todo el ancho.

---

## 3. RPC

### 3.0 Convenciones comunes

- Todas: `GRANT EXECUTE ... TO authenticated`; `REVOKE ALL ... FROM PUBLIC, anon`. `svc_*` solo a `service_role`.
- Rol y pertenencia: `app.rol()` (texto, `NULL` si la cuenta no existe o está inactiva → `NO_AUTORIZADO`), `app.id_docente()`,
  `app.id_alumno()`, `app.id_usuario()`. «Titular» = `grupo.id_docente = app.id_docente()`.
- Límites: `p_limit` se acota a `[1, 200]` (defaults indicados) y `p_offset` a `>= 0`.
- Sub-objetos reutilizados en los JSON (claves `snake_case`):

```text
alumno  = { id_alumno, matricula, apellido_paterno, apellido_materno|null, nombres, nombre_completo }
          nombre_completo = apellido_paterno [ ' ' apellido_materno ] ', ' nombres     ("Hernández Ruiz, Mariana")
materia = { id_materia, clave, nombre }
grupo   = { id_grupo, clave_grupo, periodo }
sesion  = { id_sesion, fecha, hora_inicio, hora_fin, modo_registro, limite_presente_min, tolerancia_min }
lectura = { id_deteccion, id_captura, marca_tiempo, minuto_sesion, camara_posicion, score_similitud, es_valida, tiene_recorte }
          minuto_sesion = round(extract(epoch FROM marca_tiempo - inicio_sesion) / 60, 2)   (numérico, 2 decimales)
```

- Plazo: `vence_en = app.limite_correccion(sesion.fecha, sesion.hora_fin)` = `((fecha + hora_fin) AT TIME ZONE app.tz()) + horas_limite_correccion horas`;
  `segundos_restantes = floor(extract(epoch FROM vence_en - app.now()))` (puede ser negativo); `vencido = segundos_restantes < 0`.
  Regla del límite: **hasta `vence_en` inclusive se acepta** (`app.now() <= vence_en`); un segundo después se rechaza.
- `nombre_completo` y los demás datos de personas solo se devuelven para filas que el invocador puede ver.

### 3.1 `api_cola_revision`

```sql
public.api_cola_revision(
    p_pestana text    DEFAULT NULL,   -- NULL = las tres listas; 'pendientes' | 'justificantes' | 'correcciones'
    p_limit   integer DEFAULT 50,
    p_offset  integer DEFAULT 0
) RETURNS jsonb
-- SECURITY INVOKER, STABLE
```

- **Quién**: `docente`. Otro rol → `NO_AUTORIZADO`. (Compatible con el contrato `api_cola_revision()`: todos los parámetros tienen default.)
- **Lee**: `asistencia`, `sesion_clase`, `grupo`, `materia`, `alumno`, `inscripcion`, `justificante`, `captura`, `camara`, `deteccion`, `plantilla_facial`; y `bitacora_auditoria` a través de `app.correcciones_recientes` (SECURITY DEFINER, §5.2),
  porque la RLS de la bitácora solo admite al administrador (Tabla 36). **Escribe**: nada. **No** asienta bitácora (§7 Decisión 8).
- **Reglas**: RF-18 (solo casos de sus grupos; la RLS lo impone y el `WHERE` repite `g.id_docente = app.id_docente()` como defensa);
  RN-05 (pendiente = registro automático con 1-2 lecturas válidas al cierre); RN-08 (plazo); RN-03 (estado sugerido).
- **Qué entra en cada lista**:
  - `pendientes`: `asistencia.estado = 'pendiente'` de sesiones con `estatus = 'cerrada'` (los pendientes de una sesión abierta aún acumulan lecturas y no se muestran). Si el job aún no los resolvió y ya vencieron, aparecen con `vencido = true`.
  - `justificantes`: `justificante.estatus = 'pendiente'` de grupos titulares.
  - `correcciones_recientes`: asientos `correccion` sobre `asistencia` de sus grupos en los últimos 30 días (incluye las resoluciones automáticas con la cuenta de servicio).
- **Lecturas del caso** (`lecturas`): detecciones cuyo candidato (`plantilla_facial.id_alumno`) es el alumno del caso y cuya captura pertenece a la sesión;
  se devuelven hasta 10 por caso, ordenadas `es_valida DESC, score_similitud DESC, marca_tiempo`; `total_lecturas` da el total real.
  **Nunca** se devuelven rutas (`objeto_*`), solo `tiene_recorte`.
- **Estado sugerido** (`estado_sugerido`, solo pendientes): `app.estado_sugerido_revision(hora_registro, fecha, hora_inicio, limite_presente_min)`.
- **Orden**: pendientes `vence_en ASC`; justificantes `fecha_registro ASC`; correcciones `fecha_hora DESC`.
- **Paginación**: `p_limit`/`p_offset` se aplican a cada lista incluida; con `p_pestana` solo se llena esa lista (las otras van `[]`).
  `contadores` es siempre el total real sin paginar.

Retorno (ejemplo, lunes 14-sep-2026 09:40, grupo 3A):

```json
{
  "generado_en": "2026-09-14T09:40:12-06:00",
  "horas_limite_correccion": 48,
  "min_detecciones_validas": 3,
  "contadores": { "pendientes": 7, "justificantes": 2, "correcciones_recientes": 3 },
  "pendientes": [
    {
      "id_asistencia": 345,
      "estado": "pendiente",
      "origen": "automatico",
      "hora_registro": "2026-09-14T07:04:55-06:00",
      "conteo_detecciones": 2,
      "alumno": { "id_alumno": 41, "matricula": "A230417", "apellido_paterno": "Hernández", "apellido_materno": "Ruiz", "nombres": "Mariana", "nombre_completo": "Hernández Ruiz, Mariana" },
      "materia": { "id_materia": 7, "clave": "FIN301", "nombre": "Finanzas corporativas" },
      "grupo": { "id_grupo": 12, "clave_grupo": "3A", "periodo": "2026-2" },
      "sesion": { "id_sesion": 188, "fecha": "2026-09-14", "hora_inicio": "07:00:00", "hora_fin": "09:00:00", "modo_registro": "automatico", "limite_presente_min": 10, "tolerancia_min": 20 },
      "vence_en": "2026-09-16T09:00:00-06:00",
      "segundos_restantes": 170388,
      "vencido": false,
      "estado_sugerido": "presente",
      "lecturas_validas": 2,
      "total_lecturas": 3,
      "mejor_score": 0.912,
      "lecturas": [
        { "id_deteccion": 90017, "id_captura": 4101, "marca_tiempo": "2026-09-14T07:04:55-06:00", "minuto_sesion": 4.92, "camara_posicion": "frente", "score_similitud": 0.912, "es_valida": true, "tiene_recorte": true },
        { "id_deteccion": 90102, "id_captura": 4108, "marca_tiempo": "2026-09-14T07:05:10-06:00", "minuto_sesion": 5.17, "camara_posicion": "fondo", "score_similitud": 0.874, "es_valida": true, "tiene_recorte": true },
        { "id_deteccion": 90188, "id_captura": 4115, "marca_tiempo": "2026-09-14T07:05:25-06:00", "minuto_sesion": 5.42, "camara_posicion": "frente", "score_similitud": 0.801, "es_valida": false, "tiene_recorte": true }
      ]
    }
  ],
  "justificantes": [
    {
      "id_justificante": 15,
      "id_asistencia": 350,
      "estado_asistencia": "ausente",
      "motivo": "Cita médica en el IMSS; se anexa constancia.",
      "fecha_registro": "2026-09-14T08:12:03-06:00",
      "registrado_por_rol": "alumno",
      "alumno": { "id_alumno": 44, "matricula": "A230502", "apellido_paterno": "Gómez", "apellido_materno": null, "nombres": "Luis", "nombre_completo": "Gómez, Luis" },
      "materia": { "id_materia": 7, "clave": "FIN301", "nombre": "Finanzas corporativas" },
      "grupo": { "id_grupo": 12, "clave_grupo": "3A", "periodo": "2026-2" },
      "sesion": { "id_sesion": 181, "fecha": "2026-09-11", "hora_inicio": "07:00:00", "hora_fin": "09:00:00", "modo_registro": "automatico", "limite_presente_min": 10, "tolerancia_min": 20 },
      "lecturas_validas": 0,
      "total_lecturas": 0,
      "mejor_score": null,
      "lecturas": []
    }
  ],
  "correcciones_recientes": [
    {
      "id_bitacora": 10231,
      "fecha_hora": "2026-09-14T09:31:40-06:00",
      "id_asistencia": 346,
      "usuario": { "id_usuario": 5, "rol": "docente" },
      "automatica": false,
      "alumno": { "id_alumno": 42, "matricula": "A230431", "apellido_paterno": "Pérez", "apellido_materno": "Díaz", "nombres": "Ana", "nombre_completo": "Pérez Díaz, Ana" },
      "materia": { "id_materia": 7, "clave": "FIN301", "nombre": "Finanzas corporativas" },
      "grupo": { "id_grupo": 12, "clave_grupo": "3A", "periodo": "2026-2" },
      "sesion": { "id_sesion": 188, "fecha": "2026-09-14", "hora_inicio": "07:00:00", "hora_fin": "09:00:00", "modo_registro": "automatico", "limite_presente_min": 10, "tolerancia_min": 20 },
      "estado_anterior": "pendiente",
      "estado_nuevo": "retardo",
      "comentario": "Llegó pasadas las 7:10",
      "estado_actual": "retardo",
      "vence_en": "2026-09-16T09:00:00-06:00",
      "corregible": true
    }
  ]
}
```

`corregible` = `app.now() <= vence_en AND estado_actual <> 'justificado'`. En `justificantes`, `lecturas*`/`mejor_score` se calculan igual que en pendientes (0 y `null` si no hay).

| Código | Mensaje | Cuándo |
|---|---|---|
| `NO_AUTORIZADO` | «Solo los docentes pueden consultar la cola de revisión.» | rol distinto de `docente` |
| `VALIDACION` | «Pestaña no válida: use pendientes, justificantes o correcciones.» | `p_pestana` fuera de dominio |

### 3.2 `api_corregir_asistencia`

```sql
public.api_corregir_asistencia(
    p_id_asistencia integer,
    p_estado        text,                -- 'presente' | 'retardo' | 'ausente'
    p_comentario    text DEFAULT NULL    -- opcional, <= 200 caracteres tras trim
) RETURNS jsonb
-- SECURITY DEFINER, VOLATILE
```

- **Quién**: `docente` titular del grupo de la sesión. **Lee/escribe**: `asistencia` (`UPDATE estado, origen, hora_registro`), `bitacora_auditoria` (vía `app.bitacora`),
  `sesion_clase`, `grupo`, `justificante`, `inscripcion`; llama `app.recalcular_inscripcion`.
- **Reglas**: RF-11, RN-08, RNF-08, RN-10/11 (recálculo).
- **Pasos** (todo en una transacción):
  1. `app.rol() = 'docente'`, si no `NO_AUTORIZADO`.
  2. `p_estado` ∈ {`presente`,`retardo`,`ausente`}; `pendiente` y `justificado` → `TRANSICION_NO_PERMITIDA`; cualquier otro texto → `VALIDACION`.
  3. `p_comentario`: `trim`; vacío → `NULL`; más de 200 caracteres → `VALIDACION`.
  4. `SELECT ... FROM asistencia a JOIN sesion_clase s JOIN grupo g WHERE id_asistencia = p_id_asistencia FOR UPDATE OF a`. No existe → `NO_ENCONTRADO`; existe pero `g.id_docente <> app.id_docente()` → `NO_AUTORIZADO`.
  5. `s.estatus <> 'cerrada'` → `SESION_NO_CERRADA`.
  6. `a.estado = 'justificado'` → `TRANSICION_NO_PERMITIDA` (un justificado no se revierte; §7 Decisión 2). `a.estado = p_estado` → `SIN_CAMBIO`.
  7. Plazo: `app.now() > app.limite_correccion(s.fecha, s.hora_fin)` → `RN_08_PLAZO_VENCIDO`.
  8. Si `p_estado = 'presente'` y existe un justificante `pendiente` de ese registro → `JUSTIFICANTE_PENDIENTE` (un presente ya no es justificable; el docente debe resolver el justificante primero).
  9. `app.aplicar_correccion(p_id_asistencia, p_estado, p_comentario, app.id_usuario(), NULL)` (§5.2): `UPDATE asistencia SET estado = p_estado, origen = 'correccion', hora_registro = CASE WHEN p_estado = 'ausente' THEN NULL ELSE hora_registro END` (por `ck_asistencia_ausente_sin_hora`; la hora original queda en `valor_anterior` y en las detecciones); `conteo_detecciones` **no** se toca (solo lo escribe la consolidación).
  10. Bitácora: acción `correccion`, entidad `asistencia`, `id_registro = id_asistencia`, `valor_anterior = {estado, origen, hora_registro, conteo_detecciones}`, `valor_nuevo = {estado, origen, hora_registro, comentario}`.
  11. `app.recalcular_inscripcion(id_inscripcion)` de (`a.id_alumno`, `s.id_grupo`); la inscripción se localiza aunque su estatus sea `baja`.
- **Transiciones** (con `origen = 'correccion'`): `pendiente → presente|retardo|ausente`; `presente ↔ retardo`; `presente|retardo → ausente`; `ausente → presente|retardo`.
  Prohibidas: cualquiera `→ pendiente`; cualquiera `→ justificado` (solo por `api_resolver_justificante`); `justificado → *`.

Retorno:

```json
{
  "id_asistencia": 345,
  "id_sesion": 188,
  "id_alumno": 41,
  "estado_anterior": "pendiente",
  "estado": "presente",
  "origen": "correccion",
  "hora_registro": "2026-09-14T07:04:55-06:00",
  "vence_en": "2026-09-16T09:00:00-06:00",
  "id_bitacora": 10232,
  "inscripcion": { "id_inscripcion": 77, "derecho_examen_anterior": true, "derecho_examen": true }
}
```

| Código | Mensaje | Cuándo |
|---|---|---|
| `NO_AUTORIZADO` | «Solo el docente titular del grupo puede corregir la asistencia.» | rol ≠ docente, o grupo ajeno |
| `NO_ENCONTRADO` | «El registro de asistencia no existe.» | id inexistente |
| `VALIDACION` | «Estado no válido: use presente, retardo o ausente.» / «El comentario admite hasta 200 caracteres.» | paso 2 / 3 |
| `TRANSICION_NO_PERMITIDA` | «Un registro no puede volver a pendiente ni pasar a justificado por corrección; el justificado no se modifica.» | pasos 2 y 6 |
| `SIN_CAMBIO` | «El registro ya está en el estado indicado.» | paso 6 |
| `SESION_NO_CERRADA` | «La sesión sigue abierta; ciérrala antes de corregir un registro.» | paso 5 |
| `RN_08_PLAZO_VENCIDO` | «El plazo de corrección terminó el 2026-09-16 09:00 (48 h después del fin de la sesión).» | paso 7 |
| `JUSTIFICANTE_PENDIENTE` | «Hay un justificante pendiente para este registro; resuélvelo antes de marcarlo como presente.» | paso 8 |

### 3.3 `api_validar_justificante`

```sql
public.api_validar_justificante(
    p_id_sesion integer,
    p_id_alumno integer DEFAULT NULL    -- NULL para alumno; obligatorio para docente
) RETURNS jsonb
-- SECURITY DEFINER, STABLE
```

- **Quién**: `alumno` (propios) o `docente` titular. **Para qué**: precomprobación **sin escribir**, usada por `POST /api/justificantes/documento` para no subir archivos de un destino inválido. Ejecuta `app.validar_destino_justificante(p_id_sesion, p_id_alumno, false)` (§5.2), la misma verificación que `api_registrar_justificante`.
- **Retorno**: `{ "id_sesion": 181, "id_alumno": 44, "id_asistencia": 350, "estado": "ausente", "ya_tuvo_rechazo": false }`.
- **Errores**: los de §3.4 pasos 1-7 (`NO_AUTORIZADO`, `VALIDACION`, `ASISTENCIA_NO_ENCONTRADA`, `SESION_NO_CERRADA`, `ESTADO_NO_JUSTIFICABLE`, `JUSTIFICANTE_DUPLICADO`).

### 3.4 `api_registrar_justificante`

```sql
public.api_registrar_justificante(
    p_id_sesion        integer,
    p_motivo           text,
    p_objeto_documento text,
    p_id_alumno        integer DEFAULT NULL   -- NULL para alumno; obligatorio para docente
) RETURNS jsonb
-- SECURITY DEFINER, VOLATILE
```

(El orden difiere del enunciado del dominio porque PostgreSQL exige que los parámetros con default vayan al final; la llamada es por nombre, así que no cambia el contrato.)

- **Quién**: `alumno` (solo propios) o `docente` (alumnos de sus grupos). **Lee/escribe**: `asistencia` (con `FOR UPDATE`), `sesion_clase`, `grupo`, `justificante` (`INSERT`), `usuario`.
- **Reglas**: RF-12, RN-09, RNF-10. No asienta bitácora (el dominio de `accion_bitacora` no tiene un valor para el registro; la bitácora cubre resoluciones y consultas, RNF-08).
- **Pasos**:
  1. `app.rol() IN ('alumno','docente')`, si no `NO_AUTORIZADO`.
  2. Alumno destino: rol `alumno` → `app.id_alumno()`; si `p_id_alumno` viene y es distinto → `NO_AUTORIZADO`. Rol `docente` → `p_id_alumno` obligatorio (`VALIDACION`).
  3. `p_motivo`: `trim`, 1 a 200 caracteres; si no `VALIDACION`.
  4. `p_objeto_documento` debe cumplir `^justificantes/<id_alumno_destino>/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|jpg|png)$` (≤ 255 caracteres); así nadie referencia el archivo de otro alumno ni rutas con `..`. Si no `DOCUMENTO_INVALIDO`. (La existencia del objeto en el bucket no se comprueba en SQL; la garantiza el handler que lo subió.)
  5. Localiza `asistencia (id_sesion, id_alumno)` con `FOR UPDATE` (serializa registros simultáneos). No existe → `ASISTENCIA_NO_ENCONTRADA`. Rol `docente` y grupo no titular → `NO_AUTORIZADO`.
  6. `sesion.estatus <> 'cerrada'` → `SESION_NO_CERRADA`.
  7. `asistencia.estado NOT IN ('ausente','retardo')` → `ESTADO_NO_JUSTIFICABLE` (cubre `presente`, `pendiente` y `justificado`).
  8. Existe un justificante `pendiente` para (`id_sesion`,`id_alumno`) → `JUSTIFICANTE_DUPLICADO`. (Si el último fue `rechazado`, se permite uno nuevo.)
  9. `INSERT INTO justificante (id_sesion, id_alumno, motivo, objeto_documento, estatus, registrado_por, fecha_registro) VALUES (…, 'pendiente', app.id_usuario(), app.now())`. `fecha_registro` se fija explícitamente con `app.now()` (no el `DEFAULT now()`) para que `ck_justificante_resolucion` sea coherente con el reloj de pruebas.

Retorno:

```json
{
  "id_justificante": 15,
  "id_sesion": 181,
  "id_alumno": 44,
  "id_asistencia": 350,
  "estado_asistencia": "ausente",
  "estatus": "pendiente",
  "motivo": "Cita médica en el IMSS; se anexa constancia.",
  "objeto_documento": "justificantes/44/5b3c0a9e-72d4-4f1b-9c1e-0d2f6a8b4e11.pdf",
  "registrado_por_rol": "alumno",
  "fecha_registro": "2026-09-14T08:12:03-06:00"
}
```

| Código | Mensaje | Cuándo |
|---|---|---|
| `NO_AUTORIZADO` | «Solo puedes registrar justificantes de tus propias faltas.» / «Este grupo no está asignado a tu cuenta.» / «Solo alumnos y docentes pueden registrar justificantes.» | pasos 1, 2, 5 |
| `VALIDACION` | «Indica el alumno del justificante.» / «El motivo es obligatorio y admite hasta 200 caracteres.» | pasos 2, 3 |
| `DOCUMENTO_INVALIDO` | «El documento no es válido; súbelo de nuevo.» | paso 4 |
| `ASISTENCIA_NO_ENCONTRADA` | «No existe un registro de asistencia de ese alumno en esa sesión.» | paso 5 |
| `SESION_NO_CERRADA` | «La sesión aún no ha cerrado; espera a que termine.» | paso 6 |
| `ESTADO_NO_JUSTIFICABLE` | «Solo se justifica una ausencia o un retardo; el registro está en «presente».» (el nombre del estado se interpola; para `pendiente`: «El registro sigue pendiente de revisión del docente.») | paso 7 |
| `JUSTIFICANTE_DUPLICADO` | «Ya existe un justificante pendiente para este registro.» | paso 8 (y, ante carrera, violación de `ux_justificante_pendiente` 23505 mapeada a este código) |

### 3.5 `api_resolver_justificante`

```sql
public.api_resolver_justificante(
    p_id_justificante integer,
    p_aprobar         boolean,
    p_comentario      text DEFAULT NULL    -- opcional, <= 200 caracteres
) RETURNS jsonb
-- SECURITY DEFINER, VOLATILE
```

- **Quién**: `docente` titular del grupo. **Lee/escribe**: `justificante` (`FOR UPDATE`; `UPDATE estatus, resuelto_por, fecha_resolucion`), `asistencia` (`FOR UPDATE`; `UPDATE estado, origen` solo si se aprueba), `bitacora_auditoria`, `inscripcion` (vía recálculo). **No toca** `captura` ni `deteccion` (RN-09).
- **Reglas**: RF-12, RN-09, RNF-08, `ck_justificante_resolucion`. **No hay plazo** para resolver justificantes: el de 48 h (RN-08) aplica a las correcciones; el justificante es precisamente la vía que le queda al alumno cuando el pendiente se resolvió como ausente (§7 Decisión 4).
- **Pasos**:
  1. `app.rol() = 'docente'`; `p_aprobar IS NOT NULL` (si no `VALIDACION`); `p_comentario` ≤ 200 (si no `VALIDACION`).
  2. `justificante` con `FOR UPDATE` + `asistencia` con `FOR UPDATE` + `sesion_clase` + `grupo`. No existe → `NO_ENCONTRADO`; `g.id_docente <> app.id_docente()` → `NO_AUTORIZADO`.
  3. `justificante.estatus <> 'pendiente'` → `JUSTIFICANTE_YA_RESUELTO`.
  4. Si `p_aprobar`: `asistencia.estado` debe ser `ausente` o `retardo`, si no `ESTADO_NO_JUSTIFICABLE`. Entonces `UPDATE asistencia SET estado = 'justificado', origen = 'correccion'` (`hora_registro` y `conteo_detecciones` no cambian: un retardo justificado conserva la hora de su primera detección válida). `UPDATE justificante SET estatus = 'aprobado', resuelto_por = app.id_usuario(), fecha_resolucion = app.now()`.
  5. Si rechaza: `UPDATE justificante SET estatus = 'rechazado', resuelto_por = app.id_usuario(), fecha_resolucion = app.now()`; la asistencia **no se modifica**.
  6. Bitácora: aprobado → acción `aprobacion_justificante`; rechazado → `rechazo_justificante`; entidad `justificante`, `id_registro = id_justificante`.
     - aprobado: `valor_anterior = {estatus:'pendiente', estado_asistencia, origen_asistencia}`, `valor_nuevo = {estatus:'aprobado', estado_asistencia:'justificado', origen_asistencia:'correccion', id_asistencia, comentario}`.
     - rechazado: `valor_anterior = {estatus:'pendiente'}`, `valor_nuevo = {estatus:'rechazado', id_asistencia, comentario}`.
  7. `app.recalcular_inscripcion(...)` en ambos casos (idempotente; con rechazo no cambia nada).

Retorno:

```json
{
  "id_justificante": 15,
  "id_asistencia": 350,
  "estatus": "aprobado",
  "estado_asistencia_anterior": "ausente",
  "estado_asistencia": "justificado",
  "resuelto_por": 5,
  "fecha_resolucion": "2026-09-14T09:44:10-06:00",
  "id_bitacora": 10240,
  "inscripcion": { "id_inscripcion": 80, "derecho_examen_anterior": false, "derecho_examen": true }
}
```

En rechazo, `estado_asistencia_anterior` y `estado_asistencia` son iguales.

| Código | Mensaje | Cuándo |
|---|---|---|
| `NO_AUTORIZADO` | «Solo el docente titular del grupo puede resolver justificantes.» | rol o grupo |
| `NO_ENCONTRADO` | «El justificante no existe.» | id inexistente |
| `VALIDACION` | «Indica si el justificante se aprueba o se rechaza.» / «El comentario admite hasta 200 caracteres.» | paso 1 |
| `JUSTIFICANTE_YA_RESUELTO` | «Este justificante ya fue resuelto.» | paso 3 |
| `ESTADO_NO_JUSTIFICABLE` | «El registro ya no es una ausencia ni un retardo; no se puede justificar.» | paso 4 |

### 3.6 `api_mis_justificantes` y `api_mis_justificables`

```sql
public.api_mis_justificantes(p_limit integer DEFAULT 50, p_offset integer DEFAULT 0) RETURNS jsonb
public.api_mis_justificables(p_limit integer DEFAULT 50, p_offset integer DEFAULT 0) RETURNS jsonb
-- SECURITY INVOKER, STABLE
```

- **Quién**: `alumno`. Otro rol → `NO_AUTORIZADO`. La RLS limita a filas con `id_alumno = app.id_alumno()`; el `WHERE` lo repite.
- **Lee**: `justificante`, `asistencia`, `sesion_clase`, `grupo`, `materia`. **Escribe**: nada. **No** devuelve `objeto_documento` ni comentarios de la bitácora.
- `api_mis_justificantes`: todos los justificantes propios, `fecha_registro DESC`:

```json
{
  "total": 2,
  "items": [
    {
      "id_justificante": 15,
      "estatus": "pendiente",
      "motivo": "Cita médica en el IMSS; se anexa constancia.",
      "fecha_registro": "2026-09-14T08:12:03-06:00",
      "fecha_resolucion": null,
      "registrado_por_rol": "alumno",
      "id_sesion": 181,
      "id_asistencia": 350,
      "estado_asistencia": "ausente",
      "fecha": "2026-09-11",
      "hora_inicio": "07:00:00",
      "materia": { "id_materia": 7, "clave": "FIN301", "nombre": "Finanzas corporativas" },
      "grupo": { "id_grupo": 12, "clave_grupo": "3A", "periodo": "2026-2" }
    }
  ]
}
```

- `api_mis_justificables`: registros propios con `estado IN ('ausente','retardo')`, sesión `cerrada` y **sin** justificante `pendiente`, `fecha DESC, hora_inicio DESC`:

```json
{
  "total": 1,
  "items": [
    {
      "id_asistencia": 350,
      "id_sesion": 181,
      "estado": "ausente",
      "origen": "automatico",
      "fecha": "2026-09-11",
      "hora_inicio": "07:00:00",
      "hora_fin": "09:00:00",
      "materia": { "id_materia": 7, "clave": "FIN301", "nombre": "Finanzas corporativas" },
      "grupo": { "id_grupo": 12, "clave_grupo": "3A", "periodo": "2026-2" },
      "tiene_rechazado": false
    }
  ]
}
```

| Código | Mensaje | Cuándo |
|---|---|---|
| `NO_AUTORIZADO` | «Solo los alumnos pueden consultar sus justificantes.» | rol ≠ alumno |

### 3.7 `api_detecciones_caso`

```sql
public.api_detecciones_caso(
    p_id_asistencia integer,
    p_solo_validas  boolean DEFAULT false,
    p_limit         integer DEFAULT 50,    -- máx. 100 (acota el número de URLs a firmar)
    p_offset        integer DEFAULT 0
) RETURNS jsonb
-- SECURITY INVOKER, STABLE
```

- **Quién**: `docente`, **solo** vía el Route Handler `GET /api/casos/{id_asistencia}/detecciones`, que debe asentar la consulta (RF-19). Esta RPC **no** escribe bitácora (INVOKER no tiene permiso de inserción) y por eso no debe llamarse desde otro sitio sin repetir ese asiento.
- **Lee** (con la identidad del docente; la RLS filtra por grupo): `asistencia`, `sesion_clase`, `grupo`, `alumno`, `captura`, `camara`, `deteccion`, `plantilla_facial`, `parametro_sistema` (vía `app.param_num`). **Escribe**: nada.
- **Reglas**: RF-18, RF-19, RNF-04 (informa el TTL), RNF-05 (recorte nulo sin error).
- **Contenido**: `lecturas` = detecciones cuyo candidato es una plantilla (`plantilla_facial.id_alumno`) del alumno de la asistencia y cuya captura pertenece a la sesión; incluye válidas y no válidas; orden `es_valida DESC, marca_tiempo ASC`; `p_solo_validas` filtra las válidas. `objeto_foto_registro` = `objeto_foto` de la plantilla **activa** del alumno (`NULL` si no tiene). Rutas `objeto_*` van en bruto: el handler las convierte en URL y **no las reenvía** al navegador.
- Si la asistencia no es visible para el docente (inexistente o de grupo ajeno) → `NO_ENCONTRADO` (la RLS no permite distinguirlos; es lo deseado).

Retorno:

```json
{
  "id_usuario": 5,
  "vigencia_url_firmada_seg": 300,
  "asistencia": { "id_asistencia": 345, "id_sesion": 188, "estado": "pendiente", "origen": "automatico", "hora_registro": "2026-09-14T07:04:55-06:00", "conteo_detecciones": 2 },
  "alumno": { "id_alumno": 41, "matricula": "A230417", "apellido_paterno": "Hernández", "apellido_materno": "Ruiz", "nombres": "Mariana", "nombre_completo": "Hernández Ruiz, Mariana" },
  "sesion": { "id_sesion": 188, "fecha": "2026-09-14", "hora_inicio": "07:00:00", "hora_fin": "09:00:00", "modo_registro": "automatico", "limite_presente_min": 10, "tolerancia_min": 20 },
  "objeto_foto_registro": "registro/41/0f8e5a6c-31d2-4b7a-8e4f-6a1c9d2b7e30.jpg",
  "total": 3,
  "lecturas": [
    { "id_deteccion": 90017, "id_captura": 4101, "marca_tiempo": "2026-09-14T07:04:55-06:00", "minuto_sesion": 4.92, "camara_posicion": "frente", "score_similitud": 0.912, "es_valida": true, "tiene_recorte": true, "objeto_recorte": "recortes/188/4101/2.jpg" },
    { "id_deteccion": 90188, "id_captura": 4115, "marca_tiempo": "2026-09-14T07:05:25-06:00", "minuto_sesion": 5.42, "camara_posicion": "frente", "score_similitud": 0.801, "es_valida": false, "tiene_recorte": false, "objeto_recorte": null }
  ]
}
```

`vigencia_url_firmada_seg = LEAST(app.param_num('vigencia_url_firmada_seg'), 300)::integer` (RNF-04: nunca mayor a 300 aunque el parámetro se edite). `id_usuario` = `app.id_usuario()` del invocador, para que el handler asiente la bitácora sin otra consulta y sin confiar en datos del cliente.

| Código | Mensaje | Cuándo |
|---|---|---|
| `NO_AUTORIZADO` | «Solo los docentes pueden consultar las lecturas de un caso.» | rol ≠ docente |
| `NO_ENCONTRADO` | «El caso no existe o no pertenece a tus grupos.» | invisible por RLS |

### 3.8 `api_justificante_documento`

```sql
public.api_justificante_documento(p_id_justificante integer) RETURNS jsonb
-- SECURITY INVOKER, STABLE
```

- **Quién**: `docente` titular (solo vía `GET /api/justificantes/{id}/documento`). **Lee**: `justificante`, `asistencia`, `sesion_clase`, `grupo`, `parametro_sistema`. **Escribe**: nada (el asiento lo hace el handler).
- Retorno: `{ "id_usuario": 5, "vigencia_url_firmada_seg": 300, "id_justificante": 15, "id_alumno": 44, "id_asistencia": 350, "estatus": "pendiente", "objeto_documento": "justificantes/44/5b3c0a9e-72d4-4f1b-9c1e-0d2f6a8b4e11.pdf" }`.
- Errores: `NO_AUTORIZADO` («Solo los docentes pueden consultar documentos de justificantes.») si rol ≠ docente; `NO_ENCONTRADO` («El justificante no existe o no pertenece a tus grupos.»). El alumno no usa esta RPC (no necesita volver a ver su documento; §7 Decisión 12).

### 3.9 `api_sesiones_corregibles`

```sql
public.api_sesiones_corregibles(p_limit integer DEFAULT 50, p_offset integer DEFAULT 0) RETURNS jsonb
-- SECURITY INVOKER, STABLE
```

- **Quién**: `docente`. Sesiones `cerrada` de sus grupos con `app.now() <= vence_en`, `fecha DESC, hora_inicio DESC`. **Lee**: `sesion_clase`, `grupo`, `materia`, `asistencia`.
- Retorno:

```json
{
  "total": 2,
  "items": [
    {
      "id_sesion": 188,
      "fecha": "2026-09-14",
      "hora_inicio": "07:00:00",
      "hora_fin": "09:00:00",
      "modo_registro": "automatico",
      "grupo": { "id_grupo": 12, "clave_grupo": "3A", "periodo": "2026-2" },
      "materia": { "id_materia": 7, "clave": "FIN301", "nombre": "Finanzas corporativas" },
      "vence_en": "2026-09-16T09:00:00-06:00",
      "segundos_restantes": 170388,
      "total_registros": 31,
      "total_pendientes": 7
    }
  ]
}
```

- Errores: `NO_AUTORIZADO` («Solo los docentes pueden consultar sesiones corregibles.»).

### 3.10 `api_registros_corregibles`

```sql
public.api_registros_corregibles(
    p_id_sesion integer,
    p_limit     integer DEFAULT 100,   -- máx. 200
    p_offset    integer DEFAULT 0
) RETURNS jsonb
-- SECURITY INVOKER, STABLE
```

- **Quién**: `docente`. Registros de la sesión, orden `apellido_paterno, apellido_materno NULLS LAST, nombres`. **Lee**: `asistencia`, `alumno`, `justificante`, `sesion_clase`, `grupo`.
- Retorno:

```json
{
  "sesion": { "id_sesion": 188, "fecha": "2026-09-14", "hora_inicio": "07:00:00", "hora_fin": "09:00:00", "modo_registro": "automatico", "limite_presente_min": 10, "tolerancia_min": 20 },
  "vence_en": "2026-09-16T09:00:00-06:00",
  "segundos_restantes": 170388,
  "dentro_de_plazo": true,
  "total": 31,
  "items": [
    {
      "id_asistencia": 346,
      "alumno": { "id_alumno": 42, "matricula": "A230431", "apellido_paterno": "Pérez", "apellido_materno": "Díaz", "nombres": "Ana", "nombre_completo": "Pérez Díaz, Ana" },
      "estado": "retardo",
      "origen": "correccion",
      "hora_registro": "2026-09-14T07:12:30-06:00",
      "conteo_detecciones": 3,
      "justificante_pendiente": false,
      "corregible": true
    }
  ]
}
```

`corregible = dentro_de_plazo AND estado <> 'justificado' AND sesion.estatus = 'cerrada'`.

- Errores: `NO_AUTORIZADO` (rol ≠ docente); `NO_ENCONTRADO` («La sesión no existe o no pertenece a tus grupos.»).

### 3.11 `svc_registrar_consulta_revision`

```sql
public.svc_registrar_consulta_revision(
    p_id_usuario  integer,
    p_entidad     text,                  -- 'asistencia' | 'justificante'
    p_id_registro bigint,
    p_ip          text    DEFAULT NULL,  -- IPv4/IPv6 en texto; si no se puede interpretar se guarda NULL
    p_detalle     jsonb   DEFAULT NULL
) RETURNS bigint
-- SECURITY DEFINER; EXECUTE solo service_role
```

- **Quién**: Route Handlers de §4 con `getAdminBackend()`. **Escribe**: `bitacora_auditoria` mediante `app.bitacora('consulta', p_entidad, p_id_registro, NULL, p_detalle, p_ip::inet, p_id_usuario)`. Devuelve `id_bitacora`.
- **Valida**: `p_entidad IN ('asistencia','justificante')` (si no `VALIDACION`); `p_id_usuario` existe, `activo` y con rol `docente` (si no `NO_AUTORIZADO`). `p_detalle` va en `valor_nuevo` (solo ids y contadores: nunca rutas, URL ni datos personales).
- Errores: `VALIDACION` («Entidad de consulta no válida.»), `NO_AUTORIZADO` («La cuenta que consulta no es un docente activo.»).

---

## 4. Route Handlers

Todos: `export const runtime = 'nodejs'`; `params` se espera con `await`; autenticar → autorizar → validar (zod) → ejecutar;
respuestas JSON con `Cache-Control: no-store`; errores `{ "error": { "code", "message", "details"? } }`. La identidad del usuario sale
de `getServerBackend()` (cookies de la petición); el cliente **nunca** envía `id_usuario`. No se registran en logs rutas de objetos, URL firmadas ni PII.

Tabla de códigos HTTP de este dominio (para el registro de errores de `docs/API.md` y `ApiError.status`):

| Código | HTTP | Origen |
|---|---|---|
| `NO_AUTENTICADO` | 401 | handlers |
| `NO_AUTORIZADO` | 403 | RPC / handlers |
| `NO_ENCONTRADO`, `ASISTENCIA_NO_ENCONTRADA` | 404 | RPC |
| `VALIDACION`, `DOCUMENTO_INVALIDO` | 400 | RPC / handlers |
| `ARCHIVO_DEMASIADO_GRANDE` | 413 | handler |
| `TIPO_NO_PERMITIDO` | 415 | handler |
| `ARCHIVO_INVALIDO` | 422 | handler |
| `RN_08_PLAZO_VENCIDO`, `SESION_NO_CERRADA`, `TRANSICION_NO_PERMITIDA`, `SIN_CAMBIO`, `JUSTIFICANTE_PENDIENTE`, `ESTADO_NO_JUSTIFICABLE`, `JUSTIFICANTE_DUPLICADO`, `JUSTIFICANTE_YA_RESUELTO` | 409 | RPC |
| `BITACORA_NO_DISPONIBLE` | 503 | handler (no se pudo asentar la consulta) |
| `ALMACENAMIENTO_NO_DISPONIBLE` | 502 | handler (el bucket falló) |

### 4.1 `GET /api/casos/{id_asistencia}/detecciones`

- **Roles**: `docente` titular del grupo del caso.
- **Entrada**: ruta `id_asistencia` (entero positivo, `z.coerce.number().int().positive()`); query opcional `solo_validas` (`true|false`, def. `false`), `limit` (1-100, def. 50), `offset` (≥ 0, def. 0). Cualquier otro valor → 400 `VALIDACION`.
- **Pasos exactos**:
  1. `getServerBackend().auth.getUser()`; sin sesión → 401 `NO_AUTENTICADO`.
  2. Valida entrada con zod → 400.
  3. `rpc('api_detecciones_caso', { p_id_asistencia, p_solo_validas, p_limit, p_offset })` con el backend **del usuario** (la RLS aplica). Errores de la RPC → `ApiError` → 403/404. Si falla aquí **no** se asienta nada ni se firma nada.
  4. **Asentar primero**: `getAdminBackend().rpc('svc_registrar_consulta_revision', { p_id_usuario: datos.id_usuario, p_entidad: 'asistencia', p_id_registro: id_asistencia, p_ip: ipOrigen, p_detalle: { ids_deteccion: [...], recortes: n, foto_registro: boolean } })`. Si falla → 503 `BITACORA_NO_DISPONIBLE` y **no se devuelve ninguna URL** (fallo cerrado).
  5. TTL = `datos.vigencia_url_firmada_seg` (ya acotado a ≤ 300). Con `getAdminBackend().storage.from('susan-private').createSignedUrl(ruta, TTL)` firma `objeto_foto_registro` (si no es nulo) y cada `objeto_recorte` no nulo. Si una firma individual falla, esa entrada va con `url: null` y `error: true`; no se aborta toda la respuesta.
  6. Responde 200 sin reenviar ninguna ruta `objeto_*`.
- **IP de origen**: primer elemento válido de `x-forwarded-for`; si no, `x-real-ip`; se valida con `net.isIP`; si no hay, `null`.
- **Una consulta = una fila de bitácora** por petición (no una por recorte).
- **Respuesta 200**:

```json
{
  "id_asistencia": 345,
  "asistencia": { "estado": "pendiente", "origen": "automatico", "hora_registro": "2026-09-14T07:04:55-06:00", "conteo_detecciones": 2 },
  "alumno": { "id_alumno": 41, "matricula": "A230417", "nombre_completo": "Hernández Ruiz, Mariana" },
  "sesion": { "id_sesion": 188, "fecha": "2026-09-14", "hora_inicio": "07:00:00", "hora_fin": "09:00:00", "limite_presente_min": 10, "tolerancia_min": 20 },
  "vigencia_seg": 300,
  "generado_en": "2026-09-14T09:40:31-06:00",
  "foto_registro": { "url": "https://…/object/sign/susan-private/registro/41/0f8e….jpg?token=…", "expira_en": "2026-09-14T09:45:31-06:00" },
  "total": 3,
  "lecturas": [
    {
      "id_deteccion": 90017, "id_captura": 4101, "marca_tiempo": "2026-09-14T07:04:55-06:00", "minuto_sesion": 4.92,
      "camara_posicion": "frente", "score_similitud": 0.912, "es_valida": true,
      "recorte_disponible": true,
      "recorte": { "url": "https://…/object/sign/susan-private/recortes/188/4101/2.jpg?token=…", "expira_en": "2026-09-14T09:45:31-06:00" }
    },
    {
      "id_deteccion": 90188, "id_captura": 4115, "marca_tiempo": "2026-09-14T07:05:25-06:00", "minuto_sesion": 5.42,
      "camara_posicion": "frente", "score_similitud": 0.801, "es_valida": false,
      "recorte_disponible": false,
      "recorte": null
    }
  ]
}
```

  `foto_registro` es `null` si el alumno no tiene plantilla activa. `recorte` es `null` con `recorte_disponible: false` cuando `objeto_recorte` es NULL (purgado a los 7 días, RNF-05). En modo local la URL tiene la forma `/api/_local/storage/object?token=…` con la misma vigencia.
- **Errores HTTP**: 400 `VALIDACION`; 401 `NO_AUTENTICADO`; 403 `NO_AUTORIZADO` (rol ≠ docente); 404 `NO_ENCONTRADO` (inexistente o de otro docente); 503 `BITACORA_NO_DISPONIBLE`; 500 genérico sin detalles internos.

### 4.2 `POST /api/justificantes/documento`

- **Roles**: `alumno` (propio) o `docente` (alumno de sus grupos).
- **Entrada**: `multipart/form-data`:

| Campo | Tipo | Reglas |
|---|---|---|
| `archivo` | File | obligatorio; 1 byte a 5 242 880 bytes (5 MiB); tipo PDF, JPEG o PNG |
| `id_sesion` | texto → entero | obligatorio, positivo |
| `id_alumno` | texto → entero | obligatorio si el usuario es docente; para alumno debe omitirse (o ser el propio) |

- **Pasos exactos**:
  1. Autenticar (`getUser`) → 401. Sin cuerpo multipart legible → 400 `VALIDACION`.
  2. Rechaza temprano si `Content-Length` > 5 MiB + 64 KiB (margen de encabezados multipart) → 413 `ARCHIVO_DEMASIADO_GRANDE`. (Con `src/proxy.js` activo Next bufferiza el cuerpo hasta `proxyClientMaxBodySize`, 10 MB por defecto; como el límite funcional es menor, la comprobación real se hace sobre `archivo.size`.)
  3. `await request.formData()`; valida campos con zod → 400.
  4. `rpc('api_validar_justificante', { p_id_sesion, p_id_alumno })` con el backend del usuario. Errores de la RPC → `ApiError` (403, 404, 409, 400). Devuelve `id_alumno` destino. **No se sube nada si esto falla.**
  5. Valida archivo: `archivo.size` entre 1 y 5 242 880 (si no 413 / `VALIDACION`); `archivo.type` ∈ {`application/pdf`, `image/jpeg`, `image/png`} (si no 415 `TIPO_NO_PERMITIDO`); lee los primeros bytes y detecta el tipo real por firma (`%PDF-`; `FF D8 FF`; `89 50 4E 47 0D 0A 1A 0A`); si la firma no coincide con el tipo declarado → 422 `ARCHIVO_INVALIDO`. La extensión sale del tipo **detectado** (`pdf|jpg|png`), nunca del nombre del archivo.
  6. Ruta: `justificantes/{id_alumno}/{crypto.randomUUID()}.{ext}`. Sube con `getAdminBackend().storage.from('susan-private').upload(ruta, bytes, { contentType, upsert: false })`. Falla → 502 `ALMACENAMIENTO_NO_DISPONIBLE`.
  7. Responde **201**.
- **Respuesta 201**: `{ "objeto_documento": "justificantes/44/5b3c0a9e-72d4-4f1b-9c1e-0d2f6a8b4e11.pdf", "tipo": "pdf", "bytes": 482113, "id_alumno": 44 }`. El cliente pasa `objeto_documento` a `api_registrar_justificante`.
- **Errores HTTP**: 400 `VALIDACION` · 401 `NO_AUTENTICADO` · 403 `NO_AUTORIZADO` · 404 `ASISTENCIA_NO_ENCONTRADA` · 409 (`SESION_NO_CERRADA`, `ESTADO_NO_JUSTIFICABLE`, `JUSTIFICANTE_DUPLICADO`) · 413 · 415 · 422 · 502.
- El archivo subido y no usado (si el paso 2 del formulario falla) queda huérfano en el bucket (§7 Riesgo 1).

### 4.3 `GET /api/justificantes/{id}/documento`

- **Roles**: `docente` titular del grupo del justificante.
- **Entrada**: ruta `id` (entero positivo, zod).
- **Pasos exactos**: (1) autenticar → 401; (2) validar `id` → 400; (3) `rpc('api_justificante_documento', { p_id_justificante })` con el backend del usuario (403/404 por la RPC); (4) **asentar primero** con `svc_registrar_consulta_revision` (`p_entidad: 'justificante'`, `p_id_registro: id`, `p_ip`, `p_detalle: { id_asistencia }`) → si falla, 503 `BITACORA_NO_DISPONIBLE` sin URL; (5) `createSignedUrl(objeto_documento, TTL)` con `TTL = vigencia_url_firmada_seg` (≤ 300); falla → 502; (6) responde 200.
- **Respuesta 200**: `{ "id_justificante": 15, "tipo": "pdf", "url": "https://…?token=…", "expira_en": "2026-09-14T09:49:10-06:00", "vigencia_seg": 300 }` (`tipo` se deduce de la extensión de la ruta; la ruta no se devuelve).
- **Errores HTTP**: 400 · 401 · 403 · 404 · 502 · 503.

### 4.4 Capa de datos y clientes (nombres fijados)

`web/src/lib/api/revision.js` (una función por RPC; argumentos sin el prefijo `p_`; devuelve `data` o lanza `ApiError`):

| RPC | Función | Argumentos |
|---|---|---|
| `api_cola_revision` | `colaRevision` | `{ pestana?, limit?, offset? }` |
| `api_corregir_asistencia` | `corregirAsistencia` | `{ idAsistencia, estado, comentario? }` |
| `api_validar_justificante` | `validarJustificante` | `{ idSesion, idAlumno? }` (uso del handler) |
| `api_registrar_justificante` | `registrarJustificante` | `{ idSesion, motivo, objetoDocumento, idAlumno? }` |
| `api_resolver_justificante` | `resolverJustificante` | `{ idJustificante, aprobar, comentario? }` |
| `api_mis_justificantes` | `misJustificantes` | `{ limit?, offset? }` |
| `api_mis_justificables` | `misJustificables` | `{ limit?, offset? }` |
| `api_detecciones_caso` | `deteccionesCaso` | `{ idAsistencia, soloValidas?, limit?, offset? }` (uso del handler; los componentes usan el cliente HTTP) |
| `api_justificante_documento` | `justificanteDocumento` | `{ idJustificante }` (uso del handler) |
| `api_sesiones_corregibles` | `sesionesCorregibles` | `{ limit?, offset? }` |
| `api_registros_corregibles` | `registrosCorregibles` | `{ idSesion, limit?, offset? }` |

`web/src/lib/http/revision.js` (clientes de los Route Handlers; lanzan `ApiError`):

| Función | Llama a | Devuelve |
|---|---|---|
| `obtenerDeteccionesCaso(idAsistencia, { soloValidas, limit, offset })` | `GET /api/casos/{id}/detecciones` | objeto de §4.1 |
| `subirDocumentoJustificante({ archivo, idSesion, idAlumno })` | `POST /api/justificantes/documento` | `{ objeto_documento, tipo, bytes, id_alumno }` |
| `obtenerDocumentoJustificante(idJustificante)` | `GET /api/justificantes/{id}/documento` | `{ id_justificante, tipo, url, expira_en, vigencia_seg }` |

---

## 5. Funciones internas del esquema `app`, `svc_*` y requisitos hacia otros dominios

### 5.1 Resumen

| Función | Tipo | Quién la invoca |
|---|---|---|
| `app.limite_correccion(p_fecha date, p_hora_fin time)` | utilidad | todas las `api_*` de este dominio |
| `app.estado_sugerido_revision(p_hora_registro timestamptz, p_fecha date, p_hora_inicio time, p_limite_presente_min integer)` | utilidad | `api_cola_revision` |
| `app.aplicar_correccion(...)` | núcleo de escritura | `api_corregir_asistencia`, `app.resolver_pendientes_vencidos` |
| `app.resolver_pendientes_vencidos(...)` | job | `svc_*` del job `resolver-pendientes` (dominio `biometria`) |
| `app.validar_destino_justificante(...)` | validación | `api_validar_justificante`, `api_registrar_justificante` |
| `app.correcciones_recientes(...)` | lectura DEFINER | `api_cola_revision` |
| `app.rol_de_usuario(p_id_usuario integer)` | lectura DEFINER mínima | `api_cola_revision`, `api_mis_justificantes` (campo `registrado_por_rol`) |

### 5.2 Contratos

```sql
app.limite_correccion(p_fecha date, p_hora_fin time) RETURNS timestamptz
-- STABLE. ((p_fecha + p_hora_fin) AT TIME ZONE app.tz()) + (app.param_num('horas_limite_correccion') * interval '1 hour')
```

```sql
app.estado_sugerido_revision(
    p_hora_registro timestamptz, p_fecha date, p_hora_inicio time, p_limite_presente_min integer
) RETURNS text
-- STABLE. NULL si p_hora_registro es NULL. 'presente' si
--   p_hora_registro - ((p_fecha + p_hora_inicio) AT TIME ZONE app.tz()) < p_limite_presente_min * interval '1 minute'  (estricto),
-- en otro caso 'retardo'. 9:59 -> presente; 10:00 y 20:00 -> retardo (RN-03).
```

```sql
app.aplicar_correccion(
    p_id_asistencia integer,
    p_estado        text,                 -- 'presente' | 'retardo' | 'ausente'
    p_comentario    text    DEFAULT NULL,
    p_id_usuario    integer DEFAULT NULL, -- NULL = app.id_usuario()
    p_ip            inet    DEFAULT NULL
) RETURNS jsonb
-- SECURITY DEFINER. NO autoriza ni verifica el plazo (lo hace el llamador). Hace el UPDATE descrito en §3.2 paso 9
-- y el asiento 'correccion' del paso 10 con app.bitacora(..., p_id_usuario). Devuelve
-- { id_asistencia, id_sesion, id_alumno, id_grupo, estado_anterior, estado, hora_registro, id_bitacora }.
-- EXECUTE solo para el propietario y service_role (no para authenticated).
```

```sql
app.resolver_pendientes_vencidos(
    p_id_usuario integer,                  -- cuenta de servicio (usuario.rol = 'tecnico', activo)
    p_limite     integer DEFAULT 1000
) RETURNS jsonb
-- SECURITY DEFINER. Selecciona asistencia WHERE estado = 'pendiente' AND sesion_clase.estatus = 'cerrada'
--   AND app.now() > app.limite_correccion(fecha, hora_fin)        (estricto: a las 48 h exactas todavia no vence)
--   ORDER BY id_asistencia LIMIT p_limite FOR UPDATE OF a SKIP LOCKED.
-- Por cada fila: app.aplicar_correccion(id, 'ausente', 'Plazo de correccion vencido: resolucion automatica', p_id_usuario)
--   y app.recalcular_inscripcion(inscripcion del alumno en el grupo). Una fila que falle no aborta el lote
--   (subtransaccion: BEGIN ... EXCEPTION ... END) y se lista en "fallidos".
-- Devuelve { "resueltos": 3, "ids": [345, 351, 352], "fallidos": [] }. Idempotente.
-- p_id_usuario inexistente, inactivo o con rol distinto de 'tecnico' -> RAISE ... HINT = 'CUENTA_SERVICIO_INVALIDA'.
-- Un justificante nunca bloquea esta resolucion: no puede existir justificante sobre un pendiente (RF-12 exige ausente/retardo).
```

```sql
app.validar_destino_justificante(
    p_id_sesion integer, p_id_alumno integer, p_bloquear boolean DEFAULT false
) RETURNS jsonb
-- SECURITY DEFINER. Ejecuta los pasos 1, 2, 5, 6, 7 y 8 de §3.4 (con FOR UPDATE sobre asistencia si p_bloquear).
-- Devuelve { id_sesion, id_alumno, id_asistencia, estado, ya_tuvo_rechazo, id_grupo }. Los pasos 3 y 4 (motivo, documento)
-- son solo de api_registrar_justificante.
```

```sql
app.correcciones_recientes(p_limit integer DEFAULT 50, p_offset integer DEFAULT 0) RETURNS jsonb
-- SECURITY DEFINER; EXECUTE para authenticated (necesario para que la INVOKER api_cola_revision la llame).
-- Filtra SIEMPRE por g.id_docente = app.id_docente(); si es NULL devuelve { "total": 0, "items": [] }.
-- Fuente: bitacora_auditoria WHERE accion = 'correccion' AND entidad = 'asistencia'
--   AND fecha_hora >= app.now() - interval '30 days' AND id_registro IN (asistencias de sus grupos).
-- Devuelve { total, items } con la forma de correcciones_recientes de §3.1.
```

```sql
app.rol_de_usuario(p_id_usuario integer) RETURNS text
-- SECURITY DEFINER, STABLE; EXECUTE para authenticated. Devuelve solo usuario.rol::text (sin PII). Se llama unicamente con
-- ids tomados de filas que la RLS ya dejo ver al invocador (justificante.registrado_por). Existe porque la tabla usuario
-- no es legible para docente ni alumno.
```

`svc_resolver_pendientes_vencidos` (si existe) pertenece al dominio `biometria` y **debe delegar** en `app.resolver_pendientes_vencidos`, para que la regla viva en un solo lugar.

### 5.3 Índice adicional (migración `01xx`, db-api-a)

```sql
CREATE UNIQUE INDEX ux_justificante_pendiente ON justificante (id_sesion, id_alumno) WHERE estatus = 'pendiente';
```

Respaldo declarativo de la unicidad del justificante pendiente ante dos envíos simultáneos (además del `FOR UPDATE` de la RPC). [DESVIACION] §7 Desviación 1.

### 5.4 Requisitos hacia `trg_asistencia_ciclo` (dominio plataforma / db-schema)

Las RPC de este dominio ejecutan las transiciones siguientes; el disparador debe **admitirlas** cuando `NEW.origen = 'correccion'` y **rechazar** el resto:

| De → A | Admitida | Notas |
|---|---|---|
| `pendiente → presente\|retardo` | Sí, aunque `conteo_detecciones < min_detecciones_validas` | la confirmación por lecturas sigue exigiendo el mínimo si `origen <> 'correccion'` (RN-05) |
| `pendiente → ausente` | Sí | `hora_registro` debe ir NULL (`ck_asistencia_ausente_sin_hora`) |
| `presente\|retardo → presente\|retardo\|ausente` (distinto estado) | Sí | |
| `ausente → presente\|retardo` | Sí | `hora_registro` puede quedar NULL con origen `correccion` (`ck_asistencia_hora_presencia`) |
| `ausente\|retardo → justificado` | Sí | solo con `origen = 'correccion'`; `hora_registro` no cambia |
| `* → pendiente` | **No** | |
| `pendiente\|presente → justificado` | **No** | |
| `justificado → *` | **No** | |

### 5.5 Requisitos de RLS (lecturas `SECURITY INVOKER`, dominio plataforma / db-schema)

Políticas `SELECT` necesarias para que las RPC de lectura funcionen con la identidad del usuario (privilegio `GRANT SELECT` + política):

| Rol | Tabla | Filas visibles |
|---|---|---|
| docente | `asistencia`, `sesion_clase`, `captura`, `deteccion`, `justificante`, `inscripcion`, `grupo` | las de sus grupos (cadena a `grupo.id_docente`) |
| docente | `alumno` | alumnos con inscripción (cualquier estatus) en sus grupos |
| docente | `materia` | materias de sus grupos |
| docente | `camara` | cámaras del aula de sus grupos (para mostrar frente/fondo) |
| docente | `plantilla_facial` | plantillas (activas o archivadas) de alumnos inscritos en sus grupos (candidato de la detección y foto de registro, P-05 marcador 2) |
| alumno | `asistencia`, `justificante`, `inscripcion`, `alumno` | las propias (`id_alumno = app.id_alumno()`) |
| alumno | `sesion_clase`, `grupo`, `materia` | las de grupos donde está inscrito |

Si falta alguna, `api_detecciones_caso` devuelve `camara_posicion`/`objeto_foto_registro` vacíos y las pruebas ESQ-04/ESQ-05 lo detectan. `usuario`, `bitacora_auditoria` y `parametro_sistema` no se leen directamente con la identidad del docente o del alumno: el rol de `registrado_por` se obtiene con `app.rol_de_usuario`, la bitácora con `app.correcciones_recientes` y los parámetros con `app.param_num`.

---

## 6. Escenarios de prueba (PostgreSQL 16)

### 6.0 Fixture común

Cada prueba parte del fixture limpio (se reconstruye entre pruebas; los casos de una misma tabla no dependen del anterior salvo que se indique).

Reloj: `app.allow_fake_clock = 'on'` y `set_config('app.fake_now', '<instante>', true)` por prueba. Zona `America/Mexico_City` (-06:00).

- Cuentas: `U_D1` docente D1; `U_D2` docente D2; `U_A1…U_A5` alumnos A1…A5; `U_ADM` administrador; `U_TEC` técnico; `U_SRV` cuenta de servicio (rol `tecnico`).
- Grupos: G1 (D1, materia FIN301, clave 3A, 2026-2, aula A-12, cámaras frente y fondo); G2 (D2). Inscripciones: A1, A2, A3 activas y A4 con `baja` en G1; A5 en G2.
- Sesiones: S1 de G1, 2026-09-14 07:00-09:00, `cerrada`, límites 10/20 min → `vence_en` = **2026-09-16 09:00:00-06:00**; S2 de G1, 2026-09-14 10:00-12:00, `abierta`; S3 de G2, 2026-09-14 07:00-09:00, `cerrada`; S0 de G1, 2026-09-11, `cerrada` (para justificantes).
- Registros: AS1 = S1/A1 `pendiente`, origen `automatico`, `hora_registro` 07:04:55, `conteo_detecciones` 2, lecturas: 07:04:55 frente 0.912 válida (con recorte), 07:05:10 fondo 0.874 válida (con recorte), 07:05:25 frente 0.801 no válida (sin recorte); AS2 = S1/A2 `ausente`; AS3 = S1/A3 `retardo` 07:12:30 (3 lecturas); AS4 = S1/A4 `presente`; AS5 = S3/A5 `pendiente`; AS6 = S2/A1 `pendiente` (sesión abierta); AS7 = S0/A2 `ausente`; AS8 = S0/A3 `retardo`.
- «Ahora» por defecto: 2026-09-14T09:40:00-06:00. Equivalencias: 47 h tras `hora_fin` = `2026-09-16T08:00:00-06:00`; 48 h = `2026-09-16T09:00:00-06:00`; 49 h = `2026-09-16T10:00:00-06:00`.
- Para RN-11: grupo G48 con 48 sesiones cerradas programadas y alumno A9 con 9 faltas equivalentes (18.75 %).

### 6.1 Corrección (RF-11, RN-08)

| # | Entrada | Resultado esperado |
|---|---|---|
| COR-01 | Como D1, ahora = 47 h; `api_corregir_asistencia(AS1, 'presente', 'Llegó a tiempo')` | OK. `estado='presente'`, `origen='correccion'`, `hora_registro` sin cambio, `conteo_detecciones=2`. Bitácora `correccion/asistencia/AS1` con `valor_anterior.estado='pendiente'`, `valor_nuevo.estado='presente'`, `comentario`, `id_usuario=U_D1`, `fecha_hora`=ahora. Retorno con `id_bitacora` |
| COR-02 | Igual con ahora = 48 h exactas (09:00:00) | OK (límite inclusivo) |
| COR-03 | Ahora = 48 h + 1 s | `RN_08_PLAZO_VENCIDO`; AS1 sin cambios; ninguna fila nueva en bitácora |
| COR-04 | Ahora = 49 h | `RN_08_PLAZO_VENCIDO` |
| COR-05 | Ahora = 47 h, AS1 → `ausente` | OK. `hora_registro IS NULL`; `valor_anterior.hora_registro = '2026-09-14T07:04:55-06:00'`; las 3 detecciones de A1 en S1 siguen existiendo |
| COR-06 | AS4 `presente` → `retardo`; luego `retardo` → `presente`; AS3 `retardo` → `ausente`; AS2 `ausente` → `retardo` | todas OK, origen `correccion`, un asiento de bitácora cada una con anterior/nuevo correctos |
| COR-07 | `p_estado='pendiente'` | `TRANSICION_NO_PERMITIDA` |
| COR-08 | `p_estado='justificado'` | `TRANSICION_NO_PERMITIDA` |
| COR-09 | Registro `justificado`, `p_estado='presente'` | `TRANSICION_NO_PERMITIDA` |
| COR-10 | AS4 ya `presente`, `p_estado='presente'` | `SIN_CAMBIO` |
| COR-11 | Como D2 sobre AS1 | `NO_AUTORIZADO`; AS1 intacto |
| COR-12 | Como D1 sobre AS5 (grupo de D2) | `NO_AUTORIZADO` |
| COR-13 | Como A1, `U_ADM`, `U_TEC` | `NO_AUTORIZADO` |
| COR-14 | `p_id_asistencia=999999` | `NO_ENCONTRADO` |
| COR-15 | AS6 (sesión abierta) | `SESION_NO_CERRADA` |
| COR-16 | `p_estado='faltó'` | `VALIDACION` |
| COR-17 | comentario de 200 caracteres / de 201 / solo espacios | OK / `VALIDACION` / OK y se guarda `comentario` NULL |
| COR-18 | AS2 con un justificante pendiente (registrado antes), `p_estado='presente'` | `JUSTIFICANTE_PENDIENTE`; con `'retardo'` → OK |
| COR-19 | Parámetro `horas_limite_correccion` = 24: ahora = 25 h tras `hora_fin` | `RN_08_PLAZO_VENCIDO`; ahora = 23 h → OK (RNF-02, sin tocar código) |
| COR-20 | Dos llamadas simultáneas a AS1 (`presente` y `retardo`) | se serializan por `FOR UPDATE`; la segunda ve el estado resultante; ninguna deja el registro inconsistente ni hay deadlock |
| COR-21 | G48/A9 con 9 faltas eq. (18.75 %); se corrige un pendiente a `ausente` (10 faltas = 20.83 %) | retorno `derecho_examen_anterior=true`, `derecho_examen=false`; bitácora `notificacion`. Con 9 faltas (18.75 %) el derecho se conserva |
| COR-22 | Seguido de COR-21, corregir ese registro a `presente` | `derecho_examen` vuelve a `true`; nueva `notificacion` en bitácora (reversible) |
| COR-23 | Corregir un pendiente a `presente` | el registro deja de contar como pendiente y **no** suma a faltas (RN-11); `conteo_detecciones` y detecciones sin cambio |
| COR-24 | Corregir el registro de A4 (inscripción `baja`) | OK (la baja no impide corregir el historial) |

### 6.2 Resolución automática por plazo vencido (RF-11, BPMN-02)

| # | Entrada | Resultado esperado |
|---|---|---|
| JOB-01 | Ahora = 48 h + 1 s; `app.resolver_pendientes_vencidos(U_SRV)` | AS1 y AS5 → `ausente`, `origen='correccion'`, `hora_registro NULL`; bitácora `correccion` con `id_usuario=U_SRV` (rol `tecnico`), `valor_anterior.estado='pendiente'`; devuelve `resueltos=2`; se recalcula la inscripción de cada alumno |
| JOB-02 | Ahora = 48 h exactas | `resueltos=0` (a las 48 h todavía se puede corregir) |
| JOB-03 | Ahora = 47 h 59 min | `resueltos=0` |
| JOB-04 | Segunda ejecución inmediata | `resueltos=0` (idempotente) |
| JOB-05 | AS6 (sesión abierta) con plazo "vencido" por reloj | no se toca |
| JOB-06 | Registros `presente`, `retardo`, `ausente`, `justificado` vencidos | no se tocan |
| JOB-07 | `p_id_usuario` = `U_D1` (docente) o inexistente | `CUENTA_SERVICIO_INVALIDA` |
| JOB-08 | `p_limite=1` con 2 pendientes vencidos | `resueltos=1`; la siguiente ejecución resuelve el otro |
| JOB-09 | Fila bloqueada por una corrección concurrente del docente | `SKIP LOCKED`: el job no espera ni falla; la fila se resuelve en la siguiente ejecución si sigue pendiente |
| JOB-10 | Pendiente resuelto por el job a `ausente`; el alumno registra justificante y D1 lo aprueba semanas después | OK (no hay plazo para justificantes); queda `justificado` |

### 6.3 Registrar justificante (RF-12)

| # | Entrada | Resultado esperado |
|---|---|---|
| REG-01 | Como A2, `(S0, motivo, 'justificantes/<A2>/<uuid>.pdf')` sobre AS7 `ausente` | OK. `estatus='pendiente'`, `registrado_por=U_A2`, `resuelto_por NULL`, `fecha_registro = app.now()`; retorno con `registrado_por_rol='alumno'` |
| REG-02 | Como A3 sobre AS8 `retardo` | OK |
| REG-03 | Sobre registro `presente` (AS4 como A4) | `ESTADO_NO_JUSTIFICABLE` |
| REG-04 | Sobre `pendiente` (AS1 como A1) | `ESTADO_NO_JUSTIFICABLE` |
| REG-05 | Sobre `justificado` | `ESTADO_NO_JUSTIFICABLE` |
| REG-06 | A2 en una sesión de G1 sin registro suyo | `ASISTENCIA_NO_ENCONTRADA`; además un `INSERT` directo (prueba de esquema) viola `fk_justificante_asistencia` (23503) |
| REG-07 | Segundo justificante mientras el primero está `pendiente` | `JUSTIFICANTE_DUPLICADO` |
| REG-08 | Dos llamadas simultáneas para el mismo registro | exactamente una inserta; la otra `JUSTIFICANTE_DUPLICADO` (por `FOR UPDATE` y por `ux_justificante_pendiente`) |
| REG-09 | Tras un `rechazado`, registrar uno nuevo | OK |
| REG-10 | Motivo vacío / solo espacios / 201 caracteres / 200 caracteres | `VALIDACION` / `VALIDACION` / `VALIDACION` / OK |
| REG-11 | `p_objeto_documento` = ruta de otro alumno, `../x.pdf`, extensión `.exe`, uuid mal formado, NULL | `DOCUMENTO_INVALIDO` (NULL: `DOCUMENTO_INVALIDO`) |
| REG-12 | Como A2 con `p_id_alumno = A3` | `NO_AUTORIZADO` |
| REG-13 | Como D1 con `p_id_alumno = A2` sobre S0 | OK; `registrado_por=U_D1`, `registrado_por_rol='docente'`; el justificante sigue `pendiente` |
| REG-14 | Como D1 sin `p_id_alumno` | `VALIDACION` |
| REG-15 | Como D2 con `p_id_alumno = A2` (grupo de D1) | `NO_AUTORIZADO` |
| REG-16 | Sobre sesión `abierta` | `SESION_NO_CERRADA` |
| REG-17 | `U_ADM` / `U_TEC` | `NO_AUTORIZADO` |
| REG-18 | `api_validar_justificante` con los mismos casos REG-03…REG-07, REG-12…REG-16 | mismos códigos; no inserta nada (conteo de `justificante` sin cambio) |

### 6.4 Resolver justificante (RF-12, RN-09)

| # | Entrada | Resultado esperado |
|---|---|---|
| RES-01 | D1 aprueba el justificante de AS7 (`ausente`) | `justificante.estatus='aprobado'`, `resuelto_por=U_D1`, `fecha_resolucion=app.now()`; AS7 `justificado`, `origen='correccion'`; **el conteo de `deteccion` de A2 en la sesión y de `captura` es idéntico al previo**; el registro `asistencia` sigue existiendo (mismo `id_asistencia`); bitácora `aprobacion_justificante` con `valor_anterior.estado_asistencia='ausente'` |
| RES-02 | D1 aprueba el de AS8 (`retardo` 07:12:30) | `justificado`; `hora_registro` sigue 07:12:30; `conteo_detecciones` intacto |
| RES-03 | D1 rechaza | `estatus='rechazado'`, `resuelto_por` y `fecha_resolucion` con valor; AS conserva estado y origen; bitácora `rechazo_justificante` |
| RES-04 | Resolver uno ya `aprobado`/`rechazado` | `JUSTIFICANTE_YA_RESUELTO` |
| RES-05 | D2 o A2 resuelven | `NO_AUTORIZADO` |
| RES-06 | `p_aprobar = NULL` | `VALIDACION` |
| RES-07 | id inexistente | `NO_ENCONTRADO` |
| RES-08 | Aprobar 30 días después del fin de la sesión | OK (sin plazo) |
| RES-09 | G48/A9 con 10 faltas eq. (20.83 %, sin derecho); D1 aprueba un justificante de una de ellas | queda en 9 (18.75 %); retorno `derecho_examen_anterior=false`, `derecho_examen=true`; bitácora `notificacion` |
| RES-10 | El registro cambió a `presente` por manipulación directa antes de aprobar | `ESTADO_NO_JUSTIFICABLE` |
| RES-11 | Aprobar con comentario de 201 caracteres | `VALIDACION` |
| RES-12 | Aprobación con reloj hacia atrás respecto a `fecha_registro` | la violación de `ck_justificante_resolucion` (23514) se propaga; documenta que el reloj de pruebas no debe retroceder |
| RES-13 | Tras aprobar, `api_corregir_asistencia` sobre ese registro | `TRANSICION_NO_PERMITIDA` |

### 6.5 Cola de revisión (RF-18)

| # | Entrada | Resultado esperado |
|---|---|---|
| COL-01 | D1 con fixture (ahora 09:40) | `pendientes` = [AS1] únicamente (AS6 es de sesión abierta; AS5 es de D2); `contadores.pendientes = 1`; nada de G2 |
| COL-02 | D2 | solo AS5 |
| COL-03 | AS1: `vence_en` = `2026-09-16T09:00:00-06:00`; `segundos_restantes = 170400`; con ahora = 48 h + 1 s: `vencido=true` y `segundos_restantes=-1` | coincide |
| COL-04 | `estado_sugerido`: primera lectura válida a las 07:09:59 / 07:10:00 / 07:20:00 / 07:04:55 | `presente` / `retardo` / `retardo` / `presente` |
| COL-05 | `lecturas` de AS1 | 3 elementos; las 2 válidas primero; `es_valida` y `score_similitud` correctos; `lecturas_validas=2`, `mejor_score=0.912`; **ninguna clave `objeto_*`** en el JSON |
| COL-06 | Tras la purga de recortes (`objeto_recorte` NULL) | `tiene_recorte=false`; sin error |
| COL-07 | `justificantes` con un justificante registrado por D1 y otro por el alumno | `registrado_por_rol` = `docente` / `alumno` |
| COL-08 | Resolver AS1 y volver a pedir la cola | el caso sale de `pendientes`, baja el contador y entra a `correcciones_recientes` con `estado_anterior='pendiente'` |
| COL-09 | Resolución del job (JOB-01) | aparece en `correcciones_recientes` de D1 con `automatica=true`, `usuario.rol='tecnico'` |
| COL-10 | A1, `U_ADM`, `U_TEC` | `NO_AUTORIZADO` |
| COL-11 | `p_pestana='x'` → `VALIDACION`; `p_limit=500` → se acota a 200; `p_pestana='pendientes', p_offset=1` con 3 casos | solo `pendientes` con 2 elementos; las otras listas `[]`; `contadores.pendientes=3` |
| COL-12 | `corregible` en una corrección dentro de plazo / fuera de plazo / sobre registro ya `justificado` | `true` / `false` / `false` |

### 6.6 Lecturas, recortes y bitácora de consulta (RF-19, RNF-04/05/08)

| # | Entrada | Resultado esperado |
|---|---|---|
| DET-01 | `api_detecciones_caso(AS1)` como D1 | `lecturas` con 3 elementos, `objeto_foto_registro` de la plantilla activa de A1, `camara_posicion` correcto, `id_usuario=U_D1`, `vigencia_url_firmada_seg=300` |
| DET-02 | Mismo, como D2 | `NO_ENCONTRADO` |
| DET-03 | Como A1 / `U_ADM` | `NO_AUTORIZADO` |
| DET-04 | `vigencia_url_firmada_seg` = 900 en `parametro_sistema` | la RPC devuelve 300 (`LEAST`) |
| DET-05 | `p_solo_validas=true` | solo las 2 válidas; `total=2` |
| DET-06 | `GET /api/casos/{AS1}/detecciones` como D1 | 200; **una** fila nueva en bitácora: `accion='consulta'`, `entidad='asistencia'`, `id_registro=AS1`, `id_usuario=U_D1`, `ip_origen` = IP de `x-forwarded-for`, `valor_nuevo` con ids de detección; `createSignedUrl` invocado con TTL ≤ 300 para cada recorte y para la foto; la respuesta no contiene rutas `objeto_*` |
| DET-07 | Mismo GET como D2 | 404 `NO_ENCONTRADO`; **cero** filas nuevas en bitácora; sin URLs |
| DET-08 | Sin sesión / como alumno | 401 `NO_AUTENTICADO` / 403 `NO_AUTORIZADO` |
| DET-09 | Recorte purgado | `recorte: null`, `recorte_disponible: false`; 200 |
| DET-10 | Falla el asiento de bitácora (simulado) | 503 `BITACORA_NO_DISPONIBLE`; no se firma ninguna URL |
| DET-11 | `id_asistencia='abc'`, `limit=500`, `solo_validas='si'` | 400 `VALIDACION` |
| DET-12 | Alumno sin plantilla activa | `foto_registro: null` |
| DET-13 | Dos aperturas del mismo caso | dos filas de bitácora (una por consulta) |
| DET-14 | Una URL firmada con TTL 300 usada tras 301 s (prueba de integración con almacenamiento real/local) | rechazada (403) |
| DET-15 | `x-forwarded-for: no-es-ip` | `ip_origen NULL`, la consulta se asienta igual |

### 6.7 Documento del justificante (RF-12, RNF-04)

| # | Entrada | Resultado esperado |
|---|---|---|
| DOC-01 | `POST /api/justificantes/documento` como A2: PDF real de 1 MB, `id_sesion=S0` | 201; `objeto_documento` coincide con `^justificantes/<A2>/<uuid>\.pdf$`; objeto existe en el bucket |
| DOC-02 | Archivo de exactamente 5 242 880 bytes | 201 |
| DOC-03 | Archivo de 5 242 881 bytes | 413 `ARCHIVO_DEMASIADO_GRANDE`; nada en el bucket |
| DOC-04 | `text/plain`; `application/zip` | 415 `TIPO_NO_PERMITIDO` |
| DOC-05 | Declarado `application/pdf` pero contenido ejecutable/JPEG | 422 `ARCHIVO_INVALIDO` |
| DOC-06 | Nombre `x.exe` con contenido PNG válido y `image/png` | 201 y la ruta termina en `.png` (la extensión sale del contenido) |
| DOC-07 | Archivo vacío; sin campo `archivo` | 400 `VALIDACION` |
| DOC-08 | A2 envía `id_alumno=A3` | 403 `NO_AUTORIZADO`; nada subido |
| DOC-09 | D1 con `id_alumno=A2` de su grupo | 201 con ruta `justificantes/<A2>/…` |
| DOC-10 | D2 con `id_alumno=A2` | 403 `NO_AUTORIZADO` |
| DOC-11 | Destino `presente` / con justificante pendiente / sesión abierta | 409 `ESTADO_NO_JUSTIFICABLE` / `JUSTIFICANTE_DUPLICADO` / `SESION_NO_CERRADA`; nada subido |
| DOC-12 | Sesión sin registro del alumno | 404 `ASISTENCIA_NO_ENCONTRADA` |
| DOC-13 | Flujo completo: DOC-01 y luego `api_registrar_justificante` con la ruta devuelta | justificante `pendiente` visible en la cola de D1 |
| DOC-14 | `GET /api/justificantes/{15}/documento` como D1 | 200; URL con TTL ≤ 300; fila de bitácora `consulta/justificante/15` con IP; la respuesta no incluye la ruta |
| DOC-15 | Mismo GET como D2 / como alumno / sin sesión | 404 / 403 / 401; sin bitácora ni URL |
| DOC-16 | Falla el asiento de bitácora | 503, sin URL |

### 6.8 Visibilidad y permisos (RF-19, RF-21, Tabla 36)

| # | Entrada | Resultado esperado |
|---|---|---|
| VIS-01 | `api_mis_justificantes` como A2 con justificantes de A2 y A3 | solo los de A2 (A3, del mismo grupo, no aparece) |
| VIS-02 | `api_mis_justificables` como A2 | solo registros propios `ausente`/`retardo` de sesión `cerrada` sin justificante pendiente; excluye `presente`, `pendiente`, `justificado` y los que ya tienen uno pendiente; `tiene_rechazado` correcto |
| VIS-03 | `api_mis_justificantes` como D1 / `U_ADM` | `NO_AUTORIZADO` |
| VIS-04 | `api_sesiones_corregibles` como D1: ahora = 47 h / 49 h | S1 aparece con `segundos_restantes` ≈ 3600 / no aparece; S2 (abierta) nunca |
| VIS-05 | `api_registros_corregibles(S1)` como D1 | 4 registros ordenados por apellidos; `corregible=true`; `justificante_pendiente` correcto; con ahora = 49 h: `dentro_de_plazo=false` y `corregible=false` |
| VIS-06 | `api_registros_corregibles(S3)` como D1 | `NO_ENCONTRADO` |
| VIS-07 | Privilegios: `anon` ejecutando cualquier `api_*`/`svc_*` de este dominio; `authenticated` ejecutando `svc_registrar_consulta_revision` o `app.aplicar_correccion` | denegado; `service_role` ejecuta `svc_registrar_consulta_revision` |
| VIS-08 | `svc_registrar_consulta_revision` con `p_entidad='alumno'` / con `p_id_usuario=U_A1` / con IP inválida | `VALIDACION` / `NO_AUTORIZADO` / se asienta con `ip_origen NULL` |
| VIS-09 | Cuenta de docente `activo=false` | todas las RPC → `NO_AUTORIZADO` (`app.rol()` es NULL) |

### 6.9 Esquema y disparadores (requisitos de §5)

| # | Entrada | Resultado esperado |
|---|---|---|
| ESQ-01 | `UPDATE asistencia SET estado='presente', origen='automatico'` sobre AS1 (conteo 2) | rechazado por `trg_asistencia_ciclo` |
| ESQ-02 | El mismo `UPDATE` con `origen='correccion'` | aceptado |
| ESQ-03 | `UPDATE asistencia SET estado='pendiente'` sobre un `presente` con origen `correccion` | rechazado |
| ESQ-04 | Docente: `SELECT` de `camara` y `plantilla_facial` de un alumno de G1; de uno de G2 | visible / 0 filas |
| ESQ-05 | Alumno: `SELECT` de `sesion_clase`/`grupo`/`materia` de G1 (inscrito) y de G2 | visible / 0 filas |
| ESQ-06 | `INSERT` directo de dos `justificante` pendientes para el mismo registro | el segundo viola `ux_justificante_pendiente` (23505) |
| ESQ-07 | `UPDATE`/`DELETE` sobre `bitacora_auditoria` | rechazado por `trg_bitacora_sin_cambios` |
| ESQ-08 | `app.estado_sugerido_revision` con 9 min 59 s, 10 min 00 s, 20 min 00 s | `presente`, `retardo`, `retardo` |

---

## 7. Decisiones, supuestos y riesgos

**Desviaciones respecto a la especificación o al enunciado del dominio**

1. **[DESVIACION]** Índice único parcial extra `ux_justificante_pendiente` (la spec declara dos). Razón: la unicidad del justificante pendiente debe sobrevivir a dos envíos simultáneos; el `FOR UPDATE` lo cubre en la RPC y el índice lo respalda en el esquema. Es aditivo (no cambia columnas).
2. **[DESVIACION]** `api_cola_revision` recibe `p_pestana`, `p_limit`, `p_offset` (todos con default, compatible con `api_cola_revision()`), y devuelve además `contadores`, `generado_en`, `horas_limite_correccion` y `min_detecciones_validas`. Razón: contadores por pestaña y paginación (`{ total, items }` no aplica a un objeto de tres listas).
3. **[DESVIACION]** `api_registrar_justificante`: `p_id_alumno` va al final del orden de parámetros (PostgreSQL exige defaults al final). La llamada es por nombre.
4. **[DESVIACION]** RPC y funciones añadidas por necesidad del flujo: `api_validar_justificante` (evita subir archivos a destinos inválidos), `api_mis_justificables` (el formulario necesita las faltas justificables), `api_justificante_documento` (los handlers solo leen por RPC), `api_sesiones_corregibles` y `api_registros_corregibles` (cubren el inicio «Registro por corregir» de BPMN-02), `svc_registrar_consulta_revision` (los Route Handlers solo alcanzan `public`, no `app.bitacora`).
5. **[DESVIACION]** `correcciones_recientes` se lee con una función DEFINER acotada (`app.correcciones_recientes`) porque la bitácora solo es legible para el administrador (Tabla 36) y `api_cola_revision` es INVOKER. Alternativa descartada: una política RLS que abra la bitácora al docente.
6. **[DESVIACION]** No existe columna para el comentario de resolución ni para el motivo del rechazo; ambos viven solo en `valor_nuevo` de la bitácora. Consecuencia: el alumno ve el estatus `rechazado` pero no el motivo. No se añade columna sin decisión del equipo (candidato a cambio futuro: `justificante.comentario_resolucion VARCHAR(200)`).

**Decisiones**

1. Plazo (RN-08): `app.now() <= hora_fin + horas_limite_correccion` se acepta; a partir de un segundo después se rechaza. El job resuelve con `>` estricto. Ambos usan `app.limite_correccion`.
2. Un registro `justificado` no se revierte ni se modifica por corrección (evita un justificante `aprobado` huérfano de su efecto). Para cambiarlo haría falta una operación explícita no prevista en la spec.
3. `api_corregir_asistencia` no permite `pendiente` ni `justificado` como destino y bloquea `presente` si hay un justificante pendiente (decisión de coherencia, no de la spec). Hacer `retardo ↔ ausente` con justificante pendiente sí se permite porque sigue siendo justificable.
4. No hay plazo para registrar ni resolver justificantes: es la vía que la spec deja al alumno tras el vencimiento (BPMN-02, «Vencimiento del plazo»). El registro exige sesión `cerrada` y estado `ausente`/`retardo` (un `pendiente` aún lo decide el docente).
5. Aprobar un justificante fija `origen = 'correccion'` (la spec define el origen como «modificado por el docente»); `hora_registro` y `conteo_detecciones` se conservan.
6. Tras un rechazo el alumno puede enviar un nuevo justificante (nueva evidencia). No hay límite de intentos (riesgo bajo; el docente decide).
7. El docente no puede resolver desde la cola un pendiente de una sesión abierta; los pendientes entran a la cola al cerrar.
8. Qué se asienta como «consulta» (RF-19): la apertura de lecturas/recortes de un caso (Route Handler) y el documento de un justificante, una fila por petición. La lista de la cola **no** asienta bitácora porque no devuelve rutas ni imágenes, solo scores y banderas; la Tabla 6 (nota) fija que P-05 asienta «la consulta de recortes». Riesgo: una lectura estricta de RF-19 («toda lectura de registros de asistencia») exigiría asentar también el listado; si se requiere, bastaría que el front llame un `svc_` de consulta por carga de cola.
9. El asiento de la consulta se hace **antes** de firmar (fallo cerrado): si la bitácora no responde no se entrega ninguna URL.
10. `entidad = 'asistencia'` e `id_registro = id_asistencia` para consultas de lecturas; `'justificante'` para documentos. Los ids de detección van en `valor_nuevo`.
11. La ventana de `correcciones_recientes` (30 días) es una constante de la función, no un parámetro del sistema (`PARAMETRO_SISTEMA` tiene 11-12 claves cerradas por la spec).
12. El alumno no re-descarga su propio documento (la spec solo prevé la consulta del docente por URL firmada); no hay ruta para alumnos.
13. `SmartClass` no contiene un flujo de justificantes ni de corrección con bitácora; este diseño sale de la spec. Su autenticación insegura no se imita: toda identidad sale de la sesión de Supabase Auth.

**Supuestos**

- `app.recalcular_inscripcion(p_id_inscripcion integer)` (dominio `reportes`) es idempotente, escribe `derecho_examen` y la bitácora `notificacion` solo al cruzar el límite, y no falla si la inscripción está en `baja`.
- `app.bitacora(...)` rellena `fecha_hora` con `app.now()` y puede completar la IP desde `request.headers` cuando `p_ip` es NULL (en las RPC se pasa NULL; la IP se exige solo en las consultas de los handlers).
- La cuenta de servicio (`usuario.rol = 'tecnico'`) existe y su `id_usuario` lo resuelve el `svc_*` del job de `biometria`.
- `app.param_num('horas_limite_correccion')` y `app.param_num('vigencia_url_firmada_seg')` existen (Tabla 4).
- La página `/alumno` y el panel P-02 respetan los enlaces `?pestana=`, `?caso=` y `?justificar=` de §2.

**Riesgos**

1. **Archivos huérfanos**: el documento se sube antes de registrar el justificante; si el registro falla y el usuario abandona, queda un objeto sin referencia en `justificantes/{id_alumno}/`. Mitigación: `api_validar_justificante` previo (reduce la causa) y reintento sin re-subir. Un purgado de huérfanos > 24 h queda como mejora (job de `biometria`).
2. **IP de origen**: `x-forwarded-for` es falsificable salvo que el proxy de despliegue lo sobrescriba; configurar el proxy para que fije el encabezado. Si la IP no es válida se guarda NULL (la consulta se asienta igual).
3. **RLS incompleta** para docente sobre `camara`/`plantilla_facial` o para alumno sobre `sesion_clase`/`grupo`/`materia` rompe las RPC INVOKER con datos vacíos (§5.5, pruebas ESQ-04/05).
4. **Foto de registro visible al docente**: el prototipo la exige (P-05 marcador 2) aunque la matriz de permisos reserva plantilla facial al administrador; se acota a alumnos inscritos en sus grupos, por URL firmada ≤ 300 s y con asiento de bitácora.
5. **Carga de la cola**: `lecturas` por caso (máx. 10) con subconsultas sobre `deteccion` (la tabla más grande). Debe existir un índice de apoyo en `captura (id_sesion)` y `deteccion (id_captura)`/`(id_plantilla)`; a validar con `EXPLAIN` en el piloto.
6. **Límite de cuerpo**: con `src/proxy.js`, Next recorta silenciosamente el cuerpo al superar `proxyClientMaxBodySize` (10 MB por defecto). Como el tope funcional es 5 MiB, la validación sobre `archivo.size` y `Content-Length` basta; no subirlo sin revisar este handler.
7. **Reloj de pruebas**: `fecha_registro` y `fecha_resolucion` usan `app.now()`; si una prueba retrocede el reloj entre registro y resolución, `ck_justificante_resolucion` fallará (RES-12).
8. **Sin detección de vida** (spec §4.3): un recorte/lectura no prueba presencia física; la cola es precisamente el control humano.
9. Propiedad de archivos: `components/alumno/**` pertenece a `screens-reportes` según `docs/ARCHITECTURE.md` §7, pero `RegistrarJustificanteForm`, `MisJustificantes` y `JustificantesAlumno` se definen aquí. El lead debe asignar su implementación (propuesta: `screens-revision`, con `screens-reportes` solo montando `JustificantesAlumno`).
