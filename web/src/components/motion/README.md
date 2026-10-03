# components/motion — animaciones de SUSAN

Piezas pequeñas de movimiento, inspiradas en [ReactBits](https://reactbits.dev) (versión gratuita) pero reescritas con
**CSS + un IntersectionObserver / requestAnimationFrame**: sin `gsap`, sin `motion`, sin WebGL. Objetivo: animación
fluida con costo casi nulo (ver `docs/design/SISTEMA.md`, sección "Movimiento").

| Componente | Sustituye a (ReactBits) | Uso |
|---|---|---|
| `Reveal` | `AnimatedContent`, `FadeContent` | Aparición al entrar al viewport: `<Reveal direction="up" delay={0.1}>…</Reveal>`; `immediate` para contenido sobre el pliegue; `blur` opcional |
| `BlurText` | `BlurText` | Titulares: `<BlurText as="h1" text="Pasa lista en segundos" className="font-display" />` |
| `CountUp` | `CountUp` | Cifras de KPI: `<CountUp to={87.5} suffix=" %" />` (formato es-MX, valor final en el HTML del servidor) |
| `SpotlightCard` | `SpotlightCard` | Tarjeta con foco que sigue al ratón (variables CSS, sin estado) |
| `StaggerList` | `AnimatedList` | Lista en cascada: `<StaggerList step={0.06}>{items}</StaggerList>` |

Utilidades en `@/lib/motion`: `EASE`, `DURACION`, `salidaCubica`, `usePrefersReducedMotion`, `useEnVista`.

## Reglas

1. **Siempre** respeta "reducir movimiento": los componentes consultan `usePrefersReducedMotion()` y, además,
   `globals.css` recorta cualquier animación/transición CSS en ese caso.
2. Solo se anima `opacity` y `transform` (y un `blur` breve en titulares). Nunca `width/height/top/left`.
3. Una sola vez al entrar en vista (`once`), un observador por bloque, sin `will-change` permanente.
4. Colores solo con tokens semánticos (nada de hex): así funciona el tema oscuro.
5. Si una animación necesita física (resortes, `AnimatePresence`), se evalúa `motion` con `LazyMotion` en la fase
   que lo requiera (F4: `Stepper`) y se registra su tamaño en `docs/DESIGN_PROGRESS.md`.

Pruebas: `motion.test.jsx` (componentes) y `web/src/lib/motion/motion.test.jsx` (hooks/utilidades).
