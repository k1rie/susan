# Referencias de diseño (F0)

**Referencia principal: SchoolAI** (web). Se toman patrones, jerarquía, ritmo y sensación; **no** se copian pantallas, textos, ilustraciones ni marca. Las capturas no se versionan.

## Fuentes consultadas

| Fuente | Estado |
|---|---|
| Sitio público `schoolai.com` (landing) y `app.schoolai.com` (pantalla *Discover* abierta sin cuenta, *Sign Up*) | **Revisado** (navegador integrado, 2026-10-02) |
| Mobbin (SchoolAI Web: 2 pantallas *Home*, flujo *Onboarding* de 25 pantallas: landing, inicio de sesión, registro por correo) desde el Chrome del usuario | **Revisado** (2026-10-03). Resumen en la sección «Mobbin»; **no se guardan capturas** (material con derechos): solo notas propias. |

## Patrones observados (en mis palabras)

### Landing
- Lienzo **cálido** (blanco hueso, no blanco puro), tipografía de titular grande y apretada con **una frase subrayada a mano en amarillo suave** como acento.
- CTAs en **píldora**: primario azul intenso con una **flecha dentro de un círculo**; secundario blanco con círculo negro. Selector de audiencia ("para: Docentes ▾") como píldora con sombra suave.
- Insignias de confianza (cumplimiento) en una píldora horizontal; tarjetas de imagen con **radios muy generosos** (~28 px) y un estilo de ilustración duotono con grano.
- Testimonios en tarjetas redondeadas que alternan con retratos en círculo.

### App — *Discover* (el "Home" del producto)
- **Shell**: barra lateral izquierda con logotipo, botón para colapsarla, ítems *icono + etiqueta* (Descubrir, asistente, crear, insights de alumnos, asistentes, herramientas, organizar, aprender) y, al fondo, la cuenta ("Iniciar sesión o crear cuenta"). El ítem activo es una **píldora de fondo azul muy claro**. CTA primario flotante arriba a la derecha ("Crear un espacio").
- **Titular serif** ("¿Qué vas a descubrir hoy?") sobre un **campo de búsqueda/prompt enorme** con borde suave, sombra y **botón circular** de envío; alrededor, **teselas redondeadas flotantes** (decoración con movimiento lento).
- Debajo: **carruseles horizontales** con título + subtítulo, enlace "Ver todo (n)" y flechas; tarjetas blancas con área de ilustración arriba, título, descripción corta y pie con autor y contador.
- Mezcla tipográfica: **serif para titulares emocionales**, sans neutra para interfaz.

### Registro (*Create your free account*)
- **Pantalla dividida**: columna izquierda con el formulario y columna derecha con un **panel blanco redondeado que muestra una vista previa animada del producto** (una conversación que se va escribiendo), no un fondo decorativo.
- Izquierda: etiqueta verde pequeña de propuesta de valor, titular serif, subtítulo gris, **botones de SSO** apilados de ancho completo con contorno (Google, Microsoft; después Clever/ClassLink; después correo), separador "o", **lista de beneficios con palomitas** y letra legal discreta.

## Mobbin: SchoolAI Web (revisión del 2026-10-03)

Solo observaciones propias; las capturas no se versionan.

### Home autenticado (*Discover*, 1512×945)
- **Riel izquierdo sin borde ni tarjeta**: mismo lienzo gris-blanco que el contenido. Logotipo arriba con botón para colapsar; ocho ítems *icono de línea + etiqueta*; el activo es una **píldora de fondo lavanda muy claro** (radio ~10 px, sin sombra). Al fondo: insignia de nivel ("Level 1") y **avatar + nombre del usuario**.
- **Barra superior ligera**: un solo **buscador en píldora centrado** (con lupa, borde fino) y, a la derecha, el CTA primario en píldora azul con icono ("Crear un espacio"). No hay migas de pan ni título de página en la barra.
- **Hero en carrusel** a ancho completo: ilustración con degradado oscuro abajo, título blanco grande, **chips traslúcidos** (Popular · K-12 · Exploration), una línea de descripción y un botón blanco "Check it out"; flechas laterales y puntos de paginación.
- **Secciones con encabezado doble**: título en negrita + subtítulo gris; a la derecha el enlace azul **"Ver todo (10) →"**.
- **Tarjetas de ilustración** (5 por fila): blancas, radio ~14 px, sombra casi imperceptible, **ilustración duotono con grano** dentro del marco (con su propio radio), título en negrita con **etiqueta suave** en la misma línea ("Actualizado", "Antes: Sidekick"), descripción de 2 líneas y **pie con autor + contador** (icono de cohete).
- **"Essential tools"**: fila de **filtros en píldora** dentro de un contenedor gris redondeado (el activo = píldora oscura con palomita; los demás icono + texto), debajo **cuadrícula de 4 columnas** de tarjetas compactas: **icono de trazo en color de marca**, título y descripción; la última celda es **"Ver todo (19) ↓"** con borde.
- "Recently viewed": una sola tarjeta horizontal pequeña (miniatura + título + autor). Botón de ayuda flotante (círculo morado) abajo a la derecha.

