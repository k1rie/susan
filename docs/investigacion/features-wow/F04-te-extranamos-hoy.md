# F04 · «Te extrañamos hoy»: cierre de sesión con nota al ausente (inaugura Comunicados)

> Diseño basado en el código actual. Tablas y RPC existentes que reutiliza: `sesion_clase`, `asistencia`, `inscripcion`, `justificante`, `v_resumen_asistencia`, `api_cerrar_sesion`, `api_sesion_monitor`, `api_impacto_tiempo`, `api_alumno_resumen`, `api_alumno_historial`, `api_docente_panel`, `app.sesion_autorizada`, `app.limite_correccion`, `app.bitacora` y `lib/numerics` (`cusum`, `ewmaControl`, `resumirAsistencia`).
> Respecto al brief cambian cuatro cosas, cada una explicada en su sección:
> - el tema de la clase va en **columnas de `sesion_clase`**, no en una tabla `sesion_nota`;
> - «Necesito apoyo» es un **tipo de respuesta**, no una tabla `solicitud_apoyo`;
> - **no se agrega una acción a `accion_bitacora`**: se usa `notificacion`, que ya existe, con la entidad nueva `mensaje`;
> - **`api_cerrar_sesion` no cambia**: solo deja de descartarse su respuesta.

---

## 1. Concepto y momento wow

Al cerrar la lista, SUSAN convierte el cierre en dos cosas:

- **Un recibo:** «21 de 24 asistieron · ≈ 5 min devueltos hoy · 1 h 30 min en el periodo (estimación)».
- **Una acción:** «3 ausentes · 3 notas listas».

Cada nota sale firmada por la docente y dice lo que se vio ese día. El servidor pone el conteo real de faltas, así que nadie puede escribirlo a mano. El alumno recibe la nota en «Mensajes de tus profesores» con tres salidas de un toque. Si toca «Necesito apoyo · Transporte», la fila de la docente cambia en vivo a «Pidió apoyo · Transporte». Es el aviso personal en las horas siguientes a la falta (Cortinhas 2025; Carrell y Kurlaender 2023), con el número real de faltas (Rogers y Feller 2018).

---

## 2. Flujo de usuario pantalla por pantalla

### A. `/docente/sesiones/[id]` (abierta): `CierreSesionDialog`

- **Campo nuevo «¿Qué vieron hoy?»** (opcional, una línea, `maxLength` 200).
  - Para dictar basta el micrófono del teclado de Android (Gboard), con `enterKeyHint="done"`.
  - No se usa la Web Speech API: manda el audio a un tercero desde el navegador y no existe en todos los navegadores.
  - Leyenda bajo el campo: «Lo verán quienes faltaron».
- **Tema de la clase anterior: sugerido, no prellenado.** Debajo del campo aparece el chip «Usar el de la clase anterior: Depreciación…, ej. 3», que viene de `sesion.tema_anterior`. Es una sugerencia y no un valor ya escrito, para que nadie envíe por descuido el tema de la clase pasada.
- **Enlace al material** (opcional): plegado en `ui/Detalles`, solo `https://`.
- **Orden al confirmar:**
  1. `antesDeCerrar` (el pase manual, sin cambios).
  2. `api_sesion_tema_guardar`. Si falla, sale un aviso y **se cierra igual**: el tema nunca bloquea el cierre de la sesión (RF-10).
  3. `api_cerrar_sesion`.
  4. `onCerrada(r)`.
- **A 360 px:** `ConfirmDialog` ya ocupa todo el ancho; el campo va bajo la cuadrícula `dl` del resumen.

### B. Propagación de la respuesta de `api_cerrar_sesion` (hoy se descarta)

Hoy `MonitorSesion` y `PaseListaManual` pasan `onCerrada={() => {…}}` y la respuesta se pierde. El cambio:

```jsx
// MonitorSesion y PaseListaManual: nueva prop onCerrada, se reenvía la respuesta
onCerrada={(r) => { setCerrando(false); onCerrada?.(r); onActualizar?.(); }}

// SesionClase: la respuesta vive aquí; el sondeo de 5 s cambia el estatus a cerrada y la pantalla pasa a ResumenSesion
const [cierre, setCierre] = useState(null);
<MonitorSesion … onCerrada={setCierre} />  <PaseListaManual … onCerrada={setCierre} />
<ResumenSesion data={data} cierre={cierre?.id_sesion === sesion.id_sesion && !cierre.ya_cerrada ? cierre : null} />
```

- **Con `cierre`** (recién cerrada en esta pantalla): el recibo cuenta con `CountUp` y el foco pasa a «Revisar y enviar» (reutiliza `sesion/enfocarPanel.js`).
- **Sin `cierre`** (la docente llega después, o la cerró `svc_job_cerrar_sesiones` con `cerrada_por: servicio`): las mismas secciones aparecen sin animación. Así **el cierre automático tampoco pierde la oportunidad**.

### C. `/docente/sesiones/[id]` (cerrada): `ResumenSesion`

**1. Recibo del cierre (`sesion/ReciboCierre`).** Solo cifras agregadas, así que se puede proyectar.

- `StatCard` «Asistieron»: presentes + retardos, con la nota «de N inscritos».
- `StatCard` «Tiempo devuelto hoy»: «≈ 5 min» con el supuesto visible («5 min de pase manual por sesión con cámara · estimación»). En una sesión manual dice «Pase manual: hoy no suma».
- `StatCard` «En tus grupos este periodo»: `api_impacto_tiempo({ periodo: sesion.periodo })`, con `es_estimacion` y su `nota`.
- Una línea bajo las cifras: «3 ausentes · 3 notas listas · 2 pendientes van a Revisión (no reciben nota)».

**2. Quienes faltaron hoy (`sesion/QuienesFaltaron`).** Va cerrado por omisión, con un botón «Revisar y enviar 3 notas» y la advertencia «Muestra datos de cada alumno: revísalo en tu pantalla, no en el proyector».

- **Una tarjeta por ausente sin justificante (`sesion/AvisoAusente`):**
  - `ui/Checkbox` (incluir), nombre y matrícula.
  - Chips con texto y color: «Primera falta en 9 clases», «3.ª falta seguida», «Le quedan 2», «En el límite», «Superó el límite».
  - Vista previa de la nota ya rellenada (`line-clamp-3`) y el enlace «Editar».
