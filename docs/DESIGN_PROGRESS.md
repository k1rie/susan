---
status: pending
heartbeat: 2026-10-03T08:57:41Z
phase: F11
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
- [x] **F10** Menos texto + gráficas shadcn/recharts (2026-10-03; las gráficas las reemplazó F11): dona, barras y tarjeta de gráfica compartidas; Reportes en pestañas; Analítica con shadcn chart; paneles de docente, revisión, sesión, alumno, admin y técnico con cifras y gráficas; textos largos plegados (`Detalles`). Orquestado con un workflow de 12 agentes (implementar → revisión adversarial → corrección).
- [x] **F11** Gráficas hechas a mano (2026-10-03): el usuario rechazó el aspecto de las gráficas shadcn/recharts de F10 y, tras compararlas en una página temporal, aprobó una familia propia en SVG/CSS para toda la app: `AnilloEstados` (estados), `BarrasPildora` (rankings y comparaciones), `BarraSegmentada` (tablas), `TiraSemana` (patrón semanal), `Sparkline` y `StatCard` con `serie` (solo con serie real), `MedidorLiquido` sobre `motion/SloshGauge` (solo sesión en vivo y vista del alumno) y `GraficaLinea` (Analítica). Todas con la misma entrada «una vez al entrar en vista», texto alternativo y sin reiniciarse con datos vivos. Retirados `GraficaDona`, `GraficaBarras`, `shadcn/chart.jsx`, `useDatosEstables`, el patrón `next/dynamic` + `*Impl.jsx` y `recharts`. Reglas en `docs/design/SISTEMA.md`; decisión en `docs/DECISIONS.md` §5; peso F11 medido en F11b («Presupuesto de rendimiento»). Hecha por agentes por zona (primitivas, migración de pantallas, limpieza y documentación).
- [ ] **F11b** Medir el peso F11 y rellenar la tabla de «Presupuesto de rendimiento» y `docs/DECISIONS.md` §5 — **peso hecho (2026-10-03)**: F11 dejó `/docente` en 257,7 KB gz (> 240,7) y se recortó a 226,1 (+8,0 %) con carga diferida (`docs/DECISIONS.md` §7). Falta repetir el tiempo de ejecución con `next start`
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
| 2026-10-03 | F11: familia de gráficas hechas a mano (SVG/CSS) en toda la app; se retiran shadcn chart y recharts | sin commit aún (base `7553e00`) |
| 2026-10-03 | F11b (peso): `/docente` 257,7 → 226,1 KB gz con `React.lazy` (contenido del panel, paleta ⌘K, reloj de demostración) e importaciones sin barril | sin commit aún |

## Dependencias añadidas de animación y gráficas (nombre · tamaño gz · dónde)

| Dependencia | Tamaño | Dónde / decisión |
|---|---|---|
| `tw-animate-css` | solo CSS (utilidades de entrada/salida de shadcn) | `globals.css` |
| `radix-ui`, `class-variance-authority`, `tailwind-merge`, `clsx` | solo lo importado (Slot, etc.) | `components/shadcn/*`, `lib/utils.js` |
| `gsap` | **no se instala** (~70 KB) | `Reveal` lo sustituye con CSS + IntersectionObserver |
| `motion` | **no se instala por ahora** (~30 KB) | se reevalúa en F4 para `Stepper`/`AnimatePresence` con `LazyMotion` |
| `recharts` | ≈ 130 KB gz (fue la mayor dependencia del rediseño) | Usada en F10 (`components/shadcn/chart.jsx`, cargada con `next/dynamic`); **retirada en F11** por las gráficas hechas a mano |

## Presupuesto de rendimiento (F11 medido: `/docente` dentro, +8,0 %)

Medido el 2026-10-03 con `scripts/measure-bundle.mjs` (suma de chunks JS que referencia cada ruta, gzip nivel 9) contra la **base previa al rediseño**
(commit `232b09f`, compilada en un worktree aparte). Presupuesto del plan: JS inicial de `/docente` ≤ +15 %.

