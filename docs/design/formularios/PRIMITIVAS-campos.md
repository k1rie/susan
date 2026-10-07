# Primitivas de campo (`components/ui/*` + `lib/formularios`)

Contrato de las piezas de **campo** del rediseño de formularios (frente F1a). Los contenedores (`FormActions`, `FormSection`, `Stepper`,
`SuccessState`, `BarraFiltros`, `MenuAcciones`, `PanelLateral`, `Asistente`) y los hooks (`useFormulario`, `useCambiosSinGuardar`,
`useDebounce`) son del frente F1b y se documentan aparte. Origen de cada decisión: [`referencias-campos-y-validacion.md`](./referencias-campos-y-validacion.md)
(R = referencia de Mobbin, P = patrón recomendado, A = anti-patrón) y [`auditoria.md`](./auditoria.md).

Todo cumple las reglas de `CLAUDE.md`: solo tokens semánticos, iconos Lucide con `aria-hidden`, 360 px sin desborde (verificado a 360 px en navegador),
foco visible `ring-4`, movimiento solo `transform`/`opacity` y apagado con «reducir movimiento», **sin dependencias nuevas**.

## 0. Cómo se combinan

```jsx
import Field from '@/components/ui/Field';
import Input from '@/components/ui/Input';
import Combobox from '@/components/ui/Combobox';

<Field label="Matrícula" required example="E260099" hint="Letras y dígitos." valid={ok} error={errores.matricula} reserveError>
    <Input value={v.matricula} onChange={cambiar('matricula')} maxLength={LIMITES.matricula} showCount transform="upper" />
</Field>

<Field label="Materia" required error={errores.id_materia}>
    <Combobox options={materias} value={v.id_materia} onChange={(valor) => poner('id_materia', valor)} />
</Field>

<Field as="fieldset" label="Estatus" optional>
    <SegmentedControl label="Estatus" items={ESTATUS} value={v.estatus} onChange={(valor) => poner('estatus', valor)} />
</Field>
```

- `Field` clona su **único hijo** con `id`, `aria-describedby`, `aria-invalid` y `required`. Todas las piezas de campo de abajo aceptan esos cuatro
  (en el `<input>`/botón que se enfoca, no en el contenedor).
- Para **grupos** (segmentado, tarjetas, rango de fechas, casillas sueltas) usa `Field as="fieldset"`: la etiqueta pasa a `<legend>`, el hijo no se clona y
  la ayuda/el error cuelgan del `<fieldset>` con `aria-describedby`. Un `<label for>` no etiqueta un `div role="radiogroup"`.

### Qué recibe `onChange` (importante al integrar)

| Pieza | `onChange` recibe | Por qué |
|---|---|---|
| `Input`, `Textarea`, `Select`, `Checkbox`, `CampoPassword`, `CampoFecha` | **el evento** (`e.target.value` / `e.target.checked`) | Son controles de texto: reemplazo directo de los actuales. «Generar» contraseña, los atajos de fecha y `transform` escriben en el `<input>` nativo y disparan un evento real (`lib/formularios/dom.js`, `emitirCambio`), así que la firma no cambia. |
| `Combobox` | `(valor, opción)`; al limpiar `('', null)` | Es una elección, no texto. |
| `SegmentedControl`, `TarjetaOpcion` | `(valor)` | Ídem. |
| `Switch` | `(checked: boolean)` | Efecto inmediato; el valor nuevo, no un evento. |
| `RangoFechas` | `({ desde, hasta })` | Un par. |
| `FileInput` | `onSelect(file \| null)`; en `multiple`: `onSelect(File[])` (la lista completa) | Compatibilidad con los usos actuales. |

Los valores de opción se comparan **por texto** (`3` y `'3'` son la misma opción) porque los selects nativos devuelven texto.

---

## 1. `ui/Field` (ampliado, compatible)

Mismas props de antes (`label, hint, error, required, htmlFor, children, className`) más:

