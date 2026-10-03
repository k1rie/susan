# SUSAN

Sistema centralizado de **registro digital de asistencia académica** con reconocimiento facial y **análisis del ausentismo por métodos numéricos**
(UNACH · Facultad de Contaduría y Administración C-I).

Objetivo: reducir el tiempo operativo de pase de lista en el aula y generar historiales consolidados que permitan identificar patrones de
ausentismo para orientar la intervención docente oportuna.

Base funcional: el 1er avance del Proyecto Integrador (`docs/spec/Avance1.pdf`: 22 RF, 13 RN, 14 RNF, 19 tablas, pantallas P-01…P-09), más el
análisis numérico del ausentismo. Estilo y estructura tomados de MVP-FITNESS (Next.js, un folder por componente) y flujos de SmartClass.

> **Estado: BASE.** Todo el sistema funciona de punta a punta con datos de demostración, pero el diseño visual es mínimo a propósito
> (Tailwind sobre tokens semánticos); el rediseño viene después. Ver `docs/DECISIONS.md` para desviaciones, riesgos y pendientes.

## Qué incluye

| Pieza | Dónde | Tecnología |
|---|---|---|
| Aplicación web (9 pantallas de la spec + analítica + consola técnica) | `web/` | Next.js 16 (App Router), React 19, Tailwind 4, JavaScript |
| Base de datos y backend | `supabase/` | PostgreSQL 16: 19 tablas 3FN, triggers, RLS, 72 RPC `api_*` y 19 `svc_*` |
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
> (iCloud desaloja y duplica archivos vivos); ver `scripts/local-dir.sh` y `docs/ARCHITECTURE.md` §13.

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
│  ├─ api/*.md                           diseños de referencia por dominio (parciales; manda el SQL)
│  └─ spec/                              1er avance (PDF + texto) y presentación
├─ supabase/  migrations/ (0001–0136) · seed/ · local/ (stubs de Auth/Storage solo para PG local) · tests/ · config.toml
├─ recognition-service/                  app/ · tests/ · Dockerfile · Procfile
├─ web/src/
│  ├─ app/        rutas: (public) login · (app) docente · alumno · admin · tecnico · reportes · analitica · api/*
│  ├─ components/ un folder por componente (ui/ · layout/ · auth/ · docente/ · sesion/ · revision/ · reportes/ · alumno/ · analitica/ · admin/ · tecnico/)
│  ├─ lib/        api/ (envoltorios de RPC) · http/ · server/ · backend/ · local/ · numerics/
│  └─ hooks/
└─ scripts/       db-*.sh · test-sql.sh · dev-all.sh · dev-stop.sh · gen-api-catalog.mjs · seed-auth-users.mjs
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

Ver `docs/RUNBOOK.md` (proyecto Supabase real, servicio de reconocimiento, tareas programadas, variables de entorno).

## Seguridad

- Nunca se versionan secretos: solo `*.example`. La `service_role` vive solo en el servidor.
- Las credenciales de demostración (`demo1234`) existen **solo** en el modo local; en Supabase las cuentas se crean con `scripts/seed-auth-users.mjs` o desde la consola de administración.
- Los modelos preentrenados de InsightFace son de **uso no comercial**.
