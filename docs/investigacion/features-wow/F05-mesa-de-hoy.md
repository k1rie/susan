# F05 · Mesa de hoy (v1 de tamaño L): 3 alumnos, un borrador y la respuesta en vivo

Diseño basado en el código real de `/Users/diegoguerrero/Developer/SUSAN`. Revisé las migraciones `0100`–`0241`, `docs/API-RPC.md`, `ARCHITECTURE.md` §7–8, `lib/api`, `lib/numerics`, `components/ui`, `lib/modulos.js`, `navItems.js`, `SISTEMA.md` y `DESIGN_PROGRESS.md`, y consulté la base local en modo solo lectura.

## 0. Lo que el código cambia del brief (verificado)

| # | Hallazgo | Consecuencia en el diseño |
|---|---|---|
| 1 | `api_docente_panel` nunca llama a `api_alertas_docente`. Usa `to_regprocedure('public.api_alertas_docente()')` (sin argumentos), que devuelve NULL porque la función recibe `(integer, integer, integer)`. Lo comprobé en la base local. El panel siempre usa el respaldo de `v_resumen_asistencia`, con `tipo` `sin_derecho_examen` en lugar de `sin_derecho`. | La Mesa lee `v_resumen_asistencia` directamente. El fallo se reporta aparte a db-api-a y no forma parte de F05. |
| 2 | `vence_en` de `api_cola_revision` es el plazo RN-08 de los **pendientes** (`app.limite_correccion`, 48 h). Los justificantes no tienen plazo. | La fuente es «registros en revisión que vencen en menos de 24 h», no «justificantes que vencen». |
| 3 | `RelojDemo` no tiene «+1 día». El docente1 no tiene clase el martes 15 y el miércoles 16 está `suspendida` (Independencia) en 3A y 5C. | El cierre de la demo usa «Fijar hora» al **siguiente día con clase**: viernes 18-sep 06:50. |
| 4 | Con el reloj de demostración **detenido**, `app.now()` es constante: «hace 3 s» y «de la alerta a la respuesta» darían 0. | Antes de la demo se pulsa «Correr». |
| 5 | El ejemplo del brief («si vienes a las próximas 6 clases conservas tu derecho») no es cierto en general. | Las plantillas solo afirman lo que es matemáticamente cierto (ver §4.4). |
| 6 | La semilla tiene una historia real y mejor que la del brief. El 5C (Matemáticas Financieras, B-04, lunes, miércoles y viernes a las 09:00) tiene a **Luis Aguilar E260068**: 9/9 faltas y las 8 últimas seguidas. **Sofía Flores E260069** faltó sus últimas 3 clases y antes casi nunca faltaba. **Paola Hernández E260066** tuvo sus 5 faltas en lunes. **Iván Cruz** (E260017 en 3A y E260067 en 5C) faltó 6 de sus 7 veces en viernes. Los nombres se repiten entre grupos (hay un «Luis A.» en 3A y otro en 5C). | La tarjeta siempre muestra el grupo. |
| 7 | Next 16 bloquea los recursos de desarrollo pedidos desde otro origen; hace falta `allowedDevOrigins`. La cookie local no es `secure` fuera de producción, así que un teléfono en la LAN puede iniciar sesión. | Hay que pedir el host y el origen para el teléfono de la demo. |
| 8 | `measure-bundle` suma el JS **inicial**, y `ContenidoPanel` ya se carga con `React.lazy`. | La Mesa dentro de ese contenido no gasta los 14,6 KB de margen. El contador del alumno, en cambio, vive en `AppShell`, que se carga en todas las rutas. |

---

## 1. Concepto y momento wow

Al abrir `/docente`, SUSAN ya armó la **mesa del día**: como máximo 3 alumnos, cada uno con el motivo en una línea de cifras reales y un mensaje con números exactos que el docente firma con un toque. Escena: son las 07:12 del lunes, la clase del 5C es a las 09:00 y el proyector dice «3 cosas para hoy». El docente le escribe a Luis A. («le quedan 0 faltas»). Segundos después, en un segundo teléfono, Luis toca «Necesito apoyo · Transporte», y la tarjeta del proyector cambia sola a «Contestó · Transporte · hace 3 s · de la alerta a la respuesta: 48 s».

## 2. Flujo pantalla por pantalla

### A. `/docente` (existente): sección «Mesa de hoy»

Va entre `PasarListaHero` e `IndicadoresPendientes` en `ContenidoPanel.jsx`.

- **Encabezado.** «3 cosas para hoy», con el subtítulo «Armada a las 07:12 · revisé 73 alumnos de 2 grupos · 0 de 3 atendidas» y un enlace «Ver todo» a `/docente/mesa`.
- **Pendiente de ti** (solo si hay). Una línea por seguimiento abierto: «Luis A. (5C) pidió apoyo (transporte) · responde antes del mié 16, 07:13». No ocupa lugar del tope.
- **Tarjetas.** Hasta 3 `TarjetaMesa`. Cada una lleva:
  - el icono del motivo;
  - el título «Luis A. · 5C» y la línea del motivo («Faltó sus últimas 8 clases. Le quedan 0 faltas y hoy tiene clase a las 09:00»);
  - un `Sparkline` real con las faltas equivalentes acumuladas de las últimas 12 sesiones y `max` igual a las faltas máximas más 1, para que la cercanía al tope se vea;
  - insignias («Clase hoy 09:00», «también: a 2 faltas del límite»);
  - las acciones «Escribirle» (principal), «Ya hablé» y `MenuAcciones` con «Posponer 3 días», «No aplica» y «Ver historial».
