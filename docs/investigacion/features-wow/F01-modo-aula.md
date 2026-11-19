# F01 · Modo Aula: el pase de lista proyectado

Raíz del repo: `/Users/diegoguerrero/Developer/SUSAN`. Las rutas del texto son relativas a esa raíz.

**Ajustes al pitch tras leer el código:**
- **Agregados del proyector.** La RPC no separa presentes de retardos. Devuelve `en_lista` (presente + retardo), `confirmando` (pendiente) y `por_contar`. Así se minimizan los datos y no hay nada negativo en pantalla. Un `ausente` que el docente marca durante el pase manual cuenta como «por contar»: el proyector nunca distingue «falta» de «aún no llega».
- **No sirve `cerrada_en`.** `app.cerrar_sesion` con `p_por_docente = true` exige que haya terminado la tolerancia (0133). Con `cerrada_en`, el cierre siempre daría 20 min o más. El tiempo de lista se mide como `abierta_en` (F29) → último alumno contado.
- **Minutos devueltos.** Se calculan como `max(0, floor(minutos_pase_lista_base − duración medida))`. Con 1 min 42 s salen «unos 3 min», no los 5 del pitch. `api_impacto_tiempo` (sesiones automáticas × base) no cambia.
- **El ritual dura 60 s, no 20 min.** Termina cuando el docente pulsa «Empezar la clase» (botón, clicker o tecla), cuando la lista está completa o cuando termina la fase de presente. Después la ventana se cierra sola. La sesión sigue abierta y la tolerancia sigue corriendo.
- **Pase manual.** Hoy `PaseListaManual` guarda en lote solo al pulsar «Guardar». Mientras se proyecta, se agrega un autoguardado (lotes de `api_pase_lista_manual` cada 3 s) para que el contador suba al ritmo del docente.

---

## 1. Concepto y momento wow

El docente pulsa «Proyectar» y la pantalla del salón muestra 25 asientos apagados y «Presente hasta 07:10 · 4:12». Mientras el docente marca en su celular (o la cámara confirma), los asientos se encienden, el medidor sube a «18 de 25» y a las 07:10:00 el reloj pasa a ámbar. Si existe la tarjeta «Ahora» de F08, el teléfono del alumno cambia en el mismo segundo. Al terminar, la pantalla muestra «Pase de lista en 1 min 42 s · 23 de 25 · unos 3 min devueltos a la clase (estimación)». No aparece ningún nombre.

## 2. Flujo pantalla por pantalla

| # | Ruta / pieza | Qué pasa |
|---|---|---|
| 1 | `/docente/sesiones/[id]` (existente, `(app)`) | Nueva acción secundaria «Proyectar» (Lucide `Projector`). En automático va en `AccionesPaseLista` de `CapturaContinua`; en manual, en la barra de acciones de `PaseListaManual`. |
| 2 | Comprobar la pantalla antes de abrir | `screen.isExtended === false` (Chrome/Edge, sin permiso): diálogo «No veo una segunda pantalla». `isExtended` indefinido (Safari/Firefox): `ConfirmDialog` «¿El proyector está en modo Extender?», con la indicación «Windows + P › Extender» y la de Mac. Opciones: «Sí, abrir» · «Usar solo esta pantalla» · «Cancelar». |
| 3 | Abrir la ventana | `window.open` síncrono en el clic (así no lo bloquea el bloqueador de ventanas emergentes). Después, si existe `getScreenDetails()` (permiso `window-management`), `moveTo`/`resizeTo` la mueve a la pantalla que no es la actual. Si no existe, se arrastra a mano. Si el navegador la bloquea, se muestra el aviso «Permite ventanas emergentes para SUSAN». |
| 4 | `/docente/sesiones/[id]/aula` en **`(flujo)`** | Pantalla completa sin AppShell. Etapas: **espera** (sesión programada: «Cálculo · 1A · empieza 07:00»; sondea hasta que el docente abre la sesión, aunque sea desde su teléfono) → **conteo** → **resumen** (15 s) → la ventana se cierra sola (`window.close()`; con `?modo=una-pantalla` queda una pantalla neutra «Clase en curso»). |
| 5 | Teléfono (F08 «Ahora») | Cambia de fase en el mismo segundo que el proyector (ver §4b). Muestra la confirmación personal que el proyector nunca muestra. |

