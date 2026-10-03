// CSV del reporte (docs/api/reportes-analitica.md 2.1.1): UTF-8 con BOM, separador coma, fin de línea CRLF.
// Se arma en el navegador con los datos ya cargados (autorizados por la base).

const BOM = '﻿';
const EOL = '\r\n';

export const ENCABEZADO_GRUPO = [
    'Periodo', 'Grupo', 'Materia', 'Matrícula', 'Apellido paterno', 'Apellido materno', 'Nombres',
    'Sesiones programadas', 'Presentes', 'Retardos', 'Ausencias', 'Justificadas', 'Pendientes',
    'Faltas equivalentes', 'Porcentaje de faltas', 'Faltas restantes', 'Derecho a examen',
];

export const ENCABEZADO_PERIODO = [
    'Periodo', 'Grupo', 'Materia', 'Docente', 'Inscritos', 'Sesiones programadas', 'Sesiones cerradas',
    'Asistencia promedio', 'Alumnos en el límite', 'Alumnos sin derecho',
];

/**
 * Convierte un valor en celda CSV. Texto que empieza con = + - @ tab o CR se prefija con ' (anti inyección de
 * fórmulas); los números y booleanos no se prefijan. Se entrecomilla si hay coma, comillas, CR o LF.
 */
export function escaparCelda(valor) {
    if (valor === null || valor === undefined) return '';
    let texto;
    if (typeof valor === 'number') texto = Number.isFinite(valor) ? String(valor) : '';
    else if (typeof valor === 'boolean') texto = valor ? 'Sí' : 'No';
    else {
        texto = String(valor);
        if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;
    }
    if (/[",\r\n]/.test(texto)) return `"${texto.replace(/"/g, '""')}"`;
    return texto;
}

const linea = (celdas) => celdas.map(escaparCelda).join(',') + EOL;

const dosDecimales = (n) => (n === null || n === undefined || Number.isNaN(Number(n)) ? null : Number(Number(n).toFixed(2)));

/** CSV de un grupo: una fila por alumno (17 columnas). `reporte` = respuesta de api_reporte_grupo. */
export function construirCsvGrupo(reporte) {
    const g = reporte?.grupo || {};
    let salida = BOM + linea(ENCABEZADO_GRUPO);
    for (const a of reporte?.items || []) {
        salida += linea([
            g.periodo, g.clave_grupo, g.materia_nombre, a.matricula, a.apellido_paterno, a.apellido_materno, a.nombres,
            a.sesiones_programadas, a.presentes, a.retardos, a.ausencias, a.justificadas, a.pendientes,
            a.faltas_equivalentes, dosDecimales(a.porcentaje_faltas), a.faltas_restantes_antes_limite,
            a.derecho_examen === null || a.derecho_examen === undefined ? null : a.derecho_examen ? 'Sí' : 'No',
        ]);
    }
    return salida;
}

/** CSV del periodo: una fila por grupo (10 columnas). `reporte` = respuesta de api_reporte_periodo. */
export function construirCsvPeriodo(reporte) {
    let salida = BOM + linea(ENCABEZADO_PERIODO);
    for (const f of reporte?.items || []) {
        salida += linea([
            f.periodo || reporte?.periodo, f.clave_grupo, f.materia_nombre, f.docente_nombre, f.inscritos,
            f.sesiones_programadas, f.sesiones_cerradas, dosDecimales(f.asistencia_promedio),
            f.alumnos_en_limite, f.alumnos_sin_derecho,
        ]);
    }
    return salida;
}

const limpio = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'x';

/** asistencia_<periodo>_<materia>-<grupo>_<AAAAMMDD>.csv; la fecha sale de generado_en, no del reloj. */
export function nombreArchivoCsv(reporte, tipo = 'grupo') {
    const fecha = String(reporte?.generado_en || '').slice(0, 10).replace(/-/g, '');
    const sufijo = /^\d{8}$/.test(fecha) ? fecha : 'sin-fecha';
    if (tipo === 'periodo') return `asistencia_${limpio(reporte?.periodo)}_periodo_${sufijo}.csv`;
    const g = reporte?.grupo || {};
    return `asistencia_${limpio(g.periodo)}_${limpio(g.materia_clave)}-${limpio(g.clave_grupo)}_${sufijo}.csv`;
}

/** Descarga en el navegador (Blob + enlace temporal). */
export function descargarCsv(texto, nombre) {
    const blob = new Blob([texto], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}
