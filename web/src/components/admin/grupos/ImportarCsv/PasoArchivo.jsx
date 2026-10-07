'use client';

import { Download } from 'lucide-react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Detalles from '@/components/ui/Detalles';
import Field from '@/components/ui/Field';
import FileInput from '@/components/ui/FileInput';
import { descargarTexto } from '../compartido/descargar.js';
import { MAX_FILAS, NOMBRE_PLANTILLA, plantillaCsv } from './importarCsv.utils.js';

const COLUMNAS_AYUDA = [
    ['matricula', 'Obligatoria. Con ella basta si el alumno ya existe.'],
    ['apellido_paterno, nombres, correo', 'Obligatorios solo para un alumno nuevo.'],
    ['apellido_materno', 'Opcional.'],
];

// Paso 1: archivo. Plantilla descargable y zona para arrastrar y soltar; las reglas se ven antes de elegir (tipo, tamaño y filas).
export default function PasoArchivo({ archivo, analisis, onElegir }) {
    return (
        <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
                Sube un CSV con una fila por alumno y los encabezados en la primera fila. Con la plantilla evitas errores de formato.
            </p>
            <div>
                <Button
                    variant="secondary"
                    size="sm"
                    icon={<Download aria-hidden="true" className="size-4" strokeWidth={1.75} />}
                    onClick={() => descargarTexto(NOMBRE_PLANTILLA, plantillaCsv())}
                >
                    Descargar plantilla
                </Button>
            </div>
            <Field label="Archivo CSV" required>
                <FileInput
                    variant="zona"
                    value={archivo}
                    onSelect={onElegir}
                    accept=".csv,text/csv,text/plain"
                    maxBytes={1024 * 1024}
                    label="selecciona un archivo CSV"
                    hint={`CSV con coma o punto y coma. Máximo 1 MB y ${MAX_FILAS} filas.`}
                />
            </Field>
            {analisis?.erroresGlobales.map((m) => (
                <Alert key={m} tone="danger" compact>
                    {m}
                </Alert>
            ))}
            <Detalles titulo="Qué columnas lleva" plano>
                <dl className="flex flex-col gap-2 text-sm">
                    {COLUMNAS_AYUDA.map(([columna, texto]) => (
                        <div key={columna}>
                            <dt className="font-mono text-[13px]">{columna}</dt>
                            <dd className="text-muted-foreground">{texto}</dd>
                        </div>
                    ))}
                </dl>
            </Detalles>
        </div>
    );
}
