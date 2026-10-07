# Frente F2: acceso y consola técnica

Zona: `web/src/components/auth/{LoginForm,RecuperarForm,CambiarContrasenaForm,Onboarding}` y
`web/src/components/tecnico/{ParametroFila,ParametrosEditor,IndiceFacialPanel,CamarasEstado}`. Fichas de origen: `auditoria.md` §3.2 y §3.8.
Todo es presentación y validación de conveniencia: no cambia ninguna RPC, ruta, payload ni código de error. La pantalla dividida del
acceso (`AuthCard`, `PanelProducto`) y la serif de titulares quedan como estaban.

## Qué cambió por formulario

| Formulario | Antes | Después |
|---|---|---|
| **LoginForm** | Validación solo al enviar (`includes('@')`); el foco iba a un aviso; sin Bloq Mayús; el enlace «¿Olvidaste…?» debajo del botón | `useFormulario`: el error aparece al salir del campo y al enviar (con foco en el primer campo inválido). Mensajes concretos con `esCorreo` (falta la @, falta el dominio, espacios, >120). Correo con `transform="trim"`, `maxLength` 120 y ejemplo. Contraseña con `CampoPassword` (mostrar/ocultar y aviso de Bloq Mayús, sin lista de requisitos). «¿Olvidaste tu contraseña?» en la fila de la etiqueta (`labelAction`). Tras un error del servidor se **conserva** lo escrito y el foco va a la contraseña con el texto seleccionado (si se vaciara, quedaría marcada como «obligatoria» justo después del intento). El botón sigue en «cargando» tras entrar hasta que cambia la página. |
| **RecuperarForm** | Validación al enviar; éxito = un `Alert` sin correo ni reenvío | Misma validación guiada. El éxito es una pantalla propia («Revisa tu correo», con el correo escrito y el texto neutro «Si … está registrado…», anti-enumeración intacta). **Reenviar enlace** con enfriamiento de 60 s (`useEnfriamiento`, calculado contra la hora real; anuncia a lectores de pantalla solo al empezar y al terminar), aviso de reenvío o de error, «Usar otro correo» (conserva el correo) y «Volver a iniciar sesión». |
| **CambiarContrasenaForm** | Dos `PasswordInput` + `ReglasContrasena`; el error repetía las reglas; botón sin barra de avance | Un solo `CampoPassword` (sin confirmación, A06): requisitos en vivo con «N de 3 requisitos», barra, mostrar/ocultar y Bloq Mayús. El mensaje de campo resume lo que falta («Aún no cumple: al menos 10 caracteres.») en vez de repetir la lista. `CONTRASENA_DEBIL` y `CONTRASENA_IGUAL` se pegan al campo con foco (`mapearError`). Foco inicial en el campo. La política sigue en `contrasena.utils.js` (`CampoPassword` la copia y una prueba de `ui/` vigila que no se desalineen). |
| **Onboarding** | Progreso inline en un `<ol>`; contador «Paso N de M» en la cabecera; el botón final se apagaba sin decir por qué | Migrado a `Stepper` (`<nav aria-label="Progreso">`, compacto en teléfono: «Paso 2 de 4 · Guía»; se puede volver a un paso recorrido). Aviso `aria-live` «Paso N de M: título» (el foco ya va al título). Barra de acciones con `FormActions`: «Continuar» + «Atrás» y, si el botón está apagado, **el motivo escrito junto a él** («Marca «He leído el aviso de privacidad» para terminar.»). Tras guardar la contraseña ya no se ofrece volver a ese paso (ni «Atrás» ni el progreso). |
| **ParametroFila / ParametrosEditor** | Etiqueta = clave técnica cruda; 12 tarjetas seguidas; rango y tipo en una línea gris | Nombre legible («Umbral de similitud») con la clave técnica en mono, `Crítico`, descripción, unidad junto al campo («min», «s», «%»), **rango válido** y **valor de fábrica** visibles, «Usar valor de fábrica», «Descartar» y marca «Sin guardar». Deslizador nativo sincronizado para el umbral (único decimal con rango). Validación en línea: tipo, rango, máximo 3 decimales, coma decimal aceptada y enviada con punto (el servidor solo admite punto: antes «0,9» pasaba el cliente y fallaba), `0.85` no cuenta como cambio frente a `0.850`, y la regla entre parámetros (límite de «presente» < tolerancia, con el valor guardado del otro). Parámetros agrupados en 4 secciones (nada queda fuera: los desconocidos van a «Otros parámetros»). El error del servidor queda bajo el campo y le devuelve el foco. El encabezado cuenta «N parámetros con cambios sin guardar» y protege recargar/cerrar con `useCambiosSinGuardar`. «Último cambio»: «Valor inicial del sistema» o «Cambiado el … por …». |
| **CamarasEstado** | `<select>` de estatus por tarjeta; confirmación genérica «Cambiar la cámara A-1 a activa» | `SegmentedControl` (Activa / Inactiva / Mantenimiento, mismo tono que la pastilla de la cámara, siempre con texto). Confirmación con el nombre del objeto en el título, la consecuencia en una frase y el verbo en el botón («Poner en mantenimiento»); advierte si hay una sesión abierta en el aula. A 360 px las opciones toman el ancho de su texto (ver `requests`). |
| **IndiceFacialPanel** | Diálogo genérico con una casilla | El diálogo dice cuántas plantillas procesa y que el pase de lista sigue con la versión actual; la casilla «Reconstrucción completa» sale **marcada y recomendada** si la dimensión del índice no coincide con la configurada, y explica cuándo hace falta. «Reconstruir índice» deja de ser la acción primaria cuando el índice está al día. |
| **RelojDemo** | — | No se tocó (opcional y solo desarrollo). |

