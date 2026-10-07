# SUSAN — decisiones y desviaciones respecto a la especificación

Fuente funcional: `docs/spec/Avance1.pdf` (1er avance). Aquí queda lo que se **añadió o cambió** y por qué, lo que se decidió
técnicamente y lo que sigue abierto. El SQL (`supabase/`) y `docs/API-RPC.md` son la fuente de verdad del contrato.

## 1. Extensiones y desviaciones respecto a la spec

| # | Cambio | Motivo |
|---|---|---|
| 1 | `estatus_sesion` incluye **`suspendida`**; se excluye del denominador de RN-11 | La spec (§4.3) lo propone como salida al riesgo de festivos/ausencias del docente; sin él el porcentaje de faltas se subestima. Hay `api_suspender_sesion` / `api_reanudar_sesion`. |
| 2 | **`camara.tipo`** (`ip` \| `navegador`) y `ck_camara_ip`; `direccion_ip` solo obligatoria para `ip` (30 CHECK en vez de 29) | Permite usar la webcam del equipo del docente como cámara del aula (único modo probable en un piloto sin cámaras IP). |
| 3 | Parámetro 12 **`minutos_pase_lista_base`** (5) | Solo para estimar el tiempo de clase recuperado (objetivo del proyecto). Es una **estimación**; la spec dice que el ahorro real se mide en el aula. |
| 4 | **`score_similitud = (coseno + 1) / 2`**, recortado a [0,1], 3 decimales | Con coseno crudo de ArcFace, el umbral 0.850 casi nunca se alcanzaría en pares genuinos; con esta normalización 0.850 ≈ coseno 0.70. El umbral sigue siendo un parámetro calibrable. |
| 5 | **Análisis por métodos numéricos** (`web/src/lib/numerics`, `/analitica`) | Objetivo del proyecto (identificar patrones de ausentismo y orientar la intervención docente); no está en el 1er avance. Ver `docs/NUMERICS.md`. |
| 6 | Importación masiva de inscripciones por CSV (`api_importar_inscripciones`) | Herencia de `importGroup` de SmartClass. |
| 7 | Triggers rechazan con `ERRCODE 23514` + `CONSTRAINT = <regla>` (`rn01_…`), la bitácora con `23000` | La spec solo pide "el nombre de la regla" en el rechazo. La capa de datos lo mapea a códigos `RN_xx`. |
| 8 | `app.now()/hoy()/tz()` viven en `0001` y no en `0010`; el reloj simulado exige `app.allow_fake_clock='on'` a nivel de **base de datos** | Varios `DEFAULT` de las tablas usan `app.now()`. Nunca se activa en Supabase real. |
| 9 | `api_reporte_periodo` e `api_impacto_tiempo` también para el docente (solo sus grupos) | P-07 los necesita; el docente ya ve esos datos por RLS. |
| 10 | `nombre_completo` con formato `Apellido Paterno Apellido Materno Nombres` (sin coma) | Un solo formato en todo el sistema. |
| 11 | Apertura de sesión: `hora_inicio <= app.now() < hora_fin`; el pase manual sugiere `ausente` pasada la tolerancia; el cierre anticipado también aplica a sesiones manuales | Reglas que la spec deja implícitas; documentadas en `COMMENT ON FUNCTION`. |
| 12 | La suspensión/reanudación de sesión se asienta en bitácora como `correccion` sobre `sesion_clase` | `accion_bitacora` tiene exactamente 8 valores (la spec los fija) y no se amplió. Los listados de correcciones filtran `entidad = 'asistencia'`. |
| 13 | Prefijo de recortes `recortes/{id_sesion}/{id_camara}-{epochMs}/{n}.jpg` | El servicio sube el recorte antes de que exista `id_captura`. La purga se guía por `deteccion.objeto_recorte`. |
| 14 | Tope del bucket 50 MiB (`0091`) | Índice FAISS en JSON de ~20 000 plantillas ≈ 55 MB (RNF-09). |
| 15 | Cuenta de servicio `servicio@susan.local` (rol `tecnico`, sin fila en Auth) | Los jobs asientan en bitácora (RN-08) sin inventar un usuario humano. Se oculta de las listas. |
| 16 | QR (de SmartClass) **no** se incluye | La spec no lo contempla; el respaldo del reconocimiento es el pase de lista manual (RF-09). |
| 17 | Tabla **`plantilla_foto`** (20.ª tabla; la spec tiene 19) y plantilla de **3 a 8 fotos promediadas** en un solo vector | Una foto sola da cosenos de 0.4–0.7 con fotos de salón y un mal registro no tiene salvaguarda. Con 5 fotos las lecturas bajo el umbral bajan a la mitad frente a una foto frontal buena y de 22.8 % a 3.7 % frente a una foto cualquiera (nivel duro). Se conserva RN-12: una fila activa de `plantilla_facial` y un `faiss_id`. Detalle en la sección 6. |
| 18 | Las **fotos de registro son efímeras**: se borran del bucket en cuanto su vector queda en el JSON del índice en uso; `objeto_foto` admite NULL | Guardar un rostro que ya no se usa para nada es retención innecesaria de un dato biométrico (RNF-03). El único lector de la foto es la construcción del índice, así que se borra justo después de activar la versión que la contiene. Los recortes de la sesión NO cambian (evidencia de la revisión, RNF-05). Detalle en la sección 8. |

## 2. Decisiones técnicas