### Landing
- Titular sans de peso alto y apretado, con **una frase subrayada a mano en amarillo**; selector segmentado de audiencia (*Teachers · Leaders · Students · Higher Ed*) en píldora blanca con sombra; CTA primario azul con **círculo + flecha** y secundario blanco con círculo negro; insignias de cumplimiento en una píldora; **mosaico de teselas ilustradas** de tamaños distintos con radios grandes (~28 px) alineadas como "masonry".

### Inicio de sesión / registro (pantalla dividida)
- Izquierda: **orbe con degradado** como logotipo, titular centrado en sans negrita, párrafo legal diminuto con enlaces, y **botones apilados de ancho completo con contorno y esquinas redondeadas** (Google, Microsoft, Clever, ClassLink, correo); al pie "¿Quieres iniciar sesión?".
- Derecha: **tarjeta blanca grande** (radio ~24 px, sombra suave) con **vista previa del producto que cambia con el titular**: con *"Know when they're struggling."* aparece una lista de alumnos (foto circular + barra segmentada que se llena en verde/amarillo/azul); con *"Personalized learning for each student."* aparece una conversación que se escribe. **Cada titular rota y su panel se anima** (la propuesta de valor se demuestra, no se describe).
- Registro por correo: se reemplaza la lista de proveedores por el formulario (Nombre, Correo, Contraseña) con **botón de regreso (flecha) en un cuadro con borde**, título "Sign up with Email" y **lista de reglas de contraseña** bajo el campo (≥ 10 caracteres, mayúsculas y minúsculas, número, carácter especial); botón "Sign up" de ancho completo que se habilita al cumplirlas. Los campos activos se resaltan con un **anillo azul doble**.
- Onboarding posterior: "Choose your look" (selector de avatar circular) y recorte de foto de perfil en modal con máscara circular.

### Qué refuerza o cambia respecto a las decisiones anteriores
1. El **riel no lleva borde** y comparte lienzo con la página: en SUSAN el riel pasa a `bg-sidebar` casi igual al lienzo, **sin `border-r`** (solo sombra mínima en móvil/cajón).
2. La barra superior queda mínima: **buscador/paleta en píldora al centro** + acción primaria a la derecha (en SUSAN: "Abrir sesión" para docentes, "Nuevo alumno" para administración).
3. La **fila "Ver todo (n) →"** y las **etiquetas suaves junto al título** (Nuevo / Pronto) se adoptan tal cual en `ModuloCard` y `FilaModulos`.
4. **Filtros en píldora con contenedor gris** para categorías de módulos (Asistencia · Análisis · Administración · Pronto).
5. Login: **titulares que rotan** (3) y **panel derecho que demuestra el producto** (lista de alumnos que pasan a *presente*, barra de riesgo que sube, reporte que se genera). Reglas de contraseña visibles en "Activar mi cuenta" y "Cambiar contraseña".
6. El **avatar + nombre al fondo del riel** reemplaza el menú de usuario arriba a la derecha en escritorio (en móvil sigue en la barra superior).

## Medidas reales de SchoolAI (Chrome del usuario, 2026-10-03; `app.schoolai.com/discover`, computed styles)

- **Tipografía**: UI en **General Sans** (400/500/600), titulares emocionales en **dante-mt-pro** (serif tipo Garamond, 500). Base **14 px**; `h1` 48 px / 500 / -0.36 px; `h2` 20 px / 600; título de tarjeta 14 px / 600; descripción 12 px.
- **Color**: lienzo gris neutro `lab(96.5)` ≈ `#F5F5F5`; texto `rgba(0,0,0,.8)`, secundario `rgba(0,0,0,.56)`; azul primario `rgb(3,92,226)`; ítem activo del riel `rgba(3,92,226,.06)`.
- **Riel**: ítems de 40 px, 14 px, radio 6 px, icono de línea; sin borde ni fondo propio.
- **Tarjeta**: blanca, padding 16, radio 12, sombra `0 4px 12px -2px rgba(20,0,0,.12)`; ilustración 3:2 arriba; pie con autor y contador.
- **Teselas del hero**: 58–73 px, radio 16, sombra `0 10px 20px -5px rgba(0,0,0,.25)`, giradas, con imágenes.
- **Buscador del hero**: 520 × 56, píldora, borde `rgba(0,0,0,.2)`, botón circular azul de 40 px.

## Dropbox Dash (imágenes del usuario, 2026-10-03) — la referencia que manda en shell, tarjetas y tipografía

