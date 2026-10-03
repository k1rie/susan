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

## 2. Decisiones técnicas

- **Solo RPC**: toda lectura/escritura de la app pasa por funciones `api_*` (usuario, RLS) o `svc_*` (servidor, `service_role`); nunca `.from('tabla')`. Da contrato explícito, transacciones y ejecución idéntica en modo local.
- **Modo local sin Docker**: PostgreSQL 16 directo + disco (`SUSAN_LOCAL=1`). Las migraciones son idénticas a las de Supabase; solo cambia el transporte (`web/src/lib/local`, rutas `api/%5Flocal`, cerradas en producción).
- **Índice FAISS en el bucket como JSON** (`susan-faiss-json/1`, vectores float32 en base64): `IndexIDMap2(IndexFlatIP)` en memoria con búsqueda restringida por `IDSelectorBatch` (RF-04). Búsqueda exhaustiva de 20 000×512 ≈ 1 ms (RNF-01 pide ≤ 50 ms). Cambio de versión atómico en una sola transacción (RN-12/RNF-09).
- **Embedder enchufable** (`EMBEDDER=insightface|fake`): `insightface` (buffalo_s, ArcFace 512-d) para uso real; `fake` determinista para pruebas. **Licencia**: los modelos preentrenados de InsightFace son de uso no comercial.
- **Lógica de negocio en PostgreSQL**: ciclo de vida de la asistencia (triggers + RPC), RN-10/RN-11 reversibles, jobs idempotentes.
- **Diseño visual mínimo** a petición: tokens semánticos en `web/src/app/globals.css`; el rediseño cambia esos valores y los componentes de `components/ui`.
- **Seguridad**: contraseñas solo en Supabase Auth; `service_role` solo en servidor; objetos del bucket solo por URL firmada ≤ 300 s; cada consulta de recortes/documentos se asienta en bitácora **antes** de firmar (falla cerrado); sin vectores ni imágenes en tablas ni logs.

## 3. Abierto / riesgos

1. **Calibración** del umbral (0.850), mínimo de lecturas (3) e intervalo (15 s) con datos reales: viven en `parametro_sistema`; cada detección conserva candidato y score aunque no alcance el umbral.
2. **Sin detección de vida** (anti-spoofing): el riesgo de suplantación con fotografía sigue abierto; lo atenúan la cola de revisión y las 3 lecturas en capturas distintas.
3. **Jurídico**: aviso de privacidad, formato/vigencia/revocación del consentimiento deben aprobarse por el área jurídica de la UNACH (LPDPPSOCH, LGPDPPSO). Mientras tanto, quien no consiente se registra por pase manual.
4. Pendiente: pruebas de **concurrencia** con dos sesiones (corrección simultánea, doble justificante, doble cierre; el diseño usa `FOR UPDATE`/`SKIP LOCKED` e índices únicos parciales).
5. Pendiente: **bitácora de altas/bajas de catálogo y de creación/restablecimiento de cuentas** (el enum de acciones no tiene valores propios) y `svc_usuario_obtener`.
6. Pendiente: sesiones `programada` que nunca se abren cuentan en el denominador y no generan registros (diseño de referencia R5).
7. El servicio guarda el índice en **memoria de un proceso**: con varias instancias hay que activar la versión en cada una.
8. Piloto en 1–2 grupos y prueba SUS (RNF-11); variante de 360 px verificada en pantallas, no con usuarios.
9. **Credenciales expuestas fuera de este repo**: `MVP-Project-Unach/microService-faiss/main.py` tiene una key de Backblaze B2 escrita en el código (y commiteada). No se copió a SUSAN; hay que **rotarla**. SmartClass guarda la contraseña en `localStorage` y la envía en cada petición: no se imitó.
