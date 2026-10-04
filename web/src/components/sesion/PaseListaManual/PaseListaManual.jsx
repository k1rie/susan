'use client';

import { ClipboardCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import Alert from '@/components/ui/Alert';
import Select from '@/components/ui/Select';
import StatusChip from '@/components/ui/StatusChip';
import Table from '@/components/ui/Table';
import { useToast } from '@/components/ui/Toast';
import { useApiMutation } from '@/hooks/data';
import { cerrarSesion, paseListaManual } from '@/lib/api/sesiones.js';
import AccionesPaseLista from '../AccionesPaseLista';
import { enfocarPanel } from '../enfocarPanel.js';
import { formatearHoraIso, sugerirEstado } from '../MonitorSesion/monitorSesion.utils.js';
import { conteoMarcas } from './paseListaManual.utils.js';

const OPCIONES = [
    { value: '', label: 'Sin marcar' },
    { value: 'presente', label: 'Presente' },
    { value: 'retardo', label: 'Retardo' },
    { value: 'ausente', label: 'Ausente' },
];
const ESTADOS_EDITABLES = ['presente', 'retardo', 'ausente'];

// P-04: pase de lista manual (sesion sin camaras activas, RN-06). `data` = respuesta de api_sesion_monitor. Es el contenido principal de la
// pantalla («Pasar lista (manual)»): con las mismas acciones que el pase con camara (una primaria, que guarda y cierra, y las secundarias).
//   enfocar = se llego a pasar lista (?pasar-lista=1 o recien abierta): el contenedor recibe el foco al montarse
export default function PaseListaManual({ data, onActualizar, enfocar = false }) {
    const { sesion, alumnos = [] } = data;
    const { toast } = useToast();
    const guardarMut = useApiMutation(paseListaManual);
    const cerrarMut = useApiMutation(cerrarSesion);
    const sugerido = sugerirEstado(sesion);
    const activos = alumnos.filter((a) => !a.inscripcion || a.inscripcion === 'activa');
    const [marcas, setMarcas] = useState(() => Object.fromEntries(activos.filter((a) => ESTADOS_EDITABLES.includes(a.estado)).map((a) => [a.id_alumno, a.estado])));
    const ocupado = guardarMut.loading || cerrarMut.loading;
    const avance = conteoMarcas(activos, marcas);
    const panelRef = useRef(null);
    useEffect(() => {
        if (enfocar) enfocarPanel(panelRef.current);
    }, [enfocar]);

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
        { key: 'matricula', header: 'Matrícula', hideBelow: 'sm' },
        { key: 'nombre', header: 'Alumno', primary: true },
        {
            key: 'estado',
            header: 'Estado',
            render: (a) => (
                <Select aria-label={`Estado de ${a.nombre}`} value={marcas[a.id_alumno] ?? ''} options={OPCIONES} onChange={(e) => setMarcas((p) => ({ ...p, [a.id_alumno]: e.target.value }))} className="min-w-36" />
            ),
        },
        { key: 'hora', header: 'Hora', hideBelow: 'md', render: (a) => (a.hora_registro ? formatearHoraIso(a.hora_registro) : 'Al guardar') },
        { key: 'origen', header: 'Origen', hideBelow: 'md', render: (a) => (a.origen ? <StatusChip kind="origen" value={a.origen} size="sm" /> : <StatusChip kind="origen" value="manual" size="sm" />) },
    ];

    return (
        <div ref={panelRef} tabIndex={-1} className="flex flex-col gap-4 outline-none focus-visible:ring-4 focus-visible:ring-ring/30">
            <Alert tone="info" title="Sesión en modo manual">
                El aula no tiene cámaras activas. Quien quede sin marcar será ausente al cerrar la sesión.
            </Alert>
            <div className="flex flex-col gap-1.5">
                <p className="text-sm">
                    Marcados <strong className="font-semibold tabular-nums">{avance.marcados}</strong> de <span className="tabular-nums">{avance.total}</span>
                </p>
                <span
                    role="progressbar"
                    aria-label="Alumnos marcados"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(avance.ancho)}
                    aria-valuetext={`${avance.marcados} de ${avance.total}`}
                    className="block h-1.5 max-w-80 overflow-hidden rounded-full bg-muted"
                >
                    <span className="block h-full rounded-full bg-presente" style={{ width: `${avance.ancho}%` }} />
                </span>
            </div>
            {/* La sugerencia es la misma para todos (sale de la hora): se dice una vez, no en una columna que se oculta en móvil. */}
            <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                Sugerido a esta hora <StatusChip kind="asistencia" value={sugerido} size="sm" />
            </p>
            <AccionesPaseLista
                primaria={{
                    etiqueta: 'Guardar y cerrar sesión de clase',
                    onClick: () => guardar(true),
                    loading: cerrarMut.loading,
                    disabled: ocupado,
                    icono: <ClipboardCheck aria-hidden="true" className="size-5" strokeWidth={1.75} />,
                }}
                secundarias={[
                    { etiqueta: 'Guardar', onClick: () => guardar(false), loading: guardarMut.loading && !cerrarMut.loading, disabled: ocupado },
                    { etiqueta: 'Marcar restantes según la hora', onClick: marcarRestantes, disabled: ocupado },
                ]}
            />
            <Table columns={columns} rows={activos} rowKey="id_alumno" caption="Pase de lista manual" emptyMessage="El grupo no tiene alumnos inscritos." />
        </div>
    );
}