| Prop | Efecto |
|---|---|
| `optional` | «(opcional)» dentro de la etiqueta. Convención del producto (A07): lo opcional se rotula con la palabra; lo obligatorio conserva el `*`. Si hay `required`, `optional` se ignora. |
| `valid` | `true` o un texto: palomita Lucide + «Válido» (`role="status"`, `text-presente`). Solo para datos que la persona no puede comprobar a ojo (matrícula, correo, periodo); no marques válidos los textos libres (P1.3). Se oculta si hay `error`. |
| `example` | «Ej. X» al final de la ayuda (`'E260099'` o `'Ej. E260099'`). |
| `counter` | `{ actual, max, desde? }` → «n/max» a la derecha; con `desde` (0–1) aparece al llegar a esa fracción (P1.5: 0.8). Solo anuncia a lectores de pantalla el límite alcanzado, no cada tecla. En rojo si se excede. |
| `labelAction` | Nodo a la derecha de la etiqueta («¿Olvidaste tu contraseña?»). |
| `reserveError` | Reserva el alto de una línea para error/válido: el formulario no «salta» al validar. Opcional para no cambiar las pantallas existentes; actívalo en formularios con validación al salir del campo. |
| `as="fieldset"` | Ver arriba. |

- **Cambio visible por omisión**: el error lleva un icono Lucide `CircleAlert` delante del texto (R06: borde + icono + texto; A08). El texto y `role="alert"` no cambian.
- **Hijo compuesto que pinta los mensajes él mismo** (`Componente.recibeMensajes = true`, hoy solo `CampoPassword`): `Field` no repite ayuda/error/«Válido» después del hijo, se los pasa en la prop `mensajes` y el hijo los coloca justo bajo su caja. Sin la marca, todo sigue como antes (los mensajes van después del hijo).
- Estados: normal · con ayuda · con error · válido · con contador.
- Accesibilidad: `aria-describedby` encadena ayuda → error → válido (y conserva el del hijo); el error es `role="alert"`.
- Respaldo: P1, R03 (pistas), R04 (palomita), R06 (error con icono).

## 2. `ui/Input` (ampliado)

Props nuevas (sin ellas el DOM es el de siempre: un solo `<input>`):

| Prop | Efecto |
|---|---|
| `startAdornment` | Nodo a la izquierda, dentro del borde (icono de búsqueda). |
| `onClear` | X (Lucide) cuando hay texto; llama a `onClear()` y devuelve el foco al campo. `clearLabel` cambia el nombre accesible («Limpiar campo»). No aparece en `disabled`/`readOnly`. |
| `showCount` + `maxLength` | «n/max» **dentro** del campo (no ocupa otra línea, no mueve el diseño) y aviso sr-only al llegar al límite. Solo en campos controlados (`value`). |
| `transform` | `'upper' \| 'lower' \| 'trim'` o `(valor) => valor`. Se aplica **al salir** del campo (nunca mientras se escribe) y llega a `onChange` como evento real; luego se llama a tu `onBlur`. Usa `LIMITES` y `mayusculas` para matrícula/claves, `minusculas` para correo. |
| `valid` | Palomita a la derecha + «Válido» sr-only. `invalid` manda sobre `valid`. |

- `invalid` ahora también pone `aria-invalid` (antes solo el borde). **El borde rojo se conserva con el campo enfocado** (`CONTROL_INVALIDO`, exportado junto a `CONTROL_BASE`: `focus-visible:border-destructive!` y anillo `destructive/20`): antes `focus-visible:border-ring` lo pintaba de azul justo cuando la persona volvía a corregirlo (p. ej. el motivo de `ConfirmDialog` tras confirmar vacío). Lo usan `Input`, `Textarea`, `Select` y `Combobox`.
- `endAdornment`, `className` (va al contenedor si hay adornos) y `CONTROL_BASE` no cambian.
- Respaldo: R03 (X para limpiar, contador «1/20»), P1.5, complemento «Input con `mask`» (aquí como `transform`), A11 (nada de validar al teclear).

## 3. `ui/Select` (ampliado)

`options`, `placeholder` y `children` intactos. Nuevo: `groups` (`[{ label, options }]` → `<optgroup>`, después de las `options` sueltas) y el control ahora es
`appearance-none` con `ChevronDown` de Lucide (mismo aspecto en todas las plataformas; el selector del sistema operativo sigue siendo el nativo).

- **Compatibilidad**: ahora hay un contenedor `relative` alrededor del `<select>`. Las clases de diseño que ya pasaban los consumidores en `className` (`w-*`, `max-w-*`,
  `min-w-*`, márgenes, `flex-*`, `col-*`, `z-*`…, con variantes y `!`) se reparten al contenedor y el resto (texto, alto…) sigue en el `<select>`
  (`select.utils.js`, `repartirClases`). `ref`, `id`, `aria-*`, `value`/`onChange` y el resto de props siguen yendo al `<select>`.
