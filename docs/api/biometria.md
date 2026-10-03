# Dominio BIOMETRIA — consentimiento, plantilla facial, índice FAISS, servicio de reconocimiento, consola técnica y jobs

Estado: contrato v1 (BASE). Fuente: `docs/spec/Avance1.txt` (Tablas 3-6, 13, 14-32, 34, 36; BPMN-03; Figura 10 flujos 1, 3 y 7) y `docs/ARCHITECTURE.md` §2-§5.
Este documento es ley para: db-api-b (SQL 02xx), recognition (servicio Python), route-handlers (`web/src/app/api`, `lib/server`, `lib/http`), data-layer (`lib/api/biometria.js`), screens-admin (montaje de paneles) y screens-tecnico (`/tecnico`).

Convenciones usadas (todas de `ARCHITECTURE.md` §2): solo-RPC; `api_*` a `authenticated`, `svc_*` a `service_role`; esquema `app` privado; todo tiempo de negocio con `app.now()`; errores `RAISE EXCEPTION '<mensaje>' USING ERRCODE = 'P0001', HINT = '<CODIGO>'`; JSON `snake_case`; listas `{ total, items }` con `p_limit` (def. 50, máx. 200) y `p_offset`; fechas ISO 8601 (`fecha` = `YYYY-MM-DD`, instantes con offset `-06:00`).

Nombres de archivo sugeridos para db-api-b: `supabase/migrations/0210_biometria_consentimiento_plantilla.sql`, `0211_biometria_indice.sql`, `0212_parametros_camaras.sql`, `0213_jobs.sql`; pruebas en `supabase/tests/api_b_biometria_*.sql`.

---

## 1. Alcance y trazabilidad

### 1.1 Alcance

Dentro:

- M2 Registro biométrico: consentimiento (RF-15, RN-13), plantilla única con archivado (RN-12), índice FAISS versionado con cambio atómico (RF-16, RNF-09).
- Servicio de reconocimiento (Python/FastAPI + `faiss-cpu`): endpoints de salud, estado de índice, verificación de foto, construcción/activación de índice y reconocimiento (parte de RF-03/RF-04/RF-05).
- Consola del técnico: cámaras (solo estatus), parámetros del sistema (RNF-02), estado y reconstrucción del índice.
- Programador de tareas: 5 jobs (`cerrar-sesiones`, `resolver-pendientes`, `purgar-recortes`, `reconstruir-indice`, `recalcular`) y la cuenta de servicio.
- Parte biométrica de P-06 (paneles `ConsentimientoPanel` y `PlantillaFacialPanel`), montada por la página del alumno (dominio admin).

Fuera (otros dominios): alta/edición del alumno (admin), `POST /api/sesiones/{id}/captura` y `svc_alumnos_candidatos`/`svc_registrar_detecciones` (sesiones), `app.cerrar_sesion` (sesiones), `app.recalcular_*` y `v_resumen_asistencia` (reportes), `app.now()`/`app.bitacora()`/RLS (plataforma), componentes `ui/*` (ui-kit).

### 1.2 Trazabilidad RF / RN / RNF -> artefacto

| Requisito | Artefactos que lo cubren |
|---|---|
| RF-15 plantilla solo con consentimiento firmado y vigente, foto con un solo rostro vectorizable, foto en bucket | `api_consentimiento_registrar`, `api_consentimientos_alumno`, `api_plantilla_registrar`, `app.consentimiento_vigente`, `trg_plantilla_rn13` (contrato en §5), `POST /api/consentimientos`, `POST /api/alumnos/{id}/plantilla`, `POST /api/plantilla/verificar`, servicio `POST /v1/photo/check`, componentes `ConsentimientoPanel`, `PlantillaFacialPanel`, `CalidadFotoResumen` (P-06) |
| RF-16 archivar anterior, versión nueva del índice con todas las activas, `faiss_id`, cambio atómico sin interrumpir | `api_plantilla_registrar` (archivar y luego insertar), `svc_indice_plan`, `svc_indice_registrar`, `svc_indice_activar`, `svc_indice_revertir`, `svc_indice_en_uso`, `lib/server/indice.js::reconstruirIndice`, servicio `/v1/index/build` y `/v1/index/activate`, job `reconstruir-indice`, `IndiceFacialPanel` |
| RN-12 una plantilla activa por alumno, un índice en uso | `ux_plantilla_facial_activa`, `ux_indice_faiss_en_uso` (db-schema), orden archivar-insertar en `api_plantilla_registrar`, orden FALSE-TRUE en `svc_indice_activar`/`svc_indice_revertir` |
| RN-13 sin consentimiento vigente no hay plantilla | `trg_plantilla_rn13` (red de seguridad), validación previa en `api_plantilla_registrar`, `app.consentimiento_vigente`, botón "Registrar plantilla" deshabilitado sin consentimiento vigente, `app.vencer_consentimientos` (job `recalcular`) |
| RF-03 (servicio) muestreo por cámara | Servicio `POST /v1/recognize` con `camera_url` (el muestreo lo orquesta el dominio sesiones); `api_camaras_estado` expone `ultima_captura` y `capturas_24h` para vigilar las 80 ± 1 capturas |
| RF-04 búsqueda k-NN solo entre inscritos con consentimiento | Servicio `/v1/recognize` con `allowed_faiss_ids` + `IDSelectorBatch`; índice `IndexIDMap2(IndexFlatIP)`; `svc_indice_en_uso` para el arranque |
| RF-05 (servicio) candidato y score aunque no alcance el umbral | `/v1/recognize` devuelve siempre el mejor candidato permitido con `score = (coseno+1)/2`; el umbral lo aplica sesiones |
| RF-10 cierre por programador de tareas | `svc_job_cerrar_sesiones`, `POST /api/jobs/cerrar-sesiones` |
| RF-11 / RN-08 pendientes vencidos -> ausente con cuenta de servicio | `svc_job_resolver_pendientes`, `POST /api/jobs/resolver-pendientes`, `app.id_cuenta_servicio`, `app.asumir_cuenta_servicio` |
| RF-13 / RF-14 / RN-10 / RN-11 recálculo | `svc_job_recalcular` (invoca `app.recalcular_grupo`) |
| RF-19 consulta de datos biométricos en bitácora | `api_documento_url_autorizar` (asienta `consulta` al emitir URL de foto/documento) |
| RF-22 (parte técnico) cámaras | `api_camaras_estado`, `api_camara_cambiar_estatus`, `CamarasEstado` |
| RNF-01 k-NN <= 50 ms p95 con 20 000; captura <= 7.5 s | Servicio: estrategia de búsqueda (§4B.6), presupuesto de tiempos (§4B.7), pruebas SVC-20..SVC-24 |
| RNF-02 parámetros calibrables, con bitácora | `api_parametros_listar`, `api_parametro_actualizar`, `app.parametro_meta`, `ParametrosEditor` |
| RNF-03 0 vectores/imágenes en la BD | Solo `faiss_id` y rutas `objeto_*`; vector solo en memoria y en el JSON del bucket; prueba SQL-48 |
| RNF-04 URL firmada <= 300 s | `POST /api/alumnos/{id}/documento-url` usa `vigencia_url_firmada_seg` (tope 300 impuesto por `app.parametro_meta`) |
| RNF-05 purga de recortes a 7 días, `objeto_recorte` -> NULL, fila conservada | `svc_job_purgar_recortes_listar`, `svc_job_purgar_recortes_marcar`, `POST /api/jobs/purgar-recortes` |
| RNF-06 sin reconocimiento sin consentimiento | `allowed_faiss_ids` lo arma sesiones con consentimiento vigente (`app.consentimiento_vigente`); `api_consentimiento_revocar` archiva la plantilla |
| RNF-08 trazabilidad | Bitácora: `alta_plantilla`, `cambio_parametro`, `consulta`, `correccion` (job), `cierre_sesion` (job), `notificacion` (job vía recálculo) |
| RNF-09 reconstrucción <= 10 min sin interrumpir; 20 000 <= 2x tiempo de 5 000 | Reconstrucción incremental (conserva vectores), `svc_indice_activar` atómica, precarga + cambio de puntero atómico, estrategia `subset` de búsqueda |
| RNF-12 independencia del lenguaje | El servicio solo conoce `faiss_id`, `id_plantilla` y rutas; JSON de índice documentado |
| RNF-13 360 px | Paneles y consola en una columna, tablas como lista de tarjetas (§2) |
| RNF-14 índice reconstruible | `svc_indice_plan(p_completa => true)` + `/v1/index/build` con `base_version = null` |
| BPMN-03 | Alta/consentimiento: `ConsentimientoPanel` -> `POST /api/consentimientos`. Compuerta RN-13: `api_plantilla_registrar`. Foto + calidad: `/v1/photo/check`. Archivar/insertar: `api_plantilla_registrar`. Construir y precargar: `/v1/index/build` + `/v1/index/activate (preload_only)`. Cambio de versión: `svc_indice_activar` |
| Figura 10 flujo 1 | Fotograma -> `/v1/recognize` (`image` o `camera_url`) |
| Figura 10 flujo 3 | Recortes -> bucket `recortes/{id_sesion}/{id_captura}/{n}.jpg` subidos por el servicio |
| Figura 10 flujo 7 | Nueva versión del índice: `/v1/index/build` -> `indice/<version>.json` -> `svc_indice_registrar` -> `svc_indice_activar` |