- **Estado en vivo dentro de la tarjeta.** Pasa de «Enviado · hace 12 s» a «Contestó · Necesito apoyo: transporte · hace 3 s». Tiene `aria-live="polite"` y una transición breve (excepción documentada para datos vivos).
- **`ui/Detalles` «Por qué estos y no otros».** Contiene la regla en 4 líneas y «Hoy quedaron fuera 7», con nombre corto y motivo, sin acciones.
- **Línea de tareas** (solo si aplica). «8 registros de revisión vencen hoy a las 10:00» y un enlace a `/docente/revision`.
- **Modo clase.** Si el docente tiene una sesión `abierta` (dato que ya viene en `d.sesiones_hoy`), la sección se pliega: «Oculta mientras pasas lista (puede estar proyectada) · Mostrar». En todo el panel se usan solo el nombre de pila y la inicial.
- **A 360 px.** Tarjetas apiladas a lo ancho. La fila de acciones queda como `[Escribirle (flex-1)] [Ya hablé] [⋯]` y cabe en 328 px.
- **En el proyector (≥ 1280 px).** `lg:grid-cols-3`: las tres tarjetas lado a lado.

### B. Panel lateral «Escribir a Luis A.» (`BorradorMensaje`, carga diferida)

- `ui/Pills` con las plantillas que aplican al alumno («Aviso de límite», «Te extrañamos»).
- `ui/Textarea` con `autoGrow`, `maxLength` 800 y `showCount`, ya relleno.
- Un `Detalles` plano «Cifras que usa este mensaje»: la lista de `hechos`.
- «Sus últimas 12 clases» con `ui/CalendarioAsistencia`, alimentado por `api_serie_alumno`, que hoy no tiene consumidor en la web.
- Un `ui/Alert` cuando aplica: «1 registro de Luis está en revisión: las cifras pueden cambiar» o «Aún no tiene cuenta: no verá el mensaje».
- Pie: «1 de 2 mensajes a Luis esta semana», con los botones «Cancelar» y «Enviar».
- A 360 px ocupa la pantalla completa (lo hace ya `PanelLateral`).
- Si el docente edita el texto, aparece la nota «Editaste el texto: revisa que las cifras sigan siendo correctas».

### C. `/docente/mesa` (nueva, página delgada)

Contiene la misma sección completa más «Fuera de la mesa hoy», `MetricasMesa` (StatCards de proceso) y, en la versión completa, el historial de 30 días con `ui/Pills` («Todas», «Con respuesta», «Declaradas», «Pospuestas», «No aplica»).

### D. Alumno: `/alumno` (existente)

- `BottomNav` (móvil) y el riel (escritorio) muestran «Mensajes» con una insignia del número de mensajes **sin responder**. El alumno pasa de 2 a 3 destinos.
- La tarjeta de la materia en `ResumenMaterias`, debajo de su `BarraFaltas`, muestra el chip «Mensaje de Patricia Ortega · hace 1 min», que lleva a `/alumno/mensajes#m-<id>`.

### E. Alumno: `/alumno/mensajes` (nueva)

- Lista de `NotaDocente`, la más nueva primero. Cada nota lleva la materia y el grupo, quién escribe y hace cuánto, el texto, y «Tus cifras al 14-sep» (una `BarraFaltas` con los `hechos` del envío, rotulada con su fecha).
- Tres botones apilados de al menos 44 px:
  - «Ahí estaré»;
  - «Necesito apoyo», que despliega un `ui/Pills` de una sola opción (Transporte · Trabajo · Dinero · Familia · Personal, prefiero platicarlo) y el botón «Enviar»;
  - «Quiero hablar en asesoría».
- Después de responder: «Respondiste: Necesito apoyo · Transporte. Le avisamos a Patricia Ortega». La respuesta es única.
- No hay texto libre del alumno en la v1.

## 3. Datos

### 3.1 Existentes que se reutilizan (nombres reales)

- **Tablas y vista.**
  - `v_resumen_asistencia`: `faltas_equivalentes`, `faltas_maximas_permitidas`, `faltas_restantes_antes_limite`, `en_limite`, `supera_limite`, `retardos`, `pendientes`, `estatus_inscripcion`.
  - `sesion_clase` (`fecha`, `hora_inicio`, `hora_fin`, `estatus`) y `asistencia` (`estado`).
  - `grupo` (`id_docente`, `periodo`, `clave_grupo`, `id_aula`, `id_materia`), `materia`, `aula`, `alumno`, `docente`.
  - `inscripcion`, con `uq_inscripcion_alumno_grupo (id_alumno, id_grupo)`, que sirve de destino a las FK.
  - `justificante` (`estatus = 'pendiente'`), `usuario` (`id_alumno`, para saber si el alumno tiene cuenta), `parametro_sistema` con la vista `app.parametro_meta`, y `bitacora_auditoria`.
- **Ayudantes.** `app.now`, `app.hoy`, `app.instante_clase`, `app.limite_correccion`, `app.param_num`, `app.exigir_rol`, `app.id_docente`, `app.id_alumno`, `app.fallar`, `app.bitacora`, `app.c1_iso`, `app.c1_nombre`, `app.c1_limite` y `app.c1_desplazamiento`.
- **RPC sin cambios de contrato.**
  - `api_docente_panel`: sigue igual, la Mesa no lo toca.
  - `api_ahora` (`reloj_simulado` decide el sondeo de la demo).
  - `api_serie_alumno`, que se consume en el panel lateral.
  - `api_alumno_resumen`.
  - `api_parametro_actualizar` / `api_parametros_publicos`: los parámetros nuevos se editan donde ya se editan los demás.

### 3.2 Cambios SQL nuevos (zona db-api-a, migraciones `0140`–`0142`)