- **Solo RPC**: toda lectura/escritura de la app pasa por funciones `api_*` (usuario, RLS) o `svc_*` (servidor, `service_role`); nunca `.from('tabla')`. Da contrato explícito, transacciones y ejecución idéntica en modo local.
- **Modo local sin Docker**: PostgreSQL 16 directo + disco (`SUSAN_LOCAL=1`). Las migraciones son idénticas a las de Supabase; solo cambia el transporte (`web/src/lib/local`, rutas `api/%5Flocal`, cerradas en producción).
- **Índice FAISS en el bucket como JSON** (`susan-faiss-json/1`, vectores float32 en base64): `IndexIDMap2(IndexFlatIP)` en memoria con búsqueda restringida por `IDSelectorBatch` (RF-04). Búsqueda exhaustiva de 20 000×512 ≈ 1 ms (RNF-01 pide ≤ 50 ms). Cambio de versión atómico en una sola transacción (RN-12/RNF-09).
- **Embedder enchufable** (`EMBEDDER=insightface|fake`): `insightface` (buffalo_s, ArcFace 512-d) para uso real; `fake` determinista para pruebas. **Licencia**: los modelos preentrenados de InsightFace son de uso no comercial.
- **Lógica de negocio en PostgreSQL**: ciclo de vida de la asistencia (triggers + RPC), RN-10/RN-11 reversibles, jobs idempotentes.
- **Diseño visual mínimo** a petición: tokens semánticos en `web/src/app/globals.css`; el rediseño cambia esos valores y los componentes de `components/ui`.
- **Seguridad**: contraseñas solo en Supabase Auth; `service_role` solo en servidor; objetos del bucket solo por URL firmada ≤ 300 s; cada consulta de recortes/documentos se asienta en bitácora **antes** de firmar (falla cerrado); sin vectores ni imágenes en tablas ni logs.

## 3. Abierto / riesgos

1. **Calibración** del umbral (0.700 desde 2026-10-03; antes 0.850, ver RUNBOOK), mínimo de lecturas (3) e intervalo (15 s) con datos reales: viven en `parametro_sistema`; cada detección conserva candidato y score aunque no alcance el umbral.
2. **Sin detección de vida** (anti-spoofing): el riesgo de suplantación con fotografía sigue abierto; lo atenúan la cola de revisión y las 3 lecturas en capturas distintas.
3. **Jurídico**: aviso de privacidad, formato/vigencia/revocación del consentimiento deben aprobarse por el área jurídica de la UNACH (LPDPPSOCH, LGPDPPSO). Mientras tanto, quien no consiente se registra por pase manual.
4. Pendiente: pruebas de **concurrencia** con dos sesiones (corrección simultánea, doble justificante, doble cierre; el diseño usa `FOR UPDATE`/`SKIP LOCKED` e índices únicos parciales).
5. Pendiente: **bitácora de altas/bajas de catálogo y de creación/restablecimiento de cuentas** (el enum de acciones no tiene valores propios) y `svc_usuario_obtener`.
6. Pendiente: sesiones `programada` que nunca se abren cuentan en el denominador y no generan registros (diseño de referencia R5).
7. El servicio guarda el índice en **memoria de un proceso**: con varias instancias hay que activar la versión en cada una.
8. Piloto en 1–2 grupos y prueba SUS (RNF-11); variante de 360 px verificada en pantallas, no con usuarios.
9. **Credenciales expuestas fuera de este repo**: `MVP-Project-Unach/microService-faiss/main.py` tiene una key de Backblaze B2 escrita en el código (y commiteada). No se copió a SUSAN; hay que **rotarla**. SmartClass guarda la contraseña en `localStorage` y la envía en cada petición: no se imitó.
10. **Plantilla multifoto, retención de fotos archivadas** (brecha preexistente que la mejora multiplica por N): ninguna ruta borra fotos del bucket al archivar y `vencer_consentimientos` ni siquiera archiva; la purga RNF-05 solo cubre recortes. Consulta exacta de las fotos de plantillas archivadas: `SELECT pf.objeto_foto FROM plantilla_foto pf JOIN plantilla_facial p USING (id_plantilla) WHERE NOT p.activa` (y, para consentimientos revocados o vencidos, `JOIN` con `consentimiento` por estatus). Seguimiento: job `svc_job_purgar_fotos_archivadas` (listar, borrar objetos, marcar) con parámetro de retención.
11. **Reconstrucción COMPLETA del índice con varias fotos**: re-embebe todas las fotos (N veces el cómputo): 20 000 plantillas × 5 × 17 ms ≈ 28 min frente al objetivo de 10 min de RNF-09 y el timeout de 300 s de `construirIndice`. Solo aplica a `completa = true`; el incremental con `keep` no se afecta.
12. **Calibración del umbral de consistencia con fotos independientes reales**: pendiente (ver sección 6). Mientras tanto es variable de entorno y cada foto expone su `coseno_resto`.
13. **Mezclas balanceadas de dos personas**: el filtro no detecta que TODAS las fotos sean de otra persona (como con una foto). Las mezclas 3+3, 4+4 y 5+5 de dos personas con fotos muy coherentes (coseno intra ~0.8, cruce ~0.07) pasaban la media de pares justo en el umbral (hallazgo de la revisión final, reproducido con rostros reales): se añadió el enlace de grupo `TEMPLATE_LINK_COSINE = 0.30`, que las detecta (0-0.5 % pasan en los tres niveles de calibración, sin rechazos genuinos adicionales). Sigue sin detectarse un conjunto donde TODAS las fotos son de otra persona.
14. **`MAX_CONSENTIMIENTO_BYTES` (10 MiB) frente al tope de 10 MB del proxy de Next**: un PDF cercano al máximo falla como 400. Hallazgo preexistente, fuera del alcance de la plantilla multifoto.