- **Marco**: lienzo crema; contenido en un **panel blanco flotante** (margen ~8 px, esquinas ~16–18 px); riel de ~232 px sobre el lienzo, sin borde.
- **Riel**: marca (glifo + «Dash»), «Home», «Search» con atajo `⌘ K` a la derecha; secciones con título gris («Chats», «Stacks») con ítems de texto o con miniatura de 24 px; «View all»; al pie «Invite people», «Apps» (activo = rectángulo gris suave, radio ~8) y «Account» (avatar de iniciales).
- **Cabecera de página**: título ~26 px / 500; pestañas con subrayado negro de 2 px; fila de **píldoras** (activa = negra con texto blanco; inactiva = gris cálido con contador en círculo blanco); campo de búsqueda con lupa, borde y radio ~8; botón primario **negro** («Create Stack», radio 8).
- **Tarjetas «Stacks»** (≈ 196 × 200): borde fino, radio ~14, portada de ~70 px (foto, degradado arcoíris o pastel plano) con una **ficha blanca de 36 px** con el icono arriba a la izquierda; título 14–15 px / 500 en dos líneas; meta gris 12 px («12 items • 3 days ago»); pie con avatares apilados (círculos naranjas con iniciales blancas) o candado + «Private». Sin sombra.
- **Tarjetas «Apps»** (≈ 338 × 70, 3 columnas, separación 16): borde fino, radio ~14; logotipo de 32–40 px, título 14–15 px / 500 + subtítulo gris, botón circular gris claro (`+` o palomita).
- **Tipografía**: grotesca limpia en un solo tipo para todo (pesos 400/500/600). No es libre; se usa **Hanken Grotesk** como la alternativa más cercana.

## Lo que se adapta a SUSAN (decisiones)

1. **Shell con barra lateral** (colapsable; en móvil, barra inferior) y píldora activa tintada. Los ítems salen de un **registro de módulos** (hoy: Panel, Sesiones, Revisión, Reportes, Analítica; mañana: Calificaciones, Asistente IA, Mensajes, Calendario… con insignia *Pronto*).
2. **Home de "centro de mando"**: saludo en serif ("Buenos días, Patricia"), **campo grande** "¿Qué quieres hacer hoy?" que abre una paleta de acciones/búsqueda (alumnos, grupos, sesiones), y **carruseles/filas de tarjetas**: *Tus sesiones de hoy*, *Acciones rápidas*, *Herramientas* (módulos activos y "Pronto").
3. **Subrayado amarillo → subrayado dorado UNACH** (`#A8842C` suave) como firma visual en una palabra clave de cada pantalla.
4. **Login/registro**: izquierda formulario; derecha **vista previa animada de SUSAN** (una lista de alumnos donde los chips *presente/retardo* aparecen al "detectar" rostros). SUSAN **no tiene autorregistro**: "Crear cuenta" se resuelve como **Activar mi cuenta** (invitación del administrador, define contraseña) + tarjeta "¿No tienes cuenta? Pídela a coordinación". En lugar de SSO de Google/Microsoft, un botón "Continuar con correo institucional" (SSO institucional queda como módulo futuro).
5. **Ilustración**: estilo duotono con grano **sin imágenes pesadas**: SVG inline + textura de ruido pequeña (tile de ~128 px) en CSS; una paleta de 2 tonos por tarjeta (azul/dorado/verde).
6. **Radios y sombras**: tarjetas 24 px, píldoras para botones/chips/inputs de búsqueda, sombras muy suaves y grandes, borde 1 px casi invisible.
7. **Movimiento observado y reproducible barato**: teselas flotantes lentas (`transform` en bucle largo), carruseles con desplazamiento suave, vista previa de producto "escribiéndose". Nada requiere WebGL.

## Mobbin: check-in de asistentes (revisión del 2026-10-06) — referencia de «Pasar lista»

Pedido del usuario: la pantalla de pasar lista metía todo en una sola vista y se entendía poco. Solo observaciones propias; las capturas no se versionan.

- **Luma · *Checking in guests***: cámara a pantalla completa con un recuadro-guía al centro y nada más; al detectar a alguien sube una **hoja inferior** con su nombre, sus datos y **una sola acción primaria** («Check in»); después, aviso verde breve («Check In Successful») y la acción pasa a «Undo». Un botón circular abajo alterna entre la cámara y la lista de invitados.
- **Meetup · asistentes de un evento**: alternador segmentado **Lista | Escanear** arriba, contador de registrados y buscador de asistentes al pie; el aviso de estado es un toast sobre la lista.
- **Partiful · *Checking in a guest***: lista simple (avatar, nombre, estado) con **un botón «Check in» por fila**, que al marcarse se vuelve una palomita negra; las acciones masivas van en una hoja inferior.

### Qué se adopta en SUSAN
1. **Una cosa por vez**: la captura es solo cámara + cifra «N de M» + una acción primaria («Revisar y cerrar»); las cifras, las gráficas y quién falta van en una vista aparte, no debajo.
2. **Una acción primaria por pantalla** (tinta); las demás, secundarias con borde.
3. **Filas con un botón por fila** en lugar de tablas anchas; en el pase manual, un toque por alumno (tres botones Presente / Retardo / Ausente) en lugar de un selector.
4. **Avisos cortos** (etiqueta de estado, una línea de instrucción por paso) en lugar de párrafos.
5. **No se adopta** la hoja inferior por persona de Luma: SUSAN reconoce a un grupo entero en cada fotograma, así que no hay «una persona detectada» a quien confirmar.
