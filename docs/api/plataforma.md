# Dominio PLATAFORMA transversal

Contrato técnico de la base sobre la que se apoyan todos los demás dominios de SUSAN: identidad, funciones del esquema `app`,
seguridad a nivel de fila (RLS), privilegios, Storage, registro de errores, capa de datos web, infraestructura de Route Handlers,
ui-kit, navegación y autenticación de pantalla.

- Fuente funcional: `docs/spec/Avance1.txt` (RF-19, RF-20, Tabla 36, Tabla 37, Tabla 13, diccionario Tablas 14-32).
- Reglas transversales: `docs/ARCHITECTURE.md` (solo-RPC, `api_*`/`svc_*`/esquema `app`, `app.now()`, errores `P0001`+`HINT`, modo local).
- **Estado BASE**: el diseño visual es mínimo (Tailwind sobre tokens de `globals.css`); este documento describe contenido y comportamiento, no estética.
  Todo debe funcionar a 360 px de ancho (RNF-13).
- Convenciones de código: 4 espacios, comillas simples, punto y coma; dominio en español, infraestructura en inglés; sin emojis.

Mapa de lo que fija este documento:

| Bloque | Dónde |
|---|---|
| A. Identidad (`api_yo`, `api_ahora`, `api_parametros_publicos`) | §3 |
| B. Funciones `app.*`, RLS, GRANTs, Storage | §5 |
| C. Registro de errores | §3.4 |
| D. Capa de datos web, hooks, clientes HTTP, infraestructura de servidor | §4 |
| E. Inventario ui-kit | §2.6 |
| F. Navegación por rol, AppShell, Topbar | §2.5 |
| G. Autenticación de pantalla (P-01, `/recuperar`, `/cambiar-contrasena`, layout, proxy) | §2.1 a §2.4 |
| H. Convenciones de prueba | §6.0 y §6.4 |

---

## 1. Alcance y trazabilidad

### 1.1 Qué cubre y qué no

Cubre: (1) quién es el usuario y a dónde va según su rol; (2) qué filas puede leer cada rol en cada tabla (la base lo impone, no la UI);
(3) el reloj único, los parámetros y la bitácora como servicios compartidos; (4) cómo el navegador y los Route Handlers llaman a la base
(`callRpc`, `handle`); (5) el catálogo de errores; (6) los componentes de interfaz compartidos; (7) inicio de sesión, recuperación y cambio de contraseña.

No cubre (lo definen otros dominios): reglas de sesiones/asistencia/justificantes/reportes/series, catálogos y cuentas (alta de usuarios con `service_role`),
biometría, índice FAISS y jobs. Aquí solo se fijan los puntos de apoyo que esos dominios consumen.

### 1.2 Trazabilidad RF / RN / RNF -> artefacto

| Requisito | Qué exige a la plataforma | Artefacto que lo cubre |
|---|---|---|
| RF-20 | Autenticar con correo institucional vía Supabase Auth, sin contraseñas en el esquema; autorizar por rol; cuenta inactiva no inicia sesión; las cuentas las crea el administrador | Pantalla P-01 `/login` (§2.1); `iniciarSesion` en `lib/api/auth.js` (§4.1.5); `api_yo` (§3.1); `src/proxy.js` (§2.4); `requerirSesion` (§4.2.3); `app.rol()`, `app.exigir_rol()` (§5.1); GRANTs (§5.4). Sin autorregistro: no existe ruta ni RPC de alta pública |
| RF-19 | Limitar consultas del docente a sus grupos; bitácora de consultas con usuario, registro, fecha/hora e IP | Políticas RLS `docente_ve_sus_grupos` y homólogas (§5.3); `app.puede_ver_grupo/sesion/alumno/...` (§5.2); `app.bitacora()` y `app.ip_origen()` (§5.1); `ipDeOrigen` (§4.2.4); entrada de IP en `handle` (§4.2.1) |
| RF-01, RF-02, RF-22 | Catálogo académico, inscripciones, aulas/cámaras/horarios visibles según Tabla 36 | Políticas SELECT de `alumno, docente, materia, aula, grupo, horario_grupo, inscripcion, camara` (§5.3.2); lectura solo por RPC (§5.4) |
| RF-17, RF-21 | Reportes con alcance (admin todos, docente sus grupos) y alumno solo lo propio | Políticas de `asistencia`, `inscripcion`, `sesion_clase` y `v_resumen_asistencia` con `security_invoker` (§5.3) |
| RF-11, RF-12, RF-18 | Correcciones y justificantes con alcance por grupo; documentos solo por URL firmada | Políticas de `asistencia`, `justificante`, `captura`, `deteccion` (§5.3); política de Storage del alumno (§5.5); `storage.js` (§4.2.6) |
| RF-15 | Verificar consentimiento vigente | `app.tiene_consentimiento_vigente()` y `app.hoy()` (§5.1) |
| RN-01 | Asistencia solo de inscritos activos | Políticas de `inscripcion` (el alumno ve solo las suyas); el trigger `trg_asistencia_rn01` es de db-schema |
| RN-03 | Presente `[0,10)` / retardo `[10,20]` desde el inicio de la sesión | `app.instante_clase()` y `app.now()` (§5.1); parámetros `limite_presente_min`, `tolerancia_min` vía `app.param_num()` / `api_parametros_publicos` |
| RN-08 | Plazo de 48 h desde `hora_fin`; bitácora; cuenta de servicio rol técnico | `app.now()`, `app.param_num('horas_limite_correccion')`, `app.bitacora()` con respaldo a `app.id_usuario_servicio()` (§5.1) |
| RN-10, RN-11 | Parámetros `retardos_por_ausencia`, `porcentaje_max_ausencias` | `app.param_num()`; `api_parametros_publicos` para que la UI no codifique "3" ni "20 %" |
| RN-13 | Vigencia del consentimiento con fecha actual | `app.hoy()` (la validación del trigger `trg_plantilla_rn13` debe usarla, §7 solicitudes) |
| RNF-02 | Parámetros calibrables, cambios en bitácora | `app.param/param_num` (lectura); `api_parametros_publicos` (§3.3). La escritura y su bitácora son del dominio de catálogos/parámetros |
| RNF-03 | 0 vectores/imágenes en la base | Los clientes (`recognition.js`) descartan cualquier campo `vector`/`embedding`; `GRANT` y RLS no exponen más que rutas `objeto_*` a admin/técnico |
| RNF-04 | Objetos solo por URL firmada <= 300 s; 0 públicos | Bucket `public = false`, sin políticas SELECT; `storage.js#urlFirmada` con tope `min(vigencia_url_firmada_seg, 300)` (§4.2.6, §5.5) |
| RNF-06 | Sin reconocimiento sin consentimiento vigente | `app.tiene_consentimiento_vigente()` (§5.1) |
| RNF-07 | Disponibilidad; el pase manual no depende del reconocimiento | `GET /api/salud` (§4.1); `recognition.js` aísla fallas del servicio con errores propios (§4.2.5) |
| RNF-08 | Bitácora de solo inserción | `app.bitacora()` es la única vía de INSERT (sin INSERT para `authenticated`/`service_role`, §5.4); lectura solo admin (§5.3) |
| RNF-10 | Integridad | Mapeo de errores 23xxx en `fromPostgrestError` (§3.4) |
| RNF-11 | Resolver un caso en <= 3 interacciones | `DataState`, `Toast`, `ConfirmDialog` (§2.6) evitan pantallas intermedias |
| RNF-13 | Funcional desde 360 px, 2 últimas versiones de Chrome/Edge/Firefox/Safari | Reglas responsivas de `AppShell`, `Table`, `Modal` (§2.6); `CameraCapture` con `playsInline` (iOS Safari); cabecera `Permissions-Policy: camera=(self)` (§7) |

### 1.3 Trazabilidad con la pantalla P-01 (Tabla 37)

| Marcador | Elemento | Componente | RF |
|---|---|---|---|
| 1 | Barra de marca: nombre del sistema; sin opción de registro | `AuthCard` -> `BrandMark` | RF-20 |
| 2 | Correo institucional | `LoginForm` -> `Input type="email"` | RF-20 |
| 3 | Contraseña con mostrar/ocultar y "¿Olvidaste tu contraseña?" | `PasswordInput`; enlace a `/recuperar` | RF-20 |
| 4 | Botón "Iniciar sesión": autentica y abre el portal del rol | `LoginForm`; `iniciarSesion` + `api_yo` + redirección a `me.home` | RF-20, RF-19 |
| 5 | Aviso de alta de cuentas (no hay autorregistro) | `AvisoAltaCuentas` | RF-20 |
| 6 | Aviso de privacidad (el dato facial exige consentimiento vigente) | `AvisoPrivacidad` | RF-19 |

---

## 2. Pantallas y componentes

Rutas de este dominio (todas fuera del área autenticada, salvo el layout):

| Ruta | Archivo | Grupo | Acceso |
|---|---|---|---|
| `/login` (P-01) | `web/src/app/(public)/login/page.jsx` | `(public)` | Público; si ya hay sesión activa redirige a `me.home` |
| `/recuperar` | `web/src/app/(public)/recuperar/page.jsx` | `(public)` | Público |
| `/cambiar-contrasena` | `web/src/app/(public)/cambiar-contrasena/page.jsx` | `(public)` | Requiere sesión de Supabase Auth (normal o de recuperación); la comprobación es del lado del cliente, ver §2.3 |
| layout autenticado | `web/src/app/(app)/layout.jsx` | `(app)` | Cualquier rol activo |
| `web/src/app/(public)/layout.jsx` | contenedor centrado sin navegación | `(public)` | Público |

Las páginas son delgadas: leen `searchParams` (asíncrono en Next 16), llaman a una función del servidor y componen componentes.

### 2.1 P-01 Inicio de sesión (`/login`)

- **Roles**: sin sesión (público). Con sesión activa -> `redirect(rutaSegura(next) ?? me.home)`.
- **Objetivo**: que docentes, alumnos, administrador y técnico ingresen con su cuenta institucional (RF-20) y lleguen al portal de su rol.
- **Archivo página** (servidor):

```jsx
export default async function LoginPage({ searchParams }) {
    const { next, error, msg } = await searchParams;
    const sesion = await obtenerSesion();               // @/lib/server/auth, estado: 'ok'|'sin_sesion'|'inactiva'|'sin_cuenta'
    if (sesion.estado === 'ok') redirect(rutaSegura(next, sesion.me.home));
    return <AuthCard title="Iniciar sesión"><LoginForm next={rutaSegura(next)} mensaje={error ?? msg ?? (sesion.estado === 'inactiva' ? 'cuenta_inactiva' : sesion.estado === 'sin_cuenta' ? 'sin_cuenta' : null)} /></AuthCard>;
}
```

- **Datos que carga**: ninguna RPC propia de la pantalla. En el servidor, `obtenerSesion()` usa `auth.getUser()` + `api_yo` (§3.1). En el cliente, tras autenticar, `iniciarSesion` llama a `api_yo` una vez.
- **Parámetros de URL** (`searchParams`): `next` (ruta interna a la que volver; se sanea con `rutaSegura`), `error` en `cuenta_inactiva | sin_cuenta | sesion_expirada`, `msg` en `contrasena_actualizada | sesion_cerrada`.
- **Acciones**:
  1. Enviar el formulario -> `iniciarSesion({ correo, contrasena })` (envoltorio de `auth.signInWithPassword` + `api_yo`, §4.1.5). Éxito -> `router.replace(next ?? me.home)` y `router.refresh()`.
  2. Enlace "¿Olvidaste tu contraseña?" -> `/recuperar`.
  3. Si `mensaje` es `cuenta_inactiva` o `sin_cuenta`, al montar se llama `cerrarSesion()` en silencio para descartar la sesión huérfana (evita bucles de redirección, §7).