- **Ausentes no elegibles:** aparecen deshabilitados y con el motivo escrito: «Ya recibió una nota esta semana (lun 14)», «No recibe notas de esta materia», «Ya registró justificante».
- **Sin registro facial:** en una sesión automática, un ausente sin plantilla activa o sin consentimiento vigente sale **desmarcado** con «Sin registro facial: confirma que faltó». La cámara no podía reconocerlo, así que la falta puede ser falsa.
- **Editor (`comunicados/EditorAviso`)** en `ui/PanelLateral`, que ocupa la pantalla completa en el teléfono:
  - `ui/Pills` con las 4 plantillas.
  - `ui/Textarea` con marcadores, una fila de chips para insertar marcadores y la vista previa en vivo.
  - Errores pegados al campo: «Las cifras las pone SUSAN: usa {faltas}».
- **Barra fija con «Enviar a los 3»:** llama a `api_aviso_enviar`. Cada fila pasa por «Enviada 07:22» → «Leída 07:23» → «Pidió apoyo · Transporte», «Todo bien» o «Dice que sí estuvo · Corregir» (lleva a `/docente/revision`).
  - Mientras haya notas sin respuesta y dentro del plazo, `api_avisos_sesion` se vuelve a pedir cada 10 s y al volver a la pestaña (`useApiQuery` ya se pausa con la pestaña oculta).
  - El estado de cada fila tiene `aria-live="polite"`.
- **«Copiar al correo»** (después de enviar): un `mailto:` **por alumno**, al `alumno.correo_institucional`, armado en el dispositivo al tocar. Nunca va con varios destinatarios y no pasa por el servidor.
- **Fuera de plazo** (después de `app.limite_correccion`, 48 h): «El plazo para enviar notas de esta sesión terminó».

### D. `/docente` (panel)

`IndicadoresPendientes` gana una tercera tarjeta: «Pidieron apoyo: 1», con tono `warning` si es mayor que 0 y enlace a `/docente/comunicados?pestana=apoyo`. A 360 px las tres tarjetas van apiladas; desde `sm`, en tres columnas.

### E. `/docente/comunicados` (ruta nueva; el módulo pasa a `activo`)

Dos pestañas con `ui/Tabs`:

- **«Pidieron apoyo»:** cada solicitud es una `ui/TarjetaFila` con nombre, materia y grupo, categoría, «hace 2 min» y la acción «Marcar atendida».
  - Sugerencias plegadas: platicar al final de la clase y canalizar a Tutorías (PIT).
  - Las respuestas «Dice que sí estuvo» llevan a la corrección dentro del plazo de RN-08.
- **«Enviadas»:** lista por sesión con `ui/BarraSegmentada` (enviadas → leídas → respondidas) dentro de `ui/TarjetaGrafica` con `resumen`. Esa parte es de la versión completa.

### F. `/alumno` y `/alumno/mensajes` (alumno, Android de gama media, 360 px)

- **Arriba de `/alumno`, `alumno/MensajesProfesores`:** solo aparece si hay notas sin archivar. Muestra hasta 2 notas y «Ver todos (n)».
- **Tarjeta de nota (`comunicados/TarjetaMensaje`):** materia, fecha, insignia «Nueva», el texto completo y «Ver material» (muestra el dominio, por ejemplo `drive.google.com`).
  - **Leído:** cuenta como leída cuando el texto estuvo en pantalla al menos 2 s (`useEnVista` + temporizador → `api_mensaje_responder('leido')`).
- **Tres salidas** (`comunicados/SalidasMensaje`, botones de 44 px que pasan a dos filas a 360 px):
  1. **Justificar:** enlace profundo existente `/alumno?justificar=<id_sesion>`. Solo aparece si la falta sigue siendo justificable.
  2. **Todo bien:** archiva la nota.
  3. **Necesito apoyo:** se despliega en línea `comunicados/PedirApoyo`, con `ui/Pills` (Transporte · Trabajo · Económico · Familiar · Otro), `ui/Alert` con el aviso de que no es un canal de emergencias (§6) y «Enviar a mi docente». Al terminar: «Listo. Patricia Ortega verá que pediste apoyo por transporte (solo la categoría)».
- **Salida secundaria «¿Sí estuviste en clase? Avísale»:** es la válvula ante una falta mal registrada por el reconocimiento.
- **«Escribir por correo»:** `mailto:` al correo institucional del docente.
- **Menú `⋯` (`ui/MenuAcciones`):** «No recibir notas de esta materia».
- **Si el docente corrigió la falta después de enviar la nota:** aparece el aviso «Tu docente corrigió este registro: apareces como presente. Puedes ignorar esta nota», y desaparece «Justificar».
- **`/alumno/mensajes`:** bandeja persistente con pestañas «Activas» y «Archivadas», y la lista de materias silenciadas con «Reactivar».

---

## 3. Datos

### 3.1 Lo existente que usa

| Pieza | Para qué |
|---|---|
| `api_cerrar_sesion` (respuesta: `ausentes_creados`, `pendientes`, `confirmados`, `cerrada_en`, `cerrada_por`) | Recibo y estado recién cerrada. **Sin cambios** |
| `api_sesion_monitor` (`totales`, `alumnos[].consentimiento_vigente`, `sesion.id_grupo`, `sesion.periodo`, `modo_registro`) | Base de `ResumenSesion` |
| `api_impacto_tiempo` + parámetro 12 `minutos_pase_lista_base` | Minutos devueltos (hoy = base si la sesión fue automática; periodo = `minutos_recuperados`) |
| `v_resumen_asistencia` (`faltas_equivalentes`, `faltas_restantes_antes_limite`, `faltas_maximas_permitidas`, `en_limite`, `supera_limite`) | Cifras de la nota (RN-10/RN-11) |
| `asistencia` (`estado`, `origen`), `justificante` (`estatus`), `plantilla_facial` (activa), `app.tiene_consentimiento_vigente` | Elegibilidad |
| `alumno.correo_institucional`, `alumno.nombres`, `docente.*` | Saludo, firma y `mailto` |
| `app.sesion_autorizada`, `app.limite_correccion` (RN-08), `app.exigir_rol`, `app.fallar`, `app.bitacora`, `app.param_num` | Autorización, plazo, errores y auditoría |
| `/alumno?justificar=<id>` → `PortalAlumno idSesionInicial`, `api_validar_justificante` | Salida «Justificar» |
| `api_sesiones_corregibles` / `api_corregir_asistencia` | Salida «Sí estuve» → corrección del docente |
| Patrón de `0240/0241` (`solicitud_laboratorio`) | Plantilla de tabla nueva + RLS + candado asesor + pruebas |

