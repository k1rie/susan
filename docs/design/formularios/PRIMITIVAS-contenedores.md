# Primitivas de estructura, flujo y estado de formularios (contenedores y hooks)

Frente **F1b** del rediseño de formularios (ver `auditoria.md` §4–§5). Este documento es el contrato de las piezas que dan **estructura y flujo** al formulario:
contenedores (`Modal`, `PanelLateral`, `Asistente`), barra de acciones, secciones, progreso, pantalla de éxito, filtros de listados, menú de fila y los hooks de estado.
Las primitivas de **campo** (`Field`, `Input`, `Select`, `Combobox`, `SegmentedControl`, `CampoFecha`, `FileInput`…) son de F1a y se documentan aparte.

Referencias: `referencias-flujos-guiados.md` (se cita «flujos R7», «flujos P3») y `referencias-campos-y-validacion.md` (se cita «campos R05», «campos P2»). Las URL de Mobbin están en esos dos archivos.
Convenciones comunes (`CLAUDE.md`): un componente por carpeta, tokens semánticos, Lucide con `aria-hidden`, 360 px sin desborde, claro/oscuro, apagado con «reducir movimiento»
(la entrada de los paneles y diálogos usa `tw-animate-css`, que ya respeta la regla global de `globals.css`), sin dependencias nuevas.

## 1. Qué contenedor usar

| Situación | Contenedor | Por qué |
|---|---|---|
| Alta o edición de **un paso** con ≤ ~6 campos y sin dependencias: aula, materia, docente, usuario, cámara | **`PanelLateral`** | La lista de detrás no se pierde de vista; pie fijo con acciones; pantalla completa en teléfono (flujos P1, P9; flujos R4; campos R03) |
| Pregunta corta, 1–3 campos, o confirmación con motivo | **`Modal`** (o `ConfirmDialog`) | Interrumpe poco; en teléfono pasa a pantalla completa con `size="full-mobile"` si lleva teclado |
| Datos con **dependencias** entre sí, más de ~6 campos, o que conviene **revisar antes de crear**: grupo, alumno, justificante | **`Asistente`** en página completa (o dentro de `PanelLateral` si es corto) | Pasos cortos, progreso visible, revisión editable y siguiente paso al terminar (flujos P2, P7, P8; flujos R7) |
| Flujo guiado por **datos** (importar CSV: archivo → columnas → revisión → resultado) | `Modal size="lg"` (+ `fullMobile`) con `Stepper` y estado propio | Los pasos dependen de lo que devuelve el archivo; `Asistente` solo sirve si los pasos son lineales |
| Editar el registro que ya se ve (ficha del alumno, datos del grupo) | **Página** con `FormSection` + `FormActions` | El formulario es el contenido; la barra avisa «cambios sin guardar» |
| Cierre de un alta | **`SuccessState`** con 2–3 siguientes pasos | Nunca volver a la lista en silencio (flujos P3; anti-patrón de Dropbox Dash) |
| Listados con búsqueda y filtros | **`BarraFiltros`** | Una sola barra para todos los listados |
| Acciones por fila (3+ botones) | **`MenuAcciones`** | Un solo botón «⋯» a 360 px |

Regla de oro: **un asistente para dos o tres campos es un anti-patrón** (flujos §3.4). Y **nunca un modal sobre un modal** salvo la confirmación de descarte, que ya está resuelta.

## 2. Hooks (`web/src/hooks/ui/`)

### 2.1 `useFormulario`

```js
const f = useFormulario({ inicial, validar, onSubmit, validarAlSalir = true, mapearError });
```

| Parámetro | Descripción |
|---|---|
| `inicial` | Valores de partida (objeto plano). Si el registro carga después, llama a `f.reiniciar(registro)` (el hook **no** pisa lo escrito cuando cambia `inicial`). |
| `validar(valores)` | `{ campo: 'mensaje' }`. Pura y síncrona; lo correcto se omite o va vacío. Es validación de conveniencia: la regla real es la del servidor. |
| `onSubmit(valores)` | `Promise`. Si lanza, el error queda en `errorEnvio` (o en su campo, ver `mapearError`) y **se conserva lo capturado** (campos A13). |
| `validarAlSalir` | `true`: el error de un campo aparece al salir de él (blur) o al enviar, nunca mientras se escribe por primera vez; con un error visible se revalida en cada tecla y desaparece al corregir (campos P1, A11). `false`: solo al enviar. |
| `mapearError(error)` | `{ campo: 'mensaje' } \| null`. Convierte un error del servidor (p. ej. `DUPLICADO`) en un error **pegado al campo que lo causa, con foco en él** (campos A01). Se quita al editar ese campo. `null` = error general (`errorEnvio`). |

Devuelve:

| Clave | Qué es |
|---|---|
| `valores`, `setCampo(nombre, valor \| fn)` | Estado. `setCampo` acepta una función sobre el valor anterior y puede llamarse varias veces en el mismo tick. |
| `campo(nombre, { checkbox }?)` | `{ name, value, onChange, onBlur, invalid, error, props }`. **`props`** = todo menos `error`, para esparcirlo en el control: `<Input {...c.props} />`; `error` va a `Field`. `onChange` acepta el evento nativo **o el valor directo** (Combobox, SegmentedControl, FileInput…). Con `{ checkbox: true }` entrega `checked` en lugar de `value`. |
| `errores` | Solo los de campos tocados o, tras intentar enviar, todos; más los del servidor. |
| `valido`, `primerError` | Validez completa y primer mensaje (aunque no se muestre): para `motivoBloqueo`. |
| `sucio`, `cambios` | Hay diferencias con lo guardado (comparación estructural: arreglos y objetos anidados) y cuántos campos de primer nivel difieren. |
| `enviando`, `errorEnvio` | Estado del envío. Un segundo `enviar` mientras hay uno en curso devuelve `false` sin llamar a `onSubmit`. |
| `enviar(evento?)` | Se pasa a `<form onSubmit={f.enviar} noValidate>`. Inválido: no llama a `onSubmit`, muestra todos los errores y **enfoca el primer campo inválido** (por `name`, en orden de pantalla). Devuelve `Promise<boolean>`; **nunca lanza**. Tras un éxito, lo enviado pasa a ser «lo guardado» (`sucio` vuelve a `false`: no se pregunta al salir después de guardar). |
| `reiniciar(nuevoInicial?)` | Vuelve a lo guardado (o fija otra base) y limpia tocados, errores y `errorEnvio`. «Guardar y crear otro» = `reiniciar(INICIAL)`. |
| `tocar(nombres?)`, `validarCampos(nombres)`, `erroresDe(nombres)`, `fijarErrores(obj)` | Para flujos por pasos y errores del servidor a mano. `validarCampos` marca esos campos como tocados, enfoca el primero inválido y devuelve `true/false`; `erroresDe` devuelve `{ campo: mensaje }` sin mostrarlos. |

