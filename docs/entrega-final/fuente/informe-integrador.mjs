// Informe en Word del Proyecto Integrador: el contenido de la presentacion final en formato de informe,
// con las conclusiones individuales de cada integrante. Figuras recortadas de la presentacion (integrador-fig/).
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
const {
    Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, ShadingType, AlignmentType,
    HeadingLevel, Footer, Header, PageNumber, BorderStyle, LevelFormat, VerticalAlign, TableLayoutType,
} = require('docx');

const DIR = path.dirname(new URL(import.meta.url).pathname);
const FIG = path.join(DIR, 'integrador-fig');
const OUT = process.argv[2];
const NAVY = '001F5F'; const GRAY = '6B7280'; const LINE = 'C9D2E3'; const TINT = 'F2F5FA'; const CREMA = 'F5EFE4';
const FONT = 'Arial';

// ---------- helpers ----------
const run = (r) => (typeof r === 'string' ? new TextRun(r) : r);
const p = (runs, o = {}) => new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 160, line: 312 }, ...o,
    children: (Array.isArray(runs) ? runs : [runs]).map(run) });
const b = (t) => new TextRun({ text: t, bold: true });
const i = (t) => new TextRun({ text: t, italics: true });
const h1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun(t)],
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: NAVY, space: 4 } } });
const h2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] });
const bullet = (runs) => new Paragraph({ numbering: { reference: 'vinetas', level: 0 }, alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 100, line: 300 }, children: (Array.isArray(runs) ? runs : [runs]).map(run) });

// Rotulo APA 7: numero en negritas y titulo en cursiva arriba; nota debajo.
const rotulo = (tipo, n, titulo) => [
    new Paragraph({ keepNext: true, spacing: { before: 200, after: 0 }, children: [b(`${tipo} ${n}.`)] }),
    new Paragraph({ keepNext: true, spacing: { after: 100 }, children: [i(titulo)] }),
];
const nota = (t) => new Paragraph({ spacing: { before: 60, after: 240 }, children: [i('Nota. '), new TextRun({ text: t, size: 19 })] });

async function imagen(file, wIn, alt) {
    const buf = fs.readFileSync(path.join(FIG, file));
    const m = await sharp(buf).metadata();
    const w = wIn * 96; const h = w * (m.height / m.width);
    return new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { after: 60 },
        children: [new ImageRun({ type: 'png', data: buf, transformation: { width: w, height: h }, altText: { title: alt, description: alt, name: alt } })] });
}

const BORDE = { style: BorderStyle.SINGLE, size: 4, color: LINE };
const BORDES = { top: BORDE, bottom: BORDE, left: BORDE, right: BORDE };
const SIN = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
function tabla(cols, filas, anchos, o = {}) {
    const total = anchos.reduce((a, c) => a + c, 0);
    const celda = (t, w, head, j, extra = {}) => new TableCell({
        width: { size: w, type: WidthType.DXA }, borders: BORDES, verticalAlign: VerticalAlign.CENTER,
        margins: { top: 70, bottom: 70, left: 110, right: 110 },
        shading: head ? { type: ShadingType.CLEAR, color: 'auto', fill: NAVY } : (extra.fill ? { type: ShadingType.CLEAR, color: 'auto', fill: extra.fill } : undefined),
        children: [new Paragraph({ alignment: (o.alinear?.[j] ?? AlignmentType.LEFT),
            children: [new TextRun({ text: String(t), bold: head || extra.bold, color: head ? 'FFFFFF' : '1A1A1A', size: o.size ?? 19 })] })],
    });
    return new Table({
        width: { size: total, type: WidthType.DXA }, columnWidths: anchos, layout: TableLayoutType.FIXED, alignment: AlignmentType.CENTER,
        rows: [
            new TableRow({ tableHeader: true, children: cols.map((c, j) => celda(c, anchos[j], true, j)) }),
            ...filas.map((f, r) => new TableRow({ cantSplit: true, children: f.map((c, j) => celda(c, anchos[j], false, j, (o.fila?.(r) ?? {}))) })),
        ],
    });
}
// Recuadro de una celda (objetivo general, costo total, slogan): fondo tenue y filete azul a la izquierda.
const recuadro = (parrafos, fill = TINT) => new Table({
    width: { size: 9360, type: WidthType.DXA }, columnWidths: [9360], layout: TableLayoutType.FIXED,
    rows: [new TableRow({ children: [new TableCell({
        width: { size: 9360, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, color: 'auto', fill },
        borders: { top: SIN, bottom: SIN, right: SIN, left: { style: BorderStyle.SINGLE, size: 24, color: NAVY } },
        margins: { top: 160, bottom: 160, left: 240, right: 240 }, children: parrafos,
    })] })],
});
const espacio = () => new Paragraph({ spacing: { after: 120 }, children: [] });
const codigo = (lineas) => new Table({
    width: { size: 9360, type: WidthType.DXA }, columnWidths: [9360], layout: TableLayoutType.FIXED,
    rows: [new TableRow({ cantSplit: true, children: [new TableCell({
        width: { size: 9360, type: WidthType.DXA }, borders: BORDES, shading: { type: ShadingType.CLEAR, color: 'auto', fill: '14213D' },
        margins: { top: 140, bottom: 140, left: 180, right: 180 },
        children: lineas.split('\n').map((l) => new Paragraph({ spacing: { after: 0, line: 250 },
            children: [new TextRun({ text: l.length ? l : ' ', font: 'Courier New', size: 15, color: 'E5E9F2' })] })),
    })] })],
});

