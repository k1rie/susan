import { describe, expect, it } from 'vitest';
import { construirCsvGrupo, construirCsvPeriodo, ENCABEZADO_GRUPO, escaparCelda, nombreArchivoCsv } from './reporteCsv.utils.js';

describe('escaparCelda', () => {
    it('valores vacíos y números', () => {
        expect(escaparCelda(null)).toBe('');
        expect(escaparCelda(undefined)).toBe('');
        expect(escaparCelda(6.25)).toBe('6.25');
        expect(escaparCelda(-3)).toBe('-3');
    });
    it('comas, comillas y saltos de línea', () => {
        expect(escaparCelda('Pérez, hijo')).toBe('"Pérez, hijo"');
        expect(escaparCelda('dijo "hola"')).toBe('"dijo ""hola"""');
        expect(escaparCelda('a\nb')).toBe('"a\nb"');
    });
    it('conserva acentos', () => {
        expect(escaparCelda('Ana María Ñandú')).toBe('Ana María Ñandú');
    });
    it('neutraliza fórmulas', () => {
        expect(escaparCelda('=SUMA(A1)')).toBe("'=SUMA(A1)");
        expect(escaparCelda('+1')).toBe("'+1");
        expect(escaparCelda('-1+2')).toBe("'-1+2");
        expect(escaparCelda('@cmd')).toBe("'@cmd");
        expect(escaparCelda('\t=x')).toBe("'\t=x");
        expect(escaparCelda('=1,2')).toBe('"\'=1,2"');
    });
});

const reporte = {
    generado_en: '2026-10-14T10:00:00-06:00',
    grupo: { periodo: '2026-2', clave_grupo: '3A', materia_clave: 'ADM301', materia_nombre: 'Contabilidad Financiera' },
    items: [
        { matricula: 'A1', apellido_paterno: 'Pérez, hijo', apellido_materno: null, nombres: 'Luis', sesiones_programadas: 48,
          presentes: 12, retardos: 5, ausencias: 9, justificadas: 3, pendientes: 1, faltas_equivalentes: 10,
          porcentaje_faltas: 20.8333, faltas_restantes_antes_limite: 0, derecho_examen: false },
    ],
};

describe('CSV de grupo', () => {
    it('BOM, encabezado de 17 columnas y CRLF final', () => {
        const csv = construirCsvGrupo(reporte);
        expect(csv.charCodeAt(0)).toBe(0xfeff);
        expect(ENCABEZADO_GRUPO).toHaveLength(17);
        const lineas = csv.slice(1).split('\r\n');
        expect(lineas[0]).toBe(ENCABEZADO_GRUPO.join(','));
        expect(lineas[1]).toBe('2026-2,3A,Contabilidad Financiera,A1,"Pérez, hijo",,Luis,48,12,5,9,3,1,10,20.83,0,No');
        expect(lineas[2]).toBe('');
    });
});

describe('CSV de periodo y nombre', () => {
    it('una fila por grupo', () => {
        const csv = construirCsvPeriodo({ periodo: '2026-2', items: [{ clave_grupo: '3A', materia_nombre: 'X', docente_nombre: 'Doc', inscritos: 30,
            sesiones_programadas: 48, sesiones_cerradas: 10, asistencia_promedio: 91.5, alumnos_en_limite: 1, alumnos_sin_derecho: 0 }] });
        expect(csv.split('\r\n')[1]).toBe('2026-2,3A,X,Doc,30,48,10,91.5,1,0');
    });
    it('nombre de archivo saneado y con fecha de generado_en', () => {
        expect(nombreArchivoCsv(reporte, 'grupo')).toBe('asistencia_2026-2_adm301-3a_20261014.csv');
        expect(nombreArchivoCsv({ periodo: '2026-2', generado_en: '2026-10-14T10:00:00Z' }, 'periodo')).toBe('asistencia_2026-2_periodo_20261014.csv');
    });
});
