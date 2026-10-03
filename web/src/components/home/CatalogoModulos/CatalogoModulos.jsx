'use client';

import { Check } from 'lucide-react';
import { useState } from 'react';
import { StaggerList } from '@/components/motion';
import { aplicarFiltro, filtrosDeModulos, modulosParaRol } from '@/lib/modulos.js';
import clsx from 'clsx';
import ModuloCard from '../ModuloCard';

// Catálogo de /modulos: filtros en píldora (contenedor gris, activo oscuro con palomita) y cuadrícula de tarjetas.
// Recibe solo el rol (cadena): el registro trae componentes de icono y no puede cruzar de servidor a cliente.
export default function CatalogoModulos({ rol, filtroInicial = 'todos' }) {
    const todos = modulosParaRol(rol);
    const filtros = filtrosDeModulos(todos);
    const [filtro, setFiltro] = useState(filtros.some((f) => f.id === filtroInicial) ? filtroInicial : 'todos');
    const visibles = aplicarFiltro(todos, filtro);

    return (
        <div className="flex flex-col gap-5">
            <div role="group" aria-label="Filtrar módulos" className="flex max-w-full flex-wrap gap-1 self-start rounded-3xl bg-muted p-1 sm:flex-nowrap sm:rounded-full">
                {filtros.map((f) => {
                    const activo = f.id === filtro;
                    return (
                        <button
                            key={f.id}
                            type="button"
                            aria-pressed={activo}
                            onClick={() => setFiltro(f.id)}
                            className={clsx(
                                'inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-sm font-medium transition-colors duration-200',
                                'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40',
                                activo ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
                            )}
                        >
                            {activo && <Check aria-hidden="true" className="size-3.5" strokeWidth={2.25} />}
                            {f.etiqueta}
                            <span className={clsx('text-xs', activo ? 'opacity-70' : 'opacity-60')}>{f.total}</span>
                        </button>
                    );
                })}
            </div>
            <p aria-live="polite" className="sr-only">{visibles.length} módulos</p>
            <StaggerList key={filtro} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" step={0.04} max={0.4}>
                {visibles.map((m) => (
                    <ModuloCard key={m.id} modulo={m} />
                ))}
            </StaggerList>
        </div>
    );
}