Notas importantes:

- **No lleva un ref del `<form>`** a propósito: un `ref={f.algo}` obligaría al compilador de React a tratar todo `f` como «contiene un ref» y `eslint` (`react-hooks/refs`) prohibiría leer `f.valores` al renderizar. El foco al primer error usa el `<form>` del evento de envío o, si no hay, busca por `name` en el documento.
- Asigna a cada control un `name` único (el foco al primer error lo usa).
- **Foco al primer error** (`enfocarPrimerError`, también tras `validarCampos` y `fijarErrores`): busca en **orden de pantalla**. Llega a `Input`, `Select`, `Textarea`, radios nativos y también a `Combobox` (su `<input>` de texto) y `SegmentedControl` (el radio elegido, o el primero habilitado), que lo permiten con `data-campo-nombre="<name>"` en su contenedor (lo escriben cuando reciben `name`, p. ej. al esparcir `{...f.campo('x').props}`). Sin coincidencia por `name` cae al primer `[aria-invalid="true"]` enfocable, también un grupo de radios. **Salta lo que no puede recibir el foco** (deshabilitado, `type="hidden"`, dentro de algo `hidden` o `inert`, como una sección plegada) y sigue con el siguiente error; antes un `Combobox` o un `SegmentedControl` con error hacían saltar el foco al **segundo** campo.
- **`disabled` mientras se envía: usa `readOnly`** (o `aria-disabled`). `enviar` enfoca el campo con el error del servidor **antes** de que `enviando` vuelva a `false`, y un campo `disabled` no recibe el foco. Si aun así no había a dónde enfocar (todos los candidatos deshabilitados u ocultos), el hook **reintenta tras el render** en que `enviando` vuelve a `false` (o aparece la sección plegada): con `disabled={f.enviando}` el foco llega con un retraso de un render, con `readOnly` llega de inmediato. `Input`, `Textarea` y `CampoFecha` admiten `readOnly`; `Select`, `Combobox` y `SegmentedControl` no (usa `disabled` solo si no te importa el foco por error de servidor en ellos).
- Para listas (horario) usa un solo campo con arreglo: `setCampo('bloques', (b) => [...b, nuevo])`.

Ejemplo mínimo (página de edición/alta):

```jsx
const f = useFormulario({
    inicial: { matricula: '', nombres: '' },
    validar: (v) => ({ matricula: v.matricula.trim() ? undefined : 'Escribe la matrícula', nombres: v.nombres.trim() ? undefined : 'Escribe el nombre' }),
    onSubmit: (v) => alumnoGuardar(v),
    mapearError: (e) => (e.code === 'DUPLICADO' ? { matricula: 'Esta matrícula ya está registrada' } : null),
});
useCambiosSinGuardar(f.sucio);
const matricula = f.campo('matricula');

return (
    <form onSubmit={f.enviar} noValidate className="flex flex-col gap-5">
        <FormSection title="Identidad" columns={2}>
            <Field label="Matrícula" error={matricula.error}>
                <Input {...matricula.props} maxLength={10} />
            </Field>
            {/* … */}
        </FormSection>
        {f.errorEnvio && <Alert tone="danger" compact title="No se pudo guardar">{f.errorEnvio.message}</Alert>}
        <FormActions dirty={f.cambios}>
            <Button variant="secondary" href="/admin/alumnos">Cancelar</Button>
            <Button type="submit" loading={f.enviando}>Crear alumno</Button>
        </FormActions>
    </form>
);
```

### 2.2 `useCambiosSinGuardar`

```js
const { confirmarSalida, alNavegar, sucio } = useCambiosSinGuardar(sucio, { mensaje? });
```

- **Recargar o cerrar la pestaña**: registra `beforeunload` mientras `sucio` (el texto del aviso lo pone el navegador).
- **Modales y pestañas propias**: `confirmarSalida(texto?)` devuelve `true` si puede salir (`window.confirm` cuando hay cambios). Va directo a `Tabs confirmLeave={confirmarSalida}`.
- **Enlaces de Next**: `alNavegar` es un `onNavigate` listo: `<Link href="/admin/alumnos" onNavigate={alNavegar}>`. Es el **único** mecanismo oficial de este Next para frenar navegación interna (guía de `next/link`, «Blocking navigation»; se comprobó en `web/node_modules/next/dist/docs/01-app/03-api-reference/02-components/link.md`).
- **Enlaces ajenos al formulario** (riel lateral, barra inferior): los formularios sucios se registran en un registro global; `alNavegarProtegido` (export con nombre) consulta ese registro, así que cualquier `<Link onNavigate={alNavegarProtegido}>` protege sin proveedor en el layout. Hoy el layout no lo usa (ver §6, `requests`).
- **Límite**: el botón «atrás» del navegador (`popstate`) no se puede interceptar en el App Router; `beforeunload` cubre recargar y cerrar.

