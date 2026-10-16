# SUSAN

Sistema centralizado de **registro digital de asistencia académica** con reconocimiento facial y **análisis del ausentismo por métodos numéricos**
(UNACH · Facultad de Contaduría y Administración C-I).

Objetivo: reducir el tiempo operativo de pase de lista en el aula y generar historiales consolidados que permitan identificar patrones de
ausentismo para orientar la intervención docente oportuna.

Base funcional: el 1er avance del Proyecto Integrador (`docs/spec/Avance1.pdf`: 22 RF, 13 RN, 14 RNF, 19 tablas, pantallas P-01…P-09), más el
análisis numérico del ausentismo. Estilo y estructura tomados de MVP-FITNESS (Next.js, un folder por componente) y flujos de SmartClass.

> **Estado: base funcional + diseño real.** Todo el sistema funciona de punta a punta con datos de demostración y la interfaz ya tiene su diseño
> (inspirado en SchoolAI: lienzo cálido, serif de marca, píldoras, tarjetas de 24 px, paleta de comandos ⌘K, animaciones ligeras). Ver
> [`docs/design/SISTEMA.md`](docs/design/SISTEMA.md) y `docs/DECISIONS.md` (desviaciones, riesgos y pendientes).

## Qué incluye

| Pieza | Dónde | Tecnología |
|---|---|---|
| Aplicación web (9 pantallas de la spec + analítica + consola técnica + catálogo de módulos) | `web/` | Next.js 16 (App Router), React 19, Tailwind 4, shadcn/ui (primitivas), JavaScript |
| Base de datos y backend | `supabase/` | PostgreSQL 16: 20 tablas 3FN (19 de la spec + `plantilla_foto`), triggers, RLS, 72 RPC `api_*` y 19 `svc_*` |
| Autenticación y almacenamiento | Supabase Auth + bucket privado `susan-private` | incluye el JSON del índice FAISS |
| Servicio de reconocimiento | `recognition-service/` | FastAPI + `faiss-cpu`, embeddings de 512-d (InsightFace) o embedder determinista para pruebas |
| Métodos numéricos | `web/src/lib/numerics/` | JavaScript puro con procedimiento paso a paso (`docs/NUMERICS.md`) |
| Modo local sin Docker ni Supabase | `web/src/lib/local/`, `scripts/` | PostgreSQL 16 directo + disco |

Roles: **administrador**, **docente**, **alumno**, **técnico** (sin autorregistro: el administrador crea las cuentas).

## Arranque rápido (modo local)

Requisitos: macOS/Linux, Node 20.9+, PostgreSQL 16 (`brew install postgresql@16`), Python 3.12 (solo para el servicio de reconocimiento).

```bash
cd web && npm install && cd ..     # una vez
scripts/dev-all.sh                 # PostgreSQL + semilla + servicio de reconocimiento + Next en http://localhost:3000
scripts/dev-stop.sh                # detiene web y servicio (--all también PostgreSQL)
```

Cuentas de demostración (contraseña **de desarrollo** `demo1234`, solo existen en el modo local):
`admin@susan.local`, `tecnico@susan.local`, `docente1@susan.local`…`docente3@susan.local`, `e260001@susan.local`…`e260025@susan.local`.

El reloj de la demostración está fijado al **lunes 14-sep-2026 07:12** (la semilla narra ese día; `SUSAN_FAKE_NOW=off` usa el reloj real).
Con `docente1@` abre la sesión del grupo 3A, mira el monitor y el análisis en **Analítica** (la semilla trae patrones de deterioro,
abandono, ausencias en viernes y retardos).

> El estado mutable local (clúster PostgreSQL, storage) vive en `~/.susan-local/SUSAN` si el proyecto está en Escritorio/Documentos
> (iCloud desaloja y duplica archivos vivos); ver `scripts/local-dir.sh` y `docs/ARCHITECTURE.md` §13. **Recomendación: clona/ubica el proyecto fuera de carpetas sincronizadas** (p. ej. `~/Developer/SUSAN`).

## Probar rápido

Datos de prueba completos y reiniciables (consentimientos y plantillas faciales de los 75 alumnos, índice FAISS cargado, casos para la
pantalla de Revisión y alumnos con avisos). Solo modo local.

```bash
scripts/dev-all.sh               # levanta todo (si ya corre, lo respeta)
scripts/seed-demo.sh             # asegura los datos de prueba sin destruir lo hecho a mano (~15 s)
scripts/seed-demo.sh --reset     # deja la sesión de hoy lista para repetir el pase de lista con cámara desde cero
```