### 1.3 Dependencias de otros dominios (nombres fijos)

`app.now()`, `app.tz()`, `app.param(text)`, `app.param_num(text)`, `app.rol()`, `app.id_usuario()`, `app.id_docente()`, `app.id_alumno()`, `app.es_admin()`, `app.bitacora(...)`, `app.cerrar_sesion(integer, boolean)`, `app.recalcular_inscripcion(integer)`, `app.recalcular_grupo(integer)`, `api_yo()` (identidad y rol, plataforma), componentes `ui/*`, `ApiError`.

Supuestos exigidos a esos dominios (ver §7 "Solicitudes"):

1. `app.id_usuario()` y `app.rol()` resuelven al usuario a partir de `auth.uid()` (GUC `request.jwt.claims`), no de `current_user`, para que `app.asumir_cuenta_servicio()` funcione.
2. `app.cerrar_sesion(id, false)` asienta `cierre_sesion` con la identidad vigente (la cuenta de servicio en los jobs).
3. `svc_alumnos_candidatos` (sesiones) filtra consentimiento con `app.consentimiento_vigente(id_consent)` y plantillas con `id_indice = (índice en_uso)`.

---

## 2. Pantallas y componentes

Diseño visual MÍNIMO (la base funcional). Tailwind con tokens semánticos del ui-kit, una sola columna a 360 px, sin animaciones. Todo texto de UI en español. Cada pantalla usa `DataState` del ui-kit (o `Spinner`/`EmptyState`/`ErrorState`) para cargando/vacío/error; los botones de acción tienen alto táctil mínimo de 44 px; los mensajes de resultado van en `Alert` con `role="status"` (éxito) o `role="alert"` (error).

### 2.1 P-06 — parte biométrica (consentimiento y plantilla facial)

- Ruta: se monta en `/admin/alumnos/[id]` (página del dominio admin, que también hace la parte RF-01 de P-06). `/admin/alumnos/nuevo` redirige a `[id]` tras crear al alumno.
- Roles: `administrador`. Cualquier otro rol recibe `NO_AUTORIZADO` de las RPC/rutas (la navegación ya oculta la ruta).
- Objetivo: BPMN-03 tras guardar al alumno: registrar el consentimiento firmado y, con él vigente, tomar la foto y registrar la plantilla.
- Composición esperada de la página (dominio admin, ~10 líneas):

```jsx
const [version, setVersion] = useState(0);
const recargar = () => setVersion((v) => v + 1);
<ConsentimientoPanel idAlumno={id} version={version} onCambio={recargar} />
<PlantillaFacialPanel idAlumno={id} version={version} onCambio={recargar} />
```

Datos que carga (RPC exactas, vía `@/lib/api/biometria`):

| Componente | Carga | Notas |
|---|---|---|
| `ConsentimientoPanel` | `consentimientosAlumno({ idAlumno })` = `api_consentimientos_alumno` | Estado, vigencia, historial |
| `PlantillaFacialPanel` | `consentimientosAlumno({ idAlumno })` y `plantillaAlumno({ idAlumno })` = `api_plantilla_alumno` | Necesita el consentimiento vigente y la plantilla activa con la versión de índice |

Acciones (vía `@/lib/http/biometria`, que llama a los Route Handlers):

| Acción | Cliente | Ruta |
|---|---|---|
| Registrar consentimiento (PDF + fechas) | `registrarConsentimiento(formData)` | `POST /api/consentimientos` |
| Revocar consentimiento | `revocarConsentimiento({ idConsent })` | `POST /api/consentimientos/{id}/revocar` |
| Ver documento / foto (URL firmada) | `solicitarUrlDocumento({ idAlumno, tipo, idRegistro })` | `POST /api/alumnos/{id}/documento-url` |
| Verificar calidad de la foto | `verificarFoto(blob)` | `POST /api/plantilla/verificar` |
| Registrar plantilla | `registrarPlantilla({ idAlumno, idConsent, foto })` | `POST /api/alumnos/{id}/plantilla` |

#### Componente `admin/ConsentimientoPanel`

Carpeta `web/src/components/admin/ConsentimientoPanel/` (`ConsentimientoPanel.jsx`, `useConsentimientos.js`, `consentimiento.utils.js`, `ConsentimientoPanel.test.jsx`, `index.js`).

| Prop | Tipo | Descripción |
|---|---|---|
| `idAlumno` | number (req.) | `alumno.id_alumno` |
| `version` | number (def. 0) | Cambiar su valor fuerza recarga (clave del efecto de carga) |
| `onCambio` | `() => void` (opc.) | Se invoca tras registrar o revocar con éxito |

Responsabilidad y contenido:

1. Resumen de estado (`Badge` con texto): "Vigente hasta AAAA-MM-DD (N días)", "Vencido", "Revocado" o "Sin consentimiento". Se deriva de `vigente` y `consentimiento_vigente` del RPC.
2. Botón "Ver documento firmado" (si `tiene_documento`): llama `solicitarUrlDocumento({ tipo: 'consentimiento', idRegistro: id_consent })` y abre `url` en pestaña nueva (`rel="noopener noreferrer"`). La URL dura <= 300 s; no se cachea.
3. Botón "Revocar" (solo sobre el consentimiento vigente) con `ConfirmDialog`: "Al revocar, se archivará la plantilla facial ligada y el alumno pasará a pase de lista manual." Tras confirmar llama `revocarConsentimiento`.
4. Formulario "Registrar consentimiento" (colapsado si ya hay uno vigente, abierto si no): `Field`+`Input type="date"` fecha de firma (máx. hoy), fecha "vigente hasta" (> firma), `FileInput accept="application/pdf"` (máx. 10 MB). Validación de cliente solo de conveniencia (la real es servidor). Envía `FormData` con `id_alumno`, `fecha_firma`, `vigencia_hasta`, `documento`.
5. Historial: lista de tarjetas (no tabla) con fecha de firma, vigencia, estatus y plantillas activas ligadas.

Estados: cargando (`Spinner`), vacío ("Este alumno aún no tiene consentimientos registrados. Registre el documento firmado para habilitar la plantilla facial."), error (`ErrorState` con "Reintentar"). Errores de acción en `Alert`: se muestra el `message` del `ApiError`.

#### Componente `admin/PlantillaFacialPanel`

Carpeta `web/src/components/admin/PlantillaFacialPanel/` (`PlantillaFacialPanel.jsx`, `usePlantillaFacial.js`, `plantillaFacial.utils.js`, test, `index.js`).

| Prop | Tipo | Descripción |
|---|---|---|
| `idAlumno` | number (req.) | Alumno |
| `version` | number (def. 0) | Fuerza recarga |
| `onCambio` | `() => void` (opc.) | Tras registrar la plantilla |

Responsabilidad y contenido:

1. Bloque "Plantilla actual": si existe `activa`: fecha de registro, "Indexada: sí/no", "Versión del índice: v003" (o "pendiente de indexar"), botón "Ver foto" (URL firmada, `tipo: 'plantilla'`, `idRegistro: id_plantilla`) y "N plantillas archivadas". Sin plantilla: "Sin plantilla facial; el alumno pasa lista de forma manual (RNF-06)."
2. Si no hay consentimiento vigente: `Alert` "Registre un consentimiento vigente para habilitar la captura" y la captura queda deshabilitada (no se monta `CameraCapture`).
3. Con consentimiento vigente: `CameraCapture` (ui-kit) con óvalo guía si el ui-kit lo ofrece (si no, se omite en la base) y alternativa `FileInput accept="image/jpeg"`. Lo único exigido al ui-kit es que entregue un `Blob` `image/jpeg`.
4. Al tener la imagen: vista previa + verificación automática `verificarFoto(blob)` (spinner "Verificando calidad…"). Se muestra `CalidadFotoResumen`.
5. Botones: "Repetir captura" y "Registrar plantilla". "Registrar plantilla" está habilitado solo si: hay consentimiento vigente, `resultado.un_solo_rostro === true`, `resultado.motivo_rechazo === null`, no hay envío en curso. Si ya existe plantilla activa, el texto indica "Reemplazar plantilla (la anterior se archivará)".
6. Al confirmar: `registrarPlantilla({ idAlumno, idConsent, foto })`. Éxito (201): `Alert` "Plantilla registrada. El índice se actualiza en segundo plano" y sondeo de `plantillaAlumno` cada 5 s, máximo 24 intentos, hasta `activa.indexada === true`; el sondeo se cancela al desmontar. Luego llama `onCambio`.
7. Errores: `FOTO_RECHAZADA` (muestra el motivo en español con el mapa de `plantillaFacial.utils.js`), `RN_13_CONSENTIMIENTO_NO_VIGENTE`, `RECONOCIMIENTO_NO_DISPONIBLE` ("El servicio de reconocimiento no responde; reintente"), cualquier otro con su `message`.