### 3.2 Migración `0250_comunicados.sql` (estructura)

```sql
-- 1) Bitácora: entidad auditable nueva (19 -> 20). SIN acción nueva: se usa 'notificacion' (accion_bitacora sigue con 11).
ALTER TABLE public.bitacora_auditoria DROP CONSTRAINT ck_bitacora_entidad;
ALTER TABLE public.bitacora_auditoria ADD CONSTRAINT ck_bitacora_entidad CHECK (entidad IN (
    /* las 19 de 0240 */ …, 'solicitud_laboratorio', 'mensaje'));

-- 2) Tipos. tipo_mensaje es el punto de extensión: F05/F07/F23 hacen ADD VALUE en su propia migración.
CREATE TYPE public.tipo_mensaje    AS ENUM ('aviso_falta');
CREATE TYPE public.tipo_respuesta  AS ENUM ('todo_bien', 'apoyo', 'estuve_en_clase');
CREATE TYPE public.categoria_apoyo AS ENUM ('transporte', 'trabajo', 'economico', 'familiar', 'otro'); -- sin 'salud', a propósito

-- 3) Columnas (en vez de la tabla sesion_nota: relación 1:1 con la sesión, y el alumno ya ve sesion_clase por RLS,
--    así que el historial puede mostrar «Vimos…»). ADD COLUMN NULL sin DEFAULT: solo toca metadatos.
ALTER TABLE public.sesion_clase
    ADD COLUMN IF NOT EXISTS tema varchar(200),
    ADD COLUMN IF NOT EXISTS material_url varchar(300),
    ADD CONSTRAINT ck_sesion_material_url CHECK (material_url IS NULL OR material_url ~ '^https://\S+$');
ALTER TABLE public.inscripcion ADD COLUMN IF NOT EXISTS avisos_silenciados_en timestamptz; -- silencio por materia

-- 4) mensaje: UNA fila por destinatario (los avisos a un grupo de F07 harán fan-out: RLS simple y leído por alumno)
CREATE TABLE public.mensaje (
    id_mensaje    integer GENERATED ALWAYS AS IDENTITY,
    tipo          public.tipo_mensaje NOT NULL,
    id_remitente  integer NOT NULL,             -- usuario que firma (auditoría)
    id_alumno     integer NOT NULL,
    id_grupo      integer NOT NULL,
    id_sesion     integer,                      -- aviso_falta: la sesión de la falta
    plantilla     varchar(20),
    cuerpo        varchar(800) NOT NULL,        -- texto YA rellenado: lo que vio el alumno
    firma         varchar(120) NOT NULL,        -- «Patricia Ortega · Administración Financiera (3A)»; el alumno no lee usuario
    hechos        jsonb NOT NULL DEFAULT '{}',  -- cifras con las que se rellenó (solo números)
    enviado_en    timestamptz NOT NULL DEFAULT app.now(),
    leido_en      timestamptz,
    archivado_en  timestamptz,
    CONSTRAINT pk_mensaje PRIMARY KEY (id_mensaje),
    CONSTRAINT fk_mensaje_remitente FOREIGN KEY (id_remitente) REFERENCES public.usuario (id_usuario) ON DELETE RESTRICT,
    CONSTRAINT fk_mensaje_alumno FOREIGN KEY (id_alumno) REFERENCES public.alumno (id_alumno) ON DELETE RESTRICT,
    CONSTRAINT fk_mensaje_grupo FOREIGN KEY (id_grupo) REFERENCES public.grupo (id_grupo) ON DELETE RESTRICT,
    CONSTRAINT fk_mensaje_sesion FOREIGN KEY (id_sesion) REFERENCES public.sesion_clase (id_sesion) ON DELETE RESTRICT,
    CONSTRAINT ck_mensaje_aviso CHECK (tipo <> 'aviso_falta' OR (id_sesion IS NOT NULL AND plantilla IS NOT NULL)),
    CONSTRAINT ck_mensaje_plantilla CHECK (plantilla IS NULL OR plantilla IN ('primera_falta','cambio_ritmo','cerca_limite','habitual')),
    CONSTRAINT ck_mensaje_lectura CHECK (leido_en IS NULL OR leido_en >= enviado_en),
    CONSTRAINT ck_mensaje_archivo CHECK (archivado_en IS NULL OR leido_en IS NOT NULL)
);
CREATE UNIQUE INDEX ux_mensaje_aviso_sesion ON public.mensaje (id_sesion, id_alumno) WHERE tipo = 'aviso_falta'; -- idempotencia
CREATE INDEX ix_mensaje_alumno ON public.mensaje (id_alumno, enviado_en DESC);
CREATE INDEX ix_mensaje_tope ON public.mensaje (id_alumno, id_grupo, enviado_en) WHERE tipo = 'aviso_falta';

-- 5) respuesta_mensaje (en vez de solicitud_apoyo: «apoyo» es un tipo de respuesta)
CREATE TABLE public.respuesta_mensaje (
    id_respuesta  integer GENERATED ALWAYS AS IDENTITY,
    id_mensaje    integer NOT NULL,
    tipo          public.tipo_respuesta NOT NULL,
    categoria     public.categoria_apoyo,
    creada_en     timestamptz NOT NULL DEFAULT app.now(),
    atendida_por  integer,
    atendida_en   timestamptz,
    CONSTRAINT pk_respuesta_mensaje PRIMARY KEY (id_respuesta),
    CONSTRAINT fk_respuesta_mensaje FOREIGN KEY (id_mensaje) REFERENCES public.mensaje (id_mensaje) ON DELETE RESTRICT,
    CONSTRAINT fk_respuesta_atendida FOREIGN KEY (atendida_por) REFERENCES public.usuario (id_usuario) ON DELETE RESTRICT,
    CONSTRAINT uq_respuesta_mensaje_tipo UNIQUE (id_mensaje, tipo),
    CONSTRAINT ck_respuesta_categoria CHECK ((tipo = 'apoyo') = (categoria IS NOT NULL)),
    CONSTRAINT ck_respuesta_atencion CHECK ((atendida_por IS NULL) = (atendida_en IS NULL)
                                           AND (atendida_por IS NULL OR tipo IN ('apoyo','estuve_en_clase')))
);
```

**RLS y permisos** (mismo patrón que `0240`: `REVOKE` explícito porque en local los stubs dan `GRANT ALL`):

