import { Camera } from 'lucide-react';
import StatusChip from '@/components/ui/StatusChip';
import TarjetaFila from '@/components/ui/TarjetaFila';
import { formatearHoraIso } from '../MonitorSesion/monitorSesion.utils.js';

// Cámaras del aula (P-03): una tarjeta de fila por cámara con su última captura y el estatus.
export default function EstadoCamaras({ camaras = [] }) {
    if (camaras.length === 0) {
        return <p className="text-sm text-muted-foreground">Sin cámaras registradas en el aula.</p>;
    }
    return (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {camaras.map((c) => (
                <li key={c.id_camara}>
                    <TarjetaFila
                        icono={Camera}
                        tono={c.estatus === 'activa' ? 'verde' : 'neutro'}
                        titulo={`Cámara ${c.posicion} (${c.tipo === 'ip' ? 'IP' : 'navegador'})`}
                        subtitulo={`${c.ultima_captura ? formatearHoraIso(c.ultima_captura) : 'Sin capturas'} · ${c.capturas ?? 0} en total`}
                        accion={<StatusChip kind="camara" value={c.estatus} size="sm" />}
                    />
                </li>
            ))}
        </ul>
    );
}
