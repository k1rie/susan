# SUSAN: features «WOW» más allá del reconocimiento facial

*Informe final para el autor, 8-oct-2026. El ranking ya estaba calculado (wow 35 %, valor 25 %, factibilidad 25 %, solidez 15 %) y no se recalculó. Las cifras de los momentos wow son ilustrativas, salvo que se diga otra cosa.*

---

## 1. Resumen ejecutivo

- **Cerrar el ciclo (F04 + F05).** Al cerrar la lista, cada ausente recibe una nota firmada por su docente. Cada mañana, la «Mesa de hoy» elige 3 acciones, y la respuesta del alumno aparece sola en el panel. Es la idea con mejor evidencia del informe (Cortinhas 2025; Carrell y Kurlaender 2023; Rogers y Feller 2018).
- **«¿Lo habríamos visto venir?» (F19).** Rebobina el semestre y muestra en qué semana habría avisado SUSAN, con sus falsas alarmas y su único fallo. Responde «¿cómo saben que acierta?» y luce los métodos numéricos. Esfuerzo M.
- **«¿Y si falto?» con espejo (F09 + modo individual de F10).** El alumno adivina cuántas faltas lleva, ve la cifra real y simula su margen. Pasa de vigilado a usuario y se cubre RF-21, que hoy no tiene pantalla.
- La foto de la demo es el Modo Aula (F01). Tres reglas valen para todo: nada individual en pantallas compartidas, el alumno nunca ve puntajes y ninguna cifra se presenta como efecto causal.

---

## 2. Top 12

| # | id | Idea | Momento wow | W · V · F · S | Total | Esfuerzo real |
|---|---|---|---|---|---|---|
| 1 | F19 | ¿Lo habríamos visto venir? | Se rebobina el semestre y SUSAN avisa semanas antes; muestra su único fallo a propósito | 8 · 6 · 8 · 9 | 7.65 | M |
| 2 | F04 | «Te extrañamos hoy» al cerrar la sesión | La nota firmada llega al teléfono y su «Necesito apoyo» vuelve al panel | 8 · 9 · 6 · 6 | 7.45 | L |
| 3 | F05 | Mesa de hoy | 3 acciones del día con borrador exacto; la respuesta del alumno cambia la fila sola | 9 · 9 · 4 · 6 | 7.3 | XL |
| 4 | F09 | «¿Y si falto?»: margen para imprevistos | Toca «jue 17» y el tanque del margen baja; «Justificar ahora» | 8 · 7 · 7 · 6 | 7.2 | M |
| 5 | F08 | «Todavía llegas» | La tarjeta pasa sola de «Registrando…» a «Registrado 07:17 · Retardo» | 6 · 6 · 9 · 8 | 7.05 | M |
| 6 | F01 | Modo Aula | 25 asientos se encienden en el proyector sin un solo nombre | 8 · 4 · 8 · 8 | 7.0 | M |
| 7 | F10 | Espejo de faltas | «Creías 2 · Llevas 4»; la nube anónima muestra que casi todos subestiman | 9 · 7 · 5 · 5 | 6.9 | L |
| 8 | F03 | Pase por frase | Una frase y 25 registros coloreados en unos 10 s | 8 · 4 · 8 · 7 | 6.85 | M |
| 9 | F07 | Corte de parcial | «2 decisiones pendientes cambian un derecho» | 6 · 7 · 7 · 7 | 6.65 | M |
| 10 | F13 | Wrapped de SUSAN | El grupo grita «¡viernes!» y se revela «Lunes · 21 %» | 9 · 4 · 7 · 5 | 6.65 | L |
| 11 | F23 | Quiebres de ritmo con titular | La línea se parte en dos escalones: «antes 1 de cada 12; desde el 31-ago, 7 de cada 10» | 6 · 7 · 7 · 7 | 6.65 | M |
| 12 | F02 | Copiloto flotante | Sobre PowerPoint aparece «Volvió hoy: Luis R., tras 3 faltas» | 7 · 6 · 7 · 6 | 6.6 | M |

---

## 3. Agrupación

### Golpes rápidos (wow 7 o más, esfuerzo M)
- **F19** (wow 8): es JS puro sobre `api_matriz_grupo` recortada. Con la semilla actual, 15 cortes tardan unos 55 ms y no hace falta un Worker.
- **F09** (wow 8): `api_serie_alumno` y `proyectarSerie` ya existen y nadie los usa. La RPC nueva es STABLE y no escribe nada.
- **F01** (wow 8): es una versión recortada de `api_sesion_monitor`. Vive en una ruta aparte, así que no suma peso a `/docente`.
- **F03** (wow 8): un intérprete puro sobre `api_pase_lista_manual`, sin migraciones. Su valor es bajo (4) porque «Todos presentes» ya resuelve casi lo mismo.
- **F02** (wow 7): no necesita SQL nuevo. Pero solo funciona en Chrome/Edge de escritorio, y antes hay que medir que la captura siga corriendo con la ventana tapada.
- **F27** (wow 7): construirlo es rápido, pero su solidez es 4 (finalidad nueva y riesgo de coerción). En la práctica no es un golpe rápido hasta que pase por revisión jurídica.
- Dos complementos de wow 6 que conviene sumar: **F08** (factibilidad 9; se sincroniza con F01) y **F23** (el motor de quiebres que alimenta a F05).

### Apuestas insignia (wow 7 o más, esfuerzo L/XL)
- **F05 Mesa de hoy** (9, XL): baja a L si se hace sin LLM y sin Tutorías, sobre la mensajería de F04.
- **F04 Te extrañamos hoy** (8, L): inaugura Comunicados y define la tabla `mensaje` que comparten varias ideas.
- **F10 Espejo** (9, L): el modo aula es frágil en vivo; el modo individual cabe dentro de F09.
- **F13 Wrapped** (9, L): solo vale la versión del grupo; necesita una semilla de fin de periodo.
- **F28 Hoja que se lee sola** (8, L): la lectura óptica de la hoja (homografía resuelta con Gauss) es espectacular, pero frágil con fotos reales.
- **F25 Pregúntale a SUSAN** (8, L): el enrutador sin proveedor es el producto; el LLM sería un experimento.
- **F15 Mesa de casos** (7, XL), **F24 Receta exacta** (7, XL; la receta sola es S), **F21 Monte Carlo frente a Markov** (7, L), **F26 Sala de control** (7, L), **F11 Justifica en 30 s** (7, XL; la fase 1 es M).
- Recomendación: construir primero solo F04 + F05. F10 entra dentro de F09, y F13 queda como cierre opcional.

### Elevan la hoja de ruta (módulos «pronto» de `web/src/lib/modulos.js`)