`plantillaFacial.utils.js` exporta `MOTIVOS_RECHAZO` y `esFotoAceptable(resultado)`:

| `motivo_rechazo` | Texto |
|---|---|
| `SIN_ROSTRO` | No se detectó ningún rostro. |
| `MULTIPLES_ROSTROS` | Hay más de un rostro en la imagen. |
| `ROSTRO_PEQUENO` | El rostro es muy pequeño; acérquese a la cámara. |
| `NO_FRONTAL` | Mire de frente a la cámara. |
| `POCA_LUZ` | Falta iluminación. |
| `EXCESO_LUZ` | Exceso de luz o contraluz. |
| `BORROSA` | La imagen está borrosa; mantenga quieta la cámara. |

#### Componente `admin/CalidadFotoResumen`

Carpeta `web/src/components/admin/CalidadFotoResumen/`. Presentacional.

| Prop | Tipo |
|---|---|
| `resultado` | `{ rostros: number, un_solo_rostro: boolean, calidad: { brillo: number, nitidez: number, tamano_rostro: number, frontal: boolean }, motivo_rechazo: string \| null }` |

Muestra lista de 5 renglones (Rostros detectados, Brillo, Nitidez, Tamaño del rostro en px, De frente) con texto "Correcto"/"Revisar" y el motivo si lo hay. Texto y color (no solo color).

### 2.2 Consola `/tecnico`

- Ruta: `/tecnico` (página delgada en `web/src/app/(app)/tecnico/page.jsx`, dominio screens-tecnico). El rol `tecnico` aterriza aquí tras iniciar sesión.
- Roles: `tecnico` (operación completa). `administrador` puede abrir la ruta con solo lectura de cámaras e índice (ver §7 D6); `ParametrosEditor` se muestra en modo lectura para `administrador`.
- Objetivo: vigilar cámaras, ajustar parámetros (RNF-02) y supervisar el índice facial (RF-16, RNF-09).
- Estructura: `PageHeader` "Consola técnica" + `Tabs` con "Cámaras", "Parámetros", "Índice facial" (pestaña activa en `?tab=camaras|parametros|indice`).

| Pestaña | Componente | Carga | Acciones |
|---|---|---|---|
| Cámaras | `tecnico/CamarasEstado` | `camarasEstado({ estatus?, limit, offset })` | `camaraCambiarEstatus({ idCamara, estatus })` |
| Parámetros | `tecnico/ParametrosEditor` | `parametrosListar()` | `parametroActualizar({ clave, valor })` |
| Índice facial | `tecnico/IndiceFacialPanel` | `obtenerEstadoIndice()` = `GET /api/indice` | `reconstruirIndice({ completa })`, `sincronizarIndice()`, `revertirIndice({ idIndice })` |

#### `tecnico/CamarasEstado`

Props: ninguna. Hook `useCamarasEstado.js` (carga, filtro por estatus, recarga cada 30 s mientras la pestaña está visible).
Contenido: lista de tarjetas (una por cámara): aula (clave y edificio), posición, tipo (`ip`/`navegador`), IP (si hay), estatus actual (`StatusChip`/`Badge` con texto), "Última captura: hace N min" o "Sin capturas", "Capturas 24 h: N", y marca "Sesión abierta en el aula" si `sesion_abierta`. `Select` de estatus (`activa`, `inactiva`, `mantenimiento`); al cambiar abre `ConfirmDialog` ("Cambiar la cámara A-12 frente a mantenimiento. Las sesiones nuevas del aula pasarán a pase manual si no queda otra cámara activa.") y, al confirmar, llama la RPC. Si la respuesta trae `advertencias`, se muestran en `Alert`.
Estados: vacío ("No hay cámaras registradas."), error (`ErrorState`), cargando.

#### `tecnico/ParametrosEditor` y `tecnico/ParametroFila`

`ParametrosEditor`: props `soloLectura?: boolean` (def. false). Carga `parametrosListar()` y pinta una `ParametroFila` por clave.
`ParametroFila` props: `parametro` (objeto de `items`), `soloLectura`, `onGuardar(clave, valor) => Promise`. Muestra clave, descripción, `Input` con el valor (inputMode numérico), ayuda "Rango: min a max unidad" (de `minimo`/`maximo`/`unidad`), "Última modificación: fecha, por correo", botón "Guardar" (deshabilitado si el valor no cambió o está en blanco). Tras guardar: `Toast` "Parámetro actualizado" y `advertencias` en `Alert`. Error `PARAMETRO_VALOR_INVALIDO`: `message` bajo el campo. La validación definitiva siempre es de servidor.

#### `tecnico/IndiceFacialPanel`

Props: `soloLectura?: boolean`. Hook `useIndiceFacial.js` (carga, ejecución de operaciones largas, recarga cada 10 s mientras hay operación en curso).
Contenido:

1. Tarjeta "Versión en uso": versión, total de vectores, dimensión, fecha de construcción; `Badge` "Sincronizado con el servicio" o "Servicio desincronizado" (`sincronizado` false) o "Servicio no disponible".
2. Contadores: plantillas activas, indexadas, pendientes, obsoletas en índice; "Requiere reconstrucción: sí/no".
3. Botón "Reconstruir índice" (`ConfirmDialog`), `Checkbox` "Reconstrucción completa (reprocesa todas las fotos; tarda más)". Mientras corre: `Spinner` y botones deshabilitados. Resultado: `Alert` con estado (`activada` / `sin_cambios`), versión, vectores y `errores` si los hay. `RECONSTRUCCION_EN_CURSO` se muestra como aviso, no como fallo.
4. Botón "Sincronizar servicio" (visible solo si `sincronizado === false` y el servicio está disponible).
5. Lista de versiones (`versiones.items`, tarjetas): versión, vectores, fecha, "En uso"; para las que no están en uso, botón "Revertir a esta versión" (`ConfirmDialog` con advertencia de que las plantillas registradas después quedarán pendientes). Solo `tecnico`.
6. Detalle de pendientes (`pendientes_detalle`): id de plantilla y fecha; sirve para detectar plantillas atoradas.

Estados: cargando, error, y servicio no disponible (la sección de estado de BD sigue visible; la del servicio muestra "No disponible").

### 2.3 Capa de datos que este dominio exige

`web/src/lib/api/biometria.js` (data-layer; una función async por RPC, camelCase sin `api_`, argumentos sin `p_`, nunca exponer `p_ip`: las pasa el Route Handler cuando las usa):

| Función | RPC |
|---|---|
| `consentimientoRegistrar({ idAlumno, fechaFirma, vigenciaHasta, objetoDocumento })` | `api_consentimiento_registrar` |
| `consentimientoRevocar({ idConsent })` | `api_consentimiento_revocar` |
| `consentimientosAlumno({ idAlumno, limit, offset })` | `api_consentimientos_alumno` |
| `plantillaRegistrar({ idAlumno, idConsent, objetoFoto })` | `api_plantilla_registrar` |
| `plantillaAlumno({ idAlumno, limit, offset })` | `api_plantilla_alumno` |
| `documentoUrlAutorizar({ tipo, idRegistro })` | `api_documento_url_autorizar` |
| `indiceEstado({ limit, offset })` | `api_indice_estado` |
| `parametrosListar({ limit, offset })` | `api_parametros_listar` |
| `parametroActualizar({ clave, valor })` | `api_parametro_actualizar` |
| `camarasEstado({ estatus, limit, offset })` | `api_camaras_estado` |
| `camaraCambiarEstatus({ idCamara, estatus })` | `api_camara_cambiar_estatus` |

`web/src/lib/http/biometria.js` (route-handlers): `registrarConsentimiento(formData)`, `revocarConsentimiento({ idConsent })`, `solicitarUrlDocumento({ idAlumno, tipo, idRegistro })`, `verificarFoto(blob)`, `registrarPlantilla({ idAlumno, idConsent, foto })`, `obtenerEstadoIndice()`, `reconstruirIndice({ completa })`, `sincronizarIndice()`, `revertirIndice({ idIndice })`. Todas devuelven el JSON o lanzan `ApiError` con `code` del cuerpo `{ error: { code, message, details? } }`.

---

## 3. RPC

### 3.0 Reglas comunes

