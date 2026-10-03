'use client';

import { docentesListar } from '@/lib/api/admin.js';
import CatalogoTabla from '../CatalogoTabla';
import DocenteForm, { ESTATUS_DOCENTE, etiquetaEstatusDocente } from '../DocenteForm/DocenteForm.jsx';

const COLUMNAS = [
    { key: 'num_empleado', header: 'No. empleado', primary: true },
    { key: 'nombre_completo', header: 'Nombre' },
    { key: 'correo_institucional', header: 'Correo' },
    { key: 'estatus', header: 'Estatus', render: (d) => etiquetaEstatusDocente(d.estatus) },
    { key: 'grupos', header: 'Grupos', align: 'right' },
];

export default function ListadoDocentes() {
    return (
        <CatalogoTabla
            titulo="Docentes"
            subtitulo="Alta, edición y baja lógica"
            listar={docentesListar}
            columnas={COLUMNAS}
            rowKey="id_docente"
            Formulario={DocenteForm}
            nuevoLabel="Nuevo docente"
            busquedaLabel="Número de empleado o nombre"
            filtros={[{ name: 'estatus', label: 'Estatus', options: ESTATUS_DOCENTE }]}
            unidad="docente(s)"
            vacioTitulo="No hay docentes que coincidan"
        />
    );
}
