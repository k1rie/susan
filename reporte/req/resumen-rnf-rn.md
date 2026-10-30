# Resumen de la verificación de los RNF (RNF-01 a RNF-14) y las RN (RN-01 a RN-13)

Base: `origin/main`, commit `f742bb4`, revisado el 2026-10-30. Fuente funcional: `docs/spec/Avance1.txt` (Tabla 2 y Tabla 5). Resultado detallado: `rnf-rn.json` (datos) y `rnf-rn.md` (tablas, evidencia y explicación de cada hueco).

## Conteo

| Tipo | Implementado | Parcial | Pendiente | No medido | Total |
|---|---|---|---|---|---|
| RNF | **7** | 6 | 0 | 1 | 14 |
| RN | **12** | 1 | 0 | 0 | 13 |
| Total | **19** | 7 | 0 | 1 | 27 |

Por parte (un requerimiento con varias partes cuenta en cada una): RNF: SW 9, BD 10, IA 6; RN: SW 5, BD 13, IA 2; ambos: SW 14, BD 23, IA 8. No se usó HW.

**No Implementados (8 de 27):**

| ID | Estado | Qué falta, en una línea |
|---|---|---|
| RNF-01 | No medido | La captura completa con 60 rostros (≤ 7.5 s) nunca se midió; el k-NN sí cumple por vector en mi medición (p95 de 1.4 a 13.6 ms por llamada con un conjunto permitido realista). |
| RNF-05 | Parcial | La purga de recortes a los 7 días está hecha y probada, pero ningún cron la dispara. |
| RNF-07 | Parcial | El pase manual es independiente del servicio (verificado), pero la disponibilidad ≥ 99 % no se puede medir: no hay despliegue ni monitoreo. |
| RNF-09 | Parcial | El cambio atómico de versión está probado; falta medir 20 000 plantillas y la razón de búsqueda 20 000/5 000 medida es 2.6 a 5.9, no ≤ 2. |
| RNF-11 | Parcial | Un pendiente se resuelve en 2 interacciones por diseño, pero la prueba SUS (≥ 68 con 5 docentes) no se ha hecho. |
| RNF-13 | Parcial | 360 px verificado a mano y solo en Chrome; sin prueba automática ni Firefox, Safari o Edge. |
| RNF-14 | Parcial | El respaldo diario es solo una indicación del RUNBOOK sin ensayar; y con fotos efímeras el índice ya no es reconstruible desde las plantillas. |
| RN-07 | Parcial | La regla está completa, pero el cierre automático a la hora de fin no lo programa nada (mismo faltante que RF-10). |

Si se configura el programador de tareas (RUNBOOK §4), RNF-05 y RN-07 pasan a Implementado sin escribir lógica nueva (salvo probar contra Supabase real).

## Criterio de estado

- **Implementado**: el mecanismo está en el código o en el esquema, se alcanza desde la interfaz o la API, y hay prueba automática o medición propia que cubre su métrica.
- **Parcial**: falta una parte del texto o de la métrica (código ausente, sin conectar, o criterio que no se cumple).
- **No medido**: la implementación existe pero no hay medición que permita afirmar la métrica.
- **Pendiente**: nada, o solo esquema. Ningún requerimiento cae aquí.
- Ante la duda se eligió el estado más bajo. Regla para las salvedades de despliegue (la misma que usó la verificación de los RF): si el componente falta incluso en modo local (el programador de tareas), baja a Parcial; si es el mismo código con otro transporte que no se ha ejecutado (Supabase real), se conserva el estado y se anota la salvedad (RNF-04).

## Cómo verifiqué