- Toda `api_*` de este dominio: `GRANT EXECUTE ... TO authenticated`, `REVOKE ... FROM PUBLIC, anon`. Toda `svc_*`: solo `service_role`.
- `SECURITY DEFINER` lleva `SET search_path = public, app, pg_temp`. Todas validan el rol al inicio con `app.rol()` y lanzan `NO_AUTORIZADO` (mensaje "No tiene permiso para esta operación.") si no corresponde. Sin sesión (`app.rol()` nulo) también `NO_AUTORIZADO`.
- Las lecturas que el técnico necesita sin poder leer las tablas (`api_indice_estado`, `api_camaras_estado`, `api_parametros_listar`) son `SECURITY DEFINER` con comprobación explícita de rol y devuelven solo agregados o datos no personales [DESVIACION leve de ARCHITECTURE §2 "lecturas INVOKER"; ver §7 D4].
- Las rutas de objeto que las RPC reciben se validan con `app.es_ruta_objeto` (§5): prefijo y `id_alumno` deben coincidir con el registro al que se ligan. La BD guarda siempre la ruta relativa al bucket (<= 255 caracteres).
- Los `p_ip inet` los pasa el Route Handler (primer valor de `x-forwarded-for` validado como IP, o `NULL`); alimentan `ip_origen` de la bitácora.
- Ningún `api_*` devuelve `objeto_*` salvo `api_documento_url_autorizar` (que lo necesita el Route Handler). Ninguno devuelve vectores (no existen en la BD).

### 3.0.1 Códigos de error del dominio

| CODIGO | Mensaje | Cuándo |
|---|---|---|
| `NO_AUTORIZADO` | No tiene permiso para esta operación. | Rol no permitido |
| `NO_ENCONTRADO` | `<Entidad> no existe.` (p. ej. "El alumno no existe.") | Id inexistente |
| `VALIDACION` | Texto específico del campo | Fechas, enums o límites inválidos |
| `RUTA_INVALIDA` | La ruta del archivo no es válida para este registro. | Ruta de objeto mal formada o de otro alumno |
| `ALUMNO_INACTIVO` | El alumno no tiene estatus activo. | Registrar consentimiento o plantilla de alumno con estatus distinto de `activo` |
| `RN_13_CONSENTIMIENTO_NO_VIGENTE` | El consentimiento no está firmado y vigente. | RN-13: revocado, vencido, fecha fuera de vigencia, o revocar uno que ya no es vigente |
| `RN_13_CONSENTIMIENTO_AJENO` | El consentimiento pertenece a otro alumno. | RN-13 |
| `RN_12_PLANTILLA_ACTIVA_DUPLICADA` | El alumno ya tiene una plantilla activa. | 23505 `ux_plantilla_facial_activa` (solo si se salta la RPC) |
| `RN_12_INDICE_EN_USO_DUPLICADO` | Ya existe una versión del índice en uso. | 23505 `ux_indice_faiss_en_uso` (orden inverso o SQL directo) |
| `INDICE_DIMENSION_INVALIDA` | La dimensión del índice no coincide con `dimension_vector`. | Registrar versión |
| `INDICE_VERSION_DUPLICADA` | La versión del índice ya existe. | Registrar con otra ruta o total |
| `INDICE_MAPEO_INVALIDO` | El mapeo `id_plantilla`/`faiss_id` es inválido. | Estructura, duplicados, `faiss_id` < 0 |
| `INDICE_MAPEO_INCOMPLETO` | El mapeo no corresponde al total de vectores del índice. | `count(mapeo) <> total_vectores` |
| `INDICE_PLAN_OBSOLETO` | El plan cambió mientras se construía el índice; reintente. | Plantilla archivada/inexistente en el mapeo, o activa indexada que falta en el mapeo |
| `INDICE_NO_REVERTIBLE` | La versión indicada no puede ponerse en uso. | Dimensión distinta o ya en uso con mapeo distinto |
| `PARAMETRO_NO_ENCONTRADO` | El parámetro no existe. | Clave desconocida |
| `PARAMETRO_VALOR_INVALIDO` | Texto con el rango (p. ej. "intervalo_muestreo_seg debe ser un entero entre 5 y 120.") | Valor fuera de tipo/rango o incoherente con otro parámetro |
| `SERVICIO_NO_CONFIGURADO` | La cuenta de servicio del sistema no está configurada. | `app.id_cuenta_servicio()` sin fila |
| `BLOQUEO_OCUPADO` | El recurso está en uso por otro proceso. | Solo informativo: `svc_bloqueo_adquirir` devuelve `false`, no lanza |

Mapeo de restricciones (23xxx) a código, que la capa de datos aplica si una escritura directa las dispara (las RPC las evitan con validación previa): `ux_plantilla_facial_activa` -> `RN_12_PLANTILLA_ACTIVA_DUPLICADA`; `ux_indice_faiss_en_uso` -> `RN_12_INDICE_EN_USO_DUPLICADO`; `uq_indice_faiss_version` -> `INDICE_VERSION_DUPLICADA`; `uq_plantilla_indice_faiss_id` -> `INDICE_MAPEO_INVALIDO`; `ck_plantilla_indexada` -> `INDICE_MAPEO_INVALIDO`; `ck_consentimiento_vigencia` -> `VALIDACION`.

### 3.1 `api_consentimiento_registrar`

```sql
CREATE FUNCTION public.api_consentimiento_registrar(
    p_id_alumno       integer,
    p_fecha_firma     date,
    p_vigencia_hasta  date,
    p_objeto_documento text,
    p_ip              inet DEFAULT NULL
) RETURNS jsonb
```

- Llama: `administrador` (desde `POST /api/consentimientos`). `SECURITY DEFINER`.
- Lee: `alumno`. Escribe: `consentimiento`.
- Reglas (RN-13, RF-15, BPMN-03): el alumno existe y tiene `estatus = 'activo'`; `p_fecha_firma <= hoy` (hoy = `(app.now() AT TIME ZONE app.tz())::date`); `p_vigencia_hasta > p_fecha_firma` (`ck_consentimiento_vigencia`) y `p_vigencia_hasta >= hoy` (no se registra un consentimiento ya vencido); `p_objeto_documento` cumple `consentimientos/{p_id_alumno}/<uuid>.pdf`. Inserta con `estatus = 'vigente'`. No modifica consentimientos previos (el historial se conserva; el vigente es el de mayor `vigencia_hasta`).
- Bitácora: ninguna (el enum `accion_bitacora` no tiene valor para consentimiento; ver §7 D9).

Retorno:

```json
{
  "id_consent": 9,
  "id_alumno": 17,
  "fecha_firma": "2026-08-24",
  "vigencia_hasta": "2027-08-23",
  "estatus": "vigente",
  "vigente": true
}
```

Errores: `NO_AUTORIZADO`; `NO_ENCONTRADO` ("El alumno no existe."); `ALUMNO_INACTIVO`; `VALIDACION` ("La fecha de firma no puede ser futura." / "La vigencia debe ser posterior a la fecha de firma." / "La vigencia ya terminó."); `RUTA_INVALIDA`.

### 3.2 `api_consentimiento_revocar`

```sql
CREATE FUNCTION public.api_consentimiento_revocar(
    p_id_consent integer,
    p_ip         inet DEFAULT NULL
) RETURNS jsonb
```

- Llama: `administrador` (desde `POST /api/consentimientos/{id}/revocar`). `SECURITY DEFINER`.
- Lee/escribe: `consentimiento` (`FOR UPDATE`), `plantilla_facial`.
- Reglas (RN-13, RNF-06): el consentimiento debe estar `vigente` (estatus `'vigente'`), si no `RN_13_CONSENTIMIENTO_NO_VIGENTE`. En una transacción: `estatus = 'revocado'` y `UPDATE plantilla_facial SET activa = false WHERE id_consent = p_id_consent AND activa` [DESVIACION: la spec no dice qué pasa con la plantilla al revocar; se archiva para que el vector salga del índice en la siguiente reconstrucción, ver §7 D2]. El archivado pone `activa = false` (no dispara `trg_plantilla_rn13`, que solo valida cuando `NEW.activa`). No borra objetos del bucket.
- Bitácora: ninguna (§7 D9).

Retorno:

```json
{
  "id_consent": 9,
  "id_alumno": 17,
  "estatus": "revocado",
  "plantillas_archivadas": 1,
  "requiere_reconstruccion": true
}
```

Errores: `NO_AUTORIZADO`; `NO_ENCONTRADO` ("El consentimiento no existe."); `RN_13_CONSENTIMIENTO_NO_VIGENTE` ("El consentimiento ya no está vigente (estatus: revocado).").

### 3.3 `api_consentimientos_alumno`

```sql
CREATE FUNCTION public.api_consentimientos_alumno(
    p_id_alumno integer,
    p_limit     integer DEFAULT 50,
    p_offset    integer DEFAULT 0
) RETURNS jsonb
```

- Llama: `administrador`. `SECURITY INVOKER` (RLS: el administrador lee `consentimiento`); además `app.rol() = 'administrador'` explícito.
- Lee: `consentimiento`, `plantilla_facial` (conteo).
- Reglas: `vigente` = `app.consentimiento_vigente(id_consent)`; `estatus_efectivo` = `'revocado'` si estatus revocado; `'vigente'` si `vigente`; si no `'vencido'`. `dias_restantes` = `vigencia_hasta - hoy` si vigente (0 el último día), si no `null`. `consentimiento_vigente` = el vigente con mayor `vigencia_hasta` (desempate por `id_consent` mayor) o `null`. Orden de `items`: `fecha_firma DESC, id_consent DESC`.

