# CONTENIDO v4: qué hace SUSAN, qué mostrar y con qué datos

Fecha: 2026-10-05. Documento de contenido para quienes escriben el storyboard y construyen los cuadros de la v4
(16:9, 50–60 s, motion graphics, sin cursor, listo para voz). No decide planos ni transiciones: fija **qué se afirma,
qué pantalla real lo respalda, con qué palabras de la interfaz y con qué cifras**.

Fuentes leídas: `docs/spec/Avance1.txt` (spec), `docs/NUMERICS.md`, `docs/DEMO.md`, `docs/DEMO-CAMARA.md`,
`docs/DEMO-RELOJ.md`, `web/src/lib/modulos.js`, `docs/design/MODULOS.md`, la semilla (`supabase/seed/01–03,99`,
`scripts/demo/limites.sql`), los textos de `web/src/components/**`, la captura real
`video/susan-v4/capture/app-real/dom/*.html` (texto renderizado con la semilla, 14-sep-2026 07:12) y
`video/susan-presentacion/STORYBOARD.md` (v3).

Marcas usadas en todo el documento:

- **[REAL · archivo]**: la cifra o el texto sale tal cual de la app, la semilla o la spec.
- **[CÁLCULO]**: aritmética sobre datos reales (se muestra la operación).
- **[ESTIMACIÓN · spec]**: la propia spec la presenta como estimación; en pantalla debe decir «estimación» o «unas».
- **[INVENTADO]**: no existe en la semilla; lo propongo para el video, plausible y coherente con las reglas.
- **[RETIRADO DEL VIDEO · 2026-10-06]**: dato real que la persona dueña sacó del video al aprobar el plan: cuántas
  lecturas, capturas o muestras usa la cámara para confirmar a un alumno («3 lecturas», «Lecturas 1/3 → 3/3»,
  «Lecturas válidas: 2/3», cualquier x/3; «eso aún lo decidiré», BRIEF). Se conserva como referencia de la app, pero no
  va ni en la voz ni en pantalla. La confirmación se cuenta sin número: el marco se vuelve verde y el alumno queda
  presente.

---

## 1. SUSAN en una frase y el problema que resuelve

**En una frase (para el equipo, no es copy):** SUSAN registra la asistencia con la cámara del aula mientras la clase
transcurre, deja al docente solo los casos dudosos y convierte cada sesión en un historial que avisa a tiempo qué alumnos
van camino a perder el derecho a examen.

**Frase de producto ya presente en la app** (Home del docente, bajo «Buenos días, Patricia»): «Pasa lista en segundos y
entiende la asistencia de tus grupos.» [REAL · `dom/10-docente-home.html`; también es el `message` del BRIEF].

**El problema, con cifras defendibles:**

| Afirmación | Cifra | Marca y fuente |
|---|---|---|
| El pase de lista verbal tarda | «alrededor de 5 minutos por sesión» | [REAL · spec §3.2, `Avance1.txt` l. 1090] |
| Costo por grupo | 5 min × 3 sesiones/semana × 16 semanas = 240 min = **4 h de clase por grupo al semestre** | [REAL · spec §1.1, l. 100–101] |
| Costo por docente | «un docente con cinco grupos destina **unas 20 h por semestre** solo a nombrar alumnos» | [ESTIMACIÓN · spec l. 103: «como estimación (no un dato institucional)»] |
| El ahorro | «el ahorro efectivo solo puede medirse en el aula» | [REAL · spec l. 4679–4680] → nunca decir «ahorra X h» como hecho medido |
| Ahorro que ya calcula la app | «Impacto en tiempo de clase · **95 min** · Unas 1.6 h recuperadas. · Estimación, no una medición.» (19 sesiones automáticas × 5 min) | [REAL · `dom/19-reportes-grupo-3a.html`] |
| Las faltas se notan tarde | «Hasta ese momento el alumno no conoce el número de faltas que acumula» (cierre del periodo, conteo a mano y recaptura) | [REAL · spec l. 1094–1098] |
| Cualquiera contesta por otro | «la compuerta depende de una respuesta que cualquier compañero puede dar por el ausente» | [REAL · spec l. 1091–1092] |
| Sin reportes sin trabajo manual | «los datos en papel no permiten reportes por materia, grupo o periodo sin trabajo manual» | [REAL · spec l. 106–108] |
| Límite de faltas | Más del **20 %** de faltas equivalentes → **sin derecho a examen** | [REAL · RN-11, RF-14] |
| Retardos | **3 retardos = 1 falta** | [REAL · RN-10, RF-13] |
| Ejemplo de la spec | Con 48 sesiones: 9 faltas (18.75 %) conservan el derecho; **la 10.ª (20.83 %) lo quita** | [REAL · RF-14, l. 574–575] |
| Cuánto tarda SUSAN en confirmar | 3 lecturas válidas en capturas distintas, una captura cada 15 s → la 3.ª llega ~30 s después de la 1.ª; con rostro real se midió **≈ 45 s** | [REAL · RF-03/RF-07; `DEMO.md` §9.1 paso 7] **[RETIRADO DEL VIDEO · 2026-10-06]** |
| Esfuerzo del docente | Un botón («Abrir y pasar lista»); resolver un caso dudoso en **≤ 3 interacciones** | [REAL · `modulos.js`/PasarListaHero; RNF-11] |

Lectura honesta de «en segundos»: el docente no nombra a nadie; la cámara confirma a cada alumno en menos de un minuto
mientras la clase sigue. **No poner cronómetros inventados** («listo en 6 s» de la v3 no tiene respaldo).

---

## 2. Funciones ordenadas por fuerza visual + valor para el docente (video de 55 s)

Reglas comunes: sin cursor (las interacciones se cuentan con estados que cambian, pulsos de botón y cámara que se acerca);
texto en pantalla = palabras reales de la interfaz (abajo, entre «»), ≤ 8 palabras por bloque; iconos Lucide indicados
entre paréntesis (son los que usa la app).

### 2.1 Pasar lista con cámara + sesión en vivo — **imprescindible, clímax de producto** (5–7 s)