## 4. Revisión de seguridad y endurecimiento (informes en `docs/review/`)

Tres revisiones independientes (SQL/RLS, web, y modo real de Supabase contra un servidor simulado fiel `scripts/fake-supabase.mjs`) más una validación numérica contra scipy
(`web/src/review/numerics_referencias.test.js`, 27 pruebas) y una auditoría de privilegios sobre la base. **Sin bloqueantes.** Resultado y estado:

| Hallazgo | Severidad | Estado |
|---|---|---|
| Sin cabeceras de seguridad HTTP | major | **Corregido** (`next.config.mjs`: X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy; CSP + HSTS en producción; `poweredByHeader: false`). Verificado con build de producción en navegador (sin violaciones de CSP). |
| El limitador de captura no limitaba repetir `marca_tiempo` | major | **Corregido** (máx. 2 reenvíos gratuitos por marca) |
| Caída/lentitud de Auth se trataba como "sin sesión" y expulsaba al usuario | major | **Corregido** (503 `AUTH_NO_DISPONIBLE`; el proxy no redirige) |
| Recuperación de contraseña solo funcionaba en el mismo navegador (PKCE) | major | **Corregido** (`/auth/confirm` + `verifyOtp` en servidor; plantillas en `docs/SUPABASE_SETUP.md`) |
| SSRF: faltaba bloquear `100.64.0.0/10` y metadatos de Alibaba | minor | **Corregido** (`recognition-service/app/camera.py`, pruebas nuevas) |
| `serverEnv()` publicaba el secreto HMAC por defecto del modo local en el bundle | minor | **Corregido** (sin valor por defecto en producción) |
| Operaciones sensibles sin asiento de bitácora (cambio de rol/estatus de cuenta, revocar consentimiento, baja de alumno, asistencia manual con hora retroactiva) | major (endurecimiento; la spec exige RNF-08 solo para correcciones, justificantes, parámetros y consultas biométricas) | **Pendiente**: requiere ampliar el enum `accion_bitacora` (la spec fija 8 valores) y llamar `app.bitacora` en esas RPC. Pruebas que lo documentan: `supabase/tests/review_sql_04_auditoria.sql` (`HALLAZGO:`). |
| La IP de la bitácora la declara el propio llamador (`p_ip`) en 3 RPC | minor | **Pendiente**: ignorar `p_ip` salvo `service_role`; implica que los handlers usen `svc_*` para registrar consultas. Mitigación actual: el proxy debe sobrescribir `x-forwarded-for` (RUNBOOK). |
| Cookie de sesión de Supabase en modo real no es HttpOnly (la fija `createBrowserClient`) | minor | **Aceptado**: es el diseño de `@supabase/ssr`; mitigado con CSP. |
| 2–3 viajes a Auth por petición (`getUser` en proxy y handler) | minor | **Pendiente** (optimización: `getClaims()`/excluir `/api/*` del proxy) |
| Modo local: logout no invalida el token (8 h) y login sin límite de intentos | minor | **Aceptado** (solo desarrollo; ver `docs/review/web.md`) |

Resistieron (verificado): IDOR en las 72 RPC con ids ajenos, privilegios (`anon` sin acceso, ningún `svc_*` para usuarios, ningún `SECURITY DEFINER` sin `search_path`, sin escritura directa, RLS en 19 tablas),
reloj simulado inmanipulable por un usuario, bitácora inmutable, inyección vía `p_q`/`jsonb`, subidas por firma binaria, rutas de objetos, jobs sin `CRON_SECRET` (503 nunca 200),
open redirect en `?next=`, inyección de fórmulas en CSV, secretos fuera del bundle del cliente, reglas de la spec en sus casos límite (9:59/10:00, 20:00/20:01, 0.849/0.850, 47 h/49 h,
48 sesiones: 9 vs 10 faltas, zona horaria cerca de medianoche UTC).

## 5. Gráficas hechas a mano en lugar de shadcn/recharts (F11, 2026-10-03)

- **Contexto**: la fase F10 llevó las gráficas a las pantallas densas con el componente `chart` de shadcn/ui sobre recharts (`GraficaDona`, `GraficaBarras`, y las de Analítica). El usuario rechazó el aspecto y pidió otra familia;
  se compararon lado a lado en una página temporal (actual vs. nuevo, con animaciones de entrada) y aprobó aplicar **en toda la app** las gráficas dibujadas a mano con SVG y CSS. Además de lo estético, recharts pesaba ≈ 130 KB gzip y obligó
  a cargarlo con `next/dynamic` (patrón `*Impl.jsx`, alto reservado, sin SSR y un shim síncrono para las pruebas) para no romper el presupuesto de `/docente`.
- **Decisión**: una familia propia en `web/src/components/ui/` sin librerías de gráficas: `AnilloEstados` (estados), `BarrasPildora` (rankings y comparaciones), `BarraSegmentada` (composición en tablas), `TiraSemana` (patrón semanal en mapa de calor),
  `Sparkline` y `StatCard` con `serie` (cifras clave, **solo con una serie real**, nunca inventada), `MedidorLiquido` sobre `motion/SloshGauge` (**solo** sesión en vivo y vista del alumno) y `GraficaLinea` (evolución en el tiempo).
  `AnilloEstados` y `BarrasPildora` conservan la API de props de `GraficaDona` y `GraficaBarras`. Reglas, tabla de decisión y contratos en `docs/design/SISTEMA.md`; geometría pura con pruebas en `web/src/lib/graficasGeometria.js`.
  Se retiran `GraficaDona`, `GraficaBarras`, `components/shadcn/chart.jsx`, `useDatosEstables`, el patrón `next/dynamic` + `*Impl.jsx` y `recharts`.