**`0140_mesa_base.sql`**: tipos, tablas, RLS, parámetros y bitácora. Sigue el patrón de `0240_laboratorios.sql`.

```sql
CREATE TYPE public.motivo_mesa   AS ENUM ('limite', 'cambio_ritmo', 'dia_critico', 'mejora');
CREATE TYPE public.estado_accion AS ENUM ('propuesta','enviada','respondida','hablada','pospuesta','no_aplica','cerrada');
CREATE TYPE public.opcion_respuesta AS ENUM ('ahi_estare','necesito_apoyo','quiero_hablar');
CREATE TYPE public.categoria_apoyo  AS ENUM ('transporte','trabajo','economico','familiar','personal');  -- sin «salud» (dato sensible)

CREATE TABLE public.mesa_dia (            -- marca de «mesa armada»: el lote del día no cambia hasta mañana
    id_docente integer, fecha date, armada_en timestamptz NOT NULL DEFAULT app.now(),
    regla jsonb NOT NULL,                  -- {tope, revisados, candidatos:{...}, fuera:[{id_alumno,id_grupo,motivo}]}
    PRIMARY KEY (id_docente, fecha));

CREATE TABLE public.accion_docente (
    id_accion integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_docente integer NOT NULL, id_grupo integer NOT NULL, id_alumno integer NOT NULL,
    motivo public.motivo_mesa NOT NULL,
    huella varchar(40) NOT NULL,           -- nivel: 'r0' | 'q:<id_sesion_inicio>' | 'd1:5'
    hechos jsonb NOT NULL,                 -- cifras de la selección; NUNCA puntaje de riesgo
    prioridad smallint NOT NULL, fecha_mesa date NOT NULL,
    estado public.estado_accion NOT NULL DEFAULT 'propuesta',
    creada_en timestamptz NOT NULL DEFAULT app.now(),   -- inicio del cronómetro (primera vez en una mesa)
    atendida_en timestamptz, respondida_en timestamptz, pospuesta_hasta date,
    motivo_cierre varchar(30),             -- chips cerrados de «Ya hablé» / «No aplica»
    seguimiento_vence timestamptz,         -- respuesta apoyo/hablar + horas_seguimiento (48 h, Georgia State)
    id_mensaje integer,
    FOREIGN KEY (id_alumno, id_grupo) REFERENCES public.inscripcion (id_alumno, id_grupo),
    UNIQUE (id_docente, id_grupo, id_alumno, motivo, huella),
    CHECK ((estado = 'pospuesta') = (pospuesta_hasta IS NOT NULL)),
    CHECK (estado IN ('propuesta','pospuesta','no_aplica') OR atendida_en IS NOT NULL));

-- Núcleo de mensajería COMPARTIDO con F04: si F04 llega antes, se reutilizan sus tablas; si no, F05 las crea así.
CREATE TABLE public.mensaje (
    id_mensaje integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_docente integer NOT NULL, id_grupo integer NOT NULL, enviado_por integer NOT NULL REFERENCES public.usuario,
    alcance varchar(10) NOT NULL DEFAULT 'alumno' CHECK (alcance IN ('alumno','grupo')),   -- 'grupo' = avisos de F04
    plantilla varchar(30), cuerpo varchar(800) NOT NULL CHECK (length(btrim(cuerpo)) >= 20),
    hechos jsonb, editado boolean NOT NULL DEFAULT false,
    acepta_respuesta boolean NOT NULL DEFAULT true, enviado_en timestamptz NOT NULL DEFAULT app.now());

CREATE TABLE public.mensaje_destinatario (   -- sustituye a «respuesta_mensaje»: una respuesta por destinatario
    id_mensaje integer REFERENCES public.mensaje, id_alumno integer REFERENCES public.alumno,
    leido_en timestamptz, opcion public.opcion_respuesta, motivo_categoria public.categoria_apoyo, respondido_en timestamptz,
    PRIMARY KEY (id_mensaje, id_alumno),
    CHECK ((opcion IS NULL) = (respondido_en IS NULL)),
    CHECK ((motivo_categoria IS NOT NULL) = (opcion = 'necesito_apoyo')));
```

- **Parámetros nuevos** (con `CREATE OR REPLACE VIEW app.parametro_meta` que conserva los 14 actuales):

  | Núm. | Clave | Valor | Rango | Nota |
  |---|---|---|---|---|
  | 15 | `mesa_tope_diario` | 3 | 1–5 | Fijo para el docente; techo duro de 5 |
  | 16 | `mesa_dias_posponer` | 3 | — | — |
  | 17 | `mensajes_alumno_semana` | 2 | — | — |
  | 18 | `horas_seguimiento` | 48 | — | — |

- **Bitácora.**
  - `ALTER TYPE accion_bitacora ADD VALUE 'envio_mensaje'`.
  - `ck_bitacora_entidad` suma `mensaje` y pasa de 19 a 20 entidades.
  - `valor_nuevo` guarda `{id_alumno, id_grupo, plantilla, editado}`, **nunca** el cuerpo ni la categoría de la respuesta.
- **RLS** (sin escritura directa; todo pasa por RPC DEFINER; `REVOKE` explícito como en `0240`):
  - `accion_docente`, `mesa_dia`: `SELECT` solo si `app.rol() = 'docente' AND id_docente = app.id_docente()`. **Sin política de administrador**, por minimización. Las métricas institucionales vendrían después por RPC agregada.
  - `mensaje`: el docente ve los suyos; el alumno, los que cumplen `app.es_destinatario(id_mensaje)`. Es un ayudante DEFINER para evitar que una política llame a otra en recursión, el mismo patrón de `0010_app_helpers`.
  - `mensaje_destinatario`: el alumno ve `id_alumno = app.id_alumno()`; el docente, `app.es_remitente(id_mensaje)`. `motivo_categoria` solo lo ven el alumno y el docente que envió.