- **Pantalla real:** P-03 «Sesión en curso». Ruta `/docente/pasar-lista` → `/docente/sesiones/19?pasar-lista=1`
  (Lucide `ScanFace`).
- **Palabras reales:** encabezado «Pasar lista» + «Administración Financiera (3A)» + chips «Abierta» · «Automático»;
  panel «Pase de lista con cámara»; chip de la vista de cámara «Reconociendo» (otros: «En pausa», «Fuera de la ventana»);
  cifra «Asistencia ahora» / «**19** de 24 presentes» / «2 con retardo · 2 sin registro · 1 por revisar»;
  «Última captura: 23 rostros · 22 válidos · +1 registro · hace 4 s»; tarjetas «Inscritos / Presentes / Retardos /
  Sin registro» (`Users`, `CircleCheck`, `Clock`, `UserX`); medidor «Presentes ahora» «88 %» «21 de 24 inscritos»;
  «Ventana de tolerancia · Minuto 12.0 · Retardo»; tabla «Estado · Lecturas · Mejor score · Origen · Hora»;
  estados «Pendiente» → «Presente»; lecturas «1/3 → 2/3 → 3/3» **[RETIRADO DEL VIDEO · 2026-10-06]**; botones
  «Cerrar pase de lista» (deshabilitado hasta el minuto 20) y «Registrar manualmente».
  Guía real de 3 pasos («Así se pasa lista»): «Sesión abierta · La clase ya está en curso.» → «Apunta la cámara al
  grupo · Que se vean los rostros; el sistema reconoce solo.» → «Revisa y cierra · Al terminar la tolerancia, cierra el
  pase de lista.»
- **Movimiento (5–7 s):** vista de cámara con avatares abstractos; marcos de detección que se fijan en ola (toda la
  toma a la vez, no rostro a rostro); las esquinas se vuelven verdes y el chip pasa de «Pendiente» a «Presente», sin
  contador de lecturas ni capturas numeradas (el «1/3 → 2/3 → 3/3» de la app quedó fuera del video el 2026-10-06); la
  cifra «N de 24 presentes» rueda (rodillo de dígitos) y el medidor líquido sube a 88 %.
  Un rostro ajeno («Visita») queda sin marco válido: «23 rostros · 22 válidos» lo cuenta sin decirlo.
- **Por qué le importa:** recupera los 5 minutos de cada clase y nadie contesta por otro; el estado (presente/retardo)
  lo decide la hora de la **primera** lectura, no la tardanza de la cámara (RN-03, spec l. 1265–1266).

### 2.2 Analítica de ausentismo: patrón, tendencia y proyección — **imprescindible, clímax de datos** (5–7 s)

- **Pantalla real:** `/analitica` (Lucide `ChartLine`), módulo «Analítica de ausentismo · Tendencia, proyección y riesgo
  por grupo.» Base: métodos numéricos de `NUMERICS.md` (regresión por MCO, medias móviles, proyección con intervalo
  95 %, cruce del límite por bisección/Newton, CUSUM/EWMA, riesgo 0–100).
- **Palabras reales (grupo 3A):** tarjetas «Ausentismo actual **20.8 %** · +4.2 pp vs. semana previa», «Proyección al
  cierre **24.8 %** · Semana 15», «Alumnos en riesgo **9**»; gráfica «Ausentismo semanal · Tendencia al alza: +0.59 pp por
  semana. Proyección con intervalo de 95 %.» con series «Observada · Ajuste · Proyección · Intervalo 95 % · EMA»;
  «Ausentismo por día de la semana · **Día crítico: Viernes**» (Lun 17.7 % · Mié 16.4 % · Vie 21.8 %); aviso «Info:
  Viernes concentra la mayor tasa de ausencia (21.8 %).»
- **Movimiento (5–7 s):** es el plano héroe de gráfica (lenguaje ref-01/ref-04): la línea S1–S6 se dibuja, sigue en
  punteado hacia S15 con la banda del intervalo abriéndose; una guía vertical recorre las semanas con tooltip en
  píldora («Semana 6 · 20.8 %»); la cifra «20.8 %» con su delta «+4.2 pp» rueda al llegar. Relevo a la tira semanal
  (`TiraSemana`): tres barras finas L/M/V y el bloque «Vie 21.8 %» se resalta con su píldora «Día crítico».
- **Por qué le importa:** deja de enterarse al final del semestre; ve el patrón (qué día, hacia dónde va) con semanas de
  margen para intervenir. Es lo que distingue a SUSAN de «una lista digital».
- **Alternativa más dramática:** el grupo 5C sí tiene cruce proyectado del promedio del grupo («Cruce del límite ·
  **Semana 16** · Estimada, límite de 20 %», «Tendencia al alza: +3.06 pp por semana», «Cambio de nivel a la alza desde
  la semana 3 (detectado en la 4)», serie 12.0 → 25.0 %) [REAL · `dom/23-analitica-5c.html`]. Úsenla solo si la línea
  necesita cruzar el límite en cámara; si no, quédense en 3A (ver §3.10).

### 2.3 Alumno en riesgo → acción sugerida — **imprescindible, cierra el arco «a tiempo»** (3–5 s)

- **Pantalla real:** `/analitica`, tarjeta «Mayor riesgo · Los 8 de mayor puntaje (de 9)» y «Ver tabla completa»
  (columnas reales «Alumno · Riesgo · Tendencia · Faltas · Restantes · Cruce (sem.)»).
- **Palabras reales:** «Cruz Rojas Iván · E260017 · **Alto · 64 / 100** · Al alza · 7 (14.9 %) · 2 · 9»; lectura
  accesible real: «Faltas restantes: 2. Cruce estimado: semana 9.» Acción sugerida que genera la app para nivel alto:
  «Contactar al alumno esta semana y acordar un plan de asistencia; revisar si hay justificantes por registrar.»
  [REAL · `lib/numerics/risk/riesgo.js` l. 274].
- **Movimiento (3–5 s):** la barra píldora (`BarrasPildora`) del ranking se ordena; la fila de Iván se enfoca (rack focus,
  el resto se desenfoca); su barra crece hasta 14.9 % frente a la marca «Límite 20 %»; aparece el chip «Alto 64» y la
  píldora «Cruce estimado: semana 9»; la línea de acción entra desde el desenfoque.
