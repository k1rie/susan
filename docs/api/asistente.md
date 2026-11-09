# Asistente de IA del docente: `POST /api/asistente`

Documento: `docs/api/asistente.md`. Contrato de la ruta, sus herramientas y la interfaz. Código:
`web/src/app/api/asistente/route.js`, `web/src/lib/server/asistente.js` (bucle con Claude, cupo, esquema),
`web/src/lib/server/asistenteHerramientas.js` (herramientas y minimización), `web/src/lib/http/asistente.js` (cliente) y
`web/src/components/asistente/*` (botón flotante, panel y conversación).

## 1. Qué hace

Un botón flotante «Asistente» (por ahora solo para el rol **docente**) abre un panel con un chat. El docente pregunta en
lenguaje natural («¿Qué alumnos tengo en riesgo?», «¿Qué grupo falta más?», «¿Qué sesiones tengo hoy?», «¿Tengo justificantes
pendientes?») y la respuesta llega en streaming. Claude no inventa cifras: consulta los datos reales con **herramientas** que
llaman a las RPC `api_*` con la **sesión del docente** (la RLS limita todo a sus grupos). El asistente **solo lee**: no
registra asistencias ni resuelve justificantes; si se lo piden, indica la pantalla.

- Modelo: `claude-opus-5-5` (SDK `@anthropic-ai/sdk`), `output_config.effort: "medium"`, razonamiento adaptativo (el de omisión).
- Fallbacks del servidor: `fallbacks: "default"` con la beta `server-side-fallback-2026-07-01`; si un clasificador rechaza la
  petición, la API la reintenta en el modelo recomendado dentro de la misma llamada.
- Prompt de sistema y herramientas fijos (sin fecha ni nombre) con `cache_control` automático: el prefijo se reutiliza.
- Hasta 6 vueltas modelo → herramientas por pregunta; varias herramientas de una vuelta corren en paralelo y sus resultados van
  en un solo mensaje.
- Sin estado en el servidor: cada pregunta manda el historial de **texto** de la conversación y los datos se vuelven a consultar.

## 2. Configuración

| Variable | Dónde | Qué es |
|---|---|---|
| `ANTHROPIC_API_KEY` | Vercel (Production/Preview), `web/.env.local` | Clave de la Claude API. **Solo servidor**; nunca `NEXT_PUBLIC_*`. |

Sin la variable el asistente queda **desactivado**: el botón aparece igual, el panel muestra «Asistente no disponible» con el
motivo y el campo deshabilitado, y la ruta responde `503 ASISTENTE_NO_CONFIGURADO` sin llamar a Claude. Al cliente solo viaja un
booleano (`asistenteIA.disponible`, calculado en `app/(app)/layout.jsx`); la clave nunca sale del servidor.

## 3. Ruta

`POST /api/asistente` · rol `docente` · `handle()` (autenticar → autorizar rol → validar con zod → ejecutar).

### 3.1 Cuerpo (JSON, ≤ 64 KiB)

```json
{ "mensajes": [
    { "rol": "usuario", "texto": "¿Qué alumnos tengo en riesgo?" },
    { "rol": "asistente", "texto": "Tienes 2 alumnos en riesgo: …" },
    { "rol": "usuario", "texto": "¿Y en el grupo A1?" }
] }
```

- `mensajes`: 1 a 20; empieza y termina con `usuario` y alterna roles. `texto`: 1 a 2000 caracteres (se recorta el espacio).
- Objetos estrictos: cualquier otro campo es `422 VALIDACION`. El cliente (`historialParaEnviar`) ya descarta errores,
  respuestas vacías y lo que pase de 20 mensajes.

### 3.2 Errores antes de abrir el stream (`{ error: { code, message, details? } }`)

| Status | `code` | Cuándo |
|---|---|---|
| 401 | `NO_AUTENTICADO` | Sin sesión |
| 403 | `NO_AUTORIZADO`, `CUENTA_INACTIVA`, `ORIGEN_NO_PERMITIDO` | Rol distinto de docente, cuenta inactiva, `Origin` ajeno |
| 413 / 415 / 400 | `LIMITE_EXCEDIDO` / `TIPO_NO_SOPORTADO` / `PETICION_INVALIDA` | Cuerpo grande, no JSON o JSON roto |
| 422 | `VALIDACION` | Cuerpo fuera del esquema (`details.campos`) |
| 429 | `DEMASIADOS_INTENTOS` | Más de 30 preguntas en 10 min por usuario (en memoria, por instancia); `Retry-After` |
| 503 | `ASISTENTE_NO_CONFIGURADO` | Falta `ANTHROPIC_API_KEY` |

### 3.3 Respuesta: `200 application/x-ndjson` en streaming

Una línea JSON por evento (`Cache-Control: no-store`, `X-Accel-Buffering: no`):