- `authenticated` solo tiene `SELECT` en ambas tablas, sin escritura directa. Todo cambio pasa por RPC DEFINER.
- **`mensaje`:**
  - `alumno_ve_lo_propio`: `USING (id_alumno = (SELECT app.id_alumno()))`.
  - `docente_ve_sus_grupos`: `USING ((SELECT app.rol()) = 'docente' AND id_grupo IN (SELECT app.grupos_visibles()))`. Solo el **titular**.
- **`respuesta_mensaje`:** `participante_ve_las_de_sus_mensajes`, `USING ((SELECT app.puede_ver_mensaje(id_mensaje)))`. `app.puede_ver_mensaje` es un ayudante DEFINER, para no recursar entre políticas.
- **El administrador no ve ninguna de las dos tablas**, igual que `justificante` (Tabla 36): la categoría de apoyo es personal. Recibirá agregados después (F07).

**Parámetros nuevos** (`parametro_sistema` y `app.parametro_meta`; pasan de 14 a 16):

| # | Clave | Valor | Rango | Unidad | Uso |
|---|---|---|---|---|---|
| 15 | `dias_retencion_mensajes` | 30 | 7–365 | días | Purga tras el fin del periodo del grupo |
| 16 | `apoyo_habilitado` | **0** | 0–1 | bandera | «Necesito apoyo» se enciende solo donde Tutorías tenga responsable; la semilla de demostración lo pone en 1 |

**Tope semanal:** constante de diseño, **1 nota por alumno, grupo y semana ISO** (de lunes a domingo, hora del plantel). Es una garantía contra el desgaste y contra el abuso, así que deliberadamente no es configurable al alza. Se serializa con `pg_advisory_xact_lock(250, id_inscripcion)`.

**Retención y purga:**

- **Qué se purga:** cada mensaje y sus respuestas se borran `dias_retencion_mensajes` días después de la **última sesión del grupo** (fin del periodo), y nunca más de 400 días después del envío.
- **Job y ruta:** `svc_job_purgar_mensajes(p_limit)` (DEFINER, solo `service_role`) borra primero las respuestas y luego los mensajes (FK RESTRICT, en orden). Deja una sola fila de bitácora `notificacion/mensaje` con `{evento:'purga_mensajes', mensajes, respuestas}` (solo conteos). Se dispara por la ruta `/api/jobs/purgar-mensajes` (se agrega a `NOMBRES_JOB`) con cron diario.
- **Qué guarda la bitácora (solo inserción, nunca se purga):** por envío, `notificacion` sobre `mensaje` con `{evento:'aviso_falta', id_alumno, id_sesion, plantilla}`. **Nunca el cuerpo ni la categoría de apoyo.**

### 3.3 Migración `0251_api_comunicados.sql` (RPC)

| RPC | Seguridad | Roles | Argumentos | Devuelve (resumen) | Errores |
|---|---|---|---|---|---|
| `api_sesion_tema_guardar` | DEFINER VOLATILE | docente titular | `p_id_sesion`, `p_tema text`, `p_material_url text DEFAULT NULL` | `{id_sesion, tema, material_url}` | NO_AUTORIZADO, NO_ENCONTRADO, VALIDACION, ESTATUS_INVALIDO (programada/suspendida), AVISO_FUERA_DE_PLAZO |
| `api_avisos_sesion` | INVOKER STABLE | docente titular | `p_id_sesion` | `{id_sesion, tema, material_url, puede_enviar, plazo_hasta, motivo, retardos_por_ausencia, excluidos:{pendientes, justificados, retardos}, ausentes:[{id_alumno, matricula, nombre_completo, correo_institucional, sin_registro_facial, hechos:{…}, estados:[…], plantilla_sugerida, textos:{<plantilla>: texto con marcadores}, elegible, motivo_no_elegible, aviso:null\|{id_mensaje, enviado_en, leido_en, respuestas:[…]}}]}` | NO_AUTORIZADO, NO_ENCONTRADO |
| `api_aviso_enviar` | DEFINER VOLATILE | docente titular | `p_id_sesion`, `p_avisos jsonb` = `[{id_alumno, plantilla, texto}]` (1–60) | `{id_sesion, enviados:[{id_alumno, id_mensaje, cuerpo, hechos}], omitidos:[{id_alumno, codigo, mensaje}]}` | NO_AUTORIZADO, NO_ENCONTRADO, VALIDACION, SESION_NO_CERRADA, AVISO_FUERA_DE_PLAZO |
| `api_mis_mensajes` | INVOKER STABLE | alumno | `p_archivados boolean DEFAULT false`, `p_limit`, `p_offset` | `{no_leidos, total, apoyo_habilitado, items:[{id_mensaje, tipo, enviado_en, leido_en, archivado_en, cuerpo, firma, materia, grupo, sesion:{id_sesion, fecha, tema, material_url}, vigente, puede_justificar, silenciado, respuestas:[…]}]}` | NO_AUTORIZADO |
| `api_mensaje_responder` | DEFINER VOLATILE | alumno (propios) | `p_id_mensaje`, `p_tipo` (`leido`\|`todo_bien`\|`apoyo`\|`estuve_en_clase`), `p_categoria DEFAULT NULL` | `{id_mensaje, leido_en, archivado_en, respuestas}` | NO_AUTORIZADO, NO_ENCONTRADO, VALIDACION, RESPUESTA_DUPLICADA, APOYO_DESHABILITADO |
| `api_mis_avisos_silenciar` | DEFINER VOLATILE | alumno | `p_id_grupo`, `p_silenciar boolean` | `{id_grupo, silenciado, desde}` | NO_AUTORIZADO |
| `api_solicitudes_apoyo` | INVOKER STABLE | docente | `p_estado DEFAULT 'abiertas'`, `p_limit`, `p_offset` | `{abiertas, total, items:[{id_respuesta, tipo, categoria, creada_en, atendida_en, alumno, materia, grupo, sesion, corregible}]}` | NO_AUTORIZADO |
| `api_apoyo_atender` | DEFINER VOLATILE | docente titular | `p_id_respuesta` | `{id_respuesta, atendida_en}` | NO_AUTORIZADO, NO_ENCONTRADO, VALIDACION |
| `svc_job_purgar_mensajes` | DEFINER | service_role | `p_limit` | `{ejecutado_en, mensajes, respuestas}` | VALIDACION |

**`api_aviso_enviar`, paso a paso:**

