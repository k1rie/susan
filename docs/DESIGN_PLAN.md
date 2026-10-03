# SUSAN — Plan del diseño real (fase 2)

Estado de partida: el sistema funciona de punta a punta con un diseño **mínimo** a propósito (Tailwind sobre tokens semánticos). Esta fase lo reemplaza por un
diseño real, con animaciones fluidas y ligeras, pensando en que SUSAN hoy solo tiene **reconocimiento facial + asistencia** pero tendrá un "plus" después.
El progreso se registra en [`DESIGN_PROGRESS.md`](./DESIGN_PROGRESS.md) (obligatorio: lo lee cualquier sesión que continúe el trabajo).

## 1. Objetivo y restricciones

- **Referencia visual**: SchoolAI (web). Pantallas en Mobbin:
  <https://mobbin.com/apps/school-ai-web-86df6dce-b17f-4ad3-af85-9dc4b9dc43b5/dbc79832-6983-4783-9224-59642a92220c/screens?filter=screenPatterns.Home>
  (se consulta desde el Chrome del usuario con las herramientas `mcp__claude-in-chrome__*`; el usuario ya tiene sesión en Mobbin). Es **inspiración**: se toman patrones, jerarquía, ritmo y
  sensación, no se copian pantallas, textos, ilustraciones ni marca. Las capturas de Mobbin son material con derechos: **no se commitean**; en el repo solo van notas en texto.
  Si Mobbin pide iniciar sesión y no hay sesión abierta, NO introducir credenciales: usar el sitio público de SchoolAI como respaldo y anotarlo en `docs/design/REFERENCIAS.md`.
  Aplica también a **login y signup** (misma referencia).
- **Animaciones**: fluidas pero baratas. Apoyarse en **ReactBits (versión gratuita)** y **shadcn/ui**.
- **Futuro**: el diseño debe admitir módulos nuevos sin rehacer la navegación (ver §6).
- **No se toca** la lógica: RPC, SQL, Route Handlers, capa de datos y módulo numérico no cambian (salvo bugs). Todas las pruebas de comportamiento siguen verdes.
- Identidad: el azul marino UNACH (`#1F3A5F`) y el dorado (`#A8842C`) siguen siendo la base de marca; el diseño decide cómo se combinan con la calidez, el espacio y los
  radios generosos de la referencia. Estados de asistencia siempre con **texto + color**.

## 2. Principios de diseño

1. **Home como centro de mando** por rol: saludo contextual ("Buenos días, Patricia"), lo de hoy (sesiones), acciones rápidas, alertas, tarjetas de herramientas/módulos.
2. **Tarjetas grandes y calmadas**: radios 20–28 px, sombras suaves, mucho aire, jerarquía tipográfica clara, ilustración ligera en SVG inline (nada de imágenes pesadas).
3. **Movimiento con propósito**: entrada escalonada de tarjetas, microinteracciones en hover/press, transiciones de estado (el chip de asistencia aparece al detectar), contadores animados,
   fondos animados **solo** en login/landing.
4. **Accesibilidad**: contraste AA, foco visible, `prefers-reduced-motion` respetado en TODO, objetivos táctiles ≥ 44 px, funcional desde 360 px.
5. **Tema**: diseñar con tokens (shadcn: `background`, `foreground`, `card`, `primary`, `muted`, `accent`, `border`, `ring`, `radius`… más los de estado de SUSAN) para que el modo oscuro sea posible; el modo oscuro es opcional al final.

## 3. Reglas y presupuesto de animación (obligatorias)

- Animar **solo `transform` y `opacity`**. Nunca `width/height/top/left/margin`, ni `filter: blur()` grandes, ni sombras animadas sobre listas largas. `will-change` solo mientras anima.
- Duraciones: microinteracciones 120–200 ms; transiciones de UI 200–300 ms; entradas 350–600 ms; easing `cubic-bezier(0.22, 1, 0.36, 1)`; `stagger` ≤ 60 ms y ≤ 8 elementos.
- `prefers-reduced-motion: reduce` → sin movimiento (fade corto o nada). Un único hook/utilidad central (`web/src/lib/motion`) para que ningún componente lo olvide.
- Animar solo lo visible (`IntersectionObserver`/`useInView`) y **una vez** (no repetir al hacer scroll).
- Fondos WebGL/canvas (p. ej. `Aurora`, `Silk`, `Particles`, `Orb` de ReactBits) **solo** en login/landing: `next/dynamic` con `ssr: false`, carga diferida, pausa con `document.hidden` y fuera de viewport,
  y **fallback CSS** (degradado) si no hay WebGL o hay `reduced-motion`. Prohibidos en pantallas de trabajo (sesión en vivo, tablas, reportes).
