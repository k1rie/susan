# Inventario canónico de activos — SUSAN v4

Única lista de la que el storyboard toma `asset_candidates` (escribirlos como `assets/<nombre>`; `stage-assets.mjs` los
copia de `capture/assets/` a `assets/`). Son **capturas reales** de la app en modo demostración (lunes 14-sep-2026 07:12,
semilla de `scripts/seed-demo.sh`), sacadas de `capture/app-real/` por `scripts/build-capture-assets.sh`. 67 archivos, 3.4 MB.

Cómo usarlos (DISENO-APP §0 y SINTESIS 10): la UI que se anima **se reconstruye en HTML** con los tokens de `frame.md`; estas
imágenes son la referencia píxel a píxel (los recortes `2x` empatan con la escala E = 2 del video) y, como mucho, placas de
fondo desenfocadas o contexto ≤ 1.5 s. **Las cifras de la demo en pantalla salen de CONTENIDO §3**, no de estas imágenes cuando
no coinciden (lo marca cada línea con «no canónico»). Nunca en pantalla: «Reloj simulado», la cámara simulada (cuadros
magenta, «Cámara simulada»), recortes sintéticos de rostro, nombres del 5C mezclados con el 3A, «9 de 25», «19.2 %».

Formato: `assets/<nombre>` — qué muestra (cifras visibles) — tamaño — mejor uso. Escala: `2x` = 2 px por px CSS (E = 2),
`3x` = captura de teléfono (390 css), `1x` = pantalla de escritorio reducida a 1920×1080.

## Pantallas completas (contexto, placas pre-desenfocadas, maquetación)

- assets/pantalla-home-docente.jpg — Home del docente completo: riel, «Buenos días, Patricia» con subrayado dorado, PasarListaHero 3A «Abrir y pasar lista», pendientes 8 y justificantes 4, sesiones de hoy, alertas, «Faltas vs límite», tarjetas de módulos. Trae una línea pequeña «Reloj simulado» bajo «Hoy: 2026-09-14» que no debe leerse — 1920×1080 · 132 KB · 1x — placa de apertura o fondo desenfocado del cielo, contexto del producto
- assets/pantalla-analitica-3a.jpg — Analítica de ausentismo 3A: cuatro StatCards (20.8 %, 24.8 %, No cruza, 9), tres avisos, gráfica semanal con proyección y gráfica de faltas acumuladas — 1920×1080 · 148 KB · 1x — placa desenfocada detrás del plano héroe de datos, contexto ≤ 1.5 s
- assets/pantalla-revision-caso.jpg — Revisión con la lista de 8 pendientes y el caso de Emilio abierto (lecturas 2/3, «Resolver como») — 1920×1080 · 164 KB · 1x — placa de fondo del tramo de revisión
- assets/pantalla-reportes-3a.jpg — Reporte del grupo 3A: indicadores, anillo 81 %, faltas por alumno con límite, impacto 95 min — 1920×1080 · 152 KB · 1x — placa de fondo o contexto si se menciona el reporte
- assets/pantalla-pasar-lista-maqueta.jpg — Sesión en vivo «Pasar lista» con guía de 3 pasos, cámara, «16 de 24 presentes», anillo, medidor y tabla. SOLO MAQUETA: contiene la cámara simulada magenta y la tarjeta de desarrollo «Cámara simulada (demostración)» — 1920×1080 · 180 KB · 1x — referencia de distribución para reconstruir la sesión en vivo, nunca en pantalla
- assets/pantalla-alumno-limite.jpg — Portal del alumno E260001 (Miguel, en el límite): «Buenos días, Miguel», medidor 80.9 %, anillo 19 sesiones, aviso de límite — 1920×1080 · 116 KB · 1x — referencia de maquetación si se reconstruye la vista de Iván (no hay captura de E260017)
- assets/pantalla-login-pasa-lista.jpg — Login: «Inicia sesión» con subrayado dorado a la izquierda y panel crema con tarjeta flotante + titular serif «Pasa lista en segundos» a la derecha. La tarjeta lista alumnos del 5C — 1920×1080 · 96 KB · 1x — referencia del héroe de acceso (precedente nativo de la tarjeta flotante con sombra y de la serif), placa del cierre
- assets/pantalla-bienvenida-asi-funciona.jpg — Onboarding paso 2 «Así funciona SUSAN para ti» con tres TarjetaFila: Pasa lista con la cámara · Revisa solo lo dudoso · Anticípate al ausentismo — 1920×1080 · 68 KB · 1x — referencia de copy y de filas con ficha pastel
- assets/movil-home-docente.jpg — Home en teléfono: saludo serif, PasarListaHero a todo el ancho, barra inferior flotante. Trae «Reloj simulado» y un «3» de pendientes tomado a mitad del conteo (el real es 8): no canónico — 1170×2532 · 204 KB · 3x — referencia del teléfono completo, maquetación del panel tipo móvil
- assets/movil-analitica-3a.jpg — Analítica en teléfono: «Analítica de ausentismo», selector 3A, StatCards 20.8 % y 24.8 %, «No cruza», barra inferior con Analítica activa — 1170×2532 · 192 KB · 3x — referencia del panel teléfono con datos

