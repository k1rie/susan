# Dominio BIOMETRIA — consentimiento, plantilla facial, índice FAISS, servicio de reconocimiento, consola técnica y jobs

Estado: contrato v1 (BASE) más la extensión **plantilla de varias fotos** (migración `0235`, §4 de este documento). Fuente: `docs/spec/Avance1.txt` (Tablas 3-6, 13, 14-32, 34, 36; BPMN-03; Figura 10 flujos 1, 3 y 7) y `docs/ARCHITECTURE.md` §2-§5.
Este documento es ley para: db-api-b (SQL 02xx), recognition (servicio Python), route-handlers (`web/src/app/api`, `lib/server`, `lib/http`), data-layer (`lib/api/biometria.js`), screens-admin (montaje de paneles) y screens-tecnico (`/tecnico`).

Convenciones usadas (todas de `ARCHITECTURE.md` §2): solo-RPC; `api_*` a `authenticated`, `svc_*` a `service_role`; esquema `app` privado; todo tiempo de negocio con `app.now()`; errores `RAISE EXCEPTION '<mensaje>' USING ERRCODE = 'P0001', HINT = '<CODIGO>'`; JSON `snake_case`; listas `{ total, items }` con `p_limit` (def. 50, máx. 200) y `p_offset`; fechas ISO 8601 (`fecha` = `YYYY-MM-DD`, instantes con offset `-06:00`).

Nombres de archivo sugeridos para db-api-b: `supabase/migrations/0210_biometria_consentimiento_plantilla.sql`, `0211_biometria_indice.sql`, `0212_parametros_camaras.sql`, `0213_jobs.sql`; pruebas en `supabase/tests/api_b_biometria_*.sql`.

---

## 1. Alcance y trazabilidad

### 1.1 Alcance

Dentro:

- M2 Registro biométrico: consentimiento (RF-15, RN-13), plantilla única con archivado (RN-12) formada por 1 foto (heredada) o por 3 a 8 fotos cuyos embeddings se promedian en UN vector (§4), índice FAISS versionado con cambio atómico (RF-16, RNF-09).
- Servicio de reconocimiento (Python/FastAPI + `faiss-cpu`): endpoints de salud, estado de índice, verificación de foto y de conjuntos de fotos (`/v1/photo/check-set`), construcción/activación de índice y reconocimiento (parte de RF-03/RF-04/RF-05).
- Consola del técnico: cámaras (solo estatus), parámetros del sistema (RNF-02), estado y reconstrucción del índice.
- Programador de tareas: 5 jobs (`cerrar-sesiones`, `resolver-pendientes`, `purgar-recortes`, `reconstruir-indice`, `recalcular`) y la cuenta de servicio.
- Parte biométrica de P-06 (paneles `ConsentimientoPanel` y `PlantillaFacialPanel`), montada por la página del alumno (dominio admin).

Fuera (otros dominios): alta/edición del alumno (admin), `POST /api/sesiones/{id}/captura` y `svc_alumnos_candidatos`/`svc_registrar_detecciones` (sesiones), `app.cerrar_sesion` (sesiones), `app.recalcular_*` y `v_resumen_asistencia` (reportes), `app.now()`/`app.bitacora()`/RLS (plataforma), componentes `ui/*` (ui-kit).

### 1.2 Trazabilidad RF / RN / RNF -> artefacto

| Requisito | Artefactos que lo cubren |
|---|---|
| RF-15 plantilla solo con consentimiento firmado y vigente, fotos con un solo rostro vectorizable, fotos en bucket | `api_consentimiento_registrar`, `api_consentimientos_alumno`, `api_plantilla_registrar` (con `p_fotos`), tabla `plantilla_foto`, `app.consentimiento_vigente`, `trg_plantilla_rn13` (contrato en §5), `POST /api/consentimientos`, `POST /api/alumnos/{id}/plantilla`, `POST /api/plantilla/verificar`, `GET /api/documentos/plantilla_foto/{id}`, servicio `POST /v1/photo/check` y `POST /v1/photo/check-set`, componentes `ConsentimientoPanel`, `PlantillaFacialPanel`, `CapturaGuiadaPlantilla`, `SubidaFotosPlantilla`, `GaleriaTomas`, `CalidadFotoResumen` (P-06) |
| RF-16 archivar anterior, versión nueva del índice con todas las activas, `faiss_id`, cambio atómico sin interrumpir | `api_plantilla_registrar` (archivar y luego insertar), `svc_indice_plan` (con `objetos_foto`), `svc_indice_registrar`, `svc_indice_activar`, `svc_indice_revertir`, `svc_indice_en_uso`, `lib/server/indice.js::reconstruirIndice`, servicio `/v1/index/build` y `/v1/index/activate`, job `reconstruir-indice`, `IndiceFacialPanel` |
| RN-12 una plantilla activa por alumno, un índice en uso | `ux_plantilla_facial_activa`, `ux_indice_faiss_en_uso` (db-schema), orden archivar-insertar en `api_plantilla_registrar`, orden FALSE-TRUE en `svc_indice_activar`/`svc_indice_revertir`. Con varias fotos RN-12 se conserva: sigue habiendo UNA fila activa de `plantilla_facial` y UN `faiss_id` por alumno; las fotos viven en la tabla hija `plantilla_foto` y el promedio es un solo vector (§4) |
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
| RNF-03 0 vectores/imágenes en la BD | Solo `faiss_id` y rutas `objeto_*`; vector solo en memoria y en el JSON del bucket; prueba SQL-48. `plantilla_foto` guarda únicamente rutas, 4 medidas de calidad y un coseno escalar por foto (`coseno_resto`); el promedio y el descarte de fotos ajenas ocurren en el servicio y ningún vector toca la BD |
| RNF-04 URL firmada <= 300 s | `POST /api/alumnos/{id}/documento-url` usa `vigencia_url_firmada_seg` (tope 300 impuesto por `app.parametro_meta`) |
| RNF-05 purga de recortes a 7 días, `objeto_recorte` -> NULL, fila conservada | `svc_job_purgar_recortes_listar`, `svc_job_purgar_recortes_marcar`, `POST /api/jobs/purgar-recortes` |
| RNF-06 sin reconocimiento sin consentimiento | `allowed_faiss_ids` lo arma sesiones con consentimiento vigente (`app.consentimiento_vigente`); `api_consentimiento_revocar` archiva la plantilla |
| RNF-08 trazabilidad | Bitácora: `alta_plantilla`, `cambio_parametro`, `consulta`, `correccion` (job), `cierre_sesion` (job), `notificacion` (job vía recálculo) |
| RNF-09 reconstrucción <= 10 min sin interrumpir; 20 000 <= 2x tiempo de 5 000 | Reconstrucción incremental (conserva vectores), `svc_indice_activar` atómica, precarga + cambio de puntero atómico, estrategia `subset` de búsqueda |
| RNF-12 independencia del lenguaje | El servicio solo conoce `faiss_id`, `id_plantilla` y rutas; JSON de índice documentado |
| RNF-13 360 px | Paneles y consola en una columna, tablas como lista de tarjetas (§2) |
| RNF-14 índice reconstruible | `svc_indice_plan(p_completa => true)` + `/v1/index/build` con `base_version = null` |
| BPMN-03 | Alta/consentimiento: `ConsentimientoPanel` -> `POST /api/consentimientos`. Compuerta RN-13: `api_plantilla_registrar`. Fotos + calidad: `/v1/photo/check` (una foto) o `/v1/photo/check-set` (3 a 8 fotos). Archivar/insertar: `api_plantilla_registrar`. Construir y precargar: `/v1/index/build` + `/v1/index/activate (preload_only)`. Cambio de versión: `svc_indice_activar` |
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
| Verificar calidad de UNA foto (camino heredado) | `verificarFoto(blob)` | `POST /api/plantilla/verificar` (campo `foto`) |
| Verificar el conjunto de tomas (1 a 8 fotos) | `verificarFotos(blobs, { idAlumno, idConsent, signal })` | `POST /api/plantilla/verificar` (campo `fotos` repetido, §4.3) |
| Registrar plantilla | `registrarPlantilla({ idAlumno, idConsent, foto })` (una foto) o `registrarPlantilla({ idAlumno, idConsent, fotos }, { signal })` (varias) | `POST /api/alumnos/{id}/plantilla` (§4.3) |
| Abrir una foto de la plantilla (URL firmada) | `solicitarUrlDocumento({ tipo: 'plantilla_foto', idRegistro: id_foto })` | `GET /api/documentos/plantilla_foto/{id}` (§4.3) |

#### Componente `admin/ConsentimientoPanel`

Carpeta `web/src/components/admin/alumnos/ConsentimientoPanel/` (`ConsentimientoPanel.jsx`, `useConsentimientos.js`, `consentimiento.utils.js`, `ConsentimientoPanel.test.jsx`, `index.js`).

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
6. Tras revocar, si la respuesta de la ruta trae `indice.estado === 'pendiente'` (la reconstrucción del índice falló), muestra un aviso `warning` "Consentimiento revocado": "El índice facial conserva el vector hasta que se reconstruya; pide a un técnico que lo reconstruya." La revocación solo es efectiva cuando el índice se reconstruye y queda `activada`.

Estados: cargando (`Spinner`), vacío ("Este alumno aún no tiene consentimientos registrados. Registre el documento firmado para habilitar la plantilla facial."), error (`ErrorState` con "Reintentar"). Errores de acción en `Alert`: se muestra el `message` del `ApiError`.

#### Componente `admin/alumnos/PlantillaFacialPanel`

Carpeta `web/src/components/admin/alumnos/PlantillaFacialPanel/` (`PlantillaFacialPanel.jsx`, `usePlantillaFacial.js`, `plantillaFacial.utils.js`, test, `index.js`). Desde la extensión de varias fotos el panel arma la plantilla con **3 a 8 tomas** (5 guiadas) en lugar de una sola foto; los componentes hijos están más abajo.

