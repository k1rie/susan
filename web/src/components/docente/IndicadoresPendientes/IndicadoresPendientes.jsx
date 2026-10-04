import { ClipboardCheck, FileText } from 'lucide-react';
import StatCard from '@/components/ui/StatCard';
import { apoyoPendiente, cantidadSegura } from './indicadoresPendientes.utils.js';

// Contadores del panel: registros pendientes de revisar y justificantes por resolver (enlazan a P-05).
// Una tarjeta por fila a ancho de teléfono: con la pastilla del icono y la flecha de enlace, dos columnas a 360 px dejarían ~60 px a la
// etiqueta y «Justificantes» o «pendientes» se cortarían. Desde `sm` van lado a lado.
export default function IndicadoresPendientes({ pendientes = 0, justificantes = 0 }) {
    const registros = cantidadSegura(pendientes);
    const porResolver = cantidadSegura(justificantes);
    return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <StatCard
                animated
                icon={ClipboardCheck}
                label="Registros pendientes de revisión"
                value={registros}
                hint={apoyoPendiente(registros, 'revisión')}
                tone={registros > 0 ? 'warning' : 'neutral'}
                href="/docente/revision?pestana=pendientes"
            />
            <StatCard
                animated
                icon={FileText}
                label="Justificantes por resolver"
                value={porResolver}
                hint={apoyoPendiente(porResolver, 'resolución')}
                tone={porResolver > 0 ? 'warning' : 'neutral'}
                href="/docente/revision?pestana=justificantes"
            />
        </div>
    );
}