- `multiple` o `size > 1` es una lista: sin chevron.
- Para listas largas o con identidad usa `Combobox` (A12).

## 4. `ui/Textarea` (ampliado)

Nuevo: `autoGrow` (el alto sigue al contenido desde `rows` hasta `maxRows`; después aparece el scroll) y `invalid` ahora pone `aria-invalid`.
`showCount` + `maxLength` conservan su contador `n/max` con `aria-live="polite"`. El `ref` del consumidor se respeta (React 19: prop `ref`).

## 5. `ui/Checkbox` (ampliado)

Nuevo: `error` (mensaje `role="alert"` bajo la casilla, enlazado con `aria-describedby`) e `invalid` (solo marca). Para acuses obligatorios («He leído el aviso de
privacidad»): respaldo R05 (error espejado). Fila táctil de 44 px, `hint` e `indeterminate` como antes. Para ajustes de efecto inmediato usa `Switch`.

## 6. `ui/FileInput` (ampliado)

`variant="boton"` (por omisión) conserva exactamente su DOM y comportamiento (botón + nombre + «Quitar»; `onSelect(file | null)`; mensajes de error iguales).

| Prop | Efecto |
|---|---|
| `variant="zona"` | Zona punteada: arrastrar y soltar, clic en **cualquier parte** y teclado (el `<input type="file">` queda visualmente oculto pero enfocable: Tab, Enter/Espacio). El foco se ve en toda la zona. |
| `multiple`, `maxFiles` | `value` y `onSelect` pasan a arreglos (`onSelect` recibe la lista completa). Repetidos se descartan en silencio; los que sobran del tope se avisan («Solo se admiten 3 archivos: sobraron 2.»). Al llegar al tope, la zona deja de aceptar y lo dice. |
| `hint` | Reglas visibles **antes** de elegir. En la zona, si se omite, se deducen de `accept`/`maxBytes`/`maxFiles`: «PDF, JPG o PNG. Máximo 5 MB.»; `hint={false}` las oculta. En `boton` solo aparece si se pasa. |
| `progress` | 0–100 (o `null`): barra `role="progressbar"` (solo `transform`), texto «Subiendo… 40 %» (el lector de pantalla oye «Subiendo…» una vez, no cada porcentaje) y bloquea elegir, soltar y quitar. |
| `preview` | `'nombre'` (por omisión: icono, nombre y tamaño) o `'imagen'` (miniatura con `FileReader`; la CSP ya admite `data:`). |
| `id`, `aria-labelledby`, `aria-describedby`, `aria-invalid`, `required` | Para `Field`. En `zona` van al `<input>`; en `boton`, al botón (lo enfocable). `required` se expone como `aria-required`, **no** como atributo nativo (el input se vacía tras elegir y sería imposible de cumplir). |
| `capture` | Sin cambios (cámara del teléfono para fotos). |

- Estados de la zona (`data-estado`): `vacio` · `arrastrando` (borde sólido, «Suelta para agregar») · `cargando` · `error` (borde destructivo + mensajes `role="alert"`, uno por archivo en `multiple`) · `listo`.
- Un archivo rechazado en modo sencillo **vacía** la selección (`onSelect(null)`), como siempre.
- Respaldo: R10 (zona + reglas visibles), R12 (reglas, miniatura, estados), P4, A04 (resaltar la zona afectada, no solo un banner).
- Pendiente (no es de F1a): migrar `SubidaFotosPlantilla` a `multiple` cuando el asistente facial tenga commit.

---

## 7. `ui/Combobox` (nuevo)

Selector con búsqueda (sin acentos ni mayúsculas) hecho a mano, patrón ARIA 1.2 «combobox editable con lista» como `PaletaComandos`.

```jsx
<Combobox
    options={[{ value: 12, label: 'Álgebra Lineal', description: 'ALG101 · 3 créditos', group: 'Matemáticas' }]}
    value={idMateria}
    onChange={(valor, opcion) => setIdMateria(valor)}
    clearable
    placeholder="Elige una materia"
/>

// Remoto (inscribir alumno): busca a partir de 2 caracteres, espera 250 ms y cancela la petición anterior.
<Combobox
    loadOptions={(q, { signal }) => alumnosBuscar({ q, signal })}
    onChange={(id, alumno) => inscribir(id)}
    placeholder="Matrícula o nombre"
/>
```