| Módulo | Ideas que lo vuelven real | Primer entregable sugerido |
|---|---|---|
| comunicados | F04 (lo inaugura), F07 (avisar a «los de la orilla»), F27 (complemento) | Tabla `mensaje` única, la nota al cerrar la sesión y la bandeja persistente del alumno |
| asistente | F05 (lista del día y borradores), F25 (preguntas), F24 («explícame el riesgo») | Mesa de hoy con plantillas deterministas; el enrutador por intención de F25 antes de cualquier LLM |
| tutorias | F15, F24, F31, F14 | Caso con responsable, plazo de 48 h y cierre solo con contacto registrado; «¿Funcionó?» queda para una fase 2 |
| notificaciones | Ninguna idea construye el canal (hueco señalado por el crítico) | v1: la bandeja que se queda guardada en la app (F04/F05). Después: PWA con Web Push sin PII y 2-3 lotes al día |
| calificaciones | F07 | El derecho a examen calculado a una fecha, sin calificaciones (siguen fuera de alcance) |
| horarios | F32, F17 | Solo el contador «clases sin impartir por causa» y los minutos que cayeron a pase manual |
| acceso-campus | Ninguna | Se mantiene fuera: es una finalidad nueva del rostro |

El texto `queIncluye` de cada módulo se puede alinear con estos entregables sin tocar pantallas.

### Para el día de la demo
- **F01 + F08**: proyector y teléfono del alumno cambian en el mismo segundo.
- **F04 + F05** a dos pantallas, con un segundo dispositivo propio y una cuenta de la semilla, no el teléfono de un voluntario.
- **F19**: el rebobinado se ata al reloj de demostración.
- **F10 en modo aula**: solo con punto de acceso propio y un video de respaldo.
- **F13**: la historia del grupo como cierre. **F26**: «la mañana de la FCA en 60 s» como apertura del video, solo si se amplía la semilla. **F02**: para una toma de video, con las diapositivas y la ventana flotante.
- Requisitos técnicos: modo local (con `next start`, las rutas `/api/_local/*` responden 404), `next dev -H 0.0.0.0` con `allowedDevOrigins` para los teléfonos en la LAN, y sondeo de 5 s en lugar de push.

---

## 4. Fichas del top 10

### F19 · ¿Lo habríamos visto venir? (7.65 · M)
**Pitch.** Un control regresa el semestre a la semana 2, 3 o 4 y vuelve a calcular el riesgo usando solo lo que se sabía en esa fecha. Luego lo compara con lo que pasó: aciertos, falsas alarmas y semanas de anticipación, por grupo y por franja horaria.

**Momento wow.** El evaluador pone el control en la semana 3 y pulsa reproducir. La matriz de alumnos por semanas se va encendiendo y dos alumnos quedan en ámbar semanas antes de cruzar el 20 %. Al final aparece una sola cifra grande («avisó a N de M, con X semanas de anticipación · K falsas alarmas») junto al fallo, que se muestra a propósito: el abandono repentino de k18 «no se podía prever; se detectó 2 sesiones después».

**Cómo funciona.**
- Es una pestaña en `/analitica`, más una vista agregada `/analitica/modelo` para el administrador.
- Para cada corte w, se recorta `api_matriz_grupo` a `estados.slice(0, w)` y se vuelven a correr `analizarGrupo` y `evaluarRiesgoGrupo` con las mismas 48 sesiones programadas. Ese número se conoce desde el inicio, así que no hay fuga de información.
- La verdad es `en_limite` o `supera_limite` a la fecha de referencia. Solo se evalúa a quien en el corte todavía no estaba en el límite.
- Funciones puras nuevas en `lib/numerics/evaluacion`: `backtest`, `matrizConfusion`, `curvaUmbral`, `calibracion` e `intervaloWilson`.
- Visuales:
  - `ui/MatrizCalor` con los 8 casos relevantes; el resto va en Detalles.
  - BarraSegmentada en frecuencias («8 de 9»).
  - StatCard con la mediana de semanas de anticipación.
  - Curva de sensibilidad contra umbral en GraficaLinea, con marcas en 35 y 60.
- La ficha del modelo va en Detalles: los 7 factores, PESOS_RIESGO, lo que NO usa (nada demográfico), n y limitaciones.
- Mover el umbral solo reclasifica puntajes ya calculados, así que la respuesta es instantánea. Con «reducir movimiento» se salta directo al resultado.

**Por qué vale.**
- Course Signals anunció +21 puntos de graduación y resultó ser sesgo de selección (eliterate.us).
- El DEWS de Wisconsin se equivoca en cerca de 3 de cada 4 predicciones de no graduación y da más falsas alarmas con minorías (PBS Wisconsin / The Markup).
- En el Tec de Monterrey, el umbral por defecto solo detectaba al 13.2 % de quienes abandonaban (Frontiers in Education 2023).
- Ortiz-Lozano (2024) validó con corte temporal y obtuvo 77 % de exactitud usando solo datos académicos.
- SUSAN puede mostrar lo que casi ningún producto enseña: su propio error. De paso deja calibrado el umbral que usará la Mesa de hoy.

**Reutiliza.** `api_matriz_grupo`, `api_serie_grupo`, `useAnalitica`/`matrizCompleta`, `evaluarRiesgoGrupo`, `PESOS_RIESGO`, `agruparSemanas`, `trapecioDatos`, ui/Tabs, SegmentedControl, BarraSegmentada, StatCard, GraficaLinea, Detalles, PasoView, `usePrefersReducedMotion` y el reloj de demostración.

**Riesgos y mitigación.**
- **Acierto circular**: los patrones de la semilla se diseñaron para detectarse. Hay que rotular siempre «validación del método con datos de demostración» y sembrar un periodo cerrado 2026-1 con ruido que no esté diseñado para el detector (mejora de los jueces de valor y de solidez).
- **n pequeño**: hay 6 semanas cerradas y unos 6 a 9 positivos por grupo. Se muestran siempre Wilson y n. La anticipación máxima real hoy ronda las 4 semanas; la cifra de «4.6 semanas» solo existe con 2026-1.
- **E260001**: `scripts/demo/limites.sql` lo forzó al límite. Hay que excluirlo o marcarlo para que no contamine la verdad.
- **Denominador sucio**: las sesiones programadas que nunca se abren lo inflan. Conviene tomar antes el corte mínimo de F29.
- **Coordinación**: hay tres dueños (numerics, ui-kit y screens-analitica). No existe un rol «evaluador»; se usa una cuenta de administrador o de docente.
- **Mejora del juez wow**: una sola cifra protagonista y un rebobinado literal con «Llevar el reloj a esta semana» (solo en modo local).

### F04 · «Te extrañamos hoy» al cerrar la sesión (7.45 · L)
**Pitch.** Al cerrar la sesión, SUSAN muestra el tiempo devuelto a la clase y prepara, para cada ausente, una nota firmada por el docente. La nota dice qué se vio, trae el conteo real de faltas y ofrece tres salidas de un toque.

**Momento wow.** La docente cierra la lista y dicta el tema del día. ResumenSesion muestra «22 de 25 · unos 5 min devueltos hoy (estimación)» y «3 ausentes · 3 notas listas», cada una con su contexto: «primera falta en 9 sesiones», «tercera falta seguida», «le quedan 2». Toca «Enviar». En el segundo teléfono aparece: «Te extrañamos hoy en Contabilidad II. Vimos depreciación en línea recta. Llevas 4 faltas; te quedan 5. — Mtra. López». El alumno toca «Necesito apoyo · Transporte» y en el panel de la docente aparece «1 alumno pidió apoyo».