1. **Lectura de la especificación.** `docs/spec/Avance1.txt`: §2.1 y Tabla 2 (RN-01 a RN-13 con su mecanismo), §2.3 y Tabla 5 (RNF-01 a RNF-14 con su métrica), y los RF que los enlazan (RF-04 a RF-14).
2. **Lectura del código** de cada mecanismo y de su prueba: migraciones `0005`, `0006`, `0007`, `0020`, `0040`, `0090`, `0091`, `0100`, `0120` a `0122`, `0130` a `0135`, `0203`, `0231` a `0239`; `recognition-service/app/index.py` y `main.py`; `web/src/lib/server/` (`storage.js`, `captura.js`, `jobs.js`, `indice.js`, `recognition.js`) y los componentes `ResolverComo`, `CasoPendiente`, `CapturaContinua`. Documentos del equipo: `docs/DECISIONS.md`, `docs/RUNBOOK.md`, `docs/DESIGN_PROGRESS.md`, `docs/DEMO.md`, `docs/api/biometria.md`.
3. **Consultas de solo lectura a la base viva** (`127.0.0.1:54329`, base `susan`, PostgreSQL 16.14, 43 de 43 migraciones aplicadas según `reporte/bd/resumen.md`): tipos de columna (`information_schema.columns`), restricciones (`pg_constraint`: 20 PK, 26 FK, 21 UNIQUE, 35 CHECK, ninguna sin validar), índices únicos parciales, disparadores (`pg_trigger`: 7, entre ellos los seis de la spec más `trg_plantilla_foto_principal`), RLS y privilegios (`pg_class`, `role_table_grants`), `storage.buckets` y `pg_policies` del esquema `storage`, `parametro_sistema`, valores del tipo `accion_bitacora`, lenguajes de las funciones (`pg_language`) y extensiones. No se escribió nada en esa base y no se levantó otro clúster.
4. **Pruebas SQL**: usé la salida guardada por la verificación de BD, `reporte/bd/pruebas-sql.txt` (`scripts/test-sql.sh` sobre PostgreSQL 16 local, commit `f742bb4`): 37 archivos, 0 con fallas, 1508 pruebas positivas y 953 negativas, 0 fallos. No volví a ejecutar el script; cité las pruebas por archivo y por identificador de caso leyendo su código.
5. **Pruebas que sí ejecuté yo** (sin modificar archivos versionados): `npx vitest run` sobre 7 archivos (`storage.test.js`, `jobs.test.js`, `recognition.test.js`, `indice.test.js`, `ResolverComo`, `useMuestreoSesion.test.jsx`, `lib/motion`): 147 pruebas pasan, 0 fallan. `pytest -p no:cacheprovider` de `recognition-service/tests/test_api.py` con `-k "latencia or atomic or vector or build"` (venv de Python 3.11): 4 pasan (`test_latencia_busqueda_20000_vectores`, `test_activate_atomico_con_busquedas_concurrentes`, `test_build_conserva_vectores_keep`, `test_build_2_rostros_en_foto_de_registro_no_escribe`).
6. **Mediciones propias** (carpeta `reporte/req/medicion/`: scripts `knn.py`, `knn2.py`, `idx.py` y sus salidas): tiempo de búsqueda de `LoadedIndex.search` del repositorio con 5 000 y 20 000 vectores sintéticos de 512 dimensiones (200 o 300 repeticiones por caso) y tiempo de CPU para serializar, validar y cargar un índice de 20 000 vectores (54.7 MB). Entorno: Linux x86_64, Xeon 2.10 GHz, 4 vCPU compartidos, Python 3.11.15, faiss-cpu 1.15.1, numpy 2.4.6. Son cotas de orden de magnitud; la razón 20 000/5 000 varió entre 2.6 y 5.9 en corridas repetidas.
7. **Búsquedas de lo que no existe**: programador de tareas (`vercel.json`, flujos de GitHub Actions, `pg_cron`, `docker-compose`: ninguno), scripts o pruebas de respaldo y restauración, navegadores de prueba (Playwright o Cypress: no están en `devDependencies`), cualquier uso del servicio de reconocimiento desde el pase manual (ninguno) y tipos ajenos a SQL/PL/pgSQL en las funciones de la base (ninguno).

## Qué no pude verificar

- **Supabase real.** Auth, Storage, URL firmadas, respaldos y disponibilidad solo contra el adaptador local, los stubs de PostgreSQL y un servidor simulado; el RUNBOOK admite que el camino real no se ha ejecutado. Afecta a RNF-04, RNF-05, RNF-07 y RNF-14.
- **Rendimiento con modelos y rostros reales.** No ejecuté InsightFace ni el servicio completo: la métrica de 7.5 s por captura de RNF-01 y la reconstrucción con 20 000 plantillas de RNF-09 quedan sin medir. Mis cifras de k-NN usan vectores aleatorios.
- **Navegadores.** No abrí la aplicación en ningún navegador; RNF-13 se apoya en los registros del equipo y en la lectura del código.
- **Usuarios.** No hay prueba SUS ni observación con docentes (RNF-11).
- **Presupuesto de rendimiento del diseño** (`scripts/measure-bundle.mjs`, `docs/DESIGN_PROGRESS.md`): no es un RNF de la spec y no lo repetí (exige un `next build`, que escribe en el árbol). Las cifras del equipo (2026-10-03: `/docente` 226.1 KB gzip, +8.0 % frente al presupuesto de +15 %; FCP 76 ms y LCP 108 ms medidos antes de F11) son suyas, no mías, y el propio documento dice que la medición de tiempo de ejecución está pendiente tras F11 (casilla F11b).
- **Pruebas SQL** (ver punto 4): confío en la salida guardada de la otra verificación; no las repetí.

## Hallazgos que conviene decidir en el equipo

1. **RNF-14 contradice a RNF-03/RNF-05 desde la extensión 18.** El índice ya no es reconstruible desde las plantillas activas porque la foto se borra tras indexarse (`409 PLANTILLAS_SIN_FOTO`); los vectores solo viven en los JSON del bucket, y el RUNBOOK no dice cómo respaldarlos. Respaldar el bucket de índices o reformular el requisito.
2. **RNF-09, segundo criterio.** «Búsqueda con 20 000 ≤ 2× la de 5 000» no se cumple en mis mediciones con búsqueda exhaustiva (crece casi lineal); en valor absoluto es irrelevante (< 3 ms). Reformularlo en términos absolutos.
3. **RNF-01, prueba débil.** `test_latencia_busqueda_20000_vectores` afirma `min(tiempos) < 50`, no el percentil 95 que pide la spec; y los recortes se suben en serie dentro de `/v1/recognize` (riesgo para los 7.5 s con 60 rostros).
4. **Programador de tareas.** Una sola tarea de despliegue (`vercel.json` o GitHub Actions con las frecuencias del RUNBOOK §4) cierra RN-07 y RNF-05, y también RF-10 y RF-11.
5. **Hardening de bitácora ya conocido** (fuera de la métrica de RNF-08): cambio de rol, baja de cuenta, baja de alumno, revocación hecha por el administrador y pase manual del docente no dejan asiento (`review_sql_04_auditoria.sql`, casos AU1 a AU5); la IP la declara el llamador.
