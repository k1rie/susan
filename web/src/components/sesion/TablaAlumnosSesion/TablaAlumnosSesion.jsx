import Button from '@/components/ui/Button';
import StatusChip from '@/components/ui/StatusChip';
import Table from '@/components/ui/Table';
import { estadoMostrado, etiquetaScore, formatearHoraIso, motivoRegistroManual } from '../MonitorSesion/monitorSesion.utils.js';

export const LECTURAS_REQUERIDAS = 3;

// Alumnos de la sesion (P-03). Las columnas secundarias (matrícula, score, origen, hora, consentimiento) se ocultan en pantallas
// angostas para no desbordar. `onRegistrar(alumno)` solo se ofrece a quien puede registrarse a mano.
export default function TablaAlumnosSesion({ alumnos = [], onRegistrar, puedeRegistrar = false }) {
    const columns = [
        { key: 'matricula', header: 'Matrícula', hideBelow: 'sm' },
        { key: 'nombre', header: 'Alumno', primary: true },
        { key: 'estado', header: 'Estado', render: (a) => <StatusChip kind="asistencia" value={estadoMostrado(a)} size="sm" /> },
        { key: 'lecturas', header: 'Lecturas', align: 'center', render: (a) => `${a.lecturas_validas ?? 0}/${LECTURAS_REQUERIDAS}` },
        { key: 'mejor_score', header: 'Mejor score', align: 'right', hideBelow: 'md', render: (a) => etiquetaScore(a.mejor_score) },
        { key: 'origen', header: 'Origen', hideBelow: 'md', render: (a) => (a.origen ? <StatusChip kind="origen" value={a.origen} size="sm" /> : '-') },
        { key: 'hora_registro', header: 'Hora', hideBelow: 'md', render: (a) => (a.hora_registro ? formatearHoraIso(a.hora_registro) : '-') },
        {
            key: 'consentimiento',
            header: 'Consentimiento',
            hideBelow: 'md',
            render: (a) => <StatusChip kind="consentimiento" value={a.consentimiento_vigente ? 'vigente' : 'vencido'} size="sm" title={a.consentimiento_vigente ? 'Consentimiento vigente' : 'Sin consentimiento vigente'} />,
        },
    ];
    if (puedeRegistrar && onRegistrar) {
        columns.push({
            key: 'accion',
            header: 'Acción',
            render: (a) => {
                const motivo = motivoRegistroManual(a);
                if (!motivo) return null;
                // En pantallas angostas las columnas de consentimiento y lecturas no caben: el motivo viaja con el botón.
                return (
                    <div className="flex flex-col items-start gap-1">
                        <Button size="sm" variant="secondary" onClick={() => onRegistrar(a)}>
                            Registrar manualmente
                        </Button>
                        <span className="text-xs text-muted-foreground md:hidden">{motivo}</span>
                    </div>
                );
            },
        });
    }
    return <Table columns={columns} rows={alumnos} rowKey="id_alumno" caption="Alumnos inscritos" emptyMessage="El grupo no tiene alumnos inscritos." />;
}