## Primitivas usadas

`useFormulario` (login, recuperar, cambiar contraseña), `CampoPassword`, `Field` (`labelAction`, `reserveError`), `Input` (`transform`, `maxLength`),
`Stepper`, `FormActions` (`motivoBloqueo`), `SegmentedControl`, `ConfirmDialog`, `Checkbox` (`hint`), `Alert`, `useCambiosSinGuardar`, `lib/formularios`
(`esCorreo`, `LIMITES`). Las pantallas públicas no usan `Select`, `Combobox` ni `Modal`.

## Decisiones

- **Sin confirmación de contraseña.** Lo pide el contrato de `CampoPassword` (A06): con «Mostrar» y la lista en vivo sobra el doble tecleo. Para restaurarla basta añadir un segundo `CampoPassword` con `reglas={false}`; `validarContrasena(nueva, confirmacion)` sigue aceptando ambos.
- **`readOnly`, no `disabled`, mientras se envía.** `useFormulario` enfoca el primer error del servidor antes de que `enviando` vuelva a `false`: un campo `disabled` no puede recibir el foco (lo detectó una prueba de `CambiarContrasenaForm`).
- **Login conserva la contraseña tras un error** (en vez de vaciarla): el servicio no dice cuál de las dos falló, «Mostrar» permite corregir un dedazo y vaciarla la marcaba como obligatoria justo después de un intento.
- **Un parámetro se guarda por separado (no por lote).** Cada uno tiene su RPC, su confirmación (con el aviso del crítico) y su asiento en bitácora; un guardado por lotes exigiría ordenar escrituras dependientes (límite de «presente» vs. tolerancia) y resolver fallos parciales. Por eso no hay `FormActions` en el editor: el estado «Sin guardar» vive en cada tarjeta y el encabezado los cuenta. `ConfirmDialog.reason` tampoco aplica (ni las RPC de parámetros, ni la de cámaras, ni la del índice reciben un motivo: no se pide lo que no se guarda).
- **Barra de acciones del Onboarding sin pegarse al borde.** El `<body>` de la app tiene `overflow-x: hidden`, lo que anula `position: sticky` en una página que desplaza con la ventana (verificado en el navegador; en `AppShell` sí funciona porque desplaza su propio contenedor).
- **Valores de fábrica y nombres amigables en el cliente** (`META_PARAMETROS`): la API solo entrega clave, rango, unidad y descripción. Los valores son los de la carga inicial (`0040_parametros.sql`); si `api_parametros_listar` devolviera `valor_defecto`, `valorDeFabrica` lo prefiere.
- `PasswordInput` y `ReglasContrasena` quedan **sin uso** (los reemplaza `CampoPassword`); no se borraron (restricción de git del frente). Sus pruebas siguen verdes. `reglasContrasena` en `contrasena.utils.js` se conserva porque la prueba de alineación de `ui/CampoPassword` la importa.

## Pruebas