- **Por qué le importa:** es la «intervención docente oportuna» del objetivo del proyecto: un nombre, un margen
  («quedan 2 faltas») y qué hacer esta semana.

### 2.4 Panel del docente — **entrada a la app** (3–4 s)

- **Pantalla real:** P-02, `/docente` (Lucide `LayoutDashboard`).
- **Palabras reales:** «Buenos días, Patricia» (la serif EB Garamond es legítima aquí: es el saludo del Home);
  «Pasa lista en segundos y entiende la asistencia de tus grupos.»; tarjeta héroe «Pasar lista · Programada ·
  Administración Financiera (3A) · 07:00 - 08:00 · Aula A-12 · Cámara del aula lista · **Abrir y pasar lista**»;
  indicadores «Registros pendientes de revisión **8** · Esperan tu revisión» y «Justificantes por resolver **4** ·
  Esperan tu resolución»; «Alertas de asistencia · 3 sin derecho · 2 al límite»; «Mis grupos · 24 alumnos».
- **Movimiento (3–4 s):** el panel entra desde el desenfoque; el saludo se asienta; la tarjeta «Pasar lista» se separa
  del lienzo (pose 3D suave), el botón «Abrir y pasar lista» hace su pulso de pulsación y la tarjeta se transforma
  (morph) en el panel de la sesión: relevo directo a 2.1.
- **Por qué le importa:** todo lo del día en una pantalla; la acción principal es un botón.

### 2.5 Revisión: «Resolver como» — **alto valor de confianza** (3–4 s)

- **Pantalla real:** P-05, `/docente/revision` (Lucide `ClipboardCheck`). Encabezado «Revisión · Casos por decidir de tus
  grupos»; pestañas «Pendientes (8) · Justificantes (4) · Correcciones (0)».
- **Palabras reales (caso real de la semilla):** «Ramírez Núñez Emilio · E260003 · Administración Financiera · 3A ·
  Pendiente · Sesión del 2026-09-12, 09:00 a 10:00 · **Quedan 2 h 48 min** · Lecturas válidas: **2/3**» (esta última,
  **[RETIRADO DEL VIDEO · 2026-10-06]**); «Score por lectura · 89 % · 93 %»; «Lectura 1 · 9:02:00 a.m. · Cámara frontal
  · Score 0.893 · Válida · min 2.0»; «Lectura 2 · 9:08:00 a.m. · Score 0.927 · Válida · min 8.0»; botones «**Resolver
  como Presente** (Sugerido) · Resolver como Retardo · Resolver como Ausente». Recortes: siluetas/avatares, nunca fotos.
- **Movimiento (3–4 s):** la tarjeta del caso entra con pose 3D; dos barras finas de score se llenan (89 %, 93 %); el
  botón sugerido pulsa y se presiona; el chip pasa de «Pendiente» a «Presente» y el contador de la pestaña rueda 8 → 7.
- **Por qué le importa:** la cámara no decide sola; lo dudoso lo decide el docente, con evidencia, en un clic y con 48 h
  de plazo (RN-05, RN-08, RF-18, RNF-11).

### 2.6 Alertas de derecho a examen (3 s; se puede fundir con 2.3 o 2.4)

- **Pantallas reales:** P-02 «Alertas de asistencia» y gráfica «Faltas vs límite · Faltas equivalentes de los alumnos en
  alerta»; P-07 «Alumnos en el límite · Una falta más y pierden el derecho» / «Sin derecho a examen · Superó el límite de
  faltas».
- **Palabras reales:** «González Campos Mauricio · Administración Financiera (3A) · E260014 · **Sin derecho a examen** ·
  29.8 % de 20 %»; «Díaz Castro Miguel · E260001 · **A una falta del límite** · 19.1 % de 20 %» (ver §3.11 sobre 19.1/19.2);
  marca «Límite 20 %».
- **Movimiento:** barras píldora que crecen hacia la marca discontinua «Límite 20 %»; la que la cruza cambia a color de
  `ausente` **con** su etiqueta «Sin derecho a examen».
- **Por qué le importa:** el docente se entera antes de que el alumno pierda el examen, no después.

### 2.7 Reportes y exportación (3–4 s)

- **Pantalla real:** P-07, `/reportes` (Lucide `FileBarChart`). «Reporte de asistencia · Asistencia acumulada y derecho a
  examen.»; botones «**Exportar CSV**» e «Imprimir / PDF».
- **Palabras reales (3A):** «Sesiones cerradas 19 / 47 de las programadas»; «Asistencia promedio **80.58 %** en sesiones
  cerradas»; «Alumnos en el límite 2»; «Sin derecho a examen 1»; anillo «Estados de asistencia · 81 % Asistencia ·
  Presentes 330 (72 %) · Retardos 31 (7 %) · Ausencias 83 (18 %) · Justificadas 4 (1 %) · Pendientes 8 (2 %)»;
  «Impacto en tiempo de clase · 95 min · Unas 1.6 h recuperadas. · Estimación, no una medición.»; columnas de la tabla
  «Matrícula · Alumno · Pres. · Ret. · Aus. · Just. · Pend. · Faltas eq. · % faltas · Derecho».
  Archivo exportado: `asistencia_2026-2_adm301-3a_20260914.csv` [CÁLCULO · `reporteCsv.utils.js` `nombreArchivoCsv`].
- **Movimiento:** el anillo de estados se dibuja por segmentos; la cifra 80.58 % rueda; «Exportar CSV» pulsa y una
  píldora con el nombre del archivo sale del botón (sin cursor).
- **Por qué le importa:** se acaba la suma a mano y la recaptura al cierre del periodo; el reporte se entrega tal cual.

### 2.8 «Mi asistencia» del alumno (3 s)

- **Pantalla real:** P-08, `/alumno` (Lucide `UserCheck`), «Mi asistencia · Tu avance frente al límite de faltas.»;
  pestañas «Resumen por materia · Por sesión · Justificantes». Web responsiva (funciona desde 360 px; no es app nativa,
  RNF-13 y Tabla 1).