**Proyector (1080p, 16:9):**

```
 Cálculo Diferencial · 1A · Aula C-12                 [Claro|Alto contraste|Oscuro] [Pantalla completa]
 PRESENTE HASTA 07:10                          ● ● ● ● ● ● ●
 4:12                (4.5em, color de fase)    ● ● ● ● ● ● ●
 [=====presente=====|====retardo====]          ● ● ● ● ○ ○ ·
 Después: retardo hasta 07:20                  · · · ·
 [tanque]  18 de 25                            ● en lista 18 · ○ confirmando 2 · · por llegar 5
           en lista
 ¿No apareces? Avisa a tu profesor al terminar.
```

**360 px** (el docente la revisa en su celular): una sola columna con el reloj (cuenta regresiva de 40 px), luego el tanque de 72×144 y la cifra, los puntos (unos 14 px, de 5 a 7 columnas) y la indicación. Sin desborde. Si `document.fullscreenEnabled` es falso (iPhone), no aparece el botón de pantalla completa.

**Controles para docentes con distinto nivel técnico:**
- Espacio, Enter, AvPág o → (lo que envía un clicker de presentación): «Empezar la clase».
- F: pantalla completa. T: tema. M: no cerrar sola. Esc: salir.
- El cursor se oculta tras 3 s sin moverse.
- Wake Lock (`navigator.wakeLock.request('screen')`) evita que la laptop atenúe la pantalla.

## 3. Datos

**Existentes que se usan (nombres reales):**
- `sesion_clase`: `fecha`, `hora_inicio`, `hora_fin`, `limite_presente_min`, `tolerancia_min`, `estatus`, `modo_registro`.
- `inscripcion`: solo `estatus = 'activa'`.
- `asistencia`: `estado`, `hora_registro`, `origen`.
- `captura.marca_tiempo`: solo como respaldo de la apertura.
- `grupo`, `materia`, `aula`: materia, clave y aula, que no son datos personales.
- Ayudantes: `app.now()` (sigue al reloj de demostración), `app.instante_clase`, `app.tz` (0001), `app.minuto_de_sesion`, `app.estado_por_minuto`, `app.sesion_autorizada` (0130, con GRANT a authenticated), `app.param_num('minutos_pase_lista_base')` (parámetro 12 = 5) y `app.reloj_simulado()`.
- `api_sesion_monitor` (0131) es el modelo: es INVOKER y calcula la fase con el mismo CASE.

**Dependencia de F29 (corte mínimo):**
- `sesion_clase.abierta_en timestamptz NULL`, fijada por `api_abrir_sesion` solo en la transición programada → abierta.
- La migración de F01 debe aplicarse **después** de la de F29: plpgsql falla en ejecución si el campo no existe.
- Si F29 no llega antes, la migración de F01 trae `ADD COLUMN IF NOT EXISTS abierta_en` y el ajuste a `api_abrir_sesion`. Es idempotente para que F29 lo reutilice (pedido a db-schema / db-api-a).
- Sesiones abiertas antes de existir la columna: aproximación `least(min(captura.marca_tiempo), min(hora_registro manual))` con `apertura_aproximada: true`. En ese caso **no** se muestran minutos devueltos.

**Nuevo: `supabase/migrations/0137_api_sesion_aula.sql`** (zona db-api-a, 01xx). Sin tablas, triggers ni RLS nuevos; reutiliza la RLS del docente.

