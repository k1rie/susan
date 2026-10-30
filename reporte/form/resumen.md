# Resumen: sección «Código de Form y diseño de Form»

Código de `origin/main` (commit `f742bb4`), pantallas en la aplicación en ejecución (`http://localhost:3100`, Next 16.3.8 dev, `SUSAN_LOCAL=1`, reloj de demostración fijo en lunes 14-sep-2026 07:12 -06, servicio de reconocimiento con embedder `fake`).

## Qué existe

- **41 formularios y flujos** en `web/src/components` (detalle campo por campo en `inventario.md`): 4 de acceso, 7 de alumnos, 7 de catálogos y cuentas, 9 de grupos, 1 del portal del alumno, 5 del docente, 3 filtros, 3 de la consola técnica y 2 solo de desarrollo local; además 4 controles de entrada que no son formularios.
- Por contenedor: **2 asistentes sobre `ui/Asistente`** (alta de alumno: Identidad, Contacto y acceso, Revisión; alta de grupo: Materia y docente, Aula y horario, Revisión) y **5 flujos guiados con guion propio** (activar cuenta en 4 pasos o bienvenida en 3, importar CSV en 4 pasos, «Mi registro facial» en 3 pasos, registro facial guiado de 5 tomas y justificante en 3 bloques numerados);
  5 altas de un paso en `ui/PanelLateral` (aula, materia, docente, cuenta de usuario, cámara); el resto son formularios de página, diálogos con campos y barras de filtros.
- **Primitivas propias** en `web/src/components/ui/` (54 carpetas en total): campos (`Field`, `Input`, `Textarea`, `Select`, `Combobox`, `SegmentedControl`, `Switch`, `Checkbox`, `CampoFecha`, `RangoFechas`, `CampoPassword`, `TarjetaOpcion`, `FileInput`), estructura y flujo (`FormActions`, `FormSection`, `Stepper`, `SuccessState`, `Asistente`, `PanelLateral`, `Modal`, `ConfirmDialog`, `BarraFiltros`, `MenuAcciones`)
  y los hooks `useFormulario`, `useCambiosSinGuardar`, `useCierreContenedor`, `useDialog`; límites y normalizadores en `web/src/lib/formularios/`. API en `diseno.md` §11.
- **Validación**: del cliente (`validar` de `useFormulario`, en archivos `*.utils.js` con mensajes en español) y del servidor (RPC en PostgreSQL y esquemas zod en `web/src/lib/server/schemas.js` para los Route Handlers de cuentas, consentimientos, aviso del alumno, justificantes e índice facial).

## Pruebas

Comando (en `susan-main/web`): `npx vitest run src/components/auth src/components/admin src/components/alumno src/components/ui src/hooks/ui src/lib/formularios src/components/sesion/RegistroManualDialog src/components/revision src/components/tecnico src/components/reportes src/components/analitica/SelectorGrupo`

- Resultado: **176 archivos de prueba, 2008 pruebas: 175 archivos y 2007 pruebas pasan; 1 prueba falla** (123 s, con el servidor de desarrollo y Playwright corriendo a la vez).
- La que falló es `src/components/ui/DeteccionRostros/DeteccionRostros.test.jsx` («carga el detector, dibuja un recuadro por rostro y avisa cuántos ve»: esperaba `listo` y recibió `cargando`), un temporizado ajeno a los formularios. Repetida sola (`npx vitest run src/components/ui/DeteccionRostros`): **2 archivos, 19 pruebas, todas pasan**.
  `docs/design/formularios/PRIMITIVAS-campos.md` §15 ya registra el mismo caso («la única que falló fue un temporizado de `DeteccionRostros`… que pasa sola»).
- En todo `web/src` hay 296 archivos `*.test.*`; no se corrió la suite completa ni `npm run lint` ni `npm run build`.
- Pruebas por formulario: ver cada ficha de `inventario.md` (todas tienen archivo de prueba salvo `ConsolaTecnico`, que solo compone las pestañas; `ParametroFila` tiene solo `parametros.utils.test.js` y `CampoNumerico` solo `campoNumerico.utils.test.js`).

## Entregables (rutas absolutas bajo `/tmp/claude-0/-home-user-susan/40436e6d-ab3e-5c65-9b75-f6742b8df0d9/scratchpad/susan-main/reporte/`)