- **Reglas de validación en cliente** (la autoridad es Supabase Auth): correo no vacío, recortado y en minúsculas, con `@`; contraseña no vacía. No se impone longitud mínima al iniciar sesión. No se restringe el dominio del correo (el dominio institucional exacto no está en la especificación).
- **Estados**:
  - *Inicial*: campos vacíos, botón habilitado, foco en el correo.
  - *Cargando*: botón `loading` con `Spinner`, campos `disabled`, sin doble envío.
  - *Error*: `Alert tone="danger"` sobre el formulario con el mensaje de la tabla siguiente; el foco se mueve al `Alert` (`role="alert"`).
  - *Vacío*: no aplica.
- **Textos** (exactos):

| Situación | Código `ApiError` / `mensaje` | Texto mostrado |
|---|---|---|
| Credenciales incorrectas (Auth no distingue "usuario inexistente" de "contraseña errónea": no se debe distinguir) | `CREDENCIALES_INVALIDAS` | Correo o contraseña incorrectos. |
| Cuenta con `activo = false` o usuario bloqueado en Auth | `CUENTA_INACTIVA` / `mensaje=cuenta_inactiva` | Tu cuenta está inactiva. Contacta al administrador. |
| Usuario de Auth sin fila en `usuario` | `CUENTA_NO_VINCULADA` / `mensaje=sin_cuenta` | Tu cuenta no está vinculada a un perfil. Contacta al administrador. |
| Límite de intentos de Auth | `DEMASIADOS_INTENTOS` | Demasiados intentos. Espera unos minutos e inténtalo de nuevo. |
| Sin red | `ERROR_DE_RED` | No se pudo conectar. Revisa tu conexión e inténtalo de nuevo. |
| `error=sesion_expirada` | (informativo, `Alert tone="info"`) | Tu sesión expiró. Inicia sesión de nuevo. |
| `msg=contrasena_actualizada` | (informativo, `tone="success"`) | Contraseña actualizada. Inicia sesión con la nueva. |
| `msg=sesion_cerrada` | (informativo, `tone="info"`) | Cerraste sesión. |

- **Avisos fijos** (marcadores 5 y 6):
  - `AvisoAltaCuentas`: "Las cuentas las crea el administrador. No hay registro propio; si aún no tienes cuenta, solicítala en Coordinación."
  - `AvisoPrivacidad`: "Aviso de privacidad. El rostro es un dato personal sensible: solo se usa para registrar tu asistencia si tienes un consentimiento firmado y vigente. Sin consentimiento, tu asistencia se registra con pase de lista manual." (Texto provisional: el aviso definitivo requiere revisión jurídica, spec 4.3.)
- **Seguridad**: la contraseña vive solo en el estado del componente mientras se escribe; nunca en `localStorage`, URL, logs ni estado global (contraste con SmartClass). `autocomplete="username"` y `autocomplete="current-password"`. El mensaje de error nunca revela si el correo existe.
- **Componentes** (carpeta `web/src/components/auth/`):

| Componente | Props | Responsabilidad |
|---|---|---|
| `AuthCard/` | `{ title: string, subtitle?: string, children: ReactNode, footer?: ReactNode }` | Contenedor de las pantallas públicas: `BrandMark variant="full"`, `<h1>` con `title`, tarjeta con `children`, `footer`. Ancho máx. 420 px, margen lateral 16 px |
| `LoginForm/` (`LoginForm.jsx`, `useLoginForm.js`) | `{ next?: string \| null, mensaje?: 'cuenta_inactiva' \| 'sin_cuenta' \| 'sesion_expirada' \| 'contrasena_actualizada' \| 'sesion_cerrada' \| null }` | Campos, validación, envío, mapeo de errores a textos, redirección. Incluye `AvisoAltaCuentas` y `AvisoPrivacidad` bajo el formulario |
| `PasswordInput/` | `{ id?: string, name?: string, value: string, onChange: (e) => void, autoComplete?: 'current-password' \| 'new-password', required?: boolean, invalid?: boolean, 'aria-describedby'?: string, disabled?: boolean }` | `Input` con botón "Mostrar"/"Ocultar" (`type="button"`, `aria-pressed`, `aria-label="Mostrar contraseña"`/`"Ocultar contraseña"`). Por defecto oculto |
| `AvisoAltaCuentas/` | `{}` | Texto fijo del marcador 5 |
| `AvisoPrivacidad/` | `{}` | Texto fijo del marcador 6 |

### 2.2 Recuperar contraseña (`/recuperar`)

- **Roles**: público. **Objetivo**: iniciar la recuperación por correo (marcador 3 de P-01).
- **Datos que carga**: ninguno.
- **Acción**: `solicitarRecuperacion({ correo })` -> `auth.resetPasswordForEmail(correo, { redirectTo: SITE_URL + '/cambiar-contrasena' })`.
- **Comportamiento**: tras enviar, **siempre** se muestra el mismo mensaje de éxito, exista o no la cuenta (anti-enumeración): "Si el correo está registrado, recibirás un mensaje con instrucciones para restablecer tu contraseña. Revisa también tu carpeta de spam." Solo `DEMASIADOS_INTENTOS` y `ERROR_DE_RED` muestran error. Enlace "Volver a iniciar sesión".
- **Estados**: inicial (un campo), cargando (botón `loading`), enviado (reemplaza el formulario por el mensaje), error (`Alert danger`).
- **Componente**: `RecuperarForm/` con props `{}`. La URL `SITE_URL + '/cambiar-contrasena'` debe estar en la lista de redirecciones permitidas de Supabase Auth (§7).

### 2.3 Cambiar contraseña (`/cambiar-contrasena`)

- **Roles**: cualquier usuario con sesión de Supabase Auth: (a) venido del correo de recuperación; (b) autenticado que elige "Cambiar contraseña" en el menú del usuario.
- **Objetivo**: fijar una contraseña nueva.
- **Por qué es cliente**: con el flujo PKCE de `@supabase/ssr`, el enlace del correo llega como `/cambiar-contrasena?code=...` y es el cliente de navegador quien intercambia el código al inicializarse (`getSession()` / `onAuthStateChange`). `exchangeCodeForSession` no forma parte de la superficie permitida de `@/lib/backend`; no se llama directamente. Por eso `src/proxy.js` y la página **no** exigen sesión en esta ruta.
- **Datos que carga**: ninguna RPC. `sesionActual()` y `suscribirCambioAuth()` de `lib/api/auth.js`.
- **Flujo del componente `CambiarContrasenaForm`**:
  1. Al montar: `sesionActual()`; además `suscribirCambioAuth(cb)` para el evento `PASSWORD_RECOVERY` / `SIGNED_IN`. Espera hasta 3 s a que aparezca una sesión (estado *verificando*, `Spinner`).
  2. Con sesión: formulario (nueva contraseña, confirmación) con `PasswordInput autoComplete="new-password"`.
  3. Sin sesión tras 3 s: `Alert danger` "El enlace no es válido o ya expiró. Solicita uno nuevo." con enlace a `/recuperar`.
  4. Envío: `actualizarContrasena({ contrasena })` -> `auth.updateUser({ password })`.
  5. Éxito: `Toast success` "Contraseña actualizada" y `router.replace('/')` (la raíz redirige a `/login`, que reenvía a `me.home` si la sesión es válida).
- **Reglas de contraseña** (validación local, espejo de la política de Auth): mínimo 10 caracteres, al menos una letra y un dígito; confirmación idéntica. Mensajes: "La contraseña debe tener al menos 10 caracteres.", "Debe incluir al menos una letra y un número.", "Las contraseñas no coinciden.".
- **Errores de Auth**: `CONTRASENA_DEBIL` -> "La contraseña no cumple los requisitos de seguridad."; `CONTRASENA_IGUAL` -> "La nueva contraseña debe ser distinta de la actual."; `NO_AUTENTICADO` -> como el punto 3.
- **Estados**: verificando, sin sesión (error), formulario, cargando, error de envío.
- **Componente**: `CambiarContrasenaForm/` con props `{}`.

### 2.4 Layout autenticado `(app)/layout.jsx`, guardas de ruta y `proxy.js`

**`web/src/app/(app)/layout.jsx`** (servidor, asíncrono):

```jsx
export default async function AppLayout({ children }) {
    const me = await requerirSesion();                 // redirige a /login si no hay sesión, cuenta inactiva o sin perfil
    const reloj = await ahora({}, { backend: await getServerBackend() }).catch(() => null);
    return (
        <MeProvider me={me}>
            <ToastProvider>
                <AppShell me={me} relojSimulado={reloj?.reloj_simulado === true}>{children}</AppShell>
            </ToastProvider>
        </MeProvider>
    );
}
```

- **Datos que carga**: `api_yo` (dentro de `requerirSesion`) y `api_ahora` (solo para avisar de reloj simulado). Cualquier otro dato lo carga cada página.
- **Estados**: si falla `api_ahora` se ignora (no bloquea). Si `api_yo` falla por red, `error.jsx` de la ruta muestra `ErrorState` con "Reintentar".
- **Guardas por área (UX, no seguridad)**: los layouts no se vuelven a ejecutar al navegar entre páginas hermanas (render parcial), por lo que cada área añade su propio `layout.jsx` de una línea (`await requerirSesion(ROLES_POR_AREA['/docente'])`), propiedad del dueño de esa área (solicitud en §7). La autoridad real son RLS y las RPC.

| Área | Roles permitidos (`ROLES_POR_AREA`, en `lib/api/rutas.js`) |
|---|---|
| `/docente` | `docente` |
| `/alumno` | `alumno` |
| `/admin` | `administrador` |
| `/tecnico` | `tecnico`, `administrador` (consulta de parámetros y cámaras, Tabla 36) |
| `/reportes` | `administrador`, `docente` |
| `/analitica` | `administrador`, `docente` |

  Rol no permitido en un área -> `redirect(me.home)`.

**`web/src/proxy.js`** (Next 16: se llama `proxy`, función `proxy` exportada, runtime Node por defecto, `cookies()` asíncrono). Propiedad: adapters; el comportamiento exigido es:

```js
import { NextResponse } from 'next/server';
import { actualizarSesion } from '@/lib/backend/proxy';   // implementado por adapters; mismo contrato en modo real y local

export async function proxy(request) {
    const { response, user } = await actualizarSesion(request);   // refresca tokens y escribe cookies en `response`
    const { pathname, search } = request.nextUrl;
    if (!user && !esRutaPublica(pathname) && !pathname.startsWith('/api/')) {
        const destino = new URL('/login', request.url);
        destino.searchParams.set('next', pathname + search);
        const redireccion = NextResponse.redirect(destino);
        for (const c of response.cookies.getAll()) redireccion.cookies.set(c);   // conserva cookies refrescadas
        return redireccion;
    }
    return response;
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|brand/|favicon\\.ico|api/jobs|api/_local|api/salud|.*\\.(?:png|jpg|jpeg|svg|webp|ico|css|js|map|txt)$).*)'],
};
```