```sql
-- Frontera de fase: UNA definición para el proyector y para F08 («Ahora»). Pura; GRANT a authenticated.
CREATE OR REPLACE FUNCTION app.fase_de_sesion(s public.sesion_clase, p_instante timestamptz) RETURNS jsonb
    LANGUAGE sql STABLE SET search_path = pg_catalog, app, pg_temp AS $$
    WITH b AS (SELECT app.instante_clase(s.fecha, s.hora_inicio) AS ini,
                      app.minuto_de_sesion(s.fecha, s.hora_inicio, p_instante) AS m)
    SELECT jsonb_build_object(
        'minuto_actual', round(b.m, 2),
        'fase', CASE WHEN s.estatus <> 'abierta' THEN s.estatus::text
                     ELSE coalesce(app.estado_por_minuto(s.limite_presente_min, s.tolerancia_min, b.m)::text,
                                   'fuera_de_ventana') END,
        'presente_hasta', to_char((b.ini + make_interval(mins => s.limite_presente_min)) AT TIME ZONE app.tz(), 'HH24:MI'),
        'retardo_hasta',  to_char((b.ini + make_interval(mins => s.tolerancia_min)) AT TIME ZONE app.tz(), 'HH24:MI'),
        'cambia_en', CASE WHEN s.estatus <> 'abierta' THEN NULL
                          WHEN b.m <  s.limite_presente_min THEN b.ini + make_interval(mins => s.limite_presente_min)
                          WHEN b.m <= s.tolerancia_min      THEN b.ini + make_interval(mins => s.tolerancia_min) END)
      FROM b $$;

-- Piso de privacidad FIJO (constantes, no parámetro: el técnico no debe poder bajarlo).
CREATE OR REPLACE FUNCTION app.conteo_aula(p_n integer, p_inscritos integer) RETURNS integer
    LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE WHEN p_inscritos < 5 THEN NULL                               -- no se proyecta conteo
                WHEN p_inscritos < 15 AND p_n < p_inscritos THEN (p_n / 5) * 5  -- tramos de 5
                ELSE p_n END $$;                                             -- exacto si es grande o si está completa

CREATE OR REPLACE FUNCTION public.api_sesion_aula(p_id_sesion integer) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public, app, pg_temp AS $$
DECLARE s public.sesion_clase%ROWTYPE; v_ahora timestamptz := app.now(); v_insc int; v_en int; v_conf int;
        v_ult timestamptz; v_aper timestamptz; v_aprox boolean := false; v_dur numeric;
        v_base numeric := app.param_num('minutos_pase_lista_base');
BEGIN
    PERFORM app.exigir_rol('docente');
    s := app.sesion_autorizada(p_id_sesion, false);          -- titular; NO_ENCONTRADO / NO_AUTORIZADO
    SELECT count(*) INTO v_insc FROM inscripcion i WHERE i.id_grupo = s.id_grupo AND i.estatus = 'activa';
    SELECT count(*) FILTER (WHERE a.estado IN ('presente','retardo')),
           count(*) FILTER (WHERE a.estado = 'pendiente'),
           max(a.hora_registro) FILTER (WHERE a.estado IN ('presente','retardo','pendiente'))
      INTO v_en, v_conf, v_ult
      FROM asistencia a JOIN inscripcion i ON i.id_alumno = a.id_alumno AND i.id_grupo = s.id_grupo AND i.estatus = 'activa'
     WHERE a.id_sesion = s.id_sesion;                         -- 'ausente' marcado a mano queda en por_contar
    v_aper := s.abierta_en;                                   -- F29
    IF v_aper IS NULL AND s.estatus IN ('abierta','cerrada') THEN  -- respaldo: sesiones previas a F29
        v_aprox := true; v_aper := least((SELECT min(marca_tiempo) FROM captura WHERE id_sesion = s.id_sesion),
                                         (SELECT min(hora_registro) FROM asistencia WHERE id_sesion = s.id_sesion AND origen = 'manual'));
    END IF;
    v_dur := CASE WHEN v_aper IS NOT NULL AND v_ult IS NOT NULL THEN greatest(0, floor(extract(epoch FROM v_ult - v_aper))) END;
    RETURN jsonb_build_object('ahora', v_ahora, 'reloj_simulado', app.reloj_simulado(),
        'sesion', /* id_sesion, materia, clave_grupo, aula, fecha, hora_inicio, hora_fin, estatus, modo_registro */ ...,
        'reloj', app.fase_de_sesion(s, v_ahora),
        'conteo', jsonb_build_object('visible', v_insc >= 5, 'inscritos', v_insc,
            'granularidad', CASE WHEN v_insc < 15 THEN 5 ELSE 1 END,
            'en_lista', app.conteo_aula(CASE WHEN v_insc < 15 THEN v_en + v_conf ELSE v_en END, v_insc),
            'confirmando', CASE WHEN v_insc >= 15 THEN v_conf END, 'por_contar', ...),
        'lista', jsonb_build_object('abierta_en', v_aper, 'apertura_aproximada', v_aprox, 'duracion_seg', v_dur,
            'minutos_pase_lista_base', v_base,
            'minutos_devueltos_est', CASE WHEN NOT v_aprox AND v_dur IS NOT NULL THEN greatest(0, floor(v_base - v_dur / 60.0)) END,
            'es_estimacion', true));
END $$;
-- COMMENT ON FUNCTION con ARGS/RETURNS/ERRORES/ROLES (fuente de docs/API-RPC.md); REVOKE PUBLIC, anon; GRANT authenticated.
```