| Prop | Tipo | Descripción |
|---|---|---|
| `idAlumno` | number (req.) | Alumno |
| `version` | number (def. 0) | Fuerza recarga |
| `onCambio` | `() => void` (opc.) | Tras registrar la plantilla |

Responsabilidad y contenido:

1. Bloque "Plantilla actual": si existe `activa`: fecha de registro, "Fotos: N" (`activa.n_fotos`), "Indexada: sí/no", "Versión del índice: v003" (o "pendiente de indexar"), botón "Ver foto" (URL firmada, `tipo: 'plantilla'`, `idRegistro: id_plantilla`; es la foto principal) y "N plantillas archivadas". Con `n_fotos > 1` un `ui/Detalles` "Ver las N fotos" con un botón "Abrir foto K" por foto (`solicitarUrlDocumento` con `tipo: 'plantilla_foto'` e `idRegistro: id_foto`; el enlace caduca en 5 minutos). Si `coseno_medio` no es `null`, un `ui/Detalles` "Consistencia entre fotos": "Al registrar, cada foto se parecía en promedio 0.74 a las demás (mínimo 0.51). Dato informativo medido por el servicio de reconocimiento." (sin bandas Alta/Media/Baja: el umbral no está calibrado con fotos independientes reales). Si es `null` y `n_fotos` es 1: "Plantilla de una sola foto: se recomienda registrar de 3 a 5 tomas." Sin plantilla: "Sin plantilla facial; el alumno pasa lista de forma manual (RNF-06)."
2. Si no hay consentimiento vigente: `Alert` "Registre un consentimiento vigente para habilitar la captura" y la captura queda deshabilitada (no se monta `CameraCapture`).
3. Con consentimiento vigente, dos modos (segmento "Usar cámara" / "Subir fotos", ambos botones con `aria-pressed`; cambiar de modo CONSERVA las tomas, con un tope de 8 en total):
   - **Cámara guiada** (por defecto): `CapturaGuiadaPlantilla`, 5 pasos.
   - **Subir fotos**: `SubidaFotosPlantilla`, de 3 a 8 archivos JPG.
   Un `ui/Detalles` breve "¿Por qué varias fotos?" explica: "SUSAN promedia las fotos para reconocer mejor con distintos ángulos y luz."
4. **Modelo de tomas.** Cada toma es `{ id, origen: 'camara'|'archivo', paso: 0..4|null, blob, nombre, estado, motivoCodigo, motivo, cosenoResto, calidad, duplicadaDeId }`, con `estado` en `verificando | aceptada | calidad | inconsistente | ilegible | duplicada`. El orden de envío es por `paso` (las de archivo, con `paso: null`, al final) y luego por `id`; la primera es la foto principal. El servidor NO guarda sesiones de captura: cada cambio del conjunto (o de su orden) dispara, con *debounce* de 300 ms y `AbortController`, `verificarFotos(blobs, { idAlumno, idConsent })` con TODAS las fotos sostenidas (1 a 8). El resultado se aplica con el instantáneo de ids de ESA petición (`resultado.fotos[k]` a `ids[k]`, nunca por la posición actual del arreglo) y solo si la petición no se abortó; `duplicada_de` (índice) se convierte a `duplicadaDeId`. *Stale-while-revalidate*: cada toma conserva su estado previo y solo las nuevas muestran "Verificando". Si la petición falla (503 incluido) aparece `verificacion.error` con "Reintentar verificación" y las tomas sin resultado siguen en `verificando`. `minimo` y `maximo` salen del resultado (por defecto 3 y 8) y solo sirven para mostrar.
5. **Registrar** (`puedeRegistrar`): consentimiento vigente, `tomas.length >= minimo`, todas `aceptada`, `resultado.suficiente`, `!resultado.ambiguo`, sin envío ni verificación en curso y sin sondeo del índice en curso. Botón "Registrar plantilla con N fotos" o, si ya hay plantilla activa, "Reemplazar plantilla (la anterior se archivará)". Llama `registrarPlantilla({ idAlumno, idConsent, fotos })` con los blobs en orden de envío. Acción secundaria (variante `ghost`) "Registrar solo con esta foto (menos precisa)": solo con exactamente 1 toma aceptada (`puedeRegistrarUna`); usa el camino heredado de una foto (campo `foto`), para las personas que no superan el filtro de consistencia.
6. **Contador y mensajes.** Texto plano y una región `role="status"` `aria-live="polite"` `sr-only` que anuncia el último cambio ("Toma 3 aceptada." / "Toma 3 no aceptada: falta iluminación."). Sin tomas: "Captura al menos 3 tomas."; con tomas: "Tomas aceptadas: A de T (mínimo 3)." más " Repite o quita las tomas marcadas." si alguna no está aceptada, o " Faltan N toma(s) aceptada(s) para registrar." si solo falta cantidad. Si `ambiguo`: "Las tomas no coinciden entre sí. Revisa que todas sean del mismo alumno." La advertencia `DIVERSIDAD_BAJA` es un `Alert` info "Las tomas son casi idénticas; varía el ángulo, la expresión o la luz." (no bloquea). Tras repetir o quitar una toma el foco pasa al botón de captura (cámara) o al de "Agregar fotos" (archivo).
7. **Envío.** Mientras `envio.cargando`: `<p role="status">` "Subiendo N fotos y actualizando el índice. Puede tardar un minuto; no cierres esta ventana.", controles de captura y de repetir/quitar deshabilitados y un listener `beforeunload`. Éxito (201): `limpiar()`, `Alert` success "Plantilla registrada con N fotos. Índice listo, versión vXXX." (con una foto, "Plantilla registrada con 1 foto."), y sondeo de `plantillaAlumno` cada 5 s (`SONDEO_INTERVALO_MS`), máximo 24 intentos, hasta `activa.indexada === true`; el sondeo se cancela al desmontar. Si `indice.estado` es `'pendiente'`: `Alert` warning "Plantilla guardada, índice pendiente: la plantilla quedó guardada pero el índice no se pudo actualizar; pide a un técnico que lo reconstruya." Si `muestra.descartadas.length > 0`: `Alert` warning "El índice descartó N foto(s) al promediar; revisa la consistencia." Luego llama `onCambio`.
8. **Errores** (`mensajeErrorPlantilla`): `FOTO_RECHAZADA` (camino de una foto; usa `details.motivo_codigo` antes que la frase), `FOTOS_RECHAZADAS` ("Algunas fotos no sirven: repite las tomas marcadas.", y marca las tomas con el instantáneo de ids del envío), `FOTOS_INSUFICIENTES` ("Se necesitan al menos N fotos.", N = `details.minimo`), `FOTOS_DUPLICADAS` ("Hay fotos repetidas: usa tomas distintas."), `DEMASIADOS_ARCHIVOS` ("Máximo 8 fotos."), `ARCHIVO_DEMASIADO_GRANDE` ("Una foto pesa demasiado."), `RN_13_CONSENTIMIENTO_NO_VIGENTE`, `SERVICIO_RECONOCIMIENTO_NO_DISPONIBLE` ("El servicio de reconocimiento no responde; reintente", con botón "Reintentar"; el código antiguo `RECONOCIMIENTO_NO_DISPONIBLE` nunca coincidía con el de la ruta) y cualquier otro con su `message`.

`plantillaFacial.utils.js` exporta `textoMotivo(codigo, { guiada })`, que busca por `motivo_codigo` y, si no hay código, muestra la frase del servicio tal cual (ya no existe el formato "Calidad insuficiente (frase)"), además de `esFotoAceptable(resultado)` (compatibilidad del camino de una foto) y `MOTIVOS_RECHAZO`. `motivo_rechazo` es una frase de lectura humana del servicio; el código estable es `motivo_codigo`:

| `motivo_codigo` | Texto |
|---|---|
| `SIN_ROSTRO` | No se detectó ningún rostro. |
| `MULTIPLES_ROSTROS` | Hay más de un rostro en la imagen. |
| `ROSTRO_PEQUENO` | El rostro es muy pequeño; acérquese a la cámara. |
| `NO_FRONTAL` | Mire de frente a la cámara. (En la captura guiada: "Giraste demasiado; vuelve a mirar hacia la cámara.") |
| `POCA_LUZ` | Falta iluminación. |
| `EXCESO_LUZ` | Exceso de luz o contraluz. |
| `BORROSA` | La imagen está borrosa; mantenga quieta la cámara. |
| `IMAGEN_INVALIDA` | No se pudo leer la imagen. |
| `NO_COINCIDE` / `CONJUNTO_AMBIGUO` | Texto por estado de la toma: "No parece la misma persona" / "Las tomas no coinciden entre sí". |
| `DUPLICADA` | Igual a la toma K. |

#### Componente `admin/alumnos/CapturaGuiadaPlantilla`

Carpeta `web/src/components/admin/alumnos/CapturaGuiadaPlantilla/` (`CapturaGuiadaPlantilla.jsx`, `capturaGuiada.utils.js` con `PASOS_TOMA` y `ordenarTomas`, test, `index.js`). Props: `{ tomas, minimo, maximo, deshabilitado, onCapturar(blob, paso), onRepetir(id), onQuitar(id) }`.

Cámara `<CameraCapture ovalGuide showShutter={false} ref={camRef} />` montada durante las 5 tomas. Botón propio (`ui/Button`) "Capturar toma K de 5" (K = primer paso libre; las tomas 4 y 5 llevan " (opcional)"): hace `await camRef.current.capture()` dentro de `try/catch` (si el fotograma no está listo, "La cámara aún no está lista; espera un momento e inténtalo de nuevo.") y llama `onCapturar(blob, paso)`. Se deshabilita sin paso libre ("Las 5 tomas están capturadas"), con 8 tomas o con `deshabilitado`. El título y la indicación del siguiente paso se muestran sobre la cámara en un `<p aria-live="polite">`. Las indicaciones van en tú porque se leen a la persona fotografiada y asumen la vista en espejo de `CameraCapture` (`facingMode: user`):

