# Brief común de los frentes F2–F6 (rediseño de formularios)

Reglas compartidas por los cinco agentes de pantallas que trabajan en paralelo. Cada agente recibe además su zona y su
alcance concretos. Las primitivas (campos y contenedores) ya existen: se usan, no se reinventan.

## 1. Lectura obligatoria (en este orden, antes de escribir código)

1. `CLAUDE.md` de la raíz: un componente = una carpeta (`Nombre.jsx`, `useNombre.js`, `nombre.utils.js`,
   `Nombre.test.jsx`, `index.js`); 4 espacios, comillas simples, punto y coma; dominio y textos de UI en español con
   tildes; comentarios en español que explican el porqué; solo tokens semánticos de Tailwind (nunca hex); iconos
   siempre Lucide con `aria-hidden="true"` y `strokeWidth` 1.5–1.75 (nada de SVG a mano, emojis ni símbolos de texto
   como icono); `clsx` fuera de `components/shadcn`; movimiento solo con CSS/`components/motion` (transform/opacity) y
   apagado con «reducir movimiento»; 360 px sin desborde horizontal; datos solo por `@/lib/api/*` y `@/lib/http/*`;
   **sin dependencias nuevas**; los contratos de RPC y rutas son ley (no se cambian).
2. `web/AGENTS.md`: este Next 16 no es el que conoces. Lee la guía relevante de `web/node_modules/next/dist/docs/01-app/`
   antes de tocar cosas de Next (middleware = `proxy`; `params`, `searchParams`, `cookies()` son asíncronos).
3. `docs/design/SISTEMA.md` (identidad y forma) y los documentos de `docs/design/formularios/`:
   - `auditoria.md`: §1 resumen, §2 estado de git (qué archivos tienen cambios sin commit del usuario), la ficha de tu
     zona en §3 y tu frente en §5.
   - `PRIMITIVAS-campos.md` y `PRIMITIVAS-contenedores.md`: contrato de las primitivas ya construidas.
   - `referencias-campos-y-validacion.md` y `referencias-flujos-guiados.md`: patrones de Mobbin, con textos de ayuda y
     error sugeridos.
4. El código actual de tu zona y de las primitivas que vayas a usar (`web/src/components/ui/*`, `web/src/hooks/ui/*`,
   `web/src/lib/formularios/*`). Para contratos de RPC: `docs/API-RPC.md`, `docs/api/*` y `supabase/migrations/02xx_*`
   (solo lectura).

## 2. Notas de los autores de las primitivas

- `onChange` recibe **evento** en controles de texto (`Input`, `CampoFecha`, `CampoPassword`, `Select`) y **valor** en
  elecciones (`Combobox`, `SegmentedControl`, `TarjetaOpcion`, `Switch`). Tabla en `PRIMITIVAS-campos.md` §0.
  `useFormulario` acepta ambos; lee su firma real en `web/src/hooks/ui/useFormulario.js` (`mapearError` pega el error
  del servidor al campo que lo causó; no devuelve ref de `<form>`).
- `Modal`: pasa `showClose` de forma explícita (por compatibilidad queda en false); `size="full-mobile"` lo muestra
  solo; `dirty` + `onDiscard` piden confirmar al cerrar con cambios. `PanelLateral` y `Asistente` se describen en
  `PRIMITIVAS-contenedores.md` (incluye cuándo usar Panel lateral, Modal, Asistente o página).
- `Field` tiene `reserveError` (opt-in), `valid`, `example`, `counter`, `optional`, `labelAction`. `Select` ahora va
  dentro de un contenedor: las clases de ancho y margen se reparten solas.
- `FormActions sticky="movil"` asume la altura de la BottomNav.
- Dentro de `Modal`/`PanelLateral` el `Combobox` no cierra el contenedor con Esc (solo la lista).

## 3. Reglas de colaboración (estrictas)

- **Solo editas los archivos de tu zona.** No edites `web/src/components/ui/**`, `web/src/hooks/ui/**`,
  `web/src/lib/formularios/**`, `web/src/components/layout/**`, `web/src/app/globals.css`, `web/package.json` ni su lock,
  `docs/design/SISTEMA.md`, `docs/API*.md`, `docs/api/*`, `supabase/**`, ni nada de otras zonas. Si una primitiva tiene un
  error o te falta algo, **no la edites**: contornéalo localmente y descríbelo en `requests` de tu reporte final, con
  detalle, para que el lead lo corrija.