| Prop | Detalle |
|---|---|
| `options` | `[{ value, label, description?, group?, disabled?, avatar? }]`. Filtra en memoria por **todas** las palabras sobre título, descripción y grupo; el título que empieza con la consulta va primero. `avatar` = nombre para las iniciales (`ui/Avatar`). La descripción sirve también para el motivo de una opción deshabilitada («Ya inscrito en 3A»). |
| `loadOptions(q, { signal })` | Remoto (excluye `options`): `debounceMs` 250, `minChars` 2, `AbortController` por consulta (la respuesta vieja nunca pisa a la nueva). Pasar una función nueva en cada render no reinicia la búsqueda. |
| `loadKey` | Al cambiar invalida lo cargado (p. ej. el periodo elegido en otro campo). |
| `value` / `defaultValue` / `onChange(valor, opcion)` | Controlado o no. Vacío = `''`. Limpiar llama a `onChange('', null)`. |
| `selected` | `{ value, label }`: la etiqueta de lo ya elegido cuando las opciones aún no están cargadas (modo remoto o catálogo que llega después). En modo remoto, lo que se elige se recuerda solo. |
| `clearable` | Botón «Quitar selección» (enfocable: es la vía de teclado para limpiar). |
| `placeholder`, `emptyText` («Sin resultados»), `loadingText` («Buscando…»), `errorText`, `hintText` («Escribe al menos N caracteres para buscar.») | Textos. El error remoto ofrece «Reintentar». |
| `renderOption(opcion, { activa, seleccionada })` | Reemplaza el **contenido** de la opción (la fila, el alto y la palomita de seleccionada siguen siendo del componente). |
| `invalid`, `required`, `disabled`, `id`, `name`, `aria-*` | `name` agrega un `<input type="hidden">` con el valor **y marca el contenedor con `data-campo-nombre`** (así `enfocarPrimerError` de `useFormulario` encuentra el campo de texto). Con `Field` basta el hijo. |
| `onBlur(e)` | Se llama al **salir del conjunto** campo + «Quitar selección» + lista, no al pasar de uno a otro ni al elegir una opción con el ratón (la lista no roba el foco). Es el `onBlur` que entrega `useFormulario().campo(...).props`: validar al salir ya no necesita un contenedor `display: contents` y escuchar el foco por DOM. |
| `ref` | Apunta al `<input>` de texto (`.focus()`); se combina con el interno (`useImperativeHandle`). |
| `autoFocus` | Enfoca el campo de texto al montar. |

- Teclado: ↓/↑ abren o mueven (saltan las deshabilitadas y dan la vuelta; el orden es el **visual**, también con grupos), Enter elige y **no envía** el formulario con la lista abierta,
  Esc cierra **solo la lista** (hace `stopPropagation`: dentro de un `Modal` el segundo Esc es el que cierra el diálogo; verificado en navegador), Tab sale. Alt+↓ abre sin mover.
  Al enfocar se selecciona el texto: escribir reemplaza la etiqueta elegida.
- Ratón/táctil: opción de **≥ 44 px** (`min-h-11`), el botón del chevron abre/cierra (no es parada de tabulador), pulsar una opción no roba el foco.
- Posición: la lista va en un **portal** con `position: fixed` (no la recorta el scroll de un modal; z-70 por encima de diálogos y paleta). `calcularPosicionLista` la acota a la región
  visible (`visualViewport`, que en el teléfono baja con el teclado): abre hacia abajo salvo que haya menos de 160 px libres y arriba quepa más, el ancho nunca pasa de la pantalla menos 8 px por lado y se
  vuelve a medir al desplazar o redimensionar.
- Lectores de pantalla: `role="combobox"`, `aria-expanded`, `aria-controls` (solo abierto), `aria-activedescendant`, `aria-autocomplete="list"`; opciones `role="option"` con `aria-selected` real (la elegida)
  y `aria-disabled`; grupos con nombre; una región `role="status"` anuncia «N opciones disponibles», «Buscando…», el vacío o el error.
- Más de ~200 opciones o catálogos paginados: usa `loadOptions` (la RPC ya filtra por `q`).
- Respaldo: R02 (buscador en el desplegable, dos líneas, atajos de teclado), R06 (avatar), P3, A12 (adiós al select largo), A01 (el error cuelga del campo vía `Field`).

## 8. `ui/SegmentedControl` (nuevo)