- `esRutaPublica(p)`: `p === '/'` o `p` es `/login`, `/recuperar` o `/cambiar-contrasena` (o empieza con ellas + `/`).
- Contrato `actualizarSesion(request) -> Promise<{ response: NextResponse, user: { id: string } | null }>`: modo real = `createServerClient` con `getAll/setAll` sobre request/response y `auth.getUser()`; modo local = verifica la cookie HMAC sin consultar la base. Siempre devuelve `response` con `NextResponse.next({ request })`.
- El proxy **no** valida roles ni consulta la base (redirección optimista). Las rutas `/api/*` pasan por el proxy solo para refrescar tokens; nunca se redirigen (devuelven 401 JSON desde `handle`).
- `/api/jobs/*` queda fuera del matcher (usan `CRON_SECRET`, no cookies).

### 2.5 Navegación por rol, AppShell, Topbar

Definición única en `web/src/components/layout/Sidebar/nav.config.js` (`NAV_POR_ROL`). Icono = nombre de `lucide-react`.

| Rol | Etiqueta | Ruta | Icono lucide |
|---|---|---|---|
| administrador | Inicio | `/admin` | `LayoutDashboard` |
| administrador | Grupos | `/admin/grupos` | `Users` |
| administrador | Alumnos | `/admin/alumnos` | `GraduationCap` |
| administrador | Docentes | `/admin/docentes` | `Presentation` |
| administrador | Materias | `/admin/materias` | `BookOpen` |
| administrador | Aulas | `/admin/aulas` | `Building2` |
| administrador | Usuarios | `/admin/usuarios` | `UserCog` |
| administrador | Bitácora | `/admin/bitacora` | `ScrollText` |
| administrador | Reportes | `/reportes` | `FileBarChart` |
| administrador | Analítica | `/analitica` | `ChartLine` |
| administrador | Sistema (solo consulta) | `/tecnico` | `Wrench` |
| docente | Panel | `/docente` | `LayoutDashboard` |
| docente | Revisión | `/docente/revision` | `ClipboardCheck` |
| docente | Reportes | `/reportes` | `FileBarChart` |
| docente | Analítica | `/analitica` | `ChartLine` |
| alumno | Mi asistencia | `/alumno` | `UserCheck` |
| alumno | Mi registro facial | `/alumno/registro` | `ScanFace` (grupo «Mi cuenta») |
| tecnico | Consola técnica | `/tecnico` | `Wrench` |

- El ítem activo es el de **coincidencia más larga** entre `pathname` y `href` (`pathname === href || pathname.startsWith(href + '/')`); así `/docente/revision` no activa también `/docente`.
- Las sesiones (`/docente/sesiones/[id]`) no tienen ítem propio: se llega desde el panel.

**`AppShell`** (cliente): estructura `Topbar` fija arriba (56 px), `Sidebar` y `<main id="contenido">`. Enlace "Saltar al contenido" como primer elemento enfocable. En >= 1024 px el `Sidebar` es una columna fija de 240 px; por debajo es un cajón que se abre con el botón de menú del `Topbar`, se cierra con Esc, al elegir un ítem o al pulsar fuera. `main` con relleno de 16 px (24 px en >= 768 px) y ancho máximo 72rem. Escucha el evento `susan:sesion-expirada` (§4.1.2) y navega a `/login?error=sesion_expirada&next=<ruta actual>`. Si `relojSimulado` es true muestra arriba un `Alert tone="warning"` "Reloj simulado activo (solo desarrollo)".

**`Topbar`** (cliente): botón de menú (solo < 1024 px), `BrandMark variant="compact"`, y a la derecha el menú del usuario: nombre (`me.nombre`, truncado) y rol con etiqueta, opciones "Cambiar contraseña" (`/cambiar-contrasena`) y "Salir". "Salir" -> `cerrarSesion()` -> `router.replace('/login?msg=sesion_cerrada')` + `router.refresh()`.

### 2.6 Inventario ui-kit

Convención común: cada componente vive en `web/src/components/ui/<Nombre>/` o `layout/<Nombre>/` con `index.js` (`export { default } from './<Nombre>.jsx';`). Todos aceptan `className` (se concatena al final con `clsx`) y reenvían el resto de props al elemento raíz salvo que se indique. Todos usan **solo** tokens semánticos (`bg-surface`, `text-muted`, `border-border`, `bg-primary`, `text-presente`...). Zonas táctiles >= 44 px de alto en botones y controles. `ref` se recibe como prop (React 19). Todo texto visible en español. Los componentes con estado son `'use client'`.

#### 2.6.1 Acciones y contenedores

| Componente | Props (tipo, default) | Comportamiento |
|---|---|---|
| `Button` | `variant: 'primary' \| 'secondary' \| 'danger' \| 'ghost'` ('primary'), `size: 'md' \| 'sm'` ('md'), `loading: boolean` (false), `disabled`, `type: 'button' \| 'submit' \| 'reset'` ('button'), `icon?: ReactNode`, `fullWidth: boolean` (false), `href?: string`, `children`, `onClick` | Con `href` renderiza `next/link`. `loading` deshabilita, pone `aria-busy="true"` y muestra `Spinner size="sm"` antes del texto (el ancho no cambia). Mínimo 44 px de alto en `md` |
| `Card` | `title?: string`, `actions?: ReactNode`, `as: 'section' \| 'div' \| 'article'` ('section'), `padded: boolean` (true), `children` | Si hay `title` renderiza `<h2>` y asocia `aria-labelledby` |
| `StatCard` | `label: string`, `value: string \| number`, `hint?: string`, `href?: string`, `tone: 'neutral' \| 'success' \| 'warning' \| 'danger'` ('neutral'), `loading: boolean` | Muestra `value` grande y `label`. Con `href` toda la tarjeta es un enlace (los contadores de P-02 llevan a P-05). `loading` muestra un guion "-" y `aria-busy` |
| `PageHeader` (layout) | `title: string`, `subtitle?: string`, `actions?: ReactNode`, `backHref?: string`, `backLabel?: string` ('Volver') | `<h1>`; `actions` pasan debajo del título en < 640 px |

#### 2.6.2 Estado y etiquetas

**`StatusChip`**: props `{ kind, value, size = 'md', title? }`. Siempre texto + color (nunca solo color). Si `value` no está en la tabla muestra el valor tal cual con tokens neutros (no lanza error). Exporta de `statusChip.utils.js`: `etiqueta(kind, value)`, `tokens(kind, value)`.

| `kind` | `value` -> etiqueta (clases) |
|---|---|
| `asistencia` (`estado_asistencia`) | `presente` -> Presente (`text-presente bg-presente-bg`); `retardo` -> Retardo (`text-retardo bg-retardo-bg`); `ausente` -> Ausente (`text-ausente bg-ausente-bg`); `pendiente` -> Pendiente (`text-pendiente bg-pendiente-bg`); `justificado` -> Justificado (`text-justificado bg-justificado-bg`); `sin_lecturas` (solo etiqueta de pantalla, no es del dominio) -> Sin lecturas (`text-muted bg-surface-muted`) |
| `justificante` (`estatus_justificante`) | `pendiente` -> Pendiente (pendiente); `aprobado` -> Aprobado (presente); `rechazado` -> Rechazado (ausente) |
| `sesion` (`estatus_sesion`) | `programada` -> Programada (pendiente); `abierta` -> Abierta (`text-justificado bg-justificado-bg`); `cerrada` -> Cerrada (`text-muted bg-surface-muted`); `suspendida` -> Suspendida (retardo) |
| `camara` (`estatus_camara`) | `activa` -> Activa (presente); `inactiva` -> Inactiva (`text-muted bg-surface-muted`); `mantenimiento` -> Mantenimiento (retardo) |
| `consentimiento` (`estatus_consentimiento`) | `vigente` -> Vigente (presente); `revocado` -> Revocado (ausente); `vencido` -> Vencido (retardo) |
| `modo` (`modo_registro_sesion`) | `automatico` -> Automático (`text-justificado bg-justificado-bg`); `manual` -> Manual (pendiente) |
| `origen` (`origen_asistencia`) | `automatico` -> Automático (`text-justificado bg-justificado-bg`); `manual` -> Manual (pendiente); `correccion` -> Corrección (retardo) |
| `inscripcion` (`estatus_inscripcion`) | `activa` -> Activa (presente); `baja` -> Baja (`text-muted bg-surface-muted`) |
| `persona` (`estatus_alumno`/`estatus_docente`) | `activo` -> Activo (presente); `baja_temporal` -> Baja temporal (retardo); `baja_definitiva` -> Baja definitiva (ausente); `egresado` -> Egresado (justificado); `licencia` -> Licencia (retardo); `baja` -> Baja (ausente) |

Notas: "pendiente", "presente", etc. = par de clases `text-<x> bg-<x>-bg` del `globals.css`. `Badge` es la versión genérica sin dominio.

| Componente | Props | Comportamiento |
|---|---|---|
| `Badge` | `tone: 'neutral' \| 'info' \| 'success' \| 'warning' \| 'danger'` ('neutral'), `children` | Neutral `bg-surface-muted text-muted`; info `text-justificado bg-justificado-bg`; success `text-presente bg-presente-bg`; warning `text-retardo bg-retardo-bg`; danger `text-ausente bg-ausente-bg` |
| `Spinner` | `size: 'sm' \| 'md' \| 'lg'` ('md'), `label: string` ('Cargando') | `role="status"`; el `label` va en un `<span class="sr-only">` |
| `Alert` | `tone: 'info' \| 'success' \| 'warning' \| 'danger'` ('info'), `title?: string`, `onClose?: () => void`, `children` | `role="alert"` para `danger` y `warning`, `role="status"` para el resto. Con `onClose` muestra botón "Cerrar" |
| `EmptyState` | `title: string`, `description?: string`, `action?: ReactNode`, `icon?: ReactNode` | Bloque centrado con texto; sin ilustraciones |
| `ErrorState` | `error?: ApiError \| Error \| string`, `title: string` ('No se pudo cargar'), `onRetry?: () => void`, `compact: boolean` | `role="alert"`. Muestra `error.message` (ya en español) y botón "Reintentar" si hay `onRetry`. Si `error.code === 'NO_AUTENTICADO'` muestra enlace "Iniciar sesión" y no el botón |
| `Toast` / `ToastProvider` | `ToastProvider`: `{ children }`. Hook `useToast()` -> `{ toast({ tone: 'success' \| 'info' \| 'warning' \| 'danger' = 'info', title?: string, message: string, durationMs = 5000 }) -> id, dismiss(id) }` | Región `aria-live="polite"` fija abajo (centro en móvil, derecha en escritorio). Máximo 3 visibles (los más antiguos se descartan). `danger` no se cierra solo hasta `durationMs * 2` |
| `DataState` | `loading: boolean`, `error: ApiError \| null`, `data: any`, `onRetry?: () => void`, `isEmpty?: (data) => boolean`, `empty?: ReactNode` (`<EmptyState title="Sin resultados" />`), `loadingFallback?: ReactNode` (`<Spinner />`), `children: (data) => ReactNode` | Orden de decisión: (1) `error` y sin `data` -> `ErrorState` con `onRetry`; (2) `loading` y `data` nulo -> `loadingFallback`; (3) `data` vacío -> `empty`; (4) `children(data)`. Si hay `data` y se está refrescando muestra `children(data)` (sin parpadeo). `isEmpty` por defecto: `Array.isArray(data) ? data.length === 0 : Array.isArray(data?.items) ? data.items.length === 0 : false`. Se usa con el resultado de `useApiQuery`: `<DataState {...q}>` |

