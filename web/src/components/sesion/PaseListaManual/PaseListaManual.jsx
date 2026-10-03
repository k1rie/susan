'use client';

import { useState } from 'react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import StatusChip from '@/components/ui/StatusChip';
import Table from '@/components/ui/Table';
import { useToast } from '@/components/ui/Toast';
import { useApiMutation } from '@/hooks/data';
import { cerrarSesion, paseListaManual } from '@/lib/api/sesiones.js';
import { formatearHoraIso, sugerirEstado } from '../MonitorSesion/monitorSesion.utils.js';

const OPCIONES = [
    { value: '', label: 'Sin marcar' },
    { value: 'presente', label: 'Presente' },
    { value: 'retardo', label: 'Retardo' },
    { value: 'ausente', label: 'Ausente' },
];
const ESTADOS_EDITABLES = ['presente', 'retardo', 'ausente'];

// P-04: pase de lista manual (sesion sin camaras activas, RN-06). `data` = respuesta de api_sesion_monitor.
export default function PaseListaManual({ data, onActualizar }) {
    const { sesion, alumnos = [] } = data;
    const { toast } = useToast();
    const guardarMut = useApiMutation(paseListaManual);
    const cerrarMut = useApiMutation(cerrarSesion);
    const sugerido = sugerirEstado(sesion);
    const activos = alumnos.filter((a) => !a.inscripcion || a.inscripcion === 'activa');
    const [marcas, setMarcas] = useState(() => Object.fromEntries(activos.filter((a) => ESTADOS_EDITABLES.includes(a.estado)).map((a) => [a.id_alumno, a.estado])));
    const ocupado = guardarMut.loading || cerrarMut.loading;

    const marcarRestantes = () => setMarcas((prev) => Object.fromEntries(activos.map((a) => [a.id_alumno, prev[a.id_alumno] || sugerido])));

    const registros = () => Object.entries(marcas).filter(([, e]) => e).map(([id, estado]) => ({ id_alumno: Number(id), estado }));

    const guardar = async (cerrar) => {
        try {
            const r = await guardarMut.run({ idSesion: sesion.id_sesion, registros: registros() });
            toast({ tone: 'success', title: 'Pase de lista guardado', message: `${r.procesados ?? 0} registros (origen manual).` });
        } catch (e) {
            toast({ tone: 'danger', title: 'No se pudo guardar el pase de lista', message: e.message });
            return;
        }
        if (cerrar) {
            try {
                await cerrarMut.run({ idSesion: sesion.id_sesion });
                toast({ tone: 'success', title: 'Sesión cerrada' });
            } catch (e) {
                toast({ tone: 'danger', title: 'No se pudo cerrar la sesión', message: e.message });
            }
        }
        onActualizar?.();
    };

    const columns = [
        { key: 'matricula', header: 'Matrícula' },
        { key: 'nombre', header: 'Alumno', primary: true },
        {
            key: 'estado',
            header: 'Estado',
            render: (a) => (
                <Select aria-label={`Estado de ${a.nombre}`} value={marcas[a.id_alumno] ?? ''} options={OPCIONES} onChange={(e) => setMarcas((p) => ({ ...p, [a.id_alumno]: e.target.value }))} className="min-w-36" />
            ),
        },
        { key: 'sugerencia', header: 'Sugerido', render: () => <StatusChip kind="asistencia" value={sugerido} size="sm" /> },
        { key: 'hora', header: 'Hora', render: (a) => (a.hora_registro ? formatearHoraIso(a.hora_registro) : 'Al guardar') },
        { key: 'origen', header: 'Origen', render: (a) => (a.origen ? <StatusChip kind="origen" value={a.origen} size="sm" /> : <StatusChip kind="origen" value="manual" size="sm" />) },
    ];

    return (
        <div className="flex flex-col gap-4">
            <Alert tone="info" title="Sesión en modo manual">
                El aula no tiene cámaras activas, por lo que el pase de lista es manual. Los alumnos que queden sin marcar se registrarán como ausentes al cerrar la sesion.
            </Alert>
            <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={marcarRestantes} disabled={ocupado}>
                    Marcar restantes según la hora
                </Button>
                <Button variant="secondary" onClick={() => guardar(false)} loading={guardarMut.loading && !cerrarMut.loading} disabled={ocupado}>
                    Guardar
                </Button>
                <Button onClick={() => guardar(true)} loading={cerrarMut.loading} disabled={ocupado}>
                    Guardar y cerrar sesión de clase
                </Button>
            </div>
            <Table columns={columns} rows={activos} rowKey="id_alumno" caption="Pase de lista manual" emptyMessage="El grupo no tiene alumnos inscritos." />
        </div>
    );
}