- **Alternativas descartadas**:

  | Alternativa | Por qué no |
  |---|---|
  | Seguir con shadcn `chart` / recharts (lo de F10) | El usuario rechazó su aspecto; ≈ 130 KB gzip que obligaron a diferir la carga y a mantener `*Impl` y el shim de pruebas; con datos vivos recharts reinicia su animación (hizo falta `useDatosEstables` para evitarlo) |
  | React Bits (versión gratuita) | No trae gráficas de datos. Solo se aprovechó el componente Slosh Gauge, adaptado (tokens, «reducir movimiento», pruebas) y con atribución en el archivo, como base de `MedidorLiquido` |
  | React Bits Pro (de pago) | Licencia y dependencia externas de pago para un proyecto universitario; aun así habría que adaptarlo a los tokens, a 360 px, a «reducir movimiento» y a la hidratación, que es justo el trabajo de hacer las piezas propias |

- **Consecuencias**:
  - **Peso**: desaparece el chunk de recharts (≈ 130 KB gz) y con él el patrón `next/dynamic`/`*Impl`; las gráficas se importan de forma estática y no suman dependencias. Peso F11 por ruta, medido el 2026-10-03 (tabla en «Presupuesto de rendimiento» de `docs/DESIGN_PROGRESS.md`): al ir en el JS inicial, `/docente` quedó en **257,7 KB gz (+23,1 %)**, fuera del presupuesto de 240,7; se recuperó a **226,1 KB gz (+8,0 %)** con la carga diferida de la sección 7.
  - **Mantenimiento propio**: ahora el tooltip, el teclado (`GraficaLinea`), la accesibilidad y la geometría son código del proyecto; a cambio están cubiertos por pruebas y se controlan a medida.
  - **Migración**: `AnilloEstados` y `BarrasPildora` entran con cambios menores respecto a las anteriores: la leyenda escribe «<1 %» (no «0 %») para un valor positivo muy pequeño, `unidad` sale en la cifra de cada fila o columna, y en `horizontal` el alto lo dan las filas (se ignora `alto`).
    `GraficaLinea` sustituye a las implementaciones de recharts de `analitica/GraficaSerie` y `analitica/GraficaAcumulado` (los componentes de Analítica se conservan). Las pruebas de pantalla que contaban `listitem` o textos exactos se actualizan con cada migración.
  - **Movimiento**: la regla «solo `transform`/`opacity`» tiene excepciones documentadas para estas gráficas (`clip-path`, trazos SVG y transiciones breves al actualizar datos vivos); siguen apagadas con «reducir movimiento».
  - **Riesgos conocidos**: contraste de ~3,9:1 en las casillas más intensas de `TiraSemana` en tema oscuro; cada `GraficaLinea` monta su copia de los fotogramas CSS (`<style>`, que la CSP permite con `style-src 'unsafe-inline'`).
  - **Contratos**: los contratos de datos (RPC, JSON, rutas) de `docs/API.md` y `docs/api/*.md` no cambian; es solo capa de presentación. Solo se actualizó la descripción de componentes y gráficas de `docs/api/reportes-analitica.md` (§2.3: recharts por la familia hecha a mano).

## 6. Plantilla de varias fotos (extensión 17)

- **Contexto**: la plantilla era UNA foto y UN vector. La pregunta fue si no sería mejor sacar varias fotos y promediar. Medido con rostros reales, una foto cualquiera de registro (con pose y expresión) da coseno 0.693 con las sondas de aula y 1.76 % de lecturas bajo 0.40 (nivel medio), 22.8 % en el nivel duro; y el esquema anterior no tenía salvaguarda ante una mala foto de registro.
- **Qué se hizo**: una plantilla = **3 a 8 fotos** (5 guiadas: de frente, giro a la izquierda, giro a la derecha, inclinación hacia arriba, otra expresión o luz) cuyos embeddings L2 se promedian (centroide, re-normalizado) en el servicio de reconocimiento. Contrato completo en `docs/api/biometria.md` §4.

### 6.1 Decisiones

