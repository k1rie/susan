# Sistema de diseño de SUSAN

**Dirección (confirmada con el usuario el 2026-10-03):** sidebar, navegación, tarjetas y tipografía copian **Dropbox Dash**; el login/registro, el onboarding y el
saludo del Home conservan el espíritu de **SchoolAI**. Referencias medidas y capturas descritas en [`REFERENCIAS.md`](./REFERENCIAS.md); registro de módulos en [`MODULOS.md`](./MODULOS.md);
reglas de movimiento en `web/src/components/motion/README.md`; plan y avance en [`../DESIGN_PLAN.md`](../DESIGN_PLAN.md) y [`../DESIGN_PROGRESS.md`](../DESIGN_PROGRESS.md).

## Reglas que no se negocian

1. **Iconos: SIEMPRE Lucide** (`lucide-react`, trazo 1.5–1.75, `aria-hidden="true"`). Nada de SVG a mano para iconos, emojis ni flechas/triángulos de texto.
2. **Solo tokens** de `web/src/app/globals.css` (nunca hex en componentes). Los estados de asistencia siempre llevan texto además de color.
3. Todo se ve bien a **360 px** sin scroll horizontal y respeta **"reducir movimiento"**.
4. Peso: `/docente` ≤ +15 % de JS gzip respecto a la base (medir con `scripts/measure-bundle.mjs`).
5. Gráficas: solo la familia hecha a mano de `components/ui` (SVG/CSS, sin recharts ni otra librería de gráficas); ver la sección «Gráficas» más abajo.

## Identidad

| Elemento | Decisión |
|---|---|
| Lienzo | Crema `#F7F5F2` (`--background`); el riel vive directamente sobre él, sin borde |
| Panel de contenido | Blanco `#FFFFFF` (`--card`) **flotante**: margen de 8 px, esquinas de 18 px (`rounded-2xl`), borde `rgba` casi invisible; en escritorio hace su propio scroll |
| Tinta | `#1E1919` (`--foreground`); secundario `#6F6A65` (`--muted-foreground`); bordes `#E7E2DC`; campos `#D8D2CA` |
| Acción primaria | **Tinta casi negra** (`--primary` = `#1E1919`, texto blanco), como «Create Stack» de Dash; píldora activa también en tinta |
| Enlaces y foco | Azul `#0061FE` (`--link`, `--ring`) |
| Superficies de apoyo | `--muted` `#F0EDE8` (píldoras inactivas, campos deshabilitados), `--accent` `#EFECE7` (hover y activo) |
| Marca SUSAN | Solo «SUSAN» (sin escudos ni logotipos de terceros); dorado `#A8842C` solo como acento (subrayado del saludo, listas de «qué incluirá») |
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
- **Teléfono/tableta (< 1024 px)**: **sin barra superior**. Solo la barra inferior flotante: hasta 3 destinos + el botón central (la acción del rol o «Buscar») + «Más», que siempre está y abre el riel convertido en cajón a todo lo alto (marca, «Buscar», navegación, «Módulos» y la cuenta con «Salir»). El panel ocupa todo el ancho.
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
| `sesion/PasosPaseLista` | Check-in de Luma y Partiful (Mobbin, ver `REFERENCIAS.md`) | Franja de 3 pasos *Abrir → Pasar lista → Revisar y cerrar* (o *Marcar alumnos → Guardar y cerrar* en el pase manual), siempre visible en la sesión; el paso actual en tinta, los hechos con palomita verde, y una línea con lo que toca hacer. Con `onIrA` los pasos 2 y 3 navegan. Sustituye a la guía descartable de tres tarjetas |
| `sesion/ListaAlumnosSesion` | Lista de invitados de Partiful y Meetup | Alumnos como filas (nombre, matrícula, estado, «Registrar»), con `ui/Pills` «Sin registro / Todos»; cabe en 360 px sin desplazarse. Reemplaza a la tabla de 8 columnas en la revisión |