- **Palabras reales:** aviso para Iván (7 de 9 faltas): «**Te quedan 2 faltas antes del límite.**» (tono info, «Cerca del
  límite») [REAL · `alumno.utils.js` `avisoMateria`, umbral 2]. Otras variantes reales: «Estás en el límite: una falta más
  y pierdes el derecho a examen.» y «Superaste el límite de faltas: sin derecho a examen.»; columnas «Presentes · Retardos ·
  Ausencias · Justificadas · Pendientes · Faltas eq. · Te quedan»; nota «Los pendientes de revisión no cuentan hasta que el
  docente los resuelva.»; formulario «Registrar justificante → Enviar justificante → Justificante enviado; tu docente lo
  revisará.»
- **Movimiento:** panel tipo teléfono (lenguaje ref-05) con la barra de faltas que se llena hasta 14.9 % y el aviso que
  entra desde el desenfoque.
- **Por qué le importa:** el alumno ya no se entera tarde; menos reclamos y menos sorpresas al final.

### 2.9 Justificantes (opcional, 2–3 s)

- **Pantalla real:** P-05 pestaña «Justificantes» y P-08 «Registrar justificante».
- **Palabras reales:** «Mendoza Ríos Héctor · E260020 · Administración Financiera · 3A · Pendiente · Ausente · Sesión del
  2026-09-11 · Registrado por el alumno el 11 sep 2026, 1:00 p.m. · Motivo: Enfermedad con receta · Ver documento ·
  **Aprobar** · Rechazar».
- **Consecuencia real:** al aprobar, su falta pasa a «Justificado» (no se borra el registro, RN-09), sus faltas
  equivalentes bajan 9 → 8 y su porcentaje 19.1 % → 17.0 % [CÁLCULO: 8/47]; sale de «en el límite».
- **Por qué le importa:** el justificante llega con su documento al mismo lugar donde decide; nada en papel.

### 2.10 Pase de lista manual (solo una línea o un detalle; 1–2 s)

- **Pantalla real:** P-04. «Sesión en modo manual»; selector «Presente / Retardo / Ausente»; «Guardar y cerrar sesión de
  clase». Grupo real: 5C · Matemáticas Financieras · Aula B-04 · «0 cám.» · chip «Manual».
- **Por qué le importa:** sin cámara (o sin consentimiento del alumno) la clase no se detiene (RF-09, RNF-07).
  Útil como respaldo de confianza, no como plano propio.

### 2.11 Confianza y privacidad (3 s, ver §4)

### No mostrar (no existe, es solo de demostración o es ruido)

- Módulos «Próximamente» de `modulos.js` (Asistente SUSAN, Tutorías, Comunicados, Calificaciones, Horarios inteligentes,
  Acceso al campus, Notificaciones): no tienen backend. No prometer avisos por correo ni asistente de IA.
- La tarjeta «Reloj de demostración (solo desarrollo)», la «Cámara simulada (demostración)», el distintivo «Solo
  desarrollo» y los rostros sintéticos (cuadros de color con marco magenta) de `DEMO-CAMARA.md`.
- Consola técnica, parámetros, índice FAISS, «faiss_id», «vector de 512 dimensiones»: lenguaje de ingeniería.
- Paleta ⌘K, menú de cuenta, catálogo `/modulos`: no aportan al docente en 55 s.
- Los colores de los prototipos de la spec (barra azul marino `#1F3A5F`, dorado `#A8842C`): la app real usa el sistema
  crema/blanco/tinta de `docs/design/SISTEMA.md` y la captura `capture/app-real/`.

---

## 3. Hoja de datos de demostración (canónica para todos los cuadros)

Escenario único: **lunes 14 de septiembre de 2026, 07:12**, semana 7 del periodo 2026-2, la docente Patricia Ortega
pasando lista a su grupo 3A. Es el mismo instante del reloj de demostración de la app, así que las capturas reales y el
video cuentan la misma mañana.

### 3.1 Identidad

| Campo | Valor | Marca |
|---|---|---|
| Institución | UNACH · FCA C-I | [REAL · spec] |
| Producto | wordmark tipográfico «SUSAN» (en locución: «susan», ver §5) | [REAL · BRIEF] |
| Docente | **Patricia Ortega Salinas** · iniciales «PO» · saludo «Buenos días, Patricia» · rol «Docente · FCA C-I» | [REAL · `01_catalogo.sql`, `dom/10-docente-home.html`] |
| Avatar de la docente | `assets/avatars/avatar-16-po.svg` | [REAL · v3] |
| Periodo | 2026-2 (inicia lun 3-ago-2026; 16 semanas; 3 sesiones por semana) | [REAL · `02_sesiones.sql`] |
| Hoy | lun 14 sep 2026 · 07:12 · semana 7 | [REAL · `DEMO.md`; CÁLCULO de la semana] |

### 3.2 Grupo protagonista

| Campo | Valor | Marca |
|---|---|---|
| Grupo | **3A · Administración Financiera** (ADM301) | [REAL] |
| Aula | A-12 (Edificio A, capacidad 40) · cámara frente activa · chip «Automático» | [REAL] |
| Horario | lun/mié/vie 07:00–08:00 | [REAL] |
| Alumnos | **24 activos** (25 inscripciones; E260025 en baja: no aparece) | [REAL · `DEMO-CAMARA.md`] |
| Sesiones programadas | **47** (48 del horario − 3 suspendidas + 2 de reposición) | [REAL · reporte «19 / 47»; CÁLCULO del desglose] |
| Faltas permitidas | **9** (20 % de 47 = 9.4; la 10.ª quita el derecho) | [CÁLCULO; `DEMO.md` «9 de 9»] |
| Segundo grupo (solo de fondo) | 5C · Matemáticas Financieras (MAT501) · Aula B-04 · 09:00–10:00 · «Manual» · «0 cám.» · 24 alumnos | [REAL] |

### 3.3 Panel de esta mañana (P-02)

«Abrir y pasar lista» sobre la sesión 3A de 07:00; **8** registros pendientes de revisión; **4** justificantes por
resolver; alertas «**3 sin derecho · 2 al límite**» (en 3A: 1 sin derecho, 2 en el límite). [REAL · `dom/10-docente-home.html`]