Guía por rol y recorrido del pase de lista con cámara: [`docs/DEMO.md`](docs/DEMO.md); **probar con tu rostro real (InsightFace, `scripts/dev-modo.sh`)**: [`docs/DEMO.md` §9](docs/DEMO.md#9-probar-con-tu-rostro-real-insightface); cámara simulada: [`docs/DEMO-CAMARA.md`](docs/DEMO-CAMARA.md); reloj de la demostración: [`docs/DEMO-RELOJ.md`](docs/DEMO-RELOJ.md).

## Pruebas

```bash
scripts/test-sql.sh                       # 29 archivos: 1232 aserciones positivas y 801 negativas contra PostgreSQL 16 (BD temporal)
cd web && npm test                        # vitest: lógica, componentes, route handlers, adaptador local, numerics
cd web && npm run lint && npm run build   # lint y compilación de producción
cd recognition-service && .venv/bin/pytest            # servicio (embedder fake + FAISS real)
cd recognition-service && .venv/bin/pytest -m ml      # humo con InsightFace real (descarga modelos, ~70 s)
node scripts/gen-api-catalog.mjs          # regenera docs/API-RPC.md desde el SQL (--check en CI)
```

## Estructura

```
SUSAN/
├─ README.md · CLAUDE.md                 convenciones del proyecto
├─ docs/
│  ├─ ARCHITECTURE.md                    capas, reglas transversales, contratos, propiedad de archivos
│  ├─ API-RPC.md                         catálogo de RPC y códigos de error (GENERADO del SQL)
│  ├─ DECISIONS.md · RUNBOOK.md · NUMERICS.md
│  ├─ design/                            SISTEMA.md (identidad y movimiento) · REFERENCIAS.md (SchoolAI/Mobbin) · MODULOS.md (registro de módulos)
│  ├─ DESIGN_PLAN.md · DESIGN_PROGRESS.md  plan por fases del diseño, avance y presupuesto de rendimiento medido
│  ├─ api/*.md                           diseños de referencia por dominio (parciales; manda el SQL)
│  └─ spec/                              1er avance (PDF + texto) y presentación
├─ supabase/  migrations/ (0001–0990) · demo/ (reloj de demostración) · seed/ · local/ (stubs de Auth/Storage solo para PG local) · tests/ · config.toml
├─ recognition-service/                  app/ · tests/ · Dockerfile · Procfile
├─ web/src/
│  ├─ app/        rutas: (public) login · recuperar · cambiar-contrasena · activar-cuenta · (app) docente · alumno · admin · tecnico · reportes · analitica · modulos · api/*
│  ├─ components/ un folder por componente (ui/ · shadcn/ · motion/ · home/ · layout/ · auth/ · docente/ · sesion/ · revision/ · reportes/ · alumno/ · analitica/ · admin/ · tecnico/)
│  ├─ lib/        api/ (envoltorios de RPC) · http/ · server/ · backend/ · local/ · numerics/ · motion/ · modulos.js (registro de módulos)
│  └─ hooks/
└─ scripts/       db-*.sh · test-sql.sh · dev-all.sh · dev-stop.sh · dev-modo.sh (embedder fake/insightface) · seed-demo.sh (+ demo/) · gen-api-catalog.mjs · seed-auth-users.mjs
```

## Cómo está pensado (resumen)

- **Toda la lógica de negocio vive en PostgreSQL** (restricciones, triggers y RPC transaccionales) o en Route Handlers; la interfaz solo presenta y captura decisiones.
  La app habla con la base **solo por RPC** (`api_*` con la identidad del usuario y RLS; `svc_*` solo desde el servidor con `service_role`).
- **Reconocimiento**: la webcam del docente (o una cámara IP) envía un fotograma cada 15 s; el servicio detecta rostros, calcula el vector (512-d, solo en memoria) y busca
  el vecino más cercano en FAISS **restringido a los inscritos del grupo con consentimiento vigente**. La asistencia se confirma con ≥ 3 lecturas válidas en capturas distintas
  (RN-05); el estado lo decide la primera lectura (RN-03). Los casos dudosos pasan a la cola de revisión del docente; sin cámara o sin consentimiento hay pase de lista manual.
- **Privacidad del dato biométrico**: ningún vector ni imagen en tablas; el índice vive como JSON versionado en el bucket privado; todo objeto se sirve por URL firmada ≤ 300 s
  y cada consulta de recortes/documentos queda en una bitácora de solo inserción.
- **Análisis numérico**: regresión, suavizado, proyección con búsqueda de raíces (cruce del 20 %), detección de cambios de nivel y puntaje de riesgo explicable por alumno, con el
  procedimiento (tablas de iteraciones, ecuaciones normales) visible en pantalla.

## Despliegue

- **Probar la interfaz con tu proyecto Supabase**: [`docs/SUPABASE_SETUP.md`](docs/SUPABASE_SETUP.md) (migraciones, semilla, cuentas de demostración, reloj de demostración, variables).
- **Producción**: [`docs/RUNBOOK.md`](docs/RUNBOOK.md) (servicio de reconocimiento, tareas programadas, respaldo, variables de entorno).
- **Diseño**: [`docs/design/SISTEMA.md`](docs/design/SISTEMA.md) (identidad, componentes firma, movimiento), [`docs/DESIGN_PLAN.md`](docs/DESIGN_PLAN.md) y [`docs/DESIGN_PROGRESS.md`](docs/DESIGN_PROGRESS.md) (avance, presupuesto de rendimiento medido).

## Seguridad

- Nunca se versionan secretos: solo `*.example`. La `service_role` vive solo en el servidor.
- Las credenciales de demostración (`demo1234`) existen **solo** en el modo local; en Supabase las cuentas se crean con `scripts/seed-auth-users.mjs` o desde la consola de administración.
- Los modelos preentrenados de InsightFace son de **uso no comercial**.