- **Disparadores**: ninguno nuevo. Un solo escritor, la RPC, actualiza el destinatario y la acción en la misma transacción. Cuando exista F15, ahí se engancha la apertura del caso.

**`0141_mesa_motor.sql`**: funciones `app.*` (lógica en PostgreSQL).

- `app.meta_asistencia(p_id_inscripcion)`: el **motor compartido** con F07, F09 y F24 (§4.4).
- `app.quiebres_ritmo(p_id_docente)` → `TABLE(id_grupo, id_alumno, direccion, id_sesion_inicio, aus_recientes, ses_recientes, aus_antes, ses_antes, metodo)`. Es el **contrato de F23**: la v1 trae un cuerpo provisional y F23 lo reemplaza con `CREATE OR REPLACE` y la misma firma.
- `app.armar_mesa(p_id_docente, p_hoy)`: el selector determinista (el «armarMesa» del brief, trasladado a SQL; §4.1).
- `app.mesa_redactar(p_plantilla, p_hechos) RETURNS text` (`IMMUTABLE`): las plantillas fijas en un solo lugar, revisables por tutoría.

**`0142_api_mesa.sql`**: RPC (de 82 a 88 en el MVP y 90 en la versión completa).

| RPC | Tipo | Rol | Hace / devuelve | Errores |
|---|---|---|---|---|
| `api_mesa_docente()` | VOLATILE DEFINER | docente | Arma la mesa una vez al día (candado asesor `pg_advisory_xact_lock(140, v_doc)` + `mesa_dia`) y después solo lee. Devuelve `{fecha, ahora, armada_en, tope, revisados, regla, items[], pendientes_de_ti[], tareas{revision_vence_24h, vence_primero, sesiones_sin_cerrar}, metricas{}}` | NO_AUTORIZADO |
| `api_mesa_marcar(p_id_accion, p_estado, p_motivo DEFAULT NULL)` | VOLATILE DEFINER | docente | `hablada`, `pospuesta`, `no_aplica`, `cerrada`, o `propuesta` para deshacer (≤ 10 min) | NO_ENCONTRADO, ACCION_NO_VIGENTE, VALIDACION |
| `api_mensaje_borrador(p_id_accion, p_plantilla DEFAULT NULL)` | STABLE DEFINER | docente | `{plantilla, plantillas[], texto, hechos, huella_hechos, avisos[], tope{enviados_semana, maximo}}` | NO_ENCONTRADO, ACCION_NO_VIGENTE |
| `api_mensaje_enviar(p jsonb)` | VOLATILE DEFINER | docente | `p = {id_accion, cuerpo, plantilla, huella_hechos}` (jsonb para que F04 lo amplíe). Valida pertenencia, inscripción activa, tope semanal y huella; inserta el mensaje y su destinatario; la acción pasa a `enviada`; asienta en bitácora | TOPE_MENSAJES (429), CIFRAS_DESACTUALIZADAS (409), ACCION_NO_VIGENTE (409), VALIDACION |
| `api_mis_mensajes(p_limit DEFAULT 20, p_offset DEFAULT 0)` | STABLE DEFINER | alumno | `{sin_responder, total, items[{id_mensaje, enviado_en, remitente, materia, id_grupo, clave_grupo, cuerpo, hechos_visibles{faltas, maximo, restantes}, opcion, motivo_categoria, respondido_en}], opciones[], categorias[]}` | NO_AUTORIZADO |
| `api_mensaje_responder(p_id_mensaje, p_opcion, p_categoria DEFAULT NULL)` | VOLATILE DEFINER | alumno | Registra la respuesta, fija `leido_en` y pasa la acción a `respondida` con `seguimiento_vence = now + 48 h` si la opción es apoyo o hablar | NO_ENCONTRADO (también para mensajes ajenos, para no revelar que existen), MENSAJE_YA_RESPONDIDO, VALIDACION |
| `api_mesa_historial(...)` (versión completa) | STABLE DEFINER | docente | Historial de 30 días y métricas ampliadas | |
| `api_mensajes_marcar_leidos(p_ids integer[])` (versión completa) | VOLATILE DEFINER | alumno | Estado «Leído» | |

Detalles de implementación:

- Como las RPC son DEFINER, `v_resumen_asistencia` (`security_invoker`) se ejecuta con los permisos del dueño. Hay que filtrar `g.id_docente = v_doc` explícitamente, como ya hace el respaldo de `api_docente_panel`.
- `api_mensajes_docente` del brief queda para F04 (lista de avisos de grupo). En F05, el estado de los mensajes viaja dentro de `items[].mensaje`.
- Los códigos nuevos van en `CODIGOS_POR_STATUS` de `lib/api/errors.js` y en el registro de `API-RPC.md`.

## 4. Cálculo y algoritmo

### 4.1 Selector determinista `app.armar_mesa`

Por qué en SQL y no como función pura de JS: es una decisión que se persiste. Arranca el cronómetro de las métricas, tiene que dar la misma mesa en el proyector, en otra pestaña y en el modo local, y la regla de CONVENCIONES.md pone la lógica de negocio en PostgreSQL.

