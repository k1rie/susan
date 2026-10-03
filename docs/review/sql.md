# Revision de seguridad de la capa SQL

Pruebas nuevas: `supabase/tests/review_sql_01_idor.sql` .. `review_sql_04_auditoria.sql` (se ejecutan con `scripts/test-sql.sh review_sql_`).
Las aserciones que demuestran un hallazgo llevan `HALLAZGO:` en el nombre y PASAN (describen el comportamiento actual defectuoso).

## Hallazgos

### H1 (major) Cambios de rol/cuenta, revocacion de consentimiento biometrico, baja de alumno y pase de lista manual no dejan bitacora
- `api_usuario_actualizar` (0205), `api_consentimiento_revocar` / `api_consentimiento_registrar` (0231), `api_alumno_cambiar_estatus` (0201/0204) y `api_registrar_manual` / `api_pase_lista_manual` (0132) escriben sin llamar a `app.bitacora` (ni directa ni por ayudante).
- Evidencia reproducible (`review_sql_04_auditoria.sql`, AU1..AU5): tras promover una cuenta de alumno a `administrador`, desactivar una cuenta, revocar un consentimiento, dar de baja a un alumno o marcar asistencia manual, `count(*)` de `bitacora_auditoria` sigue en 1 (solo el asiento de fixtures).
- Impacto: un administrador puede escalar privilegios o retirar el consentimiento de un alumno (lo que deja sin reconocimiento facial, RN-13) sin rastro; un docente puede fijar `presente` con `p_hora` retroactiva (hasta 1 h antes del inicio) sin asiento. La spec exige RNF-08 solo para correcciones, justificantes, parametros y consultas biometricas, asi que es endurecimiento mas que incumplimiento, pero la lista de la bitacora ("usada por las acciones sensibles") queda corta.
- Correccion: nueva migracion que agregue valores al ENUM `accion_bitacora` (p. ej. `cambio_cuenta`, `consentimiento`, `baja_alumno`, `asistencia_manual`) y que esas RPC llamen `app.bitacora(...)` con valor anterior y nuevo.

### H2 (minor) La IP de origen de la bitacora la declara el propio usuario
- `api_documento_url_autorizar(p_tipo, p_id_registro, p_ip inet)`, `api_parametro_actualizar(..., p_ip)` y `api_plantilla_registrar(..., p_ip)` toman la IP como argumento y la guardan tal cual en `bitacora_auditoria.ip_origen` ("explicito > sesion").
- Evidencia: `review_sql_04_auditoria.sql` IP1: admin llama con `'1.2.3.4'::inet` y el asiento queda con `ip_origen = '1.2.3.4'`. Como las `api_*` son invocables con el JWT directo contra PostgREST (sin pasar por el Route Handler), el actor controla su IP auditada (no repudio, RNF-08).
- Correccion: ignorar `p_ip` cuando el rol de la conexion es `authenticated` y tomar la IP de `app.ip_origen()` (cabecera `x-forwarded-for` de PostgREST); aceptar `p_ip` solo de `service_role`.

## Lo que resistio (checkedOk)
Ver el resumen estructurado entregado con este informe.