## Gráficas y «menos texto» (familia hecha a mano)

Principio (pedido del usuario, 2026-10-03): cada pantalla abre con **cifras y gráficas**; la explicación va corta o plegada.
En F11 el usuario rechazó el aspecto de las gráficas de shadcn/recharts (F10) y aprobó **una familia propia dibujada con SVG y CSS**, sin librerías de gráficas,
aplicada en toda la app: trazos finos y redondeados, píldoras, puntos con aro del color de la tarjeta, colores vivos `--g-*` y una entrada que se «dibuja» una sola vez.
Todas viven en `components/ui/<Nombre>/` y se envuelven en `ui/TarjetaGrafica`.

### Cuándo usar cada una

| Qué quieres mostrar | Usa | Notas |
|---|---|---|
| **Estados** (presentes, retardos, ausencias…) con un total | `ui/AnilloEstados` | Anillo fino con el total (o un valor propio, p. ej. «82 %») al centro y leyenda con cifra y porcentaje. Sustituye a la dona |
| **Ranking** o lista de categorías con una magnitud (alumnos con más faltas, grupos, cámaras) | `ui/BarrasPildora` con `horizontal` | Barras de píldora con la cifra al final; `limite` dibuja el umbral (p. ej. 20 % de faltas). Máx. 8 filas + «Ver todos» |
| **Comparar** pocas categorías o periodos | `ui/BarrasPildora` (columnas) | Una o varias series, lado a lado o con `apilado`. Sustituye a las barras de recharts |
| **Patrón semanal**: un valor por día (1–7 casillas) | `ui/TiraSemana` | Mapa de calor: la casilla se tiñe en proporción al valor y lleva anillo al alcanzar el límite |
| **Historial de una persona sesión por sesión** (semanas × días, un cuadro por sesión coloreado por su estado; vista del alumno) | `ui/CalendarioAsistencia` | Cuadrícula tipo calendario de contribuciones; los días sin sesión quedan en gris tenue, una sesión sin registro lleva borde discontinuo y una suspendida va en gris; con más de `maxSemanas` se ven las más recientes. Solo anima `opacity`/`transform`, una vez al entrar en vista. La usa `alumno/CalendarioRacha` |
| **Composición** dentro de una fila de tabla o en un espacio angosto | `ui/BarraSegmentada` | Una barra de segmentos proporcionales; `leyenda={false}` para caber en una celda |
| **Evolución en el tiempo** (series, media móvil, banda, límite, marca vertical) | `ui/GraficaLinea` | Rectas, nunca suavizadas; puntero y teclado con tooltip; es la base de `analitica/GraficaSerie` y `analitica/GraficaAcumulado` |
| **Cifra clave con su tendencia** | `ui/StatCard` con `serie` (o `ui/Sparkline` suelto) | **Solo si hay una serie real** de ≥ 2 puntos: nunca se inventan datos para que la tarjeta «tenga línea» |
| **Nivel 0–100 %** que se está moviendo (asistencia de la sesión en vivo, porcentaje de la persona) | `ui/MedidorLiquido` | **Solo** en la sesión en vivo y en la vista del alumno; es un adorno con significado, no una gráfica de uso general. Envuelve `motion/SloshGauge` |

Si ninguna sirve, primero se evalúa si basta una prop nueva; solo si no, se crea una pieza nueva (ver «Cómo agregar una gráfica nueva»).

### Contrato resumido