`npx eslint src/components/auth src/components/tecnico "src/app/(public)" "src/app/(flujo)" "src/app/(app)/tecnico"` sin hallazgos;
`npx vitest run src/components/auth src/components/tecnico`: 12 archivos, **129 pruebas** (antes 67). Nuevas o ampliadas: validación guiada, Bloq Mayús,
foco y conservación tras error de `LoginForm`; éxito, enfriamiento con temporizadores falsos y reenvío de `RecuperarForm`; requisitos «N de 3», un solo campo
y errores del servidor pegados al campo de `CambiarContrasenaForm`; `Stepper`, «Atrás» ausente tras la contraseña y motivo del botón de `Onboarding`;
nombres, grupos, rango, valor de fábrica, deslizador, coma decimal, coherencia entre parámetros, foco tras error del servidor y conteo de «sin guardar» en
`ParametrosEditor`/`parametros.utils`; segmentado, confirmaciones por estatus y aviso de sesión abierta de `CamarasEstado`; casilla sugerida y variante del botón de
`IndiceFacialPanel`. Se actualizaron los textos que cambiaron a propósito (`Paso 1 de 3 · Perfil`, etiquetas de los parámetros, «Poner en mantenimiento»).

## Verificación en el navegador

En un origen propio (`http://f2.localhost:3000`, que Next permite y tiene su propio juego de cookies: no pisa las sesiones de otros agentes), a 360 px y escritorio, claro y oscuro (`.dark`),
sin desborde horizontal (`scrollWidth` = 360) y con el foco visible: login (errores al salir del campo y al enviar, Bloq Mayús, credenciales incorrectas), recuperar
(éxito con cuenta atrás), cambiar contraseña (requisitos en vivo), activación completa de una cuenta nueva (contraseña real → estilo → guía → privacidad con el motivo del botón →
redirección a `/tecnico`), bienvenida, y la consola técnica completa (cámaras con el segmentado y el diálogo, parámetros con errores y un guardado real revertido,
diálogo de reconstrucción). Lo que **no** se pudo ver en pantalla: el aviso de Bloq Mayús en navegador real (se simuló el evento) y la protección `beforeunload` (solo pruebas).

Registros de prueba en la base local:

- Cuenta `zz-prueba-f2@susan.test` (rol técnico) creada con `POST /api/admin/usuarios`, activada con el asistente y **desactivada** al terminar.
- Bitácora `cambio_parametro`: `minutos_pase_lista_base` 5 → 6 → 5 (valor restaurado), hecha por esa cuenta.

## requests (fuera de mi zona)

1. **`components/tecnico/ConsolaTecnico`**: al cambiar de pestaña se desmonta `ParametrosEditor` y se pierden los valores sin guardar. `Tabs` ya acepta `confirmLeave`; basta pasar
   `confirmLeave={() => confirmarNavegacion()}` (de `@/hooks/ui/useCambiosSinGuardar.js`): las filas con cambios ya se registran en ese registro global.
2. **`api_parametros_listar`** (opcional): devolver `valor_defecto` por parámetro evitaría el catálogo de valores de fábrica del cliente (`META_PARAMETROS`).
3. **`ui/SegmentedControl`**: con `fullWidth` a 360 px una palabra larga («Mantenimiento») no cabe en un tercio y se sale de su segmento (`min-w-0` + `whitespace-normal` no parten una palabra). Lo contorneé sin `fullWidth` y con
   `className="w-full [&>button]:flex-auto [&>button]:px-2.5"`. Un `flex-auto` por omisión en `fullWidth` (o `min-w-fit`) lo resolvería.
4. **`ui/CampoPassword` dentro de `Field`**: el error de `Field` se pinta después de **toda** la pieza (debajo de la lista de requisitos), no pegado al campo. Funciona, pero un `error` propio de `CampoPassword` (o un orden de `Field`) lo dejaría bajo la caja.
   Además `ref` como prop (React 19) entra por `...rest` y pisa la ref interna que usa «Generar».
5. **`docs/design/formularios/PRIMITIVAS-contenedores.md`** (FormActions): anotar que `sticky="movil"` y `sticky="contenedor"` solo pegan dentro de un contenedor que desplaza (como `AppShell`); en una página que desplaza con la ventana no funcionan por el `overflow-x: hidden` del `<body>`.
6. **`useFormulario`** (documentación en `PRIMITIVAS-contenedores.md`): `enviar` enfoca el campo con error del servidor antes de que `enviando` vuelva a `false`, así que un campo `disabled` no recibe el foco; conviene indicar que los formularios usen `readOnly` mientras envían (ver «Decisiones»).
7. **Entorno de desarrollo**: Next solo hidrata en `localhost` y subdominios (`*.localhost`); en `127.0.0.1` o `[::1]` la página carga sin hidratar y los formularios envían por GET (la contraseña iría en la URL). Para pruebas con sesión limpia usar `http://<nombre>.localhost:3000`.
8. Trampa de Vitest: `beforeEach(() => mock.mockClear())` devuelve el mock y Vitest lo ejecuta como limpieza posterior (provocó un rechazo no manejado); usar llaves.