#### 2.6.3 Formularios

| Componente | Props | Comportamiento |
|---|---|---|
| `Field` | `label: string`, `hint?: string`, `error?: string`, `required?: boolean`, `htmlFor?: string`, `children: ReactElement` (un solo control) | Genera `id` con `useId()` si no se da; clona el hijo con `id`, `aria-describedby` (hint + error), `aria-invalid={!!error}` y `required`. `error` se muestra en `text-danger` bajo el control con `role="alert"` |
| `Input` | `type: string` ('text'), `invalid?: boolean`, `endAdornment?: ReactNode`, resto de atributos de `<input>` | Alto >= 44 px, `font-size: 16px` (ya forzado en móvil por `globals.css`) |
| `Select` | `options?: { value: string \| number, label: string, disabled?: boolean }[]`, `placeholder?: string` (agrega primera opción vacía deshabilitada), `invalid?: boolean`, `children?` (alternativa a `options`), atributos de `<select>` | Select nativo |
| `Textarea` | `rows: number` (3), `maxLength?: number`, `showCount: boolean` (false), `invalid?: boolean` | Con `showCount` y `maxLength` muestra "n/maxLength" (`aria-live="polite"`) |
| `Checkbox` | `label: ReactNode` (o `children`), `checked`, `onChange`, `indeterminate: boolean` (false), `hint?: string`, `disabled` | Casilla nativa con texto asociado; área táctil completa |
| `FileInput` | `value: File \| null`, `onSelect: (file: File \| null) => void`, `accept?: string` (lista de MIME o extensiones), `maxBytes?: number`, `capture?: 'user' \| 'environment'`, `label: string` ('Seleccionar archivo'), `error?: string`, `disabled` | Valida tipo y tamaño al elegir. Inválido: muestra el motivo ("El archivo supera 5 MB." / "Tipo de archivo no permitido.") y llama `onSelect(null)`. Válido: `onSelect(file)`, muestra nombre y tamaño y un botón "Quitar" |

#### 2.6.4 Superposiciones, tablas, navegación local

| Componente | Props | Comportamiento |
|---|---|---|
| `Modal` | `open: boolean`, `onClose: () => void`, `title: string`, `children`, `footer?: ReactNode`, `size: 'sm' \| 'md' \| 'lg'` ('md'), `closeOnOverlay: boolean` (true) | Usa `<dialog>` con `showModal()`: trampa de foco y Esc nativos; devuelve el foco al elemento que lo abrió. En móvil ocupa el ancho menos 16 px por lado y `max-height: 90dvh` con desplazamiento interno. Título en `<h2>` enlazado con `aria-labelledby` |
| `ConfirmDialog` | `open`, `title: string`, `message?: ReactNode`, `children?`, `confirmLabel: string` ('Confirmar'), `cancelLabel: string` ('Cancelar'), `variant: 'primary' \| 'danger'` ('primary'), `onConfirm: () => void \| Promise<void>`, `onCancel: () => void` | Sobre `Modal`. Si `onConfirm` devuelve una promesa, el botón queda en `loading` y el diálogo no se cierra hasta que se resuelva; si rechaza, permanece abierto (el llamador muestra el error). Foco inicial en "Cancelar" cuando `variant === 'danger'` |
| `Table` | `columns: { key: string, header: string, render?: (row) => ReactNode, align?: 'left' \| 'right' \| 'center', className?: string, primary?: boolean, hideBelow?: 'sm' \| 'md' }[]`, `rows: object[]`, `rowKey: string \| ((row) => string \| number)`, `caption?: string`, `emptyMessage: string` ('Sin resultados'), `onRowClick?: (row) => void`, `loading: boolean`, `sort?: { key: string, dir: 'asc' \| 'desc' }`, `onSort?: (key) => void`, `stackOnMobile: boolean` (true) | `<table>` semántica con `scope="col"`. Con `stackOnMobile`, por debajo de 640 px cada fila se pinta como tarjeta vertical "Encabezado: valor" (la columna `primary` va como título), sin desplazamiento horizontal. `hideBelow` oculta la columna bajo el breakpoint. Con `onRowClick` la fila es enfocable (`tabIndex=0`, Enter/Espacio). El orden lo hace el servidor (`onSort` solo notifica) |
| `Tabs` | `tabs: { id: string, label: string, count?: number, disabled?: boolean }[]`, `value: string`, `onChange: (id) => void`, `idPrefix: string` ('tab') | Solo la tira de pestañas (`role="tablist"`; cada una `role="tab"`, `id="<prefix>-<id>"`, `aria-controls="<prefix>-panel-<id>"`). Flechas izquierda/derecha, Inicio y Fin. Desplazamiento horizontal propio en móvil. El panel lo pinta quien la usa con `role="tabpanel" id="<prefix>-panel-<id>" aria-labelledby="<prefix>-<id>"` |
| `Pagination` | `total: number`, `limit: number`, `offset: number`, `onChange: ({ offset: number }) => void`, `limits?: number[]` (def. `[10, 25, 50]`), `onLimitChange?: (limit) => void` | Texto "Mostrando a-b de total", botones "Anterior"/"Siguiente" deshabilitados en los extremos y selector de tamaño opcional. `limit` se acota a [1, 200]. Si `total === 0` no se renderiza |

#### 2.6.5 CameraCapture

Archivo `web/src/components/ui/CameraCapture/` (`CameraCapture.jsx`, `useCameraCapture.js`, `cameraCapture.utils.js`). Cliente. Usado por P-06 (foto de registro) y P-03 (webcam del docente).

| Prop | Tipo / default | Descripción |
|---|---|---|
| `onCapture` | `(blob: Blob, meta: { width: number, height: number, capturedAt: string, deviceId: string \| null }) => void \| Promise<void>` | Recibe el JPEG. `capturedAt` ISO del reloj del navegador (informativo; la hora de negocio la fija el servidor) |
| `facingMode` | `'user' \| 'environment'` = `'user'` | Preferencia (`ideal`) al pedir la cámara |
| `mirrored` | `boolean` = `facingMode === 'user'` | Espeja **solo la vista previa** (`transform: scaleX(-1)`); el JPEG **nunca** se espeja |
| `intervalMs` | `number \| undefined` | Si se define: captura continua, llama `onCapture` cada `intervalMs` mientras `active`. Mínimo efectivo 1000. Si `onCapture` devuelve una promesa, el siguiente disparo espera a que termine (sin acumulación, RNF-01) |
| `active` | `boolean` = `true` | `false` libera la cámara (detiene las pistas) y pausa la captura continua |
| `ovalGuide` | `boolean` = `false` | Superpone un óvalo guía (SVG) y la leyenda "Centra el rostro en el óvalo" (P-06) |
| `showShutter` | `boolean` = `intervalMs == null` | Botón "Capturar foto" |
| `quality` | `number` = `0.9` | Calidad JPEG (0-1) |
| `maxWidth` / `maxHeight` | `number` = `1280` / `960` | Se reduce proporcionalmente al capturar si el video es mayor |
| `allowDeviceSelect` | `boolean` = `true` | Muestra un `Select` de cámaras si `enumerateDevices` devuelve más de una; cambiar de cámara reinicia el flujo |
| `deviceId` / `onDeviceChange` | `string \| undefined` / `(id: string) => void` | Cámara controlada desde fuera; si se omiten, el estado es interno |
| `onReady` | `() => void` | Se llama cuando el video ya reproduce |
| `onError` | `(e: { code: string, message: string }) => void` | Ver errores abajo |
| `ref` | `{ capture(): Promise<Blob>, restart(): void }` (vía `useImperativeHandle`) | Captura imperativa sin botón |

Comportamiento:
- Pide `navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal }, width: { ideal: 1280 }, height: { ideal: 720 } } , audio: false })` (o `deviceId: { exact }`). El `<video>` lleva `playsInline muted autoPlay` y `aria-label="Vista previa de la cámara"`.
- Captura: dibuja el fotograma en un `<canvas>` fuera de pantalla y usa `canvas.toBlob(cb, 'image/jpeg', quality)`.
- Libera todas las pistas al desmontar, con `active=false` o al cambiar de cámara.
- Errores (`code` -> texto en español, mostrado en un `Alert danger` dentro del componente con botón "Reintentar"):

| `code` | Causa | Texto |
|---|---|---|
| `PERMISO_DENEGADO` | `NotAllowedError`/`SecurityError` | Permiso de cámara denegado. Habilítalo en la configuración del navegador (icono de candado junto a la dirección) y pulsa Reintentar. |
| `SIN_CAMARA` | `NotFoundError`/`OverconstrainedError` sin alternativa | No se encontró ninguna cámara en este dispositivo. |
| `EN_USO` | `NotReadableError`/`AbortError` | La cámara está siendo usada por otra aplicación. |
| `NO_SOPORTADO` | no existe `navigator.mediaDevices.getUserMedia` | Este navegador no permite usar la cámara. |
| `INSEGURO` | `!window.isSecureContext` (no HTTPS ni localhost) | La cámara solo funciona en conexiones seguras (HTTPS). |
| `DESCONOCIDO` | cualquier otro | No se pudo iniciar la cámara. |

La verificación de calidad de la foto (un rostro, frontal, iluminada: P-06 marcador 4) **no** es de este componente: la hace el servidor al registrar la plantilla.

#### 2.6.6 Layout

| Componente | Props | Comportamiento |
|---|---|---|
| `BrandMark` | `variant: 'full' \| 'compact'` ('full') | Nombre «SUSAN»; en `full` añade el subtítulo "Registro de asistencia". Sin imágenes ni escudos: no hay logotipos de terceros en la interfaz |
| `AppShell` | `me: Me`, `relojSimulado?: boolean`, `children` | Ver §2.5 |
| `Sidebar` | `items: { href: string, label: string, icon: LucideIcon }[]`, `pathname: string`, `open: boolean`, `onClose: () => void` | `<nav aria-label="Principal">`; ítem activo con `aria-current="page"` |
| `Topbar` | `me: Me`, `onMenu: () => void` | Ver §2.5 |

`Me` = `{ id_usuario, auth_uid, correo, rol, activo, id_docente, id_alumno, nombre, home }` (forma de `api_yo`).


---

## 3. RPC

Convenciones que aplican a **todas** las RPC de todos los dominios (las fija este documento):