- **Congelado** (trabajo sin commit del usuario o consumido por el asistente facial; no tocar): `SubidaFotosPlantilla`,
  `GaleriaTomas`, `CalidadFotoResumen`, `PlantillaFacialPanel`, `RegistroFacialGuiado`, `CapturaGuiadaPlantilla`,
  `CapturaContinua`, `SimuladorCamara`, `VistaCamara`, `CameraCapture`, `DeteccionRostros`, `MarcosRostros`,
  `AbrirSesion`, `MonitorSesion`, `MisJustificantes`, `CasoPendiente`, `ColaRevision`, `LecturasCaso`,
  `EtiquetaSospechosa`, `AppShell`, `Sidebar`.
- Árbol sucio: antes de editar un archivo existente haz `git diff -- <archivo>`. Si ya tiene cambios sin commit,
  edítalo solo con `Edit` quirúrgico y conserva esos cambios. Nunca reescribas con `Write` un archivo existente que
  tenga cambios sin commit.
- **No** hagas commit, `git add`, `stash`, `checkout` ni `reset`. **No** ejecutes `next build` ni `npm run build`, ni
  `scripts/seed-demo.sh --reset`, ni detengas o reinicies el servidor de desarrollo.
- Los cambios son de **presentación y validación de conveniencia**: no cambies RPC, rutas, payloads ni códigos de
  error; el servidor sigue siendo la validación real. Los límites de la base están en `lib/formularios` (`LIMITES`).
- Pruebas: mantén verdes las existentes (fijan etiquetas y textos; si cambias un texto a propósito, actualiza la
  prueba) y añade pruebas (`// @vitest-environment jsdom`) para lo nuevo y para los componentes de tu zona que hoy no
  tengan. Verifica con `cd web && npx eslint <rutas> && npx vitest run <rutas>`.
- Interfaz en Hanken Grotesk 14 px; formas de `SISTEMA.md` (tarjetas `rounded-xl border-border bg-card` sin sombra;
  botones y campos `rounded-md`; primario negro; foco `focus-visible:ring-4 ring-ring/30`); estados de asistencia siempre
  con texto y color.

## 4. Verificación visual (obligatoria)

- Ya hay un servidor de desarrollo en `http://localhost:3000` (PostgreSQL local y servicio de reconocimiento arriba; HMR
  recarga tus cambios). Si ves un error de compilación ajeno a tu zona, espera un minuto: otros agentes editan a la vez.
- Cuentas y contraseña de desarrollo: `docs/DEMO.md` §2 y `README.md` de la raíz (cuentas del seed local; entorno de
  pruebas).
- Usa el navegador integrado (herramientas `mcp__Claude_Browser__*`, diferidas: cárgalas con ToolSearch) en **tu propia
  pestaña** (no toques las de otros agentes) y ciérrala al terminar.
- Revisa cada formulario rediseñado a 360 px (`resize_window` con preset mobile) y en escritorio, en claro y oscuro,
  con teclado y foco visible, estados de error, éxito y carga, sin desborde horizontal y sin errores de consola.
  Restablece el tamaño de ventana (preset desktop) al terminar.
- Los registros de prueba que crees en la base local llevan el prefijo «ZZ Prueba» (matrículas y correos claramente
  falsos) y los listas en tu reporte.

## 5. Entrega

- Un resumen corto y útil en `docs/design/formularios/FRENTE-F<n>-<nombre>.md` (único archivo de docs que puedes crear
  o editar): qué cambió por formulario (antes → después), primitivas usadas, decisiones, pruebas y `requests`.
- Reporte final de ≤300 palabras: por formulario antes → después, primitivas usadas, resultado de eslint y vitest
  (cantidad), qué verificaste en el navegador (360 px, claro y oscuro), registros «ZZ Prueba» creados y `requests`
  (cambios que necesitas fuera de tu zona, errores de primitivas) con detalle.
