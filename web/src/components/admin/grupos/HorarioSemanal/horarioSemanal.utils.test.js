import { describe, expect, it } from 'vitest';
import {
    avisoHorasMateria,
    bloquesPorDia,
    etiquetaDias,
    finAlCambiarInicio,
    firmaFranjas,
    franjasDesdeApi,
    franjasHaciaApi,
    franjaVacia,
    horasPorSemana,
    MAX_BLOQUES,
    resumenFranja,
    sumarMinutos,
    totalMinutos,
    validarFranjas,
} from './horarioSemanal.utils.js';

const franja = (dias, ini, fin, clave) => franjaVacia({ dias, hora_inicio: ini, hora_fin: fin, ...(clave ? { clave } : {}) });

describe('franjas <-> bloques de la API', () => {
    const bloques = [
        { dia_semana: 3, hora_inicio: '07:00:00', hora_fin: '08:00:00' },
        { dia_semana: 1, hora_inicio: '07:00:00', hora_fin: '08:00:00' },
        { dia_semana: 2, hora_inicio: '10:00:00', hora_fin: '12:00:00' },
        { dia_semana: 5, hora_inicio: '07:00:00', hora_fin: '08:00:00' },
    ];

    it('agrupa por hora: los días con el mismo horario son una sola franja, ordenadas por su primer día', () => {
        const franjas = franjasDesdeApi(bloques);
        expect(franjas.map((f) => [f.dias, f.hora_inicio, f.hora_fin])).toEqual([
            [['1', '3', '5'], '07:00', '08:00'],
            [['2'], '10:00', '12:00'],
        ]);
    });

    it('expande cada franja en un bloque por día, ordenados, en el formato de siempre del payload', () => {
        expect(franjasHaciaApi(franjasDesdeApi(bloques))).toEqual([
            { dia_semana: 1, hora_inicio: '07:00', hora_fin: '08:00' },
            { dia_semana: 2, hora_inicio: '10:00', hora_fin: '12:00' },
            { dia_semana: 3, hora_inicio: '07:00', hora_fin: '08:00' },
            { dia_semana: 5, hora_inicio: '07:00', hora_fin: '08:00' },
        ]);
    });

    it('la firma no cambia con el orden ni con las claves internas', () => {
        const a = [franja(['1', '3'], '07:00', '08:00'), franja(['2'], '09:00', '10:00')];
        const b = [franja(['2'], '09:00', '10:00'), franja(['3', '1'], '07:00', '08:00')];
        expect(firmaFranjas(a)).toBe(firmaFranjas(b));
        expect(firmaFranjas(a)).not.toBe(firmaFranjas([franja(['1'], '07:00', '08:00')]));
    });
});

describe('horas', () => {
    it('suma minutos acotando al día', () => {
        expect(sumarMinutos('07:00', 60)).toBe('08:00');
        expect(sumarMinutos('23:30', 120)).toBe('23:59');
        expect(sumarMinutos('', 60)).toBe('');
    });

    it('la hora de fin sigue a la de inicio: conserva la duración y por omisión suma una hora', () => {
        expect(finAlCambiarInicio({ inicioAntes: '', finAntes: '', inicioNuevo: '07:00' })).toBe('08:00');
        expect(finAlCambiarInicio({ inicioAntes: '07:00', finAntes: '09:00', inicioNuevo: '10:00' })).toBe('12:00');
        // Una fin inválida (anterior al inicio) se rehace con una hora.
        expect(finAlCambiarInicio({ inicioAntes: '09:00', finAntes: '08:00', inicioNuevo: '10:00' })).toBe('11:00');
        // Si el inicio nuevo aún no es una hora válida no se toca la fin.
        expect(finAlCambiarInicio({ inicioAntes: '07:00', finAntes: '08:00', inicioNuevo: '' })).toBe('08:00');
    });

    it('total por semana = duración por día x días, y se escribe en horas y minutos', () => {
        const franjas = [franja(['1', '3', '5'], '07:00', '08:00'), franja(['2'], '10:00', '11:30')];
        expect(totalMinutos(franjas)).toBe(270);
        expect(horasPorSemana(franjas)).toBe('4 h 30 min');
        expect(horasPorSemana([])).toBe('0 min');
    });

    it('compara con las horas de la materia sin bloquear', () => {
        expect(avisoHorasMateria(240, 4)).toEqual({ tono: 'ok', texto: 'Coincide con las 4 h por semana de la materia.' });
        expect(avisoHorasMateria(180, 4)).toEqual({ tono: 'info', texto: 'La materia declara 4 h por semana; este horario suma 3 h.' });
        expect(avisoHorasMateria(180, undefined)).toBeNull();
        expect(avisoHorasMateria(0, 4)).toBeNull();
    });
});