1. Nombre `api_<verbo_objeto>` (usuario autenticado) o `svc_<...>` (solo `service_role`). Parámetros `p_<nombre>` en `snake_case`; los opcionales llevan `DEFAULT`.
2. Esquema `public`; `SET search_path = public, app, pg_temp` en toda función `SECURITY DEFINER` (y por uniformidad en las `INVOKER`).
3. Las **lecturas** son `SECURITY INVOKER` y `STABLE` (la RLS del usuario aplica). Las **escrituras** son `SECURITY DEFINER` y `VOLATILE`, y empiezan con `PERFORM app.exigir_rol(...)` y la validación de pertenencia. Excepción documentada: `api_parametros_publicos` es `DEFINER` de solo lectura (§3.3).
4. Cualquier función que escriba en bitácora (incluidas lecturas que registran `consulta`) se declara `VOLATILE`, nunca `STABLE`/`IMMUTABLE`; `supabase-js` llama a las RPC con POST (transacción de lectura-escritura). El cliente nunca usa `get: true`.
5. `GRANT EXECUTE ... TO authenticated` (api) o `TO service_role` (svc) inmediatamente después de cada `CREATE FUNCTION`; ver §5.4.
6. Retorno `jsonb` (objeto) o `{ total, items }` para listas con `p_limit integer DEFAULT 50` (máx. 200) y `p_offset integer DEFAULT 0`. Claves `snake_case` iguales a las columnas. `fecha` = `YYYY-MM-DD`, `hora_*` = `HH:MM:SS`, instantes ISO 8601 con offset (la zona del offset es la de la sesión de base de datos; el cliente siempre formatea con `TIMEZONE = 'America/Mexico_City'`).
7. Errores: `RAISE EXCEPTION '<mensaje en español>' USING ERRCODE = 'P0001', HINT = '<CODIGO>'`. Se recomienda `PERFORM app.fallar('<CODIGO>', '<mensaje>')`.
8. Todo tiempo de negocio sale de `app.now()`.

### 3.1 `api_yo()`

```sql
CREATE FUNCTION public.api_yo() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY INVOKER
    SET search_path = public, app, pg_temp;
```

| Aspecto | Contrato |
|---|---|
| Quién la llama | Cualquier sesión `authenticated` (incluso con cuenta inactiva: devuelve `activo = false`). Se invoca desde `(app)/layout.jsx`, `iniciarSesion`, `handle()` y `useMe` |
| Seguridad | `INVOKER`. Lee `usuario` por la política `usuario_ve_su_cuenta` (`auth_uid = auth.uid()`, sin exigir `activo`), y `docente`/`alumno` por sus políticas (que sí exigen cuenta activa; por eso una cuenta inactiva obtiene `nombre = correo`) |
| Lee / escribe | Lee `usuario`, `docente`, `alumno`. No escribe. No registra bitácora |
| Reglas | RF-20 (identidad por `auth_uid`); Tabla 36 (rol). `home` = ruta inicial del rol |

Lógica:
1. `auth.uid()` nulo -> `NO_AUTENTICADO`.
2. Busca la fila de `usuario` con `auth_uid = auth.uid()`; si no hay -> `CUENTA_NO_VINCULADA`.
3. `nombre` = nombre completo (`nombres || ' ' || apellido_paterno || COALESCE(' ' || apellido_materno, '')`) del docente o alumno vinculado; si no hay vínculo (administrador, técnico) o la lectura está oculta por RLS, `nombre = correo`.
4. `home` por rol: `administrador -> '/admin'`, `docente -> '/docente'`, `alumno -> '/alumno'`, `tecnico -> '/tecnico'`; si `activo = false`, `home = null`.

Retorno (docente activo):

```json
{
  "id_usuario": 7,
  "auth_uid": "0b9f5c1e-6c53-4a0e-9d3a-2f6e1c7a9b10",
  "correo": "maria.lopez@unach.mx",
  "rol": "docente",
  "activo": true,
  "id_docente": 12,
  "id_alumno": null,
  "nombre": "María Fernanda López Ruiz",
  "home": "/docente"
}
```

Retorno (alumno inactivo): `{"id_usuario": 31, "auth_uid": "...", "correo": "e20230045@unach.mx", "rol": "alumno", "activo": false, "id_docente": null, "id_alumno": 118, "nombre": "e20230045@unach.mx", "home": null}`.

| Código | Mensaje | Cuándo |
|---|---|---|
| `NO_AUTENTICADO` | Debes iniciar sesión. | `auth.uid()` es nulo (JWT sin `sub`) |
| `CUENTA_NO_VINCULADA` | Tu cuenta no está vinculada a un perfil. Contacta al administrador. | Existe el usuario de Auth pero no hay fila en `usuario` |

(Un llamado con el rol `anon` falla antes, con `42501 permission denied for function api_yo`, porque `anon` no tiene `EXECUTE`.)

### 3.2 `api_ahora()`

```sql
CREATE FUNCTION public.api_ahora() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY INVOKER
    SET search_path = public, app, pg_temp;
```

| Aspecto | Contrato |
|---|---|
| Quién la llama | Cualquier rol activo (`PERFORM app.exigir_rol(NULL)`). El layout la usa para avisar de reloj simulado; P-03/P-04 para sincronizar el minuto de sesión con el servidor |
| Seguridad | `INVOKER`; no lee tablas |
| Reglas | Reloj único (`app.now()`); los demás dominios nunca deben calcular la hora de negocio con el reloj del navegador |

Retorno:

```json
{
  "ahora": "2026-09-14T13:12:00+00:00",
  "zona": "America/Mexico_City",
  "fecha": "2026-09-14",
  "hora": "07:12:00",
  "dia_semana": 1,
  "reloj_simulado": false
}
```

`fecha`, `hora` y `dia_semana` (1 = lunes ... 7 = domingo, ISO; la spec usa 1-6 para clases) están calculados en `app.tz()`. `ahora` es un instante con offset. `reloj_simulado` es `app.reloj_simulado()`.

Errores: `NO_AUTENTICADO`, `CUENTA_INACTIVA`, `CUENTA_NO_VINCULADA` (de `app.exigir_rol`).

### 3.3 `api_parametros_publicos()`

```sql
CREATE FUNCTION public.api_parametros_publicos() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path = public, app, pg_temp;
```

| Aspecto | Contrato |
|---|---|
| Quién la llama | Cualquier rol activo. La UI la usa para mostrar umbrales sin codificarlos ("3/3", "20 %", "48 h"); `storage.js` la usa para acotar la vigencia de las URL firmadas |
| Seguridad | **`DEFINER`** (desviación menor de "lecturas = INVOKER"): `parametro_sistema` solo es legible por administrador y técnico por RLS, pero docentes y alumnos necesitan los valores. No expone nada sensible: son parámetros de negocio |
| Lee / escribe | Lee `parametro_sistema`. No escribe |
| Reglas | RNF-02 (los valores no se codifican); Tabla 4 |

Retorno: objeto `{ clave: valor }` con **todas** las filas de `parametro_sistema`; valores que son numéricos en texto salen como número JSON (se conservan los ceros: `0.850` se parsea como `0.85` en JS; formatee con `toFixed(3)`), el resto como texto.

```json
{
  "umbral_similitud": 0.850,
  "min_detecciones_validas": 3,
  "limite_presente_min": 10,
  "tolerancia_min": 20,
  "intervalo_muestreo_seg": 15,
  "horas_limite_correccion": 48,
  "retardos_por_ausencia": 3,
  "porcentaje_max_ausencias": 20,
  "dias_retencion_recortes": 7,
  "vigencia_url_firmada_seg": 300,
  "dimension_vector": 512,
  "minutos_pase_lista_base": 5
}
```

Errores: `NO_AUTENTICADO`, `CUENTA_INACTIVA`, `CUENTA_NO_VINCULADA`.

### 3.4 Registro de errores (convenciones y lista inicial)

**Convenciones**

1. Un error de negocio de PostgreSQL es `ERRCODE 'P0001'` con `HINT = CODIGO` y mensaje en español apto para mostrar al usuario. `CODIGO` cumple `^[A-Z][A-Z0-9_]*$`.
2. Los códigos son únicos en todo el sistema. Cada dominio registra los suyos en su documento (prefijo del dominio o `RN_nn_...` cuando nacen de una regla); el integrador los fusiona en `ERROR_REGISTRY` (`web/src/lib/api/errors.js`) y en `docs/API.md` §Errores.
3. Estado HTTP: el de la tabla. Un código con prefijo `RN_` no registrado se trata como `409`. Un `HINT` válido no registrado -> `400`. Un `P0001` sin `HINT` válido -> `ERROR_INTERNO` `500` (el mensaje crudo se registra en el log del servidor, nunca se envía al cliente).
4. Los errores que **no** son `P0001` (constraint, permisos, red) se traducen con `fromPostgrestError` y **no** exponen el texto original de PostgreSQL.
5. Respuesta de Route Handlers: `{ "error": { "code": "...", "message": "...", "details": null | { ... } } }`. `details` para validación: `{ "campos": [ { "campo": "correo", "mensaje": "Correo inválido." } ] }`; para restricciones: `{ "constraint": "uq_alumno_matricula" }`.
6. `retryable = true` en `CONFLICTO` (concurrencia), `TIEMPO_AGOTADO`, `ERROR_DE_RED`, `SERVICIO_RECONOCIMIENTO_NO_DISPONIBLE`, `INDICE_NO_CARGADO`.

**Lista inicial (generales y de plataforma)**

| Código | HTTP | Mensaje por defecto | Origen / cuándo |
|---|---|---|---|
| `NO_AUTENTICADO` | 401 | Debes iniciar sesión. | Sin sesión o JWT vencido (`api_yo`, `app.exigir_rol`, `handle`) |
| `CREDENCIALES_INVALIDAS` | 401 | Correo o contraseña incorrectos. | `signInWithPassword` rechaza |
| `CUENTA_INACTIVA` | 403 | Tu cuenta está inactiva. Contacta al administrador. | `usuario.activo = false`; o Auth responde "usuario bloqueado" |
| `CUENTA_NO_VINCULADA` | 403 | Tu cuenta no está vinculada a un perfil. Contacta al administrador. | Usuario de Auth sin fila en `usuario` |
| `NO_AUTORIZADO` | 403 | No tienes permiso para realizar esta operación. | Rol no permitido; recurso fuera del alcance (grupo ajeno); `42501` |
| `ORIGEN_NO_PERMITIDO` | 403 | Origen de la petición no permitido. | `Origin` distinto del host en métodos con efectos |
| `NO_ENCONTRADO` | 404 | El registro no existe. | Id inexistente |
| `PETICION_INVALIDA` | 400 | La petición no es válida. | JSON mal formado, `HINT` no registrado |
| `VALIDACION` | 422 | Revisa los datos enviados. | zod; `23502`; `22xxx`; argumentos fuera de rango en RPC |
| `RESTRICCION_VIOLADA` | 422 | Los datos no cumplen una regla de integridad. | `23514` (CHECK) |
| `DUPLICADO` | 409 | Ya existe un registro con esos datos. | `23505` (UNIQUE) o duplicado detectado por una RPC |
| `REFERENCIA_INVALIDA` | 409 | El registro está relacionado con otros datos y no se puede completar la operación. | `23503` (FK) |
| `CONFLICTO` | 409 | La operación chocó con otra en curso. Inténtalo de nuevo. | `40001`, `40P01`; estado incompatible |
| `LIMITE_EXCEDIDO` | 413 | El archivo o el cuerpo supera el tamaño permitido. | `handle` (Content-Length) / `FileInput` |
| `TIPO_NO_SOPORTADO` | 415 | Tipo de contenido no soportado. | `Content-Type` inesperado |
| `DEMASIADOS_INTENTOS` | 429 | Demasiados intentos. Espera unos minutos e inténtalo de nuevo. | Límite de tasa de Auth/PostgREST |
| `CONTRASENA_DEBIL` | 422 | La contraseña no cumple los requisitos de seguridad. | `updateUser` rechaza por política |
| `CONTRASENA_IGUAL` | 422 | La nueva contraseña debe ser distinta de la actual. | `updateUser` (`same_password`) |
| `ERROR_INTERNO` | 500 | Ocurrió un error inesperado. Inténtalo de nuevo. | Cualquier otro |
| `ERROR_DE_RED` | 0 en cliente / 503 en servidor | No se pudo conectar. Revisa tu conexión e inténtalo de nuevo. | `fetch` falla |
| `TIEMPO_AGOTADO` | 504 | La operación tardó demasiado. Inténtalo de nuevo. | `57014`, timeouts de clientes |
| `CONFIGURACION_FALTANTE` | 503 | El servicio no está configurado. | Falta `CRON_SECRET`, `RECOGNITION_SERVICE_API_KEY`, etc. |
| `PARAMETRO_NO_ENCONTRADO` | 500 | No existe el parámetro de sistema "<clave>". | `app.param()` |
| `PARAMETRO_INVALIDO` | 500 | El parámetro "<clave>" no es numérico. | `app.param_num()` |
| `CUENTA_SERVICIO_AUSENTE` | 500 | No existe la cuenta de servicio del sistema. | `app.id_usuario_servicio()` |
| `BITACORA_VALORES_REQUERIDOS` | 500 | Una corrección o cambio de parámetro debe guardar valor anterior y nuevo. | `app.bitacora()` (error de programación) |
| `SERVICIO_RECONOCIMIENTO_NO_DISPONIBLE` | 503 | El servicio de reconocimiento no está disponible. | Conexión rechazada o timeout hacia el servicio |
| `SERVICIO_RECONOCIMIENTO_NO_AUTORIZADO` | 502 | El servidor no pudo autenticarse con el servicio de reconocimiento. | El servicio respondió 401 (clave mal configurada; nunca se reenvía 401 al usuario) |
| `SERVICIO_RECONOCIMIENTO_ERROR` | 502 | El servicio de reconocimiento devolvió un error. | Cualquier otro estado no esperado |
| `INDICE_NO_CARGADO` | 503 | El índice facial aún no está cargado. | Servicio: 409 `INDEX_NOT_LOADED` |
| `IMAGEN_INVALIDA` | 422 | La imagen no es válida. | Servicio: 422 |
| `CAMARA_INALCANZABLE` | 504 | No se pudo obtener imagen de la cámara. | Servicio: 504 |