Las columnas «F10» son la medición previa, con las gráficas shadcn/recharts diferidas con `next/dynamic`; «F11» son las gráficas hechas a mano, sin recharts, importadas
de forma estática; «Actual» es F11 más la carga diferida de `docs/DECISIONS.md` §7. F11 y Actual se midieron el 2026-10-03 sobre el árbol de trabajo, con un build aparte
(`NEXT_DIST_DIR=.next-bundle npm run build` y `NEXT_DIST_DIR=.next-bundle node ../scripts/measure-bundle.mjs .`), para no tocar el `.next` del servidor de desarrollo.
Con F11, `/docente` quedó **fuera** del presupuesto (257,7 > 240,7 KB gz); con la carga diferida volvió a **226,1 KB gz (+8,0 %)**, con 14,6 KB de margen.

| Ruta | Base (gzip KB) | F10 (gzip KB) | Cambio F10 | F11 (gzip KB) | Cambio F11 | Actual (gzip KB) | Cambio actual |
|---|---|---|---|---|---|---|---|
| `/login` | 197.7 | 211.6 | +7.0 % | 213.2 | +7.8 % | 209.1 | +5.8 % |
| `/docente` | 209.3 | 240.5 | +14.9 % | 257.7 | +23.1 % | **226.1** | **+8.0 %** |
| `/admin` | 207.2 | 235.4 | +13.6 % | 246.8 | +19.1 % | 236.9 | +14.3 % |
| `/alumno` | 218.8 | 249.6 | +14.1 % | 272.3 | +24.5 % | 265.5 | +21.3 % |
| `/analitica` | 344.3 | 255.2 | -25.9 % | 280.3 | -18.6 % | 272.9 | -20.7 % |
| `/reportes` | 216.1 | 245.3 | +13.5 % | 260.1 | +20.4 % | 253.0 | +17.1 % |
| `/docente/sesiones/[id]` | 221.9 | 245.8 | +10.8 % | 278.2 | +25.4 % | 274.0 | +23.5 % |
| `/modulos` | — | — | — | 231.0 | — | 217.6 | — |

El presupuesto del plan solo fija `/docente`. `/alumno`, `/reportes` y `/docente/sesiones/[id]` quedan por encima de +15 % sobre su base (sus pantallas abren con
cifras y gráficas desde F10/F11); si se les fija presupuesto, el siguiente recorte conocido es la duplicación de `Link`, Lucide y `Button` en los chunks de
`app/error.jsx` y `app/not-found.jsx` (~12 KB gz en cada ruta, ver `docs/DECISIONS.md` §7).

Recorte de F11 a Actual (detalle en `docs/DECISIONS.md` §7): el contenido de `PanelDocente` (se pinta solo con los datos, pedidos en el cliente) se carga con `React.lazy`
desde `ContenidoPanel.jsx`; la paleta ⌘K y el reloj de demostración se cargan con `React.lazy` en `AppShell`; y se importa directo en lugar de los barriles
`@/components/motion` y `@/hooks/data`, que arrastraban `SloshGauge`, `SpotlightCard`, `useMe` y `useApiMutation`. Para ver qué pesa en una ruta:
`cd web && NEXT_DIST_DIR=.next-bundle npx next experimental-analyze --output` (escribe en `<distDir>/diagnostics/analyze`).

Historia (F10): tras agregar las gráficas shadcn (recharts ≈ 130 KB gzip) `/docente` subió a 371 KB (+77 %). Se cargaron con `next/dynamic` (`ui/GraficaDona`, `ui/GraficaBarras`,
`analitica/GraficaSerie` y `analitica/GraficaAcumulado`; las implementaciones vivían en `*Impl.jsx`): el chunk de recharts se descargaba aparte, solo en las pantallas con gráficas y con el alto reservado,
y el JS inicial volvió a entrar en presupuesto. En pruebas, `next/dynamic` se sustituía por un shim síncrono. **F11 quitó la causa** en vez de seguir difiriéndola: sin recharts no hay chunk de ~130 KB
ni patrón `*Impl` ni shim, y las gráficas se importan de forma estática. La primera medición del rediseño dio +15,3 % en `/docente`; `cn()` (tailwind-merge, ~7 KB gz) se había colado en componentes nuevos. `cn()` queda **solo** para
las primitivas de shadcn (`components/shadcn`); el resto usa `clsx`. Sin `gsap` ni `motion` (≈ 100 KB gz evitados).