**Forma JSON:**

```
{ahora, reloj_simulado,
 sesion:{…sin personas…},
 reloj:{fase, minuto_actual, presente_hasta:"07:10", retardo_hasta:"07:20", cambia_en},
 conteo:{visible, inscritos, granularidad:1|5, en_lista, confirmando|null, por_contar},
 lista:{abierta_en, apertura_aproximada, duracion_seg, minutos_pase_lista_base, minutos_devueltos_est|null, es_estimacion:true}}
```

Errores: `NO_AUTENTICADO`, `NO_AUTORIZADO`, `NO_ENCONTRADO`. No hay códigos nuevos y `STATUS_POR_CODIGO` no cambia.

**Pruebas SQL:** `supabase/tests/api_a_sesiones_06_aula.sql`, con el fixture `s3a_14` y el reloj a las 07:12. Deben comprobar:
- fase = retardo y `cambia_en` = 07:20;
- el texto del JSON no contiene `alumnos`, `nombre` ni ninguna matrícula del fixture;
- un ausente manual cuenta como `por_contar`;
- un grupo de menos de 15 da tramos de 5 y uno de menos de 5 da `visible = false`;
- `minutos_devueltos_est` es nulo con apertura aproximada.

En `review_sql_01_idor.sql`: otro docente y un alumno reciben `NO_AUTORIZADO`.

**Capa de datos:**
- `sesionAula()` en `web/src/lib/api/sesiones.js`.
- `sincronia.test.js` pasa de 82 a 83 (y se actualiza el texto del `it`).
- Regenerar `docs/API-RPC.md` con `scripts/gen-api-catalog.mjs`.

## 4. Cálculo

**a) Fase y frontera (SQL).** `app.fase_de_sesion` usa `app.estado_por_minuto`, la única definición de RN-03 (0130). `cambia_en` es un instante absoluto: inicio + `limite_presente_min` en fase presente, o inicio + `tolerancia_min` en retardo (el minuto 20 aún cuenta, con `<=`).

**b) Reloj sincronizado (cliente). Así cambian el proyector y el teléfono en el mismo segundo.** Hook compartido `web/src/hooks/data/useRelojFase.js`, que usan tanto `VistaAula` como la tarjeta «Ahora» de F08:
- **Desfase (algoritmo de Cristian).** `desfase_i = ahora_servidor − (t_envío + t_recibo)/2`. Se toma la `mediana` de los últimos 5 valores (`web/src/lib/numerics/stats/descriptiva.js`, importada directa para no cargar todo numerics). Así aguanta los picos de latencia de un Android con 3G; el error queda en ≤ RTT/2.
- **Tic alineado al segundo del servidor.** `setTimeout(1000 − ((Date.now() + desfase) % 1000))`, después cada 1 s. La cuenta «4:12» no salta entre sondeos.
- **Cambio de fase.** Al llegar a `cambia_en` la fase cambia en local (presente → retardo → fuera_de_ventana) y se fuerza `refetch()`. Como el proyector y el teléfono reciben el mismo `cambia_en` del servidor, cambian en el mismo segundo de servidor.
- **Lo que no se promete.** El fin del ritual por el docente no es determinista: el teléfono lo ve en su siguiente sondeo.
- **Reloj de demostración.** Ritmo `r = Δservidor / Δlocal` entre sondeos:
  - `r ≈ 0` (reloj en pausa): la cuenta se congela.
  - `|Δservidor − Δlocal| > 2 s` (salto de +5 min): se vacía el búfer de desfases.
  - En producción `reloj_simulado` es falso y `r = 1`.
  - La ventana del proyector no recibe `EVENTO_RELOJ_CAMBIO` (es un evento de `window`). Por eso `hooks/data/eventos.js` lo reemite por `BroadcastChannel('susan:reloj')` y `useApiQuery` escucha ambos.