**Mapeo de errores de PostgreSQL / PostgREST** (`fromPostgrestError(e)`, entrada `{ message, details, hint, code }` de supabase-js):

| Condición | Resultado |
|---|---|
| `e.code === 'P0001'` y `e.hint` cumple el patrón | `code = e.hint`, `message = e.message`, `status` del registro (o reglas 3), `details = e.details \|\| null` |
| `P0001` sin `hint` válido | `ERROR_INTERNO` |
| `23505` | `DUPLICADO`; `details = { constraint }` extraído de `e.message` (`unique constraint "<nombre>"`) |
| `23503` | `REFERENCIA_INVALIDA`; `details = { constraint }` |
| `23514` | `RESTRICCION_VIOLADA`; `details = { constraint }` |
| `23502` | `VALIDACION`, mensaje "Falta un dato obligatorio."; `details = { campos: [{ campo: <columna>, mensaje: 'Obligatorio.' }] }` |
| `22xxx` (22P02, 22001, 22003, 22007, 22008...) | `VALIDACION`, mensaje "Algún dato tiene un formato inválido." |
| `42501` (permiso denegado, política RLS violada) | `NO_AUTORIZADO` |
| `40001`, `40P01` | `CONFLICTO` (`retryable`) |
| `57014` | `TIEMPO_AGOTADO` |
| `PGRST301`, `PGRST303`, o `message` contiene `JWT expired` | `NO_AUTENTICADO` |
| `PGRST202`, `42883` (la función no existe: contrato roto) | `ERROR_INTERNO` (se registra el nombre de la función en el log del servidor) |
| `TypeError` de `fetch` / sin respuesta | `ERROR_DE_RED` |
| Cualquier otro | `ERROR_INTERNO` |

`CONSTRAINT_MENSAJES` (en `errors.js`) traduce constraints conocidas de la spec a mensajes de campo cuando una RPC no los convirtió en un código propio: `uq_asistencia_sesion_alumno` -> "Ya existe un registro de asistencia para ese alumno en la sesión."; `uq_camara_aula_posicion` -> "El aula ya tiene una cámara en esa posición."; `ux_plantilla_facial_activa` -> "El alumno ya tiene una plantilla activa."; `ux_indice_faiss_en_uso` -> "Ya hay una versión del índice en uso."; `ck_sesion_horas` -> "La hora de fin debe ser posterior a la de inicio."; `ck_sesion_ventana` -> "El límite de presente debe ser menor que la tolerancia."; `ck_deteccion_score` -> "El score debe estar entre 0 y 1.". Los dominios amplían el mapa.

---

## 4. Route Handlers, infraestructura de servidor y capa de datos web

### 4.1 Capa de datos web (cliente y servidor)

Estructura **exacta** (propiedad: data-layer salvo lo indicado):

```
web/src/lib/api/
    client.js         callRpc, toRpcArgs, rpcName, constantes de paginación
    errors.js         ApiError, ERROR_REGISTRY, CONSTRAINT_MENSAJES, fromPostgrestError, fromHttpResponse, camposDeError, EVENTO_SESION_EXPIRADA
    rutas.js          ROLES, HOME_POR_ROL, ETIQUETA_ROL, ROLES_POR_AREA, rutaSegura (puro, sin dependencias de servidor)
    auth.js           iniciarSesion, cerrarSesion, solicitarRecuperacion, actualizarContrasena, sesionActual, suscribirCambioAuth
    plataforma.js     yo, ahora, parametrosPublicos      (RPC de este documento)
    <dominio>.js      una por dominio: una función async por RPC
    index.js          re-exporta client, errors, rutas, auth, plataforma y cada <dominio>.js (una línea por dominio; el integrador la agrega)
web/src/hooks/data/
    useApiQuery.js    useApiQuery(fn, args, opts)
    useApiMutation.js useApiMutation(fn, opts)
    MeContext.jsx     MeProvider, useMe (re-exportado por useMe.js)
    useMe.js          useMe()
    useParametros.js  useParametros()
web/src/lib/http/
    client.js         requestJSON, getJSON, postJSON, putJSON, patchJSON, deleteJSON, postForm, getBlob
    index.js          re-exporta client.js
web/src/lib/server/
    route.js          handle, json, creado, sinContenido
    auth.js           obtenerSesion, requerirSesion, exigirUsuario, verificarCron, verificarOrigen
    ip.js             ipDeOrigen
    recognition.js    recognitionFetch, reconocer
    storage.js        urlFirmada, urlsFirmadas, subirObjeto, eliminarObjetos, validarRutaObjeto, rutaObjeto, MAX_URL_SEGUNDOS
```

Regla de nombres: la función de `lib/api` de una RPC es camelCase sin el prefijo `api_`: `api_docente_panel` -> `docentePanel`; `api_yo` -> `yo`; `api_parametros_publicos` -> `parametrosPublicos`. Los argumentos se pasan como objeto con claves camelCase **sin** `p_`: `{ idSesion }` -> `p_id_sesion`.

#### 4.1.1 `client.js`

```js
export const PAGINA_DEFECTO = 50;
export const PAGINA_MAXIMA = 200;

/** 'api_docente_panel' -> sin cambios; sirve para validar que el nombre empiece con api_ o svc_. */
export function rpcName(nombre) {}

/** { idSesion: 3, limit: 20, ignorado: undefined } -> { p_id_sesion: 3, p_limit: 20 }.
 *  Claves camelCase -> p_snake_case. `undefined` se omite (aplica el DEFAULT de SQL). `null` se conserva.
 *  Date -> toISOString(). Arreglos y objetos se envían tal cual (jsonb / integer[]). */
export function toRpcArgs(args) {}

/**
 * Llama a una RPC y devuelve `data` o lanza ApiError.
 * @param {string} nombre            nombre SQL de la función ('api_yo', 'svc_crear_captura')
 * @param {object} [args]            argumentos camelCase sin 'p_'
 * @param {{ backend?: object }} [opts]  backend tipo supabase-js; si falta, usa getBrowserBackend()
 * @returns {Promise<any>}           data (null si la función devuelve NULL)
 * @throws {ApiError}
 */
export async function callRpc(nombre, args = {}, opts = {}) {}
```

Pasos de `callRpc`: (1) valida `nombre` (`/^(api|svc)_[a-z0-9_]+$/`, si no -> `ApiError('ERROR_INTERNO')`); (2) `backend = opts.backend ?? getBrowserBackend()` (en un RSC o Route Handler el llamador **debe** pasar `backend`; no se importa código de servidor aquí); (3) `{ data, error } = await backend.rpc(nombre, toRpcArgs(args))`; (4) si `error` -> `throw fromPostgrestError(error)`; (5) si el error resultante es `NO_AUTENTICADO` y hay `window`, emite `window.dispatchEvent(new CustomEvent(EVENTO_SESION_EXPIRADA))`; (6) devuelve `data`. Si `backend.rpc` lanza (red), se envuelve en `ApiError('ERROR_DE_RED')`. La superficie permitida del backend no incluye cancelación; las respuestas obsoletas las descartan los hooks.

Cada función de dominio sigue esta plantilla (obligatoria, para poder mockearlas de forma uniforme):

```js
import { callRpc } from './client.js';

/** api_yo() -> Me */
export async function yo(args = {}, opts = {}) {
    return callRpc('api_yo', args, opts);
}
```

#### 4.1.2 `errors.js`

```js
export const EVENTO_SESION_EXPIRADA = 'susan:sesion-expirada';

/** Registro de códigos: { [CODIGO]: { status: number, mensaje: string } } según §3.4 + los de cada dominio. */
export const ERROR_REGISTRY = { /* ... */ };
export const CONSTRAINT_MENSAJES = { /* ... */ };

export class ApiError extends Error {
    /** @param {string} code  @param {string} message  @param {{ status?: number, details?: any, retryable?: boolean }} [extra] */
    constructor(code, message, extra = {}) {}
    // propiedades: name = 'ApiError', code, message, status (def. del registro o 500), details (def. null), retryable (def. false)
    toJSON() {}                       // -> { code, message, details }
    static from(err) {}               // idempotente: ApiError -> mismo; Error/otro -> ApiError('ERROR_INTERNO') o ERROR_DE_RED si es TypeError de fetch
}

export function isApiError(e) {}      // e instanceof ApiError o (typeof e?.code === 'string' && typeof e?.status === 'number')
export function fromPostgrestError(error) {}                 // tabla de §3.4; nunca devuelve el texto crudo de Postgres salvo en P0001
export async function fromHttpResponse(response) {}          // lee { error } del JSON; si no es JSON, deriva el código del status (401 NO_AUTENTICADO, 403 NO_AUTORIZADO, 404 NO_ENCONTRADO, 413, 415, 422 VALIDACION, 429, 5xx ERROR_INTERNO)
export function camposDeError(err) {}                        // { [campo]: mensaje } desde err.details.campos, o {} si no hay
```

`ERROR_REGISTRY` contiene al menos todos los códigos de §3.4. `ApiError.message` está siempre en español y es seguro para mostrar.

#### 4.1.3 `rutas.js`