**Cómo funciona.**
1. Un campo opcional «¿Qué vieron hoy?» en CierreSesionDialog.
2. Un recibo en ResumenSesion con StatCard y CountUp sobre `api_impacto_tiempo`, siempre como estimación.
3. Notas solo para ausentes sin justificante. Los pendientes no reciben nota, porque pueden ser errores de reconocimiento sin revisar.
4. Una de 4 plantillas cálidas, elegida por una función pura según la serie del alumno: primera falta, cambio de ritmo (`cusum`/`ewmaControl`), cerca del límite con meta de conducta, o habitual. Los marcadores numéricos los rellena el servidor. La nota siempre se puede editar y nunca se envía sola.
5. `api_aviso_enviar` (DEFINER) valida que quien envía sea el titular y que el alumno haya faltado, con tope de 1 nota por alumno, materia y semana.
6. La bandeja persistente en `/alumno` usa `api_mis_mensajes` con `leido_en` y ofrece tres salidas: «Justificar» (el enlace `/alumno?justificar=` ya existe), «Todo bien» y «Necesito apoyo».

**Por qué vale.**
- Cortinhas (2025, International Review of Economics Education): un correo personal justo después de faltar subió la asistencia universitaria a la sesión siguiente.
- Carrell y Kurlaender (2023, AEJ: Economic Policy): 2 o 3 correos del profesor mejoraron calificaciones, persistencia y titulación en grupos subrepresentados.
- AIR/IES: los mensajes del personal funcionan mejor que los automáticos.
- Rogers y Feller (2018): el conteo real corrige la subestimación (las familias creían 9.6 faltas y eran 17.8).
- Stanford SCALE: la carta simple y de apoyo rindió alrededor de 40 % más (en términos relativos) que la legalista.
- Ojo: buena parte de esta evidencia viene de educación básica o de mensajes a padres. En universitarios es una extrapolación que se puede medir.

**Reutiliza.** La respuesta de `api_cerrar_sesion` (hoy MonitorSesion la descarta; hay que propagarla), CierreSesionDialog, ResumenSesion, `api_impacto_tiempo`, `api_serie_alumno` (sin consumidor), `v_resumen_asistencia`, `cusum`/`ewmaControl`, el valor `notificacion` que ya existe en `accion_bitacora`, el enlace al justificante, `correo_institucional`, IndicadoresPendientes y el precedente de laboratorios (0240/0241).

**Riesgos y mitigación.**
- **Entrega.** Sin correo ni push, la nota solo existe si el alumno abre el portal; según LIFT, cuando falla la entrega el efecto desaparece. Desde el primer día: un `mailto` prellenado al correo institucional y el registro de `leido_en`. Web Push de la PWA, después.
- **Tono.** Plantillas revisadas, editables y variadas. Ante causas graves, la nota sugiere justificar.
- **«Necesito apoyo».** En la v1 va sin la categoría salud, la ve solo el titular y lleva el aviso «no es un canal de emergencias». Se convierte en caso de Tutorías cuando ese módulo exista (el juez de solidez pide dividirlo en dos entregas).
- **Solapamiento con F05.** Una sola tabla `mensaje` y una sola bandeja (jueces de wow y de valor).
- **Costo.** Son 3 tablas y unas 6 RPC, que obligan a actualizar `schema_01_estructura` (hoy cuenta 21 tablas) y `sincronia.test.js`. Hay que definir retención y purga.
- **Promesas.** Prometer solo mejora de asistencia, y como estimación, no mejora académica.

### F05 · Mesa de hoy (7.3 · XL; L en la v1 recomendada)
**Pitch.** Al abrir `/docente`, SUSAN ya eligió las 3 acciones del día, cada una con su motivo en una línea y un borrador firmado. El docente aprueba con un toque y ve llegar la respuesta del alumno.

**Momento wow.** El proyector muestra «3 cosas para hoy». La primera dice: «Luis M. (3A) faltó 3 de las últimas 4 sesiones; le quedan 2 faltas», con su Sparkline real. «Escribirle» abre un borrador con cifras exactas y una meta de conducta: «si vienes a las próximas 6 clases conservas tu derecho a examen». Cuando el alumno responde, la fila cambia sola a «Contestó · transporte · hace 3 s» y aparece una cifra memorable: «de alerta a respuesta: 42 s». Para cerrar, se fija el reloj al día siguiente y la mesa se reacomoda.

**Cómo funciona.**
- La sección va entre PasarListaHero e IndicadoresPendientes y se carga con React.lazy.
- Un selector determinista (`armarMesa`) junta 5 fuentes con una regla visible:
  - quiebres de ritmo nuevos (F23 o CUSUM/EWMA);
  - alumnos a 1 o 2 faltas del límite (`api_alertas_docente`, hoy sin consumidor);
  - el día crítico del alumno cuando coincide con hoy;
  - justificantes a punto de vencer;
  - sesiones sin cerrar.
- Un alumno solo entra si es nuevo o cambió de nivel. El tope es fijo, 3 por defecto, y un Detalles explica «por qué estos y no otros».
- Acciones: «Escribirle», «Ya hablé», «Posponer 3 días» y «No aplica».
- Los borradores salen de plantillas fijas: aviso, «te extrañamos» y reconocimiento de mejora cuando la EWMA del alumno cambia de signo.
- La bandeja del alumno se comparte con F04: «Ahí estaré», «Necesito apoyo» y «Quiero hablar en asesoría».
- StatCards de proceso: tiempo de la alerta al contacto y porcentaje de alertas con respuesta.

**Por qué vale.**
- Georgia State: cada alerta termina en contacto humano en unas 48 h, y lo decisivo fueron los asesores, no el algoritmo (NPR).
- Alerta Escuela (Perú): solo el 7 % de las escuelas con alumnos en riesgo entró a la plataforma. Predecir sin un flujo de acción no sirve (Banco Mundial).
- EAB Navigate360: la lista diaria de prioritarios funciona, pero se le critica que sin priorización satura (rfp.wiki).
- Fitz et al. (2019): los avisos en lotes predecibles mejoran la atención.
- Clark et al. (2020): las metas de conducta funcionan; las de resultado, no.

**Reutiliza.** `api_docente_panel`/ContenidoPanel (ya diferido), `api_alertas_docente`, `api_serie_alumno`, `analizarGrupo` (cambios, `diaCritico`, `alumnosEnRiesgo`), `evaluarRiesgoAlumno`, `api_cola_revision` (`vence_en`), TarjetaFila, Sparkline (con serie real), PanelLateral, Detalles y `useApiQuery` con `refetchInterval`.

**Riesgos y mitigación.**
- **Alcance XL.** La v1 va sin LLM y sin Tutorías, sobre la mensajería de F04, y así queda en L.
- **LLM con datos de alumnos.** Queda fuera de la v1. Si algún día entra: solo hechos con id seudónimo, cifras rellenadas por el servidor y una prueba de que cada número coincide con el cálculo.
- **Saturación.** Tope fijo y regla visible.
- **Métrica inflada.** «Ya hablé» se puede marcar sin contacto real; se rotula como métrica de proceso, no de impacto.
- **Demo frágil.** En lugar del teléfono de un voluntario, un segundo dispositivo propio con una cuenta de la semilla. La respuesta llega por sondeo de 5 s; no se promete push.
- **Reloj.** RelojDemo no tiene botón «+1 día»; se usa «Fijar hora».
- **Presupuesto.** A `/docente` le quedan 14.6 KB gzip de margen: datos y cálculo van en un chunk diferido. BottomNav no admite contadores; hay que extender la primitiva.