1. `app.exigir_rol('docente')` y `app.sesion_autorizada(p_id_sesion, false)`. Solo el titular: el administrador no firma en nombre del docente.
2. La sesión debe estar `cerrada` y `app.now() <= app.limite_correccion(fecha, hora_fin)`, el mismo plazo de RN-08 («mientras el registro aún puede corregirse»).
3. Por cada aviso, toma el candado asesor por inscripción y verifica:
   - `asistencia.estado = 'ausente'` (los pendientes, retardos y justificados quedan fuera → `ALUMNO_NO_FALTO`);
   - inscripción activa;
   - sin justificante pendiente o aprobado (`YA_JUSTIFICADO`);
   - `avisos_silenciados_en IS NULL` (`AVISO_SILENCIADO`);
   - tope semanal (`AVISO_TOPE_SEMANAL`);
   - que no se haya enviado ya (`AVISO_DUPLICADO`, respaldado por `ux_mensaje_aviso_sesion`).
4. Valida el texto (§4.3) y rellena los marcadores con `app.aviso_hechos` y `app.aviso_rellenar`; agrega la firma.
5. `INSERT` del mensaje y bitácora `notificacion`.

Las fallas por alumno van en `omitidos` (la interfaz marca esa tarjeta) y no anulan el lote. Las globales lanzan error.

**Cambios aditivos a contratos existentes** (`CREATE OR REPLACE`, solo agregan claves):

- `api_sesion_monitor`: `sesion.tema`, `sesion.material_url`, `sesion.tema_anterior`.
- `api_alumno_historial`: `items[].tema`.
- `api_docente_panel`: `solicitudes_apoyo` (respuestas `apoyo` o `estuve_en_clase` sin atender de sus grupos).

**Contratos a actualizar:**

- Códigos nuevos en `STATUS_POR_CODIGO` (`lib/api/errors.js`): `AVISO_FUERA_DE_PLAZO` (409), `AVISO_MARCADOR_REQUERIDO`, `AVISO_MARCADOR_NO_APLICA` y `AVISO_CIFRA_MANUAL` (422), `RESPUESTA_DUPLICADA` (409), `APOYO_DESHABILITADO` (403).
- Los códigos de omisión por alumno van en RETURNS, no en ERRORES.
- `docs/API-RPC.md` se regenera con `gen-api-catalog.mjs`: 82 → **90** `api_*`, 22 → **23** `svc_*`.
- `docs/api/comunicados.md` es nuevo.

**Pruebas de estructura que cambian:**

- `schema_01_estructura`:
  - tablas, llaves primarias, RLS activa y `SELECT` de `authenticated`: 21 → 23;
  - llaves foráneas: 30 → 36 (35 RESTRICT y 1 en cascada);
  - restricciones UNIQUE: 21 → 22;
  - enums: 16 → 19;
  - `accion_bitacora`: **11, sin cambio**;
  - parámetros y `parametro_meta`: 14 → 16.
- `schema_04_rls`: la matriz por rol, incluida `anon`, gana `mensaje` y `respuesta_mensaje`.
- `sincronia.test.js`: suma el módulo `comunicados.js` y el conteo pasa a 90.

---

## 4. Cálculo: hechos, plantillas y prueba de coincidencia

### 4.1 Hechos (`app.aviso_hechos(p_id_sesion, p_id_alumno)`, SQL, INVOKER STABLE)

Se calculan sobre las sesiones **cerradas** del grupo hasta esta sesión inclusive, en orden `(fecha, hora_inicio, id_sesion)`; `estado` NULL = sin registro.

| Hecho | Definición | Fuente |
|---|---|---|
| `faltas` | `faltas_equivalentes` = ausencias + ⌊retardos/rpa⌋ (RN-10) | `v_resumen_asistencia` |
| `restantes`, `limite`, `en_limite`, `supera_limite` | `faltas_restantes_antes_limite`, `faltas_maximas_permitidas`; RN-11 con aritmética exacta | `v_resumen_asistencia` |
| `seguidas` | Racha de `ausente` que termina en esta sesión. `justificado`, `pendiente` y NULL se saltan; `presente` y `retardo` la cortan. Es la **misma regla** que el factor `faltasConsecutivas` de `risk/riesgo.js` | ventana sobre `asistencia` |
| `sin_faltar` | Sesiones con presente/retardo desde la ausencia anterior, o desde el inicio. Aplica «primera falta» si no hay ausencia previa o si `sin_faltar ≥ 6` | ídem |
| `proximas` | `least(6, sesiones 'programada' del grupo con fecha ≥ hoy)`, la meta de conducta | `sesion_clase` |

### 4.2 Marcadores (los rellena el servidor con `app.aviso_rellenar`, sin SQL dinámico)

| Marcador | Se escribe | Restricción |
|---|---|---|
| `{nombre}` | primer nombre de `alumno.nombres` | — |
| `{materia}` | `materia.nombre` | — |
| `{tema}` | «Hoy vimos: Depreciación en línea recta, ejercicio 4.», o vacío si no hay tema | — |
| `{faltas}` | «1 falta» / «4 faltas» | **obligatorio** |
| `{restantes}` | «te quedan 5 antes del límite» / «te queda 1…» / «estás en el límite: una falta más y pierdes el derecho a examen» / «ya pasaste el límite de faltas» | **obligatorio** |
| `{sin_faltar}` | «9 clases» | solo si aplica la primera falta |
| `{seguidas}` | «3 faltas seguidas» | solo si son 2 o más |
| `{proximas}` | «las próximas 6 clases» | solo en el límite o cerca de él, sin haberlo superado |

La concordancia («1 falta» frente a «faltas») la resuelve el marcador, nunca la plantilla.

### 4.3 Validación del texto

- **Longitud:** de 20 a 500 caracteres con marcadores; el cuerpo final no pasa de 800.
- **`{faltas}` y `{restantes}` son obligatorios** (`AVISO_MARCADOR_REQUERIDO`): el número real es el núcleo con evidencia.
- **Un marcador que no aplica se rechaza** (`AVISO_MARCADOR_NO_APLICA`): el servidor nunca imprime un hecho falso, por ejemplo «primera falta» en alguien con 3 seguidas.
- **Cifra escrita a mano:** sobre el texto sin marcadores se rechaza `\m\d+\s*(faltas?|retardos?|clases?|sesi[oó]n(es)?|%)` (sin distinguir mayúsculas) → `AVISO_CIFRA_MANUAL`. Otros números, como «nos vemos el 14», sí pasan.
- **Marcador desconocido:** `VALIDACION`.
- **Firma:** la agrega el servidor y no se puede editar.

### 4.4 Las 4 plantillas (viven en SQL, `app.aviso_plantilla(id, supera_limite)`; revisión institucional pendiente)