| Archivo | Contenido |
|---|---|
| `form/inventario.md` | Ficha de los 41 formularios (ruta, componente, campos, validación con textos reales, pasos, llamada, pruebas) y cómo se verificó que no falta ninguno. |
| `form/diseno.md` | Principios de diseño con la API real de las primitivas. |
| `form/codigo/` | 10 archivos copiados literalmente (1345 líneas) e `INDICE.md` (origen, líneas, qué hace; cada copia verificada con `diff`). |
| `form/capturar-forms.mjs` | Script de Playwright que produjo las capturas (`node capturar-forms.mjs [escenario ...]`; requiere el stack levantado). |
| `form/limpiar-zz.sh` | Elimina los registros «ZZ» que crean las capturas. |
| `form/resumen.md` | Este archivo. |
| `figuras/forms/f01-…png` a `f114-…png`, `INDICE.md`, `indice.json` | **114 capturas** (22 MB) con su índice (archivo, formulario, estado, ruta, vista) y una **selección sugerida de 48** para el reporte. |

## Capturas

- Escritorio **1440x900 a factor 2** (PNG de 2880x1800) y móvil **390x844 a 3x**; Chromium de `/opt/pw-browsers`; «reducir movimiento» activado; solo se ocultaron con CSS las insignias de desarrollo (indicador de Next y tarjeta «Reloj de demostración»). Las marcadas «recorte» en el índice fotografían solo la tarjeta del formulario (ficha del alumno y consentimiento, justificante, cuenta de acceso) porque es más alta que la ventana.
- Por familia: login 5, recuperar y cambiar contraseña 6, alta de alumno 9 (los 3 pasos, errores, matrícula repetida, válido, éxito), ficha del alumno 7 (datos, estatus, consentimiento, cuenta), aula/materia/docente en panel lateral 12 (vacío, errores, válido, éxito de cada una), usuarios 5, alta de grupo 8 (los 3 pasos, errores, franja, éxito),
  pantallas del grupo 17 (datos, horario, generar sesiones, capacidad, cámara, inscribir, importar CSV), justificante 5, cuenta/activación/registro facial 16 (contraseña temporal, los 4 pasos de activar cuenta, aviso de consentimiento, portada del asistente y toma con cámara), revisión de justificantes 4, registro manual 4, consola técnica 7, filtros 4 y **5 móviles**.
- Cada PNG se revisó con la herramienta de lectura (en hojas de contacto de 2 a 5 imágenes o una por una). Se repitieron las que salieron mal (estado persistente de un error previo en los pasos de los asistentes, formularios cortados por la ventana, sesión sin hidratar al iniciar sesión).

## Qué no se pudo capturar y por qué

- **Registro facial completo**: Chromium sin cámara real y con el embedder `fake`. Se llegó hasta la pantalla de toma con la cámara falsa de Chromium («No vemos tu rostro. Colócalo dentro del círculo.»); las verificaciones, la revisión y la pantalla «Listo» no se alcanzaron. Tampoco el registro facial del administrador desde la ficha (`PlantillaFacialPanel`: requiere fotos de rostros sintéticos).
- **Pase de lista manual** (`PaseListaManual`) y **cierre de sesión** (`CierreSesionDialog`): la sesión manual (115, 5C 09:00) solo se puede abrir dentro de su horario y mover el reloj de demostración cambia el estado global del stack. Solo se abrió la sesión 19 (3A, 07:00) para el diálogo «Registrar manualmente» y se restauró.
- **Resultado de la importación CSV** (paso 4) y **éxito de cámara/parámetro/índice**: no se confirmó la importación ni se guardaron parámetros, estatus de cámara o reconstrucción del índice para no alterar los datos de demostración (se capturó hasta la confirmación y se canceló). La baja de alumno, la baja de inscripción y restablecer contraseña tampoco se ejecutaron.
- **Pantalla de bienvenida** (`/bienvenida`) y **reloj de demostración / cámara simulada**: es el mismo componente de F-04 con 3 pasos y herramientas solo de desarrollo, respectivamente.
- **Modo oscuro**: no hay interruptor en la interfaz.
- **Cambiar contraseña** (`/cambiar-contrasena`) se fotografió con la sesión del administrador de demostración sin enviarse.
- **Cámara real en el pase de lista**: la captura `pase-lista-panel` muestra el aviso «No se pudo usar la cámara de este dispositivo» porque el Chromium de la captura no tiene cámara.

