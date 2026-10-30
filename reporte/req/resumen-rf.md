# Resumen de la verificación de los RF (RF-01 a RF-22)

Base: `origin/main`, commit `f742bb4`, revisado el 2026-10-30. Fuente funcional: `docs/spec/Avance1.txt` (Tabla 3 y Tabla 6).
Resultado detallado: `rf.json` (datos) y `rf.md` (tabla y explicación de cada hueco).

## Conteo

| Estado | Total | MUST | SHOULD |
|---|---|---|---|
| Implementado | **16** | 13 | 3 |
| Parcial | **6** | 5 | 1 |
| Pendiente | **0** | 0 | 0 |
| Total | 22 | 18 | 4 |

Por parte (un RF con varias partes cuenta en cada una): SW 19 RF (13 Implementado, 6 Parcial); BD 22 RF (16 y 6); IA 5 RF (4 y 1).
No se usó HW.

**No Implementados (todos Parcial):**

| RF | Prior. | Qué falta, en una línea |
|---|---|---|
| RF-01 | MUST | No existe la baja de materias ni de grupos (sin RPC, botón ni DELETE). Alumnos y docentes sí. |
| RF-03 | MUST | El muestreo cada 15 s lo dispara el navegador del docente, no el servidor; el periodo real supera 15 s y el criterio «80 ± 1 capturas» no está probado ni medido. |
| RF-10 | MUST | El cierre automático a la hora de fin existe como job pero nada lo programa (sin cron en el repositorio). El cierre por el docente funciona. |
| RF-11 | MUST | Igual: la resolución automática de pendientes a las 48 h no está programada. La corrección manual está completa. |
| RF-12 | SHOULD | El docente no tiene pantalla para registrar un justificante por el alumno (backend y ruta listos, sin interfaz). |
| RF-19 | MUST | Solo se asientan las consultas de recortes, documentos y fotos; las lecturas de asistencia no dejan bitácora; la IP depende de que el proxy reescriba `x-forwarded-for`. |

RF-10 y RF-11 pasan a Implementado al programar `/api/jobs/cerrar-sesiones` y `/api/jobs/resolver-pendientes` (RUNBOOK §4); no requieren lógica nueva.

## Criterio de estado

- **Implementado**: el comportamiento del RF está en el código, se alcanza desde la interfaz o la API y hay pruebas automáticas que cubren su criterio de «Verificación» de la Tabla 3.
- **Parcial**: falta una parte del texto del RF (código ausente o sin conectar a la interfaz) o su criterio de verificación no se puede comprobar.
- **Pendiente**: nada, o solo esquema. Ningún RF cae aquí: todos tienen al menos lógica de base de datos con pruebas y, salvo la parte de IA, una ruta o pantalla que la usa.
- Ante la duda se eligió el estado más bajo. Regla para las salvedades de despliegue: si el componente falta incluso en modo local (el programador de tareas), el RF baja a Parcial; si es el mismo código con otro transporte que no se ha ejecutado (Supabase real), se conserva el estado y se anota la salvedad.

## Cómo verifiqué

1. **Lectura de la especificación.** `Avance1.txt`, Tabla 3 (texto, prioridad y «Verificación» de cada RF) y Tabla 6 (trazabilidad a RN, BPMN, pantallas y tablas).
2. **Rastreo del camino real de cada RF** leyendo el código: componente en `web/src/components/**` -> `@/lib/api/*` o `@/lib/http/*` -> Route Handler en `web/src/app/api/**` y `web/src/lib/server/**` -> RPC en `supabase/migrations/**` (y, para IA, `recognition-service/app/**`). Se comprobó que cada pieza esté conectada (por ejemplo, que `registrarJustificante` solo lo use el portal del alumno).
3. **Lectura de `docs/DECISIONS.md`, `docs/DESIGN_PROGRESS.md`, `docs/RUNBOOK.md`, `docs/DEMO.md` y `docs/ARCHITECTURE.md`** para los recortes de alcance ya conocidos; lo que contradecía el código se anotó.
4. **Pruebas ejecutadas por mí** (sin levantar servidores):