Otros exports: `hayCambiosSinGuardar()`, `confirmarNavegacion(mensaje?)`, `MENSAJE_CAMBIOS`.

### 2.3 `useDebounce`

`useDebounce(valor, ms = 300)` devuelve el valor tras `ms` sin cambios. `BarraFiltros` no lo usa (necesita limpiar al instante con 0 caracteres); está para validaciones remotas (campos P1: «Comprobando…» tras 400 ms).

### 2.4 `useCierreContenedor` y `useCierreConfirmado`

- `useCierreContenedor()` → `{ enContenedor, cerrar }`. Dentro de un `Modal` o `PanelLateral`, `cerrar()` es **la ruta de cierre del contenedor** (la que pregunta «¿Descartar los cambios?» si hay `dirty`). Úsalo en un «Cancelar» que esté en el cuerpo; el pie ya lo recibe como `footer={({ cerrar }) => …}`. `Asistente` lo usa solo.
- `useCierreConfirmado({ open, dirty, onClose, onDiscard, closeDisabled })` es la lógica compartida por `Modal` y `PanelLateral` (no hace falta usarlo en pantallas).

### 2.5 Cambio en `useDialog` (afecta a todos los diálogos)

`useDialog` ahora lleva una **pila de diálogos abiertos**: con un diálogo sobre otro (la confirmación de descarte sobre un formulario) solo el de arriba atiende Esc y Tab. Antes, dos diálogos anidados se pisaban el foco. Además, el recorrido de Tab ignora lo que está dentro de un ancestro con `hidden` o `inert` (secciones plegadas). Para diálogos solos el comportamiento es idéntico.

**El foco se devuelve solo al cerrar de verdad.** `useDialog` guardaba al abridor y le devolvía el foco en la **limpieza** del efecto; bajo React Strict Mode (desarrollo: montar, desmontar y volver a montar) eso quitaba el foco al primer campo recién enfocado, ese `blur` hacía que `useFormulario` lo marcara como «tocado» y un panel recién abierto mostraba un error de entrada (F4 lo contorneó ignorando el blur de campos no editados en `useAltaCatalogo.campo`: ese contorneo ya no es necesario). Ahora el abridor y el estado de apertura viven en un `ref` (sobrevive al doble montaje) y el foco se devuelve (1) en el mismo commit en que `enabled` pasa a `false` y (2) al desmontar el componente con el diálogo abierto, un microtask después, salvo que el efecto se vuelva a montar en ese lapso (Strict Mode). La pila de diálogos, el foco atrapado y el orden `Modal` > confirmación de descarte no cambian. Prueba: `hooks/ui/useDialog.test.jsx` (con y sin `StrictMode`).

**Modal, PanelLateral y ConfirmDialog van en un portal a `document.body`** (ver §3.1 y §4.7); usan el hook `useMontadoEnCliente` (`hooks/ui`, `useSyncExternalStore`: `false` en servidor e hidratación, `true` desde el primer render del navegador) y le pasan a `useDialog` `open && montado`, porque el contenedor del diálogo no existe hasta que aparece el portal.

## 3. Ampliaciones de piezas existentes (aditivas)

Sin las props nuevas, el DOM y el comportamiento son los de siempre (las pruebas de los consumidores siguen verdes: `RegistroFacialGuiado`, `CapturaContinua`, `IndiceFacialPanel`, `PasswordTemporalModal`…).

### 3.1 `Modal`

| Prop nueva | Descripción |
|---|---|
| `dirty` | Hay cambios sin guardar: Esc, clic en el fondo, la X y «Cancelar» abren «¿Descartar los cambios?» (botones «Seguir editando» —con el foco— y «Descartar cambios»). |
| `onDiscard` | Se llama al confirmar el descarte, **antes** de `onClose` (reiniciar el formulario, borrar borradores). No hace falta que cierre: después se llama a `onClose`. |
| `closeDisabled` | Ignora todos los intentos de cierre (p. ej. mientras guarda). |
| `showClose` / `closeLabel` | Botón **X** (Lucide) visible, con nombre accesible «Cerrar». **Por omisión no se muestra** (compatibilidad); con `size="full-mobile"` sí. La X va al final del DOM (y arriba por posición) para que el foco inicial caiga en el primer campo. |
| `size="full-mobile"` / `fullMobile` | Pantalla completa por debajo de 640 px (pie fijo, área segura arriba y abajo, botones del pie repartidos); desde 640 px es un diálogo centrado (`md`, o el `size` que pidas con `fullMobile`). |
| `footer` | Ahora también `({ cerrar }) => nodo`: `cerrar` respeta `dirty`. |

```jsx
<Modal
    open={abierto}
    onClose={() => setAbierto(false)}
    title="Nueva materia"
    size="full-mobile"
    dirty={f.sucio}
    onDiscard={() => f.reiniciar()}
    closeDisabled={f.enviando}
    footer={({ cerrar }) => (
        <>
            <Button variant="secondary" onClick={cerrar}>Cancelar</Button>
            <Button type="submit" form="form-materia" loading={f.enviando}>Crear materia</Button>
        </>
    )}
>
    <form id="form-materia" onSubmit={f.enviar} noValidate>…</form>
</Modal>
```

**Portal**: `Modal` (y `ConfirmDialog`, que usa el mismo `ModalBase`) se dibuja en un portal a `document.body`. Un diálogo abierto desde una celda de tabla, una tarjeta con `overflow` o cualquier ancestro con `text-align`/`transform` ya no hereda esos estilos ni queda recortado (F4 lo contorneaba con `text-left` en la celda: ya no hace falta; verificado en `/admin/usuarios` → «Cambiar rol»). Para React sigue siendo hijo de quien lo declara, así que **contextos y eventos burbujean igual** (`useCierreContenedor`, un `onClick` del padre). En el servidor y durante la hidratación no se dibuja nada: aparece en el primer render del navegador. Cada capa del portal es hija directa del `body`, de modo que un diálogo que se abre encima de otro (el descarte sobre el formulario) queda encima por orden de montaje.

