import { describe, expect, it, vi } from 'vitest';
import { CAMPOS_POR_PASO, descripcionDeExito, pasoDeCampo, pasosDeExito, resumenAlta, validarAlta, VALORES_ALTA } from './nuevoAlumno.utils.js';

const completo = { ...VALORES_ALTA, matricula: 'e260099', apellido_paterno: ' Soto ', apellido_materno: '', nombres: 'Carla  María', correo_institucional: 'E260099@Dominio.MX' };

describe('alta de alumno: valores y campos por paso', () => {
    it('no pide estatus: el alumno nace activo', () => {
        expect(VALORES_ALTA).not.toHaveProperty('estatus');
        expect(VALORES_ALTA.crearCuenta).toBe(false);
    });

    it('cada campo pertenece a un paso y el desconocido cae en Identidad', () => {
        expect(pasoDeCampo('matricula')).toBe('identidad');
        expect(pasoDeCampo('correo_institucional')).toBe('contacto');
        expect(pasoDeCampo('otro')).toBe('identidad');
        expect(Object.values(CAMPOS_POR_PASO).flat()).toHaveLength(5);
    });
});

describe('validarAlta', () => {
    it('es la validación del alumno', () => {
        expect(validarAlta(completo)).toEqual({});
        expect(Object.keys(validarAlta(VALORES_ALTA))).toContain('matricula');
    });

    it('agrega «ya registrada» solo si la matrícula escrita es la que ya existe', () => {
        const existente = { id_alumno: 3, matricula: 'E260099' };
        expect(validarAlta(completo, existente).matricula).toMatch(/ya está registrada/);
        expect(validarAlta({ ...completo, matricula: 'E260100' }, existente).matricula).toBeUndefined();
        expect(validarAlta(completo, null).matricula).toBeUndefined();
    });
});

describe('resumenAlta', () => {
    it('muestra los datos normalizados, con «Editar» a su paso, y lo vacío queda como valor vacío', () => {
        const [identidad, contacto] = resumenAlta(completo);
        expect(identidad).toMatchObject({ titulo: 'Identidad', paso: 'identidad' });
        expect(identidad.filas).toEqual([
            { etiqueta: 'Matrícula', valor: 'E260099' },
            { etiqueta: 'Nombres', valor: 'Carla María' },
            { etiqueta: 'Apellido paterno', valor: 'Soto' },
            { etiqueta: 'Apellido materno', valor: '' },
        ]);
        expect(contacto).toMatchObject({ titulo: 'Contacto y acceso', paso: 'contacto' });
        expect(contacto.filas[0]).toEqual({ etiqueta: 'Correo institucional', valor: 'e260099@dominio.mx' });
        expect(contacto.filas[1].valor).toMatch(/Más tarde/);
        expect(resumenAlta({ ...completo, crearCuenta: true })[1].filas[1].valor).toMatch(/contraseña temporal/);
    });
});

describe('pasosDeExito', () => {
    const alumno = { id_alumno: 9, matricula: 'E260099', nombre_completo: 'Soto Carla' };

    it('ofrece consentimiento (recomendado), plantilla, grupo y cuenta, con enlaces reales a la ficha', () => {
        const pasos = pasosDeExito({ alumno, cuenta: null, errorCuenta: null, onCrearCuenta: vi.fn() });
        expect(pasos.map((p) => p.id)).toEqual(['consentimiento', 'plantilla', 'grupo', 'cuenta']);
        expect(pasos[0]).toMatchObject({ href: '/admin/alumnos/9#consentimiento', recommended: true });
        expect(pasos[1].href).toBe('/admin/alumnos/9#plantilla');
        expect(pasos[2].href).toBe('/admin/grupos');
        expect(pasos[3]).toMatchObject({ label: 'Crear su cuenta de acceso' });
        expect(typeof pasos[3].onClick).toBe('function');
    });

    it('con la cuenta creada el paso queda hecho y sin acción', () => {
        const pasos = pasosDeExito({ alumno, cuenta: { correo: 'e260099@dominio.mx' }, errorCuenta: null, onCrearCuenta: vi.fn() });
        expect(pasos[3]).toMatchObject({ done: true, label: 'Cuenta de acceso creada', description: 'e260099@dominio.mx' });
        expect(pasos[3].onClick).toBeUndefined();
    });

    it('si la cuenta falló ofrece reintentar', () => {
        const pasos = pasosDeExito({ alumno, cuenta: null, errorCuenta: 'Sin red', onCrearCuenta: vi.fn() });
        expect(pasos[3].label).toBe('Reintentar la cuenta');
    });

    it('títulos y descripciones caben en una línea de la tarjeta a 360 px', () => {
        for (const errorCuenta of [null, 'x']) {
            const pasos = pasosDeExito({ alumno, cuenta: null, errorCuenta, onCrearCuenta: vi.fn() });
            for (const p of pasos) {
                expect(p.label.length).toBeLessThanOrEqual(25);
                expect(p.description.length).toBeLessThanOrEqual(30);
            }
        }
    });
});

describe('descripcionDeExito', () => {
    it('dice quién es y que ya está activo', () => {
        expect(descripcionDeExito({ matricula: 'E1', nombre_completo: 'Soto Carla' }, null)).toBe('Soto Carla (E1) ya está activo.');
        expect(descripcionDeExito({ matricula: 'E1', nombre_completo: 'Soto Carla' }, { correo: 'a@b.c' })).toMatch(/cuenta de acceso/);
    });
});