De 2 a 5 opciones excluyentes visibles a la vez (estatus, tipo, rol, estado P/R/A). `role="radiogroup"` + `role="radio"` con una sola parada de tabulador; las flechas
mueven el foco **y** eligen; Inicio/Fin a los extremos; salta las deshabilitadas. No es `Pills` (filtros con `aria-pressed`) ni `Tabs`.

```jsx
<SegmentedControl
    label="Estado de asistencia"
    items={[
        { value: 'presente', label: 'Presente', tone: 'presente' },
        { value: 'retardo', label: 'Retardo', tone: 'retardo' },
        { value: 'ausente', label: 'Ausente', tone: 'ausente' },
    ]}
    value={estado}
    onChange={setEstado}
    size="sm"
/>
```

| Prop | Detalle |
|---|---|
| `items` | `[{ value, label, icon?, tone?, disabled? }]`; `icon` = componente Lucide; `tone` = `presente \| retardo \| ausente \| justificado \| pendiente`. |
| Tonos | **Siempre texto + color**: sin elegir, punto de color; elegida, fondo/borde del estado y una **palomita** (señal que no depende del tono). Sin tono, la elegida va en tinta (`bg-foreground`). |
| `size` | `sm` (36 px, listas densas) · `md` (44 px, por omisión). |
| `fullWidth` | Ocupa el ancho. Cada opción parte del ancho de su texto y se reparten el sobrante (`flex-auto`, `min-w-0`, relleno `px-2`/`px-2.5` en lugar de `px-3`/`px-4`); el texto largo se parte en dos líneas y una palabra más larga que el segmento se corta (`break-words`) en vez de salirse. A 360 px «Mantenimiento» y «En mantenimiento» caben sin ajustes (medido en navegador: antes `flex-1` + `px-3` dejaba la palabra 6 px fuera de su tercio). Quien ya afinó con `className="w-full [&>button]:flex-auto [&>button]:px-2.5"` sigue igual (esa variante gana por especificidad). Sin `fullWidth`, si no cabe, el control desplaza horizontalmente por dentro. |
| `label` | `aria-label` del grupo (o `aria-labelledby`; dentro de `Field as="fieldset"` basta la leyenda). `name` agrega un campo oculto **y marca el grupo con `data-campo-nombre`** (para el foco al primer error). `aria-invalid` va en el grupo. |

Respaldo: R07 y R08 (segmentados en lugar de selects), P6, R14 (estado con punto de color y texto), A08.

## 9. `ui/Switch` (nuevo)

`role="switch"` para ajustes de **efecto inmediato** («Reconstrucción completa», activo/inactivo). Pulsar el texto también alterna; Espacio/Enter con el teclado.

```jsx
<Switch label="Cámara activa" hint="Deja de capturar mientras esté apagada." checked={activa} onChange={setActiva} onLabel="Activa" offLabel="Inactiva" />
```

`onChange(checked: boolean)`. Escribe el estado con texto junto al control (`showState`, «Activado»/«Desactivado»; R18, A08). `name` agrega un campo oculto `true/false`. Pista de 44 px de alto,
solo `transform` en el pulgar. Respaldo: R18 (Dropbox: interruptor con «Activado»), R05.

## 10. `ui/CampoFecha` (nuevo)

`<input type="date">` con `min`/`max`, atajos y la fecha escrita en palabras bajo el campo («lunes, 5 de octubre de 2026»), porque el selector nativo cambia de formato con el sistema
operativo. No hay calendario propio (decisión de la auditoría §4.4).

```jsx
<Field label="Vigente hasta">
    <CampoFecha
        value={v.hasta}
        onChange={cambiar('hasta')}
        min={v.firma}
        atajos={[{ label: '+1 año', valor: () => sumarAnios(v.firma, 1) }, { label: '+2 años', valor: () => sumarAnios(v.firma, 2) }]}
    />
</Field>
```

- `atajos`: `[{ label, valor: 'AAAA-MM-DD' | ({ actual, hoy }) => 'AAAA-MM-DD' }]`; por omisión solo «Hoy» (`ATAJO_HOY`), `atajos={[]}` los quita. **Se ocultan** los atajos que dan una fecha inválida o fuera
  de `min`/`max` (A05: nada de botones que no se pueden aplicar). Aplicar un atajo dispara el mismo `onChange` (evento) y deja el foco en el campo.
