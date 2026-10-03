# Registro de módulos de SUSAN

Fuente única: [`web/src/lib/modulos.js`](../../web/src/lib/modulos.js). De ahí salen:

| Dónde | Qué usa del registro |
|---|---|
| Home de cada rol (`HomeRol`) | Fila **Tus herramientas** (activos del rol) y fila **Próximamente** |
| `/modulos` (`CatalogoModulos`) | Catálogo con filtros en píldora (Todos · Asistencia · Análisis · Administración · Próximamente) |
| `/modulos/[id]` | Módulo `activo` → redirige a su `href`; `pronto` → página «Qué incluirá»; otro rol o id inexistente → 404 |
| Riel lateral | Sección **Próximamente** (primeros 4 del rol) con insignia *Pronto* |
| Paleta de comandos (⌘K / Ctrl+K) | Descripción de cada página (para buscar por texto) y los módulos próximos |

La **navegación principal** (barra lateral y barra inferior móvil) sigue en `components/layout/Sidebar/navItems.js`; una prueba (`modulos.test.js`) exige que
cada módulo activo exista en la navegación de sus roles y que cada ítem de navegación tenga su módulo (así no se desfasan).

## Cómo agregar un módulo

1. Agrega una entrada a `MODULOS` (campos: `id`, `titulo`, `descripcion`, `icono` de `lucide-react`, `categoria`, `roles`, `estado`, `tono`; los `pronto` llevan además `queIncluye` con 2–4 viñetas y **no** llevan `href`).
2. Para una función **nueva ya construida**: `estado: 'activo'` + `href`, y agrega el ítem a `NAV_POR_ROL` (`navItems.js`) de los roles que la ven. `npm test` avisa si falta alguno.
3. Para pasar un `pronto` a `activo`: cambia `estado`, quita `queIncluye` (opcional) y pon `href`. La página «Pronto» deja de usarse sola (redirige).
4. No hace falta tocar pantallas: Home, catálogo, paleta y riel se actualizan solos. El icono y el `tono` (azul · dorado · verde · violeta · rosa) definen la portada de la `TarjetaPortada`; `portada: 'degradado'` destaca una tarjeta con el degradado de la marca.

> Las entradas `pronto` actuales (Asistente SUSAN, Tutorías, Comunicados, Calificaciones, Horarios inteligentes, Acceso al campus, Notificaciones) son **hoja de ruta provisional**
> pensada para el diseño; sus textos y roles se ajustan libremente en `modulos.js`. Ninguna tiene backend todavía.

## Notas técnicas

- Las entradas contienen componentes de icono (funciones): **no** pueden pasarse como props de servidor a cliente. Los componentes cliente (`HomeRol`, `CatalogoModulos`, `AppShell`) importan el registro ellos mismos y reciben solo el `rol` (cadena); `ModuloProximamente` es de servidor y recibe la entrada completa.
- `filtrosDeModulos(modulos)` / `aplicarFiltro(modulos, filtro)` son funciones puras (probadas) para los filtros de `/modulos`.