## Efecto de las capturas en los datos de demostración (importante)

Las capturas con «éxito» ejecutaron las operaciones reales contra la base local. Todo lo creado lleva el prefijo «ZZ». Se limpió con `form/limpiar-zz.sh`, **salvo un residuo que no se puede borrar**:

- Residuo: la cuenta de prueba `zz.prueba.reporte@susan.test` (alumno `ZZPRUEBA1`) aceptó el aviso de consentimiento propio, y eso dejó un asiento de **bitácora** (`alta_consentimiento`, `id_bitacora` 148) que apunta a su usuario. La bitácora es de solo anexar (triggers `trg_bitacora_sin_cambios` y `trg_bitacora_sin_truncate`, RNF-08), así que ese usuario (desactivado, `activo=false`) y el alumno (puesto en `baja_definitiva`) no se pueden eliminar sin desactivar esos triggers; no se tocaron.
  Su consentimiento sí se borró. **Conteos actuales** frente a los de la semilla que se informaron: `alumno` 76 (75), `usuario` 32 (31), `bitacora_auditoria` 148 (147), `auth.users` 31 (30); sin cambio: `docente` 3, `grupo` 3, `materia` 4, `aula` 2, `camara` 4, `sesion_clase` 146, `asistencia` 1296, `captura` 13, `deteccion` 199, `justificante` 20, `inscripcion` 75, `plantilla_facial` 75, `consentimiento` 77.
  Si el reporte cita esos conteos hay que usar los de la semilla (con la nota de este residuo) o restablecer la base completa.
- Registros que se crearon y se eliminaron: alumno `ZZPRUEBA1` (también un `ZZPRUEBA1` anterior de una corrida de prueba), aula `ZZ-P1` con una cámara, materia `ZZP101`, docente `ZZD01`, grupo `ZZ1` con su horario de 3 bloques, un justificante del alumno E260002 (con el motivo «Cita médica: ZZ Prueba de reporte…»), y la cuenta de prueba (usuario y Auth; la cuenta quedó desactivada por el residuo).
- Archivos huérfanos en el almacenamiento local (`/home/user/susan-reporte-local/storage/susan-private/`, fuera de git y sin fila en la base): `justificantes/2/25ab41dd-…png`, `justificantes/2/2368c9e5-…png` y `consentimientos/78/001622d5-…pdf`.
- Estado del resto: la sesión 19 se abrió para una captura y se restauró a `programada` / `automatico` (comprobado; 67 y 115 siguen `programada`); no se movió el reloj de demostración; no se guardó ningún parámetro, estatus de cámara ni índice; el umbral de similitud sigue en 0.850.
- Los procesos del stack (web, reconocimiento, PostgreSQL) quedaron arriba; el stack responde `/login` 200 y `/health` con `index_loaded=true`.
- Un intento de inicio de sesión de la preparación se envió por GET porque la página aún no hidrataba (los campos viajaron en la URL del registro del servidor de desarrollo): solo credenciales de demostración; el script ya espera la hidratación.
- La contraseña temporal de la cuenta de prueba se muestra en la captura `f75` **enmascarada** (puntos) y no se imprimió en ningún registro.

Para repetir la corrida completa: `limpiar-zz.sh`, luego `ZZ_SUFIJO=2 node capturar-forms.mjs` (con el sufijo 1 chocaría con el residuo); el orden de ejecución respeta las dependencias (la consola técnica va antes de crear la cámara ZZ).

## Discrepancias y notas

- `CLAUDE.md` habla de 9 pantallas P-01 a P-09; en `src/app` hay **29 `page.jsx`** (rutas de acceso, administración, docente, alumno, técnico, reportes, analítica y módulos). Las rutas con formulario están en `inventario.md`.
- Next solo hidrata en `localhost` y `*.localhost` (documentado en `FRENTE-F2`): las capturas usan `http://localhost:3100`.
- El saludo «Buenas noches» de la consola técnica no corresponde al reloj de demostración (07:12); no se investigó de dónde toma la hora.
- Las referencias de diseño (Mobbin) están en `docs/design/formularios/referencias-*.md` con sus URL; aquí no se reprodujeron imágenes de terceros.
- `auth/PasswordInput` y `auth/ReglasContrasena` están sin uso (los reemplaza `ui/CampoPassword`); `revertirIndice` existe en `@/lib/http/biometria.js` pero ninguna pantalla lo usa.
