# supabase/ · base de datos de SUSAN

PostgreSQL 16 (Supabase en producción; PostgreSQL local de Homebrew en desarrollo, sin Docker). Las migraciones de
`migrations/` son **idénticas** en ambos entornos: lo que Supabase ya trae (roles `anon`/`authenticated`/`service_role`,
esquema `auth`, esquema `storage`, esquema `extensions`) lo emula `local/00_supabase_stubs.sql` **solo en local**.

```
supabase/
├─ migrations/   0001-0099 db-schema · 01xx db-api-a · 02xx db-api-b (se aplican en orden lexicográfico)
├─ local/        00_supabase_stubs.sql (solo PostgreSQL local)
├─ seed/         semilla de demostración (escenario lunes 14-sep-2026, periodo 2026-2)
└─ tests/        _harness.sql, _fixtures.sql (soporte) y pruebas *.sql
```

## Scripts

Todos exportan `LC_ALL=en_US.UTF-8` (sin eso el postmaster aborta en macOS) y usan
`/opt/homebrew/opt/postgresql@16/bin`. Clúster en `$SUSAN_LOCAL_DIR/pgdata` (`~/.susan-local/SUSAN/pgdata` si el proyecto está en el Escritorio; ver `scripts/local-dir.sh`), puerto **54329**, socket en `/tmp`, autenticación
`trust` solo en `127.0.0.1`, `fsync` desactivado (solo desarrollo), zona horaria del servidor `UTC` como Supabase.

| Script | Qué hace |
|---|---|
| `scripts/db-up.sh [--seed]` | Crea el clúster si falta, lo arranca, crea la BD `susan` y aplica los stubs y las migraciones **pendientes** (hay un registro en `supabase_migrations.schema_migrations`). Idempotente. Con `--seed` carga la semilla una sola vez. |
| `scripts/db-reset.sh [--no-seed]` | Elimina y recrea `susan` desde cero: stubs + todas las migraciones + semilla. Úsalo cuando cambies una migración ya aplicada. |
| `scripts/db-down.sh` | Detiene PostgreSQL (los datos se conservan). |
| `scripts/db-psql.sh [args]` | `psql` contra la BD local (`-c "select ..."`, o interactivo). |
| `scripts/test-sql.sh [filtro...]` | Crea una BD temporal única (`susan_test_<pid>_<n>`), aplica stubs + migraciones + `_harness.sql` + `_fixtures.sql`, corre `tests/*.sql` en orden y la elimina. Sale distinto de 0 si algo falla. Puede correr en paralelo con otras ejecuciones. `KEEP_DB=1` conserva la BD; `VERBOSE=1` muestra la salida de los archivos que pasan; el filtro es subcadena del nombre (`schema_`, `api_a`). |

URL local: `postgres://127.0.0.1:54329/susan` (`LOCAL_DATABASE_URL`).

El reloj simulado se habilita **solo** con `ALTER DATABASE ... SET app.allow_fake_clock = 'on'`, que hacen los scripts al
crear `susan` y las BD de prueba. Después una sesión fija `SET app.fake_now = '2026-09-14 07:12:00-06'`. Un `SET` de sesión de
`allow_fake_clock` no basta: `app.reloj_simulado()` consulta `pg_db_role_setting`. En Supabase real nunca se activa.

## Semilla de demostración (`seed/`)

Determinista (hash de `(alumno, sesión)`, sin `random()` ni `now()`), datos ficticios `@susan.local`:

- Aulas **A-12** (cámara frente `navegador` + fondo `ip`, activas) y **B-04** (sin cámaras activas → sesiones `manual`).
- Docentes D0001 (3A y 5C), D0002 (3B), D0003 (licencia). Grupos **3A** (A-12, L-Mi-V 07:00), **3B** (A-12, Ma-Ju-V 09:00),
  **5C** (B-04, L-Mi-V 09:00): 25 alumnos cada uno (el último en baja), **48 sesiones** por grupo desde `horario_grupo`.
- Periodo 2026-2 inicia el lunes 3-ago-2026: el **lunes 14-sep-2026** abre la semana 7 y hay 17 sesiones `cerrada` por grupo
  con historial; 1 `suspendida` en el pasado más el 16-sep y el 16-nov. Las demás quedan `programada`.
- Patrones por ordinal dentro del grupo (ver cabecera de `03_historial.sql`): estable, perfecta, deterioro progresivo (2),
  ausencias en lunes / viernes, abandono repentino (2), ausentismo crónico (2), muchos retardos (2), faltas justificadas, baja.