- `hoy`: la fecha que usa «Hoy». Sin ella se usa la del navegador **después de hidratar** (`useHoy`: el servidor no conoce la zona horaria, así que el atajo aparece justo tras la hidratación;
  pasa `hoy` si necesitas que salga ya o que coincida con el servidor/el reloj de demostración).
- `mostrarTexto={false}` quita la fecha en palabras. Para el mensaje de error usa `validarFecha(valor, { min, max, requerida })` (`campoFecha.utils.js`) con `Field error`.
- Respaldo: R09 y P9 (atajos, texto del resultado), A05.

## 11. `ui/RangoFechas` (nuevo)

Par «desde / hasta» como `<fieldset>`: validación **cruzada** (desde ≤ hasta), límites, tope de largo y atajos de rango.

```jsx
<RangoFechas label="Generar sesiones" desde={v.desde} hasta={v.hasta} onChange={({ desde, hasta }) => setV({ ...v, desde, hasta })} min={inicioPeriodo} maxDias={366} />
```

- `onChange({ desde, hasta })` con el par ya armado. Los límites nativos de cada campo siguen al otro extremo (el selector no deja elegir un «desde» posterior al «hasta»).
- Errores (`role="alert"`, ambos campos `aria-invalid`, enlazado al `<fieldset>`): «La fecha inicial debe ser anterior o igual a la final.», fuera de `min`/`max`, «El rango no puede pasar de N días.»
  `error` externo (servidor) manda sobre la validación local. La misma lógica está en `validarRango(par, { min, max, maxDias, requerido })` (`rangoFechas.utils.js`) para validar al enviar.
- `atajos`: por omisión «Últimos 7 días» y «Últimos 30 días» (contando hoy); builders `rangoUltimosDias(n)` y `rangoProximosDias(n)`; el que coincide con el rango actual lleva `aria-pressed`. Se ocultan los que salen de `min`/`max`.
- Resumen en texto (`resumen`, por omisión): «1 oct 2026 al 30 oct 2026 · 30 días». `labelDesde`/`labelHasta` («Desde»/«Hasta»), `required` marca ambos.
- 360 px: los dos campos se apilan; desde `sm`, lado a lado. Respaldo: R09, P9, A05.

## 12. `ui/CampoPassword` (nuevo)

Reemplazo directo de `auth/PasswordInput` (misma firma de `onChange`) con guía: mostrar/ocultar, requisitos **en vivo** con icono + texto, «N de 3 requisitos», aviso de Bloq Mayús y, opcionales, «Generar» y «Copiar».
Sin campo de confirmación (A06): con «Mostrar» y la lista sobra el doble tecleo.

```jsx
<Field label="Contraseña nueva" required>
    <CampoPassword value={v.nueva} onChange={cambiar('nueva')} />
</Field>

<Field label="Contraseña temporal"><CampoPassword value={v.clave} onChange={cambiar('clave')} generar copiar /></Field>
```

- **Dentro de `Field`**: el error (y la ayuda y el «Válido») se pintan justo **debajo de la caja**, antes del aviso de Bloq Mayús, «Generar»/«Copiar» y la lista de requisitos (`CampoPassword.recibeMensajes`, ver §1); antes quedaban al final de toda la pieza.
- `ref`: apunta al `<input>`; se combina con el interno que usa «Generar» (antes, pasar `ref` pisaba el interno y «Generar» fallaba).
- `reglas`: `[{ id, texto, test(valor) }]`; por omisión las **3 reglas reales** (≥ 10 caracteres, una letra, un número), copiadas de `auth/CambiarContrasenaForm/contrasena.utils.js` a `campoPassword.utils.js`
  (`ui/` no importa de `auth/`); la prueba `campoPassword.utils.test.js` falla si las dos se desalinean. `reglas={false}` o `[]` quita la lista (inicio de sesión: `autoComplete="current-password"`).
- La lista describe el campo (`aria-describedby`) y cada regla dice «(cumple)» / «(falta)» para lectores; la barra de 3 segmentos es decorativa. Las reglas no son errores: sin color rojo (R04).
- «Generar»: `generarContrasena` (16 por omisión, mínimo 12, una mayúscula, minúscula, dígito y símbolo, sin caracteres ambiguos `0/O/1/l/I`, `crypto.getRandomValues` con muestreo sin sesgo); la muestra en claro y llama
  `onChange` con un evento real (+ `onGenerar(valor)`). «Copiar»: portapapeles con aviso «Copiada» 2 s (o «No se pudo copiar…» si falla); deshabilitado sin contraseña. Nunca se registra la contraseña.
