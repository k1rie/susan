import StatusChip from '@/components/ui/StatusChip';
import { formatearHoraIso } from '../MonitorSesion/monitorSesion.utils.js';

// Camaras del aula con su ultima captura y estatus (P-03).
export default function EstadoCamaras({ camaras = [] }) {
    if (camaras.length === 0) {
        return <p className="text-sm text-muted-foreground">El aula no tiene cámaras registradas.</p>;
    }
    return (
        <ul className="grid gap-2 sm:grid-cols-2">
            {camaras.map((c) => (
                <li key={c.id_camara} className="flex flex-col gap-1 rounded-md border border-border p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">
                            Camara {c.posicion} ({c.tipo === 'ip' ? 'IP' : 'navegador'})
                        </span>
                        <StatusChip kind="camara" value={c.estatus} size="sm" />
                    </div>
                    <span className="text-muted-foreground">
                        Ultima captura: {c.ultima_captura ? formatearHoraIso(c.ultima_captura) : 'sin capturas'} · {c.capturas ?? 0} en total
                    </span>
                </li>
            ))}
        </ul>
    );
}
