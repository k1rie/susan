'use client';

import { Download, FileCheck, Users } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import Detalles from '@/components/ui/Detalles';
import SuccessState from '@/components/ui/SuccessState';
import Table from '@/components/ui/Table';
import { plural } from '../compartido/grupos.utils.js';

const TONO = { inscrito: 'success', reinscrito: 'success', omitido: 'neutral', error: 'danger' };
const COLUMNAS_RESULTADO = [
    { key: 'linea', header: 'Fila', align: 'right' },
    { key: 'matricula', header: 'Matrícula', primary: true },
    { key: 'resultado', header: 'Resultado', render: (f) => <Badge tone={TONO[f.resultado] ?? 'neutral'}>{f.resultado}</Badge> },
    { key: 'mensaje', header: 'Detalle', render: (f) => f.mensaje || '-' },
];

// Paso 4: resultado con las cifras reales del servidor, el reporte descargable de lo que falló y el siguiente paso.
export default function PasoResultado({ reporte, fallidas, onDescargar, onCerrar, onOtro }) {
    const dentro = reporte.inscritos + (reporte.reinscritos || 0);
    const pasos = [
        ...(fallidas > 0
            ? [{ label: `Descargar el reporte de ${plural(fallidas, 'fila con error', 'filas con error')}`, description: 'Corrige el archivo y reimporta solo esas.', icon: Download, onClick: onDescargar, recommended: true }]
            : []),
        { label: 'Ver la lista de inscritos', description: 'Cierra esta ventana y revisa el grupo.', icon: Users, onClick: onCerrar, recommended: fallidas === 0 },
    ];
    return (
        <div className="flex flex-col gap-3">
            <SuccessState
                icon={FileCheck}
                title={`${plural(dentro, 'alumno inscrito', 'alumnos inscritos')}`}
                description={`Total ${reporte.total}: inscritos ${reporte.inscritos}, reinscritos ${reporte.reinscritos}, omitidos ${reporte.omitidos}, con error ${reporte.errores}; alumnos creados ${reporte.alumnos_creados}.`}
                steps={pasos}
                actions={[{ label: 'Importar otro archivo', onClick: onOtro, variant: 'secondary' }]}
                className="py-2"
            />
            <Detalles titulo="Detalle por fila" resumen={`${reporte.filas.length} filas`} plano>
                <Table columns={COLUMNAS_RESULTADO} rows={reporte.filas} rowKey="fila" />
            </Detalles>
        </div>
    );
}