Retorno:

```json
{
  "id_alumno": 17,
  "vigente": true,
  "consentimiento_vigente": { "id_consent": 9, "fecha_firma": "2026-08-24", "vigencia_hasta": "2027-08-23", "dias_restantes": 344 },
  "total": 2,
  "items": [
    { "id_consent": 9, "fecha_firma": "2026-08-24", "vigencia_hasta": "2027-08-23", "estatus": "vigente", "estatus_efectivo": "vigente", "vigente": true, "dias_restantes": 344, "plantillas_activas": 1, "tiene_documento": true },
    { "id_consent": 4, "fecha_firma": "2025-08-20", "vigencia_hasta": "2026-08-19", "estatus": "vigente", "estatus_efectivo": "vencido", "vigente": false, "dias_restantes": null, "plantillas_activas": 0, "tiene_documento": true }
  ]
}
```

Errores: `NO_AUTORIZADO`; `NO_ENCONTRADO` ("El alumno no existe.").

### 3.4 `api_plantilla_registrar`

```sql
CREATE FUNCTION public.api_plantilla_registrar(
    p_id_alumno    integer,
    p_id_consent   integer,
    p_objeto_foto  text,
    p_ip           inet DEFAULT NULL
) RETURNS jsonb
```

- Llama: `administrador` (desde `POST /api/alumnos/{id}/plantilla`, después de verificar la foto y subirla). `SECURITY DEFINER`.
- Lee: `alumno`, `consentimiento`. Escribe: `plantilla_facial`, `bitacora_auditoria`.
- Reglas, en UNA transacción y en este orden (RN-12, RN-13, RF-15, RF-16):
  1. Rol `administrador`.
  2. `SELECT ... FROM alumno WHERE id_alumno = p_id_alumno FOR UPDATE` (serializa altas concurrentes del mismo alumno). `NO_ENCONTRADO` si no existe; `ALUMNO_INACTIVO` si `estatus <> 'activo'`.
  3. `p_objeto_foto` cumple `registro/{p_id_alumno}/<uuid>.jpg` (`RUTA_INVALIDA`).
  4. Consentimiento: existe (`NO_ENCONTRADO`), `id_alumno` coincide (`RN_13_CONSENTIMIENTO_AJENO`), `app.consentimiento_vigente(p_id_consent)` (`RN_13_CONSENTIMIENTO_NO_VIGENTE`).
  5. ARCHIVAR primero: `UPDATE plantilla_facial SET activa = false WHERE id_alumno = p_id_alumno AND activa RETURNING id_plantilla, id_consent`.
  6. INSERTAR después: `INSERT INTO plantilla_facial (id_alumno, id_consent, id_indice, faiss_id, objeto_foto, fecha_registro, activa) VALUES (p_id_alumno, p_id_consent, NULL, NULL, p_objeto_foto, app.now(), true)`. El índice único parcial no es diferible: el orden inverso falla con 23505.
  7. `app.bitacora('alta_plantilla', 'plantilla_facial', <id_plantilla nueva>, <anterior>, <nuevo>, p_ip)`; `anterior` = `{ "id_plantilla": <archivada>, "id_consent": <su consentimiento>, "activa": true }` o `NULL` si no había; `nuevo` = `{ "id_plantilla": <nueva>, "id_consent": p_id_consent, "objeto_foto": p_objeto_foto, "activa": true, "plantilla_archivada": <id|null> }`.
- La foto anterior NO se borra del bucket (la plantilla queda archivada, RN-12).

Retorno:

```json
{
  "id_plantilla": 41,
  "id_alumno": 17,
  "id_consent": 9,
  "activa": true,
  "indexada": false,
  "plantilla_archivada": 33,
  "fecha_registro": "2026-09-14T09:12:41-06:00",
  "requiere_reconstruccion": true
}
```

Errores: `NO_AUTORIZADO`; `NO_ENCONTRADO` ("El alumno no existe." / "El consentimiento no existe."); `ALUMNO_INACTIVO`; `RUTA_INVALIDA`; `RN_13_CONSENTIMIENTO_AJENO`; `RN_13_CONSENTIMIENTO_NO_VIGENTE` ("El consentimiento no está firmado y vigente: la alta se rechaza.").

### 3.5 `api_plantilla_alumno`

```sql
CREATE FUNCTION public.api_plantilla_alumno(
    p_id_alumno integer,
    p_limit     integer DEFAULT 50,
    p_offset    integer DEFAULT 0
) RETURNS jsonb
```

- Llama: `administrador`. `SECURITY INVOKER` (+ rol explícito). Lee: `plantilla_facial`, `indice_faiss`, `consentimiento`.
- `activa.indexada` = `id_indice IS NOT NULL`; `activa.en_uso` = su `id_indice` es la versión en uso; `consentimiento_vigente` = `app.consentimiento_vigente(id_consent)`.
- `archivadas` paginadas (`{ total, items }`), orden `fecha_registro DESC`.

Retorno:

```json
{
  "id_alumno": 17,
  "activa": {
    "id_plantilla": 41,
    "id_consent": 9,
    "fecha_registro": "2026-09-14T09:12:41-06:00",
    "indexada": true,
    "id_indice": 3,
    "version_indice": "v003",
    "faiss_id": 1042,
    "en_uso": true,
    "consentimiento_vigente": true
  },
  "archivadas": { "total": 1, "items": [ { "id_plantilla": 33, "id_consent": 4, "fecha_registro": "2025-08-21T10:02:11-06:00" } ] },
  "indice_en_uso": { "id_indice": 3, "version": "v003" }
}
```

`activa` es `null` si no hay plantilla activa; `indice_en_uso` es `null` si no hay índice. Errores: `NO_AUTORIZADO`; `NO_ENCONTRADO` ("El alumno no existe.").

### 3.6 `api_documento_url_autorizar`

```sql
CREATE FUNCTION public.api_documento_url_autorizar(
    p_tipo        text,      -- 'consentimiento' | 'plantilla'
    p_id_registro integer,   -- id_consent o id_plantilla
    p_ip          inet DEFAULT NULL
) RETURNS jsonb
```

- Llama: `administrador` (desde `POST /api/alumnos/{id}/documento-url`). `SECURITY DEFINER`.
- Lee: `consentimiento` o `plantilla_facial`. Escribe: `bitacora_auditoria`.
- Reglas (RF-19, RNF-04, RNF-08): cada emisión de URL asienta `app.bitacora('consulta', <'consentimiento'|'plantilla_facial'>, p_id_registro, NULL, jsonb_build_object('id_alumno', ...), p_ip)`. Devuelve la ruta y la vigencia de la URL; el Route Handler crea la URL firmada.
- `vigencia_seg = LEAST(app.param_num('vigencia_url_firmada_seg'), 300)`.

Retorno:

```json
{
  "tipo": "plantilla",
  "id_registro": 41,
  "id_alumno": 17,
  "objeto": "registro/17/3f1c2a9e-5b7d-4c0e-9a41-0d2f6b8e7a11.jpg",
  "vigencia_seg": 300
}
```

Errores: `NO_AUTORIZADO`; `VALIDACION` ("Tipo de documento no válido."); `NO_ENCONTRADO`.

### 3.7 `api_indice_estado`

```sql
CREATE FUNCTION public.api_indice_estado(
    p_limit  integer DEFAULT 10,
    p_offset integer DEFAULT 0
) RETURNS jsonb
```

- Llama: `tecnico`, `administrador`. `SECURITY DEFINER` (agrega sobre `plantilla_facial` que el técnico no puede leer; no devuelve datos del alumno).
- Lee: `indice_faiss`, `plantilla_facial`, `parametro_sistema`.
- Definiciones: `activas` = plantillas con `activa`; `indexadas` = activas con `id_indice IS NOT NULL`; `pendientes` = activas con `id_indice IS NULL`; `obsoletas_en_indice` = plantillas con `activa = false` y `id_indice` = índice en uso (el vector sigue en el archivo pero ya no debe estar); `requiere_reconstruccion` = `pendientes > 0 OR obsoletas_en_indice > 0 OR en_uso IS NULL`; `dimension_coincide` = `en_uso.dimension = dimension_vector`. `pendientes_detalle`: máx. 20 filas (`id_plantilla`, `id_alumno`, `fecha_registro`), sin matrícula ni nombre. `versiones`: más recientes primero.

Retorno:

