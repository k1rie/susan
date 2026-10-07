'use client';

import { CircleAlert, Download, TriangleAlert, UserCheck, UserPlus, UserX } from 'lucide-react';
import Alert from '@/components/ui/Alert';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Detalles from '@/components/ui/Detalles';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';

const VISTA_PREVIA = 8;

const COLUMNAS_PREVIA = (inscritas) => [
    { key: 'linea', header: 'Fila', align: 'right' },
    { key: 'matricula', header: 'Matrícula', primary: true },
    { key: 'nombre', header: 'Nombre', render: (f) => [f.apellido_paterno, f.apellido_materno, f.nombres].filter(Boolean).join(' ') || '-' },
    { key: 'correo', header: 'Correo', render: (f) => f.correo || '-' },
    {
        key: 'estado',
        header: 'Estado',
        render: (f) => (inscritas.has(f.matricula) ? <Badge>Ya inscrito</Badge> : !f.apellido_paterno && !f.nombres && !f.correo ? <Badge tone="warning">Solo matrícula</Badge> : <Badge tone="success">Lista</Badge>),
    },
];

// Paso 2: revisión. Cuatro contadores (qué entra, qué se omite, qué merece atención, qué se descartó) y los problemas agrupados por causa
// con sus filas, para corregir el archivo de una vez en vez de fila por fila.
export default function PasoRevision({ revision, analisis, onDescargarErrores }) {
    const inscritas = new Set(revision.yaInscritas.map((f) => f.matricula));
    return (
        <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard icon={UserPlus} label="Se inscribirán" value={revision.paraEnviar.length} hint="Filas válidas" tone="success" />
                <StatCard icon={UserCheck} label="Ya inscritos" value={revision.yaInscritas.length} hint="Se omiten" />
                <StatCard icon={TriangleAlert} label="Con aviso" value={revision.soloMatricula.length} hint="Solo matrícula" tone={revision.soloMatricula.length ? 'warning' : 'neutral'} />
                <StatCard icon={UserX} label="Descartadas" value={revision.descartadas.length} hint="Con error" tone={revision.descartadas.length ? 'danger' : 'neutral'} />
            </div>

            {revision.gruposDescartadas.length > 0 && (
                <Alert tone="danger" compact title="Filas descartadas: no se importarán">
                    <ul className="flex flex-col gap-1">
                        {revision.gruposDescartadas.map((g) => (
                            <li key={g.mensaje} className="flex items-start gap-1.5">
                                <CircleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} />
                                <span>
                                    {g.mensaje} — {g.cantidad === 1 ? 'fila' : 'filas'} {g.filas}
                                </span>
                            </li>
                        ))}
                    </ul>
                    <Button variant="ghost" size="sm" className="mt-2" icon={<Download aria-hidden="true" className="size-4" strokeWidth={1.75} />} onClick={onDescargarErrores}>
                        Descargar filas con error
                    </Button>
                </Alert>
            )}
            {revision.avisoSoloMatricula && (
                <Alert tone="warning" compact title="Filas con solo la matrícula">
                    Sirven si el alumno ya existe en SUSAN; si no existe, el servidor las rechazará porque faltan apellido paterno, nombres y correo — filas {revision.avisoSoloMatricula.filas}.
                </Alert>
            )}
            {revision.yaInscritas.length > 0 && (
                <p className="text-[13px] text-muted-foreground">
                    {revision.yaInscritas.length === 1 ? 'Una fila ya está inscrita en este grupo y no se enviará.' : `${revision.yaInscritas.length} filas ya están inscritas en este grupo y no se enviarán.`}
                </p>
            )}
            {revision.paraEnviar.length === 0 && (
                <Alert tone="warning" compact>
                    No queda ninguna fila para importar. Corrige el archivo y vuelve a elegirlo en el paso anterior.
                </Alert>
            )}

            <Detalles titulo="Vista previa" resumen={`Primeras ${Math.min(VISTA_PREVIA, analisis.filas.length)} de ${analisis.filas.length} filas`} plano>
                <Table columns={COLUMNAS_PREVIA(inscritas)} rows={analisis.filas.slice(0, VISTA_PREVIA)} rowKey="linea" />
            </Detalles>
        </div>
    );
}
