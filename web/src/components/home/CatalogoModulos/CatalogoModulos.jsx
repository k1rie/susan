'use client';

import { useState } from 'react';
import { StaggerList } from '@/components/motion';
import Pills from '@/components/ui/Pills';
import { aplicarFiltro, filtrosDeModulos, modulosParaRol } from '@/lib/modulos.js';
import ModuloCard from '../ModuloCard';

// Catálogo de /modulos: píldoras de filtro (activa en tinta, como «My apps / All apps» de Dash) y cuadrícula de tarjetas de
// portada. Recibe solo el rol (cadena): el registro trae componentes de icono y no puede cruzar de servidor a cliente.
export default function CatalogoModulos({ rol, filtroInicial = 'todos' }) {
    const todos = modulosParaRol(rol);
    const filtros = filtrosDeModulos(todos);
    const [filtro, setFiltro] = useState(filtros.some((f) => f.id === filtroInicial) ? filtroInicial : 'todos');
    const visibles = aplicarFiltro(todos, filtro);

    return (
        <div className="flex flex-col gap-6">
            <Pills label="Filtrar módulos" items={filtros.map((f) => ({ id: f.id, label: f.etiqueta, count: f.total }))} value={filtro} onChange={setFiltro} />
            <p aria-live="polite" className="sr-only">{visibles.length} módulos</p>
            <StaggerList key={filtro} className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5" step={0.03} max={0.35}>
                {visibles.map((m) => (
                    <ModuloCard key={m.id} modulo={m} />
                ))}
            </StaggerList>
        </div>
    );
}