### F09 · «¿Y si falto?»: margen para imprevistos (7.2 · M)
**Pitch.** Un simulador por materia sobre las próximas sesiones reales del alumno. Con la regla oficial (3 retardos = 1 falta), dice cuántas faltas le quedarían y si conserva el derecho a examen.

**Momento wow.** El alumno marca «jue 17» como falta. El MedidorLiquido «Margen» baja y chapotea, y aparece la frase «Te quedaría 1 falta». Marca «lun 21» como retardo y tres marcas se funden en una: «llevas 2 retardos sueltos; este completaría una falta». «Justificar ahora» abre el formulario con la sesión ya elegida.

**Cómo funciona.**
- Un botón en CifrasMateria abre un PanelLateral, que en el teléfono ocupa la pantalla completa (no hay hoja inferior).
- Arriba: «Margen para imprevistos: 4 de 9 faltas». En medio: una tira con las 8 próximas sesiones reales, que arranca en «asistiré». Abajo: frases en días, no en porcentajes («4 ausencias + 3 retardos = 5 faltas»).
- La regla vive en SQL. La aritmética de `v_resumen_asistencia` se extrae a funciones puras (`app.faltas_equivalentes`, etc.) sin cambiar las columnas de la vista. `api_simular_margen` (STABLE, sin escritura) reutiliza esas funciones, y una prueba cruzada comprueba que un escenario vacío da lo mismo que la vista.
- `api_mis_proximas_sesiones` expone las sesiones programadas del alumno. Los toques se agrupan 250 ms con `useDebounce`.
- El primer paso opcional es el Espejo en modo individual (F10): «¿Cuántas faltas crees que llevas?», y luego el revelado con CountUp.

**Por qué vale.**
- Hay demanda espontánea: las calculadoras de faltas («bunk calculators») en India y las reseñas de Saeko que piden alertas de faltas.
- Rogers y Feller: el conteo absoluto corrige la subestimación y la comparación con compañeros no sumó efecto.
- HvA (2023): un tablero con el pronóstico propio subió la motivación.
- Cumple RF-21: la «ProyeccionAlumno» de `docs/api/reportes-analitica.md` §2.2 no existe en pantalla y `api_serie_alumno` no tiene consumidor.

**Reutiliza.** `api_alumno_resumen`, `v_resumen_asistencia`, `api_serie_alumno`, `proyectarSerie`/`buscarCruce`, las sesiones futuras que el alumno ya puede leer por RLS, `api_mis_justificables`, el enlace `/alumno?justificar=`, MedidorLiquido (permitido en la vista del alumno), PanelLateral, Pills, StatusChip y Detalles.

**Riesgos y mitigación.**
- **Incentivo perverso**: puede leerse como una calculadora de faltas.
  - Se llama «Margen para imprevistos», arranca en «si asistes» y con margen amplio dice «guárdalo para lo que no controlas». No guarda escenarios.
  - La v1 es de solo lectura. Después llega un simulador acotado a «si asistes / si llegas tarde» más una sola falta hipotética (jueces de valor y de solidez).
  - Se miden las faltas de quienes lo consultan.
- **La proyección como sentencia.** No va de titular: va en Detalles como «estimación» con intervalo, y con menos de 4 sesiones dice que no hay datos suficientes.
- **El «plazo para justificar» no existe como regla** (RN-08 es el plazo del docente). Se quita la frase o se crean una RN y un parámetro en DECISIONS.md.
- **Peso.** `/alumno` ya va +21.3 % sobre su base: React.lazy y medición. Nunca muestra puntaje, probabilidad, ranking ni comparación con compañeros.

### F08 · «Todavía llegas» (7.05 · M)
**Pitch.** Mientras la clase está abierta, el alumno ve en su teléfono hasta cuándo cuenta como presente o como retardo, y recibe «Registrado 07:17 · Retardo» en cuanto ocurre.

**Momento wow.** A las 07:12 el teléfono dice: «Finanzas empezó hace 12 min. Aún llegas: un retardo es 1/3 de falta; faltar es 1 entera». Se avanza +5 en el reloj y la tarjeta pasa sola de «Registrando…» a «Registrado 07:17 · Retardo», en el mismo segundo en que sube el contador del proyector (F01).

**Cómo funciona.**
- Una tarjeta «Ahora» de vida limitada arriba de PortalAlumno: aparece 30 min antes de la clase y se retira al terminar la tolerancia.
- Estados:
  - antes de clase;
  - en ventana, con VentanaTolerancia reutilizada sin cambios;
  - registrando, cuando la primera lectura válida crea la asistencia `pendiente`;
  - registrado;
  - sin consentimiento («hoy tu asistencia se toma a mano»);
  - fuera de ventana («avisa a tu docente»).
- `api_mi_clase_ahora` (INVOKER, solo datos propios) calcula la fase con `app.estado_por_minuto`. Avisa si el siguiente retardo completaría una falta.
- Con el pase manual funciona igual: la tarjeta cambia cuando el docente marca.

**Por qué vale.**
- En el estudio ASEE 2026, los alumnos pidieron confirmación en tiempo real.
- Las pautas de Live Activities piden tareas con inicio y fin y mostrar solo lo esencial.
- Para quien llega tarde por el transporte (barrera documentada por CUNY y por el rector de la UNACH), puede convertir una falta entera en un tercio.

**Reutiliza.** `svc_registrar_detecciones` (ciclo pendiente → presente/retardo), `app.minuto_de_sesion`/`estado_por_minuto`, el cálculo de fase de `api_sesion_monitor`, la RLS del alumno, `api_ahora`, VentanaTolerancia y `useApiQuery`.

**Riesgos y mitigación.**
- **Llegada calculada al minuto 9 o 19.** Se muestra solo el tramo («aún cuenta como presente»), sin cuenta regresiva al segundo. Se mide la proporción de llegadas entre el minuto 10 y el 20 antes y después de activarla.
- **Ansiedad con «pendiente».** Texto exacto, que incluya que un pendiente sin resolver pasa a ausente a las 48 h.
- **Datos móviles.** Sondeo cada 15 s y solo con la pestaña visible.
- **Peso y demo.** `/alumno` va +21.3 %: carga diferida. La demo en la LAN exige configurar `allowedDevOrigins`.

### F01 · Modo Aula (7.0 · M)
**Pitch.** Una vista a pantalla completa para el proyector que convierte la ventana de tolerancia en un ritual anónimo: asientos que se encienden, un reloj de fase y ningún nombre.