| Decisión | Razón |
|---|---|
| **Centroide (UN vector, UN `faiss_id`), no galería de vectores** | Conserva RN-12 y todo el flujo del índice (`keep`, mapeo, activación atómica, FAISS `IndexFlatIP` con N vectores = N plantillas). Una galería multiplicaría el índice y el costo de búsqueda por 5, rompería el mapeo 1:1 `faiss_id`–`id_plantilla` y obligaría a agregar el score por alumno. El centroide cuesta N veces más solo al construir una plantilla nueva. |
| **El promedio y el descarte ocurren en el servicio** | El vector solo puede vivir en memoria y en el JSON del índice (RNF-03). La BD guarda rutas, 4 medidas de calidad y un coseno escalar por foto (`coseno_resto`). |
| **Modelo de datos**: fila única de `plantilla_facial` + tabla hija `plantilla_foto` (migración `0235`); la principal es `orden = 1` | Un `jsonb` o arreglo dentro de `plantilla_facial` rompe la 3FN, pierde la FK y el borrado por objeto, y `0006`/RNF-03 prohíben columnas de arreglo. Costo asumido: 20.ª tabla y 7 aserciones de `schema_01` que pasan de 19 a 20. Invariante por trigger: toda plantilla tiene su fila `orden = 1`, así los lectores no distinguen plantillas heredadas de nuevas. |
| **Las fotos rechazadas no se suben ni se guardan** (sin columna `incluida`) | Minimiza datos biométricos y evita guardar el rostro de un tercero (un *outlier* suele ser otra persona). |
| **Rechazo estricto al registrar + escape de UNA foto** | Si alguna foto no pasa calidad o consistencia la ruta responde 422 `FOTOS_RECHAZADAS` con el estado de cada foto y no sube nada: descartar en silencio ocultaría un error de captura (con 2 de 5 fotos ajenas el *outlier* sería la correcta). Como existen personas difíciles (con coseno foto-foto medio 0.50 se rechazó el 40 % de los conjuntos de 5 al umbral 0.35 en el nivel duro), se conserva el camino heredado de una foto (campo `foto`), ofrecido como acción secundaria "Registrar solo con esta foto (menos precisa)". |
| **Criterio de consistencia: coseno MEDIO de cada foto contra las demás, umbral `TEMPLATE_OUTLIER_COSINE = 0.35`** | El criterio inicial (coseno contra el centroide de las demás con 0.50) infla el coseno cuando las demás son una mezcla de dos personas (el centroide pierde norma) y dejaba pasar conjuntos balanceados 3+3 y 4+4: entre el 17 y el 25 % al umbral 0.45. La media de pares los detecta (4.7 % y 5.9 % a 0.35; 0.4 % y 0.5 % a 0.40, nivel medio) y no divide por normas, así que no hay NaN por suma casi nula. Algoritmo: mientras queden más de 2 fotos, descarta la peor si su media está bajo el umbral y repite; ambiguo = quedan 2 con coseno mutuo bajo el umbral, o descartadas >= usadas; en un conjunto ambiguo TODAS pasan a `inconsistente`. |
| **Mínimo 3, guiadas 5, máximo 8** (una sola fuente de verdad) | Con 3 fotos se logra el 45–55 % de la ganancia de 8 y con 5 el 79–81 % (de 5 a 8 solo +0.007 de coseno medio). SQL fija 3 a 8; `Settings.validate()` exige `3 <= TEMPLATE_MIN_PHOTOS <= TEMPLATE_MAX_PHOTOS <= 8`; la ruta web solo conoce el techo 8 y deriva `FOTOS_INSUFICIENTES` del mínimo que devuelve el servicio. |
| **Constructor del índice defensivo** (umbral propio `TEMPLATE_BUILD_OUTLIER_COSINE`, defecto `min(0.25, TEMPLATE_OUTLIER_COSINE)`; solo falla si NINGUNA foto es utilizable) | El registro es el filtro estricto; el constructor solo se defiende de fotos corruptas o ajenas de verdad. Así una plantilla mala no bloquea jamás el índice ni las revocaciones (el índice es todo o nada ante errores). Con 1 o más fotos utilizables indexa el centroide y lo informa (`degradada`). |
| **`keep` no se renormaliza** | Re-normalizar un centroide ya normalizado cambia bits en el 34 % de los casos (109 de 320) y la suma en `float32` depende del orden en el 100 %. Por eso `build_index` solo normaliza las filas NUEVAS y las `keep` quedan idénticas a la base; el centroide se calcula en `float64`. |
| **Razón de giro compensada por la inclinación de la cabeza** (`TEMPLATE_MAX_YAW_RATIO = 0.40`, unos 36 grados) | La heurística heredada usa solo la coordenada `x` de la nariz y confunde inclinación con giro (un rostro con yaw +7 y roll −25 daba 0.282; otro con yaw −36 daba 0.079). La compensada correlaciona 0.91 con \|yaw\| 3D frente a 0.60 de la heredada y se ajusta a `0.55·tan(yaw)`. El booleano `frontal` heredado de `/v1/photo/check` no cambia. |
| **Verificar con varias fotos exige consentimiento vigente** | Ahora se calculan embeddings y cosenos de identidad: `/api/plantilla/verificar` en modo `fotos` reutiliza `exigirConsentimientoVigente` antes de llamar al servicio. |
| **Duplicados detectados temprano** | `sha256` de los bytes: las copias exactas se excluyen del análisis (estado `duplicada`) y el alta responde 422 `FOTOS_DUPLICADAS`. Los fotogramas casi idénticos (ráfaga, cosenos >= 0.97) solo se avisan con `DIVERSIDAD_BAJA`. |
| **Servidor sin estado en la captura** | La pantalla envía TODAS las fotos sostenidas en cada verificación (~17 ms de CPU por foto); el resultado se aplica por el instantáneo de ids de esa petición. |
| **Límite de 10 MB del proxy de Next** | El proxy buferiza máximo 10 MB por petición y TRUNCA en silencio. Tope duro del multipart: 9 MiB (cada foto <= 5 MiB, `maxMultipartBytes = 9 MiB + 64 KiB` para un 413 limpio); la pantalla re-codifica cada foto a JPEG <= 1280x960 (~300 KB) y rechaza la foto si no puede normalizarla (no se sube el original, que podría llevar EXIF con GPS). El servidor no quita metadatos: re-escribir un JPEG con orientación EXIF rompería `exif_transpose`. |
| **Compatibilidad** | `api_plantilla_registrar` gana `p_fotos` (5.º parámetro opcional; `DROP` de la firma de 4 y `CREATE` de la de 5, porque un *overload* haría ambigua la llamada por nombre). Sin `p_fotos` todo es idéntico. Las plantillas de una foto siguen funcionando sin migración manual (trigger + *backfill*). Orden de despliegue: SQL, servicio, web. |