| Plantilla | Texto |
|---|---|
| `primera_falta` | «Hola, {nombre}: te extrañamos hoy en {materia}. {tema} Es tu primera falta en {sin_faltar}, así que no pasa nada grave: llevas {faltas} y {restantes}. Si quieres ponerte al día, aquí estoy.» |
| `cambio_ritmo` | «Hola, {nombre}: te extrañamos hoy en {materia}. {tema} Te he visto menos en las últimas clases y quería saber cómo estás. Llevas {faltas}; {restantes}. Si algo se complicó, dime y vemos opciones.» |
| `cerca_limite` | «Hola, {nombre}: te extrañamos hoy en {materia}. {tema} Llevas {faltas}: {restantes}. Me importa que llegues al examen: si asistes a {proximas}, lo logras. Si algo te lo impide, avísame y lo vemos.» |
| `cerca_limite`, variante si ya superó el límite | «…Llevas {faltas}: {restantes}. Si tienes faltas por justificar, regístralas; y si algo te está pasando, pide apoyo. Aquí estoy.» (sin la promesa de llegar al examen) |
| `habitual` | «Hola, {nombre}: te extrañamos hoy en {materia}. {tema} Llevas {faltas}; {restantes}. Si necesitas algo para ponerte al día, aquí estoy.» |

### 4.5 Selector de plantilla (`sesion/QuienesFaltaron/quienesFaltaron.utils.js`)

El servidor decide las **cifras y la elegibilidad**. El cliente solo **sugiere el tono** y la docente decide.

`api_avisos_sesion` ya trae una `plantilla_sugerida` sin CUSUM (en el límite o cerca de él > primera falta > `seguidas ≥ 2` > habitual). El cliente puede subir de `habitual` a `cambio_ritmo` con los métodos que ya existen en `lib/numerics`, usando los parámetros de NUMERICS §5.5: k = 0.5σ, h = 4σ, λ = 0.3, L = 3.

```js
import { cusum, ewmaControl } from '@/lib/numerics';
// Indicador como en risk/riesgo.js: null se descarta; ausente = 1, retardo = 1/rpa y el resto 0.
export function cambioReciente(estados, rpa) {
    const y = estados.filter((e) => e != null).map((e) => (e === 'ausente' ? 1 : e === 'retardo' ? 1 / rpa : 0));
    if (y.length < 6) return false;
    const n = y.length;
    const ew = ewmaControl(y);
    return cusum(y).cambios.some((c) => c.direccion === 'alza' && c.indice >= n - 3)
        || (ew.alarmas.includes(n - 1) && ew.traza[n - 1].fx > ew.objetivo);
}
export function elegirPlantilla({ hechos: h, estados, plantilla_sugerida }, { rpa }) {
    if (plantilla_sugerida !== 'habitual') return plantilla_sugerida;
    return cambioReciente(estados, rpa) ? 'cambio_ritmo' : 'habitual';
}
```

La serie de un solo alumno es corta y binaria, así que CUSUM aquí solo elige el tono. Por eso el texto de `cambio_ritmo` no cita ninguna cifra que salga de CUSUM.

### 4.6 La prueba de que coinciden con el cálculo

1. **SQL, `supabase/tests/api_c_01_avisos.sql`** (prefijo nuevo `api_c_`):
   - el cuerpo enviado contiene exactamente `faltas_equivalentes` y `faltas_restantes_antes_limite` de `v_resumen_asistencia`, **y los mismos valores que `api_alumno_resumen()` ejecutada como ese alumno** (la nota y el portal nunca se contradicen);
   - 1 ausente + 3 retardos con rpa = 3 → «2 faltas» (RN-10);
   - 9 de 48 sesiones con límite 20 % → «estás en el límite…» (RN-11 exacta);
   - pendiente → `ALUMNO_NO_FALTO`;
   - segunda nota en la semana → `AVISO_TOPE_SEMANAL`;
   - otro docente → `NO_AUTORIZADO`;
   - «llevas 3 faltas» escrito a mano → `AVISO_CIFRA_MANUAL`;
   - RLS: el alumno solo ve lo suyo, otro alumno y el administrador ven 0 filas;
   - con el reloj simulado, la purga borra después de la retención;
   - la bitácora no guarda el cuerpo.
2. **Vitest de paridad de la vista previa:** `previsualizarAviso(texto, hechos)` del editor se compara con un bloque de casos `-- casos-plantilla:inicio … fin` que vive en el SQL de la prueba. Vitest lee ese archivo, igual que `sincronia.test.js` lee `API-RPC.md`, y exige la misma salida.
3. **Vitest de consistencia numérica:** para un caso fijo de `api_avisos_sesion`, `resumirAsistencia(estados, rpa).faltasEq === hechos.faltas`. Así la regla RN-10 en SQL y en `lib/numerics` es la misma. Más series sintéticas para `elegirPlantilla`: salto → `cambio_ritmo`; serie plana → `habitual`; 2 restantes → `cerca_limite`.

---

## 5. Interfaz

### Reutiliza

- **Diálogo y campos:** `ui/ConfirmDialog`, `ui/Field` + `ui/Input`, `ui/Textarea`, `ui/Checkbox`.
- **Cifras y estados:** `ui/StatCard` (con `animated` usa `motion/CountUp`), `ui/Badge`, `ui/Alert`.
- **Contenedores y navegación:** `ui/PanelLateral`, `ui/Pills`, `ui/Tabs`, `ui/TarjetaFila`, `ui/Detalles`, `ui/MenuAcciones`.
- **Estados de pantalla:** `ui/EmptyState`, `ui/SuccessState`, `ui/Toast`.
- **Gráfica:** `ui/BarraSegmentada` dentro de `ui/TarjetaGrafica`, con `resumen`.
- **Movimiento:** `motion/StaggerList` (entrada de las tarjetas, apagada con «reducir movimiento»).
- **Utilidades:** `lib/motion` (`useEnVista`, `usePrefersReducedMotion`), `sesion/enfocarPanel.js`, `lib/numerics` (`cusum`, `ewmaControl`, `resumirAsistencia`), `hooks/data` (`useApiQuery` con `refetchInterval` y pausa con la pestaña oculta).
- **Iconos Lucide:** `Megaphone`, `Inbox`, `HeartHandshake`, `Timer`, `MailOpen`, `CircleCheck`.

### Nuevos (un componente = una carpeta)