- Bloq Mayús: «Bloq Mayús está activado.» (`avisoMayusculas={false}` lo apaga).
- Respaldo: R04 (DoorDash: reglas con icono y texto; Square: ojo), P10, A06, A08. El servidor ya genera la temporal (`generarContrasenaTemporal`); estas acciones son para el caso en que el administrador deba escribirla.

## 13. `ui/TarjetaOpcion` (nuevo)

Opciones con consecuencias que conviene explicar (rol, tipo de cámara, motivo del justificante): tarjetas con icono Lucide, título, descripción y palomita al elegir. Hasta 4 por fila; **una columna en teléfono**.

```jsx
<Field as="fieldset" label="Tipo de cámara" required error={errores.tipo}>
    <TarjetaOpcion
        columnas={3}
        value={v.tipo}
        onChange={(tipo) => poner('tipo', tipo)}
        opciones={[
            { value: 'ip', titulo: 'Cámara IP', descripcion: 'RTSP o HTTP en la red del plantel', icono: Wifi },
            { value: 'navegador', titulo: 'Del navegador', descripcion: 'La del equipo del docente', icono: Monitor },
        ]}
        renderExtra={(valor) => (valor === 'ip' ? <Field label="Dirección IP" example="10.20.12.2"><Input /></Field> : null)}
    />
</Field>
```

- Cada tarjeta es un **radio nativo** oculto a la vista (flechas, Tab y lectores funcionan solos; nombre = título, descripción = texto de apoyo). El contenido extra de la elegida (`renderExtra(valor, opcion)` u
  `opcion.extra`) queda **fuera** de la etiqueta, así sus controles no son parte del radio (ARIA: los hijos de un radio son presentacionales) y escribir en ellos no cambia la selección.
- `invalid` (borde destructivo + `aria-invalid` del grupo), `required` (`aria-required`), `disabled` global o por opción, `name`, `label`.
- Respaldo: R05 (tarjetas con el campo dependiente dentro), R08 (tarjetas con icono y subtítulo), R18 («Otro» con su campo), P7.

---

## 14. `lib/formularios` (nuevo)

`import { … } from '@/lib/formularios'` (o el archivo suelto). Todo con pruebas en `formularios.test.js`.

| Módulo | Contenido |
|---|---|
| `texto.js` | `esCorreo` (misma regla que las RPC; recorta y exige ≤ 120), `enteroEnRango(v, min, max)` (misma firma que `catalogos/comun.js`), `soloDigitos`, `soloAlfanumerico`, `mayusculas`, `minusculas`, `sinAcentos`, `normalizarBusqueda` (sin acentos + minúsculas + recorte), `recortar(v, { colapsar })`. |
| `limites.js` | `LIMITES` y `PATRONES`. |
| `fechas.js` | `hoyLocal`, `esFechaISO`, `partesFecha`, `sumarDias/Meses/Anios` (aritmética de calendario, sin zonas; 31 ene + 1 mes = 28 feb), `compararFechas`, `diasEntre`, `acotarFecha`, `formatearFechaLarga/Corta`. |
| `dom.js` | `emitirCambio(input, valor)`: escribe en el campo nativo y dispara un evento `input` que React entrega a `onChange`. |

### `LIMITES` (verificados contra el DDL y las RPC; una prueba compara cada `varchar(N)` con `0003_tablas_academico.sql`)

| Clave (plana · anidada) | Valor | Origen |
|---|---|---|
| `matricula` | 10 | `alumno.matricula varchar(10)`; la RPC exige `^[A-Z0-9]{1,10}$` tras `upper()` |
| `num_empleado` | 10 | `docente.num_empleado varchar(10)`; igual patrón |
| `nombres` | 60 | `alumno/docente.nombres varchar(60)` |
| `apellidos` | 40 | `apellido_paterno` y `apellido_materno varchar(40)` |
| `correo` | 120 | `correo_institucional` y `usuario.correo varchar(120)`; regla `^[^@\s]+@[^@\s]+\.[^@\s]+$` |
| `clave_grupo` | 8 | `grupo.clave_grupo varchar(8)`; RPC `^[A-Z0-9][A-Z0-9-]{0,7}$` |
| `periodo` | 6 | la columna es `varchar(10)` pero `ck_grupo_periodo` (`^[0-9]{4}-[12]$`) lo fija en `AAAA-S` = 6 |
| `materia_clave` · `materia.clave` | 8 | `materia.clave varchar(8)`; RPC `^[A-Z0-9]{1,8}$` |
| `materia_nombre` · `materia.nombre` | 80 | `materia.nombre varchar(80)` |
| `aula_clave` · `aula.clave` | 10 | `aula.clave varchar(10)`; RPC `^[A-Z0-9][A-Z0-9-]{0,9}$` (admite guiones: «A-12») |
| `aula_edificio` · `aula.edificio` | 40 | `aula.edificio varchar(40)` |