```json
{
  "en_uso": { "id_indice": 3, "version": "v003", "dimension": 512, "total_vectores": 498, "fecha_construccion": "2026-09-14T09:14:03-06:00" },
  "dimension_configurada": 512,
  "dimension_coincide": true,
  "plantillas": { "activas": 500, "indexadas": 498, "pendientes": 2, "obsoletas_en_indice": 0 },
  "requiere_reconstruccion": true,
  "pendientes_detalle": [ { "id_plantilla": 41, "id_alumno": 17, "fecha_registro": "2026-09-14T09:12:41-06:00" } ],
  "versiones": {
    "total": 3,
    "items": [
      { "id_indice": 3, "version": "v003", "dimension": 512, "total_vectores": 498, "fecha_construccion": "2026-09-14T09:14:03-06:00", "en_uso": true },
      { "id_indice": 2, "version": "v002", "dimension": 512, "total_vectores": 497, "fecha_construccion": "2026-09-13T08:00:12-06:00", "en_uso": false }
    ]
  }
}
```

`en_uso` es `null` si no hay índice. Errores: `NO_AUTORIZADO`.

### 3.8 `api_parametros_listar`

```sql
CREATE FUNCTION public.api_parametros_listar(
    p_limit  integer DEFAULT 50,
    p_offset integer DEFAULT 0
) RETURNS jsonb
```

- Llama: `tecnico`, `administrador` (consulta). `SECURITY DEFINER` (une `usuario` para `actualizado_por`). Lee: `parametro_sistema`, `usuario`.
- Metadatos (`tipo`, `minimo`, `maximo`, `unidad`) de `app.parametro_meta`. Orden: el de la Tabla 4 (orden fijo definido en `app.parametro_meta`).

Retorno:

```json
{
  "total": 12,
  "items": [
    {
      "clave": "umbral_similitud",
      "valor": "0.850",
      "tipo": "decimal",
      "minimo": "0.500",
      "maximo": "0.999",
      "unidad": "score",
      "descripcion": "Score mínimo para atribuir una detección (RN-04, RF-05)",
      "actualizado_por": null,
      "fecha_actualizacion": "2026-08-01T00:00:00-06:00"
    },
    {
      "clave": "intervalo_muestreo_seg",
      "valor": "15",
      "tipo": "entero",
      "minimo": "5",
      "maximo": "120",
      "unidad": "segundos",
      "descripcion": "Segundos entre capturas de cada cámara (RF-03)",
      "actualizado_por": { "id_usuario": 3, "correo": "tecnico@example.test" },
      "fecha_actualizacion": "2026-09-10T16:20:00-06:00"
    }
  ]
}
```

Errores: `NO_AUTORIZADO`.

### 3.9 `api_parametro_actualizar`

```sql
CREATE FUNCTION public.api_parametro_actualizar(
    p_clave text,
    p_valor text,
    p_ip    inet DEFAULT NULL
) RETURNS jsonb
```

- Llama: solo `tecnico` (Tabla 36: el administrador solo consulta). `SECURITY DEFINER`. Lee/escribe: `parametro_sistema` (`FOR UPDATE`), `bitacora_auditoria`.
- Reglas (RNF-02, RNF-08):
  1. Clave existe (`PARAMETRO_NO_ENCONTRADO`).
  2. `app.validar_parametro(p_clave, p_valor)` (§5) devuelve el valor canónico o lanza `PARAMETRO_VALOR_INVALIDO`. Tabla de rangos en §5.4.
  3. Si el canónico es igual al vigente: no escribe, no asienta bitácora, devuelve `cambio = false`.
  4. Si cambia: `UPDATE parametro_sistema SET valor = <canónico>, actualizado_por = app.id_usuario(), fecha_actualizacion = app.now()` y `app.bitacora('cambio_parametro', 'parametro_sistema', 0, jsonb_build_object('clave', p_clave, 'valor', <anterior>), jsonb_build_object('clave', p_clave, 'valor', <nuevo>), p_ip)`. `id_registro = 0` por la spec (Tabla 31).
  5. `advertencias` (arreglo de textos): `dimension_vector` -> "Cambiar la dimensión exige cambiar el modelo y reconstruir el índice completo."; `tolerancia_min`, `limite_presente_min`, `intervalo_muestreo_seg` -> "Solo afecta a las sesiones que se programen después de este cambio."; `umbral_similitud`, `min_detecciones_validas` -> "Aplica a las capturas siguientes; las detecciones ya registradas conservan su validez."

Retorno:

```json
{
  "clave": "umbral_similitud",
  "valor_anterior": "0.850",
  "valor": "0.900",
  "cambio": true,
  "tipo": "decimal",
  "advertencias": ["Aplica a las capturas siguientes; las detecciones ya registradas conservan su validez."],
  "fecha_actualizacion": "2026-09-14T09:40:12-06:00",
  "actualizado_por": { "id_usuario": 3, "correo": "tecnico@example.test" }
}
```

Errores: `NO_AUTORIZADO`; `PARAMETRO_NO_ENCONTRADO` ("El parámetro no existe."); `PARAMETRO_VALOR_INVALIDO` (ej.: "umbral_similitud debe ser un decimal entre 0.500 y 0.999 con hasta 3 decimales.", "limite_presente_min debe ser menor que tolerancia_min (20).").

### 3.10 `api_camaras_estado`

```sql
CREATE FUNCTION public.api_camaras_estado(
    p_estatus estatus_camara DEFAULT NULL,
    p_limit   integer DEFAULT 50,
    p_offset  integer DEFAULT 0
) RETURNS jsonb
```

- Llama: `tecnico`, `administrador`. `SECURITY DEFINER` (agrega `captura` y `sesion_clase`). Lee: `camara`, `aula`, `captura`, `grupo`, `sesion_clase`.
- `ultima_captura` = `max(captura.marca_tiempo)` de la cámara; `capturas_24h` = capturas con `marca_tiempo >= app.now() - interval '24 hours'`; `sesion_abierta` = existe sesión `abierta` de un grupo cuya aula es la de la cámara. Orden: `aula.clave, posicion`.

Retorno:

```json
{
  "total": 2,
  "items": [
    {
      "id_camara": 4,
      "id_aula": 2,
      "aula_clave": "A-12",
      "edificio": "A",
      "posicion": "frente",
      "tipo": "ip",
      "direccion_ip": "10.20.4.21",
      "estatus": "activa",
      "ultima_captura": "2026-09-14T07:12:30-06:00",
      "capturas_24h": 160,
      "sesion_abierta": true
    },
    {
      "id_camara": 5,
      "id_aula": 2,
      "aula_clave": "A-12",
      "edificio": "A",
      "posicion": "fondo",
      "tipo": "ip",
      "direccion_ip": "10.20.4.22",
      "estatus": "mantenimiento",
      "ultima_captura": null,
      "capturas_24h": 0,
      "sesion_abierta": true
    }
  ]
}
```

`direccion_ip` es `null` para `tipo = 'navegador'`. Errores: `NO_AUTORIZADO`.

### 3.11 `api_camara_cambiar_estatus`

```sql
CREATE FUNCTION public.api_camara_cambiar_estatus(
    p_id_camara integer,
    p_estatus   estatus_camara
) RETURNS jsonb
```

- Llama: `tecnico`, `administrador` (Tabla 36: el técnico opera solo cámaras; el administrador además gestiona aulas/horarios en su dominio). `SECURITY DEFINER`. Escribe SOLO `camara.estatus` (no admite cambiar IP, posición ni aula).
- Reglas (RF-22, RN-06): `p_estatus` válido del enum (`VALIDACION` si no); cámara existe (`NO_ENCONTRADO`, "La cámara no existe."); si el estatus no cambia, `cambio = false`. No altera sesiones ya abiertas (el modo se decide al abrir); si hay sesión abierta en el aula, devuelve `advertencias`.
- Bitácora: ninguna (no hay valor en el enum; §7 D9).

Retorno:

```json
{
  "id_camara": 5,
  "id_aula": 2,
  "posicion": "fondo",
  "estatus_anterior": "activa",
  "estatus": "mantenimiento",
  "cambio": true,
  "advertencias": ["Hay una sesión abierta en el aula; su modo de registro no cambia."]
}
```

Errores: `NO_AUTORIZADO`; `NO_ENCONTRADO`; `VALIDACION` ("Estatus de cámara no válido.").

### 3.12 `svc_indice_plan`

```sql
CREATE FUNCTION public.svc_indice_plan(p_completa boolean DEFAULT false) RETURNS jsonb
```

- Llama: Route Handler (`lib/server/indice.js`) con `service_role`. `SECURITY DEFINER`. Solo lectura: `indice_faiss`, `plantilla_facial`, `parametro_sistema`. No toma bloqueos.
- Contrato:
  - `dimension` = `app.param_num('dimension_vector')`.
  - `base` = índice `en_uso` si existe, su `dimension` coincide con `dimension` y `p_completa = false`; si no `null` (con `motivo_sin_base`: `"sin_indice"`, `"dimension_cambiada"` o `"completa"`).
  - `entries` = TODAS las plantillas `activa`, orden `id_plantilla`. Para cada una: `en_base = (base IS NOT NULL AND id_indice = base.id_indice)`. Si `en_base`, conserva su `faiss_id`. Si no, recibe `faiss_id` NUEVO = `max(faiss_id de toda plantilla_facial, activa o no) + posición` (empezando en `max+1`; 0 si no hay): los `faiss_id` son monótonos y estables entre versiones y nunca se reutilizan.
  - `version_sugerida` = `'v' || lpad((1 + coalesce(max(substring(version from '^v(\d+)$')::int), 0))::text, 3, '0')` (la versión cabe en `VARCHAR(12)`).
  - `totales`: `activas`, `nuevas` (`not en_base`), `en_base`, `obsoletas` (`activa = false` con `id_indice = base.id_indice`; 0 si no hay base).
  - `nada_que_hacer` = `nuevas = 0 AND obsoletas = 0 AND base IS NOT NULL`.