// ---------- portada ----------
const portadaBuf = fs.readFileSync(path.join(FIG, 'portada.png'));
const portada = [new Paragraph({ spacing: { before: 0, after: 0, line: 240 }, alignment: AlignmentType.CENTER, children: [new ImageRun({
    type: 'png', data: portadaBuf, transformation: { width: 806, height: 1043 },
    altText: { title: 'Portada', description: 'Portada institucional UNACH del informe del Proyecto Integrador SUSAN con los datos de identificación y matrículas', name: 'portada' } })] })];

// ---------- conclusiones individuales (las mismas de la presentacion) ----------
const CONC = [
    ['Casanova Pérez Gabriela', 'Desarrolladora',
        'Antes de este proyecto veía los métodos numéricos como una materia de fórmulas para el examen. Al trabajar en SUSAN me di cuenta de que sirven para algo muy concreto: con las faltas de cada semana podemos ver hacia dónde va un grupo y avisar a tiempo, antes de que un compañero pierda el derecho a examen. Me gustó mucho que lo que aprendimos en clase terminara en una herramienta que de verdad le ahorraría tiempo a un maestro.'],
    ['Escobar Domínguez Josué Gabriel', 'Product Owner',
        'Mi papel fue cuidar que el sistema respondiera a lo que de verdad necesita un docente. Al principio solo pensamos en pasar lista más rápido, pero los métodos numéricos nos permitieron ir más allá: convertir una lista de faltas en una señal clara de qué alumnos necesitan atención. Aprendí que un buen software no es solo el que funciona, sino el que ayuda a tomar mejores decisiones, y que las matemáticas son las que le dan ese valor.'],
    ['Gómez Delgado Ades Yasir', 'Desarrollador',
        'Este proyecto fue la primera vez que vi los métodos numéricos funcionando dentro de una aplicación de verdad. Programar los cálculos me obligó a entenderlos bien, porque un error pequeño cambiaba todo el resultado. También aprendí a revisar que los números tengan sentido antes de confiar en ellos. Me quedo con la idea de que la ciencia y la ingeniería avanzan gracias a que podemos poner las matemáticas a trabajar en una computadora.'],
    ['González Guerrero Diego Enrique', 'Scrum Master',
        'Como Scrum Master me tocó ver el proyecto completo y entender cómo encajaba cada parte. Lo que más me quedó es que los métodos numéricos no se quedan en el pizarrón: cuando los programas, tienes que pensar qué pasa si faltan datos o si un resultado sale raro. Ver que la computadora podía decirnos en qué semana un grupo llegaría al límite de faltas me hizo entender por qué la ingeniería depende tanto de estas herramientas.'],
    ['Peña Morales José Manuel', 'Desarrollador',
        'Lo que más me sorprendió fue darme cuenta de que los datos reales casi nunca vienen perfectos. Hay semanas sin clase, días con muchas faltas y otros sin ninguna, y aun así queríamos sacar algo útil. Ahí entendí para qué sirve lo que vimos en el semestre: rellenar huecos, suavizar los cambios bruscos y encontrar la tendencia. Trabajar con un problema de nuestra propia escuela hizo que todo tuviera mucho más sentido.'],
    ['Pérez Hernández Alan Eduardo', 'Desarrollador',
        'Este proyecto me ayudó a ver que los métodos numéricos sirven para anticiparse a los problemas, no solo para resolver ejercicios. Con unas cuantas semanas de asistencia el sistema puede estimar cómo va a cerrar el semestre y avisarle al maestro con tiempo. También me llevo lo aprendido al trabajar en equipo: repartir tareas, apoyarnos y entregar algo que funciona. Creo que es una experiencia que nos va a servir mucho en lo profesional.'],
];