Internamente `Modal.jsx` envuelve a `Modal/ModalBase.jsx` (el cascarón sin `dirty`); `ConfirmDialog` usa `ModalBase` para no crear una importación circular. Los consumidores siguen importando `@/components/ui/Modal`.

### 3.2 `ConfirmDialog`

`reason={{ label = 'Motivo', required = false, maxLength }}` agrega un campo de motivo; `onConfirm(texto)` lo recibe ya sin espacios en los extremos. Con `required`, confirmar sin texto **no** llama a `onConfirm`: marca el campo («Escribe el motivo para continuar.») y le da el foco. El campo recibe el foco inicial y empieza vacío cada vez que el diálogo se abre. Si falla `required`, el `Textarea` queda **inválido de verdad**: `invalid` (borde rojo, que ahora se conserva con el foco: ver `CONTROL_INVALIDO` en `PRIMITIVAS-campos.md`), `aria-invalid="true"` y el mensaje enlazado por `aria-describedby` (vía `Field`); al escribir, todo se limpia. **Sin `reason`, `onConfirm` se sigue llamando sin argumentos.**

```jsx
<ConfirmDialog open title="Rechazar justificante" variant="danger" confirmLabel="Rechazar"
    reason={{ label: 'Comentario para el alumno', required: true, maxLength: 200 }}
    onConfirm={(motivo) => rechazar({ comentario: motivo })} onCancel={cerrar} />
```

Respaldo: campos R16 (confirmaciones destructivas con consecuencia dicha) y la auditoría §3.6 (motivo dentro del diálogo al rechazar).

### 3.3 `Tabs`, `Pills`, `Alert`

- `Tabs confirmLeave={() => boolean}`: se consulta antes de pasar a **otra** pestaña (clic, flechas, Inicio, Fin); si devuelve `false` se cancela y la actual conserva el foco. Volver a la misma no pregunta. Úsalo con `useCambiosSinGuardar(...).confirmarSalida`.
- `Pills multiple`: `value` es un arreglo de ids y `onChange(nuevoArreglo)`; cada clic enciende o apaga su píldora (`aria-pressed`). Sin `multiple` no cambia nada.
- `Alert compact`: relleno e icono más chicos (avisos dentro de formularios, diálogos y pies de asistente).

## 4. Piezas nuevas (`web/src/components/ui/`)

### 4.1 `FormActions`

Barra de acciones del formulario. Referencias: pie fijo de fal y Square (campos R03), barra «cambios sin guardar» de Shopify y DoorDash (campos R01, R14), motivo del bloqueo junto al botón de Customer.io (campos R05, campos P2).

| Prop | Descripción |
|---|---|
| `children` | Los botones. En teléfono se reparten el ancho (`flex-1`); desde `sm` quedan a la derecha. |
| `dirty` | Booleano **o número de cambios** (`f.cambios`): «Cambios sin guardar», «1 cambio sin guardar», «3 cambios sin guardar» (punto de color **más texto**). `dirtyText` para un texto propio. |
| `summary` | Qué va a pasar al confirmar («Se inscribirán 3 alumnos»); a la izquierda. |
| `motivoBloqueo` | Por qué no se puede guardar, escrito junto al botón (con icono `Info`). Úsalo cuando el botón sí esté deshabilitado (edición sin cambios, falta de permiso). Para formularios de captura se recomienda **dejar el botón habilitado** y que el clic muestre los errores (flujos P10); entonces `motivoBloqueo` es opcional. |
| `sticky` | `'movil'` (por omisión): por debajo de `lg` se pega al pie **sobre la barra inferior de navegación del AppShell** (offset `5.25rem` + área segura); desde `lg` es una fila normal. `'contenedor'`: pegada al borde inferior del contenedor con scroll (Modal, PanelLateral, páginas sin barra inferior), en cualquier ancho. `false`: fila normal. |
| `flat` | Sin borde, relleno ni pegado: para el pie de `Modal`/`PanelLateral` (que ya es fijo). |
| `align` | `'end'` (por omisión), `'start'`, `'center'`, `'between'`. |
| `stacked` | Apila el estado (resumen, «N cambios sin guardar», motivo) **sobre** los botones, que se reparten el ancho, en cualquier ancho de pantalla. Para pies estrechos (tarjetas de ~290 px, paneles de 28 rem) donde estado y botones no caben en fila. Reemplaza el contorneo `className="sm:!flex-col sm:!items-stretch"` (que sigue funcionando). |

Pies estrechos sin `stacked`: desde 640 px la fila ya **se parte sola** (`sm:flex-wrap` y un ancho mínimo de 10 rem para el estado): si estado y botones no caben juntos, los botones pasan debajo en lugar de dejar el texto en una columna de ~80 px. El texto de estado usa `min-w-0`, `whitespace-normal`, `break-words` y `text-balance` (se parte por palabras, nunca letra a letra; **no uses `break-all`** en el contenedor).

**`sticky` y dónde se pega.** `position: sticky` solo funciona si ningún ancestro entre la barra y quien desplaza es un contenedor de scroll propio. Dos casos:

- **Dentro de `AppShell`** (el panel blanco desplaza): siempre funciona.
- **Páginas que desplazan con la ventana** (teléfono y tablet): depende de `html, body` en `globals.css`. Con `overflow-x: hidden` (como estaba) `body` pasaba a ser un contenedor de scroll que nunca desplaza y **todo `sticky` quedaba inerte**; con `overflow-x: clip` (como está ahora, `globals.css`) funciona también ahí. Verificado en navegador a 360 px en `/admin/grupos/nuevo`: la barra queda pegada con `bottom` a `5,25 rem + 0,75 rem` del borde de la ventana. Si alguien vuelve a poner `hidden` en `html`/`body`, `sticky="movil"` y `sticky="contenedor"` dejan de pegarse fuera de `AppShell`; entonces usa `position: fixed` con relleno inferior o `sticky={false}`.