| Componente | Props (valor por defecto) |
|---|---|
| `AnilloEstados` | `datos` `[{ clave, valor }]` · `config` `{ clave: { label, color } }` · `centro` `{ valor, etiqueta }` (sin `valor` muestra el total; «Total» por defecto) · `alto` 240 · `vacio` · `className`. Un estado con valor 0 sale en la leyenda atenuado; un valor positivo muy pequeño se escribe «<1 %» |
| `BarrasPildora` | `datos` (filas con la categoría `ejeX` y una propiedad por serie) · `ejeX` · `series` `[{ clave }]` · `config` · `horizontal` · `apilado` · `limite` `{ valor, etiqueta }` · `unidad` · `dominio` `[min, max]` (admite `'auto'`) · `alto` 260 (en horizontal solo fija el aviso vacío: la altura la dan las filas) · `anchoEjeY` 110 · `leyenda` (por defecto, con más de una serie) · `formatoValor` (texto corto) · `vacio` · `className`. `null` es «sin dato» y se escribe «-»; no es un 0 |
| `BarraSegmentada` | `datos` `[{ clave, valor }]` · `config` · `alto` 12 (grosor) · `leyenda` true · `vacio` · `etiqueta` (texto alternativo propio) · `className`. Sin leyenda es `role="img"`; con leyenda la barra se oculta a los lectores porque la leyenda ya trae las cifras |
| `TiraSemana` | `datos` `[{ etiqueta, valor }]` (`null` = sin dato: casilla neutra con «-») · `limite` (número) · `unidad` ' %' · `vacio` · `className` (va al contenedor, que mide como mucho 7 rem por casilla) |
| `CalendarioAsistencia` | `sesiones` `[{ fecha: 'YYYY-MM-DD', estado: 'presente'\|'retardo'\|'ausente'\|'justificado'\|'pendiente'\|null, estatus?: 'suspendida' }]` (acepta también `estatus_sesion`, la forma de los `items` de `api_alumno_historial`) · `maxSemanas` 26 · `leyenda` true (cifras por estado) · `etiqueta` (texto alternativo; con `''` no se lee nada, para cuando la tarjeta ya trae el resumen) · `vacio` 'Aún no hay sesiones registradas' · `className`. La cuadrícula es `aria-hidden` |
| `Sparkline` | `valores` (serie real; con menos de 2 puntos reales devuelve `null`) · `ancho` 120 · `alto` 36 · `color` (token) · `min`/`max` (dominio fijo) · `className` (va al `svg`). Decorativa (`aria-hidden`): la tendencia se dice también en texto |
| `StatCard` | Las de siempre más `serie` (números reales, ≥ 2) y `serieColor` (token; por defecto sale del `tone`). Con `loading` o sin serie válida el HTML es el de antes |
| `MedidorLiquido` | `valor` 0–100 · `tono` `presente\|retardo\|ausente\|azul\|violeta` · `etiqueta` · `descripcion` · `limite` `{ valor, etiqueta }` (marca discontinua con su texto al lado) · `ancho` 84 · `alto` 168 · `className`. Es `role="meter"`: el lector recibe siempre el valor real aunque el líquido aún suba |
| `GraficaLinea` | `datos` (filas `{ [ejeX]: número, …valor por serie }`; un valor puede ser número, `null` = hueco o `[inferior, superior]` = banda) · `ejeX` 'x' · `series` `[{ clave, tipo: 'puntos'\|'linea'\|'banda', discontinua, grosor, color, etiqueta }]` · `limite` · `marcaX` `{ valor, etiqueta }` · `formatoX` · `formatoY` · `dominioY` `[0, 'auto']` · `alto` 280 · `leyenda` (true, false o un nodo propio) · `renderFila` · `tituloTooltip` · `descripcionActivo` (texto del `aria-live`) · `ocultarVacios` · `ariaLabel` · `vacio` · `className`. Teclado: ← → Home End y Esc |

Piezas de apoyo:

| Pieza | Uso |
|---|---|
| `ui/TarjetaGrafica` | Tarjeta (borde, sin sombra) con título, descripción corta, acciones, gráfica y pie; `resumen` = **texto alternativo obligatorio** para lectores de pantalla |
| `ui/Detalles` | Plegable para tablas completas, procedimientos y explicaciones; siempre visible al imprimir |
| `lib/graficas.js` | Colores y textos: `CONFIG_ASISTENCIA` (los 5 estados), `COLORES_SERIE`, `colorGrafica`, `pct`, `sumar`, `resumenTexto`, `formatoPct`, `formatoNumero`, `textoPct`, `numeroOpcional`, `valorNoNegativo`, `anchoTextoEm` |
| `lib/graficasGeometria.js` | Funciones puras con pruebas: dominios y escalas (`dominioFinal`, `dominioConLimite`, `ticksAmigables`), trazos (`trazoSuave`, `trazoPoligonal`, `trazoBanda`), marcas del eje (`adelgazarMarcas`) y cajas (`posicionTooltip`, `cajaEtiquetaLimite`, `cajasSeSolapan`) |

### Reglas

1. **Color por token.** Nunca hex. Las pantallas pasan los tokens de texto de siempre (`--presente`, `--ausente`, `--chart-1`…) y `colorGrafica` los traduce a los vivos de gráfica `--g-*`
   (`--g-presente`, `--g-retardo`, `--g-ausente`, `--g-justificado`, `--g-pendiente`, `--g-azul`, `--g-violeta`, `--g-dorado`, con su variante `.dark` en `globals.css`): así cambiar la paleta no toca las pantallas.
2. **Texto alternativo.** Cada gráfica va en una `TarjetaGrafica` con `resumen` (usa `resumenTexto`), que se lee como texto oculto. Lo dibujado (SVG, barras) es `aria-hidden` y cada pieza trae
   además su propio texto (leyenda, lista oculta de filas, `aria-label`, `aria-live` en `GraficaLinea`).
3. **El color nunca es la única señal.** La cifra siempre está escrita, los estados llevan etiqueta de texto y el límite alcanzado se dice en texto (anillo + texto accesible en `TiraSemana`).
4. **Sin dato no es cero.** `null`/vacío se escribe «-» (y «sin datos» para lectores); un día sin sesiones no es un día con 0 % de ausentismo. Los negativos se dibujan como 0.
5. **El límite se explica.** En columnas la leyenda lleva su entrada (una etiqueta sobre la línea chocaría con la cifra de la barra cercana, justo la que importa); en filas la etiqueta va sobre la primera fila;
   un límite fuera de un dominio fijo no se dibuja pegado al borde: se avisa en la leyenda con «(fuera de escala)». En `GraficaLinea` el dominio Y siempre incluye el límite y su etiqueta es un chip en un margen reservado (o va a la leyenda si no cabe, una sola vez).
6. **Animación: una vez, al entrar en vista, y apagada con «reducir movimiento».** Cada pieza usa `useEnVista` y `usePrefersReducedMotion` de `lib/motion`; con «reducir movimiento» no hay observador ni transiciones y se ve el estado final.
   Con datos vivos (la sesión sondea cada 5 s) **no se reinicia la entrada**: las barras, arcos y segmentos se mueven con transiciones de ~0,5 s y un estado que aparece o desaparece se desvanece.
7. **Sin librerías de gráficas ni de animación.** Ni recharts ni Chart.js ni d3 para dibujar; todo es SVG/CSS a mano. No se carga nada con `next/dynamic` por ser gráfica: no hay librería que diferir y se importan de forma estática.
8. **Hidratación limpia.** Sin `Math.random`, `Date.now` ni `typeof window` en el render; el contenedor con `ref` existe **siempre**, también sin datos (si no, una gráfica que pasa de «sin datos» a «con datos» se quedaría invisible porque el observador nunca vería el nodo).
9. **360 px.** Sin desborde horizontal: el anillo pone la leyenda en una columna, las columnas reducen o abrevian las cifras según el ancho medido, `TiraSemana` achica cifra y nombre con container queries.
10. **Densidad.** La gráfica acompaña a la cifra, no la sustituye; ≤ 8 elementos por gráfica (top N + «Ver todos»); tablas con las columnas esenciales (el resto con `hideBelow` o en `Detalles`);
    una misma frase no se repite en cada fila; los textos necesarios (privacidad, «estimación») se acortan o pliegan, no se borran.