- Un consentimiento revocado (3A #5) y uno vencido (3B #6): esos alumnos se registran con origen `manual` (RF-09).
- Justificantes: 12 aprobados, 3 rechazados, 3 pendientes; bitácora histórica (cierres por la cuenta de servicio y resoluciones).
- `10_local_auth.sql` (solo local) crea `auth.users` con la contraseña de DESARROLLO **`demo1234`**:
  `admin@`, `tecnico@`, `docente1@`…`docente3@` y `e260001@`…`e260025@` (alumnos de 3A), todos `@susan.local`.
- `99_recalcular.sql` llama `app.recalcular_grupo` por grupo **si existe** (la define db-api-a).
- La carga masiva de historial usa `session_replication_role = replica` (comentado en el archivo); los CHECK/UNIQUE siguen
  vigentes y las FK se cumplen por construcción. Las rutas `objeto_*` de documentos son ficticias (no existen en el bucket).
- En Supabase real no se aplica `10_local_auth.sql`; las cuentas de `usuario` deben existir en Auth con el mismo `auth_uid`.

## Esquema (migraciones 0001-0099)

| Migración | Contenido |
|---|---|
| `0001_esquemas` | Esquema `app`; privilegios por omisión cerrados; extensiones; **reloj único** (`app.now/tz/hoy/instante_clase/reloj_simulado`) |
| `0002_tipos` | Los 13 ENUM de la spec + `tipo_camara` (`ip` \| `navegador`); `estatus_sesion` incluye `suspendida` |
| `0003`-`0006` | Las 19 tablas (A académico, D seguridad, B operación, C biometría): 19 PK, 25 FK `ON DELETE RESTRICT` (salvo `horario_grupo`→`grupo` CASCADE), 20 UNIQUE, 30 CHECK (29 de la spec + `ck_camara_ip`) |
| `0007_indices` | `ux_plantilla_facial_activa`, `ux_indice_faiss_en_uso` (parciales) e índices de apoyo `ix_*` |
| `0010_app_helpers` | Identidad, visibilidad, errores, consentimiento, IP, cuenta de servicio y bitácora (abajo) |
| `0020_triggers` | `trg_asistencia_rn01`, `trg_asistencia_ciclo`, `trg_captura_rn06`, `trg_plantilla_rn13`, `trg_bitacora_sin_cambios`, `trg_bitacora_sin_truncate` |
| `0030_rls_grants` | RLS en las 19 tablas, `REVOKE` y `GRANT SELECT` solo respaldado por política |
| `0040_parametros` | 12 parámetros, `app.parametro_meta`, `app.validar_parametro`, cuenta de servicio |
| `0050_api_plataforma` | `api_yo`, `api_ahora`, `api_parametros_publicos` |
| `0090_storage_policies` | Bucket `susan-private` y política RESTRICTIVE (guardada con `to_regclass('storage.objects')`) |

Los `DEFAULT` de fechas usan `app.now()`/`app.hoy()` (equivalentes a `now()` salvo reloj simulado).

### Rechazos de los disparadores

El mensaje empieza con el nombre de la regla y el error lleva `CONSTRAINT = <regla>`, igual que un CHECK:
`ERRCODE 23514` (`rn01_asistencia_inscripcion_activa`, `rn05_asistencia_nace_pendiente`, `rn05_asistencia_confirmacion_lecturas`,
`rn05_asistencia_regreso_a_pendiente`, `rn05_asistencia_cambio_requiere_humano`, `rn06_asistencia_automatico_en_sesion_manual`,
`rn06_captura_camara_aula`, `rn09_asistencia_nace_justificada`, `rn09_asistencia_justificar_*`, `rn09_asistencia_justificado_inmutable`,
`rn13_plantilla_consentimiento_{ajeno,no_vigente,vencido}`); la bitácora usa `23000` (`trg_bitacora_sin_cambios`,
`trg_bitacora_sin_truncate`; `ENABLE ALWAYS`, valen también en modo `replica`). Las RPC deben validar antes y devolver su código
`P0001`+`HINT`; el disparador es la red de seguridad.

### Máquina de estados de `asistencia.estado` (`trg_asistencia_ciclo`, incluye `docs/api/revision.md` §5.4)

| De → A | Condición |
|---|---|
| nace `presente`/`retardo`/`ausente` | `manual` o `correccion`; el `automatico` solo nace `pendiente` o `ausente`; nunca `justificado`; `automatico` no existe en sesión `manual` |
| `pendiente` → `presente`/`retardo` | `automatico`: `conteo_detecciones >= min_detecciones_validas`; `manual`/`correccion`: decisión humana |
| `pendiente` → `ausente`, `presente`/`retardo`/`ausente` entre sí | solo `manual` o `correccion` |
| `ausente`/`retardo` → `justificado` | solo `correccion` |
| `*` → `pendiente`, `justificado` → `*`, `pendiente`/`presente` → `justificado` | nunca |

### Privilegios y RLS

- `anon`: nada. `authenticated`: solo `SELECT` donde hay política; **ninguna escritura directa** (todo por RPC `SECURITY DEFINER`).
  `service_role`: `BYPASSRLS` y `ALL` en las tablas, salvo `bitacora_auditoria` (solo `SELECT`; escribe `app.bitacora`).
- Política por rol (Tabla 36, probado en `tests/schema_04_rls.sql` con `t.conteos()`): administrador ve catálogo, asistencia,
  cuentas, bitácora, parámetros, consentimientos y plantillas (no justificantes ni capturas/detecciones); docente ve **sus grupos**
  (alumnos inscritos —también bajas—, sesiones, asistencia, justificantes, capturas, detecciones, cámaras del aula y plantillas de
  sus alumnos); alumno ve lo propio y el contexto de sus grupos (también los docentes de sus grupos); técnico ve aulas, cámaras,
  índice y parámetros. Una cuenta inactiva solo ve su fila de `usuario`.
- Funciones nuevas: **sin `EXECUTE` para PUBLIC** (`ALTER DEFAULT PRIVILEGES`), y en `public` tampoco para `anon`/`authenticated`.
  Cada RPC debe hacer `GRANT EXECUTE ... TO authenticated` (api) o `TO service_role` (svc) justo después de `CREATE FUNCTION`.
  Una función `INVOKER` llamada desde una política o RPC de lectura necesita `EXECUTE` para `authenticated` también en `app.*`.

### Esquema `app` (contratos de `docs/ARCHITECTURE.md` §11)

`now()` `tz()` `hoy()` `instante_clase(fecha, hora)` `reloj_simulado()` · `param(clave)` `param_num(clave)` `validar_parametro(clave, valor)`
+ vista `app.parametro_meta` (tipo, rango, unidad, orden de la Tabla 4) · `rol()` `id_usuario()` `id_docente()` `id_alumno()` `es_admin()`
`rol_de_usuario(id)` (todas resuelven desde `auth.uid()` y una cuenta inactiva no tiene rol) · `exigir_rol(VARIADIC roles)`
(`exigir_rol(NULL)` = cualquier rol activo; errores `NO_AUTENTICADO`, `CUENTA_NO_VINCULADA`, `CUENTA_INACTIVA`, `NO_AUTORIZADO`) ·
`grupos_visibles()` `puede_ver_grupo` `puede_ver_sesion` `puede_ver_alumno` · `consentimiento_vigente(id_consent)`
`tiene_consentimiento_vigente(id_alumno)` · `fallar(codigo, mensaje)` · `ip_origen()` · `bitacora(accion, entidad, id_registro,
anterior, nuevo, ip, id_usuario)` (solo `service_role`/DEFINER; usuario: explícito > sesión > cuenta de servicio) ·
`id_cuenta_servicio()` / `id_usuario_servicio()` / `asumir_cuenta_servicio()` (solo `service_role`).

Cuenta de servicio: `servicio@susan.local`, rol `tecnico`, `auth_uid = 00000000-0000-4000-8000-000000000001`, **sin** fila en
`auth.users` (nadie inicia sesión con ella). `app.asumir_cuenta_servicio()` fija los claims de la transacción para que `app.rol()`
sea `tecnico` y la bitácora quede a su nombre. Las listas de usuarios de la UI deberían ocultarla.

## Pruebas SQL (`tests/`)

Sin pgTAP. `_harness.sql` crea el esquema `t`; `_fixtures.sql` define `t.cargar_fixtures()` (catálogo mínimo, reloj fijo
lunes 14-sep-2026 07:12 hora del plantel; el cuadro de datos está documentado en la cabecera del archivo). Cada archivo:

```sql
BEGIN;
SELECT t.begin('api_a_cerrar_sesion');
SELECT t.cargar_fixtures();                              -- dentro de la transacción: termina en ROLLBACK
SELECT t.as_user('docente1@susan.test');                 -- authenticated + claims (también as_service, as_anon, as_postgres, as_uid_huerfano)
SELECT t.eq(public.api_yo() ->> 'rol', 'docente', 'rol del docente');
SELECT t.throws($q$ SELECT public.api_x() $q$, 'P0001:NO_AUTORIZADO', 'alumno no puede');   -- fichas: SQLSTATE, HINT, constraint o texto del mensaje
SELECT t.lives_rb($q$ ... $q$, 'flujo válido (se deshace)');  SELECT t.efecto($q$ modifica $q$, $q$ SELECT condicion $q$, 'nombre');
SELECT t.summary();                                      -- imprime la línea que lee test-sql.sh
ROLLBACK;
```

Ayudantes: `t.ok/eq/n(consulta)/lives/lives_rb/efecto/throws/conteos()/reloj(ts)` e ids por clave natural
(`t.id_alumno('A001')`, `t.id_grupo('3A')`, `t.id_sesion('3A', DATE '2026-09-14')`, `t.id_usuario(correo)`, `t.id_camara('A-12','frente')`,
`t.id_consent`, `t.id_plantilla`, `t.id_indice`, `t.id_asistencia`...). Cuentas de fixture: `admin@ docente1@ docente2@ alumno1@ alumno2@
alumno4@ tecnico@ alumno5@` (inactiva), todas `@susan.test`. Las pruebas de `schema_*` cubren 213 aserciones positivas y 172 rechazos.