### 6.2 Archivado y borrado (hallazgo verificado en el código)

> Actualización: la extensión 18 (sección 8) borra las fotos de registro al indexarse y el job `purgar-fotos-registro` limpia las de plantillas archivadas; lo que sigue describe el estado previo.

"Archivar" es solo `plantilla_facial.activa = false`, en `api_plantilla_registrar` (reemplazo) y en `api_consentimiento_revocar`. `vencer_consentimientos` NO archiva (la plantilla vencida sigue activa y sigue en el índice). Ninguna ruta borra fotos del bucket al archivar y la purga RNF-05 solo cubre recortes; todas las FK son `RESTRICT`; el único borrado es la compensación `eliminarObjetoSilencioso` si falla el registro. Las fotos extra replican EXACTO esa semántica: su estado es el de la plantilla padre y la compensación borra todas las subidas del intento. La brecha de retención y su seguimiento están en la sección 3 (punto 10).

### 6.3 Calibración y ganancia esperada

Método y limitaciones: `buffalo_s` real (el embedder del servicio) sobre 8 personas distintas (los 6 rostros del grupo de ejemplo de InsightFace, `skimage.data.astronaut()` y la imagen de ejemplo `Tom_Hanks_54745`), con 40 réplicas por persona; cada réplica es una SESIÓN de plantilla (8 tomas, la 1 de frente y suave como la foto única actual) y una SESIÓN distinta de 6 sondas de aula, con tres niveles de variación por foto (suave, medio, duro; 4 480 embeddings por nivel). **Son variantes de UNA foto por persona** (no hay en local fotos independientes de la misma persona y no se descargó ningún dataset), las homografías no reproducen el relieve 3D y la muestra efectiva son 8 identidades (28 pares): por eso el umbral se trata como hipótesis, hay tres niveles y se instrumenta la respuesta.

- **Coseno entre fotos de la misma persona** (media / p5), misma sesión: suave 0.896 / 0.783, medio 0.747 / 0.525, duro 0.585 / 0.293; entre sesiones: 0.851, 0.702, 0.541. **Entre personas distintas**: media 0.023–0.035, p99 0.196–0.208, p99.9 0.236–0.264, máximo de un par 0.272 / 0.347 / 0.324. Contra el centroide de 5 fotos el máximo de un impostor sigue en 0.254–0.291: el centroide no eleva sistemáticamente al impostor y queda al menos 0.10 bajo el coseno 0.40 (score 0.700). El 0.35 queda por encima del p99.9 entre personas distintas (0.264).
- **Rechazo de un conjunto genuino** (estricto), umbral 0.25 / 0.30 / 0.35 / 0.40 / 0.45 / 0.50. Nivel medio, N = 3: 0 / 0 / 0 / 0.3 / 0.9 / 1.9 %; N = 5: 0 / 0 / 0 / 0.6 / 1.6 / 3.8 %; N = 8: 0 / 0 / 0.3 / 1.3 / 2.2 / 6.3 %. Nivel duro (estrés), N = 5: 2.2 / 5.1 / 14.6 / 25.9 / 40.8 / 55.7 %. Conclusión: 0.35 por defecto, 0.30 para poblaciones difíciles, y el escape de una foto.
- **Detección de contaminación** con solo la media de pares a 0.35 (% que pasa sin detectarse, nivel medio; el enlace `TEMPLATE_LINK_COSINE` 0.30 lo lleva a 0-0.5 %): 1 ajena entre 2, 3 o 4 propias, 0 %; 3 propias + 2 ajenas, 0.2 %; mezclas balanceadas 2+2, 3+3 y 4+4: 1.8 / 4.7 / 5.9 % (0.1 / 0.4 / 0.5 % a 0.40). En el nivel suave (fotos casi idénticas, coseno 0.9) una mezcla 3+3 pasa el 53 % a 0.35 y el 14 % a 0.40 con solo la media: por eso existe el enlace de grupo (0.2 % en suave con enlace 0.30).
- **Ganancia honesta** (sondas de aula contra la plantilla, sesión distinta; nivel medio, coseno medio / p5 / lecturas bajo 0.40): una foto cualquiera 0.693 / 0.471 / 1.76 %; una foto de frente 0.762 / 0.564 / 0.26 %; centroide de 3 0.777 / 0.590 / 0.16 %; de 5 0.788 / 0.602 / 0.10 %; de 8 0.795 / 0.611 / 0.10 %. Nivel duro: foto cualquiera 0.526 / 0.258 / 22.8 %; de frente 0.647 / 0.378 / 7.20 %; centroide de 3 0.650 / 0.404 / 4.99 %; de 5 0.666 / 0.421 / 3.65 %; de 8 0.679 / 0.430 / 2.7 %. Es decir: **+0.026 de coseno medio y -60 % (medio) o -49 % (duro) de lecturas bajo 0.40 frente a una buena foto frontal; +0.095 frente a una foto cualquiera**, que es el riesgo real del esquema anterior. La mejora se concentra en la cola inferior.
- **Modelo analítico** que reproduce lo medido: `coseno(sonda, centroide de N) = rho_b / raiz((1 + (N-1)*rho_w) / N)`, con `rho_w` el coseno entre fotos de la misma sesión y `rho_b` el de sesiones distintas. Si en el aula real las 5 tomas comparten cámara y luz (`rho_w` alto), la ganancia esperada sobre una foto cualquiera es de +0.02 a +0.07; por eso las indicaciones guiadas piden variar ángulo, expresión y luz.
- **Rendimiento** (CPU, macOS arm64): detect + embed 16.9 ms de media (p95 21.9 ms) a 1280x960; 8 fotos en serie 126 ms.
- **Protocolo de calibración de campo** (pendiente, con el alumno TEST): registrar 5 tomas reales y leer `coseno_resto` de cada una (Detalles de calidad). Si los valores típicos son menores que 0.5, bajar `TEMPLATE_OUTLIER_COSINE` a 0.30; si todas pasan siempre con valores > 0.8, se puede subir a 0.40.