11. **Línea de datos exacta.** `GraficaLinea` une los datos con rectas (no se suaviza nada); la curva suave es solo de `Sparkline`, que es decorativa.

### Cómo agregar una gráfica nueva

1. Revisa la tabla de arriba: casi siempre basta una prop o un `tono` nuevo. Si no, crea `components/ui/<Nombre>/` con `Nombre.jsx`, `nombre.utils.js` (la geometría y las reglas, puras), `Nombre.test.jsx` e `index.js`.
2. Dibuja con SVG/CSS y tokens; si necesitas geometría reutilizable, agrégala a `lib/graficasGeometria.js` con su prueba. Reutiliza `lib/graficas.js` (`colorGrafica`, `formatoNumero`, `numeroOpcional`…) y `lib/motion` (`useEnVista`, `usePrefersReducedMotion`, `EASE`).
3. Cumple las reglas de arriba: contenedor con `ref` siempre, `null` ≠ 0, dibujo `aria-hidden` + texto, entrada una vez, sin transiciones con «reducir movimiento», sin `Math.random`/`Date.now`/`typeof window` en el render.
4. Envuélvela en `TarjetaGrafica` con `resumen` y un texto corto; lo largo va en `Detalles`.
5. Pruebas con `// @vitest-environment jsdom`: jsdom no trae `IntersectionObserver`, `ResizeObserver` ni `matchMedia`, así que se simulan con `vi.stubGlobal` (sin `IntersectionObserver`, `useEnVista` cae a «visible»). Cubre datos vacíos, `null`, datos que cambian y «reducir movimiento».
6. Revisa a 360 px, en claro y en oscuro, con datos largos y con pocos; luego mide el bundle (`scripts/measure-bundle.mjs`) y documenta la pieza aquí.

### Retiradas en F11

`ui/GraficaDona` y `ui/GraficaBarras` (sustituidas por `AnilloEstados` y `BarrasPildora`, con la misma API de props), las implementaciones `GraficaSerieImpl` y `GraficaAcumuladoImpl` de Analítica (ahora sobre `GraficaLinea`),
`components/shadcn/chart.jsx`, el hook `useDatosEstables`, el patrón `next/dynamic` + `*Impl.jsx` y la dependencia `recharts`. Su historia está en [`DESIGN_PROGRESS.md`](../DESIGN_PROGRESS.md) (F10) y la decisión en [`DECISIONS.md`](../DECISIONS.md) §5.

## Movimiento

Patrones de ReactBits reescritos en CSS/rAF (sin gsap ni `motion`): `Reveal`, `BlurText`, `CountUp`, `StaggerList` (y `SpotlightCard`, disponible, ya sin uso en el Home) y, adaptado de React Bits,
`SloshGauge` (tanque con líquido físico; solo lo usa `ui/MedidorLiquido`).
Solo `transform`/`opacity`, una vez al entrar en vista, apagado con "reducir movimiento" y visible siempre al imprimir (`[data-anim]`).
Al imprimir o exportar a PDF las entradas por scroll no se disparan: los elementos `[data-anim]` se fuerzan visibles por CSS (`@media print`) y las gráficas y el resto del movimiento se revelan por `beforeprint` en `useEnVista` (con `flushSync`, para que el estado final esté pintado antes de que el navegador maquete el papel).
Dash es sobrio: el movimiento se limita al saludo, la entrada escalonada de tarjetas, los contadores, las gráficas y el panel de producto del login.