**c) Redondeo de privacidad (SQL, `app.conteo_aula`).** Menos de 5 inscritos: no se proyecta el conteo. De 5 a 14: tramos de 5 hacia abajo, incluyendo los que están en confirmación. Con la lista completa la cifra es exacta, porque «todos llegaron» no expone a nadie.

**d) Tiempo de lista y minutos devueltos (SQL).**
- `duracion_seg` = último `hora_registro` contado − `abierta_en`.
- En automático, `hora_registro` es la primera lectura (0135), así que se subestima en unos 30 s. En manual es la hora de guardado.
- `minutos_devueltos_est = max(0, floor(5 − duracion/60))`. Es conservador y se oculta con apertura aproximada.
- La tarjeta de resumen congela el valor que tenía en el momento del corte.

## 5. Interfaz

**Se reutiliza:**
- `ui/MedidorLiquido` sobre `motion/SloshGauge`: tamaño libre y «reducir movimiento» ya resuelto. SISTEMA.md lo permite en la sesión en vivo.
- `sesion/VentanaTolerancia` (`geometriaVentana`).
- `ETIQUETA_FASE` y `formatearHora` de `monitorSesion.utils.js`.
- `ui/ConfirmDialog`, `ui/SegmentedControl` (selector de tema), `motion/Reveal` (entrada de la tarjeta de resumen), `motion/CountUp`.
- `lib/graficas.js` (`colorGrafica`, `resumenTexto`), `lib/motion` (`useEnVista`, `usePrefersReducedMotion`).
- `useApiQuery` con `refetchInterval: 5000`, que se apaga (`undefined`) fuera de la etapa de conteo.
- El tema `.dark` de `globals.css`, aplicado como clase en la raíz de la vista: la variante es `&:is(.dark *)`, así que queda acotado a la vista.

**Nuevos** (una carpeta por componente):

| Carpeta | Zona | Contenido |
|---|---|---|
| `components/ui/ArregloPuntos/` | ui-kit | `ArregloPuntos.jsx`, `arregloPuntos.utils.js` (`distribuirPuntos`, `columnasPara`), pruebas, `index.js`. Props: `grupos [{clave, valor}]` **en el orden en que se pintan** · `config {clave:{label, color, estilo:'relleno'\|'aro'\|'vacio'}}` · `granularidad` 1\|5 (separa bloques de 5) · `maxPuntos` 120 (si se pasa, «cada punto = N alumnos») · `leyenda` · `etiqueta` · `className`. **Solo recibe conteos**, así que no puede ordenar por llegada ni identificar a nadie. Es `role="img"` con `aria-label`; los puntos son `aria-hidden`. Tamaño `--tam-punto: 0.9em`. El encendido es una capa interna con `transform: scale` y `opacity` (280 ms); con «reducir movimiento» no hay transición. Precedente: `ui/CalendarioAsistencia`. |
| `components/sesion/VistaAula/` | screens-sesiones | `VistaAula.jsx`; `useVistaAula.js` (sondeo, `BroadcastChannel('susan-aula-<id>')` con avisos **sin datos** `refrescar`/`terminar`/`cerrar`, Wake Lock, teclado, cursor); `vistaAula.utils.js` (`etapaRitual`, `textoCuenta` «18 de 25» / «Entre 5 y 9 de 12», `formatoCuenta` «4:12», `textoDuracion` «1 min 42 s»); `SelectorTemaAula.jsx` (localStorage por equipo, con try/catch); pruebas. |
| `components/sesion/RelojFase/` | screens-sesiones | «PRESENTE HASTA 07:10», «4:12» en `text-presente` / `text-retardo` (siempre con texto, nunca solo color) y «Después: retardo hasta 07:20». La cuenta no es `aria-live`; solo se anuncia el cambio de fase (`polite`). |
| `components/sesion/TarjetaCierreAula/` | screens-sesiones | «Pase de lista en 1 min 42 s» · «23 de 25 en lista» · «Unos 3 min devueltos a la clase» con chip «Estimación» y la fórmula en una línea («5 min de pase tradicional − 1 min 42 s medidos») · «Los retardos se registran hasta las 07:20». |
| `components/sesion/BotonProyectar/` | screens-sesiones | `BotonProyectar.jsx`, `proyectar.js` (`abrirVentanaAula`: `isExtended`, `getScreenDetails`, respaldo y bloqueo de ventanas), `DialogoPantalla.jsx`, pruebas con objetos de pantalla simulados. |
| `app/(flujo)/docente/sesiones/[id]/aula/page.jsx` | screens-sesiones (pedido a §7) | Componente de servidor delgado: `const { id } = await params`, valida el entero, `await requerirSesion(['docente'])` (el guardia de `(app)/docente/layout.jsx` no se hereda) y `metadata.title = 'Modo Aula'`. Mismo nombre de segmento `[id]` que en `(app)`. |

