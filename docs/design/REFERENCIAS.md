# Referencias de diseño (F0)

**Referencia principal: SchoolAI** (web). Se toman patrones, jerarquía, ritmo y sensación; **no** se copian pantallas, textos, ilustraciones ni marca. Las capturas no se versionan.

## Fuentes consultadas

| Fuente | Estado |
|---|---|
| Sitio público `schoolai.com` (landing) y `app.schoolai.com` (pantalla *Discover* abierta sin cuenta, *Sign Up*) | **Revisado** (navegador integrado, 2026-10-02) |
| Mobbin (pantallas de Home, login y signup de SchoolAI) desde el Chrome del usuario | **Pendiente**: la extensión de Chrome no estaba conectada. Cuando lo esté, ampliar este documento (Home autenticado, onboarding, estados vacíos, login) sin cambiar las decisiones ya tomadas salvo que Mobbin las contradiga. |

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

## Lo que se adapta a SUSAN (decisiones)

1. **Shell con barra lateral** (colapsable; en móvil, barra inferior) y píldora activa tintada. Los ítems salen de un **registro de módulos** (hoy: Panel, Sesiones, Revisión, Reportes, Analítica; mañana: Calificaciones, Asistente IA, Mensajes, Calendario… con insignia *Pronto*).
2. **Home de "centro de mando"**: saludo en serif ("Buenos días, Patricia"), **campo grande** "¿Qué quieres hacer hoy?" que abre una paleta de acciones/búsqueda (alumnos, grupos, sesiones), y **carruseles/filas de tarjetas**: *Tus sesiones de hoy*, *Acciones rápidas*, *Herramientas* (módulos activos y "Pronto").
3. **Subrayado amarillo → subrayado dorado UNACH** (`#A8842C` suave) como firma visual en una palabra clave de cada pantalla.
4. **Login/registro**: izquierda formulario; derecha **vista previa animada de SUSAN** (una lista de alumnos donde los chips *presente/retardo* aparecen al "detectar" rostros). SUSAN **no tiene autorregistro**: "Crear cuenta" se resuelve como **Activar mi cuenta** (invitación del administrador, define contraseña) + tarjeta "¿No tienes cuenta? Pídela a coordinación". En lugar de SSO de Google/Microsoft, un botón "Continuar con correo institucional" (SSO institucional queda como módulo futuro).
5. **Ilustración**: estilo duotono con grano **sin imágenes pesadas**: SVG inline + textura de ruido pequeña (tile de ~128 px) en CSS; una paleta de 2 tonos por tarjeta (azul/dorado/verde).
6. **Radios y sombras**: tarjetas 24 px, píldoras para botones/chips/inputs de búsqueda, sombras muy suaves y grandes, borde 1 px casi invisible.
7. **Movimiento observado y reproducible barato**: teselas flotantes lentas (`transform` en bucle largo), carruseles con desplazamiento suave, vista previa de producto "escribiéndose". Nada requiere WebGL.