Estados y accesibilidad: la zona de estado es una región `aria-live="polite"` que **existe siempre** (vacía es `sr-only`), así el primer mensaje que aparece se anuncia. El estado nunca es solo color.

```jsx
<FormActions dirty={f.cambios} motivoBloqueo={!f.sucio ? 'Aún no hay cambios que guardar' : undefined}>
    <Button variant="secondary" onClick={f.reiniciar}>Descartar</Button>
    <Button type="submit" disabled={!f.sucio} loading={f.enviando}>Guardar cambios</Button>
</FormActions>
```

### 4.2 `FormSection`

`<fieldset>` + `<legend>` (los lectores anuncian el grupo). Referencias: encabezados de sección y «(opcional)» de Square (campos R03), campos plegados de Shopify (campos R01), secciones con resumen (campos R17).

| Prop | Descripción |
|---|---|
| `title`, `description` | Encabezado y una línea de ayuda (`aria-describedby`). |
| `optional` | Agrega «(opcional)» al título (convención de SUSAN: se rotula lo opcional, no lo obligatorio). |
| `columns` | `1 \| 2 \| 3` **según el ancho del contenedor** (container queries: `@md` = 28 rem, `@2xl` = 42 rem). En 360 px siempre una columna; un `PanelLateral md` de 2 columnas cabe. Un campo ancho: `className="@md:col-span-2"`. |
| `collapsible`, `defaultOpen`, `summary` | El título pasa a ser un botón (`aria-expanded`/`aria-controls`) que pliega el contenido **sin desmontarlo** (no se pierde lo capturado). `summary` se muestra bajo el título mientras está plegada. |
| `error` | Hay un error dentro: marca «Revisar» (icono + texto) y **abre la sección al aparecer**, para que el foco al primer error alcance el campo. |

### 4.3 `Stepper`

Progreso de un flujo. Referencias: «Paso N de M» y barra segmentada de Calendly, Zillow, Gusto (flujos R1, R14); palomitas de Stripe y DoorDash (flujos R2, R7); en teléfono, la misma barra segmentada que `BarraPasos` del registro facial (`docs/design/SISTEMA.md`).

| Prop | Descripción |
|---|---|
| `steps` | `[{ id, label, description?, estado?, disabled? }]`; `estado`: `hecho \| actual \| pendiente \| error \| omitido` (se deduce de `current` si falta). `error` lleva icono, no solo color. |
| `current` | Id del paso actual (o su índice; un índice igual al total deja todo como hecho). |
| `onSelect(id)` | Hace clic en los pasos recorridos (hecho, error, omitido, actual); los pendientes y `disabled` no. |
| `compact` | `undefined`: barra segmentada + «Paso 2 de 4 · Horario» por debajo de 640 px y círculos con nombre desde ahí. `true`: siempre compacto (informativo, sin clic: un segmento de 6 px no es un blanco táctil). `false`: siempre ancho. |

Accesibilidad: `<nav aria-label="Progreso">` con `<ol>`; `aria-current="step"` en el actual; cada paso dice su estado en texto para lectores de pantalla («completado», «paso actual», «pendiente», «con errores», «omitido»); `Check` y `CircleAlert` de Lucide con `aria-hidden`. La `description` del paso actual se escribe bajo la barra. (El trazo del `Check` es 2,5 como el del `Onboarding` existente, no 1,75: un trazo fino se pierde sobre el círculo negro de 24 px.)

### 4.4 `SuccessState`

Hermano de `EmptyState`/`ErrorState`. Referencias: cierre de Klaviyo con tres tarjetas (flujos R9), confirmación breve de fal (flujos R4), anti-patrón de Dropbox Dash y Shopify (flujos §3.1), flujos P3.

| Prop | Descripción |
|---|---|
| `title`, `description` | Qué se creó, en una línea. |
| `steps` | `[{ label, description?, href \| onClick, icon?, tone?, recommended?, done? }]`: tarjetas «qué sigue» (`TarjetaFila`); `recommended` marca la más probable («Recomendado»); `done` la muestra hecha («Hecho») y sin acción. |
| `actions` | `[{ label, href \| onClick, variant?, icon? }]`: salidas cortas («Ir a la lista», «Crear otro»); la primera es primaria. |
| `icon` | Componente de Lucide o nodo; por omisión `CircleCheck` en círculo `bg-presente-bg`. |
| `focusOnMount` | `true` (por omisión): el foco va al título al aparecer (reemplaza a un formulario). Con `false` se anuncia como `role="status"`. |
| `wrap` | `false` (por omisión): título y descripción de cada paso en **una línea** con «…». `true`: hasta **2 líneas** (`line-clamp-2` + `break-words`) para textos como «Registrar el consentimiento firmado» a 360 px (F3 y F5 los acortaban a ≤ 25–30 caracteres). Cada paso puede traer su propio `wrap` (manda sobre el global). Se apoya en la prop `lineas` de `TarjetaFila` (`1` por omisión, `2`, `3` o `'todas'`; con más de una línea no lleva `truncate` ni `block`). |

**Regla: siempre 2–3 siguientes pasos** entre `steps` y `actions`. Grupo → Inscribir alumnos / Importar CSV / Configurar cámara / Ver grupo. Alumno → Tomar fotos de la plantilla / Inscribirlo a un grupo / Crear otro. Aula → Configurar cámaras / Asignar a un grupo. Docente → Crear cuenta de acceso. Justificante → Ver mis justificantes.

### 4.5 `BarraFiltros`

