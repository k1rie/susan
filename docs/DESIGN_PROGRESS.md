---
status: done
heartbeat: 2026-10-03T05:58:34Z
phase: F9
---

# Progreso del diseño real

Plan completo: [`DESIGN_PLAN.md`](./DESIGN_PLAN.md). **Protocolo de continuación**: si `status: running` y `heartbeat` tiene menos de 25 minutos, otra sesión está trabajando: no hagas nada.
Si `heartbeat` está más viejo (o `pending`), toma el trabajo: pon `status: running`, actualiza `heartbeat` (`date -u +%FT%TZ`) y continúa en la primera casilla sin marcar.

## Prerrequisitos (los hace la sesión que preparó el plan)

- [x] Base funcional completa y subida a GitHub (`k1rie/susan`, `main`)
- [x] Revisión adversarial (SQL, web, modo real, numérica) hecha; sin bloqueantes; majors corregidos salvo la bitácora de operaciones sensibles (backlog, ver `docs/DECISIONS.md` §4)
- [x] Migraciones listas para Supabase real (`docs/SUPABASE_SETUP.md`, `scripts/bootstrap-admin.mjs`, `scripts/seed-auth-users.mjs`, `supabase/demo/`) y subidas a GitHub

## Fases

- [x] **F0** Investigación → `docs/design/REFERENCIAS.md` y `docs/design/SISTEMA.md` (SchoolAI público revisado con el navegador integrado; **Mobbin pendiente**: la extensión de Chrome no estaba conectada — ampliar REFERENCIAS.md cuando lo esté)
- [x] **F1** Infraestructura: shadcn init, tokens, `lib/motion`, componentes ReactBits elegidos (reescritos en CSS/rAF; `Stepper` se adapta en F4)
- [x] **F2** ui-kit re-skineado (misma API de props; nuevo `Button arrow`, `Badge tone="gold"`, `StatCard` con cifra serif)
- [x] **F3** Shell, registro de módulos y Home por rol (+ `/modulos` y `/modulos/[id]`): riel sin borde con «Próximamente», barra superior con buscador/paleta ⌘K, barra inferior móvil, `HomeRol` (saludo en serif + subrayado dorado + campo de comando + filas de módulos), `docs/design/MODULOS.md`
- [x] **F4** Auth: login, recuperar, cambiar contraseña, activar cuenta (pantalla dividida + panel de producto animado con 3 escenas rotativas, reglas de contraseña en vivo, `/activar-cuenta` como destino de la invitación)
- [x] **F5** Operación: sesión en vivo, pase manual, revisión, reportes, portal del alumno (heredan ui-kit y tokens; radios, sombras y enlaces-botón migrados; sin desbordes a 360 px)
- [x] **F6** Admin, técnico y analítica (misma migración; corregido el acceso del administrador a `/tecnico` en solo lectura)
- [x] **F7** Pulido de movimiento, presupuesto de rendimiento (medido, ver abajo), reduced-motion y a11y (StatCard con CountUp, paleta combobox, texto sr-only en titulares/cifras animados)
- [x] **F9** Rediseño fiel (2026-10-03): el usuario pidió apegarse más a la referencia → shell, tarjetas y tipografía de **Dropbox Dash**, onboarding de cuenta y Lucide siempre (ver `docs/design/SISTEMA.md`)
- [x] **F8** Cierre: recorrido desktop + 360 px por rol, documentación (README, CLAUDE.md, ARCHITECTURE §14, docs/design/*), todo verde y subido

## Registro

| Fecha (UTC) | Qué se hizo | Commit |
|---|---|---|
| — | Plan creado | 2332fc4 |
| 2026-10-03 | F0: referencias y sistema de diseño | 232b09f |
| 2026-10-03 | F1a: shadcn (radix-maia, JS), tokens, fuentes, codemod de utilidades | d81a575 |
| 2026-10-03 | F1b: `lib/motion` + `components/motion` (BlurText, CountUp, Reveal, SpotlightCard, StaggerList), token `primary-hover` | e2fd11d |
| 2026-10-03 | F2: ui-kit re-skineado (Button píldora + flecha circular, Card 24 px, inputs con anillo de foco, Alert con icono, Modal/Toast animados, Tabs segmentadas, StatusChip con punto, StatCard serif) | 06fc475 |
| 2026-10-03 | Mobbin revisado con Chrome del usuario (Home, landing, login con panel de producto, registro) → `docs/design/REFERENCIAS.md` | (siguiente commit) |
| 2026-10-03 | F3: shell, paleta ⌘K, registro de módulos, `/modulos`, Home por rol | 1698f27 |
| 2026-10-03 | F4: pantallas de acceso con panel de producto animado, `/activar-cuenta` | ddf24c5 |
| 2026-10-03 | F5/F6: radios y sombras coherentes en todas las pantallas; presupuesto de bundle medido | d9c3b5d |
| 2026-10-03 | Documentación del sistema de diseño; StatCard animado | 444b229 |
| 2026-10-03 | Cierre: acceso del administrador a `/tecnico` (solo lectura) y verificación final | e48b112 |
| 2026-10-03 | F9: rediseño Dash (shell, TarjetaPortada/TarjetaFila, Pills, Hanken Grotesk), onboarding `/activar-cuenta` + `/bienvenida`, Lucide siempre | 3e6f1d1 |

## Dependencias de animación añadidas (nombre · tamaño gz · dónde)

| Dependencia | Tamaño | Dónde / decisión |
|---|---|---|
| `tw-animate-css` | solo CSS (utilidades de entrada/salida de shadcn) | `globals.css` |
| `radix-ui`, `class-variance-authority`, `tailwind-merge`, `clsx` | solo lo importado (Slot, etc.) | `components/shadcn/*`, `lib/utils.js` |
| `gsap` | **no se instala** (~70 KB) | `Reveal` lo sustituye con CSS + IntersectionObserver |
| `motion` | **no se instala por ahora** (~30 KB) | se reevalúa en F4 para `Stepper`/`AnimatePresence` con `LazyMotion` |

## Presupuesto de rendimiento (medido)

Medido el 2026-10-03 con `scripts/measure-bundle.mjs` (suma de chunks JS que referencia cada ruta, gzip nivel 9) contra la **base previa al rediseño**
(commit `232b09f`, compilada en un worktree aparte). Presupuesto del plan: JS inicial de `/docente` ≤ +15 %.

| Ruta | Base (gzip KB) | Ahora (gzip KB) | Cambio |
|---|---|---|---|
| `/login` | 197.7 | 212.5 | +7.5 % |
| `/docente` | 209.3 | 235.3 | **+12.4 %** (presupuesto ≤ +15 %; medido tras F9) |
| `/admin` | 207.2 | 230.4 | +11.2 % |
| `/alumno` | 218.8 | 242.0 | +10.6 % |
| `/reportes` | 216.1 | 231.1 | +6.9 % |
| `/analitica` | 344.3 | 359.0 | +4.3 % |
| `/docente/sesiones/[id]` | 221.9 | 236.5 | +6.6 % |

Lecciones: la primera medición dio +15,3 % en `/docente`; `cn()` (tailwind-merge, ~7 KB gz) se había colado en componentes nuevos. `cn()` queda **solo** para
las primitivas de shadcn (`components/shadcn`); el resto usa `clsx`. Sin `gsap` ni `motion` (≈ 100 KB gz evitados).

Tiempo de ejecución (build de producción con `next start`, Chrome del pane, localhost, sin red):

| Medida | `/docente` | `/alumno` |
|---|---|---|
| First Contentful Paint | 76 ms | 92 ms |
| Largest Contentful Paint | 108 ms | 164 ms |
| Cumulative Layout Shift | 0,019 | 0,021 |
| Tareas largas (> 50 ms) | 0 | 0 |
| Fotogramas en reposo (5 animaciones CSS activas) | 120 fps, peor fotograma 9 ms | — |

Las animaciones usan solo `transform`/`opacity` (compositor), un observador por bloque y se apagan con "reducir movimiento". Para repetir: `cd web && npm run build && node ../scripts/measure-bundle.mjs .`