**Momento wow.** El docente pulsa «Proyectar» y aparecen 25 asientos apagados con «Presente hasta 07:10 · 4:12». Los asientos se encienden, el medidor sube a «18 de 25» y el reloj pasa a ámbar en la fase de retardo. Al cerrar, el proyector dice «Lista cerrada en 1 min 42 s · 23 de 25 · unos 5 min devueltos a la clase (estimación)».

**Cómo funciona.**
- Ruta `/docente/sesiones/[id]/aula` en el grupo `(flujo)`, sin AppShell. Se abre con un botón en MonitorSesion y en PaseListaManual.
- `api_sesion_aula` (INVOKER) devuelve solo conteos y fase, así que el navegador del proyector nunca recibe nombres.
- Piezas:
  - `ui/ArregloPuntos`, primitiva nueva ordenada por estado y nunca por orden de llegada;
  - un MedidorLiquido grande;
  - VentanaTolerancia a escala de proyector (`--escala-aula`, texto de 28 px o más a 1080p).
- Usa la Window Management API donde existe; donde no, una ventana normal más la Fullscreen API. Sondeo cada 5 s.
- Con pase manual funciona igual: el contador sube conforme el docente marca.

**Por qué vale.**
- Pasar lista toma de 2 a 15 min; en un grupo de 54, más del 70 % de los pases duraba más de 4 min (APS Observer). La tarjeta de cierre hace visible la promesa de SUSAN dentro del salón.
- Kahoot: el contador que sube frente a todos convierte un trámite en un ritual.
- La crítica a ClassDojo marca el límite: nada individual ni negativo en una pantalla compartida.
- Es la imagen más fotografiable de la demo. Su valor de uso semanal es bajo (4).

**Reutiliza.** `api_sesion_monitor`, `app.minuto_de_sesion`/`estado_por_minuto`/`sesion_autorizada`, el layout `(flujo)`, `useApiQuery`, MedidorLiquido/SloshGauge, VentanaTolerancia, `colorGrafica`, `api_impacto_tiempo` y el tema `.dark`.

**Riesgos y mitigación.**
- **Pantalla duplicada.** Si el docente duplica en lugar de extender, se proyecta su vista privada. Si `getScreenDetails` no ve una segunda pantalla, «Proyectar» pide confirmar que está extendida.
- **Grupos chicos.** Con menos de 15 inscritos, el contador va en tramos de 5; con menos de 5, se oculta.
- **Apertura real.** No se guarda; se usa la columna `abierta_en` del corte mínimo de F29.
- **Uso real.** La pantalla dura 60 s y se cierra sola. Se mide si bajan las disputas de retardos en Revisión.
- **Sin depender del rostro.** La escena funciona con pase manual (o con F03), como pide el juez wow.

### F10 · Espejo de faltas (6.9 · L)
**Pitch.** En momentos clave del semestre, SUSAN le pide al alumno que adivine cuántas faltas lleva antes de revelarle la cifra real con su desglose.

**Momento wow.**
- Modo individual: el alumno elige 2 y la cifra cuenta hasta 4, con los retardos agrupándose de tres en tres y «te quedan 3».
- Modo aula (solo para la demo): 20 teléfonos responden y el proyector muestra una nube anónima de lo que creían contra lo real: «19 de 25 se quedaron cortos, en promedio por 1.6 faltas».

**Cómo funciona.**
- Una tarjeta en `/alumno` en tres hitos, con un control de 0 a 12 (botones − y +), «Revelar» y «Prefiero no adivinar».
- BarrasPildora «Creías / Llevas» sin colores de alarma, el desglose y una sola acción: F09 o Justificar.
- En el siguiente hito se compara consigo mismo. La cifra sale exactamente de `v_resumen_asistencia`, con prueba.

**Por qué vale.**
- Rogers y Feller (2018): ensayo con 28 080 hogares. El total personal de faltas bajó el ausentismo crónico más de 10 % y la comparación con pares no sumó (Harvard; Evidence for ESSA).
- Harvey y Keyes (2019): verse por debajo del promedio baja la autoestima.
- Wrapped 2025: adivinar antes de ver convierte el dato en sorpresa.
- La mecánica de adivinar y revelar no está probada en universitarios: es una hipótesis medible.

**Reutiliza.** `v_resumen_asistencia`, `api_alumno_resumen`, `patronPorDia`, CountUp, BarrasPildora, BarraFaltas y TarjetaGrafica.

**Riesgos y mitigación.**
- **Modo aula frágil.** Depende de más de 20 teléfonos, de la red, de una ruta local que asigna identidades y de un QR que la especificación excluye. Queda solo para la demo, con punto de acceso propio y video de respaldo. El producto es el modo individual dentro de F09 y de la nota de F04 (jueces de valor y de solidez).
- **Privacidad.** El par creído/real se guarda sin identidad (solo grupo e hito), con n de 5 o más.
- **Sensación de examen.** Una vez por hito, con opción de no adivinar. Lo revelado siempre va acompañado de lo que el alumno sí puede hacer.
- **Hitos.** Sin calendario de parciales, se usan semanas fijas como parámetro.

### F03 · Pase por frase (6.85 · M)
**Pitch.** Sin cámara, el docente pasa lista con una sola frase, dicha o escrita, y SUSAN la convierte en los cambios de toda la lista para confirmarlos con un toque.

**Momento wow.** A 360 px, el docente escribe o dice: «Todos presentes menos García y Ruiz; Pérez llegó tarde». La lista se colorea (22 Presente, 2 Ausente, 1 Retardo) y aparece una pregunta: «¿Ruiz Gómez o Ruiz Méndez?». Un toque y «Confirmar 25 registros». Al lado, un cronómetro: pase manual contra frase.

**Cómo funciona.**
- PaseListaManual gana «Escribir frase» (siempre disponible) y «Dictar» (SpeechRecognition es-MX, solo si el navegador lo soporta).
- Un intérprete puro en `dictado.utils.js` con una gramática corta, Jaro-Winkler y normalización fonética del español. Si un nombre coincide con más de un alumno, se elige con chips.
- La vista previa es un diff con StatusChip. Al confirmar se envía un solo lote atómico a `api_pase_lista_manual`. No usa LLM, porque la frase contiene apellidos.

**Por qué vale.**
- APS Observer: pasar lista toma de 2 a 15 min. Esta idea cubre el respaldo en aulas sin cámara (5C en B-04), alumnos sin consentimiento y fallas de la cámara.
- Su valor es limitado, porque «Todos presentes» y «Marcar restantes según la hora» ya existen.

**Reutiliza.** `api_pase_lista_manual`, PaseListaManual/`usePaseListaManual` (marcas locales, deshacer y contador de cambios), `normalizarBusqueda`/`sinAcentos`, StatusChip y Pills.

**Riesgos y mitigación.**
- **Apellidos hacia un tercero.** En Chrome Android el audio se procesa en servidores de Google. El modo escrito es el predeterminado, y la voz solo se activa con `processLocally` o tras un aviso explícito.
- **Sesgo de error.** Puede equivocarse más con apellidos tsotsiles, tseltales o zoques. Se arma un corpus con esos apellidos y se mide el error por tipo de apellido.
- **Restricciones del manual.** El pase manual rechaza `justificado`, el lote falla completo con ALUMNO_CON_LECTURAS y PaseListaManual solo aparece en sesiones manuales. Hay que documentarlo.
- **Antes de invertir en voz,** medir cuánto tarda hoy el pase manual (sesiones manuales en `api_impacto_tiempo`).

