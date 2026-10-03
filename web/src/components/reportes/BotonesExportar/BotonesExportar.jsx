'use client';

import Button from '@/components/ui/Button';
import { construirCsvGrupo, construirCsvPeriodo, descargarCsv, nombreArchivoCsv } from '../csv/reporteCsv.utils.js';

// Exportación en el cliente con los datos ya cargados; sin llamadas de red.
export default function BotonesExportar({ reporte, tipo = 'grupo', deshabilitado = false }) {
    const sinDatos = deshabilitado || !reporte || !(reporte.items || []).length;
    const exportar = () => {
        const texto = tipo === 'periodo' ? construirCsvPeriodo(reporte) : construirCsvGrupo(reporte);
        descargarCsv(texto, nombreArchivoCsv(reporte, tipo));
    };
    return (
        <div className="print:hidden flex flex-wrap gap-2">
            <Button variant="secondary" onClick={exportar} disabled={sinDatos}>Exportar CSV</Button>
            <Button variant="secondary" onClick={() => window.print()} disabled={sinDatos}>Imprimir / PDF</Button>
        </div>
    );
}