Búsqueda con retraso + filtros + chips de filtros activos + «Limpiar» + texto de resultado. Sustituye la barra copiada en `ListadoAlumnos`, `GruposTabla` y `CatalogoTabla` (sin botón «Buscar»). Referencias: chips de filtros activos de Shopify y fal (campos R01, R03), flujos P1.

| Prop | Descripción |
|---|---|
| `q`, `onQ(texto)` | Texto **aplicado** (controlado por la pantalla). `onQ` se llama 300 ms (`debounceMs`) después de la última tecla, al instante con Enter, y **al instante si el texto queda en 0 caracteres**. Un `q` que sea eco de lo que la barra acaba de emitir no pisa lo que la persona siguió escribiendo (importante con estado en la URL). |
| `placeholder`, `label` | Qué se busca («Matrícula o nombre»; es también el nombre accesible del campo) y el nombre de la región `role="search"`. |
| `filtros` | `[{ name, label, options: [{ value, label, count? }], value, onChange(valor), tipo?: 'select' \| 'pills', multiple?, todosLabel? }]`. `select` (por omisión) agrega «Todos» con valor `''`; `pills` con `multiple` usa arreglos. |
| `resultado` | «12 alumnos», región `aria-live`. |
| `onLimpiar` | Limpia texto y filtros. Sin él se limpia con `onQ('')` y el `onChange` de cada filtro activo. «Limpiar» solo aparece si hay algo activo. |

Teclado: Esc con texto lo borra (y no cierra un diálogo contenedor); Esc con la caja vacía deja pasar el evento. Cada chip lleva su botón «Quitar filtro Estatus: Baja».

```jsx
<BarraFiltros
    q={filtros.q}
    onQ={(q) => { setFiltros((f) => ({ ...f, q })); setPagina((p) => ({ ...p, offset: 0 })); }}
    placeholder="Matrícula o nombre"
    resultado={consulta.data ? `${consulta.data.total} alumnos` : undefined}
    filtros={[{ name: 'estatus', label: 'Estatus', options: ESTATUS_ALUMNO, value: filtros.estatus,
        onChange: (estatus) => { setFiltros((f) => ({ ...f, estatus })); setPagina((p) => ({ ...p, offset: 0 })); } }]}
/>
```

### 4.6 `MenuAcciones`

Menú «⋯» para acciones por fila (`EllipsisVertical` de Lucide). Patrón *menu button* de WAI-ARIA.

| Prop | Descripción |
|---|---|
| `items` | `[{ label, onClick, danger?, disabled?, icon? }]`. `danger` pinta en `text-destructive` (más el texto: nunca solo color). |
| `label` | Nombre accesible del botón («Acciones de Ana Pérez»); por omisión «Más acciones». |
| `align` | `'end'` (por omisión) o `'start'`. |

Teclado: Enter, Espacio o ↓ abren (↑ abre en el último); ↑ ↓ Inicio Fin mueven (saltan los deshabilitados y dan la vuelta); una letra salta al elemento que empieza con ella; **Esc** cierra y devuelve el foco al botón (y no cierra un diálogo contenedor); Tab cierra. Al elegir, el foco vuelve al botón **antes** de ejecutar la acción: si abre un diálogo, éste lo restaura al cerrarse. El menú se dibuja en un **portal** con `position: fixed` (no lo recorta el scroll horizontal de las tablas ni el transform de un diálogo), debajo del botón o, si no cabe, encima; se cierra con clic fuera y cuando el botón se mueve (scroll o cambio de tamaño).

### 4.7 `PanelLateral`

Panel que entra por la derecha (escritorio) o es pantalla completa (teléfono). Referencias: drawer «nuevo personaje» de fal con pie fijo (flujos R4, campos R03), panel de Sweatpals (flujos R15) y de Mintlify (flujos R6).

| Prop | Descripción |
|---|---|
| `open`, `onClose`, `title`, `description?` | Como `Modal`; `description` es una línea de ayuda (`aria-describedby`). |
| `children` | Cuerpo con su propio scroll (`overscroll-contain`). |
| `footer` | Nodo o `({ cerrar }) => nodo`. Pie **fijo** con borde y área segura; normalmente un `<FormActions flat>`. |
| `dirty`, `onDiscard`, `closeDisabled` | Igual que `Modal` (misma confirmación «¿Descartar los cambios?»). |
| `size` | `'sm'` (28 rem) \| `'md'` (32 rem, por omisión) \| `'lg'` (42 rem) en escritorio. |
| `showClose` (true), `closeOnOverlay` (true), `closeLabel`, `initialFocusRef`, `className` | |

Accesibilidad: `role="dialog"` `aria-modal`, foco atrapado y devuelto (`useDialog`, el mismo de `Modal`), Esc, foco inicial en el primer campo. Como `Modal`, se dibuja en un **portal a `document.body`** (§3.1): abierto desde una celda de tabla no hereda su `text-align` ni queda recortado, y no se dibuja en servidor ni al hidratar.

```jsx
const f = useFormulario({ inicial: INICIAL_AULA, validar: validarAula, onSubmit: async (v) => { await aulaGuardar(v); setAbierto(false); onGuardado(); } });

<PanelLateral
    open={abierto}
    onClose={() => setAbierto(false)}
    title="Nueva aula"
    description="Registra el aula y su capacidad."
    dirty={f.sucio}
    onDiscard={() => f.reiniciar()}
    closeDisabled={f.enviando}
    footer={({ cerrar }) => (
        <FormActions flat dirty={f.cambios}>
            <Button variant="secondary" onClick={cerrar}>Cancelar</Button>
            <Button type="submit" form="form-aula" loading={f.enviando}>Crear aula</Button>
        </FormActions>
    )}
>
    <form id="form-aula" onSubmit={f.enviar} noValidate>…</form>
</PanelLateral>
```

(`type="submit" form="form-aula"` es el truco que ya usan los modales de catálogo: el pie queda fuera del `<form>`.) Como `enviar` marca lo enviado como guardado al terminar bien, `setAbierto(false)` dentro de `onSubmit` no pregunta nada.