| Paso | Clave | Título | Indicación | Ícono (Lucide) |
|---|---|---|---|---|
| 1 | `frente` | De frente | Mira de frente a la cámara, con el rostro dentro del óvalo. | `ScanFace` |
| 2 | `izquierda` | Gira a la izquierda | Gira la cabeza un poco hacia tu izquierda (unos 15 grados) sin dejar de ver la cámara. | `ArrowLeft` |
| 3 | `derecha` | Gira a la derecha | Ahora gira un poco hacia tu derecha (unos 15 grados). | `ArrowRight` |
| 4 | `arriba` | Inclina hacia arriba | Levanta ligeramente la barbilla, sin cerrar los ojos. | `ArrowUp` |
| 5 | `variacion` | Otra expresión o luz | Sonríe o cambia un poco la luz o el lugar. Mantén el rostro completo visible. | `SunMedium` |

"Repetir" libera el paso de esa toma (queda como siguiente) y conserva las demás; el conjunto se vuelve a verificar. El orden de envío es por paso, así que repetir no desalinea nada.

#### Componente `admin/alumnos/SubidaFotosPlantilla`

Carpeta `web/src/components/admin/alumnos/SubidaFotosPlantilla/` (`SubidaFotosPlantilla.jsx`, `subidaFotos.utils.js` con `normalizarFoto`, test, `index.js`). Botón "Agregar fotos (JPG)" con un `<input type="file" accept="image/jpeg" multiple hidden>` propio (`ui/FileInput` no acepta `multiple`) y el texto "Elige de 3 a 8 fotos distintas del mismo alumno." (con `minimo`/`maximo` reales). Cada archivo debe ser JPEG y pesar <= 15 MB ("«nombre» no es JPG." / "«nombre» pesa más de 15 MB."). `normalizarFoto` lo re-codifica con canvas a JPEG de calidad 0.9 en 1280x960 (960x1280 en vertical), sin ampliar y respetando la orientación EXIF (`createImageBitmap` con `imageOrientation: 'from-image'`, o `Image` como alternativa); si la normalización falla la foto se **rechaza** ("No se pudo preparar «nombre».") y nunca se sube el original, que podría llevar EXIF con GPS. Si caben menos fotos que las elegidas: "Solo caben N foto(s) más (máximo 8)." Los errores van en una lista `role="alert"`. Mismos estados y rejilla que la cámara, con "Quitar" (`Trash2`) en lugar de "Repetir".

#### Componente `admin/alumnos/GaleriaTomas`

Carpeta `web/src/components/admin/alumnos/GaleriaTomas/` (presentacional, compartido por los dos modos). Props: `{ ranuras: [{ clave, numero, titulo, toma|null, destacada }], accion: 'repetir'|'quitar', onAccion(id), deshabilitado }`.

Rejilla `<ul className="grid grid-cols-2 gap-2 min-[480px]:grid-cols-3 sm:grid-cols-5">` (2 columnas a 360 px, sin desborde horizontal). Cada `<li>` lleva `aria-label` "Toma K de N, <título>, <estado>": miniatura `aspect-[4/3]` `object-cover` (la `ObjectURL` se libera al quitar, repetir, limpiar y desmontar; `alt` "Toma K: <título>"); bajo ella el estado como **texto con ícono** (`flex items-start gap-1 text-xs break-words`; nunca `Badge` en píldora ni solo color) y un `ui/Button` `size="sm"` `w-full` con texto corto "Repetir" (`RotateCcw`) o "Quitar" (`Trash2`) y `aria-label` "Repetir toma K" / "Quitar toma K"; también en las tomas aceptadas. Las ranuras vacías (modo cámara) muestran número y título del paso y la siguiente lleva `aria-current="step"`.

| Estado | Ícono | Texto | Token |
|---|---|---|---|
| `verificando` | `LoaderCircle` (gira con `motion-safe:animate-spin`) | Verificando… | `text-muted-foreground` |
| `aceptada` | `CircleCheck` | Aceptada | `text-presente` |
| `calidad` | `CircleAlert` | el texto del motivo (`textoMotivo`) | `text-ausente` |
| `inconsistente` | `CircleAlert` | No parece la misma persona; si el conjunto es ambiguo, Las tomas no coinciden entre sí | `text-retardo` |
| `ilegible` | `CircleAlert` | No se pudo leer la imagen | `text-ausente` |
| `duplicada` | `Copy` | Igual a la toma K | `text-retardo` |

#### Componente `admin/alumnos/CalidadFotoResumen`

Carpeta `web/src/components/admin/alumnos/CalidadFotoResumen/`. Presentacional.

| Prop | Tipo |
|---|---|
| `resultado` | Una foto del conjunto (`{ rostros, un_solo_rostro, calidad: { brillo, nitidez, tamano_rostro_px, tamano_rostro, frontal }, motivo_rechazo, motivo_codigo, coseno_resto }`) o el resultado heredado de `POST /api/plantilla/verificar` con `foto` |

Muestra 5 renglones (Rostros detectados, Brillo, Nitidez, Tamaño del rostro en px, De frente) con texto "Correcto"/"Revisar" y el motivo si lo hay. Cada renglón se decide por `motivo_codigo` (`BORROSA`, `POCA_LUZ`, `EXCESO_LUZ`, `ROSTRO_PEQUENO`, `NO_FRONTAL`); antes marcaba siempre "Correcto" porque comparaba contra códigos y el servicio devuelve frases. Se muestra dentro de UN solo `ui/Detalles` agregado "Ver detalles de calidad" (un bloque por toma con su `coseno_resto`). Texto y color (no solo color).

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
| `plantillaRegistrar({ idAlumno, idConsent, objetoFoto, fotos? })` | `api_plantilla_registrar` (`fotos` pasa como `p_fotos`; sus objetos ya llevan claves `snake_case`) |
| `plantillaAlumno({ idAlumno, limit, offset })` | `api_plantilla_alumno` |
| `documentoUrlAutorizar({ tipo, idRegistro })` | `api_documento_url_autorizar` |
| `indiceEstado({ limit, offset })` | `api_indice_estado` |
| `parametrosListar({ limit, offset })` | `api_parametros_listar` |
| `parametroActualizar({ clave, valor })` | `api_parametro_actualizar` |
| `camarasEstado({ estatus, limit, offset })` | `api_camaras_estado` |
| `camaraCambiarEstatus({ idCamara, estatus })` | `api_camara_cambiar_estatus` |

`web/src/lib/http/biometria.js` (route-handlers): `registrarConsentimiento(formData)`, `revocarConsentimiento({ idConsent })`, `solicitarUrlDocumento({ idAlumno, tipo, idRegistro })`, `verificarFoto(blob)`, `verificarFotos(blobs, { idAlumno, idConsent, signal })`, `registrarPlantilla({ idAlumno, idConsent, foto, fotos }, { signal })`, `obtenerEstadoIndice()`, `reconstruirIndice({ completa })`, `sincronizarIndice()`, `revertirIndice({ idIndice })`. `verificarFotos` arma un multipart con `fotos` repetido (`foto-1.jpg`, …), `id_alumno` e `id_consent`; `registrarPlantilla` envía `fotos` repetido si recibe un arreglo y `foto` si recibe una sola (camino heredado). `solicitarUrlDocumento({ tipo: 'plantilla_foto', idRegistro: id_foto })` no necesita código nuevo. Todas devuelven el JSON o lanzan `ApiError` con `code` del cuerpo `{ error: { code, message, details? } }`.

Las funciones de `lib/api/biometria.js` no añaden envoltorios nuevos (siguen 72 `api_*`): solo cambian los argumentos de `plantillaRegistrar` y las claves devueltas por `plantillaAlumno` y `documentoUrlAutorizar` (ver §3.4 a §3.6). El wrapper convierte solo claves de primer nivel.

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
| `FOTO_NO_CONSERVADA` | La foto ya no se conserva: solo se guarda el vector del rostro en el índice. | `api_documento_url_autorizar` (tipos `plantilla` y `plantilla_foto`) sobre una foto ya purgada (ext. 18); HTTP 410, no asienta consulta |
| `PARAMETRO_NO_ENCONTRADO` | El parámetro no existe. | Clave desconocida |
| `PARAMETRO_VALOR_INVALIDO` | Texto con el rango (p. ej. "intervalo_muestreo_seg debe ser un entero entre 5 y 120.") | Valor fuera de tipo/rango o incoherente con otro parámetro |
| `SERVICIO_NO_CONFIGURADO` | La cuenta de servicio del sistema no está configurada. | `app.id_cuenta_servicio()` sin fila |
| `BLOQUEO_OCUPADO` | El recurso está en uso por otro proceso. | Solo informativo: `svc_bloqueo_adquirir` devuelve `false`, no lanza |

Mapeo de restricciones (23xxx) a código, que la capa de datos aplica si una escritura directa las dispara (las RPC las evitan con validación previa): `ux_plantilla_facial_activa` -> `RN_12_PLANTILLA_ACTIVA_DUPLICADA`; `ux_indice_faiss_en_uso` -> `RN_12_INDICE_EN_USO_DUPLICADO`; `uq_indice_faiss_version` -> `INDICE_VERSION_DUPLICADA`; `uq_plantilla_indice_faiss_id` -> `INDICE_MAPEO_INVALIDO`; `ck_plantilla_indexada` -> `INDICE_MAPEO_INVALIDO`; `ck_consentimiento_vigencia` -> `VALIDACION`. `ck_plantilla_foto_calidad` no tiene mapeo propio (`errors.js` no cambia): un `INSERT` directo con calidad inválida falla con 23514; la RPC lo evita con `app.calidad_foto_valida` y responde `VALIDACION`.