```js
export const ROLES = ['administrador', 'docente', 'alumno', 'tecnico'];
export const HOME_POR_ROL = { administrador: '/admin', docente: '/docente', alumno: '/alumno', tecnico: '/tecnico' };
export const ETIQUETA_ROL = { administrador: 'Administrador', docente: 'Docente', alumno: 'Alumno', tecnico: 'Técnico' };
export const ROLES_POR_AREA = { /* tabla de §2.4 */ };

/** Devuelve `next` solo si es una ruta interna segura; si no, `fallback` (null por omisión).
 *  Segura = string de <= 512 caracteres, empieza con '/', no con '//', sin '\\', sin caracteres de control,
 *  sin '://', y no empieza con '/login' (evita bucles). */
export function rutaSegura(next, fallback = null) {}
```

#### 4.1.4 Hooks

**`useApiQuery(fn, args, opts)`** (cliente). `fn` = función de `lib/api` con referencia estable (de módulo). `args` = objeto camelCase.

```js
/**
 * @param {(args: object, opts?: object) => Promise<any>} fn
 * @param {object} [args]
 * @param {{ enabled?: boolean, initialData?: any, keepPreviousData?: boolean, refetchInterval?: number,
 *           onSuccess?: (data) => void, onError?: (err: ApiError) => void }} [opts]
 * @returns {{ data: any, error: ApiError | null, loading: boolean, refetching: boolean,
 *             refetch: () => Promise<{ ok: boolean, data?: any, error?: ApiError }> }}
 */
```

Comportamiento exacto:
- Clave de consulta = `JSON.stringify(args ?? {})`; se vuelve a pedir cuando cambian `fn`, la clave o `enabled` pasa a true. `enabled` por omisión true.
- `loading` es true desde el montaje (si `enabled`) hasta la primera respuesta (éxito o error). `refetching` es true en pedidos posteriores con datos ya presentes. Con `enabled = false` y sin `initialData`: `loading = false`, `data = null`.
- Al cambiar `args`: `keepPreviousData = false` (def.) pone `data = null` y `loading = true`; con `true` conserva `data` anterior y marca `refetching`.
- Una respuesta de un pedido obsoleto (otra clave, otro pedido posterior o componente desmontado) se **descarta** (contador de pedido; no hay cancelación en el backend).
- Error: `error = ApiError`, `data` se conserva si existía. `NO_AUTENTICADO` ya emitió el evento global desde `callRpc`.
- `refetch()` repite el pedido con los mismos `args` y resuelve `{ ok, data }` o `{ ok: false, error }` (nunca rechaza).
- `refetchInterval` (ms): encadena un `setTimeout` al terminar cada pedido (sin solapamientos); se pausa si `document.hidden` y se reanuda en `visibilitychange`. Mínimo efectivo 2000.

**`useApiMutation(fn, opts)`**

```js
/**
 * @param {(args: object, opts?: object) => Promise<any>} fn
 * @param {{ onSuccess?: (data, args) => void, onError?: (err: ApiError, args) => void }} [opts]
 * @returns {{ run: (args?: object) => Promise<{ ok: true, data: any } | { ok: false, error: ApiError }>,
 *             loading: boolean, error: ApiError | null, data: any, reset: () => void }}
 */
```

- `run` **nunca rechaza**: resuelve `{ ok: true, data }` o `{ ok: false, error }` (así los manejadores de eventos no producen promesas sin capturar).
- Mientras `loading`, una segunda llamada a `run` devuelve la misma promesa en curso (anti doble envío).
- `error` se limpia al iniciar una nueva ejecución; `reset()` limpia `error` y `data`.
- Desmontado: no actualiza estado.

**`useMe()`**: devuelve el objeto `Me` provisto por `<MeProvider me={me}>` (cliente, `MeContext.jsx`; el layout `(app)` lo monta con el `me` cargado en el servidor). Fuera del provider devuelve `null`. No hace pedidos propios.

**`useParametros()`**: `{ data: parametros | null, error, loading }` sobre `parametrosPublicos`, con caché de módulo de 5 minutos compartida por todos los componentes (una sola petición en vuelo).

#### 4.1.5 `auth.js` (envoltorios de `auth.*`; los componentes no llaman a Supabase)

| Función | Contrato |
|---|---|
| `iniciarSesion({ correo, contrasena }) -> Promise<Me>` | `backend.auth.signInWithPassword({ email: correo.trim().toLowerCase(), password })`; error de Auth -> `ApiError` (tabla abajo). Luego `api_yo` con el mismo backend: si `activo === false` -> `signOut()` y `throw CUENTA_INACTIVA`; si `CUENTA_NO_VINCULADA` -> `signOut()` y relanza. Devuelve `Me` |
| `cerrarSesion() -> Promise<void>` | `backend.auth.signOut()`; los errores se ignoran (se considera cerrada) |
| `solicitarRecuperacion({ correo }) -> Promise<void>` | `backend.auth.resetPasswordForEmail(correo.trim().toLowerCase(), { redirectTo: SITE_URL + '/cambiar-contrasena' })`. Solo lanza `DEMASIADOS_INTENTOS` o `ERROR_DE_RED`; cualquier otro error se silencia (anti-enumeración) |
| `actualizarContrasena({ contrasena }) -> Promise<void>` | `backend.auth.updateUser({ password: contrasena })` |
| `sesionActual() -> Promise<{ autenticado: boolean }>` | `backend.auth.getSession()`; **no** se usa para autorizar (solo para la pantalla de cambio de contraseña) |
| `suscribirCambioAuth(cb) -> () => void` | `backend.auth.onAuthStateChange((evento, sesion) => cb({ evento, autenticado: !!sesion }))`; devuelve la función para desuscribir |

Mapeo de errores de Supabase Auth (por `error.code` o, si falta, por `error.message`): `invalid_credentials`/"Invalid login credentials" -> `CREDENCIALES_INVALIDAS`; `user_banned`/`user_not_found` en `signIn` -> `CUENTA_INACTIVA` / `CREDENCIALES_INVALIDAS` respectivamente; `over_request_rate_limit`/`over_email_send_rate_limit`/status 429 -> `DEMASIADOS_INTENTOS`; `weak_password` -> `CONTRASENA_DEBIL`; `same_password` -> `CONTRASENA_IGUAL`; `session_not_found`/`not_authenticated`/"Auth session missing" -> `NO_AUTENTICADO`; fallo de red (`AuthRetryableFetchError`) -> `ERROR_DE_RED`; otro -> `ERROR_INTERNO`.

#### 4.1.6 `plataforma.js`

```js
export async function yo(args = {}, opts = {}) { return callRpc('api_yo', args, opts); }
export async function ahora(args = {}, opts = {}) { return callRpc('api_ahora', args, opts); }
export async function parametrosPublicos(args = {}, opts = {}) { return callRpc('api_parametros_publicos', args, opts); }
```

#### 4.1.7 Clientes HTTP (`web/src/lib/http/client.js`)

Todas las funciones devuelven el cuerpo JSON de éxito (los handlers responden el objeto directamente, sin sobre) y **lanzan `ApiError`**.

```js
/** Núcleo. `body` puede ser objeto (se envía como JSON), FormData (multipart) o undefined. */
export async function requestJSON(method, url, { body, query, headers, signal } = {}) {}

export function getJSON(url, { query, signal } = {})              // GET
export function postJSON(url, body, { query, signal } = {})       // POST application/json
export function putJSON(url, body, { query, signal } = {})
export function patchJSON(url, body, { query, signal } = {})
export function deleteJSON(url, { query, signal } = {})
export function postForm(url, formData, { query, signal } = {})   // POST multipart/form-data (el navegador fija el boundary)
export async function getBlob(url, { query, signal } = {})        // -> { blob: Blob, filename: string | null } (CSV/PDF)
```

Reglas: `credentials: 'same-origin'`, `cache: 'no-store'`, cabecera `Accept: application/json`; `query` se serializa omitiendo `undefined`/`null` (los arreglos repiten la clave). `204` -> `null`. Respuesta no OK -> `await fromHttpResponse(response)`. `fetch` que lanza (`TypeError`) -> `ApiError('ERROR_DE_RED')`. `AbortError` se relanza tal cual. Si el estado es 401 se emite `EVENTO_SESION_EXPIRADA`.

### 4.2 Infraestructura de servidor (`web/src/lib/server/`)

Todo el módulo es solo de servidor (`import 'server-only'` en cada archivo). Los Route Handlers son endpoints públicos: **siempre** pasan por `handle`.

#### 4.2.1 `route.js`

```js
/**
 * @typedef {Object} OpcionesHandle
 * @property {'usuario' | 'cron' | 'publica'} [auth='usuario']
 * @property {string[]} [roles]       solo auth:'usuario'; omitido = cualquier rol activo. Valores de ROLES
 * @property {import('zod').ZodType} [input]   cuerpo JSON (POST/PUT/PATCH/DELETE con cuerpo)
 * @property {import('zod').ZodType} [query]   parámetros de URL (todas las claves llegan como string o string[])
 * @property {import('zod').ZodType} [params]  segmentos dinámicos de la ruta (await context.params)
 * @property {import('zod').ZodType} [fields]  campos de texto de un multipart/form-data
 * @property {{ campo: string, maxBytes: number, tipos: string[], requerido?: boolean }[]} [archivos]  archivos de un multipart
 * @property {number} [maxBodyBytes=262144]    tope del cuerpo JSON (256 KiB); en multipart: suma de maxBytes de los archivos + 65536
 */

/**
 * @typedef {Object} ContextoHandle
 * @property {Request} request
 * @property {Me | null} me                   null en auth:'cron' y 'publica'
 * @property {string | null} ip               ipDeOrigen(request)
 * @property {object} body                    JSON ya validado ({} si no hay `input`)
 * @property {object} query                   ya validado
 * @property {object} params                  ya validado
 * @property {{ campos: object, archivos: Record<string, File | null> }} form
 * @property {(nombre: string, args?: object) => Promise<any>} rpc   callRpc con el backend DEL USUARIO (RLS aplica)
 * @property {(nombre: string, args?: object) => Promise<any>} svc   callRpc con el backend service_role (para svc_*)
 * @property {() => Promise<object>} admin    getAdminBackend() (auth.admin, Storage con service_role); perezoso
 * @property {object | null} backend          backend del usuario
 */

/** @returns {(request: Request, routeContext: { params: Promise<object> }) => Promise<Response>} */
export function handle(opciones, fn) {}

export function json(cuerpo, status = 200, headers = {}) {}   // Response.json con Cache-Control: no-store
export function creado(cuerpo) {}                               // 201
export function sinContenido() {}                               // 204
```

Pasos exactos de `handle` (en este orden; el primer fallo corta):

1. **Autenticación**, según `auth`:
   - `'usuario'`: (a) `verificarOrigen(request)` si el método no es GET/HEAD/OPTIONS; (b) `ip = ipDeOrigen(request)`; (c) `backend = await getServerBackend({ clientIp: ip })`; (d) `backend.auth.getUser()` (valida el JWT contra Auth; **no** `getSession`) -> sin usuario: `NO_AUTENTICADO`; (e) `me = await callRpc('api_yo', {}, { backend })`; (f) `me.activo === false` -> `CUENTA_INACTIVA`; (g) `roles` definido y `me.rol` fuera de la lista -> `NO_AUTORIZADO`.
   - `'cron'`: `verificarCron(request)` (`Authorization: Bearer <CRON_SECRET>`, comparación en tiempo constante); sin `CRON_SECRET` configurado -> `CONFIGURACION_FALTANTE` (nunca se acepta secreto vacío); mal secreto -> `NO_AUTENTICADO`. `me = null`.
   - `'publica'`: sin autenticación.