**Cambios a componentes existentes:**
- `MedidorLiquido`:
  - `cifra = { valor, sufijo }`, por omisión `{nivel, ' %'}`. Permite «18 de 25» con `CountUp to={18} suffix=" de 25"`.
  - `escala = 'normal' | 'aula'`: la cifra en `3.2em`, relativa a `--escala-aula`.
  - El ancho y el alto en px los calcula `VistaAula` en un efecto, para no romper la hidratación.
- `VentanaTolerancia`: `variante="aula"` (barra de 0.5em y etiquetas con hora «07:10/07:20»).
- `PaseListaManual`: con proyección activa, interruptor «Guardar al marcar» (por omisión encendido). Cada 3 s manda un lote atómico de `api_pase_lista_manual`. Si falla, vuelve a «Guardar» con el toast de siempre.

**Escala y temas** (pedido al integrador, en `globals.css`):

```css
.aula { --escala-aula: clamp(16px, 2.6vmin, 44px); font-size: var(--escala-aula); } /* 1080p => 28.1 px; 360 px => 16 px */
.alto-contraste { --background:#ffffff; --foreground:#000000; --card:#ffffff; --border:#000000;
  --muted:#e9e9e9; --muted-foreground:#1a1a1a; --presente:#0a5c33; --g-presente:#0a7a43;
  --retardo:#7a4a00; --g-retardo:#a85f00; --g-pendiente:#3d3d3d; }               /* objetivo: 7:1 en texto */
```

- Todo dentro de la vista va en `em`.
- **Alto contraste** (fondo blanco y trazos gruesos) es para aulas iluminadas: el proyector rinde más en fondo claro.
- **Oscuro** (`.dark`) es para aulas con poca luz.
- **Movimiento:** solo `transform`/`opacity`, más el `clip-path` de `SloshGauge` (excepción ya documentada). El cambio de etapa es un fundido de 300 ms. Con «reducir movimiento» no hay chapoteo, las cifras cambian de golpe y el color de fase se intercambia sin transición.

**Peso:**
- Ruta propia, separada por Next: no suma nada a `/docente`.
- En `/docente/sesiones/[id]` solo entra `BotonProyectar` (estimado ~1,5 KB gz; hay que medirlo).
- Se agrega `'/docente/sesiones/[id]/aula': '(flujo)/docente/sesiones/[id]/aula'` a `RUTAS` de `scripts/measure-bundle.mjs`, con un presupuesto de `/login` + 10 %.