La extensión de varias fotos (§4) no añade códigos `P0001`: `api_plantilla_registrar` reutiliza `VALIDACION` y `RUTA_INVALIDA`. Los códigos nuevos (`FOTOS_RECHAZADAS`, `FOTOS_INSUFICIENTES`, `FOTOS_DUPLICADAS`, `DEMASIADOS_ARCHIVOS`) son de los Route Handlers y están en §4.3.

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
    p_ip           inet DEFAULT NULL,
    p_fotos        jsonb DEFAULT NULL
) RETURNS jsonb
```

- Llama: `administrador` (desde `POST /api/alumnos/{id}/plantilla`, después de verificar las fotos y subirlas). `SECURITY DEFINER`.
- Lee: `alumno`, `consentimiento`. Escribe: `plantilla_facial`, `plantilla_foto`, `bitacora_auditoria`.
- Firma (migración `0235`): se hizo `DROP` de la firma de 4 argumentos y `CREATE` de la de 5 (un *overload* haría ambigua la llamada por nombre y el adaptador local toma la primera función con ese nombre). `p_ip` sigue siendo el 4.º: toda llamada posicional o por nombre anterior sigue valiendo. Sin `p_fotos` todo es idéntico al comportamiento anterior (una foto), más la fila `orden = 1` de `plantilla_foto` que crea el trigger.
- `p_fotos` (si no es `NULL`): arreglo JSON de 3 a 8 objetos **en orden de captura**; el primero es la foto principal. Claves por elemento: `objeto_foto` (obligatoria, texto), `calidad` (opcional; ausente, `null` JSON o un objeto que cumpla `app.calidad_foto_valida`) y `coseno_resto` (opcional; ausente, `null` JSON o número entre -1 y 1, que se guarda redondeado a 3 decimales). Cualquier otra clave es inválida. `calidad` y `coseno_resto` los aporta el llamador (el servicio, vía la ruta Next) y son **informativos, no verificables en SQL**. Ejemplo:

```json
[ { "objeto_foto": "registro/17/0f8e1c2a-aaaa-4bbb-8ccc-123456789abc.jpg",
    "calidad": { "brillo": 120.5, "nitidez": 88.2, "tamano_rostro_px": 210, "frontal": true },
    "coseno_resto": 0.812 }, ... ]
```

- Reglas, en UNA transacción y en este orden (RN-12, RN-13, RF-15, RF-16). TODA la validación va antes de escribir: un rechazo no archiva la plantilla activa.
  1. Rol `administrador`.
  2. `SELECT ... FROM alumno WHERE id_alumno = p_id_alumno FOR UPDATE` (serializa altas concurrentes del mismo alumno). `NO_ENCONTRADO` si no existe; `ALUMNO_INACTIVO` si `estatus <> 'activo'`.
  3. Si `p_fotos IS NULL`: `p_objeto_foto` cumple `registro/{p_id_alumno}/<uuid>.jpg` (`RUTA_INVALIDA`, incluida la ruta `NULL`). Si `p_fotos IS NOT NULL`: (a) es un arreglo de 3 a 8 elementos, si no `VALIDACION` "Una plantilla de varias fotos lleva de 3 a 8 fotos."; (b) cada elemento es un objeto con `objeto_foto` de tipo texto, solo las 3 claves permitidas, `calidad` ausente/`null`/válida y `coseno_resto` ausente/`null`/número en [-1, 1], si no `VALIDACION` "La descripción de las fotos no es válida."; (c) cada `objeto_foto` cumple `registro/{p_id_alumno}/<uuid>.jpg` (`RUTA_INVALIDA`); (d) sin rutas repetidas, si no `VALIDACION` "Las fotos no pueden repetirse."; (e) `p_objeto_foto` es `NULL` o igual a `p_fotos->0->>'objeto_foto'`, si no `VALIDACION` "La foto principal debe ser la primera de la lista."
  4. Consentimiento: existe (`NO_ENCONTRADO`), `id_alumno` coincide (`RN_13_CONSENTIMIENTO_AJENO`), `app.consentimiento_vigente(p_id_consent)` (`RN_13_CONSENTIMIENTO_NO_VIGENTE`).
  5. ARCHIVAR primero: `UPDATE plantilla_facial SET activa = false WHERE id_alumno = p_id_alumno AND activa RETURNING id_plantilla, id_consent`, y DESPUÉS INSERTAR: `INSERT INTO plantilla_facial (id_alumno, id_consent, id_indice, faiss_id, objeto_foto, fecha_registro, activa) VALUES (p_id_alumno, p_id_consent, NULL, NULL, <la principal>, app.now(), true)`. El índice único parcial no es diferible: el orden inverso falla con 23505. El trigger `trg_plantilla_foto_principal` (AFTER INSERT OR UPDATE OF `objeto_foto`) crea la fila `plantilla_foto` con `orden = 1`.
  6. Con `p_fotos`: `UPDATE plantilla_foto SET calidad, coseno_resto` del elemento 0 `WHERE orden = 1` e `INSERT` de los elementos 1..n-1 con `orden` 2..n.
  7. `app.bitacora('alta_plantilla', 'plantilla_facial', <id_plantilla nueva>, <anterior>, <nuevo>, p_ip)`; `anterior` = `{ "id_plantilla": <archivada>, "id_consent": <su consentimiento>, "activa": true }` o `NULL` si no había; `nuevo` = `{ "id_plantilla": <nueva>, "id_consent": p_id_consent, "objeto_foto": <la principal>, "activa": true, "plantilla_archivada": <id|null>, "n_fotos": <n> }`.
- **Las fotos anteriores NO se borran del bucket**: la plantilla archivada conserva su foto principal y sus fotos extra (RN-12; `activa = false` es el único "archivado"). Las fotos extra no tienen bandera propia: su estado es el de la plantilla padre. La decisión de qué fotos son ajenas o inconsistentes NO es de esta RPC: la toma el servicio de reconocimiento (§4) y llega aquí como el escalar informativo `coseno_resto`.
- Atómica: una falla no deja filas en `plantilla_foto` ni archiva la anterior.

Retorno (claves anteriores intactas más `n_fotos`; `n_fotos = 1` sin `p_fotos`):

```json
{
  "id_plantilla": 41,
  "id_alumno": 17,
  "id_consent": 9,
  "activa": true,
  "indexada": false,
  "plantilla_archivada": 33,
  "fecha_registro": "2026-09-14T09:12:41-06:00",
  "requiere_reconstruccion": true,
  "n_fotos": 5
}
```

Errores (ningún código nuevo): `NO_AUTORIZADO`; `NO_ENCONTRADO` ("El alumno no existe." / "El consentimiento no existe."); `ALUMNO_INACTIVO`; `VALIDACION` (solo por `p_fotos`); `RUTA_INVALIDA`; `RN_13_CONSENTIMIENTO_AJENO`; `RN_13_CONSENTIMIENTO_NO_VIGENTE` ("El consentimiento no está firmado y vigente: la alta se rechaza.").

### 3.5 `api_plantilla_alumno`

```sql
CREATE FUNCTION public.api_plantilla_alumno(
    p_id_alumno integer,
    p_limit     integer DEFAULT 50,
    p_offset    integer DEFAULT 0
) RETURNS jsonb
```

- Llama: `administrador`. `SECURITY INVOKER` (+ rol explícito). Lee: `plantilla_facial`, `plantilla_foto`, `indice_faiss`, `consentimiento`.
- `activa.indexada` = `id_indice IS NOT NULL`; `activa.en_uso` = su `id_indice` es la versión en uso; `consentimiento_vigente` = `app.consentimiento_vigente(id_consent)`.
- Claves nuevas dentro de `activa` (las demás intactas): `n_fotos`; `coseno_min` y `coseno_medio` (mínimo y media de `coseno_resto`, 3 decimales; `null` en plantillas de una foto); `fotos`, ordenadas por `orden`, con `id_foto`, `orden`, `principal` (`orden = 1`), `calidad` (`{ brillo, nitidez, tamano_rostro_px, frontal }` o `null`) y `coseno_resto` (o `null`). En `archivadas.items[]` se añade `n_fotos`. Fallback defensivo: si una plantilla no tuviera filas en `plantilla_foto`, `n_fotos = 1` y `fotos = []`. **Nunca se emite `objeto_foto`**: la ruta solo sale por `api_documento_url_autorizar`. La pantalla la sigue llamando con `limit` 1.
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
    "consentimiento_vigente": true,
    "n_fotos": 5,
    "coseno_min": 0.512,
    "coseno_medio": 0.744,
    "fotos": [
      { "id_foto": 101, "orden": 1, "principal": true,
        "calidad": { "brillo": 120.5, "nitidez": 88.2, "tamano_rostro_px": 210, "frontal": true },
        "coseno_resto": 0.812 }
    ]
  },
  "archivadas": { "total": 1, "items": [ { "id_plantilla": 33, "id_consent": 4, "fecha_registro": "2025-08-21T10:02:11-06:00", "n_fotos": 1 } ] },
  "indice_en_uso": { "id_indice": 3, "version": "v003" }
}
```

(`fotos` se abrevia a un elemento en el ejemplo.) `activa` es `null` si no hay plantilla activa; `indice_en_uso` es `null` si no hay índice. Errores: `NO_AUTORIZADO`; `NO_ENCONTRADO` ("El alumno no existe.").

### 3.6 `api_documento_url_autorizar`

```sql
CREATE FUNCTION public.api_documento_url_autorizar(
    p_tipo        text,      -- 'consentimiento' | 'plantilla' | 'plantilla_foto'
    p_id_registro integer,   -- id_consent, id_plantilla o id_foto
    p_ip          inet DEFAULT NULL
) RETURNS jsonb
```

