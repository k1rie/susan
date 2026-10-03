# Sistema de diseño de SUSAN

**Dirección (confirmada con el usuario el 2026-10-03):** sidebar, navegación, tarjetas y tipografía copian **Dropbox Dash**; el login/registro, el onboarding y el
saludo del Home conservan el espíritu de **SchoolAI**. Referencias medidas y capturas descritas en [`REFERENCIAS.md`](./REFERENCIAS.md); registro de módulos en [`MODULOS.md`](./MODULOS.md);
reglas de movimiento en `web/src/components/motion/README.md`; plan y avance en [`../DESIGN_PLAN.md`](../DESIGN_PLAN.md) y [`../DESIGN_PROGRESS.md`](../DESIGN_PROGRESS.md).

## Reglas que no se negocian

1. **Iconos: SIEMPRE Lucide** (`lucide-react`, trazo 1.5–1.75, `aria-hidden="true"`). Nada de SVG a mano para iconos, emojis ni flechas/triángulos de texto.
2. **Solo tokens** de `web/src/app/globals.css` (nunca hex en componentes). Los estados de asistencia siempre llevan texto además de color.
3. Todo se ve bien a **360 px** sin scroll horizontal y respeta **"reducir movimiento"**.
4. Peso: `/docente` ≤ +15 % de JS gzip respecto a la base (medir con `scripts/measure-bundle.mjs`).

## Identidad

| Elemento | Decisión |
|---|---|
| Lienzo | Crema `#F7F5F2` (`--background`); el riel vive directamente sobre él, sin borde |
| Panel de contenido | Blanco `#FFFFFF` (`--card`) **flotante**: margen de 8 px, esquinas de 18 px (`rounded-2xl`), borde `rgba` casi invisible; en escritorio hace su propio scroll |
| Tinta | `#1E1919` (`--foreground`); secundario `#6F6A65` (`--muted-foreground`); bordes `#E7E2DC`; campos `#D8D2CA` |
| Acción primaria | **Tinta casi negra** (`--primary` = `#1E1919`, texto blanco), como «Create Stack» de Dash; píldora activa también en tinta |
| Enlaces y foco | Azul `#0061FE` (`--link`, `--ring`) |
| Superficies de apoyo | `--muted` `#F0EDE8` (píldoras inactivas, campos deshabilitados), `--accent` `#EFECE7` (hover y activo) |
| Marca UNACH | Escudo + «SUSAN»; dorado `#A8842C` solo como acento (subrayado del saludo, listas de «qué incluirá») |
| Portadas pastel | `--tono-azul/dorado/verde/violeta/rosa` (+ `-fg` para el trazo del icono); degradado arcoíris para el módulo destacado |
| Estados de asistencia | `presente / retardo / ausente / pendiente / justificado` con su fondo `-bg` (siempre texto + color) |
| Radios | sm 6 · **md 8 (botones, campos)** · lg 10 · **xl 14 (tarjetas)** · 2xl 18 (panel, diálogos) · píldora para chips y filtros |
| Sombras | Casi planas: Dash separa con bordes. `--shadow-lift` solo en menús, diálogos y la ficha del icono |
| Paleta oscura | `.dark` definida con el mismo vocabulario (sin interruptor todavía) |

## Tipografía

| Uso | Fuente | Detalle |
|---|---|---|
| Toda la interfaz | **Hanken Grotesk** (`next/font/google`, variable `--font-hanken`) | Alternativa libre más cercana a la grotesca de Dash. Base **14 px**; título de página 26 px / 500; título de sección 20 px / 600; texto de tarjeta 14,5 px / 500; meta 12 px |
| Saludo del Home y titulares de acceso/onboarding | **EB Garamond** 500 (`font-display`) | Sustituye a «Dante» (SchoolAI, comercial). Solo ahí |
| Datos técnicos | Geist Mono | Contraseñas temporales, JSON de bitácora |

## Armazón (`components/layout`)

- **Escritorio (≥ 1024 px)**: riel de 232 px + panel blanco flotante. **No hay barra superior**: la búsqueda y la cuenta viven en el riel (como en Dash).
- **Riel**: marca arriba · «Inicio» y «Buscar ⌘ K» (abre la paleta) · secciones con título gris (`Catálogos`, `Asistencia`, `Análisis`… definidas por `grupo` en `navItems.js`) ·
  «Próximamente» (módulos de la hoja de ruta con ficha de color y candado) · abajo «Módulos» y la **cuenta** (avatar de color + nombre + rol; el menú abre hacia arriba: ver bienvenida, cambiar contraseña, salir).
  Ítem activo: fondo gris suave y peso 500. Iconos de 20 px.
- **Teléfono/tableta (< 1024 px)**: barra superior fija (menú, marca, buscar, avatar), el riel se convierte en cajón, barra inferior con 4–5 destinos (+ «Más»), el panel ocupa todo el ancho.
- **Paleta de comandos** `⌘K / Ctrl+K`: combobox/listbox sobre páginas, módulos próximos y acciones de cuenta.