### 3.4 Sesión en vivo de hoy (P-03) — instantánea a las 07:12 (minuto 12 de 20)

| Dato | Valor | Marca |
|---|---|---|
| Inscritos | 24 | [REAL] |
| Presentes | **19** | [INVENTADO] |
| Retardos | **2**: Carmen Jiménez Ibarra (1.ª lectura 07:11:10) y Andrés Martínez Velasco (07:10:25) | [INVENTADO; elegidos porque su patrón de semilla es «muchos retardos», k 22–23 de `03_historial.sql`] |
| Por revisar | **1**: Renata Gómez Medina, «Pendiente» | [INVENTADO]; su «Lecturas 2/3»: **[RETIRADO DEL VIDEO · 2026-10-06]** |
| Sin registro | **2**: Paola Hernández Peña (patrón de semilla «falta los lunes») y Mauricio González Campos (ya sin derecho) | [INVENTADO, coherente con la semilla] |
| Medidor «Presentes ahora» | **88 %** · «21 de 24 inscritos» | [CÁLCULO: (19+2)/24 = 87.5 → 88, misma regla de la app] |
| Encabezado de la sesión | «Pasar lista» · «Administración Financiera (3A) · 14 sep 2026 · 07:00 a 08:00 · Aula A-12» · chips «Abierta» y «Automático» (sin «Volver al panel» en el video) | [REAL · `assets/sesion-encabezado-abierta-automatico.png`; F3 del video, 2026-10-06] |
| Línea de la cifra | «19 de 24 presentes» · «2 con retardo · 2 sin registro · 1 por revisar» | [formato REAL · `ResumenPaseLista.jsx`] |
| Última captura | «23 rostros · 22 válidos · +1 registro · hace 4 s» (22 = 21 presentes/retardos + Renata; el rostro 23 es una «Visita» que nadie reclama) | [INVENTADO; formato REAL] |
| Detalle de un presente | «Mejor score 0.94» · «Automático» · hora 07:02:15 | [INVENTADO; el formato del score es `toFixed(2)` y debe ser ≥ 0.85]; el «3/3» de la columna «Lecturas»: **[RETIRADO DEL VIDEO · 2026-10-06]** |
| Ventana de tolerancia | «Minuto 12.0 · Retardo» (presente antes del min 10, retardo del 10 al 20) | [REAL · RN-03; texto de `VentanaTolerancia`] |
| Cierre | «Cerrar pase de lista» deshabilitado hasta el minuto 20 | [REAL] |

Regla verificada en la captura real (crítica): «N de 24 presentes» cuenta solo presentes, y el medidor «Presentes ahora»
cuenta presentes + retardos («Presentes y retardos sobre inscritos»; `dom/39-escalonados-final.html`: 16 presentes + 8
retardos → «24 de 24 inscritos»). Por eso 19 + 2 → «21 de 24 inscritos» · 88 %.

Nota de coherencia: **no mostrar el cierre de esta sesión**. Si se cierra, los «sin registro» pasan a ausente y cambian
los acumulados de §3.6–3.9 (que son los de la semilla antes de hoy). Los 2 «sin registro» no están frente a la cámara: por
eso la captura cuenta 23 rostros (22 alumnos + 1 visita) y 22 válidos.

### 3.5 Caso de revisión (P-05) — REAL de la semilla

Emilio Ramírez Núñez · E260003 · 3A · clase de reposición sáb 12 sep 09:00–10:00 · «Lecturas válidas: 2/3» (**[RETIRADO DEL VIDEO · 2026-10-06]**) · lecturas
0.893 (min 2.0) y 0.927 (min 8.0), cámara frontal · «Quedan 2 h 48 min» (límite: 14 sep 2026, 10:00 a.m.) ·
«Resolver como Presente (Sugerido)». Tras resolver: pestaña «Pendientes» 8 → 7. [REAL · `dom/25-revision-caso.html`;
el 8 → 7 es CÁLCULO]

Lista de pendientes (columna izquierda de Revisión, primeras cuatro filas de las 8) [REAL · `dom/24-revision-pendientes.html`,
`assets/pantalla-revision-caso.jpg`; agregado 2026-10-06 para el F4 del video]: todas «Administración Financiera · 3A · 12 sep
09:00 · Quedan 2 h 48 min · Pendiente».

| Fila | Alumno | Iniciales y color del avatar |
|---|---|---|
| 1 | Ramírez Núñez Emilio (el caso) | RN `#475569` |
| 2 | Aguilar Ramos Luis | AR `#A21CAF` |
| 3 | Sánchez Herrera Daniel | SH `#A21CAF` |
| 4 | Morales Montes Laura | MM `#B4551A` |

Las filas 5–8 (Ruiz Salazar Fernanda, Gutiérrez Solís Jorge, Rodríguez Domínguez Daniela, Vargas Silva Ricardo) son del
13 sep y dicen «Quedan 26 h 48 min»; no salen en el video. La fila activa de la app es `border-foreground bg-accent/50`.

### 3.6 Alumno en riesgo (protagonista del arco «a tiempo») — REAL de la semilla

| Campo | Valor |
|---|---|
| Alumno | **Iván Cruz Rojas** · E260017 · 3A · iniciales de la app «CR» (apellidos) |
| Acumulado | 12 presentes · 0 retardos · 7 ausencias → **7 faltas equivalentes · 14.9 %** de 47 |
| Margen | **quedan 2 faltas** antes del límite (9) |
| Riesgo | **Alto · 64 / 100** · tendencia «Al alza» · «Cruce estimado: semana 9» (hoy es la 7) |
| Acción sugerida | «Contactar al alumno esta semana y acordar un plan de asistencia; revisar si hay justificantes por registrar.» |
| Lo que ve él | «Te quedan 2 faltas antes del límite.» |

Fuente: [REAL · `dom/19-reportes-grupo-3a.html`, `dom/21-analitica-3a.html`, `riesgo.js`, `alumno.utils.js`]. Es mejor
protagonista que Miguel Díaz (ya en el límite) o Mauricio González (ya sin derecho): todavía hay tiempo de intervenir, que
es el mensaje.

