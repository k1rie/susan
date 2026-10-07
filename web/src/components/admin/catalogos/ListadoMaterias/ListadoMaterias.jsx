'use client';

import { materiasListar } from '@/lib/api/admin.js';
import CatalogoTabla from '../CatalogoTabla';
import MateriaForm from '../MateriaForm';

// En 360 px la clave y los créditos pasan a una línea bajo el nombre (la tabla no cabe con todas las columnas).
const COLUMNAS = [
    {
        key: 'nombre',
        header: 'Nombre',
        primary: true,
        render: (m) => (
            <>
                {m.nombre}
                <span className="block text-xs font-normal text-muted-foreground sm:hidden">
                    {m.clave} · {m.creditos} cr. · {m.horas_semana} h/sem
                </span>
            </>
        ),
    },
    { key: 'clave', header: 'Clave', hideBelow: 'sm' },
    { key: 'creditos', header: 'Créditos', align: 'right', hideBelow: 'sm' },
    { key: 'horas_semana', header: 'Horas/semana', align: 'right', hideBelow: 'sm' },
];

export default function ListadoMaterias() {
    return (
        <CatalogoTabla
            titulo="Materias"
            subtitulo="Catálogo de materias"
            listar={materiasListar}
            columnas={COLUMNAS}
            rowKey="id_materia"
            Formulario={MateriaForm}
            nuevoLabel="Nueva materia"
            busquedaLabel="Clave o nombre"
            unidad="materia(s)"
            vacioTitulo="No hay materias que coincidan"
        />
    );
}