2. **Tamaño**: `Content-Length` > tope -> `LIMITE_EXCEDIDO` (413). Se vuelve a comprobar al leer el cuerpo.
3. **Cuerpo**: `input` definido -> `Content-Type` debe ser `application/json` (si no, `TIPO_NO_SOPORTADO`); JSON inválido -> `PETICION_INVALIDA`. `fields`/`archivos` definidos -> `multipart/form-data`; cada archivo se valida por tamaño (`LIMITE_EXCEDIDO`) y tipo MIME declarado **y** firma de bytes (JPEG `FF D8 FF`, PNG `89 50 4E 47`, PDF `25 50 44 46`; si no coincide -> `VALIDACION` campo `<campo>`). `requerido !== false` y falta -> `VALIDACION`.
4. **Validación zod** de `input`, `query`, `params`, `fields` con `safeParse`. Fallo -> `VALIDACION` con `details = { campos: [{ campo: path.join('.'), mensaje }] }`. Los mensajes de zod salen en español (`z.config(z.locales.es())` al cargar el módulo). Se recomienda `.strict()` en los esquemas de entrada.
5. **Ejecución** de `fn(ctx)`. Retorno: un `Response` pasa tal cual; `undefined` -> `{ "ok": true }`; cualquier otro valor -> 200 JSON.
6. **Errores**: `ApiError` -> su `status`; `ZodError` -> `VALIDACION`; error de supabase (`{ code, message, hint }`) -> `fromPostgrestError`; otro -> `ERROR_INTERNO` 500. Cuerpo siempre `{ error: { code, message, details } }`. Se registra en consola una línea `[api] METODO /ruta code status` (sin cuerpo, sin cabeceras, sin PII; para `ERROR_INTERNO` además `err.name` y el mensaje interno).
7. **Cabeceras de toda respuesta**: `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`.

Ejemplo de uso (esquema de un handler de dominio):

```js
export const POST = handle({ roles: ['docente'], input: z.object({ idSesion: z.number().int().positive() }).strict() },
    async ({ body, rpc, ip }) => rpc('api_cerrar_sesion', { idSesion: body.idSesion }));
```

#### 4.2.2 `GET /api/salud` (única ruta HTTP de este dominio)

| Campo | Valor |
|---|---|
| Archivo | `web/src/app/api/salud/route.js` (propiedad: route-handlers) |
| Método y ruta | `GET /api/salud` |
| Roles | Público (`auth: 'publica'`) |
| Entrada | Ninguna |
| Pasos | `handle({ auth: 'publica' }, () => ({ estado: 'ok', hora: new Date().toISOString() }))`. No toca la base ni el servicio de reconocimiento (sirve de sonda de vida del proceso web) |
| Respuesta 200 | `{ "estado": "ok", "hora": "2026-09-14T13:12:00.000Z" }` |
| Errores | Ninguno propio |

#### 4.2.3 `auth.js`

```js
/** Estado de la sesión actual en un RSC/Route Handler.
 *  @returns {Promise<{ estado: 'ok', me: Me, backend: object } | { estado: 'sin_sesion' | 'inactiva' | 'sin_cuenta' }>} */
export async function obtenerSesion() {}
//  getServerBackend() -> auth.getUser(): sin usuario => 'sin_sesion'; api_yo: CUENTA_NO_VINCULADA => 'sin_cuenta';
//  me.activo === false => 'inactiva'; otro error => se relanza.

/** Para layouts y páginas del servidor. Redirige (next/navigation#redirect) y no vuelve si no procede.
 *  sin_sesion -> /login?next=<ruta>   (la ruta actual se pasa con el header x-pathname del proxy; si falta, sin next)
 *  inactiva   -> /login?error=cuenta_inactiva
 *  sin_cuenta -> /login?error=sin_cuenta
 *  rol fuera de `roles` -> redirect(me.home)
 *  @param {string[]} [roles]  @returns {Promise<Me>} */
export async function requerirSesion(roles) {}

/** Primeros pasos de handle() para auth:'usuario'. @returns {Promise<{ backend, me, ip }>} */
export async function exigirUsuario(request, { roles } = {}) {}

/** Lanza ApiError(CONFIGURACION_FALTANTE | NO_AUTENTICADO). */
export function verificarCron(request) {}

/** Lanza ApiError(ORIGEN_NO_PERMITIDO) si el método tiene efectos y `Origin` está presente y su host != host de la petición. Sin `Origin` -> permite (no es un navegador). */
export function verificarOrigen(request) {}
```

#### 4.2.4 `ip.js`

```js
/** IP de origen para la bitácora (RF-19). Toma el primer elemento de `x-forwarded-for`, o `x-real-ip`.
 *  Quita puerto y corchetes; valida con net.isIP. Devuelve null si no hay o no es válida (la bitácora admite nulo).
 *  @param {Request} request  @returns {string | null} */
export function ipDeOrigen(request) {}
```

Requiere que el despliegue reescriba `x-forwarded-for` en el proxy de entrada (no confiar en el valor del cliente). En desarrollo sin proxy devuelve `null`.

#### 4.2.5 `recognition.js` (cliente tipado del servicio de reconocimiento)

```js
/** Fetch con X-API-Key y timeout. Mapea errores de transporte y de estado a ApiError (tabla abajo).
 *  @param {string} path  p. ej. '/v1/recognize'
 *  @param {{ method?: string, headers?: object, body?: any, timeoutMs?: number, signal?: AbortSignal }} [init]
 *  @returns {Promise<Response>} respuesta OK (2xx)  @throws {ApiError} */
export async function recognitionFetch(path, init = {}) {}

/**
 * POST /v1/recognize. Exactamente uno de `imagen` o `cameraUrl`.
 * @param {{ imagen?: Blob, cameraUrl?: string, allowedFaissIds: number[], cropPrefix: string, maxFaces?: number, timeoutMs?: number }} p
 * @returns {Promise<{ index_version: string, elapsed_ms: number, image: { width: number, height: number },
 *           faces: { bbox: [number, number, number, number], det_score: number,
 *                    candidate: { faiss_id: number, score: number } | null, objeto_recorte: string | null }[] }>}
 */
export async function reconocer(p) {}
```

- URL base `serverEnv().recognitionUrl`; clave `serverEnv().recognitionApiKey` en la cabecera `X-API-Key`. Sin clave -> `CONFIGURACION_FALTANTE`.
- `reconocer` arma `multipart/form-data`: `image` (archivo `frame.jpg`) **o** `camera_url`; `allowed_faiss_ids` = `JSON.stringify(array)`; `crop_prefix`; `max_faces` (def. 60). Valida en el cliente: `allowedFaissIds` son enteros >= 0; `cropPrefix` empieza con `recortes/` y termina en `/`; exactamente uno de imagen/cameraUrl (si no, `VALIDACION`).
- `timeoutMs` por omisión 10000 (presupuesto de proceso 7.5 s, RNF-01, más margen de red). Se valida la respuesta con zod y se **eliminan** campos no esperados; nunca se propaga un campo `vector`/`embedding`.
- Mapeo: 401 -> `SERVICIO_RECONOCIMIENTO_NO_AUTORIZADO`; 409 con `INDEX_NOT_LOADED` -> `INDICE_NO_CARGADO`; 422 -> `IMAGEN_INVALIDA`; 504 -> `CAMARA_INALCANZABLE`; conexión rechazada/DNS/timeout -> `SERVICIO_RECONOCIMIENTO_NO_DISPONIBLE`; cualquier otro >= 400 -> `SERVICIO_RECONOCIMIENTO_ERROR`. Los demás endpoints (`/v1/*` del dominio biometría) usan `recognitionFetch` y pueden agregar funciones tipadas a este archivo.

#### 4.2.6 `storage.js`

```js
export const MAX_URL_SEGUNDOS = 300;      // RNF-04: tope duro, independiente del parámetro

/** Segundos efectivos = max(1, min(solicitado ?? vigencia, vigencia, 300)), con `vigencia` = parámetro
 *  vigencia_url_firmada_seg leído de api_parametros_publicos (caché en memoria de 60 s). */
export async function segundosEfectivos(solicitado, { backend } = {}) {}

/** URL firmada de un objeto del bucket privado. La ruta se valida con validarRutaObjeto.
 *  @returns {Promise<{ url: string, expira_en: string, segundos: number }>} expira_en ISO. @throws ApiError(VALIDACION | NO_ENCONTRADO) */
export async function urlFirmada(ruta, { segundos, backend } = {}) {}

/** Varias rutas; las que no existen salen con url: null (no falla todo el lote). @returns {Promise<{ ruta: string, url: string | null, expira_en: string | null }[]>} */
export async function urlsFirmadas(rutas, { segundos, backend } = {}) {}

/** Sube con service_role. upsert=false por omisión (nunca sobrescribe silenciosamente). */
export async function subirObjeto(ruta, cuerpo, { contentType, upsert = false } = {}) {}

/** Borra objetos (purga de recortes, reemplazo de documentos). */
export async function eliminarObjetos(rutas) {}

/** Rechaza (VALIDACION) rutas vacías, absolutas, con '..', '\\', '//' o que no coincidan con uno de los patrones. Devuelve la ruta. */
export function validarRutaObjeto(ruta, prefijos = ['registro', 'consentimientos', 'justificantes', 'recortes', 'indice']) {}

/** Constructores de rutas relativas al bucket (la BD guarda solo estas rutas). uuid = crypto.randomUUID(). */
export const rutaObjeto = {
    registro: (idAlumno) => `registro/${idAlumno}/${uuid}.jpg`,
    consentimiento: (idAlumno) => `consentimientos/${idAlumno}/${uuid}.pdf`,
    justificante: (idAlumno, ext) => `justificantes/${idAlumno}/${uuid}.${ext}`,   // ext en pdf|jpg|png
    recorte: (idSesion, idCaptura, n) => `recortes/${idSesion}/${idCaptura}/${n}.jpg`,
    indice: (version) => `indice/${version}.json`,
};
```

Patrones válidos para `validarRutaObjeto`: `^registro/\d+/[0-9a-f-]{36}\.jpg$`, `^consentimientos/\d+/[0-9a-f-]{36}\.pdf$`, `^justificantes/\d+/[0-9a-f-]{36}\.(pdf|jpg|png)$`, `^recortes/\d+/\d+/\d+\.jpg$`, `^indice/[A-Za-z0-9._-]+\.json$`.

**Regla de uso (RF-19/RNF-04)**: `urlFirmada` no registra bitácora; el handler que sirva recortes, fotos o documentos debe llamar **antes** a la RPC de su dominio que autoriza el acceso (RLS) y asienta `consulta` con `app.bitacora`, y solo entonces pedir la URL. Nunca se acepta una ruta de objeto proveniente del cliente sin comprobar, vía RPC, que pertenece a un registro visible para el usuario. Las URL firmadas no se escriben en logs.

---

> **Nota de estado.** Este documento llega hasta §4. Las funciones del esquema `app`, la matriz de RLS/GRANTs y las
> pruebas de plataforma NO se redactaron aparte: las define directamente la migración de `db-schema`
> (`supabase/migrations/00xx`) a partir de `docs/ARCHITECTURE.md` §2 y de la especificación (Tabla 36 y la política
> ejemplo `docente_ve_sus_grupos`, líneas 4074-4160 de `docs/spec/Avance1.txt`). La fuente de verdad de esas piezas es el SQL.