Reparto de apoyo (todos 3A, REAL): Miguel Díaz Castro E260001 «A una falta del límite» 9 faltas 19.1 % (riesgo Medio 51);
Héctor Mendoza Ríos E260020 «En el límite» 9 faltas 19.1 % (Alto 66, cruce semana 7, justificante pendiente);
Mauricio González Campos E260014 «Sin derecho a examen» 14 faltas 29.8 % (Alto 70).

### 3.7 Patrón semanal y tendencia del 3A — REAL (`dom/21-analitica-3a.html`)

| Dato | Valor |
|---|---|
| Ausentismo semanal observado | S1 13.3 % · S2 20.0 % · S3 22.0 % · S4 15.3 % · S5 16.7 % · **S6 20.8 %** |
| Tarjeta | «Ausentismo actual 20.8 % · +4.2 pp vs. semana previa» |
| Tendencia | «Tendencia al alza: +0.59 pp por semana» (EMA S6 18.9 %) |
| Proyección | S7 20.1 % … **S15 24.8 %** (IC 95 % S15: 0 % a 54.6 %) · «Proyección al cierre 24.8 % · Semana 15» |
| Faltas acumuladas (promedio por alumno) | S1 0.9 % → S6 8.2 % · proyección S15 19.9 % · «Cruce: No cruza dentro del periodo» |
| Día de la semana | Lun **17.7 %** (26 ausencias en 6 sesiones) · Mié **16.4 %** (20 en 5) · Vie **21.8 %** (32 en 6) · «Día crítico: Viernes» |
| «Ver cifras por día» (renglón del viernes) | «Viernes 21.8 % (32 ausencias en 6 sesiones)»; en el video, bajo la casilla del viernes: «32 ausencias en 6 sesiones» [REAL · DOM 21; agregado 2026-10-06] |
| Riesgo | «9 alumnos en riesgo» · Bajo 16 · Medio 6 · Alto 3 |
| Ranking (puntaje) | González Campos Mauricio 70 · Mendoza Ríos Héctor 66 · Cruz Rojas Iván 64 · Díaz Castro Miguel 51 · Aguilar Ramos Luis 49 · Hernández Peña Paola 47 · Rodríguez Domínguez Daniela 43 · Flores Cortés Sofía 42 |

En la tira semanal mostrar **solo Lun/Mié/Vie** (el horario del grupo): los valores de Sáb/Dom 12.5 % salen de las dos
clases de reposición y confunden.

### 3.8 Reporte del grupo (P-07) — REAL (`dom/19-reportes-grupo-3a.html`)

«Periodo: 2026-2 · Grupo: Administración Financiera 3A» · «Sesiones cerradas 19/47» · «Asistencia promedio 80.58 %» ·
«2 en el límite · 1 sin derecho» · estados 330 / 31 / 83 / 4 / 8 (72 / 7 / 18 / 1 / 2 %) · «Impacto en tiempo de clase 95
min · Unas 1.6 h recuperadas» · «Generado: 14/09/26, 7:12 a.m.» · exportación `asistencia_2026-2_adm301-3a_20260914.csv`.
Vista de periodo (ambos grupos): «2 grupos · 48 inscritos · asistencia promedio 81.46 % · 2 en el límite · 3 sin derecho».

### 3.9 Justificante — REAL (`dom/27-revision-justificante.html`)

Héctor Mendoza Ríos · E260020 · falta del vie 11 sep 07:00 · «Enfermedad con receta» · «Registrado por el alumno el 11
sep 2026, 1:00 p.m.» · «Aprobar» → «Justificado» · faltas 9 → 8 (19.1 % → 17.0 %) [CÁLCULO].

### 3.10 Si la analítica usa el 5C (alternativa)

«Ausentismo actual 25.0 % · +2.8 pp vs. semana previa» · serie S1–S6: 12.0 · 10.7 · 12.2 · 19.4 · 22.2 · 25.0 % ·
«+3.06 pp por semana» · «Proyección al cierre 55.1 % · Semana 16» · faltas acumuladas S6 7.4 % → S16 20.4 % · «Cruce del
límite · Semana 16 · Estimada» · «Cambio de nivel a la alza desde la semana 3 (detectado en la 4)» · «Alumnos en riesgo 8;
2 sobre el límite». Si se usa, el rótulo debe decir «Matemáticas Financieras (5C)» y **no** mezclar sus alumnos con los del
3A en el mismo plano (ver §3.11).

### 3.11 Trampas de coherencia detectadas (leer antes de poner cifras)

1. **Nombres repetidos entre grupos.** La semilla genera los 25 nombres de cada grupo con la misma fórmula: E260014 (3A)
   y E260064 (5C) son ambos «González Campos Mauricio»; E260020 y E260070, «Mendoza Ríos Héctor». El panel real lo
   muestra así. En el video, **solo nombres del 3A**.
2. **19.1 % vs 19.2 %.** 9/47 = 19.149 %. La app muestra «19.2 %» en la lista de alertas y en «Faltas por alumno», y
   «19.1 %» en la gráfica de alertas y en la tabla de riesgo (doble redondeo). En el video usar **19.1 %** (el correcto).
   Se reporta como observación para el equipo de la app; no se toca desde aquí.
3. **«9 de 25» en la analítica.** La tarjeta real dice «Alumnos en riesgo 9 de 25» (cuenta la inscripción en baja). En el
   video: «9 alumnos en riesgo» sin denominador, o «de 24».
4. **20.8 % no es el límite.** El «Ausentismo actual 20.8 %» es la tasa semanal del grupo; el límite del 20 % es de faltas
   acumuladas por alumno. No poner «20.8 %» pegado a la marca «Límite 20 %» en el mismo plano (parecería que el grupo
   ya perdió el derecho). La marca de límite va en la gráfica de faltas acumuladas, en las barras por alumno o en la fila
   de Iván.
