'use client';

import { aulasListar } from '@/lib/api/admin.js';
import AulaForm from '../AulaForm';
import CatalogoTabla from '../CatalogoTabla';

const COLUMNAS = [
    { key: 'clave', header: 'Clave', primary: true },
    { key: 'edificio', header: 'Edificio' },
    { key: 'capacidad', header: 'Capacidad', align: 'right' },
    { key: 'camaras', header: 'Cámaras activas', align: 'right', render: (a) => `${a.camaras_activas ?? 0} de ${a.camaras_total ?? 0}` },
];

export default function ListadoAulas() {
    return (
        <CatalogoTabla
            titulo="Aulas"
            subtitulo="Catálogo de aulas y capacidad"
            listar={aulasListar}
            columnas={COLUMNAS}
            rowKey="id_aula"
            Formulario={AulaForm}
            nuevoLabel="Nueva aula"
            busquedaLabel="Clave o edificio"
            unidad="aula(s)"
            vacioTitulo="No hay aulas que coincidan"
        />
    );
}
