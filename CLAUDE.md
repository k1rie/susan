# SUSAN — convenciones del proyecto

**SUSAN**: sistema centralizado de registro digital de asistencia académica con análisis numérico del ausentismo
(UNACH · FCA C-I). Objetivo: reducir el tiempo de pase de lista en el aula y generar historiales consolidados que
permitan identificar patrones de ausentismo para orientar la intervención docente oportuna.

Base funcional: la especificación del 1er avance (`docs/spec/Avance1.pdf`, texto en `docs/spec/Avance1.txt`) —
22 RF, 14 RNF, 13 RN, 19 tablas, 9 pantallas P-01…P-09 — más el análisis por métodos numéricos
(`docs/NUMERICS.md`). Referencias de origen: SmartClass (flujos de grupos/asistencia/justificantes/exportación) y
MVP-FITNESS (estructura Next.js, un folder por componente).

**Estado actual: base funcional + diseño real (fases F0–F7 de `docs/DESIGN_PLAN.md`).** La identidad y las reglas de
movimiento están en `docs/design/SISTEMA.md`; el avance y el presupuesto de rendimiento medido, en
`docs/DESIGN_PROGRESS.md`. Toda pantalla nueva debe verse bien a 360 px, respetar "reducir movimiento" y no
desbordar horizontalmente.

## Mapa del repositorio

```
SUSAN/
├─ docs/                  ARCHITECTURE.md · API.md (+ docs/api/*.md) · NUMERICS.md · DECISIONS.md · RUNBOOK.md
│  └─ spec/               Avance1.pdf/.txt (FUENTE DE VERDAD funcional), pptx
├─ supabase/              migrations/ · local/ (stubs auth/storage para PG local) · seed/ · tests/ · config.toml
├─ recognition-service/   FastAPI + FAISS (Python 3.12) — embeddings 512-d, índice JSON en el bucket
├─ web/                   Next.js 16 (App Router, JS/JSX) + Tailwind 4 + supabase-js
└─ scripts/               utilidades de desarrollo local (db-up, db-reset, test-sql, dev-all…)
```

## Stack

- **Next.js 16.3** (App Router), React 19, Tailwind 4, JavaScript ESM. **Este Next NO es el que conoces**:
  antes de escribir código de Next lee la guía relevante en `web/node_modules/next/dist/docs/01-app/`.
  Cambios que ya sabemos: `middleware` se llama **`proxy`** (`src/proxy.js`, `export function proxy`); `params`,
  `searchParams`, `cookies()`, `headers()` son **asíncronos** (`await`); Turbopack es el bundler por defecto;
  los Route Handlers son endpoints públicos (autentica SIEMPRE).
- **Supabase** = base de datos (PostgreSQL 16), backend (funciones RPC + RLS), autenticación (Supabase Auth) y
  almacenamiento (bucket privado `susan-private`, también guarda el JSON del índice FAISS).
- **Recognition service** = Python/FastAPI + `faiss-cpu`; carga el índice desde un JSON del bucket.
- **Modo local** (`SUSAN_LOCAL=1`): PostgreSQL 16 directo + disco en lugar de Supabase (no hay Docker en la
  máquina de desarrollo). Es la misma lógica SQL; solo cambia el transporte. Ver `docs/ARCHITECTURE.md` §4.

## Convenciones de código

- JavaScript ESM. **4 espacios, comillas simples, punto y coma** (estilo de MVP-FITNESS). SQL y Python: 4 espacios.
- Dominio en **español** (tablas, columnas, RPC, rutas, textos de UI); infraestructura en inglés. Comentarios en
  español, explican el *porqué*, no el *qué*. Sin emojis en el código.
- Archivos con JSX → `.jsx`; lógica → `.js`. Alias `@/` = `web/src/`.
- **Un componente = una carpeta** que contiene todo lo que necesita (markup, hooks propios, utilidades, constantes,
  pruebas, CSS si hiciera falta):
  ```
  web/src/components/<feature>/<NombreComponente>/
      NombreComponente.jsx        # el componente (export default)
      useNombreComponente.js      # hooks propios (si los hay)
      nombreComponente.utils.js   # funciones puras propias
      NombreComponente.test.jsx   # pruebas
      index.js                    # export { default } from './NombreComponente.jsx';
  ```
  Primitivas compartidas en `components/ui/<Nombre>/` (API de props de SUSAN; úsalas siempre en pantallas),
  primitivas vendorizadas de shadcn en `components/shadcn/` (solo las envuelven los `ui/`), movimiento en
  `components/motion/`, piezas del Home en `components/home/`, layout en `components/layout/<Nombre>/`.
  Las páginas (`src/app/**/page.jsx`) son delgadas: solo componen componentes y cargan datos.