- Presupuesto: JS extra de animación ≤ 40 KB gz en rutas de trabajo; sin tareas largas > 50 ms durante animaciones; `next build` sin crecer el JS inicial de `/docente` más de ~15 %.
  Registrar en `DESIGN_PROGRESS.md` cada dependencia nueva con su tamaño.
- Elegir componentes ReactBits que dependan de CSS/`motion` ligero; evitar GSAP salvo 1–2 piezas justificadas. Máximo ~8 componentes ReactBits en total, documentados en `docs/design/SISTEMA.md`.

## 4. shadcn/ui + ReactBits en este repo (JavaScript, Next 16, Tailwind 4)

- Inicializar: `cd web && npx shadcn@latest init` (JS: `"tsx": false` en `components.json`; CSS variables; Tailwind 4; alias `@/`). El proyecto **ya usa** `web/src/components/ui/<Nombre>/<Nombre>.jsx`
  (un folder por componente). Regla: tras `npx shadcn@latest add <x>`, **mover** el archivo generado a su carpeta + `index.js` y mantener la **API de props actual** del ui-kit
  (Button, Card, Field, Modal, Table…) mediante envoltorios, para que las 30+ pantallas no se reescriban. Cada componente rediseñado conserva/ajusta su `*.test.jsx`.
- Tokens: hoy `web/src/app/globals.css` usa nombres propios (`surface`, `muted` = color de texto…). shadcn espera `card`, `muted` (fondo) y `muted-foreground`. Migración con un script (codemod) +
  `npm run lint` + pruebas; no dejar clases rotas (`grep` de las utilidades antiguas al terminar).