Retorno:

```json
{
  "dimension": 512,
  "version_sugerida": "v004",
  "base": { "id_indice": 3, "version": "v003", "objeto_indice": "indice/v003.json", "total_vectores": 498 },
  "motivo_sin_base": null,
  "totales": { "activas": 500, "nuevas": 2, "en_base": 498, "obsoletas": 0 },
  "nada_que_hacer": false,
  "entries": [
    { "id_plantilla": 12, "id_alumno": 3, "faiss_id": 1001, "id_indice": 3, "en_base": true, "objeto_foto": "registro/3/5d2e...jpg" },
    { "id_plantilla": 41, "id_alumno": 17, "faiss_id": 1043, "id_indice": null, "en_base": false, "objeto_foto": "registro/17/3f1c...jpg" }
  ]
}
```

Errores: ninguno propio (`SERVICIO_NO_CONFIGURADO` no aplica).

### 3.13 `svc_indice_registrar`

```sql
CREATE FUNCTION public.svc_indice_registrar(
    p_version         text,
    p_dimension       integer,
    p_objeto_indice   text,
    p_total_vectores  integer
) RETURNS jsonb
```

- Llama: Route Handler con `service_role`. `SECURITY DEFINER`. Escribe `indice_faiss` (`en_uso = false`).
- Reglas: `p_version` cumple `^[A-Za-z0-9._-]{1,12}$`; `p_objeto_indice = 'indice/' || p_version || '.json'` (`RUTA_INVALIDA`); `p_dimension = app.param_num('dimension_vector')` (`INDICE_DIMENSION_INVALIDA`); `p_total_vectores >= 0` (`VALIDACION`). Idempotente: si ya existe la misma `version` con el mismo `objeto_indice`, `dimension` y `total_vectores` y `en_uso = false`, devuelve esa fila con `ya_registrada = true`; si existe con otros datos, `INDICE_VERSION_DUPLICADA`.
- `fecha_construccion = app.now()`.

Retorno:

```json
{
  "id_indice": 4,
  "version": "v004",
  "dimension": 512,
  "objeto_indice": "indice/v004.json",
  "total_vectores": 500,
  "en_uso": false,
  "fecha_construccion": "2026-09-14T09:20:44-06:00",
  "ya_registrada": false
}
```

### 3.14 `svc_indice_activar`

```sql
CREATE FUNCTION public.svc_indice_activar(
    p_id_indice integer,
    p_mapeo     jsonb      -- [ { "id_plantilla": 12, "faiss_id": 1001 }, ... ]
) RETURNS jsonb
```

- Llama: Route Handler con `service_role`, DESPUÉS de que el servicio precargó la versión. `SECURITY DEFINER`. Escribe `indice_faiss`, `plantilla_facial`.
- UNA transacción (RF-16, RN-12, RNF-09):
  1. `PERFORM pg_advisory_xact_lock(hashtext('susan.indice.cambio'))` (serializa activaciones y reversiones).
  2. Bloquea la fila del índice (`FOR UPDATE`): `NO_ENCONTRADO` si no existe. Si ya está `en_uso`, devuelve el resumen con `ya_activo = true` sin cambios (permite reintentar tras un fallo de red).
  3. Valida `p_mapeo`: arreglo JSON de objetos con `id_plantilla` entero y `faiss_id` entero >= 0; sin `id_plantilla` ni `faiss_id` repetidos; `jsonb_array_length(p_mapeo) = indice.total_vectores` (`INDICE_MAPEO_INVALIDO`, `INDICE_MAPEO_INCOMPLETO`).
  4. Bloquea (`FOR UPDATE`) las plantillas activas y valida: toda `id_plantilla` del mapeo existe y está `activa` (si no, `INDICE_PLAN_OBSOLETO`); toda plantilla activa que NO esté en el mapeo debe tener `id_indice IS NULL` (nació después del plan y queda pendiente; si tuviera índice, `INDICE_PLAN_OBSOLETO`).
  5. PASO 1: `UPDATE indice_faiss SET en_uso = false WHERE en_uso`.
  6. Asigna: `UPDATE plantilla_facial SET id_indice = p_id_indice, faiss_id = m.faiss_id FROM mapeo m WHERE id_plantilla = m.id_plantilla`.
  7. PASO 2: `UPDATE indice_faiss SET en_uso = true WHERE id_indice = p_id_indice`.
  Si cualquier paso falla, la transacción completa se revierte: la versión anterior sigue `en_uso` y las plantillas intactas. Fuera de la transacción nunca se observan cero ni dos versiones en uso (RNF-09).
- No asienta bitácora (§7 D9).

Retorno:

```json
{
  "id_indice": 4,
  "version": "v004",
  "anterior": { "id_indice": 3, "version": "v003" },
  "plantillas_asignadas": 500,
  "plantillas_pendientes": 1,
  "total_vectores": 500,
  "ya_activo": false,
  "activado_en": "2026-09-14T09:21:02-06:00"
}
```

Errores: `NO_ENCONTRADO` ("La versión del índice no existe."); `INDICE_MAPEO_INVALIDO`; `INDICE_MAPEO_INCOMPLETO`; `INDICE_PLAN_OBSOLETO`; `RN_12_INDICE_EN_USO_DUPLICADO` (solo si se alterara el orden).

### 3.15 `svc_indice_revertir`

```sql
CREATE FUNCTION public.svc_indice_revertir(
    p_id_indice integer,
    p_mapeo     jsonb      -- mapeo de la versión destino: [ { "id_plantilla", "faiss_id" }, ... ]
) RETURNS jsonb
```

- Llama: Route Handler (`POST /api/indice/revertir`, técnico) con `service_role`. `SECURITY DEFINER`.
- Uso: poner en uso una versión anterior (la versión previa permanece en el bucket, spec §3.5.1). El mapeo se obtiene del manifiesto del servicio (`GET /v1/index/{version}/manifest`, campo `refs`, §4B.8).
- UNA transacción, mismo bloqueo asesor que `svc_indice_activar`: valida que el destino existe y su `dimension = dimension_vector` (`INDICE_NO_REVERTIBLE`); PASO 1 `en_uso = false` en la actual; para toda plantilla ACTIVA: si está en el mapeo recibe `(p_id_indice, faiss_id)`, si no se pone `id_indice = NULL, faiss_id = NULL` (queda pendiente, la siguiente reconstrucción la incorporará); las plantillas archivadas del mapeo se ignoran (no es error); PASO 2 `en_uso = true` en el destino. Si el destino ya está en uso, `ya_activo = true`.

Retorno:

```json
{
  "id_indice": 3,
  "version": "v003",
  "anterior": { "id_indice": 4, "version": "v004" },
  "plantillas_asignadas": 498,
  "plantillas_pendientes": 2,
  "ya_activo": false
}
```

Errores: `NO_ENCONTRADO`; `INDICE_MAPEO_INVALIDO`; `INDICE_NO_REVERTIBLE`.

### 3.16 `svc_indice_en_uso`

```sql
CREATE FUNCTION public.svc_indice_en_uso() RETURNS jsonb
```

- Llama: Route Handler y (opcionalmente) el servicio para arrancar (§4B.9). `SECURITY DEFINER`, lectura. Devuelve `null` si no hay índice en uso; si no:

```json
{ "id_indice": 4, "version": "v004", "objeto_indice": "indice/v004.json", "dimension": 512, "total_vectores": 500 }
```

### 3.17 `svc_bloqueo_adquirir` / `svc_bloqueo_liberar`

```sql
CREATE FUNCTION public.svc_bloqueo_adquirir(p_clave text, p_dueno text, p_ttl_seg integer DEFAULT 900) RETURNS boolean
CREATE FUNCTION public.svc_bloqueo_liberar(p_clave text, p_dueno text) RETURNS boolean
```

- Llama: Route Handlers (reconstrucción de índice y jobs) con `service_role`. `SECURITY DEFINER`. Envoltorios de `app.bloqueo_adquirir`/`app.bloqueo_liberar` (§5.6). Un bloqueo es un arrendamiento con vencimiento (`p_ttl_seg` entre 10 y 7200, `VALIDACION` fuera de rango): si el proceso muere, el bloqueo caduca solo.
- `adquirir` devuelve `true` si lo obtuvo (no existía, venció, o ya era del mismo `p_dueno`, lo que lo renueva) y `false` si lo tiene otro dueño vigente. `liberar` devuelve `true` solo si el dueño coincide.
- Claves en uso: `indice`, `job:purgar-recortes`, `job:recalcular`, `job:reconstruir-indice` (esta última se reutiliza como `indice` en la práctica, ver §4D.2).