describe('etiquetas', () => {
    it('resume los días', () => {
        expect(etiquetaDias(['1', '2', '3', '4', '5'])).toBe('Lun a Vie');
        expect(etiquetaDias(['1', '3', '5'])).toBe('Lun, Mié y Vie');
        expect(etiquetaDias(['2', '4'])).toBe('Mar y Jue');
        expect(etiquetaDias(['1', '2'])).toBe('Lun y Mar');
        expect(etiquetaDias(['4'])).toBe('Jueves');
        expect(etiquetaDias([])).toBe('Sin días');
    });
    it('resume una franja', () => {
        expect(resumenFranja(franja(['1', '3', '5'], '07:00', '08:00'))).toBe('Lun, Mié y Vie · 07:00–08:00');
    });
    it('arma la vista semanal con las clases de cada día, ordenadas', () => {
        const porDia = bloquesPorDia([franja(['1', '3'], '09:00', '10:00'), franja(['1'], '07:00', '08:00'), franja(['2'], '', '')]);
        expect(porDia['1'].map((b) => b.inicio)).toEqual(['07:00', '09:00']);
        expect(porDia['2']).toEqual([]);
        expect(porDia['3']).toHaveLength(1);
    });
});

describe('validarFranjas', () => {
    it('sin franjas: error, salvo en el alta, donde el horario es opcional', () => {
        expect(validarFranjas([]).valido).toBe(false);
        expect(validarFranjas([], { vacioValido: true }).valido).toBe(true);
    });

    it('lo que solo falta llenar es «pendiente»; el orden de las horas es un error inmediato', () => {
        const nueva = franja([], '', '', 'a');
        const v = validarFranjas([nueva]);
        expect(v.valido).toBe(false);
        expect(v.porFranja.a.pendientes.sort()).toEqual(['dias', 'fin', 'inicio']);
        const invertida = validarFranjas([franja(['1'], '09:00', '08:00', 'b')]);
        expect(invertida.porFranja.b.fin).toMatch(/posterior a la de inicio/);
        expect(invertida.porFranja.b.pendientes).toEqual([]);
    });

    it('detecta el traslape el mismo día y nombra el día; contiguas y otros días no chocan', () => {
        const solapadas = validarFranjas([franja(['1', '3'], '07:00', '08:00', 'a'), franja(['3'], '07:30', '09:00', 'b')]);
        expect(solapadas.valido).toBe(false);
        expect(solapadas.porFranja.b.solape).toBe('Se traslapa el miércoles con otra franja (07:00–08:00).');
        expect(validarFranjas([franja(['1'], '07:00', '08:00'), franja(['1'], '08:00', '09:00'), franja(['2'], '07:00', '08:00')]).valido).toBe(true);
    });

    it('respeta el tope de bloques del servidor', () => {
        const muchas = Array.from({ length: 8 }, (_, i) => franja(['1', '2', '3', '4', '5', '6'], `${String(7 + i).padStart(2, '0')}:00`, `${String(8 + i).padStart(2, '0')}:00`));
        const v = validarFranjas(muchas);
        expect(v.general.join(' ')).toContain(`máximo ${MAX_BLOQUES} bloques`);
    });
});