5. **Lecturas de sesiones históricas.** Las sesiones cerradas de la semilla muestran «0/3 · -» en «Lecturas · Mejor
   score» (la carga masiva no crea detecciones; `dom/29-sesion-cerrada-18.html`). Para la tabla en vivo usen los valores
   inventados de §3.4, sin la columna «Lecturas» (el x/3 no va en el video desde el 2026-10-06).
6. **Tilde faltante en la app.** La fase «Presente (dentro del limite de puntualidad)» no lleva tilde en el código
   (`monitorSesion.utils.js` l. 89). En el video escribir «límite».
7. **Iniciales.** La app forma las iniciales con los dos apellidos («CR» = Cruz Rojas Iván, «RN» = Ramírez Núñez Emilio,
   «MR» = Mendoza Ríos Héctor). Los avatares Lorelei de `assets/avatars/` son solo ilustración: sus nombres del manifiesto
   no son los de la semilla. `avatar-15-cr.svg` sirve para Iván por las iniciales; `avatar-16-po.svg` es Patricia.

### 3.12 Parámetros que pueden aparecer (todos REAL, Tabla 4 de la spec y `DEMO-RELOJ.md`)

Presente antes del minuto 10 · retardo del 10 al 20 · una captura cada 15 s (hasta 80 por cámara y sesión) ·
~~3 lecturas válidas confirman~~ **[RETIRADO DEL VIDEO · 2026-10-06]** · score mínimo 0.85 · 48 h para corregir desde el fin
de la sesión · 3 retardos = 1 falta · límite 20 % · recortes borrados a los 7 días · enlaces a imágenes de 5
min (300 s).

---

## 4. Privacidad y confianza en una línea (para docentes)

| Línea para pantalla o locución | Respaldo |
|---|---|
| «Sin consentimiento firmado y vigente, no hay reconocimiento: ese alumno se registra a mano.» | RN-13, RNF-06, RF-09 |
| «La base de datos no guarda fotos ni rasgos faciales.» | RNF-03 (0 vectores e imágenes en tablas; solo una referencia al índice) |
| «Las imágenes solo se abren con enlaces que caducan en 5 minutos.» | RNF-04 (URL firmada ≤ 300 s) |
| «Los recortes de rostro se borran solos a los 7 días.» | RNF-05 |
| «Cada consulta queda registrada en la bitácora.» | RF-19, RNF-08 (bitácora de solo inserción) |
| «Tú ves solo tus grupos; cada alumno, solo su asistencia.» | RF-19, RF-20, RF-21 |
| ~~«Una sola lectura no decide: hacen falta tres, y lo dudoso lo decides tú.»~~ **[RETIRADO DEL VIDEO · 2026-10-06]**; en su lugar: «La cámara no decide sola: lo dudoso lo decides tú.» | RN-05, RF-18 |
| «Sin cámara, el pase de lista manual sigue funcionando.» | RF-09, RNF-07 |

Recomendación para el beat de confianza (3 s): una línea principal + dos chips cortos, p. ej. «Sin consentimiento, no
hay reconocimiento» con chips «Sin fotos en la base de datos» · «Cada consulta, en bitácora» (con icono Lucide
`ShieldCheck`/`LockKeyhole`, no candado dibujado a mano).

**Afirmaciones prohibidas** (no tienen respaldo o la spec las excluye): «a prueba de suplantación» o «detecta fotos»
(la detección de vida está fuera de alcance, Tabla 1); «datos cifrados» (no está especificado); «la IA aprende de tu grupo»
(no se entrena ningún modelo: se usa uno preentrenado y la analítica es regresión y métodos numéricos; decir «analiza»,
«proyecta»); «te avisa por correo» (Notificaciones está en «Próximamente»); «100 % preciso»; «ahorra 20 h» como hecho
medido (es estimación); «app para el alumno» (es portal web responsivo).

---

## 5. Esqueleto de locución (es-MX, cálido y seguro; ~125 palabras)

Solo esqueleto: el storyboard lo reescribe. Tiempos orientativos para 55 s a ~2.6 palabras/s; las cifras van **en
palabras** para que ElevenLabs no las lea mal («veinte por ciento», no «20 %»). **«susan» siempre en minúsculas** (en
mayúsculas ElevenLabs la deletrea; lección de la v3). En la v3 el STT detectó una línea como italiano: probar una toma con
«susan» y, si suena extraña, otra con «Súsan» antes de fijarla.

| Beat | Ventana aprox. | Texto (esqueleto) | Palabras | En pantalla (no repetir la voz) |
|---|---|---|---|---|
| B1 Gancho | 0.8–5.0 s | «Cada clase empieza igual: nombrar a cada alumno, uno por uno.» | 11 | lista de nombres que se repite / ninguna cifra |
| B2 Costo | 5.3–10.5 s | «Cinco minutos por sesión. [Con cinco grupos, unas veinte horas al semestre.]» | 12 | «5 min × 3 × 16 = 4 h por grupo» · «unas 20 h al semestre (estimación)» |
| B3 Nombre | 11.0–12.8 s | «Te presentamos a susan.» | 4 | wordmark «SUSAN» |
| B4 Pasar lista | 13.5–21.5 s | «Abres la sesión y la cámara del aula pasa lista mientras das tu clase. ~~Tres lecturas,~~ y el alumno queda presente.» (**[RETIRADO DEL VIDEO · 2026-10-06]**: la v4 dice «La cámara del aula pasa lista por ti mientras das tu clase… y cada alumno queda presente.») | 21 | «Abrir y pasar lista» → «19 de 24 presentes», ~~«3/3»~~, «Presente» |
| B5 Revisión | 22.3–27.0 s | «¿Algún caso dudoso? Te espera en Revisión y lo resuelves con un clic.» | 13 | ~~«Lecturas válidas: 2/3»~~ (**[RETIRADO DEL VIDEO · 2026-10-06]**) · «Resolver como Presente (Sugerido)» |
| B6 Analítica | 28.0–36.5 s | «Con cada sesión, susan analiza a tu grupo: qué día faltan más, hacia dónde va la tendencia y quién se acerca al límite.» | 23 | «Día crítico: Viernes» · «+4.2 pp» · «Proyección al cierre 24.8 %» |
| B7 A tiempo | 37.2–42.2 s | «A Iván le quedan dos faltas. Todavía estás a tiempo de hablar con él.» | 14 | «Alto · 64 / 100» · «Cruce estimado: semana 9» · acción sugerida |
| B8 Alumno + reportes | 42.8–47.8 s | «[Él también lo ve en su portal,] y tus reportes salen listos para entregar.» | 14 | «Te quedan 2 faltas antes del límite.» · «Exportar CSV» |
| B9 Confianza | 48.4–51.8 s | «Sin consentimiento no hay reconocimiento, y cada consulta queda registrada.» | 10 | chips «Sin fotos en la base de datos» · «Bitácora» |
| B10 Cierre | 52.2–53.6 s | «susan. Pasa lista en segundos.» | 5 | «Pasa lista en segundos y entiende la asistencia de tus grupos.» + wordmark; ≥ 1.4 s de silencio final |