1. **Universo.** Inscripciones `activa` de los grupos del docente en su periodo más reciente (la misma regla que «Mis grupos»), sin `supera_limite`. Los alumnos que ya no tienen derecho a examen siguen en `AlertasAsistencia` y en coordinación: ya no es prevención. El total da la cifra «revisé N alumnos».
2. **Señales de alumno.**

   | Motivo | Condición | Huella |
   |---|---|---|
   | **L · límite** | `faltas_restantes_antes_limite ≤ 2` | `'r'‖restantes` |
   | **Q · cambio de ritmo** | `app.quiebres_ritmo` con dirección `alza` | `'q:'‖id_sesion_inicio` |
   | **D · día crítico** | ≥ 3 ausencias con día conocido; el día con más ausencias concentra ≥ 50 % (el mismo umbral de `concentracionDia` en `risk/riesgo.js`); ese día es **hoy** y su clase de hoy **aún no empieza** (`app.now() < app.instante_clase(fecha, hora_inicio)`) | `'d'‖isodow‖':'‖n_aus` |
   | **M · mejora** | `quiebres_ritmo` con dirección `baja` | |

3. **Supresión: entra solo si es nuevo o empeoró.**
   - Se excluye si ya existe la misma (alumno, grupo, motivo, huella) en `enviada`, `respondida`, `hablada`, `no_aplica` o `cerrada`, o en `pospuesta` con `pospuesta_hasta > hoy`.
   - Para L, se excluye además si ya hubo una acción atendida con `restantes` menor o igual. Si se aprueba un justificante, el alumno no reentra.
   - Un alumno atendido en los últimos 7 días solo vuelve si llegó a `r0`.
4. **Orden dentro de cada motivo** (desempate determinista):
   - **L**: clase hoy que aún no empieza, luego `restantes` ascendente, luego racha descendente, luego matrícula.
   - **Q**: clase hoy pendiente, luego magnitud (tasa reciente − tasa anterior) descendente, luego matrícula.
   - **D**: hora de la clase ascendente, luego participación descendente, luego matrícula.
5. **Selección: la regla que se ve.** Primero uno por señal, en el orden L, Q, D. Después se rellena con L > Q > D > M hasta `mesa_tope_diario`. Cada alumno aparece una sola vez; sus otras señales van en `hechos.tambien`.
6. **Materialización.** `INSERT … ON CONFLICT (uq) DO UPDATE SET fecha_mesa = hoy, prioridad, hechos` (una `pospuesta` vencida vuelve a `propuesta`). Se escribe `mesa_dia.regla` con los conteos y la lista de quienes quedaron fuera. Una `propuesta` de días anteriores sigue siendo elegible y compite de nuevo, con la insignia «desde el lunes»; `creada_en` no se reinicia.
7. **Fuera del tope:**
   - `tareas`: registros pendientes con `app.limite_correccion` dentro de 24 h, y sesiones `abierta` cuya `hora_fin` ya pasó;
   - `pendientes_de_ti`: acciones `respondida` con `seguimiento_vence` sin cerrar.

**Resultado con la semilla** (lun 14-sep 07:12, docente1; verificarlo tras `seed-demo.sh --reset`):

| # | Alumno | Motivo | Línea de la tarjeta |
|---|---|---|---|
| 1 | Luis A. · 5C | L, `r0` | «Faltó sus últimas 8 clases. Le quedan 0 faltas y hoy tiene clase a las 09:00.» |
| 2 | Sofía F. · 5C | Q | «Faltó sus últimas 3 clases; antes no había faltado.» |
| 3 | Paola H. · 5C | D | «Hoy es lunes: sus 5 faltas fueron en lunes. Clase hoy a las 09:00.» |

Quedan fuera 7: Miguel D. y Héctor M. del 3A (`r0`, clase ya empezada), Luis A. del 3A (`r1`), los dos Iván C., Paola H. del 3A y Sofía F. del 3A. Los tres de la mesa ven al docente hoy a las 09:00.

### 4.2 Cambio de ritmo: provisional hasta F23

- **Serie.** Sesiones cerradas con registro definitivo; se omiten `justificado` y `pendiente`, igual que en `resumirAsistencia`.
- **Ventanas.** R = últimas 4 sesiones; B = las anteriores, con un mínimo de 6.
- **`alza`**: ausencias(R) ≥ 3 y ausencias(B)/|B| ≤ 0,25.
- **`baja`**: ausencias(R) = 0 y al menos 3 ausencias en las 4 sesiones previas a R.
- **`id_sesion_inicio`**: primera ausencia de la racha actual. Así la huella no cambia con cada sesión nueva y el alumno no reentra todos los días.
- **Verificado en la semilla.** Sofía F. del 5C entra (R 3/4 y B 0/13). Luis A. del 5C no entra por esta señal (B 4/13, porque su caída es antigua), sino por límite.
- **Reemplazo de F23.** El mismo contrato con `metodo = 'cusum'`: CUSUM por alumno con los parámetros de `stats/cambios.js` (k = 0,5σ, h = 4σ, línea base con el primer tercio) y su `inicio`. Lleva una prueba de paridad SQL contra JS sobre los mismos vectores.

### 4.3 Día crítico

Replica en SQL el conteo de `concentracionDia` (≥ 3 ausencias, participación > 0,5). Una prueba de paridad en vitest y en SQL usa el mismo vector de estados y espera el mismo día y la misma participación.

### 4.4 Motor de meta: `app.meta_asistencia(p_id_inscripcion)`

Es la única fuente de las cifras del mensaje y se comparte con F07, F09 y F24. Parte de `v_resumen_asistencia`:

- `F` = faltas equivalentes; `Fmax` = faltas máximas permitidas; `R = Fmax − F`.
- `M` = sesiones no suspendidas y no cerradas desde hoy (5C: 45 − 17 = **28**).
- `retardos_para_otra = rpa − (retardos mod rpa)`.
- `necesarias = M − R`.
- `proxima` = {fecha, hora, aula, es_hoy}.
- `en_revision` = pendientes más justificantes pendientes.

Afirmaciones permitidas en las plantillas:

- «Te quedan R faltas para las M clases que restan» (siempre cierta).
- Con `R = 0`: «ya no te queda margen».
- Con `retardos mod rpa > 0`: «con k retardos más se suma otra falta».
- Una meta corta presentada **como meta**, no como garantía.

No se usan porcentajes ni comparaciones con compañeros: se dicen días, siguiendo a Rogers y Feller.

Borrador real de Luis (plantilla `aviso_limite`):

> «Hola, Luis. Te escribe Patricia Ortega, de Matemáticas Financieras (5C). Llevas 9 faltas y el máximo para conservar tu derecho a examen es 9: ya no te queda margen. Ojo: con 2 retardos más se suma otra falta (3 retardos = 1 falta). Quedan 28 clases; la próxima es hoy a las 09:00 en el B-04. Si algo te está impidiendo venir, respóndeme con un toque y lo vemos.»

Las otras plantillas:

- `te_extranamos`, para Q y D: «faltaste a 3 de las últimas 4 clases…» o «hoy es lunes y tenemos clase a las 09:00: te espero».
- `reconocimiento`, para M (versión completa, con F23).

### 4.5 Garantías de las cifras

- **Huella.** `huella_hechos = md5` de `{F, Fmax, R, retardos, M, proxima}`. Al enviar se recalcula; si cambió (por ejemplo, porque cerró una sesión), se devuelve `CIFRAS_DESACTUALIZADAS` y la interfaz pide el borrador de nuevo.
- **Prueba SQL.** Para cada plantilla y escenario de prueba, todo token numérico del texto pertenece a `hechos` ∪ {1} (la regla de 3 retardos = 1 falta). La hora y el aula se comparan como cadenas.

### 4.6 Métricas de proceso (en `api_mesa_docente.metricas`, ventana de 30 días)

- **De la alerta al contacto (mediana)**: `atendida_en − creada_en`.
- **Con respuesta del alumno**: respondidas ÷ enviadas.
- **Declarados con «Ya hablé»**: se cuentan **aparte** y nunca se suman al porcentaje verificado.
- **Última alerta → respuesta**: el «48 s» de la demo.
- Rótulo fijo: «Miden lo que hiciste con la mesa, no si el alumno volvió a clase».

## 5. Interfaz

**Se reutiliza**:

- `ui/TarjetaFila`, `ui/Sparkline`, `ui/PanelLateral`, `ui/Detalles`, `ui/Pills`, `ui/StatCard`, `ui/Badge`, `ui/Button`, `ui/MenuAcciones`, `ui/Textarea`, `ui/Alert`, `ui/EmptyState` («Nada urgente hoy. Revisé 73 alumnos»), `ui/DataState` y `ui/CalendarioAsistencia`;
- `alumno/BarraFaltas`;
- `motion/StaggerList` (entrada única de las tarjetas) y `lib/motion/usePrefersReducedMotion` (la transición de estado se apaga con «reducir movimiento»);
- `useApiQuery` (con `refetchInterval`, pausa con la pestaña oculta y relectura con `EVENTO_RELOJ_CAMBIO`) y `useApiMutation`.

Iconos Lucide: `TriangleAlert` (límite), `TrendingUp` (ritmo), `CalendarClock` (día), `TrendingDown` (mejora), `ListChecks` e `Inbox`. Colores solo por token.

**Componentes nuevos** (una carpeta por componente, con `index.js`, utilidades y pruebas):

| Carpeta | Contenido |
|---|---|
| `components/docente/MesaHoy/` | `MesaHoy.jsx`, `useMesaHoy.js` (sondeo adaptativo: **5 s** si hay un envío de hace menos de 15 min esperando respuesta, si no 60 s), `mesaHoy.utils.js` (`intervaloSondeo`, `haceCuanto` contra `ahora` del servidor más el tiempo transcurrido, `modoClase`, `etiquetaEstado`) |
| `components/docente/TarjetaMesa/` | Tarjeta, estado en vivo con «Deshacer» en línea (10 s) y chips opcionales de «Ya hablé» («En clase», «Asesoría», «Teléfono o mensaje») y de «No aplica» («Ya lo justificó», «Dato incorrecto», que lleva a Revisión, «Baja en trámite») |
| `components/docente/BorradorMensaje/` | Carga diferida; se precarga al pasar el cursor o enfocar «Escribirle» |
| `components/docente/ReglaMesa/` | El `Detalles` «Por qué estos y no otros» con la lista de quienes quedaron fuera |
| `components/docente/MetricasMesa/` | StatCards de proceso |
| `app/(app)/docente/mesa/page.jsx` | Página delgada |
| `components/alumno/BandejaMensajes/` | Lista de notas, con `useBandejaMensajes` |
| `components/alumno/NotaDocente/` | Nota con las respuestas de un toque incluidas |
| `app/(app)/alumno/mensajes/page.jsx` | Página delgada |
| `lib/api/mesa.js` | 6 envoltorios |
| `layout/BottomNav` y `Sidebar` | Prop `insignia` en los ítems (`navItems.js`) |
| `layout/ContadorMensajes/` | Carga diferida y solo con `rol === 'alumno'`. Sondea `api_mis_mensajes({ limit: 1 })` cada 60 s, o cada 5 s si `api_ahora().reloj_simulado`. Solo con la página visible |

**Carga diferida y presupuesto.** `/docente` tiene 226,1 KB gz, con 14,6 KB de margen.

- `ContenidoPanel` hace `lazy(() => import('../MesaHoy/MesaHoy.jsx'))`, y `PanelDocente` precarga `cargarMesa()` en el mismo `useEffect` que `cargarContenido`.
- `BorradorMensaje` es un tercer chunk, que solo se descarga al tocar «Escribirle».
- Objetivo: `/docente` con un JS inicial de +0,3 KB como máximo y `/alumno` con +1 KB como máximo (ya está en +21,3 %). Medido con `NEXT_DIST_DIR=.next-mesa npm run build` y `node ../scripts/measure-bundle.mjs .`, sin compilar mientras haya otros frentes en el árbol.
- No se agregan librerías nuevas.