```
components/sesion/CampoTemaSesion/       CampoTemaSesion.jsx · CampoTemaSesion.test.jsx · index.js
components/sesion/ReciboCierre/          ReciboCierre.jsx · reciboCierre.utils.js (minutosHoy, textoAsistieron) · test · index.js
components/sesion/QuienesFaltaron/       QuienesFaltaron.jsx · useQuienesFaltaron.js (api_avisos_sesion + sondeo + enviar)
                                         · quienesFaltaron.utils.js (elegirPlantilla, etiquetasSerie, mailtoAviso) · test · index.js
components/sesion/AvisoAusente/          tarjeta por alumno (casilla, chips, vista previa, estado en vivo)
components/comunicados/EditorAviso/      EditorAviso.jsx · editorAviso.utils.js (previsualizarAviso, validarTexto = espejo del servidor)
components/comunicados/TarjetaMensaje/   TarjetaMensaje.jsx · useMarcarLeido.js (useEnVista + 2 s)
components/comunicados/SalidasMensaje/   Justificar · Todo bien · Necesito apoyo · «Sí estuve»
components/comunicados/PedirApoyo/       Pills de categoría + aviso de no emergencia
components/comunicados/BandejaMensajes/  /alumno/mensajes (Activas | Archivadas, silenciadas)
components/comunicados/SolicitudesApoyo/ y ComunicadosDocente/   /docente/comunicados
components/alumno/MensajesProfesores/    resumen en /alumno (hasta 2 sin leer)
components/docente/IndicadoresPendientes  + prop `apoyo` (tercera StatCard)
lib/api/comunicados.js                   envoltorios de las 8 api_* (JSDoc generado del COMMENT)
app/(app)/docente/comunicados/page.jsx   delgada; `await searchParams` (pestana)
app/(app)/alumno/mensajes/page.jsx       delgada
app/api/jobs/purgar-mensajes/route.js    handleJob('purgar-mensajes')
```

**Reglas de diseño que se respetan:**

- Tarjetas `rounded-xl border bg-card` sin sombra; un solo botón primario negro («Enviar a los 3»).
- Chips con texto además de color; foco con `ring-4 ring-ring/30`.
- A 360 px nada desborda: los chips usan `flex-wrap` y el editor ocupa la pantalla completa.
- Con «reducir movimiento» no hay `CountUp` ni entrada escalonada; el cambio de estado de una fila es solo texto con `aria-live`.
- **Peso:** no toca la carga inicial de `/docente` salvo una `StatCard`. El editor y la bandeja viven en otras rutas; hay que medirlo con `measure-bundle.mjs`.

---

## 6. Privacidad, ética y mitigaciones

| Riesgo | Mitigación en el diseño |
|---|---|
| Exponer a un alumno ante otros (proyector) | El recibo solo tiene agregados. «Quienes faltaron» va cerrado y con advertencia. La RLS y las pruebas garantizan que cada alumno solo ve lo suyo. No hay rankings |
| Envío automático o falso positivo del reconocimiento | Nada se envía sin el toque de la docente. Los pendientes quedan excluidos. Los ausentes sin registro facial salen desmarcados. «¿Sí estuviste?» lleva a una corrección dentro de RN-08. Si la falta se corrigió después, la bandeja lo explica |
| Tono de vigilancia o reproche | 4 plantillas cálidas revisadas por la coordinación de tutorías, siempre editables. La variante para quien ya superó el límite no amenaza y sugiere justificar o pedir apoyo |
| Desgaste o spam | Tope duro de 1 nota por alumno, materia y semana. El alumno puede silenciar las notas de una materia. «Todo bien» archiva |
| Dato sensible (LFPDPPP) | Sin categoría «salud». Solo categoría, sin texto libre. Visible solo para el titular (ni siquiera el administrador, igual que `justificante`). Microcopia de consentimiento expreso («Al enviar, autorizas que tu docente vea esta categoría»). Fuera de la bitácora. Se purga con la retención |
| Expectativa de atención inmediata | Aviso fijo: «No es un canal de emergencias. Si estás en peligro llama al 911 (Línea de la Vida 800 911 2000). Si faltaste por salud, mejor justifica tu falta». `apoyo_habilitado = 0` por omisión hasta que Tutorías tenga responsable y plazo |
| Datos en URL | El `mailto:` se arma en el dispositivo al tocar y no pasa por el servidor. `/alumno?justificar=<id_sesion>` ya existe y solo lleva un id |
| Promesas | El tiempo se marca «≈» y «estimación» con su supuesto. No se promete mejora académica. `leido_en` y la asistencia a la siguiente sesión se reportan como descriptivos, no causales |
| Inteligencia artificial (fuera del MVP) | Si se agrega, reescribe la **plantilla con marcadores**, nunca el texto rellenado, así que el proveedor no recibe datos personales. La salida se valida (mismos marcadores, sin cifras). Requiere una ruta nueva y revisión jurídica |
| Aviso de privacidad y derechos ARCO | Hay que agregar la finalidad «comunicación docente-alumno sobre asistencia» al aviso. La cancelación de datos se documenta en `RUNBOOK.md` |

---

## 7. Plan

### Entrega 1: MVP demostrable (unos 10 días-persona)

| Pieza | Esfuerzo |
|---|---|
| `0250`: tablas, RLS, columnas, parámetros 15–16, entidad de bitácora y pruebas `schema_01`/`schema_04` | 1.5 d |
| `0251`: `aviso_hechos`, `aviso_rellenar`, plantillas, `tema_guardar`, `avisos_sesion`, `aviso_enviar`, `mis_mensajes`, `mensaje_responder` (con apoyo y «estuve»), `api_docente_panel` y `api_sesion_monitor` aditivos; prueba `api_c_01` | 3 d |
| Contratos: catálogo, `docs/api/comunicados.md`, `lib/api/comunicados.js`, códigos y `sincronia` | 0.5 d |
| Campo de tema, propagación `onCerrada` y `ReciboCierre` | 1 d |
| `QuienesFaltaron`, `AvisoAusente`, `EditorAviso` y selector, con pruebas de paridad | 2 d |
| `MensajesProfesores`, `TarjetaMensaje`, `SalidasMensaje` y `PedirApoyo` en `/alumno` | 1.5 d |
| Tercera tarjeta en el panel y lista mínima en `/docente/comunicados` | 0.5 d |
| Semilla y escenario de cámara «Faltan tres» (la semilla pone `apoyo_habilitado = 1`), `DEMO.md` | 0.5 d |

### Entrega 2: versión completa (de 1 a 1.5 semanas más)