Total: **127 palabras** (rango pedido 120–140). Advertencia: `LECCIONES-V3.md` §5 y `REFERENCIA.md` §3.4 recomiendan
**90–110 palabras** (60–75 % de cobertura) para dejar huecos a los SFX y no repetir las colas muertas de la v3. Quitando
lo que va entre corchetes (B2 segunda frase y B8 primera mitad) y acortando B6 a «Con cada sesión, susan te muestra qué día
faltan más y quién se acerca al límite.» (16) el guion queda en **~105 palabras** sin perder ningún beat. Si se quita la
segunda frase de B2, en pantalla debe seguir la cifra «4 h por grupo» (la voz ya no da el cálculo).

Reglas para quien reescriba: «sin papeleo» suena mejor que «sin escribir nada» (lección v3); no decir cifras que no
estén en §1 o §3; la cifra llega a pantalla **antes** de que la voz la nombre; el texto en pantalla complementa (dato,
etiqueta) y no repite la frase hablada.

---

## 6. Afirmaciones de la v3 que hay que corregir

| v3 (cuadro) | Problema | v4 |
|---|---|---|
| F2 «10 min por clase × 3 grupos × 5 días = 2 h 30 / semana» | La spec dice ~5 min por sesión y 3 sesiones por semana por grupo | «5 min × 3 × 16 semanas = 4 h por grupo al semestre»; «unas 20 h con 5 grupos (estimación)» |
| F3 Héctor Mendoza «6 % → 21.6 %», «Sin derecho» | En 3A Héctor está en 19.1 % «En el límite» | Mauricio González 29.8 % «Sin derecho» o Iván Cruz 14.9 % con margen |
| F5 chips «98 %» y «listo en 6 s» | La app muestra score 0.85–1.00 con dos decimales y lecturas «3/3»; confirmar toma ~30–45 s | «Mejor score 0.94»; sin cronómetro (el «Lecturas 3/3» de esta fila: **[RETIRADO DEL VIDEO · 2026-10-06]**) |
| F7 «similitud 71 % · 2 lecturas», «Confirmar presente / Rechazar», «Pendientes 3 → 2» | 71 % no sería una lectura válida (umbral 0.850); los botones reales son otros; la cola real tiene 8 | «Score 0.893 / 0.927» (el «2/3»: **[RETIRADO DEL VIDEO · 2026-10-06]**), «Resolver como Presente (Sugerido)», 8 → 7 |
| F9 serie S1–S8 de 8 a 17 %, «Cruza el límite en S11», «Proyección al cierre 24.6 %» | Hay 6 semanas observadas; en 3A el acumulado «No cruza»; proyección real 24.8 % (S15) | Datos de §3.7, o 5C (§3.10) si se quiere el cruce (semana 16) |
| F10 «88 % · Racha de 7» del alumno | Inventado | Iván: 7 faltas, 14.9 %, «Te quedan 2 faltas antes del límite.» |
| F6 «Sesión en curso» (chip verde) | Los chips reales son «Abierta» y «Automático» | Usar los reales |

---

## 7. Capturas reales disponibles para calcar (actualizado por la crítica con `capture/app-real/INVENTORY.md`, 2026-10-06 00:13 UTC)

| Función | Captura (desktop PNG `.clean.png` + DOM; `mobile/` donde se indica) |
|---|---|
| Panel del docente | `10-docente-home` (+ mobile) |
| Barra inferior móvil (Panel · Revisión · Pasar lista · Reportes · Analítica) | `mobile/10-docente-home.png`, `13-docente-nav-movil` |
| Reporte de periodo / grupo 3A / alumno | `17-reportes-periodo`, `19-reportes-grupo-3a`, `20-reportes-alumno` |
| Analítica 3A / procedimiento / 5C | `21-analitica-3a` (+ mobile), `22-analitica-3a-procedimiento`, `23-analitica-5c` |
| Revisión: pendientes, caso, justificantes, correcciones | `24-…` a `28-…` (24 también mobile) |
| **Sesión en vivo con cámara** | `30-pasar-lista-inicio` (0 de 24) → `31-pasar-lista-fotograma1` (24 por revisar) → `32-…fotograma2` / `33-…presentes` (24 de 24) → `34-…simulacion-completa` (25 rostros · 24 válidos) · `35-…fuera-de-ventana` · `38/39-escalonados` (16 presentes + 8 retardos) · `36-cierre-dialogo` · `37-sesion-19-cerrada`; mobile 30, 31, 33; video `video/01-pasar-lista-camara-simulada.webm` |
| Sesión cerrada (histórica) | `29-sesion-cerrada-18` |
| Pase manual 5C | `45-pase-manual-5c` |
| **Portal del alumno** | `50-alumno-e260001-limite` (+ mobile), `51-…-sin-derecho` (+ mobile), `52/53-…-justificante/justificar`, `54-…-justificadas`, `56-alumno-paleta` |

Uso de las capturas de la sesión en vivo: **solo como referencia de maquetación, textos y tokens**. Sus cifras (0 → 24 de
24, cierre de la sesión 19 con 100 %) salen de la cámara simulada y **no** son las del video: el video usa la instantánea
de §3.4 y no muestra el cierre. La vista de cámara simulada (cuadros magenta) nunca se calca.