### 3.18 `svc_job_cerrar_sesiones`

```sql
CREATE FUNCTION public.svc_job_cerrar_sesiones(p_limit integer DEFAULT 200) RETURNS jsonb
```

- Llama: `POST /api/jobs/cerrar-sesiones`. `SECURITY DEFINER`. Lee/escribe vía `app.cerrar_sesion`.
- Reglas (RF-10, RN-07): primero `PERFORM app.asumir_cuenta_servicio()`. Selecciona `sesion_clase` con `estatus = 'abierta'` y `((fecha + hora_fin) AT TIME ZONE app.tz()) <= app.now()`, orden `fecha, hora_fin, id_sesion`, `LIMIT p_limit`, `FOR UPDATE SKIP LOCKED`. Para cada una invoca `app.cerrar_sesion(id_sesion, false)` dentro de un sub-bloque `BEGIN ... EXCEPTION WHEN OTHERS`: un fallo se registra en `errores` y no impide cerrar las demás. Idempotente: una sesión cerrada ya no califica.
- Las sesiones `programada` que nunca se abrieron NO se tocan (§7 R5).

Retorno:

```json
{
  "ejecutado_en": "2026-09-14T09:05:00-06:00",
  "candidatas": 3,
  "cerradas": 2,
  "items": [
    { "id_sesion": 88, "resultado": { "ausentes_creados": 4, "pendientes": 2 } },
    { "id_sesion": 91, "resultado": { "ausentes_creados": 0, "pendientes": 0 } }
  ],
  "errores": [ { "id_sesion": 95, "codigo": "VALIDACION", "mensaje": "..." } ]
}
```

`resultado` es el `jsonb` que devuelva `app.cerrar_sesion` (opaco para este dominio).

### 3.19 `svc_job_resolver_pendientes`

```sql
CREATE FUNCTION public.svc_job_resolver_pendientes(p_limit integer DEFAULT 500) RETURNS jsonb
```

- Llama: `POST /api/jobs/resolver-pendientes`. `SECURITY DEFINER`. Escribe `asistencia`, `bitacora_auditoria`; invoca `app.recalcular_inscripcion`.
- Reglas (RF-11, RN-08): `PERFORM app.asumir_cuenta_servicio()` y obtiene `v_servicio := app.id_cuenta_servicio()`. Candidatas: `asistencia.estado = 'pendiente'` de sesiones `cerrada` con `((fecha + hora_fin) AT TIME ZONE app.tz()) + make_interval(hours => app.param_num('horas_limite_correccion')::int) < app.now()` (ESTRICTAMENTE menor: a las 48:00:00 exactas el docente aún puede corregir, a partir de 48:00:01 el job resuelve; así no hay ventana en que ambos actúen), `FOR UPDATE OF a SKIP LOCKED`, `LIMIT p_limit`. Para cada una, en sub-bloque con captura de error:
  1. `UPDATE asistencia SET estado = 'ausente', origen = 'correccion', hora_registro = NULL WHERE id_asistencia = ...` (`ck_asistencia_ausente_sin_hora` exige `hora_registro` nulo; `conteo_detecciones` se conserva; las `deteccion` no se tocan).
  2. `app.bitacora('correccion', 'asistencia', id_asistencia, valor_anterior, valor_nuevo, NULL, v_servicio)` con `valor_anterior = { "estado": "pendiente", "origen": "automatico", "hora_registro": "<instante>", "conteo_detecciones": 2 }` y `valor_nuevo = { "estado": "ausente", "origen": "correccion", "hora_registro": null, "conteo_detecciones": 2, "motivo": "plazo_vencido" }` (`ck_bitacora_valores` exige ambos).
  Tras el bucle, para cada inscripción distinta afectada (sesión -> grupo, alumno): `app.recalcular_inscripcion(id_inscripcion)` (RN-10/RN-11; puede asentar `notificacion`).
- Idempotente: una segunda corrida no encuentra pendientes vencidos.
- Requiere que `trg_asistencia_ciclo` (db-schema) admita `pendiente -> ausente` con `origen = 'correccion'`.

Retorno:

```json
{
  "ejecutado_en": "2026-09-16T09:15:00-06:00",
  "candidatas": 5,
  "resueltas": 5,
  "inscripciones_recalculadas": 4,
  "errores": []
}
```

### 3.20 `svc_job_purgar_recortes_listar` y `svc_job_purgar_recortes_marcar`

```sql
CREATE FUNCTION public.svc_job_purgar_recortes_listar(p_limit integer DEFAULT 500) RETURNS jsonb
CREATE FUNCTION public.svc_job_purgar_recortes_marcar(p_ids bigint[]) RETURNS jsonb
```

- Llama: `POST /api/jobs/purgar-recortes` (paso 1 y paso 3; el paso 2 es Storage). `SECURITY DEFINER`.
- `listar` (RNF-05, paso 1, SELECT de rutas): `deteccion` con `objeto_recorte IS NOT NULL` unida a `captura` con `marca_tiempo < app.now() - make_interval(days => app.param_num('dias_retencion_recortes')::int)` (ESTRICTAMENTE más vieja; 7 días exactos aún se conserva), orden `id_deteccion`, `LIMIT p_limit` (máx. 2000). `pendientes_total` cuenta todas las vencidas.
- `marcar` (paso 3): `UPDATE deteccion SET objeto_recorte = NULL WHERE id_deteccion = ANY(p_ids) AND objeto_recorte IS NOT NULL AND <sigue vencida>` (se vuelve a comprobar la antigüedad por seguridad). NO borra filas: `id_plantilla`, `score_similitud`, `es_valida` quedan intactos. Idempotente. Rechaza arreglos de más de 5000 ids (`VALIDACION`).
- Orden obligatorio y razón: (1) listar, (2) borrar objetos, (3) marcar NULL. Si el proceso muere entre 2 y 3, las rutas siguen en la BD y la siguiente corrida las vuelve a listar; borrar un objeto ausente no es error. Con el orden inverso quedarían objetos huérfanos para siempre.

Retorno de `listar`:

```json
{
  "corte": "2026-09-07T03:00:00-06:00",
  "dias_retencion": 7,
  "pendientes_total": 1240,
  "items": [ { "id_deteccion": 90211, "objeto_recorte": "recortes/88/1204/3.jpg" } ]
}
```

Retorno de `marcar`: `{ "solicitadas": 500, "marcadas": 498 }`.

### 3.21 `svc_job_reconstruir_indice`

```sql
CREATE FUNCTION public.svc_job_reconstruir_indice() RETURNS jsonb
```

- Llama: `POST /api/jobs/reconstruir-indice` (solo diagnóstico; la reconstrucción la orquesta `lib/server/indice.js`). `SECURITY DEFINER`, lectura.
- Devuelve si hace falta reconstruir y por qué: `motivo` = `sin_indice` (no hay versión en uso: se creará una versión inicial, posiblemente vacía), `pendientes` (hay activas sin indexar), `obsoletas` (hay plantillas archivadas aún en el índice en uso) o `ninguno`. Si hay pendientes y la última versión se construyó hace menos de 30 s, devuelve `requiere = true` igualmente (el bloqueo evita solapes).

```json
{ "requiere": true, "motivo": "pendientes", "pendientes": 2, "obsoletas": 0, "en_uso": { "id_indice": 3, "version": "v003" } }
```

### 3.22 `svc_job_recalcular`

```sql
CREATE FUNCTION public.svc_job_recalcular(p_periodo text DEFAULT NULL) RETURNS jsonb
```

- Llama: `POST /api/jobs/recalcular`. `SECURITY DEFINER`. Invoca `app.recalcular_grupo`.
- Reglas (RF-13, RF-14, RN-10, RN-11): `PERFORM app.asumir_cuenta_servicio()`. (a) `v_vencidos := app.vencer_consentimientos()`. (b) Periodo: `p_periodo` si viene (formato `AAAA-S`, `VALIDACION` si no); si no, el mayor `grupo.periodo` que tenga al menos una `sesion_clase` con `fecha <= hoy` [supuesto, §7 S3]. (c) Para cada `grupo` de ese periodo: `app.recalcular_grupo(id_grupo)` en sub-bloque con captura de error (un grupo fallido no detiene los demás).

```json
{ "periodo": "2026-2", "grupos": 18, "recalculados": 18, "consentimientos_vencidos": 3, "errores": [] }
```

Errores de las `svc_job_*`: no lanzan por fallos de elementos individuales (van en `errores`); lanzan `SERVICIO_NO_CONFIGURADO` si falta la cuenta de servicio, y `VALIDACION` por argumentos inválidos.