### F07 · Corte de parcial (6.65 · M)
**Pitch.** El docente elige la fecha del examen y SUSAN reparte al grupo en «asegurado», «en la orilla» y «sin derecho hoy», le señala qué decisiones pendientes cambian un derecho y da una meta exacta a quien está en la orilla.

**Momento wow.** El docente elige «Examen: jueves 1-oct» y las tres columnas se acomodan: 18 / 4 / 2. Arriba aparece «2 decisiones pendientes cambian un derecho». Junto a cada alumno en la orilla: «Necesita asistir a 3 de las 4 sesiones que quedan; con un retardo más ya no le alcanza». Al resolver los pendientes, las columnas se mueven en vivo.

**Cómo funciona.**
- `api_corte_derecho(p_id_grupo, p_fecha)` (INVOKER) devuelve por alumno: faltas equivalentes, retardos sueltos (ret mod 3), sesiones restantes no suspendidas, pendientes y justificantes pendientes.
- Columna y k mínimo salen de una fórmula cerrada. El peor caso toma los pendientes como ausencias, que es justo lo que hace `app.resolver_pendientes_vencidos` a las 48 h. No hace falta bisección.
- La banda de decisiones lleva a Revisión con la cola ordenada por impacto, sin sugerir en qué sentido resolver.
- El alumno ve su meta sin puntaje.

**Por qué vale.**
- Clark et al. (2020): funcionan las metas de tarea, no las de resultado.
- Rogers y Feller: el conteo concreto corrige mejor que un porcentaje.
- Cavus y Kuzilek (2024): un contrafactual solo sirve si mueve variables accionables.
- SUSAN ya recalcula el derecho de forma reversible, pero no lo proyecta a una fecha.

**Reutiliza.** `v_resumen_asistencia`, las sesiones futuras, `justificante` (con RLS del docente), `api_reporte_grupo`, `api_cola_revision`, CampoFecha, HojaImpresion, PestanasReporte, TarjetaFila y BarraSegmentada.

**Riesgos y mitigación.**
- **Regla inventada.** El 20 % se calcula sobre todo el periodo. Se presenta como «situación a la fecha» hasta validar el reglamento, y se documenta en DECISIONS.md.
- **Fecha frágil.** Guardada en localStorage, el alumno no puede verla. Debe vivir en el servidor (un calendario académico mínimo), lo que de paso desbloquea F12 y F13.
- **Lista impresa.** Con nombres, exhibe por omisión a quien no tiene derecho. Se cambia por un conteo o por una lista que solo ve el docente.
- **«Avisar a los de la orilla»** depende de la mensajería de F04.

### F13 · Wrapped de SUSAN (6.65 · L)
**Pitch.** Al cierre de un parcial, el docente proyecta la historia del grupo en tarjetas con «adivina y revela».

**Momento wow.** «3A · Contabilidad II · hasta hoy». Luego, «18 sesiones · unas 1 h 30 min de clase devueltas (estimación)». Luego, «¿Qué día faltamos más?»: el grupo grita «¡viernes!» y la TiraSemana revela «Lunes · 21 %». Al final, la línea del grupo con la marca «En la semana 5 cambió el ritmo».

**Cómo funciona.**
- Ruta `/docente/historia/[grupo]` en `(flujo)`, que se navega con ← → y PageDown, las teclas de los controles de presentación.
- Titulares hechos con plantillas fijas, sin IA.
- Tarjetas:
  - día crítico (TiraSemana);
  - quiebre CUSUM/EWMA (GraficaLinea con `marcaX`);
  - minutos de llegada (`api_llegadas_grupo`, solo origen automático y sin ids);
  - proyección con banda;
  - un mensaje que edita el docente.
- Con menos de 4 semanas de datos, se omiten las tarjetas de tendencia.