| Pieza | Esfuerzo |
|---|---|
| `/docente/comunicados` completo (Enviadas, embudo, filtros) y `api_solicitudes_apoyo` / `api_apoyo_atender` | 1.5 d |
| `/alumno/mensajes` con archivadas y silenciar/reactivar (`api_mis_avisos_silenciar`) | 1 d |
| `svc_job_purgar_mensajes`, ruta y cron | 0.5 d |
| `mailto:` en ambos sentidos | 0.5 d |
| Edición del tema desde el resumen | 0.25 d |
| Métricas descriptivas: % leídas en 24 h, asistencia a la siguiente sesión | 1 d |

### Después (cada una es su propia idea, de tamaño M a L)

- **Web Push de la PWA** (el módulo `notificaciones`): manifest, service worker, tabla de suscripciones, VAPID y una ruta nueva. Resuelve la entrega fuera del portal.
- **F05 (recordatorios al acercarse al límite), F07 (avisos al grupo) y F23** sobre el mismo `mensaje`: cada una agrega su valor a `tipo_mensaje`.
- **Reescritura con IA**, después de la revisión jurídica.

**Ownership** (ARCHITECTURE §7): falta definir dueño para `0250/0251` y `components/comunicados/**`. Además se tocan, con coordinación:

- `components/sesion/**` (screens-sesiones);
- `components/alumno/**` (screens-reportes);
- `lib/api/**` (data-layer);
- `app/api/jobs` y `lib/server/jobs.js` (route-handlers);
- el `CREATE OR REPLACE` de RPC de `01xx` (db-api-a).

---

## 8. Guion de demostración de 60 s

**Preparación:**

- `scripts/seed-demo.sh --reset` y `apoyo_habilitado = 1`.
- Sesión **19** (3A, Administración Financiera, `docente1@`, Patricia Ortega Salinas), con la cámara simulada en el escenario «Faltan tres».
- La laptop al proyector; un teléfono a 360 px con la sesión del alumno de la «3.ª falta seguida».

| Segundo | Qué se hace | Qué se dice |
|---|---|---|
| 0–8 | 07:21, «Cerrar pase de lista». Dicta en el campo: «Depreciación en línea recta, ejercicio 4». Confirma | «Cierro la lista y le digo a SUSAN qué vimos hoy.» |
| 8–18 | El recibo cuenta: «21 de 24 asistieron», «≈ 5 min devueltos hoy», «… h en el periodo (estimación)». Debajo: «3 ausentes · 3 notas listas» | «Esto es lo que la cámara le devolvió a la clase. Y estos tres no vinieron.» |
| 18–30 | «Revisar y enviar 3 notas»: chips «Primera falta en 9 clases», «3.ª falta seguida», «Le quedan 2». Abre una nota: el conteo ya viene puesto | «Cada nota trae su conteo real; ese número no lo puedo inventar. Nada se envía solo.» |
| 30–36 | «Enviar a los 3» → «Enviada 07:22» | «Firmadas por mí, en la hora en que importa.» |
| 36–50 | En el teléfono, `/alumno` muestra «Mensajes de tus profesores · 1 nueva»: «Hola, …: te extrañamos hoy en Administración Financiera. Hoy vimos: Depreciación en línea recta, ejercicio 4. … Llevas 6 faltas; te quedan 3 antes del límite. — Patricia Ortega». Toca «Necesito apoyo» → «Transporte» (se ve el aviso de no emergencia) → Enviar | «Él no tiene que explicar nada: un toque.» |
| 50–60 | En el proyector la fila cambia sola: «Leída 07:23 · Pidió apoyo: Transporte», y el panel dice «1 alumno pidió apoyo» | «La falta deja de ser una cifra en un reporte: se vuelve una conversación.» |

---

## 9. Entrada propuesta para `web/src/lib/modulos.js`

El módulo `comunicados` deja de estar en `pronto` y se divide por rol; lo que falta de la hoja de ruta sigue como `pronto`.

```js
// import { Inbox, Megaphone, BellRing } from 'lucide-react';
{
    id: 'comunicados', titulo: 'Comunicados', descripcion: 'Notas firmadas a quienes faltaron, con su conteo real, y las solicitudes de apoyo de tus alumnos.',
    icono: Megaphone, categoria: 'asistencia', roles: ['docente'], estado: 'activo', href: '/docente/comunicados', tono: 'rosa',
},
{
    id: 'mis-mensajes', titulo: 'Mensajes de tus profesores', descripcion: 'Las notas de tus docentes cuando faltas: justifica, avisa que todo va bien o pide apoyo.',
    icono: Inbox, categoria: 'asistencia', roles: ['alumno'], estado: 'activo', href: '/alumno/mensajes', tono: 'rosa',
},
{
    id: 'avisos-grupo', titulo: 'Avisos al grupo', descripcion: 'Avisos a un grupo completo y recordatorios al acercarse al límite de faltas, sobre la misma mensajería.',
    icono: BellRing, categoria: 'asistencia', roles: ['docente', 'administrador'], estado: 'pronto', tono: 'rosa',
    queIncluye: ['Avisos por grupo con acuse de lectura', 'Recordatorio al llegar al 80 % del límite de faltas', 'Plantillas institucionales'],
},
```

Cambios que van con esta entrada:

- **`navItems.js`:**
  - docente: `{ href: '/docente/comunicados', label: 'Comunicados', icon: Megaphone, grupo: 'Asistencia' }`;
  - alumno: `{ href: '/alumno/mensajes', label: 'Mensajes', icon: Inbox, grupo: 'Comunicación' }`.
  - `modulos.test.js` exige que cada módulo activo esté en la navegación de sus roles.
- **`tutorias`:** su `queIncluye` gana «Entrada desde “Necesito apoyo” de Comunicados».

---

### Cambios de contrato a avisar (requests)

- **RPC nuevas:** 8 `api_*` y 1 `svc_*`, con códigos de error nuevos.
- **Claves aditivas:** en `api_sesion_monitor`, `api_alumno_historial` y `api_docente_panel`.
- **Esquema:** 23 tablas, 36 llaves foráneas, 19 enums, 16 parámetros y 20 entidades de bitácora.
- **`docs/DECISIONS.md`:** extensión 21, con las cuatro diferencias frente al brief explicadas en esta propuesta.
- **`docs/ARCHITECTURE.md`:** §7 (dueños) y §8 (extensiones).
- **Otros documentos:** `docs/NUMERICS.md` (uso de CUSUM/EWMA para elegir el tono de la plantilla), `docs/design/MODULOS.md` y `docs/DEMO.md`.