## Teléfono: barra inferior y botón central (fuente del sting de cierre)

- assets/movil-boton-central-pasar-lista.png — Botón central real del BottomNav: círculo de tinta con `scan-face` blanco, anillo blanco y sombra suave, etiqueta «Pasar lista» 600 — 240×240 · 16 KB · 3x — referencia exacta de la ficha que cae en el cierre (C → wordmark), del pulso de «Pasar lista» y del aro de oro
- assets/movil-barra-inferior-panel.png — BottomNav de vidrio: Panel (activo, fondo #EFECE7) · Revisión · [Pasar lista] · Reportes · Analítica — 1170×270 · 44 KB · 3x — reconstruir la barra móvil real, toque sin cursor en un destino
- assets/movil-barra-inferior-analitica.png — El mismo BottomNav con Analítica activa — 1170×270 · 48 KB · 3x — estado activo alterno para un relevo de pestaña

## Panel del docente (/docente)

- assets/home-saludo-buenos-dias-patricia.png — Cabecera real: «Docente · FCA C-I», «Buenos días, Patricia» en EB Garamond 500 con subrayado dorado bajo «Patricia», lema «Pasa lista en segundos y entiende la asistencia de tus grupos.» y CampoComando «¿Qué quieres hacer hoy? ⌘ K» — 940×470 · 40 KB · 2x — calco del saludo serif (el único momento serif) y del lema
- assets/home-resaltado-patricia.png — «Patricia» con el trazo dorado `Resaltado` — 296×110 · 8 KB · 2x — referencia del subrayado dorado que se reutiliza bajo el wordmark
- assets/home-brandmark-susan.png — BrandMark del riel: escudo UNACH + «SUSAN» Hanken 600 — 384×64 · 12 KB · 2x — la marca real ampliada es el wordmark del cierre (sin el escudo)
- assets/home-campo-comando.png — CampoComando: lupa, «¿Qué quieres hacer hoy?», `kbd` «⌘ K» — 896×90 · 12 KB · 2x — detalle del Home
- assets/home-pasar-lista-hero.png — PasarListaHero: ficha azul `scan-face` «Pasar lista», chip «Programada», «Administración Financiera (3A)», «07:00 - 08:00 · Aula A-12», «Cámara del aula lista», botón de tinta «Abrir y pasar lista», enlace «Otras sesiones de hoy (1)» — 1984×476 · 40 KB · 2x — tarjeta héroe del momento producto, pulso del botón sin cursor, relevo hacia la sesión en vivo
- assets/home-portada-pasar-lista-degradado.png — TarjetaPortada «Pasar lista · Asistencia · Abrir» con la portada `DEGRADADO` rosa-durazno-menta-azul — 374×402 · 36 KB · 2x — fuente del holograma E2 (superficie héroe, brillo de la marca)
- assets/home-portada-revision-dorado.png — TarjetaPortada «Revisión de registros · Asistencia» en tono dorado — 372×402 · 16 KB · 2x — color de halo dorado y ficha de módulo
- assets/home-portada-reportes-verde.png — TarjetaPortada «Reportes · Asistencia» en tono verde — 374×402 · 12 KB · 2x — halo verde y ficha de módulo
- assets/home-portada-analitica-violeta.png — TarjetaPortada «Analítica de ausentismo · Análisis» en tono violeta — 372×402 · 16 KB · 2x — halo violeta y ficha de módulo
- assets/home-indicadores-pendientes-8-4.png — Dos StatCards: «Registros pendientes de revisión 8 · Esperan tu revisión» y «Justificantes por resolver 4 · Esperan tu resolución» — 1984×268 · 20 KB · 2x — cifras del panel de esta mañana
- assets/home-statcard-pendientes-8.png — StatCard sola «Registros pendientes de revisión 8» con pastilla dorada `clipboard-check` — 980×268 · 16 KB · 2x — calco de StatCard con tono warning, puente hacia Revisión
- assets/home-fila-sesion-3a.png — TarjetaFila de la sesión: «Administración Financiera (3A) · 07:00 - 08:00 · Aula A-12 · 1 cám.», chips «Programada» y «Automático», botón «Abrir y pasar lista» — 980×200 · 28 KB · 2x — variante compacta de la entrada a la sesión
- assets/home-mis-grupos.png — «Mis grupos»: 3A Aula A-12 · 2026-2 · 24 alumnos y 5C Aula B-04 · 24 alumnos — 976×410 · 40 KB · 2x — contexto (mostrar solo la fila 3A)
- assets/home-faltas-vs-limite.png — TarjetaGrafica «Faltas vs límite» con BarrasPildora y chip «Límite 20 %»: 29.8 %, 24.4 %, 22.2 %, 19.1 %, 19.1 %. Mezcla nombres del 3A y del 5C: no canónico — 976×654 · 56 KB · 2x — calco de barras hacia la marca de límite (rehacer solo con alumnos del 3A)
- assets/chip-programada.png — StatusChip «Programada» (tokens pendiente) — 194×42 · 4 KB · 2x — calco de StatusChip md

## Pasar lista en vivo (componentes reales, cifras de la cámara simulada: no canónicas)

- assets/sesion-encabezado-abierta-automatico.png — PageHeader: «Volver al panel · Pasar lista · Administración Financiera (3A) · 14 sep 2026 · 07:00 a 08:00 · Aula A-12» con chips «Abierta» y «Automático» — 1984×170 · 24 KB · 2x — encabezado de la sesión en vivo
- assets/sesion-guia-asi-se-pasa-lista.png — Guía «Así se pasa lista»: Sesión abierta · Apunta la cámara al grupo · Revisa y cierra — 1984×272 · 32 KB · 2x — copy real de los 3 pasos
- assets/sesion-camara-en-pausa.png — VistaCamara real: marco de tinta 16:9, chips oscuros «En pausa» y «Cámara frente», `camera-off` y «Sin imagen: la cámara no está disponible.» — 1122×632 · 20 KB · 2x — receta de los chips oscuros y del marco (el contenido de la cámara se dibuja con avatares abstractos)
- assets/sesion-resumen-0-de-24.png — ResumenPaseLista inicial: «Asistencia ahora · 0 de 24 presentes», barra roja, «0 con retardo · 24 sin registro», «Esperando la primera captura…» — 732×310 · 20 KB · 2x — estado de partida antes de la primera oleada
- assets/sesion-resumen-16-de-24.png — ResumenPaseLista: «16 de 24 presentes», barra verde + ámbar, «8 con retardo · 0 sin registro», «Última captura: 25 rostros · 24 válidos · +8 registros · hace 10 s». Cifras no canónicas (el video usa 19 de 24) — 732×350 · 28 KB · 2x — calco tipográfico de la cifra «N de 24 presentes» y de la línea de captura
- assets/sesion-medidor-liquido.png — MedidorLiquido azul «100 % · Presentes ahora · 24 de 24 inscritos». No canónico (el video: 88 % · 21 de 24) — 422×306 · 16 KB · 2x — receta del tanque, marcas y texto
- assets/sesion-anillo-sin-registro.png — AnilloEstados «24 Inscritos» todo rojo: Sin registro 24 (100 %) — 440×554 · 32 KB · 2x — estado inicial del anillo de la sesión
- assets/sesion-anillo-presentes-retardos.png — AnilloEstados «24 Inscritos»: Presentes 16 (67 %) · Retardos 8 (33 %) · Sin registro 0 · Pendientes 0. No canónico — 424×554 · 32 KB · 2x — receta de arcos con hueco, leyenda y estados en cero al 55 %
- assets/sesion-grafica-asistencia.png — TarjetaGrafica «Asistencia de la sesión · Presentes y retardos sobre inscritos»: anillo 24 + medidor 100 % «24 de 24 inscritos». No canónico — 976×762 · 56 KB · 2x — composición anillo + medidor del plano en vivo
- assets/sesion-ventana-tolerancia.png — «Ventana de tolerancia · Presente (dentro del limite de puntualidad) · Minuto 2.6 de 20», barra verde/ámbar, «Presente hasta min 10 · Retardo hasta min 20» (la app no lleva tilde en «limite») — 976×318 · 24 KB · 2x — receta de la barra de tolerancia (en el video: Minuto 12.0, Retardo)
- assets/sesion-acciones-cerrar-registrar.png — «Cerrar pase de lista» deshabilitado (`clipboard-check`), «Registrar manualmente» (`user-pen`), «El cierre se habilita al terminar la tolerancia: faltan 18 min.» — 732×306 · 20 KB · 2x — detalle de acciones (no se muestra el cierre)
- assets/sesion-statcard-retardos.png — StatCard «Retardos 0» con pastilla ámbar `clock` — 478×242 · 12 KB · 2x — calco de las 4 tarjetas Inscritos/Presentes/Retardos/Sin registro
- assets/sesion-tabla-alumnos-maqueta.png — Tabla «Alumnos inscritos»: Matrícula · Alumno · Estado · Lecturas · Mejor score · Origen · Hora · Consentimiento · Acción, filas con «Retardo»/«Presente», «Automático», «Vigente» (Aguilar Ramos Luis, Castillo Guzmán María, Cruz Rojas Iván, Díaz Castro Miguel…). Cifras de simulación 4/3 y 1.00: no canónicas (usar 3/3 · 0.94) — 1984×900 · 144 KB · 2x — calco de filas, chips de estado y origen

## Revisión (/docente/revision)

- assets/revision-pestanas-pendientes-8.png — Tabs «Pendientes (8) · Justificantes (4) · Correcciones (0)» — 1984×92 · 12 KB · 2x — contador que rueda 8 → 7
- assets/revision-caso-emilio.png — Caso abierto «Ramírez Núñez Emilio · E260003 · Pendiente · Sesión del 2026-09-12 · Quedan 2 h 48 min · Lecturas válidas: 2/3», barras de score, lecturas y botones. Sus recortes de rostro son sintéticos (cuadros magenta): no calcarlos, usar avatar — 1312×1758 · 152 KB · 2x — maquetación de la tarjeta del caso
- assets/revision-score-por-lectura.png — «Score por lectura · Similitud con la foto de registro (%), por número de lectura»: dos columnas verdes 89 % y 93 %, leyenda Válida / No válida — 1228×612 · 28 KB · 2x — las dos barras que se llenan
- assets/revision-resolver-como.png — «Comentario (opcional)» y botones «Resolver como Presente (Sugerido)» (tinta) · «Resolver como Retardo» · «Resolver como Ausente» — 1228×308 · 20 KB · 2x — el pulso de la decisión docente
- assets/chip-pendiente.png — StatusChip «Pendiente» — 166×42 · 4 KB · 2x — chip que pasa a «Presente»

## Analítica de ausentismo 3A (/analitica)

- assets/analitica-fila-cifras.png — Cuatro StatCards: «Ausentismo actual 20.8 % +4.2 pp vs. semana previa» · «Proyección al cierre 24.8 % Semana 15 (0 % a 55 %)» · «Cruce del límite No cruza» · «Alumnos en riesgo 9 de 25 · 1 sobre el límite» — 1984×300 · 48 KB · 2x — fila de cifras (en el video sin «de 25»)
- assets/analitica-statcard-ausentismo-20-8.png — StatCard «Ausentismo actual 20.8 %», pastilla roja `gauge`, hint rojo «+4.2 pp vs. semana previa», sparkline — 478×300 · 20 KB · 2x — calco de referencia de la escala E = 2 (probado contra una recreación con `zoom: 2`), cifra héroe con delta
- assets/analitica-statcard-proyeccion-24-8.png — StatCard «Proyección al cierre 24.8 % · Semana 15 (0 % a 55 %)», pastilla neutra `trending-up` — 478×300 · 16 KB · 2x — segunda cifra de la tendencia
- assets/analitica-statcard-riesgo-9.png — StatCard «Alumnos en riesgo 9», pastilla roja `shield-alert`, «de 25 · 1 sobre el límite» (no canónico) — 478×300 · 12 KB · 2x — cifra «9 alumnos en riesgo»
- assets/analitica-tarjeta-ausentismo-semanal.png — TarjetaGrafica «Ausentismo semanal · Tendencia al alza: +0.59 pp por semana. Proyección con intervalo de 95 %.» con GraficaLinea S1–S15, Observada · Ajuste · Proyección · Intervalo 95 % · EMA y casillas SMA/EMA/WMA. Incluye la línea «Límite 20 %» que el video quita en esta gráfica — 976×1030 · 64 KB · 2x — plano héroe de la línea con guía y tooltip
- assets/analitica-grafica-linea-semanal.png — La misma GraficaLinea sin tarjeta: puntos de tinta S1–S6, ajuste azul, proyección discontinua a S15, banda del 95 %, EMA dorada — 892×670 · 40 KB · 2x — calco geométrico de la gráfica héroe
- assets/analitica-faltas-acumuladas-limite.png — «Faltas acumuladas y límite · Cruce: No cruza dentro del periodo»: Acumulado 0.9 % → 8.2 %, ajuste, proyección hacia ~20 % en S15, «Límite 20 %» — 976×1030 · 56 KB · 2x — donde sí va la marca de límite junto a una línea
- assets/analitica-patron-semanal-viernes.png — «Ausentismo por día de la semana · Día crítico: Viernes» con TiraSemana Lun 17.7 · Mié 16.4 · Vie 21.8 (anillo) · Sáb 12.5 · Dom 12.5 — 1984×474 · 36 KB · 2x — relevo al patrón semanal (en el video solo Lun · Mié · Vie)
- assets/analitica-tira-semana.png — Solo las casillas de TiraSemana (17.7 % · 16.4 % · 21.8 % · 12.5 % · 12.5 %) — 1120×146 · 20 KB · 2x — calco de color y anillo de la casilla crítica
- assets/analitica-ranking-riesgo.png — BarrasPildora «Mayor riesgo»: González Campos Mauricio 70 · Mendoza Ríos Héctor 66 · Cruz Rojas Iván 64 · Díaz Castro Miguel 51 · Aguilar Ramos Luis 49 · Hernández Peña Paola 47 · Rodríguez Domínguez Daniela 43 · Flores Cortés Sofía 42, leyenda Alto / Medio — 1088×604 · 48 KB · 2x — ranking del que sale Iván (rack focus a su fila)
- assets/analitica-anillo-riesgo-9.png — AnilloEstados «9 en riesgo»: Bajo 16 (64 %) · Medio 6 (24 %) · Alto 3 (12 %) — 698×554 · 28 KB · 2x — distribución por nivel
- assets/analitica-alumnos-en-riesgo.png — Tarjeta «Alumnos en riesgo»: Distribución por nivel (anillo 9) + Mayor riesgo (barras) + «Ver tabla completa · 9 alumnos en riesgo» — 1984×1032 · 116 KB · 2x — contexto del tramo «a tiempo»

## Reportes 3A (/reportes)

- assets/reportes-faltas-por-alumno-limite.png — «Faltas por alumno»: Mauricio González 29.8 % · Héctor Mendoza 19.2 % · Miguel Díaz 19.2 % · Luis Aguilar 17 % · Iván Cruz 14.9 % · Paola Hernández 14.9 % · Daniela Rodríguez 12.8 % · Carmen Jiménez 10.6 %, línea discontinua y chip «Límite 20 %» (en el video 19.1 %, no 19.2 %) — 1094×536 · 48 KB · 2x — la fila de Iván 14.9 % frente al límite (barra por alumno)
- assets/reportes-anillo-estados-81.png — AnilloEstados «81 % Asistencia»: Presentes 330 72 % · Retardos 31 7 % · Ausencias 83 18 % · Justificadas 4 1 % · Pendientes 8 2 % — 692×672 · 44 KB · 2x — resumen acumulado del grupo
- assets/reportes-indicadores-grupo.png — «Sesiones cerradas 19/47 · Asistencia promedio 80.58 % · Alumnos en el límite 2 · Sin derecho a examen 1» — 1984×266 · 40 KB · 2x — cifras del reporte
- assets/reportes-exportar-csv.png — Botones secundarios «Exportar CSV» e «Imprimir / PDF» — 502×82 · 8 KB · 2x — detalle de exportación (opcional)
- assets/reportes-impacto-95-min.png — «Impacto en tiempo de clase 95 min · Unas 1.6 h recuperadas. Estimación, no una medición.» — 1984×200 · 24 KB · 2x — la única cifra de ahorro que calcula la app (siempre como estimación)

## Alumno (E260001, en el límite: maquetación para reconstruir a Iván con sus cifras)

- assets/alumno-medidor-asistencia.png — MedidorLiquido ámbar «80.9 % · Tu asistencia · 9 faltas equivalentes de 47 sesiones» con marca «Mínimo 80 %» — 840×354 · 24 KB · 2x — receta del medidor del alumno
- assets/alumno-barra-faltas-limite.png — Barra de faltas «19.15 % de faltas · límite 20 % · En el límite» — 896×66 · 8 KB · 2x — barra que se llena hasta el límite (Iván: 14.9 %)
- assets/alumno-aviso-en-el-limite.png — Aviso ámbar «Estás en el límite: una falta más y pierdes el derecho a examen.» — 896×142 · 12 KB · 2x — formato del aviso (Iván: «Te quedan 2 faltas antes del límite.»)

## Acceso

- assets/login-panel-producto.png — Panel crema del login con tarjeta flotante (lista de alumnos del 5C con chips) y titular serif «Pasa lista en segundos» + «La cámara reconoce a cada alumno y SUSAN registra la asistencia por ti.» — 1986×2080 · 104 KB · 2x — precedente nativo del objeto flotante con sombra sobre crema y de la serif de acceso

## Activos que ya viven en `assets/` (no pasan por stage-assets; referenciarlos con su ruta)

- `assets/avatars/avatar-16-po.svg` (Patricia Ortega), `assets/avatars/avatar-15-cr.svg` (Iván Cruz Rojas, por iniciales) y otros 22 avatares Lorelei CC0 (`manifest.json`); nunca rostros reales.
- `assets/icons/*.svg`: 73 iconos Lucide 1.50.0 verificados (lista en `frame.md` §7 y `assets/icons/manifest.json`).
- `assets/brand/unach-escudo.png`, `assets/brand/fca-escudo.png`: solo dentro de la UI fiel (BrandMark), nunca en el cierre.
- `assets/fonts/` (Hanken Grotesk var, EB Garamond var 400–800, Geist Mono var; `README.md`), `assets/vendor/gsap.min.js` 3.14.2 local.
- `assets/sfx/CATALOG.json` + `derived/*.wav`: SFX por nombre de catálogo (SINTESIS 22).