Lecciones de F11 (gráficas hechas a mano):

- **Probar el aspecto antes de migrar.** El estilo se comparó lado a lado (actual vs. nuevo) en una página temporal y solo entonces se aprobó cambiar toda la app; la página (`preview-graficas`) es temporal y se elimina al terminar la migración.
- **El contenedor con `ref` existe siempre**, también sin datos: si solo se monta con datos, `useEnVista` nunca ve el nodo y una gráfica que pasa de «sin datos» a «con datos» (la sesión en vivo al recibir su primer registro) queda invisible.
- **Datos vivos no reinician la entrada.** La sesión sondea cada 5 s: la entrada ocurre una vez y después hay transiciones cortas (~0,5 s). `CountUp` reiniciaba desde 0 al cambiar `to` (ahora sigue desde la cifra visible) y `SloshGauge` no volvía a animarse en StrictMode porque el id del `requestAnimationFrame` quedaba colgado tras cancelarlo.
- **«Sin dato» no es 0.** `null` se escribe «-» y se lee «sin datos»; `puntosSerie` convierte `null` en 0, así que `Sparkline` limpia la serie con `limpiarSerie` antes de dibujar.
- **Hidratación.** Sin `Math.random`, `Date.now` ni `typeof window` en el render; se comprobó con `renderToString` + `hydrateRoot`. Los anchos de texto se estiman en «em» (`anchoTextoEm`) y las columnas miden su contenedor con `ResizeObserver`, para que las cifras no se solapen ni desborden a 360 px.
- **jsdom no trae `IntersectionObserver`, `ResizeObserver` ni `matchMedia`**: las pruebas los simulan con `vi.stubGlobal`.
- **Revisar a 360 px, en claro y en oscuro, en un navegador real** (arnés estático aparte) encontró cosas que las pruebas no ven: puntos resaltados por debajo de las líneas y valores de tooltip que se partían.
- **Compatibilidad y 360 px, ya resueltas.** `usePrefersReducedMotion` usa `addEventListener` y cae a `addListener` (Safari anterior a 14) o no se suscribe si no hay ninguno (con pruebas en `lib/motion/motion.test.jsx`); `TarjetasAnalitica` usa **una columna bajo 480 px**, porque una tarjeta de media pantalla a 360 px dejaba ~126 px y aplastaba el `Sparkline` (~33 px).
- **Pendientes conocidos**: en `TiraSemana` las casillas más intensas dan ~3,9:1 de contraste en tema oscuro; cada `GraficaLinea` monta su copia de los fotogramas CSS (`<style>`, que la CSP permite con `style-src 'unsafe-inline'`).

Tiempo de ejecución, medición previa a F11 (build de producción con `next start`, Chrome del pane, localhost, sin red); repetir tras F11 (casilla F11b): no medido aún.

| Medida | `/docente` | `/alumno` |
|---|---|---|
| First Contentful Paint | 76 ms | 92 ms |
| Largest Contentful Paint | 108 ms | 164 ms |
| Cumulative Layout Shift | 0,019 | 0,021 |
| Tareas largas (> 50 ms) | 0 | 0 |
| Fotogramas en reposo (5 animaciones CSS activas) | 120 fps, peor fotograma 9 ms | — |

Las animaciones usan `transform`/`opacity` (compositor; las gráficas de F11 tienen excepciones documentadas en `docs/design/SISTEMA.md`, «Movimiento»), un observador por bloque y se apagan con "reducir movimiento". Para repetir: `cd web && npm run build && node ../scripts/measure-bundle.mjs .`