- Estilos: clases de Tailwind con los **tokens semánticos** de `src/app/globals.css` (vocabulario shadcn:
  `bg-background` (lienzo crema), `bg-card` (panel blanco), `bg-muted`, `bg-accent`, `text-foreground`,
  `text-muted-foreground`, `border-border`, `bg-primary` (tinta casi negra), `text-link` (azul de enlaces),
  `text-destructive`…; marca: `text-brand-gold`; portadas: `bg-tono-azul`/`text-tono-azul-fg`…; estados:
  `text-presente`, `bg-ausente-bg`…). Nunca colores hex crudos. Estados de asistencia: siempre etiqueta de texto +
  color (`StatusChip`). Interfaz en **Hanken Grotesk** 14 px; la serif (`font-display`, EB Garamond) SOLO en el
  saludo del Home y los titulares de acceso/onboarding.
- **Iconos: SIEMPRE Lucide** (`lucide-react`, `aria-hidden="true"`, `strokeWidth` 1.5–1.75). Prohibido el SVG a
  mano para iconos, los emojis y los símbolos de texto (`▲ → ✓`) como icono. (Orden explícita del usuario.)
- **Forma (referencia: Dropbox Dash, ver `docs/design/SISTEMA.md`)**: contenido en el panel blanco flotante del
  `AppShell`; tarjetas `rounded-xl border border-border bg-card` **sin sombra**; botones y campos `rounded-md`
  (8 px); botón primario negro; filtros con `ui/Pills`; pestañas con `ui/Tabs` (subrayadas); tarjetas de módulo con
  `ui/TarjetaPortada` y listas de filas con `ui/TarjetaFila`; foco visible con `focus-visible:ring-4 ring-ring/30`.
- **Gráficas y densidad de texto**: cada pantalla abre con cifras y gráficas (shadcn `chart` vía `ui/GraficaDona`,
  `ui/GraficaBarras`, `ui/TarjetaGrafica` con `resumen` como texto alternativo; colores solo por token, ver
  `lib/graficas.js`); la explicación va corta o dentro de `ui/Detalles`; tablas con solo las columnas esenciales;
  nada de párrafos repetidos por fila. recharts se carga con `next/dynamic` (patrón `*Impl.jsx`):
  no lo importes de forma estática en pantallas. Detalle en `docs/design/SISTEMA.md`.
- **Movimiento**: solo con `components/motion/*` y `lib/motion` (CSS + IntersectionObserver/rAF; sin gsap ni
  `motion`). Solo `transform`/`opacity`; una vez al entrar en vista; apagado con "reducir movimiento". No agregues
  librerías de animación sin medir con `scripts/measure-bundle.mjs` (presupuesto: `/docente` ≤ +15 % vs. la base).
  `cn()` (tailwind-merge) es solo para `components/shadcn`; en el resto usa `clsx`.
- **Módulos**: las funciones nuevas (y las futuras) se registran en `web/src/lib/modulos.js` (ver
  `docs/design/MODULOS.md`); el Home, `/modulos`, la paleta ⌘K y el riel lateral salen de ahí.
- **Acceso a datos**: los componentes NUNCA llaman a Supabase directamente. Usan `@/lib/api/*` (envoltorios
  tipados sobre las RPC) y `@/lib/http/*` (clientes de los Route Handlers). Toda la lógica de negocio vive en
  PostgreSQL (RPC/triggers) o en Route Handlers; la interfaz solo presenta y captura decisiones.
- Contratos: lo que `docs/API.md` y `docs/api/*.md` definen (nombres de RPC, argumentos, formas JSON, códigos de
  error, rutas HTTP) es ley. Si necesitas cambiarlo, hazlo en el documento Y avisa en tu reporte final.

## Seguridad (no negociable)

- La `service_role` key y cualquier secreto viven solo en el servidor. Nunca en `NEXT_PUBLIC_*`, nunca en el
  cliente, nunca en el repositorio. Solo se versionan `.env.example`.
- Ningún vector facial ni imagen en tablas relacionales (RNF-03). El vector de consulta de cada rostro vive solo en
  memoria del servicio de reconocimiento y no sale en sus respuestas.
- Objetos del bucket solo por URL firmada ≤ 300 s; cada consulta de recortes/detecciones queda en bitácora (RF-19).
- Todo Route Handler: autenticar → autorizar rol/pertenencia → validar entrada (zod) → ejecutar.
- No registres PII ni vectores en logs.

## Verificación

- `web/`: `npm run lint`, `npm test` (vitest), `npm run build`. SQL: `scripts/test-sql.sh` contra PostgreSQL 16 local.
  Python: `pytest` dentro de `recognition-service/`.
- No ejecutes `next build` mientras otros agentes trabajan en el mismo árbol (bloquea `.next`); para un dev-server
  paralelo usa `NEXT_DIST_DIR=.next-<tu-nombre>` y un puerto propio.
- Un agente solo modifica los archivos que le pertenecen (tabla de propiedad en `docs/ARCHITECTURE.md` §7).
  Si necesitas un cambio fuera de tu zona, descríbelo en tu reporte final (`requests`); no lo hagas tú.