### 6.4 Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Galería de vectores por alumno | Ver 6.1: rompe el mapeo 1:1, multiplica el índice y el costo de búsqueda |
| `jsonb` o arreglo de rutas dentro de `plantilla_facial` | Rompe la 3FN, pierde la FK y el borrado por objeto; RNF-03 y `0006` prohíben columnas de arreglo |
| Descarte silencioso de *outliers* al registrar | Oculta errores de captura: con 2 de 5 fotos ajenas el *outlier* sería la correcta |
| Coseno contra el centroide de las demás (criterio inicial, 0.50) | Deja pasar mezclas balanceadas 3+3 y 4+4 (17 y 25 % a 0.45); la media de pares las detecta |
| Limitador de peticiones en el servidor para `/verificar` | Solo administradores autenticados, ~17 ms por foto y la petición anterior se aborta: bastan el *debounce* de 300 ms y `AbortController` |
| Bitácora RF-19 de los descartes del constructor | Exigiría una RPC nueva (el catálogo sigue en 72) para un caso anómalo tras el registro estricto; quedan en `muestras[]`, en la respuesta 201 y en logs con contadores |
| Bandas Alta/Media/Baja de consistencia | No están calibradas con fotos independientes reales; se muestran cifras informativas y la advertencia `DIVERSIDAD_BAJA` |
| Quitar EXIF en el servidor | Rompería la orientación (`exif_transpose`); la pantalla ya re-codifica sin EXIF |
| Descargar un dataset público para calibrar | No se hizo sin permiso de la persona dueña; el diseño lo compensa con umbral permisivo, instrumentación y el protocolo de campo |

### 6.5 Consecuencias

- **20 tablas** (la spec habla de 19): los `schema_01` y el README de `supabase/` se ajustaron; cualquier herramienta externa que cuente tablas debe ajustarse.
- **Costo**: construir una plantilla nueva cuesta N veces más (el incremental con `keep` no se afecta; la reconstrucción COMPLETA sí, ver el punto 11 de la sección 3). La plantilla multifoto exige `EMBEDDER=insightface`.
- **Una toma aceptada en pantalla puede ser rechazada por el camino heredado** al registrar con una sola foto (`FOTO_RECHAZADA`): la verificación por toma usa el criterio compensado, más tolerante, y el camino de una foto el heredado.
- **Contratos**: cambian `api_plantilla_registrar`, `api_plantilla_alumno`, `api_documento_url_autorizar` y `svc_indice_plan` (ver `docs/api/biometria.md` §3 y §4); no hay RPC nuevas (siguen 72).

## 7. Carga diferida para el presupuesto de JS de `/docente` (2026-10-03)

- **Contexto**: medido tras F11, el JS inicial de `/docente` era 257,7 KB gz contra un presupuesto de 240,7 (base 209,3 + 15 %). Con el analizador de Turbopack
  (`next experimental-analyze --output`) y los manifiestos del build se vio qué pesaba: el contenido del panel (tarjetas, listas y gráficas, ~12 KB gz) aunque solo se pinta
  cuando llegan los datos, que se piden en el cliente; la paleta ⌘K (~3 KB) y el reloj de demostración (~8 KB, solo modo local) que no hacen falta al pintar; y el barril
  `@/components/motion` (y `@/hooks/data` en el panel), que arrastraba `SloshGauge`, `SpotlightCard`, `useMe` y `useApiMutation` a pantallas que no los usan.
- **Decisión**:
  - `docente/PanelDocente`: el contenido que depende de los datos pasa a `PanelDocente/ContenidoPanel.jsx` y se carga con `React.lazy`. La descarga empieza al montar
    (en paralelo con la consulta) y, mientras llegan datos o módulo, se ve el mismo indicador de carga de siempre.
  - `layout/AppShell`: `PaletaComandos` y `RelojDemo` con `React.lazy` + `Suspense` (sin fallback visible). La paleta se monta solo al abrirla y se precarga
    con `requestIdleCallback` para que el primer ⌘K no espere; el reloj se sigue renderizando en el servidor cuando el reloj simulado está activo.
  - Importaciones directas en lugar de los barriles (`@/components/motion/BlurText`, `.../Reveal`, `.../StaggerList`, `@/hooks/data/useApiQuery.js`) en `HomeRol`,
    `FilaModulos`, `CatalogoModulos`, `AuthCard` y `PanelDocente`: Turbopack no descarta las reexportaciones sin usar del barril.
  - `React.lazy` y no `next/dynamic`: no suma el runtime de `next/dynamic` al shell y el SSR se conserva igual.
