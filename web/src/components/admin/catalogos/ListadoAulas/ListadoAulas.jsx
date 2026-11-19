'use client';

import Badge from '@/components/ui/Badge';
import { aulasListar } from '@/lib/api/admin.js';
import AulaForm from '../AulaForm';
import CatalogoTabla from '../CatalogoTabla';

// En 360 px el edificio pasa a una línea bajo la clave (la tabla no cabe con todas las columnas). Un laboratorio lleva la insignia
// «Laboratorio» junto a la clave (texto, no solo color) en todos los anchos: es la columna que siempre se ve.
const COLUMNAS = [
    {
        key: 'clave',
        header: 'Clave',
        primary: true,
        render: (a) => (
            <>
                {a.clave}
                {a.tipo === 'laboratorio' && (
                    <Badge tone="info" className="ml-2 align-middle">
                        Laboratorio
                    </Badge>
                )}
                <span className="block text-xs font-normal text-muted-foreground sm:hidden">{a.edificio}</span>
            </>
        ),
    },
    { key: 'edificio', header: 'Edificio', hideBelow: 'sm' },
    { key: 'capacidad', header: 'Capacidad', align: 'right' },
    { key: 'camaras', header: 'Cámaras activas', align: 'right', hideBelow: 'sm', render: (a) => `${a.camaras_activas ?? 0} de ${a.camaras_total ?? 0}` },
];

export default function ListadoAulas() {
    return (
        <CatalogoTabla
            titulo="Aulas"
            subtitulo="Catálogo de aulas y laboratorios, con su capacidad"
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