## 6. Privacidad, ética y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Nombres o estados individuales en pantalla compartida | La RPC solo devuelve agregados; el navegador del proyector nunca los recibe. Sin feed de cámara ni recortes. Prueba SQL que busca matrículas en el JSON. |
| Inferir quién llegó tarde en grupos chicos | Piso fijo en SQL: menos de 5 inscritos, sin conteo; de 5 a 14, tramos de 5 sin separar «confirmando». Nunca se muestra el orden de llegada (la primitiva no puede hacerlo). Sin separar presentes y retardos. Lo único que se ve en el momento (alguien entra y sube la cuenta) ya lo ve todo el salón. |
| Pantalla duplicada que proyecta la vista privada | `screen.isExtended` y `getScreenDetails`, o una confirmación explícita. Con «Usar solo esta pantalla», la ventana **no** se cierra sola (queda «Clase en curso») y se recomienda pasar lista desde el celular. La detección es heurística: solo se puede decir «no veo una segunda pantalla». |
| Presión social / ClassDojo | Vocabulario neutro: «en lista», «confirmando», «por llegar». Nunca «falta» ni «ausente». Sin rankings, sonidos ni celebraciones individuales. Indicación genérica «¿No apareces? Avisa a tu profesor al terminar». La confirmación personal va al teléfono de cada alumno (F08). |
| Prometer inmediatez | Sondeo de 5 s más muestreo de 15 s y 3 lecturas. El aro de «confirmando» aparece en ≤ 20 s. No se dice «en tiempo real». |
| Inflar el impacto | «Estimación» siempre visible, con la fórmula. No se muestra nada si la apertura es aproximada. Nunca hay negativos. |
| Ventana del docente tapada en modo una pantalla | Chrome puede marcarla como oculta y `useApiQuery` pausa el sondeo. Hay que verificarlo con la cámara de navegador. Se recomienda cámara IP o controlar desde el celular. |
| LFPDPPP | No se trata ningún dato personal nuevo ni se guarda nada nuevo. Un conteo agregado con piso de anonimato no identifica a nadie. Se agrega una línea al aviso de privacidad: «se proyectan solo cifras del grupo». |

## 7. Plan

**MVP demostrable (unos 5,5 días, M):**

| Pieza | Esfuerzo |
|---|---|
| 0137 (`fase_de_sesion`, `conteo_aula`, `api_sesion_aula`) + respaldo sin F29 + pruebas SQL + IDOR + catálogo + envoltorio + sincronía | 1 d |
| `ui/ArregloPuntos` + pruebas + fila en SISTEMA.md | 1 d |
| `MedidorLiquido` `cifra`/`escala` + `VentanaTolerancia variante="aula"` | 0,5 d |
| `VistaAula` (espera/conteo/resumen), `RelojFase`, `TarjetaCierreAula`, ruta `(flujo)` | 1,5 d |
| `BotonProyectar` (`window.open` + `isExtended` + confirmación + botón de pantalla completa + BroadcastChannel `refrescar`/`terminar`) | 0,75 d |
| Temas `.alto-contraste`/`.dark` + `--escala-aula` | 0,25 d |
| Verificación a 360 px y 1080p, «reducir movimiento», medición del bundle | 0,5 d |

**Versión completa (+3 días):**

| Pieza | Esfuerzo |
|---|---|
| Colocación con `getScreenDetails` y manejo del permiso | 0,5 d |
| `useRelojFase` compartido con F08 (mediana, reloj en pausa, cambio en `cambia_en`) | 0,75 d |
| Autoguardado de `PaseListaManual` mientras se proyecta | 0,5 d |
| Puente `BroadcastChannel` para `EVENTO_RELOJ_CAMBIO` | 0,25 d |
| Wake Lock, cursor, teclas del clicker, cierre automático | 0,5 d |
| DECISIONS (estimación por sesión vs `api_impacto_tiempo`; umbrales fijos), DEMO.md, aviso de privacidad | 0,5 d |

Medición del valor (propuesta del juez, fase posterior): comparar las correcciones `retardo → presente` (bitácora `correccion` de `api_corregir_asistencia`) por docente, 4 semanas antes y después de que empiece a usarlo. Marcar qué sesiones se proyectaron requeriría guardar un dato nuevo, y eso queda fuera de este alcance.

**Pedidos fuera de la zona de screens-sesiones:**
- **db-api-a:** 0137 y pruebas.
- **db-schema / F29:** `abierta_en`.
- **db-api-b:** regenerar `docs/API-RPC.md`.
- **data-layer:** `sesionAula`, sincronía 83, `useRelojFase`, puente en `eventos.js` / `useApiQuery`.
- **ui-kit:** `ArregloPuntos`, `MedidorLiquido`, emisión desde `layout/RelojDemo/useRelojDemo.js`.
- **integrador:** `globals.css`; ARCHITECTURE §3 (ruta nueva) y §7 (dueño de `(flujo)/docente/**`); `measure-bundle.mjs`.
- **docs:** SISTEMA.md, DECISIONS.md, DEMO.md.

