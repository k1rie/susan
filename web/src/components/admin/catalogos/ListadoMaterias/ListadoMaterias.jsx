'use client';

import { materiasListar } from '@/lib/api/admin.js';
import CatalogoTabla from '../CatalogoTabla';
import MateriaForm from '../MateriaForm';

const COLUMNAS = [
    { key: 'clave', header: 'Clave', primary: true },
    { key: 'nombre', header: 'Nombre' },
    { key: 'creditos', header: 'Créditos', align: 'right' },
    { key: 'horas_semana', header: 'Horas/semana', align: 'right' },
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