**Por qué vale.**
- Spotify Wrapped 2025: el usuario controla el ritmo y juega a adivinar antes de ver.
- Wrapped 2024 salió mal por cifras equivocadas y texto genérico de IA (Tom's Guide).
- Borkin et al. (2013): un titular hace memorable una gráfica.
- Dai, Milkman y Riis (2014): el cierre de parcial es un hito de cuenta nueva.
- Es evidencia de mercadotecnia: hay que presentarla como hipótesis de diseño.

**Reutiliza.** `analizarGrupo` (`diaCritico`, `semanaCambio`, proyección, cruce y `suficiente`), `api_impacto_tiempo`, `app.minuto_de_sesion`, TiraSemana, GraficaLinea, Reveal/BlurText/CountUp y el layout `(flujo)`.

**Riesgos y mitigación.**
- **Premiar la asistencia sale caro.** En el estudio de Robinson, Gallus, Lee y Rogers, premiar la asistencia perfecta aumentó 8 % las ausencias. Nada de medallas ni de rachas como titular. La versión del alumno queda sin opción de compartir, o se pospone.
- **Uso bajo.** Se queda en 3 tarjetas accionables (día crítico, quiebre y proyección) al cierre de cada parcial (juez de valor).
- **Confianza.** Cada titular lleva su prueba.
- **Semilla.** «Mi parcial» a 6 semanas ya funciona con la semilla actual; la versión de fin de semestre necesita semilla nueva.
- **Tipografía.** Titulares en Hanken Grotesk grande, o una excepción para la serif documentada en SISTEMA.md.

---

## 5. Ideas de puntaje bajo y descartadas

**Fuera del top 12**
- **F15 · Mesa de casos 48 h y «¿Funcionó?» (6.6):** es la estructura correcta (en el ensayo EWIMS el ausentismo crónico bajó de 14 % a 10 %), pero es XL y «¿Funcionó?» con n = 6 invita a afirmaciones causales. Va como fase 2 sobre la mensajería de F04.
- **F27 · Mi aliado (6.55):** la evidencia con padres es fuerte (Bergman y Chan, +12 % de asistencia a clase), pero en jóvenes es mixta, abre una finalidad nueva y tiene riesgo de coerción. Necesita revisión jurídica antes de construirse.
- **F31 · Los que se fueron en silencio (6.55):** mucho valor para la permanencia y poco wow. Conviene fusionarlo con F14 y como un tipo de caso de F15. Requiere inscripciones cruzadas en la semilla.
- **F14 · Radar de facultad (6.5):** «falta al día, no a la materia» es un buen hallazgo, pero combina puntajes no validados. Fusionar con F31 y usar solo hechos SQL.
- **F18 · Simulador de reglamento (6.45):** sólido y de solo lectura, pero se usa una o dos veces al año. Su motor sirve como auditoría de equidad dentro de F19.
- **F06 · Radiografía del grupo (6.4):** tiene buen titular, pero es otro tablero, y el modelo aditivo exige reparametrizar porque LU sale singular. El titular y su acción pueden ir a la Mesa de hoy.
- **F12 · Mi plan para no faltar (6.3):** tiene la evidencia más directa en universitarios (Elliott 2025: asistencia de 63.4 % a 76.2 %), pero el wow no es inmediato. Es un candidato fuerte para el onboarding del alumno.
- **F28 · Hoja que se lee sola (6.2):** wow alto, pero obliga a imprimir y la lectura de la foto es frágil. Mejor empezar por una cola sin conexión del pase manual que ya existe.
- **F25 · Pregúntale a SUSAN (6.15):** impresiona, pero mete un LLM de pago con datos de alumnos (solidez 4). El enrutador por intención sin proveedor es el producto real.
- **F24 · Receta exacta y ficha verificable (5.95):** la receta es S y excelente. La página pública de verificación revela que existe un expediente de tutoría. Entregar solo la receta, dentro de TablaRiesgo y de F05.
- **F30 · Ajustes razonables (5.95):** es una obligación legal (CDPD, art. 24) con alta solidez y poco wow. Diseñarlo junto con F29, porque los dos tocan RN-03.
- **F29 · Reloj justo (5.85):** no impresiona, pero es un cimiento. Sin `abierta_en`/`cerrada_en` y sin conciliar las sesiones que nunca se abren, la verdad de F19 y el denominador del 20 % están sucios. Su corte mínimo entra en el paso 0.
- **F22 · Curva de supervivencia (5.8):** una forma memorable, pero con 25 alumnos los intervalos son enormes. Reducirla a la cifra «semana crítica» a nivel facultad.
- **F20 · Contingencias colectivas (5.75):** es muy local, pero reescribir estados a justificado choca con RN-09 (el justificado es inmutable). Empezar solo con detección y suspensión.
- **F11 · Justifica en 30 s (5.7):** la fase 1 es M y útil. El OCR de documentos médicos maneja datos sensibles y agrega una dependencia nueva.
- **F21 · Monte Carlo frente a Markov (5.7):** la mejor vitrina didáctica, pero da una probabilidad individual con falsa precisión. Llevarla a `/analitica` como procedimiento a nivel de grupo.
- **F16 · Carpeta de acreditación (5.65):** sirve una vez al año y los criterios CACECA no están validados con la FCA.
- **F26 · Sala de control (5.3):** valor 2 y estética de vigilancia. A lo más, como apertura del video.
- **F32 · Horas que faltan (4.8):** un problema real, pero de gestión de horarios. Basta el contador «clases sin impartir por causa».
- **F17 · Planeador de aulas (4.45):** se desvía hacia la gestión de espacios. Su única cifra útil cabe en CamarasEstado.

**Descartadas en la consolidación**
- **Red de co-ausencias («faltan juntos»):** infiere relaciones sociales, una finalidad que no cubre el aviso de privacidad, y estigmatiza amistades. Lo no sensible (los días colectivos) quedó dentro de F06.
- **Iniciales en el proyector:** revelan quién llegó y, por diferencia, quién faltó. F01 solo proyecta agregados.
- **Lectura de justificantes con un LLM externo:** los documentos médicos o judiciales son sensibles, y no se puede saber si uno «no lo es» sin leerlo. F11 conserva solo el OCR local.

---

## 6. Secuencia recomendada

**Lógica:** primero tres ideas M con wow 8 (F19, F09, F01). Son autónomas y no necesitan mensajería, así que en unas 3 semanas ya hay una demo propia. Después se construye la apuesta insignia sobre una sola tabla de mensajes.

### Paso 0 · Cimientos compartidos (alrededor de 1 semana)

| Pieza | La usan | Zona |
|---|---|---|
| Funciones SQL de faltas equivalentes extraídas de `v_resumen_asistencia`, sin cambiar sus columnas | F09, F07, F24, F31 | db-schema / db-api |
| `sesion_clase.abierta_en` y `cerrada_en` (corte mínimo de F29) | F01, F13, F19 | db-schema |
| `ui/MatrizCalor` y `ui/ArregloPuntos` | F19, F06, F20 / F01, F10 | ui-kit |
| Semilla: excluir E260001 de la verdad, sembrar 2026-1 con ruido no diseñado, un patrón de mejora y una segunda cuenta de alumno para el teléfono de la demo | F19, F05, F23 | demo |
| Diseño de la tabla `mensaje` única, aunque se construya en el paso 2 | F04, F05, F07, F23 | db-api |

### Paso 1 · Golpes rápidos (unas 3 semanas para una persona; se puede repartir por zonas)
1. **F19**: evaluación con corte temporal, MatrizCalor, ficha del modelo y una cifra protagonista.
2. **F09**: v1 de solo lectura, luego el simulador acotado, más el paso «adivina y revela» (F10 individual).
3. **F01**: el Modo Aula con `api_sesion_aula`. Opcionalmente F08, que comparte la lógica de fase.

### Paso 2 · Insignia: cerrar el ciclo (unas 3 a 4 semanas)
4. Mensajería única y **F04**: recibo de cierre, notas, bandeja del alumno, `mailto` y `leido_en`.
5. **F05** v1: `armarMesa` determinista, plantillas y F23 como fuente de quiebres. Sin LLM y sin Tutorías.

### Paso 3 · Opcional
6. **F13** en versión de grupo, con 3 tarjetas, para el cierre de parcial y el video.

La evolución natural después de esto es F15 (casos con plazo de 48 h, que nacen del «Necesito apoyo») y el canal PWA con Web Push.

### Guion de demo: «Un día con SUSAN» (unos 4 min 45 s)
La preparación: modo local, reloj de demostración, la laptop en el proyector y un teléfono propio en la LAN con la cuenta de un alumno de la semilla con patrón de deterioro (k14), que hoy falta. Conviene llevar un video de respaldo grabado.

| Tiempo | Escena | Qué se ve | Feature |
|---|---|---|---|
| 0:00 a 0:25 | El problema | «En el área de la FCA se va el 38-39 % de cada cohorte (UNACH, evaluación del PIT) y los tutores no tienen datos a tiempo. SUSAN ya devuelve el tiempo del pase de lista; esto es lo que hace con esos minutos.» | contexto |
| 0:25 a 1:15 | Lun 07:05 · El aula | «Proyectar»: los asientos se encienden sin nombres (con la cámara simulada o con pase manual), el reloj de fase pasa a ámbar y la lista cierra con «23 de 25 · unos 5 min devueltos (estimación)». | F01 |
| 1:15 a 2:05 | 07:25 · El cierre | «3 ausentes · 3 notas listas», cada una con su contexto. La docente edita una línea y envía. El teléfono recibe «Te extrañamos hoy…», el alumno toca «Necesito apoyo · Transporte» y en el panel aparece «1 alumno pidió apoyo · hace 3 s». | F04 |
| 2:05 a 2:50 | Esa tarde · el alumno | «¿Cuántas faltas crees que llevas?»: elige 2 y se revelan 4, con los retardos fundiéndose. «¿Y si falto?»: marca «jue 17» y el margen baja. «Justificar ahora». | F09 + F10 |
| 2:50 a 3:40 | Mar 06:55 · Mesa de hoy | «3 cosas para hoy». El alumno del teléfono va arriba («contestó: transporte», con «Quiero hablar en asesoría»). Entra otra alumna por un quiebre de ritmo detectado anoche. El borrador trae una meta de conducta y aparece la cifra «de alerta a respuesta». | F05 (+F23) |
| 3:40 a 4:30 | ¿Cómo saben que acierta? | `/analitica`: control en la semana 3 y reproducir. La matriz se enciende, aparece la cifra grande y luego el fallo honesto de k18. Rótulo: «validación del método». | F19 |
| 4:30 a 4:45 | Cierre | «Detectar, avisar, contactar, medir. Sin nombres en el proyector, sin puntajes para el alumno, sin IA que invente cifras.» | — |

El alumno del teléfono recorre todo el arco (falta, nota, respuesta, simulador, Mesa de hoy) y respeta el tope de una nota por semana. El momento «en vivo» ocurre una sola vez, en el cierre de la sesión.

### Reglas que no se negocian
- Nada individual en pantallas compartidas. Nada de rankings ni de comparación con compañeros.
- Nada de premios ni insignias por asistencia perfecta; se reconoce la mejora y en privado (Robinson et al.).
- El alumno nunca ve puntajes ni etiquetas de riesgo. La interfaz dice «necesita seguimiento», no «en riesgo».
- Toda cifra de impacto se presenta como estimación con n visible. Nunca «SUSAN reduce el ausentismo X %».
- Ningún mensaje sale de forma automática: el remitente es el docente y la v1 no usa LLM.

---

## 7. Fuentes clave

**Avisos y comunicación con evidencia experimental**
- Cortinhas 2025, correo tras faltar en universidad: https://ideas.repec.org/a/eee/ireced/v49y2025ics147738802500009x.html
- Carrell y Kurlaender, «My Professor Cares»: https://faculty.econ.ucdavis.edu/faculty/scarrell/engagement2.pdf
- Rogers y Feller 2018: https://toddrogers.scholars.harvard.edu/publications/reducing-student-absences-scale-targeting-parents-misbeliefs
- Tamaños de efecto (Evidence for ESSA): https://www.evidenceforessa.org/?p=687
- AIR/IES, mensajes de texto: https://air.org/news/press-release/new-federal-study-finds-text-messages-parents-can-reduce-chronic-school-absences
- LIFT (Swanson, Kane, Staiger et al. 2025): https://edworkingpapers.com/policy-practice-series/ai25-1189
- Carta de inasistencia rediseñada: https://scale.stanford.edu/publications/using-behavioral-insights-improve-school-administrative-communications-case-truancy
- Metas de tarea (Clark et al.): https://www.nber.org/papers/w23638
- Plan «si… entonces» (Elliott et al. 2025): https://pmc.ncbi.nlm.nih.gov/articles/PMC12879521/
- Bergman y Chan: https://jhr.uwpress.org/content/56/1/125

**Alerta temprana y cierre del ciclo**
- Georgia State (NPR): https://www.npr.org/sections/ed/2016/10/30/499200614/how-one-university-used-big-data-to-boost-graduation-rates
- Alerta Escuela y lecciones (Banco Mundial): https://blogs.worldbank.org/en/education/early-warning-systems-can-help-prevent-dropouts-administrators-need-consider-critical
- EWIMS (IES): https://ies.ed.gov/use-work/resource-library/report/impact-study/getting-students-track-graduation-impacts-early-warning-intervention-and-monitoring-system-after-one
- EAB, críticas de saturación: https://www.rfp.wiki/vendors/eab

**Validación, sesgo y umbrales**
- Course Signals: https://eliterate.us/purdue-course-signals-data-issue-explainer/
- DEWS de Wisconsin: https://pbswisconsin.org/news-item/false-alarm-how-wisconsin-uses-race-and-income-to-label-students-high-risk/
- Baker y Hawn, sesgo algorítmico: https://learninganalytics.upenn.edu/ryanbaker/AlgorithmicBiasInEducation_rsb3.7.pdf
- Tec de Monterrey 2023: https://www.frontiersin.org/journals/education/articles/10.3389/feduc.2023.1244686/full
- Ortiz-Lozano 2024: https://diposit.ub.edu/dspace/handle/2445/215840
- Contrafactuales accionables (Cavus y Kuzilek): https://ceur-ws.org/Vol-3840/HEXED24_paper1.pdf
- PELT en educación (Nakamura 2024): https://link.springer.com/doi/10.1186/s40561-024-00317-6

**UNACH y México**
- Evaluación del PIT de la UNACH: https://secacad.unach.mx/images/dfie/Informe_PIT_compressed.pdf
- Iniciativa de alerta temprana 2026: https://sitl.diputados.gob.mx/LXVI_leg/cuadros_comparativos/1CP2/0025-1CP2-25.pdf

**Diseño de experiencia y plataforma**
- Premios que salen al revés (Robinson et al.): https://www.hks.harvard.edu/publications/demotivating-effect-and-unintended-message-awards
- Comparación social en tableros (Harvey y Keyes): https://arro.anglia.ac.uk/id/eprint/704138
- Comparación con pares de meta parecida (HvA): https://research.hva.nl/en/publications/social-comparison-in-learning-analytics-dashboard-supporting-moti/
- Calculadoras de faltas: https://onlineresult.in/tools/attendance-calculator/skip
- Tiempo de pase de lista (APS Observer): https://www.psychologicalscience.org/observer/on-taking-attendance
- Confirmación en tiempo real (ASEE 2026): https://peer.asee.org/59029
- Spotify Wrapped 2025: https://newsroom.spotify.com/2025-12-03/2025-wrapped-user-experience/
- Controversia de Wrapped 2024: https://www.tomsguide.com/audio/spotify-wrapped-2024-controversy-explained-what-you-need-to-know
- Memorabilidad de visualizaciones (Borkin et al.): https://vcg.seas.harvard.edu/publications/20130101-what-makes-a-visualization-memorable
- Efecto de cuenta nueva (Dai, Milkman y Riis): https://faculty.wharton.upenn.edu/wp-content/uploads/2014/06/Dai_Fresh_Start_2014_Mgmt_Sci.pdf
- Notificaciones en lote (Fitz et al.): https://communities.springernature.com/posts/batching-notifications-can-improve-attention-well-being-and-productivity
- Kahoot: https://kahoot.com/blog/2019/03/04/how-to-get-started-with-kahoot/
- Document Picture-in-Picture: https://developer.chrome.com/docs/web-platform/document-picture-in-picture
- Web Speech en el dispositivo: https://github.com/WebAudio/web-speech-api/blob/main/explainers/on-device-speech-recognition.md

*Las cifras que publican los propios proveedores (las «10+ horas» de EAB, la precisión que anuncia Civitas) no están verificadas y no deben citarse como hechos ante evaluadores.*

---

## Diseños a fondo

- [F19 · ¿Lo habríamos visto venir?](F19-lo-habriamos-visto-venir.md)
- [F04 · «Te extrañamos hoy»](F04-te-extranamos-hoy.md)
- [F05 · Mesa de hoy](F05-mesa-de-hoy.md)
- [F09 · «¿Y si falto?»](F09-y-si-falto.md)
- [F01 · Modo Aula](F01-modo-aula.md)