| Evento | Forma | Significado |
|---|---|---|
| texto | `{ "tipo": "texto", "texto": "…" }` | Fragmento de la respuesta; se concatenan en orden |
| herramienta | `{ "tipo": "herramienta", "nombre": "alumnos_en_riesgo", "etiqueta": "Buscando alumnos en riesgo" }` | Se está consultando un dato (la UI muestra la etiqueta) |
| fin | `{ "tipo": "fin", "motivo": "completo" \| "rechazo" \| "limite" }` | Terminó: normal, rechazo de seguridad (con un texto que lo explica) o tope de tokens/vueltas |
| error | `{ "tipo": "error", "code": "…", "message": "…" }` | Falló a mitad: `ASISTENTE_OCUPADO` (429 de Claude), `ASISTENTE_NO_CONFIGURADO` (clave inválida), `ASISTENTE_SIN_CONEXION`, `ASISTENTE_ERROR` |

Los errores del proveedor nunca se reenvían tal cual (ni su texto ni ids). Si el cliente corta la conexión (cierra el panel,
«Detener», cambia de cuenta), el servidor aborta la llamada a Claude.

## 4. Herramientas (lo único que Claude puede consultar)

Todas con la sesión del docente (`ctx.rpc`). La entrada se valida con zod antes de consultar (las herramientas usan
`eager_input_streaming`, así que la API no la valida); una entrada inválida o un error de la RPC vuelven a Claude como
`tool_result` con `is_error` y solo un código (`ENTRADA_INVALIDA`, `NO_AUTORIZADO`, `ERROR_CONSULTA`…), nunca el texto de la base.

| Herramienta | Entrada | RPC | Qué devuelve a Claude |
|---|---|---|---|
| `panel_docente` | — | `api_docente_panel` | fecha; sesiones de hoy (materia, grupo, id_grupo, aula, horario, estatus, modo previsto); registros pendientes; justificantes por resolver; conteo de alertas; grupos (id_grupo, materia, clave, periodo, inscritos) |
| `alumnos_en_riesgo` | `id_grupo?` | `api_alertas_docente` (≤ 60) | totales y por alumno: tipo, matrícula, nombre, grupo, materia, faltas equivalentes, % de faltas, límite, faltas restantes, derecho a examen |
| `ausentismo_por_grupo` | `periodo?` (AAAA-N) | `api_reporte_filtros` (periodo actual) + `api_reporte_periodo` | por grupo: inscritos, sesiones programadas/cerradas, asistencia promedio, alumnos en límite y sin derecho |
| `reporte_grupo` | `id_grupo` | `api_reporte_grupo` (≤ 60) | KPIs del grupo y por alumno: matrícula, nombre, presentes, retardos, ausencias, justificadas, pendientes, % de faltas, faltas restantes, derecho |
| `tendencia_grupo` | `id_grupo` | `api_serie_grupo` | últimas 40 sesiones cerradas: fecha, día de la semana, inscritos, ausentes, retardos, tasa de ausentismo |
| `justificantes_pendientes` | — | `api_cola_revision` (`pestana: justificantes`) | contadores y por justificante: matrícula, nombre, materia, grupo, fecha de la sesión, fecha de registro |

### 4.1 Minimización de datos (RNF-03 y PII)

- Nunca salen hacia Claude: vectores, imágenes, recortes, detecciones/lecturas, rutas del bucket, documentos, el **motivo** de los
  justificantes, ids de inscripción ni apellidos por separado. Solo nombre completo y matrícula, y solo en las herramientas que
  responden «¿quién?».
- El prompt de sistema pide nombrar alumnos solo cuando la pregunta lo requiera.
- La ruta no registra cuerpo, preguntas ni respuestas: en error solo `[api] POST /api/asistente <code>`.
- La clave vive en `serverEnv().anthropicApiKey` y solo se usa en el constructor del cliente del SDK.

## 5. Interfaz

- `components/asistente/AsistenteIA`: botón flotante + `ui/PanelLateral` (pantalla completa en teléfono, `size="sm"` en
  escritorio). Se monta en `AppShellCliente` con `React.lazy` (no suma al JS inicial de `/docente`) y conserva la conversación al
  navegar. En teléfono queda a 11 rem del borde inferior, por encima de la barra inferior (y su botón central «Pasar lista») y de
  las barras de acciones pegadas de los formularios; en escritorio, abajo a la derecha. No se dibuja en `/docente/pasar-lista` ni
  en `/docente/sesiones/*`.
- `components/asistente/ConversacionAsistente`: sugerencias al abrir, conversación en `role="log"` (texto plano, sin Markdown ni
  HTML), estado «Pensando…» / etiqueta de la herramienta, y el aviso de desactivado.
- `components/asistente/CampoPregunta`: área de texto (Enter envía, Mayús+Enter salta de línea, tope 2000) y botón
  Enviar / Detener.

## 6. Pruebas

`web/src/app/api/asistente.test.js` (ruta con Claude simulado: herramientas, minimización, rechazo, `max_tokens`, error de la API,
sin clave, roles, validación, cupo, eco tras fallback) y `web/src/components/asistente/AsistenteIA/*.test.*` (panel, streaming,
historial, errores, desactivado, rutas sin botón).