### 4.8 `Asistente`

Cascarón de asistente de N pasos para altas con dependencias o más de ~6 campos. Referencias: pasos con palomitas y **revisión editable por sección** de Stripe (flujos R7), «Paso N de M» con resumen vivo de Zillow (flujos R14), pie con Atrás/Siguiente de Klaviyo (flujos R9), cierre con siguientes pasos (flujos P3), reglas flujos P2 y P10.

**No guarda el estado de los campos**: eso lo hace `useFormulario` en la pantalla; el asistente recibe `valores` y, al final, llama a la **misma RPC de siempre** con `onFinalizar`. Funciona en una página, un `PanelLateral` o un `Modal` (dentro de un contenedor adopta solo su cierre y pega sus acciones al borde del contenedor).

| Prop | Descripción |
|---|---|
| `pasos` | `[{ id, titulo, descripcion?, contenido, opcional?, etiquetaSiguiente? }]`. `contenido` es un nodo o `({ irAPaso, indice, total }) => nodo`. **No metas un `<form>` dentro**: el asistente envuelve cada paso en uno (Enter avanza). |
| `valores` | Valores actuales (para el resumen y `onFinalizar`). |
| `validarPaso(id)` | Al pulsar «Siguiente». `true`/`undefined` = avanza; `false`, un texto o `{ campo: 'mensaje' }` = se queda, enfoca el primer campo con `aria-invalid` y muestra el resumen «Revisa este paso antes de continuar». **El botón nunca se apaga por datos inválidos** (flujos P10). Con `useFormulario`: `(id) => f.validarCampos(CAMPOS[id]) \|\| f.erroresDe(CAMPOS[id])`. |
| `resumen(valores)` | `[{ id?, titulo, paso?, filas: [{ etiqueta, valor }] }]`. Si se da, hay un **paso final de revisión** con una tarjeta por sección y un «Editar» (nombre accesible «Editar <sección>») que vuelve al paso `paso`; lo vacío se escribe «Sin especificar». Sin `resumen` no hay revisión y el último paso ya crea. |
| `onFinalizar(valores)` | `Promise`. Si lanza se muestra «No se pudo completar» con el mensaje y se conserva todo. Se revalidan todos los pasos antes de llamar; si uno quedó inválido, vuelve a él. No permite doble envío. |
| `exito` | Props de `SuccessState`, o `(resultado) => props` con lo que devolvió `onFinalizar` (para armar `href`s con el id nuevo). Tras terminar bien reemplaza al asistente. |
| `etiquetaFinalizar` | Verbo + objeto: «Crear grupo» (nunca «Siguiente» ni «Aceptar» en el último paso). |
| `sucio` | Hay cambios sin guardar: `beforeunload` y confirmación «¿Salir sin guardar?» al cancelar (en un contenedor, usa el `dirty` del contenedor). |
| `onCancelar` | Muestra «Cancelar» en el primer paso. En un contenedor se usa su cierre. |
| `resumenLateral` | Resumen vivo a la derecha **solo en pantallas anchas** (`lg`) y en páginas; dentro de un panel o modal déjalo apagado. |
| `ref` | **Saltar de paso desde fuera**: `ref.current.irAPaso(id)` lleva al paso `id` (o a la revisión con `'revision'`) y devuelve `true`; `false` si el id no existe, no hay revisión o el asistente ya terminó. No valida (es decisión de quien llama), actualiza el Stepper, enfoca el título y conserva todo lo capturado. Caso típico: `onFinalizar` falla con `DUPLICADO` y hay que volver al paso del dato (reemplaza el truco de guardar `irAPaso` en un ref desde un hijo del paso, `GuardaIrAPaso` en `AltaAlumno`). El `contenido` del paso sigue recibiendo `irAPaso`. |
| `tituloRevision`, `descripcionRevision`, `label`, `sticky`, `className` | `sticky` se pasa a `FormActions` (por omisión `'movil'` en páginas y `'contenedor'` dentro de un contenedor). |

Comportamiento: Stepper arriba (compacto en teléfono); al cambiar de paso el foco va al título y un texto `aria-live` dice «Paso N de M: título»; «Atrás» no valida; **«Omitir por ahora»** en pasos `opcional` (queda «omitido» en el Stepper); tras «Editar» desde la revisión el botón principal es «Volver a la revisión» (valida el paso que se editó); con el Stepper se puede volver a pasos hechos, y saltar adelante solo a pasos ya recorridos y con el actual válido.

```jsx
const CAMPOS = { datos: ['materia', 'docente'], aula: ['aula'] };
const f = useFormulario({ inicial: { materia: '', docente: '', aula: '' }, validar: validarGrupo });

<Asistente
    pasos={[
        { id: 'datos', titulo: 'Materia y docente', descripcion: 'Qué se imparte y quién lo imparte', contenido: <PasoDatos f={f} /> },
        { id: 'aula', titulo: 'Aula y horario', contenido: <PasoAula f={f} /> },
    ]}
    valores={f.valores}
    sucio={f.sucio}
    validarPaso={(id) => f.validarCampos(CAMPOS[id]) || f.erroresDe(CAMPOS[id])}
    resumen={(v) => [
        { id: 'datos', titulo: 'Materia y docente', paso: 'datos', filas: [{ etiqueta: 'Materia', valor: v.materia }, { etiqueta: 'Docente', valor: v.docente }] },
        { id: 'aula', titulo: 'Aula', paso: 'aula', filas: [{ etiqueta: 'Aula', valor: v.aula }] },
    ]}
    onFinalizar={(v) => grupoGuardar(v)}
    etiquetaFinalizar="Crear grupo"
    exito={(grupo) => ({
        title: `Grupo ${grupo.clave_grupo} creado`,
        steps: [
            { label: 'Armar el horario', href: `/admin/grupos/${grupo.id_grupo}?tab=horario`, recommended: true },
            { label: 'Inscribir alumnos', href: `/admin/grupos/${grupo.id_grupo}?tab=inscripciones` },
        ],
        actions: [{ label: 'Ir a la lista', href: '/admin/grupos' }],
    })}
    onCancelar={() => router.push('/admin/grupos')}
    resumenLateral
/>

// Saltar de paso desde fuera, p. ej. al fallar onFinalizar:
const asistente = useRef(null);
<Asistente ref={asistente} onFinalizar={async (v) => { try { return await grupoGuardar(v); } catch (e) { if (e.code === 'DUPLICADO') asistente.current?.irAPaso('datos'); throw e; } }} … />
```