| Suite | Comando | Resultado |
|---|---|---|
| SQL (PostgreSQL 16, BD temporal) | `PGBIN=/usr/lib/postgresql/16/bin PGUSER=postgres scripts/test-sql.sh` | 37 archivos, 0 con fallas; 1508 pruebas positivas y 953 negativas, 0 fallos (9.6 s). Coincide con `reporte/bd/pruebas-sql.txt`. |
| Web (vitest), toda la suite | `npx vitest run` en `web/` | 296 archivos, 3793 pruebas: 3744 pasan, 49 omitidas, 0 fallan. Las omitidas son las que necesitan la BD local o un servidor en :3000. |
| Web, las 7 suites que usan BD | `LOCAL_DATABASE_URL=... npx vitest run` sobre un clon temporal de `susan` (ya borrado) | 78 pasan, 2 fallan, 6 omitidas. Pasan `realmode.test.js` (14, Auth/Storage contra GoTrue simulado), `auth.test.js` local (5) y `web_seguridad.test.js` (parte sin servidor). Las 2 fallas son de `reloj.rpc.test.js` (reloj de demostración): mi clon con `pg_dump` no trae el ajuste a nivel de BD `app.allow_fake_clock=on` que sí tiene `susan`; no tocan ningún RF. |
| Reconocimiento (pytest) | venv de Python 3.11 con `requirements.txt` | 112 pasan, 1 falla, 6 omitidas (marcador `ml`, requieren modelos de InsightFace). La falla es `test_plantilla.py::test_diversidad_baja_avisa_solo_con_fotogramas_casi_identicos` (espera coseno 1.0 y obtiene 0.999), repetible; mi entorno (numpy 2.4.6, faiss-cpu 1.15.1, Pillow 13.0) difiere del del proyecto; es un aviso informativo de la plantilla multifoto, no un RF; no investigué la causa. |

5. **Consultas de solo lectura a la BD viva** (`127.0.0.1:54329`, base `susan`): parámetros del sistema (umbral 0.850, 20 min de tolerancia, 15 s de intervalo, 48 h) y número de capturas (13, todas de semilla) para RF-03/RF-05.
6. **Búsqueda de lo que no existe**: configuración de programador de tareas (`vercel.json`, flujos de GitHub Actions, `pg_cron`, `docker-compose`: ninguno en el repositorio), RPC o botones de baja de materias y grupos (ninguno), uso de `registrarJustificante` fuera del portal del alumno (ninguno).

## Qué no pude verificar

- **Ejecución de la aplicación.** No levanté Next ni el servicio de reconocimiento ni recorrí las pantallas con un navegador; el rastreo de la interfaz es por lectura de código y por las pruebas de componentes.
- **Supabase real.** Auth, Storage y URL firmadas solo contra el adaptador local y un servidor simulado (la introducción del RUNBOOK lo dice). Afecta a RF-12, RF-15, RF-16, RF-18, RF-19 y RF-20 como salvedad, sin cambiar su estado.
- **Reconocimiento con rostros reales.** Las pruebas de `recognition-service` usan el embedder determinista; las cifras con InsightFace (DECISIONS §6.3, DEMO.md §7) son del equipo. Tampoco se probó con una webcam física del plantel, una cámara IP real ni 20 000 plantillas (DEMO.md §7).
- **Rendimiento y cadencia.** No medí cuántas capturas por cámara salen en 20 minutos (RF-03). La estimación de ~78 es un cálculo a partir del bucle (`setTimeout` encadenado después de cada envío), no una medición.
- **Revisión jurídica** del aviso de privacidad y del consentimiento (RF-15): el texto es un borrador (DECISIONS §3.3).

## Observaciones útiles para el reporte

- El umbral de similitud está en 0.850 en la semilla y se calibró a 0.700 en la demostración local; el score es `(coseno+1)/2` (DECISIONS #4). Si el reporte cita 0.850, aclarar que es el valor inicial.
- La implementación se aparta de la especificación en puntos ya documentados (DECISIONS §1): 20 tablas en lugar de 19, 10 acciones de bitácora en lugar de 8, cámara tipo «navegador», estatus de sesión «suspendida», plantilla de 3 a 8 fotos y autoservicio del alumno. No cambian el estado de ningún RF.
- La «notificación» de RF-14 es un asiento de bitácora más alertas en el panel del docente; no hay correo ni push (el módulo Notificaciones figura como «pronto»).

## Archivos de apoyo

Rutas absolutas: `/tmp/claude-0/-home-user-susan/40436e6d-ab3e-5c65-9b75-f6742b8df0d9/scratchpad/susan-main/reporte/req/rf.json`, `rf.md` y este archivo. La salida completa del run de SQL quedó en `/tmp/claude-0/-home-user-susan/40436e6d-ab3e-5c65-9b75-f6742b8df0d9/scratchpad/test-sql-rf.out` y la de vitest en `.../scratchpad/vitest-all.json`. Nada se escribió en el código del repositorio; pytest dejó cachés `__pycache__` ignorados por git (retiré los de `tests/`).
