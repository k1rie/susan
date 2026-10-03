---
status: running
heartbeat: 2026-10-03T04:36:56Z
phase: F1
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
- [ ] **F4** Auth: login, recuperar, cambiar contraseña, activar cuenta
- [ ] **F5** Operación: sesión en vivo, pase manual, revisión, reportes, portal del alumno
- [ ] **F6** Admin, técnico y analítica
- [ ] **F7** Pulido de movimiento, presupuesto de rendimiento, reduced-motion, a11y
- [ ] **F8** Cierre: recorrido desktop + 360 px, documentación, todo verde y subido

## Registro

| Fecha (UTC) | Qué se hizo | Commit |
|---|---|---|
| — | Plan creado | 2332fc4 |
| 2026-10-03 | F0: referencias y sistema de diseño | 232b09f |
| 2026-10-03 | F1a: shadcn (radix-maia, JS), tokens, fuentes, codemod de utilidades | d81a575 |
| 2026-10-03 | F1b: `lib/motion` + `components/motion` (BlurText, CountUp, Reveal, SpotlightCard, StaggerList), token `primary-hover` | e2fd11d |
| 2026-10-03 | F2: ui-kit re-skineado (Button píldora + flecha circular, Card 24 px, inputs con anillo de foco, Alert con icono, Modal/Toast animados, Tabs segmentadas, StatusChip con punto, StatCard serif) | 06fc475 |
| 2026-10-03 | Mobbin revisado con Chrome del usuario (Home, landing, login con panel de producto, registro) → `docs/design/REFERENCIAS.md` | (siguiente commit) |
| 2026-10-03 | F3: shell, paleta ⌘K, registro de módulos, `/modulos`, Home por rol | (siguiente commit) |

## Dependencias de animación añadidas (nombre · tamaño gz · dónde)

| Dependencia | Tamaño | Dónde / decisión |
|---|---|---|
| `tw-animate-css` | solo CSS (utilidades de entrada/salida de shadcn) | `globals.css` |
| `radix-ui`, `class-variance-authority`, `tailwind-merge`, `clsx` | solo lo importado (Slot, etc.) | `components/shadcn/*`, `lib/utils.js` |
| `gsap` | **no se instala** (~70 KB) | `Reveal` lo sustituye con CSS + IntersectionObserver |
| `motion` | **no se instala por ahora** (~30 KB) | se reevalúa en F4 para `Stepper`/`AnimatePresence` con `LazyMotion` |

## Presupuesto de rendimiento (medido)

_(vacío)_