const CODIGO = `CREATE FUNCTION svc_registrar_detecciones(p_id_captura bigint, p_detecciones jsonb)
RETURNS jsonb AS $$
BEGIN
  v_umbral := param_num('umbral_similitud');           -- 0.850
  v_min    := param_num('min_detecciones_validas');    -- 3
  FOR d IN SELECT x FROM jsonb_array_elements(p_detecciones) AS t(x) LOOP
    SELECT * INTO v_pl FROM plantilla_facial WHERE faiss_id = (d->>'faiss_id')::bigint;
    v_valida := round((d->>'score')::numeric, 3) >= v_umbral AND v_pl.activa   -- RN-04
      AND inscrito(v_pl.id_alumno, s.id_grupo)
      AND consentimiento_vigente(v_pl.id_consent);
    INSERT INTO deteccion (id_captura, id_plantilla, score_similitud, es_valida)
    VALUES (p_id_captura, v_pl.id_plantilla, d->>'score', v_valida);
  END LOOP;
  FOREACH v_alumno IN ARRAY v_alumnos LOOP             -- alumnos con lectura válida
    v_n := lecturas_validas(s.id_sesion, v_alumno);    -- capturas distintas (RN-05)
    INSERT INTO asistencia (id_sesion, id_alumno, estado, conteo_detecciones)
    VALUES (s.id_sesion, v_alumno, 'pendiente', v_n)   -- registro único (RN-02)
    ON CONFLICT (id_sesion, id_alumno) DO UPDATE SET conteo_detecciones = v_n;
    IF v_n >= v_min THEN                               -- presente < 10 min, retardo <= 20 (RN-03)
      UPDATE asistencia
         SET estado = estado_por_minuto(10, 20, minuto_primera_lectura)
       WHERE id_sesion = s.id_sesion AND id_alumno = v_alumno AND estado = 'pendiente';
    END IF;
  END LOOP;
END $$;`;

