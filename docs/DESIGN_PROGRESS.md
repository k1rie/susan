---
status: running
heartbeat: 2026-10-03T04:09:04Z
phase: prerrequisitos
---

# Progreso del diseño real

Plan completo: [`DESIGN_PLAN.md`](./DESIGN_PLAN.md). **Protocolo de continuación**: si `status: running` y `heartbeat` tiene menos de 25 minutos, otra sesión está trabajando: no hagas nada.
Si `heartbeat` está más viejo (o `pending`), toma el trabajo: pon `status: running`, actualiza `heartbeat` (`date -u +%FT%TZ`) y continúa en la primera casilla sin marcar.

## Prerrequisitos (los hace la sesión que preparó el plan)

- [x] Base funcional completa y subida a GitHub (`k1rie/susan`, `main`)
- [x] Revisión adversarial (SQL, web, modo real, numérica) hecha; sin bloqueantes; majors corregidos salvo la bitácora de operaciones sensibles (backlog, ver `docs/DECISIONS.md` §4)
- [x] Migraciones listas para Supabase real (`docs/SUPABASE_SETUP.md`, `scripts/bootstrap-admin.mjs`, `scripts/seed-auth-users.mjs`, `supabase/demo/`) y subidas a GitHub

## Fases

- [ ] **F0** Investigación en Mobbin (Chrome del usuario) → `docs/design/REFERENCIAS.md` y `docs/design/SISTEMA.md`
- [ ] **F1** Infraestructura: shadcn init, tokens, `lib/motion`, componentes ReactBits elegidos
- [ ] **F2** ui-kit re-skineado (misma API de props)
- [ ] **F3** Shell, registro de módulos y Home por rol (+ `/modulos/[id]`)
- [ ] **F4** Auth: login, recuperar, cambiar contraseña, activar cuenta
- [ ] **F5** Operación: sesión en vivo, pase manual, revisión, reportes, portal del alumno
- [ ] **F6** Admin, técnico y analítica
- [ ] **F7** Pulido de movimiento, presupuesto de rendimiento, reduced-motion, a11y
- [ ] **F8** Cierre: recorrido desktop + 360 px, documentación, todo verde y subido

## Registro

| Fecha (UTC) | Qué se hizo | Commit |
|---|---|---|
| — | Plan creado | — |

## Dependencias de animación añadidas (nombre · tamaño gz · dónde)

_(vacío)_

## Presupuesto de rendimiento (medido)

_(vacío)_