Hallazgos de la verificación para quien integre: la matrícula, el número de empleado y la clave de materia **solo admiten letras y dígitos** (sin guiones ni espacios); aula y grupo sí admiten guiones.
El servidor pasa clave, matrícula y número de empleado a **mayúsculas** y el correo a **minúsculas**: usa `transform` en el campo. Los créditos deben ser **> 0** (`ck_materia_creditos`) y la capacidad **> 0**.

---

## 15. Compatibilidad y pruebas

- Cambios por omisión que ven las pantallas existentes: (1) icono Lucide junto al texto del error de `Field`; (2) `Select` con chevron propio y un contenedor (las clases de diseño se reparten solas);
  (3) `invalid` ahora también escribe `aria-invalid` en `Input`, `Select` y `Textarea`; (4) el mensaje de error de `FileInput` va en un `div role="alert"` con un `<p>` por mensaje.
  Las pruebas existentes de `ui`, `auth`, `admin`, `sesion`, `analitica`, `tecnico`, `alumno`, `reportes`, `revision`, `layout`, `docente` y `lib` pasan sin modificar ninguna (2 756 de 2 757 en la corrida completa; la única que falló fue un temporizado de `DeteccionRostros`, ajeno a estas piezas, que pasa sola).
- Consumidores fuera del alcance que se comprobaron: asistente facial (`Select`), simulador de cámara y captura continua (`Select`, `Checkbox`), `Pagination` (`Select` con `!w-auto`), `GraficaSerie` e
  `IndiceFacialPanel` (`Checkbox`).
- Pruebas por pieza: `Field`, `Input`, `Select`, `Textarea`, `Checkbox`, `FileInput`, `Combobox`, `SegmentedControl`, `Switch`, `CampoFecha`, `RangoFechas`, `CampoPassword`, `TarjetaOpcion` (`*.test.jsx`)
  y sus utilidades puras (`*.utils.test.js`). jsdom no mide pantalla: la posición de la lista se prueba como función pura (`calcularPosicionLista`) y se verificó a 360 px en un navegador real.
- Revisión visual: se vieron a 360 px (claro) y en modo oscuro en un banco de pruebas fuera del repositorio (sin desborde horizontal; lista del `Combobox` dentro del área visible, también cuando se voltea hacia arriba y dentro de un `Modal`). Queda para el integrador revisarlas en las pantallas reales cuando las adopten.

## 16. Pasada de arreglos (F1-fix): resumen para quien integre

Cambios aditivos a partir de lo que encontraron los frentes F2–F6 (los defaults no cambian salvo donde se dice):

| Pieza | Qué cambió |
|---|---|
| `SegmentedControl` | `fullWidth` reparte con `flex-auto`, `min-w-0`, `break-words` y relleno menor; `name` pone `data-campo-nombre` en el grupo. |
| `CampoPassword` + `Field` | El error queda bajo la caja (`recibeMensajes`/`mensajes`); `ref` del consumidor combinado con el interno. |
| `Combobox` | `onBlur` (al salir del conjunto), `ref` (al input), `autoFocus`; `name` pone `data-campo-nombre` en el contenedor. |
| `Input`, `Textarea`, `Select`, `Combobox` | Un campo inválido conserva el borde rojo con el foco (`CONTROL_INVALIDO`). |
| `ConfirmDialog` | `reason.required` fallido: el `Textarea` lleva `invalid` (borde rojo), `aria-invalid` y el mensaje enlazado por `aria-describedby`. |
| `useFormulario` / `enfocarPrimerError` | Llega a `Combobox` y `SegmentedControl`, respeta el orden de pantalla y salta lo deshabilitado u oculto (ver `PRIMITIVAS-contenedores.md` §2.1). |

Pruebas nuevas en `Combobox`, `SegmentedControl`, `CampoPassword`, `Field`, `ConfirmDialog` y `hooks/ui/formulario.enfocar.test.jsx`.