## 6. Privacidad, ética y mitigaciones

- **Marco legal.** Lo pide la LFPDPPP. Como universidad pública, a la UNACH probablemente le aplican también la LGPDPPSO y la ley de Chiapas; hay que confirmarlo con la Unidad de Transparencia. Se agrega al aviso de privacidad la finalidad «contacto del docente para el seguimiento de la asistencia».
- **Datos sensibles.** No hay categoría «salud». «Personal (prefiero platicarlo)» no revela nada y no hay texto libre del alumno en la v1. La categoría solo la ven el alumno y su docente; ni el administrador ni la bitácora.
- **Sin puntaje opaco.** La mesa no usa `evaluarRiesgoAlumno`: tres reglas con cifras, visibles. El motivo vive en `accion_docente`, que el alumno no puede leer, y el mensaje nunca dice «riesgo», no lleva porcentajes ni compara con compañeros.
- **Proyector.** Se usan nombre de pila e inicial, con el «modo clase» que pliega la sección mientras hay una sesión abierta. Nada se muestra a otros alumnos ni hay rankings.
- **Saturación.** Tope de 3 (techo institucional de 5), lote fijo por día, sin reentrada salvo que empeore, como máximo 2 mensajes por alumno por semana y una pausa de 7 días tras atender a un alumno.
- **Inflación de «Ya hablé».** El contacto declarado y el verificado (con respuesta) son métricas separadas, rotuladas como proceso y no como impacto.
- **Exactitud.** Cifras del servidor, huella al enviar, aviso si hay registros en revisión y prueba de que los números del texto coinciden con `hechos`.
- **Equidad.** Si el alumno no tiene datos o teléfono, el docente puede hablar en persona y marcar «Ya hablé». «Sin respuesta» solo lo ve el docente. Si el alumno no tiene cuenta, el borrador lo avisa.
- **Bitácora y registros.** La bitácora no guarda el cuerpo. No se registran nombres ni categorías en los logs de Next. La retención llega hasta el fin del periodo siguiente, con una purga por job en la versión completa.
- **Sin LLM en la v1.** Si llega, sería con seudónimos, con el servidor rellenando las cifras, un interruptor por docente y revisión jurídica (ver §7).

## 7. Plan

**MVP demostrable, tamaño L: unos 15,5 días, 3 semanas para una persona.**

| Pieza | Dueño (ARCHITECTURE §7) | Días |
|---|---|---|
| `0140`: 4 tablas, 4 enums, RLS, parámetros 15–18, bitácora | db-api-a (+ db-schema: conteos en `schema_01_estructura`, `schema_04_rls`) | 1,5 |
| `0141`: `meta_asistencia`, `quiebres_ritmo` provisional, `armar_mesa`, `mesa_redactar` (2 plantillas) | db-api-a | 2,5 |
| `0142`: las 6 RPC del MVP | db-api-a | 2 |
| Pruebas SQL `api_c_30_mesa.sql`, `api_c_31_mensajes.sql` (selección con reloj fijo, huellas, topes, accesos cruzados entre alumnos y docentes, cifras del texto) | db-api-a | 1,5 |
| `lib/api/mesa.js`, `errors.js`, `sincronia.test.js` (de 82 a 88 y el módulo nuevo), `gen-api-catalog` | data-layer, db-api-b | 0,5 |
| UI docente: MesaHoy, TarjetaMesa, BorradorMensaje, ReglaMesa, modo clase, `/docente/mesa` delgada | screens-sesiones | 3 |
| UI alumno: bandeja, NotaDocente, chip en ResumenMaterias | screens-reportes | 2 |
| Insignia en BottomNav y Sidebar, ContadorMensajes | ui-kit | 0,5 |
| Demo: `--reset` limpia las 4 tablas, sección en DEMO.md, `-H 0.0.0.0` y `allowedDevOrigins` desde `SUSAN_DEV_ORIGINS` | demo, adapters, integrador | 1 |
| Peso, 360 px, reducir movimiento, accesibilidad | screens-sesiones | 0,5 |
| Docs: DECISIONS §12 (extensión 21), `docs/api/mesa.md`, NUMERICS (reglas y paridad), MODULOS | docs (+ integrador en ARCHITECTURE §8) | 0,5 |

**Versión completa**, que se suma después:

| Pieza | Esfuerzo |
|---|---|
| `api_mesa_historial` y historial con filtros | 1,5 d |
| `api_mensajes_marcar_leidos` y estado «Leído» | 0,5 d |
| Plantilla `reconocimiento` y motivo M | 1 d |
| CUSUM/EWMA por alumno en `quiebres_ritmo` | F23, 2–3 d |
| Casos de Tutorías desde «Necesito apoyo» | F15, integración de 1 d |
| Avisos a grupo sobre las mismas tablas | F04 |
| «Escuchar» con `speechSynthesis` (oculto si no hay voz en español) | 0,5 d |
| Indicador «Vino el 16-sep» tras «Ahí estaré», sin afirmar causalidad | 1 d |
| Purga por retención | 0,5 d |
| LLM opcional en «Asistente» | 1,5–2 semanas más revisión jurídica; no recomendado todavía |

## 8. Guion de demo de 60 s

**Preparación** (no cuenta para los 60 s):

