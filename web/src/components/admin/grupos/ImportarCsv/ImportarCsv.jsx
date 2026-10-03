'use client';

import { useState } from 'react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import FileInput from '@/components/ui/FileInput';
import Table from '@/components/ui/Table';
import { useToast } from '@/components/ui/Toast';
import { useApiMutation } from '@/hooks/data';
import { importarInscripciones } from '@/lib/api/admin.js';
import { COLUMNAS, filasParaApi, MAX_FILAS, parsearCsvInscripciones } from './importarCsv.utils.js';

const COLS_PREVIA = [
    { key: 'linea', header: 'Línea', align: 'right' },
    { key: 'matricula', header: 'Matrícula', primary: true },
    { key: 'nombre', header: 'Nombre', render: (f) => [f.apellido_paterno, f.apellido_materno, f.nombres].filter(Boolean).join(' ') || '-' },
    { key: 'correo', header: 'Correo', render: (f) => f.correo || '-' },
];
const COLS_RESULTADO = [
    { key: 'linea', header: 'Línea', align: 'right' },
    { key: 'matricula', header: 'Matrícula', primary: true },
    { key: 'resultado', header: 'Resultado' },
    { key: 'mensaje', header: 'Detalle', render: (f) => f.mensaje || '-' },
];

// Importación por lotes (máx. 500): vista previa local, envío y reporte fila por fila.
export default function ImportarCsv({ idGrupo, onImported }) {
    const { toast } = useToast();
    const importar = useApiMutation(importarInscripciones);
    const [archivo, setArchivo] = useState(null);
    const [analisis, setAnalisis] = useState(null);
    const [reporte, setReporte] = useState(null);

    const elegir = async (file) => {
        setArchivo(file);
        setReporte(null);
        if (!file) {
            setAnalisis(null);
            return;
        }
        try {
            setAnalisis(parsearCsvInscripciones(await file.text()));
        } catch {
            setAnalisis({ filas: [], errores: [], erroresGlobales: ['No se pudo leer el archivo.'] });
        }
    };

    const enviar = async () => {
        try {
            const r = await importar.run({ idGrupo, filas: filasParaApi(analisis.filas) });
            // El servidor numera por posición en el lote; se vuelve a la línea del archivo.
            const filas = (r.filas ?? []).map((f) => ({ ...f, linea: analisis.filas[f.fila - 1]?.linea ?? f.fila }));
            setReporte({ ...r, filas });
            toast({ tone: r.errores ? 'warning' : 'success', message: `Importación terminada: ${r.inscritos + (r.reinscritos || 0)} inscritos, ${r.errores} con error.` });
            onImported?.(r);
        } catch (error) {
            toast({ tone: 'danger', title: 'No se pudo importar', message: error.message });
        }
    };

    const puedeEnviar = analisis && analisis.erroresGlobales.length === 0 && analisis.filas.length > 0 && !reporte;

    return (
        <div className="grid gap-3">
            <p className="text-sm text-muted">
                CSV con encabezado. Columnas: {COLUMNAS.join(', ')}. Con la matrícula basta si el alumno ya existe; para un alumno nuevo
                se requieren apellido_paterno, nombres y correo. Máximo {MAX_FILAS} filas.
            </p>
            <FileInput value={archivo} onSelect={elegir} accept=".csv,text/csv,text/plain" maxBytes={1024 * 1024} label="Elegir archivo CSV" />
            {analisis?.erroresGlobales.map((m) => (
                <Alert key={m} tone="danger">{m}</Alert>
            ))}
            {analisis && analisis.erroresGlobales.length === 0 && !reporte && (
                <>
                    <p aria-live="polite" className="text-sm">
                        {analisis.filas.length} fila(s) listas para importar; {analisis.errores.length} descartada(s).
                    </p>
                    {analisis.errores.length > 0 && (
                        <Alert tone="warning" title="Filas descartadas">
                            <ul className="list-disc pl-5">
                                {analisis.errores.map((e) => (
                                    <li key={e.linea}>Línea {e.linea}{e.matricula ? ` (${e.matricula})` : ''}: {e.mensaje}</li>
                                ))}
                            </ul>
                        </Alert>
                    )}
                    <Table columns={COLS_PREVIA} rows={analisis.filas.slice(0, 20)} rowKey="linea" caption={analisis.filas.length > 20 ? 'Vista previa (primeras 20 filas)' : 'Vista previa'} />
                </>
            )}
            {puedeEnviar && (
                <div>
                    <Button loading={importar.loading} onClick={enviar}>
                        Importar {analisis.filas.length} fila(s)
                    </Button>
                </div>
            )}
            {reporte && (
                <div className="grid gap-2" aria-live="polite">
                    <Alert tone={reporte.errores ? 'warning' : 'success'} title="Reporte de importación">
                        Total {reporte.total}: inscritos {reporte.inscritos}, reinscritos {reporte.reinscritos}, omitidos {reporte.omitidos}, con error {reporte.errores}; alumnos creados {reporte.alumnos_creados}.
                    </Alert>
                    <Table columns={COLS_RESULTADO} rows={reporte.filas} rowKey="fila" />
                </div>
            )}
        </div>
    );
}