async function build() {
    const c = [];
    const add = (...xs) => c.push(...xs.flat());

    // Indice breve de los temas
    add(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Contenido')],
        border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: NAVY, space: 4 } } }));
    ['1. Introducción', '2. Planteamiento del problema', '3. Objetivos', '4. Descripción del producto', '5. Modelos matemáticos',
        '6. Metodología de desarrollo', '7. Interfaz del software', '8. Codificación', '9. Resultados', '10. Costo total',
        '11. Conclusiones', '12. Referencias'].forEach((t) => add(new Paragraph({ spacing: { after: 100 }, indent: { left: 360 }, children: [new TextRun(t)] })));

    // 1. Introduccion
    add(h1('1. Introducción'),
        p([b('SUSAN'), ' (Sistema Universitario de Seguimiento y Análisis de Asistencia) aborda la transición de un control de asistencia tradicional hacia un modelo estructurado y basado en datos: el pase de lista verbal se sustituye por un registro automático durante la clase, y el docente solo interviene en los casos dudosos. El principio de diseño es que ', b('la asistencia no se decide con una foto, sino con muchas lecturas del mismo rostro.')]),
        p('En este informe se presentan el problema que motivó el proyecto, sus objetivos, la descripción del producto, los modelos matemáticos y métodos numéricos aplicados, la metodología de desarrollo, la interfaz, un extracto de la codificación, los resultados obtenidos, el costo total y las conclusiones del equipo.'),
        rotulo('Figura', 1, 'Procedimiento de reconocimiento y consolidación de la asistencia en cinco pasos.'),
        await imagen('fig1-flujo.png', 6.5, 'Diagrama de cinco pasos: muestreo, vectorización, búsqueda FAISS, consolidación y registro'),
        nota('El vector de consulta no se guarda en la base relacional (RNF-03). Elaboración propia.'));

    // 2. Problema
    add(h1('2. Planteamiento del problema'),
        p('En la Escuela de Tecnologías Digitales Aplicadas, Campus I, la asistencia se registra con pase de lista tradicional: el docente nombra a cada alumno y anota el resultado en una lista impresa o en una hoja de Excel propia. Cada docente guarda su archivo por separado, lo que dispersa la información, y al cierre del periodo el conteo se recaptura a mano. Además, consume tiempo de clase:'),
        recuadro([new Paragraph({ alignment: AlignmentType.CENTER, children: [b('5 min por sesión × 3 sesiones por semana × 16 semanas = 240 min = 4 h de clase por grupo al semestre.')] })]),
        espacio(),
        bullet([b('Registro poco confiable. '), 'Depende de que el alumno responda: se presta a suplantación y a errores de captura.']),
        bullet([b('Sin historial consultable. '), 'El alumno no sabe cuántas faltas acumula hasta que es tarde.']),
        bullet([b('Archivos dispersos. '), 'Listas en papel y hojas de Excel sueltas, sin formato común, impiden hacer reportes por materia, grupo o periodo y detectar patrones de ausentismo a tiempo.']),
        nota('Un docente con cinco grupos destina unas 20 h por semestre solo a nombrar alumnos (estimación, no dato institucional).'));

    // 3. Objetivos
    add(h1('3. Objetivos'), h2('3.1 Objetivo general'),
        recuadro([p('Diseñar e implementar un sistema centralizado de registro digital de asistencia académica y análisis mediante métodos numéricos, con el fin de reducir los tiempos operativos de pase de lista en el aula y generar historiales consolidados que permitan identificar patrones de ausentismo para orientar la intervención docente oportuna.', { spacing: { after: 0, line: 312 } })]),
        espacio(),
        tabla(['Qué', 'Cómo', 'Para qué'], [[
            'Registro digital centralizado con reconocimiento facial.',
            'Historiales consolidados analizados con métodos numéricos.',
            'Apoyar al docente, sin automatizar decisiones institucionales.']], [3120, 3120, 3120]),
        nota('La estructura Qué / Cómo / Para qué sigue la metodología Scrum, que redacta el valor del producto como en las historias de usuario («Como… quiero… para…»).'),
        h2('3.2 Objetivos específicos'),
        p([b('OE-1. '), 'Automatizar el registro de asistencia con cámaras del aula, vectores faciales de 512 dimensiones e índice FAISS, atribuyendo una lectura solo si su score es mayor o igual a 0.850 y confirmando con tres lecturas.']),
        p([b('OE-2. '), 'Implementar en PostgreSQL el modelo relacional en tercera forma normal de 19 tablas, con las reglas de negocio en funciones RPC, seguridad por filas y bitácora de auditoría.']),
        p([b('OE-3. '), 'Aplicar regresión, interpolación, búsqueda de raíces y control estadístico al historial para proyectar el ausentismo y estimar la semana en que se cruza el límite de 20 %.']),
        p([b('OE-4. '), 'Construir una interfaz web responsiva por rol (docente, alumno, administración y técnico), usable desde 360 px, que resguarde el dato biométrico.']));

    // 4. Producto
    add(h1('4. Descripción del producto'), h2('4.1 Nombre y descripción'),
        new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: 'SUSAN', bold: true, size: 56, color: NAVY })] }),
        new Paragraph({ spacing: { after: 160 }, children: [b('Sistema Universitario de Seguimiento y Análisis de Asistencia')] }),
        p(['Sistema web centralizado que registra la asistencia durante la ventana de tolerancia con reconocimiento facial y analiza los historiales con métodos numéricos. Facilita un seguimiento académico oportuno que apoya la labor docente ', b('sin automatizar las decisiones institucionales.')]),
        rotulo('Tabla', 1, 'Módulos principales de SUSAN.'),
        tabla(['Módulo', 'Función'], [
            ['Pasar lista', 'Sesión en vivo con cámara del aula'],
            ['Revisión', 'Casos dudosos y justificantes'],
            ['Reportes', 'Por alumno, grupo y periodo'],
            ['Analítica', 'Tendencia, proyección y riesgo'],
            ['Alumno', 'Faltas acumuladas y justificantes'],
            ['Administración', 'Catálogo, cámaras e índice facial']], [3000, 6360]),
        espacio(),
        h2('4.2 Logotipo'),
        p(['Aunque SUSAN es un proyecto universitario, tiene una ', b('identidad visual propia'), ', independiente del escudo oficial de la universidad: un rostro en malla poligonal dentro de un marco de detección, rodeado de gráficas, que une el reconocimiento facial con el análisis de la asistencia.']),
        rotulo('Figura', 2, 'Logotipo de SUSAN.'),
        await imagen('fig2-logo.png', 2.6, 'Logotipo de SUSAN: rostro en malla poligonal azul dentro de un marco de detección con la palabra SUSAN'),
        nota('Paleta en azules del logotipo; la palabra «SUSAN» en mayúsculas sin remates. Elaboración propia.'),
        h2('4.3 Slogan'),
        recuadro([
            new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: 'SLOGAN', bold: true, size: 18, color: NAVY })] }),
            new Paragraph({ children: [new TextRun({ text: '“Pasa lista en segundos... y entiende la asistencia de los grupos.”', bold: true, italics: true, size: 28, color: NAVY })] })], CREMA));

    // 5. Modelos
    add(h1('5. Modelos matemáticos'), h2('5.1 Reconocimiento y decisión de asistencia'),
        rotulo('Tabla', 2, 'Modelos que convierten un rostro en un registro de asistencia.'),
        tabla(['Modelo', 'Expresión', 'Uso en SUSAN'], [
            ['Vector facial', 'q = f(rostro) ∈ ℝ⁵¹², ‖q‖ = 1', 'Red tipo ArcFace; solo vive en memoria'],
            ['Similitud coseno', 's = q·p / (‖q‖ ‖p‖) ≥ 0.850', 'Lectura válida solo sobre el umbral (RN-04)'],
            ['Consolidación', 'presente ⇔ lecturas válidas ≥ 3', '1 o 2 lecturas: pendiente de revisión (RN-05)'],
            ['Faltas equivalentes', 'F = A + ⌊R / 3⌋; sin derecho si 100·F > 20·N', 'Tres retardos = una falta; límite 20 % (RN-10, RN-11)']],
        [1900, 3900, 3560]),
        nota('p es la plantilla del alumno: centroide normalizado de sus fotos de registro. Estados: presente (≤ 10 min), retardo (≤ 20 min), pendiente (1 o 2 lecturas) y ausente (sin lecturas al cierre). Elaboración propia.'),
        h2('5.2 Métodos numéricos sobre el ausentismo'),
        rotulo('Tabla', 3, 'Métodos numéricos aplicados a la serie semanal de ausentismo.'),
        tabla(['Método', 'Para qué se usa'], [
            ['Mínimos cuadrados (Gauss y LU)', 'Tendencia; grado 1 o 2 elegido por validación cruzada'],
            ['Bisección y Newton-Raphson', 'Semana en que el acumulado cruza el límite de 20 %'],
            ['Spline cúbico natural', 'Rellenar semanas sin clase antes de suavizar'],
            ['Medias móviles SMA, EMA, WMA', 'Ver la tendencia sin el ruido semanal'],
            ['Diferencias finitas, Simpson, Romberg', 'Tasa de cambio y ausentismo acumulado como área'],
            ['CUSUM y carta EWMA', 'Detectar cambios de nivel en la serie'],
            ['Puntaje de riesgo 0–100', 'Siete factores por alumno: alto ≥ 60, medio ≥ 35']], [4000, 5360]),
        nota('Intervalo de proyección al 95 %: ŷ ± t·s·√(1 + φᵀ(XᵀX)⁻¹φ). Implementado en JavaScript, sin dependencias (Burden et al., 2017).'));

    // 6. Metodologia
    add(h1('6. Metodología de desarrollo'),
        p(['El proyecto se desarrolla con ', b('Scrum'), ', un marco ágil que entrega el producto en ', b('sprints'), ' cortos, cada uno con un incremento funcional que se revisa y mejora en el siguiente (Schwaber y Sutherland, 2020; Bahit, 2012).']),
        rotulo('Tabla', 4, 'Roles, artefactos y eventos de Scrum en el proyecto.'),
        tabla(['Elemento', 'Aplicación en SUSAN'], [
            ['Product Owner', 'Josué G. Escobar D.'],
            ['Scrum Master', 'Diego E. González G.'],
            ['Desarrolladores', 'Gabriela Casanova, Ades Y. Gómez, Alan E. Pérez y José M. Peña'],
            ['Product Backlog', '26 elementos (PB-01 a PB-26) de 27 historias de usuario'],
            ['Sprint Backlog e Incremento', 'Tareas por sprint; incremento probado al cierre de cada sprint'],
            ['Eventos', 'Sprint Planning, Daily Scrum, Sprint Review y Retrospectiva; avance visible en el Scrum Taskboard (Padlet)']],
        [3000, 6360], { fila: () => ({}) }),
        rotulo('Figura', 3, 'Sprints del proyecto (123 puntos de historia en total).'),
        await imagen('fig3-sprints.png', 6.5, 'Cuatro sprints: 22, 58, 35 y 8 puntos de historia, del 14 de octubre al 11 de noviembre'),
        nota('Sprint 1 (14–20 oct): base académica, cuentas y acceso. Sprint 2 (21–27 oct): captura, reconocimiento y pase manual. Sprint 3 (28 oct–3 nov): revisión, reportes y tendencia. Sprint 4 (4–11 nov): pruebas, correcciones y entrega.'));

    // 7. Interfaz
    add(h1('7. Interfaz del software'), h2('7.1 Panel del docente'),
        rotulo('Figura', 4, 'Panel del docente en escritorio y en teléfono.'),
        await imagen('fig4-panel.png', 6.3, 'Panel del docente en escritorio y en teléfono'),
        nota('Capturas del escenario de demostración con datos de prueba. Elaboración propia.'),
        bullet([b('Un clic'), ' para abrir la sesión y pasar lista.']),
        bullet([b('Cifras primero: '), 'registros por revisar y justificantes.']),
        bullet([b('Alertas'), ' de alumnos al límite o sin derecho a examen.']),
        bullet([b('Responsiva'), ' desde 360 px.']),
        h2('7.2 Pasar lista y revisión'),
        rotulo('Figura', 5, 'Sesión en vivo con cámara (izquierda) y revisión de un caso pendiente (derecha).'),
        await imagen('fig5-lista.png', 6.5, 'Pantallas de pasar lista con cámara y de revisión de casos pendientes'),
        nota('Capturas del escenario de demostración con cámara simulada. Elaboración propia.'),
        p([b('Pasar lista: '), 'conteo en vivo y registro manual. ', b('Revisión: '), 'el score de cada lectura sirve como evidencia y la decisión del docente queda en bitácora.']),
        h2('7.3 Analítica de ausentismo'),
        rotulo('Figura', 6, 'Pantalla de analítica de un grupo: cifras clave, avisos y gráficas.'),
        await imagen('fig6-analitica.png', 5.6, 'Pantalla de analítica de ausentismo de un grupo'),
        nota('Capturas del escenario de demostración con datos de prueba. Elaboración propia.'),
        bullet([b('Cifras clave: '), 'ausentismo actual, proyección al cierre, cruce del límite y alumnos en riesgo.']),
        bullet([b('Avisos por nivel'), ' (alta, media), siempre con texto además del color.']),
        bullet([b('Gráficas propias: '), 'observado, ajuste, proyección e intervalo de 95 % frente al límite de 20 %.']),
        bullet([b('Exportación'), ' del resumen a CSV.']));

    // 8. Codificacion
    add(h1('8. Codificación'), h2('8.1 Stack tecnológico'),
        rotulo('Tabla', 5, 'Stack tecnológico de SUSAN (arquitectura por capas).'),
        tabla(['Capa', 'Tecnología', 'Responsabilidad'], [
            ['Presentación', 'Next.js 16, React 19 y Tailwind 4', 'Pantallas por rol, responsivas'],
            ['Lógica de negocio', 'Funciones RPC en PL/pgSQL', 'Reglas RN-01 a RN-13'],
            ['Datos', 'PostgreSQL 16 (Supabase): RLS, Auth y Storage', '19 tablas en 3FN y bitácora'],
            ['Reconocimiento', 'Python 3.12, FastAPI, InsightFace y FAISS', 'Vectores de 512-d y búsqueda'],
            ['Análisis numérico', 'JavaScript sin dependencias', 'Tendencia, proyección y riesgo'],
            ['Pruebas', 'Vitest, pytest y pruebas SQL', 'Verificación de cada capa']], [2300, 4060, 3000]),
        nota('La interfaz nunca accede a la base directamente: usa envoltorios sobre las funciones RPC. Elaboración propia.'),
        h2('8.2 Registro y consolidación de la asistencia'),
        p('La siguiente función recibe los rostros detectados en una captura, valida cada lectura contra el umbral de similitud y consolida la asistencia del alumno cuando reúne el número mínimo de lecturas válidas en capturas distintas.'),
        rotulo('Figura', 7, 'Función que registra los rostros de una captura y consolida la asistencia (versión resumida de la migración 0135_svc_captura.sql).'),
        codigo(CODIGO),
        nota('Fragmento resumido; se omiten las declaraciones de variables y el manejo de errores. Elaboración propia.'));

    // 9. Resultados
    add(h1('9. Resultados'),
        tabla(['Casos de uso', 'Product Backlog', 'Sprints', 'Puntos de historia'],
            [['16 (UC-01 a UC-16)', '26 elementos', '4 completados', '123 entregados']], [2340, 2340, 2340, 2340],
            { alinear: [AlignmentType.CENTER, AlignmentType.CENTER, AlignmentType.CENTER, AlignmentType.CENTER], fila: () => ({ bold: true }) }),
        rotulo('Tabla', 6, 'Resultados de la simulación con un grupo de prueba de 24 alumnos.'),
        tabla(['Prueba', 'Resultado obtenido'], [
            ['Pase de lista', '24 alumnos registrados en 5 capturas: 16 presentes y 8 retardos, sin nombrar a nadie'],
            ['Umbral de similitud', 'Lectura con score 0.849 rechazada y con 0.850 aceptada, como define RN-04'],
            ['Revisión', 'Los casos con 1 o 2 lecturas válidas quedan pendientes y los resuelve el docente'],
            ['Pase manual', 'Sin cámara disponible, el docente registra la lista desde la misma pantalla'],
            ['Tendencia', 'Con 6 semanas de datos se estima la tendencia y los alumnos cercanos al 20 %']], [2600, 6760]),
        nota('Datos de prueba. Los valores 0.850, 3 lecturas, 15 s y 20 min son parámetros iniciales, no rendimiento validado en un salón real.'));

    // 10. Costo
    add(h1('10. Costo total'),
        recuadro([p([b('Costo total estimado: $3,450 MXN. '), 'El único hardware es una Raspberry Pi configurada como servidor local de datos.'], { spacing: { after: 0, line: 300 } })], CREMA),
        rotulo('Tabla', 7, 'Desglose del costo del proyecto.'),
        tabla(['Concepto', 'Detalle', 'Monto (MXN)'], [
            ['Desarrollo', 'Realizado por los seis alumnos del equipo', '$0'],
            ['Raspberry Pi 5 (8 GB)', 'Servidor local de datos', '$2,550'],
            ['Fuente oficial 27 W USB-C', 'Alimentación de la Raspberry Pi', '$350'],
            ['Tarjeta microSD 128 GB', 'Sistema operativo y datos', '$300'],
            ['Carcasa con ventilador', 'Protección y enfriamiento', '$250'],
            ['Software', 'Herramientas libres y plan gratuito de Supabase', '$0'],
            ['Total', '', '$3,450']], [3000, 4560, 1800],
        { alinear: [AlignmentType.LEFT, AlignmentType.LEFT, AlignmentType.RIGHT], fila: (r) => (r === 6 ? { bold: true, fill: 'DCE3EE' } : {}) }),
        nota('Precios aproximados de tiendas en línea en México, noviembre de 2026. La captura usa la cámara del dispositivo del docente.'));

    // 11. Conclusiones
    add(h1('11. Conclusiones'), h2('11.1 Conclusión general'),
        p('SUSAN demuestra que el registro de asistencia puede dejar de ser un trámite que consume tiempo de clase para convertirse en información útil. Al sustituir el pase de lista verbal, las listas impresas y las hojas de Excel dispersas por un sistema centralizado, el docente recupera minutos en cada sesión y solo interviene en los casos dudosos, mientras que cada registro queda respaldado por sus lecturas y por una bitácora que da trazabilidad a cualquier corrección.'),
        p('El beneficio no se limita al aula. Con un historial consolidado, el alumno conoce en todo momento sus faltas, y los métodos numéricos permiten anticipar qué estudiantes se acercan al límite del 20 % para orientar una intervención oportuna, sin automatizar las decisiones institucionales. Todo esto se logró con un costo mínimo, al apoyarse en software libre y en una Raspberry Pi como servidor local.'),
        p('Por último, trabajar con Scrum permitió al equipo organizar el proyecto en sprints, entregar incrementos verificables y aplicar en un caso real lo aprendido en bases de datos, ingeniería de software y métodos numéricos, dejando una base sólida para un piloto en un aula real.'),
        h2('11.2 Conclusiones individuales'),
        p('Cada integrante del equipo comparte, con sus propias palabras, lo que significó el proyecto y la importancia de los métodos numéricos aplicados a la ciencia y la ingeniería mediante el desarrollo de software.'));
    for (const [nm, rol, t] of CONC) {
        add(new Paragraph({ keepNext: true, spacing: { before: 200, after: 0 }, children: [new TextRun({ text: nm, bold: true, color: NAVY, size: 24 })] }),
            new Paragraph({ keepNext: true, spacing: { after: 80 }, children: [new TextRun({ text: rol, italics: true, color: GRAY, size: 20 })] }),
            p(t));
    }

    // 12. Referencias (APA 7, sangria francesa)
    const ref = (runs) => new Paragraph({ indent: { left: 720, hanging: 720 }, spacing: { after: 180, line: 300 }, children: runs.map(run) });
    add(h1('12. Referencias'),
        ref(['Bahit, E. (2012). ', i('Scrum y eXtreme Programming para programadores'), '. Safe Creative. https://dokumen.pub/scrum-extreme-programming-para-programadores.html']),
        ref(['Burden, R. L., Faires, J. D., y Burden, A. M. (2017). ', i('Análisis numérico'), ' (10.ª ed.). Cengage Learning.']),
        ref(['Deng, J., Guo, J., Xue, N., y Zafeiriou, S. (2019). ArcFace: Additive angular margin loss for deep face recognition. En ', i('2019 IEEE/CVF Conference on Computer Vision and Pattern Recognition (CVPR)'), ' (pp. 4685–4694). IEEE. https://doi.org/10.1109/CVPR.2019.00482']),
        ref(['Pressman, R. S. (2010). ', i('Ingeniería del software: Un enfoque práctico'), ' (7.ª ed.). McGraw-Hill.']),
        ref(['Schwaber, K., y Sutherland, J. (2020). ', i('La Guía Scrum: La guía definitiva de Scrum: Las reglas del juego'), '. https://scrumguides.org']),
        ref(['Sommerville, I. (2011). ', i('Ingeniería de software'), ' (9.ª ed.). Pearson Educación.']));

    const doc = new Document({
        creator: 'Equipo SUSAN', title: 'Informe del Proyecto Integrador: SUSAN', description: 'UNACH · Escuela de Tecnologías Digitales Aplicadas',
        styles: {
            default: { document: { run: { font: FONT, size: 22 } } },
            paragraphStyles: [
                { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
                    run: { font: FONT, size: 32, bold: true, color: NAVY }, paragraph: { spacing: { before: 0, after: 200 }, keepNext: true, outlineLevel: 0 } },
                { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
                    run: { font: FONT, size: 25, bold: true, color: NAVY }, paragraph: { spacing: { before: 280, after: 120 }, keepNext: true, outlineLevel: 1 } },
            ],
        },
        numbering: { config: [
            { reference: 'vinetas', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] },
        ] },
        sections: [
            { properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 60, bottom: 0, left: 60, right: 60, header: 0, footer: 0 } } }, children: portada },
            {
                properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1300, bottom: 1200, left: 1440, right: 1440 }, pageNumbers: { start: 2 } } },
                headers: { default: new Header({ children: [new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF', space: 4 } }, children: [
                    new TextRun({ text: 'BENEMÉRITA UNIVERSIDAD AUTÓNOMA DE CHIAPAS', bold: true, size: 17, color: NAVY }),
                    new TextRun({ text: '   ·   Escuela de Tecnologías Digitales Aplicadas, Campus I', size: 16, color: GRAY })] })] }) },
                footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [
                    new TextRun({ text: 'SUSAN · Informe del Proyecto Integrador   ', size: 16, color: GRAY }),
                    new TextRun({ children: ['Página ', PageNumber.CURRENT], size: 17, bold: true, color: '404040' })] })] }) },
                children: c,
            },
        ],
    });
    fs.writeFileSync(OUT, await Packer.toBuffer(doc));
    console.log('ok', OUT);
}
await build();