1. Correr `scripts/seed-demo.sh --reset`: deja el reloj en lun 14-sep 07:12, detenido.
2. En la tarjeta del reloj, pulsar **«Correr»**. Sin esto, todos los tiempos salen en 0 s.
3. En la laptop con el proyector, entrar como `docente1@` en `/docente`.
4. En un **teléfono propio**, entrar como `e260068@susan.local` (Luis A., 5C) en `/alumno`. Conectar laptop y teléfono al hotspot de un tercer dispositivo propio, no a la red del lugar.
5. Opcional: espejo del teléfono en una esquina del proyector.
6. Dejar abierto «Fijar hora» con `2026-09-18 06:50` ya escrito.

**Planes B:**

- **B**: una segunda ventana de Chrome con el perfil «Alumno» a 390 px, junto al panel.
- **C**: un video de 15 s del teléfono.

| Tiempo | Qué se hace | Qué se dice |
|---|---|---|
| 0–8 s | Proyector: «3 cosas para hoy», con las tres tarjetas del 5C | «Lunes, 7:12. Antes de mi clase de las 9, SUSAN revisó a mis 73 alumnos y me dejó tres, no setenta y tres alertas.» |
| 8–16 s | Señalar la tarjeta de Luis A. y su Sparkline | «Luis faltó sus últimas 8 clases. Le quedan cero faltas y hoy tiene clase.» |
| 16–26 s | «Escribirle», se ve el borrador y «Enviar» | «Las cifras las pone SUSAN: 9 de 9, 2 retardos más suman otra falta, la próxima es hoy a las 9. Yo solo lo firmo.» |
| 26–40 s | Teléfono: aparece la insignia 1, se abre la nota, «Necesito apoyo», «Transporte», «Enviar» | «Luis no tiene que explicar nada: un toque.» |
| 40–48 s | Proyector, solo: «Contestó · Transporte · hace 3 s · de la alerta a la respuesta: 48 s · responde antes del mié 07:13» | «De la alerta a una respuesta en menos de un minuto, y me fija 48 horas para atenderlo.» |
| 48–60 s | «Fijar hora» al vie 18-sep 06:50. La mesa se reacomoda: entra Iván C. (3A) con «Hoy es viernes: 6 de sus 7 faltas fueron en viernes», y Luis sube a «Pendiente de ti» | «El martes no hay clase y el miércoles es feriado, así que salto al viernes. Entra Iván porque es viernes. Y lo que prometí no desaparece: Luis sigue arriba.» |

## 9. Entradas para `web/src/lib/modulos.js` y `navItems.js`

```js
// Activos nuevos (después de 'pasar-lista' para no romper el orden que exige modulos.test.js)
{ id: 'mesa-de-hoy', titulo: 'Mesa de hoy', descripcion: 'Cada mañana, hasta 3 alumnos que conviene atender hoy, con el motivo en una línea y un mensaje listo con sus cifras exactas.',
  icono: ListChecks, categoria: 'asistencia', roles: ['docente'], estado: 'activo', href: '/docente/mesa', tono: 'rosa' },
{ id: 'mensajes', titulo: 'Mensajes', descripcion: 'Notas de tus docentes sobre tu asistencia; respóndelas con un toque.',
  icono: Inbox, categoria: 'asistencia', roles: ['alumno'], estado: 'activo', href: '/alumno/mensajes', tono: 'rosa' },

// navItems.js
// docente: { href: '/docente/mesa', label: 'Mesa de hoy', icon: ListChecks, grupo: 'Asistencia' }
// alumno:  { href: '/alumno/mensajes', label: 'Mensajes', icon: Inbox, insignia: 'mensajes' }   // sin grupo, junto a «Mi asistencia»
```

Ajustes a los módulos que siguen en «pronto»:

- **`asistente`**: en `queIncluye`, «Borradores de mensaje para alumnos en riesgo» pasa a «Borradores con IA a partir de la Mesa de hoy (opcional, con seudónimos)».
- **`tutorias`**: se agrega «Casos abiertos desde las respuestas “Necesito apoyo” de la Mesa de hoy».
- **`comunicados`**: sigue en «pronto» (F04) y compartirá la bandeja `/alumno/mensajes`.
- **`modulos.test.js`**: hay que actualizar `modulosActivos('alumno')` a `['mi-asistencia', 'mensajes', 'registro-facial']`.

**Pedidos fuera de la zona de F05:**

- **db-api-a**: el punto 1 de §0 (`to_regprocedure` en `api_docente_panel`).
- **db-schema**: conteos de tablas y RLS.
- **integrador**: `allowedDevOrigins` y ARCHITECTURE §8, punto 9 (tablas 22–25).
- **demo**: limpieza de las tablas nuevas en `--reset`.
- **adapters**: host de `dev-all.sh` para el teléfono.

Archivos de referencia: `/Users/diegoguerrero/Developer/SUSAN/supabase/migrations/0103_series_alertas_rpc.sql`, `/Users/diegoguerrero/Developer/SUSAN/supabase/migrations/0131_api_sesion_docente.sql`, `/Users/diegoguerrero/Developer/SUSAN/supabase/migrations/0240_laboratorios.sql`, `/Users/diegoguerrero/Developer/SUSAN/web/src/components/docente/PanelDocente/ContenidoPanel.jsx`, `/Users/diegoguerrero/Developer/SUSAN/web/src/lib/numerics/risk/riesgo.js`, `/Users/diegoguerrero/Developer/SUSAN/web/src/lib/numerics/stats/cambios.js`, `/Users/diegoguerrero/Developer/SUSAN/web/src/components/layout/Sidebar/navItems.js`, `/Users/diegoguerrero/Developer/SUSAN/web/src/lib/modulos.js`, `/Users/diegoguerrero/Developer/SUSAN/supabase/seed/03_historial.sql`.