**Excepciones documentadas (las gráficas hechas a mano, F11):** además de `transform`/`opacity` animan `clip-path` (revelado de barras y segmentos), `stroke-dasharray`/`stroke-dashoffset` (arcos del anillo y líneas
de `GraficaLinea`) y, solo cuando cambian datos vivos, transiciones de ~0,5 s de posición y tamaño (`left`/`width`, `bottom`/`height`, `flex-grow`) en elementos diminutos dentro de un contenedor de tamaño fijo, de modo que no
mueven el resto de la página. `SloshGauge` anima el `clip-path` de su líquido mientras la física no está en reposo. La regla de fondo sigue: una vez al entrar en vista, sin reiniciar con datos nuevos, y apagado con «reducir movimiento».

## Pantallas de acceso y onboarding

- **Login / recuperar / cambiar contraseña**: pantalla dividida (SchoolAI): formulario a la izquierda con titular serif y subrayado dorado; a la derecha un panel que **demuestra el producto** con 3 escenas rotativas
  (pase de lista, riesgo de ausentismo, historial del alumno), decorativo (`aria-hidden`).
- **Onboarding** (`Onboarding`): panel blanco centrado, progreso con pasos numerados (Lucide `Check` al completar). `/activar-cuenta` (invitación): **contraseña → estilo → guía de tu rol → privacidad**.
  `/bienvenida` (menú de cuenta): los tres últimos. El color del avatar se guarda por navegador (`localStorage`, sin datos sensibles); la contraseña va a Supabase Auth; el acuse de privacidad no sustituye al consentimiento firmado.
  No hay autorregistro: las cuentas las crea el administrador (spec).

## Formularios

Todo formulario o captura de datos es **guiado y dinámico**, con patrones vistos en Mobbin (referencias y URLs en
[`formularios/referencias-flujos-guiados.md`](formularios/referencias-flujos-guiados.md) y
[`formularios/referencias-campos-y-validacion.md`](formularios/referencias-campos-y-validacion.md)):

- **Contenedor según la complejidad**: catálogos de un paso (aula, materia, docente, cámara) en `ui/PanelLateral` (pantalla completa en el teléfono); altas largas (alumno, grupo) en `ui/Asistente` de 3 pasos con revisión («Editar» por sección) y pantalla de éxito con 2–4 siguientes pasos (`ui/SuccessState`); importaciones en un `Modal` por pasos con `ui/Stepper`.
- **Validación al salir del campo** (`hooks/ui/useFormulario`), foco al primer error, límites reales de la base en `lib/formularios` (`LIMITES`), errores del servidor pegados al campo que los causó y un solo aviso por error.
- **Barra de acciones** (`ui/FormActions`) con «N cambios sin guardar» y el motivo visible cuando un botón está bloqueado; el aviso de salida (`useCambiosSinGuardar`) cubre recargar, cerrar, pestañas propias y los enlaces del riel y de la barra inferior.
- **Selectores con búsqueda** (`ui/Combobox`, opciones de dos líneas) en lugar de `<select>` largos; `ui/SegmentedControl` para 2–4 opciones excluyentes (siempre texto + color); `ui/BarraFiltros` para búsqueda con retraso y chips de filtros activos.

Contrato de cada pieza: [`formularios/PRIMITIVAS-campos.md`](formularios/PRIMITIVAS-campos.md) y [`formularios/PRIMITIVAS-contenedores.md`](formularios/PRIMITIVAS-contenedores.md).
Qué cambió en cada pantalla (antes → después): `formularios/FRENTE-F2-acceso-y-consola.md`, `FRENTE-F3-alumnos.md`, `FRENTE-F4-catalogos.md`,
`FRENTE-F5-grupos.md` y `FRENTE-F6-justificantes-y-pase-manual.md`. Auditoría de partida: [`formularios/auditoria.md`](formularios/auditoria.md).

## Qué NO cambia

Lógica de negocio, RPC, contratos y rutas. El rediseño es solo capa de presentación (`components/`, `globals.css`, `app/**/layout|page` delgadas).