- Llama: `administrador` (desde `POST /api/alumnos/{id}/documento-url` y `GET /api/documentos/plantilla_foto/{id}`). `SECURITY DEFINER`.
- Lee: `consentimiento`, `plantilla_facial` o `plantilla_foto`. Escribe: `bitacora_auditoria`.
- Reglas (RF-19, RNF-04, RNF-08): cada emisión de URL asienta `app.bitacora('consulta', <'consentimiento'|'plantilla_facial'>, p_id_registro, NULL, jsonb_build_object('id_alumno', ...), p_ip)` ANTES de devolver. Devuelve la ruta y la vigencia de la URL; el Route Handler crea la URL firmada.
- `p_tipo = 'plantilla'` devuelve la foto principal de la plantilla (sin cambios). `p_tipo = 'plantilla_foto'` (`p_id_registro` = `id_foto`) devuelve la ruta de esa foto, incluso si su plantilla está archivada (igual que `'plantilla'`), y asienta `app.bitacora('consulta', 'plantilla_facial', <id_plantilla>, NULL, { id_alumno, id_foto, orden }, p_ip)` (`ck_bitacora_entidad` no cambia). `NO_ENCONTRADO` ("La foto de la plantilla no existe.") si no existe. Cualquier otro tipo: `VALIDACION` ("Tipo de documento no válido.").
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

Con `plantilla_foto` el JSON añade `id_plantilla` y `orden`:

```json
{
  "tipo": "plantilla_foto",
  "id_registro": 103,
  "id_alumno": 17,
  "id_plantilla": 41,
  "orden": 3,
  "objeto": "registro/17/9b2d6c1e-0a3f-4e7b-8d55-2c1f0a9e4b73.jpg",
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

- Llama: Route Handler (`lib/server/indice.js`) con `service_role`. `SECURITY DEFINER`. Solo lectura: `indice_faiss`, `plantilla_facial`, `plantilla_foto`, `parametro_sistema`. No toma bloqueos.
- Contrato:
  - `dimension` = `app.param_num('dimension_vector')`.
  - `base` = índice `en_uso` si existe, su `dimension` coincide con `dimension` y `p_completa = false`; si no `null` (con `motivo_sin_base`: `"sin_indice"`, `"dimension_cambiada"` o `"completa"`).
  - `entries` = TODAS las plantillas `activa`, orden `id_plantilla`. Para cada una: `en_base = (base IS NOT NULL AND id_indice = base.id_indice)`. Si `en_base`, conserva su `faiss_id`. Si no, recibe `faiss_id` NUEVO = `max(faiss_id de toda plantilla_facial, activa o no) + posición` (empezando en `max+1`; 0 si no hay): los `faiss_id` son monótonos y estables entre versiones y nunca se reutilizan.
  - `version_sugerida` = `'v' || lpad((1 + coalesce(max(substring(version from '^v(\d+)$')::int), 0))::text, 3, '0')` (la versión cabe en `VARCHAR(12)`).
  - `totales`: `activas`, `nuevas` (`not en_base`), `en_base`, `obsoletas` (`activa = false` con `id_indice = base.id_indice`; 0 si no hay base).
  - `nada_que_hacer` = `nuevas = 0 AND obsoletas = 0 AND base IS NOT NULL`.
  - Cada elemento de `entries` gana `objetos_foto`: arreglo de rutas en orden de `plantilla_foto.orden` (la principal primero; fallback `[objeto_foto]` si faltaran filas) cuando `en_base = false`, y `null` cuando `en_base = true` (el vector se conserva con `keep`). `objeto_foto` (la principal) se conserva. Solo entran las plantillas ACTIVAS, incluidas las de consentimiento vencido (`app.vencer_consentimientos` no archiva); las fotos de plantillas archivadas o revocadas quedan fuera del índice igual que su foto principal.

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
    { "id_plantilla": 12, "id_alumno": 3, "faiss_id": 1001, "id_indice": 3, "en_base": true, "objeto_foto": "registro/3/5d2e...jpg", "objetos_foto": null },
    { "id_plantilla": 41, "id_alumno": 17, "faiss_id": 1043, "id_indice": null, "en_base": false, "objeto_foto": "registro/17/3f1c...jpg",
      "objetos_foto": ["registro/17/3f1c...jpg", "registro/17/a77e...jpg", "registro/17/c902...jpg"] }
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

### 3.20b `svc_fotos_registro_listar` y `svc_fotos_registro_marcar` (extensión 18)

```sql
CREATE FUNCTION public.svc_fotos_registro_listar(p_ids integer[] DEFAULT NULL, p_limit integer DEFAULT 200) RETURNS jsonb
CREATE FUNCTION public.svc_fotos_registro_marcar(p_ids integer[]) RETURNS jsonb
```

- Llaman: `reconstruirIndice` (tras activar, con `p_ids` = las plantillas nuevas del build) y `POST /api/jobs/purgar-fotos-registro` (sin `p_ids`). Solo `service_role`, `SECURITY DEFINER`.
- Mismo patrón que 3.20: (1) `listar`, (2) borrar objetos en Storage, (3) `marcar`. Si el proceso muere entre 2 y 3 la siguiente corrida vuelve a listar; borrar un objeto ausente no es error.
- **Purgable** = plantilla con alguna foto no nula y (`id_indice IS NOT NULL` — su vector ya está en un índice activado — **o** `NOT activa` — archivada, no volverá al índice). Una plantilla activa sin indexar NUNCA es purgable: su foto es la única copia de su vector.
- `listar` devuelve una fila por plantilla con TODOS sus objetos (la principal y las de `plantilla_foto`), para no dejar una plantilla a medias. `p_limit` cuenta plantillas (def. 200, máx. 1000). `p_ids` > 5000: `VALIDACION`.
- `marcar` vuelve a comprobar la condición (una reversión entre listar y marcar deja la ruta intacta) y pone `objeto_foto = NULL` en `plantilla_facial` y en todas sus `plantilla_foto`. Conserva la fila (`faiss_id`, `id_indice`, `calidad`, `coseno_resto`). Idempotente. `p_ids` nulo o > 5000: `VALIDACION`.

```json
{ "pendientes_total": 412, "items": [ { "id_plantilla": 41, "objetos": ["registro/17/<uuid>.jpg", "registro/17/<uuid>.jpg"] } ] }
```

Retorno de `marcar`: `{ "solicitadas": 200, "marcadas": 198 }`.

Otros contratos que cambian con la migración `0237`: `plantilla_facial.objeto_foto` y `plantilla_foto.objeto_foto` admiten `NULL`; `api_plantilla_alumno` añade `activa.foto_disponible` y `activa.fotos[].disponible` (aditivo; sigue sin emitir rutas); `api_documento_url_autorizar` añade el error `FOTO_NO_CONSERVADA`. `api_detecciones_caso.objeto_foto_registro` pasa a ser `null` una vez purgada la foto (la ruta ya lo admitía).

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

---

## 4. Plantilla de varias fotos (extensión 17 de `docs/DECISIONS.md`)

Una plantilla pasa de UNA foto a **3 a 8 fotos** (5 guiadas). El servicio de reconocimiento embebe cada foto, descarta las ajenas, promedia los vectores L2-normalizados (centroide) y vuelve a normalizar: el resultado es **UN vector y UN `faiss_id`** por plantilla, así que RN-12 y todo el flujo del índice quedan intactos. El promedio y el descarte ocurren en el servicio porque el vector solo puede vivir en memoria y en el JSON del índice (RNF-03). Las plantillas existentes de una foto siguen funcionando sin migración manual. Calibración y decisiones: `docs/DECISIONS.md` (sección 6) y `recognition-service/README.md`.

### 4.1 Modelo de datos (migración `0235_plantilla_fotos.sql`)

- **Una fila de `plantilla_facial` por plantilla** (RN-12, un `faiss_id`, `ux_plantilla_facial_activa` y el flujo de índice sin cambios) más la tabla hija **`plantilla_foto`** (la 20.ª tabla; la spec habla de 19). `plantilla_facial.objeto_foto` sigue siendo la foto principal. Se descartó un `jsonb`/arreglo dentro de `plantilla_facial` (rompe la 3FN, pierde la FK y el borrado por objeto, y RNF-03 prohíbe columnas de arreglo).

| Columna de `plantilla_foto` | Tipo | Notas |
|---|---|---|
| `id_foto` | `integer` identity | PK `pk_plantilla_foto` |
| `id_plantilla` | `integer` NOT NULL | FK `fk_plantilla_foto_plantilla` a `plantilla_facial`, `ON DELETE RESTRICT` |
| `orden` | `smallint` NOT NULL | 1..8 (`ck_plantilla_foto_orden`); `uq_plantilla_foto_orden` único por `(id_plantilla, orden)`. `orden = 1` es la foto principal = `plantilla_facial.objeto_foto` |
| `objeto_foto` | `varchar(255)` NOT NULL | Ruta `registro/{id_alumno}/<uuid>.jpg` en el bucket privado |
| `calidad` | `jsonb` | `{ brillo, nitidez, tamano_rostro_px, frontal }` medidas por el servicio al registrar; `NULL` en plantillas anteriores; informativo. `ck_plantilla_foto_calidad` usa `app.calidad_foto_valida` |
| `coseno_resto` | `numeric(4,3)` | Coseno medio de la foto contra las demás fotos aceptadas, medido por el servicio al registrar; `NULL` en plantillas de una foto; informativo, no verificable en SQL (`ck_plantilla_foto_coseno`: -1..1) |

- `app.calidad_foto_valida(p jsonb) → boolean` (lista blanca; la usan el `CHECK` y la RPC, así la RPC responde `VALIDACION` y nunca un 23514 crudo): `NULL` es válido; debe ser un objeto con solo las claves `brillo` (número 0..255), `nitidez` (número 0..1 000 000), `tamano_rostro_px` (entero 0..100 000) y `frontal` (booleano).
- **Invariante por trigger**: `trg_plantilla_foto_principal` (AFTER INSERT OR UPDATE OF `objeto_foto` en `plantilla_facial`) inserta o sincroniza la fila `orden = 1`. Así toda plantilla tiene al menos una fila y ningún lector distingue plantillas heredadas de nuevas; la RPC, las fixtures y cualquier `INSERT` directo quedan coherentes. El *backfill* de las plantillas existentes es un `INSERT ... SELECT` idempotente. `svc_indice_plan` y `api_plantilla_alumno` hacen además fallback a `objeto_foto` si faltaran filas.
- **RLS y permisos**: RLS activa; `REVOKE ALL` a `PUBLIC`, `anon` y `authenticated` (también sobre la secuencia); `GRANT SELECT` a `authenticated` con la política `admin_ve_todo` (solo el administrador lee; el docente sigue viendo la foto principal por `plantilla_facial`); `GRANT ALL` a `service_role`. Nadie escribe salvo funciones `DEFINER`.
- **Las fotos rechazadas no se suben ni se guardan**: lo que está en `plantilla_foto` es exactamente lo aceptado al registrar. No hay columna `incluida`. Minimiza datos biométricos y evita guardar el rostro de un tercero (un *outlier* suele ser otra persona).
- Sin RPC `api_*` nueva (siguen 72). Cambian: `api_plantilla_registrar` (§3.4, 5.º parámetro `p_fotos`), `api_plantilla_alumno` (§3.5), `api_documento_url_autorizar` (§3.6, tipo `plantilla_foto`) y `svc_indice_plan` (§3.12, `objetos_foto`). En Supabase real, tras aplicar `0235` hay que recargar el esquema de PostgREST (`NOTIFY pgrst, 'reload schema'`).

### 4.2 Servicio de reconocimiento

Autenticación `X-API-Key` como siempre. Nunca viaja un vector ni un embedding (ninguna clave con esas palabras) y nada se guarda en `check-set`.

#### Variables de entorno nuevas (todas con defecto)

| Variable | Defecto | Significado |
|---|---|---|
| `TEMPLATE_MIN_PHOTOS` | 3 | Mínimo de fotos aceptadas de una plantilla |
| `TEMPLATE_MAX_PHOTOS` | 8 | Máximo de fotos (techo duro compartido con SQL y con el proxy de Next) |
| `TEMPLATE_OUTLIER_COSINE` | 0.35 | Coseno medio mínimo de una foto contra las demás al REGISTRAR; `0` apaga el descarte (modo calibración) |
| `TEMPLATE_BUILD_OUTLIER_COSINE` | `min(0.25, TEMPLATE_OUTLIER_COSINE)` | Umbral propio, más permisivo, del constructor del índice |
| `TEMPLATE_LINK_COSINE` | 0.30 | Segundo criterio de consistencia: las fotos conservadas deben formar UN grupo (dos fotos se enlazan si su coseno es >= este valor); detecta mezclas balanceadas de dos personas; `0` lo apaga. El constructor usa `min(0.20, este valor)` |
| `TEMPLATE_MAX_YAW_RATIO` | 0.40 | Razón de giro máxima en modo conjunto (unos 36 grados) |
| `TEMPLATE_DUP_COSINE` | 0.97 | Coseno desde el cual dos fotos se consideran casi idénticas |
| `TEMPLATE_MAX_TOTAL_BYTES` | 31 457 280 (30 MiB) | Tope de bytes de una petición a `/check-set` |

`Settings.validate()` falla al arrancar si no se cumple: `3 <= min <= max <= 8`; `0 <= outlier < 1`; `0 <= build <= outlier`; `0 <= link < 1`; `0.1 <= yaw <= 1`; `0.8 <= dup <= 1`; `total_bytes >= max_image_bytes`.

#### Criterio de consistencia (`app/samples.py::consolidar`)

Una foto debe parecerse, **en promedio**, al menos `TEMPLATE_OUTLIER_COSINE` a las demás fotos que se conservan. Se usa la media de pares y no el coseno contra el centroide porque este último infla el coseno cuando las demás fotos son una mezcla de dos personas (el centroide pierde norma): dejaba pasar conjuntos balanceados 3+3 y 4+4. Pero la media de pares tampoco ve una mezcla balanceada cuando las fotos de cada persona se parecen mucho entre sí (coseno ~0.8: la media de cada foto cae en 0.35-0.36), por eso hay un segundo criterio, el **enlace de grupo** (paso 3). Algoritmo (aritmética en `float64`; el centroide se entrega en `float32`):

1. Mientras queden más de 2 fotos, calcula la media de cada foto contra las demás conservadas.
2. Descarta la peor (empate: menor índice) si está por debajo del umbral y repite; si no, para. La comparación es con `>=` (un coseno igual al umbral se conserva).
3. Con 3 o más fotos conservadas y `TEMPLATE_LINK_COSINE > 0` (y descarte activo), las fotos conservadas deben formar UNA componente conexa (enlace = coseno >= `TEMPLATE_LINK_COSINE`); si quedan 2 o más grupos el conjunto es ambiguo (mezcla de personas). Basta un compañero parecido por foto, así que una toma genuina difícil no rompe el conjunto.
4. Al final el conjunto es **ambiguo** si quedan 2 y su coseno mutuo es menor que el umbral, si las descartadas son al menos tantas como las usadas (sin mayoría) o si no hay centroide (suma de norma casi nula).
5. En un conjunto ambiguo TODAS las candidatas pasan a `inconsistente`.

`n < 2` devuelve la entrada. Los cosenos mostrados se truncan (no se redondean) a 3 decimales para que un valor bajo el umbral nunca se muestre como el umbral. El umbral 0.35 es una **hipótesis calibrable** (variable de entorno; la respuesta expone `coseno_resto` por foto). Detalles en `docs/DECISIONS.md`.

#### Razón de giro compensada

`DetectedFace.yaw_ratio` guarda la razón compensada por la inclinación de la cabeza: `|(nariz - punto medio de los ojos) · u| / distancia interocular`, con `u` el vector unitario del ojo izquierdo al derecho. La heurística heredada usa solo la coordenada `x` de la nariz y confunde inclinación con giro. En modo conjunto `frontal = yaw_ratio < TEMPLATE_MAX_YAW_RATIO`; el booleano `frontal` heredado de `/v1/photo/check` NO cambia. Las tomas guiadas piden 15 grados (razón 0.15).

#### `POST /v1/photo/check` (sin cambios de contrato)

Una imagen, mismo JSON; solo se añade (aditivo) la clave `motivo_codigo` junto a `motivo_rechazo` (que sigue siendo una frase en español legible, no un código):

| `motivo_rechazo` (frase) | `motivo_codigo` |
|---|---|
| No se detecto ningun rostro. | `SIN_ROSTRO` |
| Hay mas de un rostro en la foto. | `MULTIPLES_ROSTROS` |
| El rostro es demasiado pequeno (...) | `ROSTRO_PEQUENO` |
| El rostro no esta de frente. | `NO_FRONTAL` |
| La foto esta muy oscura. | `POCA_LUZ` |
| La foto esta sobreexpuesta. | `EXCESO_LUZ` |
| La foto esta desenfocada. | `BORROSA` |
| (sin rechazo) | `null` |

Los códigos `IMAGEN_INVALIDA`, `NO_COINCIDE` y `CONJUNTO_AMBIGUO` solo aparecen en `check-set`.

#### `POST /v1/photo/check-set`

`multipart/form-data` con el campo `images` REPETIDO (de 1 a `TEMPLATE_MAX_PHOTOS` archivos). 0 archivos o más del máximo, o una suma de bytes leídos mayor que `TEMPLATE_MAX_TOTAL_BYTES`: 422 `VALIDATION_ERROR`; sin clave: 401. Un archivo que supere `MAX_IMAGE_BYTES`, tenga demasiados píxeles o no decodifique NO tumba la petición: esa foto sale `ilegible`.

Por foto, en orden: decodifica; `analyze(rgb, TEMPLATE_MAX_YAW_RATIO)`; con `motivo_rechazo != null` el estado es `calidad`. Con las candidatas (sin motivo) y al menos 2, `consolidar(E, TEMPLATE_OUTLIER_COSINE, TEMPLATE_MIN_PHOTOS)`: las usadas quedan `aceptada`, las descartadas `inconsistente` (`NO_COINCIDE`); si el conjunto es ambiguo, TODAS las candidatas quedan `inconsistente` con `CONJUNTO_AMBIGUO`. Una sola candidata queda `aceptada` sin coseno.

```json
{
  "total": 5, "aceptadas": 4, "minimo": 3, "maximo": 8,
  "suficiente": true, "consistente": false, "ambiguo": false,
  "umbral_coseno": 0.35, "coseno_min": 0.512, "coseno_medio": 0.744, "coseno_max_par": 0.931,
  "advertencias": [],
  "fotos": [
    { "indice": 0, "estado": "aceptada", "rostros": 1, "un_solo_rostro": true,
      "calidad": { "brillo": 120.5, "nitidez": 88.2, "tamano_rostro_px": 210, "frontal": true },
      "motivo_rechazo": null, "motivo_codigo": null, "coseno_resto": 0.812 }
  ]
}
```

- `fotos[i].estado`: `aceptada | calidad | inconsistente | ilegible`. `indice` es la posición en el envío desde 0. `calidad` es `null` solo en `ilegible` (`motivo_codigo` `IMAGEN_INVALIDA`).
- `suficiente` = `aceptadas >= minimo`. `consistente` = `null` con menos de 2 candidatas, `false` si alguna salió `inconsistente` o el conjunto es ambiguo, `true` en otro caso. `coseno_min`, `coseno_medio` y `coseno_max_par` se calculan solo sobre las aceptadas (`null` si no hay).
- `advertencias` admite `DIVERSIDAD_BAJA` (con 2 o más aceptadas y menos grupos de fotos casi idénticas, por enlace simple a `TEMPLATE_DUP_COSINE`, que `minimo`).
- Los cosenos van truncados a 3 decimales.

#### `POST /v1/index/build` (cambios aditivos)

- `EntryIn` admite una tercera forma, `objetos_foto: list[str]` (de 2 a 8 elementos de 1 a 512 caracteres; se valida con pydantic, 422 ANTES de tomar el candado). Exactamente una de `{ keep: true }`, `{ objeto_foto }`, `{ objetos_foto }`; mezclar formas es 422. Las dos primeras se comportan idéntico a antes.
- Entrada `objetos_foto`: se leen y embeben todas. **Constructor defensivo** (el registro es el filtro estricto; el constructor solo se defiende de fotos corruptas o ajenas de verdad): se descarta una foto (no es error) si el objeto no existe (`no_encontrada`), no decodifica (`ilegible`), no tiene exactamente un rostro (`sin_rostro` | `varios_rostros`) o la elimina `consolidar` con `TEMPLATE_BUILD_OUTLIER_COSINE`, enlace `min(0.20, TEMPLATE_LINK_COSINE)` y mínimo 1 (`inconsistente`, con su `coseno_resto`). Un `StorageError` transitorio NO es descarte: la entrada falla con "No se pudo leer la foto." como hoy. Si NINGUNA foto es utilizable: error de entrada `{ id_plantilla, motivo: "Ninguna de las N fotos es utilizable.", codigo: "SIN_MUESTRAS_UTILIZABLES" }` (todo o nada: no se escribe el índice). Si el conjunto es ambiguo se indexa la primera foto utilizable sola (comportamiento heredado) y el resto se informa descartado con motivo `ambigua`. En otro caso el vector es el centroide de las usadas. No exige mínimo: con 1 o más fotos utilizables indexa el centroide y lo informa como `degradada`. Así ninguna plantilla bloquea el índice ni las revocaciones por un cambio de entorno, de umbrales o por una foto ausente.
- Las filas `keep` NO se renormalizan (re-normalizar un centroide ya normalizado cambia bits y la suma en `float32` depende del orden): solo se normalizan las filas NUEVAS, y las `keep` quedan idénticas a la base, byte a byte.
- Respuesta: se mantienen `version`, `objeto_indice`, `dimension`, `ntotal`, `mapeo` y `errores` (cada error puede traer `codigo`). Clave NUEVA `muestras` (también cuando hay errores; `[]` si no hay entradas `objetos_foto`), solo con escalares:

```json
"muestras": [
  { "id_plantilla": 41, "total": 5, "usadas": 5,
    "descartadas": [ { "indice": 2, "motivo": "inconsistente", "coseno_resto": 0.21 } ],
    "coseno_min": 0.512, "coseno_medio": 0.744, "degradada": false }
]
```

`degradada = usadas < total`. El vector del centroide no sale. Los logs solo llevan contadores ("plantillas multi: N, fotos descartadas: K"), sin PII ni vectores.

La plantilla multifoto exige `EMBEDDER=insightface`: con `fake`, `/check-set` responde 200 como siempre pero una foto real de webcam no tiene marco magenta (`SIN_ROSTRO`) y una reconstrucción COMPLETA falla con fotos reales. Una reconstrucción completa cuesta N veces más (embebe todas las fotos de todas las plantillas); la incremental con `keep` no se afecta.

### 4.3 Rutas web (Route Handlers)

Todo Route Handler: autenticar, autorizar (`administrador`), validar (zod) y ejecutar; sin cambios en el esquema de autorización.

**Límites** (`lib/server/storage.js`): `MAX_FOTOS_PLANTILLA = 8` (techo duro compartido con SQL) y `MAX_PLANTILLA_BYTES_TOTAL = 9 MiB`; cada foto <= 5 MiB. El proxy de Next buferiza como máximo 10 MB por petición y TRUNCA en silencio (`proxyClientMaxBodySize`); las dos rutas pasan `maxMultipartBytes = 9 MiB + 64 KiB`, de modo que cualquier cuerpo mayor da 413 limpio y nunca un `formData` truncado. La web solo conoce el techo 8 (`DEMASIADOS_ARCHIVOS`) y deriva `FOTOS_INSUFICIENTES` del `minimo` que devuelve el servicio.

**`handle()`** (`lib/server/route.js`) soporta varios archivos con el mismo nombre. Spec en `archivos`: `{ campo, maxBytes, tipos, requerido?, multiple?: true, maxArchivos?, maxBytesTotal? }`. Con `multiple`, `form.archivos[campo]` es `[]` o un arreglo de `{ bytes, tipo, ext, contentType, size }` en orden de llegada. Sin `multiple`, dos o más archivos con ese nombre dan 422 `VALIDACION` ("Solo se admite un archivo en este campo."). Más de `maxArchivos`: 422 `DEMASIADOS_ARCHIVOS` (`details`: `campo`, `maximo`, `recibidos`); suma de bytes mayor que `maxBytesTotal`: 413 `ARCHIVO_DEMASIADO_GRANDE` (`details.campo`). Los errores por archivo (415 `TIPO_NO_PERMITIDO`, 422 `ARCHIVO_INVALIDO`, 413 `ARCHIVO_DEMASIADO_GRANDE`, archivo vacío 422) llevan `details: { campo, indice }` en campos `multiple`.

#### `POST /api/plantilla/verificar` (multipart)

Campos de texto (zod `verificarFotosCampos`): `id_alumno` e `id_consent`, enteros positivos. Archivos: `foto` (JPEG, heredado, opcional) XOR `fotos` (JPEG, repetido, 1 a 8). Ninguno o ambos: 422 `VALIDACION` (`details.campos` con `{ campo: 'fotos', mensaje }`).

- Con `foto`: respuesta idéntica a la anterior `{ rostros, un_solo_rostro, calidad: { brillo, nitidez, tamano_rostro_px, tamano_rostro, frontal }, motivo_rechazo }` más `motivo_codigo` (aditivo). No exige `id_alumno`.
- Con `fotos`: exige `id_alumno` e `id_consent` (422 `VALIDACION` si faltan) y llama primero a `exigirConsentimientoVigente` (el mismo helper del alta: `api_consentimientos_alumno`, `RN_13_CONSENTIMIENTO_AJENO` / `RN_13_CONSENTIMIENTO_NO_VIGENTE` 409), porque ahora se calculan embeddings y cosenos de identidad. Calcula el `sha256` de cada foto; las copias exactas NO se envían al servicio (este ve solo fotos únicas). Devuelve el JSON de `check-set` mapeado a las posiciones originales: `total` = fotos enviadas; cada `fotos[i]` lleva `calidad` con el alias `tamano_rostro` (si no es `null`) y `duplicada_de` (`null` o índice de la primera foto idéntica). Las copias salen `{ indice, estado: 'duplicada', rostros: null, un_solo_rostro: null, calidad: null, motivo_rechazo: 'Es igual a otra foto del envío.', motivo_codigo: 'DUPLICADA', coseno_resto: null, duplicada_de: <indice> }`. `aceptadas`, `suficiente`, `consistente`, `ambiguo`, `coseno_*`, `advertencias` y `umbral_coseno` son los del servicio (conjunto sin copias). No guarda nada.

#### `POST /api/alumnos/{id}/plantilla` (multipart, `maxDuration` 300)

Campos: `id_consent` (zod `plantillaCampos`, sin cambios) más `foto` XOR `fotos` repetido (1 a 8).

1. `exigirConsentimientoVigente` ANTES de procesar nada.
2. **n = 1** (`foto`, o `fotos` con un solo archivo): CAMINO HEREDADO sin cambios: calidad individual con 422 `FOTO_RECHAZADA` (su `details` añade `motivo_codigo`), subida y `api_plantilla_registrar` con los argumentos `{ p_id_alumno, p_id_consent, p_objeto_foto, p_ip }`, sin `p_fotos`. Es la salida para las personas que no superan el filtro estricto (la pantalla lo ofrece como "Registrar solo con esta foto (menos precisa)"). Esta ruta usa el criterio de frontal heredado, más estricto que el de conjunto: una toma aceptada en pantalla podría salir `FOTO_RECHAZADA` aquí con su motivo.
3. **n >= 2**: fotos de bytes idénticos (`sha256`): 422 `FOTOS_DUPLICADAS` (`details.duplicadas: [{ indice, de }]`). Luego `verificarFotosServicio` y validación de forma (`fotos.length === n` y `fotos[i].indice === i`, si no 502 `SERVICIO_RECONOCIMIENTO_ERROR` sin subir nada). Si alguna `fotos[i].estado != 'aceptada'`: 422 `FOTOS_RECHAZADAS` con `details { minimo, maximo, total, aceptadas, umbral_coseno, consistente, ambiguo, fotos: [{ indice, estado, motivo_codigo, motivo_rechazo, coseno_resto }] }`. Si todas son aceptadas pero `suficiente` es `false`: 422 `FOTOS_INSUFICIENTES` (`details { minimo: conjunto.minimo, recibidas: n }`). **El rechazo es estricto**: descartar en silencio ocultaría un error de captura (con 2 de 5 fotos ajenas el *outlier* sería la correcta). No se sube nada en ningún rechazo.
4. Subida: una ruta de servidor por foto (`rutaObjeto.registro(idAlumno)`, `uuid` distinto), `subirObjeto` en serie guardando las subidas; `api_plantilla_registrar` con `{ idAlumno, idConsent, objetoFoto: rutas[0], fotos: rutas.map((ruta, i) => ({ objeto_foto: ruta, calidad, coseno_resto })), ip }` (sin la clave `tamano_rostro` en `calidad`; `calidad` y `coseno_resto` se omiten si son `null`). **Transaccionalidad**: si falla cualquier subida o la RPC, se borran TODAS las ya subidas (`Promise.allSettled` sobre `eliminarObjetoSilencioso`) y se relanza el error original; solo quedarían huérfanos si el proceso muere entre subir y registrar (igual que con una foto).
5. `reconstruirSinFallar`: la plantilla ya registrada nunca se revierte por un fallo del índice; en ese caso `indice = { estado: 'pendiente', version: null, error: { code } }`.

Respuesta 201 (claves anteriores intactas más):

```json
{
  "id_plantilla": 41, "id_alumno": 17, "id_consent": 9, "activa": true, "indexada": false,
  "plantilla_archivada": 33, "fecha_registro": "2026-09-14T09:12:41-06:00",
  "requiere_reconstruccion": true, "n_fotos": 5,
  "indice": { "estado": "activada", "version": "v004", "total_vectores": 76 },
  "version": "v004",
  "muestra": { "total": 5, "usadas": 5, "descartadas": [ { "indice": 2, "motivo": "inconsistente", "coseno_resto": 0.21 } ],
               "coseno_min": 0.51, "coseno_medio": 0.74, "degradada": false }
}
```

`muestra` sale del elemento de `muestras` del build con ese `id_plantilla` (`null` si el índice no se reconstruyó o fue el camino heredado); el arreglo completo de `muestras` NO viaja al cliente.

| Código | Status | Cuándo |
|---|---|---|
| `FOTO_RECHAZADA` | 422 | n = 1 con calidad insuficiente (camino heredado) |
| `FOTOS_RECHAZADAS` | 422 | n >= 2 con alguna toma no aceptada |
| `FOTOS_INSUFICIENTES` | 422 | Todas aceptadas pero menos que el mínimo del servicio |
| `FOTOS_DUPLICADAS` | 422 | Fotos de bytes idénticos |
| `DEMASIADOS_ARCHIVOS` | 422 | Más de 8 fotos |
| `ARCHIVO_DEMASIADO_GRANDE` | 413 | Foto > 5 MiB, suma > 9 MiB o cuerpo mayor que `maxMultipartBytes` |
| `TIPO_NO_PERMITIDO` | 415 | Que no sea JPEG |
| `ARCHIVO_INVALIDO` | 422 | Archivo vacío o ilegible |
| `RN_13_CONSENTIMIENTO_AJENO` / `RN_13_CONSENTIMIENTO_NO_VIGENTE` | 409 | Consentimiento de otro alumno o no vigente |
| `SERVICIO_RECONOCIMIENTO_NO_DISPONIBLE` | 503 | El servicio no responde (el código de la ruta es este, no `RECONOCIMIENTO_NO_DISPONIBLE`) |
| `SERVICIO_RECONOCIMIENTO_ERROR` | 502 | Respuesta del servicio con forma inválida |

Los códigos de ruta se crean con status explícito y no se registran en `STATUS_POR_CODIGO` (como `FOTO_RECHAZADA`); no hay códigos SQL nuevos (`lib/api/errors.js` no cambia). Un 503 o un 502 no suben nada.

#### `GET /api/documentos/plantilla_foto/[id]`

Administrador. Igual que el de `plantilla` con `urlDeDocumento('plantilla_foto')`; la RPC asienta la consulta (RF-19) antes de firmar; URL de <= 300 s. Respuesta `{ tipo: 'plantilla_foto', id_registro, id_alumno, url, expira_en, vigencia_seg }`. La carpeta se llama exactamente `plantilla_foto`.

#### `lib/server`

- `recognition.js`: `verificarFotosServicio(blobs)` hace `POST /v1/photo/check-set` con `images` repetido (`timeoutMs` 30 000, 1 reintento) y valida la respuesta con zod (`esquemaConjunto`); `esquemaCalidadFoto` gana `motivo_codigo` (opcional, `null` por defecto); `esquemaBuild` gana `muestras` (opcional, `[]`) y `errores[].codigo`; `construirIndice` acepta entradas `{ objetos_foto }`.
- `indice.js`: `entradasDeBuild` emite `keep` si `en_base`; `{ objetos_foto }` solo si hay más de una; con una foto emite `{ objeto_foto }` como antes. `reconstruirIndice` devuelve también `muestras` en `activada`; `reconstruirSinFallar` las propaga (`{ estado, version, total_vectores, muestras }`). Un build con errores (por ejemplo `SIN_MUESTRAS_UTILIZABLES`) cae en `INDICE_CONSTRUCCION_FALLIDA` con `details.errores` (`id_plantilla`, `motivo`, `codigo`).
- El servidor NO quita metadatos EXIF (re-escribir un JPEG con orientación EXIF rompería el `exif_transpose` del servicio): la pantalla re-codifica cada foto (sin EXIF) y las subidas por API directa pueden conservarlo en el bucket privado.

### 4.4 Archivado y borrado de fotos (lo que dice el código)

- "Archivar" = `plantilla_facial.activa = false`, y solo ocurre en `api_plantilla_registrar` (reemplazo) y en `api_consentimiento_revocar`. `app.vencer_consentimientos` NO archiva: la plantilla de un consentimiento vencido sigue activa y `svc_indice_plan` la sigue incluyendo con sus fotos.
- Ninguna ruta borra fotos del bucket al archivar (§3.4: la foto anterior NO se borra); la purga RNF-05 solo cubre recortes; todas las FK son `RESTRICT`. El único borrado es la compensación `eliminarObjetoSilencioso` cuando falla el registro.
- Las fotos extra siguen exactamente esa semántica: no tienen bandera propia, su estado es el de la plantilla padre; al archivar o revocar permanecen en la tabla y en el bucket; `svc_indice_plan` solo entrega fotos de plantillas ACTIVAS; la compensación borra TODAS las fotos subidas del intento.
- **Brecha de retención** (preexistente, multiplicada por N con varias fotos; CERRADA por la extensión 18, ver §4.6 y `docs/DECISIONS.md` §8): consulta de fotos de plantillas archivadas: `SELECT pf.objeto_foto FROM plantilla_foto pf JOIN plantilla_facial p USING (id_plantilla) WHERE NOT p.activa` (y, para consentimientos revocados o vencidos, `JOIN` con `consentimiento` por estatus). Seguimiento comprometido: un job `svc_job_purgar_fotos_archivadas` (listar, borrar objetos, marcar) con parámetro de retención; no se implementa aquí para no cambiar la semántica de archivado (RN-12). Ver `docs/DECISIONS.md` y `docs/RUNBOOK.md`.

### 4.6 Fotos de registro efímeras (extensión 18)

- `reconstruirIndice` (`lib/server/indice.js`), al final y solo si todo salió bien (tras `activarIndice` en el servicio), llama a `purgarFotosRegistro` (`lib/server/fotosRegistro.js`) con los `id_plantilla` de las
  entradas nuevas del build. El resultado trae `fotos_purgadas` (objetos borrados, o `null` si el borrado falló). **Un fallo del borrado no invalida la activación**: el índice ya está en uso y el job lo reintenta.
- El borrado solo acepta rutas con la forma `registro/<id>/<uuid>.jpg` (`validarRutaObjeto`); cualquier otra se marca pero no se borra.
- `POST /api/jobs/purgar-fotos-registro` (Bearer `CRON_SECRET`, `GET` y `POST`): barrido sin `p_ids`. Toma el bloqueo **del índice** (clave `indice`), no uno propio, para no correr mientras se reconstruye o revierte.
  Respuesta `{ job, estado: 'ok', lotes, plantillas, objetos_borrados, marcadas, rutas_invalidas, pendientes_total, duracion_ms }` (o `estado: 'omitido'` si el bloqueo está ocupado).
- Códigos de ruta nuevos (status explícito, no están en `STATUS_POR_CODIGO`), ambos 409 y con `details.plantillas: [{ id_plantilla, id_alumno }]`:

| Código | Dónde | Cuándo |
|---|---|---|
| `PLANTILLAS_SIN_FOTO` | `reconstruirIndice` (también `POST /api/indice/reconstruir` y el job `reconstruir-indice`) | Alguna entrada que hay que construir desde su foto ya no la conserva (reconstrucción completa o cambio de dimensión sobre plantillas ya indexadas). Se rechaza antes de llamar al servicio. `details.fase = 'plan'` |
| `REVERSION_PERDERIA_PLANTILLAS` | `revertirIndice` (`POST /api/indice/revertir`) | La versión destino no conoce una plantilla activa que ya no conserva su foto: quedaría sin vector. `details.fase = 'verificacion'` |

- `FOTO_NO_CONSERVADA` (SQL) llega como HTTP 410 en `GET /api/documentos/plantilla/[id]` y `GET /api/documentos/plantilla_foto/[id]`; `lib/api/errors.js` lo registra en el grupo 410.

### 4.5 Compatibilidad y orden de despliegue

- **Orden obligatorio: SQL, servicio, web.** Un servicio viejo rechaza con 422 las entradas `objetos_foto` (solo si ya existen plantillas multifoto). `scripts/db-up.sh` aplica `0235` una sola vez; es inocuo con el web y el servicio viejos (4 argumentos y una sola foto siguen funcionando). En modo local, el adaptador cachea el catálogo de funciones 60 s: tras migrar, reinicia el Next o espera más de 60 s, o la llamada con `p_fotos` falla con `PGRST202`.
- **Plantillas existentes de una foto**: sin migración manual. El *backfill* y el trigger les dan su fila `orden = 1`; siguen en `keep` con su `faiss_id`; una reconstrucción completa las trata como entrada de una foto (sin promedio). Para pasar a 5 fotos se registra de nuevo (la anterior se archiva por RN-12); el panel lo sugiere.
- Otros contratos intactos: `api_consentimiento_revocar`, `svc_indice_registrar`/`activar`/`revertir`/`en_uso`, `api_indice_estado`, `svc_job_reconstruir_indice`, `api_alumno_obtener` y `api_detecciones_caso` (`objeto_foto_registro` es la foto principal de la plantilla activa).
