# Sistema de diseño de SUSAN (decisiones de F0, a implementar en F1–F8)

Fuente visual: [`REFERENCIAS.md`](./REFERENCIAS.md). Reglas de movimiento y presupuesto: [`../DESIGN_PLAN.md`](../DESIGN_PLAN.md) §3.

## Identidad

| Elemento | Decisión |
|---|---|
| Lienzo | Blanco hueso cálido `#F6F5F1`; tarjetas `#FFFFFF`; texto tinta `#14213D` (azul muy oscuro, no negro puro) |
| Primario (acción) | Azul UNACH vivo `#2F5AA8` (hover `#264A8C`) sobre blanco: contraste AA; texto sobre primario `#FFFFFF` |
| Marca profunda | Azul marino UNACH `#1F3A5F` (barras, fondos oscuros, logotipo) |
| Acento | Dorado UNACH `#A8842C` (subrayado de palabra clave, insignias, detalles) y su tinte `#F6EDD3` |
| Estados de asistencia | Se conservan los tokens `presente / retardo / ausente / pendiente / justificado` (texto + color; nunca solo color) |
| Tintes de ítem activo / tarjeta | Azul muy claro `#E8EEF9` (píldora activa) |
| Tipografía | Titulares: serif **Instrument Serif** (`next/font`, autoalojada, subset latino); interfaz: **Inter** (ya cargada). Escala: 14/16 cuerpo, 20/24 subtítulos, 36–56 titulares de Home/auth |
| Radios | Tarjeta 24 px · contenedor grande 32 px · botón/chip/búsqueda: píldora (`rounded-full`) · input de formulario 14 px |
| Sombras | `0 1px 2px rgba(20,33,61,.04), 0 12px 32px rgba(20,33,61,.06)`; borde `1px rgba(20,33,61,.08)` |
| Iconos | `lucide-react` (trazo 1.75), tamaño 18–20 px |
| Espaciado | Base 4 px; secciones 32–48 px; tarjetas con padding 20–24 px |

## Componentes firma

- **Botón primario con flecha circular** (píldora azul + círculo con `ArrowRight`), secundario blanco con círculo oscuro.
- **Campo de comando** (Home): input píldora grande con botón circular; abre la paleta (⌘K) con acciones y búsqueda.
- **Tarjeta de módulo/acción**: zona de ilustración (SVG duotono + grano) + título + descripción + pie; variante *Pronto* con insignia.
- **Fila con carrusel** (título, subtítulo, "Ver todo", flechas; scroll snap nativo, sin librería).
- **Subrayado dorado** (`<Resaltado>`): trazo SVG que se "dibuja" una vez.
- **Avatar de iniciales** para alumnos (sin fotos de rostros en pantallas de trabajo).

## Movimiento (ReactBits gratuito + CSS; **sin WebGL**)

| Dónde | Pieza | Costo |
|---|---|---|
| Titular de login/Home | `BlurText` (una vez, por palabras) | `motion` carga diferida |
| Entrada de tarjetas | `AnimatedContent`/`FadeContent` con `stagger` ≤ 60 ms | transform/opacity |
| Cifras de KPI | `CountUp` | rAF corto, solo en vista |
| Hover de tarjetas de módulo | `SpotlightCard` (gradiente que sigue al cursor, CSS vars) | barato |
| Lista de detecciones en sesión en vivo | `AnimatedList` (entra el chip al detectar) | transform/opacity |
| Alta de alumno | `Stepper` | ligero |
| Login: vista previa animada de SUSAN | CSS puro + timers cortos (sin librería) | mínimo |
| Teselas flotantes (decoración) | CSS `@keyframes` lentos (30–60 s) en 4–5 elementos | mínimo |

Reglas: todo bajo `prefers-reduced-motion`; una sola vez al entrar en vista; sin animar layout; verificar tamaño con `next build` (JS inicial de `/docente` ≤ +15 %). Aurora/Silk/Orb (WebGL) **descartados** por costo; reconsiderar solo si sobra presupuesto en login.

## Qué NO cambia

La API de props del ui-kit (`Button`, `Card`, `Field`, `Modal`, `Table`, …), la lógica, las RPC y las rutas. El rediseño es de la capa visual, con pruebas de comportamiento verdes.