## 5. Textos fijos (las pruebas de las pantallas pueden apoyarse en ellos)

| Dónde | Texto |
|---|---|
| Descarte (`Modal`, `PanelLateral`) | Título «¿Descartar los cambios?»; «Hay cambios sin guardar. Si sales ahora, se perderán.»; botones «Seguir editando» y «Descartar cambios» |
| Botón X | `aria-label` «Cerrar» (`closeLabel`) |
| `ConfirmDialog.reason` requerido | «Escribe el motivo para continuar.»; etiqueta por omisión «Motivo» |
| `FormActions` | «Cambios sin guardar», «1 cambio sin guardar», «N cambios sin guardar» |
| `BarraFiltros` | Región «Buscar y filtrar» (por omisión), «Borrar búsqueda», «Limpiar», lista «Filtros activos», «Quitar filtro <filtro>: <valor>» |
| `Asistente` | «Siguiente», «Atrás», «Cancelar», «Omitir por ahora», «Volver a la revisión», «Revisa este paso antes de continuar», «Completa los campos marcados.», «No se pudo completar», «Revisión», «Editar <sección>», «Sin especificar», «¿Salir sin guardar?» |
| `SuccessState` | «Siguientes pasos», «Recomendado», «Hecho» |
| `MenuAcciones` | «Más acciones» (por omisión) |
| `useCambiosSinGuardar` | «Tienes cambios sin guardar. Si sales ahora, se perderán.» |

## 6. Otras ampliaciones de la pasada de arreglos (F1-fix)

- **`Table.hideBelow`** admite `'sm' | 'md' | 'lg' | 'xl'` (clases completas y estáticas: `hidden lg:table-cell`, `hidden xl:table-cell`). Con el riel lateral las columnas secundarias necesitan `lg`/`xl` (F4 usaba `className="hidden xl:table-cell"`: ya se puede pasar `hideBelow="xl"`).
- **`TarjetaFila`** (`ui/TarjetaFila`): prop `lineas` (`1` por omisión, `2`, `3`, `'todas'`) para título y subtítulo; sin ella conserva `truncate`. Consumidores existentes (`EstadoCamaras`, `PasoGuia`, `ResumenAdmin`, `AlertasAsistencia`, `MisGrupos`, `SesionesHoy`) no cambian.
- **`hooks/ui/useMontadoEnCliente`**: `false` en servidor e hidratación, `true` desde el primer render del navegador; úsalo para cualquier portal a `document.body`.

## 7. `requests` para el lead e integrador

1. **Layout (`components/layout/**`, fuera de mi zona)**: pasar `onNavigate={alNavegarProtegido}` (de `@/hooks/ui/useCambiosSinGuardar.js`) a los `<Link>` de `Sidebar`, `BottomNav`, `TopbarMovil` y los de `PaletaComandos`/`MenuCuenta`, para que un formulario sucio también proteja la navegación interna. Sin eso solo hay `beforeunload` (recargar/cerrar) y los enlaces propios del formulario.
2. **`FormActions sticky="movil"`** depende del alto de `BottomNav` (`5.25rem` + `max(0.75rem, área segura)`, en `formActions.utils.js`). Si la barra inferior cambia de alto, actualizar esa constante. **Y de `html, body { overflow-x: clip }`** en `globals.css` (ver §4.1): con `hidden` no se pega fuera de `AppShell`.
3. **Decisión: `Modal.showClose` es `false` por omisión** (compatibilidad: no agrega un botón a diálogos existentes). Los formularios deben pasar `showClose` (con `size="full-mobile"` aparece sola). Se puede invertir el valor cuando las cinco pantallas hayan migrado.
4. **`docs/design/SISTEMA.md`**: enlazar este archivo (y el de F1a) desde una sección «Formularios». `Onboarding` puede migrar a `Stepper` (F2): ojo, su prueba busca `aria-label="Progreso"` en el `<ol>` y `Stepper` lo pone en el `<nav>`; hay que actualizar esa prueba al migrar.
5. **Contornos de los frentes que ya se pueden quitar** (no se tocaron: son pantallas ajenas): `useAltaCatalogo.campo` (F4, ignorar el blur de campos no editados: la causa en `useDialog` está corregida); `text-left` en la celda de acciones de F4 (los diálogos ya van en portal); `className="w-full [&>button]:flex-auto [&>button]:px-2.5"` de `CamarasEstado` (F2: ahora basta `fullWidth`); `sm:!flex-col sm:!items-stretch` de `CamaraForm` y los dos `FormActions` de F4 (`stacked`); `GuardaIrAPaso` de `AltaAlumno` (F3: `ref.irAPaso`); el contenedor `display: contents` con `data-campo` y la búsqueda por DOM de F5 (`Combobox` ya tiene `onBlur`, `ref` y `autoFocus`); títulos de ≤ 25 caracteres de los siguientes pasos de F3/F5 (`SuccessState wrap`); `className="hidden xl:table-cell"` de F4 (`hideBelow="xl"`).
6. **Sin cambios necesarios** en `package.json`, RPC ni rutas. `globals.css` ya trae el `overflow-x: clip` (cambio del lead).