## Componentes firma

| Componente | Origen | Uso |
|---|---|---|
| `ui/TarjetaPortada` | «Stacks» de Dash (2.ª imagen) | Franja superior de color (pastel o degradado) con ficha blanca de icono, título en 2 líneas, meta gris y pie (`Abrir` / candado + «Próximamente»). Módulos, catálogo |
| `ui/TarjetaFila` | Tarjetas de «Apps» de Dash (1.ª imagen) | Ficha de icono + título + subtítulo + acción circular a la derecha. Sesiones de hoy, alertas, grupos, guía del onboarding |
| `ui/Pills` | «My apps / All apps» | Filtros: activa en tinta con texto blanco, inactivas en gris cálido, contador opcional |
| `ui/Tabs` | «General / Apps» | Pestañas con subrayado de 2 px bajo la activa |
| `ui/Button` | «Create Stack» | 8 px de radio; primario tinta, secundario blanco con borde, `arrow` opcional (Lucide) |
| `ui/Avatar` | «SL / AS» | Círculo de color sólido con iniciales blancas; el color lo elige la persona en el onboarding (`lib/perfil.js`) |
| `home/Resaltado` | SchoolAI | Subrayado dorado que se dibuja una vez (saludo y titulares) |

## Gráficas y «menos texto» (shadcn chart)

Principio (pedido del usuario, 2026-10-03): cada pantalla abre con **cifras y gráficas**; la explicación va corta o plegada. Las gráficas usan el componente `chart` de shadcn/ui
(`components/shadcn/chart.jsx`: `ChartContainer`, `ChartTooltip(Content)`, `ChartLegend(Content)`) sobre recharts, siempre con colores por token.

| Pieza | Uso |
|---|---|
| `ui/TarjetaGrafica` | Tarjeta (borde, sin sombra) con título, descripción corta, acciones, gráfica y pie; `resumen` = **texto alternativo obligatorio** para lectores de pantalla |
| `ui/GraficaDona` | Distribución de estados con el total (o un %) al centro y leyenda; sin datos muestra un aviso |
| `ui/GraficaBarras` | Barras verticales/horizontales/apiladas con línea de límite (p. ej. el 20 % de faltas) |
| `ui/Detalles` | Plegable para tablas completas, procedimientos y explicaciones; siempre visible al imprimir |
| `lib/graficas.js` | `CONFIG_ASISTENCIA` (los 5 estados), `pct`, `sumar`, `resumenTexto`, `formatoPct` |

Carga: recharts pesa ~130 KB gzip, así que `GraficaDona`/`GraficaBarras` (y las gráficas de analítica) se cargan con `next/dynamic` (chunk aparte, alto reservado, sin SSR); las implementaciones viven en `*Impl.jsx`. Una gráfica nueva debe seguir el mismo patrón.

Reglas: la gráfica acompaña a la cifra, no la sustituye; ≤ 8 elementos por gráfica (top N + «Ver todos»); tablas con las columnas esenciales (el resto con `hideBelow` o en `Detalles`);
una misma frase no se repite en cada fila; los textos necesarios (privacidad, «estimación») se acortan o pliegan, no se borran.

## Movimiento

Patrones de ReactBits reescritos en CSS/rAF (sin gsap ni `motion`): `Reveal`, `BlurText`, `CountUp`, `StaggerList` (y `SpotlightCard`, disponible, ya sin uso en el Home).
Solo `transform`/`opacity`, una vez al entrar en vista, apagado con "reducir movimiento" y visible siempre al imprimir (`[data-anim]`).
Dash es sobrio: el movimiento se limita al saludo, la entrada escalonada de tarjetas, los contadores y el panel de producto del login.

## Pantallas de acceso y onboarding

- **Login / recuperar / cambiar contraseña**: pantalla dividida (SchoolAI): formulario a la izquierda con titular serif y subrayado dorado; a la derecha un panel que **demuestra el producto** con 3 escenas rotativas
  (pase de lista, riesgo de ausentismo, historial del alumno), decorativo (`aria-hidden`).
- **Onboarding** (`Onboarding`): panel blanco centrado, progreso con pasos numerados (Lucide `Check` al completar). `/activar-cuenta` (invitación): **contraseña → estilo → guía de tu rol → privacidad**.
  `/bienvenida` (menú de cuenta): los tres últimos. El color del avatar se guarda por navegador (`localStorage`, sin datos sensibles); la contraseña va a Supabase Auth; el acuse de privacidad no sustituye al consentimiento firmado.
  No hay autorregistro: las cuentas las crea el administrador (spec).

## Qué NO cambia

Lógica de negocio, RPC, contratos y rutas. El rediseño es solo capa de presentación (`components/`, `globals.css`, `app/**/layout|page` delgadas).
