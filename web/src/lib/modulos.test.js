import { describe, expect, it } from 'vitest';
import { navParaRol } from '@/components/layout/Sidebar/navItems.js';
import {
    CATEGORIAS, ESTADOS, MODULOS, ROLES, TONOS, aplicarFiltro, buscarModulo, filtrosDeModulos,
    modulosActivos, modulosParaRol, modulosProximos, puedeVer,
} from './modulos.js';

describe('registro de módulos', () => {
    it('ids únicos, en minúsculas con guiones', () => {
        const ids = MODULOS.map((m) => m.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9-]*$/);
    });

    it('cada entrada trae los campos obligatorios con valores válidos', () => {
        const categorias = CATEGORIAS.map((c) => c.id);
        for (const m of MODULOS) {
            expect(m.titulo.length).toBeGreaterThan(2);
            expect(m.descripcion.length).toBeGreaterThan(10);
            expect(m.icono).toBeTruthy();
            expect(categorias).toContain(m.categoria);
            expect(TONOS).toContain(m.tono);
            expect(ESTADOS).toContain(m.estado);
            expect(m.roles.length).toBeGreaterThan(0);
            for (const r of m.roles) expect(ROLES).toContain(r);
        }
    });

    it('los activos tienen href interno y existen en la navegación de cada rol; los próximos no tienen href y explican qué traerán', () => {
        for (const m of MODULOS) {
            if (m.estado === 'activo') {
                expect(m.href).toMatch(/^\/[a-z]/);
                for (const rol of m.roles) expect(navParaRol(rol).map((i) => i.href), `${m.id} para ${rol}`).toContain(m.href);
            } else {
                expect(m.href).toBeUndefined();
                expect(m.queIncluye.length).toBeGreaterThanOrEqual(2);
            }
        }
    });

    it('cada ítem de la navegación de cada rol tiene su módulo activo (nada queda sin tarjeta)', () => {
        for (const rol of ROLES) {
            const hrefs = modulosActivos(rol).map((m) => m.href);
            for (const item of navParaRol(rol)) expect(hrefs, `${rol}: ${item.href}`).toContain(item.href);
        }
    });

    it('todo rol tiene al menos un módulo activo', () => {
        for (const rol of ROLES) expect(modulosActivos(rol).length).toBeGreaterThan(0);
    });
});

describe('consultas', () => {
    it('separa activos y próximos por rol', () => {
        expect(modulosActivos('alumno').map((m) => m.id)).toEqual(['mi-asistencia']);
        expect(modulosParaRol('docente').length).toBe(modulosActivos('docente').length + modulosProximos('docente').length);
        expect(modulosProximos('tecnico').map((m) => m.id)).toEqual(['acceso-campus']);
        expect(modulosParaRol('otro')).toEqual([]);
    });
    it('buscarModulo y puedeVer', () => {
        expect(buscarModulo('asistente').estado).toBe('pronto');
        expect(buscarModulo('no-existe')).toBeNull();
        expect(puedeVer(buscarModulo('bitacora'), 'docente')).toBe(false);
        expect(puedeVer(buscarModulo('bitacora'), 'administrador')).toBe(true);
    });
});

describe('filtros de /modulos', () => {
    it('solo ofrece filtros con módulos y cuenta bien', () => {
        const filtros = filtrosDeModulos(modulosParaRol('alumno'));
        expect(filtros.map((f) => f.id)).toEqual(['todos', 'asistencia', 'pronto']);
        expect(filtros[0].total).toBe(modulosParaRol('alumno').length);
        expect(filtros.find((f) => f.id === 'pronto').total).toBe(modulosProximos('alumno').length);
    });
    it('aplicarFiltro: todos, categoría (solo activos) y pronto', () => {
        const mods = modulosParaRol('administrador');
        expect(aplicarFiltro(mods, 'todos')).toHaveLength(mods.length);
        expect(aplicarFiltro(mods, undefined)).toHaveLength(mods.length);
        expect(aplicarFiltro(mods, 'pronto').every((m) => m.estado === 'pronto')).toBe(true);
        expect(aplicarFiltro(mods, 'administracion').every((m) => m.estado === 'activo' && m.categoria === 'administracion')).toBe(true);
    });
});