- ReactBits (gratuito): se instalan **copiando el componente al repo** desde su registro shadcn, p. ej. `npx shadcn@latest add @react-bits/BlurText-JS-TW` (variante JavaScript + Tailwind; si el registro no
  responde, copiar el código desde <https://reactbits.dev> respetando su licencia y anotando el origen). Ir en `web/src/components/motion/<Nombre>/`.
  Candidatos ligeros: `BlurText`/`FadeContent`/`AnimatedContent` (entradas), `CountUp` (cifras), `SpotlightCard` (hover en tarjetas), `ShinyText`/`GradientText` (acentos), `AnimatedList` (listas),
  `Stepper` (alta de alumno), y para el login uno de `Aurora`/`Silk`/`Orb` con fallback. Verificar la licencia vigente de cada pieza antes de incluirla.

## 5. Alcance de pantallas (todo el producto)

| Área | Rutas | Intención de diseño |
|---|---|---|
| Auth | `/login`, `/recuperar`, `/cambiar-contrasena`, **`/activar-cuenta`** (nueva) | Pantalla dividida: marca + fondo animado + mensaje a un lado, formulario al otro. SUSAN **no tiene autorregistro**: el "signup" de la referencia se resuelve como *activar mi cuenta* (el administrador invita; la persona define su contraseña) y una tarjeta "¿No tienes cuenta? Pídela a coordinación". |
| Shell | `(app)/layout` | Sidebar colapsable (iconos + etiquetas) y barra inferior en móvil; cabecera con búsqueda/atajo (⌘K opcional), notificaciones y menú de usuario; registro de módulos (§6). |
| Docente | `/docente`, `/docente/sesiones/[id]`, `/docente/revision` | Home "Hoy" con tarjetas de sesión; **modo cabina** en la sesión en vivo (cámara + plantilla de alumnos en tarjetas con avatar de iniciales y chips que aparecen al detectar); cola de revisión en dos paneles. |
| Alumno | `/alumno` | Su asistencia como tarjetas por materia con anillo/barra de progreso y límite del 20 %; justificantes como flujo guiado. |
| Reportes y analítica | `/reportes`, `/analitica` | Tablas limpias, gráficas coherentes con la paleta, procedimiento numérico en acordeones; export con feedback. |
| Admin | `/admin/**` | Portada con resumen y accesos; catálogos con tablas/filtros consistentes; **alta de alumno como asistente por pasos** (datos → consentimiento → foto); editor de grupo por pestañas. |
| Técnico | `/tecnico` | Estado del sistema (cámaras, parámetros, índice) como tablero de salud. |
| Transversal | estados vacíos, carga (skeletons), error, toasts, confirmaciones, 404/500 | Ilustraciones SVG ligeras; mensajes humanos en español. |
| Futuro | `/modulos/[id]` | Página "Pronto" generada desde el registro de módulos (§6). |

## 6. Preparar el "plus" (módulos futuros)

Hoy: reconocimiento facial y asistencia. Después, entre otros: **calificaciones y tareas**, **asistente de IA para docentes** (planeación y actividades, al estilo SchoolAI), **mensajería y avisos** a alumnos y tutores,
**calendario escolar** (festivos y suspensiones), **seguimiento de intervención** de alumnos en riesgo con plan de acción, **portal de tutores**, integraciones/importadores y notificaciones.

Para que agregar un módulo no obligue a rehacer la navegación:
- `web/src/lib/modulos.js`: **registro de módulos** `{ id, titulo, descripcion, icono, ruta, roles, estado: 'activo' | 'pronto' | 'beta', grupo }`. Sidebar, Home y búsqueda lo leen (sustituye a `NAV_POR_ROL`).
- Los módulos con `estado: 'pronto'` se muestran con una insignia "Pronto" y abren una página placeholder atractiva (sin datos falsos ni lógica).
- Cada módulo vive en su carpeta (`app/(app)/<modulo>/`, `components/<modulo>/`, `lib/api/<modulo>.js`, `supabase/migrations/NNNN_<modulo>.sql`) siguiendo la convención del repo.
- Documentar en `docs/design/MODULOS.md` cómo se agrega un módulo (checklist de 10 pasos).

## 7. Fases y criterios de aceptación

Cada fase termina con: `npm run lint`, `npm test`, `npm run build` verdes · commit(s) temático(s) con el trailer de coautoría · `git push origin main` · casilla marcada en `DESIGN_PROGRESS.md`.

| Fase | Entregable | Aceptación |
|---|---|---|
| **F0** Investigación | `docs/design/REFERENCIAS.md` (patrones de Home, navegación, tarjetas, login/signup, motion observado) y `docs/design/SISTEMA.md` (paleta, tipografía, radios, sombras, espaciado, movimiento, componentes ReactBits elegidos) | Decisiones justificadas y acotadas; sin capturas de Mobbin en el repo |
| **F1** Infraestructura | shadcn inicializado, tokens migrados, `lib/motion` (hook `useReducedMotion`, `useInView`, variantes), carpeta `components/motion/` con los componentes ReactBits elegidos | Build y pruebas verdes; sin clases de tokens antiguos |
| **F2** ui-kit | Todas las primitivas re-skineadas con la **misma API**; Storybook-lite no requerido; pruebas actualizadas | 0 regresiones en vitest |
| **F3** Shell y Home | Registro de módulos, Sidebar/Topbar/bottom-nav, Home por rol, página `/modulos/[id]` | Navegación por teclado; 360 px sin scroll horizontal |
| **F4** Auth | Login, recuperar, cambiar contraseña, activar cuenta con fondo animado + fallback | Lighthouse accesibilidad ≥ 95; reduced-motion verificado |
| **F5** Operación | Sesión en vivo (cabina), pase manual, revisión, reportes, portal del alumno | Flujos del E2E (`docs` / scripts) siguen funcionando |
| **F6** Admin/técnico/analítica | Catálogos, grupos, alta por pasos, usuarios, bitácora, técnico, analítica | Coherencia visual completa |
| **F7** Pulido de movimiento | Revisión de presupuesto (tamaños, long tasks), reduced-motion, a11y | Cifras registradas en `DESIGN_PROGRESS.md` |
| **F8** Cierre | Recorrido en navegador (desktop + 360 px) con la semilla, README/CLAUDE.md actualizados, `docs/design/*` completos | Todo verde y subido a GitHub |

## 8. Cómo ejecutarlo (sesión que continúa)

1. Lee `CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, este plan y `docs/DESIGN_PROGRESS.md`. Actualiza `DESIGN_PROGRESS.md` **antes de empezar** y cada ~10 minutos / al cerrar cada paso con `scripts/design-heartbeat.sh [running|pending|done] [fase]` (NUNCA lo automatices con un bucle en segundo plano: un latido falso bloquearía la continuación tras un corte de usage).
2. Levanta el sistema local: `scripts/dev-all.sh` (usa `~/.susan-local`; cuentas demo `demo1234`; reloj de la semilla 14-sep-2026 07:12). Prueba visual: herramienta Browser `preview_start` con `url` (localhost funciona así).
3. Paraleliza con la herramienta `Workflow` (**≤ 4 agentes a la vez**, esfuerzo medio, prompts autocontenidos que apunten a este plan). Cada agente toca solo su zona; el integrador (tú) revisa lint/tests/build.
4. Dependencias nuevas: solo las necesarias, registradas con su tamaño. Next 16 ≠ el que conoces: lee `web/node_modules/next/dist/docs/` antes de tocar código de Next.
5. Git: el usuario **autorizó** subir a `https://github.com/k1rie/susan.git` (rama `main`). Commits temáticos pequeños con `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; **nunca** `--force`; no subir secretos (`.env*`, llaves).
6. El Escritorio está en iCloud (desaloja archivos): no recrear symlinks sobre nombres antiguos; `node_modules`, `.next` y el venv son `*.nosync`; datos locales en `~/.susan-local/SUSAN` (ver `docs/ARCHITECTURE.md` §13).
7. Si el usage se agota, una tarea programada (`susan-continuar-diseno`) retoma desde `DESIGN_PROGRESS.md` cuando se reinicie. Al terminar todo, ponla en `done` y deshabilita la tarea.