## 8. Guion de demo (60 s)

Preparación: `scripts/seed-demo.sh --reset` y el reloj de demostración fijado a las 07:00:20 en modo «Correr». La sesión es **manual**, para mostrar que no depende de la cámara. Laptop con el proyector en modo extendido y el celular del docente a mano.

| Tiempo | Qué se hace | Qué se dice |
|---|---|---|
| 0–8 s | En la laptop, la sesión abierta con nombres; se pulsa «Proyectar». | «Esta es la pantalla del docente: nombres, estados. No se puede proyectar.» |
| 8–18 s | En el proyector, 25 asientos apagados y «Presente hasta 07:10 · 9:38». | «Lo que ve el salón: el grupo, el reloj de puntualidad, ningún nombre.» |
| 18–35 s | Desde el celular (360 px) se marcan alumnos y se pulsa «Todos presentes» a la mitad. Los asientos se encienden y el tanque sube a «18 de 25». | «El docente marca desde su teléfono y el salón ve subir la cuenta. Con cámara o a mano, es lo mismo.» |
| 35–45 s | Se fija el reloj a 07:09:55. A las 07:10:00 el reloj pasa a ámbar «Retardo hasta 07:20» y, si existe F08, el teléfono del alumno cambia en el mismo segundo. | «La regla ya no se discute después: todos la vieron cambiar.» |
| 45–60 s | Se pulsa el clicker y aparece la tarjeta «Pase de lista en 1 min 42 s · 23 de 25 · unos 3 min devueltos a la clase (estimación)». A los 15 s la ventana se cierra sola. | «Un minuto y medio, sin un solo nombre en pantalla. Quien no aparece lo ve en su propio teléfono, no frente a todos.» |

## 9. Entrada en `web/src/lib/modulos.js`

No es un módulo con ruta propia: es una acción dentro de «Pasar lista» que necesita el `id` de la sesión. Un módulo `activo` exige un `href` presente en `NAV_POR_ROL` (lo verifica `modulos.test.js`). Mientras esté en la hoja de ruta, se registra como `pronto`, importando `Projector` de `lucide-react`:

```js
{
    id: 'modo-aula', titulo: 'Modo Aula', descripcion: 'Proyecta el pase de lista como un contador del grupo: asientos que se encienden, cuenta regresiva y ningún nombre.',
    icono: Projector, categoria: 'asistencia', roles: ['docente'], estado: 'pronto', tono: 'verde',
    queIncluye: ['Contador anónimo del grupo en el proyector', 'Reloj de puntualidad visible para todo el salón', 'Tiempo de lista y minutos devueltos a la clase (estimación)'],
},
```

Al lanzarlo se quita la entrada `pronto`. La función queda en el botón «Proyectar» de la sesión, y la descripción de `pasar-lista` puede terminar en «…con la cámara del aula o a mano, y proyectarla al grupo» (sigue cumpliendo `/cámara/i`).

**Archivos clave leídos:**
- /Users/diegoguerrero/Developer/SUSAN/supabase/migrations/0130_sesiones_helpers.sql
- /Users/diegoguerrero/Developer/SUSAN/supabase/migrations/0131_api_sesion_docente.sql
- /Users/diegoguerrero/Developer/SUSAN/supabase/migrations/0133_api_sesion_cierre.sql
- /Users/diegoguerrero/Developer/SUSAN/supabase/migrations/0103_series_alertas_rpc.sql
- /Users/diegoguerrero/Developer/SUSAN/web/src/components/sesion/SesionClase/SesionClase.jsx
- /Users/diegoguerrero/Developer/SUSAN/web/src/components/sesion/PaseListaManual/PaseListaManual.jsx
- /Users/diegoguerrero/Developer/SUSAN/web/src/components/ui/MedidorLiquido/MedidorLiquido.jsx
- /Users/diegoguerrero/Developer/SUSAN/web/src/hooks/data/useApiQuery.js
- /Users/diegoguerrero/Developer/SUSAN/web/src/app/(flujo)/layout.jsx
- /Users/diegoguerrero/Developer/SUSAN/web/src/app/globals.css
- /Users/diegoguerrero/Developer/SUSAN/web/src/lib/modulos.js