- **Resultado** (gzip, `scripts/measure-bundle.mjs`): `/docente` 257,7 → **226,1 KB** (+8,0 % sobre la base, 14,6 KB de margen). Bajaron también `/login` (−4,1),
  `/admin` (−9,9), `/alumno` (−6,8), `/analitica` (−7,4), `/reportes` (−7,1), `/docente/sesiones/[id]` (−4,2) y `/modulos` (−13,4); ninguna subió. Tabla en `docs/DESIGN_PROGRESS.md`.
- **Alternativas descartadas**:

  | Alternativa | Por qué no |
  |---|---|
  | Ajustar `experimental.turbopackChunking` (`minChunkSize`, `requestCost`, `maxMergeChunkSize`) | Probado: entre −0,1 y +2,4 KB en `/docente`; experimental y global |
  | Marca con `getImageProps` desde el servidor para quitar `next/image` del cliente (~7 KB) | Importar `next/image` en un componente de servidor igual registra `image-component` como referencia de cliente: no ahorra nada |
  | Diferir `ErrorState` en los `error.jsx` (sus chunks duplican `Link`, Lucide y `Button`, ~12 KB) | Si el error es un chunk que no carga, la pantalla de error tampoco cargaría |

- **Consecuencias**: las pruebas que abren la paleta o esperan el reloj usan consultas asíncronas (`findBy…`). Pendiente conocido: `app/error.jsx` y `app/not-found.jsx`
  son grupos de chunks hermanos del layout `(app)` y Turbopack duplica en ellos `Link`, el núcleo de Lucide y `Button` (~12 KB gz en cada ruta).
  Ningún contrato (RPC, JSON, rutas) cambia.

## 8. Fotos de registro efímeras (extensión 18)

- **Contexto**: las fotos de `registro/` solo sirven para calcular el vector del alumno (el servicio las lee al construir el índice). Una vez que ese vector vive en el
  JSON `indice/<version>.json`, la foto no tiene otro lector y dejarla en el bucket es guardar un rostro sin necesidad. Los recortes (`recortes/`) son otra cosa: son la
  evidencia que ve el docente al revisar un caso y ya tienen su propia retención (RNF-05); esta extensión no los toca.
- **Decisión**: la foto se **sube, se indexa y se borra**. Al activarse una versión del índice (último paso de `reconstruirIndice`, ya con el servicio apuntando a ella) se borran los
  objetos de las plantillas que esa versión acaba de indexar y `objeto_foto` pasa a `NULL` en `plantilla_facial` y `plantilla_foto` (misma técnica que la purga de recortes: listar → borrar
  objetos → marcar NULL; `svc_fotos_registro_listar` / `svc_fotos_registro_marcar`). El borrado nunca invalida la activación; si falla, lo reintenta el job `purgar-fotos-registro`,
  que además limpia las fotos de plantillas **archivadas** (cierra la «brecha de retención» de 6.2) y las anteriores a la extensión.
- **Qué NO se purga nunca**: la foto de una plantilla activa que aún no está en un índice activado. La SQL lo exige al listar y lo vuelve a comprobar al marcar.
- **Consecuencias que hay que conocer** (son el precio de no guardar la foto):
  - **La reconstrucción completa y el cambio de dimensión del modelo ya no son posibles sobre plantillas ya indexadas**: re-vectorizar exige la foto. `reconstruirIndice` responde
    `409 PLANTILLAS_SIN_FOTO` (con la lista de plantillas y alumnos) ANTES de llamar al servicio; la salida es registrar de nuevo a esos alumnos. El incremental (`keep`) no se afecta.
  - **No se puede revertir a una versión del índice que no conoce a una plantilla ya purgada**: `409 REVERSION_PERDERIA_PLANTILLAS`. Sin la foto ese alumno se quedaría sin vector y todo
    build posterior fallaría. Revertir sigue siendo posible mientras todas las plantillas activas estén en el manifiesto de la versión destino.
  - El administrador ya no puede ver la foto de registro (`api_documento_url_autorizar` responde `410 FOTO_NO_CONSERVADA`; la pantalla lo informa en vez de ofrecer un enlace roto) y la
    revisión del docente ya no muestra la «foto de registro» junto a los recortes: la comparación es el score.
  - Entre el registro y la activación del índice (segundos si el servicio responde) la foto sí está en el bucket; si el índice queda pendiente, permanece hasta la siguiente
    reconstrucción exitosa. Es lo que permite reintentar sin pedirle al alumno otra captura.
- **Alternativas descartadas**:

  | Alternativa | Por qué no |
  |---|---|
  | Vectorizar en memoria al registrar y no subir nada al bucket | Un fallo del índice (servicio caído) perdería la única copia: habría que repetir la captura. Reescribe además el contrato entre registro, plan y build |
  | Conservar la foto N días y purgarla por retención | Es lo que ya hacen los recortes, pero aquí no hay ningún lector durante esos días |
  | Borrar también las fotos ya existentes en la propia migración | Un borrado irreversible de datos fuera de la BD no va dentro de una migración; lo hace el job (o `scripts`) cuando se decide |

- **Despliegue**: SQL (`0237_fotos_registro_efimeras.sql`), después web; el servicio de reconocimiento no cambia. Las fotos que ya estaban en el bucket NO se borran solas: se limpian
  ejecutando el job `purgar-fotos-registro` (o esperando a su cron).
